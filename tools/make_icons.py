#!/usr/bin/env python3
"""Genera le icone della PWA nello stile Atlante (rosa dei venti e i cinque segni delle terre).
Uso: python3 tools/make_icons.py   (serve Playwright con Chrome installato)"""
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
ART = (ROOT / 'public' / 'art.js').read_text()
PAGE = """<!doctype html><html><body style="margin:0"><div id="i"></div><script>%s</script><script>
const S = +location.hash.slice(1).split(',')[0], PAD = +location.hash.slice(1).split(',')[1];
const el = document.getElementById('i'), cs = (v) => getComputedStyle(document.documentElement).getPropertyValue(v);
el.style.cssText = `position:relative;width:${S}px;height:${S}px;overflow:hidden;background:radial-gradient(circle at 50%% 42%%,#17454f,#0a232b)`;
const add = (bg, x, y, w, extra = '') => { const d = document.createElement('i'); d.style.cssText = `position:absolute;left:${x - w / 2}px;top:${y - w / 2}px;width:${w}px;height:${w}px;background:${bg} center/contain no-repeat;${extra}`; el.appendChild(d); };
const R = S * (0.5 - PAD), c = S / 2;
add(cs('--rose-n'), c, c, R * 2.05, 'opacity:.9');
ATL.L.forEach((l, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; add(cs('--ico-' + l), c + Math.cos(a) * R * 0.66, c + Math.sin(a) * R * 0.66, R * 0.5, `border-radius:50%%;box-shadow:0 0 0 ${R * 0.045}px #f4eddd,0 ${R * 0.05}px ${R * 0.1}px #0008`); });
</script></body></html>""" % ART

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for name, size, pad in [('icon-192', 192, 0.06), ('icon-512', 512, 0.06), ('apple-touch-icon', 180, 0.08), ('icon-maskable-512', 512, 0.16)]:
        pg = b.new_page(viewport={'width': size, 'height': size})
        f = ROOT / 'tools' / '_icon.html'; f.write_text(PAGE)
        pg.goto(f'file://{f}#{size},{pad}'); pg.wait_for_timeout(400)
        pg.screenshot(path=str(ROOT / 'public' / 'icons' / f'{name}.png'))
        pg.close(); f.unlink()
    b.close()
