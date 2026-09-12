/* global GRAPH, DRAW */
/* Иллюстрации к приёму «Пифагор»: как зовутся стороны и когда плюс,
   когда минус; две координаты как два катета; катер поперёк реки. */

(function () {
  const F = "style=\"font-family:'Times New Roman',Times,Georgia,serif\"";
  const INK = "#111", ACC = "#c8571a", BLUE = "#1d4ed8", GREEN = "#0f766e", MUTE = "#7a7a7a";
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
    const b = inner.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    const capH = out.length * 19 + 10;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + capH}" width="${W}" height="${H + capH}"
      style="max-width:100%;height:auto;background:#fff"><g>${b}</g>
      ${out.map((t, i) => text(W / 2, H + 16 + i * 19, t, { size: 13, color: MUTE })).join("")}</svg>`;
  }

  /* строка с одним выделенным цветом знаком: «складываю: √(3² + 4²) = 5» */
  function formula(x, y, before, sign, after, color) {
    return `<text x="${x}" y="${y}" font-size="13" ${F} text-anchor="middle" fill="${INK}">${esc(before)}<tspan fill="${color}" font-weight="bold">${esc(sign)}</tspan>${esc(after)}</text>`;
  }
  /* квадратик прямого угла: угол в (x,y), стороны идут в направлениях dx, dy */
  function square(x, y, dx, dy, size) {
    const d = size || 13;
    return `<polyline points="${x + dx * d},${y} ${x + dx * d},${y + dy * d} ${x},${y + dy * d}"
      fill="none" stroke="${INK}" stroke-width="1.3"/>`;
  }

  Object.assign(DRAW, {
    /* ── Как зовутся стороны и когда плюс, когда минус ── */
    pifSides() {
      let s = "";

      /* левый треугольник: известны оба катета */
      const A = [70, 124], B = [70, 52], C = [166, 124];
      s += `<polygon points="${A[0]},${A[1]} ${B[0]},${B[1]} ${C[0]},${C[1]}"
        fill="${ACC}" fill-opacity="0.10" stroke="${ACC}" stroke-width="2.2"/>`;
      s += square(A[0], A[1], 1, -1);
      s += text(A[0] - 6, 92, "катет 3", { size: 12, anchor: "end" });
      s += text(118, 143, "катет 4", { size: 12 });
      s += text(126, 78, "гипотенуза 5", { size: 12, anchor: "start", color: ACC });
      /* стрелка от прямого угла к длинной стороне */
      s += arrow(A[0] + 16, A[1] - 6, 124, 92, MUTE, 1.2);

      /* правый треугольник: известны гипотенуза и катет, ищем второй катет */
      const D = [274, 124], E = [274, 52], G = [370, 124];
      s += `<line x1="${E[0]}" y1="${E[1]}" x2="${G[0]}" y2="${G[1]}" stroke="${INK}" stroke-width="3"/>`;
      s += `<line x1="${D[0]}" y1="${D[1]}" x2="${G[0]}" y2="${G[1]}" stroke="${INK}" stroke-width="3"/>`;
      s += `<line x1="${D[0]}" y1="${D[1]}" x2="${E[0]}" y2="${E[1]}" stroke="${BLUE}" stroke-width="2"
        stroke-dasharray="6 4"/>`;
      s += square(D[0], D[1], 1, -1);
      s += text(D[0] - 8, 92, "?", { size: 16, anchor: "end", color: BLUE, bold: true });
      s += text(322, 143, "4", { size: 14, bold: true });
      s += text(338, 78, "5", { size: 14, anchor: "start", bold: true });

      /* подписи-правила под треугольниками */
      s += text(118, 172, "знаю два катета", { size: 12, color: MUTE });
      s += formula(118, 192, "складываю: √(3² ", "+", " 4²) = 5", ACC);
      s += text(322, 172, "знаю гипотенузу и катет", { size: 12, color: MUTE });
      s += formula(322, 192, "вычитаю: √(5² ", "−", " 4²) = 3", ACC);

      return withCaption(svg(420, 204, s), [
        "Гипотенуза всегда лежит напротив прямого угла и всегда длиннее любого катета.",
        "Ищешь длинную сторону — плюс. Ищешь короткую — минус.",
      ]);
    },

    /* ── Две координаты: сдвиги по осям — катеты ── */
    pifTwoAxes() {
      let s = "";
      const px = u => 60 + (u - 9) * 34;
      const py = u => 230 - (u - 19) * 34;

      /* оси */
      s += `<line x1="46" y1="230" x2="284" y2="230" stroke="${INK}" stroke-width="1.6"/>`;
      s += `<polygon points="290,230 281,226 281,234" fill="${INK}"/>`;
      s += `<line x1="60" y1="242" x2="60" y2="46" stroke="${INK}" stroke-width="1.6"/>`;
      s += `<polygon points="60,40 56,49 64,49" fill="${INK}"/>`;
      s += `<text x="296" y="236" font-size="13" ${F} text-anchor="start"><tspan font-style="italic">x</tspan>, м</text>`;
      s += `<text x="70" y="52" font-size="13" ${F} text-anchor="start"><tspan font-style="italic">y</tspan>, м</text>`;
      [10, 12, 14].forEach(u => {
        s += `<line x1="${px(u)}" y1="227" x2="${px(u)}" y2="233" stroke="${INK}" stroke-width="1.2"/>`;
        s += text(px(u), 248, String(u), { size: 12 });
      });
      [20, 22, 24].forEach(u => {
        s += `<line x1="57" y1="${py(u)}" x2="63" y2="${py(u)}" stroke="${INK}" stroke-width="1.2"/>`;
        s += text(52, py(u) + 4, String(u), { size: 12, anchor: "end" });
      });

      const S = [px(10), py(20)], Ff = [px(14), py(23)], K = [px(14), py(20)];
      /* катеты пунктиром */
      s += arrow(S[0], S[1], K[0], K[1], MUTE, 1.6, "5 4");
      s += arrow(K[0], K[1], Ff[0], Ff[1], MUTE, 1.6, "5 4");
      s += square(K[0], K[1], -1, -1, 12);
      /* перемещение */
      s += arrow(S[0], S[1], Ff[0], Ff[1], ACC, 2.6);

      s += body(S[0], S[1], BLUE);
      s += body(Ff[0], Ff[1], BLUE);
      s += text(S[0] + 10, S[1] + 20, "старт, t = 0", { size: 12, anchor: "start", color: BLUE });
      s += text(Ff[0] + 8, Ff[1] - 12, "финиш, t = 1 с", { size: 12, anchor: "start", color: BLUE });
      s += text(170, 186, "Δx = 4", { size: 12, color: MUTE });
      s += text(Ff[0] + 8, 150, "Δy = 3", { size: 12, anchor: "start", color: MUTE });
      s += text(104, 96, "перемещение 5 м", { size: 13, anchor: "start", color: ACC, bold: true });

      return withCaption(svg(420, 262, s),
        "Оси перпендикулярны, поэтому сдвиги по ним — катеты, а перемещение — гипотенуза.");
    },

    /* ── Катер поперёк реки: своя скорость — гипотенуза ── */
    pifBoat() {
      let s = "";
      /* река и берега */
      s += `<rect x="20" y="50" width="380" height="135" fill="#eef4fb" stroke="none"/>`;
      s += `<line x1="20" y1="50" x2="400" y2="50" stroke="${INK}" stroke-width="2"/>`;
      s += `<line x1="20" y1="185" x2="400" y2="185" stroke="${INK}" stroke-width="2"/>`;
      s += text(46, 42, "берег", { size: 12, color: MUTE, anchor: "start" });
      s += text(46, 200, "берег", { size: 12, color: MUTE, anchor: "start" });
      [40, 150, 260].forEach(x => { s += arrow(x, 176, x + 46, 176, "#9db8d6", 1.8); });
      s += text(340, 168, "течение 4,5 км/ч", { size: 12, color: "#5b7fa6" });

      /* O — катер; A — конец поперечной составляющей; T — конец своей скорости
         (12 px на км/ч: вдоль 4,5 → 54, поперёк 6 → 72, своя 7,5 → 90) */
      const O = [200, 150], A = [200, 78], T = [146, 78];
      const deg = Math.atan2(T[1] - O[1], T[0] - O[0]) * 180 / Math.PI;

      /* катер: корпус развёрнут носом вдоль своей скорости — вверх-влево, против течения */
      s += `<g transform="rotate(${deg.toFixed(2)},${O[0]},${O[1]})">
        <polygon points="${O[0] - 24},${O[1] - 7} ${O[0] + 8},${O[1] - 7} ${O[0] + 22},${O[1]} ${O[0] + 8},${O[1] + 7} ${O[0] - 24},${O[1] + 7}"
          fill="#fff" stroke="${INK}" stroke-width="2"/>
        <line x1="${O[0] - 8}" y1="${O[1] - 7}" x2="${O[0] - 8}" y2="${O[1] + 7}" stroke="${INK}" stroke-width="1.4"/>
      </g>`;

      /* треугольник скоростей: обе составляющие выходят из катера-вершины,
         вдоль-составляющая пристроена головой к голове своей скорости */
      s += arrow(O[0], O[1], A[0], A[1], GREEN, 2.4);
      s += arrow(A[0], A[1], T[0], T[1], BLUE, 2.4);
      s += arrow(O[0], O[1], T[0], T[1], ACC, 3);
      s += square(A[0], A[1], -1, 1, 12);

      /* та же поперечная скорость, продолженная пунктиром до дальнего берега */
      s += `<line x1="${A[0]}" y1="${A[1]}" x2="${A[0]}" y2="52" stroke="${GREEN}" stroke-width="1.6" stroke-dasharray="5 4"/>`;

      s += text(208, 66, "с берега видно: ровно поперёк", { size: 12, anchor: "start", color: MUTE });
      s += text(208, 120, "поперёк 6 км/ч", { size: 12, anchor: "start", color: GREEN });
      s += text(152, 94, "вдоль 4,5 км/ч", { size: 12, anchor: "end", color: BLUE });
      s += text(157, 126, "своя 7,5 км/ч", { size: 12, anchor: "end", color: ACC, bold: true });

      return withCaption(svg(420, 210, s), [
        "Нос смотрит против течения — снос погасился.",
        "Своя скорость относительно воды — гипотенуза.",
      ]);
    },
  });
})();

if (typeof module !== "undefined" && module.exports) module.exports = DRAW;
