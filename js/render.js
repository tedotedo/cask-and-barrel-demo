/*
 * Cask & Barrel demo – shared rendering code.
 * Used in two places so there is one source of truth:
 *   1. tools/build.js (Node, dev time) pre-renders content.json into index.html as plain HTML,
 *      so hours, address and contact are present even with JavaScript off.
 *   2. js/app.js (browser) re-renders the dynamic regions (hours, beer board, events, status).
 * Every function takes plain data and returns an HTML string (or a value); nothing touches the DOM.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CB = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  var DAY_LONG = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };
  var DAY_SHORT = { sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat' };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function has(v) { return v !== null && v !== undefined && v !== ''; }

  /* ---------- Europe/London clock ---------- */
  function londonNow(date) {
    var parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date || new Date());
    var o = {};
    parts.forEach(function (p) { o[p.type] = p.value; });
    var dow = DAYS.indexOf(o.weekday.slice(0, 3).toLowerCase());
    return { ymd: o.year + '-' + o.month + '-' + o.day, dow: dow, min: parseInt(o.hour, 10) * 60 + parseInt(o.minute, 10) };
  }
  function toMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null; }
  function fmtTime(t) {
    var m = toMin(t); if (m === null) return '';
    var h = Math.floor(m / 60), mi = m % 60, ap = h >= 12 && h < 24 ? 'pm' : 'am';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + (mi ? ':' + (mi < 10 ? '0' : '') + mi : '') + ap;
  }

  /* ---------- Open now ---------- */
  // Returns null when today's hours are unknown (null) so the UI hides the status.
  function openStatus(hours, date) {
    var n = londonNow(date), h = hours[DAYS[n.dow]];
    if (h === null || h === undefined) return null;
    if (!h.closed) {
      var o = toMin(h.open), c = toMin(h.close);
      if (o !== null && c !== null) {
        if (n.min >= o && n.min < c) return { state: 'open', text: 'Open now – until ' + fmtTime(h.close) };
        if (n.min < o) return { state: 'closed', text: 'Closed – opens ' + fmtTime(h.open) };
      }
    }
    for (var i = 1; i <= 7; i++) {
      var d = (n.dow + i) % 7, nh = hours[DAYS[d]];
      if (nh === null || nh === undefined) return { state: 'closed', text: 'Closed now' }; // next day unknown: don't guess
      if (!nh.closed) return { state: 'closed', text: 'Closed – opens ' + DAY_SHORT[DAYS[d]] + ' ' + fmtTime(nh.open) };
    }
    return { state: 'closed', text: 'Closed now' };
  }

  function renderStatus(status) {
    if (!status) return '';
    return '<span class="status status-' + status.state + '"><span class="dot" aria-hidden="true"></span>' + esc(status.text) + '</span>';
  }

  /* ---------- Hours (real <table>) ---------- */
  function renderHours(hours) {
    var order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], rows = '';
    order.forEach(function (d) {
      var h = hours[d];
      if (h === null || h === undefined) return; // unknown: hidden
      var val = h.closed ? '<span class="closed">Closed</span>' : esc(fmtTime(h.open)) + ' – ' + esc(fmtTime(h.close));
      rows += '<tr data-day="' + d + '"><th scope="row">' + DAY_LONG[d] + '</th><td>' + val + '</td></tr>';
    });
    return '<table class="hours-table"><caption class="sr-only">Opening hours</caption><tbody>' + rows + '</tbody></table>';
  }

  /* ---------- Dates / events ---------- */
  function ymdParts(ymd) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || ''); return m ? [+m[1], +m[2], +m[3]] : null; }
  function dowOf(ymd) { var p = ymdParts(ymd); return DAYS[new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)).getUTCDay()]; }
  function fmtDay(ymd) { var p = ymdParts(ymd); return DAY_SHORT[dowOf(ymd)] + ' ' + p[2] + ' ' + MONTHS[p[1] - 1]; }
  function fmtDayLong(ymd) { var p = ymdParts(ymd); return DAY_LONG[dowOf(ymd)] + ' ' + p[2] + ' ' + MONTHS[p[1] - 1]; }

  // Upcoming = valid date, today or later (Europe/London), soonest first.
  function upcomingEvents(events, date) {
    var today = londonNow(date).ymd;
    return (events || []).filter(function (e) { return e && ymdParts(e.date) && e.date >= today; })
      .sort(function (a, b) { return (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1; });
  }
  function nextEventText(events, date) {
    var e = upcomingEvents(events, date)[0];
    if (!e) return '';
    return 'Next: ' + e.title + ', ' + fmtDay(e.date) + (has(e.time) ? ', ' + fmtTime(e.time) : '');
  }
  function icsEscape(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function buildIcs(ev, site) {
    var p = ymdParts(ev.date), d = '' + p[0] + ('0' + p[1]).slice(-2) + ('0' + p[2]).slice(-2);
    var t = function (x) { return x.replace(':', '') + '00'; };
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cask & Barrel demo//EN', 'BEGIN:VEVENT',
      'UID:' + d + '-' + ev.title.replace(/[^a-z0-9]/gi, '').toLowerCase() + '@caskandbarrel-demo',
      'DTSTAMP:' + d + 'T000000Z', 'SUMMARY:' + icsEscape(ev.title)];
    if (has(ev.time)) {
      lines.push('DTSTART;TZID=Europe/London:' + d + 'T' + t(ev.time));
      if (has(ev.endTime)) lines.push('DTEND;TZID=Europe/London:' + d + 'T' + t(ev.endTime));
    } else {
      lines.push('DTSTART;VALUE=DATE:' + d);
    }
    if (has(ev.description)) lines.push('DESCRIPTION:' + icsEscape(ev.description));
    lines.push('LOCATION:' + icsEscape(site.name + ', ' + site.address.lines.slice(1).join(', ') + ', ' + site.address.locality + ' ' + site.address.postcode));
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'));
  }
  function renderEvents(c, date) {
    var list = upcomingEvents(c.events, date);
    if (!list.length) {
      var follow = [];
      if (c.site.social.instagram) follow.push('<a class="link" href="' + esc(c.site.social.instagram) + '" rel="noopener">Instagram</a>');
      if (c.site.social.facebook) follow.push('<a class="link" href="' + esc(c.site.social.facebook) + '" rel="noopener">Facebook</a>');
      return '<p class="empty-note">' + esc(c.eventsEmptyText) + (follow.length ? ' Follow us on ' + follow.join(' or ') + '.' : '') + '</p>';
    }
    return '<ul class="events">' + list.map(function (e) {
      var p = ymdParts(e.date);
      return '<li class="ev"><div class="date">' + MONTHS[p[1] - 1] + '<b>' + p[2] + '</b></div><div class="ev-body"><h3>' + esc(e.title) + '</h3><p>' +
        esc(fmtDayLong(e.date)) + (has(e.time) ? ' · ' + esc(fmtTime(e.time)) : '') + (has(e.description) ? ' – ' + esc(e.description) : '') +
        '</p></div><a class="btn small ghost-dark" download="' + esc(e.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()) + '.ics" href="' + buildIcs(e, c.site) +
        '">Add to calendar<span class="sr-only"> – ' + esc(e.title) + '</span></a></li>';
    }).join('') + '</ul>';
  }

  /* ---------- Beer board ---------- */
  function parseCsv(text) {
    var rows = [], row = [], cur = '', q = false, i, ch;
    text = String(text).replace(/^\uFEFF/, '');
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ''; }); });
  }
  function truthy(v) { return /^(y|yes|true|1|on|x)$/i.test(String(v || '').trim()); }
  function numOrNull(v) {
    var s = String(v == null ? '' : v).replace(/[£%\s]/g, ''); if (s === '') return null;
    var n = parseFloat(s); return isNaN(n) ? null : n;
  }
  /*
   * Sheet CSV format (header row required):
   *   section,name,brewery,style,abv,price,on_now,notes
   *   cask,Example Pale,Example Brewery,Pale,3.9,4.20,yes,
   *   coming,Next cask name,Brewery,,,,,
   *   last_updated,2026-10-14,,,,,,        <- date goes in the "name" column
   * Returns a board object, or null if the CSV has no usable rows.
   */
  function boardFromCsv(text, fallbackHandPulls) {
    var rows = parseCsv(text); if (rows.length < 2) return null;
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var idx = function (k) { return head.indexOf(k); };
    if (idx('section') < 0 || idx('name') < 0) return null;
    var get = function (r, k) { var i = idx(k); return i < 0 ? '' : (r[i] || '').trim(); };
    var board = { handPulls: fallbackHandPulls, lastUpdated: null, beers: [], coming: [] };
    rows.slice(1).forEach(function (r) {
      var s = get(r, 'section').toLowerCase(), name = get(r, 'name');
      if (!name) return;
      if (s === 'last_updated') board.lastUpdated = name;
      else if (s === 'coming' || s === 'coming soon') board.coming.push({ name: name, brewery: get(r, 'brewery') || null });
      else if (s === 'cask' || s === '') board.beers.push({
        name: name, brewery: get(r, 'brewery') || null, style: get(r, 'style') || null,
        abv: numOrNull(get(r, 'abv')), price: numOrNull(get(r, 'price')),
        on_now: get(r, 'on_now') === '' ? true : truthy(get(r, 'on_now')), notes: get(r, 'notes') || null
      });
    });
    return board.beers.length || board.coming.length ? board : null;
  }
  function styleClass(style) {
    var s = String(style || '').toLowerCase();
    if (/ipa/.test(s)) return 'ipa';
    if (/porter/.test(s)) return 'porter';
    if (/stout/.test(s)) return 'stout';
    if (/pale|golden|blonde/.test(s)) return 'pale';
    if (/bitter|best|esb|amber|ruby/.test(s)) return 'bitter';
    return 'other';
  }
  function fmtPrice(p) { return typeof p === 'number' ? '£' + p.toFixed(2) : (has(p) ? String(p) : ''); }
  function fmtAbv(a) { return typeof a === 'number' ? a.toFixed(1) + '%' : (has(a) ? String(a) : ''); }
  function fmtUpdated(v) { var p = ymdParts(String(v).slice(0, 10)); return p ? fmtDay(String(v).slice(0, 10)) : String(v); }

  function renderBoard(board, opts) {
    opts = opts || {};
    var beers = board.beers || [], on = beers.filter(function (b) { return b.on_now !== false; }), total = board.handPulls;
    var count = '';
    if (total) count = total + ' hand pull' + (total === 1 ? '' : 's') + (beers.length ? ' · ' + on.length + ' on now' : '');
    var h = '<div class="board-head"><h3 class="board-title">On the bar now</h3>' + (count ? '<p class="board-count">' + esc(count) + '</p>' : '') + '</div>';
    if (opts.example) h += '<p class="example-flag">Example beers – for demonstration only, not the pub\'s real line-up</p>';
    if (!beers.length) {
      h += '<p class="board-empty">' + esc(board.emptyText) + '</p>';
    } else {
      var sorted = on.concat(beers.filter(function (b) { return b.on_now === false; }));
      h += '<ul class="beer-list">' + sorted.map(function (b) {
        var off = b.on_now === false, abv = fmtAbv(b.abv), price = fmtPrice(b.price);
        return '<li class="beer' + (off ? ' beer-off' : '') + '"><div class="beer-main"><span class="beer-name">' + esc(b.name) + '</span>' +
          (has(b.brewery) ? '<span class="beer-brew">' + esc(b.brewery) + '</span>' : '') +
          (has(b.notes) ? '<span class="beer-notes">' + esc(b.notes) + '</span>' : '') + '</div>' +
          '<div class="beer-meta">' + (off ? '<span class="chip chip-off">Off</span>' : '') +
          (has(b.style) ? '<span class="chip chip-' + styleClass(b.style) + '">' + esc(b.style) + '</span>' : '') +
          (abv ? '<span class="abv">' + esc(abv) + '</span>' : '') + (price ? '<span class="price">' + esc(price) + '</span>' : '') + '</div></li>';
      }).join('') + '</ul>';
    }
    if ((board.coming || []).length) {
      h += '<div class="coming"><h4>Coming soon</h4><ul>' + board.coming.map(function (c) {
        return '<li>' + esc(c.name) + (has(c.brewery) ? ' <span>· ' + esc(c.brewery) + '</span>' : '') + '</li>';
      }).join('') + '</ul></div>';
    }
    if (has(board.lastUpdated)) h += '<p class="board-updated">Board updated: ' + esc(fmtUpdated(board.lastUpdated)) + '</p>';
    return h;
  }

  /* ---------- Static content blocks ---------- */
  function addrOneLine(s) { return s.address.lines.slice(1).join(', ') + ', ' + s.address.locality + ' ' + s.address.postcode; }
  function renderContact(c) {
    var s = c.site, h = '<address>' + s.address.lines.map(esc).join('<br>') + '<br>' + esc(s.address.locality) + ' ' + esc(s.address.postcode) + '</address>';
    if (has(s.locationNote)) h += '<p>' + esc(s.locationNote) + '</p>';
    h += '<ul class="contact-list">';
    if (has(s.email)) h += '<li>Email: <a class="link" href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a></li>';
    if (has(s.phone)) h += '<li>Phone: <a class="link" href="tel:' + esc(String(s.phone).replace(/[^+\d]/g, '')) + '">' + esc(s.phone) + '</a></li>';
    h += '</ul><p><a class="btn" href="' + esc(s.directionsUrl) + '" rel="noopener">Get directions</a></p>';
    return h;
  }
  var MENU_ICONS = {
    glass: '<svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true" focusable="false"><path d="M8 4h16l-1.6 12a6.4 6.4 0 0 1-12.8 0z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.2 11h13.6" stroke="currentColor" stroke-width="1.8"/><path d="M16 22.4V28M11 28h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    flame: '<svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true" focusable="false"><path d="M16 3c1 5 7 8 7 15a7 7 0 0 1-14 0c0-3 1.600-5 3.200-6.500.2 2 .8 3 1.800 3.500C13.500 10 14.500 6 16 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M16 27a3.500 3.500 0 0 1-3.500-3.500c0-2 2-3 3.500-5 1.500 2 3.500 3 3.500 5A3.500 3.500 0 0 1 16 27z" fill="currentColor" opacity=".5"/></svg>'
  };
  function renderMenuGroups(c) {
    var m = c.menu;
    return m.groups.map(function (g) {
      var labels = g.scaleLabels || ['', ''];
      var bottles = (g.bottles || []).filter(function (i) { return i && has(i.name); });
      var h = '<div class="card drink-card"><div class="drink-head">' + (MENU_ICONS[g.icon] ? '<span class="drink-icon">' + MENU_ICONS[g.icon] + '</span>' : '') +
        '<div><h3>' + esc(g.title) + '</h3>' + (has(g.blurb) ? '<p class="drink-blurb">' + esc(g.blurb) + '</p>' : '') + '</div></div>';
      if (bottles.length) {
        h += '<p class="guide-label">On the shelf</p><ul class="bottles">' + bottles.map(function (i) {
          return '<li><span>' + esc(i.name) + (has(i.note) ? '<small>' + esc(i.note) + '</small>' : '') + '</span>' + (has(i.price) ? '<span>' + esc(fmtPrice(i.price)) + '</span>' : '') + '</li>';
        }).join('') + '</ul>';
      }
      if (has(m.guideLabel)) h += '<p class="guide-label">' + esc(m.guideLabel) + '</p>';
      h += '<ul class="styles">' + (g.styles || []).map(function (i) {
        var lvl = typeof i.level === 'number' ? Math.max(0, Math.min(4, Math.round(i.level))) : null;
        return '<li><div class="style-top"><strong>' + esc(i.name) + '</strong>' +
          (lvl !== null ? '<span class="meter" role="img" aria-label="' + esc(labels[0] + ' to ' + labels[1] + ': ' + lvl + ' out of 4') + '">' +
            [1, 2, 3, 4].map(function (n) { return '<i' + (n <= lvl ? ' class="on"' : '') + '></i>'; }).join('') + '</span>' : '') + '</div>' +
          (has(i.note) ? '<span class="style-note">' + esc(i.note) + '</span>' : '') +
          (has(i.pairing) ? '<span class="style-pair">' + esc(i.pairing) + '</span>' : '') + '</li>';
      }).join('') + '</ul>';
      if (g.scaleLabels) h += '<p class="meter-key"><span>' + esc(labels[0]) + '</span><span>' + esc(labels[1]) + '</span></p>';
      if (has(m.askLine)) h += '<p class="ask-line">' + esc(m.askLine) + '</p>';
      return h + '</div>';
    }).join('');
  }
  function renderReviews(c) {
    if (!c.reviews || !c.reviews.length) return '';
    return '<div class="reviews">' + c.reviews.map(function (r) {
      return '<figure class="review"><blockquote><p>' + esc(r.quote) + '</p></blockquote><figcaption>' + esc(r.author) +
        (has(r.platform) ? ', ' + (has(r.url) ? '<a class="link" href="' + esc(r.url) + '" rel="noopener">' + esc(r.platform) + '</a>' : esc(r.platform)) : '') + '</figcaption></figure>';
    }).join('') + '</div>';
  }
  function renderBadges(c) {
    if (!c.badges || !c.badges.length) return '';
    return '<ul class="badges">' + c.badges.map(function (b) {
      var inner = has(b.image) ? '<img src="' + esc(b.image) + '" alt="' + esc(b.name) + '" height="48">' : esc(b.name);
      return '<li>' + (has(b.url) ? '<a href="' + esc(b.url) + '" rel="noopener">' + inner + '</a>' : '<span>' + inner + '</span>') + '</li>';
    }).join('') + '</ul>';
  }
  var ICONS = {
    instagram: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M14 8V6.5c0-.7.3-1 1-1h2V2h-3c-3 0-4.5 1.8-4.5 4.4V8H7v3.5h2.5V22H14V11.5h2.8L17.3 8z"/></svg>'
  };
  function renderSocial(c) {
    var out = '';
    ['instagram', 'facebook'].forEach(function (k) {
      var u = c.site.social[k];
      if (has(u)) out += '<li><a href="' + esc(u) + '" rel="noopener" aria-label="' + k[0].toUpperCase() + k.slice(1) + '">' + ICONS[k] + '</a></li>';
    });
    return out ? '<ul class="social">' + out + '</ul>' : '';
  }
  function renderCredits(c) {
    var p = c.photoCredits;
    return '<p>' + esc(p.intro) + '</p><ul>' + p.items.map(function (i) {
      return '<li>' + esc(i.label) + ': “' + esc(i.title) + '” by ' + esc(i.author) + ', <a href="' + esc(i.licenceUrl) + '" rel="noopener">' + esc(i.licence) +
        '</a>, <a href="' + esc(i.page) + '" rel="noopener">Commons page</a></li>';
    }).join('') + '</ul>';
  }

  /* ---------- Responsive pictures / video ---------- */
  function renderPicture(img, o) {
    o = o || {};
    var srcset = function (ext) { return img.widths.map(function (w) { return img.base + '-' + w + '.' + ext + ' ' + w + 'w'; }).join(', '); };
    var big = img.widths[img.widths.length - 1], sizes = esc(o.sizes || '100vw');
    return '<picture><source type="image/avif" srcset="' + srcset('avif') + '" sizes="' + sizes + '"><source type="image/webp" srcset="' + srcset('webp') + '" sizes="' + sizes + '">' +
      '<img src="' + img.base + '-' + big + '.jpg" srcset="' + srcset('jpg') + '" sizes="' + sizes + '" width="' + img.width + '" height="' + img.height + '" alt="' + esc(img.alt) + '"' +
      (o.eager ? ' fetchpriority="high" decoding="async"' : ' loading="lazy" decoding="async"') + '></picture>';
  }
  function renderClip(clip, extraClass) {
    var cap = esc(clip.caption) + (clip.ai ? ' · AI-generated illustrative footage, not the pub or its staff' : '');
    return '<figure class="photo clip' + (extraClass ? ' ' + extraClass : '') + '"><div class="clip-frame"><video class="lazy-video" muted loop playsinline controls preload="none" poster="' + clip.base + '.webp" width="' + clip.width +
      '" height="' + clip.height + '" aria-label="' + esc(clip.alt + ' (illustrative)') + '"><source src="' + clip.base + '.webm" type="video/webm"><source src="' + clip.base + '.mp4" type="video/mp4"></video></div><figcaption>' + cap + '</figcaption></figure>';
  }
  function renderPhoto(img, sizes) {
    return '<figure class="photo">' + renderPicture(img, { sizes: sizes }) + '<figcaption>' + esc(img.caption) + ' <a href="#photo-credits">Credit</a></figcaption></figure>';
  }

  /* ---------- JSON-LD ---------- */
  function buildJsonLd(c) {
    var s = c.site, spec = [];
    [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']].forEach(function (d) {
      var h = c.hours[d[0]];
      if (h && !h.closed) spec.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: d[1], opens: h.open, closes: h.close });
    });
    var o = {
      '@context': 'https://schema.org', '@type': 'BarOrPub', name: s.name, url: s.url, image: s.url + 'images/og-image.png',
      address: { '@type': 'PostalAddress', streetAddress: s.address.lines.slice(1).join(', '), addressLocality: s.address.locality, addressRegion: s.address.region, postalCode: s.address.postcode, addressCountry: s.address.country },
      geo: { '@type': 'GeoCoordinates', latitude: s.geo.lat, longitude: s.geo.lon }
    };
    if (has(s.email)) o.email = s.email;
    if (has(s.phone)) o.telephone = s.phone;
    if (spec.length) o.openingHoursSpecification = spec;
    return JSON.stringify(o, null, 2);
  }

  /* All regions, keyed by name. Pass `now` to mock the date in tests. */
  function regions(c, now, example) {
    var board = c.board, isExample = false;
    if (!(board.beers || []).length && example) {
      board = Object.assign({}, board, { beers: board.exampleBeers, coming: board.exampleComing, lastUpdated: board.exampleLastUpdated }); isExample = true;
    }
    return {
      hours: renderHours(c.hours),
      board: renderBoard(board, { example: isExample }),
      events: renderEvents(c, now),
      status: renderStatus(openStatus(c.hours, now)),
      nextEvent: nextEventText(c.events, now),
      contact: renderContact(c),
      menuGroups: renderMenuGroups(c),
      reviews: renderReviews(c),
      badges: renderBadges(c),
      social: renderSocial(c),
      credits: renderCredits(c)
    };
  }

  return {
    DAYS: DAYS, esc: esc, londonNow: londonNow, fmtTime: fmtTime, openStatus: openStatus, renderStatus: renderStatus,
    renderHours: renderHours, upcomingEvents: upcomingEvents, nextEventText: nextEventText, buildIcs: buildIcs, renderEvents: renderEvents,
    parseCsv: parseCsv, boardFromCsv: boardFromCsv, renderBoard: renderBoard, renderContact: renderContact, renderMenuGroups: renderMenuGroups,
    renderReviews: renderReviews, renderBadges: renderBadges, renderSocial: renderSocial, renderCredits: renderCredits,
    renderPicture: renderPicture, renderClip: renderClip, renderPhoto: renderPhoto, buildJsonLd: buildJsonLd, regions: regions, addrOneLine: addrOneLine
  };
});
