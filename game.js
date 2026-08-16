const screen = document.querySelector("#screen");
const status = document.querySelector("#status");

const state = {
  day: 1,
  baseHp: 5,
  materials: 0,
  location: "",
  ally: false,
  weapon: false,
  slot: -1,
  battle: null
};

const places = {
  town: {
    name: "虹の町",
    actions: [
      ["彩り市を歩く", "光る露店を一軒ずつ調べる", 3],
      ["噴水広場へ行く", "虹が落ちる水辺を探す", 4],
      ["工房通りを訪ねる", "職人の手伝いを申し出る", 5],
      ["花壇を調べる", "七色の花びらを集める", 3],
      ["古い図書室へ", "忘れられた地図を読み解く", 4],
      ["時計塔に登る", "町を上から見渡す", 5]
    ]
  },
  castle: {
    name: "敵の城",
    actions: [
      ["外壁を調べる", "崩れた石の隙間を探る", 3],
      ["兵舎に忍び込む", "見張りの交代を待って進む", 4],
      ["宝物庫を探す", "虹色に光る扉を開ける", 5],
      ["中庭を横切る", "影から影へ素早く移動する", 3],
      ["厨房をのぞく", "誰もいない勝手口から入る", 4],
      ["尖塔へ向かう", "細い階段を一気に駆け上る", 5]
    ]
  }
};

function updateStatus() {
  status.textContent = `DAY ${state.day}　防衛HP ${state.baseHp}　虹のかけら ${state.materials}`;
}

function resetDay() {
  state.baseHp = 5;
  state.materials = 0;
  state.location = "";
  state.ally = false;
  state.weapon = false;
  state.slot = -1;
  state.battle = null;
  updateStatus();
}

function setScene(html) {
  screen.innerHTML = html;
  updateStatus();
}

function showTitle() {
  setScene(`
    <div class="hero">
      <div>
        <div class="hero-mark">♘</div>
        <div class="eyebrow">A tiny defense adventure</div>
        <h1>Unicorns & Rainbows</h1>
        <p>探索で仲間と素材を集め、虹の力で町を守ろう。</p>
        <button class="primary" id="start">冒険をはじめる</button>
      </div>
    </div>`);
  document.querySelector("#start").onclick = showLocations;
}

function showLocations() {
  setScene(`
    <div class="scene-head">
      <div class="eyebrow">Day ${state.day} / Explore</div>
      <h1>今日はどこを探索する？</h1>
      <p>探索先によって行動と手に入る素材の量が変わります。</p>
    </div>
    <div class="two-col">
      <button class="location town" data-place="town">
        <div class="location-icon">⌂</div><h2>虹の町</h2>
        <p>人々が暮らすにぎやかな町。安全に素材を探せそうだ。</p>
      </button>
      <button class="location castle" data-place="castle">
        <div class="location-icon">♜</div><h2>敵の城</h2>
        <p>危険な気配が漂う古城。貴重な素材が眠っている。</p>
      </button>
    </div>`);
  document.querySelectorAll("[data-place]").forEach(button => {
    button.onclick = () => showActions(button.dataset.place);
  });
}

function showActions(placeKey) {
  state.location = placeKey;
  const place = places[placeKey];
  setScene(`
    <div class="scene-head">
      <div class="eyebrow">${place.name} / Choose one</div>
      <h1>どう行動する？</h1>
      <p>6つの行動からひとつ選んで探索します。</p>
    </div>
    <div class="choice-grid">
      ${place.actions.map((action, index) => `
        <button class="choice" data-action="${index}">
          <small>行動 ${index + 1}</small><h2>${action[0]}</h2><p>${action[1]}</p>
        </button>`).join("")}
    </div>`);
  document.querySelectorAll("[data-action]").forEach(button => {
    button.onclick = () => resolveExplore(Number(button.dataset.action));
  });
}

function resolveExplore(index) {
  const action = places[state.location].actions[index];
  state.materials = action[2];
  state.ally = true;
  setScene(`
    <div class="result-box">
      <div class="eyebrow">Explore complete</div>
      <h1>${action[0]}ことにした</h1>
      <p>${action[1]}うち、赤い服の少女ルビーと出会った。<br>彼女が集めていた虹のかけらを分けてもらった。</p>
      <div class="loot">
        <div class="loot-item"><b>◆ × ${action[2]}</b><span>虹のかけら</span></div>
        <div class="loot-item"><b>● ルビー</b><span>仲間になった</span></div>
      </div>
      <button class="primary" id="workshop">工房と配置へ</button>
    </div>`);
  document.querySelector("#workshop").onclick = showWorkshop;
}

function showWorkshop() {
  setScene(`
    <div class="scene-head">
      <div class="eyebrow">Prepare</div>
      <h1>武器制作と仲間の配置</h1>
      <p>虹の槍を作り、ルビーを防衛地点の近くへ配置してください。</p>
    </div>
    <div class="workshop">
      <div class="panel">
        <h2>武器工房</h2><p>集めた素材からユニコーンのスキルを作ります。</p>
        <div class="weapon">
          <div class="weapon-icon">↟</div>
          <h3>虹の槍</h3>
          <p>戦場の敵すべてにダメージを与える、一度きりの虹色スキル。</p>
          ${state.weapon
            ? `<div class="made">✓ 制作済み</div>`
            : `<button class="primary" id="craft">◆ 3個で制作</button>`}
        </div>
      </div>
      <div class="panel">
        <h2>ルビーを配置</h2><p>3つの固定枠から、守る場所をひとつ選びます。</p>
        <div class="slots">
          ${["入口寄り", "中央", "城門寄り"].map((label, index) => `
            <button class="slot ${state.slot === index ? "selected" : ""}" data-slot="${index}">${label}</button>`).join("")}
        </div>
        <div class="helper" id="helper">${readyText()}</div>
        <button class="primary" id="battle" ${state.weapon && state.slot >= 0 ? "" : "disabled"}>防衛戦をはじめる</button>
      </div>
    </div>`);

  const craft = document.querySelector("#craft");
  if (craft) craft.onclick = () => {
    if (state.materials < 3) return;
    state.materials -= 3;
    state.weapon = true;
    showWorkshop();
  };
  document.querySelectorAll("[data-slot]").forEach(button => {
    button.onclick = () => {
      state.slot = Number(button.dataset.slot);
      showWorkshop();
    };
  });
  document.querySelector("#battle").onclick = startBattle;
}

function readyText() {
  if (!state.weapon && state.slot < 0) return "虹の槍を制作し、配置場所を選んでください。";
  if (!state.weapon) return "虹の槍を制作してください。";
  if (state.slot < 0) return "配置場所を選んでください。";
  return "準備完了。敵のウェーブを迎え撃てます。";
}

const route = [[0, 45], [70, 45], [70, 125], [165, 125], [165, 50], [255, 50], [255, 110], [320, 110]];
const slotPoints = [[84, 86], [165, 86], [245, 80]];
const segmentLengths = route.slice(1).map((point, index) => Math.hypot(point[0] - route[index][0], point[1] - route[index][1]));
const routeLength = segmentLengths.reduce((sum, length) => sum + length, 0);

function pointOnRoute(distance) {
  let rest = distance;
  for (let i = 0; i < segmentLengths.length; i++) {
    if (rest <= segmentLengths[i]) {
      const ratio = rest / segmentLengths[i];
      return [
        route[i][0] + (route[i + 1][0] - route[i][0]) * ratio,
        route[i][1] + (route[i + 1][1] - route[i][1]) * ratio
      ];
    }
    rest -= segmentLengths[i];
  }
  return route.at(-1);
}

function startBattle() {
  setScene(`
    <div class="battle-wrap">
      <div class="battle-hud">
        <strong id="timer">残り 30.0秒</strong>
        <span id="enemy-count">敵 0 / 10</span>
        <span id="base-count">防衛HP 5</span>
        <span class="spacer"></span>
        <button class="skill" id="spear">虹の槍を使う</button>
      </div>
      <canvas id="battlefield" width="320" height="180"></canvas>
      <div class="legend"><span><i class="dot girl"></i>ルビー：自動攻撃</span><span><i class="dot enemy"></i>敵：城門へ進行</span></div>
    </div>`);

  const canvas = document.querySelector("#battlefield");
  const context = canvas.getContext("2d");
  state.battle = {
    canvas, context,
    enemies: [],
    spawned: 0,
    escaped: 0,
    defeated: 0,
    spawnClock: 0,
    attackClock: 0,
    elapsed: 0,
    spearUsed: false,
    spearFlash: 0,
    shot: null,
    lastTime: performance.now(),
    ended: false
  };
  document.querySelector("#spear").onclick = useSpear;
  requestAnimationFrame(battleLoop);
}

function useSpear() {
  const battle = state.battle;
  if (!battle || battle.ended || battle.spearUsed) return;
  battle.spearUsed = true;
  battle.spearFlash = .65;
  battle.enemies.forEach(enemy => enemy.hp -= 12);
  document.querySelector("#spear").disabled = true;
  document.querySelector("#spear").textContent = "虹の槍 使用済み";
}

function battleLoop(now) {
  const battle = state.battle;
  if (!battle || battle.ended) return;
  const delta = Math.min((now - battle.lastTime) / 1000, .05);
  battle.lastTime = now;
  updateBattle(delta);
  drawBattle();
  if (!battle.ended) requestAnimationFrame(battleLoop);
}

function updateBattle(delta) {
  const battle = state.battle;
  battle.elapsed += delta;
  battle.spawnClock -= delta;
  battle.attackClock -= delta;
  battle.spearFlash = Math.max(0, battle.spearFlash - delta);
  if (battle.shot) {
    battle.shot.life -= delta;
    if (battle.shot.life <= 0) battle.shot = null;
  }

  if (battle.spawned < 10 && battle.spawnClock <= 0) {
    battle.enemies.push({ distance: 0, hp: 26, maxHp: 26, speed: 39 });
    battle.spawned++;
    battle.spawnClock = 1.7;
  }

  battle.enemies.forEach(enemy => enemy.distance += enemy.speed * delta);

  const girl = slotPoints[state.slot];
  if (battle.attackClock <= 0) {
    const targets = battle.enemies
      .filter(enemy => enemy.hp > 0 && distanceTo(pointOnRoute(enemy.distance), girl) < 54)
      .sort((a, b) => b.distance - a.distance);
    if (targets[0]) {
      targets[0].hp -= 6;
      battle.attackClock = .48;
      battle.shot = { from: girl, to: pointOnRoute(targets[0].distance), life: .1 };
    }
  }

  const alive = [];
  battle.enemies.forEach(enemy => {
    if (enemy.hp <= 0) battle.defeated++;
    else if (enemy.distance >= routeLength) {
      battle.escaped++;
      state.baseHp--;
    } else alive.push(enemy);
  });
  battle.enemies = alive;
  updateStatus();

  if (state.baseHp <= 0) finishBattle(false);
  else if (battle.spawned === 10 && battle.enemies.length === 0) finishBattle(battle.defeated === 10);
  else if (battle.elapsed >= 30) {
    state.baseHp -= battle.enemies.length;
    battle.escaped += battle.enemies.length;
    battle.enemies = [];
    finishBattle(state.baseHp > 0 && battle.defeated === 10);
  }
}

function distanceTo(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function drawBattle() {
  const battle = state.battle;
  const ctx = battle.context;
  ctx.clearRect(0, 0, 320, 180);

  ctx.fillStyle = "#182035";
  ctx.fillRect(0, 0, 320, 180);
  ctx.fillStyle = "#1f2940";
  for (let x = 0; x < 320; x += 16) for (let y = 0; y < 180; y += 16) if ((x + y) % 32) ctx.fillRect(x, y, 15, 15);

  ctx.strokeStyle = "#565c75";
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(route[0][0], route[0][1]);
  route.slice(1).forEach(point => ctx.lineTo(point[0], point[1]));
  ctx.stroke();
  ctx.strokeStyle = "#858ba2";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#8a6dca";
  ctx.fillRect(300, 82, 20, 42);
  ctx.fillStyle = "#111726";
  ctx.fillRect(308, 102, 8, 22);
  ctx.fillStyle = "#d6c2ff";
  ctx.font = "bold 6px monospace";
  ctx.fillText("GATE", 300, 78);

  const girl = slotPoints[state.slot];
  ctx.fillStyle = "#ff5c74";
  ctx.beginPath();
  ctx.fillRect(girl[0] - 7, girl[1] - 7, 14, 14);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.fillRect(girl[0] - 4, girl[1] - 3, 2, 2);
  ctx.fillRect(girl[0] + 2, girl[1] - 3, 2, 2);
  ctx.strokeStyle = "#ff5c7435";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(girl[0], girl[1], 54, 0, Math.PI * 2);
  ctx.stroke();

  battle.enemies.forEach(enemy => {
    const point = pointOnRoute(enemy.distance);
    ctx.fillStyle = "#65dfc0";
    ctx.fillRect(point[0] - 4, point[1] - 4, 8, 8);
    ctx.fillStyle = "#101522";
    ctx.fillRect(point[0] - 2, point[1] - 2, 1, 1);
    ctx.fillRect(point[0] + 1, point[1] - 2, 1, 1);
    ctx.fillStyle = "#4b526b";
    ctx.fillRect(point[0] - 5, point[1] - 8, 10, 2);
    ctx.fillStyle = "#ff697d";
    ctx.fillRect(point[0] - 5, point[1] - 8, 10 * Math.max(enemy.hp, 0) / enemy.maxHp, 2);
  });

  if (battle.shot) {
    ctx.strokeStyle = "#ffb1bc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(...battle.shot.from);
    ctx.lineTo(...battle.shot.to);
    ctx.stroke();
  }

  if (battle.spearFlash > 0) {
    const gradient = ctx.createLinearGradient(0, 0, 320, 0);
    ["#ff5c74", "#ffd85a", "#60e395", "#5ebdff", "#9c70ff"].forEach((color, index) => gradient.addColorStop(index / 4, color));
    ctx.globalAlpha = battle.spearFlash;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 320, 180);
    ctx.globalAlpha = 1;
  }

  document.querySelector("#timer").textContent = `残り ${Math.max(0, 30 - battle.elapsed).toFixed(1)}秒`;
  document.querySelector("#enemy-count").textContent = `撃破 ${battle.defeated} / 10`;
  document.querySelector("#base-count").textContent = `防衛HP ${Math.max(0, state.baseHp)}`;
}

function finishBattle(won) {
  const battle = state.battle;
  if (!battle || battle.ended) return;
  battle.ended = true;
  const defeated = battle.defeated;
  const escaped = battle.escaped;
  setTimeout(() => {
    if (won) showVictory(defeated, escaped);
    else showDefeat(defeated, escaped);
  }, 450);
}

function showVictory(defeated, escaped) {
  setScene(`
    <div class="end">
      <div class="end-symbol">✦</div>
      <div class="eyebrow">Defense complete</div>
      <h1>防衛成功！</h1>
      <p>ルビーと虹の槍の力で、敵の進行を食い止めた。<br>夜が明け、次の探索の日が始まる。</p>
      <div class="summary">撃破 ${defeated}体　｜　侵入 ${escaped}体　｜　防衛HP ${state.baseHp}</div>
      <button class="primary" id="next-day">${state.day + 1}日目へ進む</button>
    </div>`);
  document.querySelector("#next-day").onclick = () => {
    state.day++;
    resetDay();
    showLocations();
  };
}

function showDefeat(defeated, escaped) {
  setScene(`
    <div class="end">
      <div class="end-symbol">×</div>
      <div class="eyebrow">Defense failed</div>
      <h1>防衛失敗</h1>
      <p>敵が城門を突破してしまった。探索と準備をやり直し、もう一度挑もう。</p>
      <div class="summary">撃破 ${defeated}体　｜　侵入 ${escaped}体</div>
      <button class="primary" id="retry">${state.day}日目をやり直す</button>
    </div>`);
  document.querySelector("#retry").onclick = () => {
    resetDay();
    showLocations();
  };
}

showTitle();
