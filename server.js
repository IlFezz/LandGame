// Server di Atlas (basato sul Basic Land Game): file statici + WebSocket (implementato a mano, zero dipendenze).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { Hub } = require('./hub');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff': 'font/woff',
  '.wasm': 'application/wasm', '.pck': 'application/octet-stream',
};
// Versione compressa dei file grandi (il gioco Godot nel browser: /gioco/), preparata una volta sola.
const gzCache = new Map();
function gzipped(file, data, etag) {
  const hit = gzCache.get(file);
  if (hit && hit.etag === etag) return hit.data;
  const z = zlib.gzipSync(data, { level: 9 });
  gzCache.set(file, { etag, data: z });
  return z;
}

// ---------- HTTP statico ----------
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (url === '/') url = '/index.html';
  if (url === '/gioco') { res.writeHead(301, { Location: '/gioco/' }); return res.end(); }
  if (url.endsWith('/')) url += 'index.html';
  // motore, computer e stanze stanno nella radice perché li usa anche il server
  const shared = ['/game.js', '/bot.js', '/hub.js'].includes(url);
  const file = shared ? path.join(__dirname, url) : path.normalize(path.join(PUBLIC, url));
  if (!shared && !file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file);
    // Il codice dell'app va sempre ricontrollato (con ETag, quindi senza riscaricarlo se non è cambiato);
    // solo le icone possono restare in cache.
    const etag = '"' + crypto.createHash('sha1').update(data).digest('base64').slice(0, 16) + '"';
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.png' || ext === '.woff' ? 'public, max-age=86400' : 'no-cache',
      ETag: etag,
    };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
    const big = data.length > 100000 && ['.wasm', '.pck', '.js'].includes(ext);
    if (big && /gzip/.test(req.headers['accept-encoding'] || '')) {
      headers['Content-Encoding'] = 'gzip';
      headers.Vary = 'Accept-Encoding';
      res.writeHead(200, headers);
      return res.end(gzipped(file, data, etag));
    }
    res.writeHead(200, headers);
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

// ---------- Stanze (la logica è in hub.js, condivisa con il browser) ----------
const hub = new Hub({ timeScale: Number(process.env.TIME_SCALE || 1) });

function handleConnection(conn) {
  conn.onmessage = (m) => hub.message(conn, m);
  conn.onclose = () => hub.close(conn);
}

// Keep-alive e pulizia stanze inattive (2 ore)
setInterval(() => hub.sweep(), 25000).unref();

server.listen(PORT, () => console.log(`Atlas in ascolto su http://localhost:${PORT}`));
