import large from '../../../tests/fixtures/exui-v1/1025m/screen.json' with { type:'json' };
import small from '../../../tests/fixtures/exui-v1/300m/screen.json' with { type:'json' };
import { MANUAL_KEY } from './key-sync.ts';
import { DATA_KEY, integer, isControlKind, metadataSchema, type MetadataInput, type Metadata, type Profile, type SingleScreen } from './model.ts';
export function tag(node:BaseNode, data:MetadataInput):void {
  node.setPluginData(DATA_KEY,JSON.stringify({...data,schema:metadataSchema(data),ownerNodeId:node.id}));
}
function paint(hex:string):SolidPaint {
  const rgb=hex.slice(-6),alpha=hex.length===9?parseInt(hex.slice(1,3),16)/255:1;
  return {type:'SOLID',color:{r:parseInt(rgb.slice(0,2),16)/255,g:parseInt(rgb.slice(2,4),16)/255,b:parseInt(rgb.slice(4,6),16)/255},...(alpha!==1?{opacity:alpha}:{})};
}
// Legacy reproduces tests/fixtures/exui-v1 exactly, including its Russian layer names.
// The plugin demo uses Latin layer names and keeps the curated keys as manual.
const pascal=(value:string)=>value.split(/[.-]/).map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join('');
const DEMO_PREFIX:Record<string,string>={button:'button_',label:'text_',level:'level_'};
function curated(node:BaseNode,legacy:boolean){if(!legacy)node.setPluginData(MANUAL_KEY,node.id);}
export async function createDemo(profile:Profile,icons:Record<string,Uint8Array>,legacy=false):Promise<FrameNode> {
  const spec=(profile==='tlp-pro-1025m'?large:small) as Omit<SingleScreen,'schema'>;
  const fonts=await figma.listAvailableFontsAsync();
  for(const style of ['Regular','Bold']) {
    if(!fonts.some(f=>f.fontName.family==='Arial'&&f.fontName.style===style)) throw new Error(`В Figma отсутствует Arial ${style}. Установите шрифт и перезапустите приложение.`);
    await figma.loadFontAsync({family:'Arial',style});
  }
  const created:SceneNode[]=[];
  const makeFrame=(name:string,w:number,h:number,parent?:FrameNode)=>{
    const node=figma.createFrame();created.push(node);node.name=name;node.resize(w,h);node.strokes=[];node.fills=[];node.clipsContent=true;
    if(parent)parent.appendChild(node);return node;
  };
  const makeText=(parent:FrameNode,copy:string,w:number,h:number,color:string,size:number,bold:boolean,align:'CENTER'|'BOTTOM'='CENTER')=>{
    const node=figma.createText();created.push(node);parent.appendChild(node);node.fontName={family:'Arial',style:bold?'Bold':'Regular'};
    node.fontSize=size/0.75;node.characters=copy;node.resize(w,h);node.textAutoResize='NONE';node.textAlignHorizontal='CENTER';node.textAlignVertical=align;node.fills=[paint(color)];node.name=copy;
    return node;
  };
  let root:FrameNode|undefined;
  try {
    const width=profile==='tlp-pro-1025m'?1280:320,height=profile==='tlp-pro-1025m'?800:480;
    const right=Math.max(0,...figma.currentPage.children.map(n=>n.x+('width' in n?n.width:0)));
    root=makeFrame(legacy?spec.page.name:pascal(spec.page.key.replace(/^page\./,'')),width,height);root.x=right+120;root.y=120;root.fills=[paint(spec.page.background)];
    tag(root,{kind:'page',key:spec.page.key,objectId:spec.page.objectId,profile,projectName:spec.project.name});curated(root,legacy);
    const imageHashes:Record<string,string>={};
    for(const [k,bytes] of Object.entries(icons)) imageHashes[k]=figma.createImage(bytes).hash;
    for(const e of spec.elements) {
      const [x,y,w,h]=e.rect;
      let control:SceneNode;
      if(e.kind==='label') {const label=makeText(root,e.text!,w,h,e.textColor!,e.font!.size,e.font!.bold);label.textAlignHorizontal='LEFT';control=label;}
      else {
        control=makeFrame(e.name,w,h,root);
        if(e.kind==='level')control.fills=[paint(e.fillColor!)];
        else for(const s of e.states!) {
          const state=makeFrame(s.name,w,h,control);state.fills=[paint(s.fill)];
          const stateName=legacy?s.name:{normal:'Normal',feedback:'Active',pressed:'Pressed'}[s.role];
          state.name=stateName;tag(state,{kind:'state',stateId:s.stateId,role:s.role,stateName});
          const label=makeText(state,s.text,w,h,s.textColor,e.font!.size,e.font!.bold,s.textAlign==='bottom-center'?'BOTTOM':'CENTER');label.x=0;label.y=0;
          if(s.image) {
            const asset=spec.assets.find(a=>a.key===s.image)!;
            const image=makeFrame(asset.key,64,64,state);image.x=(w-64)/2;image.y=s.imageAlign==='top-center'?0:(h-64)/2;
            image.fills=[{type:'IMAGE',imageHash:imageHashes[asset.key],scaleMode:'FILL'}];
            tag(image,{kind:'image',...asset});
          }
          state.visible=s.role==='normal';
        }
      }
      control.name=legacy?e.name:(DEMO_PREFIX[e.kind]??'')+pascal(e.key);control.x=x;control.y=y;
      const identity={key:e.key,objectId:e.objectId};
      tag(control,isControlKind(e.kind)?{kind:e.kind,...identity,controlId:integer(e.controlId,1,65535,'controlId'),...(!legacy&&e.kind==='button'?{buttonMode:'feedback' as const}:{})}:{kind:e.kind,...identity,controlId:null});curated(control,legacy);
    }
    figma.currentPage.selection=[root];figma.viewport.scrollAndZoomIntoView([root]);return root;
  } catch(e) {for(const node of created.reverse())if(!node.removed)node.remove();throw e;}
}
