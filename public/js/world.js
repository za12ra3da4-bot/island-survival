// 섬 장면 — 지형·물·하늘·구름·풀, 자원 노드(인스턴싱), 상자, 설치물, 난파선, 낮밤 조명
import * as THREE from 'three';
import { Terrain, HALF, RES, CELL } from '../shared/terrain.js';
import { Colliders } from '../shared/physics.js';
import { NODES, NODE_IDS, STRUCTS, STRUCT_IDS, CYCLE, BOAT_PARTS } from '../shared/config.js';
import { VC, nodeGeometry, decorGeometry, buildChest, buildStruct, buildBoat, buildSupport } from './models.js';
import { baseY, structCollider } from '../shared/build.js';

// 비탈에 지은 바닥·벽이 떠 보이지 않게 땅까지 내려가는 받침 길이
function supportDrop(type, x, z, rot, y, T) {
  const S = STRUCTS[type];
  if (!S.snap || S.roof || type === 'fence') return 0;
  const c = Math.cos(rot) * 1.4, s = -Math.sin(rot) * 1.4;
  const pts = S.snap === 'floor' ? [[1.3, 1.3], [-1.3, 1.3], [1.3, -1.3], [-1.3, -1.3]] : [[c, s], [-c, -s], [0, 0]];
  let lo = Infinity;
  for (const [a, b] of pts) lo = Math.min(lo, T.h(x + a, z + b));
  return y - 1.0 - Math.max(lo, -1.5) + 0.2;
}

const PI = Math.PI;
const ss = (a, b, x) => {
  let t = (x - a) / (b - a);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
};
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function daylight(clock) {
  if (clock < CYCLE.day) {
    const f = clock / CYCLE.day;
    return { d: ss(0, 0.05, f) * ss(1, 0.93, f), f, night: false, warm: Math.max(ss(0.14, 0, f), ss(0.82, 1, f)) };
  }
  const f = (clock - CYCLE.day) / CYCLE.night;
  return { d: 0, f, night: true, warm: ss(0.08, 0, f) * 0.6 };
}

// 바람에 흔들리는 재질 — 높이(base 위)만큼 휘어진다
const windU = { uTime: { value: 0 } };
function windMat(key, base, amp) {
  const m = VC.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windU.uTime;
    sh.vertexShader = `uniform float uTime;\n${sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 wip = vec3(0.0);
      #ifdef USE_INSTANCING
        wip = instanceMatrix[3].xyz;
      #endif
      float wph = uTime * 1.6 + wip.x * 0.13 + wip.z * 0.11;
      float wb = max(transformed.y - ${base.toFixed(3)}, 0.0);
      wb = wb * wb * ${amp.toFixed(4)};
      transformed.x += (sin(wph) + 0.45 * sin(wph * 2.7 + 1.3)) * wb;
      transformed.z += cos(wph * 0.83) * wb * 0.6;`)}`;
  };
  m.customProgramCacheKey = () => `wind:${key}`;
  return m;
}
const WIND = { tree: [1.8, 0.02], pine: [1.4, 0.012], palm: [0.8, 0.018], bush: [0.15, 0.05] };

const C = (h) => new THREE.Color(h);
const PAL = {
  seabed: C('#cdb77f'), sand: C('#ecd9a0'), wetsand: C('#d9c48a'), grass: [C('#7cc653'), C('#6dbb47'), C('#62b041')],
  darkgrass: C('#4f9a3c'), cliff: C('#8f8a84'), rock: C('#9b968f'), snow: C('#f3f6fa'),
  dayTop: C('#57b5f2'), dayHor: C('#bfe9ff'), duskTop: C('#6b77c7'), duskHor: C('#ffb27a'), nightTop: C('#050a1c'), nightHor: C('#1a2a52'),
};

export class World {
  constructor(scene, data, opts = {}) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.terrain = new Terrain(data.seed);
    this.cols = new Colliders();
    this.nodeIndex = new Colliders(6);
    this.seed = data.seed;
    this.shadows = opts.shadows !== false;
    this.t = 0;
    this.buildLights();
    this.buildSky();
    this.buildTerrain();
    this.buildWater();
    this.buildDecor();
    this.buildNodes(data.nodes || []);
    this.buildChests(data.chests || []);
    this.structs = new Map();
    for (const s of data.structs || []) this.addStruct(s);
    if (data.boat) this.buildBoat(data.boat);
    this.fallers = [];
    this.animNodes = new Set();
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.isMesh || o.isPoints || o.isInstancedMesh) {
        if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
        if (o.material && o.material !== VC) [].concat(o.material).forEach((m) => m.dispose());
      }
    });
  }

  // ── 조명·하늘 ───────────────────────────────────
  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xdff4ff, 0x6b8f4a, 1.0);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.4);
    this.sun.castShadow = this.shadows;
    this.sun.shadow.mapSize.set(4096, 4096);
    Object.assign(this.sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 280 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.06;
    this.sun.shadow.radius = 3;
    this.moon = new THREE.DirectionalLight(0x8fb0ff, 0);
    this.group.add(this.hemi, this.sun, this.sun.target, this.moon, this.moon.target);
    this.fireLights = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight(0xff9a3c, 0, 16, 1.6);
      this.group.add(l);
      this.fireLights.push(l);
    }
  }

  buildSky() {
    this.skyU = {
      top: { value: PAL.dayTop.clone() }, hor: { value: PAL.dayHor.clone() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 0.95, 0.8) }, sunVis: { value: 1 },
      moonDir: { value: new THREE.Vector3(0, -1, 0) }, moonVis: { value: 0 },
    };
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunVis; uniform vec3 moonDir; uniform float moonVis; varying vec3 vP;
        void main(){
          vec3 d = normalize(vP);
          float k = pow(max(d.y, 0.0), 0.5);
          vec3 c = mix(hor, top, k);
          c = mix(c, hor * 0.9, smoothstep(0.0, -0.25, d.y));
          float s = max(dot(d, sunDir), 0.0);
          c += sunCol * (pow(s, 5.0) * 0.28 + pow(s, 48.0) * 0.55) * sunVis;
          c += sunCol * smoothstep(0.99935, 0.9997, s) * 7.0 * sunVis;
          float m = max(dot(d, moonDir), 0.0);
          c += vec3(0.75, 0.82, 1.0) * (smoothstep(0.9993, 0.99955, m) * 2.2 + pow(m, 60.0) * 0.12) * moonVis;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    this.skyDome.renderOrder = -10;
    this.group.add(this.skyDome);
    const rnd = mulberry(this.seed ^ 777);
    const N = 900, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = rnd() * 2 - 1, a = rnd() * PI * 2, r = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * r * 440, Math.abs(u) * 440 + 20, Math.sin(a) * r * 440], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.group.add(this.stars);
    this.scene.fog = new THREE.Fog(0xbfe9ff, 80, 330);
    // 구름
    this.clouds = [];
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0x555555, fog: false, transparent: true, opacity: 0.94 });
    this.cloudMat = cloudMat;
    const cg = decorGeometry('cloud');
    for (let i = 0; i < 20; i++) {
      const m = new THREE.Mesh(cg, cloudMat);
      m.position.set((rnd() - 0.5) * 520, 85 + rnd() * 40, (rnd() - 0.5) * 520);
      m.scale.setScalar(0.8 + rnd() * 1.1);
      m.rotation.y = rnd() * PI;
      this.group.add(m);
      this.clouds.push(m);
    }
  }

  terrainColor(h, ny, x, z, rnd) {
    const j = (rnd() - 0.5) * 0.08;
    let c;
    if (h < -0.4) c = PAL.seabed.clone().multiplyScalar(0.85 + Math.max(-0.35, h * 0.03));
    else if (h < 0.5) c = PAL.wetsand.clone();
    else if (h < 1.5 + rnd() * 0.5) c = PAL.sand.clone();
    else if (ny < 0.7) c = h > 44 ? PAL.snow.clone().lerp(PAL.cliff, 0.5) : PAL.cliff.clone();
    else if (h < 30) c = PAL.grass[Math.floor(rnd() * 3)].clone();
    else if (h < 40) c = PAL.darkgrass.clone();
    else if (h < 49) c = PAL.rock.clone();
    else c = PAL.snow.clone();
    return c.multiplyScalar(1 + j);
  }

  buildTerrain() {
    const T = this.terrain, n = RES;
    const pos = new Float32Array(n * n * 6 * 3), col = new Float32Array(n * n * 6 * 3);
    const rnd = mulberry(this.seed ^ 12345);
    const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    let o = 0;
    const tri = (i0, j0, i1, j1, i2, j2) => {
      const pts = [[i0, j0], [i1, j1], [i2, j2]];
      pts.forEach(([i, j], k) => v[k].set(-HALF + i * CELL, T.vert(i, j), -HALF + j * CELL));
      e1.subVectors(v[1], v[0]);
      e2.subVectors(v[2], v[0]);
      const nrm = e1.cross(e2).normalize();
      const h = (v[0].y + v[1].y + v[2].y) / 3;
      const c = this.terrainColor(h, nrm.y, v[0].x, v[0].z, rnd);
      for (let k = 0; k < 3; k++) {
        pos[o] = v[k].x; pos[o + 1] = v[k].y; pos[o + 2] = v[k].z;
        col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
        o += 3;
      }
    };
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        tri(i, j, i, j + 1, i + 1, j);
        tri(i + 1, j, i, j + 1, i + 1, j + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    this.ground = new THREE.Mesh(g, VC);
    this.ground.receiveShadow = true;
    this.group.add(this.ground);
    // 섬 바깥 바다 밑바닥
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ color: 0xb8a36e }));
    floor.rotation.x = -PI / 2;
    floor.position.y = -9.2;
    this.group.add(floor);
  }

  buildWater() {
    // 지형 높이 텍스처 → 물 깊이에 따라 색·투명도, 해안 거품
    const T = this.terrain, N = RES + 1, hd = new Uint16Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) hd[i + j * N] = THREE.DataUtils.toHalfFloat(T.vert(i, j));
    const tex = new THREE.DataTexture(hd, N, N, THREE.RedFormat, THREE.HalfFloatType);
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    this.waterU = {
      uTime: { value: 0 }, uH: { value: tex }, uN: { value: N }, uCell: { value: CELL }, uHalf: { value: HALF },
      uShallow: { value: new THREE.Color('#4fe3d2') }, uDeep: { value: new THREE.Color('#1673c2') },
    };
    const g = new THREE.PlaneGeometry(900, 900, 96, 96).toNonIndexed();
    g.rotateX(-PI / 2);
    this.waterBase = g.attributes.position.array.slice();
    const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, flatShading: true, shininess: 110, specular: 0xdff6ff });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.waterU);
      sh.vertexShader = `varying vec3 vWP;\n${sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;')}`;
      sh.fragmentShader = `uniform float uTime; uniform sampler2D uH; uniform float uN; uniform float uCell; uniform float uHalf; uniform vec3 uShallow; uniform vec3 uDeep; varying vec3 vWP;\n${sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec2 huv = ((vWP.xz + uHalf) / uCell + 0.5) / uN;
        float depth = max(vWP.y - texture2D(uH, huv).r, 0.0);
        diffuseColor.rgb = mix(uShallow, uDeep, smoothstep(0.0, 8.0, depth));
        diffuseColor.a = mix(0.42, 0.94, smoothstep(0.0, 3.5, depth));
        float n = sin(vWP.x * 0.9 + uTime * 1.3) * sin(vWP.z * 0.8 - uTime * 1.1);
        float edge = 0.6 + 0.25 * n + 0.18 * sin(uTime * 1.7 + vWP.x * 0.21 + vWP.z * 0.17);
        float foam = 1.0 - smoothstep(edge * 0.55, edge, depth);
        float sparkle = step(0.985, sin(vWP.x * 3.1 + uTime * 2.3) * sin(vWP.z * 2.7 - uTime * 1.9)) * smoothstep(4.0, 10.0, depth);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), clamp(foam * 0.92 + sparkle * 0.6, 0.0, 1.0));
        diffuseColor.a = mix(diffuseColor.a, 1.0, foam);`)}`;
    };
    this.water = new THREE.Mesh(g, mat);
    this.water.userData.noAO = true;
    this.water.position.y = 0;
    this.water.renderOrder = 1;
    this.group.add(this.water);
  }

  buildDecor() {
    const T = this.terrain, rnd = mulberry(this.seed ^ 99);
    const put = (geo, count, test, tint) => {
      const mesh = new THREE.InstancedMesh(geo, VC, count);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
      let k = 0;
      for (let a = 0; a < count * 6 && k < count; a++) {
        const ang = rnd() * PI * 2, d = Math.sqrt(rnd()) * 170;
        const x = Math.cos(ang) * d, z = Math.sin(ang) * d, h = T.h(x, z);
        if (!test(h, T.slope(x, z))) continue;
        e.set(0, rnd() * PI * 2, 0);
        q.setFromEuler(e);
        const sc = 0.7 + rnd() * 0.8;
        m.compose(p.set(x, h, z), q, s.set(sc, sc * (0.8 + rnd() * 0.5), sc));
        mesh.setMatrixAt(k, m);
        if (tint) mesh.setColorAt(k, tint(rnd));
        k++;
      }
      mesh.count = k;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    };
    put(decorGeometry('grass'), 12000, (h, sl) => h > 1.8 && h < 36 && sl < 0.8).material = windMat('grass', 0, 0.4);
    const flowerCols = ['#ffffff', '#ffd23f', '#ff6b9a', '#b58cff', '#ff8a3d'].map((c) => new THREE.Color(c));
    put(decorGeometry('flower'), 1400, (h, sl) => h > 2.5 && h < 22 && sl < 0.6, (r) => flowerCols[Math.floor(r() * flowerCols.length)]).material = windMat('flower', 0, 0.3);
    put(decorGeometry('pebble'), 700, (h) => h > -0.3 && h < 2);
  }

  // ── 자원 노드 ───────────────────────────────────
  buildNodes(list) {
    const T = this.terrain;
    this.nodes = list.map(([t, x, z, s, rot, alive], i) => ({ i, type: NODE_IDS[t], x, z, s, rot, y: T.h(x, z) - 0.12 * s, alive: !!alive, grow: 1, shake: 0 }));
    const byType = {};
    for (const n of this.nodes) (byType[n.type] ||= []).push(n);
    this.nodeMeshes = {};
    for (const [type, arr] of Object.entries(byType)) {
      const mesh = new THREE.InstancedMesh(nodeGeometry(type), WIND[type] ? windMat(type, ...WIND[type]) : VC, arr.length);
      mesh.castShadow = this.shadows;
      mesh.receiveShadow = true;
      arr.forEach((n, k) => { n.k = k; n.mesh = mesh; });
      this.nodeMeshes[type] = mesh;
      this.group.add(mesh);
    }
    for (const n of this.nodes) {
      const N = NODES[n.type];
      if (N.r > 0) n.col = { x: n.x, z: n.z, r: N.r * n.s, node: n };
      if (n.alive && n.col) this.cols.add(n.col);
      this.nodeIndex.add({ x: n.x, z: n.z, r: Math.max(0.7, (N.r || 0.6) * n.s + 0.3), node: n });
      this.setNodeMatrix(n);
    }
    for (const m of Object.values(this.nodeMeshes)) m.instanceMatrix.needsUpdate = true;
  }

  setNodeMatrix(n) {
    const m = this._m || (this._m = new THREE.Matrix4());
    const q = this._q || (this._q = new THREE.Quaternion());
    const e = this._e || (this._e = new THREE.Euler(0, 0, 0, 'YXZ'));
    const vis = n.alive ? n.grow : 0;
    const sh = n.shake > 0 ? Math.sin(this.t * 45) * n.shake * 0.07 : 0;
    e.set(sh, n.rot, sh * 0.6);
    q.setFromEuler(e);
    const s = n.s * Math.max(0.0001, vis);
    m.compose(this._p || (this._p = new THREE.Vector3()), q, this._s || (this._s = new THREE.Vector3()));
    m.makeRotationFromQuaternion(q);
    m.scale(new THREE.Vector3(s, s, s));
    m.setPosition(n.x, n.y, n.z);
    n.mesh.setMatrixAt(n.k, m);
    n.mesh.instanceMatrix.needsUpdate = true;
  }

  hitNode(i) {
    const n = this.nodes[i];
    if (!n || !n.alive) return;
    n.shake = 1;
    this.animNodes.add(n);
  }

  breakNode(i, dir) {
    const n = this.nodes[i];
    if (!n || !n.alive) return null;
    n.alive = false;
    n.shake = 0;
    if (n.col) this.cols.remove(n.col);
    this.setNodeMatrix(n);
    if (NODES[n.type].kind === 'tree' && n.type !== 'bush') {
      const outer = new THREE.Group();
      outer.position.set(n.x, n.y, n.z);
      outer.rotation.y = Number.isFinite(dir) ? dir : Math.random() * PI * 2;
      const inner = new THREE.Group();
      outer.add(inner);
      const mesh = new THREE.Mesh(nodeGeometry(n.type), VC);
      mesh.rotation.y = n.rot - outer.rotation.y;
      mesh.scale.setScalar(n.s);
      mesh.castShadow = this.shadows;
      inner.add(mesh);
      this.group.add(outer);
      this.fallers.push({ outer, inner, t: 0 });
    }
    return n;
  }

  respawnNode(i) {
    const n = this.nodes[i];
    if (!n || n.alive) return;
    n.alive = true;
    n.grow = 0;
    if (n.col) this.cols.add(n.col);
    this.animNodes.add(n);
  }

  // ── 상자 ────────────────────────────────────────
  buildChests(list) {
    const T = this.terrain;
    this.chests = list.map(([gold, x, z, rot, opened], i) => {
      const { group, lid } = buildChest(!!gold);
      const y = T.h(x, z);
      group.position.set(x, y - 0.05, z);
      group.rotation.y = rot;
      this.group.add(group);
      const c = { i, gold: !!gold, x, z, y, rot, opened: !!opened, group, lid, lidT: opened ? 1 : 0, col: { x, z, r: 0.75, chest: true } };
      this.cols.add(c.col);
      lid.rotation.x = -1.9 * c.lidT;
      return c;
    });
  }

  openChest(i) {
    const c = this.chests[i];
    if (c) c.opened = true;
    return c;
  }

  // ── 설치물 ──────────────────────────────────────
  addStruct([id, t, x, z, rot, hp, lv, open]) {
    if (this.structs.has(id)) return this.structs.get(id);
    const type = STRUCT_IDS[t];
    const { group, flames, door } = buildStruct(type, lv);
    const y = baseY(type, x, z, rot, this.terrain, this.cols);
    group.position.set(x, y, z);
    group.rotation.y = rot;
    const drop = supportDrop(type, x, z, rot, y, this.terrain);
    if (drop > 0.05) group.add(buildSupport(type, drop));
    this.group.add(group);
    const s = { id, type, x, z, y, rot, hp, lv: lv || 0, group, flames, door, open: !!open, doorT: open ? 1 : 0, pop: 0 };
    s.col = structCollider(type, x, z, rot, y);
    if (s.col) {
      s.col.struct = s;
      if (!s.open) this.cols.add(s.col);
    }
    this.structs.set(id, s);
    return s;
  }

  removeStruct(id) {
    const s = this.structs.get(id);
    if (!s) return null;
    this.cols.remove(s.col);
    this.group.remove(s.group);
    this.structs.delete(id);
    return s;
  }

  setDoor(id, open) {
    const s = this.structs.get(id);
    if (!s || !s.col) return null;
    if (s.open !== open) {
      s.open = open;
      if (open) this.cols.remove(s.col);
      else this.cols.add(s.col);
    }
    return s;
  }

  // 작업대 강화 — 단계에 맞는 모델로 바꾼다
  upgradeStruct(id, lv) {
    const s = this.structs.get(id);
    if (!s) return null;
    const { group, flames } = buildStruct(s.type, lv);
    group.position.copy(s.group.position);
    group.rotation.y = s.rot;
    this.group.remove(s.group);
    this.group.add(group);
    Object.assign(s, { group, flames, lv, pop: 1 });
    return s;
  }

  // ── 난파선 ──────────────────────────────────────
  buildBoat(b) {
    const B = buildBoat();
    B.group.position.set(b.x, -0.5, b.z);
    B.group.rotation.y = b.rot;
    this.group.add(B.group);
    this.boat = { ...b, ...B };
    this.cols.add({ x: b.x, z: b.z, hx: 1.6, hz: 4.6, cos: Math.cos(b.rot), sin: -Math.sin(b.rot), boat: true });
    const ring = new THREE.Mesh(new THREE.RingGeometry(6, 6.6, 48), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -PI / 2;
    ring.position.set(b.x, 0.15, b.z);
    this.group.add(ring);
    this.boat.ring = ring;
    this.setBoat(b);
  }

  setBoat(b) {
    if (!this.boat) return;
    this.boat.parts = b.parts;
    this.boat.ready = b.ready;
    const done = (id) => {
      const part = BOAT_PARTS.find((p) => p.id === id);
      return Object.entries(part.cost).every(([k, v]) => (b.parts[id][k] || 0) >= v);
    };
    this.boat.hull.visible = done('hull');
    this.boat.wreck.visible = !done('hull');
    this.boat.frame.visible = done('frame');
    this.boat.mast.visible = done('mast');
    this.boat.group.position.y = done('hull') ? -0.35 : -0.55;
  }

  // ── 매 프레임 ───────────────────────────────────
  update(dt, cam, clock, focus) {
    this.t += dt;
    const t = this.t;
    windU.uTime.value = t;
    this.waterU.uTime.value = t;
    // 물결
    const pos = this.water.geometry.attributes.position, base = this.waterBase;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      pos.array[i * 3 + 1] = Math.sin(x * 0.07 + t * 1.1) * 0.22 + Math.sin(z * 0.09 - t * 0.8) * 0.16 + Math.sin((x + z) * 0.03 + t * 0.5) * 0.12;
    }
    pos.needsUpdate = true;
    this.water.position.set(Math.round(cam.position.x / 12.5) * 12.5, 0, Math.round(cam.position.z / 12.5) * 12.5);

    // 낮·밤
    const L = daylight(clock);
    const top = PAL.nightTop.clone().lerp(PAL.dayTop, L.d).lerp(PAL.duskTop, L.warm * 0.5);
    const hor = PAL.nightHor.clone().lerp(PAL.dayHor, L.d).lerp(PAL.duskHor, L.warm * 0.75);
    this.skyU.top.value.copy(top);
    this.skyU.hor.value.copy(hor);
    this.skyDome.position.copy(cam.position);
    this.scene.fog.color.copy(hor);
    this.scene.fog.near = 40 + 60 * L.d;
    this.scene.fog.far = 170 + 180 * L.d;
    const sa = L.night ? -0.3 : PI * L.f;
    const sunDir = new THREE.Vector3(Math.cos(sa) * 0.8, Math.sin(sa), 0.45).normalize();
    const ma = L.night ? PI * L.f : -0.3;
    const moonDir = new THREE.Vector3(-Math.cos(ma) * 0.8, Math.sin(ma), -0.35).normalize();
    this.skyU.sunDir.value.copy(sunDir);
    this.skyU.sunVis.value = ss(-0.15, 0.05, sunDir.y);
    this.skyU.sunCol.value.setRGB(1, 0.93 - L.warm * 0.3, 0.78 - L.warm * 0.45);
    this.skyU.moonDir.value.copy(moonDir);
    this.skyU.moonVis.value = L.night ? ss(-0.1, 0.1, moonDir.y) : 0;
    const fx = focus ? focus.x : cam.position.x, fz = focus ? focus.z : cam.position.z;
    this.sun.position.set(fx + sunDir.x * 120, Math.max(10, sunDir.y * 120), fz + sunDir.z * 120);
    this.sun.target.position.set(fx, 0, fz);
    this.sun.intensity = 0.15 + 2.3 * L.d;
    this.sun.color.setHex(0xffffff).lerp(new THREE.Color(0xffb070), L.warm * 0.8);
    this.moon.position.set(fx + moonDir.x * 100, Math.max(20, moonDir.y * 100), fz + moonDir.z * 100);
    this.moon.target.position.set(fx, 0, fz);
    this.moon.intensity = L.night ? 0.85 : 0;
    this.hemi.intensity = 0.45 + 0.75 * L.d;
    this.hemi.color.setHex(0x8fa8ff).lerp(new THREE.Color(0xdff4ff), L.d);
    this.stars.material.opacity = (1 - L.d) * (L.night ? 1 : 0.6);
    this.cloudMat.emissive.setScalar(0.08 + 0.3 * L.d);
    this.nightness = 1 - L.d;

    for (const c of this.clouds) {
      c.position.x += dt * 1.6;
      if (c.position.x > 300) c.position.x -= 600;
    }

    // 모닥불
    const fires = [...this.structs.values()].filter((s) => STRUCTS[s.type].light);
    fires.sort((a, b) => Math.hypot(a.x - cam.position.x, a.z - cam.position.z) - Math.hypot(b.x - cam.position.x, b.z - cam.position.z));
    this.fireLights.forEach((l, k) => {
      const f = fires[k];
      if (!f) { l.intensity = 0; return; }
      l.position.set(f.x, f.y + (f.type === 'campfire' ? 1.2 : 2), f.z);
      l.intensity = STRUCTS[f.type].light * (0.35 + 0.65 * this.nightness) * (0.85 + Math.sin(t * 13 + k) * 0.08 + Math.sin(t * 7.3) * 0.07);
    });
    for (const s of this.structs.values()) {
      if (s.door) {
        s.doorT += ((s.open ? 1 : 0) - s.doorT) * Math.min(1, dt * 8);
        s.door.rotation.y = -s.doorT * 1.75;
      }
      if (s.flames) {
        s.flames.scale.set(1 + Math.sin(t * 12 + s.id) * 0.1, 1 + Math.sin(t * 9 + s.id) * 0.18, 1 + Math.cos(t * 11) * 0.1);
        s.flames.rotation.y += dt * 2;
      }
      if (s.pop > 0) {
        s.pop = Math.max(0, s.pop - dt * 3);
        const k = 1 + Math.sin(s.pop * PI) * 0.12;
        s.group.scale.setScalar(k);
      }
    }

    // 노드 흔들림·자라기
    for (const n of this.animNodes) {
      if (n.shake > 0) n.shake = Math.max(0, n.shake - dt * 3.5);
      if (n.grow < 1) n.grow = Math.min(1, n.grow + dt * 1.6);
      this.setNodeMatrix(n);
      if (n.shake <= 0 && n.grow >= 1) this.animNodes.delete(n);
    }
    // 쓰러지는 나무
    this.fallers = this.fallers.filter((f) => {
      f.t += dt;
      const k = Math.min(1, f.t / 1.1);
      f.inner.rotation.x = k * k * (PI / 2);
      if (f.t > 1.4) f.outer.scale.setScalar(Math.max(0.001, 1 - (f.t - 1.4) / 0.5));
      if (f.t > 1.9) { this.group.remove(f.outer); return false; }
      return true;
    });
    // 상자 뚜껑
    for (const c of this.chests) {
      if (c.opened && c.lidT < 1) {
        c.lidT = Math.min(1, c.lidT + dt * 3);
        c.lid.rotation.x = -1.9 * (1 - Math.pow(1 - c.lidT, 3));
      }
    }
    // 배
    if (this.boat) {
      this.boat.group.rotation.z = Math.sin(t * 0.8) * 0.03;
      this.boat.ring.material.opacity = this.boat.ready ? 0.35 + Math.sin(t * 3) * 0.2 : 0;
    }
  }
}
