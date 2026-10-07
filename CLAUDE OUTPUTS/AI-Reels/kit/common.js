/* ===== AI-Reels common kit (paste verbatim into each video's <script>) ===== */
const W=1080,H=1920;
const cv=document.getElementById('c'),ctx=cv.getContext('2d');
const SANS='Inter, "DejaVu Sans", sans-serif', MONO='"DejaVu Sans Mono", monospace', SERIF='"DejaVu Serif", Georgia, serif';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const eo=t=>1-Math.pow(1-t,3);
const seg=(t,a,b)=>clamp((t-a)/(b-a));
const env=(t,a,b,f=.5)=>clamp((t-a)/f)*clamp((b-t)/f);
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
function rng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296;};}
function hex(h){const n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255];}
function mixHex(a,b,t){const A=hex(a),B=hex(b);return'#'+A.map((v,i)=>Math.round(lerp(v,B[i],t)).toString(16).padStart(2,'0')).join('');}
function rgba(h,a){const[r,g,b]=hex(h);return`rgba(${r},${g},${b},${a})`;}
function setFont(size,weight=500,family=SANS){ctx.font=`${weight} ${size}px ${family}`;}
function wrap(s,maxW){const out=[];for(const para of String(s).split('\n')){const words=para.split(' ');let line='';
  for(const w of words){const test=line?line+' '+w:w;if(ctx.measureText(test).width>maxW&&line){out.push(line);line=w;}else line=test;}
  out.push(line);}return out;}
/* text(s,x,y,{size,weight,color,alpha,align,family,maxW,lh,glow,shadow}) – multi-line centered vertically on y */
function text(s,x,y,o={}){
  const{size=48,weight=500,color='#fff',alpha=1,align='center',family=SANS,maxW=0,lh=1.25,glow=0,shadow='rgba(0,0,0,.8)'}=o;
  if(alpha<=.002)return;
  ctx.save();ctx.globalAlpha*=alpha;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';
  setFont(size,weight,family);ctx.shadowColor=glow?color:shadow;ctx.shadowBlur=glow||(shadow?16:0);
  const lines=maxW?wrap(s,maxW):String(s).split('\n');const off=(lines.length-1)*size*lh/2;
  lines.forEach((l,i)=>ctx.fillText(l,x,y-off+i*size*lh));ctx.restore();
}
function rrect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function glowDot(x,y,r,color,a){if(a<=0)return;const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,rgba(color,a));g.addColorStop(1,rgba(color,0));ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);}
/* film grain / noise overlay, deterministic per frame */
const _grain=(()=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');const d=g.createImageData(256,256);const r=rng(99);
  for(let i=0;i<d.data.length;i+=4){const v=r()*255;d.data[i]=d.data[i+1]=d.data[i+2]=v;d.data[i+3]=255;}g.putImageData(d,0,0);return c;})();
function grain(t,alpha=.08,mode='overlay'){ctx.save();ctx.globalAlpha=alpha;ctx.globalCompositeOperation=mode;
  const ox=Math.floor(hash(Math.floor(t*24))*256),oy=Math.floor(hash(Math.floor(t*24)+7)*256);
  ctx.translate(-ox,-oy);ctx.fillStyle=ctx.createPattern(_grain,'repeat');ctx.fillRect(0,0,W+256,H+256);ctx.restore();}
/* Channel watermark – call LAST in render(t), every frame. dark=true for light backgrounds */
function watermark(dark=false){
  const label='t.me/eventstory_by';ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;
  setFont(34,700);const tw=ctx.measureText(label).width,iw=46,pw=tw+iw+56,ph=68,x=540-pw/2,y=1812;
  rrect(x,y,pw,ph,34);ctx.fillStyle=dark?'rgba(255,255,255,.7)':'rgba(8,10,24,.55)';ctx.fill();
  ctx.strokeStyle=dark?'rgba(0,0,0,.25)':'rgba(255,255,255,.28)';ctx.lineWidth=2;ctx.stroke();
  const cx=x+28+iw/2,cy=y+ph/2;ctx.fillStyle='#2aabee';ctx.beginPath();ctx.arc(cx,cy,iw/2,0,7);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(cx-13,cy+1);ctx.lineTo(cx+12,cy-10);ctx.lineTo(cx+7,cy+12);ctx.lineTo(cx-1,cy+5);ctx.closePath();ctx.fill();
  ctx.fillStyle=dark?'rgba(10,10,20,.9)':'rgba(255,255,255,.92)';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(label,x+28+iw+14,cy+1);ctx.restore();
}
/* boot(render, T_END): exposes window.render/T_END/ready; plays in real time unless ?render */
function boot(render,T_END){
  window.render=t=>{ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;render(t);};
  window.T_END=T_END;const isRender=location.search.includes('render');if(isRender)document.body.classList.add('render');
  const fonts=['400 40px Inter','500 40px Inter','600 40px Inter','700 40px Inter','800 40px Inter','400 40px "DejaVu Sans Mono"','700 40px "DejaVu Sans Mono"','400 40px "DejaVu Serif"','700 40px "DejaVu Serif"'];
  window.ready=Promise.all(fonts.map(f=>document.fonts.load(f))).then(()=>{window.render(0);return true;});
  if(!isRender){let t0=null;cv.addEventListener('click',()=>t0=null);
    window.ready.then(()=>{const loop=ts=>{if(t0===null)t0=ts;window.render(((ts-t0)/1000)%T_END);requestAnimationFrame(loop);};requestAnimationFrame(loop);});}
}
/* ===== end kit ===== */
