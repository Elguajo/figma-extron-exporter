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
import { twoScreens } from './page-project-fixture.ts';
import { sectionFixture } from './expanded-fixture.ts';
import { recognize,applyRecognition } from '../src/recognize.ts';
import { namedFixture } from './named-fixture.ts';
import { authorButtons } from './button-preparation-fixture.ts';
import { buttonPreparationSummary, prepareButtons, presetPreviews } from '../src/button-preparation.ts';
import { unzipSync, strFromU8 } from 'fflate';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.resolve(process.argv[2]??path.join(root,'output/figma-plugin/browser-'+Date.now()));await mkdir(out,{recursive:true});
const bundles:Record<string,unknown>={};
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){fakeFigma();const b=await exportFrame(await createDemo(profile,icons()));bundles[profile]={...b,resources:b.resources.map(r=>({...r,bytes:[...r.bytes]}))};}
fakeFigma();const section=sectionFixture();applyRecognition(recognize(section,'tlp-pro-1025m'));bundles.section=await exportFrame(section);
for(const profile of ['tlp-pro-1025m','tlp-pro-300m-portrait'] as const){fakeFigma();const {main,audio}=twoScreens(profile),options={members:[main,audio],projectName:'Trilliant'};applyRecognition(recognize(figma.currentPage,profile,options));bundles['batch-'+profile]=await exportFrame(figma.currentPage,()=>{},options);}
const ui=await readFile(process.env.EXUI_PLUGIN_UI??path.join(root,'src/figma-plugin/dist/ui.html'));
const issueFake=fakeFigma(),issueRoot=await namedFixture();issueRoot.name='screen_MainDashboard';
const third=issueRoot.children[3].clone();third.name='fbtn_VideoControl';issueRoot.appendChild(third);
for(const button of [issueRoot.children[0],issueRoot.children[3],third])((button as FrameNode).children[0] as any).type='GROUP';
for(const name of ['Vector 1','line_Devider 4','Vector 3','logo_trilliant']){const node=issueFake.api.createVector();node.name=name;issueRoot.appendChild(node as never);}
const issuePlan=recognize(issueRoot,'tlp-pro-1025m');assert.equal(issuePlan.issues.length,7);
const buttonFixture=authorButtons(),buttonPreviews=presetPreviews();
prepareButtons(buttonFixture.root,{members:[buttonFixture.buttons[0]]});const buttonMixed=buttonPreparationSummary(buttonFixture.root);
prepareButtons(buttonFixture.root,{},'apply');const buttonReady=buttonPreparationSummary(buttonFixture.root);
const host=`<!doctype html><meta charset=utf-8><title>Extron plugin UI harness — Figma host mocked</title><style>body{margin:0}iframe{display:block;width:100vw;height:100vh;border:0}</style><script>
const bundles=${JSON.stringify(bundles).replace(/</g,'\\u003c')};let profile='tlp-pro-1025m';window.failExport=false;window.lastMapping=null;
const issueReport=${JSON.stringify({rows:issuePlan.rows,errors:issuePlan.errors,issues:issuePlan.issues}).replace(/</g,'\\u003c')};window.lastIssueNode=null;window.lastRetry=null;
window.scopeMode='selection';window.useBatch=false;window.batchReady=false;window.currentSelection=null;window.useSection=false;window.holdCommand=false;window.bridgeMessages=0;window.lastPreparation=null;window.failRecognition=false;window.lastRecognitionApply=null;window.lastPreview=null;window.lastKitProfile=null;
const send=m=>{const target=document.querySelector('iframe').contentWindow;if(new URLSearchParams(location.search).get('transport')==='bridge'){target.dispatchEvent(new target.MessageEvent('message',{data:{pluginMessage:m}}));window.bridgeMessages++;}else target.postMessage({pluginMessage:m},location.origin);};
const buttonStylePreviews=${JSON.stringify(buttonPreviews)},buttonMixed=${JSON.stringify(buttonMixed)},buttonReady=${JSON.stringify(buttonReady)};
window.failButtonApply=false;
window.selectNode=m=>{const scope=m.scope??(m.metadata||m.nodeType==='SECTION'?{id:m.id,name:m.name,kind:m.metadata?.kind==='project'||m.nodeType==='SECTION'?'project':'page',profile}:undefined);if(m.metadata?.profile)profile=m.metadata.profile;window.currentSelection=m;send({type:'selection',scopeMode:window.scopeMode,buttonStylePreviews,buttonWorkflow:buttonMixed,canPrepare:!!m.id&&m.nodeType==='FRAME'&&!m.metadata?.kind,canRecognize:!!m.id&&['FRAME','SECTION'].includes(m.nodeType)&&(!m.metadata?.kind||['page','project'].includes(m.metadata.kind)),...m,scope,buttonScope:Object.hasOwn(m,'buttonScope')?m.buttonScope:scope});};
window.sendBatch=()=>window.selectNode({id:null,name:'Выбрано фреймов: 2',scopeMode:window.scopeMode,canRecognize:true,scopeHint:'В проекте: screen_Main, screen_AudioControl',profile,scope:{id:'current-page',name:'Trilliant',kind:'project',profile}});
window.onmessage=e=>{if(e.source!==document.querySelector('iframe').contentWindow)return;const m=e.data.pluginMessage;if(!m)return;
if(m.scopeMode)window.scopeMode=m.scopeMode;
if(m.type==='context'){profile=m.profile;if(window.scopeMode!=='selection')window.sendBatch();else window.selectNode(window.currentSelection?.id?{...window.currentSelection,scopeMode:window.scopeMode}:{id:null,name:'Выберите экраны на холсте'});}
if(m.type==='ready')window.selectNode({id:null,name:'Выберите секцию проекта или Frame экрана'});if(window.holdCommand){window.heldCommand=m.type;return;}
if(m.type==='id-map-preview'){window.lastIdMapPreview=m;try{const map=JSON.parse(m.data.json);send({type:'id-map-preview',token:42,rows:map.entries.map(e=>({name:e.name,from:e.sourceControlId,to:e.controlId}))});}catch{send({type:'error',operation:m.type,code:'id-map',message:'Не удалось прочитать JSON карты ID.'});}}
if(m.type==='id-map-apply'){window.lastIdMapApply=m;if(window.failIdMapApply)send({type:'error',operation:m.type,code:'id-map-stale',message:'Назначения изменились. Обновите предпросмотр карты ID.'});else send({type:'id-map-applied',message:'Карта ID применена. Изменено кнопок: 2.'});}
if(m.type==='kit'){window.lastKitProfile=m.profile;send({type:'success',message:'Extron Kit создан: 30 компонентов и шаблоны проекта.'});}
if(m.type.startsWith('button-')){window.lastButtonCommand=m;if(m.type==='button-apply-styles'){if(window.failButtonApply)send({type:'error',operation:m.type,code:'button-background',message:'Несколько фонов. Выберите нужный Rectangle.'});else{const before=window.currentSelection?.buttonWorkflow??buttonMixed;window.selectNode({...window.currentSelection,buttonWorkflow:buttonReady});send({type:'success',operation:m.type,message:'Оформление применено. Кнопок: '+(m.existing==='skip'?before.create:before.total)+'; новых состояний: '+before.create*2+'; пропущено готовых: '+(m.existing==='skip'?before.update:0)+'. Далее проверьте макет и скачайте .exui.'});}}else send({type:'success',message:'Эталон запомнен на текущей странице.'});}
if(m.type==='prepare'){window.lastPreparation=m;profile=m.profile;window.selectNode({id:'custom',name:'Свой экран',nodeType:'FRAME',metadata:{kind:'page',key:'page.home',objectId:100,projectName:'Свой экран',profile}});send({type:'success',message:'Назначение «Экран» сохранено. Далее назначьте элементы.'});}
if(m.type==='check'&&!window.failRecognition)send({type:'success',message:'Экран проверен: 4 элемента, 2 PNG.'});
if(m.type==='apply'){window.lastMapping=m.data;send({type:'success',message:'Назначение сохранено в Figma-узле.'});}
if(m.type==='save-ids'){window.lastIds=m;window.selectNode({...window.currentSelection,metadata:{...window.currentSelection.metadata,objectId:Number(m.data.objectId),controlId:Number(m.data.controlId)}});send({type:'success',operation:m.type,message:'ID сохранены: объект '+m.data.objectId+', управление Extron '+m.data.controlId+'.'});}
if(m.type==='project-settings'){window.lastSettingsCommand=m;window.selectNode({id:null,name:'Нет выделения',projectSettings:window.settingsViews[m.projectId]});}
if(m.type==='start-page'){window.lastLinksCommand=m;window.selectNode({...window.currentSelection,projectSettings:{...window.currentSelection.projectSettings,startId:m.targetId}});send({type:'success',message:'Стартовая страница сохранена в проекте.'});}
if(['reference-target','selection-group','show-linked'].includes(m.type)){window.lastLinksCommand=m;send({type:'success',message:m.type==='show-linked'?'Элемент показан на холсте.':'Связь сохранена в файле Figma.'});}
if(m.type==='bind-popups'){window.lastPopupBinding=m;window.selectNode({id:m.referenceId,name:'popupref_AudioControls',nodeType:'FRAME',metadata:{kind:'popup-ref',key:'audio.controls',objectId:7,group:'group.audiocontrols',controlId:null},scope:{id:'project',name:'AV panels',kind:'project',profile}});send({type:'success',message:'Popup связаны с выбранным местом.'});}
if(m.type==='preview'){window.lastPreview=m;send({type:'success',message:'Состояние показано.'});}
if(m.type==='select-issue'){window.lastIssueNode=m.nodeId;const issue=issueReport.issues.find(i=>i.nodeId===m.nodeId);window.selectNode({id:issue.nodeId,name:issue.nodeName,nodeType:issue.nodeType,keepRecognition:true,scope:{id:'custom',name:'screen_MainDashboard',kind:'page',profile}});}
if(m.type==='recognize'||window.failRecognition&&['check','export'].includes(m.type)){if(m.fromReport)window.lastRetry=m;send({type:'recognition',token:7,...(window.failRecognition?issueReport:{rows:[{id:'button',name:'button_Music',kind:'button',key:'home.music',objectId:1,controlId:8101,isNew:true}],errors:[],issues:[]}),warnings:[]});}
if(m.type==='apply-recognition'&&window.scopeMode!=='selection'){window.lastRecognitionApply=m;window.batchReady=true;window.sendBatch();send({type:'success',message:'Назначения сохранены.'});}
if(m.type==='apply-recognition'&&window.scopeMode==='selection'){window.lastRecognitionApply=m;window.selectNode({...window.currentSelection,metadata:{kind:window.currentSelection.nodeType==='SECTION'?'project':'page',key:window.currentSelection.nodeType==='SECTION'?'project.section':'page.home',objectId:100,projectName:window.currentSelection.name,profile:m.profile}});send({type:'success',message:'Назначения сохранены. Можно скачать .exui.'});}
if(m.type==='export'&&!window.failRecognition){if(window.failExport)send({type:'error',message:'PNG не экспортирован: тестовый отказ рендера'});else {const bundle=structuredClone(bundles[window.useBatch?'batch-'+profile:window.useSection?'section':profile]);bundle.resources.forEach(r=>r.bytes=new Uint8Array(r.bytes));send({type:'bundle',bundle,assignmentSummary:'Автоматически сохранено назначений: 5.'});}}
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
 assert.equal(await frame.locator('#buttonStates').evaluate(el=>(el as HTMLDetailsElement).open),false);
 assert.equal(await frame.locator('#demo').count(),0);
 // The map is imported for the whole source page, without a selected node.
 await frame.locator('#idMapImport > summary').click();
 assert.equal(await frame.locator('#chooseIdMap').isEnabled(),true);
 const mapPayload={schema:'exui-figma-id-map/1',profile:'tlp-pro-1025m',pageId:'1',pageToken:'test-origin-0000001',projectName:'Home',entries:[{nodeId:'a',key:'home.a',name:'button_Page1',sourceControlId:8101,controlId:1},{nodeId:'b',key:'home.b',name:'button_Page2',sourceControlId:8103,controlId:2}]};
 await frame.locator('#idMapFile').setInputFiles({name:'map.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(mapPayload))});
 await frame.locator('#idMapRows').getByText('button_Page1: 8101 → 1',{exact:true}).waitFor();
 assert.equal(await frame.locator('#applyIdMap').isEnabled(),true);assert.equal(await page.evaluate(()=>(window as any).lastIdMapApply??null),null);
 for(const width of [420,320]){await page.setViewportSize({width,height:720});assert.equal(await frame.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth),true);await frame.locator('#idMapImport').screenshot({path:path.join(out,`id-map-${width}.png`)});}
 await page.setViewportSize({width:420,height:720});await page.evaluate(()=>(window as any).failIdMapApply=true);
 await frame.locator('#applyIdMap').click();await frame.locator('#idMapSummary').filter({hasText:'Назначения изменились'}).waitFor();assert.equal(await frame.locator('#applyIdMap').isDisabled(),true);
 await page.evaluate(()=>(window as any).failIdMapApply=false);await frame.locator('#refreshIdMap').click();await frame.locator('#idMapRows').waitFor({state:'visible'});
 await frame.locator('#applyIdMap').focus();await page.keyboard.press('Enter');await frame.locator('#idMapSummary').filter({hasText:'Карта ID применена'}).waitFor();
 assert.equal(await page.evaluate(()=>(window as any).lastIdMapApply.token),42);
 await frame.locator('#idMapFile').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken')});await frame.locator('#idMapSummary').filter({hasText:'Не удалось прочитать JSON'}).waitFor();assert.equal(await frame.locator('#applyIdMap').isDisabled(),true);
 await frame.locator('#idMapImport > summary').click();
 // Popup prefixes and saved assignments disable screen-only actions before a click.
 await frame.locator('#editor > summary').click();
 // ID recovery is a separate action and must not submit other form edits.
 await page.evaluate(()=>(window as any).selectNode({id:'rebuilt',name:'button_CH01',nodeType:'FRAME',metadata:{kind:'button',buttonMode:'on-off',key:'hallsources.ch01',objectId:2597,controlId:9138}}));
 await frame.getByLabel('ID управления Extron',{exact:true}).fill('9140');
 await frame.getByLabel('Семантический ключ',{exact:true}).fill('unsaved.key');
 await frame.getByRole('button',{name:'Сохранить ID',exact:true}).click();
 await page.waitForFunction(()=>(window as any).lastIds?.data.controlId==='9140');
 assert.deepEqual(await page.evaluate(()=>(window as any).lastIds),{type:'save-ids',scopeMode:'selection',profile:'tlp-pro-1025m',nodeId:'rebuilt',data:{objectId:'2597',controlId:'9140'}});
 assert.equal(await frame.getByLabel('Семантический ключ',{exact:true}).inputValue(),'hallsources.ch01');
 await frame.getByRole('status').filter({hasText:'ID сохранены'}).waitFor();
 for(const width of [420,320]){
  await page.setViewportSize({width,height:720});
  await frame.locator('#controlId').scrollIntoViewIfNeeded();
  assert.equal(await frame.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.screenshot({path:path.join(out,`manual-ids-${width}.png`),fullPage:true});
 }
 await page.setViewportSize({width:420,height:720});
 await page.evaluate(()=>(window as any).lastIds=null);
 await frame.getByLabel('ID управления Extron',{exact:true}).fill('65536');
 await frame.getByRole('button',{name:'Сохранить ID',exact:true}).click();
 assert.equal(await page.evaluate(()=>(window as any).lastIds),null);
 await frame.getByLabel('ID управления Extron',{exact:true}).fill('9140');
 await frame.getByRole('button',{name:'Сохранить ID',exact:true}).focus();
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>(window as any).lastIds?.data.controlId==='9140');
 for(const [name,kind] of [['modalpopup_Confirm','popup'],['popupgroup_AudioControls','popup-group'],['popupref_Sources','popup-ref']])for(const assigned of [false,true]){
  await page.evaluate(({name,kind,assigned})=>(window as any).selectNode({id:'popup-action',name,nodeType:'FRAME',selectionKind:kind,canPrepare:false,canRecognize:false,...(assigned?{metadata:{kind,key:'test.popup',objectId:101}}:{})}),{name,kind,assigned});
  await frame.locator('#selection').filter({hasText:name}).waitFor();
  await frame.locator('#prepare').waitFor({state:assigned?'hidden':'visible'});
  assert.equal(await frame.locator('#recognize').isDisabled(),true);
  assert.equal(await frame.locator('#prepare').isDisabled(),true);
  assert.equal(await frame.locator('#prepare').isVisible(),!assigned);
  assert.equal(await frame.locator('#kind').inputValue(),kind);
  if(name.startsWith('modalpopup')&&!assigned)assert.equal(await frame.locator('#modal').inputValue(),'true');
  if(!assigned)for(const id of ['check','export'])assert.equal(await frame.locator('#'+id).isDisabled(),true);
  if(name.startsWith('popupgroup')&&!assigned){
   await frame.locator('#prepare').scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(out,'popupgroup-disabled-actions.png'),fullPage:true});
  }
 }
 await frame.locator('#editor > summary').click();
 await page.evaluate(()=>(window as any).selectNode({id:null,name:'Выберите экраны на холсте'}));
 // The binding action is available for multi-selection without an active node.
 await page.evaluate(()=>(window as any).selectNode({id:null,name:'Выбрано popup: 2',scope:{id:'project',name:'AV panels',kind:'project',profile:'tlp-pro-1025m'},popupBinding:{popupIds:['hall','terrace'],names:['popup_HallSources','popup_TerraceSources'],targets:[{id:'place',name:'screen_AudioControl → popupref_AudioControls'}]}}));
 await frame.getByRole('button',{name:'Связать с местом popup',exact:true}).waitFor();
 assert.equal(await frame.getByRole('button',{name:'Связать с местом popup',exact:true}).isEnabled(),true);
 assert.equal(await frame.locator('#popupPlace option').textContent(),'screen_AudioControl → popupref_AudioControls');
 for(const width of [420,320]){await page.setViewportSize({width,height:720});assert.equal(await frame.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth),true);await frame.locator('#popupBinding').screenshot({path:path.join(out,`popup-binding-${width}.png`)});}
 await page.setViewportSize({width:420,height:720});
 await frame.locator('#popupPlace').focus();await page.keyboard.press('Tab');
 assert.equal(await frame.getByRole('button',{name:'Связать с местом popup',exact:true}).evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>(window as any).lastPopupBinding?.referenceId==='place');
 assert.deepEqual(await page.evaluate(()=>(window as any).lastPopupBinding.popupIds),['hall','terrace']);
 await frame.getByRole('status').filter({hasText:'Popup связаны'}).waitFor();
 await page.evaluate(()=>(window as any).selectNode({id:null,name:'Выбрано popup: 2',popupBinding:{popupIds:['hall','terrace'],names:['popup_HallSources','popup_TerraceSources'],targets:[]}}));
 assert.equal(await frame.getByRole('button',{name:'Связать с местом popup',exact:true}).isDisabled(),true);
 await frame.getByText('Места popup не найдены.',{exact:false}).waitFor();
 await frame.locator('#buttonStates > summary').click();
 assert.equal(await frame.getByLabel('Off / On — включение или выбор',{exact:true}).isChecked(),true);
 await frame.getByLabel('Off / On — включение или выбор',{exact:true}).focus();await page.keyboard.press('ArrowDown');
 assert.equal(await frame.getByLabel('Normal / Pressed — нажатие и удержание',{exact:true}).isChecked(),true);
 await page.evaluate(()=>(window as any).selectNode({id:null,name:'Выберите экраны на холсте'}));
 assert.equal(await frame.getByRole('button',{name:'Применить оформление',exact:true}).isDisabled(),true);
 await frame.getByText('Стили найдены. Теперь выберите один или несколько фреймов в Figma.',{exact:true}).waitFor();
 // An export project without a styling selection must not appear as the styling scope.
 await page.evaluate(()=>(window as any).selectNode({id:null,name:'Нет выделения',scope:{id:'saved-project',name:'Saved project',kind:'project',profile:'tlp-pro-1025m'},buttonScope:undefined,buttonWorkflow:undefined}));
 await frame.locator('#buttonScope').filter({hasText:'Выберите экран или popup с кнопками'}).waitFor();
 assert.equal(await frame.getByRole('button',{name:'Применить оформление',exact:true}).isDisabled(),true);
 await page.evaluate(()=>(window as any).selectNode({id:null,name:'Выбрано фреймов: 2',scope:{id:'saved-project',name:'Saved project',kind:'project',profile:'tlp-pro-1025m'},buttonScope:{id:'two-frames',name:'screen_A, screen_B',kind:'frames',profile:'tlp-pro-1025m'},buttonWorkflow:{total:4,create:0,update:4}}));
 await frame.getByText('Выбранные фреймы: screen_A, screen_B',{exact:true}).waitFor();
 await frame.getByLabel('Применить новый стиль и к готовым',{exact:true}).check();
 assert.equal(await frame.getByRole('button',{name:'Применить оформление',exact:true}).isEnabled(),true);
 await page.evaluate(()=>(window as any).selectNode({id:null,name:'Выберите экраны на холсте'}));
 await frame.getByText('Выбрать образцы и фон вручную',{exact:true}).focus();await page.keyboard.press('Enter');
 assert.equal(await frame.getByRole('button',{name:'Выбранное — обычный эталон',exact:true}).isDisabled(),true);
 await page.evaluate(()=>(window as any).selectNode({id:'preset-normal',name:'Passive',nodeType:'RECTANGLE'}));
 await frame.getByRole('button',{name:'Выбранное — обычный эталон',exact:true}).click();
 await frame.getByRole('status').filter({hasText:'Эталон запомнен'}).waitFor();assert.equal(await page.evaluate(()=>(window as any).lastButtonCommand.type),'button-preset-normal');
 await frame.getByRole('button',{name:'Выбранное — активный эталон',exact:true}).click();
 await page.waitForFunction(()=>(window as any).lastButtonCommand?.type==='button-preset-active');
 await frame.getByRole('status').filter({hasText:'Эталон запомнен'}).waitFor();assert.equal(await page.evaluate(()=>(window as any).lastButtonCommand.type),'button-preset-active');
 // Selecting the styles container explains the disabled action directly.
 await page.evaluate(()=>(window as any).selectNode({id:'samples',name:'Button Styles',nodeType:'FRAME'}));
 assert.equal(await frame.getByRole('button',{name:'Применить оформление',exact:true}).isDisabled(),true);
 await frame.getByText('Стили найдены. Теперь выберите один или несколько фреймов в Figma.',{exact:true}).waitFor();
 await frame.locator('#buttonStates').screenshot({path:path.join(out,'button-styles-selected.png')});
 // Styling a standalone popup group does not require an exportable screen.
 await page.evaluate(()=>(window as any).selectNode({id:'popupgroup',name:'popupgroup_AudioControls',nodeType:'FRAME',buttonScope:{id:'popupgroup',name:'popupgroup_AudioControls',kind:'popup-group',profile:'tlp-pro-1025m'},buttonWorkflow:{total:2,create:2,update:0}}));
 await frame.getByText('Группа popup: popupgroup_AudioControls',{exact:true}).waitFor();
 assert.equal(await frame.getByRole('button',{name:'Применить оформление',exact:true}).isEnabled(),true);
 assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).isDisabled(),true);
 await frame.getByRole('button',{name:'Применить оформление',exact:true}).click();
 await frame.locator('#buttonResultMessage').filter({hasText:'Оформление применено'}).waitFor();
 await frame.getByLabel('Применить новый стиль и к готовым',{exact:true}).check();
 // Moving from the group to one popup resets the existing-state decision.
 await page.evaluate(()=>(window as any).selectNode({id:'popup',name:'popup_TerraceSources',nodeType:'FRAME',buttonScope:{id:'popup',name:'popup_TerraceSources',kind:'popup',profile:'tlp-pro-1025m'},buttonWorkflow:{total:1,create:0,update:1}}));
 await frame.getByText('Popup: popup_TerraceSources',{exact:true}).waitFor();
 assert.equal(await frame.getByLabel('Применить новый стиль и к готовым',{exact:true}).isChecked(),false);
 assert.equal(await frame.getByRole('button',{name:'Применить оформление',exact:true}).isDisabled(),true);
 await frame.getByLabel('Применить новый стиль и к готовым',{exact:true}).check();
 assert.equal(await frame.getByRole('button',{name:'Применить оформление',exact:true}).isEnabled(),true);
 await frame.locator('#buttonStates').screenshot({path:path.join(out,'popup-button-styles.png')});
 await page.evaluate(previews=>(window as any).selectNode({id:'missing-sample',name:'screen_Home',nodeType:'FRAME',scope:{id:'missing-sample',name:'screen_Home',kind:'page',profile:'tlp-pro-1025m'},buttonStylePreviews:{...previews,normal:{name:'Не выбран',ready:false,hint:'Найдено несколько образцов. Выберите нужный в дополнительных настройках.'}}}),buttonPreviews);
 await frame.getByText('Найдено несколько образцов. Выберите нужный в дополнительных настройках.',{exact:true}).waitFor();
 assert.equal(await frame.getByRole('button',{name:'Применить оформление',exact:true}).isDisabled(),true);
 await frame.getByText('Сначала задайте обычный и активный образцы.',{exact:true}).waitFor();
 await page.evaluate(()=>(window as any).selectNode({id:'raw-home',name:'screen_Home',nodeType:'FRAME',scope:{id:'raw-home',name:'screen_Home',kind:'page',profile:'tlp-pro-1025m'}}));
 await frame.getByText('Passive · найден',{exact:true}).waitFor();
 await frame.getByText('Найдено кнопок: 2. Оформление изменится только в текущем выделении.',{exact:true}).waitFor();
 await frame.getByText('Выберите, пропустить готовые кнопки или обновить их оформление.',{exact:true}).waitFor();
 assert.equal(await frame.getByRole('button',{name:'Применить оформление',exact:true}).isDisabled(),true);
 assert.equal(await frame.getByLabel('Пропустить готовые кнопки',{exact:true}).isChecked(),false);
 assert.equal(await frame.getByLabel('Применить новый стиль и к готовым',{exact:true}).isChecked(),false);
 await frame.getByLabel('Пропустить готовые кнопки',{exact:true}).check();
 await frame.getByText('Подготовить кнопок: 1 · пропустить готовых: 1.',{exact:true}).waitFor();
 await frame.getByText('Выбрать образцы и фон вручную',{exact:true}).click();
 await frame.getByLabel('Использовать скругление образцов',{exact:true}).focus();await page.keyboard.press('Space');
 assert.equal(await frame.getByLabel('Использовать скругление образцов',{exact:true}).isChecked(),true);
 assert.equal(await frame.getByLabel('Исправлять контраст текста и иконок',{exact:true}).isChecked(),true);
 await frame.getByLabel('Исправлять контраст текста и иконок',{exact:true}).focus();await page.keyboard.press('Space');
 assert.equal(await frame.getByLabel('Исправлять контраст текста и иконок',{exact:true}).isChecked(),false);
 await page.keyboard.press('Space');
 await frame.getByRole('button',{name:'Применить оформление',exact:true}).click();
 await frame.locator('#buttonResultMessage').filter({hasText:'Оформление применено'}).waitFor();
 assert.equal(await page.evaluate(()=>(window as any).lastButtonCommand.type),'button-apply-styles');
 assert.equal(await page.evaluate(()=>(window as any).lastButtonCommand.corners),true);
 assert.equal(await page.evaluate(()=>(window as any).lastButtonCommand.contrast),true);
 assert.equal(await page.evaluate(()=>(window as any).lastButtonCommand.existing),'skip');
 assert.equal(await page.evaluate(()=>(window as any).lastButtonCommand.statePair),'normal-pressed');
 assert.equal(await frame.getByRole('button',{name:'Применить оформление',exact:true}).isDisabled(),true);
 await frame.getByLabel('Применить новый стиль и к готовым',{exact:true}).check();
 assert.equal(await frame.locator('#buttonResult').isVisible(),false);
 await frame.getByLabel('Off / On — включение или выбор',{exact:true}).check();
 await frame.getByText('Подготовить кнопок: 0 · обновить оформление: 2.',{exact:true}).waitFor();
 await frame.getByLabel('Исправлять контраст текста и иконок',{exact:true}).uncheck();
 await frame.getByRole('button',{name:'Применить оформление',exact:true}).click();
 await frame.locator('#buttonResultMessage').filter({hasText:'Оформление применено'}).waitFor();
 assert.equal(await page.evaluate(()=>(window as any).lastButtonCommand.existing),'update');
 assert.equal(await page.evaluate(()=>(window as any).lastButtonCommand.statePair),'off-on');
 await frame.getByLabel('Normal / Pressed — нажатие и удержание',{exact:true}).check();
 assert.equal(await frame.locator('#buttonResult').isVisible(),false);
 assert.equal(await page.evaluate(()=>(window as any).lastButtonCommand.contrast),false);
 await frame.getByLabel('Исправлять контраст текста и иконок',{exact:true}).check();
 assert.equal(await frame.locator('#buttonResult').isVisible(),false);
 assert.equal(await frame.getByRole('button',{name:'Проверить и скачать .exui',exact:true}).isVisible(),false);
 await frame.getByRole('button',{name:'Применить оформление',exact:true}).click();
 await frame.locator('#buttonResultMessage').filter({hasText:'Оформление применено'}).waitFor();
 assert.equal(await page.evaluate(()=>(window as any).lastButtonCommand.contrast),true);
 assert.equal(await frame.getByRole('button',{name:'Проверить и скачать .exui',exact:true}).isVisible(),true);
 assert.equal(await frame.getByRole('button',{name:'Применить оформление',exact:true}).evaluate(el=>el.classList.contains('secondary')),true);
 assert.equal(await frame.getByRole('button',{name:'Проверить и скачать .exui',exact:true}).evaluate(el=>el.classList.contains('secondary')),false);
 assert.equal(await frame.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await frame.locator('#buttonStates').screenshot({path:path.join(out,'button-states-420.png')});
 await page.setViewportSize({width:320,height:720});
 assert.equal(await frame.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await frame.locator('#buttonStates').screenshot({path:path.join(out,'button-states-320.png')});
 // Support details can be copied at the narrowest width, even while an operation runs.
 const diagnostics=frame.getByRole('button',{name:'Скопировать диагностику',exact:true});assert.equal(await diagnostics.isEnabled(),true);
 await diagnostics.click();await frame.getByRole('button',{name:'Диагностика скопирована',exact:true}).waitFor();
 await page.setViewportSize({width:420,height:720});
 // A taller capture lets the full scrollable card be inspected without clipping.
 await page.setViewportSize({width:420,height:1200});await frame.locator('#buttonStates').screenshot({path:path.join(out,'button-workflow-complete-420.png')});
 await page.setViewportSize({width:320,height:1200});
 await frame.locator('html').evaluate(el=>{for(const [k,v]of Object.entries({'bg':'#2c2c2c','bg-secondary':'#383838','text':'#f5f5f5','text-secondary':'#c0c0c0','border':'#555555','text-danger':'#ffafa3','bg-brand':'#087cce','text-onbrand':'#ffffff'}))el.style.setProperty('--figma-color-'+k,v);});
 assert.equal(await frame.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await frame.getByRole('button',{name:'Применить оформление',exact:true}).focus();await page.keyboard.press('Tab');
 assert.equal(await frame.getByRole('button',{name:'Проверить и скачать .exui',exact:true}).evaluate(el=>el===el.ownerDocument.activeElement),true);
 assert.notEqual(await frame.getByRole('button',{name:'Проверить и скачать .exui',exact:true}).evaluate(el=>getComputedStyle(el).outlineStyle),'none');
 await frame.locator('#buttonStates').screenshot({path:path.join(out,'button-workflow-dark-320.png')});
 await frame.locator('html').evaluate(el=>el.removeAttribute('style'));await page.setViewportSize({width:420,height:720});
 const buttonDownloadPending=page.waitForEvent('download');await frame.getByRole('button',{name:'Проверить и скачать .exui',exact:true}).click();await (await buttonDownloadPending).saveAs(path.join(out,'button-workflow.exui'));
 await frame.locator('#status').filter({hasText:'Пакет готов'}).waitFor();
 await page.evaluate(()=>{(window as any).failButtonApply=true;});await frame.getByRole('button',{name:'Применить оформление',exact:true}).click();
 await frame.locator('#buttonResultMessage').filter({hasText:'Несколько фонов'}).waitFor();assert.equal(await frame.locator('#buttonResultMessage').getAttribute('role'),'alert');
 assert.equal(await frame.getByRole('button',{name:'Проверить и скачать .exui',exact:true}).isVisible(),false);
 assert.equal(await frame.locator('#buttonAdvanced').evaluate((el:HTMLDetailsElement)=>el.open),true);
 await page.evaluate(()=>{(window as any).failButtonApply=false;});await frame.getByRole('button',{name:'Применить оформление',exact:true}).click();
 await frame.locator('#buttonResultMessage').filter({hasText:'Оформление применено'}).waitFor();
 // A different selection must not inherit the previous success or export CTA.
 await page.evaluate(()=>(window as any).selectNode({id:'other',name:'screen_Other',nodeType:'FRAME',scope:{id:'other',name:'screen_Other',kind:'page',profile:'tlp-pro-1025m'}}));
 assert.equal(await frame.locator('#buttonResult').isVisible(),false);
 assert.equal(await frame.getByLabel('Применить новый стиль и к готовым',{exact:true}).isChecked(),false);
 await frame.getByLabel('Применить новый стиль и к готовым',{exact:true}).check();
 await page.evaluate(()=>{(window as any).holdCommand=true;});
 await frame.getByRole('button',{name:'Применить оформление',exact:true}).click();
 assert.equal(await frame.getByRole('button',{name:'Применить оформление',exact:true}).isDisabled(),true);assert.equal(await frame.getByLabel('Использовать скругление образцов',{exact:true}).isDisabled(),true);
 assert.equal(await frame.getByLabel('Пропустить готовые кнопки',{exact:true}).isDisabled(),true);
 assert.equal(await frame.getByLabel('Normal / Pressed — нажатие и удержание',{exact:true}).isDisabled(),true);
 await page.evaluate(()=>{(window as any).holdCommand=false;document.querySelector('iframe')!.contentWindow!.postMessage({pluginMessage:{type:'idle'}},location.origin);});
 await frame.locator('#buttonStates>summary').click();
 await page.evaluate(()=>(window as any).selectNode({id:null,name:'Выберите секцию проекта или Frame экрана'}));
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
 assert.equal(await frame.locator('#buttonStates>summary').evaluate(el=>el===el.ownerDocument.activeElement),true);
 await frame.locator('main').evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.join(out,'empty.png')});
 // Unassigned eligible screen can download immediately, without opening a form
 // or applying a recognition preview. The parent command is mocked explicitly.
 await page.evaluate(()=>(window as any).selectNode({id:'fresh',name:'screen_Home',nodeType:'FRAME',metadata:null,scope:{id:'fresh',name:'screen_Home',kind:'page',profile:'tlp-pro-1025m'}}));
 assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).isEnabled(),true);
 assert.equal(await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).isVisible(),false);
 const autoPending=page.waitForEvent('download');await frame.getByRole('button',{name:'Скачать .exui',exact:true}).click();const autoDownload=await autoPending;await autoDownload.saveAs(path.join(out,'auto-unassigned.exui'));
 await frame.getByRole('status').filter({hasText:'Автоматически сохранено назначений: 5.'}).waitFor();assert.equal(await page.evaluate(()=>(window as any).lastRecognitionApply),null);
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
 assert.equal(await frame.locator('#applyRecognition').isDisabled(),true);
 assert.equal(await frame.getByRole('button',{name:'Сохранить распознанные назначения'}).isVisible(),false);
 assert.equal(await frame.getByRole('heading',{name:'Ошибок: 7. Назначения не сохранены'}).evaluate(el=>el===el.ownerDocument.activeElement),true);
 assert.equal(await frame.locator('.recognition-issue').count(),7);
 assert.equal(await frame.getByRole('list',{name:'Результат распознавания'}).isVisible(),false);
 await frame.getByText('screen_MainDashboard → fbtn_Music → Normal',{exact:true}).waitFor();
 await frame.getByText('screen_MainDashboard → feedbackbutton_Mute → Normal',{exact:true}).waitFor();
 assert.equal(await frame.locator('#recognitionNotes').textContent(),'');
 const nameIssue=frame.locator('.recognition-issue').filter({has:frame.getByText('line_Devider 4 · VECTOR',{exact:true})});
 assert.match(await nameIssue.innerText(),/пробел.*позиции 13/);
 assert.match(await nameIssue.innerText(),/line_Devider-4/);
 assert.equal(await frame.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await page.screenshot({path:path.join(out,'recognition-errors-light.png'),fullPage:true});
 await frame.getByRole('heading',{name:'Ошибок: 7. Назначения не сохранены'}).focus();await page.keyboard.press('Tab');
 assert.equal(await frame.getByRole('button',{name:'Показать слой screen_MainDashboard → fbtn_Music → Normal',exact:true}).evaluate(el=>el===el.ownerDocument.activeElement),true);
 await page.keyboard.press('Enter');await page.waitForFunction(()=>(window as any).lastIssueNode!==null);
 assert.equal(await page.evaluate(()=>(window as any).lastIssueNode),issuePlan.issues[0].nodeId);
 assert.equal(await frame.locator('#recognitionReport').isVisible(),true);
 await frame.getByRole('heading',{name:'Ошибок: 7. Назначения не сохранены'}).waitFor();
 // Narrow Figma dark theme: readable errors and recovery without horizontal scrolling.
 await page.setViewportSize({width:320,height:720});
 await frame.locator('html').evaluate(el=>{for(const [k,v]of Object.entries({'bg':'#2c2c2c','bg-secondary':'#383838','text':'#f5f5f5','text-secondary':'#c0c0c0','border':'#555555','text-danger':'#ffafa3','bg-brand':'#087cce','text-onbrand':'#ffffff'}))el.style.setProperty('--figma-color-'+k,v);});
 await frame.getByRole('heading',{name:'Ошибок: 7. Назначения не сохранены'}).evaluate(el=>el.scrollIntoView({block:'start'}));
 assert.equal(await frame.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await page.screenshot({path:path.join(out,'recognition-errors-dark-narrow.png'),fullPage:true});
 await nameIssue.getByRole('button',{name:'Показать слой screen_MainDashboard → line_Devider 4',exact:true}).scrollIntoViewIfNeeded();
 await nameIssue.evaluate(el=>el.scrollIntoView({block:'start'}));
 assert.equal(await nameIssue.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 assert.equal(await frame.locator('body').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await page.screenshot({path:path.join(out,'name-error-dark-narrow.png'),fullPage:true});
 await page.setViewportSize({width:420,height:720});await frame.locator('html').evaluate(el=>el.removeAttribute('style'));
 await page.evaluate(()=>{(window as any).failRecognition=false;});
 await frame.getByRole('button',{name:'Повторить распознавание',exact:true}).click();
 await frame.getByRole('list',{name:'Результат распознавания'}).getByText('home.music',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>(window as any).lastRetry.fromReport),true);
 // Check and download failures expose the same actionable report.
 for(const command of ['Проверить макет','Скачать .exui']){
  await page.evaluate(()=>{(window as any).failRecognition=true;});await frame.getByRole('button',{name:command,exact:true}).click();
  await frame.getByRole('heading',{name:'Ошибок: 7. Назначения не сохранены'}).waitFor();assert.equal(await frame.locator('.recognition-issue').count(),7);
  await page.evaluate(()=>{(window as any).failRecognition=false;});await frame.getByRole('button',{name:'Повторить распознавание',exact:true}).click();
  await frame.getByRole('list',{name:'Результат распознавания'}).getByText('home.music',{exact:false}).waitFor();
 }
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
 assert.equal(await page.evaluate(()=>(window as any).lastMapping.patternEdited),'true');
 assert.equal(await frame.locator('#patternPreview').textContent(),'Пример: 00:00');
 assert.equal(await frame.locator('#patternPresets option').count(),28);
 await frame.getByLabel('Формат даты/времени',{exact:true}).fill('Clock');
 assert.match(await frame.locator('#patternPreview').textContent()??'',/^Ошибка: нет ни одного элемента/);
 await page.evaluate(()=>(window as any).selectNode({id:'kit-clock',name:'datetime_Clock',nodeType:'INSTANCE',metadata:{kind:'datetime',key:'home.clock',objectId:3,controlId:null},datetime:{pattern:'MMMM d, h:mm tt',preview:'September 28, 12:00 AM',source:'layer',manual:false}}));
 await frame.locator('#pattern[placeholder="MMMM d, h:mm tt"]').waitFor({state:'attached'});
 assert.equal(await frame.getByLabel('Формат даты/времени',{exact:true}).inputValue(),'');
 assert.equal(await frame.locator('#patternPreview').textContent(),'Из макета: MMMM d, h:mm tt → September 28, 12:00 AM (из имени Text-слоя)');
 await page.screenshot({path:path.join(out,'datetime-pattern.png'),fullPage:true});
 await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).click();await page.waitForFunction(()=>(window as any).lastMapping.key==='home.clock');
 assert.deepEqual(await page.evaluate(()=>[(window as any).lastMapping.pattern,(window as any).lastMapping.patternEdited]),['','false']);
 await frame.getByLabel('Назначение').selectOption('popup-ref');
 await frame.getByText('Ключи связи вручную',{exact:true}).click();
 await frame.getByLabel('Ключ popup',{exact:true}).fill('popup.sources');
 assert.equal(await frame.getByLabel('Экспортировать фон Frame',{exact:true}).isChecked(),false);
 assert.equal(await frame.getByLabel('Экспортировать обводку Frame',{exact:true}).isChecked(),false);
 await frame.getByLabel('Экспортировать фон Frame',{exact:true}).check();
 await frame.getByLabel('Экспортировать обводку Frame',{exact:true}).check();
 await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).click();await page.waitForFunction(()=>(window as any).lastMapping.popup==='popup.sources');
 assert.deepEqual(await page.evaluate(()=>[(window as any).lastMapping.exportBackground,(window as any).lastMapping.exportStroke]),['true','true']);
 await page.evaluate(()=>(window as any).selectNode({id:'popup-ref',name:'popupref_Sources',nodeType:'FRAME',metadata:{kind:'popup-ref',key:'home.sources-ref',objectId:7,controlId:null,popup:'popup.sources',exportBackground:true,exportStroke:true}}));
 await frame.getByLabel('Экспортировать фон Frame',{exact:true}).waitFor();
 assert.equal(await frame.getByLabel('Экспортировать фон Frame',{exact:true}).isChecked(),true);
 assert.equal(await frame.getByLabel('Экспортировать обводку Frame',{exact:true}).isChecked(),true);
 await frame.getByLabel('Экспортировать фон Frame',{exact:true}).uncheck();
 await frame.getByLabel('Экспортировать обводку Frame',{exact:true}).uncheck();
 await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).click();await page.waitForFunction(()=>(window as any).lastMapping.key==='home.sources-ref');
 assert.deepEqual(await page.evaluate(()=>[(window as any).lastMapping.exportBackground,(window as any).lastMapping.exportStroke]),['false','false']);
 await frame.locator('#mapping').screenshot({path:path.join(out,'popup-appearance-mapping.png')});
 await page.evaluate(()=>(window as any).selectNode({id:'popup',name:'popup_Sources',nodeType:'FRAME',metadata:{kind:'popup',key:'popup.sources',objectId:101,projectName:'Trilliant',profile:'tlp-pro-1025m'}}));
 await frame.getByLabel('Модальный popup').waitFor();
 assert.equal(await frame.getByLabel('Экспортировать фон Frame',{exact:true}).isChecked(),false);
 assert.equal(await frame.getByLabel('Экспортировать обводку Frame',{exact:true}).isChecked(),false);
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
 assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).isEnabled(),true);
 await frame.getByRole('button',{name:'Распознать по именам',exact:true}).click();
 await frame.getByRole('button',{name:'Сохранить распознанные назначения'}).click();
 await frame.getByRole('status').filter({hasText:'Назначения сохранены'}).waitFor();
 assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).isEnabled(),true);
 // Named links: explicit save, multi-selection, keyboard, scoping supplied by the host.
 const links={pages:[{id:'main',name:'screen_MainDashboard'},{id:'audio',name:'screen_AudioControl'}],startId:'main',groups:[{key:'hall.choice.1',name:'popup_HallSources · 8: button_Broadcast1, button_Broadcast2…'}],reference:{id:'ref',targets:[{id:'group',name:'popupgroup_AudioControls'}],targetId:'group',members:[{id:'hall',name:'popup_HallSources'},{id:'terrace',name:'popup_TerraceSources'}],missing:false}};
 await page.evaluate(links=>(window as any).selectNode({id:'ref',name:'popupref_AudioControls',nodeType:'FRAME',links:{...links,reference:{...links.reference,inferred:true}}}),links);
 await frame.locator('#referenceSaved').filter({hasText:'Найдено по имени: popupgroup_AudioControls'}).waitFor();
 assert.ok((await frame.locator('#referenceSaved').textContent())!.includes('Связь сохранится при проверке или скачивании'));
 await page.evaluate(links=>(window as any).selectNode({id:'ref',name:'popupref_AudioControls',nodeType:'FRAME',metadata:{kind:'popup-ref',key:'audio.controls',objectId:7,controlId:null,group:'group.audiocontrols'},links}),links);
 await frame.locator('#referenceSaved').filter({hasText:'Сохранено: popupgroup_AudioControls'}).waitFor();
 await frame.locator('#referenceLinks').waitFor();assert.equal(await frame.locator('#referenceTarget').inputValue(),'group');
 await page.evaluate(()=>(window as any).lastLinksCommand=null);await frame.locator('#referenceTarget').selectOption('');assert.equal(await page.evaluate(()=>(window as any).lastLinksCommand),null);
 await frame.getByRole('button',{name:'Сохранить связь popup',exact:true}).click();await page.waitForFunction(()=>(window as any).lastLinksCommand?.type==='reference-target');assert.equal(await page.evaluate(()=>(window as any).lastLinksCommand.targetId),'');
 await frame.getByRole('button',{name:'Показать popup_TerraceSources',exact:true}).click();await page.waitForFunction(()=>(window as any).lastLinksCommand?.targetId==='terrace');
 for(const width of [420,320]){await page.setViewportSize({width,height:720});assert.equal(await frame.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth),true);await frame.locator('#referenceLinks').screenshot({path:path.join(out,`named-popup-links-${width}.png`)});}
 await page.evaluate(links=>(window as any).selectNode({id:'project',name:'project_Trilliant',nodeType:'FRAME',metadata:{kind:'project',key:'project.trilliant'},links:{...links,reference:undefined}}),links);
 assert.equal(await frame.locator('#projectStart').isVisible(),false);
 // Project operations live in the no-selection state, independently of element links.
 const settings={projects:[{id:'project',name:'Trilliant'}],projectId:'project',pages:links.pages,startId:'main'};
 await page.evaluate(projectSettings=>(window as any).selectNode({id:null,name:'Нет выделения',projectSettings}),settings);
 await frame.locator('#projectStart').waitFor();
 assert.equal(await frame.locator('#startPage').inputValue(),'main');
 assert.equal(await frame.locator('#saveStartPage').isVisible(),false);assert.equal(await frame.locator('#startPageSaved').isVisible(),true);
 await page.evaluate(()=>(window as any).lastLinksCommand=null);
 await frame.locator('#startPage').selectOption('audio');assert.equal(await frame.locator('#saveStartPage').isEnabled(),true);
 assert.equal(await page.evaluate(()=>(window as any).lastLinksCommand),null,'choosing an option does not save');
 await frame.locator('#startPage').selectOption('main');assert.equal(await frame.locator('#saveStartPage').isVisible(),false);
 for(const width of [420,320]){await page.setViewportSize({width,height:720});assert.equal(await frame.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth),true);await frame.locator('#projectStart').screenshot({path:path.join(out,`project-settings-${width}.png`)});}
 await frame.locator('#startPage').selectOption('audio');await frame.locator('#startPage').focus();await page.keyboard.press('Tab');
 assert.equal(await frame.locator('#saveStartPage').evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Enter');
 await page.waitForFunction(()=>(window as any).lastLinksCommand?.type==='start-page');
 assert.equal(await page.evaluate(()=>(window as any).lastLinksCommand.projectId),'project');assert.equal(await page.evaluate(()=>(window as any).lastLinksCommand.targetId),'audio');
 await frame.locator('#saveStartPage').waitFor({state:'hidden'});assert.equal(await frame.locator('#startPageSaved').isVisible(),true);
 const multiple={projects:[{id:'project',name:'Trilliant'},{id:'other',name:'Other project'}],pages:[]};
 await page.evaluate(multiple=>{(window as any).settingsViews={other:{...multiple,projectId:'other',pages:[{id:'other-page',name:'screen_Other'}],startId:'other-page'}};(window as any).selectNode({id:null,name:'Нет выделения',projectSettings:multiple});},multiple);
 await frame.getByLabel('Проект',{exact:true}).selectOption('other');
 await frame.locator('#startPage').waitFor();assert.equal(await frame.locator('#startPage').inputValue(),'other-page');
 assert.equal(await frame.locator('#startPage option').count(),2);assert.equal(await page.evaluate(()=>(window as any).lastSettingsCommand.projectId),'other');
 await frame.locator('#projectStart').screenshot({path:path.join(out,'project-settings-multiple-320.png')});
 await page.evaluate(()=>(window as any).selectNode({id:null,name:'Нет выделения',projectSettings:{projects:[],pages:[]}}));
 await frame.getByText('На странице нет проектов с экранами выбранного профиля.',{exact:true}).waitFor();assert.equal(await frame.locator('#startPage').isVisible(),false);
 await page.evaluate(projectSettings=>(window as any).selectNode({id:null,name:'Выбрано фреймов: 2',projectSettings:undefined,links:{pages:projectSettings.pages,groups:[],startId:'main'}}),settings);
 assert.equal(await frame.locator('#projectStart').isVisible(),false);
 await page.evaluate(links=>(window as any).selectNode({id:null,name:'Выбрано кнопок: 8',links:{...links,reference:undefined,buttons:{ids:['b1','b2'],names:['button_Broadcast1','button_Broadcast2'],mixed:false}}}),links);
 await frame.locator('#selectionGroups').waitFor();assert.equal(await frame.locator('#referenceLinks').isVisible(),false);await frame.locator('#choiceGroup').selectOption('__create__');
 await frame.locator('#choiceGroup').focus();await page.keyboard.press('Tab');assert.equal(await frame.locator('#saveChoiceGroup').evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Enter');
 await page.waitForFunction(()=>(window as any).lastLinksCommand?.type==='selection-group');assert.deepEqual(await page.evaluate(()=>(window as any).lastLinksCommand.buttonIds),['b1','b2']);assert.equal(await page.evaluate(()=>(window as any).lastLinksCommand.create),true);
 await frame.locator('#choiceGroup').selectOption('hall.choice.1');await frame.locator('#saveChoiceGroup').click();await page.waitForFunction(()=>(window as any).lastLinksCommand?.group==='hall.choice.1');
 await frame.locator('#selectionGroups').screenshot({path:path.join(out,'selection-group-320.png')});
 await page.setViewportSize({width:420,height:720});
 // Navigation shows target names and keeps unknown saved keys until explicitly changed.
 await page.evaluate(()=>(window as any).selectNode({id:'nav',name:'button_AudioControl',nodeType:'FRAME',metadata:{kind:'button',key:'main.audiocontrol',buttonMode:'on-off',objectId:1,controlId:8101,navigate:'page.removed'},scope:{id:'section',name:'Триллиант / AV панели',kind:'project',profile:'tlp-pro-1025m'},targets:[{id:'audio',key:'page.audiocontrol',name:'Audio Control',kind:'page'},{id:'sources',key:'popup.sources',name:'Sources',kind:'popup'}]}));
 const target=frame.getByLabel('Открыть страницу или popup');
 assert.equal(await target.inputValue(),'page.removed');
 assert.equal(await frame.locator('#showNavigation').isDisabled(),true);
 await target.selectOption({label:'Audio Control'});await frame.locator('#showNavigation').click();await page.waitForFunction(()=>(window as any).lastLinksCommand?.type==='show-linked'&&(window as any).lastLinksCommand?.targetId==='audio');
 await target.selectOption({label:'Audio Control'});await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).click();
 await page.waitForFunction(()=>(window as any).lastMapping.navigate==='page.audiocontrol');
 await page.screenshot({path:path.join(out,'navigation.png')});
 await target.selectOption('');await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).click();
 assert.equal(await frame.locator('#showNavigation').isDisabled(),true);
 await page.waitForFunction(()=>(window as any).lastMapping.navigate==='');
 // A sibling outside remembered export membership is sent by node ID. Its
 // transient option value must never be persisted as a navigation key.
 await page.evaluate(()=>(window as any).selectNode({id:'nav',name:'button_VideoControl',nodeType:'FRAME',metadata:{kind:'button',key:'main.videocontrol',buttonMode:'on-off',objectId:1,controlId:8101},scope:{id:'page',name:'Project',kind:'project',profile:'tlp-pro-1025m'},targets:[{id:'video',key:'node:video',name:'screen_VideoControl',kind:'page',outsideScope:true}]}));
 await target.selectOption({label:'screen_VideoControl · добавить в проект'});
 assert.equal(await frame.locator('#showNavigation').isEnabled(),true);
 await frame.getByRole('button',{name:'Сохранить назначение',exact:true}).click();
 await page.waitForFunction(()=>(window as any).lastMapping.navigationTargetId==='video');
 assert.equal(await page.evaluate(()=>(window as any).lastMapping.navigate),'');
 await page.evaluate(()=>(window as any).selectNode({id:'section',name:'Триллиант / AV панели',nodeType:'SECTION',metadata:{kind:'project',key:'project.section',projectName:'Триллиант / AV панели',profile:'tlp-pro-1025m'}}));
 await frame.locator('#editor').evaluate((el:HTMLDetailsElement)=>el.open=false);await frame.locator('main').evaluate(el=>el.scrollTop=0);
 // In-flight commands lock the profile as well as actions; a failed check is recoverable.
 await page.evaluate(()=>{(window as any).holdCommand=true;});await frame.getByRole('button',{name:'Проверить макет'}).click();
 assert.equal(await frame.getByLabel('Профиль панели').isDisabled(),true);
 assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).isDisabled(),true);
 await page.waitForFunction(()=>(window as any).heldCommand==='check');
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
 // A selected-frame project works without a Section or a single active node.
 await frame.getByLabel('Что экспортировать').selectOption('selected-frames');
 await frame.getByText('Выбрано фреймов: 2',{exact:true}).waitFor();
 assert.equal(await frame.getByRole('button',{name:'Распознать по именам',exact:true}).isEnabled(),true);
 assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).isEnabled(),true);
 await page.evaluate(()=>{(window as any).useBatch=true;});
 const autoBatchPending=page.waitForEvent('download');await frame.getByRole('button',{name:'Скачать .exui',exact:true}).click();await (await autoBatchPending).saveAs(path.join(out,'auto-selected-frames.exui'));
 await frame.getByRole('status').filter({hasText:'Пакет готов'}).waitFor();assert.equal(await page.evaluate(()=>(window as any).batchReady),false);
 await frame.getByRole('button',{name:'Распознать по именам',exact:true}).click();
 await frame.getByRole('button',{name:'Сохранить распознанные назначения'}).click();
 await frame.getByRole('status').filter({hasText:'Назначения сохранены'}).waitFor();
 assert.equal(await frame.getByRole('button',{name:'Скачать .exui',exact:true}).isEnabled(),true);
 await page.evaluate(()=>{(window as any).useBatch=true;});
 const batchPending=page.waitForEvent('download');await frame.getByRole('button',{name:'Скачать .exui',exact:true}).click();
 const batchDownload=await batchPending;await batchDownload.saveAs(path.join(out,'selected-frames.exui'));
 const batchFiles=unzipSync(await readFile(path.join(out,'selected-frames.exui'))),batchScreen=JSON.parse(strFromU8(batchFiles['screen.json']));
 assert.deepEqual(batchScreen,(bundles['batch-tlp-pro-1025m'] as any).screen);
 await frame.getByRole('status').filter({hasText:'Пакет готов'}).waitFor();
 await frame.locator('main').evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.join(out,'selected-frames.png')});
 await frame.getByRole('button',{name:'Распознать по именам',exact:true}).click();
 await frame.getByRole('button',{name:'Сохранить распознанные назначения'}).waitFor();
 await frame.getByLabel('Что экспортировать').selectOption('page');
 assert.equal(await frame.getByRole('button',{name:'Сохранить распознанные назначения'}).isVisible(),false);
 await frame.getByRole('button',{name:'Проверить макет'}).click();await frame.getByRole('status').filter({hasText:'Экран проверен'}).waitFor();
 await frame.getByLabel('Что экспортировать').selectOption('selection');await page.evaluate(()=>{(window as any).useBatch=false;});
 // Host-provided names are treated as text, never markup.
 await page.evaluate(()=>{const iframe=document.querySelector('iframe')!;(window as any).selectNode({id:'injection',name:'<img src=x onerror=alert(1)>',nodeType:'FRAME'});});
 await frame.getByText('<img src=x onerror=alert(1)>',{exact:true}).waitFor();assert.equal(await frame.locator('img').count(),0);
 await page.evaluate(()=>(window as any).selectNode({id:'screen',name:'Home',nodeType:'FRAME',metadata:{kind:'page',key:'page.home',objectId:100,projectName:'Home',profile:'tlp-pro-300m-portrait'}}));
 await frame.getByRole('status').filter({hasText:'Можно скачать'}).waitFor();
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
 await writeFile(path.join(out,'browser.json'),JSON.stringify({passed:true,browser:browser.version(),checks:['empty selection, demo absent, optional library collapsed','button workflow: samples selection guidance, missing/ambiguous sample, actual sample colors and preparation/update counts','combined apply, next-step download, scoped errors, recovery and stale-result clearing','button workflow keyboard, busy locks, 420/320 widths and light/dark tokens','keyboard navigation and expanded prefix table without horizontal overflow','custom Frame preparation command and metadata display','recognition preview, keyboard review, apply, error blocking and profile invalidation','both profile downloads','Section recognition and multipage ZIP download','selected-frame project without active node, page mode, scope invalidation and two-screen download','target names, saved unknown navigation and clearing a transition','busy profile/action locking and check recovery','420/320 widths, visible keyboard focus, pinned export controls, light/dark tokens','ZIP payload','explicit metadata form including passive graphic','slider orientation/range and behavior, dynamic label ID, datetime pattern, popup target fields','render error recovery','text injection','null-source bridge selection, idle, check and download'],boundary:'actual Chromium UI; Figma parent and null-source bridge messages mocked; dark Figma tokens simulated',pageErrors:failures},null,2)+'\n');
 console.log('PASS Chromium plugin UI: both downloads, metadata form, error recovery, no page errors. '+out);
}finally{await browser?.close();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
