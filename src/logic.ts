export type Mark = 'correct' | 'present' | 'absent';

export const LENGTHS = [5, 6, 7, 8] as const;
export type WordLength = (typeof LENGTHS)[number];

/** Number of guesses allowed for a word length. */
export const maxGuesses = (len: number) => len + 1;

/**
 * Colour a guess against the answer. Letters in the right spot are
 * "correct"; letters elsewhere in the answer are "present", but only as many
 * times as they still appear in the answer after exact matches are counted.
 */
export function scoreGuess(guess: string, answer: string): Mark[] {
  if (guess.length !== answer.length) throw new Error('Length mismatch');
  const marks: Mark[] = Array(guess.length).fill('absent');
  const left = new Map<string, number>();
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = 'correct';
    else left.set(answer[i], (left.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === 'correct') continue;
    const n = left.get(guess[i]) ?? 0;
    if (n > 0) {
      marks[i] = 'present';
      left.set(guess[i], n - 1);
    }
  }
  return marks;
}

const rank: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };

/** Best known mark per letter, for colouring the on-screen keyboard. */
export function keyboardMarks(guesses: string[], answer: string): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  for (const g of guesses) {
    scoreGuess(g, answer).forEach((m, i) => {
      const prev = out[g[i]];
      if (!prev || rank[m] > rank[prev]) out[g[i]] = m;
    });
  }
  return out;
}

/** Days since 2026-01-01 in the player's local time zone. */
export function dayNumber(date = new Date()): number {
  const start = new Date(2026, 0, 1);
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((today.getTime() - start.getTime()) / 86_400_000);
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable shuffled order of the answers so the daily word is not alphabetical. */
export function shuffled<T>(items: readonly T[], seed: number): T[] {
  const a = [...items];
  const rand = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The daily answer: everyone gets the same word for a given day and length. */
export function dailyAnswer(answers: readonly string[], len: number, day = dayNumber()): string {
  const order = shuffled(answers, 1000 + len);
  return order[((day % order.length) + order.length) % order.length];
}

export function randomAnswer(answers: readonly string[]): string {
  return answers[Math.floor(Math.random() * answers.length)];
}
