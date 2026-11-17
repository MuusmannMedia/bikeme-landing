import {clubFeatureEnabled} from './deployment-gate';
import { ClubError } from './membership-types';
import { isClubId } from './types';
export type ClubText={name:string;description:string};
export type ClubProfile={id:string;name:string;description:string|null;profile_revision:number;cover_path:string|null;logo_path:string|null;cover_frame:unknown;logo_frame:unknown};
export type ProfileCommand=({op:'create';requestId:string}|{op:'edit';clubId:string;revision:number})&ClubText&{actorId:string};
export function validateClubText(input:ClubText){
 const name=input.name.replace(/^ +| +$/g,''),description=input.description.replace(/^ +| +$/g,'');
 if(Array.from(name).length<2||Array.from(name).length>80||Array.from(description).length>1000||name.includes('\0')||description.includes('\0'))throw new ClubError('invalid');
 return {name,description:description||null};
}
// Server-only environment values are passed by callers. No public feature flag.
export function profileEditingEnabled(env:Readonly<Record<string,string|undefined>>){
 return clubFeatureEnabled(env,'BIKE_ME_CLUB_PROFILE_EDIT_ENABLED');
}
export function parseProfileCommand(raw:unknown,actor:string):ProfileCommand{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ClubError('invalid');
 const v=raw as Record<string,unknown>;
 if(v.actorId!==actor)throw new ClubError('auth');
 if(typeof v.name!=='string'||typeof v.description!=='string')throw new ClubError('invalid');
 validateClubText({name:v.name,description:v.description});
 const keys=v.op==='create'?['op','actorId','name','description','requestId']:['op','actorId','name','description','clubId','revision'];
 if(Object.keys(v).some(k=>!keys.includes(k)))throw new ClubError('invalid');
 if(v.op==='create'&&isClubId(String(v.requestId)))return v as ProfileCommand;
 if(v.op==='edit'&&isClubId(String(v.clubId))&&Number.isSafeInteger(v.revision)&&Number(v.revision)>=0)return v as ProfileCommand;
 throw new ClubError('invalid');
}
