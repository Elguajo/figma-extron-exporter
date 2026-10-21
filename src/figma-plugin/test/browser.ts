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
import { sectionFixture } from './expanded-fixture.ts';
import { recognize,applyRecognition } from '../src/recognize.ts';
import { unzipSync, strFromU8 } from 'fflate';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.resolve(process.argv[2]??path.join(root,'output/figma-plugin/browser-'+Date.now()));await mkdir(out,{recursive:true});
const bundles:Record<string,unknown>={};
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){fakeFigma();const b=await exportFrame(await createDemo(profile,icons()));bundles[profile]={...b,resources:b.resources.map(r=>({...r,bytes:[...r.bytes]}))};}
fakeFigma();const section=sectionFixture();applyRecognition(recognize(section,'tlp-pro-1025m'));bundles.section=await exportFrame(section);
const ui=await readFile(process.env.EXUI_PLUGIN_UI??path.join(root,'src/figma-plugin/dist/ui.html'));
const host=`<!doctype html><meta charset=utf-8><title>Extron plugin UI harness — Figma host mocked</title><style>body{margin:0}iframe{display:block;width:100vw;height:100vh;border:0}</style><script>
const bundles=${JSON.stringify(bundles).replace(/</g,'\\u003c')};let profile='tlp-pro-1025m';window.failExport=false;window.lastMapping=null;
window.currentSelection=null;window.useSection=false;window.holdCommand=false;window.bridgeMessages=0;window.lastPreparation=null;window.failRecognition=false;window.lastRecognitionApply=null;window.lastPreview=null;window.lastKitProfile=null;
const send=m=>{const target=document.querySelector('iframe').contentWindow;if(new URLSearchParams(location.search).get('transport')==='bridge'){target.dispatchEvent(new target.MessageEvent('message',{data:{pluginMessage:m}}));window.bridgeMessages++;}else target.postMessage({pluginMessage:m},location.origin);};
window.selectNode=m=>{if(m.metadata?.profile)profile=m.metadata.profile;window.currentSelection=m;send({type:'selection',...m,scope:m.scope??(m.metadata?{id:m.id,name:m.name,kind:m.metadata.kind==='project'?'project':'page',profile}:undefined)});};
window.onmessage=e=>{if(e.source!==document.querySelector('iframe').contentWindow)return;const m=e.data.pluginMessage;if(!m)return;
if(m.type==='ready')window.selectNode({id:null,name:'Выберите секцию проекта или Frame экрана'});if(window.holdCommand)return;
if(m.type==='kit'){window.lastKitProfile=m.profile;send({type:'success',message:'Extron Kit создан: 30 компонентов и шаблоны проекта.'});}
if(m.type==='prepare'){window.lastPreparation=m;profile=m.profile;window.selectNode({id:'custom',name:'Свой экран',nodeType:'FRAME',metadata:{kind:'page',key:'page.home',objectId:100,projectName:'Свой экран',profile}});send({type:'success',message:'Назначение «Экран» сохранено. Далее назначьте элементы.'});}
if(m.type==='check')send({type:'success',message:'Экран проверен: 4 элемента, 2 PNG.'});
if(m.type==='apply'){window.lastMapping=m.data;send({type:'success',message:'Назначение сохранено в Figma-узле.'});}
if(m.type==='preview'){window.lastPreview=m;send({type:'success',message:'Состояние показано.'});}
if(m.type==='recognize')send({type:'recognition',token:7,rows:[{id:'button',name:'button_Music',kind:'button',key:'home.music',objectId:1,controlId:8101,isNew:true}],errors:window.failRecognition?['Повтор ключа home.music']:[],warnings:[]});
if(m.type==='apply-recognition'){window.lastRecognitionApply=m;window.selectNode({...window.currentSelection,metadata:{kind:window.currentSelection.nodeType==='SECTION'?'project':'page',key:window.currentSelection.nodeType==='SECTION'?'project.section':'page.home',objectId:100,projectName:window.currentSelection.name,profile:m.profile}});send({type:'success',message:'Назначения сохранены. Можно скачать .exui.'});}
if(m.type==='export'){if(window.failExport)send({type:'error',message:'PNG не экспортирован: тестовый отказ рендера'});else {const bundle=structuredClone(bundles[window.useSection?'section':profile]);bundle.resources.forEach(r=>r.bytes=new Uint8Array(r.bytes));send({type:'bundle',bundle});}}
send({type:'idle'});};</script><iframe title="Figma → Extron" src="/ui.html"></iframe>`;
const server=createServer((req,res)=>{const route=req.url?.split('?')[0];if(route==='/ui.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(ui);}else if(route==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(host);}else{res.statusCode=404;res.end();}});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address() as {port:number};
let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:420,height:720},acceptDownloads:true});
 const failures:string[]=[];page.on('pageerror',e=>failures.push(e.message));page.on('requestfailed',r=>failures.push(r.url()));
 await page.goto(`http://127.0.0.1:${address.port}/`);const frame=page.frameLocator('iframe');
 await frame.getByRole('button',{name:'Скачать .exui',exact:true}).waitFor();
 assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).isDisabled(),true);
 assert.equal(await frame.locator('#demo').count(),0);
 await frame.getByText('Библиотека компонентов',{exact:true}).click();
 await frame.getByRole('button',{name:'Создать Extron Kit',exact:true}).click();await frame.getByRole('status').filter({hasText:'Extron Kit создан'}).waitFor();assert.equal(await page.evaluate(()=>(window as any).lastKitProfile),'tlp-pro-1025m');
 await frame.getByText('Библиотека компонентов',{exact:true}).click();
 await frame.getByText('Справочник префиксов и состояний',{exact:true}).focus();await page.keyboard.press('Enter');
 await frame.getByRole('cell',{name:'logo_Company',exact:true}).first().waitFor();
 await frame.getByRole('cell',{name:'button_VolumeUp',exact:true}).waitFor();
 await frame.getByRole('cell',{name:'slider_Volume',exact:true}).waitFor();
 await frame.getByRole('cell',{name:'value_VolumeValue',exact:true}).waitFor();
 assert.equal(await frame.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await page.screenshot({path:path.join(out,'prefix-reference.png'),fullPage:true});
 await frame.getByText('Справочник префиксов и состояний',{exact:true}).focus();await page.keyboard.press('Enter');
 await frame.getByLabel('Профиль панели').focus();await page.keyboard.press('Tab');
 assert.equal(await frame.getByText('Назначение выбранного элемента',{exact:true}).evaluate(el=>el===el.ownerDocument.activeElement),true);
 await frame.locator('main').evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.join(out,'empty.png')});
 // Manual frame preparation remains available in the collapsed editor.
 await page.evaluate(()=>(window as any).selectNode({id:'custom',name:'Свой экран',nodeType:'FRAME',metadata:null}));
 await frame.getByText('Назначение выбранного элемента',{exact:true}).click();
 await frame.getByRole('button',{name:'Подготовить выбранный экран',exact:true}).waitFor();
 await frame.getByText('Ручная подготовка Frame без распознавания дочерних элементов.',{exact:true}).waitFor();
 await frame.getByLabel('Профиль панели').selectOption('tlp-pro-1025m');
 await frame.getByRole('button',{name:'Подготовить выбранный экран',exact:true}).click();
 await frame.getByRole('status').filter({hasText:'Далее назначьте элементы'}).waitFor();
 assert.equal(await page.evaluate(()=>(window as any).lastPreparation.profile),'tlp-pro-1025m');
 assert.equal(await frame.getByRole('button',{name:'Подготовить выбранный экран',exact:true}).isVisible(),false);
 assert.equal(await frame.getByLabel('ID объекта',{exact:true}).inputValue(),'100');
 assert.equal(await frame.getByLabel('Имя проекта',{exact:true}).inputValue(),'Свой экран');
 await frame.getByText('Назначение выбранного элемента',{exact:true}).click();
 // Review-before-write, failure recovery and profile invalidation.
 await frame.getByRole('button',{name:'Распознать по именам',exact:true}).click();
 await frame.getByRole('list',{name:'Результат распознавания'}).getByText('home.music',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>(window as any).lastRecognitionApply),null);
 await frame.getByRole('list',{name:'Результат распознавания'}).focus();
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
 await frame.getByRole('list',{name:'Результат распознавания'}).getByText('home.music',{exact:false}).waitFor();
 await frame.getByLabel('Профиль панели').selectOption('tlp-pro-300m-portrait');
 assert.equal(await frame.getByRole('list',{name:'Результат распознавания'}).isVisible(),false);
 for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait']){
  await page.evaluate(profile=>(window as any).selectNode({id:'screen-'+profile,name:'Home',nodeType:'FRAME',metadata:{kind:'page',key:'page.home',objectId:100,projectName:'Home',profile}}),profile);
  await frame.getByRole('button',{name:'Проверить макет'}).click();await frame.getByRole('status').filter({hasText:'Экран проверен'}).waitFor();
  const pending=page.waitForEvent('download');await frame.getByRole('button',{name:'Скачать .exui',exact:true}).click();const download=await pending;
  assert.equal(download.suggestedFilename(),`interface-${profile}.exui`);const file=path.join(out,download.suggestedFilename());await download.saveAs(file);
  const files=unzipSync(await readFile(file));const manifest=JSON.parse(strFromU8(files['manifest.json']));assert.equal(manifest.profile,profile);assert.equal(Object.keys(files).length,4);
  await frame.getByRole('status').filter({hasText:'Пакет готов'}).waitFor();
 }
 await frame.getByText('Назначение выбранного элемента',{exact:true}).click();await frame.getByLabel('Семантический ключ',{exact:true}).fill('page.home');await frame.getByRole('button',{name:'Сохранить назначение'}).click();
 await page.waitForFunction(()=> (window as any).lastMapping!==null);
 assert.equal(await page.evaluate(()=> (window as any).lastMapping.objectId),'100');
 await page.evaluate(()=>(window as any).selectNode({id:'logo',name:'logo_Company',nodeType:'FRAME',metadata:{kind:'graphic',key:'home.company',objectId:5,controlId:null,file:'assets/company.png',resourceName:'company.png'}}));
 await frame.getByLabel('Файл PNG в пакете',{exact:true}).waitFor();
 assert.equal(await frame.locator('#kind').inputValue(),'graphic');
 assert.equal(await frame.getByLabel('ID управления Extron',{exact:true}).isVisible(),false);
 await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).click();
 await page.waitForFunction(()=>(window as any).lastMapping.kind==='graphic');
 // Expanded native mapping and program instructions remain distinct visible fields.
 await page.evaluate(()=>(window as any).selectNode({id:'slider',name:'slider_Volume',nodeType:'FRAME',metadata:{kind:'slider',key:'home.volume',objectId:6,controlId:8206,min:0,max:100,orientation:'left-to-right',behavior:{enabled:true,visible:false}}}));
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
 await page.evaluate(()=>(window as any).selectNode({id:'typed-button',name:'button_Music',nodeType:'FRAME',metadata:{kind:'button',buttonMode:'on-off',key:'home.music',objectId:1,controlId:8101},states:[{stateId:0,name:'Off',role:'normal'},{stateId:1,name:'On',role:'feedback'}]}));
 await frame.getByLabel('Тип кнопки',{exact:true}).waitFor();assert.equal(await frame.getByLabel('Тип кнопки',{exact:true}).inputValue(),'on-off');
 assert.equal(await frame.getByLabel('Просмотр состояния').locator('option').count(),2);
 assert.deepEqual(await frame.locator('#buttonMode option[value="legacy"]').evaluate((el:HTMLOptionElement)=>({disabled:el.disabled,hidden:el.hidden})),{disabled:true,hidden:true});
 await frame.getByLabel('Тип кнопки',{exact:true}).selectOption('feedback');
 await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).click();await page.waitForFunction(()=>(window as any).lastMapping.buttonMode==='feedback');
 await page.screenshot({path:path.join(out,'button-mode.png'),fullPage:true});
 for(const [id,buttonMode,names,roles] of [
  ['passive-active','on-off',['Passive','Active'],['normal','feedback']],
  ['momentary','on-off',['Normal','Pressed'],['normal','pressed']],
  ['feedback-two','feedback',['Normal','Active'],['normal','feedback']],
 ] as const){
  await page.evaluate(({id,buttonMode,names,roles})=>(window as any).selectNode({id,name:id,nodeType:'FRAME',metadata:{kind:'button',buttonMode},states:names.map((name,i)=>({stateId:i,name,role:roles[i]}))}),{id,buttonMode,names,roles});
  await frame.locator('#selection').filter({hasText:id}).waitFor();
  assert.deepEqual(await frame.getByLabel('Просмотр состояния').locator('option').allTextContents(),names.map((name,i)=>`${i} · ${name} · ${roles[i]}`));
  await frame.getByLabel('Просмотр состояния').selectOption('id:1');
  await frame.getByRole('button',{name:'Показать состояние',exact:true}).click();
  await page.waitForFunction(()=>(window as any).lastPreview?.stateId===1);
 }
 await page.evaluate(()=>(window as any).selectNode({id:'unmapped-button',name:'unmapped-button',nodeType:'FRAME',metadata:{kind:'button',buttonMode:'feedback'},states:[]}));
 await frame.locator('#selection').filter({hasText:'unmapped-button'}).waitFor();
 assert.equal(await frame.getByLabel('Просмотр состояния').locator('option').count(),0);
 assert.equal(await frame.getByRole('button',{name:'Показать состояние',exact:true}).isEnabled(),false);
 await page.evaluate(()=>(window as any).selectNode({id:'multistate-button',name:'button_Connection',nodeType:'FRAME',metadata:{kind:'button',key:'home.connection',objectId:9,controlId:8209},states:[{stateId:0,name:'Normal',role:'normal'},{stateId:1,name:'Ready',role:'feedback'},{stateId:2,name:'Error',role:'feedback'},{stateId:3,name:'Pressed',role:'pressed'}]}));
 await page.waitForFunction(()=> (document.querySelector('iframe')!.contentDocument!.querySelector('#buttonMode') as HTMLSelectElement).value==='legacy');
 await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).click();await page.waitForFunction(()=>(window as any).lastMapping.buttonMode==='legacy');
 await frame.getByLabel('Просмотр состояния').selectOption('id:2');await frame.getByRole('button',{name:'Показать состояние',exact:true}).click();await page.waitForFunction(()=>(window as any).lastPreview?.stateId===2);
 await page.evaluate(()=>{(window as any).failExport=true;});await frame.getByRole('button',{name:'Скачать .exui',exact:true}).click();await frame.getByRole('alert').filter({hasText:'тестовый отказ'}).waitFor();
 assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).isEnabled(),true);assert.equal(await frame.getByRole('link',{name:'Скачать пакет повторно'}).isVisible(),false);
 // A Section with a free-form name uses the same review/save/export path.
 await page.evaluate(()=>{(window as any).failExport=false;(window as any).selectNode({id:'section',name:'Триллиант / AV панели',nodeType:'SECTION'});});
 await frame.locator('#selectionType').filter({hasText:'Секция'}).waitFor();
 assert.equal(await frame.getByLabel('Назначение').inputValue(),'project');
 assert.equal(await frame.getByRole('button',{name:'Подготовить выбранный экран',exact:true}).isVisible(),false);
 assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).isDisabled(),true);
 await frame.getByRole('button',{name:'Распознать по именам',exact:true}).click();
 await frame.getByRole('button',{name:'Сохранить распознанные назначения'}).click();
 await frame.getByRole('status').filter({hasText:'Назначения сохранены'}).waitFor();
 assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).isEnabled(),true);
 // Navigation shows target names and keeps unknown saved keys until explicitly changed.
 await page.evaluate(()=>(window as any).selectNode({id:'nav',name:'button_AudioControl',nodeType:'FRAME',metadata:{kind:'button',key:'main.audiocontrol',buttonMode:'on-off',objectId:1,controlId:8101,navigate:'page.removed'},scope:{id:'section',name:'Триллиант / AV панели',kind:'project',profile:'tlp-pro-1025m'},targets:[{key:'page.audiocontrol',name:'Audio Control',kind:'page'},{key:'popup.sources',name:'Sources',kind:'popup'}]}));
 const target=frame.getByLabel('Открыть страницу или popup');
 assert.equal(await target.inputValue(),'page.removed');
 await target.selectOption({label:'Audio Control'});await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).click();
 await page.waitForFunction(()=>(window as any).lastMapping.navigate==='page.audiocontrol');
 await page.screenshot({path:path.join(out,'navigation.png')});
 await target.selectOption('');await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).click();
 await page.waitForFunction(()=>(window as any).lastMapping.navigate==='');
 await page.evaluate(()=>(window as any).selectNode({id:'section',name:'Триллиант / AV панели',nodeType:'SECTION',metadata:{kind:'project',key:'project.section',projectName:'Триллиант / AV панели',profile:'tlp-pro-1025m'}}));
 await frame.locator('#editor').evaluate((el:HTMLDetailsElement)=>el.open=false);await frame.locator('main').evaluate(el=>el.scrollTop=0);
 // In-flight commands lock the profile as well as actions; a failed check is recoverable.
 await page.evaluate(()=>{(window as any).holdCommand=true;});await frame.getByRole('button',{name:'Проверить макет'}).click();
 assert.equal(await frame.getByLabel('Профиль панели').isDisabled(),true);
 assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).isDisabled(),true);
 await page.evaluate(()=>{(window as any).holdCommand=false;document.querySelector('iframe')!.contentWindow!.postMessage({pluginMessage:{type:'error',message:'Проверка прервана. Повторите попытку.'}},location.origin);});
 await frame.getByRole('alert').filter({hasText:'Проверка прервана'}).waitFor();
 assert.equal(await frame.getByLabel('Профиль панели').isEnabled(),true);
 await page.evaluate(()=>{(window as any).useSection=true;});
 const sectionPending=page.waitForEvent('download');await frame.getByRole('button',{name:'Скачать .exui',exact:true}).click();
 const sectionDownload=await sectionPending;await sectionDownload.saveAs(path.join(out,'section.exui'));
 const sectionFiles=unzipSync(await readFile(path.join(out,'section.exui'))),sectionScreen=JSON.parse(strFromU8(sectionFiles['screen.json']));
 assert.equal(sectionScreen.pages.length,2);assert.equal(sectionScreen.popups.length,4);
 await frame.getByRole('status').filter({hasText:'Пакет готов'}).waitFor();
 await page.screenshot({path:path.join(out,'section-ready.png')});
 // Responsive layout, keyboard focus, fixed export controls and Figma theme tokens.
 for(const width of [420,320]){
  await page.setViewportSize({width,height:720});
  assert.equal(await frame.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  assert.equal(await frame.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  assert.equal(await frame.locator('footer').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),true);
  await frame.getByRole('button',{name:'Проверить макет',exact:true}).focus();await page.keyboard.press('Tab');
  assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).evaluate(el=>el===el.ownerDocument.activeElement),true);
  assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
  await page.screenshot({path:path.join(out,`ready-${width}.png`)});
 }
 await frame.locator('html').evaluate(el=>{for(const [name,value] of Object.entries({'bg':'#1e1e1e','bg-secondary':'#2c2c2c','text':'#f3f3f3','text-secondary':'#b3b3b3','border':'#454545','bg-brand':'#6caffe','text-onbrand':'#0e1a2a','text-brand':'#8abaff','text-success':'#6bd99b','text-danger':'#ffa9a3'}))el.style.setProperty('--figma-color-'+name,value);});
 await page.setViewportSize({width:420,height:720});await page.screenshot({path:path.join(out,'ready-dark.png')});
 await frame.locator('html').evaluate(el=>el.removeAttribute('style'));
 await page.evaluate(()=>{(window as any).useSection=false;});
 // Host-provided names are treated as text, never markup.
 await page.evaluate(()=>{const iframe=document.querySelector('iframe')!;(window as any).selectNode({id:'injection',name:'<img src=x onerror=alert(1)>',nodeType:'FRAME'});});
 await frame.getByText('<img src=x onerror=alert(1)>',{exact:true}).waitFor();assert.equal(await frame.locator('img').count(),0);
 await page.evaluate(()=>(window as any).selectNode({id:'screen',name:'Home',nodeType:'FRAME',metadata:{kind:'page',key:'page.home',objectId:100,projectName:'Home',profile:'tlp-pro-300m-portrait'}}));
 await frame.getByRole('status').filter({hasText:'Можно проверить'}).waitFor();
 await frame.locator('#editor').evaluate((el:HTMLDetailsElement)=>el.open=false);await frame.locator('main').evaluate(el=>el.scrollTop=0);
 await page.screenshot({path:path.join(out,'ui.png'),fullPage:true});
 // A platform bridge can dispatch MessageEvent without a Window source. The API
 // guarantees event.data.pluginMessage, not event.source === parent.
 await page.goto(`http://127.0.0.1:${address.port}/?transport=bridge`);
 await page.evaluate(()=>(window as any).selectNode({id:'bridge',name:'Главная',nodeType:'FRAME',metadata:{kind:'page',key:'page.home',objectId:100,projectName:'Home',profile:'tlp-pro-300m-portrait'}}));
 await page.waitForFunction(()=> (window as any).bridgeMessages>=2);
 await frame.getByText('Главная',{exact:true}).waitFor({timeout:3000});
 assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).isEnabled(),true);
 await frame.getByRole('button',{name:'Проверить макет'}).click();
 await frame.getByRole('status').filter({hasText:'Экран проверен'}).waitFor();
 const bridgePending=page.waitForEvent('download');await frame.getByRole('button',{name:'Скачать .exui',exact:true}).click();
 const bridgeDownload=await bridgePending;await bridgeDownload.saveAs(path.join(out,'bridge-'+bridgeDownload.suggestedFilename()));
 assert.deepEqual(await readFile(path.join(out,'bridge-'+bridgeDownload.suggestedFilename())),await readFile(path.join(out,bridgeDownload.suggestedFilename())));
 await frame.getByRole('status').filter({hasText:'Пакет готов'}).waitFor();
 await page.screenshot({path:path.join(out,'bridge-ui.png'),fullPage:true});assert.deepEqual(failures,[]);
 await writeFile(path.join(out,'browser.json'),JSON.stringify({passed:true,browser:browser.version(),checks:['empty selection, demo absent, optional library collapsed','keyboard navigation and expanded prefix table without horizontal overflow','custom Frame preparation command and metadata display','recognition preview, keyboard review, apply, error blocking and profile invalidation','both profile downloads','Section recognition and multipage ZIP download','target names, saved unknown navigation and clearing a transition','busy profile/action locking and check recovery','420/320 widths, visible keyboard focus, pinned export controls, light/dark tokens','ZIP payload','explicit metadata form including passive graphic','slider orientation/range and behavior, dynamic label ID, datetime pattern, popup target fields','render error recovery','text injection','null-source bridge selection, idle, check and download'],boundary:'actual Chromium UI; Figma parent and null-source bridge messages mocked; dark Figma tokens simulated',pageErrors:failures},null,2)+'\n');
 console.log('PASS Chromium plugin UI: both downloads, metadata form, error recovery, no page errors. '+out);
}finally{await browser?.close();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
