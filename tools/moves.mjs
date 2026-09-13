import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

/*
技構成ダンプ（開発専用・提出物に入らない）
==========================================

generateBoss() が実際に何を作っているかを、人間が読める表で出す。
数値の調整と「どの技を奪えるようにするか」の判断に使う。

  node tools/moves.mjs            既定のseedを3体
  node tools/moves.mjs 12345      seed指定
  node tools/moves.mjs stats 2000 2000体ぶんの分布
*/

const src = readFileSync(new URL("../game.js", import.meta.url), "utf8");
const hook = `globalThis.__api={generateBoss,threat,limits,budgetCap,
  WIND,ACTIVE,REC,REACH,SHAPE_NAME,COLOR_NAME,WEAPON_NAME,DEF_NAME,PAL};`;
const box = {console, Math, Number, JSON};
runInNewContext(src + hook, box, {filename: "game.js"});
const A = box.__api;

const S = 0, D = 1, R = 2, W = 3, ACT = 4, C = 5, T = 6, N = 7, F = 8;
const PARRY = 1, JUMPABLE = 2, MOVEABLE = 4;

// 7色の語彙（根の 1.6）。技の特性から主張色を決める。実装の attackColor と同じ順。
function hueOf(m) {
  if (m[D] >= 4) return "赤 高威力";
  if (m[T] >= 1) return "藍 追尾";
  if (m[W] === 1) return "黄 高速";
  if (m[R] === 4) return "青 長射程";
  if (m[N] > 1) return "紫 多段";
  if (m[ACT] === 3) return "橙 長持続";
  return "—";
}

function answers(m) {
  const a = [];
  if (m[F] & MOVEABLE) a.push("移動");
  if (m[F] & JUMPABLE) a.push("ジャンプ");
  if (m[F] & PARRY) a.push("パリィ");
  return a.join("/");
}

function dump(seed, tier) {
  const b = A.generateBoss(seed, tier);
  const total = b.moves.reduce((s, m) => s + A.threat(m), 0);
  console.log("");
  console.log(`■ seed ${seed} / tier ${tier}  「${b.name}」  HP ${b.maxHp} 体勢 ${b.maxPosture}` +
              `  防御 ${A.DEF_NAME[b.defense] || "なし"}`);
  console.log(`  危険度の合計 ${total} / 上限 ${A.budgetCap(tier)}   主色 ${A.COLOR_NAME[b.hue]}`);
  console.log("  枠  形状      威力 射程   予備  持続  硬直 追尾 段  危険度 帯域      色        回答");
  console.log("  " + "-".repeat(96));
  b.moves.forEach((m, i) => {
    const sig = i === b.moves.length - 1;
    const [lo, hi] = A.limits(tier, sig);
    console.log(
      `  ${sig ? "固" : String(i + 1) + " "}  ${A.SHAPE_NAME[m[S]].padEnd(8)}` +
      `  ${String(m[D]).padStart(3)}  ${String(A.REACH[m[R] - 1]).padStart(3)}px` +
      `  ${String(A.WIND[m[W] - 1]).padStart(3)}F  ${String(A.ACTIVE[m[ACT] - 1]).padStart(2)}F` +
      `  ${String(A.REC[m[C] - 1]).padStart(3)}F  ${String(m[T]).padStart(2)}  ${m[N]}` +
      `  ${String(A.threat(m)).padStart(5)}  [${lo},${hi}]`.padEnd(15) +
      `  ${hueOf(m).padEnd(9)}  ${answers(m)}`
    );
  });
}

const arg = process.argv[2];

if (arg === "stats") {
  const n = Number(process.argv[3] || 1000);
  const shape = {}, hue = {}, ans = {}, cnt = {};
  let totalMoves = 0;
  for (let s = 1; s <= n; s++) for (let t = 0; t < 3; t++) {
    const b = A.generateBoss(s, t);
    cnt[b.moves.length] = (cnt[b.moves.length] || 0) + 1;
    for (const m of b.moves) {
      totalMoves++;
      shape[A.SHAPE_NAME[m[S]]] = (shape[A.SHAPE_NAME[m[S]]] || 0) + 1;
      hue[hueOf(m)] = (hue[hueOf(m)] || 0) + 1;
      ans[answers(m)] = (ans[answers(m)] || 0) + 1;
    }
  }
  const pct = (v) => (v / totalMoves * 100).toFixed(1).padStart(5) + "%";
  console.log(`${n} seed × 3 tier = ${n * 3} 体 / ${totalMoves} 技`);
  console.log("\n形状の分布");
  for (const [k, v] of Object.entries(shape).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(8)} ${pct(v)}`);
  console.log("\n主張色の分布（技ごと）");
  for (const [k, v] of Object.entries(hue).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(10)} ${pct(v)}`);
  console.log("\n回答手段の組み合わせ");
  for (const [k, v] of Object.entries(ans).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(22)} ${pct(v)}`);
} else if (arg) {
  for (let t = 0; t < 3; t++) dump(Number(arg), t);
} else {
  dump(7, 0); dump(7, 1); dump(7, 2);
}
