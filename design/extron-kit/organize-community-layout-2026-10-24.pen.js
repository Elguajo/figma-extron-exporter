const userFrame=JSON.stringify(Get('bi8Au',{depth:100}));
const find=name=>Get(n=>n.name===name?n.id:undefined)[0];
const dims=id=>Get(id,(n,c)=>c.depth===0?c.bounds:undefined)[0];
const root=(name,x,y,w,h)=>{const id=find(name)||Insert(document,{type:'frame',name,x,y,width:w,height:h,layout:'none',fill:'$extron-canvas',placeholder:true});Update(id,{x,y,width:w,height:h,placeholder:true});return id;};
const heading=(parent,name,title,sub)=>{if(!find(name)){Insert(parent,{type:'text',name,content:title,x:48,y:32,fontFamily:'Inter',fontSize:56,fontWeight:'bold',fill:'$extron-ink'});Insert(parent,{type:'text',name:name+' / Description',content:sub,x:48,y:112,width:1464,textGrowth:'fixed-width',fontFamily:'Inter',fontSize:24,fill:'$extron-muted'});}};
const library=root('Extron Kit / Library',920,0,5160,3720);
Move('qn7gm',library);Update('qn7gm',{x:0,y:0,width:5160,height:600,padding:48,gap:24,cornerRadius:24,placeholder:true});
Update('eTvQn',{fontSize:20,content:'TRILLIANT / APPLE-INSPIRED LIGHT / EXTRON KIT'});
Update('XKAd3',{fontSize:80,content:'Extron Kit'});
Update('NNa2L',{fontSize:26,content:'Библиотека для AV-панелей Extron: от компонента до готового экрана.\nСначала выберите элемент, затем разместите экземпляр на странице проекта.'});
Update('no19L',{fontSize:20,content:'30 семейств · 28 форматов даты и времени · 1280 × 800 / 320 × 480'});
if(!find('Library / Contents')){
 const nav=Insert('qn7gm',{type:'frame',name:'Library / Contents',width:'fill_container',height:112,layout:'horizontal',gap:16});
 for(const [number,title,body]of [['01','Основы и состояния','Цвет, типографика, feedback'],['02','Компоненты','Базовые элементы и AV-пресеты'],['03','Дата и время','28 форматов Pattern'],['04','Шаблоны Extron','Project, screen, popup, group'],['05','Готовые экраны','1025M и 300M']]){
  const cell=Insert(nav,{type:'frame',name:'Contents / '+number,width:'fill_container',height:112,layout:'vertical',padding:20,gap:8,fill:'$extron-control',cornerRadius:16});
  Insert(cell,{type:'text',name:'Chapter title',content:number+' / '+title,fontFamily:'Inter',fontSize:24,fontWeight:'bold',fill:'$extron-ink'});
  Insert(cell,{type:'text',name:'Chapter summary',content:body,fontFamily:'Inter',fontSize:20,fill:'$extron-muted'});
 }
}
Update('qn7gm',{placeholder:false});
const basic=find('01 / Основы и состояния')||Insert(library,{type:'frame',name:'01 / Основы и состояния',x:0,y:840,width:1560,height:2160,layout:'none',fill:'$extron-canvas',placeholder:true});
heading(basic,'Library / Foundations heading','01 / Основы','Визуальные правила и состояния. С них начинается работа с китом.');
if(!find('Library / Typography')){
 const card=Insert(basic,{type:'frame',name:'Library / Typography',x:0,y:208,width:1560,height:600,layout:'none',fill:'$extron-surface',cornerRadius:24});
 Insert(card,{type:'text',name:'Typeface',content:'Inter',x:48,y:40,fontFamily:'Inter',fontSize:64,fontWeight:'bold',fill:'$extron-ink'});
 Insert(card,{type:'text',name:'Typeface description',content:'Regular / Bold · нативный текст Extron',x:480,y:64,fontFamily:'Inter',fontSize:24,fill:'$extron-muted'});
 Insert(card,{type:'frame',name:'Divider',x:48,y:152,width:1464,height:1,fill:'$extron-line',layout:'none'});
 for(const [y,copy,size,role]of [[192,'Room control',36,'Заголовок / 36 px'],[280,'42%',28,'Значение / 28 px'],[360,'Music',20,'Элемент управления / 20 px'],[432,'September 28, 12:00 AM',14,'Вспомогательный текст / 14 px']]){
  Insert(card,{type:'text',name:'Type sample / '+size,content:copy,x:48,y,width:900,height:64,textGrowth:'fixed-width-height',fontFamily:'Inter',fontSize:size,fontWeight:size===36?'bold':'normal',fill:'$extron-ink'});
  Insert(card,{type:'text',name:'Type role / '+size,content:role,x:1040,y:y+16,fontFamily:'Inter',fontSize:20,fill:'$extron-muted'});
 }
 Insert(card,{type:'text',name:'Geometry summary',content:'16 px углы кнопок · 24 px поверхности · 8 px дорожка · 28 px бегунок',x:48,y:536,fontFamily:'Inter',fontSize:22,fill:'$extron-muted'});
}
Move('NUGgl',basic);Update('NUGgl',{x:0,y:928});Update(basic,{height:928+dims('NUGgl').height+64,placeholder:false});
const controls=find('02 / Компоненты и AV-пресеты')||Insert(library,{type:'frame',name:'02 / Компоненты и AV-пресеты',x:1800,y:840,width:1560,height:2828,layout:'none',fill:'$extron-canvas',placeholder:true});
heading(controls,'Library / Components heading','02 / Компоненты','Сначала базовый тип; готовые AV-пресеты — ниже.');
Move('MeFgF',controls);Update('MeFgF',{x:0,y:208});Move('bBKBy',controls);Update('bBKBy',{x:0,y:1752});Update(controls,{height:2856,placeholder:false});
Update('ZfybY',{content:'Базовые компоненты'});Update('d86Zt',{content:'Готовые AV-пресеты'});
const date=find('03 / Дата и время')||Insert(library,{type:'frame',name:'03 / Дата и время',x:3600,y:840,width:1560,height:2032,layout:'none',fill:'$extron-canvas',placeholder:true});
heading(date,'Library / DateTime heading','03 / Дата и время','Выберите Format в Figma. На панели показываются текущие дата и время.');
Move('S9VIn',date);Update('S9VIn',{x:0,y:208});Update(date,{height:208+dims('S9VIn').height+64,placeholder:false});
Update(library,{height:3760,placeholder:false});
const templates=root('Extron Kit / 04 — Шаблоны',920,4000,3360,2784);
heading(templates,'Library / Templates heading','04 / Шаблоны Extron','Рабочие фреймы в натуральном размере. Выбирайте сам project_ или screen_ для экспорта.');
Move('Z6SbEX',templates);Update('Z6SbEX',{x:0,y:208,width:3360,height:400,padding:32,gap:16});
Move('xlIx6',templates);Update('xlIx6',{x:48,y:704});
Move('ZITQn',templates);Update('ZITQn',{x:1720,y:704});
Move('seREG',templates);Update('seREG',{x:48,y:1856});
Move('vpu7E',templates);Update('vpu7E',{x:1720,y:1856});
Move('ytfxf',templates);Update('ytfxf',{x:2140,y:1856});
for(const [name,copy,x,y]of [['Project','Project / контейнер проекта',48,640],['Modal','Modal / подтверждение',1720,640],['Settings','Screen / страница',48,1792],['Popup','Popup',1720,1792],['Group','Popup group / зоны',2140,1792]])if(!find('Template label / '+name))Insert(templates,{type:'text',name:'Template label / '+name,content:copy,x,y,fontFamily:'Inter',fontSize:28,fontWeight:'bold',fill:'$extron-ink'});
Update(templates,{placeholder:false});
const examples=root('Extron Kit / 05 — Готовые экраны',4520,4000,1560,1880);
heading(examples,'Library / Examples heading','05 / Готовые экраны','Собраны из экземпляров кита. Можно использовать как отправную точку.');
Move('T78n4',examples);Update('T78n4',{x:48,y:272});Move('EWlyr',examples);Update('EWlyr',{x:48,y:1328});
for(const [name,copy,y]of [['1025M','TLP Pro 1025M / 1280 × 800',208],['300M','TLP Pro 300M / 320 × 480',1264]])if(!find('Example label / '+name))Insert(examples,{type:'text',name:'Example label / '+name,content:copy,x:48,y,fontFamily:'Inter',fontSize:28,fontWeight:'bold',fill:'$extron-ink'});
if(!find('Example / Notes'))Insert(examples,{type:'text',name:'Example / Notes',content:'ИСТОЧНИК → ГРОМКОСТЬ\n\nСиний — выбранный источник.\nVolume + / − — Normal / Pressed.\nSlider и Value остаются нативными.\n\nAV-команды и feedback подключаются\nв программе управления Extron.',x:464,y:1360,width:1000,textGrowth:'fixed-width',fontFamily:'Inter',fontSize:24,lineHeight:1.5,fill:'$extron-muted'});
Update(examples,{placeholder:false});
if(JSON.stringify(Get('bi8Au',{depth:100}))!==userFrame)throw new Error('User frame changed');
Print('Library',library,'templates',templates,'examples',examples);
TakeScreenshot([library,templates,examples]);
