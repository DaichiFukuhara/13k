import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

/*
奪取の回帰テスト（開発専用・提出物に入らない）
==============================================

test.mjs は generateBoss/validateBoss だけを検査するので、steal() と
プレイヤーの攻撃経路を一切通らない。2026-09-06 の5回目の監査は、その死角で
実バグを2件見つけた。

  - 単発SHOTが2回目以降発射されない（攻撃開始時に pulse を戻していなかった）
  - 多段RAINが2段目以降当たらない（targets を1個しか作っていなかった）

どちらも30,000体検査を素通りする。ここで塞ぐ。

検査:
  1. steal() の出力が設計 design/tree/duel の本文5 の 13 と一致する
  2. 全6形状を連続3回撃てる（SHOTの発射数・近接の命中が毎回同じ）
  3. N=1/2/3 で HP合計7・体勢は形状ごとの一攻撃上限
  4. 色は黄/青/紫/橙/無色の5種だけで、優先順が設計どおり
*/

const src = readFileSync(new URL("../game.js", import.meta.url), "utf8");
const hook = `globalThis.__s={
  steal,bareHand,threat,HOLD_COL,generateBoss,PAL,WIND,ACTIVE,REC,REACH,SHAPE_NAME,
  arm(m){seed=1;run={boss:0,time:0,hits:0,parries:0};mode="fight";shots=[];parts=[];p=null;startBoss();
         p.hold=m;b.hp=1e9;b.x=p.x+40;b.face=-1;},
  fire(){ // 1回撃ち切って、与ダメージと発射数を返す
    // ボスは wait 中に間合いを詰めるので、毎回同じ位置・同じ無防備状態へ戻す。
    // 測りたいのはプレイヤーの攻撃であって、ボスの挙動ではない。
    // CHARGEは5Fの実持続内、RAINは固定された落下地点へ置く。
    // 硬直中の再前進や、遅れて範囲に入った的への再判定には依存しない。
    b.x=p.x+(p.hold[0]===3?20:p.hold[0]===5?REACH[p.hold[2]-1]-20:40);
    b.face=-1;b.phase="wait";b.timer=9999;b.hp=1e9;p.inv=999;
    const before=b.hp;p.st=100;p.delay=0;
    // 弾は生成した次のフレームにボスへ当たって消えるので、差分ではなく
    // 「増えた回数」を毎フレーム累積して数える。
    let fired=0,prev=shots.length;
    const tick=()=>{step();if(shots.length>prev)fired+=shots.length-prev;prev=shots.length;};
    keys={};tap={KeyJ:1};tick();tap={};
    const lim=p.hold.wind+(p.hold.active+10)*p.hold[7]+p.hold.rest+40;
    for(let i=0;i<lim;i++){keys={};tap={};tick();}
    return {dmg:before-b.hp,shots:fired,posture:b.maxPosture-b.posture};
  },
  reset(){b.posture=b.maxPosture;},
  targets(){return p.targets.slice();}
};`;
const box = {console, Math, Number, JSON};
runInNewContext(src + hook, box, {filename: "game.js"});
const S = box.__s;

const IDX = {S: 0, D: 1, R: 2, W: 3, A: 4, C: 5, T: 6, N: 7, F: 8};
let checked = 0;
const fail = (msg) => { throw Error(msg); };

// ── 1. 変換規則 ───────────────────────────────────────
for (let seed = 1; seed <= 2000; seed++) {
  for (let tier = 0; tier < 3; tier++) {
    for (const m of S.generateBoss(seed, tier).moves) {
      const t = S.steal(m);
      checked++;
      if (t[IDX.S] !== m[IDX.S] || t[IDX.R] !== m[IDX.R] || t[IDX.W] !== m[IDX.W] ||
          t[IDX.A] !== m[IDX.A] || t[IDX.C] !== m[IDX.C] || t[IDX.N] !== m[IDX.N])
        fail(`継承すべき値が変わった seed ${seed}/${tier}: ${m} -> ${t}`);
      if (t[IDX.D] !== 3) fail(`威力が段3へ正規化されていない: ${t}`);
      if (t[IDX.T] !== 0) fail(`追尾が捨てられていない: ${t}`);
      if (t[IDX.F] !== 0) fail(`宣言が捨てられていない: ${t}`);
      const bands=[[16,25],[6,12],[32,44],[12,21],[14,23],[30,39]];
      if (t.wind < bands[t[0]][0] || t.wind > bands[t[0]][1]) fail(`形状の発生範囲外: ${t.wind}`);
      const want = Math.max(12, Math.min(40, 10 + S.threat(t) * 2 + [2,0,4,2,0,2][t[0]]));
      if (t.cost !== want) fail(`消費が式と違う: ${t.cost} != ${want}`);
      const sum = t.seg.reduce((a, b) => a + b, 0);
      if (sum !== 7) fail(`HP配分の合計が7でない: [${t.seg}] = ${sum}`);
      if (t.seg.length !== m[IDX.N]) fail(`配分の段数が違う: ${t.seg.length} != ${m[IDX.N]}`);
      const c = S.HOLD_COL(t);
      const ok = [S.PAL[2], S.PAL[4], S.PAL[6], S.PAL[1], "#c9c6d8"];
      if (!ok.includes(c)) fail(`奪取技に出ない色: ${c}`);
      // 優先順 黄 -> 青 -> 紫 -> 橙
      const want2 = t.wind <= 18 ? S.PAL[2] : t[IDX.R] === 4 ? S.PAL[4]
        : t[IDX.N] > 1 ? S.PAL[6] : t[IDX.A] === 3 ? S.PAL[1] : "#c9c6d8";
      if (c !== want2) fail(`色の優先順が設計と違う: ${c} != ${want2}`);
    }
  }
}
console.log(`変換規則 ${checked} 技 OK（継承・正規化・消費・HP配分・色）`);

// ── 2. 全6形状を連続3回撃つ ────────────────────────────
console.log("");
console.log("形状      発生  段  1回目           2回目           3回目");
console.log("-".repeat(70));
for (let shape = 0; shape < 6; shape++) {
  for (const N of [1, 2, 3]) {
    // 多段は SHOT で見る。RAIN は段ごとに落下位置が散る設計なので、
    // 静止した的に全段は当たらない（それは正しい挙動）。段数の確定だけ別に見る。
    if (N > 1 && shape !== 4) continue;
    const m = S.steal([shape, 2, 3, 2, 1, 2, 0, N, 0]);
    S.arm(m);
    const runs = [];
    for (let i = 0; i < 3; i++) { S.reset(); runs.push(S.fire()); }
    const cell = (r) => `dmg${String(r.dmg).padStart(2)} 弾${r.shots} 体勢${r.posture}`;
    console.log(`${S.SHAPE_NAME[shape].padEnd(8)} ${String(m.wind).padStart(4)}F  ${N}  ` +
                runs.map(cell).join("  "));
    // 3回とも同じ結果になること（1回目だけ効くバグを塞ぐ）
    const key = (r) => `${r.dmg}/${r.shots}`;
    if (new Set(runs.map(key)).size !== 1)
      fail(`${S.SHAPE_NAME[shape]} N=${N}: 連続使用で結果が変わる ${runs.map(key).join(" ")}`);
    if (shape === 4) {
      if (runs[0].shots !== N) fail(`SHOT N=${N}: 発射数が段数と違う ${runs[0].shots}`);
      if (runs[0].dmg !== 7) fail(`SHOT N=${N}: 合計ダメージが7でない ${runs[0].dmg}`);
      if (Math.abs(runs[0].posture - 1)>1e-9) fail(`SHOT N=${N}: 体勢の合計が1でない ${runs[0].posture}`);
    } else {
      if (runs[0].dmg !== 7) fail(`${S.SHAPE_NAME[shape]}: 合計ダメージが7でない ${runs[0].dmg}`);
      if (runs[0].posture !== [2,1,12,2,1,6][shape]) fail(`${S.SHAPE_NAME[shape]}: 体勢が形状上限と違う ${runs[0].posture}`);
    }
  }
}

console.log("");
console.log("全形状の連続3回使用 OK");

// ── 3. 多段RAINの落下位置が段数ぶん確定するか ──────────────
// 監査が見つけたバグ: targets を1個しか作らず、2段目以降が undefined になっていた
console.log("");
for (const N of [1, 2, 3]) {
  const m = S.steal([5, 2, 3, 2, 1, 2, 0, N, 0]);
  S.arm(m);
  S.fire();
  const t = S.targets();
  console.log(`RAIN N=${N}: 落下X = [${t.map(v => Math.round(v))}]`);
  if (t.length !== N) fail(`RAIN N=${N}: 落下Xが ${t.length} 個しかない`);
  if (t.some(v => !Number.isFinite(v))) fail(`RAIN N=${N}: 落下Xに undefined がある [${t}]`);
  if (new Set(t).size !== N) fail(`RAIN N=${N}: 落下Xが重複している [${t}]`);
}
console.log("多段RAINの落下位置 OK");
