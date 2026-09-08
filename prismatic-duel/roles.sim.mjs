import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Diagnostic player with perfect access to telegraphs. This is a repeatable
// stress sample, NOT a prediction of human win rate or proof of all-seed safety.
const count=Number(process.argv[2]||20);
const box={console,Math,Number,JSON,count};
runInNewContext(readFileSync(new URL('game.js',import.meta.url),'utf8')+`
const results=[];
for(let shape=-1;shape<6;shape++)for(let tier=0;tier<3;tier++){
  let wins=0,deaths=0,timeouts=0,total=0;
  for(let sample=0;sample<count;sample++){
    newRun(400+sample);run.boss=tier;startBoss();
    if(shape>=0)p.hold=steal(makeMove(seeded(3000+sample*31),shape,Math.max(0,tier-1),false));
    for(let frame=0;frame<10800&&mode==='fight';frame++){
      keys={};tap={};const m=p.hold,enemy=b.moves[b.move],d=b.x+22-p.x-9,dir=d>0?1:-1;
      const dist=Math.abs(d),danger=b.phase==='wind',shot=shots.find(s=>s.owner===1&&Math.abs(s.x-p.x-9)<75);
      let goal=m[S]===5?REACH[m[R]-1]:m[S]===4?160:m[S]===3?90:Math.min(45,REACH[m[R]-1]*.7);
      let walk=dist>goal+8?dir:dist<goal-8?-dir:0;
      if(!p.action&&walk===0&&p.face!==dir)walk=dir;
      if(!p.action){
        if(shot&&p.st>=18&&Math.abs(shot.x-p.x-9)<Math.abs(shot.vx)*7+20)tap.KeyK=1;
        else if(danger){
          const q=moveRect(enemy,0,b),touch=hit(q,boxPlayer());
          if(enemy[S]===4&&b.timer<12)tap.Space=1;
          else if((enemy[F]&PARRY)&&b.timer<=6&&(touch||enemy[S]===3)&&p.st>=18)tap.KeyK=1;
          else if(!(enemy[F]&PARRY)&&touch){
            walk=(p.x+9<q.x+q.w/2?-1:1);
            if((p.x<25&&walk<0)||(p.x>590&&walk>0))walk*=-1;
            if(b.timer<10&&p.st>=24)tap.KeyL=1;
          }
        }else if((b.phase==='recover'||b.phase==='stagger'||b.phase==='wait')&&p.st>=m.cost+12){
          const available=b.timer+(b.phase==='wait'?24:0);
          const reach=m[S]===5?Math.abs(d-p.face*REACH[m[R]-1])<35:m[S]===4?dist<300:m[S]===3?dist<100:dist<REACH[m[R]-1]+20;
          if(reach&&p.face===dir&&available>m.wind+4){tap.KeyJ=1;walk=0;}
        }
      }
      if(walk)keys[walk>0?'KeyD':'KeyA']=1;
      step();total++;
    }
    if(mode==='bosswin')wins++;else if(mode==='dead')deaths++;else timeouts++;
  }
  results.push({shape:shape<0?'HORN':SHAPE_NAME[shape],tier,wins,deaths,timeouts,meanSeconds:Math.round(total/count/60)});
}
globalThis.rows=results;`,box);
console.log(`Deterministic telegraph-aware script, ${count} seeds per shape/tier, 180 s cap.`);
console.table(box.rows);
console.log('Human learning/fun and exhaustive generated-attack safety remain unverified.');
