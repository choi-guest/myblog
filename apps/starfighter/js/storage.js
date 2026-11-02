// localStorage 읽기/쓰기. 모두 try/catch로 감싸고 실패하면 기본값으로 진행한다.

const KEYS = {
  best: 'starfighter:best',
  unlocked: 'starfighter:unlocked',
  weapon: 'starfighter:weapon',
  settings: 'starfighter:settings'
};

const WEAPONS = ['burst', 'homing', 'drone'];

function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadBest() {
  const n = Number.parseInt(read(KEYS.best) || '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function saveBest(n) {
  write(KEYS.best, Math.max(0, Math.floor(n)));
}

export function loadUnlocked() {
  const n = Number.parseInt(read(KEYS.unlocked) || '1', 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(10, Math.max(1, n));
}

export function saveUnlocked(n) {
  write(KEYS.unlocked, Math.min(10, Math.max(1, n)));
}

export function loadWeapon() {
  const w = read(KEYS.weapon);
  return WEAPONS.includes(w) ? w : 'burst';
}

export function saveWeapon(w) {
  if (WEAPONS.includes(w)) write(KEYS.weapon, w);
}

export function loadSettings() {
  const def = { sound: false, autoFire: false };
  const raw = read(KEYS.settings);
  if (!raw) return def;
  try {
    const v = JSON.parse(raw);
    return { sound: v.sound === true, autoFire: v.autoFire === true };
  } catch (err) {
    return def;
  }
}

export function saveSettings(settings) {
  write(KEYS.settings, JSON.stringify({ sound: !!settings.sound, autoFire: !!settings.autoFire }));
}
