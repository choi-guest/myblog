// 게임 상태와 규칙 — DOM 접근 금지 순수 로직
import {
  BOARD_SIZE,
  MAX_GRADE,
  QUEUE_LENGTH,
  START_TILES,
  BONUS_SPAWN_EVERY,
  ELEMENTS,
  BASE_ELEMENTS,
  CODEX,
  CODEX_TIER_COUNTS,
  SCORE,
  FINAL_ELEMENT,
  findRecipe
} from './elements.js';

export const DIRECTIONS = ['up', 'down', 'left', 'right'];

// 두 타일의 반응 판정. a = 이동 방향 앞쪽, b = 뒤에서 온 타일.
export function react(a, b) {
  if (!a || !b) return null;
  if (a.element === b.element) {
    if (a.grade !== b.grade) return null;
    if (a.grade < MAX_GRADE) {
      return { type: 'upgrade', element: a.element, grade: a.grade + 1 };
    }
    return { type: 'sublimate', element: a.element, grade: a.grade };
  }
  const result = findRecipe(a.element, b.element);
  if (result && a.grade === b.grade) {
    return { type: 'transmute', element: result, grade: a.grade };
  }
  return null;
}

// 반응 점수 (배율 적용 전)
export function reactionPoints(reaction) {
  const tier = ELEMENTS[reaction.element].tier;
  if (reaction.type === 'upgrade') return SCORE.upgrade(reaction.grade);
  if (reaction.type === 'transmute') return SCORE.transmute[tier] * reaction.grade;
  if (reaction.type === 'sublimate') return SCORE.sublimate[tier];
  return 0;
}

export function chainMultiplier(count) {
  return count >= 2 ? 1 + SCORE.chainStep * (count - 1) : 1;
}

// 방향별 각 줄의 좌표 목록 (앞쪽 끝 칸부터)
function lineCoords(dir) {
  const lines = [];
  for (let i = 0; i < BOARD_SIZE; i += 1) {
    const line = [];
    for (let j = 0; j < BOARD_SIZE; j += 1) {
      if (dir === 'left') line.push([i, j]);
      else if (dir === 'right') line.push([i, BOARD_SIZE - 1 - j]);
      else if (dir === 'up') line.push([j, i]);
      else line.push([BOARD_SIZE - 1 - j, i]);
    }
    lines.push(line);
  }
  return lines;
}

// 한 줄 처리. tiles: 앞쪽부터 빈칸 제외한 타일 배열.
// 반환: { slots: [{ tile, reacted, ids }], vanished: [{ ids, slot }], reactions, changed }
function processLine(tiles, makeId) {
  const slots = [];
  const vanished = [];
  const reactions = [];
  tiles.forEach((b) => {
    const last = slots[slots.length - 1];
    const r = last && !last.reacted ? react(last.tile, b) : null;
    if (r && (r.type === 'upgrade' || r.type === 'transmute')) {
      last.tile = { id: makeId(), element: r.element, grade: r.grade };
      last.reacted = true;
      last.ids = last.ids.concat(b.id);
      reactions.push({ ...r, slot: slots.length - 1, tileId: last.tile.id });
    } else if (r && r.type === 'sublimate') {
      vanished.push({ ids: last.ids.concat(b.id), slot: slots.length - 1 });
      slots.pop();
      reactions.push({ ...r, slot: slots.length, tileId: null });
    } else {
      slots.push({ tile: b, reacted: false, ids: [b.id] });
    }
  });
  return { slots, vanished, reactions };
}

function emptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

function cloneBoard(board) {
  return board.map((row) => row.map((t) => (t ? { ...t } : null)));
}

// 보드를 한 방향으로 민 결과(상태 변경 없음)
function slide(board, dir, makeId) {
  const next = emptyBoard();
  const transitions = [];
  const reactions = [];
  let changed = false;
  lineCoords(dir).forEach((coords) => {
    const tiles = [];
    const originIndex = new Map();
    coords.forEach(([r, c], idx) => {
      const t = board[r][c];
      if (t) {
        tiles.push(t);
        originIndex.set(t.id, idx);
      }
    });
    const res = processLine(tiles, makeId);
    if (res.reactions.length > 0) changed = true;
    res.slots.forEach((slot, i) => {
      const [r, c] = coords[i];
      next[r][c] = slot.tile;
      if (!slot.reacted && originIndex.get(slot.tile.id) !== i) changed = true;
      slot.ids.forEach((id) => {
        transitions.push({ id, to: [r, c], consumed: slot.reacted });
      });
    });
    res.vanished.forEach((v) => {
      const [r, c] = coords[v.slot];
      v.ids.forEach((id) => transitions.push({ id, to: [r, c], consumed: true }));
    });
    res.reactions.forEach((rx) => {
      const [r, c] = coords[Math.min(rx.slot, BOARD_SIZE - 1)];
      reactions.push({ ...rx, pos: [r, c] });
    });
  });
  return { board: next, transitions, reactions, changed };
}

export function canMove(board, dir) {
  return slide(board, dir, () => -1).changed;
}

export function hasAnyMove(board) {
  return DIRECTIONS.some((dir) => canMove(board, dir));
}

function emptyCells(board) {
  const cells = [];
  board.forEach((row, r) => row.forEach((t, c) => { if (!t) cells.push([r, c]); }));
  return cells;
}

function isFull(board) {
  return emptyCells(board).length === 0;
}

export function createGame({ rng = Math.random } = {}) {
  let nextId = 1;
  let state = null;

  const makeId = () => {
    const id = nextId;
    nextId += 1;
    return id;
  };

  const randInt = (n) => {
    const v = Math.floor(rng() * n);
    return Math.min(Math.max(v, 0), n - 1);
  };

  // 같은 원소 3연속 금지 뽑기
  const drawElement = () => {
    const h = state.history;
    let options = BASE_ELEMENTS;
    if (h.length >= 2 && h[h.length - 1] === h[h.length - 2]) {
      options = BASE_ELEMENTS.filter((e) => e !== h[h.length - 1]);
    }
    const pick = options[randInt(options.length)];
    h.push(pick);
    return pick;
  };

  const placeAtRandom = (element) => {
    const cells = emptyCells(state.board);
    if (cells.length === 0) return null;
    const [r, c] = cells[randInt(cells.length)];
    const tile = { id: makeId(), element, grade: 1 };
    state.board[r][c] = tile;
    return { ...tile, pos: [r, c] };
  };

  // 큐 맨 앞을 꺼내 놓고 큐 끝을 채움. 빈칸이 없으면 큐를 소비하지 않음.
  const spawnFromQueue = () => {
    if (emptyCells(state.board).length === 0) return null;
    const element = state.queue.shift();
    state.queue.push(drawElement());
    return placeAtRandom(element);
  };

  const newGame = () => {
    // nextId는 게임이 바뀌어도 이어서 증가시킨다 (이전 게임 타일과 id가 겹치지 않게)
    state = {
      board: emptyBoard(),
      score: 0,
      turn: 0,
      queue: [],
      history: [],
      codex: new Set(),
      codexBonus: { compound: false, rare: false, all: false },
      won: false,
      over: false
    };
    const pool = BASE_ELEMENTS.slice();
    const spawned = [];
    for (let i = 0; i < START_TILES; i += 1) {
      const element = pool.splice(randInt(pool.length), 1)[0];
      state.history.push(element);
      spawned.push(placeAtRandom(element));
    }
    for (let i = 0; i < QUEUE_LENGTH; i += 1) state.queue.push(drawElement());
    return spawned;
  };

  const codexCount = () => state.codex.size;

  const checkCodexBonuses = (events) => {
    const found = [...state.codex];
    const countTier = (tier) => found.filter((k) => ELEMENTS[k].tier === tier).length;
    const checks = [
      ['compound', countTier('compound') === CODEX_TIER_COUNTS.compound],
      ['rare', countTier('rare') === CODEX_TIER_COUNTS.rare],
      ['all', found.length === CODEX_TIER_COUNTS.all]
    ];
    checks.forEach(([key, ok]) => {
      if (ok && !state.codexBonus[key]) {
        state.codexBonus[key] = true;
        events.push({ type: 'codex', element: null, grade: null, tier: key, points: SCORE.codexBonus[key] });
      }
    });
  };

  const move = (dir) => {
    const empty = { moved: false, events: [], gained: 0, won: false, over: state.over, dir, transitions: [], spawned: [], chain: 0, multiplier: 1 };
    if (state.over || !DIRECTIONS.includes(dir)) return empty;
    const res = slide(state.board, dir, makeId);
    if (!res.changed) return empty;

    state.board = res.board;
    state.turn += 1;

    const events = [];
    let reactionSum = 0;
    let won = false;
    const bonusEvents = [];
    res.reactions.forEach((rx) => {
      const points = reactionPoints(rx);
      reactionSum += points;
      events.push({ type: rx.type, element: rx.element, grade: rx.grade, points, pos: rx.pos, tileId: rx.tileId });
      if (rx.type === 'transmute' && !state.codex.has(rx.element)) {
        state.codex.add(rx.element);
        const tier = ELEMENTS[rx.element].tier;
        bonusEvents.push({ type: 'discover', element: rx.element, grade: rx.grade, points: SCORE.discovery[tier] });
      }
      if (rx.type === 'transmute' && rx.element === FINAL_ELEMENT && !state.won) {
        state.won = true;
        won = true;
      }
    });
    checkCodexBonuses(bonusEvents);

    const chain = res.reactions.length;
    const multiplier = chainMultiplier(chain);
    const reactionTotal = Math.round(reactionSum * multiplier);
    const bonusTotal = bonusEvents.reduce((s, e) => s + e.points, 0);
    const gained = reactionTotal + bonusTotal;
    state.score += gained;

    const spawned = [];
    const first = spawnFromQueue();
    if (first) spawned.push(first);
    if (state.turn % BONUS_SPAWN_EVERY === 0) {
      const extra = spawnFromQueue();
      if (extra) spawned.push(extra);
    }

    if (isFull(state.board) && !hasAnyMove(state.board)) state.over = true;

    return {
      moved: true,
      events: events.concat(bonusEvents),
      gained,
      won,
      over: state.over,
      dir,
      transitions: res.transitions,
      spawned,
      chain,
      multiplier
    };
  };

  const getState = () => ({
    board: cloneBoard(state.board),
    score: state.score,
    turn: state.turn,
    queue: state.queue.slice(),
    codex: [...state.codex],
    codexCount: codexCount(),
    codexTotal: CODEX.length,
    won: state.won,
    over: state.over
  });

  // 테스트 전용: 판을 직접 지정 (타일 id는 새로 부여). 화면 코드에서 호출하지 않는다.
  const _setBoardForTest = (layout) => {
    state.board = layout.map((row) => row.map((t) => (t ? { id: makeId(), element: t.element, grade: t.grade } : null)));
    state.over = false;
  };

  newGame();

  return { newGame, move, getState, _setBoardForTest };
}
