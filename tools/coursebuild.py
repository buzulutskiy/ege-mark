#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка курса из блоков теории и банка задач.

    python3 tools/coursebuild.py <папка-с-блоками> [номер задания]

Блок теории на приём — JSON, который написали агенты: teach, quiz, warms, recap.
Задачи в курс раскладываются сами, по эталону (docs/etalon-kursa.md):

    теория приёма → вопрос → и дальше по каждому подвиду:
    разминка → настоящая задача с разбором → близнец → остальные настоящие задачи
    и в конце приёма — итог.

Порядок приёмов задан в PORYADOK: от «снять число с графика» до тех, где нужны формулы.
Внутри подвида первой показывают задачу с самым коротким разбором — она проще.
"""
import json, os, sys, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PORYADOK = [
    ("read_xs", "Часть 1. Где тело и насколько сдвинулось"),
    ("slope_v", "Часть 2. Скорость"),
    ("slope_a", "Часть 3. Ускорение"),
    ("area_s",  "Часть 4. Путь через площадь"),
    ("area_d",  "Часть 5. Площадь со знаком"),
    ("avg",     "Часть 6. Средняя скорость"),
    ("form",    "Часть 7. Формулы разгона"),
    ("eq",      "Часть 8. Когда дана формула"),
    ("parab",   "Часть 9. Парабола и таблица"),
    ("from_a",  "Часть 10. График ускорения"),
    ("rel",     "Часть 11. Река, автобус, эскалатор"),
    ("pif",     "Часть 12. Когда дорога поворачивает"),
]


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def size_of_razbor(z):
    """Насколько длинный разбор — грубая мера сложности задачи."""
    if not z:
        return 10 ** 6
    n = sum(len(x) for x in z.get("dano", []))
    n += sum(len(p) for st in z.get("steps", []) for p in st.get("p", []))
    return n


def build(blocks_dir, num=1, sid="fiz"):
    plan = load(f"{ROOT}/lessons/plan-{sid}.json")[str(num)]
    raz = load(f"{ROOT}/lessons/razbor-{sid}-{num}.json")
    bank = {t["id"]: t for t in load(f"{ROOT}/bank/bank-{sid}.json")["tasks"]}

    groups = {g["key"]: g for g in plan["groups"]}
    steps, missing_blocks = [], []

    for key, part in PORYADOK:
        g = groups.get(key)
        if not g:
            missing_blocks.append(f"приёма {key} нет в плане")
            continue
        bp = os.path.join(blocks_dir, key + ".json")
        if not os.path.exists(bp):
            missing_blocks.append(f"нет блока теории {key}.json")
            continue
        b = load(bp)

        # 1. теория
        for t in b.get("teach", []):
            st = {"t": "teach", "part": part, "title": t["title"], "p": t["p"]}
            if t.get("ill"):
                st["ill"] = t["ill"]
            if t.get("f"):
                st["f"] = t["f"]
            if t.get("note"):
                st["note"] = t["note"]
            steps.append(st)

        # 2. вопрос на понимание
        q = b.get("quiz")
        if q:
            st = {"t": "quiz", "part": part, "q": q["q"], "opts": q["opts"], "ok": q["ok"], "why": q["why"]}
            if q.get("ill"):
                st["ill"] = q["ill"]
            steps.append(st)

        # 3. по каждому подвиду: разминка → пример → близнец → остальные настоящие
        warms = {w.get("sub", "").strip(): w for w in b.get("warms", [])}
        subs = g.get("subs") or [g]
        for s in subs:
            title = (s.get("title") or g["title"]).strip()
            tasks = sorted(s.get("tasks", []), key=lambda i: size_of_razbor(raz.get(i)))
            w = warms.get(title)
            if w:
                st = {"t": "warm", "part": part, "title": w["title"], "q": w["q"],
                      "steps": w["steps"], "a": w["a"]}
                if w.get("ill"):
                    st["ill"] = w["ill"]
                if w.get("note"):
                    st["note"] = w["note"]
                if w.get("kind"):
                    st["key"], st["kind"] = key, w["kind"]
                steps.append(st)
            else:
                missing_blocks.append(f"{key}: нет разминки для подвида «{title}»")

            if tasks:
                steps.append({"t": "show", "part": part, "id": tasks[0]})
                if w and w.get("kind"):
                    steps.append({"t": "solve", "part": part, "key": key, "kind": w["kind"]})
                for i in tasks[1:]:
                    steps.append({"t": "real", "part": part, "id": i})

        # 4. итог приёма
        r = b.get("recap")
        if r:
            st = {"t": "recap", "part": part, "title": r["title"], "can": r["can"], "trap": r.get("trap", "")}
            if r.get("f"):
                st["f"] = r["f"]
            steps.append(st)

    return steps, missing_blocks


if __name__ == "__main__":
    blocks = sys.argv[1] if len(sys.argv) > 1 else "/tmp/theory"
    num = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    steps, missing = build(blocks, num)

    course = {
        "id": f"fiz-{num}", "subj": "fiz", "task": num,
        "title": "Кинематика с нуля",
        "subtitle": "Теория и задачи вперемешку: объясняем — показываем — даёшь решить сам",
        "steps": steps,
    }
    out = f"{ROOT}/lessons/course-fiz-{num}.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(course, f, ensure_ascii=False, indent=1)

    kinds = {}
    for s in steps:
        kinds[s["t"]] = kinds.get(s["t"], 0) + 1
    print(f"собрано {len(steps)} шагов: " + ", ".join(f"{k} {v}" for k, v in sorted(kinds.items())))
    if missing:
        print(f"\nне хватило ({len(missing)}):")
        for m in missing:
            print("  " + m)
    print(f"\nзаписано {out}")
