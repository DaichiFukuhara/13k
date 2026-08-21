"use strict";

/* Prismatic Duel: a generated, learnable boss duel. The generator is kept
   independent from the browser boot so scripts/test.mjs can audit seeds. */

const CW=640,CH=360,FLOOR=307,STEP=1000/60;
const WIND=[24,36,54,80],ACTIVE=[5,8,12],REC=[18,32,50,76],REACH=[48,82,136,250];
const PAL=["#ed596f","#ec9348","#ead85b","#5dcc8a","#5ea8e8","#746ae6","#bd64e6"];
const COLOR_NAME=["CRIMSON","AMBER","GOLDEN","VERDANT","AZURE","INDIGO","VIOLET"];
const SHAPE_NAME=["SWEEP","THRUST","SLAM","CHARGE","SHOT","RAIN"];
const WEAPON_NAME=["BLADE","LANCE","HAMMER","HORN","ORBIT","CROWN"];
const DEF_NAME=["","ARMOR","BARRIER","SHIELD"];
const PARRY=1,JUMPABLE=2,MOVEABLE=4;
// 技は容量を抑えるため配列で保持する。各添字は shape, damage, range,
// windup, active, recovery, tracking, repeat, flags の順。
const S=0,D=1,R=2,W=3,A=4,C=5,T=6,N=7,F=8;
const DMG_COST=[0,1,3,6,9],RANGE_COST=[0,0,1,3,5],WIND_COST=[0,4,2,0,-2],REC_COST=[0,0,-1,-3,-5];

const CHAR=[
  {name:"UNICORN",col:"#f3f0ff",hp:8,cost:14,dmg:3,post:1,hit:8,end:20,reach:0,shot:1,roll:4.8},
  {name:"RED",col:"#ed596f",hp:10,cost:24,dmg:7,post:4,hit:14,end:34,reach:54,shot:0,roll:4.6},
  {name:"BLUE",col:"#5ea8e8",hp:7,cost:10,dmg:2,post:2,hit:7,end:17,reach:38,shot:0,roll:5.8}
];

function seeded(seed){
  // Mulberry32。ゲーム中のMath.randomとは分離し、シードから技構成を再現する。
  let x=seed>>>0||1;
  return()=>{
    let z=x+=0x6d2b79f5;
    z=Math.imul(z^z>>>15,z|1);
    z^=z+Math.imul(z^z>>>7,z|61);
    return((z^z>>>14)>>>0)/4294967296;
  };
}
function pick(r,a){return a[(r()*a.length)|0]}
function clamp(v,a,b){return v<a?a:v>b?b:v}
function threat(m){
  // 長い予備動作・硬直は負のコスト。高威力でも十分な隙があれば許可する。
  return DMG_COST[m[D]]+RANGE_COST[m[R]]+WIND_COST[m[W]]+REC_COST[m[C]]+
    m[T]*2+(m[N]-1)*2+(m[A]===3?2:0);
}
function limits(tier,signature){
  return signature?[6+tier,8+tier*2]:[3+tier,6+tier];
}
function harden(m){
  // 合計値だけでは防げない理不尽な組み合わせを、個別規則で禁止する。
  if(m[W]===1){m[D]=Math.min(2,m[D]);m[T]=Math.min(1,m[T]);m[N]=1}
  if(m[D]===4&&m[R]===4){m[W]=Math.max(3,m[W]);m[C]=Math.max(3,m[C])}
  if(m[R]===4&&m[T]===2){m[D]=Math.min(2,m[D]);m[W]=Math.max(2,m[W])}
  if(m[N]===3)m[D]=1;
  if(m[A]===3&&m[T]===2)m[T]=1;
  return m;
}
function balance(m,tier,signature){
  // 危険度が帯域外なら、まず予備動作と硬直で補正する。威力・射程を
  // 変更するのは、それだけでは収まらない場合に限定する。
  const [lo,hi]=limits(tier,signature);
  for(let i=0;i<24;i++){
    harden(m);
    const q=threat(m);
    if(q>hi){
      if(m[C]<4)m[C]++;
      else if(m[W]<4)m[W]++;
      else if(m[T])m[T]--;
      else if(m[N]>1)m[N]--;
      else if(m[D]>1)m[D]--;
      else if(m[R]>1)m[R]--;
    }else if(q<lo){
      if(m[C]>1)m[C]--;
      else if(m[W]>1)m[W]--;
      else if(m[D]<4)m[D]++;
      else if(m[R]<4)m[R]++;
      else break;
    }else break;
  }
  return harden(m);
}
function makeMove(r,shape,tier,signature){
  // 連続値を直接生成せず、調整可能な段階値を引いてから安全側へ補正する。
  const ranges=[[2,3],[1,3],[1,2],[3,4],[3,4],[3,4]][shape];
  let range=ranges[0]+((r()*(ranges[1]-ranges[0]+1))|0);
  let damage=1+((r()*Math.min(4,2+tier+(signature?1:0)))|0);
  let wind=1+(r()*4|0),active=1+(r()*2|0),recovery=1+(r()*4|0);
  let track=(shape===4||shape===5)?r()*Math.min(3,tier+2)|0:0;
  let repeat=signature&&r()>.55?2:1;
  if(signature&&tier===2&&r()>.82)repeat=3;
  if(signature&&r()>.7)active=3;
  let flags=MOVEABLE;
  if(shape===0||shape===1||shape===3)flags|=PARRY;
  if(shape===0||shape===3)flags|=JUMPABLE;
  return balance([shape,damage,range,wind,active,recovery,track,repeat,flags],tier,signature);
}
function generateBoss(seed,tier){
  // 役割枠を先に決めることで「全技が近接」「接近手段がない」を防ぐ。
  const r=seeded((seed^Math.imul(tier+1,0x9e3779b9))>>>0);
  const shapes=tier===0?
    [1,0,pick(r,[3,4]),pick(r,[2,5])]:
    [1,0,pick(r,[3,4]),pick(r,[4,5]),pick(r,[2,3,5])];
  const moves=shapes.map((s,i)=>makeMove(r,s,tier,i===shapes.length-1));
  if(moves[2][S]!==3){
    // GAP枠が突進でない場合は、必ず全域へ届く遠距離技にする。
    const m=moves[2],hi=limits(tier,0)[1];m[R]=4;harden(m);
    for(let k=0;k<8&&threat(m)>hi;k++){if(m[C]<4)m[C]++;else if(m[W]<4)m[W]++;else if(m[D]>1)m[D]--;else break;harden(m)}
  }
  const open=i=>{
    // 最低2技には反撃可能な長い硬直を残す。硬直を戻さず他の特性で
    // 下限へ近づけるため、危険技だけでなく明確な攻撃機会も生成される。
    const m=moves[i],lo=limits(tier,i===moves.length-1)[0]-2;m[C]=Math.max(3,m[C]);
    for(let k=0;k<8&&threat(m)<lo;k++){
      const old=m.join();
      if(m[N]===3&&m[D]===1)m[N]=2;else if(m[W]===1&&m[D]===2)m[W]=2;else if(m[D]<4)m[D]++;else if(m[R]<4)m[R]++;else if(m[W]>2)m[W]--;else break;
      harden(m);if(m.join()===old)break;
    }
  };
  open(moves.length-1);
  if(moves.filter(m=>m[C]>=3).length<2){
    let best=-1;for(let i=0;i<moves.length-1;i++)if(moves[i][C]<3&&(best<0||threat(moves[i])>threat(moves[best])))best=i;if(best>=0)open(best);
  }
  let fast=0;
  moves.forEach((m,i)=>{
    // 24f級の高速技は一体につき一つまで。追加分は36fへ落とす。
    if(m[W]===1&&fast++){
      m[W]=2;const lo=limits(tier,i===moves.length-1)[0];
      for(let k=0;k<8&&threat(m)<lo;k++){if(m[D]<4)m[D]++;else if(m[R]<4)m[R]++;else if(m[C]>1)m[C]--;else break}
      harden(m);
    }
  });
  const defense=tier?1+(r()*3|0):0;
  const traits=[];
  // 外見色はランダム装飾ではなく、実際に生成された特徴候補から選ぶ。
  if(moves.some(m=>m[D]>=3))traits.push(0);
  if(moves.some(m=>m[A]===3))traits.push(1);
  if(moves.some(m=>m[W]<=2))traits.push(2);
  if(defense)traits.push(3);
  if(moves.some(m=>m[R]===4))traits.push(4);
  if(moves.some(m=>m[T]))traits.push(5);
  if(moves.some(m=>m[N]>1))traits.push(6);
  const hue=pick(r,traits.length?traits:[0]);
  const sig=moves[moves.length-1][S];
  return{
    seed:seed>>>0,tier,moves,defense,hue,
    name:COLOR_NAME[hue]+" "+WEAPON_NAME[sig],
    maxHp:[120,160,210][tier],maxPosture:[24,32,42][tier]
  };
}
function validateBoss(b){
  // 開発専用。Terserでは未使用関数として提出版から消える。
  // test.mjsが30,000体に対して同じ不変条件を検査する。
  const errors=[],tier=b.tier;
  if(b.moves.length!==4+(tier>0))errors.push("move count");
  if(!b.moves.some(m=>m[F]&JUMPABLE))errors.push("no jump answer");
  if(b.moves.filter(m=>m[F]&PARRY).length<2)errors.push("too few parries");
  if(!b.moves.some(m=>m[R]===4||m[S]===3))errors.push("no gap pressure");
  if(b.moves.filter(m=>m[C]>=3).length<2)errors.push("too few openings");
  if(b.moves.filter(m=>m[W]===1).length>1)errors.push("too many fast moves");
  for(const m of b.moves){
    const [lo,hi]=limits(tier,m===b.moves[b.moves.length-1]);
    if(threat(m)<lo-(m[C]>=3?2:0)||threat(m)>hi)errors.push("budget");
    if(m[D]===4&&m[R]===4&&(m[W]<3||m[C]<3))errors.push("fast lethal range");
    if(m[W]===1&&(m[D]>2||m[T]>1||m[N]>1))errors.push("fast overload");
    if(m[R]===4&&m[T]===2&&(m[D]>2||m[W]<2))errors.push("tracking overload");
    if(m.some(v=>!Number.isFinite(v)))errors.push("invalid number");
  }
  return errors;
}

/* ---------------------------- browser runtime --------------------------- */

let cv,cx,mode="title",seed=1,run,p,b,keys={},tap={},shots=[],parts=[],stars=[];
let acc=0,last=0,freeze=0,shake=0,msg="",msgTime=0,audio;

function boot(){
  cv=document.getElementById("c");cx=cv.getContext("2d");
  const q=new URLSearchParams(location.search).get("seed");
  seed=q?parseInt(q,36)>>>0:(Math.random()*0xffffffff)>>>0;
  const sr=seeded(71);for(let i=0;i<70;i++)stars.push([sr()*CW,sr()*220,sr()*1.8+.3]);
  addEventListener("keydown",e=>{
    if(["ArrowLeft","ArrowRight","ArrowDown","Space","KeyA","KeyD","KeyW","KeyS","KeyJ","KeyK","KeyL","KeyZ","KeyX","KeyC","Enter","KeyR","KeyN","Escape"].includes(e.code))e.preventDefault();
    // tapは一回だけ使う入力、keysは押し続ける移動入力として分ける。
    if(!e.repeat)tap[e.code]=1;keys[e.code]=1;wakeAudio();
  });
  addEventListener("keyup",e=>keys[e.code]=0);
  addEventListener("blur",()=>{if(mode==="fight")mode="pause"});
  requestAnimationFrame(loop);
}
function wakeAudio(){
  if(!audio)try{audio=new AudioContext}catch(e){}
  if(audio&&audio.state==="suspended")audio.resume();
}
function sound(f=220,d=.06,type="square",vol=.035){
  if(!audio)return;
  const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;
  o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(40,f*.65),t+d);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g).connect(audio.destination);o.start(t);o.stop(t+d);
}
function pressed(...a){return a.some(k=>tap[k])}
function held(...a){return a.some(k=>keys[k])}
function runSeed(i){return(seed^Math.imul(i+1,0x85ebca6b))>>>0}
function seedText(){return(seed>>>0).toString(36).toUpperCase().padStart(6,"0")}

function newRun(s=seed){
  seed=s>>>0;run={boss:0,time:0,hits:0,parries:0,swaps:0};startBoss();
}
function startBoss(){
  // リトライ時もrunSeedは変わらないため、同じ敵を学び直せる。
  const cfg=generateBoss(runSeed(run.boss),run.boss);
  b={...cfg,hp:cfg.maxHp,posture:cfg.maxPosture,x:500,y:FLOOR-72,face:-1,phase:"wait",timer:70,
    deck:[],move:0,attack:0,pulse:0,target:140,aimY:FLOOR-18,targets:[],lastGuard:-1,attacks:0,broken:0,barrier:0,mutated:0};
  p={x:125,y:FLOOR-30,vx:0,vy:0,face:1,ground:1,coyote:6,cur:0,
    hp:CHAR.map(c=>c.hp),st:[100,100,100],delay:[0,0,0],down:[0,0,0],
    action:"",timer:0,inv:0,swapCd:0,lastHit:"",jumpBuf:0,actBuf:0,parryBuf:0,rollBuf:0,swapBuf:0};
  shots=[];parts=[];mode="fight";say("READ THE COLORS. LEARN THE RHYTHM.",120);
}
function say(t,n=70){msg=t;msgTime=n}
function spark(x,y,col,n=8){
  for(let i=0;i<n;i++){const a=Math.random()*6.28,s=Math.random()*2.5+.5;parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:16+Math.random()*15,col})}
}
function boxPlayer(){return{x:p.x+3,y:p.y+3,w:12,h:25}}
function boxBoss(){return{x:b.x+5,y:b.y+4,w:37,h:68}}
function hit(a,z){return a.x<z.x+z.w&&a.x+a.w>z.x&&a.y<z.y+z.h&&a.y+a.h>z.y}
function aliveNext(){
  for(let k=1;k<4;k++){const n=(p.cur+k)%3;if(!p.down[n])return n}
  return-1;
}
function spend(n){
  if(p.st[p.cur]<n)return 0;p.st[p.cur]-=n;p.delay[p.cur]=30;return 1;
}
function begin(a){p.action=a;p.timer=0;p.vx=0}
function isRollInv(){return p.action==="roll"&&p.timer>=4&&p.timer<=14}
function isParry(){return p.action==="parry"&&p.timer>=4&&p.timer<=9}

/* --------------------------- player state machine ----------------------- */

function playerStep(){
  if(p.inv)p.inv--;if(p.swapCd)p.swapCd--;
  for(let i=0;i<3;i++){
    // 奥に下がったキャラは能動キャラより速く回復し、交代に資源上の意味を持たせる。
    if(p.delay[i])p.delay[i]--;
    else p.st[i]=Math.min(100,p.st[i]+(i===p.cur?.3:.5));
  }
  p.jumpBuf=Math.max(0,p.jumpBuf-1);p.actBuf=Math.max(0,p.actBuf-1);p.parryBuf=Math.max(0,p.parryBuf-1);
  p.rollBuf=Math.max(0,p.rollBuf-1);p.swapBuf=Math.max(0,p.swapBuf-1);
  if(pressed("Space","KeyW"))p.jumpBuf=7;
  if(pressed("KeyJ","KeyZ"))p.actBuf=5;
  if(pressed("KeyK","KeyX"))p.parryBuf=5;
  if(pressed("KeyL","KeyC"))p.rollBuf=5;
  if(pressed("ArrowDown","KeyS"))p.swapBuf=5;

  if(p.action){
    // 行動中は原則キャンセル不可。パリィ成功だけがp.actionを直接解除する。
    p.timer++;
    if(p.action==="attack"){
      const c=CHAR[p.cur];
      if(p.timer===c.hit)playerStrike(c);
      if(p.timer>=c.end)p.action="";
    }else if(p.action==="roll"){
      p.vx=p.face*CHAR[p.cur].roll;
      if(p.timer>=24)p.action="";
    }else if(p.action==="parry"){
      if(p.timer>=22)p.action="";
    }else if(p.action==="swap"){
      if(p.timer===9){const n=aliveNext();if(n>=0){p.cur=n;run.swaps++;sound(360,.06,"sine");}}
      if(p.timer>=18)p.action="";
    }else if(p.action==="hit"&&p.timer>=12)p.action="";
  }

  if(!p.action){
    let d=(held("ArrowRight","KeyD")?1:0)-(held("ArrowLeft","KeyA")?1:0);
    p.vx=d*2.45;if(d)p.face=d;
    if(p.swapBuf&&p.swapCd<=0&&aliveNext()>=0){p.swapBuf=0;p.swapCd=60;begin("swap")}
    else if(p.rollBuf&&(p.ground||p.cur===2)&&spend(24)){p.rollBuf=0;begin("roll");if(!p.ground)p.vy=0;sound(110,.05,"sine",.02)}
    else if(p.parryBuf&&spend(18)){p.parryBuf=0;begin("parry");sound(280,.04,"triangle",.02)}
    else if(p.actBuf&&spend(CHAR[p.cur].cost)){p.actBuf=0;begin("attack")}
  }
  if(p.ground)p.coyote=6;else p.coyote=Math.max(0,p.coyote-1);
  if(p.jumpBuf&&p.coyote&&p.action!=="roll"&&p.action!=="hit"&&p.action!=="swap"){
    p.jumpBuf=0;p.coyote=0;p.ground=0;p.vy=-7.25;sound(170,.05,"sine",.018);
  }
  if(!held("Space","KeyW")&&p.vy<-2.2)p.vy*=.58;
  if(p.action!=="roll")p.vy=Math.min(9,p.vy+.42);
  p.x+=p.vx;p.y+=p.vy;
  p.x=clamp(p.x,20,CW-38);
  if(p.y>=FLOOR-30){p.y=FLOOR-30;p.vy=0;p.ground=1}else p.ground=0;
  if(hit(boxPlayer(),boxBoss())&&p.action!=="roll")p.x=b.x>p.x?b.x-13:b.x+38;
}
function playerStrike(c){
  // 遠近とも発生フレームは同じ入口を通り、当たり判定だけを分岐する。
  sound(p.cur===1?90:220,.08,p.cur===2?"sawtooth":"square",.025);
  if(c.shot){shots.push({x:p.x+9,y:p.y+12,vx:p.face*5.4,vy:0,owner:0,dmg:c.dmg,post:c.post,col:c.col,life:150});return}
  const q={x:p.face>0?p.x+15:p.x-c.reach,y:p.y+2,w:c.reach,h:29};
  if(hit(q,boxBoss()))bossDamage(c.dmg,c.post,"melee");
}
function bossDamage(dmg,post,kind){
  // HPと体勢を独立させ、遠距離の安全性と近距離・パリィの報酬を分ける。
  if(mode!=="fight"||b.phase==="shift")return;
  if(b.phase==="guard"){dmg*=.3;post*=.35}
  if(b.defense===2&&kind==="shot"&&!b.barrier)dmg*=.3;
  if(b.defense===1&&b.phase!=="recover"&&b.phase!=="stagger")post*=.5;
  if(kind==="melee"&&b.defense===2)b.barrier=180;
  if(b.phase==="recover"||b.phase==="stagger")dmg*=1.25;
  b.hp=Math.max(0,b.hp-dmg);b.posture=Math.max(0,b.posture-post);
  spark(b.x+20,b.y+28,PAL[b.hue],7);freeze=kind==="melee"?3:1;shake=kind==="melee"?3:1;
  if(b.hp<=0){mode="bosswin";sound(70,.5,"sawtooth",.05);return}
  if(b.tier===2&&!b.mutated&&b.hp<=b.maxHp/2){
    // 最終形態は既知の固有技を強化するだけで、別の回避規則には変えない。
    b.mutated=1;const m=b.moves[b.moves.length-1];m[D]=Math.min(4,m[D]+1);m[W]=Math.min(4,m[W]+1);m[C]=Math.min(4,m[C]+1);harden(m);
    b.phase="shift";b.timer=75;shots=shots.filter(s=>s.owner===0);say("THE PRISM CHANGES",100);sound(65,.35,"sawtooth",.04);return;
  }
  if(b.posture<=0&&b.phase!=="stagger")breakBoss();
}
function breakBoss(){
  b.phase="stagger";b.timer=110;b.posture=0;freeze=6;shake=6;spark(b.x+22,b.y+30,"#fff",22);say("POSTURE BROKEN",70);sound(880,.18,"square",.05);
}
function hurtPlayer(dmg,id){
  // idは「攻撃番号:多段番号」。同じ判定が複数フレーム重なっても一度だけ被弾する。
  if(mode!=="fight"||p.inv||isRollInv()||p.lastHit===id)return;
  p.lastHit=id;p.hp[p.cur]=Math.max(0,p.hp[p.cur]-dmg);p.inv=42;run.hits++;shake=5;freeze=4;
  spark(p.x+9,p.y+12,CHAR[p.cur].col,12);sound(75,.16,"sawtooth",.045);
  if(!p.hp[p.cur]){
    const fallen=CHAR[p.cur].name;p.down[p.cur]=1;const n=aliveNext();
    if(n<0){mode="dead";say("THE PRISM GOES DARK",999);return}
    p.cur=n;p.inv=60;p.swapCd=60;say(fallen+" FALLS",80);
  }
  begin("hit");p.vy=-2.4;p.vx=b.x>p.x?-2:2;
}
function parryBoss(id){
  if(p.lastHit===id)return;p.lastHit=id;run.parries++;b.posture=Math.max(0,b.posture-8);freeze=6;shake=4;
  p.action="";spark(p.x+p.face*12,p.y+12,"#fff",18);sound(1100,.1,"square",.055);say("PARRY",35);
  if(!b.posture)breakBoss();else{b.phase="recover";b.timer=42}
}
function bossContact(q,id,parryable){
  // 回避、パリィ、被弾の優先順を一か所へ集約する。
  if(!hit(q,boxPlayer()))return;
  if(isParry()&&parryable){parryBoss(id);return}
  hurtPlayer(b.moves[b.move][D],id);
}

/* ---------------------------- boss state machine ------------------------ */

function shuffle(a,r){for(let i=a.length-1;i;i--){const j=r()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a}
function nextMove(){
  // 山札を一巡するまで各技を一度ずつ使う。距離条件は先頭3枚の並べ替えだけで、
  // プレイヤー入力を読んだ完全カウンターAIにはしない。
  if(!b.deck.length){b.cycle=(b.cycle||0)+1;b.deck=shuffle(b.moves.map((_,i)=>i),seeded((b.seed+b.cycle*97)>>>0))}
  let k=0;
  for(let i=0;i<Math.min(3,b.deck.length);i++){
    const m=b.moves[b.deck[i]],dist=Math.abs((b.x+20)-(p.x+9));
    if((dist<150||m[R]>=3||m[S]===3)){k=i;break}
  }
  return b.deck.splice(k,1)[0];
}
function startMove(){
  // WINDUP開始時に向き・標的・多段位置を確定する。追尾技のみ前半まで更新可能。
  b.move=nextMove();const m=b.moves[b.move];b.phase="wind";b.timer=WIND[m[W]-1];b.attack++;b.attacks++;b.pulse=0;
  b.face=p.x<b.x?-1:1;b.target=p.x+8;b.aimY=p.y+14;b.targets=[];
  for(let i=0;i<m[N];i++)b.targets.push(clamp(b.target+(i?((i%2?1:-1)*(55+18*i)):0),30,CW-30));
  say(SHAPE_NAME[m[S]]+"  "+m[D]+"·"+m[R],Math.min(55,b.timer));
}
function bossStep(){
  // wait → wind → active → recover が通常遷移。guard/stagger/shiftは
  // 明示的な割り込み状態で、recoverを途中キャンセルしない。
  if(b.barrier)b.barrier--;
  if(b.phase==="wait"){
    const enemyShots=shots.some(s=>s.owner===1);
    const dist=Math.abs(b.x-p.x);
    if(!enemyShots){
      if(dist>245)b.x+=b.x>p.x?-1.05:1.05;
      else if(dist<105)b.x+=b.x>p.x?.7:-.7;
      b.face=p.x<b.x?-1:1;
      if(--b.timer<=0){
        if(b.defense===3&&b.attacks&&b.attacks%b.moves.length===0&&b.lastGuard!==b.attacks){b.lastGuard=b.attacks;b.phase="guard";b.timer=60;say("PRISM SHIELD",55)}
        else startMove();
      }
    }
  }else if(b.phase==="guard"){
    if(--b.timer<=0){b.phase="wait";b.timer=24}
  }else if(b.phase==="wind"){
    const m=b.moves[b.move],total=WIND[m[W]-1];
    if(m[T]&&b.timer>total*.38){b.target=p.x+8;b.aimY=p.y+14;b.face=p.x<b.x?-1:1;for(let i=0;i<m[N];i++)b.targets[i]=clamp(b.target+(i?((i%2?1:-1)*(55+18*i)):0),30,CW-30)}
    if(--b.timer<=0){b.phase="active";b.timer=0;b.pulse=-1}
  }else if(b.phase==="active")activeBossMove();
  else if(b.phase==="recover"){
    if(--b.timer<=0){b.phase="wait";b.timer=[42,34,28][b.tier]}
  }else if(b.phase==="stagger"){
    if(--b.timer<=0){b.posture=b.maxPosture;b.phase="wait";b.timer=48}
  }else if(b.phase==="shift"){
    if(--b.timer<=0){b.phase="wait";b.timer=45}
  }
  b.x=clamp(b.x,45,CW-65);
}
function moveRect(m,pulse=0){
  // 予告描画と実ダメージが同じ矩形を参照する、公平性上の中心関数。
  const reach=REACH[m[R]-1],dir=b.face;
  if(m[S]===0)return{x:dir<0?b.x-reach:b.x+40,y:FLOOR-24,w:reach,h:24};
  if(m[S]===1)return{x:dir<0?b.x-reach:b.x+38,y:b.y+26,w:reach,h:18};
  if(m[S]===2)return{x:b.x-reach*.55,y:FLOOR-57,w:reach+44,h:57};
  if(m[S]===3)return boxBoss();
  if(m[S]===5){const w=28+m[R]*9;return{x:b.targets[pulse]-w/2,y:18,w,h:FLOOR-18}}
  return{x:0,y:0,w:0,h:0};
}
function activeBossMove(){
  // 多段技は active + 10f の固定間隔を繰り返し、各段に別のhit idを割り当てる。
  const m=b.moves[b.move],span=ACTIVE[m[A]-1]+10,pulse=Math.min(m[N]-1,(b.timer/span)|0),local=b.timer%span;
  if(pulse!==b.pulse){b.pulse=pulse;if(m[S]===4)spawnBossShot(m,pulse)}
  if(local<ACTIVE[m[A]-1]&&m[S]!==4){
    if(m[S]===3)b.x+=b.face*(3.2+m[R]*.72);
    bossContact(moveRect(m,pulse),b.attack+":"+pulse,!!(m[F]&PARRY));
  }
  b.timer++;
  if(b.timer>=span*m[N]-10){b.phase="recover";b.timer=REC[m[C]-1]}
}
function spawnBossShot(m,pulse){
  const speed=3.1+(5-m[W])*.45;
  const distance=Math.max(60,Math.abs((b.x+20)-(p.x+9)));
  shots.push({x:b.x+20+b.face*22,y:b.y+29,vx:b.face*speed,vy:(b.aimY-b.y-29)/distance*speed,owner:1,dmg:m[D],post:0,col:PAL[b.hue],life:220,track:m[T]*.018,id:b.attack+":"+pulse,parry:1});
  sound(130,.09,"sawtooth",.028);
}
function shotsStep(){
  // 飛び道具はボス状態から独立して更新する。敵弾はパリィで所有権を反転できる。
  for(const s of shots){
    if(s.track&&s.owner===1)s.vy=clamp(s.vy+Math.sign((p.y+14)-s.y)*s.track,-1.3,1.3);
    s.x+=s.vx;s.y+=s.vy;s.life--;
    if(s.owner===0){
      if(hit({x:s.x-4,y:s.y-3,w:8,h:6},boxBoss())){bossDamage(s.dmg,s.post,"shot");s.life=0}
    }else if(hit({x:s.x-5,y:s.y-5,w:10,h:10},boxPlayer())){
      if(isParry()&&s.parry){s.owner=0;s.vx*=-1.35;s.vy*=-1;s.dmg=3;s.post=7;s.col="#fff";run.parries++;freeze=4;sound(960,.08,"square",.05)}
      else if(!isRollInv()&&!p.inv){hurtPlayer(s.dmg,s.id);s.life=0}
    }
  }
  shots=shots.filter(s=>s.life>0&&s.x>-30&&s.x<CW+30&&s.y>-30&&s.y<CH+30);
}
function partsStep(){for(const q of parts){q.x+=q.vx;q.y+=q.vy;q.vy+=.09;q.life--}parts=parts.filter(q=>q.life>0)}

/* ---------------------------- run flow ---------------------------------- */

function step(){
  if(pressed("Escape")){mode=mode==="pause"?"fight":mode==="fight"?"pause":mode}
  if(mode==="title"){
    if(pressed("KeyN")){seed=(Math.random()*0xffffffff)>>>0;sound(300,.05)}
    if(pressed("Enter"))newRun(seed);
  }else if(mode==="dead"){
    if(pressed("Enter","KeyR"))startBoss();
    if(pressed("KeyN")){seed=(Math.random()*0xffffffff)>>>0;mode="title"}
  }else if(mode==="bosswin"){
    if(pressed("Enter")){run.boss++;if(run.boss>=3)mode="result";else startBoss()}
  }else if(mode==="result"){
    if(pressed("KeyR"))newRun(seed);
    if(pressed("Enter","KeyN")){seed=(Math.random()*0xffffffff)>>>0;mode="title"}
  }else if(mode==="pause"){
    if(pressed("Enter"))mode="fight";
  }else if(mode==="fight"){
    if(freeze)freeze--;
    else{run.time++;playerStep();bossStep();shotsStep()}
    partsStep();if(msgTime)msgTime--;
  }
  tap={};
}

/* ---------------------------- rendering --------------------------------- */

function bar(x,y,w,h,v,max,col){cx.fillStyle="#1b1d32";cx.fillRect(x,y,w,h);cx.fillStyle=col;cx.fillRect(x+1,y+1,(w-2)*Math.max(0,v/max),h-2)}
function text(t,x,y,size=10,col="#dfe1f1",align="left"){
  cx.font=`${size}px system-ui,sans-serif`;cx.textAlign=align;cx.fillStyle=col;cx.fillText(t,x,y);
}
function background(){
  const g=cx.createLinearGradient(0,0,0,CH);g.addColorStop(0,"#090a19");g.addColorStop(1,"#171226");cx.fillStyle=g;cx.fillRect(0,0,CW,CH);
  for(const s of stars){cx.globalAlpha=.25+s[2]*.2;cx.fillStyle="#b8c9ff";cx.fillRect(s[0],s[1],s[2],s[2])}cx.globalAlpha=1;
  cx.fillStyle="#1f1830";for(let x=0;x<CW;x+=58)cx.fillRect(x,230+(x%3)*8,34,77);
  cx.fillStyle="#2b2038";cx.fillRect(0,FLOOR,CW,CH-FLOOR);cx.fillStyle="#594569";cx.fillRect(0,FLOOR,CW,2);
}
function attackColor(m){
  if(m[D]>=4)return PAL[0];if(m[T]>=1)return PAL[5];if(m[W]===1)return PAL[2];if(m[R]===4)return PAL[4];if(m[N]>1)return PAL[6];return PAL[b.hue];
}
function drawTelegraph(){
  // wind中は薄い予告、active中は濃い判定。同じmoveRectを使うため表示と判定がずれない。
  if(!b||!(b.phase==="wind"||b.phase==="active"))return;
  const m=b.moves[b.move],col=attackColor(m);
  if(b.phase==="wind"){
    const q=moveRect(m,0),progress=1-b.timer/WIND[m[W]-1];
    if(m[S]!==4){cx.globalAlpha=.08+progress*.2;cx.fillStyle=col;cx.fillRect(q.x,q.y,q.w,q.h);cx.globalAlpha=.4;cx.strokeStyle=col;cx.strokeRect(q.x+.5,q.y+.5,q.w-1,q.h-1)}
    else{cx.globalAlpha=.15+progress*.4;cx.strokeStyle=col;cx.beginPath();cx.moveTo(b.x+20,b.y+29);cx.lineTo(b.x+b.face*REACH[m[R]-1],b.aimY);cx.stroke()}
  }else if(m[S]!==4){const span=ACTIVE[m[A]-1]+10,pulse=Math.min(m[N]-1,(b.timer/span)|0),local=b.timer%span;if(local<ACTIVE[m[A]-1]){const q=moveRect(m,pulse);cx.globalAlpha=.45;cx.fillStyle=col;cx.fillRect(q.x,q.y,q.w,q.h)}}
  cx.globalAlpha=1;
}
function drawPerson(x,y,scale,col,kind,active=0){
  cx.save();cx.translate(x,y);cx.scale(scale,scale);cx.lineCap="round";cx.strokeStyle=col;cx.fillStyle=col;cx.lineWidth=3;
  const lean=active&&p.action==="roll"?8:0;
  cx.beginPath();cx.arc(0,-22+lean,5,0,6.3);cx.fill();cx.beginPath();cx.moveTo(0,-17+lean);cx.lineTo(0,0);cx.lineTo(-6,12);cx.moveTo(0,0);cx.lineTo(7,12);cx.moveTo(0,-12+lean);cx.lineTo(-8,-2);cx.moveTo(0,-11+lean);cx.lineTo(9,-4);cx.stroke();
  if(kind===0){cx.beginPath();cx.moveTo(2,-27+lean);cx.lineTo(9,-35+lean);cx.strokeStyle=PAL[6];cx.stroke()}
  if(kind===1){cx.beginPath();cx.moveTo(8,-5);cx.lineTo(25,-20);cx.strokeStyle=PAL[0];cx.lineWidth=5;cx.stroke()}
  if(kind===2){cx.beginPath();cx.moveTo(8,-5);cx.lineTo(19,-9);cx.strokeStyle=PAL[4];cx.stroke()}
  cx.restore();
}
function drawParty(){
  for(let i=0;i<3;i++)if(i!==p.cur&&!p.down[i]){cx.globalAlpha=.35;drawPerson(p.x+9+(i-p.cur)*24,FLOOR-10,.58,CHAR[i].col,i);cx.globalAlpha=1}
  if(!p.down[p.cur]){cx.save();if(isRollInv())cx.globalAlpha=.55;drawPerson(p.x+9,p.y+18,1,CHAR[p.cur].col,p.cur,1);cx.restore()}
  if(p.action==="parry"){cx.strokeStyle="#fff";cx.globalAlpha=isParry()?1:.25;cx.beginPath();cx.arc(p.x+9+p.face*9,p.y+13,12,-1.4,1.4);cx.stroke();cx.globalAlpha=1}
}
function drawBoss(){
  const col=PAL[b.hue],x=b.x+22,y=b.y+36;cx.save();cx.translate(x,y);if(b.phase==="stagger")cx.rotate(-.2);
  if(b.defense===2&&!b.barrier){cx.strokeStyle=PAL[3];cx.globalAlpha=.45;cx.lineWidth=3;cx.beginPath();cx.arc(0,0,34,0,6.3);cx.stroke();cx.globalAlpha=1}
  if(b.phase==="guard"){cx.fillStyle=PAL[3]+"66";cx.fillRect(b.face<0?-32:14,-28,18,58)}
  cx.strokeStyle=col;cx.fillStyle="#151426";cx.lineWidth=5;cx.beginPath();cx.arc(0,-22,8,0,6.3);cx.fill();cx.stroke();cx.fillRect(-14,-13,28,42);cx.strokeRect(-14,-13,28,42);
  cx.beginPath();cx.moveTo(-7,29);cx.lineTo(-12,48);cx.moveTo(7,29);cx.lineTo(12,48);cx.stroke();
  const shape=b.moves[b.move||0][S],len=28+b.moves[b.move||0][R]*8;cx.lineWidth=shape===2?8:4;cx.beginPath();cx.moveTo(b.face*10,-5);cx.lineTo(b.face*len,-18);cx.stroke();
  for(let i=0;i<7;i++){cx.fillStyle=PAL[i];cx.globalAlpha=i===b.hue?1:.25;cx.fillRect(-13+i*4,-11,3,22)}cx.globalAlpha=1;cx.restore();
}
function hud(){
  text(`PRISM ${run.boss+1}/3  ${b.name}`,20,20,11,PAL[b.hue]);text(`SEED ${seedText()}`,620,20,9,"#777b99","right");
  bar(20,28,390,8,b.hp,b.maxHp,PAL[b.hue]);bar(20,39,390,4,b.posture,b.maxPosture,"#f2e6a2");
  if(b.defense)text(DEF_NAME[b.defense]+(b.defense===2&&b.barrier?" BROKEN":""),420,43,9,PAL[3]);
  for(let i=0;i<3;i++){
    const x=20+i*122,on=i===p.cur;cx.globalAlpha=p.down[i]?.28:1;text(CHAR[i].name,x,334,9,on?CHAR[i].col:"#777b99");
    bar(x,339,108,5,p.hp[i],CHAR[i].hp,CHAR[i].col);bar(x,347,108,3,p.st[i],100,"#e7d96d");cx.globalAlpha=1;
  }
  if(msgTime)text(msg,CW/2,68,12,"#fff","center");
}
function overlay(title,sub,action){
  cx.fillStyle="#080914d9";cx.fillRect(85,78,470,206);text(title,CW/2,126,28,"#f0efff","center");text(sub,CW/2,160,11,"#a3a6c2","center");text(action,CW/2,246,12,"#ead85b","center");
}
function draw(){
  background();cx.save();if(shake){cx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake*=.82;if(shake<.3)shake=0}
  if(mode!=="title"){
    drawTelegraph();for(const s of shots){cx.fillStyle=s.col;cx.globalAlpha=.9;cx.fillRect(s.x-5,s.y-3,10,6)}cx.globalAlpha=1;
    drawParty();drawBoss();for(const q of parts){cx.globalAlpha=q.life/30;cx.fillStyle=q.col;cx.fillRect(q.x,q.y,2,2)}cx.globalAlpha=1;hud();
  }
  cx.restore();
  if(mode==="title"){
    text("PRISMATIC",CW/2,112,16,"#a9aad0","center");text("DUEL",CW/2,158,48,"#f1efff","center");
    for(let i=0;i<7;i++){cx.fillStyle=PAL[i];cx.fillRect(224+i*28,177,22,3+i%2*3)}
    text("GENERATED FOES. LEARNABLE ATTACKS.",CW/2,211,10,"#777b99","center");text("SEED  "+seedText(),CW/2,244,12,"#c4c6dc","center");text("ENTER  BEGIN    N  NEW SEED",CW/2,280,11,"#ead85b","center");
  }else if(mode==="dead")overlay("YOU FELL",b.name+" remembers every move.","ENTER / R  RETRY SAME FOE     N  NEW SEED");
  else if(mode==="bosswin")overlay("PRISM SHATTERED",`${b.name} · ${Math.round((b.maxHp-b.hp)||b.maxHp)} LIGHT`,run.boss===2?"ENTER  RESULTS":"ENTER  DESCEND");
  else if(mode==="result")overlay("RAINBOW RESTORED",`TIME ${Math.floor(run.time/3600)}:${String(Math.floor(run.time/60)%60).padStart(2,"0")}  ·  HITS ${run.hits}  ·  PARRIES ${run.parries}  ·  SWAPS ${run.swaps}`,`SEED ${seedText()}     R  REPLAY     ENTER  NEW RUN`);
  else if(mode==="pause")overlay("PAUSED","The duel waits.","ENTER / ESC  RESUME");
}
function loop(now){
  // 大きなフレーム遅延は最大5stepに丸め、復帰直後の高速消化を防ぐ。
  if(!last)last=now;acc=Math.min(acc+now-last,STEP*5);last=now;
  while(acc>=STEP){step();acc-=STEP}draw();requestAnimationFrame(loop);
}

if(typeof document!=="undefined")boot();
