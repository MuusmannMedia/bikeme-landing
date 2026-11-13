import {ClubError} from './membership-types';
import {CLUB_IMAGE_SOURCE_LIMIT,CLUB_IMAGE_LIMIT,type ImageSlot} from './image-contract';
export function imageSourceDimensions(bytes:Uint8Array){
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&bytes.length>=24)return{width:d.getUint32(16),height:d.getUint32(20)};
 if(bytes[0]===255&&bytes[1]===216){let offset=2;while(offset+4<=bytes.length){if(bytes[offset]!==255)throw new ClubError('image');while(bytes[offset]===255)offset++;if(offset>=bytes.length)throw new ClubError('image');const marker=bytes[offset++];if(marker===217||marker===218)break;if(marker===216||marker===1||(marker>=208&&marker<=215))continue;if(offset+2>bytes.length)throw new ClubError('image');const length=d.getUint16(offset);if(length<2||offset+length>bytes.length)throw new ClubError('image');if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7)return{height:d.getUint16(offset+3),width:d.getUint16(offset+5)};offset+=length;}}
 throw new ClubError('image');
}
export async function normalizeImageForBrowser(file:Blob,slot:ImageSlot,signal:AbortSignal){
 if(!file.size||file.size>CLUB_IMAGE_SOURCE_LIMIT)throw new ClubError('image');const bytes=new Uint8Array(await file.arrayBuffer()),size=imageSourceDimensions(bytes);if(!size.width||!size.height||size.width*size.height>50_000_000)throw new ClubError('image');if(signal.aborted)throw new ClubError('network');
 let bitmap:ImageBitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw new ClubError('image');}
 const canvas=document.createElement('canvas');try{const max=slot==='logo'?512:1600,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const c=canvas.getContext('2d');if(!c)throw new ClubError('image');if(slot==='cover'){c.fillStyle='#080e18';c.fillRect(0,0,canvas.width,canvas.height);}c.drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,slot==='logo'?'image/png':'image/jpeg',.85));if(signal.aborted)throw new ClubError('network');if(!blob||blob.size>CLUB_IMAGE_LIMIT)throw new ClubError('image');return blob;}finally{bitmap.close();canvas.width=0;canvas.height=0;}
}
