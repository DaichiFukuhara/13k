import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

/*
戦闘シミュレータ（開発専用・提出物に入らない）
==============================================

game.js は末尾で `typeof document !== "undefined"` を確認してからbootするため、
Nodeのvmへ読み込んでもCanvasやAudioContextを要求しない。描画を呼ばずに
step() だけを回せば、戦闘を実時間より速くヘッドレスで走らせられる。

用途は「今の数値で1戦が成立するか」の実測。
  - 撃破に何秒かかるか
  - 被弾がHPに対してどれくらいか
  - 決着がつかずに時間切れになるseedがあるか

台本入力はまだ書けない（安全席テーブルも回答手段の宣言も実装に無いため）。
ここで測れるのは「完全ランダム入力」の下限だけである。
*/

const src = readFileSync(new URL("../game.js", import.meta.url), "utf8");

// game.js のトップレベルは let 宣言なので、外から触るためのフックを末尾に足して評価する。
// 提出ビルドには入らない（このファイルは build.mjs の入力ではない）。
const hook = `
globalThis.__sim = {
  start(sd, tier) {
    seed = sd >>> 0;
    run = {boss: tier, time: 0, hits: 0, parries: 0};
    mode = "fight"; shots = []; parts = [];
    startBoss();
  },
  input(k, t) { keys = k; tap = t; },
  tick() { step(); },
  state() {
    return {mode, hp: p.hp, st: p.st, bhp: b.hp, bmax: b.maxHp,
            taken: run.hits, parries: run.parries, phase: b.phase,
            px: p.x, bx: b.x, ground: p.ground, act: p.action};
  }
};`;

const box = {console, Math, Number, JSON};
runInNewContext(src + hook, box, {filename: "game.js"});
const sim = box.__sim;

const KEYS = ["KeyA", "KeyD", "KeyW", "KeyJ", "KeyK", "KeyL"];

function simulate(seed, tier, {frames = 60 * 120, aggressive = 0.5, rng, mode = "random"} = {}) {
  sim.start(seed, tier);
  let f = 0, dmgTaken = 0, prev = sim.state();

  for (; f < frames; f++) {
    const keys = {}, tap = {};
    const st = sim.state();
    if (mode === "chase") {
      // 素朴な台本: ボスへ寄り、射程内なら殴る。回避はロールだけをたまに挟む。
      const d = (st.bx + 20) - (st.px + 9);
      if (Math.abs(d) > 34) keys[d > 0 ? "KeyD" : "KeyA"] = 1;
      else { tap.KeyJ = 1; keys.KeyJ = 1; }
      if (rng() < 0.05) { tap.KeyL = 1; keys.KeyL = 1; }
    } else {
      if (rng() < 0.75) keys[rng() < 0.5 ? "KeyA" : "KeyD"] = 1;
      if (rng() < aggressive) {
        const k = KEYS[(rng() * KEYS.length) | 0];
        tap[k] = 1; keys[k] = 1;
      }
    }
    sim.input(keys, tap);
    sim.tick();
    const now = sim.state();
    if (now.hp < prev.hp) dmgTaken += prev.hp - now.hp;
    prev = now;
    if (now.mode !== "fight") break;
  }
  const s = sim.state();
  return {
    result: s.mode === "bosswin" ? "win" : s.mode === "dead" ? "dead" : "timeout",
    sec: +(f / 60).toFixed(1),
    bossLeftPct: Math.round(s.bhp / s.bmax * 100),
    hpLeft: s.hp,
    dmgTaken,
    taken: s.taken,
    parries: s.parries,
  };
}

// 決定論の乱数（入力側）。seedごとに固定し、再実行で同じ結果を得る。
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N = Number(process.argv[2] || 40);
for (const mode of ["random", "chase"]) {
console.log("");
console.log(`【${mode === "random" ? "完全ランダム入力" : "素朴な台本（ボスへ寄って殴る）"}】 ${N} 戦 / tier`);
console.log("tier  勝率   時間切れ  敗北   平均撃破秒  平均被ダメ  平均残HP  被弾回数  残ボスHP%");
console.log("-".repeat(76));

for (let tier = 0; tier < 3; tier++) {
  const rows = [];
  for (let i = 0; i < N; i++) rows.push(simulate(1000 + i, tier, {rng: mulberry(i * 7 + tier), mode}));
  const win = rows.filter(r => r.result === "win");
  const to = rows.filter(r => r.result === "timeout");
  const dead = rows.filter(r => r.result === "dead");
  const avg = (a, f) => a.length ? +(a.reduce((s, r) => s + f(r), 0) / a.length).toFixed(1) : 0;
  console.log(
    `  ${tier}   ${String(Math.round(win.length / N * 100)).padStart(3)}%   ` +
    `${String(to.length).padStart(6)}  ${String(dead.length).padStart(4)}   ` +
    `${String(avg(win, r => r.sec)).padStart(9)}   ${String(avg(rows, r => r.dmgTaken)).padStart(9)}   ` +
    `${String(avg(rows, r => r.hpLeft)).padStart(7)}   ${String(avg(rows, r => r.taken)).padStart(7)}   ` +
    `${String(avg(to, r => r.bossLeftPct)).padStart(7)}`
  );
}
}
