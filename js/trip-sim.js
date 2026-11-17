/* Trip detector: a simplified browser version of Mile Log's TripDetection state machine,
   using DetectorConfig's default thresholds. Plus the RateEngine's flat-rate claim. */
(() => {
  const CFG = {
    candidateTimeout: 120,   // s without driving evidence
    stopTimeout: 240,        // s stopped ends the trip
    drivingSpeed: 6,         // m/s
    stoppedSpeed: 2,         // m/s
    fastFixesNeeded: 3,
    minimumDisplacement: 300, // m
    minimumTripMetres: 482.8, // 0.3 miles
  };
  const RATES = { 2025: { first: 45, after: 25, moto: 24 }, 2026: { first: 55, after: 25, moto: 24 } };
  const THRESHOLD = 10000;
  const MI = 1609.344;

  // Segments: [seconds, fromSpeed, toSpeed, inCar]
  const ROUTES = {
    commute: [[50, 1.3, 1.3, 0], [30, 0, 0, 1], [20, 0, 13, 1], [200, 13, 13, 1], [15, 13, 0, 1], [25, 0, 0, 1], [20, 0, 14, 1],
      [150, 14, 14, 1], [30, 14, 28, 1], [260, 28, 28, 1], [30, 28, 0, 1], [95, 0, 0, 1], [50, 2.6, 2.6, 1], [25, 3, 13, 1],
      [170, 13, 13, 1], [20, 13, 0, 1], [300, 0, 0, 0], [30, 1.2, 1.2, 0]],
    walk: [[420, 1.4, 1.4, 0], [60, 0, 0, 0]],
    hop: [[30, 1.2, 1.2, 0], [15, 0, 0, 1], [15, 0, 8, 1], [30, 8, 8, 1], [12, 8, 0, 1], [260, 0, 0, 1]],
  };

  const build = (segs) => {
    const sp = [], car = [];
    let k = 0;
    segs.forEach(([d, a, b, c]) => { for (let i = 0; i < d; i++) { const base = a + (b - a) * (i / d); const jitter = base > 3 ? Math.sin(k * 0.7) * 0.6 + Math.sin(k * 0.23) * 0.9 : 0; sp.push(Math.max(0, base + jitter)); car.push(!!c); k++; } });
    return { sp, car };
  };

  const $ = id => document.getElementById(id);
  const svg = $('trip-speed'), logEl = $('trip-log'), carEl = $('trip-car'), runBtn = $('trip-run');
  const phaseEls = [...document.querySelectorAll('#trip-phases [data-p]')];
  const fsmNodes = [...document.querySelectorAll('.fsm [data-node]')];
  let routeKey = 'commute', rate = 60, sim = null, raf = 0;

  const clock = t => { const s = 8 * 3600 + Math.floor(t); return [s / 3600, (s % 3600) / 60, s % 60].map(v => String(Math.floor(v)).padStart(2, '0')).join(':'); };
  const money = p => '£' + (p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const log = (t, msg, cls = '') => {
    const li = document.createElement('li'); if (cls) li.className = cls;
    li.innerHTML = `<time>${clock(t)}</time>${msg}`; logEl.appendChild(li); logEl.scrollTop = logEl.scrollHeight;
  };
  const setPhase = p => {
    phaseEls.forEach(el => el.classList.toggle('on', el.dataset.p === p));
    fsmNodes.forEach(el => el.classList.toggle('on', el.dataset.node === p));
  };

  const drawChart = (profile, upto) => {
    const n = profile.sp.length, X = i => (i / (n - 1)) * 600, Y = v => 112 - (v / 30) * 104;
    const path = (end) => profile.sp.slice(0, end).map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
    svg.innerHTML = `
      <line class="thr" x1="0" x2="600" y1="${Y(CFG.drivingSpeed)}" y2="${Y(CFG.drivingSpeed)}"/>
      <line class="thr" x1="0" x2="600" y1="${Y(CFG.stoppedSpeed)}" y2="${Y(CFG.stoppedSpeed)}"/>
      <path d="${path(n)}" class="path" opacity=".22"/>
      <path d="${path(Math.max(1, upto))}" class="path"/>`;
  };

  const reset = () => {
    cancelAnimationFrame(raf);
    const profile = build(ROUTES[routeKey]);
    let total = 0; profile.sp.forEach(v => total += v);
    sim = { profile, total, t: 0, dist: 0, phase: 'idle', fast: 0, cand: null, tripStart: 0, stopSince: null, distAtStop: 0, done: false, trips: 0, claimPence: 0 };
    logEl.innerHTML = '<li class="dim">Press play.</li>';
    setPhase('idle'); drawChart(profile, 0);
    $('trip-clock').textContent = clock(0); $('trip-mph').textContent = '0 mph'; $('trip-miles').textContent = '0.00 mi'; $('trip-claim').textContent = '£0.00';
    carEl.style.left = '4%'; carEl.className = 'car';
    runBtn.textContent = 'Play ▸';
  };

  const step = (s) => {
    const i = s.t, v = s.profile.sp[i], inCar = s.profile.car[i];
    s.dist += v;
    if (i === 0) { log(i, 'iOS wakes the app: you left a place. Waiting for evidence.'); s.phase = 'candidate'; s.cand = { t: 0, d: 0, evidence: false }; s.lastStill = { t: 0, d: 0 }; s.fast = 0; return; }
    switch (s.phase) {
      case 'candidate': {
        s.fast = v > CFG.drivingSpeed ? s.fast + 1 : 0;
        if (v < 0.5) s.lastStill = { t: i, d: s.dist };
        if (s.fast === CFG.fastFixesNeeded && !s.cand.evidence) { s.cand.evidence = true; log(i, `${CFG.fastFixesNeeded} fixes in a row faster than 6 m/s. That counts as driving evidence.`); }
        if (s.cand.evidence && s.dist - s.cand.d >= CFG.minimumDisplacement) {
          s.phase = 'driving'; s.tripStart = s.lastStill.t; s.tripDist0 = s.lastStill.d;
          log(i, `Moved ${Math.round(s.dist - s.cand.d)} m from where it woke. <b>Driving</b>: the trip starts at ${clock(s.tripStart)}, where the car set off.`, 'key');
        } else if (!s.cand.evidence && i - s.cand.t >= CFG.candidateTimeout) {
          s.phase = 'idle'; log(i, 'No driving evidence for 2 minutes. Back to idle, and GPS goes off to save battery.', 'bad');
          s.idleSince = i;
        }
        break;
      }
      case 'idle':
        if (v > CFG.drivingSpeed && inCar) { s.phase = 'candidate'; s.cand = { t: i, d: s.dist - v, evidence: false }; s.lastStill = { t: i, d: s.dist - v }; s.fast = 1; log(i, 'Woken again by movement.'); }
        break;
      case 'driving':
        if (v < CFG.stoppedSpeed) { s.phase = 'stopping'; s.stopSince = i; s.distAtStop = s.dist; log(i, 'Slower than 2 m/s: <b>stopping</b>. The 4-minute timer starts.'); }
        break;
      case 'stopping': {
        const crawlingInCar = v >= CFG.stoppedSpeed && inCar;
        if (v > CFG.drivingSpeed || crawlingInCar) {
          const why = v > CFG.drivingSpeed ? 'Moving again' : `Crawling at ${v.toFixed(1)} m/s and Core Motion says automotive`;
          log(i, `${why} after ${i - s.stopSince} s. Still the <b>same trip</b>.`, 'key');
          s.phase = 'driving'; s.stopSince = null;
        } else if (i - s.stopSince >= CFG.stopTimeout) {
          const metres = s.distAtStop - s.tripDist0, miles = metres / MI;
          if (metres < CFG.minimumTripMetres) {
            log(i, `Stopped for 4 minutes. The trip is only ${miles.toFixed(2)} mi, under the 0.3-mile minimum, so it isn't saved.`, 'bad');
          } else {
            const pence = Math.round(miles * RATES[2026].first * 100) / 100;
            s.trips++; s.claimPence += pence;
            log(i, `Stopped for 4 minutes. <b>Trip saved</b>: ${clock(s.tripStart)} to ${clock(s.stopSince)}, ${miles.toFixed(2)} mi. It ends where the car stopped, not when the timer fired.`, 'key');
            $('trip-claim').textContent = money(s.claimPence);
          }
          s.phase = 'idle'; s.ended = true;
        }
        break;
      }
    }
  };

  const frame = (prev) => (now) => {
    const s = sim; if (!s || s.done) return;
    const dt = Math.min(0.1, (now - prev) / 1000);
    const target = Math.min(s.profile.sp.length, s.t + dt * rate);
    while (s.t < Math.floor(target)) { step(s); s.t++; }
    const i = Math.min(s.t, s.profile.sp.length - 1), v = s.profile.sp[i];
    setPhase(s.phase);
    $('trip-clock').textContent = clock(s.t);
    $('trip-mph').textContent = `${Math.round(v * 2.23694)} mph`;
    const tripMetres = (s.phase === 'driving' || s.phase === 'stopping') ? (s.phase === 'stopping' ? s.distAtStop : s.dist) - s.tripDist0 : null;
    if (tripMetres !== null) $('trip-miles').textContent = (tripMetres / MI).toFixed(2) + ' mi';
    carEl.style.left = (4 + (s.dist / s.total) * 90) + '%';
    carEl.className = 'car' + (s.profile.car[i] ? '' : ' walking') + (s.phase === 'driving' ? ' live' : '');
    drawChart(s.profile, s.t);
    if (s.t >= s.profile.sp.length) {
      s.done = true; runBtn.textContent = 'Replay ↺';
      if (!s.trips && !s.ended) log(s.t, 'Journey over. No trip recorded.', 'bad');
      setPhase('idle'); return;
    }
    raf = requestAnimationFrame(frame(now));
  };

  runBtn.addEventListener('click', () => {
    if (!sim || sim.done || sim.t > 0) reset();
    logEl.innerHTML = ''; runBtn.textContent = 'Playing…';
    raf = requestAnimationFrame(frame(performance.now()));
  });
  const controls = document.querySelector('.trip-controls');
  segment(controls, 'route', v => { routeKey = v; reset(); });
  segment(controls, 'rate', v => { rate = +v; });
  reset();

  /* ---------- Claim calculator ---------- */
  const milesEl = $('cl-miles'), claimBox = document.getElementById('claim');
  let veh = 'car', ty = 2026;
  bindRange(claimBox);
  const updateClaim = () => {
    const miles = +milesEl.value, r = RATES[ty];
    const lines = [];
    let pence;
    if (veh === 'moto') {
      pence = miles * r.moto;
      lines.push([`${miles.toLocaleString('en-GB')} mi × ${r.moto}p`, pence]);
    } else {
      const a = Math.min(miles, THRESHOLD), b = Math.max(0, miles - THRESHOLD);
      lines.push([`First ${a.toLocaleString('en-GB')} mi × ${r.first}p`, a * r.first]);
      lines.push([`${b.toLocaleString('en-GB')} mi after 10,000 × ${r.after}p`, b * r.after]);
      pence = a * r.first + b * r.after;
    }
    lines.push(['Total', pence]);
    $('cl-total').textContent = money(pence);
    $('cl-lines').innerHTML = lines.map(([k, p]) => `<li><span>${k}</span><span>${money(p)}</span></li>`).join('');
    const max = 25000, bar = $('cl-bar');
    const first = veh === 'moto' ? miles : Math.min(miles, THRESHOLD), after = veh === 'moto' ? 0 : Math.max(0, miles - THRESHOLD);
    bar.querySelector('.b1').style.width = (first / max * 100) + '%';
    bar.querySelector('.b2').style.width = (after / max * 100) + '%';
    bar.querySelector('.mark').style.display = veh === 'moto' ? 'none' : '';
  };
  milesEl.addEventListener('input', updateClaim);
  segment(claimBox, 'veh', v => { veh = v; updateClaim(); });
  segment(claimBox, 'ty', v => { ty = +v; updateClaim(); });
  updateClaim();
})();
