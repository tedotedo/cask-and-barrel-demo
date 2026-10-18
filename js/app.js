/*
 * Cask & Barrel demo – browser behaviour.
 *
 * SHEET_CSV_URL
 * -------------
 * The "On the bar now" board can be edited from a phone through a Google Sheet:
 *   1. Create a sheet with the header row:  section,name,brewery,style,abv,price,on_now,notes
 *      (section = cask | coming | last_updated; for last_updated put the date, e.g. 2026-10-14, in the "name" column)
 *   2. File > Share > Publish to web > choose the sheet tab > "Comma-separated values (.csv)" > Publish.
 *   3. Paste the published CSV link between the quotes below.
 * While it is null (or the fetch fails, or the sheet has no rows) the board falls back to content.json.
 */
var SHEET_CSV_URL = null; // e.g. 'https://docs.google.com/spreadsheets/d/e/XXXX/pub?output=csv'

/*
 * FORM_ENDPOINT – deliberately null: the enquiry form sends nothing. See the comment above the form in index.html.
 */
var FORM_ENDPOINT = null;

(function () {
  'use strict';
  var CB = window.CB, qs = new URLSearchParams(location.search);
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ----- banner (dismissible) + pitch note ----- */
  var banner = $('#concept-banner');
  try { if (sessionStorage.getItem('cb-banner') === 'closed') banner.hidden = true; } catch (e) {}
  $('.banner-close').addEventListener('click', function () {
    banner.hidden = true; try { sessionStorage.setItem('cb-banner', 'closed'); } catch (e) {}
  });
  if (qs.get('pitch') === '1') $('#pitch-note').hidden = false;

  /* ----- hamburger ----- */
  var toggle = $('.menu-toggle'), nav = $('#site-nav');
  function setMenu(open) { toggle.setAttribute('aria-expanded', open ? 'true' : 'false'); nav.classList.toggle('open', open); }
  toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
  $$('a', nav).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setMenu(false); toggle.focus(); }
  });

  /* ----- hydrate dynamic regions from content.json ----- */
  function setRegion(name, html) { $$('[data-region="' + name + '"]').forEach(function (el) { el.innerHTML = html; }); }
  function markToday(c) {
    var d = CB.DAYS[CB.londonNow().dow];
    $$('.hours-table tr').forEach(function (tr) { tr.classList.toggle('today', tr.getAttribute('data-day') === d); });
  }
  function fetchBoard(c) {
    var fallback = Promise.resolve(null);
    if (!SHEET_CSV_URL) return fallback;
    return fetch(SHEET_CSV_URL, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('sheet ' + r.status); return r.text();
    }).then(function (t) { return CB.boardFromCsv(t, c.board.handPulls); }).catch(function () { return null; });
  }
  /* ---------- Back-bar range lightbox (native <dialog>: focus trap, Esc, aria-modal) ---------- */
  var rangeDlg = null;
  function setupRanges(c) {
    var ranges = (c.menu && c.menu.ranges) || {};
    if (typeof HTMLDialogElement === 'undefined' || !Object.keys(ranges).length) return;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!rangeDlg) {
      rangeDlg = document.createElement('dialog');
      rangeDlg.className = 'range-dlg';
      rangeDlg.setAttribute('aria-labelledby', 'range-title');
      rangeDlg.setAttribute('aria-modal', 'true');
      rangeDlg.innerHTML = '<div class="range-panel"><button type="button" class="range-close" aria-label="Close">&times;</button>' +
        '<h3 id="range-title"></h3><div class="range-fig"></div><p class="range-cap"></p></div>';
      document.body.appendChild(rangeDlg);
      rangeDlg.addEventListener('click', function (e) { if (e.target === rangeDlg) rangeDlg.close(); });
      rangeDlg.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var f = $$('button, [href], [tabindex]:not([tabindex="-1"])', rangeDlg);
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (!rangeDlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      });
      rangeDlg.querySelector('.range-close').addEventListener('click', function () { rangeDlg.close(); });
    }
    function open(key, trigger) {
      var rg = ranges[key]; if (!rg) return;
      var im = rg.image;
      rangeDlg.querySelector('#range-title').textContent = rg.title;
      function pic(x) { return '<figure><picture><source type="image/webp" srcset="' + CB.esc(x.base) + '.webp"><img src="' + CB.esc(x.base) + '.jpg" width="' + x.width + '" height="' + x.height + '" alt="' + CB.esc(x.alt) + '"></picture><figcaption>' + CB.esc(x.caption || rg.caption || c.menu.rangeCaption) + '</figcaption></figure>'; }
      rangeDlg.querySelector('.range-fig').innerHTML = pic(Object.assign({}, im, { caption: rg.caption })) + (rg.glass ? pic(rg.glass) : '');
      rangeDlg.querySelector('.range-cap').hidden = true;
      rangeDlg.showModal();
      var panel = rangeDlg.querySelector('.range-panel');
      if (!reduce && trigger && panel.animate) {
        var t = trigger.getBoundingClientRect(), p = panel.getBoundingClientRect();
        var dx = (t.left + t.width / 2) - (p.left + p.width / 2), dy = (t.top + t.height / 2) - (p.top + p.height / 2);
        var sc = Math.max(0.2, Math.min(0.8, t.width / p.width));
        panel.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sc + ')', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    }
    $$('.drink-card').forEach(function (card) {
      // rows become real buttons (keyboard); the card background also opens the first range
      $$('li[data-range] .style-top strong', card).forEach(function (s) {
        var li = s.closest('li'), b = document.createElement('button');
        b.type = 'button'; b.className = 'range-btn'; b.textContent = s.textContent;
        b.setAttribute('aria-haspopup', 'dialog');
        b.setAttribute('aria-label', s.textContent + ': see a back bar (AI illustration)');
        s.replaceWith(b); li.classList.add('has-range');
      });
      var first = card.getAttribute('data-range');
      if (first && !card.querySelector('.range-open')) {
        var o = document.createElement('button'); o.type = 'button'; o.className = 'range-open';
        o.setAttribute('aria-haspopup', 'dialog');
        o.textContent = 'See a back bar ›';
        o.setAttribute('aria-label', 'See a back bar for ' + card.querySelector('h3').textContent + ' (AI illustration)');
        var ask = card.querySelector('.ask-line'); card.insertBefore(o, ask || null);
      }
      card.addEventListener('click', function (e) {
        var row = e.target.closest('li[data-range]'), trig = e.target.closest('button');
        var key = row ? row.getAttribute('data-range') : card.getAttribute('data-range');
        if (key) open(key, row || card);
      });
    });
  }
  function hydrate(c) {
    var now = new Date(), example = qs.get('example') === '1';
    var r = CB.regions(c, now, example);
    ['hours', 'events', 'status', 'nextEvent', 'contact', 'menuGroups', 'reviews', 'badges', 'social', 'credits'].forEach(function (k) {
      if (k === 'nextEvent') $$('[data-region="nextEvent"]').forEach(function (el) { el.textContent = r.nextEvent; });
      else setRegion(k, r[k]);
    });
    $('#reviews').hidden = !((c.reviews && c.reviews.length) || (c.badges && c.badges.length));
    markToday(c);
    setupRanges(c);
    fetchBoard(c).then(function (sheetBoard) {
      if (sheetBoard) setRegion('board', CB.renderBoard(Object.assign({ emptyText: c.board.emptyText }, sheetBoard), {}));
      else setRegion('board', r.board);
    });
    // keep "open now" fresh while the tab stays open
    setInterval(function () { setRegion('status', CB.renderStatus(CB.openStatus(c.hours))); }, 60000);
    return c;
  }
  fetch('content.json').then(function (r) { return r.json(); }).then(hydrate).catch(function () { /* static HTML already shows everything */ });

  /* ----- preset "Christmas party" from ribbon ----- */
  $$('[data-preset]').forEach(function (a) {
    a.addEventListener('click', function () { var sel = $('#f-type'); if (sel) sel.value = a.getAttribute('data-preset'); });
  });

  /* ----- enquiry form (demo: sends nothing) ----- */
  var form = $('#enquiry');
  var dateEl = $('#f-date');
  (function () { var d = new Date(); dateEl.min = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); })();
  var rules = {
    'f-name': function (v) { return v.trim() ? '' : 'Please tell us your name.'; },
    'f-email': function (v) { return !v.trim() ? 'Please enter your email address.' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'That email address doesn’t look right.'; },
    'f-phone': function (v) { return !v.trim() || /^[+\d][\d\s()-]{6,}$/.test(v.trim()) ? '' : 'Please enter a valid phone number, or leave it blank.'; },
    'f-type': function (v) { return v ? '' : 'Please choose a type of event.'; },
    'f-date': function (v) { return !v ? 'Please choose a preferred date.' : (dateEl.min && v < dateEl.min ? 'Please choose a date in the future.' : ''); },
    'f-guests': function (v) { var n = parseInt(v, 10); return !v ? 'Please enter the number of guests.' : (isNaN(n) || n < 1 || n > 500) ? 'Guests must be between 1 and 500.' : ''; }
  };
  function check(id) {
    var el = document.getElementById(id), msg = rules[id](el.value), err = document.getElementById(id + '-err');
    err.textContent = msg; if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    return !msg;
  }
  Object.keys(rules).forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener('blur', function () { check(id); });
    el.addEventListener('input', function () { if (el.getAttribute('aria-invalid')) check(id); });
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var firstBad = null;
    Object.keys(rules).forEach(function (id) { if (!check(id) && !firstBad) firstBad = id; });
    if (firstBad) { document.getElementById(firstBad).focus(); return; }
    // FORM_ENDPOINT is null: nothing is sent. See the wiring comment in index.html.
    var box = $('#enquiry-success'), name = $('#f-name').value.trim().split(/\s+/)[0];
    $('h3', box).textContent = 'Thanks ' + name + ' – we’ll reply within 24 hours.';
    $('#s-type').textContent = $('#f-type').value.toLowerCase();
    form.hidden = true; box.hidden = false; box.focus();
  });

  /* ----- click-to-load map ----- */
  var mapBtn = $('#map-load');
  mapBtn.addEventListener('click', function () {
    var f = document.createElement('iframe');
    f.src = mapBtn.getAttribute('data-src'); f.title = 'Interactive OpenStreetMap showing Cask & Barrel on Yarm High Street';
    f.loading = 'lazy'; f.referrerPolicy = 'no-referrer';
    $('#mapbox').appendChild(f); mapBtn.remove(); $('.pin').remove(); $('#mapbox picture').remove();
  });

  /* ----- videos: load on scroll into view, pausable, reduced motion = no autoplay ----- */
  var PLAY = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 1l11 6-11 6z"/></svg>Play';
  var PAUSE = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2 1h4v12H2zM8 1h4v12H8z"/></svg>Pause';
  $$('video.lazy-video').forEach(function (v) {
    v.removeAttribute('controls');
    var btn = document.createElement('button'), label = v.getAttribute('aria-label') || 'video';
    btn.type = 'button'; btn.className = 'vbtn';
    function sync() { var playing = !v.paused; btn.innerHTML = playing ? PAUSE : PLAY; btn.setAttribute('aria-label', (playing ? 'Pause: ' : 'Play: ') + label); }
    btn.addEventListener('click', function () {
      if (v.paused) { v.dataset.manual = ''; v.play().catch(function () {}); } else { v.dataset.manual = 'paused'; v.pause(); }
    });
    v.addEventListener('play', sync); v.addEventListener('pause', sync);
    v.parentNode.appendChild(btn); sync();
    if (reduced || !('IntersectionObserver' in window)) return; // poster only; user can press Play
    new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) { if (v.dataset.manual !== 'paused') v.play().catch(function () {}); }
        else if (!v.paused) v.pause();
      });
    }, { threshold: 0.25 }).observe(v);
  });

  /* ----- scroll reveal ----- */
  if (!reduced && 'IntersectionObserver' in window) {
    var els = $$('.about>div,.menu-grid>*,.board,.hours-table,.ev,#hours .two>div:first-child,#private-hire .wrap>*,#find-us .find>div,.walk,section h2,.kicker,.facts li');
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { el.classList.add('reveal'); var i = Array.prototype.indexOf.call(el.parentNode.children, el); el.style.setProperty('--d', Math.min(i, 4) * .08 + 's'); io.observe(el); });
    setTimeout(function () { $$('.reveal:not(.in)').forEach(function (el) { if (el.getBoundingClientRect().top < innerHeight) el.classList.add('in'); }); }, 100);
  }
})();
