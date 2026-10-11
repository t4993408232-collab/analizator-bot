// Светлый шёлк (по мотивам kit/scenes/silk.js): domain warp iq, но в кремово-персиково-жёлтой гамме — для итогового блока.
// uA: x = скорость, y = доля шалфея, z = дыхание на бит, w = масштаб
export default /* glsl */`
vec3 scene(vec2 uv, vec2 p){
  vec2 q=p*uA.w; float t=uT*uA.x; float f=warp(q, t);
  vec3 cream=vec3(.99,.955,.885), peach=vec3(.985,.80,.68), butter=vec3(.99,.89,.60), sage=vec3(.78,.86,.74);
  vec3 c=mix(cream, peach, smoothstep(.40,.80,f));
  c=mix(c, butter, smoothstep(.62,.95,f)*.55);
  c=mix(c, sage, smoothstep(.42,.18,f)*uA.y);
  float rib=smoothstep(.02,0.,abs(fract(f*6.-t*.1)-.5)-.47);          // светлые нити в складках
  c=mix(c, vec3(1.,.98,.94), rib*.35);
  c*=.985+.03*uBeat*uA.z;
  return pow(clamp(c,0.,1.), vec3(2.2));
}`;
