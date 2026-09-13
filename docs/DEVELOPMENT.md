# Development Guide

Random Duel Rainbow currently lives in `prismatic-duel/`. Run commands from
the repository root. See the [main README](../README.md) to play.

## Requirements and commands

Use Node.js 20 or newer with npm. Python 3 is used only for the optional local server.

```sh
npm ci
npm run dev
```

The server binds to `127.0.0.1:4173` and serves the current game's directory.
Stop it with Ctrl+C. If the port is in use, reuse your existing game server or
run the Python command from the README with another port.

| Command | Purpose |
| --- | --- |
| `npm test` | Run the eight current regression suites |
| `npm run build` | Minify and package the game |
| `npm run verify` | Build twice and validate the local submission ZIP |
| `node prismatic-duel/moves.mjs 12345` | Inspect generated move data |
| `node prismatic-duel/roles.sim.mjs 20` | Run scripted combat comparisons |

The suites cover 90,000 generated bosses, 28,000 stolen moves, trial and pause
flows, melee parries and timing boundaries, telegraphs, move roles, counter
opportunities and sound events. Simulations do not measure human enjoyment.

`refactor.test.mjs` is a separate before/after comparison tool. It needs three
explicit paths and is not part of `npm test`:

```sh
node prismatic-duel/refactor.test.mjs before.js after.js prismatic-duel/dist/index.html
```

## Build output

| File | Purpose |
| --- | --- |
| `prismatic-duel/dist/index.html` | Standalone game with inline CSS and JavaScript |
| `prismatic-duel/dist/prismatic-duel.zip` | Submission package; original development filename |
| `prismatic-duel/dist/SUBMISSION.txt` | Verification record, size, hash and source revision |

Generated output is ignored by Git. The build uses Terser and Node's built-in
compression; the shipped game has no runtime dependencies or external assets.

Verification checks identical ZIP bytes across two builds, a single root-level
`index.html`, matching extracted content, no external resource references, and
the 13,312-byte limit. It performs no upload, commit or push.

Before submitting, commit and push the intended source, verify again, and use
that ZIP with the matching repository revision. A dirty working tree means the
ZIP includes changes that cannot be reproduced from HEAD alone.

## Sound tools

With the development server running, visit
[the sound lab](http://localhost:4173/soundcheck.html). It uses the game's real
sound functions and renders WAV samples through OfflineAudioContext. The page,
its script and generated samples do not enter the submission ZIP.

## Design and history

[Current specifications](../design/spec/README.md) describe the implementation;
the [design tree](../design/tree/index.md) records decisions and precedence.
Most design history and code comments are in Japanese. They are kept as authored.
A [layout proposal](REPOSITORY_LAYOUT.md) describes promotion of the current game
to the root while preserving earlier experiments. It has not been applied.
