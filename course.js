/* Курс: теория и задачи вперемешку, одной дорожкой.
   Порядок внутри темы всегда один: объяснили кусок теории с картинкой → показали, как решается
   настоящая задача → дал решить похожую сам. И так по кругу, от простого к сложному.

   Шаги описаны в lessons/course-<sid>-<n>.json, типы:
     idea  — ОДНА мысль на экран: две-три фразы, иногда картинка. Основной кирпич курса
     check — короткий вопрос сразу после мысли: понял или нет
     read  — прочитать условие настоящей задачи, ничего не решая
     ask   — «что дано и что просят найти»: выбор из вариантов
     pickf — какая формула тут работает и почему именно она
     micro — один микровопрос по задаче: снять число, посчитать кусок
     whole — решение целиком и запись в тетрадь
     teach — старый большой кусок теории (оставлен для совместимости)
     quiz  — быстрый вопрос на понимание, без вычислений
     warm  — упрощённый пример: крошечные числа, решение целиком на виду.
             Мост между теорией и настоящим заданием: тот же ход, но считать легко
     show  — настоящая задача ЕГЭ вместе с готовым разбором
     solve — близнец из генератора: те же объекты, другие числа, разбора нет
     real  — настоящая задача ЕГЭ, которую Марк решает сам; разбор открывается после ответа
     recap — итог приёма: что теперь умеешь и где тут ошибаются */

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

/* Эталонная запись решения — то, что Марк переписывает в тетрадь.
   Собирается из разбора: только строки-формулы, по порядку, плюс ответ.
   Получается ровно то, что учитель требует записать: цепочка формул с подставленными числами. */
function notebookHTML(q, z) {
  if (!z) return "";
  const lines = [];
  (z.steps || []).forEach(st => (st.p || []).forEach(x => {
    if (/^f\s*:/.test(String(x))) lines.push(String(x).replace(/^f\s*:/, "").trim());
  }));
  if (!lines.length) return "";
  return `<div class="nb">
    <div class="nb-h"><b>Перепиши это в тетрадь</b><span>от руки, целиком — так решение запомнится рукой, а не глазами</span></div>
    <div class="nb-p">
      <div class="nb-t">Решение</div>
      ${lines.map(x => `<div class="nb-f">${mathHTML(x)}</div>`).join("")}
      <div class="nb-t nb-a">Ответ: ${esc(z.ans || q.answer || "")}</div>
    </div>
  </div>`;
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

  /* ── одна мысль на экран ── */
  if (step.t === "idea") {
    return h + `<div class="cs-stage idea"><span>${esc(step.tag || "разбираемся")}</span>${esc(step.part || "")}</div>
      <div class="ls-body cs-body cs-one">
        ${step.title ? `<h3 class="cs-h">${esc(step.title)}</h3>` : ""}
        ${illHTML(step.ill)}
        ${(step.p || []).map(x => `<p class="cs-p big">${esc(x)}</p>`).join("")}
        ${(step.f || []).length ? `<div class="bk-f">${step.f.map(f =>
          `<div class="bk-fi"><b>${mathHTML(f[0])}</b><span>${esc(f[1])}</span></div>`).join("")}</div>` : ""}
      </div>
      <div class="ls-nav"><button class="primary" data-act="cs-next">Дальше</button></div>`;
  }

  /* ── короткая проверка: понял или нет ── */
  if (step.t === "check") {
    const pick = quizPick[i], ok = pick != null && step.opts[pick] === step.ok;
    return h + `<div class="cs-stage check"><span>проверим</span>${esc(step.lead || "один вопрос, считать не надо")}</div>
      <div class="ls-body cs-body cs-one">
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
  }

  /* ── условие задачи компактно: нужно почти во всех шагах ниже ── */
  const cond = q => {
    const parts = splitQ(q.html);
    return `<div class="cs-cond">
      ${parts.figs.length ? `<div class="cs-fig">${parts.figs.join("")}</div>` : ""}
      <div class="cs-txt">${hlQ(parts.text)}</div></div>`;
  };

  if (step.t === "read") {
    const q = qById(step.id);
    if (!q) return h + `<p class="rest">Задача не загрузилась.</p><div class="ls-nav"><button class="primary" data-act="cs-next">Дальше</button></div>`;
    return h + `<div class="cs-stage read"><span>настоящая задача ЕГЭ</span>Пока ничего не решаем. Просто прочитай — медленно, два раза.</div>
      <div class="ls-body cs-body">${cond(q)}
        ${step.simple ? `<div class="cs-simple"><span>о чём это</span>${esc(step.simple)}</div>` : ""}
      </div>
      <div class="ls-nav"><button class="primary" data-act="cs-next">Прочитал</button></div>`;
  }

  if (step.t === "ask") {
    const q = qById(step.id), c = q && q.choice;
    if (!c) return h + `<p class="rest">Вопрос не загрузился.</p><div class="ls-nav"><button class="primary" data-act="cs-next">Дальше</button></div>`;
    const pick = quizPick[i];
    const chosen = pick != null ? c.opts[pick] : null;
    const good = chosen && (chosen.ok || chosen.tell);
    return h + `<div class="cs-stage ask"><span>шаг 1 — что от нас хотят</span>Ещё не считаем. Сначала поймём, что дано и что спрашивают.</div>
      <div class="ls-body cs-body">${cond(q)}
        <h3 class="cs-h">${esc(c.q)}</h3>
        <div class="opts">${c.opts.map((o, oi) => {
          const isPick = pick === oi;
          return `<button class="opt${o.tell ? " tell" : ""}${isPick ? (o.ok ? " ok" : o.tell ? " told" : " no") : ""}"
            ${pick == null || !good ? `data-act="cs-quiz" data-i="${i}" data-o="${oi}"` : "disabled"}>${esc(o.t)}</button>`;
        }).join("")}</div>
        ${chosen && !chosen.ok && !chosen.tell ? `<div class="dr-r no"><b>Пока не то.</b> ${esc(c.hint || "")}</div>` : ""}
        ${chosen && chosen.tell ? `<div class="dr-r ok"><b>Смотри.</b> ${esc((c.opts.find(o => o.ok) || {}).t || "")}</div>` : ""}
        ${chosen && chosen.ok ? `<div class="dr-r ok"><b>Верно.</b> Теперь понятно, что искать.</div>` : ""}
      </div>
      ${good ? `<div class="ls-nav"><button class="primary" data-act="cs-next">Дальше</button></div>` : ""}`;
  }

  if (step.t === "pickf") {
    const q = qById(step.id), f = q && q.formula;
    if (!f) return h + `<p class="rest">Формула не загрузилась.</p><div class="ls-nav"><button class="primary" data-act="cs-next">Дальше</button></div>`;
    return h + `<div class="cs-stage pickf"><span>шаг 2 — какая формула</span>Вот чем эта задача решается и почему именно этим.</div>
      <div class="ls-body cs-body">
        <div class="cs-fmain">${mathHTML(f.f)}</div>
        ${f.what ? `<p class="cs-p big">${esc(f.what)}</p>` : ""}
        ${f.why ? `<div class="cs-why"><span>почему именно она — в этой задаче</span>${esc(f.why)}</div>` : ""}
        ${f.need ? `<div class="cs-need"><span>что для неё нужно</span>${esc(f.need)}</div>` : ""}
      </div>
      <div class="ls-nav"><button class="primary" data-act="cs-next">Понял — считаем</button></div>`;
  }

  if (step.t === "micro") {
    const q = qById(step.id), ms = (q && q.steps) || [], m = ms[step.k];
    if (!m) return h + `<p class="rest">Шаг не загрузился.</p><div class="ls-nav"><button class="primary" data-act="cs-next">Дальше</button></div>`;
    const r = st.solved[i];
    return h + `<div class="cs-stage micro"><span>шаг ${step.k + 3} — считаем по кусочку</span>${esc(m.lead || "Одно действие. Больше ничего.")}</div>
      <div class="ls-body cs-body">${cond(q)}
        <h3 class="cs-h">${esc(m.q)}</h3>
        ${r ? `<div class="dr-r ${r.ok ? "ok" : "no"}"><b>${r.ok ? "Верно" : "Правильно: " + esc(m.a) + (m.unit ? " " + esc(m.unit) : "")}</b>
                ${esc(m.why || "")}</div>`
            : `<div class="dr-in"><input type="text" id="qa" placeholder="ответ${m.unit ? ", " + esc(m.unit) : ""}" autocomplete="off">
                 <button class="dr-go go" data-act="cs-micro">Проверить</button></div>`}
      </div>
      ${r ? `<div class="ls-nav"><button class="primary" data-act="cs-next">Дальше</button></div>` : ""}`;
  }

  if (step.t === "whole") {
    const q = qById(step.id), z = q && razOf(q.id);
    if (!q) return h + `<p class="rest">Задача не загрузилась.</p><div class="ls-nav"><button class="primary" data-act="cs-next">Дальше</button></div>`;
    return h + `<div class="cs-stage whole"><span>а теперь целиком</span>Ты прошёл эту задачу по кусочкам. Вот как она выглядит одним решением.</div>
      <div class="ls-body qbody split">${trTaskAsk(q)}<div class="qsol-col">
        ${z ? razborHTML(q, z) : ""}${z ? notebookHTML(q, z) : ""}
      </div></div>
      <div class="ls-nav"><button class="primary" data-act="cs-next">Переписал в тетрадь — дальше</button></div>`;
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
    h += `<div class="cs-stage show"><span>а теперь настоящая задача ЕГЭ</span>${esc(step.lead || "Теорию разобрали — вот как она работает на живом задании. Именно такое придёт на экзамене.")}</div>
      <div class="cs-read">Сначала прочитай условие внимательно, не спеша. Потом читай разбор по шагам — там объяснено, какую формулу вспоминаем и почему именно её.</div>
      <div class="ls-body qbody split">${trTaskAsk(q)}<div class="qsol-col">
        <h4 class="sec">Разбор по шагам</h4>${z ? razborHTML(q, z) : `<p class="rest">Разбор загружается…</p>`}
        ${z ? notebookHTML(q, z) : ""}
      </div></div>
      <div class="ls-nav"><button class="primary" data-act="cs-next">Переписал в тетрадь — дальше</button></div>`;
    return h;
  }

  if (step.t === "warm") {
    return h + `<div class="cs-stage warm"><span>разомнёмся</span>${esc(step.lead || "то же самое, но с маленькими числами — чтобы увидеть ход целиком")}</div>
      <div class="ls-body cs-body">
        <h3 class="cs-h">${esc(step.title)}</h3>
        ${illHTML(step.ill)}
        <p class="cs-q">${esc(step.q)}</p>
        <div class="cs-steps">${(step.steps || []).map(x => razLine(x)).join("")}</div>
        <div class="bk-ex-a">${esc(step.a)}</div>
        ${step.note ? `<div class="bk-t"><span>отсюда правило</span>${esc(step.note)}</div>` : ""}
      </div>
      <div class="ls-nav"><button class="primary" data-act="cs-next">Понял — к настоящей задаче</button></div>`;
  }

  if (step.t === "recap") {
    return h + `<div class="cs-stage recap"><span>итог приёма</span>${esc(step.part || "")}</div>
      <div class="ls-body cs-body">
        <h3 class="cs-h">${esc(step.title)}</h3>
        <div class="cs-can"><span>теперь ты умеешь</span><ul>${(step.can || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
        ${(step.f || []).length ? `<div class="bk-f">${step.f.map(f =>
          `<div class="bk-fi"><b>${mathHTML(f[0])}</b><span>${esc(f[1])}</span></div>`).join("")}</div>` : ""}
        ${step.trap ? `<div class="bk-t"><span>где тут ошибаются</span>${esc(step.trap)}</div>` : ""}
      </div>
      <div class="ls-nav"><button class="primary" data-act="cs-next">Дальше</button></div>`;
  }

  if (step.t === "real") {
    const q = qById(step.id);
    if (!q) return h + `<p class="rest">Задача не загрузилась.</p>
      <div class="ls-nav"><button class="primary" data-act="cs-next">Пропустить</button></div>`;
    const rr = st.solved[i];
    h += `<div class="cs-stage real"><span>настоящее задание — решай сам</span>Подглядывать в разбор нельзя, а в свою тетрадь можно. Разбор откроется после ответа</div>
      <div class="ls-body qbody split">${trTaskAsk(q)}<div class="qsol-col">`;
    if (rr) {
      h += `<div class="dr-r ${rr.ok ? "ok" : "no"}"><b>${rr.ok ? "Верно" : "Правильный ответ: " + esc(q.answer)}</b></div>`;
      const z = razOf(q.id);
      if (z) h += `<h4 class="sec">Как это решалось</h4>` + razborHTML(q, z);
    } else {
      h += `<div class="dr-in"><input type="text" id="qa" placeholder="ответ" autocomplete="off">
        <button class="dr-go go" data-act="cs-real">Проверить</button></div>
        <p class="foot">Это задача из настоящего банка ЕГЭ, без упрощений.</p>`;
    }
    h += `</div></div><div class="ls-nav">${rr ? `<button class="primary" data-act="cs-next">Дальше</button>`
      : `<button class="ghost" data-act="cs-back">Не помню — назад к примеру</button>`}</div>`;
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
  h += `<div class="cs-stage solve"><span>теперь ты сам</span>Задача того же вида, числа другие. Открой тетрадь с переписанным решением и делай по аналогии: та же формула, те же шаги, свои числа${stt.tries ? `. Попытка ${stt.tries + 1}` : ""}</div>
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
function crsReal() {
  const st = crsState(), step = crsSteps()[st.i];
  const el = $("#qa"); const v = el ? el.value.trim() : "";
  if (!v) { toast("Впиши ответ"); return; }
  const q = qById(step.id);
  const ok = q && sameAnswer(v, q.answer);
  st.solved[st.i] = { ok: !!ok, ans: v };
  if (q) markSolved(q.id, !!ok);          /* засчитываем в общий прогресс по заданию */
  save(); render(); window.scrollTo(0, 0);
}

function crsMicro() {
  const st = crsState(), step = crsSteps()[st.i];
  const q = qById(step.id), m = ((q && q.steps) || [])[step.k];
  const el = $("#qa"); const v = el ? el.value.trim() : "";
  if (!v) { toast("Впиши ответ"); return; }
  st.solved[st.i] = { ok: !!(m && sameAnswer(v, m.a)), ans: v };
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
  for (let j = st.i - 1; j >= 0; j--)
    if (steps[j].t === "show" || steps[j].t === "warm" || steps[j].t === "teach") { st.i = j; break; }
  save(); render(); window.scrollTo(0, 0);
}
function crsQuiz(i, o) {
  quizPick[i] = o;
  const st = crsState(), step = crsSteps()[i];
  /* у шага check варианты лежат в нём самом, у шага ask — в данных задачи */
  if (step.t === "ask") {
    const q = qById(step.id), c = q && q.choice;
    const picked = c && c.opts[o];
    if (picked && picked.ok) st.done[i] = 1;
  } else if (step.opts && step.opts[o] === step.ok) {
    st.done[i] = 1;
  }
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
