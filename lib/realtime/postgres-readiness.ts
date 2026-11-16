// A Phoenix join is not a Postgres Changes subscription. Catch up only after
// the server confirms the RLS-filtered listener, including after reconnect.
export function createPostgresReadiness(o:{ready:()=>void;unavailable:()=>void;timeoutMs?:number}){
 let joined=false,listening=false,ready=false,stopped=false;
 let timer:ReturnType<typeof setTimeout>|null=null;
 const clear=()=>{if(timer!==null)clearTimeout(timer);timer=null;};
 const promote=()=>{if(!stopped&&joined&&listening&&!ready){clear();ready=true;o.ready();}};
 return{
  status(status:string){if(stopped)return;if(status==='SUBSCRIBED'){joined=true;promote();if(!ready&&timer===null)timer=setTimeout(()=>{timer=null;if(!stopped&&!ready)o.unavailable();},o.timeoutMs??20000);}else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){clear();joined=false;listening=false;ready=false;o.unavailable();}},
  system(payload:{extension?:string;status?:string}){if(stopped||payload.extension!=='postgres_changes')return;if(payload.status==='ok'){listening=true;promote();}else if(payload.status==='error'){clear();listening=false;ready=false;o.unavailable();}},
  stop(){stopped=true;clear();joined=false;listening=false;ready=false;},
  get ready(){return ready;}
 };
}
