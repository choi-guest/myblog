// 시드 난수 (mulberry32). 테스트에서 고정 시드로 같은 결과를 얻기 위해 사용한다.

export function createRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return next;
}

// 0 이상 n 미만 정수
export function randInt(rng, n) {
  return Math.floor(rng() * n);
}

// [{ weight }] 중 가중치 선택, 인덱스 반환 (모두 0이면 -1)
export function weightedIndex(rng, weights) {
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) return -1;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i += 1) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}
