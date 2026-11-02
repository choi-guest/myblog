// 진입점: 모듈 연결, 새 게임/계속하기 처리
import { createGame } from './game.js';
import { createRenderer, describeTurn } from './render.js';
import { setupInput } from './input.js';
import { loadBest, saveBest } from './storage.js';
import { ELEMENTS } from './elements.js';

const $ = (id) => document.getElementById(id);

const refs = {
  board: $('board'),
  score: $('score'),
  best: $('best'),
  turn: $('turn'),
  scoreGain: $('score-gain'),
  queue: [$('next-0'), $('next-1')],
  codexList: $('codex-list'),
  codexCount: $('codex-count'),
  status: $('status'),
  dialog: $('result-dialog'),
  dialogTitle: $('dialog-title'),
  dialogBody: $('dialog-body'),
  dialogActions: $('dialog-actions')
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const game = createGame();
const renderer = createRenderer(refs);

let best = loadBest();
let bestAtStart = best;
let busy = false;
let pending = null;
let onDialogClose = null;
let generation = 0;

function updateBest(score) {
  if (score > best) {
    best = score;
    saveBest(best);
  }
}

function closeDialog() {
  if (refs.dialog.open) refs.dialog.close();
}

refs.dialog.addEventListener('close', () => {
  const handler = onDialogClose;
  onDialogClose = null;
  if (handler) handler();
});

function startNewGame() {
  generation += 1;
  onDialogClose = null;
  closeDialog();
  game.newGame();
  busy = false;
  pending = null;
  bestAtStart = best;
  renderer.reset();
  const state = game.getState();
  renderer.renderAll(state, best);
  renderer.announce(`새 게임을 시작했습니다. 다음 원소: ${ELEMENTS[state.queue[0]].name}.`);
}

function showOver() {
  const state = game.getState();
  const record = state.score > bestAtStart && state.score > 0;
  pending = null;
  onDialogClose = null;
  renderer.showDialog({
    title: '작업대가 가득 찼습니다',
    lines: [
      `최종 점수 ${state.score}점 · ${state.turn}턴`,
      `도감 ${state.codexCount}/${state.codexTotal}`,
      record ? '최고 점수를 갱신했습니다!' : `최고 점수 ${best}점`
    ],
    actions: [
      { label: '다시 하기', primary: true, onClick: startNewGame }
    ]
  });
}

function showWin() {
  const state = game.getState();
  pending = null;
  onDialogClose = () => {
    if (game.getState().over) showOver();
    else refs.board.focus();
  };
  renderer.showDialog({
    title: '대업 달성!',
    lines: [
      '현자의 돌을 완성했습니다.',
      `점수 ${state.score}점 · ${state.turn}턴 · 도감 ${state.codexCount}/${state.codexTotal}`,
      '계속해서 점수를 더 올릴 수 있습니다.'
    ],
    actions: [
      { label: '계속하기', primary: true, onClick: closeDialog },
      { label: '새 게임', onClick: startNewGame }
    ]
  });
}

async function runTurn(dir) {
  const myGeneration = generation;
  const result = game.move(dir);
  const state = game.getState();
  if (!result.moved) {
    renderer.announce(describeTurn(result, state));
    return;
  }
  const reduced = reducedMotion.matches;
  busy = !reduced;
  updateBest(state.score);
  renderer.renderScore(state, best, result.gained);
  renderer.renderQueue(state);
  renderer.renderCodex(state);
  renderer.announce(describeTurn(result, state));
  const drawn = await renderer.animateTurn(result, state, reduced);
  // 애니메이션 도중 새 게임이 시작됐으면 이 턴의 남은 처리(그리기·대화상자·버퍼)를 모두 버린다
  if (!drawn || myGeneration !== generation) return;
  busy = false;
  if (result.won) {
    showWin();
    return;
  }
  if (result.over) {
    showOver();
    return;
  }
  if (pending) {
    const next = pending;
    pending = null;
    runTurn(next);
  }
}

function handleDirection(dir) {
  if (refs.dialog.open) return;
  if (busy) {
    if (!pending) pending = dir;
    return;
  }
  runTurn(dir);
}

setupInput({
  board: refs.board,
  buttons: Array.from(document.querySelectorAll('.dpad [data-dir]')),
  onDirection: handleDirection
});

$('new-game').addEventListener('click', startNewGame);

startNewGame();
