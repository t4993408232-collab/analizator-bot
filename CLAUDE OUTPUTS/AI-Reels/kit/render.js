// node render.js <html> <framesDir> <workerIndex> <workerCount>
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const [,,file,out,wi,wn]=process.argv;const FPS=30;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.goto('file://'+file+'?render=1');await p.evaluate(()=>window.ready);const N=Math.round(await p.evaluate(()=>window.T_END)*FPS);
for(let i=+wi;i<N;i+=+wn){await p.evaluate(t=>render(t),i/FPS);
await p.screenshot({path:`${out}/${String(i).padStart(5,'0')}.jpg`,type:'jpeg',quality:92});}
await b.close();})();
