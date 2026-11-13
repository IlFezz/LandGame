// Server del Basic Land Game: file statici + WebSocket (implementato a mano, zero dipendenze).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Game } = require('./game');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

// ---------- HTTP statico ----------
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' || file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(data);
  });
});

// ---------- WebSocket minimale (RFC 6455) ----------
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function encodeFrame(str, opcode = 1) {
  const payload = Buffer.from(str);
  const len = payload.length;
  let header;
  if (len < 126) header = Buffer.from([0x80 | opcode, len]);
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, payload]);
}

class Conn {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.frags = [];
    this.alive = true;
    this.closed = false;
    this.onmessage = null;
    this.onclose = null;
    socket.on('data', (d) => this.onData(d));
    socket.on('close', () => this.handleClose());
    socket.on('error', () => this.handleClose());
  }
  send(obj) {
    if (this.closed) return;
    try { this.socket.write(encodeFrame(JSON.stringify(obj))); } catch { this.handleClose(); }
  }
  ping() { if (!this.closed) try { this.socket.write(encodeFrame('', 9)); } catch {} }
  close() { if (!this.closed) { try { this.socket.write(encodeFrame('', 8)); this.socket.end(); } catch {} } this.handleClose(); }
  handleClose() {
    if (this.closed) return;
    this.closed = true;
    try { this.socket.destroy(); } catch {}
    if (this.onclose) this.onclose();
  }
  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    if (this.buf.length > 1 << 20) return this.close(); // messaggi troppo grandi
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0, opcode = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      const maskOff = off;
      if (masked) off += 4;
      if (this.buf.length < off + len) return;
      let payload = this.buf.subarray(off, off + len);
      if (masked) {
        const mask = this.buf.subarray(maskOff, maskOff + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      this.buf = this.buf.subarray(off + len);
      this.alive = true;
      if (opcode === 8) return this.close();
      if (opcode === 9) { try { this.socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); } catch {} continue; }
      if (opcode === 10) continue;
      if (opcode === 1 || opcode === 0) {
        this.frags.push(payload);
        if (fin) {
          const text = Buffer.concat(this.frags).toString('utf8');
          this.frags = [];
          let msg;
          try { msg = JSON.parse(text); } catch { continue; }
          if (this.onmessage) this.onmessage(msg);
        }
      }
    }
  }
}

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  handleConnection(new Conn(socket));
});

// ---------- Stanze ----------
const rooms = new Map(); // code -> room
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode() {
  let code;
  do { code = Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join(''); } while (rooms.has(code));
  return code;
}
const newToken = () => crypto.randomBytes(16).toString('hex');
const cleanName = (n) => (String(n || '').trim().slice(0, 20) || 'Giocatore');

function broadcast(room) {
  room.touched = Date.now();
  room.seats.forEach((s, i) => {
    if (!s || !s.conn) return;
    const base = {
      t: 'state', code: room.code, seat: i,
      seats: room.seats.map((x) => (x ? { name: x.name, connected: !!x.conn } : null)),
      rematch: room.rematch.slice(),
    };
    base.game = room.game ? room.game.view(i) : null;
    s.conn.send(base);
  });
}

function startGame(room) {
  room.game = new Game([room.seats[0].name, room.seats[1].name]);
  room.rematch = [false, false];
}

function attach(conn, room, seat) {
  const s = room.seats[seat];
  if (s.conn && s.conn !== conn) s.conn.close(); // sessione precedente sostituita
  s.conn = conn;
  conn.room = room; conn.seat = seat;
  conn.send({ t: 'joined', code: room.code, seat, token: s.token });
  broadcast(room);
}

function handleConnection(conn) {
  conn.onmessage = (m) => {
    if (!m || typeof m !== 'object') return;
    const err = (msg) => conn.send({ t: 'error', msg });

    if (m.t === 'create') {
      const code = newCode();
      const room = { code, seats: [{ name: cleanName(m.name), token: newToken(), conn: null }, null], game: null, rematch: [false, false], touched: Date.now() };
      rooms.set(code, room);
      return attach(conn, room, 0);
    }
    if (m.t === 'join') {
      const room = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!room) return err('Stanza non trovata. Controlla il codice.');
      if (m.token) { // rientro con il proprio token
        const seat = room.seats.findIndex((s) => s && s.token === m.token);
        if (seat !== -1) return attach(conn, room, seat);
      }
      if (room.seats[1]) return err('La stanza è già piena.');
      room.seats[1] = { name: cleanName(m.name), token: newToken(), conn: null };
      startGame(room);
      return attach(conn, room, 1);
    }

    const room = conn.room;
    if (!room) return err('Non sei in una stanza.');
    if (m.t === 'action') {
      if (!room.game) return err('La partita non è ancora iniziata.');
      const e = room.game.act(conn.seat, m.a);
      if (e) err(e);
      return broadcast(room);
    }
    if (m.t === 'rematch') {
      if (!room.game || room.game.phase !== 'over') return;
      room.rematch[conn.seat] = true;
      if (room.rematch.every(Boolean)) startGame(room);
      return broadcast(room);
    }
    if (m.t === 'leave') {
      const seat = conn.seat;
      room.seats[seat].conn = null;
      conn.room = null;
      if (!room.game) { rooms.delete(room.code); }
      else broadcast(room);
      return;
    }
  };
  conn.onclose = () => {
    const room = conn.room;
    if (!room) return;
    const s = room.seats[conn.seat];
    if (s && s.conn === conn) { s.conn = null; broadcast(room); }
  };
}

// Keep-alive e pulizia stanze inattive (2 ore)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyone = room.seats.some((s) => s && s.conn);
    if (!anyone && now - room.touched > 2 * 3600 * 1000) rooms.delete(code);
    for (const s of room.seats) if (s && s.conn) s.conn.ping();
  }
}, 25000).unref();

server.listen(PORT, () => console.log(`Basic Land Game in ascolto su http://localhost:${PORT}`));
