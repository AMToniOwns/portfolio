# Portfolio site (mendes.io)

A static site with no build step: `index.html`, `styles.css`, `js/` and `assets/`.

## Preview locally

```sh
cd site && python3 -m http.server 8080   # then open http://localhost:8080
```

## What's in it

| Section | Source |
|---|---|
| DuelLab screenshots (`assets/shots/*.webp`) | Captured from a local run of [DuelLab](https://github.com/AMToniOwns/DuelLab) on SQLite with the offline card fixture and a demo deck, in light and dark mode |
| Opening hand lab (`js/hand-lab.js`) | A port of DuelLab's xoshiro256** generator (SplitMix64 seeding, Lemire bounded integers) and partial Fisher–Yates draw. Checked against the C# class: seed 20261117 gives the same draws. Exact figures use the hypergeometric distribution. |
| Work apps (`js/app-switcher.js`) | Simplified journeys of three client apps, written from scratch with made-up data. No client names, branding or endpoints. |
| Game player (`js/game-player.js`) | Four instant-win mechanics rebuilt from scratch with new names, art, prizes and chances. Play money only; prize tables return about 60 to 75% of stakes. |

## Before going live

- [ ] Check the LinkedIn link in `index.html` goes to your profile (`linkedin.com/in/mendes-antonio`, from the CV).
- [ ] If "Open to opportunities" isn't true, edit or remove it in the hero.
- [ ] Check the "Role" line for the retail companion app in `index.html` (`data-info="retail"`).

## Deploy to your domain

**GitHub Pages:** put the contents of `site/` at the root of a new repository (for example `AMToniOwns/mendes.io`). Add a file named `CNAME` containing `mendes.io` (or `www.mendes.io`). Then turn on Settings → Pages → Deploy from branch → `main` / root. At your registrar, add the GitHub Pages `A` records for the apex domain (or a `CNAME` record pointing `www` to `amtoniowns.github.io`), and tick "Enforce HTTPS".

**Netlify, Vercel or Cloudflare Pages:** set the publish directory to `site/`, leave the build command empty, and add the domain in the dashboard.
