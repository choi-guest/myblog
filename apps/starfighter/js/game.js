// 스타파이터 게임 규칙: 상태, 점수, 연쇄, 아이템, 보조 무기, 웨이브·우두머리, 클리어/게임 오버.
// DOM·window·Math.random·Date.now 접근 없음. 난수는 rng 주입, 시간은 step(dt)로만 받는다.

import {
  WORLD, PLAYER, ENEMY_SHOT, ENEMY_TYPES, BEHAVIOR, STAGES, BOSSES, ITEMS, ENERGY,
  WEAPONS, SCORE, WAVE, TIMING, waveEnemyCount
} from './config.js';
import { createFormation, slotPosition, assignTypes } from './formations.js';
import {
  createEnemy, createFragment, createMine, updateEnemy, damageEnemy,
  isCollidable, isDiving, isActiveDiver, canStartDive, startTelegraph
} from './enemies.js';
import {
  createBoss, updateBoss, bossShotTest, bossWeakPoints, damageBoss,
  bossTouchesPlayer, beamRect, bossActive
} from './boss.js';
import { circleHit, movingCircleHit, rectCircleHit } from './collision.js';
import { createRng, randInt, weightedIndex } from './rng.js';

const DEG = Math.PI / 180;

// ---------- 점수 순수 함수 ----------

export function chainMultiplier(chain) {
  const m = Math.round((1 + SCORE.chainStep * chain) * 10) / 10;
  return Math.min(m, SCORE.maxMultiplier);
}

export function killPoints(base, chain) {
  return Math.round((base * chainMultiplier(chain)) / 10) * 10;
}

export function stageBonus(stage, noHit, maxChain) {
  const base = SCORE.stageBase * stage;
  const perfect = noHit ? SCORE.noHitBonus * stage : 0;
  const chain = maxChain * SCORE.chainBonus;
  return { base, perfect, chain, total: base + perfect + chain };
}

// ---------- 풀 (탄 객체 재사용) ----------

function makePool(factory) {
  const free = [];
  return {
    get() {
      return free.length > 0 ? free.pop() : factory();
    },
    put(o) {
      free.push(o);
    }
  };
}

function newBullet() {
  return { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, r: 0, dmg: 0, pierce: false, life: 0, dead: false };
}

function sweep(arr, pool) {
  let w = 0;
  for (let i = 0; i < arr.length; i += 1) {
    const o = arr[i];
    if (o.dead) pool.put(o);
    else arr[w++] = o;
  }
  arr.length = w;
}

function offscreen(o, m) {
  return o.y < -m || o.y > WORLD.height + m || o.x < -m || o.x > WORLD.width + m;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

// ---------- 게임 ----------

export function createGame(opts = {}) {
  const stage = clamp(opts.stage || 1, 1, STAGES.length);
  const cfg = STAGES[stage - 1];
  const rng = opts.rng || createRng(1);
  const weapon = WEAPONS[opts.weapon] ? opts.weapon : 'burst';
  let idCounter = 1;
  const nextId = () => idCounter++;

  const bulletPool = makePool(newBullet);
  const itemPool = makePool(() => ({ x: 0, y: 0, kind: 'energy', dead: false }));

  const s = {
    stage, cfg, weapon,
    phase: 'intro', phaseTimer: TIMING.intro, time: 0,
    waveIndex: -1, waveTotal: cfg.waves.length, bossKind: cfg.boss,
    waveTime: 0, stretch: 0, formation: null, formationTime: 0,
    diveTimer: 0, fireTimer: 0, powerDropped: false,
    player: {
      x: PLAYER.spawnX, y: PLAYER.spawnY, r: PLAYER.radius,
      alive: true, respawnTimer: 0, invuln: 0, fireTimer: 0,
      power: clamp(opts.power || PLAYER.startPower, 1, PLAYER.maxPower),
      lives: clamp(opts.lives || PLAYER.startLives, 1, PLAYER.maxLives)
    },
    score: opts.score || 0,
    chain: 0, chainTimer: 0, maxChain: 0, hitThisStage: false,
    energy: 0,
    enemies: [], shots: [], droneShots: [], enemyShots: [], reflected: [], items: [], missiles: [],
    burst: null, homingLeft: 0, homingTimer: 0,
    drone: { timer: 0, angle: 0, fireTimer: 0, turn: 0, pos: [{ x: 0, y: 0 }, { x: 0, y: 0 }] },
    boss: null,
    bonus: null,
    lastWave: 0
  };

  let events = [];

  // ----- 공용 동작 -----

  function addEnergy(n) {
    const before = s.energy;
    s.energy = Math.min(ENERGY.max, s.energy + n);
    if (before < ENERGY.max && s.energy >= ENERGY.max) events.push({ type: 'specialReady' });
  }

  function fireEnemyShot(x, y, vx, vy) {
    if (s.enemyShots.length >= cfg.shotCap) return false;
    const b = bulletPool.get();
    b.x = x; b.y = y; b.px = x; b.py = y; b.vx = vx; b.vy = vy;
    b.r = ENEMY_SHOT.radius; b.dmg = 1; b.pierce = false; b.life = 0; b.dead = false;
    s.enemyShots.push(b);
    return true;
  }

  function clearEnemyShots() {
    for (const b of s.enemyShots) b.dead = true;
    sweep(s.enemyShots, bulletPool);
  }

  function registerKill(base, x, y, info) {
    if (s.chainTimer > 0) s.chain += 1;
    else s.chain = 0;
    s.chainTimer = SCORE.chainWindow;
    if (s.chain > s.maxChain) s.maxChain = s.chain;
    const points = killPoints(base, s.chain);
    s.score += points;
    addEnergy(ENERGY.perKill);
    events.push({ type: 'kill', points, chain: s.chain, multiplier: chainMultiplier(s.chain), x, y, ...info });
  }

  function dropItem(x, y) {
    const r = rng();
    let kind = null;
    if (r < ITEMS.energyChance) kind = 'energy';
    else if (r < ITEMS.energyChance + ITEMS.powerChance) {
      if (!s.powerDropped) {
        kind = 'power';
        s.powerDropped = true;
      }
    } else if (r < ITEMS.energyChance + ITEMS.powerChance + ITEMS.repairChance) kind = 'repair';
    if (kind) spawnItem(kind, x, y);
  }

  function spawnItem(kind, x, y) {
    const it = itemPool.get();
    it.x = clamp(x, 12, WORLD.width - 12);
    it.y = y;
    it.kind = kind;
    it.dead = false;
    s.items.push(it);
  }

  function killEnemy(e) {
    const t = ENEMY_TYPES[e.type];
    const dive = isDiving(e);
    e.remove = true;
    registerKill(dive ? t.diveScore : t.score, e.x, e.y, { enemy: e.type, dive });
    if (e.type === 'splitter') {
      s.enemies.push(createFragment(nextId(), e.x - 4, e.y, -1));
      s.enemies.push(createFragment(nextId(), e.x + 4, e.y, 1));
    } else if (e.type === 'warden') {
      for (const o of s.enemies) {
        if (o.buffBy === e.id) o.buffBy = 0;
      }
    }
    if (e.type !== 'mine') dropItem(e.x, e.y);
  }

  function hitEnemy(e, dmg, pierce, hitX) {
    const res = damageEnemy(e, dmg, pierce, hitX);
    if (res === 'kill') killEnemy(e);
    else if (res === 'deflect') events.push({ type: 'deflect', x: hitX, y: e.y + e.r });
    else if (res === 'absorb') events.push({ type: 'absorb', x: e.x, y: e.y });
    return res;
  }

  function hitBoss(part, dmg, x, y) {
    const boss = s.boss;
    const res = damageBoss(boss, part, dmg);
    if (res.satKilled) {
      registerKill(BOSSES.orbital.satScore, res.satKilled.x, res.satKilled.y, { enemy: 'satellite', dive: false });
    }
    if (res.killed) {
      registerKill(BOSSES[boss.kind].score, boss.x, boss.y, { enemy: boss.kind, dive: false, boss: true });
      events.push({ type: 'bossDefeat', name: boss.name, x: boss.x, y: boss.y });
      beginClearing();
    } else if (!res.satKilled) {
      events.push({ type: 'bossHurt', x, y });
    }
  }

  function explodeMine(e) {
    const b = BEHAVIOR.mine;
    for (let k = 0; k < b.shards; k += 1) {
      const a = (360 / b.shards) * k * DEG;
      fireEnemyShot(e.x, e.y, Math.cos(a) * b.shardSpeed, Math.sin(a) * b.shardSpeed);
    }
    events.push({ type: 'mineExplode', x: e.x, y: e.y });
  }

  function summonScout(x, y) {
    const e = createEnemy(nextId(), 'scout', x, y, null, 0);
    e.summoned = true;
    s.enemies.push(e);
  }

  function summonCount() {
    let n = 0;
    for (const e of s.enemies) if (e.summoned && !e.remove) n += 1;
    return n;
  }

  const enemyCtx = {
    mul: cfg.speedMul,
    player: s.player,
    rng,
    shotSpeed: cfg.shotSpeed,
    diverFires: cfg.diverFires,
    extraFireChance: cfg.extraFireChance,
    enemies: s.enemies,
    slotPos: (e, out) => slotPosition(s.formation, e.slot, s.formationTime, cfg.speedMul, out),
    fireShot: fireEnemyShot,
    spawnMine: (x, y) => s.enemies.push(createMine(nextId(), x, y)),
    explodeMine
  };

  const bossCtx = {
    player: s.player,
    rng,
    fireShot: fireEnemyShot,
    summon: summonScout,
    summonCount,
    nextId,
    events: null
  };

  // ----- 단계 진행 -----

  function startWave(i) {
    const w = cfg.waves[i];
    const n = waveEnemyCount(w);
    s.waveIndex = i;
    s.lastWave = i + 1;
    s.formation = createFormation(w.formation, n);
    s.formationTime = 0;
    const types = assignTypes(w.mix, n);
    const pos = { x: 0, y: 0 };
    let sniperNo = 0;
    for (let k = 0; k < n; k += 1) {
      slotPosition(s.formation, k, 0, cfg.speedMul, pos);
      const e = createEnemy(nextId(), types[k], pos.x, pos.y, k, k * BEHAVIOR.warpStagger);
      if (e.type === 'sniper') {
        e.sniperTimer = BEHAVIOR.sniper.firstDelay + sniperNo * BEHAVIOR.sniper.stagger;
        sniperNo += 1;
      }
      s.enemies.push(e);
    }
    const warpEnd = BEHAVIOR.warpTime + n * BEHAVIOR.warpStagger;
    s.diveTimer = cfg.diveInterval + warpEnd;
    s.fireTimer = cfg.fireInterval + warpEnd;
    s.waveTime = 0;
    s.stretch = 0;
    s.powerDropped = false;
    s.phase = 'playing';
    events.push({ type: 'waveStart', wave: i + 1, total: cfg.waves.length, count: n });
  }

  function beginClearing() {
    s.phase = 'clearing';
    s.phaseTimer = TIMING.clearDelay;
    clearEnemyShots();
    for (const e of s.enemies) e.remove = true;
    s.homingLeft = 0;
  }

  function finishStage() {
    const bonus = stageBonus(s.stage, !s.hitThisStage, s.maxChain);
    s.score += bonus.total;
    s.bonus = bonus;
    s.phase = 'cleared';
    events.push({
      type: 'stageClear', stage: s.stage, bonus, points: bonus.total,
      noHit: !s.hitThisStage, maxChain: s.maxChain, allClear: s.stage === STAGES.length
    });
  }

  function onWaveCleared() {
    events.push({ type: 'waveClear', wave: s.waveIndex + 1 });
    if (s.waveIndex + 1 < cfg.waves.length) {
      s.phase = 'waveGap';
      s.phaseTimer = WAVE.gap;
    } else if (cfg.boss) {
      spawnItem('repair', WORLD.width / 2, 320);
      s.phase = 'bossWarning';
      s.phaseTimer = TIMING.bossWarning;
      s.formation = null;
      events.push({ type: 'bossWarning', name: BOSSES[cfg.boss].name });
    } else {
      beginClearing();
    }
  }

  // ----- 플레이어 -----

  function respawn() {
    const p = s.player;
    p.x = PLAYER.spawnX;
    p.y = PLAYER.spawnY;
    p.alive = true;
    p.invuln = PLAYER.invulnTime;
    p.fireTimer = 0;
    const r2 = PLAYER.respawnClearRadius * PLAYER.respawnClearRadius;
    for (const b of s.enemyShots) {
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      if (dx * dx + dy * dy <= r2) b.dead = true;
    }
    events.push({ type: 'respawn' });
  }

  function hitPlayer() {
    const p = s.player;
    p.alive = false;
    p.lives -= 1;
    p.power = Math.max(1, p.power - 1);
    s.chain = 0;
    s.chainTimer = 0;
    s.hitThisStage = true;
    events.push({ type: 'hit', lives: p.lives, x: p.x, y: p.y });
    if (p.lives <= 0) {
      p.lives = 0;
      s.phase = 'dying';
      s.phaseTimer = TIMING.gameOverDelay;
    } else {
      p.respawnTimer = PLAYER.respawnDelay;
    }
  }

  function pushPlayerShot(x, y, vx, vy) {
    const b = bulletPool.get();
    b.x = x; b.y = y; b.px = x; b.py = y; b.vx = vx; b.vy = vy;
    b.r = PLAYER.shotRadius; b.dmg = PLAYER.shotDamage; b.pierce = false; b.life = 0; b.dead = false;
    s.shots.push(b);
  }

  function firePlayer() {
    const p = s.player;
    const need = p.power;
    if (s.shots.length + need > PLAYER.maxShots) return;
    const sp = PLAYER.shotSpeed;
    const y = p.y - 14;
    if (p.power === 1) pushPlayerShot(p.x, y, 0, -sp);
    else if (p.power === 2) {
      pushPlayerShot(p.x - PLAYER.power2Gap / 2, y, 0, -sp);
      pushPlayerShot(p.x + PLAYER.power2Gap / 2, y, 0, -sp);
    } else {
      const a = PLAYER.power3AngleDeg * DEG;
      pushPlayerShot(p.x, y, 0, -sp);
      pushPlayerShot(p.x - 3, y, -Math.sin(a) * sp, -Math.cos(a) * sp);
      pushPlayerShot(p.x + 3, y, Math.sin(a) * sp, -Math.cos(a) * sp);
    }
    events.push({ type: 'fire' });
  }

  function specialAllowed() {
    return s.phase === 'intro' || s.phase === 'playing' || s.phase === 'waveGap' ||
      s.phase === 'bossWarning' || s.phase === 'boss';
  }

  function activateSpecial() {
    const p = s.player;
    s.energy = 0;
    events.push({ type: 'special', weapon: s.weapon, x: p.x, y: p.y });
    if (s.weapon === 'burst') {
      s.burst = { x: p.x, y: p.y, t: 0, r: 0, hit: new Set() };
      clearEnemyShots();
    } else if (s.weapon === 'homing') {
      s.homingLeft = WEAPONS.homing.count;
      s.homingTimer = 0;
    } else {
      s.drone.timer = WEAPONS.drone.duration;
      s.drone.fireTimer = 0;
    }
  }

  function updatePlayer(dt, input) {
    const p = s.player;
    if (!p.alive) {
      if (s.phase !== 'dying' && p.lives > 0) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) respawn();
      }
      return;
    }
    let dx = input.dx || 0;
    let dy = input.dy || 0;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    p.x += dx * PLAYER.speed * dt;
    p.y += dy * PLAYER.speed * dt;
    if (input.pointerDelta) {
      p.x += input.pointerDelta.x || 0;
      p.y += input.pointerDelta.y || 0;
    }
    p.x = clamp(p.x, PLAYER.minX, PLAYER.maxX);
    p.y = clamp(p.y, PLAYER.minY, PLAYER.maxY);
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);

    p.fireTimer -= dt;
    if (input.fire && p.fireTimer <= 0 && s.phase !== 'clearing') {
      p.fireTimer = PLAYER.fireInterval;
      firePlayer();
    }
    if (p.fireTimer < 0) p.fireTimer = 0;

    if (input.special && s.energy >= ENERGY.max && specialAllowed()) activateSpecial();
  }

  // ----- 적 -----

  function updateEnemies(dt) {
    const n = s.enemies.length;
    for (let i = 0; i < n; i += 1) {
      const e = s.enemies[i];
      if (!e.remove) updateEnemy(e, dt, enemyCtx);
    }
    if (s.phase !== 'playing' || !s.formation) return;

    s.waveTime += dt;
    if (s.stretch < WAVE.stretchMax && s.waveTime >= WAVE.stretchTime * (s.stretch + 1)) {
      s.stretch += 1;
      events.push({ type: 'waveStretch', level: s.stretch });
    }

    s.diveTimer -= dt;
    if (s.diveTimer <= 0) {
      s.diveTimer = cfg.diveInterval * Math.pow(WAVE.stretchFactor, s.stretch);
      let active = 0;
      for (const e of s.enemies) if (!e.remove && isActiveDiver(e)) active += 1;
      if (active < cfg.maxDivers) {
        const cands = [];
        const weights = [];
        for (const e of s.enemies) {
          if (!e.remove && canStartDive(e)) {
            cands.push(e);
            weights.push(ENEMY_TYPES[e.type].diveWeight);
          }
        }
        const k = weightedIndex(rng, weights);
        if (k >= 0) startTelegraph(cands[k]);
      }
    }

    s.fireTimer -= dt;
    if (s.fireTimer <= 0) {
      s.fireTimer = cfg.fireInterval;
      const cands = [];
      for (const e of s.enemies) if (!e.remove && e.state === 'formation') cands.push(e);
      if (cands.length > 0) {
        const e = cands[randInt(rng, cands.length)];
        fireEnemyShot(e.x, e.y + e.r, 0, cfg.shotSpeed);
      }
    }
  }

  // ----- 이동 -----

  function moveBullets(arr, dt, margin) {
    for (const b of arr) {
      b.px = b.x;
      b.py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (offscreen(b, margin)) b.dead = true;
    }
  }

  function updateMissiles(dt) {
    const h = WEAPONS.homing;
    const p = s.player;
    if (s.homingLeft > 0) {
      s.homingTimer -= dt;
      while (s.homingTimer <= 0 && s.homingLeft > 0) {
        s.homingTimer += h.interval;
        s.homingLeft -= 1;
        const m = bulletPool.get();
        m.x = p.x; m.y = p.y - 10; m.px = m.x; m.py = m.y;
        m.vx = 0; m.vy = -h.speed; m.r = h.radius; m.dmg = h.damage; m.pierce = true;
        m.life = h.life; m.dead = false;
        m.angle = -Math.PI / 2 + (s.homingLeft % 2 === 0 ? -0.5 : 0.5);
        s.missiles.push(m);
      }
    }
    const weak = bossWeakPoints(s.boss, weakTmp);
    for (const m of s.missiles) {
      m.life -= dt;
      let tx = 0;
      let ty = 0;
      let best = Infinity;
      for (const e of s.enemies) {
        if (!isCollidable(e)) continue;
        const d = (e.x - m.x) * (e.x - m.x) + (e.y - m.y) * (e.y - m.y);
        if (d < best) { best = d; tx = e.x; ty = e.y; }
      }
      for (const w of weak) {
        const d = (w.x - m.x) * (w.x - m.x) + (w.y - m.y) * (w.y - m.y);
        if (d < best) { best = d; tx = w.x; ty = w.y; }
      }
      if (best < Infinity) {
        const want = Math.atan2(ty - m.y, tx - m.x);
        let diff = want - m.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const maxTurn = h.turnDegPerSec * DEG * dt;
        m.angle += clamp(diff, -maxTurn, maxTurn);
      }
      m.vx = Math.cos(m.angle) * h.speed;
      m.vy = Math.sin(m.angle) * h.speed;
      m.px = m.x;
      m.py = m.y;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.life <= 0 || offscreen(m, 30)) m.dead = true;
    }
  }

  function updateDrones(dt) {
    const d = s.drone;
    const w = WEAPONS.drone;
    if (d.timer <= 0) return;
    d.timer = Math.max(0, d.timer - dt);
    d.angle += w.degPerSec * DEG * dt;
    const p = s.player;
    for (let i = 0; i < 2; i += 1) {
      const a = d.angle + i * Math.PI;
      d.pos[i].x = p.x + Math.cos(a) * w.orbit;
      d.pos[i].y = p.y + Math.sin(a) * w.orbit * 0.6;
    }
    if (!p.alive) return;
    d.fireTimer -= dt;
    if (d.fireTimer <= 0) {
      // 0.3초마다 보조탄 1발 (두 드론이 번갈아 발사)
      d.fireTimer = w.fireInterval;
      d.turn = (d.turn + 1) % 2;
      if (s.droneShots.length < w.maxShots) {
        const src = d.pos[d.turn];
        const b = bulletPool.get();
        b.x = src.x; b.y = src.y - 6; b.px = b.x; b.py = b.y;
        b.vx = 0; b.vy = -w.shotSpeed; b.r = PLAYER.shotRadius; b.dmg = w.damage; b.pierce = true;
        b.life = 0; b.dead = false;
        s.droneShots.push(b);
      }
    }
  }

  function updateItems(dt) {
    for (const it of s.items) {
      it.y += ITEMS.fallSpeed * dt;
      if (it.y > WORLD.height + 20) it.dead = true;
    }
  }

  function updateReflected(dt) {
    for (const b of s.reflected) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || offscreen(b, 10)) b.dead = true;
    }
  }

  // ----- 판정 -----

  const weakTmp = [];

  function processPlayerShots(arr) {
    for (const b of arr) {
      if (b.dead) continue;
      for (const e of s.enemies) {
        if (!isCollidable(e)) continue;
        if (movingCircleHit(b, e.x, e.y, e.r)) {
          b.dead = true;
          hitEnemy(e, b.dmg, b.pierce, b.x);
          break;
        }
      }
      if (b.dead || !s.boss) continue;
      const res = bossShotTest(s.boss, b);
      if (!res) continue;
      b.dead = true;
      if (res.result === 'reflect') {
        const r = bulletPool.get();
        const sp = BOSSES.prism.reflectSpeed;
        r.x = b.x; r.y = b.y; r.px = b.x; r.py = b.y;
        r.vx = res.sign * 0.6 * sp; r.vy = 0.8 * sp; r.r = 3; r.life = 1.2; r.dead = false;
        s.reflected.push(r);
        events.push({ type: 'reflect', x: b.x, y: b.y });
      } else if (res.result === 'block') {
        events.push({ type: 'coreBlock', x: b.x, y: b.y });
      } else {
        hitBoss(res.part, b.dmg, b.x, b.y);
      }
      if (s.phase === 'clearing') break;
    }
  }

  function processSpecials(dt) {
    const bu = s.burst;
    if (bu) {
      const w = WEAPONS.burst;
      bu.t += dt;
      bu.r = w.maxRadius * Math.min(1, bu.t / w.duration);
      for (const e of s.enemies) {
        if (!isCollidable(e) || bu.hit.has(e.id)) continue;
        if (circleHit(bu.x, bu.y, bu.r, e.x, e.y, e.r)) {
          bu.hit.add(e.id);
          hitEnemy(e, w.damage, true, e.x);
        }
      }
      for (const b of s.enemyShots) {
        if (circleHit(bu.x, bu.y, bu.r, b.x, b.y, b.r)) b.dead = true;
      }
      if (s.boss && s.phase === 'boss') {
        const weak = bossWeakPoints(s.boss, weakTmp).slice();
        for (const wp of weak) {
          const key = wp.part === 'core' ? 'core' : `sat${wp.part.id}`;
          if (bu.hit.has(key)) continue;
          if (circleHit(bu.x, bu.y, bu.r, wp.x, wp.y, wp.r)) {
            bu.hit.add(key);
            hitBoss(wp.part, w.damage, wp.x, wp.y);
            if (s.phase !== 'boss') break;
          }
        }
      }
      if (bu.t >= w.duration) s.burst = null;
    }

    for (const m of s.missiles) {
      if (m.dead) continue;
      for (const e of s.enemies) {
        if (!isCollidable(e)) continue;
        if (movingCircleHit(m, e.x, e.y, e.r)) {
          m.dead = true;
          hitEnemy(e, m.dmg, true, e.x);
          break;
        }
      }
      if (m.dead || !s.boss || s.phase !== 'boss') continue;
      const weak = bossWeakPoints(s.boss, weakTmp);
      for (const wp of weak) {
        if (movingCircleHit(m, wp.x, wp.y, wp.r)) {
          m.dead = true;
          hitBoss(wp.part, m.dmg, m.x, m.y);
          break;
        }
      }
    }

    const d = s.drone;
    if (d.timer > 0 && s.player.alive) {
      const r = WEAPONS.drone.radius;
      for (const b of s.enemyShots) {
        if (b.dead) continue;
        if (circleHit(d.pos[0].x, d.pos[0].y, r, b.x, b.y, b.r) || circleHit(d.pos[1].x, d.pos[1].y, r, b.x, b.y, b.r)) {
          b.dead = true;
          events.push({ type: 'droneBlock', x: b.x, y: b.y });
        }
      }
    }
  }

  function processThreats() {
    const p = s.player;
    if (!p.alive || p.invuln > 0) return;
    if (s.phase === 'clearing' || s.phase === 'cleared') return;
    let hit = false;
    for (const b of s.enemyShots) {
      if (b.dead) continue;
      if (circleHit(b.x, b.y, b.r, p.x, p.y, p.r)) {
        b.dead = true;
        hit = true;
      }
    }
    const n = s.enemies.length; // 처치로 생긴 분열 조각은 이번 판정에서 제외
    for (let i = 0; i < n; i += 1) {
      const e = s.enemies[i];
      if (!isCollidable(e)) continue;
      if (circleHit(e.x, e.y, e.r, p.x, p.y, p.r)) {
        killEnemy(e); // 부딪친 적은 즉시 처치 처리
        hit = true;
      }
    }
    if (s.boss) {
      if (bossTouchesPlayer(s.boss, p.x, p.y, p.r)) hit = true;
      const rect = beamRect(s.boss, WORLD.height);
      if (rect && rectCircleHit(rect.x, rect.y, rect.w, rect.h, p.x, p.y, p.r)) hit = true;
    }
    if (hit) hitPlayer(); // 한 스텝에 여러 번 맞아도 목숨은 1만 감소
  }

  function processItems() {
    const p = s.player;
    if (!p.alive) return;
    for (const it of s.items) {
      if (it.dead) continue;
      if (!circleHit(it.x, it.y, ITEMS.pickupRadius, p.x, p.y, 0)) continue;
      it.dead = true;
      let points = 0;
      if (it.kind === 'energy') {
        addEnergy(ITEMS.energyGain);
      } else if (it.kind === 'power') {
        if (p.power < PLAYER.maxPower) p.power += 1;
        else points = ITEMS.powerOverflowScore;
      } else if (p.lives < PLAYER.maxLives) {
        p.lives += 1;
      } else {
        points = ITEMS.repairOverflowScore;
      }
      s.score += points;
      events.push({ type: 'item', item: it.kind, points, power: p.power, lives: p.lives, energy: s.energy });
    }
  }

  function cleanup() {
    sweep(s.shots, bulletPool);
    sweep(s.droneShots, bulletPool);
    sweep(s.enemyShots, bulletPool);
    sweep(s.reflected, bulletPool);
    sweep(s.missiles, bulletPool);
    sweep(s.items, itemPool);
    let w = 0;
    for (let i = 0; i < s.enemies.length; i += 1) {
      const e = s.enemies[i];
      if (!e.remove) s.enemies[w++] = e;
    }
    s.enemies.length = w;
  }

  // ----- 스텝 -----

  function step(dt, input = {}) {
    events = [];
    if (s.phase === 'cleared' || s.phase === 'over') return events;
    s.time += dt;

    if (s.chainTimer > 0) {
      s.chainTimer -= dt;
      if (s.chainTimer <= 0) {
        s.chainTimer = 0;
        s.chain = 0;
      }
    }

    if (s.phase === 'intro') {
      s.phaseTimer -= dt;
      if (s.phaseTimer <= 0) {
        events.push({ type: 'stageStart', stage: s.stage });
        startWave(0);
      }
    } else if (s.phase === 'waveGap') {
      s.phaseTimer -= dt;
      if (s.phaseTimer <= 0) startWave(s.waveIndex + 1);
    } else if (s.phase === 'bossWarning') {
      s.phaseTimer -= dt;
      if (s.phaseTimer <= 0) {
        s.boss = createBoss(cfg.boss, nextId);
        s.phase = 'boss';
        s.powerDropped = false;
        events.push({ type: 'bossSpawn', name: s.boss.name });
      }
    } else if (s.phase === 'clearing') {
      s.phaseTimer -= dt;
      if (s.phaseTimer <= 0) {
        finishStage();
        return events;
      }
    } else if (s.phase === 'dying') {
      s.phaseTimer -= dt;
      if (s.phaseTimer <= 0) {
        s.phase = 'over';
        events.push({
          type: 'gameOver', score: s.score, stage: s.stage,
          wave: s.lastWave, maxChain: s.maxChain, boss: !!s.boss
        });
        return events;
      }
    }

    // 1) 이동
    updatePlayer(dt, input);
    if (s.formation) s.formationTime += dt;
    updateEnemies(dt);
    if (s.boss && s.phase !== 'clearing') {
      bossCtx.events = events;
      updateBoss(s.boss, dt, bossCtx);
    }
    moveBullets(s.shots, dt, 10);
    moveBullets(s.droneShots, dt, 10);
    moveBullets(s.enemyShots, dt, 12);
    updateReflected(dt);
    updateMissiles(dt);
    updateDrones(dt);
    updateItems(dt);

    // 2) 플레이어 탄 vs 적/기뢰/우두머리
    processPlayerShots(s.shots);
    processPlayerShots(s.droneShots);
    // 3) 보조 무기 vs 적·적 탄
    processSpecials(dt);
    // 4) 적 탄·적·광선 vs 플레이어
    processThreats();
    // 5) 아이템
    processItems();
    // 6) 정리
    cleanup();

    if (s.phase === 'playing' && s.enemies.length === 0) onWaveCleared();
    return events;
  }

  return {
    step,
    getState: () => s
  };
}

export { bossActive };
