const puppeteer=require('puppeteer-core');
const times=process.argv.slice(2).map(Number);
(async()=>{
 const b=await puppeteer.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const p=await b.newPage(); await p.setViewport({width:1080,height:1920});
 p.on('console',m=>console.log('PAGE',m.text())); p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+__dirname+'/film.html?render=1'); await p.waitForFunction('window.READY');
 for(const t of times){const s=Date.now(); await p.evaluate(t=>renderAt(t),t); await p.screenshot({path:`${__dirname}/stills/s_${String(t).padStart(6,'0')}.jpg`,type:'jpeg',quality:85}); console.log(t,Date.now()-s,'ms');}
 await b.close();
})();
