import { fail, readMetadata, stateRole, type ButtonMode, type PresetPreview, type ButtonPreparationSummary } from './model.ts';
import { BACKGROUND_KEY, background, descendants, hasFill, isButtonContainer, type ButtonContainer } from './button-artwork.ts';
import { plain, rect } from './read-node.ts';
import type { ProjectNode, ProjectOptions } from './project.ts';

const PRESETS_KEY = 'exui-button-style-presets';
type PresetRole = 'normal' | 'feedback';
type Surface = FrameNode | RectangleNode;
const STYLE_FIELDS = ['fills', 'strokes', 'strokeWeight', 'strokeAlign', 'strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight', 'dashPattern', 'strokeCap', 'strokeJoin'] as const;
const RADIUS_FIELDS = ['cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius', 'cornerSmoothing'] as const;
type Style = Record<string, unknown>;
function copy(value: unknown): unknown { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function styleOf(node: Surface, corners: boolean): Style {
  const result: Style = {};
  for (const field of [...STYLE_FIELDS, ...(corners ? RADIUS_FIELDS : [])]) {
    const value = (node as unknown as Style)[field];
    if (value !== undefined && typeof value !== 'symbol') result[field] = copy(value);
  }
  return result;
}
function setStyle(node: Surface, style: Style): void {
  for (const [field, value] of Object.entries(style)) (node as unknown as Style)[field] = copy(value);
}
function pageNodes(): SceneNode[] { return figma.currentPage.children.flatMap(descendants); }
function savedPresets(): Partial<Record<PresetRole, string>> {
  const raw = figma.currentPage.getPluginData(PRESETS_KEY);
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || ['normal', 'feedback'].some(k => value[k] !== undefined && typeof value[k] !== 'string')) throw new Error();
    return value;
  } catch { return fail('button-presets', 'Повреждены ссылки на эталоны. Назначьте обычный и активный эталоны заново.'); }
}
function presetNode(role: PresetRole): SceneNode | undefined {
  const nodes = pageNodes(), saved = savedPresets()[role];
  // An explicitly selected but deleted preset must not silently switch sources.
  if (saved) return nodes.find(n => n.id === saved);
  const matches = nodes.filter(n => /^(Button Styles|button_styles)$/i.test(n.parent?.name ?? '') && stateRole(n.name) === role);
  return matches.length === 1 ? matches[0] : undefined;
}
export function presetSummary(): {normal: string; feedback: string} {
  return { normal: presetNode('normal')?.name ?? 'Не выбран', feedback: presetNode('feedback')?.name ?? 'Не выбран' };
}
export function presetPreviews(): Record<PresetRole, PresetPreview> {
  function preview(role: PresetRole): PresetPreview {
    try {
      const node = presetNode(role);
      if (!node) {
        const saved = savedPresets()[role];
        const matches = pageNodes().filter(n => /^(Button Styles|button_styles)$/i.test(n.parent?.name ?? '') && stateRole(n.name) === role);
        return {name:'Не выбран',ready:false,hint:saved?'Образец удалён. Выберите новый в дополнительных настройках.':matches.length>1?'Найдено несколько образцов. Выберите нужный в дополнительных настройках.':'Добавьте образец в Button Styles или выберите его вручную.'};
      }
      const surface = node.type === 'RECTANGLE' ? node : background(node);
      if (!hasFill(surface)) fail('button-presets', `${node.name}: у образца должна быть заливка.`);
      const color = (paints: readonly Paint[] | PluginAPI['mixed']): string | undefined => {
        if (!Array.isArray(paints)) return;
        const visible = paints.filter(p => p.visible !== false);
        if (visible.length !== 1 || visible[0].type !== 'SOLID') return;
        const p = visible[0] as SolidPaint, c = p.color;
        return `rgba(${[c.r,c.g,c.b].map(v=>Math.round(v*255)).join(',')},${p.opacity??1})`;
      };
      const fill = color(surface.fills);
      return {name:node.name,ready:true,hint:fill?'':'Сложная заливка · вид сохранится в Figma',fill,stroke:color(surface.strokes),radius:typeof surface.cornerRadius==='number'?surface.cornerRadius:undefined};
    } catch (error) { return {name:'Проверьте образец',ready:false,hint:(error as Error).message}; }
  }
  return {normal:preview('normal'),feedback:preview('feedback')};
}
export function rememberPreset(node: SceneNode, role: PresetRole): void {
  if (role !== 'normal' && role !== 'feedback') fail('button-presets', 'Выберите обычный или активный эталон.');
  const surface = node.type === 'RECTANGLE' ? node : background(node);
  if (!hasFill(surface)) fail('button-presets', `${node.name}: у эталона должна быть заливка.`, node);
  let saved: Partial<Record<PresetRole,string>> = {};
  try { saved=savedPresets(); } catch { /* Explicit assignment repairs a damaged preset configuration. */ }
  figma.currentPage.setPluginData(PRESETS_KEY, JSON.stringify({...saved, [role]: node.id}));
}
export function markBackground(node: SceneNode): boolean {
  if (node.type !== 'RECTANGLE' && node.type !== 'FRAME') fail('button-background', 'Выберите прямоугольник или Frame фона.');
  let owner = node.parent;
  while (owner && owner.type !== 'PAGE') {
    if (isButtonContainer(owner as SceneNode) && (readMetadata(owner,{allowCopied:true})?.kind==='state' || stateRole(owner.name.replace(/^(st|state)_/i, '')) || /^(button|btn|feedbackbutton|fbtn)_/i.test(owner.name))) break;
    owner = owner.parent;
  }
  if (!owner || owner.type === 'PAGE') fail('button-background', 'Выберите фон внутри кнопки или её состояния.');
  if (JSON.stringify(rect(node,owner as SceneNode))!==JSON.stringify([0,0,(owner as SceneNode).width,(owner as SceneNode).height]))
    fail('button-background', 'Фон должен занимать всю кнопку или состояние.');
  const marked = node.getPluginData(BACKGROUND_KEY) === '1';
  for (const n of descendants(owner as SceneNode)) if (n.getPluginData(BACKGROUND_KEY)) n.setPluginData(BACKGROUND_KEY, '');
  if (!marked) node.setPluginData(BACKGROUND_KEY, '1');
  return !marked;
}
function roleOf(node: SceneNode) {
  return readMetadata(node, {allowCopied: true})?.role ?? stateRole(node.name.replace(/^(st|state)_/i, ''));
}
interface Target {node: ButtonContainer; mode: ButtonMode; states: ButtonContainer[]; missing: PresetRole[]}
function targets(root: ProjectNode, options: ProjectOptions): Target[] {
  const result: Target[] = [];
  function visit(node: SceneNode) {
    const metadata = readMetadata(node, {allowCopied: true});
    if (metadata?.kind === 'button' || /^(button|btn|feedbackbutton|fbtn)_/i.test(node.name)) {
      if (!isButtonContainer(node)) fail('button-prepare', `${node.name}: подготовка доступна для Group или Frame.`, node);
      plain(node, false, true);
      if (!node.children.length) fail('button-prepare', `${node.name}: нарисуйте содержимое кнопки.`, node);
      const mode = metadata?.buttonMode ?? (/^(feedbackbutton|fbtn)_/i.test(node.name) ? 'feedback' : 'on-off');
      const stateNodes = node.children.filter(n => readMetadata(n, {allowCopied: true})?.kind === 'state' || isButtonContainer(n) && roleOf(n));
      if (stateNodes.length && (stateNodes.length !== node.children.length || stateNodes.some(n => !isButtonContainer(n))))
        fail('button-prepare', `${node.name}: состояния должны быть отдельными Group или Frame без соседних рисунков.`, node);
      const states = stateNodes as ButtonContainer[];
      for (const role of ['normal', 'feedback', 'pressed'] as const) if (states.filter(n => roleOf(n) === role).length > 1)
        fail('button-prepare', `${node.name}: повтор роли ${role}.`, node);
      const missing: PresetRole[] = states.length ? (['normal', 'feedback'] as const).filter(role => !states.some(s => roleOf(s) === role)) : ['normal', 'feedback'];
      if(mode==='on-off'&&states.length===1&&roleOf(states[0])==='pressed')missing.splice(0,missing.length,'normal');
      // Preserve an authored Normal/Pressed pair and custom legacy states.
      if (states.length >= 2) missing.length = 0;
      if (missing.length && node.type==='INSTANCE') fail('button-prepare', `${node.name}: добавляйте состояния в исходный компонент; подготовленные экземпляры пропускаются.`, node);
      if (missing.length && node.type==='FRAME' && node.layoutMode!=='NONE') fail('button-prepare', `${node.name}: отключите Auto layout перед созданием состояний.`, node);
      if (!states.length) background(node);
      else if (missing.length) background(states[0]);
      result.push({node, mode, states, missing});
      return;
    }
    if (metadata && !['project', 'page', 'popup', 'popup-group'].includes(metadata.kind)) return;
    if ('children' in node) for (const child of node.children) visit(child);
  }
  for (const node of options.members ?? root.children) visit(node);
  if (!result.length) fail('button-prepare', 'В выбранном макете нет button_ / btn_ / feedbackbutton_ / fbtn_.');
  return result;
}
export function buttonPreparationSummary(root: ProjectNode, options: ProjectOptions = {}): ButtonPreparationSummary {
  try {
    const all = targets(root, options);
    let updateIssue:string|undefined;
    try { for (const t of all) for (const s of t.states) if (['normal','feedback'].includes(roleOf(s)??'')) background(s); }
    catch(error) { updateIssue=(error as Error).message; }
    return {total:all.length,create:all.filter(t=>t.missing.length).length,update:all.filter(t=>!t.missing.length&&t.states.some(s=>['normal','feedback'].includes(roleOf(s)??''))).length,...(updateIssue?{updateIssue}:{})};
  } catch (error) { return {total:0,create:0,update:0,issue:(error as Error).message}; }
}
// The combined action shares validation and rollback across both kinds of work.
export function prepareButtons(root: ProjectNode, options: ProjectOptions = {}, update: boolean | 'apply' | 'apply-new' = false, corners = false): {buttons: number; states: number; skipped: number} {
  const all = targets(root, options), pending = all.filter(t => update && update!=='apply-new' ? (update==='apply'&&t.missing.length)||t.states.some(s => ['normal', 'feedback'].includes(roleOf(s) ?? '')) : t.missing.length);
  if (!pending.length) return {buttons: 0, states: 0, skipped: all.length};
  const presets = (['normal', 'feedback'] as const).map(role => {
    const node = presetNode(role);
    if (!node) fail('button-presets', `Не найден ${role === 'normal' ? 'обычный' : 'активный'} образец. В разделе «Оформление кнопок» откройте «Выбрать образцы и фон вручную» и назначьте нужный образец.`);
    const surface = node.type === 'RECTANGLE' ? node : background(node);
    if (!hasFill(surface)) fail('button-presets', `${node.name}: у эталона должна быть заливка.`, node);
    return styleOf(surface, corners);
  });
  if (JSON.stringify(presets[0]) === JSON.stringify(presets[1])) fail('button-presets', 'Обычный и активный эталоны должны различаться заливкой или обводкой.');
  // Complete validation before changing the first button.
  if (update) for (const t of pending) for (const s of t.states) if (roleOf(s) === 'normal' || roleOf(s) === 'feedback') background(s);
  const undo: (() => void)[] = [];
  let count = 0;
  function paint(surface: Surface, role: PresetRole) {
    const before = styleOf(surface, corners); undo.push(() => setStyle(surface, before));
    setStyle(surface, presets[role === 'normal' ? 0 : 1]);
  }
  function clearAssignments(node: SceneNode) {
    for (const n of descendants(node)) { n.setPluginData('exui', ''); n.setPluginData('exui-id-registry', ''); }
  }
  try {
    for (const t of pending) {
      if (update) {
        for (const state of t.states) { const role = roleOf(state); if (role === 'normal' || role === 'feedback') paint(background(state), role); }
      }
      if (update===true || !t.missing.length) continue;
      let source = t.states[0];
      if(source) {
        const existingSource=source, marker=source.getPluginData('exui-generated-state');
        undo.push(()=>existingSource.setPluginData('exui-generated-state',marker));
        source.setPluginData('exui-generated-state','1');
      }
      if (!source) {
        // Frame paint belongs to the original design too. Move it onto a
        // Rectangle before wrapping; leave the outer Frame transparent.
        if (t.node.type === 'FRAME' && hasFill(t.node)) {
          const outer = t.node, style = styleOf(outer, true), rect = figma.createRectangle();
          undo.push(() => {rect.remove(); setStyle(outer, style);});
          rect.name = 'Background';rect.resize(outer.width, outer.height);outer.insertChild(0, rect);rect.x = 0;rect.y = 0;
          setStyle(rect, style);outer.fills = [];outer.strokes = [];outer.cornerRadius = 0;
        }
        source = figma.group([...t.node.children], t.node, 0);
        const group = source; undo.push(() => {if (!group.removed) figma.ungroup(group);});
        source.name = t.mode === 'on-off' ? 'Off' : 'Normal';source.setPluginData('exui-generated-state', '1');
        paint(background(source), 'normal');
        count++;
      }
      for (const role of t.missing) {
        if (roleOf(source) === role) continue;
        const clone = source.clone();undo.push(() => {if (!clone.removed) clone.remove();});
        t.node.appendChild(clone);clone.relativeTransform = source.relativeTransform;
        clearAssignments(clone);clone.setPluginData('exui-generated-state', '1');
        clone.name = role === 'normal' ? (t.mode === 'on-off' && roleOf(source)!=='pressed' ? 'Off' : 'Normal') : (t.mode === 'on-off' ? 'On' : 'Active');
        clone.visible = false;paint(background(clone), role);count++;
      }
    }
    figma.commitUndo();
    return {buttons: pending.length, states: count, skipped: all.length - pending.length};
  } catch (error) {
    const failures: string[] = [];
    for (const restore of undo.reverse()) try { restore(); } catch { failures.push('слой'); }
    if (failures.length) fail('button-rollback', 'Не удалось полностью восстановить макет. Отмените операцию в Figma и повторите подготовку.');
    throw error;
  }
}
