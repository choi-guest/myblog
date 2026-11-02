// 진입점: 화면 전환, requestAnimationFrame 고정 간격 루프(시간 함수 주입), 일시정지 처리.

import { WORLD, PLAYER, STAGE_COUNT } from './config.js';
import { createGame } from './game.js';
import { createRng } from './rng.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createHud, buildStageGrid, buildWeaponCards, liveMessage, livePriority, fillClearDialog, fillOverDialog,
  formatNumber, weaponName
} from './hud.js';
import * as store from './storage.js';

const $ = (id) => document.getElementById(id);

const dom = {
  canvas: $('game-canvas'),
  stageWrap: $('stage-wrap'),
  start: $('start-screen'),
  stageStep: $('stage-step'),
  weaponStep: $('weapon-step'),
  stageGrid: $('stage-grid'),
  weaponCards: $('weapon-cards'),
  weaponTitle: $('weapon-title'),
  launchBtn: $('launch-btn'),
  weaponBack: $('weapon-back'),
  startBest: $('start-best'),
  autoFire: $('autofire-toggle'),
  soundBtn: $('sound-btn'),
  soundState: $('sound-state'),
  pauseBtn: $('pause-btn'),
  specialBtn: $('special-btn'),
  touchControls: $('touch-controls'),
  pauseDialog: $('pause-dialog'),
  resumeBtn: $('resume-btn'),
  restartBtn: $('restart-btn'),
  pauseToMenu: $('pause-menu-btn'),
  clearDialog: $('clear-dialog'),
  overDialog: $('over-dialog')
};

const hud = createHud({
  score: $('hud-score'),
  best: $('hud-best'),
  stage: $('hud-stage'),
  lives: $('hud-lives'),
  power: $('hud-power'),
  energyText: $('hud-energy'),
  energyFill: $('energy-fill'),
  energyBar: $('energy-bar'),
  chain: $('hud-chain'),
  specialBtn: dom.specialBtn,
  bossBar: $('boss-bar'),
  bossName: $('boss-name'),
  bossFill: $('boss-fill'),
  bossTrack: $('boss-track'),
  warning: $('warning-band'),
  intro: $('intro-banner'),
  live: $('live')
});

const clearRefs = {
  title: $('clear-title'),
  list: $('clear-list'),
  note: $('clear-note'),
  next: $('clear-next-btn'),
  menu: $('clear-menu-btn')
};

const overRefs = {
  list: $('over-list'),
  note: $('over-note'),
  retry: $('over-retry-btn'),
  menu: $('over-menu-btn')
};

const renderer = createRenderer(dom.canvas);
const audio = createAudio();
const settings = store.loadSettings();
let best = store.loadBest();
let unlocked = store.loadUnlocked();
let selectedWeapon = store.loadWeapon();

// screen: 'menu' | 'playing' | 'paused' | 'clear' | 'over'
let screen = 'menu';
let game = null;
let run = null; // { stage, lives, power, score, weapon, maxChain, entry: { lives, power, score } }
let introShown = false;

function anyDialogOpen() {
  return dom.pauseDialog.open || dom.clearDialog.open || dom.overDialog.open;
}

const input = createInput({
  canvas: dom.canvas,
  getScale: () => renderer.getCssScale(),
  isCapturing: () => screen === 'playing' && !anyDialogOpen(),
  onPause: (e) => {
    if (screen === 'playing' && !anyDialogOpen()) {
      e.preventDefault();
      pause();
    } else if (screen === 'paused' && e.code === 'KeyP') {
      e.preventDefault();
      resume();
    }
  },
  onTouch: () => {
    document.body.classList.add('is-touch');
    dom.touchControls.hidden = false;
    fit();
  }
});
input.setAutoFire(settings.autoFire);

// ---------- 소리 ----------

function applySoundUi() {
  const on = settings.sound;
  dom.soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  dom.soundState.textContent = on ? '켬' : '끔';
}

dom.soundBtn.addEventListener('click', () => {
  settings.sound = !settings.sound;
  audio.setEnabled(settings.sound);
  store.saveSettings(settings);
  applySoundUi();
});
applySoundUi();
if (settings.sound) {
  // 저장된 설정이 켬이어도 오디오 생성은 첫 사용자 동작 이후
  const unlock = () => {
    audio.setEnabled(settings.sound);
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

dom.autoFire.checked = settings.autoFire;
dom.autoFire.addEventListener('change', () => {
  settings.autoFire = dom.autoFire.checked;
  input.setAutoFire(settings.autoFire);
  store.saveSettings(settings);
});

// ---------- 화면 전환 ----------

function setPlayingClass(on) {
  document.body.classList.toggle('is-playing', on);
  // 메뉴·결과 화면에서는 일시정지 버튼이 동작하지 않으므로 비활성(Tab 순서에서도 빠짐)
  dom.pauseBtn.disabled = !on;
}

function showMenu() {
  closeAllDialogs();
  screen = 'menu';
  game = null;
  setPlayingClass(false);
  hud.showIntro(null);
  dom.start.hidden = false;
  dom.stageStep.hidden = false;
  dom.weaponStep.hidden = true;
  dom.startBest.textContent = formatNumber(best);
  buildStageGrid(dom.stageGrid, unlocked, pickStage);
  const first = dom.stageGrid.querySelector('button:not([disabled])');
  if (first) first.focus();
}

function pickStage(n) {
  run = { stage: n, lives: PLAYER.startLives, power: PLAYER.startPower, score: 0, weapon: selectedWeapon, maxChain: 0, entry: null };
  showWeaponStep();
}

function showWeaponStep() {
  closeAllDialogs();
  screen = 'menu';
  game = null;
  setPlayingClass(false);
  hud.showIntro(null);
  dom.start.hidden = false;
  dom.stageStep.hidden = true;
  dom.weaponStep.hidden = false;
  dom.weaponTitle.textContent = `${run.stage}단계 · 보조 무기 선택`;
  buildWeaponCards(dom.weaponCards, selectedWeapon, (key) => {
    selectedWeapon = key;
  });
  const checked = dom.weaponCards.querySelector('input:checked');
  if (checked) checked.focus();
}

function launch() {
  run.weapon = selectedWeapon;
  store.saveWeapon(selectedWeapon);
  run.entry = { lives: run.lives, power: run.power, score: run.score };
  startGame();
}

function startGame() {
  closeAllDialogs();
  const seed = (Date.now() ^ (run.stage * 2654435761)) >>> 0;
  game = createGame({
    stage: run.stage, weapon: run.weapon, lives: run.lives, power: run.power, score: run.score,
    rng: createRng(seed)
  });
  hud.reset();
  renderer.clearEffects();
  input.reset();
  dom.start.hidden = true;
  screen = 'playing';
  introShown = false;
  setPlayingClass(true);
  acc = 0;
  last = timeNow();
  dom.stageWrap.focus({ preventScroll: true });
  flashFocus();
  hud.announce(`${run.stage}단계 출격 준비. 보조 무기 ${weaponName(run.weapon)}`, 3);
}

// 키보드 포커스 표시: 출격·재개 직후 잠시 굵게 보였다가 얇은 외곽선만 남긴다
let focusFlashTimer = 0;
function flashFocus() {
  dom.stageWrap.classList.add('focus-flash');
  window.clearTimeout(focusFlashTimer);
  focusFlashTimer = window.setTimeout(() => dom.stageWrap.classList.remove('focus-flash'), 1500);
}

function restartStage() {
  run.lives = run.entry.lives;
  run.power = run.entry.power;
  run.score = run.entry.score;
  startGame();
}

function closeAllDialogs() {
  for (const d of [dom.pauseDialog, dom.clearDialog, dom.overDialog]) {
    if (d.open) d.close();
  }
}

function focusGameArea() {
  if (!dom.start.hidden) return;
  dom.stageWrap.focus({ preventScroll: true });
  flashFocus();
}

function pause() {
  if (screen !== 'playing') return;
  screen = 'paused';
  input.reset();
  if (!dom.pauseDialog.open) dom.pauseDialog.showModal();
  dom.resumeBtn.focus();
}

function resume() {
  if (screen !== 'paused') return;
  if (dom.pauseDialog.open) dom.pauseDialog.close();
  screen = 'playing';
  acc = 0;
  last = timeNow();
  input.reset();
  focusGameArea();
}

dom.pauseBtn.addEventListener('click', pause);
dom.resumeBtn.addEventListener('click', resume);
dom.restartBtn.addEventListener('click', () => {
  if (dom.pauseDialog.open) dom.pauseDialog.close();
  restartStage();
});
dom.pauseToMenu.addEventListener('click', () => {
  // 진행 중 점수가 최고 점수보다 높으면 나가기 전에 저장
  if (game) updateBest(game.getState().score);
  showMenu();
});
dom.pauseDialog.addEventListener('cancel', (e) => {
  e.preventDefault();
  resume();
});
dom.clearDialog.addEventListener('cancel', (e) => e.preventDefault());
dom.overDialog.addEventListener('cancel', (e) => e.preventDefault());

dom.launchBtn.addEventListener('click', launch);
dom.weaponBack.addEventListener('click', showMenu);
dom.specialBtn.addEventListener('click', () => input.queueSpecial());
// 마우스로 게임 화면을 누르면 키보드 입력이 게임으로 가도록 포커스를 옮긴다
dom.canvas.addEventListener('pointerdown', () => {
  if (screen === 'playing') focusGameArea();
});

clearRefs.next.addEventListener('click', () => {
  dom.clearDialog.close();
  run.stage += 1;
  showWeaponStep();
});
clearRefs.menu.addEventListener('click', showMenu);
overRefs.retry.addEventListener('click', () => {
  dom.overDialog.close();
  run.lives = PLAYER.startLives;
  run.power = PLAYER.startPower;
  run.score = 0;
  run.maxChain = 0;
  run.entry = { lives: run.lives, power: run.power, score: run.score };
  startGame();
});
overRefs.menu.addEventListener('click', showMenu);

// 자동 일시정지: 탭 숨김, 창 이탈, 화면 회전
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('blur', pause);
const orientationMq = window.matchMedia('(orientation: portrait)');
if (orientationMq.addEventListener) orientationMq.addEventListener('change', pause);

// ---------- 사건 처리 ----------

function updateBest(score) {
  if (score > best) {
    best = score;
    store.saveBest(best);
    return true;
  }
  return false;
}

function onStageClear(e) {
  const s = game.getState();
  run.maxChain = Math.max(run.maxChain, e.maxChain);
  run.lives = s.player.lives;
  run.power = s.player.power;
  run.score = s.score;
  const prev = unlocked;
  unlocked = Math.max(unlocked, Math.min(STAGE_COUNT, e.stage + 1));
  store.saveUnlocked(unlocked);
  updateBest(s.score);
  screen = 'clear';
  setPlayingClass(false);
  fillClearDialog(clearRefs, {
    stage: e.stage, bonus: e.bonus, noHit: e.noHit, maxChain: e.maxChain, score: s.score,
    allClear: e.allClear, newlyUnlocked: unlocked > prev
  });
  dom.clearDialog.showModal();
  (e.allClear ? clearRefs.menu : clearRefs.next).focus();
}

function onGameOver(e) {
  run.maxChain = Math.max(run.maxChain, e.maxChain);
  const prevBest = best;
  const newBest = updateBest(e.score);
  screen = 'over';
  setPlayingClass(false);
  fillOverDialog(overRefs, {
    score: e.score, stage: e.stage, wave: e.wave, boss: e.boss, maxChain: run.maxChain,
    newBest, best: Math.max(prevBest, best)
  });
  hud.announce(newBest ? `게임 오버. 최고 점수 갱신 ${formatNumber(e.score)}점` : `게임 오버. 점수 ${formatNumber(e.score)}점`, livePriority(e));
  dom.overDialog.showModal();
  overRefs.retry.focus();
}

const SOUND_FOR = {
  fire: 'fire', kill: 'kill', hit: 'hit', special: 'special', item: 'item', deflect: 'deflect',
  reflect: 'deflect', bossAppear: 'boss', bossDefeat: 'boss', stageClear: 'clear'
};

function handleEvents(events) {
  if (events.length === 0) return;
  renderer.addEvents(events);
  for (const e of events) {
    const snd = SOUND_FOR[e.type];
    if (snd) audio.play(snd);
    const msg = liveMessage(e);
    // 같은 스텝·프레임의 문장은 hud.announce가 우선순위대로 합친다
    if (msg) hud.announce(msg, livePriority(e));
    if (e.type === 'stageClear') {
      onStageClear(e);
    } else if (e.type === 'gameOver') {
      onGameOver(e);
    }
  }
}

// ---------- 루프 ----------

let timeNow = () => performance.now();
let acc = 0;
let last = 0;

function updateIntro(s) {
  const show = screen === 'playing' && s && s.phase === 'intro';
  if (show !== introShown) {
    introShown = show;
    hud.showIntro(show ? `${s.stage}단계 · 출격 준비` : null);
  }
}

function frame(now) {
  let raw = (now - last) / 1000;
  last = now;
  if (!(raw >= 0)) raw = 0;
  const frameDt = Math.min(raw, 0.1);
  if (game && screen === 'playing') {
    acc += Math.min(raw, 0.25);
    let steps = 0;
    while (acc >= WORLD.step && steps < WORLD.maxStepsPerFrame) {
      const events = game.step(WORLD.step, input.sample());
      acc -= WORLD.step;
      steps += 1;
      handleEvents(events);
      if (screen !== 'playing') break;
    }
    if (acc >= WORLD.step) acc = 0; // 너무 밀리면 버린다(한 번에 과하게 진행하지 않음)
  }
  const s = game ? game.getState() : null;
  if (s) {
    hud.update(s, best);
    updateIntro(s);
  }
  renderer.draw(s, screen === 'paused' ? 0 : frameDt);
}

export function startLoop(opts = {}) {
  timeNow = opts.now || (() => performance.now());
  const raf = opts.raf || ((cb) => window.requestAnimationFrame(cb));
  last = timeNow();
  const tick = () => {
    frame(timeNow());
    raf(tick);
  };
  raf(tick);
}

// ---------- 크기·테마·감속 ----------

// 게임 영역 위(헤더·HUD)와 아래(터치 조작 띠)의 실제 높이를 재서 --chrome에 넣는다.
// CSS는 (화면 높이 − --chrome)에 맞춰 360:640 게임 영역의 크기를 정한다.
let chromePx = -1;
function measureChrome() {
  const top = dom.stageWrap.getBoundingClientRect().top + window.scrollY;
  const below = dom.touchControls.hidden ? 0 : dom.touchControls.offsetHeight;
  const px = Math.ceil(top + below + 8);
  if (px !== chromePx) {
    chromePx = px;
    document.documentElement.style.setProperty('--chrome', `${px}px`);
  }
}

function fit() {
  measureChrome();
  renderer.resize();
}

if (window.ResizeObserver) {
  const ro = new ResizeObserver(fit);
  ro.observe(dom.stageWrap);
  ro.observe($('hud'));
}
window.addEventListener('resize', fit);

const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
const onTheme = () => renderer.refreshPalette();
if (darkMq.addEventListener) darkMq.addEventListener('change', onTheme);

const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
renderer.setReducedMotion(motionMq.matches);
if (motionMq.addEventListener) motionMq.addEventListener('change', () => renderer.setReducedMotion(motionMq.matches));

// 초기 HUD 값
$('hud-best').textContent = formatNumber(best);

fit();
showMenu();
startLoop();
