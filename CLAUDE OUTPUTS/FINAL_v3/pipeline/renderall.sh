cd /tmp/claude-0/reels
ls build/*.json | xargs -n1 basename | sed 's/.json//' | xargs -P 3 -I{} sh -c 'node rend.js $PWD/build/{}.html $PWD/out/{}.mp4 $PWD/build/{}.wav && node rend.js $PWD/build/{}.html --cover $PWD/out/{}_cover.png && echo done {}'
