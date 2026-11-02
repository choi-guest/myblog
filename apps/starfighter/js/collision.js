// 충돌 판정: 원-원, 선분-원, 축 정렬 사각형-원, 선분-선분. 순수 함수.

export function circleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

// 점 (px, py)에서 선분 (x1,y1)-(x2,y2)까지 거리의 제곱
export function segmentPointDistSq(x1, y1, x2, y2, px, py) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const len = vx * vx + vy * vy;
  let t = 0;
  if (len > 0) {
    t = ((px - x1) * vx + (py - y1) * vy) / len;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  const dx = x1 + vx * t - px;
  const dy = y1 + vy * t - py;
  return dx * dx + dy * dy;
}

export function segmentCircleHit(x1, y1, x2, y2, cx, cy, r) {
  return segmentPointDistSq(x1, y1, x2, y2, cx, cy) <= r * r;
}

export function rectCircleHit(rx, ry, rw, rh, cx, cy, cr) {
  const nx = cx < rx ? rx : (cx > rx + rw ? rx + rw : cx);
  const ny = cy < ry ? ry : (cy > ry + rh ? ry + rh : cy);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= cr * cr;
}

function cross(ax, ay, bx, by) {
  return ax * by - ay * bx;
}

// 두 선분 사이 최소 거리의 제곱
export function segmentSegmentDistSq(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
  const rx = ax2 - ax1;
  const ry = ay2 - ay1;
  const sx = bx2 - bx1;
  const sy = by2 - by1;
  const denom = cross(rx, ry, sx, sy);
  if (denom !== 0) {
    const t = cross(bx1 - ax1, by1 - ay1, sx, sy) / denom;
    const u = cross(bx1 - ax1, by1 - ay1, rx, ry) / denom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  return Math.min(
    segmentPointDistSq(bx1, by1, bx2, by2, ax1, ay1),
    segmentPointDistSq(bx1, by1, bx2, by2, ax2, ay2),
    segmentPointDistSq(ax1, ay1, ax2, ay2, bx1, by1),
    segmentPointDistSq(ax1, ay1, ax2, ay2, bx2, by2)
  );
}

// 움직이는 탄 b({ x, y, px, py, r }) vs 원.
// 한 스텝 이동 거리가 반경 × 2보다 크면 이전 위치~현재 위치 선분으로 판정(터널링 방지).
export function movingCircleHit(b, cx, cy, cr) {
  const mx = b.x - b.px;
  const my = b.y - b.py;
  const moved = mx * mx + my * my;
  const limit = b.r * 2;
  if (moved > limit * limit) {
    return segmentCircleHit(b.px, b.py, b.x, b.y, cx, cy, cr + b.r);
  }
  return circleHit(b.x, b.y, b.r, cx, cy, cr);
}
