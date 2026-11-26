/* Home, laptops and monitors: scale the first screen (intro, cards, photo, lane rope, numbers)
   so it fills the visible height, and the race and Latest band starts right below it.
   Same layout, just a bit smaller or bigger (80% to 130%); phones are left alone. */
(function () {
  "use strict";
  var hero = document.querySelector(".hero"), strip = document.querySelector(".strip"), header = document.querySelector("header.site");
  if (!hero || !strip || !header || !("zoom" in document.documentElement.style) || !window.matchMedia) return;
  var wide = window.matchMedia("(min-width: 901px)");

  function fit() {
    hero.style.zoom = strip.style.zoom = "";
    if (!wide.matches) return;
    var avail = window.innerHeight - header.offsetHeight;
    var natural = hero.offsetHeight + strip.offsetHeight;
    var box = hero.querySelector(".container").getBoundingClientRect().width;
    var byWidth = (document.documentElement.clientWidth - 32) / box; // never wider than the window
    var s = Math.max(0.8, Math.min(1.3, avail / natural, byWidth));
    if (Math.abs(s - 1) < 0.02) return;
    hero.style.zoom = strip.style.zoom = s.toFixed(3);
  }

  fit();
  window.addEventListener("resize", fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
})();
