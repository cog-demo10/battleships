export const AVATARS = ['01', '02', '03', '04', '05', '06'];
export const DEFAULT_AVATAR = '01';
export const avatarSrc = (id) => `./assets/avatars/${id}.png`;
const AVATAR_KEY = 'battleships.avatar';
const BEST_KEY = 'battleships.best';

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked: in-memory only */
  }
}

export function loadAvatar() {
  const v = read(AVATAR_KEY);
  return AVATARS.includes(v) ? v : DEFAULT_AVATAR;
}

export function saveAvatar(id) {
  if (AVATARS.includes(id)) write(AVATAR_KEY, id);
}

/** @returns {Record<string, {shots:number, accuracy:number}>} keyed by level */
export function loadBests() {
  try {
    const p = JSON.parse(read(BEST_KEY) || '{}');
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

/** Player wins only; best = fewest shots. Returns the (possibly updated) bests. */
export function recordBest(bests, level, stats, winner) {
  if (winner !== 'player' || !level) return bests;
  const merged = { ...bests, ...loadBests() };
  const cur = merged[level];
  if (cur && cur.shots <= stats.shots) return merged;
  const next = { ...merged, [level]: { shots: stats.shots, accuracy: stats.accuracy } };
  write(BEST_KEY, JSON.stringify(next));
  return next;
}
