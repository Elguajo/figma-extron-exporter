import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeFigma } from './fake-figma.ts';
import { expandedFixture,label,solid } from './expanded-fixture.ts';
import { recognize,applyRecognition } from '../src/recognize.ts';
import { exportFrame,designSignature } from '../src/export.ts';

const find=(root:FrameNode,name:string)=>root.children.find(n=>n.name===name) as FrameNode;
function translucent(node:TextNode,paintOpacity:number,layerOpacity=1){node.fills=[{...solid('#D2AE6D'),opacity:paintOpacity}];node.opacity=layerOpacity;}
const message=(name:string)=>`${name}: полупрозрачный текст не поддерживается. Поставьте 100% непрозрачность заливки текста и слоя (Opacity).`;

// Each case makes one text translucent; the rest of the fixture stays valid.
const targets:[string,(root:FrameNode)=>TextNode][]=[
  ['text_Hint',root=>label(root,'text_Hint','Press to open main menu',20,420,260,28)],
  ['value_VolumeValue',root=>find(root,'value_VolumeValue') as unknown as TextNode],
  ['datetime_Clock',root=>find(root,'datetime_Clock') as unknown as TextNode],
  ['Text',root=>(find(root,'button_Connection').children[0] as FrameNode).children[0] as TextNode],
];

for(const [name,pick] of targets)
for(const [paintOpacity,layerOpacity] of [[.5,1],[1,.5],[.99,1],[0,1],[1,0]] as const)
test(`Translucent text ${name} ${paintOpacity} × ${layerOpacity} is refused with the fix, design unchanged`,()=>{
  fakeFigma();const root=expandedFixture();
  translucent(pick(root),paintOpacity,layerOpacity);
  const source=designSignature(root),plan=recognize(root,'tlp-pro-1025m');
  assert.deepEqual(plan.errors,[message(name)]);
  assert.equal(designSignature(root),source);
});

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)
test(`Opaque colored text / ${profile}: native label, value, datetime and button text keep #RRGGBB`,async()=>{
  fakeFigma();const root=expandedFixture(profile);
  const texts=targets.map(([,pick])=>pick(root));
  for(const t of [...texts,...find(root,'button_Connection').children.map(s=>(s as FrameNode).children[0] as TextNode)])translucent(t,1);
  const plan=recognize(root,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const bundle=await exportFrame(root);assert.ok('elements' in bundle.screen);
  const byName=new Map(bundle.screen.elements.map(e=>[e.name,e]));
  assert.equal(byName.get('text_Hint')?.kind,'label');
  for(const name of ['text_Hint','value_VolumeValue','datetime_Clock'])assert.equal(byName.get(name)?.textColor,'#D2AE6D');
  assert.deepEqual(byName.get('button_Connection')?.states?.map(s=>s.textColor),['#D2AE6D','#D2AE6D','#D2AE6D','#D2AE6D']);
});
