(function () {
  "use strict";
  var G = window.Gosposhlina;
  var $ = function (id) { return document.getElementById(id); };
  var court = $("court"), kind = $("kind"), party = $("party"), price = $("price");
  var fmt = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var fmt0 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
  var rub = function (k) { return fmt.format(k / 100).replace(/ /g, " ") + " ₽"; };

  function fillKinds() {
    var keep = kind.value, list = G.KINDS[court.value];
    kind.innerHTML = "";
    Object.keys(list).forEach(function (k) {
      var o = document.createElement("option"); o.value = k; o.textContent = list[k].label; kind.appendChild(o);
    });
    if (list[keep]) kind.value = keep;
    else if (keep) resetNote = "В этом суде нет вида «" + (G.KINDS[court.value === "arb" ? "sou" : "arb"][keep] || { label: keep }).label + "», выбран первый вид из списка.";
  }
  var resetNote = "";

  function parsePrice(s) {
    var t = String(s).replace(/[\s ]/g, "").replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
    return Number(t);
  }

  function steps(c, p) {
    var scale = c === "arb" ? G.SCALE_ARB : G.SCALE_SOU, cap = c === "arb" ? G.CAP_ARB : G.CAP_SOU, prev = 0;
    for (var i = 0; i < scale.length; i++) {
      var hi = scale[i][0], base = scale[i][1], pct = scale[i][2] / 1000, from = scale[i][3];
      if (p <= hi || hi === Infinity) {
        var line;
        if (!pct) line = "Цена иска не больше " + fmt0.format(hi).replace(/ /g, " ") + " ₽: " + fmt0.format(base).replace(/ /g, " ") + " ₽ (фиксированная сумма).";
        else line = fmt0.format(base).replace(/ /g, " ") + " ₽ + " + String(pct).replace(".", ",") + " % от суммы, превышающей " + fmt0.format(from).replace(/ /g, " ") + " ₽ (" + fmt.format(Math.max(p - from, 0)).replace(/ /g, " ") + " ₽).";
        return line + " Верхний предел пошлины - " + fmt0.format(cap).replace(/ /g, " ") + " ₽.";
      }
      prev = hi;
    }
    return "";
  }

  function render() {
    var k = G.KINDS[court.value][kind.value];
    $("priceRow").style.display = k.needsPrice ? "" : "none";
    $("partyRow").style.display = k.needsPrice ? "none" : "";
    var hint = "";
    var out = $("res");
    try {
      var inp = { court: court.value, kind: kind.value, party: party.value, priceRub: parsePrice(price.value) };
      if (k.needsPrice && isNaN(inp.priceRub)) throw new Error("Введите цену иска числом, например 1 500 000 или 250000,50");
      var r = G.compute(inp);
      var why = k.needsPrice ? steps(court.value, inp.priceRub) : "Фиксированная сумма для " + (party.value === "o" ? "организации" : "физического лица") + ".";
      out.innerHTML = '<div class="hint">Госпошлина</div><div class="sum">' + rub(r.kop) + '</div>' +
        '<div class="calc-steps"><b>Расчёт.</b> ' + why + (r.note ? " " + r.note : "") + '</div>' +
        '<p class="hint">Основание: <b>' + r.ref + ' НК РФ</b>. ' + k.label + '.</p>' +
        (resetNote ? '<p class="hint tiny">' + resetNote + '</p>' : "");
    } catch (e) {
      out.innerHTML = '<p class="err">' + e.message + '</p>';
    }
  }

  court.addEventListener("change", function () { resetNote = ""; fillKinds(); render(); });
  [kind, party].forEach(function (el) { el.addEventListener("change", function () { resetNote = ""; render(); }); });
  price.addEventListener("input", render);
  fillKinds(); render();
})();
