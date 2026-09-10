/* Рисовалка графиков для задач-близнецов: ломаные линии на клетчатой сетке,
   как в бланках ЕГЭ. Чистые строки SVG, без DOM — работает и в браузере (глобал GRAPH),
   и в node (module.exports).

   GRAPH.plot({
     cell: 34,                                  // пикселей на клетку (по умолчанию 34)
     x: { label: "t, с", from: 0, to: 8, step: 1, tick: 1 },   // step — клетка в единицах, tick — подпись каждые N единиц
     y: { label: "x, м", from: -10, to: 10, step: 5, tick: 5 },
     lines: [ { pts: [[0,-10],[4,10],[8,-5]], color: "#c8571a", label: "1", dots: true } ],
     marks: [ [2, 4] ],                          // точки-кружки (необязательно)
     guides: [ [[2,0],[2,4]] ],                  // пунктирные подсказки (необязательно)
     origin: true                                // подписать «0» у начала координат (по умолчанию true)
   }) → строка "<svg …>…</svg>"

   Правила, которые держит рисовалка:
   – все подписи осей — только «красивые» числа, кратные tick;
   – ось времени начинается там, где x.from (обычно 0); вертикальная ось проходит через 0,
     если 0 внутри диапазона, иначе через y.from;
   – стрелки на концах осей, подписи «t, с» и «x, м» у стрелок, как в учебнике. */

const GRAPH = (function () {
  const F = "font-family:'Times New Roman',Times,Georgia,serif";

  function fmt(v) {
    const s = String(Math.round(v * 1e6) / 1e6).replace(".", ",");
    return s.replace("-", "−");
  }

  /* подпись оси: «x, м» → буква курсивом, единица прямая */
  function axisLabel(label) {
    const m = String(label || "").match(/^([^,]+),\s*(.+)$/);
    if (!m) return `<tspan font-style="italic">${esc(label)}</tspan>`;
    return `<tspan font-style="italic">${esc(m[1])}</tspan>, ${esc(m[2])}`;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function plot(spec) {
    const cell = spec.cell || 34;
    const X = Object.assign({ from: 0, to: 10, step: 1 }, spec.x || {});
    const Y = Object.assign({ from: 0, to: 10, step: 1 }, spec.y || {});
    X.tick = X.tick || X.step; Y.tick = Y.tick || Y.step;
    const sx = cell / X.step, sy = cell / Y.step;
    const gw = (X.to - X.from) * sx, gh = (Y.to - Y.from) * sy;
    const mL = 46, mR = 62, mT = 28, mB = 40;
    const W = mL + gw + mR, H = mT + gh + mB;
    const px = u => mL + (u - X.from) * sx;
    const py = u => mT + (Y.to - u) * sy;
    const x0 = (X.from <= 0 && 0 <= X.to) ? 0 : X.from;
    const y0 = (Y.from <= 0 && 0 <= Y.to) ? 0 : Y.from;
    const ax = px(x0), ay = py(y0);

    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;height:auto;background:#fff">`;

    /* сетка */
    const eps = 1e-9;
    for (let u = X.from; u <= X.to + eps; u += X.step)
      s += `<line x1="${px(u)}" y1="${mT}" x2="${px(u)}" y2="${mT + gh}" stroke="#c9c6c0" stroke-width="0.8"/>`;
    for (let u = Y.from; u <= Y.to + eps; u += Y.step)
      s += `<line x1="${mL}" y1="${py(u)}" x2="${mL + gw}" y2="${py(u)}" stroke="#c9c6c0" stroke-width="0.8"/>`;

    /* оси со стрелками */
    const arrow = 9;
    s += `<line x1="${mL - 6}" y1="${ay}" x2="${mL + gw + 18}" y2="${ay}" stroke="#111" stroke-width="1.6"/>`;
    s += `<polygon points="${mL + gw + 22},${ay} ${mL + gw + 22 - arrow},${ay - 4} ${mL + gw + 22 - arrow},${ay + 4}" fill="#111"/>`;
    s += `<line x1="${ax}" y1="${mT + gh + 6}" x2="${ax}" y2="${mT - 18}" stroke="#111" stroke-width="1.6"/>`;
    s += `<polygon points="${ax},${mT - 22} ${ax - 4},${mT - 22 + arrow} ${ax + 4},${mT - 22 + arrow}" fill="#111"/>`;

    /* подписи осей */
    s += `<text x="${mL + gw + 30}" y="${ay + 18}" font-size="14" ${F} text-anchor="start">${axisLabel(X.label)}</text>`;
    s += `<text x="${ax + 8}" y="${mT - 12}" font-size="14" ${F}>${axisLabel(Y.label)}</text>`;

    /* деления и числа */
    for (let u = X.from; u <= X.to + eps; u += X.tick) {
      const v = Math.round(u * 1e6) / 1e6;
      if (v === x0 && spec.origin !== false) continue;
      s += `<line x1="${px(v)}" y1="${ay - 3}" x2="${px(v)}" y2="${ay + 3}" stroke="#111" stroke-width="1.2"/>`;
      s += `<text x="${px(v)}" y="${ay + 16}" font-size="12.5" ${F} text-anchor="middle">${fmt(v)}</text>`;
    }
    for (let u = Y.from; u <= Y.to + eps; u += Y.tick) {
      const v = Math.round(u * 1e6) / 1e6;
      if (v === y0 && spec.origin !== false) continue;
      s += `<line x1="${ax - 3}" y1="${py(v)}" x2="${ax + 3}" y2="${py(v)}" stroke="#111" stroke-width="1.2"/>`;
      s += `<text x="${ax - 6}" y="${py(v) + 4}" font-size="12.5" ${F} text-anchor="end">${fmt(v)}</text>`;
    }
    if (spec.origin !== false)
      s += `<text x="${ax - 6}" y="${ay + 16}" font-size="12.5" ${F} text-anchor="end">0</text>`;

    /* пунктирные подсказки */
    (spec.guides || []).forEach(g => {
      s += `<polyline fill="none" stroke="#7a7a7a" stroke-width="1" stroke-dasharray="4 3" points="${g.map(p => px(p[0]) + "," + py(p[1])).join(" ")}"/>`;
    });

    /* линии графика */
    const colors = ["#c8571a", "#1d4ed8", "#0f766e", "#7c3aed"];
    (spec.lines || []).forEach((ln, i) => {
      const col = ln.color || colors[i % colors.length];
      const pts = ln.pts || [];
      s += `<polyline fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(p => px(p[0]) + "," + py(p[1])).join(" ")}"/>`;
      if (ln.dots !== false) pts.forEach(p => { s += `<circle cx="${px(p[0])}" cy="${py(p[1])}" r="2.6" fill="${col}"/>`; });
      if (ln.label && pts.length) {
        const p = pts[pts.length - 1];
        s += `<text x="${px(p[0]) + 6}" y="${py(p[1]) - 6}" font-size="13" font-style="italic" font-weight="bold" ${F} fill="${col}">${esc(ln.label)}</text>`;
      }
    });

    /* отдельные точки */
    (spec.marks || []).forEach(p => { s += `<circle cx="${px(p[0])}" cy="${py(p[1])}" r="3.2" fill="#111"/>`; });

    return s + `</svg>`;
  }

  /* Таблица «t — x» в стиле бланка: rows = [[0, 2], [3, 6.5], [4, 10]] */
  function table(head, rows) {
    let s = `<table class="gtab"><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr>`;
    rows.forEach(r => { s += `<tr>${r.map(c => `<td>${fmt(c)}</td>`).join("")}</tr>`; });
    return s + `</table>`;
  }

  return { plot, table, fmt };
})();

if (typeof module !== "undefined" && module.exports) module.exports = GRAPH;
