kitColors={"canvas":"#F5F5F2","surface":"#FFFFFF","ink":"#20242A","muted":"#616A74","line":"#DADDDC","track":"#E2E5E5","accent":"#E65C00","active":"#FFE6D5","pressed":"#AB4300"};
kitRefs={};
const vars={};for(const [k,v] of Object.entries(kitColors))vars['extron-'+k]={type:'color',value:v};SetVariables(vars);
const pos=FindEmptySpace({width:1560,height:1680,padding:120,direction:'right'});
kitGuide=Insert(document,{type:'frame',name:'Extron Kit / Start here',x:pos.x,y:pos.y,width:1560,height:324,layout:'vertical',padding:48,gap:18,fill:'$extron-ink',placeholder:true});
Insert(kitGuide,{type:'text',name:'Eyebrow',content:'TRILLIANT  /  EXTRON CONTROL LIBRARY  /  01',fontFamily:'Inter',fontSize:14,fontWeight:'bold',fill:'#FFB587'});
Insert(kitGuide,{type:'text',name:'Title',content:'Дизайн меняется. Структура остаётся.',fontFamily:'Inter',fontSize:42,fontWeight:'bold',fill:'#FFFFFF'});
Insert(kitGuide,{type:'text',name:'Instructions',content:'Возьми экземпляр → измени оформление → размести на экране.\nСохраняй имя контейнера и состояний. Artwork — место для твоих слоёв.',fontFamily:'Inter',fontSize:21,lineHeight:1.5,fill:'#DFE3E6',textGrowth:'fixed-width',width:'fill_container'});
Insert(kitGuide,{type:'text',name:'Workflow',content:'pen.dev  →  компоненты Figma  →  .exui  →  GUI Designer / Build  →  Global Configurator Pro',fontFamily:'Inter',fontSize:16,fill:'#FFB587'});
Update(kitGuide,{placeholder:false});
kitUniversal=Insert(document,{type:'frame',name:'Extron Kit / Universal components',x:pos.x,y:pos.y+356,width:1560,height:1420,layout:'vertical',padding:40,gap:24,fill:'$extron-canvas',placeholder:true});
Insert(kitUniversal,{type:'text',name:'Section title',content:'01 / Универсальные компоненты',fontFamily:'Inter',fontSize:30,fontWeight:'bold',fill:'$extron-ink'});
Insert(kitUniversal,{type:'text',name:'Section description',content:'16 типов. Имена и состояния подготовлены; каждый элемент — переиспользуемый компонент.',fontFamily:'Inter',fontSize:17,fill:'$extron-muted'});
const specs=[{"name":"button_Button","type":"button","label":"Button","states":["Off","On"],"section":"Universal"},{"name":"feedbackbutton_Feedback","type":"button","label":"Feedback","states":["Normal","Active","Pressed"],"section":"Universal"},{"name":"slider_Slider","type":"slider","label":"Custom slider","section":"Universal"},{"name":"level_Level","type":"level","label":"Simple level","section":"Universal"},{"name":"gauge_Gauge","type":"level","label":"Gauge","section":"Universal"},{"name":"indicator_Indicator","type":"level","label":"Indicator","section":"Universal"},{"name":"volumeled_Led","type":"level","label":"Volume LED","section":"Universal"},{"name":"multilevel_Multilevel","type":"multilevel","label":"Ready","states":["Normal","state_Ready","state_Error"],"section":"Universal"},{"name":"text_Label","type":"text","label":"Text label","section":"Universal"},{"name":"value_Value","type":"text","label":"42%","section":"Universal"},{"name":"datetime_Clock","type":"text","label":"HH:mm","section":"Universal"},{"name":"shape_Shape","type":"shape","label":"Shape","section":"Universal"},{"name":"line_Line","type":"line","label":"Divider","section":"Universal"},{"name":"image_Image","type":"graphic","label":"Image","section":"Universal"},{"name":"logo_Logo","type":"graphic","label":"LOGO","section":"Universal"},{"name":"popupref_Popup","type":"popup-ref","label":"Popup position","section":"Universal"}];
for(let row=0;row<6;row++){
 const rowId=Insert(kitUniversal,{type:'frame',name:'Controls row '+(row+1),layout:'horizontal',gap:20,width:'fill_container',height:184});
 for(const s of specs.slice(row*3,row*3+3)){
  const cell=Insert(rowId,{type:'frame',name:'Guide / '+s.name,width:'fill_container',height:184,layout:'vertical',padding:20,gap:16,fill:'$extron-surface',cornerRadius:10});
  Insert(cell,{type:'text',name:'Service name',content:s.name,fontFamily:'Inter',fontSize:16,fontWeight:'bold',fill:'$extron-ink'});
  const cw=s.type==='slider'?300:s.type==='line'?300:s.type==='text'?220:220,ch=s.type==='line'?2:s.type==='slider'?40:s.type==='level'?20:s.type==='text'?40:64;
  const comp=Insert(cell,{type:'frame',name:s.name,width:cw,height:ch,layout:'none',reusable:true,clip:true});
  kitRefs[s.name]=comp;
  if(s.states){
   for(let i=0;i<s.states.length;i++){
    const st=Insert(comp,{type:'frame',name:s.states[i],x:0,y:0,width:cw,height:ch,layout:'none',fill:i===0?'$extron-track':i===1?'$extron-active':'$extron-pressed',enabled:i===0});
    const art=Insert(st,{type:'frame',name:'Artwork',x:0,y:0,width:cw,height:ch,layout:'none',slot:[]});
    Insert(art,{type:'text',name:'Label',content:s.label,fontFamily:'Inter',fontSize:20,fontWeight:'bold',fill:i===2?'#FFFFFF':'$extron-ink',textGrowth:'fixed-width-height',width:cw,height:ch,textAlign:'center',textAlignVertical:'middle'});
   }
  }else if(s.type==='slider'){
   Insert(comp,{type:'frame',name:'Track',x:0,y:12,width:cw,height:16,fill:'$extron-track',cornerRadius:8});
   Insert(comp,{type:'frame',name:'Fill',x:0,y:12,width:126,height:16,fill:'$extron-accent',cornerRadius:8});
   Insert(comp,{type:'ellipse',name:'Thumb',x:112,y:6,width:28,height:28,fill:'$extron-ink'});
  }else if(s.type==='text'){
   Insert(comp,{type:'text',name:'Content',content:s.label,fontFamily:'Inter',fontSize:24,fill:'$extron-ink',textGrowth:'fixed-width-height',width:cw,height:ch,textAlignVertical:'middle'});
  }else if(s.type==='graphic'){
   Update(comp,{fill:'$extron-track'});
   const art=Insert(comp,{type:'frame',name:'Artwork',width:cw,height:ch,x:0,y:0,layout:'none',slot:[]});
   Insert(art,{type:'text',name:'Placeholder',content:s.label,fontFamily:'Inter',fontSize:20,fontWeight:'bold',fill:'$extron-muted',textGrowth:'fixed-width-height',width:cw,height:ch,textAlign:'center',textAlignVertical:'middle'});
  }else if(s.type!=='popup-ref')Update(comp,{fill:s.type==='level'?'$extron-accent':'$extron-track'});
  Insert(cell,{type:'text',name:'Contract',content:s.states?s.states.join('  /  '):s.type==='slider'?'Track  /  Fill  /  Thumb':s.type==='text'?'Текст остаётся редактируемым':s.type==='popup-ref'?'Пустой контейнер места popup':s.type==='graphic'?'Artwork / собственная графика':'Нативный элемент Extron',fontFamily:'Inter',fontSize:14,fill:'$extron-muted'});
 }
}
Update(kitUniversal,{placeholder:false});
TakeScreenshot([kitUniversal]);
