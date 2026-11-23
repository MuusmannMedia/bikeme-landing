import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {preventAuthCaching} from '@/lib/supabase/proxy';
import {messagePreview} from '@/lib/web-push/preview';
import {genericPush} from '@/lib/web-push/contract';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){const reply=(body:object,status=200)=>preventAuthCaching(NextResponse.json(body,{status}));try{if(process.env.BIKE_ME_WEB_PUSH_ENABLED!=='true')return reply({},503);if(request.headers.get('origin')!==request.nextUrl.origin)return reply({},403);const raw=await request.text();if(raw.length>1000)return reply({},400);const x=JSON.parse(raw),client=await createClient(),auth=await client.auth.getUser(),binding=request.cookies.get('bike-web-push-binding')?.value;if(!auth.data.user||auth.data.user.id!==x.recipient||!binding)return reply({},401);const r=await client.rpc('web_push_authorize',{p_subscription:x.subscription,p_binding:createHash('sha256').update(binding).digest('hex'),p_conversation:x.conversation,p_message:x.message});if(r.error||!r.data)return reply({},403);return reply({ok:true,body:messagePreview(r.data.body)??genericPush[x.language]??genericPush.en});}catch{return reply({},400);}}
