// Stained glass (homage to Silver Air): Voronoi panes, lead cames, thickness/streaks in the glass,
// backlight + a wave of light running out from the centre along the lead on every downbeat.
// uA: x = wave radius, y = wave strength, z = backlight, w = cell scale.  uB: x = shatter 0..1
export default /* glsl */`
vec3 scene(vec2 uv, vec2 p){
  float sc=uA.w; vec2 q=p*sc;
  // shatter: every pane slides out by its own random vector and falls
  vec3 v0=voronoi(q, 0.); float id0=v0.y, sh=uB.x;
  vec2 dir=normalize(h22(vec2(id0*91.,3.))-.5+1e-3);
  q-=dir*sh*(.6+1.6*h12(vec2(id0,7.)))*sc*.25 - vec2(0.,-sh*sh*2.5*sc*.3);
  vec3 v=voronoi(q, 0.); float id=v.y, lead=v.x;
  float hue=fract(id*7.31);
  vec3 tint= hue<.30? vec3(.05,.12,.55): hue<.50? vec3(.6,.03,.06): hue<.65? vec3(.9,.55,.08): hue<.78? vec3(.05,.35,.3): hue<.88? vec3(.35,.07,.45): vec3(.9,.86,.75);
  float th=.8+1.2*fbm(q*3.+id*31.);                                   // uneven thickness
  float streak=.85+.3*sin(q.y*40.+fbm(q*2.)*8.+id*20.);               // cords in hand-blown glass
  vec3 back=mix(vec3(1.,.82,.6), vec3(.75,.85,1.), uv.y)*uA.z*(.7+.6*fbm(p*1.5+uT*.05));
  vec3 col=back*pow(tint,vec3(th))*streak;
  float r=length(p), wave=exp(-pow((r-uA.x)*4.,2.))*uA.y;             // ruby -> amber -> gold wave
  col*=1.+wave*mix(vec3(2.4,.7,.5), vec3(2.,1.6,.6), smoothstep(.0,1.,r));
  if(h12(floor(q*30.)+id)>.985) col*=1.6+uBeat;                       // seed bubbles flash on the beat
  float l=smoothstep(.035,.012,lead);                                 // lead came + soft shadow
  col*=1.-l*.96; col*=1.-.35*smoothstep(.09,.03,lead);
  float th=.15+.7*h12(vec2(id,11.)); col*=1.-smoothstep(th, th+.12, sh);    // pane by pane the window empties into the dark
  return col;
}`;
