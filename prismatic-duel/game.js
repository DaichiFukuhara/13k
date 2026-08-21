"use strict";

/*
=============================================================================
PRISMATIC DUEL — ソースレビュー用ガイド
=============================================================================

このファイルは13KB提出用なので、通常の業務コードより変数名と改行を短くしている。
ただし提出時はbuild.mjsがTerserで再圧縮するため、このレビュー用コメントはZIPへ
入らない。まず次の順番で読むと全体を追いやすい。

  1. generateBoss()       シードからボス1体を組み立てる
  2. validateBoss()       生成結果が公平性の条件を満たすか検査する
  3. startBoss()          生成データへ戦闘中の状態を追加する
  4. playerStep()         プレイヤーの1フレーム
  5. bossStep()           ボスの1フレームと状態遷移
  6. moveRect()           予告表示と実判定が共有する攻撃範囲
  7. step() / loop()      画面遷移と60Hz固定更新
  8. draw()               Canvas描画

ゲームの中心ルール:

  - ボスの技セットは戦闘開始前にだけランダム生成する。
  - 同じシードでリトライすれば、技の形と数値は完全に同じになる。
  - 攻撃開始後は乱数で発生時刻や範囲を変えない。
  - 強い特性には長い予備動作や硬直を付け、必ず反撃時間を作る。
  - 表示した危険範囲と実際の当たり判定はmoveRect()を共有する。

1フレームの処理順:

  loop()              requestAnimationFrameの経過時間を蓄積
    └─ step()          60Hz単位で0～5回更新
         ├─ playerStep()  入力、行動、移動
         ├─ bossStep()    技選択、予告、攻撃、硬直
         ├─ shotsStep()   プレイヤー弾・敵弾
         └─ partsStep()   見た目だけの火花
    └─ draw()          現在状態を1回描画

生成器部分はDOMへ依存させていない。test.mjsはブラウザを起動せずgame.jsを読み、
generateBoss()とvalidateBoss()を30,000体に対して直接実行する。
=============================================================================
*/

const CW=640,CH=360,FLOOR=307,STEP=1000/60;
const WIND=[24,36,54,80],ACTIVE=[5,8,12],REC=[18,32,50,76],REACH=[48,82,136,250];
const PAL=["#ed596f","#ec9348","#ead85b","#5dcc8a","#5ea8e8","#746ae6","#bd64e6"];
const COLOR_NAME=["CRIMSON","AMBER","GOLDEN","VERDANT","AZURE","INDIGO","VIOLET"];
const SHAPE_NAME=["SWEEP","THRUST","SLAM","CHARGE","SHOT","RAIN"];
const WEAPON_NAME=["BLADE","LANCE","HAMMER","HORN","ORBIT","CROWN"];
const DEF_NAME=["","ARMOR","BARRIER","SHIELD"];
const PARRY=1,JUMPABLE=2,MOVEABLE=4;
/*
技データ Move
---------------
容量を抑えるためオブジェクトではなく9要素の配列を使う。

  m[S] shape     0:横薙ぎ 1:突き 2:叩きつけ 3:突進 4:弾 5:落下攻撃
  m[D] damage    1～4。プレイヤーHPから直接引く
  m[R] range     1～4。REACHテーブルから実ピクセルへ変換
  m[W] windup    1～4。WINDテーブルから予備動作フレームへ変換
  m[A] active    1～3。ACTIVEテーブルから攻撃判定の持続へ変換
  m[C] recovery  1～4。RECテーブルから攻撃後硬直へ変換
  m[T] tracking  0～2。予備動作中の追尾と弾の曲がり方
  m[N] repeat    1～3。同じ攻撃が何段発生するか
  m[F] flags     PARRY / JUMPABLE / MOVEABLE のビット和

例: [0,4,3,3,1,4,0,1,7]
    = 長い予備動作と硬直を持つ、高威力・長射程の横薙ぎ。
      flags 7なので移動・ジャンプ・パリィの回答を持つ。
*/
const S=0,D=1,R=2,W=3,A=4,C=5,T=6,N=7,F=8;
const DMG_COST=[0,1,3,6,9],RANGE_COST=[0,0,1,3,5],WIND_COST=[0,4,2,0,-2],REC_COST=[0,0,-1,-3,-5];

/*
プレイヤーキャラ定義
--------------------
  hp     個別最大HP
  cost   通常攻撃のスタミナ消費
  dmg    ボスHPへ与えるダメージ
  post   ボス体勢へ与えるダメージ
  hit    攻撃開始から判定発生までのフレーム
  end    攻撃全体が終了するフレーム
  reach  近接判定の長さ。shot=1のUnicornは使用しない
  shot   1なら弾、0なら近接矩形を生成
  roll   ローリング中の横速度

3人とも基本回避は共通だが、攻撃の安全性・火力・ロール距離が異なる。
*/
const CHAR=[
  {name:"UNICORN",col:"#f3f0ff",hp:8,cost:14,dmg:3,post:1,hit:8,end:20,reach:0,shot:1,roll:4.8},
  {name:"RED",col:"#ed596f",hp:10,cost:24,dmg:7,post:4,hit:14,end:34,reach:54,shot:0,roll:4.6},
  {name:"BLUE",col:"#5ea8e8",hp:7,cost:10,dmg:2,post:2,hit:7,end:17,reach:38,shot:0,roll:5.8}
];

/*
seeded(seed) -> 0以上1未満を返す関数

Mulberry32系の小さな疑似乱数生成器。同じ整数seedからは必ず同じ列が出る。
ボス生成にはこれだけを使い、火花や画面揺れに使うMath.randomとは分離する。
見た目の乱数を何回呼んでも、次のリトライのボス構成には影響しない。
*/
function seeded(seed){
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

/*
threat(m) -> 技の危険度

危険な特性を加点し、プレイヤーが観察・反撃できる時間を減点する。
威力は線形ではなく1,3,6,9と増やし、高威力同士の組み合わせを重く扱う。

  加点: 威力、射程、短い予備動作、追尾、多段、長い持続
  減点: 長い予備動作、長い攻撃後硬直

この値は絶対的な強さではなく「生成してよい帯域」を揃えるための一次判定。
形状固有の理不尽さはharden()で別に禁止する。
*/
function threat(m){
  return DMG_COST[m[D]]+RANGE_COST[m[R]]+WIND_COST[m[W]]+REC_COST[m[C]]+
    m[T]*2+(m[N]-1)*2+(m[A]===3?2:0);
}
function limits(tier,signature){
  // tier 0/1/2は1～3体目。最後の固有技だけ、通常技より上の帯域を許可する。
  return signature?[6+tier,8+tier*2]:[3+tier,6+tier];
}

/*
harden(m) -> 同じ配列を安全側へ変更

危険度の合計が同じでも手触りは同じではない。例えば「高速・低威力」と
「低速・高威力」は同点でも成立するが、「高速・高威力・多段」は回避不能に
なりやすい。この関数は次の組み合わせを強制的に崩す。

  - 最速24f: 威力2以下、追尾1以下、単発のみ
  - 威力4かつ全域射程: 予備動作54f以上、硬直50f以上
  - 全域射程かつ強追尾: 威力2以下、予備動作36f以上
  - 3段攻撃: 1発の威力は1
  - 長時間持続かつ強追尾: 追尾を1へ下げる

balance()の反復中にも毎回呼び、数値調整で禁止構成へ戻るのを防ぐ。
*/
function harden(m){
  if(m[W]===1){m[D]=Math.min(2,m[D]);m[T]=Math.min(1,m[T]);m[N]=1}
  if(m[D]===4&&m[R]===4){m[W]=Math.max(3,m[W]);m[C]=Math.max(3,m[C])}
  if(m[R]===4&&m[T]===2){m[D]=Math.min(2,m[D]);m[W]=Math.max(2,m[W])}
  if(m[N]===3)m[D]=1;
  if(m[A]===3&&m[T]===2)m[T]=1;
  return m;
}
/*
balance(m, tier, signature) -> 帯域内へ調整した同じ配列

最大24回の単調な補正で危険度を目標へ近づける。

  強すぎる場合:
    硬直を延ばす → 予備動作を延ばす → 追尾/多段/威力/射程を落とす

  弱すぎる場合:
    硬直を短くする → 予備動作を短くする → 威力/射程を上げる

最初に攻撃の個性を消さず、プレイヤーへ反撃時間を返す方向で調整する。
24回で打ち切るため、バグがあってもブラウザを無限ループさせない。
*/
function balance(m,tier,signature){
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
/*
makeMove(r, shape, tier, signature) -> Move

1. 形状ごとの許可射程から一つ選ぶ
2. 威力・予備動作・持続・硬直を段階値で抽選
3. 弾と落下攻撃だけ追尾を抽選
4. 固有技だけ多段・長時間持続を抽選
5. 形状から有効な回避フラグを決める
6. balance()で難易度帯へ収める

フレーム数を直接ランダムにしないため、24/36/54/80fという読みやすい
リズムだけが生成され、プレイテスト時も段階単位で調整できる。
*/
function makeMove(r,shape,tier,signature){
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
/*
generateBoss(seed, tier) -> ボスの不変な設計データ

生成の全手順:

  1. seedとtierから専用乱数列を作る
  2. 技の役割枠を先に決める
     [突き, 横薙ぎ, 接近/遠距離, 範囲制圧, 固有技]
  3. 各枠をmakeMove()で数値化する
  4. GAP枠が全域へ圧力をかけられるよう補正する
  5. 最低2技へ長い硬直を与え、反撃機会を保証する
  6. 最速24fの技を一つ以下へ抑える
  7. 生成された特徴から外見色と異名を決める
  8. HP・体勢と一緒に返す

ここで返す値に現在HP、座標、行動タイマーは含まれない。それらはリトライで
初期化すべき可変状態なので、startBoss()が別オブジェクトとして付け足す。
*/
function generateBoss(seed,tier){
  const r=seeded((seed^Math.imul(tier+1,0x9e3779b9))>>>0);
  const shapes=tier===0?
    [1,0,pick(r,[3,4]),pick(r,[2,5])]:
    [1,0,pick(r,[3,4]),pick(r,[4,5]),pick(r,[2,3,5])];
  const moves=shapes.map((s,i)=>makeMove(r,s,tier,i===shapes.length-1));
  if(moves[2][S]!==3){
    // GAP枠は3番目。突進なら自分が接近し、弾なら射程4で遠距離を咎める。
    // 射程を上げて危険度超過した分は、硬直・予備動作・威力の順に返す。
    const m=moves[2],hi=limits(tier,0)[1];m[R]=4;harden(m);
    for(let k=0;k<8&&threat(m)>hi;k++){if(m[C]<4)m[C]++;else if(m[W]<4)m[W]++;else if(m[D]>1)m[D]--;else break;harden(m)}
  }
  const open=i=>{
    /*
    反撃用の技へrecovery 3以上（50f以上）を強制する局所関数。
    通常のbalance()へ戻すと「弱すぎる」と判断して硬直を短くしてしまうため、
    ここでは硬直を固定したまま威力・射程側で下限へ寄せる。

    oldとの比較はharden()が変更を元へ戻した場合の停止条件。例えば最速3段技は
    威力を上げてもharden()が1へ戻すため、比較がないと同じ補正を繰り返す。
    */
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
  /*
  開発専用の静的検査。Terserでは未使用関数として提出版から消える。

  技単体だけでなく、技セット全体について以下を保証する。
    - 1体目は4技、2・3体目は5技
    - ジャンプ回答が最低1技
    - パリィ可能技が最低2技
    - 遠距離プレイヤーへ届く技が最低1技
    - 50f以上の反撃硬直が最低2技
    - 24f級の高速技は最大1技

  test.mjsは10,000 seed × 3 tierを生成し、エラー配列が空か検査する。
  */
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

/* ---------------------------- browser runtime ---------------------------

主要な可変状態:

  mode   title / fight / pause / dead / bosswin / result の画面状態
  seed   1ランを再現する32bit整数
  run    3戦をまたいで保持するボス番号・時間・集計値
  p      プレイヤー座標、現在キャラ、3人分HP/スタミナ、行動タイマー
  b      生成データ + ボス現在HP、座標、状態、技山札、標的位置
  shots プレイヤー弾と敵弾をownerで共有する配列
  parts 当たり判定を持たない短命な火花
  tap    押した瞬間だけ1になる入力。step()末尾で空にする
  keys   keyupまで1のままの入力。左右移動とジャンプ高さに使う

---------------------------------------------------------------------------- */

let cv,cx,mode="title",seed=1,run,p,b,keys={},tap={},shots=[],parts=[],stars=[];
let acc=0,last=0,freeze=0,shake=0,msg="",msgTime=0,audio;

function boot(){
  /*
  ブラウザ専用初期化。
  - URLの?seed=を36進数として読む。なければ新規seedを作る
  - 背景の星は固定seedで作り、ゲームseedの乱数列を消費しない
  - キー入力とフォーカス喪失時の自動pauseを登録する
  - requestAnimationFrameを開始する
  */
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
  // ランを完全初期化。Rで同じランを再開するときだけ同じseedを渡す。
  seed=s>>>0;run={boss:0,time:0,hits:0,parries:0,swaps:0};startBoss();
}
function startBoss(){
  /*
  1戦分の可変状態を作る。

  cfg: generateBoss()が返す不変データ。同じrun.bossならリトライでも同じ。

  bの追加フィールド:
    hp/posture       現在値
    phase/timer      ボス状態機械と残り/経過フレーム
    deck             未使用技の山札
    move             現在技のmoves内添字
    attack/pulse     ヒットID生成用の通し番号
    target/aimY      落下技のX、弾のY標的
    targets          多段落下攻撃の全X座標
    attacks          SHIELD発動周期のための使用技数
    barrier          0ならBARRIER有効。正数なら破壊中の残り時間
    mutated          3体目のHP50%変異を一度だけ行うフラグ

  pの配列 hp/st/delay/down はキャラ順 [Unicorn, Red, Blue]。
  座標・速度は現在キャラだけが持ち、交代時にそのまま次キャラへ引き継ぐ。
  */
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
  // 現在位置の次から循環し、生存している交代先を探す。全滅なら-1。
  for(let k=1;k<4;k++){const n=(p.cur+k)%3;if(!p.down[n])return n}
  return-1;
}
function spend(n){
  // 消費後30fは回復しない。成功/失敗を返し、スタミナ不足で行動開始させない。
  if(p.st[p.cur]<n)return 0;p.st[p.cur]-=n;p.delay[p.cur]=30;return 1;
}
function begin(a){p.action=a;p.timer=0;p.vx=0}
// ロール24f中の4～14fだけ無敵。開始直後と終端には当たり判定が残る。
function isRollInv(){return p.action==="roll"&&p.timer>=4&&p.timer<=14}
// パリィ22f中の4～9fだけ受付。失敗後は残り時間がそのまま硬直になる。
function isParry(){return p.action==="parry"&&p.timer>=4&&p.timer<=9}

/* --------------------------- player state machine ----------------------- */

function playerStep(){
  /*
  プレイヤーの1フレーム。処理順には意味がある。

    1. 無敵・交代CD・スタミナ回復待ちを減らす
    2. 各入力を5～7fのバッファへ移す
    3. 実行中actionのタイマーを進め、発生/終了フレームを処理
    4. actionが空なら、交代→ロール→パリィ→攻撃の優先順で開始
    5. ジャンプ入力とコヨーテタイムを処理
    6. 重力、座標、床・画面端を処理
    7. 通常時だけボス本体との重なりを押し戻す

  入力バッファにより、硬直終了の数フレーム前に押したボタンも次行動になる。
  */
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
    // 同じフレームに複数入力された場合の優先順位。交代は無敵がないため最優先でも
    // 防御の代用にはならない。ロールは接地中、またはBlueの空中時だけ開始できる。
    let d=(held("ArrowRight","KeyD")?1:0)-(held("ArrowLeft","KeyA")?1:0);
    p.vx=d*2.45;if(d)p.face=d;
    if(p.swapBuf&&p.swapCd<=0&&aliveNext()>=0){p.swapBuf=0;p.swapCd=60;begin("swap")}
    else if(p.rollBuf&&(p.ground||p.cur===2)&&spend(24)){p.rollBuf=0;begin("roll");if(!p.ground)p.vy=0;sound(110,.05,"sine",.02)}
    else if(p.parryBuf&&spend(18)){p.parryBuf=0;begin("parry");sound(280,.04,"triangle",.02)}
    else if(p.actBuf&&spend(CHAR[p.cur].cost)){p.actBuf=0;begin("attack")}
  }
  if(p.ground)p.coyote=6;else p.coyote=Math.max(0,p.coyote-1);
  // coyoteは床を離れた後6f、jumpBufは押してから7f残る。この二つが重なれば跳ぶ。
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
  /*
  攻撃モーションのc.hitフレームから一度だけ呼ばれる。
  Unicornはshotsへowner=0の弾を追加し、Red/Blueは向きに応じた矩形を即判定する。
  弾と近接の最終ダメージ計算はどちらもbossDamage()へ集約する。
  */
  sound(p.cur===1?90:220,.08,p.cur===2?"sawtooth":"square",.025);
  if(c.shot){shots.push({x:p.x+9,y:p.y+12,vx:p.face*5.4,vy:0,owner:0,dmg:c.dmg,post:c.post,col:c.col,life:150});return}
  const q={x:p.face>0?p.x+15:p.x-c.reach,y:p.y+2,w:c.reach,h:29};
  if(hit(q,boxBoss()))bossDamage(c.dmg,c.post,"melee");
}
function bossDamage(dmg,post,kind){
  /*
  ボスが攻撃を受けたときの唯一の入口。

  kind="shot"  Unicorn弾または反射弾
  kind="melee" Red/Blueの近接

  防御能力:
    SHIELD  guard中はHP30%、体勢35%だけ通す
    BARRIER バリア有効中のshotを30%へ減らす。melee命中で180f破壊
    ARMOR   通常時の体勢ダメージを半減

  recover/stagger中は明確な反撃窓なのでHPダメージ1.25倍。
  HP0を最優先し、その後に最終形態移行、体勢崩しを判定する。
  */
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
  // 110fの大きな反撃窓。終了後に体勢を全回復して通常ループへ戻す。
  b.phase="stagger";b.timer=110;b.posture=0;freeze=6;shake=6;spark(b.x+22,b.y+30,"#fff",22);say("POSTURE BROKEN",70);sound(880,.18,"square",.05);
}
function hurtPlayer(dmg,id){
  /*
  プレイヤー被弾の唯一の入口。

  idは「攻撃番号:多段番号」。activeが5～12f継続しても、同じ段から受ける
  ダメージは一回だけ。被弾後42fの無敵を付け、HP0ならそのキャラをdownにする。
  残りキャラがいれば60f無敵で自動交代し、いなければdead画面へ移る。
  */
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
  /*
  近接攻撃のパリィ成功。
  - 同じ攻撃段の多重成功をlastHitで防ぐ
  - ボス体勢を8削る
  - プレイヤーのparry硬直を解除する
  - 体勢0ならstagger、残っていれば42fのrecoverへ送る
  */
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
  /*
  次の技添字を返す。

  山札が空なら全技をシード付きでシャッフルし、一巡するまで同じ技を戻さない。
  先頭3枚だけを見て、現在距離で届く最初の技を選ぶ。候補がなければ先頭を使う。
  これにより完全ランダムの連打を防ぎつつ、決まった順番の暗記にもならない。

  シャッフルseedは「ボスseed + 周回数*97」なので、描画や入力の乱数に依存しない。
  */
  if(!b.deck.length){b.cycle=(b.cycle||0)+1;b.deck=shuffle(b.moves.map((_,i)=>i),seeded((b.seed+b.cycle*97)>>>0))}
  let k=0;
  for(let i=0;i<Math.min(3,b.deck.length);i++){
    const m=b.moves[b.deck[i]],dist=Math.abs((b.x+20)-(p.x+9));
    if((dist<150||m[R]>=3||m[S]===3)){k=i;break}
  }
  return b.deck.splice(k,1)[0];
}
function startMove(){
  /*
  waitからwindへ入る処理。
  攻撃通し番号を増やし、向き、落下X、射撃Y、多段の全標的位置をここで確定する。
  tracking>0の技だけはwind前半まで標的を更新するが、activeへ入った後は変えない。
  */
  b.move=nextMove();const m=b.moves[b.move];b.phase="wind";b.timer=WIND[m[W]-1];b.attack++;b.attacks++;b.pulse=0;
  b.face=p.x<b.x?-1:1;b.target=p.x+8;b.aimY=p.y+14;b.targets=[];
  for(let i=0;i<m[N];i++)b.targets.push(clamp(b.target+(i?((i%2?1:-1)*(55+18*i)):0),30,CW-30));
  say(SHAPE_NAME[m[S]]+"  "+m[D]+"·"+m[R],Math.min(55,b.timer));
}
function bossStep(){
  /*
  ボス状態機械:

    wait     次の技までの待機。距離を105～245pxへ寄せる
      ↓
    wind     予備動作。攻撃範囲を薄く表示し、追尾は前半だけ行う
      ↓
    active   実際の攻撃判定。activeBossMove()が担当
      ↓
    recover  攻撃後硬直。プレイヤーダメージが1.25倍になる反撃時間
      ↓
    wait

  割り込み状態:
    guard    SHIELD持ちが山札一巡ごとに60f構える
    stagger  体勢0による110fの大きな隙
    shift    3体目HP50%の75f変異演出。敵弾も消す

  敵弾が画面に残っている間はwaitタイマーを止め、独立攻撃との重なりを防ぐ。
  */
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
  /*
  Moveから現在段のAABB矩形{x,y,w,h}を作る。

    SWEEP  床上24pxの横長矩形。ジャンプで抜けられる
    THRUST ボス胸元から正面へ伸びる細い矩形
    SLAM   ボスを中心とする地上の広い矩形
    CHARGE 移動中のボス本体矩形
    SHOT   shots配列で処理するためここでは空矩形
    RAIN   startMove()で固定したtargets[pulse]の縦矩形

  drawTelegraph()とbossContact()が同じ戻り値を使う。表示用の範囲を別に持つと
  「見た目より判定が広い」事故が起きるため、ここを唯一の形状定義にする。
  */
  const reach=REACH[m[R]-1],dir=b.face;
  if(m[S]===0)return{x:dir<0?b.x-reach:b.x+40,y:FLOOR-24,w:reach,h:24};
  if(m[S]===1)return{x:dir<0?b.x-reach:b.x+38,y:b.y+26,w:reach,h:18};
  if(m[S]===2)return{x:b.x-reach*.55,y:FLOOR-57,w:reach+44,h:57};
  if(m[S]===3)return boxBoss();
  if(m[S]===5){const w=28+m[R]*9;return{x:b.targets[pulse]-w/2,y:18,w,h:FLOOR-18}}
  return{x:0,y:0,w:0,h:0};
}
function activeBossMove(){
  /*
  active状態の1フレーム。

  1段の長さ span = ACTIVE[段階] + 10fの段間隔。
  b.timerから現在pulseと段内local時間を算出する。

  - SHOT: pulse開始時に弾を一発だけ生成
  - CHARGE: active中だけボス座標を前進
  - その他: localがACTIVE内のときmoveRect()をbossContact()へ渡す

  最終段が終わるとRECテーブルの長さでrecoverへ入る。
  */
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
  /*
  全弾の1フレーム。

  owner=0: プレイヤー弾。boxBossへ当たるとbossDamage("shot")
  owner=1: 敵弾。弱/強追尾でvyを少し曲げ、boxPlayerへ判定

  敵弾へパリィが合うとowner=0へ反転し、速度・色・ダメージ・体勢値を変更する。
  画面外またはlife 0の弾は最後にまとめて削除する。
  */
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
  /*
  ゲーム全体の画面状態を1フレーム進める。

    title   Nでseed再生成、EnterでnewRun
    fight   戦闘更新。freeze中は物理を止め、火花だけ進める
    pause   Enter/Escapeでfightへ戻る
    dead    Enter/Rで同じボス、Nで新seed
    bosswin Enterで次ボス。3体目ならresult
    result  Rで同seed再走、Enter/Nで新ラン

  step末尾でtapを空にするため、一回のキー入力が複数固定stepへ重複しない。
  */
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
  /*
  攻撃予告と発生中の危険範囲を描く。

  wind中: 経過率に応じて薄い矩形を濃くする。SHOTだけは射線を描く。
  active中: 現在pulseの矩形を高い不透明度で描く。

  attackColor()は高威力=赤、追尾=藍、高速=黄、長射程=青、多段=紫を優先し、
  色を見れば生成特性を推測できる。ただし矩形と動きだけでも回避可能にする。
  */
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
  /*
  描画順:
    背景 → 予告 → 弾 → 待機/操作キャラ → ボス → 火花 → HUD → 画面別overlay

  当たり判定は一切ここで変更しない。shakeはCanvas座標だけを揺らすため、
  見た目が揺れてもゲーム内部の座標と判定は安定したまま。
  */
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
  /*
  可変間隔のrequestAnimationFrameを60Hz固定stepへ変換するaccumulator loop。
  1描画あたり最大5stepに丸める。タブ復帰時に数秒分を一気に計算して、
  プレイヤーが操作できないまま攻撃を受けることを防ぐ。
  */
  if(!last)last=now;acc=Math.min(acc+now-last,STEP*5);last=now;
  while(acc>=STEP){step();acc-=STEP}draw();requestAnimationFrame(loop);
}

if(typeof document!=="undefined")boot();
