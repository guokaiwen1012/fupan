// 回归测试数据打包 / 解包（加密后才放进仓库：仓库是公开的，测试数据里有客户原消息）
//
// ★ 改了识别规则、推送上线之前，先跑一遍回归：
//     FUPAN_PW='口令' node tools/testpack.js unpack tests.enc _tests   （第一次用先解包）
//     解密出页面源码放到 _tests 的上一级目录（文件名 index.html），然后
//     node _tests/check.js            → 必须「全部通过」才推送
//   check.js 会核对：已确认的中奖数（expect.txt）、消息自己写的合计、用户纠正过的写法（fix.txt）、和上次基准（snapshot.json）比哪些消息变了。
//   变了的消息逐条确认是想要的，再 node _tests/check.js --save 存成新基准；用户新纠正的写法加进 fix.txt。
//   推送时重新打包，让别的会话也拿到最新的基准和纠正记录。
//
// 打包：FUPAN_PW='口令' node tools/testpack.js pack _tests tests.enc
// 解包：FUPAN_PW='口令' node tools/testpack.js unpack tests.enc _tests
// 列出：FUPAN_PW='口令' node tools/testpack.js list tests.enc      （看每批数据的日期，方便定期清理）
// 只打包 *.txt 聊天记录、核对脚本和基准 snapshot.json；parser*.js 是从页面源码抽出来的明文，不打包
// 只保留最近 15 天：打包前先把最后一条消息早于 15 天前的批次文件删掉（同时去掉 expect.txt 里用到它的行、snapshot.json 里它的消息）
// 单独清理：node tools/testpack.js clean _tests      （不需要口令）
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto');
const [cmd,a,b]=process.argv.slice(2), pw=process.env.FUPAN_PW, ITER=310000, KEEP_DAYS=15;
if(cmd==='clean'&&a){clean(a);process.exit(0)}
if(!pw||!['pack','unpack','list'].includes(cmd)||!a||(cmd!=='list'&&!b)){console.error('用法见文件开头注释');process.exit(1)}
const keyOf=(s,n=ITER)=>crypto.pbkdf2Sync(pw,s,n,32,'sha256');
function open(f){
  const D=JSON.parse(fs.readFileSync(f,'utf8')),B=x=>Buffer.from(x,'base64'),d=B(D.c);
  const dc=crypto.createDecipheriv('aes-256-gcm',keyOf(B(D.s),D.n),B(D.i));dc.setAuthTag(d.subarray(d.length-16));
  return JSON.parse(zlib.gunzipSync(Buffer.concat([dc.update(d.subarray(0,d.length-16)),dc.final()])).toString('utf8'));
}
function clean(dir){
  const cut=new Date();cut.setHours(0,0,0,0);cut.setDate(cut.getDate()-KEEP_DAYS);
  const gone=[];
  for(const n of fs.readdirSync(dir).filter(n=>/^[a-z]\d+\.txt$/.test(n))){
    const ds=(fs.readFileSync(path.join(dir,n),'utf8').match(/20\d\d年\d{1,2}月\d{1,2}日/g)||[]).map(x=>{const m=x.match(/(\d+)年(\d+)月(\d+)日/);return new Date(+m[1],m[2]-1,+m[3])});
    if(ds.length&&Math.max(...ds)<cut){fs.unlinkSync(path.join(dir,n));gone.push(n)}
  }
  if(!gone.length){console.log(`没有超过 ${KEEP_DAYS} 天的批次`);return}
  const ex=path.join(dir,'expect.txt');
  if(fs.existsSync(ex))fs.writeFileSync(ex,fs.readFileSync(ex,'utf8').split('\n').filter(l=>l.trim().startsWith('#')||!gone.some(g=>l.includes(g))).join('\n'));
  const sf=path.join(dir,'snapshot.json');
  if(fs.existsSync(sf)){const o=JSON.parse(fs.readFileSync(sf,'utf8'));for(const k in o)if(gone.includes(k.split('#')[0]))delete o[k];fs.writeFileSync(sf,JSON.stringify(o))}
  console.log(`已删掉超过 ${KEEP_DAYS} 天的批次：${gone.join(' ')}`);
}
if(cmd==='pack'){
  clean(a);
  const files={};for(const n of fs.readdirSync(a).sort())if(/\.(txt|js|sh|json)$/.test(n)&&!/^parser/.test(n))files[n]=fs.readFileSync(path.join(a,n),'utf8');
  const s=crypto.randomBytes(16),i=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',keyOf(s),i);
  const d=Buffer.concat([c.update(zlib.gzipSync(JSON.stringify(files))),c.final(),c.getAuthTag()]);
  fs.writeFileSync(b,JSON.stringify({v:1,s:s.toString('base64'),i:i.toString('base64'),n:ITER,c:d.toString('base64')}));
  console.log(`已打包 ${Object.keys(files).length} 个文件 → ${b}`);
}else if(cmd==='unpack'){
  const files=open(a);fs.mkdirSync(b,{recursive:true});for(const n in files)fs.writeFileSync(path.join(b,n),files[n]);
  console.log(`已解包 ${Object.keys(files).length} 个文件 → ${b}`);
}else{
  const files=open(a);for(const n in files){const ds=[...new Set(files[n].match(/20\d\d年\d{1,2}月\d{1,2}日/g)||[])];console.log(n.padEnd(12),(files[n].length/1024).toFixed(1).padStart(7)+'K',ds.slice(0,3).join(' ')+(ds.length>3?' …':''))}
}
