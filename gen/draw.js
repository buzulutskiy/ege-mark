/* global GRAPH */
/* Поясняющие рисунки к теории: не графики из условий задач, а картинки,
   которые объясняют саму мысль — что такое перемещение, где тут площадь,
   почему скорости складываются. Чистые строки SVG, без DOM.

   Каждая функция возвращает готовый <svg…>. Вызов: DRAW.pathVsMove().
   Все рисунки живут в координатах 0..W по горизонтали и 0..H по вертикали,
   рисуются одним стилем: тонкая серая сетка не нужна, подписи — Times, как в бланке. */

const DRAW = (function () {
  const F = "font-family:'Times New Roman',Times,Georgia,serif";
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
    /* 13px Times — это примерно 7 px на символ; берём 7,4 с запасом, чтобы строка точно влезла */
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

  return {
    /* ── Относительность: одно движение, два наблюдателя ── */
    frames() {
      let s = "";
      /* платформа */
      s += `<line x1="20" y1="150" x2="420" y2="150" stroke="${INK}" stroke-width="2"/>`;
      for (let x = 30; x < 420; x += 26) s += `<line x1="${x}" y1="150" x2="${x - 8}" y2="160" stroke="${MUTE}" stroke-width="1"/>`;
      /* вагон */
      s += `<rect x="90" y="70" width="230" height="70" rx="8" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
      s += `<circle cx="140" cy="148" r="12" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
      s += `<circle cx="270" cy="148" r="12" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
      /* пассажир внутри */
      s += body(180, 105, ACC);
      s += text(180, 128, "пассажир", { size: 12, color: MUTE });
      /* стрелки */
      s += arrow(320, 60, 400, 60, BLUE, 2.5);
      s += text(360, 50, "поезд 80 км/ч", { size: 13, color: BLUE });
      s += text(205, 190, "Относительно вагона пассажир стоит.", { size: 14 });
      s += text(205, 210, "Относительно платформы летит 80 км/ч.", { size: 14 });
      return withCaption(svg(420, 220, s), "Оба ответа верные — просто разные тела отсчёта.");
    },

    /* ── Ось, координата, знак ── */
    axis() {
      let s = "";
      const y = 70, x0 = 30, x1 = 400, zero = 215, step = 37;
      s += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${INK}" stroke-width="2"/>`;
      s += `<polygon points="${x1 + 12},${y} ${x1},${y - 5} ${x1},${y + 5}" fill="${INK}"/>`;
      s += text(x1 + 10, y - 12, "x", { italic: true, size: 15 });
      for (let i = -5; i <= 4; i++) {
        const x = zero + i * step;
        if (x < x0 || x > x1) continue;
        s += `<line x1="${x}" y1="${y - 5}" x2="${x}" y2="${y + 5}" stroke="${INK}" stroke-width="1.4"/>`;
        s += text(x, y + 22, String(i * 5).replace("-", "−"), { size: 13 });
      }
      s += body(zero - 2 * step, y, ACC);
      s += text(zero - 2 * step, y - 16, "тело", { size: 12, color: ACC });
      s += text(zero - 2 * step, 120, "координата −10", { size: 14, color: ACC, bold: true });
      return withCaption(svg(420, 132, s), "Минус не значит «ошибка». Он значит «слева от нуля».");
    },

    /* ── Путь и перемещение ── */
    pathVsMove() {
      let s = "";
      const A = [55, 155], B = [350, 75];
      /* петляющая траектория */
      s += `<path d="M ${A[0]} ${A[1]} C 110 40, 180 200, 240 90 S 320 150, ${B[0]} ${B[1]}"
        fill="none" stroke="${ACC}" stroke-width="2.5"/>`;
      s += arrow(A[0], A[1], B[0], B[1], BLUE, 2.5);
      s += body(A[0], A[1], INK); s += body(B[0], B[1], INK);
      s += text(A[0] - 6, A[1] + 26, "старт", { size: 13 });
      s += text(B[0] + 4, B[1] - 16, "финиш", { size: 13 });
      s += text(150, 45, "путь — вся линия", { size: 14, color: ACC, bold: true });
      s += text(255, 140, "перемещение — стрелка", { size: 14, color: BLUE, bold: true });
      return withCaption(svg(420, 186, s), [
        "Шагомер считает путь. Перемещение — только от старта до финиша.",
        "Вернулся домой — путь большой, перемещение ноль.",
      ]);
    },

    /* ── Как снять точку с графика ── */
    readPoint() {
      return withCaption(GRAPH.plot({
        cell: 32,
        x: { label: "t, с", from: 0, to: 8, step: 1, tick: 2 },
        y: { label: "x, м", from: 0, to: 60, step: 10, tick: 20 },
        lines: [{ pts: [[0, 10], [4, 40], [8, 50]] }],
        reads: [[4, 40, "4 с", "40 м"]],
      }), "Находишь секунду внизу, ведёшь вверх до линии, потом влево — читаешь число.");
    },

    /* ── Крутизна линии = скорость ── */
    slope() {
      return withCaption(GRAPH.plot({
        cell: 34,
        x: { label: "t, с", from: 0, to: 8, step: 2, tick: 2 },
        y: { label: "x, м", from: 0, to: 40, step: 10, tick: 10 },
        lines: [{ pts: [[0, 0], [4, 40]], color: "#c8571a" }, { pts: [[0, 0], [8, 20]], color: "#1d4ed8" }],
        notes: [{ x: 2.6, y: 32, t: "10 м/с", color: "#c8571a", size: 13, anchor: "start" },
                { x: 6.4, y: 13, t: "2,5 м/с", color: "#1d4ed8", size: 13, anchor: "start" }],
      }), "Обе линии прямые, но крутая набирает метры быстрее. Крутизна линии и есть скорость.");
    },

    /* ── Площадь под графиком скорости = путь ── */
    areaUnder() {
      return withCaption(GRAPH.plot({
        cell: 32,
        x: { label: "t, с", from: 0, to: 6, step: 1, tick: 1 },
        y: { label: "v, м/с", from: 0, to: 10, step: 2, tick: 2 },
        lines: [{ pts: [[0, 5], [6, 5]] }],
        fills: [{ pts: [[0, 0], [0, 5], [6, 5], [6, 0]], label: "путь = 30 м" }],
      }), "Скорость 5 м/с держится 6 секунд: 5 · 6 = 30 м. Это и есть площадь.");
    },

    /* ── Три фигуры, из которых состоит любая площадь ── */
    figures() {
      const one = (ox, pts, title, formula) => {
        let s = `<g transform="translate(${ox},0)">`;
        s += `<line x1="10" y1="110" x2="120" y2="110" stroke="${INK}" stroke-width="1.6"/>`;
        s += `<line x1="10" y1="110" x2="10" y2="20" stroke="${INK}" stroke-width="1.6"/>`;
        s += `<polygon points="${pts}" fill="${ACC}" fill-opacity="0.18" stroke="${ACC}" stroke-width="2"/>`;
        s += text(65, 136, title, { size: 13, bold: true });
        s += text(65, 155, formula, { size: 13, color: MUTE });
        return s + `</g>`;
      };
      let s = "";
      s += one(0, "10,110 10,45 100,45 100,110", "прямоугольник", "v · t");
      s += one(140, "10,110 100,45 100,110", "треугольник", "v · t : 2");
      s += one(280, "10,110 10,75 100,45 100,110", "трапеция", "средняя · t");
      return withCaption(svg(420, 168, s), [
        "Скорость не меняется — прямоугольник. От нуля или до нуля — треугольник.",
        "Меняется, но края не нулевые — трапеция.",
      ]);
    },

    /* ── Площадь со знаком: путь против перемещения ── */
    signedArea() {
      return withCaption(GRAPH.plot({
        cell: 30,
        x: { label: "t, с", from: 0, to: 8, step: 2, tick: 2 },
        y: { label: "v, м/с", from: -10, to: 10, step: 5, tick: 5 },
        lines: [{ pts: [[0, 10], [4, 0], [8, -10]] }],
        fills: [{ pts: [[0, 0], [0, 10], [4, 0]], label: "+20", color: "#0f766e", at: [1.1, 3.2] },
                { pts: [[4, 0], [8, -10], [8, 0]], label: "−20", color: "#c8571a", at: [6.9, -6] }],
      }), ["Путь складывает без знаков: 20 + 20 = 40 м.",
           "Перемещение — со знаками: 20 − 20 = 0. Тело вернулось."]);
    },

    /* ── Ускорение на графике скорости ── */
    accel() {
      return withCaption(GRAPH.plot({
        cell: 30,
        x: { label: "t, с", from: 0, to: 8, step: 2, tick: 2 },
        y: { label: "v, м/с", from: 0, to: 20, step: 5, tick: 5 },
        lines: [{ pts: [[0, 0], [4, 20], [8, 20]] }],
        notes: [{ x: 6, y: 17.5, t: "ровно", color: "#7a7a7a", size: 13 }],
      }), ["Наклонный кусок — скорость растёт, ускорение есть.",
           "Горизонтальный — скорость держится, ускорение ноль."]);
    },

    /* ── Река: собственная скорость, течение, снос ── */
    river() {
      let s = "";
      s += `<rect x="20" y="40" width="380" height="120" fill="#eef4fb" stroke="none"/>`;
      s += `<line x1="20" y1="40" x2="400" y2="40" stroke="${INK}" stroke-width="2"/>`;
      s += `<line x1="20" y1="160" x2="400" y2="160" stroke="${INK}" stroke-width="2"/>`;
      s += text(210, 28, "берег", { size: 12, color: MUTE });
      s += text(210, 178, "берег", { size: 12, color: MUTE });
      for (let x = 60; x < 380; x += 80) s += arrow(x, 150, x + 46, 150, "#9db8d6", 1.8);
      s += text(360, 140, "течение", { size: 12, color: "#5b7fa6" });
      const B = [140, 120];
      s += `<polygon points="${B[0] - 16},${B[1] + 7} ${B[0] + 16},${B[1] + 7} ${B[0] + 22},${B[1]} ${B[0] - 16},${B[1]}"
        fill="#fff" stroke="${INK}" stroke-width="2"/>`;
      s += arrow(B[0], B[1], B[0], 55, GREEN, 2.5);
      s += text(B[0] - 10, 80, "поперёк", { size: 12, color: GREEN, anchor: "end" });
      s += arrow(B[0], B[1], B[0] + 62, B[1], "#5b7fa6", 2.5);
      s += text(B[0] + 34, B[1] + 20, "снос", { size: 12, color: "#5b7fa6" });
      s += arrow(B[0], B[1], B[0] + 62, 55, ACC, 2.8);
      s += text(B[0] + 86, 78, "что видно", { size: 12, color: ACC, anchor: "start" });
      s += text(B[0] + 86, 94, "с берега", { size: 12, color: ACC, anchor: "start" });
      return withCaption(svg(420, 190, s), "Две скорости под прямым углом складываются по Пифагору.");
    },

    /* ── Движение внутри движения: пассажир в автобусе ── */
    inside() {
      let s = "";
      s += `<rect x="40" y="50" width="300" height="80" rx="10" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
      s += `<circle cx="100" cy="138" r="13" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
      s += `<circle cx="280" cy="138" r="13" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
      s += body(150, 90, ACC);
      s += arrow(163, 90, 215, 90, ACC, 2.2);
      s += text(190, 80, "1 м/с", { size: 12, color: ACC });
      s += arrow(350, 90, 405, 90, BLUE, 2.6);
      s += text(377, 78, "10 м/с", { size: 12, color: BLUE });
      s += text(210, 172, "Идёт вперёд: 10 + 1 = 11 м/с относительно дороги.", { size: 14 });
      return withCaption(svg(420, 186, s), "Шёл бы назад — вычитали бы: 10 − 1 = 9 м/с.");
    },

    /* ── Теорема Пифагора ── */
    pythagoras() {
      let s = "";
      const A = [70, 170], B = [70, 60], C = [270, 170];
      s += `<polygon points="${A[0]},${A[1]} ${B[0]},${B[1]} ${C[0]},${C[1]}" fill="${ACC}" fill-opacity="0.12"
        stroke="${ACC}" stroke-width="2.5"/>`;
      s += `<polyline points="${A[0] + 16},${A[1]} ${A[0] + 16},${A[1] - 16} ${A[0]},${A[1] - 16}"
        fill="none" stroke="${INK}" stroke-width="1.4"/>`;
      s += text(52, 118, "6", { size: 16, bold: true });
      s += text(170, 192, "8", { size: 16, bold: true });
      s += text(185, 105, "10", { size: 16, bold: true, color: ACC });
      s += text(300, 80, "путь: 6 + 8 = 14", { size: 13, anchor: "start", color: MUTE });
      s += text(300, 102, "перемещение: 10", { size: 13, anchor: "start", color: ACC });
      return withCaption(svg(420, 210, s), "Напрямую всегда короче, чем углом.");
    },

    /* ── Бросок вверх ── */
    throwUp() {
      let s = "";
      const x = 120, ground = 200;
      s += `<line x1="30" y1="${ground}" x2="230" y2="${ground}" stroke="${INK}" stroke-width="2"/>`;
      const lv = [[ground - 20, "20 м/с"], [ground - 70, "10 м/с"], [ground - 100, "0"], [ground - 70, "10 м/с"], [ground - 20, "20 м/с"]];
      s += arrow(x, ground - 14, x, ground - 62, ACC, 2.5);
      s += body(x, ground - 10, ACC);
      s += text(x - 14, ground - 40, "20 м/с", { size: 12, color: ACC, anchor: "end" });
      s += body(x, ground - 100, ACC);
      s += text(x - 14, ground - 104, "0", { size: 13, color: ACC, anchor: "end", bold: true });
      s += text(x + 16, ground - 104, "верхняя точка", { size: 12, color: MUTE, anchor: "start" });
      s += arrow(x + 90, ground - 90, x + 90, ground - 30, BLUE, 2.5);
      s += body(x + 90, ground - 100, BLUE);
      s += text(x + 104, ground - 60, "растёт", { size: 12, color: BLUE, anchor: "start" });
      s += text(x - 14, ground - 150, "тормозит", { size: 12, color: ACC, anchor: "end" });
      return withCaption(svg(420, 212, s), [
        "Вверх скорость падает на 10 м/с каждую секунду, вниз — растёт.",
        "В верхней точке она равна нулю.",
      ]);
    },

    /* ── Прямая против параболы ── */
    parabola() {
      const curve = [];
      for (let i = 0; i <= 32; i++) { const t = i / 8; curve.push([t, t * t / 2]); }
      return withCaption(GRAPH.plot({
        cell: 30,
        x: { label: "t, с", from: 0, to: 4, step: 1, tick: 1 },
        y: { label: "x, м", from: 0, to: 8, step: 2, tick: 2 },
        lines: [{ pts: [[0, 0], [4, 6]], color: "#1d4ed8", dots: false },
                { pts: curve, color: "#c8571a", dots: false, curve: true }],
        notes: [{ x: 0.4, y: 7.2, t: "разгон", color: "#c8571a", size: 13, anchor: "start" },
                { x: 3.9, y: 5.2, t: "ровно", color: "#1d4ed8", size: 13, anchor: "end" }],
      }), "Прямая линия — скорость не меняется. Изогнутая — тело разгоняется.");
    },

    /* ── «За третью секунду» ── */
    nthSecond() {
      return withCaption(GRAPH.plot({
        cell: 34,
        x: { label: "t, с", from: 0, to: 5, step: 1, tick: 1 },
        y: { label: "v, м/с", from: 0, to: 6, step: 2, tick: 2 },
        lines: [{ pts: [[0, 0], [1, 2], [4, 2], [5, 4]] }],
        fills: [{ pts: [[2, 0], [2, 2], [3, 2], [3, 0]], label: "2 м" }],
      }), "«Третья секунда» — это кусок от 2 до 3 с, а не первые три секунды.");
    },
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = DRAW;
