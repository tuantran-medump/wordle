import './style.css';
import {
  LENGTHS,
  type Mark,
  dailyAnswer,
  dayNumber,
  keyboardMarks,
  maxGuesses,
  randomAnswer,
  scoreGuess,
} from './logic';
import { type SavedGame, loadGame, loadPref, loadStats, recordResult, saveGame, savePref } from './storage';

type Mode = 'daily' | 'free';

const wordFiles = import.meta.glob('./words/*.txt', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>;
const cache = new Map<number, { answers: string[]; guesses: Set<string> }>();

async function loadWords(len: number) {
  let w = cache.get(len);
  if (!w) {
    const [a, g] = await Promise.all([
      wordFiles[`./words/answers-${len}.txt`](),
      wordFiles[`./words/guesses-${len}.txt`](),
    ]);
    const answers = a.split('\n').filter(Boolean);
    w = { answers, guesses: new Set([...g.split('\n').filter(Boolean), ...answers]) };
    cache.set(len, w);
  }
  return w;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const board = $('#board');
const keyboard = $('#keyboard');

let mode: Mode = loadPref('mode') === 'free' ? 'free' : 'daily';
let len = Number(loadPref('len')) || 5;
if (!LENGTHS.includes(len as never)) len = 5;

let game: SavedGame = { answer: '', day: 0, guesses: [], done: false };
let current = '';
let busy = false;

/* ---------- theme ---------- */
function applyTheme(t: string | null) {
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
applyTheme(loadPref('theme'));
$('#theme-btn').addEventListener('click', () => {
  const dark =
    document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const next = dark ? 'light' : 'dark';
  applyTheme(next);
  savePref('theme', next);
});

/* ---------- toasts ---------- */
function toast(msg: string, ms = 1600) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toasts').prepend(el);
  if (ms > 0) setTimeout(() => el.remove(), ms);
}

/* ---------- game setup ---------- */
async function startGame(fresh = false) {
  const { answers } = await loadWords(len);
  const today = dayNumber();
  const saved = loadGame(mode, len);
  if (mode === 'daily') {
    game =
      saved && saved.day === today
        ? saved
        : { answer: dailyAnswer(answers, len, today), day: today, guesses: [], done: false };
  } else {
    game =
      saved && !fresh && !saved.done
        ? saved
        : { answer: randomAnswer(answers), day: today, guesses: [], done: false };
  }
  saveGame(mode, len, game);
  current = '';
  document.documentElement.style.setProperty('--len', String(len));
  renderControls();
  renderBoard();
  renderKeyboard();
  fitBoard();
}

/* ---------- rendering ---------- */
function renderControls() {
  document.querySelectorAll<HTMLButtonElement>('#mode-seg button').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.mode === mode)),
  );
  document.querySelectorAll<HTMLButtonElement>('#len-seg button').forEach((b) =>
    b.setAttribute('aria-checked', String(Number(b.dataset.len) === len)),
  );
}

function renderBoard() {
  board.innerHTML = '';
  const rows = maxGuesses(len);
  for (let r = 0; r < rows; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    const guess = game.guesses[r];
    const marks = guess ? scoreGuess(guess, game.answer) : null;
    const text = guess ?? (r === game.guesses.length && !game.done ? current : '');
    for (let c = 0; c < len; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      const ch = text[c] ?? '';
      tile.textContent = ch;
      if (ch) tile.classList.add('filled');
      if (marks) tile.classList.add(marks[c]);
      row.append(tile);
    }
    board.append(row);
  }
}

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-'];

function renderKeyboard() {
  const marks = keyboardMarks(game.guesses, game.answer);
  keyboard.innerHTML = '';
  for (const r of KEY_ROWS) {
    const row = document.createElement('div');
    row.className = 'krow';
    for (const k of r) {
      const b = document.createElement('button');
      b.className = 'key';
      if (k === '+') {
        b.textContent = 'Enter';
        b.dataset.key = 'Enter';
        b.classList.add('wide');
      } else if (k === '-') {
        b.textContent = '⌫';
        b.dataset.key = 'Backspace';
        b.setAttribute('aria-label', 'Delete');
        b.classList.add('wide');
      } else {
        b.textContent = k;
        b.dataset.key = k;
        if (marks[k]) b.classList.add(marks[k]);
      }
      row.append(b);
    }
    keyboard.append(row);
  }
}

function activeRow() {
  return board.children[game.guesses.length] as HTMLElement | undefined;
}

function updateCurrentRow() {
  const row = activeRow();
  if (!row) return;
  [...row.children].forEach((t, i) => {
    const ch = current[i] ?? '';
    if (t.textContent !== ch) {
      t.textContent = ch;
      t.classList.toggle('filled', !!ch);
      if (ch) {
        t.classList.remove('pop');
        void (t as HTMLElement).offsetWidth;
        t.classList.add('pop');
      }
    }
  });
}

function shake() {
  const row = activeRow();
  if (!row) return;
  row.classList.remove('shake');
  void row.offsetWidth;
  row.classList.add('shake');
}

/* ---------- input ---------- */
async function submit() {
  if (current.length < len) {
    shake();
    return toast('Not enough letters');
  }
  const { guesses } = await loadWords(len);
  if (!guesses.has(current)) {
    shake();
    return toast('Not in word list');
  }
  busy = true;
  const row = activeRow()!;
  const marks = scoreGuess(current, game.answer);
  const guess = current;
  game.guesses.push(guess);
  current = '';
  const won = guess === game.answer;
  const lost = !won && game.guesses.length >= maxGuesses(len);
  if (won || lost) game.done = true;
  saveGame(mode, len, game);

  await revealRow(row, marks);
  renderKeyboard();
  busy = false;

  if (won || lost) {
    recordResult(len, won, game.guesses.length);
    if (won) {
      toast(['Genius!', 'Brilliant!', 'Great!', 'Nice!', 'Good!', 'Phew!'][Math.min(game.guesses.length - 1, 5)]);
      row.classList.add('win');
    } else {
      toast(game.answer.toUpperCase(), 3000);
    }
    setTimeout(() => showStats(true), 1600);
  }
}

function revealRow(row: HTMLElement, marks: Mark[]) {
  const tiles = [...row.children] as HTMLElement[];
  const step = 260;
  tiles.forEach((t, i) => {
    setTimeout(() => {
      t.classList.add('flip');
      setTimeout(() => t.classList.add(marks[i]), step);
    }, i * step);
  });
  return new Promise((r) => setTimeout(r, tiles.length * step + step));
}

function press(key: string) {
  if (busy || game.done) return;
  if (key === 'Enter') return void submit();
  if (key === 'Backspace') {
    current = current.slice(0, -1);
    return updateCurrentRow();
  }
  if (/^[a-z]$/i.test(key) && current.length < len) {
    current += key.toLowerCase();
    updateCurrentRow();
  }
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if ((document.querySelector('dialog[open]'))) return;
  press(e.key);
});
keyboard.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-key]');
  if (b) {
    press(b.dataset.key!);
    b.blur();
  }
});

$('#mode-seg').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-mode]');
  if (!b || busy) return;
  mode = b.dataset.mode as Mode;
  savePref('mode', mode);
  startGame();
});
$('#len-seg').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-len]');
  if (!b || busy) return;
  len = Number(b.dataset.len);
  savePref('len', String(len));
  startGame();
});

/* ---------- dialogs ---------- */
const help = $('#help') as unknown as HTMLDialogElement;
const stats = $('#stats') as unknown as HTMLDialogElement;
$('#help-btn').addEventListener('click', () => help.showModal());
$('#stats-btn').addEventListener('click', () => showStats(false));
for (const d of [help, stats]) {
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
}

function shareText() {
  const emoji: Record<Mark, string> = { correct: '🟩', present: '🟨', absent: '⬛' };
  const won = game.guesses.at(-1) === game.answer;
  const head =
    mode === 'daily'
      ? `Letterlock ${len} #${game.day + 1} ${won ? game.guesses.length : 'X'}/${maxGuesses(len)}`
      : `Letterlock ${len} (free) ${won ? game.guesses.length : 'X'}/${maxGuesses(len)}`;
  const grid = game.guesses.map((g) => scoreGuess(g, game.answer).map((m) => emoji[m]).join('')).join('\n');
  return `${head}\n${grid}`;
}

function showStats(afterGame: boolean) {
  const s = loadStats(len);
  $('#stats-title').textContent = `Statistics · ${len} letters`;
  const pct = s.played ? Math.round((s.wins / s.played) * 100) : 0;
  $('#stat-row').innerHTML = [
    [s.played, 'Played'],
    [pct, 'Win %'],
    [s.streak, 'Streak'],
    [s.maxStreak, 'Best streak'],
  ]
    .map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`)
    .join('');
  const max = Math.max(1, ...s.dist);
  const highlight = game.done && game.guesses.at(-1) === game.answer ? game.guesses.length - 1 : -1;
  $('#dist').innerHTML = s.dist
    .map(
      (n, i) =>
        `<div class="bar-row"><span>${i + 1}</span><div class="bar${i === highlight ? ' hi' : ''}" style="width:${Math.max(8, (n / max) * 100)}%">${n}</div></div>`,
    )
    .join('');
  const actions = $('#stats-actions');
  actions.innerHTML = '';
  if (game.done) {
    const share = document.createElement('button');
    share.className = 'primary';
    share.textContent = 'Share';
    share.onclick = async () => {
      try {
        await navigator.clipboard.writeText(shareText());
        toast('Copied to clipboard');
      } catch {
        toast('Could not copy');
      }
    };
    actions.append(share);
    if (mode === 'free') {
      const again = document.createElement('button');
      again.className = 'primary alt';
      again.textContent = 'New word';
      again.onclick = () => {
        stats.close();
        startGame(true);
      };
      actions.append(again);
    } else if (afterGame) {
      const free = document.createElement('button');
      free.className = 'primary alt';
      free.textContent = 'Play free mode';
      free.onclick = () => {
        stats.close();
        mode = 'free';
        savePref('mode', mode);
        startGame(true);
      };
      actions.append(free);
    }
  }
  stats.showModal();
}

/* ---------- sizing: fit the board to the space left over ---------- */
const main = $('main');
function fitBoard() {
  const rows = maxGuesses(len);
  const gap = 5;
  const w = main.clientWidth;
  const h = main.clientHeight - 8;
  const tile = Math.floor(Math.min((w - gap * (len - 1)) / len, (h - gap * (rows - 1)) / rows, 62));
  board.style.width = `${tile * len + gap * (len - 1)}px`;
  board.style.setProperty('--tile', `${tile}px`);
}
new ResizeObserver(fitBoard).observe(main);

/* ---------- boot ---------- */
if (!loadPref('seen-help')) {
  savePref('seen-help', '1');
  help.showModal();
}
startGame();
