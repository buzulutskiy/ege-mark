# -*- coding: utf-8 -*-
"""Выкидываем настоящие повторы: одинаковый текст и ответ, либо тот же рисунок
   с тем же ответом и той же формулировкой с точностью до чисел."""
import json, re, collections, sys

def norm(s):
    s = (s or "").lower()
    s = re.sub(r"<!--.*?-->", " ", s, flags=re.S)
    s = re.sub(r"[^а-яёa-z0-9=,.\- ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def mask(s):
    return re.sub(r"[\d,.]+", "#", norm(s))

def dups(tasks):
    """id → id-оригинала, который оставляем"""
    out = {}
    seen_txt = {}
    seen_pic = {}
    for q in tasks:
        a = str(q.get("answer", "")).strip()
        k1 = (norm(q.get("plain")), a)
        if k1 in seen_txt:
            out[q["id"]] = seen_txt[k1]; continue
        seen_txt[k1] = q["id"]
        pic = str(q.get("img") or "")
        if pic and pic != "[]":
            k2 = (pic, mask(q.get("plain")), a)
            if k2 in seen_pic:
                out[q["id"]] = seen_pic[k2]; continue
            seen_pic[k2] = q["id"]
    return out

if __name__ == "__main__":
    sid = sys.argv[1] if len(sys.argv) > 1 else "fiz"
    t = json.load(open("bank/bank-%s.json" % sid, encoding="utf-8"))["tasks"]
    by = collections.defaultdict(list)
    for q in t: by[str(q["task"])].append(q)
    tot = 0
    for n in sorted(by, key=lambda x: int(x) if x.isdigit() else 99):
        d = dups(by[n])
        if d:
            tot += len(d)
            print("задание %-3s повторов %d: %s" % (n, len(d), ", ".join("%s→%s" % kv for kv in list(d.items())[:4])))
    print("всего повторов:", tot)
