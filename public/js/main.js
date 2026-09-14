// 무인도 서바이벌 클라이언트 — 메뉴·대기실·네트워크·게임 루프
import * as THREE from 'three';
import { io } from '../vendor/socket.io.esm.min.js';
import {
  COLORS, MODES, DIFFICULTY, CYCLE, ENEMIES, ENEMY_IDS, ITEMS, NODES, NODE_IDS, STRUCTS, CHEST, POWERUPS, BENCH, hotbarList,
} from '../shared/config.js';
import { Terrain } from '../shared/terrain.js';
import { World } from './world.js';
import { PlayerView, EnemyView, DropView, ProjView } from './entities.js';
import { LocalPlayer } from './player.js';
import { HUD, esc } from './hud.js';
import { FX } from './fx.js';
import { Sound } from './audio.js';

const $ = (id) => document.getElementById(id);
const store = {
  get: (k, d = null) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장 불가 */ } },
};
const CYCLE_LEN = CYCLE.day + CYCLE.night;
const DEFAULTS = { sens: 1, fov: 75, vol: 0.7, invertY: false, shadows: true, quality: 1 };
let settings = { ...DEFAULTS };
try { settings = { ...DEFAULTS, ...JSON.parse(store.get('island.settings') || '{}') }; } catch { /* 기본값 */ }
const saveSettings = () => store.set('island.settings', JSON.stringify(settings));

// ── 렌더러 ───────────────────────────────────────
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const applyQuality = () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, settings.quality));
  renderer.setSize(innerWidth, innerHeight, false);
};
applyQuality();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 1200);
camera.rotation.order = 'YXZ';
scene.add(camera);
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  applyQuality();
});

const socket = io(window.GAME_SERVER || undefined, { reconnectionDelayMax: 4000 });
const game = {
  socket, settings, scene, camera, renderer,
  state: 'menu', active: false, locked: false, uiOpen: false, chatOpen: false,
  you: 0, lobby: null, world: null, mode: 'escape', time: 0,
  players: new Map(), enemies: new Map(), drops: new Map(), projs: new Map(), roster: new Map(), deadEnemies: new Map(),
  coins: 0, hp: 100, maxHp: 100, hunger: 100, clock: 0, day: 1, final: -1, chestsOpened: 0, offset: null,
  chestPrice(c) { const C = CHEST[c.gold ? 'gold' : 'normal']; return C.base + C.step * this.chestsOpened; },
  // 가까운 작업대 중 가장 높은 단계
  nearBench() {
    let best = null;
    const b = this.player.body;
    if (!this.world) return null;
    for (const s of this.world.structs.values()) {
      if (s.type !== 'workbench' || Math.hypot(s.x - b.x, s.z - b.z) > 6.5) continue;
      if (!best || s.lv > best.lv) best = s;
    }
    return best;
  },
  nearFire() {
    const b = this.player.body;
    return !!this.world && [...this.world.structs.values()].some((s) => s.type === 'campfire' && Math.hypot(s.x - b.x, s.z - b.z) <= 6.5);
  },
  openCraft: () => openPanel('craftPanel'),
  openBoat: () => openPanel('boatPanel'),
};
game.sound = new Sound();
game.sound.setVolume(settings.vol);
game.fx = new FX(scene, camera, $('dmgNums'));
game.hud = new HUD(game);
game.player = new LocalPlayer(game);
const { hud, player, sound, fx } = game;

const showScreen = (id) => {
  for (const s of ['menu', 'lobby', 'loading', 'hud']) $(s).hidden = s !== id;
};

// ── 메뉴 뒤 미리보기 섬 ───────────────────────────
let preview = null, previewAng = 0;
function fakeNodes(seed) {
  const T = new Terrain(seed);
  let s = seed % 2147483646 + 1;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const out = [];
  const add = (type, count, test) => {
    for (let a = 0; a < count * 20 && count > 0; a++) {
      const an = rnd() * 6.283, d = Math.sqrt(rnd()) * 168, x = Math.cos(an) * d, z = Math.sin(an) * d, h = T.h(x, z);
      if (h < 0.4 || !test(h, T.slope(x, z))) continue;
      out.push([NODE_IDS.indexOf(type), x, z, 0.8 + rnd() * 0.6, rnd() * 6.28, 1]);
      count--;
    }
  };
  add('tree', 450, (h, sl) => h > 2 && h < 24 && sl < 1);
  add('pine', 220, (h, sl) => h > 14 && sl < 1.3);
  add('rock', 170, (h) => h > 1);
  add('palm', 50, (h) => h < 2.6);
  add('bush', 70, (h, sl) => h > 2 && h < 18 && sl < 0.9);
  add('iron', 40, (h) => h > 16);
  add('mithril', 15, (h) => h > 30);
  return out;
}
function buildPreview() {
  if (preview) return;
  const seed = Math.floor(Math.random() * 1e9);
  preview = new World(scene, { seed, nodes: fakeNodes(seed) }, { shadows: false });
}
function disposePreview() {
  if (!preview) return;
  preview.dispose();
  preview = null;
}

// ── 연결 상태 ────────────────────────────────────
const netStatus = (text, cls) => { $('netStatus').textContent = text; $('netStatus').className = `net ${cls}`; };
netStatus('서버 연결 중…', 'wait');
socket.on('connect', () => netStatus('서버 연결됨', 'ok'));
socket.on('connect_error', () => netStatus('서버에 연결할 수 없습니다 — 주소와 방장 PC 방화벽을 확인하세요', 'bad'));
socket.on('disconnect', () => {
  netStatus('서버와 연결이 끊겼습니다', 'bad');
  if (game.state !== 'menu') leaveToMenu('서버와 연결이 끊겼습니다.');
});

// ── 메뉴 ─────────────────────────────────────────
let myColor = COLORS.includes(store.get('island.color')) ? store.get('island.color') : COLORS[Math.floor(Math.random() * COLORS.length)];
let mode = 'escape', difficulty = 'normal';
$('nameInput').value = store.get('island.name', '');
function renderColors(el, onPick) {
  el.innerHTML = COLORS.map((c) => `<button style="--c:${c}" class="${c === myColor ? 'on' : ''}" data-c="${c}"></button>`).join('');
  el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    myColor = b.dataset.c;
    store.set('island.color', myColor);
    el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    sound.init();
    sound.play('click');
    onPick && onPick(myColor);
  }));
}
renderColors($('colorPick'));
const seg = (id, cb) => {
  const btns = $(id).querySelectorAll('button');
  btns.forEach((b) => b.addEventListener('click', () => {
    btns.forEach((x) => x.classList.toggle('on', x === b));
    cb(b.dataset.v);
    sound.init();
    sound.play('click');
  }));
};
seg('modeSeg', (v) => { mode = v; $('modeDesc').textContent = MODES[v].desc; });
seg('diffSeg', (v) => { difficulty = v; });
$('modeDesc').textContent = MODES.escape.desc;
document.querySelectorAll('.menu-tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.menu-tabs button').forEach((x) => x.classList.toggle('on', x === b));
  $('tab-create').hidden = b.dataset.tab !== 'create';
  $('tab-join').hidden = b.dataset.tab !== 'join';
  if (b.dataset.tab === 'join') refreshRooms();
}));
const playerName = () => {
  const n = $('nameInput').value.trim().slice(0, 12) || `생존자${Math.floor(Math.random() * 900 + 100)}`;
  store.set('island.name', n);
  return n;
};
function refreshRooms() {
  socket.emit('rooms', (list) => {
    const ul = $('roomList');
    if (!Array.isArray(list) || !list.length) { ul.innerHTML = '<li class="empty">열린 방이 없습니다. 직접 만들어 보세요!</li>'; return; }
    ul.innerHTML = list.map((r) => `<li data-code="${r.code}"><b>${r.code}</b><span>${esc(r.host)}의 섬<small>${MODES[r.mode] ? MODES[r.mode].name : ''} · ${r.count}명 · ${r.state === 'game' ? `${r.day}일째 진행 중` : '대기 중'}</small></span></li>`).join('');
    ul.querySelectorAll('li[data-code]').forEach((li) => li.addEventListener('click', () => joinRoom(li.dataset.code)));
  });
}
$('refreshBtn').addEventListener('click', refreshRooms);
$('createBtn').addEventListener('click', () => {
  sound.init();
  socket.timeout(8000).emit('create', { name: playerName(), color: myColor, mode, difficulty, isPublic: $('publicCheck').checked }, (err, res) => onEnterRoom(err, res));
});
function joinRoom(code) {
  code = String(code || '').trim().toUpperCase();
  if (code.length !== 4) { $('menuError').textContent = '방 코드 4자리를 입력하세요.'; return; }
  sound.init();
  socket.timeout(8000).emit('join', { code, name: playerName(), color: myColor }, (err, res) => onEnterRoom(err, res));
}
$('joinBtn').addEventListener('click', () => joinRoom($('codeInput').value));
$('codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom($('codeInput').value); });
const urlCode = new URLSearchParams(location.search).get('room');
if (urlCode) {
  document.querySelector('.menu-tabs button[data-tab="join"]').click();
  $('codeInput').value = urlCode.toUpperCase().slice(0, 4);
}

function onEnterRoom(err, res) {
  if (err) { $('menuError').textContent = '서버가 응답하지 않습니다.'; return; }
  if (!res || !res.ok) { $('menuError').textContent = (res && res.error) || '들어가지 못했습니다.'; return; }
  $('menuError').textContent = '';
  game.you = res.you;
  history.replaceState(null, '', `?room=${res.lobby.code}`);
  renderLobby(res.lobby);
  if (res.lobby.state === 'lobby') { game.state = 'lobby'; showScreen('lobby'); }
  else { showScreen('loading'); $('loadingText').textContent = '진행 중인 섬에 합류하는 중…'; }
}

// ── 대기실 ───────────────────────────────────────
function renderLobby(L) {
  game.lobby = L;
  const isHost = L.host === game.you;
  $('lobbyCode').textContent = L.code;
  $('memberCount').textContent = `${L.members.length} / 8`;
  $('memberList').innerHTML = L.members.map((m) => `<li><i style="background:${m.color}"></i><span>${esc(m.name)}</span>${m.nid === L.host ? '<img src="assets/icons/crown.svg" alt="방장">' : ''}${m.nid === game.you ? '<em>나</em>' : ''}</li>`).join('');
  $('lobbyOpts').innerHTML = `
    <div class="opt"><span>모드</span><div class="seg small" data-k="mode">${Object.entries(MODES).map(([k, M]) => `<button data-v="${k}" class="${L.opts.mode === k ? 'on' : ''}" ${isHost ? '' : 'disabled'}>${M.name}</button>`).join('')}</div></div>
    <p class="hint">${esc(MODES[L.opts.mode].desc)}</p>
    <div class="opt"><span>난이도</span><div class="seg small" data-k="difficulty">${Object.entries(DIFFICULTY).map(([k, D]) => `<button data-v="${k}" class="${L.opts.difficulty === k ? 'on' : ''}" ${isHost ? '' : 'disabled'}>${D.name}</button>`).join('')}</div></div>`;
  $('lobbyOpts').querySelectorAll('.seg[data-k] button').forEach((b) => b.addEventListener('click', () => {
    socket.emit('opts', { [b.closest('.seg').dataset.k]: b.dataset.v });
    sound.play('click');
  }));
  $('startBtn').hidden = !isHost;
  $('lobbyWait').textContent = isHost ? '친구가 모이면 시작하세요' : '방장이 시작하기를 기다리는 중…';
  renderColors($('lobbyColors'), (c) => socket.emit('color', { color: c }));
}
socket.on('lobby', (L) => {
  renderLobby(L);
  if (game.state === 'game' && !$('results').hidden) {
    $('resAgain').hidden = L.host !== game.you;
    $('resWait').hidden = L.host === game.you;
  }
});
$('startBtn').addEventListener('click', () => { socket.emit('start'); sound.play('click'); });
$('leaveLobbyBtn').addEventListener('click', () => leaveToMenu());
$('copyLinkBtn').addEventListener('click', () => {
  const url = `${location.origin}${location.pathname}?room=${game.lobby.code}`;
  navigator.clipboard?.writeText(url).then(() => { $('copyLinkBtn').textContent = '복사됨!'; setTimeout(() => { $('copyLinkBtn').textContent = '초대 링크 복사'; }, 1500); }).catch(() => {});
});
$('lobbyChatInput').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const text = e.target.value.trim();
  if (text) socket.emit('chat', { text });
  e.target.value = '';
});
function lobbyChat(m) {
  const row = document.createElement('div');
  row.className = `cl${m.sys ? ' sys' : ''}`;
  row.innerHTML = m.sys ? esc(m.text) : `<b style="color:${m.color}">${esc(m.name)}</b> ${esc(m.text)}`;
  $('lobbyChatLog').appendChild(row);
  $('lobbyChatLog').scrollTop = 1e9;
}

function clearEntities() {
  for (const m of [game.players, game.enemies, game.drops, game.projs]) {
    for (const v of m.values()) v.dispose();
    m.clear();
  }
  game.deadEnemies.clear();
  fx.clear();
}

function leaveToMenu(msg = '') {
  socket.emit('leave');
  if (document.pointerLockElement) document.exitPointerLock();
  endGameScene();
  game.state = 'menu';
  game.lobby = null;
  showScreen('menu');
  buildPreview();
  $('menuError').textContent = msg;
  history.replaceState(null, '', location.pathname);
}

function endGameScene() {
  clearEntities();
  player.die();
  if (game.world) { game.world.dispose(); game.world = null; }
  closePanels();
  $('results').hidden = true;
  $('pauseMenu').hidden = true;
  game.active = false;
  game.uiOpen = false;
  document.body.classList.remove('playing');
}

// ── 게임 시작 ────────────────────────────────────
socket.on('start', (d) => {
  showScreen('loading');
  $('loadingText').textContent = '섬을 만드는 중…';
  setTimeout(() => {
    endGameScene();
    disposePreview();
    game.world = new World(scene, d, { shadows: settings.shadows });
    game.mode = d.mode;
    game.you = d.you;
    game.clock = d.clock;
    game.day = d.day;
    game.final = d.final;
    game.chestsOpened = d.chestsOpened;
    game.offset = null;
    game.coins = d.coins;
    game.hp = d.hp; game.maxHp = d.maxHp; game.hunger = d.hunger;
    game.roster = new Map(d.roster.map((r) => [r.nid, r]));
    const me = game.roster.get(d.you);
    player.spawn(d, me ? me.color : myColor);
    player.yaw = Math.atan2(d.x, d.z);
    hud.reset(game.world);
    player.setInv(d.inv, d.powers);
    hud.setInv(d.inv, d.powers, d.coins);
    hud.stats(d.hp, d.maxHp, d.hunger);
    hud.team(game.roster, game.you);
    hud.final(d.final);
    $('roomTag').textContent = game.lobby ? `방 ${game.lobby.code}` : '';
    game.state = 'game';
    showScreen('hud');
    if (!d.alive) { player.die(); hud.dead(true); }
    hud.notice(`${d.day}일째`, d.mode === 'escape' ? '나무를 베고 작업대를 만들어 보세요 (Tab: 제작)' : '밤이 오기 전에 준비하세요 (Tab: 제작)');
    sound.play('morning');
    showPause(true);
  }, 30);
});

socket.on('tolobby', () => {
  if (document.pointerLockElement) document.exitPointerLock();
  endGameScene();
  game.state = 'lobby';
  showScreen('lobby');
  buildPreview();
});

// ── 스냅샷 ───────────────────────────────────────
socket.on('snap', (m) => {
  if (game.state !== 'game' || !game.world) return;
  const nowS = performance.now() / 1000;
  const est = m.t - nowS;
  if (game.offset === null || est > game.offset) game.offset = est;
  else game.offset += (est - game.offset) * 0.02;
  if (Math.abs(game.clock - m.c) > 1.5 && Math.abs(game.clock - m.c) < CYCLE_LEN - 1.5) game.clock = m.c;
  game.day = m.d;
  if (m.f !== game.final) { game.final = m.f; hud.final(m.f); }
  for (const a of m.p) {
    if (a[0] === game.you) continue;
    let v = game.players.get(a[0]);
    if (!v) {
      const r = game.roster.get(a[0]);
      if (!r) continue;
      v = new PlayerView(scene, r);
      game.players.set(a[0], v);
    }
    v.push(m.t, a);
  }
  for (const a of m.e) {
    let v = game.enemies.get(a[0]);
    if (!v) {
      if (game.deadEnemies.has(a[0])) continue;
      v = new EnemyView(scene, a[0], a[1]);
      game.enemies.set(a[0], v);
    }
    if (!v.dead) v.push(m.t, a, nowS);
  }
  const seenP = new Set();
  for (const [id, kind, x, y, z] of m.pr) {
    seenP.add(id);
    let v = game.projs.get(id);
    if (!v) { v = new ProjView(scene, kind, x, y, z); game.projs.set(id, v); }
    v.set(x, y, z);
  }
  for (const [id, v] of game.projs) if (!seenP.has(id)) { v.dispose(); game.projs.delete(id); }
  for (const [id, x, y, z] of m.dr) {
    let v = game.drops.get(id);
    if (!v) { v = new DropView(scene, { id, item: 'coin', x, y, z }); game.drops.set(id, v); }
    v.set(x, y, z);
  }
});

socket.on('roster', (list) => {
  game.roster = new Map(list.map((r) => [r.nid, r]));
  for (const [nid, v] of game.players) {
    const r = game.roster.get(nid);
    if (!r) { v.dispose(); game.players.delete(nid); } else v.setInfo(r);
  }
  const me = game.roster.get(game.you);
  if (me) player.setColor(me.color);
  hud.team(game.roster, game.you);
});

socket.on('me', (m) => {
  game.hp = m.hp; game.maxHp = m.mh; game.hunger = m.hu;
  if (m.c !== game.coins) { game.coins = m.c; hud.coins(m.c); }
  hud.stats(m.hp, m.mh, m.hu);
});
socket.on('inv', (m) => {
  game.coins = m.coins;
  player.setInv(m.inv, m.powers);
  hud.setInv(m.inv, m.powers, m.coins);
});
socket.on('gain', (m) => {
  hud.gain(m.items);
  sound.play(m.items.coin ? 'coin' : 'pickup');
});
socket.on('hurt', (m) => {
  hud.hurt(m.s, camera.position, player.yaw);
  sound.play('hurt');
  fx.shake = Math.max(fx.shake, Math.min(0.6, m.a / 30));
});
socket.on('pdie', (m) => {
  const r = game.roster.get(m.n);
  if (m.n === game.you) {
    player.die();
    hud.dead(true);
    sound.play('pdie');
  } else {
    hud.toast(`${r ? r.name : '누군가'} 님이 쓰러졌습니다!`, 'bad');
  }
});
socket.on('respawn', (p) => {
  player.respawn(p);
  hud.dead(false);
  sound.play('revive');
});
socket.on('phoenix', (m) => {
  const v = m.n === game.you ? player.body : game.players.get(m.n)?.state;
  if (v) { fx.poof(v.x, v.y + 1, v.z, '#ffb52e', 30, 0.35); fx.ring(v.x, v.y, v.z, 5, '#ff7b2e'); }
  if (m.n === game.you) hud.notice('불사조 깃털!', '한 번 되살아났습니다', 'gold');
  sound.play('revive');
});

socket.on('nhit', (m) => {
  if (m.by === game.you || !game.world) return;
  const n = game.world.nodes[m.i];
  if (!n) return;
  game.world.hitNode(m.i);
  fx.chips(n.x, n.y + 1.2, n.z, n.type);
  sound.play(NODES[n.type].kind === 'tree' ? 'chop' : 'mine', [n.x, n.y + 1, n.z], 0.8);
});
socket.on('nbreak', (m) => {
  if (!game.world) return;
  const n = game.world.breakNode(m.i, m.dir);
  if (!n) return;
  const N = NODES[n.type];
  for (let k = 0; k < 3; k++) fx.chips(n.x, n.y + 0.8 + k * 0.6, n.z, n.type);
  if (N.kind === 'rock') fx.poof(n.x, n.y + 0.6, n.z, '#b9b6b0', 12, 0.35);
  sound.play(N.kind === 'tree' ? 'chop' : 'mine', [n.x, n.y + 1, n.z], 1.2);
});
socket.on('nspawn', (m) => game.world && game.world.respawnNode(m.i));
socket.on('weak', (m) => hud.toast(m.kind === 'rock' ? (m.need <= 1 ? '곡괭이가 있어야 캘 수 있습니다.' : `${['', '', '돌', '철'][m.need]} 곡괭이 이상이 필요합니다.`) : '이 도구로는 벨 수 없습니다.', 'bad'));

socket.on('ehit', (m) => {
  const v = game.enemies.get(m.id);
  if (!v) return;
  v.flash = 1;
  fx.number(v.pos.x, v.pos.y + v.E.height + 0.3, v.pos.z, m.a, m.c ? 'crit' : m.z ? 'zap' : m.by === game.you ? 'mine' : '');
  if (m.by === game.you) { hud.hitmark(); if (m.c) sound.play('crit'); }
  if (v.type === 'pig' && Math.random() < 0.5) sound.play('oink', [v.pos.x, v.pos.y, v.pos.z]);
});
socket.on('edie', (m) => {
  game.deadEnemies.set(m.id, performance.now());
  const v = game.enemies.get(m.id);
  if (v) v.kill();
  const E = ENEMIES[ENEMY_IDS[m.t]] || ENEMIES.goblin;
  fx.poof(m.x, m.y + E.height * 0.5, m.z, '#ffffff', E.boss ? 50 : 14, E.boss ? 0.8 : 0.3);
  sound.play('edie', [m.x, m.y, m.z]);
});
socket.on('egone', (m) => {
  const v = game.enemies.get(m.id);
  if (v) { v.dispose(); game.enemies.delete(m.id); }
});
socket.on('eatk', (m) => {
  const v = game.enemies.get(m.id);
  if (v) { v.strike = 1; sound.play('hit', [v.pos.x, v.pos.y, v.pos.z], 0.7); }
});
socket.on('eshot', (m) => {
  const v = game.enemies.get(m.id);
  if (v) sound.play(m.big ? 'slam' : 'bowshot', [v.pos.x, v.pos.y + 1, v.pos.z], m.big ? 0.5 : 0.8);
});
socket.on('pshot', (m) => {
  if (m.n === game.you) return;
  const v = game.players.get(m.n);
  if (v) sound.play('bowshot', [v.state.x, v.state.y + 1.5, v.state.z]);
});
socket.on('phit', (m) => {
  if (m.k === 2) return;
  fx.burst(m.x, m.y, m.z, m.e ? '#c0392b' : '#c9b89a', 5, { speed: 3, size: 0.07, life: 0.35 });
  sound.play('arrowhit', [m.x, m.y, m.z], 0.6);
});
socket.on('slam', (m) => {
  const y = game.world ? Math.max(0, game.world.terrain.h(m.x, m.z)) : 0;
  fx.ring(m.x, y, m.z, m.r, '#fff1c1', 0.6);
  fx.poof(m.x, y + 0.5, m.z, '#b9a98a', 20, 0.5);
  const d = Math.hypot(camera.position.x - m.x, camera.position.z - m.z);
  fx.shake = Math.max(fx.shake, Math.max(0, 1.1 - d / 25));
  sound.play('slam', [m.x, y, m.z]);
});
socket.on('zap', (m) => { fx.zap(m.from, m.to); sound.play('zap', m.from); });
socket.on('bwind', (m) => {
  const v = game.enemies.get(m.id);
  if (v) sound.play(v.type === 'alpha' ? 'howl' : 'grunt', [v.pos.x, v.pos.y + 2, v.pos.z], 1.4);
});
socket.on('summon', (m) => {
  const v = game.enemies.get(m.id);
  if (v) { sound.play('howl', [v.pos.x, v.pos.y, v.pos.z], 1.2); hud.toast(`${v.E.name}이(가) 부하를 불렀습니다!`, 'bad'); }
});
socket.on('boss', (m) => {
  const E = ENEMIES[ENEMY_IDS[m.t]];
  hud.notice(`${E.name} 등장!`, '모두 모여서 함께 싸우세요', 'boss');
  sound.play('boss');
});
socket.on('bossdie', (m) => {
  const E = ENEMIES[ENEMY_IDS[m.t]];
  hud.notice(`${E.name} 처치!`, '살아 있는 모두에게 희귀 이상 능력을 줍니다', 'gold');
  sound.play('victory');
});

socket.on('dadd', (d) => {
  if (!game.world) return;
  const old = game.drops.get(d.id);
  if (old) old.dispose();
  game.drops.set(d.id, new DropView(scene, d));
});
socket.on('ddel', (m) => {
  const v = game.drops.get(m.id);
  if (v) { v.dispose(); game.drops.delete(m.id); }
});
socket.on('copen', (m) => {
  game.chestsOpened = m.opened;
  if (!game.world) return;
  const c = game.world.openChest(m.i);
  if (c) {
    fx.burst(c.x, c.y + 0.8, c.z, c.gold ? '#ffd23f' : '#fff3b0', 20, { speed: 4, size: 0.1, life: 0.9, up: 4 });
    sound.play('chest', [c.x, c.y, c.z]);
  }
});
socket.on('power', (m) => hud.powerCard(m.id));
socket.on('sadd', (m) => {
  if (!game.world) return;
  const s = game.world.addStruct(m.s);
  s.pop = 1;
  fx.poof(s.x, s.y + 0.4, s.z, '#e9dcc4', 10, 0.3);
  sound.play('place', [s.x, s.y, s.z]);
});
socket.on('shit', (m) => {
  const s = game.world && game.world.structs.get(m.id);
  if (!s) return;
  s.pop = 1;
  fx.burst(s.x, s.y + 1, s.z, s.type === 'stone_wall' ? '#9a9894' : '#a8733f', 5, { speed: 3, size: 0.1, life: 0.5 });
});
socket.on('sdel', (m) => {
  const s = game.world && game.world.removeStruct(m.id);
  if (!s) return;
  fx.poof(s.x, s.y + 0.8, s.z, '#b9a98a', 18, 0.4);
  hud.toast(`${STRUCTS[s.type].name}이(가) 부서졌습니다!`, 'bad');
  sound.play('slam', [s.x, s.y, s.z], 0.5);
});
socket.on('supg', (m) => {
  const s = game.world && game.world.upgradeStruct(m.id, m.lv);
  if (!s) return;
  fx.burst(s.x, s.y + 1.2, s.z, '#ffd23f', 26, { speed: 5, size: 0.1, life: 0.9, up: 4 });
  fx.ring(s.x, s.y + 0.1, s.z, 3, '#fff1c1', 0.5);
  sound.play('rare');
  if (m.by === game.you) hud.notice(`${BENCH[m.lv].name}!`, `${BENCH[m.lv].unlock} 제작 가능`, 'gold');
  else {
    const r = game.roster.get(m.by);
    hud.toast(`${r ? r.name : '누군가'} 님이 작업대를 ${m.lv}단계로 강화했습니다!`, 'good');
  }
  if (!$('craftPanel').hidden) hud.renderCraft();
});
socket.on('eat', (m) => {
  if (m.n === game.you) return;
  const v = game.players.get(m.n);
  if (v) sound.play('eat', [v.state.x, v.state.y + 1.5, v.state.z], 0.7);
});
socket.on('crafted', (m) => {
  sound.play('craft');
  hud.toast(`${ITEMS[m.r].name}${m.n > 1 ? ` ${m.n}개` : ''} 제작 완료!`, 'good');
});
socket.on('err', (m) => { hud.toast(m.msg, 'bad'); sound.play('err'); });
socket.on('phase', (m) => {
  if (m.night) {
    hud.notice(`${m.day}일째 밤`, m.day % 3 === 0 ? '오늘 밤에는 우두머리가 나타난다…' : '적들이 몰려온다! 뭉쳐서 버티세요', 'night');
    sound.play('night');
  } else {
    hud.notice(`${m.day}일째 아침`, '쓰러진 동료가 캠프에서 깨어났습니다', '');
    sound.play('morning');
  }
});
socket.on('boat', (b) => {
  if (!game.world) return;
  game.world.setBoat(b);
  if (!$('boatPanel').hidden) hud.renderBoat();
  sound.play('boat', [b.x, 0, b.z]);
});
socket.on('boatready', () => hud.notice('난파선 수리 완료!', '배에서 [E] → 출항하면 최후의 습격이 시작됩니다', 'gold'));
socket.on('final', (m) => {
  game.final = m.t;
  hud.final(m.t);
  hud.notice('출항 준비!', `${m.t}초만 버티면 탈출합니다!`, 'boss');
  sound.play('launch');
  if (!$('boatPanel').hidden) hud.renderBoat();
});
socket.on('over', (m) => {
  if (document.pointerLockElement) document.exitPointerLock();
  game.active = false;
  closePanels();
  $('pauseMenu').hidden = true;
  hud.results(m, game.lobby && game.lobby.host === game.you);
  sound.play(m.victory ? 'victory' : 'defeat');
});
socket.on('chat', (m) => {
  if (game.state === 'game') hud.chat(m);
  lobbyChat(m);
});

$('resAgain').addEventListener('click', () => socket.emit('tolobby'));
$('resLeave').addEventListener('click', () => leaveToMenu());

// ── 마우스 잠금 · 일시정지 · 창 ───────────────────
function requestLock() {
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch { /* 지원 안 함 */ }
}
function showPause(on) {
  $('pauseMenu').hidden = !on;
  game.active = !on;
  document.body.classList.toggle('playing', !on);
  if (on) {
    player.keys.clear();
    player.lmb = false;
    if (document.pointerLockElement) document.exitPointerLock();
    const isHost = game.lobby && game.lobby.host === game.you;
    $('endGameBtn').hidden = !isHost;
  }
}
function resume() {
  if (game.state !== 'game' || !$('results').hidden) return;
  sound.init();
  showPause(false);
  requestLock();
}
function openPanel(id) {
  if (game.state !== 'game') return;
  closePanels();
  game.uiOpen = true;
  player.lmb = false;
  player.keys.clear();
  $(id).hidden = false;
  if (document.pointerLockElement) document.exitPointerLock();
  if (id === 'craftPanel') hud.renderCraft();
  if (id === 'boatPanel') hud.renderBoat();
  sound.play('click');
}
function closePanels() {
  const wasOpen = game.uiOpen;
  for (const id of ['craftPanel', 'boatPanel', 'mapPanel']) $(id).hidden = true;
  game.uiOpen = false;
  return wasOpen;
}
function closePanelsAndResume() {
  if (closePanels() && game.state === 'game' && $('pauseMenu').hidden && $('results').hidden) requestLock();
}
document.addEventListener('pointerlockchange', () => {
  const was = game.locked;
  game.locked = document.pointerLockElement === canvas;
  if (was && !game.locked && game.state === 'game' && !game.uiOpen && !game.chatOpen && $('results').hidden) showPause(true);
});
canvas.addEventListener('click', () => {
  if (game.state !== 'game') return;
  if (!$('pauseMenu').hidden) return;
  if (!game.locked && !game.uiOpen) requestLock();
});
$('resumeBtn').addEventListener('click', resume);
$('pauseSettingsBtn').addEventListener('click', openSettings);
$('menuSettingsBtn').addEventListener('click', openSettings);
$('pauseLeaveBtn').addEventListener('click', () => leaveToMenu());
$('endGameBtn').addEventListener('click', () => socket.emit('tolobby'));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closePanelsAndResume));
$('boatDeposit').addEventListener('click', () => socket.emit('boat'));
$('boatLaunch').addEventListener('click', () => {
  socket.emit('launch');
  closePanelsAndResume();
});

function openChat() {
  game.chatOpen = true;
  player.keys.clear();
  player.lmb = false;
  $('chatBox').classList.add('open');
  $('chatInput').hidden = false;
  $('chatInput').value = '';
  $('chatInput').focus();
}
function closeChat() {
  game.chatOpen = false;
  $('chatInput').hidden = true;
  $('chatInput').blur();
  $('chatBox').classList.remove('open');
  if (game.state === 'game' && $('pauseMenu').hidden && !game.uiOpen) requestLock();
}

document.addEventListener('keydown', (e) => {
  if (!$('settingsModal').hidden) { if (e.key === 'Escape') $('settingsModal').hidden = true; return; }
  if (game.state !== 'game') return;
  if (game.chatOpen) {
    if (e.key === 'Enter') {
      const text = $('chatInput').value.trim();
      if (text) socket.emit('chat', { text });
      closeChat();
    } else if (e.key === 'Escape') closeChat();
    return;
  }
  if (!$('results').hidden) return;
  if (e.code === 'Tab') {
    e.preventDefault();
    if (!$('craftPanel').hidden) closePanelsAndResume();
    else if ($('pauseMenu').hidden) openPanel('craftPanel');
    return;
  }
  if (e.code === 'KeyM') {
    if (!$('mapPanel').hidden) closePanelsAndResume();
    else if ($('pauseMenu').hidden) openPanel('mapPanel');
    return;
  }
  if (e.key === 'Escape' || e.code === 'KeyB') {
    if (game.uiOpen) closePanelsAndResume();
    else if ($('pauseMenu').hidden) showPause(true);
    else resume();
    return;
  }
  if (e.key === 'Enter' && $('pauseMenu').hidden) { e.preventDefault(); openChat(); }
});

// ── 설정 ─────────────────────────────────────────
function openSettings() {
  const body = $('settingsBody');
  const slider = (key, label, min, max, step) => `<div class="set-row"><label>${label}</label><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${settings[key]}"><b data-v="${key}">${settings[key]}</b></div>`;
  const toggle = (key, label) => `<div class="set-row"><label>${label}</label><button class="toggle ${settings[key] ? 'on' : ''}" data-t="${key}">${settings[key] ? '켬' : '끔'}</button></div>`;
  body.innerHTML = [
    slider('sens', '마우스 감도', 0.1, 4, 0.05), slider('fov', '시야각', 60, 110, 1), slider('vol', '음량', 0, 1, 0.05),
    slider('quality', '화질 (해상도)', 0.6, 2, 0.1), toggle('invertY', '상하 반전'), toggle('shadows', '그림자 (다음 판부터)'),
  ].join('');
  body.querySelectorAll('input[type=range]').forEach((r) => r.addEventListener('input', () => {
    settings[r.dataset.k] = +r.value;
    body.querySelector(`b[data-v="${r.dataset.k}"]`).textContent = r.value;
    if (r.dataset.k === 'vol') sound.setVolume(+r.value);
    if (r.dataset.k === 'quality') applyQuality();
    saveSettings();
  }));
  body.querySelectorAll('.toggle').forEach((b) => b.addEventListener('click', () => {
    settings[b.dataset.t] = !settings[b.dataset.t];
    b.classList.toggle('on', settings[b.dataset.t]);
    b.textContent = settings[b.dataset.t] ? '켬' : '끔';
    saveSettings();
  }));
  $('settingsModal').hidden = false;
}
$('settingsClose').addEventListener('click', () => { $('settingsModal').hidden = true; });

// ── 게임 루프 ────────────────────────────────────
let last = performance.now(), specAng = 0;
const tmpV = new THREE.Vector3();

function spectate(dt) {
  let target = null, name = '';
  for (const v of game.players.values()) if (v.state.alive) { target = v.state; name = v.name; break; }
  const b = target || player.body;
  specAng += dt * 0.35;
  tmpV.set(b.x + Math.sin(specAng) * 9, b.y + 6, b.z + Math.cos(specAng) * 9);
  camera.position.lerp(tmpV, Math.min(1, dt * 2));
  camera.lookAt(b.x, b.y + 1.2, b.z);
  $('deadWatch').textContent = target ? `${name} 님을 지켜보는 중` : '';
}

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  game.time += dt;
  if (game.state !== 'game') {
    if (preview) {
      previewAng += dt * 0.05;
      camera.position.set(Math.cos(previewAng) * 175, 70, Math.sin(previewAng) * 175);
      camera.lookAt(0, 8, 0);
      preview.update(dt, camera, 40 + Math.sin(game.time * 0.02) * 20, null);
      renderer.render(scene, camera);
    }
    return;
  }
  if (!game.world) return;
  game.clock += dt;
  if (game.clock >= CYCLE_LEN) game.clock -= CYCLE_LEN;
  player.update(dt);
  if (!player.alive) spectate(dt);
  const rt = now / 1000 + (game.offset ?? 0) - 0.1;
  for (const v of game.players.values()) v.update(rt, dt);
  const nowS = now / 1000;
  for (const [id, v] of game.enemies) {
    const done = v.update(rt, dt);
    if (done || (!v.dead && nowS - v.lastSeen > 1.5)) { v.dispose(); game.enemies.delete(id); }
  }
  for (const [id, t] of game.deadEnemies) if (now - t > 5000) game.deadEnemies.delete(id);
  for (const v of game.drops.values()) v.update(dt);
  for (const v of game.projs.values()) v.update(dt);
  game.world.update(dt, camera, game.clock, player.alive ? player.body : camera.position);
  fx.update(dt);
  hud.frame(dt);
  sound.listen(camera.position.x, camera.position.y, camera.position.z, player.alive ? player.yaw : camera.rotation.y);
  renderer.render(scene, camera);
}

buildPreview();
showScreen('menu');
requestAnimationFrame(frame);
window.__game = game;
