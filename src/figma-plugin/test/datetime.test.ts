import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { DATETIME_FORMATS,MANUAL_PATTERN,formatDateTime,isPatternText,patternProblem,resolvePattern } from '../src/datetime-format.ts';
import { recognize,applyRecognition } from '../src/recognize.ts';
import { capture,exportFrame } from '../src/export.ts';
import { createKit } from '../src/kit.ts';
import { tag } from '../src/demo.ts';
import { fakeFigma,icons } from './fake-figma.ts';
import { kitFixture } from './kit-fixture.ts';
import { expandedFixture,frame,label } from './expanded-fixture.ts';

// Rendered by .NET 10 DateTime.ToString(pattern, InvariantCulture) for
// 2026-09-28 00:00:00 — the preview GUI Designer 1.28 shows for Date/Time.
const DOTNET:[string,string][]=[
  ['MMMM d, h:mm tt','September 28, 12:00 AM'],['dddd, MMMM dd, yyyy h:mm tt','Monday, September 28, 2026 12:00 AM'],
  ['dddd, MMMM dd, yyyy h:mm:ss tt','Monday, September 28, 2026 12:00:00 AM'],['dddd, dd MMMM yyyy HH:mm:ss','Monday, 28 September 2026 00:00:00'],
  ['M/d/yyyy h:mm tt','9/28/2026 12:00 AM'],['M/d/yyyy h:mm:ss tt','9/28/2026 12:00:00 AM'],['dd.MM.yyyy HH:mm','28.09.2026 00:00'],
  ['h:mm tt','12:00 AM'],['hh:mm tt','12:00 AM'],['H:mm','0:00'],['HH:mm','00:00'],['h:mm:ss tt','12:00:00 AM'],['hh:mm:ss tt','12:00:00 AM'],
  ['H:mm:ss','0:00:00'],['HH:mm:ss','00:00:00'],['dddd, MMMM dd, yyyy','Monday, September 28, 2026'],['MMMM dd, yyyy','September 28, 2026'],
  ['dddd, dd MMMM, yyyy','Monday, 28 September, 2026'],['dd MMMM, yyyy','28 September, 2026'],['dddd, MMMM d','Monday, September 28'],
  ['M/d/yyyy','9/28/2026'],['M/d/yy','9/28/26'],['MM/dd/yyyy','09/28/2026'],['MM/dd/yy','09/28/26'],['yy/MM/dd','26/09/28'],
  ['yyyy-MM-dd','2026-09-28'],['dd-MMM-yy','28-Sep-26'],['dd.MM.yyyy','28.09.2026'],
  ['ddd d MMM yyyyy hhh:mmm:sss t','Mon 28 Sep 02026 12:00:00 A'],['\'Today\' dddd "at" HH\\:mm','Today Monday at 00:00'],['%d/%M','28/9'],
  ['HH:mm:ss.fff','00:00:00.000'],['HH:mm:ss.FFF','00:00:00'],['y yy yyy','26 26 2026'],['ddd, MMM d \'week\' \\W','Mon, Sep 28 week W'],
];

test('Preview matches .NET invariant formatting for every catalog pattern and edge tokens',()=>{
  for(const [pattern,expected] of DOTNET)assert.equal(formatDateTime(pattern),expected,pattern);
  for(const format of DATETIME_FORMATS)assert.ok(DOTNET.some(([p])=>p===format.pattern),format.pattern);
  assert.equal(new Set(DATETIME_FORMATS.map(f=>f.name)).size,DATETIME_FORMATS.length);
  assert.ok(DATETIME_FORMATS.every(f=>!/[,=]/.test(f.name)),'Figma variant values cannot hold , or =');
  assert.equal(DATETIME_FORMATS.filter(f=>f.guiDesigner).length,24);
});

test('Pattern validation and the legacy "text is the pattern" rule',()=>{
  assert.equal(patternProblem('MMMM d, h:mm tt'),null);
  for(const bad of ['H','Clock','\'HH:mm','HH:mm\\','x'.repeat(101)])assert.ok(patternProblem(bad),bad);
  for(const text of ['HH:mm','dd.MM.yyyy HH:mm','h \'Uhr\''])assert.ok(isPatternText(text),text);
  for(const text of ['12:45','Monday','September 28, 12:00 AM','Clock'])assert.equal(isPatternText(text),false,text);
});

test('Resolution order: typed form value, Pattern layer, Format variant, catalog preview, saved legacy, pattern text',()=>{
  const r=(name:string,characters:string,extra:{wrapped?:boolean;variant?:string;saved?:string;manual?:boolean}={})=>resolvePattern({text:{name,characters},wrapped:extra.wrapped??true,variant:extra.variant,saved:extra.saved,manual:extra.manual??false});
  assert.deepEqual(r('Pattern: HH:mm','September 28, 12:00 AM',{saved:'H:mm',manual:true}),{pattern:'H:mm',source:'manual',preview:'0:00'});
  assert.deepEqual(r('Pattern: HH:mm','September 28, 12:00 AM',{saved:'H:mm'}),{pattern:'HH:mm',source:'layer',preview:'00:00'});
  assert.deepEqual(r('pattern:dddd, d MMMM','x'),{pattern:'dddd, d MMMM',source:'layer',preview:'Monday, 28 September'});
  // A plain Text's own name is the element name, never a pattern carrier.
  assert.equal((r('Pattern: HH:mm','HH:mm:ss',{wrapped:false}) as {source:string}).source,'text');
  assert.deepEqual(r('Pattern: H:mm','12:00 AM',{variant:'Time 12h padded'}),{pattern:'H:mm',source:'layer',preview:'0:00'});
  // The variant disambiguates previews shared by two patterns.
  assert.deepEqual(r('Content','12:00 AM',{variant:'Time 12h padded'}),{pattern:'hh:mm tt',source:'variant',preview:'12:00 AM'});
  assert.equal((r('Content','12:00 AM',{variant:'Renamed by user'}) as {source:string}).source,'preview');
  assert.deepEqual(r('Content','September 28, 12:00 AM',{saved:'HH:mm'}),{pattern:'MMMM d, h:mm tt',source:'preview',preview:'September 28, 12:00 AM'});
  assert.equal((r('Content','12:00 AM') as {pattern:string}).pattern,'h:mm tt');
  assert.deepEqual(r('Content','HH:mm',{saved:'dd.MM.yyyy HH:mm'}),{pattern:'dd.MM.yyyy HH:mm',source:'saved',preview:'28.09.2026 00:00'});
  assert.equal((r('Content','HH:mm:ss') as {source:string}).source,'text');
  assert.match((r('Content','12:45') as {error:string}).error,/Pattern: HH:mm/);
  assert.match((r('Pattern: Clock','x') as {error:string}).error,/нет ни одного элемента/);
});

test('Plain Text preview exports its catalog pattern without writing a pattern to metadata',async()=>{
  fakeFigma();const root=expandedFixture(),clock=root.children.find(n=>n.name==='datetime_Clock') as TextNode;
  clock.characters='September 28, 12:00 AM';
  const plan=recognize(root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  assert.equal(JSON.parse(clock.getPluginData('exui')).pattern,undefined);
  const bundle=await exportFrame(root),element=bundle.screen.elements.find(e=>e.kind==='datetime')!;
  assert.deepEqual(element.native,{pattern:'MMMM d, h:mm tt'});assert.equal(element.text,undefined);
  clock.characters='Monday, September 28';assert.equal(capture(root).screen.elements.find(e=>e.kind==='datetime')!.native!.pattern,'dddd, MMMM d');
});

test('Legacy saved pattern: kept for pattern text, replaced by a catalog preview, error for plain digits',()=>{
  fakeFigma();const root=expandedFixture(),clock=root.children.find(n=>n.name==='datetime_Clock') as TextNode;
  clock.characters='HH:mm';tag(clock,{kind:'datetime',key:'home.clock',objectId:900,controlId:null,pattern:'dd.MM.yyyy HH:mm'});
  let plan=recognize(root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const pattern=()=>capture(root).screen.elements.find(e=>e.kind==='datetime')!.native!.pattern;
  assert.equal(pattern(),'dd.MM.yyyy HH:mm');
  clock.characters='9/28/2026 12:00 AM';assert.equal(pattern(),'M/d/yyyy h:mm tt');
  tag(clock,{kind:'datetime',key:'home.clock',objectId:900,controlId:null});clock.characters='12:45';
  plan=recognize(root,'tlp-pro-1025m');
  assert.equal(plan.issues.length,1);assert.equal(plan.issues[0].nodeName,'datetime_Clock');assert.match(plan.issues[0].message,/«12:45» не является форматом/);assert.match(plan.issues[0].fix,/Extron Kit/);
});

test('Kit: every Format variant exports its own pattern, follows a Format switch; a Pattern layer overrides it',async()=>{
  kitFixture();const kit=await createKit('tlp-pro-1025m');
  assert.equal(kit.dateTime.children.length,DATETIME_FORMATS.length);
  for(const [index,format] of DATETIME_FORMATS.entries()){
    const variant=kit.dateTime.children[index] as ComponentNode,copy=variant.children[0] as TextNode;
    assert.equal(variant.name,'Format='+format.name);assert.equal(copy.name,'Content');assert.equal(copy.characters,formatDateTime(format.pattern));
  }
  for(const child of [...kit.example.children])child.remove();
  const instances=[8,7,1].map((index,row)=>{const n=(kit.dateTime.children[index] as ComponentNode).createInstance();kit.example.appendChild(n);n.x=0;n.y=row*60;return n;});
  assert.deepEqual(instances.map(n=>n.name),['datetime_Clock','datetime_Clock','datetime_Clock']);
  (instances[2].children[0] as TextNode).name='Pattern: dddd HH:mm';
  const plan=recognize(kit.example,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const bundle=await exportFrame(kit.example);
  // Format 8 and 7 render the same "12:00 AM"; the variant keeps them apart.
  assert.deepEqual(bundle.screen.elements.map(e=>e.native!.pattern),['hh:mm tt','h:mm tt','dddd HH:mm']);
  (instances[0] as any).componentProperties={Format:{type:'VARIANT',value:'ISO date'}};
  assert.equal(capture(kit.example).screen.elements[0].native!.pattern,'yyyy-MM-dd');
});

const source=buildSync({entryPoints:[fileURLToPath(new URL('../src/code.ts',import.meta.url))],bundle:true,write:false,target:'es2017',define:{__html__:'"test"',__ICONS__:JSON.stringify(Object.fromEntries(Object.entries(icons()).map(([k,v])=>[k,[...v]])))}}).outputFiles[0].text;
test('Form: typed pattern is kept and wins over the design; an emptied field follows the design again',async()=>{
  const fake=fakeFigma();vm.runInNewContext(source,{figma:fake.api,Uint8Array,console});const send=fake.api.ui.onmessage as unknown as (m:unknown)=>Promise<void>;
  const root=frame(null,'Home',0,0,1280,800,'#101010'),clock=label(root,'datetime_Clock','September 28, 12:00 AM',20,20,300,30);
  fake.page.selection=[root as never];await send({type:'prepare',profile:'tlp-pro-1025m'});
  const selectClock=()=>{fake.page.selection=[clock as never];fake.emit('selectionchange');return fake.messages.filter(m=>m.type==='selection').at(-1) as any;};
  let selection=selectClock();assert.deepEqual(JSON.parse(JSON.stringify(selection.datetime)),{pattern:'MMMM d, h:mm tt',source:'preview',preview:'September 28, 12:00 AM',manual:false});
  const form=(pattern:string,edited:boolean)=>({kind:'datetime',key:'home.clock',objectId:'5',pattern,keyEdited:'true',patternEdited:String(edited)});
  await send({type:'apply',data:form('dddd HH:mm',true)});
  assert.equal(clock.getPluginData(MANUAL_PATTERN),clock.id);selection=selectClock();assert.equal(selection.datetime.source,'manual');assert.equal(selection.datetime.pattern,'dddd HH:mm');
  // Saving other fields with an untouched pattern keeps the typed one.
  await send({type:'apply',data:form('dddd HH:mm',false)});assert.equal(JSON.parse(clock.getPluginData('exui')).pattern,'dddd HH:mm');
  await send({type:'apply',data:form('Clock',true)});
  assert.match(String((fake.messages.filter(m=>m.type==='error').at(-1) as any).message),/нет ни одного элемента/);assert.equal(clock.getPluginData(MANUAL_PATTERN),clock.id);
  await send({type:'apply',data:form('',true)});
  assert.equal(clock.getPluginData(MANUAL_PATTERN),'');assert.equal(JSON.parse(clock.getPluginData('exui')).pattern,undefined);
  selection=selectClock();assert.equal(selection.datetime.source,'preview');
  fake.page.selection=[root as never];await send({type:'export'});
  const bundle=(fake.messages.filter(m=>m.type==='bundle').at(-1) as any).bundle;
  assert.equal(bundle.screen.elements.find((e:any)=>e.kind==='datetime').native.pattern,'MMMM d, h:mm tt');
});
