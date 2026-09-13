import {readFileSync, writeFileSync, mkdirSync} from "node:fs";
import {inflateRawSync} from "node:zlib";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";

/*
提出検証（開発専用・提出物に入らない）
======================================

設計 design/tree/read/frame/shell の 1.4 と 7-4。
根の 5-A-5「遊べる ZIP と、ビルド可能な読めるソースの両方を提出する」に対して、
**手順を決めていなかった**（7-4）。ここでその手順を実行可能な形にする。

`dist/` は .gitignore されているので、提出物はリポジトリに残らない。
残るのはソースだけで、ZIP は**コミットから再生成する**。
だから「同じコミットからは同じ ZIP が出る」ことを毎回確かめる必要がある。

  遊べる ZIP  = このスクリプトが出す dist/random-duel-rainbow.zip
  読めるソース = origin のリポジトリ（この HEAD のコミット）

検査:
  1. ビルドを2回まわし、ZIP の SHA-256 が一致する（再現性）
  2. ZIP の中身が index.html 1件だけで、ディレクトリを挟まない（5-A-1）
  3. 展開した中身が dist/index.html と1バイトも違わない
  4. HTML に外部参照が1つも無い（5-A-2）
  5. 13,312 bytes 以下（5-A-1）

git の状態（未コミット・未push）は**印として出すだけで、合否には含めない。**
作業中でも検査を回せるようにするため。提出の直前に ✅ が揃っていることを見る。

実行:
  node scripts/submit.mjs
*/

const root = new URL("../", import.meta.url);
const LIMIT = 13312;
const path = u => new URL(u, root).pathname.replace(/^\/([A-Za-z]:)/, "$1");

let bad = 0;
const ok = (cond, label, detail = "") => {
  console.log(`  ${cond ? "OK  " : "NG  "}${label}${detail ? "  " + detail : ""}`);
  if (!cond) bad++;
  return cond;
};
const sha = buf => createHash("sha256").update(buf).digest("hex");

// ── 1. 2回ビルドして再現性を見る ────────────────────────
const build = () => execFileSync(process.execPath, [path("scripts/build.mjs")], {encoding: "utf8"});
const out1 = build();
const zip1 = readFileSync(new URL("dist/random-duel-rainbow.zip", root));
build();
const zip2 = readFileSync(new URL("dist/random-duel-rainbow.zip", root));
const html = readFileSync(new URL("dist/index.html", root));

console.log(out1.trimEnd());
console.log("");
console.log("提出検証");
console.log("-".repeat(64));
ok(Buffer.compare(zip1, zip2) === 0, "同じソースから同じ ZIP が出る", sha(zip1).slice(0, 16));

// ── 2. ZIP の構造（中央ディレクトリを直接読む） ──────────
let e = zip1.length - 22;
while (e >= 0 && zip1.readUInt32LE(e) !== 0x06054b50) e--;
const entries = zip1.readUInt16LE(e + 10);
const cdo = zip1.readUInt32LE(e + 16);
const nameLen = zip1.readUInt16LE(cdo + 28);
const name = zip1.toString("utf8", cdo + 46, cdo + 46 + nameLen);
ok(entries === 1, "ZIP の中身は1件だけ", `${entries} 件`);
ok(name === "index.html", "その1件が最上位の index.html", name);

// ── 3. 展開した中身が dist/index.html と一致する ─────────
const lho = zip1.readUInt32LE(cdo + 42);
const csz = zip1.readUInt32LE(cdo + 20);
const lnl = zip1.readUInt16LE(lho + 26), lel = zip1.readUInt16LE(lho + 28);
const body = zip1.subarray(lho + 30 + lnl + lel, lho + 30 + lnl + lel + csz);
const unpacked = zip1.readUInt16LE(cdo + 10) === 8 ? inflateRawSync(body) : body;
ok(Buffer.compare(unpacked, html) === 0, "展開した中身がビルド出力と一致する", `${unpacked.length} bytes`);

// ── 4. 外部参照が無い（5-A-2） ──────────────────────────
const text = unpacked.toString("utf8");
const refs = [...text.matchAll(/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}|<link\b|\bsrc\s*=|url\s*\(/gi)].map(m => m[0]);
ok(refs.length === 0, "外部リソースへの参照が無い", refs.length ? refs.slice(0, 4).join(" ") : "");

// ── 5. 容量（5-A-1） ────────────────────────────────────
ok(zip1.length <= LIMIT, "13,312 bytes 以下",
   `${zip1.length} (${(zip1.length / LIMIT * 100).toFixed(1)}%・余裕 ${LIMIT - zip1.length})`);

// ── git の状態（印。合否に含めない） ─────────────────────
const git = args => {
  try { return execFileSync("git", args, {cwd: path("./"), encoding: "utf8"}).trim() } catch { return "" }
};
const head = git(["rev-parse", "HEAD"]);
const dirty = git(["status", "--porcelain"]);
const remote = git(["config", "--get", "remote.origin.url"]).replace(/\.git$/, "");
const pushed = git(["branch", "-r", "--contains", "HEAD"]);
console.log("");
console.log("読めるソース（合否には含めない印）");
console.log("-".repeat(64));
console.log(`  ${dirty ? "⚠" : "✅"} 作業ツリー  ${dirty ? dirty.split("\n").length + " 件が未コミット" : "clean"}`);
console.log(`  ${pushed ? "✅" : "⚠"} 送信済み    ${pushed ? pushed.replace(/\s+/g, " ") : "この HEAD は origin に無い"}`);
console.log(`  📎 コミット  ${head}`);
console.log(`  📎 ソース    ${remote}/tree/${head.slice(0, 12)}`);

// ── 提出票を書き出す ────────────────────────────────────
mkdirSync(new URL("dist/", root), {recursive: true});
const slip = [
  "js13kGames 2026 — Random Duel Rainbow",
  "",
  `提出 ZIP     dist/random-duel-rainbow.zip`,
  `             ${zip1.length} bytes / ${LIMIT} (${(zip1.length / LIMIT * 100).toFixed(1)}%)`,
  `             sha256 ${sha(zip1)}`,
  `読めるソース ${remote}/tree/${head.slice(0, 12)}`,
  `             コミット ${head}`,
  `             作業ツリー ${dirty ? "未コミットあり" : "clean"} / ${pushed ? "送信済み" : "未送信"}`,
  "",
  `この ZIP は上のコミットから node scripts/submit.mjs で再生成できる。`,
  `生成日時 ${new Date().toISOString()}`,
  ""
].join("\n");
writeFileSync(new URL("dist/SUBMISSION.txt", root), slip);
console.log("");
console.log(`  📄 dist/SUBMISSION.txt を書き出した`);

console.log("");
if (bad) {
  console.log(`提出できない。${bad} 件が NG。`);
  process.exitCode = 1;
} else if (dirty || !pushed) {
  console.log("ZIP は条件を満たしている。提出の前にコミットと push を済ませること。");
} else {
  console.log("提出できる。ZIP と、上のソースURLの両方を出す。");
}
