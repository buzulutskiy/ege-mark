# -*- coding: utf-8 -*-
"""Расставляет циклы от простого к сложному, группирует в этапы и чистит подписи от жаргона.

Запуск:  python3 tools/poryadok.py fiz 1
"""
import json, os, re, sys, urllib.request

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
URL = "https://api.aitunnel.ru/v1/chat/completions"
MODEL = "glm-5.3-flash"
SYS = "Ты методист. Отвечаешь только валидным JSON."

PROMPT = """Задание {n} ЕГЭ по физике — «{name}». Задачи внутри него разбиты на циклы:

{items}

Сделай три вещи.

1. РАССТАВЬ ПО СЛОЖНОСТИ. Считай, что ученик начал с нуля и плохо считает.
   Самый простой цикл — тот, где меньше всего действий и не нужно ничего знать заранее.
   Самый сложный — где надо соединить несколько приёмов или следить за знаками.
   Учитывай зависимости: если цикл Б опирается на умение из цикла А, А идёт раньше.

2. СГРУППИРУЙ В ЭТАПЫ. Два-четыре этапа, каждый со своим коротким названием
   человеческим языком («Читать графики», «Считать по формулам»). Циклы внутри этапа
   тоже по возрастанию сложности. Этапы идут по порядку прохождения.

3. ПЕРЕПИШИ ПОДПИСИ. Поле recognize — это «как узнать такую задачу с первого взгляда».
   Сейчас там жаргон. Убери слова «проекция», «модуль», «зависимость», «интервал», vx(t), S(t).
   Пиши так, как объяснил бы человек: «на графике показана скорость, и линия уходит вниз
   под ось — значит тело поехало назад». Одна строка, максимум две.

Ответ строго так:
{{"stages":[
  {{"stage":"название этапа",
    "cycles":[{{"i":0,"recognize":"новая подпись","why":"почему этот цикл стоит здесь, полстроки"}}]}}
]}}
где i — номер цикла из списка выше (начиная с 0). Каждый цикл ровно один раз, ни один не потерян."""


def key():
    f = os.path.join(ROOT, ".aikey")
    return open(f).read().strip() if os.path.exists(f) else os.environ.get("AITUNNEL_KEY", "")


def ask(prompt):
    body = json.dumps({"model": MODEL, "max_tokens": 6000, "reasoning": {"effort": "low"},
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
    spent = 0.0
    nums = [num] if num else sorted(plan, key=lambda k: int(k))

    for k in nums:
        d = plan.get(k)
        if not d:
            continue
        items = "\n".join("%d. %s — %s (задач: %d)" % (i, g["title"], g.get("recognize", ""), g["count"])
                          for i, g in enumerate(d["groups"]))
        try:
            j, c = ask(PROMPT.format(n=k, name=d["name"], items=items))
        except Exception as e:
            print("задание %-3s — не вышло: %s" % (k, str(e)[:60])); continue
        spent += c or 0

        order, used = [], set()
        for stg in j.get("stages", []):
            for c2 in stg.get("cycles", []):
                i = c2.get("i")
                if not isinstance(i, int) or i < 0 or i >= len(d["groups"]) or i in used:
                    continue
                used.add(i)
                g = dict(d["groups"][i])
                g["stage"] = stg.get("stage", "").strip()
                if c2.get("recognize", "").strip():
                    g["hard_recognize"] = g.get("hard_recognize") or g.get("recognize", "")
                    g["recognize"] = c2["recognize"].strip()
                if c2.get("why", "").strip():
                    g["place"] = c2["why"].strip()
                order.append(g)
        for i, g in enumerate(d["groups"]):          # ничего не теряем
            if i not in used:
                g = dict(g); g.setdefault("stage", "Остальное"); order.append(g)
        d["groups"] = order

        print("задание %-3s %-30s этапов %d" % (k, d["name"][:30], len(j.get("stages", []))))
        st = None
        for g in order:
            if g.get("stage") != st:
                st = g.get("stage"); print("   ▸ %s" % st)
            print("      %-52s %2d задач" % (g["title"][:52], g["count"]))

    json.dump(plan, open(ppath, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\nсохранено · потрачено %.2f ₽" % spent)


if __name__ == "__main__":
    main()
