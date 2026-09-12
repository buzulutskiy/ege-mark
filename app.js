/* Марк готовится — сервис подготовки к ЕГЭ-2027.
   Занятия · Траектория обучения · Динамика. Хранение локальное, обмен — через GitHub Gist. */

"use strict";

/* ─────────────────────────── мелочи ─────────────────────────── */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const now = () => Date.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = () => Math.random().toString(36).slice(2, 9) + now().toString(36).slice(-4);

const DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DOW_FULL = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
const MON = ["января", "февраля", "марта", "апреля", "мая", "июня",
             "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MON_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
                 "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MON_PREP = ["январе", "феврале", "марте", "апреле", "мае", "июне",
                  "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];
function monthIn(k) { const [y, m] = k.split("-").map(Number); return "в " + MON_PREP[m - 1]; }

function iso(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
function parse(s) { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); }
function today() { return iso(new Date()); }
function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 864e5); }
function dow(s) { return (parse(s).getDay() + 6) % 7; }              /* 0 = понедельник */
function weekStart(s) { return addDays(s, -dow(s)); }
function fmtDate(s) { const d = parse(s); return d.getDate() + " " + MON[d.getMonth()]; }
function fmtDateY(s) { const d = parse(s); return d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear(); }
function monthKey(s) { return String(s).slice(0, 7); }
function monthTitle(k) { const [y, m] = k.split("-").map(Number); return MON_NOM[m - 1] + " " + y; }
function fmtMin(m) {
  m = Math.round(m || 0);
  if (m < 60) return m + " мин";
  const h = Math.floor(m / 60), r = m % 60;
  return r ? h + " ч " + r + " мин" : h + " ч";
}
function fmtH(h) { return fmtMin(Math.round((h || 0) * 60)); }
function plural(n, a, b, c) {
  const m = Math.abs(n) % 100, d = m % 10;
  return n + " " + (m > 10 && m < 20 ? c : d === 1 ? a : d > 1 && d < 5 ? b : c);
}

const SUB = {}; SUBJECTS.forEach(s => { SUB[s.id] = s; s.byN = {}; s.tasks.forEach(t => s.byN[t.n] = t); });

/* ─────────────────────────── состояние ─────────────────────────── */
const LS = "ege-mark-v1";
let S = null;      /* состояние */
let CFG = null;    /* локальное: токен, роль */
let PLAN = {};     /* результат расчёта по предметам */
let view = "week";
let weekCursor = weekStart(today());
let trackSubj = "rus";

function blankState() {
  const st = {
    v: 1,
    rhythm: JSON.parse(JSON.stringify(DEFAULT_RHYTHM)),
    exam: { rus: SUB.rus.examDate, mat: SUB.mat.examDate, fiz: SUB.fiz.examDate },
    excluded: { rus: [], mat: [], fiz: [] },
    tasks: {},        /* "fiz-12": {st:"ok"|"bad"|"new", at, seen} */
    sessions: {},     /* id: {...} */
    mocks: {},        /* id: {...} */
    gen: {},          /* weekStart: true — неделя уже разложена */
    lessons: {},      /* "fiz-3": собранный урок */
    at: now()
  };
  return st;
}

function load() {
  try { S = JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) { S = null; }
  if (!S || S.v !== 1) S = blankState();
  ["rhythm", "exam", "excluded", "tasks", "sessions", "mocks", "gen", "lessons"].forEach(k => { if (!S[k]) S[k] = blankState()[k]; });
  try { CFG = JSON.parse(localStorage.getItem(LS + "-cfg") || "null"); } catch (e) { CFG = null; }
  if (!CFG) CFG = { role: "", token: "", gist: "", lastSync: 0 };
}
function save(touch) {
  if (touch !== false) S.at = now();
  localStorage.setItem(LS, JSON.stringify(S));
  if (touch !== false) syncSoon();
}
function saveCfg() { localStorage.setItem(LS + "-cfg", JSON.stringify(CFG)); }

const isParent = () => CFG.role === "parent";
function taskKey(sid, n) { return sid + "-" + n; }
function tstat(sid, n) { const t = S.tasks[taskKey(sid, n)]; return t ? t.st : "new"; }
function setStat(sid, n, st) {
  const k = taskKey(sid, n), prev = S.tasks[k] || {};
  S.tasks[k] = { st, at: now(), rev: st === "ok" ? (prev.rev || 0) : 0, revAt: prev.revAt || 0 };
  save(); recompute();
}

/* сколько часов уже вложено в задание — по выполненным занятиям */
function loggedHours() {
  const acc = {};
  Object.values(S.sessions).forEach(s => {
    if (s.del || !s.done || !s.refs || !s.refs.length) return;
    const min = (s.fact != null ? s.fact : s.plan) || 0;
    const per = min / s.refs.length / 60;
    s.refs.forEach(r => { acc[s.subj + "-" + r] = (acc[s.subj + "-" + r] || 0) + per; });
  });
  return acc;
}

/* ─────────────────────────── движок плана ─────────────────────────── */
/* Идём по очереди заданий предмета, тратим недельную ёмкость, получаем дату для каждого шага. */

function weekCapacity(sid, pace, ws) {
  const r = S.rhythm[sid];
  let n = r.perWeek || 0, tut = r.tutor || 0;
  if (ws) {                                   /* первая неделя может быть неполной */
    const days = (r.days || []).slice(0, n);
    n = days.filter(d => diffDays(START, addDays(ws, d)) >= 0).length;
    if (tut && r.tutorDay != null && diffDays(START, addDays(ws, r.tutorDay)) < 0) tut = 0;
  }
  const own = n * (r.minutes || 60) / 60;
  return (own + tut * (r.tutorMin || 90) / 60) * (pace == null ? 1 : pace);
}
function totalWeeklyLoad() { return SUBJECTS.reduce((a, s) => a + weekCapacity(s.id, 1), 0); }
const LOAD_LIMIT = 14;   /* потолок: больше 14 часов в неделю на всё — уже не про учёбу */

function isBreak(ws) {   /* новогодняя неделя — единственный перерыв */
  const a = NEWYEAR[0], b = NEWYEAR[1];
  return diffDays(ws, b) >= 0 && diffDays(a, addDays(ws, 6)) >= 0;
}

/* фактический темп: доля выполненного за последние 4 полные недели */
function pace(sid) {
  let plan = 0, fact = 0, n = 0;
  const from = addDays(today(), -28), to = addDays(today(), -1);   /* только прошедшие дни */
  Object.values(S.sessions).forEach(s => {
    if (s.del || s.subj !== sid) return;
    if (diffDays(from, s.date) < 0 || diffDays(s.date, to) < 0) return;
    plan += s.plan || 0; n++;
    if (s.done) fact += (s.fact != null ? s.fact : s.plan) || 0;
  });
  if (n < 4 || plan < 150) return null;           /* мало истории — не гадаем */
  return clamp(fact / plan, 0.35, 1.2);
}

function buildQueue(sid) {
  const sub = SUB[sid], log = loggedHours(), ex = S.excluded[sid] || [];
  const q = [];
  let idx = 0;
  sub.order.forEach(o => {
    const t = sub.byN[o.n];
    if (!t || ex.indexOf(o.n) >= 0) return;
    const st = tstat(sid, o.n);
    if (st === "ok") return;
    const parts = sub.order.filter(x => x.n === o.n).length;
    let h = o.h != null ? o.h : t.h / parts;
    if (st === "bad") h *= 1.6;                          /* не получается — добавляем разбор */
    const spent = (log[taskKey(sid, o.n)] || 0) / parts;
    h = Math.max(h * 0.2, h - spent);
    q.push({
      key: sid + "-" + o.n + "-" + (idx++), n: o.n, task: t, part: o.part || "",
      hours: Math.round(h * 10) / 10, rework: st === "bad", block: t.block
    });
  });
  return q;
}

function probeWeeks(sid) {
  const map = {};
  SUB[sid].probes.forEach(p => {
    const w = weekStart(p.d);
    map[w] = (map[w] || 0) + PROBE_HOURS[p.kind];
    const rw = weekStart(addDays(p.d, 3));
    map[rw] = (map[rw] || 0) + PROBE_HOURS.review;
  });
  return map;
}

function computePlan(sid, opt) {
  opt = opt || {};
  const sub = SUB[sid];
  const queue = buildQueue(sid);
  const capOf = w => weekCapacity(sid, opt.pace, w);
  const pw = probeWeeks(sid);
  const doneCount = sub.tasks.filter(t => tstat(sid, t.n) === "ok").length;
  const reviewShare = doneCount >= 3 ? REVIEW_SHARE : 0;

  const start = weekStart(diffDays(today(), START) > 0 ? START : today());
  const exam = S.exam[sid];
  const weeks = {};
  let qi = 0, left = queue.length ? queue[0].hours : 0;
  let w = start, guard = 0, needHours = 0;
  queue.forEach(s => needHours += s.hours);

  while (qi < queue.length && guard++ < 90) {
    let cap = isBreak(w) ? 0 : capOf(w) * (1 - reviewShare) - (pw[w] || 0);
    if (cap < 0) cap = 0;
    const bucket = [];
    while (cap > 0.01 && qi < queue.length) {
      const take = Math.min(cap, left);
      cap -= take; left -= take;
      bucket.push({ key: queue[qi].key, hours: take });
      if (left <= 0.01) { qi++; left = qi < queue.length ? queue[qi].hours : 0; }
    }
    if (bucket.length) weeks[w] = bucket;
    bucket.forEach(b => { const st = queue.find(s => s.key === b.key); st.endWeek = w; });
    w = addDays(w, 7);
  }
  /* тем, кто не влез в 90 недель, дата не достаётся */
  const finishWeek = queue.length ? queue[queue.length - 1].endWeek : start;
  const finishDate = finishWeek ? addDays(finishWeek, 6) : null;

  /* сколько часов ещё есть до экзамена */
  let av = 0, ww = start;
  while (diffDays(ww, exam) > 0) {
    let c = isBreak(ww) ? 0 : capOf(ww) * (1 - reviewShare) - (pw[ww] || 0);
    av += Math.max(0, c); ww = addDays(ww, 7);
  }

  const deadline = addDays(exam, -10);
  const unplaced = queue.some(st => !st.endWeek);
  const slack = (finishDate && !unplaced) ? diffDays(finishDate, deadline) : -999;
  const deficit = Math.max(0, needHours - av);

  /* месяцы */
  const months = {};
  Object.keys(weeks).sort().forEach(wk => {
    weeks[wk].forEach(b => {
      const st = queue.find(s => s.key === b.key);
      const mk = monthKey(addDays(wk, 3));
      if (!months[mk]) months[mk] = { key: mk, hours: 0, steps: [], carry: [], blocks: [] };
      months[mk].hours += b.hours;
      if (!months[mk].steps.some(x => x.key === st.key)) months[mk].steps.push(st);
      if (months[mk].blocks.indexOf(st.block) < 0) months[mk].blocks.push(st.block);
    });
  });

  Object.keys(months).forEach(mk => {
    const m = months[mk];
    m.carry = m.steps.filter(st => st.endWeek && monthKey(addDays(st.endWeek, 3)) !== mk);
    m.steps = m.steps.filter(st => st.endWeek && monthKey(addDays(st.endWeek, 3)) === mk);
  });

  return {
    sid, queue, weeks, months, finishWeek, finishDate,
    needHours, availHours: av, deficit, slack,
    capacity: weekCapacity(sid, opt.pace), reviewShare,
    status: slack >= 0 ? (av - needHours < needHours * 0.08 ? "tight" : "ok") : "late"
  };
}

function recompute() {
  PLAN = {};
  SUBJECTS.forEach(s => {
    const p = pace(s.id);
    PLAN[s.id] = computePlan(s.id, {});
    PLAN[s.id].factPlan = p == null ? null : computePlan(s.id, { pace: p });
    PLAN[s.id].pace = p;
  });
}

/* первичный балл, который уже «в кармане», и потолок при текущем плане */
function primaryNow(sid) {
  return SUB[sid].tasks.reduce((a, t) => a + (tstat(sid, t.n) === "ok" ? t.p : 0), 0);
}
function primaryCeil(sid) {
  const ex = S.excluded[sid] || [];
  return SUB[sid].tasks.reduce((a, t) => a + (ex.indexOf(t.n) >= 0 ? 0 : t.p), 0);
}
function primaryBy(sid, date) {
  const p = PLAN[sid]; let sum = primaryNow(sid); const seen = {};
  p.queue.forEach(st => {
    if (!st.endWeek) return;
    if (diffDays(addDays(st.endWeek, 6), date) < 0) return;
    if (seen[st.n]) return;
    /* задание засчитываем, только если все его части успевают */
    const parts = p.queue.filter(x => x.n === st.n);
    if (parts.every(x => x.endWeek && diffDays(addDays(x.endWeek, 6), date) >= 0)) {
      seen[st.n] = 1; sum += st.task.p;
    }
  });
  return sum;
}
function tasksBy(sid, date) {
  const p = PLAN[sid], out = [];
  SUB[sid].tasks.forEach(t => {
    if ((S.excluded[sid] || []).indexOf(t.n) >= 0) return;
    if (tstat(sid, t.n) === "ok") { out.push(t.n); return; }
    const parts = p.queue.filter(x => x.n === t.n);
    if (parts.length && parts.every(x => x.endWeek && diffDays(addDays(x.endWeek, 6), date) >= 0)) out.push(t.n);
  });
  return out;
}

/* ─────────────────────────── неделя занятий ─────────────────────────── */

function sessionsOn(date) {
  return Object.values(S.sessions).filter(s => !s.del && s.date === date)
    .sort((a, b) => (a.ord || 0) - (b.ord || 0) || (a.subj > b.subj ? 1 : -1));
}
function sessionsInWeek(ws) {
  return Object.values(S.sessions).filter(s => !s.del && diffDays(ws, s.date) >= 0 && diffDays(s.date, addDays(ws, 6)) >= 0);
}

function stepTitle(st) {
  return st.task.name + (st.part ? " · " + st.part : "");
}

/* Раскладываем неделю: создаём недостающие занятия и обновляем содержание невыполненных. */
function syncWeek(ws, create) {
  if (isParent()) return;
  const fresh = !S.gen[ws];
  if (fresh && !create) return;
  let changed = false;

  SUBJECTS.forEach(sub => {
    const sid = sub.id, r = S.rhythm[sid];
    const mine = sessionsInWeek(ws).filter(s => s.subj === sid);
    const probes = sub.probes.filter(p => weekStart(p.d) === ws);
    const reviews = sub.probes.filter(p => weekStart(addDays(p.d, 3)) === ws);

    if (fresh) {
      /* пробники и разбор */
      probes.forEach(p => {
        if (diffDays(START, p.d) < 0) return;
        addSession({
          date: p.d, subj: sid, kind: "probe", probe: p.kind,
          plan: Math.round(PROBE_HOURS[p.kind] * 60),
          title: p.kind === "full" ? "Пробник целиком" : "Пробник: часть 1",
          sub: "на время, как на экзамене", ord: 0
        }, true);
      });
      reviews.forEach(p => {
        addSession({
          date: addDays(p.d, 3), subj: sid, kind: "review",
          plan: Math.round(PROBE_HOURS.review * 60),
          title: "Разбор пробника", sub: "отметить, где ошибся", ord: 0
        }, true);
      });
      /* обычные занятия */
      let days = (r.days || []).slice(0, r.perWeek);
      const cut = probes.reduce((a, p) => a + (p.kind === "full" ? 2 : 1), 0) + reviews.length;
      if (cut) days = days.slice(0, Math.max(0, days.length - cut));
      days.forEach((d, i) => {
        const date = addDays(ws, d);
        if (diffDays(START, date) < 0) return;          /* до старта подготовки */
        addSession({ date, subj: sid, kind: "self", plan: r.minutes || 60, ord: i + 1 }, true);
      });
      if (r.tutor && r.tutorDay != null && !probes.length && diffDays(START, addDays(ws, r.tutorDay)) >= 0) {
        addSession({ date: addDays(ws, r.tutorDay), subj: sid, kind: "tutor", plan: r.tutorMin || 90, ord: 9 }, true);
      }
      changed = true;
    }

    /* содержание: чем заниматься (прошлые недели не переписываем) */
    if (diffDays(weekStart(today()), ws) < 0) return;
    const buckets = (PLAN[sid].weeks[ws] || []);
    const steps = buckets.map(b => PLAN[sid].queue.find(q => q.key === b.key)).filter(Boolean);
    const list = sessionsInWeek(ws).filter(s => s.subj === sid && (s.kind === "self" || s.kind === "tutor"))
      .sort((a, b) => diffDays(b.date, a.date) || (a.ord || 0) - (b.ord || 0));
    const doneTasks = sub.tasks.filter(t => tstat(sid, t.n) === "ok").map(t => t.n);
    const wIdx = Math.floor(diffDays("2026-09-07", ws) / 7);
    const wantReview = doneTasks.length >= 3 && list.length > 1 && ((wIdx % 3) === 2);

    list.forEach((s, i) => {
      if (s.done || s.custom) return;
      let title, subt, refs;
      if (!steps.length) {
        if (!doneTasks.length) { title = "Свободное занятие"; subt = "разбор трудных мест"; refs = []; }
        else {
          const start = ((wIdx * list.length + i) * 3) % doneTasks.length;
          refs = [];
          for (let k = 0; k < Math.min(3, doneTasks.length); k++) refs.push(doneTasks[(start + k) % doneTasks.length]);
          title = "Повторение и работа на время";
          subt = "задания " + refs.slice().sort((a, b) => a - b).join(", ");
        }
      } else if (wantReview && i === list.length - 1) {
        const pick = doneTasks.slice(-5);
        title = "Повторение"; subt = pick.length ? "задания " + pick.join(", ") : "пройденное"; refs = [];
      } else {
        const st = steps[Math.min(steps.length - 1, Math.floor(i * steps.length / Math.max(1, list.length - (wantReview ? 1 : 0))))];
        title = stepTitle(st);
        subt = "задание " + st.n + (st.rework ? " · разбор, было «не получается»" : "");
        refs = [st.n];
      }
      if (s.title !== title || s.sub !== subt) { s.title = title; s.sub = subt; s.refs = refs; s.at = now(); changed = true; }
    });
  });

  if (fresh) S.gen[ws] = 1;
  if (changed || fresh) save();
}

function addSession(o, silent) {
  const id = uid();
  S.sessions[id] = Object.assign({ id, fact: null, done: false, refs: [], at: now(), custom: false }, o);
  if (!silent) save();
  return S.sessions[id];
}

/* ─────────────────────────── экран «Занятия» ─────────────────────────── */

function subjChip(sid, extra) {
  const s = SUB[sid];
  return `<span class="chip" style="--c:${s.color}">${esc(s.short)}${extra ? " · " + esc(extra) : ""}</span>`;
}

/* ─────────── главный экран: с чего начать ─────────── */
let showPlan = false;

function renderHome() {
  const row = (sid, n) => {
    const sub = SUB[sid], m = MAP[sid] || {}, t = sub.byN[n];
    if (!t) return "";
    const st = numStat(sid, n), d = m[String(n)];
    const name = (d && d.name) || t.name;
    return `<button class="numrow big" data-act="num" data-n="${n}" data-s="${sid}" style="--c:${sub.color}">
      <span class="nr-n">${n}</span>
      <span class="nr-b"><b>${esc(name)}</b>
        <i>${d ? plural(d.groups.length, "приём", "приёма", "приёмов") + " · " + plural(d.total, "задача", "задачи", "задач")
              : "загружаем…"}</i>
        <span class="nr-bar"><em style="width:${st.total ? st.done / st.total * 100 : 0}%"></em></span></span>
      <span class="nr-p">${st.total ? st.done + "/" + st.total : "—"}</span>
    </button>`;
  };
  let h = `<h4 class="sec first">Сентябрь · физика</h4>
    ${SEPT_FIZ.map(n => row("fiz", n)).join("")}`;
  if (SEPT_MAT.length)
    h += `<h4 class="sec">Сентябрь · математика, база</h4>
    ${SEPT_MAT.map(n => row("mat", n)).join("")}`;
  if (SEPT_MAT2.length)
    h += `<h4 class="sec">Сентябрь · математика, часть 2</h4>
    <p class="foot" style="margin:0 0 10px">Здесь ответ — развёрнутое решение, а не число. Задачи
      разложены по приёмам, к каждой есть официальный разбор.</p>
    ${SEPT_MAT2.map(n => row("mat", n)).join("")}`;
  return h;
}


function renderWeek(inner) {
  const ws = weekCursor, we = addDays(ws, 6);
  syncWeek(ws, diffDays(weekStart(today()), ws) >= 0 && diffDays(ws, addDays(today(), 200)) >= 0);
  const list = sessionsInWeek(ws);
  const planM = list.reduce((a, s) => a + (s.plan || 0), 0);
  const factM = list.reduce((a, s) => a + (s.done ? (s.fact != null ? s.fact : s.plan) : 0), 0);
  const doneN = list.filter(s => s.done).length;
  const isNow = ws === weekStart(today());
  const preStart = diffDays(addDays(ws, 6), START) > 0;

  let h = `<div class="wknav${inner ? " sub" : ""}">
      <button class="ico" id="wprev" aria-label="Предыдущая неделя">‹</button>
      <div class="wktitle"><b>${isNow ? "Эта неделя" : fmtDate(ws) + " — " + fmtDate(we)}</b>
        <span>${isNow ? fmtDate(ws) + " — " + fmtDate(we) : ""}</span></div>
      <button class="ico" id="wnext" aria-label="Следующая неделя">›</button>
    </div>`;

  if (isNow && diffDays(today(), START) > 0)
    h += `<div class="startnote">Подготовка начинается в пятницу ${fmtDate(START)}. До этого — свободно.</div>`;
  h += `<div class="wksum">
      <div><b>${doneN}</b><span>из ${list.length} занятий</span></div>
      <div><b>${fmtMin(factM)}</b><span>из ${fmtMin(planM)}</span></div>
      <div class="bar"><i style="width:${planM ? clamp(factM / planM * 100, 0, 100) : 0}%"></i></div>
    </div>`;

  const problems = SUBJECTS.filter(s => PLAN[s.id].status === "late");
  if (problems.length && isNow) {
    h += `<button class="alert" data-go="track" data-subj="${problems[0].id}">
      <b>Не успеваем: ${problems.map(p => esc(SUB[p.id].short.toLowerCase())).join(", ")}</b>
      <span>Посмотреть, что можно сделать →</span></button>`;
  }

  let gap = [];
  const flush = () => {
    if (!gap.length) return;
    const a = gap[0], b = gap[gap.length - 1];
    h += `<div class="restrow">${DOW[a]}${gap.length > 1 ? " — " + DOW[b] : ""} · ${fmtDate(addDays(ws, a))}${gap.length > 1 ? " — " + fmtDate(addDays(ws, b)) : ""} · свободно</div>`;
    gap = [];
  };
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i), day = sessionsOn(d);
    if (!day.length) { gap.push(i); continue; }
    flush();
    const isToday = d === today();
    h += `<section class="day${isToday ? " today" : ""}">
      <h3><span class="dw">${DOW[i]}</span> ${fmtDate(d)}${isToday ? ' <em>сегодня</em>' : ""}</h3>`;
    day.forEach(s => h += sessionCard(s));
    h += `</section>`;
  }
  flush();
  h += prepLine();
  h += `<button class="add" id="addS">+ Добавить занятие</button>`;
  h += `<p class="foot">Занятия расставляются сами из ритма и траектории. Любое можно перенести, изменить или удалить.</p>`;
  return h;
}

function sessionCard(s) {
  const sub = SUB[s.subj];
  const fact = s.fact != null ? s.fact : s.plan;
  const kindLabel = s.kind === "tutor" ? "с преподавателем" : s.kind === "probe" ? "пробник" : s.kind === "review" ? "разбор" : "";
  return `<article class="ses${s.done ? " done" : ""}${s.kind === "probe" ? " probe" : ""}" data-id="${s.id}" style="--c:${sub.color}">
    <div class="ses-main"${s.refs && s.refs.length === 1 ? ` data-act="task" data-sid="${s.subj}" data-n="${s.refs[0]}"` : ""}>
      <div class="ses-top">${subjChip(s.subj, kindLabel)}<span class="mins">${s.done ? fmtMin(fact) : fmtMin(s.plan)}</span></div>
      <div class="ses-title">${esc(s.title || sub.name)}</div>
      ${s.sub ? `<div class="ses-sub">${esc(s.sub)}</div>` : ""}
      ${s.done && s.fact != null && s.fact !== s.plan ? `<div class="ses-sub dim">план ${fmtMin(s.plan)}</div>` : ""}
      ${!s.done && s.refs && s.refs.length === 1 && !isParent()
        ? `<button class="start" data-act="lesson" data-id="${s.id}">${getLesson(s.subj, s.refs[0]) ? "Продолжить урок" : "Начать урок"} →</button>` : ""}
    </div>
    <div class="ses-act">
      <button class="tick${s.done ? " on" : ""}" data-act="done" data-id="${s.id}" aria-label="Позанимался">${s.done ? "✓" : ""}</button>
      <button class="more" data-act="more" data-id="${s.id}" aria-label="Ещё">⋯</button>
    </div>
  </article>`;
}

/* ─────────────────────────── экран «Траектория обучения» ─────────────────────────── */

const STAT_LABEL = { new: "не начинал", ok: "получается", bad: "не получается" };

function statDot(sid, n) {
  const st = tstat(sid, n);
  return `<button class="st ${st}" data-act="stat" data-sid="${sid}" data-n="${n}">${STAT_LABEL[st]}</button>`;
}

/* что можно сделать, если не успеваем */
function suggestFixes(sid) {
  const p = PLAN[sid], r = S.rhythm[sid], out = [];
  const weeksLeft = Math.max(1, Math.ceil(diffDays(today(), S.exam[sid]) / 7));
  let need = p.needHours - p.availHours;
  if (p.status === "tight") need = Math.max(need, p.needHours * 0.10);
  need = Math.max(0, need);
  const extraPerWeek = need / weeksLeft;
  const extraSessions = Math.ceil(extraPerWeek / ((r.minutes || 60) / 60));
  const newLoad = totalWeeklyLoad() + extraSessions * (r.minutes || 60) / 60;

  if (extraSessions > 0 && newLoad <= LOAD_LIMIT) {
    out.push({
      id: "more", ok: true,
      title: `Добавить ${plural(extraSessions, "занятие", "занятия", "занятий")} в неделю`,
      note: `Станет ${plural(r.perWeek + extraSessions, "занятие", "занятия", "занятий")} в неделю по этому предмету. Общая нагрузка на все предметы — ${fmtH(newLoad)} в неделю.`
    });
  } else if (extraSessions > 0) {
    out.push({
      id: "more", ok: false,
      title: `Уплотнять расписание больше нельзя`,
      note: `Чтобы догнать, пришлось бы заниматься ${fmtH(newLoad)} в неделю сверх школы. Это не сработает — лучше сузить цель.`
    });
  }

  /* сузить цель: убираем самые дорогие задания, пока дефицит не закроется */
  const ex = (S.excluded[sid] || []).slice();
  const cand = p.queue.slice().sort((a, b) => (b.task.lvl === "В") - (a.task.lvl === "В") || b.hours - a.hours);
  const drop = []; let saved = 0;
  for (const st of cand) {
    if (saved >= need || drop.length >= 6) break;      /* сужать бесконечно тоже нельзя */
    if (drop.indexOf(st.n) >= 0) continue;
    drop.push(st.n); saved += p.queue.filter(x => x.n === st.n).reduce((a, x) => a + x.hours, 0);
  }
  if (drop.length) {
    const lost = drop.reduce((a, n) => a + SUB[sid].byN[n].p, 0);
    const enough = saved >= need;
    drop.sort((a, b) => a - b);
    out.push({
      id: "narrow", ok: enough, drop,
      title: enough
        ? `Сузить цель: отложить ${plural(drop.length, "задание", "задания", "заданий")}`
        : `Одним сужением цели не обойтись`,
      note: enough
        ? `№ ${drop.join(", ")} — самые тяжёлые. Потолок станет ${primaryCeil(sid) - lost} из ${SUB[sid].maxPrimary} первичных, зато остальное будет сделано спокойно.`
        : `Даже если отложить № ${drop.join(", ")}, не хватает ещё ${fmtH(need - saved)}. Тут придётся менять весь расклад: пересобрать ритм по всем предметам и решить, на какой балл реально идти.`
    });
  }
  if (!r.tutor) {
    out.push({ id: "tutor", ok: true, title: "Добавить занятие с преподавателем", note: "Разбор с человеком дешевле по времени, чем самому биться о трудную тему." });
  }
  return out;
}

function trackHeader(sid) {
  const p = PLAN[sid], sub = SUB[sid];
  const dleft = diffDays(today(), S.exam[sid]);
  const done = sub.tasks.filter(t => tstat(sid, t.n) === "ok").length;
  const total = sub.tasks.length - (S.excluded[sid] || []).length;
  const pc = primaryCeil(sid), pn = primaryNow(sid);

  const word = { ok: "Идём с запасом", tight: "Идём впритык", late: "Не успеваем" }[p.status];
  const note = p.status === "late"
    ? `При нынешнем ритме программа закончится ${p.finishDate && p.slack > -900 ? fmtDateY(p.finishDate) + " — на " + plural(-p.slack, "день", "дня", "дней") + " позже срока" : "уже после экзамена"}. Не хватает ${fmtH(Math.max(0.5, p.needHours - p.availHours))}.`
    : p.status === "tight"
      ? `Программа закрывается ${fmtDateY(p.finishDate)} — почти впритык. Любая пропущенная неделя будет заметна.`
      : `Программа закрывается ${fmtDateY(p.finishDate)} — до экзамена останется ${plural(Math.max(0, p.slack), "день", "дня", "дней")} на повторение.`;

  let h = `<div class="track-head" style="--c:${sub.color}">
    <div class="th-row">
      <div><div class="th-k">До экзамена</div><div class="th-v">${plural(dleft, "день", "дня", "дней")}</div>
        <div class="th-s">${fmtDate(S.exam[sid])} · ориентир</div></div>
      <div><div class="th-k">Освоено</div><div class="th-v">${done} <i>из ${total}</i></div>
        <div class="th-s">заданий</div></div>
      <div><div class="th-k">Первичный балл</div><div class="th-v">${pn} <i>из ${pc}</i></div>
        <div class="th-s">${pc < sub.maxPrimary ? "цель сужена с " + sub.maxPrimary : "максимум за работу"}</div></div>
    </div>
    <div class="verdict ${p.status}"><b>${word}</b><span>${note}</span></div>`;

  if (p.pace != null && p.factPlan) {
    const fp = p.factPlan;
    h += `<div class="pacebox ${fp.status}">
      <b>По факту занимаешься на ${Math.round(p.pace * 100)}% от плана.</b>
      <span>Если так пойдёт дальше — программа закроется ${fp.finishDate ? fmtDateY(fp.finishDate) : "не успеет закрыться"}${fp.status === "late" ? ", это после экзамена" : ""}.</span></div>`;
  }
  h += `</div>`;

  if (p.status !== "ok") {
    const fixes = suggestFixes(sid);
    h += `<div class="fixes"><h4>Что можно сделать</h4>`;
    fixes.forEach(f => h += `<button class="fix${f.ok ? "" : " no"}" data-act="fix" data-sid="${sid}" data-fix="${f.id}"
        data-drop="${(f.drop || []).join(",")}"><b>${esc(f.title)}</b><span>${esc(f.note)}</span></button>`);
    h += `</div>`;
  }
  return h;
}

function renderTrack() {
  const sid = trackSubj, sub = SUB[sid], p = PLAN[sid];
  let h = `<div class="subjbar">` + SUBJECTS.map(s =>
    `<button class="sb${s.id === sid ? " on" : ""}" data-act="subj" data-sid="${s.id}" style="--c:${s.color}">
       ${esc(s.short)}${PLAN[s.id].status === "late" ? '<i class="warn">!</i>' : ""}</button>`).join("") + `</div>`;

  h += trackHeader(sid);

  if (sub.path) {
    h += `<h4 class="sec">Путь предмета</h4>
      <div class="card pathc" style="--c:${sub.color}">
        <div class="pth">${esc(sub.path)}</div>
        <p>${esc(sub.why)}</p>
      </div>`;
  }

  /* большие ориентиры */
  h += `<h4 class="sec">Большие ориентиры</h4><div class="miles">`;
  MILESTONES.forEach(m => {
    const list = tasksBy(sid, m.date), pb = primaryBy(sid, m.date);
    const total = sub.tasks.length - (S.excluded[sid] || []).length;
    const past = diffDays(m.date, today()) > 0;
    const left = total - list.length;
    const note = left === 0
      ? "программа пройдена — дальше только скорость и повторение"
      : `останется ${plural(left, "задание", "задания", "заданий")}` + (m.id === "may" ? " — их к экзамену уже не успеть" : "");
    h += `<div class="mile${past ? " past" : ""}${left && m.id !== "dec" ? " miss" : ""}">
      <div class="m-t">${esc(m.title)}</div>
      <div class="m-d">${fmtDateY(m.date)}</div>
      <div class="m-s"><b>${plural(list.length, "задание", "задания", "заданий")} из ${total}</b> · ${pb} из ${sub.maxPrimary} первичных<br>${esc(note)}</div>
    </div>`;
  });
  h += `</div>`;

  /* помесячные цели */
  h += `<h4 class="sec">Цели по месяцам</h4>`;
  const keys = Object.keys(p.months).sort();
  if (!keys.length) h += `<p class="rest">Вся программа отмечена как освоенная. Осталось повторение и пробники.</p>`;
  keys.forEach(k => {
    const m = p.months[k];
    const uniq = [];
    m.steps.forEach(st => { if (!uniq.some(x => x.n === st.n)) uniq.push(st); });
    const mDone = uniq.filter(st => tstat(sid, st.n) === "ok").length;
    const probes = sub.probes.filter(pr => monthKey(pr.d) === k);
    const after = k > monthKey(S.exam[sid]);
    h += `<section class="month${after ? " after" : ""}">
      <header><div><b>${monthTitle(k)}${after ? " — уже после экзамена" : ""}</b><span>${esc(m.blocks.join(" · "))}</span></div>
        <div class="mh">${fmtH(m.hours)}</div></header>
      <div class="tasks">`;
    uniq.forEach(st => {
      const st2 = tstat(sid, st.n);
      h += `<div class="task ${st2}">
        <span class="num">${st.n}</span>
        <span class="tn" data-act="task" data-sid="${sid}" data-n="${st.n}">${esc(stepTitle(st))}<i>${st.task.lvl === "В" ? "высокий уровень · " : st.task.lvl === "П" ? "повышенный · " : ""}${plural(st.task.p, "балл", "балла", "баллов")} · до ${fmtDate(addDays(st.endWeek || today(), 6))}</i></span>
        ${statDot(sid, st.n)}</div>`;
    });
    m.carry.forEach(st => h += `<div class="task carry">
      <span class="num">→</span>
      <span class="tn" data-act="task" data-sid="${sid}" data-n="${st.n}">${esc(stepTitle(st))}<i>задание ${st.n} · закончим ${st.endWeek ? monthIn(monthKey(addDays(st.endWeek, 3))) : "позже"}</i></span></div>`);
    probes.forEach(pr => h += `<div class="task probe"><span class="num">П</span>
      <span class="tn">${pr.kind === "full" ? "Пробник целиком" : "Пробник: часть 1"}<i>${fmtDate(pr.d)}</i></span>
      <button class="st mock" data-act="mock" data-sid="${sid}" data-d="${pr.d}">внести результат</button></div>`);
    h += `</div></section>`;
  });

  /* месяцы после того, как программа пройдена */
  const lastM = keys.length ? keys[keys.length - 1] : monthKey(today());
  const d0 = parse(lastM + "-01"); d0.setMonth(d0.getMonth() + 1);
  let cur = monthKey(iso(d0));
  const examM = monthKey(S.exam[sid]);
  let guard = 0;
  while (cur <= examM && guard++ < 12) {
    const probes = sub.probes.filter(pr => monthKey(pr.d) === cur);
    h += `<section class="month rev">
      <header><div><b>${monthTitle(cur)}</b><span>повторение, задачи на время, пробники</span></div></header>
      <div class="tasks">
        <div class="task"><span class="num">↻</span><span class="tn">Прогон всех заданий по кругу<i>программа к этому времени пройдена</i></span></div>
        ${probes.map(pr => `<div class="task probe"><span class="num">П</span>
          <span class="tn">${pr.kind === "full" ? "Пробник целиком" : "Пробник: часть 1"}<i>${fmtDate(pr.d)}</i></span>
          <button class="st mock" data-act="mock" data-sid="${sid}" data-d="${pr.d}">внести результат</button></div>`).join("")}
      </div></section>`;
    const d = parse(cur + "-01"); d.setMonth(d.getMonth() + 1); cur = monthKey(iso(d));
  }

  h += `<button class="add" data-act="all" data-sid="${sid}">Все задания предмета · отметить, что уже знаю</button>`;
  h += `<p class="foot">Задания и баллы — из проектов демоверсий ФИПИ на 2027 год.
    Отметка «не получается» добавляет разбор и повторение и сдвигает даты только этого предмета.</p>`;
  return h;
}

/* карточка одного задания: что проверяют и где это взять */
function sheetTask(sid, n) {
  const sub = SUB[sid], t = sub.byN[n]; if (!t) return;
  const pr = PRACTICE[sid];
  const q = encodeURIComponent(pr.q + " задание " + n + " " + t.name);
  const lvl = { "Б": "базовый уровень", "П": "повышенный уровень", "В": "высокий уровень" }[t.lvl];
  const st = tstat(sid, n);
  openSheet(`<h3>Задание ${n} · ${esc(t.name)}</h3>
    <p class="sh-sub">${esc(sub.name)} · ${esc(lvl)} · ${plural(t.p, "балл", "балла", "баллов")} · раздел «${esc(t.block)}»</p>
    <div class="offic"><span>Что проверяют — формулировка ФИПИ</span>${esc(t.full || t.name)}</div>
    <div class="lab">Как идёт</div>
    <div class="stat-row">${["ok", "bad", "new"].map(k =>
      `<button class="st ${k}${st === k ? " cur" : ""}" data-act="stat" data-st="${k}" data-sid="${sid}" data-n="${n}">${STAT_LABEL[k]}</button>`).join("")}</div>
    <div class="lab">Где тренироваться</div>
    <div class="links">
      <a href="${pr.bank}" target="_blank" rel="noopener">Открытый банк заданий ФИПИ — официальные задания</a>
      <a href="${pr.cat}" target="_blank" rel="noopener">Решу ЕГЭ — каталог заданий по номерам</a>
      <a href="https://ya.ru/search/?text=${q}" target="_blank" rel="noopener">Найти разбор задания ${n}</a>
    </div>
    <p class="sh-foot">В каталоге «Решу ЕГЭ» нумерация обновляется под текущий год: если номер не сходится, ищи по названию темы — она указана выше.</p>`);
}

/* полный список заданий предмета */
function allTasksSheet(sid) {
  const sub = SUB[sid], ex = S.excluded[sid] || [];
  let h = `<h3>${esc(sub.name)}</h3>
    <p class="sh-sub">${sub.tasksTotal} заданий · ${sub.maxPrimary} первичных баллов · ${fmtMin(sub.examMinutes)} на экзамене.
    Отметь всё, что уже знакомо, — оно уйдёт из плана, но останется в повторении.</p><div class="alltasks">`;
  let block = "";
  sub.tasks.forEach(t => {
    if (t.block !== block) { block = t.block; h += `<div class="ab">${esc(block)}</div>`; }
    const off = ex.indexOf(t.n) >= 0;
    h += `<div class="task ${tstat(sid, t.n)}${off ? " off" : ""}">
      <span class="num">${t.n}</span>
      <span class="tn" data-act="task" data-sid="${sid}" data-n="${t.n}">${esc(t.name)}<i>${t.lvl === "В" ? "высокий · " : t.lvl === "П" ? "повышенный · " : "базовый · "}${plural(t.p, "балл", "балла", "баллов")}${off ? " · отложено" : ""}</i></span>
      ${statDot(sid, t.n)}
      <button class="skip" data-act="excl" data-sid="${sid}" data-n="${t.n}" title="Убрать из плана">${off ? "↩" : "×"}</button>
    </div>`;
  });
  h += `</div><p class="sh-foot">Крестик убирает задание из плана — так сужают цель, когда времени не хватает.</p>`;
  return h;
}

/* ─────────────────────────── экран «Динамика» ─────────────────────────── */

function weekStats(n) {
  const out = [];
  const cur = weekStart(today());
  const dates = Object.values(S.sessions).filter(x => !x.del).map(x => weekStart(x.date)).sort();
  const first = dates.length ? dates[0] : cur;
  const back = clamp(Math.round(diffDays(first, cur) / 7), 0, n - 1);
  for (let i = back; i >= 0; i--) {
    const w = addDays(cur, -7 * i);
    const list = sessionsInWeek(w);
    out.push({
      w,
      plan: list.reduce((a, s) => a + (s.plan || 0), 0),
      fact: list.reduce((a, s) => a + (s.done ? (s.fact != null ? s.fact : s.plan) : 0), 0),
      done: list.filter(s => s.done).length, total: list.length
    });
  }
  return out;
}

function streakWeeks() {
  const w = weekStats(20); let n = 0;
  for (let i = w.length - 2; i >= 0; i--) {          /* текущую неделю не считаем — она не закончилась */
    if (w[i].plan && w[i].fact / w[i].plan >= 0.7) n++; else break;
  }
  return n;
}

function barChart(data) {
  const max = Math.max(60, ...data.map(d => Math.max(d.plan, d.fact)));
  const W = 320, H = 90, bw = W / data.length;
  let sv = `<svg viewBox="0 0 ${W} ${H + 18}" class="chart" role="img" aria-label="Часы занятий по неделям">`;
  data.forEach((d, i) => {
    const x = i * bw + 2, w = bw - 4;
    const hp = d.plan / max * H, hf = d.fact / max * H;
    sv += `<rect x="${x}" y="${H - hp}" width="${w}" height="${hp}" rx="2" class="bp"/>`;
    sv += `<rect x="${x}" y="${H - hf}" width="${w}" height="${hf}" rx="2" class="bf"/>`;
    if (i % 2 === 0 || i === data.length - 1)
      sv += `<text x="${x + w / 2}" y="${H + 13}" class="lb">${parse(d.w).getDate()}.${parse(d.w).getMonth() + 1}</text>`;
  });
  return sv + `</svg>`;
}

function mockChart() {
  const all = Object.values(S.mocks).filter(m => !m.del).sort((a, b) => diffDays(b.date, a.date));
  if (all.length < 1) return "";
  const W = 320, H = 110, pad = 16;
  const t0 = parse(all[0].date).getTime(), t1 = parse(all[all.length - 1].date).getTime();
  const span = Math.max(1, t1 - t0);
  let sv = `<svg viewBox="0 0 ${W} ${H + 16}" class="chart line" role="img" aria-label="Баллы пробников">`;
  [0, 25, 50, 75, 100].forEach(p => {
    const y = pad + (100 - p) / 100 * (H - pad * 2);
    sv += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" class="grid"/>`;
  });
  SUBJECTS.forEach(sub => {
    const ms = all.filter(m => m.subj === sub.id);
    if (!ms.length) return;
    const pts = ms.map(m => {
      const x = pad + (parse(m.date).getTime() - t0) / span * (W - pad * 2);
      const pct = clamp((m.primary || 0) / sub.maxPrimary * 100, 0, 100);
      return [x, pad + (100 - pct) / 100 * (H - pad * 2), m];
    });
    if (pts.length > 1) sv += `<polyline points="${pts.map(p => p[0] + "," + p[1]).join(" ")}" fill="none" stroke="${sub.color}" stroke-width="2"/>`;
    pts.forEach(p => {
      sv += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${sub.color}"/>`;
      sv += `<text x="${p[0]}" y="${p[1] - 8}" class="pt" fill="${sub.color}">${p[2].primary}</text>`;
    });
  });
  return sv + `</svg>`;
}

function renderStats() {
  const w10 = weekStats(10);
  const totalFact = Object.values(S.sessions).reduce((a, s) => a + (!s.del && s.done ? (s.fact != null ? s.fact : s.plan) : 0), 0);
  const st = streakWeeks();
  const last = w10[w10.length - 2];
  const mocks = Object.values(S.mocks).filter(m => !m.del).sort((a, b) => diffDays(a.date, b.date));

  let h = `<h4 class="sec first">Сколько занимался</h4>
  <div class="card">
    <div class="kpi">
      <div><b>${fmtMin(totalFact)}</b><span>всего за подготовку</span></div>
      <div><b>${st ? plural(st, "неделя", "недели", "недель") : "—"}</b><span>подряд по плану</span></div>
      <div><b>${last && last.plan ? Math.round(last.fact / last.plan * 100) + "%" : "—"}</b><span>прошлая неделя</span></div>
    </div>
    ${w10.length >= 3
      ? barChart(w10) + `<div class="legend"><i class="lp"></i>план <i class="lf"></i>факт · ${plural(w10.length, "неделя", "недели", "недель")}</div>`
      : `<p class="rest">График появится, когда наберётся три недели занятий.</p>`}
  </div>`;

  h += `<h4 class="sec">Что получается</h4>`;
  SUBJECTS.forEach(sub => {
    const sid = sub.id, p = PLAN[sid];
    const ok = sub.tasks.filter(t => tstat(sid, t.n) === "ok").length;
    const bad = sub.tasks.filter(t => tstat(sid, t.n) === "bad").length;
    const off = (S.excluded[sid] || []).length;
    const tot = sub.tasks.length - off;
    const okRecent = sub.tasks.filter(t => { const r = S.tasks[taskKey(sid, t.n)]; return r && r.st === "ok" && now() - r.at < 28 * 864e5; }).length;
    h += `<div class="card sc" style="--c:${sub.color}">
      <div class="sc-head"><b>${esc(sub.name)}</b><span class="v ${p.status}">${{ ok: "с запасом", tight: "впритык", late: "не успеваем" }[p.status]}</span></div>
      <div class="pbar"><i class="ok" style="width:${tot ? ok / tot * 100 : 0}%"></i><i class="bad" style="width:${tot ? bad / tot * 100 : 0}%"></i></div>
      <div class="sc-row">
        <span><b>${ok}</b> получается</span>
        <span><b>${bad}</b> не получается</span>
        <span><b>${tot - ok - bad}</b> впереди</span>
      </div>
      <div class="sc-foot">Первичный балл ${primaryNow(sid)} из ${primaryCeil(sid)}${okRecent ? ` · за месяц +${okRecent}` : ""}</div>
    </div>`;
  });

  h += `<h4 class="sec">Пробники</h4><div class="card">`;
  if (!mocks.length) {
    h += `<p class="rest">Пробников ещё не было. Первый — ${fmtDateY(SUB.rus.probes[0].d)}, часть 1 по русскому.</p>`;
  } else {
    h += mockChart();
    h += `<div class="mocks">` + mocks.slice().reverse().map(m => {
      const sub = SUB[m.subj], errs = (m.wrong || []).concat(m.missed || []);
      return `<div class="mk" style="--c:${sub.color}">
        <div class="mk-h"><b>${esc(sub.short)}</b><span>${fmtDate(m.date)}</span>
          <em>${m.primary} из ${sub.maxPrimary}${m.secondary ? " · " + m.secondary + " тестовых" : ""}</em></div>
        ${errs.length ? `<div class="mk-e">ошибки: ${errs.sort((a, b) => a - b).join(", ")}</div>` : `<div class="mk-e ok">без ошибок</div>`}
      </div>`;
    }).join("") + `</div>`;
  }
  h += `</div>`;
  if (!isParent()) h += `<button class="add" data-act="mock">+ Внести результат пробника</button>`;
  h += `<p class="foot">Слева — сколько времени потрачено, справа — что из этого получилось.
    Часы сами по себе ничего не значат: смотреть надо на освоенные задания и баллы пробников.</p>`;
  return h;
}

/* ─────────────────────────── пересборка расписания под цель ─────────────────────────── */
/* Программу закрываем к этой дате, дальше — только повторение и пробники */
const PROGRAM_END = "2027-04-12";

function weeksTo(target) {
  let n = 0, w = weekStart(diffDays(today(), START) > 0 ? START : today());
  while (diffDays(w, target) > 0) { if (!isBreak(w)) n++; w = addDays(w, 7); }
  return Math.max(1, n);
}

function rebalance(target) {
  target = target || PROGRAM_END;
  const weeks = weeksTo(target);
  const out = [];
  SUBJECTS.forEach(sub => {
    const sid = sub.id, r = S.rhythm[sid], was = r.perWeek;
    const need = computePlan(sid, {}).needHours;
    /* подбираем минимальное число занятий, при котором программа реально закрывается к цели */
    let best = 6;
    for (let n = 1; n <= 6; n++) {
      r.perWeek = n; r.days = spreadDays(n, sid);
      const p = computePlan(sid, {});
      if (p.finishDate && diffDays(p.finishDate, target) >= 0) { best = n; break; }
    }
    r.perWeek = was; r.days = spreadDays(was, sid);      /* возвращаем как было */
    out.push({ sid, was, now: best, hours: best * (r.minutes || 60) / 60, need, weeks });
  });
  return out;
}

function applyRebalance(plan) {
  plan.forEach(x => {
    const r = S.rhythm[x.sid];
    r.perWeek = x.now;
    r.days = spreadDays(x.now, x.sid);
  });
  S.setAt = now(); save(); recompute(); regenFuture(); recompute();
}

function sheetRebalance() {
  const plan = rebalance();
  const load = plan.reduce((a, x) => a + x.hours, 0);
  const over = load > LOAD_LIMIT;
  const restWeeks = Math.max(0, Math.round(diffDays(PROGRAM_END, S.exam.fiz) / 7));
  openSheet(`<h3>Пересобрать расписание</h3>
    <p class="sh-sub">Считаю так, чтобы вся программа по каждому предмету закрылась
      к ${fmtDateY(PROGRAM_END)}, а дальше остались недели только на повторение и пробники.</p>
    <div class="rebal">${plan.map(x => `<div class="rb" style="--c:${SUB[x.sid].color}">
        <b>${esc(SUB[x.sid].short)}</b>
        <span>${x.was === x.now ? "остаётся " : x.was + " → "}<i>${plural(x.now, "занятие", "занятия", "занятий")}</i> в неделю по ${S.rhythm[x.sid].minutes} мин</span>
        <em>нужно ${fmtH(x.need)} за ${plural(x.weeks, "неделю", "недели", "недель")}</em>
      </div>`).join("")}</div>
    <div class="totalline ${over ? "bad" : ""}">Всего <b>${fmtH(load)}</b> в неделю сверх школы${over
      ? `. Это больше разумного предела ${LOAD_LIMIT} часов — так план не выполнится. Лучше сузить цель по самому тяжёлому предмету.`
      : `. Плюс ${plural(restWeeks, "неделя", "недели", "недель")} до экзаменов на повторение.`}</div>
    ${over ? "" : `<button class="primary" id="rbOk">Пересобрать</button>`}
    <p class="sh-foot">Пересобираются только будущие недели. Выполненные занятия и отметки остаются как есть.</p>`,
    el => {
      const b = $("#rbOk", el);
      if (b) b.onclick = () => {
        applyRebalance(plan);
        weekCursor = weekStart(diffDays(today(), START) > 0 ? START : today());
        closeSheet(); render(); toast("Расписание пересобрано");
      };
    });
}

/* ─────────────────────────── шторки ─────────────────────────── */
let sheetMount = null;
function openSheet(html, mount) {
  const el = $("#sheet");
  el.innerHTML = `<div class="sh-back"></div><div class="sh-body"><button class="sh-x">×</button>${html}</div>`;
  el.classList.add("on");
  sheetMount = mount || null;
  if (mount) mount(el);
  $(".sh-back", el).onclick = closeSheet;
  $(".sh-x", el).onclick = closeSheet;
}
function closeSheet() { const el = $("#sheet"); el.classList.remove("on"); el.innerHTML = ""; sheetMount = null; }

function toast(t) {
  let el = $("#toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
  el.textContent = t; el.classList.add("on");
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), 2200);
}

function sheetDone(id) {
  const s = S.sessions[id]; if (!s) return;
  const sub = SUB[s.subj];
  const opts = [30, 45, 60, 90, 120];
  openSheet(`<h3>${esc(s.title || sub.name)}</h3>
    <p class="sh-sub">${esc(sub.name)} · по плану ${fmtMin(s.plan)} · ${fmtDateY(s.date)}</p>
    <div class="lab">Сколько занимался на самом деле</div>
    <div class="mins-row">${opts.map(o => `<button class="mch${o === s.plan ? " on" : ""}" data-m="${o}">${o}</button>`).join("")}
      <input type="number" id="mFree" min="5" max="360" step="5" value="${s.plan}" inputmode="numeric"></div>
    <div class="lab">Заметка — необязательно</div>
    <input type="text" id="mNote" placeholder="что успел, где застрял" value="${esc(s.note || "")}">
    <button class="primary" id="mOk">Позанимался</button>
    ${s.refs && s.refs.length ? `<div class="lab">Как это задание?</div>
      <div class="stat-row">${["ok", "bad", "new"].map(k => `<button class="st ${k}" data-act="stat" data-st="${k}" data-sid="${s.subj}" data-n="${s.refs[0]}">${STAT_LABEL[k]}</button>`).join("")}</div>` : ""}`,
    el => {
      const free = $("#mFree", el);
      $$(".mch", el).forEach(b => b.onclick = () => { free.value = b.dataset.m; $$(".mch", el).forEach(x => x.classList.remove("on")); b.classList.add("on"); });
      $("#mOk", el).onclick = () => {
        s.fact = clamp(parseInt(free.value, 10) || s.plan, 1, 600);
        s.note = $("#mNote", el).value.trim(); s.done = true; s.at = now();
        save(); recompute(); closeSheet(); render(); toast("Отмечено");
      };
    });
}

function sheetMore(id) {
  const s = S.sessions[id]; if (!s) return;
  const sub = SUB[s.subj];
  openSheet(`<h3>${esc(s.title || sub.name)}</h3>
    <p class="sh-sub">${esc(sub.name)} · ${DOW_FULL[dow(s.date)]}, ${fmtDateY(s.date)}</p>
    <div class="lab">Перенести на другой день</div>
    <input type="date" id="eDate" value="${s.date}">
    <div class="lab">Длительность, минут</div>
    <input type="number" id="eMin" min="5" max="360" step="5" value="${s.plan}" inputmode="numeric">
    <div class="lab">Чем заниматься</div>
    <input type="text" id="eTitle" value="${esc(s.title || "")}">
    <button class="primary" id="eOk">Сохранить</button>
    <button class="ghost danger" id="eDel">Удалить занятие</button>`,
    el => {
      $("#eOk", el).onclick = () => {
        const d = $("#eDate", el).value;
        if (d && d !== s.date) { s.date = d; S.gen[weekStart(d)] = 1; }
        s.plan = clamp(parseInt($("#eMin", el).value, 10) || s.plan, 5, 360);
        const t = $("#eTitle", el).value.trim();
        if (t && t !== s.title) { s.title = t; s.custom = true; }
        s.at = now(); save(); recompute(); closeSheet(); render(); toast("Сохранено");
      };
      $("#eDel", el).onclick = () => { s.del = true; s.at = now(); save(); closeSheet(); render(); toast("Удалено"); };
    });
}

function sheetAdd() {
  const d = today();
  openSheet(`<h3>Новое занятие</h3>
    <div class="lab">Предмет</div>
    <div class="pick" id="aSubj">${SUBJECTS.map((s, i) => `<button class="pk${i === 0 ? " on" : ""}" data-v="${s.id}" style="--c:${s.color}">${esc(s.short)}</button>`).join("")}</div>
    <div class="lab">День</div><input type="date" id="aDate" value="${d}">
    <div class="lab">Длительность, минут</div><input type="number" id="aMin" value="60" min="5" max="360" step="5" inputmode="numeric">
    <div class="lab">Вид</div>
    <div class="pick" id="aKind">
      <button class="pk on" data-v="self">сам</button>
      <button class="pk" data-v="tutor">с преподавателем</button>
      <button class="pk" data-v="probe">пробник</button></div>
    <div class="lab">Чем заниматься — необязательно</div><input type="text" id="aTitle" placeholder="например: разбор задания 13">
    <button class="primary" id="aOk">Добавить</button>`,
    el => {
      const pick = g => $(".pk.on", $("#" + g, el)).dataset.v;
      $$(".pick", el).forEach(p => $$(".pk", p).forEach(b => b.onclick = () => {
        $$(".pk", p).forEach(x => x.classList.remove("on")); b.classList.add("on");
      }));
      $("#aOk", el).onclick = () => {
        const sid = pick("aSubj"), date = $("#aDate", el).value || today();
        addSession({
          date, subj: sid, kind: pick("aKind"),
          plan: clamp(parseInt($("#aMin", el).value, 10) || 60, 5, 360),
          title: $("#aTitle", el).value.trim() || SUB[sid].name, custom: true, ord: 5
        });
        S.gen[weekStart(date)] = 1; save();
        weekCursor = weekStart(date); closeSheet(); render(); toast("Добавлено");
      };
    });
}

function sheetMock(sid, date) {
  sid = sid || trackSubj;
  const sub = SUB[sid];
  const grid = n => Array.from({ length: n }, (_, i) => i + 1);
  openSheet(`<h3>Пробник · ${esc(sub.name)}</h3>
    <p class="sh-sub">Максимум ${sub.maxPrimary} первичных баллов.</p>
    <div class="pick" id="kSubj">${SUBJECTS.map(s => `<button class="pk${s.id === sid ? " on" : ""}" data-v="${s.id}" style="--c:${s.color}">${esc(s.short)}</button>`).join("")}</div>
    <div class="lab">Дата</div><input type="date" id="kDate" value="${date || today()}">
    <div class="two"><div><div class="lab">Первичный балл</div><input type="number" id="kP" min="0" max="${sub.maxPrimary}" inputmode="numeric" placeholder="0"></div>
      <div><div class="lab">Тестовый — если знаешь</div><input type="number" id="kS" min="0" max="100" inputmode="numeric" placeholder="—"></div></div>
    <div class="lab">Отметь задания: одно нажатие — ошибся, второе — не успел</div>
    <div class="numgrid" id="kGrid">${grid(sub.tasksTotal).map(n => `<button class="ng" data-n="${n}">${n}</button>`).join("")}</div>
    <button class="primary" id="kOk">Сохранить пробник</button>
    <p class="sh-foot">Ошибки в уже освоенных заданиях вернут их в план с разбором.
    Задания, которые числились как «не получается», а в пробнике вышли — станут «получается».</p>`,
    el => {
      const state = {};
      $$(".pk", $("#kSubj", el)).forEach(b => b.onclick = () => { closeSheet(); sheetMock(b.dataset.v, date); });
      $$(".ng", el).forEach(b => b.onclick = () => {
        const n = +b.dataset.n;
        state[n] = state[n] === "w" ? "m" : state[n] === "m" ? null : "w";
        b.className = "ng" + (state[n] ? " " + state[n] : "");
      });
      $("#kOk", el).onclick = () => {
        const id = uid(), d = $("#kDate", el).value || today();
        const wrong = Object.keys(state).filter(n => state[n] === "w").map(Number);
        const missed = Object.keys(state).filter(n => state[n] === "m").map(Number);
        S.mocks[id] = {
          id, subj: sid, date: d, primary: clamp(parseInt($("#kP", el).value, 10) || 0, 0, sub.maxPrimary),
          secondary: parseInt($("#kS", el).value, 10) || null, wrong, missed, at: now()
        };
        const bad = wrong.concat(missed), back = [], up = [];
        sub.tasks.forEach(t => {
          const st = tstat(sid, t.n);
          if (bad.indexOf(t.n) >= 0) { if (st === "ok") { setStatQuiet(sid, t.n, "bad"); back.push(t.n); } }
          else if (st === "bad") { setStatQuiet(sid, t.n, "ok"); up.push(t.n); }
        });
        save(); recompute(); closeSheet(); view = "stats"; render();
        const parts = [];
        if (back.length) parts.push("вернулись в план: " + back.join(", "));
        if (up.length) parts.push("вышли: " + up.join(", "));
        toast(parts.length ? "Пробник сохранён. Задания " + parts.join("; ")
          : "Пробник сохранён. Ошибки в непройденных заданиях — они и так впереди в плане");
      };
    });
}
function setStatQuiet(sid, n, st) {
  const k = taskKey(sid, n), prev = S.tasks[k] || {};
  S.tasks[k] = { st, at: now(), rev: prev.rev || 0 };
}

function sheetFix(sid, fix, drop) {
  const sub = SUB[sid], r = S.rhythm[sid];
  if (fix === "more") {
    const f = suggestFixes(sid).find(x => x.id === "more");
    if (!f || !f.ok) { toast("Здесь уплотнять уже нельзя"); return; }
    openSheet(`<h3>Добавить занятия</h3><p class="sh-sub">${esc(f.note)}</p>
      <div class="lab">Занятий по предмету в неделю</div>
      <input type="number" id="fN" min="1" max="7" value="${r.perWeek + 1}" inputmode="numeric">
      <div class="lab">Длительность, минут</div>
      <input type="number" id="fM" min="20" max="180" step="5" value="${r.minutes}" inputmode="numeric">
      <button class="primary" id="fOk">Изменить ритм</button>`,
      el => {
        $("#fOk", el).onclick = () => {
          r.perWeek = clamp(parseInt($("#fN", el).value, 10) || r.perWeek, 1, 7);
          r.minutes = clamp(parseInt($("#fM", el).value, 10) || r.minutes, 20, 180);
          r.days = spreadDays(r.perWeek, sid);
          S.setAt = now(); save(); recompute(); regenFuture(); closeSheet(); render();
          toast("Ритм изменён, будущие недели пересобраны");
        };
      });
  } else if (fix === "narrow") {
    const list = (drop || "").split(",").filter(Boolean).map(Number);
    openSheet(`<h3>Сузить цель</h3>
      <p class="sh-sub">Эти задания уйдут из плана. Они останутся в списке — вернуть можно в любой момент.</p>
      <div class="alltasks">${list.map(n => `<div class="task"><span class="num">${n}</span>
        <span class="tn">${esc(sub.byN[n].name)}<i>${plural(sub.byN[n].p, "балл", "балла", "баллов")}</i></span></div>`).join("")}</div>
      <button class="primary" id="nOk">Отложить эти задания</button>`,
      el => {
        $("#nOk", el).onclick = () => {
          S.excluded[sid] = (S.excluded[sid] || []).concat(list);
          S.setAt = now(); save(); recompute(); regenFuture(); closeSheet(); render();
          toast("Цель сужена, траектория пересчитана");
        };
      });
  } else if (fix === "tutor") {
    r.tutor = 1; r.tutorDay = sid === "rus" ? 6 : r.tutorDay != null ? r.tutorDay : 5;
    S.setAt = now(); save(); recompute(); regenFuture(); render();
    toast("Добавлено занятие с преподавателем");
  }
}

function spreadDays(n, sid) {
  const base = { rus: [1, 3, 5, 0, 2, 4, 6], mat: [0, 2, 3, 4, 5, 1, 6], fiz: [0, 1, 2, 4, 5, 3, 6] }[sid] || [0, 1, 2, 3, 4, 5, 6];
  return base.slice(0, clamp(n, 1, 7)).sort((a, b) => a - b);
}

/* пересобрать будущие недели, не трогая прошлое и выполненное */
function regenFuture() {
  const from = weekStart(today());
  Object.values(S.sessions).forEach(s => {
    if (s.del || s.done || s.custom) return;
    if (diffDays(from, s.date) >= 0) { s.del = true; s.at = now(); }
  });
  Object.keys(S.gen).forEach(w => { if (diffDays(from, w) >= 0) delete S.gen[w]; });
  save();
  let w = from;
  for (let i = 0; i < 8; i++) { syncWeek(w, true); w = addDays(w, 7); }
}

/* ─────────────────────────── настройки ─────────────────────────── */
function sheetSettings() {
  const connected = CFG.token && CFG.gist;
  openSheet(`<h3>Настройки</h3>
    <div class="lab">Кто пользуется этим устройством</div>
    <div class="pick" id="sRole">
      <button class="pk${!isParent() ? " on" : ""}" data-v="mark">Марк</button>
      <button class="pk${isParent() ? " on" : ""}" data-v="parent">Родитель</button></div>
    <p class="hint">Родитель видит тот же прогресс, но ничего не меняет.</p>

    <div class="lab">Ритм занятий</div>
    <button class="ghost" data-act="rebal">Пересобрать под цель — чтобы всё успеть</button>
    <div class="rhythm">${SUBJECTS.map(s => {
      const r = S.rhythm[s.id];
      return `<div class="rh" style="--c:${s.color}"><b>${esc(s.short)}</b>
        <label>раз в неделю<input type="number" min="0" max="7" value="${r.perWeek}" data-r="${s.id}" data-f="perWeek" inputmode="numeric"></label>
        <label>минут<input type="number" min="20" max="180" step="5" value="${r.minutes}" data-r="${s.id}" data-f="minutes" inputmode="numeric"></label>
        <label>с преподавателем<input type="number" min="0" max="3" value="${r.tutor}" data-r="${s.id}" data-f="tutor" inputmode="numeric"></label></div>`;
    }).join("")}</div>
    <div class="hint" id="loadHint"></div>

    <div class="lab">Даты экзаменов — ориентир, расписание ЕГЭ-2027 ещё не опубликовано</div>
    <div class="rhythm">${SUBJECTS.map(s => `<div class="rh" style="--c:${s.color}"><b>${esc(s.short)}</b>
      <label>дата<input type="date" value="${S.exam[s.id]}" data-e="${s.id}"></label></div>`).join("")}</div>

    <div class="lab">Общий доступ</div>
    ${connected
      ? `<p class="hint">Подключено. Гист <b>${esc(CFG.gist.slice(0, 8))}…</b>, последний обмен ${CFG.lastSync ? new Date(CFG.lastSync).toLocaleString("ru") : "—"}.</p>
         <button class="ghost" id="sLink">Скопировать ссылку для родителя</button>
         <button class="ghost" id="sSync">Синхронизировать сейчас</button>
         <button class="ghost danger" id="sOff">Отключить</button>`
      : `<p class="hint">Чтобы отметки Марка видел родитель, нужен бесплатный токен GitHub с одним доступом — <b>gist</b>. Он хранится только на этом устройстве.</p>
         <input type="password" id="sTok" placeholder="ghp_…" autocomplete="off">
         <button class="primary" id="sConn">Подключить</button>
         <button class="ghost" id="sHelp">Где взять токен</button>`}

    <div class="lab">Разборы</div>
    <p class="hint">Теория и разборы записаны заранее и работают без интернета.</p>
    <button class="ghost" data-act="aiset">Откуда взяты задания</button>

    <div class="lab">Официальные материалы</div>
    <div class="links">
      <a href="${FIPI.all}" target="_blank" rel="noopener">Демоверсии, спецификации, кодификаторы ФИПИ</a>
      <a href="${FIPI.bank}" target="_blank" rel="noopener">Открытый банк заданий ЕГЭ</a>
      <a href="${FIPI.rus}">Русский язык · проект 2027</a>
      <a href="${FIPI.mat}">Математика · проект 2027</a>
      <a href="${FIPI.fiz}">Физика · проект 2027</a>
    </div>
    <p class="hint">Задания, уровни и баллы взяты из проектов демоверсий на 2027 год (август 2026).
      Финальные версии ФИПИ публикует в ноябре 2026 — тогда список стоит сверить.</p>

    <button class="ghost danger" id="sReset">Стереть все данные на устройстве</button>`,
    el => {
      const loadHint = $("#loadHint", el);
      const showLoad = () => {
        const l = totalWeeklyLoad();
        loadHint.innerHTML = `Всего ${fmtH(l)} в неделю сверх школы.` +
          (l > LOAD_LIMIT ? ` <b class="warn-t">Это больше разумного предела ${LOAD_LIMIT} часов — план перестанет выполняться.</b>` : "");
      };
      showLoad();
      $$(".pk", $("#sRole", el)).forEach(b => b.onclick = () => {
        CFG.role = b.dataset.v === "parent" ? "parent" : "mark"; saveCfg();
        $$(".pk", $("#sRole", el)).forEach(x => x.classList.remove("on")); b.classList.add("on");
        render();
      });
      $$("[data-r]", el).forEach(inp => inp.onchange = () => {
        const r = S.rhythm[inp.dataset.r], f = inp.dataset.f;
        r[f] = clamp(parseInt(inp.value, 10) || 0, 0, f === "minutes" ? 180 : 7);
        if (f === "perWeek") r.days = spreadDays(r.perWeek, inp.dataset.r);
        if (f === "tutor" && r.tutor && r.tutorDay == null) r.tutorDay = 5;
        S.setAt = now(); save(); recompute(); showLoad();
      });
      $$("[data-e]", el).forEach(inp => inp.onchange = () => {
        S.exam[inp.dataset.e] = inp.value; S.setAt = now(); save(); recompute();
      });
      const b = id => $("#" + id, el);
      if (b("sConn")) b("sConn").onclick = () => connectGitHub($("#sTok", el).value.trim());
      if (b("sHelp")) b("sHelp").onclick = tokenHelp;
      if (b("sSync")) b("sSync").onclick = () => syncNow(true);
      if (b("sLink")) b("sLink").onclick = parentLink;
      if (b("sOff")) b("sOff").onclick = () => { CFG.token = ""; CFG.gist = ""; saveCfg(); closeSheet(); render(); toast("Отключено"); };
      b("sReset").onclick = () => {
        if (!confirm("Стереть занятия, отметки и пробники на этом устройстве?")) return;
        localStorage.removeItem(LS); load(); recompute(); closeSheet(); render(); toast("Стёрто");
      };
    });
}

function tokenHelp() {
  openSheet(`<h3>Токен GitHub</h3>
    <ol class="steps">
      <li>Открой <b>github.com/settings/tokens</b> → Generate new token → <b>classic</b>.</li>
      <li>Название любое, срок — <b>No expiration</b>.</li>
      <li>Отметь одну галочку — <b>gist</b>.</li>
      <li>Generate token, скопируй строку <b>ghp_…</b> и вставь в настройках.</li>
    </ol>
    <p class="hint">Токен даёт доступ только к твоим гистам и хранится на устройстве.
      На втором устройстве вставь тот же токен — данные найдутся сами.</p>
    <button class="primary" id="gh">Открыть GitHub</button>`,
    el => { $("#gh", el).onclick = () => window.open("https://github.com/settings/tokens/new?description=%D0%9C%D0%B0%D1%80%D0%BA&scopes=gist", "_blank", "noopener"); });
}

/* ─────────────────────────── обмен через GitHub Gist ─────────────────────────── */
const GFILE = "ege-mark.json";
function gh(path, opt) {
  return fetch("https://api.github.com" + path, Object.assign({
    headers: { Authorization: "Bearer " + CFG.token, Accept: "application/vnd.github+json" }
  }, opt || {}));
}
function setSync(s) { const el = $("#syncDot"); if (el) el.className = "dot " + s; }

async function connectGitHub(token) {
  if (!token) { toast("Вставь токен"); return; }
  CFG.token = token; saveCfg(); setSync("busy");
  try {
    const r = await gh("/gists?per_page=100");
    if (r.status === 401) throw new Error("Токен не подошёл");
    const list = await r.json();
    const found = list.find(g => g.files && g.files[GFILE]);
    if (found) { CFG.gist = found.id; saveCfg(); await syncNow(true); }
    else {
      const cr = await gh("/gists", {
        method: "POST",
        body: JSON.stringify({ description: "Марк готовится к ЕГЭ", public: false, files: { [GFILE]: { content: JSON.stringify(S) } } })
      });
      const g = await cr.json();
      CFG.gist = g.id; CFG.lastSync = now(); saveCfg();
    }
    setSync("ok"); closeSheet(); render(); toast("Подключено");
  } catch (e) {
    CFG.token = ""; saveCfg(); setSync("bad"); toast(e.message || "Не вышло подключиться");
  }
}

function mergeState(local, remote) {
  const out = JSON.parse(JSON.stringify(local));
  ["tasks", "sessions", "mocks"].forEach(k => {
    Object.keys(remote[k] || {}).forEach(id => {
      const r = remote[k][id], l = out[k][id];
      if (!l || (r.at || 0) > (l.at || 0)) out[k][id] = r;
    });
  });
  Object.keys(remote.gen || {}).forEach(w => out.gen[w] = 1);
  if ((remote.setAt || 0) > (local.setAt || 0)) {
    out.rhythm = remote.rhythm || out.rhythm;
    out.exam = remote.exam || out.exam;
    out.excluded = remote.excluded || out.excluded;
    out.setAt = remote.setAt;
  }
  return out;
}

let syncTimer = null;
async function syncNow(manual) {
  if (!CFG.token || !CFG.gist) { if (manual) sheetSettings(); return; }
  setSync("busy");
  try {
    const r = await gh("/gists/" + CFG.gist);
    if (!r.ok) throw new Error("Гист не читается");
    const g = await r.json();
    const raw = g.files && g.files[GFILE] ? g.files[GFILE].content : null;
    let remote = null;
    try { remote = raw ? JSON.parse(raw) : null; } catch (e) { remote = null; }
    if (remote && remote.v === 1) { S = mergeState(S, remote); save(false); }
    if (!isParent()) {
      await gh("/gists/" + CFG.gist, { method: "PATCH", body: JSON.stringify({ files: { [GFILE]: { content: JSON.stringify(S) } } }) });
    }
    CFG.lastSync = now(); saveCfg(); setSync("ok");
    recompute(); render();
    if (manual) toast("Обменялись");
  } catch (e) { setSync("bad"); if (manual) toast(e.message || "Обмен не вышел"); }
}
function syncSoon() {
  if (!CFG.token || !CFG.gist || isParent()) return;
  clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(false), 4000);
}

function parentLink() {
  const code = btoa(unescape(encodeURIComponent(CFG.gist + "|" + CFG.token)));
  const url = location.origin + location.pathname + "#p=" + code;
  const done = () => toast("Ссылка скопирована. В ней есть токен — отправляй только своим.");
  if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, () => prompt("Скопируй ссылку", url));
  else prompt("Скопируй ссылку", url);
}

function readHash() {
  const m = location.hash.match(/^#p=(.+)$/);
  if (!m) return false;
  try {
    const [gist, token] = decodeURIComponent(escape(atob(m[1]))).split("|");
    if (!gist || !token) return false;
    CFG.gist = gist; CFG.token = token; CFG.role = "parent"; saveCfg();
    history.replaceState(null, "", location.pathname);
    return true;
  } catch (e) { return false; }
}

/* ─────────────────────────── сборка экрана ─────────────────────────── */
function nearestExam() {
  const list = SUBJECTS.map(s => ({ s, d: S.exam[s.id] })).filter(x => diffDays(today(), x.d) >= 0)
    .sort((a, b) => diffDays(b.d, a.d));
  return list[0] || { s: SUB.rus, d: S.exam.rus };
}

/* Норма на день: тема закрывается до конца текущего месяца.
   Остаток задач делим на оставшиеся дни, сегодняшний считаем.
   Пропустил день — норма сама пересчитается вверх, никакого долга задним числом. */
function endOfMonth(s) {
  const d = parse(s);
  return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function topicProgress(sid, n) {
  const d = (MAP[sid] || {})[String(n)];
  if (!d) return null;
  let done = 0, total = 0;
  (d.groups || []).forEach(g => (g.tasks || []).forEach(id => {
    total++; const r = (S.solved || {})[id]; if (r && r.ok) done++;
  }));
  return { done: done, total: total };
}

function solvedToday() {
  const t = today();
  let n = 0;
  Object.keys(S.solved || {}).forEach(id => {
    const r = S.solved[id];
    if (r && r.ok && r.at && iso(new Date(r.at)) === t) n++;
  });
  return n;
}

/* Что открыто сейчас. Кинематика первой получила встроенный разбор,
   остальные темы прячем, пока к ним не дописан такой же. */
const LIVE_FIZ = [1];
const LIVE_MAT = [];
const LIVE_MAT2 = [];
const SEPT_FIZ = LIVE_FIZ;                               /* темы на сентябрь = открытые */
const SEPT_MAT = LIVE_MAT;
const SEPT_MAT2 = LIVE_MAT2;

function dayNorm() {
  let done = 0, total = 0;
  const prog = (sid, n) => (typeof trainProgress === "function" && trainProgress(sid, n)) || topicProgress(sid, n);
  SEPT_FIZ.forEach(n => { const x = prog("fiz", n); if (x) { done += x.done; total += x.total; } });
  SEPT_MAT.forEach(n => { const x = prog("mat", n); if (x) { done += x.done; total += x.total; } });
  const p = { done: done, total: total };
  if (!p.total) return null;
  const deadline = endOfMonth(today());
  const left = Math.max(1, diffDays(today(), deadline) + 1);
  const rest = Math.max(0, p.total - p.done);
  return {
    total: p.total, done: p.done, rest: rest, left: left, deadline: deadline,
    need: rest ? Math.max(1, Math.ceil(rest / left)) : 0,
    today: typeof trainToday === "function" ? trainToday() : solvedToday(),
  };
}

function renderTop() {
  const d = (S.exam && S.exam.fiz) || SUB.fiz.examDate;
  const dl = diffDays(today(), d);
  const el = $("#count"); if (!el) return;
  el.innerHTML = dl >= 0
    ? `<b>${plural(dl, "день", "дня", "дней")}</b> до первого экзамена`
    : `Экзамен по физике позади`;

  const row = $("#dayrow"), dl2 = $("#deadline");
  if (!row) return;
  const k = dayNorm();
  if (!k) { row.innerHTML = ""; if (dl2) dl2.innerHTML = ""; return; }
  if (dl2) {
    const w2 = (n, a, b, c) => { const x = Math.abs(n) % 100, y = x % 10;
      return x > 10 && x < 20 ? c : y === 1 ? a : y > 1 && y < 5 ? b : c; };
    const nm1 = sid => n => (((MAP[sid] || {})[String(n)] || {}).name
        || (SUB[sid].byN[n] || {}).name || "").split(":")[0].toLowerCase();
    const names = SEPT_FIZ.map(nm1("fiz")).concat(SEPT_MAT.map(nm1("mat"))).filter(Boolean);
    const nm = names.length > 2 ? names.slice(0, -1).join(", ") + " и " + names[names.length - 1]
             : names.join(" и ");
    dl2.innerHTML = k.rest
      ? `<b>${esc(nm)}</b><span>до ${fmtDate(k.deadline)} — ${k.left} ${w2(k.left, "день", "дня", "дней")}</span>`
      : `<b>${esc(nm)}</b><span>закрыты</span>`;
  }
  if (!k.rest) {
    row.innerHTML = `<div class="db-t"><b>всё решено</b></div>
      <div class="db-bar done"><i style="width:100%"></i></div>`;
    return;
  }
  const pct = k.need ? Math.min(100, Math.round(k.today / k.need * 100)) : 100;
  const full = k.today >= k.need;
  row.title = `Осталось ${k.rest} подвидов из ${k.total}. До конца месяца ${k.left} дн. — по ${k.need} в день.`;
  row.innerHTML = `<div class="db-t">${full ? "<b>на сегодня всё</b>"
      : `сегодня <b>${k.today} из ${k.need}</b>`}</div>
    <div class="db-bar${full ? " done" : ""}"><i style="width:${pct}%"></i></div>`;
}

async function bootHome() {
  let need = false;
  for (const sid of ["fiz", "mat"]) {
    if (!MAP[sid]) {
      await loadBank(sid); await loadMap(sid); await loadQX(sid); await loadForm(sid);
      need = true;
    }
  }
  if (need) { curSubj = curSubj || "fiz"; render(); }
}

function render() {
  const app = $("#app");
  app.innerHTML =
      view === "lesson"  ? renderLesson()
    : view === "subject" ? renderSubject()
    : view === "num"     ? renderNum()
    : view === "subs"    ? renderSubs()
    : view === "cycle"   ? renderCycle()
    : view === "train"   ? renderTrain()
    : view === "crs"     ? renderCourseHome()
    : view === "course"  ? renderCourse()
    : view === "book"    ? renderBook()
    : view === "week"    ? renderHome()
    : view === "track"   ? renderTrack() : renderStats();
  document.body.classList.toggle("in-lesson", view === "lesson" || view === "cycle" || view === "train" || view === "course");
  document.body.classList.toggle("parent", isParent());
  renderTop();
  $$(".tab").forEach(b => b.classList.toggle("on", b.dataset.v === view));
  if (view === "week") bootHome();
  if (view === "book" && BOOK[bookKey] === undefined) loadBook(bookKey).then(render);
}

function cycleStat(sid, n) {
  const st = tstat(sid, n);
  setStat(sid, n, st === "new" ? "ok" : st === "ok" ? "bad" : "new");
}

document.addEventListener("click", e => {
  const t = e.target.closest("[data-act], [data-go], .tab");
  if (!t) return;
  if (t.classList.contains("tab")) { view = t.dataset.v; render(); window.scrollTo(0, 0); return; }
  if (t.dataset.go) {
    view = t.dataset.go;
    if (t.dataset.subj) trackSubj = t.dataset.subj;
    render(); window.scrollTo(0, 0); return;
  }
  const a = t.dataset.act;
  if (a === "task") { sheetTask(t.dataset.sid, +t.dataset.n); return; }
  if (a === "lesson") { openLesson(t.dataset.id); return; }
  if (a === "lsback") { LES = null; view = "week"; render(); return; }
  if (a === "next") { nextStep(); return; }
  if (a === "chat") { chatSheet(); return; }
  if (a === "explain") { chatSheet(taskCtx(+t.dataset.i, +t.dataset.k)); return; }
  if (a === "prep") { prepNext(); render(); return; }
  if (a === "start") { openSubject(t.dataset.sid); return; }
  if (a === "home") { view = "week"; render(); window.scrollTo(0, 0); return; }
  if (a === "subject") { view = "subject"; render(); window.scrollTo(0, 0); return; }
  if (a === "num") {
    if (t.dataset.s && t.dataset.s !== curSubj) curSubj = t.dataset.s;
    curNum = +(t.dataset.n || curNum); view = "num"; render(); window.scrollTo(0, 0); return;
  }
  if (a === "cycall") { enterCycle(curCyc); return; }
  if (a === "train")    { trOpen(t.dataset.k); return; }
  if (a === "cs-open")  { crsOpen(t.dataset.k); return; }
  if (a === "cs-next")  { crsNext(); return; }
  if (a === "cs-check") { crsCheck(); return; }
  if (a === "cs-real")  { crsReal(); return; }
  if (a === "cs-again") { crsAgain(); return; }
  if (a === "cs-back")  { crsBack(); return; }
  if (a === "cs-quiz")  { crsQuiz(+t.dataset.i, +t.dataset.o); return; }
  if (a === "cs-restart") { crsRestart(); return; }
  if (a === "cs-home")  { view = "crs"; render(); window.scrollTo(0, 0); return; }
  if (a === "tr-check") { trCheck(); return; }
  if (a === "tr-ok")    { trNext(); return; }
  if (a === "tr-again") { trAgain(); return; }
  if (a === "tr-back")  { trBack(); return; }
  if (a === "tr-peek")  { trPeek(); return; }
  if (a === "frm-all")  { numMode = numMode === "frm" ? "train" : "frm"; render(); return; }
  if (a === "back-cyc") {
    const d = (MAP[curSubj] || {})[String(curNum)];
    const parent = (d.groups || []).find(g => (g.subs || []).length && curCyc &&
      curCyc.title.indexOf(g.title) === 0 && curCyc.title !== g.title);
    if (parent) { curCyc = parent; view = "subs"; } else { view = "num"; }
    render(); window.scrollTo(0, 0); return;
  }
  if (a === "cyc") {
    const d = (MAP[curSubj] || {})[String(curNum)];
    curCyc = d.groups[+t.dataset.i];
    if ((curCyc.subs || []).length) { view = "subs"; render(); window.scrollTo(0, 0); return; }
    const qs = cycTasks(curCyc);
    const first = qs.findIndex(q => !solvedOf(q.id));
    cycIdx = (curCyc.theory && !cycStat(curCyc).tried) ? -1 : (first < 0 ? 0 : first);
    view = "cycle"; render(); window.scrollTo(0, 0); return;
  }
  if (a === "sub") {
    const sb = (curCyc.subs || [])[+t.dataset.k];
    enterCycle(Object.assign({}, curCyc, { title: curCyc.title + " · " + sb.title,
      recognize: sb.hint, tasks: sb.tasks, count: sb.count, subs: null }));
    return;
  }
  if (a === "alg") { showAlg = !showAlg; render(); return; }
  if (a === "hard") { showHard = !showHard; render(); return; }
  if (a === "qcheck") { checkQ(t.dataset.id); return; }
  if (a === "qnext") { nextQ(); return; }
  if (a === "qprev") { if (cycIdx > 0) cycIdx--; render(); window.scrollTo(0, 0); return; }
  if (a === "goq") { cycIdx = +t.dataset.k; render(); window.scrollTo(0, 0); return; }
  if (a === "mode") { numMode = t.dataset.m; render(); window.scrollTo(0, 0); return; }
  if (a === "fcyc") {
    const lv = ((FMAP[curSubj] || {})[String(curNum)] || {}).levels || [];
    const g = ((lv[+t.dataset.l] || {}).rows || [])[+t.dataset.i]; if (!g) return;
    enterCycle(Object.assign({}, g, { summary: g.what, byFormula: true }));
    return;
  }
  if (a === "simpler") { aiExplain(t.dataset.id); return; }
  if (a === "aisolve") { aiSolve(t.dataset.id); return; }
  if (a === "aiagain2") { delete AIS["s" + t.dataset.id];
    try { localStorage.removeItem("ai2:s" + t.dataset.id); } catch (e) {}
    aiSolve(t.dataset.id); return; }
  if (a === "aikey")  { aiSetupSheet(""); return; }
  if (a === "aisave") { aiSave(t.dataset.id); return; }
  if (a === "aiforget") { aiForget(); return; }
  if (a === "aidrop2") { aiAgain(t.dataset.id); return; }
  if (a === "qpick") { setQStep(t.dataset.id, "p" + t.dataset.i, +t.dataset.o + 1); render(); return; }
  if (a === "bkch") { const i = +t.dataset.i; bookOpen[i] = bookOpen[i] === false; render(); return; }
  if (a === "bkck") { checkOpen[+t.dataset.i] = 1; render(); return; }
  if (a === "bk-read") {                                   /* из приёма — в учебник */
    bookKey = "fiz-" + curNum; bookJump = t.dataset.k || null; view = "book";
    render(); window.scrollTo(0, 0); return;
  }
  if (a === "bk-go") {                                     /* из учебника — сразу решать */
    const b = BOOK[bookKey] || {};
    curSubj = b.subj || "fiz";
    curNum = b.task || curNum || 1;
    const key = t.dataset.k;
    /* в учебник можно зайти сразу с главной, и тогда задачи ещё не загружены */
    (async () => {
      if (!MAP[curSubj]) { await loadBank(curSubj); await loadMap(curSubj); await loadQX(curSubj); await loadForm(curSubj); }
      trOpen(key);
    })();
    return;
  }
  if (a === "more") { moreOn[t.dataset.k] = 1; render(); return; }
  if (a === "qack") { setQStep(t.dataset.id, "i" + t.dataset.i, 1); render(); return; }
  if (a === "trm") { const id = t.dataset.id; tOpen[id] = !tOpen[id]; render(); return; }
  if (a === "frm") { const id = t.dataset.id; fOpen[id] = !fOpen[id]; render(); return; }
  if (a === "theory") { cycIdx = -1; render(); window.scrollTo(0, 0); return; }
  if (a === "qask") { askQ(t.dataset.id); return; }
  if (a === "qstep") { checkStep(t.dataset.id, +t.dataset.k); return; }
  if (a === "qstepsol") { showStep(t.dataset.id, +t.dataset.k); return; }
  if (a === "qfree") { qMode[t.dataset.id] = "free"; render(); return; }
  if (a === "qsteps") { qMode[t.dataset.id] = "steps"; render(); return; }
  if (a === "cycask") { askCycle(); return; }
  if (a === "plan") { showPlan = !showPlan; render(); return; }
  if (a === "rebal") { sheetRebalance(); return; }
  if (a === "lsmenu") { lessonMenu(); return; }
  if (a === "drill") { drillCheck(+t.dataset.i, +t.dataset.k); return; }
  if (a === "sol") { showSol(+t.dataset.i, +t.dataset.k); return; }
  if (a === "realcheck") { realCheck(+t.dataset.i, +t.dataset.k); return; }
  if (a === "finish") { finishLesson(t.dataset.st); return; }
  if (a === "aiset") { aiSetup(); return; }
  if (isParent() && ["done", "more", "stat", "excl", "mock", "fix"].indexOf(a) >= 0) { toast("Родитель только смотрит"); return; }
  if (a === "done") {
    const s = S.sessions[t.dataset.id];
    if (s.done) { s.done = false; s.fact = null; s.at = now(); save(); recompute(); render(); }
    else sheetDone(t.dataset.id);
  } else if (a === "more") sheetMore(t.dataset.id);
  else if (a === "stat") {
    if (t.dataset.st) setStat(t.dataset.sid, +t.dataset.n, t.dataset.st);
    else cycleStat(t.dataset.sid, +t.dataset.n);
    if ($("#sheet").classList.contains("on")) closeSheet();
    render();
  } else if (a === "subj") { trackSubj = t.dataset.sid; render(); }
  else if (a === "all") openSheet(allTasksSheet(t.dataset.sid));
  else if (a === "excl") {
    const sid = t.dataset.sid, n = +t.dataset.n, ex = S.excluded[sid] || (S.excluded[sid] = []);
    const i = ex.indexOf(n); if (i >= 0) ex.splice(i, 1); else ex.push(n);
    S.setAt = now(); save(); recompute(); openSheet(allTasksSheet(sid));
  } else if (a === "mock") sheetMock(t.dataset.sid, t.dataset.d);
  else if (a === "fix") sheetFix(t.dataset.sid, t.dataset.fix, t.dataset.drop);
});

function rolePicker() {
  openSheet(`<h3>Кто здесь?</h3>
    <p class="sh-sub">От этого зависит, что можно менять. Поменять роль всегда можно в настройках.</p>
    <div class="pick big" id="rPick">
      <button class="pk" data-v="mark">Марк</button>
      <button class="pk" data-v="parent">Родитель</button></div>`,
    el => $$(".pk", el).forEach(b => b.onclick = () => {
      CFG.role = b.dataset.v; saveCfg(); closeSheet();
      if (CFG.role === "mark") { warmUp(); }
      recompute(); render();
      if (CFG.role === "mark") toast("Загляни в «Траекторию» и отметь, что уже знакомо");
    }));
}

/* заранее раскладываем ближайшие недели */
function warmUp() {
  let w = weekStart(today());
  for (let i = 0; i < 6; i++) { syncWeek(w, true); w = addDays(w, 7); }
}

function init() {
  load();
  const fromLink = readHash();
  recompute();
  if (CFG.role === "mark") warmUp();
  recompute();
  render();
  if ($("#gear")) $("#gear").onclick = sheetSettings;
  if ($("#syncBtn")) $("#syncBtn").onclick = () => (CFG.token && CFG.gist) ? syncNow(true) : sheetSettings();
  if (!CFG.role) { CFG.role = "mark"; saveCfg(); }
  if (CFG.token && CFG.gist) syncNow(false);
  setTimeout(prepNext, 2500);
  if (fromLink) toast("Подключено как родитель");
  document.addEventListener("visibilitychange", () => { if (!document.hidden && CFG.token && CFG.gist) syncNow(false); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}
document.addEventListener("DOMContentLoaded", init);

/* вход в прорешивание: с теории, если она написана */
function enterCycle(g) {
  curCyc = g;
  const qs = cycTasks(g);
  const first = qs.findIndex(q => !solvedOf(q.id));
  cycIdx = first < 0 ? 0 : first;
  view = "cycle"; render(); window.scrollTo(0, 0);
}
