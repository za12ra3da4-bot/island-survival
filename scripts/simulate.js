// 서버 로직 헤드리스 시뮬레이션 — node scripts/simulate.js [초] [인원] [난이도]
import { Room } from '../server/room.js';
import { CYCLE, NODES } from '../public/shared/config.js';

const seconds = Number(process.argv[2]) || 900;
const count = Number(process.argv[3]) || 3;
const difficulty = process.argv[4] || 'normal';

let fakeNow = Date.now();
Date.now = () => fakeNow;
const si = globalThis.setInterval;
globalThis.setInterval = () => 0;

const events = {};
const io = { to: () => ({ emit: (ev) => { events[ev] = (events[ev] || 0) + 1; }, get volatile() { return this; } }) };
const room = new Room(io, 'SIM', { mode: 'escape', difficulty, isPublic: false });
const sockets = [];
for (let i = 0; i < count; i++) {
  const s = { id: `s${i}`, join() {}, leave() {}, emit: (ev) => { events[`→${ev}`] = (events[`→${ev}`] || 0) + 1; } };
  sockets.push(s);
  room.add(s, `봇${i}`, '#ffc93c');
}
room.start('s0');
globalThis.setInterval = si;
const g = room.game;

const kinds = {};
for (const n of g.nodes) kinds[n.type] = (kinds[n.type] || 0) + 1;
console.log('노드', kinds, '상자', g.chests.length, '배', g.boat.x.toFixed(0), g.boat.z.toFixed(0), '출현 높이', g.spawn.y.toFixed(1));

// 플레이어는 캠프 주변에 서서 칼로 주변 적을 친다
const ps = [...g.players.values()];
for (const p of ps) { p.inv.stone_sword = 1; p.item = 'stone_sword'; p.inv.cooked_meat = 30; }
let tickMax = 0, total = 0, ticks = 0, maxEnemies = 0, bossSeen = 0;
for (let i = 0; i < seconds * 20; i++) {
  fakeNow += 50;
  const t0 = performance.now();
  g.tick();
  const d = performance.now() - t0;
  tickMax = Math.max(tickMax, d); total += d; ticks++;
  maxEnemies = Math.max(maxEnemies, g.enemies.size);
  for (const e of g.enemies.values()) if (e.boss) bossSeen = 1;
  if (i % 10 === 0) {
    for (const p of ps) {
      if (!p.alive) continue;
      const ids = [...g.enemies.values()].filter((e) => Math.hypot(e.x - p.x, e.z - p.z) < 4).map((e) => e.id);
      if (ids.length) g.onMessage(p.nid, 'attack', { ids });
      if (p.hunger < 50) g.onMessage(p.nid, 'eat', { item: 'cooked_meat' });
      // 가까운 나무 베기
      const n = g.nodes.find((q) => q.alive && NODES[q.type].kind === 'tree' && Math.hypot(q.x - p.x, q.z - p.z) < 25);
      if (n && i % 40 === 0) { p.x = n.x + 1; p.z = n.z; p.y = g.terrain.h(p.x, p.z); g.onMessage(p.nid, 'gather', { i: n.i }); }
    }
  }
  if (g.over) break;
}
const bad = [...g.enemies.values()].filter((e) => ![e.x, e.y, e.z, e.hp].every(Number.isFinite)).length;
console.log(`시뮬 ${(ticks / 20).toFixed(0)}초 · ${g.day}일차 · 시계 ${g.clock.toFixed(0)}/${CYCLE.day + CYCLE.night} · 종료 ${g.over}`);
console.log(`tick 평균 ${(total / ticks).toFixed(3)}ms 최대 ${tickMax.toFixed(1)}ms · 최대 적 ${maxEnemies} · 보스 등장 ${bossSeen} · NaN 적 ${bad}`);
console.log('플레이어', ps.map((p) => `${p.name} hp${Math.round(p.hp)} 생존${p.alive} 처치${p.stats.kills} 코인${p.coins} 나무${p.inv.wood || 0}`).join(' | '));
console.log('이벤트', events);
