import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const ctx=createContext({console,Math,Number,JSON});
runInContext(readFileSync(new URL('game.js',import.meta.url),'utf8'),ctx);
const read=s=>runInContext(s,ctx);
read(`function fixture(shape,face=1,active=1,repeat=1,rest=1){
  newRun(123);p.x=300;p.face=-face;
  b.moves=[makeMove(seeded(72),shape,0,false)];b.move=0;
  const m=b.moves[0];m[D]=2;m[R]=2;m[A]=active;m[N]=repeat;m[C]=rest;
  b.x=p.x+(face===1?(shape===3?-44:-65):(shape===3?18:45));b.face=face;
  b.phase='active';b.timer=0;b.pulse=-1;b.attack=1;b.targets=[p.x+9,p.x+9,p.x+9];
  b.posture=b.maxPosture=24;b.defense=0;b.hp=b.maxHp=100;
  freeze=0;keys={};tap={};
}`);

// Use generated flags, so a newly enabled shape cannot pass on a hand-written flag.
for(let shape=0;shape<6;shape++){
  read(`fixture(${shape})`);
  assert.equal(read('!!(b.moves[0][F]&PARRY)'),shape!==5);
  assert.equal(read('lesson(b.moves[0]).includes("TRY PARRY")'),shape!==5);
}

let contacts=0;
for(const shape of [0,1,2,3])for(const face of [-1,1])
for(const active of [1,2,3])for(const repeat of [1,3])for(const rest of [1,4]){
  read(`fixture(${shape},${face},${active},${repeat},${rest});p.action='parry';p.timer=4;bossStep()`);
  const label=`shape ${shape}, face ${face}, active ${active}, repeat ${repeat}, rest ${rest}`;
  assert.equal(read('run.parries'),1,label);
  assert.equal(read('p.hp'),14,label);
  assert.equal(read('b.posture'),16,label);
  assert.equal(read('b.phase'),'recover',label);
  assert.equal(read('b.timer'),42,'retain the full parry reward: '+label);
  assert.equal(read('p.action'),'');
  read('for(let i=0;i<41;i++)bossStep()');
  assert.equal(read('b.phase'),'recover');
  assert.equal(read('b.timer'),1);
  read('bossStep()');assert.equal(read('b.phase'),'wait');
  assert.equal(read('run.parries'),1,'cancel remaining pulses');
  contacts++;
}

// All reception boundaries; a failed attempt must actually be dangerous on the ground.
for(const shape of [0,1,2,3,5])for(const timer of [3,4,9,10]){
  read(`fixture(${shape});p.action='parry';p.timer=${timer};bossStep()`);
  const success=shape!==5&&timer>=4&&timer<=9;
  assert.equal(read('run.parries'),success?1:0,`shape ${shape}, parry frame ${timer}`);
  assert.equal(read('run.hits'),success?0:1);
  assert.equal(read('p.hp'),success?14:12);
}

for(const shape of [0,1,2,3]){
  read(`fixture(${shape});b.posture=8;p.action='parry';p.timer=9;bossStep()`);
  assert.equal(read('b.phase'),'stagger');assert.equal(read('b.timer'),110);
  read('for(let i=0;i<109;i++)bossStep()');
  assert.equal(read('b.phase'),'stagger');assert.equal(read('b.posture'),0);
  read('bossStep()');assert.equal(read('b.posture'),24);assert.equal(read('b.phase'),'wait');

  read(`fixture(${shape});p.x=30;p.action='parry';p.timer=5;bossStep()`);
  assert.equal(read('run.parries'),0,'no success out of reach');assert.equal(read('run.hits'),0);
  read(`fixture(${shape});p.action='roll';p.timer=8;bossStep()`);
  assert.equal(read('run.hits'),0,'roll remains a valid answer');assert.equal(read('run.parries'),0);
}

// Real input -> windup -> contact -> hitstop -> immediate counter, both directions.
for(const shape of [0,1,2,3])for(const face of [-1,1]){
  read(`fixture(${shape},${face});b.phase='wind';b.timer=4;tap={KeyK:1};step();
    for(let i=0;i<10&&run.parries===0;i++)step()`);
  assert.equal(read('run.parries'),1,`input parry ${shape}/${face}`);
  assert.equal(read('run.hits'),0);assert.equal(read('p.st'),82);
  assert.equal(read('b.timer'),42);assert.equal(read('feedback.kind'),'parry');
  read('while(freeze)step();tap={KeyJ:1};step()');
  assert.equal(read('p.action'),'attack','successful parry releases recovery');
}

read(`fixture(4);p.action='parry';p.timer=4;
  shots=[{x:p.x+9,y:p.y+14,vx:2,vy:0,owner:1,parry:1,dmg:2,life:100}];shotsStep()`);
assert.equal(read('shots[0].owner'),0);assert.equal(read('shots[0].vx'),-2.7);
assert.equal(read('run.parries'),1);assert.equal(read('run.hits'),0);
console.log('OK parry: '+contacts+' melee combinations, reception boundaries, full recovery/stagger, input counters, avoidance, reflection');
