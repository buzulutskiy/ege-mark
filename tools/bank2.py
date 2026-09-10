# -*- coding: utf-8 -*-
"""Банк заданий с ответами и решениями (Решу ЕГЭ).

Чистый HTML, картинки отдельными файлами, к каждому заданию — ответ и разбор.
Запуск:  python3 tools/bank2.py fiz 40      (предмет, сколько категорий взять)
"""
import html, json, os, re, sys, threading, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

WORKERS = 8          # столько же параллельных запросов, сколько делает обычный браузер
_lock = threading.Lock()

HOST = {"rus": "https://rus-ege.sdamgia.ru", "mat": "https://math-ege.sdamgia.ru", "fiz": "https://phys-ege.sdamgia.ru"}
TITLE = {"rus": "Русский язык", "mat": "Математика, профиль", "fiz": "Физика"}
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def fipi_names(sid):
    """Официальные названия заданий — из нашего каталога, собранного по спецификации ФИПИ."""
    src = open(os.path.join(ROOT, "data.js"), encoding="utf-8").read()
    seg = src[src.index('id: "%s"' % sid):]
    seg = seg[:seg.index("probes:")]
    return {int(m.group(1)): m.group(2)
            for m in re.finditer(r'\{ n: (\d+),.*?name: "([^"]+)"', seg)}
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36"


def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as r:
        raw = r.read()
    return raw if binary else raw.decode("utf-8", "replace")


def ext_of(data):
    """Расширение по содержимому: сервер отдаёт и SVG, и растр под одним адресом."""
    if data[:4] == b"\x89PNG": return ".png"
    if data[:3] == b"GIF": return ".gif"
    if data[:2] == b"\xff\xd8": return ".jpg"
    head = data[:400].lstrip()
    if head[:5] == b"<?xml" or head[:4] == b"<svg": return ".svg"
    return ".png"


TEX = [
    (r"\\mathcal([A-Za-z])", "\\1"),
    (r"\\d?frac\{([^}]*)\}\{([^}]*)\}", "(\\1)/(\\2)"),
    (r"\\sqrt\{([^}]*)\}", "√(\\1)"),
    (r"\\cdot", "·"),
    (r"\\times", "×"),
    (r"\\approx", "≈"),
    (r"\\leqslant", "≤"),
    (r"\\geqslant", "≥"),
    (r"\\pm", "±"),
    (r"\\infty", "∞"),
    (r"\\alpha", "α"),
    (r"\\beta", "β"),
    (r"\\gamma", "γ"),
    (r"\\Delta", "Δ"),
    (r"\\delta", "δ"),
    (r"\\mu", "μ"),
    (r"\\nu", "ν"),
    (r"\\pi", "π"),
    (r"\\rho", "ρ"),
    (r"\\sigma", "σ"),
    (r"\\lambda", "λ"),
    (r"\\omega", "ω"),
    (r"\\Omega", "Ω"),
    (r"\\varepsilon", "ε"),
    (r"\\eta", "η"),
    (r"\\upsilon", "υ"),
    (r"\\varphi", "φ"),
    (r"\\theta", "θ"),
    (r"\\tau", "τ"),
    (r"[{}\\]", ""),
]


def untex(a):
    """Подпись формулы-картинки в читаемый вид."""
    for pat, rep in TEX:
        a = re.sub(pat, rep, a)
    return a.strip()


STOP = re.compile(r"(Спрятать решение|Пройти тестирование|Источник:|Раздел кодификатора|"
                  r"Классификатор|Аналоги к заданию|function\s+\w+\s*\(|Наверх|\u00b7 Помощь|Ответ:\s*\S+\s*Ответ:)")


def cut_tail(t):
    """Обрезает служебный хвост сайта: кнопки, комментарии, скрипты."""
    m = STOP.search(t)
    if m:
        t = t[:m.start()]
    t = re.sub(r"\s*Ответ:\s*[^.]*\.?\s*$", "", t)
    return t.strip()


def txt(t):
    # формулы приходят картинками — забираем их подписи, иначе текст рвётся на полуслове
    t = re.sub(r'<img[^>]*alt="([^"]*)"[^>]*>', lambda m: " " + untex(html.unescape(m.group(1))) + " ", t)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t).replace("\xad", "").replace("\xa0", " ")
    return re.sub(r"\s+", " ", t).strip()


def clean(frag):
    frag = re.sub(r"<script.*?</script>", "", frag, flags=re.S | re.I)
    frag = re.sub(r"\son\w+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", "", frag, flags=re.I)
    frag = re.sub(r"<div[^>]*class=\"[^\"]*(prob_nums|minor)[^\"]*\".*?</div>", "", frag, flags=re.S | re.I)
    frag = frag.replace("\xad", "").replace(" ", " ")
    frag = re.sub(r"\s(width|height|style|align)\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", "", frag, flags=re.I)
    return re.sub(r"\s+", " ", frag).strip()


def categories(sid):
    """Листовые категории каталога: (id, тема, номер задания).
       Номер лежит в <span class="pcat_num">, тема — текст после последнего </span>.
       Старые разделы «Задания ДN» пропускаем: у них своя нумерация прошлых лет."""
    page = get(HOST[sid] + "/prob_catalog")
    best = {}                                   # cid → (тема, номер): пронумерованный раздел важнее
    order = []
    for m in re.finditer(r'<b class="cat_name">(.*?)</b>(.*?)(?=<b class="cat_name">|\Z)', page, re.S):
        head_raw, body = m.group(1), m.group(2)
        num = re.search(r'<span class="pcat_num">(\d+)</span>', head_raw)
        tail = head_raw.rsplit("</span>", 1)[-1] if "</span>" in head_raw else head_raw
        head = txt(re.sub(r"<[^>]+>", " ", tail)).strip()
        if not num:
            legacy = re.search(r"Задани[ея]\s*[ДCВB]\s*(\d+)", txt(re.sub(r"<[^>]+>", " ", head_raw)))
            if legacy:
                continue                                  # старая нумерация — мимо
        task = int(num.group(1)) if num else 0
        theme = re.sub(r"^[\s.\d]+", "", head).strip() or head
        for cid in re.findall(r"category_id=(\d+)", body):
            if cid not in best:
                order.append(cid)
            if cid not in best or (task and not best[cid][1]):
                best[cid] = (theme[:80], task)
    out = [(cid, best[cid][0], best[cid][1]) for cid in order]
    return out


NAMES = {}


def parse(sid, page, theme, imgdir, task=0):
    out = []
    blocks = list(re.finditer(r'id="body(\d+)"[^>]*class="pbody">(.*?)</div>', page, re.S))
    for i, m in enumerate(blocks):
        pid, body = m.group(1), m.group(2)
        tail = page[m.end(): blocks[i + 1].start() if i + 1 < len(blocks) else m.end() + 12000]
        sol = re.search(r'class="solution"[^>]*>(.*)', tail, re.S)
        soltxt = txt(sol.group(1)) if sol else ""
        soltxt = re.sub(r"^\s*Решение\s*\.?\s*", "", soltxt)
        soltxt = cut_tail(soltxt)
        ans = re.search(r"Ответ:?\s*([^.;]{1,80})", soltxt)
        answer = ans.group(1).strip().rstrip(".") if ans else ""
        if not answer:
            continue                                    # без ответа задание нам не нужно
        frag = clean(body)
        imgs = []
        for src in re.findall(r'src="([^"]+)"', frag):
            fid = re.search(r"id=(\d+)", src)
            stem = "s%s" % (fid.group(1) if fid else str(abs(hash(src)))[:8])
            name = next((stem + e for e in (".svg", ".png", ".gif", ".jpg")
                         if os.path.exists(os.path.join(imgdir, stem + e))), None)
            if not name:
                try:
                    data = get(HOST[sid] + src if src.startswith("/") else src, binary=True)
                except Exception:
                    continue
                name = stem + ext_of(data)
                with _lock:
                    open(os.path.join(imgdir, name), "wb").write(data)
            frag = frag.replace(src, "bank/img/" + name)
            imgs.append(name)
        plain = txt(frag)
        if len(plain) < 40 and not imgs:
            continue                                    # в математике вся задача бывает одной картинкой-формулой
        if len(plain) < 12 and not imgs:
            continue
        out.append({"id": "sd" + pid, "subj": sid, "task": task,
                    "name": NAMES.get(task, ""), "kes": [theme], "type": "Краткий ответ",
                    "html": frag, "plain": plain[:600], "img": imgs,
                    "answer": answer, "solution": soltxt[:1200]})
    return out


def main():
    sid = sys.argv[1] if len(sys.argv) > 1 else "fiz"
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    only = int(sys.argv[3]) if len(sys.argv) > 3 else 0     # перекачать только один номер задания
    bankdir = os.path.join(ROOT, "bank")
    imgdir = os.path.join(bankdir, "img")
    os.makedirs(imgdir, exist_ok=True)
    path = os.path.join(bankdir, "bank-%s.json" % sid)

    store = {}
    if os.path.exists(path):                     # точечная перекачка не должна терять остальное
        store = {q["id"]: q for q in json.load(open(path, encoding="utf-8"))["tasks"]}
    global NAMES
    NAMES = fipi_names(sid)
    cats = categories(sid)
    nums = sorted(set(c[2] for c in cats if c[2]))
    _ = nums
    print("%s — разделов %d, номера заданий в каталоге: %s" % (TITLE[sid], len(cats), nums))
    done = [0]

    def one(item):
        cid, name, task = item
        got_all, total = [], 0
        for pg in range(1, 13):
            url = "%s/test?filter=all&category_id=%s%s" % (HOST[sid], cid, "" if pg == 1 else "&page=%d" % pg)
            try:
                page = get(url)
            except Exception:
                break
            got = parse(sid, page, name, imgdir, task)
            if not got:
                break
            before = len(got_all)
            got_all += got
            total += len(got)
            if len(got_all) == before:
                break
        with _lock:
            for q in got_all:
                store[q["id"]] = q
            done[0] += 1
            print("  [%3d/%3d] задание %-2s  %-40s %3d" % (done[0], min(limit, len(cats)), task or "?", name[:40], total), flush=True)

    todo = [c for c in cats[:limit] if not only or c[2] == only]
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        list(ex.map(one, todo))

    tasks = list(store.values())
    json.dump({"subj": sid, "title": TITLE[sid], "source": "Решу ЕГЭ, каталог заданий",
               "fetched": time.strftime("%Y-%m-%d"), "tasks": tasks},
              open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("сохранено %d заданий с ответами → %s" % (len(tasks), path))


if __name__ == "__main__":
    main()
