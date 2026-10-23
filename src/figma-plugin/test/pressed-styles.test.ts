import test from 'node:test';
import assert from 'node:assert/strict';
import { authorButtons, paint } from './button-preparation-fixture.ts';
import { background, descendants } from '../src/button-artwork.ts';
import { buttonPreparationSummary, prepareButtons } from '../src/button-preparation.ts';
import { designSignature } from '../src/export.ts';
import { tag } from '../src/demo.ts';
import { DATA_KEY } from '../src/model.ts';

for(const stateType of ['GROUP','FRAME'])for(const feedback of [false,true])for(const corners of [false,true])test(`${stateType}: ${feedback?'Normal/Active/Pressed':'Normal/Pressed'} updates Pressed from active sample; corners=${corners}`,()=>{
  const f=authorButtons();f.buttons[1].remove();prepareButtons(f.root);
  const button=f.buttons[0];
  button.name=feedback?'feedbackbutton_Power':'button_ExitModal';
  button.children[0].name='Normal';
  if(feedback){const pressed=button.children[1].clone();button.appendChild(pressed);pressed.name='Pressed';button.children[1].name='Active';}
  else button.children[1].name='Pressed';
  if(stateType==='FRAME')for(const group of [...button.children] as GroupNode[]){
    const surface=background(group),state=figma.createFrame();
    state.name=group.name;state.resize(group.width,group.height);state.fills=surface.fills;state.strokes=surface.strokes;state.cornerRadius=3;
    button.appendChild(state);state.x=group.x;state.y=group.y;
    for(const child of [...group.children])if(child!==surface)state.appendChild(child);
    group.remove();
  }
  tag(button,{kind:'button',buttonMode:feedback?'feedback':'on-off',key:'exit',objectId:1,controlId:8101});
  for(const [i,state] of button.children.entries()){
    tag(state,{kind:'state',role:state.name==='Normal'?'normal':state.name==='Pressed'?'pressed':'feedback',stateId:i});
    state.visible=state.name==='Pressed';background(state).fills=[paint('#E36910')];
  }
  const pressed=button.children.at(-1)!;
  const shape=()=>descendants(button).map(n=>[n.id,n.name,n.type,n.x,n.y,n.width,n.height,n.visible,n.getPluginData(DATA_KEY)]);
  const beforeShape=shape(),before=designSignature(button),pressedRadius=background(pressed).cornerRadius;
  const originalArtwork=descendants(button).filter(n=>n.type==='TEXT'||n.name==='Voice').map(n=>[n,designSignature(n)] as const);
  f.normal.fills=[paint('#111111')];f.active.fills=[paint('#002244')];f.active.cornerRadius=12;
  assert.deepEqual(buttonPreparationSummary(f.root),{total:1,create:0,update:1});
  assert.deepEqual(prepareButtons(f.root,{},'apply-new',corners),{buttons:0,states:0,skipped:1});
  assert.equal(designSignature(button),before);
  assert.deepEqual(prepareButtons(f.root,{},'apply',corners),{buttons:1,states:0,skipped:0});
  assert.deepEqual(background(button.children[0]).fills,f.normal.fills);
  assert.deepEqual(background(pressed).fills,f.active.fills);assert.deepEqual(background(pressed).strokes,f.active.strokes);
  if(feedback)assert.deepEqual(background(button.children[1]).fills,f.active.fills);
  assert.equal(background(pressed).cornerRadius,corners?12:pressedRadius);
  assert.deepEqual(shape(),beforeShape);
  for(const [node,signature] of originalArtwork)assert.equal(designSignature(node),signature);
  const updated=designSignature(button);prepareButtons(f.root,{},'apply',corners);assert.equal(designSignature(button),updated);
});

test('Ambiguous Pressed background blocks an explicit update before any other button changes',()=>{
  const f=authorButtons();prepareButtons(f.root);
  const pressed=f.buttons[1].children[1].clone();f.buttons[1].appendChild(pressed);pressed.name='Pressed';
  (pressed as GroupNode).appendChild(background(pressed).clone());
  const before=designSignature(f.root);f.normal.fills=[paint('#101010')];
  assert.match(buttonPreparationSummary(f.root).updateIssue!,/Pressed.*несколько/);
  assert.throws(()=>prepareButtons(f.root,{},'apply'),/Pressed.*несколько/);
  assert.equal(designSignature(f.root),before);
  assert.deepEqual(prepareButtons(f.root,{},'apply-new'),{buttons:0,states:0,skipped:2});
});

test('A later preparation failure restores the original Pressed background and state identity',()=>{
  const f=authorButtons();prepareButtons(f.root,{members:[f.buttons[0]]});
  f.buttons[0].children[0].name='Normal';f.buttons[0].children[1].name='Pressed';
  background(f.buttons[0].children[1]).fills=[paint('#E36910')];
  f.active.fills=[paint('#002244')];const before=designSignature(f.root);
  f.api.group=()=>{throw new Error('fixture failure after updating Pressed');};
  assert.throws(()=>prepareButtons(f.root,{},'apply'),/fixture failure/);
  assert.equal(designSignature(f.root),before);
});
