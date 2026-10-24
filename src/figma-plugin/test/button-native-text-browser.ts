// Actual bundled UI and plugin bridge; the Figma API is explicitly modeled.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { authorButtons } from './button-preparation-fixture.ts';
import { prepareButtons } from '../src/button-preparation.ts';
import { recognize, applyRecognition } from '../src/recognize.ts';
import { BUTTON_TEXT_KEY } from '../src/button-native-text.ts';
import { capture } from '../src/export.ts';

const root=path.resolve(import.meta.dirname,'../../..'),out=path.resolve(process.argv[2]??path.join(root,'output/button-native-text-browser'));
await mkdir(out,{recursive:true});
const f=authorButtons();prepareButtons(f.root);
for(const b of f.buttons)for(const s of b.children)s.children.find(n=>n.type==='TEXT')!.fontName={family:'Inter',style:'Regular'};
applyRecognition(recognize(f.root,'tlp-pro-1025m'));f.page.selection=[f.root as never];
vm.runInNewContext(await readFile(path.join(root,'src/figma-plugin/dist/code.js'),'utf8'),{figma:f.api,Uint8Array,console});
const dispatch=f.api.ui.onmessage as (m:unknown)=>Promise<void>,ui=await readFile(path.join(root,'src/figma-plugin/dist/ui.html'));
const host='<!doctype html><style>body{margin:0}iframe{border:0;width:100vw;height:100vh}</style><iframe src="/ui"></iframe><script>window.sendMessages=messages=>messages.forEach(m=>document.querySelector("iframe").contentWindow.postMessage({pluginMessage:m},location.origin));window.onmessage=async e=>{if(e.source===document.querySelector("iframe").contentWindow&&e.data.pluginMessage)window.sendMessages(await window.dispatchPlugin(e.data.pluginMessage));};</script>';
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/ui'?ui:host);});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true}),errors:string[]=[];
try{
  const page=await browser.newPage({viewport:{width:420,height:720}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.exposeFunction('dispatchPlugin',async(m:unknown)=>{const start=f.messages.length;await dispatch(m);return f.messages.slice(start);});
  await page.goto(`http://127.0.0.1:${(server.address() as {port:number}).port}`);
  const frame=page.frameLocator('iframe');await frame.locator('#buttonText').waitFor();
  await page.evaluate(messages=>(window as any).sendMessages(messages),f.messages);
  await frame.locator('#buttonText > summary').focus();await page.keyboard.press('Enter');
  await frame.locator('#applyButtonText').click();
  await frame.locator('#buttonTextResult').filter({hasText:'Текст для GCP настроен: 2'}).waitFor();
  assert.ok(f.buttons.every(b=>b.getPluginData(BUTTON_TEXT_KEY)==='bottom-center'));
  assert.ok(capture(f.root).screen.elements.every(e=>e.kind==='button'&&e.states!.every(s=>!!s.text)));
  for(const width of [320,420]){
    await page.setViewportSize({width,height:720});
    await frame.locator('#buttonText').evaluate(e=>e.scrollIntoView({block:'start'}));
    assert.ok(await frame.locator('body').evaluate(e=>e.scrollWidth<=e.clientWidth));
    await page.screenshot({path:path.join(out,`ui-${width}.png`)});
  }
  await frame.locator('#buttonTextMode').selectOption('design');await frame.locator('#applyButtonText').click();
  await frame.locator('#buttonTextResult').filter({hasText:'Восстановлен экспорт'}).waitFor();
  assert.ok(f.buttons.every(b=>!b.getPluginData(BUTTON_TEXT_KEY)));
  // Scope is live: selecting one button changes only that button.
  let start=f.messages.length;f.page.selection=[f.buttons[0] as never];f.emit('selectionchange');
  await page.evaluate(messages=>(window as any).sendMessages(messages),f.messages.slice(start));
  await frame.locator('#buttonTextMode').selectOption('middle-center');await frame.locator('#applyButtonText').click();
  await frame.locator('#buttonTextResult').filter({hasText:'Текст для GCP настроен: 1'}).waitFor();
  assert.equal(f.buttons[0].getPluginData(BUTTON_TEXT_KEY),'middle-center');assert.equal(f.buttons[1].getPluginData(BUTTON_TEXT_KEY),'');
  start=f.messages.length;f.page.selection=[];f.emit('selectionchange');
  await page.evaluate(messages=>(window as any).sendMessages(messages),f.messages.slice(start));
  await frame.locator('#applyButtonText:disabled').waitFor();
  assert.deepEqual(errors,[]);
  await writeFile(path.join(out,'browser.json'),JSON.stringify({passed:true,checks:['keyboard disclosure','320/420 widths','real UI-to-plugin command','native caption export','restore design mode','live selection isolation','empty selection disabled'],errors,boundary:'Chromium, built UI/plugin; modeled Figma API'},null,2)+'\n');
  console.log('PASS native text UI: scope, native export, reversal, keyboard and responsive layout');
}finally{await browser.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
