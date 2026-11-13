// A valid PNG with a harmless text chunk permits exact byte-boundary tests
// without huge decoded images or malformed padding.
export function padPng(png:Buffer,total:number){
 const length=total-png.length-12;if(length<3)throw Error('PNG fixture too small');const type=Buffer.from('tEXt'),data=Buffer.alloc(length,65);data.write('QA\0');
 let crc=0xffffffff;for(const byte of Buffer.concat([type,data])){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 const header=Buffer.alloc(4),tail=Buffer.alloc(4);header.writeUInt32BE(length);tail.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([png.subarray(0,-12),header,type,data,tail,png.subarray(-12)]);
}
