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
