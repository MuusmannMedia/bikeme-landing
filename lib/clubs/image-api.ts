import type {SupabaseClient} from '@supabase/supabase-js';
import {createClubReadApi} from './api';
import {createClubProfileApi,clubProfileFields} from './profile-api';
import type {ClubProfile} from './profile-contract';
import {ClubError,clubError} from './membership-types';
import {CLUB_IMAGE_BUCKET,imageCommand,imagePath,type ImageSlot} from './image-contract';
export function createClubImageApi(client:SupabaseClient,actor:string,enabled:boolean){
 const edit=createClubProfileApi(client,actor,enabled).profile;
 return{edit,async read(club:string):Promise<ClubProfile>{await createClubReadApi(client,actor).detail(club);const r=await client.from('clubs').select(clubProfileFields).eq('id',club).maybeSingle();if(r.error)throw clubError(r.error);if(!r.data)throw new ClubError('access');return r.data as unknown as ClubProfile;},
 async upload(club:string,slot:ImageSlot,id:string,bytes:Uint8Array){await edit(club);const path=imagePath(actor,club,slot,id);const r=await client.storage.from(CLUB_IMAGE_BUCKET).upload(path,bytes,{upsert:false,cacheControl:'0',contentType:slot==='cover'?'image/jpeg':'image/png'});if(r.error){const e=r.error as {status?:number;statusCode?:string};if(e.status!==409&&!['409','Duplicate'].includes(String(e.statusCode))){if([401,403].includes(Number(e.status??e.statusCode)))throw new ClubError('access');throw clubError(r.error);}}return path;},
 async save(raw:unknown){const c=imageCommand(raw,actor),current=await edit(c.clubId),existing=c.slot==='cover'?current.cover_path:current.logo_path;
 if(c.imageId===null&&c.sourcePath!==existing)throw new ClubError('conflict');
 const path=c.imageId===null?existing!:imagePath(actor,c.clubId,c.slot,c.imageId),frame={source:path,...c.frame};
 const r=await client.rpc('club_save_framed_profile',{p_club_id:c.clubId,p_revision:c.revision,p_name:current.name,p_description:current.description,p_cover_path:c.slot==='cover'?path:current.cover_path,p_logo_path:c.slot==='logo'?path:current.logo_path,p_cover_frame:c.slot==='cover'?frame:current.cover_frame,p_logo_frame:c.slot==='logo'?frame:current.logo_frame});if(r.error)throw clubError(r.error);if(!r.data||r.data.id!==c.clubId)throw new ClubError('network');return{id:c.clubId};}
 };
}
