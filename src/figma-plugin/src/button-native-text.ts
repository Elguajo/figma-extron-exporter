import { ExportError,fail, readMetadata, stateRole } from './model.ts';
import { fillsArea,isButtonContainer, isImageButton, type ArtworkText, type ButtonContainer } from './button-artwork.ts';
import { plain, readText, rect } from './read-node.ts';
import type { ProjectNode, ProjectOptions } from './project.ts';
import { inlineArtworkMoves } from './button-inline-artwork.ts';

export const BUTTON_TEXT_KEY = 'exui-button-native-text';
export type ButtonTextMode = 'auto' | 'middle-center' | 'bottom-center';
export function buttonTextMode(node: SceneNode): ButtonTextMode | 'native' | undefined {
  if (isImageButton(node)) return;
  const mode = node.getPluginData(BUTTON_TEXT_KEY);
  if (!mode) return 'native';
  if (mode !== 'auto' && mode !== 'middle-center' && mode !== 'bottom-center')
    fail('button-text', `${node.name}: неизвестный режим текста. Повторно выберите положение текста кнопок.`, node);
  return mode;
}

// The caption's frame position determines the vertical Button anchor. Paragraph
// settings are deliberately ignored: default LEFT / TOP must not propagate to
// the Button. Horizontal alignment is always centered, including offset boxes.
function automaticAlignment(label: TextNode, state: ButtonContainer): 'middle-center' | 'bottom-center' {
  const [x,y,w,h]=rect(label,state),[,,width,height]=rect(state,state);
  if(x<0||y<0||x+w>width||y+h>height)
    fail('button-text-alignment',`${label.name}: текстовая рамка выходит за кнопку. Поместите её внутри кнопки.`,label);
  const center=y+h/2;
  // Nearest of top / middle / bottom. Ties are ambiguous, not a guess.
  if(center>height/4&&center<height*3/4)return 'middle-center';
  if(center>height*3/4)return 'bottom-center';
  fail('button-text-alignment',`${label.name}: верхнее или неоднозначное положение текстовой рамки пока не поддержано автоматическим текстом Button. Переместите рамку в среднюю или нижнюю часть кнопки либо выберите положение вручную.`,label);
}

// A hidden state still needs its caption. Hidden descendants do not contribute.
// Empty Kit placeholders are harmless beside one actual label in Artwork.
export function nativeButtonText(state: ButtonContainer, mode: ButtonTextMode|'native'): ArtworkText {
  try { return readNativeButtonText(state,mode); }
  catch(error){
    if(error instanceof ExportError)error.message+=' Для обычной button_ подпись должна оставаться редактируемым текстом Button. Для полного экспорта состояния в PNG используйте imagebutton_ / ibtn_.';
    throw error;
  }
}
function readNativeButtonText(state: ButtonContainer, mode: ButtonTextMode|'native'): ArtworkText {
  const labels: TextNode[] = [];
  function visit(node: SceneNode) {
    if (node !== state && !node.visible) return;
    if (node.type === 'TEXT') { if (node.characters.trim()) labels.push(node); }
    else if ('children' in node) node.children.forEach(visit);
  }
  visit(state);
  if (labels.length > 1)
    fail('button-text', `${state.name}: найдено несколько непустых Text-слоёв. Для Text Feedback оставьте одну подпись в каждом состоянии.`, state);
  const label = labels[0];
  if (!label) return {font:{family:'Arial',size:12,bold:false},text:'',textColor:'#FFFFFF',bottom:mode==='bottom-center'};
  for (let node: BaseNode | null = label.parent; node && node !== state.parent; node = node.parent) {
    if ('visible' in node) plain(node as SceneNode, true, true);
    if ('children' in node && node.children.some(child => 'isMask' in child && child.isMask))
      fail('button-text', `${state.name}: подпись с маской нельзя перенести в текст Button. Уберите маску.`, label);
  }
  // Preserve an existing full-area Bottom caption. Otherwise the default is
  // native Middle-Center; explicit alignment settings remain available.
  const alignment=mode==='native'?(fillsArea(label,state)&&label.textAlignVertical==='BOTTOM'?'bottom-center':'middle-center'):mode==='auto'?automaticAlignment(label,state):mode;
  const copy=readText(label),bottom=alignment==='bottom-center';
  const moves=inlineArtworkMoves(state,label,copy.font,bottom);
  return {...copy,omitTextId:label.id,bottom,...(moves.length?{moves}:{})};
}

export function setButtonTextMode(root: ProjectNode, options: ProjectOptions, mode: ButtonTextMode | 'design'): {buttons:number;skipped:number} {
  if (!['auto','middle-center','bottom-center','design'].includes(mode)) fail('button-text','Выберите положение текста кнопок.');
  const buttons: ButtonContainer[] = [];
  function visit(node: SceneNode) {
    const metadata = readMetadata(node, {allowCopied:true});
    if (metadata?.kind === 'button' || /^(button|btn|feedbackbutton|fbtn|imagebutton|ibtn)_/i.test(node.name)) {
      if (!isButtonContainer(node)) fail('button-text', `${node.name}: нужен Frame, Group или экземпляр кнопки.`, node);
      buttons.push(node);return;
    }
    if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET' || metadata && !['page','project','popup','popup-group'].includes(metadata.kind)) return;
    if ('children' in node) node.children.forEach(visit);
  }
  (options.members ?? root.children).forEach(visit);
  if (!buttons.length) fail('button-text','В выбранной области нет кнопок button_ / btn_ / feedbackbutton_ / fbtn_ / imagebutton_ / ibtn_.');
  // Validate the complete batch before the first metadata write.
  const changes: {node:ButtonContainer;before:string;after:string}[] = [];let skipped=0;
  for (const node of buttons) {
    if (isImageButton(node)) {skipped++;continue;}
    if (mode !== 'design') {
      const states = node.children;
      if (states.length < 2 || states.some(state => !isButtonContainer(state) || !(readMetadata(state,{allowCopied:true})?.kind==='state' || stateRole(state.name.replace(/^(st|state)_/i,'')))))
        fail('button-text', `${node.name}: сначала подготовьте состояния кнопки.`, node);
      const captions = (states as ButtonContainer[]).map(state=>nativeButtonText(state,mode));
      const fonts = new Set(captions.filter(c=>c.omitTextId).map(c=>JSON.stringify(c.font)));
      if (fonts.size > 1) fail('button-text', `${node.name}: для текста Button нужен одинаковый шрифт во всех состояниях.`, node);
      if (!captions.some(c=>c.omitTextId)) {skipped++;continue;}
    }
    const before=node.getPluginData(BUTTON_TEXT_KEY),after=mode==='design'?'':mode;
    if (before!==after) changes.push({node,before,after});else skipped++;
  }
  const written: typeof changes = [];
  try {
    for (const change of changes) {written.push(change);change.node.setPluginData(BUTTON_TEXT_KEY,change.after);}
    if (written.length) figma.commitUndo();
  } catch (error) {
    let failed=false;
    for (const change of written.reverse()) try {change.node.setPluginData(BUTTON_TEXT_KEY,change.before);} catch {failed=true;}
    if (failed) fail('button-text-rollback','Не удалось восстановить настройку текста. Отмените операцию в Figma и проверьте кнопки.');
    throw error;
  }
  return {buttons:changes.length,skipped};
}
