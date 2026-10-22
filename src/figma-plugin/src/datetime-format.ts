// PBDateTime.Pattern is a .NET custom date/time format string. The panel shows
// the current time; Figma shows the same pattern rendered at a fixed sample,
// the preview GUI Designer 1.28 itself displays (September 28, 12:00 AM).
// No Figma types here: the UI bundle uses the same catalog and preview.
export interface DateTimeFormat {name:string;pattern:string;group:'Date & time'|'Time'|'Date';guiDesigner:boolean}
export interface DateTimeSample {year:number;month:number;day:number;hour:number;minute:number;second:number}
export const DATETIME_SAMPLE:DateTimeSample={year:2026,month:9,day:28,hour:0,minute:0,second:0};

// Variant values in Figma cannot contain ',' or '=', hence descriptive names.
// GUI Designer presets come from its Pattern list (Extron.GUICPro resources).
// Order matters: a preview shared by two patterns resolves to the earlier one.
export const DATETIME_FORMATS:readonly DateTimeFormat[]=[
  {name:'Month day time 12h',pattern:'MMMM d, h:mm tt',group:'Date & time',guiDesigner:false},
  {name:'Weekday date time 12h',pattern:'dddd, MMMM dd, yyyy h:mm tt',group:'Date & time',guiDesigner:true},
  {name:'Weekday date time 12h seconds',pattern:'dddd, MMMM dd, yyyy h:mm:ss tt',group:'Date & time',guiDesigner:true},
  {name:'Weekday date time 24h seconds',pattern:'dddd, dd MMMM yyyy HH:mm:ss',group:'Date & time',guiDesigner:true},
  {name:'US date time 12h',pattern:'M/d/yyyy h:mm tt',group:'Date & time',guiDesigner:true},
  {name:'US date time 12h seconds',pattern:'M/d/yyyy h:mm:ss tt',group:'Date & time',guiDesigner:true},
  {name:'Dotted date time 24h',pattern:'dd.MM.yyyy HH:mm',group:'Date & time',guiDesigner:false},
  {name:'Time 12h',pattern:'h:mm tt',group:'Time',guiDesigner:true},
  {name:'Time 12h padded',pattern:'hh:mm tt',group:'Time',guiDesigner:true},
  {name:'Time 24h',pattern:'H:mm',group:'Time',guiDesigner:true},
  {name:'Time 24h padded',pattern:'HH:mm',group:'Time',guiDesigner:true},
  {name:'Time 12h seconds',pattern:'h:mm:ss tt',group:'Time',guiDesigner:true},
  {name:'Time 12h seconds padded',pattern:'hh:mm:ss tt',group:'Time',guiDesigner:true},
  {name:'Time 24h seconds',pattern:'H:mm:ss',group:'Time',guiDesigner:true},
  {name:'Time 24h seconds padded',pattern:'HH:mm:ss',group:'Time',guiDesigner:true},
  {name:'Weekday month day year',pattern:'dddd, MMMM dd, yyyy',group:'Date',guiDesigner:true},
  {name:'Month day year',pattern:'MMMM dd, yyyy',group:'Date',guiDesigner:true},
  {name:'Weekday day month year',pattern:'dddd, dd MMMM, yyyy',group:'Date',guiDesigner:true},
  {name:'Day month year',pattern:'dd MMMM, yyyy',group:'Date',guiDesigner:true},
  {name:'Weekday month day',pattern:'dddd, MMMM d',group:'Date',guiDesigner:false},
  {name:'US date',pattern:'M/d/yyyy',group:'Date',guiDesigner:true},
  {name:'US date short year',pattern:'M/d/yy',group:'Date',guiDesigner:true},
  {name:'US date padded',pattern:'MM/dd/yyyy',group:'Date',guiDesigner:true},
  {name:'US date padded short year',pattern:'MM/dd/yy',group:'Date',guiDesigner:true},
  {name:'Year month day short',pattern:'yy/MM/dd',group:'Date',guiDesigner:true},
  {name:'ISO date',pattern:'yyyy-MM-dd',group:'Date',guiDesigner:true},
  {name:'Day month abbreviation year',pattern:'dd-MMM-yy',group:'Date',guiDesigner:true},
  {name:'Dotted date',pattern:'dd.MM.yyyy',group:'Date',guiDesigner:false},
];

const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const TOKENS='dMyhHmstfFgzK';
class PatternError extends Error {}
const pad=(value:number,length:number)=>String(value).padStart(length,'0');

// Invariant-culture subset of DateTimeFormat.FormatCustomized. Time zone
// tokens have no fixed value on the panel and render as UTC.
export function formatDateTime(pattern:string,at:DateTimeSample=DATETIME_SAMPLE):string {
  const weekday=new Date(Date.UTC(at.year,at.month-1,at.day)).getUTCDay(),hour12=at.hour%12||12;
  let out='';
  const token=(ch:string,n:number)=>{
    switch(ch){
      case 'd':out+=n<=2?pad(at.day,n):n===3?DAYS[weekday].slice(0,3):DAYS[weekday];break;
      case 'M':out+=n<=2?pad(at.month,n):n===3?MONTHS[at.month-1].slice(0,3):MONTHS[at.month-1];break;
      case 'y':out+=n<=2?pad(at.year%100,n):pad(at.year,n);break;
      case 'h':out+=pad(hour12,Math.min(n,2));break;
      case 'H':out+=pad(at.hour,Math.min(n,2));break;
      case 'm':out+=pad(at.minute,Math.min(n,2));break;
      case 's':out+=pad(at.second,Math.min(n,2));break;
      case 't':{const designator=at.hour<12?'AM':'PM';out+=n===1?designator[0]:designator;break;}
      case 'f':if(n>7)throw new PatternError();out+='0'.repeat(n);break;
      case 'F':if(n>7)throw new PatternError();if(out.endsWith('.'))out=out.slice(0,-1);break;
      case 'g':out+='A.D.';break;
      case 'z':out+=n===1?'+0':n===2?'+00':'+00:00';break;
      case 'K':break;
    }
  };
  for(let i=0;i<pattern.length;){
    const ch=pattern[i];
    if(TOKENS.includes(ch)){let n=1;while(pattern[i+n]===ch)n++;token(ch,n);i+=n;}
    else if(ch==="'"||ch==='"'){
      let j=i+1,closed=false;
      while(j<pattern.length){if(pattern[j]===ch){closed=true;break;}if(pattern[j]==='\\'){if(++j>=pattern.length)break;}out+=pattern[j++];}
      if(!closed)throw new PatternError();i=j+1;
    }else if(ch==='%'){
      const next=pattern[i+1];if(next===undefined||next==='%')throw new PatternError();
      if(TOKENS.includes(next))token(next,1);else out+=formatDateTime(next,at);i+=2;
    }else if(ch==='\\'){if(i+1>=pattern.length)throw new PatternError();out+=pattern[i+1];i+=2;}
    else{out+=ch;i++;}
  }
  return out;
}

// Letters outside quotes and escapes; a pattern spells only format tokens.
function unquoted(pattern:string):string {return pattern.replace(/'[^']*'|"[^"]*"|\\./g,'');}
export function patternProblem(pattern:string):string|null {
  if(pattern.length<2||pattern.length>100)return 'нужно 2..100 символов';
  if(/[\r\n\0]/.test(pattern))return 'перевод строки недопустим';
  try{formatDateTime(pattern);}catch{return 'незакрытые кавычки или неполное экранирование';}
  if(!/[dMyhHms]/.test(unquoted(pattern)))return 'нет ни одного элемента даты или времени (d, M, y, h, H, m, s)';
  return null;
}
// Old designs keep the pattern itself in the text, e.g. "HH:mm".
export function isPatternText(value:string):boolean {
  const bare=unquoted(value);
  return patternProblem(value)===null&&!/[0-9]/.test(bare)&&[...bare].every(ch=>!/[A-Za-z]/.test(ch)||TOKENS.includes(ch));
}
export function formatForPreview(text:string):DateTimeFormat|undefined {
  const value=text.trim();return DATETIME_FORMATS.find(f=>formatDateTime(f.pattern)===value);
}

// Kit variants share the Text name "Content", so switching Format keeps the
// instance's text style overrides; the variant value names the pattern.
export const FORMAT_PROPERTY='Format';
export function variantPattern(value:string|undefined):string|null {return DATETIME_FORMATS.find(f=>f.name===value)?.pattern??null;}
// A custom pattern: name the Text inside a component "Pattern: <format>".
export const PATTERN_LAYER_PREFIX='Pattern: ';
export function layerPattern(name:string):string|null {const match=/^\s*pattern\s*:\s*(.+?)\s*$/i.exec(name);return match?match[1]:null;}

// Owner-bound like the manual key: a copy does not inherit a typed pattern.
export const MANUAL_PATTERN='exui-pattern-manual';
export function hasManualPattern(node:{id:string;getPluginData(key:string):string}):boolean {return node.getPluginData(MANUAL_PATTERN)===node.id;}

export type PatternSource='manual'|'layer'|'variant'|'preview'|'saved'|'text';
export interface ResolvedPattern {pattern:string;source:PatternSource;preview:string}
export interface PatternInput {text:{name:string;characters:string};wrapped:boolean;variant?:string;saved?:string;manual:boolean}
// The design decides unless the pattern was typed in the form. A legacy
// saved pattern wins only over the legacy "text is the pattern" rule.
export function resolvePattern(input:PatternInput):ResolvedPattern|{error:string} {
  const done=(pattern:string,source:PatternSource):ResolvedPattern|{error:string}=>{const problem=patternProblem(pattern);return problem?{error:`формат «${pattern}»: ${problem}.`}:{pattern,source,preview:formatDateTime(pattern)};};
  if(input.manual&&input.saved)return done(input.saved,'manual');
  const named=input.wrapped?layerPattern(input.text.name):null;if(named!==null)return done(named,'layer');
  const variant=variantPattern(input.variant);if(variant)return done(variant,'variant');
  const preset=formatForPreview(input.text.characters);if(preset)return done(preset.pattern,'preview');
  if(input.saved)return done(input.saved,'saved');
  if(isPatternText(input.text.characters))return done(input.text.characters,'text');
  return {error:`текст «${input.text.characters}» не является форматом даты/времени и не совпадает с примером из каталога (например, «${formatDateTime(DATETIME_FORMATS[0].pattern)}»). Возьмите datetime_Clock из Extron Kit, назовите Text-слой «${PATTERN_LAYER_PREFIX}HH:mm» или задайте формат в поле «Формат даты/времени».`};
}
