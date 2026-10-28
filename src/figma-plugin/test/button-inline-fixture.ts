import assert from 'node:assert/strict';
import {authorButtons,paint} from './button-preparation-fixture.ts';
import {recognize,applyRecognition} from '../src/recognize.ts';

// A compact version of Mute: 288×52, centered inline row in each state.
export function muteFixture(profile:'tlp-pro-1025m'|'tlp-pro-300m-portrait'='tlp-pro-300m-portrait',side:'left'|'right'='left') {
  const f=authorButtons(profile);f.buttons.forEach(b=>b.remove());
  const button=figma.createFrame();button.name='button_MuteAll';button.resize(288,52);button.fills=[];button.x=16;button.y=415;f.root.appendChild(button);
  for(const [i,name] of ['Normal','Pressed'].entries()){
    const state=figma.createFrame();state.name=name;state.resize(288,52);state.fills=[paint(i?'#D0AC68':'#181B1C')];state.visible=!i;button.appendChild(state);
    const row=figma.createFrame();row.name='Content';row.fills=[];row.resize(142,20);row.x=73;row.y=16;state.appendChild(row);
    const icon=figma.createRectangle();icon.name='Mute icon';icon.resize(22,20);icon.x=side==='left'?0:120;icon.fills=[paint('#FFFFFF')];row.appendChild(icon);
    const label=figma.createText();label.name='Caption';label.characters='Mute all audio';label.fontName={family:'Inter',style:'Semi Bold'};label.fontSize=16;label.fills=[paint(i?'#000000':'#FFFFFF')];label.resize(110,20);label.x=side==='left'?32:0;row.appendChild(label);
    row.layoutMode='HORIZONTAL';
  }
  const plan=recognize(f.root,profile);assert.deepEqual(plan.errors,[]);applyRecognition(plan);
  return {...f,button};
}
