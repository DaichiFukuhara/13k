import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createHash} from 'node:crypto';

// Compare a refactor with a saved source and its actual built HTML. No fixture
// edits are injected into the minified bundle: it runs through keyboard / RAF.
// node tests/refactor.test.mjs before.js after.js dist/index.html
const [beforePath,afterPath,htmlPath]=process.argv.slice(2);
assert.ok(beforePath&&afterPath&&htmlPath,'Pass before.js, after.js and built/index.html');
const before=readFileSync(beforePath,'utf8'),after=readFileSync(afterPath,'utf8');
const bundle=readFileSync(htmlPath,'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
assert.ok(!bundle.includes('too few parries'),'development validator must not ship');

function game(source,seed=123){
  let random=71,frame,hash;
  const math=Object.create(Math);
  math.random=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296};
  const record=(op,args)=>hash?.update(JSON.stringify([op,args]));
  const defaults={globalAlpha:1,lineWidth:1,fillStyle:'#000000',strokeStyle:'#000000',
    lineCap:'butt',lineJoin:'miter',font:'10px sans-serif',textAlign:'start',dash:[]};
  let styles={...defaults};const stack=[];
  // Path construction is independent of fillStyle assignment order. Compare
  // styles when paint occurs, so moving that assignment around a path is valid.
  const paint=new Set(['fill','stroke','fillRect','strokeRect','fillText','strokeText']);
  const canvas=new Proxy({}, {
    get(_,name){
      if(name in styles)return styles[name];
      return (...args)=>{
        record(name,paint.has(name)?[...args,{...styles}]:args);
        if(name==='save')stack.push({...styles,dash:[...styles.dash]});
        if(name==='restore'){assert.ok(stack.length,'unbalanced Canvas restore');styles=stack.pop()}
        if(name==='setLineDash')styles.dash=[...args[0]];
        if(name==='createLinearGradient')return {addColorStop(...args){record('addColorStop',args)}};
      };
    },
    set(_,name,value){styles[name]=value;return true}
  });
  const listeners={},controls={innerHTML:''},storage={};
  const context=createContext({console,Math:math,Number,JSON,URLSearchParams,localStorage:storage,
    location:{search:'?seed='+seed.toString(36)},
    document:{getElementById:id=>id==='c'?{getContext:()=>canvas}:controls},
    addEventListener:(name,fn)=>listeners[name]=fn,requestAnimationFrame:fn=>frame=fn});
  runInContext(source,context);
  const read=s=>runInContext(s,context);
  const digest=fn=>{hash=createHash('sha256');fn();assert.equal(stack.length,0);const result=hash.digest('hex');hash=null;return result};
  return {read,storage,controls,
    key:(type,code)=>listeners[type]({code,repeat:false,preventDefault(){}}),
    blur:()=>listeners.blur(),draw:()=>digest(()=>read('draw()')),
    tick:time=>digest(()=>frame(time)),
    state:()=>read('JSON.stringify([mode,seed,run,p,b,take,keys,tap,shots,parts,freeze,shake,feedback,attune,saved,best])')};
}

const a=game(before),b=game(after);
function setup(s){a.read(s);b.read(s)}
function compareDraw(label){
  const aState=a.state(),bState=b.state();
  assert.equal(b.draw(),a.draw(),label);
  assert.equal(a.state(),aState,'baseline draw must be read only');
  assert.equal(b.state(),bState,'candidate draw must be read only');
}
let bossFixtures=0,heroFixtures=0,aimFixtures=0,resultFixtures=0;
for(let shape=0;shape<6;shape++)for(let n=1;n<=3;n++)for(const face of [-1,1])
for(const phase of ['wait','wind','active','recover','stagger','guard','shift'])
for(const timer of [0,1,4,5,6,14,15,16,24,54,80,110]){
  setup(`newRun(123);b.moves=[[${shape},3,3,3,${n},4,1,${n},7]];b.move=0;b.phase=${JSON.stringify(phase)};
    b.timer=${timer};b.face=${face};b.targets=[120,230,400];b.aimY=280;`);
  compareDraw(`boss ${shape}/${n}/${phase}/${face}/${timer}`);bossFixtures++;
}
for(let shape=0;shape<6;shape++)for(let n=1;n<=3;n++)for(const face of [-1,1]){
  setup(`newRun(123);p.hold=steal([${shape},3,3,3,${n},4,0,${n},0]);p.action='attack';
    p.face=${face};p.targets=[120,230,400];`);
  const times=a.read('[0,p.hold.wind-1,p.hold.wind,p.hold.wind+1,p.hold.wind+p.hold.active-1,p.hold.wind+p.hold.active,p.hold.wind+p.hold.active+9,p.hold.wind+p.hold.active+10,activeEnd(p.hold)-1,activeEnd(p.hold),attackEnd(p.hold)-1,attackEnd(p.hold)]');
  for(const timer of times){setup(`p.timer=${timer}`);compareDraw(`hero ${shape}/${n}/${face}/${timer}`);heroFixtures++}
}
for(const shape of [4,5])for(let track=0;track<=2;track++)for(let n=1;n<=3;n++)
for(const x of [20,300,602])for(const w of [1,4]){
  setup(`newRun(123);p.x=${x};b.moves=[[${shape},2,4,${w},2,4,${track},${n},5]];b.deck=[0];startMove();`);
  assert.equal(b.state(),a.state(),'aim initialization');
  setup('globalThis.originalTargets=b.targets');
  for(const remaining of a.read(`[WIND[${w}-1],WIND[${w}-1]*.38+1,WIND[${w}-1]*.38,1,0]`)){
    setup(`b.phase='wind';b.timer=${remaining};p.x=640-p.x;bossStep()`);
    assert.equal(b.state(),a.state(),'tracking threshold / lock');
    assert.equal(b.read('b.targets===originalTargets'),true,'tracking retains target array');aimFixtures++;
  }
}
for(let shape=0;shape<6;shape++)for(let tier=0;tier<6;tier++){
  setup(`newRun(123);run.boss=${tier};startBoss();b.hp=1;bossDamage(10,0,'melee');
    take.list=[steal([${shape},3,4,3,3,4,0,3,0])];take.i=0;confirmTake();mode='result';`);
  compareDraw(`result ${shape}/${tier}`);resultFixtures++;
}
console.log(JSON.stringify({bossFixtures,heroFixtures,aimFixtures,resultFixtures,status:'PASS'}));

let frames=0;
for(const seed of [1,123,1777,0xffffffff]){
  const old=game(before,seed),raw=game(after,seed),built=game(bundle,seed),games=[old,raw,built];
  assert.equal(built.controls.innerHTML,raw.controls.innerHTML);
  for(let n=0;n<900;n++){
    const events=[];
    if(n===0||n===400||n===700)events.push(['keydown','Enter']);
    if(n===1||n===401||n===701)events.push(['keyup','Enter']);
    for(const [code,period] of [['KeyJ',39],['Space',103],['KeyL',87],['KeyK',67]]){
      if(n%period===2)events.push(['keydown',code]);
      if(n%period===7)events.push(['keyup',code]);
    }
    if(n%180===0)events.push(['keydown','KeyD']);
    if(n%180===90)events.push(['keyup','KeyD'],['keydown','KeyA']);
    if(n%180===179)events.push(['keyup','KeyA']);
    if(n===200||n===240)events.push(['keydown','Escape']);
    if(n===201||n===241)events.push(['keyup','Escape']);
    if(n===390)games.forEach(g=>g.blur());
    for(const event of events)games.forEach(g=>g.key(...event));
    const drawings=games.map(g=>g.tick(1+n*1000/60));
    assert.equal(drawings[1],drawings[0],`refactor seed ${seed} frame ${n}`);
    assert.equal(drawings[2],drawings[1],`bundle seed ${seed} frame ${n}`);
    assert.equal(raw.state(),old.state(),`state seed ${seed} frame ${n}`);
    assert.deepEqual(built.storage,raw.storage);frames++;
  }
}
console.log(`Before/after state and source/bundle drawing comparison: ${frames} frames PASS`);
