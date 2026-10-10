// GLSL snippet library: noise, SDF, palettes, cells, post. Concatenate what a scene needs.
// Sources of the ideas: Inigo Quilez articles (iquilezles.org), The Book of Shaders, lygia, Silver Air (chapel.js).
export const NOISE = /* glsl */`
float h12(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
vec2  h22(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n2(p); p=mat2(1.6,1.2,-1.2,1.6)*p+17.1; a*=.5; } return s; }
// domain warping (iq): fbm fed with fbm — silk, smoke, marble
float warp(vec2 p, float t){ vec2 q=vec2(fbm(p+vec2(0,t*.1)), fbm(p+vec2(5.2,1.3)-t*.07));
  vec2 r=vec2(fbm(p+4.*q+vec2(1.7,9.2)+t*.15), fbm(p+4.*q+vec2(8.3,2.8))); return fbm(p+4.*r); }
`;
// cosine palette (iq): a + b*cos(2pi(c*t+d)) — one line = a whole colour grade
export const PALETTE = /* glsl */`
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a+b*cos(6.28318*(c*t+d)); }
vec3 palNeon(float t){ return pal(t, vec3(.5), vec3(.5), vec3(1.), vec3(.0,.33,.67)); }
vec3 palSunset(float t){ return pal(t, vec3(.5,.3,.25), vec3(.5,.35,.3), vec3(1.,.9,.6), vec3(0.,.1,.25)); }
vec3 palIce(float t){ return pal(t, vec3(.4,.55,.7), vec3(.35,.3,.3), vec3(1.), vec3(.6,.55,.5)); }
`;
export const SDF = /* glsl */`
float sdCircle(vec2 p, float r){ return length(p)-r; }
float sdBox(vec2 p, vec2 b){ vec2 d=abs(p)-b; return length(max(d,0.))+min(max(d.x,d.y),0.); }
float sdArch(vec2 q, float w, float h){ float hs=h-w*.8660254; if(q.y<hs) return max(abs(q.x)-w*.5,-q.y);
  return max(length(q-vec2(-w*.5,hs))-w, length(q-vec2(w*.5,hs))-w); }      // gothic lancet (Silver Air)
float sdHeart(vec2 p){ p.x=abs(p.x); if(p.y+p.x>1.) return sqrt(dot(p-vec2(.25,.75),p-vec2(.25,.75)))-.3536;
  return sqrt(min(dot(p-vec2(0,1),p-vec2(0,1)), dot(p-.5*max(p.x+p.y,0.),p-.5*max(p.x+p.y,0.))))*sign(p.x-p.y); }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
`;
// Voronoi with distance to the cell border (iq) — stained glass, cracked glass, cells, mosaics
export const VORONOI = /* glsl */`
vec3 voronoi(vec2 x, float t){
  vec2 n=floor(x), f=fract(x), mg, mr; float md=8.;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(i,j), o=h22(n+g); o=.5+.4*sin(t+6.28*o);
    vec2 r=g+o-f; float d=dot(r,r); if(d<md){ md=d; mr=r; mg=g; } }
  md=8.;
  for(int j=-2;j<=2;j++) for(int i=-2;i<=2;i++){ vec2 g=mg+vec2(i,j), o=h22(n+g); o=.5+.4*sin(t+6.28*o);
    vec2 r=g+o-f; if(dot(mr-r,mr-r)>1e-5) md=min(md, dot(.5*(mr+r), normalize(r-mr))); }
  return vec3(md, h12(n+mg), 0.);                                     // x: distance to lead line, y: cell id
}
`;
// final grade: ACES tone map, vignette, film grain, chromatic aberration is done in the post pass
export const GRADE = /* glsl */`
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
`;
