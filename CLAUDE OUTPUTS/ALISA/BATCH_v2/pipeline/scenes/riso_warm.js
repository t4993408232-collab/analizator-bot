// Тёплый ризограф (по мотивам kit/scenes/riso.js): две краски — персик/коралл (uB.rgb) и шалфей/жёлтый (смесь по uB.w)
// растром поверх мягких пятен, бумага с волокном, сдвиг красок на сильную долю. Цвета задаются в sRGB.
// uA: x = плотность растра, y = сдвиг красок, z = скорость пятен, w = количество краски
export default /* glsl */`
float halftone(vec2 p, float v, float a, float den){ vec2 g=rot(a)*p*den; vec2 f=fract(g)-.5; return smoothstep(.06,-.06,length(f)-sqrt(v)*.62); }
vec3 scene(vec2 uv, vec2 p){
  float t=uT*uA.z;
  float b1=smoothstep(.42,.10,length(p-vec2(.28*sin(t*.7)+.12,.32*cos(t*.5)+.38))-.16*fbm(p*3.+t)+.10)*(1.+.25*uBeat);
  float b2=smoothstep(.46,.10,length(p-vec2(-.30*cos(t*.4)-.1,-.25*sin(t*.9)-.42))-.2*fbm(p*2.-t)+.16);
  float b3=smoothstep(.30,.08,length(p-vec2(.22*cos(t*.3)-.05,.05*sin(t*.6)))-.15*fbm(p*4.+t*.5))*.6;
  vec2 off=vec2(uA.y,-uA.y*.6);
  float ink1=halftone(p+off, clamp((b1+b3*.4)*uA.w,0.,1.), .26, uA.x);
  float ink2=halftone(p-off, clamp(b2*uA.w,0.,1.), 1.13, uA.x*.9);
  vec3 paper=vec3(.985,.955,.895)*(.955+.045*fbm(uv*vec2(260.,480.)));
  vec3 i1=mix(vec3(1.), uB.rgb, .55), i2=mix(vec3(1.), mix(vec3(.66,.80,.62), vec3(.99,.86,.52), uB.w), .55);
  vec3 c=paper*mix(vec3(1.), i1, ink1)*mix(vec3(1.), i2, ink2);       // краски перемножаются, как в ризо
  return pow(c, vec3(2.2));
}`;
