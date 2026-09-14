// 무인도 서바이벌 공용 설정 — 서버와 클라이언트가 함께 쓴다.

export const TICK_RATE = 20;
export const ROOM_MAX = 8;
export const CYCLE = { day: 170, night: 110 };
export const FINAL_TIME = 80;

export const PLAYER = {
  radius: 0.42, height: 1.8, eye: 1.6, reach: 3.2,
  walk: 6.2, sprint: 9.6, jump: 8.6, gravity: 24,
  maxHp: 100, maxStamina: 100, maxHunger: 100,
  sprintCost: 15, jumpCost: 9, staminaRegen: 30,
  hungerRate: 100 / 460, starve: 2.5, regenDelay: 6, regen: 1.3,
};

export const COLORS = ['#ffc93c', '#ff7b54', '#6bcb77', '#4d96ff', '#b983ff', '#ff8fb1', '#f5f5f5', '#3fd2c7'];

export const TIER_COLOR = { 0: '#e3c29b', 1: '#b07a45', 2: '#9a9ea3', 3: '#e2e6ea', 4: '#5fe3e8' };
const TIERS = [['wood', '나무', 1], ['stone', '돌', 2], ['iron', '철', 3], ['mithril', '미스릴', 4]];
const TOOLS = {
  axe: { name: '도끼', dmg: [9, 13, 19, 28], tree: [3, 5, 8, 12], rock: [0, 0, 0, 0], swing: 0.58 },
  pick: { name: '곡괭이', dmg: [7, 10, 15, 22], tree: [1, 1, 1, 1], rock: [3, 5, 8, 12], swing: 0.58 },
  sword: { name: '검', dmg: [15, 24, 36, 54], tree: [1, 1, 2, 2], rock: [0, 0, 0, 0], swing: 0.46 },
};

export const ITEMS = {
  wood: { name: '나무', cat: 'res', desc: '나무를 베어 얻는다' },
  stone: { name: '돌', cat: 'res', desc: '바위를 캐서 얻는다' },
  iron_ore: { name: '철광석', cat: 'res', desc: '돌 곡괭이 이상으로 철광맥을 캔다' },
  mithril_ore: { name: '미스릴 광석', cat: 'res', desc: '철 곡괭이 이상으로 높은 산의 미스릴을 캔다' },
  apple: { name: '사과', cat: 'food', food: { hunger: 14, hp: 6 }, desc: '배고픔 +14, 체력 +6' },
  raw_meat: { name: '날고기', cat: 'food', food: { hunger: 9, hp: 0 }, desc: '배고픔 +9. 모닥불에 구우면 훨씬 좋다' },
  cooked_meat: { name: '구운 고기', cat: 'food', food: { hunger: 40, hp: 24 }, desc: '배고픔 +40, 체력 +24' },
  fist: { name: '맨손', cat: 'tool', kind: 'fist', tier: 0, dmg: 6, tree: 1, rock: 0, swing: 0.42, desc: '나무는 맨손으로도 벨 수 있다' },
  iron_armor: { name: '철 갑옷', cat: 'armor', armor: 0.25, desc: '가지고만 있어도 받는 피해 -25%' },
  mithril_armor: { name: '미스릴 갑옷', cat: 'armor', armor: 0.45, desc: '가지고만 있어도 받는 피해 -45%' },
  workbench: { name: '작업대', cat: 'place', struct: 'workbench', desc: '설치하고 강화할수록 더 좋은 도구가 열린다' },
  campfire: { name: '모닥불', cat: 'place', struct: 'campfire', desc: '고기를 굽고, 곁에 있으면 체력이 빨리 찬다' },
  wood_floor: { name: '나무 바닥', cat: 'place', struct: 'wood_floor', desc: '3×3 바닥. 얕은 물 위에 깔면 부두가 된다' },
  stone_floor: { name: '돌 바닥', cat: 'place', struct: 'stone_floor', desc: '튼튼한 3×3 돌바닥' },
  wood_wall: { name: '나무 벽', cat: 'place', struct: 'wood_wall', desc: '격자에 맞춰 붙는 벽 (내구도 220)' },
  stone_wall: { name: '돌 벽', cat: 'place', struct: 'stone_wall', desc: '튼튼한 벽 (내구도 550)' },
  wood_window: { name: '나무 창문', cat: 'place', struct: 'wood_window', desc: '창문 달린 나무 벽' },
  stone_window: { name: '돌 창문', cat: 'place', struct: 'stone_window', desc: '창문 달린 돌벽' },
  wood_door: { name: '나무 문', cat: 'place', struct: 'wood_door', desc: '[E]로 여닫는 문' },
  iron_door: { name: '철문', cat: 'place', struct: 'iron_door', desc: '아주 튼튼한 문 (내구도 700)' },
  wood_roof: { name: '나무 지붕', cat: 'place', struct: 'wood_roof', desc: '벽 위에 저절로 올라가는 지붕' },
  stone_roof: { name: '기와 지붕', cat: 'place', struct: 'stone_roof', desc: '튼튼한 붉은 기와 지붕' },
  fence: { name: '울타리', cat: 'place', struct: 'fence', desc: '낮은 나무 울타리' },
  torch: { name: '횃불', cat: 'place', struct: 'torch', desc: '밤을 밝힌다' },
  lantern: { name: '등불', cat: 'place', struct: 'lantern', desc: '아주 밝고 튼튼한 철 등불' },
  bed: { name: '침대', cat: 'place', struct: 'bed', desc: '[E]를 누르면 쓰러졌을 때 여기서 일어난다' },
  table: { name: '탁자', cat: 'place', struct: 'table', desc: '집 꾸미기용 둥근 탁자' },
  chair: { name: '의자', cat: 'place', struct: 'chair', desc: '집 꾸미기용 의자' },
  spikes: { name: '가시 함정', cat: 'place', struct: 'spikes', desc: '밟은 적에게 계속 피해를 준다' },
};
for (const [t, tn, tier] of TIERS) {
  for (const [k, B] of Object.entries(TOOLS)) {
    const i = tier - 1;
    ITEMS[`${t}_${k}`] = {
      name: `${tn} ${B.name}`, cat: 'tool', kind: k, tier, dmg: B.dmg[i], tree: B.tree[i], rock: B.rock[i], swing: B.swing,
      desc: k === 'sword' ? `피해 ${B.dmg[i]} · 한 번에 여러 적` : k === 'axe' ? `벌목 ${B.tree[i]} · 피해 ${B.dmg[i]}` : `채굴 ${B.rock[i]} · ${['바위', '철광맥', '미스릴', '모든 광석'][i]}까지`,
    };
  }
}
export const ITEM_IDS = Object.keys(ITEMS);

export const NODES = {
  tree: { name: '나무', kind: 'tree', hp: 12, r: 0.45, drop: { wood: [4, 6] }, bonus: { apple: [0.25, 2] }, respawn: 150 },
  pine: { name: '소나무', kind: 'tree', hp: 15, r: 0.4, drop: { wood: [5, 7] }, respawn: 160 },
  palm: { name: '야자수', kind: 'tree', hp: 10, r: 0.35, drop: { wood: [3, 5] }, respawn: 150 },
  bush: { name: '사과 덤불', kind: 'tree', hp: 1, r: 0, drop: { apple: [1, 3] }, respawn: 90 },
  rock: { name: '바위', kind: 'rock', tier: 1, hp: 14, r: 1.0, drop: { stone: [4, 6] }, respawn: 200 },
  iron: { name: '철광맥', kind: 'rock', tier: 2, hp: 24, r: 1.0, drop: { iron_ore: [2, 4], stone: [1, 2] }, respawn: 260 },
  mithril: { name: '미스릴 광맥', kind: 'rock', tier: 3, hp: 36, r: 1.0, drop: { mithril_ore: [2, 4] }, respawn: 320 },
};
export const NODE_IDS = Object.keys(NODES);

// snap: 격자(floor/wall), floor: 발판 두께, box/r: 충돌체, light: 밝기
export const STRUCTS = {
  workbench: { name: '작업대', hp: 260, r: 0.95 },
  campfire: { name: '모닥불', hp: 160, r: 0.75, light: 3 },
  wood_floor: { name: '나무 바닥', hp: 160, snap: 'floor', floor: 0.2 },
  stone_floor: { name: '돌 바닥', hp: 420, snap: 'floor', floor: 0.22 },
  wood_wall: { name: '나무 벽', hp: 220, snap: 'wall', box: [1.5, 0.2] },
  stone_wall: { name: '돌 벽', hp: 550, snap: 'wall', box: [1.5, 0.26] },
  wood_window: { name: '나무 창문', hp: 180, snap: 'wall', box: [1.5, 0.2] },
  stone_window: { name: '돌 창문', hp: 450, snap: 'wall', box: [1.5, 0.26] },
  wood_door: { name: '나무 문', hp: 200, snap: 'wall', box: [1.5, 0.2], door: true },
  iron_door: { name: '철문', hp: 700, snap: 'wall', box: [1.5, 0.26], door: true },
  fence: { name: '울타리', hp: 120, snap: 'wall', box: [1.5, 0.1] },
  wood_roof: { name: '나무 지붕', hp: 160, snap: 'floor', roof: true },
  stone_roof: { name: '기와 지붕', hp: 400, snap: 'floor', roof: true },
  torch: { name: '횃불', hp: 60, r: 0.15, light: 1.8 },
  lantern: { name: '등불', hp: 220, r: 0.3, light: 3 },
  bed: { name: '침대', hp: 150, box: [0.7, 1.1], bed: true },
  table: { name: '탁자', hp: 120, r: 0.75 },
  chair: { name: '의자', hp: 80, r: 0.34 },
  spikes: { name: '가시 함정', hp: 300, trap: true },
};
export const STRUCT_IDS = Object.keys(STRUCTS);

// 작업대 단계. cost 는 그 단계로 올리는 데 드는 재료 (1단계는 작업대 제작 비용)
export const BENCH = [
  null,
  { name: '1단계 작업대', unlock: '나무 도구 · 나무 벽' },
  { name: '2단계 작업대', unlock: '돌 도구 · 돌 벽 · 침대 · 함정', cost: { wood: 25, stone: 20 } },
  { name: '3단계 작업대', unlock: '철 도구 · 철 갑옷', cost: { stone: 30, iron_ore: 12 } },
  { name: '4단계 작업대', unlock: '미스릴 도구 · 미스릴 갑옷', cost: { iron_ore: 15, mithril_ore: 12 } },
];
export const BENCH_MAX = 4;

// lv: 필요한 작업대 단계 (0 = 맨손), fire: 모닥불 근처에서만, sec: 제작창 묶음
export const SECTIONS = [['tool', '도구·무기'], ['build', '집 짓기'], ['life', '생활·방어'], ['food', '음식']];
export const RECIPES = [
  { id: 'workbench', lv: 0, sec: 'life', cost: { wood: 15 } },
  { id: 'campfire', lv: 0, sec: 'life', cost: { wood: 6, stone: 4 } },
  { id: 'wood_axe', lv: 1, sec: 'tool', cost: { wood: 8 } },
  { id: 'wood_pick', lv: 1, sec: 'tool', cost: { wood: 8 } },
  { id: 'wood_sword', lv: 1, sec: 'tool', cost: { wood: 10 } },
  { id: 'wood_floor', lv: 1, sec: 'build', cost: { wood: 4 } },
  { id: 'wood_wall', lv: 1, sec: 'build', cost: { wood: 6 } },
  { id: 'wood_window', lv: 1, sec: 'build', cost: { wood: 6 } },
  { id: 'wood_door', lv: 1, sec: 'build', cost: { wood: 8 } },
  { id: 'wood_roof', lv: 1, sec: 'build', cost: { wood: 5 } },
  { id: 'fence', lv: 1, sec: 'build', cost: { wood: 3 } },
  { id: 'torch', lv: 1, sec: 'life', n: 2, cost: { wood: 2, stone: 1 } },
  { id: 'chair', lv: 1, sec: 'life', cost: { wood: 5 } },
  { id: 'table', lv: 1, sec: 'life', cost: { wood: 8 } },
  { id: 'stone_axe', lv: 2, sec: 'tool', cost: { wood: 5, stone: 8 } },
  { id: 'stone_pick', lv: 2, sec: 'tool', cost: { wood: 5, stone: 8 } },
  { id: 'stone_sword', lv: 2, sec: 'tool', cost: { wood: 4, stone: 12 } },
  { id: 'stone_floor', lv: 2, sec: 'build', cost: { stone: 6 } },
  { id: 'stone_wall', lv: 2, sec: 'build', cost: { stone: 10 } },
  { id: 'stone_window', lv: 2, sec: 'build', cost: { stone: 9 } },
  { id: 'stone_roof', lv: 2, sec: 'build', cost: { stone: 8 } },
  { id: 'bed', lv: 2, sec: 'life', cost: { wood: 16 } },
  { id: 'spikes', lv: 2, sec: 'life', cost: { wood: 6, stone: 6 } },
  { id: 'iron_axe', lv: 3, sec: 'tool', cost: { wood: 4, iron_ore: 7 } },
  { id: 'iron_pick', lv: 3, sec: 'tool', cost: { wood: 4, iron_ore: 7 } },
  { id: 'iron_sword', lv: 3, sec: 'tool', cost: { wood: 3, iron_ore: 10 } },
  { id: 'iron_armor', lv: 3, sec: 'tool', cost: { iron_ore: 20 } },
  { id: 'iron_door', lv: 3, sec: 'build', cost: { iron_ore: 6, wood: 2 } },
  { id: 'lantern', lv: 3, sec: 'life', cost: { iron_ore: 2, wood: 2 } },
  { id: 'mithril_axe', lv: 4, sec: 'tool', cost: { iron_ore: 4, mithril_ore: 7 } },
  { id: 'mithril_pick', lv: 4, sec: 'tool', cost: { iron_ore: 4, mithril_ore: 7 } },
  { id: 'mithril_sword', lv: 4, sec: 'tool', cost: { iron_ore: 4, mithril_ore: 10 } },
  { id: 'mithril_armor', lv: 4, sec: 'tool', cost: { mithril_ore: 20 } },
  { id: 'cooked_meat', lv: 0, sec: 'food', fire: true, cost: { raw_meat: 1 } },
];

export const ENEMIES = {
  goblin: { name: '고블린', hp: 34, dmg: 9, speed: 4.4, range: 1.7, windup: 0.35, cd: 1.1, r: 0.45, height: 1.4, coins: [2, 4], aggro: 28 },
  wolf: { name: '늑대', hp: 26, dmg: 7, speed: 7.2, range: 1.6, windup: 0.25, cd: 0.9, r: 0.5, height: 1.0, coins: [2, 3], aggro: 32, drops: { raw_meat: [0.6, 1] } },
  archer: { name: '해골 궁수', hp: 28, dmg: 10, speed: 3.6, range: 26, keep: 13, windup: 0.5, cd: 2.4, r: 0.4, height: 1.75, coins: [3, 5], aggro: 34, ranged: true },
  golem: { name: '돌 골렘', hp: 130, dmg: 22, speed: 2.9, range: 2.3, windup: 0.6, cd: 1.8, r: 0.9, height: 2.4, coins: [6, 9], aggro: 26, wall: 3 },
  pig: { name: '멧돼지', hp: 22, speed: 4.8, r: 0.5, height: 0.9, passive: true, coins: [0, 0], drops: { raw_meat: [1, 2] } },
  king: { name: '고블린 왕', boss: true, hp: 1100, dmg: 28, speed: 4.0, range: 3.2, windup: 0.55, cd: 1.4, r: 1.4, height: 4.2, coins: [60, 80], aggro: 400, wall: 4 },
  titan: { name: '바위 거인', boss: true, hp: 1600, dmg: 34, speed: 3.0, range: 3.6, windup: 0.8, cd: 2.0, r: 1.9, height: 5.4, coins: [80, 100], aggro: 400, wall: 6 },
  alpha: { name: '그림자 늑대왕', boss: true, hp: 1250, dmg: 24, speed: 7.8, range: 3.0, windup: 0.35, cd: 1.0, r: 1.6, height: 3.1, coins: [70, 90], aggro: 400, wall: 3, drops: { raw_meat: [1, 8] } },
};
export const ENEMY_IDS = Object.keys(ENEMIES);
export const BOSS_ORDER = ['king', 'titan', 'alpha'];

export const RARITY = {
  common: { name: '일반', color: '#e9e4d8' },
  rare: { name: '희귀', color: '#4fb3ff' },
  legendary: { name: '전설', color: '#ffb52e' },
};
export const POWERUPS = {
  sneaker: { name: '가벼운 짚신', rarity: 'common', desc: '이동 속도 +8%' },
  heart: { name: '튼튼한 심장', rarity: 'common', desc: '최대 체력 +15' },
  whetstone: { name: '숫돌', rarity: 'common', desc: '근접 피해 +10%' },
  glove: { name: '나무꾼 장갑', rarity: 'common', desc: '채집 속도 +25%' },
  riceball: { name: '주먹밥', rarity: 'common', desc: '배고픔 감소 속도 -15%' },
  feather: { name: '깃털', rarity: 'common', desc: '점프력 +12%' },
  pouch: { name: '복주머니', rarity: 'common', desc: '코인 획득 +25%' },
  herb: { name: '약초', rarity: 'common', desc: '체력 재생 +0.6/초' },
  fang: { name: '흡혈 송곳니', rarity: 'rare', desc: '준 피해의 4%만큼 체력 회복' },
  hawk: { name: '매의 눈', rarity: 'rare', desc: '치명타 확률 +10% (피해 2배)' },
  turtle: { name: '거북 등껍질', rarity: 'rare', desc: '받는 피해 -8%' },
  ginseng: { name: '산삼', rarity: 'rare', desc: '기력 회복 +30%, 기력 소모 -15%' },
  cloud: { name: '구름 신발', rarity: 'rare', desc: '공중에서 한 번 더 점프' },
  thorns: { name: '가시 갑옷', rarity: 'rare', desc: '받은 피해의 30%를 되돌려준다' },
  drum: { name: '뇌신의 북', rarity: 'legendary', desc: '공격 시 20% 확률로 번개가 튄다' },
  berserk: { name: '광전사의 투구', rarity: 'legendary', desc: '체력 절반 이하일 때 피해 +40%' },
  phoenix: { name: '불사조 깃털', rarity: 'legendary', desc: '쓰러질 때 한 번 되살아난다 (소모)' },
  belt: { name: '천하장사 허리띠', rarity: 'legendary', desc: '모든 피해 +25%' },
};
export const POWER_IDS = Object.keys(POWERUPS);

export const CHEST = {
  normal: { base: 12, step: 3, weights: { common: 74, rare: 23, legendary: 3 } },
  gold: { base: 40, step: 6, weights: { common: 0, rare: 68, legendary: 32 } },
  boss: { weights: { common: 0, rare: 70, legendary: 30 } },
};

export const BOAT_PARTS = [
  { id: 'hull', name: '선체', cost: { wood: 60 } },
  { id: 'frame', name: '철 뼈대', cost: { iron_ore: 24 } },
  { id: 'mast', name: '미스릴 돛대', cost: { mithril_ore: 16 } },
];

export const MODES = {
  escape: { name: '탈출', desc: '재료를 모아 난파선을 고치고 섬을 탈출하라' },
  endless: { name: '무한 생존', desc: '끝없이 몰려오는 밤을 며칠이나 버틸까' },
};
export const DIFFICULTY = {
  easy: { name: '쉬움', hp: 0.7, dmg: 0.6, count: 0.7 },
  normal: { name: '보통', hp: 1, dmg: 1, count: 1 },
  hard: { name: '어려움', hp: 1.35, dmg: 1.35, count: 1.4 },
};

export function cleanName(s) {
  return String(s || '').replace(/[ -<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
}

// 가진 아이템 중 손에 들 수 있는 것 (같은 종류 도구는 가장 좋은 것만)
export function hotbarList(inv) {
  const out = [];
  for (const kind of ['sword', 'axe', 'pick']) {
    let best = null;
    for (const [id, I] of Object.entries(ITEMS)) if (I.kind === kind && inv[id] > 0 && (!best || I.tier > ITEMS[best].tier)) best = id;
    if (best) out.push(best);
  }
  for (const id of ['cooked_meat', 'apple', 'raw_meat', 'workbench', 'campfire', 'wood_floor', 'wood_wall', 'wood_window', 'wood_door', 'wood_roof',
    'stone_floor', 'stone_wall', 'stone_window', 'stone_roof', 'iron_door', 'fence', 'torch', 'lantern', 'bed', 'table', 'chair', 'spikes']) if (inv[id] > 0) out.push(id);
  return out;
}

export const bestArmor = (inv) => (inv.mithril_armor > 0 ? 0.45 : inv.iron_armor > 0 ? 0.25 : 0);
