/* global RND, GRAPH */
/* Приём «Ускорение по наклону графика скорости». */
const { fmtNum, fmtAns, fmtSigned, fmtPar, plural, pluralWord } = RND;

const BODIES = [
  { n: "тело", g: "тела" },
  { n: "автомобиль", g: "автомобиля" },
  { n: "материальная точка", g: "материальной точки" },
];

function toNum(a) { return parseFloat(String(a).replace(/−/g, "-").replace(",", ".")); }
function nice(v) { return Math.abs(Math.round(v * 10) - v * 10) < 1e-9 && Math.abs(v) <= 60; }
function niceNonZero(v) { return v !== 0 && nice(v) && Math.abs(v) >= 0.5; }

/* границы вертикальной оси под реально нарисованную линию */
function fitY(pts, yStep) {
  const ys = pts.map(p => p[1]);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  return { yFrom: lo >= 0 ? 0 : lo - yStep, yTo: hi + yStep };
}

/* ломаная по сетке: узлы в моментах, кратных xStep */
function brokenLine(rnd, T, xStep, levelsFrom, levelsTo, yStep, nSeg) {
  const cellsX = T / xStep;
  const segs = nSeg || rnd.pick([3, 4]);
  const cuts = rnd.shuffle(Array.from({ length: cellsX - 1 }, (_, i) => (i + 1) * xStep))
    .slice(0, segs - 1).sort((a, b) => a - b);
  const ts = [0, ...cuts, T];
  return ts.map(t => [t, rnd.int(levelsFrom, levelsTo) * yStep]);
}

const GEN = {
  key: "slope_a",
  title: "Ускорение по наклону графика скорости",
  kinds: [
    {
      id: "zero",
      title: "Ускорение равно нулю",
      constAnswer: true,                 /* ответ всегда 0 — меняются условия, а не он */
      /* по графику: на указанном куске скорость не меняется */
      check: t => {
        const v = t.dbg.vars, p1 = v.pts.find(p => p[0] === v.t1), p2 = v.pts.find(p => p[0] === v.t2);
        if (!p1 || !p2) return "концы участка не попали в узлы ломаной";
        if (p1[1] !== p2[1]) return `на участке скорость меняется с ${p1[1]} на ${p2[1]} — это не нулевое ускорение`;
        return Math.abs(toNum(t.answer)) < 1e-9 ? null : `ответ ${t.answer}, а ускорение здесь нулевое`;
      },
      make(rnd) {
        /* один из кусков ломаной — горизонтальный: там скорость не меняется */
        const T = rnd.pick([5, 6, 8]);
        const xStep = 1;
        const yStep = rnd.pick([2, 5, 10]);
        let pts, flat;
        do {
          pts = brokenLine(rnd, T, xStep, 1, 5, yStep, 4);
          /* делаем один кусок ровным */
          const k = rnd.int(0, pts.length - 2);
          pts[k + 1] = [pts[k + 1][0], pts[k][1]];
          flat = k;
        } while (pts.some((p, i) => i > 1 && p[1] === pts[i - 1][1] && i - 1 !== flat));

        const t1 = pts[flat][0], t2 = pts[flat + 1][0], vFlat = pts[flat][1];
        const fit = fitY(pts, yStep);
        const body = rnd.pick(BODIES);
        const graph = {
          x: { label: "t, с", from: 0, to: T, step: xStep, tick: xStep },
          y: { label: "v, м/с", from: fit.yFrom, to: fit.yTo, step: yStep, tick: yStep },
          lines: [{ pts }],
        };
        const plain = `На рисунке показан график зависимости проекции v_x скорости ${body.g} от времени t. Какова проекция a_x ускорения ${body.g} в интервале времени от ${fmtNum(t1)} до ${fmtNum(t2)} с? Ответ запишите в метрах на секунду в квадрате.`;
        return {
          plain, svg: GRAPH.plot(graph), table: null,
          answer: "0", unit: "м/с²",
          simple: `На куске с ${fmtNum(t1)}-й по ${fmtNum(t2)}-ю секунду линия горизонтальная — скорость не менялась. Значит, ускорение равно нулю.`,
          raz: {
            dano: [
              "Внимание: слева на графике скорость v_x в метрах в секунду, а не координата. Внизу секунды.",
              `Нужен кусок с ${fmtNum(t1)}-й по ${fmtNum(t2)}-ю секунду. На нём линия горизонтальная: и там и там скорость ${fmtNum(vFlat)} м/с.`,
              "Найти надо ускорение a_x, в метрах на секунду в квадрате.",
            ],
            plan: [
              "Смотрим, менялась ли скорость на куске.",
              "Считаем, на сколько изменилась.",
              "Делим на время. Не менялась — ускорение ноль.",
            ],
            steps: [
              { t: "Что такое ускорение",
                p: ["Ускорение — на сколько скорость растёт или падает за одну секунду.",
                    "Отсюда странная единица м/с²: это «метр в секунду за каждую секунду»."] },
              { t: "Формула",
                p: ["f: a_x = (v_2 − v_1)/(t_2 − t_1)",
                    "Читается так: ускорение = на сколько изменилась скорость, делить на сколько секунд прошло."] },
              { t: "Смотрим на график",
                p: [`Между ${fmtNum(t1)}-й и ${fmtNum(t2)}-й секундой линия ровная. Скорость в конце такая же, как в начале:`,
                    `f: v_2 − v_1 = ${fmtNum(vFlat)} − ${fmtNum(vFlat)} = 0`] },
              { t: "Считаем",
                p: [`f: a_x = (0)/(${fmtNum(t2 - t1)}) = 0`,
                    `Ускорение ноль. ${body.n[0].toUpperCase() + body.n.slice(1)} не разгонялся и не тормозил.`,
                    `Скорость при этом не нулевая — она равна ${fmtNum(vFlat)} м/с. Просто она не меняется.`] },
            ],
            ans: "0 (ускорения нет: скорость не менялась)",
            err: `Видят, что линия идёт высоко, и пишут в ответ саму скорость ${fmtNum(vFlat)}. Ровная линия на графике скорости — это ноль ускорения, а не ноль скорости.`,
          },
          dbg: { graph, vars: { T, pts, t1, t2, vFlat, flat } },
        };
      },
    },

    {
      id: "one_part",
      title: "Обычный участок",
      check: t => {
        const v = t.dbg.vars, p1 = v.pts.find(p => p[0] === v.t1), p2 = v.pts.find(p => p[0] === v.t2);
        if (!p1 || !p2) return "концы участка не попали в узлы ломаной";
        const a = (p2[1] - p1[1]) / (v.t2 - v.t1);
        if (v.moment != null && (v.moment <= v.t1 || v.moment >= v.t2))
          return `момент ${v.moment} с лежит вне участка ${v.t1}–${v.t2}`;
        return Math.abs(a - toNum(t.answer)) < 1e-9 ? null : `по графику ускорение ${a}, а в ответе ${t.answer}`;
      },
      make(rnd) {
        const T = rnd.pick([8, 10, 20, 30]);
        const xStep = T <= 10 ? 1 : T / 10;
        const yStep = rnd.pick([2, 5, 10]);
        const negV = rnd.chance(0.5);                        /* скорость заходит в минус */
        let pts, i0, a, t1, t2, v1, v2;
        do {
          pts = brokenLine(rnd, T, xStep, negV ? -2 : 0, 4, yStep);
          i0 = rnd.int(0, pts.length - 2);
          [t1, v1] = pts[i0]; [t2, v2] = pts[i0 + 1];
          a = (v2 - v1) / (t2 - t1);
        } while (!niceNonZero(a));

        /* иногда спрашивают не про участок, а про момент внутри него */
        const byMoment = rnd.chance(0.4) && (t2 - t1) >= 2 * xStep;
        const moment = byMoment ? t1 + xStep * Math.max(1, Math.floor((t2 - t1) / xStep / 2)) : null;

        const fit = fitY(pts, yStep);
        const body = rnd.pick(BODIES);
        const graph = {
          x: { label: "t, с", from: 0, to: T, step: xStep, tick: xStep },
          y: { label: "v, м/с", from: fit.yFrom, to: fit.yTo, step: yStep, tick: yStep },
          lines: [{ pts }],
        };
        const plain = byMoment
          ? `На рисунке приведён график зависимости проекции скорости ${body.g} от времени. Чему равна проекция ускорения ${body.g} в момент времени ${fmtNum(moment)} с? Ответ выразите в метрах на секунду в квадрате.`
          : `На рисунке приведён график зависимости проекции скорости v_x ${body.g} от времени t. Определите проекцию ускорения a_x ${body.g} в интервале времени от ${fmtNum(t1)} до ${fmtNum(t2)} с. Ответ запишите в метрах на секунду в квадрате.`;

        const crosses = v1 * v2 < 0;
        return {
          plain, svg: GRAPH.plot(graph), table: null,
          answer: fmtAns(a), unit: "м/с²",
          simple: byMoment
            ? `Момент ${fmtNum(moment)} с попадает внутрь прямого куска с ${fmtNum(t1)}-й по ${fmtNum(t2)}-ю секунду. На всём куске ускорение одно и то же, поэтому считаем по его краям.`
            : `На графике скорости бери кусок с ${fmtNum(t1)}-й по ${fmtNum(t2)}-ю секунду. Скорость там ${v2 > v1 ? "выросла" : "упала"} с ${fmtNum(v1)} до ${fmtNum(v2)} м/с. Ускорение — насколько быстро она менялась.`,
          raz: {
            dano: [
              "Слева на графике скорость v_x в метрах в секунду, а не координата. Внизу секунды.",
              byMoment
                ? `Спрашивают ускорение на ${fmtNum(moment)}-й секунде. Ищем прямой кусок, внутри которого эта секунда: это кусок с ${fmtNum(t1)} до ${fmtNum(t2)} с.`
                : `Кусок с ${fmtNum(t1)}-й по ${fmtNum(t2)}-ю секунду.`,
              `Берём края: на ${fmtNum(t1)} с скорость ${fmtSigned(v1)}, на ${fmtNum(t2)} с — ${fmtSigned(v2)}.`,
              crosses
                ? "Скорость меняет знак: тело тормозит до нуля, разворачивается и едет в другую сторону."
                : (v2 > v1 ? "Линия идёт вверх — скорость растёт." : "Линия идёт вниз — тело тормозит."),
              "Найти надо ускорение a_x, в метрах на секунду в квадрате.",
            ],
            plan: [
              ...(byMoment ? ["Находим прямой кусок, в который попала нужная секунда."] : []),
              "Берём скорость в начале и в конце куска.",
              "Считаем, на сколько она изменилась.",
              "Делим на длину куска.",
            ],
            steps: [
              ...(byMoment ? [{ t: "Почему считаем по всему куску",
                p: ["Прямая линия на графике скорости — скорость меняется ровно, ускорение везде одинаковое.",
                    `Секунда ${fmtNum(moment)} внутри куска, значит, ускорение там такое же, как по краям.`] }] : []),
              { t: "Формула",
                p: ["f: a_x = (v_2 − v_1)/(t_2 − t_1)",
                    "Читается так: ускорение = изменение скорости, делить на прошедшее время.",
                    `v_1 = ${fmtSigned(v1)} на ${fmtNum(t1)}-й секунде, v_2 = ${fmtSigned(v2)} на ${fmtNum(t2)}-й.`] },
              { t: "На сколько изменилась скорость",
                p: [`f: v_2 − v_1 = ${fmtSigned(v2)} − ${fmtPar(v1)} = ${fmtSigned(v2 - v1)}`,
                    ...(v1 < 0 ? ["Вычесть минус — это прибавить. Поэтому получилось больше, чем кажется на первый взгляд."] : []),
                    v2 > v1 ? `Скорость выросла на ${plural(v2 - v1, "метр", "метра", "метров")} в секунду.`
                            : `Скорость упала на ${plural(v1 - v2, "метр", "метра", "метров")} в секунду.`] },
              { t: "Делим",
                p: [`f: t_2 − t_1 = ${fmtNum(t2)} − ${fmtNum(t1)} = ${fmtNum(t2 - t1)}`,
                    `f: a_x = (${fmtSigned(v2 - v1)})/(${fmtNum(t2 - t1)}) = ${fmtSigned(a)}`,
                    a > 0 ? `Каждую секунду скорость прибавляет ${plural(a, "метр", "метра", "метров")} в секунду.`
                          : `Каждую секунду скорость убавляется на ${plural(Math.abs(a), "метр", "метра", "метров")} в секунду. Минус в ответе обязателен.`] },
            ],
            ans: `${fmtSigned(a)} (${pluralWord(a, "метр", "метра", "метров")} на секунду в квадрате)`,
            err: v1 < 0
              ? `Считают ${fmtNum(v2)} − ${fmtNum(Math.abs(v1))} = ${fmtNum(v2 - Math.abs(v1))} и получают не то. Начальная скорость с минусом: минус на минус даёт плюс.`
              : `Вычитают наоборот, ${fmtNum(v1)} − ${fmtNum(v2)}, и получают ${fmtSigned(-a)}. Порядок один: из конечной скорости вычитаем начальную.`,
          },
          dbg: { graph, vars: { T, pts, t1, t2, v1, v2, a, moment, byMoment } },
        };
      },
    },

    {
      id: "minmax",
      title: "Найти самое большое или самое маленькое",
      check: t => {
        const v = t.dbg.vars, pts = v.pts;
        const acc = [];
        for (let i = 1; i < pts.length; i++) acc.push(Math.abs((pts[i][1] - pts[i - 1][1]) / (pts[i][0] - pts[i - 1][0])));
        const want = v.max ? Math.max(...acc) : Math.min(...acc);
        if (acc.filter(x => Math.abs(x - want) < 1e-9).length > 1)
          return `вопрос неоднозначен: несколько кусков с модулем ${want} (${acc.join(", ")})`;
        return Math.abs(want - toNum(t.answer)) < 1e-9 ? null : `по графику ${v.max ? "наибольший" : "наименьший"} модуль ${want}, а в ответе ${t.answer}`;
      },
      make(rnd) {
        const T = 4 * rnd.pick([5, 10]);
        const xStep = T / 4;
        const yStep = rnd.pick([5, 10]);
        const max = rnd.chance(0.5);
        let pts, acc;
        do {
          pts = [0, 1, 2, 3, 4].map(i => [i * xStep, rnd.int(0, 4) * yStep]);
          acc = [];
          for (let i = 1; i < pts.length; i++) acc.push((pts[i][1] - pts[i - 1][1]) / (pts[i][0] - pts[i - 1][0]));
        } while (
          acc.some(x => !niceNonZero(x)) ||
          (() => { const m = acc.map(Math.abs); const w = max ? Math.max(...m) : Math.min(...m);
                   return m.filter(x => Math.abs(x - w) < 1e-9).length > 1; })() ||
          !acc.some(x => x < 0)
        );
        const abs = acc.map(Math.abs);
        const want = max ? Math.max(...abs) : Math.min(...abs);
        const fit = fitY(pts, yStep);
        const graph = {
          x: { label: "t, с", from: 0, to: T, step: xStep, tick: xStep },
          y: { label: "v, м/с", from: 0, to: fit.yTo, step: yStep, tick: yStep },
          lines: [{ pts }],
        };
        const seg = i => `f: a_x = (${fmtNum(pts[i + 1][1])} − ${fmtNum(pts[i][1])})/(${fmtNum(xStep)}) = ${fmtSigned(acc[i])}`;
        return {
          plain: `Автомобиль движется по прямой улице. На графике представлена зависимость скорости автомобиля от времени. Чему равен ${max ? "максимальный" : "минимальный"} модуль ускорения? Ответ выразите в метрах на секунду в квадрате.`,
          svg: GRAPH.plot(graph), table: null,
          answer: fmtAns(want), unit: "м/с²",
          simple: `График скорости состоит из четырёх прямых кусков. Надо посчитать ускорение на каждом и выбрать ${max ? "самое большое" : "самое маленькое"} по модулю.`,
          raz: {
            dano: [
              "График скорости автомобиля: внизу секунды, слева метры в секунду.",
              `Линия ломаная, четыре прямых куска по ${plural(xStep, "секунде", "секунды", "секунд")}.`,
              `Точки изломов: ${pts.map(p => `на ${fmtNum(p[0])} с — ${fmtNum(p[1])}`).join("; ")} (м/с).`,
              `Найти надо ${max ? "самое большое" : "самое маленькое"} ускорение без знака.`,
            ],
            plan: [
              "Считаем ускорение на каждом из четырёх кусков.",
              "У каждого убираем знак.",
              `Выбираем самое ${max ? "большое" : "маленькое"}.`,
            ],
            steps: [
              { t: "Как понять, где ускорение больше",
                p: ["Ускорение — это крутизна линии на графике скорости. Резче линия вверх или вниз — больше ускорение по модулю.",
                    `Все куски здесь по ${plural(xStep, "секунде", "секунды", "секунд")}, поэтому сравнивать можно просто по тому, на сколько изменилась скорость.`,
                    "f: a_x = (v_2 − v_1)/(t_2 − t_1)"] },
              { t: `Кусок 0–${fmtNum(xStep)} с`, p: [seg(0), `Без знака — ${fmtNum(abs[0])}.`] },
              { t: `Кусок ${fmtNum(xStep)}–${fmtNum(2 * xStep)} с`, p: [seg(1), `Без знака — ${fmtNum(abs[1])}.`] },
              { t: `Кусок ${fmtNum(2 * xStep)}–${fmtNum(3 * xStep)} с`, p: [seg(2), `Без знака — ${fmtNum(abs[2])}.`] },
              { t: `Кусок ${fmtNum(3 * xStep)}–${fmtNum(T)} с`, p: [seg(3), `Без знака — ${fmtNum(abs[3])}.`] },
              { t: "Выбираем",
                p: [`Числа без знаков: ${abs.map(fmtNum).join("; ")}.`,
                    `Самое ${max ? "большое" : "маленькое"} — ${fmtNum(want)}. Это кусок, где линия ${max ? "круче" : "положе"} всего.`] },
            ],
            ans: `${fmtNum(want)} (${pluralWord(want, "метр", "метра", "метров")} на секунду в квадрате)`,
            err: max
              ? `Сравнивают со знаками и берут ${fmtSigned(Math.max(...acc))} как «самое большое». Просят модуль: сначала убираем знаки.`
              : `Отвечают ${fmtSigned(Math.min(...acc))}, приняв «минимальное» за «самое отрицательное». Минимальный модуль — самый пологий кусок.`,
          },
          dbg: { graph, vars: { T, xStep, pts, acc, abs, want, max } },
        };
      },
    },
  ],
};

if (typeof module !== "undefined" && module.exports) module.exports = GEN;
if (typeof window !== "undefined") (window.GEN = window.GEN || {})["fiz:" + GEN.key] = GEN;
