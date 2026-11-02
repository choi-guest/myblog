// 키보드·스와이프·화면 버튼 → 방향 이벤트
// event.code(물리 키 위치) 기준 — 한글 입력 상태(key가 'ㅈ'·'Process')에서도 동작
const CODE_MAP = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyA: 'left',
  KeyS: 'down',
  KeyD: 'right'
};

// code를 주지 않는 오래된 환경용 보조 판정
const KEY_MAP = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  a: 'left',
  s: 'down',
  d: 'right'
};

function directionFromEvent(event) {
  if (event.code && CODE_MAP[event.code]) return CODE_MAP[event.code];
  const key = event.key && event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return KEY_MAP[key] || null;
}

const SWIPE_MIN = 30;

function isDialogOpen() {
  return document.querySelector('dialog[open]') !== null;
}

function isTextField(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

export function setupInput({ board, buttons, onDirection }) {
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (isDialogOpen() || isTextField(event.target)) return;
    // isComposing이거나 key === 'Process'여도 code로 처리한다
    const dir = directionFromEvent(event);
    if (!dir) return;
    event.preventDefault();
    onDirection(dir);
  });

  let start = null;
  board.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    try {
      board.setPointerCapture(event.pointerId);
    } catch (err) {
      // 캡처 실패는 무시
    }
  });
  board.addEventListener('pointerup', (event) => {
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    if (Math.abs(dx) > Math.abs(dy)) onDirection(dx > 0 ? 'right' : 'left');
    else onDirection(dy > 0 ? 'down' : 'up');
  });
  board.addEventListener('pointercancel', () => {
    start = null;
  });

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = btn.dataset.dir;
      if (dir) onDirection(dir);
    });
  });
}
