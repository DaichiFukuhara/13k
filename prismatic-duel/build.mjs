import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {deflateRawSync} from "node:zlib";
import {minify} from "terser";

/*
提出ビルド
==========

入力:
  index.html  開発用の外部CSS/JS参照
  style.css   画面レイアウト
  game.js     コメント付きレビュー用ソース

出力（gitignore対象のdist/）:
  dist/index.html           CSS/JSを一つへインライン化した実行ファイル
  dist/prismatic-duel.zip   大会へ提出するZIP

処理順:
  1. Terserでgame.jsを圧縮・変数名短縮・コメント除去
  2. CSSの空白とコメントを除去
  3. index.htmlのlink/scriptをインライン文字列へ置換
  4. index.html一つだけを含む最小ZIPをメモリ上で組み立てる
  5. 13,312 bytes上限を超えたら終了コード1にする

ZIPライブラリ自体を依存へ増やさないため、ローカルヘッダー・中央ディレクトリ・
終端レコードだけを直接書いている。ファイル名もindex.html固定なので、ZIP64や
複数ファイル用の一般処理は不要。
*/

const root=new URL("./",import.meta.url),limit=13312;
const read=name=>readFileSync(new URL(name,root),"utf8");
// passes:3で複数回畳み込み、toplevel:trueでトップレベル名も短縮する。
// unsafe_arrows/pure_gettersはこの自作コードで安全なことをテスト済み。
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

// ZIPはデータ破損検出用CRC32を要求するため、256要素のテーブルをビルド時に作る。
const table=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc32(data){let c=0xffffffff;for(const byte of data)c=table[(c^byte)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function zip(name,data){
  /*
  ZIPの3ブロックを作る。
    local   実データ直前のローカルファイルヘッダー
    central ZIP末尾のファイル索引
    end     ファイル数、索引サイズ、索引位置を持つ終端レコード

  bodyはzlibのdeflateRaw。ZIPコンテナ側が圧縮方式8（deflate）として宣言する。
  */
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
