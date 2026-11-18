/* Game player: four instant-win mechanics rebuilt from scratch with invented prizes and chances.
   A round is decided when it's bought; revealing only shows it. Credits are play money. */
(() => {
  const box = document.getElementById('game-player');
  if (!box) return;
  const $ = id => document.getElementById(id);
  const stage = $('gp-stage'), screen = $('gp-screen'), resultEl = $('gp-result');
  const buyBtn = $('gp-buy'), revealBtn = $('gp-reveal');
  const rnd = n => Math.floor(Math.random() * n);
  const weighted = pairs => { let r = Math.random() * pairs.reduce((t, [, w]) => t + w, 0); for (const [v, w] of pairs) if ((r -= w) < 0) return v; return pairs[0][0]; };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const cr = n => `${n} credit${n === 1 ? '' : 's'}`;

  /* ---------- Sum Strike: scratch a 3×3 grid; a row or column adding up to 13 wins its prize ---------- */
  const SUM_PRIZES = [[1, 50], [2, 30], [3, 12], [5, 5], [20, 1.5], [100, .3], [250, .05]];
  const SUM_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8]];
  const sum = {
    id: 'sum', name: 'Sum Strike', theme: 'theme-sum', price: 2, color: '#d4ff3a',
    blurb: 'Scratch numbers. Make 13 on a line.',
    rules: ['Buy a card. Every row and column shows its prize.', 'Scratch the nine numbers: tap them or drag across.', 'A row or column whose three numbers add up to 13 wins its prize.', 'Scratch the star box too: a star adds a 10-credit bonus. All wins add up.'],
    prizes: [['Line prizes', '1 to 250'], ['Star bonus', '10'], ['Lines', '3 rows + 3 columns']],
    deal() {
      const nums = Array.from({ length: 9 }, () => 1 + rnd(9));
      const prizes = SUM_LINES.map(() => weighted(SUM_PRIZES));
      const star = Math.random() < .04;
      const wins = SUM_LINES.map((l, i) => l.reduce((t, c) => t + nums[c], 0) === 13 ? i : -1).filter(i => i >= 0);
      return { nums, prizes, star, wins, total: wins.reduce((t, i) => t + prizes[i], 0) + (star ? 10 : 0) };
    },
    mount(r, api) {
      const lp = i => `<div class="lp" data-line="${i}">${r.prizes[i]}<small>${i < 3 ? 'row' : 'col'}</small></div>`;
      const cell = i => `<button type="button" class="scr" data-r="${i}" aria-label="Scratch box ${i + 1}">${r.nums[i]}</button>`;
      stage.innerHTML = `<div class="sum-board">${[0, 1, 2].map(row => [0, 1, 2].map(c => cell(row * 3 + c)).join('') + lp(row)).join('')}${[3, 4, 5].map(lp).join('')}<button type="button" class="scr bonus" data-r="9" aria-label="Scratch the star box">${r.star ? '★ +10' : '—'}</button></div>`;
      const left = new Set([...Array(10).keys()]);
      return {
        remaining: () => [...left],
        open(k) {
          k = +k; if (!left.has(k)) return;
          left.delete(k); stage.querySelector(`[data-r="${k}"]`).classList.add('open');
          api.status(`${10 - left.size} of 10 scratched`);
          if (!left.size) {
            r.wins.forEach(i => { stage.querySelector(`[data-line="${i}"]`).classList.add('win'); SUM_LINES[i].forEach(c => stage.querySelector(`[data-r="${c}"]`).classList.add('win')); });
            if (r.star) stage.querySelector('[data-r="9"]').classList.add('win');
            const parts = [r.wins.length ? `${r.wins.length} line${r.wins.length > 1 ? 's' : ''} made 13` : '', r.star ? 'star bonus' : ''].filter(Boolean).join(' + ');
            api.done(r.total, parts || 'No line adds up to 13.');
          }
        },
      };
    },
  };

  /* ---------- Tile flip (two themes): three of a kind on a line, or fill a legend ---------- */
  const FLIP_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const FLIP_PRIZES = [[1, 40], [2, 28], [3, 14], [4, 8], [5, 5], [10, 3], [20, 1.5], [100, .3]];
  // The two legend symbols are rarer than the other four.
  const FLIP_SYMBOL_WEIGHTS = [[0, 1], [1, 1], [2, 2.5], [3, 2.5], [4, 2.5], [5, 2.5]];
  const makeFlip = (id, name, theme, color, symbols, blurb) => ({
    id, name, theme, price: 2, color, blurb,
    rules: ['Buy a board. Each of the eight lines shows its prize.', 'Turn the nine tiles: tap them or drag across.', 'Three matching symbols on a row, column or diagonal win that line\'s prize.', `Every ${symbols[0]} and ${symbols[1]} also fills its legend. Fill all three slots to win the legend prize. All wins add up.`],
    prizes: [['Line prizes', '1 to 100'], [`Legend ${symbols[0]}`, '3 to 5'], [`Legend ${symbols[1]}`, '8 to 12']],
    deal() {
      const cells = Array.from({ length: 9 }, () => weighted(FLIP_SYMBOL_WEIGHTS));
      const prizes = FLIP_LINES.map(() => weighted(FLIP_PRIZES));
      const legend = [[3, 4, 5][rnd(3)], [8, 10, 12][rnd(3)]];
      const lineWins = FLIP_LINES.map((l, i) => cells[l[0]] === cells[l[1]] && cells[l[1]] === cells[l[2]] ? i : -1).filter(i => i >= 0);
      const legendWins = [0, 1].filter(s => cells.filter(c => c === s).length >= 3);
      const total = lineWins.reduce((t, i) => t + prizes[i], 0) + legendWins.reduce((t, s) => t + legend[s], 0);
      return { cells, prizes, legend, lineWins, legendWins, total };
    },
    mount(r, api) {
      const lp = (i, label) => `<div class="lp" data-line="${i}">${r.prizes[i]}<small>${label}</small></div>`;
      const tile = i => `<button type="button" class="tile" data-r="${i}" aria-label="Turn tile ${i + 1}"><i><span class="f"></span><span class="k">${symbols[r.cells[i]]}</span></i></button>`;
      const legendHtml = s => `<div class="legend" data-legend="${s}"><span>${symbols[s]}</span>${'<span class="slot"></span>'.repeat(3)}<span>${r.legend[s]}</span></div>`;
      stage.innerHTML = `<div class="flip-wrap"><div class="flip-board">${[0, 1, 2].map(row => [0, 1, 2].map(c => tile(row * 3 + c)).join('') + lp(row, 'row')).join('')}${[3, 4, 5].map(i => lp(i, 'col')).join('')}<span></span></div>
        <div class="flip-extra">${lp(6, '↘ diag')}${lp(7, '↙ diag')}${legendHtml(0)}${legendHtml(1)}</div></div>`;
      const left = new Set([...Array(9).keys()]), filled = [0, 0];
      return {
        remaining: () => [...left],
        open(k) {
          k = +k; if (!left.has(k)) return;
          left.delete(k); stage.querySelector(`[data-r="${k}"]`).classList.add('open');
          const sym = r.cells[k];
          if (sym < 2 && filled[sym] < 3) {
            const lg = stage.querySelector(`[data-legend="${sym}"]`);
            lg.querySelectorAll('.slot')[filled[sym]++].textContent = symbols[sym];
            if (filled[sym] === 3) lg.classList.add('win');
          }
          api.status(`${9 - left.size} of 9 tiles turned`);
          if (!left.size) {
            r.lineWins.forEach(i => { stage.querySelector(`[data-line="${i}"]`).classList.add('win'); FLIP_LINES[i].forEach(c => stage.querySelector(`[data-r="${c}"]`).classList.add('win')); });
            const parts = [r.lineWins.length ? `${r.lineWins.length} matching line${r.lineWins.length > 1 ? 's' : ''}` : '', r.legendWins.length ? `${r.legendWins.length} legend${r.legendWins.length > 1 ? 's' : ''} filled` : ''].filter(Boolean).join(' + ');
            api.done(r.total, parts || 'No three of a kind on a line, and no full legend.');
          }
        },
      };
    },
  });
  const sun = makeFlip('sun', 'Sunflip', 'theme-sun', '#ff9f43', ['☀️', '🐚', '🌴', '🍉', '🌊', '⛱️'], 'Turn tiles. Line up three.');
  const frost = makeFlip('frost', 'Frostflip', 'theme-frost', '#8cc9f0', ['❄️', '⛄', '🧣', '☕', '🌲', '🎿'], 'The winter board. Same rules.');

  /* ---------- Terrace Collect: pick balls; collect k of symbol k to win its prize, once ---------- */
  const COL_SYMBOLS = ['🏆', '👟', '⚽', '🥅', '🚩', '👕', '⏱️', '🧣', '🟥', '📣'];
  const COL_PRIZES = [2, 3, 4, 6, 10, 15, 30, 60, 200, 1000];
  const REVEALS = 31, SLOTS = 16;
  const collect = {
    id: 'collect', name: 'Terrace Collect', theme: 'theme-collect', price: 3, color: '#7bd88f',
    blurb: 'Pick balls. Collect a full set.',
    rules: ['Buy a round: 31 balls come onto the pitch, 16 at a time.', 'Pick a ball to open it. A new ball drops in until all 31 have played.', 'Symbol 1 needs one, symbol 2 needs two, up to symbol 10, which needs ten.', 'Complete a set to win its prize. A round wins at most once.'],
    prizes: COL_SYMBOLS.map((s, i) => [`${s} × ${i + 1}`, String(COL_PRIZES[i])]),
    deal() {
      // Decide the outcome first, then build a reveal order that matches it.
      const winner = Math.random() < .3 ? weighted([[1, 40], [2, 25], [3, 14], [4, 8], [5, 5], [6, 3], [7, 2], [8, 1], [9, .5], [10, .1]]) : 0;
      const counts = COL_SYMBOLS.map((_, i) => (i + 1 === winner ? i + 1 : 0));
      let need = REVEALS - counts.reduce((t, c) => t + c, 0);
      while (need > 0) {
        const open = counts.map((c, i) => (i + 1 !== winner && c < i ? i : -1)).filter(i => i >= 0);
        counts[open[rnd(open.length)]]++; need--;
      }
      const seq = shuffle(counts.flatMap((c, i) => Array(c).fill(i)));
      return { seq, winner, total: winner ? COL_PRIZES[winner - 1] : 0 };
    },
    mount(r, api) {
      stage.innerHTML = `<div class="col-wrap"><div><div class="pitch">${Array.from({ length: SLOTS }, (_, i) => `<button type="button" class="ball" data-r="${i}" aria-label="Pick ball"></button>`).join('')}</div><p class="left-count" id="gp-left"></p></div>
        <ul class="tally">${COL_SYMBOLS.map((s, i) => `<li data-sym="${i}"><span class="em">${s}</span><span class="pips">${'<i></i>'.repeat(i + 1)}</span><span class="pz">${COL_PRIZES[i]}</span></li>`).join('')}</ul></div>`;
      const balls = [...stage.querySelectorAll('.ball')], have = Array(10).fill(0), live = new Set([...Array(SLOTS).keys()]);
      let opened = 0, brought = SLOTS, landed = 0;
      const leftText = () => { stage.querySelector('#gp-left').textContent = `${REVEALS - opened} balls left · ${REVEALS - brought} still to come on`; };
      leftText();
      return {
        remaining: () => [...live],
        open(k) {
          k = +k; if (!live.has(k)) return;
          live.delete(k);
          const sym = r.seq[opened++], b = balls[k];
          b.textContent = COL_SYMBOLS[sym]; b.classList.add('shown'); b.setAttribute('aria-label', `Opened: symbol ${sym + 1}`);
          const li = stage.querySelector(`[data-sym="${sym}"]`);
          li.querySelectorAll('.pips i')[Math.min(have[sym], sym)].classList.add('on');
          if (++have[sym] === sym + 1) li.classList.add('win');
          api.status(`${opened} of ${REVEALS} opened`); leftText();
          setTimeout(() => {
            if (brought < REVEALS) {
              brought++;
              const nb = b.cloneNode(false); nb.className = 'ball'; nb.textContent = ''; nb.setAttribute('aria-label', 'Pick ball');
              b.replaceWith(nb); balls[k] = nb; live.add(k);
            } else b.classList.add('gone');
            leftText();
            if (++landed === REVEALS) api.done(r.total, r.winner ? `Completed the ${COL_SYMBOLS[r.winner - 1]} set: ${r.winner} of ${r.winner}.` : 'No set completed.');
          }, 380);
        },
      };
    },
  };

  /* ---------- Runner ---------- */
  const GAMES = [sum, sun, frost, collect];
  let idx = 0, bal = 100, ctrl = null, phase = 'ready', autoTimer = 0;
  const cartsEl = $('gp-carts');
  cartsEl.innerHTML = GAMES.map((g, i) => `<button type="button" class="cart" role="radio" data-i="${i}" style="--g:${g.color}"><b>${g.name}</b><span>${g.blurb}</span><span>${cr(g.price)} a play</span></button>`).join('');
  const status = t => { $('gp-status').textContent = t; };
  const setBal = () => { $('gp-bal').textContent = bal; };
  const sync = () => {
    const g = GAMES[idx], playing = phase === 'play';
    cartsEl.querySelectorAll('.cart').forEach((c, i) => { c.setAttribute('aria-checked', String(i === idx)); c.disabled = playing; });
    box.querySelectorAll('.dp').forEach(d => { d.disabled = playing; });
    buyBtn.disabled = playing;
    buyBtn.lastChild.textContent = bal < g.price && !playing ? 'Top up' : `Buy · ${g.price}`;
    revealBtn.disabled = !playing || !!autoTimer;
  };
  const showGame = () => {
    const g = GAMES[idx];
    screen.className = `console-screen ${g.theme}`;
    $('gp-title').textContent = g.name;
    $('gp-price').textContent = `${cr(g.price)} a play`;
    resultEl.hidden = true; ctrl = null; phase = 'ready';
    stage.innerHTML = `<p class="mono" style="text-align:center;color:#c9c7bd;max-width:280px">${g.blurb}<br/><br/>Press <b style="color:var(--g)">A</b> to buy a round.</p>`;
    status('Ready.');
    $('gp-rules').innerHTML = `<span class="mono tag">How a round works</span><h4>${g.name}</h4><ol>${g.rules.map(t => `<li>${t}</li>`).join('')}</ol><ul class="prizes">${g.prizes.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('')}</ul>`;
    sync();
  };
  const finish = (win, why) => {
    clearInterval(autoTimer); autoTimer = 0;
    bal += win; setBal(); phase = 'done'; sync();
    status(win ? `Won ${cr(win)}.` : 'No win.');
    setTimeout(() => {
      if (phase !== 'done') return;
      resultEl.innerHTML = `<span class="mono">${win ? 'You win' : 'Not this time'}</span><b>${win ? `+${win}` : 'No win'}</b><p>${why}</p><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button type="button" class="pill" data-again>Play again · ${GAMES[idx].price}</button><button type="button" class="pill ghost" data-close style="color:#f2f0e6">Look at the board</button></div>`;
      resultEl.hidden = false;
    }, 700);
  };
  const buy = () => {
    const g = GAMES[idx];
    if (phase === 'play') return;
    if (bal < g.price) { bal = 100; setBal(); status('Topped up to 100 free play credits.'); sync(); return; }
    bal -= g.price; setBal();
    resultEl.hidden = true; phase = 'play';
    ctrl = g.mount(g.deal(), { status, done: finish });
    status('Round bought. Reveal everything to see the result.');
    sync();
  };
  const revealAll = () => {
    if (phase !== 'play' || autoTimer) return;
    autoTimer = setInterval(() => {
      const left = ctrl.remaining();
      if (left.length) ctrl.open(left[0]);
    }, GAMES[idx].id === 'collect' ? 130 : 260);
    sync();
  };

  // Tap or drag across the board to reveal.
  let dragging = false;
  const hit = (x, y) => { const el = document.elementFromPoint(x, y)?.closest('[data-r]'); if (el && stage.contains(el) && phase === 'play') ctrl.open(el.dataset.r); };
  stage.addEventListener('pointerdown', e => { if (phase !== 'play') return; dragging = true; hit(e.clientX, e.clientY); });
  stage.addEventListener('pointermove', e => { if (dragging) hit(e.clientX, e.clientY); });
  addEventListener('pointerup', () => { dragging = false; });
  stage.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.r !== undefined) { e.preventDefault(); if (phase === 'play') ctrl.open(e.target.dataset.r); } });

  buyBtn.addEventListener('click', buy);
  revealBtn.addEventListener('click', revealAll);
  resultEl.addEventListener('click', e => { if (e.target.closest('[data-again]')) buy(); else if (e.target.closest('[data-close]')) resultEl.hidden = true; });
  cartsEl.addEventListener('click', e => { const c = e.target.closest('.cart'); if (c && phase !== 'play') { idx = +c.dataset.i; showGame(); } });
  box.querySelectorAll('.dp').forEach(d => d.addEventListener('click', () => { if (phase === 'play') return; idx = (idx + GAMES.length + +d.dataset.dir) % GAMES.length; showGame(); }));
  setBal(); showGame();
})();
