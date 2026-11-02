// 원소 데이터, 조합표, 점수 상수 — 순수 데이터 모듈

export const BOARD_SIZE = 5;
export const MAX_GRADE = 5;
export const QUEUE_LENGTH = 2;
export const START_TILES = 3;
export const BONUS_SPAWN_EVERY = 10;

// tier: base(기본) | compound(화합물) | rare(희귀) | final(최종)
export const ELEMENTS = {
  water: { key: 'water', name: '물', symbol: '水', tier: 'base' },
  fire: { key: 'fire', name: '불', symbol: '火', tier: 'base' },
  earth: { key: 'earth', name: '흙', symbol: '土', tier: 'base' },
  wind: { key: 'wind', name: '바람', symbol: '風', tier: 'base' },
  steam: { key: 'steam', name: '증기', symbol: '蒸', tier: 'compound' },
  lava: { key: 'lava', name: '용암', symbol: '熔', tier: 'compound' },
  mud: { key: 'mud', name: '진흙', symbol: '泥', tier: 'compound' },
  lightning: { key: 'lightning', name: '번개', symbol: '雷', tier: 'compound' },
  rain: { key: 'rain', name: '비', symbol: '雨', tier: 'compound' },
  sand: { key: 'sand', name: '모래', symbol: '砂', tier: 'compound' },
  life: { key: 'life', name: '생명', symbol: '生', tier: 'rare' },
  glass: { key: 'glass', name: '유리', symbol: '璃', tier: 'rare' },
  storm: { key: 'storm', name: '폭풍', symbol: '嵐', tier: 'rare' },
  obsidian: { key: 'obsidian', name: '흑요석', symbol: '曜', tier: 'rare' },
  stone: { key: 'stone', name: '현자의 돌', symbol: '賢', tier: 'final' }
};

export const BASE_ELEMENTS = ['water', 'fire', 'earth', 'wind'];

// 조합표: [재료1, 재료2, 결과] — 순서 무관
export const RECIPES = [
  ['water', 'fire', 'steam'],
  ['fire', 'earth', 'lava'],
  ['earth', 'water', 'mud'],
  ['wind', 'fire', 'lightning'],
  ['wind', 'water', 'rain'],
  ['wind', 'earth', 'sand'],
  ['mud', 'lightning', 'life'],
  ['sand', 'lava', 'glass'],
  ['rain', 'lightning', 'storm'],
  ['lava', 'rain', 'obsidian'],
  ['life', 'glass', 'stone']
];

const recipeKey = (a, b) => (a < b ? `${a}+${b}` : `${b}+${a}`);

const RECIPE_MAP = new Map(RECIPES.map(([a, b, result]) => [recipeKey(a, b), result]));

export function findRecipe(a, b) {
  return RECIPE_MAP.get(recipeKey(a, b)) || null;
}

// 도감 대상 11종 (조합표 순서)
export const CODEX = RECIPES.map(([a, b, result]) => ({ result, inputs: [a, b] }));

export const CODEX_TIER_COUNTS = {
  compound: CODEX.filter((c) => ELEMENTS[c.result].tier === 'compound').length,
  rare: CODEX.filter((c) => ELEMENTS[c.result].tier === 'rare').length,
  all: CODEX.length
};

export const SCORE = {
  upgrade: (grade) => 5 * grade * grade,
  transmute: { compound: 30, rare: 80, final: 300 },
  sublimate: { base: 200, compound: 400, rare: 800, final: 2000 },
  discovery: { compound: 50, rare: 150, final: 500 },
  codexBonus: { compound: 300, rare: 800, all: 2000 },
  chainStep: 0.25
};

export const ROMAN = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];

export const FINAL_ELEMENT = 'stone';
