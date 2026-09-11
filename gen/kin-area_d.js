/* global RND, GRAPH */
/* Приём «Перемещение и координата через площадь». Отличие от предыдущего приёма одно:
   здесь площадь берётся со знаком — под осью она вычитается. */
const { fmtNum, fmtAns, fmtSigned, fmtPar, plural, pluralWord } = RND;

function toNum(a) { return parseFloat(String(a).replace(/−/g, "-").replace(",", ".")); }
function nice(v) { return Math.abs(Math.round(v * 10) - v * 10) < 1e-9; }

function fitY(pts, yStep) {
  const ys = pts.map(p => p[1]);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  return { yFrom: lo >= 0 ? 0 : lo - yStep, yTo: hi + yStep };
}
function at(pts, t) {
  for (let i = 1; i < pts.length; i++) {
    const [a, va] = pts[i - 1], [b, vb] = pts[i];
    if (t >= a && t <= b) return va + (vb - va) * (b === a ? 0 : (t - a) / (b - a));
  }
  return pts[pts.length - 1][1];
}
/* куски фигуры под графиком между t1 и t2: режем по узлам и по переходам через ноль */
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
    const kind = (va === 0 && vb === 0) ? "zero" : (va === vb) ? "rect" : (va === 0 || vb === 0) ? "tri" : "trap";
    out.push({ t1: a, t2: b, v1: va, v2: vb, kind, area: (va + vb) / 2 * (b - a) });
  }
  return out;
}
const dispOf = ps => ps.reduce((s, p) => s + p.area, 0);
const pathOf = ps => ps.reduce((s, p) => s + Math.abs(p.area), 0);
const signedSum = ps => ps.map((p, i) => (i === 0 ? (p.area < 0 ? "−" : "") : (p.area < 0 ? " − " : " + ")) + fmtNum(Math.abs(p.area))).join("");

/* Шаг разбора на один кусок фигуры. signed = true — площадь идёт со своим знаком. */
function pieceStep(p, total, signed) {
  const w = p.t2 - p.t1;
  const below = p.area < 0;
  const shape = p.kind === "rect" ? "прямоугольник" : p.kind === "tri" ? "треугольник" : p.kind === "zero" ? "стоянка" : "трапеция";
  const hdr = total === 1 ? "Считаем площадь"
    : `${signed ? (below ? "Назад" : "Вперёд") + ": к" : "К"}усок ${fmtNum(p.t1)}–${fmtNum(p.t2)} с, ${shape}`;
  const val = signed ? fmtSigned(p.area) : fmtNum(Math.abs(p.area));
  if (p.kind === "zero")
    return { t: hdr, p: ["Скорость ноль: линия лежит на оси, фигуры под ней нет.", `f: s = 0 · ${fmtNum(w)} = 0`] };
  if (p.kind === "rect")
    return { t: hdr, p: [`Скорость держится ${fmtNum(Math.abs(p.v1))} м/с ${plural(w, "секунду", "секунды", "секунд")} — прямоугольник.`,
                        `f: s = ${below && signed ? "−" : ""}${fmtNum(Math.abs(p.v1))} · ${fmtNum(w)} = ${val}`] };
  if (p.kind === "tri") {
    const h = Math.abs(p.v1) || Math.abs(p.v2);
    return { t: hdr, p: [`Скорость по модулю ${p.v1 === 0 ? `растёт от нуля до ${fmtNum(h)} м/с` : "падает до нуля"} — треугольник: ширина ${fmtNum(w)} с, высота ${fmtNum(h)} м/с.`,
                        `f: s = ${below && signed ? "−" : ""}(${fmtNum(h)} · ${fmtNum(w)})/(2) = ${val}`,
                        "Делим на 2, потому что треугольник — половина прямоугольника."] };
  }
  const a = Math.abs(p.v1), b = Math.abs(p.v2);
  return { t: hdr, p: [`Скорость идёт с ${fmtNum(a)} до ${fmtNum(b)} м/с, обе высоты не ноль — трапеция.`,
                      `f: s = ${below && signed ? "−" : ""}(${fmtNum(a)} + ${fmtNum(b)})/(2) · ${fmtNum(w)} = ${val}`,
                      `Полусумма ${fmtNum((a + b) / 2)} — средняя скорость на куске.`] };
}

const WHY_SIGN = { t: "Почему тут важны знаки",
  p: ["Спрашивают сдвиг, а не путь. Сдвиг со знаком: что проехало назад, вычитается из того, что проехало вперёд.",
      "Площадь над осью — движение вперёд, плюс. Площадь под осью — назад, минус."] };

const GEN = {
  key: "area_d",
  title: "Перемещение и координата через площадь",
  kinds: [
    {
      id: "coord",
      title: "Координата через площадь",
      check: t => {
        const v = t.dbg.vars;
        const x = v.x0 + dispOf(pieces(v.pts, 0, v.t2));
        return Math.abs(x - toNum(t.answer)) < 1e-9 ? null : `${v.x0} + площадь = ${x}, а в ответе ${t.answer}`;
      },
      make(rnd) {
        const yStep = rnd.pick([1, 2, 5]);
        const turn = rnd.chance(0.35);                    /* бывает и с разворотом */
        const t2 = rnd.pick([3, 4, 5]);
        let pts;
        if (turn) {
          const v0 = rnd.int(2, 4) * yStep;
          const tz = rnd.int(1, t2 - 1);
          const vEnd = -rnd.int(1, 3) * yStep;
          pts = [[0, v0], [t2, vEnd]];
          if (v0 / (v0 - vEnd) * t2 % 1 !== 0) pts = [[0, v0], [tz, 0], [t2, vEnd]];
        } else {
          const v0 = rnd.int(1, 3) * yStep;
          const vMid = v0 + rnd.int(1, 3) * yStep;
          const tMid = rnd.int(1, t2 - 1);
          pts = [[0, v0], [tMid, vMid], [t2, vMid]];
        }
        const ps = pieces(pts, 0, t2);
        const disp = dispOf(ps);
        const x0 = rnd.pick([-10, -5, -2, 2, 5, 10]);
        const x = x0 + disp;
        if (!nice(disp) || !nice(x)) return GEN.kinds[0].make(rnd);
        const fit = fitY(pts, yStep);
        const graph = {
          x: { label: "t, с", from: 0, to: t2, step: 1, tick: 1 },
          y: { label: "v, м/с", from: fit.yFrom, to: fit.yTo, step: yStep, tick: yStep },
          lines: [{ pts }],
        };
        return {
          plain: `Точечное тело движется вдоль оси Ox. На рисунке изображён график зависимости проекции скорости v_x этого тела на ось Ox от времени t. В момент времени t = 0 с тело имеет координату x = ${fmtSigned(x0)} м. Найдите координату этого тела в момент времени t = ${fmtNum(t2)} с. Ответ дайте в метрах.`,
          svg: GRAPH.plot(graph), table: null,
          answer: fmtAns(x), unit: "м",
          simple: `Площадь под графиком покажет, на сколько тело сдвинулось. Координату получишь, прибавив этот сдвиг к старту ${fmtSigned(x0)} м.`,
          raz: {
            dano: [
              `График скорости v_x от времени t. Сказано: в момент 0 координата x_0 = ${fmtSigned(x0)} м — оттуда тело стартовало.`,
              `Нужен кусок от 0 до ${fmtNum(t2)} с.`,
              `Скорости в узлах: ${pts.map(p => `на ${fmtNum(p[0])} с — ${fmtSigned(p[1])}`).join("; ")} (м/с).`,
              `Найти надо координату на ${fmtNum(t2)}-й секунде — где тело оказалось.`,
            ],
            plan: [
              "Считаем площадь под линией — это сдвиг.",
              "Режем её на простые фигуры.",
              "Прибавляем сдвиг к стартовой координате.",
            ],
            steps: [
              { t: "Координата и сдвиг — не одно и то же",
                p: ["Площадь под линией даёт сдвиг: на сколько тело проехало. А спрашивают, где оно теперь.",
                    "f: x = x_0 + s_x",
                    `Читается так: где стало = где было + на сколько сдвинулось. x_0 = ${fmtSigned(x0)} — дано.`] },
              ...(turn ? [WHY_SIGN] : []),
              ...ps.map(p => pieceStep(p, ps.length, turn)),
              ...(ps.length > 1 ? [{ t: "Складываем — получаем сдвиг",
                p: [`f: s_x = ${turn ? signedSum(ps) : ps.map(p => fmtNum(Math.abs(p.area))).join(" + ")} = ${fmtSigned(disp)}`,
                    disp === 0 ? "Сдвиг нулевой: тело уехало и вернулось в ту же точку."
                               : `Тело сдвинулось на ${plural(Math.abs(disp), "метр", "метра", "метров")} ${disp > 0 ? "вперёд" : "назад"}.`] }] : []),
              { t: "Находим координату",
                p: [`f: x = ${fmtSigned(x0)} + ${fmtPar(disp)} = ${fmtSigned(x)}`,
                    `Тело стартовало из точки ${fmtSigned(x0)}${disp === 0 ? " и вернулось туда же" : `, сдвинулось на ${fmtNum(Math.abs(disp))} ${disp > 0 ? "вправо" : "влево"}`} — оказалось в точке ${fmtSigned(x)}.`] },
            ],
            ans: `${fmtSigned(x)} (${pluralWord(x, "метр", "метра", "метров")})`,
            err: `Пишут в ответ ${fmtSigned(disp)} — сам сдвиг, забыв про старт. Если сказано, откуда тело стартовало, это число обязательно в ответе.`,
          },
          dbg: { graph, vars: { pts, t2, x0, disp, x, ps, turn } },
        };
      },
    },

    {
      id: "signed",
      title: "Перемещение со знаком",
      check: t => {
        const v = t.dbg.vars;
        const d = dispOf(pieces(v.pts, v.t1, v.t2));
        return Math.abs(d - toNum(t.answer)) < 1e-9 ? null : `по графику сдвиг ${d}, а в ответе ${t.answer}`;
      },
      make(rnd) {
        /* часть пути ниже оси: перемещение получается со знаком и не равно пути */
        const yStep = rnd.pick([5, 10]);
        const up = rnd.int(1, 3) * yStep, down = rnd.int(2, 4) * yStep;
        const tUp = rnd.pick([5, 10]), tDown = rnd.pick([5, 10, 15]);
        const back = rnd.chance(0.5);                     /* сначала назад или сначала вперёд */
        const pts = back
          ? [[0, 0], [tDown, -down], [tDown, -down], [tDown + tUp, 0], [tDown + tUp + tUp, up]]
          : [[0, 0], [tUp, up], [tUp + tDown, -down]];
        const line = back ? [[0, 0], [tDown, -down], [tDown + tUp, 0], [tDown + tUp + tUp, up]] : pts;
        const T = line[line.length - 1][0];
        const ps = pieces(line, 0, T);
        const disp = dispOf(ps), path = pathOf(ps);
        if (!nice(disp) || disp === 0) return GEN.kinds[1].make(rnd);
        const fit = fitY(line, yStep);
        const graph = {
          x: { label: "t, с", from: 0, to: T, step: 5, tick: 5 },
          y: { label: "v, м/с", from: fit.yFrom, to: fit.yTo, step: yStep, tick: yStep },
          lines: [{ pts: line }],
        };
        return {
          plain: `На рисунке приведён график зависимости от времени t проекции v_x скорости тела, движущегося прямолинейно вдоль оси Ox. Определите проекцию s_x перемещения этого тела в интервале времени от 0 до ${fmtNum(T)} с. Ответ запишите в метрах с учётом знака проекции.`,
          svg: GRAPH.plot(graph), table: null,
          answer: fmtAns(disp), unit: "м",
          simple: "Часть линии идёт ниже оси — там тело едет назад, и эта площадь вычитается. Поэтому ответ может выйти с минусом.",
          raz: {
            dano: [
              "График скорости v_x от времени t: внизу секунды, слева метры в секунду.",
              `Кусок от 0 до ${fmtNum(T)} с. ${back ? "Сначала линия уходит под ось, потом поднимается над ней." : "Сначала линия над осью, потом уходит под неё."}`,
              `Скорости в узлах: ${line.map(p => `на ${fmtNum(p[0])} с — ${fmtSigned(p[1])}`).join("; ")} (м/с).`,
              "Найти надо сдвиг s_x со знаком, в метрах.",
            ],
            plan: [
              "Режем кусок там, где скорость проходит через ноль.",
              "Площадь над осью берём с плюсом.",
              "Площадь под осью — с минусом.",
              "Складываем со знаками.",
            ],
            steps: [
              WHY_SIGN,
              ...ps.map(p => pieceStep(p, ps.length, true)),
              { t: "Складываем со знаками",
                p: [`f: s_x = ${signedSum(ps)} = ${fmtSigned(disp)}`,
                    `Итог ${disp > 0 ? "с плюсом: в целом тело сдвинулось вперёд" : "с минусом: в целом тело сдвинулось назад"} на ${plural(Math.abs(disp), "метр", "метра", "метров")}.`] },
              { t: "Проверяем",
                p: [`Путь при этом был бы ${ps.map(p => fmtNum(Math.abs(p.area))).join(" + ")} = ${fmtNum(path)} м — совсем другое число.`,
                    "Путь складывает всё, перемещение вычитает то, что проехали назад."] },
            ],
            ans: `${fmtSigned(disp)} (${pluralWord(disp, "метр", "метра", "метров")}${disp < 0 ? ", минус обязателен" : ", со знаком плюс"})`,
            err: `Складывают площади без знаков и отвечают ${fmtNum(path)} — это путь, а не перемещение. Или теряют минус в ответе.`,
          },
          dbg: { graph, vars: { pts: line, t1: 0, t2: T, T, disp, path, ps, back } },
        };
      },
    },

    {
      id: "zero",
      title: "Перемещение может быть нулевым",
      constAnswer: true,                                   /* ответ всегда 0 — меняются условия */
      check: t => {
        const v = t.dbg.vars;
        const d = dispOf(pieces(v.pts, v.t1, v.t2));
        const p = pathOf(pieces(v.pts, v.t1, v.t2));
        if (p === 0) return "тело вообще не двигалось — задача вырождается";
        return Math.abs(d) < 1e-9 && Math.abs(toNum(t.answer)) < 1e-9 ? null : `по графику сдвиг ${d}, а в ответе ${t.answer}`;
      },
      make(rnd) {
        /* симметричные куски над и под осью: они гасят друг друга */
        const nth = rnd.chance(0.45);                      /* формулировка «за третью секунду» */
        const yStep = rnd.pick([1, 2, 5]);

        if (nth) {
          /* скорость проходит через ноль ровно посередине нужной секунды;
             half берём кратным шагу сетки, иначе узлы линии повиснут между клетками */
          const n = rnd.int(2, 4);
          const t1 = n - 1, t2 = n;
          const half = rnd.int(1, 3) * yStep;
          const h = 2 * half;
          const line = [[0, h], [t1, half], [t2, -half], [t2 + 1, -h]];
          const ps = pieces(line, t1, t2);
          const fit = fitY(line, yStep);
          const ord = ["первую", "вторую", "третью", "четвёртую", "пятую"][n - 1];
          const graph = {
            x: { label: "t, с", from: 0, to: t2 + 1, step: 1, tick: 1 },
            y: { label: "v, м/с", from: fit.yFrom, to: fit.yTo, step: yStep, tick: yStep },
            lines: [{ pts: line }],
          };
          return {
            plain: `Точечное тело начинает прямолинейное движение вдоль оси OX. На рисунке показана зависимость проекции скорости v_x этого тела от времени t. Чему равен модуль изменения координаты этого тела за ${ord} секунду движения? Ответ дайте в метрах.`,
            svg: GRAPH.plot(graph), table: null,
            answer: "0", unit: "м",
            simple: `${ord[0].toUpperCase() + ord.slice(1)} секунда — это кусок с ${fmtNum(t1)} до ${fmtNum(t2)} с. Скорость меняет знак ровно посередине: тело уезжает и возвращается на то же место.`,
            raz: {
              dano: [
                "График скорости v_x от времени t.",
                `Спрашивают про ${ord} секунду — это кусок от ${fmtNum(t1)} до ${fmtNum(t2)} с.`,
                `Скорость проходит через ноль ровно посередине, на ${fmtNum((t1 + t2) / 2)} с. До этого тело едет вперёд, после — назад, линия наклонена одинаково.`,
                "Найти надо, на сколько изменилась координата за эту секунду, без знака.",
              ],
              plan: [
                `Определяем границы ${ord} секунды: от ${fmtNum(t1)} до ${fmtNum(t2)} с.`,
                "Находим, где скорость проходит через ноль.",
                "Сравниваем площади до и после.",
                "Складываем со знаками.",
              ],
              steps: [
                { t: `Что такое «за ${ord} секунду»`,
                  p: ["Первая — от 0 до 1 с. Вторая — от 1 до 2 с. И так далее.",
                      `${ord[0].toUpperCase() + ord.slice(1)} — это от ${fmtNum(t1)} до ${fmtNum(t2)} с. Считаем один кусок длиной в секунду, а не всё с начала.`] },
                { t: "Где ноль скорости",
                  p: [`Линия пересекает ось на ${fmtNum((t1 + t2) / 2)} с — ровно посередине нашего куска.`,
                      "Полсекунды тело едет вперёд, полсекунды — назад."] },
                { t: "Сравниваем кусочки",
                  p: ["Оба — треугольники шириной по 0,5 с. Высоты одинаковые: линия прямая, наклон один и тот же.",
                      `f: s_1 = (${fmtNum(half)} · 0,5)/(2) = ${fmtNum(half * 0.25)}`,
                      "Значит, сколько тело уехало вперёд, ровно столько же вернулось назад."] },
                { t: "Складываем со знаками",
                  p: [`f: s_x = ${fmtNum(half * 0.25)} − ${fmtNum(half * 0.25)} = 0`,
                      "Координата не изменилась: тело закончило секунду там же, где её начало.",
                      "Модуль нуля — тоже ноль."] },
              ],
              ans: "0 (координата не изменилась)",
              err: `Считают путь: тело же двигалось, значит, не ноль. Но спрашивают изменение координаты — а оно ноль, потому что тело вернулось. Путь тут был бы ${fmtNum(half * 0.5)} м.`,
            },
            dbg: { graph, vars: { pts: line, t1, t2, h, nth: n } },
          };
        }

        /* два одинаковых треугольника по разные стороны оси;
           начало берём кратным ширине куска — тогда все узлы попадают на сетку */
        const h = rnd.int(2, 5) * yStep;
        const w = rnd.pick([2, 3, 4]);
        const t1 = w * rnd.pick([1, 2]);
        const line = [[0, 0], [t1, -h], [t1 + w, 0], [t1 + 2 * w, h], [t1 + 2 * w + w, 0]];
        const tEnd = t1 + w, tEnd2 = t1 + 2 * w;
        const a = t1 - w >= 0 ? t1 - w : 0;
        /* берём промежуток, симметричный относительно нуля скорости */
        const from = t1, to = t1 + 2 * w;
        const ps = pieces(line, from, to);
        const fit = fitY(line, yStep);
        const graph = {
          x: { label: "t, с", from: 0, to: t1 + 3 * w, step: w, tick: w },
          y: { label: "v, м/с", from: fit.yFrom, to: fit.yTo, step: yStep, tick: yStep },
          lines: [{ pts: line }],
        };
        const half = Math.abs(ps[0].area);
        return {
          plain: `Тело движется вдоль оси Ox. По графику зависимости проекции скорости тела v_x от времени t установите модуль перемещения тела за время от t_1 = ${fmtNum(from)} с до t_2 = ${fmtNum(to)} с. Ответ дайте в метрах.`,
          svg: GRAPH.plot(graph), table: null,
          answer: "0", unit: "м",
          simple: "Тело едет в одну сторону, а потом ровно столько же в обратную. Перемещение считает со знаком, поэтому куски гасят друг друга.",
          raz: {
            dano: [
              "График скорости v_x от времени t.",
              `Кусок от ${fmtNum(from)} до ${fmtNum(to)} с. С ${fmtNum(from)} до ${fmtNum(tEnd)} с линия под осью (тело едет назад, до ${fmtNum(h)} м/с по модулю), с ${fmtNum(tEnd)} до ${fmtNum(to)} с — над осью (едет вперёд, тоже до ${fmtNum(h)} м/с).`,
              "Найти надо перемещение без знака за этот кусок.",
            ],
            plan: [
              `Режем на ${fmtNum(tEnd)}-й секунде — там скорость проходит через ноль.`,
              "Площадь под осью берём с минусом.",
              "Площадь над осью — с плюсом.",
              "Складываем со знаками и убираем знак.",
            ],
            steps: [
              WHY_SIGN,
              ...ps.map(p => pieceStep(p, ps.length, true)),
              { t: "Складываем со знаками",
                p: [`f: s_x = ${signedSum(ps)} = 0`,
                    "Куски одинаковые и в разные стороны — они друг друга погасили."] },
              { t: "Что это значит",
                p: ["Тело уехало и вернулось на то же место. Перемещение ноль, без знака тоже ноль.",
                    `Путь при этом был бы ${fmtNum(half)} + ${fmtNum(half)} = ${fmtNum(2 * half)} м: тело двигалось, просто вернулось.`] },
            ],
            ans: "0 (тело вернулось в ту же точку)",
            err: `Отвечают ${fmtNum(2 * half)} — считают путь вместо перемещения. Слово «модуль» тут не спасает: ноль без знака — всё равно ноль.`,
          },
          dbg: { graph, vars: { pts: line, t1: from, t2: to, h, w } },
        };
      },
    },
  ],
};

if (typeof module !== "undefined" && module.exports) module.exports = GEN;
if (typeof window !== "undefined") (window.GEN = window.GEN || {})["fiz:" + GEN.key] = GEN;
