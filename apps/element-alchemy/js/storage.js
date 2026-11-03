// 최고 점수 읽기/쓰기 — 실패하면 0으로 보고 게임은 계속한다
const BEST_KEY = 'element-alchemy:best';

export function loadBest() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    // '123oops'·'1e6'처럼 전체가 10진 정수가 아닌 값은 손상으로 보고 0
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return 0;
    const n = Number(raw);
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
  } catch (err) {
    return 0;
  }
}

export function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
    return true;
  } catch (err) {
    return false;
  }
}
