# -*- coding: utf-8 -*-
"""Ставит свежую версию в data.js и в ссылки на скрипты и стили в index.html,
   чтобы браузер не отдавал старые файлы из кэша."""
import re, time, sys

v = time.strftime("%Y%m%d-%H%M%S")
s = open("data.js", encoding="utf-8").read()
if s.startswith("const VER"):
    s = re.sub(r'^const VER = "[^"]*";', 'const VER = "%s";' % v, s, count=1)
else:
    s = 'const VER = "%s";   /* версия данных: ломает кэш браузера */\n\n' % v + s
open("data.js", "w", encoding="utf-8").write(s)

h = open("index.html", encoding="utf-8").read()
h = re.sub(r'(src|href)="([\w./-]+\.(?:js|css))(?:\?v=[^"]*)?"',
           lambda m: '%s="%s?v=%s"' % (m.group(1), m.group(2), v), h)
open("index.html", "w", encoding="utf-8").write(h)

w = open("sw.js", encoding="utf-8").read()
w = re.sub(r'const CACHE = "[^"]*";', 'const CACHE = "ege-mark-%s";' % v, w, count=1)
open("sw.js", "w", encoding="utf-8").write(w)
print("версия:", v)
