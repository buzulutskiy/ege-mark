/* Курс: теория и задачи вперемешку, одной дорожкой.
   Порядок внутри темы всегда один: объяснили кусок теории с картинкой → показали, как решается
   настоящая задача → дал решить похожую сам. И так по кругу, от простого к сложному.

   Шаги описаны в lessons/course-<sid>-<n>.json, типы:
     teach — кусок теории: заголовок, абзацы, формулы, рисунок из DRAW
     quiz  — быстрый вопрос на понимание, без вычислений
     show  — настоящая задача ЕГЭ вместе с готовым разбором
     solve — близнец из генератора: те же объекты, другие числа, разбора нет */

let CRS = {}, crsKey = null, crsIdx = 0, quizPick = {};

async function loadCourse(key) {
  if (CRS[key] !== undefined) return CRS[key];
  try {
    const r = await fetch("lessons/course-" + key + ".json?v=" + VER);
    CRS[key] = r.ok ? await r.json() : null;
  } catch (e) { CRS[key] = null; }
  return CRS[key];
}

function crsState() {
  S.course = S.course || {};
  return S.course[crsKey] = S.course[crsKey] || { i: 0, done: {}, solved: {} };
}
function crsSteps() { const c = CRS[crsKey]; return c ? c.steps : []; }

/* рисунок по имени из gen/draw.js */
function illHTML(name) {
  if (!name || typeof DRAW === "undefined" || !DRAW[name]) return "";
  try { return `<div class="cs-ill">${DRAW[name]()}</div>`; } catch (e) { return ""; }
}

/* близнец для шага solve — зерно от номера шага, чтобы задача была одна и та же при возврате */
function crsTwin(step, tries) {
  const d = (MAP[curSubj] || {})[String(curNum)];
  const g = d && (d.groups || []).find(x => x.key === step.key);
  const gen = g && GENS[curSubj + ":" + g.key];
  if (!g || !gen) return null;
  const kind = gen.kinds.find(k => k.id === step.kind) || gen.kinds[0];
  if (!kind) return null;
  const seed = (trHash(crsKey + ":" + step.key + ":" + step.kind) % 90000) + 1 + (tries || 0) * 37;
  return { q: twinQ(g, kind, seed), kind: kind, g: g };
}

/* ─────────────────────────── экран ─────────────────────────── */
function renderCourse() {
  const c = CRS[crsKey];
  if (!c) return `<h4 class="sec first">Курс</h4><p class="rest">Загружаем…</p>`;
  const st = crsState(), steps = c.steps;
  const i = Math.min(st.i, steps.length);
  const step = steps[i];
  const pct = steps.length ? Math.round(i / steps.length * 100) : 0;

  let h = `<div class="ls-top">
      <button class="ico" data-act="cs-home">‹</button>
      <div class="ls-ti"><b>${esc(c.title)}</b><span>${step ? esc(step.part || c.subtitle || "") : "Курс пройден"}</span></div>
      <div class="ls-step">${Math.min(i + 1, steps.length)} / ${steps.length}</div>
    </div>
    <div class="ls-bar"><i style="width:${pct}%;--c:${SUB[c.subj].color}"></i></div>`;

  if (!step) {
    h += `<div class="ls-body"><div class="gwrap"><b>Курс пройден</b>
      Ты прошёл всю теорию первого задания и решил задачу каждого вида. Дальше — вкладка «Задачи»: там те же приёмы, но с полным банком.</div>
      <div class="ls-nav"><button class="primary" data-act="cs-restart">Пройти заново</button></div></div>`;
    return h;
  }

  if (step.t === "teach") {
    h += `<div class="cs-stage teach"><span>теория</span>${esc(step.part || "")}</div>
      <div class="ls-body cs-body">
        <h3 class="cs-h">${esc(step.title)}</h3>
        ${illHTML(step.ill)}
        ${(step.p || []).map(x => `<p class="cs-p">${esc(x)}</p>`).join("")}
        ${(step.f || []).length ? `<div class="bk-f">${step.f.map(f =>
          `<div class="bk-fi"><b>${mathHTML(f[0])}</b><span>${esc(f[1])}</span></div>`).join("")}</div>` : ""}
        ${step.note ? `<div class="bk-t"><span>запомни</span>${esc(step.note)}</div>` : ""}
      </div>
      <div class="ls-nav"><button class="primary" data-act="cs-next">Понятно, дальше</button></div>`;
    return h;
  }

  if (step.t === "quiz") {
    const pick = quizPick[i];
    const ok = pick != null && step.opts[pick] === step.ok;
    h += `<div class="cs-stage quiz"><span>проверка</span>вопрос на понимание, считать не надо</div>
      <div class="ls-body cs-body">
        ${illHTML(step.ill)}
        <h3 class="cs-h">${esc(step.q)}</h3>
        <div class="opts">${step.opts.map((o, oi) => {
          const chosen = pick === oi;
          return `<button class="opt${chosen ? (ok ? " ok" : " no") : ""}"
            ${pick == null ? `data-act="cs-quiz" data-i="${i}" data-o="${oi}"` : "disabled"}>${esc(o)}</button>`;
        }).join("")}</div>
        ${pick != null ? `<div class="dr-r ${ok ? "ok" : "no"}"><b>${ok ? "Верно" : "Правильно: " + esc(step.ok)}</b> ${esc(step.why)}</div>` : ""}
      </div>
      ${pick != null ? `<div class="ls-nav"><button class="primary" data-act="cs-next">Дальше</button></div>` : ""}`;
    return h;
  }

  if (step.t === "show") {
    const q = qById(step.id), z = q && razOf(q.id);
    if (!q) return h + `<p class="rest">Задача не загрузилась.</p>
      <div class="ls-nav"><button class="primary" data-act="cs-next">Пропустить</button></div>`;
    h += `<div class="cs-stage show"><span>пример</span>смотри, как решается настоящая задача ЕГЭ</div>
      <div class="ls-body qbody split">${trTaskAsk(q)}<div class="qsol-col">
        <h4 class="sec">Разбор по шагам</h4>${z ? razborHTML(q, z) : `<p class="rest">Разбор загружается…</p>`}
      </div></div>
      <div class="ls-nav"><button class="primary" data-act="cs-next">Разобрал — дальше</button></div>`;
    return h;
  }

  /* solve */
  const stt = st.solved[i] = st.solved[i] || { tries: 0, res: null };
  const tw = crsTwin(step, stt.tries);
  if (!tw || !tw.q) {
    h += `<div class="ls-body"><p class="rest">Задача готовится…</p></div>`;
    return h;
  }
  const r = stt.res;
  h += `<div class="cs-stage solve"><span>теперь ты</span>та же задача, другие числа. Подсказки нет — это и есть проверка${stt.tries ? `. Попытка ${stt.tries + 1}` : ""}</div>
    <div class="ls-body qbody split">${trTaskAsk(tw.q)}<div class="qsol-col">`;
  if (r) {
    h += `<div class="dr-r ${r.ok ? "ok" : "no"}"><b>${r.ok ? "Верно" : "Правильный ответ: " + esc(tw.q.answer)}</b></div>
      ${r.ok ? "" : `<h4 class="sec">Как это решалось</h4>` + razborHTML(tw.q, TWIN_RAZ[tw.q.id])}`;
  } else {
    h += `<div class="dr-in"><input type="text" id="qa" placeholder="ответ" autocomplete="off">
      <button class="dr-go go" data-act="cs-check">Проверить</button></div>
      <p class="foot">Ответ — число, как в бланке: 2,5 или −10. Единицы писать не надо.</p>`;
  }
  h += `</div></div><div class="ls-nav">`;
  if (r && r.ok) h += `<button class="primary" data-act="cs-next">Дальше</button>`;
  else if (r) h += `<button class="ghost half" data-act="cs-back">Вернуться к примеру</button><button class="primary half" data-act="cs-again">Ещё одну такую же</button>`;
  else h += `<button class="ghost" data-act="cs-back">Не помню — назад к примеру</button>`;
  return h + `</div>`;
}

/* ─────────────────────────── действия ─────────────────────────── */
function crsOpen(key) {
  crsKey = key; view = "course";
  const m = /^([a-z]+)-(\d+)$/.exec(key);
  if (m) { curSubj = m[1]; curNum = +m[2]; }
  loadCourse(key).then(() => {
    if (!MAP[curSubj]) {
      loadBank(curSubj).then(() => loadMap(curSubj)).then(() => loadQX(curSubj))
        .then(() => loadForm(curSubj)).then(() => { loadRaz(curSubj, curNum); loadGens(curSubj, curNum); render(); });
    } else { loadRaz(curSubj, curNum); loadGens(curSubj, curNum); }
    render();
  });
  render(); window.scrollTo(0, 0);
}
function crsNext() {
  const st = crsState(), steps = crsSteps();
  st.done[st.i] = 1;
  st.i = Math.min(st.i + 1, steps.length);
  save(); render(); window.scrollTo(0, 0);
}
function crsCheck() {
  const st = crsState(), step = crsSteps()[st.i];
  const el = $("#qa"); const v = el ? el.value.trim() : "";
  if (!v) { toast("Впиши ответ"); return; }
  const stt = st.solved[st.i] = st.solved[st.i] || { tries: 0, res: null };
  const tw = crsTwin(step, stt.tries);
  const ok = tw && tw.q && sameAnswer(v, tw.q.answer);
  stt.res = { ok: !!ok, ans: v };
  save(); render(); window.scrollTo(0, 0);
}
function crsAgain() {
  const st = crsState();
  const stt = st.solved[st.i] = st.solved[st.i] || { tries: 0, res: null };
  stt.tries++; stt.res = null;
  save(); render(); window.scrollTo(0, 0);
}
function crsBack() {
  const st = crsState(), steps = crsSteps();
  for (let j = st.i - 1; j >= 0; j--) if (steps[j].t === "show" || steps[j].t === "teach") { st.i = j; break; }
  save(); render(); window.scrollTo(0, 0);
}
function crsQuiz(i, o) {
  quizPick[i] = o;
  const st = crsState();
  if (crsSteps()[i].opts[o] === crsSteps()[i].ok) st.done[i] = 1;
  save(); render();
}
function crsRestart() {
  const st = crsState();
  st.i = 0; st.done = {}; st.solved = {}; quizPick = {};
  save(); render(); window.scrollTo(0, 0);
}

/* карточка курса на главной вкладке «Курс» */
function renderCourseHome() {
  const key = "fiz-1";
  const st = (S.course || {})[key] || { i: 0 };
  const c = CRS[key];
  if (!c) { loadCourse(key).then(render); return `<h4 class="sec first">Курс</h4><p class="rest">Загружаем…</p>`; }
  const pct = c.steps.length ? Math.round(st.i / c.steps.length * 100) : 0;
  return `<h4 class="sec first">Курс с нуля</h4>
    <p class="foot" style="margin:0 0 12px">Теория и задачи вперемешку, одной дорожкой. Объясняем кусок — показываем, как решается задача, — даём решить похожую. Ничего знать заранее не надо.</p>
    <button class="crow" data-act="cs-open" data-k="${key}" style="--c:${SUB[c.subj].color}">
      <span class="cr-b"><b>${esc(c.title)}</b><i>${esc(c.subtitle || "")}</i>
        <span class="nr-bar"><em style="width:${pct}%"></em></span></span>
      <span class="cr-p">${st.i ? pct + "%" : "начать"}<em>${st.i ? "пройдено" : c.steps.length + " шагов"}</em></span>
    </button>`;
}
