import { PROFILES,type Profile } from '../src/model.ts';
import { tag } from '../src/demo.ts';
export const solid=(hex:string):SolidPaint=>({type:'SOLID',color:{r:parseInt(hex.slice(1,3),16)/255,g:parseInt(hex.slice(3,5),16)/255,b:parseInt(hex.slice(5,7),16)/255}});
export function frame(parent:FrameNode|null,name:string,x:number,y:number,w:number,h:number,fill='#202020') {const n=figma.createFrame();if(parent)parent.appendChild(n);n.name=name;n.x=x;n.y=y;n.resize(w,h);n.fills=fill?[solid(fill)]:[];n.strokes=[];return n;}
export function label(parent:FrameNode,name:string,value:string,x:number,y:number,w:number,h:number){const n=figma.createText();parent.appendChild(n);n.name=name;n.characters=value;n.x=x;n.y=y;n.resize(w,h);n.fontName={family:'Arial',style:'Regular'};n.fontSize=16;n.textAlignHorizontal='LEFT';n.textAlignVertical='CENTER';n.fills=[solid('#FFFFFF')];return n;}
export function multistate(parent:FrameNode,name:string,x:number,y:number,pressed=false){const n=frame(parent,name,x,y,90,40,'');const names=['Normal','state_Ready','state_Error',...(pressed?['Pressed']:[])];names.forEach((name,i)=>{const s=frame(n,name,0,0,90,40,['#202020','#008000','#D00000','#FFCC00'][i]);s.visible=i===0;const l=label(s,'Text',String(i),0,0,90,40);l.textAlignHorizontal='CENTER';});return n;}
export function expandedFixture(profile:Profile='tlp-pro-1025m') {
 const canvas=PROFILES[profile],root=frame(null,'Home',0,0,canvas.width,canvas.height,'#101010');
 const slider=frame(root,'slider_Volume',20,20,260,32,'');const track=frame(slider,'Track',0,8,260,16,'#292D30');track.cornerRadius=8;const fill=frame(slider,'Fill',0,8,104,16,'#F47700');fill.cornerRadius=8;const thumb=frame(slider,'Thumb',100,2,28,28,'#FFFFFF');thumb.cornerRadius=14;
 label(root,'value_VolumeValue','42%',20,60,100,28);
 const shape=frame(root,'shape_Card',20,100,100,40,'#292D30');shape.cornerRadius=10;shape.strokes=[solid('#888888')];shape.strokeWeight=1;shape.strokeAlign='INSIDE';
 frame(root,'line_Divider',20,150,260,2,'#666666');
 label(root,'datetime_Clock','dd.MM.yyyy HH:mm',20,165,260,28);
 frame(root,'gauge_Signal',20,210,260,16,'#00FF00');
 frame(root,'volumeled_Output',20,245,260,16,'#00FF00');
 multistate(root,'multilevel_Status',20,280);
 multistate(root,'button_Connection',20,340,true);
 return root;
}
export function projectFixture(profile:Profile='tlp-pro-1025m') {
 const canvas=PROFILES[profile],project=frame(null,'project_Trilliant',0,0,canvas.width*3,canvas.height*3,''),home=expandedFixture(profile);project.appendChild(home);
 const settings=frame(project,'screen_Settings',canvas.width+50,0,canvas.width,canvas.height,'#101010');label(settings,'text_Title','Settings',10,10,200,30);
 const popup=frame(project,'popup_Sources',0,canvas.height+50,80,60,'#202020');label(popup,'text_Title','Sources',5,5,70,30);
 frame(home,'popupref_Sources',200,65,80,60,'');
 const modal=frame(project,'modalpopup_Confirm',canvas.width+50,canvas.height+50,canvas.width,canvas.height,'#202020');label(modal,'text_Title','Confirm?',10,10,200,30);
 const group=frame(project,'popupgroup_Zones',0,canvas.height*2+100,200,100,'');
 for(const name of ['Hall','Terrace']){const p=frame(group,'popup_'+name,0,0,80,60,'#202020');label(p,'text_Title',name,5,5,70,30);}
 const ref=frame(home,'popupref_ZonePanel',200,125,80,60,'');tag(ref,{kind:'popup-ref',key:'home.zonepanel',objectId:500,controlId:null,group:'group.zones'});
 return project;
}
export function verticalFixture(profile:Profile='tlp-pro-1025m') {
 const root=expandedFixture(profile),slider=root.children[0] as FrameNode;slider.resize(32,260);
 const track=slider.children[0] as FrameNode,fill=slider.children[1] as FrameNode,thumb=slider.children[2] as FrameNode;
 track.resize(16,260);track.x=8;track.y=0;fill.resize(16,104);fill.x=8;fill.y=156;thumb.x=2;thumb.y=132;
 thumb.resize(28,20);thumb.cornerRadius=0;
 tag(slider,{kind:'slider',key:'home.volume',objectId:1,controlId:8101,orientation:'bottom-to-top',min:10,max:255});
 const card=root.children.find(n=>n.name==='shape_Card')!;card.remove();const ellipse=figma.createEllipse();root.appendChild(ellipse);ellipse.name='shape_Card';ellipse.x=20;ellipse.y=100;ellipse.resize(100,40);ellipse.fills=[solid('#292D30')];ellipse.strokes=[solid('#888888')];ellipse.strokeWeight=1;ellipse.strokeAlign='INSIDE';
 const line=root.children.find(n=>n.name==='line_Divider') as FrameNode;line.resize(2,100);
 return root;
}
