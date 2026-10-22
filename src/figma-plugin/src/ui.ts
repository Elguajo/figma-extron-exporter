import { packageExui } from './package.ts';
import { elementCount, type Bundle, type Metadata, type RecognitionIssue, type ButtonPreparationSummary, type PresetPreview } from './model.ts';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=(id:string)=>$<HTMLInputElement>(id);
let packing=false,operationBusy=false,selectedId:string|null=null,downloadUrl:string|undefined;
let recognitionToken:number|undefined;
let legacyButton=false,loadedKey='';
let canRecognize=false,hasScope=false;
let buttonCanApply=false,buttonResultReady=false;
let buttonSummary:ButtonPreparationSummary|undefined,buttonStylesReady=false,buttonScopeReady=false,buttonScopeKey='';
const send=(type:string,extra:Record<string,unknown>={})=>{if(!['recognize','apply-recognition','select-issue'].includes(type))clearRecognition();setBusy(true);if(type==='export'){const bar=$('bar');bar.hidden=false;bar.dataset.complete='false';bar.removeAttribute('aria-valuenow');bar.setAttribute('aria-valuetext','Подготовка экспорта');}parent.postMessage({pluginMessage:{type,scopeMode:input('scopeMode').value,profile:input('profile').value,...extra}},'*');};
function status(message:string,kind='progress') { $('status').textContent=message;$('status').dataset.kind=kind;$('status').setAttribute('role',kind==='error'?'alert':'status');if(kind==='error')$('bar').hidden=true; }
function setBusy(busy:boolean) {
  operationBusy=busy;
  document.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=busy||(!selectedId&&!['kit','recognize','check','export','retryRecognition','applyButtonStyles','buttonExport'].includes(b.id)&&!b.dataset.issueNode)||(b.id==='recognize'&&!canRecognize)||(['check','export','buttonExport'].includes(b.id)&&!hasScope)||(b.id==='applyButtonStyles'&&!buttonCanApply)||(b.id==='buttonExport'&&!buttonResultReady)||(b.id==='preview'&&!$<HTMLSelectElement>('previewRole').options.length));
  document.querySelectorAll<HTMLInputElement|HTMLSelectElement>('#mapping input,#mapping select,#profile,#scopeMode,#previewRole').forEach(e=>e.disabled=busy||(!selectedId&&!['profile','scopeMode'].includes(e.id)));
  $<HTMLButtonElement>('applyRecognition').disabled=busy||recognitionToken===undefined;
  $('mapping').setAttribute('aria-busy',String(busy));
  input('buttonCorners').disabled=busy;
  document.querySelectorAll<HTMLInputElement>('#buttonExistingChoice input').forEach(e=>e.disabled=busy);
  $('buttonStates').setAttribute('aria-busy',String(busy));
}
function clearButtonResult() { buttonResultReady=false;$('buttonResult').hidden=true;$('buttonExport').hidden=true;$('applyButtonStyles').classList.remove('secondary'); }
function buttonResult(message:string,kind:'success'|'error'|'progress') {
  buttonResultReady=kind==='success';$('buttonResult').hidden=false;$('buttonResult').dataset.kind=kind;
  $('buttonResultMessage').textContent=message;$('buttonResultMessage').setAttribute('role',kind==='error'?'alert':'status');
  $('buttonExport').hidden=!buttonResultReady;
  $('applyButtonStyles').classList.toggle('secondary',buttonResultReady);
}
function buttonPlan() {
  const summary=buttonSummary,existing=input('updateExistingButtons').checked?'update':input('skipExistingButtons').checked?'skip':undefined;
  const needsChoice=!!summary&&summary.update>0;
  $('buttonPlan').textContent=!buttonScopeReady?'Сначала выберите экран.':summary?.issue?'Исправьте указанную причину и выберите экран повторно.':!buttonStylesReady?'Сначала задайте обычный и активный образцы.':needsChoice&&!existing?'Выберите, пропустить готовые кнопки или обновить их оформление.':existing==='update'&&summary?.updateIssue?summary.updateIssue:summary?existing==='update'?`Подготовить кнопок: ${summary.create} · обновить оформление: ${summary.update}.`:`Подготовить кнопок: ${summary.create} · пропустить готовых: ${summary.update}.`:'';
  buttonCanApply=buttonScopeReady&&buttonStylesReady&&!!summary&&!summary.issue&&(!needsChoice||!!existing)&&!(existing==='update'&&!!summary.updateIssue)&&(summary.create>0||(existing==='update'&&summary.update>0));
  if(buttonScopeReady&&buttonStylesReady&&summary&&!summary.issue&&existing==='skip'&&!summary.create)$('buttonPlan').textContent='Все кнопки уже готовы. Можно перейти к проверке и скачиванию. Для изменения оформления выберите применение нового стиля.';
}
function buttonWorkflow(msg:{scope?:{id?:string;name:string;kind:string;profile?:string};scopeMode?:string;scopeHint?:string;name?:string;buttonWorkflow?:ButtonPreparationSummary;buttonStylePreviews?:{normal:PresetPreview;feedback:PresetPreview}}) {
  clearButtonResult();
  const previews=msg.buttonStylePreviews, summary=msg.buttonWorkflow;
  const ready=!!previews?.normal.ready&&!!previews?.feedback.ready;
  const scopeKey=JSON.stringify([msg.scope?.id,msg.scope?.name,msg.scope?.profile,msg.scopeMode,msg.scopeHint]);
  if(scopeKey!==buttonScopeKey){input('skipExistingButtons').checked=false;input('updateExistingButtons').checked=false;buttonScopeKey=scopeKey;}
  buttonSummary=summary;buttonStylesReady=ready;buttonScopeReady=!!msg.scope;
  for(const [role,prefix] of [['normal','normal'],['feedback','active']] as const) {
    const p=previews?.[role],swatch=$(prefix+'ButtonSwatch');
    swatch.style.backgroundColor=p?.fill??'';swatch.style.borderColor=p?.stroke??'';swatch.style.borderRadius=p?.radius!==undefined?`${Math.min(20,p.radius)}px`:'';
    swatch.dataset.ready=String(p?.ready===true);
    $(prefix+'ButtonName').textContent=p?.ready?`${p.name} · найден`:p?.name??'Не выбран';
    $(prefix+'ButtonHint').textContent=p?.hint??'';
  }
  $('buttonStyleHelp').hidden=ready;
  $('buttonScope').textContent=msg.scope?`${msg.scope.kind==='project'?'Проект':'Экран'}: ${msg.scope.name}`:'Выберите экран с кнопками';
  $('buttonScopeHint').textContent=!msg.scope?(ready?'Стили найдены. Теперь выберите Frame экрана с кнопками в Figma.':'Выделите Frame экрана на холсте или в списке слоёв Figma.'):summary?.issue??(summary?`Найдено кнопок: ${summary.total}.`:'Проверяю кнопки выбранного макета.');
  $('buttonExistingChoice').hidden=!msg.scope||!summary||!!summary.issue||summary.update===0;
  buttonPlan();
}
function fields() {
  const kind=input('kind').value;
  const legacy=$<HTMLSelectElement>('buttonMode').querySelector<HTMLOptionElement>('option[value="legacy"]')!;
  legacy.hidden=!legacyButton;legacy.disabled=!legacyButton;
  document.querySelectorAll<HTMLElement>('[data-for]').forEach(e=>e.hidden=!e.dataset.for!.split(' ').includes(kind));
  $('statePreview').hidden=kind!=='button'&&!(kind==='level'&&input('display').value==='multistate');
}
function revokeDownload() {if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=undefined;$('download').hidden=true;}
$('kind').addEventListener('change',fields);
$('display').addEventListener('change',fields);
$('kit').onclick=()=>send('kit',{profile:input('profile').value});
$('prepare').onclick=()=>send('prepare',{profile:input('profile').value});
$('normalButtonPreset').onclick=()=>send('button-preset-normal');
$('activeButtonPreset').onclick=()=>send('button-preset-active');
$('buttonBackground').onclick=()=>send('button-background');
$('applyButtonStyles').onclick=()=>{revokeDownload();buttonResult('Применяю оформление кнопок…','progress');send('button-apply-styles',{corners:input('buttonCorners').checked,existing:input('updateExistingButtons').checked?'update':'skip'});};
$('skipExistingButtons').onchange=$('updateExistingButtons').onchange=()=>{clearButtonResult();buttonPlan();setBusy(operationBusy||packing);};
$('buttonExport').onclick=()=>{revokeDownload();send('export');};
$('buttonCorners').onchange=()=>{clearButtonResult();setBusy(operationBusy||packing);};
function clearRecognition(){recognitionToken=undefined;$('recognitionReport').hidden=true;}
$('recognize').onclick=()=>{clearRecognition();send('recognize',{profile:input('profile').value});};
$('retryRecognition').onclick=()=>send('recognize',{fromReport:true});
$('applyRecognition').onclick=()=>{const token=recognitionToken;clearRecognition();revokeDownload();send('apply-recognition',{token,profile:input('profile').value});};
$('profile').addEventListener('change',()=>{clearRecognition();revokeDownload();clearButtonResult();if(input('scopeMode').value!=='selection')send('context');else setBusy(operationBusy||packing);});
$('scopeMode').addEventListener('change',()=>{revokeDownload();send('context');});
$('check').onclick=()=>send('check');$('export').onclick=()=>{revokeDownload();send('export');};
$('preview').onclick=()=>{const value=input('previewRole').value;send('preview',value.startsWith('id:')?{stateId:Number(value.slice(3))}:{role:value});};
$('mapping').onsubmit=event=>{
  event.preventDefault();
  const data:Record<string,string>={};for(const id of ['kind','buttonMode','key','objectId','controlId','projectName','profile','role','stateName','file','resourceName','stateId','shownBy','modal','display','orientation','min','max','pattern','popup','group','navigate','selectionGroup','enabled','visible'])data[id]=input(id).value;
  data.keyEdited=String(data.key!==loadedKey);
  send('apply',{data});
};
window.onmessage=async(event:MessageEvent)=>{
  // Figma's bridge guarantees pluginMessage, not a parent Window as source.
  // In particular, platform-dispatched MessageEvent can have source === null.
  const msg=event.data?.pluginMessage;if(!msg||typeof msg!=='object'||typeof msg.type!=='string')return;
  if(msg.type==='selection') {
    if(!msg.keepRecognition)clearRecognition();
    if(selectedId!==msg.id)revokeDownload();
    selectedId=msg.id;$('selection').textContent=msg.name;
    const m=(msg.metadata??{}) as Partial<Metadata>;
    if(msg.scopeMode)input('scopeMode').value=msg.scopeMode;
    canRecognize=msg.canRecognize===true;
    hasScope=!!msg.scope;
    buttonWorkflow(msg);
    $('selectionType').textContent=input('scopeMode').value!=='selection'?'Проект':selectedId?({SECTION:'Секция',FRAME:'Frame',GROUP:'Группа',INSTANCE:'Компонент',TEXT:'Текст'} as Record<string,string>)[msg.nodeType]??'Элемент':'Нет выбора';
    $('scope').textContent=msg.scopeHint|| (msg.scope?`Экспорт ${msg.scope.kind==='project'?'проекта':'экрана'}: ${msg.scope.name}`:selectedId?'Выберите внешний Frame экрана или секцию проекта.':'Выделите нужные фреймы вместе, чтобы собрать один проект.');
    $('recognitionHelp').textContent=canRecognize?'При проверке и скачивании ключи и свободные ID назначаются автоматически. Распознавание позволяет заранее посмотреть результат.':selectedId?'Для распознавания выберите секцию проекта или внешний Frame экрана.':'Выберите секцию или экран. Ключи и ID заполнятся при экспорте.';
    legacyButton=m.kind==='button'&&!m.buttonMode;
    input('buttonMode').value=m.buttonMode??(legacyButton?'legacy':'on-off');
    $('prepare').hidden=msg.nodeType!=='FRAME'||!!m.kind;
    $('preparationHelp').hidden=msg.nodeType!=='FRAME'||!!m.kind;
    for(const id of ['key','objectId','controlId','projectName','stateName','file','resourceName','stateId','shownBy','pattern','popup','group'])input(id).value=String(m[id as keyof Metadata]??'');
    loadedKey=input('key').value;
    const navigation=$<HTMLSelectElement>('navigate');navigation.replaceChildren();
    const addTarget=(value:string,label:string)=>{const option=document.createElement('option');option.value=value;option.textContent=label;navigation.appendChild(option);};
    addTarget('','Без перехода');
    for(const target of msg.targets??[])addTarget(target.key,`${target.name}${target.kind==='popup'?' · Popup':''}`);
    if(m.navigate&&!Array.from(navigation.options).some(o=>o.value===m.navigate))addTarget(m.navigate,`Недоступная цель · ${m.navigate}`);
    navigation.value=m.navigate??'';
    $('navigationHelp').textContent=msg.targets?.length?'Выберите цель из текущего проекта. Переход подключается в программе управления Extron.':'Цели не найдены. В «Что экспортировать» выберите «Экраны текущей страницы — один проект» или выделите нужные экраны вместе. Затем снова выберите кнопку.';
    for(const id of ['selectionGroup','enabled','visible'] as const)input(id).value=String(m.behavior?.[id]??'');
    input('display').value=m.display??'slider';input('orientation').value=m.orientation??'left-to-right';input('min').value=String(m.min??0);input('max').value=String(m.max??100);input('modal').value=String(m.modal??false);
    input('kind').value=m.kind??(msg.nodeType==='SECTION'?'project':msg.nodeType==='TEXT'?'label':'page');
    const preview=$<HTMLSelectElement>('previewRole');preview.replaceChildren();
    for(const state of msg.states??[]){const option=document.createElement('option');option.value=state.stateId!==undefined?'id:'+state.stateId:state.role;option.textContent=state.stateId!==undefined?`${state.stateId} · ${state.name} · ${state.role}`:state.name;preview.appendChild(option);}
    if(msg.profile??m.profile??msg.scope?.profile)input('profile').value=msg.profile??m.profile??msg.scope.profile;input('role').value=m.role??'normal';
    fields();if(msg.warning)status(msg.warning,'error');else if(!msg.keepRecognition)status(msg.scope?'Можно скачать пакет. Новые элементы и копии получат ключи и ID автоматически.':selectedId?'Выберите экран для экспорта или задайте особые свойства вручную.':'Выберите секцию проекта или Frame экрана.');setBusy(operationBusy||packing);
  }else if(msg.type==='recognition') {
    revokeDownload();$('bar').hidden=true;
    const hasErrors=msg.errors.length>0;
    const issues=(msg.issues??msg.errors.map((message:string)=>({message,fix:'Исправьте указанное требование и повторите распознавание.'}))) as Partial<RecognitionIssue>[];
    const list=$('recognitionIssues');list.replaceChildren();
    for(const issue of issues){
      const li=document.createElement('li');li.className='recognition-issue';
      const title=document.createElement('p');title.className='issue-title';title.textContent=issue.nodeName?`${issue.nodeName} · ${issue.nodeType}`:'Проверка макета';
      li.appendChild(title);
      if(issue.path){const path=document.createElement('p');path.className='issue-path';path.textContent=issue.path;li.appendChild(path);}
      const problem=document.createElement('p');problem.className='issue-message';problem.textContent=issue.message??'';
      const fix=document.createElement('p');fix.className='issue-fix';fix.textContent='Как исправить: '+issue.fix;li.append(problem,fix);
      if(issue.nodeId&&issue.nodeType!=='PAGE'){const button=document.createElement('button');button.className='secondary';button.textContent='Показать слой';button.dataset.issueNode=issue.nodeId;button.setAttribute('aria-label',`Показать слой ${issue.path??issue.nodeName}`);button.onclick=()=>send('select-issue',{nodeId:issue.nodeId});li.appendChild(button);}
      list.appendChild(li);
    }
    $('recognitionProblems').hidden=!hasErrors;
    $('recognitionErrorTitle').textContent=`Ошибок: ${msg.errors.length}. Назначения не сохранены`;
    $<HTMLDetailsElement>('recognitionAssignments').open=!hasErrors;
    $('recognitionAssignmentsTitle').textContent=hasErrors?`Распознанные назначения: ${msg.rows.length} · есть ошибки`:'Распознанные назначения';
    const rows=$('recognitionRows');rows.replaceChildren();
    const names:Record<string,string>={page:'Экран',button:'Кнопка',label:'Подпись',level:'Регулятор',state:'Состояние',image:'Иконка',graphic:'Изображение',project:'Проект',popup:'Popup','popup-group':'Группа popup','popup-ref':'Место popup',slider:'Slider',value:'Динамический текст',shape:'Фигура',line:'Линия',datetime:'Дата/время'};
    $('recognitionSummary').textContent=`Назначений: ${msg.rows.length} · новых: ${msg.rows.filter((r:{isNew:boolean})=>r.isNew).length}`;
    for(const row of msg.rows){
      const type=row.kind==='button'?(row.buttonMode==='on-off'?'Кнопка · 2 состояния':row.buttonMode==='feedback'?'Кнопка · обратная связь':'Кнопка · прежние состояния'):names[row.kind]??row.kind;
      const li=document.createElement('li');li.className='recognition-item';
      const title=document.createElement('div');title.className='recognition-title';
      const name=document.createElement('span');name.className='recognition-name';name.textContent=row.name;
      const badge=document.createElement('span');badge.className='badge';badge.textContent=row.isNew?'Новое':'Сохранено';title.append(name,badge);
      const detail=document.createElement('p');detail.className='recognition-meta';detail.textContent=[type,row.key,row.objectId!==undefined?`Объект ${row.objectId}`:null,row.controlId!=null?`Extron ID ${row.controlId}`:null].filter(Boolean).join(' · ');
      li.append(title,detail);rows.appendChild(li);
    }
    const notes=$('recognitionNotes');notes.replaceChildren();
    for(const message of msg.warnings){const li=document.createElement('li');li.textContent=message;notes.appendChild(li);}
    recognitionToken=msg.errors.length?undefined:msg.token;
    $('recognitionReport').hidden=false;
    $('applyRecognition').hidden=hasErrors;
    status(hasErrors?`Исправьте ошибки (${msg.errors.length}) в отчёте выше и повторите распознавание. Назначения не изменены.`:'Распознавание завершено. Проверьте список и сохраните назначения.',hasErrors?'error':'success');setBusy(false);
    if(hasErrors){$('recognitionErrorTitle').focus();$('recognitionProblems').scrollIntoView({block:'start'});}
  }else if(msg.type==='progress'){status(msg.message);$('bar').setAttribute('aria-valuetext',msg.message);}
  else if(msg.type==='error'){status(msg.message,'error');if(msg.operation==='button-apply-styles'){buttonResult(msg.message,'error');if(['button-background','button-presets'].includes(msg.code))$<HTMLDetailsElement>('buttonAdvanced').open=true;}setBusy(false);}
  else if(msg.type==='success'){status(msg.message,'success');if(msg.operation==='button-apply-styles')buttonResult(msg.message,'success');setBusy(false);}
  else if(msg.type==='idle'){if(!packing)setBusy(false);}
  else if(msg.type==='bundle') {
    packing=true;setBusy(true);status('Проверка ресурсов и упаковка .exui…');
    try {
      const bundle=msg.bundle as Bundle,bytes=packageExui(bundle);
      revokeDownload();downloadUrl=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/zip'}));
      const link=$<HTMLAnchorElement>('download');link.href=downloadUrl;link.download=`interface-${bundle.profile}.exui`;link.hidden=false;link.click();
      $('bar').hidden=false;$('bar').dataset.complete='true';$('bar').setAttribute('aria-valuenow','100');$('bar').setAttribute('aria-valuetext','Пакет готов');
      status(`Пакет готов: ${elementCount(bundle.screen)} элемента, ${bundle.resources.length} PNG.${msg.assignmentSummary?'\n'+msg.assignmentSummary:''}\nПроверьте его через validate-package и создайте новый .gdl через convert-package.`,'success');
    }catch(e){status(e instanceof Error?e.message:String(e),'error');}
    finally{packing=false;setBusy(false);}
  }
};
fields();setBusy(false);parent.postMessage({pluginMessage:{type:'ready'}},'*');
