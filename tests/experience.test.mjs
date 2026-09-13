import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createContext, runInContext} from "node:vm";

// Development-only regression checks. Fixtures place combatants and shorten HP;
// all attacks, damage, selection, trial and confirmation run through real input
// events and step(). No replacement combat implementation or rendering is used.
const source=readFileSync(new URL("../game.js",import.meta.url),"utf8");
let checked=0;
function game(){
  const listeners={};
  const box=createContext({console,Math,Number,JSON,URLSearchParams,
    location:{search:"?seed=123"},requestAnimationFrame(){},
    document:{getElementById:id=>id==="c"?{getContext:()=>({})}:{innerHTML:""}},
    addEventListener:(name,fn)=>listeners[name]=fn});
  const ev=code=>({code,repeat:false,preventDefault(){}});
  const read=js=>runInContext(js,box);
  runInContext(source,box,{filename:"game.js"});
  const tick=(n=1)=>{for(let i=0;i<n;i++)read("step()");};
  const key=code=>{listeners.keydown(ev(code));tick();listeners.keyup(ev(code));};
  const until=(js,n=300)=>{for(let i=0;i<n&&!read(js);i++)tick();assert.ok(read(js),`timed out: ${js}`);};
  key("Enter");
  return {read,tick,key,until,blur:()=>listeners.blur(),
    hold:code=>listeners.keydown(ev(code)),release:code=>listeners.keyup(ev(code))};
}
function check(name,fn){fn();checked++;console.log(`OK ${name}`);}
function win(g,{six=false}={}){
  g.read(`b.hp=1;b.defense=0;b.phase="wait";b.timer=9999;b.x=p.x+30;
    p.hold=bareHand();p.st=100;p.delay=0;p.action="";p.inv=999;freeze=0;
    ${six?'b.moves=Array.from({length:6},(_,s)=>[s,2,3,2,1,2,0,s===4||s===5?3:1,0]);':""}
    globalThis.defeated={name:b.name,hue:b.hue};globalThis.oldHold=p.hold;`);
  g.key("KeyJ");g.until('mode==="bosswin"');
  assert.ok(g.read("take.held===oldHold"),"take must retain original held move");
  assert.ok(g.read("take.foe.name===defeated.name&&take.foe.hue===defeated.hue"));
}
const stats=g=>g.read("JSON.stringify(run)");
const clearFeedback=g=>g.read('feedback={text:"",kind:"",ttl:0};freeze=0');
function readyStrike(g,phase="wait"){
  g.read(`b.x=p.x+30;b.hp=10000;b.posture=b.maxPosture;b.defense=0;b.phase=${JSON.stringify(phase)};
    b.timer=9999;p.action="";p.st=100;p.delay=0;p.inv=999;freeze=0;p.hold=bareHand();`);
  clearFeedback(g);
}
function enemySwing(g,parryable=true){
  g.read(`b.moves=[[0,2,3,2,1,2,0,1,${parryable?7:4}]];b.move=0;b.x=p.x-60;b.face=1;
    b.phase="active";b.timer=0;b.pulse=-1;b.attack++;p.inv=0;freeze=0;`);
}

check("attack mashing across melee/projectile defeat stays in selection",()=>{
  for(const code of ["KeyJ","KeyZ"])for(const shot of [false,true])for(let tier=0;tier<3;tier++){
    const g=game();
    g.read(`run.boss=${tier};startBoss();b.hp=1;b.defense=0;b.timer=9999;b.x=p.x+40;
      p.inv=999;p.hold=${shot?'steal([4,2,3,2,1,2,0,1,0])':'bareHand()'};`);
    for(let i=0;i<120&&g.read('mode==="fight"');i++)g.key(code);
    assert.equal(g.read("mode"),"bosswin","the real attack must defeat the foe");
    const before=stats(g);
    for(let i=0;i<180;i++)g.key(code);
    g.hold(code);g.tick(120);g.release(code);
    assert.equal(g.read("mode"),"bosswin","continued attacks must not enter the stationary trial");
    assert.equal(g.read("saved"),null);
    assert.equal(g.read("take.i"),0);assert.equal(stats(g),before);
    g.key("Enter");
    assert.equal(g.read("run.boss"),tier+1);assert.equal(g.read("run.log.length"),1);
    if(tier===2){assert.equal(g.read("mode"),"result");g.key("Enter");}
    assert.equal(g.read("mode"),"fight");
    g.until("b.attacks>0");
  }
});

check("defeat → select → T trial → R → different trial → Enter next fight",()=>{
  const g=game();win(g);const before=stats(g);
  g.key("KeyT");assert.equal(g.read("mode"),"trial");
  assert.equal(stats(g),before);
  g.hold("KeyD");g.tick(8);g.release("KeyD");g.key("Space");g.key("KeyJ");g.tick(150);
  assert.equal(stats(g),before,"trial movement/attacks must not change run statistics");
  assert.ok(g.read("take.held===oldHold"));
  g.key("KeyR");assert.equal(g.read("mode"),"bosswin");
  assert.equal(g.read("take.i"),0);assert.ok(g.read("p.hold===oldHold"));
  assert.equal(g.read("shots.length"),0);assert.equal(g.read("parts.length"),0);
  g.key("ArrowRight");assert.equal(g.read("take.i"),1);
  g.read("globalThis.chosen=take.list[take.i]");g.key("KeyT");
  assert.equal(g.read("mode"),"trial");assert.ok(g.read("p.hold===chosen"));
  g.tick(90);assert.equal(stats(g),before);
  g.key("KeyR");assert.equal(g.read("take.i"),1);
  g.key("KeyT");g.key("Enter");
  assert.equal(g.read("mode"),"fight");assert.equal(g.read("run.boss"),1);
  assert.equal(g.read("run.log.length"),1);assert.ok(g.read("p.hold===chosen"));
  assert.ok(g.read("run.log[0][0]===defeated.name&&run.log[0][1]===defeated.hue&&run.log[0][2]===chosen"));
  assert.equal(g.read("b.name"),g.read("generateBoss(runSeed(1),1).name"));
  assert.equal(g.read("JSON.stringify(b.moves)"),g.read("JSON.stringify(generateBoss(runSeed(1),1).moves)"));
  assert.equal(g.read("shots.length"),0);assert.equal(g.read("take"),null);
  g.key("Enter");assert.equal(g.read("run.log.length"),1,"confirmation must record once");
});

check("optional direct confirmation and final trial → result record exactly once",()=>{
  const g=game();
  for(let tier=0;tier<3;tier++){
    win(g);
    if(tier===2){const before=stats(g);g.key("KeyT");g.tick(180);assert.equal(stats(g),before);}
    g.key("Enter");assert.equal(g.read("run.log.length"),tier+1);
    assert.equal(g.read("mode"),tier===2?"result":"fight");
  }
  const final=stats(g);g.tick(30);assert.equal(stats(g),final);
});

check("third clear records the run and Enter continues the endless ascent",()=>{
  const g=game();
  for(let tier=0;tier<3;tier++){win(g);g.key("Enter");}
  assert.equal(g.read("mode"),"result");assert.equal(g.read("run.boss"),3);
  assert.equal(g.read("best"),3);assert.equal(g.read("run.log.length"),3);
  g.key("Enter");assert.equal(g.read("mode"),"fight");assert.equal(g.read("run.boss"),3);
  assert.equal(g.read("b.tier"),3);assert.equal(g.read("b.maxHp"),228);
  assert.equal(g.read("b.maxPosture"),45);assert.equal(g.read("b.moves.length"),5);
  g.read("run.boss=8;startBoss()");
  assert.equal(g.read("b.maxHp"),318);assert.equal(g.read("b.maxPosture"),60);
  assert.equal(g.read("validateBoss(b).length"),0);
  g.read('b.hp=b.maxHp/2+1;b.phase="wait";b.defense=0;p.inv=999;bossDamage(2,0,"melee")');
  assert.equal(g.read("b.mutated"),1);assert.equal(g.read("b.phase"),"shift");
});

check("Escape and focus-loss pause resume the previous fight/trial",()=>{
  const g=game();
  for(const trial of [false,true]){
    if(trial){win(g);g.key("KeyT");}
    const want=trial?"trial":"fight";
    for(const byBlur of [false,true]){
      if(byBlur)g.blur();else g.key("Escape");
      assert.equal(g.read("mode"),"pause");
      const before=stats(g),x=g.read("p.x"),hp=g.read("b.hp");g.tick(45);
      assert.equal(stats(g),before);assert.equal(g.read("p.x"),x);assert.equal(g.read("b.hp"),hp);
      g.key(byBlur?"Enter":"Escape");assert.equal(g.read("mode"),want);
    }
  }
});

check("pause restarts the whole seed or returns to a new seed title, including from trial",()=>{
  for(const trial of [false,true])for(const fresh of [false,true]){
    const g=game(),originalSeed=g.read('seed');
    const originalBoss=g.read('JSON.stringify(b.moves)'),originalSong=g.read('JSON.stringify(song)');
    win(g);g.key('Enter'); // A restart must return to foe 1, not the current foe.
    if(trial){win(g);g.key('KeyT');}
    g.key('Escape');g.key(fresh?'KeyN':'KeyR');
    if(fresh){
      assert.equal(g.read('mode'),'title');assert.notEqual(g.read('seed'),originalSeed);
      g.key('Enter');
    }else{
      assert.equal(g.read('seed'),originalSeed);
      assert.equal(g.read('JSON.stringify(b.moves)'),originalBoss);
      assert.equal(g.read('JSON.stringify(song)'),originalSong);
    }
    assert.equal(g.read('mode'),'fight');assert.equal(g.read('run.boss'),0);
    assert.equal(g.read('run.time'),0);assert.equal(g.read('run.log.length'),0);
    assert.ok(g.read('p.hp===HERO.hp&&JSON.stringify(p.hold)===JSON.stringify(bareHand())'));
    assert.ok(g.read('take===null&&saved===null&&shots.length===0&&musicFrame===0'));
  }
});

check("all six trial shapes use real windup, cost, damage/projectiles and repeat use",()=>{
  const g=game();win(g,{six:true});const before=stats(g);
  for(let shape=0;shape<6;shape++){
    if(shape)g.key("KeyD");
    assert.equal(g.read("take.list[take.i][0]"),shape);
    g.key("KeyT");assert.equal(g.read("mode"),"trial");
    // Fixture placement makes each attack reachable without altering its geometry.
    // RAIN's first target is at reach distance; CHARGE must reach in its 5 active frames.
    for(let repeat=0;repeat<3;repeat++){
      g.read(`p.x=160;p.y=FLOOR-30;p.vx=0;p.vy=0;p.face=1;p.action="";
        p.st=100;p.delay=0;freeze=0;shots=[];b.x=p.x+${shape===5?"REACH[p.hold[R]-1]-20":shape===3?"30":"40"};`);
      const hp=g.read("b.hp"),cost=g.read("p.hold.cost"),wind=g.read("p.hold.wind");
      g.key("KeyJ");assert.equal(g.read("p.action"),"attack");assert.equal(g.read("p.st"),100-cost);
      g.tick(wind-1);assert.equal(g.read("b.hp"),hp,"damage must wait for actual windup");
      assert.equal(g.read("shots.length"),0,"shots must wait for actual windup");
      let damaged=false,projectiles=0;const seen=new Set();
      const duration=g.read("p.hold.wind+(p.hold.active+10)*p.hold[N]+p.hold.rest+80");
      for(let i=0;i<duration;i++){
        g.tick();if(g.read("b.hp")<hp)damaged=true;
        for(const shot of g.read("shots"))if(shot.owner===0&&!seen.has(shot)){seen.add(shot);projectiles++;}
      }
      assert.ok(damaged,`shape ${shape}, use ${repeat+1} must hit the dummy`);
      if(shape===4)assert.equal(projectiles,3,"SHOT must really spawn all three projectiles each use");
      if(shape===5){assert.equal(g.read("p.targets.length"),3);assert.equal(g.read("new Set(p.targets).size"),3);}
      if(shape===3)assert.ok(g.read("p.x")>160,"CHARGE must physically advance");
      assert.equal(g.read("mode"),"trial");assert.equal(stats(g),before);
    }
    // A low-health dummy must remain a trial target, including tier/phase logic.
    g.read("b.hp=1;b.tier=2;b.mutated=0;p.st=100;p.delay=0;p.action=\"\";freeze=0;");
    g.key("KeyJ");g.tick(180);assert.equal(g.read("mode"),"trial");
    assert.notEqual(g.read("b.phase"),"shift");assert.equal(stats(g),before);
    g.key("KeyR");assert.equal(g.read("take.i"),shape);assert.ok(g.read("p.hold===oldHold"));
    assert.equal(g.read("shots.length+parts.length"),0);
  }
});

check("counter feedback requires a real hit during recovery/stagger",()=>{
  for(const phase of ["wait","wind","recover","stagger"]){
    const g=game();readyStrike(g,phase);g.key("KeyJ");g.until("b.hp<10000");
    assert.equal(g.read("feedback.kind"),["recover","stagger"].includes(phase)?"counter":"hit");
    assert.ok(g.read("feedback.ttl>0"));
  }
  const g=game();readyStrike(g,"recover");g.read("b.x=550");g.key("KeyJ");g.tick(70);
  assert.equal(g.read("b.hp"),10000);assert.ok(!g.read("feedback.ttl"),"missing an opening is not a counter");
});

check("attack recovery cannot strike again or continue a charge",()=>{
  const g=game();win(g,{six:true});
  for(let shape=0;shape<6;shape++){
    if(shape)g.key("KeyD");g.key("KeyT");
    g.read('p.x=100;p.face=1;b.x=550;p.st=100;');
    g.key("KeyJ");
    g.until('p.timer===p.hold.wind+(p.hold.active+10)*p.hold[N]-10');
    assert.equal(g.read('p.action'),"attack","fixture must be in recovery");
    g.read('shots=[];freeze=0;b.x=p.hold[S]===5?p.targets[p.hold[N]-1]-20:p.x+28;');
    const x=g.read('p.x'),hp=g.read('b.hp');
    g.tick(g.read('p.hold.rest'));
    assert.equal(g.read('b.hp'),hp,`shape ${shape} must not hit during recovery`);
    assert.equal(g.read('shots.length'),0,"recovery must not generate another shot");
    assert.equal(g.read('p.x'),x,"recovery must not advance CHARGE");
    g.key("KeyR");
  }
});

check("pause freezes effect timers and consumes resume inputs",()=>{
  const g=game();win(g);g.key("KeyT");
  g.read('feedback={kind:"counter",text:"COUNTER!",ttl:65};shake=5;freeze=3;');
  g.key("Escape");g.hold("KeyD");g.hold("KeyJ");g.tick(90);
  assert.equal(g.read('feedback.ttl'),65);assert.equal(g.read('shake'),5);
  assert.equal(g.read('freeze'),3);
  const before=stats(g);g.key("Enter");
  assert.equal(g.read('mode'),"trial");assert.equal(stats(g),before);
  assert.ok(g.read('!Object.values(keys).some(Boolean)'),"resume must clear held inputs");
  assert.ok(g.read('!p.actBuf&&!p.rollBuf&&!p.parryBuf&&!p.jumpBuf'));
  g.tick(30);assert.equal(g.read('feedback.ttl'),35);assert.equal(g.read('shake'),0);
});

check("new stagger and invulnerable shift do not produce counter feedback",()=>{
  const g=game();readyStrike(g);g.read('b.posture=.5');g.key("KeyJ");g.until('b.phase==="stagger"');
  assert.equal(g.read('feedback.kind'),"hit");
  readyStrike(g,"shift");g.key("KeyJ");g.tick(60);
  assert.equal(g.read('b.hp'),10000);assert.equal(g.read('feedback.ttl'),0);
});

check("parry feedback requires contact; hurt and tired reflect actual events",()=>{
  const g=game();g.read('b.phase="wait";b.timer=9999;');clearFeedback(g);
  g.key("KeyK");g.tick(4);assert.equal(g.read("run.parries"),0);assert.ok(!g.read("feedback.ttl"));
  enemySwing(g);g.tick();assert.equal(g.read("run.parries"),1);assert.equal(g.read("feedback.kind"),"parry");
  const h=game();clearFeedback(h);enemySwing(h,false);h.tick();
  assert.equal(h.read("run.hits"),1);assert.equal(h.read("p.hp"),12);assert.equal(h.read("feedback.kind"),"hurt");
  assert.ok(h.read('lastLesson.includes("SWEEP")'));
  const t=game();clearFeedback(t);t.read('b.timer=9999;p.st=0;p.delay=999;');t.key("KeyJ");
  assert.equal(t.read("p.action"),"");assert.equal(t.read("feedback.kind"),"tired");
  const both=game();clearFeedback(both);enemySwing(both);both.read("p.st=0;p.delay=999");both.key("KeyJ");
  assert.equal(both.read("run.hits"),1);assert.equal(both.read("feedback.kind"),"hurt","hurt must outrank tired in the same frame");
});

check("projectile hit/death lesson retains the firing move, retry restores same foe",()=>{
  const g=game();
  const original=g.read("JSON.stringify(generateBoss(runSeed(0),0))");
  g.read(`b.moves=[[4,2,4,2,1,2,0,1,5],[2,4,2,3,1,3,0,1,4]];
    globalThis.firing=b.moves[0].slice();b.move=0;b.phase="active";b.timer=0;b.pulse=-1;
    b.attack++;b.aimY=p.y+14;freeze=0;`);
  g.tick();assert.equal(g.read("shots.length"),1);
  g.read(`b.moves[0][S]=2;b.moves[0][F]=0;b.move=1;b.phase="wait";b.timer=9999;p.hp=1;
    shots[0].x=p.x+9;shots[0].y=p.y+14;shots[0].vx=shots[0].vy=0;p.inv=0;`);
  g.tick();assert.equal(g.read("mode"),"dead");assert.equal(g.read("feedback.kind"),"hurt");
  assert.ok(g.read('lastLesson.includes("SHOT")&&lastLesson.includes(lesson(firing))'));
  assert.ok(!g.read('lastLesson.includes("SLAM")'),"current boss move must not be guessed as projectile source");
  assert.match(g.read("lesson(firing)"),/parry/i,"SHOT lesson should describe actual reflection");
  assert.doesNotMatch(g.read("lesson(b.moves[1])"),/\b(?:try |use |or )parry\b/i,"unparryable SLAM must not suggest parrying");
  g.tick(30);assert.equal(g.read('shake'),0,"death must not leave permanent screen shake");
  assert.ok(g.read('lastLesson.includes("SHOT")'),"death explanation must outlive transient effects");
  g.key("KeyR");assert.equal(g.read("mode"),"fight");assert.equal(g.read("lastLesson"),"");
  assert.equal(g.read("JSON.stringify(generateBoss(runSeed(0),0))"),original);
  assert.equal(g.read("JSON.stringify(b.moves)"),g.read("JSON.stringify(generateBoss(runSeed(0),0).moves)"));
});

check("projectile parry feedback follows actual reflection",()=>{
  const g=game();g.read('b.timer=9999;');g.key("KeyK");g.tick(4);
  g.read(`b.moves=[[4,2,4,2,1,2,0,1,5]];b.move=0;b.aimY=p.y+14;
    spawnBossShot(b.moves[0],0);shots[0].x=p.x+9;shots[0].y=p.y+14;
    shots[0].vx=shots[0].vy=0;`);
  g.tick();assert.equal(g.read('shots[0].owner'),0);assert.equal(g.read('run.parries'),1);
  assert.equal(g.read('feedback.kind'),"parry");assert.equal(g.read('run.hits'),0);
  assert.equal(g.read('lastLesson'),"");g.tick(10);assert.equal(g.read('run.parries'),1);
});

console.log(`${checked} experience regressions passed`);
