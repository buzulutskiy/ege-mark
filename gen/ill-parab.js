/* global GRAPH, DRAW */
/* Иллюстрации к приёму «parab» — разгон из покоя: парабола координаты,
   сдвиг x − x₀, разница между «где тело» и «как быстро», таблица как те же точки.
   Чистые строки SVG, без DOM: работает и в браузере (глобалы DRAW, GRAPH), и в node. */

/* Всё в замыкании: имена esc, text, svg не должны утекать в приложение —
   там уже есть свои, и повторное объявление const ломает загрузку страницы. */
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
  const body = inner.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const capH = out.length * 19 + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + capH}" width="${W}" height="${H + capH}"
      style="max-width:100%;height:auto;background:#fff"><g>${body}</g>
      ${out.map((t, i) => text(W / 2, H + 16 + i * 19, t, { size: 13, color: MUTE })).join("")}</svg>`;
}

/* ── свои мелочи ── */
/* дописать свой слой поверх готового GRAPH.plot */
function over(plot, extra) { return plot.replace(/<\/svg>\s*$/, extra + "</svg>"); }
/* вынуть содержимое чужого <svg> и его размеры */
function guts(s) { return s.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, ""); }
function dims(s) { const m = s.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); return [+m[1], +m[2]]; }
/* сдвинуть готовый кусок SVG по-настоящему, а не через transform:
   так проверка подписей видит их настоящие места */
function shift(inner, dx, dy) {
  const mv = (v, d) => Math.round((+v + d) * 100) / 100;
  return inner
    .replace(/\b(x|x1|x2|cx)="(-?[\d.]+)"/g, (m, a, v) => `${a}="${mv(v, dx)}"`)
    .replace(/\b(y|y1|y2|cy)="(-?[\d.]+)"/g, (m, a, v) => `${a}="${mv(v, dy)}"`)
    .replace(/points="([^"]*)"/g, (m, p) => `points="${p.trim().split(/\s+/)
      .map(q => { const c = q.split(","); return mv(c[0], dx) + "," + mv(c[1], dy); }).join(" ")}"`);
}
/* фигурная скобка вдоль вертикали, носик смотрит вправо */
function braceV(x, y1, y2, color, w) {
  w = w || 7;
  const ym = (y1 + y2) / 2;
  return `<path d="M ${x} ${y1} q ${w} 0 ${w} ${w} L ${x + w} ${ym - w} q 0 ${w} ${w} ${w}
      q ${-w} 0 ${-w} ${w} L ${x + w} ${y2 - w} q 0 ${w} ${-w} ${w}"
      fill="none" stroke="${color || INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
}
/* кольцо вокруг точки */
function ring(x, y, color, r) { return `<circle cx="${x}" cy="${y}" r="${r || 9}" fill="none" stroke="${color || ACC}" stroke-width="2"/>`; }
/* дуговая стрелка: строки таблицы идут сверху вниз, а точки на графике — снизу вверх,
   поэтому прямые стрелки перепутались бы; дуга разводит их и даёт проследить каждую */
function curveArrow(x1, y1, x2, y2, cx, cy, color) {
  const tx = x2 - cx, ty = y2 - cy, L = Math.hypot(tx, ty) || 1;
  const ux = tx / L, uy = ty / L, H = 9, Wd = 4;
  const bx = x2 - H * ux, by = y2 - H * uy;
  return `<path d="M ${x1} ${y1} Q ${cx} ${cy} ${bx} ${by}" fill="none" stroke="${color}" stroke-width="1.4"/>
      <polygon points="${x2},${y2} ${bx - Wd * uy},${by + Wd * ux} ${bx + Wd * uy},${by - Wd * ux}" fill="${color}"/>`;
}
/* выборка кривой x = x0 + a·t²/2 по шагу */
function parabPts(x0, a, from, to, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = from + (to - from) * i / n; pts.push([t, x0 + a * t * t / 2]); }
  return pts;
}

Object.assign(DRAW, {
  /* ── teach[1]: в формулу идёт сдвиг, а не сама координата ── */
  parabShift() {
    const cell = 34, mL = 46, mT = 28;
    const sx = cell / 0.5, sy = cell / 2;              /* 68 и 17 пикселей на единицу */
    const px = u => mL + u * sx;
    const py = u => mT + (12 - u) * sy;
    const plot = GRAPH.plot({
      cell,
      x: { label: "t, с", from: 0, to: 3, step: 0.5, tick: 1 },
      y: { label: "x, м", from: 0, to: 12, step: 2, tick: 2 },
      lines: [{ pts: parabPts(2, 2, 0, 3, 60), color: ACC, dots: false, curve: true }],
      guides: [[[0, 2], [3, 2]]],
      reads: [[2, 6, "t = 2 с", "x = 6 м"]],
      notes: [{ x: 0.1, y: 1, t: "старт, x₀ = 2", color: MUTE, size: 13, anchor: "start" }],
    });
    let s = ring(px(2), py(6), ACC, 9);
    s += braceV(px(2.25), py(6), py(2), INK, 7);
    s += text(px(2.25) + 22, py(4) - 7, "сдвиг", { size: 13, anchor: "start", color: INK });
    s += text(px(2.25) + 22, py(4) + 10, "x − x₀ = 4 м", { size: 13, anchor: "start", color: INK, bold: true });
    return withCaption(over(plot, s), "В формулу идёт не шестёрка, а сдвиг — 4 метра.");
  },

  /* ── teach[2]: где тело и как быстро — это разные числа ── */
  parabWhereVsFast() {
    const left = GRAPH.plot({
      cell: 24,
      x: { label: "t, с", from: 0, to: 3.5, step: 0.5, tick: 1 },
      y: { label: "x, м", from: 0, to: 20, step: 2.5, tick: 5 },
      lines: [{ pts: parabPts(0, 4, 0, 3, 60), color: ACC, dots: false, curve: true }],
      reads: [[3, 18, "3 с", "18 м"]],
    });
    const right = GRAPH.plot({
      cell: 24,
      x: { label: "t, с", from: 0, to: 3.5, step: 0.5, tick: 1 },
      y: { label: "v, м/с", from: 0, to: 14, step: 2, tick: 4 },
      lines: [{ pts: [[0, 0], [3, 12]], color: BLUE, dots: true }],
      reads: [[3, 12, "3 с", "12 м/с"]],
    });
    const [lw, lh] = dims(left), [rw, rh] = dims(right);
    const gap = 10, top = 26, rdy = top + (lh - rh);
    const W = lw + gap + rw, H = top + lh;
    let s = shift(guts(left), 0, top);
    s += shift(guts(right), lw + gap, rdy);
    s += text(lw / 2, 18, "где тело", { size: 14, bold: true, color: ACC });
    s += text(lw + gap + rw / 2, 18, "как быстро", { size: 14, bold: true, color: BLUE });
    return withCaption(svg(W, H, s),
      "Одна и та же третья секунда. Слева место, справа скорость — числа разные.");
  },

  /* ── teach[3]: строки таблицы — это точки той же дуги ── */
  parabTable() {
    const cell = 24, dx = 150, mL = 46, mT = 28;
    const sx = cell / 0.5, sy = cell / 1;             /* 48 и 24 пикселя на единицу */
    const px = u => dx + mL + u * sx;
    const py = u => mT + (8 - u) * sy;
    const plot = GRAPH.plot({
      cell,
      x: { label: "t, с", from: 0, to: 3, step: 0.5, tick: 1 },
      y: { label: "x, м", from: 0, to: 8, step: 1, tick: 2 },
      lines: [{ pts: parabPts(2, 2, 0, Math.sqrt(6), 60), color: ACC, dots: false, curve: true }],
      notes: [{ x: 0.3, y: 1.5, t: "старт, x₀", color: ACC, size: 12, anchor: "start" }],
    });
    const [pw, ph] = dims(plot);
    const W = dx + pw, H = ph;

    /* таблица слева: шапка и три строки */
    const rows = [[0, 2], [1, 3], [2, 6]];
    const tx = 8, tw = 116, col = tx + 58;
    const head = 88, r0 = 114, dr = 26;
    let s = `<rect x="${tx}" y="${head - 20}" width="${tw}" height="${20 + dr * 3 + 10}" rx="4"
      fill="#fff" stroke="${INK}" stroke-width="1.4"/>`;
    s += `<line x1="${tx}" y1="${head + 6}" x2="${tx + tw}" y2="${head + 6}" stroke="${INK}" stroke-width="1.4"/>`;
    s += `<line x1="${col}" y1="${head - 20}" x2="${col}" y2="${head + 6 + dr * 3}" stroke="${INK}" stroke-width="1"/>`;
    /* шапка как на осях: буква курсивом, единица прямая */
    const th = (x, l, u) => `<text x="${x}" y="${head}" font-size="13" ${F} text-anchor="middle" fill="${INK}"><tspan font-style="italic">${l}</tspan>, ${u}</text>`;
    s += th(tx + 29, "t", "с");
    s += th(col + 29, "x", "м");
    rows.forEach((r, i) => {
      const y = r0 + i * dr, c = i === 0 ? ACC : INK;
      s += text(tx + 29, y, String(r[0]), { size: 14, color: c, bold: i === 0 });
      s += text(col + 29, y, String(r[1]), { size: 14, color: c, bold: i === 0 });
    });

    /* стрелки: каждая строка — к своей точке на дуге */
    const cols = [ACC, BLUE, GREEN];
    const bow = [45, 0, -60];
    rows.forEach((r, i) => {
      const X = px(r[0]), Y = py(r[1]);
      const x1 = tx + tw + 6, y1 = r0 + i * dr - 5;
      const a = Math.atan2(Y - y1, X - x1);
      s += curveArrow(x1, y1, X - 11 * Math.cos(a), Y - 11 * Math.sin(a),
        x1 + (X - x1) * 0.45, y1 + bow[i], cols[i]);
    });

    /* точки на дуге поверх графика */
    let dots = "";
    rows.forEach((r, i) => { dots += ring(px(r[0]), py(r[1]), i === 0 ? ACC : INK, 6); });

    const inner = shift(guts(plot), dx, 0) + s + dots;
    return withCaption(svg(W, H, inner), "Три строки таблицы — три точки одной и той же дуги.");
  },
});
})();

if (typeof module !== "undefined" && module.exports) module.exports = DRAW;
