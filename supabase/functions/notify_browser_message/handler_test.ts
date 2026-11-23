import {createHmac} from 'node:crypto';
import {handleBrowserPush,type BrowserWorkerDependencies} from './shared/edge-handler.ts';
const id='00000000-0000-0000-0000-000000000001';
function assert(value:unknown){if(!value)throw Error('Assertion failed');}
function fixture(consumed=true){const secret='x'.repeat(64),issued=Math.floor(Date.now()/1000),env:Record<string,string>={BIKE_ME_WEB_PUSH_ENABLED:'true',SUPABASE_URL:'https://zawilafvdwlnwsdeufts.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-only',WEB_PUSH_VAPID_PUBLIC_KEY:'pub',WEB_PUSH_VAPID_PRIVATE_KEY:'fixture-only',WEB_PUSH_VAPID_SUBJECT:'https://www.bikeme.one',WEB_PUSH_WORKER_SECRET:secret};const calls:string[]=[],states:string[]=[];const d:BrowserWorkerDependencies={env:n=>env[n],createRpc:()=>async(name,args)=>{calls.push(name);if(name==='web_push_consume')return consumed;if(name==='web_push_claim')return[{id,claim:id}];if(name==='web_push_payload')return{subscription:id,recipient:id,endpoint:'https://web.push.apple.com/fixture',keys:{p256dh:'',auth:''},language:'da',conversation:id,message:id,body:'Fixture only'};if(name==='web_push_finish')states.push(String(args?.p_state));return null;},createSend:()=>async()=>{calls.push('provider');}};const headers={'x-web-push-time':String(issued),'x-web-push-nonce':id,'x-web-push-signature':createHmac('sha256',secret).update(issued+'.'+id).digest('hex')};return{d,env,calls,states,request:()=>new Request('https://example.test',{method:'POST',headers})};}
Deno.test('HMAC is mandatory before any privileged client operation',async()=>{const f=fixture();assert((await handleBrowserPush(new Request('https://example.test',{method:'POST'}),f.d)).status===403);assert(f.calls.length===0);});
Deno.test('replayed nonce cannot reach provider',async()=>{const f=fixture(false);assert((await handleBrowserPush(f.request(),f.d)).status===409);assert(f.calls.join(',')==='web_push_consume');});
Deno.test('simulation separates acceptance from receipt and checks fresh payload',async()=>{const f=fixture(),r=await handleBrowserPush(f.request(),f.d);assert(r.status===200);assert((await r.json()).accepted===1);assert(f.calls.indexOf('web_push_payload')<f.calls.indexOf('provider'));assert(f.states.join(',')==='accepted');});
Deno.test('test backend refuses all claims', async () => {
  const f = fixture();
  f.env.SUPABASE_URL = 'https://bcskqapoagflshewvzzc.supabase.co';
  assert((await handleBrowserPush(f.request(), f.d)).status === 503);
  assert(f.calls.length === 0);
});

Deno.test('disabled production worker refuses all claims', async () => {
  const f = fixture();
  f.env.BIKE_ME_WEB_PUSH_ENABLED = 'false';
  assert((await handleBrowserPush(f.request(), f.d)).status === 503);
  assert(f.calls.length === 0);
});

Deno.test('Edge runtime needs no global Buffer for a valid signed wakeup',async()=>{const scope=globalThis as unknown as Record<string,unknown>,old=scope.Buffer;try{delete scope.Buffer;const f=fixture();assert((await handleBrowserPush(f.request(),f.d)).status===200);}finally{if(old!==undefined)scope.Buffer=old;}});
