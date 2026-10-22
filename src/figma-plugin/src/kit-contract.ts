export const KIT_KEY='exui-kit';
export const KIT_VERSION='extron-kit/1';
export const KIT_POPUP_GROUP_KEY='exui-kit-popup-group';
export function isKitNode(node:{getPluginData(key:string):string}):boolean {
  return node.getPluginData(KIT_KEY)===KIT_VERSION;
}
export function isControlFrame(node:SceneNode):node is FrameNode|InstanceNode {
  return node.type==='FRAME'||node.type==='INSTANCE';
}
export function controlText(node:SceneNode):TextNode|null {
  if(node.type==='TEXT')return node;
  if((node.type==='COMPONENT'||isControlFrame(node)&&(node.type==='INSTANCE'||isKitNode(node)))&&node.children.length===1&&node.children[0].type==='TEXT')return node.children[0];
  return null;
}
