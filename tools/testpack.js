// 回归测试数据打包 / 解包（加密后才放进仓库：仓库是公开的，测试数据里有客户原消息）
// 打包：FUPAN_PW='口令' node tools/testpack.js pack _tests tests.enc
// 解包：FUPAN_PW='口令' node tools/testpack.js unpack tests.enc _tests
// 列出：FUPAN_PW='口令' node tools/testpack.js list tests.enc      （看每批数据的日期，方便定期清理）
// 只打包 *.txt 聊天记录和核对脚本；parser*.js 是从页面源码抽出来的明文，不打包
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto');
const [cmd,a,b]=process.argv.slice(2), pw=process.env.FUPAN_PW, ITER=310000;
if(!pw||!['pack','unpack','list'].includes(cmd)||!a||(cmd!=='list'&&!b)){console.error('用法见文件开头注释');process.exit(1)}
const keyOf=(s,n=ITER)=>crypto.pbkdf2Sync(pw,s,n,32,'sha256');
function open(f){
  const D=JSON.parse(fs.readFileSync(f,'utf8')),B=x=>Buffer.from(x,'base64'),d=B(D.c);
  const dc=crypto.createDecipheriv('aes-256-gcm',keyOf(B(D.s),D.n),B(D.i));dc.setAuthTag(d.subarray(d.length-16));
  return JSON.parse(zlib.gunzipSync(Buffer.concat([dc.update(d.subarray(0,d.length-16)),dc.final()])).toString('utf8'));
}
if(cmd==='pack'){
  const files={};for(const n of fs.readdirSync(a).sort())if(/\.(txt|js|sh)$/.test(n)&&!/^parser/.test(n))files[n]=fs.readFileSync(path.join(a,n),'utf8');
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
