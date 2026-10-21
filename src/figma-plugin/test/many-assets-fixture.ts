// Many real Artwork slots; only the Figma host/rendering is modelled.
import { createKit } from '../src/kit.ts';
import type { Profile } from '../src/model.ts';

export async function manyAssetsFixture(profile:Profile='tlp-pro-1025m',project=false) {
  const kit=await createKit(profile),page=kit.example;
  for(const child of [...page.children])child.remove();
  const master=kit.components.find(n=>n.name==='feedbackbutton_Music')!;
  const count=profile==='tlp-pro-1025m'?12:6;
  for(let i=0;i<count;i++){
    const instance=master.createInstance();page.appendChild(instance);
    instance.x=profile==='tlp-pro-1025m'?(i%4)*300:0;
    instance.y=profile==='tlp-pro-1025m'?Math.floor(i/4)*100:i*80;
  }
  if(!project)return page;
  const root=figma.createFrame();root.name='project_ManyAssets';root.appendChild(page);return root;
}
