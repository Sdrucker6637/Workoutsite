/* Lightweight SVG charts with hover/touch tooltips. No dependencies. */
(function () {
  const WT = (globalThis.WT = globalThis.WT || {});
  const NS = 'http://www.w3.org/2000/svg';

  function niceTicks(min, max, count) {
    if (min === max) {
      min = min - 1;
      max = max + 1;
    }
    const span = max - min;
    const step0 = span / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(6));
    return ticks;
  }
  const fmtTick = (v) => (Math.abs(v) >= 10000 ? Math.round(v / 1000) + 'k' : WT.fmtNum(v));

  function setup(el, height) {
    el.innerHTML = '';
    el.classList.add('chart');
    const w = Math.max(240, el.clientWidth || 600);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${height}`);
    svg.setAttribute('height', height);
    svg.setAttribute('role', 'img');
    el.appendChild(svg);
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    el.appendChild(tip);
    return { svg, tip, w, h: height };
  }
  function node(parent, tag, attrs, text) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    parent.appendChild(n);
    return n;
  }
  function showTip(c, x, y, html) {
    c.tip.innerHTML = html;
    const left = Math.max(60, Math.min(c.w - 60, x));
    c.tip.style.left = left + 'px';
    c.tip.style.top = y + 'px';
    c.tip.classList.add('show');
  }
  const hideTip = (c) => c.tip.classList.remove('show');

  /** Line chart. points: [{x: Date|string, y: number, tip?: string}] */
  WT.lineChart = function (el, points, opts) {
    opts = opts || {};
    const H = opts.height || 220;
    const c = setup(el, H);
    const pad = { l: 44, r: 14, t: 14, b: 28 };
    const pts = points.map((p) => ({ x: new Date(p.x).getTime(), y: p.y, tip: p.tip }));
    if (!pts.length) return;
    const ys = pts.map((p) => p.y);
    let yMin = Math.min(...ys), yMax = Math.max(...ys);
    const padY = (yMax - yMin) * 0.15 || Math.max(1, yMax * 0.1);
    yMin = Math.max(opts.zero ? 0 : -Infinity, yMin - padY);
    yMax = yMax + padY;
    const ticks = niceTicks(yMin, yMax, 4);
    yMin = ticks[0];
    yMax = ticks[ticks.length - 1];
    let xMin = Math.min(...pts.map((p) => p.x)), xMax = Math.max(...pts.map((p) => p.x));
    if (xMin === xMax) {
      xMin -= 3 * 864e5;
      xMax += 3 * 864e5;
    }
    const X = (x) => pad.l + ((x - xMin) / (xMax - xMin)) * (c.w - pad.l - pad.r);
    const Y = (y) => pad.t + (1 - (y - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
    ticks.forEach((t) => {
      node(c.svg, 'line', { x1: pad.l, x2: c.w - pad.r, y1: Y(t), y2: Y(t), class: 'grid-line' });
      node(c.svg, 'text', { x: pad.l - 8, y: Y(t) + 4, 'text-anchor': 'end', class: 'axis-text' }, fmtTick(t));
    });
    // X labels: first, middle, last
    const xl = pts.length > 2 ? [pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]] : pts;
    const seen = new Set();
    xl.forEach((p, i) => {
      const label = WT.fmtDate(p.x, { month: 'short', day: 'numeric' });
      if (seen.has(label)) return;
      seen.add(label);
      node(c.svg, 'text', { x: X(p.x), y: H - 8, 'text-anchor': xl.length === 1 ? 'middle' : i === 0 ? 'start' : i === xl.length - 1 ? 'end' : 'middle', class: 'axis-text' }, label);
    });
    const color = opts.color || 'var(--forest)';
    const d = pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
    if (pts.length > 1) {
      const area = d + ` L${X(pts[pts.length - 1].x).toFixed(1)} ${Y(yMin)} L${X(pts[0].x).toFixed(1)} ${Y(yMin)} Z`;
      node(c.svg, 'path', { d: area, fill: color, opacity: 0.07 });
      node(c.svg, 'path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    }
    pts.forEach((p) => node(c.svg, 'circle', { cx: X(p.x), cy: Y(p.y), r: 4, fill: color, stroke: 'var(--paper)', 'stroke-width': 2 }));
    // Hover layer
    const cross = node(c.svg, 'line', { y1: pad.t, y2: H - pad.b, stroke: 'var(--text-3)', 'stroke-width': 1, opacity: 0 });
    const hl = node(c.svg, 'circle', { r: 6, fill: color, stroke: 'var(--paper)', 'stroke-width': 2, opacity: 0 });
    const hit = node(c.svg, 'rect', { x: pad.l, y: 0, width: c.w - pad.l - pad.r, height: H, fill: 'transparent' });
    const move = (ev) => {
      const r = c.svg.getBoundingClientRect();
      const mx = ((ev.clientX - r.left) / r.width) * c.w;
      let best = pts[0];
      pts.forEach((p) => {
        if (Math.abs(X(p.x) - mx) < Math.abs(X(best.x) - mx)) best = p;
      });
      cross.setAttribute('x1', X(best.x));
      cross.setAttribute('x2', X(best.x));
      cross.setAttribute('opacity', 0.5);
      hl.setAttribute('cx', X(best.x));
      hl.setAttribute('cy', Y(best.y));
      hl.setAttribute('opacity', 1);
      const sx = (X(best.x) / c.w) * r.width;
      const sy = (Y(best.y) / H) * r.height;
      showTip(c, sx, sy, best.tip || `<b>${WT.fmtNum(best.y)}</b> · ${WT.fmtDate(best.x)}`);
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => {
      cross.setAttribute('opacity', 0);
      hl.setAttribute('opacity', 0);
      hideTip(c);
    });
  };

  /** Vertical bar chart. bars: [{label, value, tip}] ; opts.ref = reference line value */
  WT.barChart = function (el, bars, opts) {
    opts = opts || {};
    const H = opts.height || 200;
    const c = setup(el, H);
    const pad = { l: 30, r: 8, t: 14, b: 26 };
    const maxV = Math.max(opts.ref || 0, ...bars.map((b) => b.value), 1);
    const ticks = niceTicks(0, maxV, Math.min(4, Math.ceil(maxV)));
    const yMax = ticks[ticks.length - 1];
    const Y = (v) => pad.t + (1 - v / yMax) * (H - pad.t - pad.b);
    ticks.forEach((t) => {
      node(c.svg, 'line', { x1: pad.l, x2: c.w - pad.r, y1: Y(t), y2: Y(t), class: 'grid-line' });
      node(c.svg, 'text', { x: pad.l - 8, y: Y(t) + 4, 'text-anchor': 'end', class: 'axis-text' }, fmtTick(t));
    });
    const slot = (c.w - pad.l - pad.r) / bars.length;
    const bw = Math.min(28, slot - 2 - slot * 0.3);
    bars.forEach((b, i) => {
      const cx = pad.l + slot * i + slot / 2;
      const y = Y(b.value);
      const h = Math.max(0, H - pad.b - y);
      if (h > 0) {
        const r = Math.min(4, h, bw / 2);
        const x = cx - bw / 2, yb = H - pad.b;
        node(c.svg, 'path', {
          d: `M${x} ${yb} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} L${x + bw - r} ${y} Q${x + bw} ${y} ${x + bw} ${y + r} L${x + bw} ${yb} Z`,
          fill: b.highlight ? 'var(--forest)' : opts.color || 'var(--paper-3)',
        });
      }
      if (b.label && (bars.length <= 12 || i % 2 === 0)) node(c.svg, 'text', { x: cx, y: H - 8, 'text-anchor': 'middle', class: 'axis-text' }, b.label);
      const hit = node(c.svg, 'rect', { x: cx - slot / 2, y: pad.t, width: slot, height: H - pad.t - pad.b, fill: 'transparent' });
      const show = () => {
        const r = c.svg.getBoundingClientRect();
        showTip(c, (cx / c.w) * r.width, (Math.min(y, H - pad.b - 4) / H) * r.height, b.tip || `<b>${WT.fmtNum(b.value)}</b>`);
      };
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('pointerdown', show);
      hit.addEventListener('pointerleave', () => hideTip(c));
    });
    if (opts.ref) {
      node(c.svg, 'line', { x1: pad.l, x2: c.w - pad.r, y1: Y(opts.ref), y2: Y(opts.ref), class: 'ref-line' });
      node(c.svg, 'text', { x: c.w - pad.r, y: Y(opts.ref) - 5, 'text-anchor': 'end', class: 'ref-text' }, opts.refLabel || 'Goal');
    }
  };

  /** Small progress ring SVG markup. */
  WT.ring = function (value, max, size, color) {
    size = size || 64;
    const sw = size * 0.13;
    const r = (size - sw) / 2;
    const C = 2 * Math.PI * r;
    const f = Math.min(1, max ? value / max : 0);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--paper-3)" stroke-width="${sw}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color || 'var(--forest)'}" stroke-width="${sw}" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - f)}" style="transition:stroke-dashoffset .8s var(--ease)"/>
    </svg>`;
  };
})();
