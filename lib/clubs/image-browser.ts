import {ClubError} from './membership-types';
import {GalleryError} from './gallery-contract';
import {CLUB_IMAGE_SOURCE_LIMIT,CLUB_IMAGE_LIMIT,type ImageSlot} from './image-contract';
export function imageSourceDimensions(bytes:Uint8Array){
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&bytes.length>=24)return{width:d.getUint32(16),height:d.getUint32(20)};
 if(bytes[0]===255&&bytes[1]===216){let offset=2;while(offset+4<=bytes.length){if(bytes[offset]!==255)throw new ClubError('image');while(bytes[offset]===255)offset++;if(offset>=bytes.length)throw new ClubError('image');const marker=bytes[offset++];if(marker===217||marker===218)break;if(marker===216||marker===1||(marker>=208&&marker<=215))continue;if(offset+2>bytes.length)throw new ClubError('image');const length=d.getUint16(offset);if(length<2||offset+length>bytes.length)throw new ClubError('image');if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7)return{height:d.getUint16(offset+3),width:d.getUint16(offset+5)};offset+=length;}}
 throw new ClubError('image');
}
// Check the source before a browser decoder can repair a truncated file
// or flatten an animated PNG into an apparently valid static JPEG.
export function requireCompleteStaticImage(bytes: Uint8Array) {
 if (bytes[0] === 255 && bytes[1] === 216) {
  if (bytes.at(-2) !== 255 || bytes.at(-1) !== 217) throw new ClubError("image");
  return;
 }
 const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
 for (let offset = 8; offset + 12 <= bytes.length;) {
  const length = data.getUint32(offset);
  const type = data.getUint32(offset + 4);
  const end = offset + 12 + length;
  if (end > bytes.length || type === 0x6163544c) throw new ClubError("image"); // acTL
  if (type === 0x49454e44 && length === 0 && end === bytes.length) return; // IEND
  offset = end;
 }
 throw new ClubError("image");
}

export async function normalizeImageForBrowser(
 file: Blob, slot: ImageSlot, signal: AbortSignal,
 options?: { maxBytes: number; maxPixels: number; maxEdge: number },
) {
 if (!file.size || file.size > CLUB_IMAGE_SOURCE_LIMIT) throw new ClubError('image');
 const bytes = new Uint8Array(await file.arrayBuffer());
 const size = imageSourceDimensions(bytes);
 if (!size.width || !size.height || size.width * size.height > (options?.maxPixels ?? 50_000_000)) {
  throw new ClubError('image');
 }
 signal.throwIfAborted();

 // A small JPEG can travel as-is. Sharp still validates, orients and strips it.
 if (options) {
  requireCompleteStaticImage(bytes);
  if (bytes[0] === 255 && bytes[1] === 216 && file.size <= options.maxBytes &&
      Math.max(size.width, size.height) <= options.maxEdge) {
   return file.type === 'image/jpeg' ? file : file.slice(0, file.size, 'image/jpeg');
  }
 }

 let bitmap: ImageBitmap;
 try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
 catch { throw new ClubError('image'); }

 const canvas = document.createElement('canvas');
 const limit = options?.maxBytes ?? CLUB_IMAGE_LIMIT;
 const edge = options?.maxEdge ?? (slot === 'logo' ? 512 : 1600);
 const type = slot === 'logo' ? 'image/png' : 'image/jpeg';
 try {
  const draw = (longest: number) => {
   const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
   canvas.width = Math.max(1, Math.round(bitmap.width * scale));
   canvas.height = Math.max(1, Math.round(bitmap.height * scale));
   const context = canvas.getContext('2d');
   if (!context) throw new ClubError('image');
   if (slot === 'cover') {
    context.fillStyle = '#080e18';
    context.fillRect(0, 0, canvas.width, canvas.height);
   }
   if (options) context.imageSmoothingQuality = 'high';
   context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  };
  const encode = async (quality: number) => {
   signal.throwIfAborted();
   const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
   signal.throwIfAborted();
   if (!blob || blob.type !== type) throw new ClubError('image');
   return blob;
  };

  draw(edge);
  let blob = await encode(options ? .82 : .85);
  if (options && blob.size > limit) {
   blob = await encode(.72);
   for (const scale of [.8, .64]) {
    if (blob.size <= limit) break;
    draw(Math.floor(edge * scale));
    blob = await encode(.76);
   }
  }
  if (blob.size > limit) throw options ? new GalleryError('size') : new ClubError('image');
  return blob;
 } finally {
  bitmap.close();
  canvas.width = 0;
  canvas.height = 0;
 }
}
