import { CONTROL_KINDS,ELEMENT_KINDS,key,type Metadata } from './model.ts';

type Node = SceneNode|PageNode;
export interface AssignmentIds {object():number;control():number;container():number;group():number}

// Display names are not identifiers. Keep the original Figma names intact.
export function containerSuffix(name:string):string {
  return name.replace(/^(scr|screen|pop|popup|mdl|modalpopup|prj|project|pgrp|popupgroup)_/i,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/^[^a-z]+/,'').slice(0,70).replace(/-+$/,'')||'screen';
}
export function freeKey(base:string,used:Set<string>):string {
  key(base,'Ключ');let result=base,index=2;
  while(used.has(result)){const suffix='-'+index++;result=base.slice(0,100-suffix.length).replace(/[.-]+$/,'')+suffix;}
  used.add(result);return result;
}

// Work only on a draft. recognize() validates it before applyRecognition() writes
// anything, and that existing transaction also rolls back repairs on failure.
export function repairAssignments(nodes:Node[],saved:Map<string,Metadata>,ids:AssignmentIds):Map<string,Metadata> {
  const result=new Map(saved),keys=new Set([...saved.values()].map(m=>m.key).filter((k):k is string=>!!k));
  const keyOwners=new Map<string,Metadata['kind']>(),containers=new Set<number>(),groups=new Set<number>(),controls=new Set<number>(),objects=new Map<string,Set<number>>();
  // Originals keep their assignments even when a copy is earlier in layer order.
  const ordered=[...nodes.filter(n=>saved.get(n.id)?.ownerNodeId===n.id),...nodes.filter(n=>saved.get(n.id)?.ownerNodeId!==n.id)];
  for(const node of ordered){
    const raw=saved.get(node.id);if(!raw)continue;const m={...raw},copy=raw.ownerNodeId!==node.id;
    m.ownerNodeId=node.id;
    if(m.key){
      // Original image keys may deliberately share a single PNG resource.
      const collision=keyOwners.has(m.key)&&!(m.kind==='image'&&keyOwners.get(m.key)==='image');
      if(copy||collision){const prefix=({page:'page',popup:'popup','popup-group':'group',project:'project'} as Record<string,string>)[m.kind];m.key=freeKey(prefix?prefix+'.'+containerSuffix(node.name):m.key,keys);}
      keyOwners.set(m.key,m.kind);
    }
    if(m.kind==='page'||m.kind==='popup'){
      if(copy||containers.has(m.objectId!))m.objectId=ids.container();containers.add(m.objectId!);
    }else if(m.kind==='popup-group'){
      if(copy||groups.has(m.objectId!))m.objectId=ids.group();groups.add(m.objectId!);
    }else if(ELEMENT_KINDS.includes(m.kind)){
      const parent=node.parent?.id??'',used=objects.get(parent)??new Set<number>();objects.set(parent,used);
      if(copy||used.has(m.objectId!))m.objectId=ids.object();used.add(m.objectId!);
      if(CONTROL_KINDS.includes(m.kind)){if(copy||controls.has(m.controlId!))m.controlId=ids.control();controls.add(m.controlId!);}
    }
    if(m.kind==='graphic'&&(copy||m.objectId!==raw.objectId||m.key!==raw.key)){m.file=`assets/graphic-${m.objectId}.png`;m.resourceName=`exui-graphic-${m.objectId}.png`;}
    result.set(node.id,m);
  }
  // References inside a copied project follow its own containers. Outside that
  // subtree retain a surviving target; remap only when the old key disappeared.
  const scopes=new Map<string,Map<string,Set<string>>>(),global=new Map<string,Set<string>>();
  const copyScope=(node:Node)=>{let scope=node.id,parent=node.parent;while(parent&&saved.get(parent.id)?.ownerNodeId!==undefined&&saved.get(parent.id)!.ownerNodeId!==parent.id){scope=parent.id;parent=parent.parent;}return scope;};
  function add(map:Map<string,Set<string>>,from:string,to:string){const values=map.get(from)??new Set<string>();values.add(to);map.set(from,values);}
  for(const node of nodes){const raw=saved.get(node.id),m=result.get(node.id);if(!raw?.key||!m?.key||!['page','popup','popup-group'].includes(m.kind))continue;add(global,raw.key,m.key);if(raw.ownerNodeId!==node.id){const scope=copyScope(node),map=scopes.get(scope)??new Map<string,Set<string>>();add(map,raw.key,m.key);scopes.set(scope,map);}}
  for(const node of nodes){const raw=saved.get(node.id),m=result.get(node.id);if(!raw||!m)continue;
    for(const field of ['popup','group'] as const){const old=m[field];if(!old)continue;const local=raw.ownerNodeId!==node.id?scopes.get(copyScope(node))?.get(old):undefined,targets=local??global.get(old);if(targets?.size===1)m[field]=[...targets][0];}
    if(m.kind==='image'&&node.parent?.parent){const control=result.get(node.parent.parent.id),previous=saved.get(node.parent.parent.id),state=result.get(node.parent.id);if(control&&state&&(raw.ownerNodeId!==node.id||control.key!==previous?.key||control.objectId!==previous?.objectId)){m.key=key(`icon.${control.key}.state${state.stateId}`,'Ключ иконки');m.file=`assets/control-${control.objectId}-${state.stateId}.png`;m.resourceName=`exui-control-${control.objectId}-${state.stateId}.png`;}}
    // A copied start page is a normal additional page when its original is
    // included. Preserve the other pages' program setting.
    if(m.kind==='page'&&raw.ownerNodeId!==node.id&&m.shownBy==='start'&&nodes.some(n=>n.id!==node.id&&saved.get(n.id)?.ownerNodeId===n.id&&saved.get(n.id)?.shownBy==='start'))m.shownBy='program';
  }
  return result;
}
