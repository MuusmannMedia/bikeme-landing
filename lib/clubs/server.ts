import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { buildLoginPath } from "../auth";
import type { Locale } from "../locales";
import { createClient } from "../supabase/server";
import { createClubReadApi } from "./api";
import { clubReadError, type ClubReadErrorKind } from "./types";

export type ClubReadResult<T> = { ok: true; value: T } | { ok: false; kind: ClubReadErrorKind };

export const readClubSession = cache(async () => {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : { userId: data.user.id, api: createClubReadApi(client, data.user.id) };
});

export async function clubPageContext(locale: Locale, returnTo: string) {
  const session = await readClubSession();
  if (!session) redirect(buildLoginPath(locale, returnTo, "expired"));
  return session;
}

export async function readClubResult<T>(read: () => Promise<T>): Promise<ClubReadResult<T>> {
  let result: ClubReadResult<T>;
  try { result = { ok: true, value: await read() }; }
  catch (error) { result = { ok: false, kind: clubReadError(error).kind }; }
  return result;
}

export async function readClubSection<T>(read: () => Promise<T>, locale: Locale, returnTo: string): Promise<ClubReadResult<T>> {
  const result = await readClubResult(read);
  if (!result.ok && result.kind === "auth") redirect(buildLoginPath(locale, returnTo, "expired"));
  return result;
}
