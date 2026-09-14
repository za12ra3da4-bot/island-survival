// 한 판의 게임 — 섬 생성, 낮/밤, 적 AI, 전투, 채집·제작·건설, 상자·파워업, 배 수리
import {
  TICK_RATE, CYCLE, FINAL_TIME, PLAYER, ITEMS, ITEM_IDS, NODES, NODE_IDS, STRUCTS, STRUCT_IDS, RECIPES, BENCH, BENCH_MAX,
  ENEMIES, ENEMY_IDS, BOSS_ORDER, POWERUPS, CHEST, BOAT_PARTS, DIFFICULTY, bestArmor,
} from '../public/shared/config.js';
import { Terrain, fbm } from '../public/shared/terrain.js';
import { Colliders, moveBody } from '../public/shared/physics.js';
import { snapPos, baseY, structCollider, canPlace } from '../public/shared/build.js';

const r2 = (v) => Math.round(v * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const vec3 = (a) => (Array.isArray(a) && a.length === 3 && a.every((v) => Number.isFinite(+v)) ? a.map(Number) : null);
const CYCLE_LEN = CYCLE.day + CYCLE.night;

export class Game {
  constructor(room) {
    this.room = room;
    this.opts = room.opts;
    this.D = DIFFICULTY[room.opts.difficulty] || DIFFICULTY.normal;
    this.seed = (Math.random() * 2 ** 31) | 0;
    this.terrain = new Terrain(this.seed);
    this.cols = new Colliders();
    this.players = new Map();
    this.nodes = [];
    this.chests = [];
    this.structs = new Map();
    this.enemies = new Map();
    this.projectiles = [];
    this.drops = new Map();
    this.campfires = [];
    this.seq = { struct: 0, enemy: 0, proj: 0, drop: 0 };
    this.time = 0;
    this.clock = 8;
    this.day = 1;
    this.night = false;
    this.nightSpawned = 0;
    this.spawnT = 3;
    this.bossAt = 0;
    this.chestsOpened = 0;
    this.final = null;
    this.over = false;
    this.nodeT = 0;
    this.meT = 0;
    this.generate();
    this.last = Date.now();
    this.timer = setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        console.error(`[${room.code}] tick 오류:`, err);
      }
    }, 1000 / TICK_RATE);
  }

  destroy() {
    clearInterval(this.timer);
  }

  emit(ev, data) {
    this.room.io.to(this.room.code).emit(ev, data);
  }

  emitTo(p, ev, data) {
    if (p.socket) p.socket.emit(ev, data);
  }

  // ── 섬 생성 ─────────────────────────────────────
  generate() {
    const T = this.terrain;
    const land = [];
    for (let i = 0; i < 5000; i++) {
      const h = T.h(rand(-172, 172), rand(-172, 172));
      if (h > 1) land.push(h);
    }
    land.sort((a, b) => a - b);
    const pct = (q) => land[Math.floor(q * (land.length - 1))] || 8;
    const hPine = pct(0.5), hIron = pct(0.5), hMith = pct(0.84);

    this.spawn = { x: 0, z: 0, y: T.h(0, 0) };

    // 난파선: 해안가 얕은 물
    let bx = 0, bz = 0, ang = 0;
    for (let tries = 0; tries < 40; tries++) {
      ang = Math.random() * Math.PI * 2;
      let found = false;
      for (let d = 40; d < 172; d += 0.5) {
        const x = Math.cos(ang) * d, z = Math.sin(ang) * d;
        if (T.h(x, z) < -0.7) { bx = Math.cos(ang) * (d + 2); bz = Math.sin(ang) * (d + 2); found = true; break; }
      }
      if (found) break;
    }
    const rot = Math.PI / 2 - ang;
    this.boat = { x: bx, z: bz, y: 0, rot, parts: Object.fromEntries(BOAT_PARTS.map((p) => [p.id, {}])), ready: false };
    this.cols.add({ x: bx, z: bz, hx: 1.6, hz: 4.6, cos: Math.cos(rot), sin: -Math.sin(rot), boat: true });

    const taken = new Colliders(8);
    const nodes = [];
    // group 이 같은 것끼리는 spacing 만큼, 다른 것과는 조금만 띄운다
    const place = (count, maxR, test, spacing, make, group = 'node') => {
      let placed = 0;
      for (let a = 0; a < count * 40 && placed < count; a++) {
        const an = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * maxR;
        const x = Math.cos(an) * d, z = Math.sin(an) * d;
        const h = T.h(x, z);
        if (h < 0.35 || Math.hypot(x, z) < 15 || Math.hypot(x - bx, z - bz) < 13) continue;
        if (!test(h, T.slope(x, z), x, z)) continue;
        let clash = false;
        taken.query(x, z, Math.max(spacing, 3), (c) => {
          if (clash) return;
          const need = c.group === group ? Math.max(spacing, c.sp) : Math.max(c.pad, group === 'chest' ? 2.2 : spacing * 0.5);
          if (Math.hypot(c.x - x, c.z - z) < need) clash = true;
        });
        if (clash) continue;
        taken.add({ x, z, r: Math.max(spacing, 3) / 2, sp: spacing, group, pad: group === 'chest' ? 2.2 : spacing * 0.5 });
        make(x, z, h);
        placed++;
      }
      return placed;
    };
    const node = (type, sLo, sHi) => (x, z, h) => nodes.push({ type, x, z, y: h, s: rand(sLo, sHi), rot: Math.random() * Math.PI * 2 });

    // 상자
    const chests = [];
    const chest = (kind) => (x, z, h) => chests.push({ kind, x, z, y: h, rot: Math.random() * Math.PI * 2 });
    place(8, 165, (h, s) => h > hPine - 2 && s < 0.7, 26, chest('gold'), 'gold');
    place(42, 168, (h, s) => h > 1.2 && s < 0.7, 12, chest('normal'), 'chest');
    // 광석 (높은 곳이 모자라면 기준을 낮춰 한 번 더)
    const mith = place(46, 170, (h, s) => h > hMith && s < 1.6, 6, node('mithril', 0.9, 1.3), 'mithril');
    if (mith < 30) place(46 - mith, 170, (h, s) => h > pct(0.68) && s < 1.6, 6, node('mithril', 0.9, 1.3), 'mithril');
    place(95, 170, (h, s) => h > hIron && s < 1.6, 5, node('iron', 0.85, 1.25), 'iron');
    place(300, 170, (h, s) => h > 1 && s < 1.5, 3.6, node('rock', 0.7, 1.6));
    // 나무
    const forest = (x, z) => fbm(x * 0.018 + 3, z * 0.018 - 7, this.seed + 99, 3);
    place(560, 168, (h, s, x, z) => h > 2 && h < hPine + 6 && s < 1.0 && Math.random() < (forest(x, z) - 0.32) * 3, 2.7, node('tree', 0.85, 1.35));
    place(270, 170, (h, s) => h > hPine - 3 && s < 1.3, 2.7, node('pine', 0.85, 1.4));
    place(70, 170, (h) => h > 0.4 && h < 2.6, 4.5, node('palm', 0.9, 1.25));
    place(130, 165, (h, s) => h > 2 && h < hPine && s < 0.9, 2.2, node('bush', 0.8, 1.2));

    this.nodes = nodes.map((n, i) => {
      const N = NODES[n.type];
      const out = { ...n, i, hp: N.hp, alive: true, respawnAt: 0, col: null };
      if (N.r > 0) out.col = this.cols.add({ x: n.x, z: n.z, r: N.r * n.s, node: out });
      return out;
    });
    this.chests = chests.map((c, i) => ({ ...c, i, opened: false, col: this.cols.add({ x: c.x, z: c.z, r: 0.75, chest: true }) }));
  }

  startPayload(p) {
    return {
      seed: this.seed, mode: this.opts.mode, difficulty: this.opts.difficulty, you: p.nid,
      nodes: this.nodes.map((n) => [NODE_IDS.indexOf(n.type), r2(n.x), r2(n.z), r2(n.s), r2(n.rot), n.alive ? 1 : 0]),
      chests: this.chests.map((c) => [c.kind === 'gold' ? 1 : 0, r2(c.x), r2(c.z), r2(c.rot), c.opened ? 1 : 0]),
      structs: [...this.structs.values()].map((s) => this.structPayload(s)),
      boat: this.boatPayload(), spawn: this.spawn, day: this.day, clock: this.clock, night: this.night,
      chestsOpened: this.chestsOpened, final: this.final ? Math.ceil(this.final.endAt - this.time) : -1,
      roster: this.roster(), inv: p.inv, powers: p.powers, coins: p.coins, hp: p.hp, maxHp: p.maxHp, hunger: p.hunger,
      x: p.x, y: p.y, z: p.z, alive: p.alive,
    };
  }

  structPayload(s) {
    return [s.id, STRUCT_IDS.indexOf(s.type), r2(s.x), r2(s.z), r2(s.rot), Math.round((s.hp / s.maxHp) * 100), s.lv || 0, s.open ? 1 : 0];
  }

  boatPayload() {
    return { x: r2(this.boat.x), z: r2(this.boat.z), rot: r2(this.boat.rot), parts: this.boat.parts, ready: this.boatReady() };
  }

  roster() {
    return [...this.players.values()].map((p) => ({ nid: p.nid, name: p.name, color: p.color, alive: p.alive }));
  }

  // ── 플레이어 ────────────────────────────────────
  addPlayer(m) {
    const a = Math.random() * Math.PI * 2, d = rand(1, 4);
    const x = this.spawn.x + Math.cos(a) * d, z = this.spawn.z + Math.sin(a) * d;
    const p = {
      nid: m.nid, sid: m.sid, socket: m.socket, name: m.name, color: m.color,
      x, z, y: this.terrain.h(x, z), yaw: 0, pitch: 0, flags: 0, item: 'fist', evx: 0, evz: 0, lastInputT: 0,
      hp: PLAYER.maxHp, maxHp: PLAYER.maxHp, hunger: PLAYER.maxHunger, alive: true,
      inv: {}, powers: {}, coins: 0,
      lastHurt: -99, lastAttack: -99, lastShot: -99, lastEat: -99,
      stats: { kills: 0, dmg: 0, gathered: 0, chests: 0 },
    };
    this.players.set(p.nid, p);
    this.emitTo(p, 'start', this.startPayload(p));
    this.emit('roster', this.roster());
    return p;
  }

  // 잠깐 끊겼다 다시 들어온 사람 — 캐릭터는 그대로, 화면만 다시 보낸다
  reconnect(m) {
    const p = this.players.get(m.nid);
    if (!p) return this.addPlayer(m);
    p.sid = m.sid;
    p.socket = m.socket;
    this.emitTo(p, 'start', this.startPayload(p));
    this.emit('roster', this.roster());
    return p;
  }

  removePlayer(nid) {
    if (!this.players.delete(nid)) return;
    this.emit('roster', this.roster());
    this.checkAllDead();
  }

  sendInv(p) {
    for (const k of Object.keys(p.inv)) if (!(p.inv[k] > 0)) delete p.inv[k];
    this.emitTo(p, 'inv', { inv: p.inv, powers: p.powers, coins: p.coins });
  }

  heldTool(p) {
    const id = p.item;
    if (id !== 'fist' && p.inv[id] > 0 && ITEMS[id].cat === 'tool') return ITEMS[id];
    return ITEMS.fist;
  }

  hurtPlayer(p, amount, attacker, src, raw = false) {
    if (!p.alive || this.over) return;
    let dmg = amount;
    if (!raw) dmg *= (1 - bestArmor(p.inv)) * Math.pow(0.92, p.powers.turtle || 0);
    p.hp -= dmg;
    p.lastHurt = this.time;
    if (attacker && p.powers.thorns && this.enemies.has(attacker.id)) this.hitEnemy(attacker, dmg * 0.3 * p.powers.thorns, p, {});
    if (!raw) this.emitTo(p, 'hurt', { a: Math.round(dmg), s: src ? [r1(src.x), r1(src.z)] : null });
    if (p.hp > 0) return;
    if (p.powers.phoenix > 0) {
      if (--p.powers.phoenix <= 0) delete p.powers.phoenix;
      p.hp = p.maxHp * 0.6;
      this.emit('phoenix', { n: p.nid });
      this.sendInv(p);
      return;
    }
    p.alive = false;
    p.hp = 0;
    this.emit('pdie', { n: p.nid });
    this.emit('roster', this.roster());
    this.checkAllDead();
  }

  checkAllDead() {
    if (this.over || !this.players.size) return;
    for (const p of this.players.values()) if (p.alive) return;
    this.gameOver(false);
  }

  updatePlayers(dt) {
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const P = p.powers;
      p.maxHp = PLAYER.maxHp + 15 * (P.heart || 0);
      p.hunger -= PLAYER.hungerRate * dt * Math.pow(0.85, P.riceball || 0);
      if (p.hunger <= 0) {
        p.hunger = 0;
        this.hurtPlayer(p, PLAYER.starve * dt, null, null, true);
        continue;
      }
      if (p.hunger > 30 && this.time - p.lastHurt > PLAYER.regenDelay) {
        let rate = PLAYER.regen + 0.6 * (P.herb || 0);
        for (const c of this.campfires) if (Math.hypot(c.x - p.x, c.z - p.z) < 7) { rate *= 2.5; break; }
        p.hp = Math.min(p.maxHp, p.hp + rate * dt);
      }
    }
  }

  dawn() {
    for (const p of this.players.values()) {
      if (p.alive) continue;
      p.alive = true;
      p.hp = p.maxHp * 0.6;
      p.hunger = Math.max(p.hunger, 60);
      const bed = p.bed && this.structs.get(p.bed);
      p.x = (bed ? bed.x : this.spawn.x) + rand(-2, 2);
      p.z = (bed ? bed.z : this.spawn.z) + rand(-2, 2);
      p.y = bed ? bed.y + 0.4 : this.terrain.h(p.x, p.z);
      this.emitTo(p, 'respawn', { x: r2(p.x), y: r2(p.y), z: r2(p.z) });
    }
    this.emit('roster', this.roster());
  }

  // ── 메시지 처리 ─────────────────────────────────
  onMessage(nid, ev, m) {
    const p = this.players.get(nid);
    if (!p || this.over) return;
    switch (ev) {
      case 'input': return this.onInput(p, m);
      case 'attack': return this.onAttack(p, m);
      case 'gather': return this.onGather(p, m);
      case 'craft': return this.onCraft(p, m);
      case 'place': return this.onPlace(p, m);
      case 'eat': return this.onEat(p, m);
      case 'chest': return this.onChest(p, m);
      case 'boat': return this.onBoat(p);
      case 'launch': return this.onLaunch(p);
      case 'upgrade': return this.onUpgrade(p, m);
      case 'door': return this.onDoor(p, m);
      case 'bed': return this.onBed(p, m);
    }
  }

  err(p, msg) {
    this.emitTo(p, 'err', { msg });
  }

  onInput(p, m) {
    if (!p.alive || !m) return;
    const x = +m.x, y = +m.y, z = +m.z;
    if (![x, y, z].every(Number.isFinite)) return;
    const dt = this.time - p.lastInputT;
    if (dt > 0.02) {
      p.evx = p.evx * 0.5 + ((x - p.x) / dt) * 0.5;
      p.evz = p.evz * 0.5 + ((z - p.z) / dt) * 0.5;
    }
    p.lastInputT = this.time;
    p.x = Math.max(-178, Math.min(178, x));
    p.y = Math.max(-5, Math.min(90, y));
    p.z = Math.max(-178, Math.min(178, z));
    if (Number.isFinite(+m.yaw)) p.yaw = +m.yaw;
    if (Number.isFinite(+m.pitch)) p.pitch = Math.max(-1.6, Math.min(1.6, +m.pitch));
    p.flags = (m.f | 0) & 127;
    if (typeof m.it === 'string' && ITEMS[m.it] && (m.it === 'fist' || p.inv[m.it] > 0)) p.item = m.it;
  }

  onAttack(p, m) {
    if (!p.alive || !m || !Array.isArray(m.ids)) return;
    const it = this.heldTool(p);
    if (this.time - p.lastAttack < it.swing * 0.7) return;
    p.lastAttack = this.time;
    const maxT = it.kind === 'sword' ? 3 : 1;
    const done = new Set();
    for (const raw of m.ids.slice(0, maxT)) {
      const e = this.enemies.get(raw | 0);
      if (!e || done.has(e)) continue;
      done.add(e);
      const E = ENEMIES[e.type];
      if (Math.hypot(e.x - p.x, e.z - p.z) > PLAYER.reach + e.radius + 2.2) continue;
      if (e.y > p.y + 3.5 || e.y + E.height < p.y - 2) continue;
      this.playerHit(p, e, it.dmg, true);
    }
  }

  playerHit(p, e, base, melee) {
    const P = p.powers;
    let dmg = base * (melee ? 1 + 0.1 * (P.whetstone || 0) : 1) * (1 + 0.25 * (P.belt || 0));
    if (P.berserk && p.hp < p.maxHp * 0.5) dmg *= 1 + 0.4 * P.berserk;
    const crit = Math.random() < Math.min(0.8, 0.1 * (P.hawk || 0));
    if (crit) dmg *= 2;
    if (melee && !ENEMIES[e.type].boss) {
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
      e.vx += (dx / d) * 7;
      e.vz += (dz / d) * 7;
    }
    this.hitEnemy(e, dmg, p, { crit });
    if (P.drum && Math.random() < Math.min(0.9, 0.2 * P.drum)) this.chainLightning(p, e);
  }

  hitEnemy(e, dmg, p, o = {}) {
    if (!this.enemies.has(e.id)) return;
    e.hp -= dmg;
    e.provoked = true;
    if (p) {
      p.stats.dmg += dmg;
      if (p.powers.fang && p.alive) p.hp = Math.min(p.maxHp, p.hp + dmg * 0.04 * p.powers.fang);
      if (ENEMIES[e.type].passive) { e.fleeUntil = this.time + 6; e.fleeX = p.x; e.fleeZ = p.z; }
    }
    this.emit('ehit', { id: e.id, a: Math.round(dmg), c: o.crit ? 1 : 0, z: o.zap ? 1 : 0, by: p ? p.nid : 0 });
    if (e.hp <= 0) this.killEnemy(e, p);
  }

  chainLightning(p, e) {
    const near = [...this.enemies.values()]
      .filter((o) => o !== e && Math.hypot(o.x - e.x, o.z - e.z) < 10)
      .sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z))
      .slice(0, 3);
    const dmg = 22 * (1 + 0.15 * (this.day - 1)) * Math.sqrt(p.powers.drum);
    this.emit('zap', { from: [r2(e.x), r2(e.y + ENEMIES[e.type].height * 0.6), r2(e.z)], to: near.map((o) => [r2(o.x), r2(o.y + ENEMIES[o.type].height * 0.6), r2(o.z)]) });
    for (const o of near) this.hitEnemy(o, dmg, p, { zap: true });
  }

  killEnemy(e, p) {
    if (!this.enemies.delete(e.id)) return;
    const E = ENEMIES[e.type];
    if (p) p.stats.kills++;
    this.emit('edie', { id: e.id, t: ENEMY_IDS.indexOf(e.type), x: r2(e.x), y: r2(e.y), z: r2(e.z) });
    let left = irand(E.coins[0], E.coins[1]);
    while (left > 0) {
      const v = Math.min(left, E.boss ? 10 : irand(1, 2));
      this.spawnDrop('coin', v, e.x, e.y + 1, e.z);
      left -= v;
    }
    for (const [item, [chance, max]] of Object.entries(E.drops || {})) {
      if (Math.random() < chance) this.spawnDrop(item, irand(1, max), e.x, e.y + 1, e.z);
    }
    if (E.boss) {
      this.emit('bossdie', { id: e.id, t: ENEMY_IDS.indexOf(e.type) });
      for (const q of this.players.values()) if (q.alive) this.grantPower(q, this.rollPower('boss'));
    }
  }

  onGather(p, m) {
    const n = this.nodes[m ? m.i | 0 : -1];
    if (!p.alive || !n || !n.alive) return;
    const N = NODES[n.type];
    if (Math.hypot(n.x - p.x, n.z - p.z) > PLAYER.reach + N.r * n.s + 2.4) return;
    const it = this.heldTool(p);
    if (this.time - p.lastAttack < it.swing * 0.7) return;
    p.lastAttack = this.time;
    let power = N.kind === 'tree' ? it.tree : it.tier >= N.tier ? it.rock : 0;
    if (power <= 0) {
      this.emitTo(p, 'weak', { i: n.i, need: N.tier || 1, kind: N.kind });
      return;
    }
    power *= 1 + 0.25 * (p.powers.glove || 0);
    n.hp -= power;
    if (n.hp > 0) {
      this.emit('nhit', { i: n.i, by: p.nid });
      return;
    }
    n.alive = false;
    n.respawnAt = this.time + N.respawn * rand(0.9, 1.25);
    if (n.col) this.cols.remove(n.col);
    const gained = {};
    for (const [item, [lo, hi]] of Object.entries(N.drop)) gained[item] = (gained[item] || 0) + irand(lo, hi);
    for (const [item, [chance, max]] of Object.entries(N.bonus || {})) if (Math.random() < chance) gained[item] = (gained[item] || 0) + irand(1, max);
    for (const [k, v] of Object.entries(gained)) {
      p.inv[k] = (p.inv[k] || 0) + v;
      p.stats.gathered += v;
    }
    const dx = n.x - p.x, dz = n.z - p.z;
    this.emit('nbreak', { i: n.i, by: p.nid, dir: r2(Math.atan2(dx, dz)) });
    this.emitTo(p, 'gain', { items: gained });
    this.sendInv(p);
  }

  updateNodes() {
    for (const n of this.nodes) {
      if (n.alive || this.time < n.respawnAt) continue;
      let blocked = false;
      for (const p of this.players.values()) if (Math.hypot(p.x - n.x, p.z - n.z) < 3) blocked = true;
      if (blocked) continue;
      n.alive = true;
      n.hp = NODES[n.type].hp;
      if (n.col) this.cols.add(n.col);
      this.emit('nspawn', { i: n.i });
    }
  }

  benchLevel(p) {
    let lv = 0;
    for (const s of this.structs.values()) if (s.type === 'workbench' && Math.hypot(s.x - p.x, s.z - p.z) <= 7) lv = Math.max(lv, s.lv);
    return lv;
  }

  nearFire(p) {
    return this.campfires.some((c) => Math.hypot(c.x - p.x, c.z - p.z) <= 7);
  }

  onUpgrade(p, m) {
    const s = this.structs.get(m ? m.id | 0 : -1);
    if (!p.alive || !s || s.type !== 'workbench' || Math.hypot(s.x - p.x, s.z - p.z) > 7) return;
    if (s.lv >= BENCH_MAX) return this.err(p, '이미 최고 단계입니다.');
    const cost = BENCH[s.lv + 1].cost;
    if (!Object.entries(cost).every(([k, v]) => (p.inv[k] || 0) >= v)) return this.err(p, '재료가 부족합니다.');
    for (const [k, v] of Object.entries(cost)) p.inv[k] -= v;
    s.lv++;
    s.maxHp = STRUCTS.workbench.hp + 140 * (s.lv - 1);
    s.hp = s.maxHp;
    this.sendInv(p);
    this.emit('supg', { id: s.id, lv: s.lv, by: p.nid });
  }

  onDoor(p, m) {
    const s = this.structs.get(m ? m.id | 0 : -1);
    if (!p.alive || !s || !STRUCTS[s.type].door || Math.hypot(s.x - p.x, s.z - p.z) > 5) return;
    s.open = !s.open;
    if (s.open) this.cols.remove(s.col);
    else this.cols.add(s.col);
    this.emit('sdoor', { id: s.id, open: s.open ? 1 : 0 });
  }

  onBed(p, m) {
    const s = this.structs.get(m ? m.id | 0 : -1);
    if (!p.alive || !s || s.type !== 'bed' || Math.hypot(s.x - p.x, s.z - p.z) > 5) return;
    p.bed = s.id;
    this.emitTo(p, 'bedset', { id: s.id });
  }

  onCraft(p, m) {
    const R = RECIPES.find((r) => m && r.id === m.r);
    if (!R || !p.alive) return;
    if (R.lv && this.benchLevel(p) < R.lv) return this.err(p, `${R.lv}단계 작업대 가까이에서만 만들 수 있습니다.`);
    if (R.fire && !this.nearFire(p)) return this.err(p, '모닥불 가까이에서만 구울 수 있습니다.');
    const times = Math.max(1, Math.min(20, m.n | 0 || 1));
    let made = 0;
    for (; made < times; made++) {
      if (!Object.entries(R.cost).every(([k, v]) => (p.inv[k] || 0) >= v)) break;
      for (const [k, v] of Object.entries(R.cost)) p.inv[k] -= v;
      p.inv[R.id] = (p.inv[R.id] || 0) + (R.n || 1);
    }
    if (!made) return this.err(p, '재료가 부족합니다.');
    this.emitTo(p, 'crafted', { r: R.id, n: made });
    this.sendInv(p);
  }

  onPlace(p, m) {
    const item = m && m.item, I = ITEMS[item];
    if (!p.alive || !I || I.cat !== 'place' || !(p.inv[item] > 0)) return;
    const type = I.struct, S = STRUCTS[type];
    let x = +m.x, z = +m.z, rot = Number.isFinite(+m.rot) ? +m.rot : 0;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    if (S.snap) {
      rot = Math.round(rot / (Math.PI / 2)) * (Math.PI / 2);
      ({ x, z } = snapPos(type, x, z, rot));
    }
    if (Math.hypot(x - p.x, z - p.z) > 11) return this.err(p, '너무 멉니다.');
    const bad = canPlace(type, x, z, rot, this.terrain, this.cols, this.structs.values());
    if (bad) return this.err(p, bad);
    const y = baseY(type, x, z, rot, this.terrain, this.cols);
    const s = { id: ++this.seq.struct, type, x, z, y, rot, hp: S.hp, maxHp: S.hp, by: p.nid, lv: type === 'workbench' ? 1 : 0, open: false };
    s.col = structCollider(type, x, z, rot, y);
    if (s.col) {
      s.col.struct = s;
      this.cols.add(s.col);
    }
    this.structs.set(s.id, s);
    if (type === 'campfire') this.campfires.push(s);
    p.inv[item]--;
    this.sendInv(p);
    this.emit('sadd', { s: this.structPayload(s), by: p.nid });
  }

  damageStruct(s, dmg) {
    if (!this.structs.has(s.id)) return;
    s.hp -= dmg;
    if (s.hp > 0) {
      this.emit('shit', { id: s.id, hp: Math.round((s.hp / s.maxHp) * 100) });
      return;
    }
    this.cols.remove(s.col);
    this.structs.delete(s.id);
    this.campfires = this.campfires.filter((c) => c !== s);
    this.emit('sdel', { id: s.id });
  }

  onEat(p, m) {
    const id = m && m.item, I = ITEMS[id];
    if (!p.alive || !I || !I.food || !(p.inv[id] > 0) || this.time - p.lastEat < 0.45) return;
    p.lastEat = this.time;
    p.inv[id]--;
    p.hunger = Math.min(PLAYER.maxHunger, p.hunger + I.food.hunger);
    p.hp = Math.min(p.maxHp, p.hp + I.food.hp);
    this.sendInv(p);
    this.emit('eat', { n: p.nid });
  }

  // 상자 값 — 열린 상자가 늘수록 비싸진다
  chestPrice(c) {
    const C = CHEST[c.kind === 'gold' ? 'gold' : 'normal'];
    return C.base + C.step * this.chestsOpened;
  }

  onChest(p, m) {
    const c = this.chests[m ? m.i | 0 : -1];
    if (!p.alive || !c || c.opened || Math.hypot(c.x - p.x, c.z - p.z) > 4.8) return;
    const price = this.chestPrice(c);
    if (p.coins < price) return this.err(p, `코인이 부족합니다. (${price} 필요)`);
    p.coins -= price;
    c.opened = true;
    this.chestsOpened++;
    p.stats.chests++;
    const pw = this.rollPower(c.kind);
    this.emit('copen', { i: c.i, by: p.nid, pw, opened: this.chestsOpened });
    this.grantPower(p, pw);
  }

  rollPower(kind) {
    const W = CHEST[kind].weights;
    let r = Math.random() * (W.common + W.rare + W.legendary), rarity = 'legendary';
    for (const k of ['common', 'rare', 'legendary']) {
      if ((r -= W[k]) < 0) { rarity = k; break; }
    }
    const pool = Object.keys(POWERUPS).filter((id) => POWERUPS[id].rarity === rarity);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  grantPower(p, id) {
    p.powers[id] = (p.powers[id] || 0) + 1;
    if (id === 'heart') { p.maxHp += 15; p.hp += 15; }
    this.emitTo(p, 'power', { id });
    this.sendInv(p);
  }

  boatReady() {
    return BOAT_PARTS.every((part) => Object.entries(part.cost).every(([k, v]) => (this.boat.parts[part.id][k] || 0) >= v));
  }

  onBoat(p) {
    if (this.opts.mode !== 'escape' || !p.alive || Math.hypot(this.boat.x - p.x, this.boat.z - p.z) > 11) return;
    let moved = false;
    for (const part of BOAT_PARTS) {
      const prog = this.boat.parts[part.id];
      for (const [k, v] of Object.entries(part.cost)) {
        const take = Math.min(v - (prog[k] || 0), p.inv[k] || 0);
        if (take <= 0) continue;
        p.inv[k] -= take;
        prog[k] = (prog[k] || 0) + take;
        moved = true;
      }
    }
    if (!moved) return this.err(p, '넣을 재료가 없습니다.');
    this.sendInv(p);
    this.emit('boat', { ...this.boatPayload(), by: p.nid });
    if (this.boatReady() && !this.boat.ready) {
      this.boat.ready = true;
      this.emit('boatready', {});
    }
  }

  onLaunch(p) {
    if (!this.boatReady() || this.final || !p.alive || Math.hypot(this.boat.x - p.x, this.boat.z - p.z) > 11) return;
    this.final = { endAt: this.time + FINAL_TIME };
    this.emit('final', { t: FINAL_TIME, by: p.nid });
    this.spawnBoss(true);
  }

  // ── 적 ──────────────────────────────────────────
  aliveList() {
    return [...this.players.values()].filter((p) => p.alive);
  }

  pickType(day) {
    const w = [['goblin', 5], ['wolf', 3], ['archer', day >= 2 ? 2.5 : 0], ['golem', day >= 3 ? 1.2 + day * 0.1 : 0]];
    let r = Math.random() * w.reduce((s, x) => s + x[1], 0);
    for (const [t, v] of w) if ((r -= v) < 0) return t;
    return 'goblin';
  }

  spawnEnemy(type, x, z, boost = 0) {
    const E = ENEMIES[type], pc = Math.max(1, this.players.size);
    const day = this.day + boost;
    const hpScale = (1 + (day - 1) * 0.22) * (E.boss ? 0.55 + 0.45 * pc : 0.8 + 0.2 * pc) * this.D.hp;
    const e = {
      id: ++this.seq.enemy, type, x, z, y: this.terrain.h(x, z), vx: 0, vy: 0, vz: 0, onGround: true, radius: E.r,
      yaw: Math.random() * 6.28, hp: E.hp * hpScale, maxHp: E.hp * hpScale, dmg: (E.dmg || 0) * (1 + (day - 1) * 0.12) * this.D.dmg,
      cd: rand(0, 1), state: null, stateT: 0, wanderT: 0, wx: 0, wz: 0, idle: true, strafe: Math.random() < 0.5 ? 1 : -1,
      boss: !!E.boss, spT: 4, summonT: 18, hitSet: null, avoid: 0, avoidT: 0, farT: 0,
    };
    this.enemies.set(e.id, e);
    return e;
  }

  spawnNear(type, min = 42, max = 66, boost = 0) {
    const alive = this.aliveList();
    if (!alive.length) return null;
    const T = this.terrain;
    for (let t = 0; t < 24; t++) {
      const p = alive[Math.floor(Math.random() * alive.length)];
      const a = Math.random() * Math.PI * 2, d = rand(min, max);
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (Math.hypot(x, z) > 168 || T.h(x, z) < 0.8) continue;
      let clash = false;
      this.cols.query(x, z, 2, (c) => { if (c.r !== undefined && Math.hypot(c.x - x, c.z - z) < c.r + 1.2) clash = true; });
      if (clash) continue;
      let tooClose = false;
      for (const q of alive) if (Math.hypot(q.x - x, q.z - z) < min * 0.7) tooClose = true;
      if (tooClose) continue;
      return this.spawnEnemy(type, x, z, boost);
    }
    return null;
  }

  spawnBoss(final = false) {
    const idx = final ? 2 : (Math.floor(this.day / 3) - 1) % BOSS_ORDER.length;
    const type = BOSS_ORDER[Math.max(0, idx)];
    const e = this.spawnNear(type, 40, 58, final ? 3 : 0);
    if (e) this.emit('boss', { id: e.id, t: ENEMY_IDS.indexOf(type) });
  }

  updateSpawns(dt) {
    this.spawnT -= dt;
    if (this.spawnT > 0 || !this.aliveList().length) return;
    let hostile = 0, pigs = 0;
    for (const e of this.enemies.values()) { if (e.type === 'pig') pigs++; else hostile++; }
    const pc = this.players.size;
    if (this.final) {
      this.spawnT = 0.9;
      if (hostile < 70) this.spawnNear(this.pickType(this.day + 3), 38, 60, 2);
      return;
    }
    if (this.night) {
      const cap = Math.round((2 + this.day * 3) * (0.6 + 0.4 * pc) * this.D.count);
      this.spawnT = this.opts.mode === 'endless' ? 1.1 : 1.4;
      if (this.nightSpawned < cap * 1.6 && hostile < Math.min(65, cap)) {
        const n = Math.random() < 0.3 ? 2 : 1;
        for (let i = 0; i < n; i++) if (this.spawnNear(this.pickType(this.day))) this.nightSpawned++;
      }
    } else {
      this.spawnT = 6;
      if (this.day >= 2 && hostile < 2 + this.day && Math.random() < 0.5) this.spawnNear(this.pickType(this.day - 1), 50, 72);
      if (pigs < 9) this.spawnNear('pig', 28, 60);
    }
  }

  updateEnemies(dt) {
    const grid = new Map();
    for (const e of this.enemies.values()) {
      const k = Math.floor(e.x / 3) * 1000 + Math.floor(e.z / 3);
      let list = grid.get(k);
      if (!list) grid.set(k, (list = []));
      list.push(e);
    }
    const alive = this.aliveList();
    for (const e of [...this.enemies.values()]) {
      if (!this.enemies.has(e.id)) continue;
      this.updateEnemy(e, dt, grid, alive);
    }
  }

  updateEnemy(e, dt, grid, alive) {
    const E = ENEMIES[e.type], now = this.time;
    e.cd -= dt;
    e.spT -= dt;
    e.summonT -= dt;
    let dirx = 0, dirz = 0, speed = E.speed;

    // 멀리 떨어진 적은 정리
    let nearest = Infinity, t = null;
    for (const p of alive) {
      const d = Math.hypot(p.x - e.x, p.z - e.z);
      if (d < nearest) { nearest = d; t = p; }
    }
    if (nearest > 140 && !e.boss) {
      e.farT += dt;
      if (e.farT > 25) {
        this.enemies.delete(e.id);
        this.emit('egone', { id: e.id });
        return;
      }
    } else e.farT = 0;

    const aggro = this.night || e.boss || this.final || e.provoked ? 400 : E.aggro || 0;
    if (E.passive || nearest > aggro) t = null;

    if (E.passive) {
      if (e.fleeUntil > now) {
        const dx = e.x - e.fleeX, dz = e.z - e.fleeZ, d = Math.hypot(dx, dz) || 1;
        dirx = dx / d; dirz = dz / d;
        speed = E.speed * 1.3;
      } else this.wander(e, dt), (dirx = e.idle ? 0 : e.wx), (dirz = e.idle ? 0 : e.wz), (speed *= 0.35);
    } else if (e.state === 'windup') {
      e.stateT -= dt;
      if (t) e.yaw = Math.atan2(t.x - e.x, t.z - e.z);
      if (e.stateT <= 0) {
        e.state = null;
        e.cd = E.cd;
        if (e.special === 'slam') {
          const R = e.type === 'titan' ? 8 : 7;
          this.emit('slam', { x: r2(e.x), z: r2(e.z), r: R });
          for (const p of alive) if (Math.hypot(p.x - e.x, p.z - e.z) < R && p.y < e.y + 3) this.hurtPlayer(p, e.dmg * 1.3, e, e);
          for (const s of this.structs.values()) if (Math.hypot(s.x - e.x, s.z - e.z) < R) this.damageStruct(s, e.dmg * 2);
        } else if (t && nearest <= E.range + 1.3) {
          this.hurtPlayer(t, e.dmg, e, e);
        }
        e.special = null;
      }
    } else if (e.state === 'dash') {
      e.stateT -= dt;
      dirx = e.dashX; dirz = e.dashZ;
      speed = E.speed * 3.2;
      for (const p of alive) {
        if (e.hitSet.has(p.nid) || Math.hypot(p.x - e.x, p.z - e.z) > E.r + 1) continue;
        e.hitSet.add(p.nid);
        this.hurtPlayer(p, e.dmg * 1.2, e, e);
      }
      if (e.stateT <= 0) { e.state = null; e.cd = E.cd; }
    } else if (t) {
      const dx = t.x - e.x, dz = t.z - e.z, nx = dx / (nearest || 1), nz = dz / (nearest || 1);
      e.yaw = Math.atan2(nx, nz);
      if (E.ranged) {
        if (nearest > E.keep + 4) { dirx = nx; dirz = nz; }
        else if (nearest < E.keep - 4) { dirx = -nx; dirz = -nz; }
        else {
          if (Math.random() < dt * 0.4) e.strafe *= -1;
          dirx = -nz * e.strafe; dirz = nx * e.strafe; speed *= 0.6;
        }
        if (e.cd <= 0 && nearest < E.range) { this.enemyShoot(e, t, false); e.cd = E.cd * rand(0.8, 1.2); }
      } else {
        if (e.boss) this.bossSpecial(e, t, nearest, nx, nz);
        if (!e.state) {
          if (nearest <= E.range + 0.3) {
            if (e.cd <= 0) { e.state = 'windup'; e.stateT = E.windup; }
          } else { dirx = nx; dirz = nz; }
        }
      }
    } else {
      this.wander(e, dt);
      if (!e.idle) { dirx = e.wx; dirz = e.wz; speed *= 0.4; }
    }

    if (dirx || dirz) {
      // 앞을 막는 나무·바위는 옆으로 돌아간다
      if (e.avoidT > 0) {
        e.avoidT -= dt;
        const c = Math.cos(e.avoid), s = Math.sin(e.avoid);
        [dirx, dirz] = [dirx * c - dirz * s, dirx * s + dirz * c];
      } else {
        const ax = e.x + dirx * (e.radius + 1.6), az = e.z + dirz * (e.radius + 1.6);
        let obst = null;
        this.cols.query(ax, az, 2, (c) => {
          if (obst || c.r === undefined || c.r <= 0 || c.struct) return;
          if (Math.hypot(c.x - ax, c.z - az) < c.r + e.radius + 0.2) obst = c;
        });
        if (obst) {
          const cross = dirx * (obst.z - e.z) - dirz * (obst.x - e.x);
          e.avoid = cross > 0 ? -1.15 : 1.15;
          e.avoidT = 0.45;
        }
      }
      // 서로 겹치지 않게
      const gx = Math.floor(e.x / 3), gz = Math.floor(e.z / 3);
      let sx = 0, sz = 0;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          const list = grid.get((gx + ox) * 1000 + (gz + oz));
          if (!list) continue;
          for (const o of list) {
            if (o === e) continue;
            const ddx = e.x - o.x, ddz = e.z - o.z, dd = Math.hypot(ddx, ddz), rr = e.radius + o.radius + 0.3;
            if (dd < rr && dd > 1e-4) { sx += (ddx / dd) * (rr - dd); sz += (ddz / dd) * (rr - dd); }
          }
        }
      }
      dirx += sx * 1.5;
      dirz += sz * 1.5;
      const l = Math.hypot(dirx, dirz) || 1;
      dirx /= l; dirz /= l;
      if (!t) e.yaw = Math.atan2(dirx, dirz);
    }
    const k = Math.min(1, dt * 7);
    e.vx += (dirx * speed - e.vx) * k;
    e.vz += (dirz * speed - e.vz) * k;
    const blocked = moveBody(e, dt, this.terrain, this.cols);
    if (blocked && blocked.struct && !E.passive && e.cd <= 0 && (dirx || dirz) && !e.state) {
      this.damageStruct(blocked.struct, e.dmg * (E.wall || 1.5));
      e.cd = E.cd;
      this.emit('eatk', { id: e.id });
    }
  }

  wander(e, dt) {
    e.wanderT -= dt;
    if (e.wanderT > 0) return;
    e.wanderT = rand(2.5, 6);
    const a = Math.random() * Math.PI * 2;
    e.wx = Math.cos(a);
    e.wz = Math.sin(a);
    e.idle = Math.random() < 0.4;
  }

  bossSpecial(e, t, dist, nx, nz) {
    if (e.summonT <= 0 && e.type !== 'titan') {
      e.summonT = 22;
      const kind = e.type === 'king' ? 'goblin' : 'wolf';
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * 6.28;
        const m = this.spawnEnemy(kind, e.x + Math.cos(a) * 4, e.z + Math.sin(a) * 4);
        m.provoked = true;
      }
      this.emit('summon', { id: e.id });
    }
    if (e.spT > 0) return;
    if (e.type === 'king') {
      if (dist < 8) { e.state = 'windup'; e.stateT = 0.9; e.special = 'slam'; e.spT = 6; this.emit('bwind', { id: e.id }); }
    } else if (e.type === 'titan') {
      if (dist > 10 && dist < 45) { this.enemyShoot(e, t, true); e.spT = 4.5; }
      else if (dist < 9) { e.state = 'windup'; e.stateT = 1.0; e.special = 'slam'; e.spT = 6; this.emit('bwind', { id: e.id }); }
    } else if (e.type === 'alpha') {
      if (dist > 5 && dist < 24) {
        e.state = 'dash'; e.stateT = 0.7; e.dashX = nx; e.dashZ = nz; e.hitSet = new Set(); e.spT = 5.5;
        this.emit('bwind', { id: e.id });
      }
    }
  }

  enemyShoot(e, t, big) {
    const E = ENEMIES[e.type];
    const sx = e.x, sy = e.y + E.height * 0.75, sz = e.z;
    const speed = big ? 24 : 30, g = big ? 16 : 7;
    let dist = Math.hypot(t.x - sx, t.z - sz);
    const lead = Math.min(1.2, dist / speed);
    const tx = t.x + t.evx * lead * 0.7, tz = t.z + t.evz * lead * 0.7, ty = t.y + 1.1;
    dist = Math.hypot(tx - sx, tz - sz) || 1;
    const T = dist / speed;
    const err = big ? 0.02 : 0.05;
    this.projectiles.push({
      id: ++this.seq.proj, kind: big ? 2 : 1, owner: 'e', src: e, x: sx, y: sy, z: sz,
      vx: ((tx - sx) / T) * (1 + rand(-err, err)), vz: ((tz - sz) / T) * (1 + rand(-err, err)), vy: (ty - sy) / T + 0.5 * g * T,
      g, dmg: e.dmg * (big ? 1.3 : 1), life: 5, r: big ? 1.1 : 0.45,
    });
    this.emit('eshot', { id: e.id, big: big ? 1 : 0 });
  }

  updateProjectiles(dt) {
    const keep = [];
    for (const q of this.projectiles) {
      q.life -= dt;
      q.vy -= q.g * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      let done = q.life <= 0;
      if (!done && q.y <= this.terrain.h(q.x, q.z)) {
        done = true;
        if (q.kind === 2) this.boulderBoom(q);
        this.emit('phit', { x: r2(q.x), y: r2(q.y), z: r2(q.z), k: q.kind });
      }
      if (!done && q.owner === 'e') {
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          if (Math.hypot(p.x - q.x, p.y + 1 - q.y, p.z - q.z) < q.r + 0.55) {
            if (q.kind === 2) this.boulderBoom(q);
            else this.hurtPlayer(p, q.dmg, this.enemies.has(q.src.id) ? q.src : null, q.src);
            done = true;
            break;
          }
        }
      }
      if (!done && q.owner === 'p') {
        for (const e of this.enemies.values()) {
          const E = ENEMIES[e.type];
          if (Math.hypot(e.x - q.x, e.z - q.z) < e.radius + q.r && q.y > e.y - 0.2 && q.y < e.y + E.height + 0.2) {
            if (this.players.has(q.src.nid)) this.playerHit(q.src, e, q.dmg, false);
            else this.hitEnemy(e, q.dmg, null);
            this.emit('phit', { x: r2(q.x), y: r2(q.y), z: r2(q.z), k: 0, e: 1 });
            done = true;
            break;
          }
        }
      }
      if (!done) keep.push(q);
    }
    this.projectiles = keep;
  }

  boulderBoom(q) {
    this.emit('slam', { x: r2(q.x), z: r2(q.z), r: 3.5 });
    for (const p of this.players.values()) {
      if (p.alive && Math.hypot(p.x - q.x, p.z - q.z) < 3.5) this.hurtPlayer(p, q.dmg, this.enemies.has(q.src.id) ? q.src : null, q);
    }
  }

  // ── 떨어진 아이템·코인 ──────────────────────────
  spawnDrop(item, n, x, y, z) {
    const d = { id: ++this.seq.drop, item, n, x, y, z, vx: rand(-3, 3), vy: rand(4, 7), vz: rand(-3, 3), born: this.time };
    this.drops.set(d.id, d);
    this.emit('dadd', { id: d.id, item, n, x: r2(x), y: r2(y), z: r2(z) });
  }

  updateDrops(dt) {
    for (const d of this.drops.values()) {
      if (this.time - d.born > 180) {
        this.drops.delete(d.id);
        this.emit('ddel', { id: d.id, by: 0 });
        continue;
      }
      let target = null, best = 7;
      if (this.time - d.born > 0.45) {
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          const dist = Math.hypot(p.x - d.x, p.y + 1 - d.y, p.z - d.z);
          if (dist < best) { best = dist; target = p; }
        }
      }
      if (target) {
        const dx = target.x - d.x, dy = target.y + 1 - d.y, dz = target.z - d.z, l = Math.hypot(dx, dy, dz) || 1;
        const s = Math.min(l, 18 * dt);
        d.x += (dx / l) * s; d.y += (dy / l) * s; d.z += (dz / l) * s;
        if (l < 1.2) this.pickup(target, d);
        continue;
      }
      d.vy -= 20 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      const g = Math.max(0, this.terrain.h(d.x, d.z)) + 0.3;
      if (d.y <= g) { d.y = g; d.vy = 0; d.vx *= 0.8; d.vz *= 0.8; }
    }
  }

  pickup(p, d) {
    this.drops.delete(d.id);
    let n = d.n;
    if (d.item === 'coin') {
      n = Math.floor(d.n * (1 + 0.25 * (p.powers.pouch || 0)) + Math.random());
      p.coins += n;
    } else {
      p.inv[d.item] = (p.inv[d.item] || 0) + n;
    }
    this.emit('ddel', { id: d.id, by: p.nid });
    this.emitTo(p, 'gain', { items: { [d.item]: n } });
    this.sendInv(p);
  }

  // ── 시간 흐름 ───────────────────────────────────
  updateClock(dt) {
    this.clock += dt;
    if (this.clock >= CYCLE.day && !this.night) {
      this.night = true;
      this.nightSpawned = 0;
      this.spawnT = 2;
      this.emit('phase', { night: true, day: this.day });
      if (this.day % 3 === 0) this.bossAt = this.time + 14;
    }
    if (this.clock >= CYCLE_LEN) {
      this.clock -= CYCLE_LEN;
      this.day++;
      this.night = false;
      this.emit('phase', { night: false, day: this.day });
      this.dawn();
    }
    if (this.bossAt && this.time >= this.bossAt) {
      this.bossAt = 0;
      this.spawnBoss();
    }
  }

  gameOver(victory) {
    if (this.over) return;
    this.over = true;
    this.room.state = 'over';
    this.emit('over', {
      victory, day: this.day, mode: this.opts.mode,
      stats: [...this.players.values()].map((p) => ({ nid: p.nid, name: p.name, color: p.color, alive: p.alive, ...p.stats, dmg: Math.round(p.stats.dmg) })),
    });
    this.room.broadcastLobby();
  }

  snapshot() {
    const p = [], e = [], pr = [], dr = [];
    for (const q of this.players.values()) {
      p.push([q.nid, r2(q.x), r2(q.y), r2(q.z), r2(q.yaw), r2(q.pitch), q.flags | (q.alive ? 0 : 128), Math.round((q.hp / q.maxHp) * 100), ITEM_IDS.indexOf(q.item)]);
    }
    for (const x of this.enemies.values()) {
      e.push([x.id, ENEMY_IDS.indexOf(x.type), r2(x.x), r2(x.y), r2(x.z), r2(x.yaw), Math.max(0, Math.round((x.hp / x.maxHp) * 100)), x.state === 'windup' ? 1 : x.state === 'dash' ? 2 : 0]);
    }
    for (const q of this.projectiles) pr.push([q.id, q.kind, r2(q.x), r2(q.y), r2(q.z)]);
    for (const d of this.drops.values()) dr.push([d.id, r2(d.x), r2(d.y), r2(d.z)]);
    this.room.io.to(this.room.code).volatile.emit('snap', {
      t: r2(this.time), c: r1(this.clock), d: this.day, p, e, pr, dr,
      f: this.final ? Math.max(0, Math.ceil(this.final.endAt - this.time)) : -1,
    });
  }

  // 가시 함정 — 위에 있는 적에게 0.5초마다 피해
  updateTraps(dt) {
    this.trapT = (this.trapT || 0) - dt;
    if (this.trapT > 0) return;
    this.trapT = 0.5;
    for (const s of this.structs.values()) {
      if (!STRUCTS[s.type].trap) continue;
      for (const e of this.enemies.values()) {
        if (ENEMIES[e.type].passive || Math.abs(e.x - s.x) > 1.25 + e.radius || Math.abs(e.z - s.z) > 1.25 + e.radius) continue;
        this.hitEnemy(e, ENEMIES[e.type].boss ? 6 : 11, null);
        this.damageStruct(s, 4);
        if (!this.structs.has(s.id)) break;
      }
    }
  }

  tick() {
    const now = Date.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    if (!this.over) {
      this.updateClock(dt);
      this.updatePlayers(dt);
      this.updateSpawns(dt);
      this.updateEnemies(dt);
      this.updateTraps(dt);
      this.updateProjectiles(dt);
      this.updateDrops(dt);
      this.nodeT -= dt;
      if (this.nodeT <= 0) { this.nodeT = 1; this.updateNodes(); }
      if (this.final && this.time >= this.final.endAt) this.gameOver(true);
    }
    this.snapshot();
    this.meT -= dt;
    if (this.meT <= 0) {
      this.meT = 0.25;
      for (const q of this.players.values()) this.emitTo(q, 'me', { hp: Math.ceil(q.hp), mh: q.maxHp, hu: Math.ceil(q.hunger), c: q.coins, al: q.alive ? 1 : 0 });
    }
  }
}
