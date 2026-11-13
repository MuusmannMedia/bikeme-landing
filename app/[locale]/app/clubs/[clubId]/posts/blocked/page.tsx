import {notFound} from "next/navigation";
import {ClubContentBoundary} from "@/components/clubs/club-content-boundary";
import {clubPageContext} from "@/lib/clubs/server";
import {isLocale} from "@/lib/locales";
export const dynamic="force-dynamic";
export default async function ContentPage({params,searchParams}:{params:Promise<{locale:string;clubId:string;postId?:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {locale,clubId,postId}=await params;if(!isLocale(locale))notFound();
 const values=await searchParams,q=new URLSearchParams();
 for(const key of ["beforeTime","beforeId","beforePinned","afterTime","afterId","closed"]){const value=values[key];if(typeof value==="string"&&value.length<120)q.set(key,value);}
 const suffix='/blocked';
 const path=`/${locale}/app/clubs/${encodeURIComponent(clubId)}/posts`+'/blocked';
 const {userId}=await clubPageContext(locale,path+(q.size?`?${q}`:""));q.set("mode","blocked");if(postId)q.set("postId",postId);
 return <ClubContentBoundary key={userId+clubId+q.toString()} userId={userId} clubId={clubId} locale={locale} query={q.toString()}/>;
}
