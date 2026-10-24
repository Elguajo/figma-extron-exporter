// Executes the shipped main bundle. This fixture models Figma API/PNG; it is not a Desktop proof.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { fakeFigma } from './fake-figma.ts';
import { graphicFixture, namedFixture } from './named-fixture.ts';
import { expandedFixture,sectionFixture } from './expanded-fixture.ts';
import { packageExui } from '../src/package.ts';
import type { Bundle } from '../src/model.ts';
import { kitFixture } from './kit-fixture.ts';
import { manyAssetsFixture } from './many-assets-fixture.ts';
import { twoScreens } from './page-project-fixture.ts';
import { strokeLineFixture } from './stroke-line-fixture.ts';
import { recognize,applyRecognition } from '../src/recognize.ts';
import { designSignature } from '../src/export.ts';
import { frame as lineRectangle,solid } from './expanded-fixture.ts';

const [archive, kit, output] = process.argv.slice(2);
assert.ok(archive && kit && output, 'Usage: node test/archive-smoke.ts <plugin.zip> <unpacked-kit> <new-output-dir>');
const files = unzipSync(new Uint8Array(await readFile(archive)));
const archiveVersion = JSON.parse(strFromU8(files['version.json']));
const version = archiveVersion.version;
assert.deepEqual(archiveVersion.contracts,['exui/5']);
const manifest = JSON.parse(strFromU8(files['manifest.json']));
assert.equal(manifest.id, 'figma-extron-exporter-local-dev');
const ui = strFromU8(files[manifest.ui]);
assert.ok(ui.includes('Figma → Extron Exporter')&&ui.includes(`· ${version}`));
const out = path.resolve(output), installed = path.resolve(kit);
const cliVersion=JSON.parse(await readFile(path.join(installed,'version.json'),'utf8'));
assert.equal(archiveVersion.compatibleCliVersion,cliVersion.cliVersion??cliVersion.version,'Plugin and CLI must be the current matching pair');
await mkdir(out, { recursive: true });
function cli(args: string[]) {
  const result = spawnSync(process.env.DOTNET_EXE ?? 'dotnet', [path.join(installed, 'cli/Extron.Cli.dll'), ...args], { cwd: out, encoding: 'utf8', timeout: 180000 });
  assert.equal(result.status, 0, result.stderr || result.stdout || String(result.error));
  return JSON.parse(result.stdout);
}
const evidence: unknown[] = [];
const scenarios=['blank-caption','expanded','on-off','feedback','dotted-name','many-assets','section','selected-frames','pen-lines','fractional-lines','alpha-lines','automatic-fresh','automatic-copy','automatic-merge'] as const;
const selectedScenarios=process.argv[5]==='all'?scenarios:process.argv[5]?scenarios.filter(s=>s===process.argv[5]):scenarios.slice(0,4);
assert.ok(selectedScenarios.length,'Unknown archive smoke scenario');
for (const profile of ['tlp-pro-1025m', 'tlp-pro-300m-portrait'] as const) {
  for (const scenario of selectedScenarios) {
    const fixture = scenario==='many-assets'?kitFixture():fakeFigma();
    const batch=scenario==='selected-frames'?twoScreens(profile):undefined;
    const automatic=scenario.startsWith('automatic-');
    const frame = batch?figma.currentPage:scenario==='pen-lines'||scenario==='fractional-lines'||scenario==='alpha-lines'?await strokeLineFixture(profile):scenario==='section'?sectionFixture(profile):scenario==='many-assets'?await manyAssetsFixture(profile):scenario === 'expanded'||scenario==='automatic-fresh' ? expandedFixture(profile) : scenario==='on-off'||scenario==='feedback'||scenario==='dotted-name'||automatic?await namedFixture(profile,scenario==='on-off'||scenario==='dotted-name'):await graphicFixture(profile);
    if(scenario==='alpha-lines'){
      for(const node of frame.children as (VectorNode|LineNode)[])node.strokes=[solid('#D2AE6D')];
      const divider=frame.children[0] as VectorNode;divider.x=0;divider.y=frame.height-84;
      divider.strokes=[{...solid('#D2AE6D'),opacity:.1}];
      await divider.setVectorNetworkAsync({vertices:[{x:0,y:0},{x:frame.width,y:0}],segments:[{start:0,end:1}],regions:[]});
      const vertical=frame.children[1] as VectorNode;vertical.strokes=[{...solid('#D2AE6D'),opacity:.5}];vertical.opacity=.5;
      frame.children[2].opacity=0;frame.children[3].opacity=.1;
      const rectangle=lineRectangle(frame as FrameNode,'line_Rectangle',20,260,100,2,'#D2AE6D');
      rectangle.fills=[{...solid('#D2AE6D'),opacity:.1}];rectangle.opacity=.5;
    }
    if(scenario==='fractional-lines'){
      const horizontal=frame.children[0] as VectorNode;horizontal.x=20.21;horizontal.y=40.7;horizontal.strokeWeight=1.4;
      await horizontal.setVectorNetworkAsync({vertices:[{x:0,y:0},{x:100.49,y:0}],segments:[{start:0,end:1}],regions:[]});
      const vertical=frame.children[1] as VectorNode;vertical.x=180.7;vertical.y=40.21;vertical.strokeWeight=1.5;
      await vertical.setVectorNetworkAsync({vertices:[{x:0,y:0},{x:0,y:100.5}],segments:[{start:0,end:1}],regions:[]});
      frame.children[2].y=180;
      const rotated=frame.children[3] as LineNode;rotated.name='line_Divider3';rotated.resize(48,0);rotated.strokeWeight=1.5;
      Object.defineProperty(rotated,'relativeTransform',{get:()=>[[0,-1,311],[1,0,18]]});
    }
    let automaticMembers:FrameNode[]|undefined,originalControl:SceneNode|undefined,originalSignature='';
    if(scenario==='automatic-copy'){applyRecognition(recognize(frame,profile));originalControl=frame.children[0];originalSignature=designSignature(originalControl);const copy=originalControl.clone();copy.y=frame.height-copy.height-8;}
    if(scenario==='automatic-merge'){applyRecognition(recognize(frame,profile));const audio=await namedFixture(profile);applyRecognition(recognize(audio,profile));audio.name='Audio Control';automaticMembers=[frame as FrameNode,audio];}
    if(scenario==='dotted-name'){
      const button=frame.children[0] as FrameNode;button.name='button_side.hall';button.children.forEach((s,i)=>s.name=['Passive','Active'][i]);
    }
    if (scenario === 'blank-caption') {
      const button = frame.children[0] as FrameNode;
      for (const state of button.children as FrameNode[]) (state.children.find(n => n.type === 'TEXT') as TextNode).characters = '';
    }
    fixture.page.selection = automaticMembers?automaticMembers as any:batch?[batch.main as any,batch.audio as any]:[frame as any];
    let shownUi = '';
    (fixture.api as any).showUI = (html: string) => { shownUi = html; };
    runInNewContext(strFromU8(files[manifest.main]), { figma: fixture.api, Uint8Array, console }, { filename: `${archive}/${manifest.main}`, timeout: 10000 });
    assert.equal(shownUi, ui, 'Embedded UI must match the archived UI');
    const send = fixture.api.ui.onmessage as (message: unknown) => Promise<void>;
    if(!automatic){await send({ type: 'recognize', profile,...(batch?{scopeMode:'selected-frames'}:{}) });
    const plan = fixture.messages.find(m => m.type === 'recognition')!;
    assert.ok(plan, JSON.stringify(fixture.messages));
    assert.deepEqual(JSON.parse(JSON.stringify(plan.errors)), []);
    await send({ type: 'apply-recognition', profile, token: plan.token });}
    if(batch){
      fixture.page.selection=[batch.button as any];fixture.emit('selectionchange');
      await send({type:'apply',data:{...JSON.parse(batch.button.getPluginData('exui')),navigate:'page.audiocontrol'}});
      fixture.page.selection=[batch.audio as any];fixture.emit('selectionchange');
      await send({type:'apply',data:{...JSON.parse(batch.audio.getPluginData('exui')),shownBy:'navigation'}});
    }
    if(scenario==='section'){
      const home=frame.children[0] as FrameNode,button=home.children.find(n=>n.name==='button_Connection')!,settings=frame.children[1];
      fixture.page.selection=[button as any];await send({type:'apply',data:{...JSON.parse(button.getPluginData('exui')),buttonMode:'legacy',navigate:'page.settings'}});
      fixture.page.selection=[settings as any];await send({type:'apply',data:{...JSON.parse(settings.getPluginData('exui')),shownBy:'navigation'}});
      fixture.page.selection=[button as any];
    }
    const sourceSignature=scenario==='fractional-lines'?designSignature(frame):undefined;
    if(!automatic)await send({ type: 'check' });
    await send({ type: 'export',profile,...(automaticMembers?{scopeMode:'selected-frames'}:{}) });
    assert.deepEqual(fixture.messages.filter(m => m.type === 'error'), [], JSON.stringify(fixture.messages));
    if(sourceSignature)assert.equal(designSignature(frame),sourceSignature);
    const bundle = fixture.messages.find(m => m.type === 'bundle')!.bundle as Bundle;
    if(automatic){if(originalControl)assert.equal(designSignature(originalControl),originalSignature);const before=designSignature(figma.currentPage);await send({type:'export',profile,...(automaticMembers?{scopeMode:'selected-frames'}:{})});assert.equal(designSignature(figma.currentPage),before);assert.deepEqual(packageExui(fixture.messages.filter(m=>m.type==='bundle').at(-1)!.bundle as Bundle),packageExui(bundle));}
    const input = path.join(out, `${scenario}-${profile}.exui`);
    await writeFile(input, packageExui(bundle), { flag: 'wx' });
    const validation = cli(['validate-package', input]);
    assert.equal(validation.contract, 'exui/5');
    // The first selected page stays the start page; GUI Designer lists it first, then frame-name order.
    if(batch){assert.ok('pages' in bundle.screen);assert.deepEqual(Array.from(bundle.screen.pages,p=>[p.name,p.shownBy]),[['screen_Main','start'],['screen_AudioControl','navigation']]);assert.equal(bundle.screen.pages[0].elements.find(e=>e.kind==='button')!.navigate,'page.audiocontrol');}
    if(scenario==='section'){
      assert.ok('pages' in bundle.screen);assert.equal(bundle.screen.pages.length,2);assert.equal(bundle.screen.popups.length,4);
      const map=spawnSync(process.env.DOTNET_EXE??'dotnet',[path.join(installed,'cli/Extron.Cli.dll'),'id-map',input],{cwd:out,encoding:'utf8',timeout:30000});
      assert.equal(map.status,0,map.stderr);assert.ok(map.stdout.includes('screen_Settings'));
    }
    const gdl = path.join(out, `${scenario}-${profile}.gdl`);
    const generation = cli(['convert-package', input, gdl, '--registry', process.env.EXUI_DONOR_REGISTRY??path.join(installed, 'samples/donors.json')]);
    const report = JSON.parse(await readFile(gdl + '.report.json', 'utf8'));
    assert.ok(report.Generation.Checks.every((c: { Passed: boolean }) => c.Passed));
    if(batch&&'pages' in bundle.screen){
      const model=cli(['list-controls',gdl]).model,start=bundle.screen.pages.find(p=>p.shownBy==='start')!;
      assert.deepEqual(model.Pages.map((p:any)=>p.Name),Array.from(bundle.screen.pages,p=>p.name));assert.equal(model.DefaultPage,start.objectId);
    }
    if(scenario==='alpha-lines'){
      const controls=cli(['list-controls',gdl]).model.Pages[0].Controls;
      assert.equal(validation.resources,0);assert.equal(bundle.resources.length,0);
      assert.deepEqual(controls.map((c:any)=>[c.Type,c.Native.Fill]),[
        ['PBLine',0x1AD2AE6D],['PBLine',0x40D2AE6D],['PBLine',0x00D2AE6D],['PBLine',0x1AD2AE6D],['PBLine',0x0DD2AE6D],
      ]);
      assert.deepEqual([controls[0].Left,controls[0].Top,controls[0].Width,controls[0].Height],[0,frame.height-85,frame.width,2]);
    }
    if(scenario==='pen-lines'){
      const controls=cli(['list-controls',gdl]).model.Pages[0].Controls;
      assert.equal(validation.resources,0);assert.equal(bundle.resources.length,0);
      assert.deepEqual(controls.map((c:any)=>[c.Type,c.Left,c.Top,c.Width,c.Height,c.Native.Line.Thickness,c.Native.Line.Start,c.Native.Line.End,c.Native.Fill]),[
        ['PBLine',20,39,100,2,2,6,2,0xFF6699CC],
        ['PBLine',179,40,2,100,2,0,4,0xFF6699CC],
        ['PBLine',20,180,100,1,1,6,2,0xFF6699CC],
        ['PBLine',20,218,100,4,4,6,2,0xFFCC9933],
      ]);
    }
    if(scenario==='fractional-lines'){
      const controls=cli(['list-controls',gdl]).model.Pages[0].Controls;
      assert.equal(validation.resources,0);assert.equal(bundle.resources.length,0);
      assert.deepEqual(controls.map((c:any)=>[c.Type,c.Left,c.Top,c.Width,c.Height,c.Native.Line.Thickness,c.Native.Line.Start,c.Native.Line.End,c.Native.Fill]),[
        ['PBLine',20,40,100,1,1,6,2,0xFF6699CC],
        ['PBLine',180,40,2,101,2,0,4,0xFF6699CC],
        ['PBLine',20,180,100,1,1,6,2,0xFF6699CC],
        ['PBLine',310,18,2,48,2,0,4,0xFFCC9933],
      ]);
    }
    if(scenario==='dotted-name'){
      const button=cli(['list-controls',gdl]).model.Pages[0].Controls.find((c:any)=>c.Comments==='exui-key=home.side.hall');
      assert.ok(button);assert.equal(button.Name,'button_side.hall');assert.deepEqual(button.States.map((s:any)=>s.Name),['Passive','Active']);assert.equal(button.PressFeedbackState,-1);
    }
    if(scenario==='many-assets'){
      const expected=profile==='tlp-pro-1025m'?36:18;assert.equal(validation.resources,expected);
      const buttons=cli(['list-controls',gdl]).model.Pages[0].Controls;
      assert.equal(buttons.length,expected/3);assert.ok(buttons.every((c:any)=>c.Type==='PBButton'&&c.States.length===3&&c.States.every((s:any)=>s.Image)));
    }
    if(scenario==='on-off'||scenario==='feedback'){
      const controls=cli(['list-controls',gdl]).model.Pages[0].Controls;
      for(const button of controls.filter((c:any)=>c.Type==='PBButton')){
        assert.deepEqual(button.States.map((s:any)=>s.Name),scenario==='on-off'?['Off','On']:['Normal','Active','Pressed']);
        assert.equal(button.PressFeedbackState,scenario==='on-off'?-1:2);
      }
    }
    if (scenario === 'blank-caption') {
      const controls = cli(['list-controls', gdl]).model.Pages[0].Controls;
      const button = controls.find((c: any) => c.Comments === 'exui-key=home.volumeup');
      assert.ok(button.States.length > 0 && button.States.every((s: any) => s.Text === ''));
      assert.ok(controls.find((c: any) => c.Comments === 'exui-key=home.volumevalue').Text.length > 0);
    }
    evidence.push({ version, profile, scenario, validation, generation, boundary: 'Archived main bundle + fake Figma API/PNG + packageExui from source; packaged native CLI. Browser UI, Desktop and device not exercised by this script.' });
    console.log(`PASS archive ${version}: ${scenario} / ${profile} → ${generation.checks}`);
  }
}
await writeFile(path.join(out, 'archive-smoke.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
