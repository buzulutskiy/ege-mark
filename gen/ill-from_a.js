/* global GRAPH, DRAW */
/* Рисунки к приёму «от ускорения»: график ускорения — это не скорость, а прибавка к ней;
   порядок действий a → v → s; три вида задач и как их различить.
   Помощники скопированы из gen/draw.js — там они не экспортируются. */

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
    const inn = inner.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    const capH = out.length * 19 + 10;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + capH}" width="${W}" height="${H + capH}"
      style="max-width:100%;height:auto;background:#fff"><g>${inn}</g>
      ${out.map((t, i) => text(W / 2, H + 16 + i * 19, t, { size: 13, color: MUTE })).join("")}</svg>`;
  }

  /* ── Свои помощники ──────────────────────────────────────────────
     Сдвиг готового SVG: координаты пересчитываются насовсем, без transform,
     иначе проверка подписей считает координаты вложенных картинок совпавшими. */
  function sizeOf(s) {
    const m = s.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    return m ? { w: +m[1], h: +m[2] } : { w: 0, h: 0 };
  }
  function shifted(s, dx, dy) {
    let inn = s.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    inn = inn.replace(/(\s)(x|x1|x2|cx)="(-?[\d.]+)"/g, (m0, sp, a, v) => `${sp}${a}="${+v + dx}"`);
    inn = inn.replace(/(\s)(y|y1|y2|cy)="(-?[\d.]+)"/g, (m0, sp, a, v) => `${sp}${a}="${+v + dy}"`);
    inn = inn.replace(/points="([^"]+)"/g, (m0, p) => `points="${p.trim().split(/\s+/)
      .map(pair => { const c = pair.split(","); return (+c[0] + dx) + "," + (+c[1] + dy); }).join(" ")}"`);
    return inn;
  }
  /* Столбик из нескольких картинок, выровненных по левому краю. */
  function stack(parts, gap) {
    const sizes = parts.map(sizeOf);
    const W = Math.max.apply(null, sizes.map(s => s.w));
    let y = 0, out = "";
    parts.forEach((p, i) => { out += shifted(p, (W - sizes[i].w) / 2, y); y += sizes[i].h + (i < parts.length - 1 ? gap : 0); });
    return { w: W, h: y, body: out };
  }

  Object.assign(DRAW, {

    /* ── Два этажа: сверху ускорение, снизу набранная скорость ── */
    from_aTwoFloors() {
      const cell = 22, mL = 46, mT = 28;
      const sx = cell / 0.5;                       /* пикселей на секунду */
      const top = GRAPH.plot({
        cell,
        x: { label: "t, с", from: 0, to: 5, step: 0.5, tick: 1 },
        y: { label: "a, м/с²", from: 0, to: 5, step: 0.5, tick: 1 },
        lines: [{ pts: [[0, 4], [2, 4], [2, 0], [5, 0]], color: ACC }],
        notes: [{ x: 1, y: 4.6, t: "кран открыт", color: ACC, size: 13 },
                { x: 3.5, y: 0.7, t: "кран закрыт", color: MUTE, size: 13 }],
      });
      const bot = GRAPH.plot({
        cell,
        x: { label: "t, с", from: 0, to: 5, step: 0.5, tick: 1 },
        y: { label: "v, м/с", from: 0, to: 10, step: 1, tick: 2 },
        lines: [{ pts: [[0, 0], [2, 8], [5, 8]], color: BLUE }],
        notes: [{ x: 1.4, y: 2.6, t: "скорость растёт", color: BLUE, size: 13 },
                { x: 3.6, y: 6.6, t: "осталась 8 м/с", color: MUTE, size: 13 }],
      });
      const st = stack([top, bot], 10);
      const hTop = sizeOf(top).h;
      const xc = mL + 2 * sx;                      /* вертикаль через t = 2 с */
      let s = st.body;
      s += `<line x1="${xc}" y1="${mT}" x2="${xc}" y2="${hTop + 10 + mT + 220}" stroke="${MUTE}"
        stroke-width="1" stroke-dasharray="5 4"/>`;
      return withCaption(svg(st.w, st.h, s), [
        "Наверху ускорение, внизу скорость, которая из него набралась.",
        "Ускорение упало до нуля — скорость не упала, она просто перестала расти.",
      ]);
    },

    /* ── Порядок действий: a → v → s ── */
    from_aChain() {
      const boxes = [
        { x: 10, big: "a", u: "м/с²", sub: "высота ступеньки" },
        { x: 155, big: "v", u: "м/с", sub: "скорость" },
        { x: 300, big: "s", u: "м", sub: "путь" },
      ];
      let s = "";
      boxes.forEach(b => {
        const cx = b.x + 55;
        s += `<rect x="${b.x}" y="30" width="110" height="72" rx="10" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
        s += text(cx, 66, b.big, { size: 30, bold: true, italic: true, color: ACC });
        s += text(cx, 84, b.u, { size: 12, color: MUTE });
        s += text(cx, 118, b.sub, { size: 12, color: MUTE });
      });
      s += arrow(124, 66, 152, 66, INK, 3);
      s += arrow(269, 66, 297, 66, INK, 3);
      s += text(118, 148, "v = v₀ + a · t", { size: 15, bold: true });
      s += text(282, 174, "s = v · t, если a = 0", { size: 14 });
      s += text(282, 196, "s = v₀ · t + a · t² : 2, если a ≠ 0", { size: 14 });
      s += arrow(210, 216, 65, 216, MUTE, 1.6, "6 4");
      s += text(150, 234, "назад: v₀ = v − a · t", { size: 13, color: MUTE });
      return withCaption(svg(420, 248, s), [
        "С графика ускорения до пути два шага, и перепрыгнуть средний нельзя.",
      ]);
    },

    /* ── Три вида задач: смотри, сколько ступенек и что на второй ── */
    from_aThreeKinds() {
      const rowH = 102;
      const mini = (oy, draw, l1, l2) => {
        let s = "";
        const zero = oy + 44;
        s += arrow(20, zero, 206, zero, INK, 1.5);
        s += arrow(34, oy + 82, 34, oy + 6, INK, 1.5);
        s += text(209, oy + 60, "t, с", { size: 11, anchor: "start", color: MUTE });
        s += text(40, oy + 14, "a, м/с²", { size: 11, anchor: "start", color: MUTE });
        s += draw(oy, zero);
        s += text(250, oy + 36, l1, { size: 12, anchor: "start", bold: true });
        s += text(250, oy + 58, l2, { size: 12, anchor: "start", color: MUTE });
        return s;
      };
      let s = "";
      /* 1. одна ступенька, вся ниже нуля: ищем скорость в начале */
      s += mini(0, (oy, zero) => {
        let g = `<line x1="42" y1="${zero + 20}" x2="196" y2="${zero + 20}" stroke="${ACC}" stroke-width="2.4"/>`;
        g += `<line x1="150" y1="${zero - 4}" x2="150" y2="${zero + 4}" stroke="${INK}" stroke-width="1.4"/>`;
        g += `<circle cx="150" cy="${zero + 20}" r="3" fill="${ACC}"/>`;
        g += text(150, zero - 10, "v", { size: 13, italic: true, color: BLUE });
        g += text(48, zero - 10, "?", { size: 15, bold: true, color: BLUE, anchor: "start" });
        return g;
      }, "одна ступенька", "ищем скорость в начале");
      /* 2. вторая ступенька нулевая: s = v · t */
      s += mini(rowH, (oy, zero) => {
        let g = `<polyline fill="none" stroke="${ACC}" stroke-width="2.4" stroke-linejoin="round"
          points="42,${zero - 22} 110,${zero - 22} 110,${zero} 196,${zero}"/>`;
        g += `<rect x="126" y="${zero - 18}" width="30" height="18" fill="${GREEN}" fill-opacity="0.18"
          stroke="${GREEN}" stroke-width="1"/>`;
        return g;
      }, "вторая ступенька — ноль", "s = v · t");
      /* 3. вторая ступенька с минусом: длинная формула */
      s += mini(rowH * 2, (oy, zero) => {
        let g = `<polyline fill="none" stroke="${MUTE}" stroke-width="2.4" points="42,${zero - 22} 120,${zero - 22}"/>`;
        g += `<line x1="120" y1="${zero - 22}" x2="120" y2="${zero + 18}" stroke="${MUTE}" stroke-width="1.4"
          stroke-dasharray="4 3"/>`;
        g += `<line x1="120" y1="${zero + 18}" x2="196" y2="${zero + 18}" stroke="${ACC}" stroke-width="3"/>`;
        g += `<rect x="120" y="${zero}" width="76" height="18" fill="${ACC}" fill-opacity="0.16" stroke="none"/>`;
        return g;
      }, "вторая с минусом", "длинная формула");
      return withCaption(svg(420, rowH * 3 - 6, s), [
        "Сколько ступенек и что на второй — по этому и выбирают ход.",
      ]);
    },
  });
})();

if (typeof module !== "undefined" && module.exports) module.exports = DRAW;
