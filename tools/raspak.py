# -*- coding: utf-8 -*-
"""Картинки сохранились сжатыми: распаковываем на месте и чиним расширения."""
import os, gzip, json, collections, sys

D = "bank/img"

def sniff(b):
    if b[:4] == b"\x89PNG": return ".png"
    if b[:3] == b"GIF": return ".gif"
    if b[:2] == b"\xff\xd8": return ".jpg"
    h = b[:400].lstrip()
    if h[:5] == b"<?xml" or h[:4] == b"<svg": return ".svg"
    return None

def main():
    ren, fixed, bad = {}, 0, 0
    for n in sorted(os.listdir(D)):
        p = os.path.join(D, n)
        try:
            data = open(p, "rb").read()
        except Exception:
            continue
        if data[:2] == b"\x1f\x8b":
            try:
                data = gzip.decompress(data)
            except Exception:
                bad += 1; continue
            open(p, "wb").write(data)
            fixed += 1
        ext = sniff(data)
        if ext and not n.lower().endswith(ext):
            new = os.path.splitext(n)[0] + ext
            os.rename(p, os.path.join(D, new))
            ren[n] = new
    print("распаковано: %d, переименовано: %d, не поддалось: %d" % (fixed, len(ren), bad))
    if ren:
        for sid in ("fiz", "mat", "rus"):
            f = "bank/bank-%s.json" % sid
            if not os.path.exists(f): continue
            d = json.load(open(f, encoding="utf-8"))
            n = 0
            for q in d["tasks"]:
                for old, new in ren.items():
                    if old in (q.get("html") or ""):
                        q["html"] = q["html"].replace(old, new); n += 1
                    if isinstance(q.get("img"), list):
                        q["img"] = [new if x == old else x for x in q["img"]]
            json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False)
            print("  %s: обновлено ссылок %d" % (sid, n))

if __name__ == "__main__":
    main()
