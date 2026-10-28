import { DATA_KEY, fail, readMetadata, stateRole } from './model.ts';
import { isButtonContainer, type ButtonContainer } from './button-artwork.ts';
import { designSignature } from './export.ts';

export interface NumberingOptions { base: string; start: number; mode: 'position' | 'duplicates'; names: boolean; labels: boolean }
export interface NumberingRow { id: string; containerId: string; container: string; from: string; to: string; text?: string }
interface Entry { node: ButtonContainer; name: string; labels: { node: TextNode; text: string }[] }
export interface NumberingPlan { options: NumberingOptions; rows: NumberingRow[]; entries: Entry[]; roots: SceneNode[]; parents: (BaseNode & ChildrenMixin)[]; selection: string[]; signature: string }
export const DEFAULT_NUMBERING: NumberingOptions = {base:'Box',start:1,mode:'position',names:true,labels:false};

function isButton(node: SceneNode): node is ButtonContainer {
  if (!isButtonContainer(node)) return false;
  const metadata = readMetadata(node, {allowCopied:true});
  return metadata ? metadata.kind === 'button' : /^(button|btn|feedbackbutton|fbtn|imagebutton|ibtn)_.+/i.test(node.name);
}
function prefix(node: ButtonContainer): string {
  return /^(button|btn|feedbackbutton|fbtn|imagebutton|ibtn)_/i.exec(node.name)?.[0] ?? (readMetadata(node,{allowCopied:true})?.buttonMode === 'feedback' ? 'feedbackbutton_' : 'button_');
}
function ordered(nodes: readonly ButtonContainer[]): ButtonContainer[] {
  // Form rows using a fixed top-edge tolerance, then read each row left to right.
  // Avoid a pairwise tolerance comparator: it is not transitive.
  const pending = [...nodes].sort((a,b)=>a.y-b.y || a.x-b.x || a.id.localeCompare(b.id));
  const result: ButtonContainer[] = [];
  while (pending.length) {
    const top = pending[0].y, row: ButtonContainer[] = [];
    while (pending.length && pending[0].y <= top + 2) row.push(pending.shift()!);
    result.push(...row.sort((a,b)=>a.x-b.x || a.y-b.y || a.id.localeCompare(b.id)));
  }
  return result;
}
function captionNodes(button: ButtonContainer): TextNode[] {
  const collect = (node: SceneNode): TextNode[] => node.type === 'TEXT' ? [node] : 'children' in node ? node.children.flatMap(collect) : [];
  const states = button.children.filter(n=>readMetadata(n,{allowCopied:true})?.kind === 'state' || stateRole(n.name.replace(/^(st|state)_/i,'')) !== null);
  const sources = states.length ? states : [button];
  return sources.map(source=>{
    const texts = collect(source);
    if (texts.length !== 1) fail('button-numbering', `${button.name} / ${source.name}: найдено текстовых слоёв — ${texts.length}. Для обновления подписи нужен ровно один в каждом состоянии. Отключите «Обновлять текст кнопок» или уточните структуру.`, source);
    const node = texts[0];
    if (node.hasMissingFont) fail('button-numbering', `${button.name}: шрифт подписи недоступен. Восстановите шрифт или отключите обновление текста.`, node);
    if ([node.fontName,node.fontSize,node.fills,node.textCase,node.textDecoration,node.letterSpacing,node.lineHeight].includes(figma.mixed))
      fail('button-numbering', `${button.name}: у подписи смешанное оформление. Используйте единое оформление Text-слоя или отключите обновление текста.`, node);
    return node;
  });
}
function fingerprint(roots: readonly SceneNode[], parents: NumberingPlan['parents']): string {
  // Track selected buttons and their contents, including all states.
  // For unselected siblings only names/assignments reserve numbers; their
  // artwork is outside this operation and need not be serialized.
  return JSON.stringify([roots.map(designSignature),parents.map(parent=>[parent.id,parent.name,parent.children.map(node=>[node.id,node.name,node.getPluginData(DATA_KEY)])])]);
}
export function planNumbering(selection: readonly SceneNode[], options: NumberingOptions): NumberingPlan {
  if (typeof options.base !== 'string' || !/^[A-Za-z][A-Za-z0-9]*(?:[.-][A-Za-z0-9]+)*$/.test(options.base) || options.base.length > 64)
    fail('button-numbering','Основа имени: до 64 символов, латинская буква в начале, затем буквы, цифры, точки и дефисы между непустыми частями.');
  if (!Number.isSafeInteger(options.start) || options.start < 1 || options.start > 1000000) fail('button-numbering','Начальный номер должен быть целым числом от 1 до 1000000.');
  if (!['position','duplicates'].includes(options.mode) || typeof options.names !== 'boolean' || typeof options.labels !== 'boolean') fail('button-numbering','Проверьте настройки нумерации.');
  if (!options.names && !options.labels) fail('button-numbering','Выберите изменение имён слоёв или текста кнопок.');
  const buttons = new Map(selection.filter(isButton).map(node=>[node.id,node]));
  if (!buttons.size) fail('button-numbering','Выделите сами кнопки button_ / btn_ / feedbackbutton_ / fbtn_ / imagebutton_ / ibtn_ в Figma. Выбор родительской группы, фрейма или слоя внутри кнопки не включает кнопку в нумерацию.');
  const roots=[...buttons.values()];
  const parents = [...new Set([...buttons.values()].map(node=>node.parent!))];
  const entries: Entry[] = [], rows: NumberingRow[] = [];
  const pattern = new RegExp('^'+options.base.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([1-9][0-9]*)$','i');
  const numberOf = (node: ButtonContainer) => {
    const match = pattern.exec(node.name.slice(prefix(node).length));
    const number = match ? Number(match[1]) : NaN;
    return Number.isSafeInteger(number) ? number : undefined;
  };
  for (const parent of parents) {
    const siblings = parent.children.filter(isButton), targets = ordered(siblings.filter(n=>buttons.has(n.id)));
    const used = new Set<number>(), keep = new Map<string,number>();
    // Unselected siblings always reserve their numbers. In repair mode reserve
    // every existing number before filling gaps; genuine owners win over clones.
    const reserve = options.mode === 'duplicates' ? [...siblings].sort((a,b)=>{
      const copied = (n: ButtonContainer) => {const m=readMetadata(n,{allowCopied:true});return !!m?.ownerNodeId && m.ownerNodeId !== n.id;};
      return Number(buttons.has(a.id))-Number(buttons.has(b.id)) || Number(copied(a))-Number(copied(b)) || targets.indexOf(a)-targets.indexOf(b);
    }) : siblings.filter(n=>!buttons.has(n.id));
    for (const node of reserve) {const n=numberOf(node);if(n!==undefined&&!used.has(n)){used.add(n);keep.set(node.id,n);}}
    let next = options.start;
    for (const node of targets) {
      let n = options.mode === 'duplicates' ? keep.get(node.id) : undefined;
      if (n === undefined) {while(used.has(next))next++;n=next++;used.add(n);}
      const suffix=options.base+n, name=options.names?prefix(node)+suffix:node.name, text=options.base+' '+n;
      const labels=options.labels?captionNodes(node).map(node=>({node,text})):[];
      entries.push({node,name,labels});rows.push({id:node.id,containerId:parent.id,container:parent.name,from:node.name,to:name,...(options.labels?{text}:{})});
    }
  }
  return {options:{...options},rows,entries,roots,parents,selection:selection.map(n=>n.id).sort(),signature:fingerprint(roots,parents)};
}
export async function applyNumbering(plan: NumberingPlan): Promise<{names: number; labels: number}> {
  const validate = () => {
    if (JSON.stringify(figma.currentPage.selection.map(n=>n.id).sort()) !== JSON.stringify(plan.selection) || plan.roots.some(n=>n.removed) || plan.parents.some(n=>n.removed) || fingerprint(plan.roots,plan.parents)!==plan.signature)
      fail('button-numbering-stale','Выделение или макет изменились. Обновите предпросмотр нумерации.');
  };
  validate();
  const fonts=new Map<string,FontName>();
  for (const entry of plan.entries) for (const {node} of entry.labels) if (node.fontName!==figma.mixed) fonts.set(JSON.stringify(node.fontName),node.fontName);
  await Promise.all([...fonts.values()].map(font=>figma.loadFontAsync(font)));
  validate();
  const undo: (()=>void)[] = [];let names=0,labels=0;
  try {
    for (const entry of plan.entries) {
      if (entry.node.name!==entry.name) {const before=entry.node.name;undo.push(()=>{entry.node.name=before;});entry.node.name=entry.name;names++;}
      for (const {node,text} of entry.labels) if(node.characters!==text) {const before=node.characters;undo.push(()=>{node.characters=before;});node.characters=text;labels++;}
    }
    if (undo.length) figma.commitUndo();
    return {names,labels};
  } catch (error) {
    const failures:string[]=[];for(const restore of undo.reverse())try{restore();}catch{failures.push('слой');}
    if(failures.length)fail('button-numbering-rollback','Не удалось полностью восстановить изменения. Отмените операцию в Figma и проверьте макет.');
    throw error;
  }
}
