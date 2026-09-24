# simonhildell.xyz — a playground

An explorable cyberpunk city built with three.js. You walk around, find nine anomalies built from my projects, and finish by finding my workstation. The curated portfolio lives at [simonhildell.com](https://www.simonhildell.com).

It's a static site: no build step and no dependencies to install. three.js is vendored in `vendor/`.

## Run locally

```
python3 -m http.server 8000
# open http://localhost:8000
```

(ES modules don't load from `file://`, so you need a local server.)

## Where things live

| File | What it holds |
| --- | --- |
| `js/tracks.js` | The jukebox playlist as Spotify track IDs. Add, remove or reorder lines here. |
| `js/anomalies.js` | `ANOMALY_DATA` holds each card's title, text, image and colour. `BUILDERS` holds the 3D models. |
| `js/studio.js` | The workstation: the desk, 27" screen, laptop on its stand, and the typed text and link. |
| `js/city.js` | The procedural city: blocks, signs, billboards, spinners, rain, the Sea Wall. |
| `js/main.js` | Wires it all together: loop, district atmosphere, desk camera, UI. |
| `img/` | Card images copied from simonhildell.com, plus the social preview `og.jpg`. |
| `CNAME` | The custom domain for GitHub Pages. |

Progress (found anomalies) is saved in the visitor's browser. The **?** menu has a reset button.

## Deploy (GitHub Pages)

1. Push this folder to the repo's `main` branch.
2. In the repo, go to **Settings → Pages**. Set Source to **Deploy from a branch**, then pick `main` and `/ (root)`.
3. Under **Custom domain**, enter `www.simonhildell.xyz` and save. Tick **Enforce HTTPS** once the certificate is ready.
4. At Namecheap, open **Domain List → simonhildell.xyz → Advanced DNS** and add these records:
   - `CNAME` · host `www` · value `<your-github-username>.github.io.`
   - `A` · host `@` · `185.199.108.153`
   - `A` · host `@` · `185.199.109.153`
   - `A` · host `@` · `185.199.110.153`
   - `A` · host `@` · `185.199.111.153`

   Also remove Namecheap's default parking records (the `CNAME www → parkingpage…` and `URL Redirect` ones).

DNS changes can take anything from a few minutes to a few hours to spread.
