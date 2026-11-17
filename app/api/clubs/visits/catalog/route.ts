import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {preventAuthCaching} from '@/lib/supabase/proxy';
import {isClubRequestOrigin} from '@/lib/clubs/request-origin';
import {visitsEnabled} from '@/lib/clubs/visits/gate';
import {catalogEnabled} from '@/lib/clubs/visits/catalog-server';
import {visitError,VisitError} from '@/lib/clubs/visits/contract';
export const dynamic='force-dynamic';
function reply(body:object,status=200){const r=preventAuthCaching(NextResponse.json(body,{status}));r.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');if(status===429)r.headers.set('Retry-After','61');return r;}
export async function POST(req:NextRequest){
 try{
  if(!visitsEnabled(process.env)||!catalogEnabled(process.env)||!isClubRequestOrigin(req.headers.get('origin'),req.headers.get('x-forwarded-host')??req.headers.get('host'),req.headers.get('x-forwarded-proto')??req.nextUrl.protocol.replace(':',''))||!req.headers.get('content-type')?.startsWith('application/json'))throw new VisitError('access');
  const raw=await req.text();if(Buffer.byteLength(raw)>16384)throw new VisitError('invalid');
  const body=JSON.parse(raw),c=await createClient(),u=await c.auth.getUser();
  if(u.error||!u.data.user)throw new VisitError('auth');if(body.actorId!==u.data.user.id)throw new VisitError('auth');
  if(!['manifest','media'].includes(body.op))throw new VisitError('invalid');
  const r=await c.rpc(body.op==='manifest'?'club_visit_catalog_manifest':'club_visit_catalog_media',body.op==='manifest'?{p_ids:body.ids,p_known:{}}:{p_items:body.items}).abortSignal(AbortSignal.timeout(15000));
  if(r.error)throw visitError(r.error);if(r.data?.userId!==u.data.user.id)throw new VisitError('auth');return reply(r.data);
 }catch(e){const detail=visitError(e),error=detail.kind;const r=reply({error},error==='auth'?401:error==='access'?403:error==='quota'?429:error==='network'?503:409);if(error==='quota')r.headers.set('Retry-After',String(detail.retryAfter??61));return r;}
}
