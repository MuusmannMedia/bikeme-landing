import {getSupabaseEnvironment} from '../supabase/config';
import {createClient} from '../supabase/client';
import {ClubError,clubResponseError} from './membership-types';
import type {ClubProfile} from './profile-contract';
import {CLUB_IMAGE_BUCKET} from './image-contract';
export async function readImageProfile(clubId:string,signal:AbortSignal,editing=false){const r=await fetch(`/api/clubs/${editing?'profile':'images'}?clubId=${encodeURIComponent(clubId)}`,{cache:'no-store',credentials:'same-origin',signal});const b=await r.json();if(!r.ok)throw clubResponseError(b.error);if(typeof b.userId!=='string'||!b.profile)throw new ClubError('network');return b as {userId:string;profile:ClubProfile};}
export async function downloadClubImage(path:string,actor:string,signal:AbortSignal){
 const config=getSupabaseEnvironment(),c=createClient();if(!config||!c)throw new ClubError('network');const s=await c.auth.getSession();if(s.error||s.data.session?.user.id!==actor)throw new ClubError('auth');const token=s.data.session.access_token;
 const r=await fetch(`${config.url}/storage/v1/object/authenticated/${CLUB_IMAGE_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}?view=${crypto.randomUUID()}`,{headers:{Authorization:`Bearer ${token}`,apikey:config.publishableKey},cache:'no-store',credentials:'omit',signal});if(!r.ok)throw new ClubError(r.status===401?'auth':r.status===403?'access':'network');return r.blob();
}
