import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const source=readFileSync(new URL("game.js",import.meta.url),"utf8");
const box={console,Math,Number};
runInNewContext(source,box,{filename:"game.js"});

let checked=0;
const shapes=new Set(),defenses=new Set(),names=new Set();
for(let seed=1;seed<=10000;seed++){
  for(let tier=0;tier<3;tier++){
    const boss=box.generateBoss(seed,tier);
    const again=box.generateBoss(seed,tier);
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
console.log(`${checked} bosses checked; ${shapes.size} shapes; ${defenses.size} defenses; ${names.size} identities`);
