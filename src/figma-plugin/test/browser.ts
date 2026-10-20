// Real Chromium + real built UI/ZIP code. Parent messages simulate the Figma host explicitly.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fakeFigma, icons } from './fake-figma.ts';
import { createDemo } from '../src/demo.ts';
import { exportFrame } from '../src/export.ts';
import { unzipSync, strFromU8 } from 'fflate';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.resolve(process.argv[2]??path.join(root,'output/figma-plugin/browser-'+Date.now()));await mkdir(out,{recursive:true});
const bundles:Record<string,unknown>={};
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){fakeFigma();const b=await exportFrame(await createDemo(profile,icons()));bundles[profile]={...b,resources:b.resources.map(r=>({...r,bytes:[...r.bytes]}))};}
const ui=await readFile(path.join(root,'src/figma-plugin/dist/ui.html'));
const host=`<!doctype html><meta charset=utf-8><title>Extron plugin UI harness — Figma host mocked</title><style>body{margin:0}iframe{width:420px;height:900px;border:0}</style><script>
const bundles=${JSON.stringify(bundles).replace(/</g,'\\u003c')};let profile='tlp-pro-1025m';window.failExport=false;window.lastMapping=null;
window.bridgeMessages=0;window.lastPreparation=null;window.failRecognition=false;window.lastRecognitionApply=null;window.lastPreview=null;
const send=m=>{const target=document.querySelector('iframe').contentWindow;if(new URLSearchParams(location.search).get('transport')==='bridge'){target.dispatchEvent(new target.MessageEvent('message',{data:{pluginMessage:m}}));window.bridgeMessages++;}else target.postMessage({pluginMessage:m},location.origin);};
window.onmessage=e=>{if(e.source!==document.querySelector('iframe').contentWindow)return;const m=e.data.pluginMessage;if(!m)return;
if(m.type==='ready')send({type:'selection',id:null,name:'Выберите один элемент или Frame экрана'});
if(m.type==='demo'){profile=m.profile;send({type:'selection',id:'demo',name:'Главная',nodeType:'FRAME',metadata:{kind:'page',key:'page.home',objectId:100,projectName:'Демо',profile}});send({type:'success',message:'Демо создано. Можно редактировать и экспортировать выбранный экран.'});}
if(m.type==='prepare'){window.lastPreparation=m;profile=m.profile;send({type:'selection',id:'custom',name:'Свой экран',nodeType:'FRAME',metadata:{kind:'page',key:'page.home',objectId:100,projectName:'Свой экран',profile}});send({type:'success',message:'Назначение «Экран» сохранено. Далее назначьте элементы.'});}
if(m.type==='check')send({type:'success',message:'Экран проверен: 4 элемента, 2 PNG.'});
if(m.type==='apply'){window.lastMapping=m.data;send({type:'success',message:'Назначение сохранено в Figma-узле.'});}
if(m.type==='preview'){window.lastPreview=m;send({type:'success',message:'Состояние показано.'});}
if(m.type==='recognize')send({type:'recognition',token:7,rows:[{id:'button',name:'button_Music',kind:'button',key:'home.music',objectId:1,controlId:8101,isNew:true}],errors:window.failRecognition?['Повтор ключа home.music']:[],warnings:[]});
if(m.type==='apply-recognition'){window.lastRecognitionApply=m;send({type:'selection',id:'custom',name:'Home',nodeType:'FRAME',metadata:{kind:'page',key:'page.home',objectId:100,projectName:'Home',profile:m.profile}});send({type:'success',message:'Назначения сохранены. Можно скачать .exui.'});}
if(m.type==='export'){if(window.failExport)send({type:'error',message:'PNG не экспортирован: тестовый отказ рендера'});else {const bundle=structuredClone(bundles[profile]);bundle.resources.forEach(r=>r.bytes=new Uint8Array(r.bytes));send({type:'bundle',bundle});}}
send({type:'idle'});};</script><iframe title="Figma → Extron" src="/ui.html"></iframe>`;
const server=createServer((req,res)=>{const route=req.url?.split('?')[0];if(route==='/ui.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(ui);}else if(route==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(host);}else{res.statusCode=404;res.end();}});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address() as {port:number};
let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:420,height:900},acceptDownloads:true});
 const failures:string[]=[];page.on('pageerror',e=>failures.push(e.message));page.on('requestfailed',r=>failures.push(r.url()));
 await page.goto(`http://127.0.0.1:${address.port}/`);const frame=page.frameLocator('iframe');
 await frame.getByRole('button',{name:'Создать демо для этого профиля'}).waitFor();assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).isDisabled(),true);
 await frame.getByLabel('Профиль панели').focus();await page.keyboard.press('Tab');
 assert.equal(await frame.getByText('Справочник префиксов и состояний',{exact:true}).evaluate(el=>el===el.ownerDocument.activeElement),true);
 await page.keyboard.press('Enter');
 await frame.getByRole('cell',{name:'logo_Company',exact:true}).first().waitFor();
 await frame.getByRole('cell',{name:'button_VolumeUp',exact:true}).waitFor();
 await frame.getByRole('cell',{name:'slider_Volume',exact:true}).waitFor();
 await frame.getByRole('cell',{name:'value_VolumeValue',exact:true}).waitFor();
 assert.equal(await frame.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await page.screenshot({path:path.join(out,'prefix-reference.png'),fullPage:true});
 await page.keyboard.press('Enter');await page.keyboard.press('Tab');
 assert.equal(await frame.getByRole('button',{name:'Создать демо для этого профиля'}).evaluate(el=>el===el.ownerDocument.activeElement),true);
 // Custom frame onboarding is distinct from the optional demo.
 await page.evaluate(()=>document.querySelector('iframe')!.contentWindow!.postMessage({pluginMessage:{type:'selection',id:'custom',name:'Свой экран',nodeType:'FRAME',metadata:null}},location.origin));
 await frame.getByRole('button',{name:'Подготовить выбранный экран',exact:true}).waitFor();
 await frame.getByText('Это собственный макет без назначения Extron.',{exact:false}).waitFor();
 await frame.getByLabel('Профиль панели').selectOption('tlp-pro-1025m');
 await frame.getByRole('button',{name:'Подготовить выбранный экран',exact:true}).click();
 await frame.getByRole('status').filter({hasText:'Далее назначьте элементы'}).waitFor();
 assert.equal(await page.evaluate(()=>(window as any).lastPreparation.profile),'tlp-pro-1025m');
 assert.equal(await frame.getByRole('button',{name:'Подготовить выбранный экран',exact:true}).isVisible(),false);
 await frame.getByText('Назначение выбранного элемента',{exact:true}).click();
 assert.equal(await frame.getByLabel('ID объекта',{exact:true}).inputValue(),'100');
 assert.equal(await frame.getByLabel('Имя проекта',{exact:true}).inputValue(),'Свой экран');
 await frame.getByText('Назначение выбранного элемента',{exact:true}).click();
 // Review-before-write, failure recovery and profile invalidation.
 await frame.getByRole('button',{name:'Распознать по именам',exact:true}).click();
 await frame.getByRole('cell',{name:'home.music',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>(window as any).lastRecognitionApply),null);
 await frame.getByRole('region',{name:'Результат распознавания'}).focus();
 await page.keyboard.press('Tab');assert.equal(await frame.getByRole('button',{name:'Сохранить распознанные назначения'}).evaluate(el=>el===el.ownerDocument.activeElement),true);
 await page.screenshot({path:path.join(out,'recognition-ui.png'),fullPage:true});
 await frame.getByRole('button',{name:'Сохранить распознанные назначения'}).click();
 await frame.getByRole('status').filter({hasText:'Назначения сохранены.'}).waitFor();
 assert.equal(await page.evaluate(()=>(window as any).lastRecognitionApply.token),7);
 await page.evaluate(()=>{(window as any).failRecognition=true;});
 await frame.getByRole('button',{name:'Распознать по именам',exact:true}).click();
 await frame.getByRole('alert').filter({hasText:'Исправьте ошибки'}).waitFor();
 assert.equal(await frame.getByRole('button',{name:'Сохранить распознанные назначения'}).isDisabled(),true);
 await page.evaluate(()=>{(window as any).failRecognition=false;});
 await frame.getByRole('button',{name:'Распознать по именам',exact:true}).click();
 await frame.getByRole('cell',{name:'home.music',exact:true}).waitFor();
 await frame.getByLabel('Профиль панели').selectOption('tlp-pro-300m-portrait');
 assert.equal(await frame.getByRole('region',{name:'Результат распознавания'}).isVisible(),false);
 for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait']){
  await frame.getByLabel('Профиль панели').selectOption(profile);await frame.getByRole('button',{name:'Создать демо для этого профиля'}).click();
  await frame.getByRole('button',{name:'Проверить экран'}).click();await frame.getByRole('status').filter({hasText:'Экран проверен'}).waitFor();
  const pending=page.waitForEvent('download');await frame.getByRole('button',{name:'Скачать .exui',exact:true}).click();const download=await pending;
  assert.equal(download.suggestedFilename(),`interface-${profile}.exui`);const file=path.join(out,download.suggestedFilename());await download.saveAs(file);
  const files=unzipSync(await readFile(file));const manifest=JSON.parse(strFromU8(files['manifest.json']));assert.equal(manifest.profile,profile);assert.equal(Object.keys(files).length,4);
  await frame.getByRole('status').filter({hasText:'Пакет готов'}).waitFor();
 }
 await frame.getByText('Назначение выбранного элемента',{exact:true}).click();await frame.getByLabel('Семантический ключ',{exact:true}).fill('page.home');await frame.getByRole('button',{name:'Сохранить назначение'}).click();
 await page.waitForFunction(()=> (window as any).lastMapping!==null);
 assert.equal(await page.evaluate(()=> (window as any).lastMapping.objectId),'100');
 await page.evaluate(()=>document.querySelector('iframe')!.contentWindow!.postMessage({pluginMessage:{type:'selection',id:'logo',name:'logo_Company',nodeType:'FRAME',metadata:{kind:'graphic',key:'home.company',objectId:5,controlId:null,file:'assets/company.png',resourceName:'company.png'}}},location.origin));
 await frame.getByLabel('Файл PNG в пакете',{exact:true}).waitFor();
 assert.equal(await frame.locator('#kind').inputValue(),'graphic');
 assert.equal(await frame.getByLabel('ID управления Extron',{exact:true}).isVisible(),false);
 await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).click();
 await page.waitForFunction(()=>(window as any).lastMapping.kind==='graphic');
 // Expanded native mapping and program instructions remain distinct visible fields.
 await page.evaluate(()=>document.querySelector('iframe')!.contentWindow!.postMessage({pluginMessage:{type:'selection',id:'slider',name:'slider_Volume',nodeType:'FRAME',metadata:{kind:'slider',key:'home.volume',objectId:6,controlId:8206,min:0,max:100,orientation:'left-to-right',behavior:{enabled:true,visible:false}}}},location.origin));
 await frame.getByLabel('Направление').selectOption('bottom-to-top');
 await frame.getByLabel('Максимум',{exact:true}).fill('255');
 assert.equal(await frame.getByLabel('Видимость при запуске').inputValue(),'false');
 await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).click();
 await page.waitForFunction(()=>(window as any).lastMapping.kind==='slider'&&(window as any).lastMapping.max==='255');
 assert.equal(await page.evaluate(()=>(window as any).lastMapping.orientation),'bottom-to-top');
 await page.screenshot({path:path.join(out,'slider-mapping.png'),fullPage:true});
 await frame.getByLabel('Назначение').selectOption('value');
 assert.equal(await frame.getByLabel('ID управления Extron',{exact:true}).isVisible(),true);
 await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).click();await page.waitForFunction(()=>(window as any).lastMapping.kind==='value');
 await frame.getByLabel('Назначение').selectOption('datetime');
 assert.equal(await frame.getByLabel('ID управления Extron',{exact:true}).isVisible(),false);
 await frame.getByLabel('Формат даты/времени',{exact:true}).fill('HH:mm');
 await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).click();await page.waitForFunction(()=>(window as any).lastMapping.pattern==='HH:mm');
 await frame.getByLabel('Назначение').selectOption('popup-ref');
 await frame.getByLabel('Ключ popup',{exact:true}).fill('popup.sources');
 await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).click();await page.waitForFunction(()=>(window as any).lastMapping.popup==='popup.sources');
 await page.evaluate(()=>document.querySelector('iframe')!.contentWindow!.postMessage({pluginMessage:{type:'selection',id:'multistate-button',name:'button_Connection',nodeType:'FRAME',metadata:{kind:'button',key:'home.connection',objectId:9,controlId:8209},states:[{stateId:0,name:'Normal',role:'normal'},{stateId:1,name:'Ready',role:'feedback'},{stateId:2,name:'Error',role:'feedback'},{stateId:3,name:'Pressed',role:'pressed'}]}},location.origin));
 await frame.getByLabel('Просмотр состояния').selectOption('id:2');await frame.getByRole('button',{name:'Показать состояние',exact:true}).click();await page.waitForFunction(()=>(window as any).lastPreview?.stateId===2);
 await page.evaluate(()=>{(window as any).failExport=true;});await frame.getByRole('button',{name:'Скачать .exui',exact:true}).click();await frame.getByRole('alert').filter({hasText:'тестовый отказ'}).waitFor();
 assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).isEnabled(),true);assert.equal(await frame.getByRole('link',{name:'Скачать пакет повторно'}).isVisible(),false);
 // Host-provided names are treated as text, never markup.
 await page.evaluate(()=>{const iframe=document.querySelector('iframe')!;iframe.contentWindow!.postMessage({pluginMessage:{type:'selection',id:'injection',name:'<img src=x onerror=alert(1)>',nodeType:'FRAME'}},location.origin);});
 await frame.getByText('<img src=x onerror=alert(1)> · FRAME',{exact:true}).waitFor();assert.equal(await frame.locator('img').count(),0);
 await page.evaluate(()=>{const w=document.querySelector('iframe')!.contentWindow!;w.postMessage({pluginMessage:{type:'selection',id:'demo',name:'Главная',nodeType:'FRAME',metadata:{kind:'page',key:'page.home',objectId:100,projectName:'Демо',profile:'tlp-pro-300m-portrait'}}},location.origin);w.postMessage({pluginMessage:{type:'success',message:'Экран проверен: 4 элемента, 2 PNG. Готов к экспорту.'}},location.origin);});
 await frame.getByRole('status').filter({hasText:'Готов к экспорту'}).waitFor();
 await page.screenshot({path:path.join(out,'ui.png'),fullPage:true});
 // A platform bridge can dispatch MessageEvent without a Window source. The API
 // guarantees event.data.pluginMessage, not event.source === parent.
 await page.goto(`http://127.0.0.1:${address.port}/?transport=bridge`);
 await frame.getByRole('button',{name:'Создать демо для этого профиля'}).click();
 await page.waitForFunction(()=> (window as any).bridgeMessages>=4);
 await frame.getByText('Главная · FRAME',{exact:true}).waitFor({timeout:3000});
 assert.equal(await frame.getByRole('button',{name:'Создать демо для этого профиля'}).isEnabled(),true);
 assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).isEnabled(),true);
 await frame.getByRole('button',{name:'Проверить экран'}).click();
 await frame.getByRole('status').filter({hasText:'Экран проверен'}).waitFor();
 const bridgePending=page.waitForEvent('download');await frame.getByRole('button',{name:'Скачать .exui',exact:true}).click();
 const bridgeDownload=await bridgePending;await bridgeDownload.saveAs(path.join(out,'bridge-'+bridgeDownload.suggestedFilename()));
 assert.deepEqual(await readFile(path.join(out,'bridge-'+bridgeDownload.suggestedFilename())),await readFile(path.join(out,bridgeDownload.suggestedFilename())));
 await frame.getByRole('status').filter({hasText:'Пакет готов'}).waitFor();
 await page.screenshot({path:path.join(out,'bridge-ui.png'),fullPage:true});assert.deepEqual(failures,[]);
 await writeFile(path.join(out,'browser.json'),JSON.stringify({passed:true,browser:browser.version(),checks:['empty selection','keyboard navigation and expanded prefix table without horizontal overflow','custom Frame preparation command and metadata display','recognition preview, keyboard review, apply, error blocking and profile invalidation','both profile downloads','ZIP payload','explicit metadata form including passive graphic','slider orientation/range and behavior, dynamic label ID, datetime pattern, popup target fields','render error recovery','text injection','null-source bridge selection, idle, check and download'],boundary:'actual Chromium UI; Figma parent and null-source bridge messages mocked',pageErrors:failures},null,2)+'\n');
 console.log('PASS Chromium plugin UI: both downloads, metadata form, error recovery, no page errors. '+out);
}finally{await browser?.close();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
