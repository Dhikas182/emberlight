// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, blessing, paused, win and over.
//
// ?seed=N fixes the moth pattern. ?shot=start|play|win|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { BEST_KEY, STEP, WAVES } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_EMBER, EVENT_HIT, EVENT_KILL, EVENT_LATCH, EVENT_OVER, EVENT_WAVE, EVENT_WIN } from './world.js';
import {
  ACTION_BLESS_1, ACTION_BLESS_2, ACTION_BLESS_3, ACTION_CONFIRM, ACTION_MUTE,
  ACTION_PAUSE, ACTION_RESTART, createInput,
} from './input.js';
import { blessingRects, createRenderer, SCREEN_BLESSING, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);
input.setView(renderer.view);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}
function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      window.__emberlight = { screen: scene.screen, score: world.state.score, wave: world.state.wave };
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }
  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.wave();
    announce(`Playing. Wave 1 of ${WAVES}. Keep the lantern lit.`);
  }
  function endGame(won) {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      screen = SCREEN_WIN;
      audio.win();
      announce(`Dawn breaks. You win. Score ${world.state.score}. Best ${best}.`);
    } else {
      screen = SCREEN_OVER;
      audio.lose();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }
  function chooseBlessing(index) {
    if (world.applyBlessing(index)) {
      audio.bless();
      screen = SCREEN_PLAY;
      announce(`Wave ${world.state.wave} of ${WAVES}.`);
    }
  }
  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_BLESSING) {
      if (actions & ACTION_BLESS_1) chooseBlessing(0);
      else if (actions & ACTION_BLESS_2) chooseBlessing(1);
      else if (actions & ACTION_BLESS_3) chooseBlessing(2);
      else {
        const click = input.takeClick();
        if (click) {
          const rects = blessingRects();
          for (let i = 0; i < rects.length; i += 1) {
            const r = rects[i];
            if (click.x >= r.x && click.x <= r.x + r.width && click.y >= r.y && click.y <= r.y + r.height) {
              chooseBlessing(i);
              break;
            }
          }
        }
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) { screen = SCREEN_PLAY; announce('Playing.'); }
      return;
    }
    if (screen === SCREEN_WIN || screen === SCREEN_OVER) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) startGame();
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  }
  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, { x: 640, y: 300 }, false, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, input.move(), input.mouse(), input.firing(), false);
    if (events & EVENT_KILL) audio.pop();
    if (events & EVENT_EMBER) audio.ember();
    if (events & EVENT_LATCH) audio.latch();
    if (events & EVENT_HIT) {
      audio.hurt();
      announce(world.state.player.hearts === 1 ? 'Hit. 1 heart left.' : `Hit. ${world.state.player.hearts} hearts left.`);
    }
    if (events & EVENT_WAVE) {
      audio.wave();
      announce(`Wave ${world.state.wave} cleared. Choose a blessing.`);
    }
    if (world.state.waveState === 'blessing' && screen === SCREEN_PLAY) {
      // Drop any click queued while firing, or it would pick a blessing the
      // instant this screen appears, before the player has seen the cards.
      input.takeClick();
      screen = SCREEN_BLESSING;
    }
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, input.mouse());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A read-only handle for play-testing: the live screen, score, wave and state.
  window.__emberlight = {
    get screen() { return screen; },
    get score() { return world.state.score; },
    get wave() { return world.state.wave; },
    get waveState() { return world.state.waveState; },
    state: world.state,
  };
  announce('Emberlight. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
