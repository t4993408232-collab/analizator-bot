// node preview.js <html> <outDir> t1,t2,...   -> f_<t>.jpg + sheet.jpg, prints page errors
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const {execSync}=require('child_process');
(async()=>{const [,,file,out,list]=process.argv;const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('file://'+file+'?render=1');await p.evaluate(()=>window.ready);const ts=list.split(',').map(Number);const fs=[];
for(const t of ts){await p.evaluate(t=>render(t),t);const f=`${out}/f_${t}.jpg`;await p.screenshot({path:f,type:'jpeg',quality:75});fs.push(f);}
await b.close();
execSync(`python3 -c "
from PIL import Image;import sys
fs=sys.argv[1:];n=len(fs);cols=min(n,6);rows=(n+cols-1)//cols
m=Image.new('RGB',(270*cols,480*rows))
for i,f in enumerate(fs):m.paste(Image.open(f).resize((270,480)),((i%cols)*270,(i//cols)*480))
m.save('${out}/sheet.jpg')" ${fs.join(' ')}`);
console.log('errors:',JSON.stringify(errs));})();
