// 내 캐릭터 — 이동·점프·기력, 공격·채집 판정, 먹기·활·설치, 1인칭 손 모델, 상호작용
import * as THREE from 'three';
import { PLAYER, ITEMS, NODES, STRUCTS, BENCH_MAX, hotbarList } from '../shared/config.js';
import { moveBody } from '../shared/physics.js';
import { buildViewHand, buildItem, buildStruct } from './models.js';

const PI = Math.PI;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const INTERACT = new Set(['workbench', 'campfire']);
const BLOOD = { goblin: '#4f9a36', king: '#3a7524', wolf: '#c0392b', alpha: '#8e1b12', golem: '#9a9ea5', titan: '#63f0f5', archer: '#f2ecdc', pig: '#e57385' };

function rayCyl(o, f, cx, cz, r, y0, y1) {
  const ox = o.x - cx, oz = o.z - cz;
  const a = f.x * f.x + f.z * f.z, b = 2 * (ox * f.x + oz * f.z), c = ox * ox + oz * oz - r * r;
  let t;
  if (c <= 0) t = 0;
  else {
    const disc = b * b - 4 * a * c;
    if (disc < 0 || a < 1e-6) return null;
    t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t < 0) return null;
  }
  const y = o.y + f.y * t;
  return y >= y0 && y <= y1 ? t : null;
}

function raySphere(o, f, cx, cy, cz, r) {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
  const b = ox * f.x + oy * f.y + oz * f.z, c = ox * ox + oy * oy + oz * oz - r * r;
  if (c <= 0) return 0;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}

export class LocalPlayer {
  constructor(game) {
    this.g = game;
    this.body = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: true, radius: PLAYER.radius };
    this.yaw = 0;
    this.pitch = 0;
    this.alive = false;
    this.stamina = PLAYER.maxStamina;
    this.staminaUse = 0;
    this.keys = new Set();
    this.pressed = new Set();
    this.lmb = false;
    this.sel = null;
    this.inv = {};
    this.powers = {};
    this.swingT = -1;
    this.swingDur = 0.5;
    this.hitDone = true;
    this.nextAction = 0;
    this.eatT = -1;
    this.bowT = -1;
    this.airJumps = 0;
    this.bobT = 0;
    this.kick = 0;
    this.fov = 75;
    this.placeRot = 0;
    this.target = null;
    this.sendAt = 0;
    this.color = '#ffc93c';
    this.view = null;
    this.viewItemId = null;
    this.ghost = null;
    this.ghostType = null;
    this.ghostValid = false;
    this.ghostRot = 0;
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0x6bff7b, transparent: true, opacity: 0.45, depthWrite: false });
    this.bind();
  }

  get held() {
    return this.sel && this.inv[this.sel] > 0 ? this.sel : 'fist';
  }

  get control() {
    const g = this.g;
    return g.state === 'game' && g.active && !g.uiOpen && !g.chatOpen && this.alive;
  }

  bind() {
    document.addEventListener('keydown', (e) => {
      if (this.g.chatOpen || this.g.state !== 'game') return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (!this.control) return;
      if (/^Digit[1-9]$/.test(e.code)) {
        const id = hotbarList(this.inv)[+e.code.slice(5) - 1];
        if (id) this.select(this.sel === id ? null : id);
      } else if (e.code === 'Backquote' || e.code === 'Digit0') this.select(null);
      else if (e.code === 'KeyE' && this.target) this.target.act();
      else if (e.code === 'KeyR') this.placeRot += PI / 4;
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.control && e.target.tagName === 'CANVAS') this.lmb = true;
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) this.lmb = false; });
    document.addEventListener('wheel', (e) => {
      if (!this.control || Math.abs(e.deltaY) < 10) return;
      const list = [null, ...hotbarList(this.inv)];
      let i = Math.max(0, list.indexOf(this.sel));
      i = (i + (e.deltaY > 0 ? 1 : -1) + list.length) % list.length;
      this.select(list[i]);
    });
    document.addEventListener('mousemove', (e) => {
      const g = this.g;
      if (g.state !== 'game' || !g.active || g.uiOpen || !this.alive) return;
      if (!g.locked && !(e.buttons & 2)) return;
      const s = 0.0022 * g.settings.sens * (this.fov / 75);
      this.yaw -= e.movementX * s;
      this.pitch = clamp(this.pitch - e.movementY * s * (g.settings.invertY ? -1 : 1), -1.52, 1.52);
    });
    document.addEventListener('contextmenu', (e) => { if (this.g.state === 'game') e.preventDefault(); });
    window.addEventListener('blur', () => { this.keys.clear(); this.lmb = false; });
  }

  spawn(d, color) {
    Object.assign(this.body, { x: d.x, y: d.y, z: d.z, vx: 0, vy: 0, vz: 0, onGround: true });
    this.alive = d.alive !== false;
    this.stamina = PLAYER.maxStamina;
    this.sel = null;
    this.setColor(color);
  }

  setColor(color) {
    if (this.view && color === this.color) return;
    this.color = color;
    if (this.view) this.g.camera.remove(this.view.group);
    this.view = buildViewHand(color);
    this.g.camera.add(this.view.group);
    this.viewItemId = null;
  }

  respawn(p) {
    Object.assign(this.body, { x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: 0, onGround: true });
    this.alive = true;
    this.stamina = PLAYER.maxStamina;
  }

  die() {
    this.alive = false;
    this.lmb = false;
    this.swingT = -1;
    if (this.view) this.view.group.visible = false;
    this.clearGhost();
  }

  setInv(inv, powers) {
    const prev = this.sel ? ITEMS[this.sel] : null;
    this.inv = inv;
    this.powers = powers;
    const list = hotbarList(inv);
    if (this.sel && !list.includes(this.sel)) {
      const same = prev && prev.kind ? list.find((id) => ITEMS[id].kind === prev.kind) : null;
      this.sel = same || null;
    }
    this.g.hud.hotbar(list, this.sel);
  }

  select(id) {
    if (id === this.sel) return;
    this.sel = id;
    this.g.sound.play('click', null, 0.5);
    this.g.hud.hotbar(hotbarList(this.inv), this.sel);
  }

  forward(out = new THREE.Vector3()) {
    return out.set(0, 0, -1).applyQuaternion(this.g.camera.quaternion);
  }

  act() {
    const g = this.g, t = g.time;
    if (t < this.nextAction) return;
    const id = this.held, I = ITEMS[id];
    if (I.cat === 'tool' && I.kind !== 'bow') {
      this.swingT = 0;
      this.hitDone = false;
      this.swingDur = I.swing;
      this.nextAction = t + I.swing;
      g.sound.play('swing', null, 0.6);
    } else if (I.kind === 'bow') {
      this.nextAction = t + I.swing;
      if (!(this.inv.arrow > 0)) { g.hud.toast('화살이 없습니다. 작업대에서 만드세요.', 'bad'); return; }
      const f = this.forward();
      g.socket.emit('shoot', { d: [r3(f.x), r3(f.y), r3(f.z)] });
      this.bowT = 0;
      g.sound.play('bowshot');
    } else if (I.cat === 'food') {
      g.socket.emit('eat', { item: id });
      this.eatT = 0;
      this.nextAction = t + 0.6;
      g.sound.play('eat');
    } else if (I.cat === 'place') {
      this.nextAction = t + 0.35;
      this.lmb = false;
      if (this.ghostValid) g.socket.emit('place', { item: id, x: r2(this.ghost.position.x), z: r2(this.ghost.position.z), rot: r3(this.ghostRot) });
      else { g.sound.play('err'); g.hud.toast('여기에는 놓을 수 없습니다.', 'bad'); }
    }
  }

  performHit() {
    const g = this.g, cam = g.camera.position, f = this.forward(), I = ITEMS[this.held];
    const fl = Math.hypot(f.x, f.z) || 1e-6, fx = f.x / fl, fz = f.z / fl;
    const cands = [];
    for (const ev of g.enemies.values()) {
      if (ev.dead) continue;
      const E = ev.E, dx = ev.pos.x - cam.x, dz = ev.pos.z - cam.z, hd = Math.hypot(dx, dz);
      if (hd - E.r > PLAYER.reach + 0.5) continue;
      const aimY = cam.y + (f.y / fl) * Math.max(0, hd - E.r);
      if (hd > E.r + 1 && (aimY < ev.pos.y - 0.8 || aimY > ev.pos.y + E.height + 0.8)) continue;
      const dot = hd > 1e-3 ? (dx * fx + dz * fz) / hd : 1;
      if (dot < 0.55 && hd > E.r + 1.1) continue;
      cands.push([ev, hd]);
    }
    cands.sort((a, b) => a[1] - b[1]);
    if (cands.length) {
      const pick = cands.slice(0, I.kind === 'sword' ? 3 : 1);
      g.socket.emit('attack', { ids: pick.map((c) => c[0].id) });
      for (const [ev] of pick) {
        ev.flash = 1;
        g.fx.burst(ev.pos.x, ev.pos.y + ev.E.height * 0.6, ev.pos.z, BLOOD[ev.type] || '#c0392b', 7, { speed: 4, size: 0.1, life: 0.5 });
      }
      g.sound.play('hit');
      this.kick = 0.02;
      return;
    }
    const hit = this.rayNode(cam, f);
    if (!hit) return;
    const n = hit.n, N = NODES[n.type], p = cam.clone().addScaledVector(f, hit.t);
    if (N.kind === 'rock' && !(I.tier >= N.tier && I.rock > 0)) {
      g.sound.play('clang', [p.x, p.y, p.z]);
      g.fx.burst(p.x, p.y, p.z, '#fff3a0', 5, { speed: 3, size: 0.06, life: 0.3 });
      g.hud.toast(N.tier === 1 ? '곡괭이가 있어야 캘 수 있습니다.' : `${['', '', '돌', '철'][N.tier]} 곡괭이 이상이 필요합니다.`, 'bad');
      return;
    }
    g.socket.emit('gather', { i: n.i });
    g.world.hitNode(n.i);
    g.fx.chips(p.x, p.y, p.z, n.type);
    g.sound.play(N.kind === 'tree' ? 'chop' : 'mine', [p.x, p.y, p.z]);
  }

  rayNode(cam, f) {
    let best = null;
    const reach = PLAYER.reach + 1.2;
    this.g.world.nodeIndex.query(cam.x + f.x * 2, cam.z + f.z * 2, reach + 2, (c) => {
      const n = c.node;
      if (!n.alive) return;
      const N = NODES[n.type];
      let t;
      if (N.kind === 'tree' && n.type !== 'bush') t = rayCyl(cam, f, n.x, n.z, N.r * n.s + 0.3, n.y, n.y + 4.8 * n.s);
      else t = raySphere(cam, f, n.x, n.y + (n.type === 'bush' ? 0.55 : 0.5) * n.s, n.z, (n.type === 'bush' ? 0.95 : 1.1) * n.s);
      if (t !== null && t <= reach + (N.r || 0.5) * n.s && (!best || t < best.t)) best = { n, t };
    });
    return best;
  }

  findTarget() {
    const g = this.g, b = this.body, f = this.forward();
    const fl = Math.hypot(f.x, f.z) || 1;
    let best = null, bs = -Infinity;
    const consider = (x, z, rad, text, act) => {
      const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz);
      if (d > rad) return;
      const dot = d > 0.6 ? (dx * f.x + dz * f.z) / (d * fl) : 1;
      if (dot < 0.3) return;
      const score = dot - d * 0.06;
      if (score > bs) { bs = score; best = { text, act }; }
    };
    for (const c of g.world.chests) {
      if (!c.opened) {
        const price = g.chestPrice(c);
        consider(c.x, c.z, 3.8, `[E] ${c.gold ? '황금 상자' : '상자'} 열기 · 코인 ${price}${g.coins < price ? ' (부족)' : ''}`, () => g.socket.emit('chest', { i: c.i }));
      }
    }
    for (const s of g.world.structs.values()) {
      if (!INTERACT.has(s.type)) continue;
      const text = s.type === 'workbench' ? `[E] ${s.lv}단계 작업대 · 제작${s.lv < BENCH_MAX ? ' / 강화' : ''}` : '[E] 모닥불 · 고기 굽기';
      consider(s.x, s.z, 3.6, text, () => g.openCraft());
    }
    if (g.mode === 'escape' && g.world.boat) consider(g.world.boat.x, g.world.boat.z, 9.5, g.world.boat.ready ? '[E] 난파선 · 출항 준비 완료!' : '[E] 난파선 수리하기', () => g.openBoat());
    return best;
  }

  rebuildViewItem() {
    const id = this.held, M = this.view.mount;
    M.clear();
    this.viewItemId = id;
    if (id === 'fist') return;
    const I = ITEMS[id], item = buildItem(id);
    if (I.cat === 'tool' && I.kind !== 'bow') {
      item.rotation.set(0.55, 0.25, -0.12);
      item.position.set(0, -0.06, 0.04);
      item.scale.setScalar(0.72);
    } else if (I.kind === 'bow') {
      item.rotation.set(0, -0.2, 0.15);
      item.scale.setScalar(0.9);
    } else if (I.cat === 'food') {
      item.scale.setScalar(1.1);
      item.position.set(0, 0.02, -0.02);
    } else {
      item.position.set(0, 0.05, -0.05);
    }
    M.add(item);
  }

  updateView(dt, hs) {
    if (!this.view) return;
    const V = this.view.group;
    V.visible = true;
    if (this.held !== this.viewItemId) this.rebuildViewItem();
    const I = ITEMS[this.held];
    let px = 0.42, py = -0.38, pz = -0.66, rx = 0, rz = 0;
    const sway = Math.sin(this.bobT) * 0.025 * Math.min(1, hs / 6);
    px += sway;
    py += Math.abs(sway) * 0.7;
    if (I.kind === 'bow') { px = 0.05; py = -0.28; pz = -0.62; if (this.bowT >= 0) pz += Math.sin((this.bowT / 0.35) * PI) * 0.1; }
    if (this.swingT >= 0) {
      const p = this.swingT / this.swingDur;
      if (p < 0.22) rx = (p / 0.22) * 0.55;
      else if (p < 0.42) rx = 0.55 - ((p - 0.22) / 0.2) * 1.95;
      else rx = -1.4 * (1 - (p - 0.42) / 0.58);
      const s = Math.max(0, -rx);
      px -= s * 0.12;
      pz -= s * 0.1;
      rz = s * 0.25;
    }
    if (this.eatT >= 0) {
      const k = Math.sin((this.eatT / 0.5) * PI);
      py += k * 0.22;
      px -= k * 0.25;
    }
    V.position.set(px, py, pz);
    V.rotation.set(rx, 0, rz);
  }

  clearGhost() {
    if (!this.ghost) return;
    this.g.scene.remove(this.ghost);
    this.ghost = null;
    this.ghostType = null;
  }

  updateGhost() {
    const g = this.g, I = ITEMS[this.held];
    if (!this.control || I.cat !== 'place') { this.clearGhost(); return; }
    if (this.ghostType !== I.struct) {
      this.clearGhost();
      const { group } = buildStruct(I.struct);
      group.traverse((o) => { if (o.isMesh) { o.material = this.ghostMat; o.castShadow = false; o.receiveShadow = false; } });
      this.ghost = group;
      this.ghostType = I.struct;
      g.scene.add(group);
    }
    const cam = g.camera.position, f = this.forward(), T = g.world.terrain, b = this.body;
    let px = cam.x + f.x * 5, pz = cam.z + f.z * 5;
    for (let s = 1; s <= 8; s += 0.25) {
      const x = cam.x + f.x * s, y = cam.y + f.y * s, z = cam.z + f.z * s;
      if (y <= T.h(x, z)) { px = x; pz = z; break; }
    }
    if (Math.hypot(px - b.x, pz - b.z) < 2) {
      px = b.x - Math.sin(this.yaw) * 2.2;
      pz = b.z - Math.cos(this.yaw) * 2.2;
    }
    const rot = Math.round((this.yaw + this.placeRot) / (PI / 4)) * (PI / 4);
    const h = T.h(px, pz);
    this.ghost.position.set(px, h, pz);
    this.ghost.rotation.y = rot;
    this.ghostRot = rot;
    const S = STRUCTS[I.struct], rad = S.box ? 0.9 : S.r;
    let ok = h >= 0.2 && T.slope(px, pz) <= 0.9 && Math.hypot(px - b.x, pz - b.z) <= 8.5 && Math.hypot(px, pz) <= 170;
    if (ok) {
      g.world.cols.query(px, pz, rad + 3, (c) => {
        if (!ok || c.r === 0) return;
        const cr = c.r !== undefined ? c.r : c.hz + 0.5;
        if (Math.hypot(c.x - px, c.z - pz) < cr + rad) ok = false;
      });
    }
    this.ghostValid = ok;
    this.ghostMat.color.setHex(ok ? 0x6bff7b : 0xff5a4a);
  }

  update(dt) {
    const g = this.g, b = this.body, t = g.time, P = this.powers, cam = g.camera;
    if (!this.alive) {
      if (this.view) this.view.group.visible = false;
      this.clearGhost();
      g.hud.prompt(null);
      return;
    }
    const ctl = this.control;
    const k = (c) => ctl && this.keys.has(c);
    const fwd = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    const side = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    const moving = fwd !== 0 || side !== 0;
    const sprint = (k('ShiftLeft') || k('ShiftRight')) && moving && this.stamina > 2;
    const speed = (sprint ? PLAYER.sprint : PLAYER.walk) * (1 + 0.08 * (P.sneaker || 0));
    if (sprint) {
      this.stamina -= PLAYER.sprintCost * dt * Math.pow(0.85, P.ginseng || 0);
      this.staminaUse = t;
    } else if (t - this.staminaUse > 0.7) {
      this.stamina = Math.min(PLAYER.maxStamina, this.stamina + PLAYER.staminaRegen * dt * (1 + 0.3 * (P.ginseng || 0)));
    }
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = -sy * fwd + cy * side, wz = -cy * fwd - sy * side;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    const acc = Math.min(1, dt * (b.onGround ? 12 : 3));
    b.vx += (wx * speed - b.vx) * acc;
    b.vz += (wz * speed - b.vz) * acc;
    if (ctl && this.pressed.has('Space')) {
      const cost = PLAYER.jumpCost * Math.pow(0.85, P.ginseng || 0);
      const jv = PLAYER.jump * (1 + 0.12 * (P.feather || 0));
      if (b.onGround && this.stamina >= cost) {
        b.vy = jv; b.onGround = false; this.stamina -= cost; this.staminaUse = t; this.airJumps = 0;
        g.sound.play('jump', null, 0.6);
      } else if (!b.onGround && this.airJumps < (P.cloud || 0) && this.stamina >= cost) {
        b.vy = jv * 0.92; this.airJumps++; this.stamina -= cost; this.staminaUse = t;
        g.sound.play('jump', null, 0.6);
        g.fx.poof(b.x, b.y, b.z, '#ffffff', 8, 0.2);
      }
    }
    this.pressed.clear();
    const wasAir = !b.onGround, vy0 = b.vy;
    moveBody(b, Math.min(dt, 0.05), g.world.terrain, g.world.cols);
    if (wasAir && b.onGround && vy0 < -7) { g.sound.play('land', null, 0.7); this.kick = 0.12; }
    if (b.onGround) this.airJumps = 0;

    const hs = Math.hypot(b.vx, b.vz);
    const prev = Math.sin(this.bobT);
    if (b.onGround && hs > 0.5) this.bobT += dt * hs * 1.25;
    if (prev < 0 && Math.sin(this.bobT) >= 0 && hs > 2) g.sound.play('step', null, 0.5);
    const bob = b.onGround ? Math.abs(Math.sin(this.bobT)) * 0.05 * Math.min(1, hs / 6) : 0;
    this.kick = Math.max(0, this.kick - dt * 0.6);
    cam.position.set(b.x, b.y + PLAYER.eye + bob - this.kick, b.z);
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (g.fx.shake > 0) {
      cam.rotation.x += (Math.random() - 0.5) * g.fx.shake * 0.06;
      cam.rotation.y += (Math.random() - 0.5) * g.fx.shake * 0.06;
    }
    const tf = (g.settings.fov || 75) + (sprint && hs > 6 ? 8 : 0);
    this.fov += (tf - this.fov) * Math.min(1, dt * 8);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }

    if (ctl && this.lmb) this.act();
    if (this.swingT >= 0) {
      this.swingT += dt;
      if (!this.hitDone && this.swingT >= this.swingDur * 0.3) { this.hitDone = true; this.performHit(); }
      if (this.swingT >= this.swingDur) this.swingT = -1;
    }
    if (this.eatT >= 0 && (this.eatT += dt) > 0.5) this.eatT = -1;
    if (this.bowT >= 0 && (this.bowT += dt) > 0.35) this.bowT = -1;
    this.updateView(dt, hs);
    this.updateGhost();
    this.target = ctl ? this.findTarget() : null;
    g.hud.prompt(this.target ? this.target.text : null);

    if (t >= this.sendAt) {
      this.sendAt = t + 0.05;
      const f = (hs > 0.5 ? 1 : 0) | (sprint ? 2 : 0) | (this.swingT >= 0 ? 4 : 0) | (b.onGround ? 0 : 8);
      g.socket.emit('input', { x: r2(b.x), y: r2(b.y), z: r2(b.z), yaw: r3(this.yaw), pitch: r3(this.pitch), f, it: this.held });
    }
    g.hud.stamina(this.stamina);
  }
}
