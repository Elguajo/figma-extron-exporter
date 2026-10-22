import { fail } from './model.ts';

// Extron stores 8-bit ARGB. Combine opacity before rounding the alpha byte.
export function paintColor(paint:SolidPaint,where:string,opacity=1):string {
  const alpha=paint.opacity??1,{r,g,b}=paint.color;
  if([alpha,opacity,r,g,b].some(v=>!Number.isFinite(v)||v<0||v>1))
    fail('color',`${where}: некорректный цвет или непрозрачность; нужны значения 0..1.`);
  const hex=[alpha*opacity,r,g,b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('').toUpperCase();
  return alpha*opacity===1?'#'+hex.slice(2):'#'+hex;
}
