// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot,
// so the frame is what a short game really looks like and the same seed always gives the
// same frame. The autopilot sees the same state a player sees: it moves toward a guard
// spot between the lantern and the most threatening moth, aims at it and fires.
import { LANTERN, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const WIN_LIMIT_SECONDS = 600;
const END_LIMIT_SECONDS = 600;

function nearestThreat(state) {
  let latched = null;
  let threat = null;
  let threatDist = Infinity;
  for (const m of state.moths) {
    if (!m.active) continue;
    if (m.latched) { latched = m; break; }
    const d = Math.hypot(m.x - LANTERN.x, m.y - LANTERN.y);
    if (d < threatDist) { threatDist = d; threat = m; }
  }
  return latched || threat;
}

function autopilot(state, weak) {
  const target = nearestThreat(state);
  const player = state.player;
  if (target === null) {
    const dx = LANTERN.x - player.x;
    const dy = LANTERN.y + 140 - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    return { move: { x: (dx / dist) * 0.6, y: (dy / dist) * 0.6 }, aim: { x: LANTERN.x, y: LANTERN.y - 120 }, firing: false };
  }
  const aim = { x: target.x + (LANTERN.x - target.x) * 0.12, y: target.y + (LANTERN.y - target.y) * 0.12 };
  if (weak) {
    // A hurried player: wanders, aims at a fixed corner instead of the swarm, and
    // only remembers to shoot a third of the time, so the lantern is overrun.
    const t = state.time;
    const firing = (t % 1) < 0.3;
    return {
      move: { x: Math.sin(t * 0.7) * 0.4, y: Math.cos(t * 0.5) * 0.4 },
      aim: { x: 180, y: 140 },
      firing,
    };
  }
  const tx = LANTERN.x + (target.x - LANTERN.x) * 0.55;
  const ty = LANTERN.y + (target.y - LANTERN.y) * 0.55;
  const dx = tx - player.x;
  const dy = ty - player.y;
  const dist = Math.hypot(dx, dy) || 1;
  const speed = dist > 24 ? 1 : 0;
  return { move: { x: (dx / dist) * speed, y: (dy / dist) * speed }, aim, firing: true };
}

function pickBlessing(world) {
  const offered = world.state.blessings;
  const light = world.state.lantern.light;
  const order = ['twin', 'swift', 'mend', 'wide', 'cloak', 'magnet'];
  let best = 0;
  let bestRank = Infinity;
  for (let i = 0; i < offered.length; i += 1) {
    let rank = order.indexOf(offered[i].id);
    if (offered[i].id === 'mend' && light < 8) rank = -1;
    if (rank < bestRank) { bestRank = rank; best = i; }
  }
  world.applyBlessing(best);
}

function simulate(world, seconds, weak, wantWave) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const state = world.state;
    if (state.waveState === 'blessing') pickBlessing(world);
    const control = autopilot(state, weak);
    const events = world.step(STEP, control.move, control.aim, control.firing, false);
    if (events & EVENT_WIN) return 'win';
    if (events & EVENT_OVER) return 'over';
    if (wantWave && state.wave >= wantWave && state.waveState === 'fighting') {
      let alive = 0;
      for (const m of state.moths) if (m.active) alive += 1;
      if (alive >= 3) return 'play';
    }
  }
  return 'play';
}

/**
 * Set `world` to the named scene (start, play, win or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'win' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, { x: 640, y: 300 }, false, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Play until the field is busy (wave 2 or later, at least 7 moths on screen), so
    // the gameplay screenshot shows the swarm, sparks and embers, not an empty field.
    const chunk = 0.5;
    const chunks = Math.floor(120 / chunk);
    for (let c = 0; c < chunks; c += 1) {
      simulate(world, chunk, false, 0);
      const state = world.state;
      let alive = 0;
      for (const m of state.moths) if (m.active) alive += 1;
      if (state.wave >= 2 && state.waveState === 'fighting' && alive >= 7) break;
      if (state.waveState === 'blessing') pickBlessing(world);
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    const outcome = simulate(world, WIN_LIMIT_SECONDS, false, 0);
    return { screen: outcome === 'win' ? SCREEN_WIN : SCREEN_OVER, best: world.state.score };
  }
  const outcome = simulate(world, END_LIMIT_SECONDS, true, 0);
  return { screen: outcome === 'over' ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
