// Finale: dark floor of glowing shards (stars) + a pillar of light rising, after Silver Air's ending.
// uA: x = pillar intensity, y = pillar height 0..1, z = star density, w = twinkle
export default /* glsl */`
vec3 scene(vec2 uv, vec2 p){
  vec3 c=vec3(.01,.012,.03);
  for(int L=0;L<3;L++){ float s=uA.z*(1.+float(L)*1.7); vec2 g=p*s+float(L)*13.; vec2 i=floor(g), f=fract(g)-.5;
    float h=h12(i); vec2 o=(h22(i)-.5)*.7; float d=length(f-o);
    float tw=.6+.4*sin(uT*(2.+h*5.)*uA.w+h*40.);
    c+=palNeon(h+.1*float(L))*smoothstep(.06,.0,d)*step(.82,h)*tw*(1.5-.4*float(L)); }
  float x=abs(p.x), top=mix(-.6,.6,uA.y);
  float beam=exp(-x*x*4000.)*1.2+exp(-x*x*300.)*.18;
  beam*=smoothstep(top+.02, top-.15, p.y)*smoothstep(-.7,-.4,p.y);
  c+=vec3(.85,.9,1.)*beam*uA.x*(1.+.5*uBeat);
  c+=vec3(.7,.75,1.)*exp(-length(p-vec2(0.,top))*25.)*uA.x*.6;             // crown of the beam
  return c;
}`;
