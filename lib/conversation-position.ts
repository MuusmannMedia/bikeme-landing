// Presentation coordinates only. Never retain message bodies, names or drafts.
export type ReadingPosition={top:number;bottom:boolean;anchor:string|null;offset:number};
export function readingTop(saved:ReadingPosition,metrics:{height:number;viewport:number;anchorTop:number|null},followBottom=false){
 const max=Math.max(0,metrics.height-metrics.viewport);
 const top=followBottom||saved.bottom?max:metrics.anchorTop===null?saved.top:metrics.anchorTop-saved.offset;
 return Math.max(0,Math.min(max,top));
}

export function readingIntent(type:string,key='',editable=false):'scroll'|'focus'{return type==='wheel'||type==='touchmove'||type==='keydown'&&!editable&&['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(key)?'scroll':'focus';}
