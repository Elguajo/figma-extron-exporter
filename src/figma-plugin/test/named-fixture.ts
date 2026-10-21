import { createDemo, tag } from '../src/demo.ts';
import { DATA_KEY, type Profile } from '../src/model.ts';
import { icons } from './fake-figma.ts';

// A designer-authored tree; Figma API and rendering are still explicitly mocked.
export async function namedFixture(profile:Profile='tlp-pro-1025m',twoStates=false) {
  const root=await createDemo(profile,icons(),true);
  function clear(node:SceneNode){node.setPluginData(DATA_KEY,'');if('children' in node)for(const c of node.children)clear(c);}
  clear(root);root.name='Home';
  const names=[twoStates?'btn_Music':'fbtn_Music','text_VolumeValue','lvl_Volume',twoStates?'button_Mute':'feedbackbutton_Mute'];
  root.children.forEach((n,i)=>n.name=names[i]);
  for(const button of [root.children[0],root.children[3]] as FrameNode[]) {
    if(twoStates)button.children[2].remove();
    button.children.forEach((s,i)=>{s.name=(twoStates?['Off','On']:['Normal','Active','Pressed'])[i];if('children' in s)for(const n of s.children)n.name=n.type==='TEXT'?'Text':'Icon';});
  }
  return root;
}

export async function graphicFixture(profile:Profile='tlp-pro-1025m') {
  const root=await namedFixture(profile,false);
  const momentary=root.children[0] as FrameNode;
  momentary.name='button_VolumeUp';momentary.children[1].remove();
  momentary.children[0].name='Normal';momentary.children[1].name='Pressed';
  momentary.children[1].fills=[{type:'SOLID',color:{r:1,g:0.8,b:0}}];
  // This fixture deliberately covers saved legacy momentary/multistate buttons.
  tag(momentary,{kind:'button',key:'home.volumeup',objectId:1,controlId:8101});
  tag(root.children[3],{kind:'button',key:'home.mute',objectId:2,controlId:8102});
  for(const state of momentary.children as FrameNode[]) {
    const label=state.children.find(n=>n.type==='TEXT') as TextNode;label.characters='+';
  }
  const logo=figma.createFrame();root.appendChild(logo);logo.name='logo_Company';logo.resize(64,64);logo.x=root.width-72;logo.y=root.height-72;
  logo.fills=[{type:'IMAGE',imageHash:figma.createImage(icons()['icon.note-dark']).hash,scaleMode:'FILL'}];logo.strokes=[];
  return root;
}
