'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const sharp = require('sharp');

const dir = process.argv[2];
assert(dir && path.isAbsolute(dir) && dir.startsWith('/private/tmp/'), 'Use the isolated local gallery fixture');
const credentials = require(path.join(dir, 'credentials.json'));
const secret = Buffer.from(fs.readFileSync(path.join(dir, 'upload-attestation-key'), 'utf8'), 'hex');
assert.equal(secret.length, 32);

const api = 'http://127.0.0.1:3112';
const a = credentials.users[0].id;
const b = credentials.users[1].id;
const club = crypto.randomUUID();
const request = crypto.randomUUID();
const fingerprint = 'ab'.repeat(32);
const sql = text => execFileSync('psql', ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-h', path.join(dir, 'sockets'),
  '-p', '3114', '-U', 'gallery_fixture', '-d', 'gallery', '-c', text], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

async function login(user) {
  const response = await fetch(api + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: credentials.anon },
    body: JSON.stringify({ email: user.email, password: credentials.password }),
  });
  assert(response.ok);
  const session = await response.json();
  assert.equal(session.user.id, user.id);
  return session.access_token;
}

async function rpc(token, name, body) {
  const response = await fetch(api + '/rest/v1/rpc/' + name, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: credentials.anon, Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

function sign(actor, args) {
  return crypto.createHmac('sha256', secret).update([
    'bikeme:club-gallery:commit:v1', actor, args.p_club, args.p_request, args.p_attempt, args.p_payload,
  ].join('\n'), 'utf8').digest('hex');
}

function expect(response, status, code) {
  assert.equal(response.status, status, response.data?.message ?? '');
  if (code) assert.equal(response.data?.code, code);
}

(async () => {
  assert.equal(sql("SELECT current_database() || ':' || current_user"), 'gallery:gallery_fixture');
  const [owner, member] = await Promise.all(credentials.users.slice(0, 2).map(login));
  sql(`INSERT INTO public.clubs(id,owner_id,name,open) VALUES ('${club}','${a}','Disposable upload attestation club',true);
    INSERT INTO public.club_members(club_id,user_id,role) VALUES ('${club}','${a}','admin'),('${club}','${b}','member')`);
  try {
    const reserve = (token, id, count) => rpc(token, 'club_gallery_upload_reserve', {
      p_club: club, p_request: id, p_digest: fingerprint, p_count: count,
    });
    const attempt = await reserve(owner, request, 1);
    expect(attempt, 200);
    assert.equal(attempt.data.status, 'reserved');
    expect(await reserve(owner, request, 1), 409, 'PT409');
    expect(await reserve(owner, crypto.randomUUID(), 6), 400, '22023');

    const image = (await sharp({ create: { width: 32, height: 20, channels: 3, background: '#324061' } })
      .jpeg().toBuffer()).toString('base64');
    const photo = { caption: 'Ærlig test 🚴', width: 32, height: 20, image, thumbnail: image };
    const args = { p_club: club, p_request: request, p_attempt: attempt.data.attempt, p_payload: JSON.stringify([photo]) };
    const mac = sign(a, args);
    const publish = (token, body) => rpc(token, 'club_gallery_upload_commit', body);
    expect(await publish(owner, { ...args, p_mac: '00'.repeat(32) }), 403, '42501');
    expect(await publish(owner, { ...args, p_payload: args.p_payload + ' ', p_mac: mac }), 403, '42501');
    expect(await publish(member, { ...args, p_mac: mac }), 409, 'PT409');
    expect(await publish(credentials.anon, { ...args, p_mac: mac }), 401, '42501');
    expect(await publish(secret.toString('hex'), { ...args, p_mac: mac }), 401);
    expect(await rpc(owner, 'club_gallery_commit', { p_actor: a, p_club: club, p_request: request,
      p_attempt: args.p_attempt, p_photos: [photo] }), 403, '42501');
    expect(await rpc(owner, 'club_support_gallery_evidence', { p_report: request }), 403, '42501');
    const privateView = await fetch(api + '/rest/v1/decrypted_secrets', {
      headers: { apikey: credentials.anon, Authorization: 'Bearer ' + owner, 'Accept-Profile': 'vault' },
    });
    assert(!privateView.ok);
    assert.equal(sql("SELECT has_table_privilege('authenticated','vault.decrypted_secrets','SELECT')"), 'f');
    console.log('Raw commits, forged or modified proofs, cross-account replay, anonymous writes, signing-key bearer auth, support and Vault access rejected');

    sql("UPDATE vault.local_fixture_secrets SET name='pending_test_signer' WHERE name='club_gallery_upload_commit_hmac'");
    try {
      expect(await publish(owner, { ...args, p_mac: mac }), 503, 'PT503');
    } finally {
      sql("UPDATE vault.local_fixture_secrets SET name='club_gallery_upload_commit_hmac' WHERE name='pending_test_signer'");
    }
    expect(await publish(owner, { ...args, p_mac: mac }), 204);
    expect(await publish(owner, { ...args, p_mac: mac }), 204);
    assert.equal((await reserve(owner, request, 1)).data.status, 'committed');
    assert.equal(sql(`SELECT count(*) FROM club_private.gallery_photos WHERE club_id='${club}'`), '1');
    console.log('Missing key fails closed; signed upload and replay accepted through the authenticated Data API');

    const memberRequest = crypto.randomUUID();
    const memberAttempt = await reserve(member, memberRequest, 2);
    expect(memberAttempt, 200);
    const memberArgs = { p_club: club, p_request: memberRequest, p_attempt: memberAttempt.data.attempt,
      p_payload: JSON.stringify([photo, { ...photo, image: 'AA==' }]) };
    expect(await publish(member, { ...memberArgs, p_mac: sign(b, memberArgs) }), 400, '22023');
    assert.equal(sql(`SELECT count(*) FROM club_private.gallery_photos WHERE club_id='${club}'`), '1');
    const lease = { p_request: memberRequest, p_attempt: memberArgs.p_attempt };
    expect(await rpc(owner, 'club_gallery_upload_release', lease), 204);
    expect(await reserve(member, memberRequest, 2), 409, 'PT409');
    expect(await rpc(member, 'club_gallery_upload_release', lease), 204);
    expect(await publish(member, { ...memberArgs, p_mac: sign(b, memberArgs) }), 409, 'PT409');
    const retry = await reserve(member, memberRequest, 2);
    expect(retry, 200);
    assert.notEqual(retry.data.attempt, memberArgs.p_attempt);
    const revokedArgs = { ...memberArgs, p_attempt: retry.data.attempt, p_payload: JSON.stringify([photo, photo]) };
    sql(`DELETE FROM public.club_members WHERE club_id='${club}' AND user_id='${b}'`);
    expect(await publish(member, { ...revokedArgs, p_mac: sign(b, revokedArgs) }), 403, '42501');
    expect(await reserve(member, crypto.randomUUID(), 1), 403, '42501');
    expect(await rpc(member, 'club_gallery_upload_release', { ...lease, p_attempt: retry.data.attempt }), 204);
    assert.equal(sql(`SELECT count(*) FROM club_private.gallery_images WHERE club_id='${club}'`), '1');
    console.log('Partial write rolled back; another user could not release the hold; release, stale proof, retry and revocation passed');
  } finally {
    sql(`DELETE FROM public.clubs WHERE id='${club}'`);
  }
})().catch(error => {
  console.error(error instanceof assert.AssertionError ? error.message : 'Local upload attestation integration failed');
  process.exitCode = 1;
});
