import { DATA_KEY,fail,integer,readMetadata,type Bundle,type Metadata,type Profile,type FigmaOrigin,type FigmaOriginNode } from './model.ts';
import type { ProjectNode } from './project.ts';
import {popupContext} from './popup-binding.ts';

export const ORIGIN_TOKEN='exui-figma-origin-token';
interface MapEntry extends FigmaOriginNode {sourceControlId:number}
export interface FigmaIdMap {schema:'exui-figma-id-map/1';profile:Profile;pageId:string;pageToken:string;projectName:string;entries:MapEntry[]}
interface Identity {node:SceneNode;raw:string;metadata:Metadata}
export interface IdMapPlan {page:PageNode;signature:string;rows:{nodeId:string;name:string;from:number;to:number}[];writes:{node:SceneNode;raw:string;value:string}[];registries:{node:BaseNode;raw:string;value:string}[]}
function identities(page:PageNode):Identity[]{
  const result:Identity[]=[];
  function visit(node:SceneNode){const m=readMetadata(node,{allowCopied:true});if(m)result.push({node,raw:node.getPluginData(DATA_KEY),metadata:m});if('children' in node)for(const child of node.children)visit(child);}
  for(const node of page.children)visit(node);return result;
}
function signature(page:PageNode):string{return JSON.stringify([page.id,page.getPluginData(ORIGIN_TOKEN),identities(page).map(i=>[i.node.id,i.node.parent?.id,i.raw]),registries(page).map(n=>[n.id,n.parent?.id,n.getPluginData('exui-id-registry')])]);}
function registries(page:PageNode):BaseNode[]{const result:BaseNode[]=[];function visit(n:BaseNode){if(n.getPluginData('exui-id-registry'))result.push(n);if('children' in n)for(const child of n.children as readonly SceneNode[])visit(child);}visit(page);return result;}
function token(page:PageNode,create=false):string {
  const raw=page.getPluginData(ORIGIN_TOKEN);let saved:{ownerNodeId?:string;token?:string}={};
  if(raw)try{saved=JSON.parse(raw);}catch{fail('id-map','Повреждён идентификатор исходной страницы Figma.');}
  if(saved.ownerNodeId===page.id&&typeof saved.token==='string'&&/^[a-z0-9-]{16,160}$/.test(saved.token))return saved.token;
  if(!create)fail('id-map','Эта страница не является источником карты ID. Откройте исходный макет и экспортируйте его заново.');
  const value=Date.now().toString(36)+'-'+Array.from({length:4},()=>Math.random().toString(36).slice(2)).join('-');
  page.setPluginData(ORIGIN_TOKEN,JSON.stringify({ownerNodeId:page.id,token:value}));return value;
}
export function createOrigin(root:ProjectNode,bundle:Bundle,members?:readonly SceneNode[]):FigmaOrigin {
  let owner:BaseNode=root;while(owner.type!=='PAGE'&&owner.parent)owner=owner.parent;
  if(owner!==figma.currentPage)fail('design-changed','Страница изменилась во время экспорта. Повторите экспорт на исходной странице.');
  const page=figma.currentPage,keys=new Set(('elements' in bundle.screen?bundle.screen.elements:[...bundle.screen.pages,...bundle.screen.popups].flatMap(c=>c.elements)).filter(e=>e.kind==='button').map(e=>e.key));
  const nodes:FigmaOriginNode[]=[];
  function visit(node:SceneNode|PageNode){const m=readMetadata(node,{allowCopied:true});if(m?.kind==='button'&&keys.has(m.key)&&m.ownerNodeId===node.id)nodes.push({nodeId:node.id,key:m.key,controlId:m.controlId,name:node.name});if('children' in node)for(const child of node===root?(members??node.children):node.children)visit(child);}
  visit(root);if(nodes.length!==keys.size)fail('id-map','Не удалось связать экспортированные кнопки со слоями Figma.');
  return {schema:'exui-figma-origin/1',pageId:page.id,pageToken:token(page,true),projectName:bundle.screen.project.name,nodes};
}
export function planIdMap(page:PageNode,raw:string):IdMapPlan {
  if(typeof raw!=='string'||raw.length>128*1024)fail('id-map','Карта ID больше 128 КиБ.');
  let bytes=0;for(const c of raw){const n=c.codePointAt(0)!;bytes+=n<128?1:n<2048?2:n<65536?3:4;}if(bytes>128*1024)fail('id-map','Карта ID больше 128 КиБ.');
  let map:FigmaIdMap;try{map=JSON.parse(raw);}catch{fail('id-map','Не удалось прочитать JSON карты ID.');}
  if(!map||map.schema!=='exui-figma-id-map/1'||!['tlp-pro-1025m','tlp-pro-300m-portrait'].includes(map.profile)||!Array.isArray(map.entries)||map.entries.length<1||map.entries.length>256)fail('id-map','Нужна карта ID для Figma, сохранённая LayoutUpdater.');
  if(map.pageId!==page.id||map.pageToken!==token(page))fail('id-map','Карта ID относится к другой странице/макету Figma. Откройте исходную страницу экспорта.');
  const all=identities(page),byId=new Map(all.map(i=>[i.node.id,i])),changes=new Map<string,number>(),used=new Set<number>();
  const rows:IdMapPlan['rows']=[];
  for(const entry of map.entries){
    if(!entry||typeof entry.nodeId!=='string'||typeof entry.key!=='string')fail('id-map','Повреждена строка карты ID.');
    integer(entry.controlId,1,65535,'ID GUI Designer');integer(entry.sourceControlId,1,65535,'Исходный ID Figma');
    if(changes.has(entry.nodeId)||used.has(entry.controlId))fail('id-map','В карте повторяется слой или целевой ID.');
    const item=byId.get(entry.nodeId),m=item?.metadata;
    if(!item||m?.kind!=='button'||m.ownerNodeId!==item.node.id||m.key!==entry.key)fail('id-map',`Кнопка «${entry.name??entry.nodeId}» удалена, скопирована или переименована после экспорта. Экспортируйте макет и обновите карту.`);
    for(let parent=item.node.parent;parent&&parent.type!=='PAGE';parent=parent.parent){const saved=readMetadata(parent,{allowCopied:true});if(saved?.profile){if(saved.profile!==map.profile)fail('id-map','Кнопка перенесена в другой профиль панели. Обновите карту ID.');break;}}
    if(m.controlId!==entry.sourceControlId&&m.controlId!==entry.controlId)fail('id-map',`${item.node.name}: ID изменился после экспорта (${m.controlId}). Обновите карту перед применением.`);
    changes.set(item.node.id,entry.controlId);used.add(entry.controlId);rows.push({nodeId:item.node.id,name:item.node.name,from:m.controlId,to:entry.controlId});
  }
  const contexts=[...changes.keys()].map(id=>popupContext(byId.get(id)!.node,map.profile));
  const belongs=(node:BaseNode)=>contexts.some(ctx=>{if(node===ctx.root)return true;let member=node;while(member.parent&&member.parent!==ctx.root)member=member.parent;return member.parent===ctx.root&&(!ctx.options.members||ctx.options.members.some(n=>n.id===member.id));});
  const scoped=all.filter(i=>belongs(i.node));
  // Validate the final batch, so swaps do not conflict with an intermediate ID.
  for(const item of scoped){const m=item.metadata;if(!['button','value','level','slider'].includes(m.kind)||m.ownerNodeId!==item.node.id||changes.has(item.node.id))continue;if(used.has(m.controlId!))fail('id-map',`ID ${m.controlId} уже занят: ${item.node.name}. Включите этот элемент в сопоставление или выберите другой ID.`);}
  const writes=[...changes].flatMap(([id,controlId])=>{const item=byId.get(id)!;return item.metadata.controlId===controlId?[]:[{node:item.node,raw:item.raw,value:JSON.stringify({...item.metadata,controlId})}];});
  const maximum=scoped.reduce((max,i)=>i.metadata.ownerNodeId===i.node.id?Math.max(max,i.metadata.controlId??0):max,Math.max(...used))+1;
  const registryChanges=registries(page).filter(belongs).map(node=>{const before=node.getPluginData('exui-id-registry');let r:{schema:string;nextControlId:number};try{r=JSON.parse(before);}catch{fail('id-map','Повреждён реестр ID.');}if(!['exui-id-registry/1','exui-id-registry/2'].includes(r!.schema))fail('id-map','Неизвестный реестр ID.');integer(r!.nextControlId,1,65536,'Следующий ID');return {node,raw:before,value:JSON.stringify({...r!,nextControlId:Math.max(r!.nextControlId,maximum)})};}).filter(r=>r.raw!==r.value);
  return {page,signature:signature(page),rows,writes,registries:registryChanges};
}
export function applyIdMap(plan:IdMapPlan):number {
  if(figma.currentPage!==plan.page||signature(plan.page)!==plan.signature)fail('id-map-stale','Назначения или страница изменились. Обновите предпросмотр карты ID.');
  try{for(const r of plan.registries)r.node.setPluginData('exui-id-registry',r.value);for(const w of plan.writes)w.node.setPluginData(DATA_KEY,w.value);}
  catch(error){const failed:string[]=[];for(const w of plan.writes)try{w.node.setPluginData(DATA_KEY,w.raw);}catch{failed.push(w.node.name);}if(!failed.length)for(const r of plan.registries)try{r.node.setPluginData('exui-id-registry',r.raw);}catch{failed.push(r.node.name);}if(failed.length)fail('id-map-rollback','Не удалось восстановить назначения: '+failed.join(', '));throw error;}
  figma.commitUndo();return plan.writes.length;
}
