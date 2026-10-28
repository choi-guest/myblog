// 스도쿠 퍼즐 생성기. DOM에 접근하지 않는 순수 함수만 둔다.
// 칸 번호는 0~80 (행 * 9 + 열), 빈칸은 0.

// 각 칸과 같은 행·열·박스에 있는 칸 20개
const PEERS = Array.from({ length: 81 }, (_, i) => {
  const r = Math.floor(i / 9);
  const c = i % 9;
  const br = r - (r % 3);
  const bc = c - (c % 3);
  const set = new Set();
  for (let k = 0; k < 9; k++) {
    set.add(r * 9 + k);
    set.add(k * 9 + c);
    set.add((br + Math.floor(k / 3)) * 9 + bc + (k % 3));
  }
  set.delete(i);
  return [...set];
});

const ALL = 0b1111111110; // 비트 1~9

function candidates(grid, i) {
  let used = 0;
  for (const p of PEERS[i]) used |= 1 << grid[p];
  return ALL & ~used;
}

function bitCount(mask) {
  let n = 0;
  while (mask) {
    mask &= mask - 1;
    n++;
  }
  return n;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// 후보가 가장 적은 빈칸을 고른다. 막힌 칸이 있으면 mask 0을 돌려준다.
function pickCell(grid) {
  let best = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;
    const mask = candidates(grid, i);
    const count = bitCount(mask);
    if (count < bestCount) {
      best = i;
      bestMask = mask;
      bestCount = count;
      if (count <= 1) break;
    }
  }
  return { index: best, mask: bestMask };
}

// 해의 개수를 limit까지만 센다. grid는 원래 상태로 되돌려 놓는다.
export function countSolutions(grid, limit = 2) {
  const { index, mask } = pickCell(grid);
  if (index === -1) return 1;
  let count = 0;
  for (let d = 1; d <= 9 && count < limit; d++) {
    if (!(mask & (1 << d))) continue;
    grid[index] = d;
    count += countSolutions(grid, limit - count);
  }
  grid[index] = 0;
  return count;
}

function fillRandom(grid) {
  const { index, mask } = pickCell(grid);
  if (index === -1) return true;
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const d of digits) {
    if (!(mask & (1 << d))) continue;
    grid[index] = d;
    if (fillRandom(grid)) return true;
  }
  grid[index] = 0;
  return false;
}

// clues개 근처까지 숫자를 지우되, 해가 하나뿐인 상태는 항상 유지한다.
export function generate(clues) {
  const grid = new Array(81).fill(0);
  fillRandom(grid);
  const solution = grid.slice();

  let filled = 81;
  for (const i of shuffle([...Array(81).keys()])) {
    if (filled <= clues) break;
    const value = grid[i];
    grid[i] = 0;
    if (countSolutions(grid) === 1) {
      filled--;
    } else {
      grid[i] = value;
    }
  }
  return { puzzle: grid, solution };
}
