import { PROFILES, fail, readMetadata, type Profile } from './model.ts';
import { byName, pageScreens, type ProjectNode, type ProjectOptions } from './project.ts';

export type ScopeMode = 'selection' | 'selected-frames' | 'page';
export interface ScopeContext {
  root: ProjectNode;
  options: ProjectOptions;
  profile: Profile;
  scope: { id: string; name: string; kind: string; profile: Profile };
  canRecognize: boolean;
  hint: string;
}
const stored = (node: BaseNode) => readMetadata(node, { allowCopied: true });
export function selected(): SceneNode {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) fail('selection', 'Выберите одну секцию, Frame экрана или его элемент.');
  return selection[0];
}

export function pageOf(node:BaseNode):PageNode|null {
  let parent:BaseNode|null=node;while(parent&&parent.type!=='PAGE')parent=parent.parent;
  return parent?.type==='PAGE'?parent:null;
}
function screenOf(node:SceneNode):ProjectNode {
  let current:BaseNode|null=node,found:FrameNode|undefined;
  while(current&&current.type!=='PAGE') {
    const metadata=stored(current);
    if(metadata?.kind==='project'&&(current.type==='FRAME'||current.type==='SECTION'))return current;
    if(metadata?.kind==='page'&&current.type==='FRAME')found=current;
    if(!metadata&&current.type==='SECTION')return current;
    if(!metadata&&current.type==='FRAME'&&(/^(prj|project)_/i.test(current.name)))return current;
    if(!metadata&&current.type==='FRAME'&&!/^(button|btn|feedbackbutton|fbtn|slider|sld)_/i.test(current.name)){const candidate=current;if(Object.values(PROFILES).some(p=>candidate.width===p.width&&candidate.height===p.height))found=candidate;}
    current=current.parent;
  }
  if(found)return found;
  return fail('screen-unprepared','У выбранного макета ещё нет назначения Extron. Выберите секцию проекта или внешний Frame и профиль, затем нажмите «Распознать по именам» и сохраните назначения. Для ручной подготовки экрана используйте «Подготовить выбранный экран» и «Назначение выбранного элемента».');
}

export class ExportScope {
  mode: ScopeMode = 'selection';
  profile: Profile = 'tlp-pro-1025m';
  private selectedProject: { page: PageNode; nodes: readonly FrameNode[] } | undefined;
  private rememberFrames():void {
    const selection=figma.currentPage.selection;
    // Selecting a page to edit its properties must retain the rest of the project.
    if(selection.length===1&&this.selectedProject?.page.id===figma.currentPage.id)return;
    if(!selection.length||selection.some(n=>n.type!=='FRAME'||['button','state','graphic','image','slider','shape','line','level','popup-ref'].includes(stored(n)?.kind??'')||/^(button|btn|feedbackbutton|fbtn)_/i.test(n.name)))return;
    const ids=new Set(selection.map(n=>n.id));
    for(const node of selection){let p=node.parent;while(p&&p.type!=='PAGE'){if(ids.has(p.id))fail('selection','Выберите сами экраны, без их родительских фреймов.');p=p.parent;}}
    this.selectedProject={page:figma.currentPage,nodes:selection as readonly FrameNode[]};
  }
  private batchRoot():{root:PageNode;options:ProjectOptions} {
    const root=figma.currentPage;
    const nodes=this.mode==='page'?pageScreens(root,this.profile):this.selectedProject?.page.id===root.id?this.selectedProject.nodes:[];
    if(!nodes.length)fail('selection',this.mode==='page'?'На открытой странице нет screen_ / scr_ выбранного размера панели.':'Выделите фреймы Main и Audio Control на холсте.');
    if(nodes.some(n=>n.removed||pageOf(n)?.id!==root.id))fail('selection','Выбранные экраны удалены или перемещены. Выделите их заново.');
    return {root,options:{members:nodes,projectName:figma.root.name}};
  }
  reset(): void { this.selectedProject = undefined; }
  refreshSelection(): void {
    const selection = figma.currentPage.selection;
    if (this.mode === 'selection' && selection.length > 1 && selection.every(n => n.type === 'FRAME')) this.mode = 'selected-frames';
    if (this.mode === 'selected-frames') this.rememberFrames();
  }
  get canRecognize(): boolean {
    const node = figma.currentPage.selection.length === 1 ? figma.currentPage.selection[0] : undefined;
    const metadata = node ? stored(node) : null;
    return this.mode !== 'selection' || !!node && ['FRAME', 'SECTION'].includes(node.type) && (!metadata || ['page', 'project'].includes(metadata.kind));
  }
  resolve(forRecognition = false): ScopeContext {
    if (this.mode === 'selected-frames') this.rememberFrames();
    const resolved: {root: SceneNode | PageNode; options: ProjectOptions} = this.mode === 'selection'
      ? { root: forRecognition ? selected() : screenOf(selected()), options: {} }
      : this.batchRoot();
    const { root, options } = resolved;
    if (root.type !== 'FRAME' && root.type !== 'SECTION' && root.type !== 'PAGE') fail('selection', 'Выберите секцию проекта или внешний Frame экрана / project_Name.');
    const metadata = stored(root);
    const profile = this.mode === 'selection' ? metadata?.profile ?? this.profile : this.profile;
    return {
      root, options, profile,
      scope: {
        id: root.id, name: metadata?.projectName ?? root.name,
        kind: metadata?.kind ?? (root.type === 'SECTION' || root.type === 'PAGE' || /^(prj|project)_/i.test(root.name) ? 'project' : 'page'),
        profile,
      },
      canRecognize: this.canRecognize,
      hint: this.mode === 'selection' ? '' : `В проекте: ${byName(options.members!).map(n => n.name).join(', ')}`,
    };
  }
}
