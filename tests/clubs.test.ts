import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildLoginPath, getSafeReturnPath, isProtectedRoutePath } from "../lib/auth";
import { clubAuthPhase } from "../lib/clubs/auth-events";
import { createClubReadApi } from "../lib/clubs/api";
import { ClubReadError, type ClubMember } from "../lib/clubs/types";
import { locales } from "../lib/locales";

const clubId = "11111111-1111-4111-8111-111111111111";
const row = { id: clubId, name: "Test club", description: "Members' description", owner_id: "actor" };
const member: ClubMember = { user_id: "actor", display_name: "Test Rider", avatar_url: null, role: "owner", joined_at: "2026-11-11T10:00:00Z" };
type Call = { source: string; args?: Record<string, unknown>; header?: string; range?: [number, number]; fields?: string; single?: boolean; filters: Record<string, unknown>; orders: string[] };
type Response = { data: unknown; error: unknown };

function backend(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const session = { user: { id: "actor" }, access_token: "actor-token" };
  let sessionPresent = true;
  const query = (source: string, args?: Record<string, unknown>) => {
    const call: Call = { source, args, filters: {}, orders: [] };
    const chain = {
      select(fields: string) { call.fields = fields; return chain; },
      eq(key: string, value: unknown) { call.filters[key] = value; return chain; },
      order(key: string) { call.orders.push(key); return chain; },
      range(from: number, to: number) { call.range = [from, to]; return chain; },
      setHeader(key: string, value: string) { assert.equal(key, "Authorization"); call.header = value; return chain; },
      abortSignal(signal: AbortSignal) { assert.ok(signal instanceof AbortSignal); return chain; },
      maybeSingle() { call.single = true; return chain; },
      then(resolve: (response: Response) => unknown, reject: (error: unknown) => unknown) {
        calls.push(call);
        return Promise.resolve().then(() => respond(call)).then(resolve, reject);
      }
    };
    return chain;
  };
  const client = {
    auth: { getSession: async () => ({ data: { session: sessionPresent ? structuredClone(session) : null }, error: null }) },
    from: (table: string) => query(table),
    rpc: (rpc: string, args?: Record<string, unknown>) => query(rpc, args)
  } as unknown as SupabaseClient;
  return { client, calls, session, logout: () => { sessionPresent = false; } };
}

function isError(kind: ClubReadError["kind"]) {
  return (error: unknown) => error instanceof ClubReadError && error.kind === kind;
}

test("catalog uses only the limited RPC and discards extra fields across pages", async () => {
  const db = backend(call => ({ data: call.range?.[0] === 0
    ? Array.from({ length: 200 }, (_, i) => ({ id: String(i), name: `Club ${i}`, description: "must not escape", owner_id: "secret" }))
    : [{ id: "last", name: "Last club", members: [member] }], error: null }));
  const catalog = await createClubReadApi(db.client, "actor").catalog();
  assert.equal(catalog.length, 201);
  assert.deepEqual(catalog[0], { id: "0", name: "Club 0" });
  assert.deepEqual(catalog[200], { id: "last", name: "Last club" });
  assert.deepEqual(db.calls.map(call => call.source), ["club_list_catalog", "club_list_catalog"]);
  assert.deepEqual(db.calls.map(call => call.range), [[0, 199], [200, 399]]);
  assert.ok(db.calls.every(call => call.header === "Bearer actor-token"));
  assert.deepEqual(db.calls[0].orders, ["name", "id"]);
});

test("member-only details read authorized member pages and derive the current role", async () => {
  const db = backend(call => {
    if (call.source === "clubs") return { data: row, error: null };
    assert.equal(call.source, "club_list_members");
    assert.deepEqual(call.args, { p_club_id: clubId });
    return { data: call.range?.[0] === 0
      ? [member, ...Array.from({ length: 199 }, (_, i) => ({ ...member, user_id: `rider-${i}`, role: "member" }))]
      : [{ ...member, user_id: "last", role: "admin" }], error: null };
  });
  const club = await createClubReadApi(db.client, "actor").detail(clubId);
  assert.equal(club.memberCount, 201);
  assert.equal(club.role, "owner");
  assert.equal(club.members[200].role, "admin");
  assert.deepEqual(db.calls[0].filters, { id: clubId });
  assert.equal(db.calls[0].fields, "id,name,description,owner_id");
  assert.ok(db.calls.every(call => call.header === "Bearer actor-token"));
});

test("non-members and deleted clubs never yield details or fall back to the catalog", async () => {
  const db = backend(() => ({ data: null, error: null }));
  await assert.rejects(createClubReadApi(db.client, "actor").detail(clubId), isError("access"));
  assert.deepEqual(db.calls.map(call => call.source), ["clubs"]);
});

test("revocation between club and member reads discards the fetched club", async () => {
  for (const response of [{ data: [], error: null }, { data: null, error: { code: "42501" } }]) {
    const db = backend(call => call.source === "clubs" ? { data: row, error: null } : response);
    await assert.rejects(createClubReadApi(db.client, "actor").detail(clubId), isError("access"));
  }
});

test("role is taken from the member RPC rather than inferred from the club owner", async () => {
  const db = backend(call => ({ data: call.source === "clubs" ? row : [{ ...member, role: "member" }], error: null }));
  assert.equal((await createClubReadApi(db.client, "actor").detail(clubId)).role, "member");
});

test("a failing club prevents a partial My clubs list from escaping", async () => {
  const other = "22222222-2222-4222-8222-222222222222";
  const db = backend(call => call.source === "clubs"
    ? { data: [row, { ...row, id: other }], error: null }
    : { data: call.args?.p_club_id === other ? [] : [member], error: null });
  await assert.rejects(createClubReadApi(db.client, "actor").list(), isError("access"));
});

test("network and missing-function errors never masquerade as empty lists", async () => {
  for (const [error, kind] of [[{ code: "PGRST202" }, "unavailable"], [{ message: "Failed to fetch" }, "network"]] as const) {
    const db = backend(() => ({ data: null, error }));
    await assert.rejects(createClubReadApi(db.client, "actor").catalog(), isError(kind));
  }
  const invalid = backend(() => ({ data: null, error: null }));
  await assert.rejects(createClubReadApi(invalid.client, "actor").catalog(), isError("network"));
  const empty = backend(() => ({ data: [], error: null }));
  assert.deepEqual(await createClubReadApi(empty.client, "actor").catalog(), []);
  assert.deepEqual(await createClubReadApi(empty.client, "actor").list(), []);
});

test("account changes and logout block queries started for the previous actor", async () => {
  const db = backend(() => ({ data: [], error: null }));
  const api = createClubReadApi(db.client, "actor");
  db.session.user.id = "next-account";
  await assert.rejects(api.catalog(), isError("auth"));
  db.logout();
  await assert.rejects(api.list(), isError("auth"));
  assert.equal(db.calls.length, 0);
});

test("a pending paginated read never adopts the next account's token", async () => {
  const db = backend(call => {
    if (call.range?.[0] === 0) {
      db.session.user.id = "next-account";
      db.session.access_token = "next-account-token";
      return { data: Array.from({ length: 200 }, (_, i) => ({ id: String(i), name: "Club" })), error: null };
    }
    return { data: [], error: null };
  });
  await createClubReadApi(db.client, "actor").catalog();
  assert.deepEqual(db.calls.map(call => call.header), ["Bearer actor-token", "Bearer actor-token"]);
});

test("invalid club IDs fail without querying the database", async () => {
  const db = backend(() => ({ data: null, error: null }));
  for (const id of ["not-an-id", "../members", "", `${clubId}/members`]) {
    await assert.rejects(createClubReadApi(db.client, "actor").detail(id), isError("access"));
  }
  assert.equal(db.calls.length, 0);
});

test("club and member deep links preserve their exact login destination in all languages", () => {
  for (const locale of locales) for (const suffix of ["", `/${clubId}`, `/${clubId}/members`]) {
    const path = `/${locale}/app/clubs${suffix}`;
    assert.equal(isProtectedRoutePath(locale, path), true);
    assert.equal(getSafeReturnPath(locale, path), path);
    const login = new URL(buildLoginPath(locale, path), "https://test.invalid");
    assert.equal(login.pathname, `/${locale}/login`);
    assert.equal(login.searchParams.get("returnTo"), path);
  }
});

import { createClubPageGuard } from "../lib/clubs/page-guard";
import { getAppDictionary } from "../lib/app-i18n";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}

function guardFor(read: (signal: AbortSignal) => Promise<{ userId: string; snapshot: string }>) {
  let identityLosses = 0;
  const guard = createClubPageGuard({ userId: "actor", read, identityLost: () => { ++identityLosses; } });
  return { guard, losses: () => identityLosses };
}

test("protected state is empty until a fresh authorized read and never enters the server snapshot", async () => {
  const response = deferred<{ userId: string; snapshot: string }>();
  const { guard } = guardFor(() => response.promise);
  const work = guard.verify();
  assert.equal(guard.getSnapshot().data, null);
  response.resolve({ userId: "actor", snapshot: "protected content" }); await work;
  assert.equal(guard.getSnapshot().data, "protected content");
  assert.equal(guard.getServerSnapshot().data, null);
  guard.stop(); assert.equal(guard.getSnapshot().data, null);
});

test("logout purges active state and a pending response cannot resurrect it", async () => {
  const later = deferred<{ userId: string; snapshot: string }>();
  let call = 0;
  const { guard } = guardFor(() => ++call === 1 ? Promise.resolve({ userId: "actor", snapshot: "private" }) : later.promise);
  await guard.verify(); assert.equal(guard.getSnapshot().data, "private");
  const pending = guard.verify(); guard.revoke();
  assert.equal(guard.getSnapshot().data, null);
  later.resolve({ userId: "actor", snapshot: "stale" }); await pending;
  assert.equal(guard.getSnapshot().status, "auth"); assert.equal(guard.getSnapshot().data, null);
  await guard.verify(); assert.equal(call, 2);
});

test("confirmed membership loss leaves no data, and rejoining requires a fresh read", async () => {
  let allowed = true;
  const { guard } = guardFor(async () => {
    if (!allowed) throw new ClubReadError("access");
    return { userId: "actor", snapshot: "current" };
  });
  await guard.verify(); allowed = false;
  const denied = guard.verify(); assert.equal(guard.getSnapshot().data, null); await denied;
  assert.equal(guard.getSnapshot().status, "access"); assert.equal(guard.getSnapshot().data, null);
  allowed = true; await guard.verify(); assert.equal(guard.getSnapshot().data, "current"); guard.stop();
});

test("a failed interval check purges the previous success and never confirms continued access", async () => {
  let offline = false, revision = "old";
  const { guard } = guardFor(async () => {
    if (offline) throw new Error("offline");
    return { userId: "actor", snapshot: revision };
  });
  await guard.verify(); offline = true;
  const failed = guard.verify(); assert.equal(guard.getSnapshot().data, null); await failed;
  assert.equal(guard.getSnapshot().status, "error"); assert.equal(guard.getSnapshot().data, null);
  offline = false; revision = "fresh"; await guard.verify();
  assert.equal(guard.getSnapshot().data, "fresh"); guard.stop();
});

test("hiding a tab clears state, aborts the read and rejects late results", async () => {
  const reply = deferred<{ userId: string; snapshot: string }>();
  let signal: AbortSignal | undefined;
  const { guard } = guardFor(s => { signal = s; return reply.promise; });
  const work = guard.verify(); guard.pause();
  assert.equal(signal?.aborted, true); assert.equal(guard.getSnapshot().data, null);
  reply.resolve({ userId: "actor", snapshot: "stale" }); await work;
  assert.equal(guard.getSnapshot().data, null); guard.stop();
});

test("a response for the next account revokes instead of adopting its protected content", async () => {
  const { guard, losses } = guardFor(async () => ({ userId: "another-account", snapshot: "other user's data" }));
  await guard.verify(); assert.equal(losses(), 1);
  assert.equal(guard.getSnapshot().status, "auth"); assert.equal(guard.getSnapshot().data, null);
});

test("out-of-order checks cannot restore earlier data after a newer failure", async () => {
  const first = deferred<{ userId: string; snapshot: string }>();
  const second = deferred<{ userId: string; snapshot: string }>();
  let call = 0;
  const { guard } = guardFor(() => ++call === 1 ? first.promise : second.promise);
  const a = guard.verify(), b = guard.verify();
  second.reject(new Error("offline")); await b;
  first.resolve({ userId: "actor", snapshot: "stale" }); await a;
  assert.equal(guard.getSnapshot().status, "error"); assert.equal(guard.getSnapshot().data, null); guard.stop();
});

test("Strict Mode restart and BFCache return start empty and require a new request", async () => {
  let count = 0;
  const { guard } = guardFor(async () => ({ userId: "actor", snapshot: String(++count) }));
  await guard.verify(); guard.stop(); guard.start();
  assert.equal(guard.getSnapshot().data, null);
  await guard.verify(); assert.equal(guard.getSnapshot().data, "2"); guard.pause();
  assert.equal(guard.getSnapshot().data, null); await guard.verify();
  assert.equal(guard.getSnapshot().data, "3"); guard.stop();
});

test("all phase-one copy exists in all seven languages with the same interpolation", () => {
  const keys = ["nav.clubs", "clubs.intro", "clubs.mine", "clubs.catalog", "clubs.catalogHint", "clubs.noClubs", "clubs.noCatalog", "clubs.details", "clubs.members", "clubs.memberCount", "clubs.memberCountOne", "clubs.yourRole", "clubs.owner", "clubs.admin", "clubs.member", "clubs.description", "clubs.noDescription", "clubs.open", "clubs.membersOnly", "clubs.back", "clubs.loadError", "clubs.unavailable", "clubs.accessTitle", "clubs.accessBody", "clubs.loading"] as const;
  for (const locale of locales) for (const key of keys) {
    const value = getAppDictionary(locale)(key);
    assert.ok(value.length > 0 && value !== key, `${locale}: ${key}`);
    assert.equal((value.match(/\{count\}/g) ?? []).length, key === "clubs.memberCount" ? 1 : 0);
  }
});

test("member projection drops unexpected fields rather than serializing them to the browser", async () => {
  const db = backend(call => ({ data: call.source === "clubs" ? row : [{ ...member, email: "private@example.invalid", internal: "private" }], error: null }));
  assert.deepEqual((await createClubReadApi(db.client, "actor").detail(clubId)).members, [member]);
});


test("cross-tab auth invalidation accepts only transition markers without session data", () => {
  assert.equal(clubAuthPhase(JSON.stringify({ phase: "changing", nonce: "test" })), "changing");
  assert.equal(clubAuthPhase(JSON.stringify({ phase: "settled", nonce: "test" })), "settled");
  for (const value of [null, "bad JSON", "{}", "null", '{"phase":"ready"}']) assert.equal(clubAuthPhase(value), null);
});
