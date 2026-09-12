/* global GRAPH, DRAW */
/* Рисунки к приёму slope_v — «Наклон линии на графике координаты — это скорость».
   Три картинки: ступенька под прямой (откуда берутся числа для формулы),
   координата против пути (что бывает подписано слева) и ломаная по кускам. */

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
    const bodyStr = inner.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    const capH = out.length * 19 + 10;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + capH}" width="${W}" height="${H + capH}"
      style="max-width:100%;height:auto;background:#fff"><g>${bodyStr}</g>
      ${out.map((t, i) => text(W / 2, H + 16 + i * 19, t, { size: 13, color: MUTE })).join("")}</svg>`;
  }

  /* сдвиг готового svg по горизонтали: правим координаты, а не вешаем transform —
     так проверялка видит настоящие места подписей */
  function shiftX(inner, dx) {
    return inner
      .replace(/\b(x|x1|x2|cx)="(-?[\d.]+)"/g, (m, a, v) => `${a}="${(+v + dx).toFixed(2)}"`)
      .replace(/points="([^"]+)"/g, (m, pts) => `points="${pts.trim().split(/\s+/)
        .map(p => { const c = p.split(","); return (+c[0] + dx).toFixed(2) + "," + c[1]; }).join(" ")}"`);
  }

  /* два готовых графика рядом, у каждого своя короткая подпись под полем */
  function pair(a, capA, b, capB, gap) {
    const dim = s => { const m = s.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); return [+m[1], +m[2]]; };
    const guts = s => s.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    const [wa, ha] = dim(a), [wb, hb] = dim(b);
    const shift = gap == null ? wa : gap;
    const H0 = Math.max(ha, hb);
    const caps = Math.max(capA.length, capB.length);
    const W = shift + wb, H = H0 + caps * 16 + 10;
    let s = guts(a) + shiftX(guts(b), shift);
    capA.forEach((t, i) => { s += text(46 + (wa - 126) / 2, H0 + 14 + i * 16, t, { size: 12, color: MUTE }); });
    capB.forEach((t, i) => { s += text(shift + 46 + (wb - 126) / 2, H0 + 14 + i * 16, t, { size: 12, color: MUTE }); });
    return svg(W, H, s);
  }

  Object.assign(DRAW, {
    /* ── teach[0]: ступенька под прямой — что именно идёт в формулу ── */
    slope_vStep() {
      return withCaption(GRAPH.plot({
        cell: 34,
        x: { label: "t, с", from: 0, to: 6, step: 1, tick: 1 },
        y: { label: "x, м", from: 0, to: 40, step: 10, tick: 10 },
        /* только рабочий кусок: до нуля не продлеваем, чтобы «числа с осей» не делились нацело */
        lines: [{ pts: [[2, 10], [6, 30]], color: ACC, dots: false }],
        guides: [[[2, 10], [6, 10], [6, 30]]],
        marks: [[2, 10], [6, 30]],
        notes: [
          { x: 1.9, y: 12.6, t: "2 с, 10 м", anchor: "end", size: 13 },
          { x: 5.95, y: 32, t: "6 с, 30 м", anchor: "end", size: 13 },
          { x: 4, y: 7.5, t: "прошло 4 с", anchor: "middle", size: 13, color: BLUE },
          { x: 6.08, y: 22, t: "набежало", anchor: "start", size: 13, color: BLUE },
          { x: 6.08, y: 17, t: "20 м", anchor: "start", size: 13, color: BLUE },
        ],
      }), ["20 метров за 4 секунды — это 5 метров",
           "в секунду. В формулу идут стороны",
           "ступеньки, а не числа с осей."]);
    },

    /* ── teach[2]: слева бывает координата, а бывает путь ── */
    slope_vXvsS() {
      const left = GRAPH.plot({
        cell: 24,
        x: { label: "t, с", from: 0, to: 6, step: 1, tick: 2 },
        y: { label: "x, м", from: 0, to: 12, step: 2, tick: 4 },
        lines: [{ pts: [[0, 0], [2, 8], [4, 8], [6, 2]], color: ACC, dots: false }],
      });
      const right = GRAPH.plot({
        cell: 24,
        x: { label: "t, с", from: 0, to: 6, step: 1, tick: 2 },
        y: { label: "S, м", from: 0, to: 12, step: 2, tick: 4 },
        lines: [{ pts: [[0, 0], [2, 8], [4, 8], [6, 12]], color: GREEN, dots: false }],
      });
      return withCaption(
        pair(left, ["координата: где тело сейчас,", "может уменьшаться"],
             right, ["путь: сколько накатано,", "уменьшаться не может"], 250),
        ["Слева бывает разное, а скорость в обоих",
         "случаях считается одинаково — по наклону."]);
    },

    /* ── teach[3]: ломаная — у каждого прямого куска своя скорость ── */
    slope_vPieces() {
      return withCaption(GRAPH.plot({
        cell: 26,
        x: { label: "t, с", from: 0, to: 6, step: 1, tick: 1 },
        y: { label: "x, м", from: 0, to: 10, step: 1, tick: 2 },
        lines: [{ pts: [[0, 0], [2, 2], [4, 8], [6, 0]], color: ACC, dots: false }],
        marks: [[0, 0], [2, 2], [4, 8], [6, 0]],
        notes: [
          { x: 1.35, y: 0.4, t: "1 м/с", anchor: "middle", size: 13, color: BLUE },
          { x: 3.1, y: 5.6, t: "3 м/с", anchor: "end", size: 13, color: BLUE },
          { x: 5.4, y: 2, t: "−4 м/с", anchor: "end", size: 13, color: BLUE },
          { x: 5.4, y: 1.3, t: "без знака 4", anchor: "end", size: 12, color: MUTE },
        ],
      }), ["Каждый прямой кусок — своя скорость. Самая большая скорость там,",
           "где линия круче всего, а знак говорит только про направление."]);
    },
  });

  /* помощники объявлены выше и используются рисунками; ссылка, чтобы линтер не ругался */
  void arrow; void body;
})();

if (typeof module !== "undefined" && module.exports) module.exports = DRAW;
