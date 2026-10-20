import { fail,integer,key,text,PROFILES,type Metadata,type Container,type ProjectScreen,type Asset } from './model.ts';
import type { Capture } from './export.ts';

export function projectMembers(root:FrameNode,read:(n:SceneNode)=>Metadata|null):{containers:SceneNode[];groups:SceneNode[]} {
  const containers:SceneNode[]=[],groups:SceneNode[]=[];
  for(const child of root.children){
    if(read(child)?.kind==='popup-group'){
      if(child.type!=='FRAME')fail('node-type','Группа popup должна быть Frame.');groups.push(child);
      for(const popup of child.children){if(read(popup)?.kind!=='popup')fail('placement','В группе popup допустимы только popup.');containers.push(popup);}
    }else containers.push(child);
  }
  return {containers,groups};
}

export function captureProject(root:SceneNode,read:(n:SceneNode)=>Metadata|null,single:(n:SceneNode,r:(n:SceneNode)=>Metadata|null,p:boolean)=>Capture,signature:(n:SceneNode)=>string):Capture {
  if(root.type!=='FRAME')fail('node-type','Проект должен быть внешним Frame project_Name.');
  const pm=read(root)!;if(!pm.profile||!(pm.profile in PROFILES))fail('profile','Выберите профиль проекта.');
  const profile=pm.profile,canvas=PROFILES[profile];
  const screen:ProjectScreen={schema:'exui-screen/5',project:{name:text(pm.projectName,'Имя проекта')},pages:[],popups:[],groups:[],assets:[]};
  const members=projectMembers(root,read),images:Capture['images']=[],assets=new Map<string,Asset>(),keys=new Set<string>(),names=new Set<string>(['offline page']),containerIds=new Set<number>(),controlIds=new Set<number>(),groupIds=new Set<number>();
  const addKey=(v:unknown)=>{const k=key(v,'Ключ проекта');if(keys.has(k))fail('duplicate-key',`Повтор ключа ${k}.`);keys.add(k);return k;};
  const groupNames=new Set<string>();
  for(const node of members.groups){const m=read(node)!;const groupId=integer(m.objectId,1,65535,'ID группы');if(groupIds.has(groupId))fail('duplicate-id','Повтор ID группы.');groupIds.add(groupId);const name=text(node.name,'Имя группы');if(groupNames.has(name.toLowerCase()))fail('duplicate-name','Повтор имени группы popup.');groupNames.add(name.toLowerCase());screen.groups.push({key:addKey(m.key),groupId,name});}
  for(const node of members.containers){
    if(node.type!=='FRAME')fail('node-type',`${node.name}: нужен Frame страницы/popup.`);
    const m=read(node);if(!m||!['page','popup'].includes(m.kind))fail('placement',`${node.name}: в проекте допустимы экраны, popup и группы popup.`);
    if(m.profile&&m.profile!==profile)fail('profile',`${node.name}: сохранённый профиль отличается от профиля проекта.`);
    const parentGroup=node.parent?.type==='FRAME'?read(node.parent):null;
    const group=parentGroup?.kind==='popup-group'?parentGroup.key:m.group;
    if(m.modal&&group)fail('popup','Модальный popup не входит в группу.');
    const captured=single(node,n=>n.id===node.id?{...m,profile,projectName:pm.projectName}:read(n),true);
    if(!('page' in captured.screen))fail('structure','Вложенный проект не поддержан.');
    const page=captured.screen.page;
    addKey(page.key);if(containerIds.has(page.objectId))fail('duplicate-id','Страницы и popup должны иметь разные ID.');containerIds.add(page.objectId);
    const normalizedName=page.name.toLowerCase();if(names.has(normalizedName))fail('duplicate-name','Имена страниц и popup должны различаться.');names.add(normalizedName);
    const c:Container={...page,shownBy:m.shownBy??(m.kind==='page'&&screen.pages.length===0?'start':'program'),elements:captured.screen.elements};
    for(const e of c.elements){addKey(e.key);if(e.controlId!==null){if(controlIds.has(e.controlId))fail('duplicate-id',`ID управления ${e.controlId} повторяется в проекте.`);controlIds.add(e.controlId);}}
    if(m.kind==='popup'){if(c.shownBy==='start')fail('popup','Popup не может быть стартовой страницей.');c.modal=m.modal??false;if(!c.modal)c.size=[node.width,node.height];if(group)c.group=key(group,'Группа popup');screen.popups.push(c);}else screen.pages.push(c);
    for(const asset of captured.screen.assets){const previous=assets.get(asset.key);if(previous&&JSON.stringify(previous)!==JSON.stringify(asset))fail('image-conflict','Несовместимые объявления PNG.');if(!previous){addKey(asset.key);assets.set(asset.key,asset);}}
    images.push(...captured.images);
  }
  if(screen.pages.length<1||screen.pages.length>16||screen.popups.length>32||screen.groups.length>16)fail('project-size','Проект: 1..16 страниц, до 32 popup и 16 групп.');
  if(screen.pages.filter(p=>p.shownBy==='start').length!==1)fail('start-page','Нужна ровно одна стартовая страница.');
  if([...screen.pages,...screen.popups].reduce((n,c)=>n+c.elements.length,0)>256)fail('project-size','До 256 элементов во всём проекте.');
  const all=[...screen.pages,...screen.popups],refs=screen.pages.flatMap(p=>p.elements.filter(e=>e.kind==='popup-ref'));
  for(const group of screen.groups){const popups=screen.popups.filter(p=>p.group===group.key);if(!popups.length||new Set(popups.map(p=>JSON.stringify(p.size))).size!==1)fail('popup-group','Участники группы popup должны иметь одинаковый размер.');}
  for(const p of screen.popups){if(p.group&&!screen.groups.some(g=>g.key===p.group))fail('popup-group',`Неизвестная группа ${p.group}.`);if(!p.modal&&!refs.some(r=>r.popup===p.key||!!p.group&&r.group===p.group))fail('popup-ref',`${p.name}: нужен popupref на странице.`);}
  for(const ref of refs){const targets=ref.popup?screen.popups.filter(p=>p.key===ref.popup):screen.popups.filter(p=>p.group===ref.group);if(!targets.length||targets.some(p=>p.modal||!!ref.popup&&!!p.group||p.size?.[0]!==ref.rect[2]||p.size?.[1]!==ref.rect[3]))fail('popup-ref',`${ref.name}: цель должна быть обычным popup/группой того же размера.`);}
  for(const c of all){for(const e of c.elements){if(e.navigate&&(!all.some(t=>t.key===e.navigate)||e.navigate===c.key))fail('navigation',`${e.name}: неизвестная или собственная цель перехода.`);}if(c.shownBy==='navigation'&&!all.some(p=>p.elements.some(e=>e.navigate===c.key)))fail('navigation',`${c.name}: нужна кнопка, ведущая к контейнеру.`);}
  if(assets.size>16)fail('images','До 16 PNG на весь проект.');
  const paths=[...assets.values()].map(a=>a.file),resourceNames=[...assets.values()].map(a=>a.resourceName.toLowerCase());if(new Set(paths).size!==paths.length||new Set(resourceNames).size!==resourceNames.length)fail('image-conflict','Разные PNG имеют одинаковый путь или resourceName.');
  screen.assets=[...assets.values()].sort((a,b)=>a.key.localeCompare(b.key,'en'));
  return {profile,screen,images,signature:signature(root)};
}
