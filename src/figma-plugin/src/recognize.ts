import { DATA_KEY, PROFILES, ROLE_ID, fail, integer, key, readMetadata, text, type Kind, type Metadata, type Profile, type Role } from './model.ts';
import { capture, designSignature } from './export.ts';

export const REGISTRY_KEY='exui-id-registry';
interface Registry { schema:'exui-id-registry/1'; ownerNodeId:string; nextObjectId:number; nextControlId:number }
export interface RecognitionRow { id:string; name:string; kind:Kind; key?:string; objectId?:number; controlId?:number|null; isNew:boolean }
export interface RecognitionPlan {
  root:FrameNode; profile:Profile; signature:string; registry:string;
  writes:{node:SceneNode; metadata:Metadata}[]; rows:RecognitionRow[]; errors:string[]; warnings:string[];
}
const TYPES:Record<string,Kind>={btn:'button',button:'button',lvl:'level',level:'level',txt:'label',text:'label',logo:'graphic',img:'graphic',image:'graphic'};
export function namedControl(name:string):{kind:Kind; suffix:string}|null {
  const match=/^(btn|button|lvl|level|txt|text|logo|img|image)_(.+)$/i.exec(name);
  return match?{kind:TYPES[match[1].toLowerCase()],suffix:slug(match[2])}:null;
}
function slug(value:string):string {
  if(!/^[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*$/.test(value))fail('name',`${value}: используйте латинские буквы, цифры и дефисы без пробелов, например VolumeDown.`);
  return key(value.toLowerCase(),'Имя слоя');
}
export function namedRole(name:string):Role|null {
  const value=name.replace(/^(st|state)_/i,'').toLowerCase();
  return ({off:'normal',normal:'normal',on:'feedback',feedback:'feedback',pressed:'pressed'} as Record<string,Role>)[value]??null;
}
function signature(root:FrameNode):string {return designSignature(root)+'\n'+root.getPluginData(REGISTRY_KEY);}

/** Dry run: proposed metadata is read by the same validator as the real export. */
export function recognize(root:SceneNode,profile:Profile):RecognitionPlan {
  if(root.type!=='FRAME')fail('selection','Выберите внешний Frame экрана, например Home.');
  if(!Object.prototype.hasOwnProperty.call(PROFILES,profile))fail('profile','Выберите профиль панели.');
  let parent=root.parent;
  while(parent&&parent.type!=='PAGE') {
    if(readMetadata(parent)?.kind==='page')fail('placement','Для распознавания выберите внешний Frame экрана.');
    parent=parent.parent;
  }
  if(root.children.length<1||root.children.length>64)fail('elements','На экране должно быть 1..64 элемента.');
  const existingRoot=readMetadata(root);
  if(existingRoot&&existingRoot.kind!=='page')fail('placement','Выбран элемент с другим назначением. Выберите внешний Frame экрана.');
  if(existingRoot&&existingRoot.profile!==profile)fail('profile','Выбранный профиль отличается от сохранённого профиля экрана.');
  const canvas=PROFILES[profile];
  if(root.width!==canvas.width||root.height!==canvas.height)fail('profile',`Для этого профиля нужен Frame ${canvas.width}×${canvas.height}.`);
  const namespace=existingRoot?key(existingRoot.key,'Ключ экрана').replace(/^page\./,''):slug(root.name.replace(/^(scr|screen)_/i,''));
  let registry:Registry={schema:'exui-id-registry/1',ownerNodeId:root.id,nextObjectId:1,nextControlId:8101};
  const raw=root.getPluginData(REGISTRY_KEY);
  if(raw) {
    try {registry=JSON.parse(raw);}catch{fail('registry','Повреждён реестр ID экрана. Распознавание остановлено.');}
    if(!registry||registry.schema!=='exui-id-registry/1'||registry.ownerNodeId!==root.id)fail('registry','Неизвестный или скопированный реестр ID экрана.');
    integer(registry.nextObjectId,1,1000001,'Следующий ID объекта');integer(registry.nextControlId,1,65536,'Следующий ID управления');
  }
  // Import active legacy IDs before allocating. Saved counters also reserve deleted auto IDs.
  for(const child of root.children) {
    const m=readMetadata(child);
    if(m&&['button','label','level','graphic'].includes(m.kind)) {
      registry.nextObjectId=Math.max(registry.nextObjectId,integer(m.objectId,1,1000000,child.name+'.objectId')+1);
      if(m.kind==='button'||m.kind==='level')registry.nextControlId=Math.max(registry.nextControlId,integer(m.controlId,1,65535,child.name+'.controlId')+1);
    }
  }
  const plan:RecognitionPlan={root,profile,signature:signature(root),registry:'',writes:[],rows:[],errors:[],warnings:[]};
  const proposed=new Map<string,Metadata>();
  const namedSuffixes=new Set<string>();
  function assign(node:SceneNode,value:Omit<Metadata,'schema'|'ownerNodeId'>):Metadata {
    const existing=readMetadata(node);
    const metadata=existing??{schema:'exui-node/1',ownerNodeId:node.id,...value};
    if(metadata.kind!==value.kind)fail('kind',`${node.name}: сохранённое назначение ${metadata.kind} не соответствует ${value.kind}.`);
    if(!existing){proposed.set(node.id,metadata);plan.writes.push({node,metadata});}
    plan.rows.push({id:node.id,name:node.name,kind:metadata.kind,key:metadata.key,objectId:metadata.objectId,controlId:metadata.controlId,isNew:!existing});
    return metadata;
  }
  assign(root,existingRoot??{kind:'page',key:key('page.'+namespace,'Ключ экрана'),objectId:100,profile,projectName:text(root.name,'Имя проекта')});
  for(const node of root.children) {
    try {
      const existing=readMetadata(node);
      let named:ReturnType<typeof namedControl>=null;
      try{named=namedControl(node.name);}catch(e){if(!existing)throw e;}
      if(named){if(namedSuffixes.has(named.suffix))fail('duplicate-name',`${node.name}: повтор имени ${named.suffix}; регистр и короткий/полный префикс не различают элементы.`);namedSuffixes.add(named.suffix);}
      if(!existing&&!named)fail('name',`${node.name}: нужен префикс btn_/button_, lvl_/level_, txt_/text_, logo_ или img_/image_.`);
      const kind=existing?.kind??named!.kind;
      if(!['button','level','label','graphic'].includes(kind))fail('placement',`${node.name}: на экране допустимы кнопки, Level, подписи и изображения.`);
      if(kind==='label'?node.type!=='TEXT':node.type!=='FRAME')fail('node-type',`${node.name}: ${kind==='label'?'нужен Text':'нужен Frame'}.`);
      let value:Omit<Metadata,'schema'|'ownerNodeId'>;
      if(existing) {
        value=existing;
        if(!plan.warnings.length)plan.warnings.push('Для уже назначенных элементов сохранённые типы, ключи и ID имеют приоритет над именами слоёв.');
      }else {
        value={kind,key:key(namespace+'.'+named!.suffix,node.name),objectId:integer(registry.nextObjectId++,1,1000000,'ID объекта'),controlId:kind==='label'||kind==='graphic'?null:integer(registry.nextControlId++,1,65535,'ID управления')};
        if(kind==='graphic'){value.file=`assets/graphic-${value.objectId}.png`;value.resourceName=`exui-graphic-${value.objectId}.png`;}
      }
      const control=assign(node,value);
      if(kind!=='button')continue;
      const button=node as FrameNode;
      if(![2,3].includes(button.children.length))fail('states',`${node.name}: нужны два Frame Off/On или три Normal/Feedback/Pressed.`);
      for(const state of button.children) {
        if(state.type!=='FRAME')fail('node-type',`${state.name}: состояние должно быть Frame.`);
        if(state.children.length<1||state.children.length>2||state.children.filter(n=>n.type==='TEXT').length!==1)fail('states',`${state.name}: нужен один Text и не более одной Frame-иконки.`);
        const sm=readMetadata(state),role=sm?.role??namedRole(state.name);
        if(!role)fail('states',`${state.name}: назовите состояние Off, On, Normal, Feedback или Pressed.`);
        assign(state,{kind:'state',role,stateId:ROLE_ID[role],stateName:state.name});
        for(const icon of state.children.filter(n=>n.type!=='TEXT')) {
          const im=readMetadata(icon);
          if(!im&&!/^(Icon|(ico|icon)_[A-Za-z][A-Za-z0-9-]*)$/i.test(icon.name))fail('name',`${icon.name}: назовите Frame иконки Icon, ico_Music или icon_Music.`);
          if(icon.type!=='FRAME')fail('node-type',`${icon.name}: для иконки нужен Frame.`);
          const file=`control-${control.objectId}-${role}.png`;
          assign(icon,{kind:'image',key:key(`icon.${control.key}.${role}`,'Ключ иконки'),file:'assets/'+file,resourceName:'exui-'+file});
        }
      }
    }catch(e){plan.errors.push(e instanceof Error?e.message:String(e));}
  }
  if(!plan.errors.length) {
    try{capture(root,node=>proposed.get(node.id)??readMetadata(node));}
    catch(e){plan.errors.push(e instanceof Error?e.message:String(e));}
  }
  plan.registry=JSON.stringify(registry);
  return plan;
}

/** Commit only the reviewed, unchanged plan. Restore original values on a failed write. */
export function applyRecognition(plan:RecognitionPlan):void {
  if(plan.errors.length)fail('recognition','Сначала исправьте ошибки распознавания.');
  if(plan.root.removed||signature(plan.root)!==plan.signature)fail('design-changed','Макет изменился после распознавания. Нажмите «Распознать по именам» ещё раз.');
  const originals=plan.writes.map(({node})=>({node,raw:node.getPluginData(DATA_KEY)}));
  const oldRegistry=plan.root.getPluginData(REGISTRY_KEY);
  try {
    // Reserve numbers first; an interrupted commit may leave gaps, never reused IDs.
    plan.root.setPluginData(REGISTRY_KEY,plan.registry);
    for(const {node,metadata} of plan.writes)node.setPluginData(DATA_KEY,JSON.stringify(metadata));
    capture(plan.root);
  }catch(e){
    const errors:string[]=[];
    for(const {node,raw} of originals){try{node.setPluginData(DATA_KEY,raw);}catch{errors.push(node.name);}}
    // If any restoration failed, retain the reservation for all proposed IDs.
    if(!errors.length){try{plan.root.setPluginData(REGISTRY_KEY,oldRegistry);}catch{errors.push(plan.root.name);}}
    if(errors.length)fail('recognition-rollback',`Не удалось полностью восстановить назначения: ${errors.join(', ')}. Проверьте их вручную и повторите распознавание. Резерв ID сохранён, если запись реестра была выполнена.`);
    throw e;
  }
}
