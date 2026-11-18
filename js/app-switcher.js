/* Work apps: one device frame, three simplified apps. Each app is a set of journeys
   (the app's own tab bar) rendered from a small state object. All data is made up. */
(() => {
  const box = document.getElementById('app-switcher');
  if (!box) return;
  const $ = s => box.querySelector(s);
  const body = $('#app-body'), nav = $('#app-nav'), device = $('.device');
  const rnd = n => Math.floor(Math.random() * n);
  const usd = n => '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pickN = (n, max) => { const s = new Set(); while (s.size < n) s.add(1 + rnd(max)); return [...s].sort((a, b) => a - b); };
  const numGrid = (picked, max = 49) => `<div class="numgrid">${Array.from({ length: max }, (_, i) => i + 1)
    .map(n => `<button type="button" data-act="num" data-n="${n}" aria-pressed="${picked.includes(n)}" aria-label="Number ${n}">${n}</button>`).join('')}</div>`;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const later = (ms, fn) => setTimeout(() => { fn(); render(); }, ms);

  /* ---------- 1. Draw-game app ---------- */
  const draw = {
    name: 'Draw', s: { tab: 'play', bal: 20, picks: [], tickets: [], toast: null, last: null, dep: 25, depBusy: false, vse: 0, vsePeriod: '1 month', vseAck: false, locked: false },
    tabs: [['play', '◎', 'Play'], ['results', '☰', 'Results'], ['account', '◐', 'Account']],
    PRICE: 3,
    balance() { return `Balance <b>${usd(this.s.bal)}</b>`; },
    view() {
      const s = this.s;
      if (s.tab === 'play') {
        if (s.locked) return `<div class="acard bad"><h4>You're taking a break</h4><p>Self-exclusion is on for ${s.vsePeriod}. Buying tickets and deposits are switched off until it ends.</p></div><button class="abtn ghost" data-act="unlock">Reset the demo</button>`;
        return `<h4>Pick 6 · ${usd(this.PRICE)} a line</h4><p>Choose six numbers from 1 to 49, or let the app pick for you.</p>
          ${numGrid(s.picks)}
          <div class="arow"><button class="abtn ghost" data-act="quick">Quick pick</button><button class="abtn" data-act="buy" ${s.picks.length === 6 ? '' : 'disabled'}>Buy ${s.picks.length}/6</button></div>
          ${s.toast ? `<div class="toast ${s.toast[0]}">${s.toast[1]}</div>` : ''}`;
      }
      if (s.tab === 'results') {
        const open = s.tickets.filter(t => !t.result);
        return `<h4>Results</h4>
          ${s.last ? `<div class="acard"><span class="mono small">Last draw</span><div class="balls">${s.last.nums.map(n => `<span>${n}</span>`).join('')}<span class="bonus">${s.last.bonus}</span></div></div>` : '<p>No draws yet. Buy a ticket, then run the draw.</p>'}
          <button class="abtn" data-act="draw" ${open.length ? '' : 'disabled'}>Run tonight's draw${open.length ? ` · ${open.length} ticket${open.length > 1 ? 's' : ''}` : ''}</button>
          ${s.tickets.slice().reverse().map(t => `<div class="acard ${t.result && t.result.prize ? 'good' : ''}">
            <div class="balls">${t.nums.map(n => `<span class="${t.result && t.result.hits.includes(n) ? 'hit' : ''}">${n}</span>`).join('')}</div>
            <div class="kv"><span>${t.result ? `${t.result.hits.length} match${t.result.hits.length === 1 ? '' : 'es'}` : 'Waiting for the draw'}</span><b>${t.result ? (t.result.prize ? usd(t.result.prize) : 'No win') : ''}</b></div></div>`).join('')}
          <p class="mono small">Prizes here: 3 matches $10 · 4 $50 · 5 $1,000 · 6 jackpot.</p>`;
      }
      // account
      if (s.vse === 1) return `<div class="steps"><i class="on"></i><i></i><i></i></div><h4>Take a break</h4><p>How long do you want to stop playing?</p>
        <div class="chipset">${['1 week', '1 month', '6 months'].map(p => `<button data-act="period" data-p="${p}" aria-pressed="${s.vsePeriod === p}">${p}</button>`).join('')}</div>
        <div class="arow"><button class="abtn ghost" data-act="vse-cancel">Cancel</button><button class="abtn" data-act="vse-next">Next</button></div>`;
      if (s.vse === 2) return `<div class="steps"><i class="on"></i><i class="on"></i><i></i></div><h4>Check and confirm</h4>
        <div class="acard"><div class="kv"><span>Break</span><b>${s.vsePeriod}</b></div><div class="kv"><span>Can be undone early</span><b>No</b></div></div>
        <label class="kv" style="justify-content:flex-start;gap:10px;cursor:pointer"><input type="checkbox" data-act="ack" ${s.vseAck ? 'checked' : ''}/> I understand I can't buy or deposit until it ends.</label>
        <div class="arow"><button class="abtn ghost" data-act="vse-back">Back</button><button class="abtn" data-act="vse-confirm" ${s.vseAck ? '' : 'disabled'}>Confirm</button></div>`;
      if (s.vse === 3) return `<div class="steps"><i class="on"></i><i class="on"></i><i class="on"></i></div><div class="acard good"><h4>Your break has started</h4><p>We've switched off buying and deposits for ${s.vsePeriod}. Support details are in Help if you need them.</p></div><button class="abtn" data-act="vse-done">Done</button>`;
      return `<h4>Account</h4>
        <div class="acard"><span class="mono small">Balance</span><span class="big">${usd(s.bal)}</span></div>
        <div class="acard"><span class="mono small">Deposit</span>
          <div class="chipset">${[10, 25, 50].map(v => `<button data-act="dep" data-v="${v}" aria-pressed="${s.dep === v}">$${v}</button>`).join('')}</div>
          ${s.depBusy ? '<div class="spinner" aria-label="Processing"></div>' : `<button class="abtn" data-act="deposit" ${s.locked ? 'disabled' : ''}>Deposit ${usd(s.dep)}</button>`}</div>
        <div class="acard"><span class="mono small">Play-safe tools</span><p>Set limits or take a break from playing.</p><button class="abtn ghost" data-act="vse-start" ${s.locked ? 'disabled' : ''}>${s.locked ? 'Break in progress' : 'Take a break'}</button></div>
        ${s.toast && s.tab === 'account' ? `<div class="toast ${s.toast[0]}">${s.toast[1]}</div>` : ''}`;
    },
    act(a, d) {
      const s = this.s;
      if (a !== 'num') s.toast = null;
      switch (a) {
        case 'num': { const n = +d.n; s.toast = null; if (s.picks.includes(n)) s.picks = s.picks.filter(x => x !== n); else if (s.picks.length < 6) s.picks = [...s.picks, n].sort((x, y) => x - y); break; }
        case 'quick': s.picks = pickN(6, 49); break;
        case 'buy':
          if (s.bal < this.PRICE) { s.toast = ['err', 'Not enough funds. Add money in Account.']; break; }
          s.bal -= this.PRICE; s.tickets.push({ nums: s.picks, result: null }); s.picks = [];
          s.toast = ['ok', `Ticket bought for ${usd(this.PRICE)}. Run the draw in Results.`]; break;
        case 'draw': {
          // Nudge the demo so a win is likely to show up now and then.
          const open = s.tickets.filter(t => !t.result);
          const base = Math.random() < .45 ? open[rnd(open.length)].nums.slice(0, 3 + rnd(2)) : [];
          const nums = new Set(base); while (nums.size < 6) nums.add(1 + rnd(49));
          let bonus; do bonus = 1 + rnd(49); while (nums.has(bonus));
          s.last = { nums: [...nums].sort((x, y) => x - y), bonus };
          const PRIZE = { 3: 10, 4: 50, 5: 1000, 6: 5000000 };
          open.forEach(t => { const hits = t.nums.filter(n => nums.has(n)); t.result = { hits, prize: PRIZE[hits.length] || 0 }; s.bal += t.result.prize; });
          break;
        }
        case 'dep': s.dep = +d.v; break;
        case 'deposit': s.depBusy = true; later(900, () => { s.depBusy = false; s.bal += s.dep; s.toast = ['ok', `${usd(s.dep)} added. Card details aren't real here.`]; }); break;
        case 'vse-start': s.vse = 1; s.vseAck = false; break;
        case 'period': s.vsePeriod = d.p; break;
        case 'vse-cancel': s.vse = 0; break;
        case 'vse-next': s.vse = 2; break;
        case 'vse-back': s.vse = 1; break;
        case 'ack': s.vseAck = !s.vseAck; break;
        case 'vse-confirm': s.vse = 3; s.locked = true; break;
        case 'vse-done': s.vse = 0; break;
        case 'unlock': s.locked = false; break;
      }
    },
  };

  /* ---------- 2. Native rewrite ---------- */
  const SAMPLES = {
    win: ['Winning ticket', 'good', t => `<span class="mono small">Congratulations</span><span class="big">${usd(t.prize)}</span><p>You can claim this prize in the app. It goes straight to your balance.</p>${t.claimed ? '<div class="toast ok">Claimed. Added to your balance.</div>' : '<button class="abtn" data-act="claim">Claim now</button>'}`],
    lose: ['No win', '', () => '<h4>Not a winner this time</h4><p>This ticket didn\'t win a prize. Results are in the Results tab.</p>'],
    claimed: ['Already claimed', 'bad', () => '<h4>Already claimed</h4><p>This prize was claimed on 3 March. Each ticket can only be claimed once.</p>'],
    owner: ['Someone else\'s', 'bad', () => '<h4>Registered to another player</h4><p>This ticket belongs to a different account, so it can\'t be claimed here. Take it to a retailer if you think that\'s wrong.</p>'],
  };
  const native = {
    name: 'Lotto', s: { tab: 'scan', perm: 'unknown', scanning: false, outcome: null, bal: 0, limit: 20, spent: 0, blocked: false, size: 'small', jackpot: 12, refreshing: false },
    tabs: [['scan', '⌗', 'Scan'], ['budget', '◔', 'Budget'], ['widget', '▦', 'Widgets']],
    balance() { return `Balance <b>${usd(this.s.bal)}</b>`; },
    view() {
      const s = this.s;
      if (s.tab === 'scan') {
        if (s.perm === 'unknown') return `<div class="acard"><h4>Allow camera?</h4><p>To check a ticket, the app needs the camera to read its barcode. Nothing is recorded.</p><div class="arow"><button class="abtn ghost" data-act="deny">Don't allow</button><button class="abtn" data-act="allow">Allow</button></div></div>`;
        if (s.perm === 'denied') return `<div class="acard bad"><h4>Camera is off</h4><p>You turned off camera access, so the scanner can't open. Turn it on in Settings, or enter the ticket number by hand.</p><button class="abtn" data-act="allow">Open Settings (simulated)</button></div>`;
        if (s.outcome) { const [, cls, html] = SAMPLES[s.outcome.kind]; return `<div class="acard ${cls}">${html(s.outcome)}</div><button class="abtn ghost" data-act="rescan">Scan another ticket</button>`; }
        return `<div class="viewfinder"><div class="tkt"><span>DRAW TICKET</span><span>07 12 19 23 31 44</span><i></i></div>${s.scanning ? '<div class="scanline"></div>' : ''}</div>
          <p>${s.scanning ? 'Reading the barcode…' : 'Pick a sample ticket to hold up to the camera.'}</p>
          <div class="chipset">${Object.entries(SAMPLES).map(([k, [label]]) => `<button data-act="scan" data-k="${k}" ${s.scanning ? 'disabled' : ''}>${label}</button>`).join('')}</div>`;
      }
      if (s.tab === 'budget') {
        const pct = Math.min(100, s.spent / s.limit * 100), left = Math.max(0, s.limit - s.spent);
        return `<h4>Weekly budget</h4><p>Choose a limit. The app blocks purchases that would go over it.</p>
          <div class="chipset">${[10, 20, 50].map(v => `<button data-act="limit" data-v="${v}" aria-pressed="${s.limit === v}">$${v} / week</button>`).join('')}</div>
          <div class="acard"><div class="kv"><span>Spent this week</span><b>${usd(s.spent)}</b></div><div class="meter ${pct >= 100 ? 'full' : ''}"><i style="width:${pct}%"></i></div><div class="kv"><span>Left</span><b>${usd(left)}</b></div></div>
          <button class="abtn" data-act="spend">Buy a $5 ticket</button>
          ${s.blocked ? '<div class="acard bad"><h4>Weekly limit reached</h4><p>This purchase would take you over your budget. Your limit resets on Monday. Lowering a limit is instant; raising it takes 24 hours.</p></div>' : ''}
          <button class="abtn ghost" data-act="reset-week">Start a new week</button>`;
      }
      const mins = 60 * 3 + 27, drawText = `${Math.floor(mins / 60)}h ${mins % 60}m`;
      const w = s.size === 'small'
        ? `<div class="widget small"><span class="sub">Next jackpot</span><b>$${s.jackpot}M</b><span class="accent">Draw in ${drawText}</span></div>`
        : `<div class="widget medium"><div style="display:grid;gap:4px"><span class="sub">Big draw</span><b>$${s.jackpot}M</b><span class="accent">in ${drawText}</span></div><div style="display:grid;gap:4px"><span class="sub">Daily draw</span><b>$${(s.jackpot / 6).toFixed(1)}M</b><span class="accent">Tonight</span></div></div>`;
      return `<h4>Home-screen widget</h4><p>Widgets show the next jackpots from the draw-details feed and refresh on a timeline.</p>
        <div class="chipset">${['small', 'medium'].map(z => `<button data-act="size" data-z="${z}" aria-pressed="${s.size === z}">${z}</button>`).join('')}</div>
        <div class="home">${w}${'<div class="ico"></div>'.repeat(s.size === 'small' ? 6 : 8)}</div>
        ${s.refreshing ? '<div class="spinner" aria-label="Refreshing"></div>' : '<button class="abtn ghost" data-act="refresh">Simulate a timeline refresh</button>'}`;
    },
    act(a, d) {
      const s = this.s;
      switch (a) {
        case 'allow': s.perm = 'granted'; break;
        case 'deny': s.perm = 'denied'; break;
        case 'scan': s.scanning = true; later(1300, () => { s.scanning = false; s.outcome = { kind: d.k, prize: [10, 25, 100][rnd(3)], claimed: false }; }); break;
        case 'claim': s.outcome.claimed = true; s.bal += s.outcome.prize; break;
        case 'rescan': s.outcome = null; break;
        case 'limit': s.limit = +d.v; s.blocked = s.spent >= s.limit; break;
        case 'spend': if (s.spent + 5 > s.limit) s.blocked = true; else { s.spent += 5; s.blocked = false; } break;
        case 'reset-week': s.spent = 0; s.blocked = false; break;
        case 'size': s.size = d.z; break;
        case 'refresh': s.refreshing = true; later(800, () => { s.refreshing = false; s.jackpot = Math.max(5, s.jackpot + [-7, 2, 3, 5][rnd(4)]); }); break;
      }
    },
  };

  /* ---------- 3. Retail companion ---------- */
  const STORES = [
    ['Corner Mart', '214 King St', 1.8, '7am to 11pm', true],
    ['Prairie Fuel & Go', 'Hwy 16 exit 4', 6.2, 'Open 24 hours', true],
    ['Main Street Pharmacy', '9 Main St', 0.6, '9am to 6pm', false],
    ['Northgate Grocer', '1100 Northgate Rd', 3.4, '8am to 10pm', true],
  ];
  // A QR-style picture from a hash of the playslip. It's a visual, not a scannable code.
  const qrSvg = text => {
    let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    const next = () => (h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909), (h >>> 0) / 4294967296);
    const N = 25, finder = (x, y) => [[0, 0], [N - 7, 0], [0, N - 7]].find(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
    let r = '';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const f = finder(x, y);
      if (f) { const dx = x - f[0], dy = y - f[1], ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3)); if (ring !== 2) r += `<rect x="${x}" y="${y}" width="1" height="1"/>`; }
      else if (next() < .5) r += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
    return `<svg viewBox="-1 -1 27 27" role="img" aria-label="Playslip QR code (illustration)" shape-rendering="crispEdges">${r}</svg>`;
  };
  const retail = {
    name: 'Lottery', s: { tab: 'build', picks: [], draws: 1, extra: false, qr: null, saved: [], name: '', outcome: null, scanning: false, loc: 'off', open: null },
    tabs: [['build', '✎', 'Build'], ['check', '⌗', 'Check'], ['stores', '⌖', 'Stores']],
    balance() { return this.s.saved.length ? `Saved <b>${this.s.saved.length}</b>` : 'In-store play'; },
    total() { return (3 + (this.s.extra ? 1 : 0)) * this.s.draws; },
    view() {
      const s = this.s;
      if (s.tab === 'build') {
        if (s.qr) return `<h4>Show this at the counter</h4><p>The retailer scans the code, takes payment and prints your ticket.</p>
          <div class="qr">${qrSvg(s.qr)}</div>
          <div class="kv"><span>${s.picks.join(' · ')}</span><b>${usd(this.total())}</b></div>
          <div class="arow"><input aria-label="Playslip name" data-act="name" value="${esc(s.name)}" placeholder="Name it, e.g. Birthdays" style="flex:2;min-width:0;padding:10px;border-radius:10px;border:1px solid #3a3c35;background:#1b1d18;color:#f2f0e6;font:13px var(--mono)"/><button class="abtn" data-act="save">Save</button></div>
          ${s.saved.length ? `<div class="toast ok">Saved: ${s.saved.map(x => esc(x.name)).join(', ')}</div>` : ''}
          <button class="abtn ghost" data-act="new">Build another</button>`;
        return `<h4>Build a playslip</h4><p>Pick six numbers, choose draws and add-ons, then make a QR code to buy in store.</p>
          ${numGrid(s.picks)}
          <button class="abtn ghost" data-act="quick">Quick pick</button>
          <div class="kv"><span>Draws</span></div><div class="chipset">${[1, 2, 3, 4].map(n => `<button data-act="draws" data-n="${n}" aria-pressed="${s.draws === n}">${n}</button>`).join('')}</div>
          <div class="chipset"><button data-act="extra" aria-pressed="${s.extra}">Add-on +$1 ${s.extra ? '✓' : ''}</button></div>
          <div class="kv"><span>Total to pay in store</span><b>${usd(this.total())}</b></div>
          <button class="abtn" data-act="qr" ${s.picks.length === 6 ? '' : 'disabled'}>Make QR code ${s.picks.length}/6</button>`;
      }
      if (s.tab === 'check') {
        if (s.outcome) return `<div class="acard ${s.outcome[0]}">${s.outcome[1]}</div><button class="abtn ghost" data-act="recheck">Check another ticket</button>`;
        return `<h4>Check a ticket</h4><p>Scan any ticket bought in store to see if it won and where to claim.</p>
          <div class="viewfinder"><div class="tkt"><span>INSTANT 5</span><span>No. 4471-02</span><i></i></div>${s.scanning ? '<div class="scanline"></div>' : ''}</div>
          <div class="chipset">${[['small', 'Small win'], ['none', 'No win'], ['big', 'Big win']].map(([k, l]) => `<button data-act="check" data-k="${k}" ${s.scanning ? 'disabled' : ''}>${l}</button>`).join('')}</div>`;
      }
      const list = s.loc === 'on' ? STORES.slice().sort((a, b) => a[2] - b[2]) : STORES;
      return `<h4>Find a retailer</h4>
        ${s.loc === 'off' ? '<button class="abtn" data-act="locate">Use my location</button>' : s.loc === 'busy' ? '<div class="spinner" aria-label="Locating"></div>' : '<div class="toast ok">Sorted by distance from you (simulated location).</div>'}
        ${list.map(([n, addr, km, hours, open]) => `<button class="store" data-act="store" data-n="${n}" aria-expanded="${s.open === n}">
          <span class="kv"><b>${n}</b>${s.loc === 'on' ? `<span>${km.toFixed(1)} km</span>` : ''}</span>
          <small>${addr}</small>${s.open === n ? `<small>${hours} · <span class="${open ? 'open' : ''}">${open ? 'Open now' : 'Closed now'}</span> · sells draw and instant tickets</small>` : ''}</button>`).join('')}`;
    },
    act(a, d) {
      const s = this.s;
      switch (a) {
        case 'num': { const n = +d.n; if (s.picks.includes(n)) s.picks = s.picks.filter(x => x !== n); else if (s.picks.length < 6) s.picks = [...s.picks, n].sort((x, y) => x - y); break; }
        case 'quick': s.picks = pickN(6, 49); break;
        case 'draws': s.draws = +d.n; break;
        case 'extra': s.extra = !s.extra; break;
        case 'qr': s.qr = `P6|${s.picks.join(',')}|D${s.draws}|X${+s.extra}|${Date.now()}`; break;
        case 'save': if (!s.saved.some(x => x.qr === s.qr)) s.saved.push({ name: s.name.trim() || `Playslip ${s.saved.length + 1}`, qr: s.qr }); break;
        case 'new': s.qr = null; s.picks = []; s.name = ''; break;
        case 'check': s.scanning = true; later(1200, () => {
          s.scanning = false;
          s.outcome = { small: ['good', '<span class="mono small">Winner</span><span class="big">$10.00</span><p>Claim at any retailer: they pay prizes like this at the counter.</p>'],
            none: ['', '<h4>Not a winner</h4><p>This ticket didn\'t win. Thanks for playing.</p>'],
            big: ['good', '<span class="mono small">Big winner</span><span class="big">$5,000.00</span><p>Prizes this size are paid at a prize office. Sign the back of your ticket and bring photo ID.</p>'] }[d.k];
        }); break;
        case 'recheck': s.outcome = null; break;
        case 'locate': s.loc = 'busy'; later(900, () => { s.loc = 'on'; }); break;
        case 'store': s.open = s.open === d.n ? null : d.n; break;
      }
    },
  };

  /* ---------- Shell ---------- */
  const APPS = { draw, native, retail };
  let app = draw;
  const render = () => {
    const focused = document.activeElement && body.contains(document.activeElement) ? document.activeElement.dataset.act + (document.activeElement.dataset.n || document.activeElement.dataset.k || '') : null;
    $('#app-name').textContent = app.name;
    $('#app-bal').innerHTML = app.balance();
    body.innerHTML = app.view();
    nav.innerHTML = app.tabs.map(([id, icon, label]) => `<button type="button" data-tab="${id}" ${app.s.tab === id ? 'aria-current="page"' : ''}><i aria-hidden="true">${icon}</i>${label}</button>`).join('');
    if (focused) { const el = [...body.querySelectorAll('[data-act]')].find(x => x.dataset.act + (x.dataset.n || x.dataset.k || '') === focused); if (el) el.focus({ preventScroll: true }); }
  };
  body.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled || el.tagName === 'INPUT' && el.type !== 'checkbox') return;
    const top = body.scrollTop;
    app.act(el.dataset.act, el.dataset); render();
    body.scrollTop = top;
  });
  body.addEventListener('input', e => { if (e.target.dataset.act === 'name') retail.s.name = e.target.value; });
  nav.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    app.s.tab = b.dataset.tab; if (app.s.toast) app.s.toast = null; render(); body.scrollTop = 0;
  });
  box.querySelectorAll('[data-app]').forEach(b => b.addEventListener('click', () => {
    box.querySelectorAll('[data-app]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    box.querySelectorAll('[data-info]').forEach(x => { x.hidden = x.dataset.info !== b.dataset.app; });
    $('#app-panel').setAttribute('aria-labelledby', b.id);
    device.dataset.accent = b.dataset.app;
    app = APPS[b.dataset.app]; render(); body.scrollTop = 0;
  }));
  render();
})();
