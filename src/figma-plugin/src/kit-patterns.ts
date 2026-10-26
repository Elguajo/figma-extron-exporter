import catalog from '../../../docs/design/extron-kit/kit.json' with {type:'json'};
import registry from '../../../docs/design/extron-kit/patterns.json' with {type:'json'};
import content from '../../../docs/design/extron-kit/content.json' with {type:'json'};
import symbols from '../../../docs/design/extron-kit/icons/icons.json' with {type:'json'};
import {PROFILES,type Profile} from './model.ts';
import {KIT_KEY,KIT_VERSION} from './kit-contract.ts';

interface Element {
  kind:string;name:string;bounds:number[];text?:string;fontSize?:number;color?:string;align?:string;bold?:boolean;
  label?:string;master?:string;icon?:string;tone?:string;selected?:boolean|number;labels?:string[];value?:number;
}
interface Pattern {id:string;title:string;container:string;layouts:Record<string,Element[]>}
interface Tools {
  frame:(parent:FrameNode|undefined,name:string,w:number,h:number,fill?:string)=>FrameNode;
  label:(parent:FrameNode,name:string,copy:string,w:number,h:number,size?:number,fill?:string,bold?:boolean)=>TextNode;
  sizeButton:(node:InstanceNode,w:number,h:number)=>void;
  sizeSlider:(node:InstanceNode,w:number,h:number,value?:number)=>FrameNode;
  buttonLabel:(node:InstanceNode,copy:string)=>void;
}
const c=catalog.colors,g=catalog.geometry;
const paint=(hex:string):SolidPaint=>({type:'SOLID',color:{r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255}});
const color=(role:string|undefined)=>c[(role??'ink') as keyof typeof c]??c.ink;
function symbol(name:string,fill:string,size:number):FrameNode {
  const source=symbols.icons.find(i=>i.name===name);if(!source)throw new Error('Unknown kit icon: '+name);
  const svg=source.svg.replace(/currentColor/g,fill).replace(/width="24"/,'width="'+size+'"').replace(/height="24"/,'height="'+size+'"');
  const node=figma.createNodeFromSvg(svg);node.name='Symbol / '+name;node.x=0;node.y=0;return node;
}

export function createKitExtensions(profile:Profile,masters:ComponentNode[],origin:number,y:number,created:SceneNode[],tools:Tools){
  const {frame,label,sizeButton,sizeSlider,buttonLabel}=tools;
  function board(name:string,title:string,subtitle:string,x:number,top:number,w:number,h:number){
    const root=frame(undefined,name,w,h,c.canvas);created.push(root);root.x=x;root.y=top;
    const heading=label(root,'Title',title,w-96,64,40,c.ink,true);heading.x=48;heading.y=32;
    const intro=label(root,'Guide',subtitle,w-96,64,20,c.muted);intro.x=48;intro.y=112;return root;
  }
  const size=PROFILES[profile],columns=3,gap=96,projectWidth=columns*size.width+(columns-1)*gap,projectHeight=2*size.height+gap;
  const patternsBoard=board('Extron Kit / 06 — AV-сценарии','06 / Готовые AV-сценарии','6 сценариев. Экспортируйте project_AVPatterns или отдельный screen_. Команды и переходы подключает программа управления.',origin,y,Math.max(1560,projectWidth+96),projectHeight+272);
  const project=frame(patternsBoard,'project_AVPatterns',projectWidth,projectHeight);project.x=48;project.y=208;
  const patterns:FrameNode[]=[];
  function renderScreen(parent:FrameNode,name:string,width:number,height:number,items:Element[],x:number,y:number){
    const screen=frame(parent,name,width,height,c.canvas);screen.x=x;screen.y=y;
    for(const item of items){
      const [x,top,w,h]=item.bounds;let node:SceneNode;
      if(item.kind==='shape'){
        const surface=frame(screen,item.name,w,h,color(item.color));surface.cornerRadius=g.surfaceRadius;node=surface;
      }else if(item.kind==='icon'){
        const graphic=frame(screen,item.name,w,h);graphic.appendChild(symbol(item.icon!,color(item.color),w));node=graphic;
      }else{
        const masterName=item.kind==='text'?(item.name.startsWith('value_')?'value_Value':'text_Label'):item.kind==='slider'?'slider_Slider':item.kind==='status'?'multilevel_Multilevel':item.master!;
        const master=masters.find(m=>m.name===masterName);if(!master)throw new Error('Missing kit master: '+masterName);
        const instance=master.createInstance();screen.appendChild(instance);instance.name=item.name;let control:SceneNode=instance;
        if(item.kind==='text'){
          instance.resize(w,h);const text=instance.children[0] as TextNode;text.characters=item.text!;text.fontSize=item.fontSize!;text.fills=[paint(color(item.color))];text.fontName={family:catalog.typography.family,style:item.bold?'Bold':'Regular'};text.textAlignHorizontal=(item.align??'left').toUpperCase() as TextNode['textAlignHorizontal'];
        }else if(item.kind==='slider'){
          control=sizeSlider(instance,w,h,item.value??42);
        }else if(item.kind==='graphic'){
          instance.resize(w,h);
          for(const art of instance.children)if('children'in art)for(const child of art.children)if(child.type==='TEXT')child.characters=item.label!;
        }else{
          sizeButton(instance,w,h);if(item.label)buttonLabel(instance,item.label);
          for(const [i,state]of (instance.children as FrameNode[]).entries()){
            state.visible=item.kind==='status'?i===Number(item.selected):i===(item.selected?1:0);
            const tone=item.tone,fg=i===0&&!tone?c.ink:c.onAccent;
            const bg=tone==='danger'?(i===0?c.danger:c.dangerPressed):tone==='primary'?(i===0?c.accent:c.pressed):undefined;
            if(bg)state.fills=[paint(bg)];
            for(const part of state.children){
              if(part.type==='TEXT'&&item.labels)part.characters=item.labels[i];
              if(!('children'in part))continue;
              for(const child of part.children){
                if(bg&&child.name==='Background')(child as FrameNode).fills=[paint(bg)];
                if(child.type==='TEXT'&&child.name==='Label'){
                  child.fills=[paint(fg)];if(item.icon){child.x=56;child.resize(w-88,h);child.textAlignHorizontal='LEFT';}
                }
              }
              if(item.icon){const graphic=symbol(item.icon,fg,g.iconSize);part.appendChild(graphic);graphic.x=20;graphic.y=(h-g.iconSize)/2;}
            }
          }
        }
        node=control;
      }
      node.x=x;node.y=top;
    }
    return screen;
  }
  for(const [index,spec]of (registry.patterns as Pattern[]).entries()){
    patterns.push(renderScreen(project,spec.container,size.width,size.height,spec.layouts[profile],(index%columns)*(size.width+gap),Math.floor(index/columns)*(size.height+gap)));
  }
  const iconsBoard=board('Extron Kit / 07 — Иконки и размеры','07 / Иконки и размеры','Lucide 1.61.0 · 18 SVG / 24 px. Переносите внутрь Artwork. Кнопка сохраняет видимую подпись.',origin+patternsBoard.width+240,y,1560,1536);
  const icons:ComponentNode[]=[];
  for(const [index,entry]of symbols.icons.entries()){
    const cell=frame(iconsBoard,'Icon guide / '+entry.name,220,144,c.surface);cell.x=40+index%6*248;cell.y=208+Math.floor(index/6)*168;cell.cornerRadius=g.controlRadius;
    const master=figma.createComponent();cell.appendChild(master);master.name='Icon / '+entry.name;master.resize(g.iconSize,g.iconSize);master.x=24;master.y=24;master.fills=[];master.strokes=[];master.setPluginData(KIT_KEY,KIT_VERSION);master.description='Lucide 1.61.0 / 24 px. Только внутри Artwork; отдельного ID нет. ISC/MIT: design/extron-kit/icons/LICENSE.';master.appendChild(symbol(entry.name,c.ink,g.iconSize));icons.push(master);
    const name=label(cell,'Icon name',entry.name,188,32,16,c.ink);name.x=16;name.y=88;
  }
  const scale=label(iconsBoard,'Spacing title','Шкала отступов / px',1480,40,28,c.ink,true);scale.x=40;scale.y=776;
  for(const [i,value]of catalog.spacing.entries()){
    const caption=label(iconsBoard,'Spacing / '+value,String(value),160,32,20,c.muted);caption.x=40+i*248;caption.y=840;
    const bar=frame(iconsBoard,'Measure / '+value,value,16,c.accent);bar.x=caption.x;bar.y=896;
  }
  const targets=label(iconsBoard,'Target title','Цель нажатия / минимум 56 px',1480,40,28,c.ink,true);targets.x=40;targets.y=1000;
  for(const [i,h]of [g.minimumTarget,64].entries()){
    const sample=frame(iconsBoard,'Touch target / '+h,220,h,c.control);sample.x=40+i*248;sample.y=1080;sample.cornerRadius=g.controlRadius;
    const copy=label(sample,'Size',h+' px',220,h,20,c.ink,true);copy.textAlignHorizontal='CENTER';
  }
  const note=label(iconsBoard,'Target note','Проектные размеры для этих двух профилей. Иконка — 24 px внутри кнопки; цель нажатия — вся кнопка.\nНе используйте серый цвет как единственное объяснение недоступного действия: покажите причину отдельным текстом.',1480,112,20,c.muted);note.x=40;note.y=1216;
  const supportWidth=columns*size.width+(columns-1)*gap;
  const contentBoard=board('Extron Kit / 08 — Состояния и компактный экран',content.title,content.intro,origin,y+patternsBoard.height+240,Math.max(1560,supportWidth+96),size.height+960);
  const supportProject=frame(contentBoard,'project_ControlStates',supportWidth,size.height);supportProject.x=48;supportProject.y=272;
  const supportScreens=(content.patterns as Pattern[]).map((spec,index)=>{
    const caption=label(contentBoard,'Scenario / '+spec.id,spec.title,size.width,40,24,c.ink,true);caption.x=48+index*(size.width+gap);caption.y=208;
    return renderScreen(supportProject,spec.container,size.width,size.height,spec.layouts[profile],index*(size.width+gap),0);
  });
  const compactTitle=label(contentBoard,'Compact title','TLP Pro 300M · 320 × 480',1000,48,28,c.ink,true);compactTitle.x=48;compactTitle.y=size.height+352;
  // Kept outside supportProject: a project must not mix the two panel sizes.
  const compactExample=renderScreen(contentBoard,content.compact.container,320,480,content.compact.elements,48,size.height+416);
  const guide=label(contentBoard,'Program contract',content.guidance.join('\n\n'),contentBoard.width-544,480,20,c.muted);guide.x=448;guide.y=size.height+416;
  return{patterns,patternProject:project,icons,contentBoard,supportProject,supportScreens,compactExample};
}
