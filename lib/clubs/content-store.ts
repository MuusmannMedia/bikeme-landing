import type { PostImageChoice } from "./post-image";
import { isClubId } from "./types";
import { ContentError, contentError, type ContentCommand, type ContentDraft, type ContentItem, type ContentSnapshot, type ReportDraft } from "./content-contract";
export type ContentState={feedback:number;status:"loading"|"ready"|"error"|"access"|"auth";data:ContentSnapshot|null;draft:ContentDraft|null;report:ReportDraft|null;conflict:boolean;pending:ContentCommand|null;busy:boolean;error:string|null;notice:string|null};
export function createContentStore(options:{actor:string;clubId:string;key:()=>string;read:(draft:ContentDraft|null,signal:AbortSignal)=>Promise<{userId:string;snapshot:ContentSnapshot}>;send:(command:ContentCommand,signal:AbortSignal)=>Promise<{userId:string;ok:boolean;result:unknown}>;identityLost:()=>void}){
 const initial:ContentState={feedback:0,status:"loading",data:null,draft:null,report:null,conflict:false,pending:null,busy:false,error:null,notice:null};
 let suspended=false,authRevoked=false;
 let state=initial,active=true,generation=0,identity=0,revision=-1,readController:AbortController|null=null,writeController:AbortController|null=null;
 const listeners=new Set<()=>void>();
 function patch(value:Partial<ContentState>){state={...state,...value};listeners.forEach(fn=>fn());}
 function clearPayload(){generation++;readController?.abort();readController=null;patch({status:"loading",data:null});}
 function pause(){if(authRevoked||!active)return;suspended=true;clearPayload();}
 function revoke(status:"auth"|"access"){if(status==="auth")authRevoked=true;suspended=true;identity++;generation++;readController?.abort();writeController?.abort();patch({...initial,status});}
 async function refresh(retain=false){if(!active||authRevoked)return;suspended=false;if(retain){generation++;readController?.abort();}else clearPayload();const request=generation,epoch=identity,controller=new AbortController();readController=controller;const timer=setTimeout(()=>controller.abort(),25000);
  try{const response=await options.read(state.draft,controller.signal);if(!active||request!==generation||epoch!==identity)return;if(controller.signal.aborted)throw new ContentError("network");if(response.userId!==options.actor){revoke("auth");options.identityLost();return;}
   if(response.snapshot.visibilityRevision<revision)throw new ContentError("network");revision=response.snapshot.visibilityRevision;patch({status:"ready",data:response.snapshot,error:state.error==="network"&&!state.pending?null:state.error});
  }catch(e){if(!active||request!==generation||epoch!==identity)return;const error=contentError(e);if(error.kind==="auth"){revoke("auth");options.identityLost();}else if(error.kind==="access")revoke("access");else patch({status:"error",data:null,error:error.kind});}finally{clearTimeout(timer);}
 }
 async function run(command:ContentCommand,retry=false){if(!active||authRevoked||state.status!=="ready"||state.busy||state.pending&&!retry)return false;const work=retry?state.pending:structuredClone(command);if(!work)return false;const epoch=identity;patch({feedback:state.feedback+1,busy:true,pending:work,error:null,notice:null});const controller=new AbortController();writeController=controller;const timer=setTimeout(()=>controller.abort(),25000);
  try{const response=await options.send(work,controller.signal);if(!active||epoch!==identity)return false;if(response.userId!==options.actor){revoke("auth");options.identityLost();return false;}if(!response.ok)throw new ContentError("network");
   const result=response.result;
   if(work.type==="create"&&(!result||typeof result!=="object"||!("id" in result)||result.id!==work.id||!("version" in result)||(!Number.isSafeInteger(result.version)||Number(result.version)<1)))throw new ContentError("network");
   if(work.type==="change"&&(!result||typeof result!=="object"||!("id" in result)||result.id!==work.id||!(("changed" in result&&result.changed===true)||("unavailable" in result&&result.unavailable===true)||("version" in result&&Number.isSafeInteger(result.version)&&Number(result.version)>0))))throw new ContentError("network");
   if(work.type==="resolve"&&(!result||typeof result!=="object"||!("id" in result)||result.id!==work.id||!("status" in result)||!["removed","dismissed"].includes(String(result.status))||!("already_handled" in result)||typeof result.already_handled!=="boolean"))throw new ContentError("network");
   if(work.type==="report"&&(typeof result!=="string"||!isClubId(result)))throw new ContentError("network");
   if(["block","unblock"].includes(work.type)&&(!Number.isSafeInteger(result)||Number(result)<0))throw new ContentError("network");
   const savedDraft=work.type==="create"&&state.draft?.key===work.id||work.type==="change"&&work.action==="edit"&&state.draft?.id===work.id;
   patch({pending:null,...(savedDraft?{draft:null,conflict:false}:{}),...(work.type==="report"&&state.report?.id===work.id?{report:null}:{}),notice:result&&typeof result==="object"&&"unavailable" in result&&result.unavailable?"unavailable":work.type==="report"?(work.destination==="bikeMe"?"sentBikeMe":"sentClub"):work.type==="resolve"?"handled":"saved"});
   if(!suspended)await refresh();return true;
  }catch(e){if(!active||epoch!==identity)return false;const error=contentError(e);if(error.kind==="auth"){revoke("auth");options.identityLost();return false;}
   patch({error:error.kind,pending:error.kind==="network"?work:null,conflict:error.kind==="conflict"&&work.type==="change"&&work.action==="edit"});
   if(!suspended&&error.kind!=="contentRejected"&&error.kind!=="invalid"&&error.kind!=="image")await refresh();return false;
  }finally{clearTimeout(timer);if(active&&epoch===identity)patch({busy:false});}
 }
 return {
 subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},getSnapshot:()=>state,getServerSnapshot:()=>initial,
 start(){active=true;suspended=false;authRevoked=false;},stop(){active=false;identity++;generation++;readController?.abort();writeController?.abort();state=initial;},pause,refresh,revoke,
 failNetwork(){if(!active||authRevoked)return;generation++;readController?.abort();patch({status:"error",data:null,error:"network"});},
 observe(next:number){if(!active||authRevoked||state.status==="access")return;if(next>revision){revision=next;clearPayload();if(!suspended)void refresh();}},
 edit(item:ContentItem|null,post:string|null=null){if(!active||authRevoked||state.status!=="ready"||state.busy||state.pending)return;const kind=item?.kind??(post?"comment":"post");if(kind==="chat")return;patch({report:null,error:null,notice:null,conflict:false,draft:{kind,id:item?.id??null,post:item?.post_id??post,version:item?.version??null,text:item?.body??"",key:options.key()}});},
 text(text:string){if(state.draft&&!state.busy&&!state.pending)patch({draft:{...state.draft,text}});},
 postImage(key:string,image:PostImageChoice|null|undefined){
  if(active&&!authRevoked&&state.draft?.kind==="post"&&state.draft.key===key&&!state.busy&&!state.pending){
   patch({draft:{...state.draft,image},error:state.error==="image"?null:state.error});
  }
 },
 report(item:ContentItem){if(!active||authRevoked||state.status!=="ready"||state.busy||state.pending||item.kind==="chat")return;patch({draft:null,conflict:false,error:null,notice:null,report:{kind:item.kind,id:item.id,reason:"spam",detail:"",destination:"club"}});},
 reportText(p:Partial<ReportDraft>){if(state.report&&!state.busy&&!state.pending)patch({report:{...state.report,...p}});},
 close(){if(state.busy||state.pending)return;patch({draft:null,report:null,conflict:false,error:null});},
 rebase(){if(state.draft&&state.data?.editorItem?.id===state.draft.id&&state.conflict&&!state.busy&&!state.pending)patch({draft:{...state.draft,version:state.data.editorItem.version},conflict:false,error:null});},
 submit(){
  const d=state.draft;
  if(!d)return Promise.resolve(false);
  const base={actorId:options.actor,clubId:options.clubId};
  const image=d.image?{source:d.image.source,frame:d.image.frame}:d.image;
  if(d.id)return run({...base,type:"change",kind:d.kind,id:d.id,action:"edit",body:d.text,version:d.version??undefined,
   ...(image!==undefined?{image,imageRequest:options.key()}:{}),
  });
  return run({...base,type:"create",id:d.key,post:d.kind==="comment"?d.post:null,body:d.text,...(image?{image}:{})});
 },
 submitReport(){const r=state.report;return r?run({actorId:options.actor,clubId:options.clubId,type:"report",...r}):Promise.resolve(false);},
 run,retry(){return state.pending?run(state.pending,true):Promise.resolve(false);}
 };
}
export type ContentStore=ReturnType<typeof createContentStore>;
