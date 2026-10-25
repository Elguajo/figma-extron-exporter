// Local authoring helper, run once in the existing Figma development plugin.
// Keeps both original Home and the previous verified HomeExportReady intact.
(async()=>{
  const src=await figma.getNodeByIdAsync('2:3'),base=await figma.getNodeByIdAsync('34:70');
  if(!src||!base||base.name!=='HomeExportReady')throw new Error('Expected actual source and verified copy');
  if(figma.currentPage.children.some(n=>n.name==='HomeLayoutReady'))throw new Error('HomeLayoutReady exists; inspect before retry');
  for(const r of [src,base])for(const t of r.findAll(n=>n.type==='TEXT'))for(const s of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(s.fontName);
  const root=base.clone();figma.currentPage.appendChild(root);root.name='HomeLayoutReady';root.x=Math.ceil(Math.max(...figma.currentPage.children.filter(n=>n!==root).map(n=>n.x+n.width)))+200;root.y=0;
  function rebind(n){for(const k of ['exui','exui-id-registry']){const raw=n.getPluginData(k);if(raw){const m=JSON.parse(raw);m.ownerNodeId=n.id;if(m.key)m.key=m.key.replace(/homeexportready/g,'homelayoutready');if(m.projectName)m.projectName=root.name;n.setPluginData(k,JSON.stringify(m));}}if('children'in n)for(const c of n.children)rebind(c);}
  rebind(root);
  const report={sourceId:src.id,previousId:base.id,resultId:root.id,overlays:[],buttons:[],boundary:'Independent native labels over native buttons; touch behavior not verified'};
  const sb=src.absoluteBoundingBox;
  function overlay(t,name,kind='label',parentOffset={x:0,y:0}){
    const a=t.absoluteBoundingBox;const n=t.clone();root.appendChild(n);n.setPluginData('exui','');n.name=(kind==='value'?'value_':'text_')+name;
    n.fontName={family:'Arial',style:t.fontName.style==='Bold'?'Bold':'Regular'};n.textAutoResize='NONE';
    n.resize(Math.round(t.width)+18,Math.round(t.height));n.x=Math.round(a.x-sb.x+parentOffset.x);n.y=Math.round(a.y-sb.y+parentOffset.y);n.textAlignHorizontal='LEFT';n.textAlignVertical='CENTER';
    report.overlays.push({sourceId:t.id,resultId:n.id,name:n.name,text:n.characters,rect:[n.x,n.y,n.width,n.height],kind});return n;
  }
  for(const old of src.children.filter(n=>/^button_(CH|side\.)/.test(n.name))){
    const name=old.name.replace('side.hall','SideHall').replace('side.terrace','SideTerrace'),b=root.children.find(n=>n.name===name);
    if(!b)throw new Error('Missing '+name);
    for(const st of b.children){
      const label=st.children.find(n=>n.type==='TEXT');label.characters='';
      const icon=st.children.find(n=>n.name==='Icon');if(icon)for(const t of icon.findAll(n=>n.type==='TEXT'))t.remove();
      // Overlay text stays white; a dark pressed fill keeps it readable.
      if(st.name==='Pressed')st.fills=[{type:'SOLID',color:{r:140/255,g:61/255,b:8/255}}];
    }
    const labels=old.children.filter(n=>n.type==='TEXT');
    for(let i=0;i<labels.length;i++)overlay(labels[i],name.replace('button_','')+(labels[i].fontSize===24?'Title':old.name.includes('side.')?'Status':'Channel'),old.name.includes('side.')&&labels[i].fontSize===16?'value':'label');
    report.buttons.push({id:b.id,name:b.name,rect:[b.x,b.y,b.width,b.height],nativeCaption:''});
  }
  const mute=root.children.find(n=>n.name==='button_Mute'),oldMute=src.children.find(n=>n.name==='button_Mute');
  for(const st of mute.children){st.children.find(n=>n.type==='TEXT').characters='';if(st.name==='Pressed')st.fills=[{type:'SOLID',color:{r:140/255,g:61/255,b:8/255}}];}
  overlay(oldMute.children.find(n=>n.name==='off').children.find(n=>n.type==='TEXT'),'MuteTitle');
  // All overlay nodes were appended after buttons, preserving visual stacking.
  report.elements=root.children.length;report.fonts=[...new Set(root.findAll(n=>n.type==='TEXT').map(n=>n.fontName.family+' '+n.fontName.style))];
  figma.currentPage.selection=[root];figma.viewport.scrollAndZoomIntoView([root]);
  figma.showUI('<h2>Home layout preserved</h2><textarea aria-label="Overlay preparation report" readonly style="width:100%;height:530px">'+JSON.stringify(report,null,2).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</textarea>',{width:700,height:600});
})().catch(e=>{figma.notify(String(e),{error:true});figma.closePlugin(String(e));});
