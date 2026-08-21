import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

/*
生成器の回帰テスト
==================

game.jsは末尾で `typeof document !== "undefined"` を確認してからbootするため、
Nodeのvmへ読み込んでもCanvasやAudioContextを要求しない。生成器と検証関数だけを
同じ実装のまま呼び、ブラウザ用コードとテスト用コードの二重管理を避けている。

検査数は10,000 seed × tier 0/1/2 = 30,000体。
各ボスについて次を確認する。

  - 同じseed/tierを二度生成したJSONが完全一致する
  - validateBoss()の公平性エラーが0件
  - 最終的に6攻撃形状と4防御状態がすべて出現する
  - 色×武器の外見アイデンティティが20種類以上出現する

失敗時にはseed/tierと全Move配列を表示するので、その敵を `?seed=` または
generateBoss()で再現して原因を追える。
*/

const source=readFileSync(new URL("game.js",import.meta.url),"utf8");
const box={console,Math,Number};
// DOMを起動しないNode環境で本体を評価し、生成関数だけを直接検査する。
runInNewContext(source,box,{filename:"game.js"});

let checked=0;
const shapes=new Set(),defenses=new Set(),names=new Set();
for(let seed=1;seed<=10000;seed++){
  for(let tier=0;tier<3;tier++){
    // tierはラン内の0:一体目、1:二体目、2:最終ボスに対応する。
    const boss=box.generateBoss(seed,tier);
    const again=box.generateBoss(seed,tier);
    // 同じseed/tierが技順・数値・外見を含めて完全一致することを保証する。
    if(JSON.stringify(boss)!==JSON.stringify(again))throw Error(`non-deterministic seed ${seed}/${tier}`);
    const errors=box.validateBoss(boss);
    if(errors.length)throw Error(`invalid seed ${seed}/${tier}: ${errors.join(", ")}\n${JSON.stringify(boss.moves)}`);
    boss.moves.forEach(move=>shapes.add(move[0]));
    defenses.add(boss.defense);names.add(boss.name);checked++;
  }
}
if(shapes.size!==6)throw Error(`only ${shapes.size} attack shapes generated`);
if(defenses.size!==4)throw Error(`only ${defenses.size} defenses generated`);
if(names.size<20)throw Error(`insufficient visual identities: ${names.size}`);
// この一行が出れば、全seedを例外なく走査し終えている。
console.log(`${checked} bosses checked; ${shapes.size} shapes; ${defenses.size} defenses; ${names.size} identities`);
