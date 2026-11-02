// 키보드·포인터 끌기·버튼 → 입력 상태 객체 { dx, dy, fire, special, pointerDelta }

const MOVE_KEYS = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down'
};

const SPECIAL_KEYS = ['ShiftLeft', 'ShiftRight', 'KeyX'];

function isInteractiveTarget(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'A' ||
    el.getAttribute('role') === 'radio';
}

// opts: { canvas, getScale(): CSS px per 논리 px, isCapturing(): 게임 진행 중이고 대화상자가 닫혀 있는지,
//         onPause(keyEvent): P·Esc 처리, onTouch(): 첫 터치 감지 }
export function createInput(opts) {
  const { canvas, getScale, isCapturing, onPause, onTouch } = opts;
  const held = { left: false, right: false, up: false, down: false, fire: false };
  let specialQueued = false;
  let autoFire = false;
  let touchMode = false;
  let pointerId = null;
  let lastX = 0;
  let lastY = 0;
  const delta = { x: 0, y: 0 };
  const out = { dx: 0, dy: 0, fire: false, special: false, pointerDelta: { x: 0, y: 0 } };

  function onKeyDown(e) {
    const capturing = isCapturing();
    const interactive = isInteractiveTarget(document.activeElement) && document.activeElement !== canvas;
    if (e.code === 'KeyP' || e.code === 'Escape') {
      // 일시정지/계속 판단은 main이 한다 (대화상자 상태를 알고 있음)
      if (!e.repeat) onPause(e);
      return;
    }
    const dir = MOVE_KEYS[e.code];
    if (dir) {
      if (capturing && !interactive) {
        held[dir] = true;
        e.preventDefault();
      }
      return;
    }
    if (e.code === 'Space') {
      if (capturing && !interactive) {
        held.fire = true;
        e.preventDefault();
      }
      return;
    }
    if (SPECIAL_KEYS.includes(e.code)) {
      if (capturing && !e.repeat) specialQueued = true;
    }
  }

  function onKeyUp(e) {
    const dir = MOVE_KEYS[e.code];
    if (dir) held[dir] = false;
    if (e.code === 'Space') held.fire = false;
  }

  function releaseAll() {
    held.left = false;
    held.right = false;
    held.up = false;
    held.down = false;
    held.fire = false;
    pointerId = null;
    delta.x = 0;
    delta.y = 0;
  }

  function onPointerDown(e) {
    if (e.pointerType === 'touch' && !touchMode) {
      touchMode = true;
      onTouch();
    }
    if (!isCapturing()) return;
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      // 무시
    }
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (e.pointerId !== pointerId) return;
    const scale = getScale() || 1;
    delta.x += (e.clientX - lastX) / scale;
    delta.y += (e.clientY - lastY) / scale;
    lastX = e.clientX;
    lastY = e.clientY;
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {
      // 무시
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  // 첫 터치를 캔버스 밖(조작 띠 등)에서 해도 감지
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && !touchMode) {
      touchMode = true;
      onTouch();
    }
  }, { capture: true });

  return {
    // 매 스텝 호출. 끌기 이동량·보조 무기 입력은 한 번만 전달하고 비운다.
    sample() {
      out.dx = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      out.dy = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      out.fire = held.fire || autoFire || touchMode;
      out.special = specialQueued;
      out.pointerDelta.x = delta.x;
      out.pointerDelta.y = delta.y;
      specialQueued = false;
      delta.x = 0;
      delta.y = 0;
      return out;
    },
    queueSpecial() {
      specialQueued = true;
    },
    setAutoFire(on) {
      autoFire = !!on;
    },
    isTouch() {
      return touchMode;
    },
    reset() {
      releaseAll();
      specialQueued = false;
    }
  };
}
