// 적 유형별 행동: 워프 진입, 이탈 경로, 사격, 방패, 분열, 기뢰, 저격, 보호막. 순수 로직(DOM 없음).
// ctx: { mul, player, rng, shotSpeed, diverFires, extraFireChance, enemies,
//        slotPos(e, out), fireShot(x, y, vx, vy), spawnMine(x, y), explodeMine(e) }

import { ENEMY_TYPES, BEHAVIOR, WORLD } from './config.js';

const DEG = Math.PI / 180;

export function createEnemy(id, type, x, y, slot, delay) {
  const t = ENEMY_TYPES[type];
  return {
    id, type, x, y, slot,
    hp: t.hp, maxHp: t.hp, r: t.radius,
    state: 'warp',
    timer: BEHAVIOR.warpTime + delay,
    vx: 0, vy: 0,
    diveT: 0, x0: 0, phase: 0, laneY: 0, mineXs: null, mineIndex: 0, dir: 1,
    extraShot: -1,
    sniperTimer: BEHAVIOR.sniper.firstDelay, aimTimer: 0, aimAngle: 0,
    wardTimer: BEHAVIOR.warden.firstDelay,
    buffBy: 0,
    fuse: 0,
    summoned: false,
    remove: false
  };
}

export function createFragment(id, x, y, dir) {
  const e = createEnemy(id, 'fragment', x, y, null, 0);
  const a = (90 - dir * BEHAVIOR.fragment.angleDeg) * DEG; // 아래쪽 기준 좌우 45°
  e.state = 'free';
  e.timer = 0;
  e.vx = Math.cos(a) * BEHAVIOR.fragment.speed;
  e.vy = Math.sin(a) * BEHAVIOR.fragment.speed;
  return e;
}

export function createMine(id, x, y) {
  const e = createEnemy(id, 'mine', x, y, null, 0);
  e.state = 'free';
  e.timer = 0;
  e.fuse = BEHAVIOR.mine.fuse;
  return e;
}

export function isWarping(e) {
  return e.state === 'warp' || e.state === 'rewarp';
}

export function isCollidable(e) {
  return !isWarping(e) && !e.remove;
}

export function isDiving(e) {
  return e.state === 'dive';
}

export function isActiveDiver(e) {
  return e.state === 'dive' || e.state === 'telegraph';
}

export function canStartDive(e) {
  return e.state === 'formation' && ENEMY_TYPES[e.type].canDive;
}

export function startTelegraph(e) {
  e.state = 'telegraph';
  e.timer = BEHAVIOR.telegraphTime;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function aimedShot(e, ctx, speed) {
  const p = ctx.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  ctx.fireShot(e.x, e.y + e.r * 0.6, (dx / d) * speed, (dy / d) * speed);
}

function beginDive(e, ctx) {
  e.state = 'dive';
  e.diveT = 0;
  e.x0 = e.x;
  const mul = ctx.mul;
  if (e.type === 'scout') {
    e.phase = ctx.rng() < 0.5 ? 0 : Math.PI;
    e.vy = BEHAVIOR.scout.speed * mul;
  } else if (e.type === 'shield') {
    e.vy = BEHAVIOR.shield.speed * mul;
  } else if (e.type === 'splitter') {
    const p = ctx.player;
    const dx = p.x - e.x;
    const dy = Math.max(80, p.y - e.y);
    const d = Math.hypot(dx, dy) || 1;
    const sp = BEHAVIOR.splitter.speed * mul;
    e.vx = (dx / d) * sp;
    e.vy = (dy / d) * sp;
  } else if (e.type === 'miner') {
    e.phase = 0; // 0: 하강, 1: 가로지르기
    e.laneY = BEHAVIOR.miner.laneY + ctx.rng() * BEHAVIOR.miner.laneJitter;
    e.dir = e.x < WORLD.width / 2 ? 1 : -1;
    e.mineIndex = 0;
    e.vy = BEHAVIOR.miner.speed * mul;
    e.vx = 0;
  }
  if (ctx.diverFires) {
    aimedShot(e, ctx, ctx.shotSpeed);
    e.extraShot = ctx.rng() < ctx.extraFireChance ? BEHAVIOR.extraShotDelay : -1;
  } else {
    e.extraShot = -1;
  }
}

function exitDive(e) {
  if (e.summoned || e.slot === null) {
    e.remove = true;
    return;
  }
  e.state = 'rewarp';
  e.timer = BEHAVIOR.warpTime;
}

function updateDive(e, dt, ctx) {
  e.diveT += dt;
  const mul = ctx.mul;
  if (e.type === 'scout') {
    const b = BEHAVIOR.scout;
    e.y += e.vy * dt;
    e.x = clamp(e.x0 + Math.sin(e.diveT * b.zigFreq * mul + e.phase) * b.zigAmp - Math.sin(e.phase) * b.zigAmp, 14, WORLD.width - 14);
  } else if (e.type === 'shield') {
    const b = BEHAVIOR.shield;
    e.y += e.vy * dt;
    const dx = ctx.player.x - e.x;
    const step = b.trackSpeed * mul * dt;
    e.x += Math.abs(dx) <= step ? dx : Math.sign(dx) * step;
  } else if (e.type === 'splitter') {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  } else if (e.type === 'miner') {
    const b = BEHAVIOR.miner;
    if (e.phase === 0) {
      e.y += e.vy * dt;
      if (e.y >= e.laneY) {
        e.y = e.laneY;
        e.phase = 1;
        e.vx = e.dir * b.speed * mul;
        const dist = e.dir > 0 ? (WORLD.width - 16) - e.x : e.x - 16;
        e.mineXs = [];
        for (let k = 1; k <= b.mines; k += 1) e.mineXs.push(e.x + e.dir * (dist * k) / (b.mines + 1));
      }
    } else {
      e.x += e.vx * dt;
      // 가로지르는 경로를 4등분한 세 지점에 기뢰를 떨군다
      while (e.mineIndex < e.mineXs.length) {
        const mx = e.mineXs[e.mineIndex];
        if (e.dir > 0 ? e.x < mx : e.x > mx) break;
        ctx.spawnMine(mx, e.y + 6);
        e.mineIndex += 1;
      }
    }
  }
  if (e.extraShot > 0) {
    e.extraShot -= dt;
    if (e.extraShot <= 0) {
      e.extraShot = -1;
      aimedShot(e, ctx, ctx.shotSpeed);
    }
  }
  const m = BEHAVIOR.exitMargin;
  if (e.y > WORLD.height + m || e.x < -m || e.x > WORLD.width + m) exitDive(e);
}

function updateSniper(e, dt, ctx) {
  const b = BEHAVIOR.sniper;
  if (e.aimTimer > 0) {
    e.aimTimer -= dt;
    if (e.aimTimer <= 0) {
      e.aimTimer = 0;
      ctx.fireShot(e.x, e.y, Math.cos(e.aimAngle) * b.shotSpeed, Math.sin(e.aimAngle) * b.shotSpeed);
      e.sniperTimer = b.interval;
    }
    return;
  }
  e.sniperTimer -= dt;
  if (e.sniperTimer <= 0) {
    if (!ctx.player.alive) {
      e.sniperTimer = 0.5;
      return;
    }
    e.aimTimer = b.aimTime;
    e.aimAngle = Math.atan2(ctx.player.y - e.y, ctx.player.x - e.x);
  }
}

function updateWarden(e, dt, ctx) {
  const b = BEHAVIOR.warden;
  e.wardTimer -= dt;
  if (e.wardTimer > 0) return;
  e.wardTimer = b.interval;
  let best = null;
  let bestD = b.range * b.range;
  for (const o of ctx.enemies) {
    if (o === e || o.buffBy || !isCollidable(o) || o.type === 'warden' || o.type === 'mine') continue;
    const dx = o.x - e.x;
    const dy = o.y - e.y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = o;
    }
  }
  if (best) best.buffBy = e.id;
}

const tmp = { x: 0, y: 0 };

export function updateEnemy(e, dt, ctx) {
  switch (e.state) {
    case 'warp':
    case 'rewarp':
      if (e.slot !== null) {
        ctx.slotPos(e, tmp);
        e.x = tmp.x;
        e.y = tmp.y;
      }
      e.timer -= dt;
      if (e.timer <= 0) {
        if (e.summoned) startTelegraph(e);
        else {
          e.state = 'formation';
          e.timer = 0;
        }
      }
      break;
    case 'formation':
      ctx.slotPos(e, tmp);
      e.x = tmp.x;
      e.y = tmp.y;
      if (e.type === 'sniper') updateSniper(e, dt, ctx);
      else if (e.type === 'warden') updateWarden(e, dt, ctx);
      break;
    case 'telegraph':
      if (e.slot !== null) {
        ctx.slotPos(e, tmp);
        e.x = tmp.x;
        e.y = tmp.y;
      }
      e.timer -= dt;
      if (e.timer <= 0) beginDive(e, ctx);
      break;
    case 'dive':
      updateDive(e, dt, ctx);
      break;
    case 'free':
      if (e.type === 'mine') {
        e.fuse -= dt;
        if (e.fuse <= 0) {
          ctx.explodeMine(e);
          e.remove = true;
        }
      } else {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        const m = BEHAVIOR.exitMargin;
        if (e.y > WORLD.height + m || e.x < -m || e.x > WORLD.width + m) e.remove = true;
      }
      break;
    default:
      break;
  }
}

// 피해 처리. 결과: 'deflect'(방패 정면) | 'absorb'(보호막) | 'hurt' | 'kill'
export function damageEnemy(e, dmg, pierce, hitX) {
  if (e.type === 'shield' && !pierce && Math.abs(hitX - e.x) < BEHAVIOR.shield.frontHalfWidth) {
    return 'deflect';
  }
  if (e.buffBy) {
    e.buffBy = 0;
    return 'absorb';
  }
  e.hp -= dmg;
  if (e.hp <= 0) {
    e.hp = 0;
    e.remove = true;
    return 'kill';
  }
  return 'hurt';
}

