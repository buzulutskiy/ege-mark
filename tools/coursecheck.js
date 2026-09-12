#!/usr/bin/env node
/* Проверка собранного курса на соответствие эталону (docs/etalon-kursa.md).
   node tools/coursecheck.js lessons/course-fiz-1.json

   Не пропускает: ссылки на несуществующие задачи и виды, задачи без разбора,
   пропущенные подвиды и задачи ядра, кривые формулы, несуществующие иллюстрации,
   вопросы, у которых верный ответ не входит в варианты, и нарушенный порядок
   «упрощённое → настоящее с разбором → близнец». */
const fs = require("fs"), path = require("path"), vm = require("vm");

const file = process.argv[2] || "lessons/course-fiz-1.json";
const root = path.resolve(__dirname, "..");
const course = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
const sid = course.subj, num = course.task;

const plan = JSON.parse(fs.readFileSync(path.join(root, `lessons/plan-${sid}.json`), "utf8"))[String(num)];
const raz = JSON.parse(fs.readFileSync(path.join(root, `lessons/razbor-${sid}-${num}.json`), "utf8"));
const bank = {};
JSON.parse(fs.readFileSync(path.join(root, `bank/bank-${sid}.json`), "utf8")).tasks.forEach(t => { bank[t.id] = t; });

/* math.js — в песочнице, чтобы проверить, что формулы разбираются */
const msb = { console }; vm.createContext(msb);
vm.runInContext(fs.readFileSync(path.join(root, "math.js"), "utf8") +
  "\n;this.__m = typeof mathHTML === 'function' ? mathHTML : null;", msb);
const mathHTML = msb.__m;

/* draw.js — какие иллюстрации существуют */
const GRAPH = require(path.join(root, "gen/graph.js"));
const dsb = { GRAPH, console, module: { exports: {} } }; vm.createContext(dsb);
vm.runInContext(fs.readFileSync(path.join(root, "gen/draw.js"), "utf8"), dsb);
const DRAW = dsb.module.exports;

/* генераторы — какие виды существуют */
const RND = require(path.join(root, "gen/rnd.js"));
const kinds = {};
plan.groups.forEach(g => {
  const f = path.join(root, `gen/kin-${g.key}.js`);
  if (!fs.existsSync(f)) return;
  const m = { exports: {} };
  new Function("RND", "GRAPH", "module", fs.readFileSync(f, "utf8"))(RND, GRAPH, m);
  kinds[g.key] = (m.exports.kinds || []).map(k => k.id);
});

/* подвиды и задачи ядра из плана */
const subs = [];
plan.groups.forEach(g => (g.subs && g.subs.length ? g.subs : [g]).forEach(s =>
  subs.push({ key: g.key, group: g.title, title: s.title || g.title, tasks: s.tasks || [] })));
const core = [].concat(...subs.map(s => s.tasks));

const bad = [], warn = [];
const steps = course.steps || [];
const seenShow = new Set(), seenReal = new Set(), seenSolve = new Set(), seenWarm = new Set();

steps.forEach((s, i) => {
  const at = `шаг ${i + 1} (${s.t})`;
  if (!s.part) warn.push(`${at}: не указана часть`);

  if (s.t === "teach" || s.t === "warm" || s.t === "recap") {
    if (s.ill && !DRAW[s.ill]) bad.push(`${at}: иллюстрации «${s.ill}» нет в gen/draw.js`);
    (s.f || []).forEach(f => {
      if (!Array.isArray(f) || f.length < 2) { bad.push(`${at}: формула должна быть парой [формула, пояснение]`); return; }
      if (/[\\$]|\\frac/.test(f[0])) bad.push(`${at}: LaTeX в формуле «${f[0]}»`);
      if (mathHTML) { try { mathHTML(f[0]); } catch (e) { bad.push(`${at}: math.js не разобрал «${f[0]}»: ${e.message}`); } }
    });
  }
  if (s.t === "teach") {
    if (!s.title) bad.push(`${at}: нет заголовка`);
    if (!(s.p || []).length) bad.push(`${at}: нет текста`);
    (s.p || []).forEach(p => { if (/очевидно|легко видеть|как известно/i.test(p)) warn.push(`${at}: «${p.slice(0, 40)}…» — так писать нельзя`); });
  }
  if (s.t === "quiz") {
    if (!(s.opts || []).length) bad.push(`${at}: нет вариантов`);
    else if (s.opts.indexOf(s.ok) < 0) bad.push(`${at}: верный ответ «${s.ok}» не входит в варианты`);
    if (!s.why) bad.push(`${at}: нет объяснения, почему так`);
  }
  if (s.t === "warm") {
    if (!s.q) bad.push(`${at}: нет условия`);
    if (!(s.steps || []).length) bad.push(`${at}: нет решения`);
    if (!s.a) bad.push(`${at}: нет ответа`);
    (s.steps || []).forEach(x => {
      if (/^f\s*:/.test(x)) {
        const b = x.replace(/^f\s*:/, "").trim();
        if (b.split("(").length !== b.split(")").length) bad.push(`${at}: скобки не сходятся «${b}»`);
        if (/(^|[^0-9])\d+\.\d+/.test(b)) bad.push(`${at}: десятичная точка вместо запятой «${b}»`);
        if (mathHTML) { try { mathHTML(b); } catch (e) { bad.push(`${at}: math.js не разобрал «${b}»`); } }
      }
    });
    if (s.key) seenWarm.add(s.key + "/" + (s.kind || ""));
  }
  if (s.t === "show" || s.t === "real") {
    if (!bank[s.id]) bad.push(`${at}: задачи ${s.id} нет в банке`);
    else if (!raz[s.id]) bad.push(`${at}: у задачи ${s.id} нет разбора`);
    (s.t === "show" ? seenShow : seenReal).add(s.id);
  }
  if (s.t === "solve") {
    if (!kinds[s.key]) bad.push(`${at}: приёма «${s.key}» нет`);
    else if (kinds[s.key].indexOf(s.kind) < 0)
      bad.push(`${at}: вида «${s.key}/${s.kind}» нет (есть: ${kinds[s.key].join(", ")})`);
    seenSolve.add(s.key + "/" + s.kind);
  }
});

/* полнота: каждый подвид и каждая задача ядра */
const shownAll = new Set([...seenShow, ...seenReal]);
const missTasks = core.filter(t => !shownAll.has(t));
if (missTasks.length) bad.push(`не попали в курс ${missTasks.length} задач ядра: ${missTasks.slice(0, 8).join(", ")}${missTasks.length > 8 ? " …" : ""}`);

subs.forEach(s => {
  const hasShow = s.tasks.some(t => seenShow.has(t));
  if (!hasShow) bad.push(`подвид «${s.group} / ${s.title}» — нет ни одного разобранного примера (show)`);
});

/* порядок внутри подвида: сначала show, потом solve того же приёма */
const order = steps.map(s => s.t);
steps.forEach((s, i) => {
  if (s.t !== "solve") return;
  const before = steps.slice(0, i);
  if (!before.some(x => x.t === "show" && (bank[x.id] || {}).id)) return;
  const lastShow = before.map((x, j) => x.t === "show" ? j : -1).filter(j => j >= 0).pop();
  const lastWarm = before.map((x, j) => x.t === "warm" ? j : -1).filter(j => j >= 0).pop();
  if (lastWarm != null && lastShow != null && lastWarm > lastShow)
    warn.push(`шаг ${i + 1}: разминка идёт после примера — по эталону сначала упрощённое, потом настоящее`);
});

const n = t => steps.filter(s => s.t === t).length;
console.log(`${file}: ${steps.length} шагов — теория ${n("teach")}, вопросы ${n("quiz")}, разминки ${n("warm")}, ` +
  `примеры ${n("show")}, близнецы ${n("solve")}, настоящие ${n("real")}, итоги ${n("recap")}`);
console.log(`покрытие: задач ядра ${shownAll.size}/${core.length}, подвидов с примером ${subs.length - bad.filter(b => b.includes("нет ни одного разобранного")).length}/${subs.length}, видов близнецов ${seenSolve.size}`);

if (warn.length) { console.log(`\nзамечания (${warn.length}):`); warn.slice(0, 20).forEach(w => console.log("  " + w)); }
if (bad.length) {
  console.log(`\nОШИБОК: ${bad.length}`);
  bad.slice(0, 40).forEach(b => console.log("  " + b));
  if (bad.length > 40) console.log(`  … и ещё ${bad.length - 40}`);
  process.exit(1);
}
console.log("\nэталон соблюдён: ссылки целы, покрытие полное, формулы читаются");
