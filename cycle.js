/* Циклы: внутри каждого номера ЕГЭ — группы задач с одним алгоритмом решения.
   Экран предмета → список заданий → циклы → прорешивание. */

"use strict";

let MAP = {};              /* предмет → номер → {name, total, groups[]} */
let curSubj = null, curNum = null, curCyc = null, cycIdx = 0;

let QX = {};               /* id задачи → разбор: simple, terms, steps */

async function loadMap(sid) {
  if (MAP[sid]) return MAP[sid];
  try {
    const r = await fetch("lessons/plan-" + sid + ".json?v=" + VER);
    MAP[sid] = r.ok ? await r.json() : {};
  } catch (e) { MAP[sid] = {}; }
  return MAP[sid];
}

function solvedOf(id) { return (S.solved || {})[id]; }
function markSolved(id, ok) {
  if (!S.solved) S.solved = {};
  S.solved[id] = { ok: !!ok, at: now() };
  save();
}

function cycStat(g) {
  const ids = g.tasks || [];
  let ok = 0, tried = 0;
  ids.forEach(id => { const r = solvedOf(id); if (r) { tried++; if (r.ok) ok++; } });
  return { ok, tried, total: ids.length };
}
function cycDone(g) { const s = cycStat(g); return s.total && s.ok >= s.total; }

function numStat(sid, n) {
  const d = (MAP[sid] || {})[String(n)];
  if (!d) return { done: 0, total: 0, tasks: 0, ok: 0 };
  let done = 0, ok = 0, tasks = 0;
  d.groups.forEach(g => { const s = cycStat(g); if (s.total && s.ok >= s.total) done++; ok += s.ok; tasks += s.total; });
  return { done, total: d.groups.length, tasks, ok };
}

/* ─────────── экран предмета: список заданий ─────────── */
function renderSubject() {
  const sid = curSubj, sub = SUB[sid], m = MAP[sid] || {};
  const part2 = sub.part2From;
  let baseDone = 0, baseTot = 0, basePts = 0, baseGot = 0;
  sub.tasks.forEach(t => {
    if (t.n >= part2) return;
    const st = numStat(sid, t.n);
    baseDone += st.done; baseTot += st.total; basePts += t.p;
    if (st.total && st.done === st.total) baseGot += t.p;
  });

  let h = `<div class="ls-top">
      <button class="ico" data-act="home">‹</button>
      <div class="ls-ti"><b>${esc(sub.name)}</b><span>${sub.tasksTotal} заданий · ${sub.maxPrimary} первичных баллов</span></div>
    </div>

    <div class="card basebox" style="--c:${sub.color}">
      <div class="bb-t">Сначала база</div>
      <p>Задания 1–${part2 - 1} — это часть 1, ${basePts} баллов из ${sub.maxPrimary}. Цель не прорешать всё,
        а закрыть каждый вид задач целиком: пока все задачи вида не решены, приём не считается пройденным.</p>
      <div class="pbar"><i class="ok" style="width:${baseTot ? baseDone / baseTot * 100 : 0}%"></i></div>
      <div class="bb-n"><b>${baseDone}</b> из ${baseTot} циклов базы пройдено</div>
    </div>`;

  const row = t => {
    const st = numStat(sid, t.n);
    const d = m[String(t.n)];
    const pct = st.total ? Math.round(st.done / st.total * 100) : 0;
    return `<button class="numrow${st.total && st.done === st.total ? " full" : ""}" data-act="num" data-n="${t.n}" style="--c:${sub.color}">
      <span class="nr-n">${t.n}</span>
      <span class="nr-b">
        <b>${esc(t.name)}</b>
        <i>${d ? plural(d.groups.length, "цикл", "цикла", "циклов") + " · " + d.total + " задач" : "нет разбора"}${t.lvl === "В" ? " · высокий уровень" : ""}</i>
        <span class="nr-bar"><em style="width:${pct}%"></em></span>
      </span>
      <span class="nr-p">${st.total ? st.done + "/" + st.total : "—"}</span>
    </button>`;
  };

  h += `<h4 class="sec">База · часть 1</h4>`;
  sub.tasks.filter(t => t.n < part2).forEach(t => h += row(t));
  h += `<h4 class="sec">Сверх базы · часть 2</h4>
    <p class="foot" style="margin:0 0 10px">Эти задания нужны на высокий балл. Браться за них стоит, когда база уже держится.</p>`;
  sub.tasks.filter(t => t.n >= part2).forEach(t => h += row(t));
  return h;
}

/* ─────────── экран номера: циклы внутри ─────────── */
function renderNum() {
  const sid = curSubj, sub = SUB[sid], n = curNum;
  const t = sub.byN[n], d = (MAP[sid] || {})[String(n)];
  let h = `<div class="ls-top">
      <button class="ico" data-act="home">‹</button>
      <div class="ls-ti"><b>Задание ${n}. ${esc(t.name)}</b><span>${esc(sub.name)} · ${plural(t.p, "балл", "балла", "баллов")}</span></div>
    </div>
    <div class="offic"><span>что проверяют по кодификатору ФИПИ</span>${esc(t.full || t.name)}</div>`;

  if (!d || !d.groups.length) return h + `<p class="rest">Разбор этого номера ещё не готов.</p>`;

  const lv = ((FMAP[sid] || {})[String(n)] || {}).levels || [];

  if (numMode !== "frm" && numMode !== "cyc" && typeof trainRowsHTML === "function") {
    loadRaz(sid, n); loadGens(sid, n);
    h += trainRowsHTML(sid, n);
    h += `<button class="add" data-act="frm-all">Все ${d.total} задач, разложенные по формулам</button>`;
    return h;
  }

  if (numMode !== "cyc") {
    if (!lv.length) return h + `<p class="rest">Разбор по формулам для этого номера ещё не сделан.</p>`;
    lv.forEach((L, li) => {
      let ok = 0, tot = 0;
      L.rows.forEach(r => { const st = cycStat(r); ok += st.ok; tot += st.total; });
      h += `<div class="lvl"><h4 class="sec">${esc(L.title)} <em>${ok}/${tot}</em></h4>
        <p class="foot" style="margin:0 0 10px">${esc(L.note)}</p></div>`;
      L.rows.forEach((r, i) => {
        const st = cycStat(r), done = st.total && st.ok >= st.total;
        h += `<button class="frow${done ? " done" : ""}" data-act="fcyc" data-l="${li}" data-i="${i}" style="--c:${sub.color}">
        <span class="fr-h"><b>${esc(r.title)}</b><span class="fr-p">${st.ok}/${st.total}<em>задач</em></span></span>
        <span class="fr-f">${r.f.split("   →   ").map(x => `<i>${mathHTML(x)}</i>`).join('<u>потом</u>')}</span>
        ${r.what ? `<span class="fr-w">${esc(r.what)}</span>` : ""}
        <span class="nr-bar"><em style="width:${st.total ? st.ok / st.total * 100 : 0}%"></em></span>
      </button>`;
      });
    });
    return h + `<button class="add" data-act="frm-all">Назад к приёмам</button>`;
  }

  h += `<h4 class="sec">Циклы задач</h4>`;
  d.groups.forEach((g, i) => {
    const s = cycStat(g), done = s.total && s.ok >= s.total;
    const subs = g.subs || [];
    h += `<button class="cycrow${done ? " done" : ""}" data-act="cyc" data-i="${i}" style="--c:${sub.color}">
      <span class="cy-i">${done ? "✓" : i + 1}</span>
      <span class="cy-b"><b>${esc(g.title)}</b>
        <i>${subs.length ? plural(subs.length, "вид задач", "вида задач", "видов задач") + " внутри"
             : (g.theory ? esc(g.recognize || "") : "разбор пока не написан")}</i>
        <span class="nr-bar"><em style="width:${s.total ? s.ok / s.total * 100 : 0}%"></em></span></span>
      <span class="cy-p">${s.ok}/${s.total}<em>задач</em></span>
    </button>`;
  });
  return h;
}

/* ─────────── экран цикла: виды задач внутри ─────────── */
function renderSubs() {
  const sid = curSubj, sub = SUB[sid], g = curCyc;
  if (!g) { view = "num"; return renderNum(); }
  const st = cycStat(g);
  let h = `<div class="ls-top">
      <button class="ico" data-act="num" data-n="${curNum}">‹</button>
      <div class="ls-ti"><b>${esc(g.title)}</b><span>Задание ${curNum} · ${esc(sub.short)} · ${g.count} задач</span></div>
    </div>`;
  if (g.summary) h += `<div class="sumbox"><span>если совсем просто</span>${esc(g.summary)}</div>`;

  h += `<h4 class="sec">Виды задач внутри</h4>`;
  (g.subs || []).forEach((sb, k) => {
    const ss = cycStat(sb), done = ss.total && ss.ok >= ss.total;
    h += `<button class="cycrow${done ? " done" : ""}" data-act="sub" data-k="${k}" style="--c:${sub.color}">
      <span class="cy-i">${done ? "✓" : k + 1}</span>
      <span class="cy-b"><b>${esc(sb.title)}</b><i>${esc(sb.summary || sb.hint || "")}</i>
        <span class="nr-bar"><em style="width:${ss.total ? ss.ok / ss.total * 100 : 0}%"></em></span></span>
      <span class="cy-p">${ss.ok}/${sb.count}<em>задач</em></span>
    </button>`;
  });
  h += `<button class="add" data-act="cycall">Все ${g.count} задач подряд, без деления на виды</button>`;
  return h;
}

/* ─────────── прорешивание цикла ─────────── */
let showAlg = true, showHard = false;
const qMode = {};

async function loadQX(sid) {
  if (QX[sid]) return QX[sid];
  try {
    const r = await fetch("lessons/q-" + sid + ".json?v=" + VER);
    QX[sid] = r.ok ? await r.json() : {};
  } catch (e) { QX[sid] = {}; }
  return QX[sid];
}

let FMAP = {}, numMode = "train";
async function loadForm(sid) {
  if (FMAP[sid]) return FMAP[sid];
  try {
    const r = await fetch("lessons/form-" + sid + ".json?v=" + VER);
    FMAP[sid] = r.ok ? await r.json() : {};
  } catch (e) { FMAP[sid] = {}; }
  return FMAP[sid];
}

/* ─── встроенный разбор: написан руками для каждой задачи ─── */
let RAZ = {}, razLoad = {};
async function loadRaz(sid, n) {
  const key = sid + "-" + n;
  if (RAZ[key] || razLoad[key]) return;
  razLoad[key] = 1;
  try {
    const r = await fetch("lessons/razbor-" + key + ".json?v=" + VER);
    RAZ[key] = r.ok ? await r.json() : {};
  } catch (e) { RAZ[key] = {}; }
  render();
}
function razOf(id) {
  if (typeof TWIN_RAZ !== "undefined" && TWIN_RAZ[id]) return TWIN_RAZ[id];
  for (const k in RAZ) if (RAZ[k][id]) return RAZ[k][id];
  return null;
}

/* строка разбора: «f: …» — формула, всё остальное — обычный текст */
function razLine(x) {
  const t = String(x || "").trim();
  if (/^f\s*:/.test(t)) return `<div class="rz-f">${mathHTML(t.replace(/^f\s*:/, "").trim())}</div>`;
  return `<p class="rz-p">${razProse(t)}</p>`;
}

/* в обычном тексте v_x, x_0, Δx_1, v_ср — это переменные с индексом: показываем их как в формуле */
function razProse(t) {
  return esc(t).replace(/(^|[^a-zA-Zа-яё0-9])([a-zA-Z]|Δ[a-zA-Z])_([0-9a-zA-Zа-яё]{1,8})(?![a-zA-Zа-яё0-9])/g,
    (m, pre, v, sub) => `${pre}<i class="m-v">${v}<sub>${sub}</sub></i>`);
}

function razborHTML(q, z) {
  return `<div class="rzbox">
    ${q.simple ? `<div class="rz-block rz-about"><div class="rz-h">О чём задача, одной фразой</div>
      <p class="rz-p">${esc(q.simple)}</p></div>` : ""}
    <div class="rz-block rz-dano">
      <div class="rz-h">Что дано и что найти</div>
      ${(z.dano || []).map(x => razLine(x)).join("")}
    </div>
    <div class="rz-block rz-plan">
      <div class="rz-h">Как будем решать</div>
      <ol>${(z.plan || []).map(x => `<li>${esc(x)}</li>`).join("")}</ol>
    </div>
    <div class="rz-steps">
      ${(z.steps || []).map((st, i) => `<div class="rz-step">
        <div class="rz-n">${i + 1}</div>
        <div class="rz-b">
          <div class="rz-t">${esc(st.t || "")}</div>
          ${(st.p || []).map(x => razLine(x)).join("")}
        </div>
      </div>`).join("")}
    </div>
    <div class="rz-block rz-ans"><div class="rz-h">Ответ</div>
      <p class="rz-p">${esc(z.ans || q.answer || "")}</p></div>
    <div class="rz-block rz-err"><div class="rz-h">Где обычно спотыкаются</div>
      <p class="rz-p">${esc(z.err || "")}</p></div>
  </div>`;
}

function qById(id) {
  const q = (BANK[curSubj] || []).find(x => x.id === id);
  return q ? Object.assign({}, q, (QX[curSubj] || {})[id] || {}) : null;
}

const moreOn = {};
function cycKey(g) { return (g.key || g.title || "") + ":" + (g.tasks || []).length; }

function cycTasks(g) {
  const list = BANK[curSubj] || [], qx = QX[curSubj] || {};
  const ids = (g.tasks || []).concat(moreOn[cycKey(g)] ? (g.more || []) : []);
  return ids.map(id => {
    const q = list.find(x => x.id === id);
    return q ? Object.assign({}, q, qx[id] || {}) : null;
  }).filter(Boolean);
}

function theoryHTML_cyc(g, sub) {
  const t = g.theory;
  if (!t) return `<div class="ls-body"><h2 class="ls-h">${esc(g.title)}</h2>
    <p class="card-text">Разбор этого приёма ещё не написан. Задачи ниже настоящие,
      к каждой есть официальное решение — по нему и разбирайся, пока не дойдут руки до объяснения.</p></div>`;
  return `<div class="ls-body" style="--c:${sub.color}">
    <div class="qnum">Подготовка · 3 минуты</div>
    <h2 class="ls-h">${esc(g.title)}</h2>
    ${t.lead ? `<p class="setup">${esc(t.lead)}</p>` : ""}
    ${t.idea ? String(t.idea).split(/\n{2,}/).map(x => `<p class="card-text">${esc(x)}</p>`).join("") : ""}
    ${t.why ? `<div class="algo-r"><b>Почему так:</b> ${esc(t.why)}</div>` : ""}
    ${(t.steps || []).length ? `<div class="lab">Порядок действий</div>
      <ol class="algo-s">${t.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol>` : ""}
    ${t.formula ? `<div class="frm keep"><div class="keep-t">формула</div>
      <b>${mathHTML(t.formula.f)}</b><span>${esc(t.formula.what || "")}</span>
      ${t.formula.how ? `<div class="how">${esc(t.formula.how)}</div>` : ""}</div>` : ""}
    ${t.example ? `<div class="exa"><div class="exa-t">Разбор примера</div>
      <p class="exa-q">${esc(t.example.q)}</p>
      <ol>${(t.example.steps || []).map(x => `<li>${esc(x)}</li>`).join("")}</ol>
      <div class="exa-a">Ответ: <b>${esc(t.example.a)}</b></div></div>` : ""}
    ${t.trap ? `<div class="trap"><b>Где теряют балл</b>${esc(t.trap)}</div>` : ""}
  </div>`;
}

function qStepState(id) {
  const r = (S.solved || {})[id];
  return (r && r.steps) || {};
}
function setQStep(id, k, v) {
  if (!S.solved) S.solved = {};
  if (!S.solved[id]) S.solved[id] = { ok: false, at: now() };
  if (!S.solved[id].steps) S.solved[id].steps = {};
  S.solved[id].steps[k] = v;
  save();
}

/* картинки-графики и таблицы вынимаем из текста задачи — им нужно место */
function splitQ(html) {
  const box = document.createElement("div");
  box.innerHTML = html || "";
  const figs = [];
  box.querySelectorAll("img:not(.tex), table, .gfig").forEach(el => {
    figs.push(el.outerHTML);
    el.remove();
  });
  box.querySelectorAll("p").forEach(p => { if (!p.textContent.trim() && !p.children.length) p.remove(); });
  return { figs, text: box.innerHTML };
}

const fOpen = {}, tOpen = {};
function termsHTML(list, id) {
  const on = !!tOpen[id];
  return `<div class="fbox${on ? " open" : ""}">
    <button class="fbtn" data-act="trm" data-id="${id}">
      <b>Незнакомые слова</b><span>${on ? "свернуть" : plural(list.length, "термин", "термина", "терминов")}</span></button>
    ${on ? `<div class="fbody"><dl class="terms">${list.map(x =>
      `<dt>${esc(x[0])}</dt><dd>${esc(x[1])}</dd>`).join("")}</dl></div>` : ""}
  </div>`;
}

/* «Проверь себя»: как числа подставляются в формулу и считаются */
function solveHTML(q) {
  const steps = (q.steps || []).filter(x => x.a !== undefined && x.a !== "");
  const sb = q.formula && q.formula.subst;
  if (!steps.length && !sb) return "";
  const line = x => {
    const t = String(x.q || "").replace(/[?.!,;\s]+$/, "");
    const i = Math.max(t.lastIndexOf(":"), t.lastIndexOf("—"));
    let e = (i > 0 ? t.slice(i + 1) : t).replace(/[?.!,;\s]+$/, "").replace(/^\s*[-–—]\s*/, "").trim();
    const words = (e.match(/[а-яё]{3,}/gi) || []).length;
    const num = /[\d)]/.test(e) && e.length < 46 && words <= 2;
    if (num) return { e: e, num: true, a: fmtA(x) };
    let lab = t.split(/[:.]/)[0].trim();
    if (lab.length > 52) lab = lab.slice(0, 50) + "…";
    return { e: lab, num: false, a: fmtA(x) };
  };
  const fmtA = x => String(x.a).replace(/^-/, "\u2212") + (x.unit ? " " + x.unit : "");

  return `<div class="solve">
    <div class="solve-t">Как это считается</div>
    ${q.formula ? `<div class="solve-f">${mathHTML(q.formula.f)}</div>` : ""}
    <ol class="solve-l">${steps.map(x => {
      const L = line(x);
      return `<li>${L.num ? `<b>${mathHTML(L.e)}</b><span class="eq">=</span>` : `<i>${esc(L.e)}</i>`}
        <b class="res">${esc(L.a)}</b></li>`;
    }).join("")}</ol>
    ${sb && steps.length > 1 ? `<div class="solve-all">${mathHTML(sb.in)}<span class="eq">=</span>${mathHTML(sb.out)}</div>` : ""}
    <div class="solve-n">Сверь с тем, что посчитал в тетради. Если сошлось на каждой строке — приём усвоен.</div>
  </div>`;
}

function taskHTML(q, sub, idx, total) {
  const res = solvedOf(q.id), done = res && (res.ok || res.shown);
  const steps = q.steps || [];
  const parts = splitQ(q.html);
  const list = q.formulas || (q.formula ? [q.formula] : []);
  const sb = q.formula && q.formula.subst;

  const z = razOf(q.id);
  const ask = `<div class="qask-col">
    <div class="qnum">Задача ${idx + 1} из ${total}</div>
    ${parts.figs.length ? `<div class="qfig">${parts.figs.join("")}</div>` : ""}
    <div class="qtask">${hlQ(parts.text)}</div>
    ${aiBlockHTML(q)}
    ${z ? "" : aiSolveHTML(q)}
  </div>`;
  let h = `<div class="ls-body qbody split" style="--c:${sub.color}">${ask}<div class="qsol-col">`;

  /* написанный руками разбор: показываем сразу, поле ответа — над ним */
  if (z) {
    if (done)
      h += `<div class="dr-r ${res.ok ? "ok" : "no"}"><b>${res.ok ? "Верно" : "Правильный ответ: " + esc(q.answer)}</b></div>`;
    else
      h += `<div class="dr-in">
        <input type="text" id="qa" placeholder="ответ" autocomplete="off">
        <button class="dr-go go" data-act="qcheck" data-id="${q.id}">Проверить ответ</button>
      </div>`;
    h += `<h4 class="sec">Разбор по шагам</h4>` + razborHTML(q, z);
    return h + `</div></div>`;
  }

  if (done) {
    h += `<div class="dr-r ${res.ok ? "ok" : "no"}"><b>${res.ok ? "Верно" : "Правильный ответ: " + esc(q.answer)}</b></div>
      ${solveHTML(q)}
      ${q.solution ? `<div class="sol"><b>Официальный разбор</b>${esc(fixSol(q.solution))}</div>` : ""}
      <button class="explain" data-act="qask" data-id="${q.id}">Не понял разбор — объясни своими словами</button>`;
    return h + `</div></div>`;
  }

  if (qMode[q.id] === "free" || !steps.length) {
    h += `<div class="dr-in">
        <input type="text" id="qa" placeholder="ответ" autocomplete="off">
        <button class="dr-go go" data-act="qcheck" data-id="${q.id}">Проверить ответ</button>
      </div>
      ${steps.length ? `<button class="qorig" data-act="qsteps" data-id="${q.id}">Не знаю с чего начать — веди по шагам</button>` : ""}`;
    return h + `</div></div>`;
  }

  /* единая цепочка: формула → какие числа нужны → достаём их → считаем сами */
  const seq = [];
  if (q.choice && list.length) seq.push({ t: "pick" });
  if (list.length) seq.push({ t: "f" }, { t: "need" });
  steps.forEach((x, k) => seq.push({ t: "q", x: x, k: k }));

  const st = qStepState(q.id);
  let open = seq.findIndex((x, i) => x.t === "q" ? (st[x.k] !== "ok" && st[x.k] !== "sol")
    : x.t === "pick" ? !(st["p" + i] && ((q.choice.opts[st["p" + i] - 1] || {}).ok || (q.choice.opts[st["p" + i] - 1] || {}).tell))
    : !st["i" + i]);
  if (open < 0) open = seq.length;

  const pickIdx = seq.findIndex(x => x.t === "pick");
  const picked = pickIdx >= 0 ? st["p" + pickIdx] : 0;
  const told = !!(picked && (q.choice.opts[picked - 1] || {}).tell);

  h += `<h4 class="sec">Разбор по шагам</h4><div class="stepsbox">`;
  seq.forEach((it, i) => {
    if (i > open) return;
    const now = i === open, last = i === seq.length - 1;

    if (it.t === "pick") {
      const c = q.choice, pick = st["p" + i];
      h += `<div class="gstep${now ? " now" : " ok"}"><div class="gnum">${i + 1}</div><div class="gbody">
        <div class="check-q">${esc(c.q)}</div>
        <div class="opts">${c.opts.map((o, oi) => {
          const chosen = pick === oi + 1;
          return `<button class="opt${o.tell ? " tell" : ""}${chosen ? (o.ok ? " ok" : o.tell ? " told" : " no") : ""}"
            ${now ? `data-act="qpick" data-id="${q.id}" data-i="${i}" data-o="${oi}"` : "disabled"}>${esc(o.t)}</button>`;
        }).join("")}</div>
        ${pick && !c.opts[pick - 1].ok && !c.opts[pick - 1].tell
            ? `<div class="dr-r no"><b>Пока не то.</b> ${esc(c.hint)}</div>` : ""}
      </div></div>`;
      return;
    }

    if (it.t === "f") {
      h += `<div class="gstep${now ? " now" : " ok"}"><div class="gnum">${i + 1}</div><div class="gbody">
        <div class="check-q">${told ? "Смотри, что тут происходит"
          : (list.length > 1 ? "Верно. Эти величины связывают две формулы" : "Верно. Эти величины связывает вот эта формула")}</div>
        ${q.choice && q.choice.was ? `<div class="swas">${esc(q.choice.was)}</div>` : ""}
        ${list.map((x, k) => `<div class="ftitle">${list.length > 1 ? `${k + 1}. ` : ""}${esc(x.title || "")}</div>
          <div class="fmain">${mathHTML(x.f)}</div>
          ${x.what ? `<div class="fwhat">${esc(x.what)}</div>` : ""}`).join("")}
        <div class="swhy"><span>почему ${list.length > 1 ? "именно эти формулы" : "именно она — в этой задаче"}</span>${esc((q.formula && q.formula.why) || list[0].why || "")}</div>
        ${now ? `<button class="primary sgo" data-act="qack" data-id="${q.id}" data-i="${i}">Понятно, что дальше?</button>` : ""}
      </div></div>`;
      return;
    }

    if (it.t === "need") {
      h += `<div class="gstep${now ? " now" : " ok"}"><div class="gnum">${i + 1}</div><div class="gbody">
        <div class="check-q">Какие числа нужны в формулу</div>
        <div class="sneed">${esc(list[0].need || "")}</div>
        ${now ? `<button class="primary sgo" data-act="qack" data-id="${q.id}" data-i="${i}">Понятно, идём искать</button>` : ""}
      </div></div>`;
      return;
    }

    const x = it.x, k = it.k, r = st[k];
    h += `<div class="gstep ${r || ""}${now ? " now" : ""}">
      <div class="gnum">${i + 1}</div>
      <div class="gbody">
        ${last && sb ? `<div class="sput"><span>подставляем в формулу</span>${mathHTML(sb.in)}</div>` : ""}
        ${x.lead ? `<div class="slead">${esc(x.lead)}</div>` : ""}
        <div class="check-q">${esc(x.q || "Сколько получится?")}</div>
        ${x.why ? `<div class="swhy"><span>зачем этот шаг</span>${esc(x.why)}</div>` : ""}
        ${last ? `<div class="fdo">Возьми тетрадь и посчитай сам. Посчитал — впиши ответ и проверь.</div>` : ""}
        ${r === "ok" || r === "sol"
          ? `<div class="dr-r ${r === "ok" ? "ok" : "sol"}"><b>${esc(String(x.a).replace(/^-/, "\u2212"))}${x.unit ? " " + esc(x.unit) : ""}</b>${x.tail ? " · " + esc(x.tail) : ""}</div>`
          : `<div class="dr-in">
              <input type="text" id="qs${k}" value="" placeholder="ответ" autocomplete="off">
              <button class="dr-go go" data-act="qstep" data-id="${q.id}" data-k="${k}">${last ? "Проверить ответ" : "Ответить"}</button>
            </div>
            ${r === "no" ? `<div class="dr-r no"><b>Пока нет.</b> Перечитай, что выше — там всё, что нужно.
              <button class="lnk" data-act="qstepsol" data-id="${q.id}" data-k="${k}">показать</button></div>` : ""}`}
      </div></div>`;
  });
  h += `</div>`;
  if (open >= seq.length)
    h += `<div class="gwrap"><b>Задача решена</b>Ответ ${esc(q.answer)}. Дальше такие будешь решать сам.</div>`;
  return h + `</div></div>`;
}

function renderCycle() {
  const sid = curSubj, sub = SUB[sid], g = curCyc;
  if (!g) { view = "num"; return renderNum(); }
  loadRaz(sid, curNum);
  const qs = cycTasks(g), s = cycStat(g);
  const onTheory = cycIdx < 0;
  const q = onTheory ? null : qs[Math.min(cycIdx, qs.length - 1)];

  let h = `<div class="ls-top">
      <button class="ico" data-act="back-cyc" data-n="${curNum}">‹</button>
      <div class="ls-ti"><b>${esc(g.title)}</b><span>Задание ${curNum} · ${esc(sub.short)}</span></div>
      <div class="ls-step">${onTheory ? "теория" : s.ok + " / " + s.total}</div>
    </div>
    <div class="ls-bar"><i style="width:${onTheory || !s.total ? 0 : s.ok / s.total * 100}%;--c:${sub.color}"></i></div>`;

  if (onTheory) {
    h += theoryHTML_cyc(g, sub);
    h += `<div class="ls-nav">
        <button class="ghost half" data-act="cycask">Не понял</button>
        <button class="primary half" data-act="qnext">Перейти к задачам</button>
      </div>`;
    return h;
  }

  if (g.theory)
    h += `<button class="add" data-act="theory">Показать подготовку к этому виду задач</button>`;
  if ((g.algorithm || []).length) {
    h += `<div class="algo${showAlg ? " open" : ""}" style="--c:${sub.color}">
        <button class="algo-h" data-act="alg"><b>Напомнить, как решать</b><span>${showAlg ? "свернуть" : "показать"}</span></button>`;
    if (showAlg) {
      h += `<div class="algo-b">
        ${g.recognize ? `<div class="algo-r"><b>Узнать по признаку:</b> ${esc(g.recognize)}</div>` : ""}
        <ol class="algo-s">${g.algorithm.map(x => `<li>${esc(x)}</li>`).join("")}</ol>
        ${g.trap ? `<div class="algo-t"><b>Где ошибаются</b>${esc(g.trap)}</div>` : ""}</div>`;
    }
    h += `</div>`;
  }

  if (!q) return h + `<p class="rest">Задачи этого цикла не загрузились.</p>`;
  h += taskHTML(q, sub, cycIdx, qs.length);

  h += `<div class="tasklist"><div class="tl-t">Все ${qs.length} задач этого вида</div>
    <div class="tl-g">${qs.map((x, k) => {
      const r = solvedOf(x.id);
      return `<button class="tl${k === cycIdx ? " now" : ""}${r ? (r.ok ? " ok" : " no") : ""}"
        data-act="goq" data-k="${k}">${k + 1}</button>`;
    }).join("")}</div>
    <div class="tl-n">Зелёные — решены верно, красные — были ошибки. Вид закрыт, когда зелёные все.</div>
    ${(g.more || []).length && !moreOn[cycKey(g)]
      ? `<button class="add" data-act="more" data-k="${esc(cycKey(g))}">
          Ещё ${g.more.length} похожих задач — на второй круг</button>` : ""}</div>`;

  h += `<div class="ls-nav">
      <button class="ghost half" data-act="qprev"${cycIdx ? "" : " disabled"}>Назад</button>
      <button class="primary half" data-act="qnext">${cycIdx + 1 >= qs.length ? "Закончить цикл" : "Следующая задача"}</button>
    </div>`;
  return h;
}

function checkStep(id, k) {
  const q = qById(id);
  const el = $("#qs" + k); if (!q || !el) return;
  const st = (q.steps || [])[k]; if (!st) return;
  const v = el.value.trim();
  if (!v) { toast("Впиши ответ"); return; }
  const ok = sameAnswer(v, st.a);
  setQStep(id, k, ok ? "ok" : "no");
  if (ok && k === q.steps.length - 1) markSolved(id, true);
  render();
}

function showStep(id, k) { setQStep(id, k, "sol"); render(); }

function checkQ(id) {
  const q = qById(id);
  const el = $("#qa"); if (!q || !el) return;
  const v = el.value.trim();
  if (!v) { toast("Впиши ответ"); return; }
  const ok = sameAnswer(v, q.answer);
  markSolved(id, ok);
  render();
  if (ok) toast("Верно");
}

function nextQ() {
  const qs = cycTasks(curCyc);
  if (cycIdx < 0) { cycIdx = 0; render(); window.scrollTo(0, 0); return; }
  if (cycIdx + 1 < qs.length) { cycIdx++; render(); window.scrollTo(0, 0); return; }
  const s = cycStat(curCyc);
  const sub = SUB[curSubj];
  openSheet(`<h3>${s.ok >= s.goal ? "Цикл пройден" : "Пока не хватает"}</h3>
    <p class="sh-sub">${esc(curCyc.title)}</p>
    <div class="sumbox"><b>${s.ok} из ${s.total}</b><span>решено верно</span></div>
    <p class="hint">${s.ok >= s.goal
      ? "Этого достаточно, чтобы считать приём знакомым. Остальные задачи цикла останутся на второй круг и для пробников."
      : "Чтобы закрыть цикл, нужно решить верно хотя бы " + s.goal + ". Вернись и добери."}</p>
    <button class="primary" id="cyOk">К списку циклов</button>`,
    el => {
      $("#cyOk", el).onclick = () => {
        closeSheet(); view = "num"; curCyc = null; cycIdx = 0; render(); window.scrollTo(0, 0);
      };
    });
}

/* объяснение задачи своими словами */
function askQ(id) {
  const q = (BANK[curSubj] || []).find(x => x.id === id);
  if (!q) return;
  const g = curCyc;
  chatSheet({
    key: "q:" + id, title: "Задача " + (cycIdx + 1), task: true,
    body: `Настоящее задание ЕГЭ по предмету «${SUB[curSubj].name}», номер ${curNum}.
Тип задачи: ${g.title}. Как решать этот тип: ${(g.algorithm || []).join(" → ")}
Условие: ${q.plain}
Правильный ответ: ${q.answer}
Официальный разбор: ${(q.solution || "").slice(0, 700)}` +
      (solvedOf(id) ? "" : "\nУченик ещё не ответил — не называй ответ сразу, подтолкни к первому шагу.")
  });
}

/* вопрос по теории цикла */
function askCycle() {
  const g = curCyc;
  chatSheet({
    key: "cyc:" + curSubj + ":" + curNum + ":" + (g.title || ""), title: g.title, task: true,
    body: `Тип задач ЕГЭ по предмету «${SUB[curSubj].name}», задание ${curNum}: «${g.title}».
Как узнать такую задачу: ${g.recognize || ""}
Приём решения: ${(g.algorithm || []).join(" → ")}
Где ошибаются: ${g.trap || ""}
Объяснение, которое ученик только что прочитал: ${JSON.stringify(g.theory || {}).slice(0, 2500)}`
  });
}

/* ── подсветка в условии: что именно спрашивают и на каком куске ── */
const C = "[а-яё]+";           /* \w в JS не ловит кириллицу — пишем класс явно */
const rr = src => new RegExp("(" + src.replace(/@\?/g, "[а-яё]*").replace(/@/g, C) + ")", "i");
const HL_ASK = [
  // сначала самые длинные и точные
  "средн@\\s+(?:путев@\\s+)?скорост@",
  "коэффициент@?\\s+трения(?:\\s+скольжения)?",
  "жёсткост@", "жесткост@",
  "сил@\\s+трения(?:\\s+скольжения)?", "сил@\\s+упругости", "сил@\\s+тяжести",
  "сил@\\s+натяжения", "сил@\\s+притяжения", "сил@\\s+тяготения",
  "равнодействующ@", "вес тела", "вес",
  "наибольш@\\s+модул@\\s+@\\s+скорости", "наименьш@\\s+модул@\\s+@\\s+скорости",
  "максимальн@\\s+модул@\\s+@", "минимальн@\\s+модул@\\s+@",
  "проекци@\\s+ускорения", "модул@\\s+ускорения",
  "проекци@\\s+перемещения", "модул@\\s+перемещения",
  "проекци@\\s+скорости", "модул@\\s+скорости", "модул@\\s+сил@",
  "начальн@\\s+координат@", "начальн@\\s+скорост@",
  "удлинени@", "растяжени@", "деформаци@",
  "путь,\\s+пройденн@\\s+@", "пройденн@\\s+@\\s+путь", "тормозн@\\s+путь",
  "во\\s+сколько\\s+раз", "отношени@\\s+@\\s*[₁-₉\\d]?", "через\\s+сколько\\s+секунд",
  "сколько\\s+секунд", "координат@\\s+(?:места\\s+)?@", "расстояние\\s+между\\s+@",
  // и уже потом одиночные слова
  "ускорени@", "перемещени@", "скорост@", "жёсткост@", "жесткост@",
  "коэффициент@?", "масс@", "сил@", "путь", "координат@", "расстояние", "длин@\\s+@",
].map(rr);
const HL_WHEN = [
  "в\\s+интервале\\s+времени\\s+от[^,.?]{1,20}?до[^,.?]{1,14}?с",
  "в\\s+промежутк@\\s+(?:времени\\s+)?от[^,.?]{1,20}?до[^,.?]{1,14}?с",
  "за\\s+время\\s+от[^,.?]{1,24}?до[^,.?]{1,14}?с",
  "от[^,.?]{0,14}?момента\\s+времени[^,.?]{1,40}?с",
  "в\\s+момент\\s+времени\\s*t?\\s*=?\\s*[\\d,.]+\\s*с",
  "за\\s+(?:перв@|втор@|треть@|четвёрт@)\\s+секунду",
  "за\\s+[\\d,.]+\\s*с(?:екунд@)?",
];
const HL_WHEN_RX = HL_WHEN.map(rr);

const HL_Q = /(определите|найдите|чему\s+равн|какова|каков|какой|какое|какие|сколько|установите|определить|найти|вычислите)/i;

function hlQ(html) {
  const box = document.createElement("div");
  box.innerHTML = html || "";
  const full = box.textContent.replace(/\u00a0|\u2009|\u202f/g, " ");

  /* ищем предложение с вопросом — подсвечиваем только в нём */
  let from = 0;
  const sent = full.split(/(?<=[.?!])\s+/);
  let off = 0;
  for (const p of sent) {
    if (HL_Q.test(p)) { from = off; break; }
    off += p.length + 1;
  }
  let to = full.length;
  for (const p of sent) {
    if (HL_Q.test(p)) { to = from + p.length; break; }
  }
  const qTxt = full.slice(from, to);            /* только само предложение с вопросом */

  const marks = [];
  for (const re of HL_ASK) { const m = qTxt.match(re); if (m) { marks.push(m[1].trim()); break; } }
  for (const re of HL_WHEN_RX) { const m = qTxt.match(re); if (m) { marks.push(m[1].trim()); break; } }
  if (!marks.length) return html;

  const left = {};
  marks.forEach(m => left[m.toLowerCase()] = 1);
  const rx = new RegExp("(" + marks.map(m =>
    m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s\\u00a0\\u2009\\u202f]+")
  ).join("|") + ")", "gi");

  let pos = 0;
  const walk = n => {
    [...n.childNodes].forEach(ch => {
      if (ch.nodeType === 3) {
        const t = ch.nodeValue, start = pos;
        pos += t.length;
        if (start + t.length <= from || start >= to) return;
        let hit = false, out = "", last = 0, m2;
        rx.lastIndex = 0;
        while ((m2 = rx.exec(t))) {
          const key = m2[0].toLowerCase().replace(/\s+/g, " ");
          const mk = Object.keys(left).find(k => k.replace(/\s+/g, " ") === key);
          if (mk && left[mk] && start + m2.index >= from) {
            left[mk] = 0; hit = true;
            out += esc(t.slice(last, m2.index)) + '<b class="hl">' + esc(m2[0]) + "</b>";
            last = m2.index + m2[0].length;
          }
        }
        out += esc(t.slice(last));
        if (!hit) return;
        const span = document.createElement("span");
        span.innerHTML = out;
        ch.replaceWith(span);
      } else if (ch.nodeType === 1 && ch.tagName !== "B") walk(ch);
    });
  };
  walk(box);
  const missed = Object.keys(left).filter(k => left[k]);
  if (missed.length && missed.length < marks.length + 1) {
    missed.forEach(k => {
      const w = k.split(/\s+/).filter(Boolean).pop();
      if (!w || w.length < 5) return;
      left[k] = 0; left[w] = 1;
      marks.push(w);
    });
    const rx2 = new RegExp("(" + missed.map(k => {
      const w = k.split(/\s+/).filter(Boolean).pop();
      return w && w.length >= 5 ? w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "\\u0000";
    }).join("|") + ")", "i");
    const walk2 = n => {
      [...n.childNodes].forEach(ch => {
        if (ch.nodeType === 3) {
          const m3 = ch.nodeValue.match(rx2);
          if (!m3) return;
          const span = document.createElement("span");
          span.innerHTML = esc(ch.nodeValue.slice(0, m3.index)) + '<b class="hl">' + esc(m3[0]) +
            "</b>" + esc(ch.nodeValue.slice(m3.index + m3[0].length));
          ch.replaceWith(span);
        } else if (ch.nodeType === 1 && ch.tagName !== "B") walk2(ch);
      });
    };
    walk2(box);
  }
  return box.innerHTML;
}

