import {isClubId} from './types';
import {ClubError,clubError} from './membership-types';
import {validateClubText,type ClubProfile,type ProfileCommand,type ClubText} from './profile-contract';
export type ProfileState={status:'loading'|'ready'|'error'|'access'|'auth';profile:ClubProfile|null;draft:(ClubText&{revision:number})|null;pending:ProfileCommand|null;busy:boolean;error:string|null;conflict:boolean;savedId:string|null};
export function createProfileStore(options:{actor:string;clubId?:string;key:()=>string;read:(signal:AbortSignal)=>Promise<{userId:string;profile:ClubProfile|null}>;send:(command:ProfileCommand,signal:AbortSignal)=>Promise<{userId:string;id:string;ok:boolean}>;identityLost:()=>void}){
 const initial:ProfileState={status:'loading',profile:null,draft:null,pending:null,busy:false,error:null,conflict:false,savedId:null};let state=initial,live=true,revoked=false,suspended=false,epoch=0,generation=0,readController:AbortController|null=null,writeController:AbortController|null=null;
 const listeners=new Set<()=>void>();const patch=(v:Partial<ProfileState>)=>{state={...state,...v};listeners.forEach(fn=>fn());};
 function pause(){if(!live||revoked)return;generation++;readController?.abort();suspended=true;patch({status:'loading',profile:null});}
 function revoke(status:'auth'|'access'='auth'){epoch++;generation++;readController?.abort();writeController?.abort();revoked=true;patch({...initial,status});}
 async function refresh(){if(!live||revoked)return;pause();suspended=false;const gen=generation,identity=epoch,c=new AbortController();readController=c;const timer=setTimeout(()=>c.abort(),25000);try{
  const r=await options.read(c.signal);if(!live||gen!==generation||identity!==epoch)return;if(c.signal.aborted)throw new ClubError('network');if(r.userId!==options.actor){revoke();options.identityLost();return;}
  if(options.clubId&&r.profile?.id!==options.clubId)throw new ClubError('access');
  const draft=state.draft??{name:r.profile?.name??'',description:r.profile?.description??'',revision:r.profile?.profile_revision??0};
  patch({status:'ready',profile:r.profile,draft,conflict:state.conflict||!state.pending&&!!r.profile&&r.profile.profile_revision!==draft.revision,error:state.pending?state.error:null});
 }catch(e){if(!live||gen!==generation||identity!==epoch)return;const kind=clubError(e).kind;if(kind==='auth'){revoke();options.identityLost();}else if(kind==='access')revoke('access');else patch({status:'error',profile:null,error:kind});}finally{clearTimeout(timer);}}
 async function submit(retry=false){if(!live||revoked||state.status!=='ready'||state.busy||state.conflict||state.pending&&!retry||!state.draft)return;
  let work:ProfileCommand;try{const text=validateClubText(state.draft);work=retry?state.pending!:structuredClone({actorId:options.actor,name:text.name,description:text.description??'',...(options.clubId?{op:'edit' as const,clubId:options.clubId,revision:state.draft.revision}:{op:'create' as const,requestId:options.key()})});if(!work)return;}catch{patch({error:'invalid'});return;}
  const identity=epoch;patch({busy:true,pending:work,error:null});const c=new AbortController();writeController=c;const timer=setTimeout(()=>c.abort(),25000);try{
   const r=await options.send(work,c.signal);if(!live||identity!==epoch)return;if(r.userId!==options.actor){revoke();options.identityLost();return;}if(!r.ok||!isClubId(r.id)||work.op==='edit'&&r.id!==work.clubId)throw new ClubError('network');
   patch({pending:null,draft:null,savedId:r.id});
  }catch(e){if(!live||identity!==epoch)return;const kind=clubError(e).kind;if(kind==='auth'){revoke();options.identityLost();return;}if(kind==='access'){revoke('access');return;}
   patch({error:kind,pending:kind==='network'||kind==='unavailable'?work:null,conflict:kind==='conflict'});if(kind==='conflict'&&!suspended)await refresh();
  }finally{clearTimeout(timer);if(live&&identity===epoch)patch({busy:false});}
 }
 return{subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},getSnapshot:()=>state,getServerSnapshot:()=>initial,
 start(){live=true;revoked=false;},stop(){live=false;epoch++;generation++;readController?.abort();writeController?.abort();state=initial;},pause,revoke,refresh,submit,
 text(field:keyof ClubText,value:string){if(state.status==='ready'&&state.draft&&!state.pending&&!state.busy)patch({draft:{...state.draft,[field]:value},error:null});},
 rebase(){if(state.status==='ready'&&state.draft&&state.profile&&!state.busy&&!state.pending)patch({draft:{...state.draft,revision:state.profile.profile_revision},conflict:false,error:null});}
 };
}
