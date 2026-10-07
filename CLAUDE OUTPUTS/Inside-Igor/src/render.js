// node render.js <worker> <workers>  → seg_<worker>.mp4 (кадры по порядку, без звука)
const puppeteer=require('puppeteer-core'); const {spawn}=require('child_process');
const FPS=30, DUR=148, TOTAL=FPS*DUR; const w=+process.argv[2], W=+process.argv[3];
const per=Math.ceil(TOTAL/W), f0=w*per, f1=Math.min(TOTAL,f0+per);
(async()=>{
 const b=await puppeteer.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const p=await b.newPage(); await p.setViewport({width:1080,height:1920});
 p.on('pageerror',e=>console.error('ERR',e.message));
 await p.goto('file://'+__dirname+'/film.html?render=1'); await p.waitForFunction('window.READY');
 const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-threads','1',`${__dirname}/seg_${w}.mp4`],{stdio:['pipe','inherit','inherit']});
 const t0=Date.now();
 for(let f=f0;f<f1;f++){
   await p.evaluate(t=>renderAt(t),f/FPS);
   const buf=await p.screenshot({type:'jpeg',quality:95});
   if(!ff.stdin.write(buf)) await new Promise(r=>ff.stdin.once('drain',r));
   if((f-f0)%150===0) console.log(`w${w} ${f-f0}/${f1-f0} ${((Date.now()-t0)/1000).toFixed(0)}s`);
 }
 ff.stdin.end(); await new Promise(r=>ff.on('close',r)); await b.close(); console.log(`w${w} done`);
})();
