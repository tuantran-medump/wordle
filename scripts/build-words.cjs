// Generates src/words/answers-N.txt and guesses-N.txt for N = 5..8.
// Run from a folder where `wordlist-english` and `an-array-of-english-words`
// are installed:  node scripts/build-words.cjs <node_modules dir>
const path = require('path');
const fs = require('fs');
const nm = process.argv[2] || 'node_modules';
const wl = require(path.resolve(nm, 'wordlist-english'));
const big = require(path.resolve(nm, 'an-array-of-english-words'));

const ok = (w) => /^[a-z]+$/.test(w);
const common = new Set([...wl['english/10'], ...wl['english/20']].filter(ok));
const all = new Set([...big, ...wl['english'], ...common].filter(ok));

// Drop simple inflections (plurals, past tense) from answers so they feel fair.
function isInflection(w) {
  if (w.endsWith('s') && !w.endsWith('ss') && all.has(w.slice(0, -1))) return true;
  if (w.endsWith('es') && all.has(w.slice(0, -2))) return true;
  if (w.endsWith('ed') && (all.has(w.slice(0, -2)) || all.has(w.slice(0, -1)))) return true;
  if (w.endsWith('ied') && all.has(w.slice(0, -3) + 'y')) return true;
  if (w.endsWith('ier') && all.has(w.slice(0, -3) + 'y')) return true;
  if (w.endsWith('ing')) {
    const stem = w.slice(0, -3);
    if (all.has(stem) || all.has(stem + 'e') || (stem.at(-1) === stem.at(-2) && all.has(stem.slice(0, -1)))) return true;
  }
  return false;
}

const out = path.join(__dirname, '..', 'src', 'words');
for (const L of [5, 6, 7, 8]) {
  const answers = [...common].filter((w) => w.length === L && !isInflection(w)).sort();
  const guesses = [...all].filter((w) => w.length === L).sort();
  fs.writeFileSync(path.join(out, `answers-${L}.txt`), answers.join('\n') + '\n');
  fs.writeFileSync(path.join(out, `guesses-${L}.txt`), guesses.join('\n') + '\n');
  console.log(L, answers.length, 'answers', guesses.length, 'guesses');
}
