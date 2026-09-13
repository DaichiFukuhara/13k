import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

// Real update functions; no replacement damage or physics. Fixtures isolate
// opportunities before the generated-boss sampling at the end of this file.
const ctx=createContext({console,Math,Number,JSON});
runInContext(readFileSync(new URL('../game.js',import.meta.url),'utf8'),ctx);
const read=s=>runInContext(s,ctx);
const plain=s=>JSON.parse(read(`JSON.stringify(${s})`));
let count=0;
function test(name,fn){fn();console.log('OK '+name);count++;}
read(`
function fixture(shape,n=1,face=1){
  newRun(1777);p.hold=steal([shape,2,3,2,1,2,0,n,0]);
  p.x=230;p.face=face;b.x=face===1?285:175;b.hp=b.maxHp=10000;
  b.posture=b.maxPosture=100;b.defense=0;b.phase='wait';b.timer=9999;
  freeze=0;keys={};tap={};
}
function tickPlayer(n){for(let i=0;i<n;i++){playerStep();shotsStep();tap={};}}
function fire(){tap={KeyJ:1};tickPlayer(1);}
function finish(){tickPlayer(attackEnd(p.hold)+60);}
`);

test('normalized HP and distinct timing envelopes across every timing tier',()=>{
  for(let w=1;w<=4;w++){
    const rows=plain(`Array.from({length:6},(_,s)=>{const m=steal([s,4,4,${w},3,4,2,3,7]);return [m.wind,m.rest,m.cost,m.post,m.seg.reduce((a,b)=>a+b,0),m[T]]})`);
    assert.ok(rows[1][0]<rows[0][0]&&rows[0][0]<rows[2][0]);
    assert.ok(rows[2][1]>rows[1][1]);
    for(const row of rows){assert.equal(row[4],7);assert.equal(row[5],0);assert.ok(row[2]>=12&&row[2]<=40);}
  }
});

test('starting horn connects on frame seven, never during its windup',()=>{
  read('fixture(1);p.hold=bareHand();fire();tickPlayer(6)');
  assert.equal(read('10000-b.hp'),0);
  read('tickPlayer(1)');assert.equal(read('10000-b.hp'),7);
  assert.equal(read('p.st'),86);
});

test('short opening rewards thrust; long opening rewards posture damage',()=>{
  const rows=[];
  for(let s=0;s<6;s++){
    read(`fixture(${s});fire();tickPlayer(16);`);
    rows.push(plain('[10000-b.hp,100-b.posture,p.x]'));
  }
  assert.equal(rows[1][0],7);assert.equal(rows[2][0],0);
  read('fixture(2);fire();finish()');assert.equal(read('100-b.posture'),12);
  read('fixture(1);fire();finish()');assert.equal(read('100-b.posture'),1);
  console.log('  short opening HP damage (SWEEP/THRUST/SLAM/CHARGE/SHOT/RAIN):',rows.map(r=>r[0]));
});

test('sweep creates distance in either direction with no wall damage',()=>{
  for(const face of [-1,1]){
    read(`fixture(0,1,${face});globalThis.oldX=b.x;fire();finish()`);
    assert.equal(read('b.x-oldX'),face*40);assert.equal(read('10000-b.hp'),7);
  }
  read('fixture(0);b.x=575;p.x=525;fire();finish()');
  assert.equal(read('b.x'),575);assert.equal(read('10000-b.hp'),7);
});

test('multi-hit knockback and posture have a per-cast cap; stagger never extends',()=>{
  for(const s of [0,2]){
    read(`fixture(${s},3);p.action='attack';p.attack++;p.pulse=-1;p.hitId='';`);
    // Put the target in each actual pulse, but do not alter its HP/posture.
    const delta=read(`(()=>{let shift=0;for(let i=0;i<3;i++){
      b.x=p.x+40;p.timer=p.hold.wind+i*(p.hold.active+10);
      const x=b.x;heroStrike();heroStrike();shift+=b.x-x;
    }return shift})()`);
    assert.ok(Math.abs(read('100-b.posture')-(s===0?2:12))<1e-9);
    assert.equal(read('10000-b.hp'),7);assert.ok(Math.abs(delta-(s===0?40:0))<1e-9);
  }
  read("fixture(2);b.phase='stagger';b.timer=66;b.posture=0;fire();finish()");
  assert.equal(read('b.timer'),66);
});

test('charge approaches while shot stays at range, with gravity retained in air',()=>{
  const rows=[];
  for(const s of [3,4]){
    read(`fixture(${s});b.x=290;globalThis.origin=p.x;fire();keys={KeyD:1};tickPlayer(p.hold.wind+5);keys={};finish();`);
    rows.push(plain('[10000-b.hp,p.x-origin]'));
  }
  assert.equal(rows[0][0],7);assert.ok(rows[0][1]>0);
  assert.equal(rows[1][0],7);assert.equal(rows[1][1],0);
  read('fixture(4);fire();keys={KeyD:1,Space:1};tickPlayer(20)');
  assert.equal(read('p.x'),230);assert.equal(read('p.y'),277);
  read('fixture(4);p.ground=0;p.coyote=0;p.y=220;p.vy=1;fire();tickPlayer(5)');
  assert.ok(read('p.y')>220,'aerial firing must fall, never hover');
});

test('rain aim follows facing before input, locks all pulses and misses a departing foe',()=>{
  for(const face of [-1,1]){
    read(`fixture(5,3,${face});globalThis.preview=Array.from({length:3},(_,i)=>rainAim(p.hold,i));fire()`);
    assert.equal(read('JSON.stringify(p.targets)'),read('JSON.stringify(preview)'));
    const targets=plain('p.targets');read('b.x=550;b.face=1;p.face*=-1;p.x+=12;tickPlayer(20)');
    assert.deepEqual(plain('p.targets'),targets);
  }
  read('fixture(5);b.x=rainAim(p.hold,0)-20;fire();b.x=530;finish()');
  assert.equal(read('10000-b.hp'),0);
  read('fixture(5);fire();b.x=p.targets[0]-20;finish()');
  assert.equal(read('10000-b.hp'),7);
});

test('hit interruption cancels unreleased attacks; no attack from a resting horn',()=>{
  for(let s=0;s<6;s++){
    read(`fixture(${s});b.x=300;fire();hurtPlayer(1,'interrupt');tickPlayer(100)`);
    assert.equal(read('10000-b.hp'),0);assert.equal(read('shots.length'),0);
  }
  read('fixture(1);tickPlayer(90)');assert.equal(read('10000-b.hp'),0);
});

test('a fixed approach rewards early rain placement over waiting for arrival',()=>{
  const damage=[];
  for(const delay of [0,35]){
    read('fixture(5);b.x=451');
    damage.push(read(`(()=>{for(let f=0;f<100;f++){
      b.x=451-3*f;tap=f===${delay}?{KeyJ:1}:{};tickPlayer(1);
    }return 10000-b.hp})()`));
  }
  assert.equal(damage[0],7);assert.equal(damage[1],0);
});

test('horn and shared attack geometry follow the supplied actor and its pose',()=>{
  read("fixture(1);p.action='attack';p.timer=p.hold.wind;globalThis.other={...p,x:p.x+80,y:p.y-40}");
  assert.equal(read('horn(other).x-horn(p).x'),80);
  assert.equal(read('moveRect(p.hold,0,other).y-moveRect(p.hold,0,p).y'),-40);
  for(const face of [-1,1])for(let s=0;s<6;s++){
    read(`fixture(${s},3,${face});p.x=${face<0?20:602};b.x=320;fire();finish()`);
    assert.ok(read('p.x>=20&&p.x<=602&&Number.isFinite(p.y)'));
    assert.ok(read('p.targets.every(Number.isFinite)'));
  }
});

test('unicorn torso collision, jump clearance and corner clamping',()=>{
  read('fixture(1)');assert.deepEqual(plain('boxPlayer()'),{x:227,y:286,w:26,h:17});
  read('p.x=20;b.x=45;tickPlayer(1)');assert.equal(read('p.x'),20);
  read('p.x=602;b.x=575;tickPlayer(1)');assert.equal(read('p.x'),602);
  read('fixture(1);tap={Space:1};keys={Space:1};tickPlayer(12)');
  assert.ok(read('boxPlayer().y+boxPlayer().h')<283,'jump must clear the low sweep');
});

test('rainbow progress counts defeat once, trial never commits a horn, retry preserves freed light',()=>{
  read('newRun(123)');assert.equal(read('freed()'),0);
  for(let i=0;i<3;i++){
    read(`b.hp=1;bossDamage(10,0,'melee')`);assert.equal(read('freed()'),i+1);
    const before=read('JSON.stringify(run)');read('startTrial();tickPlayer(30)');
    assert.equal(read('freed()'),i+1);assert.equal(read('JSON.stringify(run)'),before);
    read('endTrial();take.i=take.list.length-1;globalThis.kept=p.hold;confirmTake()');
    assert.equal(read('freed()'),i+1);assert.ok(read('p.hold===kept'));assert.ok(read('attune.ttl===45'));
    if(i<2){read('startBoss()');assert.equal(read('freed()'),i+1);}
  }
  assert.equal(read('mode'),'result');read('newRun(123)');assert.equal(read('freed()'),0);
});

test('trial target reset waits for attack end and keeps run isolated',()=>{
  read("fixture(0);b.hp=1;bossDamage(10,0,'melee');startTrial();globalThis.before=JSON.stringify(run);b.x=p.x+50;fire()");
  read('for(let i=0;i<210;i++)step()');
  assert.equal(read('b.hp'),read('b.maxHp'));assert.equal(read('b.posture'),read('b.maxPosture'));
  assert.equal(read('b.x'),360);assert.equal(read('JSON.stringify(run)'),read('before'));
});

test('all visual states are read only and restore canvas save/restore balance',()=>{
  let depth=0;
  const noop=()=>{};
  ctx.cx=new Proxy({save(){depth++},restore(){depth--},createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]??noop,set:(o,k,v)=>(o[k]=v,true)});
  read('cx=globalThis.cx;newRun(33)');
  for(const mode of ['title','fight','trial','bosswin','dead','pause','result']){
    for(let s=0;s<6;s++){
      read(`newRun(33);b.hp=1;bossDamage(10,0,'melee');p.hold=steal([${s},2,3,2,1,2,0,3,0]);mode=${JSON.stringify(mode)};`);
      read("for(const a of ['', 'parry','roll','attack'])for(const t of [0,5,50,150]){p.action=a;p.timer=t;unicorn(100,100,-1,p.hold,a,t,0)}");
      // Pose fixtures above intentionally change only the fixture's action/timer.
      const state=read('JSON.stringify([run,p,b,take,feedback,attune])');read('draw()');
      assert.equal(read('JSON.stringify([run,p,b,take,feedback,attune])'),state);assert.equal(depth,0);
    }
  }
});

console.log(`${count} role/unicorn regressions passed`);
