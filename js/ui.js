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
    { id: 'dashboard', name: 'Today', icon: 'home' },
    { id: 'generate', name: 'Generate', icon: 'sparkles' },
    { id: 'workout', name: 'Train', icon: 'activity' },
    { id: 'library', name: 'Library', icon: 'book' },
    { id: 'history', name: 'Log', icon: 'clock' },
    { id: 'progress', name: 'Progress', icon: 'chart' },
    { id: 'settings', name: 'Settings', icon: 'settings' },
  ];
  WT.NAV = NAV;

  /* ───────── Shell ───────── */
  function shell() {
    const navItems = NAV.map((n, i) => `<a href="#/${n.id}" class="nav-item" data-nav="${n.id}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span>${n.name}</span><span class="slot"></span></a>`).join('');
    const tabs = ['dashboard', 'generate', 'workout', 'history', 'progress']
      .map((id) => NAV.find((n) => n.id === id))
      .map((n) => `<a href="#/${n.id}" class="tab" data-nav="${n.id}">${I(n.icon, 22)}<span>${n.name}</span><span class="slot"></span></a>`)
      .join('');
    document.getElementById('app').innerHTML = `
      <aside class="rail">
        <a href="#/dashboard" class="wordmark">Forge</a>
        <div class="eyebrow wordmark-sub">A training journal</div>
        <nav class="rail-nav" aria-label="Main">${navItems}</nav>
        <div class="rail-foot" id="railFoot"></div>
      </aside>
      <header class="mbar" id="mbar"></header>
      <main class="main" id="main"></main>
      <nav class="tabbar" aria-label="Main">${tabs}</nav>
      <div id="timerHost"></div>
      <div class="toasts" id="toasts" role="status" aria-live="polite"></div>`;
  }
  WT.refreshShell = function () {
    const a = WT.db.active;
    document.querySelectorAll('[data-nav="workout"] .slot').forEach((el) => (el.innerHTML = a ? '<span class="live-dot" title="Workout in progress"></span>' : ''));
    const foot = $('#railFoot');
    if (foot)
      foot.innerHTML = a
        ? `<a class="rail-live" href="#/workout"><div class="eyebrow" style="color:var(--forest)">In session</div><div class="t" id="railClock">${WT.fmtClock((Date.now() - new Date(a.startedAt)) / 1000)}</div><div class="small muted ellipsis">${esc(a.title)}</div></a>`
        : `<div class="rail-live"><div class="eyebrow">Private by design</div><p class="small faint mt8">Everything stays on this device and works offline.</p></div>`;
    const focus = WT.ui.route === 'workout' && !!a;
    document.body.classList.toggle('focus', focus);
    const mb = $('#mbar');
    if (mb) {
      if (focus)
        mb.innerHTML = `<a class="icon-btn" href="#/dashboard" aria-label="Leave workout screen (keeps running)">${I('chevL', 22)}</a>
          <div class="grow" style="padding-left:4px"><div class="eyebrow" style="color:var(--forest)">In session</div><div class="mono" id="mbClock" style="font-size:17px;line-height:1.1">${WT.fmtClock((Date.now() - new Date(a.startedAt)) / 1000)}</div></div>
          <button class="btn btn-primary btn-sm" data-act="woFinish">Finish</button>`;
      else {
        const nav = NAV.find((n) => n.id === WT.ui.route) || NAV[0];
        mb.innerHTML = `<a href="#/dashboard" class="wordmark">Forge</a><span class="eyebrow sec">${WT.ui.route === 'history' && WT.ui.param ? 'Entry' : nav.name}</span><span class="grow"></span>
          <a class="icon-btn" href="#/library" aria-label="Exercise library" data-nav="library">${I('book', 20)}</a>
          <a class="icon-btn" href="#/settings" aria-label="Settings" data-nav="settings">${I('settings', 20)}</a>`;
      }
    }
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
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === route));
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
      <div class="sheet-head"><div class="grow">${r.eyebrow ? `<div class="eyebrow">${r.eyebrow}</div>` : ''}<h2>${r.title || ''}</h2></div>${r.headExtra || ''}<button class="icon-btn" data-act="closeSheet" aria-label="Close">${I('x', 20)}</button></div>
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
      body: `<p class="lead" style="font-size:18px">${message}</p>`,
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
    host.innerHTML = `<div class="dock ${done ? 'done' : ''}" role="timer" aria-live="off">
      <div class="dock-bar"><i id="timerArc" style="width:${f * 100}%"></i></div>
      <div class="dock-in"><div style="min-width:0"><div class="dock-lbl ellipsis">${done ? 'Rest complete — next set' : esc(t.label)}</div><div class="dock-time" id="timerText">${done ? '0:00' : WT.fmtClock(left)}</div></div>
      <div class="dock-btns">
        <button class="btn btn-secondary btn-sm" data-act="timerAdd" data-s="-15" aria-label="Subtract 15 seconds">−15</button>
        <button class="btn btn-secondary btn-sm" data-act="timerAdd" data-s="15" aria-label="Add 15 seconds">+15</button>
        <button class="btn btn-sm ${done ? 'btn-primary' : 'btn-ink'}" data-act="timerStop">${done ? 'Go' : 'Skip'}</button>
      </div></div></div>`;
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
      ['#woClock', '#railClock', '#mbClock', '#dashClock'].forEach((sel) => {
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
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f3efe6' : '#151513');
  };

  /* ───────── Shared render helpers ───────── */
  WT.h = {
    intensity(int, act, uid, ctx) {
      const label = (WT.INTENSITY_INFO[int] || { name: int }).name;
      return act
        ? `<button class="imark ${int}" data-act="${act}" data-uid="${uid}" ${ctx ? `data-ctx="${ctx}"` : ''} title="Change intensity" aria-label="Intensity: ${label}. Change">${label}</button>`
        : `<span class="imark ${int}">${label}</span>`;
    },
    muscles(ex) {
      return `${WT.muscleName(ex.primary)}${ex.secondary.length ? ` · ${ex.secondary.slice(0, 2).map(WT.muscleName).join(', ')}` : ''}`;
    },
    target(item, ex) {
      const tt = WT.trackType(ex);
      if (tt === 'cardio') return `${item.repMin}–${item.repMax} min`;
      const unit = tt === 'time' || ex.unit === 'sec' ? 's' : '';
      return `${item.sets || item.targetSets} × ${item.repMin}${item.repMax !== item.repMin ? '–' + item.repMax : ''}${unit}`;
    },
    empty(icon, title, text, action) {
      return `<div class="empty"><h3>${title}</h3><p>${text}</p>${action ? `<div class="mt24 row wrap">${action}</div>` : ''}</div>`;
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
      return `<div class="stepper"><button data-act="${act}" data-k="${key}" data-d="-1" data-min="${min}" data-max="${max}" aria-label="Decrease">${I('minus', 16)}</button><span class="val">${val}</span><button data-act="${act}" data-k="${key}" data-d="1" data-min="${min}" data-max="${max}" aria-label="Increase">${I('plus', 16)}</button></div>`;
    },
    seg(options, current, act, key, cls) {
      return `<div class="seg ${cls || ''}" role="group">${options.map(([v, l]) => `<button class="${String(v) === String(current) ? 'on' : ''}" data-act="${act}" data-k="${key || ''}" data-v="${v}" aria-pressed="${String(v) === String(current)}">${l}</button>`).join('')}</div>`;
    },
    oddsBar(odds) {
      const keys = ['heavy', 'regular', 'burnout', 'standard'];
      const tot = keys.reduce((a, k) => a + Math.max(0, +odds[k] || 0), 0) || 1;
      return `<div class="oddsbar">${keys.map((k) => `<i class="${k}" style="width:${(Math.max(0, +odds[k] || 0) / tot) * 100}%"></i>`).join('')}</div>`;
    },
    pct(odds, k) {
      const tot = ['heavy', 'regular', 'burnout', 'standard'].reduce((a, x) => a + Math.max(0, +odds[x] || 0), 0) || 1;
      return Math.round((Math.max(0, +odds[k] || 0) / tot) * 100);
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
