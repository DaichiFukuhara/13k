import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createContext,runInContext} from "node:vm";

// Record actual Canvas commands from the production renderer and compare the
// outer rectangles with the collision helper, including every future RAIN pulse.
const calls=[],stack=[];
const ctx={globalAlpha:1,lineWidth:1,dash:[],
  save(){stack.push({...this,dash:[...this.dash]})},
  restore(){Object.assign(this,stack.pop())},
  setLineDash(v){this.dash=v},
};
for(const op of ["fillRect","strokeRect","beginPath","moveTo","lineTo","stroke","fillText"])
  ctx[op]=function(...args){calls.push({op,args,alpha:this.globalAlpha,dash:[...this.dash],stroke:this.strokeStyle})};
const box=createContext({console,Math,Number,ctx});
runInContext(readFileSync(new URL("../game.js",import.meta.url),"utf8"),box);
const read=s=>runInContext(s,box);
read('cx=ctx;mode="fight";p={x:80,y:270};b={x:300,y:253,hue:0,face:-1,move:0,targets:[100,240,390],aimY:280};');
const state=()=>read("JSON.stringify({b,p,mode,shots,take,run})");
function draw(){calls.length=0;const before=state();read("drawTelegraph();drawTelegraph()");assert.equal(state(),before);calls.length=0;read("drawTelegraph()");return calls;}
function setup(shape,w=1,n=1){read(`b.moves=[[${shape},2,3,${w},1,2,0,${n},0]];b.phase="wind";b.timer=WIND[${w}-1];`)}
let fixtures=0;
for(let s=0;s<6;s++)for(let w=1;w<=4;w++)for(const stage of [0,.5,"last"]){
  setup(s,w);read(`b.timer=${stage==="last"?1:`WIND[${w}-1]*(1-${stage})`}`);draw();
  const progress=read("1-b.timer/WIND[b.moves[0][W]-1]");
  if(s===4){const start=calls.find(c=>c.op==="moveTo").args,ends=calls.filter(c=>c.op==="lineTo");
    assert.equal(ends.length,2);assert.ok(Math.abs(ends[1].args[0]-start[0]-(ends[0].args[0]-start[0])*progress)<1e-9);
  }else{
    const q=JSON.parse(read("JSON.stringify(moveRect(b.moves[0],0,b))"));
    assert.deepEqual(calls.find(c=>c.op==="strokeRect").args,[q.x,q.y,q.w,q.h]);
    assert.equal(calls.filter(c=>c.op==="fillRect").at(-1).args[3],q.h*progress);
  }
  fixtures++;
}
setup(5,1,3);draw();
assert.equal(calls.filter(c=>c.op==="strokeRect").length,3);
for(let i=0;i<3;i++){
  const q=JSON.parse(read(`JSON.stringify(moveRect(b.moves[0],${i},b))`));
  assert.deepEqual(calls.filter(c=>c.op==="strokeRect")[i].args,[q.x,q.y,q.w,q.h]);
}
// ACTIVE[0]=5. timer is incremented after the collision; 5 is still live,
// 6 is the first gap, 16 has processed pulse 1, 21 has entered its gap.
for(const [timer,rects,live] of [[0,3,0],[1,3,1],[5,3,1],[6,2,0],[15,2,0],[16,2,1],[20,2,1],[21,1,0]]){
  read(`b.phase="active";b.timer=${timer}`);draw();
  assert.equal(calls.filter(c=>c.op==="strokeRect").length,rects,`timer ${timer}`);
  assert.equal(calls.filter(c=>c.op==="fillRect"&&c.alpha===.45).length,live,`timer ${timer}`);
  fixtures++;
}
for(const face of [-1,1]){setup(3);read(`b.face=${face}`);draw();
  const x=read("b.x+20");assert.equal(calls.find(c=>c.op==="lineTo").args[0],x+face*32);fixtures++;
}
for(let shape=0;shape<6;shape++)for(const timer of [12,11,1]){
  setup(shape);read(`b.moves[0][F]=makeMove(seeded(72),${shape},0,false)[F];b.timer=${timer}`);draw();
  const outline=calls.find(c=>c.op===(shape===4?'stroke':'strokeRect'));
  assert.equal(outline.stroke==='#fff',shape!==5&&timer<=11,'white cue follows parry flag and windup');
}
read('mode="trial"');assert.equal(draw().length,0);
read('mode="fight";b.phase="recover"');assert.equal(draw().length,0);
assert.equal(ctx.globalAlpha,1);assert.equal(ctx.lineWidth,1);assert.deepEqual(ctx.dash,[]);
console.log(`OK telegraph: ${fixtures} timing/direction fixtures, RAIN shared rectangles and gaps, trial, pure rendering`);
