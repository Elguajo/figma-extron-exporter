const anchor=Get(kitUniversal,{depth:0});
kitPresets=Insert(document,{type:'frame',name:'Extron Kit / Ready-to-use controls',x:anchor.x,y:anchor.y+1484,width:1560,height:1040,layout:'vertical',padding:40,gap:24,fill:'$extron-canvas',placeholder:true});
Insert(kitPresets,{type:'text',name:'Section title',content:'02 / Готовые назначения',fontFamily:'Inter',fontSize:30,fontWeight:'bold',fill:'$extron-ink'});
Insert(kitPresets,{type:'text',name:'Section description',content:'Громкость, питание, источники, зоны и навигация. Внешний вид независим от служебного имени.',fontFamily:'Inter',fontSize:17,fill:'$extron-muted'});
const specs=[{"name":"feedbackbutton_Mute","type":"button","label":"Mute","states":["Normal","Active","Pressed"],"section":"Presets"},{"name":"button_VolumeUp","type":"button","label":"+","states":["Off","On"],"section":"Presets"},{"name":"button_VolumeDown","type":"button","label":"−","states":["Off","On"],"section":"Presets"},{"name":"feedbackbutton_Power","type":"button","label":"Power","states":["Normal","Active","Pressed"],"section":"Presets"},{"name":"feedbackbutton_Music","type":"button","label":"Music","states":["Normal","Active","Pressed"],"section":"Presets"},{"name":"feedbackbutton_HDMI","type":"button","label":"HDMI","states":["Normal","Active","Pressed"],"section":"Presets"},{"name":"feedbackbutton_Wireless","type":"button","label":"Wireless","states":["Normal","Active","Pressed"],"section":"Presets"},{"name":"feedbackbutton_Hall","type":"button","label":"Hall","states":["Normal","Active","Pressed"],"section":"Presets"},{"name":"feedbackbutton_Terrace","type":"button","label":"Terrace","states":["Normal","Active","Pressed"],"section":"Presets"},{"name":"button_Back","type":"button","label":"Back","states":["Off","On"],"section":"Presets"},{"name":"button_Home","type":"button","label":"Home","states":["Off","On"],"section":"Presets"},{"name":"button_Settings","type":"button","label":"Settings","states":["Off","On"],"section":"Presets"},{"name":"slider_Volume","type":"slider","label":"Volume","section":"Presets"},{"name":"value_VolumeValue","type":"text","label":"42%","section":"Presets"}];
for(let row=0;row<5;row++){
 const r=Insert(kitPresets,{type:'frame',name:'Preset row '+(row+1),layout:'horizontal',gap:20,width:'fill_container',height:152});
 for(const s of specs.slice(row*3,row*3+3)){
  const cell=Insert(r,{type:'frame',name:'Guide / '+s.name,width:'fill_container',height:152,layout:'vertical',padding:20,gap:16,fill:'$extron-surface',cornerRadius:10});
  Insert(cell,{type:'text',name:'Service name',content:s.name,fontFamily:'Inter',fontSize:15,fontWeight:'bold',fill:'$extron-ink'});
  const w=s.type==='slider'?300:220,h=s.type==='slider'?40:s.type==='text'?40:64;
  const comp=Insert(cell,{type:'frame',name:s.name,reusable:true,width:w,height:h,layout:'none',clip:true});kitRefs[s.name]=comp;
  if(s.states)for(let i=0;i<s.states.length;i++){
   const st=Insert(comp,{type:'frame',name:s.states[i],x:0,y:0,width:w,height:h,layout:'none',fill:i===0?'$extron-track':i===1?'$extron-active':'$extron-pressed',enabled:i===0});
   const art=Insert(st,{type:'frame',name:'Artwork',x:0,y:0,width:w,height:h,layout:'none',slot:[]});
   Insert(art,{type:'text',name:'Label',content:s.label,fontFamily:'Inter',fontSize:20,fontWeight:'bold',fill:i===2?'#FFFFFF':'$extron-ink',textGrowth:'fixed-width-height',width:w,height:h,textAlign:'center',textAlignVertical:'middle'});
  }else if(s.type==='slider'){
   Insert(comp,{type:'frame',name:'Track',x:0,y:12,width:w,height:16,fill:'$extron-track',cornerRadius:8});
   Insert(comp,{type:'frame',name:'Fill',x:0,y:12,width:126,height:16,fill:'$extron-accent',cornerRadius:8});
   Insert(comp,{type:'ellipse',name:'Thumb',x:112,y:6,width:28,height:28,fill:'$extron-ink'});
  }else Insert(comp,{type:'text',name:'Content',content:s.label,fontFamily:'Inter',fontSize:24,fill:'$extron-ink',textGrowth:'fixed-width-height',width:w,height:h,textAlignVertical:'middle'});
 }
}
Update(kitPresets,{placeholder:false});
TakeScreenshot([kitPresets]);
