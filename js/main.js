(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Theme ---------- */
  const currentTheme = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.querySelector('.theme-toggle').addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    document.dispatchEvent(new CustomEvent('themechange'));
  });

  /* ---------- Nav ---------- */
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 30);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* ---------- Cursor ---------- */
  const cursor = document.querySelector('.cursor');
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; }, { passive: true });
    const loop = () => { cx += (x - cx) * .2; cy += (y - cy) * .2; cursor.style.transform = `translate(${cx}px, ${cy}px)`; requestAnimationFrame(loop); };
    loop();
    document.addEventListener('pointerover', e => cursor.classList.toggle('big', !!e.target.closest('a, button, input, select, .shot-wrap')));
  }

  /* ---------- Hero title split ---------- */
  document.querySelectorAll('.hero-title .split').forEach((el, li) => {
    const text = el.textContent; el.textContent = '';
    [...text].forEach((c, i) => {
      const s = document.createElement('span'); s.className = 'ch'; s.textContent = c;
      s.style.animationDelay = `${0.15 + li * 0.18 + i * 0.045}s`; s.setAttribute('aria-hidden', 'true');
      el.appendChild(s);
    });
  });

  /* ---------- Hero canvas: racing lines ---------- */
  const canvas = document.querySelector('.hero-canvas');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, mx = .7, my = .4, t = 0, colors;
  const readColors = () => {
    const cs = getComputedStyle(root);
    colors = { line: cs.getPropertyValue('--line').trim(), accent: cs.getPropertyValue('--accent').trim(), ink: cs.getPropertyValue('--muted').trim() };
  };
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  readColors(); resize();
  addEventListener('resize', resize);
  document.addEventListener('themechange', readColors);
  canvas.parentElement.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width; my = (e.clientY - r.top) / r.height; });
  const N = 26;
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1);
      const isRacingLine = i === Math.round(N * 0.62);
      ctx.beginPath();
      for (let s = 0; s <= 60; s++) {
        const u = s / 60;
        const x = u * W;
        const bend = Math.sin(u * Math.PI * 1.6 + t * .6 + k * 1.2) * H * .08;
        const pull = Math.exp(-((u - mx) ** 2) / .03) * (my - .5) * H * .35 * (1 - Math.abs(k - .5));
        const y = H * (.08 + k * .62) + bend + pull + Math.sin(u * 9 + t + k * 4) * 3;
        s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = isRacingLine ? colors.accent : colors.line;
      ctx.lineWidth = isRacingLine ? 2.5 : 1;
      ctx.globalAlpha = isRacingLine ? .95 : .9;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (!reduced) t += .008;
    if (!reduced || t === 0) requestAnimationFrame(draw);
  };
  draw();

  /* ---------- Reveal + counters ---------- */
  const fmt = (n, f) => f === 'k' ? (n >= 1000 ? Math.round(n / 1000) + 'k' : String(n)) : n.toLocaleString('en-GB');
  const countUp = el => {
    const end = +el.dataset.count, f = el.dataset.format, sfx = el.dataset.suffix || '', dur = 1400, t0 = performance.now();
    const step = now => { const p = Math.min(1, (now - t0) / dur); el.textContent = fmt(Math.round(end * (1 - (1 - p) ** 3)), f) + sfx; if (p < 1) requestAnimationFrame(step); };
    reduced ? (el.textContent = fmt(end, f) + sfx) : requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in');
    en.target.querySelectorAll('[data-count]').forEach(countUp);
    io.unobserve(en.target);
  }), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* ---------- Gallery ---------- */
  const shots = {
    results: ['Simulated share (bar), exact probability (tick) and 95% interval (whisker).', 'DuelLab results: simulated and exact probabilities for nine scenarios with confidence intervals'],
    compare: ['Two versions run with the same seed. Cutting three Blue-Eyes drops the brick rate by 21.2 percentage points.', 'DuelLab version comparison with a dumbbell chart and per-scenario changes'],
    editor: ['The deck editor: card search, roles, live deck check and role counts.', 'DuelLab deck editor showing the main deck, roles and deck check'],
    dashboard: ['The dashboard: recent decks and recent simulation runs.', 'DuelLab dashboard with deck and simulation summaries'],
  };
  const g = document.querySelector('[data-gallery]');
  if (g) {
    const img = g.querySelector('.shot-wrap img'), cap = g.querySelector('[data-caption]'), modeBtn = g.querySelector('[data-mode]');
    let shot = 'results', dark = false;
    const show = () => {
      const src = `assets/shots/duellab-${shot}${dark ? '-dark' : ''}.webp`;
      img.classList.add('fade');
      const pre = new Image(); pre.src = src;
      pre.onload = () => { img.src = src; img.alt = shots[shot][1]; cap.textContent = shots[shot][0]; img.classList.remove('fade'); };
      modeBtn.textContent = dark ? 'Light UI' : 'Dark UI';
    };
    g.querySelectorAll('[data-shot]').forEach(b => b.addEventListener('click', () => {
      g.querySelectorAll('[data-shot]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      shot = b.dataset.shot; show();
    }));
    modeBtn.addEventListener('click', () => { dark = !dark; show(); });
    const lb = document.getElementById('lightbox');
    g.querySelector('.shot-wrap').addEventListener('click', () => { lb.querySelector('img').src = img.src; lb.querySelector('img').alt = img.alt; lb.showModal(); });
    lb.addEventListener('click', e => { if (e.target === lb || e.target.closest('.close')) lb.close(); });
  }

  /* ---------- Shared helpers for the sims ---------- */
  window.bindRange = (form) => form.querySelectorAll('input[type=range]').forEach(r => {
    const out = form.querySelector(`output[data-for="${r.name || r.id.replace('cl-', '')}"]`);
    const upd = () => { if (out) out.textContent = (+r.value).toLocaleString('en-GB'); };
    r.addEventListener('input', upd); upd();
  });
  window.segment = (container, attr, onChange) => container.querySelectorAll(`[data-${attr}]`).forEach(b => b.addEventListener('click', () => {
    container.querySelectorAll(`[data-${attr}]`).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    onChange(b.dataset[attr]);
  }));

  document.getElementById('year').textContent = new Date().getFullYear();
})();
