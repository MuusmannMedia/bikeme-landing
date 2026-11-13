import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {preventAuthCaching} from '@/lib/supabase/proxy';
import {isClubRequestOrigin} from '@/lib/clubs/request-origin';
import {profileEditingEnabled} from '@/lib/clubs/profile-contract';
import {createClubImageApi} from '@/lib/clubs/image-api';
import {normalizeClubImage,validateStoredClubImage} from '@/lib/clubs/image-normalize';
import {CLUB_IMAGE_SOURCE_LIMIT,imagePath,imageSlot} from '@/lib/clubs/image-contract';
import {ClubError,clubError} from '@/lib/clubs/membership-types';
export const dynamic='force-dynamic';export const runtime='nodejs';
const reply=(body:object,status=200)=>preventAuthCaching(NextResponse.json(body,{status}));
function fail(e:unknown){const k=clubError(e).kind;return reply({error:k},k==='auth'?401:k==='access'?403:k==='network'||k==='unavailable'?503:409);}
async function context(){const c=await createClient(),r=await c.auth.getUser();if(r.error||!r.data.user)throw new ClubError(r.error&&![400,401,403].includes(r.error.status??0)?'network':'auth');return{actor:r.data.user.id,api:createClubImageApi(c,r.data.user.id,profileEditingEnabled(process.env))};}
export async function GET(r:NextRequest){try{const{actor,api}=await context();return reply({userId:actor,profile:await api.read(r.nextUrl.searchParams.get('clubId')??'')});}catch(e){return fail(e);}}
export async function POST(r:NextRequest){
 if(!isClubRequestOrigin(r.headers.get('origin'),r.headers.get('x-forwarded-host')??r.headers.get('host'),r.headers.get('x-forwarded-proto')??r.nextUrl.protocol.replace(':','')))return reply({error:'access'},403);
 // Reject disabled writes before reading/decoding an uploaded body.
 if(!profileEditingEnabled(process.env))return reply({error:'access'},403);
 try{const{actor,api}=await context();if(r.headers.get('content-type')?.startsWith('application/json')){const text=await r.text();if(text.length>4096)throw new ClubError('invalid');let v;try{v=JSON.parse(text);}catch{throw new ClubError('invalid');}return reply({userId:actor,ok:true,...await api.save(v)});}
  if(!r.headers.get('content-type')?.startsWith('multipart/form-data')||Number(r.headers.get('content-length')??0)>CLUB_IMAGE_SOURCE_LIMIT+16384)throw new ClubError('image');
  let f:FormData;try{f=await r.formData();}catch{throw new ClubError('image');}const club=String(f.get('clubId')??''),slot=imageSlot(f.get('slot')),mode=f.get('mode');if(f.get('actorId')!==actor)throw new ClubError('auth');await api.edit(club);const file=f.get('file');if(!(file instanceof File)||file.size>CLUB_IMAGE_SOURCE_LIMIT)throw new ClubError('image');const bytes=new Uint8Array(await file.arrayBuffer());
  if(mode==='prepare'){const normalized=await normalizeClubImage(bytes,slot);const response=preventAuthCaching(new NextResponse(new Uint8Array(normalized.bytes),{headers:{'Content-Type':normalized.type,'X-Image-Width':String(normalized.width),'X-Image-Height':String(normalized.height),'X-Content-Type-Options':'nosniff'}}));return response;}
  if(mode!=='upload')throw new ClubError('invalid');const id=String(f.get('imageId'));imagePath(actor,club,slot,id);await validateStoredClubImage(bytes,slot);return reply({userId:actor,path:await api.upload(club,slot,id,bytes)});
 }catch(e){return fail(e);}
}
