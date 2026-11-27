'use client';
import Link from 'next/link';
import {useLayoutEffect,useRef} from 'react';
// Keep the selected mobile tab visible by scrolling only this navigation strip.
// App activation does not rerun this effect or move the document/reading position.
export function ClubNavigation({label,selected,links}:{label:string;selected:string;links:{key:string;href:string;label:string}[]}){
 const ref=useRef<HTMLElement>(null);
 useLayoutEffect(()=>{const nav=ref.current;if(!nav)return;const reveal=()=>{const current=nav.querySelector<HTMLElement>('[aria-current="page"]');if(!current)return;const outer=nav.getBoundingClientRect(),inner=current.getBoundingClientRect();if(inner.left<outer.left)nav.scrollLeft-=outer.left-inner.left+8;else if(inner.right>outer.right)nav.scrollLeft+=inner.right-outer.right+8;};reveal();const observer=new ResizeObserver(reveal);observer.observe(nav);return()=>observer.disconnect();},[selected]);
 return <nav ref={ref} className="bike-app-club-nav" aria-label={label}>{links.map(link=><Link prefetch={false} key={link.key} href={link.href} aria-current={selected===link.key?'page':undefined}>{link.label}</Link>)}</nav>;
}
