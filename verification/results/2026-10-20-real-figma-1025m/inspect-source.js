const home=figma.currentPage.children.filter(n=>n.type==='FRAME'&&n.name==='Home'&&n.width===1280&&n.height===800);
if(home.length!==1)throw new Error('Expected exactly one original Home 1280x800');
const fields=['id','type','name','x','y','width','height','visible','rotation','opacity','fills','strokes','strokeWeight','strokeAlign','cornerRadius','characters','fontName','fontSize','textAlignHorizontal','textAlignVertical','absoluteTransform'];
function inspect(n,depth=0){const o={};for(const k of fields){try{if(k in n)o[k]=n[k]}catch{}}if('children'in n&&depth<5)o.children=n.children.map(c=>inspect(c,depth+1));return o;}
const names=['button_VolumeDown','button_VolumeUp','Volume Indicator','Volume Bar','logo_trilliant'];
const data={source:{id:home[0].id,name:home[0].name},nodes:home[0].children.filter(n=>names.includes(n.name)).map(n=>inspect(n))};
const json=JSON.stringify(data,null,2);
figma.showUI('<html><body><h2>Actual Figma volume source inspection</h2><textarea id="data" aria-label="Actual Figma source JSON" readonly style="width:100%;height:520px"></textarea><script>document.getElementById("data").value='+JSON.stringify(json).replace(/</g,'\\u003c')+'</script></body></html>',{width:680,height:620});
