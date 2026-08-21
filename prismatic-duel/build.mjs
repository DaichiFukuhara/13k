import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {deflateRawSync} from "node:zlib";
import {minify} from "terser";

const root=new URL("./",import.meta.url),limit=13312;
const read=name=>readFileSync(new URL(name,root),"utf8");
const js=(await minify(read("game.js"),{
  ecma:2020,
  compress:{passes:3,unsafe_arrows:true,pure_getters:true,booleans_as_integers:true},
  mangle:{toplevel:true},
  format:{comments:false}
})).code;
const css=read("style.css").replace(/\/\*[\s\S]*?\*\//g,"").replace(/\s*([{}:;,])\s*/g,"$1").replace(/;}/g,"}").replace(/\s+/g," ").trim();
const html=read("index.html")
  .replace(/<link rel="stylesheet" href="style\.css">/,`<style>${css}</style>`)
  .replace(/<script src="game\.js"><\/script>/,`<script>${js}</script>`)
  .split(/\r?\n/).map(line=>line.trim()).filter(Boolean).join("\n");

const table=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc32(data){let c=0xffffffff;for(const byte of data)c=table[(c^byte)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function zip(name,data){
  const body=deflateRawSync(data,{level:9}),nm=Buffer.from(name),crc=crc32(data);
  const local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(nm.length,26);
  central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(body.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(nm.length,28);
  const offset=30+nm.length+body.length;end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(46+nm.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([local,nm,body,central,nm,end]);
}
mkdirSync(new URL("dist/",root),{recursive:true});
writeFileSync(new URL("dist/index.html",root),html);
const archive=zip("index.html",Buffer.from(html));
writeFileSync(new URL("dist/prismatic-duel.zip",root),archive);
console.log(`inlined  ${Buffer.byteLength(html)} bytes`);
console.log(`zip      ${archive.length} bytes (${(archive.length/limit*100).toFixed(1)}% of ${limit})`);
console.log(`headroom ${limit-archive.length} bytes`);
if(archive.length>limit)process.exitCode=1;
