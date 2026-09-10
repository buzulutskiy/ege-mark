# -*- coding: utf-8 -*-
"""Пишет теорию перед каждым циклом: как решать такие задачи, человеческим языком.

Опирается на алгоритм цикла и на официальные разборы задач внутри него.
Запуск:  python3 tools/teoriya.py fiz 1
"""
import json, os, re, sys, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
URL = "https://api.aitunnel.ru/v1/chat/completions"
MODEL = "glm-5.3-flash"
_lock = threading.Lock()

SYS = ("Ты объясняешь одиннадцатикласснику, который начал с нуля: школьные уроки прошли мимо, "
       "со счётом тоже не очень. Пишешь просто, короткими фразами, на «ты», без канцелярита "
       "и без слов «модуль», «проекция», «зависимость», пока не объяснил их. Только валидный JSON.")

PROMPT = """Ученику предстоит прорешать группу однотипных задач ЕГЭ. Перед этим его надо подготовить.

Предмет: физика, задание {n} — «{name}».
Тип задач: «{title}»
Как узнать такую задачу: {recognize}
Алгоритм, который выделен из решений: {algo}
Где обычно ошибаются: {trap}

Примеры задач этой группы с официальными разборами:
{items}

Напиши подготовку. Она читается за 3–5 минут, до того как человек начнёт решать сам.

Правила:
— Начни с того, ЗАЧЕМ это и что вообще происходит в таких задачах. Одна-две фразы, из жизни.
— Дальше объясни, почему алгоритм именно такой. Не «делай шаг 1», а «почему это работает».
— Каждое новое слово поясняй сразу. Считай, что «проекция» и «модуль» ученик слышит впервые.
— Обязательно разбери один пример полностью, с числами, по шагам. Числа простые.
— В конце — ловушка: где на этом типе теряют балл.

Ответ строго так:
{{"lead":"одна фраза: о чём эти задачи",
  "idea":"3–5 предложений: что происходит и зачем это нужно",
  "why":"2–4 предложения: почему алгоритм работает именно так",
  "steps":["шаг 1 своими словами","шаг 2","шаг 3"],
  "example":{{"q":"условие простого примера","steps":["действие с числами","действие"],"a":"ответ"}},
  "trap":"где теряют балл, одна-две фразы"}}"""


def key():
    f = os.path.join(ROOT, ".aikey")
    return open(f).read().strip() if os.path.exists(f) else os.environ.get("AITUNNEL_KEY", "")


def ask(prompt):
    body = json.dumps({"model": MODEL, "max_tokens": 7000, "reasoning": {"effort": "low"},
                       "messages": [{"role": "system", "content": SYS},
                                    {"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Authorization": "Bearer " + key(), "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=300))
    txt = (d.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    m = re.search(r"\{[\s\S]*\}", txt)
    if not m:
        raise ValueError("не по формату")
    return json.loads(m.group(0)), (d.get("usage") or {}).get("cost_rub", 0)


def main():
    sid = sys.argv[1] if len(sys.argv) > 1 else "fiz"
    num = sys.argv[2] if len(sys.argv) > 2 else None
    ppath = os.path.join(ROOT, "lessons", "plan-%s.json" % sid)
    plan = json.load(open(ppath, encoding="utf-8"))
    bank = {q["id"]: q for q in json.load(open(os.path.join(ROOT, "bank", "bank-%s.json" % sid),
                                               encoding="utf-8"))["tasks"]}
    spent = [0.0]
    nums = [num] if num else sorted(plan, key=lambda k: int(k))

    for k in nums:
        d = plan.get(k)
        if not d:
            continue

        def one(g):
            if g.get("theory"):
                return
            qs = [bank[i] for i in (g.get("tasks") or [])[:3] if i in bank]
            items = "\n".join("— %s\n  ответ: %s\n  разбор: %s" %
                              (q["plain"][:260], q.get("answer", ""), (q.get("solution") or "")[:420])
                              for q in qs)
            try:
                j, c = ask(PROMPT.format(n=k, name=d["name"], title=g["title"],
                                         recognize=g.get("recognize", ""),
                                         algo=" → ".join(g.get("algorithm", [])),
                                         trap=g.get("trap", ""), items=items))
            except Exception as e:
                with _lock:
                    print("  «%s» — %s" % (g["title"][:34], str(e)[:40]))
                return
            with _lock:
                spent[0] += c or 0
                g["theory"] = j

        with ThreadPoolExecutor(max_workers=4) as ex:
            list(ex.map(one, d["groups"]))
        ready = sum(1 for g in d["groups"] if g.get("theory"))
        print("задание %-3s %-32s теория готова у %d из %d циклов" %
              (k, d["name"][:32], ready, len(d["groups"])))

    json.dump(plan, open(ppath, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("сохранено · потрачено %.2f ₽" % spent[0])


if __name__ == "__main__":
    main()
