// node rend.js <html> <framesDir> <wi> <wn>   | node rend.js <html> --cover out.png | node rend.js <html> --shots outDir t1,t2,...
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const [,,file,a2,a3,a4]=process.argv;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+file+'?render=1');await p.evaluate(()=>window.ready);
await p.evaluate(()=>document.fonts.load('44px "Noto Color Emoji"','📘🔍'));
if(a2==='--cover'){await p.evaluate(()=>renderCover());await p.screenshot({path:a3,type:'png'});}
else if(a2==='--shots'){for(const t of a4.split(',')){await p.evaluate(t=>render(t),+t);await p.screenshot({path:`${a3}/f_${t}.jpg`,type:'jpeg',quality:80});}}
else{const N=Math.round(await p.evaluate(()=>window.T_END)*30);
  for(let i=+a3;i<N;i+=+a4){await p.evaluate(t=>render(t),i/30);await p.screenshot({path:`${a2}/${String(i).padStart(5,'0')}.jpg`,type:'jpeg',quality:92});}}
if(errs.length)console.error('PAGE ERRORS',file,errs);await b.close();})();
