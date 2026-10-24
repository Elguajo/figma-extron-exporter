{
const colors={"canvas":"#F5F5F7","surface":"#FFFFFF","ink":"#1D1D1F","muted":"#65656B","line":"#D2D2D7","track":"#D8D8DE","control":"#E8E8ED","accent":"#0066CC","active":"#0066CC","pressed":"#004C99","onAccent":"#FFFFFF","success":"#247344","danger":"#B42318"};
const vars={};for(const [key,value]of Object.entries(colors))vars['extron-'+key]={type:'color',value};SetVariables(vars);
const userFrame=JSON.stringify(Get('bi8Au',{depth:100}));
for(const root of ['MeFgF','bBKBy']) {
 Update(root,{placeholder:true});
 Get(root,(n,c)=>{
  if(n.type==='frame'&&n.name?.startsWith('Guide / '))Update(n.id,{cornerRadius:24});
  if(!n.reusable)return;
  if(/^(button|feedbackbutton)_/.test(n.name)){
   const master=Get(n.id,{depth:3});
   for(const [index,state]of master.children.entries()){
    const pressed=state.name==='Pressed',fill=index===0?'$extron-control':pressed?'$extron-pressed':'$extron-active';
    Update(state.id,{fill,cornerRadius:16,clip:true});
    Get(state.id,t=>{if(t.type==='text')Update(t.id,{fontFamily:'Inter',fontSize:20,fontWeight:'bold',fill:index===0?'$extron-ink':'$extron-onAccent'});});
    if(state.name==='On'||state.name==='Active'){
     const art=state.children[0];if(!Get(art.id,{depth:1}).children.some(n=>n.name==='Selection mark'))Insert(art.id,{type:'ellipse',name:'Selection mark',x:194,y:29,width:6,height:6,fill:'$extron-onAccent'});
    }
   }
  } else if(n.name.startsWith('slider_')){
   const parts=Get(n.id,{depth:1}).children;
   for(const p of parts)if(p.name==='Track'||p.name==='Fill')Update(p.id,{height:8,y:16,cornerRadius:4,fill:p.name==='Track'?'$extron-track':'$extron-accent'});else if(p.name==='Thumb')Update(p.id,{width:28,height:28,x:112,y:6,fill:'$extron-accent'});
  } else if(n.name==='shape_Shape')Update(n.id,{fill:'$extron-control',cornerRadius:16,stroke:'$extron-line',strokeWidth:1,strokeAlignment:'inner'});
  else if(n.name==='line_Line')Update(n.id,{height:1,fill:'$extron-line'});
  else if(/^(level|gauge|indicator|volumeled)_/.test(n.name))Update(n.id,{fill:'$extron-accent'});
  else if(n.name.startsWith('text_')||n.name.startsWith('value_'))Get(n.id,t=>{if(t.type==='text')Update(t.id,{fontFamily:'Inter',fontSize:n.name.startsWith('value_')?28:20,fill:'$extron-ink'});});
  else if(/^(image|logo)_/.test(n.name)){Update(n.id,{fill:'$extron-control',cornerRadius:0});Get(n.id,t=>{if(t.type==='text')Update(t.id,{fontFamily:'Inter',fontSize:20,fill:'$extron-muted'});});}
 });
 Update(root,{placeholder:false});
}
Update('qn7gm',{placeholder:true,fill:'$extron-canvas'});
Update('eTvQn',{content:'TRILLIANT  /  APPLE-INSPIRED LIGHT  /  2026-10-24',fill:'$extron-accent'});
Update('XKAd3',{content:'Extron Kit',fontSize:48,fill:'$extron-ink'});
Update('NNa2L',{content:'Один визуальный язык для всей панели. Компоненты, состояния и шаблоны.\nБерите экземпляры, меняйте Artwork и сохраняйте служебные имена.',fill:'$extron-muted'});
Update('no19L',{content:'Inter · нейтральные поверхности · синий акцент · нативные элементы Extron',fill:'$extron-accent'});
Update('qn7gm',{placeholder:false});
Update('S9VIn',{placeholder:true});
Get('S9VIn',n=>{if(n.type==='frame'&&n.name?.startsWith('Guide / '))Update(n.id,{cornerRadius:24});});
Update('j715yu',{metadata:{type:'extron-kit',revision:'2026-10-24-apple',pattern:'MMMM d, h:mm tt'}});
Update('fC2Dn',{fontFamily:'Inter',fontSize:20,fill:'$extron-ink'});
Update('lZboF',{content:'Apple-inspired Light · Inter · 28 форматов. Связанные примеры одного datetime_Clock.\nВ Figma генератор создаёт набор вариантов Format; на панели показываются текущие дата и время.'});
Update('S9VIn',{placeholder:false});
Update('Z6SbEX',{placeholder:true});
Update('wgJzx',{content:'Шаблоны проекта',fontSize:32});
Update('RbKKi',{content:'Страницы, popup и подтверждение в едином светлом стиле. Сохраняйте имена контейнеров; содержимое редактируется внутри.'});
Update('Z6SbEX',{placeholder:false});
if(JSON.stringify(Get('bi8Au',{depth:100}))!==userFrame)throw new Error('User frame changed');
Print('Styled all 30 control families; user frame preserved');TakeScreenshot(['MeFgF','bBKBy']);
}
{
const userFrame=JSON.stringify(Get('bi8Au',{depth:100}));
const byName=(parent,name)=>(Get(parent,{depth:1}).children??[]).find(n=>n.name===name);
const textAt=(parent,name,copy,x,y,w,h,size=20,weight='normal',fill='$extron-ink')=>{
 let n=byName(parent,name);
 if(n?.type==='text'){Update(n.id,{content:copy,x,y,width:w,height:h,textGrowth:'fixed-width-height',fontFamily:'Inter',fontSize:size,fontWeight:weight,fill});return n.id;}
 if(!n){const master=name.startsWith('value_')?'mNQpm':name.startsWith('datetime_')?'j715yu':'OGNLl';const id=Insert(parent,{type:'ref',ref:master,name,x,y,width:w,height:h});n=Get(id,{depth:0});}
 Update(n.id,{x,y,width:w,height:h});
 const content=Get(n.ref,{depth:1}).children[0];Update(n.id+'/'+content.id,{content:copy,width:w,height:h,fontFamily:'Inter',fontSize:size,fontWeight:weight,fill});
 return n.id;
};
const surfaceAt=(parent,name,x,y,w,h)=>{let n=byName(parent,name);const props={name,x,y,width:w,height:h,fill:'$extron-surface',cornerRadius:24,layout:'none'};if(n)Update(n.id,props);else n={id:Insert(parent,{type:'frame',...props})};Move(n.id,parent,0);return n.id;};
const buttonAt=(parent,name,ref,x,y,w=220,h=64,selected=false,copy)=>{
 let n=byName(parent,name);if(!n)n={id:Insert(parent,{type:'ref',ref,name,x,y,width:w,height:h})};Update(n.id,{x,y,width:w,height:h});
 const master=Get(ref,{depth:3});
 for(const state of master.children){
  Update(n.id+'/'+state.id,{width:w,height:h,enabled:selected?state.name==='Active':state.name==='Normal'||state.name==='Off'});
  for(const art of state.children){Update(n.id+'/'+art.id,{width:w,height:h});for(const child of art.children){
   if(child.name==='Selection mark')Update(n.id+'/'+child.id,{x:w-26,y:h/2-3});
   else if(child.type==='text')Update(n.id+'/'+child.id,{width:w,height:h,...(copy?{content:copy}:{})});
  }}
 }
 return n.id;
};
const sliderAt=(parent,name,x,y,w)=>{
 let n=byName(parent,name);if(!n)n={id:Insert(parent,{type:'ref',ref:'oySRe',name,x,y,width:w,height:40})};Update(n.id,{x,y,width:w,height:40});
 for(const p of Get('oySRe',{depth:1}).children){const props=p.name==='Track'?{width:w,height:8,x:0,y:16}:p.name==='Fill'?{width:Math.round(w*.42),height:8,x:0,y:16}:{width:28,height:28,x:Math.round(w*.42)-14,y:6};Update(n.id+'/'+p.id,props);}
 return n.id;
};
Update('MeFgF',{placeholder:true});
for(const [index,state]of Get('UflJj',{depth:3}).children.entries()){
 Update(state.id,{fill:index===0?'$extron-control':index===1?'$extron-success':'$extron-danger'});
 Get(state.id,n=>{if(n.type==='text')Update(n.id,{content:index===0?'Normal':index===1?'Ready':'Error',fill:index===0?'$extron-ink':'$extron-onAccent'});});
}
Update('MeFgF',{placeholder:false});
Update('T78n4',{placeholder:true});
surfaceAt('T78n4','shape_SourceSurface',48,160,752,224);surfaceAt('T78n4','shape_ZoneSurface',832,160,400,224);surfaceAt('T78n4','shape_AudioSurface',48,416,1184,288);
textAt('T78n4','text_Title','Hall / AV Control',48,32,640,56,36,'bold');
textAt('T78n4','text_Subtitle','Audio & video',48,88,440,32,20,'normal','$extron-muted');
textAt('T78n4','text_SourceTitle','Source',80,184,440,32,20,'bold');textAt('T78n4','text_ZoneTitle','Zone',864,184,300,32,20,'bold');
buttonAt('T78n4','feedbackbutton_Music','C9wM5R',80,248,220,64,true);
buttonAt('T78n4','feedbackbutton_HDMI','q7Gq85',316,248);
buttonAt('T78n4','feedbackbutton_Wireless','APA5k',552,248);
buttonAt('T78n4','feedbackbutton_Hall','Evm6L',864,248,220,64,true);
textAt('T78n4','text_VolumeTitle','Volume',80,448,440,40,24,'bold');
const value=textAt('T78n4','value_VolumeValue','42%',1056,440,136,56,36);const valueChild=Get('mNQpm',{depth:1}).children[0];Update(value+'/'+valueChild.id,{textAlign:'right'});
buttonAt('T78n4','feedbackbutton_Mute','wo8mX',80,556);
buttonAt('T78n4','button_VolumeDown','W05L5',348,556,64);
sliderAt('T78n4','slider_Volume',440,568,660);
buttonAt('T78n4','button_VolumeUp','S3Ppfz',1128,556,64);
textAt('T78n4','text_Footer','TRILLIANT / Room control',48,736,600,24,14,'normal','$extron-muted');
const logo=byName('T78n4','logo_Company');if(logo)Delete(logo.id);
const clock=textAt('T78n4','datetime_Clock','September 28, 12:00 AM',792,40,440,40,18,'normal','$extron-muted');Update(clock+'/'+Get('j715yu',{depth:1}).children[0].id,{textAlign:'right'});
Update('T78n4',{placeholder:false});
Update('EWlyr',{placeholder:true});
textAt('EWlyr','text_Title','Room control',24,16,272,40,28,'bold');
textAt('EWlyr','text_SourceTitle','Source',24,112,272,24,16,'normal','$extron-muted');
buttonAt('EWlyr','feedbackbutton_Music','C9wM5R',24,144,272,64,true);
buttonAt('EWlyr','feedbackbutton_Mute','wo8mX',24,224,272,56);
textAt('EWlyr','text_VolumeTitle','Volume',24,304,160,40,20,'bold');
const mobileValue=textAt('EWlyr','value_VolumeValue','42%',200,304,96,40,28);Update(mobileValue+'/'+valueChild.id,{textAlign:'right'});
buttonAt('EWlyr','button_VolumeDown','W05L5',24,364,56,56);sliderAt('EWlyr','slider_Volume',96,372,128);buttonAt('EWlyr','button_VolumeUp','S3Ppfz',240,364,56,56);
textAt('EWlyr','datetime_Clock','September 28, 12:00 AM',24,64,272,32,16,'normal','$extron-muted');
Update('EWlyr',{placeholder:false});
for(const root of ['xlIx6','vpu7E','ytfxf','ZITQn','seREG'])Update(root,{placeholder:true});
Update('xlIx6',{fill:'$extron-track'});Update('M22Wl',{fill:'$extron-canvas'});
Update('vpu7E',{width:280,height:160,fill:'$extron-surface'});textAt('vpu7E','text_PopupTitle','Volume',24,24,232,32,20,'bold');textAt('vpu7E','value_PopupVolume','42%',24,80,232,48,32);
for(const [id,name]of [['mEWhw','Hall'],['dBMA8','Terrace']]){Update(id,{fill:'$extron-surface'});textAt(id,'text_ZoneTitle',name,24,24,272,40,24,'bold');}
surfaceAt('ZITQn','shape_ConfirmSurface',416,280,448,240);
textAt('ZITQn','text_ConfirmTitle','Apply changes?',440,304,400,40,24,'bold');
textAt('ZITQn','text_ConfirmBody','Your room settings will be updated.',440,352,400,56,18,'normal','$extron-muted');
buttonAt('ZITQn','button_Cancel','QuGXr',440,440,188,56,false,'Cancel');const confirm=buttonAt('ZITQn','button_Confirm','QuGXr',652,440,188,56,false,'Confirm');const normal=Get('QuGXr',{depth:3}).children[0];Update(confirm+'/'+normal.id,{fill:'$extron-accent'});Get(normal.id,n=>{if(n.type==='text')Update(confirm+'/'+n.id,{fill:'$extron-onAccent'});});
textAt('seREG','text_Title','Settings',24,24,440,40,28,'bold');
for(const root of ['xlIx6','vpu7E','ytfxf','ZITQn','seREG'])Update(root,{placeholder:false});
if(JSON.stringify(Get('bi8Au',{depth:100}))!==userFrame)throw new Error('User frame changed');
Print('Both screen profiles and all templates restyled');TakeScreenshot(['T78n4','EWlyr','ZITQn']);
}
{
const existing=Get(n=>n.name==='Extron Kit / States and foundations'?n.id:undefined);
if(!existing.length){
const pos=FindEmptySpace({width:1560,height:1300,nodeId:'S9VIn',direction:'bottom',padding:120});
const board=Insert(document,{type:'frame',name:'Extron Kit / States and foundations',x:pos.x,y:pos.y,width:1560,height:'fit_content',layout:'vertical',padding:40,gap:24,fill:'$extron-canvas',placeholder:true});
Insert(board,{type:'text',name:'Section title',content:'Состояния и визуальная основа',fontFamily:'Inter',fontSize:32,fontWeight:'bold',fill:'$extron-ink'});
Insert(board,{type:'text',name:'Section description',content:'Apple-inspired Light · состояния видны рядом. Синий — выбор или основное действие; более тёмный синий — нажатие.',fontFamily:'Inter',fontSize:17,fill:'$extron-muted',textGrowth:'fixed-width',width:'fill_container'});
const families=[{name:'Выбор · button_Button',ref:'C3OidC',states:['Off','On'],note:'On задаёт программа управления.'},{name:'Нажатие · button_VolumeUp',ref:'S3Ppfz',states:['Normal','Pressed'],note:'Pressed показывается во время удержания.'},{name:'Feedback · feedbackbutton_Feedback',ref:'AXc1X',states:['Normal','Active','Pressed'],note:'Active и Pressed — разные состояния.'}];
for(const family of families){
 const row=Insert(board,{type:'frame',name:'State family / '+family.ref,width:'fill_container',height:208,layout:'none',fill:'$extron-surface',cornerRadius:24});
 Insert(row,{type:'text',name:'Family title',content:family.name,x:24,y:24,fontFamily:'Inter',fontSize:18,fontWeight:'bold',fill:'$extron-ink'});
 for(const [index,name]of family.states.entries()){
  const overrides={};for(const state of Get(family.ref,{depth:1}).children)overrides[state.id]={enabled:state.name===name};
  Insert(row,{type:'ref',ref:family.ref,name:'Preview / '+name,x:24+index*300,y:72,descendants:overrides});
  Insert(row,{type:'text',name:'State caption',content:name,x:24+index*300,y:152,fontFamily:'Inter',fontSize:14,fill:'$extron-muted'});
 }
 Insert(row,{type:'text',name:'State note',content:family.note,x:960,y:80,width:440,textGrowth:'fixed-width',fontFamily:'Inter',fontSize:18,fill:'$extron-muted'});
}
const swatches=Insert(board,{type:'frame',name:'Semantic palette',width:'fill_container',height:128,layout:'horizontal',gap:16});
const tokens=[['Canvas','#F5F5F7'],['Surface','#FFFFFF'],['Text','#1D1D1F'],['Secondary','#65656B'],['Accent','#0066CC'],['Pressed','#004C99']];
for(const [name,hex]of tokens){const cell=Insert(swatches,{type:'frame',name:'Token / '+name,width:'fill_container',height:128,layout:'vertical',padding:16,gap:10,fill:'$extron-surface',cornerRadius:16});Insert(cell,{type:'frame',name:'Swatch',width:32,height:32,fill:hex,cornerRadius:8});Insert(cell,{type:'text',name:'Token name',content:name,fontFamily:'Inter',fontSize:14,fontWeight:'bold',fill:'$extron-ink'});Insert(cell,{type:'text',name:'Token value',content:hex,fontFamily:'Inter',fontSize:14,fill:'$extron-muted'});}
Update(board,{placeholder:false});
Print('States board',board);TakeScreenshot([board]);
}
}
