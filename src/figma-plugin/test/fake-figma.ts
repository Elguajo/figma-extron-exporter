// Deliberately a Figma API boundary fixture, not evidence of running inside Figma.
import { readFileSync } from 'node:fs';
export function fakeFigma() {
  let counter=0;
  const images=new Map<string,Uint8Array>();
  let renderHook:(node:FakeNode,settings:any)=>void|Uint8Array|Promise<void|Uint8Array>=()=>{};
  const listeners=new Map<string,(()=>void)[]>();
  class FakeNode {
    id=String(++counter);name='';type:string;parent:FakeNode|null=null;children:FakeNode[]=[];width=1;height=1;x=0;y=0;removed=false;
    visible=true;opacity=1;blendMode='PASS_THROUGH';isMask=false;effects:unknown[]=[];strokes:unknown[]=[];cornerRadius=0;reactions:unknown[]=[];
    strokeWeight=1;strokeAlign='CENTER';strokeCap='NONE';dashPattern:number[]=[];variableWidthStrokeProperties=null;complexStrokeProperties={type:'BASIC'};
    vectorNetwork:VectorNetwork={vertices:[],segments:[]};
    fills:unknown[]=[];clipsContent=true;layoutMode='NONE';characters='';fontName={family:'Arial',style:'Regular'};fontSize=16;textAlignHorizontal='LEFT';textAlignVertical='TOP';textDecoration='NONE';textCase='ORIGINAL';letterSpacing={unit:'PIXELS',value:0};
    data=new Map<string,string>();
    textSegments:unknown[]|undefined;
    getStyledTextSegments(fields:string[]){return this.textSegments??[{characters:this.characters,start:0,end:this.characters.length,...Object.fromEntries(fields.map(field=>[field,(this as any)[field]]))}];}
    constructor(type:string){this.type=type;}
    get relativeTransform(){return [[1,0,this.x],[0,1,this.y]];}
    set relativeTransform(value:number[][]){this.x=value[0][2];this.y=value[1][2];}
    get absoluteTransform(){const b=this.absoluteBoundingBox;return [[1,0,b.x],[0,1,b.y]];}
    get absoluteBoundingBox():{x:number;y:number;width:number;height:number}{const p=this.parent?.type!=='PAGE'?this.parent?.absoluteBoundingBox:undefined;return{x:(p?.x??0)+this.x,y:(p?.y??0)+this.y,width:this.width,height:this.height};}
    resize(w:number,h:number){this.width=w;this.height=h;}
    async setVectorNetworkAsync(network:VectorNetwork){this.vectorNetwork=structuredClone(network);const xs=network.vertices.map(v=>v.x),ys=network.vertices.map(v=>v.y);this.width=Math.max(...xs)-Math.min(...xs);this.height=Math.max(...ys)-Math.min(...ys);}
    appendChild(n:FakeNode){if(n.parent)n.parent.children.splice(n.parent.children.indexOf(n),1);this.children.push(n);n.parent=this;}
    insertChild(index:number,n:FakeNode){this.appendChild(n);this.children.splice(this.children.indexOf(n),1);this.children.splice(index,0,n);}
    getPluginData(k:string){return this.data.get(k)??'';}
    setPluginData(k:string,v:string){this.data.set(k,v);}
    remove(){for(const c of [...this.children])c.remove();if(this.parent)this.parent.children.splice(this.parent.children.indexOf(this),1);this.removed=true;}
    clone():FakeNode {
      const copyTree=(source:FakeNode):FakeNode=>{const copy=new FakeNode(source.type);for(const [key,value]of Object.entries(source))if(!['id','parent','children','removed'].includes(key)&&typeof value!=='function')(copy as any)[key]=value===api.mixed?value:structuredClone(value);for(const child of source.children)copy.appendChild(copyTree(child));return copy;};
      const copy=copyTree(this);this.parent?.appendChild(copy);return copy;
    }
    async exportAsync(settings?:unknown){const rendered=await renderHook(this,settings);if(rendered instanceof Uint8Array)return rendered;const fill=this.fills[0] as {imageHash?:string};if(!fill?.imageHash)throw new Error('Fixture exports only image fills');return new Uint8Array(images.get(fill.imageHash)!);}
  }
  const page=new FakeNode('PAGE') as FakeNode&{selection:FakeNode[]};page.selection=[];page.name='Page 1';
  const messages:Record<string,unknown>[]=[];
  const create=(type:string)=>{const n=new FakeNode(type);page.appendChild(n);return n;};
  const api={currentPage:page,mixed:Symbol('mixed'),root:{name:'fixture'},viewport:{center:{x:0,y:0},zoom:1,get bounds(){return {x:this.center.x-600/this.zoom,y:this.center.y-400/this.zoom,width:1200/this.zoom,height:800/this.zoom};},scrollAndZoomIntoView(){}},
    listAvailableFontsAsync:async()=>['Regular','Bold'].map(style=>({fontName:{family:'Arial',style}})),loadFontAsync:async()=>{},
    createRectangle:()=>create('RECTANGLE'),createFrame:()=>create('FRAME'),createSection:()=>create('SECTION'),createText:()=>create('TEXT'),createEllipse:()=>create('ELLIPSE'),createVector:()=>create('VECTOR'),createLine:()=>{const n=create('LINE');n.width=100;n.height=0;return n;},createImage:(bytes:Uint8Array)=>{const hash=String(images.size+1);images.set(hash,bytes);return{hash};},
    group:(nodes:FakeNode[],parent:FakeNode,index=parent.children.length)=>{
      const positions=nodes.map(n=>n.absoluteBoundingBox),p=parent.absoluteBoundingBox;
      const x=Math.min(...positions.map(b=>b.x)),y=Math.min(...positions.map(b=>b.y));
      const group=new FakeNode('GROUP');group.x=x-p.x;group.y=y-p.y;group.width=Math.max(...positions.map(b=>b.x+b.width))-x;group.height=Math.max(...positions.map(b=>b.y+b.height))-y;
      parent.insertChild(index,group);nodes.forEach((n,i)=>{group.appendChild(n);n.x=positions[i].x-x;n.y=positions[i].y-y;});return group;
    },
    ungroup:(group:FakeNode)=>{const parent=group.parent!,index=parent.children.indexOf(group),positions=group.children.map(n=>n.absoluteBoundingBox),children=[...group.children],p=parent.absoluteBoundingBox;children.forEach((n,i)=>{parent.insertChild(index+i,n);n.x=positions[i].x-p.x;n.y=positions[i].y-p.y;});group.remove();return children;},
    commitUndo:()=>{},
    showUI:()=>{},ui:{postMessage:(m:Record<string,unknown>)=>messages.push(m),onmessage:undefined as unknown},
    on:(name:string,callback:()=>void)=>listeners.set(name,[...(listeners.get(name)??[]),callback]),
  };
  (globalThis as unknown as {figma:unknown}).figma=api;
  return {api,page,messages,FakeNode,setRenderHook:(hook:typeof renderHook)=>renderHook=hook,emit:(name:string)=>listeners.get(name)?.forEach(fn=>fn())};
}
export function icons(){return Object.fromEntries(['light','dark'].map(tone=>[`icon.note-${tone}`,new Uint8Array(readFileSync(new URL(`../../../examples/first-screen/assets/note-${tone}.png`,import.meta.url)))]));}
