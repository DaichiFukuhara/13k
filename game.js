/* ==========================================================================
   Virginight - stage 1 (see VIRGINIGHT_DESIGN.md ch.19).

   Exploration, time, karma and one guaranteed causality loop.
   No combat, no items, no companions, no HP yet.

   The concept (ch.0) is responsibility: the game never shows a karma number
   and never tells the player what is right. It only lets choices - and the
   refusal to choose - come back.
   ========================================================================== */

const root = document.documentElement;
const screen = document.querySelector("#screen");
const bar = document.querySelector("#bar");
const kit = document.querySelector("#kit");
const logbar = document.querySelector("#log");

/* --- 1. constants ------------------------------------------------------- */

const TIMES = ["Morning", "Noon", "Evening", "Dusk"];

/* Danger is never given as a number (design ch.7.3). */
const RISKS = ["Looks safe", "Should go well", "A little risky", "Very dangerous"];

/* Outcome odds per risk tier: great / good / fail / bad. */
const ODDS = [
  [15, 60, 20, 5],
  [20, 45, 25, 10],
  [25, 30, 30, 15],
  [30, 20, 25, 25]
];

const STAGES = [
  ["great", "It went better than you hoped"],
  ["good", "It went well enough"],
  ["fail", "It did not go well"],
  ["bad", "It went badly"]
];

/* Rainbow shards granted per outcome stage: [min, max]. */
const SHARDS = [[4, 6], [2, 4], [0, 2], [0, 0]];

/* --- 2. event data ------------------------------------------------------ */
/* karma: applied when the action is confirmed, not when it resolves
   (design ch.6.3 - intent is judged, not the result).
   Events worth +-10 are the day 1-2 pool; +-20 unlocks on day 3. */

function ev(id, title, blurb, karma, risk, great, good, fail, bad) {
  return { id, title, blurb, karma, risk, out: [great, good, fail, bad] };
}

const EVENTS = {
  town: [
    ev("mend", "Mend the broken fence", "A family cannot keep their goats in.", 10, 0,
      "You rebuild the whole pen before dark. They press dried fruit and shards on you.",
      "The rail holds. They give you what little they can spare.",
      "The post splits a second time. They thank you and turn back inside.",
      "The rail goes through the trough. The goats scatter into the fields."),
    ev("ration", "Share your ration", "Children are waiting outside the mill.", 10, 0,
      "You feed all of them. Someone leaves shards on your saddle without a word.",
      "There is enough to go around. A mother gives you a handful of shards.",
      "There is not enough. The smallest ones go without.",
      "The older boys take everything and run. Nobody is fed."),
    ev("offering", "Take from the offering box", "The shrine is unwatched at this hour.", -10, 1,
      "The box is fuller than it looked. You are gone before the candle gutters.",
      "You take a fair share and leave the lid as you found it.",
      "The hinge cracks. You leave with less than you came for.",
      "The priest sees your shadow on the wall. Nothing is taken."),
    ev("frighten", "Frighten the merchant", "He is slow to name a price for strangers.", -10, 1,
      "One look at the horn and he empties the strongbox onto the counter.",
      "He drops his price to nothing and asks you to leave.",
      "He holds his ground and calls for the watch. You walk away empty.",
      "He swings the scale hook at you. The stall is ruined and you take nothing.")
  ],
  castle: [
    ev("cage", "Free a caged bird", "Something small is singing above the gate.", 10, 1,
      "The cage opens clean. Shards fall out of the ruined nest below.",
      "The bird goes. You find a few shards in the straw.",
      "The lock will not give. You leave it singing.",
      "The cage falls from the wall. The singing stops."),
    ev("water", "Leave water at the cells", "The lower corridor has not been opened in days.", 10, 1,
      "You reach every door. One of them pushes shards back through the grate.",
      "You reach most of the doors before the guard turns.",
      "The guard turns early. You get through two doors.",
      "The bucket goes over on the stair. You are heard and have to run."),
    ev("plate", "Pocket a silver plate", "The hall is set for people who are not coming.", -10, 2,
      "You take the whole setting. It weighs more in shards than you expected.",
      "You take two plates and nothing is missed.",
      "The steward counts the table twice. You put it back.",
      "The stack goes down the stairs. Half the castle hears it."),
    ev("rope", "Cut the alarm rope", "One rope runs the length of the wall.", -10, 2,
      "It parts silently. The wall is deaf for the rest of the night.",
      "You cut it through. Nobody looks up.",
      "The strands hold. You leave it fraying.",
      "The bell rings once as it goes. They know someone is inside.")
  ]
};

/* Day 3-4 events. Heavier karma, so they stay out of the early pool. */
EVENTS.town.push(
  ev("watch", "Stand guard until dawn", "The town has nobody left to put on the wall.", 20, 2,
    "Nothing comes, and they see you standing there at first light. They give you everything they have.",
    "You hold the wall all night. They are grateful in the morning.",
    "You sleep an hour before dawn. Something got through the east gate.",
    "You sleep through it. There is a house standing open when you wake."),
  ev("drive", "Drive the beggars out", "They have been at the well since the first night.", -20, 1,
    "They leave everything behind in the rush. It is worth a great deal.",
    "They go quietly and leave what they were carrying.",
    "They will not move. You stand in the square shouting at nobody.",
    "One of them will not get up. The square empties and watches you.")
);

EVENTS.castle.push(
  ev("wounded", "Carry the wounded out", "The east range is burning and still full.", 20, 3,
    "You bring out every one of them. What they press on you afterward is worth more than shards.",
    "You bring out three before the roof comes down.",
    "You bring out one. The stair goes before you can turn back.",
    "The floor gives under you. You get out alone and burned."),
  ev("bind", "Bind the servant girl", "She has seen your face and the corridor behind you.", -20, 2,
    "She is quiet and nobody comes. The room is yours to empty at leisure.",
    "She is quiet long enough. You take what you came for.",
    "She works a hand loose and screams. You leave with nothing.",
    "She is found before morning, and they know exactly who to look for.")
);

/* The guaranteed causality loop (design ch.0.1, plan stage 1).
   Offered every action of day 1 until it is taken or the day runs out. */
/* All four outcomes must leave the three of them indoors: the payoff below
   turns on the choice, not on how well the night went. */
const SHELTER = ev("shelter", "Shelter the strangers",
  "Three of them are asking at doors along the road. Nobody has opened one.", 10, 0,
  "All three sleep under a roof. They talk half the night about the roads they came by, and you are better off for the listening.",
  "You find all three a dry corner. They sleep, and they are grateful in the morning.",
  "You get all three inside, but the roof is bad and nobody sleeps much.",
  "You get all three inside. Something of yours leaves with them before first light.");

/* Day 2 payoff. Which one appears depends on day 1 (design ch.0.1). */
const REPAID = ev("marked", "Follow the marked path",
  "The travelers left the safe way scratched into the milestone.", 0, 0,
  "The path runs clean past every watch post. You come back loaded.",
  "The path holds. You get in and out unseen.",
  "The marks stop halfway. You turn back with a little.",
  "You lose the marks in the dark and spend the hour finding the road again.");

const PUNISHED = ev("watchmen", "Slip past the new watch",
  "The men on the road tonight know the country better than the garrison does.", 0, 3,
  "You get through anyway, and take what the new watch was set to guard.",
  "You get past them, barely, and come away with something.",
  "They turn you back at the first bend.",
  "They were waiting at both ends of the road. You lose the hour and the way back.");

const WORKSHOP = { id: "shop", title: "Workshop", blurb: "Work at the bench. There is nothing to build yet.", karma: 0, risk: -1 };
const REST = { id: "rest", title: "Rest", blurb: "Sit the hour out. There is nothing to recover yet.", karma: 0, risk: -1 };

/* --- 2b. causal items (design ch.8.2) ------------------------------------ */
/* attr  +1 good / 0 neutral / -1 evil - decides what burns off at the
         critical point (ch.6.4). Neutral marks always survive.
   kind  "E" evidence: silently shifts how dangerous a place is for you.
         "C" consumable: hangs a new action off the place, then is spent.
   Consumable actions do not roll (ch.7.2): the main result is fixed. */

function evidence(id, name, attr, place, shift, note) {
  return { id, name, attr, kind: "E", place, shift, note };
}

function spend(id, name, attr, place, title, blurb, karma, shards, text) {
  return { id, name, attr, kind: "C", place, act: { id: "u_" + id, title, blurb, karma, risk: -2, shards, text } };
}

const ITEMS = [
  evidence("thanks", "The town's thanks", 1, "town", -1, "Doors in the town open before you knock."),
  evidence("blessing", "A healer's blessing", 1, "town", -1, "The town looks for you when someone is hurt."),
  evidence("hunted", "Hunted in the town", -1, "town", 1, "They know your shape in the town now."),
  evidence("debtors", "Debtors in the town", -1, "town", 1, "Nobody in the town meets your eye twice."),
  evidence("quiet", "A quiet way in", 0, "castle", -1, "You know one door the castle forgets to bar."),
  evidence("alert", "The castle on alert", 0, "castle", 1, "The watch has been doubled since you were last inside."),
  evidence("witness", "A witness left alive", -1, "castle", 1, "Someone inside can describe you to the guard."),

  spend("map", "The castle map", 0, "castle",
    "Take the hidden passage", "The map runs a line under the east range.", 0, 7,
    "The passage comes out inside the wall, behind everyone. You take what you like and leave the way you came."),
  spend("favour", "A sworn favour", 1, "town",
    "Call in the favour", "Someone in the town said to come back if you ever needed it.", 10, 5,
    "They do not ask what it is for. They give you what they have and shut the door quietly behind you."),
  spend("key", "A stolen key", -1, "castle",
    "Open the lower cells", "The key fits the corridor nobody walks after dark.", -10, 6,
    "The doors go back one after another. What is inside is worth carrying, and nobody down there will be reporting it.")
];

const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));

/* Which action leaves which mark, and in which outcome band (from..to).
   Marks are earned by how it actually went, not by what you meant. */
const GIVES = {
  mend: [["thanks", 0, 0]],
  ration: [["blessing", 0, 1]],
  offering: [["hunted", 2, 3]],
  frighten: [["hunted", 0, 3]],
  watch: [["favour", 0, 1]],
  drive: [["debtors", 0, 2]],
  cage: [["quiet", 0, 1]],
  water: [["favour", 0, 1]],
  plate: [["map", 0, 0], ["alert", 2, 3]],
  rope: [["key", 0, 1], ["alert", 2, 3]],
  wounded: [["blessing", 0, 1]],
  bind: [["witness", 0, 3]],
  watchmen: [["alert", 2, 3]],
  marked: [["quiet", 0, 1]]
};

const BAG = 8;

/* --- 3. state ----------------------------------------------------------- */

let state;

function newGame() {
  state = {
    day: 1,
    step: 0,          // 0..3 -> TIMES
    karma: 10,        // never shown as a number (design ch.6.1)
    lock: 0,          // -1 evil, 0 open, +1 good
    shards: 0,
    sheltered: null,  // null until day 1 ends, then true / false
    special: null,    // "repaid" | "punished" while the day 2 payoff is live
    place: null,
    offers: null,     // held across a "No" so the offers do not re-roll
    justLocked: false,
    items: [],        // causal marks, max BAG (design ch.8.3)
    pending: null,    // a mark waiting on an exchange because the bag is full
    log: []           // last few lines only (design ch.9)
  };
}

/* --- 3b. items and log --------------------------------------------------- */

function note(line) {
  state.log.push(line);
  if (state.log.length > 4) state.log.shift();
}

function has(id) {
  return state.items.some(i => i.id === id);
}

/* Returns false when the bag is full, and parks the mark for an exchange. */
function take(item) {
  if (has(item.id)) return true;
  // Past the critical point the other colour will not stick to you any more.
  // Ribbons are the exception: they stay whatever colour they are (ch.8.4).
  if (state.lock && item.attr === -state.lock && !item.keep) {
    note(`It does not stay with you: ${item.name}`);
    return true;
  }
  if (state.items.length >= BAG) { state.pending = item; return false; }
  state.items.push(item);
  note(`Kept: ${item.name}`);
  return true;
}

function drop(id, why) {
  const i = state.items.findIndex(x => x.id === id);
  if (i < 0) return;
  note(`${why}: ${state.items[i].name}`);
  state.items.splice(i, 1);
}

/* At the critical point everything of the opposite colour burns off.
   Neutral marks stay, and so will ribbons once they exist (ch.6.4, ch.8.4). */
function purge() {
  const gone = state.items.filter(i => i.attr === -state.lock && !i.keep);
  if (!gone.length) return;
  state.items = state.items.filter(i => !gone.includes(i));
  // One line, so a big purge cannot push the critical line out of the log.
  note(`Gone with it: ${gone.map(i => i.name).join(", ")}`);
}

/* Marks are earned by how it actually went, not by what you meant by it. */
function grant(id, stage) {
  // Only one mark can be waiting on an exchange at a time, so stop at the
  // first one the bag cannot hold rather than overwrite what is pending.
  for (const [item, from, to] of GIVES[id] || [])
    if (stage >= from && stage <= to && !take(ITEM[item])) return;
}

/* Evidence quietly makes a place kinder or harsher than it reads (ch.7.4). */
function riskOf(e) {
  if (e.risk < 0) return e.risk;
  let r = e.risk;
  for (const i of state.items) if (i.kind === "E" && i.place === state.place) r += i.shift;
  return Math.max(0, Math.min(3, r));
}

/* --- 4. helpers --------------------------------------------------------- */

const rnd = n => Math.floor(Math.random() * n);

function roll(risk) {
  const odds = ODDS[risk];
  let n = rnd(100);
  for (let i = 0; i < 4; i++) {
    if (n < odds[i]) return i;
    n -= odds[i];
  }
  return 3;
}

function applyKarma(amount) {
  if (!amount) return;
  state.karma = Math.max(-100, Math.min(100, state.karma + amount));
  if (state.lock === 0 && Math.abs(state.karma) >= 60) {
    state.lock = state.karma > 0 ? 1 : -1;
    state.justLocked = true;
    note(state.lock === 1 ? "You will not come back from this." : "You will not come back from this.");
    purge();
  }
  paint();
}

/* Good washes the world out, evil sinks it (design ch.6.5). No numbers.
   Past the critical point the tone stops moving - it has already settled. */
function paint() {
  const k = state.lock ? state.lock * 60 : state.karma;
  root.style.setProperty("--good", (Math.max(0, k) / 100).toFixed(2));
  root.style.setProperty("--evil", (Math.max(0, -k) / 100).toFixed(2));
}

function show(html) {
  screen.innerHTML = html;
}

function on(sel, fn) {
  document.querySelectorAll(sel).forEach(el => (el.onclick = () => fn(el)));
}

function status() {
  if (!state) {
    bar.innerHTML = "<span>Virginight</span>";
    kit.innerHTML = "";
    logbar.innerHTML = "";
    return;
  }
  bar.innerHTML = `<span>Day <b>${state.day}</b> / 4</span><span>${TIMES[state.step] || "Night"}</span>
    <span>Shards <b>${state.shards}</b></span><span>Carried <b>${state.items.length}</b> / ${BAG}</span>`;
  kit.innerHTML = state.items.map(i =>
    `<span class="chip a${i.attr + 1}" title="${i.note || i.act.blurb}">${i.name}</span>`).join("");
  logbar.innerHTML = state.log.map(l => `<span>${l}</span>`).join("");
}

/* --- 5. offers ---------------------------------------------------------- */

function pool() {
  return EVENTS[state.place].filter(e =>
    (state.day > 2 || Math.abs(e.karma) === 10) &&
    !(state.lock === 1 && e.karma < 0) &&
    !(state.lock === -1 && e.karma > 0)
  );
}

function buildOffers() {
  // Past the critical point the other side's stronghold stops feeding and
  // housing you. Its safe actions are replaced by exploration (design ch.5.2).
  const shut = state.place === (state.lock === 1 ? "castle" : state.lock === -1 ? "town" : "");
  const out = shut ? [] : [WORKSHOP, REST];
  const extra = [];
  let slots = shut ? 4 : 2;

  // Day 1: the shelter choice holds an exploration slot until it is taken.
  if (state.day === 1 && state.sheltered === null) {
    out.push(SHELTER);
    slots--;
  }
  // Day 2: refusing costs a slot, taking it in adds a fifth option
  // (design ch.5.2 - causality is appended, never swapped in silently).
  if (state.special === "punished") {
    out.push(PUNISHED);
    slots--;
  } else if (state.special === "repaid") {
    extra.push(REPAID);
  }

  const rest = pool();
  while (slots-- > 0 && rest.length) {
    out.push(rest.splice(rnd(rest.length), 1)[0]);
  }

  // Anything you are carrying that this place can be used against hangs its
  // own action off the end of the list (design ch.5.2, ch.8.2).
  for (const i of state.items) if (i.kind === "C" && i.place === state.place) extra.push(i.act);

  return out.concat(extra);
}

/* --- 6. screens --------------------------------------------------------- */

function title() {
  state = null;
  root.style.setProperty("--good", 0);
  root.style.setProperty("--evil", 0);
  status();
  show(`<div class="center"><div>
    <h1>VIRGINIGHT</h1>
    <p>Four days. No one will tell you what you are for.</p>
    <button class="go" id="x">Begin</button>
  </div></div>`);
  on("#x", () => { newGame(); paint(); dayStart(); });
}

function dayStart() {
  status();
  let echo = "";

  // The day 2 callback: what you did, or what you did not do (design ch.0.1).
  // It is live for that day only - ignoring it is also an answer.
  state.special = null;
  if (state.day === 2) {
    if (state.sheltered) {
      state.special = "repaid";
      echo = `<div class="echo">The three you took in were gone before you woke.
        On the milestone at the edge of the road, someone has scratched a line of
        marks that were not there yesterday.</div>`;
    } else {
      state.special = "punished";
      echo = `<div class="echo">The three you left on the road did not go far.
        They know the country, and by this morning they are walking it for the
        castle. Every way out is watched tonight.</div>`;
    }
  }

  show(`<div class="eyebrow">Day ${state.day}</div>
    <h1>${["The road is quiet.", "Word has travelled.", "Fewer doors open now.", "Whatever is coming arrives tonight."][state.day - 1]}</h1>
    <p>You have four hours of daylight.</p>
    ${echo}
    <button class="go" id="x">Go on</button>`);
  on("#x", placeSelect);
}

function placeSelect() {
  status();
  show(`<div class="eyebrow">${TIMES[state.step]}</div>
    <h1>Where do you go?</h1>
    <p>Every hour spent is a choice about where you are seen.</p>
    <div class="pair">
      <button data-p="town"><h2>The town</h2><small>People who still have doors to open. Nobody here is armed.</small></button>
      <button data-p="castle"><h2>The castle</h2><small>Held, lit, and full. Nobody here expects you.</small></button>
    </div>`);
  on("[data-p]", el => {
    state.place = el.dataset.p;
    state.offers = null;
    actionSelect();
  });
}

/* What the player is told about danger - never a number (design ch.7.3).
   Evidence they are carrying has already been folded into it. */
function label(e) {
  const r = riskOf(e);
  return r === -2 ? `<span class="risk sure">Certain</span>`
    : r >= 0 ? `<span class="risk">${RISKS[r]}</span>` : "";
}

function actionSelect() {
  status();
  if (!state.offers) state.offers = buildOffers();

  const list = state.offers.map((e, i) => `
    <button data-i="${i}">${label(e)}
      <h2>${e.title}</h2><small>${e.blurb}</small>
    </button>`).join("");

  show(`<div class="eyebrow">${TIMES[state.step]} &middot; ${state.place === "town" ? "The town" : "The castle"}</div>
    <h1>What do you do?</h1>
    <div class="list">${list}</div>`);
  on("[data-i]", el => confirm(state.offers[+el.dataset.i]));
}

/* Every action is confirmed. Saying no costs nothing at all - no time, no
   roll, no karma, and the same offers are still standing (design ch.5.3). */
function confirm(e) {
  show(`<div class="eyebrow">${TIMES[state.step]}</div>
    <h1>${e.title}</h1>
    <div class="box">
      <p>${e.blurb}</p>
      ${riskOf(e) >= 0 ? `<p class="gain">${RISKS[riskOf(e)]}.</p>` : ""}
      <div class="row">
        <button class="go" id="y">Yes</button>
        <button class="go" id="n">No</button>
      </div>
    </div>`);
  on("#y", () => resolve(e));
  on("#n", actionSelect);
}

function resolve(e) {
  // Danger is settled the moment you say yes. If this very action tips you
  // over the critical point and burns off the evidence that was keeping the
  // place safe, the odds you were shown still stand (ch.7.3, ch.0.1).
  const r = riskOf(e);
  applyKarma(e.karma);

  if (e.id === "shelter") state.sheltered = true;
  if (e.id === "marked" || e.id === "watchmen") state.special = null;

  let body, stage = -1;

  if (r === -2) {
    // A mark being spent. The main result is fixed (design ch.7.2) and the
    // mark itself is used up - no manual "use item" anywhere (ch.8.2).
    drop(e.id.slice(2), "Spent");
    state.shards += e.shards;
    body = `<div class="stage great">It goes the way you were told it would</div>
      <p>${e.text}</p><p class="gain">Rainbow shards +${e.shards}</p>`;
  } else if (r < 0) {
    // Workshop and Rest burn the hour and nothing else, for now.
    body = `<div class="stage">The hour passes</div><p>${e.blurb}</p>`;
  } else {
    stage = roll(r);
    const [lo, hi] = SHARDS[stage];
    const got = lo + rnd(hi - lo + 1);
    state.shards += got;
    body = `<div class="stage ${STAGES[stage][0]}">${STAGES[stage][1]}</div>
      <p>${e.out[stage]}</p>
      ${got ? `<p class="gain">Rainbow shards +${got}</p>` : ""}`;
    grant(e.id, stage);
  }

  if (state.justLocked) {
    state.justLocked = false;
    body += `<p class="gain">${state.lock === 1
      ? "Something in you has settled. There is no walking this back."
      : "Something in you has closed. There is no walking this back."}</p>`;
  }

  status();
  show(`<div class="eyebrow">${e.title}</div>
    <div class="box">${body}<button class="go" id="x">Go on</button></div>`);
  on("#x", () => (state.pending ? exchange() : nextStep()));
}

/* The bag is full and something new has turned up. Nothing is destroyed
   quietly - the player picks what stops mattering (design ch.8.3). */
function exchange() {
  const p = state.pending;
  status();
  show(`<div class="eyebrow">Your hands are full</div>
    <h1>${p.name}</h1>
    <p>You cannot carry it and everything else. Something has to be put down.</p>
    <div class="list">
      ${state.items.map((i, n) => i.keep ? "" :
        `<button data-d="${n}"><h2>${i.name}</h2><small>${i.note || i.act.blurb}</small></button>`).join("")}
      ${p.keep ? "" : `<button data-d="-1"><h2>Leave it where it is</h2><small>Walk away from ${p.name}.</small></button>`}
    </div>`);
  on("[data-d]", el => {
    const n = +el.dataset.d;
    if (n < 0) note(`Left behind: ${p.name}`);
    else {
      drop(state.items[n].id, "Put down");
      state.items.push(p);
      note(`Kept: ${p.name}`);
    }
    state.pending = null;
    nextStep();
  });
}

function nextStep() {
  state.offers = null;
  state.place = null;
  state.step++;
  if (state.step < 4) return placeSelect();

  // The day is spent. Refusing the shelter for a whole day is itself an answer.
  if (state.day === 1 && state.sheltered === null) state.sheltered = false;

  status();
  show(`<div class="eyebrow">Day ${state.day} &middot; Night</div>
    <h1>The light goes.</h1>
    <p>Something comes to the walls tonight. You are not able to meet it yet -
      the defence is not built.</p>
    <p>You wait it out, and the day turns over.</p>
    <button class="go" id="x">${state.day < 4 ? "Next morning" : "See how it ends"}</button>`);
  on("#x", () => {
    if (state.day < 4) { state.day++; state.step = 0; dayStart(); }
    else ending();
  });
}

function ending() {
  const k = state.karma;
  const [name, text] = k >= 21
    ? ["VIRGIN KNIGHT", `You go up against what is waiting and you do not come back down.
        They will tell it properly, later, and the telling will be kinder than the four days were.`]
    : k <= -21
      ? ["VIRGIN NIGHT", `Nothing is left standing that could argue with you. What survives,
        survives behind a door you keep the key to. It is quiet, and it is yours.`]
      : ["VIRGINIGHT", `You never came down on either side of it. The men and the monsters
        settle nothing between them, and go on not settling it for a long time after you.`];

  status();
  show(`<div class="center"><div>
    <div class="eyebrow">Four days</div>
    <h1>${name}</h1>
    <p>${text}</p>
    <button class="go" id="x">Again</button>
  </div></div>`);
  on("#x", title);
}

title();
