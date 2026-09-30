/* Калькулятор дробей: выражение одной строкой, точная арифметика на BigInt.
   Работает и в браузере (window.Drobi), и в Node (module.exports) - для тестов. */
(function (root) {
  "use strict";

  const MAX_LEN = 1000;
  const UNI = { "½": [1, 2], "⅓": [1, 3], "⅔": [2, 3], "¼": [1, 4], "¾": [3, 4], "⅕": [1, 5], "⅖": [2, 5], "⅗": [3, 5], "⅘": [4, 5], "⅙": [1, 6], "⅚": [5, 6], "⅐": [1, 7], "⅛": [1, 8], "⅜": [3, 8], "⅝": [5, 8], "⅞": [7, 8], "⅑": [1, 9], "⅒": [1, 10] };
  const SP = "[ \\t\\u00a0\\u202f\\u2009]";

  function gcd(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; }
  function frac(n, d) {
    if (d === 0n) throw new Error("Деление на ноль");
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d) || 1n;
    return { n: n / g, d: d / g };
  }
  const add = (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
  const sub = (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
  const mul = (a, b) => frac(a.n * b.n, a.d * b.d);
  const div = (a, b) => { if (b.n === 0n) throw new Error("Деление на ноль"); return frac(a.n * b.d, a.d * b.n); };

  // Число: 12, 0,75, 0.75 (без пробелов). Возвращает дробь.
  function parseDecimal(s) {
    s = s.replace(",", ".");
    const i = s.indexOf(".");
    if (i < 0) return frac(BigInt(s), 1n);
    const frPart = s.slice(i + 1);
    return frac(BigInt(s.slice(0, i) + frPart), 10n ** BigInt(frPart.length));
  }

  function normalize(src) {
    let s = src.replace(/[−–—]/g, "-").replace(/[×·]/g, "*")
      .replace(/[÷:]/g, "÷").replace(/⁄/g, "/");
    // юникод-дроби из Word: 2¾ -> 2 3/4, ½ -> 1/2
    s = s.replace(/(\d)?([½⅓-⅞¼¾⅐⅑⅒])/g, function (m, digit, ch) {
      const u = UNI[ch]; if (!u) return m;
      return (digit ? digit + " " : "") + u[0] + "/" + u[1];
    });
    // латинская x / русская х - умножение только между числами или скобками
    s = s.replace(new RegExp("(?<=[\\d)])" + SP + "*[xX\\u0445\\u0425]" + SP + "*(?=[\\d(])", "g"), " * ");
    return s;
  }

  function tokenize(src) {
    const s = normalize(src);
    const tokens = [];
    let i = 0;
    const isD = (c) => c >= "0" && c <= "9";
    const isSp = (c) => c === " " || c === "\t" || c === " " || c === " " || c === " ";
    while (i < s.length) {
      const c = s[i];
      if (isSp(c) || c === "\n" || c === "\r") { i++; continue; }
      if (isD(c) || ((c === "," || c === ".") && isD(s[i + 1] || ""))) {
        const rest = s.slice(i);
        const prev = tokens[tokens.length - 1];
        const afterNum = prev && (prev.t === "bar" || prev.t === "num" || prev.t === "%");
        // смешанное число: 2 3/4 - целая часть, пробел, ПРАВИЛЬНАЯ дробь (числитель без нуля впереди и меньше знаменателя)
        const mixed = new RegExp("^(\\d+)" + SP + "+([1-9]\\d*)" + SP + "*\\/" + SP + "*(\\d+)(?![\\d,.])").exec(rest);
        if (mixed && !afterNum && BigInt(mixed[2]) < BigInt(mixed[3])) {
          const w = BigInt(mixed[1]), n = BigInt(mixed[2]), d = BigInt(mixed[3]);
          tokens.push({ t: "num", v: add(frac(w, 1n), frac(n, d)), pos: i });
          i += mixed[0].length; continue;
        }
        // число с пробелами-разделителями тысяч: 1 000 000, 12 345,67
        const grouped = new RegExp("^\\d{1,3}(?:" + SP + "\\d{3})+(?![\\d])([.,]\\d+)?").exec(rest);
        const plain = /^(\d+([.,]\d+)?|[.,]\d+)/.exec(rest);
        let text, len;
        if (grouped && grouped[0].length > plain[0].length) { text = grouped[0].replace(new RegExp(SP, "g"), ""); len = grouped[0].length; }
        else { text = plain[0]; len = plain[0].length; }
        if (text[0] === "," || text[0] === ".") text = "0" + text;
        tokens.push({ t: "num", v: parseDecimal(text), pos: i });
        i += len; continue;
      }
      if (c === "%") { tokens.push({ t: "%", pos: i }); i++; continue; }
      if (c === "/") {
        // дробная черта: «1/2» без пробелов вокруг; «1 / 2» и «:» - знак деления
        const tight = i > 0 && i + 1 < s.length && !isSp(s[i - 1]) && !isSp(s[i + 1]);
        tokens.push({ t: tight ? "bar" : "/", pos: i }); i++; continue;
      }
      if (c === "÷") { tokens.push({ t: "/", pos: i }); i++; continue; }
      if ("+-*()".includes(c)) { tokens.push({ t: c, pos: i }); i++; continue; }
      throw new Error("Непонятный символ «" + c + "» в позиции " + (i + 1) + ". Допустимы цифры, + - * : / ( ) и %");
    }
    return tokens;
  }

  function evaluate(src) {
    if (String(src).length > MAX_LEN) throw new Error("Слишком длинное выражение (не более " + MAX_LEN + " знаков)");
    try { return evaluateInner(src); }
    catch (e) {
      if (e instanceof RangeError) throw new Error("Слишком сложное выражение: уменьшите вложенность скобок");
      throw e;
    }
  }

  function evaluateInner(src) {
    const toks = tokenize(src);
    if (!toks.length) throw new Error("Введите выражение");
    let p = 0;
    const peek = () => toks[p];
    function primary() {
      let v = atom();
      while (peek() && (peek().t === "bar" || peek().t === "%")) {
        const t = toks[p++].t;
        v = t === "bar" ? div(v, atom()) : div(v, frac(100n, 1n));
      }
      return v;
    }
    function atom() {
      const t = toks[p];
      if (!t) throw new Error("Выражение оборвано: не хватает числа");
      if (t.t === "num") { p++; return t.v; }
      if (t.t === "(") {
        p++; const v = sum();
        if (!toks[p] || toks[p].t !== ")") throw new Error("Не закрыта скобка");
        p++; return v;
      }
      if (t.t === "-") { p++; const v = atom(); return frac(-v.n, v.d); }
      if (t.t === "+") { p++; return atom(); }
      throw new Error("Лишний знак «" + t.t + "» в позиции " + (t.pos + 1));
    }
    function product() {
      let v = primary();
      while (peek() && (peek().t === "*" || peek().t === "/")) {
        const op = toks[p++].t; const r = primary();
        v = op === "*" ? mul(v, r) : div(v, r);
      }
      return v;
    }
    function sum() {
      let v = product();
      while (peek() && (peek().t === "+" || peek().t === "-")) {
        const op = toks[p++].t; const r = product();
        v = op === "+" ? add(v, r) : sub(v, r);
      }
      return v;
    }
    const v = sum();
    if (p < toks.length) {
      const t = toks[p];
      throw new Error(t.t === ")" ? "Лишняя закрывающая скобка" : "Между числами пропущен знак действия (позиция " + (t.pos + 1) + ")");
    }
    return v;
  }

  // Десятичная запись с периодом: 1/3 -> 0,(3); 1/8 -> 0,125
  function decimal(f, maxDigits) {
    maxDigits = maxDigits || 30;
    const neg = f.n < 0n; let n = neg ? -f.n : f.n; const d = f.d;
    const whole = n / d; let r = n % d;
    if (r === 0n) return (neg ? "-" : "") + whole.toString();
    const seen = new Map(); const digits = [];
    while (r !== 0n && !seen.has(r.toString()) && digits.length < maxDigits) {
      seen.set(r.toString(), digits.length);
      r *= 10n; digits.push((r / d).toString()); r %= d;
    }
    let out = digits.join("");
    if (r !== 0n && seen.has(r.toString())) {
      const k = seen.get(r.toString());
      out = out.slice(0, k) + "(" + out.slice(k) + ")";
    } else if (r !== 0n) { out += "..."; }
    return (neg ? "-" : "") + whole.toString() + "," + out;
  }

  function percent(f) {
    const v = f.n * 10000n / f.d; // две цифры после запятой, усечение
    const neg = v < 0n; const a = neg ? -v : v;
    let s = (a / 100n).toString() + "," + (a % 100n).toString().padStart(2, "0");
    s = s.replace(/0+$/, "").replace(/,$/, "");
    const exact = (f.n * 10000n) % f.d === 0n;
    return (neg ? "-" : "") + s + " %" + (exact ? "" : " (округлено вниз)");
  }

  function mixed(f) {
    const neg = f.n < 0n; const n = neg ? -f.n : f.n;
    const w = n / f.d; const r = n % f.d;
    if (r === 0n) return (neg ? "-" : "") + w.toString();
    if (w === 0n) return (neg ? "-" : "") + r + "/" + f.d;
    return (neg ? "-" : "") + w + " " + r + "/" + f.d;
  }

  function describe(f) {
    return {
      fraction: f.d === 1n ? f.n.toString() : f.n + "/" + f.d,
      mixed: mixed(f),
      decimal: decimal(f),
      percent: percent(f),
      isInteger: f.d === 1n,
      isProper: f.n >= 0n && f.n < f.d && f.d !== 1n,
      value: f,
    };
  }

  const api = { evaluate, describe, decimal, percent, mixed, frac, add, sub, mul, div, tokenize };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Drobi = api;
})(typeof window !== "undefined" ? window : globalThis);
