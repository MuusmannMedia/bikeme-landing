// One authorization cycle per activation. Retaining presentation never grants
// access: callers still purge on failed verification, identity/revision changes.
export function createAccessRefresh(o:{visible:()=>boolean;focused:()=>boolean;pause:()=>void;verify:()=>Promise<void>;retain?:()=>void;settled?:()=>void;schedule?:(fn:()=>void)=>()=>void}){
 let active=false,disposed=false,cycle=0,checking=false,cancel:(()=>void)|null=null,tail:Promise<void>=Promise.resolve();
 const schedule=o.schedule??(fn=>{const id=setTimeout(fn,0);return()=>clearTimeout(id);});
 function suspend(){if(disposed)return;active=false;cycle++;cancel?.();cancel=null;checking=false;o.pause();}
 function deactivate(){if(!o.retain){suspend();return;}if(disposed)return;active=false;cycle++;cancel?.();cancel=null;checking=false;o.retain();}
 function check(){
  if(disposed)return;if(!o.visible()||!o.focused()){if(active||checking)deactivate();return;}if(checking)return;
  active=true;checking=true;const v=++cycle;(o.retain??o.pause)();
  cancel=schedule(()=>{cancel=null;
   const run=async()=>{if(disposed||v!==cycle||!o.visible()||!o.focused())return;try{await o.verify();}finally{if(v===cycle&&!disposed){checking=false;o.settled?.();}}};
   // A return cannot overlap an older activation. Its fresh check runs AFTER it.
   if(o.retain)tail=tail.then(run,run);else void run();
  });
 }
 return{check,resume(){if(!active)check();},deactivate,suspend,stop(){disposed=true;cycle++;cancel?.();cancel=null;checking=false;},get checking(){return checking;}};
}
