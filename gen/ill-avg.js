/* global GRAPH, DRAW */
/* Иллюстрации к приёму «средняя скорость».
   Первая показывает, почему полусумма врёт: куски дороги равны, а времени
   на медленный ушло вдвое больше. Вторая — смысл средней на графике:
   фигуру под линией сплющили в прямоугольник той же площади. */

(function () {
  const F = "style=\"font-family:'Times New Roman',Times,Georgia,serif\"";
  const INK = "#111", ACC = "#c8571a", BLUE = "#1d4ed8", MUTE = "#7a7a7a";
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

  /* Подпись под картинкой. Переносит строки по ширине, поэтому текст не вылезает за край. */
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
    const inside = inner.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    const capH = out.length * 19 + 10;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + capH}" width="${W}" height="${H + capH}"
      style="max-width:100%;height:auto;background:#fff"><g>${inside}</g>
      ${out.map((t, i) => text(W / 2, H + 16 + i * 19, t, { size: 13, color: MUTE })).join("")}</svg>`;
  }

  /* фигурная скобка вниз на промежутке x1…x2 */
  function brace(x1, x2, y, color) {
    const r = 8, cx = (x1 + x2) / 2;
    return `<path d="M ${x1} ${y} q 0 ${r} ${r} ${r} H ${cx - r} q ${r} 0 ${r} ${r}
      q 0 ${-r} ${r} ${-r} H ${x2 - r} q ${r} 0 ${r} ${-r}"
      fill="none" stroke="${color || MUTE}" stroke-width="1.6"/>`;
  }

  Object.assign(DRAW, {
    /* ── Полоса времени: одинаковые куски дороги, разное время ── */
    avgTimeWeights() {
      let s = "";
      const x0 = 40, sc = 88, yT = 72, yB = 126, yAx = 142;
      const X = h => x0 + h * sc;

      /* путь над полосой */
      s += text((X(0) + X(3)) / 2, 52, "путь 200 км", { size: 14, bold: true });
      s += `<line x1="${X(0)}" y1="62" x2="${X(3)}" y2="62" stroke="${MUTE}" stroke-width="1.2"/>`;
      s += `<line x1="${X(0)}" y1="57" x2="${X(0)}" y2="67" stroke="${MUTE}" stroke-width="1.2"/>`;
      s += `<line x1="${X(3)}" y1="57" x2="${X(3)}" y2="67" stroke="${MUTE}" stroke-width="1.2"/>`;

      /* два куска поездки */
      s += `<rect x="${X(0)}" y="${yT}" width="${sc}" height="${yB - yT}" fill="${ACC}" fill-opacity="0.18" stroke="${ACC}" stroke-width="2"/>`;
      s += `<rect x="${X(1)}" y="${yT}" width="${sc * 2}" height="${yB - yT}" fill="${BLUE}" fill-opacity="0.14" stroke="${BLUE}" stroke-width="2"/>`;
      s += text(X(0.5), yT + 16, "туда", { size: 13, bold: true, color: ACC });
      s += text(X(0.5), yT + 33, "100 км/ч", { size: 13, color: ACC });
      s += text(X(0.5), yT + 50, "100 км", { size: 13, color: ACC });
      s += text(X(2), yT + 16, "обратно", { size: 13, bold: true, color: BLUE });
      s += text(X(2), yT + 33, "50 км/ч", { size: 13, color: BLUE });
      s += text(X(2), yT + 50, "100 км", { size: 13, color: BLUE });

      /* ось часов */
      s += arrow(X(0) - 10, yAx, X(3) + 26, yAx, INK, 1.6);
      for (let h = 0; h <= 3; h++) {
        s += `<line x1="${X(h)}" y1="${yAx - 4}" x2="${X(h)}" y2="${yAx + 4}" stroke="${INK}" stroke-width="1.3"/>`;
        s += text(X(h), yAx + 18, String(h), { size: 12.5 });
      }
      /* подпись оси как в graph.js: величина курсивом, единица прямым */
      s += `<text x="${X(3) + 30}" y="${yAx + 16}" font-size="13" ${F} text-anchor="start" fill="${INK}"><tspan font-style="italic">t</tspan>, ч</text>`;

      /* всё время */
      s += brace(X(0), X(3), yAx + 26, MUTE);
      s += text((X(0) + X(3)) / 2, yAx + 62, "всё время 3 часа", { size: 14, bold: true });

      /* средняя справа: полоса кончается на x = 304, тут остаётся чистое поле */
      s += text(362, 92, "средняя", { size: 15, bold: true, color: ACC });
      s += text(362, 114, "66,7 км/ч", { size: 15, bold: true, color: ACC });

      return withCaption(svg(420, 222, s), [
        "Куски дороги одинаковые,",
        "а времени на медленный ушло вдвое больше.",
        "Поэтому средняя ближе к 50, а не ровно посередине.",
      ]);
    },

    /* ── Средняя по графику: фигуру сплющили в прямоугольник ── */
    avgFlatten() {
      return withCaption(GRAPH.plot({
        cell: 30,
        x: { label: "t, с", from: 0, to: 10, step: 1, tick: 2 },
        y: { label: "v, м/с", from: 0, to: 15, step: 3, tick: 3 },
        lines: [{ pts: [[0, 0], [2, 15], [8, 15], [10, 0]], color: "#c8571a", dots: false }],
        fills: [
          { pts: [[0, 0], [2, 15], [8, 15], [10, 0]], label: "путь 120 м", color: "#c8571a", at: [5, 8] },
          /* тот же путь, сплющенный в прямоугольник: без подписи внутри — она ниже, синяя */
          { pts: [[0, 0], [0, 12], [10, 12], [10, 0]], color: "#1d4ed8", op: 0.05, dash: "5 3" },
        ],
        notes: [
          /* чуть ниже синего пунктира и левее заливок, чтобы подпись читалась на чистом поле */
          { x: 3.4, y: 10.6, t: "средняя 12 м/с", color: "#1d4ed8", size: 13 },
          { x: 8.6, y: 1.6, t: "тот же путь 120 м", color: "#1d4ed8", size: 13, anchor: "end" },
        ],
      }), "Средняя скорость — та высота, на которой линия шла бы ровно и путь остался бы тем же.");
    },
  });
})();

if (typeof module !== "undefined" && module.exports) module.exports = DRAW;
