import { key,type Metadata } from './model.ts';
import { containerSuffix,freeKey } from './assignment-repair.ts';

type Node = SceneNode|PageNode;
// Owner-bound, so a copied layer does not inherit the original's manual key.
export const MANUAL_KEY='exui-key-manual';
export function hasManualKey(node:{id:string;getPluginData(k:string):string}):boolean {return node.getPluginData(MANUAL_KEY)===node.id;}
export interface KeyChange {node:Node;from:string;to:string}

const namespace=(containerKey:string)=>containerKey.replace(/^(page|popup)\./,'');
// Cyrillic names are rejected by recognize(); a name left with only symbols
// has no readable key of its own, so keep the existing one, not a fallback.
const readable=(name:string)=>/[a-z0-9]/i.test(name.replace(/^(scr|screen|pop|popup|mdl|modalpopup|prj|project|pgrp|popupgroup)_/i,''));

// Keys are readable labels that follow the current layer names; object,
// control and state IDs are never touched here. Manual keys stay fixed, keys
// that already match their name keep priority, the rest receive free keys.
// Works on the draft only; recognize() validates it before anything is written.
export function syncKeys(root:Node,members:readonly SceneNode[],isProject:boolean,assignments:Map<string,Metadata>,elementSuffix:(name:string)=>string|null):KeyChange[] {
  const meta=(node:Node)=>assignments.get(node.id),changes:KeyChange[]=[],used=new Set<string>(),synced=new Set<string>();
  const previous=new Map([...assignments].filter(([,m])=>m.key).map(([id,m])=>[id,m.key!]));
  const eligible=(node:Node)=>!!meta(node)?.key&&!hasManualKey(node);
  const containers:{node:Node;group?:Node}[]=[],groups:Node[]=[];
  if(isProject)for(const node of members){const kind=meta(node)?.kind;if(kind==='popup-group'){groups.push(node);if('children' in node)for(const child of node.children)if(['page','popup'].includes(meta(child)?.kind??''))containers.push({node:child,group:node});}else if(kind==='page'||kind==='popup')containers.push({node});}
  else if(meta(root)?.kind==='page')containers.push({node:root});
  const elementsOf=(container:Node)=>'children' in container?container.children.filter(n=>meta(n)):[];
  const oldNamespace=(container:Node)=>previous.has(container.id)?namespace(previous.get(container.id)!):null;
  const suffixOf=(node:Node)=>{try{return elementSuffix(node.name);}catch{return null;}};
  // A name without a supported prefix keeps its key; only a stale screen namespace moves.
  const keepsNamespace=(node:Node,oldNs:string|null)=>!!oldNs&&meta(node)!.key!.startsWith(oldNs+'.');
  function elementBase(node:Node,oldNs:string|null,ns:string):string|null {
    const suffix=suffixOf(node);if(suffix)return ns+'.'+suffix;
    return keepsNamespace(node,oldNs)?ns+meta(node)!.key!.slice(oldNs!.length):null;
  }
  // Decide which keys move before reserving anything, so fixed keys win.
  if(isProject&&eligible(root)&&(root.type!=='FRAME'||readable(root.name)))synced.add(root.id);
  for(const node of groups)if(eligible(node)&&readable(node.name))synced.add(node.id);
  for(const {node} of containers){if(eligible(node)&&readable(node.name))synced.add(node.id);const oldNs=oldNamespace(node);for(const element of elementsOf(node))if(eligible(element)&&(suffixOf(element)||keepsNamespace(element,oldNs)))synced.add(element.id);}
  for(const {node} of containers)for(const element of elementsOf(node))for(const state of 'children' in element?element.children:[])if(meta(state)?.kind==='state')for(const icon of 'children' in state?state.children:[])if(meta(icon)?.kind==='image'&&eligible(icon)&&meta(icon)!.key===`icon.${previous.get(element.id)}.state${meta(state)!.stateId}`)synced.add(icon.id);
  for(const [id,m] of assignments)if(m.key&&!synced.has(id))used.add(m.key);

  function settle(entries:{node:Node;base:string}[]){
    const pending=entries.filter(e=>synced.has(e.node.id));
    const rest=pending.filter(e=>{const current=meta(e.node)!.key!;if(current===e.base&&!used.has(current)){used.add(current);return false;}return true;});
    for(const {node,base} of rest){const m=meta(node)!,to=freeKey(key(base,'Ключ'),used);if(to!==m.key){changes.push({node,from:m.key!,to});assignments.set(node.id,{...m,key:to});}}
  }
  const containerBase=(node:Node)=>(meta(node)!.kind==='popup'?'popup.':'page.')+containerSuffix(node.name);
  if(isProject&&meta(root)?.key)settle([{node:root,base:root.type==='PAGE'?'project.page':root.type==='SECTION'?'project.section':'project.'+containerSuffix(root.name)}]);
  settle([...groups.map(node=>({node,base:'group.'+containerSuffix(node.name)})),...containers.map(({node})=>({node,base:containerBase(node)}))]);
  const elements:{node:Node;base:string}[]=[];
  for(const {node} of containers){const oldNs=oldNamespace(node),ns=namespace(meta(node)!.key!);for(const element of elementsOf(node)){const base=synced.has(element.id)?elementBase(element,oldNs,ns):null;if(base)elements.push({node:element,base});}}
  settle(elements);
  const icons:{node:Node;base:string}[]=[];
  for(const {node} of containers)for(const element of elementsOf(node))for(const state of 'children' in element?element.children:[]){const sm=meta(state);if(sm?.kind!=='state')continue;for(const icon of 'children' in state?state.children:[])if(synced.has(icon.id))icons.push({node:icon,base:`icon.${meta(element)!.key}.state${sm.stateId}`});}
  settle(icons);

  // Popup and group references follow renamed containers.
  const renamed=new Map<string,string>();for(const node of [root,...groups,...containers.map(c=>c.node)]){const from=previous.get(node.id),to=meta(node)?.key;if(from&&to&&to!==from)renamed.set(from,to);}
  if(renamed.size)for(const [id,m] of assignments){let next=m;for(const field of ['popup','group'] as const){const target=m[field];if(target&&renamed.has(target))next={...next,[field]:renamed.get(target)};}if(next!==m)assignments.set(id,next);}
  return changes;
}
