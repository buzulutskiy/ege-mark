/* global GRAPH, DRAW */
/* Иллюстрации к приёму «относительность движения»:
   река (течение помогает или мешает) и два тела на дороге (как сокращается щель).
   Длины стрелок в обоих рисунках взяты от одного масштаба: пиксели пропорциональны км/ч. */

(function () {
  const F = "style=\"font-family:'Times New Roman',Times,Georgia,serif\"";
  const INK = "#111", ACC = "#c8571a", BLUE = "#1d4ed8", GREEN = "#0f766e", MUTE = "#7a7a7a";
  const WATER = "#5b7fa6";
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function svg(w, h, body) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"
      style="max-width:100%;height:auto;background:#fff">${body}</svg>`;
  }
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
  function body(x, y, color) { return `<circle cx="${x}" cy="${y}" r="7" fill="${color || ACC}"/>`; }

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

  /* ── местные фигурки ── */

  /* лодка сбоку: dir = 1 носом вправо, −1 носом влево */
  function boat(cx, cy, dir) {
    const P = [[-26, -6], [12, -6], [26, 2], [10, 10], [-20, 10]];
    const pts = P.map(p => (cx + dir * p[0]) + "," + (cy + p[1])).join(" ");
    const c1 = cx + dir * -18, c2 = cx + dir * -4;
    return `<polygon points="${pts}" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <rect x="${Math.min(c1, c2)}" y="${cy - 17}" width="${Math.abs(c2 - c1)}" height="11"
        fill="#fff" stroke="${INK}" stroke-width="1.8"/>`;
  }

  /* машина сбоку: dir = 1 капотом вправо */
  function car(cx, cy, dir, color) {
    const P = [[-28, 12], [-28, -2], [-22, -2], [-14, -14], [2, -14], [10, -2], [28, -2], [28, 12]];
    const pts = P.map(p => (cx + dir * p[0]) + "," + (cy + p[1])).join(" ");
    return `<polygon points="${pts}" fill="#fff" stroke="${color || INK}" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="${cx - 16}" cy="${cy + 12}" r="5" fill="#fff" stroke="${color || INK}" stroke-width="2"/>
      <circle cx="${cx + 16}" cy="${cy + 12}" r="5" fill="#fff" stroke="${color || INK}" stroke-width="2"/>`;
  }

  /* фигурная скобка над отрезком [x1, x2], остриём вверх */
  function brace(x1, x2, y) {
    const mid = (x1 + x2) / 2;
    return `<path d="M ${x1} ${y} c 0,-6 1,-6 8,-6 L ${mid - 8},${y - 6} c 8,0 7,0 8,-7
      c 1,7 0,7 8,7 L ${x2 - 8},${y - 6} c 7,0 8,0 8,6" fill="none" stroke="${MUTE}" stroke-width="1.4"/>`;
  }

  /* измерительная скобка: линия с засечками на концах */
  function span(x1, x2, y, color) {
    const c = color || MUTE;
    return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${c}" stroke-width="1.6"/>
      <line x1="${x1}" y1="${y - 5}" x2="${x1}" y2="${y + 5}" stroke="${c}" stroke-width="1.6"/>
      <line x1="${x2}" y1="${y - 5}" x2="${x2}" y2="${y + 5}" stroke="${c}" stroke-width="1.6"/>`;
  }

  Object.assign(DRAW, {
    /* ── Река: одна лодка, два числа с берега ──
       масштаб стрелок: 15,8 px на км/ч → 12 км/ч = 190 px, 8 км/ч = 127 px */
    relRiver() {
      const K = 190 / 12;
      let s = "";
      /* вода и берега */
      s += `<rect x="10" y="26" width="400" height="130" fill="#eef4fb" stroke="none"/>`;
      s += `<line x1="10" y1="26" x2="410" y2="26" stroke="${INK}" stroke-width="2"/>`;
      s += `<line x1="10" y1="156" x2="410" y2="156" stroke="${INK}" stroke-width="2"/>`;
      s += text(30, 20, "берег", { size: 12, color: MUTE, anchor: "start" });
      s += text(30, 170, "берег", { size: 12, color: MUTE, anchor: "start" });
      /* течение */
      for (let x = 30; x <= 300; x += 90) s += arrow(x, 94, x + 36, 94, "#9db8d6", 1.8);
      s += text(340, 112, "течение 2 км/ч", { size: 12, color: WATER });

      /* по течению: нос верхней лодки на x = 96 */
      s += boat(70, 60, 1);
      const upA = 96, upB = Math.round(upA + K * 12);
      s += arrow(upA, 60, upB, 60, GREEN, 2.6);
      s += text((upA + upB) / 2, 48, "с берега видно 12 км/ч", { size: 13, color: GREEN });
      s += text((upA + upB) / 2, 76, "10 своя + 2 течение", { size: 11.5, color: MUTE });

      /* против течения: нос нижней лодки на x = 246 */
      s += boat(272, 128, -1);
      const dnA = 246, dnB = Math.round(dnA - K * 8);
      s += arrow(dnA, 128, dnB, 128, ACC, 2.6);
      s += text(Math.round((dnA + dnB) / 2), 116, "с берега видно 8 км/ч", { size: 13, color: ACC });
      s += text(Math.round((dnA + dnB) / 2), 146, "10 своя − 2 течение", { size: 11.5, color: MUTE });

      /* числовая полоска */
      s += `<line x1="60" y1="214" x2="380" y2="214" stroke="${INK}" stroke-width="1.8"/>`;
      [[90, "8", ACC], [220, "10", INK], [350, "12", GREEN]].forEach(t => {
        s += `<line x1="${t[0]}" y1="208" x2="${t[0]}" y2="220" stroke="${t[2]}" stroke-width="2"/>`;
        s += text(t[0], 234, t[1], { size: 14, bold: true, color: t[2] });
      });
      s += text(396, 234, "км/ч", { size: 12, color: MUTE });
      s += brace(90, 220, 206) + text(155, 188, "течение 2", { size: 12, color: MUTE });
      s += brace(220, 350, 206) + text(285, 188, "течение 2", { size: 12, color: MUTE });
      s += text(220, 256, "собственная скорость лодки", { size: 12.5, color: MUTE });

      return withCaption(svg(420, 268, s), [
        "Лодка одна и та же. Течение отодвигает её от собственной скорости на одно и то же число в обе стороны —",
        "поэтому разница между 12 и 8 это два течения, а не одно.",
      ]);
    },

    /* ── Два тела: навстречу и вдогонку ──
       масштаб стрелок: 1,1 px на км/ч → 60 км/ч = 66 px, 40 км/ч = 44 px */
    relGap() {
      const K = 1.1, L60 = Math.round(60 * K), L40 = Math.round(40 * K);
      let s = "";
      const road = (yTop, yBot) => {
        let r = `<rect x="10" y="${yTop}" width="400" height="${yBot - yTop}" fill="${MUTE}" fill-opacity="0.08"/>`;
        r += `<line x1="10" y1="${yTop}" x2="410" y2="${yTop}" stroke="${MUTE}" stroke-width="1.2"/>`;
        r += `<line x1="10" y1="${yBot}" x2="410" y2="${yBot}" stroke="${MUTE}" stroke-width="1.2"/>`;
        return r;
      };
      /* щель: острия внутрь, к середине — расстояние съедается с обеих сторон */
      const gap = (xa, xb, y, color) => {
        const mid = (xa + xb) / 2;
        return arrow(xa, y, mid, y, color, 2) + arrow(xb, y, mid, y, color, 2);
      };

      /* ── навстречу ── */
      s += text(10, 20, "навстречу", { size: 13, bold: true, anchor: "start" });
      s += road(54, 100);
      s += arrow(18, 48, 18 + L60, 48, BLUE, 2.2);
      s += text(18 + L60 / 2, 38, "60 км/ч", { size: 12.5, color: BLUE });
      s += arrow(362, 48, 362 - L40, 48, ACC, 2.2);
      s += text(362 - L40 / 2, 38, "40 км/ч", { size: 12.5, color: ACC });
      s += car(45, 78, 1, BLUE);
      s += car(330, 78, -1, ACC);
      s += gap(78, 297, 78, GREEN);
      s += text(187, 70, "щель", { size: 12, color: MUTE });
      /* что съедается за час: 60 и 40 встык, вместе 100 */
      s += arrow(78, 118, 78 + L60, 118, BLUE, 2.2);
      s += arrow(78 + L60, 118, 78 + L60 + L40, 118, ACC, 2.2);
      s += span(78, 78 + L60 + L40, 132, GREEN);
      s += text(78 + (L60 + L40) / 2, 150, "100 км/ч", { size: 12.5, color: GREEN, bold: true });

      /* ── вдогонку ── */
      s += text(10, 180, "вдогонку", { size: 13, bold: true, anchor: "start" });
      s += road(214, 260);
      s += arrow(18, 208, 18 + L60, 208, BLUE, 2.2);
      s += text(18 + L60 / 2, 198, "60 км/ч", { size: 12.5, color: BLUE });
      s += arrow(262, 208, 262 + L40, 208, ACC, 2.2);
      s += text(262 + L40 / 2, 198, "40 км/ч", { size: 12.5, color: ACC });
      s += car(45, 238, 1, BLUE);
      s += car(290, 238, 1, ACC);
      s += gap(78, 257, 238, GREEN);
      s += text(167, 230, "щель", { size: 12, color: MUTE });
      /* 40 отложено от того же хвоста, что и 60: выступающий кусок и есть остаток */
      s += arrow(78, 286, 78 + L60, 286, BLUE, 2.2);
      s += arrow(78, 300, 78 + L40, 300, ACC, 2.2);
      s += span(78 + L40, 78 + L60, 312, GREEN);
      s += text(78 + (L40 + L60) / 2, 330, "20 км/ч", { size: 12.5, color: GREEN, bold: true });

      return withCaption(svg(420, 340, s), [
        "Машины едут одинаково быстро в обоих случаях. Меняется только направление — и от него зависит, складывать или вычитать.",
        "Навстречу щель сокращается на 60 + 40 = 100 км за час, вдогонку — только на 60 − 40 = 20 км за час.",
      ]);
    },
  });
})();

if (typeof module !== "undefined" && module.exports) module.exports = DRAW;
