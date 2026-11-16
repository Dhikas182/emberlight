// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Canvas shapes and text only — no image or font files, so the game loads nothing.
import { FIELD, FONT, LANTERN, PALETTE, PLAYER, WAVES } from './config.js';
import { KIND_BRUTE, KIND_DARTER } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_BLESSING = 'blessing';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const CARD = { width: 300, height: 190, gap: 36, top: 300 };
export function blessingRects() {
  const total = CARD.width * 3 + CARD.gap * 2;
  const first = (FIELD.width - total) / 2;
  return [0, 1, 2].map((i) => ({
    x: first + i * (CARD.width + CARD.gap), y: CARD.top,
    width: CARD.width, height: CARD.height,
  }));
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, ratio: 1 };
  const fonts = new Map();
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
    view.ratio = ratio;
  }
  function text(value, x, y, size, color, align, weight) {
    const key = size + (weight || '');
    if (!fonts.has(key)) fonts.set(key, `${weight ? weight + ' ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }
  function drawSky(state, dawn) {
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    if (dawn) { grad.addColorStop(0, PALETTE.dawnTop); grad.addColorStop(1, PALETTE.dawnBottom); }
    else { grad.addColorStop(0, PALETTE.skyTop); grad.addColorStop(1, PALETTE.skyBottom); }
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    if (!dawn) {
      for (const star of state.stars) {
        const a = 0.25 + 0.55 * Math.abs(Math.sin(state.time * 0.8 + star.phase));
        context.globalAlpha = a;
        context.fillStyle = '#dfe6ff';
        context.beginPath();
        context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    }
    context.fillStyle = PALETTE.hillFar;
    context.beginPath();
    context.moveTo(0, 560);
    for (let x = 0; x <= FIELD.width; x += 80) context.lineTo(x, 540 + Math.sin(x * 0.008 + 1.2) * 26);
    context.lineTo(FIELD.width, FIELD.height);
    context.lineTo(0, FIELD.height);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.hillNear;
    context.beginPath();
    context.moveTo(0, 620);
    for (let x = 0; x <= FIELD.width; x += 80) context.lineTo(x, 610 + Math.sin(x * 0.011 + 4.0) * 18);
    context.lineTo(FIELD.width, FIELD.height);
    context.lineTo(0, FIELD.height);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.ground;
    context.fillRect(0, 664, FIELD.width, FIELD.height - 664);
  }
  function drawFireflies(state) {
    for (const f of state.fireflies) {
      const x = f.x + Math.sin(state.time * f.speed + f.phase) * 26;
      const y = f.y + Math.cos(state.time * f.speed * 0.8 + f.phase) * 14;
      const a = 0.25 + 0.45 * Math.abs(Math.sin(state.time * 1.4 + f.phase));
      context.globalAlpha = a;
      context.fillStyle = '#b8f5c8';
      context.beginPath();
      context.arc(x, y, 2.4, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }
  function drawLantern(state) {
    const light = state.lantern.light;
    const glowR = 70 + light * 12 + Math.sin(state.time * 3.1) * 5;
    const glow = context.createRadialGradient(LANTERN.x, LANTERN.y, 10, LANTERN.x, LANTERN.y, glowR);
    const alpha = 0.1 + (light / 12) * 0.34;
    glow.addColorStop(0, `rgba(255, 179, 71, ${alpha})`);
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    context.fillStyle = glow;
    context.fillRect(LANTERN.x - glowR, LANTERN.y - glowR, glowR * 2, glowR * 2);
    context.fillStyle = '#3a3f55';
    context.fillRect(LANTERN.x - 22, LANTERN.y + 8, 44, 26);
    context.fillStyle = '#565e7a';
    context.fillRect(LANTERN.x - 26, LANTERN.y + 30, 52, 8);
    context.fillStyle = '#20263d';
    context.fillRect(LANTERN.x - 18, LANTERN.y - 34, 36, 10);
    const flicker = 1 + Math.sin(state.time * 7) * 0.08 + Math.sin(state.time * 13.7) * 0.05;
    const flameH = (light > 0 ? 20 : 6) * flicker;
    context.fillStyle = PALETTE.lanternCore;
    context.beginPath();
    context.moveTo(LANTERN.x, LANTERN.y - 26 - flameH);
    context.quadraticCurveTo(LANTERN.x + 11, LANTERN.y - 12, LANTERN.x, LANTERN.y + 6);
    context.quadraticCurveTo(LANTERN.x - 11, LANTERN.y - 12, LANTERN.x, LANTERN.y - 26 - flameH);
    context.fill();
    context.fillStyle = '#ffe9ad';
    context.beginPath();
    context.arc(LANTERN.x, LANTERN.y - 8, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255, 217, 122, 0.5)';
    context.lineWidth = 2;
    context.strokeRect(LANTERN.x - 18, LANTERN.y - 26, 36, 36);
  }
  function drawMoth(m) {
    const color = m.kind === KIND_BRUTE ? PALETTE.brute : m.kind === KIND_DARTER ? PALETTE.darter : PALETTE.flutter;
    const flap = Math.sin(m.flap) * 0.9;
    context.save();
    context.translate(m.x, m.y);
    context.rotate(m.latched ? m.latchAngle + Math.PI / 2 : 0);
    context.fillStyle = color;
    for (const side of [-1, 1]) {
      context.save();
      context.rotate(side * (0.5 + flap * 0.45));
      context.beginPath();
      context.ellipse(side * m.radius * 0.85, 0, m.radius * 0.95, m.radius * 0.5, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    context.fillStyle = '#241f38';
    context.beginPath();
    context.ellipse(0, 0, m.radius * 0.32, m.radius * 0.62, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ff5d5d';
    context.beginPath();
    context.arc(-m.radius * 0.1, -m.radius * 0.28, 1.8, 0, Math.PI * 2);
    context.arc(m.radius * 0.1, -m.radius * 0.28, 1.8, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  function drawPlayer(state, aim) {
    const p = state.player;
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0) return;
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.beginPath();
    context.ellipse(p.x, p.y + PLAYER.radius + 4, PLAYER.radius, 5, 0, 0, Math.PI * 2);
    context.fill();
    if (aim) {
      context.strokeStyle = 'rgba(255, 207, 92, 0.35)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(p.x, p.y);
      context.lineTo(p.x + (aim.x - p.x) * 0.12, p.y + (aim.y - p.y) * 0.12);
      context.stroke();
    }
    context.fillStyle = PALETTE.keeper;
    context.beginPath();
    context.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.keeperDark;
    context.beginPath();
    context.arc(p.x, p.y - 3, PLAYER.radius * 0.62, Math.PI, 0);
    context.fill();
    context.fillStyle = '#ffe9ad';
    context.beginPath();
    context.arc(p.x, p.y - 1, 3.4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.lanternGlow;
    context.beginPath();
    context.arc(p.x + PLAYER.radius * 0.7, p.y + 4, 3, 0, Math.PI * 2);
    context.fill();
  }
  function drawField(state, aim) {
    drawSky(state, false);
    drawFireflies(state);
    drawLantern(state);
    for (const e of state.embers) {
      if (!e.active) continue;
      const blink = e.life < 2 ? (Math.floor(e.life * 6) % 2 === 0 ? 1 : 0.35) : 1;
      context.globalAlpha = blink;
      context.save();
      context.translate(e.x, e.y);
      context.rotate(state.time * 2);
      context.fillStyle = PALETTE.ember;
      context.fillRect(-6, -6, 12, 12);
      context.fillStyle = '#fff3c4';
      context.fillRect(-3, -3, 6, 6);
      context.restore();
    }
    context.globalAlpha = 1;
    for (const m of state.moths) if (m.active) drawMoth(m);
    for (const s of state.sparks) {
      if (!s.active) continue;
      context.fillStyle = PALETTE.spark;
      context.beginPath();
      context.arc(s.x, s.y, PLAYER.sparkRadius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255, 207, 92, 0.4)';
      context.beginPath();
      context.arc(s.x - s.vx * 0.012, s.y - s.vy * 0.012, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.max);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    drawPlayer(state, aim);
  }
  function drawHud(state) {
    context.textBaseline = 'top';
    text(`SCORE ${state.score}`, 24, 18, 26, PALETTE.text, 'left', '700');
    let alive = 0;
    for (const m of state.moths) if (m.active) alive += 1;
    const left = state.spawnQueue.length + alive;
    const waveText = state.waveState === 'blessing' ? `WAVE ${state.wave} CLEARED` : `WAVE ${state.wave} / ${WAVES}  ·  ${left} MOTHS LEFT`;
    text(waveText, FIELD.width / 2, 18, 26, PALETTE.text, 'center', '700');
    const label = 'LIGHT';
    text(label, FIELD.width - 24, 18, 26, PALETTE.text, 'right', '700');
    const pipW = 16;
    const totalW = LANTERN.lightMax * (pipW + 4);
    for (let i = 0; i < LANTERN.lightMax; i += 1) {
      context.fillStyle = i < state.lantern.light ? PALETTE.lanternGlow : 'rgba(255,255,255,0.14)';
      const x = FIELD.width - 24 - totalW + i * (pipW + 4);
      context.beginPath();
      context.moveTo(x + pipW / 2, 52);
      context.quadraticCurveTo(x + pipW, 62, x + pipW / 2, 72);
      context.quadraticCurveTo(x, 62, x + pipW / 2, 52);
      context.fill();
    }
    for (let i = 0; i < state.player.hearts; i += 1) {
      context.fillStyle = '#ff6b81';
      const x = FIELD.width - 24 - (i + 1) * 26;
      context.beginPath();
      context.arc(x - 5, 92, 6, 0, Math.PI * 2);
      context.arc(x + 5, 92, 6, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(x - 11, 94);
      context.lineTo(x + 11, 94);
      context.lineTo(x, 106);
      context.closePath();
      context.fill();
    }
    text('WASD / arrows move · mouse aim · hold click / Space to shoot · P pause · M sound', 24, FIELD.height - 30, 16, PALETTE.muted, 'left');
  }
  function drawPanel(title, lines, prompt) {
    const width = 920;
    const height = 150 + lines.length * 34;
    const x = (FIELD.width - width) / 2;
    const y = 120;
    context.fillStyle = 'rgba(5, 8, 20, 0.45)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundedRect(context, x, y, width, height, 18);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundedRect(context, x, y, width, height, 18);
    context.stroke();
    context.textBaseline = 'top';
    text(title, FIELD.width / 2, y + 26, 46, PALETTE.text, 'center', '800');
    lines.forEach((line, i) => {
      text(line.text, FIELD.width / 2, y + 92 + i * 34, line.size || 21, line.color || PALETTE.muted, 'center');
    });
    if (prompt) text(prompt, FIELD.width / 2, y + height - 44, 22, PALETTE.lanternGlow, 'center', '700');
  }
  function drawBlessings(state) {
    context.textBaseline = 'top';
    text(`WAVE ${state.wave} CLEARED  ·  SCORE ${state.score}`, FIELD.width / 2, 150, 30, PALETTE.text, 'center', '800');
    text('Dawn is closer. Choose a blessing — click a card or press 1, 2 or 3.', FIELD.width / 2, 196, 21, PALETTE.muted, 'center');
    const rects = blessingRects();
    state.blessings.forEach((b, i) => {
      const r = rects[i];
      context.fillStyle = PALETTE.panel;
      roundedRect(context, r.x, r.y, r.width, r.height, 16);
      context.fill();
      context.strokeStyle = PALETTE.panelEdge;
      context.lineWidth = 2;
      roundedRect(context, r.x, r.y, r.width, r.height, 16);
      context.stroke();
      text(`${i + 1}`, r.x + 18, r.y + 14, 20, PALETTE.muted, 'left', '700');
      text(b.name, r.x + r.width / 2, r.y + 52, 26, PALETTE.text, 'center', '800');
      const words = b.desc.split(' ');
      let line = '';
      let ly = r.y + 104;
      for (const word of words) {
        if ((line + ' ' + word).trim().length > 20) { text(line.trim(), r.x + r.width / 2, ly, 19, PALETTE.muted, 'center'); ly += 26; line = word; }
        else line += ' ' + word;
      }
      if (line.trim()) text(line.trim(), r.x + r.width / 2, ly, 19, PALETTE.muted, 'center');
    });
  }

  return {
    view,
    resize,
    draw(state, screen, best, aim) {
      resize();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = PALETTE.backdrop;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      context.textBaseline = 'top';
      if (screen === SCREEN_WIN) {
        drawSky(state, true);
        drawFireflies(state);
        drawLantern(state);
        drawPanel('DAWN BREAKS — YOU WIN', [
          { text: `The lantern survived all ${WAVES} waves. The garden wakes in sunlight.`, size: 21 },
          { text: `Score ${state.score}   ·   Moths banished ${state.kills}   ·   Best ${best}`, size: 21, color: PALETTE.text },
        ], 'Press R or Enter to play again');
        return;
      }
      drawField(state, screen === SCREEN_PLAY ? aim : null);
      if (screen === SCREEN_TITLE) {
        drawPanel('EMBERLIGHT', [
          { text: 'Keep the last lantern lit until dawn.', size: 22, color: PALETTE.text },
          { text: `Gloom-moths swarm the lantern. Shoot them, gather embers, survive ${WAVES} waves.`, size: 20 },
          { text: 'A moth latched to the lantern drains its light. An ember restores 1 light.', size: 20 },
          { text: 'WASD / arrows move  ·  mouse aims  ·  hold click or Space to shoot', size: 20 },
        ], best > 0 ? `Best ${best}  ·  Press Enter or click to start` : 'Press Enter or click to start');
      } else if (screen === SCREEN_BLESSING) {
        drawHud(state);
        drawBlessings(state);
      } else if (screen === SCREEN_PAUSED) {
        drawHud(state);
        drawPanel('PAUSED', [
          { text: `Wave ${state.wave} of ${WAVES}  ·  Score ${state.score}`, size: 21, color: PALETTE.text },
        ], 'Press P or Enter to keep playing');
      } else if (screen === SCREEN_OVER) {
        drawHud(state);
        const title = state.overReason === 'lantern' ? 'THE LIGHT IS OUT' : 'THE KEEPER FALLS';
        const sub = state.overReason === 'lantern'
          ? 'The moths drank the last of the lantern light.'
          : 'The keeper was overwhelmed by the swarm.';
        drawPanel(title, [
          { text: sub, size: 21, color: PALETTE.text },
          { text: `Score ${state.score}   ·   Wave ${state.wave} of ${WAVES}   ·   Moths banished ${state.kills}   ·   Best ${best}`, size: 20 },
        ], 'Press R or Enter to try again');
      } else {
        drawHud(state);
      }
    },
  };
}
