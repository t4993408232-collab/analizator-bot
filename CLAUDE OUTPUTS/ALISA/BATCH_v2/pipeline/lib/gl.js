// Copied from Code-Video kit (lib/gl.js); ALISA change: `tonemap` switch in POST.
// Tiny WebGL2 engine: scene shaders -> float targets -> transition -> post (mip bloom, aberration, grain, vignette, ACES).
// No three.js needed for full-screen shader clips; for meshes/3D swap this for three.js + EffectComposer like Silver Air.
import { NOISE, PALETTE, SDF, VORONOI, GRADE } from './glsl.js';

const VS = `#version 300 es
in vec2 p; out vec2 vUv; void main(){ vUv=p*.5+.5; gl_Position=vec4(p,0,1); }`;
const HEAD = `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform float uT, uBeat, uBar, uP, uSeed; uniform vec2 uRes; uniform vec4 uA, uB;
${NOISE}${PALETTE}${SDF}${VORONOI}${GRADE}`;

export function createEngine(canvas, W, H) {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
  if (!gl) throw new Error('WebGL2 unavailable');
  gl.getExtension('EXT_color_buffer_float'); gl.getExtension('OES_texture_float_linear');
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'));
    return s; };
  const program = fs => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const loc = {}; return { p, u: n => loc[n] ??= gl.getUniformLocation(p, n) }; };
  const target = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(W, H))) + 1, gl.RGBA16F, W, H);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, fb }; };
  const RT = [target(), target(), target()];
  const draw = (prog, fb, set) => { gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, W, H); gl.useProgram(prog.p);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); set(prog); gl.drawArrays(gl.TRIANGLES, 0, 3); };
  const tex = (prog, name, unit, t) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(prog.u(name), unit); };

  const scenes = new Map();
  const TRANS = program(`${HEAD}
uniform sampler2D A, B; uniform int kind; uniform float mixv;
void main(){ vec2 uv=vUv; float m=mixv; vec3 a, b;
  if(kind==1){ float n=fbm(uv*6.)*.35; float e=smoothstep(m*1.35-.2, m*1.35-.2+.08, uv.x*.65+n); a=texture(A,uv).rgb; b=texture(B,uv).rgb;   // burn wipe
    float edge=exp(-abs(uv.x*.65+n-(m*1.35-.16))*60.); o=vec4(mix(b,a,e)+vec3(2.,.8,.25)*edge*step(.001,m)*step(m,.999),1.); return; }
  if(kind==2){ vec2 c=uv-.5; c.x*=uRes.x/uRes.y; float r=length(c); float e=smoothstep(m*.9, m*.9+.02, r);   // iris
    o=vec4(mix(texture(B,uv).rgb, texture(A,uv).rgb, e),1.); return; }
  if(kind==3){ float g=step(.5, h12(vec2(floor(uv.y*40.), floor(m*24.)))) * sin(m*3.1416);            // glitch slices
    vec2 d=vec2(g*.08*(h12(vec2(floor(uv.y*40.),3.))-.5),0.); a=texture(A,uv+d).rgb; b=texture(B,uv-d).rgb;
    o=vec4(mix(a,b,step(h12(vec2(floor(uv.y*20.),floor(m*10.))),m)),1.); return; }
  o=vec4(mix(texture(A,uv).rgb, texture(B,uv).rgb, m),1.); }`);
  const POST = program(`${HEAD}
uniform sampler2D S; uniform float bloom, ca, grain, vig, flash, exposure, tonemap;
void main(){ vec2 uv=vUv, c=uv-.5;
  vec3 col=vec3(texture(S,uv-c*ca).r, texture(S,uv).g, texture(S,uv+c*ca).b);
  vec3 bl=vec3(0.); float w=0.; for(int i=2;i<8;i++){ float k=1./float(i); bl+=textureLod(S,uv,float(i)).rgb*k; w+=k; }   // mip-chain bloom
  bl/=w; col+=max(bl-.35,0.)*bloom*.6;
  col*=exposure; col=tonemap>.5? aces(col+flash) : clamp(col+flash,0.,1.);   // ALISA: tonemap=0 keeps light pastel paper
  col*=mix(1., smoothstep(.95,.25,length(c*vec2(uRes.x/uRes.y,1.))), vig);
  col+=(h12(uv*uRes+fract(uT*13.)*91.)-.5)*grain;
  o=vec4(pow(col,vec3(1./2.2)),1.); }`);

  return {
    addScene(name, body) { scenes.set(name, program(`${HEAD}\n${body}\nvoid main(){ o=vec4(scene(vUv, (vUv-.5)*vec2(uRes.x/uRes.y,1.)),1.); }`)); },
    // state: { a: {scene, u}, b?: {scene, u}, trans?: {kind, m}, post: {...} }
    render({ a, b, trans, post }) {
      const run = (s, rt) => draw(scenes.get(s.scene), rt.fb, p => {
        gl.uniform2f(p.u('uRes'), W, H); for (const [k, v] of Object.entries(s.u)) {
          const loc = p.u(k); if (!loc) continue; Array.isArray(v) ? gl[`uniform${v.length}fv`](loc, v) : gl.uniform1f(loc, v); } });
      const mip = rt => { gl.bindTexture(gl.TEXTURE_2D, rt.t); gl.generateMipmap(gl.TEXTURE_2D); };
      run(a, RT[0]); let src = RT[0];
      if (b && trans) { run(b, RT[1]); draw(TRANS, RT[2].fb, p => { tex(p, 'A', 0, RT[0].t); tex(p, 'B', 1, RT[1].t);
        gl.uniform1i(p.u('kind'), trans.kind); gl.uniform1f(p.u('mixv'), trans.m); gl.uniform2f(p.u('uRes'), W, H); }); src = RT[2]; }
      mip(src);
      draw(POST, null, p => { tex(p, 'S', 0, src.t); gl.uniform2f(p.u('uRes'), W, H); gl.uniform1f(p.u('uT'), a.u.uT ?? 0);
        for (const [k, v] of Object.entries(post)) gl.uniform1f(p.u(k), v); });
    },
  };
}
