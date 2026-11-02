// 상태 → Canvas 2D 그리기. 색은 모두 CSS 변수에서 읽는다(하드코딩 금지).

import { WORLD, BOSSES, BEHAVIOR } from './config.js';
import { prismReflectors } from './boss.js';

const TAU = Math.PI * 2;

const PALETTE_VARS = {
  spaceBg: '--space-bg', star: '--star', starDim: '--star-dim',
  player: '--player', playerCore: '--player-core', playerShot: '--player-shot',
  scout: '--enemy-scout', shield: '--enemy-shield', splitter: '--enemy-splitter',
  miner: '--enemy-miner', sniper: '--enemy-sniper', warden: '--enemy-warden',
  enemyEdge: '--enemy-edge', enemyShot: '--enemy-shot', enemyShotEdge: '--enemy-shot-edge',
  enemyShotCore: '--enemy-shot-core', boss: '--boss', bossCore: '--boss-core',
  bossReflector: '--boss-reflector', item: '--item', itemText: '--item-text',
  warn: '--warn', buff: '--buff', muted: '--text-muted', text: '--text', drone: '--drone'
};

function makeStars(count, seed) {
  // 장식용 별 배치(게임 규칙과 무관). 간단한 선형 합동 생성기.
  let a = seed;
  const rnd = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  const list = [];
  for (let i = 0; i < count; i += 1) list.push({ x: rnd() * WORLD.width, y: rnd() * WORLD.height, s: 0.6 + rnd() * 0.9 });
  return list;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const pal = {};
  let reduced = false;
  let scale = 1;
  let cssW = 0;
  const layers = [
    { stars: makeStars(40, 7), speed: 10, color: 'starDim', size: 1 },
    { stars: makeStars(22, 91), speed: 26, color: 'star', size: 1.6 }
  ];
  const effects = [];
  let shake = 0;
  const reflTmp = [];

  function refreshPalette() {
    const cs = getComputedStyle(document.documentElement);
    for (const key of Object.keys(PALETTE_VARS)) {
      pal[key] = cs.getPropertyValue(PALETTE_VARS[key]).trim() || cs.getPropertyValue('--text').trim();
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    cssW = rect.width;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    scale = w / WORLD.width;
  }

  function getCssScale() {
    return cssW > 0 ? cssW / WORLD.width : 1;
  }

  function setReducedMotion(on) {
    reduced = !!on;
  }

  // ----- 효과 (이벤트 → 장식) -----

  function burstShards(x, y, color, n, speed, life) {
    if (reduced) {
      effects.push({ kind: 'ring', x, y, color, t: 0, life: 0.3, r0: 6, r1: 18 });
      return;
    }
    for (let i = 0; i < n; i += 1) {
      const a = (TAU * i) / n + i * 0.37;
      const sp = speed * (0.6 + ((i * 7) % 5) / 8);
      effects.push({ kind: 'shard', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: a, color, t: 0, life });
    }
  }

  function addEvents(events) {
    for (const e of events) {
      if (e.type === 'kill') {
        const color = pal[e.enemy] || (e.boss ? pal.boss : pal.muted);
        if (e.boss) burstShards(e.x, e.y, pal.boss, 10, 140, 0.6);
        else burstShards(e.x, e.y, color, e.enemy === 'mine' ? 4 : 5, 90, 0.4);
      } else if (e.type === 'hit') {
        burstShards(e.x, e.y, pal.player, 6, 110, 0.5);
      } else if (e.type === 'deflect' || e.type === 'reflect' || e.type === 'coreBlock') {
        effects.push({ kind: 'spark', x: e.x, y: e.y, color: pal.muted, t: 0, life: 0.15 });
      } else if (e.type === 'absorb') {
        effects.push({ kind: 'ring', x: e.x, y: e.y, color: pal.buff, t: 0, life: 0.3, r0: 14, r1: 24 });
      } else if (e.type === 'mineExplode') {
        effects.push({ kind: 'ring', x: e.x, y: e.y, color: pal.miner, t: 0, life: 0.3, r0: 4, r1: 16 });
      } else if (e.type === 'bossDefeat') {
        if (!reduced) shake = 0.3;
      }
    }
  }

  function updateEffects(dt) {
    let w = 0;
    for (let i = 0; i < effects.length; i += 1) {
      const f = effects[i];
      f.t += dt;
      if (f.kind === 'shard') {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.rot += dt * 6;
      }
      if (f.t < f.life) effects[w++] = f;
    }
    effects.length = w;
    if (shake > 0) shake = Math.max(0, shake - dt);
    if (!reduced) {
      for (const L of layers) {
        for (const st of L.stars) {
          st.y += L.speed * dt;
          if (st.y > WORLD.height) st.y -= WORLD.height;
        }
      }
    }
  }

  function clearEffects() {
    effects.length = 0;
    shake = 0;
  }

  // ----- 도형 -----

  function polygon(x, y, r, sides, rot) {
    ctx.beginPath();
    for (let i = 0; i < sides; i += 1) {
      const a = rot + (TAU * i) / sides;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function fillStroke(fill, stroke, lw) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  function drawEnemyShape(e) {
    const { x, y, r } = e;
    const c = pal[e.type] || pal.scout;
    const edge = pal.enemyEdge;
    switch (e.type) {
      case 'scout':
        polygon(x, y, r, 3, Math.PI / 2); // 아래를 향한 삼각형
        fillStroke(c, edge, 1.5);
        break;
      case 'shield': {
        const h = r * 0.8;
        ctx.beginPath();
        ctx.rect(x - h, y - h, h * 2, h * 2);
        fillStroke(c, edge, 1.5);
        ctx.fillStyle = edge;
        ctx.fillRect(x - r, y + h - 1, r * 2, 5); // 정면(아래) 방패 막대
        break;
      }
      case 'splitter':
      case 'fragment':
        polygon(x, y, r, 6, 0);
        fillStroke(pal.splitter, edge, 1.5);
        if (e.type === 'splitter') {
          ctx.beginPath();
          ctx.moveTo(x, y - r * 0.8);
          ctx.lineTo(x, y + r * 0.8);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = edge;
          ctx.stroke();
        }
        break;
      case 'miner':
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        fillStroke(c, edge, 1.5);
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, TAU);
        ctx.fillStyle = edge;
        ctx.fill();
        break;
      case 'sniper':
        ctx.beginPath();
        ctx.moveTo(x, y - r * 1.25);
        ctx.lineTo(x + r * 0.55, y);
        ctx.lineTo(x, y + r * 1.25);
        ctx.lineTo(x - r * 0.55, y);
        ctx.closePath();
        fillStroke(c, edge, 1.5);
        break;
      case 'warden':
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.arc(x, y, r * 0.55, 0, TAU, true);
        ctx.fillStyle = c;
        ctx.fill('evenodd');
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = edge;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, r * 0.55, 0, TAU);
        ctx.stroke();
        break;
      case 'mine': {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        fillStroke(pal.miner, edge, 1.5);
        ctx.beginPath();
        for (let k = 0; k < 4; k += 1) {
          const a = (TAU * k) / 4 + Math.PI / 4;
          ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
          ctx.lineTo(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4));
        }
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.stroke();
        // 남은 시간 호
        const frac = Math.max(0, e.fuse / BEHAVIOR.mine.fuse);
        ctx.beginPath();
        ctx.arc(x, y, r + 7, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
        ctx.strokeStyle = pal.warn;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
      }
      default:
        break;
    }
  }

  function drawWarp(e) {
    const total = BEHAVIOR.warpTime;
    if (e.timer > total) return; // 아직 차례가 아님
    const prog = 1 - e.timer / total;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = pal[e.type] || pal.muted;
    ctx.globalAlpha = reduced ? 0.8 : 0.4 + 0.6 * prog;
    const r = reduced ? e.r + 4 : e.r + 12 * (1 - prog);
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawEnemy(e) {
    if (e.state === 'warp' || e.state === 'rewarp') {
      drawWarp(e);
      return;
    }
    if (e.type === 'sniper' && e.aimTimer > 0) {
      ctx.save();
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = pal.warn;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.aimAngle) * 760, e.y + Math.sin(e.aimAngle) * 760);
      ctx.stroke();
      ctx.restore();
    }
    if (e.state === 'telegraph') {
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = pal.warn;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 5, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    drawEnemyShape(e);
    if (e.buffBy) {
      ctx.save();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = pal.buff;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 6, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPlayer(p, t) {
    if (!p.alive) return;
    const blinkHidden = p.invuln > 0 && !reduced && Math.floor(p.invuln * 10) % 2 === 1;
    ctx.save();
    ctx.globalAlpha = blinkHidden ? 0.3 : 1;
    const { x, y } = p;
    // 꽃잎 날개 2장
    ctx.fillStyle = pal.player;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + side * 10, y + 4, 7, 3.6, side * 0.55, 0, TAU);
      ctx.fill();
    }
    // 둥근 화살촉 몸체
    ctx.beginPath();
    ctx.moveTo(x, y - 16);
    ctx.quadraticCurveTo(x + 4, y - 6, x + 8, y + 7);
    ctx.quadraticCurveTo(x + 4, y + 10, x, y + 6);
    ctx.quadraticCurveTo(x - 4, y + 10, x - 8, y + 7);
    ctx.quadraticCurveTo(x - 4, y - 6, x, y - 16);
    ctx.closePath();
    ctx.fill();
    // 꼬리 불꽃 점
    ctx.fillStyle = pal.playerShot;
    ctx.beginPath();
    ctx.arc(x, y + 11 + (reduced ? 0 : Math.sin(t * 30) * 0.8), 2.4, 0, TAU);
    ctx.fill();
    // 판정 위치 점
    ctx.fillStyle = pal.playerCore;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, TAU);
    ctx.fill();
    ctx.restore();
    if (p.invuln > 0 && reduced) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = pal.player;
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawItem(it) {
    const { x, y } = it;
    ctx.save();
    if (it.kind === 'energy') {
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 5, y);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 5, y);
      ctx.closePath();
      fillStroke(pal.item, pal.enemyEdge, 1);
    } else if (it.kind === 'power') {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - 8, y - 8, 16, 16, 4);
      else ctx.rect(x - 8, y - 8, 16, 16);
      fillStroke(pal.item, pal.enemyEdge, 1);
      ctx.fillStyle = pal.itemText;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', x, y + 0.5);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, TAU);
      fillStroke(pal.item, pal.enemyEdge, 1);
      ctx.fillStyle = pal.itemText;
      ctx.fillRect(x - 1.5, y - 5, 3, 10);
      ctx.fillRect(x - 5, y - 1.5, 10, 3);
    }
    ctx.restore();
  }

  function drawBoss(b) {
    ctx.save();
    if (b.warp > 0) {
      const prog = 1 - b.warp / b.warpTotal;
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.boss;
      ctx.globalAlpha = reduced ? 0.8 : 0.3 + 0.7 * prog;
      ctx.beginPath();
      ctx.arc(b.x, b.y, reduced ? 50 : 50 + 30 * (1 - prog), 0, TAU);
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (b.kind === 'prism') {
      const c = BOSSES.prism;
      const beam = b.beam;
      if (beam.state === 'warn') {
        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = pal.warn;
        ctx.beginPath();
        ctx.moveTo(beam.x, beam.top);
        ctx.lineTo(beam.x, WORLD.height);
        ctx.stroke();
        ctx.restore();
      } else if (beam.state === 'fire') {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = pal.warn;
        ctx.fillRect(beam.x - c.beamWidth / 2, beam.top, c.beamWidth, WORLD.height - beam.top);
        ctx.restore();
      }
      polygon(b.x, b.y, c.bodyRadius, 3, Math.PI / 2);
      ctx.globalAlpha = 0.9;
      fillStroke(pal.boss, pal.enemyEdge, 2);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, c.coreRadius, 0, TAU);
      fillStroke(pal.bossCore, pal.enemyEdge, 2);
      const refl = prismReflectors(b, reflTmp);
      ctx.lineCap = 'round';
      ctx.lineWidth = c.reflectorHalfThickness * 2;
      ctx.strokeStyle = pal.bossReflector;
      for (const r of refl) {
        ctx.beginPath();
        ctx.moveTo(r.x1, r.y1);
        ctx.lineTo(r.x2, r.y2);
        ctx.stroke();
      }
    } else {
      const c = BOSSES.orbital;
      ctx.beginPath();
      ctx.arc(b.x, b.y, c.coreRadius, 0, TAU);
      fillStroke(b.sats.length > 0 ? pal.boss : pal.bossCore, pal.enemyEdge, 2);
      ctx.beginPath();
      ctx.arc(b.x, b.y, c.coreRadius * 0.45, 0, TAU);
      ctx.fillStyle = pal.enemyEdge;
      ctx.fill();
      if (b.sats.length > 0) {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = pal.buff;
        ctx.beginPath();
        ctx.arc(b.x, b.y, c.coreRadius + 7, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.strokeStyle = pal.muted;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.orbitRadius, 0, TAU);
      ctx.stroke();
      ctx.restore();
      for (const st of b.sats) {
        ctx.beginPath();
        ctx.rect(st.x - st.r, st.y - st.r, st.r * 2, st.r * 2);
        fillStroke(pal.boss, pal.enemyEdge, 1.5);
      }
    }
    ctx.restore();
  }

  function drawShots(s) {
    ctx.fillStyle = pal.playerShot;
    for (const b of s.shots) ctx.fillRect(b.x - 1.5, b.y - 6, 3, 12);
    for (const b of s.droneShots) ctx.fillRect(b.x - 1.2, b.y - 4, 2.4, 8);
    for (const m of s.missiles) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-4, -3.5);
      ctx.lineTo(-4, 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = pal.muted;
    for (const b of s.reflected) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemyShots(list) {
    ctx.lineWidth = 1.5;
    for (const b of list) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, TAU);
      ctx.fillStyle = pal.enemyShot;
      ctx.fill();
      ctx.strokeStyle = pal.enemyShotEdge;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x, b.y, 1.6, 0, TAU);
      ctx.fillStyle = pal.enemyShotCore;
      ctx.fill();
    }
  }

  function drawSpecials(s) {
    if (s.burst) {
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 4;
      ctx.strokeStyle = pal.playerShot;
      ctx.beginPath();
      ctx.arc(s.burst.x, s.burst.y, Math.max(1, s.burst.r), 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    if (s.drone.timer > 0 && s.player.alive) {
      for (const d of s.drone.pos) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, 6, 0, TAU);
        fillStroke(pal.drone, pal.enemyEdge, 1.5);
      }
    }
  }

  function drawEffects() {
    for (const f of effects) {
      const k = 1 - f.t / f.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, k);
      if (f.kind === 'shard') {
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.moveTo(0, -3.5);
        ctx.lineTo(3, 2.5);
        ctx.lineTo(-3, 2.5);
        ctx.closePath();
        ctx.fill();
      } else if (f.kind === 'ring') {
        ctx.lineWidth = 2;
        ctx.strokeStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * (1 - k), 0, TAU);
        ctx.stroke();
      } else {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = f.color;
        ctx.beginPath();
        ctx.moveTo(f.x - 4, f.y + 2);
        ctx.lineTo(f.x + 4, f.y - 2);
        ctx.moveTo(f.x + 4, f.y + 2);
        ctx.lineTo(f.x - 4, f.y - 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function draw(s, frameDt) {
    updateEffects(frameDt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = pal.spaceBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let ox = 0;
    let oy = 0;
    if (shake > 0 && !reduced) {
      ox = Math.sin(shake * 90) * 4;
      oy = Math.cos(shake * 70) * 4;
    }
    ctx.setTransform(scale, 0, 0, scale, ox * scale, oy * scale);

    for (const L of layers) {
      ctx.fillStyle = pal[L.color];
      for (const st of L.stars) ctx.fillRect(st.x, st.y, L.size * st.s, L.size * st.s);
    }
    if (!s) return;

    for (const it of s.items) drawItem(it);
    if (s.boss && !s.boss.defeated) drawBoss(s.boss);
    for (const e of s.enemies) drawEnemy(e);
    drawShots(s);
    drawEnemyShots(s.enemyShots);
    drawPlayer(s.player, s.time);
    drawSpecials(s);
    drawEffects();
  }

  refreshPalette();

  return { resize, refreshPalette, draw, addEvents, clearEffects, setReducedMotion, getCssScale };
}

