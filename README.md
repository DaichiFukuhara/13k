# Random Duel Rainbow

**One unicorn. One horn. One stolen move.**

A compact, keyboard-controlled boss action game made for the js13kGames 2026
*Unicorns and Rainbows* theme. Read your opponent's attacks, parry with your horn,
and copy a defeated boss's move to change the way you fight.

Defeat three guardians to restore the rainbow, then continue into **Prism Ascent**
and see how far you can climb. Share a seed to challenge the same generated foes.

## Play locally

With Python 3 installed, run this from the repository root:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Open [localhost:4173](http://localhost:4173/), or try
[seed TEST01](http://localhost:4173/?seed=TEST01). The root `index.html`,
`game.js` and `style.css` are the game.
Use a desktop browser and keyboard. Audio starts after your first key press.

## Controls

| Action | Keys |
| --- | --- |
| Move | A / D or Left / Right |
| Jump | W, Up or Space |
| Attack | J or Z |
| Parry | K or X |
| Roll | L or C |
| Pause / resume | Escape; Enter also resumes |
| Choose a move after a victory | A / D or Left / Right |
| Try the selected move | T |
| Return from the trial | R |
| Keep the selected move and continue | Enter |

Watch for a **white attack outline** to time your parry. You can parry melee
attacks and reflect projectiles; dodge falling **RAIN** attacks. A parry starts
immediately when you are free to act, but cannot cancel an attack's recovery.
Let stamina refill between actions.

## Choose your fighting style

| Move | Strength | Tradeoff |
| --- | --- | --- |
| Sweep | Push the enemy away | Creates distance you may need to close again |
| Thrust | Strike during a short opening | Narrow reach |
| Slam | Deal heavy posture damage | Slow commitment |
| Charge | Close a gap while attacking | Leaves you near the enemy |
| Shot | Attack from a distance | Locks your feet while firing |
| Rain | Place an attack ahead of the enemy | Lands late at a fixed location |

Your horn holds **one move at a time**. Copying a move changes your options;
it does not add another equipment slot. Trials let you test a choice before committing.

## Build and verify

Requires Node.js 20 or newer and npm. Run from the repository root:

```sh
npm ci
npm test
npm run build
npm run verify
```

The build produces `dist/index.html` and `dist/random-duel-rainbow.zip`.
The ZIP contains a single standalone
HTML file and must fit within **13,312 bytes**. It needs no external assets or
runtime libraries. Verification is local; it does not upload an entry.

## Explore the project

| Location | Contents |
| --- | --- |
| [Game guide](docs/GAMEPLAY.md) | Combat, retries, trials, seeds and endless mode |
| [Development guide](docs/DEVELOPMENT.md) | Builds, tests, sound tools and submission steps |
| [Source](game.js) | Commented game implementation |
| [Tests](tests/) and [tools](tools/) | Regression suites, sound lab, move inspector and simulations |
| [Design documentation](design/README.md) | Specifications and AIDE design history, primarily in Japanese |
| [Repository layout](docs/REPOSITORY_LAYOUT.md) | What lives where, including archived work |

Earlier games, concepts and prototypes are frozen under [`archive/`](archive/):
**Virginight** (`archive/virginight/`, the previous root game with its designs,
build script and playtest images), `archive/proto/`, and the early concept
documents. They are not part of the submission.
