/* Wayfinder — geography practice */
(() => {
  'use strict';

  // =====================================================================
  // Helpers
  // =====================================================================
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

  // Question generation uses rand(), which is seeded during the Daily Challenge so everyone gets the same questions.
  let rng = Math.random;
  const rand = () => rng();
  const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  function seeded(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };

  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 99;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  const matchesAny = (value, answers) => {
    const t = norm(value);
    if (!t) return false;
    return answers.map(norm).some(a => a === t || (a.length >= 5 && lev(a, t) <= (a.length >= 9 ? 2 : 1)));
  };

  const fmtPop = n => n == null ? '—' : n >= 1e9 ? (n / 1e9).toFixed(2) + ' billion' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + ' million' : n.toLocaleString('en-US');
  const fmtArea = a => a == null ? '—' : Math.round(a).toLocaleString('en-US') + ' km²';
  const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
  const fmtDur = s => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
  const flagUrl = c => `flags/${c.a2}.svg`;
  const toRad = d => d * Math.PI / 180;
  function haversine([lo1, la1], [lo2, la2]) {
    const dLa = toRad(la2 - la1), dLo = toRad(lo2 - lo1);
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLo / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  const store = {
    get(k, d) { try { const v = localStorage.getItem('wayfinder:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('wayfinder:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
    keys() { try { return Object.keys(localStorage).filter(k => k.startsWith('wayfinder:')); } catch (e) { return []; } },
    clearAll() { try { this.keys().filter(k => k !== 'wayfinder:settings').forEach(k => localStorage.removeItem(k)); } catch (e) { /* ignore */ } }
  };

  const toastQueue = [];
  let toastBusy = false;
  let toastNow = '';
  function toast(msg) {
    if (msg === toastNow || toastQueue.includes(msg)) return;
    toastQueue.push(msg);
    if (!toastBusy) showNextToast();
  }
  function showNextToast() {
    const t = $('#toast'), msg = toastQueue.shift();
    if (!msg) { toastBusy = false; toastNow = ''; t.hidden = true; return; }
    toastBusy = true; toastNow = msg;
    t.textContent = msg; t.hidden = false;
    setTimeout(showNextToast, 2600);
  }

  // =====================================================================
  // Data
  // =====================================================================
  const REGION_NAMES = { AF: 'Africa', AS: 'Asia', EU: 'Europe', NA: 'North America', SA: 'South America', OC: 'Oceania' };
  const REGIONS = ['All', ...Object.values(REGION_NAMES)];
  const FACTS = window.GEO_FACTS || {};
  const CAPS = window.GEO_CAPITALS || {};
  const COUNTRIES = window.GEO_DATA.map(([n, c, r, a2, num, alt]) => {
    const f = FACTS[a2] || {};
    return {
      kind: 'country', n, c, r: REGION_NAMES[r], a2, num, alt: alt || [],
      names: f.names || [], borders: f.b || [], langs: f.l || [], cur: f.cur || [], curS: f.curS || [],
      pop: f.pop, area: f.a, ll: f.ll, land: f.land, cap: CAPS[a2],
      feats: [], els: [], markers: []
    };
  });
  const BY_A2 = new Map(COUNTRIES.map(c => [c.a2, c]));
  COUNTRIES.forEach(c => { c.nb = c.borders.map(a => BY_A2.get(a)).filter(Boolean); });
  const BY_NAME = new Map(COUNTRIES.map(c => [norm(c.n), c]));
  const STATES = (window.US_STATES || []).map(([n, c]) => ({ kind: 'state', n, c, a2: 'us', r: 'United States', alt: [] }));
  const FEATURES = (window.GEO_FEATURES || []).map(f => ({ ...f, kind: 'feature' }));
  const FLAG_COLOURS = window.FLAG_COLOURS || {};
  const FLAG_LAYOUTS = window.FLAG_LAYOUTS || [];
  const LANGS = (window.GEO_LANGS || []).map(l => ({ ...l, kind: 'lang', where: l.w.map(a => BY_A2.get(a)).filter(Boolean) }));
  const RTL = /[֐-ࣿ]/;
  const LANDMARKS = (window.GEO_LANDMARKS || []).map(([n, place, a2, lon, lat]) => ({ kind: 'landmark', n, place, a2, ll: [lon, lat], country: BY_A2.get(a2) })).filter(l => l.country);

  // World Tour: 6 regions × 5 stages, unlocked in order
  const TOUR_REGIONS = ['Europe', 'Africa', 'Asia', 'North America', 'South America', 'Oceania'];
  const TOUR_HUBS = { 'Europe': [10, 50], 'Africa': [20, 3], 'Asia': [95, 33], 'North America': [-100, 45], 'South America': [-60, -15], 'Oceania': [140, -25] };
  const TOUR_STAGES = [
    { name: 'Flags', types: ['flag'] },
    { name: 'Capitals', types: ['capital'] },
    { name: 'On the map', types: ['locate'] },
    { name: 'Shapes & cities', types: ['identify', 'capitalClick', 'country'] },
    { name: 'Final exam', types: ['typeCountry', 'typeCapital', 'locate', 'flagZoom'], hard: true }
  ];
  const TOUR_TOTAL = TOUR_REGIONS.length * TOUR_STAGES.length * 3;

  // Map styles, unlocked by level
  const MAP_STYLES = [
    ['classic', 'Classic', 1, '#cfe0e6', '#efe7d6'],
    ['vintage', 'Vintage parchment', 3, '#d8c49b', '#f1e3c4'],
    ['atlas', 'School atlas', 6, '#9fd0ea', '#cfe5ad'],
    ['night', 'Night satellite', 10, '#050f1e', '#1c2d42'],
    ['neon', 'Neon', 15, '#0b0420', '#1a0b3a'],
    ['gold', 'Gold edition', 20, '#151515', '#2c2617']
  ];

  // Every accepted way of writing each country (ambiguous alternatives are dropped)
  const NAME_INDEX = (() => {
    const m = new Map(BY_NAME), bad = new Set();
    COUNTRIES.forEach(c => c.names.forEach(name => {
      const k = norm(name);
      if (!k || BY_NAME.has(k)) return;
      if (m.has(k) && m.get(k) !== c) bad.add(k); else m.set(k, c);
    }));
    bad.forEach(k => m.delete(k));
    return m;
  })();

  const REGION_BOXES = {
    'Africa': [[-20, -36], [55, 38]],
    'Asia': [[25, -11], [150, 56]],
    'Europe': [[-25, 34], [45, 71]],
    'North America': [[-170, 5], [-50, 75]],
    'South America': [[-85, -56], [-33, 13]],
    'Oceania': [[110, -48], [180, 2]]
  };

  // Countries whose status is debated — the player chooses whether they count
  const OPTIONAL = [
    ['xk', 'Kosovo', 'Recognised by about half of UN members'],
    ['tw', 'Taiwan', 'Self-governing; claimed by China'],
    ['ps', 'Palestine', 'UN observer state'],
    ['va', 'Vatican City', 'UN observer state']
  ];

  // =====================================================================
  // Settings, sound, theme, confetti
  // =====================================================================
  const settings = Object.assign(
    { region: 'All', length: 10, difficulty: 'normal', timer: 0, muted: false, excluded: [], mapStyle: 'classic', theme: document.documentElement.dataset.theme || 'light' },
    store.get('settings', {})
  );
  const saveSettings = () => store.set('settings', settings);

  let ACTIVE = COUNTRIES;
  const isActive = c => c.kind !== 'country' || !settings.excluded.includes(c.a2);
  function refreshActive() { ACTIVE = COUNTRIES.filter(isActive); MapView.applyExcluded(); }

  const ICON = {
    soundOn: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    trophy: '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4v3h-4z"/></svg>'
  };
  function applyTheme() {
    document.documentElement.dataset.theme = settings.theme;
    $('#themeBtn').innerHTML = settings.theme === 'dark' ? ICON.sun : ICON.moon;
    $('#themeBtn').title = settings.theme === 'dark' ? 'Light mode' : 'Dark mode';
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = settings.theme === 'dark' ? '#111a24' : '#f4efe4';
  }
  function applySound() {
    $('#soundBtn').innerHTML = settings.muted ? ICON.soundOff : ICON.soundOn;
    $('#soundBtn').title = settings.muted ? 'Sound off' : 'Sound on';
  }
  $('#themeBtn').onclick = () => { settings.theme = settings.theme === 'dark' ? 'light' : 'dark'; saveSettings(); applyTheme(); if ($('#settings').classList.contains('active')) renderSettings(); };
  $('#soundBtn').onclick = () => { settings.muted = !settings.muted; saveSettings(); applySound(); if (!settings.muted) Sound.play('good'); if ($('#settings').classList.contains('active')) renderSettings(); };
  $('#settingsBtn').innerHTML = ICON.gear;

  const Sound = {
    ctx: null,
    play(kind) {
      if (settings.muted) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const ctx = this.ctx, t = ctx.currentTime;
        const seqs = {
          good: [[660, 0, .09], [880, .08, .14]],
          soft: [[880, 0, .08]],
          bad: [[220, 0, .16], [175, .1, .22]],
          streak: [[523, 0, .1], [659, .08, .1], [784, .16, .1], [1047, .24, .22]],
          done: [[523, 0, .4], [659, .05, .4], [784, .1, .5]],
          tick: [[1200, 0, .03]]
        };
        (seqs[kind] || []).forEach(([f, d, len]) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = kind === 'bad' ? 'sawtooth' : 'triangle';
          o.frequency.value = f;
          const peak = kind === 'bad' ? 0.04 : kind === 'tick' ? 0.03 : 0.11;
          g.gain.setValueAtTime(0.0001, t + d);
          g.gain.exponentialRampToValueAtTime(peak, t + d + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d + len);
          o.connect(g).connect(ctx.destination);
          o.start(t + d); o.stop(t + d + len + 0.03);
        });
      } catch (e) { /* audio not available */ }
    }
  };

  const Confetti = {
    parts: [], running: false,
    burst(n = 140) {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const cv = $('#confetti'), dpr = window.devicePixelRatio || 1;
      cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
      this.ctx = cv.getContext('2d'); this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const colors = ['#e4572e', '#f2b134', '#2a9d6f', '#3b82c4', '#d64045', '#9b6bd6'];
      for (let i = 0; i < n; i++) {
        this.parts.push({
          x: innerWidth / 2 + (Math.random() - .5) * 240, y: innerHeight * .32,
          vx: (Math.random() - .5) * 16, vy: -Math.random() * 15 - 4,
          w: 6 + Math.random() * 6, h: 4 + Math.random() * 5,
          rot: Math.random() * 6, vr: (Math.random() - .5) * .4,
          c: colors[Math.floor(Math.random() * colors.length)]
        });
      }
      if (!this.running) { this.running = true; requestAnimationFrame(() => this.loop()); }
    },
    loop() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      this.parts = this.parts.filter(p => p.y < innerHeight + 30);
      for (const p of this.parts) {
        p.vy += .38; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (this.parts.length) requestAnimationFrame(() => this.loop());
      else { this.running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
    }
  };

  // =====================================================================
  // Progress tracking (mastery per country, used by Smart Practice + Progress page)
  // =====================================================================
  const LEVEL_NAMES = ['Not seen yet', 'Needs work', 'Learning', 'Mastered'];
  const Progress = {
    data: store.get('progress', {}),
    totals: Object.assign({ answered: 0, correct: 0, games: 0 }, store.get('totals', {})),
    record(c, ok) {
      this.totals.answered++;
      if (ok) this.totals.correct++;
      if (c && c.kind === 'country') {
        const s = this.data[c.a2] || (this.data[c.a2] = { s: 0, c: 0, b: 0, t: 0 });
        s.s++;
        if (ok) { s.c++; s.b = Math.min(s.b + 1, 5); } else s.b = 0;
        s.t = Date.now();
        // First time mastered → passport stamp
        if (s.b >= 3 && !s.m) {
          s.m = Date.now();
          setTimeout(() => { toast(`New passport stamp: ${c.n}!`); Sound.play('soft'); }, 400);
        }
      }
      this.save();
    },
    level(c) {
      const s = this.data[c.a2];
      if (!s || !s.s) return 0;
      return s.b >= 3 ? 3 : s.b >= 1 ? 2 : 1;
    },
    weight(c) {
      const s = this.data[c.a2];
      if (!s) return 4;
      const days = (Date.now() - s.t) / 864e5;
      return [9, 3, 2, 1, .5, .3][s.b] * (1 + Math.min(days, 7) / 7);
    },
    save() { store.set('progress', this.data); store.set('totals', this.totals); },
    reset() {
      store.clearAll();
      this.data = {}; this.totals = { answered: 0, correct: 0, games: 0 }; this.save();
      XP.total = 0; Events.data = Events.fresh(); Achievements.got = {}; Tour.reset(); applyMapStyle();
      renderXpPill();
    }
  };
  function weightedSample(list, n, w) {
    return list.map(c => ({ c, k: Math.pow(rand(), 1 / Math.max(w(c), 0.01)) }))
      .sort((a, b) => b.k - a.k).slice(0, n).map(x => x.c);
  }

  // =====================================================================
  // XP, levels, events and achievements
  // =====================================================================
  const TITLES = [[1, 'Tourist'], [3, 'Backpacker'], [5, 'Explorer'], [8, 'Navigator'], [12, 'Voyager'], [16, 'Geographer'], [20, 'Cartographer'], [25, 'Atlas Master'], [30, 'World Wonder']];
  const XP = {
    total: store.get('xp', 0),
    info(xp = this.total) {
      let lvl = 1, need = 100, rest = xp;
      while (rest >= need) { rest -= need; lvl++; need = 100 + (lvl - 1) * 50; }
      return { lvl, into: rest, need };
    },
    title(l) { let t = TITLES[0][1]; for (const [min, name] of TITLES) if (l >= min) t = name; return t; },
    add(n) {
      if (!n) return;
      const before = this.info().lvl;
      this.total += n;
      store.set('xp', this.total);
      const after = this.info().lvl;
      renderXpPill();
      if (after > before) {
        MAP_STYLES.filter(([, , lv]) => lv > before && lv <= after).forEach(([, name]) => toast(`New map style unlocked: ${name} — pick it in Settings`));
        toast(`Level up! You’re now level ${after} — ${this.title(after)}`);
        Sound.play('streak'); Confetti.burst(80);
        Achievements.check();
      }
    }
  };
  function renderXpPill() {
    const { lvl, into, need } = XP.info();
    $('#xpPill').innerHTML = `<b>Lv ${lvl}</b><span>${XP.title(lvl)}</span><i class="xp-bar"><i style="width:${into / need * 100}%"></i></i>`;
    $('#xpPill').title = `${into}/${need} XP to level ${lvl + 1}`;
  }

  const Events = {
    fresh: () => ({ bestStreak: 0, perfect: 0, speedBest: 0, nameBest: 0, nameAll: false, chainPerfect: 0, mystery1: 0, hiloBest: 0, flagPerfect: 0, modes: [], langs: [], bullseye: 0 }),
    data: null,
    max(k, v) { if (v > (this.data[k] || 0)) { this.data[k] = v; this.save(); } },
    inc(k) { this.data[k] = (this.data[k] || 0) + 1; this.save(); },
    set(k, v) { this.data[k] = v; this.save(); },
    addMode(m) { if (!this.data.modes.includes(m)) { this.data.modes.push(m); this.save(); } },
    save() { store.set('events', this.data); }
  };
  Events.data = Object.assign(Events.fresh(), store.get('events', {}));

  const regionMastered = r => { const list = ACTIVE.filter(c => c.r === r); return list.length > 0 && list.every(c => Progress.level(c) === 3); };
  const ACHIEVEMENTS = [
    ['first', 'First steps', 'Answer your first question', x => x.t.answered >= 1],
    ['hundred', 'Century', 'Answer 100 questions', x => x.t.answered >= 100],
    ['thousand', 'Dedicated', 'Answer 1,000 questions', x => x.t.answered >= 1000],
    ['perfect', 'Flawless', 'Get a perfect round of 10 or more questions', x => x.e.perfect >= 1],
    ['streak10', 'On fire', 'Get 10 right in a row', x => x.e.bestStreak >= 10],
    ['streak25', 'Unstoppable', 'Get 25 right in a row', x => x.e.bestStreak >= 25],
    ['m10', 'Getting somewhere', 'Master 10 countries', x => x.mastered >= 10],
    ['m50', 'Globetrotter', 'Master 50 countries', x => x.mastered >= 50],
    ['m100', 'Halfway round', 'Master 100 countries', x => x.mastered >= 100],
    ['mall', 'Atlas', 'Master every country', x => x.mastered >= x.total],
    ['rEU', 'Europe expert', 'Master every country in Europe', () => regionMastered('Europe')],
    ['rAF', 'Africa expert', 'Master every country in Africa', () => regionMastered('Africa')],
    ['rAS', 'Asia expert', 'Master every country in Asia', () => regionMastered('Asia')],
    ['rNA', 'North America expert', 'Master every country in North America', () => regionMastered('North America')],
    ['rSA', 'South America expert', 'Master every country in South America', () => regionMastered('South America')],
    ['rOC', 'Oceania expert', 'Master every country in Oceania', () => regionMastered('Oceania')],
    ['d3', 'Habit forming', 'Reach a 3-day Daily Challenge streak', x => x.dsBest >= 3],
    ['d7', 'Week warrior', 'Reach a 7-day Daily Challenge streak', x => x.dsBest >= 7],
    ['d30', 'Monthly devotion', 'Reach a 30-day Daily Challenge streak', x => x.dsBest >= 30],
    ['speed20', 'Lightning', 'Get 20+ right in one Speed Run', x => x.e.speedBest >= 20],
    ['name100', 'Name dropper', 'Name 100+ countries in Name Them All (World)', x => x.e.nameBest >= 100],
    ['nameall', 'Know-it-all', 'Name every country in Name Them All (World)', x => !!x.e.nameAll],
    ['chain', 'Shortest route', 'Finish a Border Chain in the fewest possible steps', x => x.e.chainPerfect >= 1],
    ['mystery', 'Mind reader', 'Guess a Mystery Country from the very first clue', x => x.e.mystery1 >= 1],
    ['hilo10', 'Higher thinking', 'Reach 10 in a row in Higher or Lower', x => x.e.hiloBest >= 10],
    ['flag', 'Flag painter', 'Paint every flag right in a Flag Builder round of 5+', x => x.e.flagPerfect >= 1],
    ['modes10', 'Well-rounded', 'Play 10 different game modes', x => x.e.modes.length >= 10],
    ['lvl10', 'Seasoned traveller', 'Reach level 10', x => x.level >= 10],
    ['lang25', 'Polyglot', 'Recognise 25 different languages in Language Detective', x => (x.e.langs || []).length >= 25],
    ['langAll', 'Tower of Babel', 'Recognise every language in Language Detective', x => LANGS.length > 0 && new Set(x.e.langs || []).size >= new Set(LANGS.map(l => l.n)).size],
    ['bullseye', 'Bullseye', 'Click within 50 km of a landmark in Landmark Hunt', x => (x.e.bullseye || 0) >= 1],
    ['tour1', 'Bon voyage', 'Finish your first World Tour stage', () => Tour.stars() >= 1],
    ['tourAll', 'Around the world', 'Earn at least one star on every World Tour stage', () => Tour.allDone()],
    ['tour90', 'Five-star traveller', `Earn all ${TOUR_TOTAL} stars in the World Tour`, () => Tour.stars() >= TOUR_TOTAL]
  ];
  const Achievements = {
    got: store.get('achievements', {}),
    check() {
      const ctx = {
        t: Progress.totals, e: Events.data, total: ACTIVE.length,
        mastered: ACTIVE.filter(c => Progress.level(c) === 3).length,
        dsBest: store.get('dailyStreak', { best: 0 }).best || 0,
        level: XP.info().lvl
      };
      const fresh = ACHIEVEMENTS.filter(([id, , , fn]) => !this.got[id] && fn(ctx));
      if (!fresh.length) return;
      fresh.forEach(([id]) => { this.got[id] = Date.now(); });
      store.set('achievements', this.got);
      fresh.forEach(([, title]) => toast(`Achievement unlocked: ${title}`));
      Sound.play('streak');
      XP.add(50 * fresh.length);
    }
  };

  // =====================================================================
  // Map
  // =====================================================================
  // Countries mastered before passports existed get their stamp dated to their last answer
  Object.values(Progress.data).forEach(s => { if (s.b >= 3 && !s.m) s.m = s.t || Date.now(); });

  // ---------- World Tour progress ----------
  const Tour = {
    data: store.get('tour', {}),
    key: (r, i) => `${TOUR_REGIONS[r]}-${i}`,
    starsOf(r, i) { return this.data[this.key(r, i)] || 0; },
    regionStars(r) { return TOUR_STAGES.reduce((a, _, i) => a + this.starsOf(r, i), 0); },
    regionDone(r) { return TOUR_STAGES.every((_, i) => this.starsOf(r, i) >= 1); },
    regionOpen(r) { return r === 0 || this.regionDone(r - 1); },
    stageOpen(r, i) { return this.regionOpen(r) && (i === 0 || this.starsOf(r, i - 1) >= 1); },
    stars() { return Object.values(this.data).reduce((a, b) => a + b, 0); },
    allDone() { return TOUR_REGIONS.every((_, r) => this.regionDone(r)); },
    current() {
      for (let r = 0; r < TOUR_REGIONS.length; r++) for (let i = 0; i < TOUR_STAGES.length; i++) if (this.stageOpen(r, i) && this.starsOf(r, i) === 0) return [r, i];
      return null;
    },
    save(r, i, stars) {
      const k = this.key(r, i), before = this.data[k] || 0;
      if (stars > before) { this.data[k] = stars; store.set('tour', this.data); }
      return before;
    },
    reset() { this.data = {}; }
  };

  const POINTS = { tv: [179.2, -8.52] }; // [lon, lat] for countries the map file has no shape for
  const COARSE = matchMedia('(pointer: coarse)').matches;
  const MARKER_R = COARSE ? 7 : 4;

  const MapView = {
    ready: false, promise: null, onClick: null, onPoint: null, onCapital: null, showNames: false, tipText: null, k: 1,
    W: 960, H: 500,

    load() {
      if (this.promise) return this.promise;
      this.promise = new Promise((resolve, reject) => {
        try {
          if (!window.d3 || !window.topojson || !window.WORLD_TOPO) throw new Error('Map files missing');
          this.build(window.WORLD_TOPO);
          this.ready = true;
          this.applyExcluded();
          $('#mapStatus').hidden = true;
          resolve();
        } catch (err) {
          console.error(err);
          $('#mapStatus').textContent = 'The map files are missing — keep the "lib" folder next to index.html.';
          reject(err);
        }
      });
      this.promise.catch(() => {});
      return this.promise;
    },

    build(topo) {
      const { W, H } = this, self = this;
      const svg = d3.select('#map').append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet');
      this.svg = svg;
      this.projection = d3.geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], { type: 'Sphere' });
      this.path = d3.geoPath(this.projection);
      svg.append('path').attr('class', 'sphere').attr('d', this.path({ type: 'Sphere' }));
      this.g = svg.append('g');
      this.g.append('path').attr('class', 'graticule').attr('d', this.path(d3.geoGraticule10()));

      const feats = topojson.feature(topo, topo.objects.countries).features;
      const byNum = new Map(COUNTRIES.filter(c => c.num).map(c => [c.num, c]));
      const aliases = window.GEO_MAP_ALIASES || {};
      feats.forEach(f => {
        const name = (f.properties && f.properties.name) || '';
        const c = byNum.get(String(f.id)) || BY_NAME.get(norm(aliases[name] || '')) || BY_NAME.get(norm(name));
        if (c) { f.country = c; c.feats.push(f); }
      });

      const hover = sel => sel
        .on('mousemove', (e, d) => this.tip(e, d.country || d))
        .on('mouseleave', () => this.tip(null));
      const click = c => { if (c && isActive(c) && this.onClick) this.onClick(c); };

      this.g.append('g').selectAll('path').data(feats).join('path')
        .attr('class', f => 'country' + (f.country ? '' : ' unknown'))
        .attr('d', this.path)
        .each(function (f) { if (f.country) f.country.els.push(this); })
        .on('click', (e, f) => click(f.country))
        .call(hover);

      // Tiny countries get a clickable circle so they can actually be found
      const tiny = feats.filter(f => f.country && this.path.area(f) < 14 && f.country.feats.length === 1);
      this.markers = this.g.append('g').selectAll('circle').data(tiny).join('circle')
        .attr('class', 'marker')
        .attr('cx', f => this.path.centroid(f)[0]).attr('cy', f => this.path.centroid(f)[1]).attr('r', MARKER_R)
        .each(function (f) { f.country.markers.push(this); })
        .on('click', (e, f) => click(f.country))
        .call(hover);

      // Countries missing from the map file entirely get a circle at their real coordinates
      const pointCountries = COUNTRIES.filter(c => !c.feats.length && POINTS[c.a2]);
      this.pointMarkers = this.g.append('g').selectAll('circle').data(pointCountries).join('circle')
        .attr('class', 'marker').attr('r', MARKER_R)
        .each(function (c) {
          const [x, y] = self.projection(POINTS[c.a2]);
          c.point = [x, y];
          d3.select(this).attr('cx', x).attr('cy', y);
          c.markers.push(this);
        })
        .on('click', (e, c) => click(c))
        .call(hover);

      // Overlay for physical features and click markers
      this.fx = this.g.append('g').attr('class', 'fx-layer');

      // Capital city dots (only shown in Click the Capital)
      this.capDots = this.g.append('g').attr('class', 'cap-layer').selectAll('circle')
        .data(COUNTRIES.filter(c => c.cap)).join('circle')
        .attr('class', 'cap-dot').attr('r', MARKER_R - 1)
        .each(function (c) {
          const [x, y] = self.projection(c.cap);
          c.capXY = [x, y];
          d3.select(this).attr('cx', x).attr('cy', y);
          c.capEl = this;
        })
        .on('click', (e, c) => { e.stopPropagation(); if (this.onCapital) this.onCapital(c); });

      // Clicks anywhere (used by Rivers, Mountains & Seas)
      svg.on('click.point', e => {
        if (!this.onPoint) return;
        const xy = d3.pointer(e, this.g.node());
        const ll = this.projection.invert(xy);
        if (ll && isFinite(ll[0])) this.onPoint(ll, xy);
      });

      this.zoom = d3.zoom()
        .scaleExtent([1, 60]).translateExtent([[0, 0], [W, H]]).clickDistance(6)
        .on('zoom', e => {
          self.k = e.transform.k;
          self.g.attr('transform', e.transform);
          const r = MARKER_R / Math.sqrt(e.transform.k);
          self.markers.attr('r', r); self.pointMarkers.attr('r', r);
          self.capDots.attr('r', (MARKER_R - 1) / Math.sqrt(e.transform.k));
          self.fx.selectAll('circle').attr('r', 5 / Math.sqrt(e.transform.k));
        });
      svg.call(this.zoom).on('dblclick.zoom', null);

      $('#zoomIn').onclick = () => svg.transition().duration(300).call(this.zoom.scaleBy, 1.7);
      $('#zoomOut').onclick = () => svg.transition().duration(300).call(this.zoom.scaleBy, 1 / 1.7);
      $('#zoomReset').onclick = () => this.resetView(this.region || 'All');
    },

    moveTo(slot) { if ($('#mapWrap').parentElement !== slot) slot.appendChild($('#mapWrap')); },

    tip(e, c) {
      const tip = $('#mapTip');
      if (!e || !c || !c.n || !this.showNames) { tip.hidden = true; return; }
      const box = $('#mapWrap').getBoundingClientRect();
      tip.textContent = this.tipText ? this.tipText(c) : c.n;
      tip.style.left = (e.clientX - box.left) + 'px';
      tip.style.top = (e.clientY - box.top) + 'px';
      tip.hidden = false;
    },

    nodes: c => [...(c.els || []), ...(c.markers || [])],
    mark(c, cls) { this.nodes(c).forEach(el => el.classList.add(cls)); },
    unmark(c, cls) { this.nodes(c).forEach(el => el.classList.remove(cls)); },
    pulse(c) { this.nodes(c).forEach(el => { el.classList.remove('pulse'); void el.getBBox(); el.classList.add('pulse'); }); },
    clearMarks() {
      if (!this.g) return;
      this.g.selectAll('.target,.selected,.correct,.wrong,.pulse,.hint').classed('target selected correct wrong pulse hint', false);
      this.clearFx();
    },
    applyExcluded() {
      if (!this.ready) return;
      COUNTRIES.forEach(c => this.nodes(c).forEach(el => el.classList.toggle('excluded', !isActive(c))));
    },
    showMastery() {
      ACTIVE.forEach(c => {
        const lvl = Progress.level(c);
        this.nodes(c).forEach(el => { el.classList.remove('m1', 'm2', 'm3'); if (lvl) el.classList.add('m' + lvl); });
      });
    },
    clearMastery() { if (this.g) this.g.selectAll('.m1,.m2,.m3').classed('m1 m2 m3', false); },

    showCaps(pool) {
      const set = new Set(pool);
      this.svg.classed('show-caps', true);
      this.capDots.classed('off', c => !set.has(c));
    },
    hideCaps() { if (this.svg) this.svg.classed('show-caps', false); },

    clearFx() { if (this.fx) this.fx.selectAll('*').remove(); },
    drawClick(ll) {
      const [x, y] = this.projection(ll);
      this.fx.append('circle').attr('class', 'fx-click').attr('cx', x).attr('cy', y).attr('r', 5 / Math.sqrt(this.k));
    },
    drawFeature(f, ok) {
      const cls = ok ? 'good' : 'bad';
      if (f.t === 'river' || f.t === 'range') {
        this.fx.insert('path', ':first-child').attr('class', `fx-line ${f.t} ${cls}`).attr('d', this.path({ type: 'LineString', coordinates: f.pts }));
      } else {
        f.pts.forEach(p => {
          this.fx.insert('path', ':first-child').attr('class', `fx-zone ${cls}`)
            .attr('d', this.path(d3.geoCircle().center(p).radius(Math.min(f.r, 700) / 111.2)()));
        });
      }
    },
    drawPoint(ll, cls = 'fx-target') {
      const [x, y] = this.projection(ll);
      this.fx.append('circle').attr('class', cls).attr('cx', x).attr('cy', y).attr('r', 5 / Math.sqrt(this.k));
    },
    drawLine(a, b, cls = 'fx-link') {
      this.fx.insert('path', ':first-child').attr('class', cls).attr('d', this.path({ type: 'LineString', coordinates: [a, b] }));
    },
    pointsBounds(lls, pad = 30) {
      const xy = lls.map(p => this.projection(p));
      return [[Math.min(...xy.map(p => p[0])) - pad, Math.min(...xy.map(p => p[1])) - pad], [Math.max(...xy.map(p => p[0])) + pad, Math.max(...xy.map(p => p[1])) + pad]];
    },
    featureBounds(f) {
      const xy = f.pts.map(p => this.projection(p));
      const pad = f.t === 'water' || f.t === 'desert' ? 60 : 25;
      return [[Math.min(...xy.map(p => p[0])) - pad, Math.min(...xy.map(p => p[1])) - pad], [Math.max(...xy.map(p => p[0])) + pad, Math.max(...xy.map(p => p[1])) + pad]];
    },

    // Bounds of a country's main landmass(es), ignoring far-off small territories
    boundsOf(c) {
      if (!c.feats.length && c.point) { const [x, y] = c.point; return [[x - 1, y - 1], [x + 1, y + 1]]; }
      const polys = [];
      c.feats.forEach(f => {
        const g = f.geometry; if (!g) return;
        (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]).forEach(coords => {
          const p = { type: 'Polygon', coordinates: coords };
          polys.push({ p, a: this.path.area(p) });
        });
      });
      if (!polys.length) return null;
      const max = Math.max(...polys.map(x => x.a));
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      polys.filter(x => x.a >= max * 0.2).forEach(({ p }) => {
        const [[a, b], [cc, d]] = this.path.bounds(p);
        x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, cc); y1 = Math.max(y1, d);
      });
      return [[x0, y0], [x1, y1]];
    },
    unionBounds(list) {
      const bs = list.map(c => this.boundsOf(c)).filter(Boolean);
      if (!bs.length) return null;
      return [[Math.min(...bs.map(b => b[0][0])), Math.min(...bs.map(b => b[0][1]))], [Math.max(...bs.map(b => b[1][0])), Math.max(...bs.map(b => b[1][1]))]];
    },
    zoomToBounds(b, maxK = 20, fill = 0.9) {
      if (!b || !this.svg) return;
      const [[x0, y0], [x1, y1]] = b;
      const w = Math.max(x1 - x0, 1), h = Math.max(y1 - y0, 1);
      const k = Math.max(1, Math.min(maxK, fill / Math.max(w / this.W, h / this.H)));
      const t = d3.zoomIdentity.translate(this.W / 2, this.H / 2).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
      this.svg.transition().duration(750).call(this.zoom.transform, t);
    },
    zoomTo(c, maxK = 8) { this.zoomToBounds(this.boundsOf(c), maxK, 0.45); },
    zoomToPoint([x, y], maxK = 6) { this.zoomToBounds([[x - 4, y - 4], [x + 4, y + 4]], maxK, 0.4); },
    resetView(region) {
      if (!this.svg) return;
      this.region = region;
      const box = REGION_BOXES[region];
      if (!box) { this.svg.transition().duration(750).call(this.zoom.transform, d3.zoomIdentity); return; }
      const [[lo0, la0], [lo1, la1]] = box, pts = [];
      for (let i = 0; i <= 8; i++) {
        const lo = lo0 + (lo1 - lo0) * i / 8, la = la0 + (la1 - la0) * i / 8;
        pts.push([lo, la0], [lo, la1], [lo0, la], [lo1, la]);
      }
      const xy = pts.map(p => this.projection(p)).filter(Boolean);
      const xs = xy.map(p => p[0]), ys = xy.map(p => p[1]);
      this.zoomToBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], 20, 0.98);
    },
    // Put the map in a slot and wipe any colouring from a previous screen
    prepare(slot, { names = false, tipText = null, onClick = null } = {}) {
      this.moveTo(slot);
      this.clearMarks(); this.clearMastery(); this.hideCaps();
      this.showNames = names; this.tipText = tipText; this.onClick = onClick;
      this.onPoint = null; this.onCapital = null;
      this.tip(null);
    }
  };

  // =====================================================================
  // Question types and modes
  // =====================================================================
  const onMap = c => c.feats.length > 0 || !!c.point;
  const TYPES = {
    capital: { ok: c => !!c.c },
    country: { ok: c => !!c.c },
    flag: { ok: () => true },
    typeCapital: { ok: c => !!c.c, typed: true },
    typeCountry: { ok: () => true, typed: true },
    locate: { ok: onMap, map: true, noOptions: true },
    identify: { ok: onMap, map: true },
    neighbour: { ok: c => c.nb.length > 0, map: true },
    currency: { ok: c => c.cur.length > 0 },
    language: { ok: c => c.langs.length > 0 },
    state: { ok: () => true },
    capitalClick: { ok: c => !!c.cap, map: true, noOptions: true },
    outline: { ok: c => c.feats.length > 0 },
    feature: { ok: () => true, map: true, noOptions: true },
    hilo: { ok: c => !!(c.pop && c.area), custom: true, noRecord: true },
    mystery: { ok: () => true, typed: true, timer: false },
    chain: { ok: c => c.nb.length > 0, typed: true, map: true, timer: false, noRecord: true },
    flagBuild: { ok: () => true, custom: true, timer: false },
    card: { ok: () => true, custom: true, timer: false },
    langGuess: { ok: () => true, typed: true },
    landmark: { ok: () => true, map: true, noOptions: true, noRecord: true },
    oddOne: { ok: () => true, custom: true, noRecord: true },
    closer: { ok: c => !!c.cap, map: true, custom: true, noRecord: true },
    flagZoom: { ok: () => true }
  };

  const MODES = {
    daily: { group: 'daily', title: 'Daily Challenge', tag: 'Daily', blurb: '10 mixed questions — the same for everyone today.' },
    capitals: { group: 'classic', type: 'capital', title: 'Capital Quiz', tag: 'Multiple choice', blurb: 'See a country, pick its capital from four options.' },
    countries: { group: 'classic', type: 'country', title: 'Capital → Country', tag: 'Multiple choice', blurb: 'Flip it around: see a capital, name the country it belongs to.' },
    flags: { group: 'classic', type: 'flag', title: 'Flag Rush', tag: 'Multiple choice', blurb: 'Recognise the flag, pick the right country.' },
    typing: { group: 'classic', type: 'typeCapital', title: 'Capital Typing', tag: 'Hard', blurb: 'No options. Type the capital from memory — small typos are forgiven.' },
    typeCountry: { group: 'classic', type: 'typeCountry', title: 'Type the Country', tag: 'Hard', blurb: 'See a flag, type the country. No options to lean on.' },
    locate: { group: 'map', type: 'locate', title: 'Find on Map', tag: 'Map', blurb: 'We name a country, you click it on the world map.' },
    identify: { group: 'map', type: 'identify', title: 'Name that Shape', tag: 'Map', blurb: 'A country lights up on the map. Which one is it?' },
    neighbours: { group: 'map', type: 'neighbour', title: 'Neighbours', tag: 'Map', blurb: 'Which of these shares a border with the highlighted country?' },
    capitalClick: { group: 'map', type: 'capitalClick', title: 'Click the Capital', tag: 'Map', blurb: 'Capital cities appear as dots. Click the right one for each country.' },
    nameall: { group: 'map', title: 'Name Them All', tag: 'Sporcle-style', blurb: 'Type every country you can before time runs out. Each one fills in on the map.' },
    chain: { group: 'play', type: 'chain', title: 'Border Chain', tag: 'Puzzle', short: true, blurb: 'Get from one country to another by naming neighbours. Fewest steps wins. 5 routes.' },
    mystery: { group: 'play', type: 'mystery', title: 'Mystery Country', tag: 'Clues', short: true, blurb: 'Clues appear one by one. Guess early for more points. 5 countries.' },
    hilo: { group: 'play', type: 'hilo', title: 'Higher or Lower', tag: 'Endless', endless: true, blurb: 'Bigger or more people? Keep going until you get one wrong.' },
    flagBuild: { group: 'play', type: 'flagBuild', title: 'Flag Builder', tag: 'Paint', allRegions: true, blurb: 'The colours are gone. Paint them back onto the flag.' },
    speed: { group: 'challenge', title: 'Speed Run', tag: '60 seconds', timed: 60, types: ['capital', 'country', 'flag', 'identify'], blurb: 'As many as you can in one minute. Mixed questions, quick reflexes.' },
    smart: { group: 'challenge', title: 'Smart Practice', tag: 'Adaptive', types: ['capital', 'country', 'flag', 'typeCapital', 'typeCountry', 'identify', 'locate', 'outline', 'capitalClick'], blurb: 'Mixes question types and brings back the countries you keep missing until they stick.' },
    currencies: { group: 'topics', type: 'currency', title: 'Currencies', tag: 'Multiple choice', blurb: 'Which money do they use? Euros, pesos, dinars and more.' },
    languages: { group: 'topics', type: 'language', title: 'Languages', tag: 'Multiple choice', blurb: 'Spot an official language of each country.' },
    states: { group: 'topics', type: 'state', title: 'US States', tag: '50 states', allRegions: true, blurb: 'State capitals, both ways round. Ignores the region filter.' },
    tour: { group: 'tour', title: 'World Tour', tag: 'Campaign', blurb: 'Travel the world region by region.' },
    flagZoom: { group: 'classic', type: 'flagZoom', title: 'Flag Zoom', tag: 'Zoom', blurb: 'A flag, zoomed way in. It slowly zooms out — guess early for more points.' },
    landmarks: { group: 'map', type: 'landmark', title: 'Landmark Hunt', tag: 'Map', blurb: 'Click where famous places are — the Eiffel Tower, Machu Picchu, Angkor Wat… Closer means more points.' },
    oddOne: { group: 'play', type: 'oddOne', title: 'Odd One Out', tag: 'Logic', blurb: 'Four countries — one doesn’t belong. Landlocked? Uses the euro? Spot the odd one.' },
    closer: { group: 'play', type: 'closer', title: 'Which Is Closer?', tag: 'Distances', blurb: 'Which capital is closer? Which is further north? Trickier than you think.' },
    passport: { group: 'study', title: 'Passport', tag: 'Stamps', blurb: 'Collect a stamp for every country you master. Fill the whole book.' },
    langDetective: { group: 'topics', type: 'langGuess', title: 'Language Detective', tag: 'Type it', blurb: 'A sentence in its own writing system — Japanese, Arabic, Amharic, Thai… Type which language it is.' },
    features: { group: 'learn', type: 'feature', title: 'Rivers, Mountains & Seas', tag: 'Map', allRegions: true, blurb: 'Find the Nile, the Alps, the Sahara, the Caspian Sea and more on the map.' },
    outline: { group: 'learn', type: 'outline', title: 'Country Outlines', tag: 'Hard', blurb: 'Just the shape — no map around it. Which country is it?' },
    cards: { group: 'learn', type: 'card', title: 'Study Cards', tag: 'Flashcards', blurb: 'Flip through flags and capitals. Mark what you knew — it feeds your progress.' },
    explore: { group: 'study', title: 'Explore', tag: 'Study', blurb: 'Click any country for its capital, flag, population, languages and neighbours.' },
    progress: { group: 'study', title: 'Your Progress', tag: 'Stats', blurb: 'Your world mastery map, accuracy per region and your hardest countries.' },
    profile: { group: 'study', title: 'Achievements', tag: 'Badges', blurb: 'Your level, XP and every badge you can unlock.' }
  };
  const GROUPS = [['classic', 'Classic'], ['map', 'On the map'], ['play', 'Puzzles & games'], ['challenge', 'Challenges'], ['topics', 'More topics'], ['learn', 'Learn more'], ['study', 'Study & stats']];
  const ICONS = {
    daily: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M9.5 15l2 2 3.5-4"/>',
    capitals: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
    countries: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    flags: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/>',
    typing: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M7.5 14h9"/>',
    typeCountry: '<path d="M4 18l4.5-12h1L14 18M5.8 14h6.4M17 9v9M15 9h4"/>',
    locate: '<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1.5"/>',
    identify: '<path d="M4 9l5-5 6 2 5 5-2 6-6 3-6-3z"/><path d="M10.5 10a1.8 1.8 0 1 1 2.4 1.7c-.6.2-.9.6-.9 1.2M12 15.2h.01"/>',
    neighbours: '<path d="M3 6l6-2v14l-6 2zM9 4l6 3v14l-6-3zM15 7l6-2v14l-6 2z"/>',
    capitalClick: '<path d="M12 21s-6-5.4-6-10a6 6 0 0 1 12 0c0 4.6-6 10-6 10z"/><path d="M12 8l.9 1.9 2 .2-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.2z"/>',
    nameall: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="M3.5 6l1 1 1.8-2M3.5 12l1 1 1.8-2M3.5 18l1 1 1.8-2"/>',
    chain: '<circle cx="5" cy="17" r="2.5"/><circle cx="19" cy="7" r="2.5"/><circle cx="12" cy="12" r="2"/><path d="M7 15.5l3.4-2.4M13.7 10.8l3.3-2.3"/>',
    mystery: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M9 9a2 2 0 1 1 2.8 1.8c-.5.2-.8.6-.8 1.2M11 14.5h.01"/>',
    hilo: '<path d="M7 20V5M3.5 8.5L7 5l3.5 3.5M17 4v15M13.5 15.5L17 19l3.5-3.5"/>',
    flagBuild: '<path d="M5 21V4M5 4h12l-2.5 4L17 12H5"/><path d="M15 15l4 4M14 20l1-4 4-1"/>',
    speed: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5l3-3M10 3h4M12 3v3"/>',
    smart: '<path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z"/>',
    currencies: '<circle cx="12" cy="12" r="8.5"/><path d="M15 8.5c-.7-.9-1.8-1.3-3-1.3-1.7 0-3 1-3 2.3 0 3 6 1.6 6 4.6 0 1.3-1.3 2.4-3 2.4-1.3 0-2.5-.5-3.2-1.4M12 5.5v13"/>',
    languages: '<path d="M4 5h16v10H10l-4 4v-4H4z"/><path d="M8 9h8M8 12h5"/>',
    states: '<path d="M3 7l4-2 4 2 4-2 3 1 3-1v11l-3 1-3-1-4 2-4-2-4 2z"/><path d="M12 9.5l.8 1.7 1.9.3-1.4 1.3.3 1.9-1.6-.9-1.6.9.3-1.9-1.4-1.3 1.9-.3z"/>',
    langDetective: '<path d="M3 5h9M7.5 3v2M5 5c.5 3 2.5 5.5 5.5 7M10 5c-.6 3.5-3 6.5-6.5 8"/><path d="M12 21l4.5-10L21 21M13.6 17.5h5.8"/>',
    tour: '<path d="M2 16c3-6 6-9 10-9s6 4 10 2"/><circle cx="2.5" cy="16" r="1.5"/><path d="M19 4l3 2-3 2M22 6h-6"/><circle cx="12" cy="7" r="1.5"/>',
    flagZoom: '<circle cx="10" cy="10" r="6.5"/><path d="M20.5 20.5l-5.8-5.8M7.5 7.5v5M7.5 7.5h5l-1 1.5 1 1.5h-5"/>',
    landmarks: '<path d="M12 2l1.2 4h-2.4zM10.5 6h3l1.5 9h-6zM8 15h8l1.5 6h-11zM10 11h4"/>',
    oddOne: '<circle cx="6" cy="7" r="3"/><circle cx="18" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><rect x="15" y="14" width="6" height="6" rx="1"/>',
    closer: '<circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="1.8"/><circle cx="20" cy="18" r="1.8"/><path d="M5.5 7.2l5 3.5M13.6 13.3l5 3.5" stroke-dasharray="2 2"/>',
    passport: '<rect x="4.5" y="2.5" width="15" height="19" rx="2"/><circle cx="12" cy="10" r="3.5"/><path d="M8.5 10h7M12 6.5c1.3 1 1.3 6 0 7M12 6.5c-1.3 1-1.3 6 0 7M8.5 17h7"/>',
    features: '<path d="M2 19l6-10 4 6 3-4 7 8z"/><path d="M3 22c3-1.5 5 1.5 9 0s6 1.5 9 0"/>',
    outline: '<path d="M6 4l5 2 4-1 4 4-1 5 2 4-5 2-4-2-5 2-2-5 2-4z" stroke-dasharray="2.5 2"/>',
    cards: '<rect x="3" y="6" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/>',
    explore: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    progress: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    profile: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4v3h-4z"/>'
  };
  const FEATURE_ASK = {
    river: 'Click on the river', range: 'Click on the mountain range', peak: 'Click where this mountain is',
    water: 'Click on this sea or ocean', lake: 'Click on the lake', desert: 'Click on the desert', passage: 'Click where this is'
  };
  const FEATURE_KIND = { river: 'River', range: 'Mountain range', peak: 'Mountain', water: 'Sea / ocean', lake: 'Lake', desert: 'Desert', passage: 'Strait, canal or cape' };

  // =====================================================================
  // State & elements
  // =====================================================================
  let game = null;
  let advanceTimer = null, clockTimer = null, qTimer = null, zoomTimer = null;
  const els = {
    hud: $('#hud'), hudQ: $('#hudQ'), hudQLabel: $('#hudQLabel'), hudScore: $('#hudScore'), hudStreak: $('#hudStreak'), hudStreakWrap: $('#hudStreakWrap'),
    quiz: $('#quiz'), progress: $('#progressBar'),
    quizPanel: $('#quizPanel'), explorePanel: $('#explorePanel'), namePanel: $('#namePanel'),
    eyebrow: $('#qEyebrow'), text: $('#qText'), flagFrame: $('#flagFrame'), flag: $('#qFlag'), custom: $('#custom'),
    qTimerBar: $('#qTimer'),
    options: $('#options'), typeForm: $('#typeForm'), typeInput: $('#typeInput'), hintText: $('#hintText'),
    hintBtn: $('#hintBtn'), skipBtn: $('#skipBtn'),
    feedback: $('#feedback'), next: $('#nextBtn'),
    search: $('#searchInput'), infoCard: $('#infoCard')
  };

  function stopQTimer() { clearInterval(qTimer); qTimer = null; els.qTimerBar.hidden = true; }
  function stopTimers() { clearTimeout(advanceTimer); clearInterval(clockTimer); clearInterval(zoomTimer); advanceTimer = clockTimer = zoomTimer = null; stopQTimer(); }
  function showScreen(id, { hud = false } = {}) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    els.hud.hidden = !hud;
    document.body.classList.toggle('in-game', hud);
    window.scrollTo({ top: 0 });
  }
  function setPanel(which) {
    els.quizPanel.hidden = which !== 'quiz';
    els.explorePanel.hidden = which !== 'explore';
    els.namePanel.hidden = which !== 'name';
  }
  const regionPool = () => ACTIVE.filter(c => settings.region === 'All' || c.r === settings.region);
  const regionLabel = r => r === 'All' ? 'World' : r;
  const bestKey = mode => `best:${mode}:${MODES[mode] && (MODES[mode].allRegions || mode === 'daily') ? 'All' : settings.region}`;
  function findCountry(v, pool = ACTIVE) {
    const t = norm(v);
    if (!t) return null;
    const exact = NAME_INDEX.get(t);
    if (exact) return exact;
    if (t.length < 5) return null;
    const close = pool.filter(c => [c.n, ...c.names].some(n => lev(norm(n), t) <= 1));
    return close.length === 1 ? close[0] : null;
  }

  // =====================================================================
  // Home
  // =====================================================================
  function dailyStreak() {
    const ds = store.get('dailyStreak', { last: null, count: 0, best: 0 });
    const alive = ds.last === dayKey() || ds.last === yesterdayKey();
    return { ...ds, count: alive ? ds.count : 0 };
  }

  function bestText(id) {
    if (id === 'explore') return 'No score — just learn';
    if (id === 'progress') return `<b>${ACTIVE.filter(c => Progress.level(c) === 3).length}</b> of ${ACTIVE.length} countries mastered`;
    if (id === 'profile') return `<b>${Object.keys(Achievements.got).length}</b> of ${ACHIEVEMENTS.length} unlocked · level ${XP.info().lvl}`;
    if (id === 'cards') return 'No score — mark what you know';
    if (id === 'passport') return `<b>${ACTIVE.filter(c => Progress.data[c.a2] && Progress.data[c.a2].m).length}</b> of ${ACTIVE.length} stamps collected`;
    const b = store.get(bestKey(id), null);
    if (!b) return 'Not played yet';
    const where = MODES[id].allRegions || settings.region === 'All' ? '' : ` in ${settings.region}`;
    if (id === 'nameall') return `Best${where}: <b>${b.score}/${b.total}</b> named`;
    if (id === 'speed') return `Best${where}: <b>${b.score} pts</b> · ${b.correct} correct`;
    if (id === 'hilo') return `Best${where}: <b>${b.correct} in a row</b>`;
    return `Best${where}: <b>${b.score} pts</b> · ${b.acc}%`;
  }

  const chipRow = (items, current, attr) =>
    items.map(([v, label]) => `<button class="chip ${String(v) === String(current) ? 'on' : ''}" data-${attr}="${v}">${label}</button>`).join('');
  const CHIP_SETS = {
    region: () => [REGIONS.map(r => [r, r]), settings.region],
    length: () => [[[10, '10'], [20, '20'], ['all', 'All']], settings.length],
    difficulty: () => [[['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], settings.difficulty],
    timer: () => [[[0, 'Off'], [20, '20s'], [10, '10s'], [5, '5s']], settings.timer]
  };
  const chips = name => { const [items, cur] = CHIP_SETS[name](); return chipRow(items, cur, name); };

  function handleChip(chip) {
    const d = chip.dataset;
    if (d.region) settings.region = d.region;
    else if (d.length) settings.length = d.length === 'all' ? 'all' : Number(d.length);
    else if (d.difficulty) settings.difficulty = d.difficulty;
    else if (d.timer != null) settings.timer = Number(d.timer);
    else if (d.themeSet) { settings.theme = d.themeSet; applyTheme(); }
    else if (d.soundSet) { settings.muted = d.soundSet === 'off'; applySound(); }
    else return false;
    saveSettings();
    return true;
  }

  function renderHome() {
    $('#regionChips').innerHTML = chips('region');
    $('#lengthChips').innerHTML = chips('length');
    $('#difficultyChips').innerHTML = chips('difficulty');
    $('#timerChips').innerHTML = chips('timer');

    const count = regionPool().length;
    $('#lede').textContent = settings.region === 'All'
      ? `Capitals, flags, borders, rivers and more for all ${count} countries. Pick a mode and go.`
      : `${count} countries in ${settings.region}. Pick a mode and go — or switch region below.`;

    const today = store.get('daily:' + dayKey(), null);
    const ds = dailyStreak();
    const dateTxt = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#dailyCard').innerHTML = `<button class="daily-card" data-mode="daily">
      <span class="mode-icon"><svg viewBox="0 0 24 24">${ICONS.daily}</svg></span>
      <span>
        <span class="daily-title">Daily Challenge</span>
        <span class="daily-sub">${esc(dateTxt)} · 10 mixed questions, the same every time today</span><br>
        ${today ? `<span class="daily-done">Done today: ${today.correct}/10 · ${today.score} pts — replay for fun</span>` : ''}
      </span>
      <span class="daily-side"><b>${ds.count}</b><small>day streak${ds.best > 1 ? ` · best ${ds.best}` : ''}</small></span>
    </button>`;

    const cur = Tour.current();
    $('#dailyCard').insertAdjacentHTML('beforeend', `<button class="daily-card tour-card" data-mode="tour">
      <span class="mode-icon"><svg viewBox="0 0 24 24">${ICONS.tour}</svg></span>
      <span>
        <span class="daily-title">World Tour</span>
        <span class="daily-sub">${cur ? `Next stop: ${TOUR_REGIONS[cur[0]]} · stage ${cur[1] + 1} “${TOUR_STAGES[cur[1]].name}”` : 'Every stage cleared — go back for 3 stars everywhere!'}</span>
      </span>
      <span class="daily-side"><b>${Tour.stars()}</b><small>of ${TOUR_TOTAL} stars</small></span>
    </button>`);

    $('#modeGroups').innerHTML = GROUPS.map(([g, label]) => `
      <div class="group">
        <h3 class="group-title">${label}</h3>
        <div class="modes">${Object.entries(MODES).filter(([, m]) => m.group === g).map(([id, m]) => `
          <button class="mode-card" data-mode="${id}">
            <span class="mode-icon"><svg viewBox="0 0 24 24">${ICONS[id]}</svg></span>
            <span class="mode-tag">${m.tag}</span>
            <span class="mode-title">${m.title}</span>
            <span class="mode-blurb">${m.blurb}</span>
            <span class="mode-best">${bestText(id)}</span>
          </button>`).join('')}
        </div>
      </div>`).join('');
  }

  $('#home').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip) { if (handleChip(chip)) renderHome(); return; }
    const card = e.target.closest('[data-mode]');
    if (card) startGame(card.dataset.mode);
  });

  function goHome() {
    stopTimers();
    rng = Math.random;
    game = null;
    MapView.prepare($('#quizMapSlot'));
    renderHome();
    showScreen('home');
  }
  $('#brandBtn').onclick = goHome;
  $('#quitBtn').onclick = goHome;
  $('#homeBtn').onclick = goHome;
  $('#xpPill').onclick = () => startGame('profile');
  $('#settingsBtn').onclick = () => showSettings();

  // =====================================================================
  // Building questions
  // =====================================================================
  const lenFor = available => settings.length === 'all' ? available : Math.min(settings.length, available);
  const shortLen = available => Math.min(settings.length === 'all' ? 10 : Math.min(settings.length, 5), available);

  function bfs(start) {
    const dist = new Map([[start, 0]]), prev = new Map(), queue = [start];
    while (queue.length) {
      const c = queue.shift();
      for (const n of c.nb) {
        if (!isActive(n) || dist.has(n)) continue;
        dist.set(n, dist.get(c) + 1); prev.set(n, c); queue.push(n);
      }
    }
    return { dist, prev };
  }
  function shortestPath(a, b) {
    const { dist, prev } = bfs(a);
    if (!dist.has(b)) return null;
    const path = [b];
    while (path[0] !== a) path.unshift(prev.get(path[0]));
    return path;
  }
  function makeChain(start) {
    const { dist } = bfs(start);
    const inRegion = c => settings.region === 'All' || c.r === settings.region;
    let ends = [...dist.keys()].filter(c => dist.get(c) >= 3 && dist.get(c) <= 5);
    if (ends.some(inRegion)) ends = ends.filter(inRegion);
    if (!ends.length) ends = [...dist.keys()].filter(c => dist.get(c) >= 2);
    if (!ends.length) return null;
    const end = pick(ends);
    return { c: start, type: 'chain', end, path: shortestPath(start, end) };
  }

  function nextHilo(prev) {
    const pool = regionPool().filter(c => c.pop && c.area);
    const metric = rand() < 0.5 ? 'pop' : 'area';
    const a = prev || pick(pool);
    let b, guard = 0;
    do { b = pick(pool); guard++; } while ((b === a || b[metric] === a[metric]) && guard < 50);
    return { type: 'hilo', a, c: b, metric };
  }

  function buildQuestions(mode) {
    const m = MODES[mode];
    if (mode === 'daily') {
      rng = seeded('wayfinder-' + dayKey());
      const plan = ['capital', 'flag', 'locate', 'country', 'identify', 'currency', 'typeCapital', 'neighbour', 'flag', 'capital'];
      const used = new Set();
      return plan.map(type => {
        const c = pick(ACTIVE.filter(x => TYPES[type].ok(x) && !used.has(x)));
        used.add(c);
        return { c, type };
      });
    }
    if (m.type === 'state') {
      const pool = shuffle(STATES);
      return pool.slice(0, lenFor(pool.length)).map(c => ({ c, type: 'state', rev: rand() < 0.5 }));
    }
    if (m.type === 'feature') {
      const pool = shuffle(FEATURES);
      return pool.slice(0, lenFor(pool.length)).map(c => ({ c, type: 'feature' }));
    }
    if (m.type === 'flagBuild') {
      const pool = shuffle(FLAG_LAYOUTS.map(([a2, type, colors]) => ({ c: BY_A2.get(a2), layout: { type, colors } })).filter(x => x.c && isActive(x.c)));
      return pool.slice(0, lenFor(pool.length)).map(x => ({ ...x, type: 'flagBuild' }));
    }
    if (m.type === 'hilo') return [nextHilo()];
    if (m.type === 'landmark') {
      const pool = shuffle(LANDMARKS.filter(l => isActive(l.country) && (settings.region === 'All' || l.country.r === settings.region)));
      return pool.slice(0, lenFor(pool.length)).map(c => ({ c, type: 'landmark' }));
    }
    if (m.type === 'oddOne' || m.type === 'closer') {
      const make = m.type === 'oddOne' ? makeOddOne : makeCloser;
      const n = settings.length === 'all' ? 30 : settings.length, out = [], seen = new Set();
      for (let guard = 0; out.length < n && guard < 600; guard++) {
        const q = make();
        if (q && !seen.has(q.key) && !out.some(o => o.c === q.c)) { seen.add(q.key); out.push(q); }
      }
      return out;
    }
    if (m.type === 'langGuess') {
      const pool = shuffle(LANGS.filter(l => l.where.some(c => isActive(c) && (settings.region === 'All' || c.r === settings.region))));
      return pool.slice(0, lenFor(pool.length)).map(c => ({ c, type: 'langGuess' }));
    }
    if (mode === 'smart') {
      const base = regionPool();
      return weightedSample(base, lenFor(base.length), c => Progress.weight(c))
        .map(c => ({ c, type: pick(m.types.filter(t => TYPES[t].ok(c))) }));
    }
    if (m.type === 'chain') {
      const starts = shuffle(regionPool().filter(c => c.nb.some(isActive)));
      const out = [];
      for (const s of starts) {
        if (out.length >= shortLen(starts.length)) break;
        const q = makeChain(s);
        if (q && !out.some(o => o.c === q.c || o.end === q.end)) out.push(q);
      }
      return out;
    }
    const pool = shuffle(regionPool().filter(c => TYPES[m.type].ok(c)));
    const n = m.short ? shortLen(pool.length) : lenFor(pool.length);
    if (m.type === 'card') return weightedSample(pool, n, c => Progress.weight(c)).map(c => ({ c, type: 'card' }));
    return pool.slice(0, n).map(c => ({ c, type: m.type }));
  }

  // ---------- Odd One Out ----------
  const listAnd = arr => arr.length > 1 ? `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}` : arr.join('');
  const ODD_PROPS = [
    { id: 'land', test: c => c.land, yes: 'are landlocked', no: 'has a coastline' },
    { id: 'island', test: c => !c.land && c.nb.length === 0, yes: 'are island nations with no land borders', no: 'has land borders' },
    { id: 'euro', test: c => c.cur.includes('Euro'), yes: 'use the euro', no: 'doesn’t use the euro' },
    ...['Spanish', 'French', 'English', 'Arabic', 'Portuguese', 'German', 'Russian'].map(L => ({
      id: 'lang' + L, test: c => c.langs.includes(L), yes: `have ${L} as an official language`, no: `doesn’t have ${L} as an official language`
    })),
    { id: 'big', test: c => c.pop > 1e8, yes: 'have more than 100 million people', no: 'has fewer than 100 million people', needs: c => !!c.pop },
    { id: 'south', test: c => c.cap[1] < 0, yes: 'have their capital in the Southern Hemisphere', no: 'has its capital in the Northern Hemisphere', needs: c => !!c.cap },
    { id: 'region', region: true },
    { id: 'border', border: true }
  ];
  function makeOddOne() {
    const base = regionPool();
    const P = pick(ODD_PROPS.filter(p => !(p.region && settings.region !== 'All')));
    let test, yes, no, hub = null, pool = base;
    if (P.region) {
      const r = pick(REGIONS.slice(1));
      test = c => c.r === r; yes = `are in ${r}`; pool = ACTIVE;
    } else if (P.border) {
      hub = pick(base.filter(c => c.nb.filter(isActive).length >= 4));
      if (!hub) return null;
      test = c => hub.nb.includes(c); yes = `border ${hub.n}`; no = `doesn’t border ${hub.n}`;
      pool = ACTIVE.filter(c => c !== hub && (c.r === hub.r || hub.nb.includes(c)));
    } else { test = P.test; yes = P.yes; no = P.no; }
    if (P.needs) pool = pool.filter(P.needs);
    const T = pool.filter(test), F = pool.filter(c => !test(c));
    if (T.length < 3 || !F.length) return null;
    const three = shuffle(T).slice(0, 3);
    let Fp = F;
    if (P.border) { const near = F.filter(c => c.nb.some(x => hub.nb.includes(x))); if (near.length) Fp = near; }
    else if (settings.difficulty !== 'easy' && !P.region) { const regs = new Set(three.map(c => c.r)); const same = F.filter(c => regs.has(c.r)); if (same.length) Fp = same; }
    const odd = pick(Fp);
    return {
      type: 'oddOne', c: odd, group: shuffle([...three, odd]), key: P.id + odd.a2,
      explain: `${listAnd(three.map(c => c.n))} ${yes} — ${odd.n} ${P.region ? `is in ${odd.r}` : no}.`
    };
  }

  // ---------- Which Is Closer? ----------
  const fmtLat = c => `${Math.abs(c.cap[1]).toFixed(1)}°${c.cap[1] >= 0 ? 'N' : 'S'}`;
  function makeCloser() {
    const base = regionPool().filter(c => c.cap);
    if (rand() < 0.55) {
      const ref = pick(base);
      if (!ref) return null;
      const cands = shuffle((settings.region === 'All' ? ACTIVE : base).filter(c => c.cap && c !== ref))
        .map(c => ({ c, d: haversine(ref.cap, c.cap) })).filter(x => x.d < 7000);
      for (let i = 0; i < cands.length - 1; i++) {
        for (let j = i + 1; j < Math.min(cands.length, i + 8); j++) {
          const A = cands[i], B = cands[j], ratio = Math.min(A.d, B.d) / Math.max(A.d, B.d);
          if (ratio > 0.4 && ratio < 0.85) {
            const near = A.d < B.d ? A : B;
            return { type: 'closer', kind: 'dist', ref, a: A.c, b: B.c, c: near.c, da: A.d, db: B.d, key: 'd' + ref.a2 + [A.c.a2, B.c.a2].sort().join('') };
          }
        }
      }
      return null;
    }
    const a = pick(base);
    if (!a) return null;
    const b = pick((settings.region === 'All' ? ACTIVE : base).filter(c => c.cap && c !== a && Math.abs(c.cap[1] - a.cap[1]) >= 1.5 && Math.abs(c.cap[1] - a.cap[1]) <= 12));
    if (!b) return null;
    return { type: 'closer', kind: 'north', a, b, c: a.cap[1] > b.cap[1] ? a : b, key: 'n' + [a.a2, b.a2].sort().join('') };
  }

  function nextTimedQuestion() {
    const recent = new Set(game.questions.slice(-25).map(q => q.c));
    const type = pick(MODES[game.mode].types);
    let cands = regionPool().filter(c => TYPES[type].ok(c) && !recent.has(c));
    if (!cands.length) cands = regionPool().filter(c => TYPES[type].ok(c));
    return { c: pick(cands), type };
  }

  // Order wrong-answer candidates by difficulty: easy = far away, hard = close neighbours
  function orderByDifficulty(target, cands, diff) {
    const same = cands.filter(x => x.r === target.r), other = cands.filter(x => x.r !== target.r);
    if (diff === 'easy') return [...shuffle(other), ...shuffle(same)];
    if (diff === 'hard') {
      const near = new Set();
      (target.nb || []).forEach(n => { near.add(n); n.nb.forEach(x => near.add(x)); });
      const close = cands.filter(x => near.has(x));
      return [...shuffle(close), ...shuffle(same.filter(x => !near.has(x))), ...shuffle(other)];
    }
    const s = shuffle(same), o = shuffle(other), out = [];
    while (s.length || o.length) { if (s.length) out.push(s.shift()); if (s.length) out.push(s.shift()); if (o.length) out.push(o.shift()); }
    return out;
  }

  function makeOptions(q) {
    const { c, type } = q;
    let correct, cands, label, exclude = [];
    switch (type) {
      case 'capital': correct = c.c; cands = ACTIVE.filter(x => x !== c && x.c); label = x => x.c; break;
      case 'country': case 'flag': case 'identify': case 'outline': case 'flagZoom':
        correct = c.n; cands = ACTIVE.filter(x => x !== c); label = x => x.n; break;
      case 'neighbour':
        q.answer = q.answer || pick(c.nb.filter(isActive));
        correct = q.answer.n; cands = ACTIVE.filter(x => x !== c && !c.nb.includes(x)); label = x => x.n; break;
      case 'currency':
        correct = c.cur[0]; exclude = c.cur.map(norm);
        cands = ACTIVE.filter(x => x !== c && x.cur.length); label = x => x.cur.find(k => !exclude.includes(norm(k))); break;
      case 'language':
        q.answer = q.answer || pick(c.langs);
        correct = q.answer; exclude = c.langs.map(norm);
        cands = ACTIVE.filter(x => x !== c && x.langs.length); label = x => x.langs.find(k => !exclude.includes(norm(k))); break;
      case 'state':
        correct = q.rev ? c.n : c.c; cands = STATES.filter(x => x !== c); label = x => q.rev ? x.n : x.c; break;
    }
    const ordered = c.kind === 'state' ? shuffle(cands) : orderByDifficulty(c, cands, game.difficulty);
    const seen = new Set([norm(correct), ...exclude]), wrong = [];
    for (const x of ordered) {
      if (wrong.length >= 3) break;
      const l = label(x);
      if (!l || seen.has(norm(l))) continue;
      seen.add(norm(l)); wrong.push(l);
    }
    return { correct, options: shuffle([correct, ...wrong]) };
  }

  // =====================================================================
  // Game flow
  // =====================================================================
  async function startGame(mode, preset) {
    stopTimers();
    rng = Math.random;
    if (mode === 'explore') return startExplore();
    if (mode === 'progress') return showProgress();
    if (mode === 'profile') return showProfile();
    if (mode === 'nameall') return startNameAll();
    if (mode === 'passport') return showPassport();
    if (mode === 'tour' && !preset) return showTour();
    try { await MapView.load(); } catch (e) { /* map-free modes still work */ }

    const m = MODES[mode];
    const tour = preset && preset.tour ? preset.tour : null;
    const timed = !preset && m.timed ? m.timed : 0;
    const questions = preset ? preset.questions : timed ? [] : buildQuestions(mode);
    game = {
      mode, questions, i: 0, score: 0, streak: 0, bestStreak: 0, correct: 0, answered: false, mistakes: [],
      start: Date.now(), practice: !!preset && !tour, tour, timed, endless: !preset && !!m.endless,
      difficulty: mode === 'daily' ? 'normal' : tour ? (TOUR_STAGES[tour.i].hard ? 'hard' : 'normal') : settings.difficulty,
      daily: mode === 'daily' && !preset && !store.get('daily:' + dayKey())
    };
    if (timed) {
      game.endAt = Date.now() + timed * 1000;
      game.questions.push(nextTimedQuestion());
      clockTimer = setInterval(tickClock, 200);
    }
    if (!game.questions.length) { toast('No questions available for this selection.'); game = null; return; }

    Progress.totals.games++; Progress.save();
    MapView.prepare($('#quizMapSlot'));
    MapView.resetView(tour ? TOUR_REGIONS[tour.r] : m.allRegions || mode === 'daily' ? 'All' : settings.region);
    setPanel('quiz');
    els.quiz.dataset.bar = timed || game.endless ? 'off' : 'on';
    showScreen('quiz', { hud: true });
    renderQuestion();
  }

  function tickClock() {
    if (!game || !game.timed) return;
    const left = (game.endAt - Date.now()) / 1000;
    els.hudQ.textContent = fmtTime(Math.ceil(left));
    els.hudQ.parentElement.classList.toggle('urgent', left <= 10);
    if (left <= 0) finish();
  }

  const current = () => game.questions[game.i];

  function updateHud() {
    if (game.timed) {
      els.hudQLabel.textContent = 'time left';
      tickClock();
    } else if (game.endless) {
      els.hudQLabel.textContent = 'round';
      els.hudQ.parentElement.classList.remove('urgent');
      els.hudQ.textContent = `#${game.i + 1}`;
    } else {
      els.hudQLabel.textContent = 'question';
      els.hudQ.parentElement.classList.remove('urgent');
      els.hudQ.textContent = `${Math.min(game.i + 1, game.questions.length)}/${game.questions.length}`;
      els.progress.style.width = `${(game.i + (game.answered ? 1 : 0)) / game.questions.length * 100}%`;
    }
    els.hudScore.textContent = game.score;
    els.hudStreak.textContent = game.streak;
    els.hudStreakWrap.classList.toggle('hot', game.streak >= 3);
  }

  function renderQuestion() {
    const q = current(), c = q.c, T = TYPES[q.type];
    game.answered = false; game.hints = 0;
    delete q.basePts;
    clearInterval(zoomTimer);
    stopQTimer();
    updateHud();
    els.quiz.dataset.map = String(!!T.map);
    els.feedback.innerHTML = ''; els.feedback.className = 'feedback';
    els.next.hidden = true;
    els.options.innerHTML = '';
    els.custom.innerHTML = ''; els.custom.hidden = true;
    els.typeForm.hidden = true;
    els.flagFrame.hidden = true;
    els.text.textContent = '';
    els.hintBtn.textContent = 'Hint'; els.skipBtn.textContent = 'I don’t know';
    MapView.clearMarks();
    MapView.hideCaps();
    MapView.onClick = null; MapView.onPoint = null; MapView.onCapital = null;

    const showFlag = () => { els.flagFrame.hidden = false; els.flag.src = flagUrl(c); };
    const ask = (eyebrow, text) => { els.eyebrow.textContent = eyebrow; els.text.textContent = text || ''; };
    const custom = html => { els.custom.innerHTML = html; els.custom.hidden = false; };
    const typed = placeholder => {
      els.typeForm.hidden = false;
      els.typeInput.value = ''; els.typeInput.className = ''; els.typeInput.disabled = false;
      els.typeInput.placeholder = placeholder;
      els.hintText.textContent = '';
      if (!COARSE) setTimeout(() => els.typeInput.focus(), 50);
    };

    switch (q.type) {
      case 'capital': ask('What is the capital of', c.n + '?'); break;
      case 'country': ask('Which country has this capital?', c.c); break;
      case 'flag': ask('Whose flag is this?'); showFlag(); break;
      case 'typeCapital': ask('Type the capital of', c.n); typed('Type the capital…'); break;
      case 'typeCountry': ask('Type the country this flag belongs to'); showFlag(); typed('Type the country…'); break;
      case 'locate':
        ask('Find on the map', c.n);
        MapView.resetView(MapView.region || 'All');
        MapView.onClick = answerMap;
        break;
      case 'identify': ask('Which country is highlighted?'); MapView.mark(c, 'target'); MapView.zoomTo(c, 6); break;
      case 'neighbour': ask('Which country shares a border with', c.n + '?'); MapView.mark(c, 'target'); MapView.zoomTo(c, 4); break;
      case 'currency': ask('Which currency is used in', c.n + '?'); break;
      case 'language': ask('Which is an official language of', c.n + '?'); break;
      case 'state': q.rev ? ask('Which US state has the capital', c.c + '?') : ask('What is the capital of the US state', c.n + '?'); break;
      case 'capitalClick':
        ask('Click the capital city of', c.n);
        MapView.resetView(MapView.region || 'All');
        MapView.showCaps(game.tour ? ACTIVE.filter(x => x.r === TOUR_REGIONS[game.tour.r]) : game.mode === 'capitalClick' ? regionPool() : ACTIVE);
        MapView.onCapital = answerCapital;
        break;
      case 'outline': ask('Which country has this shape?'); custom(`<div class="outline-frame">${outlineSvg(c)}</div>`); break;
      case 'feature':
        ask(FEATURE_ASK[c.t] || 'Find', c.n);
        MapView.resetView('All');
        MapView.onPoint = answerFeature;
        break;
      case 'hilo': renderHilo(q); break;
      case 'mystery': renderMystery(q); typed('Guess the country…'); els.hintBtn.textContent = 'Next clue'; els.skipBtn.textContent = 'Give up'; break;
      case 'chain':
        renderChainStart(q);
        typed(`Type a country that borders ${c.n}…`);
        els.hintBtn.textContent = 'Show a step'; els.skipBtn.textContent = 'Give up';
        break;
      case 'flagBuild': renderFlagBuild(q); break;
      case 'card': renderCard(q); break;
      case 'landmark':
        ask('Click on the map: where is', c.n + '?');
        MapView.resetView(MapView.region || 'All');
        MapView.onPoint = answerLandmark;
        break;
      case 'oddOne':
        ask('Which one is the odd one out?');
        renderOptions(q, { correct: c.n, options: q.group.map(x => x.n) });
        break;
      case 'closer': {
        const lab = x => `${x.c} (${x.n})`;
        if (q.kind === 'dist') { ask('Which capital is closer to', `${q.ref.c}?`); MapView.drawPoint(q.ref.cap, 'fx-target'); }
        else ask('Which capital is further north?');
        els.custom.hidden = false;
        els.custom.innerHTML = q.kind === 'dist' ? `<p class="clue-meta">${esc(q.ref.c)} is the capital of ${esc(q.ref.n)}. Distances are measured in a straight line.</p>` : '<p class="clue-meta">Compare where the two capital cities lie.</p>';
        renderOptions(q, { correct: lab(c), options: shuffle([lab(q.a), lab(q.b)]) });
        break;
      }
      case 'flagZoom':
        ask('Whose flag is this?');
        q.step = 0;
        q.origin = q.origin || [18 + Math.random() * 64, 18 + Math.random() * 64];
        custom(`<div class="zoom-frame"><img id="zoomImg" src="${flagUrl(c)}" alt="Zoomed-in flag" style="transform-origin:${q.origin[0]}% ${q.origin[1]}%;transform:scale(${ZOOM_STEPS[0]})"></div>
          <div class="zoom-bar"><span id="zoomPts">Worth ${ZOOM_PTS[0]} points</span><button type="button" class="btn small" id="zoomOutBtn">Zoom out</button></div>`);
        $('#zoomOutBtn').onclick = () => zoomStep(q);
        zoomTimer = setInterval(() => zoomStep(q), 3500);
        break;
      case 'langGuess':
        ask('Which language is this?');
        custom(`<p class="lang-text" dir="${RTL.test(c.t) ? 'rtl' : 'ltr'}" lang="${esc(c.tag || '')}">${esc(c.t)}</p>
          ${c.tag && 'speechSynthesis' in window ? '<div class="lang-tools"><button type="button" class="btn" id="listenBtn">🔊 Listen</button></div>' : ''}`);
        typed('Type the language…');
        q.hintLines = [];
        { const lb = $('#listenBtn'); if (lb) lb.onclick = () => speakLang(c); }
        break;
    }
    if (!T.typed && !T.noOptions && !T.custom) renderOptions(q);
    startQTimer(q);
  }

  // ---------- per-question timer ----------
  function startQTimer(q) {
    if (!settings.timer || game.timed || TYPES[q.type].timer === false) return;
    const total = settings.timer * 1000;
    game.qEnd = Date.now() + total;
    els.qTimerBar.hidden = false;
    const fill = els.qTimerBar.firstElementChild;
    const tick = () => {
      const left = game.qEnd - Date.now();
      fill.style.width = `${Math.max(0, left / total * 100)}%`;
      els.qTimerBar.classList.toggle('urgent', left < 3000);
      if (left <= 0) { stopQTimer(); timeUp(); }
    };
    tick();
    qTimer = setInterval(tick, 80);
  }
  function expectedFor(q) {
    if (q.correctLabel) return q.correctLabel;
    if (q.type === 'typeCapital' || q.type === 'capitalClick') return q.c.c;
    return q.c.n;
  }
  function timeUp() {
    if (!game || game.answered) return;
    const q = current();
    $$('.option', els.options).forEach(b => { b.disabled = true; b.classList.add(b.dataset.right ? 'correct' : 'faded'); });
    els.typeInput.disabled = true;
    if (q.type === 'locate' || q.type === 'identify') { MapView.unmark(q.c, 'target'); MapView.mark(q.c, 'correct'); MapView.zoomTo(q.c, 6); }
    if (q.type === 'capitalClick') { q.c.capEl.classList.add('correct'); MapView.zoomToPoint(q.c.capXY); }
    if (q.type === 'feature') { MapView.drawFeature(q.c, true); MapView.zoomToBounds(MapView.featureBounds(q.c), 6, 0.7); }
    if (q.type === 'hilo') revealHilo(q);
    if (q.type === 'landmark') { MapView.drawPoint(q.c.ll, 'fx-target'); MapView.zoomToBounds(MapView.pointsBounds([q.c.ll], 40), 6, 0.6); }
    if (q.type === 'closer') drawCloser(q);
    if (q.type === 'flagZoom') zoomStep(q, true);
    resolve(false, '', expectedFor(q), 'Time’s up!');
  }

  // ---------- multiple choice ----------
  function renderOptions(q, preset) {
    const { correct, options } = preset || makeOptions(q);
    q.correctLabel = correct;
    options.forEach((label, i) => {
      const b = document.createElement('button');
      b.className = 'option';
      b.innerHTML = `<kbd>${i + 1}</kbd><span>${esc(label)}</span>`;
      b.dataset.right = label === correct ? '1' : '';
      b.onclick = () => answerChoice(label, b);
      els.options.append(b);
    });
  }

  function answerChoice(label, btn) {
    if (!game || game.answered) return;
    const q = current();
    const ok = label === q.correctLabel;
    $$('.option', els.options).forEach(b => {
      b.disabled = true;
      if (b.dataset.right) b.classList.add('correct');
      else if (b !== btn) b.classList.add('faded');
    });
    if (!ok) btn.classList.add('wrong');
    if (q.type === 'identify') { MapView.unmark(q.c, 'target'); MapView.mark(q.c, ok ? 'correct' : 'wrong'); }
    let extra = '';
    if (q.type === 'neighbour') {
      q.c.nb.forEach(n => MapView.mark(n, 'hint'));
      MapView.mark(q.answer, 'correct');
      const picked = BY_NAME.get(norm(label));
      if (!ok && picked) MapView.mark(picked, 'wrong');
      extra = `${q.c.n} borders: ${q.c.nb.map(n => n.n).join(', ')}.`;
    }
    if (q.type === 'language' && q.c.langs.length > 1) extra = `Official languages: ${q.c.langs.join(', ')}.`;
    if (q.type === 'currency' && q.c.cur.length > 1) extra = `Currencies used: ${q.c.cur.join(', ')}.`;
    if (q.type === 'hilo') { revealHilo(q); extra = hiloExtra(q); }
    if (q.type === 'oddOne') extra = q.explain;
    if (q.type === 'closer') { drawCloser(q); extra = closerExplain(q); }
    if (q.type === 'flagZoom') { if (ok) q.basePts = ZOOM_PTS[q.step]; zoomStep(q, true); }
    if (q.type === 'card') { resolve(ok, '', q.c.n); return; }
    resolve(ok, label, q.correctLabel, extra);
  }

  // ---------- map answers ----------
  function answerMap(c) {
    if (!game || game.answered) return;
    const q = current(), ok = c === q.c;
    if (ok) MapView.mark(q.c, 'correct');
    else { MapView.mark(c, 'wrong'); MapView.mark(q.c, 'correct'); MapView.pulse(q.c); MapView.zoomTo(q.c, 6); }
    resolve(ok, c.n, q.c.n, ok ? '' : `You clicked ${c.n}. ${q.c.n} is shown in green.`);
  }

  function answerCapital(p) {
    if (!game || game.answered) return;
    const q = current(), ok = p === q.c;
    q.c.capEl.classList.add('correct');
    if (!ok) { p.capEl.classList.add('wrong'); MapView.zoomToPoint(q.c.capXY); }
    resolve(ok, p.c, q.c.c, ok ? '' : `You clicked ${p.c}, the capital of ${p.n}. ${q.c.c} is shown in green.`);
  }

  function featureDistance(f, ll) {
    let pts = f.pts;
    if ((f.t === 'river' || f.t === 'range') && pts.length > 1) {
      const dense = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [a, b] = [pts[i], pts[i + 1]];
        const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.4));
        for (let s = 0; s < steps; s++) dense.push([a[0] + (b[0] - a[0]) * s / steps, a[1] + (b[1] - a[1]) * s / steps]);
      }
      dense.push(pts[pts.length - 1]);
      pts = dense;
    }
    return Math.min(...pts.map(p => haversine(p, ll)));
  }
  function answerFeature(ll) {
    if (!game || game.answered) return;
    const q = current(), f = q.c;
    const dist = featureDistance(f, ll), km = Math.round(dist / 10) * 10;
    const ok = dist <= f.r;
    MapView.drawFeature(f, ok);
    MapView.drawClick(ll);
    if (f.t !== 'water' || !ok) MapView.zoomToBounds(MapView.featureBounds(f), 6, 0.7);
    resolve(ok, ok ? '' : `${km.toLocaleString('en-US')} km away`, f.n,
      ok ? (dist < 60 ? 'Right on it!' : `About ${km.toLocaleString('en-US')} km off — close enough.`) : `You were about ${km.toLocaleString('en-US')} km away. It’s shown on the map.`);
  }

  // ---------- country outlines ----------
  function outlineSvg(c) {
    const polys = [];
    c.feats.forEach(f => {
      const g = f.geometry; if (!g) return;
      (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]).forEach(co => polys.push({ co, a: d3.geoArea({ type: 'Polygon', coordinates: co }) }));
    });
    const max = Math.max(...polys.map(p => p.a));
    const geo = { type: 'MultiPolygon', coordinates: polys.filter(p => p.a >= max * 0.12).map(p => p.co) };
    const [lon, lat] = d3.geoCentroid(geo);
    const proj = d3.geoAzimuthalEqualArea().rotate([-lon, -lat]).fitExtent([[14, 14], [286, 206]], geo);
    return `<svg viewBox="0 0 300 220" class="outline-svg" role="img" aria-label="Country outline"><path d="${d3.geoPath(proj)(geo)}"/></svg>`;
  }

  // ---------- higher or lower ----------
  const hiloVal = (c, metric) => metric === 'pop' ? `~${fmtPop(c.pop)}` : fmtArea(c.area);
  function renderHilo(q) {
    const { a, c, metric } = q;
    const unit = metric === 'pop' ? 'people' : 'in area';
    els.eyebrow.textContent = metric === 'pop' ? 'More or fewer people?' : 'Bigger or smaller?';
    els.text.textContent = '';
    els.custom.hidden = false;
    els.custom.innerHTML = `<div class="hilo">
      <div class="hilo-card"><img src="${flagUrl(a)}" alt=""><b>${esc(a.n)}</b><span class="hilo-val">${hiloVal(a, metric)}</span><small>${unit}</small></div>
      <div class="hilo-vs">vs</div>
      <div class="hilo-card mystery-card"><img src="${flagUrl(c)}" alt=""><b>${esc(c.n)}</b><span class="hilo-val" id="hiloB">?</span><small>${unit}</small></div>
    </div>`;
    const labels = metric === 'pop' ? [`${c.n} has more`, `${c.n} has fewer`] : [`${c.n} is bigger`, `${c.n} is smaller`];
    renderOptions(q, { correct: c[metric] > a[metric] ? labels[0] : labels[1], options: labels });
  }
  function revealHilo(q) { const el = $('#hiloB'); if (el) el.textContent = hiloVal(q.c, q.metric); }
  function hiloExtra(q) {
    const big = q.c[q.metric] >= q.a[q.metric] ? q.c : q.a, small = big === q.c ? q.a : q.c;
    const r = big[q.metric] / small[q.metric];
    const amount = r >= 1.95 ? `about ${r.toFixed(r >= 10 ? 0 : 1)} times` : `about ${Math.max(1, Math.round((r - 1) * 100))}%`;
    return q.metric === 'pop'
      ? `${big.n} has ${amount} ${r >= 1.95 ? 'as many people as' : 'more people than'} ${small.n}.`
      : `${big.n} is ${amount} ${r >= 1.95 ? 'the size of' : 'bigger than'} ${small.n}.`;
  }

  // ---------- mystery country ----------
  function mysteryClues(c) {
    const cl = [`It’s in ${c.r}.`];
    cl.push(c.land ? 'It’s landlocked — no coastline at all.' : c.nb.length ? 'It has a coastline.' : 'It’s an island nation with no land borders.');
    if (c.pop) cl.push(c.pop < 1e6 ? 'Fewer than 1 million people live there.' : c.pop < 1e7 ? 'Between 1 and 10 million people live there.' : c.pop < 5e7 ? 'Between 10 and 50 million people live there.' : c.pop < 1e8 ? 'Between 50 and 100 million people live there.' : 'More than 100 million people live there.');
    cl.push(c.nb.length ? `It borders ${c.nb.length} ${c.nb.length === 1 ? 'country' : 'countries'}.` : `Its area is about ${fmtArea(Number(c.area.toPrecision(2)))}.`);
    cl.push(`Its capital starts with “${c.c[0]}” and has ${c.c.replace(/[^\p{L}]/gu, '').length} letters.`);
    if (c.langs.length) cl.push(`An official language is ${c.langs[0]}.`);
    if (c.cur.length) cl.push(`People pay with the ${c.cur[0]}.`);
    if (c.nb.length) cl.push(`One of its neighbours is ${pick(c.nb).n}.`);
    cl.push('FLAG');
    return cl;
  }
  function renderMystery(q) {
    q.clues = mysteryClues(q.c); q.shown = 1; q.guesses = [];
    els.eyebrow.textContent = 'Mystery country';
    els.text.textContent = 'Which country is it?';
    els.custom.hidden = false;
    drawClues(q);
  }
  const mysteryPoints = q => Math.max(100, 800 - 100 * (q.shown - 1));
  function drawClues(q) {
    els.custom.innerHTML = `<ol class="clues">${q.clues.slice(0, q.shown).map(t => t === 'FLAG'
      ? `<li class="clue-flag"><span>Its flag:</span><img src="${flagUrl(q.c)}" alt="Flag clue"></li>`
      : `<li>${esc(t)}</li>`).join('')}</ol>
      <p class="clue-meta">Clue ${q.shown} of ${q.clues.length}${game.answered ? '' : ` · worth ${mysteryPoints(q)} points`}${q.guesses.length ? ` · not ${q.guesses.map(esc).join(', not ')}` : ''}</p>`;
  }
  function mysteryNextClue(q) {
    if (q.shown >= q.clues.length) return false;
    q.shown++; drawClues(q);
    return true;
  }
  function mysteryGuess(q, v) {
    const guessed = findCountry(v);
    const ok = guessed === q.c || matchesAny(v, [q.c.n, ...q.c.names]);
    if (ok) {
      const used = q.shown;
      q.basePts = mysteryPoints(q);
      if (used === 1) Events.inc('mystery1');
      els.typeInput.classList.add('correct'); els.typeInput.disabled = true;
      resolve(true, v, q.c.n, `Guessed with ${used === 1 ? 'just one clue' : `${used} clues`}.`);
      q.shown = q.clues.length; drawClues(q);
      return;
    }
    q.guesses.push(guessed ? guessed.n : v);
    els.typeInput.value = '';
    shakeInput();
    if (!mysteryNextClue(q)) {
      els.typeInput.disabled = true;
      resolve(false, v, q.c.n);
    } else els.hintText.textContent = `Not ${guessed ? guessed.n : v} — here’s another clue.`;
  }

  // ---------- border chain ----------
  function renderChainStart(q) {
    q.chain = [q.c]; q.wrong = 0;
    els.eyebrow.textContent = 'Border chain';
    els.text.textContent = '';
    els.custom.hidden = false;
    drawChain(q);
    MapView.mark(q.c, 'target');
    MapView.mark(q.end, 'selected');
    MapView.zoomToBounds(MapView.unionBounds(q.path), 6, 0.8);
    MapView.onClick = c => chainTry(c);
  }
  function drawChain(q) {
    const opt = q.path.length - 1;
    els.custom.innerHTML = `<div class="chain">
      <div class="chain-goal"><span class="chip-c start">${esc(q.c.n)}</span><span class="chain-arrow">to</span><span class="chip-c end">${esc(q.end.n)}</span></div>
      <p class="clue-meta">Shortest route: ${opt} step${opt === 1 ? '' : 's'}. Type or click neighbouring countries.</p>
      <div class="chain-steps">${q.chain.map((c, i) => `<span class="chip-c ${i === 0 ? 'start' : c === q.end ? 'end' : ''}">${esc(c.n)}</span>`).join('<span class="chain-arrow">→</span>')}</div>
    </div>`;
  }
  function chainTry(c) {
    if (!game || game.answered) return;
    const q = current(), cur = q.chain[q.chain.length - 1];
    const msg = t => { els.hintText.textContent = t; };
    if (!c) { msg('That isn’t a country we know.'); shakeInput(); return; }
    if (q.chain.includes(c)) { msg(`${c.n} is already in your route.`); shakeInput(); return; }
    if (!cur.nb.includes(c) || !isActive(c)) { q.wrong++; msg(`${c.n} doesn’t border ${cur.n}.`); shakeInput(); return; }
    q.chain.push(c);
    els.typeInput.value = ''; msg('');
    MapView.mark(c, c === q.end ? 'correct' : 'hint');
    drawChain(q);
    if (c === q.end) {
      const used = q.chain.length - 1, opt = q.path.length - 1;
      const perfect = used === opt && !game.hints;
      q.basePts = Math.max(30, Math.round(100 * opt / used) - game.hints * 20 - q.wrong * 5);
      if (perfect) Events.inc('chainPerfect');
      const best = q.path.map(x => x.n).join(' → ');
      els.typeInput.disabled = true;
      resolve(true, '', best, used === opt ? 'Shortest possible route!' : `Your route took ${used} steps — the shortest is ${opt}: ${best}.`);
    } else {
      els.typeInput.placeholder = `Type a country that borders ${c.n}…`;
    }
  }
  function chainHint(q) {
    const cur = q.chain[q.chain.length - 1];
    const p = shortestPath(cur, q.end);
    if (!p || p.length < 2) return;
    game.hints++;
    els.hintText.textContent = `Try going through ${p[1].n}.`;
  }
  function chainGiveUp(q) {
    q.path.forEach(c => { if (!q.chain.includes(c)) MapView.mark(c, 'selected'); });
    els.typeInput.disabled = true;
    resolve(false, '', q.path.map(x => x.n).join(' → '), 'The shortest route is shown on the map.');
  }

  // ---------- flag builder ----------
  function flagParts(type) {
    const R = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;
    switch (type) {
      case 'v3': return [R(0, 0, 100, 200), R(100, 0, 100, 200), R(200, 0, 100, 200)];
      case 'h3': return [R(0, 0, 300, 66.67), R(0, 66.67, 300, 66.67), R(0, 133.33, 300, 66.67)];
      case 'h2': return [R(0, 0, 300, 100), R(0, 100, 300, 100)];
      case 'nordic': return [R(0, 0, 300, 200), R(84, 0, 34, 200) + R(0, 83, 300, 34)];
      case 'nordic2': return [R(0, 0, 300, 200), R(78, 0, 48, 200) + R(0, 76, 300, 48), R(90, 0, 24, 200) + R(0, 88, 300, 24)];
      case 'disc': return [R(0, 0, 300, 200), '<circle cx="150" cy="100" r="58"/>'];
    }
    return [];
  }
  const colourName = n => n === 'lightblue' ? 'light blue' : n;
  function renderFlagBuild(q) {
    q.paint = q.layout.colors.map(() => null);
    q.brush = 'red';
    els.eyebrow.textContent = 'Flag builder';
    els.text.textContent = `Paint the flag of ${q.c.n}`;
    els.custom.hidden = false;
    drawFlagBuild(q);
  }
  function drawFlagBuild(q) {
    const parts = flagParts(q.layout.type);
    els.custom.innerHTML = `<div class="fb">
      <svg class="fb-flag" viewBox="0 0 300 200" role="img" aria-label="Flag to paint">
        <defs><pattern id="fbBlank" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="var(--paper-2)"/><rect width="4" height="10" fill="var(--line)"/></pattern></defs>
        ${parts.map((p, i) => `<g class="fb-part" data-part="${i}" fill="${q.paint[i] ? FLAG_COLOURS[q.paint[i]] : 'url(#fbBlank)'}">${p}</g>`).join('')}
        <rect class="fb-border" x="0.5" y="0.5" width="299" height="199"/>
      </svg>
      ${game.answered ? `<div class="fb-real"><span>The real flag:</span><img src="${flagUrl(q.c)}" alt="Flag of ${esc(q.c.n)}"></div>` : `
      <div class="fb-palette">${Object.entries(FLAG_COLOURS).map(([name, hex]) =>
        `<button class="fb-swatch ${q.brush === name ? 'on' : ''}" data-colour="${name}" title="${colourName(name)}" style="--sw:${hex}"><i></i><span>${colourName(name)}</span></button>`).join('')}</div>
      <p class="clue-meta">Pick a colour, then tap a part of the flag to paint it.</p>
      <button class="btn primary fb-check" id="fbCheck">Check my flag</button>`}
    </div>`;
  }
  els.custom.addEventListener('click', e => {
    if (!game || !game.questions) return;
    const q = current();
    if (!q || q.type !== 'flagBuild' || game.answered) return;
    const sw = e.target.closest('.fb-swatch');
    if (sw) { q.brush = sw.dataset.colour; drawFlagBuild(q); return; }
    const part = e.target.closest('.fb-part');
    if (part) { q.paint[Number(part.dataset.part)] = q.brush; drawFlagBuild(q); Sound.play('tick'); return; }
    if (e.target.closest('#fbCheck')) {
      if (q.paint.some(p => !p)) { toast('Paint every part of the flag first.'); return; }
      const right = q.paint.filter((p, i) => p === q.layout.colors[i]).length;
      const ok = right === q.paint.length;
      resolve(ok, q.paint.map(colourName).join(' / '), q.layout.colors.map(colourName).join(' / '), ok ? '' : `${right} of ${q.paint.length} parts were right.`);
      drawFlagBuild(q);
    }
  });

  // ---------- study cards ----------
  function renderCard(q) {
    q.flipped = false;
    els.eyebrow.textContent = 'Study card';
    els.text.textContent = '';
    els.custom.hidden = false;
    drawCard(q);
  }
  function drawCard(q) {
    const c = q.c;
    els.custom.innerHTML = `<div class="card ${q.flipped ? 'flipped' : ''}">
      <img src="${flagUrl(c)}" alt="Flag">
      ${q.flipped ? `<h3>${esc(c.n)}</h3><p>Capital: <b>${esc(c.c)}</b> · ${esc(c.r)}</p>${factChips(c)}` : '<p class="clue-meta">Do you know this country and its capital?</p>'}
    </div>
    ${q.flipped ? '' : '<button class="btn primary card-flip" id="flipBtn">Flip card <kbd>Space</kbd></button>'}`;
    els.options.innerHTML = '';
    if (q.flipped && !game.answered) renderOptions(q, { correct: 'I knew it ✓', options: ['I knew it ✓', 'Not yet ✗'] });
    const fb = $('#flipBtn');
    if (fb) fb.onclick = () => flipCard();
  }
  function flipCard() {
    if (!game || game.answered) return;
    const q = current();
    if (q.type !== 'card' || q.flipped) return;
    q.flipped = true;
    drawCard(q);
  }

  // ---------- typing ----------
  function shakeInput() { const i = els.typeInput; i.classList.remove('wrong'); void i.offsetWidth; i.classList.add('wrong'); }
  els.typeForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!game) return;
    if (game.answered) { next(); return; }
    const q = current(), v = els.typeInput.value.trim();
    if (!v) return;
    if (q.type === 'mystery') return mysteryGuess(q, v);
    if (q.type === 'langGuess') {
      const guess = v.replace(/\s+(language|taal)$/i, '');
      const ok = matchesAny(guess, [q.c.n, ...q.c.alt]);
      els.typeInput.classList.add(ok ? 'correct' : 'wrong');
      els.typeInput.disabled = true;
      if (ok) { Events.data.langs = Events.data.langs || []; if (!Events.data.langs.includes(q.c.n)) { Events.data.langs.push(q.c.n); Events.save(); } }
      const exact = norm(guess) === norm(q.c.n);
      return resolve(ok, v, q.c.n, ok && !exact ? `Usually called ${q.c.n}.` : '');
    }
    if (q.type === 'chain') {
      const cur = q.chain[q.chain.length - 1];
      return chainTry(findCountry(v, cur.nb.filter(isActive)) || findCountry(v));
    }
    const answers = q.type === 'typeCapital' ? [q.c.c, ...q.c.alt] : [q.c.n, ...q.c.names];
    const ok = matchesAny(v, answers);
    const expected = q.type === 'typeCapital' ? q.c.c : q.c.n;
    els.typeInput.classList.add(ok ? 'correct' : 'wrong');
    els.typeInput.disabled = true;
    resolve(ok, v, expected, ok && norm(v) !== norm(expected) ? `Usually written: ${expected}` : '');
  });
  els.hintBtn.onclick = () => {
    if (!game || game.answered) return;
    const q = current();
    if (q.type === 'mystery') { if (!mysteryNextClue(q)) toast('That was the last clue!'); if (!COARSE) els.typeInput.focus(); return; }
    if (q.type === 'chain') return chainHint(q);
    if (q.type === 'langGuess') {
      const c = q.c;
      const local = c.where.filter(x => isActive(x) && (settings.region === 'All' || x.r === settings.region));
      const steps = [
        `Written in the <b>${esc(c.s)}</b>.`,
        `Spoken in <b>${esc((local[0] || c.where[0]).n)}</b>${c.where.length > 1 ? ` and ${c.where.length - 1} other ${c.where.length === 2 ? 'country' : 'countries'}` : ''}.`,
        `Starts with <b>“${esc(c.n[0])}”</b> and has ${c.n.replace(/[^\p{L}]/gu, '').length} letters.`
      ];
      if (q.hintLines.length >= steps.length) { toast('No more hints for this one.'); return; }
      q.hintLines.push(steps[q.hintLines.length]);
      game.hints = q.hintLines.length;
      els.hintText.innerHTML = q.hintLines.join('<br>');
      if (!COARSE) els.typeInput.focus();
      return;
    }
    const word = q.type === 'typeCapital' ? q.c.c : q.c.n;
    game.hints = Math.min(game.hints + 1, word.length);
    let shown = 0;
    els.hintText.textContent = [...word].map(ch => /[\s,.'-]/.test(ch) ? ch : (++shown <= game.hints ? ch : '_')).join('');
    if (!COARSE) els.typeInput.focus();
  };
  els.skipBtn.onclick = () => {
    if (!game || game.answered) return;
    const q = current();
    if (q.type === 'chain') return chainGiveUp(q);
    els.typeInput.disabled = true;
    if (q.type === 'mystery') { resolve(false, '', q.c.n); q.shown = q.clues.length; drawClues(q); return; }
    resolve(false, '', q.type === 'typeCapital' ? q.c.c : q.c.n);
  };

  // ---------- landmark hunt ----------
  function answerLandmark(ll) {
    if (!game || game.answered) return;
    const q = current(), L = q.c;
    const d = haversine(ll, L.ll), km = (Math.round(d / 10) * 10).toLocaleString('en-US');
    const ok = d <= 400;
    q.basePts = ok ? (d <= 50 ? 100 : Math.round(100 - (d - 50) / 350 * 60)) : 0;
    if (d <= 50) Events.inc('bullseye');
    MapView.drawLine(ll, L.ll, 'fx-link ' + (ok ? 'good' : 'bad'));
    MapView.drawClick(ll);
    MapView.drawPoint(L.ll, 'fx-target');
    MapView.zoomToBounds(MapView.pointsBounds([ll, L.ll], 40), 8, 0.7);
    const verdict = ok ? (d <= 50 ? 'Bullseye!' : `About ${km} km off — close enough.`) : `You were about ${km} km away.`;
    resolve(ok, ok ? '' : `${km} km away`, L.n, `${verdict} It’s in ${L.place}, ${L.country.n}.`);
  }

  // ---------- which is closer ----------
  function drawCloser(q) {
    if (q.drawn) return;
    q.drawn = true;
    if (q.kind === 'dist') {
      [q.a, q.b].forEach(x => { MapView.drawLine(q.ref.cap, x.cap, 'fx-link ' + (x === q.c ? 'good' : 'bad')); MapView.drawPoint(x.cap, 'fx-click'); });
      MapView.drawPoint(q.ref.cap, 'fx-target');
      MapView.zoomToBounds(MapView.pointsBounds([q.ref.cap, q.a.cap, q.b.cap], 40), 8, 0.8);
    } else {
      [q.a, q.b].forEach(x => {
        MapView.drawLine([x.cap[0] - 25, x.cap[1]], [x.cap[0] + 25, x.cap[1]], 'fx-link lat ' + (x === q.c ? 'good' : 'bad'));
        MapView.drawPoint(x.cap, x === q.c ? 'fx-target' : 'fx-click');
      });
      MapView.zoomToBounds(MapView.pointsBounds([q.a.cap, q.b.cap], 60), 6, 0.8);
    }
  }
  function closerExplain(q) {
    const km = d => (Math.round(d / 10) * 10).toLocaleString('en-US');
    return q.kind === 'dist'
      ? `${q.a.c} is ${km(q.da)} km from ${q.ref.c}; ${q.b.c} is ${km(q.db)} km.`
      : `${q.a.c} lies at ${fmtLat(q.a)}, ${q.b.c} at ${fmtLat(q.b)}.`;
  }

  // ---------- flag zoom ----------
  const ZOOM_STEPS = [7, 4, 2.2, 1], ZOOM_PTS = [100, 75, 50, 30];
  function zoomStep(q, toEnd = false) {
    if (!game || current() !== q) return;
    q.step = toEnd ? 3 : Math.min(3, q.step + 1);
    const img = $('#zoomImg'); if (img) img.style.transform = `scale(${ZOOM_STEPS[q.step]})`;
    const pts = $('#zoomPts'); if (pts) pts.textContent = toEnd ? '' : `Worth ${ZOOM_PTS[q.step]} points`;
    if (q.step === 3 || toEnd) { clearInterval(zoomTimer); const b = $('#zoomOutBtn'); if (b) b.hidden = true; }
  }

  // ---------- language detective ----------
  function langFacts(c) {
    const shown = c.where.slice(0, 10);
    return `<span class="fact">Written in the ${esc(c.s)}. Every text says: “All human beings are born free and equal in dignity and rights…”</span>
      <div class="lang-where">${shown.map(x => `<span><img src="${flagUrl(x)}" alt="">${esc(x.n)}</span>`).join('')}${c.where.length > shown.length ? `<span>+${c.where.length - shown.length} more</span>` : ''}</div>`;
  }
  function speakLang(c) {
    try {
      const voices = speechSynthesis.getVoices();
      const base = c.tag.split('-')[0].toLowerCase();
      const voice = voices.find(v => v.lang.toLowerCase() === c.tag.toLowerCase()) || voices.find(v => v.lang.toLowerCase().split(/[-_]/)[0] === base);
      if (voices.length && !voice) { toast('Your device has no voice for this language.'); return; }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(c.t);
      u.lang = c.tag; if (voice) u.voice = voice; u.rate = 0.95;
      speechSynthesis.speak(u);
    } catch (e) { toast('Listening isn’t available on this device.'); }
  }

  // ---------- resolving an answer ----------
  function factChips(c) {
    if (!c || c.kind !== 'country') return '';
    const bits = [`<span>Capital <b>${esc(c.c)}</b></span>`];
    if (c.pop) bits.push(`<span>Pop. <b>~${fmtPop(c.pop)}</b></span>`);
    if (c.langs.length) bits.push(`<span>Speaks <b>${esc(c.langs.slice(0, 2).join(', '))}${c.langs.length > 2 ? ' +' + (c.langs.length - 2) : ''}</b></span>`);
    if (c.curS.length) bits.push(`<span>Pays in <b>${esc(c.curS[0])}</b></span>`);
    return `<div class="facts">${bits.join('')}</div>`;
  }

  const PRAISE = ['Correct!', 'Nice!', 'Spot on!', 'Yes!', 'Nailed it.', 'Exactly.'];
  function resolve(ok, given, expected, extra = '') {
    const q = current();
    game.answered = true;
    stopQTimer();
    if (!TYPES[q.type].noRecord) Progress.record(q.c, ok);
    else { Progress.totals.answered++; if (ok) Progress.totals.correct++; Progress.save(); }
    const timedOut = extra === 'Time’s up!';
    if (timedOut) extra = '';
    let html;
    if (ok) {
      game.streak++; game.correct++;
      const base = q.basePts != null ? q.basePts : game.hints ? Math.max(20, 100 - game.hints * 25) : 100;
      const pts = base + Math.min(game.streak - 1, 10) * 10;
      game.score += pts;
      const praise = game.streak >= 5 ? `${game.streak} in a row!` : PRAISE[Math.floor(Math.random() * PRAISE.length)];
      html = `<span class="verdict">${praise} <span class="pts">+${pts}</span></span>`;
      els.feedback.className = 'feedback good';
      if (game.streak % 5 === 0) { Sound.play('streak'); Confetti.burst(60); } else Sound.play('good');
      XP.add(10 + Math.min(game.streak, 10));
    } else {
      game.streak = 0;
      game.mistakes.push({ q, given, expected });
      html = `<span class="verdict">${timedOut ? 'Time’s up!' : 'Not quite.'}</span>The answer is <b>${esc(expected)}</b>.`;
      els.feedback.className = 'feedback bad';
      Sound.play('bad');
      XP.add(2);
    }
    game.bestStreak = Math.max(game.bestStreak, game.streak);
    Events.max('bestStreak', game.streak);
    if (q.type === 'card') html = ok ? '<span class="verdict">Marked as known.</span>' : '<span class="verdict">Marked to review — it’ll come back.</span>';
    if (extra) html += `<span class="fact">${esc(extra)}</span>`;
    if (q.c.kind === 'state') html += `<span class="fact">${esc(q.c.n)} · capital ${esc(q.c.c)}</span>`;
    if (q.c.kind === 'feature') html += `<span class="fact">${FEATURE_KIND[q.c.t]}</span>`;
    if (q.c.kind === 'lang') html += langFacts(q.c);
    if (q.type !== 'card' && q.type !== 'hilo') html += factChips(q.c);
    els.feedback.innerHTML = html;
    els.next.hidden = false;
    const last = (!game.timed && !game.endless && game.i + 1 >= game.questions.length) || (game.endless && !ok);
    els.next.textContent = last ? 'See results →' : 'Next →';
    updateHud();
    let delay = game.timed ? (ok ? 450 : 1400) : (ok ? 1500 : 0);
    if (q.type === 'card') delay = 350;
    if (q.type === 'flagBuild' || q.type === 'chain' || q.type === 'mystery') delay = ok ? 2600 : 0;
    if (delay) advanceTimer = setTimeout(next, delay);
  }

  function next() {
    clearTimeout(advanceTimer);
    if (!game || !game.answered) return;
    const lastMistake = game.mistakes[game.mistakes.length - 1];
    const wasRight = !lastMistake || lastMistake.q !== current();
    game.i++;
    if (game.timed) {
      if (Date.now() >= game.endAt) return finish();
      if (game.i >= game.questions.length) game.questions.push(nextTimedQuestion());
    }
    if (game.endless) {
      if (!wasRight) return finish();
      game.questions.push(nextHilo(game.questions[game.i - 1].c));
    }
    if (game.i >= game.questions.length) finish();
    else renderQuestion();
  }
  els.next.onclick = next;

  // =====================================================================
  // Results
  // =====================================================================
  function finish() {
    if (!game || game.finished) return;
    stopTimers();
    rng = Math.random;
    const g = game;
    g.finished = true;
    const answered = g.correct + g.mistakes.length;
    const n = g.timed || g.endless ? answered : g.questions.length;
    const acc = n ? Math.round(g.correct / n * 100) : 0;
    const secs = Math.round((Date.now() - g.start) / 1000);
    const badges = [];

    let isBest = false;
    if (!g.practice && !g.tour) {
      const key = bestKey(g.mode), best = store.get(key, null);
      const better = g.endless ? (!best || g.correct > best.correct) : (!best || g.score > best.score);
      if (g.score > 0 && better) {
        store.set(key, { score: g.score, acc, correct: g.correct });
        isBest = !!best;
      }
      Events.addMode(g.mode);
      if (!g.timed && !g.endless && n >= 10 && acc === 100) Events.inc('perfect');
      if (g.mode === 'speed') Events.max('speedBest', g.correct);
      if (g.mode === 'hilo') Events.max('hiloBest', g.correct);
      if (g.mode === 'flagBuild' && n >= 5 && acc === 100) Events.inc('flagPerfect');
    }
    if (isBest) badges.push('<span class="r-badge">New personal best</span>');

    // World Tour stage: stars + unlocks
    let tourStars = 0, nextStage = null;
    if (g.tour) {
      const { r, i } = g.tour;
      tourStars = acc === 100 ? 3 : acc >= 80 ? 2 : acc >= 60 ? 1 : 0;
      const before = Tour.save(r, i, tourStars);
      Events.addMode('tour');
      badges.push(`<span class="r-badge stars">${'★'.repeat(tourStars)}<i>${'★'.repeat(3 - tourStars)}</i></span>`);
      if (!tourStars) badges.push('<span class="r-badge alt">Get 60% or more to earn a star and unlock the next stage</span>');
      else if (!before) {
        if (i + 1 < TOUR_STAGES.length) badges.push(`<span class="r-badge alt">Unlocked: stage ${i + 2} — ${TOUR_STAGES[i + 1].name}</span>`);
        else if (r + 1 < TOUR_REGIONS.length) badges.push(`<span class="r-badge">New region unlocked: ${TOUR_REGIONS[r + 1]}!</span>`);
        else badges.push('<span class="r-badge">You’ve toured the whole world!</span>');
      } else if (tourStars > before) badges.push('<span class="r-badge alt">New best for this stage</span>');
      if (tourStars) nextStage = i + 1 < TOUR_STAGES.length ? [r, i + 1] : r + 1 < TOUR_REGIONS.length ? [r + 1, 0] : null;
    }

    if (g.daily) {
      const today = dayKey();
      store.set('daily:' + today, { score: g.score, correct: g.correct });
      const ds = store.get('dailyStreak', { last: null, count: 0, best: 0 });
      if (ds.last !== today) {
        ds.count = ds.last === yesterdayKey() ? ds.count + 1 : 1;
        ds.last = today;
        ds.best = Math.max(ds.best || 0, ds.count);
        store.set('dailyStreak', ds);
      }
      badges.push(`<span class="r-badge">${ds.count}-day streak</span>`);
      badges.push('<span class="r-badge alt">New challenge tomorrow</span>');
    } else if (g.mode === 'daily') {
      badges.push('<span class="r-badge alt">Replay — today’s score is already saved</span>');
    }

    const title = g.tour ? ['Not quite there yet.', 'Stage cleared!', 'Great travelling!', 'Perfect stop!'][tourStars] : g.endless ? (g.correct >= 20 ? 'Incredible run.' : g.correct >= 10 ? 'Great instincts.' : g.correct >= 5 ? 'Nice streak.' : 'Better luck next time.')
      : g.timed ? (g.correct >= 25 ? 'Lightning fast.' : g.correct >= 15 ? 'Quick thinking.' : g.correct >= 8 ? 'Good pace.' : 'Warm-up done.')
        : acc === 100 ? 'Flawless.' : acc >= 80 ? 'Excellent work.' : acc >= 60 ? 'Solid run.' : acc >= 40 ? 'Getting there.' : 'Keep practising.';
    $('#rMode').textContent = g.tour
      ? `World Tour · ${TOUR_REGIONS[g.tour.r]} · Stage ${g.tour.i + 1}: ${TOUR_STAGES[g.tour.i].name}`
      : `${MODES[g.mode].title}${MODES[g.mode].allRegions || g.mode === 'daily' || g.mode === 'tour' ? '' : ' · ' + regionLabel(settings.region)}${g.practice ? ' · practice' : ''}`;
    $('#rTitle').textContent = title;
    $('#rBadges').innerHTML = badges.join('');
    const stats = g.endless
      ? [[g.correct, 'in a row'], [g.score, 'points'], [fmtDur(secs), 'time'], [XP.info().lvl, 'your level']]
      : [[g.score, 'points'], [`${g.correct}/${n}`, `correct · ${acc}%`], [g.bestStreak, 'best streak'], [fmtDur(secs), 'time']];
    $('#rStats').innerHTML = stats.map(([v, l]) => `<div class="stat"><b>${v}</b><small>${l}</small></div>`).join('');
    renderMistakes(g.mistakes.map(m => ({ c: m.q.c, expected: m.expected, given: m.given })));

    setResultButtons(g.tour
      ? { again: ['Retry stage', () => startTourStage(g.tour.r, g.tour.i)], home: ['World Tour map', showTour], next: nextStage && Tour.stageOpen(...nextStage) ? () => startTourStage(...nextStage) : null }
      : { again: ['Play again', () => startGame(g.mode)] });
    $('#mistakesBtn').hidden = !g.mistakes.length || g.endless;
    $('#mistakesBtn').onclick = () => startGame(g.mode, {
      questions: g.mistakes.map(({ q }) => ({ ...q, correctLabel: undefined, drawn: false, answered: undefined }))
    });

    MapView.onClick = null; MapView.onPoint = null; MapView.onCapital = null;
    showScreen('results');
    if (n >= 5 && acc === 100) { Confetti.burst(); Sound.play('done'); }
    else if (isBest) { Confetti.burst(90); Sound.play('done'); }
    else Sound.play('soft');
    XP.add(20);
    Achievements.check();
  }

  function setResultButtons({ again, home = ['Change mode', goHome], next = null }) {
    $('#againBtn').textContent = again[0]; $('#againBtn').onclick = again[1];
    $('#homeBtn').textContent = home[0]; $('#homeBtn').onclick = home[1];
    $('#nextStageBtn').hidden = !next; $('#nextStageBtn').onclick = next;
    $('#againBtn').classList.toggle('primary', !next);
  }

  function renderMistakes(list, emptyText = 'No mistakes — nothing to review.') {
    $('#mistakesTitle').textContent = list.length ? `Review · ${list.length} to learn` : 'Review';
    $('#rMistakes').innerHTML = list.length
      ? list.map(m => {
        const c = m.c;
        if (c.kind === 'lang') {
          return `<li><span class="mk-icon"><svg viewBox="0 0 24 24">${ICONS.langDetective}</svg></span><div><b>${esc(c.n)}</b><span>${esc(c.s)}${m.given ? ` · <span class="you">you said ${esc(m.given)}</span>` : ''} · spoken in ${esc(c.where.slice(0, 3).map(x => x.n).join(', '))}${c.where.length > 3 ? '…' : ''}</span></div></li>`;
        }
        if (c.kind === 'landmark') {
          return `<li><img src="${flagUrl(c.country)}" alt="" loading="lazy"><div><b>${esc(c.n)}</b><span>${esc(c.place)}, ${esc(c.country.n)}${m.given ? ` · <span class="you">you were ${esc(m.given)}</span>` : ''}</span></div></li>`;
        }
        if (c.kind === 'feature') {
          return `<li><span class="mk-icon"><svg viewBox="0 0 24 24">${ICONS.features}</svg></span><div><b>${esc(c.n)}</b><span>${FEATURE_KIND[c.t]}${m.given ? ` · <span class="you">you were ${esc(m.given)}</span>` : ''}</span></div></li>`;
        }
        const ans = m.expected && m.expected !== c.n ? `Answer: ${esc(m.expected)}` : '';
        const you = m.given ? `<span class="you">you said ${esc(m.given)}</span>` : '';
        return `<li><img src="${flagUrl(c)}" alt="" loading="lazy"><div><b>${esc(c.n)}</b><span>${[ans, you, `capital ${esc(c.c)}`].filter(Boolean).join(' · ')}</span></div></li>`;
      }).join('')
      : `<li class="perfect">${emptyText}</li>`;
  }

  // =====================================================================
  // Name them all
  // =====================================================================
  async function startNameAll() {
    try { await MapView.load(); } catch (e) { toast('The map could not load.'); return; }
    const pool = regionPool();
    const duration = settings.region === 'All' ? 15 * 60 : Math.max(3, Math.round(pool.length * 4.5 / 60)) * 60;
    game = { mode: 'nameall', pool, found: new Set(), start: Date.now(), endAt: Date.now() + duration * 1000, duration, over: false };
    MapView.prepare($('#quizMapSlot'));
    MapView.resetView(settings.region);
    els.quiz.dataset.map = 'true';
    els.quiz.dataset.bar = 'on';
    els.progress.style.width = '0%';
    setPanel('name');
    $('#nameTotal').textContent = pool.length;
    $('#nameCount').textContent = '0';
    nameMsg('Names are accepted as you type (press Enter if one doesn’t go in).');
    $('#nameInput').value = ''; $('#nameInput').disabled = false;
    $('#giveUpBtn').hidden = false; $('#nameResultsBtn').hidden = true;
    renderNameRegions();
    showScreen('quiz');
    Progress.totals.games++; Progress.save();
    tickName();
    clockTimer = setInterval(tickName, 250);
    if (!COARSE) setTimeout(() => $('#nameInput').focus(), 60);
  }

  function tickName() {
    if (!game || game.mode !== 'nameall' || game.over) return;
    const left = (game.endAt - Date.now()) / 1000;
    $('#nameTimer').textContent = fmtTime(Math.ceil(left));
    $('#nameTimer').classList.toggle('urgent', left <= 60);
    if (left <= 0) endNameAll('Time’s up!');
  }

  function renderNameRegions() {
    if (settings.region !== 'All') { $('#nameRegions').innerHTML = ''; return; }
    $('#nameRegions').innerHTML = REGIONS.slice(1).map(r => {
      const tot = game.pool.filter(c => c.r === r).length;
      const got = [...game.found].filter(c => c.r === r).length;
      return `<div class="name-region"><span>${r}</span><span class="bar"><i class="b-good" style="width:${tot ? got / tot * 100 : 0}%"></i></span><span>${got}/${tot}</span></div>`;
    }).join('');
  }

  function nameMsg(text, cls = '') { const m = $('#nameMsg'); m.textContent = text; m.className = 'name-msg ' + cls; }

  function tryName(c) {
    const input = $('#nameInput');
    input.value = '';
    if (!game.pool.includes(c)) { nameMsg(`${c.n} isn’t in ${isActive(c) ? settings.region : 'your country list'}.`, 'bad'); return; }
    if (game.found.has(c)) {
      nameMsg(`Already got ${c.n}.`, 'bad');
      input.classList.remove('wrong'); void input.offsetWidth; input.classList.add('wrong');
      return;
    }
    game.found.add(c);
    MapView.mark(c, 'correct');
    Progress.record(c, true);
    Sound.play('soft');
    nameMsg(`✓ ${c.n}`, 'good');
    $('#nameCount').textContent = game.found.size;
    els.progress.style.width = `${game.found.size / game.pool.length * 100}%`;
    renderNameRegions();
    if (game.found.size === game.pool.length) endNameAll('You named them all!');
  }

  $('#nameInput').addEventListener('input', e => {
    if (!game || game.mode !== 'nameall' || game.over) return;
    e.target.classList.remove('wrong');
    const t = norm(e.target.value);
    const c = NAME_INDEX.get(t);
    if (!c || game.found.has(c)) return;
    // If a longer, still-unnamed country starts with what's typed (e.g. "niger" → "nigeria"), wait for Enter.
    for (const [k, other] of NAME_INDEX) {
      if (k.length > t.length && (other !== c || t.length <= 3) && k.startsWith(t) && !game.found.has(other) && game.pool.includes(other)) {
        nameMsg(`Press Enter for ${c.n}, or keep typing.`);
        return;
      }
    }
    tryName(c);
  });
  $('#nameInput').addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !game || game.mode !== 'nameall' || game.over) return;
    const t = norm(e.target.value);
    if (!t) return;
    const exact = NAME_INDEX.get(t);
    if (exact) return tryName(exact);
    // Forgive one typo on longer names
    const close = t.length >= 5 ? game.pool.filter(c => !game.found.has(c) && [c.n, ...c.names].some(n => lev(norm(n), t) <= 1)) : [];
    if (close.length === 1) return tryName(close[0]);
    nameMsg(`“${e.target.value}” isn’t a country we know.`, 'bad');
    e.target.classList.remove('wrong'); void e.target.offsetWidth; e.target.classList.add('wrong');
  });
  $('#giveUpBtn').onclick = () => endNameAll('You gave up — the red ones are the ones you missed.');
  $('#nameResultsBtn').onclick = () => nameAllResults();

  function endNameAll(message) {
    if (!game || game.over) return;
    game.over = true;
    stopTimers();
    game.secs = Math.min(game.duration, Math.round((Date.now() - game.start) / 1000));
    const missed = game.pool.filter(c => !game.found.has(c));
    missed.forEach(c => MapView.mark(c, 'wrong'));
    $('#nameInput').disabled = true;
    $('#giveUpBtn').hidden = true; $('#nameResultsBtn').hidden = false;
    nameMsg(`${message} ${missed.length ? `You missed ${missed.length} (in red).` : ''}`, missed.length ? '' : 'good');
    MapView.showNames = true; // hover to learn the missed ones
    if (!missed.length) { Confetti.burst(); Sound.play('done'); } else Sound.play('soft');
  }

  function nameAllResults() {
    const g = game, total = g.pool.length, got = g.found.size, acc = Math.round(got / total * 100);
    const key = bestKey('nameall'), best = store.get(key, null);
    const isBest = got > 0 && (!best || got > best.score);
    if (isBest) store.set(key, { score: got, total, acc });
    if (settings.region === 'All') {
      Events.max('nameBest', got);
      if (got === total) Events.set('nameAll', true);
    }
    Events.addMode('nameall');
    $('#rMode').textContent = `Name Them All · ${regionLabel(settings.region)}`;
    $('#rTitle').textContent = acc === 100 ? 'Every single one.' : acc >= 75 ? 'Seriously impressive.' : acc >= 50 ? 'More than half!' : acc >= 25 ? 'Good start.' : 'Keep exploring.';
    $('#rBadges').innerHTML = isBest && best ? '<span class="r-badge">New personal best</span>' : '';
    $('#rStats').innerHTML = [[`${got}/${total}`, 'named'], [`${acc}%`, 'of the list'], [total - got, 'missed'], [fmtDur(g.secs), 'time used']]
      .map(([v, l]) => `<div class="stat"><b>${v}</b><small>${l}</small></div>`).join('');
    const missed = g.pool.filter(c => !g.found.has(c));
    renderMistakes(missed.map(c => ({ c })), 'You got every country!');
    setResultButtons({ again: ['Play again', () => startGame('nameall')] });
    $('#mistakesBtn').hidden = !missed.length;
    $('#mistakesBtn').onclick = () => startGame('identify', { questions: shuffle(missed).map(c => ({ c, type: onMap(c) ? 'identify' : 'flag' })) });
    showScreen('results');
    XP.add(20 + got);
    Achievements.check();
  }

  // =====================================================================
  // Explore
  // =====================================================================
  async function startExplore() {
    game = null;
    try { await MapView.load(); } catch (e) { /* message shown on map */ }
    MapView.prepare($('#quizMapSlot'), { names: true, onClick: showInfo });
    MapView.resetView(settings.region);
    els.quiz.dataset.map = 'true';
    els.quiz.dataset.bar = 'off';
    setPanel('explore');
    els.search.value = '';
    els.infoCard.innerHTML = '<p class="muted">Pick a country on the map or search above to see its flag, capital, population, languages, currency and neighbours.</p>';
    showScreen('quiz');
  }

  function showInfo(c) {
    MapView.clearMarks();
    MapView.mark(c, 'selected');
    MapView.zoomTo(c, 8);
    const s = Progress.data[c.a2], lvl = Progress.level(c);
    const langs = c.langs.length ? esc(c.langs.join(', ')) : '—';
    els.infoCard.innerHTML = `
      <img src="${flagUrl(c)}" alt="Flag of ${esc(c.n)}">
      <h3>${esc(c.n)}</h3>
      <dl>
        <dt>Capital</dt><dd>${esc(c.c)}</dd>
        <dt>Region</dt><dd>${esc(c.r)}</dd>
        <dt>Population</dt><dd>~${fmtPop(c.pop)}</dd>
        <dt>Area</dt><dd>${fmtArea(c.area)}</dd>
        <dt>Languages</dt><dd>${langs}</dd>
        <dt>Currency</dt><dd>${esc(c.curS.join(', ') || '—')}</dd>
        <dt>Borders</dt><dd>${c.nb.length ? `<div class="nb-chips">${c.nb.map(n => `<button data-a2="${n.a2}">${esc(n.n)}</button>`).join('')}</div>` : (c.land ? '—' : 'None — surrounded by sea')}</dd>
      </dl>
      ${c.feats.length ? '' : '<p class="note">Too small to draw on this map, so it’s shown as a circle.</p>'}
      ${isActive(c) ? '' : '<p class="note">Not in your country list right now (see Settings).</p>'}
      <p class="record">Your record: ${s ? `${s.c}/${s.s} right` : 'not asked yet'} <span class="lvl lvl${lvl}">${LEVEL_NAMES[lvl]}</span></p>
      <p class="note">Population figures are 2018 estimates.</p>`;
  }
  els.infoCard.addEventListener('click', e => {
    const b = e.target.closest('[data-a2]');
    if (b) showInfo(BY_A2.get(b.dataset.a2));
  });
  $('#countryList').innerHTML = [...COUNTRIES].sort((a, b) => a.n.localeCompare(b.n)).map(c => `<option value="${esc(c.n)}">`).join('');
  els.search.addEventListener('change', () => {
    const c = NAME_INDEX.get(norm(els.search.value));
    if (c) { showInfo(c); els.search.blur(); }
  });

  // =====================================================================
  // Progress page
  // =====================================================================
  async function showProgress() {
    game = null;
    showScreen('progress');
    renderProgressStats();
    try { await MapView.load(); } catch (e) { return; }
    MapView.prepare($('#progressMapSlot'), {
      names: true,
      tipText: c => {
        const s = Progress.data[c.a2];
        return `${c.n} — ${LEVEL_NAMES[Progress.level(c)]}${s ? ` (${s.c}/${s.s})` : ''}`;
      }
    });
    MapView.showMastery();
    MapView.resetView('All');
  }

  function renderProgressStats() {
    const mastered = ACTIVE.filter(c => Progress.level(c) === 3).length;
    const t = Progress.totals, ds = dailyStreak();
    $('#pStats').innerHTML = [
      [`${mastered}/${ACTIVE.length}`, 'countries mastered'],
      [t.answered ? Math.round(t.correct / t.answered * 100) + '%' : '—', 'overall accuracy'],
      [t.answered.toLocaleString('en-US'), 'questions answered'],
      [`${ds.count}`, `day streak${ds.best ? ` · best ${ds.best}` : ''}`]
    ].map(([v, l]) => `<div class="stat"><b>${v}</b><small>${l}</small></div>`).join('');

    $('#pRegions').innerHTML = REGIONS.slice(1).map(r => {
      const list = ACTIVE.filter(c => c.r === r);
      const cnt = [0, 0, 0, 0];
      let s = 0, ok = 0;
      list.forEach(c => { cnt[Progress.level(c)]++; const d = Progress.data[c.a2]; if (d) { s += d.s; ok += d.c; } });
      const pct = k => cnt[k] / list.length * 100;
      return `<div class="region-row">
        <b>${r}</b>
        <span class="bar"><i class="b-m3" style="width:${pct(3)}%"></i><i class="b-m2" style="width:${pct(2)}%"></i><i class="b-m1" style="width:${pct(1)}%"></i></span>
        <small>${cnt[3]}/${list.length} mastered${s ? ` · ${Math.round(ok / s * 100)}%` : ''}</small>
      </div>`;
    }).join('');

    const hardest = ACTIVE.filter(c => (Progress.data[c.a2] || {}).s >= 2)
      .map(c => ({ c, d: Progress.data[c.a2] }))
      .filter(x => x.d.c < x.d.s)
      .sort((a, b) => (a.d.c / a.d.s) - (b.d.c / b.d.s) || b.d.s - a.d.s)
      .slice(0, 8);
    $('#pHardest').innerHTML = hardest.length
      ? hardest.map(({ c, d }) => `<li><img src="${flagUrl(c)}" alt=""><div><b>${esc(c.n)}</b><span>${d.c}/${d.s} right · capital ${esc(c.c)}</span></div></li>`).join('')
      : '<li class="empty">Play a few rounds — the countries you struggle with will show up here.</li>';
  }

  function confirmReset() {
    if (!confirm('Reset all progress, XP, achievements, best scores and your daily streak? (Settings are kept.)')) return false;
    Progress.reset();
    toast('Progress reset.');
    return true;
  }
  $('#resetBtn').onclick = () => { if (confirmReset()) { renderProgressStats(); MapView.showMastery(); } };

  // =====================================================================
  // World Tour
  // =====================================================================
  const LOCK = '<svg viewBox="0 0 24 24" class="lock-ic"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  async function showTour() {
    stopTimers(); rng = Math.random; game = null;
    showScreen('tour');
    renderTour();
    try { await MapView.load(); } catch (e) { return; }
    MapView.prepare($('#tourMapSlot'), { names: true });
    TOUR_REGIONS.forEach((reg, r) => {
      const cls = Tour.regionDone(r) ? 'm3' : Tour.regionOpen(r) ? 'm2' : null;
      if (cls) ACTIVE.filter(c => c.r === reg).forEach(c => MapView.nodes(c).forEach(el => el.classList.add(cls)));
    });
    const hubs = TOUR_REGIONS.map(r => TOUR_HUBS[r]);
    for (let r = 0; r < hubs.length - 1; r++) MapView.drawLine(hubs[r], hubs[r + 1], 'tour-route ' + (Tour.regionDone(r) ? 'done' : 'todo'));
    hubs.forEach((h, r) => MapView.drawPoint(h, 'tour-hub ' + (Tour.regionDone(r) ? 'done' : Tour.regionOpen(r) ? 'open' : 'locked')));
    MapView.resetView('All');
  }
  function renderTour() {
    const cur = Tour.current();
    $('#tourStars').textContent = Tour.stars();
    $('#tourTotal').textContent = `/ ${TOUR_TOTAL} stars`;
    $('#tourSub').textContent = cur
      ? `Next stop: ${TOUR_REGIONS[cur[0]]}, stage ${cur[1] + 1}. Each stage has 8 questions — 60% earns ★, 80% ★★, 100% ★★★.`
      : 'You’ve cleared every stage! Go back and collect 3 stars everywhere.';
    $('#tourRegions').innerHTML = TOUR_REGIONS.map((reg, r) => {
      const open = Tour.regionOpen(r);
      return `<div class="tour-region ${open ? '' : 'locked'} ${Tour.regionDone(r) ? 'done' : ''}">
        <div class="tr-head"><b>${r + 1}. ${reg}</b><span>${Tour.regionStars(r)} / ${TOUR_STAGES.length * 3} ★</span></div>
        <div class="tr-stages">${TOUR_STAGES.map((st, i) => {
          const so = Tour.stageOpen(r, i), s = Tour.starsOf(r, i), isCur = cur && cur[0] === r && cur[1] === i;
          return `<button class="tstage ${so ? '' : 'locked'} ${s ? 'cleared' : ''} ${isCur ? 'current' : ''}" data-tr="${r}" data-ti="${i}" ${so ? '' : 'disabled'}>
            <span class="tstage-num">${so ? i + 1 : LOCK}</span><span class="tstage-name">${st.name}</span>
            <span class="tstage-stars">${'★'.repeat(s)}<i>${'★'.repeat(3 - s)}</i></span></button>`;
        }).join('')}</div>
        ${open ? '' : `<p class="muted">Clear every stage in ${TOUR_REGIONS[r - 1]} to unlock.</p>`}
      </div>`;
    }).join('');
  }
  $('#tourRegions').addEventListener('click', e => {
    const b = e.target.closest('.tstage:not([disabled])');
    if (b) startTourStage(Number(b.dataset.tr), Number(b.dataset.ti));
  });
  function startTourStage(r, i) {
    const region = TOUR_REGIONS[r], st = TOUR_STAGES[i], qs = [];
    for (const c of shuffle(ACTIVE.filter(x => x.r === region))) {
      if (qs.length >= 8) break;
      const types = st.types.filter(t => TYPES[t].ok(c));
      if (types.length) qs.push({ c, type: pick(types) });
    }
    startGame('tour', { questions: qs, tour: { r, i } });
  }

  // =====================================================================
  // Passport
  // =====================================================================
  const stamped = c => !!(Progress.data[c.a2] && Progress.data[c.a2].m);
  function stampHTML(c) {
    if (!stamped(c)) return `<div class="stamp empty"><span>${esc(c.n)}</span></div>`;
    let h = 7; for (const ch of c.a2 + c.n) h = (h * 31 + ch.charCodeAt(0)) % 100003;
    const colors = ['#c0392b', '#1f6fb2', '#2a8a57', '#7d3c98', '#b9770e', '#1b4f72', '#a93226', '#117a65'];
    const shape = ['round', 'rect', 'oval'][h % 3], rot = (h % 21) - 10;
    const date = new Date(Progress.data[c.a2].m).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    return `<div class="stamp ${shape}" style="--sc:${colors[h % colors.length]};--rot:${rot}deg" title="${esc(c.n)} — mastered ${date}">
      <small class="st-top">WAYFINDER</small><b>${c.a2.toUpperCase()}</b><span>${esc(c.n)}</span><small>${date}</small></div>`;
  }
  function showPassport() {
    stopTimers(); game = null;
    const got = ACTIVE.filter(stamped).length;
    $('#passportCount').textContent = `${got} / ${ACTIVE.length}`;
    $('#passportBar').style.width = `${got / ACTIVE.length * 100}%`;
    $('#passportPages').innerHTML = REGIONS.slice(1).map(r => {
      const list = ACTIVE.filter(c => c.r === r).sort((a, b) => stamped(b) - stamped(a) || a.n.localeCompare(b.n));
      return `<section class="pp-page"><h3>${r} <small>${list.filter(stamped).length} / ${list.length}</small></h3>
        <div class="stamps">${list.map(stampHTML).join('')}</div></section>`;
    }).join('');
    showScreen('passport');
  }

  // =====================================================================
  // Map styles
  // =====================================================================
  function activeStyle() {
    const lvl = XP.info().lvl;
    const st = MAP_STYLES.find(s => s[0] === settings.mapStyle);
    return st && st[2] <= lvl ? st : MAP_STYLES[0];
  }
  function applyMapStyle() { $('#mapWrap').dataset.style = activeStyle()[0]; }
  function renderStylePicker() {
    const lvl = XP.info().lvl, cur = activeStyle()[0];
    $('#setStyles').innerHTML = MAP_STYLES.map(([id, name, need, sea, land]) => {
      const locked = need > lvl;
      return `<button class="style-card ${id === cur ? 'on' : ''} ${locked ? 'locked' : ''}" data-style-id="${id}" ${locked ? 'disabled' : ''}>
        <span class="style-swatch" style="--s1:${sea};--s2:${land}"></span>
        <b>${name}</b><small>${locked ? `Unlocks at level ${need}` : id === cur ? 'In use' : 'Tap to use'}</small></button>`;
    }).join('');
  }

  // =====================================================================
  // Achievements & level page
  // =====================================================================
  function showProfile() {
    game = null;
    stopTimers();
    const { lvl, into, need } = XP.info();
    const got = Achievements.got;
    const nextTitle = TITLES.find(([min]) => min > lvl);
    $('#profileHead').innerHTML = `
      <div class="lvl-badge"><small>Level</small><b>${lvl}</b></div>
      <div class="lvl-info">
        <p class="eyebrow">${XP.total.toLocaleString('en-US')} XP earned</p>
        <h2 class="r-title">${XP.title(lvl)}</h2>
        <div class="xp-track"><i style="width:${into / need * 100}%"></i></div>
        <p class="muted">${need - into} XP to level ${lvl + 1}${nextTitle ? ` · “${nextTitle[1]}” at level ${nextTitle[0]}` : ''}</p>
      </div>`;
    $('#achTitle').textContent = `Achievements · ${Object.keys(got).length} of ${ACHIEVEMENTS.length}`;
    $('#achGrid').innerHTML = ACHIEVEMENTS.map(([id, title, desc]) => `
      <div class="ach ${got[id] ? 'on' : ''}">
        <span class="ach-icon">${ICON.trophy}</span>
        <div><b>${esc(title)}</b><span>${esc(desc)}</span>${got[id] ? `<small>Unlocked ${new Date(got[id]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</small>` : ''}</div>
      </div>`).join('');
    $('#styleList').innerHTML = MAP_STYLES.slice(1).map(([, name, need]) => `<span class="title-chip ${lvl >= need ? 'on' : ''}">Lv ${need} · ${name} map</span>`).join('');
    $('#titleList').innerHTML = TITLES.map(([min, name]) => `<span class="title-chip ${lvl >= min ? 'on' : ''}">Lv ${min} · ${name}</span>`).join('');
    $('#xpHow').textContent = 'Earn XP for every right answer (+10, more on a streak), +2 for trying, +20 per finished game and +50 per achievement.';
    showScreen('profile');
  }

  // =====================================================================
  // Settings page
  // =====================================================================
  function showSettings() {
    stopTimers();
    rng = Math.random;
    game = null;
    MapView.prepare($('#quizMapSlot'));
    renderSettings();
    showScreen('settings');
  }
  function renderSettings() {
    $('#setCountries').innerHTML = OPTIONAL.map(([a2, name, note]) => `
      <label class="toggle"><input type="checkbox" data-excl="${a2}" ${settings.excluded.includes(a2) ? '' : 'checked'}>
        <img src="flags/${a2}.svg" alt=""><span><b>${name}</b><small>${note}</small></span></label>`).join('');
    $('#setCount').textContent = `You’re playing with ${ACTIVE.length} countries.`;
    $('#setDifficulty').innerHTML = chips('difficulty');
    $('#setLength').innerHTML = chips('length');
    $('#setTimer').innerHTML = chips('timer');
    $('#setTheme').innerHTML = chipRow([['light', 'Light'], ['dark', 'Dark']], settings.theme, 'theme-set');
    $('#setSound').innerHTML = chipRow([['on', 'On'], ['off', 'Off']], settings.muted ? 'off' : 'on', 'sound-set');
    renderStylePicker();
    Install.renderSettings();
  }
  $('#settings').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (chip && handleChip(chip)) { renderSettings(); return; }
    const sc = e.target.closest('.style-card:not([disabled])');
    if (sc) { settings.mapStyle = sc.dataset.styleId; saveSettings(); applyMapStyle(); renderSettings(); return; }
    if (e.target.closest('#presetUN')) { settings.excluded = OPTIONAL.map(o => o[0]); saveSettings(); refreshActive(); renderSettings(); toast('Now using the 193 UN member states.'); }
    if (e.target.closest('#preset197')) { settings.excluded = []; saveSettings(); refreshActive(); renderSettings(); toast('Now using all 197 countries.'); }
  });
  $('#settings').addEventListener('change', e => {
    const box = e.target.closest('[data-excl]');
    if (!box) return;
    const a2 = box.dataset.excl;
    settings.excluded = settings.excluded.filter(x => x !== a2);
    if (!box.checked) settings.excluded.push(a2);
    saveSettings(); refreshActive(); renderSettings();
  });
  $('#exportBtn').onclick = () => {
    const data = {};
    store.keys().forEach(k => { data[k] = localStorage.getItem(k); });
    const blob = new Blob([JSON.stringify({ app: 'wayfinder', version: 1, saved: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wayfinder-backup-${dayKey()}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Backup saved to your Downloads.');
  };
  $('#importBtn').onclick = () => $('#importFile').click();
  $('#importFile').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        if (json.app !== 'wayfinder' || !json.data) throw new Error('Not a Wayfinder backup');
        if (!confirm('Replace your current progress with this backup?')) return;
        store.keys().forEach(k => localStorage.removeItem(k));
        Object.entries(json.data).forEach(([k, v]) => { if (k.startsWith('wayfinder:')) localStorage.setItem(k, v); });
        location.reload();
      } catch (err) { toast('That file isn’t a Wayfinder backup.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  $('#resetBtn2').onclick = () => { if (confirmReset()) renderSettings(); };

  // =====================================================================
  // "Install as an app" — a one-tap button where the browser allows it,
  // clear instructions where it doesn't (iPhone/iPad, Safari on Mac, Firefox)
  // =====================================================================
  const SHARE_ICON = '<svg class="share-ic" viewBox="0 0 24 24" aria-label="Share"><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5"/><path d="M6 11H5v10h14V11h-1"/></svg>';
  const Install = {
    deferred: null,
    isStandalone: () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    isWeb: () => location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1',
    platform() {
      const ua = navigator.userAgent;
      const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
      if (iOS) return /CriOS|FxiOS|EdgiOS/.test(ua) ? 'ios-other' : 'ios';
      if (/Android/.test(ua)) return /Firefox/.test(ua) ? 'android-firefox' : 'android';
      if (/Firefox/.test(ua)) return 'firefox';
      if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua)) return 'mac-safari';
      return 'chromium';
    },
    howTo() {
      switch (this.platform()) {
        case 'ios': return `Tap the Share button ${SHARE_ICON} at the bottom (or top) of Safari, then <b>Add to Home Screen</b>.`;
        case 'ios-other': return `Tap the Share button ${SHARE_ICON} next to the address bar, then <b>Add to Home Screen</b>.`;
        case 'mac-safari': return 'In the menu bar choose <b>File → Add to Dock</b>.';
        case 'android-firefox': return 'Tap the <b>⋮</b> menu, then <b>Install</b>.';
        case 'android': return 'Tap the <b>⋮</b> menu, then <b>Install app</b> (or <b>Add to Home screen</b>).';
        case 'firefox': return 'Firefox can’t install apps on computers — open this page in <b>Chrome</b>, <b>Edge</b> or <b>Safari</b> to install it.';
        default: return 'Click the install icon at the right end of the address bar, or open the browser menu (⋮) and choose <b>Install Wayfinder</b>.';
      }
    },
    showBanner(force = false) {
      if (this.isStandalone() || !this.isWeb()) return;
      if (!force && Date.now() - store.get('installDismissed', 0) < 7 * 864e5) return;
      if (!force && document.body.classList.contains('in-game')) return;
      // In Chrome/Edge only offer it once the browser confirms it can install (one tap)
      if (!force && this.platform() === 'chromium' && !this.deferred) return;
      const can = !!this.deferred;
      $('#ibMsg').innerHTML = can ? 'Play offline from your home screen or desktop — it only takes a tap.' : this.howTo();
      $('#ibInstall').hidden = !can;
      $('#ibLater').textContent = can ? 'Not now' : 'Got it';
      $('#installBanner').hidden = false;
    },
    hideBanner() { $('#installBanner').hidden = true; },
    async prompt() {
      if (!this.deferred) { this.showBanner(true); return; }
      const ev = this.deferred;
      this.deferred = null;
      this.hideBanner();
      ev.prompt();
      try { const { outcome } = await ev.userChoice; if (outcome !== 'accepted') store.set('installDismissed', Date.now()); } catch (e) { /* ignore */ }
      this.renderSettings();
    },
    renderSettings() {
      const web = this.isWeb() && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
      $('#installWeb').hidden = !web;
      $('#installLocal').hidden = web;
      if (this.isStandalone()) {
        $('#installStatus').textContent = 'You’re using the installed app. Nice!';
        $('#installWeb').hidden = true; $('#installLocal').hidden = true;
        return;
      }
      if (web) {
        $('#installStatus').textContent = '';
        $('#installHow').innerHTML = this.deferred ? 'Your browser can install Wayfinder in one tap:' : this.howTo();
        $('#installNowBtn').hidden = !this.deferred;
      } else {
        $('#installStatus').textContent = location.protocol.startsWith('http')
          ? 'You’re running Wayfinder through the launcher, so you can install it now (step 2).'
          : 'You opened index.html directly, which is fine for playing. To install it as an app on this Mac, start it with the launcher first (step 1).';
      }
    }
  };
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    Install.deferred = e;
    Install.showBanner(!$('#installBanner').hidden);
    if ($('#settings').classList.contains('active')) Install.renderSettings();
  });
  window.addEventListener('appinstalled', () => {
    Install.deferred = null;
    Install.hideBanner();
    toast('Wayfinder is installed — find it on your home screen or in your apps.');
  });
  $('#ibInstall').onclick = () => Install.prompt();
  $('#installNowBtn').onclick = () => Install.prompt();
  $('#ibLater').onclick = () => { store.set('installDismissed', Date.now()); Install.hideBanner(); };

  // =====================================================================
  // Keyboard
  // =====================================================================
  document.addEventListener('keydown', e => {
    const active = ($('.screen.active') || {}).id;
    if (e.key === 'Escape' && active !== 'home' && active !== 'results') { goHome(); return; }
    if (active !== 'quiz' || !game || game.mode === 'nameall' || !game.questions || e.target.matches('input')) return;
    const q = current();
    if (q.type === 'card' && !q.flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); flipCard(); return; }
    if (/^[1-4]$/.test(e.key) && !game.answered) {
      const b = $$('.option', els.options)[Number(e.key) - 1];
      if (b) b.click();
    } else if (e.key === 'Enter' && game.answered) {
      e.preventDefault(); next();
    }
  });

  // =====================================================================
  // Boot
  // =====================================================================
  refreshActive();
  applyMapStyle();
  applyTheme();
  applySound();
  renderXpPill();
  renderHome();
  setTimeout(() => MapView.load().catch(() => {}), 30);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then(reg => { reg.update().catch(() => {}); })
      .catch(() => {});
    // A new version finished downloading: reload into it (but never in the middle of a game)
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      const go = () => { if (reloaded) return; reloaded = true; location.reload(); };
      if (!document.body.classList.contains('in-game')) { toast('Wayfinder was updated — loading the new version…'); setTimeout(go, 1200); }
      else { toast('An update is ready — it will load when you go back to the home screen.'); $('#brandBtn').addEventListener('click', go, { once: true }); $('#quitBtn').addEventListener('click', go, { once: true }); }
    });
  }
  // First visit: offer to install (Chrome/Edge show it as soon as the browser says it can install)
  setTimeout(() => Install.showBanner(), 2500);
  if (Install.isWeb() && !Install.isStandalone()) {
    $('.foot').insertAdjacentHTML('beforeend', ' <button class="link-btn" id="footInstall">Install as an app</button>');
    $('#footInstall').onclick = () => Install.prompt();
  }
})();
