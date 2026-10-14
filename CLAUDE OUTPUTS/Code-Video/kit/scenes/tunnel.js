// Neon tunnel: polar-mapped infinite corridor, rings that hit on each beat, synthwave grid feeling.
// uA: x = speed, y = twist, z = ring glow, w = hue
export default /* glsl */`
vec3 scene(vec2 uv, vec2 p){
  p*=rot(uT*.1*uA.y);
  float r=length(p), a=atan(p.y,p.x);
  float z=.35/r + uT*uA.x;                                             // depth along the tunnel
  float seg=floor(a/6.2832*12.);
  vec2 tuv=vec2(a/6.2832*12., z*2.);
  float grid=smoothstep(.06,0.,abs(fract(tuv.x)-.5)-.44)+smoothstep(.08,0.,abs(fract(tuv.y)-.5)-.42);
  vec3 c=palNeon(uA.w+z*.05+seg*.02)*grid*.28*exp(-fract(z*.5)*1.5);
  float ring=exp(-pow(fract(z*.5)-.5,2.)*400.)*(1.+3.*uBeat);         // a ring rushing at camera, flares on beat
  c+=palNeon(uA.w+.3)*ring*uA.z*.6;
  c*=smoothstep(.05,.6,r);                                         // dark core = depth
  c+=vec3(.9,.4,1.)*exp(-r*9.)*.6*uBeat;
  return c;
}`;
