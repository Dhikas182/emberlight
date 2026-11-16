// Every tuning number and colour for Emberlight, in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size.
export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const LANTERN = { x: 640, y: 360, radius: 26, lightMax: 12 };
export const PLAYER = {
  radius: 14,
  speed: 340,
  heartsMax: 3,
  invulnerable: 1.5,
  fireInterval: 0.22,
  sparkSpeed: 720,
  sparkLife: 0.72,
  sparkRadius: 5,
  pickupRadius: 26,
  magnetRadius: 110,
};
export const WAVES = 5;
export const BLESSING_PAUSE_SECONDS = 999; // blessings wait for a pick, not a timer
export const MOTHS = {
  flutter: { hp: 1, speed: 55, radius: 15, score: 10, drainEvery: 0.9, drain: 1 },
  darter: { hp: 1, speed: 112, radius: 12, score: 20, drainEvery: 0.9, drain: 1 },
  brute: { hp: 3, speed: 34, radius: 22, score: 30, drainEvery: 0.6, drain: 1 },
};
export const EMBER = { dropChance: 0.5, score: 5, light: 1, radius: 9, life: 9 };
export const POOL_MOTHS = 48;
export const POOL_SPARKS = 96;
export const POOL_EMBERS = 32;
export const POOL_PARTICLES = 160;
export const PALETTE = {
  backdrop: '#0b1026',
  skyTop: '#131a3d',
  skyBottom: '#1d2b4a',
  hillFar: '#16213d',
  hillNear: '#101a33',
  ground: '#0d1530',
  lanternGlow: '#ffb347',
  lanternCore: '#ffd97a',
  keeper: '#4fd1c5',
  keeperDark: '#2a9d8f',
  spark: '#ffcf5c',
  ember: '#ffc53d',
  flutter: '#c9b8ff',
  darter: '#ffb347',
  brute: '#b388ff',
  panel: 'rgba(13, 20, 44, 0.88)',
  panelEdge: '#4fd1c5',
  text: '#f2f0ff',
  muted: '#9aa5c7',
  danger: '#ff6b6b',
  dawnTop: '#2b1e4f',
  dawnBottom: '#ff9e5e',
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberlight.best';
