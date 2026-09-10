/* Учебник: определения, формулы и объяснения по теме. Пишется заранее, работает офлайн. */

"use strict";

let BOOK = {};
async function loadBook(key) {
  if (BOOK[key] !== undefined) return BOOK[key];
  try {
    const r = await fetch("lessons/book-" + key + ".json");
    BOOK[key] = r.ok ? await r.json() : null;
  } catch (e) { BOOK[key] = null; }
  return BOOK[key];
}

let bookKey = "fiz-1", bookOpen = {};

function renderBook() {
  const b = BOOK[bookKey];
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
      h += `<div class="bk-b">
        ${(c.p || []).map(x => `<p class="bk-p">${esc(x)}</p>`).join("")}
        ${(c.defs || []).length ? `<dl class="bk-d">${c.defs.map(d =>
          `<dt>${esc(d[0])}</dt><dd>${esc(d[1])}</dd>`).join("")}</dl>` : ""}
        ${(c.f || []).length ? `<div class="bk-f">${c.f.map(f =>
          `<div class="bk-fi"><b>${mathHTML(f[0])}</b><span>${esc(f[1])}</span></div>`).join("")}</div>` : ""}
        ${c.trap ? `<div class="bk-t"><span>где теряют балл</span>${esc(c.trap)}</div>` : ""}
      </div>`;
    }
    h += `</div>`;
  });
  return h;
}
