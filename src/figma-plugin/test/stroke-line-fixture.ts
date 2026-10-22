import { frame,solid } from './expanded-fixture.ts';
import { PROFILES,type Profile } from '../src/model.ts';

export async function penLine(parent:FrameNode,name='line_Pen',vertical=false,thickness=2) {
  const node=figma.createVector();parent.appendChild(node);node.name=name;
  node.x=20;node.y=40;node.fills=[];node.strokes=[solid('#6699CC')];
  node.strokeWeight=thickness;node.strokeAlign='CENTER';node.strokeCap='NONE';node.dashPattern=[];
  await node.setVectorNetworkAsync({vertices:[{x:0,y:0},{x:vertical?0:100,y:vertical?100:0}],segments:[{start:0,end:1}],regions:[]});
  return node;
}

export async function strokeLineFixture(profile:Profile='tlp-pro-1025m') {
  const canvas=PROFILES[profile],root=frame(null,'Home',120,80,canvas.width,canvas.height,'#101010');
  await penLine(root,'line_PenHorizontal');
  const vertical=await penLine(root,'ln_PenVertical',true);vertical.x=180;
  const thin=await penLine(root,'line_Thin',false,1);thin.y=180.5;
  const line=figma.createLine();root.appendChild(line);line.name='line_LineTool';line.x=20;line.y=220;
  line.resize(100,0);line.strokes=[solid('#CC9933')];line.strokeWeight=4;line.strokeAlign='CENTER';line.strokeCap='NONE';line.dashPattern=[];
  return root;
}
