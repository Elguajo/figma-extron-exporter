import { packageExui } from './package.ts';
import { elementCount, type Bundle, type Metadata } from './model.ts';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=(id:string)=>$<HTMLInputElement>(id);
let packing=false,operationBusy=false,selectedId:string|null=null,downloadUrl:string|undefined;
let recognitionToken:number|undefined;
let legacyButton=false;
const send=(type:string,extra:Record<string,unknown>={})=>{if(type!=='recognize'&&type!=='apply-recognition')clearRecognition();setBusy(true);if(type==='export'){const bar=$('bar');bar.hidden=false;bar.dataset.complete='false';bar.removeAttribute('aria-valuenow');bar.setAttribute('aria-valuetext','Подготовка экспорта');}parent.postMessage({pluginMessage:{type,...extra}},'*');};
function status(message:string,kind='progress') { $('status').textContent=message;$('status').dataset.kind=kind;$('status').setAttribute('role',kind==='error'?'alert':'status');if(kind==='error')$('bar').hidden=true; }
function setBusy(busy:boolean) {
  operationBusy=busy;
  document.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=busy||(!selectedId&&!['demo','kit'].includes(b.id)));
  $<HTMLButtonElement>('applyRecognition').disabled=busy||recognitionToken===undefined;
  $('mapping').setAttribute('aria-busy',String(busy));
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
$('demo').onclick=()=>send('demo',{profile:input('profile').value});
$('kit').onclick=()=>send('kit',{profile:input('profile').value});
$('prepare').onclick=()=>send('prepare',{profile:input('profile').value});
function clearRecognition(){recognitionToken=undefined;$('recognitionReport').hidden=true;}
$('recognize').onclick=()=>{clearRecognition();send('recognize',{profile:input('profile').value});};
$('applyRecognition').onclick=()=>{const token=recognitionToken;clearRecognition();revokeDownload();send('apply-recognition',{token,profile:input('profile').value});};
$('profile').addEventListener('change',()=>{clearRecognition();setBusy(operationBusy||packing);});
$('check').onclick=()=>send('check');$('export').onclick=()=>{revokeDownload();send('export');};
$('preview').onclick=()=>{const value=input('previewRole').value;send('preview',value.startsWith('id:')?{stateId:Number(value.slice(3))}:{role:value});};
$('mapping').onsubmit=event=>{
  event.preventDefault();
  const data:Record<string,string>={};for(const id of ['kind','buttonMode','key','objectId','controlId','projectName','profile','role','stateName','file','resourceName','stateId','shownBy','modal','display','orientation','min','max','pattern','popup','group','navigate','selectionGroup','enabled','visible'])data[id]=input(id).value;
  send('apply',{data});
};
window.onmessage=async(event:MessageEvent)=>{
  // Figma's bridge guarantees pluginMessage, not a parent Window as source.
  // In particular, platform-dispatched MessageEvent can have source === null.
  const msg=event.data?.pluginMessage;if(!msg||typeof msg!=='object'||typeof msg.type!=='string')return;
  if(msg.type==='selection') {
    clearRecognition();
    if(selectedId!==msg.id)revokeDownload();
    selectedId=msg.id;$('selection').textContent=msg.name+(msg.nodeType?' · '+msg.nodeType:'');
    const m=(msg.metadata??{}) as Partial<Metadata>;
    legacyButton=m.kind==='button'&&!m.buttonMode;
    input('buttonMode').value=m.buttonMode??(legacyButton?'legacy':'on-off');
    $('prepare').hidden=msg.nodeType!=='FRAME'||!!m.kind;
    $('preparationHelp').hidden=msg.nodeType!=='FRAME'||!!m.kind;
    for(const id of ['key','objectId','controlId','projectName','stateName','file','resourceName','stateId','shownBy','pattern','popup','group','navigate'])input(id).value=String(m[id as keyof Metadata]??'');
    for(const id of ['selectionGroup','enabled','visible'] as const)input(id).value=String(m.behavior?.[id]??'');
    input('display').value=m.display??'slider';input('orientation').value=m.orientation??'left-to-right';input('min').value=String(m.min??0);input('max').value=String(m.max??100);input('modal').value=String(m.modal??false);
    input('kind').value=m.kind??(msg.nodeType==='TEXT'?'label':'page');
    const preview=$<HTMLSelectElement>('previewRole');preview.replaceChildren();
    const fallback=m.buttonMode==='on-off'?[{role:'normal',name:'Off'},{role:'feedback',name:'On'}]:[{role:'normal',name:'Normal'},{role:'feedback',name:'Active'},{role:'pressed',name:'Pressed'}];
    for(const state of msg.states?.length?msg.states:fallback){const option=document.createElement('option');option.value=state.stateId!==undefined?'id:'+state.stateId:state.role;option.textContent=state.stateId!==undefined?`${state.stateId} · ${state.name} · ${state.role}`:state.name;preview.appendChild(option);}
    if(m.profile)input('profile').value=m.profile;input('role').value=m.role??'normal';
    fields();if(msg.warning)status(msg.warning,'error');setBusy(operationBusy||packing);
  }else if(msg.type==='recognition') {
    const rows=$('recognitionRows');rows.replaceChildren();
    const names:Record<string,string>={page:'Экран',button:'Кнопка',label:'Подпись',level:'Регулятор',state:'Состояние',image:'Иконка',graphic:'Изображение',project:'Проект',popup:'Popup','popup-group':'Группа popup','popup-ref':'Место popup',slider:'Slider',value:'Динамический текст',shape:'Фигура',line:'Линия',datetime:'Дата/время'};
    for(const row of msg.rows){const type=row.kind==='button'?(row.buttonMode==='on-off'?'Кнопка · Off/On':row.buttonMode==='feedback'?'Кнопка · Normal/Active/Pressed':'Кнопка · прежние состояния'):names[row.kind]??row.kind;const tr=document.createElement('tr');for(const value of [row.name,type,row.key??'—',row.objectId??'—',row.controlId??'—',row.isNew?'Новое':'Сохранено']){const td=document.createElement('td');td.textContent=String(value);tr.appendChild(td);}rows.appendChild(tr);}
    const notes=$('recognitionNotes');notes.replaceChildren();
    for(const message of [...msg.errors,...msg.warnings]){const li=document.createElement('li');li.textContent=message;notes.appendChild(li);}
    recognitionToken=msg.errors.length?undefined:msg.token;
    $('recognitionReport').hidden=false;
    status(msg.errors.length?'Исправьте ошибки и повторите распознавание. Назначения не изменены.':'Распознавание завершено. Проверьте таблицу и сохраните назначения.',msg.errors.length?'error':'success');setBusy(false);
  }else if(msg.type==='progress'){status(msg.message);$('bar').setAttribute('aria-valuetext',msg.message);}
  else if(msg.type==='error'){status(msg.message,'error');setBusy(false);}
  else if(msg.type==='success'){status(msg.message,'success');setBusy(false);}
  else if(msg.type==='idle'){if(!packing)setBusy(false);}
  else if(msg.type==='bundle') {
    packing=true;setBusy(true);status('Проверка ресурсов и упаковка .exui…');
    try {
      const bundle=msg.bundle as Bundle,bytes=packageExui(bundle);
      revokeDownload();downloadUrl=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/zip'}));
      const link=$<HTMLAnchorElement>('download');link.href=downloadUrl;link.download=`interface-${bundle.profile}.exui`;link.hidden=false;link.click();
      $('bar').hidden=false;$('bar').dataset.complete='true';$('bar').setAttribute('aria-valuenow','100');$('bar').setAttribute('aria-valuetext','Пакет готов');
      status(`Пакет готов: ${elementCount(bundle.screen)} элемента, ${bundle.resources.length} PNG.\nПроверьте его через validate-package и создайте новый .gdl через convert-package.`,'success');
    }catch(e){status(e instanceof Error?e.message:String(e),'error');}
    finally{packing=false;setBusy(false);}
  }
};
fields();setBusy(false);parent.postMessage({pluginMessage:{type:'ready'}},'*');
