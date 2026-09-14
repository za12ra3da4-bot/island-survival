// 다른 사람·적·떨어진 아이템·투사체 — 스냅샷 보간과 애니메이션
import * as THREE from 'three';
import { ENEMIES, ENEMY_IDS, ITEM_IDS, ITEMS } from '../shared/config.js';
import { buildPlayer, buildEnemy, buildItem, itemGeometry, projectileGeometry, VC } from './models.js';

const PI = Math.PI;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

class Interp {
  constructor() {
    this.buf = [];
  }

  push(s) {
    this.buf.push(s);
    if (this.buf.length > 24) this.buf.shift();
  }

  sample(rt) {
    const b = this.buf;
    if (!b.length) return null;
    if (rt <= b[0].t) return b[0];
    for (let i = b.length - 1; i >= 0; i--) {
      if (b[i].t > rt) continue;
      const a = b[i], c = b[i + 1];
      if (!c) return a;
      if (Math.hypot(c.x - a.x, c.z - a.z) > 8) return a;
      const k = (rt - a.t) / Math.max(1e-3, c.t - a.t);
      return { ...c, x: a.x + (c.x - a.x) * k, y: a.y + (c.y - a.y) * k, z: a.z + (c.z - a.z) * k, yaw: a.yaw + wrap(c.yaw - a.yaw) * k };
    }
    return b[0];
  }
}

function textSprite(text, color = '#ffffff', w = 256, h = 48, font = 30) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.font = `${font}px Jua, 'Black Han Sans', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(30,20,10,0.85)';
  ctx.strokeText(text, w / 2, h / 2 + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(w / 110, h / 110, 1);
  sp.renderOrder = 10;
  return sp;
}

// ── 다른 플레이어 ─────────────────────────────────
export class PlayerView {
  constructor(scene, info) {
    this.scene = scene;
    this.nid = info.nid;
    this.interp = new Interp();
    this.phase = 0;
    this.itemIdx = -1;
    this.swing = 0;
    this.state = { x: 0, y: 0, z: 0, alive: true };
    this.build(info);
  }

  build(info) {
    if (this.rig) this.scene.remove(this.rig.root);
    this.color = info.color;
    this.name = info.name;
    this.rig = buildPlayer(info.color);
    this.tag = textSprite(info.name, info.color);
    this.tag.position.y = 2.25;
    this.rig.root.add(this.tag);
    this.scene.add(this.rig.root);
    this.itemIdx = -1;
  }

  setInfo(info) {
    if (info.color !== this.color || info.name !== this.name) this.build(info);
  }

  push(t, a) {
    this.interp.push({ t, x: a[1], y: a[2], z: a[3], yaw: a[4], pitch: a[5], f: a[6], hp: a[7], it: a[8] });
  }

  update(rt, dt) {
    const s = this.interp.sample(rt);
    const R = this.rig;
    if (!s) { R.root.visible = false; return; }
    R.root.visible = true;
    const moved = Math.hypot(s.x - this.state.x, s.z - this.state.z) / Math.max(dt, 1e-3);
    this.state = { x: s.x, y: s.y, z: s.z, alive: !(s.f & 128) };
    R.root.position.set(s.x, s.y, s.z);
    R.root.rotation.y = s.yaw + PI;
    if (s.it !== this.itemIdx) {
      this.itemIdx = s.it;
      R.mount.clear();
      const id = ITEM_IDS[s.it];
      if (id && id !== 'fist') R.mount.add(buildItem(id));
    }
    if (!this.state.alive) {
      R.root.rotation.x += (-PI / 2 - R.root.rotation.x) * Math.min(1, dt * 6);
      R.root.position.y = s.y + 0.3;
      this.tag.visible = false;
      return;
    }
    R.root.rotation.x = 0;
    this.tag.visible = true;
    const moving = s.f & 1, air = s.f & 8;
    if (moving && !air) this.phase += dt * Math.min(moved, 11) * 2.2;
    const sw = moving ? Math.sin(this.phase) : 0;
    R.footL.position.z = sw * 0.22;
    R.footR.position.z = -sw * 0.22;
    R.footL.position.y = 0.08 + Math.max(0, sw) * 0.1;
    R.footR.position.y = 0.08 + Math.max(0, -sw) * 0.1;
    R.bodyG.position.y = Math.abs(sw) * 0.06 + (air ? 0.1 : 0);
    if (s.f & 4) this.swing = Math.min(1, this.swing + dt * 7);
    else this.swing = Math.max(0, this.swing - dt * 5);
    R.handR.position.set(-0.52, 0.9 + this.swing * 0.35, 0.08 + this.swing * 0.35);
    R.handR.rotation.x = -this.swing * 1.8;
    R.handL.position.set(0.52, 0.9 - sw * 0.05, 0.08 + sw * 0.15);
  }

  dispose() {
    this.scene.remove(this.rig.root);
    this.tag.material.map.dispose();
  }
}

// ── 적 ────────────────────────────────────────────
export class EnemyView {
  constructor(scene, id, typeIdx) {
    this.scene = scene;
    this.id = id;
    this.type = ENEMY_IDS[typeIdx] || 'goblin';
    this.E = ENEMIES[this.type];
    this.R = buildEnemy(this.type);
    this.interp = new Interp();
    this.pos = new THREE.Vector3();
    this.phase = Math.random() * 6;
    this.flash = 0;
    this.hp = 100;
    this.st = 0;
    this.raise = 0;
    this.strike = 0;
    this.dead = false;
    this.deadT = 0;
    this.lastSeen = 0;
    this.hpBar = null;
    this.R.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(this.R.root);
  }

  push(t, a, now) {
    this.lastSeen = now;
    this.interp.push({ t, x: a[2], y: a[3], z: a[4], yaw: a[5], hp: a[6], st: a[7] });
  }

  setHpBar(hp) {
    if (this.E.boss || this.type === 'pig' || hp >= 100) {
      if (this.hpBar) this.hpBar.visible = false;
      return;
    }
    if (!this.hpBar) {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 10;
      this.hpCanvas = c;
      this.hpBar = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
      this.hpBar.scale.set(1.1, 0.17, 1);
      this.hpBar.renderOrder = 9;
      this.scene.add(this.hpBar);
    }
    const ctx = this.hpCanvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 10);
    ctx.fillStyle = 'rgba(30,20,10,.85)';
    ctx.fillRect(0, 0, 64, 10);
    ctx.fillStyle = hp > 50 ? '#7be07b' : hp > 25 ? '#ffc83d' : '#ff5a4a';
    ctx.fillRect(2, 2, Math.max(0, 60 * (hp / 100)), 6);
    this.hpBar.material.map.needsUpdate = true;
    this.hpBar.visible = true;
  }

  kill() {
    this.dead = true;
    this.deadT = 0;
    if (this.hpBar) this.hpBar.visible = false;
  }

  update(rt, dt) {
    const R = this.R, E = this.E;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.35);
      R.inner.rotation.z = k * (PI / 2);
      R.inner.position.y = -this.deadT * 0.3;
      if (this.deadT > 0.9) R.root.scale.multiplyScalar(Math.max(0.01, 1 - dt * 6));
      return this.deadT > 1.4;
    }
    const s = this.interp.sample(rt);
    if (!s) { R.root.visible = false; return false; }
    R.root.visible = true;
    const speed = Math.hypot(s.x - this.pos.x, s.z - this.pos.z) / Math.max(dt, 1e-3);
    this.pos.set(s.x, s.y, s.z);
    R.root.position.copy(this.pos);
    R.root.rotation.y = s.yaw;
    if (s.hp !== this.hp) { this.hp = s.hp; this.setHpBar(s.hp); }
    if (this.hpBar && this.hpBar.visible) this.hpBar.position.set(s.x, s.y + E.height + 0.4, s.z);

    // 공격 자세
    if (s.st === 1) this.raise = Math.min(1, this.raise + dt * 5);
    else {
      if (this.st === 1) this.strike = 1;
      this.raise = Math.max(0, this.raise - dt * 6);
    }
    this.st = s.st;
    this.strike = Math.max(0, this.strike - dt * 5);

    const scale = E.boss ? R.root.scale.x : 1;
    this.phase += dt * Math.min(speed, 12) * (this.R.legs.length === 4 ? 2.6 : 3.2) / scale;
    const sw = speed > 0.4 ? Math.sin(this.phase) : 0;
    if (R.legs.length === 2) {
      R.legs[0].rotation.x = sw * 0.7;
      R.legs[1].rotation.x = -sw * 0.7;
    } else if (R.legs.length === 4) {
      R.legs[0].rotation.x = sw * 0.8;
      R.legs[3].rotation.x = sw * 0.8;
      R.legs[1].rotation.x = -sw * 0.8;
      R.legs[2].rotation.x = -sw * 0.8;
    }
    if (R.body) R.body.position.y = Math.abs(sw) * 0.05 + (s.st === 2 ? -0.05 : 0);
    if (R.body) R.body.rotation.x = s.st === 2 ? 0.25 : this.raise * -0.15 + this.strike * 0.3;
    if (R.arms.length === 2) {
      R.arms[0].rotation.x = -sw * 0.5 - this.raise * 0.8;
      R.arms[1].rotation.x = sw * 0.5 - this.raise * 2.4 + this.strike * 1.2;
      if (this.type === 'archer') R.arms[0].rotation.x = -1.4;
    }
    if (R.head) R.head.rotation.y = Math.sin(rt * 1.3 + this.id) * 0.2;
    if (R.jaw) R.jaw.rotation.x = 0.1 + this.raise * 0.45 + this.strike * 0.2;
    if (R.tail) R.tail.rotation.y = Math.sin(rt * (speed > 0.4 ? 9 : 3) + this.id) * 0.35;
    if (R.cape) R.cape.rotation.x = 0.12 + Math.min(0.55, speed * 0.05) + Math.sin(rt * 2.5 + this.id) * 0.04;

    this.flash = Math.max(0, this.flash - dt * 6);
    R.mat.emissive.setScalar(this.flash * 0.8);
    return false;
  }

  dispose() {
    this.scene.remove(this.R.root);
    this.R.mat.dispose();
    if (this.hpBar) { this.scene.remove(this.hpBar); this.hpBar.material.map.dispose(); this.hpBar.material.dispose(); }
  }
}

// ── 떨어진 코인·아이템 ─────────────────────────────
export class DropView {
  constructor(scene, d) {
    this.scene = scene;
    this.id = d.id;
    this.item = d.item;
    const geo = itemGeometry(d.item === 'coin' ? 'coin' : d.item) || itemGeometry('coin');
    this.mesh = new THREE.Mesh(geo, VC);
    this.mesh.scale.setScalar(d.item === 'coin' ? 0.9 : 1.4);
    this.mesh.castShadow = true;
    this.pos = new THREE.Vector3(d.x, d.y, d.z);
    this.target = this.pos.clone();
    this.mesh.position.copy(this.pos);
    this.t = Math.random() * 6;
    scene.add(this.mesh);
  }

  set(x, y, z) {
    this.target.set(x, y, z);
  }

  update(dt) {
    this.t += dt;
    this.pos.lerp(this.target, Math.min(1, dt * 14));
    this.mesh.position.set(this.pos.x, this.pos.y + Math.sin(this.t * 3) * 0.08, this.pos.z);
    this.mesh.rotation.y += dt * 3;
  }

  dispose() {
    this.scene.remove(this.mesh);
  }
}

// ── 투사체 ────────────────────────────────────────
export class ProjView {
  constructor(scene, kind, x, y, z) {
    this.scene = scene;
    this.kind = kind;
    this.mesh = new THREE.Mesh(projectileGeometry(kind), VC);
    this.mesh.position.set(x, y, z);
    this.mesh.castShadow = kind === 2;
    this.last = new THREE.Vector3(x, y, z);
    this.target = new THREE.Vector3(x, y, z);
    scene.add(this.mesh);
  }

  set(x, y, z) {
    this.target.set(x, y, z);
  }

  update(dt) {
    const p = this.mesh.position;
    this.last.copy(p);
    p.lerp(this.target, Math.min(1, dt * 20));
    const d = this.target.clone().sub(this.last);
    if (d.lengthSq() > 1e-5) this.mesh.lookAt(p.clone().add(d));
    if (this.kind === 2) this.mesh.rotation.x += dt * 6;
  }

  dispose() {
    this.scene.remove(this.mesh);
  }
}
