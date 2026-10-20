import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeFigma } from './fake-figma.ts';
import { expandedFixture,projectFixture,verticalFixture,frame } from './expanded-fixture.ts';
import { recognize,applyRecognition,REGISTRY_KEY,namedControl } from '../src/recognize.ts';
import { exportFrame,capture,designSignature } from '../src/export.ts';
import { packageExui } from '../src/package.ts';
import { readMetadata,DATA_KEY } from '../src/model.ts';

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){
 test(`Expanded ${profile}: designer names → editable native properties in exui/5`,async()=>{
  fakeFigma();const root=expandedFixture(profile),before=designSignature(root),plan=recognize(root,profile);assert.deepEqual(plan.errors,[]);assert.equal(designSignature(root),before);applyRecognition(plan);
  const bundle=await exportFrame(root);assert.equal(bundle.screen.schema,'exui-screen/5');assert.ok('elements' in bundle.screen);const elements=bundle.screen.elements;
  assert.equal(elements[0].kind,'slider');assert.deepEqual(elements[0].native,{trackColor:'#292D30',trackWidth:16,thumbColor:'#FFFFFF',thumbWidth:28,thumbHeight:28,thumbType:'ellipse',radius:8});
  assert.equal(elements[1].kind,'value');assert.ok(elements[1].controlId);assert.equal(elements[2].kind,'shape');assert.equal(elements[2].native?.radius,10);assert.equal(elements[3].native?.thickness,2);assert.equal(elements[4].native?.pattern,'dd.MM.yyyy HH:mm');
  assert.equal(elements[5].display,'gauge');assert.equal(elements[6].display,'volume-led');assert.equal(elements[7].display,'multistate');assert.deepEqual(elements[8].states?.map(s=>[s.stateId,s.role]),[[0,'normal'],[1,'feedback'],[2,'feedback'],[3,'pressed']]);
  assert.ok(packageExui(bundle).length>500);const saved=root.children.map(n=>n.getPluginData(DATA_KEY));(root.children as SceneNode[]).reverse();applyRecognition(recognize(root,profile));assert.deepEqual([...root.children].reverse().map(n=>n.getPluginData(DATA_KEY)),saved);
 });
 test(`Project ${profile}: pages, popup, modal, group and references exported together`,async()=>{
  fakeFigma();const root=projectFixture(profile),plan=recognize(root,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);const screen=(await exportFrame(root)).screen;assert.ok('pages' in screen);assert.equal(screen.pages.length,2);assert.equal(screen.popups.length,4);assert.equal(screen.groups.length,1);assert.equal(screen.popups.filter(p=>p.modal).length,1);assert.equal(screen.pages.filter(p=>p.shownBy==='start').length,1);
  assert.equal(screen.popups.filter(p=>p.group===screen.groups[0].key).length,2);assert.equal(screen.pages[0].elements.filter(e=>e.kind==='popup-ref').length,2);
  const controls=[...screen.pages,...screen.popups].flatMap(p=>p.elements).filter(e=>e.controlId!==null);assert.equal(new Set(controls.map(e=>e.controlId)).size,controls.length);
  const keys=screen.pages.map(p=>p.key),registry=root.getPluginData(REGISTRY_KEY);(root.children as SceneNode[]).reverse();applyRecognition(recognize(root,profile));const reordered=capture(root).screen;assert.ok('pages' in reordered);assert.deepEqual(reordered.pages.map(p=>p.key).sort(),keys.sort());assert.equal(root.getPluginData(REGISTRY_KEY),registry);
 });
}

for(const [name,edit] of [
 ['missing slider part',(r:any)=>r.children[0].children[1].remove()],
 ['duplicate slider part',(r:any)=>r.children[0].children[1].name='Track'],
 ['misaligned track',(r:any)=>r.children[0].children[0].y++],
 ['unsupported shadows',(r:any)=>r.children[2].effects=[{visible:true}]],
 ['unsupported dynamic image',(r:any)=>r.children[2].name='dynamicimage_Cover'],
 ['duplicate custom state',(r:any)=>r.children[8].children[2].name='state_Ready'],
] as const)test(`Expanded recognition refuses ${name} without writing`,()=>{fakeFigma();const root=expandedFixture();edit(root);const before=designSignature(root),plan=recognize(root,'tlp-pro-1025m');assert.ok(plan.errors.length);assert.throws(()=>applyRecognition(plan));assert.equal(designSignature(root),before);});

test('Project stale nested registry and failing writes retain transaction guarantees',()=>{
 fakeFigma();const root=projectFixture(),plan=recognize(root,'tlp-pro-1025m');assert.deepEqual(plan.errors,[]);root.children[0].setPluginData(REGISTRY_KEY,'changed');assert.throws(()=>applyRecognition(plan),(e:any)=>e.code==='design-changed');root.children[0].setPluginData(REGISTRY_KEY,'');
 const next=recognize(root,'tlp-pro-1025m'),before=designSignature(root),node=root.children[1],original=node.setPluginData.bind(node);let failed=false;node.setPluginData=(k,v)=>{if(!failed&&v){failed=true;throw new Error('Write failure');}original(k,v);};assert.throws(()=>applyRecognition(next),/Write failure/);assert.equal(designSignature(root),before);
});

test('Deleted project containers and controls leave IDs reserved',()=>{
 fakeFigma();const root=projectFixture();applyRecognition(recognize(root,'tlp-pro-1025m'));const deleted=readMetadata(root.children[1])!;root.children[1].remove();const canvas=root.children[0];assert.equal(canvas.type,'FRAME');const added=frame(root,'screen_New',0,0,1280,800,'#000000');const control=frame(added,'gauge_Signal',10,10,100,10,'#FFFFFF');applyRecognition(recognize(root,'tlp-pro-1025m'));assert.ok(readMetadata(added)!.objectId!>deleted.objectId!);assert.ok(readMetadata(control)!.controlId);
});

test('New short/full prefixes are case insensitive',()=>{for(const [short,full] of [['sld','slider'],['val','value'],['shp','shape'],['ln','line'],['dt','datetime'],['gau','gauge'],['ind','indicator'],['mlvl','multilevel'],['led','volumeled'],['pr','popupref']])assert.deepEqual(namedControl(short+'_Volume'),namedControl(full.toUpperCase()+'_volume'));});

test('A damaged project registry cannot reset deleted container or group reservations',()=>{
 fakeFigma();const root=projectFixture();applyRecognition(recognize(root,'tlp-pro-1025m'));const registry=JSON.parse(root.getPluginData(REGISTRY_KEY));delete registry.nextContainerId;root.setPluginData(REGISTRY_KEY,JSON.stringify(registry));assert.throws(()=>recognize(root,'tlp-pro-1025m'));
});
test('Vertical Slider, custom range, ellipse stroke and vertical Line retain native intent',()=>{
 fakeFigma();const root=verticalFixture('tlp-pro-300m-portrait'),plan=recognize(root,'tlp-pro-300m-portrait');assert.deepEqual(plan.errors,[]);applyRecognition(plan);const screen=capture(root).screen;assert.ok('elements' in screen);const slider=screen.elements.find(e=>e.kind==='slider')!;assert.equal(slider.orientation,'bottom-to-top');assert.equal(slider.min,10);assert.equal(slider.max,255);assert.equal(slider.native?.trackWidth,16);const shape=screen.elements.find(e=>e.kind==='shape')!;assert.equal(shape.native?.shape,'ellipse');assert.equal(shape.native?.strokeColor,'#888888');assert.equal(shape.native?.thickness,1);assert.equal(shape.native?.radius,0);
});
