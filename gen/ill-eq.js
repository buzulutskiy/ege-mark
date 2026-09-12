/* global GRAPH, DRAW */
/* Иллюстрации к приёму «Когда движение задано формулой» (key: eq).
   Три картинки: как читают формулу по кусочкам, как её ставят под шаблон
   и откуда берётся двойка при t², и что значит «встретились». */

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
  /* формула: буквы величин курсивом, цифры и знаки прямым — как в бланке */
  function mathText(x, y, t, o) {
    o = o || {};
    const parts = esc(t).replace(/[a-zA-Z]/g, c => `<tspan font-style="italic">${c}</tspan>`);
    return `<text x="${x}" y="${y}" font-size="${o.size || 14}" ${F} text-anchor="${o.anchor || "middle"}"
      fill="${o.color || INK}"${o.bold ? ' font-weight="bold"' : ""}>${parts}</text>`;
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
    const inner2 = inner.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    const capH = out.length * 19 + 10;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + capH}" width="${W}" height="${H + capH}"
      style="max-width:100%;height:auto;background:#fff"><g>${inner2}</g>
      ${out.map((t, i) => text(W / 2, H + 16 + i * 19, t, { size: 13, color: MUTE })).join("")}</svg>`;
  }

  Object.assign(DRAW, {

    /* ── Чек такси и формула координаты читаются одинаково ── */
    eqReadFormula() {
      let s = "";

      /* левая половина: чек. Рамка сужена до x = 178, чтобы мостик её не задевал */
      const CX = 97;
      s += `<rect x="16" y="36" width="162" height="116" rx="10" fill="#fff" stroke="${MUTE}" stroke-width="1.4"/>`;
      s += text(CX, 52, "чек за поездку", { size: 12, color: MUTE });
      s += text(CX, 80, "посадка — 100 ₽", { size: 14, color: GREEN, bold: true });
      s += text(CX, 106, "30 ₽ × 4 км", { size: 14, color: ACC, bold: true });
      s += `<line x1="30" y1="118" x2="164" y2="118" stroke="${MUTE}" stroke-width="1"/>`;
      s += text(CX, 140, "итого 220 ₽", { size: 15, bold: true });

      /* мостик между половинами */
      s += arrow(188, 92, 232, 92, INK, 1.8);
      s += text(212, 78, "читается", { size: 11, color: MUTE });
      s += text(212, 112, "одинаково", { size: 11, color: MUTE });

      /* правая половина: формула по кусочкам */
      s += text(244, 92, "x", { size: 24, italic: true });
      s += text(262, 92, "=", { size: 24 });
      s += text(284, 92, "4", { size: 24, color: GREEN, bold: true });
      s += text(306, 92, "−", { size: 24 });
      s += text(324, 92, "2", { size: 24, color: ACC, bold: true });
      s += text(340, 92, "t", { size: 24, color: BLUE, bold: true, italic: true });

      /* выноски вниз: какой кусок что значит.
         Горизонтальный хвост доходит до правого края своей строки легенды. */
      const leg = (y, tok, tokColor, ital, label) => {
        let g = text(30, y, tok, { size: 16, color: tokColor, bold: true, italic: !!ital });
        g += text(52, y, label, { size: 13, color: INK, anchor: "start" });
        return g;
      };
      const lead = (x, yRow, endX, color) =>
        `<polyline fill="none" stroke="${color}" stroke-width="1.2" stroke-dasharray="4 3"
          points="${x},104 ${x},${yRow - 4} ${endX},${yRow - 4}"/>`;
      s += lead(284, 176, 178, GREEN);
      s += lead(324, 202, 234, ACC);
      s += lead(340, 246, 206, BLUE);
      s += leg(176, "4", GREEN, false, "откуда стартовали");
      s += leg(202, "−2", ACC, false, "сколько метров за секунду");
      s += text(52, 219, "минус — против оси", { size: 12, color: MUTE, anchor: "start" });
      s += leg(246, "t", BLUE, true, "сколько секунд прошло");

      return withCaption(svg(420, 256, s), [
        "Сто рублей уже набежали до поездки, тридцать добавляется за каждый километр.",
        "В формуле так же: 4 — где стартовали, 2 — метры за секунду, минус — против оси.",
      ]);
    },

    /* ── Формула под шаблоном: при t² стоит половина ускорения ── */
    eqTemplateMatch() {
      let s = "";
      const XA = 125, XB = 205, XC = 305;

      s += text(28, 40, "шаблон", { size: 12, color: MUTE, anchor: "start" });
      s += mathText(28, 64, "x =", { size: 20, anchor: "start" });
      s += mathText(XA, 64, "x₀", { size: 20 });
      s += text(160, 64, "+", { size: 20 });
      s += mathText(XB, 64, "v₀ · t", { size: 20 });
      s += text(252, 64, "+", { size: 20 });
      s += mathText(XC, 64, "a · t²/2", { size: 20, color: ACC });

      /* стрелки начинаются ниже ярлыка строки, чтобы не делить с ним высоту */
      s += arrow(XA, 84, XA, 118, MUTE, 1.4);
      s += arrow(XB, 84, XB, 118, MUTE, 1.4);
      s += arrow(XC, 84, XC, 118, ACC, 2.2);

      s += text(28, 108, "твоя формула", { size: 12, color: MUTE, anchor: "start" });
      s += mathText(28, 140, "x =", { size: 20, anchor: "start" });
      s += mathText(XA, 140, "5", { size: 20 });
      s += text(160, 140, "+", { size: 20 });
      s += mathText(XB, 140, "2 · t", { size: 20 });
      s += text(252, 140, "+", { size: 20 });
      s += mathText(XC, 140, "4 · t²", { size: 20, color: ACC, bold: true });

      s += mathText(XC, 172, "половина a", { size: 13, color: ACC });
      s += mathText(210, 214, "a = 4 · 2 = 8", { size: 22, color: ACC, bold: true });

      return withCaption(svg(420, 240, s), [
        "Сравниваешь слагаемое со слагаемым — и все числа у тебя есть.",
        "Четвёрка при t² — только половина ускорения, само оно вдвое больше.",
      ]);
    },

    /* ── Встреча: координаты стали одним числом ── */
    eqMeet() {
      let s = "";
      const y = 110, px = u => 40 + 3.25 * u, LANE = 92;

      /* ось координат */
      s += `<line x1="34" y1="${y}" x2="372" y2="${y}" stroke="${INK}" stroke-width="1.8"/>`;
      s += `<polygon points="384,${y} 372,${y - 5} 372,${y + 5}" fill="${INK}"/>`;
      s += `<text x="388" y="${y + 4}" font-size="14" ${F} text-anchor="start"><tspan font-style="italic">x</tspan>, м</text>`;
      [0, 20, 40, 60, 80, 100].forEach(u => {
        s += `<line x1="${px(u)}" y1="${y - 5}" x2="${px(u)}" y2="${y + 5}" stroke="${INK}" stroke-width="1.2"/>`;
        s += text(px(u), y + 20, String(u), { size: 12.5 });
      });

      /* два тела в начале движения — та же высота, что и в точке встречи */
      s += body(px(0), LANE, ACC);
      s += arrow(px(0) + 10, LANE, px(0) + 38, LANE, ACC, 2.2);
      s += text(px(0) + 24, 80, "2 м/с", { size: 13, color: ACC });
      s += body(px(100), LANE, BLUE);
      s += arrow(px(100) - 10, LANE, px(100) - 48, LANE, BLUE, 2.2);
      s += text(px(100) - 29, 80, "8 м/с", { size: 13, color: BLUE });

      /* точка встречи: оба тела на той же высоте, подпись поднята над ними */
      s += `<circle cx="${px(20)}" cy="${y}" r="10" fill="none" stroke="${INK}" stroke-width="1.8"/>`;
      s += body(px(20) - 9, LANE, ACC);
      s += body(px(20) + 9, LANE, BLUE);
      s += `<line x1="${px(20)}" y1="64" x2="${px(20)}" y2="83" stroke="${MUTE}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
      s += mathText(px(20), 56, "t = 10 с, x = 20 м", { size: 13, bold: true });

      /* пути до встречи */
      s += arrow(px(0), 148, px(20) - 8, 148, ACC, 1.6, "5 4");
      s += text(68, 136, "20 м", { size: 12, color: ACC });
      s += arrow(px(100), 164, px(20) + 8, 164, BLUE, 1.6, "5 4");
      s += text(240, 152, "80 м", { size: 12, color: BLUE });

      return withCaption(svg(420, 180, s), [
        "Встретились — значит, x₁ и x₂ стали одним и тем же числом.",
        "Приравнял формулы — нашёл время; координату подставляешь отдельным шагом.",
      ]);
    },
  });
})();

if (typeof module !== "undefined" && module.exports) module.exports = DRAW;
