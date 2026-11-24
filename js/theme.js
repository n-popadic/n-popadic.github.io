/* Theme switch: Auto (follows the system), Light, Night.
   The saved choice is applied early by a tiny inline script in <head>
   so the page never flashes the wrong colours. */
(function () {
  "use strict";
  var root = document.documentElement;
  var KEY = "np-theme";

  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function read() { try { return localStorage.getItem(KEY) || "auto"; } catch (e) { return "auto"; } }

  function apply(mode) {
    if (mode === "light" || mode === "dark") root.setAttribute("data-theme", mode);
    else root.removeAttribute("data-theme");
    document.querySelectorAll(".theme button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.set === mode));
    });
    document.dispatchEvent(new CustomEvent("themechange"));
  }

  document.querySelectorAll(".theme button").forEach(function (b) {
    b.addEventListener("click", function () { save(b.dataset.set); apply(b.dataset.set); });
  });

  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var notify = function () { document.dispatchEvent(new CustomEvent("themechange")); };
    if (mq.addEventListener) mq.addEventListener("change", notify); else if (mq.addListener) mq.addListener(notify);
  }

  apply(read());
})();
