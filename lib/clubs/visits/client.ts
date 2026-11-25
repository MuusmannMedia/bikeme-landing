import {VisitError,type VisitCommand,type VisitErrorKind,type VisitSnapshot,type ManageSnapshot} from './contract';
import type {VisitData} from './store';
import {downloadClubImage, readImageProfile} from '../image-client';
import type {ClubImageFrame} from '../image-frame';
const kinds:VisitErrorKind[]=['auth','access','network','invalid','conflict','cooldown','rate','contentRejected','closed','image','quota','receiptExpired'];
async function json(r:Response){if(r.status===401)throw new VisitError('auth');const b=await r.json();if(!r.ok)throw new VisitError(kinds.includes(b.error)?b.error:'network');return b;}
export async function readVisit(clubId:string,actor:string,manage:boolean,signal:AbortSignal,old:VisitData|null,card=false):Promise<{userId:string;data:VisitData}>{const r=await fetch(`/api/clubs/visits?clubId=${clubId}&mode=${manage?'manage':card?'card':'visit'}`,{cache:'no-store',credentials:'same-origin',signal});const b=await json(r);if(b.userId!==actor)throw new VisitError('auth');if(!b.snapshot)throw new VisitError('network');const snapshot=b.snapshot as VisitSnapshot|ManageSnapshot;let cover:Blob|null=null,logo:Blob|null=null;if(!manage){const p=(snapshot as VisitSnapshot).profile,previous=old?.snapshot&&'profile'in old.snapshot?old.snapshot.profile:null;if(p){[cover,logo]=await Promise.all((['cover','logo'] as const).map(async slot=>{if(!(slot==='cover'?p.has_cover:p.has_logo))return null;if(previous?.revision===p.revision&&old?.[slot])return old[slot];const image=await fetch(`/api/clubs/visits?clubId=${clubId}&mode=image&slot=${slot}&revision=${p.revision}`,{cache:'no-store',credentials:'same-origin',signal});if(!image.ok){await json(image);throw new VisitError('network');}if(image.headers.get('x-bike-me-actor')!==actor)throw new VisitError('auth');return image.blob();}));}}return{userId:b.userId,data:{snapshot,cover,logo}};}
export async function sendVisit(command:VisitCommand,signal:AbortSignal){return json(await fetch('/api/clubs/visits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),cache:'no-store',credentials:'same-origin',signal}));}

export async function readVisitPreview(clubId: string, actor: string, signal: AbortSignal, old: VisitData | null, visitsEnabled: boolean): Promise<{ userId: string; data: VisitData }> {
 if (visitsEnabled) {
  try {
   const published = await readVisit(clubId, actor, false, signal, old);
   if ((published.data.snapshot as VisitSnapshot).profile) return published;
  } catch (error) {
   if (!(error instanceof VisitError) || error.kind !== 'access') throw error;
  }
 }

 // The image profile endpoint verifies current club membership on every read.
 const { userId, profile } = await readImageProfile(clubId, signal);
 if (userId !== actor) throw new VisitError('auth');
 if (profile.id !== clubId) throw new VisitError('access');

 const unchanged = old?.memberPreview?.revision === profile.profile_revision;
 const [cover, logo] = await Promise.all(
  (['cover', 'logo'] as const).map(slot => {
   const path = profile[`${slot}_path`];
   if (!path) return null;
   return (unchanged && old?.[slot]) || downloadClubImage(path, actor, signal);
  })
 );
 return {
  userId,
  data: {
   snapshot: { profile: null, rides: [], applications: [], invitation: null, applicationsEnabled: false },
   cover,
   logo,
   memberPreview: {
    name: profile.name,
    description: profile.description ?? '',
    cover_frame: profile.cover_frame as ClubImageFrame | null,
    logo_frame: profile.logo_frame as ClubImageFrame | null,
    member_count: null,
    revision: profile.profile_revision
   }
  }
 };
}
