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

const [archive, kit, output] = process.argv.slice(2);
assert.ok(archive && kit && output, 'Usage: node test/archive-smoke.ts <plugin.zip> <unpacked-kit> <new-output-dir>');
const files = unzipSync(new Uint8Array(await readFile(archive)));
const version = JSON.parse(strFromU8(files['version.json'])).version;
const manifest = JSON.parse(strFromU8(files['manifest.json']));
assert.equal(manifest.id, 'figma-extron-exporter-local-dev');
const ui = strFromU8(files[manifest.ui]);
assert.ok(ui.includes('Figma → Extron Exporter')&&ui.includes(`· ${version}`));
const out = path.resolve(output), installed = path.resolve(kit);
await mkdir(out, { recursive: true });
function cli(args: string[]) {
  const result = spawnSync(process.env.DOTNET_EXE ?? 'dotnet', [path.join(installed, 'cli/Extron.Cli.dll'), ...args], { cwd: out, encoding: 'utf8', timeout: 180000 });
  assert.equal(result.status, 0, result.stderr || result.stdout || String(result.error));
  return JSON.parse(result.stdout);
}
const evidence: unknown[] = [];
const scenarios=['blank-caption','expanded','on-off','feedback','dotted-name','many-assets','section'] as const;
const selectedScenarios=process.argv[5]?scenarios.filter(s=>s===process.argv[5]):scenarios.slice(0,4);
assert.ok(selectedScenarios.length,'Unknown archive smoke scenario');
for (const profile of ['tlp-pro-1025m', 'tlp-pro-300m-portrait'] as const) {
  for (const scenario of selectedScenarios) {
    const fixture = scenario==='many-assets'?kitFixture():fakeFigma();
    const frame = scenario==='section'?sectionFixture(profile):scenario==='many-assets'?await manyAssetsFixture(profile):scenario === 'expanded' ? expandedFixture(profile) : scenario==='on-off'||scenario==='feedback'||scenario==='dotted-name'?await namedFixture(profile,scenario!=='feedback'):await graphicFixture(profile);
    if(scenario==='dotted-name'){
      const button=frame.children[0] as FrameNode;button.name='button_side.hall';button.children.forEach((s,i)=>s.name=['Passive','Active'][i]);
    }
    if (scenario === 'blank-caption') {
      const button = frame.children[0] as FrameNode;
      for (const state of button.children as FrameNode[]) (state.children.find(n => n.type === 'TEXT') as TextNode).characters = '';
    }
    fixture.page.selection = [frame as any];
    let shownUi = '';
    (fixture.api as any).showUI = (html: string) => { shownUi = html; };
    runInNewContext(strFromU8(files[manifest.main]), { figma: fixture.api, Uint8Array, console }, { filename: `${archive}/${manifest.main}`, timeout: 10000 });
    assert.equal(shownUi, ui, 'Embedded UI must match the archived UI');
    const send = fixture.api.ui.onmessage as (message: unknown) => Promise<void>;
    await send({ type: 'recognize', profile });
    const plan = fixture.messages.find(m => m.type === 'recognition')!;
    assert.ok(plan, JSON.stringify(fixture.messages));
    assert.deepEqual(JSON.parse(JSON.stringify(plan.errors)), []);
    await send({ type: 'apply-recognition', profile, token: plan.token });
    if(scenario==='section'){
      const home=frame.children[0] as FrameNode,button=home.children.find(n=>n.name==='button_Connection')!,settings=frame.children[1];
      fixture.page.selection=[button as any];await send({type:'apply',data:{...JSON.parse(button.getPluginData('exui')),buttonMode:'legacy',navigate:'page.settings'}});
      fixture.page.selection=[settings as any];await send({type:'apply',data:{...JSON.parse(settings.getPluginData('exui')),shownBy:'navigation'}});
      fixture.page.selection=[button as any];
    }
    await send({ type: 'check' });
    await send({ type: 'export' });
    assert.deepEqual(fixture.messages.filter(m => m.type === 'error'), [], JSON.stringify(fixture.messages));
    const bundle = fixture.messages.find(m => m.type === 'bundle')!.bundle as Bundle;
    const input = path.join(out, `${scenario}-${profile}.exui`);
    await writeFile(input, packageExui(bundle), { flag: 'wx' });
    const validation = cli(['validate-package', input]);
    assert.equal(validation.contract, 'exui/5');
    if(scenario==='section'){
      assert.ok('pages' in bundle.screen);assert.equal(bundle.screen.pages.length,2);assert.equal(bundle.screen.popups.length,4);
      const map=spawnSync(process.env.DOTNET_EXE??'dotnet',[path.join(installed,'cli/Extron.Cli.dll'),'id-map',input],{cwd:out,encoding:'utf8',timeout:30000});
      assert.equal(map.status,0,map.stderr);assert.ok(map.stdout.includes('screen_Settings'));
    }
    const gdl = path.join(out, `${scenario}-${profile}.gdl`);
    const generation = cli(['convert-package', input, gdl, '--registry', path.join(installed, 'samples/donors.json')]);
    const report = JSON.parse(await readFile(gdl + '.report.json', 'utf8'));
    assert.ok(report.Generation.Checks.every((c: { Passed: boolean }) => c.Passed));
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
    evidence.push({ version, profile, scenario, validation, generation, boundary: 'Archived main bundle + fake Figma API/PNG + packageExui from source; packaged native CLI. Archived UI download tested separately in Chromium; Desktop/device not exercised.' });
    console.log(`PASS archive ${version}: ${scenario} / ${profile} → ${generation.checks}`);
  }
}
await writeFile(path.join(out, 'archive-smoke.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
