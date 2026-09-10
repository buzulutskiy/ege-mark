# -*- coding: utf-8 -*-
"""Делает PNG-копии графиков для нейросети: SVG она не понимает, а PNG видит.

В самом приложении по-прежнему показываются SVG — они чётче.
Запуск:  python3 tools/topng.py
"""
import os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "bank", "img")
DST = os.path.join(ROOT, "bank", "png")
os.makedirs(DST, exist_ok=True)

files = [f for f in os.listdir(SRC) if f.endswith(".svg")]
todo = [f for f in files if not os.path.exists(os.path.join(DST, f[:-4] + ".png"))]
print("svg всего %d, конвертировать %d" % (len(files), len(todo)))

def one(f):
    out = os.path.join(DST, f[:-4] + ".png")
    try:
        subprocess.run(["rsvg-convert", "-w", "700", "-b", "white",
                        "-o", out, os.path.join(SRC, f)],
                       check=True, capture_output=True, timeout=25)
        return True
    except Exception:
        return False

with ThreadPoolExecutor(max_workers=8) as ex:
    ok = sum(1 for r in ex.map(one, todo) if r)
print("готово %d, не вышло %d" % (ok, len(todo) - ok))
size = sum(os.path.getsize(os.path.join(DST, f)) for f in os.listdir(DST)) / 1e6
print("вес папки png: %.0f МБ" % size)
