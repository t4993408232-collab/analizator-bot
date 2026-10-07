# python3 inline.py <src.html with /*KIT*/ placeholder> <out.html>
import sys,os
kit=open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'common.js')).read()
s=open(sys.argv[1]).read(); assert '/*KIT*/' in s, 'no /*KIT*/ placeholder'
open(sys.argv[2],'w').write(s.replace('/*KIT*/',kit,1))
