import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {preventAuthCaching} from '@/lib/supabase/proxy';
import {isClubRequestOrigin} from '@/lib/clubs/request-origin';
import {createClubProfileApi} from '@/lib/clubs/profile-api';
import {profileEditingEnabled} from '@/lib/clubs/profile-contract';
import {ClubError,clubError} from '@/lib/clubs/membership-types';
export const dynamic='force-dynamic';
const reply=(body:object,status=200)=>preventAuthCaching(NextResponse.json(body,{status}));
function failure(e:unknown){const kind=clubError(e).kind;return reply({error:kind},kind==='auth'?401:kind==='access'?403:kind==='network'||kind==='unavailable'?503:409);}
async function context(){const client=await createClient(),r=await client.auth.getUser();if(r.error||!r.data.user)throw new ClubError(r.error&&![400,401,403].includes(r.error.status??0)?'network':'auth');return{actor:r.data.user.id,api:createClubProfileApi(client,r.data.user.id,profileEditingEnabled(process.env))};}
export async function GET(request:NextRequest){try{const{actor,api}=await context();const id=request.nextUrl.searchParams.get('clubId');return reply({userId:actor,profile:id?await api.profile(id):null});}catch(e){return failure(e);}}
export async function POST(request:NextRequest){
 if(!isClubRequestOrigin(request.headers.get('origin'),request.headers.get('x-forwarded-host')??request.headers.get('host'),request.headers.get('x-forwarded-proto')??request.nextUrl.protocol.replace(':',''))||!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'access'},403);
 try{const raw=await request.text();if(raw.length>16000)throw new ClubError('invalid');let command;try{command=JSON.parse(raw);}catch{throw new ClubError('invalid');}const{actor,api}=await context();return reply({userId:actor,ok:true,...await api.execute(command)});}catch(e){return failure(e);}
}
