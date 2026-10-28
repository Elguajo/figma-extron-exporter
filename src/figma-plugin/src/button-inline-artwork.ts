import { fail, type Font } from './model.ts';
import type { ArtworkMove } from './read-node.ts';
import type { ButtonContainer } from './button-artwork.ts';

// Button Text has no independent rectangle in GUI Designer. Keep nearby inline
// icons beside its native anchor rather than leaving them under the caption.
// This is a render plan only: source layers and control geometry stay intact.
export function inlineArtworkMoves(state: ButtonContainer, label: TextNode, font: Font, bottom: boolean): ArtworkMove[] {
  const box=state.absoluteBoundingBox!,text=label.absoluteBoundingBox!;
  const px=font.size/0.75;
  const dx=Math.round(box.width)/2-(text.x-box.x+text.width/2);
  const dy=(bottom?Math.round(box.height)-text.height/2:Math.round(box.height)/2)-(text.y-box.y+text.height/2);
  // Inter's GDI advances need the same breathing room as native static labels.
  const allowance=font.family==='Arial'?0:Math.ceil(Math.max(px*.75,text.width*.06)/2);
  const ancestors=new Set<BaseNode>();
  for(let n:BaseNode|null=label;n&&n!==state;n=n.parent)ancestors.add(n);
  const moves:ArtworkMove[]=[];
  function visit(node:SceneNode) {
    if(!node.visible||node.type==='TEXT')return;
    const b=node.absoluteBoundingBox;
    if(!b)return;
    const left=b.x+b.width<=text.x+.01,right=b.x>=text.x+text.width-.01;
    const gap=left?text.x-b.x-b.width:b.x-text.x-text.width;
    const row=b.y<text.y+text.height&&b.y+b.height>text.y;
    if('opacity'in node&&!ancestors.has(node)&&row&&(left||right)&&gap>=-.01&&gap<=px*2&&b.width<=box.width/2&&b.height<=Math.max(text.height,px)*2){
      const shiftX=dx+(left?-allowance:allowance);
      if(Math.abs(shiftX)<.001&&Math.abs(dy)<.001)return;
      if(b.x+shiftX<box.x-.01||b.x+b.width+shiftX>box.x+Math.round(box.width)+.01||b.y+dy<box.y-.01||b.y+b.height+dy>box.y+Math.round(box.height)+.01)
        fail('button-text-layout',`${state.name}: рядом с нативным текстом не хватает места для «${node.name}». Увеличьте кнопку или уменьшите подпись/иконку.`,node);
      moves.push({nodeId:node.id,dx:shiftX,dy});return;
    }
    // Do not extract graphics through a separate masked/effected/translucent
    // subtree. A selected icon retains all such appearance inside its own clone.
    if('children'in node&&'opacity'in node&&'effects'in node&&'blendMode'in node&&node.opacity===1&&!node.effects.some(e=>e.visible!==false)&&!node.children.some(n=>'isMask'in n&&n.isMask)&&['NORMAL','PASS_THROUGH'].includes(node.blendMode))
      node.children.forEach(visit);
  }
  state.children.forEach(visit);
  return moves;
}
