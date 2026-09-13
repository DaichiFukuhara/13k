import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

// Development-only comparisons, using the real player, boss and shot updates.
// Optional second source prints the same scenarios before the change.
function scenarios(source){
  const ctx=createContext({console,Math,Number,JSON});
  runInContext(source,ctx);
  return JSON.parse(runInContext(`
    function setup(s,face=1){
      newRun(1777);p.hold=s<0?bareHand():steal([s,2,3,2,1,2,0,1,0]);
      p.x=230;p.face=face;b.x=face===1?285:175;b.tier=0;b.defense=0;
      b.hp=b.maxHp=10000;b.posture=b.maxPosture=100;
      b.phase='recover';b.timer=50;freeze=0;keys={};tap={};
    }
    function cast(n){
      tap={KeyJ:1};playerStep();shotsStep();tap={};
      for(let i=0;i<n;i++){playerStep();bossStep();shotsStep();}
      return {damage:10000-b.hp,x:p.x,post:100-b.posture,st:p.st,action:p.action,timer:p.timer};
    }
    const far=[];
    for(let s=-1;s<6;s++){
      setup(s);b.x=360;b.timer=40;far.push(cast(40));
    }
    const long=[];
    for(const s of [-1,2]){
      setup(s);b.posture=12;b.timer=76;
      const r=cast(45);long.push({...r,phase:b.phase});
    }
    const rain=[];
    for(const delay of [0,35]){
      setup(5);b.phase='wait';b.timer=9999;b.posture=6;
      for(let f=0;f<100;f++){
        // The identical announced approach in both cases; stop when staggered.
        if(b.phase!=='stagger')b.x=451-3*f;
        tap=f===delay?{KeyJ:1}:{};playerStep();shotsStep();tap={};
      }
      rain.push({damage:10000-b.hp,phase:b.phase,st:p.st});
    }
    const sweep=[];
    for(const face of [-1,1]){
      setup(0,face);b.phase='wait';b.timer=9999;
      tap={KeyJ:1};playerStep();tap={};
      for(let f=0;f<80;f++)playerStep();
      sweep.push({x:b.x,damage:10000-b.hp,st:p.st});
    }
    JSON.stringify({far,long,rain,sweep})`,ctx));
}

const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const now=scenarios(source);
const label=['HORN','SWEEP','THRUST','SLAM','CHARGE','SHOT','RAIN'];
console.table(now.far.map((r,i)=>({shape:label[i],...r})));
assert.equal(now.far[0].damage,0,'initial horn cannot reach the distant opening');
for(const s of [3,4])assert.ok(now.far[s+1].damage>=8.75,'charge/shot land during the 40F recovery');
assert.ok(now.far[4].x>300,'charge commits to the close position');
assert.equal(now.far[5].x,230,'shot retains its safe position');
assert.equal(now.long[0].phase,'recover');
assert.equal(now.long[1].phase,'stagger','slam cashes in a long opening at 12 posture');
assert.equal(now.rain[0].phase,'stagger','correct prediction cashes in 6 remaining posture');
assert.equal(now.rain[1].damage,0,'late rain misses the same approach');
assert.equal(now.sweep[0].x,135);assert.equal(now.sweep[1].x,325);
assert.equal(now.sweep[0].damage,7);assert.equal(now.sweep[1].damage,7);

if(process.argv[2]){
  const before=scenarios(readFileSync(process.argv[2],'utf8'));
  console.log('Same scenarios on previous source:');
  console.table(before.far.map((r,i)=>({shape:label[i],...r})));
  for(const s of [3,4])assert.ok(now.far[s+1].damage>before.far[s+1].damage);
  assert.notEqual(before.long[1].phase,'stagger');
  assert.notEqual(before.rain[0].phase,'stagger');
}

const ctx=createContext({console,Math,Number,JSON});
runInContext(source,ctx);
const read=s=>runInContext(s,ctx);
const eq=(s,n)=>assert.equal(read(s),n,s);
read(`
  globalThis.tones=[];
  audio={currentTime:0,destination:{},createGain(){return {
    gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){return this}
  }},createOscillator(){return {frequency:{setValueAtTime(f){tones.push(f)},exponentialRampToValueAtTime(){}},
    connect(g){return g},start(){},stop(){}}}};
  function target(phase){newRun(233);b.hp=10000;b.posture=100;b.tier=0;b.defense=2;
    b.phase=phase;b.barrier=0;tones.length=0;freeze=0;}
`);
for(const phase of ['wait','wind','active','guard']){
  read(`target('${phase}')`);eq('barrierUp()',true);
}
for(const phase of ['recover','stagger']){
  read(`target('${phase}');bossDamage(7,1,'shot')`);
  eq('barrierUp()',false);eq('10000-b.hp',8.75);eq('freeze',5);
  eq('tones.filter(f=>f===660).length',1);
  read('b.phase="wait"');eq('barrierUp()',true);
}
read("target('wait');bossDamage(7,1,'shot')");
assert.ok(Math.abs(read('10000-b.hp')-2.1)<1e-9);eq('freeze',1);eq('tones.length',1);eq('tones[0]',720);
read("target('wait');bossDamage(7,1,'melee')");eq('b.barrier',180);eq('barrierUp()',false);
read('b.phase="recover";b.timer=999;for(let i=0;i<180;i++)bossStep();b.phase="wait"');eq('barrierUp()',true);
read("target('shift');bossDamage(7,1,'shot')");eq('b.hp',10000);eq('tones.length',0);eq('freeze',0);
read("target('wait');b.posture=1;bossDamage(7,2,'melee')");
eq('b.phase','stagger');eq('freeze',6);eq('tones.includes(880)',true);
// A real missed cast may play its launch tone, but must not celebrate a counter.
read("target('recover');b.x=550;p.hold=bareHand();tap={KeyJ:1};step();for(let i=0;i<40;i++)step()");
eq('tones.includes(660)',false);
// Every repeat count spends stamina and completes recovery even on a miss.
for(let s=0;s<6;s++)for(let n=1;n<=3;n++){
  read(`target('wait');b.defense=0;b.x=550;b.timer=9999;p.x=30;p.face=-1;
    p.hold=steal([${s},2,3,2,1,2,0,${n},0]);p.st=100;tap={KeyJ:1};playerStep();tap={};`);
  eq('p.st',100-read('p.hold.cost'));
  read('for(let i=0;i<attackEnd(p.hold)-1;i++){playerStep();shotsStep()}');eq('p.action','attack');
  read('playerStep();shotsStep()');eq('p.action','');eq('b.hp',10000);
}
console.log('Opportunity comparisons, barrier windows, real feedback and 18 miss/recovery cases passed.');
