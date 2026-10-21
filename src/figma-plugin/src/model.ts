export type Role = 'normal' | 'feedback' | 'pressed';
export type ButtonMode = 'on-off' | 'feedback';
export type Kind = 'project' | 'page' | 'popup' | 'popup-group' | 'popup-ref' | 'button' | 'label' | 'value' | 'level' | 'slider' | 'shape' | 'line' | 'datetime' | 'state' | 'image' | 'graphic';
export type Profile = 'tlp-pro-1025m' | 'tlp-pro-300m-portrait';
export const DATA_KEY = 'exui';
export const PROFILES = {
  'tlp-pro-1025m': { width: 1280, height: 800, title: 'TLP Pro 1025M' },
  'tlp-pro-300m-portrait': { width: 320, height: 480, title: 'TLP Pro 300M · портрет' },
} as const;
export const ROLE_ID: Record<Role, number> = { normal: 0, feedback: 1, pressed: 2 };
export interface Metadata {
  schema: 'exui-node/1' | 'exui-node/2' | 'exui-node/3'; ownerNodeId: string; kind: Kind;
  buttonMode?: ButtonMode;
  key?: string; objectId?: number; controlId?: number | null;
  projectName?: string; profile?: Profile;
  role?: Role; stateId?: number; stateName?: string;
  file?: string; resourceName?: string;
  display?: 'slider'|'gauge'|'volume-led'|'multistate'; orientation?: Orientation; min?:number; max?:number;
  pattern?:string; modal?:boolean; shownBy?:'start'|'program'|'navigation'; popup?:string; group?:string;
  navigate?:string; behavior?:Behavior;
}
export type Orientation='left-to-right'|'right-to-left'|'bottom-to-top'|'top-to-bottom';
export interface Behavior {selectionGroup?:string; enabled?:boolean; visible?:boolean}
export interface NativeStyle {trackColor?:string;trackWidth?:number;thumbColor?:string;thumbWidth?:number;thumbHeight?:number;thumbType?:'ellipse'|'rectangle'|'none';radius?:number;shape?:'rectangle'|'ellipse';strokeColor?:string;thickness?:number;pattern?:string}
export interface Font { family: 'Arial'; size: number; bold: boolean }
export interface State {
  stateId: number; name: string; role: Role; text: string; fill: string; textColor: string;
  image?: string; imageAlign?: 'top-center' | 'middle-center'; textAlign?: 'bottom-center' | 'middle-center';
}
export interface Element {
  key: string; kind: 'button' | 'label' | 'value' | 'level' | 'slider' | 'shape' | 'line' | 'datetime' | 'popup-ref' | 'graphic'; objectId: number; controlId: number | null; name: string; rect: number[];
  text?: string; textColor?: string; font?: Font; states?: State[]; press?: string;
  display?: 'slider'|'gauge'|'volume-led'|'multistate'; orientation?: Orientation; min?: number; max?: number; fillColor?: string;
  image?: string;
  native?:NativeStyle; navigate?:string;popup?:string;group?:string;behavior?:Behavior;
}
export interface Asset { key: string; file: string; resourceName: string }
export interface SingleScreen {
  schema: 'exui-screen/1' | 'exui-screen/3' | 'exui-screen/4' | 'exui-screen/5'; project: { name: string };
  page: { key: string; objectId: number; name: string; background: string };
  assets: Asset[]; elements: Element[];
}
export interface Container {key:string;objectId:number;name:string;background:string;shownBy:'start'|'program'|'navigation';elements:Element[];modal?:boolean;size?:number[];group?:string}
export interface ProjectScreen {schema:'exui-screen/5';project:{name:string};pages:Container[];popups:Container[];groups:{key:string;groupId:number;name:string}[];assets:Asset[]}
export type Screen=SingleScreen|ProjectScreen;
export function elementCount(screen:Screen):number {return 'elements' in screen?screen.elements.length:[...screen.pages,...screen.popups].reduce((n,c)=>n+c.elements.length,0);}
export const CONTROL_KINDS:Kind[]=['button','value','level','slider'];
export const ELEMENT_KINDS:Kind[]=['button','label','value','level','slider','shape','line','datetime','popup-ref','graphic'];
export function metadataSchema(value:Omit<Metadata,'schema'|'ownerNodeId'>):Metadata['schema'] {
  if(value.buttonMode!==undefined)return 'exui-node/3';
  return ['project','popup','popup-group','popup-ref','value','slider','shape','line','datetime'].includes(value.kind)||value.display||value.orientation||value.min!==undefined||value.max!==undefined||value.navigate||value.behavior||value.shownBy||value.stateId!==undefined&&value.role&&value.stateId!==ROLE_ID[value.role]?'exui-node/2':'exui-node/1';
}
export interface Bundle { profile: Profile; screen: Screen; resources: { path: string; bytes: Uint8Array }[] }
export class ExportError extends Error {
  code:string;
  constructor(code: string, message: string) { super(message); this.code=code; this.name = 'ExportError'; }
}
export function fail(code: string, message: string): never { throw new ExportError(code, message); }
export function text(value: unknown, where: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 256 || (/\0/.test(value) || /[\uD800-\uDFFF]/.test(value.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g,''))))
    fail('text', `${where}: нужна непустая строка до 256 символов без повреждённого Unicode.`);
  return value;
}
export function key(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.length > 100 || !/^[a-z][a-z0-9]*([.-][a-z0-9]+)*$/.test(value) || /[\r\n]/.test(value))
    fail('key', `${where}: ключ вида source.music, до 100 символов.`);
  return value;
}
export function integer(value: unknown, min: number, max: number, where: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    fail('id', `${where}: целое число ${min}..${max}.`);
  return value;
}
export function readMetadata(node: { id: string; name: string; getPluginData(k: string): string }): Metadata | null {
  const raw = node.getPluginData(DATA_KEY);
  if (!raw) return null;
  let data: Metadata;
  try { data = JSON.parse(raw); } catch { return fail('metadata', `${node.name}: повреждены данные Extron.`); }
  if (!data || !['exui-node/1','exui-node/2','exui-node/3'].includes(data.schema) || !['project','page','popup','popup-group',...ELEMENT_KINDS,'state','image'].includes(data.kind))
    fail('metadata', `${node.name}: неизвестная версия или тип данных Extron.`);
  if(data.schema==='exui-node/3'?(data.kind!=='button'||!['on-off','feedback'].includes(data.buttonMode!)):data.buttonMode!==undefined)
    fail('metadata',`${node.name}: повреждён тип кнопки. Используйте плагин 0.2.2 или новее.`);
  if (data.ownerNodeId !== node.id) fail('copied-node', `${node.name}: это копия. Явно назначьте ей собственные ключ и ID через «Сохранить назначение».`);
  return data;
}

export function validateButtonStates(mode:ButtonMode|undefined,states:Pick<State,'name'|'role'>[],where:string):void {
  if(!mode)return; // Saved v1/v2 buttons keep their original contract.
  const aliases:Record<string,Role>={normal:'normal',off:'normal',passive:'normal',on:'feedback',active:'feedback',feedback:'feedback',pressed:'pressed'};
  const count=(role:Role)=>states.filter(s=>s.role===role).length;
  const named=states.every(s=>aliases[s.name.toLowerCase()]===s.role);
  const pair=states.length===2&&count('normal')===1&&(count('feedback')===1||count('pressed')===1);
  const feedback=count('normal')===1&&count('feedback')===1&&((states.length===2&&count('pressed')===0)||(states.length===3&&count('pressed')===1));
  if(!named||!(mode==='on-off'?pair:feedback))
    fail('button-states',`${where}: ${mode==='on-off'?'button_/btn_ требует ровно 2 состояния: Off / On, Passive / Active или Normal / Pressed.':'feedbackbutton_/fbtn_ требует Normal / Active (или Passive / Active, Off / On); Pressed необязателен.'} Состояния не добавляются и не удаляются автоматически.`);
}
