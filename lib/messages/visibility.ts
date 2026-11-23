// A row/date in the viewport is insufficient: its message text must be painted
// above sticky navigation and other overlays inside the conversation viewport.
export function visibleIncomingIds(doc:Document,viewport:{width:number;height:number}):string[]{
 const ids=new Set<string>();
 for(const row of doc.querySelectorAll<HTMLElement>('[data-seen-incoming]')){
  const body=row.querySelector<HTMLElement>('.bike-message-body');
  if(!body||!body.getClientRects().length||body.checkVisibility&&!body.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}))continue;
  if(!body.checkVisibility){let hidden=false;for(let node:HTMLElement|null=body;node;node=node.parentElement){const css=doc.defaultView?.getComputedStyle(node);if(css&&(css.visibility!=='visible'||Number(css.opacity)===0)){hidden=true;break;}}if(hidden)continue;}
  const b=body.getBoundingClientRect(),h=row.closest('.bike-app-chat-scroll')?.getBoundingClientRect();
  const top=Math.max(0,b.top,h?.top??0),bottom=Math.min(viewport.height,b.bottom,h?.bottom??viewport.height),left=Math.max(0,b.left,h?.left??0),right=Math.min(viewport.width,b.right,h?.right??viewport.width);
  if(bottom<=top||bottom-top<Math.min(8,b.height)||right<=left)continue;
  const insetX=Math.min(4,(right-left)/2),insetY=Math.min(4,(bottom-top)/2);
  const shown=[top+insetY,(top+bottom)/2,bottom-insetY].some(y=>[left+insetX,(left+right)/2,right-insetX].some(x=>{const hit=doc.elementFromPoint(x,y);return !!hit&&body.contains(hit);}));
  if(shown&&row.dataset.seenIncoming)ids.add(row.dataset.seenIncoming);
 }
 return [...ids];
}
