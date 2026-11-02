// Web Audio로 직접 합성한 짧은 음. 기본 꺼짐. AudioContext는 사용자 동작(켜기 버튼) 이후에만 만든다.

const SOUNDS = {
  fire: [{ type: 'square', from: 1200, to: 900, dur: 0.03, gain: 0.012 }],
  kill: [{ type: 'triangle', from: 520, to: 180, dur: 0.12, gain: 0.07 }],
  hit: [{ type: 'sawtooth', from: 240, to: 50, dur: 0.38, gain: 0.08 }],
  special: [
    { type: 'sine', from: 260, to: 780, dur: 0.28, gain: 0.08 },
    { type: 'triangle', from: 390, to: 1170, dur: 0.28, gain: 0.04, delay: 0.04 }
  ],
  item: [
    { type: 'sine', from: 700, to: 700, dur: 0.06, gain: 0.06 },
    { type: 'sine', from: 1050, to: 1050, dur: 0.08, gain: 0.06, delay: 0.06 }
  ],
  deflect: [{ type: 'square', from: 2000, to: 1600, dur: 0.025, gain: 0.015 }],
  boss: [{ type: 'triangle', from: 90, to: 70, dur: 0.6, gain: 0.09 }],
  clear: [
    { type: 'triangle', from: 494, to: 494, dur: 0.12, gain: 0.07 },
    { type: 'triangle', from: 587, to: 587, dur: 0.12, gain: 0.07, delay: 0.12 },
    { type: 'triangle', from: 740, to: 740, dur: 0.22, gain: 0.07, delay: 0.24 }
  ]
};

const MIN_GAP = { fire: 0.07, deflect: 0.06, kill: 0.03 };

export function createAudio() {
  let ctx = null;
  let enabled = false;
  const last = {};

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch (err) {
      ctx = null;
    }
    return ctx;
  }

  function tone(spec, t0) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const start = t0 + (spec.delay || 0);
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to), start + spec.dur);
    g.gain.setValueAtTime(spec.gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + spec.dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + spec.dur + 0.02);
  }

  return {
    // 사용자 동작(클릭) 안에서 호출해야 한다
    setEnabled(on) {
      enabled = !!on;
      if (enabled && ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    isEnabled() {
      return enabled;
    },
    play(name) {
      if (!enabled || !ctx || ctx.state !== 'running') return;
      const list = SOUNDS[name];
      if (!list) return;
      const now = ctx.currentTime;
      const gap = MIN_GAP[name] || 0;
      if (gap && last[name] !== undefined && now - last[name] < gap) return;
      last[name] = now;
      for (const spec of list) tone(spec, now);
    }
  };
}
