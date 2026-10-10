// Risograph / print: two ink layers (pink + teal) as rotated halftone dots over soft blobs, paper texture, misregistration.
// uA: x = dot density, y = misregistration, z = blob motion, w = ink amount
export default /* glsl */`
float halftone(vec2 p, float v, float a, float den){ vec2 g=rot(a)*p*den; vec2 f=fract(g)-.5; return smoothstep(.05,-.05,length(f)-sqrt(v)*.62); }
vec3 scene(vec2 uv, vec2 p){
  float t=uT*uA.z;
  float b1=smoothstep(.36,.12,length(p-vec2(.25*sin(t*.7),.2*cos(t*.5)))-.15*fbm(p*3.+t)+.12)*(1.+.3*uBeat);
  float b2=smoothstep(.4,.12,length(p-vec2(-.3*cos(t*.4),-.15*sin(t*.9)))-.2*fbm(p*2.-t)+.18);
  vec2 off=vec2(uA.y,-uA.y*.6);
  float ink1=halftone(p+off, clamp(b1*uA.w,0.,1.), .26, uA.x);
  float ink2=halftone(p-off, clamp(b2*uA.w,0.,1.), 1.13, uA.x*.9);
  vec3 paper=vec3(.96,.93,.86)*(.92+.08*fbm(uv*400.));
  vec3 c=paper;
  c*=mix(vec3(1.), vec3(1.,.28,.55), ink1);                            // multiply inks like real riso
  c*=mix(vec3(1.), vec3(0.,.55,.6), ink2);
  return c*.9;
}`;
