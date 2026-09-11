/* global RND, GRAPH */
/* Приём «Путь как площадь под графиком скорости». */
const { fmtNum, fmtAns, fmtSigned, fmtPar, plural, pluralWord } = RND;

function toNum(a) { return parseFloat(String(a).replace(/−/g, "-").replace(",", ".")); }
function nice(v) { return Math.abs(Math.round(v * 10) - v * 10) < 1e-9; }

/* границы вертикальной оси под нарисованную линию */
function fitY(pts, yStep) {
  const ys = pts.map(p => p[1]);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  return { yFrom: lo >= 0 ? 0 : lo - yStep, yTo: hi + yStep };
}

/* значение ломаной в точке t */
function at(pts, t) {
  for (let i = 1; i < pts.length; i++) {
    const [a, va] = pts[i - 1], [b, vb] = pts[i];
    if (t >= a && t <= b) return va + (vb - va) * (b === a ? 0 : (t - a) / (b - a));
  }
  return pts[pts.length - 1][1];
}

/* Разбиение фигуры под графиком на простые куски между t1 и t2.
   Режем в узлах ломаной и там, где скорость переходит через ноль.
   Возвращает [{ t1, t2, v1, v2, kind, area }] — area со знаком. */
function pieces(pts, t1, t2) {
  const cuts = new Set([t1, t2]);
  pts.forEach(p => { if (p[0] > t1 && p[0] < t2) cuts.add(p[0]); });
  for (let i = 1; i < pts.length; i++) {
    const [a, va] = pts[i - 1], [b, vb] = pts[i];
    if (va * vb < 0) {
      const tz = a + (b - a) * (0 - va) / (vb - va);
      if (tz > t1 && tz < t2) cuts.add(tz);
    }
  }
  const ts = [...cuts].sort((a, b) => a - b);
  const out = [];
  for (let i = 1; i < ts.length; i++) {
    const a = ts[i - 1], b = ts[i];
    const va = at(pts, a), vb = at(pts, b);
    const area = (va + vb) / 2 * (b - a);
    const kind = (va === 0 && vb === 0) ? "zero"
      : (va === vb) ? "rect"
      : (va === 0 || vb === 0) ? "tri" : "trap";
    out.push({ t1: a, t2: b, v1: va, v2: vb, kind, area });
  }
  return out;
}
const pathOf = ps => ps.reduce((s, p) => s + Math.abs(p.area), 0);
const dispOf = ps => ps.reduce((s, p) => s + p.area, 0);
/* «40 + 10 − 10» — слагаемые со своими знаками, для строки про перемещение */
const signedSum = ps => ps.map((p, i) => (i === 0 ? (p.area < 0 ? "−" : "") : (p.area < 0 ? " − " : " + ")) + fmtNum(Math.abs(p.area))).join("");

/* Как посчитать площадь куска — текстом и формулой, для разбора */
function pieceStep(p, i, total) {
  const w = p.t2 - p.t1;
  const hdr = total === 1 ? "Считаем площадь"
    : `Кусок ${fmtNum(p.t1)}–${fmtNum(p.t2)} с: ${p.kind === "rect" ? "прямоугольник" : p.kind === "tri" ? "треугольник" : p.kind === "zero" ? "стоянка" : "трапеция"}`;
  if (p.kind === "zero")
    return { t: hdr, p: ["Скорость ноль: линия лежит на оси, фигуры под ней нет.",
                        `f: s = 0 · ${fmtNum(w)} = 0`,
                        "Стоит — путь не растёт."] };
  if (p.kind === "rect")
    return { t: hdr, p: [`Скорость держится ${fmtNum(Math.abs(p.v1))} м/с ${plural(w, "секунду", "секунды", "секунд")} — под линией прямоугольник.`,
                        `f: s = ${fmtNum(Math.abs(p.v1))} · ${fmtNum(w)} = ${fmtNum(Math.abs(p.area))}`,
                        "Высота на ширину — площадь прямоугольника."] };
  if (p.kind === "tri") {
    const h = Math.abs(p.v1) || Math.abs(p.v2);
    const grows = p.v1 === 0;
    return { t: hdr, p: [`Скорость по модулю ${grows ? `растёт от нуля до ${fmtNum(h)} м/с` : "падает до нуля"} — под линией треугольник: ширина ${fmtNum(w)} с, высота ${fmtNum(h)} м/с.`,
                        `f: s = (${fmtNum(h)} · ${fmtNum(w)})/(2) = ${fmtNum(Math.abs(p.area))}`,
                        "Делим на 2, потому что треугольник — половина прямоугольника."] };
  }
  const a = Math.abs(p.v1), b = Math.abs(p.v2);
  return { t: hdr, p: [`Скорость идёт с ${fmtNum(a)} до ${fmtNum(b)} м/с, обе высоты не ноль — трапеция.`,
                      `f: s = (${fmtNum(a)} + ${fmtNum(b)})/(2) · ${fmtNum(w)} = ${fmtNum(Math.abs(p.area))}`,
                      `Полусумма ${fmtNum((a + b) / 2)} — это средняя скорость на куске. Умножили на ${plural(w, "секунду", "секунды", "секунд")}.`] };
}

const WHY_AREA = { t: "Почему путь — это площадь",
  p: ["Если скорость не меняется, путь = скорость умножить на время. На графике это прямоугольник: высота — скорость, ширина — время. Его площадь и есть путь.",
      "Правило работает всегда: путь равен площади фигуры под линией графика скорости."] };

const GEN = {
  key: "area_s",
  title: "Путь как площадь под графиком скорости",
  kinds: [
    {
      id: "one_second",
      title: "За одну секунду",
      check: t => {
        const v = t.dbg.vars;
        const s = pathOf(pieces(v.pts, v.t1, v.t2));
        if (v.t2 - v.t1 !== 1) return `кусок длиной ${v.t2 - v.t1} с, а вопрос про одну секунду`;
        return Math.abs(s - toNum(t.answer)) < 1e-9 ? null : `по графику площадь ${s}, а в ответе ${t.answer}`;
      },
      make(rnd) {
        /* «за вторую (третью) секунду» — ровный кусок длиной ровно 1 с */
        const T = rnd.pick([4, 5, 6]);
        const yStep = rnd.pick([1, 2, 5]);
        const nth = rnd.int(2, T - 1);                   /* какая по счёту секунда */
        const t1 = nth - 1, t2 = nth;
        const vFlat = rnd.int(1, 4) * yStep;
        /* ломаная: разгон, ровный кусок вокруг нужной секунды, дальше что-то ещё */
        const pts = [[0, 0], [t1, vFlat], [t2, vFlat], [T, rnd.int(0, 4) * yStep]];
        const s = vFlat * 1;
        const fit = fitY(pts, yStep);
        const graph = {
          x: { label: "t, с", from: 0, to: T, step: 1, tick: 1 },
          y: { label: "v, м/с", from: 0, to: fit.yTo, step: yStep, tick: yStep },
          lines: [{ pts }],
        };
        const ord = ["первую", "вторую", "третью", "четвёртую", "пятую", "шестую"][nth - 1];
        return {
          plain: `На рисунке представлен график зависимости модуля скорости тела от времени. Какой путь пройден телом за ${ord} секунду? Ответ дайте в метрах.`,
          svg: GRAPH.plot(graph), table: null,
          answer: fmtAns(s), unit: "м",
          simple: `«За ${ord} секунду» — это кусок от ${fmtNum(t1)} до ${fmtNum(t2)} с, а не первые ${plural(nth, "секунда", "секунды", "секунд")}. На нём скорость держится ${fmtNum(vFlat)} м/с, под графиком прямоугольник.`,
          raz: {
            dano: [
              "График скорости от времени: внизу секунды, слева метры в секунду.",
              `Спрашивают путь за ${ord} секунду. Это промежуток от ${fmtNum(t1)} до ${fmtNum(t2)} с, а не первые ${plural(nth, "секунда", "секунды", "секунд")}. Это важно.`,
              `На этом промежутке скорость держится ровно ${fmtNum(vFlat)} м/с, линия горизонтальная.`,
              "Найти надо путь в метрах.",
            ],
            plan: [
              `Понимаем, какой кусок спрашивают: от ${fmtNum(t1)} до ${fmtNum(t2)} с.`,
              "Смотрим, какая фигура под линией на этом куске — прямоугольник.",
              "Считаем его площадь. Это и есть путь.",
            ],
            steps: [
              WHY_AREA,
              { t: "Какой кусок",
                p: [`«За ${ord} секунду» — от конца ${nth - 1 === 1 ? "первой" : ["", "первой", "второй", "третьей", "четвёртой", "пятой"][nth - 1]} до конца ${ord}, то есть от ${fmtNum(t1)} до ${fmtNum(t2)} с.`,
                    `f: Δt = ${fmtNum(t2)} − ${fmtNum(t1)} = 1`] },
              { t: "Площадь",
                p: [`Прямоугольник: высота ${fmtNum(vFlat)} м/с, ширина 1 с.`,
                    `f: s = ${fmtNum(vFlat)} · 1 = ${fmtNum(s)}`,
                    "Единицы: м/с умножить на с — получаются метры. То, что нужно."] },
            ],
            ans: `${fmtNum(s)} (${pluralWord(s, "метр", "метра", "метров")})`,
            err: `Считают путь за первые ${plural(nth, "секунду", "секунды", "секунд")}, от 0 до ${fmtNum(t2)} с, и получают больше. «За ${ord} секунду» — это один кусок длиной в секунду.`,
          },
          dbg: { graph, vars: { T, pts, t1, t2, vFlat, s } },
        };
      },
    },

    {
      id: "from_start",
      title: "От старта до момента",
      check: t => {
        const v = t.dbg.vars;
        const s = pathOf(pieces(v.pts, 0, v.t2));
        return Math.abs(s - toNum(t.answer)) < 1e-9 ? null : `по графику площадь ${s}, а в ответе ${t.answer}`;
      },
      make(rnd) {
        /* разгон из нуля, потом ровный ход, иногда остановка — всё выше оси */
        const yStep = rnd.pick([2, 5, 10]);
        const vMax = rnd.int(1, 4) * yStep;
        const tUp = rnd.pick([1, 2, 3]);
        const tFlat = rnd.pick([1, 2, 3]);
        const stop = rnd.chance(0.35);
        const tStop = stop ? rnd.pick([1, 2]) : 0;
        const T = tUp + tFlat + tStop + rnd.pick([0, 1]);
        const pts = stop
          ? [[0, 0], [tUp, vMax], [tUp + tFlat, vMax], [tUp + tFlat, 0], [T, 0]]
          : [[0, 0], [tUp, vMax], [tUp + tFlat, vMax], [T, vMax]];
        const t2 = tUp + tFlat + tStop;
        const ps = pieces(pts, 0, t2);
        const s = pathOf(ps);
        if (!nice(s)) return GEN.kinds[1].make(rnd);
        const fit = fitY(pts, yStep);
        const graph = {
          x: { label: "t, с", from: 0, to: Math.max(T, t2), step: 1, tick: 1 },
          y: { label: "v, м/с", from: 0, to: fit.yTo, step: yStep, tick: yStep },
          lines: [{ pts }],
        };
        return {
          plain: `По графику зависимости модуля скорости тела от времени, представленному на рисунке, определите путь, пройденный телом от момента времени 0 с до момента времени ${fmtNum(t2)} с. Ответ дайте в метрах.`,
          svg: GRAPH.plot(graph), table: null,
          answer: fmtAns(s), unit: "м",
          simple: `Путь за первые ${plural(t2, "секунду", "секунды", "секунд")} — это площадь под графиком. Она разбивается на простые фигуры: ${ps.map(p => p.kind === "tri" ? "треугольник" : p.kind === "rect" ? "прямоугольник" : p.kind === "zero" ? "стоянку" : "трапецию").join(", ")}.`,
          raz: {
            dano: [
              "График скорости от времени: внизу секунды, слева метры в секунду.",
              `Нужен кусок от 0 до ${fmtNum(t2)} с.`,
              `Первые ${plural(tUp, "секунду", "секунды", "секунд")} скорость растёт от 0 до ${fmtNum(vMax)} м/с, потом ${plural(tFlat, "секунду", "секунды", "секунд")} держится на ${fmtNum(vMax)} м/с${stop ? `, потом ${plural(tStop, "секунду", "секунды", "секунд")} тело стоит` : ""}.`,
              "Найти надо путь в метрах.",
            ],
            plan: [
              "Режем фигуру под линией на простые части.",
              ...ps.map(p => `Считаем площадь: ${p.kind === "tri" ? "треугольник" : p.kind === "rect" ? "прямоугольник" : p.kind === "zero" ? "стоянка, площади нет" : "трапеция"}.`),
              "Складываем.",
            ],
            steps: [
              WHY_AREA,
              ...ps.map((p, i) => pieceStep(p, i, ps.length)),
              { t: "Складываем",
                p: [`f: s = ${ps.map(p => fmtNum(Math.abs(p.area))).join(" + ")} = ${fmtNum(s)}`,
                    `За ${plural(t2, "секунду", "секунды", "секунд")} тело прошло ${plural(s, "метр", "метра", "метров")}.`] },
            ],
            ans: `${fmtNum(s)} (${pluralWord(s, "метр", "метра", "метров")})`,
            err: stop
              ? "Забывают, что на стоянке путь не растёт, и дорисовывают прямоугольник до конца. Ноль скорости — ноль площади."
              : `Считают всё как прямоугольник ${fmtNum(vMax)} · ${fmtNum(t2)} = ${fmtNum(vMax * t2)}. На разгоне скорость была меньше ${fmtNum(vMax)}, поэтому там треугольник — половина.`,
          },
          dbg: { graph, vars: { T, pts, t1: 0, t2, s, vMax, ps } },
        };
      },
    },

    {
      id: "between",
      title: "Между двумя моментами",
      check: t => {
        const v = t.dbg.vars;
        const s = pathOf(pieces(v.pts, v.t1, v.t2));
        return Math.abs(s - toNum(t.answer)) < 1e-9 ? null : `по графику площадь ${s}, а в ответе ${t.answer}`;
      },
      make(rnd) {
        /* кусок между двумя моментами: трапеция, или трапеция + прямоугольник + трапеция */
        const yStep = rnd.pick([1, 2, 5, 10]);
        const xStep = rnd.pick([1, 2, 5]);
        const nodes = rnd.pick([2, 3]);
        const t1 = xStep * rnd.int(1, 2);
        const ws = Array.from({ length: nodes }, () => xStep * rnd.int(1, 3));
        const vs = Array.from({ length: nodes + 1 }, () => rnd.int(1, 5) * yStep);
        let ts = [0, t1]; let acc = t1;
        ws.forEach(w => { acc += w; ts.push(acc); });
        const t2 = acc;
        const T = t2 + xStep;
        const pts = [[0, Math.max(0, vs[0] - yStep)], ...ts.slice(1).map((tt, i) => [tt, vs[i]]), [T, rnd.int(1, 5) * yStep]];
        const ps = pieces(pts, t1, t2);
        const s = pathOf(ps);
        if (!nice(s)) return GEN.kinds[2].make(rnd);
        const fit = fitY(pts, yStep);
        const graph = {
          x: { label: "t, с", from: 0, to: T, step: xStep, tick: xStep },
          y: { label: "v, м/с", from: 0, to: fit.yTo, step: yStep, tick: yStep },
          lines: [{ pts }],
        };
        return {
          plain: `Небольшое тело движется вдоль оси Ox. На рисунке приведён график зависимости проекции v_x скорости этого тела от времени t. Определите путь, пройденный телом за промежуток времени от ${fmtNum(t1)} до ${fmtNum(t2)} с. Ответ запишите в метрах.`,
          svg: GRAPH.plot(graph), table: null,
          answer: fmtAns(s), unit: "м",
          simple: `С ${fmtNum(t1)}-й по ${fmtNum(t2)}-ю секунду под графиком ${ps.length === 1 ? "одна фигура" : plural(ps.length, "фигура", "фигуры", "фигур")}. Считаешь площадь каждой и складываешь.`,
          raz: {
            dano: [
              "График скорости от времени: внизу секунды, слева метры в секунду.",
              `Нужен кусок от ${fmtNum(t1)} до ${fmtNum(t2)} с.`,
              `Скорости в узлах: ${ps.map(p => `на ${fmtNum(p.t1)} с — ${fmtNum(p.v1)}`).concat([`на ${fmtNum(t2)} с — ${fmtNum(ps[ps.length - 1].v2)}`]).join("; ")} (м/с).`,
              "Вся линия выше оси — тело всё время едет вперёд.",
              "Найти надо путь в метрах.",
            ],
            plan: [
              "Режем фигуру под линией по точкам излома.",
              "Считаем площадь каждого куска.",
              "Складываем.",
            ],
            steps: [
              WHY_AREA,
              ...ps.map((p, i) => pieceStep(p, i, ps.length)),
              ...(ps.length > 1 ? [{ t: "Складываем",
                p: [`f: s = ${ps.map(p => fmtNum(Math.abs(p.area))).join(" + ")} = ${fmtNum(s)}`,
                    `Всего ${plural(s, "метр", "метра", "метров")}.`] }] : []),
            ],
            ans: `${fmtNum(s)} (${pluralWord(s, "метр", "метра", "метров")})`,
            err: "Берут одну скорость и умножают на время. Когда скорость меняется, нужна средняя — полусумма крайних значений на куске.",
          },
          dbg: { graph, vars: { T, pts, t1, t2, s, ps } },
        };
      },
    },

    {
      id: "turned",
      title: "Когда тело развернулось",
      check: t => {
        const v = t.dbg.vars;
        const ps = pieces(v.pts, v.t1, v.t2);
        if (!ps.some(p => p.area < 0)) return "нет куска ниже оси — тело не разворачивалось";
        const s = pathOf(ps);
        return Math.abs(s - toNum(t.answer)) < 1e-9 ? null : `по графику путь ${s}, а в ответе ${t.answer}`;
      },
      make(rnd) {
        /* скорость уходит под ось: путь складывает обе площади по модулю */
        const yStep = rnd.pick([2, 5]);
        const up = rnd.int(2, 5) * yStep;                 /* максимум вверх */
        const down = rnd.int(1, 4) * yStep;               /* максимум вниз */
        const tZero = rnd.pick([2, 3, 4]);                /* момент разворота */
        const tEnd = tZero + rnd.pick([2, 3, 4]);
        const pts = [[0, 0], [tZero, up], [tZero, up], [tEnd, -down]];
        /* линия: из нуля вверх до up к tZero, потом вниз до −down к tEnd */
        const line = [[0, 0], [tZero, up], [tEnd, -down]];
        const ps = pieces(line, 0, tEnd);
        const s = pathOf(ps);
        const disp = dispOf(ps);
        if (!nice(s) || !nice(disp)) return GEN.kinds[3].make(rnd);
        const fit = fitY(line, yStep);
        const graph = {
          x: { label: "t, с", from: 0, to: tEnd, step: 1, tick: 1 },
          y: { label: "v, м/с", from: fit.yFrom, to: fit.yTo, step: yStep, tick: yStep },
          lines: [{ pts: line }],
        };
        const tCross = ps.find(p => p.area < 0).t1;
        return {
          plain: `Тело движется по оси Ox. По графику зависимости проекции скорости тела v_x от времени t установите, какой путь прошло тело за время от t_1 = 0 до t_2 = ${fmtNum(tEnd)} с. Ответ дайте в метрах.`,
          svg: GRAPH.plot(graph), table: null,
          answer: fmtAns(s), unit: "м",
          simple: "Скорость уходит ниже оси — тело развернулось и поехало назад. Путь считает оба куска положительными, поэтому площади складываются.",
          raz: {
            dano: [
              "График скорости от времени: внизу секунды, слева метры в секунду.",
              `Кусок от 0 до ${fmtNum(tEnd)} с. Сначала линия идёт вверх до ${fmtNum(up)} м/с, потом опускается и уходит под ось до ${fmtSigned(-down)} м/с.`,
              `Линия пересекает ось на ${fmtNum(tCross)}-й секунде — там тело разворачивается.`,
              "Найти надо путь в метрах.",
            ],
            plan: [
              "Режем кусок там, где скорость проходит через ноль.",
              "Считаем площадь над осью — движение вперёд.",
              "Считаем площадь под осью — движение назад.",
              "Складываем обе без знаков: путь считает всё.",
            ],
            steps: [
              { t: "Почему разворот меняет решение",
                p: ["Путь — накрученные метры, они растут в любую сторону. Перемещение — сдвиг со знаком.",
                    "Кусок «назад» для пути берём с плюсом, а не вычитаем. Поэтому режем там, где скорость меняет знак."] },
              ...ps.map((p, i) => {
                const st = pieceStep(p, i, ps.length);
                return { t: (p.area >= 0 ? "Вперёд: " : "Назад: ") + st.t.replace(/^Кусок /, "кусок "),
                         p: st.p.concat([p.area >= 0
                           ? `${plural(Math.abs(p.area), "метр", "метра", "метров")} вперёд.`
                           : `${plural(Math.abs(p.area), "метр", "метра", "метров")} назад.`]) };
              }),
              { t: "Складываем",
                p: [`f: s = ${ps.map(p => fmtNum(Math.abs(p.area))).join(" + ")} = ${fmtNum(s)}`,
                    `Всего накручено ${plural(s, "метр", "метра", "метров")}.`,
                    `Для сравнения: перемещение было бы ${signedSum(ps)} = ${fmtSigned(disp)} м — там кусок назад вычитается. Но спрашивают путь.`] },
            ],
            ans: `${fmtNum(s)} (${pluralWord(s, "метр", "метра", "метров")})`,
            err: `Вычитают второй кусок и отвечают ${fmtSigned(disp)} — это перемещение. Как только линия уходит под ось, реши: путь складывает, перемещение вычитает.`,
          },
          dbg: { graph, vars: { tEnd, pts: line, t1: 0, t2: tEnd, s, disp, ps, up, down } },
        };
      },
    },

    {
      id: "pick_graph",
      title: "Выбрать нужный график",
      check: t => {
        const v = t.dbg.vars;
        const areas = v.all.map(l => pathOf(pieces(l, 0, v.T)));
        const best = Math.max(...areas);
        if (areas.filter(a => Math.abs(a - best) < 1e-9).length > 1)
          return `вопрос неоднозначен: у нескольких машин площадь ${best} (${areas.join(", ")})`;
        return Math.abs(best - toNum(t.answer)) < 1e-9 ? null : `самая большая площадь ${best}, а в ответе ${t.answer}`;
      },
      make(rnd) {
        /* четыре линии; у победителя площадь строго больше остальных */
        const T = rnd.pick([10, 15, 20]);
        const yStep = rnd.pick([5, 10]);
        let all, areas, best, bi;
        do {
          all = [0, 1, 2, 3].map(() => {
            const a = rnd.int(1, 4) * yStep, b = rnd.int(1, 4) * yStep;
            return [[0, a], [T, b]];
          });
          areas = all.map(l => pathOf(pieces(l, 0, T)));
          best = Math.max(...areas);
          bi = areas.indexOf(best);
        } while (areas.filter(a => Math.abs(a - best) < 1e-9).length > 1 || !nice(best));

        const w = all[bi], v1 = w[0][1], v2 = w[1][1];
        const fit = fitY([].concat(...all), yStep);
        const graph = {
          x: { label: "t, с", from: 0, to: T, step: T / 5, tick: T / 5 },
          y: { label: "v, м/с", from: 0, to: fit.yTo, step: yStep, tick: yStep },
          lines: all.map((pts, i) => ({ pts, label: String(i + 1) })),
        };
        return {
          plain: `На рисунке изображены графики зависимости модуля скорости движения четырёх автомобилей от времени. Один из автомобилей за первые ${fmtNum(T)} с движения проехал наибольший путь. Найдите этот путь. Ответ выразите в метрах.`,
          svg: GRAPH.plot(graph), table: null,
          answer: fmtAns(best), unit: "м",
          simple: "Путь — это площадь под линией. Значит, дальше всех уехал тот, под чьей линией фигура крупнее. Находишь его глазами и считаешь только его.",
          raz: {
            dano: [
              "На одной картинке четыре линии — четыре автомобиля. Внизу секунды, слева метры в секунду.",
              `Смотрим первые ${plural(T, "секунду", "секунды", "секунд")}.`,
              `Наибольшая площадь под линией — у автомобиля ${bi + 1}: его скорость идёт с ${fmtNum(v1)} до ${fmtNum(v2)} м/с.`,
              "Найти надо путь того, кто проехал больше всех, в метрах.",
            ],
            plan: [
              "Вспоминаем: путь — площадь под линией.",
              "Глазами находим линию с самой большой площадью.",
              "Считаем площадь только для неё.",
            ],
            steps: [
              WHY_AREA,
              { t: "Как выбрать, не считая всех",
                p: ["Дальше всех уехал тот, под чьей линией фигура крупнее.",
                    `Смотрим, чья линия всё время идёт выше остальных — это автомобиль ${bi + 1}.`] },
              { t: "Какая фигура",
                p: [v1 === v2
                    ? `Под линией прямоугольник: высота ${fmtNum(v1)} м/с, ширина ${plural(T, "секунда", "секунды", "секунд")}.`
                    : `Под линией трапеция. Её параллельные стороны — скорости на краях: ${fmtNum(v1)} и ${fmtNum(v2)} м/с. Высота трапеции — это время, ${plural(T, "секунда", "секунды", "секунд")}.`] },
              { t: "Считаем",
                p: v1 === v2
                  ? [`f: s = ${fmtNum(v1)} · ${fmtNum(T)} = ${fmtNum(best)}`]
                  : ["f: s = (v_1 + v_2)/(2) · t",
                     "Читается так: скорости сложить, поделить пополам, умножить на время.",
                     `f: s = (${fmtNum(v1)} + ${fmtNum(v2)})/(2) · ${fmtNum(T)} = ${fmtNum((v1 + v2) / 2)} · ${fmtNum(T)} = ${fmtNum(best)}`,
                     `${fmtNum((v1 + v2) / 2)} — средняя скорость этого автомобиля.`] },
            ],
            ans: `${fmtNum(best)} (${pluralWord(best, "метр", "метра", "метров")})`,
            err: "Считают того, у кого самая большая скорость в конце. Важна вся площадь, а не кто выше в последний момент.",
          },
          dbg: { graph, vars: { T, all, areas, best, bi } },
        };
      },
    },

    {
      id: "two_bodies",
      title: "Расстояние между двумя телами",
      check: t => {
        const v = t.dbg.vars;
        const s1 = pathOf(pieces(v.pts1, 0, v.T)), s2 = pathOf(pieces(v.pts2, 0, v.T));
        return Math.abs((s1 + s2) - toNum(t.answer)) < 1e-9 ? null : `${s1} + ${s2} = ${s1 + s2}, а в ответе ${t.answer}`;
      },
      make(rnd) {
        /* два тела из одной точки в разные стороны: расстояние — сумма путей */
        const T = rnd.pick([6, 8, 10]);
        const yStep = rnd.pick([1, 2]);
        let a, b, s1, s2;
        do {
          a = rnd.int(2, 5) * yStep; b = rnd.int(2, 5) * yStep;
          s1 = a * T / 2; s2 = b * T / 2;
        } while (!nice(s1) || !nice(s2) || a === b);
        const pts1 = [[0, 0], [T, a]], pts2 = [[0, 0], [T, b]];
        const fit = fitY([...pts1, ...pts2], yStep);
        const graph = {
          x: { label: "t, с", from: 0, to: T, step: 1, tick: 1 },
          y: { label: "v, м/с", from: 0, to: fit.yTo, step: yStep, tick: yStep },
          lines: [{ pts: pts1, label: "1" }, { pts: pts2, label: "2" }],
        };
        return {
          plain: `Два точечных тела начинают двигаться из одной точки вдоль оси Ox в противоположных направлениях. На рисунке показаны графики зависимостей модулей их скоростей от времени t. Чему будет равно расстояние между этими телами через ${plural(T, "секунду", "секунды", "секунд")} после начала движения? Ответ дайте в метрах.`,
          svg: GRAPH.plot(graph), table: null,
          answer: fmtAns(s1 + s2), unit: "м",
          simple: "Тела стартуют из одной точки в разные стороны. Путь каждого — площадь под его линией, а расстояние между ними — сумма этих путей.",
          raz: {
            dano: [
              "Два тела стартуют из одной точки и едут в разные стороны.",
              `Две линии на графике скорости. За ${plural(T, "секунду", "секунды", "секунд")} первое тело разгоняется до ${fmtNum(a)} м/с, второе — до ${fmtNum(b)} м/с.`,
              `Найти надо расстояние между телами через ${plural(T, "секунду", "секунды", "секунд")}.`,
            ],
            plan: [
              "Считаем путь первого — площадь под его линией.",
              "Считаем путь второго так же.",
              "Разъезжаются — складываем.",
            ],
            steps: [
              { t: "Почему складываем",
                p: ["Тела вышли из одной точки в разные стороны. Каждый метр первого увеличивает разрыв. Каждый метр второго — тоже.",
                    "Расстояние между ними — сумма двух путей."] },
              { t: "Путь первого",
                p: [`Линия из нуля до ${fmtNum(a)} м/с за ${plural(T, "секунду", "секунды", "секунд")} — треугольник.`,
                    `f: s_1 = (${fmtNum(a)} · ${fmtNum(T)})/(2) = ${fmtNum(s1)}`] },
              { t: "Путь второго",
                p: [`f: s_2 = (${fmtNum(b)} · ${fmtNum(T)})/(2) = ${fmtNum(s2)}`] },
              { t: "Складываем",
                p: [`f: L = ${fmtNum(s1)} + ${fmtNum(s2)} = ${fmtNum(s1 + s2)}`,
                    `Через ${plural(T, "секунду", "секунды", "секунд")} между телами ${plural(s1 + s2, "метр", "метра", "метров")}.`] },
            ],
            ans: `${fmtNum(s1 + s2)} (${pluralWord(s1 + s2, "метр", "метра", "метров")})`,
            err: `Вычитают пути и получают ${fmtNum(Math.abs(s1 - s2))} — это если бы тела ехали в одну сторону. Здесь они разъезжаются, поэтому складываем.`,
          },
          dbg: { graph, vars: { T, pts1, pts2, a, b, s1, s2 } },
        };
      },
    },
  ],
};

if (typeof module !== "undefined" && module.exports) module.exports = GEN;
if (typeof window !== "undefined") (window.GEN = window.GEN || {})["fiz:" + GEN.key] = GEN;
