// node rend.js <html> <framesDir> <wi> <wn>   | node rend.js <html> --cover out.png | node rend.js <html> --shots outDir t1,t2,...
// Кадры берутся прямо с canvas (toDataURL JPEG) — в разы быстрее page.screenshot.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const fs=require('fs');
const [,,file,a2,a3,a4,a5]=process.argv;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+file+'?render=1');await p.evaluate(()=>window.ready);
await p.evaluate(()=>document.fonts.load('44px "Noto Color Emoji"','📘🔍🤖🐈'));
if(a2==='--cover'){await p.evaluate(()=>renderCover());await p.screenshot({path:a3,type:'png'});}
else if(a2==='--shots'){for(const t of a4.split(',')){await p.evaluate(t=>render(t),+t);await p.screenshot({path:`${a3}/f_${t}.jpg`,type:'jpeg',quality:80});}}
else{const N=Math.min(+(a5||1e9),Math.round(await p.evaluate(()=>window.T_END)*30));const wi=+a3,wn=+a4;
  for(let i=wi;i<N;i+=wn*8){const ids=[];for(let k=0;k<8;k++){const j=i+k*wn;if(j<N)ids.push(j);}
    const urls=await p.evaluate(ids=>ids.map(j=>{render(j/30);return document.getElementById('c').toDataURL('image/jpeg',.93);}),ids);
    urls.forEach((u,k)=>fs.writeFileSync(`${a2}/${String(ids[k]).padStart(5,'0')}.jpg`,Buffer.from(u.split(',')[1],'base64')));}}
if(errs.length)console.error('PAGE ERRORS',file,errs);await b.close();})();
