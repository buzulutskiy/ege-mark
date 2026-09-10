/* Мини-набор формул: дроби, корни, индексы, курсивные переменные.
   Своя реализация — без внешних библиотек, работает офлайн. */

"use strict";

const M_ESC = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const M_LAT = /[A-Za-z]/;

function mTok(src) {
  const out = [];
  let i = 0;
  const close = j => {            /* индекс парной скобки */
    let d = 0;
    for (let k = j; k < src.length; k++) {
      if (src[k] === "(") d++;
      else if (src[k] === ")") { d--; if (!d) return k; }
    }
    return -1;
  };
  const tail = () => {            /* индексы и степени, приклеенные к предыдущему */
    let h = "";
    while (i < src.length && (src[i] === "_" || src[i] === "^")) {
      const t = src[i] === "_" ? "sub" : "sup";
      i++;
      let v = "";
      if (src[i] === "{") { const e = src.indexOf("}", i); v = src.slice(i + 1, e); i = e + 1; }
      else { while (i < src.length && /[0-9A-Za-zА-Яа-яё]/.test(src[i])) v += src[i++]; }
      h += `<${t}>${M_ESC(v)}</${t}>`;
    }
    return h;
  };

  while (i < src.length) {
    const c = src[i];
    if (c === " ") { while (src[i] === " ") i++; out.push({ h: " ", sp: 1 }); continue; }
    if (c === "√" && src[i + 1] === "(") {
      const e = close(i + 1);
      const inner = mathHTML(src.slice(i + 2, e));
      i = e + 1;
      out.push({ h: `<span class="m-sqrt"><span class="m-sq">√</span><span class="m-sqb">${inner}</span></span>${tail()}` });
      continue;
    }
    if (c === "(") {
      const e = close(i);
      if (e < 0) { out.push({ h: "(" }); i++; continue; }
      const inner = mathHTML(src.slice(i + 1, e));
      i = e + 1;
      out.push({ h: `<span class="m-p">(</span>${inner}<span class="m-p">)</span>${tail()}`, bare: inner });
      continue;
    }
    if (/[0-9]/.test(c)) {
      let v = "";
      while (i < src.length && /[0-9.,]/.test(src[i])) v += src[i++];
      out.push({ h: `<span class="m-n">${v}</span>${tail()}` });
      continue;
    }
    if (/[A-Za-zА-Яа-яёΔα-ω]/.test(c)) {
      let v = "";
      while (i < src.length && /[A-Za-zА-Яа-яёΔα-ω]/.test(src[i])) v += src[i++];
      const it = v.length === 1 && M_LAT.test(v) || v === "Δ";
      out.push({ h: `<${it ? "i" : "span"} class="m-v">${M_ESC(v)}</${it ? "i" : "span"}>${tail()}` });
      continue;
    }
    if (c === "/") { out.push({ op: "/" }); i++; continue; }
    let v = "";
    while (i < src.length && !/[0-9A-Za-zА-Яа-яёΔα-ω(/√ ]/.test(src[i])) v += src[i++];
    if (!v) { v = src[i]; i++; }
    out.push({ h: `<span class="m-o">${M_ESC(v)}</span>` });
  }
  return out;
}

function mathHTML(src) {
  if (src == null || src === "") return "";
  const t = mTok(String(src));
  const out = [];
  for (let k = 0; k < t.length; k++) {
    if (t[k].sp) { out.push(t[k]); continue; }
    if (t[k].op === "/" && out.length) {
      let a = out.length - 1; while (a >= 0 && out[a].sp) a--;
      let b = k + 1; while (t[b] && t[b].sp) b++;
      const mathy = n => n && !n.op && !/^<span class="m-v"/.test(n.h);
      if (!mathy(out[a]) || !mathy(t[b])) { out.push({ h: `<span class="m-o">/</span>` }); continue; }
      while (out.length && out[out.length - 1].sp) out.pop();
      const num = out.pop();
      while (t[k + 1] && t[k + 1].sp) k++;
      const den = t[++k];
      if (!num || !den) { out.push({ h: `<span class="m-o">/</span>` }); continue; }
      out.push({ h: `<span class="m-f"><span class="m-fn">${num.bare || num.h}</span>` +
                    `<span class="m-fd">${den.bare || den.h}</span></span>` });
      continue;
    }
    if (t[k].op) { out.push({ h: `<span class="m-o">/</span>` }); continue; }
    out.push(t[k]);
  }
  return `<span class="m">${out.map(x => x.h).join("")}</span>`;
}

/* Официальные разборы Решу ЕГЭ приходят словами: «умножить на», «в квадрате»,
   «(1)/(2)». Приводим к нормальной записи. */
const M_SUB = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅",
                "6": "₆", "7": "₇", "8": "₈", "9": "₉", "x": "ₓ", "y": "ᵧ" };

function fixSol(t) {
  if (!t) return "";
  let s = String(t);
  s = s.replace(/корень из:\s*начало аргумента:\s*/g, "√(")
       .replace(/\s*конец аргумента/g, ")")
       .replace(/\bleft\|/g, "|").replace(/\bright\|/g, "|")
       .replace(/\bleft\(|\bright\)/g, "")
       .replace(/Rightarrow/g, " ⇒ ")
       .replace(/\bравносильно\b/g, " ⇔ ")
       .replace(/\s*в квадрате/g, "²").replace(/\s*в кубе/g, "³")
       .replace(/\s*умножить на\s*/g, " · ")
       .replace(/\s*разделить на\s*/g, " : ")
       .replace(/(^|[\s(=])плюс\s*/g, "$1+ ")
       .replace(/(^|[\s(=])минус\s*/g, "$1−")
       .replace(/\s*_\s*parallel/g, "∥").replace(/\s*_\s*(bot|perp)/g, "⊥")
       .replace(/\s*_\s*отн/g, "отн").replace(/\s*_\s*ср/g, "ср")
       .replace(/\s*_\s*([0-9xy]+)/g, (m, d) => d.split("").map(c => M_SUB[c] || c).join(""))
       .replace(/\((\d+(?:[.,]\d+)?)\)\s*\/\s*\((\d+(?:[.,]\d+)?)\)/g, "$1/$2")
       .replace(/\bl?\b1\/2\b/g, "½")
       .replace(/(\d)\s*([а-яё]+(?:\/[а-яё]+)?)(?![а-яё])/g, "$1 $2")
       .replace(/\(([^()]{1,28})\)\s*\/\s*\(([^()]{1,28})\)/g, "($1) / ($2)")
       .replace(/\s{2,}/g, " ")
       .replace(/\s+([,.;])/g, "$1");
  return s.trim();
}
