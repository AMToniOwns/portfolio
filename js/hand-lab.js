/* Opening hand lab: a browser port of DuelLab's sampler.
   - xoshiro256** seeded with SplitMix64 (DuelLab.Simulator/Randomness)
   - Lemire's unbiased bounded integers
   - partial Fisher–Yates draw (DuelLab.Simulator/Algorithms/HandSimulator)
   - exact multivariate hypergeometric probabilities and 95% Wilson intervals */
(() => {
  const M64 = (1n << 64n) - 1n;
  const rotl = (x, k) => ((x << BigInt(k)) | (x >> BigInt(64 - k))) & M64;

  class Xoshiro256 {
    constructor(seed) {
      let sm = BigInt.asUintN(64, BigInt(seed));
      const next = () => {
        sm = (sm + 0x9E3779B97F4A7C15n) & M64;
        let z = sm;
        z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & M64;
        z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & M64;
        return z ^ (z >> 31n);
      };
      this.s = [next(), next(), next(), next()];
    }
    nextU64() {
      const s = this.s;
      const result = (rotl((s[1] * 5n) & M64, 7) * 9n) & M64;
      const t = (s[1] << 17n) & M64;
      s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 45);
      return result;
    }
    below(bound) { // Lemire (2019)
      const b = BigInt(bound);
      let p = this.nextU64() * b, low = p & M64;
      if (low < b) {
        const threshold = ((1n << 64n) - b) % b;
        while (low < threshold) { p = this.nextU64() * b; low = p & M64; }
      }
      return Number(p >> 64n);
    }
    range(min, max) { return min + this.below(max - min); }
  }

  const C = (n, k) => { if (k < 0 || k > n) return 0; k = Math.min(k, n - k); let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
  const wilson = (x, n, z = 1.959963984540054) => {
    const p = x / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [Math.max(0, c - h), Math.min(1, c + h)];
  };

  const SCENARIOS = [
    { name: 'Starter', desc: 'at least 1 starter', test: (s) => s >= 1 },
    { name: '2+ starters', desc: 'at least 2 starters', test: (s) => s >= 2 },
    { name: 'Starter + extender', desc: 'one of each', test: (s, e) => s >= 1 && e >= 1 },
    { name: 'No bricks', desc: 'zero bricks', test: (s, e, b) => b === 0 },
    { name: 'A good opener', desc: '(starter and extender) or 2+ starters, and no bricks', test: (s, e, b) => ((s >= 1 && e >= 1) || s >= 2) && b === 0 },
  ];

  const exact = (N, S, E, B, h) => {
    const O = N - S - E - B, total = C(N, h), res = SCENARIOS.map(() => 0);
    for (let s = 0; s <= Math.min(S, h); s++)
      for (let e = 0; e <= Math.min(E, h - s); e++)
        for (let b = 0; b <= Math.min(B, h - s - e); b++) {
          const o = h - s - e - b; if (o > O) continue;
          const p = C(S, s) * C(E, e) * C(B, b) * C(O, o) / total;
          SCENARIOS.forEach((sc, i) => { if (sc.test(s, e, b)) res[i] += p; });
        }
    return res;
  };

  const form = document.getElementById('hl-form');
  const handEl = document.getElementById('hl-hand'), barsEl = document.getElementById('hl-bars');
  const metaEl = document.getElementById('hl-meta'), warnEl = document.getElementById('hl-warn'), runBtn = document.getElementById('hl-run');
  let handSize = 5, running = false;
  bindRange(form);
  segment(form, 'hand', v => { handSize = +v; run(); });

  barsEl.innerHTML = SCENARIOS.map((sc, i) => `
    <div class="bar-row" data-i="${i}">
      <div class="name">${sc.name}<small>${sc.desc}</small></div>
      <div class="bar-track"><div class="bar-ci"></div><div class="bar-fill"></div><div class="bar-tick" style="left:0"></div></div>
      <div class="pct">–<small>exact –</small></div>
    </div>`).join('');

  const read = () => {
    const f = new FormData(form);
    return { N: +f.get('deck'), S: +f.get('starters'), E: +f.get('extenders'), B: +f.get('bricks'), seed: Math.max(0, Math.floor(+f.get('seed') || 0)), n: +f.get('samples') };
  };

  const renderHand = (hand) => {
    const label = { s: 'Starter', e: 'Extender', b: 'Brick', o: 'Other' };
    handEl.innerHTML = hand.map((c, i) => `<div class="card ${c.t}" style="animation-delay:${i * 90}ms"><div class="face front"><span>${label[c.t]}</span><b>${String(c.id + 1).padStart(2, '0')}</b></div></div>`).join('');
  };

  async function run() {
    if (running) return;
    const { N, S, E, B, seed, n } = read();
    if (S + E + B > N) { warnEl.hidden = false; warnEl.textContent = `Starters, extenders and bricks add up to ${S + E + B}, more than the ${N}-card deck.`; return; }
    warnEl.hidden = true; running = true; runBtn.textContent = 'Simulating…';
    const deck = [];
    for (let i = 0; i < N; i++) deck.push({ id: i, t: i < S ? 's' : i < S + E ? 'e' : i < S + E + B ? 'b' : 'o' });
    const rng = new Xoshiro256(seed), hits = SCENARIOS.map(() => 0);
    const cards = deck.slice(); let first = null;
    const t0 = performance.now();
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < handSize; i++) { const j = rng.range(i, N); const tmp = cards[i]; cards[i] = cards[j]; cards[j] = tmp; }
      let s = 0, e = 0, b = 0;
      for (let i = 0; i < handSize; i++) { const t = cards[i].t; if (t === 's') s++; else if (t === 'e') e++; else if (t === 'b') b++; }
      SCENARIOS.forEach((sc, i) => { if (sc.test(s, e, b)) hits[i]++; });
      if (!first) first = cards.slice(0, handSize);
      for (let i = 0; i < N; i++) cards[i] = deck[i]; // fresh deck each hand, as DuelLab copies the deck
      if (k % 4000 === 3999) await new Promise(r => setTimeout(r));
    }
    const ms = performance.now() - t0, ex = exact(N, S, E, B, handSize);
    renderHand(first);
    barsEl.querySelectorAll('.bar-row').forEach((row, i) => {
      const p = hits[i] / n, [lo, hi] = wilson(hits[i], n);
      row.querySelector('.bar-fill').style.width = (p * 100) + '%';
      row.querySelector('.bar-tick').style.left = `calc(${ex[i] * 100}% - 1.5px)`;
      const ci = row.querySelector('.bar-ci'); ci.style.left = lo * 100 + '%'; ci.style.width = (hi - lo) * 100 + '%';
      row.querySelector('.pct').innerHTML = `${(p * 100).toFixed(1)}%<small>exact ${(ex[i] * 100).toFixed(1)}%</small>`;
    });
    metaEl.textContent = `${n.toLocaleString('en-GB')} hands of ${handSize} from ${N} · seed ${seed} · ${Math.round(ms)} ms · first hand shown`;
    running = false; runBtn.textContent = 'Simulate ▸';
  }

  runBtn.addEventListener('click', run);
  form.querySelector('[name=seed]').addEventListener('change', run);
  let deb; form.addEventListener('input', e => { if (e.target.type === 'range') { clearTimeout(deb); deb = setTimeout(run, 350); } });
  form.querySelector('[name=samples]').addEventListener('change', run);

  const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { run(); io.disconnect(); } }, { threshold: .2 });
  io.observe(document.getElementById('hand-lab'));
  window.__Xoshiro256 = Xoshiro256;
})();
