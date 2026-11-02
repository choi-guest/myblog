// 스타파이터 — 순수 데이터(단계 표, 적·우두머리 수치, 점수, 아이템). DOM 접근 없음.

export const WORLD = {
  width: 360,
  height: 640,
  step: 1 / 60,
  maxStepsPerFrame: 5,
  formationTop: 60,
  formationBottom: 300
};

export const PLAYER = {
  speed: 210,
  radius: 6,
  minX: 16,
  maxX: 344,
  minY: 470,
  maxY: 610,
  spawnX: 180,
  spawnY: 580,
  fireInterval: 0.16,
  shotSpeed: 560,
  shotRadius: 3,
  shotDamage: 1,
  maxShots: 24,
  power2Gap: 10,
  power3AngleDeg: 6,
  startLives: 3,
  maxLives: 5,
  startPower: 1,
  maxPower: 3,
  respawnDelay: 1.0,
  invulnTime: 2.0,
  respawnClearRadius: 60
};

export const ENEMY_SHOT = { radius: 3 };

// HP는 기본값 고정(단계 배율 없음). score: 대형 / diveScore: 이탈 중
export const ENEMY_TYPES = {
  scout: { hp: 1, radius: 10, score: 100, diveScore: 150, diveWeight: 3, canDive: true },
  shield: { hp: 3, radius: 13, score: 200, diveScore: 300, diveWeight: 2, canDive: true },
  splitter: { hp: 2, radius: 14, score: 150, diveScore: 225, diveWeight: 2, canDive: true },
  fragment: { hp: 1, radius: 7, score: 50, diveScore: 50, diveWeight: 0, canDive: false },
  miner: { hp: 2, radius: 12, score: 200, diveScore: 300, diveWeight: 2, canDive: true },
  sniper: { hp: 2, radius: 11, score: 250, diveScore: 250, diveWeight: 0, canDive: false },
  warden: { hp: 4, radius: 15, score: 400, diveScore: 400, diveWeight: 0, canDive: false },
  mine: { hp: 1, radius: 6, score: 10, diveScore: 10, diveWeight: 0, canDive: false }
};

export const BEHAVIOR = {
  warpTime: 0.6,
  warpStagger: 0.05,
  telegraphTime: 0.4,
  extraShotDelay: 0.8,
  exitMargin: 24,
  scout: { speed: 150, zigAmp: 42, zigFreq: 2.4 },
  shield: { speed: 60, trackSpeed: 30, frontHalfWidth: 8 },
  splitter: { speed: 140 },
  fragment: { speed: 120, angleDeg: 45 },
  miner: { speed: 120, laneY: 360, laneJitter: 40, mines: 3 },
  mine: { fuse: 2.5, shards: 8, shardSpeed: 90 },
  sniper: { interval: 4.0, firstDelay: 1.6, stagger: 0.7, aimTime: 0.8, shotSpeed: 300 },
  warden: { interval: 6.0, firstDelay: 1.5, range: 70 }
};

export const FORMATIONS = {
  ring: { cx: 180, cy: 170, radius: 90, outerRadius: 100, innerRadius: 55, singleMax: 14, degPerSec: 12 },
  vee: { cx: 180, apexY: 272, drift: 40, period: 8 },
  // 쌍기둥: 좌우 1/3 지점(120, 240). 교체는 중심(cx, cy) 기준 180° 회전, 회전 반경 maxRadius 이하
  pillars: { xs: [120, 240], cx: 180, cy: 180, maxRadius: 118, maxSpacing: 36, subGap: 17, tripleGap: 32, period: 6, slide: 1.5 },
  block: { centers: [[96, 180], [264, 180]], spacing: 31, degPerSec: 8 },
  // 9단계 웨이브 3: 고리 + V자 축소판 동시 진입
  // 자리 간격 32lp 이상(가장 큰 두 적의 반경 합 30 + 여유), V자 팔은 고리에서 30lp 이상 떨어지게
  ringVee: { ringCx: 180, ringCy: 130, ringRadius: 70, veeApexY: 290, veeDx: 20, veeDy: 25, veeDrift: 10 }
};

const S = (scout, shield = 0, splitter = 0, miner = 0, sniper = 0, warden = 0) =>
  ({ scout, shield, splitter, miner, sniper, warden });

// 10단계 난이도 표 (spec 3장)
export const STAGES = [
  {
    stage: 1, speedMul: 1.00, diveInterval: 3.0, maxDivers: 1, fireInterval: 2.2,
    shotSpeed: 140, shotCap: 8, extraFireChance: 0, diverFires: false, boss: null,
    waves: [
      { formation: 'ring', mix: S(10) },
      { formation: 'vee', mix: S(12) },
      { formation: 'block', mix: S(14) }
    ]
  },
  {
    stage: 2, speedMul: 1.05, diveInterval: 2.7, maxDivers: 2, fireInterval: 2.0,
    shotSpeed: 150, shotCap: 10, extraFireChance: 0.2, diverFires: true, boss: null,
    waves: [
      { formation: 'vee', mix: S(12) },
      { formation: 'ring', mix: S(11, 3) },
      { formation: 'pillars', mix: S(12, 4) }
    ]
  },
  {
    stage: 3, speedMul: 1.10, diveInterval: 2.5, maxDivers: 2, fireInterval: 1.8,
    shotSpeed: 155, shotCap: 12, extraFireChance: 0.2, diverFires: true, boss: null,
    waves: [
      { formation: 'pillars', mix: S(9, 2, 3) },
      { formation: 'block', mix: S(9, 3, 4) },
      { formation: 'ring', mix: S(11, 3, 4) }
    ]
  },
  {
    stage: 4, speedMul: 1.15, diveInterval: 2.3, maxDivers: 2, fireInterval: 1.6,
    shotSpeed: 160, shotCap: 14, extraFireChance: 0.2, diverFires: true, boss: null,
    waves: [
      { formation: 'ring', mix: S(7, 3, 2, 4) },
      { formation: 'pillars', mix: S(8, 3, 3, 4) },
      { formation: 'vee', mix: S(8, 4, 3, 5) }
    ]
  },
  {
    stage: 5, speedMul: 1.15, diveInterval: 2.3, maxDivers: 2, fireInterval: 1.6,
    shotSpeed: 160, shotCap: 16, extraFireChance: 0.2, diverFires: true, boss: 'prism',
    waves: [
      { formation: 'block', mix: S(7, 3, 3, 3) },
      { formation: 'ring', mix: S(8, 3, 4, 3) }
    ]
  },
  {
    stage: 6, speedMul: 1.20, diveInterval: 2.0, maxDivers: 3, fireInterval: 1.4,
    shotSpeed: 170, shotCap: 18, extraFireChance: 0.2, diverFires: true, boss: null,
    waves: [
      { formation: 'vee', mix: S(6, 3, 3, 3, 3) },
      { formation: 'block', mix: S(7, 3, 3, 3, 4) },
      { formation: 'pillars', mix: S(7, 4, 3, 4, 4) }
    ]
  },
  {
    stage: 7, speedMul: 1.25, diveInterval: 1.8, maxDivers: 3, fireInterval: 1.3,
    shotSpeed: 180, shotCap: 20, extraFireChance: 0.4, diverFires: true, boss: null,
    waves: [
      { formation: 'pillars', mix: S(7, 3, 4, 3, 3) },
      { formation: 'ring', mix: S(7, 3, 4, 4, 4) },
      { formation: 'block', mix: S(8, 4, 4, 4, 4) }
    ]
  },
  {
    stage: 8, speedMul: 1.30, diveInterval: 1.6, maxDivers: 3, fireInterval: 1.2,
    shotSpeed: 190, shotCap: 22, extraFireChance: 0.4, diverFires: true, boss: null,
    waves: [
      { formation: 'block', mix: S(6, 3, 4, 3, 3, 3) },
      { formation: 'vee', mix: S(6, 3, 4, 4, 3, 4) },
      { formation: 'ring', mix: S(6, 4, 4, 4, 4, 4) }
    ]
  },
  {
    stage: 9, speedMul: 1.35, diveInterval: 1.4, maxDivers: 4, fireInterval: 1.1,
    shotSpeed: 200, shotCap: 26, extraFireChance: 0.4, diverFires: true, boss: null,
    waves: [
      { formation: 'ring', mix: S(5, 4, 4, 4, 4, 3) },
      { formation: 'pillars', mix: S(6, 4, 4, 4, 4, 4) },
      { formation: 'ringVee', mix: S(6, 5, 5, 4, 4, 4) }
    ]
  },
  {
    stage: 10, speedMul: 1.40, diveInterval: 1.3, maxDivers: 4, fireInterval: 1.0,
    shotSpeed: 210, shotCap: 30, extraFireChance: 0.4, diverFires: true, boss: 'orbital',
    waves: [
      { formation: 'vee', mix: S(4, 4, 4, 4, 4, 4) },
      { formation: 'block', mix: S(5, 4, 5, 4, 4, 4) }
    ]
  }
];

export const STAGE_COUNT = STAGES.length;

export function waveEnemyCount(wave) {
  let n = 0;
  for (const key of Object.keys(wave.mix)) n += wave.mix[key];
  return n;
}

export const BOSSES = {
  prism: {
    name: '프리즘', x: 180, y: 150, bodyRadius: 46, coreRadius: 16, hp: 120, score: 5000,
    warpTime: 1.0,
    reflectorOrbit: 64, reflectorHalfLength: 16, reflectorHalfThickness: 3, reflectorDegPerSec: 60,
    phase2: 0.6, phase3: 0.25,
    fanInterval: 1.5, fanSpeed: 150, fanSpreadDeg: 16, fanCount1: 5, fanCount3: 7,
    sweepWidth: 200, sweepPeriod: 5,
    beamInterval: 2, beamWarn: 0.9, beamTime: 0.5, beamWidth: 14,
    summonInterval: 4, summonCount: 2, summonMaxAlive: 4,
    reflectSpeed: 300
  },
  orbital: {
    name: '오비탈 코어', x: 180, y: 170, coreRadius: 30, hp: 200, score: 10000, warpTime: 1.0,
    satellites: 4, satHp: 10, satRadius: 12, satScore: 300, orbit: 80, orbitDegPerSec: 30,
    satFireInterval: 2.2, satShotSpeed: 150,
    spiralInterval: 4, spiralCount: 12, spiralGap: 0.05, spiralStepDeg: 30, spiralSpeed: 110,
    exposeTime: 8, regenCount: 2, regenMax: 2, exposedAmp: 80, exposedFreq: 1.0,
    exposedFireInterval: 1, exposedSpreadDeg: 15, exposedShotSpeed: 190,
    lowHp: 0.3, pulseMin: 50, pulseMax: 110, pulsePeriod: 3
  }
};

export const ITEMS = {
  fallSpeed: 70,
  pickupRadius: 18,
  energyChance: 0.30,
  powerChance: 0.05,
  repairChance: 0.01,
  energyGain: 10,
  powerOverflowScore: 500,
  repairOverflowScore: 1000
};

export const ENERGY = { max: 100, perKill: 4 };

export const WEAPONS = {
  burst: { name: '확산 폭풍', maxRadius: 220, duration: 0.5, damage: 3 },
  homing: { name: '추적 미사일', count: 8, interval: 0.1, speed: 380, turnDegPerSec: 240, damage: 4, radius: 4, life: 3 },
  drone: { name: '방패 드론', duration: 10, orbit: 28, degPerSec: 200, radius: 7, fireInterval: 0.3, shotSpeed: 520, damage: 1, maxShots: 12 }
};

export const WEAPON_KEYS = ['burst', 'homing', 'drone'];

export const SCORE = {
  chainWindow: 1.5,
  chainStep: 0.1,
  maxMultiplier: 3.0,
  stageBase: 1000,
  noHitBonus: 1000,
  chainBonus: 50
};

export const WAVE = { gap: 1.5, stretchTime: 20, stretchFactor: 0.8, stretchMax: 3 };

export const TIMING = { intro: 1.5, bossWarning: 2, clearDelay: 1.0, gameOverDelay: 1.5 };
