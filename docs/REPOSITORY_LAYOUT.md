# Repository Layout

**Status: applied on 2026-09-13.** Opening the repository root launches
Random Duel Rainbow; its source, tests and build tools live at the top level,
and frozen work is kept under `archive/`.

```text
README.md                    English introduction and controls
index.html                   Random Duel Rainbow entry point
game.js                      Game source (commented)
style.css                    Game styles
package.json
package-lock.json
scripts/
  build.mjs                  Minify, inline and zip
  submit.mjs                 Build twice and verify the submission ZIP
tests/                       Regression suites (npm test) and refactor.test.mjs
tools/                       Sound lab, move inspector and simulations
docs/                        English guides and competition notes
design/                      Specifications and AIDE decision history
archive/                     Frozen; not part of the submission
  virginight/                Previous root game: source, designs, build script,
                             historical ZIP and playtest screenshots
  proto/                     Earlier prototypes
  GAME_PLAN.md               Earlier concept
  SOULS_ACTION_DESIGN.md     Earlier concept
  aidedesigntree.sh          One-off script that imported the design tree
dist/                        Generated output; ignored by Git
```

## Path mapping from the previous layout

Dated documents under `design/` still use the old paths; read them with this table.

| Previous location | Current location |
| --- | --- |
| Root `index.html`, `game.js`, `style.css` (Virginight) | `archive/virginight/` |
| Root `VIRGINIGHT_DESIGN.md`, `NIGHT_TACTICS_DESIGN.md`, `NIGHT_TD_DESIGN.md` | `archive/virginight/` |
| `scripts/build.mjs` (Virginight) | `archive/virginight/scripts/build.mjs` |
| Root `dist/unicorns-and-rainbows-mvp.zip`, `playtest-evidence-child/` | `archive/virginight/` |
| Root `proto/`, `GAME_PLAN.md`, `SOULS_ACTION_DESIGN.md`, `scripts/aidedesigntree.sh` | `archive/` |
| `prismatic-duel/index.html`, `game.js`, `style.css` | Repository root |
| `prismatic-duel/build.mjs`, `submit.mjs` | `scripts/` |
| `prismatic-duel/test.mjs` | `tests/generation.test.mjs` |
| `prismatic-duel/*.test.mjs` | `tests/` |
| `prismatic-duel/moves.mjs`, `sim.mjs`, `roles.sim.mjs`, `soundcheck.html`, `soundcheck.js` | `tools/` |
| `prismatic-duel/README.md` | `docs/GAMEPLAY.md` |
| `JS13KGAMES_GUIDE.md` | `docs/JS13KGAMES_GUIDE.md` |
| `prismatic-duel/dist/prismatic-duel.zip` | `dist/random-duel-rainbow.zip` |

## Conventions

- Anything under `archive/` is frozen: it is kept for history and is not
  edited, tested or built as part of the current game.
- `archive/virginight/` remains self-contained; its own `scripts/build.mjs`
  writes into `archive/virginight/dist/`, which is ignored like every `dist/`.
- Tests and tools load `../game.js` relative to their own file.
