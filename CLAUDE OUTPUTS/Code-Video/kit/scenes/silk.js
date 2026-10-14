// Silk / aurora: domain-warped fbm (iq) graded with a cosine palette. The calm-verse look.
// uA: x = speed, y = palette shift, z = brightness, w = zoom
export default /* glsl */`
vec3 scene(vec2 uv, vec2 p){
  vec2 q=p*uA.w; float t=uT*uA.x;
  float f=warp(q, t);
  vec3 c=mix(vec3(.02,.05,.25), palSunset(f*1.2+uA.y+.15*sin(t*.3))*vec3(1.4,1.,.9), smoothstep(.25,.8,f));
  c+=vec3(.25,.05,.4)*smoothstep(.55,.35,f)*.5;
  c*=pow(f,3.2)*2.2*uA.z*(1.+.35*uBeat);
  float rib=smoothstep(.02,0.,abs(fract(f*6.-t*.1)-.5)-.47);          // thin bright threads in the folds
  c+=vec3(1.,.8,.6)*rib*.12*uA.z*f;
  return c;
}`;
