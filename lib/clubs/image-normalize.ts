import sharp from 'sharp';
import {ClubError} from './membership-types';
import {CLUB_IMAGE_LIMIT,CLUB_IMAGE_SOURCE_LIMIT,type ImageSlot} from './image-contract';
async function decode(bytes:Uint8Array,limit:number){
 if(!bytes.byteLength||bytes.byteLength>limit)throw new ClubError('image');
 const png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if(!png&&!jpeg)throw new ClubError('image');
 try{const input=sharp(bytes,{limitInputPixels:50_000_000,failOn:'warning'}),m=await input.metadata();if(!['jpeg','png'].includes(m.format??'')||!m.width||!m.height||(m.pages??1)!==1)throw new Error('format');return{input,m};}catch{throw new ClubError('image');}
}
export async function normalizeClubImage(bytes:Uint8Array,slot:ImageSlot){
 const{input}=await decode(bytes,CLUB_IMAGE_SOURCE_LIMIT),max=slot==='logo'?512:1600;
 try{let p=input.rotate().resize({width:max,height:max,fit:'inside',withoutEnlargement:true});p=slot==='logo'?p.png():p.flatten({background:'#080e18'}).jpeg({quality:85});const r=await p.toBuffer({resolveWithObject:true});if(r.data.length>CLUB_IMAGE_LIMIT)throw new Error('size');return{bytes:r.data,width:r.info.width,height:r.info.height,type:slot==='logo'?'image/png':'image/jpeg'};}catch{throw new ClubError('image');}
}
export async function validateStoredClubImage(bytes:Uint8Array,slot:ImageSlot){
 const{input,m}=await decode(bytes,CLUB_IMAGE_LIMIT);const max=slot==='logo'?512:1600;
 if(m.format!==(slot==='logo'?'png':'jpeg')||(m.orientation??1)!==1||(m.width??0)>max||(m.height??0)>max)throw new ClubError('image');
 try{await input.raw().toBuffer();}catch{throw new ClubError('image');}
}
