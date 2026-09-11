#!/usr/bin/env node
/* Проверка модуля-генератора задач-близнецов.
   node tools/gencheck.js gen/kin-slope_v.js [--seeds 40] [--out /tmp/dir]

   Что проверяет на каждом виде × зерне:
   – make(rnd) не падает, возвращает все поля нужных типов;
   – answer — число (запятая допустима), raz.ans начинается с того же числа;
   – в тексте нет "undefined", "NaN", "null", "[object";
   – формульные строки ("f: …") со сбалансированными скобками, без LaTeX;
   – если есть dbg.graph — все точки линий лежат на узлах сетки и внутри диапазона осей,
     подписи осей кратны tick;
   – ответы по зёрнам не одинаковые (генератор действительно варьирует числа).
   С --out пишет по два образца на вид в HTML для просмотра. */
const fs = require("fs"), path = require("path"), vm = require("vm");

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith("--"));
if (!file) { console.error("usage: node tools/gencheck.js gen/kin-<key>.js [--seeds N] [--out DIR]"); process.exit(2); }
const seeds = +(args[args.indexOf("--seeds") + 1] || 40) || 40;
const outDir = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;

const root = path.resolve(__dirname, "..");
const RND = require(path.join(root, "gen/rnd.js"));
const GRAPH = require(path.join(root, "gen/graph.js"));

/* math.js — браузерный файл без экспорта: исполняем в песочнице, чтобы получить mathHTML */
const mathSrc = fs.readFileSync(path.join(root, "math.js"), "utf8");
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(mathSrc + "\n;this.__mathHTML = typeof mathHTML === 'function' ? mathHTML : null;", sandbox);
const mathHTML = sandbox.__mathHTML;

/* модуль генератора: в песочнице с глобалами RND и GRAPH */
const genSrc = fs.readFileSync(path.resolve(file), "utf8");
const gsb = { RND, GRAPH, console, module: { exports: {} } };
vm.createContext(gsb);
vm.runInContext(genSrc, gsb, { filename: file });
const GEN = gsb.module.exports;
if (!GEN || !Array.isArray(GEN.kinds) || !GEN.kinds.length) {
  console.error("модуль должен экспортировать { key, title, kinds: [...] } через module.exports"); process.exit(1);
}

const problems = [];
const bad = (kind, seed, msg) => problems.push(`${GEN.key}/${kind.id} seed=${seed}: ${msg}`);
const normNum = s => String(s).replace(/−/g, "-").replace(",", ".").replace(/\s/g, "");
const firstNum = s => { const m = normNum(s).match(/^-?\d+(\.\d+)?/); return m ? m[0] : null; };
const checkText = (kind, seed, where, s) => {
  if (typeof s !== "string") { bad(kind, seed, `${where}: не строка`); return; }
  if (/undefined|NaN|\[object|\bnull\b/.test(s)) bad(kind, seed, `${where}: мусор в тексте: «${s.slice(0, 80)}»`);
};
const onGrid = (v, from, step) => Math.abs(((v - from) / step) - Math.round((v - from) / step)) < 1e-6;

let samples = {};
GEN.kinds.forEach(kind => {
  const answers = new Set();
  for (let seed = 1; seed <= seeds; seed++) {
    let t;
    try { t = kind.make(RND.make(seed * 7919 + 13)); }
    catch (e) { bad(kind, seed, "make() упал: " + (e.stack || e).toString().split("\n").slice(0, 2).join(" | ")); continue; }
    if (!t || typeof t !== "object") { bad(kind, seed, "make() вернул не объект"); continue; }
    checkText(kind, seed, "plain", t.plain);
    if (t.plain && t.plain.length < 40) bad(kind, seed, "plain слишком короткий");
    if (t.simple) checkText(kind, seed, "simple", t.simple);
    if (typeof t.answer !== "string" && typeof t.answer !== "number") bad(kind, seed, "answer должен быть строкой");
    const an = firstNum(t.answer);
    if (an === null) bad(kind, seed, `answer не число: «${t.answer}»`);
    else answers.add(an);
    if (t.svg != null) {
      if (typeof t.svg !== "string" || !/^<svg[\s>]/.test(t.svg.trim())) bad(kind, seed, "svg должен быть строкой <svg…>");
    }
    if (t.table != null && !/^<table/.test(String(t.table).trim())) bad(kind, seed, "table должен начинаться с <table");
    const z = t.raz;
    if (!z || typeof z !== "object") { bad(kind, seed, "нет raz"); continue; }
    ["dano", "plan", "steps"].forEach(k => { if (!Array.isArray(z[k]) || !z[k].length) bad(kind, seed, `raz.${k} пустой`); });
    (z.dano || []).forEach((x, i) => checkText(kind, seed, `raz.dano[${i}]`, x));
    (z.plan || []).forEach((x, i) => checkText(kind, seed, `raz.plan[${i}]`, x));
    if (!z.ans) bad(kind, seed, "raz.ans пустой"); else {
      checkText(kind, seed, "raz.ans", z.ans);
      const rn = firstNum(z.ans);
      if (an !== null && rn !== an) bad(kind, seed, `raz.ans «${z.ans}» не совпадает с answer «${t.answer}»`);
    }
    if (!z.err) bad(kind, seed, "raz.err пустой"); else checkText(kind, seed, "raz.err", z.err);
    (z.steps || []).forEach((st, i) => {
      if (!st || !st.t || !Array.isArray(st.p) || !st.p.length) { bad(kind, seed, `raz.steps[${i}] без заголовка или строк`); return; }
      checkText(kind, seed, `raz.steps[${i}].t`, st.t);
      st.p.forEach((line, j) => {
        checkText(kind, seed, `raz.steps[${i}].p[${j}]`, line);
        if (typeof line !== "string") return;
        if (/^f\s*:/.test(line)) {
          const body = line.replace(/^f\s*:/, "").trim();
          if (body.split("(").length !== body.split(")").length) bad(kind, seed, `скобки не сходятся: «${body}»`);
          if (/[\\$]|\^\{|\\frac/.test(body)) bad(kind, seed, `LaTeX в формуле: «${body}»`);
          if (/(^|[^0-9])\d+\.\d+/.test(body)) bad(kind, seed, `десятичная точка вместо запятой: «${body}»`);
          if (mathHTML) { try { mathHTML(body); } catch (e) { bad(kind, seed, `mathHTML упал на «${body}»: ${e.message}`); } }
        }
      });
    });
    /* график: точки на узлах, внутри осей */
    const g = t.dbg && t.dbg.graph;
    if (g && g.x && g.y) {
      const X = g.x, Y = g.y;
      (g.lines || []).forEach((ln, li) => (ln.pts || []).forEach(p => {
        if (p[0] < X.from - 1e-9 || p[0] > X.to + 1e-9 || p[1] < Y.from - 1e-9 || p[1] > Y.to + 1e-9)
          bad(kind, seed, `линия ${li}: точка (${p[0]}, ${p[1]}) вне осей`);
        if (!onGrid(p[0], X.from, X.step) || !onGrid(p[1], Y.from, Y.step))
          bad(kind, seed, `линия ${li}: точка (${p[0]}, ${p[1]}) не на узле сетки (шаг ${X.step}×${Y.step})`);
      }));
      if (X.tick && !onGrid(X.tick, 0, X.step)) bad(kind, seed, "x.tick не кратен x.step");
      if (Y.tick && !onGrid(Y.tick, 0, Y.step)) bad(kind, seed, "y.tick не кратен y.step");
      if ((X.to - X.from) / X.step > 16 || (Y.to - Y.from) / Y.step > 14) bad(kind, seed, "слишком много клеток — график нечитаем");
    }
    /* независимый пересчёт: вид сам говорит, как проверить ответ по нарисованному графику */
    if (typeof kind.check === "function") {
      let msg = null;
      try { msg = kind.check(t); } catch (e) { msg = "check() упал: " + e.message; }
      if (msg) bad(kind, seed, msg);
    }
    if (outDir && seed <= 2) (samples[kind.id] = samples[kind.id] || []).push({ seed, t });
  }
  /* У некоторых видов ответ по смыслу всегда один и тот же (например, «ускорение равно нулю»).
     Такие виды помечают себя constAnswer: true — тогда меняться должны условия, а не ответ. */
  if (!kind.constAnswer && answers.size < Math.min(4, seeds))
    bad(kind, 0, `ответы почти не меняются: ${[...answers].join(", ")}`);
});

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  Object.keys(samples).forEach(kid => {
    samples[kid].forEach(({ seed, t }) => {
      const z = t.raz || {};
      const line = x => /^f\s*:/.test(x) ? `<div class="f">${mathHTML ? mathHTML(x.replace(/^f\s*:/, "").trim()) : esc(x)}</div>` : `<p>${esc(x)}</p>`;
      const html = `<!doctype html><meta charset="utf-8"><title>${GEN.key}/${kid} #${seed}</title>
<style>body{font:16px/1.5 system-ui;max-width:760px;margin:24px auto;padding:0 16px}.f{margin:8px 0;padding:8px 12px;background:#f4f4f2;border-radius:8px}
.m{font-family:'Times New Roman',serif}.m-f{display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;margin:0 .2em}
.m-fn{padding:0 .25em;border-bottom:1.5px solid #222}.m-fd{padding:0 .25em}.m sub,.m-s{font-size:.75em}
h3{margin:22px 0 6px}.ans{background:#e7f4ea;padding:8px 12px;border-radius:8px}.err{background:#fdeaea;padding:8px 12px;border-radius:8px}
.gtab{border-collapse:collapse}.gtab td,.gtab th{border:1px solid #999;padding:4px 10px}</style>
<h2>${esc(GEN.title)} — ${esc(kind_title(kid))} · зерно ${seed}</h2>
${t.svg || ""}${t.table || ""}
<p><b>${esc(t.plain)}</b></p>
<p><i>Ответ: ${esc(t.answer)}</i></p>
${t.simple ? `<p>О чём: ${esc(t.simple)}</p>` : ""}
<h3>Что дано</h3>${(z.dano || []).map(line).join("")}
<h3>План</h3><ol>${(z.plan || []).map(x => `<li>${esc(x)}</li>`).join("")}</ol>
${(z.steps || []).map((st, i) => `<h3>${i + 1}. ${esc(st.t)}</h3>${(st.p || []).map(line).join("")}`).join("")}
<h3>Ответ</h3><div class="ans">${esc(z.ans || "")}</div>
<h3>Где спотыкаются</h3><div class="err">${esc(z.err || "")}</div>`;
      fs.writeFileSync(path.join(outDir, `${GEN.key}-${kid}-${seed}.html`), html);
    });
  });
  function kind_title(id) { const k = GEN.kinds.find(x => x.id === id); return k ? k.title || id : id; }
}

if (problems.length) {
  console.log(`ПРОБЛЕМ: ${problems.length} (${GEN.key}, ${GEN.kinds.length} видов × ${seeds} зёрен)`);
  problems.slice(0, 60).forEach(p => console.log("  " + p));
  if (problems.length > 60) console.log(`  … и ещё ${problems.length - 60}`);
  process.exit(1);
}
const withCheck = GEN.kinds.filter(k => typeof k.check === "function").length;
console.log(`OK: ${GEN.key} — ${GEN.kinds.length} видов (${GEN.kinds.map(k => k.id).join(", ")}) × ${seeds} зёрен, всё сходится`
  + (withCheck < GEN.kinds.length ? `  (без независимой проверки: ${GEN.kinds.filter(k => typeof k.check !== "function").map(k => k.id).join(", ")})` : "  (у всех видов есть независимая проверка)"));
