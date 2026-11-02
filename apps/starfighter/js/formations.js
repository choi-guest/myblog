// 대형 4종(+ 9단계 복합 대형)의 자리 좌표 계산. 시간 t → 위치. 순수 함수.
// 대형은 회전하거나 표류할 뿐 아래로 내려오지 않는다.

import { FORMATIONS } from './config.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

function ringSlots(slots, n, cx, cy, radius, spin, angleOffset) {
  for (let i = 0; i < n; i += 1) {
    slots.push({ kind: 'ring', cx, cy, radius, angle: angleOffset + (TAU * i) / n - Math.PI / 2, spin });
  }
}

function buildRing(slots, n) {
  const f = FORMATIONS.ring;
  const spin = f.degPerSec * DEG;
  if (n <= f.singleMax) {
    ringSlots(slots, n, f.cx, f.cy, f.radius, spin, 0);
    return;
  }
  const outer = Math.ceil(n * 0.6);
  const inner = n - outer;
  // 바깥·안쪽 자리를 번갈아 넣어 유형이 고르게 퍼지게 한다
  const tmpOuter = [];
  const tmpInner = [];
  ringSlots(tmpOuter, outer, f.cx, f.cy, f.outerRadius, spin, 0);
  ringSlots(tmpInner, inner, f.cx, f.cy, f.innerRadius, spin, Math.PI / inner);
  let a = 0;
  let b = 0;
  while (a < tmpOuter.length || b < tmpInner.length) {
    if (a < tmpOuter.length) slots.push(tmpOuter[a++]);
    if (a < tmpOuter.length && a % 3 === 2) slots.push(tmpOuter[a++]);
    if (b < tmpInner.length) slots.push(tmpInner[b++]);
  }
}

function veeCandidates(cx, apexY, dx0, dxStep, dyStep, rows, innerRows, innerShift) {
  const list = [];
  for (let i = 0; i < rows; i += 1) {
    const dx = dx0 + dxStep * i;
    const y = apexY - dyStep * i;
    list.push([cx - dx, y], [cx + dx, y]);
  }
  for (let i = 0; i < innerRows; i += 1) {
    const dx = dx0 + dxStep * i;
    const y = apexY - innerShift - dyStep * i;
    list.push([cx - dx, y], [cx + dx, y]);
  }
  return list;
}

function buildVee(slots, n, opts) {
  const { cx, apexY, drift, period, dx0, dxStep, dyStep, rows, innerRows, innerShift } = opts;
  const list = veeCandidates(cx, apexY, dx0, dxStep, dyStep, rows, innerRows, innerShift);
  let count = n;
  if (n % 2 === 1) {
    slots.push({ kind: 'vee', bx: cx, by: apexY + 26, drift, period });
    count -= 1;
  }
  for (let i = 0; i < count && i < list.length; i += 1) {
    slots.push({ kind: 'vee', bx: list[i][0], by: list[i][1], drift, period });
  }
}

// 쌍기둥: 기둥마다 1~3열. 자리 교체는 두 기둥을 대형 중심 기준으로 180° 함께 돌려
// 위아래로 엇갈려 지나가게 한다(강체 회전이라 교체 중에도 적끼리 겹치지 않음).
function pillarColumns(m) {
  if (m <= 7) return 1;
  return m <= 12 ? 2 : 3;
}

function buildPillars(slots, n) {
  const f = FORMATIONS.pillars;
  const counts = [Math.ceil(n / 2), Math.floor(n / 2)];
  const half = (f.xs[1] - f.xs[0]) / 2;
  const per = [[], []];
  for (let p = 0; p < 2; p += 1) {
    const m = counts[p];
    const cols = pillarColumns(m);
    const rows = Math.ceil(m / cols);
    const colGap = cols === 3 ? f.tripleGap : f.subGap * 2;
    const offsets = [];
    for (let c = 0; c < cols; c += 1) offsets.push((c - (cols - 1) / 2) * colGap);
    // 회전 반경이 f.maxRadius를 넘지 않도록 세로 간격을 정한다 (한쪽 기둥은 반 칸 내려 엇갈림)
    const halfX = half + Math.abs(offsets[0]);
    const extent = 2 * Math.sqrt(f.maxRadius * f.maxRadius - halfX * halfX);
    const spacing = rows > 1 ? Math.min(f.maxSpacing, extent / (rows - 0.5)) : 0;
    const yOffset = p === 1 ? spacing / 2 : 0;
    let placed = 0;
    for (let r = 0; r < rows && placed < m; r += 1) {
      for (let c = 0; c < cols && placed < m; c += 1) {
        per[p].push({ kind: 'pillar', pillar: p, lx: (p === 0 ? -half : half) + offsets[c], y: yOffset + spacing * r });
        placed += 1;
      }
    }
  }
  // 세로 중심을 대형 중심(f.cy)에 맞춘다
  let minY = Infinity;
  let maxY = -Infinity;
  for (const list of per) for (const s of list) { minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y); }
  const mid = (minY + maxY) / 2;
  for (const list of per) for (const s of list) s.ly = s.y - mid;
  // 좌우 기둥을 번갈아 넣는다
  const len = Math.max(per[0].length, per[1].length);
  for (let i = 0; i < len; i += 1) {
    if (i < per[0].length) slots.push(per[0][i]);
    if (i < per[1].length) slots.push(per[1][i]);
  }
}

function buildBlock(slots, n) {
  const f = FORMATIONS.block;
  const counts = [Math.ceil(n / 2), Math.floor(n / 2)];
  const per = [[], []];
  for (let b = 0; b < 2; b += 1) {
    const m = counts[b];
    const cols = m <= 9 ? 3 : 4;
    const rows = Math.ceil(m / cols);
    const [cx, cy] = f.centers[b];
    const spin = (b === 0 ? 1 : -1) * f.degPerSec * DEG;
    for (let i = 0; i < m; i += 1) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      per[b].push({
        kind: 'block', cx, cy, spin,
        lx: (c - (cols - 1) / 2) * f.spacing,
        ly: (r - (rows - 1) / 2) * f.spacing
      });
    }
  }
  const len = Math.max(per[0].length, per[1].length);
  for (let i = 0; i < len; i += 1) {
    if (i < per[0].length) slots.push(per[0][i]);
    if (i < per[1].length) slots.push(per[1][i]);
  }
}

function buildRingVee(slots, n) {
  const f = FORMATIONS.ringVee;
  const ringN = Math.ceil(n / 2);
  const veeN = n - ringN;
  const ring = [];
  const vee = [];
  ringSlots(ring, ringN, f.ringCx, f.ringCy, f.ringRadius, FORMATIONS.ring.degPerSec * DEG, 0);
  buildVee(vee, veeN, {
    cx: 180, apexY: f.veeApexY, drift: f.veeDrift, period: FORMATIONS.vee.period,
    dx0: 18, dxStep: f.veeDx, dyStep: f.veeDy, rows: 7, innerRows: 0, innerShift: 0
  });
  const len = Math.max(ring.length, vee.length);
  for (let i = 0; i < len; i += 1) {
    if (i < ring.length) slots.push(ring[i]);
    if (i < vee.length) slots.push(vee[i]);
  }
}

export function createFormation(key, count) {
  const slots = [];
  if (key === 'ring') buildRing(slots, count);
  else if (key === 'vee') {
    const f = FORMATIONS.vee;
    buildVee(slots, count, {
      cx: f.cx, apexY: f.apexY, drift: f.drift, period: f.period,
      dx0: 16, dxStep: 16, dyStep: 30, rows: 7, innerRows: 5, innerShift: 60
    });
  } else if (key === 'pillars') buildPillars(slots, count);
  else if (key === 'block') buildBlock(slots, count);
  else if (key === 'ringVee') buildRingVee(slots, count);
  else throw new Error(`알 수 없는 대형: ${key}`);
  return { key, count, slots };
}

// 자리 i의 시각 t 위치를 out에 기록. mul은 이동 속도 배율.
export function slotPosition(formation, index, t, mul, out) {
  const s = formation.slots[index];
  const tt = t * mul;
  if (s.kind === 'ring') {
    const a = s.angle + s.spin * tt;
    out.x = s.cx + Math.cos(a) * s.radius;
    out.y = s.cy + Math.sin(a) * s.radius;
  } else if (s.kind === 'vee') {
    out.x = s.bx + s.drift * Math.sin((TAU * tt) / s.period);
    out.y = s.by;
  } else if (s.kind === 'pillar') {
    const f = FORMATIONS.pillars;
    const k = Math.floor(tt / f.period);
    const local = tt - k * f.period;
    const hold = f.period - f.slide;
    const frac = local < hold ? 0 : (1 - Math.cos((Math.PI * (local - hold)) / f.slide)) / 2;
    const a = Math.PI * (k + frac);
    const c = Math.cos(a);
    const sn = Math.sin(a);
    out.x = f.cx + s.lx * c - s.ly * sn;
    out.y = f.cy + s.lx * sn + s.ly * c;
  } else {
    const a = s.spin * tt;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    out.x = s.cx + s.lx * c - s.ly * sn;
    out.y = s.cy + s.lx * sn + s.ly * c;
  }
  return out;
}

const TYPE_ORDER = ['warden', 'sniper', 'miner', 'splitter', 'shield'];

// 웨이브 구성(mix)을 자리에 결정적으로 배치한다. 매번 같은 위치에 같은 유형.
export function assignTypes(mix, count) {
  const types = new Array(count).fill(null);
  TYPE_ORDER.forEach((type, k) => {
    const c = mix[type] || 0;
    for (let j = 0; j < c; j += 1) {
      let idx = (Math.floor(((j + 0.5) * count) / c) + k) % count;
      let guard = 0;
      while (types[idx] && guard < count) {
        idx = (idx + 1) % count;
        guard += 1;
      }
      types[idx] = type;
    }
  });
  for (let i = 0; i < count; i += 1) {
    if (!types[i]) types[i] = 'scout';
  }
  return types;
}
