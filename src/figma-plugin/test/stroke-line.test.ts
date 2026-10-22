import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeFigma } from './fake-figma.ts';
import { strokeLineFixture } from './stroke-line-fixture.ts';
import { capture,designSignature,exportFrame } from '../src/export.ts';
import { applyRecognition,recognize } from '../src/recognize.ts';
import { DATA_KEY,readMetadata } from '../src/model.ts';
import { solid } from './expanded-fixture.ts';

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)
for(const width of [null,{widthProfile:'UNIFORM'}] as const)
test(`Center stroke 2 / ${width?.widthProfile??'null'} / ${profile}: Vector and Line retain constant-width native output`,async()=>{
  fakeFigma();const root=await strokeLineFixture(profile);
  const divider=root.children[0] as VectorNode;divider.x=0;divider.y=87;divider.strokes=[solid('#343538')];
  await divider.setVectorNetworkAsync({vertices:[{x:0,y:0},{x:root.width,y:0}],segments:[{start:0,end:1}],regions:[]});
  for(const node of root.children as (VectorNode|LineNode)[])node.variableWidthStrokeProperties=width;
  const before=designSignature(root),plan=recognize(root,profile);assert.deepEqual(plan.errors,[]);assert.equal(designSignature(root),before);applyRecognition(plan);
  const source=designSignature(root),bundle=await exportFrame(root);
  assert.deepEqual(bundle.screen.elements[0].rect,[0,86,root.width,2]);assert.deepEqual(bundle.screen.elements[0].native,{thickness:2});
  assert.deepEqual(bundle.screen.elements[3].rect,[20,218,100,4]);assert.deepEqual(bundle.screen.elements[3].native,{thickness:4});
  assert.equal(bundle.screen.elements[0].fillColor,'#343538');assert.equal(bundle.resources.length,0);assert.equal(designSignature(root),source);
});

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)
test(`Pen and Line Tool ${profile}: native segments, Stroke color/width, no PNG and stable IDs`,async()=>{
  fakeFigma();const root=await strokeLineFixture(profile),before=designSignature(root),plan=recognize(root,profile);
  assert.deepEqual(plan.errors,[]);assert.equal(designSignature(root),before);applyRecognition(plan);
  const metadata=root.children.map(n=>n.getPluginData(DATA_KEY)),bundle=await exportFrame(root);
  assert.equal(bundle.screen.schema,'exui-screen/5');assert.ok('elements' in bundle.screen);
  assert.deepEqual(bundle.screen.elements.map(e=>[e.kind,e.controlId,e.rect,e.fillColor,e.native]),[
    ['line',null,[20,39,100,2],'#6699CC',{thickness:2}],
    ['line',null,[179,40,2,100],'#6699CC',{thickness:2}],
    ['line',null,[20,180,100,1],'#6699CC',{thickness:1}],
    ['line',null,[20,218,100,4],'#CC9933',{thickness:4}],
  ]);
  assert.deepEqual(bundle.resources,[]);assert.deepEqual(bundle.screen.assets,[]);
  root.children[0].x+=10;applyRecognition(recognize(root,profile));
  assert.deepEqual(root.children.map(n=>n.getPluginData(DATA_KEY)),metadata);
  assert.deepEqual(readMetadata(root.children[0])?.kind,'line');
});

test('Rotated Line Tool and reversed Pen endpoints retain their page coordinates',async()=>{
  fakeFigma();const root=await strokeLineFixture(),line=root.children[3];
  Object.defineProperty(line,'relativeTransform',{get:()=>[[0,-1,240],[1,0,200]]});
  const pen=root.children[0] as VectorNode;
  await pen.setVectorNetworkAsync({vertices:[{x:100,y:0},{x:0,y:0}],segments:[{start:1,end:0}]});
  const plan=recognize(root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const screen=capture(root).screen;assert.ok('elements' in screen);
  assert.deepEqual(screen.elements[3].rect,[238,200,4,100]);assert.deepEqual(screen.elements[0].rect,[20,39,100,2]);
});

for(const [name,edit,error] of [
  ['curve',(n:any)=>n.vectorNetwork.segments[0].tangentStart={x:10,y:5},/Безье/],
  ['polyline',(n:any)=>{n.vectorNetwork.vertices.push({x:50,y:10});n.vectorNetwork.segments.push({start:1,end:2});},/две точки/],
  ['closed path',(n:any)=>n.vectorNetwork.regions=[{windingRule:'NONZERO',loops:[[0]]}],/открытый/],
  ['diagonal',(n:any)=>n.vectorNetwork.vertices[1].y=20,/диагональ/],
  ['dash',(n:any)=>n.dashPattern=[4,2],/пунктира/],
  ['arrow',(n:any)=>n.strokeCap='ARROW_LINES',/окончания/],
  ['vertex round cap',(n:any)=>n.vectorNetwork.vertices[0].strokeCap='ROUND',/окончания/],
  ['vertex corner radius',(n:any)=>n.vectorNetwork.vertices[0].cornerRadius=3,/скруглений/],
  ['transparent stroke',(n:any)=>n.strokes[0].opacity=0.5,/непрозрачный/],
  ['multiple strokes',(n:any)=>n.strokes.push(solid('#FFFFFF')),/один/],
  ['missing stroke',(n:any)=>n.strokes=[],/Stroke/],
  ['gradient',(n:any)=>n.strokes[0].type='GRADIENT_LINEAR',/SOLID/],
  ['fill',(n:any)=>n.fills=[solid('#FFFFFF')],/Fill/],
  ['inside stroke',(n:any)=>n.strokeAlign='INSIDE',/Center/],
  ['brush',(n:any)=>n.complexStrokeProperties={type:'BRUSH'},/кисти/],
  ['variable width',(n:any)=>n.variableWidthStrokeProperties={widthProfile:'test'},/толщины/],
  ['wedge width',(n:any)=>n.variableWidthStrokeProperties={widthProfile:'WEDGE'},/толщины/],
  ['taper width',(n:any)=>n.variableWidthStrokeProperties={widthProfile:'TAPER'},/толщины/],
  ['quarter taper width',(n:any)=>n.variableWidthStrokeProperties={widthProfile:'QUARTER_TAPER'},/толщины/],
  ['eye width',(n:any)=>n.variableWidthStrokeProperties={widthProfile:'EYE'},/толщины/],
  ['mirrored taper width',(n:any)=>n.variableWidthStrokeProperties={widthProfile:'MIRRORED_TAPER'},/толщины/],
  ['custom width',(n:any)=>n.variableWidthStrokeProperties={widthProfile:'CUSTOM',variableWidthPoints:[{position:0,width:.5},{position:1,width:1}]},/толщины/],
  ['dynamic stroke',(n:any)=>n.complexStrokeProperties={type:'DYNAMIC',frequency:1,wiggle:1,smoothen:0},/кисти/],
  ['zero length',(n:any)=>n.vectorNetwork.vertices[1].x=0,/ненулевой/],
  ['thicker than length',(n:any)=>n.strokeWeight=101,/больше/],
  ['square bounds lose direction',(n:any)=>n.strokeWeight=100,/больше/],
  ['fractional stroke',(n:any)=>n.strokeWeight=1.5,/Толщина/],
  ['off pixel grid',(n:any)=>n.strokeWeight=1,/0.5 px/],
  ['stroke outside page',(n:any)=>n.y=0,/холст/],
  ['effect',(n:any)=>n.effects=[{visible:true}],/эффекты/],
  ['hidden',(n:any)=>n.visible=false,/скрытые/],
  ['scaled transform',(n:any)=>Object.defineProperty(n,'relativeTransform',{get:()=>[[2,0,20],[0,1,40]]}),/масштабирование/],
] as const)test(`Pen recognition refuses ${name} without changing assignments or artwork`,async()=>{
  fakeFigma();const root=await strokeLineFixture();edit(root.children[0]);const before=designSignature(root),plan=recognize(root,'tlp-pro-1025m');
  assert.ok(plan.errors.some(e=>error.test(e)),plan.errors.join('\n'));assert.throws(()=>applyRecognition(plan));assert.equal(designSignature(root),before);
});

for(const field of ['strokeCap','strokeAlign','dashPattern','vectorNetwork','complexStrokeProperties','variableWidthStrokeProperties'] as const)
test(`Editing ${field} invalidates a pending recognition plan`,async()=>{
  fakeFigma();const root=await strokeLineFixture(),plan=recognize(root,'tlp-pro-1025m'),node=root.children[0] as any;
  assert.deepEqual(plan.errors,[]);
  if(field==='vectorNetwork')node.vectorNetwork.vertices[1].x=90;
  else node[field]=field==='dashPattern'?[3,2]:field.endsWith('Properties')?{type:'BRUSH'}:'changed';
  assert.throws(()=>applyRecognition(plan),(e:any)=>e.code==='design-changed');
});
