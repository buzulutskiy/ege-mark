/* global GRAPH, DRAW */
/* Иллюстрации к приёму read_xs — «Путь и перемещение по графику координаты».
   Две картинки: где резать линию на куски (путь против перемещения)
   и как мерить от старта, а не от нуля (вопрос «в какой момент»). */

(function () {
  const F = "style=\"font-family:'Times New Roman',Times,Georgia,serif\"";
  const INK = "#111", ACC = "#c8571a", BLUE = "#1d4ed8", GREEN = "#0f766e", MUTE = "#7a7a7a";
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function svg(w, h, body) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"
      style="max-width:100%;height:auto;background:#fff">${body}</svg>`;
  }
  /* стрелка из (x1,y1) в (x2,y2) */
  function arrow(x1, y1, x2, y2, color, width, dash) {
    const a = Math.atan2(y2 - y1, x2 - x1), L = 10, W = 4.5;
    const bx = x2 - L * Math.cos(a), by = y2 - L * Math.sin(a);
    return `<line x1="${x1}" y1="${y1}" x2="${bx}" y2="${by}" stroke="${color || INK}" stroke-width="${width || 2}"
        ${dash ? `stroke-dasharray="${dash}"` : ""} stroke-linecap="round"/>
      <polygon points="${x2},${y2} ${bx - W * Math.sin(-a)},${by - W * Math.cos(-a)} ${bx + W * Math.sin(-a)},${by + W * Math.cos(-a)}"
        fill="${color || INK}"/>`;
  }
  function text(x, y, t, o) {
    o = o || {};
    return `<text x="${x}" y="${y}" font-size="${o.size || 14}" ${F} text-anchor="${o.anchor || "middle"}"
      fill="${o.color || INK}"${o.bold ? ' font-weight="bold"' : ""}${o.italic ? ' font-style="italic"' : ""}>${esc(t)}</text>`;
  }
  /* человечек-кружок: простое «тело» */
  function body(x, y, color) { return `<circle cx="${x}" cy="${y}" r="7" fill="${color || ACC}"/>`; }

  /* Подпись под картинкой. Переносит строки по ширине, поэтому текст не вылезает за край
     и не обрезается на узком экране. Принимает готовый <svg> и возвращает новый, выше на подпись. */
  function withCaption(inner, lines) {
    const m = inner.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    if (!m) return inner;
    const W = +m[1], H = +m[2];
    const perLine = Math.max(18, Math.floor(W / 7.4));
    const out = [];
    (Array.isArray(lines) ? lines : [lines]).forEach(src => {
      let line = "";
      String(src).split(" ").forEach(w => {
        if ((line + " " + w).trim().length > perLine) { out.push(line.trim()); line = w; }
        else line = (line + " " + w).trim();
      });
      if (line) out.push(line);
    });
    const body = inner.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    const capH = out.length * 19 + 10;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + capH}" width="${W}" height="${H + capH}"
      style="max-width:100%;height:auto;background:#fff"><g>${body}</g>
      ${out.map((t, i) => text(W / 2, H + 16 + i * 19, t, { size: 13, color: MUTE })).join("")}</svg>`;
  }

  /* дорисовать поверх готового графика: GRAPH.plot не умеет стрелок */
  function over(plotSvg, extra) { return plotSvg.replace(/<\/svg>\s*$/, extra + "</svg>"); }
  /* те же формулы координат, что внутри GRAPH.plot */
  function mapper(cell, X, Y) {
    const sx = cell / X.step, sy = cell / Y.step, mL = 46, mT = 28;
    return {
      px: u => mL + (u - X.from) * sx,
      py: u => mT + (Y.to - u) * sy,
    };
  }
  /* двусторонняя мерная стрелка по вертикали */
  function measure(x, y1, y2, color) {
    const mid = (y1 + y2) / 2;
    return arrow(x, mid, x, y1, color, 1.8) + arrow(x, mid, x, y2, color, 1.8);
  }

  Object.assign(DRAW, {

    /* ── Один график — два ответа: где резать линию ── */
    read_xsPathParts() {
      const cell = 28;
      const X = { label: "t, с", from: 0, to: 4, step: 0.5, tick: 1 };
      const Y = { label: "x, м", from: 0, to: 5, step: 0.5, tick: 1 };
      return withCaption(GRAPH.plot({
        cell, x: X, y: Y,
        lines: [{ pts: [[0, 0], [2, 4]], color: GREEN },
                { pts: [[2, 4], [4, 1]], color: ACC }],
        guides: [[[2, 0], [2, 4]]],
        marks: [[0, 0], [2, 4], [4, 1]],
        notes: [
          { x: 0.6, y: 0.25, t: "(0; 0)", size: 12, anchor: "start" },
          { x: 2.12, y: 4.05, t: "(2; 4)", size: 12, anchor: "start" },
          { x: 4.08, y: 1.1, t: "(4; 1)", size: 12, anchor: "start" },
          { x: 2, y: 4.75, t: "здесь развернулось", size: 13, color: MUTE },
          { x: 0.75, y: 3.6, t: "+4 вперёд", size: 14, color: GREEN, bold: true },
          { x: 3.5, y: 3.6, t: "−3 назад", size: 14, color: ACC, bold: true },
        ],
      }), [
        "Путь: 4 + 3 = 7 м. Перемещение: 1 − 0 = 1 м.",
        "Одна линия — два разных ответа.",
      ]);
    },

    /* ── Меряем от старта, а в ответ идёт секунда ── */
    read_xsFarthest() {
      const cell = 36;
      const X = { label: "t, с", from: 0, to: 6, step: 1, tick: 1 };
      const Y = { label: "x, м", from: 0, to: 30, step: 5, tick: 10 };
      const M = mapper(cell, X, Y);
      const plot = GRAPH.plot({
        cell, x: X, y: Y,
        lines: [{ pts: [[0, 20], [2, 30], [5, 0], [6, 0]], color: ACC }],
        guides: [[[0, 20], [6, 20]]],
      });
      const ay = M.py(0);
      let s = "";
      s += measure(M.px(2), M.py(20), M.py(30), BLUE);
      s += text(M.px(2) - 10, M.py(22.9), "10 м", { size: 13, color: BLUE, anchor: "end" });
      s += measure(M.px(5), M.py(20), M.py(0), GREEN);
      s += text(M.px(5) + 7, M.py(10), "20 м", { size: 14, color: GREEN, anchor: "start", bold: true });
      /* уровень старта: величина курсивом с настоящим нижним индексом */
      s += `<text x="${M.px(6)}" y="${M.py(21.4)}" font-size="13" ${F} text-anchor="end" fill="${MUTE}">старт: `
        + `<tspan font-style="italic">x</tspan><tspan font-size="9" dy="3">0</tspan>`
        + `<tspan dy="-3"> = 20</tspan></text>`;
      /* секунда-ответ: жирная точка на оси, своё деление и подпись рядом */
      s += `<line x1="${M.px(5)}" y1="${ay - 6}" x2="${M.px(5)}" y2="${ay + 6}" stroke="${ACC}" stroke-width="2"/>`;
      s += `<circle cx="${M.px(5)}" cy="${ay}" r="4" fill="${ACC}"/>`;
      s += text(M.px(5) + 8, ay - 10, "5 с — ответ", { size: 13, color: ACC, anchor: "start", bold: true });
      return withCaption(over(plot, s), [
        "Меряем от старта, а не от нуля.",
        "Дальше всего тело было внизу, и в ответ идёт секунда.",
      ]);
    },

  });
})();

if (typeof module !== "undefined" && module.exports) module.exports = DRAW;
