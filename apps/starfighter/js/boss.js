// 우두머리: 프리즘(5단계), 오비탈 코어(10단계). 상태와 패턴. 순수 로직(DOM 없음).
// ctx: { player, rng, fireShot(x, y, vx, vy), summon(x, y), summonCount(), events }

import { BOSSES, PLAYER } from './config.js';
import { circleHit, movingCircleHit, segmentSegmentDistSq } from './collision.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

export function createBoss(kind, nextId) {
  if (kind === 'prism') {
    const c = BOSSES.prism;
    return {
      kind, name: c.name, x: c.x, y: c.y, hp: c.hp, maxHp: c.hp,
      warp: c.warpTime, warpTotal: c.warpTime,
      spin: 0, reflectorCount: 3, phaseNo: 1,
      fanTimer: c.fanInterval, fanFlip: false, beamTimer: 1.0,
      beam: { state: 'idle', timer: 0, x: 0, top: c.y + 30 },
      sweepT: 0, summonTimer: 1.0,
      defeated: false
    };
  }
  const c = BOSSES.orbital;
  const boss = {
    kind, name: c.name, x: c.x, y: c.y, hp: c.hp, maxHp: c.hp,
    warp: c.warpTime, warpTotal: c.warpTime,
    sats: [], orbitAngle: 0, orbitRadius: c.orbit,
    exposed: false, exposeTimer: 0, exposeT: 0, regenUsed: 0, moveT: 0,
    spiralTimer: 2.0, spiralLeft: 0, spiralGap: 0, spiralBase: 0, spiralIndex: 0,
    exposedFire: c.exposedFireInterval, phaseNo: 1,
    defeated: false
  };
  addSatellites(boss, c.satellites, nextId);
  return boss;
}

function addSatellites(boss, n, nextId) {
  const c = BOSSES.orbital;
  boss.sats.length = 0;
  for (let i = 0; i < n; i += 1) {
    boss.sats.push({
      id: nextId(), offset: (TAU * i) / n, hp: c.satHp, maxHp: c.satHp, r: c.satRadius,
      x: boss.x, y: boss.y, fireTimer: 1.2 + i * 0.75
    });
  }
}

function fan(ctx, x, y, count, speed, spreadDeg, offsetDeg = 0) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.PI / 2 + ((i - (count - 1) / 2) * spreadDeg + offsetDeg) * DEG;
    ctx.fireShot(x, y, Math.cos(a) * speed, Math.sin(a) * speed);
  }
}

function aimAt(ctx, x, y, speed, offsetDeg) {
  const p = ctx.player;
  const a = Math.atan2(p.y - y, p.x - x) + offsetDeg * DEG;
  ctx.fireShot(x, y, Math.cos(a) * speed, Math.sin(a) * speed);
}

export function prismReflectors(boss, out) {
  const c = BOSSES.prism;
  out.length = 0;
  for (let i = 0; i < boss.reflectorCount; i += 1) {
    const a = boss.spin + (TAU * i) / boss.reflectorCount;
    const cx = boss.x + Math.cos(a) * c.reflectorOrbit;
    const cy = boss.y + Math.sin(a) * c.reflectorOrbit;
    const tx = -Math.sin(a) * c.reflectorHalfLength;
    const ty = Math.cos(a) * c.reflectorHalfLength;
    out.push({ cx, cy, x1: cx - tx, y1: cy - ty, x2: cx + tx, y2: cy + ty, angle: a });
  }
  return out;
}

function updatePrism(boss, dt, ctx) {
  const c = BOSSES.prism;
  const ratio = boss.hp / boss.maxHp;
  const prevPhase = boss.phaseNo;
  boss.phaseNo = ratio > c.phase2 ? 1 : (ratio > c.phase3 ? 2 : 3);
  if (boss.phaseNo !== prevPhase) {
    ctx.events.push({ type: 'bossPhase', phase: boss.phaseNo });
    boss.fanTimer = c.fanInterval;
    if (boss.phaseNo === 3) boss.beam.state = 'idle';
  }
  boss.reflectorCount = 4 - boss.phaseNo;
  boss.spin += c.reflectorDegPerSec * DEG * dt;

  if (boss.phaseNo === 2) {
    boss.sweepT += dt;
    boss.x = c.x + (c.sweepWidth / 2) * Math.sin((TAU * boss.sweepT) / c.sweepPeriod);
  } else {
    boss.x += (c.x - boss.x) * Math.min(1, dt * 2);
  }

  if (boss.phaseNo === 1 || boss.phaseNo === 3) {
    boss.fanTimer -= dt;
    if (boss.fanTimer <= 0) {
      boss.fanTimer = c.fanInterval;
      // 부채탄을 한 번씩 반 칸(spread/2) 비틀어 쏜다: 코어 바로 아래가 번갈아 비어
      // 코어를 노리는 자리에서 매번 피하지 않아도 되게 한다
      const offset = boss.fanFlip ? c.fanSpreadDeg / 2 : 0;
      boss.fanFlip = !boss.fanFlip;
      fan(ctx, boss.x, boss.y + 30, boss.phaseNo === 1 ? c.fanCount1 : c.fanCount3, c.fanSpeed, c.fanSpreadDeg, offset);
    }
  }

  const beam = boss.beam;
  if (boss.phaseNo === 2) {
    boss.beamTimer -= dt;
    if (beam.state === 'idle' && boss.beamTimer <= 0) {
      boss.beamTimer = c.beamInterval;
      beam.state = 'warn';
      beam.timer = c.beamWarn;
      beam.x = Math.max(PLAYER.minX, Math.min(PLAYER.maxX, ctx.player.x));
    }
  }
  if (beam.state === 'warn') {
    beam.timer -= dt;
    if (beam.timer <= 0) {
      beam.state = 'fire';
      beam.timer = c.beamTime;
      ctx.events.push({ type: 'beam' });
    }
  } else if (beam.state === 'fire') {
    beam.timer -= dt;
    if (beam.timer <= 0) beam.state = 'idle';
  }

  if (boss.phaseNo === 3) {
    boss.summonTimer -= dt;
    if (boss.summonTimer <= 0) {
      boss.summonTimer = c.summonInterval;
      for (let i = 0; i < c.summonCount; i += 1) {
        if (ctx.summonCount() >= c.summonMaxAlive) break;
        ctx.summon(boss.x + (i === 0 ? -80 : 80), boss.y + 90);
      }
    }
  }
}

function updateOrbital(boss, dt, ctx) {
  const c = BOSSES.orbital;
  const low = boss.hp / boss.maxHp <= c.lowHp;
  const prevPhase = boss.phaseNo;
  boss.phaseNo = low ? 3 : (boss.exposed ? 2 : 1);
  if (boss.phaseNo !== prevPhase) ctx.events.push({ type: 'bossPhase', phase: boss.phaseNo });

  boss.orbitAngle += c.orbitDegPerSec * DEG * dt;
  boss.moveT += dt;
  if (low) {
    const mid = (c.pulseMin + c.pulseMax) / 2;
    const amp = (c.pulseMax - c.pulseMin) / 2;
    boss.orbitRadius = mid + amp * Math.sin((TAU * boss.moveT) / c.pulsePeriod);
  } else {
    boss.orbitRadius = c.orbit;
  }

  if (boss.exposed) {
    boss.x = c.x + c.exposedAmp * Math.sin(boss.exposeT * c.exposedFreq);
    boss.exposeT += dt;
    boss.exposedFire -= dt;
    if (boss.exposedFire <= 0) {
      boss.exposedFire = c.exposedFireInterval;
      aimAt(ctx, boss.x, boss.y + 20, c.exposedShotSpeed, -c.exposedSpreadDeg);
      aimAt(ctx, boss.x, boss.y + 20, c.exposedShotSpeed, 0);
      aimAt(ctx, boss.x, boss.y + 20, c.exposedShotSpeed, c.exposedSpreadDeg);
    }
    boss.exposeTimer -= dt;
    if (boss.exposeTimer <= 0 && boss.regenUsed < c.regenMax) {
      boss.regenUsed += 1;
      boss.exposed = false;
      addSatellites(boss, c.regenCount, ctx.nextId);
      ctx.events.push({ type: 'satRegen', count: c.regenCount });
    }
  } else {
    boss.x += (c.x - boss.x) * Math.min(1, dt * 3);
  }

  for (const s of boss.sats) {
    const a = boss.orbitAngle + s.offset;
    s.x = boss.x + Math.cos(a) * boss.orbitRadius;
    s.y = boss.y + Math.sin(a) * boss.orbitRadius;
    s.fireTimer -= dt;
    if (s.fireTimer <= 0) {
      s.fireTimer = c.satFireInterval;
      aimAt(ctx, s.x, s.y, c.satShotSpeed, 0);
    }
  }

  if (!boss.exposed) {
    boss.spiralTimer -= dt;
    if (boss.spiralTimer <= 0) {
      boss.spiralTimer = c.spiralInterval;
      boss.spiralLeft = c.spiralCount;
      boss.spiralGap = 0;
      boss.spiralIndex = 0;
      boss.spiralBase += 17 * DEG;
    }
  }
  if (boss.spiralLeft > 0) {
    boss.spiralGap -= dt;
    while (boss.spiralGap <= 0 && boss.spiralLeft > 0) {
      boss.spiralGap += c.spiralGap;
      const k = boss.spiralIndex;
      const a = boss.spiralBase + k * c.spiralStepDeg * DEG;
      ctx.fireShot(boss.x, boss.y, Math.cos(a) * c.spiralSpeed, Math.sin(a) * c.spiralSpeed);
      if (low) {
        const b = boss.spiralBase + Math.PI - k * c.spiralStepDeg * DEG;
        ctx.fireShot(boss.x, boss.y, Math.cos(b) * c.spiralSpeed, Math.sin(b) * c.spiralSpeed);
      }
      boss.spiralIndex += 1;
      boss.spiralLeft -= 1;
    }
  }

  if (!boss.exposed && boss.sats.length === 0) {
    boss.exposed = true;
    boss.exposeT = 0;
    boss.exposeTimer = boss.regenUsed < c.regenMax ? c.exposeTime : Infinity;
    boss.exposedFire = 0.6;
    boss.spiralLeft = 0;
    ctx.events.push({ type: 'coreExposed' });
  }
}

export function updateBoss(boss, dt, ctx) {
  if (boss.defeated) return;
  if (boss.warp > 0) {
    boss.warp -= dt;
    if (boss.warp <= 0) {
      boss.warp = 0;
      ctx.events.push({ type: 'bossAppear', name: boss.name });
    }
    if (boss.kind === 'orbital') {
      for (const s of boss.sats) {
        const a = boss.orbitAngle + s.offset;
        s.x = boss.x + Math.cos(a) * boss.orbitRadius;
        s.y = boss.y + Math.sin(a) * boss.orbitRadius;
      }
    }
    return;
  }
  if (boss.kind === 'prism') updatePrism(boss, dt, ctx);
  else updateOrbital(boss, dt, ctx);
}

export function bossActive(boss) {
  return boss && !boss.defeated && boss.warp <= 0;
}

const reflectorTmp = [];

// 플레이어 탄 vs 우두머리.
// 결과: null | { result: 'reflect', sign } | { result: 'block' } | { result: 'hit', part: 'core' | sat }
export function bossShotTest(boss, shot) {
  if (!bossActive(boss)) return null;
  if (boss.kind === 'prism') {
    const c = BOSSES.prism;
    const refl = prismReflectors(boss, reflectorTmp);
    const lim = shot.r + c.reflectorHalfThickness;
    for (const r of refl) {
      if (segmentSegmentDistSq(shot.px, shot.py, shot.x, shot.y, r.x1, r.y1, r.x2, r.y2) <= lim * lim) {
        return { result: 'reflect', sign: shot.x >= r.cx ? 1 : -1 };
      }
    }
    if (movingCircleHit(shot, boss.x, boss.y, c.coreRadius)) return { result: 'hit', part: 'core' };
    return null;
  }
  const c = BOSSES.orbital;
  for (const s of boss.sats) {
    if (movingCircleHit(shot, s.x, s.y, s.r)) return { result: 'hit', part: s };
  }
  if (movingCircleHit(shot, boss.x, boss.y, c.coreRadius)) {
    return boss.sats.length > 0 ? { result: 'block' } : { result: 'hit', part: 'core' };
  }
  return null;
}

// 보조 무기가 노릴 수 있는 약점 목록: [{ x, y, r, part }]
export function bossWeakPoints(boss, out) {
  out.length = 0;
  if (!bossActive(boss)) return out;
  if (boss.kind === 'prism') {
    out.push({ x: boss.x, y: boss.y, r: BOSSES.prism.coreRadius, part: 'core' });
  } else if (boss.sats.length > 0) {
    for (const s of boss.sats) out.push({ x: s.x, y: s.y, r: s.r, part: s });
  } else {
    out.push({ x: boss.x, y: boss.y, r: BOSSES.orbital.coreRadius, part: 'core' });
  }
  return out;
}

// 피해 적용. 결과: { satKilled: sat | null, killed: bool }
export function damageBoss(boss, part, dmg) {
  if (part === 'core') {
    boss.hp = Math.max(0, boss.hp - dmg);
    if (boss.hp === 0) {
      boss.defeated = true;
      if (boss.beam) boss.beam.state = 'idle';
      return { satKilled: null, killed: true };
    }
    return { satKilled: null, killed: false };
  }
  part.hp -= dmg;
  if (part.hp <= 0) {
    const i = boss.sats.indexOf(part);
    if (i >= 0) boss.sats.splice(i, 1);
    return { satKilled: part, killed: false };
  }
  return { satKilled: null, killed: false };
}

// 우두머리 몸체 vs 플레이어 (부딪치면 플레이어만 피격)
export function bossTouchesPlayer(boss, px, py, pr) {
  if (!bossActive(boss)) return false;
  if (boss.kind === 'prism') return circleHit(boss.x, boss.y, BOSSES.prism.bodyRadius, px, py, pr);
  if (circleHit(boss.x, boss.y, BOSSES.orbital.coreRadius, px, py, pr)) return true;
  for (const s of boss.sats) {
    if (circleHit(s.x, s.y, s.r, px, py, pr)) return true;
  }
  return false;
}

// 프리즘 광선 vs 플레이어 (축 정렬 사각형)
export function beamRect(boss, height) {
  if (!boss || boss.kind !== 'prism' || boss.beam.state !== 'fire') return null;
  const w = BOSSES.prism.beamWidth;
  return { x: boss.beam.x - w / 2, y: boss.beam.top, w, h: height - boss.beam.top };
}
