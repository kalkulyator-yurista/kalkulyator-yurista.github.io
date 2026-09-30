(function () {
  "use strict";
  var D = window.Drobi;
  var $ = function (id) { return document.getElementById(id); };
  var expr = $("expr"), res = $("res");

  function row(k, v) { return '<div class="kv"><span>' + k + '</span><b>' + v + '</b></div>'; }
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

  function render() {
    var src = expr.value;
    if (!src.trim()) { res.innerHTML = '<p class="hint">Введите выражение, например 1/2 + 1/3.</p>'; return; }
    try {
      var f = D.evaluate(src), d = D.describe(f);
      var html = '<div class="hint">Результат</div><div class="big" id="bigval">' + esc(d.fraction) + '</div>';
      if (d.mixed !== d.fraction) html += row("Смешанное число", esc(d.mixed));
      html += row("Десятичная дробь", esc(d.decimal)) + row("В процентах", esc(d.percent));
      var n = f.n, dd = f.d;
      if (n === dd) html += '<p class="ok" style="margin:12px 0 0">Сумма равна целому (1): доли сходятся.</p>';
      else if (n > 0n && n < dd) html += row("До целого не хватает", esc(D.describe(D.sub(D.frac(1n, 1n), f)).fraction));
      else if (n > dd) html += '<p class="hint" style="margin:12px 0 0">Если это доли, то их сумма больше единицы - проверьте исходные данные.</p>';
      html += '<div class="actions" style="margin-top:14px"><button type="button" id="cp">Скопировать результат</button></div>';
      res.innerHTML = html;
      $("cp").addEventListener("click", function () {
        var t = d.fraction + (d.mixed !== d.fraction ? " (" + d.mixed + ")" : "");
        var done = function () { $("cp").textContent = "Скопировано"; setTimeout(function () { var b = $("cp"); if (b) b.textContent = "Скопировать результат"; }, 1500); };
        if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () {});
      });
    } catch (e) {
      res.innerHTML = '<p class="err">' + esc(e.message) + '</p><p class="hint">Пример: 1/2 + 1/3 - 1/6</p>';
    }
  }

  expr.addEventListener("input", render);
  Array.prototype.forEach.call(document.querySelectorAll("[data-ins]"), function (b) {
    b.addEventListener("click", function () {
      var s = expr.selectionStart == null ? expr.value.length : expr.selectionStart, e = expr.selectionEnd == null ? s : expr.selectionEnd;
      expr.value = expr.value.slice(0, s) + b.getAttribute("data-ins") + expr.value.slice(e);
      var pos = s + b.getAttribute("data-ins").length; expr.focus(); expr.setSelectionRange(pos, pos); render();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-ex]"), function (b) {
    b.addEventListener("click", function () { expr.value = b.getAttribute("data-ex"); expr.focus(); render(); });
  });
  $("clr").addEventListener("click", function () { expr.value = ""; expr.focus(); render(); });
  render();
})();
