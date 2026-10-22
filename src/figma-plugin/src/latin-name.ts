import { fail } from './model.ts';

// Layer names of screens, popups, groups and elements become Extron keys, so
// they must be Latin. Visible text inside the layers may stay Russian.
const CYRILLIC=/[Ѐ-ԯ]/;
const TRANSLIT:Record<string,string>={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
const PREFIX=/^((?:scr|screen|pop|popup|mdl|modalpopup|pgrp|popupgroup|prj|project|[a-z]+)_)/i;

export function hasCyrillic(name:string):boolean {return CYRILLIC.test(name);}
export function latinExample(name:string,fallbackPrefix:string):string {
  const prefix=PREFIX.exec(name)?.[1]??fallbackPrefix;
  const words=name.slice(PREFIX.exec(name)?.[1].length??0).split(/[^A-Za-z0-9Ѐ-ԯ]+/).filter(Boolean);
  const latin=words.map(word=>[...word].map(c=>{const lower=c.toLowerCase(),t=TRANSLIT[lower];return t===undefined?(/[A-Za-z0-9]/.test(c)?c:''):c===lower?t:t.charAt(0).toUpperCase()+t.slice(1);}).join('')).filter(Boolean).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join('');
  return prefix+(/^[A-Za-z]/.test(latin)?latin:'Name');
}
export function requireLatinName(node:{id:string;name:string},fallbackPrefix:string):void {
  if(!hasCyrillic(node.name))return;
  fail('name',`${node.name}: русские буквы в имени слоя не допускаются — из имени строится ключ Extron. Переименуйте слой латиницей, например ${latinExample(node.name,fallbackPrefix)}. Видимый текст может оставаться русским.`,node);
}
