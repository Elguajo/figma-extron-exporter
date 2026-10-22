import { fail,key,metadataSchema,readMetadata,type Metadata,type Profile,type LinkTarget as Target,type AuthoringLinks } from './model.ts';
export type { AuthoringLinks } from './model.ts';
import { recognize } from './recognize.ts';
import { byName,type ProjectNode,type ProjectOptions } from './project.ts';
import { draft,saveDraft } from './popup-binding.ts';
import { hasTransform } from './read-node.ts';

export interface LinkContext {root:ProjectNode;options:ProjectOptions;profile:Profile}
function snapshot(ctx:LinkContext) {
  const plan=recognize(ctx.root,ctx.profile,ctx.options),nodes=new Map<string,SceneNode>();
  function visit(n:SceneNode|PageNode){if(n.type!=='PAGE')nodes.set(n.id,n);if('children' in n)for(const c of n===ctx.root?(ctx.options.members??n.children):n.children)visit(c);}
  visit(ctx.root);
  const proposed=new Map(plan.writes.map(w=>[w.node.id,w.metadata]));
  const read=(n:SceneNode)=>proposed.get(n.id)??readMetadata(n,{allowCopied:true});
  const items=plan.rows.flatMap(row=>{const node=nodes.get(row.id);return node?[{node,m:read(node)!}]:[];});
  return {plan,nodes,items,read};
}
function target(n:SceneNode):Target{return {id:n.id,name:n.name};}
function popupTargets(s:ReturnType<typeof snapshot>,ref:SceneNode) {
  const valid=(n:SceneNode)=>n.type==='FRAME'&&!hasTransform(n)&&Math.round(n.width)===Math.round(ref.width)&&Math.round(n.height)===Math.round(ref.height)&&s.read(n)?.modal!==true&&(!s.read(n)?.profile||s.read(n)?.profile===s.plan.profile);
  return byName(s.items.filter(({node,m})=>
    m.kind==='popup'&&!m.group&&s.read(node.parent as SceneNode)?.kind!=='popup-group'&&valid(node)||
    m.kind==='popup-group'&&node.type==='FRAME'&&node.children.length>0&&node.children.every(c=>s.read(c)?.kind==='popup'&&valid(c))
  ).map(({node})=>({node,...target(node)})));
}
export function authoringLinks(ctx:LinkContext,selection:readonly SceneNode[]):AuthoringLinks {
  const s=snapshot(ctx),pages=s.items.filter(i=>i.m.kind==='page'&&(!i.m.profile||i.m.profile===ctx.profile)),chosen=selection.length===1?selection[0]:undefined;
  const first=(ctx.options.members??ctx.root.children).find(n=>s.read(n)?.kind==='page')??pages[0]?.node;
  const start=pages.find(i=>i.m.shownBy==='start')??pages.find(i=>i.node===first&&!i.m.shownBy);
  const result:AuthoringLinks={pages:byName(pages.map(i=>target(i.node))),startId:start?.node.id,groups:[]};
  const grouped=new Map<string,SceneNode[]>();
  for(const {node,m} of s.items)if(m.kind==='button'&&m.behavior?.selectionGroup){const k=m.behavior.selectionGroup;grouped.set(k,[...(grouped.get(k)??[]),node]);}
  result.groups=[...grouped].map(([key,nodes])=>({key,name:`${nodes[0].parent?.name??'Кнопки'} · ${nodes.length}: ${byName(nodes).slice(0,2).map(n=>n.name).join(', ')}${nodes.length>2?'…':''}`}));
  if(selection.length&&selection.every(n=>s.read(n)?.kind==='button'&&s.nodes.has(n.id))){
    const values=new Set(selection.map(n=>s.read(n)?.behavior?.selectionGroup??''));
    result.buttons={ids:selection.map(n=>n.id),names:selection.map(n=>n.name),group:values.size===1?[...values][0]:undefined,mixed:values.size>1};
  }
  if(chosen&&s.nodes.has(chosen.id)&&s.read(chosen)?.kind==='popup-ref'){
    const m=s.read(chosen)!,targets=popupTargets(s,chosen),linked=s.items.find(i=>m.popup&&i.m.kind==='popup'&&i.m.key===m.popup||m.group&&i.m.kind==='popup-group'&&i.m.key===m.group);
    const members=linked?.m.kind==='popup-group'&&'children' in linked.node?linked.node.children.map(target):linked?[target(linked.node)]:[];
    result.reference={id:chosen.id,targets:targets.map(({id,name})=>({id,name})),targetId:linked?.node.id,members,missing:!!(m.group||m.popup)&&!linked};
  }
  return result;
}
function chosen(ctx:LinkContext,id:string){const s=snapshot(ctx),node=s.nodes.get(id);if(!node||!s.plan.rows.some(r=>r.id===id))fail('links','Элемент удалён или больше не входит в проект. Выберите его повторно.');return {...s,node};}
export function setReferenceTarget(ctx:LinkContext,referenceId:string,targetId:string):void {
  const s=chosen(ctx,referenceId),ref=s.node;
  if(ref.type!=='FRAME'||s.read(ref)?.kind!=='popup-ref'||ref.children.length||hasTransform(ref)||ref.parent?.type!=='FRAME'||s.read(ref.parent)?.kind!=='page')fail('links','Выберите пустое место popup непосредственно внутри экрана, без трансформации.');
  const r=draft(s.plan,ref),values=new Map<string,Metadata>([[ref.id,r]]),nodes:SceneNode[]=[ref];delete r.group;delete r.popup;
  if(targetId){
    const selected=popupTargets(s,ref).find(t=>t.id===targetId)?.node;if(!selected)fail('links','Цель недоступна. Popup должны иметь размеры места и принадлежать этому проекту.');
    const m=draft(s.plan,selected);nodes.push(selected);values.set(selected.id,m);
    if(m.kind==='popup-group'){
      r.group=m.key;
      for(const popup of (selected as FrameNode).children){const p=draft(s.plan,popup);p.group=m.key;p.schema=metadataSchema(p);nodes.push(popup);values.set(popup.id,p);}
    }else r.popup=m.key;
  }
  saveDraft(s.plan,nodes,values);
}
export function setStartPage(ctx:LinkContext,id:string):void {
  const s=chosen(ctx,id),selected=s.read(s.node);if(selected?.kind!=='page'||selected.profile&&selected.profile!==ctx.profile)fail('links','Стартовой может быть только страница проекта с выбранным профилем.');
  const nodes:SceneNode[]=[],values=new Map<string,Metadata>();
  for(const {node,m} of s.items)if(m.kind==='page'){
    const value=draft(s.plan,node);if(node.id===id)value.shownBy='start';else if(!value.shownBy||value.shownBy==='start')value.shownBy='program';
    value.schema=metadataSchema(value);nodes.push(node);values.set(node.id,value);
  }
  saveDraft(s.plan,nodes,values);
}
export function setSelectionGroup(ctx:LinkContext,ids:readonly string[],group:string,create=false):string {
  const s=snapshot(ctx),selection=figma.currentPage.selection;
  if(!ids.length||ids.length!==selection.length||new Set(ids).size!==ids.length||selection.some(n=>!ids.includes(n.id)))fail('links','Выделение изменилось. Выберите кнопки повторно.');
  const nodes=ids.map(id=>s.nodes.get(id));
  if(nodes.some(n=>!n||s.read(n)?.kind!=='button'))fail('links','Выберите только кнопки этого проекта.');
  let value=group;
  if(create){
    if(nodes.length<2)fail('links','Для новой группы выделите хотя бы две кнопки.');
    if(nodes.some(n=>n!.parent!==nodes[0]!.parent))fail('links','Новая группа должна содержать кнопки одной страницы или popup.');
    const stem=(s.read(nodes[0]!.parent as SceneNode)?.key??'buttons').slice(0,75).replace(/[.-]+$/,'');
    const used=new Set(s.items.map(i=>i.m.behavior?.selectionGroup));let index=1;do{value=`${stem}.choice.${index++}`;}while(used.has(value));
  }else if(value&&!s.items.some(i=>i.m.kind==='button'&&i.m.behavior?.selectionGroup===value))fail('links','Группа больше не существует. Выберите её повторно.');
  if(value)key(value,'Группа выбора');
  const values=new Map<string,Metadata>();
  for(const node of nodes as SceneNode[]){const m=draft(s.plan,node),behavior={...m.behavior};delete behavior.selectionGroup;if(value)behavior.selectionGroup=value;
    delete m.behavior;if(Object.keys(behavior).length)m.behavior=behavior;m.schema=metadataSchema(m);values.set(node.id,m);}
  saveDraft(s.plan,nodes as SceneNode[],values);return value;
}
export function linkedNode(ctx:LinkContext,id:string):SceneNode {
  const s=chosen(ctx,id);return s.node;
}
