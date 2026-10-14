# python3 sheet.py out.jpg f1 f2 ... (контактный лист, подписи = имена файлов)
import sys
from PIL import Image, ImageDraw
fs=sys.argv[2:];n=len(fs);cols=min(n,7);rows=(n+cols-1)//cols;w,h=270,480
m=Image.new('RGB',(w*cols,(h+22)*rows),'white');d=ImageDraw.Draw(m)
for i,f in enumerate(fs):
    x,y=(i%cols)*w,(i//cols)*(h+22);m.paste(Image.open(f).resize((w,h)),(x,y+22));d.text((x+4,y+4),f.split('/')[-1],fill='black')
m.save(sys.argv[1],quality=85)
