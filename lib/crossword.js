// Motor de layout de crucigrama: coloca palabras entrecruzadas de forma
// determinística a partir de una lista [{word, clue}, ...].
'use strict';

function normalize(s) {
  return s
    .toUpperCase()
    .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I')
    .replace(/Ó/g, 'O').replace(/Ú/g, 'U').replace(/Ñ/g, 'N')
    .replace(/[^A-Z]/g, '');
}

function generateLayout(rawWords) {
  let words = rawWords
    .map((w) => ({ ...w, word: normalize(w.word) }))
    .filter((w) => w.word.length >= 3);
  words.sort((a, b) => b.word.length - a.word.length);
  if (!words.length) return null;

  const grid = new Map();
  const placed = [];
  const key = (r, c) => r + ',' + c;

  function canPlace(word, row, col, dir) {
    let intersections = 0;
    const br = dir === 'V' ? row - 1 : row;
    const bc = dir === 'H' ? col - 1 : col;
    if (grid.has(key(br, bc))) return null;
    for (let i = 0; i < word.length; i++) {
      const r = row + (dir === 'V' ? i : 0);
      const c = col + (dir === 'H' ? i : 0);
      const existing = grid.get(key(r, c));
      if (existing) {
        if (existing !== word[i]) return null;
        intersections++;
      } else if (dir === 'H') {
        if (grid.has(key(r - 1, c)) || grid.has(key(r + 1, c))) return null;
      } else {
        if (grid.has(key(r, c - 1)) || grid.has(key(r, c + 1))) return null;
      }
    }
    const ar = dir === 'V' ? row + word.length : row;
    const ac = dir === 'H' ? col + word.length : col;
    if (grid.has(key(ar, ac))) return null;
    return intersections;
  }

  function placeWord(word, row, col, dir) {
    for (let i = 0; i < word.length; i++) {
      const r = row + (dir === 'V' ? i : 0);
      const c = col + (dir === 'H' ? i : 0);
      grid.set(key(r, c), word[i]);
    }
  }

  function currentBounds() {
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const k of grid.keys()) {
      const [r, c] = k.split(',').map(Number);
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      minC = Math.min(minC, c); maxC = Math.max(maxC, c);
    }
    return { minR, maxR, minC, maxC };
  }

  function boxCost(cand, word) {
    const b = currentBounds();
    const r0 = cand.row, c0 = cand.col;
    const r1 = cand.dir === 'V' ? cand.row + word.length - 1 : cand.row;
    const c1 = cand.dir === 'H' ? cand.col + word.length - 1 : cand.col;
    const minR = Math.min(b.minR, r0), maxR = Math.max(b.maxR, r1);
    const minC = Math.min(b.minC, c0), maxC = Math.max(b.maxC, c1);
    return (maxR - minR + 1) * (maxC - minC + 1);
  }

  function findCandidates(w) {
    const candidates = [];
    for (let li = 0; li < w.word.length; li++) {
      const letter = w.word[li];
      for (const [k, gletter] of grid.entries()) {
        if (gletter !== letter) continue;
        const [gr, gc] = k.split(',').map(Number);
        const hRow = gr, hCol = gc - li;
        const hScore = canPlace(w.word, hRow, hCol, 'H');
        if (hScore !== null && hScore >= 1) candidates.push({ row: hRow, col: hCol, dir: 'H', score: hScore });
        const vRow = gr - li, vCol = gc;
        const vScore = canPlace(w.word, vRow, vCol, 'V');
        if (vScore !== null && vScore >= 1) candidates.push({ row: vRow, col: vCol, dir: 'V', score: vScore });
      }
    }
    return candidates;
  }

  placeWord(words[0].word, 0, 0, 'H');
  placed.push({ ...words[0], row: 0, col: 0, dir: 'H' });

  let unplacedList = [];
  for (let idx = 1; idx < words.length; idx++) {
    const w = words[idx];
    const candidates = findCandidates(w);
    if (candidates.length) {
      candidates.forEach((c) => (c.cost = boxCost(c, w.word)));
      candidates.sort((a, b) => a.cost - b.cost || b.score - a.score);
      const best = candidates[0];
      placeWord(w.word, best.row, best.col, best.dir);
      placed.push({ ...w, row: best.row, col: best.col, dir: best.dir });
    } else {
      unplacedList.push(w);
    }
  }
  // segunda pasada para las que no entraron al principio
  for (const w of unplacedList) {
    const candidates = findCandidates(w);
    if (candidates.length) {
      candidates.forEach((c) => (c.cost = boxCost(c, w.word)));
      candidates.sort((a, b) => a.cost - b.cost || b.score - a.score);
      const best = candidates[0];
      placeWord(w.word, best.row, best.col, best.dir);
      placed.push({ ...w, row: best.row, col: best.col, dir: best.dir });
    }
  }

  if (placed.length < 6) return null; // muy pocas palabras entrelazadas, descartar

  const b = currentBounds();
  const ROWS = b.maxR - b.minR + 1;
  const COLS = b.maxC - b.minC + 1;
  const shifted = placed.map((p) => ({ ...p, row: p.row - b.minR, col: p.col - b.minC }));

  const startMap = new Map();
  let num = 1;
  const starts = [];
  shifted.forEach((p) => {
    const k = p.row + ',' + p.col;
    if (!startMap.has(k)) { starts.push({ row: p.row, col: p.col, key: k }); startMap.set(k, null); }
  });
  starts.sort((a, b) => a.row - b.row || a.col - b.col);
  starts.forEach((s) => startMap.set(s.key, num++));
  shifted.forEach((p) => (p.number = startMap.get(p.row + ',' + p.col)));

  const across = shifted.filter((p) => p.dir === 'H').sort((a, b) => a.number - b.number);
  const down = shifted.filter((p) => p.dir === 'V').sort((a, b) => a.number - b.number);
  const allWords = [...across, ...down];

  const cellMatrix = [];
  for (let r = 0; r < ROWS; r++) cellMatrix.push(new Array(COLS).fill(null));
  allWords.forEach((w, wIndex) => {
    for (let i = 0; i < w.word.length; i++) {
      const r = w.row + (w.dir === 'V' ? i : 0);
      const c = w.col + (w.dir === 'H' ? i : 0);
      if (!cellMatrix[r][c]) cellMatrix[r][c] = { answer: w.word[i], number: startMap.get(r + ',' + c), across: null, down: null };
      if (w.dir === 'H') cellMatrix[r][c].across = wIndex;
      else cellMatrix[r][c].down = wIndex;
    }
  });

  return { ROWS, COLS, across, down, allWords, cellMatrix, usedWords: placed.map((p) => p.word) };
}

module.exports = { generateLayout, normalize };
