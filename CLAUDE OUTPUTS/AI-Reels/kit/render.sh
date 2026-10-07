#!/bin/bash
# render.sh <html> <out.mp4> <audio.wav> [workers=2]
set -e; KIT="$(cd "$(dirname "$0")" && pwd)"; HTML="$(realpath "$1")"; OUT="$2"; WAV="$3"; NW="${4:-2}"
FR=$(mktemp -d /tmp/claude-0/-home-user-analizator-bot/48cd2a9f-8142-5df7-828d-32052e3c1ad0/scratchpad/frames.XXXX)
for ((w=0; w<NW; w++)); do node "$KIT/render.js" "$HTML" "$FR" $w $NW & done; wait
ffmpeg -y -loglevel error -framerate 30 -i "$FR/%05d.jpg" -i "$WAV" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart "$OUT"
rm -rf "$FR"; ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$OUT"
