#!/usr/bin/env node
/*
 * Browser checks (needs puppeteer-core + a Chrome binary):
 *   npm i puppeteer-core   (outside the repo is fine, set NODE_PATH)
 *   python3 -m http.server 8123 &   node tests/browser.js [baseUrl] [chromePath]
 */
const puppeteer = require('puppeteer-core'), assert = require('assert');
const base = process.argv[2] || 'http://localhost:8123/', chrome = process.argv[3] || '/usr/bin/google-chrome';
let n = 0, fail = 0;
async function t(name, fn) { try { await fn(); n++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + e.message); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: chrome, args: ['--no-sandbox'], headless: 'new' });
  async function open(w, url, opts = {}) {
    const p = await b.newPage(); await p.setViewport({ width: w, height: 800, isMobile: w < 500 });
    if (opts.reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    if (opts.js === false) await p.setJavaScriptEnabled(false);
    p.reqs = []; p.on('request', r => p.reqs.push(r.url()));
    if (opts.intercept) { await p.setRequestInterception(true); p.on('request', r => opts.intercept(r) || r.continue()); }
    await p.goto(url || base, { waitUntil: 'networkidle2' }); return p;
  }
  const visible = (p, sel) => p.$eval(sel, el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; }).catch(() => false);

  await t('375px: hamburger opens, all six links reachable, closes on link click and Escape', async () => {
    const p = await open(375);
    assert.ok(await visible(p, '.menu-toggle')); assert.ok(!(await visible(p, '#site-nav a')));
    assert.strictEqual(await p.$eval('.menu-toggle', e => e.getAttribute('aria-expanded')), 'false');
    await p.click('.menu-toggle'); assert.strictEqual(await p.$eval('.menu-toggle', e => e.getAttribute('aria-expanded')), 'true');
    const links = await p.$$eval('#site-nav a', as => as.map(a => { const r = a.getBoundingClientRect(); return [a.textContent, r.width > 0 && r.bottom <= innerHeight, a.getAttribute('href')]; }));
    assert.strictEqual(links.length, 6); links.forEach(l => assert.ok(l[1], 'not fully visible: ' + l[0]));
    assert.ok(links.some(l => l[0] === 'Private hire') && links.some(l => l[0] === 'Find us'));
    await p.keyboard.press('Escape'); assert.strictEqual(await p.$eval('.menu-toggle', e => e.getAttribute('aria-expanded')), 'false');
    await p.click('.menu-toggle'); await p.click('#site-nav a[href="#private-hire"]'); assert.strictEqual(await p.$eval('.menu-toggle', e => e.getAttribute('aria-expanded')), 'false');
    assert.ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'horizontal scroll');
    await p.close();
  });
  await t('mobile action bar: Directions + Book shown, Call hidden while phone null; hidden on desktop', async () => {
    const p = await open(375); const txt = await p.$$eval('.action-bar a', a => a.map(x => x.textContent));
    assert.deepStrictEqual(txt, ['Directions', 'Book']); assert.ok(await visible(p, '.action-bar')); await p.close();
    const d = await open(1280); assert.ok(!(await visible(d, '.action-bar'))); assert.ok(!(await visible(d, '.menu-toggle'))); await d.close();
  });
  await t('banner dismisses', async () => { const p = await open(1280); await p.click('.banner-close'); assert.ok(!(await visible(p, '#concept-banner'))); await p.close(); });
  await t('?pitch=1 shows pitch line; hidden otherwise', async () => {
    const p = await open(1280, base + '?pitch=1'); assert.ok((await p.$eval('#pitch-note', e => e.textContent)).includes('30 seconds')); assert.ok(await visible(p, '#pitch-note')); await p.close();
    const q = await open(1280); assert.ok(!(await visible(q, '#pitch-note'))); await q.close();
  });
  await t('no third-party requests before interaction except Google Fonts', async () => {
    const p = await open(1280); await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await sleep(800);
    const ext = [...new Set(p.reqs.filter(u => !u.startsWith(new URL(base).origin) && !u.startsWith('data:')).map(u => new URL(u).host))];
    ext.forEach(h => assert.ok(/^fonts\.(googleapis|gstatic)\.com$/.test(h), 'unexpected host ' + h)); assert.ok(!p.reqs.some(u => /openstreetmap/.test(u))); await p.close();
  });
  await t('map: click loads OSM iframe, only then', async () => {
    const p = await open(1280); assert.strictEqual((await p.$$('#mapbox iframe')).length, 0);
    await p.click('#map-load'); await sleep(500); assert.strictEqual((await p.$$('#mapbox iframe')).length, 1);
    assert.ok((await p.$eval('#mapbox iframe', f => f.src)).startsWith('https://www.openstreetmap.org/export/embed.html')); await p.close();
  });
  await t('?example=1: example beers labelled; default: empty state', async () => {
    const p = await open(1280, base + '?example=1'); const t1 = await p.$eval('#on-the-bar', e => e.textContent);
    assert.ok(t1.includes('Example beers') && t1.includes('6 hand pulls · 5 on now') && t1.includes('Board updated')); await p.close();
    const q = await open(1280); const t2 = await q.$eval('#on-the-bar', e => e.textContent); assert.ok(t2.includes('ask at the bar') && !t2.includes('Example')); await q.close();
  });
  await t('Sheet CSV is fetched and rendered; failure falls back to content.json', async () => {
    const csv = 'section,name,brewery,style,abv,price,on_now,notes\ncask,Sheet Pale,Sheet Brewery,Pale,4.0,4.00,yes,\ncask,Sheet Stout,Sheet Brewery,Stout,4.5,4.50,yes,\ncoming,Next One,Sheet Brewery,,,,,\nlast_updated,2026-10-14,,,,,,\n';
    const wire = status => r => {
      const u = r.url();
      if (u.endsWith('js/app.js')) { fetch(u).then(x => x.text()).then(src => r.respond({ status: 200, contentType: 'application/javascript', body: src.replace('var SHEET_CSV_URL = null;', 'var SHEET_CSV_URL = "https://sheet.test/pub.csv";') })); return true; }
      if (u === 'https://sheet.test/pub.csv') { status === 200 ? r.respond({ status: 200, contentType: 'text/csv', headers: { 'access-control-allow-origin': '*' }, body: csv }) : r.respond({ status: 500, body: 'x', headers: { 'access-control-allow-origin': '*' } }); return true; }
    };
    global.fetch = global.fetch || require('node:http').get; // node >= 18 has fetch
    const p = await open(1280, base, { intercept: wire(200) }); await sleep(600);
    const txt = await p.$eval('#on-the-bar', e => e.textContent); assert.ok(txt.includes('Sheet Pale') && txt.includes('2 on now') && txt.includes('Coming soon') && txt.includes('Board updated: Wed 14 Oct'), txt); await p.close();
    const q = await open(1280, base, { intercept: wire(500) }); await sleep(600);
    const t2 = await q.$eval('#on-the-bar', e => e.textContent); assert.ok(t2.includes('ask at the bar') && !t2.includes('Sheet Pale')); await q.close();
  });
  await t('form: validation errors with aria-describedby, then success state sends nothing', async () => {
    const p = await open(1280); let posted = false; p.on('request', r => { if (r.method() === 'POST') posted = true; });
    await p.click('#enquiry button[type=submit]');
    const errs = await p.$$eval('.err', e => e.map(x => x.textContent).filter(Boolean)); assert.ok(errs.length >= 4, errs.join('|'));
    assert.strictEqual(await p.$eval('#f-name', e => e.getAttribute('aria-invalid')), 'true'); assert.ok((await p.$eval('#f-name', e => e.getAttribute('aria-describedby'))) === 'f-name-err');
    await p.type('#f-name', 'Sam Smith'); await p.type('#f-email', 'sam@example.com'); await p.select('#f-type', 'Christmas party'); await p.type('#f-guests', '20');
    await p.$eval('#f-date', e => { e.value = '2099-12-18'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.click('#enquiry button[type=submit]'); await sleep(200);
    const msg = await p.$eval('#enquiry-success', e => e.textContent); assert.ok(msg.includes('Thanks Sam – we’ll reply within 24 hours.') && msg.includes('(demo'), msg); assert.ok(!posted); await p.close();
  });
  await t('ribbon presets Christmas party', async () => { const p = await open(1280); await p.click('.ribbon .btn'); assert.strictEqual(await p.$eval('#f-type', e => e.value), 'Christmas party'); await p.close(); });
  await t('videos: lazy (no download before scroll), pause/play buttons work', async () => {
    const p = await open(1280); assert.ok(!p.reqs.some(u => /\.(mp4|webm)/.test(u)), 'video downloaded before scroll');
    assert.strictEqual((await p.$$('.vbtn')).length, 2); await p.$eval('.clip video', v => v.scrollIntoView({ block: 'center' })); await sleep(1500);
    assert.ok(p.reqs.some(u => /\.(mp4|webm)/.test(u)), 'video not loaded after scroll');
    const btn = (await p.$$('.vbtn'))[0]; const playing = await p.$eval('.clip video', v => !v.paused);
    await btn.click(); await sleep(200); assert.strictEqual(await p.$eval('.clip video', v => v.paused), playing ? true : false); await p.close();
  });
  await t('reduced motion: videos do not autoplay, hero animation off', async () => {
    const p = await open(1280, base, { reduced: true }); await p.$eval('.clip video', v => v.scrollIntoView({ block: 'center' })); await sleep(1200);
    assert.ok(await p.$eval('.clip video', v => v.paused)); assert.ok(!p.reqs.some(u => /\.(mp4|webm)/.test(u)));
    assert.strictEqual(await p.$eval('.hero-bg', e => getComputedStyle(e).animationName), 'none'); await p.close();
  });
  await t('JavaScript disabled: hours, address, email, board empty-state, form present', async () => {
    const p = await open(1280, base, { js: false }); const txt = await p.evaluate(() => document.body.innerText);
    ['Wednesday', '12pm – 10pm', '137 High Street', 'TS15 9AY', 'contact@caskandbarrelyarm.uk', 'ask at the bar'].forEach(s => assert.ok(txt.includes(s), s));
    assert.ok(await visible(p, '#enquiry'));
    assert.ok(await visible(p, '.clip video'), 'video has native controls without JS'); assert.ok(await p.$eval('.clip video', v => v.hasAttribute('controls'))); await p.close();
  });
  await t('hours: today row highlighted by JS', async () => { const p = await open(1280); const n = await p.$$eval('.hours-table tr.today', r => r.length); const d = new Date().toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Europe/London' }); assert.ok(n <= 1 && (d === 'Sun' ? n === 0 : n === 1)); await p.close(); });
  await t('range lightbox: opens from row, modal, caption, focus trap, Esc, close button, backdrop, focus returns', async () => {
    const p = await open(390);
    await p.evaluate(() => document.querySelector('#menu').scrollIntoView());
    assert.ok(await p.$('.range-btn'), 'rows upgraded to buttons');
    await p.focus('li[data-range="islay"] .range-btn'); await p.keyboard.press('Enter'); await new Promise(r => setTimeout(r, 600));
    assert.ok(await p.$eval('dialog.range-dlg', d => d.open)); assert.strictEqual(await p.$eval('dialog.range-dlg', d => d.getAttribute('aria-modal')), 'true');
    const caps = await p.$$eval('.range-fig figcaption', e => e.map(x => x.textContent)); assert.ok(caps[0].includes('AI-generated illustration of a back bar, not the pub’s actual stock')); assert.ok(caps[1].includes('AI-generated illustration, not the pub’s actual stock')); assert.strictEqual(await p.$$eval('.range-fig img', e => e.length), 2); assert.ok((await p.$$eval('.range-fig img', e => e[1].src)).includes('glass-islay'));
    assert.ok((await p.$eval('.range-fig img', e => e.src)).includes('range-islay')); assert.ok((await p.$eval('.range-fig img', e => e.alt)).length > 10);
    for (let i = 0; i < 4; i++) { await p.keyboard.press('Tab'); assert.ok(await p.evaluate(() => !!document.activeElement.closest('dialog.range-dlg')), 'focus trapped'); }
    await p.keyboard.press('Escape'); assert.ok(!(await p.$eval('dialog.range-dlg', d => d.open)));
    assert.ok(await p.evaluate(() => document.activeElement.classList.contains('range-btn')), 'focus returned');
    await p.click('li[data-range="wine"] .range-btn'); await new Promise(r => setTimeout(r, 500));
    assert.ok((await p.$eval('.range-fig img', e => e.src)).includes('range-wine'));
    await p.click('.range-close'); assert.ok(!(await p.$eval('dialog.range-dlg', d => d.open)));
    await p.click('.drink-card .ask-line'); await new Promise(r => setTimeout(r, 500)); assert.ok(await p.$eval('dialog.range-dlg', d => d.open));
    await p.mouse.click(5, 5); assert.ok(!(await p.$eval('dialog.range-dlg', d => d.open)), 'click outside closes'); await p.close();
  });
  await t('range lightbox: reduced motion opens without zoom animation; every malt row maps to its image', async () => {
    const p = await open(1280, base, { reduced: true });
    await p.evaluate(() => { window.__anim = 0; const o = Element.prototype.animate; Element.prototype.animate = function () { window.__anim++; return o.apply(this, arguments); }; });
    for (const k of ['speyside', 'highland', 'islay']) {
      await p.click('li[data-range="' + k + '"] .range-btn'); await new Promise(r => setTimeout(r, 200));
      assert.ok((await p.$eval('.range-fig img', e => e.src)).includes('range-' + k)); await p.keyboard.press('Escape');
    }
    assert.strictEqual(await p.evaluate(() => window.__anim), 0); await p.close();
  });
  await b.close(); console.log('\n' + n + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
