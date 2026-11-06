export interface SavedGame {
  answer: string;
  day: number;
  guesses: string[];
  done: boolean;
}

export interface Stats {
  played: number;
  wins: number;
  streak: number;
  maxStreak: number;
  dist: number[];
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: game still works, just not saved */
  }
}

const gameKey = (mode: string, len: number) => `letterlock:game:${mode}:${len}`;
const statsKey = (len: number) => `letterlock:stats:${len}`;

export const loadGame = (mode: string, len: number) => read<SavedGame>(gameKey(mode, len));
export const saveGame = (mode: string, len: number, g: SavedGame) => write(gameKey(mode, len), g);

export function loadStats(len: number): Stats {
  const s = read<Stats>(statsKey(len));
  const dist = Array(len + 1).fill(0);
  if (!s) return { played: 0, wins: 0, streak: 0, maxStreak: 0, dist };
  s.dist.forEach((n, i) => (dist[i] = n));
  return { ...s, dist };
}

export function recordResult(len: number, won: boolean, guessCount: number): Stats {
  const s = loadStats(len);
  s.played++;
  if (won) {
    s.wins++;
    s.streak++;
    s.maxStreak = Math.max(s.maxStreak, s.streak);
    s.dist[guessCount - 1]++;
  } else {
    s.streak = 0;
  }
  write(statsKey(len), s);
  return s;
}

export const loadPref = (k: string) => read<string>(`letterlock:pref:${k}`);
export const savePref = (k: string, v: string) => write(`letterlock:pref:${k}`, v);
