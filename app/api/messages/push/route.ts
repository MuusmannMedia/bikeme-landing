import {createHash,randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {preventAuthCaching} from '@/lib/supabase/proxy';
import {isClubRequestOrigin} from '@/lib/clubs/request-origin';
import {subscription,pushLanguages} from '@/lib/web-push/contract';
export const dynamic='force-dynamic';
const response=(body:object,status=200)=>preventAuthCaching(NextResponse.json(body,{status}));
const enabled=()=>process.env.BIKE_ME_WEB_PUSH_ENABLED==='true'&&!!process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
export async function GET(request:NextRequest){const client=await createClient(),auth=await client.auth.getUser();if(!auth.data.user)return response({error:'auth'},401);const gate=enabled()?await client.rpc('web_push_status'):null,allowed=enabled()&&gate?.data===true&&!gate.error;const reply=response({enabled:allowed,publicKey:allowed?process.env.WEB_PUSH_VAPID_PUBLIC_KEY:null});if(allowed&&!/^[a-f0-9]{64}$/.test(request.cookies.get('bike-web-push-binding')?.value??''))reply.cookies.set('bike-web-push-binding',randomBytes(32).toString('hex'),{httpOnly:true,secure:request.nextUrl.protocol==='https:',sameSite:'strict',path:'/',maxAge:30*86400});return reply;}
export async function POST(request:NextRequest){if(!isClubRequestOrigin(request.headers.get('origin'),request.headers.get('x-forwarded-host')??request.headers.get('host'),request.headers.get('x-forwarded-proto')??request.nextUrl.protocol.replace(':','')))return response({error:'access'},403);
 try{const client=await createClient(),auth=await client.auth.getUser();if(!auth.data.user)return response({error:'auth'},401);const raw=await request.text();if(raw.length>5000)return response({error:'invalid'},400);const x=JSON.parse(raw),old=request.cookies.get('bike-web-push-binding')?.value;const binding=old&&/^[a-f0-9]{64}$/.test(old)?old:randomBytes(32).toString('hex'),hash=createHash('sha256').update(binding).digest('hex');
 if(x.action==='remove'){const r=await client.rpc('web_push_remove',{p_binding:hash});if(r.error)return response({error:'unavailable'},503);return response({ok:true});}
 if(!enabled())return response({error:'unavailable'},503);if(!old||!/^[a-f0-9]{64}$/.test(old))return response({error:'invalid'},400);const s=subscription(x.subscription);if(!pushLanguages.includes(x.language))return response({error:'invalid'},400);
 const r=await client.rpc('web_push_register',{p_binding:hash,p_endpoint:s.endpoint,p_p256dh:s.keys.p256dh,p_auth:s.keys.auth,p_language:x.language});if(r.error)return response({error:r.error.code==='PT429'?'limit':'unavailable'},r.error.code==='PT429'?429:503);const reply=response({ok:true,id:r.data});reply.cookies.set('bike-web-push-binding',binding,{httpOnly:true,secure:request.nextUrl.protocol==='https:',sameSite:'strict',path:'/',maxAge:30*86400});return reply;
 }catch{return response({error:'invalid'},400);}}
