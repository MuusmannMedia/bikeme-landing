// Legacy club URLs still belong to My clubs. The catalog is its own destination.
export function isAppNavActive(pathname:string,href:string,visitor=false){
 if(visitor&&href.endsWith("/clubs/mine"))return false;
 if(visitor&&href.endsWith("/clubs/all"))return true;
 if(href.endsWith('/clubs/mine')){const base=href.slice(0,-5);return pathname===base||pathname===href||pathname.startsWith(base+'/')&&!pathname.startsWith(base+'/all');}
 if(href.endsWith('/clubs/all'))return pathname===href;
 return pathname===href||(href.split('/').length>=4&&pathname.startsWith(href+'/'));
}
