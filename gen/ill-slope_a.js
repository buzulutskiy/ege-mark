/* global GRAPH, DRAW */
/* Поясняющие рисунки к приёму slope_a — «ускорение по наклону графика скорости».
   Объясняют ровно три мысли теории: высота линии ≠ её наклон; минус у скорости
   и двойное вычитание; три вида задач, которые видно по самой линии.

   Работает и в браузере (DRAW и GRAPH — глобалы), и в node. */

(function () {
  /* готовый атрибут style — вставляется в <text> целиком, как в draw.js */
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
    const bodyStr = inner.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    const capH = out.length * 19 + 10;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + capH}" width="${W}" height="${H + capH}"
      style="max-width:100%;height:auto;background:#fff"><g>${bodyStr}</g>
      ${out.map((t, i) => text(W / 2, H + 16 + i * 19, t, { size: 13, color: MUTE })).join("")}</svg>`;
  }

  Object.assign(DRAW, {

    /* ── teach[1]: высота линии — скорость, наклон — ускорение ── */
    slope_aHeightVsSlope() {
      return withCaption(GRAPH.plot({
        cell: 32,
        x: { label: "t, с", from: 0, to: 10, step: 1, tick: 2 },
        /* клетка 1,5 м/с: подписи идут через 5, как в заказе, а 9 попадает на узел */
        y: { label: "v, м/с", from: 0, to: 15, step: 1.5, tick: 5 },
        lines: [{ pts: [[0, 0], [10, 15]], color: ACC }],
        fills: [{ pts: [[0, 0], [10, 0], [10, 15]], color: GREEN, op: 0.1, dash: "5 4" }],
        reads: [[6, 9, "6 с", "9 м/с"]],
        notes: [
          /* подпись высоты — ПОД линией, рядом с точкой (6; 9), чтобы «это» было понятно */
          { x: 6.3, y: 7.8, t: "высота 9 м/с", color: BLUE, size: 13, anchor: "start" },
          /* подпись наклона — внутри залитого треугольника, правее пунктира x = 6 */
          { x: 8.2, y: 3, t: "наклон 1,5 м/с²", color: GREEN, size: 13 },
          { x: 3.2, y: 0.8, t: "10 с", color: GREEN, size: 13 },
          { x: 10.3, y: 8, t: "15 м/с", color: GREEN, size: 13, anchor: "start" },
        ],
      }), "Высота линии — скорость в этот момент. Наклон линии — ускорение. Это разные числа.");
    },

    /* ── teach[2]: минус у скорости и вычитание минуса ── */
    slope_aSignCross() {
      /* место разворота: линия пересекает ось на t = 23⅓ — это не узел сетки,
         поэтому там только точка и выноска, а сетку держим круглой: клетка 5 с */
      const cross = 20 + 10 / 3;
      return withCaption(GRAPH.plot({
        cell: 40,
        x: { label: "t, с", from: 0, to: 30, step: 5, tick: 10 },
        y: { label: "v, м/с", from: -15, to: 20, step: 5, tick: 5 },
        lines: [{ pts: [[20, -10], [30, 20]], color: ACC }],
        marks: [[cross, 0]],
        guides: [[[22.3, 2.4], [cross, 0.35]]],
        notes: [
          { x: 19.4, y: -10, t: "−10", color: ACC, size: 13, anchor: "end" },
          { x: 30.4, y: 20, t: "20", color: ACC, size: 13, anchor: "start" },
          { x: 22, y: 3, t: "здесь развернулось", color: GREEN, size: 13, anchor: "end" },
        ],
      }), "Ниже оси — тело едет против оси Ox, выше — по оси. Изменение скорости: 20 − (−10) = 30.");
    },

    /* ── teach[3]: три вида задач видно по самой линии ── */
    slope_aThreeKinds() {
      /* один мини-график: оси, линия, выделенный кусок, две строки подписи.
         Координаты сразу абсолютные — без transform, чтобы подписи честно
         считались проверкой границ. */
      /* строка подписи: обычная — строкой, с курсивной буквой величины — {raw} */
      const line = (x, y, v, o) => (v && v.raw)
        ? `<text x="${x}" y="${y}" font-size="${o.size}" ${F} text-anchor="middle"
            fill="${o.color || INK}"${o.bold ? ' font-weight="bold"' : ""}>${v.raw}</text>`
        : text(x, y, v, o);

      const panel = (ox, inner, ls) => {
        let s = arrow(ox + 12, 100, ox + 108, 100, INK, 1.5);
        s += arrow(ox + 18, 100, ox + 18, 16, INK, 1.5);
        s += `<text x="${ox + 14}" y="12" font-size="10.5" ${F} text-anchor="start" fill="${INK}"><tspan font-style="italic">v</tspan>, м/с</text>`;
        s += `<text x="${ox + 111}" y="104" font-size="10.5" ${F} text-anchor="start" fill="${INK}"><tspan font-style="italic">t</tspan>, с</text>`;
        s += inner;
        ls.forEach((l, i) => {
          s += line(ox + 62, 122 + i * 15, l, { size: 11.5, color: i ? ACC : INK, bold: i > 0 });
        });
        return s;
      };

      /* 1. ровный кусок */
      const a = ox =>
        `<line x1="${ox + 20}" y1="58" x2="${ox + 104}" y2="58" stroke="${INK}" stroke-width="1.6"/>` +
        `<line x1="${ox + 44}" y1="58" x2="${ox + 80}" y2="58" stroke="${ACC}" stroke-width="4" stroke-linecap="round"/>`;

      /* 2. один наклонный кусок между двумя отметками на оси времени */
      const yAt = x => +(92 - (x - 20) * (66 / 84)).toFixed(1);
      const b = ox => {
        let s = `<line x1="${ox + 20}" y1="92" x2="${ox + 104}" y2="26" stroke="${INK}" stroke-width="1.6"/>`;
        s += `<line x1="${ox + 44}" y1="${yAt(44)}" x2="${ox + 80}" y2="${yAt(80)}" stroke="${ACC}" stroke-width="4" stroke-linecap="round"/>`;
        [44, 80].forEach(x => {
          s += `<line x1="${ox + x}" y1="${yAt(x)}" x2="${ox + x}" y2="100" stroke="${MUTE}" stroke-width="1" stroke-dasharray="4 3"/>`;
          s += `<line x1="${ox + x}" y1="96" x2="${ox + x}" y2="104" stroke="${INK}" stroke-width="1.4"/>`;
        });
        return s;
      };

      /* 3. ломаная из четырёх кусков, самый крутой выделен */
      const P = [[20, 88], [41, 80], [62, 32], [83, 44], [104, 38]];
      const c = ox => {
        let s = `<polyline fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"
          points="${P.map(p => (p[0] + ox) + "," + p[1]).join(" ")}"/>`;
        s += `<line x1="${ox + 41}" y1="80" x2="${ox + 62}" y2="32" stroke="${ACC}" stroke-width="4" stroke-linecap="round"/>`;
        P.forEach(p => { s += `<circle cx="${p[0] + ox}" cy="${p[1]}" r="2.4" fill="${INK}"/>`; });
        return s;
      };

      /* буква величины — курсивом, как на осях */
      const aZero = { raw: `<tspan font-style="italic">a</tspan> = 0` };
      let s = panel(0, a(0), ["ровный кусок", aZero]);
      s += panel(140, b(140), ["один кусок", "одна дробь"]);
      s += panel(280, c(280), ["несколько кусков", "считаем все", "выбираем по модулю"]);
      return withCaption(svg(420, 158, s), [
        "Посмотри на линию — сразу видно, сколько считать.",
        "Модуль — это число без знака: у −2 модуль равен 2.",
      ]);
    },
  });

  /* помощники объявлены — глушим предупреждения линтера о неиспользованных */
  void body;
})();

if (typeof module !== "undefined" && module.exports) module.exports = DRAW;
