/* Shared race model for the home-page quick race and the full race page.
   A start duel, built on 86 of Nikola's cleaned, recorded starts (laptop, Nov 2026):
   - Both swimmers swim exactly the same 24.31 s (24.59 PB minus Nikola's mean reaction),
     so the start decides the race: total time = reaction + 24.31.
   - Nikola's ghost reacts with one of his real starts, drawn at random from a pool.
     The first race uses his fastest 20% (18 starts). Every race the visitor loses, the pool
     grows by a factor of 1.5 (20% -> 30% -> 45% -> 68% -> 100%), so from the fifth race on all
     86 starts are in play. A win resets it to the fastest 20%.
   - The visitor's reaction is measured live. A dive by touch gets a 0.05 s head start:
     smartphone users responded about 52 ms slower than a comparable keyboard group in
     Pronk, Hirst, Wiers & Murre (2023), Behavior Research Methods 55, 1641-1652.
   Win chance = share of the current pool that is slower than the visitor's start (no simulation needed). */
window.RaceModel = (function () {
  "use strict";
  var REACTIONS_MS = [257,305,256,404,294,265,257,259,246,316,269,244,150,272,355,293,285,252,276,261,264,255,214,266,279,211,262,395,275,344,264,249,259,327,278,288,361,289,306,308,273,376,295,269,273,314,266,264,258,294,244,313,275,299,269,283,262,296,228,242,263,254,331,259,286,285,265,278,299,257,273,186,281,327,288,332,370,257,271,255,308,256,249,289,257,296];
  var SORTED = REACTIONS_MS.slice().sort(function (a, b) { return a - b; });
  var MEAN_R = 0.2799, PB = 24.59, SWIM = PB - MEAN_R;
  var POOL = [18, 26, 39, 59, 86];  // fastest 20%, 30%, 45%, 68%, 100% of the 86 starts
  var POOL_PCT = [20, 30, 45, 68, 100];
  var HEAD_START = 0.05;            // seconds, for dives by touch

  function level(streak) { return Math.min(Math.max(streak || 0, 0), POOL.length - 1); }
  function poolSize(streak) { return POOL[level(streak)]; }

  return {
    NIKOLA_PB: PB,
    SWIM: SWIM,
    SPEED: 10.5, // after the visitor dives, simulated seconds run this much faster than real time
    REACTION_COUNT: REACTIONS_MS.length,
    reactionsMs: REACTIONS_MS.slice(),
    sortedMs: SORTED.slice(),
    MEAN_REACTION: MEAN_R,
    HEAD_START: HEAD_START,
    poolSize: poolSize,
    poolPct: function (streak) { return POOL_PCT[level(streak)]; },
    poolMaxMs: function (streak) { return SORTED[poolSize(streak) - 1]; },
    ghost: function (streak) {
      var n = poolSize(streak);
      return { react: SORTED[Math.floor(Math.random() * n)] / 1000, swim: SWIM, lead: 0 };
    },
    visitor: function () { return { react: null, swim: SWIM, lead: 0 }; },
    // chance that a start of reactS seconds (after any head start) beats the ghost at this streak
    winChance: function (reactS, streak) {
      var n = poolSize(streak), c = 0;
      for (var i = 0; i < n; i++) if (reactS < SORTED[i] / 1000) c++;
      return c / n;
    },
    // what the line under the race says about the next race
    nextPoolText: function (streak, won) {
      if (won) return "You beat me, so next race I'm back to my fastest 20% of starts.";
      var p = POOL_PCT[level(streak)];
      return p >= 100 ? "Next race I draw from all 86 of my starts." : "Next race I draw from my fastest " + p + "% of starts.";
    }
  };
})();
