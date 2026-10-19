export type Role = 'normal' | 'feedback' | 'pressed';
export type Kind = 'page' | 'button' | 'label' | 'level' | 'state' | 'image' | 'graphic';
export type Profile = 'tlp-pro-1025m' | 'tlp-pro-300m-portrait';
export const DATA_KEY = 'exui';
export const PROFILES = {
  'tlp-pro-1025m': { width: 1280, height: 800, title: 'TLP Pro 1025M' },
  'tlp-pro-300m-portrait': { width: 320, height: 480, title: 'TLP Pro 300M · портрет' },
} as const;
export const ROLE_ID: Record<Role, number> = { normal: 0, feedback: 1, pressed: 2 };
export interface Metadata {
  schema: 'exui-node/1'; ownerNodeId: string; kind: Kind;
  key?: string; objectId?: number; controlId?: number | null;
  projectName?: string; profile?: Profile;
  role?: Role; stateId?: number; stateName?: string;
  file?: string; resourceName?: string;
}
export interface Font { family: 'Arial'; size: number; bold: boolean }
export interface State {
  stateId: number; name: string; role: Role; text: string; fill: string; textColor: string;
  image?: string; imageAlign?: 'top-center' | 'middle-center'; textAlign?: 'bottom-center' | 'middle-center';
}
export interface Element {
  key: string; kind: 'button' | 'label' | 'level' | 'graphic'; objectId: number; controlId: number | null; name: string; rect: number[];
  text?: string; textColor?: string; font?: Font; states?: State[]; press?: string;
  display?: 'slider'; orientation?: 'left-to-right'; min?: 0; max?: 100; fillColor?: string;
  image?: string;
}
export interface Asset { key: string; file: string; resourceName: string }
export interface Screen {
  schema: 'exui-screen/1' | 'exui-screen/3' | 'exui-screen/4'; project: { name: string };
  page: { key: string; objectId: number; name: string; background: string };
  assets: Asset[]; elements: Element[];
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
  if (!data || data.schema !== 'exui-node/1' || !['page','button','label','level','state','image','graphic'].includes(data.kind))
    fail('metadata', `${node.name}: неизвестная версия или тип данных Extron.`);
  if (data.ownerNodeId !== node.id) fail('copied-node', `${node.name}: это копия. Явно назначьте ей собственные ключ и ID через «Сохранить назначение».`);
  return data;
}
