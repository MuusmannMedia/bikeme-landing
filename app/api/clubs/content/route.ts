import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {preventAuthCaching} from "@/lib/supabase/proxy";
import {isClubRequestOrigin} from "@/lib/clubs/request-origin";
import {createClubContentApi} from "@/lib/clubs/content-api";
import {ContentError,contentError} from "@/lib/clubs/content-contract";
import {galleryBody} from "@/lib/clubs/gallery-server";
import {GalleryError} from "@/lib/clubs/gallery-contract";
import {postImageRequestLimit} from "@/lib/clubs/post-image";
import {ClubReadError} from "@/lib/clubs/types";
export const dynamic="force-dynamic";
const reply=(body:object,status=200)=>preventAuthCaching(NextResponse.json(body,{status}));
function failure(e:unknown){const kind=e instanceof ClubReadError?e.kind:contentError(e).kind;return reply({error:kind},kind==="auth"?401:kind==="access"?403:["network"].includes(kind)?503:409);}
async function context(){const client=await createClient(),auth=await client.auth.getUser();if(auth.error||!auth.data.user)throw new ContentError(auth.error&&![400,401,403].includes(auth.error.status??0)?"network":"auth");return{actor:auth.data.user.id,api:createClubContentApi(client,auth.data.user.id)};}
export async function GET(request:NextRequest){try{const {actor,api}=await context();if(request.nextUrl.searchParams.get("mode")==="revision")return reply({userId:actor,revision:await api.revision()});return reply({userId:actor,snapshot:await api.load(request.nextUrl.searchParams.get("clubId")??"",request.nextUrl.searchParams)});}catch(e){return failure(e);}}
export async function POST(request:NextRequest){if(!isClubRequestOrigin(request.headers.get("origin"),request.headers.get("x-forwarded-host")??request.headers.get("host"),request.headers.get("x-forwarded-proto")??request.nextUrl.protocol.replace(":",""))||!request.headers.get("content-type")?.startsWith("application/json"))return reply({error:"access"},403);
 try{
  const {actor,api}=await context();
  const body=await galleryBody(request,postImageRequestLimit).catch(error=>{
   if(error instanceof GalleryError&&error.kind==="size")throw new ContentError("image");
   throw error;
  });
  let input;
  try{input=JSON.parse(await body.text());}catch{throw new ContentError("invalid");}
  if(body.size>100000&&(input?.image==null||typeof input.image!=="object"))throw new ContentError("invalid");
  return reply({userId:actor,ok:true,result:await api.execute(input)});
 }catch(e){return failure(e);}
}
