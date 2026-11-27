import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createChatStore} from '../lib/clubs/chat-store';
import {ContentError} from '../lib/clubs/content-contract';
import {projectChat,mergeChat,validateChat,type ChatRead,type ChatMessage,type ChatCommand} from '../lib/clubs/chat-contract';
import {chatText,chatTextKeys} from '../lib/clubs/chat-i18n';
import {locales} from '../lib/locales';
const actor='00000000-0000-4000-8000-000000000001',club='00000000-0000-4000-8000-000000000002',id='00000000-0000-4000-8000-000000000003';
const message:ChatMessage={id,club_id:club,post_id:id,kind:'chat',author_id:actor,display_name:'Synthetic',body:'Hello',created_at:'2026-01-01T00:00:00Z',edited_at:null,version:1,is_pinned:false,comment_count:0,seq:1,change_seq:1,deleted_at:null,reply_to_id:null,reply:null,reply_unavailable:false};
const report: ChatCommand = {actorId:actor,clubId:club,type:'report',kind:'chat',id,destination:'club',reason:'spam',detail:''};
const snapshot=(items=[message],visibilityRevision=0):ChatRead=>({club:{id:club,name:'Synthetic',description:null,owner_id:actor,role:'owner',members:[],memberCount:1},visibilityRevision,signalRevision:1,items,cursor:1,hasMore:false,hits:[],nextBefore:null,context:[],selected:null});
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{promise,resolve};}
function setup(extra:Partial<Parameters<typeof createChatStore>[0]>={}){return createChatStore({actor,identityLost:()=>{},read:async q=>({userId:actor,snapshot:q.get('mode')==='message'?{...snapshot(),selected:message}:snapshot()}),send:async()=>({userId:actor,result:id}),...extra});}
test('transport status can update without a competing full authorization or payload removal',async()=>{let reads=0;const s=setup({read:async()=>{reads++;return{userId:actor,snapshot:snapshot()};}});await s.sync();s.position(false);const data=s.getSnapshot().data;s.connection(true,false);assert.equal(reads,1);assert.equal(s.getSnapshot().data,data);assert.equal(s.getSnapshot().nearBottom,false);s.pause();assert.equal(s.getSnapshot().data,null);await s.sync();assert.equal(reads,2);assert.equal(s.getSnapshot().nearBottom,false);s.stop();});
test('all seven chat dictionaries are complete',()=>{for(const locale of locales)for(const key of chatTextKeys)assert(chatText(locale,key));});
test('1500 codepoints, trim and control validation match chat contract',()=>{assert.equal(validateChat('  😀\t  '),'😀\t');assert.equal(Array.from(validateChat('😀'.repeat(1500))).length,1500);assert.throws(()=>validateChat('😀'.repeat(1501)));assert.throws(()=>validateChat('\n\t'));assert.throws(()=>validateChat('a\0b'));});
test('projection excludes thread evidence and hidden deleted identity/text/quote',()=>{const m=projectChat({...message,deleted_at:'now',reporter_id:actor,support:{body:'private'},thread:{private:'private'},reply:{id,seq:1,change_seq:1,deleted:true,body:'secret',display_name:'secret',author_id:actor}});assert.equal(m.body,'');assert.equal(m.author_id,null);assert.equal(m.reply,null);assert(!JSON.stringify(m).includes('private'));});
test('merge follows iOS sequence/change rules and tombstones',()=>{const newer={...message,version:2,change_seq:3,body:'New'};assert.equal(mergeChat([newer],[message])[0].body,'New');assert.equal(mergeChat([newer],[{...newer,change_seq:4,deleted_at:'now'}]).length,0);});
test('late moderation response cannot restore a revoked archive',async()=>{const d=deferred<{userId:string;result:unknown}>();const s=setup({send:()=>d.promise});await s.sync();const p=s.run(report);s.revoke('auth');s.signal(999);s.connection(true);await s.sync();d.resolve({userId:actor,result:message});await p;assert.equal(s.getSnapshot().status,'auth');assert.equal(s.getSnapshot().data,null);assert.equal(s.getSnapshot().pending,null);s.stop();});
test('pause rejects a late read and clears search, context, messages and quote payload together',async()=>{const d=deferred<{userId:string;snapshot:ChatRead}>();const s=setup({read:()=>d.promise});const p=s.sync();s.pause();d.resolve({userId:actor,snapshot:{...snapshot(),hits:[{id,excerpt:'Private',display_name:'S',created_at:''}],context:[message],selected:message}});await p;assert.equal(s.getSnapshot().data,null);s.stop();});
test('network verification failure hides protected archive data',async()=>{let fail=false;const s=setup({read:async()=>{if(fail)throw new ContentError('network');return{userId:actor,snapshot:snapshot()};}});await s.sync();fail=true;await s.sync();assert.equal(s.getSnapshot().status,'error');assert.equal(s.getSnapshot().data,null);fail=false;await s.sync(true);assert.equal(s.getSnapshot().status,'ready');s.stop();});
test('membership loss clears loaded archive data and authority',async()=>{let fail=false;const s=setup({read:async()=>{if(fail)throw new ContentError('access');return{userId:actor,snapshot:snapshot()};}});await s.sync();fail=true;await s.sync();assert.equal(s.getSnapshot().status,'access');assert.equal(s.getSnapshot().data,null);s.stop();});
test('visibility revision change purges cached content before fresh authorization',async()=>{const d=deferred<{userId:string;snapshot:ChatRead}>();let late=false;const s=setup({read:async()=>late?d.promise:{userId:actor,snapshot:snapshot()}});await s.sync();late=true;s.signal(2);assert.equal(s.getSnapshot().data,null);d.resolve({userId:actor,snapshot:snapshot([],2)});await new Promise(r=>setImmediate(r));assert.equal(s.getSnapshot().data?.items.length,0);s.stop();});
test('delta drain completes all pages before considering catch-up current',async()=>{let calls=0;const s=setup({read:async q=>{const after=q.get('after');calls++;return{userId:actor,snapshot:after==='1'?{...snapshot([{...message,id:'second',seq:2,change_seq:2}]),cursor:2,hasMore:true}:after==='2'?{...snapshot([{...message,id:'third',seq:3,change_seq:3}]),cursor:3}:snapshot()};}});await s.sync();await s.sync();assert.equal(calls,3);assert.equal(s.getSnapshot().data?.cursor,3);assert.equal(s.getSnapshot().data?.items.length,3);s.stop();});
test('new messages do not force scroll while reading history',async()=>{let next=false;const s=setup({read:async()=>({userId:actor,snapshot:next?{...snapshot([{...message,id:'new',seq:2,change_seq:2}]),cursor:2}:snapshot()})});await s.sync();const scroll=s.getSnapshot().scrollRevision;s.position(false);next=true;await s.sync();assert.equal(s.getSnapshot().scrollRevision,scroll);assert.equal(s.getSnapshot().newCount,1);s.bottom();assert.equal(s.getSnapshot().newCount,0);s.stop();});
test('deleted original refresh removes old quote text in already loaded replies',async()=>{const reply={...message,id:'reply',seq:2,change_seq:2,reply_to_id:id,reply:{id,seq:1,change_seq:1,body:'Hello',display_name:'S',author_id:actor,deleted:false}};let next=false;const s=setup({read:async()=>({userId:actor,snapshot:next?{...snapshot([{...message,body:'',deleted_at:'now',change_seq:3}]),cursor:3}:{...snapshot([reply,message]),cursor:2}})});await s.sync();next=true;await s.sync();assert.equal(s.getSnapshot().data?.items.length,1);assert.equal(s.getSnapshot().data?.items[0].reply?.body,null);s.stop();});

test('fresh authorization rebuilds previously loaded older window using numeric cursor only',async()=>{let rounds=0;const m=(seq:number)=>({...message,id:'m'+seq,seq,change_seq:seq});const s=setup({read:async q=>{rounds++;return{userId:actor,snapshot:q.has('before')?{...snapshot([m(1)]),cursor:3}:{...snapshot([m(3),m(2)]),cursor:3,hasMore:true}};}});await s.sync();await s.older();assert.equal(s.getSnapshot().data?.items.length,3);s.pause();assert.equal(s.getSnapshot().data,null);await s.sync();assert.equal(s.getSnapshot().data?.items.length,3);assert.equal(rounds,4);s.stop();});

test('visibility interruption preserves only the pending moderation action',async()=>{const d=deferred<{userId:string;result:unknown}>();const s=setup({send:()=>d.promise});await s.sync();const p=s.run(report);s.signal(2);assert.equal(s.getSnapshot().busy,false);assert.equal(s.getSnapshot().sendState,'unknown');assert(s.getSnapshot().pending);d.resolve({userId:actor,result:message});await p;assert(s.getSnapshot().pending);s.stop();});

test('a full access recheck does not count known history as new while reading above',async()=>{let next=false;const s=setup({read:async()=>({userId:actor,snapshot:next?{...snapshot([{...message,id:'new',seq:2,change_seq:2},message]),cursor:2}:snapshot()})});await s.sync();s.position(false);s.pause();await s.sync();assert.equal(s.getSnapshot().newCount,0);s.pause();next=true;await s.sync();assert.equal(s.getSnapshot().newCount,1);s.stop();});



 test('read-only access failure can retry without submitting a moderation action',async()=>{let failing=false,writes=0;const s=setup({read:async()=>{if(failing)throw new ContentError('network');return{userId:actor,snapshot:snapshot()};},send:async()=>{writes++;return{userId:actor,result:message};}});await s.sync();failing=true;await s.sync(true);assert.equal(s.getSnapshot().status,'error');assert.equal(s.getSnapshot().data,null);assert.equal(s.getSnapshot().sendState,'idle');assert.equal(s.getSnapshot().pending,null);failing=false;await s.retry();assert.equal(s.getSnapshot().status,'ready');assert.equal(s.getSnapshot().sendState,'idle');assert.equal(writes,0);s.stop();});
test('normal return retains the active snapshot while fetching only cursor changes',async()=>{let slow=false;const d=deferred<{userId:string;snapshot:ChatRead}>(),queries:string[]=[];const s=setup({read:async q=>{queries.push(q.toString());return slow?d.promise:{userId:actor,snapshot:snapshot()};}});await s.sync();s.position(false);const before=s.getSnapshot();slow=true;const job=s.revalidate();assert.equal(s.getSnapshot().status,'ready');assert.equal(s.getSnapshot().data,before.data);assert.equal(queries.at(-1),'after=1');d.resolve({userId:actor,snapshot:{...snapshot([]),cursor:1}});await job;assert.equal(s.getSnapshot().data?.items.length,1);assert.equal(s.getSnapshot().scrollRevision,before.scrollRevision);s.stop();});


test('the chat page uses its authorized RPC and refuses a snapshot if final membership was lost', async () => {
  const { createClubChatApi } = await import('../lib/clubs/chat-api');
  const checked = deferred<void>(), roster = deferred<{data: unknown;error: null}>();
  const calls:string[]=[];
  const builder=(name:string, result:()=>unknown)=>{
    const query={
      select:()=>query,eq:()=>query,setHeader:()=>query,range:()=>query,abortSignal:()=>query,maybeSingle:()=>query,
      then: (resolve:(value:unknown)=>unknown, reject:(cause:unknown)=>unknown)=>{
        calls.push(name);
        return Promise.resolve(result()).then(resolve,reject);
      },
    };
    return query;
  };
  const supabase={
    auth:{getSession:async()=>({data:{session:{user:{id:actor},access_token:'synthetic'}},error:null})},
    from:(name:string)=>builder(name,()=>name==='clubs'
      ?{data:{id:club,name:'Synthetic',owner_id:actor},error:null}
      :{data:{revision:1,visibility_revision:0},error:null}),
    rpc:(name:string)=>builder(name,()=>{
      if(name==='club_list_members'){checked.resolve();return roster.promise;}
      assert.equal(name,'club_chat_page');
      return {data:{role:'owner',items:[message],cursor:1,has_more:false},error:null};
    })
  } as never;
  const result=createClubChatApi(supabase,actor).read(club,new URLSearchParams());
  const denial=assert.rejects(result,{kind:'access'});
  await checked.promise;
  assert.deepEqual(calls,['club_chat_signals','club_chat_page','club_chat_signals','clubs','club_list_members']);
  roster.resolve({data:[],error:null});
  await denial;
});

test('archive rejects historical write commands before invoking a database mutation', async () => {
  const { createClubChatApi } = await import('../lib/clubs/chat-api');
  const never = () => assert.fail('unexpected database call');
  const api = createClubChatApi({from:never,rpc:never} as never, actor);
  const scope = { actorId: actor, clubId: club, id };
  for (const input of [
    {...scope,type:'send',body:'new message',replyTo:null},
    {...scope,type:'send',body:'new reply',replyTo:id},
    {...scope,type:'change',kind:'chat',action:'edit',version:1,body:'edited'},
    {...scope,type:'change',kind:'chat',action:'delete'},
    {...scope,type:'react',emoji:'👍'},
    {...report,kind:'post'}
  ]) await assert.rejects(api.execute(input), {kind:'invalid'});
});

test('blocking through the archive replaces the old visibility snapshot', async () => {
  let blocked = false;
  const queries: string[] = [];
  const store = setup({
    read: async q => {
      queries.push(q.toString());
      return { userId: actor, snapshot: blocked ? snapshot([], 2) : snapshot() };
    },
    send: async () => {
      blocked = true;
      return { userId: actor, result: 2 };
    }
  });
  await store.sync();
  assert.equal(await store.run({actorId:actor,clubId:club,type:'block',kind:'chat',id}), true);
  assert.deepEqual(queries, ['', '']);
  assert.equal(store.getSnapshot().status, 'ready');
  assert.equal(store.getSnapshot().data?.visibilityRevision, 2);
  assert.deepEqual(store.getSnapshot().data?.items, []);
  store.stop();
});
