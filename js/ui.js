/* UI framework: shell, router, event delegation, sheets, toasts, rest timer. */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const $ = (s, r) => (r || document).querySelector(s);
  WT.$ = $;
  WT.A = {}; // click actions:  data-act="name"
  WT.I = {}; // input handlers: data-in="name"
  WT.V = {}; // views
  WT.ui = { route: 'dashboard', param: null, gen: null, lib: { q: '', group: '', equip: '', cat: '', diff: '', intensity: '', avail: 'mine', fav: false }, prog: { ex: null, metric: 'e1rm' } };
  const I = WT.icon;
  const esc = WT.esc;

  const NAV = [
    { id: 'dashboard', name: 'Dashboard', short: 'Home', icon: 'home' },
    { id: 'generate', name: 'Generate Workout', short: 'Generate', icon: 'sparkles' },
    { id: 'workout', name: 'Active Workout', short: 'Workout', icon: 'activity' },
    { id: 'library', name: 'Exercise Library', short: 'Library', icon: 'book' },
    { id: 'history', name: 'Workout History', short: 'History', icon: 'clock' },
    { id: 'progress', name: 'Progress & Stats', short: 'Progress', icon: 'chart' },
    { id: 'settings', name: 'Settings', short: 'Settings', icon: 'settings' },
  ];
  WT.NAV = NAV;

  /* ───────── Shell ───────── */
  function shell() {
    const active = !!WT.db.active;
    const navItems = NAV.map(
      (n) => `<a href="#/${n.id}" class="nav-item" data-nav="${n.id}">${I(n.icon, 19)}<span>${n.name}</span>${n.id === 'workout' && active ? '<span class="nav-dot"></span>' : ''}</a>`
    ).join('');
    const tabs = NAV.filter((n) => n.id !== 'settings' && n.id !== 'library')
      .concat([NAV[3]])
      .map((n) => `<a href="#/${n.id}" class="tab" data-nav="${n.id}">${I(n.icon, 22)}<span>${n.short}</span>${n.id === 'workout' && active ? '<span class="nav-dot"></span>' : ''}</a>`)
      .join('');
    document.getElementById('app').innerHTML = `
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark">${I('dumbbell', 18)}</div>Forge</div>
        ${navItems}
        <div class="sidebar-foot">Data stays on this device.<br/>Works offline.</div>
      </aside>
      <header class="topbar"><h1 id="topTitle"></h1><div id="topActions" class="row" style="gap:2px"></div>
        <a class="icon-btn" href="#/settings" aria-label="Settings">${I('settings', 20)}</a></header>
      <main class="main" id="main"></main>
      <nav class="tabbar">${tabs}</nav>
      <div id="timerHost"></div>
      <div class="toasts" id="toasts"></div>`;
  }
  WT.refreshShell = function () {
    const active = !!WT.db.active;
    document.querySelectorAll('[data-nav="workout"]').forEach((a) => {
      const dot = a.querySelector('.nav-dot');
      if (active && !dot) a.insertAdjacentHTML('beforeend', '<span class="nav-dot"></span>');
      if (!active && dot) dot.remove();
    });
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
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === route));
    const nav = NAV.find((n) => n.id === route);
    $('#topTitle').textContent = route === 'history' && param ? 'Workout' : nav.short === 'Home' ? greeting() : nav.name;
    document.title = (nav ? nav.name + ' · ' : '') + 'Forge';
    const after = WT.V[route + 'After'];
    if (after) requestAnimationFrame(() => after(param));
    WT.refreshShell();
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
    ov.className = 'overlay';
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
      <div class="sheet-head"><h2>${r.title || ''}</h2>${r.headExtra || ''}<button class="icon-btn" data-act="closeSheet" aria-label="Close">${I('x', 20)}</button></div>
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
      body: `<p class="muted">${message}</p>`,
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
    const C = 2 * Math.PI * 18;
    const f = t.total ? left / t.total : 0;
    host.innerHTML = `<div class="timer-bar ${done ? 'done' : ''}" role="timer">
      <svg class="timer-ring" viewBox="0 0 44 44" style="transform:rotate(-90deg)"><circle cx="22" cy="22" r="18" fill="none" stroke="var(--surface-3)" stroke-width="4"/>
      <circle id="timerArc" cx="22" cy="22" r="18" fill="none" stroke="${done ? 'var(--good)' : 'var(--accent)'}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - f)}"/></svg>
      <div><div class="t num" id="timerText">${done ? 'Go!' : WT.fmtClock(left)}</div><div class="lbl ellipsis" style="max-width:120px">${esc(t.label)}</div></div>
      <div class="grow"></div>
      <button class="btn btn-secondary btn-sm num" data-act="timerAdd" data-s="-15">−15</button>
      <button class="btn btn-secondary btn-sm num" data-act="timerAdd" data-s="15">+15</button>
      <button class="btn btn-sm ${done ? 'btn-good' : 'btn-ghost'}" data-act="timerStop">${done ? 'Done' : 'Skip'}</button>
    </div>`;
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
        if (arc) {
          const C = 2 * Math.PI * 18;
          arc.setAttribute('stroke-dashoffset', C * (1 - left / t.total));
        }
      }
      if (left === 0 && Date.now() - t.end > 60000) {
        a.timer = null;
        WT.save();
        WT.renderTimer();
      }
    }
    const clock = $('#woClock');
    if (clock && a) clock.textContent = WT.fmtClock((Date.now() - new Date(a.startedAt)) / 1000);
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
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f4f6' : '#0b0b0c');
  };

  /* ───────── Shared render helpers ───────── */
  WT.h = {
    intensity(int, act, uid) {
      const label = { heavy: 'Heavy', regular: 'Regular', burnout: 'Burnout' }[int] || int;
      return act
        ? `<button class="badge ${int}" data-act="${act}" data-uid="${uid}" title="Tap to change intensity"><span class="dot"></span>${label}</button>`
        : `<span class="badge ${int}"><span class="dot"></span>${label}</span>`;
    },
    muscles(ex) {
      return `${WT.muscleName(ex.primary)}${ex.secondary.length ? `<span class="faint"> · ${ex.secondary.slice(0, 2).map(WT.muscleName).join(', ')}</span>` : ''}`;
    },
    target(item, ex) {
      const tt = WT.trackType(ex);
      if (tt === 'cardio') return `${item.repMin}–${item.repMax} min`;
      const unit = tt === 'time' || ex.unit === 'sec' ? 's' : '';
      return `${item.sets || item.targetSets} × ${item.repMin}${item.repMax !== item.repMin ? '–' + item.repMax : ''}${unit}`;
    },
    empty(icon, title, text, action) {
      return `<div class="empty"><div class="avatar">${I(icon, 24)}</div><h3>${title}</h3><p>${text}</p>${action ? `<div class="mt16">${action}</div>` : ''}</div>`;
    },
    chipGroup(items, selected, act, extra) {
      const sel = new Set(selected);
      return `<div class="chips">${Object.entries(items)
        .map(([k, v]) => `<button class="chip ${extra || ''} ${sel.has(k) ? 'on' : ''}" data-act="${act}" data-k="${k}">${esc(v)}</button>`)
        .join('')}</div>`;
    },
    toggle(on, act, extra) {
      return `<button class="toggle ${on ? 'on' : ''}" role="switch" aria-checked="${!!on}" data-act="${act}" ${extra || ''}></button>`;
    },
    stepper(val, act, key, min, max) {
      return `<div class="stepper"><button data-act="${act}" data-k="${key}" data-d="-1" data-min="${min}" data-max="${max}" aria-label="Decrease">${I('minus', 16)}</button><span class="val">${val}</span><button data-act="${act}" data-k="${key}" data-d="1" data-min="${min}" data-max="${max}" aria-label="Increase">${I('plus', 16)}</button></div>`;
    },
    seg(options, current, act, key) {
      return `<div class="seg">${options.map(([v, l]) => `<button class="${String(v) === String(current) ? 'on' : ''}" data-act="${act}" data-k="${key || ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
    },
  };

  /* ───────── Boot ───────── */
  WT.boot = function () {
    WT.load();
    WT.applyTheme();
    shell();
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onInput);
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
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  };
})();
