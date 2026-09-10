# -*- coding: utf-8 -*-
"""Возвращает символы в разборы: «дробь: числитель: S, знаменатель: t конец дроби» → «S/t».

Источник пишет формулы словами для чтения вслух. Читать это глазами невозможно.
Запуск:  python3 tools/slova.py
"""
import glob, json, os, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

RULES = [
    (r"дробь:\s*числитель:\s*(.+?),\s*знаменатель:\s*(.+?)\s*конец дроби", r"(\1)/(\2)"),
    (r"корень из:?\s*(.+?)\s*конец корня", r"√(\1)"),
    (r"\s*левая круглая скобка\s*", "("),
    (r"\s*правая круглая скобка\s*", ")"),
    (r"\s*левая фигурная скобка\s*", "{"),
    (r"\s*правая фигурная скобка\s*", "}"),
    (r"\s*в степени\s*", "^"),
    (r"\bне равно\b", "≠"),
    (r"\bбольше или равно\b", "≥"),
    (r"\bменьше или равно\b", "≤"),
    (r"\bприблизительно равно\b", "≈"),
    (r"\bvec\s+", ""),
]
# «плюс» и «минус» между числами или буквами — это знаки. В остальных случаях не трогаем.
SIGN = [
    (r"(?<=[\dA-Za-zА-Яа-я_\)])\s+плюс\s+(?=[\d\(A-Za-zА-Яа-я])", " + "),
    (r"(?<=[\dA-Za-zА-Яа-я_\)])\s+минус\s+(?=[\d\(A-Za-zА-Яа-я])", " − "),
]


def clean(t):
    if not t:
        return t
    for pat, rep in RULES:
        t = re.sub(pat, rep, t)
    for pat, rep in SIGN:
        t = re.sub(pat, rep, t)
    t = re.sub(r"\s*=\s*", " = ", t)
    t = re.sub(r"\s+([,.;:])", r"\1", t)
    return re.sub(r"\s{2,}", " ", t).strip()


if __name__ == "__main__":
    for f in glob.glob(os.path.join(ROOT, "bank", "bank-*.json")):
        d = json.load(open(f, encoding="utf-8"))
        n = 0
        for t in d["tasks"]:
            for k in ("solution", "plain"):
                v = t.get(k)
                if not v:
                    continue
                c = clean(v)
                if c != v:
                    t[k] = c
                    n += 1
        json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("%s — почищено полей: %d" % (os.path.basename(f), n))
