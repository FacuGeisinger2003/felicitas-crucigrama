'use strict';
const fs = require('fs');
const path = require('path');
const { generateLayout, normalize } = require('./lib/crossword');
const { buildPuzzleHtml, buildIndexHtml, buildLeaderboardHtml, pagesBaseUrl } = require('./lib/render');

const ROOT = __dirname;
const DOCS = path.join(ROOT, 'docs');
const PUZZLES_DIR = path.join(DOCS, 'puzzles');
const HISTORY_PATH = path.join(DOCS, 'data', 'history.json');
const WORDBANK_PATH = path.join(ROOT, 'lib', 'wordbank.json');
const CONFIG_PATH = path.join(ROOT, 'lib', 'config.json');

const RECENT_DAYS_AVOID = 14; // no repetir palabras usadas en los últimos N días
const HISTORY_KEEP_DAYS = 30;
const ATTEMPT_SIZE = 19; // cuántas palabras candidatas se intentan encajar

function todayInMontevideo() {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date()); // YYYY-MM-DD
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadHistory() {
  try { return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8')); } catch (e) { return {}; }
}

function saveHistory(history) {
  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n');
}

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (e) { return { firebaseDbUrl: '' }; }
}

function main() {
  const date = process.env.PUZZLE_DATE || process.argv[2] || todayInMontevideo();
  const wordbank = JSON.parse(fs.readFileSync(WORDBANK_PATH, 'utf8'));
  const history = loadHistory();
  const config = loadConfig();

  // palabras usadas en los últimos RECENT_DAYS_AVOID días (para no repetir)
  const cutoff = new Date(date + 'T00:00:00Z').getTime() - RECENT_DAYS_AVOID * 86400000;
  const recentlyUsed = new Set();
  Object.entries(history).forEach(([d, words]) => {
    const t = new Date(d + 'T00:00:00Z').getTime();
    if (t >= cutoff && t < new Date(date + 'T00:00:00Z').getTime()) {
      words.forEach((w) => recentlyUsed.add(w));
    }
  });

  let pool = wordbank.filter((w) => !recentlyUsed.has(normalize(w.word)));
  if (pool.length < 25) pool = wordbank; // banco chico: permitimos repetir si hace falta

  const rng = mulberry32(hashSeed(date));
  const shuffled = seededShuffle(pool, rng);

  let layout = null;
  let attemptSize = Math.min(ATTEMPT_SIZE, shuffled.length);
  while (!layout && attemptSize <= shuffled.length) {
    layout = generateLayout(shuffled.slice(0, attemptSize));
    if (layout && layout.allWords.length < 10 && attemptSize < shuffled.length) {
      layout = null; // intentamos con más candidatas
    }
    attemptSize += 6;
  }
  if (!layout) {
    console.error('No se pudo generar un crucigrama con el banco disponible.');
    process.exit(1);
  }

  fs.mkdirSync(PUZZLES_DIR, { recursive: true });
  const puzzlePath = path.join(PUZZLES_DIR, `${date}.html`);
  fs.writeFileSync(puzzlePath, buildPuzzleHtml(date, layout, config));

  history[date] = layout.usedWords;
  const keepCutoff = new Date(date + 'T00:00:00Z').getTime() - HISTORY_KEEP_DAYS * 86400000;
  Object.keys(history).forEach((d) => {
    if (new Date(d + 'T00:00:00Z').getTime() < keepCutoff) delete history[d];
  });
  saveHistory(history);

  const puzzleDates = fs
    .readdirSync(PUZZLES_DIR)
    .filter((f) => f.endsWith('.html'))
    .map((f) => f.replace('.html', ''));

  fs.mkdirSync(DOCS, { recursive: true });
  fs.writeFileSync(path.join(DOCS, 'index.html'), buildIndexHtml(puzzleDates));
  fs.writeFileSync(path.join(DOCS, 'leaderboard.html'), buildLeaderboardHtml(config));

  const puzzleUrl = `${pagesBaseUrl(config)}/puzzles/${date}.html`;
  const result = { date, puzzleUrl, wordsPlaced: layout.allWords.length };
  console.log(JSON.stringify(result));

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `puzzle_url=${puzzleUrl}\ndate=${date}\nwords_placed=${layout.allWords.length}\n`);
  }
}

main();
