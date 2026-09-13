import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const events=[];
const ctx=createContext({console,Math,Number,JSON});
runInContext(readFileSync(new URL('../game.js',import.meta.url),'utf8'),ctx);
const read=s=>runInContext(s,ctx);
// Record Web Audio calls, without replacing any game event or sound function.
ctx.recording={currentTime:10,destination:{},createOscillator(){
  const e={};events.push(e);
  return {set type(v){e.type=v},frequency:{setValueAtTime(f,t){e.f=f;e.at=t},
    exponentialRampToValueAtTime(f,t){e.endF=f;e.end=t}},connect(g){return g},
    start(t){e.start=t},stop(t){e.stop=t}};
},createGain(){return {gain:{setValueAtTime(v,t){events.at(-1).initial=v},
  linearRampToValueAtTime(v,t){events.at(-1).peak=v;events.at(-1).attack=t},
  exponentialRampToValueAtTime(v,t){events.at(-1).tail=v}},connect(){return this}}}};
read(`audio=globalThis.recording;
function fixture(s=1){newRun(233);p.hold=steal([s,2,3,2,1,2,0,1,0]);
  b.hp=10000;b.posture=100;b.tier=0;b.defense=0;b.phase='wait';b.timer=9999;freeze=0;}
function selection(tier){fixture();run.boss=tier;mode='bosswin';
  take={list:[p.hold],i:0,held:p.hold,foe:{name:b.name,hue:b.hue}};}
`);
function play(code){events.length=0;read(code);return events.map(e=>({...e}));}
function pitches(es){return es.map(e=>e.f);}
for(let s=0;s<6;s++){
  const es=play(`fixture(${s});bossDamage(7,1,'${s===4?'shot':'melee'}')`);
  assert.deepEqual(pitches(es),[[180,520,90,130,720,240][s]]);
  assert.equal(es[0].type,'triangle');assert.ok(Math.abs(es[0].stop-es[0].start-.07)<1e-9);
}
assert.deepEqual(pitches(play("fixture();b.phase='recover';bossDamage(7,1,'melee')")),[660]);
assert.deepEqual(pitches(play("fixture();b.phase='shift';bossDamage(7,1,'melee')")),[]);
assert.deepEqual(pitches(play("fixture();b.posture=1;bossDamage(7,2,'melee')")),[520,90,880]);
assert.deepEqual(pitches(play("fixture();parryBoss('audio')")),[1320]);
assert.deepEqual(pitches(play(`fixture();p.action='parry';p.timer=5;const q=boxPlayer();
  shots=[{x:q.x+8,y:q.y+8,vx:0,vy:0,owner:1,life:100,parry:1,dmg:1}];shotsStep()`)),[1320]);
const won=play("fixture();b.hp=1;bossDamage(7,1,'melee')");
assert.deepEqual(pitches(won),[520,440,550]);
for(let tier=0;tier<3;tier++){
  const es=play(`selection(${tier});confirmTake()`);
  assert.deepEqual(pitches(es),tier===2?[440,550,660,880]:[440,550,660]);
  for(let i=0;i<es.length;i++){
    assert.ok(Math.abs(es[i].start-(10+i*.09))<1e-9);
    assert.equal(es[i].endF,es[i].f,'chimes retain pitch');
    assert.equal(es[i].initial,.0001);assert.equal(es[i].tail,.0001);
    assert.ok(es[i].attack>es[i].start&&es[i].attack<es[i].stop);
    assert.ok(es[i].stop<10.5);assert.ok(es[i].peak<=.05);
  }
}
assert.deepEqual(pitches(play('selection(0);startTrial();endTrial()')),[]);
assert.deepEqual(pitches(play("fixture();mode='trial';b.hp=1;bossDamage(7,1,'melee')")),[520]);
// The same run seed writes the same phrase; another seed changes root or notes.
const tune=seed=>read(`newRun(${seed});JSON.stringify([musicRoot,song])`);
assert.equal(tune(233),tune(233));assert.notEqual(tune(233),tune(234));
for(let level=0;level<3;level++){
  const es=play(`newRun(233);run.boss=${level};musicFrame=0;for(let i=0;i<320;i++)music()`);
  assert.equal(es.length,[12,20,28][level]);
  assert.ok(es.every(e=>e.type==='sine'&&e.peak<=.024&&e.attack>e.start&&e.attack<e.stop));
  const melody=es.filter(e=>e.peak===.024);
  assert.equal(melody.length,level?16:8);
  assert.ok(melody.every(e=>e.f>=220&&e.f<=623&&e.stop-e.start>=.5),
    'the foreground melody stays in speaker-friendly midrange with a readable tail');
}
// Quiet short SFX must peak before they stop, independently of BGM envelopes.
for(const code of ['sound(170,.05,"sine",.018)','sound(110,.05,"sine",.02)']){
  const [e]=play(code);assert.ok(e.attack<e.stop);assert.ok(Math.abs(e.attack-e.start-.004)<1e-9);
}
assert.deepEqual(play("newRun(233);mode='pause';step()"),[]);
// No impact/success when aiming away; SHOT must not duplicate its launch tone.
for(let s=0;s<6;s++){
  const es=play(`fixture(${s});p.face=-1;p.x=100;b.x=500;tap={KeyJ:1};playerStep();tap={};
    for(let i=0;i<attackEnd(p.hold)+40;i++){playerStep();shotsStep()}`);
  assert.equal(read('b.hp'),10000);
  assert.equal(es.length,1,'single pulse miss has only its launch sound');
  assert.ok(![440,550,660,880,1320].includes(es[0].f));
}
play('audio=undefined;fixture();bossDamage(7,1,"melee");chime(4)');
assert.equal(read('b.hp'),9993);assert.equal(events.length,0);
read('audio=undefined;wakeAudio()');assert.equal(read('audio'),undefined);
console.log('Audio events: 6 impacts, counter, 2 parries, break, defeat, 3 confirmations, trial, 6 misses and unavailable audio passed.');
