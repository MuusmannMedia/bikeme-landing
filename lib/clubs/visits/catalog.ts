import {visitError,type VisitProfile} from './contract';
// Only an authoritative access denial means no visitor projection. Transport,
// schema and decoding failures must remain errors, never empty catalog entries.
export async function loadVisitCatalog(ids:string[],read:(id:string)=>Promise<VisitProfile>){const profiles:Record<string,VisitProfile>={};for(let offset=0;offset<ids.length;offset+=4){await Promise.all(ids.slice(offset,offset+4).map(async id=>{try{profiles[id]=await read(id);}catch(e){if(visitError(e).kind!=='access')throw e;}}));}return profiles;}
