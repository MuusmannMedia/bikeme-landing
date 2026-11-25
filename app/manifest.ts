import type {MetadataRoute} from 'next';
import { BRAND_PURPLE } from '@/lib/site-config';
export default function manifest():MetadataRoute.Manifest{return{id:'/',name:'Bike Me',short_name:'Bike Me',start_url:'/da/app',scope:'/',display:'standalone',background_color:'#0a0f18',theme_color:BRAND_PURPLE,icons:[{src:'/brand/bike-me-logo-white.png',sizes:'1024x1024',type:'image/png',purpose:'any'}]};}
