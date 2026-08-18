'use strict';
const fs = require('fs');
const path = require('path');

const WORDBANK = require('./wordbank.json');

// Motor de crucigrama, leído tal cual de crossword.js y embebido en cada
// página para poder generar crucigramas nuevos del lado del navegador
// (botón "Crucigrama nuevo"). Una sola fuente de verdad: este archivo no
// duplica la lógica, la lee del propio crossword.js.
const CROSSWORD_ENGINE_SRC = fs
  .readFileSync(path.join(__dirname, 'crossword.js'), 'utf8')
  .replace(/'use strict';\n/, '')
  .replace(/\/\/ Motor de layout[\s\S]*?\n\n/, '')
  .replace(/module\.exports[\s\S]*$/, '');

function repoInfo() {
  const env = process.env.GITHUB_REPOSITORY; // "owner/repo"
  if (env && env.includes('/')) {
    const [owner, repo] = env.split('/');
    return { owner, repo };
  }
  return { owner: 'TU-USUARIO', repo: 'crucigrama-diario' };
}

function pagesBaseUrl() {
  const { owner, repo } = repoInfo();
  return `https://${owner}.github.io/${repo}`;
}

function fmtDateEs(date) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const BASE_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..800&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
:root{
  --tinta:#16233A; --tinta-2:#1E3050; --yerba:#8BAA3E; --yerba-deep:#5F7A28;
  --azulejo:#3E75AC; --ladrillo:#C1502E; --hueso:#F2EAD9; --mostaza:#DFA83F; --cell:clamp(24px, 7vw, 34px);
}
*{box-sizing:border-box;}
body{margin:0;background:var(--tinta);color:var(--hueso);font-family:'Space Grotesk',sans-serif;min-height:100vh;padding:20px 14px 60px;}
.tile-band{height:14px;width:100%;max-width:980px;margin:0 auto;background-image:linear-gradient(45deg,var(--mostaza) 25%,transparent 25%,transparent 75%,var(--mostaza) 75%),linear-gradient(45deg,var(--mostaza) 25%,transparent 25%,transparent 75%,var(--mostaza) 75%);background-size:14px 14px;background-position:0 0,7px 7px;opacity:.55;border-radius:3px;}
header{max-width:980px;margin:18px auto 22px;text-align:center;}
h1{font-family:'Fraunces',serif;font-weight:700;font-size:clamp(26px,5vw,42px);margin:0 0 6px;color:var(--hueso);}
h1 span{color:var(--yerba);}
.subtitle{font-size:14px;color:#C9CFDA;max-width:560px;margin:0 auto;line-height:1.5;}
a{color:var(--mostaza);}
.top-nav{max-width:980px;margin:0 auto 6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;font-size:13px;}
@media (max-width:480px){
  .top-nav{justify-content:center;text-align:center;gap:4px 16px;}
  body{padding:16px 10px 40px;}
}
.top-nav a{color:#C9CFDA;text-decoration:none;}
.top-nav a:hover{color:var(--mostaza);}
.user-badge{font-size:12px;color:#C9CFDA;}
.user-badge button{background:none;border:none;color:var(--mostaza);cursor:pointer;font-size:12px;padding:0;margin-left:6px;text-decoration:underline;font-family:inherit;}
footer{max-width:980px;margin:24px auto 0;text-align:center;font-size:11px;color:#7C8496;}

.modal-overlay{position:fixed;inset:0;background:rgba(10,15,26,.75);display:none;align-items:center;justify-content:center;z-index:50;padding:16px;}
.modal-overlay.on{display:flex;}
.modal-box{background:var(--tinta-2);border-radius:16px;padding:26px 24px;max-width:360px;width:100%;border:1px solid rgba(242,234,217,.12);}
.modal-box h3{font-family:'Fraunces',serif;margin:0 0 6px;font-size:20px;color:var(--hueso);}
.modal-box p{font-size:13px;color:#C9CFDA;margin:0 0 16px;line-height:1.4;}
.modal-box label{display:block;font-size:12px;color:#C9CFDA;margin:12px 0 4px;}
.modal-box input{width:100%;padding:9px 10px;border-radius:8px;border:1px solid rgba(242,234,217,.2);background:var(--tinta);color:var(--hueso);font-family:'Space Grotesk',sans-serif;font-size:14px;}
.modal-box input:focus{outline:2px solid var(--azulejo);}
.modal-error{color:#F0A98F;font-size:12px;margin-top:8px;min-height:14px;}
.modal-box button{margin-top:16px;width:100%;background:var(--yerba);color:var(--tinta);border:none;border-radius:999px;padding:11px;font-weight:700;font-family:'Space Grotesk',sans-serif;cursor:pointer;font-size:14px;}
`;

function userScriptBlock() {
  return `
const USER_KEY = 'crucigrama_user_v1';
function loadUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; } }
function saveUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)); }
function sanitizeUsername(v) {
  return v.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9_]/g, '').slice(0, 20);
}
let currentUser = loadUser();

function renderUserBadge() {
  const el = document.getElementById('userBadge');
  if (!el) return;
  if (currentUser) {
    el.innerHTML = \`👤 \${currentUser.nombre} \${currentUser.apellido} (@\${currentUser.username}) <button id="btnChangeUser">cambiar</button>\`;
  } else {
    el.innerHTML = '';
  }
  const btn = document.getElementById('btnChangeUser');
  if (btn) btn.addEventListener('click', () => openUserModal(true));
}

function openUserModal(isEdit) {
  const overlay = document.getElementById('userModalOverlay');
  const errEl = document.getElementById('modalError');
  errEl.textContent = '';
  if (isEdit && currentUser) {
    document.getElementById('inNombre').value = currentUser.nombre;
    document.getElementById('inApellido').value = currentUser.apellido;
    document.getElementById('inUsername').value = currentUser.username;
  }
  overlay.classList.add('on');
  document.getElementById('inNombre').focus();
}

function closeUserModal() {
  document.getElementById('userModalOverlay').classList.remove('on');
}

function wireUserModal(onReady) {
  const form = document.getElementById('userForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nombre = document.getElementById('inNombre').value.trim();
    const apellido = document.getElementById('inApellido').value.trim();
    const username = sanitizeUsername(document.getElementById('inUsername').value.trim());
    const errEl = document.getElementById('modalError');
    if (!nombre || !apellido || !username) {
      errEl.textContent = 'Completá los tres campos (el usuario solo puede tener letras, números y _).';
      return;
    }
    currentUser = { nombre, apellido, username };
    saveUser(currentUser);
    renderUserBadge();
    closeUserModal();
    if (onReady) onReady();
  });
  if (!currentUser) openUserModal(false);
  else renderUserBadge();
}
`;
}

function userModalHtml() {
  return `
<div class="modal-overlay" id="userModalOverlay">
  <div class="modal-box">
    <h3>¿Cómo te llamás?</h3>
    <p>Para aparecer en la tabla de posiciones con tus amigos. Solo se guarda en este navegador.</p>
    <form id="userForm">
      <label for="inNombre">Nombre</label>
      <input id="inNombre" type="text" maxlength="30" autocomplete="given-name" required>
      <label for="inApellido">Apellido</label>
      <input id="inApellido" type="text" maxlength="30" autocomplete="family-name" required>
      <label for="inUsername">Usuario (sin espacios)</label>
      <input id="inUsername" type="text" maxlength="20" placeholder="ej: facugeisinger" required>
      <div class="modal-error" id="modalError"></div>
      <button type="submit">Guardar y jugar</button>
    </form>
  </div>
</div>`;
}

function buildPuzzleHtml(date, layout, config) {
  const { ROWS, COLS, across, down, allWords, cellMatrix } = layout;
  const dateEs = fmtDateEs(date);
  const dbUrl = (config && config.firebaseDbUrl) || '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Crucigrama del ${date}</title>
<style>
${BASE_STYLE}
.wrap{max-width:980px;margin:0 auto;display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap;}
.board-panel{background:var(--tinta-2);border-radius:14px;padding:16px;border:1px solid rgba(242,234,217,.08);flex:1 1 560px;min-width:0;}
.board-scroll{overflow-x:auto;padding-bottom:6px;}
.grid{display:grid;gap:2px;width:max-content;margin:4px auto;background:rgba(0,0,0,.25);padding:2px;border-radius:6px;}
.cell{position:relative;width:var(--cell);height:var(--cell);}
.cell.blocked{visibility:hidden;}
.cell input{width:100%;height:100%;border:none;border-radius:3px;text-align:center;text-transform:uppercase;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:15px;background:var(--hueso);color:var(--tinta);padding:0;caret-color:var(--azulejo);}
.cell input:focus{outline:2px solid var(--azulejo);outline-offset:-2px;}
.cell.active-word input{background:#E4D9BC;}
.cell.active-cell input{background:#D8C89A;outline:2px solid var(--mostaza);outline-offset:-2px;}
.cell input.correct{background:#CFE0B2;color:var(--yerba-deep);}
.cell input.incorrect{background:#EFC3B4;color:var(--ladrillo);}
.cell input.revealed{background:#E7D7A8;color:var(--tinta);}
.num{position:absolute;top:1px;left:2px;font-size:9px;font-family:'JetBrains Mono',monospace;color:var(--tinta-2);font-weight:700;pointer-events:none;z-index:2;}
.controls{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:14px;}
button{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:13px;border:none;border-radius:999px;padding:9px 18px;cursor:pointer;transition:transform .1s ease;}
button:active{transform:scale(.96);}
.btn-primary{background:var(--yerba);color:var(--tinta);}
.btn-secondary{background:transparent;color:var(--hueso);border:1px solid rgba(242,234,217,.35);}
.btn-secondary:hover{background:rgba(242,234,217,.08);}
.btn-ghost{background:transparent;color:var(--mostaza);border:1px dashed rgba(223,168,63,.5);}
.btn-ghost:hover{background:rgba(223,168,63,.08);}
.btn-submit{background:var(--mostaza);color:var(--tinta);}
.btn-submit:disabled{opacity:.5;cursor:default;}
.status{text-align:center;margin-top:12px;font-size:13px;color:#C9CFDA;min-height:18px;}
.status.win{color:var(--yerba);font-weight:700;font-family:'Fraunces',serif;font-size:16px;}
.timer{text-align:center;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--mostaza);margin-top:4px;}
.hint-counter{text-align:center;font-size:12px;color:#C1502E;margin-top:2px;min-height:14px;}
.submit-box{text-align:center;margin-top:14px;display:none;}
.submit-box.on{display:block;}
.submit-msg{font-size:12px;color:#8B93A6;margin-top:6px;min-height:14px;}
.practice-badge{display:none;text-align:center;font-size:11px;color:var(--mostaza);background:rgba(223,168,63,.12);border:1px solid rgba(223,168,63,.3);border-radius:999px;padding:4px 12px;margin:0 auto 10px;width:fit-content;}
.practice-badge.on{display:block;}
.clues-panel{flex:1 1 320px;min-width:260px;display:flex;flex-direction:column;gap:16px;}
.clue-group{background:var(--tinta-2);border-radius:14px;padding:16px 18px;border:1px solid rgba(242,234,217,.08);}
.clue-group h2{font-family:'Fraunces',serif;font-size:16px;margin:0 0 10px;color:var(--mostaza);}
.clue-group ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;}
.clue-group li{font-size:13px;line-height:1.4;padding:6px 8px;border-radius:8px;cursor:pointer;color:#D9DEE7;}
.clue-group li:hover{background:rgba(242,234,217,.06);}
.clue-group li.selected{background:var(--yerba);color:var(--tinta);font-weight:600;}
.clue-group li.done{opacity:.45;text-decoration:line-through;}
.clue-group li.done.selected{opacity:.7;}
.clue-group li b{font-family:'JetBrains Mono',monospace;margin-right:6px;}
@media (max-width:640px){ .board-panel,.clue-group{padding:12px;} }
@media (max-width:400px){ .num{font-size:8px;} .cell input{font-size:13px;} }
</style>
</head>
<body>
<div class="tile-band"></div>
<div class="top-nav">
  <a href="../index.html">&larr; Todos los crucigramas</a>
  <a href="../leaderboard.html">🏆 Tabla de posiciones</a>
</div>
<header>
  <h1>Crucigrama <span>del día</span></h1>
  <p class="subtitle" id="subtitleText">${dateEs}. Cultura general del mundo, Latinoamérica, Uruguay y Argentina.</p>
  <p class="user-badge" id="userBadge"></p>
  <div class="timer" id="timer">⏱ 00:00 &mdash; escribí una letra para arrancar el cronómetro</div>
  <div class="hint-counter" id="hintCounter"></div>
</header>

<div class="wrap">
  <div class="board-panel">
    <div class="practice-badge" id="practiceBadge">🎲 Modo práctica — este no cuenta para la tabla</div>
    <div class="board-scroll"><div class="grid" id="grid"></div></div>
    <div class="controls">
      <button class="btn-primary" id="btnCheck">Revisar</button>
      <button class="btn-secondary" id="btnHint">💡 Pista</button>
      <button class="btn-secondary" id="btnReveal">Ver soluciones</button>
      <button class="btn-secondary" id="btnReset">Reiniciar</button>
    </div>
    <div class="status" id="status">0 / ${allWords.length} palabras completas</div>
    <div class="submit-box" id="submitBox">
      <button class="btn-submit" id="btnSubmit">📤 Mandar mi tiempo a la tabla</button>
      <div class="submit-msg" id="submitMsg"></div>
    </div>
    <div class="controls" style="margin-top:16px;">
      <button class="btn-ghost" id="btnNew">🎲 Jugar un crucigrama nuevo</button>
      <button class="btn-ghost" id="btnBackToDaily" style="display:none;">🔁 Volver al crucigrama del día</button>
    </div>
  </div>

  <div class="clues-panel">
    <div class="clue-group"><h2>Horizontales →</h2><ul id="acrossList"></ul></div>
    <div class="clue-group"><h2>Verticales ↓</h2><ul id="downList"></ul></div>
  </div>
</div>

${userModalHtml()}

<footer>Crucigrama Rioplatense · generado automáticamente</footer>

<script>
${CROSSWORD_ENGINE_SRC}
const WORD_BANK = ${JSON.stringify(WORDBANK)};
const PUZZLE_DATE = ${JSON.stringify(date)};
const FIREBASE_DB_URL = ${JSON.stringify(dbUrl)};
const DAILY_LAYOUT = { ROWS: ${ROWS}, COLS: ${COLS}, cellMatrix: ${JSON.stringify(cellMatrix)}, across: ${JSON.stringify(across)}, down: ${JSON.stringify(down)} };
DAILY_LAYOUT.allWords = [...DAILY_LAYOUT.across, ...DAILY_LAYOUT.down];

${userScriptBlock()}

let ROWS, COLS, cellMatrix, across, down, allWords, inputRefs = {};
let selectedWordIndex = null, selectedCell = null;
let isDailyPuzzle = true, usedReveal = false, alreadyWon = false, hintCount = 0;
const HINT_PENALTY_SECONDS = 5;

const gridEl = document.getElementById('grid');
const statusEl = document.getElementById('status');
const acrossList = document.getElementById('acrossList');
const downList = document.getElementById('downList');
const practiceBadge = document.getElementById('practiceBadge');
const btnBackToDaily = document.getElementById('btnBackToDaily');
const subtitleText = document.getElementById('subtitleText');
const submitBox = document.getElementById('submitBox');
const submitMsg = document.getElementById('submitMsg');
const btnSubmit = document.getElementById('btnSubmit');
const hintCounterEl = document.getElementById('hintCounter');
const ORIGINAL_SUBTITLE = subtitleText.textContent;

function shuffleRandom(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRandomLayout(excludeWords) {
  const exclude = new Set(excludeWords || []);
  let pool = WORD_BANK.filter((w) => !exclude.has(normalize(w.word)));
  if (pool.length < 18) pool = WORD_BANK;
  const shuffled = shuffleRandom(pool);
  let layout = null;
  let attemptSize = Math.min(19, shuffled.length);
  while (!layout && attemptSize <= shuffled.length) {
    layout = generateLayout(shuffled.slice(0, attemptSize));
    if (layout && layout.allWords.length < 10 && attemptSize < shuffled.length) layout = null;
    attemptSize += 6;
  }
  return layout;
}

function renderPuzzle(layout) {
  ROWS = layout.ROWS; COLS = layout.COLS; cellMatrix = layout.cellMatrix;
  across = layout.across; down = layout.down; allWords = layout.allWords;
  inputRefs = {};
  selectedWordIndex = null; selectedCell = null;
  usedReveal = false; alreadyWon = false; hintCount = 0;
  submitBox.classList.remove('on');
  submitMsg.textContent = '';
  hintCounterEl.textContent = '';

  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = \`repeat(\${COLS}, var(--cell))\`;
  gridEl.style.gridTemplateRows = \`repeat(\${ROWS}, var(--cell))\`;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cellData = cellMatrix[r][c];
      const div = document.createElement('div');
      if (!cellData) { div.className = 'cell blocked'; gridEl.appendChild(div); continue; }
      div.className = 'cell'; div.dataset.r = r; div.dataset.c = c;
      if (cellData.number) {
        const numSpan = document.createElement('span');
        numSpan.className = 'num'; numSpan.textContent = cellData.number;
        div.appendChild(numSpan);
      }
      const input = document.createElement('input');
      input.setAttribute('maxlength', '1');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('inputmode', 'text');
      input.dataset.r = r; input.dataset.c = c;
      wireInput(input, r, c);
      div.appendChild(input);
      gridEl.appendChild(div);
      inputRefs[r + ',' + c] = input;
    }
  }

  acrossList.innerHTML = ''; downList.innerHTML = '';
  renderClueList(across, acrossList);
  renderClueList(down, downList);

  if (allWords.length) selectWord(0);
  resetTimer();
  updateStatus();
}

function renderClueList(list, ul) {
  list.forEach((w) => {
    const li = document.createElement('li');
    li.innerHTML = \`<b>\${w.number}.</b> \${w.clue} <span style="opacity:.55">(\${w.word.length})</span>\`;
    const idx = allWords.indexOf(w);
    li.dataset.index = idx;
    li.addEventListener('click', () => {
      selectWord(idx);
      const input = inputRefs[w.row + ',' + w.col];
      if (input) input.focus();
    });
    ul.appendChild(li);
  });
}

function clearHighlights() {
  document.querySelectorAll('.cell.active-word').forEach((el) => el.classList.remove('active-word'));
  document.querySelectorAll('.cell.active-cell').forEach((el) => el.classList.remove('active-cell'));
  document.querySelectorAll('.clue-group li.selected').forEach((el) => el.classList.remove('selected'));
}
function selectWord(index) {
  clearHighlights();
  selectedWordIndex = index;
  const w = allWords[index];
  for (let i = 0; i < w.word.length; i++) {
    const r = w.row + (w.dir === 'V' ? i : 0);
    const c = w.col + (w.dir === 'H' ? i : 0);
    inputRefs[r + ',' + c].parentElement.classList.add('active-word');
  }
  document.querySelectorAll(\`.clue-group li[data-index="\${index}"]\`).forEach((el) => el.classList.add('selected'));
}
function selectCell(r, c, preferDir) {
  const cellData = cellMatrix[r][c];
  if (!cellData) return;
  selectedCell = { r, c };
  let wIndex;
  if (preferDir === 'H' && cellData.across !== null) wIndex = cellData.across;
  else if (preferDir === 'V' && cellData.down !== null) wIndex = cellData.down;
  else if (cellData.across !== null) wIndex = cellData.across;
  else wIndex = cellData.down;
  selectWord(wIndex);
  document.querySelectorAll('.cell.active-cell').forEach((el) => el.classList.remove('active-cell'));
  inputRefs[r + ',' + c].parentElement.classList.add('active-cell');
}

let timerStarted = false, timerInterval = null, startTime = null, finishSeconds = null;
function startTimer() {
  if (timerStarted) return;
  timerStarted = true; startTime = Date.now();
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - startTime) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    document.getElementById('timer').textContent = \`⏱ \${mm}:\${ss}\`;
  }, 1000);
}
function stopTimer() { if (timerInterval) clearInterval(timerInterval); }
function resetTimer() {
  stopTimer();
  timerStarted = false;
  startTime = null;
  finishSeconds = null;
  document.getElementById('timer').textContent = '⏱ 00:00 — escribí una letra para arrancar el cronómetro';
}

function wireInput(input, r, c) {
  input.addEventListener('focus', () => {
    const cellData = cellMatrix[r][c];
    let preferDir = null;
    if (selectedWordIndex !== null) {
      const curW = allWords[selectedWordIndex];
      preferDir = curW.dir;
      if (curW.dir === 'H' && cellData.across === null) preferDir = null;
      if (curW.dir === 'V' && cellData.down === null) preferDir = null;
    }
    selectCell(r, c, preferDir || 'H');
  });
  input.addEventListener('click', () => {
    const cellData = cellMatrix[r][c];
    if (selectedCell && selectedCell.r === r && selectedCell.c === c && cellData.across !== null && cellData.down !== null) {
      const curW = allWords[selectedWordIndex];
      selectCell(r, c, curW.dir === 'H' ? 'V' : 'H');
    }
  });
  input.addEventListener('input', (e) => {
    startTimer();
    let val = e.target.value.toUpperCase().replace(/[^A-ZÑ]/g, '');
    val = val.slice(-1);
    e.target.value = val;
    e.target.classList.remove('correct', 'incorrect', 'revealed');
    if (val) moveNext(r, c);
    updateStatus();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !e.target.value) { movePrev(r, c); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { moveDir(r, c, 0, 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { moveDir(r, c, 0, -1); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { moveDir(r, c, 1, 0); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { moveDir(r, c, -1, 0); e.preventDefault(); }
  });
}

function moveNext(r, c) {
  if (selectedWordIndex === null) return;
  const w = allWords[selectedWordIndex];
  const idx = w.dir === 'H' ? c - w.col : r - w.row;
  if (idx < w.word.length - 1) {
    const nr = w.row + (w.dir === 'V' ? idx + 1 : 0);
    const nc = w.col + (w.dir === 'H' ? idx + 1 : 0);
    inputRefs[nr + ',' + nc].focus();
  }
}
function movePrev(r, c) {
  if (selectedWordIndex === null) return;
  const w = allWords[selectedWordIndex];
  const idx = w.dir === 'H' ? c - w.col : r - w.row;
  if (idx > 0) {
    const pr = w.row + (w.dir === 'V' ? idx - 1 : 0);
    const pc = w.col + (w.dir === 'H' ? idx - 1 : 0);
    inputRefs[pr + ',' + pc].focus();
    inputRefs[pr + ',' + pc].value = '';
  }
}
function moveDir(r, c, dr, dc) {
  let nr = r + dr, nc = c + dc;
  while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
    if (cellMatrix[nr][nc]) { inputRefs[nr + ',' + nc].focus(); return; }
    nr += dr; nc += dc;
  }
}

function updateStatus() {
  let done = 0;
  allWords.forEach((w, idx) => {
    let complete = true;
    for (let i = 0; i < w.word.length; i++) {
      const r = w.row + (w.dir === 'V' ? i : 0);
      const c = w.col + (w.dir === 'H' ? i : 0);
      if (inputRefs[r + ',' + c].value.toUpperCase() !== w.word[i]) complete = false;
    }
    if (complete) done++;
    document.querySelectorAll(\`.clue-group li[data-index="\${idx}"]\`).forEach((el) => el.classList.toggle('done', complete));
  });
  statusEl.textContent = \`\${done} / \${allWords.length} palabras completas\`;
  const justWon = done === allWords.length && !alreadyWon;
  statusEl.classList.toggle('win', done === allWords.length);
  if (done === allWords.length) {
    statusEl.textContent = \`¡Completaste el crucigrama! 🧉 \${allWords.length}/\${allWords.length}\`;
    if (justWon) {
      alreadyWon = true;
      finishSeconds = (timerStarted ? Math.floor((Date.now() - startTime) / 1000) : 0) + hintCount * HINT_PENALTY_SECONDS;
      stopTimer();
      if (isDailyPuzzle && !usedReveal) showSubmitBox();
    }
  }
}

function showSubmitBox() {
  submitBox.classList.add('on');
  const mm = String(Math.floor(finishSeconds / 60)).padStart(2, '0');
  const ss = String(finishSeconds % 60).padStart(2, '0');
  btnSubmit.textContent = \`📤 Mandar mi tiempo a la tabla (\${mm}:\${ss})\`;
  btnSubmit.disabled = false;
  if (!FIREBASE_DB_URL) {
    submitMsg.textContent = '⚠️ La tabla de posiciones todavía no está configurada.';
    btnSubmit.disabled = true;
  } else if (hintCount > 0) {
    submitMsg.textContent = \`Incluye \${hintCount} pista\${hintCount === 1 ? '' : 's'} (+\${hintCount * HINT_PENALTY_SECONDS}s de penalización).\`;
  } else {
    submitMsg.textContent = '';
  }
}

btnSubmit.addEventListener('click', async () => {
  if (!currentUser) { openUserModal(false); return; }
  btnSubmit.disabled = true;
  submitMsg.textContent = 'Enviando...';
  try {
    const payload = { nombre: currentUser.nombre, apellido: currentUser.apellido, username: currentUser.username, seconds: finishSeconds, hintsUsed: hintCount, ts: Date.now() };
    const res = await fetch(\`\${FIREBASE_DB_URL}/scores/\${PUZZLE_DATE}/\${currentUser.username}.json\`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    submitMsg.innerHTML = '✅ ¡Enviado! <a href="../leaderboard.html">Ver tabla de posiciones</a>';
  } catch (err) {
    submitMsg.textContent = 'No se pudo enviar. Revisá tu conexión y probá de nuevo.';
    btnSubmit.disabled = false;
  }
});

document.getElementById('btnCheck').addEventListener('click', () => {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cellData = cellMatrix[r][c];
      if (!cellData) continue;
      const input = inputRefs[r + ',' + c];
      if (!input.value) continue;
      input.classList.remove('revealed');
      if (input.value.toUpperCase() === cellData.answer) { input.classList.add('correct'); input.classList.remove('incorrect'); }
      else { input.classList.add('incorrect'); input.classList.remove('correct'); }
    }
  }
  updateStatus();
});
document.getElementById('btnHint').addEventListener('click', () => {
  startTimer();
  if (selectedWordIndex === null) return;
  let w = allWords[selectedWordIndex];
  let targetIdx = -1;
  for (let i = 0; i < w.word.length; i++) {
    const r = w.row + (w.dir === 'V' ? i : 0);
    const c = w.col + (w.dir === 'H' ? i : 0);
    if (inputRefs[r + ',' + c].value.toUpperCase() !== w.word[i]) { targetIdx = i; break; }
  }
  if (targetIdx === -1) {
    statusEl.textContent = 'Esa palabra ya está completa — elegí otra para pedir pista.';
    setTimeout(updateStatus, 1800);
    return;
  }
  const r = w.row + (w.dir === 'V' ? targetIdx : 0);
  const c = w.col + (w.dir === 'H' ? targetIdx : 0);
  const input = inputRefs[r + ',' + c];
  input.value = w.word[targetIdx];
  input.classList.remove('incorrect');
  input.classList.add('revealed');
  input.focus();
  hintCount++;
  hintCounterEl.textContent = \`💡 \${hintCount} pista\${hintCount === 1 ? '' : 's'} usada\${hintCount === 1 ? '' : 's'} (+\${hintCount * HINT_PENALTY_SECONDS}s)\`;
  updateStatus();
});
document.getElementById('btnReveal').addEventListener('click', () => {
  usedReveal = true;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cellData = cellMatrix[r][c];
      if (!cellData) continue;
      const input = inputRefs[r + ',' + c];
      input.value = cellData.answer;
      input.classList.remove('correct', 'incorrect');
      input.classList.add('revealed');
    }
  }
  updateStatus(); stopTimer();
  submitBox.classList.remove('on');
});
document.getElementById('btnReset').addEventListener('click', () => {
  Object.values(inputRefs).forEach((input) => { input.value = ''; input.classList.remove('correct', 'incorrect', 'revealed'); });
  statusEl.classList.remove('win');
  resetTimer();
  usedReveal = false; alreadyWon = false; hintCount = 0;
  hintCounterEl.textContent = '';
  submitBox.classList.remove('on');
  updateStatus();
});

document.getElementById('btnNew').addEventListener('click', () => {
  const layout = buildRandomLayout(allWords.map((w) => w.word));
  if (!layout) { alert('No se pudo armar uno nuevo, probá de nuevo.'); return; }
  isDailyPuzzle = false;
  practiceBadge.classList.add('on');
  btnBackToDaily.style.display = 'inline-block';
  subtitleText.textContent = 'Crucigrama de práctica — palabras al azar, no cuenta para la tabla.';
  renderPuzzle(layout);
});

btnBackToDaily.addEventListener('click', () => {
  isDailyPuzzle = true;
  practiceBadge.classList.remove('on');
  btnBackToDaily.style.display = 'none';
  subtitleText.textContent = ORIGINAL_SUBTITLE;
  renderPuzzle(DAILY_LAYOUT);
});

wireUserModal(() => {});
renderPuzzle(DAILY_LAYOUT);
</script>
</body>
</html>
`;
}

function buildIndexHtml(dates) {
  const sorted = [...dates].sort().reverse();
  const items = sorted.map((d) => `<li><a href="puzzles/${d}.html">${fmtDateEs(d)}</a></li>`).join('\n      ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Crucigrama Rioplatense · Archivo</title>
<style>
${BASE_STYLE}
.leaderboard-link{display:block;max-width:420px;margin:0 auto 24px;background:var(--tinta-2);border-radius:14px;padding:18px;text-align:center;border:1px solid rgba(242,234,217,.08);text-decoration:none;}
.leaderboard-link .big{font-family:'Fraunces',serif;font-size:22px;color:var(--yerba);font-weight:700;}
.leaderboard-link .small{font-size:12px;color:#C9CFDA;margin-top:4px;}
.list-box{max-width:520px;margin:0 auto;background:var(--tinta-2);border-radius:14px;padding:18px 24px;border:1px solid rgba(242,234,217,.08);}
.list-box ul{margin:0;padding-left:18px;line-height:1.9;font-size:14px;}
.list-box li a{color:var(--hueso);text-decoration:none;}
.list-box li a:hover{color:var(--mostaza);}
</style>
</head>
<body>
<div class="tile-band"></div>
<header>
  <h1>Crucigrama <span>Rioplatense</span></h1>
  <p class="subtitle">Un crucigrama nuevo cada día: cultura general del mundo, Latinoamérica, Uruguay y Argentina.</p>
</header>
<a class="leaderboard-link" href="leaderboard.html">
  <div class="big">🏆 Tabla de posiciones</div>
  <div class="small">Comparate con tus amigos</div>
</a>
<div class="list-box">
  <ul>
      ${items || '<li>Todavía no hay crucigramas publicados.</li>'}
  </ul>
</div>
<footer>Crucigrama Rioplatense · generado automáticamente cada día a las 08:00 (UY)</footer>
</body>
</html>
`;
}

function buildLeaderboardHtml(config) {
  const dbUrl = (config && config.firebaseDbUrl) || '';
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tabla de posiciones · Crucigrama Rioplatense</title>
<style>
${BASE_STYLE}
.board-panel{max-width:640px;margin:0 auto 24px;background:var(--tinta-2);border-radius:14px;padding:18px 20px;border:1px solid rgba(242,234,217,.08);}
.board-panel h2{font-family:'Fraunces',serif;font-size:18px;margin:0 0 12px;color:var(--mostaza);}
table{width:100%;border-collapse:collapse;font-size:14px;}
.table-scroll{overflow-x:auto;}
@media (max-width:480px){
  .board-panel{padding:14px 10px;}
  table{font-size:12px;min-width:420px;}
  td,th{padding:6px 4px;}
}
th{text-align:left;color:#8B93A6;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:6px 8px;}
td{padding:8px;border-top:1px solid rgba(242,234,217,.08);}
tr.me td{background:rgba(139,170,62,.14);font-weight:700;}
.pos{font-family:'JetBrains Mono',monospace;color:var(--mostaza);width:28px;}
.empty-msg{font-size:13px;color:#8B93A6;text-align:center;padding:14px 0;}
.warn{max-width:640px;margin:0 auto 20px;background:rgba(193,80,46,.15);border:1px solid rgba(193,80,46,.4);border-radius:10px;padding:12px 16px;font-size:13px;color:#F0A98F;text-align:center;}
</style>
</head>
<body>
<div class="tile-band"></div>
<div class="top-nav" style="max-width:640px;">
  <a href="index.html">&larr; Todos los crucigramas</a>
</div>
<header>
  <h1>Tabla de <span>posiciones</span></h1>
  <p class="subtitle">Tiempos de hoy y ranking general entre todos los que juegan.</p>
</header>

<div id="warnBox"></div>

<div class="board-panel">
  <h2>⏱ Hoy</h2>
  <div id="todayTable" class="table-scroll"><p class="empty-msg">Cargando...</p></div>
</div>

<div class="board-panel">
  <h2>🏆 Ranking general</h2>
  <div id="overallTable" class="table-scroll"><p class="empty-msg">Cargando...</p></div>
</div>

<footer>Crucigrama Rioplatense · generado automáticamente</footer>

<script>
const FIREBASE_DB_URL = ${JSON.stringify(dbUrl)};
const USER_KEY = 'crucigrama_user_v1';
function loadUser() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; } }
const me = loadUser();

function todayInMontevideo() {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date());
}
function fmtTime(s) {
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return \`\${mm}:\${ss}\`;
}

function renderTodayTable(scoresForDate) {
  const el = document.getElementById('todayTable');
  const rows = Object.values(scoresForDate || {}).sort((a, b) => a.seconds - b.seconds);
  if (!rows.length) { el.innerHTML = '<p class="empty-msg">Todavía nadie mandó su tiempo hoy.</p>'; return; }
  let html = '<table><tr><th></th><th>Jugador</th><th>Tiempo</th></tr>';
  rows.forEach((r, i) => {
    const isMe = me && r.username === me.username;
    html += \`<tr class="\${isMe ? 'me' : ''}"><td class="pos">\${i + 1}°</td><td>\${r.nombre} \${r.apellido}</td><td>\${fmtTime(r.seconds)}</td></tr>\`;
  });
  html += '</table>';
  el.innerHTML = html;
}

function renderOverallTable(allScores) {
  const el = document.getElementById('overallTable');
  const byUser = {};
  Object.values(allScores || {}).forEach((dayScores) => {
    Object.values(dayScores || {}).forEach((r) => {
      if (!byUser[r.username]) byUser[r.username] = { nombre: r.nombre, apellido: r.apellido, username: r.username, games: 0, best: Infinity, total: 0 };
      const u = byUser[r.username];
      u.games += 1;
      u.total += r.seconds;
      if (r.seconds < u.best) u.best = r.seconds;
    });
  });
  const rows = Object.values(byUser).sort((a, b) => b.games - a.games || a.best - b.best);
  if (!rows.length) { el.innerHTML = '<p class="empty-msg">Todavía no hay tiempos cargados.</p>'; return; }
  let html = '<table><tr><th></th><th>Jugador</th><th>Jugados</th><th>Mejor</th><th>Promedio</th></tr>';
  rows.forEach((r, i) => {
    const isMe = me && r.username === me.username;
    html += \`<tr class="\${isMe ? 'me' : ''}"><td class="pos">\${i + 1}°</td><td>\${r.nombre} \${r.apellido}</td><td>\${r.games}</td><td>\${fmtTime(r.best)}</td><td>\${fmtTime(Math.round(r.total / r.games))}</td></tr>\`;
  });
  html += '</table>';
  el.innerHTML = html;
}

async function load() {
  if (!FIREBASE_DB_URL) {
    document.getElementById('warnBox').innerHTML = '<div class="warn">⚠️ La tabla de posiciones todavía no está configurada (falta la base de datos en lib/config.json).</div>';
    document.getElementById('todayTable').innerHTML = '';
    document.getElementById('overallTable').innerHTML = '';
    return;
  }
  try {
    const res = await fetch(\`\${FIREBASE_DB_URL}/scores.json\`);
    const data = await res.json();
    renderTodayTable((data || {})[todayInMontevideo()]);
    renderOverallTable(data);
  } catch (err) {
    document.getElementById('warnBox').innerHTML = '<div class="warn">No se pudo cargar la tabla. Revisá tu conexión.</div>';
  }
}
load();
</script>
</body>
</html>
`;
}

module.exports = { buildPuzzleHtml, buildIndexHtml, buildLeaderboardHtml, repoInfo, pagesBaseUrl, fmtDateEs };
