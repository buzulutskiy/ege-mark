#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка курса из микрошагов.

    python3 tools/microbuild.py <папка-с-блоками> [номер] [ключ-приёма ...]

Отличие от coursebuild.py: ничего не вываливается целиком.

Теория режется на отдельные мысли — один абзац это один экран. После каждых двух-трёх
мыслей встаёт короткий вопрос.

Задача тоже не показывается сразу. Она разбирается по шагам, которые уже написаны
в lessons/q-<sid>.json:
    прочитать условие → что дано и что найти (выбор) → какая формула и почему →
    микровопрос → микровопрос → … → решение целиком и в тетрадь.
И только после этого — такая же задача самостоятельно, а потом настоящие из банка.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PORYADOK = [
    ("read_xs", "Шаг 1. Где тело и насколько сдвинулось"),
    ("slope_v", "Шаг 2. Скорость"),
    ("slope_a", "Шаг 3. Ускорение"),
    ("area_s",  "Шаг 4. Путь через площадь"),
    ("area_d",  "Шаг 5. Площадь со знаком"),
    ("avg",     "Шаг 6. Средняя скорость"),
    ("form",    "Шаг 7. Формулы разгона"),
    ("eq",      "Шаг 8. Когда дана формула"),
    ("parab",   "Шаг 9. Парабола и таблица"),
    ("from_a",  "Шаг 10. График ускорения"),
    ("rel",     "Шаг 11. Река, автобус, эскалатор"),
    ("pif",     "Шаг 12. Когда дорога поворачивает"),
]


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def ideas_from_teach(t, part):
    """Большой кусок теории → несколько экранов по одной мысли.

    Заголовок и картинка достаются первому экрану, формулы — последнему:
    формула нужна после того, как мысль уже объяснена словами.
    """
    out = []
    ps = [x for x in (t.get("p") or []) if x.strip()]
    for n, p in enumerate(ps):
        step = {"t": "idea", "part": part, "p": [p]}
        if n == 0:
            step["title"] = t["title"]
            if t.get("ill"):
                step["ill"] = t["ill"]
            step["tag"] = "разбираемся"
        if n == len(ps) - 1 and t.get("f"):
            step["f"] = t["f"]
        out.append(step)
    if t.get("note"):
        out.append({"t": "idea", "part": part, "tag": "запомни", "p": [t["note"]]})
    return out


def task_chain(tid, q, part, first):
    """Одна задача → цепочка микрошагов."""
    out = [{"t": "read", "part": part, "id": tid}]
    if q.get("simple"):
        out[0]["simple"] = q["simple"]
    if q.get("choice"):
        out.append({"t": "ask", "part": part, "id": tid})
    if (q.get("formula") or {}).get("f"):
        out.append({"t": "pickf", "part": part, "id": tid})
    for k in range(len(q.get("steps") or [])):
        out.append({"t": "micro", "part": part, "id": tid, "k": k})
    out.append({"t": "whole", "part": part, "id": tid})
    return out


def size_of(raz, i):
    z = raz.get(i)
    if not z:
        return 10 ** 6
    return sum(len(x) for x in z.get("dano", [])) + \
        sum(len(p) for st in z.get("steps", []) for p in st.get("p", []))


def build(blocks_dir, num=1, sid="fiz", only=None):
    plan = load(f"{ROOT}/lessons/plan-{sid}.json")[str(num)]
    raz = load(f"{ROOT}/lessons/razbor-{sid}-{num}.json")
    qx = load(f"{ROOT}/lessons/q-{sid}.json")
    groups = {g["key"]: g for g in plan["groups"]}

    steps, missing = [], []
    for key, part in PORYADOK:
        if only and key not in only:
            continue
        g = groups.get(key)
        bp = os.path.join(blocks_dir, key + ".json")
        if not g or not os.path.exists(bp):
            missing.append(f"нет блока {key}")
            continue
        b = load(bp)

        # Теория по одной мысли. Больше трёх экранов подряд без вопроса не даём:
        # подросток перестаёт читать. Вопросы берём из пула checks, а когда он
        # кончится — из старого quiz.
        pool = list(b.get("checks") or [])
        if b.get("quiz"):
            pool.append(b["quiz"])

        def put_check():
            if not pool:
                return
            q = pool.pop(0)
            st = {"t": "check", "part": part, "q": q["q"], "opts": q["opts"],
                  "ok": q["ok"], "why": q["why"]}
            if q.get("ill"):
                st["ill"] = q["ill"]
            if q.get("lead"):
                st["lead"] = q["lead"]
            steps.append(st)

        def put_teach(t):
            run = 0
            for st in ideas_from_teach(t, part):
                steps.append(st)
                run += 1
                if run >= 3 and pool:      # три мысли подряд — и проверяем
                    put_check()
                    run = 0
            if run and pool:               # кусок кончился — закрываем вопросом
                put_check()

        # Теорию не вываливаем всю сразу. Первый кусок — общий вход в приём,
        # остальные раздаём по одному перед тем подвидом, где они понадобятся:
        # знание приходит ровно тогда, когда оно нужно для следующей задачи.
        chunks = list(b.get("teach", []))
        subs_list = g.get("subs") or [g]
        if chunks:
            put_teach(chunks.pop(0))
        per_sub = {}
        for n in range(len(subs_list)):
            if chunks:
                per_sub[n] = chunks.pop(0)
        for extra in chunks:               # если кусков больше, чем подвидов
            put_teach(extra)

        warms = {w.get("sub", "").strip(): w for w in b.get("warms", [])}
        for si, s in enumerate(subs_list):
            if si in per_sub:
                put_teach(per_sub[si])
            title = (s.get("title") or g["title"]).strip()
            tasks = sorted(s.get("tasks", []), key=lambda i: size_of(raz, i))
            w = warms.get(title)
            if w:
                st = {"t": "warm", "part": part, "title": w["title"], "q": w["q"],
                      "steps": w["steps"], "a": w["a"]}
                for k in ("ill", "note"):
                    if w.get(k):
                        st[k] = w[k]
                if w.get("kind"):
                    st["key"], st["kind"] = key, w["kind"]
                steps.append(st)
            else:
                missing.append(f"{key}: нет разминки для «{title}»")

            if tasks:
                first = tasks[0]
                q = qx.get(first) or {}
                steps += task_chain(first, q, part, True)
                if w and w.get("kind"):
                    steps.append({"t": "solve", "part": part, "key": key, "kind": w["kind"]})
                for i in tasks[1:]:
                    steps.append({"t": "real", "part": part, "id": i})

        r = b.get("recap")
        if r:
            st = {"t": "recap", "part": part, "title": r["title"], "can": r["can"], "trap": r.get("trap", "")}
            if r.get("f"):
                st["f"] = r["f"]
            steps.append(st)

    return steps, missing


if __name__ == "__main__":
    blocks = sys.argv[1] if len(sys.argv) > 1 else "/tmp/theory"
    num = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    only = sys.argv[3:] or None
    steps, missing = build(blocks, num, only=only)

    course = {
        "id": f"fiz-{num}", "subj": "fiz", "task": num,
        "title": "Кинематика с нуля",
        "subtitle": "Маленькими шагами: одна мысль — один экран, и сразу проверка",
        "steps": steps,
    }
    out = f"{ROOT}/lessons/course-fiz-{num}.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(course, f, ensure_ascii=False, indent=1)

    kinds = {}
    for s in steps:
        kinds[s["t"]] = kinds.get(s["t"], 0) + 1
    print(f"шагов {len(steps)}: " + ", ".join(f"{k} {v}" for k, v in sorted(kinds.items())))
    if missing:
        print("не хватило: " + "; ".join(missing))
    print(f"записано {out}")
