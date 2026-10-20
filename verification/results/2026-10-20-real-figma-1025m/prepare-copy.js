(async()=>{
const homes=figma.currentPage.children.filter(n=>n.type==='FRAME'&&n.name==='Home'&&n.width===1280&&n.height===800);
if(homes.length!==1)throw new Error('Expected one original Home 1280x800');
const source=homes[0];
function one(parent,name){const a=parent.children.filter(n=>n.name===name);if(a.length!==1)throw new Error('Ambiguous source '+name);return a[0];}
const up=one(source,'button_VolumeUp'),down=one(source,'button_VolumeDown'),bar=one(source,'Volume Bar'),indicator=one(source,'Volume Indicator'),logo=one(source,'logo_trilliant');
await figma.loadFontAsync({family:'Arial',style:'Bold'});
const solid=hex=>({type:'SOLID',color:{r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255}});
function frame(parent,name,x,y,w,h,fills=[]){const n=figma.createFrame();parent.appendChild(n);n.name=name;n.resize(w,h);n.x=x;n.y=y;n.fills=fills;n.strokes=[];n.cornerRadius=0;return n;}
const right=Math.max(...figma.currentPage.children.map(n=>n.x+n.width));
const root=frame(figma.currentPage,'HomeVolumeReady',Math.ceil(right)+200,source.y,1280,800,[solid('#14151C')]);
function label(parent,name,value,x,y,w,h,size){const n=figma.createText();parent.appendChild(n);n.name=name;n.fontName={family:'Arial',style:'Bold'};n.fontSize=size;n.characters=value;n.resize(w,h);n.x=x;n.y=y;n.textAlignHorizontal='CENTER';n.textAlignVertical='CENTER';n.fills=[solid('#FFFFFF')];return n;}
const provenance=[];
for(const [original,glyph] of [[down,'−'],[up,'+']]){
 const b=frame(root,original.name,Math.round(original.x),Math.round(original.y),Math.round(original.width),Math.round(original.height));
 for(const stateName of ['Normal','Pressed']){
  const old=one(original,stateName),rects=old.children.filter(n=>n.type==='RECTANGLE'&&Math.round(n.width)===b.width&&Math.round(n.height)===b.height);
  if(rects.length!==1)throw new Error('Expected one button background');
  const st=frame(b,stateName,0,0,b.width,b.height,[solid('#14151C')]);
  const icon=frame(st,'Icon',0,0,b.width,b.height);
  const bg=rects[0].clone();icon.appendChild(bg);bg.relativeTransform=[[1,0,0],[0,1,0]];bg.resize(b.width,b.height);bg.x=0;bg.y=0;bg.visible=true;
  bg.fills=[solid(stateName==='Pressed'?'#FFCC00':'#191B1D')];bg.strokeAlign='INSIDE';
  if(stateName==='Pressed')bg.strokes=[solid('#FFCC00')];
  const text=label(st,'Text',glyph,0,0,b.width,b.height,28);if(stateName==='Pressed')text.fills=[solid('#000000')];
  st.visible=stateName==='Normal';
 }
 provenance.push({sourceId:original.id,resultId:b.id,kind:'button',changes:['state Groups rebuilt as Frames at 0,0; no reflection','original rounded backgrounds cloned into PNG Icon Frames','vector glyph replaced by editable Arial glyph','Pressed explicitly yellow']});
}
const slider=frame(root,'slider_Volume',Math.round(bar.x),Math.round(bar.y+bar.height/2-16),Math.round(bar.width),32);
const track=frame(slider,'Track',0,6,Math.round(bar.width),20,[solid('#2A2D31')]);track.cornerRadius=10;
const fill=frame(slider,'Fill',0,6,Math.round(bar.width*0.42),20,[solid('#E16716')]);fill.cornerRadius=10;
const thumb=frame(slider,'Thumb',Math.round((bar.width-28)*0.42),2,28,28,[solid('#FFFFFF')]);thumb.cornerRadius=14;
provenance.push({sourceId:bar.id,resultId:slider.id,kind:'slider',changes:['original rectangle position/width and track color used','added Fill at 42% and white circular Thumb; height 32']});
const value=label(root,'value_VolumeValue',indicator.characters,Math.round(indicator.x),Math.round(indicator.y),Math.round(indicator.width),Math.round(indicator.height),indicator.fontSize);
provenance.push({sourceId:indicator.id,resultId:value.id,kind:'value',changes:['Inter Bold replaced by Arial Bold','alignment CENTER/CENTER']});
const graphic=frame(root,'logo_Company',Math.round(logo.x),Math.round(logo.y),Math.ceil(logo.width),Math.ceil(logo.height));
const mark=logo.clone();graphic.appendChild(mark);mark.relativeTransform=[[1,0,0],[0,1,0]];mark.resize(Math.round(logo.width),Math.round(logo.height));mark.x=0;mark.y=0;
provenance.push({sourceId:logo.id,resultId:graphic.id,kind:'graphic',changes:['original vector cloned into integer-sized Frame']});
figma.currentPage.selection=[root];figma.viewport.scrollAndZoomIntoView([root]);
const report={boundary:'Real Figma Plugin API; prepared separate copy from original user Home; not a mock',sourceId:source.id,resultId:root.id,resultName:root.name,provenance};
const json=JSON.stringify(report,null,2);
figma.showUI('<html><body><h2>Prepared actual Figma volume copy</h2><textarea aria-label="Actual preparation report" readonly style="width:100%;height:500px">'+json.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</textarea></body></html>',{width:650,height:600});
})().catch(e=>{figma.notify(String(e),{error:true});figma.closePlugin(String(e));});
