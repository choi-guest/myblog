import { generate } from './generator.js';

const STORAGE_KEY = 'sudoku-state';
const LEVELS = {
  easy: { label: '쉬움', clues: 40 },
  medium: { label: '보통', clues: 32 },
  hard: { label: '어려움', clues: 26 },
};

const $ = (selector) => document.querySelector(selector);
const board = $('[data-board]');
const overlay = $('[data-overlay]');
const overlayTitle = $('[data-overlay-title]');
const overlayText = $('[data-overlay-text]');
const overlayAction = $('[data-overlay-action]');
const mistakesEl = $('[data-mistakes]');
const timerEl = $('[data-timer]');
const pauseButton = $('[data-pause]');
const eraseButton = $('[data-erase]');
const undoButton = $('[data-undo]');
const announce = $('[data-announce]');
const digitButtons = [...document.querySelectorAll('[data-digit]')];
const levelButtons = [...document.querySelectorAll('[data-difficulty]')];

let state = null;
let selected = -1;
let resumedAt = 0; // 타이머가 돌고 있으면 마지막으로 재개한 시각, 멈췄으면 0
let tickId = 0;

const row = (i) => Math.floor(i / 9);
const col = (i) => i % 9;
const box = (i) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);

// ========== 저장 ==========

function isValidState(s) {
  return (
    s &&
    LEVELS[s.level] &&
    [s.puzzle, s.solution, s.values].every((a) => Array.isArray(a) && a.length === 81) &&
    Number.isFinite(s.elapsed) &&
    Number.isFinite(s.mistakes) &&
    Array.isArray(s.history)
  );
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return isValidState(saved) ? saved : null;
  } catch {
    return null;
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, elapsed: elapsed() }));
  } catch {
    // 저장소를 쓸 수 없으면 이번 방문 동안만 유지된다
  }
}

// ========== 타이머 ==========

function elapsed() {
  return state.elapsed + (resumedAt ? Date.now() - resumedAt : 0);
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = String(Math.floor(total / 60) % 60).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function renderTimer() {
  timerEl.textContent = formatTime(elapsed());
}

function startTimer() {
  if (resumedAt || state.done) return;
  resumedAt = Date.now();
  tickId = setInterval(() => {
    renderTimer();
    save();
  }, 1000);
}

function stopTimer() {
  if (!resumedAt) return;
  state.elapsed = elapsed();
  resumedAt = 0;
  clearInterval(tickId);
  renderTimer();
}

// ========== 게임 진행 ==========

function newGame(level) {
  stopTimer();
  const { puzzle, solution } = generate(LEVELS[level].clues);
  state = {
    level,
    puzzle,
    solution,
    values: puzzle.slice(),
    mistakes: 0,
    elapsed: 0,
    history: [],
    paused: false,
    done: false,
  };
  selected = -1;
  save();
  render();
  startTimer();
}

function setPaused(paused) {
  if (state.done) return;
  state.paused = paused;
  if (paused) stopTimer();
  else startTimer();
  save();
  render();
}

function setValue(i, value) {
  if (i < 0 || state.done || state.paused || state.puzzle[i]) return;
  const prev = state.values[i];
  if (prev === value) return;

  state.history.push([i, prev]);
  state.values[i] = value;
  if (value && value !== state.solution[i]) {
    state.mistakes++;
    announce.textContent = '틀린 숫자입니다';
  } else {
    announce.textContent = '';
  }

  if (state.values.every((v, k) => v === state.solution[k])) {
    stopTimer();
    state.done = true;
    selected = -1;
  }
  save();
  render();
}

function undo() {
  if (state.done || state.paused) return;
  const last = state.history.pop();
  if (!last) return;
  const [i, prev] = last;
  state.values[i] = prev;
  selected = i;
  save();
  render();
}

function select(i) {
  if (state.paused || state.done) return;
  selected = i;
  render();
}

// ========== 화면 ==========

function buildBoard() {
  for (let i = 0; i < 81; i++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    if (col(i) === 2 || col(i) === 5) cell.classList.add('box-right');
    if (row(i) === 2 || row(i) === 5) cell.classList.add('box-bottom');
    cell.dataset.index = i;
    board.append(cell);
  }
}

function showOverlay(title, text, actionLabel) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlayAction.textContent = actionLabel;
  overlay.hidden = false;
}

function render() {
  const { puzzle, solution, values, paused, done } = state;
  const selectedValue = selected >= 0 ? values[selected] : 0;

  [...board.children].forEach((cell, i) => {
    const v = values[i];
    cell.textContent = v || '';
    cell.classList.toggle('is-given', Boolean(puzzle[i]));
    cell.classList.toggle('is-error', Boolean(v) && v !== solution[i]);
    cell.classList.toggle('is-selected', i === selected);
    cell.classList.toggle(
      'is-related',
      selected >= 0 && i !== selected &&
        (row(i) === row(selected) || col(i) === col(selected) || box(i) === box(selected)),
    );
    cell.classList.toggle('is-same', Boolean(selectedValue) && i !== selected && v === selectedValue);
    cell.tabIndex = i === (selected >= 0 ? selected : 0) ? 0 : -1;
    cell.setAttribute('aria-label', `${row(i) + 1}행 ${col(i) + 1}열, ${v || '빈칸'}`);
  });

  // 정답으로 9개를 다 채운 숫자는 패드에서 비활성화
  const counts = new Array(10).fill(0);
  values.forEach((v, i) => {
    if (v && v === solution[i]) counts[v]++;
  });
  digitButtons.forEach((button) => {
    button.disabled = counts[button.dataset.digit] >= 9 || paused || done;
  });

  levelButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.difficulty === state.level));
  });

  mistakesEl.textContent = state.mistakes;
  mistakesEl.parentElement.parentElement.classList.toggle('has-mistakes', state.mistakes > 0);
  eraseButton.disabled = paused || done;
  undoButton.disabled = !state.history.length || paused || done;
  pauseButton.classList.toggle('is-paused', paused);
  pauseButton.setAttribute('aria-label', paused ? '계속하기' : '일시정지');
  pauseButton.disabled = done;
  board.classList.toggle('is-hidden', paused);
  renderTimer();

  if (done) {
    showOverlay('완성!', `${LEVELS[state.level].label} · ${formatTime(state.elapsed)} · 실수 ${state.mistakes}`, '새 게임');
  } else if (paused) {
    showOverlay('일시정지', `${LEVELS[state.level].label} · ${formatTime(state.elapsed)}`, '계속하기');
  } else {
    overlay.hidden = true;
  }
}

function focusSelected() {
  if (selected >= 0) board.children[selected].focus();
}

// ========== 입력 ==========

board.addEventListener('click', (event) => {
  const cell = event.target.closest('.cell');
  if (cell) select(Number(cell.dataset.index));
});

digitButtons.forEach((button) => {
  button.addEventListener('click', () => setValue(selected, Number(button.dataset.digit)));
});

eraseButton.addEventListener('click', () => setValue(selected, 0));
undoButton.addEventListener('click', undo);
pauseButton.addEventListener('click', () => setPaused(!state.paused));

overlayAction.addEventListener('click', () => {
  if (state.done) newGame(state.level);
  else setPaused(false);
});

function confirmNewGame(level) {
  const inProgress = !state.done && state.history.length > 0;
  if (!inProgress || window.confirm(`진행 중인 게임을 버리고 ${LEVELS[level].label} 새 게임을 시작할까요?`)) {
    newGame(level);
  }
}

levelButtons.forEach((button) => {
  button.addEventListener('click', () => confirmNewGame(button.dataset.difficulty));
});
$('[data-new]').addEventListener('click', () => confirmNewGame(state.level));

document.addEventListener('keydown', (event) => {
  if (event.altKey || event.target.closest('input, textarea')) return;
  const mod = event.metaKey || event.ctrlKey;

  if (mod && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
    return;
  }
  if (mod || state.paused || state.done) return;

  if (/^[1-9]$/.test(event.key)) {
    setValue(selected, Number(event.key));
  } else if (['Backspace', 'Delete', '0'].includes(event.key)) {
    setValue(selected, 0);
  } else if (event.key.startsWith('Arrow')) {
    event.preventDefault();
    const start = selected >= 0 ? selected : 0;
    const r = row(start);
    const c = col(start);
    const moves = {
      ArrowUp: [(r + 8) % 9, c],
      ArrowDown: [(r + 1) % 9, c],
      ArrowLeft: [r, (c + 8) % 9],
      ArrowRight: [r, (c + 1) % 9],
    };
    const [nr, nc] = moves[event.key] || [r, c];
    select(selected >= 0 ? nr * 9 + nc : 0);
    focusSelected();
  }
});

// 다른 앱으로 전환하거나 화면을 끄면 자동으로 일시정지
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state && !state.paused && !state.done) setPaused(true);
});
window.addEventListener('pagehide', () => {
  if (state) save();
});

// ========== 시작 ==========

buildBoard();
state = load();
if (state) {
  render();
  if (!state.paused) startTimer();
} else {
  newGame('easy');
}
