# Proposed Repository Layout

**Status: proposed; no file moves have been applied.**

Goal: opening the root should launch Random Duel Rainbow, and the source, tests
and build tools should clearly belong to that game.

```text
README.md                    English introduction and controls
index.html                   Random Duel Rainbow entry point
game.js                      Current game source
style.css                    Current game styles
package.json
package-lock.json
scripts/                     Current build and local submission verification
tests/                       Current regression suites
tools/                       Sound lab, move inspector and simulations
docs/                        English guides and competition notes
design/                      Existing specifications and decision history
archive/
  virginight/                Previous root game, designs, builds and playtest images
  proto/                    Earlier prototypes
  GAME_PLAN.md              Earlier concept
  SOULS_ACTION_DESIGN.md     Earlier concept
dist/                        Generated current-game output; ignored by Git
```

## Concrete moves

| Current location | Proposed location |
| --- | --- |
| Root `index.html`, `game.js`, `style.css` | `archive/virginight/` |
| Root `VIRGINIGHT_DESIGN.md`, `NIGHT_TACTICS_DESIGN.md`, `NIGHT_TD_DESIGN.md` | `archive/virginight/` |
| `scripts/build.mjs` (Virginight) | `archive/virginight/scripts/build.mjs` |
| Root `dist/`, `playtest-evidence-child/` | `archive/virginight/` |
| Root `proto/`, `GAME_PLAN.md`, `SOULS_ACTION_DESIGN.md` | `archive/` |
| `prismatic-duel/index.html`, `game.js`, `style.css` | Repository root |
| `prismatic-duel/build.mjs`, `submit.mjs` | `scripts/` |
| `prismatic-duel/test.mjs` | `tests/generation.test.mjs` |
| `prismatic-duel/*.test.mjs` | `tests/` |
| `prismatic-duel/moves.mjs`, `sim.mjs`, `roles.sim.mjs`, `soundcheck.html`, `soundcheck.js` | `tools/` |
| `prismatic-duel/README.md` | `docs/GAMEPLAY.md` |
| `JS13KGAMES_GUIDE.md` | `docs/JS13KGAMES_GUIDE.md` |

Preserve old ignored development builds as ignored archive material. Retain the
already tracked historical ZIP and screenshots. Remove the old game directory
only when empty; do not overwrite a nonempty destination.

## References to update together

- npm commands and build input/output paths.
- Tests and simulations that load `game.js` relative to their module.
- Sound lab script links and its link back to the game.
- Current README/specification links; retain dated history with this path mapping.
- Submission ZIP name to `dist/random-duel-rainbow.zip` and its verification record.
- Ignore rules so new output stays ignored and archived tracked evidence stays tracked.

## Acceptance checks

Run all eight suites and local submission verification. Confirm the root URL
opens Random Duel Rainbow, the sound lab loads the same source, and archived
Virginight still loads its own scripts and styles. Check documentation links
and that the submission contains only the current game and fits 13,312 bytes.

## Approval boundary

Automatic approval review rejected the initial batch move because it involved
many source, design and historical files and could break relative references.
The table above makes the exact scope reviewable before retrying that move.
