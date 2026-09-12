#!/usr/bin/env node
/* Какие шаги разбора годятся для мини-теста «выбери верную запись».

   Решает это тот же код, который потом рисует тест на экране, — функции
   stepVariants и stepTest из course.js. Иначе сборщик и приложение начинают
   расходиться: сборщик ставит вопрос, а нарисовать его нечем.

   node tools/picksteps.js  →  {"sd930022":[1,2], …}
*/
const fs = require("fs"), path = require("path"), vm = require("vm");

const root = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(root, "course.js"), "utf8");

/* вырезаем кусок с генератором тестов — от numOf до эталонной записи */
const from = src.indexOf("function numOf");
const to = src.indexOf("/* Эталонная запись");
if (from < 0 || to < 0) { console.error("не нашёл генератор тестов в course.js"); process.exit(1); }

const sb = { console };
vm.createContext(sb);
vm.runInContext(src.slice(from, to) + "\n;this.__stepTest = stepTest;", sb);
const stepTest = sb.__stepTest;

const num = process.argv[2] || "1";
const sid = process.argv[3] || "fiz";
const raz = JSON.parse(fs.readFileSync(path.join(root, `lessons/razbor-${sid}-${num}.json`), "utf8"));

const out = {};
Object.keys(raz).forEach(id => {
  const ks = [];
  (raz[id].steps || []).forEach((st, k) => { if (stepTest(st)) ks.push(k); });
  if (ks.length) out[id] = ks;
});
process.stdout.write(JSON.stringify(out));
