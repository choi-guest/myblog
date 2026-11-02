// HUD·오버레이·대화상자 DOM 갱신. textContent와 createElement만 사용(innerHTML 금지). aria-live 문장.

import { chainMultiplier } from './game.js';
import { BOSSES, STAGE_COUNT, WEAPONS, WEAPON_KEYS, STAGES } from './config.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function formatNumber(n) {
  return Math.floor(n).toLocaleString('ko-KR');
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k of Object.keys(attrs)) el.setAttribute(k, attrs[k]);
  return el;
}

function lockIcon() {
  const svg = svgEl('svg', { viewBox: '0 0 16 16', width: '14', height: '14', 'aria-hidden': 'true', focusable: 'false', class: 'lock-icon' });
  svg.appendChild(svgEl('rect', { x: '3', y: '7', width: '10', height: '7', rx: '1.5', fill: 'currentColor' }));
  svg.appendChild(svgEl('path', { d: 'M5 7V5a3 3 0 0 1 6 0v2', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6' }));
  return svg;
}

function weaponIcon(key) {
  const svg = svgEl('svg', { viewBox: '0 0 40 40', width: '40', height: '40', 'aria-hidden': 'true', focusable: 'false', class: 'weapon-icon' });
  if (key === 'burst') {
    svg.appendChild(svgEl('circle', { cx: '20', cy: '20', r: '5', fill: 'currentColor' }));
    svg.appendChild(svgEl('circle', { cx: '20', cy: '20', r: '11', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }));
    svg.appendChild(svgEl('circle', { cx: '20', cy: '20', r: '17', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-dasharray': '4 3' }));
  } else if (key === 'homing') {
    svg.appendChild(svgEl('path', { d: 'M8 32 Q14 14 30 8', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-dasharray': '3 3' }));
    svg.appendChild(svgEl('path', { d: 'M30 8 L22 9 L28 15 Z', fill: 'currentColor' }));
    svg.appendChild(svgEl('path', { d: 'M14 34 Q22 22 34 18', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-dasharray': '3 3' }));
  } else {
    svg.appendChild(svgEl('path', { d: 'M20 10 L26 26 L20 23 L14 26 Z', fill: 'currentColor' }));
    svg.appendChild(svgEl('circle', { cx: '8', cy: '22', r: '4', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }));
    svg.appendChild(svgEl('circle', { cx: '32', cy: '22', r: '4', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }));
  }
  return svg;
}

const WEAPON_DESC = {
  burst: '퍼지는 고리로 주변 적에게 피해, 적 탄을 모두 지움',
  homing: '가장 가까운 적을 따라가는 미사일 8발',
  drone: '10초 동안 드론 2기가 탄을 막고 함께 사격'
};

export function weaponName(key) {
  return WEAPONS[key] ? WEAPONS[key].name : '';
}

// 단계 버튼 1~10
export function buildStageGrid(container, unlocked, onPick) {
  container.replaceChildren();
  for (let n = 1; n <= STAGE_COUNT; n += 1) {
    const locked = n > unlocked;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stage-btn';
    btn.dataset.stage = String(n);
    const num = document.createElement('span');
    num.className = 'stage-num';
    num.textContent = String(n);
    btn.appendChild(num);
    const boss = STAGES[n - 1].boss;
    if (boss) {
      const tag = document.createElement('span');
      tag.className = 'stage-boss';
      tag.textContent = '우두머리';
      btn.appendChild(tag);
    }
    let label = `${n}단계`;
    if (boss) label += ` (우두머리 ${BOSSES[boss].name})`;
    if (locked) {
      btn.disabled = true;
      btn.classList.add('is-locked');
      btn.appendChild(lockIcon());
      const desc = document.createElement('span');
      desc.className = 'sr-only';
      desc.id = `stage-lock-${n}`;
      desc.textContent = `${n - 1}단계를 깨면 열림`;
      btn.appendChild(desc);
      btn.setAttribute('aria-describedby', desc.id);
      btn.title = `${n - 1}단계를 깨면 열림`;
      label += ', 잠김';
    } else {
      btn.addEventListener('click', () => onPick(n));
    }
    btn.setAttribute('aria-label', label);
    container.appendChild(btn);
  }
}

// 보조 무기 카드 3장 (native radio로 라디오 그룹)
export function buildWeaponCards(container, selected, onChange) {
  container.replaceChildren();
  for (const key of WEAPON_KEYS) {
    const label = document.createElement('label');
    label.className = 'weapon-card';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'weapon';
    input.value = key;
    input.className = 'weapon-radio';
    input.checked = key === selected;
    input.addEventListener('change', () => {
      if (input.checked) onChange(key);
    });
    const body = document.createElement('span');
    body.className = 'weapon-body';
    const name = document.createElement('span');
    name.className = 'weapon-name';
    name.textContent = WEAPONS[key].name;
    const desc = document.createElement('span');
    desc.className = 'weapon-desc';
    desc.textContent = WEAPON_DESC[key];
    body.append(name, desc);
    label.append(input, weaponIcon(key), body);
    container.appendChild(label);
  }
}

export function createHud(refs) {
  const cache = {};
  let liveTimer = 0;

  function set(key, el, value) {
    if (cache[key] === value) return;
    cache[key] = value;
    el.textContent = value;
  }

  function update(s, best) {
    set('score', refs.score, formatNumber(s.score));
    set('best', refs.best, formatNumber(Math.max(best, s.score)));
    let stageText;
    if (s.phase === 'boss' || s.phase === 'bossWarning' || (s.boss && s.phase !== 'intro')) {
      stageText = `${s.stage}단계 · 우두머리`;
    } else {
      const w = Math.max(1, s.waveIndex + 1);
      stageText = `${s.stage}단계 · 웨이브 ${w}/${s.waveTotal}`;
    }
    set('stage', refs.stage, stageText);
    set('lives', refs.lives, `×${s.player.lives}`);
    set('power', refs.power, `P${s.player.power}`);
    const energy = Math.round(s.energy);
    if (cache.energy !== energy) {
      cache.energy = energy;
      refs.energyText.textContent = `${energy}%`;
      refs.energyFill.style.width = `${energy}%`;
      refs.energyBar.setAttribute('aria-valuenow', String(energy));
      refs.energyBar.classList.toggle('is-ready', energy >= 100);
    }
    const chainText = s.chain >= 2 ? `${s.chain}연쇄 ×${chainMultiplier(s.chain).toFixed(1)}` : '';
    set('chain', refs.chain, chainText);

    const ready = energy >= 100 && s.player.alive &&
      (s.phase === 'intro' || s.phase === 'playing' || s.phase === 'waveGap' || s.phase === 'bossWarning' || s.phase === 'boss');
    if (cache.ready !== ready) {
      cache.ready = ready;
      refs.specialBtn.disabled = !ready;
      refs.specialBtn.setAttribute('aria-label', ready ? '보조 무기 발동 (준비 완료)' : `보조 무기 발동 (에너지 ${energy}%)`);
    } else if (!ready && cache.readyEnergy !== energy) {
      cache.readyEnergy = energy;
      refs.specialBtn.setAttribute('aria-label', `보조 무기 발동 (에너지 ${energy}%)`);
    }

    const boss = s.boss;
    const showBoss = !!boss && !boss.defeated && s.phase === 'boss';
    if (cache.bossShown !== showBoss) {
      cache.bossShown = showBoss;
      refs.bossBar.hidden = !showBoss;
      if (showBoss) refs.bossName.textContent = boss.name;
    }
    if (showBoss) {
      const pct = Math.round((boss.hp / boss.maxHp) * 100);
      if (cache.bossPct !== pct) {
        cache.bossPct = pct;
        refs.bossFill.style.width = `${pct}%`;
        refs.bossTrack.setAttribute('aria-valuenow', String(pct));
      }
    }
    const warn = s.phase === 'bossWarning';
    if (cache.warn !== warn) {
      cache.warn = warn;
      refs.warning.hidden = !warn;
    }
  }

  function reset() {
    for (const k of Object.keys(cache)) delete cache[k];
  }

  // 짧은 시간(한두 프레임) 안에 들어온 문장을 모아 우선순위 순으로 합쳐 한 번에 읽힌다.
  // 마지막 문장 하나만 남기면 "보조 무기 준비 완료" 같은 알림이 묻히기 때문.
  let pending = [];
  let order = 0;

  function flush() {
    liveTimer = 0;
    const seen = new Set();
    const parts = pending
      .sort((a, b) => b.priority - a.priority || a.order - b.order)
      .filter((p) => (seen.has(p.text) ? false : (seen.add(p.text), true)))
      .slice(0, LIVE_MAX_PARTS)
      .map((p) => p.text.replace(/[.\s]+$/, ''));
    pending = [];
    refs.live.textContent = parts.join('. ');
  }

  function announce(text, priority = 1) {
    if (!text) return;
    pending.push({ text, priority, order: order += 1 });
    if (liveTimer) return;
    // 같은 문장도 다시 읽히도록 비웠다가 넣는다
    refs.live.textContent = '';
    liveTimer = window.setTimeout(flush, LIVE_DELAY_MS);
  }

  function showIntro(text) {
    refs.intro.hidden = !text;
    refs.intro.textContent = text || '';
  }

  return { update, reset, announce, showIntro };
}

const LIVE_DELAY_MS = 60;
const LIVE_MAX_PARTS = 3;

// 사건별 알림 우선순위 (높을수록 앞에 읽고, 개수 제한에서도 남는다)
const LIVE_PRIORITY = {
  gameOver: 6, hit: 5, stageClear: 5, bossDefeat: 5, bossAppear: 4, specialReady: 4,
  bossWarning: 3, coreExposed: 2, item: 2, waveStart: 1
};

export function livePriority(e) {
  return LIVE_PRIORITY[e.type] || 1;
}

// 사건 → aria-live 문장 (처치마다 알리지 않음)
export function liveMessage(e) {
  switch (e.type) {
    case 'waveStart':
      return `웨이브 ${e.wave} 시작, 적 ${e.count}기`;
    case 'hit':
      return e.lives > 0 ? `피격! 남은 목숨 ${e.lives}` : '피격! 남은 목숨 없음';
    case 'item':
      if (e.item === 'energy') return `에너지 결정 획득, 에너지 ${Math.round(e.energy)}%`;
      if (e.item === 'power') return e.points ? `출력 모듈 획득, ${e.points}점` : `출력 모듈 획득, 파워 P${e.power}`;
      return e.points ? `수리 키트 획득, ${e.points}점` : `수리 키트 획득, 목숨 ${e.lives}`;
    case 'specialReady':
      return '보조 무기 준비 완료';
    case 'bossWarning':
      return '강력한 반응 접근';
    case 'bossAppear':
      return `우두머리 ${e.name} 등장`;
    case 'bossDefeat':
      return `우두머리 ${e.name} 격파`;
    case 'coreExposed':
      return '코어 노출';
    case 'stageClear':
      return `${e.stage}단계 돌파`;
    default:
      return null;
  }
}

function row(dl, term, value) {
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  dd.textContent = value;
  dl.append(dt, dd);
}

export function fillClearDialog(refs, data) {
  refs.title.textContent = data.allClear ? '전 단계 돌파' : `${data.stage}단계 돌파`;
  refs.list.replaceChildren();
  row(refs.list, '기본 보너스', `${formatNumber(data.bonus.base)}점`);
  row(refs.list, '무피격 보너스', data.noHit ? `${formatNumber(data.bonus.perfect)}점` : '없음 (피격)');
  row(refs.list, `최고 연쇄 보너스 (${data.maxChain}연쇄)`, `${formatNumber(data.bonus.chain)}점`);
  row(refs.list, '합계 점수', `${formatNumber(data.score)}점`);
  if (data.allClear) refs.note.textContent = `${data.stage}단계까지 모두 돌파했습니다.`;
  else if (data.newlyUnlocked) refs.note.textContent = `${data.stage + 1}단계가 열렸습니다.`;
  else refs.note.textContent = '';
  refs.next.hidden = !!data.allClear;
}

export function fillOverDialog(refs, data) {
  refs.list.replaceChildren();
  row(refs.list, '최종 점수', `${formatNumber(data.score)}점`);
  row(refs.list, '도달', data.boss ? `${data.stage}단계 · 우두머리` : `${data.stage}단계 · 웨이브 ${Math.max(1, data.wave)}`);
  row(refs.list, '최고 연쇄', `${data.maxChain}연쇄`);
  refs.note.textContent = data.newBest ? '최고 점수를 새로 세웠습니다!' : `최고 점수 ${formatNumber(data.best)}점`;
}
