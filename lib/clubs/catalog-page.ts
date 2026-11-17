import {searchClubCatalog} from './catalog-search';
export const CATALOG_PAGE_SIZE=20;
export function clubCatalogPage<T extends {id:string;name:string}>(rows:T[],query:string,page:number){
 const matches=searchClubCatalog(rows,query),pages=Math.max(1,Math.ceil(matches.length/CATALOG_PAGE_SIZE));
 const current=Math.max(0,Math.min(Number.isSafeInteger(page)?page:0,pages-1));
 return{matches,entries:matches.slice(current*CATALOG_PAGE_SIZE,(current+1)*CATALOG_PAGE_SIZE),page:current,pages};
}
