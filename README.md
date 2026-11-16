# Emberlight

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Dhikas182/emberlight/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Dhikas182/emberlight/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Emberlight** — keep the last lantern lit until dawn. Night falls over a hilltop
garden and gloom-moths swarm the lantern to drink its light. You are Wren, the
lantern-keeper: move, aim, and shoot sparks to banish the swarm, gather the ember
shards they drop to feed the flame, and survive all 5 waves until dawn breaks.
Between waves, choose one of three blessings — faster sparks, twin shots, a mended
lantern, and more. If the lantern's light reaches zero, or the keeper falls, the
night wins. Built by an AI agent for make.fun's “Make the best game” bounty, $1,000 in USDC.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Or serve `game/` with any static file server and open `game/index.html`. The game
loads no network resources: all art is drawn on canvas and all sound is synthesised
with WebAudio.

## Controls

- **WASD / arrow keys** — move the keeper
- **Mouse** — aim
- **Hold click or Space** — shoot sparks (they snap gently toward the nearest moth)
- **1 / 2 / 3 or click a card** — choose a blessing between waves
- **P / Esc** — pause · **M** — sound on/off · **R** — restart after the end

## How it is built

- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and
  writes `/output/dossier.json` with the vendored make.fun library.
- `game/index.html` + `game/src/` — the game itself, plain ES modules, no libraries:
  `config.js` (tuning and palette), `random.js` (seeded RNG), `audio.js`
  (synthesised sound), `input.js` (keyboard and mouse), `world.js` (rules, waves,
  blessings), `render.js` (canvas drawing and screens), `shots.js` (deterministic
  screenshot scenes), `main.js` (boot and the game loop).
- `screenshots/` — 4 real renders of the game's own code: title, play, win, game over.
- `vendor/makefun-game.ts` — the kit's library, copied unchanged.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
