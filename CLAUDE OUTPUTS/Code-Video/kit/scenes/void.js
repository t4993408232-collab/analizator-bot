// Void: near-black screen with a breathing glow and faint scanlines — the "terminal" backdrop for text.
// uA: x = glow, y = glow hue (0 warm .. 1 cold), z = scanlines, w = noise drift
export default /* glsl */`
vec3 scene(vec2 uv, vec2 p){
  vec3 tint=mix(vec3(1.,.55,.3), vec3(.45,.6,1.), uA.y);
  float g=exp(-dot(p,p)*3.)*uA.x*(1.+.6*uBeat);
  vec3 c=vec3(.002,.002,.004)+tint*g*.06;
  c+=tint*.006*fbm(p*3.+vec2(0.,uT*.2*uA.w));
  c*=1.-uA.z*.25*step(.5,fract(uv.y*uRes.y*.25));
  return c;
}`;
