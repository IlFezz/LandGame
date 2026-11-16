'use strict';
// =====================================================================
//  Grafica avanzata: il tavolo come una scena unica disegnata dalla scheda grafica (WebGL2).
//
//  La pagina resta com'è e continua a decidere DOVE stanno le cose e a ricevere i tocchi:
//  le carte della pagina diventano invisibili e fanno da "ancore". A ogni fotogramma la scena
//  legge la posizione delle ancore e disegna, in un solo canvas dietro l'interfaccia:
//  il tavolo illuminato, le ombre, le carte (con la tavola animata), i voli e la carta trascinata.
//  Nessuna copia di immagini tra canvas: tutto resta sulla scheda grafica.
// =====================================================================
const Scene = (() => {
  const L = ATL.L, COARSE = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  const VAR = { full: [0.625, 0.598, 0.75, 0.098, true], compact: [0.66, 0.633, 0.805, 0.112, false], mini: [0.82, 0.784, 0, 0, false], mininame: [0.705, 0.675, 0.86, 0.09, false] };
  let cv, gl, P = {}, vaoGrid, vaoNone, nIdx = 0, on = false, ready = false, raf = 0, frame = 0, t0 = performance.now();
  let W = 0, H = 0, scale = 1, maxScale = 1;
  const img = {}, tex = {}, faces = new Map();
  let fontsOk = false, backId = null;
  const sprites = new Map(), flyers = [], ripples = [];
  const tilt = [0, 0], aim = [0, 0];
  let roseAng = 0, roseTgt = 0, tint = [0, 0, 0], tintA = 0, busyUntil = 0;
  let dragS = null, lastT = 0, seen = 0, slow = 0, strikes = 0, onSlow = null, theme = null;
  const stats = { ms: 0, n: 0 };

  // ---------------- shader ----------------
  const NOISE = `uniform sampler2D N;
float n(vec2 p){ return texture(N, p / 64.).r; }
float fbm(vec2 p){ return n(p) * .6 + n(p * 2.1 + 3.7) * .3 + n(p * 4.3 + 9.1) * .1; }
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`;
  const SDF = `float sdr(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }`;

  // il tavolo: gradiente, curve di livello (che si increspano), rosa dei venti, lampada, ombra di nuvola
  const TABLE_FS = `#version 300 es
precision highp float;
${NOISE}
uniform sampler2D TOPO, ROSE;
uniform vec2 res; uniform float t, px1;
uniform vec3 colA, colB, lineC, tint; uniform float lineA, tintA, night;
uniform vec4 rose; uniform float roseAng;
uniform vec4 rip[3]; uniform vec3 ripC[3];
in vec2 v; out vec4 o;
void main(){
  vec2 px = v * res;
  vec2 uc = (px - .5 * res) / res.y;
  float g = length((v - vec2(.5, .38)) / vec2(1.2, .9));
  vec3 col = mix(colA, colB, smoothstep(0., 1., g));
  vec2 tp = px; float glow = 0.; vec3 gc = vec3(0.);
  for (int i = 0; i < 3; i++) {
    float age = rip[i].z;
    if (age < 0. || age > 2.2) continue;
    vec2 dv = px - rip[i].xy; float d = length(dv) / px1;
    float ph = d - age * 520.;
    float env = exp(-ph * ph / 9000.) * (1. - age / 2.2) * rip[i].w;
    float w = sin(ph * .09) * env;
    tp += normalize(dv + .001) * w * 14. * px1;
    glow += env; gc += ripC[i] * env;
  }
  vec2 tu = tp / res; float ra = res.x / res.y;
  if (ra > .55) tu.y = (tu.y - .5) * (.55 / ra) + .5; else tu.x = (tu.x - .5) * (ra / .55) + .5;
  float line = texture(TOPO, tu).a;
  col = mix(col, lineC, clamp(line * lineA * (1. + glow * 6.), 0., 1.));
  col += gc * glow * .16;
  vec2 rr = (px - rose.xy) / rose.z; float cs = cos(roseAng), sn = sin(roseAng);
  rr = vec2(rr.x * cs + rr.y * sn, -rr.x * sn + rr.y * cs);
  if (abs(rr.x) < .5 && abs(rr.y) < .5) col = mix(col, mix(lineC, tint, tintA * .6), texture(ROSE, rr + .5).a * rose.w);
  vec2 lp = (px - rose.xy) / res.y;
  float lamp = exp(-dot(lp, lp) * 2.6);
  col += mix(vec3(1., .93, .75), tint, tintA * .7) * lamp * (.07 + .07 * night + tintA * .1);
  float cl = fbm(uc * 2.2 + vec2(t * .012, t * .005));
  col *= 1. - smoothstep(.5, .78, cl) * (.2 * night + .07);
  col *= 1. - smoothstep(.35, 1.05, length(uc * vec2(.85, 1.))) * (.5 * night + .12);
  col += (texture(N, px / (px1 * 3.1)).g - .5) * .022;
  o = vec4(col, 1.);
}`;
  const TABLE_VS = `#version 300 es
out vec2 v;
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); v = vec2(p.x, 1. - p.y); gl_Position = vec4(p * 2. - 1., 0., 1.); }`;

  // ombra morbida e anello luminoso sotto ogni carta
  const HALO_VS = `#version 300 es
uniform vec2 res, c, sz; uniform float rot, margin;
out vec2 l;
void main(){ vec2 q = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1)) - .5; l = q * (sz + margin * 2.);
  float cs = cos(rot), sn = sin(rot); vec2 p = c + vec2(l.x * cs - l.y * sn, l.x * sn + l.y * cs);
  gl_Position = vec4((p / res * 2. - 1.) * vec2(1., -1.), 0., 1.); }`;
  const HALO_FS = `#version 300 es
precision highp float;
${SDF}
uniform vec2 sz, soff; uniform float rad, blur, sa, rw; uniform vec4 ring;
in vec2 l; out vec4 o;
void main(){
  float ds = sdr(l - soff, sz * .5, rad);
  float sh = (1. - smoothstep(-blur, blur, ds)) * sa;
  float d = sdr(l, sz * .5, rad);
  float rg = (1. - smoothstep(rw, rw + 1.5, d)) + .5 * exp(-max(d - rw, 0.) / (rw * 2.2 + 1.));
  float ra = clamp(rg, 0., 1.) * ring.a;
  o = vec4(ring.rgb * ra, ra + sh * (1. - ra));
}`;

  // la carta: una griglia che può inclinarsi e piegarsi; nel riquadro della tavola lo shader anima la terra
  const CARD_VS = `#version 300 es
layout(location = 0) in vec2 a;
uniform vec2 res, c, sz; uniform vec4 r;
out vec2 uv;
void main(){
  uv = a + .5;
  vec3 p = vec3(a * sz, r.w * sz.x * (1. - 4. * a.x * a.x));
  float cx = cos(r.y), sx = sin(r.y), cy = cos(r.z), sy = sin(r.z);
  p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
  p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
  float cz = cos(r.x), sz2 = sin(r.x);
  p.xy = vec2(p.x * cz - p.y * sz2, p.x * sz2 + p.y * cz);
  vec2 s = c + p.xy * (900. / (900. - p.z));
  gl_Position = vec4((s / res * 2. - 1.) * vec2(1., -1.), 0., 1.);
}`;
  const CARD_FS = `#version 300 es
precision highp float;
${NOISE}
${SDF}
uniform sampler2D F, M, B;
uniform float t, alpha, dim, flash, onlyBack; uniform int land;
uniform vec4 art, r; uniform vec2 crop, tilt; uniform vec3 tcol;
in vec2 uv; out vec4 o;
vec3 landCol(vec2 v){
  vec2 q = v * vec2(1., .92), pl = tilt * .016, ph = tilt * .08; vec3 c;
  if (land == 0) {
    vec2 w = vec2(n(q * 5. + vec2(t * .5, 0.)), n(q * 5. + vec2(4., t * .4))) - .5;
    c = texture(M, v + pl + w * .012).rgb;
    float gust = n(vec2(q.x * 2.4 + q.y * 1.6 - t * .5, q.y * 6.));
    c *= 1. + (gust - .5) * .34;
    c *= 1. - smoothstep(.5, .75, fbm(q * 1.7 + vec2(t * .05, t * .02) + ph)) * .3;
    c += smoothstep(.12, .3, c.b - c.r) * .5 * smoothstep(.6, 1., n(q * 40. + vec2(t * 1.4, 0.)));
  } else if (land == 1) {
    vec3 b0 = texture(M, v + pl).rgb; float m = smoothstep(.04, .2, b0.b - b0.r);
    vec2 d = vec2(sin(q.y * 34. + t * 2. + q.x * 9.), cos(q.x * 30. - t * 1.7 + q.y * 7.)) * .007 * m;
    c = texture(M, v + pl + d).rgb;
    float rr = length(q - vec2(.5, .46));
    c += m * .13 * sin(rr * 62. - t * 2.6);
    c += m * .55 * smoothstep(.62, .8, n(q * 30. + vec2(t * .9, -t * .6)) * n(q * 11. - t * .3 + 2.) * 1.7);
    c *= 1. - smoothstep(.55, .85, fbm(q * 1.5 + vec2(-t * .04, t * .015) + ph)) * .18;
  } else if (land == 2) {
    vec2 d = vec2(sin(q.y * 30. + t * .9), cos(q.x * 28. - t * .8)) * .003;
    c = texture(M, v + pl + d).rgb;
    float f = fbm(q * 2.3 + vec2(t * .07, -t * .045) + ph), f2 = fbm(q * 3.4 + vec2(-t * .05, t * .03) + ph * 1.4 + 5.);
    c = mix(c, vec3(.8, .76, .92), smoothstep(.4, .8, f) * .5 + smoothstep(.5, .85, f2) * .22);
    float g = 0.;
    for (int i = 0; i < 4; i++) { float k = float(i);
      vec2 w = (i == 0 ? vec2(.34, .44) : i == 1 ? vec2(.66, .38) : i == 2 ? vec2(.5, .88) : vec2(.88, .86)) + .03 * vec2(sin(t * .7 + k * 2.1), cos(t * .9 + k * 1.3));
      vec2 e = q - w; g += exp(-dot(e, e) * 420.) * (.4 + .6 * sin(t * 2.2 + k * 1.7)); }
    c += vec3(.5, 1., .72) * g;
  } else if (land == 3) {
    vec2 cc = vec2(.535, .432); float rr = length(q - cc);
    c = texture(M, v + pl + vec2(sin(q.y * 60. - t * 5.), 0.) * .004 * smoothstep(.34, 0., rr)).rgb;
    float hot = smoothstep(.3, .7, c.g) * step(.6, c.r);
    c += hot * vec3(.42, .18, 0.) * (.5 + .5 * sin(t * 1.8 - rr * 16.));
    c += hot * vec3(.4, .22, .06) * n(q * 15. + vec2(t * .3, -t * 1.1));
    c += vec3(.5, .16, .04) * exp(-rr * rr * 30.) * (.35 + .25 * sin(t * 1.8));
    for (int i = 0; i < 7; i++) { float k = float(i), life = fract(t * .2 + k * .143);
      vec2 e = q - (cc + vec2((h(vec2(k, 1.)) - .5) * .34 + sin(life * 7. + k) * .03, .05 - life * .52));
      c += vec3(1., .66, .25) * exp(-dot(e, e) * 5200.) * (1. - life) * 1.8; }
    c = mix(c, vec3(.13, .09, .11), smoothstep(.5, .85, fbm(q * 3. + vec2(t * .07, t * .12) + ph)) * .42 * smoothstep(.62, .1, rr));
  } else {
    vec3 b0 = texture(M, v + pl).rgb; float m = smoothstep(0., .08, b0.g - max(b0.r, b0.b));
    vec2 w = (vec2(n(q * 9. + vec2(t * .6, 0.)), n(q * 9. + vec2(3., t * .5))) - .5) * .018 * m;
    c = texture(M, v + pl + w).rgb;
    c *= .78 + fbm(q * 3.2 + vec2(t * .08, -t * .05) + ph) * .46;
    c += smoothstep(.1, .25, c.b - c.r) * step(c.g * .95, c.b) * .5 * smoothstep(.6, 1., n(q * 50. + vec2(t, t * .4)));
    for (int i = 0; i < 5; i++) { float k = float(i);
      vec2 e = q - (vec2(.58, .4) + .14 * vec2(sin(t * .31 + k * 1.9) + .4 * sin(t * .83 + k), cos(t * .27 + k * 2.3)));
      c += vec3(1., .95, .5) * exp(-dot(e, e) * 8000.) * (.5 + .5 * sin(t * 2.3 + k * 2.)); }
  }
  return c;
}
void main(){
  vec2 p = uv; vec3 col;
  bool back = gl_FrontFacing || onlyBack > .5;   // con l'asse y verso il basso il davanti risulta "dietro"
  if (back) { if (gl_FrontFacing) p.x = 1. - p.x; col = texture(B, p).rgb; }
  else {
    vec4 f = texture(F, p); col = f.rgb;
    if (f.a < .995 && p.x > art.x && p.x < art.z && p.y > art.y && p.y < art.w) {
      vec2 v = ((p - art.xy) / (art.zw - art.xy) - .5) * crop + .5;
      col = mix(landCol(v), f.rgb, f.a);
    }
  }
  float d = sdr((uv - .5) * vec2(1., 1.4), vec2(.5, .7), .055), aa = fwidth(d);
  float al = (1. - smoothstep(-aa, aa, d)) * alpha;
  col *= 1. - smoothstep(.972, .99, uv.y) * .2;                       // lo spessore della carta sul bordo basso
  float band = uv.x + uv.y * .55 - .78 + (r.z - r.y) * 2.6 + (tilt.x - tilt.y) * .12;
  col += vec3(1., .97, .9) * pow(max(0., 1. - abs(band) * 2.4), 3.) * (clamp(length(r.yz) * 3.5, 0., 1.) * .45 + .05) ;
  col += flash;
  col = mix(col, tcol, dim);
  o = vec4(col * al, al);
}`;

  // particelle: punti luminosi (o frammenti opachi) disegnati tutti insieme
  const PT_VS = `#version 300 es
layout(location = 0) in vec2 p; layout(location = 1) in float sz; layout(location = 2) in vec4 col; layout(location = 3) in float k;
uniform vec2 res; uniform float px1;
out vec4 c; out float kk;
void main(){ c = col; kk = k; gl_PointSize = sz * px1; gl_Position = vec4((p / res * 2. - 1.) * vec2(1., -1.), 0., 1.); }`;
  const PT_FS = `#version 300 es
precision mediump float;
in vec4 c; in float kk; out vec4 o;
void main(){ float d = length(gl_PointCoord - .5) * 2.; float a = kk > .5 ? step(d, .85) : pow(max(0., 1. - d), 1.6);
  o = vec4(c.rgb * c.a * a, kk > .5 ? c.a * a : 0.); }`;
  const PMAX = COARSE ? 520 : 900, pbuf = new Float32Array(PMAX * 8);
  let parts = [], vaoPt, bufPt;
  const R = (a, b) => a + Math.random() * (b - a);
  const PAL = { W: [[1, 0.95, 0.75], [0.96, 0.78, 0.33], [0.88, 0.62, 0.15]], U: [[0.9, 1, 1], [0.5, 0.85, 0.95], [0.12, 0.56, 0.75]], B: [[0.85, 1, 0.9], [0.55, 0.95, 0.7], [0.5, 0.35, 0.7]],
    R: [[1, 0.92, 0.6], [1, 0.6, 0.22], [0.9, 0.28, 0.14]], G: [[0.9, 0.97, 0.7], [0.4, 0.8, 0.5], [0.14, 0.52, 0.35]], N: [[1, 0.98, 0.92], [0.96, 0.93, 0.87], [0.8, 0.76, 0.66]] };
  function emit(n, fn) { n = Math.round(n * (COARSE ? 0.7 : 1)); for (let i = 0; i < n && parts.length < PMAX; i++) { const q = fn(i, n); q.age = -(q.delay || 0); parts.push(q); } busyUntil = performance.now() + 400; }
  const pick = (l) => { const p = PAL[l] || PAL.N; return p[(Math.random() * p.length) | 0]; };
  function drawParts(dt) {
    let n = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.age += dt;
      if (q.age >= q.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      if (q.age < 0) continue;
      q.vy += (q.g || 0) * dt; const dr = Math.max(0, 1 - (q.drag || 0) * dt); q.vx *= dr; q.vy *= dr;
      q.x += (q.vx + (q.sway ? Math.sin(q.age * 4 + q.sway) * 40 : 0)) * dt; q.y += q.vy * dt;
      const t = q.age / q.life, o = n * 8;
      pbuf[o] = q.x; pbuf[o + 1] = q.y; pbuf[o + 2] = q.size * (q.grow ? 1 + t * q.grow : 1 - t * 0.5);
      pbuf[o + 3] = q.c[0]; pbuf[o + 4] = q.c[1]; pbuf[o + 5] = q.c[2]; pbuf[o + 6] = (q.a || 1) * (t < 0.1 ? t * 10 : t > 0.6 ? (1 - t) / 0.4 : 1); pbuf[o + 7] = q.k || 0;
      n++;
    }
    if (!n) return;
    gl.useProgram(P.pt.p); gl.bindVertexArray(vaoPt); gl.bindBuffer(gl.ARRAY_BUFFER, bufPt);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pbuf.subarray(0, n * 8));
    gl.uniform2f(P.pt.u.res, W / scale, H / scale); gl.uniform1f(P.pt.u.px1, scale);
    gl.drawArrays(gl.POINTS, 0, n);
    busyUntil = performance.now() + 100;
  }
  // gli effetti del gioco, dentro la scena
  function fx(kind, a, b) {
    if (!ready) return;
    let l = typeof a === 'string' ? a : null, r = l ? b : a;
    if (r && r.getBoundingClientRect) r = r.getBoundingClientRect();
    if (kind === 'win' || kind === 'lose') {
      const A = (typeof Altar !== 'undefined' && Altar.rect) || { cx: innerWidth / 2, cy: innerHeight / 2, size: 300 };
      if (kind === 'lose') { api.ripple(A.cx, A.cy, null, 0.8); emit(60, () => ({ x: R(0, innerWidth), y: -10, vx: R(-10, 10), vy: R(60, 160), life: R(1.5, 2.6), size: R(5, 9), c: [0.5, 0.6, 0.65], k: 1, a: 0.7, sway: R(0, 6) })); return; }
      L.forEach((t, i) => setTimeout(() => {
        const ang = -Math.PI / 2 + (i * Math.PI * 2) / 5, x = A.cx + Math.cos(ang) * A.size * 0.4, y = A.cy + Math.sin(ang) * A.size * 0.4;
        api.ripple(x, y, t, 1.5); tint = hex(ATL.COL[t]); tintA = 1; roseTgt += Math.PI * 0.4;
        emit(70, () => { const d = R(0, 6.283), v = R(60, 420); return { x, y, vx: Math.cos(d) * v, vy: Math.sin(d) * v - 80, g: 260, drag: 1.2, life: R(0.8, 1.8), size: R(6, 16), c: pick(t) }; });
      }, 250 + i * 330));
      setTimeout(() => emit(200, () => ({ x: R(0, innerWidth), y: R(-40, -5), vx: R(-30, 30), vy: R(120, 320), g: 60, life: R(1.6, 2.8), size: R(6, 11), c: pick(L[(Math.random() * 5) | 0]), k: 1, sway: R(0, 6), delay: R(0, 0.8) })), 1900);
      return;
    }
    if (!r || !r.width) return;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, w = r.width, hh = r.height;
    const ring = (n, v, c2, size = [5, 11]) => emit(n, () => { const d = R(0, 6.283), sp = R(v * 0.3, v); return { x: cx + Math.cos(d) * w * 0.3, y: cy + Math.sin(d) * hh * 0.3, vx: Math.cos(d) * sp, vy: Math.sin(d) * sp, drag: 2.2, life: R(0.5, 1.1), size: R(size[0], size[1]), c: typeof c2 === 'string' ? pick(c2) : c2 }; });
    if (kind === 'cast') { api.ripple(cx, cy, l, 0.5); ring(16, 200, l); return; }
    if (kind === 'enter') {
      api.ripple(cx, cy, l, 1.5);
      emit(6, () => ({ x: cx, y: cy, vx: 0, vy: 0, life: 0.7, size: w * 1.6, grow: 1.4, c: pick(l), a: 0.35 }));   // il lampo
      if (l === 'W') { emit(70, () => { const d = R(0, 6.283), v = R(30, 260); return { x: cx, y: cy, vx: Math.cos(d) * v, vy: Math.sin(d) * v - 40, drag: 1.4, life: R(0.9, 1.9), size: R(4, 10), c: pick('W'), sway: R(0, 6) }; }); }
      else if (l === 'U') { emit(90, () => { const d = R(-2.6, -0.54), v = R(180, 520); return { x: cx + R(-w * 0.3, w * 0.3), y: cy + hh * 0.3, vx: Math.cos(d) * v * 0.7, vy: Math.sin(d) * v, g: 900, life: R(0.6, 1.3), size: R(5, 11), c: pick('U') }; }); setTimeout(() => api.ripple(cx, cy, 'U', 0.9), 260); }
      else if (l === 'B') { emit(26, () => ({ x: cx + R(-w, w), y: cy + R(-hh * 0.4, hh * 0.6), vx: R(-15, 15), vy: R(-40, -10), life: R(1.4, 2.4), size: R(40, 90), c: [0.5, 0.36, 0.7], a: 0.16, grow: 0.6, delay: R(0, 0.4) }));
        emit(34, () => ({ x: cx + R(-w * 0.8, w * 0.8), y: cy + R(-hh * 0.5, hh * 0.5), vx: R(-20, 20), vy: R(-80, -20), life: R(1, 2.2), size: R(6, 14), c: pick('B'), sway: R(0, 6), delay: R(0, 0.5) })); }
      else if (l === 'R') { emit(110, () => ({ x: cx + R(-w * 0.4, w * 0.4), y: cy + R(0, hh * 0.4), vx: R(-120, 120), vy: R(-620, -120), g: 500, drag: 0.6, life: R(0.5, 1.4), size: R(4, 10), c: pick('R') }));
        emit(10, () => ({ x: cx + R(-w * 0.3, w * 0.3), y: cy, vx: R(-30, 30), vy: R(-60, -20), life: R(0.6, 1.1), size: w * R(0.7, 1.3), c: [0.9, 0.3, 0.1], a: 0.3, grow: 0.8 })); }
      else { emit(60, () => ({ x: cx + R(-w, w), y: cy + R(-hh * 0.9, -hh * 0.1), vx: R(-30, 30), vy: R(30, 130), g: 60, life: R(1.1, 2.2), size: R(5, 9), c: pick('G'), k: 1, sway: R(0, 6), delay: R(0, 0.5) }));
        ring(30, 220, 'G', [4, 8]); }
      return;
    }
    if (kind === 'destroy') {
      api.ripple(cx, cy, 'R', 1.7);
      emit(4, () => ({ x: cx, y: cy, vx: 0, vy: 0, life: 0.45, size: w * 2.2, grow: 1.2, c: [1, 0.8, 0.5], a: 0.5 }));
      emit(70, () => { const d = R(0, 6.283), v = R(60, 380); return { x: cx + R(-w * 0.3, w * 0.3), y: cy + R(-hh * 0.3, hh * 0.3), vx: Math.cos(d) * v, vy: Math.sin(d) * v - 120, g: 700, drag: 1, life: R(0.6, 1.3), size: R(5, 12), c: pick('N'), k: 1 }; });
      ring(50, 420, 'R', [4, 9]);
      return;
    }
    if (kind === 'counter') { api.ripple(cx, cy, 'U', 1.4); ring(80, 460, 'U', [5, 12]); emit(4, () => ({ x: cx, y: cy, vx: 0, vy: 0, life: 0.5, size: w * 2, grow: 1.5, c: [0.5, 0.85, 1], a: 0.4 })); return; }
    const col = { regrow: 'G', reuse: 'W', look: 'B', discard: 'N' }[kind];
    if (col) { api.ripple(cx, cy, col === 'N' ? null : col, 0.6); ring(26, 200, col); }
  }

  function prog(vs, fs, names) {
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; for (const k of names) u[k] = gl.getUniformLocation(p, k);
    return { p, u };
  }
  function texFrom(src, { mip = false, repeat = false } = {}) {
    const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const w = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
    return tx;
  }
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const load = (key, src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => { img[key] = i; res(); }; i.onerror = rej; i.src = src; });
  const raster = (im, w, h) => { const c = canvas(w, h); c.getContext('2d').drawImage(im, 0, 0, w, h); return c; };

  function setup() {
    cv = document.getElementById('scene');
    gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 non disponibile');
    P.table = prog(TABLE_VS, TABLE_FS, ['N', 'TOPO', 'ROSE', 'res', 't', 'px1', 'colA', 'colB', 'lineC', 'lineA', 'tint', 'tintA', 'night', 'rose', 'roseAng', 'rip', 'ripC']);
    P.halo = prog(HALO_VS, HALO_FS, ['res', 'c', 'sz', 'rot', 'margin', 'soff', 'rad', 'blur', 'sa', 'rw', 'ring']);
    P.card = prog(CARD_VS, CARD_FS, ['N', 'F', 'M', 'B', 'res', 'c', 'sz', 'r', 't', 'alpha', 'dim', 'flash', 'onlyBack', 'land', 'art', 'crop', 'tilt', 'tcol']);
    // griglia della carta
    const NX = 6, NY = 8, vs = [], ix = [];
    for (let y = 0; y <= NY; y++) for (let x = 0; x <= NX; x++) vs.push(x / NX - 0.5, y / NY - 0.5);
    for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const i = y * (NX + 1) + x; ix.push(i, i + 1, i + NX + 1, i + 1, i + NX + 2, i + NX + 1); }
    nIdx = ix.length;
    vaoGrid = gl.createVertexArray(); gl.bindVertexArray(vaoGrid);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vs), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ix), gl.STATIC_DRAW);
    vaoNone = gl.createVertexArray();
    P.pt = prog(PT_VS, PT_FS, ['res', 'px1']);
    vaoPt = gl.createVertexArray(); gl.bindVertexArray(vaoPt);
    bufPt = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufPt); gl.bufferData(gl.ARRAY_BUFFER, pbuf.byteLength, gl.DYNAMIC_DRAW);
    [[0, 2, 0], [1, 1, 8], [2, 4, 12], [3, 1, 28]].forEach(([loc, size, off]) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 32, off); });
    gl.bindVertexArray(null);
    // rumore: una piccola texture ripetuta, molto più leggera del rumore calcolato punto per punto
    const nz = new Uint8Array(64 * 64 * 4); for (let i = 0; i < nz.length; i++) nz[i] = (Math.random() * 256) | 0;
    tex.noise = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex.noise);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, nz);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); if (onSlow) onSlow('lost'); });
    const jobs = [load('rose', ATL.SRC.rose()), load('topo', ATL.SRC.topo())];
    for (const l of L) jobs.push(load('map' + l, ATL.SRC.map(l)), load('ico' + l, ATL.SRC.ico(l)));
    const fonts = document.fonts ? Promise.all([document.fonts.load('700 20px Adventor'), document.fonts.load('italic 500 20px Lora')]).catch(() => {}) : Promise.resolve();
    return Promise.all(jobs).then(() => fonts).then(() => {
      fontsOk = true;
      tex.rose = texFrom(raster(img.rose, 1024, 1024), { mip: true });
      tex.topo = texFrom(raster(img.topo, 512, 930));
      L.forEach((l) => { tex['map' + l] = texFrom(raster(img['map' + l], 512, 471)); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT); });
      return setBack(backId || 'bussola');
    });
  }
  function setBack(id) {
    backId = id;
    if (!gl) return Promise.resolve();
    return load('back', ATL.SRC.back(id)).then(() => {
      const w = 256, hh = 358, c = canvas(w, hh), x = c.getContext('2d');
      x.fillStyle = ATL.PAPER; x.fillRect(0, 0, w, hh);
      const m = w * 0.04; x.save(); x.beginPath(); x.roundRect(m, m, w - 2 * m, hh - 2 * m, w * 0.035); x.clip(); x.drawImage(img.back, 0, 0, w, hh); x.restore();
      if (tex.back) gl.deleteTexture(tex.back);
      tex.back = texFrom(c, { mip: true });
    });
  }

  // disegna una volta la faccia di una carta (carta, simbolo, nome, testo) lasciando trasparente il riquadro della tavola
  function face(l, variant) {
    const key = l + variant; let f = faces.get(key);
    if (f) return f;
    const [ah, gemTop, nameTop, nameSize, withText] = VAR[variant];
    const w = variant.startsWith('mini') ? 224 : 400, hh = Math.round(w * 1.4), c = canvas(w, hh), x = c.getContext('2d');
    x.fillStyle = ATL.PAPER; x.fillRect(0, 0, w, hh);
    const ax = w * 0.055, ay = hh * 0.04, aw = w * 0.89, a2 = hh * ah;
    x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.roundRect(ax, ay, aw, a2, w * 0.03); x.fill(); x.restore();
    x.strokeStyle = 'rgba(23,38,45,.4)'; x.lineWidth = w * 0.008; x.beginPath(); x.roundRect(ax, ay, aw, a2, w * 0.03); x.stroke();
    x.strokeStyle = 'rgba(255,248,230,.5)'; x.lineWidth = w * 0.006; x.beginPath(); x.roundRect(ax + aw * 0.035, ay + a2 * 0.035, aw * 0.93, a2 * 0.93, w * 0.014); x.stroke();
    const gs = w * 0.18, gx = w * 0.41, gy = hh * gemTop;
    x.fillStyle = ATL.PAPER; x.beginPath(); x.arc(gx + gs / 2, gy + gs / 2, gs / 2 + w * 0.024, 0, 7); x.fill();
    x.drawImage(img['ico' + l], gx, gy, gs, gs);
    x.fillStyle = ATL.INK; x.textBaseline = 'alphabetic';
    if (nameSize) {
      const fs = w * nameSize, name = NAMES[l].toUpperCase(), sp = fs * (variant === 'full' ? 0.14 : 0.1);
      x.font = `700 ${fs}px Adventor, "Century Gothic", sans-serif`;
      let tw = -sp; for (const ch of name) tw += x.measureText(ch).width + sp;
      let cx = (w - tw) / 2; x.textAlign = 'left';
      for (const ch of name) { x.fillText(ch, cx, hh * nameTop + fs * 0.82); cx += x.measureText(ch).width + sp; }
    }
    if (withText) {
      const fs = w * 0.066; x.font = `italic 500 ${fs}px Lora, Georgia, serif`; x.textAlign = 'center'; x.globalAlpha = 0.8;
      const words = FXTXT[l].split(' '), lines = []; let cur = '';
      for (const wd of words) { const tt = cur ? cur + ' ' + wd : wd; if (x.measureText(tt).width > w * 0.86 && cur) { lines.push(cur); cur = wd; } else cur = tt; }
      lines.push(cur);
      lines.forEach((ln, i) => x.fillText(ln, w / 2, hh * 0.845 + fs * 0.9 + i * fs * 1.16));
      x.globalAlpha = 1;
    }
    const artA = aw / a2, mapA = 100 / 92;
    f = { tex: texFrom(c, { mip: true }), art: [0.055, 0.04, 0.945, 0.04 + ah], crop: artA > mapA ? [1, mapA / artA] : [artA / mapA, 1] };
    faces.set(key, f);
    return f;
  }

  // ---------------- le carte da disegnare ----------------
  const RING = { gold: [0.965, 0.77, 0.33], red: [0.78, 0.25, 0.17] };
  function collect(now, dt) {
    const game = document.querySelector('.game');
    const out = [];
    if (!game) return out;
    const wide = innerWidth / innerHeight >= 1.1 && innerHeight > 520, small = innerWidth < 700 || innerHeight <= 520;
    const seenKeys = new Set(), count = {};
    const k = 1 - Math.exp(-dt * 20);
    for (const el of game.querySelectorAll('.slot > .card, .stack-area > .card, #hand-me > .card')) {
      const par = el.parentElement, cl = el.classList;
      if (el.style.visibility === 'hidden' || par.style.visibility === 'hidden' || cl.contains('away') || cl.contains('ghosted')) continue;
      const m = /\bk-([WUBRG])\b/.exec(el.className); if (!m) continue;
      const l = m[1], inHand = par.id === 'hand-me', inSlot = par.classList.contains('slot');
      let key;
      if (inSlot) key = par.id; else if (!inHand) key = 'stack';
      else { count[l] = (count[l] || 0) + 1; key = 'h' + l + count[l]; }
      const b = el.getBoundingClientRect(), w = el.offsetWidth, hh = el.offsetHeight;
      if (!w) continue;
      const T = { x: b.left + b.width / 2, y: b.top + b.height / 2, w, rot: 0, z: 0, alpha: 1, dim: 0, ring: null, ra: 0 };
      if (inHand) {
        T.rot = cl.contains('coach-hl') ? 0 : (parseFloat(el.style.getPropertyValue('--rot')) || 0) * 0.01745;
        if (cl.contains('lift')) { T.z = 1; T.ring = RING.gold; T.ra = 1; }
        else if (cl.contains('marked')) { T.z = 0.6; T.ring = RING.red; T.ra = 1; }
        else if (cl.contains('pick')) { T.ring = RING.gold; T.ra = 0.8; }
        else if (cl.contains('coach-hl')) { T.z = 0.7; }
        else if (cl.contains('pressing')) T.z = 0.4;
        if (cl.contains('idle')) T.dim = 0.5;
        if (cl.contains('coach-dim')) T.alpha = 0.45;
        if (par.classList.contains('counter-mode') && !cl.contains('marked') && !cl.contains('pick')) T.alpha = 0.4;
      } else if (inSlot) {
        if (par.classList.contains('target')) { T.ring = RING.gold; T.ra = 0.75 + 0.25 * Math.sin(now / 160); T.z = 0.25 + 0.15 * Math.sin(now / 160); }
      } else {
        if (cl.contains('staged')) { T.ring = RING.gold; T.ra = 1; T.z = 0.9 + 0.2 * Math.sin(now / 350); T.y -= 3 * Math.sin(now / 350); }
        else if (cl.contains('theirs')) { T.ring = RING.red; T.ra = 0.85; T.z = 0.5; }
        else T.z = 0.5;
        if (cl.contains('fizzle')) { T.alpha = 0.15; T.dim = 0.4; }
      }
      let s = sprites.get(key);
      const flags = el.className + '|' + par.className;
      if (!s || s.l !== l) { s = { ...T, l, punch: 0, shake: 0, flash: 0, flags: '' }; sprites.set(key, s); }
      else {
        s.x += (T.x - s.x) * k; s.y += (T.y - s.y) * k; s.w += (T.w - s.w) * k; s.rot += (T.rot - s.rot) * k;
        s.z += (T.z - s.z) * k; s.alpha += (T.alpha - s.alpha) * k; s.dim += (T.dim - s.dim) * k; s.ra += (T.ra - s.ra) * k;
        if (Math.abs(T.x - s.x) + Math.abs(T.y - s.y) > 0.6) busyUntil = now + 200;
      }
      if (T.ring) s.ring = T.ring;
      if (flags !== s.flags) {   // reazioni: la carta atterra, viene colpita, è appena stata pescata
        const has = (c2) => flags.includes(c2) && !s.flags.includes(c2);
        if (has('landed')) { s.punch = 0.24; s.flash = 0.35; }
        if (has('aimed') || has('shine')) s.punch = 0.12;
        if (has('boom')) s.shake = 1;
        if (has('newcard')) s.flash = 0.5;
        s.flags = flags; busyUntil = now + 700;
      }
      s.punch *= Math.exp(-dt * 7); s.shake *= Math.exp(-dt * 5); s.flash *= Math.exp(-dt * 5);
      s.variant = cl.contains('mini') ? (wide ? 'mininame' : 'mini') : small ? 'compact' : 'full';
      s.order = inSlot ? 0 : !inHand ? 1 : 2 + s.z;
      seenKeys.add(key); out.push(s);
    }
    for (const key of sprites.keys()) if (!seenKeys.has(key)) sprites.delete(key);
    out.sort((a, b2) => a.order - b2.order);
    return out;
  }

  // ---------------- disegno ----------------
  function drawCard(s, now, o = {}) {
    const f = s.back ? null : face(s.l, s.variant || 'compact');
    const sc = (1 + s.z * 0.06 + (s.punch || 0)) * (o.scale || 1);
    const w = s.w * sc, hh = w * 1.4;
    const sx = s.x + (s.shake ? Math.sin(now / 18) * 5 * s.shake : 0), sy = s.y;
    const zz = s.z + (o.height || 0);
    // ombra e anello
    let u = P.halo.u; gl.useProgram(P.halo.p); gl.bindVertexArray(vaoNone);
    gl.uniform2f(u.res, W / scale, H / scale); gl.uniform2f(u.c, sx, sy); gl.uniform2f(u.sz, w, hh); gl.uniform1f(u.rot, s.rot); gl.uniform1f(u.margin, w * 0.5);
    const so = [w * (0.02 + zz * 0.07) + (sx - innerWidth / 2) * 0.012 * (1 + zz), w * (0.05 + zz * 0.16)];
    const cs = Math.cos(-s.rot), sn = Math.sin(-s.rot);
    gl.uniform2f(u.soff, so[0] * cs - so[1] * sn, so[0] * sn + so[1] * cs);
    gl.uniform1f(u.rad, w * 0.055); gl.uniform1f(u.blur, w * (0.05 + zz * 0.14)); gl.uniform1f(u.sa, (0.42 - Math.min(zz, 1.5) * 0.1) * s.alpha * (theme === 'giorno' ? 0.6 : 1));
    gl.uniform1f(u.rw, Math.max(2, w * 0.03));
    const rc = s.ring || RING.gold; gl.uniform4f(u.ring, rc[0], rc[1], rc[2], Math.max(0, s.ra || 0) * s.alpha);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // carta
    u = P.card.u; gl.useProgram(P.card.p); gl.bindVertexArray(vaoGrid);
    gl.uniform2f(u.res, W / scale, H / scale); gl.uniform2f(u.c, sx, sy - zz * w * 0.02); gl.uniform2f(u.sz, w, hh);
    gl.uniform4f(u.r, s.rot, o.tx || 0, o.ty || 0, o.bend || 0);
    gl.uniform1f(u.alpha, s.alpha); gl.uniform1f(u.dim, s.dim || 0); gl.uniform1f(u.flash, s.flash || 0); gl.uniform1f(u.onlyBack, s.back ? 1 : 0);
    gl.uniform1i(u.land, s.back ? 0 : L.indexOf(s.l));
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, s.back ? tex.back : f.tex);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, s.back ? tex.mapW : tex['map' + s.l]);
    if (f) { gl.uniform4f(u.art, f.art[0], f.art[1], f.art[2], f.art[3]); gl.uniform2f(u.crop, f.crop[0], f.crop[1]); }
    gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_SHORT, 0);
  }

  const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const TH = { notte: { a: hex('#12363f'), b: hex('#0a232b'), line: hex('#d6e8e0'), la: 0.085, night: 1 }, giorno: { a: hex('#e3ebe7'), b: hex('#cbd8d4'), line: hex('#17262d'), la: 0.1, night: 0 } };

  function render(now) {
    const dt = Math.min(0.05, (now - (render.last || now)) / 1000); render.last = now;
    const t = ((now - t0) / 1000) % 3600, th = TH[theme] || TH.notte;
    tilt[0] += (aim[0] - tilt[0]) * 0.1; tilt[1] += (aim[1] - tilt[1]) * 0.1;
    roseAng += (roseTgt - roseAng) * (1 - Math.exp(-dt * 4));
    tintA *= Math.exp(-dt * 0.5);
    gl.viewport(0, 0, W, H);
    // tavolo
    let u = P.table.u; gl.useProgram(P.table.p); gl.bindVertexArray(vaoNone); gl.disable(gl.BLEND);
    gl.uniform2f(u.res, W, H); gl.uniform1f(u.t, t); gl.uniform1f(u.px1, scale);
    gl.uniform3fv(u.colA, th.a); gl.uniform3fv(u.colB, th.b); gl.uniform3fv(u.lineC, th.line); gl.uniform1f(u.lineA, th.la); gl.uniform1f(u.night, th.night);
    gl.uniform3fv(u.tint, tint); gl.uniform1f(u.tintA, tintA);
    const A = (typeof Altar !== 'undefined' && Altar.rect) || { cx: innerWidth / 2, cy: innerHeight / 2, size: Math.min(innerWidth, innerHeight) * 0.8 };
    gl.uniform4f(u.rose, A.cx * scale, A.cy * scale, A.size * scale, 0.55); gl.uniform1f(u.roseAng, roseAng);
    const rp = new Float32Array(12), rc = new Float32Array(9);
    for (let i = 0; i < 3; i++) { const r = ripples[i]; if (r) { rp.set([r.x * scale, r.y * scale, (now - r.t) / 1000, r.s], i * 4); rc.set(r.c, i * 3); } else rp[i * 4 + 2] = -1; }
    gl.uniform4fv(u.rip, rp); gl.uniform3fv(u.ripC, rc);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex.noise); gl.uniform1i(u.N, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex.topo); gl.uniform1i(u.TOPO, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tex.rose); gl.uniform1i(u.ROSE, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    while (ripples.length && now - ripples[0].t > 2300) ripples.shift();
    // carte
    gl.enable(gl.BLEND);
    u = P.card.u; gl.useProgram(P.card.p);
    gl.uniform1i(u.N, 0); gl.uniform1i(u.F, 2); gl.uniform1i(u.M, 3); gl.uniform1i(u.B, 2);
    gl.uniform1f(u.t, t); gl.uniform2f(u.tilt, tilt[0], tilt[1]); gl.uniform3fv(u.tcol, th.b);
    const list = collect(now, dt);
    for (const s of list) drawCard(s, now, { tx: -tilt[1] * 0.05 * (s.z > 0.5 ? 2 : 1), ty: tilt[0] * 0.05 * (s.z > 0.5 ? 2 : 1) });
    // carte in volo
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i], kk = (now - f.t0) / f.dur;
      if (kk >= 1) { flyers.splice(i, 1); f.done(); continue; }
      if (kk < 0) continue;
      const e = kk < 0.5 ? 2 * kk * kk : 1 - 2 * (1 - kk) * (1 - kk), arc = Math.sin(kk * Math.PI);
      const s = { l: f.face || 'W', back: !f.face, variant: f.variant, x: f.a.x + (f.b.x - f.a.x) * e, y: f.a.y + (f.b.y - f.a.y) * e - arc * f.lift,
        w: (f.a.w + (f.b.w - f.a.w) * e) * (1 + arc * 0.1), rot: f.rot * arc, z: 0.4 + arc * 1.4, alpha: Math.min(1, kk * 8), dim: 0, ra: 0 };
      const flip = f.flip ? Math.PI * (1 - Math.min(1, Math.max(0, (kk - 0.1) / 0.6))) : 0;
      drawCard(s, now, { ty: flip + f.side * arc * 0.35, tx: -arc * 0.25, bend: arc * 0.09 });
      busyUntil = now + 100;
    }
    // la carta trascinata: segue il dito, si inclina in base alla velocità
    const g = document.querySelector('.drag-ghost');
    if (g && g.firstElementChild) {
      const b = g.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, m = /\bk-([WUBRG])\b/.exec(g.firstElementChild.className);
      if (!dragS) dragS = { x, y, vx: 0, vy: 0, tx: 0, ty: 0 };
      const vx = (x - dragS.x) / Math.max(dt, 0.008), vy = (y - dragS.y) / Math.max(dt, 0.008);
      dragS.vx += (vx - dragS.vx) * 0.25; dragS.vy += (vy - dragS.vy) * 0.25; dragS.x = x; dragS.y = y;
      const ty = Math.max(-0.6, Math.min(0.6, dragS.vx / 1400)), tx = Math.max(-0.5, Math.min(0.5, -dragS.vy / 1600));
      dragS.tx += (tx - dragS.tx) * 0.2; dragS.ty += (ty - dragS.ty) * 0.2;
      if (m) drawCard({ l: m[1], variant: innerWidth < 700 || innerHeight <= 520 ? 'compact' : 'full', x, y, w: b.width, rot: dragS.ty * 0.25, z: 1.6, alpha: 1, dim: 0, ring: RING.gold, ra: 0.9 }, now,
        { scale: 1.12, tx: dragS.tx + 0.08, ty: dragS.ty, bend: Math.abs(dragS.ty) * 0.08 });
      busyUntil = now + 300;
    } else dragS = null;
    drawParts(dt);
  }

  function resize() {
    if (!gl) return;
    W = Math.max(2, Math.round(innerWidth * scale)); H = Math.max(2, Math.round(innerHeight * scale));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  }
  function tick(now) {
    if (!on) return;
    raf = requestAnimationFrame(tick);
    const inGame = !!document.querySelector('.game');
    // la classe va ricontrollata a ogni fotogramma: le texture finiscono di caricarsi anche a partita già aperta
    if (inGame !== cv.classList.contains('on')) cv.classList.toggle('on', inGame);
    const gl1 = inGame && ready;
    if (gl1 !== document.body.classList.contains('gl')) document.body.classList.toggle('gl', gl1);
    if (!inGame || !ready || document.hidden) { lastT = 0; return; }
    // controllo di fluidità: prima si abbassa la risoluzione della scena, poi si torna alla grafica leggera
    if (lastT) { const d = now - lastT; if (d < 250) { seen++; if (d > 24) slow++; } }
    lastT = now;
    if (seen >= 120) {
      strikes = slow / seen > 0.35 ? strikes + 1 : 0; seen = 0; slow = 0;
      if (strikes >= 2) {
        strikes = 0;
        if (scale > 1.01) { scale = Math.max(1, scale - 0.5); resize(); }
        else if (scale > 0.76) { scale = 0.75; resize(); }
        else if (onSlow) { onSlow('slow'); return; }
      }
    }
    frame++;
    const busy = now < busyUntil || flyers.length || ripples.length || parts.length || sprites.size === 0;
    if (!busy && frame % 2) return;      // a riposo bastano 30 fotogrammi al secondo
    const c0 = performance.now();
    render(now);
    stats.ms += performance.now() - c0; stats.n++;
  }
  function stop() { on = false; cancelAnimationFrame(raf); if (cv) cv.classList.remove('on'); document.body.classList.remove('gl'); sprites.clear(); for (const f of flyers.splice(0)) f.done(); }

  function set(v) {
    v = !!v;
    if (v === on) return on;
    if (!v) { stop(); return false; }
    try {
      if (!gl) {
        maxScale = Math.min(window.devicePixelRatio || 1, COARSE ? 2 : 2); scale = maxScale;
        setup().then(() => { ready = true; resize(); }).catch((e) => { console.warn('Grafica avanzata non disponibile:', e); stop(); if (onSlow) onSlow('lost'); });
      }
    } catch (e) { console.warn('Grafica avanzata non disponibile:', e.message); gl = null; return false; }
    on = true; lastT = 0; seen = 0; slow = 0; strikes = 0; resize();
    raf = requestAnimationFrame(tick);
    return true;
  }

  window.addEventListener('deviceorientation', (e) => { if (e.gamma == null) return; aim[0] = Math.max(-1, Math.min(1, e.gamma / 25)); aim[1] = Math.max(-1, Math.min(1, (e.beta - 45) / 25)); });
  if (!COARSE) window.addEventListener('pointermove', (e) => { aim[0] = (e.clientX / innerWidth - 0.5) * 1.6; aim[1] = (e.clientY / innerHeight - 0.5) * 1.6; }, { passive: true });

  const api = {
    set, resize, fx,
    get on() { return on; },
    // true quando la scena sta davvero disegnando il tavolo (texture caricate)
    get active() { return on && ready && document.body.classList.contains('gl'); },
    supported() { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } },
    setTheme(t) { theme = t; },
    setBack(id) { if (id !== backId) setBack(id); },
    // volo di una carta da un rettangolo a un altro; la promessa si chiude all'arrivo
    fly(from, to, card, { dur = 420, delay = 0, flip = false, mini = false } = {}) {
      return new Promise((done) => {
        const a = { x: from.left + from.width / 2, y: from.top + from.height / 2, w: Math.max(26, from.width) }, b = { x: to.left + to.width / 2, y: to.top + to.height / 2, w: Math.max(26, to.width) };
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        flyers.push({ t0: performance.now() + delay, dur: Math.max(120, dur * (flip ? 1.3 : 1)), a, b, face: card, flip: flip && !!card, done, lift: 24 + dist * 0.08, rot: (b.x - a.x) / 900,
          side: b.x > a.x ? 1 : -1, variant: mini ? (innerWidth / innerHeight >= 1.1 && innerHeight > 520 ? 'mininame' : 'mini') : innerWidth < 700 || innerHeight <= 520 || b.w < 120 ? 'compact' : 'full' });
      });
    },
    // un'onda che attraversa le curve di livello del tavolo
    ripple(x, y, card, strength = 1) { if (!on) return; ripples.push({ x, y, t: performance.now(), s: strength, c: card && ATL.COL[card] ? hex(ATL.COL[card]) : [1, 1, 1] }); if (ripples.length > 3) ripples.shift(); },
    // una terra viene giocata: la rosa fa un quinto di giro e la lampada prende il suo colore
    cast(card, rect) { if (!on) return; roseTgt += Math.PI * 0.4; if (ATL.COL[card]) { tint = hex(ATL.COL[card]); tintA = 1; } },
    stats,
    get scale() { return scale; },
    set onSlow(f) { onSlow = f; },
  };
  return api;
})();
