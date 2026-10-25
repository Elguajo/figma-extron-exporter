import catalog from '../../../docs/design/extron-kit/kit.json' with {type:'json'};
import { PROFILES,fail,type Profile } from './model.ts';
import { KIT_KEY,KIT_VERSION,KIT_POPUP_GROUP_KEY } from './kit-contract.ts';
import {createKitExtensions} from './kit-patterns.ts';
import { DATETIME_FORMATS,FORMAT_PROPERTY,formatDateTime } from './datetime-format.ts';

type Parent=FrameNode|ComponentNode|SlotNode|PageNode;
type Spec=(typeof catalog.controls)[number];
const c=catalog.colors;
const g=catalog.geometry,t=catalog.typography;
function paint(hex:string):SolidPaint {return{type:'SOLID',color:{r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255}};}
function mark(node:BaseNode){node.setPluginData(KIT_KEY,KIT_VERSION);}
function frame(parent:Parent|undefined,name:string,w:number,h:number,fill?:string):FrameNode {
  const n=figma.createFrame();if(parent)parent.appendChild(n);n.name=name;n.resize(w,h);n.fills=fill?[paint(fill)]:[];n.strokes=[];n.clipsContent=true;return n;
}
function label(parent:Parent,name:string,copy:string,w:number,h:number,size=20,fill=c.ink,bold=false):TextNode {
  const n=figma.createText();parent.appendChild(n);n.name=name;n.fontName={family:t.family,style:bold?'Bold':'Regular'};n.fontSize=size;n.characters=copy;n.textAutoResize='NONE';n.resize(w,h);n.fills=[paint(fill)];n.textAlignHorizontal='LEFT';n.textAlignVertical='CENTER';return n;
}
function stretch(node:SceneNode){if('constraints'in node)node.constraints={horizontal:'STRETCH',vertical:'STRETCH'};}
function sizeButton(node:InstanceNode,w:number,h:number):void {
  node.resize(w,h);
  for(const state of node.children as FrameNode[]){
    state.resize(w,h);
    for(const part of state.children){
      if('resize'in part)part.resize(w,h);
      if('children'in part)for(const child of part.children){
        if(child.name==='Selection mark'){child.x=w-26;child.y=h/2-3;}
        else if('resize'in child)child.resize(w,h);
      }
    }
  }
}
function buttonLabel(node:InstanceNode,copy:string):void {
  for(const state of node.children as FrameNode[])for(const part of state.children)if('children'in part)for(const child of part.children)if(child.type==='TEXT'&&child.name==='Label')child.characters=copy;
}
function slot(component:ComponentNode,parent:Parent,w:number,h:number,propertyName:string):SlotNode {
  const n=component.createSlot();parent.appendChild(n);n.name='Icon';n.resize(w,h);n.x=0;n.y=0;n.fills=[];n.strokes=[];n.layoutMode='NONE';n.clipsContent=true;stretch(n);mark(n);
  // The installed typings expose createSlot but omit its documented reference key.
  const property=(n.componentPropertyReferences as {slotContentId?:string}|null)?.slotContentId;
  if(property)component.editComponentProperty(property,{name:propertyName,description:'Свободное оформление. Сохраните имя Icon и границы состояния.',slotSettings:{allowPreferredValuesOnly:false,displayEmptyByDefault:false}});
  return n;
}
function component(spec:Spec,parent:FrameNode):ComponentNode {
  const n=figma.createComponent();parent.appendChild(n);n.name=spec.name;n.fills=[];n.strokes=[];n.clipsContent=true;mark(n);
  const w=spec.type==='slider'?300:spec.type==='line'?300:220,h=spec.type==='line'?1:spec.type==='slider'?40:spec.type==='level'?20:spec.type==='text'?40:64;
  n.resize(w,h);n.description=`Extron Kit / ${catalog.revision}. Сохраняйте служебное имя. ${spec.states?'Состояния: '+spec.states.join(' / ')+'. Оформление меняйте в слоте Artwork.':spec.type==='graphic'?'Графику меняйте в слоте Artwork.':'Сохраняйте структуру нативного элемента.'} ID назначаются экземпляру при проверке или экспорте экрана.`;
  if(spec.states){
    spec.states.forEach((name,index)=>{
      const pressed=name==='Pressed'||index===2;
      const bg=index===0?c.control:spec.type==='multilevel'?(name==='state_Error'?c.danger:c.success):pressed?c.pressed:c.active,fg=index===0?c.ink:c.onAccent;
      const state=frame(n,name,w,h,bg);state.x=0;state.y=0;stretch(state);state.visible=index===0;mark(state);
      if(spec.type==='button')state.cornerRadius=g.controlRadius;
      const art=slot(n,state,w,h,'Artwork / '+name);
      const background=frame(art,'Background',w,h,bg);background.x=0;background.y=0;stretch(background);
      if(spec.type==='button')background.cornerRadius=g.controlRadius;
      if(spec.type==='button'){
        const copy=label(art,'Label',spec.label,w,h,t.body,fg,true);copy.textAlignHorizontal='CENTER';stretch(copy);
        if(name==='On'||name==='Active'){
          const dot=figma.createEllipse();art.appendChild(dot);dot.name='Selection mark';dot.resize(6,6);dot.x=w-26;dot.y=h/2-3;dot.fills=[paint(c.onAccent)];dot.strokes=[];dot.constraints={horizontal:'MAX',vertical:'CENTER'};
        }
      }
      const nativeLabel=label(state,'Text',spec.type==='button'?'':index===0?'Normal':name.replace(/^state_/,''),w,h,20,fg,true);nativeLabel.textAlignHorizontal='CENTER';stretch(nativeLabel);
    });
  }else if(spec.type==='slider'){
    const track=frame(n,'Track',w,g.trackHeight,c.track);track.y=(h-g.trackHeight)/2;track.cornerRadius=g.trackHeight/2;track.constraints={horizontal:'STRETCH',vertical:'CENTER'};
    const fill=frame(n,'Fill',126,g.trackHeight,c.accent);fill.y=track.y;fill.cornerRadius=g.trackHeight/2;fill.constraints={horizontal:'MIN',vertical:'CENTER'};
    const thumb=figma.createEllipse();n.appendChild(thumb);thumb.name='Thumb';thumb.resize(g.thumbSize,g.thumbSize);thumb.x=126-g.thumbSize/2;thumb.y=(h-g.thumbSize)/2;thumb.fills=[paint(c.accent)];thumb.strokes=[];thumb.constraints={horizontal:'MIN',vertical:'CENTER'};
  }else if(spec.type==='text'){
    const copy=label(n,'Content',spec.label,w,h,spec.name.startsWith('value_')?28:t.body);stretch(copy);copy.componentPropertyReferences={characters:n.addComponentProperty('Text','TEXT',spec.label)};
  }else if(spec.type==='graphic'){
    const art=slot(n,n,w,h,'Artwork');
    const bg=frame(art,'Background',w,h,c.control);bg.cornerRadius=g.controlRadius;stretch(bg);
    const copy=label(art,'Placeholder',spec.label,w,h,20,c.muted,true);copy.textAlignHorizontal='CENTER';stretch(copy);
  }else if(spec.type!=='popup-ref'){
    n.fills=[paint(spec.type==='level'?c.accent:spec.type==='line'?c.line:c.control)];
    if(spec.type==='shape'){n.cornerRadius=g.controlRadius;n.strokes=[paint(c.line)];n.strokeWeight=1;n.strokeAlign='INSIDE';}
  }
  return n;
}

// One Text per variant with the GUI Designer preview; the Format property the
// designer picks names the panel-side pattern.
const CLOCK={width:440,height:40,cell:96,column:500};
function dateTimeSet(spec:Spec,library:FrameNode,top:number):{set:ComponentSetNode;variants:ComponentNode[];height:number} {
  const variants=DATETIME_FORMATS.map(format=>{
    const n=figma.createComponent();library.appendChild(n);n.name=`${FORMAT_PROPERTY}=${format.name}`;n.fills=[];n.strokes=[];n.clipsContent=true;n.resize(CLOCK.width,CLOCK.height);mark(n);
    n.description=`Extron DateTime. Pattern: ${format.pattern}. Текст — пример GUI Designer; панель показывает текущее время.`;
    const copy=label(n,'Content',formatDateTime(format.pattern),CLOCK.width,CLOCK.height,20);stretch(copy);
    return n;
  });
  const set=figma.combineAsVariants(variants,library);set.name=spec.name;mark(set);set.fills=[paint(c.surface)];
  set.description='Extron DateTime (PBDateTime). Выберите Format в свойствах экземпляра. Свой формат: переименуйте Text-слой в «Pattern: …» или задайте его в плагине.';
  const rows=Math.ceil(variants.length/3);set.x=40;set.y=top;set.resize(3*CLOCK.column-20,rows*CLOCK.cell);
  DATETIME_FORMATS.forEach((format,index)=>{
    const x=(index%3)*CLOCK.column+20,y=Math.floor(index/3)*CLOCK.cell;
    variants[index].x=x;variants[index].y=y+44;
    const caption=label(library,'Pattern',`${format.pattern} · ${format.group}${format.guiDesigner?'':' · свой'}`,CLOCK.width,24,14,c.muted);caption.x=40+x;caption.y=top+y+14;
  });
  return {set,variants,height:rows*CLOCK.cell};
}

export interface KitResult {library:FrameNode;components:ComponentNode[];dateTime:ComponentSetNode;templates:FrameNode[];example:FrameNode;patterns:FrameNode[];patternProject:FrameNode;icons:ComponentNode[]}
export async function createKit(profile:Profile):Promise<KitResult> {
  if(!Object.prototype.hasOwnProperty.call(PROFILES,profile))fail('profile','Выберите профиль панели.');
  await figma.loadFontAsync({family:t.family,style:'Regular'});await figma.loadFontAsync({family:t.family,style:'Bold'});
  const previousSelection=[...figma.currentPage.selection],created:SceneNode[]=[];
  const right=Math.max(0,...figma.currentPage.children.map(n=>n.x+n.width)),origin=right+120;
  const components:ComponentNode[]=[],templates:FrameNode[]=[];
  try{
    const library=frame(undefined,'Extron Kit',1560,2820,c.canvas);created.push(library);library.x=origin;library.y=0;
    const header=label(library,'Title','Extron Kit / '+catalog.style,1440,60,t.title,c.ink,true);header.x=40;header.y=32;
    const guide=label(library,'Guide',`Ревизия ${catalog.revision}. Берите экземпляры из Assets; сохраняйте имена контейнеров и состояний.\nVolume +/− и навигация: Normal / Pressed. Выберите экран или проект и профиль → Скачать .exui.`,1440,80,18,c.muted);guide.x=40;guide.y=108;
    for(const [index,role]of (['canvas','surface','ink','muted','accent','pressed'] as const).entries()){
      const cell=frame(library,'Token / '+role,220,104,c.surface);cell.x=40+index*248;cell.y=216;cell.cornerRadius=g.controlRadius;
      const swatch=frame(cell,'Color',32,32,c[role]);swatch.x=16;swatch.y=16;swatch.cornerRadius=8;
      const name=label(cell,'Role',role,144,24,16,c.ink,true);name.x=60;name.y=20;
      const value=label(cell,'Value',c[role],188,24,t.caption,c.muted);value.x=16;value.y=64;
    }
    const swatches=library.children.filter(n=>n.name.startsWith('Token / '));
    const controlsStart=library.children.length,controlsTop=376;
    let top=376;
    for(const section of ['Universal','Presets']){
      const title=label(library,'Section',section==='Universal'?'01 / Универсальные компоненты':'02 / Готовые назначения',1440,48,28,c.ink,true);title.x=40;title.y=top;top+=72;
      const specs=catalog.controls.filter(s=>s.section===section&&s.type!=='datetime');
      specs.forEach((spec,index)=>{
        const cell=frame(library,'Guide / '+spec.name,480,184,c.surface);cell.x=40+(index%3)*500;cell.y=top+Math.floor(index/3)*208;cell.cornerRadius=g.surfaceRadius;
        const caption=label(cell,'Service name',spec.name,440,28,16,c.ink,true);caption.x=20;caption.y=16;
        const control=component(spec,cell);control.x=20;control.y=60;components.push(control);
        const info=label(cell,'Contract',spec.states?.join(' / ')??(spec.type==='slider'?'Track / Fill / Thumb':spec.type==='graphic'?'Artwork / собственная графика':'Нативный элемент Extron'),440,24,14,c.muted);info.x=20;info.y=144;
      });
      top+=Math.ceil(specs.length/3)*208+40;
    }
    const controlNodes=library.children.slice(controlsStart),statesStart=library.children.length,statesTop=top;
    const statesTitle=label(library,'Section','Состояния кнопок',1440,48,28,c.ink,true);statesTitle.x=40;statesTitle.y=top;top+=72;
    for(const [masterName,states]of [['button_Button',['Off','On']],['button_VolumeUp',['Normal','Pressed']],['feedbackbutton_Feedback',['Normal','Active','Pressed']]] as const){
      const master=components.find(n=>n.name===masterName)!;
      const heading=label(library,'State family',masterName,440,32,16,c.muted);heading.x=40;heading.y=top;
      for(const [index,stateName]of states.entries()){
        const instance=master.createInstance();library.appendChild(instance);instance.x=40+index*300;instance.y=top+48;
        for(const state of instance.children)state.visible=state.name===stateName;
        const caption=label(library,'State name',stateName,220,24,t.caption,c.muted);caption.x=instance.x;caption.y=top+120;
      }
      top+=176;
    }
    const stateNodes=library.children.slice(statesStart),clockStart=library.children.length,clockTop=top;
    const clockSpec=catalog.controls.find(s=>s.type==='datetime')!;
    const clockTitle=label(library,'Section','03 / Дата и время · '+clockSpec.name,1440,48,28,c.ink,true);clockTitle.x=40;clockTitle.y=top;top+=56;
    const clockGuide=label(library,'Guide','Перетащите datetime_Clock на экран и выберите Format в свойствах экземпляра. Текст — пример, как в GUI Designer; панель показывает текущие дату и время. Свой формат: назовите Text-слой «Pattern: dddd, d MMMM» или задайте формат в плагине.',1440,56,16,c.muted);clockGuide.x=40;clockGuide.y=top;top+=72;
    const clocks=dateTimeSet(clockSpec,library,top);components.push(...clocks.variants);top+=clocks.height+40;
    const clockNodes=library.children.slice(clockStart);
    const chapter=(parent:Parent,name:string,title:string,description:string,x:number,y:number,w:number,h:number)=>{
      const n=frame(parent,name,w,h,c.canvas);n.x=x;n.y=y;
      const heading=label(n,'Chapter title',title,w-96,72,56,c.ink,true);heading.x=48;heading.y=32;
      const intro=label(n,'Chapter guide',description,w-96,72,24,c.muted);intro.x=48;intro.y=112;
      return n;
    };
    const moveNodes=(nodes:SceneNode[],parent:FrameNode,from:number,to:number)=>{
      for(const node of nodes){const x=node.x,y=node.y;parent.appendChild(node);node.x=x;node.y=y-from+to;}
    };
    const contentHeight=(nodes:SceneNode[],from:number)=>Math.max(...nodes.map(n=>n.y+n.height))-from+272;
    const controlsHeight=contentHeight(controlNodes,controlsTop),clockHeight=contentHeight(clockNodes,clockTop);
    const cover=frame(library,'00 / Начало работы',5160,600,c.surface);cover.cornerRadius=g.surfaceRadius;
    cover.appendChild(header);header.x=48;header.y=32;header.resize(5064,100);header.fontSize=72;header.characters='Extron Kit';
    cover.appendChild(guide);guide.x=48;guide.y=160;guide.resize(5064,96);guide.fontSize=26;
    const summary=label(cover,'Library summary','Apple-inspired Light · 30 семейств · 28 форматов · 1280 × 800 / 320 × 480',5064,48,28,c.muted);summary.x=48;summary.y=288;
    for(const [index,copy]of ['01 / Основы и состояния','02 / Компоненты и AV-пресеты','03 / Дата и время','04 / Шаблоны Extron','05 / Готовые экраны'].entries()){
      const cell=frame(cover,'Contents / '+(index+1),992,112,c.control);cell.x=48+index*1008;cell.y=400;cell.cornerRadius=g.controlRadius;
      const text=label(cell,'Chapter',copy,944,64,24,c.ink,true);text.x=24;text.y=24;
    }
    const more=label(cover,'Extension contents','06 / Готовые AV-сценарии · 07 / Иконки и размеры — ниже основных шаблонов',5064,40,22,c.muted);more.x=48;more.y=536;
    const basics=chapter(library,'01 / Основы и состояния','01 / Основы','Цвет, типографика и состояния. С них начинается работа с китом.',0,840,1560,1760);
    for(const [index,node]of swatches.entries()){basics.appendChild(node);node.x=40+(index%3)*500;node.y=208+Math.floor(index/3)*128;}
    const typeCard=frame(basics,'Typography',1480,448,c.surface);typeCard.x=40;typeCard.y=520;typeCard.cornerRadius=g.surfaceRadius;
    const fontTitle=label(typeCard,'Typeface','Inter / Regular · Bold',1400,64,48,c.ink,true);fontTitle.x=32;fontTitle.y=24;
    for(const [index,size]of [36,28,20,14].entries()){
      const sample=label(typeCard,'Type sample / '+size,['Room control','42%','Music','September 28, 12:00 AM'][index],840,64,size,c.ink,index===0);sample.x=32;sample.y=112+index*72;
      const role=label(typeCard,'Type role / '+size,`${size} px`,400,64,20,c.muted);role.x=1000;role.y=sample.y;
    }
    moveNodes(stateNodes,basics,statesTop,1056);
    const controls=chapter(library,'02 / Компоненты и AV-пресеты','02 / Компоненты','Сначала базовый тип; готовые AV-пресеты — ниже.',1800,840,1560,controlsHeight);
    moveNodes(controlNodes,controls,controlsTop,208);
    const date=chapter(library,'03 / Дата и время','03 / Дата и время','Выберите Format в Figma. На панели показываются текущие дата и время.',3600,840,1560,clockHeight);
    moveNodes(clockNodes,date,clockTop,208);
    library.resize(5160,840+Math.max(basics.height,controls.height,date.height)+64);
    const size=PROFILES[profile];
    const makeTemplate=(name:string,w:number,h:number,x:number,y:number,fill=c.canvas)=>{const n=frame(undefined,name,w,h,fill);created.push(n);n.x=x;n.y=y;templates.push(n);return n;};
    const tx=origin+1680;
    const project=makeTemplate('project_Project',size.width+80,size.height+80,tx,0,c.track);
    const page=frame(project,'screen_Settings',size.width,size.height,c.canvas);page.x=40;page.y=40;
    const pageText=label(page,'text_Title','Settings',Math.min(440,size.width-48),40,28,c.ink,true);pageText.x=24;pageText.y=24;
    const popupRef=frame(page,'popupref_Popup',280,160);popupRef.x=20;popupRef.y=100;
    const groupRef=frame(page,'popupref_Zones',280,160);groupRef.x=20;groupRef.y=288;groupRef.setPluginData(KIT_POPUP_GROUP_KEY,'group.zones');
    const popup=frame(project,'popup_Popup',280,160,c.surface);popup.x=size.width+160;popup.y=0;
    const popupText=label(popup,'text_PopupTitle','Volume',232,32,20,c.ink,true);popupText.x=24;popupText.y=24;
    const popupValue=label(popup,'value_PopupVolume','42%',232,48,32);popupValue.x=24;popupValue.y=80;
    const modal=frame(project,'modalpopup_Confirm',size.width,size.height,c.canvas);modal.x=0;modal.y=size.height+160;
    const cardWidth=Math.min(448,size.width-48),cardX=(size.width-cardWidth)/2,cardY=(size.height-240)/2;
    const modalCard=frame(modal,'shape_ConfirmSurface',cardWidth,240,c.surface);modalCard.x=cardX;modalCard.y=cardY;modalCard.cornerRadius=g.surfaceRadius;
    const modalText=label(modal,'text_ConfirmTitle','Apply changes?',cardWidth-48,40,24,c.ink,true);modalText.x=cardX+24;modalText.y=cardY+24;
    const modalBody=label(modal,'text_ConfirmBody','Your room settings will be updated.',cardWidth-48,56,18,c.muted);modalBody.x=cardX+24;modalBody.y=cardY+72;
    for(const [index,copy]of ['Cancel','Confirm'].entries()){
      const button=components.find(n=>n.name==='button_Back')!.createInstance();modal.appendChild(button);button.name='button_'+copy;buttonLabel(button,copy);
      const width=(cardWidth-72)/2;sizeButton(button,width,56);button.x=cardX+24+index*(width+24);button.y=cardY+160;
      if(index===1){
        const normal=button.children[0] as FrameNode;normal.fills=[paint(c.accent)];
        const art=normal.children[0] as FrameNode;
        for(const part of art.children)if(part.name==='Background')(part as FrameNode).fills=[paint(c.accent)];else if(part.type==='TEXT')part.fills=[paint(c.onAccent)];
      }
    }
    const group=frame(project,'popupgroup_Zones',600,200);group.x=size.width+160;group.y=240;
    for(const [index,name]of ['Hall','Terrace'].entries()){
      const p=frame(group,'popup_'+name,280,160,c.surface);p.x=index*300;
      const t=label(p,'text_ZoneTitle',name,232,40,24,c.ink,true);t.x=24;t.y=24;
    }
    // The project wrapper is organizational; its bounds are deliberately separate from page geometry.
    project.resize(size.width+820,size.height*2+240);
    const example=makeTemplate('screen_Home',size.width,size.height,origin,top+120);
    const find=(name:string)=>components.find(n=>n.name===name)!;
    const add=(name:string,x:number,y:number)=>{const n=find(name).createInstance();example.appendChild(n);n.x=x;n.y=y;return n;};
    const addText=(name:string,copy:string,x:number,y:number,w:number,h:number,fontSize:number,fill=c.ink,bold=false)=>{
      const n=add(name.startsWith('value_')?'value_VolumeValue':'text_Label',x,y);n.name=name;n.resize(w,h);
      const text=n.children[0] as TextNode;text.resize(w,h);text.characters=copy;text.fontSize=fontSize;text.fontName={family:t.family,style:bold?'Bold':'Regular'};text.fills=[paint(fill)];return n;
    };
    const addButton=(name:string,x:number,y:number,w=220,h=64)=>{const n=add(name,x,y);sizeButton(n,w,h);return n;};
    const selectButton=(n:InstanceNode)=>{for(const state of n.children)state.visible=state.name==='Active';return n;};
    const addSlider=(x:number,y:number,w:number)=>{
      const n=add('slider_Volume',x,y);n.resize(w,40);
      const [track,fill,thumb]=n.children as FrameNode[];track.resize(w,g.trackHeight);fill.resize(Math.round(w*.42),g.trackHeight);thumb.x=fill.width-g.thumbSize/2;return n;
    };
    const surface=(name:string,x:number,y:number,w:number,h:number)=>{const n=frame(example,name,w,h,c.surface);n.x=x;n.y=y;n.cornerRadius=g.surfaceRadius;};
    if(profile==='tlp-pro-1025m'){
      surface('shape_SourceSurface',48,160,752,224);surface('shape_ZoneSurface',832,160,400,224);surface('shape_AudioSurface',48,416,1184,288);
      addText('text_Title','Hall / AV Control',48,32,640,56,36,c.ink,true);addText('text_Subtitle','Audio & video',48,88,440,32,20,c.muted);
      addText('text_SourceTitle','Source',80,184,440,32,20,c.ink,true);addText('text_ZoneTitle','Zone',864,184,300,32,20,c.ink,true);
      selectButton(addButton('feedbackbutton_Music',80,248));addButton('feedbackbutton_HDMI',316,248);addButton('feedbackbutton_Wireless',552,248);selectButton(addButton('feedbackbutton_Hall',864,248));
      addText('text_VolumeTitle','Volume',80,448,440,40,24,c.ink,true);
      const value=addText('value_VolumeValue','42%',1056,440,136,56,36);(value.children[0] as TextNode).textAlignHorizontal='RIGHT';
      addButton('feedbackbutton_Mute',80,556);addButton('button_VolumeDown',348,556,64);addSlider(440,568,660);addButton('button_VolumeUp',1128,556,64);
      addText('text_Footer','TRILLIANT / Room control',48,736,600,24,14,c.muted);
    }else{
      addText('text_Title','Room control',24,16,272,40,28,c.ink,true);
      addText('text_SourceTitle','Source',24,112,272,24,16,c.muted);selectButton(addButton('feedbackbutton_Music',24,144,272));
      addButton('feedbackbutton_Mute',24,224,272,56);
      addText('text_VolumeTitle','Volume',24,304,160,40,20,c.ink,true);
      const value=addText('value_VolumeValue','42%',200,304,96,40,28);(value.children[0] as TextNode).textAlignHorizontal='RIGHT';
      addButton('button_VolumeDown',24,364,56,56);addSlider(96,372,128);addButton('button_VolumeUp',240,364,56,56);
    }
    const clock=clocks.variants[0].createInstance();example.appendChild(clock);clock.name=clockSpec.name;
    const clockText=clock.children[0] as TextNode;clockText.fills=[paint(c.muted)];clockText.fontSize=18;
    if(profile==='tlp-pro-1025m'){clock.x=792;clock.y=40;clockText.textAlignHorizontal='RIGHT';}
    else{
      // Constraints stretch the Text in Figma; set it explicitly for hosts without layout.
      clock.resize(272,32);clockText.resize(272,32);clockText.fontSize=16;clock.x=24;clock.y=64;
    }
    const boardsY=library.y+library.height+240;
    const templatesBoard=chapter(figma.currentPage,'Extron Kit / 04 — Шаблоны','04 / Шаблоны Extron','Рабочие фреймы в натуральном размере. Для экспорта выбирайте сам project_ или screen_.',origin,boardsY,3360,project.height+272);created.push(templatesBoard);
    templatesBoard.appendChild(project);project.x=48;project.y=208;
    const examplesBoard=chapter(figma.currentPage,'Extron Kit / 05 — Готовые экраны','05 / Готовые экраны',`${size.title} / ${size.width} × ${size.height}. Собрано из экземпляров кита.`,origin+3600,boardsY,1560,size.height+272);created.push(examplesBoard);
    examplesBoard.appendChild(example);example.x=48;example.y=208;
    // No Extron IDs on masters: each placed instance receives its own IDs on recognition.
    figma.currentPage.selection=[example];figma.viewport.scrollAndZoomIntoView([example]);
    const extensions=createKitExtensions(profile,components,origin,boardsY+Math.max(templatesBoard.height,examplesBoard.height)+240,created,{frame,label,sizeButton,buttonLabel});
    return{library,components,dateTime:clocks.set,templates,example,...extensions};
  }catch(error){for(const node of created.reverse())if(!node.removed)node.remove();figma.currentPage.selection=previousSelection.filter(n=>!n.removed);throw error;}
}
