# -*- coding: utf-8 -*-
"""Разбирает банк заданий по номерам ЕГЭ и делит каждый номер на циклы — группы однотипных задач.

Из каждого цикла потом получается один урок. Час тут ни при чём: урок длится столько,
сколько нужно, чтобы закрыть свой цикл.

Запуск:  python3 tools/klaster.py fiz          — все номера предмета
         python3 tools/klaster.py fiz 1        — только задание 1
"""
import json, os, re, sys, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor

_lock = threading.Lock()

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
KEYFILE = os.path.join(ROOT, ".aikey")
URL = "https://api.aitunnel.ru/v1/chat/completions"
MODEL = "glm-5.3-flash"

SYS = ("Ты методист по подготовке к ЕГЭ. Отвечаешь только валидным JSON, без пояснений вокруг.")

PROMPT = """Вот настоящие задания ЕГЭ по предмету «{subject}», номер {n} — «{name}».
Официальная формулировка ФИПИ: {full}

Задания (номер, условие, правильный ответ):
{items}

Раздели их на кластеры по ОДИНАКОВОСТИ РЕШЕНИЯ. Правило простое: если две задачи решаются
одной и той же последовательностью действий, они в одном кластере. Если хоть один шаг
отличается — это разные кластеры.

Дели мелко. Лучше семь узких кластеров с чётким алгоритмом, чем три широких, где
«ну примерно так». Широкая группа бесполезна: по ней нельзя запомнить логику.

Для каждого кластера дай:
— title: как назвал бы репетитор, коротко и по делу;
— recognize: по какому признаку узнать такую задачу с первого взгляда, одной строкой;
— algorithm: 2–5 шагов, которые работают для ЛЮБОЙ задачи этого кластера. Шаги конкретные,
  в повелительном наклонении: «Найди на графике две точки», «Раздели прирост на время».
  Не «примени формулу», а какую именно и к чему;
— trap: где в этом типе чаще всего ошибаются, одной строкой. Если ловушки нет — пустая строка;
— ids: номера заданий из списка выше.

Правила: от 3 до 8 кластеров, каждое задание ровно в одном, ни одно не теряется,
кластеры упорядочены от простого к сложному — в этом порядке их будут изучать.

Ответ строго так:
{{"groups":[
  {{"title":"...","recognize":"...","algorithm":["...","..."],"trap":"...","ids":[1,4,7]}}
]}}"""


def key():
    if os.path.exists(KEYFILE):
        return open(KEYFILE).read().strip()
    return os.environ.get("AITUNNEL_KEY", "")


def ask(prompt):
    body = json.dumps({"model": MODEL, "max_tokens": 8000,
                       "reasoning": {"effort": "low"},
                       "messages": [{"role": "system", "content": SYS},
                                    {"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Authorization": "Bearer " + key(), "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=300))
    txt = (d.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    cost = (d.get("usage") or {}).get("cost_rub", 0)
    m = re.search(r"\{[\s\S]*\}", txt)
    if not m:
        raise ValueError("модель ответила не по формату")
    return json.loads(m.group(0)), cost


def tasks_of(bank, sub_tasks, n):
    """Задания банка по точному номеру задания ЕГЭ из каталога."""
    return [q for q in bank if q.get("task") == n]


def subject_tasks(sid):
    """Каталог заданий предмета — читаем прямо из data.js."""
    src = open(os.path.join(ROOT, "data.js"), encoding="utf-8").read()
    seg = src[src.index('id: "%s"' % sid):]
    seg = seg[:seg.index("probes:")]
    out = []
    for m in re.finditer(r'\{ n: (\d+),.*?name: "([^"]+)".*?full: "([^"]*)".*?kes: (\[[^\]]*\]), words: (\[[^\]]*\])', seg):
        out.append({"n": int(m.group(1)), "name": m.group(2), "full": m.group(3),
                    "kes": json.loads(m.group(4)), "words": json.loads(m.group(5))})
    return out


def main():
    sid = sys.argv[1] if len(sys.argv) > 1 else "fiz"
    only = int(sys.argv[2]) if len(sys.argv) > 2 else None
    bank = json.load(open(os.path.join(ROOT, "bank", "bank-%s.json" % sid), encoding="utf-8"))["tasks"]
    cat = subject_tasks(sid)
    path = os.path.join(ROOT, "lessons", "plan-%s.json" % sid)
    plan = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    spent = 0.0

    work = [t for t in cat if not only or t["n"] == only]
    spent_l = [0.0]

    def one(t):
        qs = tasks_of(bank, cat, t["n"])
        if len(qs) < 4:
            with _lock:
                print("задание %-2d %-36s — в банке всего %d, пропускаю" % (t["n"], t["name"][:36], len(qs)))
            return
        sample = qs[:70]
        items = "\n".join("%d. %s  → ответ: %s" % (i + 1, q["plain"][:200], q.get("answer", "?"))
                          for i, q in enumerate(sample))
        try:
            j, cost = ask(PROMPT.format(subject=sid, n=t["n"], name=t["name"], full=t["full"], items=items))
        except Exception as e:
            with _lock:
                print("задание %-2d — не вышло: %s" % (t["n"], str(e)[:60]))
            return

        groups, used = [], set()
        for g in j.get("groups", []):
            ids = [i for i in g.get("ids", []) if 1 <= i <= len(sample) and i not in used]
            used.update(ids)
            if not ids:
                continue
            groups.append({"title": g.get("title", "").strip(),
                           "recognize": g.get("recognize", "").strip(),
                           "algorithm": [x.strip() for x in (g.get("algorithm") or []) if x.strip()],
                           "trap": g.get("trap", "").strip(),
                           "count": len(ids), "tasks": [sample[i - 1]["id"] for i in ids]})
        lost = [i for i in range(1, len(sample) + 1) if i not in used]
        with _lock:
            spent_l[0] += cost or 0
            plan[str(t["n"])] = {"name": t["name"], "total": len(qs),
                                 "groups": groups, "unsorted": len(lost)}
            print("задание %-2d %-32s %3d заданий → %d циклов" % (t["n"], t["name"][:32], len(qs), len(groups)))

    with ThreadPoolExecutor(max_workers=5) as ex:
        list(ex.map(one, work))
    spent = spent_l[0]

    json.dump(plan, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\nсохранено → %s%s" % (path, ("  ·  потрачено %.2f ₽" % spent) if spent else ""))


if __name__ == "__main__":
    main()
