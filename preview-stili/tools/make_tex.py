#!/usr/bin/env python3
"""Texture precalcolate (WebP) per le anteprime. Uso: python3 tools/make_tex.py"""
import os, numpy as np
from PIL import Image
OUT = os.path.join(os.path.dirname(__file__), '..', 'tex')
rng = np.random.default_rng(3)
def tile_noise(n, sc):
    g = rng.random((n // sc, n // sc))
    im = Image.fromarray((g * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)
    return np.asarray(im) / 255.0
# tela scura (stile 1)
n = 192
v = 0.5 * tile_noise(n, 2) + 0.3 * tile_noise(n, 8) + 0.2 * tile_noise(n, 32)
weave = (np.sin(np.arange(n) * 1.3)[None, :] + np.sin(np.arange(n) * 1.3)[:, None]) * 0.04
v = np.clip(v + weave, 0, 1)
rgb = np.stack([22 + v * 20, 24 + v * 20, 30 + v * 22], -1).astype(np.uint8)
Image.fromarray(rgb).save(os.path.join(OUT, 'tela.webp'), quality=70)
# legno (stile 2)
n = 256
y = np.arange(n)[:, None]; x = np.arange(n)[None, :]
warp = tile_noise(n, 32) * 10
grain = np.sin((y + warp) * 0.55 + np.sin(x * 2 * np.pi / n) * 1.5) * 0.5 + 0.5
v = 0.55 * grain + 0.45 * tile_noise(n, 4)
plank = ((y // 64) % 2) * 0.06
edge = (y % 64 < 2) * 0.35
v = np.clip(v * 0.55 + 0.25 + plank - edge, 0, 1)
rgb = np.stack([40 + v * 95, 22 + v * 55, 10 + v * 28], -1).astype(np.uint8)
Image.fromarray(rgb).save(os.path.join(OUT, 'legno.webp'), quality=72)
print('ok')
