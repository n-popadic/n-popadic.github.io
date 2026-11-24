/* Scroll swimmer: the lane under the header is a reading progress bar.
   The swimmer strokes while you scroll, turns when you scroll back up and leaves bubbles. */
(function () {
  var track = document.getElementById("track"), swMove = document.getElementById("swMove"),
      swFlip = document.getElementById("swFlip"), dist = document.getElementById("dist");
  if (!track || !swMove) return;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var lastTop = window.scrollY, stopTimer = 0, lastBubble = 0;
  function place() {
    var max = document.documentElement.scrollHeight - window.innerHeight,
        p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0,
        x = p * (track.clientWidth - 46);
    swMove.style.transform = "translateX(" + x.toFixed(1) + "px)";
    dist.textContent = Math.round(p * 50) + " / 50 m";
    return x;
  }
  window.addEventListener("scroll", function () {
    var top = window.scrollY, delta = top - lastTop; lastTop = top;
    if (delta > 0) swFlip.classList.remove("left"); else if (delta < 0) swFlip.classList.add("left");
    var x = place();
    swFlip.classList.add("swimming");
    clearTimeout(stopTimer); stopTimer = setTimeout(function () { swFlip.classList.remove("swimming"); }, 160);
    var now = performance.now();
    if (!reduce && delta !== 0 && now - lastBubble > 70) {
      lastBubble = now;
      var b = document.createElement("span"); b.className = "bubble";
      b.style.left = (delta > 0 ? x - 2 : x + 46) + "px";
      b.style.setProperty("--dx", (delta > 0 ? -1 : 1) * (6 + Math.random() * 10) + "px");
      b.style.setProperty("--dy", ((Math.random() - .5) * 16) + "px");
      track.appendChild(b);
      setTimeout(function () { b.remove(); }, 800);
    }
  }, { passive: true });
  window.addEventListener("resize", place);
  place();
})();
