import { DATA_KEY,fail,integer,key,text,PROFILES,type Metadata,type Container,type ProjectScreen,type Asset,type Profile } from './model.ts';
import type { Capture } from './export.ts';
import { rect } from './read-node.ts';
export type ProjectNode = FrameNode | SectionNode | PageNode;
export interface ProjectOptions {members?:readonly SceneNode[];projectName?:string}

// Only authored screens of the chosen panel enter the page-wide project.
// Scratch frames, labels and component libraries remain outside it.
export function pageScreens(page:PageNode,profile:Profile):FrameNode[] {
  const size=PROFILES[profile],screens:FrameNode[]=[];
  function visit(nodes:readonly SceneNode[]){for(const node of nodes){
    if(node.type==='SECTION'){visit(node.children);continue;}
    if(node.type!=='FRAME')continue;
    let kind:string|undefined;try{kind=JSON.parse(node.getPluginData(DATA_KEY)||'null')?.kind;}catch{ /* A named screen is still validated during recognition. */ }
    if(kind==='project'||/^(prj|project)_/i.test(node.name)){visit(node.children);continue;}
    if((kind==='page'||/^(scr|screen)_/i.test(node.name)||/^home$/i.test(node.name))&&node.width===size.width&&node.height===size.height)screens.push(node);
  }}
  visit(page.children);return screens;
}

// After the start page, GDL page order follows frame names, numbers compared by value, so
// screen_02-Audio comes before screen_10-Video regardless of selection order.
export function compareNames(a:string,b:string):number {
  const pa=a.toLowerCase().match(/\d+|\D+/g)??[],pb=b.toLowerCase().match(/\d+|\D+/g)??[];
  for(let i=0;i<Math.min(pa.length,pb.length);i++){
    const x=pa[i],y=pb[i];if(x===y)continue;
    if(/^\d/.test(x)&&/^\d/.test(y)){const nx=x.replace(/^0+(?=\d)/,''),ny=y.replace(/^0+(?=\d)/,'');if(nx.length!==ny.length)return nx.length-ny.length;if(nx!==ny)return nx<ny?-1:1;continue;}
    return x<y?-1:1;
  }
  return pa.length-pb.length||(a<b?-1:a>b?1:0);
}
export function byName<T extends {name:string}>(nodes:readonly T[]):T[] {return nodes.map((node,index)=>({node,index})).sort((a,b)=>compareNames(a.node.name,b.node.name)||a.index-b.index).map(e=>e.node);}

export function projectMembers(root:ProjectNode,read:(n:SceneNode)=>Metadata|null,options:ProjectOptions={}):{containers:SceneNode[];groups:SceneNode[]} {
  const containers:SceneNode[]=[],groups:SceneNode[]=[];
  for(const child of byName(options.members??root.children)){
    if(read(child)?.kind==='popup-group'){
      if(child.type!=='FRAME')fail('node-type','Группа popup должна быть Frame.');groups.push(child);
      for(const popup of byName(child.children)){if(read(popup)?.kind!=='popup')fail('placement','В группе popup допустимы только popup.');containers.push(popup);}
    }else containers.push(child);
  }
  return {containers,groups};
}

export function captureProject(root:SceneNode|PageNode,read:(n:SceneNode|PageNode)=>Metadata|null,single:(n:SceneNode,r:(n:SceneNode|PageNode)=>Metadata|null,p:boolean)=>Capture,signature:(n:SceneNode|PageNode)=>string,options:ProjectOptions={}):Capture {
  if(root.type!=='FRAME'&&root.type!=='SECTION'&&root.type!=='PAGE')fail('node-type','Выберите экраны, секцию или Frame проекта.');
  if(root.type==='PAGE'&&!options.members)fail('project-scope','Для проекта без секции укажите выбранные фреймы или экраны текущей страницы.');
  if(options.members?.some(n=>n.removed))fail('project-scope','Один из выбранных экранов удалён. Выделите экраны заново.');
  const pm=read(root);if(!pm||pm.kind!=='project')fail('kind','Нужно назначение проекта.');if(!pm.profile||!(pm.profile in PROFILES))fail('profile','Выберите профиль проекта.');
  const profile=pm.profile,canvas=PROFILES[profile];
  const referenceNodes=new Map<string,SceneNode>();
  const screen:ProjectScreen={schema:'exui-screen/5',project:{name:text(pm.projectName,'Имя проекта')},pages:[],popups:[],groups:[],assets:[]};
  const members=projectMembers(root,read,options),images:Capture['images']=[],assets=new Map<string,Asset>(),keys=new Set<string>(),names=new Set<string>(['offline page']),containerIds=new Set<number>(),controlIds=new Set<number>(),groupIds=new Set<number>();
  const reservedNames=new Set(members.containers.map(n=>n.name.toLowerCase()));
  // Without a saved choice the start page is still the first selected page, not the first by name.
  const firstPage=(options.members??root.children).find(n=>read(n)?.kind==='page');
  const addKey=(v:unknown)=>{const k=key(v,'Ключ проекта');if(keys.has(k))fail('duplicate-key',`Повтор ключа ${k}.`);keys.add(k);return k;};
  const groupNames=new Set<string>();
  for(const node of members.groups){const m=read(node)!;const groupId=integer(m.objectId,1,65535,'ID группы');if(groupIds.has(groupId))fail('duplicate-id','Повтор ID группы.');groupIds.add(groupId);const name=text(node.name,'Имя группы');if(groupNames.has(name.toLowerCase()))fail('duplicate-name','Повтор имени группы popup.');groupNames.add(name.toLowerCase());screen.groups.push({key:addKey(m.key),groupId,name});}
  for(const node of members.containers){
    if(node.type!=='FRAME')fail('node-type',`${node.name}: нужен Frame страницы/popup.`);
    const m=read(node);if(!m||m.kind!=='page'&&m.kind!=='popup')fail('placement',`${node.name}: в проекте допустимы экраны, popup и группы popup.`);
    if(m.profile&&m.profile!==profile)fail('profile',`${node.name}: сохранённый профиль отличается от профиля проекта.`);
    const parentGroup=node.parent?.type==='FRAME'?read(node.parent):null;
    const group=parentGroup?.kind==='popup-group'?parentGroup.key:m.group;
    if(m.modal&&group)fail('popup','Модальный popup не входит в группу.');
    const captured=single(node,n=>n.id===node.id?{...m,profile,projectName:pm.projectName}:read(n),true);
    if(!('page' in captured.screen))fail('structure','Вложенный проект не поддержан.');
    const page=captured.screen.page;
    addKey(page.key);if(containerIds.has(page.objectId))fail('duplicate-id','Страницы и popup должны иметь разные ID.');containerIds.add(page.objectId);
    if(names.has(page.name.toLowerCase())){const base=page.name;let index=2;do{page.name=base.slice(0,245)+` (${index++})`;}while(names.has(page.name.toLowerCase())||reservedNames.has(page.name.toLowerCase()));}names.add(page.name.toLowerCase());
    const c:Container={...page,shownBy:m.shownBy??(m.kind==='page'&&node===firstPage?'start':'program'),elements:captured.screen.elements};
    for(const e of c.elements){addKey(e.key);if(e.kind==='popup-ref'){const source=node.children.find(n=>read(n)?.key===e.key);if(source)referenceNodes.set(e.key,source);}if(e.controlId!==null){if(controlIds.has(e.controlId))fail('duplicate-id',`ID управления ${e.controlId} повторяется в проекте.`);controlIds.add(e.controlId);}}
    if(m.kind==='popup'){if(c.shownBy==='start')fail('popup','Popup не может быть стартовой страницей.');c.modal=m.modal??false;if(!c.modal)c.size=rect(node,node).slice(2);if(group)c.group=key(group,'Группа popup');screen.popups.push(c);}else screen.pages.push(c);
    for(const asset of captured.screen.assets){const previous=assets.get(asset.key);if(previous&&JSON.stringify(previous)!==JSON.stringify(asset))fail('image-conflict','Несовместимые объявления PNG.');if(!previous){addKey(asset.key);assets.set(asset.key,asset);}}
    images.push(...captured.images);
  }
  if(screen.pages.length<1||screen.pages.length>16||screen.popups.length>32||screen.groups.length>16)fail('project-size','Проект: 1..16 страниц, до 32 popup и 16 групп.');
  if(screen.pages.filter(p=>p.shownBy==='start').length!==1)fail('start-page','Нужна ровно одна стартовая страница.');
  // GUI Designer must list the start page first; keep natural name order for the rest.
  screen.pages=[...screen.pages.filter(p=>p.shownBy==='start'),...screen.pages.filter(p=>p.shownBy!=='start')];
  if([...screen.pages,...screen.popups].reduce((n,c)=>n+c.elements.length,0)>256)fail('project-size','До 256 элементов во всём проекте.');
  const all=[...screen.pages,...screen.popups],refs=screen.pages.flatMap(p=>p.elements.filter(e=>e.kind==='popup-ref'));
  for(const group of screen.groups){const popups=screen.popups.filter(p=>p.group===group.key);if(!popups.length||new Set(popups.map(p=>JSON.stringify(p.size))).size!==1)fail('popup-group','Участники группы popup должны иметь одинаковый размер.');}
  for(const p of screen.popups){if(p.group&&!screen.groups.some(g=>g.key===p.group))fail('popup-group',`Неизвестная группа ${p.group}.`);if(!p.modal&&!refs.some(r=>r.popup===p.key||!!p.group&&r.group===p.group))fail('popup-ref',`${p.name}: нужен popupref на странице.`);}
  for(const ref of refs){
    const source=referenceNodes.get(ref.key),targets=ref.popup?screen.popups.filter(p=>p.key===ref.popup):screen.popups.filter(p=>p.group===ref.group);
    if(!targets.length)fail('popup-ref',`${ref.name}: цель ${ref.popup??ref.group??'(без связи)'} не найдена в составе экспорта. Включите связанный popup или группу в проект либо сохраните связь заново.`,source);
    if(targets.some(p=>p.modal||!!ref.popup&&!!p.group))fail('popup-ref',`${ref.name}: выберите обычный popup вне группы либо всю группу popup. Модальный popup не подходит.`,source);
    const mismatch=targets.find(p=>p.size?.[0]!==ref.rect[2]||p.size?.[1]!==ref.rect[3]);
    if(mismatch)fail('popup-ref',`${ref.name}: размер места ${ref.rect[2]}×${ref.rect[3]}, а ${mismatch.name} — ${mismatch.size?.join('×')}. Размеры должны совпадать.`,source);
  }
  for(const c of all){for(const e of c.elements){if(e.navigate&&(!all.some(t=>t.key===e.navigate)||e.navigate===c.key))fail('navigation',`${e.name}: неизвестная или собственная цель перехода.`);}if(c.shownBy==='navigation'&&!all.some(p=>p.elements.some(e=>e.navigate===c.key)))fail('navigation',`${c.name}: нужна кнопка, ведущая к контейнеру.`);}
  const paths=[...assets.values()].map(a=>a.file),resourceNames=[...assets.values()].map(a=>a.resourceName.toLowerCase());if(new Set(paths).size!==paths.length||new Set(resourceNames).size!==resourceNames.length)fail('image-conflict','Разные PNG имеют одинаковый путь или resourceName.');
  screen.assets=[...assets.values()].sort((a,b)=>a.key.localeCompare(b.key,'en'));
  return {profile,screen,images,signature:signature(root)};
}
