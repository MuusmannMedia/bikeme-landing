const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(new URL("../app/api/clubs/content/photos/route.ts", `file://${__filename}`), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const club = "83d55868-0bb2-4d54-854d-ffbb7682dabb";
const post = "ad316beb-364c-4046-9832-cfa039cb8bf2";
const requestId = "12d7695f-0dd5-4f59-96ad-faa4eb544c00";
const actor = "b3e2e356-d0a6-4e47-a26d-9ae07b322123";

function fixture({ author = actor, tokenUser = actor, correctOrigin = false } = {}) {
  class GalleryError extends Error {
    constructor(kind) { super(kind); this.kind = kind; }
  }
  const session = { auth: { getUser: async token => {
    assert.equal(token, "fixture-token");
    return { data: { user: tokenUser ? { id: tokenUser } : null } };
  } } };
  const operations = [];
  const requireRoute = name => ({
    "@supabase/supabase-js": { createClient: (_url, _key, options) => options.accessToken ? {
      token: options.accessToken,
    } : session },
    "next/server": { NextResponse: Response },
    "@/lib/clubs/gallery-contract": { GalleryError, galleryLimits: { batch: 5, browserInput: 400_000, request: 4_000_000 } },
    "@/lib/clubs/gallery-normalize": { normalizeGalleryPhoto: async () => ({
      width: 16, height: 9, image: Buffer.from("full"), thumbnail: Buffer.from("thumb"),
    }) },
    "@/lib/clubs/gallery-server": {
      galleryBody: async (request, limit) => { operations.push(["body", limit]); return request.blob(); },
      galleryUploadBytes: async (files, isWeb) => { operations.push(["mode", isWeb]); return Promise.all(files.map(async file => new Uint8Array(await file.arrayBuffer()))); },
      galleryUploadKey: () => Buffer.alloc(32, 8),
      galleryRpc: async (client, method, args) => {
        operations.push([method, await client.token?.(), args]);
        if (method === "club_content_item") return { author_id: author };
      },
    },
    "@/lib/clubs/request-origin": { isClubRequestOrigin: () => correctOrigin },
    "@/lib/clubs/types": { isClubId: value => /^[a-f0-9-]{36}$/i.test(value) },
    "@/lib/supabase/config": { getSupabaseEnvironment: () => ({ url: "https://fixture.invalid", publishableKey: "fixture" }) },
    "@/lib/supabase/proxy": { preventAuthCaching: r => r },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: actor } } }) } }) },
  })[name] ?? require(name);
  const exports = {};
  vm.runInThisContext(`(function(require,exports){${compiled}\n})`)(requireRoute,exports);
  return { post: exports.POST, operations };
}

function upload(authorization, inputActor = actor) {
  const form = new FormData();
  form.append("requestId", requestId);
  form.append("photo", new Blob(["fixture"], { type: "image/jpeg" }), "photo.jpg");
  const request = new Request(`https://fixture.invalid/api/clubs/content/photos?clubId=${club}&postId=${post}`, {
    method: "POST", headers: { "x-gallery-actor": inputActor, ...(authorization ? { authorization } : {}) }, body: form,
  });
  request.nextUrl = new URL(request.url);
  return request;
}

test("author uses the verified bearer for a signed post attachment saved with an idempotency key", async () => {
  const result = fixture();
  const response = await result.post(upload("Bearer fixture-token"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { userId: actor, ok: true });
  assert.equal(result.operations[0][1], "fixture-token");
  assert.deepEqual(result.operations[1], ["body", 4_000_000]);
  assert.deepEqual(result.operations[2], ["mode", false]);
  assert.equal(result.operations[3][0], "club_post_attachments_commit");
  assert.equal(result.operations[3][1], "fixture-token");
  assert.equal(result.operations[3][2].p_request, requestId);
  assert.match(result.operations[3][2].p_mac, /^[a-f0-9]{64}$/);
});

test("invalid bearer, actor mismatch and another person's post cannot read or save the upload body", async () => {
  for (const [options, token, inputActor, status] of [
    [{ correctOrigin: true }, "Invalid", actor, 401],
    [{ tokenUser: null }, "Bearer fixture-token", actor, 401],
    [{}, "Bearer fixture-token", "wrong-user", 401],
    [{ author: "different-author" }, "Bearer fixture-token", actor, 403],
  ]) {
    const result = fixture(options);
    assert.equal((await result.post(upload(token, inputActor))).status, status);
    assert.equal(result.operations.some(([kind]) => kind === "body" || kind === "club_post_attachments_commit"), false);
  }
});

test("browser upload still requires a valid origin and uses the existing browser limits", async () => {
  assert.equal((await fixture().post(upload())).status, 403);
  const result = fixture({ correctOrigin: true });
  assert.equal((await result.post(upload())).status, 200);
  assert.deepEqual(result.operations[1], ["body", 5 * 400_000 + 16_384]);
  assert.deepEqual(result.operations[2], ["mode", true]);
});
