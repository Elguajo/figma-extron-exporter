import catalog from '../../../design/extron-kit/kit.json' with {type:'json'};
import { PROFILES,fail,type Profile } from './model.ts';
import { KIT_KEY,KIT_VERSION,KIT_POPUP_GROUP_KEY } from './kit-contract.ts';
import { DATETIME_FORMATS,FORMAT_PROPERTY,formatDateTime } from './datetime-format.ts';

type Parent=FrameNode|ComponentNode|SlotNode;
type Spec=(typeof catalog.controls)[number];
const c=catalog.colors;
function paint(hex:string):SolidPaint {return{type:'SOLID',color:{r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255}};}
function mark(node:BaseNode){node.setPluginData(KIT_KEY,KIT_VERSION);}
function frame(parent:Parent|undefined,name:string,w:number,h:number,fill?:string):FrameNode {
  const n=figma.createFrame();if(parent)parent.appendChild(n);n.name=name;n.resize(w,h);n.fills=fill?[paint(fill)]:[];n.strokes=[];n.clipsContent=true;return n;
}
function label(parent:Parent,name:string,copy:string,w:number,h:number,size=20,fill=c.ink,bold=false):TextNode {
  const n=figma.createText();parent.appendChild(n);n.name=name;n.fontName={family:'Arial',style:bold?'Bold':'Regular'};n.fontSize=size;n.characters=copy;n.textAutoResize='NONE';n.resize(w,h);n.fills=[paint(fill)];n.textAlignHorizontal='LEFT';n.textAlignVertical='CENTER';return n;
}
function stretch(node:SceneNode){if('constraints'in node)node.constraints={horizontal:'STRETCH',vertical:'STRETCH'};}
function slot(component:ComponentNode,parent:Parent,w:number,h:number,propertyName:string):SlotNode {
  const n=component.createSlot();parent.appendChild(n);n.name='Icon';n.resize(w,h);n.x=0;n.y=0;n.fills=[];n.strokes=[];n.layoutMode='NONE';n.clipsContent=true;stretch(n);mark(n);
  // The installed typings expose createSlot but omit its documented reference key.
  const property=(n.componentPropertyReferences as {slotContentId?:string}|null)?.slotContentId;
  if(property)component.editComponentProperty(property,{name:propertyName,description:'Свободное оформление. Сохраните имя Icon и границы состояния.',slotSettings:{allowPreferredValuesOnly:false,displayEmptyByDefault:false}});
  return n;
}
function component(spec:Spec,parent:FrameNode):ComponentNode {
  const n=figma.createComponent();parent.appendChild(n);n.name=spec.name;n.fills=[];n.strokes=[];n.clipsContent=true;mark(n);
  const w=spec.type==='slider'?300:spec.type==='line'?300:220,h=spec.type==='line'?2:spec.type==='slider'?40:spec.type==='level'?20:spec.type==='text'?40:64;
  n.resize(w,h);n.description=`Extron Kit / ${catalog.revision}. Сохраняйте служебное имя. ${spec.states?'Состояния: '+spec.states.join(' / ')+'. Оформление меняйте в слоте Artwork.':spec.type==='graphic'?'Графику меняйте в слоте Artwork.':'Сохраняйте структуру нативного элемента.'} ID назначаются экземпляру при проверке или экспорте экрана.`;
  if(spec.states){
    spec.states.forEach((name,index)=>{
      const pressed=name==='Pressed'||index===2;
      const bg=index===0?c.track:pressed?c.pressed:c.active,fg=pressed?'#FFFFFF':c.ink;
      const state=frame(n,name,w,h,bg);state.x=0;state.y=0;stretch(state);state.visible=index===0;mark(state);
      const art=slot(n,state,w,h,'Artwork / '+name);
      const background=frame(art,'Background',w,h,bg);background.x=0;background.y=0;stretch(background);
      if(spec.type==='button'){
        const copy=label(art,'Label',spec.label,w,h,20,fg,true);copy.textAlignHorizontal='CENTER';stretch(copy);
      }
      const nativeLabel=label(state,'Text',spec.type==='button'?'':index===0?'Normal':name.replace(/^state_/,''),w,h,20,fg,true);nativeLabel.textAlignHorizontal='CENTER';stretch(nativeLabel);
    });
  }else if(spec.type==='slider'){
    const track=frame(n,'Track',w,16,c.track);track.y=12;track.cornerRadius=8;track.constraints={horizontal:'STRETCH',vertical:'CENTER'};
    const fill=frame(n,'Fill',126,16,c.accent);fill.y=12;fill.cornerRadius=8;fill.constraints={horizontal:'MIN',vertical:'CENTER'};
    const thumb=figma.createEllipse();n.appendChild(thumb);thumb.name='Thumb';thumb.resize(28,28);thumb.x=112;thumb.y=6;thumb.fills=[paint(c.ink)];thumb.strokes=[];thumb.constraints={horizontal:'MIN',vertical:'CENTER'};
  }else if(spec.type==='text'){
    const copy=label(n,'Content',spec.label,w,h,24);stretch(copy);copy.componentPropertyReferences={characters:n.addComponentProperty('Text','TEXT',spec.label)};
  }else if(spec.type==='graphic'){
    const art=slot(n,n,w,h,'Artwork');
    const bg=frame(art,'Background',w,h,c.track);stretch(bg);
    const copy=label(art,'Placeholder',spec.label,w,h,20,c.muted,true);copy.textAlignHorizontal='CENTER';stretch(copy);
  }else if(spec.type!=='popup-ref')n.fills=[paint(spec.type==='level'?c.accent:c.track)];
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

export interface KitResult {library:FrameNode;components:ComponentNode[];dateTime:ComponentSetNode;templates:FrameNode[];example:FrameNode}
export async function createKit(profile:Profile):Promise<KitResult> {
  if(!Object.prototype.hasOwnProperty.call(PROFILES,profile))fail('profile','Выберите профиль панели.');
  await figma.loadFontAsync({family:'Arial',style:'Regular'});await figma.loadFontAsync({family:'Arial',style:'Bold'});
  const previousSelection=[...figma.currentPage.selection],created:SceneNode[]=[];
  const right=Math.max(0,...figma.currentPage.children.map(n=>n.x+n.width)),origin=right+120;
  const components:ComponentNode[]=[],templates:FrameNode[]=[];
  try{
    const library=frame(undefined,'Extron Kit',1560,2820,c.canvas);created.push(library);library.x=origin;library.y=0;
    const header=label(library,'Title','Extron Kit / Библиотека компонентов',1440,60,36,c.ink,true);header.x=40;header.y=32;
    const guide=label(library,'Guide',`Ревизия ${catalog.revision}. Берите экземпляры из Assets; сохраняйте имена контейнеров и состояний.\nVolume +/− и навигация: Normal / Pressed. Выберите экран или проект и профиль → Скачать .exui.`,1440,80,20,c.muted);guide.x=40;guide.y=108;
    let top=230;
    for(const section of ['Universal','Presets']){
      const title=label(library,'Section',section==='Universal'?'01 / Универсальные компоненты':'02 / Готовые назначения',1440,48,28,c.ink,true);title.x=40;title.y=top;top+=72;
      const specs=catalog.controls.filter(s=>s.section===section&&s.type!=='datetime');
      specs.forEach((spec,index)=>{
        const cell=frame(library,'Guide / '+spec.name,480,184,c.surface);cell.x=40+(index%3)*500;cell.y=top+Math.floor(index/3)*208;cell.cornerRadius=10;
        const caption=label(cell,'Service name',spec.name,440,28,16,c.ink,true);caption.x=20;caption.y=16;
        const control=component(spec,cell);control.x=20;control.y=60;components.push(control);
        const info=label(cell,'Contract',spec.states?.join(' / ')??(spec.type==='slider'?'Track / Fill / Thumb':spec.type==='graphic'?'Artwork / собственная графика':'Нативный элемент Extron'),440,24,14,c.muted);info.x=20;info.y=144;
      });
      top+=Math.ceil(specs.length/3)*208+40;
    }
    const clockSpec=catalog.controls.find(s=>s.type==='datetime')!;
    const clockTitle=label(library,'Section','03 / Дата и время · '+clockSpec.name,1440,48,28,c.ink,true);clockTitle.x=40;clockTitle.y=top;top+=56;
    const clockGuide=label(library,'Guide','Перетащите datetime_Clock на экран и выберите Format в свойствах экземпляра. Текст — пример, как в GUI Designer; панель показывает текущие дату и время. Свой формат: назовите Text-слой «Pattern: dddd, d MMMM» или задайте формат в плагине.',1440,56,16,c.muted);clockGuide.x=40;clockGuide.y=top;top+=72;
    const clocks=dateTimeSet(clockSpec,library,top);components.push(...clocks.variants);top+=clocks.height+40;
    library.resize(1560,top);
    const size=PROFILES[profile];
    const makeTemplate=(name:string,w:number,h:number,x:number,y:number,fill=c.canvas)=>{const n=frame(undefined,name,w,h,fill);created.push(n);n.x=x;n.y=y;templates.push(n);return n;};
    const tx=origin+1680;
    const project=makeTemplate('project_Project',size.width+80,size.height+80,tx,0,c.track);
    const page=frame(project,'screen_Settings',size.width,size.height,c.canvas);page.x=40;page.y=40;
    const pageText=label(page,'text_Title','Settings',Math.min(220,size.width),40,24);pageText.x=24;pageText.y=24;
    const popupRef=frame(page,'popupref_Popup',280,160);popupRef.x=20;popupRef.y=100;
    const groupRef=frame(page,'popupref_Zones',280,160);groupRef.x=20;groupRef.y=288;groupRef.setPluginData(KIT_POPUP_GROUP_KEY,'group.zones');
    const popup=frame(project,'popup_Popup',280,160,c.surface);popup.x=size.width+160;popup.y=0;
    const popupText=label(popup,'text_PopupTitle','Popup',232,40);popupText.x=24;popupText.y=24;
    const modal=frame(project,'modalpopup_Confirm',size.width,size.height,c.canvas);modal.x=0;modal.y=size.height+160;
    const modalText=label(modal,'text_ConfirmTitle','Confirm',232,40);modalText.x=24;modalText.y=24;
    const group=frame(project,'popupgroup_Zones',600,200);group.x=size.width+160;group.y=240;
    for(const [index,name]of ['Hall','Terrace'].entries()){
      const p=frame(group,'popup_'+name,280,160,c.surface);p.x=index*300;
      const t=label(p,'text_ZoneTitle',name,232,40);t.x=24;t.y=24;
    }
    // The project wrapper is organizational; its bounds are deliberately separate from page geometry.
    project.resize(size.width+820,size.height*2+240);
    const example=makeTemplate('screen_Home',size.width,size.height,origin,top+120);
    const find=(name:string)=>components.find(n=>n.name===name)!;
    const add=(name:string,x:number,y:number)=>{const n=find(name).createInstance();example.appendChild(n);n.x=x;n.y=y;return n;};
    const title=add('text_Label',profile==='tlp-pro-1025m'?48:32,24);title.name='text_Title';title.setProperties({[Object.keys(find('text_Label').componentPropertyDefinitions)[0]]:profile==='tlp-pro-1025m'?'Hall / AV Control':'Room control'});
    if(profile==='tlp-pro-1025m'){
      add('logo_Logo',1012,32).name='logo_Company';add('feedbackbutton_Hall',48,164);add('feedbackbutton_Music',304,164);add('feedbackbutton_Mute',560,164);
      add('button_VolumeDown',48,424);add('slider_Volume',304,436);add('button_VolumeUp',652,424);add('value_VolumeValue',304,376);
    }else{add('feedbackbutton_Music',50,112);add('feedbackbutton_Mute',50,200);add('slider_Volume',10,316);add('value_VolumeValue',50,372);}
    const clock=clocks.variants[0].createInstance();example.appendChild(clock);clock.name=clockSpec.name;
    if(profile==='tlp-pro-1025m'){clock.x=520;clock.y=36;}
    else{
      // Constraints stretch the Text in Figma; set it explicitly for hosts without layout.
      clock.resize(256,32);const copy=clock.children[0] as TextNode;copy.resize(256,32);clock.x=32;clock.y=68;
    }
    // No Extron IDs on masters: each placed instance receives its own IDs on recognition.
    figma.currentPage.selection=[example];figma.viewport.scrollAndZoomIntoView([example]);
    return{library,components,dateTime:clocks.set,templates,example};
  }catch(error){for(const node of created.reverse())if(!node.removed)node.remove();figma.currentPage.selection=previousSelection.filter(n=>!n.removed);throw error;}
}
