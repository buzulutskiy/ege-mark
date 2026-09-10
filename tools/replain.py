# -*- coding: utf-8 -*-
"""Пересобирает plain у уже скачанных заданий — с подписями формул."""
import json, glob, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bank2
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
for f in glob.glob(os.path.join(ROOT, "bank", "bank-*.json")):
    d = json.load(open(f, encoding="utf-8")); fixed = 0
    for t in d["tasks"]:
        new = bank2.txt(t["html"])[:600]
        if new != t.get("plain"):
            t["plain"] = new; fixed += 1
    json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(os.path.basename(f), "— обновлено", fixed, "из", len(d["tasks"]))
