#!/usr/bin/env node
/*
 * Dev-time build: renders content.json into index.html (static HTML, so the page works with JS off).
 *   node tools/build.js
 * Commit the generated index.html. The browser also re-reads content.json (see js/app.js) for the dynamic bits.
 * No dependencies, only Node 16+.
 */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const c = JSON.parse(fs.readFileSync(path.join(root, 'content.json'), 'utf8'));
const CB = require(path.join(root, 'js', 'render.js'));
const e = CB.esc;
const R = CB.regions(c, new Date(), false);
const s = c.site, b = c.banner;
const anyReviews = (c.reviews && c.reviews.length) || (c.badges && c.badges.length);
const mapPos = s.geo;
const bbox = [mapPos.lon - 0.004, mapPos.lat - 0.0025, mapPos.lon + 0.004, mapPos.lat + 0.0025].join('%2C');
const typeOptions = c.privateHire.types.map(t => `<option value="${e(t)}">${e(t)}</option>`).join('');
const navItems = [['about', 'About'], ['menu', 'Drinks'], ['hours', 'Hours'], ['whats-on', 'What’s on'], ['private-hire', 'Private hire'], ['find-us', 'Find us']];

const page = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(s.name)}, Yarm – real ale pub (concept design)</title>
<meta name="description" content="${e(s.description)}">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#14301f">
<link rel="canonical" href="${e(s.url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${e(s.name)} (concept design)">
<meta property="og:title" content="${e(s.name)}, Yarm – concept website design">
<meta property="og:description" content="A concept website for a Yarm real ale pub: live beer board, Christmas bookings, open-now status and map. Not the pub's official site.">
<meta property="og:url" content="${e(s.url)}">
<meta property="og:image" content="${e(s.url)}images/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Cask &amp; Barrel, Yarm – concept website design with a C&amp;B cask-end monogram">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="preload" href="fonts/fraunces-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" as="image" href="${c.hero.image.base}-800.avif" type="image/avif" imagesrcset="${c.hero.image.widths.map(w => `${c.hero.image.base}-${w}.avif ${w}w`).join(', ')}" imagesizes="100vw" fetchpriority="high">
<link rel="stylesheet" href="css/styles.css">
<script type="application/ld+json">
${CB.buildJsonLd(c)}
</script>
</head>
<body>
<script>document.documentElement.classList.add("js")</script>
<a class="skip" href="#main">Skip to content</a>
<div class="banner" id="concept-banner"><div class="wrap"><span>${e(b.text)}</span> <a href="mailto:${e(b.email)}">${e(b.linkText)}</a></div><button class="banner-close" type="button" aria-label="Dismiss banner">&times;</button></div>
<div class="pitch-note" id="pitch-note" hidden>${e(b.pitchLine)}</div>
<header class="nav" id="top-nav">
<div class="wrap">
<a class="logo" href="#top"><img src="images/logo-roundel.svg" width="40" height="40" alt="C&amp;B monogram (concept)"><span>${e(s.name)}</span></a>
<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Menu"><span></span></button>
<nav id="site-nav" aria-label="Main"><ul>
${navItems.map(n => `<li><a href="#${n[0]}">${n[1]}</a></li>`).join('')}
</ul></nav>
</div>
</header>
<main id="main">
<div class="hero" id="top">
<div class="hero-bg">${CB.renderPicture(Object.assign({}, c.hero.image), { eager: true, sizes: '100vw' })}</div>
<div class="wrap">
<p class="eyebrow">${e(c.hero.eyebrow)}</p>
<h1>${c.hero.headline}</h1>
<p class="lead">${e(c.hero.lead)}</p>
<div class="btns"><a class="btn" href="#menu">${e(c.hero.primaryCta)}</a><a class="btn ghost" href="#private-hire">${e(c.hero.secondaryCta)}</a></div>
<div class="hero-meta"><span data-region="status">${R.status}</span><span class="next" data-region="nextEvent">${e(R.nextEvent)}</span></div>
</div>
</div>

${c.seasonal.enabled ? `<aside class="ribbon" aria-label="Seasonal offer"><div class="wrap"><div><h2>${e(c.seasonal.title)}</h2><p>${e(c.seasonal.text)}</p></div><a class="btn" href="#private-hire" data-preset="${e(c.seasonal.presetType)}">${e(c.seasonal.cta)}</a></div></aside>` : ''}

<section id="about" class="paper"><div class="wrap about">
<div>
<p class="kicker">${e(c.about.kicker)}</p>
<h2>${e(c.about.heading)}</h2>
${c.about.paragraphs.map(p => `<p>${e(p)}</p>`).join('\n')}
<ul class="facts">${c.about.facts.map(f => `<li><b>${e(f.title)}</b>${e(f.text)}</li>`).join('')}</ul>
</div>
<div>
${CB.renderClip(c.media.clips.barmaid)}
${CB.renderPhoto(c.media.about.image, '(min-width:820px) 480px, 100vw')}
</div>
</div></section>

<section id="menu" class="dark"><div class="wrap">
<p class="kicker">${e(c.menu.kicker)}</p>
<h2>On the bar</h2>
<div class="board" id="on-the-bar" data-region="board">${R.board}</div>
<div class="menu-grid">
<div class="contents" data-region="menuGroups">${R.menuGroups}</div>
${CB.renderClip(c.media.clips.whiskey)}
</div>
</div></section>

<section id="reviews" class="paper"${anyReviews ? '' : ' hidden'}><div class="wrap">
<p class="kicker">What people say</p>
<h2>Kind words</h2>
<div data-region="reviews">${R.reviews}</div>
<div data-region="badges">${R.badges}</div>
</div></section>

<section id="hours" class="cream-bg"><div class="wrap two">
<div>
<p class="kicker">Opening hours</p>
<h2>When to find us</h2>
<p class="hours-status" data-region="status">${R.status}</p>
</div>
<div data-region="hours">${R.hours}</div>
</div></section>

<section id="whats-on" class="paper"><div class="wrap">
<p class="kicker">What’s on</p>
<h2>Events &amp; regulars</h2>
<div data-region="events">${R.events}</div>
</div></section>

<section id="private-hire" class="cream-bg"><div class="wrap">
<p class="kicker">${e(c.privateHire.kicker)}</p>
<h2>${e(c.privateHire.heading)}</h2>
<p>${e(c.privateHire.intro)}</p>
<!--
  FORM WIRING (not connected on purpose): this demo form sends nothing. To go live, point the form at a
  Formspree-style endpoint, e.g. set FORM_ENDPOINT in js/app.js to "https://formspree.io/f/<id>" and
  POST the fields with fetch(..., {method:"POST", headers:{Accept:"application/json"}, body:new FormData(form)}),
  showing the success panel only when response.ok. Until then it only shows the success message locally.
-->
<form id="enquiry" novalidate>
<div class="row">
<div><label for="f-name">Your name <span class="req" aria-hidden="true">*</span></label><input id="f-name" name="name" autocomplete="name" required aria-describedby="f-name-err"><p class="err" id="f-name-err"></p></div>
<div><label for="f-email">Email <span class="req" aria-hidden="true">*</span></label><input id="f-email" name="email" type="email" autocomplete="email" required aria-describedby="f-email-err"><p class="err" id="f-email-err"></p></div>
</div>
<div class="row">
<div><label for="f-phone">Phone <span class="hint">(optional)</span></label><input id="f-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" aria-describedby="f-phone-err"><p class="err" id="f-phone-err"></p></div>
<div><label for="f-type">Type of event <span class="req" aria-hidden="true">*</span></label><select id="f-type" name="type" required aria-describedby="f-type-err">${typeOptions}</select><p class="err" id="f-type-err"></p></div>
</div>
<div class="row">
<div><label for="f-date">Preferred date <span class="req" aria-hidden="true">*</span></label><input id="f-date" name="date" type="date" required aria-describedby="f-date-err"><p class="err" id="f-date-err"></p></div>
<div><label for="f-guests">Number of guests <span class="req" aria-hidden="true">*</span></label><input id="f-guests" name="guests" type="number" min="1" max="500" inputmode="numeric" required aria-describedby="f-guests-err"><p class="err" id="f-guests-err"></p></div>
</div>
<div><label for="f-msg">Anything else?</label><textarea id="f-msg" name="message" rows="4"></textarea></div>
<div><button class="btn" type="submit">Send enquiry</button></div>
</form>
<div class="success" id="enquiry-success" role="status" tabindex="-1" hidden><h3></h3><p>We’ll be in touch about your <span id="s-type"></span> soon.</p><p class="demo-note">(demo – nothing was sent)</p></div>
</div></section>

<section id="find-us" class="dark"><div class="wrap">
<div class="find">
<div>
<p class="kicker">Find us</p>
<h2>On Yarm High Street</h2>
<div data-region="contact">${R.contact}</div>
</div>
<div>
<div class="mapbox" id="mapbox">
<picture><source type="image/webp" srcset="${c.map.staticImage}.webp"><img src="${c.map.staticImage}.jpg" width="${c.map.width}" height="${c.map.height}" loading="lazy" decoding="async" alt="Map of Yarm High Street with a pin at ${e(s.address.lines[2])}, ${e(s.address.postcode)}"></picture>
<svg class="pin" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 43C17 43 2 27 2 16a15 15 0 0 1 30 0c0 11-15 27-15 27z" fill="#b3261e" stroke="#fff" stroke-width="2"/><circle cx="17" cy="16" r="5.5" fill="#fff"/></svg>
<button class="btn map-load" type="button" id="map-load" data-src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&amp;layer=mapnik&amp;marker=${mapPos.lat}%2C${mapPos.lon}">Load interactive map</button>
</div>
<p class="map-attr">Map image © <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap contributors</a>. The interactive map loads from openstreetmap.org only when you press the button.</p>
</div>
</div>
<div class="walk">
<h3>${e(c.walk.heading)}</h3>
<p>${e(c.walk.text)}</p>
<div class="walk-photos">${c.walk.photos.map(p => CB.renderPhoto(p, '(min-width:700px) 520px, 100vw')).join('')}</div>
</div>
</div></section>
</main>
<footer><div class="wrap">
<a class="logo" href="#top"><img src="images/logo-roundel.svg" width="40" height="40" alt="C&amp;B monogram (concept)"><span>${e(s.name)}</span></a>
<span>${e(CB.addrOneLine(s))}</span>
<span data-region="social">${R.social}</span>
<span>${e(c.footer.responsible)}</span>
<details class="credits" id="photo-credits"><summary>Photo credits</summary><div data-region="credits">${R.credits}</div></details>
<p class="demo-by">${e(c.footer.concept)}</p>
</div></footer>
<div class="action-bar" role="group" aria-label="Quick actions">
${has(s.phone) ? `<a href="tel:${e(String(s.phone).replace(/[^+\d]/g, ''))}" id="ab-call">Call</a>` : ''}<a href="${e(s.directionsUrl)}" rel="noopener">Directions</a><a class="primary" href="#private-hire">Book</a>
</div>
<script src="js/render.js" defer></script>
<script src="js/app.js" defer></script>
</body>
</html>
`;
function has(v) { return v !== null && v !== undefined && v !== ''; }
fs.writeFileSync(path.join(root, 'index.html'), page);
console.log('index.html written (' + page.length + ' bytes)');
