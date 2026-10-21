// Explicit Figma component/slot boundary model; it does not prove Figma UI/render behavior.
import { fakeFigma } from './fake-figma.ts';
import { zlibSync } from 'fflate';
export function png(width:number,height:number):Uint8Array {
  const crc=(bytes:Uint8Array)=>{let value=0xffffffff;for(const byte of bytes){value^=byte;for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);}return(value^0xffffffff)>>>0;};
  const chunk=(name:string,data:Uint8Array)=>{const b=new Uint8Array(data.length+12),v=new DataView(b.buffer);v.setUint32(0,data.length);b.set(new TextEncoder().encode(name),4);b.set(data,8);v.setUint32(b.length-4,crc(b.subarray(4,b.length-4)));return b;};
  const header=new Uint8Array(13),view=new DataView(header.buffer);view.setUint32(0,width);view.setUint32(4,height);header[8]=8;header[9]=6;
  const pixels=new Uint8Array((width*4+1)*height);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*(width*4+1)+x*4+1;pixels.set([230,92,0,255],i);}
  const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlibSync(pixels)),chunk('IEND',new Uint8Array())];
  const result=new Uint8Array(parts.reduce((sum,p)=>sum+p.length,0));let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;
}
export function kitFixture(){
  const fake=fakeFigma(),api=fake.api as any;let propertyId=0;
  const references=new WeakMap<object,unknown>();
  Object.defineProperty(fake.FakeNode.prototype,'componentPropertyReferences',{
    configurable:true,
    get(){return references.get(this);},
    set(value){
      for(let ancestor=this.parent;ancestor;ancestor=ancestor.parent)if(ancestor.type==='SLOT')throw new Error('Cannot set component property references on slot sublayer');
      references.set(this,value);
      Object.defineProperty(this,'componentPropertyReferences',{enumerable:true,configurable:true,get(){return references.get(this);},set(value){
        for(let ancestor=this.parent;ancestor;ancestor=ancestor.parent)if(ancestor.type==='SLOT')throw new Error('Cannot set component property references on slot sublayer');
        references.set(this,value);
      }});
    },
  });
  const visit=(node:any,fn:(n:any)=>void)=>{fn(node);for(const child of node.children)visit(child,fn);};
  api.createComponent=()=>{
    const n=new fake.FakeNode('COMPONENT') as any;fake.page.appendChild(n);n.componentPropertyDefinitions={};
    n.addComponentProperty=(name:string,type:string,defaultValue:string)=>{const key=name+'#'+(++propertyId);n.componentPropertyDefinitions[key]={type,defaultValue};return key;};
    n.editComponentProperty=(key:string,options:any)=>{const value={...n.componentPropertyDefinitions[key],...options};delete n.componentPropertyDefinitions[key];const next=options.name?options.name+'#'+(++propertyId):key;n.componentPropertyDefinitions[next]=value;visit(n,c=>{if(c.componentPropertyReferences?.slotContentId===key){c.componentPropertyReferences.slotContentId=next;if(options.name)c.name=options.name;}});return next;};
    n.createSlot=()=>{const slot=new fake.FakeNode('SLOT') as any;n.appendChild(slot);slot.componentPropertyReferences={slotContentId:n.addComponentProperty('Slot','SLOT','')};return slot;};
    n.createInstance=()=>{const instance=n.clone() as any;instance.type='INSTANCE';instance.setProperties=(props:Record<string,string>)=>visit(instance,c=>{const property=c.componentPropertyReferences?.characters;if(property&&property in props)c.characters=props[property];});return instance;};
    return n;
  };
  const originalClone=fake.FakeNode.prototype.clone;
  fake.FakeNode.prototype.clone=function(){const copy=originalClone.call(this);if(copy.type==='SLOT')copy.type='FRAME';return copy;};
  fake.setRenderHook(node=>{const bytes=png(Math.round(node.width),Math.round(node.height)),hash=api.createImage(bytes).hash;node.fills=[{type:'IMAGE',imageHash:hash,scaleMode:'FILL'}];});
  return fake;
}
