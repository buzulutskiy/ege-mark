# -*- coding: utf-8 -*-
"""Забирает задания из Открытого банка ФИПИ и складывает в data/bank-<предмет>.json.

Личное использование: страницы тянутся по одной с паузой, картинки сохраняются рядом.
Запуск:  python3 tools/bank.py fiz 20     (предмет и сколько страниц)
"""
import json, os, re, sys, time, urllib.parse, urllib.request, html

PROJ = {
    "rus": ("AF0ED3F2557F8FFC4C06F80B6803FD26", "Русский язык"),
    "mat": ("AC437B34557F88EA4115D2F374B0A07B", "Математика. Профильный уровень"),
    "fiz": ("BA1F39653304A5B041B656915DC36B38", "Физика"),
}
BASE = "https://ege.fipi.ru/bank/"
IMGBASE = "https://ege.fipi.ru/"   # картинки лежат от корня, не от /bank/
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36"


def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as r:
        raw = r.read()
    return raw if binary else raw.decode("cp1251", "replace")


def clean(frag):
    """Оставляем текст, MathML, таблицы и картинки. Скрипты, формы и обработчики убираем."""
    frag = re.sub(r"<script.*?</script>", "", frag, flags=re.S | re.I)
    frag = re.sub(r"<form[^>]*>|</form>", "", frag, flags=re.I)
    frag = re.sub(r"<input[^>]*>", "", frag, flags=re.I)
    frag = re.sub(r"\son\w+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", "", frag, flags=re.I)
    frag = re.sub(r"\s(bgcolor|width|height|cellspacing|cellpadding|border|valign|align|style)\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", "", frag, flags=re.I)
    frag = re.sub(r"<a\s[^>]*>|</a>", "", frag, flags=re.I)
    # <m:math> — namespace-префикс, браузер его не понимает; MathML работает без него
    frag = frag.replace("<m:", "<").replace("</m:", "</")
    frag = re.sub(r"\n{3,}", "\n\n", frag)
    return frag.strip()


def text_of(frag):
    t = re.sub(r"<[^>]+>", " ", frag)
    return html.unescape(re.sub(r"\s+", " ", t)).strip()


def parse_page(sid, page_html, imgdir):
    out = []
    parts = page_html.split('<div class="qblock"')
    for p in parts[1:]:
        guid = re.search(r'name="guid" value="([0-9a-fA-F]{32})"', p)
        if not guid:
            continue
        guid = guid.group(1)

        info = re.search(r'class="task-info-content">(.*?)</table>', p, flags=re.S)
        kes, atype = [], ""
        if info:
            blk = info.group(1)
            k = re.search(r"КЭС:.*?<td[^>]*>(.*?)</td>", blk, flags=re.S)
            if k:
                kes = [text_of(x) for x in re.findall(r"<div>(.*?)</div>", k.group(1), flags=re.S)]
            a = re.search(r"Тип ответа:</td><td[^>]*>(.*?)</td>", blk, flags=re.S)
            if a:
                atype = text_of(a.group(1))

        body = re.split(r'<div class="task-info', p)[0]
        body = re.sub(r"^.*?<TD[^>]*class='cell_0'>", "", body, flags=re.S | re.I)
        body = re.sub(r"<div[^>]*class=\"hint\".*?</div>", "", body, flags=re.S | re.I)
        # картинки подставляются скриптом ShowPictureQ — превращаем в обычный <img>
        body = re.sub(r"<script[^>]*>\s*ShowPictureQ\('([^']+)'\);?\s*</script>",
                      lambda m: '<img src="%s">' % m.group(1), body, flags=re.S | re.I)
        frag = clean(body)
        if len(text_of(frag)) < 30:
            continue

        imgs = []
        for m in re.finditer(r'src="([^"]+)"', frag):
            src = m.group(1)
            name = re.sub(r"[^0-9a-zA-Z._-]", "_", src.split("/")[-1].split("?")[0])[:60]
            dest = os.path.join(imgdir, name)
            if not os.path.exists(dest):
                try:
                    data = get(urllib.parse.urljoin(IMGBASE, src), binary=True)
                    open(dest, "wb").write(data)
                    time.sleep(0.3)
                except Exception as e:
                    print("  картинка не скачалась:", src, e)
                    continue
            imgs.append(name)
            frag = frag.replace(src, "bank/img/" + name)

        out.append({"id": guid, "subj": sid, "kes": kes, "type": atype, "html": frag,
                    "plain": text_of(frag)[:400], "img": imgs})
    return out


def main():
    sid = sys.argv[1] if len(sys.argv) > 1 else "fiz"
    pages = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    start = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    proj, title = PROJ[sid]

    bankdir = os.path.join(ROOT, "bank")
    imgdir = os.path.join(bankdir, "img")
    os.makedirs(imgdir, exist_ok=True)
    path = os.path.join(bankdir, "bank-%s.json" % sid)
    store = {}
    if os.path.exists(path):
        store = {q["id"]: q for q in json.load(open(path, encoding="utf-8"))["tasks"]}

    print("%s — было %d заданий" % (title, len(store)))
    for page in range(start, start + pages):
        url = BASE + "questions.php?proj=%s&page=%d" % (proj, page)
        try:
            page_html = get(url)
        except Exception as e:
            print("страница %d — ошибка: %s" % (page, e))
            break
        got = parse_page(sid, page_html, imgdir)
        if not got:
            print("страница %d — пусто, останавливаемся" % page)
            break
        new = 0
        for q in got:
            if q["id"] not in store:
                store[q["id"]] = q
                new += 1
        print("страница %d: %d заданий, новых %d" % (page, len(got), new))
        time.sleep(1.2)

    tasks = list(store.values())
    json.dump({"subj": sid, "title": title, "source": "Открытый банк заданий ЕГЭ, ФИПИ",
               "fetched": time.strftime("%Y-%m-%d"), "tasks": tasks},
              open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("сохранено %d заданий → %s" % (len(tasks), path))


if __name__ == "__main__":
    main()
