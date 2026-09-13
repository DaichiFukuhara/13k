// Development-only fixture: audio and combat callbacks come from game.js.
const statusLine=document.getElementById('status'),samplePlayer=document.getElementById('player');
// Keep native button/select keyboard behavior; the hidden game does not run.
addEventListener('keydown',e=>e.stopImmediatePropagation(),true);
addEventListener('keyup',e=>e.stopImmediatePropagation(),true);
let sampleURL;
function loadSample(samples,name){
  const bytes=new ArrayBuffer(44+samples.length*2),view=new DataView(bytes);
  const str=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i))};
  str(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,48000,true);
  view.setUint32(28,96000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,samples.length*2,true);
  samples.forEach((v,i)=>view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,v))*32767),true));
  if(sampleURL)URL.revokeObjectURL(sampleURL);
  sampleURL=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));samplePlayer.src=sampleURL;
  const link=document.getElementById('download');link.href=sampleURL;link.download=name;link.hidden=false;
}
function demo(kind){
  newRun(233);const shape=+document.getElementById('shape').value;
  p.hold=steal([shape,2,3,2,1,2,0,1,0]);b.hp=10000;b.posture=100;b.tier=0;b.defense=0;b.phase='wait';b.timer=9999;
  if(kind==='attune'||kind==='complete'){
    run.boss=kind==='complete'?2:0;mode='bosswin';
    take={list:[p.hold],i:0,held:p.hold,foe:{name:b.name,hue:b.hue}};confirmTake();
  }else if(kind==='parry')parryBoss('soundcheck');
  else if(kind==='break')breakBoss();
  else if(kind==='miss'){
    p.face=-1;p.x=100;b.x=500;tap={KeyJ:1};playerStep();tap={};
    for(let i=0;i<attackEnd(p.hold)+40;i++){playerStep();shotsStep();}
  }else{
    if(kind==='counter')b.phase='recover';
    if(kind==='defeat')b.hp=1;
    bossDamage(7,1,shape===4?'shot':'melee');
  }
}
for(const button of document.querySelectorAll('[data-sound]'))button.addEventListener('click',()=>{
  wakeAudio();samplePlayer.pause();demo(button.dataset.sound);
  statusLine.textContent=audio?button.childNodes[0].textContent+'を再生しました。':'この環境では音声を利用できません。';
});
document.getElementById('compare').addEventListener('click',async()=>{
  const button=document.getElementById('compare');button.disabled=true;wakeAudio();samplePlayer.pause();
  const live=audio;
  try{
    const offline=new OfflineAudioContext(1,48000*4,48000);
    // Only the clock is offset; all synthesis is the production sound() code.
    const clock={currentTime:0,destination:offline.destination,
      createOscillator:()=>offline.createOscillator(),createGain:()=>offline.createGain()};
    audio=clock;
    ['hit','counter','parry','break'].forEach((kind,i)=>{clock.currentTime=i;demo(kind)});
    audio=live;
    const buffer=await offline.startRendering(),samples=buffer.getChannelData(0);
    const peaks=Array.from({length:4},(_,i)=>samples.subarray(i*48000,(i+1)*48000).reduce((p,v)=>Math.max(p,Math.abs(v)),0));
    loadSample(samples,'prismatic-duel-soundcheck.wav');
    document.getElementById('metrics').textContent='実レンダリング: 4.00秒 / 48kHz / 各音のピーク '+peaks.map(v=>v.toFixed(3)).join(' · ');
    statusLine.textContent='通常命中 → 反撃 → パリィ → 体勢崩しの順で再生します。';
    await samplePlayer.play();
  }catch(e){statusLine.textContent='再生できませんでした。各音のボタンか音声プレーヤーをお試しください。';console.error(e)}
  finally{audio=live;button.disabled=false;}
});
document.getElementById('music').addEventListener('click',async()=>{
  const button=document.getElementById('music');button.disabled=true;samplePlayer.pause();
  const live=audio,offline=new OfflineAudioContext(1,48000*12,48000);
  try{
    const clock={currentTime:0,destination:offline.destination,
      createOscillator:()=>offline.createOscillator(),createGain:()=>offline.createGain()};
    const label=document.getElementById('music-seed').value.trim()||'TEST01';
    audio=clock;newRun(parseInt(label,36)>>>0);run.boss=+document.getElementById('music-stage').value;
    for(let frame=0;frame<640;frame++){clock.currentTime=frame/60;music()}
    audio=live;const buffer=await offline.startRendering(),samples=buffer.getChannelData(0);
    loadSample(samples,`prismatic-duel-${label.toUpperCase()}.wav`);
    const peak=samples.reduce((p,v)=>Math.max(p,Math.abs(v)),0);
    document.getElementById('metrics').textContent=`シード ${seedText()} / 12秒 / 48kHz / 最大ピーク ${peak.toFixed(3)}`;
    statusLine.textContent='生成BGMを再生します。シードや編成を変えて聴き比べられます。';
    await samplePlayer.play();
  }catch(e){statusLine.textContent='BGMを生成できませんでした。';console.error(e)}
  finally{audio=live;button.disabled=false;}
});
