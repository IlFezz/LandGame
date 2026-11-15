'use strict';
// =====================================================================
//  Grafica avanzata: le tavole delle terre prendono vita.
//  Un solo canvas WebGL2 nascosto disegna, 30 volte al secondo, le cinque tavole animate
//  (l'immagine di sempre, mossa da uno shader: acqua, vento, nebbia, lava, chiome).
//  Ogni carta visibile ne riceve una copia nel suo piccolo canvas: così le carte restano
//  elementi normali della pagina e la grafica "Leggera" continua a funzionare identica sotto.
// =====================================================================
const Live = (() => {
  const L = ATL.L;
  const COARSE = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  const CW = COARSE ? 256 : 320, CH = Math.round(CW * 0.92);
  let cv, gl, prog, U = {}, tex = {}, loaded = 0, on = false, raf = 0, frame = 0, t0 = performance.now();
  let cards = [];                 // { c: canvas, x: contesto 2d, l: indice della terra }
  const tilt = [0, 0], aim = [0, 0];
  let lastT = 0, slow = 0, seen = 0, strikes = 0, onSlow = null;

  const VS = `#version 300 es
in vec2 p; out vec2 v;
void main(){ v = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;
  const FS = `#version 300 es
precision highp float;
uniform sampler2D T; uniform float t; uniform vec2 tilt; uniform int land;
in vec2 v; out vec4 o;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p){ return n(p) * .6 + n(p * 2.1 + 3.7) * .3 + n(p * 4.3 + 9.1) * .1; }
void main(){
  vec2 q = v * vec2(1., .92);          // coordinate con le proporzioni vere della tavola
  vec2 pl = tilt * .014;               // la mappa: piano basso
  vec2 ph = tilt * .07;                // nuvole, nebbia, fumo: piano alto (si spostano di più inclinando)
  vec3 c;
  if (land == 0) {                     // Pianura: il vento piega il grano, passano le ombre delle nuvole
    vec2 w = vec2(n(q * 5. + vec2(t * .5, 0.)), n(q * 5. + vec2(4., t * .4))) - .5;
    c = texture(T, v + pl + w * .006).rgb;
    float gust = n(vec2(q.x * 2.4 + q.y * 1.6 - t * .38, q.y * 6.));
    c *= 1. + (gust - .5) * .17;
    float cl = smoothstep(.5, .78, fbm(q * 1.7 + vec2(t * .035, t * .014) + ph));
    c *= 1. - cl * .2;
    float riv = smoothstep(.12, .3, c.b - c.r);
    c += riv * .35 * smoothstep(.7, 1., n(q * 40. + vec2(t * .9, 0.)));
  } else if (land == 1) {              // Isola: onde che si allargano, riflessi sull'acqua
    vec3 b0 = texture(T, v + pl).rgb;
    float m = smoothstep(.04, .2, b0.b - b0.r);
    vec2 d = vec2(sin(q.y * 38. + t * 1.6 + q.x * 9.), cos(q.x * 34. - t * 1.3 + q.y * 7.)) * .0035 * m;
    c = texture(T, v + pl + d).rgb;
    float r = length(q - vec2(.5, .46));
    c += m * .06 * sin(r * 70. - t * 1.8);
    float sp = smoothstep(.9, 1., n(q * 70. + vec2(t * .7, -t * .5)) * n(q * 13. - t * .22 + 2.) * 1.55);
    c += m * sp * .4;
    float cl = smoothstep(.55, .85, fbm(q * 1.5 + vec2(-t * .03, t * .012) + ph));
    c *= 1. - cl * .14;
  } else if (land == 2) {              // Palude: la nebbia scorre, i fuochi fatui respirano
    vec2 d = vec2(sin(q.y * 30. + t * .9), cos(q.x * 28. - t * .8)) * .0018;
    c = texture(T, v + pl + d).rgb;
    float f = fbm(q * 2.3 + vec2(t * .045, -t * .028) + ph);
    float f2 = fbm(q * 3.4 + vec2(-t * .03, t * .02) + ph * 1.4 + 5.);
    c = mix(c, vec3(.78, .74, .88), smoothstep(.42, .85, f) * .36 + smoothstep(.55, .9, f2) * .16);
    float g = 0.;
    for (int i = 0; i < 4; i++) {
      float k = float(i);
      vec2 w = (i == 0 ? vec2(.34, .44) : i == 1 ? vec2(.66, .38) : i == 2 ? vec2(.5, .88) : vec2(.88, .86));
      w += .014 * vec2(sin(t * .7 + k * 2.1), cos(t * .9 + k * 1.3));
      vec2 e = q - w * vec2(1., 1.);
      g += exp(-dot(e, e) * 700.) * (.45 + .55 * sin(t * 1.9 + k * 1.7));
    }
    c += vec3(.5, 1., .72) * g * .75;
  } else if (land == 3) {              // Montagna: il cratere pulsa, la lava scorre, salgono faville e fumo
    vec2 cc = vec2(.535, .432);
    float r = length(q - cc);
    vec2 sh = vec2(sin(q.y * 60. - t * 5.), 0.) * .0025 * smoothstep(.32, 0., r);
    c = texture(T, v + pl + sh).rgb;
    float hot = smoothstep(.3, .7, c.g) * step(.6, c.r);
    c += hot * vec3(.26, .11, 0.) * (.5 + .5 * sin(t * 1.4 - r * 16.));
    c += hot * vec3(.3, .17, .05) * n(q * 15. + vec2(t * .25, -t * .8));
    for (int i = 0; i < 6; i++) {
      float k = float(i), life = fract(t * .16 + k * .171);
      vec2 e = q - (cc + vec2((h(vec2(k, 1.)) - .5) * .3 + sin(life * 7. + k) * .03, .05 - life * .5));
      c += vec3(1., .66, .25) * exp(-dot(e, e) * 9000.) * (1. - life) * 1.6;
    }
    float s = fbm(q * 3. + vec2(t * .05, t * .09) + ph);
    c = mix(c, vec3(.13, .09, .11), smoothstep(.55, .9, s) * .34 * smoothstep(.6, .1, r));
  } else {                             // Foresta: le chiome ondeggiano, la luce filtra, lucciole sulla radura
    vec3 b0 = texture(T, v + pl).rgb;
    float m = smoothstep(0., .08, b0.g - max(b0.r, b0.b));
    vec2 w = (vec2(n(q * 9. + vec2(t * .45, 0.)), n(q * 9. + vec2(3., t * .4))) - .5) * .009 * m;
    c = texture(T, v + pl + w).rgb;
    float dap = fbm(q * 3.2 + vec2(t * .05, -t * .03) + ph);
    c *= .88 + dap * .26;
    float pond = smoothstep(.1, .25, c.b - c.r) * step(c.g * .95, c.b);
    c += pond * .4 * smoothstep(.75, 1., n(q * 50. + vec2(t * .8, t * .3)));
    for (int i = 0; i < 5; i++) {
      float k = float(i);
      vec2 w2 = vec2(.58, .4) + .13 * vec2(sin(t * .31 + k * 1.9) + .4 * sin(t * .83 + k), cos(t * .27 + k * 2.3));
      vec2 e = q - w2;
      c += vec3(1., .95, .5) * exp(-dot(e, e) * 14000.) * (.5 + .5 * sin(t * 2.3 + k * 2.));
    }
  }
  o = vec4(c, 1.);
}`;

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function setup() {
    cv = document.createElement('canvas'); cv.width = CW * 5; cv.height = CH;
    gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    if (!gl) throw new Error('WebGL2 non disponibile');
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    for (const u of ['T', 't', 'tilt', 'land']) U[u] = gl.getUniformLocation(prog, u);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(U.T, 0);
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); set(false); if (onSlow) onSlow('lost'); });
    L.forEach((l, i) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = 512; c.height = 471;
        c.getContext('2d').drawImage(img, 0, 0, 512, 471);
        const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
        tex[i] = tx; loaded++;
      };
      img.src = ATL.mapSrc(l);
    });
  }

  // aggancia un canvas a ogni tavola visibile che non lo ha ancora
  function scan() {
    const arts = document.querySelectorAll('.card > .art:not([data-live])');
    for (const a of arts) {
      const card = a.parentElement, m = /\bk-([WUBRG])\b/.exec(card.className);
      if (!m) continue;
      const w = a.clientWidth, hgt = a.clientHeight;
      if (!w || !hgt) continue;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const c = document.createElement('canvas');
      c.width = Math.min(CW, Math.max(48, Math.round(w * dpr))); c.height = Math.max(44, Math.round(c.width * hgt / w));
      c.className = 'livecv';
      a.dataset.live = '1'; a.appendChild(c);
      const item = { c, x: c.getContext('2d'), l: L.indexOf(m[1]), ar: w / hgt };
      cards.push(item);
      if (loaded === 5) blit(item);
    }
  }
  // la tavola ha proporzioni 100:92; le carte ne mostrano un ritaglio centrato (come "cover")
  function blit(it) {
    const ar = it.ar, base = CW / CH;
    let sw = CW, sh = CH;
    if (ar > base) sh = CW / ar; else sw = CH * ar;
    it.x.drawImage(cv, it.l * CW + (CW - sw) / 2, (CH - sh) / 2, sw, sh, 0, 0, it.c.width, it.c.height);
  }

  function tick(now) {
    if (!on) return;
    raf = requestAnimationFrame(tick);
    // controllo di fluidità: se troppi fotogrammi arrivano in ritardo, si torna da soli alla grafica leggera
    if (lastT) { const d = now - lastT; if (d < 200) { seen++; if (d > 25) slow++; } }
    lastT = now;
    if (seen >= 180) {
      strikes = slow / seen > 0.4 ? strikes + 1 : 0; seen = 0; slow = 0;
      if (strikes >= 2 && onSlow) { onSlow('slow'); return; }
    }
    if (++frame % 2) return;         // 30 disegni al secondo bastano
    scan();
    if (loaded < 5) return;
    cards = cards.filter((it) => it.c.isConnected);
    if (!cards.length) return;
    tilt[0] += (aim[0] - tilt[0]) * 0.12; tilt[1] += (aim[1] - tilt[1]) * 0.12;
    const need = [0, 0, 0, 0, 0];
    for (const it of cards) need[it.l] = 1;
    gl.uniform1f(U.t, ((now - t0) / 1000) % 3600);
    gl.uniform2f(U.tilt, tilt[0], tilt[1]);
    for (let i = 0; i < 5; i++) {
      if (!need[i]) continue;
      gl.viewport(i * CW, 0, CW, CH);
      gl.bindTexture(gl.TEXTURE_2D, tex[i]); gl.uniform1i(U.land, i);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    for (const it of cards) blit(it);
  }

  function set(v) {
    v = !!v;
    if (v === on) return on;
    if (v) {
      try { if (!gl) setup(); } catch (e) { console.warn('Grafica avanzata non disponibile:', e.message); gl = null; return false; }
      on = true; lastT = 0; seen = 0; slow = 0; strikes = 0;
      raf = requestAnimationFrame(tick);
    } else {
      on = false; cancelAnimationFrame(raf);
      for (const it of cards) it.c.remove();
      cards = [];
      document.querySelectorAll('.art[data-live]').forEach((a) => a.removeAttribute('data-live'));
    }
    document.body.classList.toggle('adv', on);
    return on;
  }

  // inclinazione: il telefono (giroscopio) oppure il puntatore del mouse spostano i piani della tavola
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    aim[0] = Math.max(-1, Math.min(1, e.gamma / 28)); aim[1] = Math.max(-1, Math.min(1, (e.beta - 45) / 28));
  });
  if (!COARSE) window.addEventListener('pointermove', (e) => { aim[0] = (e.clientX / innerWidth - 0.5) * 1.6; aim[1] = (e.clientY / innerHeight - 0.5) * 1.6; }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (on && !document.hidden) { lastT = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); } });

  return {
    set, scan: () => { if (on) scan(); },
    get on() { return on; },
    // dopo un cambio di misura dello schermo i canvas vanno ricreati alla nuova risoluzione
    reset() { if (!on) return; for (const it of cards) it.c.remove(); cards = []; document.querySelectorAll('.art[data-live]').forEach((a) => a.removeAttribute('data-live')); },
    supported() { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } },
    // dispositivo abbastanza potente da partire con la grafica avanzata?
    capable() { return this.supported() && !(navigator.deviceMemory && navigator.deviceMemory < 4) && (navigator.hardwareConcurrency || 4) >= 4 && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); },
    set onSlow(f) { onSlow = f; },
  };
})();
