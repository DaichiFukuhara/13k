/* Virginight build: minify, inline CSS+JS into one index.html, zip it,
   report size against the 13,312 byte limit (design ch.18). */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { minify } from "terser";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT = 13312;

const read = f => readFileSync(join(ROOT, f), "utf8");

/* Real minification, not a hand-rolled trimmer: identifier mangling is where
   most of the win is, and only a parser can do it without breaking strings. */
async function trimJs(src) {
  const out = await minify(src, {
    ecma: 2020,
    compress: { passes: 3, unsafe_arrows: true, pure_getters: true, booleans_as_integers: true },
    mangle: { toplevel: true },
    format: { comments: false }
  });
  if (out.error) throw out.error;
  return out.code;
}

const trimCss = src => src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s*([{}:;,])\s*/g, "$1")
  .replace(/;}/g, "}")
  .replace(/\s+/g, " ")
  .trim();

/* One page, everything inlined. `js` is swapped for the raw source in the
   debug build so tests can still reach the real identifiers. */
function page(css, js) {
  return read("index.html")
    .replace(/<link rel="stylesheet" href="style\.css">/, () => `<style>${css}</style>`)
    .replace(/<script src="game\.js"><\/script>/, () => `<script>${js}</script>`)
    .split(/\r?\n/).map(l => l.trim()).filter(Boolean).join("\n");
}

const css = trimCss(read("style.css"));
const raw = read("game.js");
const html = page(css, await trimJs(raw));

/* --- minimal zip writer --------------------------------------------------- */

const TABLE = Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(name, data) {
  const body = deflateRawSync(data, { level: 9 });
  const nm = Buffer.from(name, "ascii");
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8);          // deflate
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nm.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nm.length, 28);

  const offset = 30 + nm.length + body.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + nm.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([local, nm, body, central, nm, end]);
}

/* --- write ---------------------------------------------------------------- */

mkdirSync(join(ROOT, "dist"), { recursive: true });
writeFileSync(join(ROOT, "dist/index.html"), html);
writeFileSync(join(ROOT, "dist/debug.html"), page(css, raw));   // not shipped

const archive = zip("index.html", Buffer.from(html, "utf8"));
writeFileSync(join(ROOT, "dist/virginight.zip"), archive);

const pct = ((archive.length / LIMIT) * 100).toFixed(1);
console.log(`inlined  ${Buffer.byteLength(html, "utf8")} bytes`);
console.log(`zip      ${archive.length} bytes  (${pct}% of ${LIMIT})`);
console.log(`headroom ${LIMIT - archive.length} bytes`);
