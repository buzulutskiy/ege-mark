# -*- coding: utf-8 -*-
"""Переименовывает уже скачанные картинки по их настоящему формату и правит ссылки в банке."""
import json, glob, os, re
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
IMG = os.path.join(ROOT, "bank", "img")

def ext_of(d):
    if d[:4] == b"\x89PNG": return ".png"
    if d[:3] == b"GIF": return ".gif"
    if d[:2] == b"\xff\xd8": return ".jpg"
    h = d[:400].lstrip()
    if h[:5] == b"<?xml" or h[:4] == b"<svg": return ".svg"
    return ".png"

ren = {}
for f in os.listdir(IMG):
    path = os.path.join(IMG, f)
    if not os.path.isfile(path): continue
    stem, cur = os.path.splitext(f)
    real = ext_of(open(path, "rb").read(512))
    if real != cur:
        os.rename(path, os.path.join(IMG, stem + real))
        ren[f] = stem + real
print("переименовано файлов:", len(ren))

for bf in glob.glob(os.path.join(ROOT, "bank", "bank-*.json")):
    d = json.load(open(bf, encoding="utf-8")); n = 0
    for t in d["tasks"]:
        for old, new in ren.items():
            if old in t.get("html", ""):
                t["html"] = t["html"].replace(old, new); n += 1
            t["img"] = [new if x == old else x for x in t.get("img", [])]
    json.dump(d, open(bf, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(" ", os.path.basename(bf), "— поправлено ссылок:", n)
