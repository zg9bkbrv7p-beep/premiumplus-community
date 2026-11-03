export function documentCategory(mime:string,choice?:'photo'|'document'|'warranty'):'photo'|'document'|'warranty'{
 if(choice==='warranty')return 'warranty';
 if(!mime.startsWith('image/'))return 'document';
 return choice||'photo';
}
