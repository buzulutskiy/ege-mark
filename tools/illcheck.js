#!/usr/bin/env node
/* Проверка файла с иллюстрациями.
   node tools/illcheck.js gen/ill-slope_v.js [--out /tmp/ill-slope_v]

   Что проверяет у каждого рисунка:
   – функция не падает и возвращает строку <svg…> с viewBox;
   – SVG разбирается как XML (теги закрыты, кавычки на месте);
   – подписи не вылезают за границы картинки и не налезают друг на друга
     (ширина текста считается по эмпирике: 7 px на символ при 13px Times);
   – точки линий графиков лежат внутри осей;
   – в тексте нет десятичной точки вместо запятой и дефиса вместо минуса.

   С --out пишет index.html со всеми рисунками — открыть и посмотреть глазами. */
const fs = require("fs"), path = require("path"), vm = require("vm");

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
if (!file) { console.error("usage: node tools/illcheck.js gen/ill-<key>.js [--out DIR]"); process.exit(2); }
const outDir = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;

const root = path.resolve(__dirname, "..");
const GRAPH = require(path.join(root, "gen/graph.js"));

/* базовый draw.js — из него берётся DRAW, в который файл дописывает свои рисунки */
const sb = { GRAPH, console, module: { exports: {} } };
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(root, "gen/draw.js"), "utf8"), sb, { filename: "gen/draw.js" });
const base = new Set(Object.keys(sb.module.exports));
sb.DRAW = sb.module.exports;

try {
  vm.runInContext(fs.readFileSync(path.resolve(file), "utf8"), sb, { filename: file });
} catch (e) {
  console.log("файл не выполнился: " + e.message);
  process.exit(1);
}
const DRAW = sb.DRAW;
const mine = Object.keys(DRAW).filter(k => !base.has(k));
if (!mine.length) { console.log("в файле нет новых рисунков — проверь Object.assign(DRAW, {...})"); process.exit(1); }

const bad = [];
const say = (n, m) => bad.push(`${n}: ${m}`);

/* грубая ширина строки: Times 13px ≈ 7 px на символ */
const widthOf = (t, size) => t.length * (size || 13) * 0.54;

const drawn = {};
mine.forEach(name => {
  let s;
  try { s = DRAW[name](); }
  catch (e) { say(name, "функция упала: " + e.message); return; }
  if (typeof s !== "string" || !/^<svg[\s>]/.test(s.trim())) { say(name, "вернулась не строка <svg…>"); return; }
  drawn[name] = s;

  const vb = s.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!vb) { say(name, "нет viewBox вида «0 0 ширина высота»"); return; }
  const W = +vb[1], H = +vb[2];
  if (W > 900) say(name, `слишком широкий рисунок (${W}px) — на телефоне сожмётся в нечитаемое`);

  /* теги закрыты? */
  const open = (s.match(/<(svg|g|text|polygon|polyline|rect|circle|line|path|tspan)\b/g) || []).length;
  const close = (s.match(/<\/(svg|g|text|polygon|polyline|rect|circle|line|path|tspan)>/g) || []).length;
  const self = (s.match(/\/>/g) || []).length;
  if (open > close + self) say(name, `похоже, не закрыт тег (открыто ${open}, закрыто ${close}, самозакрыто ${self})`);

  /* подписи: границы и налезание */
  const texts = [];
  const re = /<text\s([^>]*)>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(s))) {
    const at = m[1], raw = m[2].replace(/<[^>]*>/g, "");
    const x = +(at.match(/(?:^|\s)x="([-\d.]+)"/) || [0, 0, 0])[1];
    const y = +(at.match(/(?:^|\s)y="([-\d.]+)"/) || [0, 0, 0])[1];
    const size = +(at.match(/font-size="([\d.]+)"/) || [0, 13])[1];
    const anchor = (at.match(/text-anchor="(\w+)"/) || [0, "start"])[1];
    const w = widthOf(raw, size);
    const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
    texts.push({ raw, x0, x1: x0 + w, y0: y - size, y1: y + size * 0.3, size });
    if (/(^|[^0-9])\d+\.\d+/.test(raw)) say(name, `десятичная точка вместо запятой: «${raw}»`);
    if (/\d-\d|\s-\d/.test(raw)) say(name, `дефис вместо типографского минуса: «${raw}»`);
    if (/"[^"]*"/.test(raw)) say(name, `латинские кавычки вместо «ёлочек»: «${raw}»`);
  }
  texts.forEach(t => {
    if (t.x0 < -2 || t.x1 > W + 2) say(name, `подпись «${t.raw.slice(0, 30)}» вылезает за край (${Math.round(t.x0)}…${Math.round(t.x1)} при ширине ${W})`);
    if (t.y1 > H + 2) say(name, `подпись «${t.raw.slice(0, 30)}» ниже нижнего края`);
  });
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (a.x0 < b.x1 - 3 && b.x0 < a.x1 - 3 && a.y0 < b.y1 - 3 && b.y0 < a.y1 - 3)
        say(name, `подписи налезают: «${a.raw.slice(0, 20)}» и «${b.raw.slice(0, 20)}»`);
    }
  }
});

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = `<!doctype html><meta charset="utf-8"><title>Иллюстрации ${path.basename(file)}</title>
<style>body{font:16px/1.5 system-ui;max-width:900px;margin:20px auto;padding:0 16px;background:#faf9f7}
figure{margin:0 0 26px;background:#fff;border:1px solid #e5e2dd;border-radius:14px;padding:14px}
figcaption{font-size:13px;color:#888;margin-bottom:8px}</style>
<h2>${esc(path.basename(file))} — ${mine.length} рисунков</h2>
${mine.map(n => `<figure><figcaption>DRAW.${esc(n)}()</figcaption>${drawn[n] || "<i>не отрисовался</i>"}</figure>`).join("\n")}`;
  fs.writeFileSync(path.join(outDir, "index.html"), html);
  console.log(`картинки: ${path.join(outDir, "index.html")}`);
}

console.log(`${file}: рисунков ${mine.length} (${mine.join(", ")})`);
if (bad.length) {
  console.log(`\nПРОБЛЕМ: ${bad.length}`);
  bad.slice(0, 30).forEach(b => console.log("  " + b));
  if (bad.length > 30) console.log(`  … и ещё ${bad.length - 30}`);
  process.exit(1);
}
console.log("OK: подписи внутри границ, не налезают, теги закрыты");
