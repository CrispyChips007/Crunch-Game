const GAME_KEY = "crunch.game.v1";
const STATS_KEY = "crunch.stats.v1";
const PREFS_KEY = "crunch.prefs.v1";

export const DEFAULT_STATS = Object.freeze({ version: 1, completed: 0, won: 0, lost: 0, abandoned: 0, highestBank: 0, fewestTurns: null, crunches: 0 });
export const DEFAULT_PREFS = Object.freeze({ scoringHelp: false, introSeen: false });

export function checksum(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}

export function encode(value) {
  const payload = JSON.stringify(value);
  return JSON.stringify({ payload, checksum: checksum(payload) });
}

export function decode(raw, fallback) {
  try {
    const wrapper = JSON.parse(raw);
    if (checksum(wrapper.payload) !== wrapper.checksum) return structuredClone(fallback);
    const parsed = JSON.parse(wrapper.payload);
    return fallback && typeof fallback === "object" ? { ...structuredClone(fallback), ...parsed } : parsed;
  } catch { return structuredClone(fallback); }
}

export function loadStats(storage = localStorage) { return decode(storage.getItem(STATS_KEY), DEFAULT_STATS); }
export function saveStats(stats, storage = localStorage) { storage.setItem(STATS_KEY, encode(stats)); }
export function loadPrefs(storage = localStorage) { return decode(storage.getItem(PREFS_KEY), DEFAULT_PREFS); }
export function savePrefs(prefs, storage = localStorage) { storage.setItem(PREFS_KEY, encode(prefs)); }
export function saveGame(game, storage = localStorage) { storage.setItem(GAME_KEY, encode(game)); }
export function loadGame(storage = localStorage) { return decode(storage.getItem(GAME_KEY), null); }
export function clearGame(storage = localStorage) { storage.removeItem(GAME_KEY); }

export function recordCrunch(stats) { return { ...stats, crunches: stats.crunches + 1 }; }
export function recordBank(stats, points) { return { ...stats, highestBank: Math.max(stats.highestBank, points) }; }
export function recordWin(stats, turns) {
  return { ...stats, completed: stats.completed + 1, won: stats.won + 1, fewestTurns: stats.fewestTurns === null ? turns : Math.min(stats.fewestTurns, turns) };
}
