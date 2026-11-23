/* Barcode scanning for food logging.
 *
 *   Food → Scan barcode → camera → product found (your foods → cache → Open Food Facts → USDA Branded)
 *        → review (amount, meal) → diary.   Not found → search by name, or enter it from the label (saved with its
 *        barcode, so the next scan finds it instantly, even offline).
 *
 * Decoding: the browser's BarcodeDetector where it exists (Chrome on Android, some desktop browsers); otherwise the
 * bundled ZXing decoder (js/vendor/zxing.min.js, Apache-2.0), loaded only when you open the scanner — that covers
 * iOS Safari and Firefox. Codes are accepted only with a valid GS1 check digit, and (with ZXing) after two matching
 * reads. Typing the digits always works, with or without a camera.
 */
(function () {
  const WT = globalThis.WT;
  const I = WT.icon, esc = WT.esc, A = WT.A, N = WT.nut;
  const L = () => WT.lookup;
  const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

  /* ───────── Decoders ───────── */
  let zxingP = null;
  function loadZXing() {
    if (globalThis.ZXing) return Promise.resolve(globalThis.ZXing);
    if (zxingP) return zxingP;
    zxingP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/zxing.min.js';
      s.async = true;
      s.onload = () => (globalThis.ZXing ? res(globalThis.ZXing) : rej(new Error('Decoder unavailable')));
      s.onerror = () => {
        zxingP = null;
        rej(new Error('Couldn’t load the barcode decoder'));
      };
      document.head.appendChild(s);
    });
    return zxingP;
  }
  /** → { name, detect(source) → Promise<string|null> } */
  async function makeDecoder() {
    if ('BarcodeDetector' in globalThis) {
      try {
        const supported = await globalThis.BarcodeDetector.getSupportedFormats();
        const fmts = FORMATS.filter((f) => supported.includes(f));
        if (fmts.length) {
          const det = new globalThis.BarcodeDetector({ formats: fmts });
          return { name: 'native', detect: async (src) => ((await det.detect(src))[0] || {}).rawValue || null };
        }
      } catch (e) {}
    }
    const Z = await loadZXing();
    const reader = new Z.MultiFormatReader();
    const hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    reader.setHints(hints);
    return {
      name: 'zxing',
      detect: async (canvas) => {
        try {
          const lum = new Z.HTMLCanvasElementLuminanceSource(canvas);
          const r = reader.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(lum)));
          return r ? r.getText() : null;
        } catch (e) {
          return null; // nothing found in this frame
        }
      },
    };
  }
  WT.scanDecoder = makeDecoder; // exposed for tests

  /** UPC-E → UPC-A, so a short code and its long form find the same product. */
  function upcEtoA(e) {
    e = String(e);
    if (e.length !== 8) return e;
    const [ns, d1, d2, d3, d4, d5, d6, ck] = e.split('');
    let m;
    if ('012'.includes(d6)) m = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
    else if (d6 === '3') m = `${d1}${d2}${d3}00000${d4}${d5}`;
    else if (d6 === '4') m = `${d1}${d2}${d3}${d4}00000${d5}`;
    else m = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
    return ns + m + ck;
  }
  WT.upcEtoA = upcEtoA;

  /* ───────── Camera ───────── */
  function cameraProblem(e) {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError') return 'Camera access was blocked. Allow the camera for this site in your browser settings (on iPhone: Settings → Safari → Camera), or type the barcode number below.';
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No camera was found on this device. Type the barcode number below.';
    if (n === 'NotReadableError' || n === 'AbortError') return 'The camera is in use by another app. Close it and try again, or type the number below.';
    return 'The camera couldn’t start. Type the barcode number below.';
  }

  /* ───────── Scanner sheet ───────── */
  A.foodScan = () => {
    const st = { phase: 'scan', msg: 'Starting camera…', code: '', manual: '', result: null, errors: [], decoder: null };
    let stream = null, timer = null, stopped = false, last = '', hits = 0;
    const canvas = document.createElement('canvas');
    const stop = () => {
      stopped = true;
      clearInterval(timer);
      timer = null;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
    };
    const body = () => {
      if (st.phase === 'scan')
        return `<div class="scan-view"><video id="scanVideo" playsinline muted autoplay></video><div class="scan-guide" aria-hidden="true"></div></div>
          <p class="footnote t2 mt8" id="scanMsg" aria-live="polite">${esc(st.msg)}</p>
          ${manualBox()}`;
      if (st.phase === 'looking') return `<p class="t2">Looking up <b class="tnum">${esc(st.code)}</b>…</p><p class="footnote t3 mt8">Your foods first, then Open Food Facts and USDA.</p>`;
      if (st.phase === 'found') return foundCard();
      return notFound();
    };
    const manualBox = () => `<div class="scan-manual mt12"><label class="label" for="scanCode">Or type the barcode number</label>
      <div class="row mt8" style="gap:8px"><input class="input grow tnum" id="scanCode" data-in="scanCode" inputmode="numeric" autocomplete="off" placeholder="e.g. 0 12345 67890 5" value="${esc(st.manual)}"><button class="btn btn-secondary" data-act="scanManual">Look up</button></div></div>`;
    function foundCard() {
      const it = st.result;
      const t = N.itemTotals(it);
      const rec = it.foodId && it.foodId.startsWith('x:') ? L().cached(it.foodId.slice(2)) : null;
      const p100 = rec && rec.per100;
      return `<div class="scan-found">
        <div class="footnote t3 tnum">Barcode ${esc(st.code)}${st.from === 'library' ? ' · in your foods' : st.from === 'bundled' ? ' · in Forge’s product list' : st.from === 'cache' ? ' · found earlier' : st.from === 'off' ? ' · Open Food Facts' : st.from === 'fdc' ? ' · USDA FoodData Central' : ''}</div>
        <h3 class="mt4">${esc(it.name)}</h3>
        <div class="rv-meta">${WT.foodConfTag(it.conf)}${it.brand ? `<span class="t2">${esc(it.brand)}</span>` : ''}</div>
        <div class="scan-macros tnum mt12"><div><b>${t.cal == null || it.per.cal == null ? '—' : N.rcal(t.cal)}</b><span>cal</span></div><div><b>${it.per.p == null ? '—' : N.rp(t.p)}</b><span>protein</span></div><div><b>${it.per.c == null ? '—' : N.rg(t.c)}</b><span>carbs</span></div><div><b>${it.per.f == null ? '—' : N.rg(t.f)}</b><span>fat</span></div></div>
        <p class="footnote t2 mt8">Per ${esc(N.fmtAmount(it.qty, it.unit))}${it.note ? ' · ' + esc(it.note) : ''}</p>
        ${p100 ? `<p class="footnote t3">Per 100 g: ${p100.cal == null ? '—' : Math.round(p100.cal)} cal · ${p100.p == null ? '—' : p100.p} g protein · ${p100.c == null ? '—' : p100.c} g carbs · ${p100.f == null ? '—' : p100.f} g fat</p>` : ''}
        ${it.conf === 'estimated' ? `<p class="footnote scan-warn mt8">${I('info', 13)} Community data. Compare it with the label before relying on it; you can correct it after adding.</p>` : ''}
      </div>`;
    }
    function notFound() {
      return `<div class="scan-none"><h3>${st.errors.length ? 'Couldn’t look it up' : 'Product not found'}</h3>
        <p class="t2 mt8">${st.errors.length ? esc(st.errors.map((e) => e.text).join(' ')) : `Barcode <b class="tnum">${esc(st.code)}</b> isn’t in Open Food Facts or USDA. Forge never substitutes a generic food for it.`}</p>
        <div class="fstack mt16" style="gap:8px">
          <button class="btn btn-primary" data-act="scanLabel">${I('edit', 15)}Enter it from the label</button>
          <button class="btn btn-secondary" data-act="scanSearch">${I('search', 15)}Search by name</button>
          ${st.errors.length ? `<button class="btn btn-plain" data-act="scanRetry">Try the lookup again</button>` : ''}
        </div><p class="footnote t3 mt12">Products you enter are saved with this barcode, so scanning it again finds them instantly — even offline.</p></div>`;
    }
    WT.openSheet(() => ({
      title: 'Scan barcode',
      body: body(),
      foot: st.phase === 'found' ? `<button class="btn btn-plain btn-sm" data-act="scanAgain">Scan another</button><span class="grow"></span><button class="btn btn-primary" data-act="scanAdd">Add to diary</button>` : `<span class="grow"></span><button class="btn btn-secondary" data-act="closeSheet">Close</button>`,
      after: (sh) => {
        if (st.phase === 'scan' && !stream && !stopped) start(sh);
      },
    }), { onClose: stop });

    async function start(sh) {
      const video = sh.querySelector('#scanVideo');
      const msg = (t) => {
        st.msg = t;
        const el = document.getElementById('scanMsg');
        if (el) el.textContent = t;
      };
      if (!globalThis.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        msg('The camera needs a secure (https) connection and a supported browser. Type the barcode number below.');
        return sh.querySelector('.scan-view') && sh.querySelector('.scan-view').classList.add('off');
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch (e) {
        msg(cameraProblem(e));
        const v = document.querySelector('.scan-view');
        if (v) v.classList.add('off');
        return;
      }
      if (stopped) return stop();
      const vid = document.getElementById('scanVideo') || video;
      vid.srcObject = stream;
      try {
        await vid.play();
      } catch (e) {}
      msg('Hold the barcode inside the frame. It scans by itself.');
      try {
        st.decoder = await makeDecoder();
      } catch (e) {
        msg(`${e.message}. Type the barcode number below.`);
        return;
      }
      timer = setInterval(async () => {
        const v = document.getElementById('scanVideo');
        if (!v || !v.videoWidth || stopped) return;
        let code = null;
        if (st.decoder.name === 'native') code = await st.decoder.detect(v);
        else {
          // the middle band of the frame, at most 960 px wide: faster and fewer false reads
          const k = Math.min(1, 960 / v.videoWidth);
          canvas.width = Math.round(v.videoWidth * k);
          canvas.height = Math.round(v.videoHeight * k * 0.5);
          canvas.getContext('2d', { willReadFrequently: true }).drawImage(v, 0, v.videoHeight * 0.25, v.videoWidth, v.videoHeight * 0.5, 0, 0, canvas.width, canvas.height);
          code = await st.decoder.detect(canvas);
        }
        if (!code) return;
        const norm = code.length === 8 && code[0] === '0' && st.decoder.name !== 'native' ? code : code;
        if (!L().validCode(norm)) return;
        hits = norm === last ? hits + 1 : 1;
        last = norm;
        if (st.decoder.name === 'native' || hits >= 2) {
          if (navigator.vibrate) navigator.vibrate(60);
          lookup(norm);
        }
      }, 220);
    }
    async function lookup(code) {
      stop();
      stopped = false;
      st.code = code;
      st.phase = 'looking';
      WT.refreshSheet();
      const tries = code.length === 8 && /^[01]/.test(code) ? [code, upcEtoA(code)] : [code];
      let r = null;
      for (const c of tries) {
        r = await L().barcode(c);
        if (r.libId || r.ref || r.rec || (r.errors && r.errors.length)) break;
      }
      st.errors = (r && r.errors) || [];
      st.from = r && r.from;
      if (r && (r.libId || r.ref || r.rec)) {
        st.result = N.resolveAs({ id: WT.uid(), text: '', qty: 1, phrase: '' }, r.libId ? 'my:' + r.libId : r.ref || 'x:' + r.rec.id);
        if (r.ref && r.flavor) {
          // the barcode is one flavor of a product whose flavors share a label
          st.result.flavor = r.flavor;
          st.result.name = N.productName(N.productById(r.ref.slice(2)), r.flavor);
        }
        st.result.match = 'exact';
        st.result.key = 'scan:' + code;
        st.phase = 'found';
      } else st.phase = 'none';
      WT.refreshSheet();
    }
    WT.I.scanCode = (el) => (st.manual = el.value);
    A.scanManual = () => {
      const c = L().normCode(st.manual);
      if (![8, 12, 13, 14].includes(c.length)) return WT.toast('A grocery barcode has 8, 12 or 13 digits', 'error');
      if (!L().validCode(c)) return WT.toast('Those digits don’t form a valid barcode — check the last digit', 'error');
      lookup(c);
    };
    A.scanAgain = () => {
      st.phase = 'scan';
      st.result = null;
      st.msg = 'Starting camera…';
      stopped = false;
      last = '';
      hits = 0;
      WT.refreshSheet();
    };
    A.scanRetry = () => lookup(st.code);
    A.scanAdd = () => {
      const it = st.result;
      WT.closeSheet(true);
      WT.openFoodReview([it]);
    };
    A.scanSearch = () => {
      WT.closeSheet(true);
      A.foodSearch();
    };
    A.scanLabel = () => {
      const code = st.code;
      WT.closeSheet(true);
      WT.productForm({
        prefill: { code, status: 'user' },
        fav: false,
        onSaved: (saved) => {
          WT.toast(`Saved “${saved.name}” with its barcode`, 'good');
          const it = N.resolveAs({ id: WT.uid(), text: '', qty: 1 }, 'my:' + saved.id);
          it.key = 'scan:' + code;
          WT.openFoodReview([it]);
        },
      });
    };
  };
})();
