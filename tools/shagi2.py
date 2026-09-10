# -*- coding: utf-8 -*-
"""Оборачивает официальный разбор в пошаговое прохождение.

Ничего не выдумывает: берёт текст разбора, режет по вычисленным величинам
и прячет результат — ученик должен назвать его сам, потом видит продолжение.

Запуск:  python3 tools/shagi2.py fiz 1
"""
import json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")

NUM = r"-?−?\d+(?:[.,]\d+)?"
UNITS = r"(?:м/с²|м/с2|км/ч|м/с|кг/м³|Дж|Н·м|Н|Вт|кг|К|с|м|%|Кл|А|В|Ом)"
# результат = число в самом конце предложения, возможно с единицей: «… = 7,5 м/с.»
RESULT = re.compile(r"(?:=|равн[оаы]|составля[ею]т|получ[аи][ею]тся|это)\s*"
                    r"(" + NUM + r")\s*(" + UNITS + r")?\s*[.;]?\s*$", re.I)
UNIT = {"м/с": "в метрах в секунду", "км/ч": "в километрах в час", "м": "в метрах",
        "с": "в секундах", "м/с²": "в м/с²", "м/с2": "в м/с²", "кг": "в килограммах",
        "Дж": "в джоулях", "Н": "в ньютонах", "Вт": "в ваттах", "А": "в амперах",
        "В": "в вольтах", "Ом": "в омах", "К": "в кельвинах"}

def norm(x):
    x = str(x).strip().replace("−", "-").replace(",", ".")
    try:
        f = float(x)
        return str(int(f)) if f == int(f) else str(round(f, 4))
    except ValueError:
        return x


def sentences(t):
    t = re.sub(r"\s+", " ", t).strip()
    parts = re.split(r"(?<=[.!?])\s+(?=[А-ЯA-ZЁ])", t)
    return [p.strip() for p in parts if len(p.strip()) > 2]


ASK = re.compile(r"(?:что|которая|которое|которую)?\s*([а-яa-z][^,.;:]{6,70}?)\s*"
                 r"(?:равн[оаы]|составля[ею]т|получ[аи][ею]тся|=)\s*$", re.I)
DROP = re.compile(r"^(из графика видно,?\s*что|видно,?\s*что|получаем,?\s*что|"
                  r"значит,?|отсюда|тогда|таким образом,?|итак,?|следовательно,?)\s*", re.I)


BAD = re.compile(r"[=|]|\d|\b(решим|имеем|получим|найдём|найдем|определим|подставим|"
                 r"равн[аоы]|это|значит|тогда|будет|есть)\b", re.I)


def nudge(lead, unit):
    """Короткий вопрос вместо готового решения. Если фраза кривая — не выдумываем."""
    q = "Сколько получится?"
    tail = re.split(r"(?<=[.;])\s+", lead.strip())[-1]
    tail = DROP.sub("", tail).strip()
    m = ASK.search(tail)
    what = DROP.sub("", (m.group(1) if m else "")).strip(" ,")
    if what and 6 < len(what) < 46 and not BAD.search(what):
        fem = re.match(r"^(скорост|координат|площад|высот|длительност|масс|сил|энерги|"
                       r"работ|мощност|температур|частот|амплитуд|длин|глубин|плотност)", what, re.I)
        q = ("Чему равна " if fem else "Чему равно ") + what[0].lower() + what[1:] + "?"
    if unit in UNIT:
        q += " Ответ " + UNIT[unit] + "."
    return q


def build(q, maxsteps=4):
    sol = q.get("solution") or ""
    ans = norm(q.get("answer", ""))
    if len(sol) < 60 or not ans:
        return None
    sents = sentences(sol)
    steps, buf = [], []
    for s in sents:
        m = RESULT.search(s)
        if not m:
            buf.append(s)
            continue
        val, unit = m.group(1), (m.group(2) or "")
        lead = " ".join(buf + [s[:m.start(1)].rstrip()]).strip()
        steps.append({"lead": lead, "a": val.replace("\u2212", "-"), "unit": unit,
                      "q": nudge(lead, unit), "tail": s[m.end():].strip()})
        buf = []
    if buf and steps:
        steps[-1]["tail"] = (steps[-1].get("tail", "") + " " + " ".join(buf)).strip()
    if not steps:
        return None
    while len(steps) > maxsteps:
        a, b = steps[0], steps[1]
        b["lead"] = (a["lead"] + " " + a["a"] + (a["unit"] or "") + ". " + (a["tail"] or "") + " " + b["lead"]).strip()
        steps.pop(0)
    if norm(steps[-1]["a"]) != ans:
        steps.append({"lead": "Все части посчитаны, осталось записать итог.",
                      "a": q["answer"], "unit": "", "tail": "", "q": "Какой ответ у задачи?"})
    return steps if len(steps) >= 2 else None


def main():
    sid = sys.argv[1] if len(sys.argv) > 1 else "fiz"
    only = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    path = os.path.join(ROOT, "bank", "bank-%s.json" % sid)
    d = json.load(open(path, encoding="utf-8"))
    ok = skip = 0
    for q in d["tasks"]:
        if only and q.get("task") != only:
            continue
        st = build(q)
        if st:
            q["steps"] = st
            ok += 1
        else:
            q.pop("steps", None)
            skip += 1
    json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("разложено по шагам: %d · не поддалось: %d" % (ok, skip))


if __name__ == "__main__":
    main()
