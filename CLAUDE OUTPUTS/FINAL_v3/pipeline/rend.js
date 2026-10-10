// node rend.js <html> <out.mp4> <wav> | preview: node rend.js <html> --shots dir t1,t2 | --cover out.png
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const {spawn}=require('child_process');const fs=require('fs');
const [,,file,out,arg]=process.argv;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
const errs=[];p.on('pageerror',e=>errs.push(String(e)));
await p.goto('file://'+file+'?render=1');await p.evaluate(()=>window.ready);
const grab=async()=>Buffer.from((await p.evaluate(q=>document.getElementById('c').toDataURL('image/jpeg',q),0.93)).split(',')[1],'base64');
if(out=='--shots'){const [dir,ts]=[process.argv[4],process.argv[5]];fs.mkdirSync(dir,{recursive:true});
  for(const t of ts.split(',')){await p.evaluate(t=>render(t),+t);fs.writeFileSync(`${dir}/${t}.jpg`,await grab());}}
else if(out=='--cover'){await p.evaluate(()=>cover());const png=Buffer.from((await p.evaluate(()=>document.getElementById('c').toDataURL('image/png'))).split(',')[1],'base64');fs.writeFileSync(arg,png);}
else{const N=Math.round(await p.evaluate(()=>window.T_END)*30);
  const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-i',arg,'-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-profile:v','high','-c:a','aac','-b:a','160k','-shortest','-movflags','+faststart',out],{stdio:['pipe','inherit','inherit']});
  for(let i=0;i<N;i++){await p.evaluate(t=>render(t),i/30);const buf=await grab();if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));}
  ff.stdin.end();await new Promise(r=>ff.on('close',r));}
if(errs.length)console.log('ERRORS',errs);await b.close();})();
