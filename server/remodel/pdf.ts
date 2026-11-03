import {PDFDocument,rgb,type PDFFont,type PDFPage,type PDFImage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import sharp from 'sharp';
const require=createRequire(import.meta.url);
const green=rgb(.09,.235,.173),ink=rgb(.1,.23,.18),sage=rgb(.91,.94,.89),paper=rgb(.98,.98,.955),muted=rgb(.34,.42,.37);
type Input={project:{name:string;address:string};company:{name:string;address?:string;phone?:string;license?:string;logo?:string};before:Buffer;after:Buffer;brief:string;createdAt:string;colorStudy?:boolean};
function wrap(text:string,font:PDFFont,size:number,width:number){
 const allowed=new Set(font.getCharacterSet());const clean=Array.from(text.replace(/\s+/g,' ').trim()).map(c=>allowed.has(c.codePointAt(0)!)?c:'?').join('');
 const lines:string[]=[];let line='';
 for(const word of clean.split(' ')){const parts:string[]=[];let part='';for(const ch of word){if(part&&font.widthOfTextAtSize(part+ch,size)>width){parts.push(part);part=ch;}else part+=ch;}if(part)parts.push(part);for(const value of parts){const next=line?line+' '+value:value;if(font.widthOfTextAtSize(next,size)>width&&line){lines.push(line);line=value;}else line=next;}}
 if(line)lines.push(line);return lines;
}
function lines(page:PDFPage,text:string,font:PDFFont,size:number,x:number,y:number,width:number,color=ink,max=Infinity){const values=wrap(text,font,size,width);for(const [i,line]of values.slice(0,max).entries())page.drawText(line,{x,y:y-i*(size+5),size,font,color});return values;}
function fit(page:PDFPage,image:PDFImage,x:number,y:number,w:number,h:number){const scale=Math.min(w/image.width,h/image.height);page.drawRectangle({x,y,width:w,height:h,color:sage});page.drawImage(image,{x:x+(w-image.width*scale)/2,y:y+(h-image.height*scale)/2,width:image.width*scale,height:image.height*scale});}
export async function conceptPdf(input:Input):Promise<Buffer>{
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const [regular,bold]=await Promise.all([400,700].map(async weight=>doc.embedFont(await readFile(require.resolve(`@fontsource/manrope/files/manrope-latin-${weight}-normal.woff`)),{subset:true})));
 const images=await Promise.all([input.before,input.after].map(async bytes=>doc.embedJpg(await sharp(bytes,{limitInputPixels:40000000}).flatten({background:'#fff'}).resize({width:1400,height:1100,fit:'inside',withoutEnlargement:true}).jpeg({quality:90}).toBuffer())));
 doc.setTitle(input.project.name+' - Before and after concept');doc.setAuthor(input.company.name);doc.setSubject('Property photo and renovation concept. Signed agreement unchanged.');
 const header=(page:PDFPage,label:string)=>{page.drawRectangle({x:0,y:645,width:612,height:147,color:green});lines(page,input.company.name,bold,13,36,754,460,rgb(1,1,1),1);page.drawText(label,{x:36,y:728,size:9,font:regular,color:rgb(.78,.87,.76)});lines(page,input.project.name,bold,23,36,697,540,rgb(1,1,1),2);lines(page,input.project.address||'Your property',regular,9,36,655,540,rgb(.86,.92,.85),1);};
 const footer=(page:PDFPage,n:number,total:number)=>{page.drawLine({start:{x:36,y:54},end:{x:576,y:54},thickness:.6,color:sage});lines(page,[input.company.phone,input.company.address].filter(Boolean).join('  |  '),regular,8,36,39,470,muted,1);page.drawText(`PREMIUM+ COMMERCIAL  /  ${n} of ${total}`,{x:421,y:24,size:7,font:regular,color:muted});};
 const page=doc.addPage([612,792]);page.drawRectangle({x:0,y:0,width:612,height:792,color:paper});header(page,'YOUR PROPERTY. A NEW POSSIBILITY.');
 if(input.company.logo?.startsWith('data:image/png;base64,')){try{const logo=await doc.embedPng(Buffer.from(input.company.logo.split(',')[1],'base64'));const scale=Math.min(34/logo.width,34/logo.height);page.drawImage(logo,{x:542,y:744,width:logo.width*scale,height:logo.height*scale});}catch{/* An invalid legacy logo must not prevent exporting the actual photos. */}}
 page.drawText('BEFORE',{x:36,y:620,size:10,font:bold,color:ink});page.drawText('Your original property photo',{x:98,y:620,size:9,font:regular,color:muted});fit(page,images[0],36,412,540,196);
 page.drawText('AFTER',{x:36,y:390,size:10,font:bold,color:ink});page.drawText(input.colorStudy?'Local color study — not photorealistic':'Concept created from the marked area',{x:91,y:390,size:9,font:regular,color:muted});fit(page,images[1],36,182,540,196);
 page.drawText('THE CHANGES YOU ENVISION',{x:36,y:156,size:9,font:bold,color:ink});const brief=input.brief||'Renovation concept for the marked area of this property.';const noteLines=lines(page,brief,regular,9,36,138,540,ink,3);
 lines(page,'Visual concept for discussion. Your signed agreement is unchanged.',regular,8,36,76,540,muted,1);
 if(noteLines.length>3){
  const full=wrap(brief,regular,11,540);
  for(let offset=0;offset<full.length;offset+=33){const notes=doc.addPage([612,792]);notes.drawRectangle({x:0,y:0,width:612,height:792,color:paper});header(notes,'YOUR REQUESTED CHANGES');full.slice(offset,offset+33).forEach((line,i)=>notes.drawText(line,{x:36,y:608-i*16,size:11,font:regular,color:ink}));}
  lines(page,'Full project notes continue on the next page.',regular,8,36,88,540,muted,1);
 }
 const pages=doc.getPages();pages.forEach((p,i)=>footer(p,i+1,pages.length));return Buffer.from(await doc.save());
}
