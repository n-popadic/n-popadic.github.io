# Nikola Popadić — personal site

Plain HTML, CSS and JavaScript. No build step: open `index.html` in a browser to see it,
and GitHub Pages serves the folder as it is.

## Structure

```
index.html          home: intro, quick race, quick facts, section cards, latest news
projects.html       research projects, thesis and models built from scratch
experience.html     work, education, skills, awards
about.html          the story, from the pool to the pipeline
race.html           full race: name, cap colour, local leaderboard, method and charts
css/style.css       all styles; colour tokens for light and "Pool at night"
js/theme.js         Auto / Light / Night switch
js/swimmer.js       scroll swimmer on the inner pages
js/race-model.js    shared race model (used by both race scripts)
js/race-quick.js    "Can you beat my 24.59?" on the home page
js/race-full.js     game logic and charts for race.html
img/                photos (cropped, compressed, metadata removed) and favicon
cv/                 CV for the download link
_drafts/            private prototypes and data, not published (see .gitignore)
```

## The race model

A start duel built on 86 of Nikola's cleaned, recorded starts. After the dive both swimmers swim
at exactly his pace, so whoever reacts faster wins. His ghost draws its start at random from his
fastest 20% of starts; every race the visitor loses, the pool grows by a factor of 1.5 until all
86 are in play, and a win resets it. A dive by touch gets a 0.05 s head start, since people on
phones react about 52 ms slower than on a keyboard (Pronk, Hirst, Wiers & Murre, 2023,
Behavior Research Methods 55, 1641–1652). Win chances are exact: the share of the current pool
that is slower than the visitor's start.
