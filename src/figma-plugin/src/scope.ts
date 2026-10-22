import { PROFILES, fail, readMetadata, type Profile, type Metadata } from './model.ts';
import { byName, pageScreens, type ProjectNode, type ProjectOptions } from './project.ts';

export type ScopeMode = 'selection' | 'selected-frames' | 'page';
export const PAGE_SETTINGS_KEY='exui-page-settings';
export interface ScopeContext {
  root: ProjectNode;
  options: ProjectOptions;
  profile: Profile;
  scope: { id: string; name: string; kind: string; profile: Profile };
  canRecognize: boolean;
  hint: string;
}
const stored = (node: BaseNode) => readMetadata(node, { allowCopied: true });
// Popup prefixes already identify the container before assignments are saved.
// A saved assignment takes precedence, just as it does during recognition.
export function selectionKind(node:BaseNode):Metadata['kind']|undefined {
  return stored(node)?.kind ?? (/^(pop|popup|mdl|modalpopup)_/i.test(node.name)?'popup':/^(pgrp|popupgroup)_/i.test(node.name)?'popup-group':/^(pr|popupref)_/i.test(node.name)?'popup-ref':undefined);
}
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
    if(!selectionKind(current)&&current.type==='FRAME'&&!/^(button|btn|feedbackbutton|fbtn|slider|sld)_/i.test(current.name)){const candidate=current;if(Object.values(PROFILES).some(p=>candidate.width===p.width&&candidate.height===p.height))found=candidate;}
    current=current.parent;
  }
  if(found)return found;
  return fail('screen-unprepared','У выбранного макета ещё нет назначения Extron. Выберите секцию проекта или внешний Frame и профиль, затем нажмите «Распознать по именам» и сохраните назначения. Для ручной подготовки экрана используйте «Подготовить выбранный экран» и «Назначение выбранного элемента».');
}

export class ExportScope {
  mode: ScopeMode = 'selection';
  profile: Profile = 'tlp-pro-1025m';
  private selectedProject: { page: PageNode; nodes: readonly FrameNode[] } | undefined;
  constructor(){this.restore();}
  private restore():void {
    this.mode='selection';this.profile='tlp-pro-1025m';this.selectedProject=undefined;
    try {
      const page=figma.currentPage,raw=page.getPluginData(PAGE_SETTINGS_KEY);if(!raw)return;
      const saved=JSON.parse(raw);
      if(saved?.schema!=='exui-page-settings/1'||saved.pageId!==page.id||!Object.prototype.hasOwnProperty.call(PROFILES,saved.profile)||!['selection','selected-frames','page'].includes(saved.mode)||!Array.isArray(saved.members)||saved.members.some((id:unknown)=>typeof id!=='string'))return;
      this.profile=saved.profile;this.mode=saved.mode;
      const children=new Map<string,FrameNode>(),wanted=new Set<string>(saved.members);
      function visit(node:SceneNode){if(node.type==='FRAME'&&wanted.has(node.id))children.set(node.id,node);if('children' in node)for(const child of node.children)visit(child);}
      for(const child of page.children)visit(child);
      const nodes=Array.from(new Set<string>(saved.members)).map(id=>children.get(id)).filter((n):n is FrameNode=>!!n);
      if(nodes.length)this.selectedProject={page,nodes};
      else if(this.mode==='selected-frames')this.mode='selection';
    }catch{ /* Corrupt UI preferences must not erase layer assignments or block export. */ }
  }
  persist(profile:Profile=this.profile):void {
    const page=figma.currentPage;
    const members=this.selectedProject?.page.id===page.id?this.selectedProject.nodes.filter(n=>!n.removed&&pageOf(n)?.id===page.id).map(n=>n.id):[];
    const value=JSON.stringify({schema:'exui-page-settings/1',pageId:page.id,mode:this.mode,profile,members});
    if(page.getPluginData(PAGE_SETTINGS_KEY)!==value)page.setPluginData(PAGE_SETTINGS_KEY,value);
    this.profile=profile;
  }
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
  reset(): void { this.restore(); }
  useProject(root:ProjectNode,options:ProjectOptions):void {
    if(root.type==='PAGE'){
      const nodes=options.members??[];
      if(nodes.some(n=>n.type!=='FRAME'))fail('selection','В проекте ожидаются Frame экранов и popup.');
      this.selectedProject={page:root,nodes:nodes as readonly FrameNode[]};this.mode='selected-frames';
    }else this.mode='selection';
  }
  refreshSelection(): void {
    const selection = figma.currentPage.selection;
    if (this.mode === 'selection' && selection.length > 1 && selection.every(n => n.type === 'FRAME'&&!['button','state','graphic','image','slider','shape','line','level','popup-ref'].includes(selectionKind(n)??'')&&!/^(button|btn|feedbackbutton|fbtn)_/i.test(n.name))) this.mode = 'selected-frames';
    if (this.mode === 'selected-frames') this.rememberFrames();
  }
  get canRecognize(): boolean {
    const node = figma.currentPage.selection.length === 1 ? figma.currentPage.selection[0] : undefined;
    const kind = node ? selectionKind(node) : undefined;
    return this.mode !== 'selection' || !!node && ['FRAME', 'SECTION'].includes(node.type) && (!kind || ['page', 'project'].includes(kind));
  }
  get canPrepare(): boolean {
    const node = figma.currentPage.selection.length === 1 ? figma.currentPage.selection[0] : undefined;
    return !!node && node.type==='FRAME' && !selectionKind(node);
  }
  resolveButtons(): Pick<ScopeContext, 'root' | 'options' | 'scope'> {
    // Styling needs only the selected container, even before it belongs to a
    // valid export project. Keep batch export modes and their members intact.
    if (this.mode === 'selection') {
      let node: BaseNode | null = selected();
      while (node && node.type !== 'PAGE') {
        const metadata = stored(node);
        const kind = selectionKind(node);
        if (node.type === 'FRAME' && (kind === 'popup' || kind === 'popup-group')) {
          return {root:node,options:{},scope:{id:node.id,name:node.name,kind,profile:metadata?.profile??this.profile}};
        }
        if (kind === 'page' || kind === 'project' || node.type === 'SECTION') break;
        node = node.parent;
      }
    }
    return this.resolve();
  }
  resolve(forRecognition = false): ScopeContext {
    if(forRecognition&&!this.canRecognize)fail('selection','Для распознавания выберите секцию проекта или внешний Frame экрана. Popup, группы и места popup распознаются в составе проекта.');
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
