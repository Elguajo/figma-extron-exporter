import { fakeFigma } from './fake-figma.ts';
import { png } from './kit-fixture.ts';
import type { Profile } from '../src/model.ts';

export const paint = (hex: string): SolidPaint => ({type: 'SOLID', color: {r: parseInt(hex.slice(1,3),16)/255, g: parseInt(hex.slice(3,5),16)/255, b: parseInt(hex.slice(5,7),16)/255}});
export function authorButtons(profile: Profile = 'tlp-pro-1025m', fake = fakeFigma()) {
  const api = fake.api as unknown as PluginAPI;
  const root = api.createFrame();root.name = 'screen_Home';root.resize(profile === 'tlp-pro-1025m' ? 1280 : 320, profile === 'tlp-pro-1025m' ? 800 : 480);root.fills = [paint('#101112')];
  const styles = api.createFrame();styles.name = 'Button Styles';styles.resize(220,60);styles.x = root.width + 100;
  const normal = api.createRectangle();normal.name = 'Passive';normal.resize(90,40);normal.fills = [paint('#303030')];normal.strokes = [paint('#606060')];normal.strokeAlign = 'INSIDE';normal.strokeWeight = 1;normal.cornerRadius = 8;styles.appendChild(normal);
  const active = normal.clone();active.name = 'Active';styles.appendChild(active);active.x = 110;active.fills = [paint('#0077AA')];active.strokes = [paint('#00BBFF')];active.strokeWeight = 2;
  const buttons = ['button_AudioControl', 'feedbackbutton_Power'].map((name,i) => {
    const bg = api.createRectangle();bg.name = 'Rectangle 11';bg.resize(120,80);bg.fills = [paint('#222222')];bg.cornerRadius = 4;
    const label = api.createText();label.name = 'txt_title.place';label.resize(100,24);label.characters = i ? 'Power' : 'Audio';label.fills = [paint('#FFFFFF')];label.x = 10;label.y = 50;
    const vector = api.createRectangle();vector.name = 'Vector';vector.resize(20,20);vector.x = 50;vector.y = 10;vector.fills = [paint('#FFFFFF')];
    const icon = api.group([vector], api.currentPage);icon.name = 'Voice';
    const group = api.group([bg,icon,label], root);group.name = name;group.x = 10;group.y = 10 + i*100;
    return group;
  });
  fake.setRenderHook(node => png(Math.round(node.width),Math.round(node.height)));
  return {...fake, root, styles, normal, active, buttons};
}
