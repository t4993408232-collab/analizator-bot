Audio: synthesize your own WAV with ffmpeg aevalsrc (no external samples). Example ambient pad (D = duration):
ffmpeg -y -f lavfi -i "aevalsrc=exprs='0.1*sin(2*PI*110*t)*(0.6+0.4*sin(2*PI*0.07*t))+0.06*sin(2*PI*164.81*t)+0.04*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*0.09*t))|0.1*sin(2*PI*110.4*t)*(0.6+0.4*sin(2*PI*0.07*t))+0.06*sin(2*PI*164.81*t)+0.04*sin(2*PI*220*t)':s=48000:d=D" \
  -af "lowpass=f=2500,aecho=0.8:0.85:700|1300:0.35|0.25,afade=t=in:d=2,afade=t=out:st=D-3:d=3,volume=1.6" out.wav
Event hits: add terms like 0.05*sin(2*PI*880*t)*exp(-9*(t-T0))*gte(t,T0). Rhythm: use mod(t,period). Noise: random(0) (e.g. for vinyl/tape/static).
Target loudness roughly mean -20 dB, max under -3 dB (check: ffmpeg -i out.wav -af volumedetect -f null -).
