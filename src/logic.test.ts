import { describe, expect, it } from 'vitest';
import { dailyAnswer, dayNumber, keyboardMarks, scoreGuess, shuffled } from './logic';

const s = (g: string, a: string) => scoreGuess(g, a).map((m) => m[0]).join('');

describe('scoreGuess', () => {
  it('marks exact, misplaced and missing letters', () => {
    expect(s('crane', 'cater')).toBe('cppap');
    expect(s('stone', 'stone')).toBe('ccccc');
    expect(s('abcde', 'fghij')).toBe('aaaaa');
    expect(s('heart', 'earth')).toBe('ppppp');
  });

  it('does not over-count repeated letters', () => {
    expect(s('llama', 'pilot')).toBe('paaaa');
    expect(s('eerie', 'there')).toBe('papac');
    expect(s('speed', 'abide')).toBe('aapap');
    expect(s('sassy', 'class')).toBe('ppaca');
    expect(s('letter', 'better')).toBe('accccc');
  });

  it('rejects mismatched lengths', () => {
    expect(() => scoreGuess('abc', 'abcd')).toThrow();
  });
});

describe('keyboardMarks', () => {
  it('keeps the best mark seen for each letter', () => {
    const k = keyboardMarks(['heart', 'earth'], 'earth');
    expect(k.e).toBe('correct');
    expect(k.h).toBe('correct');
  });
});

describe('daily answer', () => {
  const words = ['apple', 'beach', 'cloud', 'drink', 'eagle'];
  it('is stable for a day and changes over days', () => {
    expect(dailyAnswer(words, 5, 10)).toBe(dailyAnswer(words, 5, 10));
    const seen = new Set(Array.from({ length: 5 }, (_, d) => dailyAnswer(words, 5, d)));
    expect(seen.size).toBe(5);
  });
  it('shuffle keeps every item', () => {
    expect([...shuffled(words, 3)].sort()).toEqual(words);
  });
  it('counts days from 2026-01-01', () => {
    expect(dayNumber(new Date(2026, 0, 1, 15))).toBe(0);
    expect(dayNumber(new Date(2026, 0, 31))).toBe(30);
  });
});
