/* UI framework: shell, router, event delegation, sheets, toasts, rest timer. */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const $ = (s, r) => (r || document).querySelector(s);
  WT.$ = $;
  WT.A = {}; // click actions:  data-act="name"
  WT.I = {}; // input handlers: data-in="name"
  WT.V = {}; // views
  WT.ui = { open: {}, route: 'dashboard', param: null, gen: null, lib: { q: '', group: '', equip: '', cat: '', diff: '', intensity: '', avail: 'mine', fav: false }, prog: { ex: null, metric: 'e1rm' } };
  const I = WT.icon;
  const esc = WT.esc;

  const NAV = [
    { id: 'dashboard', name: 'Home', icon: 'home' },
    { id: 'generate', name: 'Generate', icon: 'sparkles' },
    // The active-workout screen is reached from Home ("Resume workout") and after starting any workout;
    // it no longer has its own tab, but the route (and everything on it) is unchanged.
    { id: 'workout', name: 'Workout', icon: 'activity', hidden: true },
    { id: 'library', name: 'Exercises', icon: 'book' },
    { id: 'history', name: 'History', icon: 'clock' },
    { id: 'progress', name: 'Progress', icon: 'chart' },
    { id: 'food', name: 'Food', icon: 'food' },
    { id: 'meals', name: 'Meal ideas', icon: 'sparkles' },
    { id: 'achievements', name: 'Achievements', icon: 'trophy', optional: true },
    { id: 'settings', name: 'Settings', icon: 'settings' },
  ];
  WT.NAV = NAV;

  /* ───────── Shell ───────── */
  function shell() {
    const navLink = (n) => `<a href="#/${n.id}" class="nav" data-nav="${n.id}">${I(n.icon, 17)}<span>${n.name}</span><span class="slot"></span></a>`;
    const tabs = ['dashboard', 'generate', 'history', 'progress', 'food']
      .map((id) => NAV.find((n) => n.id === id))
      .map((n) => `<a href="#/${n.id}" class="tab" data-nav="${n.id}">${I(n.icon, 23)}<span>${n.name}</span><span class="slot"></span></a>`)
      .join('');
    document.getElementById('app').innerHTML = `
      <aside class="side">
        <a href="#/dashboard" class="brand"><span class="brand-mark">${I('dumbbell', 15)}</span>Forge</a>
        ${NAV.filter((n) => n.id !== 'settings' && !n.hidden).map(navLink).join('')}
        <div class="side-spacer"></div>
        ${navLink(NAV.find((n) => n.id === 'settings'))}
      </aside>
      <header class="mtop" id="mtop"></header>
      <main class="main" id="main"></main>
      <nav class="tabs" aria-label="Main">${tabs}</nav>
      <div id="timerHost"></div>
      <div class="toasts" id="toasts" role="status" aria-live="polite"></div>`;
    window.addEventListener('scroll', () => {
      const m = $('#mtop');
      if (m) m.classList.toggle('scrolled', window.scrollY > 24);
    }, { passive: true });
  }
  WT.refreshShell = function () {
    const a = WT.db.active;
    // A workout in progress shows as a dot on Home, where "Resume workout" lives
    document.querySelectorAll('[data-nav="dashboard"] .slot').forEach((el) => (el.innerHTML = a ? '<span class="live" title="Workout in progress"></span>' : ''));
    const achOn = WT.db.profile.achievements !== false;
    document.querySelectorAll('.side [data-nav="achievements"]').forEach((el) => (el.style.display = achOn ? '' : 'none'));
    const focus = WT.ui.route === 'workout' && !!a;
    document.body.classList.toggle('focus', focus);
    const mb = $('#mtop');
    if (!mb) return;
    if (focus)
      mb.innerHTML = `<a class="icon-btn" href="#/dashboard" aria-label="Leave workout (keeps running)">${I('chevL', 22)}</a>
        <div class="ttl always"><span class="clock" id="mbClock">${WT.fmtClock((Date.now() - new Date(a.startedAt)) / 1000)}</span></div>
        <button class="btn btn-primary btn-sm" data-act="woFinish">Finish</button>`;
    else {
      const nav = NAV.find((n) => n.id === WT.ui.route) || NAV[0];
      const back = WT.ui.route === 'history' && WT.ui.param;
      mb.innerHTML = `${back ? `<a class="icon-btn" href="#/history" aria-label="Back to history">${I('chevL', 22)}</a>` : ''}<span class="ttl ${back ? 'always' : ''}">${back ? 'Workout' : nav.name}</span>
        <a class="icon-btn" href="#/library" aria-label="Exercises" data-nav="library">${I('book', 20)}</a>
        <a class="icon-btn" href="#/settings" aria-label="Settings" data-nav="settings">${I('settings', 20)}</a>`;
    }
    mb.classList.toggle('scrolled', window.scrollY > 24);
  };

  /* ───────── Router ───────── */
  function parseHash() {
    const h = (location.hash || '#/dashboard').slice(2).split('/');
    return { route: NAV.find((n) => n.id === h[0]) ? h[0] : 'dashboard', param: h[1] ? decodeURIComponent(h[1]) : null };
  }
  WT.go = (route, param) => {
    const target = '#/' + route + (param ? '/' + encodeURIComponent(param) : '');
    if (location.hash === target) WT.render();
    else location.hash = target;
  };
  WT.render = function (keepScroll) {
    const { route, param } = parseHash();
    const changed = route !== WT.ui.route || param !== WT.ui.param;
    WT.ui.route = route;
    WT.ui.param = param;
    const main = $('#main');
    const y = window.scrollY;
    const html = (WT.V[route] || WT.V.dashboard)(param);
    main.innerHTML = `<div class="view${keepScroll && !changed ? ' no-anim' : ''}">${html}</div>`;
    if (keepScroll && !changed) {
      main.firstChild.style.animation = 'none';
      window.scrollTo(0, y);
    } else if (changed) window.scrollTo(0, 0);
    main.classList.toggle('calm', !!(keepScroll && !changed));
    const nav = NAV.find((n) => n.id === route);
    document.title = (nav ? nav.name + ' · ' : '') + 'Forge';
    const after = WT.V[route + 'After'];
    if (after) requestAnimationFrame(() => after(param));
    WT.refreshShell();
    // Screens without a tab light up their parent tab (Meal ideas → Food, Achievements → Progress)
    const parent = { meals: 'food', achievements: 'progress', workout: 'dashboard' }[route];
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === route || (a.classList.contains('tab') && a.dataset.nav === parent)));
    WT.renderTimer();
  };
  WT.rerender = () => WT.render(true);
  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }
  WT.greeting = greeting;

  /* ───────── Event delegation ───────── */
  function onClick(ev) {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = WT.A[el.dataset.act];
    if (!fn) return console.warn('No action', el.dataset.act);
    if (el.tagName === 'A' && !el.getAttribute('href')) ev.preventDefault();
    if (el.dataset.stop) ev.stopPropagation();
    fn(el.dataset, el, ev);
  }
  function onInput(ev) {
    const el = ev.target.closest('[data-in]');
    if (!el) return;
    const fn = WT.I[el.dataset.in];
    if (fn) fn(el, ev);
  }

  /* ───────── Sheets ───────── */
  const sheets = [];
  WT.openSheet = function (renderFn, opts) {
    opts = opts || {};
    const ov = document.createElement('div');
    ov.className = 'scrim';
    ov.innerHTML = `<div class="sheet ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true"></div>`;
    document.body.appendChild(ov);
    const entry = { ov, renderFn, opts };
    sheets.push(entry);
    paint(entry);
    ov.addEventListener('mousedown', (e) => {
      if (e.target === ov) WT.closeSheet();
    });
    document.body.style.overflow = 'hidden';
    return entry;
  };
  function paint(entry) {
    const sheet = entry.ov.firstChild;
    const scroll = sheet.scrollTop;
    const r = entry.renderFn();
    sheet.innerHTML = `<div class="grabber"></div>
      <div class="sheet-head"><div class="grow">${r.eyebrow ? `<div class="over">${r.eyebrow}</div>` : ''}<h2>${r.title || ''}</h2></div>${r.headExtra || ''}<button class="icon-btn" data-act="closeSheet" aria-label="Close">${I('x', 19)}</button></div>
      <div class="sheet-body">${r.body || ''}</div>${r.foot ? `<div class="sheet-foot">${r.foot}</div>` : ''}`;
    sheet.scrollTop = scroll;
    if (r.after) r.after(sheet);
  }
  WT.refreshSheet = function () {
    const top = sheets[sheets.length - 1];
    if (top) paint(top);
  };
  WT.closeSheet = function (all) {
    do {
      const e = sheets.pop();
      if (!e) break;
      if (e.opts.onClose) e.opts.onClose();
      e.ov.remove();
    } while (all && sheets.length);
    if (!sheets.length) document.body.style.overflow = '';
  };
  WT.A.closeSheet = () => WT.closeSheet();
  WT.confirm = function (title, message, okLabel, onOk, danger) {
    WT.openSheet(() => ({
      title,
      body: `<p class="t2">${message}</p>`,
      foot: `<button class="btn btn-secondary grow" data-act="closeSheet">Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'} grow" data-act="confirmOk">${okLabel}</button>`,
    }));
    WT.A.confirmOk = () => {
      WT.closeSheet();
      onOk();
    };
  };

  /* ───────── Toast ───────── */
  WT.toast = function (msg, kind) {
    const host = $('#toasts');
    if (!host) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.innerHTML = (kind === 'good' ? I('check', 16) : kind === 'error' ? I('info', 16) : '') + `<span>${esc(msg)}</span>`;
    while (host.children.length > 2) host.firstChild.remove();
    host.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .3s, transform .3s';
      t.style.opacity = 0;
      t.style.transform = 'translateY(-8px)';
      setTimeout(() => t.remove(), 320);
    }, 2600);
  };

  /* ───────── Rest timer ───────── */
  let audioCtx = null;
  function beep() {
    if (!WT.db.profile.timerSound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18, 0.36].forEach((t, i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = i === 2 ? 1046 : 784;
        o.connect(g);
        g.connect(audioCtx.destination);
        const s = audioCtx.currentTime + t;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.25, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.15);
        o.start(s);
        o.stop(s + 0.16);
      });
    } catch (e) {}
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }
  WT.unlockAudio = function () {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
  };
  WT.startTimer = function (sec, label) {
    if (!WT.db.active) return;
    WT.unlockAudio();
    WT.db.active.timer = { end: Date.now() + sec * 1000, total: sec, label: label || 'Rest', beeped: false };
    WT.save();
    WT.renderTimer();
  };
  WT.renderTimer = function () {
    const host = $('#timerHost');
    if (!host) return;
    const a = WT.db.active;
    const t = a && a.timer;
    if (!t) {
      host.innerHTML = '';
      return;
    }
    const left = Math.max(0, Math.ceil((t.end - Date.now()) / 1000));
    const done = left === 0;
    const f = t.total ? left / t.total : 0;
    host.innerHTML = `<div class="timer ${done ? 'done' : ''}" role="timer" aria-live="off">
      <div class="bar"><i id="timerArc" style="width:${f * 100}%"></i></div>
      <div class="timer-in"><div class="grow"><div class="t" id="timerText">${done ? 'Go' : WT.fmtClock(left)}</div><div class="lbl ellipsis">${done ? 'Rest complete' : esc(t.label)}</div></div>
        <button class="btn btn-plain btn-sm tnum" data-act="timerAdd" data-s="-15" aria-label="Subtract 15 seconds">−15</button>
        <button class="btn btn-plain btn-sm tnum" data-act="timerAdd" data-s="15" aria-label="Add 15 seconds">+15</button>
        <button class="btn btn-sm ${done ? 'btn-primary' : 'btn-secondary'}" data-act="timerStop">${done ? 'Done' : 'Skip'}</button>
      </div></div>`;
  };
  function tick() {
    const a = WT.db && WT.db.active;
    if (a && a.timer) {
      const t = a.timer;
      const left = Math.max(0, Math.ceil((t.end - Date.now()) / 1000));
      const txt = $('#timerText');
      if (left === 0 && !t.beeped) {
        t.beeped = true;
        WT.save();
        beep();
        WT.renderTimer();
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('Rest complete', { body: 'Time for your next set.', tag: 'rest' });
          } catch (e) {}
        }
      } else if (txt && left > 0) {
        txt.textContent = WT.fmtClock(left);
        const arc = $('#timerArc');
        if (arc) arc.style.width = (left / t.total) * 100 + '%';
      }
      if (left === 0 && Date.now() - t.end > 60000) {
        a.timer = null;
        WT.save();
        WT.renderTimer();
      }
    }
    if (a) {
      const txt = WT.fmtClock((Date.now() - new Date(a.startedAt)) / 1000);
      ['#woClock', '#mbClock', '#dashClock'].forEach((sel) => {
        const el = $(sel);
        if (el) el.textContent = txt;
      });
    }
  }
  WT.A.timerAdd = (d) => {
    const t = WT.db.active && WT.db.active.timer;
    if (!t) return;
    const now = Date.now();
    const base = Math.max(t.end, now);
    t.end = Math.max(now + 1000, base + +d.s * 1000);
    t.total = Math.max(t.total + +d.s, Math.ceil((t.end - now) / 1000));
    t.beeped = false;
    WT.save();
    WT.renderTimer();
  };
  WT.A.timerStop = () => {
    if (WT.db.active) WT.db.active.timer = null;
    WT.save();
    WT.renderTimer();
  };
  WT.A.timerStart = (d) => WT.startTimer(+d.s, 'Rest');

  /* ───────── Theme ───────── */
  WT.applyTheme = function () {
    const t = WT.db.profile.theme;
    const theme = t === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f6f6f3' : '#121211');
  };

  /* ───────── Shared render helpers ───────── */
  WT.h = {
    intensity(int, act, uid, ctx) {
      const label = (WT.INTENSITY_INFO[int] || { name: int }).name;
      return act
        ? `<button class="int ${int}" data-act="${act}" data-uid="${uid}" ${ctx ? `data-ctx="${ctx}"` : ''} aria-label="Intensity: ${label}. Change">${label}</button>`
        : `<span class="int ${int}">${label}</span>`;
    },
    muscles(ex) {
      return `${WT.muscleName(ex.primary)}${ex.secondary.length ? ` · ${ex.secondary.slice(0, 2).map(WT.muscleName).join(', ')}` : ''}`;
    },
    target(item, ex) {
      const tt = WT.trackType(ex);
      if (tt === 'cardio') return `${item.repMin}–${item.repMax} min`;
      const unit = tt === 'time' || ex.unit === 'sec' ? 's' : '';
      if (WT.STAGED[item.intensity]) return `${item.sets || item.targetSets} × ${item.stageCount || 3} stages`;
      return `${item.sets || item.targetSets} × ${item.repMin}${item.repMax !== item.repMin ? '–' + item.repMax : ''}${unit}`;
    },
    empty(title, text, action) {
      return `<div class="empty"><h3>${title}</h3><p>${text}</p>${action ? `<div class="mt16 row wrap">${action}</div>` : ''}</div>`;
    },
    chipGroup(items, selected, act, extra) {
      const sel = new Set(selected);
      return `<div class="chips">${Object.entries(items)
        .map(([k, v]) => `<button class="chip ${extra || ''} ${sel.has(k) ? 'on' : ''}" data-act="${act}" data-k="${k}" aria-pressed="${sel.has(k)}">${esc(v)}</button>`)
        .join('')}</div>`;
    },
    toggle(on, act, extra) {
      return `<button class="toggle ${on ? 'on' : ''}" role="switch" aria-checked="${!!on}" data-act="${act}" ${extra || ''}></button>`;
    },
    stepper(val, act, key, min, max) {
      return `<div class="stepper"><button data-act="${act}" data-k="${key}" data-d="-1" data-min="${min}" data-max="${max}" aria-label="Decrease">${I('minus', 15)}</button><span class="val">${val}</span><button data-act="${act}" data-k="${key}" data-d="1" data-min="${min}" data-max="${max}" aria-label="Increase">${I('plus', 15)}</button></div>`;
    },
    seg(options, current, act, key, cls) {
      return `<div class="seg ${cls || ''}" role="group">${options.map(([v, l]) => `<button class="${String(v) === String(current) ? 'on' : ''}" data-act="${act}" data-k="${key || ''}" data-v="${v}" aria-pressed="${String(v) === String(current)}">${l}</button>`).join('')}</div>`;
    },
    /**
     * Exercise demonstration: the illustration's frames played as a calm loop
     * (two frames cross-fade; three frames ping-pong start → middle → end → middle).
     * size: 'sm' thumbnail · 'md' active workout · 'lg' detail / viewer.
     * opts.static: render as a non-interactive element (inside other buttons).
     * Images load lazily and only animate while on screen — see mountDemos().
     */
    demo(exId, size, opts) {
      opts = opts || {};
      const ex = WT.ex(exId);
      const d = WT.demoFor(exId, opts.variation);
      const name = ex ? esc(ex.name) : '';
      if (!d) {
        if (size === 'sm') return `<span class="demo demo-sm none" aria-hidden="true">${I('dumbbell', 16)}</span>`;
        return `<div class="demo demo-${size} none"><span>${I('dumbbell', 18)}No demonstration for this exercise</span></div>`;
      }
      // Everkinetic pairs keep their original start/end classes (fa/fb); other sources use f1…fN.
      const cls = (i) => (d.src === 'ek' ? (i ? 'fb' : 'fa') : 'f' + (i + 1));
      // A single frame is a still reference image, labelled as such rather than presented as motion.
      const still = d.frames.length === 1;
      const tag = still && size !== 'sm' ? '<span class="demo-tag">Still image</span>' : '';
      const imgs = d.frames.map((u, i) => `<img class="${cls(i)}" data-src="${u}" alt="" decoding="async" draggable="false">`).join('') + tag;
      const c = `demo demo-${size} src-${d.src} n${d.frames.length}`;
      if (opts.static) return `<span class="${c}" role="img" aria-label="${name} ${still ? 'reference image' : 'demonstration'}">${imgs}</span>`;
      return `<button type="button" class="${c}" data-act="openDemo" data-id="${exId}" ${opts.variation ? `data-v="${opts.variation}"` : ''} aria-label="Show ${name} ${still ? 'reference image' : 'demonstration'}">${imgs}</button>`;
    },
    /** Attribution line for the illustration shown for an exercise (required by CC BY-SA). */
    demoCredit(exId, variation) {
      const d = WT.demoFor(exId, variation);
      if (!d) return '';
      const a = (href, t) => `<a href="${href}" target="_blank" rel="noopener">${t}</a>`;
      const s = d.source;
      const ek = WT.MEDIA.sources.ek;
      if (d.src === 'rdb') return `<p class="demo-credit">Exercise data by ${a(s.url, 'RepDB (repdb.co)')} · AI-generated · ${a(s.licenseUrl, s.license)}</p>`;
      const who = d.src === 'ek' ? a(s.url, 'Everkinetic') : `${a(s.url, s.name)} by ${s.by}`;
      const also = d.alsoEk ? `, adapted in part from ${a(ek.url, 'Everkinetic')}` : '';
      return `<p class="demo-credit">Illustration: ${who}${also} · ${a(s.licenseUrl, s.license)}</p>`;
    },
    /** Attributes for a <details> whose open/closed state should survive re-renders. */
    keepOpen(key) {
      return `data-keep="${key}" ${WT.ui.open[key] ? 'open' : ''}`;
    },
    oddsBar(odds) {
      const keys = ['heavy', 'regular', 'burnout', 'standard', 'drop', 'buildup'];
      const tot = keys.reduce((a, k) => a + Math.max(0, +odds[k] || 0), 0) || 1;
      return `<div class="oddsbar">${keys.map((k) => `<i class="${k}" style="width:${(Math.max(0, +odds[k] || 0) / tot) * 100}%"></i>`).join('')}</div>`;
    },
    pct(odds, k) {
      const tot = ['heavy', 'regular', 'burnout', 'standard', 'drop', 'buildup'].reduce((a, x) => a + Math.max(0, +odds[x] || 0), 0) || 1;
      return Math.round((Math.max(0, +odds[k] || 0) / tot) * 100);
    },
    li(o) {
      // Generic list row: {tag, attrs, title, sub, lead, trail, chev, cls}
      const tag = o.tag || (o.href ? 'a' : o.act ? 'button' : 'div');
      return `<${tag} class="li ${o.cls || ''}" ${o.href ? `href="${o.href}"` : ''} ${o.act ? `data-act="${o.act}"` : ''} ${o.attrs || ''}>${o.lead || ''}<div class="grow"><div class="ti">${o.title}</div>${o.sub ? `<div class="su">${o.sub}</div>` : ''}</div>${o.trail || ''}${o.chev ? `<span class="chev">${I('chevR', 16)}</span>` : ''}</${tag}>`;
    },
  };

  /* ───────── Exercise demonstrations: lazy load, pause offscreen, fallbacks ───────── */
  let demoIO = null;
  function demoVisible(el, on) {
    if (on && !el.dataset.loaded) {
      el.dataset.loaded = '1';
      const imgs = el.querySelectorAll('img');
      let n = 0;
      imgs.forEach((img) => {
        img.onload = () => ++n === imgs.length && el.classList.add('ready');
        img.onerror = () => el.classList.add('failed');
        img.src = img.dataset.src; // browser + service-worker cache: each file is fetched once
      });
    }
    el.classList.toggle('playing', on);
  }
  WT.mountDemos = function (root) {
    const list = (root || document).querySelectorAll('.demo:not(.none):not([data-mounted])');
    if (!list.length) return;
    if (!demoIO && 'IntersectionObserver' in window)
      demoIO = new IntersectionObserver((entries) => entries.forEach((en) => demoVisible(en.target, en.isIntersecting)), { rootMargin: '200px 0px' });
    list.forEach((el) => {
      el.dataset.mounted = '1';
      if (demoIO) demoIO.observe(el);
      else demoVisible(el, true);
    });
  };
  /** Pre-cache the demonstrations for a workout so they're available offline at the gym. */
  WT.warmDemos = function (exIds) {
    if (!('fetch' in window)) return;
    exIds.forEach((id) => {
      const d = WT.demoFor(id);
      if (d) d.frames.forEach((u) => fetch(u).catch(() => {}));
    });
  };
  WT.A.openDemo = (d) => {
    const ex = WT.ex(d.id);
    if (!ex) return;
    WT.openSheet(() => ({
      eyebrow: WT.muscleName(ex.primary),
      title: esc(ex.name),
      body: `${WT.h.demo(ex.id, 'lg', { static: true, variation: d.v })}${WT.h.demoCredit(ex.id, d.v)}${ex.cue ? `<p class="mt16" style="line-height:1.6">${esc(ex.cue)}</p>` : ''}`,
      foot: `<a class="btn btn-plain btn-sm" href="${esc(WT.videoUrl(ex))}" target="_blank" rel="noopener">${I('play', 14)}Video tutorial</a><span class="grow"></span><button class="btn btn-secondary btn-sm" data-act="exDetail" data-id="${ex.id}">Details</button>`,
    }), { wide: true });
  };

  /* ───────── Boot ───────── */
  WT.boot = function () {
    WT.load();
    WT.applyTheme();
    shell();
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onInput);
    // <details> panels are re-created on every re-render, so their open state must live in UI state.
    // 'toggle' doesn't bubble, hence the capture-phase listener. See WT.h.keepOpen().
    document.addEventListener('toggle', (e) => {
      const el = e.target;
      if (el && el.tagName === 'DETAILS' && el.dataset.keep) WT.ui.open[el.dataset.keep] = el.open;
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sheets.length) WT.closeSheet();
      if (e.key === 'Enter' && e.target.classList.contains('set-input')) {
        e.preventDefault();
        const row = e.target.closest('tr');
        const inputs = [...document.querySelectorAll('.set-input')];
        const idx = inputs.indexOf(e.target);
        const nextInRow = inputs[idx + 1] && inputs[idx + 1].closest('tr') === row ? inputs[idx + 1] : null;
        if (nextInRow) nextInRow.focus();
        else {
          const btn = row.querySelector('.check');
          if (btn && !btn.classList.contains('on')) btn.click();
        }
      }
    });
    window.addEventListener('hashchange', () => WT.render());
    // Views and sheets are re-rendered with innerHTML; wire up any new demonstrations as they appear.
    new MutationObserver(() => WT.mountDemos()).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('beforeunload', () => WT.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) WT.flush();
      else tick();
    });
    let rz;
    window.addEventListener('resize', () => {
      clearTimeout(rz);
      rz = setTimeout(() => {
        const after = WT.V[WT.ui.route + 'After'];
        if (after) after(WT.ui.param);
      }, 200);
    });
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', WT.applyTheme);
    setInterval(tick, 250);
    if (!location.hash) history.replaceState(null, '', WT.db.active ? '#/workout' : '#/dashboard');
    WT.render();
    if (WT.ach) WT.ach.schedule();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  };
})();
