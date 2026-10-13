#!/bin/bash
# shots.sh [IDs] — превью: кадр 0, середина каждой сцены, последняя секунда -> shots/<ID>.jpg (контактный лист)
D="$(cd "$(dirname "$0")" && pwd)"; cd "$D"; IDS=${@:-$(ls build/*.json | xargs -n1 basename | sed 's/.json//')}
for id in $IDS; do
  TS=$(python3 -c "import json;d=json.load(open('build/$id.json'));s=d['scenes'];print(','.join(['0']+[str(round((x['a']+(s[i+1]['a'] if i+1<len(s) else d['T']))/2+0.6,2)) for i,x in enumerate(s)]+[str(round(d['T']-0.5,2))]))")
  mkdir -p "shots/$id"; rm -f shots/$id/*; node rend.js "$D/build/$id.html" --shots "$D/shots/$id" "$TS" &&
  python3 sheet.py "shots/$id.jpg" $(ls shots/$id/f_*.jpg | sort -t_ -k2 -g) && echo "$id ok" &
done; wait
