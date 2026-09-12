/* global GRAPH, DRAW */
/* Иллюстрации к приёму «относительность движения»:
   река (течение помогает или мешает) и два тела на дороге (как сокращается щель). */

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

  Object.assign(DRAW, {
    /* ── Река: одна лодка, два числа с берега ── */
    relRiver() {
      let s = "";
      /* вода и берега */
      s += `<rect x="10" y="26" width="400" height="130" fill="#eef4fb" stroke="none"/>`;
      s += `<line x1="10" y1="26" x2="410" y2="26" stroke="${INK}" stroke-width="2"/>`;
      s += `<line x1="10" y1="156" x2="410" y2="156" stroke="${INK}" stroke-width="2"/>`;
      s += text(30, 20, "берег", { size: 12, color: MUTE, anchor: "start" });
      s += text(30, 151, "берег", { size: 12, color: MUTE, anchor: "start" });
      /* течение */
      for (let x = 30; x <= 300; x += 90) s += arrow(x, 94, x + 36, 94, "#9db8d6", 1.8);
      s += text(406, 88, "течение 2 км/ч", { size: 12, color: WATER, anchor: "end" });

      /* по течению */
      s += boat(70, 60, 1);
      s += arrow(100, 60, 290, 60, GREEN, 2.6);
      s += text(199, 48, "с берега видно 12 км/ч", { size: 13, color: GREEN });
      s += text(199, 76, "10 своя + 2 течение", { size: 11.5, color: MUTE });

      /* против течения */
      s += boat(272, 128, -1);
      s += arrow(240, 128, 130, 128, ACC, 2.6);
      s += text(181, 116, "с берега видно 8 км/ч", { size: 13, color: ACC });
      s += text(181, 146, "10 своя − 2 течение", { size: 11.5, color: MUTE });

      /* числовая полоска */
      s += `<line x1="60" y1="200" x2="380" y2="200" stroke="${INK}" stroke-width="1.8"/>`;
      [[90, "8", ACC], [220, "10", INK], [350, "12", GREEN]].forEach(t => {
        s += `<line x1="${t[0]}" y1="194" x2="${t[0]}" y2="206" stroke="${t[2]}" stroke-width="2"/>`;
        s += text(t[0], 220, t[1], { size: 14, bold: true, color: t[2] });
      });
      s += brace(90, 220, 192) + text(155, 174, "течение 2", { size: 12, color: MUTE });
      s += brace(220, 350, 192) + text(285, 174, "течение 2", { size: 12, color: MUTE });
      s += text(220, 242, "собственная скорость лодки", { size: 12.5, color: MUTE });

      return withCaption(svg(420, 254, s), [
        "Лодка одна и та же. Течение отодвигает её от собственной скорости на одно и то же число в обе стороны —",
        "поэтому разница между 12 и 8 это два течения, а не одно.",
      ]);
    },

    /* ── Два тела: навстречу и вдогонку ── */
    relGap() {
      let s = "";
      const road = (yTop, yBot) => {
        let r = `<rect x="10" y="${yTop}" width="400" height="${yBot - yTop}" fill="#f4f2ee" stroke="none"/>`;
        r += `<line x1="10" y1="${yTop}" x2="410" y2="${yTop}" stroke="${MUTE}" stroke-width="1.2"/>`;
        r += `<line x1="10" y1="${yBot}" x2="410" y2="${yBot}" stroke="${MUTE}" stroke-width="1.2"/>`;
        return r;
      };
      const gap = (xa, xb, y, color) => {
        const mid = (xa + xb) / 2;
        return arrow(mid, y, xa, y, color, 2) + arrow(mid, y, xb, y, color, 2);
      };

      /* навстречу */
      s += text(10, 20, "навстречу", { size: 13, bold: true, anchor: "start" });
      s += road(54, 100);
      s += arrow(18, 48, 76, 48, BLUE, 2.2);
      s += text(47, 38, "60 км/ч", { size: 12.5, color: BLUE });
      s += arrow(359, 48, 301, 48, ACC, 2.2);
      s += text(330, 38, "40 км/ч", { size: 12.5, color: ACC });
      s += car(45, 78, 1, BLUE);
      s += car(330, 78, -1, ACC);
      s += gap(78, 297, 78, GREEN);
      s += text(193, 114, "щель сокращается на 100 км за час", { size: 12.5, color: GREEN });

      /* вдогонку */
      s += text(10, 146, "вдогонку", { size: 13, bold: true, anchor: "start" });
      s += road(180, 226);
      s += arrow(18, 172, 76, 172, BLUE, 2.2);
      s += text(47, 162, "60 км/ч", { size: 12.5, color: BLUE });
      s += arrow(248, 172, 306, 172, ACC, 2.2);
      s += text(277, 162, "40 км/ч", { size: 12.5, color: ACC });
      s += car(45, 204, 1, BLUE);
      s += car(275, 204, 1, ACC);
      s += gap(78, 242, 204, GREEN);
      s += text(190, 244, "щель сокращается на 20 км за час", { size: 12.5, color: GREEN });

      return withCaption(svg(420, 254, s), [
        "Машины едут одинаково быстро в обоих случаях. Меняется только направление —",
        "и от него зависит, складывать или вычитать.",
      ]);
    },
  });
})();

if (typeof module !== "undefined" && module.exports) module.exports = DRAW;
