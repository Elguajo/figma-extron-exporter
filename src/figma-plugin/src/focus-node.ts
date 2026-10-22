// Fit in screen pixels, then center in canvas coordinates. A Line/Vector can
// have zero width or height; it still needs a finite zoom and an exact center.
export function focusNode(node:SceneNode):void {
  let box=node.absoluteBoundingBox;
  if(!box){
    // Invisible states can have no bounding box. Do not change their visibility.
    const t=node.absoluteTransform;
    const corners=[[0,0],[node.width,0],[0,node.height],[node.width,node.height]];
    const xs=corners.map(([x,y])=>t[0][0]*x+t[0][1]*y+t[0][2]);
    const ys=corners.map(([x,y])=>t[1][0]*x+t[1][1]*y+t[1][2]);
    box={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
  }
  const viewport=figma.viewport,bounds=viewport.bounds;
  const width=Math.max(1,bounds.width*viewport.zoom-128),height=Math.max(1,bounds.height*viewport.zoom-128);
  viewport.zoom=Math.min(2,width/Math.max(1,box.width),height/Math.max(1,box.height));
  viewport.center={x:box.x+box.width/2,y:box.y+box.height/2};
}
