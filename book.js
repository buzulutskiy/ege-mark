/* Учебник: определения, формулы и объяснения по теме. Пишется заранее, работает офлайн. */

"use strict";

let BOOK = {};
async function loadBook(key) {
  if (BOOK[key] !== undefined) return BOOK[key];
  try {
    const r = await fetch("lessons/book-" + key + ".json?v=" + VER);
    BOOK[key] = r.ok ? await r.json() : null;
  } catch (e) { BOOK[key] = null; }
  return BOOK[key];
}

let bookKey = "fiz-1", bookOpen = {}, bookJump = null, checkOpen = {};

/* строка примера: «f: …» — формула, остальное текст */
function bookLine(x) {
  const t = String(x || "").trim();
  if (/^f\s*:/.test(t)) return `<div class="bk-ex-f">${mathHTML(t.replace(/^f\s*:/, "").trim())}</div>`;
  return `<p class="bk-ex-p">${esc(t)}</p>`;
}

/* к каким приёмам ведёт глава: кнопки прямо в учебник */
function opensHTML(list) {
  const d = (MAP.fiz || {})["1"];
  if (!d || !(list || []).length) return "";
  const rows = list.map(k => (d.groups || []).find(g => g.key === k)).filter(Boolean);
  if (!rows.length) return "";
  return `<div class="bk-op"><span>эта глава открывает</span>
    ${rows.map(g => `<button class="bk-opb" data-act="bk-go" data-k="${esc(g.key)}">${esc(g.title)}</button>`).join("")}</div>`;
}

function renderBook() {
  const b = BOOK[bookKey];
  if (b && bookJump != null) {                       /* пришли из приёма — раскрываем только его главу */
    b.chapters.forEach((c, i) => { bookOpen[i] = (c.opens || []).indexOf(bookJump) >= 0; });
    bookJump = null;
  }
  if (!b) return `<h4 class="sec first">Учебник</h4>
    <p class="rest">Загружаем…</p>`;

  let h = `<div class="bk-top">
      <div class="bk-ti">${esc(b.title)}</div>
      <div class="bk-sub">Задание ${b.task} · ${esc(SUB[b.subj] ? SUB[b.subj].name : "")}</div>
    </div>
    <p class="bk-lead">${esc(b.lead)}</p>`;

  if ((b.remember || []).length) {
    h += `<div class="bk-keep"><div class="bk-keep-t">Формулы, которые надо помнить</div>
      <ol>${b.remember.map(x => {
        const i = x.indexOf(" — ");
        const f = i > 0 ? x.slice(0, i) : x, w = i > 0 ? x.slice(i + 3) : "";
        return `<li>${mathHTML(f)}${w ? `<span>${esc(w)}</span>` : ""}</li>`;
      }).join("")}</ol></div>`;
  }

  b.chapters.forEach((c, i) => {
    const on = bookOpen[i] !== false;
    h += `<div class="bk-ch${on ? " open" : ""}">
      <button class="bk-h" data-act="bkch" data-i="${i}">
        <span class="bk-n">${i + 1}</span><b>${esc(c.t)}</b><i>${on ? "свернуть" : "развернуть"}</i></button>`;
    if (on) {
      const ck = c.check, ckOn = !!checkOpen[i];
      h += `<div class="bk-b">
        ${c.why ? `<div class="bk-why">${esc(c.why)}</div>` : ""}
        ${(c.p || []).map(x => `<p class="bk-p">${esc(x)}</p>`).join("")}
        ${(c.defs || []).length ? `<dl class="bk-d">${c.defs.map(d =>
          `<dt>${esc(d[0])}</dt><dd>${esc(d[1])}</dd>`).join("")}</dl>` : ""}
        ${(c.f || []).length ? `<div class="bk-f">${c.f.map(f =>
          `<div class="bk-fi"><b>${mathHTML(f[0])}</b><span>${esc(f[1])}</span></div>`).join("")}</div>` : ""}
        ${c.ex ? `<div class="bk-ex"><div class="bk-ex-t">Разберём на числах</div>
          <p class="bk-ex-q">${esc(c.ex.q)}</p>
          ${(c.ex.steps || []).map(bookLine).join("")}
          <div class="bk-ex-a">${esc(c.ex.a)}</div></div>` : ""}
        ${c.trap ? `<div class="bk-t"><span>где теряют балл</span>${esc(c.trap)}</div>` : ""}
        ${ck ? `<div class="bk-ck"><div class="bk-ck-q">${esc(ck.q)}</div>
          ${ckOn ? `<div class="bk-ck-a"><b>${esc(ck.a)}</b>${esc(ck.why)}</div>`
                 : `<button class="bk-ck-b" data-act="bkck" data-i="${i}">Проверить себя</button>`}</div>` : ""}
        ${opensHTML(c.opens)}
      </div>`;
    }
    h += `</div>`;
  });
  return h;
}
