import { packageExui } from './package.ts';
import type { Bundle, Metadata } from './model.ts';
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=(id:string)=>$<HTMLInputElement>(id);
let packing=false,operationBusy=false,selectedId:string|null=null,downloadUrl:string|undefined;
const send=(type:string,extra:Record<string,unknown>={})=>{setBusy(true);if(type==='export'){const bar=$('bar');bar.hidden=false;bar.dataset.complete='false';bar.removeAttribute('aria-valuenow');bar.setAttribute('aria-valuetext','Подготовка экспорта');}parent.postMessage({pluginMessage:{type,...extra}},'*');};
function status(message:string,kind='progress') { $('status').textContent=message;$('status').dataset.kind=kind;$('status').setAttribute('role',kind==='error'?'alert':'status');if(kind==='error')$('bar').hidden=true; }
function setBusy(busy:boolean) {
  operationBusy=busy;
  document.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=busy||(!selectedId&&b.id!=='demo'));
  $('mapping').setAttribute('aria-busy',String(busy));
}
function fields() {
  const kind=input('kind').value;
  document.querySelectorAll<HTMLElement>('[data-for]').forEach(e=>e.hidden=!e.dataset.for!.split(' ').includes(kind));
}
function revokeDownload() {if(downloadUrl)URL.revokeObjectURL(downloadUrl);downloadUrl=undefined;$('download').hidden=true;}
$('kind').addEventListener('change',fields);
$('demo').onclick=()=>send('demo',{profile:input('profile').value});
$('check').onclick=()=>send('check');$('export').onclick=()=>{revokeDownload();send('export');};
$('preview').onclick=()=>send('preview',{role:input('previewRole').value});
$('mapping').onsubmit=event=>{
  event.preventDefault();
  const data:Record<string,string>={};for(const id of ['kind','key','objectId','controlId','projectName','profile','role','stateName','file','resourceName'])data[id]=input(id).value;
  send('apply',{data});
};
window.onmessage=async(event:MessageEvent)=>{
  if(event.source!==parent)return;
  const msg=event.data?.pluginMessage;if(!msg)return;
  if(msg.type==='selection') {
    if(selectedId!==msg.id)revokeDownload();
    selectedId=msg.id;$('selection').textContent=msg.name+(msg.nodeType?' · '+msg.nodeType:'');
    const m=(msg.metadata??{}) as Partial<Metadata>;
    for(const id of ['key','objectId','controlId','projectName','stateName','file','resourceName'])input(id).value=String(m[id as keyof Metadata]??'');
    input('kind').value=m.kind??(msg.nodeType==='TEXT'?'label':'page');
    if(m.profile)input('profile').value=m.profile;input('role').value=m.role??'normal';
    fields();if(msg.warning)status(msg.warning,'error');setBusy(operationBusy||packing);
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
      status(`Пакет готов: ${bundle.screen.elements.length} элемента, ${bundle.resources.length} PNG.\nПроверьте его через validate-package и создайте новый .gdl через convert-package.`,'success');
    }catch(e){status(e instanceof Error?e.message:String(e),'error');}
    finally{packing=false;setBusy(false);}
  }
};
fields();setBusy(false);parent.postMessage({pluginMessage:{type:'ready'}},'*');
