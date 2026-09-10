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
    const raw = localStorage.getItem("ai:" + id);
    if (raw) AIS[id] = JSON.parse(raw);
  } catch (e) {}
  return AIS[id];
}

function aiPrompt(q) {
  const f = (q.formulas || [q.formula || {}])[0] || {};
  const hint = f.f ? `\n\nПодсказка для тебя, ученику её дословно не показывай: задача решается формулой ${f.f}. ${f.why || ""}` : "";
  return `Ты объясняешь школьнику, который только начал физику и половину слов в задании не понимает.

Вот задание ЕГЭ дословно:
«${(q.plain || "").replace(/\s+/g, " ").trim()}»

Картинку ты не видишь. Не выдумывай, что на ней нарисовано, и не описывай её — говори только то, что прямо следует из текста задания.

Перепиши это задание простым языком. Ответь ровно в таком формате, без markdown и без звёздочек:

ПЕРЕСКАЗ
Связный текст на четыре-шесть предложений. Перескажи задание так, как объяснил бы младшему брату. Каждое непонятное слово раскрывай прямо по ходу, в том же предложении, а не отдельным списком: вместо «найди проекцию скорости» пиши «найди скорость со знаком — плюс, если тело едет в одну сторону, минус, если в обратную». Так же разбери обозначения: если в задании написано v с маленькой x, скажи, что это значит. Закончи тем, что именно нужно найти и в каких единицах записать ответ. Не используй слова «проекция», «модуль», «равноускоренный» без немедленного объяснения тут же.

ЛОГИКА
За что хвататься. По пунктам, каждый с новой строки:
— по какому признаку в тексте видно, что делать именно так;
— какая формула тут работает и почему подходит именно она;
— в каком порядке действовать: что найти первым, что вторым;
— где в такой задаче обычно ошибаются.
Пиши так, будто человек видит подобную задачу впервые.

Не решай задачу, не подставляй числа и не называй ответ.${hint}`;
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
      body: JSON.stringify({ model: aiModel(), max_tokens: 4000, messages: [{ role: "user", content: content }] }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error((j.error && (j.error.message || j.error)) || "код " + r.status);
    const out = (((j.choices || [])[0] || {}).message || {}).content || "";
    if (!out.trim()) throw new Error("модель вернула пустой ответ");

    const m = out.split(/\n\s*ЛОГИКА\s*\n/i);
    const retell = (m[0] || "").replace(/^\s*ПЕРЕСКАЗ\s*\n?/i, "").trim();
    const logic = (m[1] || "").trim();
    AIS[id] = { retell: retell, logic: logic, model: aiModel() };
    try { localStorage.setItem("ai:" + id, JSON.stringify(AIS[id])); } catch (e) {}
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
    <div class="ai-h">задача обычными словами</div>
    ${(st.retell || "").split(/\n+/).map(x => `<p class="ai-p">${esc(x)}</p>`).join("")}
    ${st.logic ? `<div class="ai-h">за что хвататься</div>
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
  try { localStorage.removeItem("ai:" + id); } catch (e) {}
  aiExplain(id);
}
