/* Home, laptops and monitors: scale the page parts (header, intro + cards + photo, lane rope +
   numbers, race + Latest, footer) so the first screen ends right under the numbers.
   Each part is scaled on its own (not the whole document), so scrolling and links work as usual.
   Same layout, just a bit smaller or bigger (80% to 130%); phones are left alone. */
(function () {
  "use strict";
  var header = document.querySelector("header.site"), hero = document.querySelector(".hero"), strip = document.querySelector(".strip");
  if (!header || !hero || !strip || !("zoom" in document.documentElement.style) || !window.matchMedia) return;
  var parts = [header, hero, strip, document.querySelector(".duo"), document.querySelector("footer.site")].filter(Boolean);
  var wide = window.matchMedia("(min-width: 901px)");

  function fit() {
    parts.forEach(function (el) { el.style.zoom = ""; });
    if (!wide.matches) return;
    var natural = header.offsetHeight + hero.offsetHeight + strip.offsetHeight;
    var box = hero.querySelector(".container").getBoundingClientRect().width;
    var byWidth = (document.documentElement.clientWidth - 32) / box; // never wider than the window
    var s = Math.max(0.8, Math.min(1.3, window.innerHeight / natural, byWidth));
    if (Math.abs(s - 1) < 0.02) return;
    parts.forEach(function (el) { el.style.zoom = s.toFixed(3); });
  }

  fit();
  window.addEventListener("resize", fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
})();
