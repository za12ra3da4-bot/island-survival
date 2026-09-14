// 효과 — 튀는 조각(인스턴싱 큐브), 퍼지는 고리, 번개, 떠오르는 피해 숫자
import * as THREE from 'three';

const MAX = 1200;
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3();

export class FX {
  constructor(scene, camera, numbersEl) {
    this.scene = scene;
    this.camera = camera;
    this.numbersEl = numbersEl;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ flatShading: true }), MAX);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, new THREE.Color());
    scene.add(this.mesh);
    this.parts = [];
    this.rings = [];
    this.bolts = [];
    this.nums = [];
    this.shake = 0;
  }

  burst(x, y, z, color, n = 10, o = {}) {
    const c = new THREE.Color(color);
    const speed = o.speed ?? 4, size = o.size ?? 0.13, life = o.life ?? 0.8, up = o.up ?? 2.5;
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= MAX) this.parts.shift();
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.8);
      this.parts.push({
        x: x + (Math.random() - 0.5) * (o.spread ?? 0.3), y: y + (Math.random() - 0.5) * (o.spread ?? 0.3), z: z + (Math.random() - 0.5) * (o.spread ?? 0.3),
        vx: Math.cos(a) * s, vy: up + Math.random() * s * 0.8, vz: Math.sin(a) * s,
        life: 0, max: life * (0.6 + Math.random() * 0.7), size: size * (0.6 + Math.random() * 0.8),
        rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 12, grav: o.grav ?? 16,
        color: c.clone().multiplyScalar(0.85 + Math.random() * 0.3), float: !!o.float,
      });
    }
  }

  chips(x, y, z, kind) {
    const cols = { tree: ['#7a4e2d', '#5fbd4a', '#9c6b3f'], pine: ['#6b4428', '#35a35a'], palm: ['#a07a4f', '#4cc35a'], bush: ['#4aa83d', '#e53935'], rock: ['#9a9894', '#7d7b77'], iron: ['#8a8580', '#d27a3a'], mithril: ['#5d6270', '#63f0f5'] }[kind] || ['#cccccc'];
    for (const c of cols) this.burst(x, y, z, c, 5, { speed: 3.5, size: 0.12, life: 0.7 });
  }

  poof(x, y, z, color = '#ffffff', n = 18, size = 0.3) {
    this.burst(x, y, z, color, n, { speed: 3, size, life: 0.9, grav: -1.5, up: 1, spread: 0.8, float: true });
  }

  ring(x, y, z, r, color = '#ffffff', life = 0.6) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y + 0.2, z);
    this.scene.add(m);
    this.rings.push({ m, r, t: 0, life });
  }

  zap(from, list) {
    for (const to of list) {
      const pts = [];
      const N = 7;
      for (let i = 0; i <= N; i++) {
        const k = i / N;
        const j = i === 0 || i === N ? 0 : 0.45;
        pts.push(new THREE.Vector3(
          from[0] + (to[0] - from[0]) * k + (Math.random() - 0.5) * j,
          from[1] + (to[1] - from[1]) * k + (Math.random() - 0.5) * j,
          from[2] + (to[2] - from[2]) * k + (Math.random() - 0.5) * j,
        ));
      }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xa8f0ff, transparent: true, opacity: 1 }));
      this.scene.add(line);
      this.bolts.push({ line, t: 0 });
      this.burst(to[0], to[1], to[2], '#a8f0ff', 8, { speed: 5, size: 0.08, life: 0.4 });
    }
  }

  number(x, y, z, text, cls = '') {
    const el = document.createElement('div');
    el.className = `dnum ${cls}`;
    el.textContent = text;
    this.numbersEl.appendChild(el);
    this.nums.push({ el, x: x + (Math.random() - 0.5) * 0.6, y, z: z + (Math.random() - 0.5) * 0.6, t: 0 });
    if (this.nums.length > 60) this.nums.shift().el.remove();
  }

  update(dt) {
    let k = 0;
    const keep = [];
    for (const p of this.parts) {
      p.life += dt;
      if (p.life >= p.max) continue;
      p.vy -= p.grav * dt;
      if (p.float) { p.vx *= 1 - dt * 2; p.vz *= 1 - dt * 2; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rx += p.spin * dt;
      const s = p.size * (p.float ? 1 + p.life * 1.5 : 1) * (1 - Math.pow(p.life / p.max, 3));
      tmpE.set(p.rx, p.ry + p.rx * 0.5, 0);
      tmpQ.setFromEuler(tmpE);
      tmpM.compose(tmpP.set(p.x, p.y, p.z), tmpQ, tmpS.set(s, s, s));
      this.mesh.setMatrixAt(k, tmpM);
      this.mesh.setColorAt(k, p.color);
      k++;
      keep.push(p);
    }
    this.parts = keep;
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.rings = this.rings.filter((r) => {
      r.t += dt;
      const f = r.t / r.life;
      if (f >= 1) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); return false; }
      r.m.scale.setScalar(0.2 + r.r * (1 - Math.pow(1 - f, 2)));
      r.m.material.opacity = 0.9 * (1 - f);
      return true;
    });
    this.bolts = this.bolts.filter((b) => {
      b.t += dt;
      if (b.t > 0.3) { this.scene.remove(b.line); b.line.geometry.dispose(); b.line.material.dispose(); return false; }
      b.line.material.opacity = 1 - b.t / 0.3;
      return true;
    });
    const w = window.innerWidth, h = window.innerHeight, v = new THREE.Vector3();
    this.nums = this.nums.filter((n) => {
      n.t += dt;
      if (n.t > 0.9) { n.el.remove(); return false; }
      v.set(n.x, n.y + n.t * 1.3, n.z).project(this.camera);
      if (v.z > 1) { n.el.style.opacity = 0; return true; }
      n.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.15 - n.t) * 3})`;
      n.el.style.opacity = n.t > 0.6 ? 1 - (n.t - 0.6) / 0.3 : 1;
      return true;
    });
    this.shake = Math.max(0, this.shake - dt * 2);
  }

  clear() {
    this.parts = [];
    for (const r of this.rings) this.scene.remove(r.m);
    for (const b of this.bolts) this.scene.remove(b.line);
    for (const n of this.nums) n.el.remove();
    this.rings = []; this.bolts = []; this.nums = [];
  }
}
