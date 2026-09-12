/* global GRAPH, DRAW */
/* Иллюстрации к приёму area_d — площадь со знаком.
   Два рисунка: знак проекции скорости = сторона движения,
   и координата как «старт плюс сдвиг» на числовой оси. */

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
    const inn = inner.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    const capH = out.length * 19 + 10;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + capH}" width="${W}" height="${H + capH}"
      style="max-width:100%;height:auto;background:#fff"><g>${inn}</g>
      ${out.map((t, i) => text(W / 2, H + 16 + i * 19, t, { size: 13, color: MUTE })).join("")}</svg>`;
  }

  /* ── свои мелочи ── */

  /* машинка: кузов, крыша, два колеса; смотрит вправо при dir=+1, влево при −1 */
  function car(cx, baseY, color, dir) {
    const d = dir < 0 ? -1 : 1;
    let s = `<g transform="translate(${cx},${baseY})${d < 0 ? " scale(-1,1)" : ""}">`;
    s += `<rect x="-26" y="-16" width="52" height="14" rx="4" fill="#fff" stroke="${color}" stroke-width="2"/>`;
    s += `<path d="M -14 -16 L -9 -25 L 11 -25 L 16 -16 Z" fill="#fff" stroke="${color}" stroke-width="2"/>`;
    s += `<circle cx="-14" cy="-1" r="5" fill="#fff" stroke="${color}" stroke-width="2"/>`;
    s += `<circle cx="14" cy="-1" r="5" fill="#fff" stroke="${color}" stroke-width="2"/>`;
    return s + `</g>`;
  }

  /* дуговая стрелка над числовой осью: от x1 к x2, горб высотой h */
  function arcArrow(x1, x2, y, h, color) {
    const mid = (x1 + x2) / 2, top = y - h;
    const dx = x2 - mid, dy = h;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, L = 11, W = 5;
    const bx = x2 - L * ux, by = y - L * uy;
    let s = `<path d="M ${x1} ${y} Q ${mid} ${top} ${bx} ${by}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>`;
    s += `<polygon points="${x2},${y} ${bx + W * uy},${by - W * ux} ${bx - W * uy},${by + W * ux}" fill="${color}"/>`;
    return s;
  }

  /* Вклеить готовый график GRAPH.plot в общую картинку ярусом ниже.
     Координаты сдвигаем прямо в разметке (а не через transform), чтобы
     положение подписей совпадало с тем, что видно глазом. */
  function placeBelow(inner, dy) {
    let b = inner.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    b = b.replace(/\s(y|y1|y2|cy)="([-\d.]+)"/g, (m, a, v) => ` ${a}="${Math.round((+v + dy) * 100) / 100}"`);
    b = b.replace(/points="([^"]+)"/g, (m, p) => `points="${p.trim().split(/\s+/).map(pair => {
      const c = pair.split(",");
      return c[0] + "," + Math.round((+c[1] + dy) * 100) / 100;
    }).join(" ")}"`);
    return b;
  }

  Object.assign(DRAW, {
    /* ── Знак проекции = сторона движения ── */
    area_dSignSide() {
      let s = "";
      const aL = 20, aR = 390;
      /* два ряда с машиной: ось OX — пространственная, без чисел */
      const row = (y, dir, label, color) => {
        let r = "";
        r += `<line x1="${aL}" y1="${y}" x2="${aR}" y2="${y}" stroke="${INK}" stroke-width="1.8"/>`;
        r += `<polygon points="${aR + 12},${y} ${aR},${y - 5} ${aR},${y + 5}" fill="${INK}"/>`;
        r += text(aR + 6, y + 22, "OX", { size: 13, anchor: "end", italic: true });
        r += car(118, y, color, dir);
        if (dir > 0) r += arrow(158, y - 40, 260, y - 40, color, 2.4);
        else r += arrow(78, y - 40, 20, y - 40, color, 2.4);
        r += text(120, y - 56, label, { size: 14, color: color, bold: true });
        return r;
      };
      s += row(78, +1, "по оси: vₓ = +5", GREEN);
      s += row(184, -1, "против оси: vₓ = −5", ACC);

      /* третий ярус: график vₓ(t) во всю ширину.
         cell = 29,4 подобрана так, чтобы ширина графика вышла ровно 420 px */
      const g = GRAPH.plot({
        cell: 29.4,
        x: { label: "t, с", from: 0, to: 5, step: 0.5, tick: 1 },
        y: { label: "vₓ, м/с", from: -5, to: 5, step: 1, tick: 5 },
        lines: [{ pts: [[0, 5], [2, 5], [3, -5], [5, -5]], color: INK, dots: false }],
        fills: [{ pts: [[0, 0], [0, 5], [2, 5], [2.5, 0]], label: "вперёд", color: GREEN, at: [1, 2.5] },
                { pts: [[2.5, 0], [3, -5], [5, -5], [5, 0]], label: "назад", color: ACC, at: [4, -2.5] }],
      });
      const gh = +g.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)[2];
      const top = 218;
      s += placeBelow(g, top);

      return withCaption(svg(420, top + gh, s), [
        "Спидометр в обоих случаях показывает 5.",
        "Знак говорит не про быстроту, а про сторону.",
      ]);
    },

    /* ── Координата = старт плюс сдвиг ── */
    area_dStartPlusShift() {
      let s = "";

      /* верхний ряд: 0 … 20, старт 10, сдвиг +7, финиш 17 */
      const yA = 92, aL = 40, aR = 380;
      const pA = v => aL + (v - 0) * (aR - aL) / 20;
      s += `<line x1="${aL - 12}" y1="${yA}" x2="${aR + 8}" y2="${yA}" stroke="${INK}" stroke-width="1.8"/>`;
      s += `<polygon points="${aR + 20},${yA} ${aR + 8},${yA - 5} ${aR + 8},${yA + 5}" fill="${INK}"/>`;
      s += text(aR + 20, yA - 12, "x", { italic: true, size: 15 });
      [0, 5, 10, 15, 20].forEach(v => {
        s += `<line x1="${pA(v)}" y1="${yA - 5}" x2="${pA(v)}" y2="${yA + 5}" stroke="${INK}" stroke-width="1.3"/>`;
        s += text(pA(v), yA + 20, String(v), { size: 13 });
      });
      /* своё деление с числом у финиша, иначе точка висит между 15 и 20 */
      s += `<line x1="${pA(17)}" y1="${yA - 5}" x2="${pA(17)}" y2="${yA + 28}" stroke="${GREEN}" stroke-width="1.6"/>`;
      s += text(pA(17), yA + 38, "17", { size: 13, color: GREEN, bold: true });
      s += arcArrow(pA(10), pA(17), yA - 6, 34, BLUE);
      s += text((pA(10) + pA(17)) / 2, yA - 50, "сдвиг sₓ = +7", { size: 14, color: BLUE, bold: true });
      s += `<circle cx="${pA(10)}" cy="${yA}" r="5.5" fill="${ACC}"/>`;
      s += `<circle cx="${pA(17)}" cy="${yA}" r="5.5" fill="${GREEN}"/>`;
      s += text(pA(10), yA + 58, "старт, x₀ = 10", { size: 14, color: ACC, bold: true });
      s += text(pA(17), yA + 58, "x = 17", { size: 14, color: GREEN, bold: true });

      /* нижний ряд: −10 … 25, старт −5, сдвиг +24, финиш 19 */
      const yB = 246, bL = 40, bR = 380;
      const pB = v => bL + (v + 10) * (bR - bL) / 35;
      s += `<line x1="${bL - 12}" y1="${yB}" x2="${bR + 8}" y2="${yB}" stroke="${INK}" stroke-width="1.8"/>`;
      s += `<polygon points="${bR + 20},${yB} ${bR + 8},${yB - 5} ${bR + 8},${yB + 5}" fill="${INK}"/>`;
      s += text(bR + 20, yB - 12, "x", { italic: true, size: 15 });
      [-10, -5, 0, 5, 10, 15, 20, 25].forEach(v => {
        s += `<line x1="${pB(v)}" y1="${yB - 5}" x2="${pB(v)}" y2="${yB + 5}" stroke="${INK}" stroke-width="1.3"/>`;
        s += text(pB(v), yB + 20, String(v).replace("-", "−"), { size: 13 });
      });
      s += `<line x1="${pB(19)}" y1="${yB - 5}" x2="${pB(19)}" y2="${yB + 28}" stroke="${GREEN}" stroke-width="1.6"/>`;
      s += text(pB(19), yB + 38, "19", { size: 13, color: GREEN, bold: true });
      s += arcArrow(pB(-5), pB(19), yB - 6, 34, BLUE);
      s += text((pB(-5) + pB(19)) / 2, yB - 50, "сдвиг sₓ = +24", { size: 14, color: BLUE, bold: true });
      s += `<circle cx="${pB(-5)}" cy="${yB}" r="5.5" fill="${ACC}"/>`;
      s += `<circle cx="${pB(19)}" cy="${yB}" r="5.5" fill="${GREEN}"/>`;
      s += text(pB(-5), yB + 58, "старт, x₀ = −5", { size: 14, color: ACC, bold: true });
      s += text(pB(19), yB + 58, "x = 19", { size: 14, color: GREEN, bold: true });

      return withCaption(svg(420, 316, s), [
        "Сдвиг sₓ — это площадь под графиком скорости.",
        "Площадь даёт только длину стрелки. Координата — это старт плюс стрелка.",
      ]);
    },
  });
})();

if (typeof module !== "undefined" && module.exports) module.exports = DRAW;
