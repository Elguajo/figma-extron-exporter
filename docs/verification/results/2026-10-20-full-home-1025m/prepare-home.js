// Local Figma Desktop preparation helper. Run with the existing development
// plugin only for authoring, then restore the stock bundle before recognition.
// Creates a separate editable frame; never changes the original Home.
(async () => {
  const source = await figma.getNodeByIdAsync('2:3');
  if (!source || source.name !== 'Home' || source.width !== 1280 || source.height !== 800)
    throw new Error('Original Home changed or missing');
  if (figma.currentPage.children.some(n => n.name === 'HomeExportReady'))
    throw new Error('HomeExportReady already exists; inspect before retry');
  for (const style of ['Regular', 'Bold']) await figma.loadFontAsync({family:'Arial', style});
  for (const t of source.findAll(n => n.type === 'TEXT'))
    for (const s of t.getStyledTextSegments(['fontName'])) await figma.loadFontAsync(s.fontName);
  const solid = hex => ({type:'SOLID', color:{r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255}});
  const bg = '#111315', dark = '#191B1D', orange = '#E16716', yellow = '#FFCC00';
  function frame(parent,name,x,y,w,h,fills=[]) {
    const n=figma.createFrame(); parent.appendChild(n); n.name=name; n.resize(w,h); n.x=x;n.y=y;
    n.fills=fills;n.strokes=[];n.effects=[];n.cornerRadius=0;n.clipsContent=true;return n;
  }
  function text(parent,name,copy,x,y,w,h,size=24,bold=true,fill='#FFFFFF',ha='LEFT',va='CENTER') {
    const n=figma.createText();parent.appendChild(n);n.name=name;n.fontName={family:'Arial',style:bold?'Bold':'Regular'};
    n.fontSize=size;n.characters=copy;n.textAutoResize='NONE';n.resize(w,h);n.x=x;n.y=y;
    n.textAlignHorizontal=ha;n.textAlignVertical=va;n.fills=[solid(fill)];return n;
  }
  function clean(n) { for(const k of ['exui','exui-id-registry'])n.setPluginData(k,''); if('children'in n) for(const c of n.children)clean(c); }
  function copyInto(n,parent,x,y) {const c=n.clone();parent.appendChild(c);clean(c);c.x=x;c.y=y;return c;}
  const root=frame(figma.currentPage,'HomeExportReady',Math.ceil(Math.max(...figma.currentPage.children.map(n=>n.x+n.width)))+200,0,1280,800,[solid(bg)]);
  const report={sourceId:source.id,resultId:root.id,changes:[],nativeFonts:['Arial Regular','Arial Bold'],rasterText:[],boundary:'Authoring adaptation of the actual user Home, no hardware'};
  function one(name){const a=source.children.filter(n=>n.name===name);if(a.length!==1)throw new Error('Ambiguous '+name);return a[0];}
  // Native one-pixel dividers, including vertical rotated source vectors.
  for(const [name,x,y,w,h] of [['Header',0,87,1280,1],['Sidebar',311,87,1,713],['Brand',311,18,1,48],['VolumeSeparator',345,586,906,1]])
    frame(root,'line_'+name,x,y,w,h,[solid('#343538')]);
  for(const [old,name,width] of [['txt_zones','Zones',100],['txt_sound.sources','SoundSources',190],['txt_hall','Hall',120],['txt_hall.volume','HallVolume',300],['AUDIO CONTROL','AudioControl',270],['MAIN PANEL','MainPanel',160]]) {
    const n=one(old);const p=n.fills.find(f=>f.type==='SOLID');const color='#'+[p.color.r,p.color.g,p.color.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
    text(root,'text_'+name,n.characters,Math.round(n.x),Math.round(n.y),Math.min(width,1280-Math.round(n.x)),Math.round(n.height),n.fontSize,n.fontName.style==='Bold',color);
  }
  function button(original,name,side=false) {
    const w=Math.round(original.width),h=Math.round(original.height),x=Math.round(original.x),y=Math.round(original.y);
    const b=frame(root,name,x,y,w,h);const main=original.children.find(n=>n.type==='TEXT'&&n.fontSize===24);
    if(!main)throw new Error('No title '+name);
    for(const stateName of ['Normal','state_Selected','Pressed']) {
      const st=frame(b,stateName,0,0,w,h,[solid(stateName==='Normal'?bg:stateName==='Pressed'?yellow:orange)]);
      if(stateName==='Normal') {
        const icon=frame(st,'Icon',0,0,w,h);
        for(const n of original.children.filter(n=>n!==main)) {
          const a=n.absoluteBoundingBox,o=original.absoluteBoundingBox;
          const c=copyInto(n,icon,a.x-o.x,a.y-o.y);
          if(c.type==='RECTANGLE'){c.resize(w,h);c.x=0;c.y=0;c.strokeAlign='INSIDE';}
          if(c.type==='TEXT') {
            c.fontName={family:'Arial',style:'Regular'};
            if(side){c.y=h-24;c.x=91;c.resize(w-99,20);}
            report.rasterText.push({nodeId:c.id,text:c.characters,reason:side?'Secondary card status':'Channel number'});
          }
        }
      }
      text(st,'Text',main.characters,0,0,w,h,24,true,stateName==='Normal'?'#FFFFFF':'#000000','CENTER',side?'CENTER':'BOTTOM');
      st.visible=stateName==='Normal';
    }
    report.changes.push({sourceId:original.id,resultId:b.id,kind:'button',adaptation:side?'Title centered; secondary status moved to footer inside PNG':'Main title uses native bottom-center; channel caption and source vector remain in PNG',states:'Normal / Selected / Pressed; selected orange, pressed yellow'});
  }
  button(one('button_side.hall'),'button_SideHall',true);
  button(one('button_side.terrace'),'button_SideTerrace',true);
  for(let i=1;i<=8;i++)button(one('button_CH0'+i),'button_CH0'+i);
  // Reuse the proven volume geometry, but create fresh metadata and leave its
  // original copy untouched. Native pressed state uses a yellow solid fill.
  const ready=await figma.getNodeByIdAsync('26:21');
  for(const name of ['button_VolumeDown','button_VolumeUp','slider_Volume','value_VolumeValue','logo_Company']) {
    const old=ready.children.find(n=>n.name===name);const c=copyInto(old,root,old.x,old.y);
    if(name.startsWith('button_')) {
      const st=c.children.find(n=>n.name==='Pressed');for(const icon of st.children.filter(n=>n.type!=='TEXT'))icon.remove();
      st.fills=[solid(yellow)];
    }
  }
  // Mute carries proper persistent Off/On feedback, plus momentary Pressed.
  const mute=one('button_Mute'),b=frame(root,'button_Mute',1033,686,218,68);
  for(const stateName of ['Off','On','Pressed']) {
    const st=frame(b,stateName,0,0,218,68,[solid(stateName==='Pressed'?yellow:bg)]);
    if(stateName!=='Pressed') {
      const old=mute.children.find(n=>n.name===stateName.toLowerCase());const icon=frame(st,'Icon',0,0,218,68);
      for(const n of old.children.filter(n=>n.type!=='TEXT')) {
        const a=n.absoluteBoundingBox,o=old.absoluteBoundingBox;copyInto(n,icon,a.x-o.x,a.y-o.y);
      }
    }
    text(st,'Text','Mute',0,0,218,68,24,true,stateName==='Pressed'?'#000000':'#FFFFFF','CENTER');st.visible=stateName==='Off';
  }
  report.changes.push({sourceId:mute.id,resultId:b.id,kind:'mute',adaptation:'Off/On/Pressed; native centered title, source speaker vector retained in Off/On; default Off'});
  const descendants=root.findAll(()=>true),counts={};for(const n of descendants)counts[n.type]=(counts[n.type]??0)+1;
  report.elementCount=root.children.length;report.descendantCounts=counts;
  report.fonts=[...new Set(descendants.filter(n=>n.type==='TEXT').map(n=>n.fontName.family+' '+n.fontName.style))];
  figma.currentPage.selection=[root];figma.viewport.scrollAndZoomIntoView([root]);
  figma.showUI('<html><body><h2>Actual Home prepared</h2><textarea aria-label="Home preparation report" readonly style="width:100%;height:500px">'+JSON.stringify(report,null,2).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</textarea></body></html>',{width:700,height:600});
})().catch(e=>{figma.notify(String(e),{error:true});figma.closePlugin(String(e));});
