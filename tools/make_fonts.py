#!/usr/bin/env python3
"""Sottoinsiemi latini dei caratteri usati dallo stile Atlante (WOFF).
TeX Gyre Adventor: GUST Font License. Lora: SIL Open Font License."""
import os, sys, subprocess, glob
OUT = os.path.join(os.path.dirname(__file__), '..', 'fonts')
def find(pat):
    out = subprocess.run(['fc-list', '--format', '%{file}\n'], capture_output=True, text=True).stdout.split('\n')
    m = [f for f in out if pat in f.lower()]
    return sorted(m)[0] if m else None
from fontTools import subset
from fontTools.ttLib import TTFont
UNI = 'U+0020-007E,U+00A0-00FF,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026,U+00B7,U+00D7,U+221E,U+2039,U+203A'
def make(src, name):
    opts = subset.Options(); opts.flavor = 'woff'; opts.layout_features = ['kern', 'liga']; opts.hinting = False; opts.desubroutinize = True
    f = TTFont(src, fontNumber=0); s = subset.Subsetter(opts); s.populate(unicodes=subset.parse_unicodes(UNI)); s.subset(f)
    f.flavor = 'woff'; p = os.path.join(OUT, name); f.save(p); print(name, os.path.getsize(p))
if __name__ == '__main__':
    for arg in sys.argv[1:]:
        src, name = arg.split('=')
        make(src, name)
