const formats=[{"name":"Month day time 12h","pattern":"MMMM d, h:mm tt","group":"Date & time","guiDesigner":false,"preview":"September 28, 12:00 AM"},{"name":"Weekday date time 12h","pattern":"dddd, MMMM dd, yyyy h:mm tt","group":"Date & time","guiDesigner":true,"preview":"Monday, September 28, 2026 12:00 AM"},{"name":"Weekday date time 12h seconds","pattern":"dddd, MMMM dd, yyyy h:mm:ss tt","group":"Date & time","guiDesigner":true,"preview":"Monday, September 28, 2026 12:00:00 AM"},{"name":"Weekday date time 24h seconds","pattern":"dddd, dd MMMM yyyy HH:mm:ss","group":"Date & time","guiDesigner":true,"preview":"Monday, 28 September 2026 00:00:00"},{"name":"US date time 12h","pattern":"M/d/yyyy h:mm tt","group":"Date & time","guiDesigner":true,"preview":"9/28/2026 12:00 AM"},{"name":"US date time 12h seconds","pattern":"M/d/yyyy h:mm:ss tt","group":"Date & time","guiDesigner":true,"preview":"9/28/2026 12:00:00 AM"},{"name":"Dotted date time 24h","pattern":"dd.MM.yyyy HH:mm","group":"Date & time","guiDesigner":false,"preview":"28.09.2026 00:00"},{"name":"Time 12h","pattern":"h:mm tt","group":"Time","guiDesigner":true,"preview":"12:00 AM"},{"name":"Time 12h padded","pattern":"hh:mm tt","group":"Time","guiDesigner":true,"preview":"12:00 AM"},{"name":"Time 24h","pattern":"H:mm","group":"Time","guiDesigner":true,"preview":"0:00"},{"name":"Time 24h padded","pattern":"HH:mm","group":"Time","guiDesigner":true,"preview":"00:00"},{"name":"Time 12h seconds","pattern":"h:mm:ss tt","group":"Time","guiDesigner":true,"preview":"12:00:00 AM"},{"name":"Time 12h seconds padded","pattern":"hh:mm:ss tt","group":"Time","guiDesigner":true,"preview":"12:00:00 AM"},{"name":"Time 24h seconds","pattern":"H:mm:ss","group":"Time","guiDesigner":true,"preview":"0:00:00"},{"name":"Time 24h seconds padded","pattern":"HH:mm:ss","group":"Time","guiDesigner":true,"preview":"00:00:00"},{"name":"Weekday month day year","pattern":"dddd, MMMM dd, yyyy","group":"Date","guiDesigner":true,"preview":"Monday, September 28, 2026"},{"name":"Month day year","pattern":"MMMM dd, yyyy","group":"Date","guiDesigner":true,"preview":"September 28, 2026"},{"name":"Weekday day month year","pattern":"dddd, dd MMMM, yyyy","group":"Date","guiDesigner":true,"preview":"Monday, 28 September, 2026"},{"name":"Day month year","pattern":"dd MMMM, yyyy","group":"Date","guiDesigner":true,"preview":"28 September, 2026"},{"name":"Weekday month day","pattern":"dddd, MMMM d","group":"Date","guiDesigner":false,"preview":"Monday, September 28"},{"name":"US date","pattern":"M/d/yyyy","group":"Date","guiDesigner":true,"preview":"9/28/2026"},{"name":"US date short year","pattern":"M/d/yy","group":"Date","guiDesigner":true,"preview":"9/28/26"},{"name":"US date padded","pattern":"MM/dd/yyyy","group":"Date","guiDesigner":true,"preview":"09/28/2026"},{"name":"US date padded short year","pattern":"MM/dd/yy","group":"Date","guiDesigner":true,"preview":"09/28/26"},{"name":"Year month day short","pattern":"yy/MM/dd","group":"Date","guiDesigner":true,"preview":"26/09/28"},{"name":"ISO date","pattern":"yyyy-MM-dd","group":"Date","guiDesigner":true,"preview":"2026-09-28"},{"name":"Day month abbreviation year","pattern":"dd-MMM-yy","group":"Date","guiDesigner":true,"preview":"28-Sep-26"},{"name":"Dotted date","pattern":"dd.MM.yyyy","group":"Date","guiDesigner":false,"preview":"28.09.2026"}];
const userFrame=JSON.stringify(Get('bi8Au',{depth:100}));
Update('bBKBy',{placeholder:true});
const names=['button_VolumeUp','button_VolumeDown','button_Back','button_Home','button_Settings'];
Get('bBKBy',n=>{
 if(!n.reusable||!names.includes(n.name))return;
 const control=Get(n.id,{depth:3});
 if(control.children.length!==2)throw new Error('Unexpected states: '+n.name);
 for(const [i,state]of control.children.entries()){
  Update(state.id,{name:i?'Pressed':'Normal',fill:i?'$extron-pressed':'$extron-track',enabled:i===0});
  Get(state.id,t=>{if(t.type==='text')Update(t.id,{fill:i?'#FFFFFF':'$extron-ink'});});
 }
 Print(n.name,Get(n.id,{depth:1}).children.map(s=>s.name));
});
Update('jlisn',{content:'Ревизия 2026-10-24. Volume +/− и Back/Home/Settings: Normal / Pressed. Feedback: Normal / Active / Pressed.'});
Update('bBKBy',{placeholder:false});
Update('qn7gm',{placeholder:true});
Update('eTvQn',{content:'TRILLIANT  /  EXTRON KIT  /  РЕВИЗИЯ 2026-10-24'});
Update('NNa2L',{content:'Экземпляр → оформление Artwork → экран или проект → Скачать .exui.\nVolume +/− и навигация: Normal / Pressed. Выбор с feedback: Off / On.'});
Update('no19L',{content:'Новый кит в Figma: локальный плагин 0.7.3 → Создать Extron Kit. Уже созданные библиотеки не обновляются автоматически.'});
Update('qn7gm',{placeholder:false});
Update('MeFgF',{placeholder:true});
Update('j715yu',{width:440,height:40,metadata:{type:'extron-kit',revision:'2026-10-24',pattern:formats[0].pattern}});
Update('fC2Dn',{width:440,height:40,fontSize:20,content:formats[0].preview});
Update('vA2L6',{content:'Format в Figma: 28 вариантов / раздел 03'});
Update('MeFgF',{placeholder:false});
const existing=Get(n=>n.name==='Extron Kit / Date and time formats'?n.id:undefined);
if(existing.length>1)throw new Error('Multiple format galleries');
if(!existing.length){
 const pos=FindEmptySpace({width:1560,height:2000,padding:120,direction:'right',nodeId:'MeFgF'});
 const gallery=Insert(document,{type:'frame',name:'Extron Kit / Date and time formats',x:pos.x,y:pos.y,width:1560,height:'fit_content',layout:'vertical',padding:40,gap:24,fill:'$extron-canvas',placeholder:true,metadata:{type:'extron-kit',revision:'2026-10-24'}});
 Insert(gallery,{type:'text',name:'Section title',content:'03 / Дата и время · 28 форматов',fontFamily:'Inter',fontSize:30,fontWeight:'bold',fill:'$extron-ink'});
 Insert(gallery,{type:'text',name:'Section description',content:'Ревизия 2026-10-24. Здесь — связанные примеры одного datetime_Clock. В Figma генератор создаёт набор вариантов Format.\nТекст показывает пример; панель — текущие дату и время. Pattern сохраняет формат Extron.',textGrowth:'fixed-width',width:'fill_container',fontFamily:'Inter',fontSize:17,lineHeight:1.3,fill:'$extron-muted'});
 for(let i=0;i<formats.length;i+=3){
  const row=Insert(gallery,{type:'frame',name:'Formats row '+(i/3+1),width:'fill_container',height:132,layout:'horizontal',gap:20});
  for(let column=0;column<3;column++){
   const f=formats[i+column];
   const cell=Insert(row,{type:'frame',name:f?'Guide / '+f.name:'Empty format cell '+column,width:'fill_container',height:132,layout:'vertical',padding:16,gap:8,...(f?{fill:'$extron-surface',cornerRadius:10}:{})});
   if(!f)continue;
   Insert(cell,{type:'text',name:'Format name',content:f.name,textGrowth:'fixed-width',width:'fill_container',fontFamily:'Inter',fontSize:14,fontWeight:'bold',fill:'$extron-ink'});
   Insert(cell,{type:'text',name:'Pattern',content:f.pattern,textGrowth:'fixed-width',width:'fill_container',fontFamily:'Inter',fontSize:14,fill:'$extron-muted'});
   Insert(cell,{type:'ref',name:'datetime_Clock / '+f.name,ref:'j715yu',width:440,height:40,metadata:{type:'extron-kit',pattern:f.pattern},descendants:{fC2Dn:{content:f.preview}}});
  }
 }
 Update(gallery,{placeholder:false});
 Print('Created formats gallery',gallery);
}
if(JSON.stringify(Get('bi8Au',{depth:100}))!==userFrame)throw new Error('User frame changed');
Print('User frame preserved');
TakeScreenshot(['qn7gm','bBKBy']);
