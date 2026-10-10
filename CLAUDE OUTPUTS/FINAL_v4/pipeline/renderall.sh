#!/bin/bash
# renderall.sh — кадры всех версий (4 параллельных браузера) -> mp4 H.264/AAC + обложки PNG
D="$(cd "$(dirname "$0")" && pwd)"; cd "$D"
for id in MATHR1 MATHR2 MATHR3 MATHR4 MATHR5 MATHR6 MATHR7 MATHR8; do
  FR="$D/frames/$id"; mkdir -p "$FR"
  for w in 0 1 2 3; do node rend.js "$D/build/$id.html" "$FR" $w 4 & done; wait
  ffmpeg -y -loglevel error -framerate 30 -i "$FR/%05d.jpg" -i "build/$id.wav" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
    -profile:v high -c:a aac -b:a 160k -ar 48000 -shortest -movflags +faststart "build/$id.mp4"
  node rend.js "$D/build/$id.html" --cover "build/${id}_cover.png"
  echo "$id $(ffprobe -v error -show_entries format=duration,size -of csv=p=0 build/$id.mp4)"
done
