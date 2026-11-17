import 'server-only';
import {clubFeatureEnabled} from '../deployment-gate';
import {createHash,createHmac} from 'node:crypto';
import sharp from 'sharp';
import type {SupabaseClient} from '@supabase/supabase-js';
import {VisitError,visitError} from './contract';
// Explicit deployment opt-in, exact environment/backend pairing, DB stopflags still apply.
export function catalogEnabled(env:NodeJS.ProcessEnv){return clubFeatureEnabled(env,'BIKE_ME_VISIT_CATALOG_ENABLED');}
export async function prepareCatalogImage(client:SupabaseClient,actor:string,club:string,slot:'cover'|'logo',source:string,bytes:Buffer){
 const key=process.env.BIKE_ME_VISIT_CATALOG_SIGNING_KEY;
 if(!catalogEnabled(process.env)||!key||!/^[a-f0-9]{64}$/.test(key))throw new VisitError('image');
 const max=slot==='cover'?960:128,cap=slot==='cover'?98304:12288;
 let output:Buffer|undefined;
 for(const quality of [80,65,50,40,30]){
  output=await sharp(bytes,{limitInputPixels:64000000}).rotate().resize({width:max,height:max,fit:'inside',withoutEnlargement:true}).webp({quality}).timeout({seconds:8}).toBuffer();
  if(output.length<=cap)break;
 }
 if(!output||output.length>cap)throw new VisitError('image');
 const meta=await sharp(output).metadata(),hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
 const expires=Math.floor(Date.now()/1000)+90;
 const message=['catalog-v1',actor,club,slot,hash(bytes),hash(output),meta.width,meta.height,expires].join('|');
 const r=await client.rpc('club_visit_catalog_stage',{p_club:club,p_slot:slot,p_source:source,p_data:output.toString('base64'),p_source_hash:hash(bytes),p_width:meta.width,p_height:meta.height,p_expires:expires,p_signature:createHmac('sha256',Buffer.from(key,'hex')).update(message).digest('hex')});
 if(r.error)throw visitError(r.error);
}
