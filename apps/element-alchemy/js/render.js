// 상태 → DOM 그리기, aria-live 문장 생성 (textContent와 el()로만 그린다)
import { BOARD_SIZE, ELEMENTS, CODEX, ROMAN } from './elements.js';

const MOVE_MS = 120;

const DIR_PHRASE = {
  up: '위쪽으로',
  down: '아래쪽으로',
  left: '왼쪽으로',
  right: '오른쪽으로'
};

const CODEX_LABEL = {
  compound: '화합물 도감 완성',
  rare: '희귀 원소 도감 완성',
  all: '도감 11종 전부 완성'
};

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? '' : String(value));
  });
  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child === null || child === undefined) return;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

export function gradeLabel(grade) {
  return ROMAN[grade] || String(grade);
}

function elementName(key) {
  return ELEMENTS[key] ? ELEMENTS[key].name : '';
}

function buildTileFace(tile, small = false) {
  const info = ELEMENTS[tile.element];
  return el('div', {
    class: small ? 'tile-face tile-face-small' : 'tile-face',
    dataset: { el: tile.element, grade: String(tile.grade) }
  }, [
    el('span', { class: 'tile-symbol', text: info.symbol }),
    el('span', { class: 'tile-name', text: info.name }),
    small ? null : el('span', { class: 'tile-grade', text: gradeLabel(tile.grade) })
  ]);
}

function setPos(node, [r, c]) {
  node.style.setProperty('--r', String(r));
  node.style.setProperty('--c', String(c));
}

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

export function createRenderer(refs) {
  const tileEls = new Map();
  const cellEls = [];
  const codexItems = new Map();
  let tileLayer = null;
  let epoch = 0;

  const initBoard = () => {
    const cellsLayer = el('div', { class: 'board-cells' });
    for (let r = 0; r < BOARD_SIZE; r += 1) {
      const row = el('div', { class: 'board-row', role: 'row' });
      const rowCells = [];
      for (let c = 0; c < BOARD_SIZE; c += 1) {
        const cell = el('div', { class: 'board-cell', role: 'gridcell', 'aria-label': `${r + 1}행 ${c + 1}열, 빈칸` });
        rowCells.push(cell);
        row.append(cell);
      }
      cellEls.push(rowCells);
      cellsLayer.append(row);
    }
    tileLayer = el('div', { class: 'tile-layer', 'aria-hidden': 'true' });
    refs.board.replaceChildren(cellsLayer, tileLayer);
  };

  const initCodex = () => {
    const items = CODEX.map(({ result, inputs }) => {
      const swatch = el('span', { class: 'codex-swatch', 'aria-hidden': 'true', text: '?' });
      const name = el('span', { class: 'codex-name', text: '?' });
      const hint = el('span', { class: 'codex-hint', text: `${elementName(inputs[0])} + ${elementName(inputs[1])}` });
      const item = el('li', { class: 'codex-item', dataset: { found: 'false' } }, [swatch, el('span', { class: 'codex-text' }, [name, hint])]);
      codexItems.set(result, { item, swatch, name });
      return item;
    });
    refs.codexList.replaceChildren(...items);
  };

  const updateCellLabels = (board) => {
    board.forEach((row, r) => row.forEach((tile, c) => {
      const label = tile
        ? `${r + 1}행 ${c + 1}열, ${elementName(tile.element)} 등급 ${tile.grade}`
        : `${r + 1}행 ${c + 1}열, 빈칸`;
      cellEls[r][c].setAttribute('aria-label', label);
    }));
  };

  // 판 상태와 DOM 타일을 맞춘다
  const syncBoard = (state, { merged = new Set(), spawned = new Set() } = {}) => {
    const seen = new Set();
    state.board.forEach((row, r) => row.forEach((tile, c) => {
      if (!tile) return;
      seen.add(tile.id);
      let node = tileEls.get(tile.id);
      if (!node) {
        node = el('div', { class: 'tile' }, [buildTileFace(tile)]);
        if (merged.has(tile.id)) node.classList.add('is-merged');
        if (spawned.has(tile.id)) node.classList.add('is-new');
        setPos(node, [r, c]);
        tileEls.set(tile.id, node);
        tileLayer.append(node);
      } else {
        setPos(node, [r, c]);
        node.classList.remove('is-consumed');
      }
    }));
    tileEls.forEach((node, id) => {
      if (!seen.has(id)) {
        node.remove();
        tileEls.delete(id);
      }
    });
    updateCellLabels(state.board);
  };

  // 반환값: 끝까지 그렸으면 true, 도중에 reset()되어 그리지 않았으면 false
  const animateTurn = async (result, state, reduced) => {
    const myEpoch = epoch;
    const merged = new Set(result.events.filter((e) => e.tileId).map((e) => e.tileId));
    const spawned = new Set(result.spawned.map((t) => t.id));
    if (!reduced) {
      result.transitions.forEach((t) => {
        const node = tileEls.get(t.id);
        if (!node) return;
        if (t.consumed) node.classList.add('is-consumed');
        setPos(node, t.to);
      });
      await wait(MOVE_MS + 10);
      if (myEpoch !== epoch) return false;
    }
    syncBoard(state, { merged, spawned });
    return true;
  };

  const renderScore = (state, best, gained) => {
    refs.score.textContent = String(state.score);
    refs.best.textContent = String(best);
    refs.turn.textContent = String(state.turn);
    const gain = refs.scoreGain;
    gain.classList.remove('is-showing');
    if (gained > 0) {
      gain.textContent = `+${gained}`;
      void gain.offsetWidth;
      gain.classList.add('is-showing');
    } else {
      gain.textContent = '';
    }
  };

  const renderQueue = (state) => {
    refs.queue.forEach((slot, i) => {
      const key = state.queue[i];
      slot.replaceChildren(key ? buildTileFace({ element: key, grade: 1 }, true) : '');
      slot.setAttribute('aria-label', key ? elementName(key) : '없음');
    });
  };

  const renderCodex = (state) => {
    const found = new Set(state.codex);
    codexItems.forEach(({ item, swatch, name }, key) => {
      const isFound = found.has(key);
      item.dataset.found = String(isFound);
      if (isFound) {
        item.dataset.el = key;
        swatch.textContent = ELEMENTS[key].symbol;
        name.textContent = ELEMENTS[key].name;
      } else {
        delete item.dataset.el;
        swatch.textContent = '?';
        name.textContent = '?';
      }
    });
    refs.codexCount.textContent = `${state.codexCount}/${state.codexTotal}`;
  };

  const renderAll = (state, best) => {
    syncBoard(state, { spawned: new Set(state.board.flat().filter(Boolean).map((t) => t.id)) });
    renderScore(state, best, 0);
    renderQueue(state);
    renderCodex(state);
  };

  const reset = () => {
    epoch += 1;
    tileEls.forEach((node) => node.remove());
    tileEls.clear();
  };

  // 같은 문장이 반복돼도 다시 읽히도록 비운 뒤 다음 프레임에 넣고,
  // 직전과 같으면 끝에 줄바꿈 없는 공백을 토글한다.
  let lastAnnounce = '';
  let announceToggle = false;
  let announceFrame = 0;
  const announce = (text) => {
    let out = text;
    if (text === lastAnnounce) {
      announceToggle = !announceToggle;
      if (announceToggle) out = `${text} `;
    } else {
      announceToggle = false;
    }
    lastAnnounce = text;
    refs.status.textContent = '';
    cancelAnimationFrame(announceFrame);
    announceFrame = requestAnimationFrame(() => {
      refs.status.textContent = out;
    });
  };

  const showDialog = ({ title, lines, actions }) => {
    const dlg = refs.dialog;
    refs.dialogTitle.textContent = title;
    refs.dialogBody.replaceChildren(...lines.map((line) => el('p', { text: line })));
    let primary = null;
    const buttons = actions.map((action) => {
      const btn = el('button', { type: 'button', class: action.primary ? 'btn btn-primary' : 'btn', text: action.label });
      btn.addEventListener('click', action.onClick);
      if (action.primary) primary = btn;
      return btn;
    });
    refs.dialogActions.replaceChildren(...buttons);
    if (!dlg.open) dlg.showModal();
    (primary || buttons[0]).focus();
  };

  initBoard();
  initCodex();

  return { syncBoard, animateTurn, renderScore, renderQueue, renderCodex, renderAll, reset, announce, showDialog };
}

// 턴 결과를 스크린 리더용 문장으로
export function describeTurn(result, state) {
  if (!result.moved) {
    if (state.over) return '게임이 끝났습니다. 새 게임 버튼으로 다시 시작하세요.';
    return '그 방향으로는 움직일 수 없습니다.';
  }
  const discovered = new Set(result.events.filter((e) => e.type === 'discover').map((e) => e.element));
  // 일반 반응은 쉼표로 이어 한 문장, 발견·도감 완성은 각각 느낌표 문장으로
  const parts = [];
  const highlights = [];
  result.events.forEach((e) => {
    const label = `${elementName(e.element)} ${gradeLabel(e.grade)}`;
    if (e.type === 'upgrade') parts.push(`${label} 강화`);
    else if (e.type === 'transmute') {
      if (discovered.has(e.element)) {
        highlights.push(`${label} 발견!`);
        discovered.delete(e.element);
      } else {
        parts.push(`${label} 변성`);
      }
    } else if (e.type === 'sublimate') parts.push(`${label} 승화`);
    else if (e.type === 'codex') highlights.push(`${CODEX_LABEL[e.tier]}!`);
  });
  let text = `${DIR_PHRASE[result.dir]} 밀었습니다.`;
  if (parts.length) text += ` ${parts.join(', ')}.`;
  if (highlights.length) text += ` ${highlights.join(' ')}`;
  if (result.chain >= 2) text += ` 연쇄 ${result.chain}회.`;
  if (result.gained > 0) text += ` +${result.gained}점.`;
  if (state.queue[0]) text += ` 다음 원소: ${elementName(state.queue[0])}.`;
  if (result.over) text += ' 더 이상 움직일 수 없어 게임이 끝났습니다.';
  return text;
}
