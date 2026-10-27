import { readMetadata, type Profile } from './model.ts';
import { pageScreens, byName } from './project.ts';
import { popupContext } from './popup-binding.ts';
import { type LinkContext } from './authoring-links.ts';

// Discover project boundaries without selecting canvas nodes or changing export scope.
export function settingsProjects(profile:Profile,exportContext?:LinkContext):{id:string;name:string;context:LinkContext}[] {
  const projects=new Map<string,{id:string;name:string;context:LinkContext}>();
  const add=(context:LinkContext)=>{
    const {root}=context;
    if(projects.has(root.id))return;
    const name=readMetadata(root,{allowCopied:true})?.projectName??(root.type==='PAGE'?figma.root.name:root.name);
    projects.set(root.id,{id:root.id,name,context});
  };
  // An explicitly remembered subset takes precedence over all loose page screens.
  if(exportContext)add(exportContext);
  for(const screen of pageScreens(figma.currentPage,profile))add({...popupContext(screen,profile),profile});
  return byName([...projects.values()]);
}
