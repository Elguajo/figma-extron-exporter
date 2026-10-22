import test from 'node:test';
import assert from 'node:assert/strict';
import { capture, designSignature, exportFrame } from '../src/export.ts';
import { applyRecognition, recognize } from '../src/recognize.ts';
import { PROFILES, readMetadata, type Profile } from '../src/model.ts';
import { fakeFigma } from './fake-figma.ts';
import { frame, projectFixture } from './expanded-fixture.ts';
import { png } from './kit-fixture.ts';

function backgroundFixture(profile:Profile='tlp-pro-1025m') {
  const fake=fakeFigma(),size=PROFILES[profile];
  const root=frame(null,'screen_StartPage',250,180,size.width,size.height);
  const background=frame(root,'image_Background',0,-99,size.width,size.height+198);
  root.clipsContent=true;
  return {fake,root,background};
}

for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const)
test(`Clip content ${profile}: oversized background exports only the screen viewport without editing the source`,async()=>{
  const {fake,root,background}=backgroundFixture(profile),size=PROFILES[profile];
  const plan=recognize(root,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  const identity=readMetadata(background)!,before=designSignature(root),selection=[...fake.page.selection];
  let renders=0;
  fake.setRenderHook(node=>{
    renders++;assert.equal(node.clipsContent,true);
    assert.deepEqual([node.width,node.height],[size.width,size.height]);
    assert.equal(node.children.length,1);
    const copy=node.children[0];assert.equal(copy.name,background.name);
    assert.deepEqual([copy.x,copy.y,copy.width,copy.height],[0,-99,size.width,size.height+198]);
    return png(size.width,size.height);
  });
  const bundle=await exportFrame(root),result=bundle.screen.elements[0];
  assert.deepEqual(result.rect,[0,0,size.width,size.height]);
  assert.deepEqual([result.key,result.objectId,result.controlId],[identity.key,identity.objectId,null]);
  assert.equal(bundle.resources.length,1);assert.equal(renders,1);
  assert.equal(designSignature(root),before);assert.deepEqual(fake.page.children,[root]);
  assert.deepEqual(fake.page.selection,selection);
});

for(const [name,source,expected,offset] of [
  ['left',[-20,50,100,80],[0,50,80,80],[-20,0]],
  ['right',[1250,50,100,80],[1250,50,30,80],[0,0]],
  ['bottom',[50,770,100,80],[50,770,100,30],[0,0]],
  ['all edges',[-20,-30,1400,900],[0,0,1280,800],[-20,-30]],
  ['fractional',[-.42,770.91,100.21,60.09],[0,770,100,30],[-.42,.91]],
] as const)test(`Clip content ${name}: PNG size and source offset follow the visible intersection`,async()=>{
  const {fake,root,background}=backgroundFixture();
  [background.x,background.y]=source;background.resize(source[2],source[3]);
  applyRecognition(recognize(root,'tlp-pro-1025m'));
  fake.setRenderHook(node=>{
    assert.deepEqual([node.width,node.height],expected.slice(2));
    assert.ok(Math.abs(node.children[0].x-offset[0])<1e-8);
    assert.ok(Math.abs(node.children[0].y-offset[1])<1e-8);
    assert.deepEqual([node.children[0].width,node.children[0].height],source.slice(2));
    return png(node.width,node.height);
  });
  assert.deepEqual((await exportFrame(root)).screen.elements[0].rect,expected);
});

test('A clipped popup crops graphics to its own bounds, independently of the project canvas',async()=>{
  const fake=fakeFigma(),project=projectFixture();
  const popup=project.children.find(n=>n.name==='popup_Sources') as FrameNode;
  const background=frame(popup,'image_Background',-10,-15,100,90);
  applyRecognition(recognize(project,'tlp-pro-1025m'));
  const result=capture(project);assert.ok('popups'in result.screen);
  const page=result.screen.popups.find(p=>p.name===popup.name)!;
  assert.deepEqual(page.elements.find(e=>e.name===background.name)!.rect,[0,0,80,60]);
  const image=result.images.find(i=>i.node===background)!;
  assert.deepEqual(image.artwork,{width:80,height:60,offsetX:-10,offsetY:-15});
  assert.ok(fake.page.children.includes(project as never));
});

test('Clipping disabled on the screen still rejects overflow even if the background clips its own children',()=>{
  const {root,background}=backgroundFixture();root.clipsContent=false;background.clipsContent=true;
  const plan=recognize(root,'tlp-pro-1025m');
  assert.ok(plan.issues.some(e=>e.nodeId===background.id&&e.message.includes('холст')));
});

test('A graphic entirely outside the clipped viewport still reports bounds on the original node',()=>{
  const {root,background}=backgroundFixture();background.x=root.width;
  const plan=recognize(root,'tlp-pro-1025m');
  assert.ok(plan.issues.some(e=>e.nodeId===background.id&&e.message.includes('холст')));
});

test('Native controls remain subject to bounds checks with Clip content enabled',()=>{
  const {root,background}=backgroundFixture();background.name='level_Volume';
  const plan=recognize(root,'tlp-pro-1025m');
  assert.ok(plan.issues.some(e=>e.nodeId===background.id&&e.message.includes('холст')));
});

test('Failed cropped PNG rendering cleans up temporary nodes and preserves source geometry and metadata',async()=>{
  const {fake,root}=backgroundFixture();applyRecognition(recognize(root,'tlp-pro-1025m'));
  const before=designSignature(root),selection=[...fake.page.selection];
  fake.setRenderHook(()=>{throw new Error('render failed');});
  await assert.rejects(exportFrame(root),(error:any)=>error.code==='image-export');
  assert.equal(designSignature(root),before);assert.deepEqual(fake.page.children,[root]);
  assert.deepEqual(fake.page.selection,selection);
});
