/* Детерминированный генератор случайных чисел для задач-близнецов.
   Одно и то же зерно всегда даёт одну и ту же задачу — можно «решить заново ту же».
   Работает и в браузере (глобал RND), и в node (module.exports). */
function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Обёртка с удобными методами. rnd.int(a, b) — целое от a до b включительно. */
function makeRnd(seed) {
  const f = mulberry32(seed);
  const r = {
    seed: seed,
    float: () => f(),
    int: (a, b) => a + Math.floor(f() * (b - a + 1)),
    pick: arr => arr[Math.floor(f() * arr.length)],
    /* случайный элемент, кроме указанного */
    pickNot: (arr, not) => { const c = arr.filter(x => x !== not); return c.length ? r.pick(c) : r.pick(arr); },
    /* перемешать копию массива */
    shuffle: arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    /* число из списка «красивых» — для шагов сетки, скоростей и т.п. */
    nice: (list) => r.pick(list),
    chance: p => f() < p,
  };
  return r;
}

/* Форматирование чисел по-русски: 2,5 а не 2.5; без хвоста .0 */
function fmtNum(x) {
  if (typeof x !== "number" || !isFinite(x)) return String(x);
  const v = Math.round(x * 1e6) / 1e6;
  return String(v).replace(".", ",");
}

/* Число в ответ: как принято в ЕГЭ — запятая, минус обычный */
function fmtAns(x) { return fmtNum(x); }

/* Знак: число со знаком для формул: 5 → "5", −5 → "−5" (типографский минус) */
function fmtSigned(x) { return fmtNum(x).replace("-", "−"); }

/* В формуле отрицательное число в скобках: −4 → "(−4)", 4 → "4" */
function fmtPar(x) { return x < 0 ? "(" + fmtSigned(x) + ")" : fmtSigned(x); }

/* Русское склонение: plural(3, "секунда", "секунды", "секунд") → "3 секунды" */
function plural(n, one, few, many) {
  const x = Math.abs(n) % 100, y = x % 10;
  const w = x > 10 && x < 20 ? many : y === 1 ? one : y > 1 && y < 5 ? few : many;
  return fmtNum(n) + " " + w;
}
/* Только слово, без числа */
function pluralWord(n, one, few, many) {
  const x = Math.abs(n) % 100, y = x % 10;
  return x > 10 && x < 20 ? many : y === 1 ? one : y > 1 && y < 5 ? few : many;
}

const RND = { make: makeRnd, mulberry32, fmtNum, fmtAns, fmtSigned, fmtPar, plural, pluralWord };
if (typeof module !== "undefined" && module.exports) module.exports = RND;
