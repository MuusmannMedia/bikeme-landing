'use strict';

const assert = require('node:assert/strict');
const { execFile, execFileSync } = require('node:child_process');
const { promisify } = require('node:util');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

const run = promisify(execFile);
const socket = process.argv[2];
assert(socket && path.isAbsolute(socket) && socket.startsWith('/private/tmp/'), 'Use a disposable local PostgreSQL socket');
const args = ['-XqAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-h', socket, '-p', '3114', '-U', 'gallery_fixture', '-d', 'gallery'];
const sql = statement => execFileSync('psql', [...args, '-c', statement], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const quoted = value => "'" + value.replaceAll("'", "''") + "'";
const [member, admin, owner, outsider] = Array.from({length:4}, () => randomUUID());
const club = randomUUID();
const otherClub = randomUUID();
const full = '/9j/AA==';
const binary = { caption: 'Local gallery test', width: 1600, height: 900, image: full, thumbnail: full };
const claims = actor => quoted(JSON.stringify({ sub: actor }));
const as = (actor, statement) => sql(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims=${claims(actor)}; ${statement}; COMMIT`);
const asService = statement => sql(`BEGIN; SET LOCAL ROLE service_role; ${statement}; COMMIT`);
const expectState = (fn, code) => assert.throws(fn, error => String(error.stderr).includes(code));
const reserve = (actor, target, request, count, digest = 'a'.repeat(64)) =>
  `SELECT public.club_gallery_reserve('${actor}','${target}','${request}','${digest}',${count})`;
const commit = (actor, target, request, lease, photos) =>
  asService(`SELECT public.club_gallery_commit('${actor}','${target}','${request}','${lease}',${quoted(JSON.stringify(photos))})`);
const photoFor = (target, caption = binary.caption) => sql(`SELECT id FROM club_private.gallery_photos WHERE club_id='${target}' AND caption=${quoted(caption)} ORDER BY created_at,id LIMIT 1`);

(async () => {
  assert.equal(sql("SELECT current_database() || ':' || current_user"), 'gallery:gallery_fixture');
  sql(`INSERT INTO auth.users(id) VALUES ('${member}'),('${admin}'),('${owner}'),('${outsider}');
    INSERT INTO public.clubs(id,owner_id,name,open) VALUES
    ('${club}','${owner}','Disposable gallery club',true),('${otherClub}','${owner}','Disposable quota club',true);
    INSERT INTO public.club_members(club_id,user_id,role) VALUES
    ('${club}','${owner}','admin'),('${club}','${member}','member'),('${club}','${admin}','admin'),('${otherClub}','${member}','member')`);
  const one = randomUUID();
  const lease = JSON.parse(asService(reserve(member, club, one, 2))).attempt;
  expectState(() => asService(reserve(member, club, one, 2)), 'GALLERY_BUSY');
  expectState(() => asService(reserve(member, club, one, 2, 'b'.repeat(64))), 'GALLERY_CONFLICT');
  expectState(() => as(member, reserve(member, club, one, 2)), '42501');
  expectState(() => commit(member, club, one, lease, [binary, { ...binary, thumbnail: 'eA==' }]), '22023');
  assert.equal(sql(`SELECT count(*) FROM club_private.gallery_photos WHERE club_id='${club}'`), '0');
  commit(member, club, one, lease, [binary, binary]);
  commit(member, club, one, lease, [binary, binary]);
  assert.equal(JSON.parse(asService(reserve(member, club, one, 2))).status, 'committed');
  assert.equal(sql(`SELECT count(*) FROM club_private.gallery_photos WHERE club_id='${club}'`), '2');
  console.log('atomic upload, restricted commit, in-flight replay, committed replay and mismatched payload passed');

  for (const count of [5, 5, 5]) {
    const request = randomUUID();
    const attempt = JSON.parse(asService(reserve(member, club, request, count))).attempt;
    commit(member, club, request, attempt, Array(count).fill(binary));
  }
  const race = await Promise.allSettled([club, otherClub].map(target =>
    run('psql', [...args, '-c', 'SET ROLE service_role; ' + reserve(member, target, randomUUID(), 3)])));
  assert.equal(race.filter(result => result.status === 'fulfilled').length, 1);
  assert(race.some(result => result.status === 'rejected' && result.reason.stderr.includes('GALLERY_QUOTA')));
  expectState(() => asService(reserve(member, club, randomUUID(), 1)), 'GALLERY_QUOTA');
  console.log('rolling quota serialized across simultaneous uploads to two clubs');

  const abandoned = randomUUID();
  const pending = JSON.parse(asService(reserve(owner, club, abandoned, 1))).attempt;
  asService(`SELECT public.club_gallery_release('${owner}','${abandoned}','${pending}')`);
  const retried = JSON.parse(asService(reserve(owner, club, abandoned, 1))).attempt;
  assert.notEqual(pending, retried);
  expectState(() => commit(owner, club, abandoned, pending, [binary]), 'GALLERY_CONFLICT');
  sql(`UPDATE club_private.gallery_uploads SET expires_at=now()-interval '1 second' WHERE request_id='${abandoned}'`);
  expectState(() => commit(owner, club, abandoned, retried, [binary]), 'GALLERY_CONFLICT');
  console.log('released and expired uploads cannot publish with a stale reservation');

  sql(`INSERT INTO club_private.gallery_uploads(actor_id,request_id,club_id,digest,photo_count,attempt,expires_at)
    SELECT '${owner}',gen_random_uuid(),'${otherClub}',repeat('a',64),5,gen_random_uuid(),now()+interval '10 minutes' FROM generate_series(1,90)`);
  expectState(() => asService(reserve(admin, otherClub, randomUUID(), 5)), '42501');
  sql(`INSERT INTO public.club_members(club_id,user_id,role) VALUES ('${otherClub}','${admin}','admin')`);
  expectState(() => asService(reserve(admin, otherClub, randomUUID(), 5)), 'GALLERY_CAPACITY');
  sql(`DELETE FROM club_private.gallery_uploads WHERE club_id='${otherClub}' AND actor_id='${owner}'`);
  console.log('club-wide cap includes reservations across actors');

  const photo = photoFor(club);
  assert.equal(as(admin, `SELECT public.club_gallery_image('${club}','${photo}',true)`), full);
  expectState(() => as(outsider, `SELECT public.club_gallery_page('${club}')`), '42501');
  expectState(() => as(outsider, `SELECT public.club_gallery_image('${club}','${photo}',false)`), '42501');
  expectState(() => as(owner, `SELECT public.club_gallery_image('${otherClub}','${photo}',false)`), '42501');
  const ownRequest = randomUUID();
  const ownLease = JSON.parse(asService(reserve(owner, club, ownRequest, 1))).attempt;
  commit(owner, club, ownRequest, ownLease, [{ ...binary, caption: "Owner photo" }]);
  const ownedByOwner = photoFor(club, "Owner photo");
  expectState(() => as(member, `SELECT public.club_gallery_remove('${club}','${ownedByOwner}')`), '42501');
  assert.equal(as(owner, `SELECT public.club_gallery_image('${club}','${ownedByOwner}',true)`), full);
  as(admin, `SELECT public.club_gallery_remove('${club}','${ownedByOwner}')`);
  assert.equal(sql(`SELECT count(*) FROM club_private.gallery_photos WHERE id='${ownedByOwner}'`), '0');

  const discussion = actor => JSON.parse(as(actor, `SELECT public.club_gallery_discussion('${club}','${photo}')`));
  const comment = randomUUID();
  const postComment = (actor,id,body) => as(actor, `SELECT public.club_gallery_add_comment('${club}','${photo}','${id}',${quoted(body)})`);
  as(admin, `SELECT public.club_gallery_set_like('${club}','${photo}',true)`);
  as(admin, `SELECT public.club_gallery_set_like('${club}','${photo}',true)`);
  assert.equal(discussion(admin).liked, true);
  assert.equal(discussion(member).liked, false);
  assert.equal(discussion(member).likeCount, 1);
  as(admin, `SELECT public.club_gallery_set_like('${club}','${photo}',false)`);
  as(admin, `SELECT public.club_gallery_set_like('${club}','${photo}',false)`);
  assert.equal(discussion(admin).likeCount, 0);
  as(admin, `SELECT public.club_gallery_set_like('${club}','${photo}',true)`);
  postComment(admin, comment, 'God tur!');
  postComment(admin, comment, 'God tur!');
  assert.equal(discussion(member).comments.length, 1);
  assert.equal(discussion(member).comments[0].body, 'God tur!');
  expectState(() => postComment(admin, comment, 'Changed'), 'GALLERY_CONFLICT');
  expectState(() => postComment(admin, randomUUID(), 'a'.repeat(1501)), '22023');
  expectState(() => postComment(admin, randomUUID(), 'jeg vil dræbe dig'), 'BIKEME_CONTENT_REJECTED');
  expectState(() => postComment(outsider, randomUUID(), 'No member'), '42501');
  expectState(() => discussion(outsider), '42501');
  expectState(() => as(member, `SELECT public.club_gallery_remove_comment('${club}','${photo}','${comment}')`), '42501');
  const removedComment = randomUUID();
  postComment(member, removedComment, 'Own comment');
  as(member, `SELECT public.club_gallery_remove_comment('${club}','${photo}','${removedComment}')`);
  postComment(member, removedComment, 'Own comment');
  assert.equal(discussion(member).comments.length, 1);
  sql(`INSERT INTO dm_private.blocks VALUES ('${owner}','${admin}')`);
  assert.equal(discussion(owner).likeCount, 0);
  assert.equal(discussion(owner).comments.length, 0);
  sql(`DELETE FROM dm_private.blocks WHERE blocker='${owner}' AND blocked='${admin}'`);
  console.log('photo owner/moderator permissions, likes, comment retries, content filtering and block visibility passed');

  sql(`INSERT INTO dm_private.blocks VALUES ('${admin}','${member}')`);
  expectState(() => as(admin, `SELECT public.club_gallery_image('${club}','${photo}',true)`), 'GALLERY_UNAVAILABLE');
  expectState(() => discussion(admin), 'GALLERY_UNAVAILABLE');
  expectState(() => as(admin, `SELECT public.club_gallery_set_like('${club}','${photo}',false)`), 'GALLERY_UNAVAILABLE');
  assert.equal(JSON.parse(as(admin, `SELECT public.club_gallery_page('${club}')`)).items.length, 0);
  expectState(() => as(admin, `SELECT public.club_gallery_report('${club}','${photo}','club','other','')`), 'GALLERY_UNAVAILABLE');
  sql(`DELETE FROM dm_private.blocks WHERE blocker='${admin}' AND blocked='${member}'`);
  sql(`DELETE FROM public.club_members WHERE club_id='${club}' AND user_id='${admin}'`);
  expectState(() => as(admin, `SELECT public.club_gallery_image('${club}','${photo}',false)`), '42501');
  expectState(() => discussion(admin), '42501');
  sql(`INSERT INTO public.club_members(club_id,user_id,role) VALUES ('${club}','${admin}','admin')`);
  console.log('open-club nonmember, cross-club links, blocking and revocation passed');

  expectState(() => as(member, `SELECT public.club_gallery_report('${club}','${photo}','club','other','')`), '42501');
  as(admin, `SELECT public.club_gallery_report('${club}','${photo}','club','unsafe','admin queue')`);
  as(admin, `SELECT public.club_gallery_report('${club}','${photo}','bikeMe','harassment','confidential')`);
  as(admin, `SELECT public.club_gallery_report('${club}','${photo}','bikeMe','harassment','retry')`);
  const reportComment = (actor, target, destination, detail = 'case') => as(actor,
    `SELECT public.club_gallery_report_comment('${club}','${photo}','${target}','${destination}','other',${quoted(detail)})`);
  expectState(() => reportComment(admin,comment,'club'), '42501');
  expectState(() => reportComment(outsider,comment,'bikeMe'), '42501');
  expectState(() => as(owner,`SELECT public.club_gallery_report_comment('${club}','${randomUUID()}','${comment}','club','other','')`), 'GALLERY_UNAVAILABLE');
  sql(`INSERT INTO dm_private.blocks VALUES ('${owner}','${admin}')`);
  expectState(() => reportComment(owner,comment,'club'), 'GALLERY_UNAVAILABLE');
  sql(`DELETE FROM dm_private.blocks WHERE blocker='${owner}' AND blocked='${admin}'`);
  reportComment(member,comment,'club','club comment case');
  reportComment(member,comment,'bikeMe','private comment case');
  reportComment(member,comment,'bikeMe','retry');
  const commentClub = sql(`SELECT id FROM club_private.content_reports WHERE target_kind='photo_comment' AND target_id='${comment}'`);
  const commentSupport = sql(`SELECT id FROM club_private.bike_me_reports WHERE target_kind='photo_comment' AND target_id='${comment}'`);
  assert.equal(sql(`SELECT target_id FROM club_private.content_reports WHERE id='${commentClub}'`),comment);
  assert.equal(sql(`SELECT evidence_context->0->>'photo_id' FROM club_private.bike_me_reports WHERE id='${commentSupport}'`),photo);
  assert.equal(sql(`SELECT evidence_captured FROM club_private.content_reports WHERE id='${commentClub}'`),'t');
  expectState(() => as(owner,`SELECT public.club_support_gallery_evidence('${commentSupport}')`),'42501');
  expectState(() => as(owner,`SELECT public.club_gallery_evidence('${club}','${commentSupport}')`),'GALLERY_UNAVAILABLE');
  expectState(() => as(member,`SELECT public.club_gallery_evidence('${club}','${commentClub}')`),'42501');
  as(owner,`SELECT public.club_content_resolve('${club}','${commentClub}','remove')`);
  assert.equal(discussion(member).comments.length,0);
  assert.equal(as(owner,`SELECT public.club_gallery_image('${club}','${photo}',true)`),full);
  const supportOnlyComment = randomUUID();
  postComment(admin,supportOnlyComment,'Support removes the comment only');
  reportComment(owner,supportOnlyComment,'bikeMe','support removal');
  const supportOnlyCase = sql(`SELECT id FROM club_private.bike_me_reports WHERE target_kind='photo_comment' AND target_id='${supportOnlyComment}'`);
  asService(`SELECT public.club_support_resolve('${supportOnlyCase}','remove','Fixture support','Reviewed')`);
  assert.equal(discussion(member).comments.length,0);
  assert.equal(sql(`SELECT count(*) FROM club_private.content_actions WHERE target_id='${supportOnlyComment}'`),'0');
  assert.equal(as(owner,`SELECT public.club_gallery_image('${club}','${photo}',true)`),full);
  console.log('comment report targets, existing evidence trigger, confidential queues and both comment resolvers passed');

  const support = sql(`SELECT id FROM club_private.bike_me_reports WHERE club_id='${club}' AND target_kind='photo'`);
  const list = JSON.parse(as(owner, `SELECT public.club_gallery_moderation_page('${club}')`)).items;
  assert.equal(list.length, 1);
  assert.equal(JSON.parse(as(owner, `SELECT public.club_content_reports_page('${club}')`)).items.length, 0);
  assert.equal(list[0].target_kind, 'photo');
  assert(!JSON.stringify(list).includes('confidential'));
  assert(!JSON.stringify(list).includes('reporter_id'));
  const internal = list[0].id;
  expectState(() => as(owner, `SELECT public.club_support_gallery_evidence('${support}')`), '42501');
  expectState(() => as(owner, `SELECT public.club_support_reports()`), '42501');
  expectState(() => as(owner, `SELECT public.club_gallery_evidence('${club}','${support}')`), 'GALLERY_UNAVAILABLE');
  expectState(() => as(member, `SELECT public.club_gallery_evidence('${club}','${internal}')`), '42501');
  as(member, `SELECT public.club_gallery_remove('${club}','${photo}')`);
  assert.equal(sql(`SELECT count(*) FROM club_private.gallery_likes WHERE photo_id='${photo}'`), '0');
  assert.equal(sql(`SELECT count(*) FROM club_private.gallery_comments WHERE photo_id='${photo}'`), '0');
  expectState(() => as(owner, `SELECT public.club_gallery_image('${club}','${photo}',false)`), 'GALLERY_UNAVAILABLE');
  assert.equal(as(owner, `SELECT public.club_gallery_evidence('${club}','${internal}')`), full);
  assert.equal(asService(`SELECT public.club_support_gallery_evidence('${support}')`), full);
  const closed = JSON.parse(as(owner, `SELECT public.club_gallery_moderation_page('${club}',true)`)).items;
  const retained = closed.find(row => row.id === commentClub);
  assert.equal(retained.snapshot.body,'God tur!');
  assert.equal(retained.has_image_evidence,true);
  assert.equal(as(owner,`SELECT public.club_gallery_evidence('${club}','${commentClub}')`),full);
  assert.equal(asService(`SELECT public.club_support_gallery_evidence('${commentSupport}')`),full);
  assert.equal(sql(`SELECT body FROM club_private.bike_me_reports WHERE id='${commentSupport}'`),'God tur!');
  reportComment(member,comment,'bikeMe','retry after photo removed');
  as(admin, `SELECT public.club_content_resolve('${club}','${internal}','remove')`);
  assert.equal(sql(`SELECT status FROM club_private.content_reports WHERE id='${internal}'`), 'removed');
  console.log('separate queues, confidential evidence, deduplication, uploader removal and retained evidence passed');

  const second = photoFor(club);
  as(owner, `SELECT public.club_gallery_report('${club}','${second}','bikeMe','spam','remove it')`);
  const secondReport = sql(`SELECT id FROM club_private.bike_me_reports WHERE target_id='${second}'`);
  asService(`SELECT public.club_support_resolve('${secondReport}','remove','Fixture support','Reviewed')`);
  expectState(() => as(admin, `SELECT public.club_gallery_image('${club}','${second}',false)`), 'GALLERY_UNAVAILABLE');
  assert.equal(sql(`SELECT count(*) FROM club_private.content_reports WHERE target_id='${second}'`), '0');

  const third = photoFor(club);
  as(admin, `SELECT public.club_gallery_report('${club}','${third}','club','other','moderation test')`);
  const thirdReport = sql(`SELECT id FROM club_private.content_reports WHERE target_id='${third}'`);
  as(admin, `SELECT public.club_content_resolve('${club}','${thirdReport}','remove')`);
  expectState(() => as(owner, `SELECT public.club_gallery_image('${club}','${third}',false)`), 'GALLERY_UNAVAILABLE');
  const fourth = photoFor(club);
  as(admin, `SELECT public.club_gallery_remove('${club}','${fourth}')`);
  assert.equal(sql(`SELECT count(*) FROM club_private.gallery_images WHERE id='${fourth}'`), '0');

  sql(`DELETE FROM public.clubs WHERE id='${club}'`);
  assert.equal(sql(`SELECT count(*) FROM club_private.gallery_photos WHERE club_id='${club}'`), '0');
  assert.equal(sql(`SELECT count(*) FROM club_private.gallery_images WHERE club_id='${club}'`), '2');
  assert.equal(asService(`SELECT public.club_support_gallery_evidence('${support}')`), full);
  sql(`DELETE FROM auth.users WHERE id='${member}'`);
  assert.equal(sql(`SELECT count(*) FROM club_private.gallery_images WHERE club_id='${club}'`), '0');
  assert.equal(asService(`SELECT public.club_support_gallery_evidence('${support}')`), '');
  assert.equal(sql(`SELECT author_id IS NULL AND body='' FROM club_private.bike_me_reports WHERE id='${support}'`), 't');
  sql(`DELETE FROM public.clubs WHERE id='${otherClub}'`);
  sql(`DELETE FROM auth.users WHERE id IN ('${admin}','${owner}','${outsider}')`);
  console.log('both moderation resolvers, unreported byte collection, club deletion and account scrubbing passed');
})().catch(error=>{console.error(error.stderr??error);process.exitCode=1;});
