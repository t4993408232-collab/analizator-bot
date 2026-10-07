const fs=require('fs');
const src=fs.readFileSync(__dirname+'/film.src.html','utf8');
const three=fs.readFileSync(__dirname+'/node_modules/three/build/three.min.js','utf8');
fs.writeFileSync(__dirname+'/film.html',src.replace('<!--THREE-->',()=>'<script>\n'+three+'\n</script>'));
