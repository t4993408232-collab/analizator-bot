#!/bin/bash
# compress.sh <in.mp4> <out.mp4> [targetMB=26]  — 2-pass H.264 to fit messenger/upload limits
set -e; IN="$1"; OUT="$2"; MB="${3:-26}"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
VB=$(python3 -c "print(int(($MB*8*1024*1024/$D - 160000)/1000))")
P=$(mktemp -d /tmp/claude-0/-home-user-analizator-bot/48cd2a9f-8142-5df7-828d-32052e3c1ad0/scratchpad/pass.XXXX)
ffmpeg -y -loglevel error -i "$IN" -c:v libx264 -preset slow -b:v ${VB}k -pass 1 -passlogfile "$P/l" -an -f mp4 /dev/null
ffmpeg -y -loglevel error -i "$IN" -c:v libx264 -preset slow -b:v ${VB}k -pass 2 -passlogfile "$P/l" -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart "$OUT"
rm -rf "$P"; ls -la "$OUT"
