# Cask & Barrel – website concept demo

An **unofficial concept design** for a Yarm pub. It is **not affiliated with, approved by, or operated by Cask & Barrel**. The enquiry form sends nothing. The page is `noindex` so it won't compete with the pub in search.

Live: https://tedotedo.github.io/cask-and-barrel-demo/ · Pitch kit: `/pitch.html` and `/pitch-onepager.html`

Static HTML/CSS/vanilla JS on GitHub Pages: no framework, no npm, no build step needed to deploy.

## Where things live

| File | What it is |
|---|---|
| `content.json` | **All pub-specific content**: address, hours, beers, menu, events, copy, media paths. |
| `tools/build.js` | Dev-time script: renders `content.json` into the committed `index.html` (so it works with JavaScript off). |
| `js/render.js` | Shared rendering code (used by the build script and the browser). |
| `js/app.js` | Browser behaviour: menu, beer-board sheet fetch, form, map, videos. `SHEET_CSV_URL` is at the top. |
| `css/styles.css` | Styles. Fraunces and Inter are self-hosted in `fonts/` (Latin subsets, SIL OFL). |
| `tests/test.js`, `tests/browser.js` | Self-tests (see below). |

**Rule: unknown = `null`, and the page hides it quietly.** No "£0.00", "TBC" or "Placeholder" is ever rendered. Never invent facts: leave a value `null` until the pub confirms it.

## Updating content after a visit

1. Edit `content.json` (it has format notes next to each field).
2. Run `node tools/build.js` (Node 16+), then commit `index.html` along with `content.json`.
   The browser also re-reads `content.json` for hours, events, the beer board, contact and menu, so those update even before a rebuild. Media and layout changes need the build.

Common edits:
- **Phone:** set `site.phone` (e.g. `"01642 000000"`). The Call button, contact line and JSON-LD `telephone` then appear.
- **Sunday hours:** set `hours.sun` to `{ "open": "12:00", "close": "18:00" }` (or `{ "closed": true }`). The row and open-now status appear.
- **Email for the banner:** `banner.email` is `[YOUR EMAIL]`; replace it.
- **Social links:** `site.social.instagram` / `facebook`. Icons show only when set.
- **Events:** add to `events`: `{ "title": "Quiz night", "date": "2026-10-22", "time": "20:00", "endTime": "22:00", "description": "…" }`. Past events hide automatically; the next one shows in the hero; each gets an "Add to calendar" (.ics) button. Only add confirmed events.
- **Reviews / badges (CAMRA, Cask Marque):** add to `reviews` / `badges`. The section is hidden while both are empty. Only real, permitted quotes.
- **Beers:** see below.

## The "On the bar now" beer board and the Google Sheet

The board shows what's pouring. Staff can edit it from a phone through a Google Sheet:

1. Create a sheet whose first row is exactly:
   `section,name,brewery,style,abv,price,on_now,notes`
2. Rows:
   - `cask` rows are beers. `style` is shown as a chip (Pale, Bitter, Stout, Porter, IPA or anything else). `abv` and `price` are plain numbers (`4.2`, `4.20`). `on_now` is `yes`/`no` (blank counts as yes). Beers set to `no` show greyed as "Off".
   - `coming` rows are the "Coming soon" list (name and optional brewery).
   - One `last_updated` row with the date (e.g. `2026-10-14`) in the **name** column drives "Board updated: Wed 14 Oct".
3. **File > Share > Publish to web**, pick the tab, choose **Comma-separated values (.csv)**, publish, and copy the link.
4. Paste it into `SHEET_CSV_URL` at the top of `js/app.js`.

If `SHEET_CSV_URL` is `null` (as now), the fetch fails, or the sheet has no usable rows, the board falls back to `board` in `content.json`. The heading ("6 hand pulls · 5 on now") is derived from the data; `board.handPulls` is the number of pumps. With no beers the board shows "ask at the bar".

Pitching: add `?example=1` to the URL to show clearly-labelled **example beers** (hidden otherwise), and `?pitch=1` to show the line "Change a beer from your phone in 30 seconds – no web designer needed."

## Swapping in real photos and video

Paths live in `content.json` (`hero.image`, `media.about.image`, `walk.photos`, `media.clips`, `map`). Images are served as AVIF/WebP/JPEG at several widths named `<base>-<width>.<ext>`; list the widths in `widths`.

Make the files from one original (needs Python and Pillow):

```bash
python3 tools/make_images.py ~/Pictures/pub-front.jpg images/pub-front 480 800 1280 1600
```

then point `hero.image.base` at `images/pub-front`, set `widths`, `width`, `height` and the `alt` text, and run `node tools/build.js`.

Video: keep each clip at or under 500 KB, no audio, with an `.mp4` (H.264) and `.webm` plus a `.webp` poster, all sharing one base name:

```bash
ffmpeg -i bar.mov -an -vf scale=854:-2 -c:v libx264 -crf 34 -movflags +faststart media/bar.mp4
ffmpeg -i bar.mov -an -vf scale=854:-2 -c:v libvpx-vp9 -b:v 230k media/bar.webm
ffmpeg -i bar.mov -frames:v 1 -ss 2 media/bar.png   # then convert to media/bar.webp
```

Set `"ai": false` on a real clip to drop the "AI-generated" caption. Remove the Wikimedia credits from `photoCredits.items` only when those photos are no longer used.

## Licences and credits

- Photos: Wikimedia Commons (CC0 / CC BY-SA). Authors and licences are in the footer "Photo credits".
- The two video clips are AI-generated illustrative footage; the person shown is invented.
- Map image © OpenStreetMap contributors (9 or so tiles fetched once at build time, per the OSM tile usage policy). The interactive map loads from openstreetmap.org only after the visitor presses the button.
- Fonts: Fraunces and Inter, SIL Open Font License 1.1.
- The C&B roundel is a concept monogram, not the pub's logo. Don't copy logos or photos from the pub's own social media without permission.

## Tests

```bash
node tools/build.js && node tests/test.js          # no dependencies: open-now for each weekday (mocked dates), CSV, events, static checks
python3 -m http.server 8123 &                      # then, with puppeteer-core and Chrome:
NODE_PATH=/path/to/node_modules node tests/browser.js
```

## Form

The enquiry form validates and shows a success message but **sends nothing** (`FORM_ENDPOINT` is `null` in `js/app.js`). See the wiring comment above the form in `index.html` (Formspree-style endpoint) before going live.
