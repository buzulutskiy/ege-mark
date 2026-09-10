/* Пересказ задачи простыми словами — по клику, прямо под условием.
   Модель видит картинку. Ключ хранится только в этом браузере. */

"use strict";

const AI_URL = "https://api.aitunnel.ru/v1/chat/completions";
const AI_MODELS = [
  ["gemini-3.5-flash", "Gemini 3.5 Flash — видит картинку, отвечает за 5 секунд"],
  ["claude-sonnet-5", "Claude Sonnet 5 — видит картинку, объясняет подробнее"],
];

const aiKey = () => localStorage.getItem("ai-key") || "";
const aiModel = () => localStorage.getItem("ai-model") || AI_MODELS[0][0];
const AIS = {};                       /* id → {load, err, retell, words} */

function aiCached(id) {
  if (AIS[id]) return AIS[id];
  try {
    const raw = localStorage.getItem("ai2:" + id);
    if (raw) AIS[id] = JSON.parse(raw);
  } catch (e) {}
  return AIS[id];
}

function aiPrompt(q) {
  const f = (q.formulas || [q.formula || {}])[0] || {};
  return `Ты преподаватель. Ученик — новичок, физику начал только что.

Задание ЕГЭ:
«${(q.plain || "").replace(/\s+/g, " ").trim()}»
${f.f ? `Решается формулой: ${f.f}` : ""}

Картинку ты не видишь — не описывай её.

Ответь строго в двух блоках. Никаких вступлений, выводов и рассуждений вслух.

ЧТО ХОТЯТ
Ровно два предложения. Перескажи задание так, как сказал бы ученику вслух: что происходит и что найти. Термины замени обычными словами прямо в предложении.

ШАГИ
Ровно четыре пункта, каждый с новой строки, каждый — одно короткое предложение в повелительном наклонении: «Найди…», «Посчитай…», «Подставь…». Только действие, без пояснений зачем. Последний пункт — подставить числа в формулу и посчитать.

Числа не подставляй, ответ не называй.`;
}

/* Полное пошаговое решение: формулы просим в нашей записи, чтобы отрисовать дробями */
const MATHFMT = `Формулы пиши ТОЛЬКО в такой записи, каждую на отдельной строке и с новой строки:
дробь — (4)/(7), степень — x^2 или 2^(4 − 2x), корень — √(x − 4) или ∛(x − 4),
индекс — v_1, умножение — точка ·, логарифм — log_5(x + 4).
Никакого LaTeX, никаких \\frac и долларов. Смешанное число пиши как 7 + (3)/(7).`;

function aiSolvePrompt(q) {
  return `Реши задание и объясни его с нуля, простыми словами, как человеку, который впервые видит эту тему.

Сначала объясни, что дано и что нужно найти. Если есть график, рисунок или таблица, покажи, как считывать нужные данные.

Затем решай по шагам. Перед каждым вычислением:
— объясни, что сейчас находим и зачем;
— напиши формулу и объясни, почему она подходит;
— расшифруй каждую букву и необычный знак;
— подставь числа и объясни, откуда взялось каждое;
— объясни результат и его единицы измерения.

Не пропускай промежуточные действия. Если формулы недостаточно и нужны рассуждения, объясни каждый переход. В конце дай ответ и поясни возможную типичную ошибку.

Пиши компактно, короткими понятными абзацами, без сложных терминов или сразу объясняй их. Не используй формулы там, где они не нужны.

Задание:
«${(q.plain || "").replace(/\s+/g, " ").trim()}»

${MATHFMT}

Размечай ответ этими заголовками, каждый с новой строки, без markdown и звёздочек:
ЧТО ДАНО — что известно и что найти; если есть рисунок, как с него снять числа.
ПЛАН — три-четыре строки: весь ход решения по порядку, чтобы было видно, почему шаги идут именно так.
ШАГ: заголовок — по одному блоку на каждое действие, внутри объяснения и формулы по правилам выше.
ОТВЕТ — чему равен ответ и в каких единицах.
ОШИБКА — типичная ошибка, на которой тут спотыкаются.`;
}

async function aiSolve(id) {
  const q = qById(id);
  if (!q) return;
  if (!aiKey()) return aiSetupSheet(id);
  AIS["s" + id] = { load: 1 };
  render();
  try {
    const r = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + aiKey() },
      body: JSON.stringify({ model: aiModel(), max_tokens: 4000,
                             messages: [{ role: "user", content: aiSolvePrompt(q) }] }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error((j.error && (j.error.message || j.error)) || "код " + r.status);
    const out = (((j.choices || [])[0] || {}).message || {}).content || "";
    if (!out.trim()) throw new Error("модель вернула пустой ответ");
    AIS["s" + id] = { text: out, model: aiModel() };
    try { localStorage.setItem("ai2:s" + id, JSON.stringify(AIS["s" + id])); } catch (e) {}
  } catch (e) {
    AIS["s" + id] = { err: String(e.message || e) };
  }
  render();
}

/* строка похожа на формулу, а не на прозу */
function isMathLine(t) {
  const s = t.trim();
  if (!s || s.length > 90) return false;
  const cyr = (s.match(/[а-яё]{4,}/gi) || []).length;
  return cyr <= 1 && /[=+\-−·^/√]/.test(s) && /\d|x|y|[a-z]/i.test(s);
}

function aiSolveHTML(q) {
  const st = aiCached("s" + q.id);
  if (!st) {
    return `<button class="simpler solve-btn" data-act="aisolve" data-id="${q.id}">
      Показать решение целиком<span>с нуля: что дано, план, каждый шаг с формулами и типичная ошибка</span></button>`;
  }
  if (st.load) {
    return `<div class="aibox load"><div class="ai-bar"><i></i></div>
      <div class="ai-wait">Расписываю решение по шагам…</div></div>`;
  }
  if (st.err) {
    return `<div class="aibox err"><b>Не вышло решить</b><span>${esc(st.err)}</span>
      <button class="lnk" data-act="aisolve" data-id="${q.id}">ещё раз</button></div>`;
  }
  const HEAD = "ШАГ:|ОТВЕТ|ПРОВЕРКА|ПЛАН|ЧТО ДАНО|ОШИБКА";
  const blocks = String(st.text).split(new RegExp(`\\n(?=(?:${HEAD})(?![а-яё]))`, "i"));
  const body = blocks.map(b => {
    const head = b.match(new RegExp(`^(ШАГ:[ \\t]*(.*)|(?:${HEAD})(?![а-яё]))`, "i"));
    let title = "", rest = b;
    if (head) {
      title = head[2] != null ? head[2].replace(/\*\*/g, "").trim()
                                : head[1].trim().toUpperCase();
      rest = b.slice(head[0].length).replace(/^[ \t]*[—–:-][ \t]*/, "");
    }
    const lines = rest.split(/\n+/)
      .map(x => x.replace(/\*\*/g, "").replace(/^#+\s*/, "").trim())
      .filter(Boolean);
    if (title === "ОШИБКА") {
      return `<div class="sv-err"><span>где обычно спотыкаются</span>
        ${lines.map(x => `<p>${esc(x)}</p>`).join("")}</div>`;
    }
    if (title === "ЧТО ДАНО") {
      return `<div class="sv-dano"><span>что дано и что найти</span>
        ${lines.map(x => isMathLine(x) ? `<div class="sv-f">${mathHTML(x)}</div>`
                                       : `<p class="ai-p">${esc(x)}</p>`).join("")}</div>`;
    }
    if (title === "ПЛАН") {
      return `<div class="sv-plan"><div class="sv-plan-t">как тут рассуждать</div>
        <ol>${lines.map(x => `<li>${esc(x.replace(/^[-–—•\d.)\s]+/, ""))}</li>`).join("")}</ol></div>`;
    }
    return `${title ? `<div class="sv-h">${esc(title)}</div>` : ""}
      ${lines.map(x => isMathLine(x)
        ? `<div class="sv-f">${mathHTML(x)}</div>`
        : `<p class="ai-p">${esc(x)}</p>`).join("")}`;
  }).join("");
  return `<div class="aibox solvebox">${body}
    <div class="ai-foot">Решил ${esc(st.model || "")}.
      <button class="lnk" data-act="aiagain2" data-id="${q.id}">решить заново</button></div></div>`;
}

async function aiExplain(id) {
  const q = qById(id);
  if (!q) return;
  if (!aiKey()) return aiSetupSheet(id);

  AIS[id] = { load: 1 };
  render();

  try {
    const content = aiPrompt(q);
    const r = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + aiKey() },
      body: JSON.stringify({ model: aiModel(), max_tokens: 2000, messages: [{ role: "user", content: content }] }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error((j.error && (j.error.message || j.error)) || "код " + r.status);
    const out = (((j.choices || [])[0] || {}).message || {}).content || "";
    if (!out.trim()) throw new Error("модель вернула пустой ответ");

    const m = out.split(/\n\s*ШАГИ\s*\n/i);
    const retell = (m[0] || "").replace(/^\s*ЧТО\s+ХОТЯТ\s*\n?/i, "").trim();
    const logic = (m[1] || "").trim();
    AIS[id] = { retell: retell, logic: logic, model: aiModel() };
    try { localStorage.setItem("ai2:" + id, JSON.stringify(AIS[id])); } catch (e) {}
  } catch (e) {
    AIS[id] = { err: String(e.message || e) };
  }
  render();
}

/* блок под условием задачи */
function aiBlockHTML(q) {
  const st = aiCached(q.id);
  if (!st) {
    return `<button class="simpler" data-act="simpler" data-id="${q.id}">
      Объяснить проще<span>то же задание, но обычными словами</span></button>`;
  }
  if (st.load) {
    return `<div class="aibox load"><div class="ai-bar"><i></i></div>
      <div class="ai-wait">Переписываю условие простыми словами…</div></div>`;
  }
  if (st.err) {
    return `<div class="aibox err"><b>Не вышло объяснить</b><span>${esc(st.err)}</span>
      <button class="lnk" data-act="simpler" data-id="${q.id}">попробовать ещё раз</button>
      <button class="lnk" data-act="aikey">проверить ключ</button></div>`;
  }
  return `<div class="aibox">
    <div class="ai-h">что от тебя хотят</div>
    ${(st.retell || "").split(/\n+/).map(x => `<p class="ai-p">${esc(x)}</p>`).join("")}
    ${st.logic ? `<div class="ai-h">порядок действий</div>
      <ul class="ai-l">${st.logic.split(/\n+/).map(x =>
        `<li>${esc(x.replace(/^[-–—•*\d.)\s]+/, ""))}</li>`).join("")}</ul>` : ""}
    <div class="ai-foot">Пересказал ${esc(st.model || "")}, картинку он не смотрел.
      <button class="lnk" data-act="aidrop2" data-id="${q.id}">объяснить заново</button></div>
  </div>`;
}

function aiSetupSheet(id) {
  openSheet(`<h3>Подключить объяснялку</h3>
    <p class="card-text">Разборы по шагам написаны заранее и работают без сети. Нейросеть нужна для другого —
      пересказать условие доступным языком и расшифровать термины. Для неё нужен токен.</p>
    <p class="card-text">Уходит только текст задания, картинки не отправляются. Ключ хранится
      в этом браузере и идёт прямо в шлюз aitunnel. Старый ключ, который ты присылал в переписке,
      брать нельзя: он засвечен, заведи новый.</p>
    <div class="lab">Ключ</div>
    <input type="password" id="aik" placeholder="sk-..." value="${esc(aiKey())}" autocomplete="off">
    <div class="lab">Модель</div>
    <select id="aim">${AI_MODELS.map(([v, t]) =>
      `<option value="${v}"${aiModel() === v ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>
    <button class="primary" data-act="aisave" data-id="${esc(id || "")}">Сохранить</button>
    ${aiKey() ? `<button class="ghost danger" data-act="aiforget">Удалить ключ из браузера</button>` : ""}`);
}

function aiSave(id) {
  const k = ($("#aik") || {}).value || "", m = ($("#aim") || {}).value || AI_MODELS[0][0];
  if (!k.trim()) { toast("Впиши ключ"); return; }
  localStorage.setItem("ai-key", k.trim());
  localStorage.setItem("ai-model", m);
  closeSheet();
  if (id) aiExplain(id); else render();
}

function aiForget() {
  localStorage.removeItem("ai-key");
  closeSheet(); render();
  toast("Ключ удалён из браузера");
}

function aiAgain(id) {
  delete AIS[id];
  try { localStorage.removeItem("ai2:" + id); } catch (e) {}
  aiExplain(id);
}
