# -*- coding: utf-8 -*-
"""Убирает namespace-префикс m: в уже собранных банках — иначе браузер не рисует формулы."""
import json, glob, os
for f in glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "bank", "bank-*.json")):
    d = json.load(open(f, encoding="utf-8"))
    k = 0
    for t in d["tasks"]:
        if "<m:" in t["html"]:
            t["html"] = t["html"].replace("<m:", "<").replace("</m:", "</"); k += 1
    json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(os.path.basename(f), "— поправлено", k, "из", len(d["tasks"]))
