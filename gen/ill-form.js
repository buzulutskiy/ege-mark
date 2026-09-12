/* global GRAPH, DRAW */
/* Поясняющие рисунки к приёму «Формулы разгона и торможения» (form).

   Два рисунка:
   – formLadder — лесенка скоростей по секундам: что такое ускорение;
   – formPick   — таблица выбора формулы: какой буквы нет в условии, той нет и в формуле.

   Помощники (svg, arrow, text, body, withCaption) скопированы из gen/draw.js:
   там они не экспортируются. Файл работает и в браузере, и в node. */

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
    /* жадный перенос по ширине w */
    const wrap = (words, w) => {
      const res = []; let line = "";
      words.forEach(t => {
        if (line && (line + " " + t).length > w) { res.push(line); line = t; }
        else line = line ? line + " " + t : t;
      });
      if (line) res.push(line);
      return res;
    };
    const out = [];
    (Array.isArray(lines) ? lines : [lines]).forEach(src => {
      const words = String(src).split(" ").filter(Boolean);
      const n = wrap(words, perLine).length;
      /* сужаем ширину, пока строк столько же: так последняя не остаётся огрызком в одно слово */
      let w = perLine;
      while (w > 14 && wrap(words, w - 1).length === n) w--;
      wrap(words, w).forEach(l => out.push(l));
    });
    const inn = inner.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    const capH = out.length * 19 + 10;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + capH}" width="${W}" height="${H + capH}"
      style="max-width:100%;height:auto;background:#fff"><g>${inn}</g>
      ${out.map((t, i) => text(W / 2, H + 16 + i * 19, t, { size: 13, color: MUTE })).join("")}</svg>`;
  }

  /* ── местные помощники ── */

  /* машинка: кузов, крыша, два колеса; (cx, gy) — центр и линия дороги */
  function car(cx, gy, color) {
    const c = color || INK;
    let s = "";
    s += `<path d="M ${cx - 15} ${gy - 17} L ${cx - 9} ${gy - 27} L ${cx + 8} ${gy - 27} L ${cx + 15} ${gy - 17} Z"
      fill="#fff" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/>`;
    s += `<rect x="${cx - 24}" y="${gy - 18}" width="48" height="13" rx="4" fill="#fff" stroke="${c}" stroke-width="1.8"/>`;
    s += `<circle cx="${cx - 13}" cy="${gy - 4}" r="4.6" fill="#fff" stroke="${c}" stroke-width="1.8"/>`;
    s += `<circle cx="${cx + 13}" cy="${gy - 4}" r="4.6" fill="#fff" stroke="${c}" stroke-width="1.8"/>`;
    return s;
  }

  /* дужка со стрелкой сверху: из (x1,y) в (x2,y), приподнятая на lift */
  function hop(x1, x2, y, lift, color) {
    const mx = (x1 + x2) / 2, my = y - lift;
    const cx = mx, cy = y - lift * 2;                 /* контрольная точка квадратичной кривой */
    let s = `<path d="M ${x1} ${y} Q ${cx} ${cy} ${x2} ${y}" fill="none"
      stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>`;
    const a = Math.atan2(y - cy, x2 - cx), L = 9, W = 4;
    const bx = x2 - L * Math.cos(a), by = y - L * Math.sin(a);
    s += `<polygon points="${x2},${y} ${bx - W * Math.sin(-a)},${by - W * Math.cos(-a)} ${bx + W * Math.sin(-a)},${by + W * Math.cos(-a)}"
      fill="${color}"/>`;
    return s + text(mx, my - 7, "+3", { size: 14, color: color, bold: true });
  }

  /* формула с индексами: parts — строка, либо ["0","sub"] / ["2","sup"].
     Индексы делаем сдвигом базовой линии, а не символами ₀ и ²: они есть не во всех Times. */
  function formula(x, y, parts, o) {
    o = o || {};
    const isSup = p => Array.isArray(p) && p[1] !== "sub";
    const isSub = p => Array.isArray(p) && p[1] === "sub";
    /* часть начинается с косой черты или знака операции — зазор перед ней не нужен */
    const opStart = t => /^[\s\u00a0]*[/+−·=]/.test(t);
    let shift = 0, prev = null, inner = "";
    parts.forEach(p => {
      /* ведущий пробел в SVG съедается — ставим неразрывный, иначе «v₀+ a» слипается */
      const t = Array.isArray(p) ? p[0] : String(p).replace(/^ /, " ");
      const want = Array.isArray(p) ? (p[1] === "sub" ? 4 : -5) : 0;
      const dy = want - shift;
      /* после индекса — зазор, иначе «v₀+ a» слипается; но не перед «/» и знаком
         операции после степени: там зазор читается как провал («t² /2») */
      let dx = (shift && !want) ? 2 : 0;
      if (isSup(prev) && opStart(t)) dx = 0;
      /* «0» и «2» в v₀² идут с одинаковым dx — стоят встык, а не «v₀ ²» */
      if (isSub(prev) && isSup(p)) dx = 0;
      shift = want; prev = p;
      inner += `<tspan dy="${dy}"${dx ? ` dx="${dx}"` : ""}${want ? ' font-size="10"' : ""}>${esc(t)}</tspan>`;
    });
    return `<text x="${x}" y="${y}" font-size="${o.size || 14}" ${F} text-anchor="${o.anchor || "middle"}"
      fill="${o.color || INK}" font-style="italic">${inner}</text>`;
  }

  /* галочка в клетке */
  function tick(cx, cy, color) {
    return `<path d="M ${cx - 6} ${cy} L ${cx - 2} ${cy + 5} L ${cx + 7} ${cy - 6}" fill="none"
      stroke="${color || GREEN}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  Object.assign(DRAW, {
    /* ── Лесенка скоростей: прибавка за секунду и есть ускорение ── */
    formLadder() {
      const gy = 120, xs = [42, 128, 214, 300, 386];
      const ts = ["0 с", "1 с", "2 с", "3 с", "4 с"];
      const vs = ["0", "3 м/с", "6 м/с", "9 м/с", "12 м/с"];
      let s = "";
      s += `<line x1="14" y1="${gy}" x2="414" y2="${gy}" stroke="${INK}" stroke-width="2"/>`;
      xs.forEach((x, i) => {
        s += car(x, gy, INK);
        s += text(x, 142, ts[i], { size: 13, color: MUTE });
        s += text(x, 162, vs[i], { size: 14, color: ACC, bold: true });
      });
      /* дужки идут на уровне крыш (крыша начинается на y = gy − 27), чтобы «+3» не висело в пустоте */
      for (let i = 0; i < xs.length - 1; i++) s += hop(xs[i] + 26, xs[i + 1] - 26, gy - 30, 14, BLUE);
      return withCaption(svg(420, 174, s),
        "Каждую секунду скорость прибавляет одно и то же. Эта прибавка за секунду и есть ускорение.");
    },

    /* ── Таблица выбора формулы: чего нет в условии, того нет и в формуле ── */
    formPick() {
      const x0 = 10, xTab = 232, colW = 35.6, nCol = 5, xEnd = xTab + colW * nCol;
      const yHead = 24, rowH = 34, y0 = yHead + 26;
      const S0 = ["0", "sub"], S2 = ["2", "sup"];
      const cols = [["v", S0], ["v"], ["a"], ["t"], ["s"]];
      const rows = [
        [["v = v", S0, " + a · t"], [1, 1, 1, 1, 0]],
        [["s = ((v", S0, " + v)/2) · t"], [1, 1, 0, 1, 1]],
        [["s = v", S0, " · t + a · t", S2, "/2"], [1, 0, 1, 1, 1]],
        [["v", S2, " − v", S0, S2, " = 2 · a · s"], [1, 1, 1, 0, 1]],
      ];
      const yBot = y0 + rowH * rows.length;
      const colX = i => xTab + colW * i + colW / 2;
      let s = "";

      /* колонка t залита целиком */
      s += `<rect x="${xTab + colW * 3}" y="${yHead}" width="${colW}" height="${yBot - yHead}"
        fill="${ACC}" fill-opacity="0.12"/>`;

      /* сетка */
      s += `<line x1="${x0}" y1="${yHead}" x2="${xEnd}" y2="${yHead}" stroke="${INK}" stroke-width="1.4"/>`;
      s += `<line x1="${x0}" y1="${y0}" x2="${xEnd}" y2="${y0}" stroke="${INK}" stroke-width="1.4"/>`;
      for (let r = 1; r <= rows.length; r++)
        s += `<line x1="${x0}" y1="${y0 + rowH * r}" x2="${xEnd}" y2="${y0 + rowH * r}" stroke="#c9c6c0" stroke-width="0.9"/>`;
      s += `<line x1="${x0}" y1="${yHead}" x2="${x0}" y2="${yBot}" stroke="${INK}" stroke-width="1.4"/>`;
      s += `<line x1="${xTab}" y1="${yHead}" x2="${xTab}" y2="${yBot}" stroke="${INK}" stroke-width="1.4"/>`;
      for (let i = 1; i <= nCol; i++)
        s += `<line x1="${xTab + colW * i}" y1="${yHead}" x2="${xTab + colW * i}" y2="${yBot}" stroke="#c9c6c0" stroke-width="0.9"/>`;
      /* внешний контур поверх серых: низ и правый край */
      s += `<line x1="${x0}" y1="${yBot}" x2="${xEnd}" y2="${yBot}" stroke="${INK}" stroke-width="1.4"/>`;
      s += `<line x1="${xEnd}" y1="${yHead}" x2="${xEnd}" y2="${yBot}" stroke="${INK}" stroke-width="1.4"/>`;

      /* шапка */
      s += text((x0 + xTab) / 2, y0 - 8, "формула", { size: 13, color: MUTE });
      cols.forEach((c, i) => s += formula(colX(i), y0 - 8, c, { size: 15 }));

      /* строки */
      rows.forEach((r, ri) => {
        const cy = y0 + rowH * ri + rowH / 2;
        s += formula(x0 + 10, cy + 5, r[0], { size: 14, anchor: "start" });
        r[1].forEach((has, i) => { if (has) s += tick(colX(i), cy, GREEN); });
      });

      /* пустая клетка t в последней строке — обведена */
      const yLast = y0 + rowH * (rows.length - 1);
      s += `<rect x="${xTab + colW * 3 + 2}" y="${yLast + 3}" width="${colW - 4}" height="${rowH - 6}"
        fill="none" stroke="${ACC}" stroke-width="2.2" rx="3"/>`;

      return withCaption(svg(420, yBot + 12, s),
        "Времени в условии нет — бери строку, где в колонке t пусто.");
    },
  });
})();

if (typeof module !== "undefined" && module.exports) module.exports = DRAW;
