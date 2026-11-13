import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {preventAuthCaching} from "@/lib/supabase/proxy";
import {isClubRequestOrigin} from "@/lib/clubs/request-origin";
import {createClubChatApi} from "@/lib/clubs/chat-api";
import {ContentError,contentError} from "@/lib/clubs/content-contract";
import {ClubReadError} from "@/lib/clubs/types";
export const dynamic="force-dynamic";
const reply=(body:object,status=200)=>preventAuthCaching(NextResponse.json(body,{status}));
function failure(e:unknown){const kind=e instanceof ClubReadError?e.kind:contentError(e).kind;return reply({error:kind},kind==="auth"?401:kind==="access"?403:["network"].includes(kind)?503:409);}
async function context(){const client=await createClient(),auth=await client.auth.getUser();if(auth.error||!auth.data.user)throw new ContentError(auth.error&&![400,401,403].includes(auth.error.status??0)?"network":"auth");return{actor:auth.data.user.id,api:createClubChatApi(client,auth.data.user.id)};}
export async function GET(request:NextRequest){try{const {actor,api}=await context();if(request.nextUrl.searchParams.get("mode")==="signals")return reply({userId:actor,...await api.signals()});return reply({userId:actor,snapshot:await api.read(request.nextUrl.searchParams.get("clubId")??"",request.nextUrl.searchParams)});}catch(e){return failure(e);}}
export async function POST(request:NextRequest){if(!isClubRequestOrigin(request.headers.get("origin"),request.headers.get("x-forwarded-host")??request.headers.get("host"),request.headers.get("x-forwarded-proto")??request.nextUrl.protocol.replace(":",""))||!request.headers.get("content-type")?.startsWith("application/json"))return reply({error:"access"},403);
 try{const raw=await request.text();if(raw.length>100000)throw new ContentError("invalid");let input;try{input=JSON.parse(raw);}catch{throw new ContentError("invalid");}const {actor,api}=await context();return reply({userId:actor,ok:true,result:await api.execute(input)});}catch(e){return failure(e);}}
