// Солнечный витраж-окно (по мотивам kit/scenes/stained.js): пастельные стёкла, тёплый свинец,
// волна света от «солнца» на каждую сильную долю. uA: x = радиус волны, y = сила волны, z = солнце, w = масштаб ячеек
export default /* glsl */`
vec3 scene(vec2 uv, vec2 p){
  vec2 q=p*uA.w+vec2(0.,uT*.03);
  vec3 v=voronoi(q, uT*.12); float id=v.y, lead=v.x, hue=fract(id*7.31);
  vec3 tint= hue<.22? vec3(.99,.82,.70): hue<.42? vec3(.82,.89,.76): hue<.60? vec3(.99,.91,.66): hue<.80? vec3(.99,.95,.88): hue<.90? vec3(.97,.76,.72): vec3(.80,.88,.87);
  float th=.93+.10*fbm(q*3.+id*31.), streak=.97+.04*sin(q.y*40.+fbm(q*2.)*8.+id*20.);
  vec3 col=tint*th*streak;
  vec2 sun=vec2(.30,.62); float r=length(p-sun);
  col+=vec3(.05,.04,.015)*exp(-r*2.2)*uA.z;
  col*=1.+exp(-pow((r-uA.x)*4.,2.))*uA.y*vec3(.07,.05,.02);
  if(h12(floor(q*30.)+id)>.988) col+=.04*uBeat;                       // пузырьки в стекле вспыхивают на долю
  float l=smoothstep(.032,.012,lead);
  col=mix(col, vec3(.74,.60,.50), l*.75); col*=1.-.05*smoothstep(.08,.03,lead);
  col=mix(col, vec3(.99,.96,.90), .55);                               // светлее: фон, а не главный герой
  return pow(clamp(col,0.,1.), vec3(2.2));
}`;
