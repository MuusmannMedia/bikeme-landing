// One authorization cycle per activation. No successful-access cache or grace period.
export function createAccessRefresh(o:{visible:()=>boolean;focused:()=>boolean;pause:()=>void;verify:()=>Promise<void>;schedule?:(fn:()=>void)=>()=>void}){
 let active=false,disposed=false,cycle=0,checking=false,cancel:(()=>void)|null=null;
 const schedule=o.schedule??(fn=>{const id=setTimeout(fn,0);return()=>clearTimeout(id);});
 function suspend(){if(disposed)return;active=false;cycle++;cancel?.();cancel=null;checking=false;o.pause();}
 function check(){if(disposed)return;if(!o.visible()||!o.focused()){if(active||checking)suspend();return;}if(checking)return;active=true;checking=true;const v=++cycle;o.pause();cancel=schedule(()=>{cancel=null;void o.verify().finally(()=>{if(v===cycle)checking=false;});});}
 return{check,resume(){if(!active)check();},suspend,stop(){disposed=true;cycle++;cancel?.();cancel=null;checking=false;},get checking(){return checking;}};
}
