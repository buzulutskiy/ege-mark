/* global RND, GRAPH */
/* Приём «По графику ускорения найти скорость или путь».
   Главная особенность: на вертикальной оси ускорение, а не скорость. */
const { fmtNum, fmtAns, fmtSigned, fmtPar, plural, pluralWord } = RND;

function toNum(a) { return parseFloat(String(a).replace(/−/g, "-").replace(",", ".")); }
function nice(v) { return Math.abs(Math.round(v * 10) - v * 10) < 1e-9; }

/* ступенчатый график ускорения: [[t0,a1],[t1,a1],[t1,a2],[t2,a2], …] */
function steps(segs) {
  const pts = [];
  segs.forEach(s => { pts.push([s.from, s.a]); pts.push([s.to, s.a]); });
  return pts;
}
function fitY(pts, yStep) {
  const ys = pts.map(p => p[1]);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  return { yFrom: lo >= 0 ? 0 : lo - yStep, yTo: hi + yStep };
}

const BODIES = [
  { n: "тело", g: "тела", was: "покоилось" },
  { n: "автомобиль", g: "автомобиля", was: "покоился" },
  { n: "точечное тело", g: "точечного тела", was: "покоилось" },
];

const GEN = {
  key: "from_a",
  title: "По графику ускорения найти скорость или путь",
  kinds: [
    {
      id: "v_start",
      title: "Скорость в начале движения",
      check: t => {
        const v = t.dbg.vars;
        const v0 = v.vAt - v.a * v.tAt;
        return Math.abs(v0 - toNum(t.answer)) < 1e-9 ? null : `${v.vAt} − (${v.a})·${v.tAt} = ${v0}, а в ответе ${t.answer}`;
      },
      make(rnd) {
        /* ускорение постоянное и отрицательное; дана скорость в момент t — ищем начальную */
        const a = -rnd.pick([1, 2, 2.5, 4, 5]);
        const tAt = rnd.pick([4, 5, 6, 8, 10]);
        const vAt = rnd.pick([5, 10, 15, 20]);
        const v0 = vAt - a * tAt;
        if (!nice(v0) || v0 > 60) return GEN.kinds[0].make(rnd);
        const T = tAt + rnd.pick([2, 4]);
        const yStep = Math.abs(a) <= 2.5 ? 1 : 2;
        const pts = steps([{ from: 0, to: T, a }]);
        const fit = fitY(pts, yStep);
        const body = rnd.pick(BODIES);
        const graph = {
          x: { label: "t, с", from: 0, to: T, step: 1, tick: T > 10 ? 2 : 1 },
          y: { label: "a, м/с²", from: fit.yFrom, to: fit.yTo, step: yStep, tick: yStep },
          lines: [{ pts, dots: false }],
        };
        return {
          plain: `${body.n[0].toUpperCase() + body.n.slice(1)} движется вдоль прямой Ox по гладкой горизонтальной поверхности. На рисунке изображён график зависимости проекции a_x ускорения этого тела от времени t. В момент времени t = ${fmtNum(tAt)} с проекция скорости этого тела на ось Ox равна ${fmtNum(vAt)} м/с. Чему был равен модуль скорости этого тела в момент начала движения при t = 0? Ответ дайте в метрах в секунду.`,
          svg: GRAPH.plot(graph), table: null,
          answer: fmtAns(v0), unit: "м/с",
          simple: `На графике ускорение, а не скорость. Оно постоянное и равно ${fmtSigned(a)} м/с² — тело тормозит. Известна скорость на ${fmtNum(tAt)}-й секунде, а найти надо начальную — то есть идти по формуле назад.`,
          raz: {
            dano: [
              "Внимание: на графике ускорение a_x, а не скорость. Внизу секунды, слева метры на секунду в квадрате.",
              `Линия горизонтальная: ускорение постоянно и равно ${fmtSigned(a)} м/с². Минус — тело тормозит.`,
              `Дано: на ${fmtNum(tAt)}-й секунде скорость ${fmtNum(vAt)} м/с.`,
              "Найти надо скорость в самом начале, при t = 0.",
            ],
            plan: [
              "Берём с графика ускорение.",
              "Пишем формулу скорости при разгоне.",
              "Подставляем известную скорость и выражаем начальную.",
            ],
            steps: [
              { t: "Что даёт график ускорения",
                p: ["Ровная линия — ускорение не меняется: тело всё время тормозит одинаково.",
                    `Значение читаем слева: a_x = ${fmtSigned(a)} м/с².`] },
              { t: "Формула скорости",
                p: ["f: v = v_0 + a · t",
                    "Читается так: скорость сейчас = скорость в начале плюс прибавка от ускорения за время t.",
                    "v_0 — начальная скорость, её ищем."] },
              { t: "Подставляем известное",
                p: [`Известно: v = ${fmtNum(vAt)} на t = ${fmtNum(tAt)}, a = ${fmtSigned(a)}.`,
                    `f: ${fmtNum(vAt)} = v_0 + ${fmtPar(a)} · ${fmtNum(tAt)}`,
                    `f: ${fmtNum(vAt)} = v_0 − ${fmtNum(Math.abs(a * tAt))}`] },
              { t: "Выражаем начальную скорость",
                p: [`Прибавляем ${fmtNum(Math.abs(a * tAt))} к обеим частям:`,
                    `f: v_0 = ${fmtNum(vAt)} + ${fmtNum(Math.abs(a * tAt))} = ${fmtNum(v0)}`] },
              { t: "Проверяем",
                p: [`Тело тормозило по ${plural(Math.abs(a), "метру", "метра", "метров")} в секунду каждую секунду. За ${plural(tAt, "секунду", "секунды", "секунд")} оно потеряло ${fmtNum(Math.abs(a * tAt))} м/с: ${fmtNum(v0)} − ${fmtNum(Math.abs(a * tAt))} = ${fmtNum(vAt)}. Совпало с условием.`] },
            ],
            ans: `${fmtNum(v0)} (${pluralWord(v0, "метр", "метра", "метров")} в секунду)`,
            err: `Принимают график ускорения за график скорости и читают ответ прямо с картинки. Или берут a = ${fmtNum(Math.abs(a))} без минуса и получают ${fmtNum(vAt - Math.abs(a) * tAt)}.`,
          },
          dbg: { graph, vars: { a, tAt, vAt, v0, T } },
        };
      },
    },

    {
      id: "path_second",
      title: "Путь за одну секунду",
      check: t => {
        const v = t.dbg.vars;
        const vAfter = v.a * v.tAcc;                      /* скорость к концу разгона */
        const s = vAfter * 1;                             /* ускорения нет — путь за секунду */
        return Math.abs(s - toNum(t.answer)) < 1e-9 ? null : `скорость ${vAfter}, путь за секунду ${s}, а в ответе ${t.answer}`;
      },
      make(rnd) {
        /* первые tAcc секунд ускорение a, дальше ноль; спрашивают путь за следующую секунду */
        const a = rnd.pick([2, 3, 4, 5]);
        const tAcc = rnd.pick([2, 3]);
        const T = tAcc + rnd.pick([2, 3]);
        const vAfter = a * tAcc;
        const s = vAfter;
        const yStep = 1;
        const pts = steps([{ from: 0, to: tAcc, a }, { from: tAcc, to: T, a: 0 }]);
        const fit = fitY(pts, yStep);
        const graph = {
          x: { label: "t, с", from: 0, to: T, step: 1, tick: 1 },
          y: { label: "a, м/с²", from: 0, to: fit.yTo, step: yStep, tick: yStep },
          lines: [{ pts, dots: false }],
        };
        const nth = tAcc + 1;
        const ord = ["первую", "вторую", "третью", "четвёртую", "пятую", "шестую"][nth - 1];
        return {
          plain: `Покоившееся точечное тело начинает движение вдоль оси Ox. На рисунке показан график зависимости проекции a_x ускорения этого тела от времени t. Определите, какой путь в метрах прошло тело за ${ord} секунду движения.`,
          svg: GRAPH.plot(graph), table: null,
          answer: fmtAns(s), unit: "м",
          simple: `На ${ord} секунде ускорение уже равно нулю — тело едет ровно. Но с какой скоростью, надо сначала узнать: её оно набрало за первые ${plural(tAcc, "секунду", "секунды", "секунд")}.`,
          raz: {
            dano: [
              "На графике ускорение a_x, не скорость. В начале тело покоилось, значит, v_0 = 0.",
              `Первые ${plural(tAcc, "секунду", "секунды", "секунд")} ускорение равно ${fmtNum(a)} м/с². После ${fmtNum(tAcc)}-й секунды — ноль.`,
              `Спрашивают путь за ${ord} секунду — это промежуток от ${fmtNum(tAcc)} до ${fmtNum(nth)} с.`,
              "Ответ нужен в метрах.",
            ],
            plan: [
              `Считаем, какую скорость тело набрало за первые ${plural(tAcc, "секунду", "секунды", "секунд")}.`,
              `На ${ord} секунде ускорения нет — тело едет ровно с этой скоростью.`,
              "Путь за эту секунду = скорость умножить на 1 секунду.",
            ],
            steps: [
              { t: "Почему нельзя ответить сразу",
                p: [`На ${ord} секунде ускорение ноль — тело едет ровно. Но с какой скоростью, на графике ускорения не видно.`,
                    "Сначала узнаём, сколько скорости оно накопило раньше."] },
              { t: `Скорость к концу ${fmtNum(tAcc)}-й секунды`,
                p: ["f: v = v_0 + a · t",
                    `v_0 = 0 (тело покоилось), a = ${fmtNum(a)}, t = ${fmtNum(tAcc)}.`,
                    `f: v = 0 + ${fmtNum(a)} · ${fmtNum(tAcc)} = ${fmtNum(vAfter)}`,
                    `К ${fmtNum(tAcc)}-й секунде тело разогналось до ${fmtNum(vAfter)} м/с.`] },
              { t: `Что происходит на ${ord} секунде`,
                p: [`Ускорение стало нулевым — скорость больше не меняется и остаётся ${fmtNum(vAfter)} м/с.`,
                    "Движение ровное, значит, путь считается просто."] },
              { t: "Считаем путь",
                p: ["f: s = v · t",
                    "Читается так: путь = скорость умножить на время.",
                    `f: s = ${fmtNum(vAfter)} · 1 = ${fmtNum(s)}`,
                    `За ${ord} секунду тело прошло ${plural(s, "метр", "метра", "метров")}.`] },
            ],
            ans: `${fmtNum(s)} (${pluralWord(s, "метр", "метра", "метров")})`,
            err: `Берут t = ${fmtNum(nth)} вместо одной секунды и отвечают ${fmtNum(vAfter * nth)}. «За ${ord} секунду» — кусок длиной ровно 1 с.`,
          },
          dbg: { graph, vars: { a, tAcc, T, vAfter, s } },
        };
      },
    },

    {
      id: "path_after",
      title: "Путь после разгона",
      check: t => {
        const v = t.dbg.vars;
        const v0 = v.a1 * v.t1;
        const s = v0 * v.dt + v.a2 * v.dt * v.dt / 2;
        return Math.abs(s - toNum(t.answer)) < 1e-9 ? null : `${v0}·${v.dt} + ${v.a2}·${v.dt}²/2 = ${s}, а в ответе ${t.answer}`;
      },
      make(rnd) {
        /* разгон, потом торможение; путь считаем на втором куске */
        const a1 = rnd.pick([1, 2, 3]);
        const t1 = rnd.pick([10, 20]);
        const a2 = -a1;
        const dt = rnd.pick([5, 10]);
        const T = t1 + dt + rnd.pick([0, 5]);
        const v0 = a1 * t1;
        const s = v0 * dt + a2 * dt * dt / 2;
        if (!nice(s) || s <= 0) return GEN.kinds[2].make(rnd);
        const yStep = 1;
        const pts = steps([{ from: 0, to: t1, a: a1 }, { from: t1, to: T, a: a2 }]);
        const fit = fitY(pts, yStep);
        const graph = {
          x: { label: "t, с", from: 0, to: T, step: 5, tick: 5 },
          y: { label: "a, м/с²", from: fit.yFrom, to: fit.yTo, step: yStep, tick: yStep },
          lines: [{ pts, dots: false }],
        };
        return {
          plain: `Автомобиль движется вдоль прямой дороги. На рисунке представлен график зависимости проекции a его ускорения от времени t. Известно, что при t = 0 автомобиль покоился. Какой путь прошёл автомобиль за промежуток времени от ${fmtNum(t1)} с до ${fmtNum(t1 + dt)} с? Ответ выразите в метрах.`,
          svg: GRAPH.plot(graph), table: null,
          answer: fmtAns(s), unit: "м",
          simple: `Сначала надо узнать, какую скорость машина набрала к ${fmtNum(t1)}-й секунде, и только потом считать путь на следующем куске, где она уже тормозит.`,
          raz: {
            dano: [
              "На графике ускорение a автомобиля, не скорость. В начале автомобиль стоял: v_0 = 0.",
              `Первые ${plural(t1, "секунду", "секунды", "секунд")} ускорение равно ${fmtNum(a1)} м/с². После ${fmtNum(t1)}-й секунды — ${fmtSigned(a2)} м/с²: начал тормозить.`,
              `Найти надо путь за кусок от ${fmtNum(t1)} до ${fmtNum(t1 + dt)} с, в метрах.`,
            ],
            plan: [
              `Считаем скорость к ${fmtNum(t1)}-й секунде.`,
              "Она — начальная скорость для второго куска.",
              "Считаем путь на втором куске по формуле с ускорением.",
            ],
            steps: [
              { t: "Почему два шага",
                p: [`Спрашивают про кусок ${fmtNum(t1)}–${fmtNum(t1 + dt)} с. Чтобы посчитать путь, нужна скорость в его начале — а она набралась за первые ${plural(t1, "секунду", "секунды", "секунд")}.`,
                    "Поэтому сначала первый кусок, хотя про него и не спрашивают."] },
              { t: `Скорость к ${fmtNum(t1)}-й секунде`,
                p: ["f: v = v_0 + a · t",
                    `v_0 = 0, a = ${fmtNum(a1)}, t = ${fmtNum(t1)}:`,
                    `f: v = 0 + ${fmtNum(a1)} · ${fmtNum(t1)} = ${fmtNum(v0)}`] },
              { t: "Формула пути на втором куске",
                p: ["f: s = v_0 · t + (a · t^2)/(2)",
                    "Читается так: путь = сколько проехал бы без изменения скорости + поправка от ускорения.",
                    `Тут v_0 = ${fmtNum(v0)} — скорость в начале куска, a = ${fmtSigned(a2)} — новое ускорение, t = ${fmtNum(dt)} — длина куска.`] },
              { t: "Подставляем",
                p: [`f: s = ${fmtNum(v0)} · ${fmtNum(dt)} + (${fmtPar(a2)} · ${fmtNum(dt)}^2)/(2)`,
                    `f: ${fmtNum(dt)}^2 = ${fmtNum(dt * dt)}`,
                    `f: s = ${fmtNum(v0 * dt)} − (${fmtNum(Math.abs(a2) * dt * dt)})/(2) = ${fmtNum(v0 * dt)} − ${fmtNum(Math.abs(a2) * dt * dt / 2)} = ${fmtNum(s)}`] },
              { t: "Проверяем",
                p: [`Без торможения автомобиль проехал бы ${plural(v0 * dt, "метр", "метра", "метров")}. Торможение отняло ${fmtNum(Math.abs(a2) * dt * dt / 2)} — вышло ${fmtNum(s)}. Логично.`] },
            ],
            ans: `${fmtNum(s)} (${pluralWord(s, "метр", "метра", "метров")})`,
            err: `Считают, будто скорость всё время ${fmtNum(v0)} м/с, и отвечают ${fmtNum(v0 * dt)} — забывают про торможение. Или берут t = ${fmtNum(t1 + dt)} вместо длины куска.`,
          },
          dbg: { graph, vars: { a1, a2, t1, dt, T, v0, s } },
        };
      },
    },
  ],
};

if (typeof module !== "undefined" && module.exports) module.exports = GEN;
if (typeof window !== "undefined") (window.GEN = window.GEN || {})["fiz:" + GEN.key] = GEN;
