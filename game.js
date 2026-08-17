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
let ctx, hud;   // set when the night screen is built

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
      "The whole pen is sound by dark.",
      "The rail holds.",
      "The post splits a second time.",
      "The rail goes through the trough. The goats scatter."),
    ev("ration", "Share your ration", "Children are waiting outside the mill.", 10, 0,
      "You feed every one of them.",
      "There is enough to go round.",
      "The smallest ones go without.",
      "The older boys take it all and run."),
    ev("offering", "Take from the offering box", "The shrine is unwatched at this hour.", -10, 1,
      "Gone before the candle gutters.",
      "A fair share, the lid as you found it.",
      "The hinge cracks. You leave with less.",
      "The priest sees your shadow on the wall."),
    ev("frighten", "Frighten the merchant", "He is slow to name a price for strangers.", -10, 1,
      "He empties the strongbox onto the counter.",
      "He drops his price to nothing.",
      "He holds his ground and calls the watch.",
      "He swings the scale hook. The stall is ruined.")
  ],
  castle: [
    ev("cage", "Free a caged bird", "Something small is singing above the gate.", 10, 1,
      "The cage opens clean.",
      "The bird goes.",
      "The lock will not give.",
      "The cage falls. The singing stops."),
    ev("water", "Leave water at the cells", "The lower corridor has not been opened in days.", 10, 1,
      "You reach every door.",
      "You reach most of them.",
      "The guard turns early. Two doors.",
      "The bucket goes over on the stair."),
    ev("plate", "Pocket a silver plate", "The hall is set for people who are not coming.", -10, 2,
      "You take the whole setting.",
      "Two plates, and nothing is missed.",
      "The steward counts twice. You put it back.",
      "The stack goes down the stairs."),
    ev("rope", "Cut the alarm rope", "One rope runs the length of the wall.", -10, 2,
      "It parts silently. The wall is deaf.",
      "You cut it through. Nobody looks up.",
      "The strands hold. You leave it fraying.",
      "The bell rings once as it goes.")
  ]
};

/* Day 3-4 events. Heavier karma, so they stay out of the early pool. */
EVENTS.town.push(
  ev("watch", "Stand guard until dawn", "The town has nobody left to put on the wall.", 20, 2,
    "Nothing comes, and they see you at first light.",
    "You hold the wall all night.",
    "You sleep an hour. The east gate is open.",
    "You sleep through it. A house stands open."),
  ev("drive", "Drive the beggars out", "They have been at the well since the first night.", -20, 1,
    "They leave everything behind in the rush.",
    "They go, and leave what they carried.",
    "They will not move.",
    "One of them will not get up.")
);

EVENTS.castle.push(
  ev("wounded", "Carry the wounded out", "The east range is burning and still full.", 20, 3,
    "You bring out every one of them.",
    "Three, before the roof comes down.",
    "One. The stair goes behind you.",
    "The floor gives. You get out alone."),
  ev("bind", "Bind the servant girl", "She has seen your face and the corridor behind you.", -20, 2,
    "Quiet, and nobody comes.",
    "Quiet long enough.",
    "She works a hand loose and screams.",
    "She is found before morning.")
);

/* The guaranteed causality loop (design ch.0.1, plan stage 1).
   Offered every action of day 1 until it is taken or the day runs out. */
/* All four outcomes must leave the three of them indoors: the payoff below
   turns on the choice, not on how well the night went. */
const SHELTER = ev("shelter", "Shelter the strangers",
  "Three of them are asking at doors along the road. Nobody has opened one.", 10, 0,
  "All three under a roof, talking half the night.",
  "All three in a dry corner, and grateful.",
  "All three inside, but nobody sleeps much.",
  "All three inside. Something of yours goes with them.");

/* Day 2 payoff. Which one appears depends on day 1 (design ch.0.1). */
const REPAID = ev("marked", "Follow the marked path",
  "The travelers left the safe way scratched into the milestone.", 0, 0,
  "The path runs clean past every watch post.",
  "The path holds. In and out unseen.",
  "The marks stop halfway.",
  "You lose the marks in the dark.");

const PUNISHED = ev("watchmen", "Slip past the new watch",
  "The men on the road tonight know the country better than the garrison does.", 0, 3,
  "Through anyway, and you take what they guarded.",
  "Past them, barely.",
  "Turned back at the first bend.",
  "They were waiting at both ends.");

const WORKSHOP = { id: "shop", title: "The bench", blurb: "", karma: 0, risk: -1 };
const REST = { id: "rest", title: "Rest", blurb: "", karma: 0, risk: -1 };

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
  evidence("thanks", "The town's thanks", 1, "town", -1, "Doors open before you knock."),
  evidence("blessing", "A healer's blessing", 1, "town", -1, "They look for you when someone is hurt."),
  evidence("hunted", "Hunted in the town", -1, "town", 1, "They know your shape now."),
  evidence("debtors", "Debtors in the town", -1, "town", 1, "Nobody meets your eye twice."),
  evidence("quiet", "A quiet way in", 0, "castle", -1, "One door they forget to bar."),
  evidence("alert", "The castle on alert", 0, "castle", 1, "The watch has been doubled."),
  evidence("witness", "A witness left alive", -1, "castle", 1, "Someone can describe you to the guard."),

  spend("map", "The castle map", 0, "castle",
    "Take the hidden passage", "A line runs under the east range.", 0, 7,
    "It comes out inside the wall, behind everyone. You leave the way you came."),
  spend("favour", "A sworn favour", 1, "town",
    "Call in the favour", "Someone said to come back if you needed it.", 10, 5,
    "They do not ask what it is for, and shut the door quietly behind you."),
  spend("key", "A stolen key", -1, "castle",
    "Open the lower cells", "It fits the corridor nobody walks after dark.", -10, 6,
    "The doors go back one after another, and nobody down there reports it.")
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

/* --- 2c. the seven ------------------------------------------------------- */
/* [name, colour, damage, cooldown, range, trait]
   trait 0 plain, 1 mends the ones beside her, 2 slows what she hits,
   3 goes through more than one (design ch.12.2). */
const HUES = [
  ["Red", "#f2515f", 8, 1.0, 30, 0],
  ["Orange", "#f2913f", 3, 0.4, 38, 0],
  ["Yellow", "#f2d24f", 4, 0.9, 76, 0],
  ["Green", "#5fc47a", 2, 1.1, 46, 1],
  ["Blue", "#4f9ff2", 3, 0.8, 56, 2],
  ["Indigo", "#6b6fd6", 5, 1.2, 62, 3],
  ["Violet", "#a86bd6", 13, 2.1, 40, 0]
];

const GIRL_HP = 22;

/* A ribbon for every colour, made from the same table. It carries no power and
   cannot be put down: it is the slot she used to be (design ch.8.4). */
const RIBBONS = HUES.map(([name], i) => ({
  id: "rib" + i, name: `${name} ribbon`, attr: 0, kind: "E", place: "", shift: 0,
  note: "Hers. You do not get to put this one down.", keep: 1
}));

/* --- 2b2. arms ----------------------------------------------------------- */
/* [name, damage, cooldown, range, made at, cost, needs]
   needs: "" nothing, "girl" at least one of them, or the id of a mark.
   Condition steps are sound / worn / broken (design ch.11.3). */
const ARMS = [
  ["Healing horn", 5, .70, 46, "town", 6, ""],
  ["Rainbow spear", 9, .85, 54, "castle", 8, ""],
  ["Star chain", 6, .75, 62, "", 7, "key"],
  ["Sevenfold", 4, .60, 50, "", 9, "girl"]
];

const WEAR = [1, .7, .5];
const CONDITION = ["sound", "worn", "broken"];
const FIX_COST = 4;

/* Every skill is one use a night, whether or not the arm is the one you hold
   (design ch.11.1). Broken arms keep swinging but their skill is gone. */
const SKILLS = [
  "Mend what is still standing",
  "Everything on the field at once",
  "Hold them where they are",
  "As many as there are of her"
];

/* Which actions bring one of them back with you. The castle reads as a
   rescue and the town as taking her along; same seven either way (ch.12.1). */
/* `shelter` is the guaranteed one: one of the three you took in stays, whatever
   kind of night it was. Refuse them on day 1 and you meet the first night on
   your own - hard, but not lost before it starts (ch.0.1). */
const BRINGS = { shelter: 3, water: 1, wounded: 0, ration: 1, watch: 1, rope: 1, drive: 2, bind: 2 };

/* --- 2d. the night ------------------------------------------------------- */
/* [name, hp, damage, range, cooldown, speed, colour] */
const KIND = {
  m: ["Monster", 15, 4, 13, 1.0, 17, "#7fd6a0"],
  b: ["Bandit", 12, 3, 13, 0.9, 21, "#d6b87f"],
  s: ["Soldier", 19, 5, 13, 1.1, 14, "#9fb4d6"]
};

/* Who comes at you and who comes for you, by where you have ended up
   (design ch.13.2). foe 1 = it is here for you. */
const SIDES = {
  "1": [["m", 1], ["s", 0]],    // good: monsters attack, people turn up to help
  "0": [["b", 1], ["b", 1]],    // neutral: nobody's side, so both sides are bandits
  "-1": [["m", 0], ["s", 1]]    // evil: monsters back you, the garrison comes
};

const LANES = [45, 90, 135];
const MID = 160;
const JUMPS = 3;
const SPAWN_FOR = 30;
const LASTS = 60;

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
    log: [],          // last few lines only (design ch.9)
    hp: 60,           // the unicorn's own HP is the thing being defended (ch.13.3)
    max: 60,
    girls: [],        // { i: hue index, hp }
    dead: [],         // hue indices - never comes back, not even on a rewind
    placed: [null, null, null],
    arms: [],         // { i: ARMS index, cond: 0 sound / 1 worn / 2 broken }
    held: 0,          // index into arms - the one that decides your attack
    owed: [],         // ribbons waiting for a slot to be freed
    fight: null
  };
  keep();
}

/* The morning is kept so a lost night can be tried again (design ch.15.1).
   Item objects are shared by reference on purpose - identity is checked. */
function keep() {
  const { fight, dawn, ...rest } = state;   // never nest one morning inside another
  state.dawn = { ...rest, items: [...state.items], log: [...state.log],
                 girls: state.girls.map(g => ({ ...g })),
                 arms: state.arms.map(a => ({ ...a })), placed: [null, null, null] };
}

/* A lost night can be tried again, but the ones who died stay dead and the
   morning does not give them back (design ch.15.2). */
function rewind() {
  const d = state.dawn, dead = state.dead;
  state = { ...d, items: [...d.items], log: [...d.log],
            girls: d.girls.filter(g => !dead.includes(g.i)).map(g => ({ ...g })),
            arms: d.arms.map(a => ({ ...a })),
            dead, placed: [null, null, null], fight: null };
  // The ribbons come back with you even though the morning does not know
  // about them yet - the dead are the one thing a rewind cannot undo (ch.15.2).
  // Through ribbon(), so the eight slots still mean eight.
  for (const i of dead) ribbon(i);
  keep();
  paint();
}

/* She joins whichever way you came by her (design ch.12.1). The colour has to
   be one nobody is wearing and nobody has died in - a lost colour is lost. */
function bring(rescued) {
  const held = state.girls.map(g => g.i);
  const i = HUES.findIndex((h, n) => !held.includes(n) && !state.dead.includes(n));
  if (i < 0) return;
  state.girls.push({ i, hp: GIRL_HP });
  note(`${rescued ? "Brought out" : "Brought along"}: ${HUES[i][0]}`);
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
  snd(620, .11, "triangle");
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

/* A ribbon cannot be refused, but nothing is thrown out behind the player's
   back either: a full bag queues it and asks (design ch.8.3, ch.0.1). */
function ribbon(i) {
  if (has("rib" + i) || state.owed.includes(i)) return;
  if (state.items.length < BAG) {
    state.items.push(RIBBONS[i]);
    note(`Kept: ${RIBBONS[i].name}`);
  } else state.owed.push(i);
}

/* Clears anything waiting on an exchange, one at a time, then goes on. */
function settle(then) {
  if (!state.pending && state.owed.length) state.pending = RIBBONS[state.owed.shift()];
  state.pending ? exchange(then) : then();
}

/* What you are holding decides your attack; its condition decides how much of
   it is left. With nothing made you still have a horn (design ch.11.1). */
function mine() {
  const a = state.arms[state.held];
  if (!a) return { dmg: 5, cd: .7, range: 44 };
  const [, dmg, cd, range] = ARMS[a.i];
  // The sevenfold is only ever worth as many as there are of her (ch.11.4).
  const base = a.i === 3 ? 2 + state.girls.length : dmg;
  return { dmg: Math.max(1, Math.round(base * WEAR[a.cond])), cd, range };
}

function canMake(n) {
  const [, , , , where, cost, needs] = ARMS[n];
  return !state.arms.some(a => a.i === n) &&
    (!where || where === state.place) &&
    (needs === "" || (needs === "girl" ? state.girls.length > 0 : has(needs))) &&
    state.shards >= cost;
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
    note("You will not come back from this.");
    snd(80, .6, "sawtooth", .07);
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

/* One context, one shape. Everything is frequency, length and volume - there
   are no audio files anywhere in this (design ch.3). */
let actx;
function snd(f, d, type, vol) {
  try {
    actx = actx || new (AudioContext || webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = type || "square";
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * .55, t + d);
    g.gain.setValueAtTime(vol || .04, t);
    g.gain.exponentialRampToValueAtTime(1e-4, t + d);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + d);
  } catch (e) { /* no audio, no problem */ }
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

/* The two standing choices say what they would actually do today. */
function fixed() {
  const can = ARMS.some((a, n) => canMake(n));
  const bent = state.arms.some(a => a.cond && state.shards >= FIX_COST);
  WORKSHOP.blurb = can && bent ? "There is something to make and something to mend."
    : can ? "There is something here you could make."
    : bent ? "Something you carry could be put right."
    : "Nothing here can be made or mended today.";
  const hurt = state.hp < state.max || state.girls.some(g => g.hp < GIRL_HP);
  REST.blurb = hurt ? "Sit the hour out and put some of it back."
    : "Sit the hour out. Nobody needs it.";
  return [WORKSHOP, REST];
}

function buildOffers() {
  // Past the critical point the other side's stronghold stops feeding and
  // housing you. Its safe actions are replaced by exploration (design ch.5.2).
  const shut = state.place === (state.lock === 1 ? "castle" : state.lock === -1 ? "town" : "");
  const out = shut ? [] : fixed();
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

/* --- 5b. the night ------------------------------------------------------- */

/* Which way you have gone decides who turns up (design ch.13.2). */
function band() {
  return state.karma >= 21 ? 1 : state.karma <= -21 ? -1 : 0;
}

const friendly = (a, b) => !a.foe === !b.foe;

function comer(kind, lane, dir, foe, tough) {
  const [name, hp, dmg, range, cd, speed, colour] = KIND[kind];
  const h = Math.round(hp * tough);
  return { name, lane, x: dir > 0 ? -8 : 328, dir, hp: h, max: h, dmg: Math.round(dmg * tough),
           range, cd, wait: cd * Math.random(), speed, colour, foe, trait: 0, slow: 0, stun: 0 };
}

/* She stands on the same spot the unicorn defends, so that what comes from the
   left and what comes from the right meet her on equal terms (design ch.13.1). */
function stander(g, lane) {
  const [name, colour, dmg, cd, range, trait] = HUES[g.i];
  return { name, lane, x: MID, dir: 0, hp: g.hp, max: GIRL_HP, dmg, range, cd,
           wait: 0, mend: 0, speed: 0, colour, foe: 0, trait, girl: g, slow: 0, stun: 0 };
}

function startFight() {
  const [L, R] = SIDES[band()];
  const n = 3 + state.day * 2;
  const tough = 1 + state.day * .15;
  // Standing for nothing means both ends of the road are against you. More of
  // them come than either side alone would send, but not twice as many.
  const both = L[1] && R[1];
  const spawns = [];
  for (const [side, dir] of [[L, 1], [R, -1]]) {
    const [kind, foe] = side;
    const count = Math.ceil(n * (foe ? (both ? .55 : 1) : .45));
    for (let i = 0; i < count; i++)
      spawns.push({ at: (i + Math.random()) * SPAWN_FOR / count, kind, dir, foe, lane: rnd(3), tough });
  }
  spawns.sort((a, b) => a.at - b.at);

  const w = mine();
  const units = [{ name: "You", lane: 1, x: MID, dir: 0, hp: state.hp, max: state.max,
                   dmg: w.dmg, range: w.range, cd: w.cd, wait: 0, speed: 0,
                   colour: "#f4f0ff", foe: 0, trait: 0, slow: 0, stun: 0, me: 1 }];
  state.placed.forEach((gi, lane) => {
    if (gi != null) units.push(stander(state.girls[gi], lane));
  });

  state.fight = { t: 0, units, spawns, jumps: JUMPS, over: 0, last: 0,
                  wasDead: state.dead.length, used: state.arms.map(() => 0) };
  fightScreen();
}

/* One use a night, from every arm you have made, held or not (ch.11.1).
   A broken arm still swings but has nothing left to give (ch.11.3). */
function useSkill(n) {
  const f = state.fight, a = state.arms[n];
  if (!f || f.over || !a || f.used[n] || a.cond === 2) return;
  if (a.i === 3 && !state.girls.length) return;   // none of her left to be
  f.used[n] = 1;
  const foes = f.units.filter(u => u.foe && u.hp > 0);
  const ours = f.units.filter(u => !u.foe && u.hp > 0);

  if (a.i === 0) ours.forEach(u => (u.hp = Math.min(u.max, u.hp + Math.round(u.max * .35))));
  else if (a.i === 1) foes.forEach(u => (u.hp -= 14));
  else if (a.i === 2) foes.forEach(u => (u.stun = 3));
  else {
    // As many as there are of her (design ch.11.4).
    const n7 = state.girls.length;
    const reach = n7 >= 5 ? foes
      : foes.sort((x, y) => Math.abs(x.x - MID) - Math.abs(y.x - MID)).slice(0, n7 >= 3 ? 3 : 1);
    reach.forEach(u => (u.hp -= n7 >= 5 ? 11 : 17));
    if (n7 >= 7) ours.forEach(u => (u.hp = Math.min(u.max, u.hp + 9)));
  }
  snd(a.i === 0 ? 700 : 260, .22, a.i === 0 ? "triangle" : "sawtooth", .06);
  paintSkills();
}

function strike(u, t, f) {
  t.hp -= u.dmg;
  if (t.me) snd(115, .06, "square", .03);
  if (u.trait === 2) t.slow = 1.3;
  if (u.trait === 3) {
    // Through the first one and into whatever is standing behind it - which
    // means further out on the same side, not just anything else in the lane.
    const side = Math.sign(t.x - u.x) || 1, gap = Math.abs(t.x - u.x);
    const behind = f.units.find(v => v.hp > 0 && v !== t && !friendly(v, u) && v.lane === u.lane &&
      Math.sign(v.x - u.x) === side && Math.abs(v.x - u.x) > gap && Math.abs(v.x - u.x) <= u.range + 22);
    if (behind) behind.hp -= u.dmg;
  }
}

function step(dt) {
  const f = state.fight;
  f.t += dt;
  // The hour is up before anyone gets another swing in (design ch.13.4).
  if (f.t >= LASTS) return end(f.units.some(u => u.foe && u.hp > 0) ? 0 : 1);

  while (f.spawns.length && f.spawns[0].at <= f.t) {
    const s = f.spawns.shift();
    f.units.push(comer(s.kind, s.lane, s.dir, s.foe, s.tough));
  }

  const me = f.units[0];

  for (const u of f.units) {
    if (u.hp <= 0) continue;
    if (u.stun > 0) { u.stun -= dt; continue; }   // held where it stands
    if (u.slow > 0) u.slow -= dt;
    u.wait -= dt * (u.slow > 0 ? .5 : 1);

    // Green mends the ones beside her on her own clock, and still fights.
    if (u.trait === 1) {
      u.mend -= dt;
      if (u.mend <= 0) {
        const hurt = f.units.filter(v => v.hp > 0 && v !== u && friendly(v, u) && v.lane === u.lane &&
          v.hp < v.max && Math.abs(v.x - u.x) <= u.range).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
        if (hurt) { hurt.hp = Math.min(hurt.max, hurt.hp + 5); u.mend = 2.2; }
      }
    }

    // An attacker goes for the unicorn first if she is standing in its lane,
    // otherwise for whatever is nearest (design ch.13.1).
    let target = null;
    if (u.foe && me.hp > 0 && me.lane === u.lane && Math.abs(me.x - u.x) <= u.range) target = me;
    if (!target) {
      let best = 1e9;
      for (const v of f.units) {
        if (v.hp <= 0 || friendly(v, u) || v.lane !== u.lane) continue;
        const d = Math.abs(v.x - u.x);
        if (d <= u.range && d < best) { best = d; target = v; }
      }
    }
    // It can only start on the thing you defend once nothing living is left
    // holding that lane - it has to get through her first (design ch.13.1).
    if (!target && u.foe && Math.abs(u.x - MID) < 7 &&
        !f.units.some(v => v.hp > 0 && !v.foe && v.lane === u.lane && !v.me)) target = me;

    if (target) { if (u.wait <= 0) { strike(u, target, f); u.wait = u.cd; } }
    else if (u.speed) u.x += u.dir * u.speed * dt * (u.slow > 0 ? .5 : 1);
  }

  // Losses carry: her HP is hers to keep, and nothing brings her back (ch.12.4).
  for (const u of f.units) {
    if (u.girl) {
      u.girl.hp = Math.max(0, u.hp);
      if (u.hp <= 0 && !state.dead.includes(u.girl.i)) {
        state.dead.push(u.girl.i);
        state.girls = state.girls.filter(g => g !== u.girl);
        note(`${HUES[u.girl.i][0]} does not get up.`);
        ribbon(u.girl.i);
        snd(170, .5, "sawtooth", .06);
      }
    }
  }
  state.hp = Math.max(0, me.hp);
  const standing = f.units.length;
  f.units = f.units.filter(u => u.hp > 0 || u.me);
  if (f.units.length < standing) snd(400, .05, "square", .025);

  const foesLeft = f.units.some(u => u.foe && u.hp > 0);
  if (me.hp <= 0) end(0);
  else if (!foesLeft && !f.spawns.some(s => s.foe)) end(1);
  else if (f.t >= LASTS) end(foesLeft ? 0 : 1);
}

function draw() {
  const f = state.fight;
  ctx.fillStyle = "#0d0b18";
  ctx.fillRect(0, 0, 320, 180);

  LANES.forEach((y, i) => {
    ctx.fillStyle = i === f.units[0].lane ? "#1e1a38" : "#151228";
    ctx.fillRect(0, y - 17, 320, 34);
  });
  ctx.fillStyle = "#2c2554";
  ctx.fillRect(MID - 1, 0, 2, 180);

  for (const u of f.units) {
    if (u.hp <= 0) continue;
    // She and the unicorn hold the same spot, so they are drawn apart to be read.
    const y = LANES[u.lane] + (u.girl ? 7 : u.me ? -4 : 0), w = u.me ? 11 : 8;
    if (!u.foe && !u.me) { ctx.fillStyle = "#2a3a30"; ctx.fillRect(u.x - w, y - w, w * 2, w * 2); }
    ctx.fillStyle = u.colour;
    if (u.me) {
      ctx.fillRect(u.x - 5, y - 6, 10, 12);
      ctx.fillRect(u.x + 4, y - 12, 2, 7);          // the horn
    } else {
      ctx.fillRect(u.x - w / 2, y - w / 2, w, w);
      if (u.foe) { ctx.fillStyle = "#0d0b18"; ctx.fillRect(u.x - 2, y - 1, 4, 1); }
    }
    ctx.fillStyle = "#3a3352";
    ctx.fillRect(u.x - 7, y - 13, 14, 2);
    ctx.fillStyle = u.foe ? "#e2687a" : "#7fd6a0";
    ctx.fillRect(u.x - 7, y - 13, 14 * Math.max(0, u.hp) / u.max, 2);
  }

  hud.innerHTML = `<span>${Math.max(0, LASTS - f.t).toFixed(0)}s</span>
    <span>HP <b>${state.hp}</b> / ${state.max}</span>
    <span>Jumps <b>${f.jumps}</b></span>
    <span>${f.units.filter(u => u.foe && u.hp > 0).length + f.spawns.filter(s => s.foe).length} left</span>`;
}

function loop(now) {
  const f = state.fight;
  if (!f || f.over) return;
  const dt = Math.min((now - (f.last || now)) / 1000, .05);
  f.last = now;
  step(dt);
  if (state.fight && !state.fight.over) { draw(); requestAnimationFrame(loop); }
}

function end(won) {
  state.fight.over = 1;
  // A night's work tells on whatever you were holding, win or lose (ch.11.3).
  const a = state.arms[state.held];
  if (a && a.cond < 2) { a.cond++; note(`${ARMS[a.i][0]} is ${CONDITION[a.cond]}.`); }
  if (won) { snd(330, .16, "triangle", .06); setTimeout(() => snd(495, .3, "triangle", .06), 150); }
  else snd(160, .8, "sawtooth", .07);
  setTimeout(() => (won ? survived() : fell()), 400);
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
    <h1>${["The road is quiet.", "Word has travelled.", "Fewer doors open now.", "It arrives tonight."][state.day - 1]}</h1>
    <p>Four hours of daylight.</p>
    ${echo}
    <button class="go" id="x">Go on</button>`);
  on("#x", placeSelect);
}

function placeSelect() {
  status();
  show(`<div class="eyebrow">${TIMES[state.step]}</div>
    <h1>Where do you go?</h1>
    <p>Every hour is a choice about where you are seen.</p>
    <div class="pair">
      <button data-p="town"><h2>The town</h2><small>People who still have doors to open.</small></button>
      <button data-p="castle"><h2>The castle</h2><small>Held, lit, and full. Nobody expects you.</small></button>
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
  on("[data-i]", el => {
    const e = state.offers[+el.dataset.i];
    e.id === "shop" ? bench() : confirm(e);
  });
}

/* The bench is its own screen because making and mending are the same hour.
   Walking away from it costs nothing at all (design ch.5.3, ch.11.3). */
function bench() {
  const rows = [];
  ARMS.forEach((a, n) => {
    if (canMake(n)) rows.push(`<button data-m="${n}">
      <span class="risk">${a[5]} shards</span><h2>Forge the ${a[0].toLowerCase()}</h2>
      <small>${a[1]} damage &middot; ${SKILLS[n].toLowerCase()}</small></button>`);
  });
  state.arms.forEach((a, n) => {
    if (a.cond) rows.push(`<button data-f="${n}" ${state.shards < FIX_COST ? "disabled" : ""}>
      <span class="risk">${FIX_COST} shards</span><h2>Mend the ${ARMS[a.i][0].toLowerCase()}</h2>
      <small>${CONDITION[a.cond]} &middot; back to sound</small></button>`);
  });

  status();
  show(`<div class="eyebrow">${TIMES[state.step]} &middot; the bench</div>
    <h1>What do you work on?</h1>
    <p>${rows.length ? "It takes the hour, whichever you pick." : "Nothing here needs you yet."}</p>
    <div class="list">${rows.join("")}
      <button id="b">Leave the bench<small>Costs nothing.</small></button>
    </div>`);

  on("[data-m]", el => askBench(+el.dataset.m, 1));
  on("[data-f]", el => askBench(+el.dataset.f, 0));
  on("#b", actionSelect);
}

/* Making and mending spend the hour, so they are asked like anything else. */
function askBench(n, making) {
  const name = making ? ARMS[n][0] : ARMS[state.arms[n].i][0];
  const price = making ? ARMS[n][5] : FIX_COST;
  show(`<div class="eyebrow">The bench</div>
    <h1>${making ? "Forge" : "Mend"} the ${name.toLowerCase()}?</h1>
    <div class="box">
      <p class="gain">${price} shards, and the hour.</p>
      <div class="row">
        <button class="go" id="y">Yes</button>
        <button class="go" id="n">No</button>
      </div>
    </div>`);
  on("#y", () => {
    if (making) {
      state.shards -= price;
      state.arms.push({ i: n, cond: 0 });
      note(`Forged: ${name}`);
      snd(520, .14, "triangle");
      worked(`The ${name.toLowerCase()} is finished.`, `${SKILLS[n]}, once a night.`);
    } else {
      const a = state.arms[n];
      state.shards -= price;
      a.cond = 0;
      note(`Mended: ${name}`);
      snd(440, .12, "triangle");
      worked(`The ${name.toLowerCase()} is sound again.`, "It will hold another night or two.");
    }
  });
  on("#n", bench);
}

function worked(head, sub) {
  status();
  show(`<div class="eyebrow">The bench</div>
    <div class="box"><div class="stage great">${head}</div><p>${sub}</p>
      <button class="go" id="x">Go on</button></div>`);
  on("#x", nextStep);
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
    // An hour of sitting still puts back a third of everyone, and nothing
    // else - it does not mend arms and it does not raise the dead (ch.10).
    const back = n => Math.round(n * .3);
    state.hp = Math.min(state.max, state.hp + back(state.max));
    state.girls.forEach(g => (g.hp = Math.min(GIRL_HP, g.hp + back(GIRL_HP))));
    body = `<div class="stage">The hour passes</div>
      <p>You put your head down where you are.</p>
      <p class="gain">You and ${state.girls.length ? "the ones still with you are" : "nothing else is"} a little further from the edge.</p>`;
  } else {
    stage = roll(r);
    const [lo, hi] = SHARDS[stage];
    const got = lo + rnd(hi - lo + 1);
    state.shards += got;
    body = `<div class="stage ${STAGES[stage][0]}">${STAGES[stage][1]}</div>
      <p>${e.out[stage]}</p>
      ${got ? `<p class="gain">Rainbow shards +${got}</p>` : ""}`;
    grant(e.id, stage);
    // The castle reads as getting her out, the town as taking her with you.
    if (BRINGS[e.id] !== undefined && stage <= BRINGS[e.id]) bring(state.place === "castle");
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
  on("#x", () => settle(nextStep));
}

/* The bag is full and something new has turned up. Nothing is destroyed
   quietly - the player picks what stops mattering (design ch.8.3). */
function exchange(then) {
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
    settle(then);
  });
}

function nextStep() {
  state.offers = null;
  state.place = null;
  state.step++;
  if (state.step < 4) return placeSelect();

  // The day is spent. Refusing the shelter for a whole day is itself an answer.
  if (state.day === 1 && state.sheltered === null) state.sheltered = false;

  placeGirls();
}

/* Up to three of them, one to a lane, before the light goes (design ch.12.3). */
function placeGirls() {
  status();
  const chosen = state.placed.filter(g => g != null);
  const rows = state.girls.map((g, i) => {
    const at = state.placed.indexOf(i);
    return `<button data-g="${i}" class="${at >= 0 ? "on" : ""}">
      <span class="risk">${at >= 0 ? ["Top", "Middle", "Bottom"][at] : "&mdash;"}</span>
      <h2><i class="dot" style="background:${HUES[g.i][1]}"></i>${HUES[g.i][0]}</h2>
      <small>${g.hp} / ${GIRL_HP} &middot; ${["steady", "mends the others", "slows what she hits", "goes through more than one"][HUES[g.i][5]]}</small>
    </button>`;
  }).join("");

  const w = mine();
  const arms = state.arms.map((a, n) => `<button data-w="${n}" class="${n === state.held ? "on" : ""}">
    ${ARMS[a.i][0]}<small>${CONDITION[a.cond]}</small></button>`).join("");

  show(`<div class="eyebrow">Day ${state.day} &middot; Dusk</div>
    <h1>Who stands where?</h1>
    <p>${state.girls.length
      ? "One to a lane. You hold whichever lane you stand in."
      : "Nobody to put out there. You hold all three yourself."}</p>
    <div class="list">${rows}</div>
    ${state.arms.length ? `<p class="tiny">What you carry (${w.dmg} damage). Every arm you made
      lends its skill once, held or not.</p><div class="skills">${arms}</div>` : ""}
    <button class="go" id="x">Let it come (${chosen.length} placed)</button>`);

  on("[data-w]", el => { state.held = +el.dataset.w; placeGirls(); });
  on("[data-g]", el => {
    const i = +el.dataset.g, at = state.placed.indexOf(i);
    if (at >= 0) state.placed[at] = null;
    else { const free = state.placed.indexOf(null); if (free >= 0) state.placed[free] = i; }
    placeGirls();
  });
  on("#x", startFight);
}

function fightScreen() {
  status();
  show(`<div class="eyebrow">Day ${state.day} &middot; Night</div>
    <div class="hud" id="hud"></div>
    <canvas id="field" width="320" height="180"></canvas>
    <div class="skills" id="skills">${state.arms.map((a, n) =>
      `<button data-s="${n}">${ARMS[a.i][0]}<small>${SKILLS[a.i]}</small></button>`).join("")}</div>
    <p class="tiny">Click a lane to be there. Three jumps, no wait.</p>`);
  hud = document.querySelector("#hud");
  on("[data-s]", el => useSkill(+el.dataset.s));
  paintSkills();
  const cv = document.querySelector("#field");
  ctx = cv.getContext("2d");
  cv.onclick = e => {
    const f = state.fight;
    if (!f || f.over || !f.jumps) return;
    const r = cv.getBoundingClientRect();
    const lane = Math.min(2, Math.max(0, Math.floor((e.clientY - r.top) / r.height * 3)));
    if (lane === f.units[0].lane) return;
    f.units[0].lane = lane;
    f.jumps--;
    snd(540, .07, "triangle");
  };
  requestAnimationFrame(loop);
}

function paintSkills() {
  const f = state.fight;
  document.querySelectorAll("[data-s]").forEach((b, n) => {
    const a = state.arms[n], empty = a.i === 3 && !state.girls.length;
    b.disabled = !!f.used[n] || a.cond === 2 || empty;
    b.className = f.used[n] ? "spent" : a.cond === 2 || empty ? "broke" : "";
  });
}

function survived() {
  status();
  show(`<div class="eyebrow">Day ${state.day} &middot; Dawn</div>
    <h1>It holds.</h1>
    <p>What was coming is not coming any more.</p>
    <button class="go" id="x">${state.day < 4 ? "Next morning" : "See how it ends"}</button>`);
  on("#x", () => settle(() => {
    if (state.day < 4) { state.day++; state.step = 0; state.placed = [null, null, null]; keep(); dayStart(); }
    else ending();
  }));
}

function fell() {
  const lost = state.dead.length - state.fight.wasDead;
  status();
  show(`<div class="eyebrow">Day ${state.day} &middot; Night</div>
    <h1>It does not hold.</h1>
    <p>The day is yours to take again, and spend differently.</p>
    ${lost ? `<p class="gain">${lost === 1 ? "The one who died tonight stays dead"
      : `The ${lost} who died tonight stay dead`}. That much does not come back with you.</p>` : ""}
    <div class="row">
      <button class="go" id="r">Take the day again</button>
      <button class="go" id="q">Start over</button>
    </div>`);
  on("#r", () => { rewind(); settle(dayStart); });
  on("#q", scrap);
}

/* Nothing is thrown away without being asked first (design ch.15.3). */
function scrap() {
  show(`<div class="eyebrow">Start over</div>
    <h1>All of it?</h1>
    <div class="box">
      <p>The days, what you carried, what you did, and the ones who are gone.</p>
      <div class="row">
        <button class="go" id="y">Yes, all of it</button>
        <button class="go" id="n">No</button>
      </div>
    </div>`);
  on("#y", title);
  on("#n", fell);
}

function ending() {
  const k = state.karma;
  const [name, text] = k >= 21
    ? ["VIRGIN KNIGHT", "You go up and you do not come back down. The telling will be kinder than the four days were."]
    : k <= -21
      ? ["VIRGIN NIGHT", "What survives, survives behind a door you keep the key to."]
      : ["VIRGINIGHT", "You came down on neither side, and nothing between them is settled."];

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
