// 화면 UI — 체력·기력·배고픔, 시계, 코인, 핫바, 능력, 알림, 미니맵·지도, 제작창, 배 수리창, 결과
import {
  ITEMS, POWERUPS, RARITY, RECIPES, SECTIONS, BENCH, BENCH_MAX, BOAT_PARTS, CYCLE, ENEMIES, PLAYER, hotbarList,
} from '../shared/config.js';
import { HALF, SIZE, RES } from '../shared/terrain.js';

const $ = (id) => document.getElementById(id);
export const icon = (id) => `assets/icons/${id}.svg`;
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const CYCLE_LEN = CYCLE.day + CYCLE.night;
const INV_ORDER = ['wood', 'stone', 'iron_ore', 'mithril_ore', 'apple', 'raw_meat', 'cooked_meat'];
// 같은 종류 장비끼리 비교: [종류, 등급]
const rank = (I) => (I ? [I.kind || (I.armor ? 'armor' : ''), I.tier || I.armor || 0] : ['', 0]);

export class HUD {
  constructor(game) {
    this.g = game;
    this.feedRows = new Map();
    this.cardQueue = [];
    this.cardBusy = false;
    this.mapImg = null;
    this.mmT = 0;
    this.lastStats = '';
    $('recipeList').addEventListener('click', (e) => {
      const b = e.target.closest('.rc button');
      if (b) game.socket.emit('craft', { r: b.closest('.rc').dataset.r, n: e.shiftKey ? 5 : 1 });
    });
    $('benchBox').addEventListener('click', (e) => {
      const b = e.target.closest('[data-upgrade]');
      if (b) game.socket.emit('upgrade', { id: +b.dataset.upgrade });
    });
  }

  // ── 새 판 ───────────────────────────────────────
  reset(world) {
    this.world = world;
    const T = world.terrain, S = 240;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d'), img = ctx.createImageData(S, S);
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const h = T.vert(Math.floor((i / S) * RES), Math.floor((j / S) * RES));
        const col = h < -0.3 ? [63, 160, 214] : h < 1.5 ? [236, 217, 160] : h < 30 ? [118, 192, 80] : h < 40 ? [79, 154, 60] : h < 49 ? [155, 150, 143] : [243, 246, 250];
        const shade = h > 1.5 ? 0.9 + Math.min(0.2, h / 250) : 1;
        const o = (i + j * S) * 4;
        img.data[o] = col[0] * shade; img.data[o + 1] = col[1] * shade; img.data[o + 2] = col[2] * shade; img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.mapImg = c;
    $('feed').innerHTML = '';
    this.feedRows.clear();
    $('chatLog').innerHTML = '';
    this.boss(null);
    this.final(-1);
    this.dead(false);
  }

  // ── 상태 ────────────────────────────────────────
  stats(hp, maxHp, hunger) {
    const key = `${hp}|${maxHp}|${hunger}`;
    if (key === this.lastStats) return;
    this.lastStats = key;
    $('hpFill').style.width = `${Math.max(0, (hp / maxHp) * 100)}%`;
    $('hpText').textContent = `${Math.max(0, Math.ceil(hp))} / ${maxHp}`;
    $('hpBar').classList.toggle('low', hp / maxHp < 0.3);
    $('hungerFill').style.width = `${Math.max(0, hunger)}%`;
    $('hungerText').textContent = Math.ceil(hunger);
    $('hungerBar').classList.toggle('low', hunger < 25);
  }

  stamina(v) {
    const w = `${Math.max(0, (v / PLAYER.maxStamina) * 100).toFixed(1)}%`;
    if ($('stamFill').style.width !== w) $('stamFill').style.width = w;
  }

  coins(n) {
    $('coinText').textContent = n.toLocaleString('ko-KR');
  }

  setInv(inv, powers, coins) {
    this.coins(coins);
    const P = Object.entries(powers);
    $('powers').innerHTML = P.map(([id, n]) => `<div class="pw r-${POWERUPS[id].rarity}" title="${esc(POWERUPS[id].name)} — ${esc(POWERUPS[id].desc)}"><img src="${icon(`p_${id}`)}" alt="">${n > 1 ? `<b>${n}</b>` : ''}</div>`).join('');
    if (!$('craftPanel').hidden) this.renderCraft();
    if (!$('boatPanel').hidden) this.renderBoat();
  }

  hotbar(list, sel) {
    const inv = this.g.player.inv;
    const slot = (id, key, on) => {
      const I = ITEMS[id];
      let count = '';
      if (I.cat === 'food' || I.cat === 'place') count = inv[id];
      return `<div class="slot${on ? ' on' : ''}" title="${esc(I.name)}"><kbd>${key}</kbd><img src="${icon(id)}" alt="">${count !== '' ? `<b>${count}</b>` : ''}<span>${esc(I.name)}</span></div>`;
    };
    $('hotbar').innerHTML = slot('fist', '`', !sel) + list.map((id, i) => slot(id, i < 9 ? i + 1 : '', id === sel)).join('');
    $('hotbar').classList.toggle('many', list.length > 9);
  }

  clock(clock, day) {
    const cv = $('clockDial'), ctx = cv.getContext('2d'), R = 30;
    ctx.clearRect(0, 0, 64, 64);
    const dayA = (CYCLE.day / CYCLE_LEN) * Math.PI * 2, start = -Math.PI / 2;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#3b2a1a';
    ctx.beginPath(); ctx.moveTo(32, 32); ctx.arc(32, 32, R - 2, start, start + dayA); ctx.closePath(); ctx.fillStyle = '#ffd95a'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(32, 32); ctx.arc(32, 32, R - 2, start + dayA, start + Math.PI * 2); ctx.closePath(); ctx.fillStyle = '#3b4a86'; ctx.fill(); ctx.stroke();
    const a = start + (clock / CYCLE_LEN) * Math.PI * 2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(32 + Math.cos(a) * (R - 6), 32 + Math.sin(a) * (R - 6)); ctx.stroke();
    ctx.fillStyle = '#3b2a1a';
    ctx.beginPath(); ctx.arc(32, 32, 4, 0, 7); ctx.fill();
    const night = clock >= CYCLE.day;
    const left = night ? CYCLE_LEN - clock : CYCLE.day - clock;
    $('dayText').textContent = `${day}일째`;
    $('phaseText').textContent = `${night ? '밤' : '낮'} · ${night ? '아침' : '밤'}까지 ${Math.ceil(left)}초`;
    $('dayBox').classList.toggle('night', night);
  }

  team(roster, you) {
    $('teamList').innerHTML = [...roster.values()].map((r) => `<div class="tm${r.alive ? '' : ' dead'}${r.nid === you ? ' me' : ''}"><i style="background:${r.color}"></i>${esc(r.name)}${r.alive ? '' : `<img src="${icon('skull')}" alt="">`}</div>`).join('');
  }

  // ── 알림 ────────────────────────────────────────
  toast(text, kind = '') {
    const el = $('toast');
    el.textContent = text;
    el.className = `show ${kind}`;
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => { el.className = ''; }, 1800);
  }

  notice(title, sub = '', kind = '') {
    const el = $('notice');
    el.innerHTML = `<h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}`;
    el.className = kind;
    void el.offsetWidth;
    el.classList.add('show');
  }

  gain(items) {
    for (const [id, n] of Object.entries(items)) {
      if (!n) continue;
      const name = id === 'coin' ? '코인' : ITEMS[id] ? ITEMS[id].name : id;
      let row = this.feedRows.get(id);
      if (row && Date.now() - row.at < 2500) {
        row.n += n;
        row.at = Date.now();
        row.el.querySelector('b').textContent = `+${row.n}`;
        row.el.classList.remove('bump');
        void row.el.offsetWidth;
        row.el.classList.add('bump');
      } else {
        const el = document.createElement('div');
        el.className = 'fr';
        el.innerHTML = `<img src="${icon(id)}" alt=""><b>+${n}</b><span>${esc(name)}</span>`;
        $('feed').prepend(el);
        row = { el, n, at: Date.now() };
        this.feedRows.set(id, row);
      }
      clearTimeout(row.timer);
      const r = row;
      row.timer = setTimeout(() => {
        r.el.classList.add('out');
        setTimeout(() => r.el.remove(), 400);
        if (this.feedRows.get(id) === r) this.feedRows.delete(id);
      }, 2600);
    }
    while ($('feed').children.length > 6) $('feed').lastChild.remove();
  }

  prompt(text) {
    const el = $('prompt');
    if (!text) { if (!el.hidden) el.hidden = true; return; }
    if (el.textContent !== text) el.textContent = text;
    el.hidden = false;
  }

  hitmark() {
    const el = $('hitmark');
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  hurt(src, cam, yaw) {
    const v = $('vignette');
    v.classList.remove('show');
    void v.offsetWidth;
    v.classList.add('show');
    if (!src) return;
    const ang = Math.atan2(-(src[0] - cam.x), -(src[1] - cam.z)) - yaw;
    const d = document.createElement('div');
    d.className = 'hurtdir';
    d.style.transform = `translate(-50%, -50%) rotate(${-ang}rad) translateY(-130px)`;
    $('hurtDirs').appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  boss(info) {
    const el = $('bossBar');
    if (!info) { el.hidden = true; return; }
    el.hidden = false;
    $('bossName').textContent = info.name;
    $('bossFill').style.width = `${info.hp}%`;
  }

  final(sec) {
    const el = $('finalBar');
    el.hidden = sec < 0;
    if (sec >= 0) $('finalText').textContent = `출항까지 ${sec}초 — 버텨라!`;
  }

  dead(on, text = '') {
    $('deadScreen').hidden = !on;
    if (on) $('deadSub').textContent = text || '아침이 되면 캠프에서 다시 일어납니다.';
  }

  powerCard(id) {
    this.cardQueue.push(id);
    if (!this.cardBusy) this.nextCard();
  }

  nextCard() {
    const id = this.cardQueue.shift();
    if (!id) { this.cardBusy = false; return; }
    this.cardBusy = true;
    const P = POWERUPS[id], R = RARITY[P.rarity], el = $('powerCard');
    el.className = `r-${P.rarity}`;
    el.innerHTML = `<div class="pc-glow"></div><img src="${icon(`p_${id}`)}" alt=""><div class="pc-rar">${R.name}</div><h3>${esc(P.name)}</h3><p>${esc(P.desc)}</p>`;
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('show');
    this.g.sound.play(P.rarity);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { el.hidden = true; this.nextCard(); }, 300);
    }, 2400);
  }

  chat(m) {
    const row = document.createElement('div');
    row.className = `cl${m.sys ? ' sys' : ''}`;
    row.innerHTML = m.sys ? esc(m.text) : `<b style="color:${m.color}">${esc(m.name)}</b> ${esc(m.text)}`;
    $('chatLog').appendChild(row);
    while ($('chatLog').children.length > 8) $('chatLog').firstChild.remove();
    setTimeout(() => row.classList.add('old'), 9000);
  }

  // ── 미니맵 / 지도 ───────────────────────────────
  drawMap(ctx, size, cx, cz, radius, rotate, full) {
    const g = this.g, px = (x) => (x + HALF) / SIZE, k = size / (radius * 2);
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    if (!full) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.fillStyle = '#3fa0d6';
    ctx.fillRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);
    if (rotate) ctx.rotate(g.player.yaw);
    ctx.scale(k, k);
    ctx.translate(-cx, -cz);
    ctx.imageSmoothingEnabled = true;
    if (this.mapImg) ctx.drawImage(this.mapImg, -HALF, -HALF, SIZE, SIZE);
    const W = g.world;
    const dot = (x, z, r, color, stroke = '#2b1d14') => {
      ctx.beginPath();
      ctx.arc(x, z, r / k, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1.5 / k;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    };
    const square = (x, z, s, color) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = '#2b1d14';
      ctx.lineWidth = 1.5 / k;
      ctx.fillRect(x - s / k, z - s / k, (s * 2) / k, (s * 2) / k);
      ctx.strokeRect(x - s / k, z - s / k, (s * 2) / k, (s * 2) / k);
    };
    for (const c of W.chests) if (!c.opened && (full || Math.hypot(c.x - cx, c.z - cz) < radius * 1.5)) square(c.x, c.z, full ? 3.5 : 3, c.gold ? '#ffd23f' : '#b5773b');
    for (const s of W.structs.values()) square(s.x, s.z, 2, '#e9e1d0');
    if (W.boat && g.mode === 'escape') {
      dot(W.boat.x, W.boat.z, full ? 8 : 6, W.boat.ready ? '#ffe066' : '#8b5a2b', '#fff');
    }
    for (const e of g.enemies.values()) {
      if (e.dead) continue;
      if (!full && Math.hypot(e.pos.x - cx, e.pos.z - cz) > radius * 1.5) continue;
      if (e.type === 'pig') dot(e.pos.x, e.pos.z, 2.5, '#f2a3b1');
      else dot(e.pos.x, e.pos.z, e.E.boss ? 7 : 3, e.E.boss ? '#b00020' : '#ff4d4d');
    }
    for (const p of g.players.values()) if (p.state.alive) dot(p.state.x, p.state.z, 5, p.color, '#fff');
    ctx.restore();
    // 나
    ctx.save();
    ctx.translate(size / 2 + (full ? (g.player.body.x - cx) * k : 0), size / 2 + (full ? (g.player.body.z - cz) * k : 0));
    if (full) ctx.rotate(-g.player.yaw);
    ctx.fillStyle = g.player.color;
    ctx.strokeStyle = '#2b1d14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(7, 7); ctx.lineTo(0, 3); ctx.lineTo(-7, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  frame(dt) {
    const g = this.g;
    this.mmT -= dt;
    if (this.mmT <= 0 && g.world) {
      this.mmT = 0.1;
      const cv = $('minimap');
      this.drawMap(cv.getContext('2d'), cv.width, g.player.body.x, g.player.body.z, 55, true, false);
      if (!$('mapPanel').hidden) {
        const big = $('bigMap');
        this.drawMap(big.getContext('2d'), big.width, 0, 0, HALF, false, true);
      }
    }
    this.clock(g.clock, g.day);
    let boss = null;
    for (const e of g.enemies.values()) if (!e.dead && e.E.boss) { boss = { name: e.E.name, hp: e.hp }; break; }
    this.boss(boss);
  }

  // ── 제작 ────────────────────────────────────────
  renderCraft() {
    const g = this.g, inv = g.player.inv, bench = g.nearBench(), lv = bench ? bench.lv : 0, fire = g.nearFire();
    const enough = (cost) => Object.entries(cost).every(([k, v]) => (inv[k] || 0) >= v);
    const costHtml = (cost) => Object.entries(cost).map(([k, v]) => `<span class="cost ${(inv[k] || 0) >= v ? 'ok' : 'no'}"><img src="${icon(k)}" alt="">${inv[k] || 0}/${v}</span>`).join('');

    // 작업대 단계와 강화
    const pips = [1, 2, 3, 4].map((k) => `<i class="${k <= lv ? 'on' : ''}">${k}</i>`).join('');
    const info = `<div class="bench-info"><img src="${icon('workbench')}" alt=""><div><b>${lv}단계 작업대</b><div class="pips">${pips}</div></div></div>`;
    if (!bench) {
      $('benchBox').innerHTML = `<div class="bench-info wide"><img src="${icon('workbench')}" alt=""><div><b>근처에 작업대가 없어요</b><small>나무 15개로 작업대를 만들어 땅에 놓고, 가까이 서서 제작 창을 여세요.</small></div></div>`;
    } else if (lv < BENCH_MAX) {
      const next = BENCH[lv + 1];
      $('benchBox').innerHTML = `${info}<div class="bench-up"><div><b>${lv + 1}단계로 강화하면</b><small>${esc(next.unlock)}</small><div class="rc-costs">${costHtml(next.cost)}</div></div><button class="btn green" data-upgrade="${bench.id}" ${enough(next.cost) ? '' : 'disabled'}><img src="${icon('up')}" alt="">강화</button></div>`;
    } else {
      $('benchBox').innerHTML = `${info}<div class="bench-up max"><b>최고 단계! 모든 장비를 만들 수 있어요</b></div>`;
    }

    // 가방 · 능력
    const owned = Object.keys(inv).filter((k) => inv[k] > 0 && ITEMS[k]);
    owned.sort((a, b) => (INV_ORDER.indexOf(a) + 1 || 99) - (INV_ORDER.indexOf(b) + 1 || 99));
    $('invGrid').innerHTML = owned.length
      ? owned.map((id) => `<div class="ic" title="${esc(ITEMS[id].name)} — ${esc(ITEMS[id].desc || '')}"><img src="${icon(id)}" alt=""><b>${inv[id]}</b></div>`).join('')
      : '<p class="empty">가방이 비었습니다. 나무부터 베어 보세요!</p>';
    const P = g.player.powers;
    $('powerList').innerHTML = Object.keys(P).length
      ? Object.entries(P).map(([id, n]) => `<div class="pl r-${POWERUPS[id].rarity}"><img src="${icon(`p_${id}`)}" alt=""><div><b>${esc(POWERUPS[id].name)}${n > 1 ? ` ×${n}` : ''}</b><small>${esc(POWERUPS[id].desc)}</small></div></div>`).join('')
      : '<p class="empty">상자를 열어 능력을 모으세요.</p>';

    // 만들 수 있는 것 / 잠긴 것 — 이미 같거나 더 좋은 장비를 가졌으면 뺀다
    const best = {};
    for (const id of owned) {
      const [k, r] = rank(ITEMS[id]);
      if (k) best[k] = Math.max(best[k] || 0, r);
    }
    const open = [], locked = new Map();
    for (const R of RECIPES) {
      const [k, r] = rank(ITEMS[R.id]);
      if (k && best[k] >= r) continue;
      const need = R.lv > lv ? `${R.lv}단계 작업대` : R.fire && !fire ? '모닥불 근처' : '';
      if (!need) open.push(R);
      else locked.set(need, [...(locked.get(need) || []), R]);
    }
    const card = (R) => {
      const I = ITEMS[R.id], ok = enough(R.cost), ownedN = inv[R.id] || 0;
      return `<div class="rc${ok ? ' can' : ''}" data-r="${R.id}">
        <img class="rc-icon" src="${icon(R.id)}" alt="">
        <div class="rc-info"><b>${esc(I.name)}${R.n ? ` ×${R.n}` : ''}</b>${ownedN ? `<em>보유 ${ownedN}</em>` : ''}<small>${esc(I.desc || '')}</small><div class="rc-costs">${costHtml(R.cost)}</div></div>
        <button class="btn small" ${ok ? '' : 'disabled'}>제작</button></div>`;
    };
    $('recipeList').innerHTML = SECTIONS.map(([sec, title]) => {
      const list = open.filter((R) => R.sec === sec);
      return list.length ? `<h4 class="sec">${title}</h4>${list.map(card).join('')}` : '';
    }).join('') || '<p class="empty">지금 만들 수 있는 것이 없어요.</p>';
    $('lockedList').innerHTML = [...locked].map(([need, list]) => `<div class="lk"><span><img src="${icon('lock')}" alt="">${esc(need)}</span>${list.map((R) => `<img src="${icon(R.id)}" alt="" title="${esc(ITEMS[R.id].name)}">`).join('')}</div>`).join('');
  }

  // ── 배 수리 ─────────────────────────────────────
  renderBoat() {
    const g = this.g, W = g.world, inv = g.player.inv;
    if (!W || !W.boat) return;
    const parts = W.boat.parts;
    let allDone = true;
    $('boatParts').innerHTML = BOAT_PARTS.map((part) => {
      const prog = parts[part.id] || {};
      const entries = Object.entries(part.cost);
      const total = entries.reduce((s, [, v]) => s + v, 0), have = entries.reduce((s, [k, v]) => s + Math.min(v, prog[k] || 0), 0);
      const done = have >= total;
      if (!done) allDone = false;
      return `<div class="bp${done ? ' done' : ''}"><h4>${esc(part.name)}${done ? ' ✔' : ''}</h4>
        ${entries.map(([k, v]) => `<div class="bp-row"><img src="${icon(k)}" alt=""><span>${esc(ITEMS[k].name)}</span><div class="bp-bar"><i style="width:${Math.min(100, ((prog[k] || 0) / v) * 100)}%"></i></div><b>${prog[k] || 0}/${v}</b><small>가방 ${inv[k] || 0}</small></div>`).join('')}
      </div>`;
    }).join('');
    $('boatDeposit').hidden = allDone;
    $('boatLaunch').hidden = !allDone || g.final >= 0;
    $('boatHint').textContent = allDone
      ? (g.final >= 0 ? '출항 준비 중! 끝까지 살아남으세요.' : '수리가 끝났습니다! 출항하면 80초 동안 최후의 습격이 몰려옵니다. 모두 준비되면 출항하세요.')
      : '재료를 가지고 오면 [재료 넣기]로 한꺼번에 넣습니다. 친구들과 함께 모으세요.';
  }

  // ── 결과 ────────────────────────────────────────
  results(m, isHost) {
    const el = $('results');
    $('resTitle').textContent = m.victory ? '탈출 성공!' : '전멸…';
    $('resTitle').className = m.victory ? 'win' : 'lose';
    $('resSub').textContent = m.victory ? `${m.day}일 만에 섬을 탈출했습니다` : `${m.day}일째에 모두 쓰러졌습니다`;
    const rows = [...m.stats].sort((a, b) => b.kills - a.kills);
    $('resTable').innerHTML = `<tr><th>생존자</th><th>처치</th><th>피해</th><th>채집</th><th>상자</th></tr>` +
      rows.map((r) => `<tr><td><i style="background:${r.color}"></i>${esc(r.name)}</td><td>${r.kills}</td><td>${r.dmg}</td><td>${r.gathered}</td><td>${r.chests}</td></tr>`).join('');
    $('resAgain').hidden = !isHost;
    $('resWait').hidden = isHost;
    el.hidden = false;
  }
}
