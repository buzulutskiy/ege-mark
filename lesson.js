/* Урок: теория → упражнение → теория → закрепление → настоящие задания ЕГЭ.
   Собирается моделью один раз и дальше живёт офлайн. Спросить можно на любом шаге. */

"use strict";

const AI = {
  url: "https://api.aitunnel.ru/v1/chat/completions",
  model: "glm-5.3-flash"
};

/* Замер на 21 настоящем задании ЕГЭ, 10 сентября 2026.
   «сошлось» — доля совпадений с ответом, на котором сошлись минимум четыре модели независимо. */
const EFFORT = [
  { id: "low",    name: "Быстро",   note: "урок за минуту, дешевле всего" },
  { id: "medium", name: "Средне",   note: "дольше, но считает аккуратнее" },
  { id: "high",   name: "Тщательно", note: "несколько минут на урок" }
];

const MODELS = [
  { id: "glm-5.3-flash",          name: "GLM 5.3 Flash",     note: "сошлось 16 из 16 · ~1,5 ₽ за урок · 7 с" },
  { id: "qwen3.8-flash",          name: "Qwen 3.8 Flash",    note: "сошлось 15 из 16 · ~1,4 ₽ · 25 с" },
  { id: "gemini-3.5-flash",       name: "Gemini 3.5 Flash",  note: "сошлось 16 из 16 · 24 ₽ · 5 с" },
  { id: "claude-sonnet-5",        name: "Claude Sonnet 5",   note: "сошлось 16 из 16 · 26 ₽ · 8 с" }
];

let LES = null;      /* открытый урок */
let stepIdx = 0;
let chatOpen = false;
let busy = false;

const lessonKey = (sid, n) => sid + "-" + n;
function getLesson(sid, n) { return (S.lessons || {})[lessonKey(sid, n)] || null; }
function putLesson(l) { if (!S.lessons) S.lessons = {}; S.lessons[l.key] = l; save(); }

/* ─────────── обращение к модели ─────────── */
async function ask() {
  throw new Error("Разборы написаны заранее — сеть не нужна");
}

function pullJSON(text) {
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1];
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < 0) throw new Error("Модель ответила не по формату");
  return JSON.parse(t.slice(a, b + 1));
}

/* ─────────── подбор настоящих заданий из банка ФИПИ ─────────── */
let BANK = {};
async function loadBank(sid) {
  if (BANK[sid] !== undefined) return BANK[sid];
  try {
    const r = await fetch("bank/bank-" + sid + ".json?v=" + VER);
    BANK[sid] = r.ok ? (await r.json()).tasks : [];
  } catch (e) { BANK[sid] = []; }
  return BANK[sid];
}
function matchTask(q, sid, n) {
  if (q.task) return q.task === n;                 /* номер прямо из каталога — точнее некуда */
  const t = SUB[sid].byN[n];
  return matchKes(q, t.kes, t.words);              /* старые записи банка — по ключевым словам */
}

function matchKes(task, codes, words) {
  const k = (task.kes || []).join(" ").toLowerCase();
  if (codes && codes.some(c => (task.kes || []).some(x => x.trim().indexOf(c) === 0))) return true;
  if (words && words.some(w => k.indexOf(w.toLowerCase()) >= 0)) return true;
  /* если по кодификатору не нашлось — смотрим в само условие */
  const p = (task.plain || "").toLowerCase();
  if (words && words.some(w => p.indexOf(w.toLowerCase()) >= 0)) return true;
  return false;
}
/* сколько заданий из банка относится к этому номеру — это и есть «что закроем» */
function bankCount(sid, n) {
  const list = BANK[sid], t = SUB[sid].byN[n];
  if (!list || !t) return 0;
  return list.filter(q => matchTask(q, sid, n)).length;
}

async function realTasks(sid, n, limit) {
  const list = await loadBank(sid), t = SUB[sid].byN[n];
  if (!list.length) return [];
  const hit = list.filter(q => matchTask(q, sid, n));
  const pool = hit.length >= 3 ? hit : list;
  /* устойчивый разброс: каждый раз чуть другие задания */
  const seed = (n * 7919 + Object.keys(S.sessions).length) % Math.max(1, pool.length);
  const out = [];
  for (let i = 0; i < Math.min(limit || 4, pool.length); i++) out.push(pool[(seed + i * 3) % pool.length]);
  return out;
}

/* ─────────── готовые уроки ─────────── */
let SHIPPED = null;
async function shippedIndex() {
  if (SHIPPED) return SHIPPED;
  try {
    const r = await fetch("lessons/index.json");
    SHIPPED = r.ok ? await r.json() : [];
  } catch (e) { SHIPPED = []; }
  return SHIPPED;
}
async function hasShipped(sid, n) {
  return (await shippedIndex()).indexOf(sid + "-" + n) >= 0;
}
async function loadShipped(sid, n, minutes) {
  if (!(await hasShipped(sid, n))) return null;
  let j;
  try {
    const r = await fetch("lessons/" + sid + "-" + n + ".json");
    if (!r.ok) return null;
    j = await r.json();
  } catch (e) { return null; }
  const real = await realTasks(sid, n, 4);
  (j.steps || []).forEach(st => { if (st.t === "real") st.ids = real.map(x => x.id); });
  addIntro(j, sid, n);
  const l = {
    key: lessonKey(sid, n), subj: sid, n, at: now(), model: "готовый урок",
    minutes: minutes || 60, title: j.title, goal: j.goal || "",
    steps: j.steps || [], chat: [], done: {}, shipped: true
  };
  putLesson(l);
  return l;
}

/* ─────────── сборка урока ─────────── */
function lessonSystem() {
  return `Ты объясняешь одиннадцатикласснику тему для ЕГЭ. Он начал с нуля: считай, что про эту тему он не знает ничего, и школьные уроки прошли мимо.

Как объяснять:
— С самого начала. Сначала о чём вообще речь и зачем это нужно, потом понятия, потом формулы. Никогда не используй термин, который не объяснил раньше.
— Каждую величину вводи словами: что это, в чём измеряется, что значит «больше» и «меньше». В формуле расшифровывай каждую букву.
— Формула не падает с неба: скажи, откуда она берётся или на чём держится. Достаточно одного предложения, но оно обязательно.
— Опирайся на то, что видно в жизни: разгон машины, вода в чайнике, лампочка. Аналогия должна быть точной, а не красивой.
— Объём — как страница учебника, а не как шпаргалка. Лучше длиннее и понятно, чем коротко и непонятно.

Чего не делать:
— Никаких «давай разберёмся», «отлично!», «как мы знаем», обращений «дружок» и эмодзи. Ровный спокойный тон, как у толкового репетитора.
— Не выходи за школьную программу и кодификатор ФИПИ.
— Числа проверяй. Решение должно сходиться. Лучше простое условие с верным ответом, чем красивое с неверным.
— Отвечай ТОЛЬКО валидным JSON без пояснений вокруг.`;
}

function lessonPrompt(sid, n, minutes) {
  const sub = SUB[sid], t = sub.byN[n];
  const st = tstat(sid, n);
  const known = sub.tasks.filter(x => tstat(sid, x.n) === "ok").map(x => x.n);
  const mocks = Object.values(S.mocks).filter(m => !m.del && m.subj === sid);
  const missed = mocks.filter(m => (m.wrong || []).concat(m.missed || []).indexOf(n) >= 0).length;

  return `Собери занятие на ${minutes} минут по одному заданию ЕГЭ.

ПРЕДМЕТ: ${sub.name}
ЗАДАНИЕ № ${n}: ${t.name}
Формулировка ФИПИ: ${t.full}
Уровень: ${t.lvl === "Б" ? "базовый" : t.lvl === "П" ? "повышенный" : "высокий"}, ${t.p} балл(а/ов), раздел «${t.block}»
Сейчас у ученика: ${st === "ok" ? "получается" : st === "bad" ? "НЕ получается — нужен разбор с самого начала" : "не начинал"}${missed ? ", ошибался на пробниках " + missed + " раз(а)" : ""}
Уже освоены задания: ${known.length ? known.join(", ") : "пока никакие"}

СТРУКТУРА (строго такая, шаги идут по порядку):
1. theory — первая часть теории: суть и главное правило
2. drill — 2–3 упражнения ровно на эту часть
3. theory — вторая часть: случаи посложнее, исключения, типичные ловушки
4. drill — 2–3 упражнения на вторую часть
5. real — настоящие задания ЕГЭ (их подставит приложение, тебе писать их не нужно)

Сумма minutes по шагам = ${minutes}. Теория занимает большую часть времени: это первое знакомство с темой.

ФОРМАТ ОТВЕТА:
{
 "title": "короткое название темы занятия",
 "goal": "одно предложение: что ученик научится делать к концу",
 "intro": {
   "terms": [{"t":"Понятие","d":"объяснение одной строкой, простыми словами"}],
   "why": "3–5 предложений: почему эта тема стоит именно здесь, на что она опирается и что откроет дальше"
 },
 "steps": [
  {"t":"theory","title":"...","minutes":14,
   "idea":"4–6 предложений с нуля: о чём речь, откуда эта тема взялась, зачем нужна. Здесь можно бытовую аналогию.",
   "points":[
     {"h":"подзаголовок","text":"объяснение в 3–6 предложениях, простыми словами, с разъяснением каждого нового слова",
      "example":"короткий пример прямо в тексте — необязательно"}
   ],
   "formulas":[{"f":"p = m·v","what":"что считает","vars":[{"v":"m","means":"масса тела, кг"},{"v":"v","means":"скорость, м/с"}],
                "from":"откуда берётся или на чём держится — одно предложение"}],
   "visual":{...},
   "examples":[
     {"q":"условие","steps":["что дано и что ищем","какую формулу берём и почему","подстановка","ответ"],
      "a":"ответ","note":"что в этом примере было главным"}
   ],
   "trap":"где обычно ошибаются"},
  {"t":"drill","title":"...","minutes":10,
   "tasks":[{"q":"условие","a":"точный ответ","hint":"подсказка одной строкой","sol":"решение в 3–6 строках, по шагам"}]},
  {"t":"theory", ...},
  {"t":"drill", ...},
  {"t":"real","title":"Настоящие задания ЕГЭ","minutes":15}
 ]
}

Требования к объёму:
— В каждом шаге theory: не меньше 4 блоков points, и они должны идти от простого к сложному.
— В первом theory обязателен блок про то, какие величины участвуют и в чём измеряются.
— В каждом шаге theory: 2–3 разобранных примера в examples, от совсем простого к экзаменационному.
— Каждый шаг решения в examples — отдельная строка, с числами, а не «подставим и получим».

VISUAL — необязательное поле, ставь его там, где картинка правда помогает. Один из видов:
{"kind":"plot","x":{"label":"t, с","from":0,"to":10},"y":{"label":"v, м/с"},
 "curves":[{"expr":"2+3*x","label":"разгон"}],"note":"что видно на графике"}
   expr — формула от x: + - * / ^ ( ) и sin cos tan sqrt abs exp ln. Больше ничего.
{"kind":"svg","svg":"<svg viewBox='0 0 320 180'>…</svg>","note":"…"}
   Только для схем: силы, векторы, лучи, разрезы. Без скриптов, без внешних картинок,
   цвет линий currentColor, подписи шрифтом 12px.
{"kind":"table","head":["когда","как пишем","пример"],"rows":[["...","...","..."]]}
{"kind":"steps","items":["Шаг 1 — …","Шаг 2 — …"]}

Ответы в drill — ровно та форма, которую пишут в бланк ЕГЭ: число или слово без пробелов и единиц.`;
}

async function makeLesson(sid, n, minutes, onState) {
  const out = await ask([{ role: "user", content: lessonPrompt(sid, n, minutes) }], lessonSystem(), 32000);
  const j = pullJSON(out);
  const real = await realTasks(sid, n, 4);
  (j.steps || []).forEach(s => { if (s.t === "real") s.ids = real.map(r => r.id); });
  addIntro(j, sid, n);
  const l = {
    key: lessonKey(sid, n), subj: sid, n, at: now(), model: CFG.aiModel || AI.model,
    minutes, title: j.title || SUB[sid].byN[n].name, goal: j.goal || "",
    steps: j.steps || [], chat: [], done: {}
  };
  putLesson(l);
  return l;
}

/* ─────────── график по формуле: разбираем сами, без eval ─────────── */
function compile(src) {
  const s = String(src).replace(/\s+/g, "").replace(/,/g, ".");
  let i = 0;
  const FN = { sin: Math.sin, cos: Math.cos, tan: Math.tan, sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log };
  const peek = () => s[i];
  function expr() {
    let v = term();
    while (peek() === "+" || peek() === "-") { const o = s[i++]; const r = term(); const a = v, b = r; v = o === "+" ? x => a(x) + b(x) : x => a(x) - b(x); }
    return v;
  }
  function term() {
    let v = pow();
    while (peek() === "*" || peek() === "/") { const o = s[i++]; const r = pow(); const a = v, b = r; v = o === "*" ? x => a(x) * b(x) : x => a(x) / b(x); }
    return v;
  }
  function pow() {
    const a = unary();
    if (peek() === "^") { i++; const b = pow(); return x => Math.pow(a(x), b(x)); }
    return a;
  }
  function unary() {
    if (peek() === "-") { i++; const a = unary(); return x => -a(x); }
    if (peek() === "+") { i++; return unary(); }
    return primary();
  }
  function primary() {
    if (peek() === "(") { i++; const v = expr(); if (peek() === ")") i++; return v; }
    const num = /^[0-9]*\.?[0-9]+/.exec(s.slice(i));
    if (num) { i += num[0].length; const c = parseFloat(num[0]); return () => c; }
    const name = /^[a-z]+/.exec(s.slice(i));
    if (name) {
      const w = name[0]; i += w.length;
      if (FN[w]) { if (peek() === "(") { i++; const a = expr(); if (peek() === ")") i++; return x => FN[w](a(x)); } return x => FN[w](x); }
      if (w === "x" || w === "t") return x => x;
      if (w === "pi") return () => Math.PI;
      if (w === "e") return () => Math.E;
    }
    i++; return () => NaN;
  }
  try { const f = expr(); return (typeof f(1) === "number") ? f : null; } catch (e) { return null; }
}

function niceStep(range, want) {
  const raw = range / Math.max(1, want), mag = Math.pow(10, Math.floor(Math.log10(raw) || 0));
  const k = raw / mag;
  return (k <= 1 ? 1 : k <= 2 ? 2 : k <= 2.5 ? 2.5 : k <= 5 ? 5 : 10) * mag;
}
function tickList(lo, hi, want) {
  const st = niceStep(hi - lo, want);
  const a = Math.ceil(lo / st - 1e-9) * st, out = [];
  for (let v = a; v <= hi + 1e-9 && out.length < 12; v += st) out.push(Math.abs(v) < 1e-9 ? 0 : +v.toFixed(6));
  return { ticks: out, step: st };
}
function fmtTick(v, step) {
  const d = Number.isInteger(step) ? 0 : step < 0.1 ? 2 : 1;
  return (+v.toFixed(d)).toString().replace(".", ",");
}

function plotSVG(v) {
  const W = 340, H = 240, L = 46, R = 16, T = 30, B = 40;
  const x0 = v.x && v.x.from != null ? +v.x.from : 0;
  const x1 = v.x && v.x.to != null ? +v.x.to : 10;
  const curves = (v.curves || []).map(c => ({ f: compile(c.expr), label: c.label || "" })).filter(c => c.f);
  const polys = (v.polys || []).filter(p => (p.pts || []).length > 1);
  if (!curves.length && !polys.length && !(v.points || []).length) return "";

  const N = 200, pts = curves.map(c => {
    const a = [];
    for (let k = 0; k <= N; k++) { const x = x0 + (x1 - x0) * k / N; const y = c.f(x); a.push([x, isFinite(y) ? y : null]); }
    return a;
  });
  let lo = Infinity, hi = -Infinity;
  pts.forEach(a => a.forEach(p => { if (p[1] != null) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); } }));
  (v.points || []).forEach(p => { lo = Math.min(lo, +p.y); hi = Math.max(hi, +p.y); });
  polys.forEach(p => p.pts.forEach(q => { lo = Math.min(lo, +q[1]); hi = Math.max(hi, +q[1]); }));
  if (!isFinite(lo) || !isFinite(hi)) return "";
  const minRaw = lo;
  if (hi - lo < 1e-9) hi = lo + 1;
  hi += (hi - lo) * 0.1;
  /* если всё неотрицательное — ось обязана начинаться с нуля, иначе площадь под линией врёт */
  lo = minRaw >= 0 ? 0 : lo - (hi - lo) * 0.08;

  /* шаг сетки: если задан явно — берём его, иначе подбираем круглый */
  const stepY = v.y && v.y.step ? +v.y.step : niceStep(hi - lo, 5);
  const stepX = v.x && v.x.step ? +v.x.step : niceStep(x1 - x0, 6);
  const ticks = (a, b, st) => { const out = [], s0 = Math.ceil(a / st - 1e-9) * st;
    for (let t = s0; t <= b + 1e-9 && out.length < 24; t += st) out.push(+t.toFixed(6)); return out; };
  const ty = ticks(lo, hi, stepY), tx = ticks(x0, x1, stepX);
  if (ty.length) { lo = Math.min(lo, ty[0]); hi = Math.max(hi, ty[ty.length - 1]); }

  const sx = x => L + (x - x0) / (x1 - x0) * (W - L - R);
  const sy = y => T + (hi - y) / (hi - lo) * (H - T - B);
  const COL = ["var(--c)", "#b45309", "#6d28d9"];
  let g = `<svg viewBox="0 0 ${W} ${H}" class="plot" role="img">`;

  /* клетка: и вертикальная, и горизонтальная — иначе по графику ничего не сосчитать */
  tx.forEach(x => g += `<line x1="${sx(x).toFixed(1)}" x2="${sx(x).toFixed(1)}" y1="${T}" y2="${H - B}" class="gr"/>`);
  ty.forEach(y => g += `<line x1="${L}" x2="${W - R}" y1="${sy(y).toFixed(1)}" y2="${sy(y).toFixed(1)}" class="gr"/>`);
  ty.forEach(y => g += `<text x="${L - 8}" y="${(sy(y) + 4).toFixed(1)}" class="ax" text-anchor="end">${fmtTick(y, stepY)}</text>`);
  tx.forEach(x => g += `<text x="${sx(x).toFixed(1)}" y="${H - B + 17}" class="ax" text-anchor="middle">${fmtTick(x, stepX)}</text>`);

  const zy = (0 >= lo && 0 <= hi) ? sy(0) : sy(lo);
  g += `<line x1="${L}" x2="${W - R}" y1="${zy.toFixed(1)}" y2="${zy.toFixed(1)}" class="axis"/>`;
  g += `<line x1="${L}" x2="${L}" y1="${T - 4}" y2="${H - B}" class="axis"/>`;

  pts.forEach((a, idx) => {
    let d = "", pen = false;
    a.forEach(p => {
      if (p[1] == null || p[1] < lo || p[1] > hi) { pen = false; return; }
      d += (pen ? "L" : "M") + sx(p[0]).toFixed(1) + " " + sy(p[1]).toFixed(1) + " "; pen = true;
    });
    g += `<path d="${d}" fill="none" stroke="${COL[idx % 3]}" stroke-width="2.5" stroke-linecap="round"/>`;
    if (curves[idx].label)
      g += `<text x="${W - R}" y="${T - 10 + idx * 13}" class="cl" fill="${COL[idx % 3]}" text-anchor="end">${esc(curves[idx].label)}</text>`;
  });

  /* ломаная по точкам: так выглядят графики в настоящих заданиях */
  polys.forEach((p, idx) => {
    const dd = p.pts.map(q => sx(+q[0]).toFixed(1) + "," + sy(+q[1]).toFixed(1)).join(" ");
    const col = COL[(curves.length + idx) % 3];
    if (p.fill !== false && p.fill)
      g += `<polygon points="${sx(p.pts[0][0]).toFixed(1)},${sy(0).toFixed(1)} ${dd} ${sx(p.pts[p.pts.length - 1][0]).toFixed(1)},${sy(0).toFixed(1)}" fill="${col}" opacity=".14"/>`;
    g += `<polyline points="${dd}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    p.pts.forEach(q => g += `<circle cx="${sx(+q[0]).toFixed(1)}" cy="${sy(+q[1]).toFixed(1)}" r="3.5" fill="${col}"/>`);
    if (p.label) g += `<text x="${W - R}" y="${T - 10 + (curves.length + idx) * 13}" class="cl" fill="${col}" text-anchor="end">${esc(p.label)}</text>`;
  });

  /* точки на линии — чтобы было что сопоставлять глазом */
  (v.points || []).forEach(p => {
    const X = sx(+p.x), Y = sy(+p.y);
    g += `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="4.5" fill="var(--c)" stroke="var(--card)" stroke-width="2"/>`;
    if (p.label) g += `<text x="${(X + 8).toFixed(1)}" y="${(Y - 8).toFixed(1)}" class="pl">${esc(p.label)}</text>`;
  });

  /* пунктир «как читать»: от оси до линии и обратно */
  if (v.read) {
    const X = sx(+v.read.x), Y = sy(+v.read.y);
    g += `<line x1="${X.toFixed(1)}" y1="${(H - B).toFixed(1)}" x2="${X.toFixed(1)}" y2="${Y.toFixed(1)}" class="rd"/>`;
    g += `<line x1="${L}" y1="${Y.toFixed(1)}" x2="${X.toFixed(1)}" y2="${Y.toFixed(1)}" class="rd"/>`;
    g += `<circle cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="5" fill="var(--c)" stroke="var(--card)" stroke-width="2"/>`;
    if (v.read.label) g += `<text x="${(X + 9).toFixed(1)}" y="${(Y - 9).toFixed(1)}" class="pl">${esc(v.read.label)}</text>`;
  }

  g += `<text x="${W - R}" y="${H - 4}" class="axname" text-anchor="end">${esc((v.x && v.x.label) || "x")}</text>`;
  g += `<text x="${L - 40}" y="${T - 12}" class="axname">${esc((v.y && v.y.label) || "y")}</text>`;
  return g + "</svg>";
}

function safeSVG(src) {
  let s = String(src || "");
  if (s.indexOf("<svg") < 0) return "";
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/(href|xlink:href)\s*=\s*("[^"]*"|'[^']*')/gi, "");
  return s;
}

function visualHTML(v) {
  if (!v || !v.kind) return "";
  let body = "";
  if (v.kind === "plot") body = plotSVG(v);
  else if (v.kind === "svg") body = safeSVG(v.svg);
  else if (v.kind === "table" && v.head) {
    body = `<div class="tw"><table class="vt"><thead><tr>${v.head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>` +
      (v.rows || []).map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") + `</tbody></table></div>`;
  } else if (v.kind === "steps") {
    body = `<ol class="vsteps">${(v.items || []).map(x => `<li>${esc(x)}</li>`).join("")}</ol>`;
  }
  if (!body) return "";
  return `<figure class="vis">${body}${v.note ? `<figcaption>${esc(v.note)}</figcaption>` : ""}</figure>`;
}

/* Вводная: тема по кодификатору, понятия, место в траектории */
function addIntro(j, sid, n) {
  if (!j.steps || !j.steps.length || j.steps[0].t === "intro") return;
  const sub = SUB[sid];
  j.steps.unshift(Object.assign({ t: "intro", minutes: 2 }, j.intro || {}));
}

/* ─────────── экран урока ─────────── */
const norm = s => String(s == null ? "" : s).toLowerCase().replace(/\s| /g, "")
  .replace(/,/g, ".").replace(/[«»"'`]/g, "").replace(/[–—−‒―‑]/g, "-").trim();

function sameAnswer(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const nx = parseFloat(x.replace(/[^0-9.\-]/g, "")), ny = parseFloat(y.replace(/[^0-9.\-]/g, ""));
  if (isFinite(nx) && isFinite(ny) && Math.abs(nx - ny) < 1e-6) return true;
  return false;
}

function stepState(i) { if (!LES.done[i]) LES.done[i] = { ans: {}, res: {} }; return LES.done[i]; }

function introHTML(st) {
  const sub = SUB[LES.subj], t = sub.byN[LES.n];
  const share = Math.round(t.p / sub.maxPrimary * 100);
  return `<h2 class="ls-h big">${esc(st.head || t.name)}</h2>
    ${st.lead ? `<p class="lead">${esc(st.lead)}</p>` : ""}
    ${st.hook ? `<p class="hook">${esc(st.hook)}</p>` : ""}
    ${(st.learn || []).length ? `<ul class="learn">${st.learn.slice(0, 3).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    <div class="meta">Задание ${LES.n} из ${sub.tasksTotal} · ${plural(t.p, "балл", "балла", "баллов")} из ${sub.maxPrimary} · ${share}% работы</div>`;
}

function cardHTML(st, i) {
  const S1 = stepState(i), res = S1.res[0];
  let h = `<h2 class="ls-h">${esc(st.title || "")}</h2>`;
  if (st.setup) h += `<p class="setup">${esc(st.setup)}</p>`;
  if (st.text) h += String(st.text).split(/\n{2,}/).map(x => `<p class="card-text">${esc(x)}</p>`).join("");
  if (st.quote) h += `<blockquote class="pull">${esc(st.quote)}</blockquote>`;
  if (st.formula) {
    const f = st.formula;
    h += `<div class="frm${f.remember ? " keep" : ""}">
      ${f.remember ? `<div class="keep-t">запомнить</div>` : ""}
      <b>${esc(f.f)}</b>
      <span>${esc(f.what || "")}</span>
      ${(f.vars || []).length ? `<div class="vars">${f.vars.map(v => `<div><i>${esc(v.v)}</i>${esc(v.means)}</div>`).join("")}</div>` : ""}
    </div>`;
  }
  h += visualHTML(st.visual);
  if (st.note) h += `<p class="card-note">${esc(st.note)}</p>`;
  if (st.check) {
    h += `<div class="check ${res || ""}">
      <div class="check-t">${res === "ok" ? "Получилось" : "Проверь себя"}</div>
      <div class="check-q">${esc(st.check.q)}</div>
      ${res === "ok" ? "" : `<div class="dr-in">
        <input type="text" id="dr${i}_0" value="${esc(S1.ans[0] || "")}" placeholder="ответ" autocomplete="off">
        <button class="dr-go go" data-act="drill" data-i="${i}" data-k="0">Ответить</button>
      </div>`}
      ${res === "ok" ? `<div class="dr-r ok"><b>Верно</b>${st.check.why ? " · " + esc(st.check.why) : ""}</div>` : ""}
      ${res === "no" ? `<div class="dr-r no"><b>Пока нет.</b> ${esc(st.check.hint || "")}
        <button class="lnk" data-act="sol" data-i="${i}" data-k="0">показать ответ</button></div>` : ""}
      ${res === "sol" ? `<div class="dr-r sol"><b>Ответ: ${esc(st.check.a)}</b>${st.check.why ? "<br>" + esc(st.check.why) : ""}</div>` : ""}
      ${res && res !== "ok" ? `<button class="explain hot" data-act="explain" data-i="${i}" data-k="0">Разобрать по шагам</button>` : ""}
    </div>`;
  }
  if (st.bridge && (!st.check || res)) h += `<div class="bridge">${esc(st.bridge)}</div>`;
  return h;
}

function theoryHTML(st) {
  let h = `<h2 class="ls-h">${esc(st.title || "")}</h2>`;
  if (st.idea) h += `<p class="ls-idea">${esc(st.idea)}</p>`;
  (st.formulas || []).forEach(f => h += `<div class="frm"><b>${esc(f.f)}</b><span>${esc(f.what || "")}</span></div>`);
  h += visualHTML(st.visual);
  (st.points || []).forEach(p => h += `<div class="pt"><h3>${esc(p.h || "")}</h3><p>${esc(p.text || "")}</p></div>`);
  if (st.example) {
    h += `<div class="exa"><div class="exa-t">Разбор примера</div>
      <p class="exa-q">${esc(st.example.q || "")}</p>
      <ol>${(st.example.steps || []).map(s => `<li>${esc(s)}</li>`).join("")}</ol>
      <div class="exa-a">Ответ: <b>${esc(st.example.a || "")}</b></div></div>`;
  }
  if (st.trap) h += `<div class="trap"><b>Где обычно ошибаются</b>${esc(st.trap)}</div>`;
  return h;
}

function drillHTML(st, i) {
  const S1 = stepState(i);
  let h = `<h2 class="ls-h">${esc(st.title || "Упражнение")}</h2>`;
  (st.tasks || []).forEach((t, k) => {
    const res = S1.res[k];
    h += `<div class="dr ${res || ""}">
      <div class="dr-q"><span class="dr-n">${k + 1}</span>${esc(t.q || "")}</div>
      <div class="dr-in">
        <input type="text" id="dr${i}_${k}" value="${esc(S1.ans[k] || "")}" placeholder="ответ" ${res === "ok" ? "disabled" : ""} autocomplete="off" inputmode="text">
        <button class="dr-go" data-act="drill" data-i="${i}" data-k="${k}">${res ? "Ещё раз" : "Проверить"}</button>
      </div>
      ${res === "ok" ? `<div class="dr-r ok">Верно${t.sol ? " · " + esc(t.sol) : ""}</div>` : ""}
      ${res === "no" ? `<div class="dr-r no">Не сходится. ${esc(t.hint || "")}
        <button class="lnk" data-act="sol" data-i="${i}" data-k="${k}">показать решение</button></div>` : ""}
      ${res === "sol" ? `<div class="dr-r sol"><b>Ответ: ${esc(t.a || "")}</b><br>${esc(t.sol || "")}</div>` : ""}
      <button class="explain${res === "no" ? " hot" : ""}" data-act="explain" data-i="${i}" data-k="${k}">Не понимаю это задание — разобрать</button>
    </div>`;
  });
  return h;
}

function guidedHTML(st, i) {
  const S1 = stepState(i);
  const steps = st.steps || [];
  let openIdx = steps.findIndex((x, k) => S1.res[k] !== "ok" && S1.res[k] !== "sol");
  if (openIdx < 0) openIdx = steps.length;
  let h = `<h2 class="ls-h">${esc(st.title || "Решаем вместе")}</h2>
    ${st.lead ? `<p class="card-text">${esc(st.lead)}</p>` : ""}
    <div class="gtask">${esc(st.task || "")}</div>`;
  steps.forEach((x, k) => {
    if (k > openIdx) return;                       /* следующий шаг появляется после ответа */
    const res = S1.res[k];
    h += `<div class="gstep ${res || ""}${k === openIdx ? " now" : ""}">
      <div class="gnum">${k + 1}</div>
      <div class="gbody">
        <div class="check-q">${esc(x.q)}</div>
        ${res === "ok" || res === "sol"
          ? `<div class="dr-r ${res === "ok" ? "ok" : "sol"}">${res === "ok" ? "Верно" : "Ответ: " + esc(x.a)}${x.why ? " · " + esc(x.why) : ""}</div>`
          : `<div class="dr-in">
              <input type="text" id="dr${i}_${k}" value="${esc(S1.ans[k] || "")}" placeholder="ответ" autocomplete="off">
              <button class="dr-go" data-act="drill" data-i="${i}" data-k="${k}">Ответить</button>
            </div>
            ${res === "no" ? `<div class="dr-r no">Пока нет. ${esc(x.hint || "")}
              <button class="lnk" data-act="sol" data-i="${i}" data-k="${k}">показать</button></div>` : ""}`}
      </div></div>`;
  });
  if (openIdx >= steps.length && st.wrap)
    h += `<div class="gwrap"><b>Алгоритм целиком</b>${esc(st.wrap)}</div>`;
  return h;
}

function realHTML(st, i) {
  const S1 = stepState(i);
  const list = (st.ids || []).map(id => (BANK[LES.subj] || []).find(q => q.id === id)).filter(Boolean);
  let h = `<h2 class="ls-h">${esc(st.title || "Настоящие задания ЕГЭ")}</h2>
    <p class="ls-idea">Задания из Открытого банка ФИПИ — те же, что на экзамене.</p>
    ${LES.subj === "rus" && [16, 17, 18, 19, 20, 21].indexOf(LES.n) >= 0
      ? `<div class="warnline">На расстановке запятых ИИ ошибается заметно чаще, чем в остальном.
         Его ответ здесь — подсказка, а не приговор: сверяйся с правилом.</div>` : ""}`;
  if (!list.length) return h + `<p class="rest">Банк заданий пока не загружен. Упражнения выше — на ту же тему.</p>`;
  list.forEach((q, k) => {
    const res = S1.res[k];
    h += `<div class="dr real ${res || ""}">
      <div class="src">Задание ${q.task || LES.n} · ${esc(SUB[LES.subj].byN[q.task || LES.n] ? SUB[LES.subj].byN[q.task || LES.n].name : (q.kes || [])[0] || "")}${q.answer ? " · с разбором" : ""}</div>
      <div class="dr-q real-q">${q.html}</div>
      <div class="dr-in">
        <input type="text" id="dr${i}_${k}" value="${esc(S1.ans[k] || "")}" placeholder="ответ" autocomplete="off">
        <button class="dr-go" data-act="realcheck" data-i="${i}" data-k="${k}">Проверить</button>
      </div>
      ${S1.res[k] ? `<div class="dr-r ${res === "ok" ? "ok" : "sol"}">${esc(S1.msg && S1.msg[k] || "")}</div>` : ""}
      <button class="explain${res === "no" ? " hot" : ""}" data-act="explain" data-i="${i}" data-k="${k}">Не понимаю это задание — разобрать</button>
    </div>`;
  });
  return h;
}

function doneHTML() {
  const sub = SUB[LES.subj];
  let solved = 0, total = 0;
  LES.steps.forEach((s, i) => {
    if (s.t !== "drill" && s.t !== "real" && !(s.t === "card" && s.check)) return;
    const d = LES.done[i] || { res: {} };
    const cnt = s.t === "drill" ? (s.tasks || []).length : s.t === "real" ? (s.ids || []).length : 1;
    total += cnt;
    Object.values(d.res).forEach(r => { if (r === "ok") solved++; });
  });
  const keep = [];
  LES.steps.forEach(s => { if (s.formula && s.formula.remember) keep.push(s.formula); });
  return `<h2 class="ls-h">Занятие пройдено</h2>
    <p class="ls-idea">${esc(LES.goal || "")}</p>
    <div class="sumbox"><b>${solved} из ${total}</b><span>решено верно</span></div>
    ${keep.length ? `<div class="lab">Формулы, которые нужно помнить</div>
      <div class="keeplist">${keep.map(f => `<div class="kf"><b>${esc(f.f)}</b><span>${esc(f.what || "")}</span></div>`).join("")}</div>` : ""}
    <div class="lab">Как оно теперь?</div>
    <div class="stat-row">
      <button class="st ok" data-act="finish" data-st="ok">получается</button>
      <button class="st bad" data-act="finish" data-st="bad">не получается</button>
    </div>
    <p class="sh-foot">Отметка уходит в траекторию: «не получается» добавит разбор и повторение и сдвинет даты только по этому предмету.</p>`;
}

function renderLesson() {
  if (!LES) { view = "week"; return renderWeek(); }
  const sub = SUB[LES.subj], last = LES.steps.length;
  const st = stepIdx < last ? LES.steps[stepIdx] : null;
  const pct = Math.round((stepIdx) / last * 100);
  const kind = st ? st.t : "done";

  let h = `<div class="ls-top">
      <button class="ico" data-act="lsback">‹</button>
      <div class="ls-ti"><b>${esc(LES.title)}</b><span>${esc(sub.short)} · задание ${LES.n}</span></div>
      <div class="ls-step">${stepIdx < last ? (stepIdx + 1) + " / " + last : "итог"}</div>
      <button class="ico" data-act="lsmenu" aria-label="Ещё">⋯</button>
    </div>
    <div class="ls-bar"><i style="width:${pct}%;--c:${sub.color}"></i></div>`;

  h += `<div class="ls-body" style="--c:${sub.color}">`;
  if (kind === "intro") h += introHTML(st);
  else if (kind === "guided") h += guidedHTML(st, stepIdx);
  else if (kind === "card") h += cardHTML(st, stepIdx);
  else if (kind === "theory") h += theoryHTML(st);
  else if (kind === "drill") h += drillHTML(st, stepIdx);
  else if (kind === "real") h += realHTML(st, stepIdx);
  else h += doneHTML();
  h += `</div>`;

  if (st) {
    h += `<div class="ls-nav">
      <button class="ghost half" data-act="chat">Не понял</button>
      <button class="primary half" data-act="next">${stepIdx === last - 1 ? "Закончить" : "Дальше"}${st.minutes ? ` · ${st.minutes} мин` : ""}</button>
    </div>`;
  }
  return h;
}

/* ─────────── действия внутри урока ─────────── */
function drillCheck(i, k) {
  const st = LES.steps[i], S1 = stepState(i);
  const t = st.t === "card" ? st.check : st.t === "guided" ? (st.steps || [])[k] : (st.tasks || [])[k];
  const el = $("#dr" + i + "_" + k); if (!el || !t) return;
  const val = el.value.trim();
  S1.ans[k] = val;
  if (S1.res[k]) { S1.res[k] = null; putLesson(LES); render(); return; }
  S1.res[k] = sameAnswer(val, t.a) ? "ok" : "no";
  putLesson(LES); render();
}
function showSol(i, k) { stepState(i).res[k] = "sol"; putLesson(LES); render(); }

/* контекст для разбора карточки */
function cardCtx(i) {
  const st = LES.steps[i], S1 = stepState(i);
  return { key: "card:" + i, title: st.title || LES.title,
    body: `Карточка занятия: ${st.title}\n${st.text || ""}` +
          (st.formula ? `\nФормула: ${st.formula.f} — ${st.formula.what}` : "") +
          (st.check ? `\nВопрос: ${st.check.q}\nПравильный ответ: ${st.check.a}` : "") +
          (S1.ans[0] ? `\nУченик ответил: ${S1.ans[0]}` : ""), task: true };
}

async function realCheck(i, k) {
  const st = LES.steps[i], S1 = stepState(i);
  const q = (BANK[LES.subj] || []).find(x => x.id === (st.ids || [])[k]);
  const el = $("#dr" + i + "_" + k); if (!q || !el) return;
  const val = el.value.trim();
  if (!val) { toast("Сначала впиши ответ"); return; }
  S1.ans[k] = val; if (!S1.msg) S1.msg = {};

  /* если у задания есть готовый ответ — сверяем сразу, без сети и без денег */
  if (q.answer) {
    const ok = sameAnswer(val, q.answer);
    S1.res[k] = ok ? "ok" : "no";
    S1.msg[k] = (ok ? "Верно. " : "Правильный ответ: " + q.answer + ". ")
      + (q.solution ? q.solution.slice(0, 500) : "");
    putLesson(LES); render();
    return;
  }

  if (busy) return;
  busy = true; S1.msg[k] = "Проверяю…"; S1.res[k] = "wait"; render();
  try {
    const out = await ask([{
      role: "user",
      content: `Настоящее задание ЕГЭ по предмету «${SUB[LES.subj].name}».

ЗАДАНИЕ:
${q.plain}

Ученик ответил: ${val}

Реши задание сам, затем сравни. Ответь JSON:
{"ok": true|false, "right": "правильный ответ в форме бланка", "why": "если неверно — где ошибка и как надо, 2–3 предложения; если верно — одна строка, чем решение подтверждается"}`
    }], lessonSystem(), 4000);
    const j = pullJSON(out);
    S1.res[k] = j.ok ? "ok" : "no";
    S1.msg[k] = j.ok ? ("Верно. " + (j.why || "")) : ("Правильный ответ: " + (j.right || "?") + ". " + (j.why || ""));
  } catch (e) {
    S1.res[k] = null; S1.msg[k] = "";
    toast(e.message || "Проверка не вышла");
  }
  busy = false; putLesson(LES); render();
}

function nextStep() {
  if (stepIdx < LES.steps.length) stepIdx++;
  LES.pos = stepIdx; putLesson(LES);
  window.scrollTo(0, 0); render();
}

/* ─────────── «не понял» и разбор задания ─────────── */
/* ctx: {key, title, body} — либо шаг занятия, либо конкретное задание */
function stepCtx() {
  const st = LES.steps[stepIdx];
  return { key: "step:" + stepIdx, title: (st && st.title) || LES.title,
           body: "Шаг занятия (JSON): " + JSON.stringify(st).slice(0, 7000), task: false };
}
function taskCtx(i, k) {
  const st = LES.steps[i], S1 = stepState(i);
  if (st.t === "card") return cardCtx(i);
  if (st.t === "drill") {
    const t = (st.tasks || [])[k] || {};
    return { key: "task:" + i + ":" + k, title: "Задание " + (k + 1), auto: true,
      body: `Условие: ${t.q}\nПравильный ответ: ${t.a}\nКраткое решение: ${t.sol || "—"}` +
            (S1.ans[k] ? `\nУченик ответил: ${S1.ans[k]}` : ""), task: true };
  }
  const q = (BANK[LES.subj] || []).find(x => x.id === (st.ids || [])[k]) || {};
  return { key: "task:" + i + ":" + k, title: "Настоящее задание ЕГЭ", auto: true,
    body: `Настоящее задание ЕГЭ из банка ФИПИ.\nУсловие: ${q.plain || ""}` +
          (S1.ans[k] ? `\nУченик ответил: ${S1.ans[k]}` : ""), task: true };
}

function chatLog(key) {
  if (LES && LES.chat) return LES.chat;
  if (!S.chats) S.chats = {};
  if (!S.chats[key]) S.chats[key] = [];
  return S.chats[key];
}
function chatSave() { if (LES) putLesson(LES); else save(); }

function chatSheet(ctx) {
  ctx = ctx || stepCtx();
  const LOG = chatLog(ctx.key);
  const chips = ctx.task
    ? ["Разбери с нуля", "С чего начать?", "Почему такой ответ?", "Дай похожую задачу"]
    : ["Объясни проще", "Покажи ещё пример", "Почему именно так?", "Что тут главное?"];
  const rusPunct = LES && LES.subj === "rus" && [16, 17, 18, 19, 20, 21].indexOf(LES.n) >= 0;
  openSheet(`<h3>${ctx.task ? "Разбор задания" : "Спросить по шагу"}</h3>
    <p class="sh-sub">${esc(ctx.title)} · ответ сохранится в уроке</p>
    ${rusPunct ? `<div class="warnline">Расстановка запятых — единственное место, где ИИ ошибается заметно часто.
      Считай ответ подсказкой и сверяйся с правилом, а не наоборот.</div>` : ""}
    <div class="chat" id="chatBox">${LOG.filter(m => m.ctx === ctx.key).map(m =>
      `<div class="msg ${m.role}">${esc(m.text)}</div>`).join("")
      || `<div class="msg hint">${ctx.task
        ? "Нажми «Разбери с нуля» — объяснит по шагам, что дано, какой закон брать и почему."
        : "Спроси всё, что непонятно — формулировку, шаг решения, откуда взялась формула."}</div>`}</div>
    <div class="chips">${chips.map(c => `<button class="chip2" data-q="${esc(c)}">${esc(c)}</button>`).join("")}</div>
    <div class="ask-row"><input type="text" id="askIn" placeholder="свой вопрос" autocomplete="off"><button class="primary sm" id="askGo">Спросить</button></div>`,
    el => {
      const go = async q => {
        q = (q || "").trim(); if (!q || busy) return;
        if (q === "Разбери с нуля") q = "Разбери это задание с нуля: что дано, что надо найти, какой закон или правило применить и почему именно его, потом счёт по шагам с числами. Считай, что тему я вижу впервые.";
        LOG.push({ role: "me", text: q, ctx: ctx.key, at: now() });
        chatSave();
        const box = $("#chatBox", el);
        box.innerHTML += `<div class="msg me">${esc(q)}</div><div class="msg ai wait">думает…</div>`;
        box.scrollTop = box.scrollHeight;
        busy = true;
        try {
          const hist = LOG.filter(m => m.ctx === ctx.key).slice(-7, -1)
            .map(m => ({ role: m.role === "me" ? "user" : "assistant", content: m.text }));
          const head = `Ученик 11 класса готовится к ЕГЭ.
${ctx.body}

Отвечай обычным текстом, не JSON. Простым языком, по шагам, с числами. Без вводных фраз и похвалы.
Если объясняешь решение — доведи до числа, не обрывайся на формуле.`;
          const out = await ask(
            [{ role: "user", content: head }].concat(hist, [{ role: "user", content: q }]),
            lessonSystem().replace("— Отвечай ТОЛЬКО валидным JSON без пояснений вокруг.", "— Отвечай обычным текстом."),
            6000);
          LOG.push({ role: "ai", text: out.trim(), ctx: ctx.key, at: now() });
          chatSave();
          const w = $(".msg.ai.wait", el);
          if (w) w.outerHTML = `<div class="msg ai">${esc(out.trim())}</div>`;
          box.scrollTop = box.scrollHeight;
        } catch (e) {
          const w = $(".msg.ai.wait", el);
          if (w) w.outerHTML = `<div class="msg ai err">${esc(e.message || "не вышло")}</div>`;
        }
        busy = false;
      };
      $$(".chip2", el).forEach(b => b.onclick = () => go(b.dataset.q));
      $("#askGo", el).onclick = () => { const inp = $("#askIn", el); const v = inp.value; inp.value = ""; go(v); };
      $("#askIn", el).addEventListener("keydown", e => { if (e.key === "Enter") $("#askGo", el).click(); });
      if (ctx.auto && !LOG.some(m => m.ctx === ctx.key)) setTimeout(() => go("Разбери с нуля"), 60);
    });
}

/* ─────────── запуск урока из занятия ─────────── */
async function openLesson(sesId) {
  const s = S.sessions[sesId];
  if (!s) return;
  const n = (s.refs || [])[0];
  if (!n) { toast("У этого занятия нет привязанного задания"); return; }
  const sid = s.subj;
  await loadBank(sid);
  let l = getLesson(sid, n);
  LES = l; stepIdx = l ? clamp(l.pos || 0, 0, l.steps.length) : 0; lessonSes = sesId;
  if (l) { view = "lesson"; render(); window.scrollTo(0, 0); return; }

  const ready = await loadShipped(sid, n, s.plan || 60);
  if (ready) { LES = ready; stepIdx = 0; view = "lesson"; render(); window.scrollTo(0, 0); return; }

  if (!CFG.aiKey) { aiSetup(); return; }

  view = "lesson";
  $("#app").innerHTML = `<div class="gen"><div class="spin"></div>
    <b>Собираю занятие</b>
    <span>${esc(SUB[sid].name)} · задание ${n} · ${esc(SUB[sid].byN[n].name)}</span>
    <small>Первый раз это занимает несколько минут: модель пишет теорию, примеры и упражнения.
    Дальше урок открывается мгновенно и работает без сети. Следующие уроки готовятся заранее,
    пока приложение открыто — ждать больше не придётся.</small></div>`;
  try {
    LES = await makeLesson(sid, n, s.plan || 60);
    stepIdx = 0; render(); window.scrollTo(0, 0);
  } catch (e) {
    view = "week"; render();
    toast(e.message || "Не собралось");
  }
}
let lessonSes = null;

function finishLesson(stv) {
  if (lessonSes && S.sessions[lessonSes]) {
    const s = S.sessions[lessonSes];
    if (!s.done) { s.done = true; s.fact = s.plan; s.at = now(); }
  }
  setStat(LES.subj, LES.n, stv);
  LES = null; lessonSes = null; view = "week";
  save(); recompute(); render();
  toast(stv === "ok" ? "Отмечено: получается" : "Отмечено: не получается — добавлю разбор");
}

function lessonMenu() {
  openSheet(`<h3>Урок</h3>
    <p class="sh-sub">${esc(LES.title)} · ${LES.shipped ? "готовый урок, проверен вручную" : "собран " + new Date(LES.at).toLocaleDateString("ru") + " · " + esc(LES.model || "")}</p>
    <button class="ghost" id="lmRe">Собрать заново</button>
    <button class="ghost" id="lmStart">Начать с первого шага</button>
    <button class="ghost danger" id="lmDel">Удалить урок</button>
    <p class="sh-foot">Заново стоит собирать, если объяснение не зашло: получится другое. Прежнее сотрётся.</p>`,
    el => {
      $("#lmStart", el).onclick = () => { stepIdx = 0; LES.pos = 0; putLesson(LES); closeSheet(); render(); };
      $("#lmDel", el).onclick = () => {
        delete S.lessons[LES.key]; save(); LES = null; view = "week"; closeSheet(); render(); toast("Урок удалён");
      };
      $("#lmRe", el).onclick = async () => {
        const sid = LES.subj, n = LES.n, mins = LES.minutes;
        closeSheet();
        $("#app").innerHTML = `<div class="gen"><div class="spin"></div><b>Собираю заново</b>
          <span>${esc(SUB[sid].name)} · задание ${n}</span></div>`;
        try { LES = await makeLesson(sid, n, mins); stepIdx = 0; render(); }
        catch (e) { render(); toast(e.message || "Не собралось"); }
      };
    });
}

/* ─────────── следующий этап по предмету ─────────── */
function nextTask(sid) {
  const p = PLAN[sid];
  if (p && p.queue && p.queue.length) return p.queue[0].n;
  const bad = SUB[sid].tasks.find(t => tstat(sid, t.n) === "bad");
  return bad ? bad.n : null;
}

async function openSubject(sid) {
  curSubj = sid;
  await loadBank(sid);
  await loadMap(sid); await loadQX(sid); await loadForm(sid);
  view = "subject"; render(); window.scrollTo(0, 0);
}

async function startSubject(sid) {
  const n = nextTask(sid);
  if (n == null) { toast("По этому предмету всё освоено"); return; }
  /* занятие на сегодня: берём запланированное или заводим новое */
  let ses = Object.values(S.sessions).find(x =>
    !x.del && !x.done && x.subj === sid && x.date === today() && (x.refs || []).length === 1);
  if (!ses) ses = addSession({
    date: today(), subj: sid, kind: "self", plan: S.rhythm[sid].minutes || 60,
    title: SUB[sid].byN[n].name, sub: "задание " + n, refs: [n], ord: 1
  });
  else if ((ses.refs || [])[0] !== n) { ses.refs = [n]; ses.title = SUB[sid].byN[n].name; }
  save();
  await openLesson(ses.id);
}

/* ─────────── подготовка вперёд отключена ─────────── */
let prepping = false, prepNow = "";

function prepList() {
  const from = today(), seen = {}, out = [];
  Object.values(S.sessions)
    .filter(s => !s.del && !s.done && s.refs && s.refs.length === 1 && diffDays(from, s.date) >= 0)
    .sort((a, b) => diffDays(b.date, a.date) || (a.ord || 0) - (b.ord || 0))
    .forEach(s => {
      const k = lessonKey(s.subj, s.refs[0]);
      if (seen[k] || getLesson(s.subj, s.refs[0])) return;
      seen[k] = 1; out.push(s);
    });
  return out;
}

async function prepNext() { /* уроки лежат готовыми, генерировать нечего */ }

function prepLine() { return ""; }

/* ─────────── экран настроек больше не про ИИ ─────────── */
function aiSetup() {
  openSheet(`<h3>Разборы</h3>
    <p class="sh-sub">Теория, подсказки и пошаговые разборы записаны в приложении заранее.
      Интернет нужен только один раз — чтобы скачать банк заданий.</p>
    <p class="hint">Задания, ответы и официальные разборы взяты из каталога «Решу ЕГЭ»,
      структура и формулировки заданий — из спецификации ФИПИ на 2027 год.</p>`);
}
