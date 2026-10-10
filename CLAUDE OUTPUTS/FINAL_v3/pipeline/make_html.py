import json,sys,os
K="/home/user/analizator-bot/CLAUDE OUTPUTS/AI-Reels/kit/common.js"
kit=open(K).read(); src=open('/tmp/claude-0/reels/engine.html').read()
for f in sorted(os.listdir('build')):
    if not f.endswith('.json'): continue
    d=open('build/'+f).read()
    open('build/'+f[:-5]+'.html','w').write(src.replace('/*KIT*/',kit,1).replace('/*DATA*/',d,1))
