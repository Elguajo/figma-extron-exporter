import test from 'node:test';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {fakeFigma} from './fake-figma.ts';
import {namedFixture} from './named-fixture.ts';
import {recognize,applyRecognition} from '../src/recognize.ts';
import {exportFrame,designSignature} from '../src/export.ts';
import {readMetadata,DATA_KEY} from '../src/model.ts';
import {createOrigin,planIdMap,applyIdMap,ORIGIN_TOKEN,type FigmaIdMap} from '../src/id-map.ts';
import {packageExui} from '../src/package.ts';

async function setup(){const f=fakeFigma(),root=await namedFixture('tlp-pro-1025m',true);applyRecognition(recognize(root,'tlp-pro-1025m'));const bundle=await exportFrame(root),origin=createOrigin(root,bundle);bundle.origin=origin;const map:FigmaIdMap={schema:'exui-figma-id-map/1',profile:bundle.profile,pageId:origin.pageId,pageToken:origin.pageToken,projectName:origin.projectName,entries:origin.nodes.map((n,i)=>({...n,sourceControlId:n.controlId,controlId:i+1}))};return {...f,root,bundle,origin,map};}

test('EXUI includes hashed layer provenance; repeated exports retain the same page and node identities',async()=>{
 const f=await setup(),files=unzipSync(packageExui(f.bundle)),manifest=JSON.parse(strFromU8(files['manifest.json']));
 assert.equal(manifest.figma.path,'figma.json');assert.equal(manifest.figma.sha256.length,64);
 assert.deepEqual(JSON.parse(strFromU8(files['figma.json'])),f.origin);
 assert.deepEqual(createOrigin(f.root,await exportFrame(f.root)),f.origin);
 const {origin,...legacy}=f.bundle;assert.ok(!unzipSync(packageExui(legacy))['figma.json']);
});
test('Preview is read-only; one batch changes only Control IDs and is idempotent',async()=>{
 const f=await setup(),before=designSignature(f.root),identities=f.origin.nodes.map(n=>readMetadata(f.root.children.find(c=>c.id===n.nodeId)!)!);
 const plan=planIdMap(figma.currentPage,JSON.stringify(f.map));assert.equal(designSignature(f.root),before);assert.equal(plan.rows.length,2);
 assert.equal(applyIdMap(plan),2);
 f.origin.nodes.forEach((n,i)=>assert.deepEqual(readMetadata(f.root.children.find(c=>c.id===n.nodeId)!),{...identities[i],controlId:i+1}));
 assert.equal(applyIdMap(planIdMap(figma.currentPage,JSON.stringify(f.map))),0);
 const ids=(await exportFrame(f.root)).screen;assert.ok('elements' in ids);assert.deepEqual(ids.elements.filter(e=>e.kind==='button').map(e=>e.controlId),[1,2]);
});
test('Two buttons can exchange IDs in a single batch; IDs occupied outside the batch are refused',async()=>{
 const f=await setup(),[a,b]=f.map.entries;[a.controlId,b.controlId]=[b.sourceControlId,a.sourceControlId];
 const plan=planIdMap(figma.currentPage,JSON.stringify(f.map));assert.equal(applyIdMap(plan),2);
 const g=await setup();g.map.entries[0].controlId=readMetadata(g.root.children[2])!.controlId!;
 const before=designSignature(g.root);assert.throws(()=>planIdMap(figma.currentPage,JSON.stringify(g.map)),/уже занят/);assert.equal(designSignature(g.root),before);
});
test('IDs in a separate Section project do not conflict or change during import',async()=>{
 const f=await setup(),section=figma.createSection();section.name='Original';section.appendChild(f.root);
 const other=await namedFixture('tlp-pro-1025m',true),otherSection=figma.createSection();otherSection.name='Independent';otherSection.appendChild(other);applyRecognition(recognize(otherSection,'tlp-pro-1025m'));
 const button=other.children[0],m=readMetadata(button)!;button.setPluginData(DATA_KEY,JSON.stringify({...m,controlId:1}));const before=designSignature(otherSection);
 applyIdMap(planIdMap(figma.currentPage,JSON.stringify(f.map)));assert.equal(readMetadata(f.root.children[0])!.controlId,1);assert.equal(designSignature(otherSection),before);
});
for(const defect of ['foreign','duplicate-node','duplicate-id','missing','renamed','stale-id','range'] as const)test(`Import refuses ${defect} before any write`,async()=>{
 const f=await setup(),map=structuredClone(f.map);
 if(defect==='foreign')map.pageToken='other-origin-0000000';
 if(defect==='duplicate-node')map.entries[1].nodeId=map.entries[0].nodeId;
 if(defect==='duplicate-id')map.entries[1].controlId=map.entries[0].controlId;
 if(defect==='missing')map.entries[0].nodeId='deleted';
 if(defect==='renamed')map.entries[0].key='changed.key';
 if(defect==='stale-id')map.entries[0].sourceControlId=65534;
 if(defect==='range')map.entries[0].controlId=65536;
 const before=designSignature(f.root);assert.throws(()=>planIdMap(figma.currentPage,JSON.stringify(map)));assert.equal(designSignature(f.root),before);
});
test('Metadata edits after preview invalidate apply; a failed second write restores the whole batch and registries',async()=>{
 const f=await setup(),plan=planIdMap(figma.currentPage,JSON.stringify(f.map)),button=f.root.children[0];
 const metadata=readMetadata(button)!;button.setPluginData(DATA_KEY,JSON.stringify({...metadata,controlId:9000}));const changed=designSignature(f.root);
 assert.throws(()=>applyIdMap(plan),/изменились/);assert.equal(designSignature(f.root),changed);
 const g=await setup(),next=planIdMap(figma.currentPage,JSON.stringify(g.map)),before=designSignature(g.page as never),last=next.writes[1].node,write=last.setPluginData.bind(last);let failed=false;
 last.setPluginData=(key,value)=>{if(key===DATA_KEY&&!failed){failed=true;throw new Error('write failed');}write(key,value);};
 assert.throws(()=>applyIdMap(next),/write failed/);assert.equal(designSignature(g.page as never),before);
 assert.ok(g.page.getPluginData(ORIGIN_TOKEN));
});
test('Switching pages during export cannot stamp the wrong page as the origin',async()=>{
 const f=await setup(),other=f.api.createFrame();(f.api as any).currentPage=other;
 assert.throws(()=>createOrigin(f.root,f.bundle),/Страница изменилась/);assert.equal(other.getPluginData(ORIGIN_TOKEN),'');
});
