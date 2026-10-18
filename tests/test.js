#!/usr/bin/env node
/* Dependency-free self-test:  node tests/test.js   (run `node tools/build.js` first) */
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const CB = require(path.join(root, 'js/render.js'));
const c = JSON.parse(fs.readFileSync(path.join(root, 'content.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let n = 0, fail = 0;
function t(name, fn) { try { fn(); n++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + e.message); } }
const at = iso => new Date(iso);

/* --- Open now, one probe per weekday (October 2026 = BST, UTC+1; 12:00 London = 11:00Z) --- */
// 2026-10-19 is a Monday.
t('Mon 13:00 -> Closed, opens Wed 12pm', () => assert.strictEqual(CB.openStatus(c.hours, at('2026-10-19T12:00:00Z')).text, 'Closed – opens Wed 12pm'));
t('Tue 13:00 -> Closed, opens Wed 12pm', () => assert.strictEqual(CB.openStatus(c.hours, at('2026-10-20T12:00:00Z')).text, 'Closed – opens Wed 12pm'));
t('Wed 10:00 -> Closed, opens 12pm', () => assert.strictEqual(CB.openStatus(c.hours, at('2026-10-21T09:00:00Z')).text, 'Closed – opens 12pm'));
t('Wed 13:00 -> Open until 10pm', () => assert.strictEqual(CB.openStatus(c.hours, at('2026-10-21T12:00:00Z')).text, 'Open now – until 10pm'));
t('Thu 21:59 -> Open', () => assert.strictEqual(CB.openStatus(c.hours, at('2026-10-22T20:59:00Z')).state, 'open'));
t('Thu 22:00 -> Closed, opens Fri 12pm', () => assert.strictEqual(CB.openStatus(c.hours, at('2026-10-22T21:00:00Z')).text, 'Closed – opens Fri 12pm'));
t('Fri 12:00 -> Open', () => assert.strictEqual(CB.openStatus(c.hours, at('2026-10-23T11:00:00Z')).state, 'open'));
t('Sat 15:00 -> Open until 10pm', () => assert.strictEqual(CB.openStatus(c.hours, at('2026-10-24T14:00:00Z')).text, 'Open now – until 10pm'));
t('Sat 23:00 -> next day (Sun) unknown, no guess', () => assert.strictEqual(CB.openStatus(c.hours, at('2026-10-24T22:00:00Z')).text, 'Closed now'));
t('Sun (null hours) -> status hidden', () => { assert.strictEqual(CB.openStatus(c.hours, at('2026-10-25T10:00:00Z')), null); assert.strictEqual(CB.renderStatus(null), ''); });
t('GMT (winter) uses London time: Wed 2026-12-02 12:00Z = 12:00 GMT open', () => assert.strictEqual(CB.openStatus(c.hours, at('2026-12-02T12:00:00Z')).state, 'open'));
t('BST boundary: Wed 2026-10-21 21:30Z = 22:30 BST closed', () => assert.strictEqual(CB.openStatus(c.hours, at('2026-10-21T21:30:00Z')).state, 'closed'));
t('Sunday with real hours would work', () => { const h = Object.assign({}, c.hours, { sun: { open: '12:00', close: '18:00' } }); assert.strictEqual(CB.openStatus(h, at('2026-10-25T12:00:00Z')).text, 'Open now – until 6pm'); });

/* --- Events --- */
const evs = [{ title: 'Past quiz', date: '2026-10-01', time: '20:00' }, { title: 'Quiz night', date: '2026-10-22', time: '20:00', description: 'Teams of 4' }, { title: 'Later', date: '2026-11-05' }];
t('past events hidden', () => assert.deepStrictEqual(CB.upcomingEvents(evs, at('2026-10-18T10:00:00Z')).map(e => e.title), ['Quiz night', 'Later']));
t('event on the day still shows', () => assert.strictEqual(CB.upcomingEvents(evs, at('2026-10-22T20:30:00Z'))[0].title, 'Quiz night'));
t('next event text', () => assert.strictEqual(CB.nextEventText(evs, at('2026-10-18T10:00:00Z')), 'Next: Quiz night, Thu 22 Oct, 8pm'));
t('no events -> no next text, graceful empty state', () => { assert.strictEqual(CB.nextEventText([], new Date()), ''); assert.ok(/ask at the bar/i.test(CB.renderEvents(c, new Date()))); });
t('ics data URL', () => { const u = CB.buildIcs(evs[1], c.site); assert.ok(u.startsWith('data:text/calendar')); const d = decodeURIComponent(u.split(',')[1]); assert.ok(d.includes('DTSTART;TZID=Europe/London:20261022T200000') && d.includes('SUMMARY:Quiz night')); });
t('events render with Add to calendar', () => assert.ok(CB.renderEvents(Object.assign({}, c, { events: evs }), at('2026-10-18T10:00:00Z')).includes('Add to calendar')));

/* --- Beer board + Sheet CSV --- */
const csv = 'section,name,brewery,style,abv,price,on_now,notes\r\ncask,"Pale, Gold",Brew Co,Pale,3.9,4.20,yes,\r\ncask,Dark Star,Brew Co,Stout,4.6,£4.60,TRUE,"Rich ""roasty"""\r\ncask,Old Bitter,Brew Co,Bitter,4.2,4.2,no,\r\ncoming,Winter Ale,Brew Co,,,,,\r\nlast_updated,2026-10-14,,,,,,\r\n';
t('CSV parses quotes/commas', () => { const b = CB.boardFromCsv(csv, 6); assert.strictEqual(b.beers.length, 3); assert.strictEqual(b.beers[0].name, 'Pale, Gold'); assert.strictEqual(b.beers[1].notes, 'Rich "roasty"'); assert.strictEqual(b.beers[1].price, 4.6); assert.strictEqual(b.beers[2].on_now, false); assert.strictEqual(b.coming[0].name, 'Winter Ale'); assert.strictEqual(b.lastUpdated, '2026-10-14'); });
t('board from sheet: count, last updated, chips, coming soon', () => { const h = CB.renderBoard(CB.boardFromCsv(csv, 6), {}); assert.ok(h.includes('6 hand pulls · 2 on now')); assert.ok(h.includes('Board updated: Wed 14 Oct')); assert.ok(h.includes('chip-pale') && h.includes('chip-stout') && h.includes('Coming soon')); assert.ok(h.includes('£4.20') && h.includes('3.9%')); });
t('bad CSV -> null (falls back)', () => { assert.strictEqual(CB.boardFromCsv('<html>nope</html>', 6), null); assert.strictEqual(CB.boardFromCsv('', 6), null); });
t('empty board: graceful, no fake beers, no updated line', () => { const h = CB.renderBoard(c.board, {}); assert.ok(h.includes('ask at the bar')); assert.ok(!h.includes('Board updated') && !h.includes('on now') && !h.includes('Example')); });
t('example beers only with example flag, and labelled', () => { assert.ok(!CB.regions(c, new Date(), false).board.includes('Example')); const h = CB.regions(c, new Date(), true).board; assert.ok(h.includes('Example beers') && h.includes('6 hand pulls · 5 on now') && h.includes('Board updated: Wed 14 Oct')); });
t('null price/abv hidden; no £0.00', () => { const h = CB.renderBoard({ handPulls: 6, beers: [{ name: 'X', style: 'IPA', abv: null, price: null }], coming: [] }, {}); assert.ok(!h.includes('£') && !h.includes('class="abv"') && !h.includes('class="price"')); });

/* --- Hidden sections render when data exists --- */
t('reviews/badges empty -> nothing; populated -> markup', () => { assert.strictEqual(CB.renderReviews(c), ''); assert.strictEqual(CB.renderBadges(c), ''); assert.ok(CB.renderReviews({ reviews: [{ quote: 'q', author: 'A', platform: 'Google', url: null }] }).includes('<blockquote>')); assert.ok(CB.renderBadges({ badges: [{ name: 'CAMRA listed', url: null, image: null }] }).includes('CAMRA')); });
t('phone null hidden; present shown', () => { assert.ok(!CB.renderContact(c).includes('Phone:')); const c2 = JSON.parse(JSON.stringify(c)); c2.site.phone = '01642 000000'; assert.ok(CB.renderContact(c2).includes('tel:01642000000')); assert.ok(CB.buildJsonLd(c2).includes('telephone')); });
t('hours table: real table, Sunday (null) row hidden', () => { const h = CB.renderHours(c.hours); assert.ok(h.includes('<table') && h.includes('<caption class="sr-only">') && !h.includes('Sunday')); });

/* --- Built index.html checks --- */
t('noindex meta', () => assert.ok(/<meta name="robots" content="noindex, nofollow">/.test(html)));
t('one banner, no .tag', () => { assert.strictEqual((html.match(/class="banner"/g) || []).length, 1); assert.ok(!/class="[^"]*\btag\b/.test(html)); });
t('banned strings absent', () => ['£0.00', 'TBC', 'Placeholder', 'placeholder', 'Demo content', 'to be confirmed'].forEach(s => assert.ok(!html.includes(s), s)));
t('no inline style attributes', () => assert.ok(!/ style="/.test(html)));
t('static fallback has hours, address, email', () => { assert.ok(html.includes('Wednesday') && html.includes('12pm – 10pm') && html.includes('137 High Street') && html.includes('TS15 9AY') && html.includes('contact@caskandbarrelyarm.uk')); });
t('JSON-LD valid BarOrPub, no telephone while null', () => { const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html); const j = JSON.parse(m[1]); assert.strictEqual(j['@type'], 'BarOrPub'); assert.ok(j.address.postalCode && j.geo.latitude && j.openingHoursSpecification.length === 4 && !('telephone' in j)); });
t('Open Graph tags', () => ['og:title', 'og:description', 'og:image', 'og:url'].forEach(p => assert.ok(html.includes('property="' + p + '"'), p)));
t('og image is 1200x630 file', () => { const b = fs.readFileSync(path.join(root, 'images/og-image.png')); assert.strictEqual(b.readUInt32BE(16), 1200); assert.strictEqual(b.readUInt32BE(20), 630); });
t('photo credits intact (4 items in details)', () => { assert.ok(html.includes('<details class="credits"')); ['Alan Hughes', '55belgianbeerfan', 'Simon Cotterill', 'Colin Park'].forEach(a => assert.ok(html.includes(a), a)); assert.ok(html.includes('Concept only, not affiliated with or approved by Cask &amp; Barrel')); });
t('AI labels on clips', () => assert.strictEqual((html.match(/AI-generated illustrative footage/g) || []).length >= 2, true));
t('private hire types', () => ['Christmas party', 'Wake', 'Tasting evening'].forEach(x => assert.ok(html.includes('<option value="' + x + '">'), x)));
t('hero img fetchpriority high; picture avif/webp/jpg', () => assert.ok(html.includes('fetchpriority="high"') && html.includes('image/avif') && html.includes('image/webp')));
t('videos <= 500 KB', () => fs.readdirSync(path.join(root, 'media')).filter(f => /\.(mp4|webm)$/.test(f)).forEach(f => assert.ok(fs.statSync(path.join(root, 'media', f)).size <= 500 * 1024, f)));
t('every referenced local asset exists', () => { const refs = [...html.matchAll(/(?:src|href|srcset)="([^"]+)"/g)].flatMap(m => m[1].split(',').map(s => s.trim().split(' ')[0])).filter(u => /^(images|media|css|js)\//.test(u) || /^(favicon|apple)/.test(u)); refs.forEach(u => assert.ok(fs.existsSync(path.join(root, u)), u)); });
t('index.html is up to date with content.json (rebuild leaves it unchanged)', () => { /* run build to a temp compare */ const cp = require('child_process'); const before = html; cp.execFileSync('node', [path.join(root, 'tools/build.js')]); const after = fs.readFileSync(path.join(root, 'index.html'), 'utf8'); assert.strictEqual(before.replace(/\s+/g, ''), after.replace(/\s+/g, '')); });
t('drinks style guide: labelled, no stock claims, ranges map to existing images and AI caption', () => { const c = JSON.parse(fs.readFileSync(path.join(root, 'content.json'), 'utf8')); assert.ok(html.includes('Style guide, not a stock list')); assert.ok(html.includes('Ask at the bar for today')); const rs = c.menu.ranges; c.menu.groups.forEach(g => g.styles.forEach(i => { assert.ok(rs[i.range], i.name); ['jpg', 'webp'].forEach(x => assert.ok(fs.existsSync(path.join(root, rs[i.range].image.base + '.' + x)))); assert.ok(rs[i.range].image.alt); ['jpg', 'webp'].forEach(x => assert.ok(fs.existsSync(path.join(root, rs[i.range].glass.base + '.' + x)))); assert.ok(rs[i.range].glass.alt); assert.ok(/AI-generated illustration of a back bar/.test(rs[i.range].caption)); })); assert.ok(!/£0\.00|TBC|Placeholder/i.test(html)); });

console.log('\n' + n + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
