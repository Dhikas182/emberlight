// The game's rules and state, with no drawing and no browser in it: the keeper, the
// lantern, the waves of gloom-moths, sparks, ember shards, blessings between waves, score
// and the win/lose conditions. step() advances one fixed step and returns what happened as
// bit flags, so the caller can react (sounds, announcements) without the world knowing
// about screens or sound. Nothing here allocates after createWorld returns.
import {
  EMBER, FIELD, LANTERN, MOTHS, PLAYER, POOL_EMBERS, POOL_MOTHS, POOL_PARTICLES,
  POOL_SPARKS, WAVES,
} from './config.js';

export const KIND_FLUTTER = 0;
export const KIND_DARTER = 1;
export const KIND_BRUTE = 2;
export const EVENT_KILL = 1;
export const EVENT_EMBER = 2;
export const EVENT_HIT = 4;
export const EVENT_LATCH = 8;
export const EVENT_WAVE = 16;
export const EVENT_OVER = 32;
export const EVENT_WIN = 64;

export const BLESSINGS = [
  { id: 'swift', name: 'Swift Sparks', desc: 'Shoot 25% faster.' },
  { id: 'twin', name: 'Twin Ember', desc: 'Fire one more spark at once.' },
  { id: 'wide', name: 'Wide Ember', desc: 'Sparks spread wider.' },
  { id: 'mend', name: 'Mend the Light', desc: 'Restore 4 lantern light.' },
  { id: 'cloak', name: 'Sturdy Cloak', desc: 'Gain one heart, up to 5.' },
  { id: 'magnet', name: 'Ember Magnet', desc: 'Embers fly to you from farther away.' },
];

function overlaps(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy < r * r;
}

export function createWorld(random) {
  const stars = [];
  for (let i = 0; i < 90; i += 1) {
    stars.push({ x: random() * FIELD.width, y: random() * FIELD.height * 0.7, r: 0.6 + random() * 1.4, phase: random() * Math.PI * 2 });
  }
  const fireflies = [];
  for (let i = 0; i < 14; i += 1) {
    fireflies.push({ x: random() * FIELD.width, y: 120 + random() * 480, phase: random() * Math.PI * 2, speed: 0.3 + random() * 0.5 });
  }
  const moths = [];
  for (let i = 0; i < POOL_MOTHS; i += 1) moths.push({ active: false, kind: 0, x: 0, y: 0, hp: 1, radius: 13, speed: 55, flap: 0, latched: false, latchAngle: 0, drainTimer: 0, zig: 0, dir: 1 });
  const sparks = [];
  for (let i = 0; i < POOL_SPARKS; i += 1) sparks.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const embers = [];
  for (let i = 0; i < POOL_EMBERS; i += 1) embers.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const particles = [];
  for (let i = 0; i < POOL_PARTICLES; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, color: '#ffffff', size: 2 });

  const player = { x: FIELD.width / 2, y: 540, hearts: PLAYER.heartsMax, invulnerable: 0, fireTimer: 0 };
  const lantern = { light: LANTERN.lightMax };
  const upgrades = { fireInterval: PLAYER.fireInterval, projectiles: 1, spread: 0.14, magnetMul: 1, heartsMax: PLAYER.heartsMax };
  const state = {
    player, lantern, moths, sparks, embers, particles, stars, fireflies,
    score: 0, kills: 0, wave: 1, waveState: 'fighting', overReason: '',
    elapsed: 0, time: 0, spawnQueue: [], spawnTimer: 0, ambientTimer: 0,
    blessings: [], taken: {},
  };

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }
  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (p === null) return;
      const a = random() * Math.PI * 2;
      const s = speed * (0.4 + random() * 0.8);
      p.active = true; p.x = x; p.y = y;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.max = 0.4 + random() * 0.35; p.life = p.max;
      p.color = color; p.size = 2 + random() * 3;
    }
  }
  function waveComposition(n) {
    const queue = [];
    const flutters = 6 + 2 * n;
    const darters = n >= 2 ? 2 * n - 2 : 0;
    const brutes = n >= 3 ? n - 2 : 0;
    for (let i = 0; i < flutters; i += 1) queue.push(KIND_FLUTTER);
    for (let i = 0; i < darters; i += 1) queue.push(KIND_DARTER);
    for (let i = 0; i < brutes; i += 1) queue.push(KIND_BRUTE);
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const t = queue[i]; queue[i] = queue[j]; queue[j] = t;
    }
    return queue;
  }
  function startWave(n) {
    state.wave = n;
    state.waveState = 'fighting';
    state.spawnQueue = waveComposition(n);
    state.spawnTimer = 0.9;
  }
  function offerBlessings() {
    const pool = BLESSINGS.slice();
    const offered = [];
    for (let i = 0; i < 3; i += 1) {
      const index = Math.floor(random() * pool.length);
      offered.push(pool.splice(index, 1)[0]);
    }
    state.blessings = offered;
    state.waveState = 'blessing';
  }
  function applyBlessing(index) {
    const blessing = state.blessings[index];
    if (!blessing) return false;
    state.taken[blessing.id] = (state.taken[blessing.id] || 0) + 1;
    if (blessing.id === 'swift') upgrades.fireInterval = Math.max(0.08, upgrades.fireInterval * 0.75);
    else if (blessing.id === 'twin') upgrades.projectiles = Math.min(3, upgrades.projectiles + 1);
    else if (blessing.id === 'wide') upgrades.spread += 0.12;
    else if (blessing.id === 'mend') lantern.light = Math.min(LANTERN.lightMax, lantern.light + 4);
    else if (blessing.id === 'cloak') { upgrades.heartsMax = Math.min(5, upgrades.heartsMax + 1); player.hearts = Math.min(upgrades.heartsMax, player.hearts + 1); }
    else if (blessing.id === 'magnet') upgrades.magnetMul *= 2;
    state.blessings = [];
    startWave(state.wave + 1);
    return true;
  }
  function spawnMoth(kind) {
    const moth = free(moths);
    if (moth === null) return;
    const def = kind === KIND_DARTER ? MOTHS.darter : kind === KIND_BRUTE ? MOTHS.brute : MOTHS.flutter;
    const edge = Math.floor(random() * 4);
    if (edge === 0) { moth.x = random() * FIELD.width; moth.y = -30; }
    else if (edge === 1) { moth.x = random() * FIELD.width; moth.y = FIELD.height + 30; }
    else if (edge === 2) { moth.x = -30; moth.y = random() * FIELD.height; }
    else { moth.x = FIELD.width + 30; moth.y = random() * FIELD.height; }
    moth.active = true; moth.kind = kind; moth.hp = def.hp;
    moth.radius = def.radius; moth.speed = def.speed * (0.9 + random() * 0.2);
    moth.flap = random() * Math.PI * 2; moth.latched = false;
    moth.drainTimer = def.drainEvery; moth.zig = random() * Math.PI * 2;
  }
  function spawnAmbientMoth() {
    const moth = free(moths);
    if (moth === null) return;
    moth.active = true; moth.kind = KIND_FLUTTER; moth.hp = 1;
    moth.radius = MOTHS.flutter.radius; moth.speed = 24 + random() * 20;
    const fromLeft = random() < 0.5;
    moth.x = fromLeft ? -20 : FIELD.width + 20;
    moth.dir = fromLeft ? 1 : -1;
    moth.y = 80 + random() * 420;
    moth.flap = random() * Math.PI * 2; moth.latched = false; moth.zig = random() * Math.PI * 2;
  }
  function killMoth(moth) {
    moth.active = false;
    const def = moth.kind === KIND_DARTER ? MOTHS.darter : moth.kind === KIND_BRUTE ? MOTHS.brute : MOTHS.flutter;
    state.score += def.score;
    state.kills += 1;
    burst(moth.x, moth.y, moth.kind === KIND_BRUTE ? '#b388ff' : moth.kind === KIND_DARTER ? '#ffb347' : '#c9b8ff', moth.kind === KIND_BRUTE ? 14 : 8, 140);
    if (random() < EMBER.dropChance) {
      const ember = free(embers);
      if (ember !== null) {
        ember.active = true; ember.x = moth.x; ember.y = moth.y;
        ember.vx = (random() - 0.5) * 40; ember.vy = 20 + random() * 30; ember.life = EMBER.life;
      }
    }
  }
  function fireSpark(angle) {
    const spark = free(sparks);
    if (spark === null) return;
    spark.active = true;
    spark.x = player.x; spark.y = player.y;
    spark.vx = Math.cos(angle) * PLAYER.sparkSpeed;
    spark.vy = Math.sin(angle) * PLAYER.sparkSpeed;
    spark.life = PLAYER.sparkLife;
  }
  function reset() {
    player.x = FIELD.width / 2; player.y = 540;
    player.hearts = PLAYER.heartsMax; player.invulnerable = 0; player.fireTimer = 0;
    lantern.light = LANTERN.lightMax;
    upgrades.fireInterval = PLAYER.fireInterval; upgrades.projectiles = 1;
    upgrades.spread = 0.14; upgrades.magnetMul = 1; upgrades.heartsMax = PLAYER.heartsMax;
    for (const m of moths) m.active = false;
    for (const s of sparks) s.active = false;
    for (const e of embers) e.active = false;
    for (const p of particles) p.active = false;
    state.score = 0; state.kills = 0; state.overReason = ''; state.elapsed = 0;
    state.blessings = []; state.taken = {};
    startWave(1);
  }
  function mothsAlive() {
    let n = 0;
    for (const m of moths) if (m.active) n += 1;
    return n;
  }
  /**
   * One fixed step. `move` is a normalised vector, `aim` a field point, `firing` whether
   * sparks fly. With `harmless` set (the title screen's backdrop) moths drift by, nothing
   * scores and nothing can be hurt.
   */
  function step(dt, move, aim, firing, harmless) {
    let events = 0;
    state.time += dt;
    if (harmless) {
      state.ambientTimer -= dt;
      if (state.ambientTimer <= 0) { spawnAmbientMoth(); state.ambientTimer = 1.4; }
      for (const m of moths) {
        if (!m.active) continue;
        m.flap += dt * 9;
        m.x += m.dir * m.speed * dt;
        m.y += Math.sin(state.time * 1.5 + m.zig) * 14 * dt;
        if (m.x < -40 || m.x > FIELD.width + 40) m.active = false;
      }
      for (const p of particles) { if (p.active) { p.life -= dt; if (p.life <= 0) p.active = false; } }
      return events;
    }
    state.elapsed += dt;
    player.x = Math.min(FIELD.width - 24, Math.max(24, player.x + move.x * PLAYER.speed * dt));
    player.y = Math.min(FIELD.height - 24, Math.max(24, player.y + move.y * PLAYER.speed * dt));
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.fireTimer > 0) player.fireTimer -= dt;

    if (state.waveState === 'fighting') {
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          spawnMoth(state.spawnQueue.shift());
          state.spawnTimer = Math.max(0.3, 0.75 - state.wave * 0.05);
        }
      } else if (mothsAlive() === 0) {
        state.score += 50 * state.wave;
        events |= EVENT_WAVE;
        if (state.wave >= WAVES) { events |= EVENT_WIN; return events; }
        offerBlessings();
        return events;
      }
    }

    if (firing && player.fireTimer <= 0 && state.waveState === 'fighting') {
      let angle = Math.atan2(aim.y - player.y, aim.x - player.x);
      let bestMoth = null;
      let bestDiff = 0.3;
      for (const m of moths) {
        if (!m.active) continue;
        const a = Math.atan2(m.y - player.y, m.x - player.x);
        let diff = Math.abs(a - angle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        const dist = Math.hypot(m.x - player.x, m.y - player.y);
        if (diff < bestDiff && dist < 620) { bestDiff = diff; bestMoth = m; }
      }
      if (bestMoth !== null) angle = Math.atan2(bestMoth.y - player.y, bestMoth.x - player.x);
      const count = upgrades.projectiles;
      for (let i = 0; i < count; i += 1) {
        const offset = (i - (count - 1) / 2) * upgrades.spread;
        fireSpark(angle + offset);
      }
      player.fireTimer = upgrades.fireInterval;
    }

    for (const m of moths) {
      if (!m.active) continue;
      m.flap += dt * 10;
      if (m.latched) {
        const def = m.kind === KIND_DARTER ? MOTHS.darter : m.kind === KIND_BRUTE ? MOTHS.brute : MOTHS.flutter;
        m.drainTimer -= dt;
        if (m.drainTimer <= 0) {
          lantern.light -= def.drain;
          m.drainTimer = def.drainEvery;
          events |= EVENT_LATCH;
          burst(LANTERN.x, LANTERN.y, '#ff6b6b', 4, 60);
          if (lantern.light <= 0) {
            lantern.light = 0;
            state.overReason = 'lantern';
            events |= EVENT_OVER;
            return events;
          }
        }
        continue;
      }
      const dx = LANTERN.x - m.x;
      const dy = LANTERN.y - m.y;
      const dist = Math.hypot(dx, dy) || 1;
      let vx = (dx / dist) * m.speed;
      let vy = (dy / dist) * m.speed;
      if (m.kind === KIND_DARTER) {
        const perp = Math.sin(state.time * 4 + m.zig) * 55;
        vx += (-dy / dist) * perp;
        vy += (dx / dist) * perp;
      }
      m.x += vx * dt;
      m.y += vy * dt;
      if (dist < LANTERN.radius + m.radius * 0.5) {
        m.latched = true;
        m.latchAngle = Math.atan2(m.y - LANTERN.y, m.x - LANTERN.x);
        m.x = LANTERN.x + Math.cos(m.latchAngle) * (LANTERN.radius + m.radius * 0.4);
        m.y = LANTERN.y + Math.sin(m.latchAngle) * (LANTERN.radius + m.radius * 0.4);
        continue;
      }
      if (player.invulnerable === 0 && overlaps(m.x, m.y, m.radius, player.x, player.y, PLAYER.radius)) {
        m.active = false;
        burst(m.x, m.y, '#ff6b6b', 10, 160);
        player.hearts -= 1;
        player.invulnerable = PLAYER.invulnerable;
        events |= EVENT_HIT;
        if (player.hearts <= 0) {
          player.hearts = 0;
          state.overReason = 'keeper';
          events |= EVENT_OVER;
          return events;
        }
      }
    }

    for (const s of sparks) {
      if (!s.active) continue;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0 || s.x < -20 || s.x > FIELD.width + 20 || s.y < -20 || s.y > FIELD.height + 20) { s.active = false; continue; }
      for (const m of moths) {
        if (!m.active) continue;
        if (!overlaps(s.x, s.y, PLAYER.sparkRadius, m.x, m.y, m.radius)) continue;
        s.active = false;
        m.hp -= 1;
        burst(s.x, s.y, '#ffcf5c', 3, 80);
        if (m.hp <= 0) { killMoth(m); events |= EVENT_KILL; }
        break;
      }
    }

    for (const e of embers) {
      if (!e.active) continue;
      e.life -= dt;
      if (e.life <= 0) { e.active = false; continue; }
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < PLAYER.magnetRadius * upgrades.magnetMul) {
        const pull = 420 * (1 - dist / (PLAYER.magnetRadius * upgrades.magnetMul));
        e.vx += (dx / dist) * pull * dt * 4;
        e.vy += (dy / dist) * pull * dt * 4;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vx *= 0.96; e.vy *= 0.96;
      if (dist < PLAYER.pickupRadius + EMBER.radius) {
        e.active = false;
        state.score += EMBER.score;
        lantern.light = Math.min(LANTERN.lightMax, lantern.light + EMBER.light);
        burst(e.x, e.y, '#ffc53d', 6, 90);
        events |= EVENT_EMBER;
      }
    }

    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94; p.vy *= 0.94;
    }
    return events;
  }

  reset();
  return { state, reset, step, startWave, applyBlessing, mothsAlive, upgrades };
}
