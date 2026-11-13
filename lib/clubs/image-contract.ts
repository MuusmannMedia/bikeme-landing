import {ClubError} from './membership-types';
import {isClubId} from './types';
import type {ClubImageFrame} from './image-frame';
export const CLUB_IMAGE_BUCKET='club-profile-images',CLUB_IMAGE_LIMIT=3*1024*1024,CLUB_IMAGE_SOURCE_LIMIT=25*1024*1024;
export type ImageSlot='cover'|'logo';
export type ImageCommand={actorId:string;clubId:string;imageId:string|null;sourcePath?:string|null;revision:number;slot:ImageSlot;frame:ClubImageFrame};
export function imageSlot(v:unknown):ImageSlot{if(v!=='cover'&&v!=='logo')throw new ClubError('invalid');return v;}
export function imagePath(actor:string,club:string,slot:ImageSlot,id:string){if(!isClubId(actor)||!isClubId(club)||!isClubId(id))throw new ClubError('invalid');return `edit/${actor}/${club}/${slot}-${id}.${slot==='cover'?'jpg':'png'}`;}
export function imageFrame(v:unknown,slot:ImageSlot):ClubImageFrame{
 if(!v||typeof v!=='object'||Array.isArray(v))throw new ClubError('invalid');const f=v as ClubImageFrame;
 if(Object.keys(f).sort().join(',')!=='whole,x,y,zoom'||typeof f.whole!=='boolean'||![f.zoom,f.x,f.y].every(Number.isFinite)||f.zoom<1||f.zoom>4||Math.abs(f.x)>1||Math.abs(f.y)>1||f.whole&&(slot!=='logo'||f.zoom!==1||f.x!==0||f.y!==0))throw new ClubError('invalid');return{zoom:f.zoom,x:f.x,y:f.y,whole:f.whole};
}
export function imageCommand(v:unknown,actor:string):ImageCommand{
 if(!v||typeof v!=='object'||Array.isArray(v))throw new ClubError('invalid');const c=v as ImageCommand;
 if(c.actorId!==actor)throw new ClubError('auth');if(Object.keys(c).some(k=>!['actorId','clubId','frame','imageId','revision','slot','sourcePath'].includes(k))||!Number.isSafeInteger(c.revision)||c.revision<0||!isClubId(c.clubId))throw new ClubError('invalid');const slot=imageSlot(c.slot);if(c.imageId===null){if(typeof c.sourcePath!=='string'||!c.sourcePath)throw new ClubError('invalid');}else{imagePath(actor,c.clubId,slot,c.imageId);if(c.sourcePath!=null)throw new ClubError('invalid');}return{...c,slot,frame:imageFrame(c.frame,slot)};
}
