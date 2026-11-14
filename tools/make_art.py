#!/usr/bin/env python3
"""Genera tutta la pixel art del gioco in public/art/ (serve Pillow + numpy).
Uso: python3 tools/make_art.py"""
import math, os, random
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'art')
os.makedirs(OUT, exist_ok=True)
W, H = 80, 112  # dimensione nativa di una carta
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def hexc(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)


def canvas(w=W, h=H, color='#000000'):
    img = np.zeros((h, w, 3), dtype=float)
    img[:] = hexc(color)
    return img


def grid(w=W, h=H):
    return np.meshgrid(np.arange(w), np.arange(h))


def ramp_fill(img, t, ramp, mask=None):
    """Colora con una rampa di colori usando dithering ordinato. t in [0,1] per pixel."""
    h, w = t.shape
    cols = np.array([hexc(c) for c in ramp])
    p = np.clip(t, 0, 1) * (len(ramp) - 1)
    thr = np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w]
    idx = np.clip(np.floor(p + thr).astype(int), 0, len(ramp) - 1)
    out = cols[idx]
    if mask is None:
        img[:] = out
    else:
        img[mask] = out[mask]


def put(img, mask, color):
    img[mask] = hexc(color)


def blend(img, mask, color, a):
    img[mask] = img[mask] * (1 - a) + hexc(color) * a


def dither_mask(t):
    """Maschera booleana con densità t (0..1) a dithering ordinato."""
    h, w = t.shape
    thr = np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w]
    return t > thr


def noise1d(n, scale, seed, amp=1.0):
    rnd = random.Random(seed)
    pts = [rnd.uniform(-1, 1) for _ in range(int(n / scale) + 3)]
    out = []
    for x in range(n):
        i, f = divmod(x / scale, 1)
        i = int(i)
        f = f * f * (3 - 2 * f)
        out.append((pts[i] * (1 - f) + pts[i + 1] * f) * amp)
    return np.array(out)


def pine(img, cx, base, h, w, ramp, seed=0):
    """Abete a strati con lato sinistro in luce."""
    rnd = random.Random(seed)
    tiers = max(3, h // 7)
    th = h / tiers
    for dy in range(h):
        y = base - h + dy
        if y < 0 or y >= img.shape[0]:
            continue
        k = dy / h
        half = (0.25 + 0.75 * ((dy % th) / th)) * w * (0.35 + 0.65 * k)
        for dx in range(-int(half), int(half) + 1):
            x = cx + dx
            if 0 <= x < img.shape[1]:
                shade = 0 if dx < -half * 0.25 else (1 if dx < half * 0.45 else 2)
                if rnd.random() < 0.12:
                    shade = min(2, shade + 1)
                img[y, x] = hexc(ramp[min(shade, len(ramp) - 1)])
    for y in range(base, min(base + 3, img.shape[0])):
        if 0 <= cx < img.shape[1]:
            img[y, cx] = hexc(ramp[-1])


def save(img, name, alpha=None, scale=1):
    arr = np.clip(img, 0, 255).astype(np.uint8)
    if alpha is not None:
        arr = np.dstack([arr, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    im = Image.fromarray(arr, 'RGBA' if alpha is not None else 'RGB')
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(os.path.join(OUT, name), optimize=True)


# ------------------------------------------------------------------ paesaggi
def scene_plains():
    img = canvas(); X, Y = grid(); rnd = random.Random(1)
    hz = 60
    ramp_fill(img, Y / hz, ['#120f2b', '#231640', '#472155', '#84345a', '#c75a45', '#f09a45', '#ffd77a'])
    # nuvole sottili illuminate dal basso
    for cy, cx, ln in [(18, 20, 22), (26, 58, 18), (36, 30, 30), (42, 66, 14)]:
        m = (np.abs(Y - cy) <= 1) & (np.abs(X - cx) < ln / 2 - np.abs(Y - cy) * 3)
        blend(img, m, '#ffb070', 0.55)
        blend(img, (Y == cy + 1) & (np.abs(X - cx) < ln / 2 - 4), '#ffe6a0', 0.6)
    # sole e alone
    d = np.hypot(X - 40, Y - 56)
    blend(img, dither_mask(np.clip(1 - (d - 12) / 16, 0, 1) * 0.7) & (Y < hz), '#ffe9a8', 0.5)
    put(img, (d < 12) & (Y < hz), '#ffe58a')
    put(img, (d < 9) & (Y < hz), '#fff6c8')
    put(img, (d < 5) & (Y < hz), '#ffffff')
    # raggi
    ang = np.arctan2(Y - 56, X - 40)
    rays = (np.cos(ang * 9) > 0.86) & (d > 14) & (d < 44) & (Y < hz)
    blend(img, rays & dither_mask(np.clip(1 - (d - 14) / 30, 0, 1)), '#ffe9a8', 0.45)
    # colline di grano a strati
    layers = [(60, 3, 11, ['#6b3a2a', '#8a4a2a']), (67, 4, 15, ['#9a6226', '#b97a2a', '#d09a38']),
              (77, 5, 19, ['#b98428', '#dba938', '#f2cc58']), (91, 4, 23, ['#7a5320', '#99702a', '#b98a34'])]
    for i, (base, amp, sc, ramp) in enumerate(layers):
        edge = base + noise1d(W, sc, 10 + i, amp)
        m = Y >= edge[X]
        depth = np.clip((Y - edge[X]) / 14, 0, 1)
        ramp_fill(img, 1 - depth, ramp, m)
        # creste illuminate
        put(img, (Y == np.round(edge[X]).astype(int)) & m, ramp[-1])
    # spighe in primo piano
    for _ in range(70):
        x = rnd.randrange(W); y0 = rnd.randrange(80, 106); ln = rnd.randrange(2, 5)
        c = rnd.choice(['#ffe07a', '#f2cc58', '#c9963a'])
        for k in range(ln):
            if 0 <= y0 - k < H: img[y0 - k, x] = hexc(c)
        if y0 - ln >= 0 and x + 1 < W: img[y0 - ln, x + 1] = hexc('#fff0a8')
    # uccelli
    for bx, by in [(16, 30), (22, 27), (62, 14)]:
        for dx, dy in [(-2, -1), (-1, 0), (0, 1), (1, 0), (2, -1)]:
            img[by + dy, bx + dx] = hexc('#1a1230')
    return img


def scene_island():
    img = canvas(); X, Y = grid(); rnd = random.Random(2)
    hz = 64
    ramp_fill(img, Y / hz, ['#04061a', '#080e2c', '#0e1a48', '#16306e', '#1f4c98', '#3a78c2'])
    for _ in range(46):  # stelle
        x, y = rnd.randrange(W), rnd.randrange(0, 50)
        img[y, x] = hexc(rnd.choice(['#ffffff', '#bcd8ff', '#7fa8e8']))
    for sx, sy in [(14, 12), (70, 34), (30, 40)]:  # stelle grandi
        for dx, dy in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]:
            img[sy + dy, sx + dx] = hexc('#ffffff' if (dx, dy) == (0, 0) else '#9cc4ff')
    # luna con alone
    d = np.hypot(X - 56, Y - 22)
    blend(img, dither_mask(np.clip(1 - (d - 9) / 14, 0, 1) * 0.6), '#9cc4ff', 0.45)
    put(img, d < 9.5, '#dceaff'); put(img, d < 8.5, '#f4f9ff')
    put(img, (np.hypot(X - 59, Y - 24) < 2.2) | (np.hypot(X - 53, Y - 19) < 1.6) | (np.hypot(X - 55, Y - 27) < 1.2), '#b8cdf0')
    # mare
    sea = Y >= hz
    ramp_fill(img, (Y - hz) / (H - hz), ['#2a66b4', '#1c4a92', '#12326e', '#0a1f4c', '#06122e'], sea)
    put(img, Y == hz, '#7fb6f0')
    for _ in range(60):  # increspature
        y = rnd.randrange(hz + 2, H); x = rnd.randrange(W); ln = rnd.randrange(2, 7)
        c = '#5a9ee0' if y < hz + 18 else '#2a5a9c'
        img[y, max(0, x - ln):x] = hexc(c)
    for y in range(hz + 1, H):  # riflesso della luna
        wdt = 2 + (y - hz) // 6
        for x in range(56 - wdt, 56 + wdt + 1):
            if (x + y) % 2 == 0 and rnd.random() < 0.8 and 0 <= x < W:
                img[y, x] = hexc('#cfe6ff' if y < hz + 14 else '#7fb6f0')
    # isola
    cx, cy = 28, 67
    hill = ((X - cx) / 23.0) ** 2 + ((Y - cy) / 12.0) ** 2 < 1
    hill &= Y <= cy
    ramp_fill(img, 1 - np.clip((X - 8) / 44, 0, 1) * 0.8 - (Y - 55) / 40, ['#0c2a22', '#12402e', '#1c5c3c', '#2f8050'], hill)
    put(img, hill & (Y >= cy - 2), '#d9c48a'); put(img, hill & (Y == cy), '#f2e2aa')
    for (px, lean, hgt) in [(24, 5, 22), (34, -3, 16)]:  # palme
        top = None
        for k in range(hgt):
            x = int(px + lean * (k / hgt) ** 2); y = cy - 8 - k
            img[y, x] = hexc('#3a2a1a'); img[y, x + 1] = hexc('#5a4226'); top = (x, y)
        for a in range(-150, 331, 60):
            for r in range(1, 9):
                fx = int(top[0] + math.cos(math.radians(a)) * r)
                fy = int(top[1] + math.sin(math.radians(a)) * r * 0.55 + (r * r) / 14)
                if 0 <= fx < W and 0 <= fy < H:
                    img[fy, fx] = hexc('#1c5c3c' if r % 2 else '#3a9a5c')
    # scogli in primo piano
    for (rx, ry, rr) in [(70, 100, 9), (62, 106, 6), (6, 104, 7)]:
        m = ((X - rx) / rr) ** 2 + ((Y - ry) / (rr * 0.7)) ** 2 < 1
        put(img, m, '#0a1026'); put(img, m & (Y < ry - rr * 0.35) & (X < rx), '#22346a')
        put(img, (Y == ry + int(rr * 0.6)) & (np.abs(X - rx) < rr + 2), '#9cc4ff')
    return img


def scene_swamp():
    img = canvas(); X, Y = grid(); rnd = random.Random(3)
    hz = 70
    ramp_fill(img, Y / hz, ['#07050f', '#120a1e', '#1f1230', '#2e1c40', '#3a2a4a', '#46404e'])
    # luna velata
    d = np.hypot(X - 26, Y - 26)
    blend(img, dither_mask(np.clip(1 - (d - 8) / 18, 0, 1) * 0.55), '#9fb890', 0.4)
    put(img, d < 9, '#a9bf98'); put(img, d < 7.5, '#c6d8ac')
    put(img, (np.hypot(X - 23, Y - 24) < 2) | (np.hypot(X - 29, Y - 29) < 1.5), '#93aa86')
    # alberi lontani
    edge = 52 + noise1d(W, 6, 31, 5) + noise1d(W, 2.5, 32, 2)
    put(img, (Y >= edge[X]) & (Y < hz), '#1a1228')
    # acqua
    water = Y >= hz
    ramp_fill(img, (Y - hz) / (H - hz), ['#2a3a32', '#1c2a26', '#121c1a', '#0a100e'], water)
    for _ in range(40):
        y = rnd.randrange(hz + 1, H); x = rnd.randrange(W); ln = rnd.randrange(3, 9)
        img[y, max(0, x - ln):x] = hexc('#3a5244' if y < hz + 14 else '#1c2a26')
    for y in range(hz + 1, hz + 22):  # riflesso
        for x in range(22, 31):
            if (x + y) % 2 == 0 and rnd.random() < 0.6: img[y, x] = hexc('#7f9a78')

    def tree(x0, y0, hgt, lean, col):
        pts = []
        for k in range(hgt):
            x = int(x0 + lean * math.sin(k / hgt * 2.2)); y = y0 - k
            wdt = max(1, int(3 * (1 - k / hgt)))
            for dx in range(wdt):
                if 0 <= x + dx < W and 0 <= y < H: img[y, x + dx] = hexc(col)
            pts.append((x, y))
        for i in range(int(hgt * 0.35), hgt, max(3, hgt // 7)):  # rami
            bx, by = pts[i]; side = rnd.choice([-1, 1]); ln = rnd.randrange(5, 12)
            for r in range(ln):
                x = bx + side * r; y = by - int(r * 0.6) + (1 if r > ln * 0.6 else 0)
                if 0 <= x < W and 0 <= y < H:
                    img[y, x] = hexc(col)
                    if r % 3 == 2 and y + 2 < H: img[y + 1, x] = hexc(col); img[y + 2, x] = hexc(col) if r % 2 else img[y + 2, x]
    tree(60, 78, 54, 4, '#0f0a18'); tree(8, 74, 40, -3, '#150e20'); tree(44, 72, 26, 2, '#1a1228')
    # nebbia
    for fy, a in [(62, 0.55), (66, 0.7), (70, 0.5), (76, 0.3)]:
        band = np.clip(1 - np.abs(Y - fy) / 3.0, 0, 1) * a * (0.6 + 0.4 * np.sin(X / 7.0 + fy))
        blend(img, dither_mask(band), '#8a8fa0', 0.5)
    # fuochi fatui
    for (gx, gy) in [(18, 84), (50, 92), (70, 80), (36, 100)]:
        dd = np.hypot(X - gx, Y - gy)
        blend(img, dither_mask(np.clip(1 - dd / 7, 0, 1) * 0.8), '#58e08a', 0.5)
        put(img, dd < 1.6, '#b6ffd0'); img[gy, gx] = hexc('#ffffff')
    # canne
    for _ in range(26):
        x = rnd.randrange(W); y0 = rnd.randrange(98, 112); ln = rnd.randrange(5, 14)
        for k in range(ln):
            if 0 <= y0 - k < H: img[y0 - k, x] = hexc('#0a0c0a' if k < ln - 2 else '#3a2a1e')
    return img


def scene_mountain():
    img = canvas(); X, Y = grid(); rnd = random.Random(4)
    ramp_fill(img, Y / 92.0, ['#0c0408', '#1c060a', '#380a0c', '#641410', '#a02a12', '#d8581a', '#ffa23a'])
    # fumo
    for (sx, sy, sr) in [(40, 14, 9), (48, 8, 7), (32, 6, 6), (54, 18, 6), (26, 14, 5)]:
        dd = np.hypot((X - sx), (Y - sy) * 1.3)
        put(img, dd < sr, '#241418'); put(img, (dd < sr) & (Y > sy + 1) , '#3a1c1c')
        put(img, (dd < sr * 0.6) & (Y > sy + 2), '#5a2418')
    # cime lontane
    for (px, py, pw, col, lit) in [(10, 50, 26, '#2a0c10', '#4a1614'), (72, 46, 30, '#2a0c10', '#4a1614')]:
        edge = py + np.abs(X - px) * (60.0 / pw) + noise1d(W, 3, px, 1.5)[X]
        m = Y >= edge
        put(img, m, col); put(img, m & (X < px) & (Y < edge + 10), lit)
    # vulcano
    apex_x, apex_y = 40, 28
    jag = noise1d(W, 4, 44, 2.0)[X]
    left = apex_y + (apex_x - X) * 1.55 + jag
    right = apex_y + (X - apex_x) * 1.35 + jag
    vol = (Y >= np.where(X < apex_x, left, right)) & (Y >= apex_y + 2)
    shade = np.clip((X - 20) / 50.0, 0, 1)
    ramp_fill(img, 1 - shade * 0.9 - (Y - apex_y) / 200.0, ['#120a10', '#1e1016', '#2e161a', '#44201e'], vol)
    for _ in range(90):  # roccia
        x = rnd.randrange(W); y = rnd.randrange(apex_y + 4, 96)
        if vol[y, x]: img[y, x] = hexc(rnd.choice(['#0c070b', '#55281f']))
    # cratere e colata
    crater = (np.abs(X - apex_x) < 6) & (np.abs(Y - (apex_y + 2)) < 2)
    put(img, crater, '#ff8a1a'); put(img, (np.abs(X - apex_x) < 4) & (Y == apex_y + 2), '#fff0a0')
    d = np.hypot(X - apex_x, Y - apex_y)
    blend(img, dither_mask(np.clip(1 - d / 16, 0, 1) * 0.7) & (Y < apex_y + 3), '#ffb040', 0.55)
    x = float(apex_x - 1)
    for y in range(apex_y + 3, 100):
        x += math.sin(y / 5.0) * 0.9 + rnd.uniform(-0.3, 0.2) - 0.25
        wdt = 1 + (y - apex_y) // 22
        for dx in range(-wdt, wdt + 1):
            xx = int(x) + dx
            if 0 <= xx < W:
                img[y, xx] = hexc('#ffe27a' if dx == 0 else ('#ff9a2a' if abs(dx) < wdt else '#c8401a'))
        for dx in (-wdt - 1, wdt + 1):  # bagliore sulla roccia
            xx = int(x) + dx
            if 0 <= xx < W and (xx + y) % 2 == 0: img[y, xx] = hexc('#7a2414')
    # lapilli
    for _ in range(40):
        ex = int(rnd.gauss(apex_x, 16)); ey = rnd.randrange(2, 60)
        if 0 <= ex < W: img[ey, ex] = hexc(rnd.choice(['#ffd24a', '#ff7a1a', '#ff4a1a']))
    # rocce in primo piano
    fg = 98 + noise1d(W, 5, 77, 5) + np.abs(noise1d(W, 2, 78, 3))
    put(img, Y >= fg[X], '#0a0508')
    put(img, (Y == np.round(fg[X]).astype(int)), '#5a1c14')
    return img


def scene_forest():
    img = canvas(); X, Y = grid(); rnd = random.Random(5)
    d = np.hypot((X - 40) * 0.9, (Y - 30))
    ramp_fill(img, 1 - d / 80.0, ['#030a08', '#06140e', '#0a2418', '#124028', '#1f6a3a', '#48a85a', '#b8f09a'])
    # fasci di luce
    for k, (x0, wdt) in enumerate([(30, 5), (42, 7), (56, 4)]):
        beam = (np.abs((X - x0) - (Y - 10) * 0.28) < wdt) & (Y > 6) & (Y < 96)
        blend(img, beam & dither_mask(np.clip(1 - Y / 110.0, 0, 1) * 0.55), '#d8ffb0', 0.35)
    # abeti: lontani → vicini
    for i in range(14):
        pine(img, rnd.randrange(4, 78), rnd.randrange(64, 72), rnd.randrange(22, 34), rnd.randrange(5, 8), ['#2f8048', '#1f6038', '#144a2a'], 100 + i)
    blend(img, (Y > 58) & (Y < 74) & dither_mask(np.full((H, W), 0.35)), '#7fd08a', 0.3)  # foschia
    for i in range(9):
        x = rnd.choice([rnd.randrange(0, 26), rnd.randrange(54, 80)])
        pine(img, x, rnd.randrange(80, 90), rnd.randrange(40, 56), rnd.randrange(8, 12), ['#17502e', '#0e3822', '#082416'], 200 + i)
    for (x, hgt, wdt) in [(4, 96, 16), (76, 104, 17), (15, 70, 12)]:
        pine(img, x, 104, hgt, wdt, ['#0c2a1a', '#071a10', '#030c08'], 300 + x)
    # terreno e sentiero illuminato
    ground = 90 + noise1d(W, 9, 55, 2)
    g = Y >= ground[X]
    ramp_fill(img, 1 - np.abs(X - 40) / 30.0 - (Y - 90) / 40.0, ['#030c08', '#071a10', '#10321e', '#2a6a38'], g)
    for _ in range(50):  # felci
        x = rnd.randrange(W); y = rnd.randrange(92, 112)
        img[y, x] = hexc(rnd.choice(['#2f8048', '#48a85a', '#0e3822']))
        if x + 1 < W and y - 1 >= 0: img[y - 1, x + 1] = hexc('#1f6038')
    # lucciole
    for _ in range(11):
        gx, gy = rnd.randrange(8, 72), rnd.randrange(34, 96)
        dd = np.hypot(X - gx, Y - gy)
        blend(img, dither_mask(np.clip(1 - dd / 4.5, 0, 1) * 0.7), '#e6ff8a', 0.5)
        img[gy, gx] = hexc('#ffffd0')
    return img


# ------------------------------------------------------------------ emblemi
def emblem(kind, n):
    """Emblema n×n: restituisce (rgb, alpha)."""
    U, V = np.meshgrid((np.arange(n) + 0.5) / n * 2 - 1, (np.arange(n) + 0.5) / n * 2 - 1)
    rgb = np.zeros((n, n, 3)); alpha = np.zeros((n, n))
    light = np.clip(0.5 - (U + V) * 0.42, 0, 1)  # luce dall'alto a sinistra

    def layer(mask, ramp, t=None):
        tmp = np.zeros((n, n, 3)); ramp_fill(tmp, light if t is None else t, ramp)
        rgb[mask] = tmp[mask]; alpha[mask] = 1

    r = np.hypot(U, V); ang = np.arctan2(V, U)
    if kind == 'W':
        rays = (np.cos(ang * 8) > 0.55 - (r - 0.5) * 1.6) & (r > 0.52) & (r < 0.95)
        layer(rays, ['#b86a1a', '#f0a030', '#ffd24a'])
        layer(r < 0.46, ['#e08a20', '#ffc23a', '#ffe680', '#fffbe0'])
        layer(np.hypot(U + 0.14, V + 0.14) < 0.16, ['#ffffff'])
    elif kind == 'U':
        body = np.hypot(U, V - 0.28) < 0.56
        tip = (V < 0.28) & (V > -0.92) & (np.abs(U) < (V + 0.92) / 1.2 * 0.52)
        layer(body | tip, ['#123a7a', '#1f5cb0', '#3a8ae0', '#7cc4ff'])
        layer(np.hypot((U + 0.2) / 0.6, (V - 0.12) / 1.0) < 0.2, ['#e6f6ff'])
        layer((np.hypot(U, V - 0.28) > 0.4) & (np.hypot(U, V - 0.28) < 0.5) & (U > 0.05) & (V > 0.3), ['#9cd8ff'])
    elif kind == 'B':
        skull = (np.hypot(U, (V + 0.16) / 0.92) < 0.66) | ((np.abs(U) < 0.38) & (V > 0.2) & (V < 0.78))
        layer(skull, ['#5a4a6a', '#8a7a9a', '#c2b6cc', '#f0eaf4'])
        eyes = (np.hypot(U - 0.27, V + 0.06) < 0.19) | (np.hypot(U + 0.27, V + 0.06) < 0.19)
        layer(eyes, ['#140a1e'])
        layer((np.hypot(U - 0.25, V + 0.04) < 0.07) | (np.hypot(U + 0.29, V + 0.04) < 0.07), ['#b060ff'])
        layer((np.abs(U) < (V - 0.14) * 0.6) & (V > 0.14) & (V < 0.34), ['#140a1e'])
        layer(((np.abs(np.abs(U) - 0.2) < 0.045) | (np.abs(U) < 0.045)) & (V > 0.5) & (V < 0.78), ['#3a2a4a'])
    elif kind == 'R':
        def flame(sc, oy, ox=0.0):
            k = np.clip((V - oy + 0.95 * sc) / (1.3 * sc), 0, 1)
            cx = ox + 0.2 * sc * (1 - k) * np.sin(k * 3.0 + 0.6)
            top = (V > oy - 0.95 * sc) & (V < oy + 0.3 * sc) & (np.abs(U - cx) < 0.6 * sc * k ** 0.75)
            return top | (np.hypot(U - ox, V - oy - 0.3 * sc) < 0.6 * sc)
        layer(flame(1.0, 0.0), ['#7a1408', '#c22a0e', '#f05a14'])
        layer(flame(0.68, 0.24, 0.02), ['#f08a14', '#ffb82a', '#ffd84a'])
        layer(flame(0.36, 0.48, 0.03), ['#ffe88a', '#fffbe0'])
    elif kind == 'G':
        trunk = (np.abs(U) < 0.13) & (V > 0.5) & (V < 0.95)
        layer(trunk, ['#3a2412', '#6a4420', '#8a6030'])
        for (top, bot, wdt) in [(-0.1, 0.62, 0.82), (-0.52, 0.22, 0.66), (-0.95, -0.2, 0.48)]:
            tri = (V > top) & (V < bot) & (np.abs(U) < (V - top) / (bot - top) * wdt)
            layer(tri, ['#0c3a1e', '#1a6a32', '#2f9a48', '#7ad86a'])
            layer(tri & (V > bot - 0.09), ['#0a2a16'])
    # contorno scuro
    a = alpha > 0
    out = np.zeros_like(a)
    for dy, dx in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
        out |= np.roll(np.roll(a, dy, 0), dx, 1)
    edge = out & ~a
    rgb[edge] = hexc('#0a0710'); alpha[edge] = 1
    return rgb, alpha


THEME = {  # cornice: scuro, medio, chiaro; fondo carta semplice
    'W': (['#5a431a', '#c9a24a', '#fff0b0'], ['#16110a', '#2c2210', '#4a3a18', '#6a5422']),
    'U': (['#12305e', '#3a7ad0', '#b0dcff'], ['#060a16', '#0a1630', '#10264e', '#183a70']),
    'B': (['#2e1c44', '#7a52a8', '#d4b6f4'], ['#08060c', '#120c1c', '#1e142e', '#2c1e42']),
    'R': (['#5a140c', '#d0441a', '#ffc27a'], ['#100606', '#260a08', '#42100c', '#621810']),
    'G': (['#123a1c', '#3a9a4a', '#b6f09a'], ['#050c08', '#0a1c10', '#10301a', '#184a26']),
}


def frame(img, kind, plate=True):
    """Cornice in metallo colorato + targhetta per il nome. Restituisce l'alpha (angoli smussati)."""
    X, Y = grid()
    dark, mid, lite = THEME[kind][0]
    bx = np.minimum(X, W - 1 - X); by = np.minimum(Y, H - 1 - Y); b = np.minimum(bx, by)
    if plate:
        py = H - 26
        m = (Y >= py) & (b >= 3)
        blend(img, m, '#07060b', 0.82)
        put(img, (Y == py) & (b >= 3), mid); put(img, (Y == py + 1) & (b >= 3), '#07060b')
    put(img, b == 0, '#05040a')
    put(img, b == 1, lite); put(img, b == 2, mid)
    put(img, (b == 1) & ((Y > H // 2) | (X > W * 0.7)), mid); put(img, (b == 2) & ((Y > H // 2) | (X > W * 0.7)), dark)
    put(img, b == 3, '#05040a')
    for (cx, cy) in [(4, 4), (W - 5, 4), (4, H - 5), (W - 5, H - 5)]:  # borchie
        put(img, (np.abs(X - cx) <= 1) & (np.abs(Y - cy) <= 1), lite); img[cy, cx] = hexc('#ffffff')
    alpha = np.ones((H, W))
    corner = (bx + by) < 2
    alpha[corner] = 0
    return alpha


def card_simple(kind):
    img = canvas(); X, Y = grid(); rnd = random.Random(ord(kind))
    d = np.hypot((X - 40) / 46.0, (Y - 44) / 60.0)
    ramp_fill(img, 1 - d, THEME[kind][1])
    for _ in range(140):  # grana della pietra
        x, y = rnd.randrange(W), rnd.randrange(H)
        blend(img, (X == x) & (Y == y), '#000000' if rnd.random() < 0.6 else THEME[kind][0][1], 0.35)
    # cerchio runico dietro l'emblema
    dd = np.hypot(X - 39.5, Y - 43.5)
    blend(img, (np.abs(dd - 29) < 0.8) | ((np.abs(dd - 25) < 0.6) & ((np.arctan2(Y - 43.5, X - 39.5) * 6 % 2) < 1.2)), THEME[kind][0][1], 0.55)
    blend(img, dither_mask(np.clip(1 - dd / 30, 0, 1) * 0.5), THEME[kind][0][1], 0.3)
    n = 48
    rgb, al = emblem(kind, n)
    oy, ox = 20, 16
    sub = img[oy:oy + n, ox:ox + n]
    sub[al > 0] = rgb[al > 0]
    return img


def card_back():
    img = canvas(); X, Y = grid(); rnd = random.Random(9)
    d = np.hypot((X - 40) / 50.0, (Y - 56) / 70.0)
    ramp_fill(img, 1 - d, ['#0a0810', '#14101e', '#1e182c', '#2a223c'])
    dd = np.hypot(X - 39.5, Y - 55.5)
    put(img, np.abs(dd - 26) < 1, '#6a5aa0'); put(img, np.abs(dd - 21) < 0.6, '#3e3466')
    cols = {'W': '#ffe680', 'U': '#5ab0ff', 'B': '#b060ff', 'R': '#ff6a2a', 'G': '#5ae07a'}
    pts = []
    for i, k in enumerate('WUBRG'):
        a = -math.pi / 2 + i * 2 * math.pi / 5
        px, py = 39.5 + math.cos(a) * 26, 55.5 + math.sin(a) * 26
        pts.append((px, py, cols[k]))
    for i in range(5):  # stella
        x0, y0, _ = pts[i]; x1, y1, _ = pts[(i + 2) % 5]
        for t in np.linspace(0, 1, 80):
            x, y = int(round(x0 + (x1 - x0) * t)), int(round(y0 + (y1 - y0) * t))
            img[y, x] = hexc('#3e3466')
    for px, py, c in pts:
        g = np.hypot(X - px, Y - py)
        blend(img, dither_mask(np.clip(1 - g / 7, 0, 1) * 0.6), c, 0.5)
        put(img, g < 3, '#0a0810'); put(img, g < 2.2, c); img[int(py), int(px)] = hexc('#ffffff')
    for _ in range(60):
        x, y = rnd.randrange(W), rnd.randrange(H)
        img[y, x] = img[y, x] * 0.7
    bx = np.minimum(X, W - 1 - X); by = np.minimum(Y, H - 1 - Y); b = np.minimum(bx, by)
    put(img, b == 0, '#05040a'); put(img, b == 1, '#8a7ac0'); put(img, b == 2, '#4a3e7a'); put(img, b == 3, '#05040a')
    alpha = np.ones((H, W)); alpha[(bx + by) < 2] = 0
    return img, alpha


# ------------------------------------------------------------------ altare
def stone_tile(n=96):
    rnd = random.Random(7)
    img = np.zeros((n, n, 3)); X, Y = np.meshgrid(np.arange(n), np.arange(n))
    rows = [0, 22, 40, 62, 80, n]
    base = ['#16131f', '#1a1724', '#141119', '#1d1928']
    for r in range(len(rows) - 1):
        y0, y1 = rows[r], rows[r + 1]
        x = rnd.randrange(-20, 0)
        while x < n:
            wdt = rnd.randrange(22, 40)
            col = hexc(rnd.choice(base))
            m = (Y >= y0) & (Y < y1) & (((X - x) % n) < wdt) if x < 0 else (Y >= y0) & (Y < y1) & (X >= x) & (X < x + wdt)
            img[m] = col
            xs = np.arange(max(0, x), min(n, x + wdt))
            if len(xs):
                img[y0, xs] = col * 1.35  # bordo alto in luce
                img[y1 - 1, xs] = hexc('#08060c')
                if 0 <= x < n: img[y0:y1, x] = hexc('#08060c')
                if 0 < x + 1 < n: img[y0 + 1:y1 - 1, x + 1] = col * 1.2
            x += wdt
    for _ in range(520):  # grana
        x, y = rnd.randrange(n), rnd.randrange(n)
        img[y, x] = img[y, x] * rnd.choice([0.72, 0.85, 1.18, 1.3])
    for _ in range(7):  # crepe
        x, y = rnd.randrange(n), rnd.randrange(n)
        for _ in range(rnd.randrange(5, 14)):
            img[y % n, x % n] = hexc('#07050a')
            x += rnd.choice([-1, 0, 1]); y += 1
    return img


def rune_ring(n=160):
    """Cerchio runico bianco su trasparente: si colora via CSS (mask)."""
    X, Y = np.meshgrid(np.arange(n), np.arange(n)); c = (n - 1) / 2
    d = np.hypot(X - c, Y - c); ang = np.arctan2(Y - c, X - c)
    a = np.zeros((n, n))
    R = n * 0.46
    a[np.abs(d - R) < 1.2] = 1
    a[np.abs(d - R * 0.86) < 0.7] = 0.8
    a[(np.abs(d - R * 0.93) < 2.2) & ((ang * 30 / math.pi) % 2 < 0.7)] = 0.9  # tacche
    a[(np.abs(d - R * 0.5) < 0.7) & ((ang * 12 / math.pi) % 2 < 1.4)] = 0.6
    pts = [(c + math.cos(-math.pi / 2 + i * 2 * math.pi / 5) * R * 0.86, c + math.sin(-math.pi / 2 + i * 2 * math.pi / 5) * R * 0.86) for i in range(5)]
    for i in range(5):
        x0, y0 = pts[i]; x1, y1 = pts[(i + 2) % 5]
        for t in np.linspace(0, 1, n * 2):
            a[int(round(y0 + (y1 - y0) * t)), int(round(x0 + (x1 - x0) * t))] = 0.7
    for i, k in enumerate('WUBRG'):
        px, py = pts[i]
        g = np.hypot(X - px, Y - py)
        a[g < n * 0.085] = 0
        a[np.abs(g - n * 0.085) < 1] = 1
        m = int(n * 0.11)
        _, al = emblem(k, m)
        ox, oy = int(px - m / 2 + 0.5), int(py - m / 2 + 0.5)
        sub = a[oy:oy + m, ox:ox + m]
        sub[al > 0] = 1
    rgb = np.full((n, n, 3), 255.0)
    return rgb, a


def tomb(n=24):
    U, V = np.meshgrid((np.arange(n) + 0.5) / n * 2 - 1, (np.arange(n) + 0.5) / n * 2 - 1)
    rgb = np.zeros((n, n, 3)); al = np.zeros((n, n))
    body = ((np.abs(U) < 0.5) & (V > -0.3) & (V < 0.7)) | (np.hypot(U, V + 0.3) < 0.5)
    tmp = np.zeros((n, n, 3)); ramp_fill(tmp, np.clip(0.55 - (U + V) * 0.4, 0, 1), ['#3a3448', '#5a5470', '#8a84a0', '#c2bcd4'])
    rgb[body] = tmp[body]; al[body] = 1
    cross = ((np.abs(U) < 0.09) & (V > -0.45) & (V < 0.25)) | ((np.abs(V + 0.2) < 0.09) & (np.abs(U) < 0.28))
    rgb[cross] = hexc('#1a1626')
    base = (np.abs(U) < 0.78) & (V >= 0.7) & (V < 0.92)
    rgb[base] = hexc('#2a2438'); al[base] = 1
    a = al > 0; out = np.zeros_like(a)
    for dy, dx in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
        out |= np.roll(np.roll(a, dy, 0), dx, 1)
    e = out & ~a; rgb[e] = hexc('#07050a'); al[e] = 1
    return rgb, al


def app_icon(size, pad):
    n = 64
    img = stone_tile(96)[:n, :n] * 0.9
    rgb, a = rune_ring(n - pad * 2)
    cols = {'W': '#ffe680', 'U': '#5ab0ff', 'B': '#b060ff', 'R': '#ff6a2a', 'G': '#5ae07a'}
    sub = img[pad:n - pad, pad:n - pad]
    m = a > 0
    sub[m] = sub[m] * (1 - a[m][:, None] * 0.9) + hexc('#b9a6ff') * a[m][:, None] * 0.9
    k = n - pad * 2; c = (k - 1) / 2; R = k * 0.46 * 0.86
    X, Y = np.meshgrid(np.arange(k), np.arange(k))
    for i, key in enumerate('WUBRG'):
        px = c + math.cos(-math.pi / 2 + i * 2 * math.pi / 5) * R; py = c + math.sin(-math.pi / 2 + i * 2 * math.pi / 5) * R
        sub[np.hypot(X - px, Y - py) < k * 0.075] = hexc(cols[key])
    arr = np.clip(img, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGB').resize((size, size), Image.NEAREST)


if __name__ == '__main__':
    scenes = {'W': scene_plains, 'U': scene_island, 'B': scene_swamp, 'R': scene_mountain, 'G': scene_forest}
    for k, fn in scenes.items():
        img = fn(); al = frame(img, k); save(img, f'card-{k}.png', al)
        img = card_simple(k); al = frame(img, k); save(img, f'simple-{k}.png', al)
        rgb, al = emblem(k, 32); save(rgb, f'ico-{k}.png', al)
    img, al = card_back(); save(img, 'back.png', al)
    save(stone_tile(), 'stone.png')
    rgb, al = rune_ring(); save(rgb, 'runes.png', al)
    rgb, al = tomb(); save(rgb, 'tomb.png', al)
    icons = os.path.join(OUT, '..', 'icons')
    app_icon(192, 4).save(os.path.join(icons, 'icon-192.png'))
    app_icon(512, 4).save(os.path.join(icons, 'icon-512.png'))
    app_icon(180, 4).save(os.path.join(icons, 'apple-touch-icon.png'))
    app_icon(512, 10).save(os.path.join(icons, 'icon-maskable-512.png'))
    # foglio di anteprima
    names = [f'card-{k}.png' for k in 'WUBRG'] + [f'simple-{k}.png' for k in 'WUBRG']
    sheet = Image.new('RGB', (5 * (W + 6) * 3, 2 * (H + 6) * 3 + 110), '#101018')
    for i, nme in enumerate(names):
        im = Image.open(os.path.join(OUT, nme)).convert('RGBA').resize((W * 3, H * 3), Image.NEAREST)
        sheet.paste(im, ((i % 5) * (W + 6) * 3 + 9, (i // 5) * (H + 6) * 3 + 9), im)
    x = 9
    for nme in [f'ico-{k}.png' for k in 'WUBRG'] + ['tomb.png', 'back.png', 'runes.png', 'stone.png']:
        im = Image.open(os.path.join(OUT, nme)).convert('RGBA')
        s = 3 if im.width <= 32 else 1
        im = im.resize((im.width * s, im.height * s), Image.NEAREST)
        if im.height > 100: im = im.crop((0, 0, im.width, 100))
        sheet.paste(im, (x, 2 * (H + 6) * 3 + 8), im); x += im.width + 10
    sheet.save('/tmp/art_preview.png')
    print('ok')
