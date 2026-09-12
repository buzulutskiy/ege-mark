/* Тренажёр приёма: «смотри, как решается» → «теперь ты, та же задача» → «похожая, без подсказки».
   Единица прохождения — приём (группа из lessons/plan-<sid>.json); внутри — подвиды по очереди.
   Близнецы (похожие задачи с другими числами) делает генератор из gen/kin-<key>.js. */

let trKey = null;                 // ключ открытого приёма
const TWIN_Q = {}, TWIN_RAZ = {}; // кэш близнецов: id → задача / разбор

function trGroup(key) { const d = (MAP[curSubj] || {})[String(curNum)]; return d ? (d.groups || []).find(g => g.key === key) : null; }
function trStateKey(key) { return curSubj + ":" + curNum + ":" + key; }
function trState(key) {
  S.train = S.train || {};
  const k = trStateKey(key);
  return S.train[k] = S.train[k] || { i: 0, ex: {}, tw: {} };
}
function trSubs(g) { return (g.subs && g.subs.length) ? g.subs : [g]; }
/* Модули генераторов грузим как в node: текст файла → функция с module/RND/GRAPH.
   Так их top-level const GEN не сталкиваются между собой в глобальной области. */
const GENS = {}, genLoad = {};
function loadGens(sid, n) {
  const d = (MAP[sid] || {})[String(n)]; if (!d) return;
  (d.groups || []).forEach(g => {
    const key = sid + ":" + g.key;
    if (GENS[key] || genLoad[key]) return;
    genLoad[key] = 1;
    fetch(`gen/kin-${g.key}.js?v=${VER}`).then(r => r.ok ? r.text() : null).then(src => {
      if (!src) { GENS[key] = null; return; }
      try {
        const mod = { exports: {} };
        new Function("RND", "GRAPH", "module", "window", src)(RND, GRAPH, mod, undefined);
        GENS[key] = mod.exports && mod.exports.kinds ? mod.exports : null;
      } catch (e) { console.error("генератор не загрузился", g.key, e); GENS[key] = null; }
      render();
    }).catch(() => { GENS[key] = null; });
  });
}
function trGen(g) { return GENS[curSubj + ":" + g.key] || null; }
function trKind(g, s, si) {
  const gen = trGen(g); if (!gen) return null;
  return gen.kinds.find(k => k.title === s.title) || gen.kinds[si] || null;
}
function trHash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* последовательность шагов приёма */
function trSeq(g) {
  const seq = [];
  trSubs(g).forEach((s, si) => {
    const ex = (s.tasks || []).map(id => qById(id)).find(q => q && razOf(q.id)) || qById((s.tasks || [])[0]);
    const kind = trKind(g, s, si);
    if (ex) seq.push({ t: "show", s, q: ex, si });
    if (ex) seq.push({ t: "recall", s, q: ex, si });
    if (kind) seq.push({ t: "twin", s, kind, si });
  });
  return seq;
}

/* близнец: одна и та же пара (вид, зерно) всегда даёт одну и ту же задачу */
function twinQ(g, kind, seed) {
  const id = `tw:${g.key}:${kind.id}:${seed}`;
  if (TWIN_Q[id]) return TWIN_Q[id];
  let t;
  try { t = kind.make(RND.make(seed * 7919 + 13)); } catch (e) { console.error("генератор упал", g.key, kind.id, e); return null; }
  const fig = t.svg || t.table || "";
  const q = {
    id, twin: true, plain: t.plain, answer: String(t.answer), unit: t.unit || "", simple: t.simple || "",
    html: (fig ? `<div class="gfig">${fig}</div>` : "") + `<p>${esc(t.plain)}</p>`,
  };
  TWIN_Q[id] = q; TWIN_RAZ[id] = t.raz;
  return q;
}
function trTwinState(st, kind) { return st.tw[kind.id] = st.tw[kind.id] || { tries: 0, ok: 0, res: null }; }
function trTwinSeed(g, kind, tries) { return (trHash(trStateKey(g.key) + ":" + kind.id) % 100000) + tries * 31 + 1; }

/* прогресс приёма: сколько подвидов закрыто (близнец решён сам) */
function trProgress(g) {
  const st = (S.train || {})[trStateKey(g.key)] || { tw: {} };
  const subs = trSubs(g);
  let done = 0;
  subs.forEach((s, si) => { const k = trKind(g, s, si); if (k && st.tw[k.id] && st.tw[k.id].ok) done++; else if (!k && st.ex && st.ex["r" + si] && st.ex["r" + si].ok) done++; });
  return { done, total: subs.length, closed: done >= subs.length };
}
function trainProgress(sid, n) {
  const d = (MAP[sid] || {})[String(n)]; if (!d) return null;
  let done = 0, total = 0;
  const keepS = curSubj, keepN = curNum; curSubj = sid; curNum = n;
  (d.groups || []).forEach(g => { const p = trProgress(g); done += p.done; total += p.total; });
  curSubj = keepS; curNum = keepN;
  return { done, total };
}
function trainToday() {
  const t = today(); let n = 0;
  Object.keys(S.train || {}).forEach(k => Object.keys(S.train[k].tw || {}).forEach(kid => {
    const r = S.train[k].tw[kid]; if (r && r.ok && r.at && iso(new Date(r.at)) === t) n++;
  }));
  return n;
}

/* ───────── список приёмов на экране номера ───────── */
function trainRowsHTML(sid, n) {
  const d = (MAP[sid] || {})[String(n)]; if (!d) return "";
  const sub = SUB[sid];
  let h = `<h4 class="sec">Приёмы — проходи по порядку</h4>
    <p class="foot" style="margin:0 0 10px">В каждом приёме: смотришь разбор, решаешь ту же задачу сам, потом похожую без подсказки. Приём закрыт, когда все похожие решены.</p>
    <button class="bk-link" data-act="bk-read">Если с нуля — начни с учебника, он написан по порядку</button>`;
  (d.groups || []).forEach((g, gi) => {
    const p = trProgress(g), st = (S.train || {})[trStateKey(g.key)];
    const started = st && (st.i > 0 || Object.keys(st.tw).length);
    h += `<button class="trow${p.closed ? " done" : started ? " going" : ""}" data-act="train" data-k="${esc(g.key)}" style="--c:${sub.color}">
      <span class="tr-n">${gi + 1}</span>
      <span class="tr-b"><b>${esc(g.title)}</b><i>${esc(g.summary || "")}</i>
        <span class="nr-bar"><em style="width:${p.total ? p.done / p.total * 100 : 0}%"></em></span></span>
      <span class="tr-p">${p.done}/${p.total}<em>${p.closed ? "закрыт" : started ? "идёт" : "подвидов"}</em></span>
    </button>`;
  });
  return h;
}

/* ───────── экран приёма ───────── */
function trOpen(key) {
  trKey = key; view = "train";
  loadRaz(curSubj, curNum); loadGens(curSubj, curNum);
  render(); window.scrollTo(0, 0);
}

function trTaskAsk(q) {
  const parts = splitQ(q.html);
  return `<div class="qask-col">
    ${parts.figs.length ? `<div class="qfig">${parts.figs.join("")}</div>` : ""}
    <div class="qtask">${hlQ(parts.text)}</div>
    ${q.twin ? "" : aiBlockHTML(q)}
  </div>`;
}

function renderTrain() {
  const g = trGroup(trKey);
  if (!g) {                                    /* данные ещё грузятся или номер не выбран */
    if (!MAP[curSubj]) return `<p class="rest">Загружаем задачи…</p>`;
    view = "num"; return renderNum();
  }
  const sub = SUB[curSubj], st = trState(g.key), seq = trSeq(g), p = trProgress(g);
  const i = Math.min(st.i, seq.length);
  const step = seq[i];

  let h = `<div class="ls-top">
      <button class="ico" data-act="num" data-n="${curNum}">‹</button>
      <div class="ls-ti"><b>${esc(g.title)}</b><span>${step ? `Подвид ${step.si + 1} из ${trSubs(g).length} · ${esc(step.s.title || "")}` : "Приём пройден"}</span></div>
      <div class="ls-step">${p.done} / ${p.total}</div>
    </div>
    <div class="ls-bar"><i style="width:${seq.length ? i / seq.length * 100 : 0}%;--c:${sub.color}"></i></div>
    <button class="bk-link" data-act="bk-read" data-k="${esc(g.key)}">Теория к этому приёму — в учебнике</button>`;

  if (!step) {
    h += `<div class="ls-body"><div class="gwrap"><b>Приём закрыт</b>${p.done} из ${p.total} подвидов решены самостоятельно. Дальше такие задачи будешь узнавать с первого взгляда.</div>
      <div class="ls-nav"><button class="primary" data-act="num" data-n="${curNum}">К списку приёмов</button></div></div>`;
    return h;
  }

  if (step.t === "show") {
    const q = step.q, z = razOf(q.id);
    h += `<div class="tr-stage" style="--c:${sub.color}"><b>1 · Смотри, как решается</b><span>Читай не спеша. Отвечать не надо — надо понять, почему каждый шаг именно такой.</span></div>
      <div class="ls-body qbody split">${trTaskAsk(q)}<div class="qsol-col">
        <h4 class="sec">Разбор по шагам</h4>${z ? razborHTML(q, z) : `<p class="rest">Разбор загружается…</p>`}
      </div></div>
      <div class="ls-nav"><button class="primary" data-act="tr-ok">Разобрал, понял — дальше</button></div>`;
    return h;
  }

  if (step.t === "recall") {
    const q = step.q, r = st.ex["r" + step.si], z = razOf(q.id);
    h += `<div class="tr-stage" style="--c:${sub.color}"><b>2 · Теперь ты: та же задача</b><span>Разбор спрятан. Реши сам, как только что читал, и впиши ответ.</span></div>
      <div class="ls-body qbody split">${trTaskAsk(q)}<div class="qsol-col">`;
    if (r) {
      h += `<div class="dr-r ${r.ok ? "ok" : "no"}"><b>${r.ok ? "Верно" : "Правильный ответ: " + esc(q.answer)}</b>${r.ok ? "" : " Посмотри разбор ещё раз — и дальше будет похожая."}</div>
        ${z ? razborHTML(q, z) : ""}`;
    } else {
      h += `<div class="dr-in"><input type="text" id="qa" placeholder="ответ" autocomplete="off">
        <button class="dr-go go" data-act="tr-check">Проверить</button></div>
        <p class="foot">Ответ — число, как в бланке ЕГЭ: 2,5 или −10. Единицы писать не надо.</p>`;
    }
    h += `</div></div>
      <div class="ls-nav">${r ? `<button class="primary" data-act="tr-ok">Дальше</button>` : `<button class="ghost" data-act="tr-peek">Забыл — покажи разбор</button>`}</div>`;
    return h;
  }

  /* twin */
  const ts = trTwinState(st, step.kind);
  const q = twinQ(g, step.kind, trTwinSeed(g, step.kind, ts.tries));
  if (!q) {
    h += `<div class="ls-body"><p class="rest">Не удалось сделать похожую задачу.</p>
      <div class="ls-nav"><button class="primary" data-act="tr-ok">Пропустить</button></div></div>`;
    return h;
  }
  const r = ts.res;
  h += `<div class="tr-stage" style="--c:${sub.color}"><b>3 · Похожая, без подсказки</b><span>Те же объекты и тот же вопрос, но другие числа. Реши как в прошлый раз.${ts.tries ? ` Попытка ${ts.tries + 1}.` : ""}</span></div>
    <div class="ls-body qbody split">${trTaskAsk(q)}<div class="qsol-col">`;
  if (r) {
    h += `<div class="dr-r ${r.ok ? "ok" : "no"}"><b>${r.ok ? "Верно — этот подвид закрыт" : "Правильный ответ: " + esc(q.answer)}</b></div>
      ${r.ok ? "" : `<h4 class="sec">Разбор этой задачи</h4>` + razborHTML(q, TWIN_RAZ[q.id])}`;
  } else {
    h += `<div class="dr-in"><input type="text" id="qa" placeholder="ответ" autocomplete="off">
      <button class="dr-go go" data-act="tr-check">Проверить</button></div>
      <p class="foot">Разбора нет специально. Если совсем не идёт — вернись на шаг назад к примеру.</p>`;
  }
  h += `</div></div><div class="ls-nav">`;
  if (r && r.ok) h += `<button class="primary" data-act="tr-ok">Дальше</button>`;
  else if (r) h += `<button class="ghost half" data-act="tr-back">К примеру</button><button class="primary half" data-act="tr-again">Ещё одну такую же</button>`;
  else h += `<button class="ghost" data-act="tr-back">Назад к примеру</button>`;
  h += `</div>`;
  return h;
}

/* ───────── действия ───────── */
function trCheck() {
  const g = trGroup(trKey); if (!g) return;
  const st = trState(g.key), seq = trSeq(g), step = seq[st.i]; if (!step) return;
  const el = $("#qa"); const v = el ? el.value.trim() : "";
  if (!v) { toast("Впиши ответ"); return; }
  if (step.t === "recall") {
    const ok = sameAnswer(v, step.q.answer);
    st.ex["r" + step.si] = { ok, ans: v, at: now() };
    markSolved(step.q.id, ok);
  } else if (step.t === "twin") {
    const ts = trTwinState(st, step.kind);
    const q = twinQ(g, step.kind, trTwinSeed(g, step.kind, ts.tries));
    const ok = q && sameAnswer(v, q.answer);
    ts.res = { ok, ans: v };
    if (ok) { ts.ok = 1; ts.at = now(); }
  }
  save(); render();
  if (step.t !== "show") window.scrollTo(0, 0);
}
function trNext() {
  const g = trGroup(trKey); if (!g) return;
  const st = trState(g.key), seq = trSeq(g), step = seq[st.i];
  if (step && step.t === "show") st.ex["s" + step.si] = 1;
  st.i = Math.min(st.i + 1, seq.length);
  save(); render(); window.scrollTo(0, 0);
}
function trAgain() {
  const g = trGroup(trKey); if (!g) return;
  const st = trState(g.key), step = trSeq(g)[st.i]; if (!step || step.t !== "twin") return;
  const ts = trTwinState(st, step.kind);
  ts.tries++; ts.res = null;
  save(); render(); window.scrollTo(0, 0);
}
function trBack() {
  const g = trGroup(trKey); if (!g) return;
  const st = trState(g.key), seq = trSeq(g);
  const cur = seq[st.i]; if (!cur) return;
  const j = seq.findIndex(x => x.si === cur.si && x.t === "show");
  if (j >= 0) st.i = j;
  save(); render(); window.scrollTo(0, 0);
}
function trPeek() {
  const g = trGroup(trKey); if (!g) return;
  const st = trState(g.key), step = trSeq(g)[st.i]; if (!step || step.t !== "recall") return;
  st.ex["r" + step.si] = { ok: false, ans: "", peek: 1, at: now() };
  save(); render(); window.scrollTo(0, 0);
}
