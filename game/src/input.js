// Keyboard and pointer input. Held keys give a movement vector and a firing state; one-shot
// presses (start, restart, pause, mute, blessing picks) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost and never counted twice.
// The mouse position is tracked in playfield coordinates by the renderer scale the caller
// supplies each frame through setView().
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;
export const ACTION_BLESS_1 = 16;
export const ACTION_BLESS_2 = 32;
export const ACTION_BLESS_3 = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let firing = false;
  let mouseX = 640;
  let mouseY = 300;
  let mouseIn = false;
  let clicked = false;
  let clickX = 0;
  let clickY = 0;
  // Playfield transform: set by main.js every frame so mouse pixels map to field units.
  let view = { scale: 1, x: 0, y: 0, ratio: 1 };

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (RESTART.has(event.code)) { if (!event.repeat) actions |= ACTION_RESTART; }
    else if (MUTE.has(event.code)) { if (!event.repeat) actions |= ACTION_MUTE; }
    else if (event.code === 'Digit1' || event.code === 'Numpad1') { if (!event.repeat) actions |= ACTION_BLESS_1; }
    else if (event.code === 'Digit2' || event.code === 'Numpad2') { if (!event.repeat) actions |= ACTION_BLESS_2; }
    else if (event.code === 'Digit3' || event.code === 'Numpad3') { if (!event.repeat) actions |= ACTION_BLESS_3; }
    else return;
    if (event.code === 'Space') firing = true;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
    else if (event.code === 'Space') firing = false;
  });
  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = false;
    firing = false;
  });
  function toField(clientX, clientY) {
    return {
      x: (clientX * view.ratio - view.x) / view.scale,
      y: (clientY * view.ratio - view.y) / view.scale,
    };
  }
  canvas.addEventListener('pointermove', (event) => {
    const p = toField(event.clientX, event.clientY);
    mouseX = p.x; mouseY = p.y; mouseIn = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const p = toField(event.clientX, event.clientY);
    mouseX = p.x; mouseY = p.y; mouseIn = true;
    firing = true;
    clicked = true; clickX = p.x; clickY = p.y;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { firing = false; });

  return {
    setView(next) { view = next; },
    /** Normalised -1..1 movement vector from the held keys. */
    move() {
      const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    firing() { return firing; },
    mouse() { return { x: mouseX, y: mouseY, inside: mouseIn }; },
    /** The last pointer click in field coordinates, taken once. */
    takeClick() {
      if (!clicked) return null;
      clicked = false;
      return { x: clickX, y: clickY };
    },
    takeActions() { const taken = actions; actions = 0; return taken; },
  };
}
