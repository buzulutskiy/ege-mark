# -*- coding: utf-8 -*-
"""«Решу ЕГЭ» отдаёт формулы картинками, а в alt пишет их словами:
   «x левая круглая скобка t правая круглая скобка = 10 плюс 4t в квадрате».
   Когда картинка не грузится, ученик читает вот это. Переводим в нормальную запись."""
import json, re, sys

SUP = {"0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","-":"⁻"}
SUB = {"0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉","x":"ₓ","y":"ᵧ"}

def fix(t):
    if not t or not isinstance(t, str):
        return t
    s = t
    for _ in range(4):                       # дроби и корни бывают вложенными
        s = re.sub(r"дробь:\s*числитель:\s*(.+?),\s*знаменатель:\s*(.+?)\s*конец дроби",
                   r"(\1)/(\2)", s)
        s = re.sub(r"корень из:\s*начало аргумента:\s*(.+?)\s*конец аргумента", r"√(\1)", s)
    # логарифм: «логарифм по основанию 5 (4 + x)» → log₅(4 + x)
    s = re.sub(r"логарифм(?:ы)?\s+по\s+основанию\s*\(?\s*([^\s()]{1,12})\s*\)?",
               lambda m: "log" + "".join(SUB.get(c, c) for c in m.group(1)), s)
    s = re.sub(r"\blog\s+по\s+основанию\s*\(?\s*([^\s()]{1,12})\s*\)?",
               lambda m: "log" + "".join(SUB.get(c, c) for c in m.group(1)), s)
    # корень n-й степени
    def _root(sym, body):
        b = body.strip()
        return sym + (b if b.startswith("(") else "(" + b + ")")
    s = re.sub(r"корень\s+(\d+)\s+степени\s+из:?\s*начало аргумента:\s*(.+?)\s*конец аргумента",
               lambda m: _root({"3": "∛", "4": "∜"}.get(m.group(1), m.group(1) + "√"), m.group(2)), s)
    s = re.sub(r"корень\s+из:?\s*начало аргумента:\s*(.+?)\s*конец аргумента",
               lambda m: _root("√", m.group(1)), s)
    s = re.sub(r"корень\s+(\d+)\s+степени\s+из:?\s*", lambda m: {"3": "∛", "4": "∜"}.get(
        m.group(1), m.group(1) + "√"), s)
    s = re.sub(r"корень\s+из:?\s*", "√", s)
    s = re.sub(r"целая часть:\s*(\S+?),\s*дробная часть:\s*", r"\1 ", s)
    # смешанное число: «7 числитель: 3, знаменатель: 7» → 7 3/7
    s = re.sub(r"числитель:\s*([^,]{1,20}?),\s*знаменатель:\s*([^\s,.;)]{1,20})", r"\1/\2", s)
    s = re.sub(r"\s*конец дроби", "", s)
    s = re.sub(r"начало аргумента:\s*", "", s)
    s = re.sub(r"\s*конец аргумента", "", s)
    s = s.replace("левая круглая скобка", "(").replace("правая круглая скобка", ")")
    s = s.replace("левая квадратная скобка", "[").replace("правая квадратная скобка", "]")
    s = s.replace("левая фигурная скобка", "{").replace("правая фигурная скобка", "}")
    # степень выражением: «2 в степени (4 −2x)» → 2^(4−2x)
    for _ in range(3):
        s = re.sub(r"\s*в степени\s*\(([^()]{1,40})\)", lambda m: "^(%s)" % m.group(1).strip(), s)
    s = re.sub(r"\s*в степени\s*(-?\d+(?:[,.]\d+)?)",
               lambda m: ("".join(SUP.get(c, c) for c in m.group(1))
                          if re.fullmatch(r"-?\d+", m.group(1)) else "^" + m.group(1)), s)
    s = re.sub(r"\s*в степени\s*([A-Za-zА-Яа-я])", r"^\1", s)
    s = re.sub(r"\s*в квадрате", "²", s)
    s = re.sub(r"\s*в кубе", "³", s)
    s = re.sub(r"\s*умножить на\s*", " · ", s)
    s = re.sub(r"\s*разделить на\s*", " : ", s)
    s = re.sub(r"(^|[\s(=,])плюс\s*", r"\1+ ", s)
    s = re.sub(r"(^|[\s(=,])минус\s*", r"\1−", s)
    s = re.sub(r"\bравносильно\b", " ⇔ ", s)
    s = s.replace("Пи ", "π").replace(" Пи", "π").replace("p i", "π")
    s = re.sub(r"\bдесятичный логарифм\b", "lg", s)
    s = re.sub(r"\bкосинус\s*", "cos ", s)
    s = re.sub(r"\bсинус\s*", "sin ", s)
    s = re.sub(r"\bтангенс\s*", "tg ", s)
    s = re.sub(r"\bкотангенс\s*", "ctg ", s)
    s = re.sub(r"\bRightarrow\b", " ⇒ ", s)
    s = re.sub(r"\bleft\||\bright\|", "|", s)
    s = re.sub(r"\bleft\(|\bright\)", "", s)
    s = re.sub(r"\s*_\s*([0-9xy]+)", lambda m: "".join(SUB.get(c, c) for c in m.group(1)), s)
    s = re.sub(r"\s*_\s*parallel", "∥", s)
    s = re.sub(r"\s*_\s*(bot|perp)", "⊥", s)
    s = re.sub(r"\(\s+", "(", s)
    s = re.sub(r"\s+\)", ")", s)
    s = re.sub(r"\((\d+(?:[.,]\d+)?)\)/\((\d+(?:[.,]\d+)?)\)", r"\1/\2", s)
    s = re.sub(r"(\d|\))\s+−(?=[\dA-Za-zА-Яа-я(])", r"\1 − ", s)
    s = re.sub(r"\s{2,}", " ", s)
    return re.sub(r"\s+([,.;)])", r"\1", s).strip()

def clean_bank(sid):
    p = "bank/bank-%s.json" % sid
    d = json.load(open(p, encoding="utf-8"))
    n = 0
    for q in d["tasks"]:
        before = (q.get("html", ""), q.get("plain", ""), q.get("solution", ""))
        q["html"] = re.sub(r'alt="([^"]*)"', lambda m: 'alt="%s"' % fix(m.group(1)).replace('"', "'"),
                           q.get("html") or "")
        q["plain"] = fix(q.get("plain"))
        q["solution"] = fix(q.get("solution"))
        if (q["html"], q["plain"], q["solution"]) != before:
            n += 1
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False)
    print("%s: поправлено задач %d из %d" % (sid, n, len(d["tasks"])))

if __name__ == "__main__":
    for sid in (sys.argv[1:] or ["fiz", "mat", "rus"]):
        clean_bank(sid)
