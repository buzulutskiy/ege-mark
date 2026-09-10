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

/* картинку задачи переводим в data:URL — SVG рисуем на канве */
function taskPic(q) {
  return new Promise(resolve => {
    const box = document.createElement("div");
    box.innerHTML = q.html || "";
    const el = box.querySelector("img:not(.tex)");
    if (!el) return resolve(null);
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || 600, h = img.naturalHeight || 400, k = Math.min(2, 900 / w);
        const c = document.createElement("canvas");
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        const g = c.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = el.getAttribute("src");
  });
}

function aiPrompt(q, pic) {
  return `Ты объясняешь школьнику, который только начал физику и половину слов в задании не понимает.

Вот задание ЕГЭ дословно:
«${(q.plain || "").replace(/\s+/g, " ").trim()}»
${pic ? "\nК заданию приложена картинка — посмотри на неё внимательно." : ""}

Перескажи задание доступным языком. Ответь ровно в таком формате, без markdown и без звёздочек:

ПЕРЕСКАЗ
Три-четыре коротких предложения обычными словами: что происходит в задаче, что дано${pic ? " и что именно нарисовано на картинке — что отложено по каждой оси, какие числа подписаны, как ведёт себя линия" : ""}. Как будто пересказываешь другу, без физических терминов.

СЛОВА
Построчно, каждый термин из условия с новой строки в виде «термин — объяснение». Разбери всё, что новичок может не понять: проекция, координата, ускорение, модуль, обозначения вроде v_x, a_x и маленькие индексы. В каждой строке скажи и что это значит, и почему в задании написано именно так.

ЧТО ХОТЯТ
Одно-два предложения бытовым языком: что именно требуется найти и в каких единицах записать ответ.

Не решай задачу и не называй числовой ответ.`;
}

async function aiExplain(id) {
  const q = qById(id);
  if (!q) return;
  if (!aiKey()) return aiSetupSheet(id);

  AIS[id] = { load: 1 };
  render();

  try {
    const pic = await taskPic(q);
    const text = aiPrompt(q, pic);
    const content = pic
      ? [{ type: "text", text: text }, { type: "image_url", image_url: { url: pic } }]
      : text;
    const r = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + aiKey() },
      body: JSON.stringify({ model: aiModel(), max_tokens: 3000, messages: [{ role: "user", content: content }] }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error((j.error && (j.error.message || j.error)) || "код " + r.status);
    const out = (((j.choices || [])[0] || {}).message || {}).content || "";
    if (!out.trim()) throw new Error("модель вернула пустой ответ");

    const m = out.split(/\n\s*СЛОВА\s*\n/i);
    const rest = (m[1] || "").split(/\n\s*ЧТО\s+ХОТЯТ\s*\n/i);
    const retell = (m[0] || "").replace(/^\s*ПЕРЕСКАЗ\s*\n?/i, "").trim();
    const want = (rest[1] || "").trim();
    const words = (rest[0] || "").split("\n").map(x => x.trim()).filter(Boolean)
      .map(x => x.replace(/^[-–—•\d.)\s]+/, ""))
      .map(x => { const i = x.search(/\s[—–-]\s/); return i > 0 ? [x.slice(0, i), x.slice(i + 3)] : null; })
      .filter(Boolean);
    AIS[id] = { retell: retell, words: words, want: want, pic: !!pic, model: aiModel() };
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
      Объяснить проще<span>пересказ обычными словами, разбор картинки и терминов</span></button>`;
  }
  if (st.load) {
    return `<div class="aibox load"><div class="ai-bar"><i></i></div>
      <div class="ai-wait">Читаю условие и смотрю на картинку…</div></div>`;
  }
  if (st.err) {
    return `<div class="aibox err"><b>Не вышло объяснить</b><span>${esc(st.err)}</span>
      <button class="lnk" data-act="simpler" data-id="${q.id}">попробовать ещё раз</button>
      <button class="lnk" data-act="aikey">проверить ключ</button></div>`;
  }
  return `<div class="aibox">
    <div class="ai-h">задача обычными словами</div>
    ${st.retell.split(/\n+/).map(x => `<p class="ai-p">${esc(x)}</p>`).join("")}
    ${(st.words || []).length ? `<div class="ai-h">что значат слова</div>
      <dl class="ai-w">${st.words.map(w => `<dt>${esc(w[0])}</dt><dd>${esc(w[1])}</dd>`).join("")}</dl>` : ""}
    ${st.want ? `<div class="ai-h">что от тебя хотят</div>
      ${st.want.split(/\n+/).map(x => `<p class="ai-p">${esc(x)}</p>`).join("")}` : ""}
    <div class="ai-foot">Пересказал ${esc(st.model || "")}${st.pic ? ", картинку он видел" : ""}.
      <button class="lnk" data-act="aidrop2" data-id="${q.id}">объяснить заново</button></div>
  </div>`;
}

function aiSetupSheet(id) {
  openSheet(`<h3>Подключить объяснялку</h3>
    <p class="card-text">Разборы по шагам написаны заранее и работают без сети. Нейросеть нужна для другого —
      пересказать условие доступным языком и расшифровать термины. Для неё нужен токен.</p>
    <p class="card-text">Уходит текст задания и картинка к нему — модель смотрит на график и говорит,
      что на нём нарисовано. Ключ хранится в этом браузере и идёт прямо в шлюз aitunnel. Старый ключ,
      который ты присылал в переписке, брать нельзя: он засвечен, заведи новый.</p>
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
