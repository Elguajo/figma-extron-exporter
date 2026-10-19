// Deliberately a Figma API boundary fixture, not evidence of running inside Figma.
import { readFileSync } from 'node:fs';
export function fakeFigma() {
  let counter=0;
  const images=new Map<string,Uint8Array>();
  let renderHook:(node:FakeNode,settings:any)=>void|Promise<void>=()=>{};
  const listeners=new Map<string,(()=>void)[]>();
  class FakeNode {
    id=String(++counter);name='';type:string;parent:FakeNode|null=null;children:FakeNode[]=[];width=1;height=1;x=0;y=0;removed=false;
    visible=true;opacity=1;blendMode='PASS_THROUGH';isMask=false;effects:unknown[]=[];strokes:unknown[]=[];cornerRadius=0;reactions:unknown[]=[];
    fills:unknown[]=[];clipsContent=true;characters='';fontName={family:'Arial',style:'Regular'};fontSize=16;textAlignHorizontal='LEFT';textAlignVertical='TOP';textDecoration='NONE';textCase='ORIGINAL';letterSpacing={unit:'PIXELS',value:0};
    data=new Map<string,string>();
    constructor(type:string){this.type=type;}
    get relativeTransform(){return [[1,0,this.x],[0,1,this.y]];}
    get absoluteTransform(){const b=this.absoluteBoundingBox;return [[1,0,b.x],[0,1,b.y]];}
    get absoluteBoundingBox():{x:number;y:number;width:number;height:number}{const p=this.parent?.type!=='PAGE'?this.parent?.absoluteBoundingBox:undefined;return{x:(p?.x??0)+this.x,y:(p?.y??0)+this.y,width:this.width,height:this.height};}
    resize(w:number,h:number){this.width=w;this.height=h;}
    appendChild(n:FakeNode){if(n.parent)n.parent.children.splice(n.parent.children.indexOf(n),1);this.children.push(n);n.parent=this;}
    getPluginData(k:string){return this.data.get(k)??'';}
    setPluginData(k:string,v:string){this.data.set(k,v);}
    remove(){for(const c of [...this.children])c.remove();if(this.parent)this.parent.children.splice(this.parent.children.indexOf(this),1);this.removed=true;}
    clone():FakeNode {
      const copyTree=(source:FakeNode):FakeNode=>{const copy=new FakeNode(source.type);for(const [key,value]of Object.entries(source))if(!['id','parent','children','removed'].includes(key)&&typeof value!=='function')(copy as any)[key]=structuredClone(value);for(const child of source.children)copy.appendChild(copyTree(child));return copy;};
      const copy=copyTree(this);this.parent?.appendChild(copy);return copy;
    }
    async exportAsync(settings?:unknown){await renderHook(this,settings);const fill=this.fills[0] as {imageHash?:string};if(!fill?.imageHash)throw new Error('Fixture exports only image fills');return new Uint8Array(images.get(fill.imageHash)!);}
  }
  const page=new FakeNode('PAGE') as FakeNode&{selection:FakeNode[]};page.selection=[];
  const messages:Record<string,unknown>[]=[];
  const create=(type:string)=>{const n=new FakeNode(type);page.appendChild(n);return n;};
  const api={currentPage:page,mixed:Symbol('mixed'),root:{name:'fixture'},viewport:{scrollAndZoomIntoView(){}},
    listAvailableFontsAsync:async()=>['Regular','Bold'].map(style=>({fontName:{family:'Arial',style}})),loadFontAsync:async()=>{},
    createFrame:()=>create('FRAME'),createText:()=>create('TEXT'),createImage:(bytes:Uint8Array)=>{const hash=String(images.size+1);images.set(hash,bytes);return{hash};},
    showUI:()=>{},ui:{postMessage:(m:Record<string,unknown>)=>messages.push(m),onmessage:undefined as unknown},
    on:(name:string,callback:()=>void)=>listeners.set(name,[...(listeners.get(name)??[]),callback]),
  };
  (globalThis as unknown as {figma:unknown}).figma=api;
  return {api,page,messages,FakeNode,setRenderHook:(hook:typeof renderHook)=>renderHook=hook,emit:(name:string)=>listeners.get(name)?.forEach(fn=>fn())};
}
export function icons(){return Object.fromEntries(['light','dark'].map(tone=>[`icon.note-${tone}`,new Uint8Array(readFileSync(new URL(`../../../examples/first-screen/assets/note-${tone}.png`,import.meta.url)))]));}
