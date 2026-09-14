// 무인도 서바이벌 서버 — 정적 파일 + socket.io 방 관리
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { Room } from './server/room.js';
import { MODES, DIFFICULTY, ROOM_MAX } from './public/shared/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || Number(process.argv[2]) || 3040;
const log = (...a) => console.log(`[${new Date().toLocaleTimeString('ko-KR', { hour12: false })}]`, ...a);

process.on('uncaughtException', (err) => console.error('처리되지 않은 오류 (서버는 계속 실행):', err));
process.on('unhandledRejection', (err) => console.error('처리되지 않은 Promise 오류 (서버는 계속 실행):', err));

const app = express();
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, file) => {
    if (/\.(js|html|css)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
  },
}));
app.get('/healthz', (_req, res) => res.send('ok'));

const server = http.createServer(app);
const io = new Server(server, { pingInterval: 15000, pingTimeout: 45000, cors: { origin: true }, maxHttpBufferSize: 1e5 });

/** @type {Map<string, Room>} */
const rooms = new Map();
const reply = (cb, payload) => { if (typeof cb === 'function') cb(payload); };

function closeIfEmpty(r) {
  if (r.members.size || !rooms.has(r.code)) return;
  r.destroy();
  rooms.delete(r.code);
  log(`방 닫힘 ${r.code}`);
}

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do code = Array.from({ length: 4 }, () => A[crypto.randomInt(A.length)]).join('');
  while (rooms.has(code));
  return code;
}

io.on('connection', (socket) => {
  /** @type {Room|null} */
  let room = null;

  const on = (ev, fn) => socket.on(ev, (...args) => {
    const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
    const msg = args[0] && typeof args[0] === 'object' ? args[0] : {};
    try {
      fn(msg, cb);
    } catch (err) {
      console.error(`[${ev}] 처리 오류:`, err);
      reply(cb, { ok: false, error: '서버 오류가 났습니다.' });
    }
  });

  const leave = () => {
    if (!room) return;
    const r = room;
    room = null;
    r.remove(socket.id);
    closeIfEmpty(r);
  };

  on('rooms', (_m, cb) => reply(cb, [...rooms.values()].filter((r) => r.opts.isPublic).map((r) => r.summary())));

  on('create', (m, cb) => {
    leave();
    const code = newCode();
    room = new Room(io, code, {
      mode: MODES[m.mode] ? m.mode : 'escape',
      difficulty: DIFFICULTY[m.difficulty] ? m.difficulty : 'normal',
      isPublic: m.isPublic !== false,
    });
    room.onEmpty = closeIfEmpty;
    rooms.set(code, room);
    const me = room.add(socket, m.name, m.color, m.token);
    log(`방 생성 ${code}`);
    reply(cb, { ok: true, you: me.nid, lobby: room.lobbyInfo() });
  });

  on('join', (m, cb) => {
    const r = rooms.get(String(m.code || '').toUpperCase().trim());
    if (!r) return reply(cb, { ok: false, error: '그런 코드의 방이 없습니다.' });
    if (r === room) return reply(cb, { ok: false, error: '이미 이 방에 있습니다.' });
    const back = r.resume(socket, m.token);
    if (back) {
      leave();
      room = r;
      return reply(cb, { ok: true, you: back.nid, lobby: r.lobbyInfo() });
    }
    if (r.members.size >= ROOM_MAX) return reply(cb, { ok: false, error: `방이 가득 찼습니다. (최대 ${ROOM_MAX}명)` });
    leave();
    room = r;
    const me = r.add(socket, m.name, m.color, m.token);
    reply(cb, { ok: true, you: me.nid, lobby: r.lobbyInfo() });
  });

  on('resume', (m, cb) => {
    const r = rooms.get(String(m.code || '').toUpperCase().trim());
    const me = r && r.resume(socket, m.token);
    if (!me) return reply(cb, { ok: false, error: '방이 닫혔거나 자리가 없어져서 다시 들어가지 못했습니다.' });
    if (room && room !== r) leave();
    room = r;
    log(`[${r.code}] ${me.name} 재접속`);
    reply(cb, { ok: true, you: me.nid, lobby: r.lobbyInfo() });
  });
  on('leave', leave);
  on('opts', (m) => room && room.setOpts(socket.id, m));
  on('color', (m) => room && room.setColor(socket.id, m.color));
  on('start', () => room && room.start(socket.id));
  on('tolobby', () => room && room.backToLobby(socket.id));
  on('chat', (m) => room && room.chat(socket.id, m.text));
  for (const ev of ['input', 'attack', 'gather', 'craft', 'upgrade', 'place', 'door', 'bed', 'eat', 'chest', 'boat', 'launch']) {
    socket.on(ev, (msg) => {
      if (!room) return;
      try {
        room.onGame(socket.id, ev, msg);
      } catch (err) {
        console.error(`[${room.code}] ${ev} 처리 오류:`, err);
      }
    });
  }
  socket.on('disconnect', (reason) => {
    if (!room) return;
    const r = room;
    room = null;
    log(`[${r.code}] 연결 끊김 (${reason})`);
    try { r.drop(socket.id); } catch (err) { console.error('퇴장 처리 오류:', err); }
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ${PORT} 포트를 이미 다른 프로그램이 쓰고 있습니다. 서버가 이미 켜져 있는지 확인하세요.\n`);
    process.exit(2);
  }
  console.error('서버 오류:', err);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  무인도 서바이벌 서버 실행 중');
  console.log(`  내 컴퓨터:   http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      const ip = a.address;
      const label = ip.startsWith('25.') ? '하마치(Hamachi)' : /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ? '같은 공유기' : '인터넷(공인 IP)';
      console.log(`  ${label}: http://${ip}:${PORT}`);
    }
  }
  console.log('');
});
