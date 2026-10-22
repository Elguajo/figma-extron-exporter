import { frame,label } from './expanded-fixture.ts';
import { PROFILES,type Profile } from '../src/model.ts';
export function twoScreens(profile:Profile='tlp-pro-1025m'){
 const {width,height}=PROFILES[profile],main=frame(null,'screen_Main',120,80,width,height,'#101010'),audio=frame(null,'screen_AudioControl',width+180,80,width,height,'#101010');
 label(main,'text_Title','Main',12,12,100,30);label(audio,'text_Title','Audio',12,12,100,30);
 const button=frame(main,'button_AudioControl',20,60,90,40,'');
 for(const [i,name] of ['Normal','Pressed'].entries()){const state=frame(button,name,0,0,90,40,i?'#0077AA':'#303030'),text=label(state,'Text','Audio',0,0,90,40);text.textAlignHorizontal='CENTER';state.visible=i===0;}
 return {main,audio,button};
}
