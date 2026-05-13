/* ============================================================
   The Artem Upgrade Arc — script
   Vanilla JS. State machine. CS2-style case opening. Birthday flow.
   ============================================================ */
(() => {
  'use strict';

  // ---------- State ----------
  const state = {
    screen: 'boot',
    name: '',
    steamNick: '',
    club: null,        // 'arsenal' | 'barcelona'
    style: null,
    tool: null,        // 'ahrefs' | 'semrush'
    obsession: null,
    soundOn: false,
    achievements: new Set(),
  };

  const screens = [
    'boot', 'ask-name', 'ask-steam', 'inventory',
    'ask-club', 'ask-tool', 'loot', 'claim', 'complete',
  ];

  // ---------- Helpers ----------
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Sound (procedural beeps via Web Audio) ----------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (_) { audioCtx = null; }
    }
    return audioCtx;
  }
  function beep({ freq = 440, dur = 0.08, type = 'sine', vol = 0.05, slide = 0 } = {}) {
    if (!state.soundOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq + slide), ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }
  const sfx = {
    click:   () => beep({ freq: 620, dur: 0.05, type: 'square', vol: 0.04 }),
    confirm: () => { beep({ freq: 520, dur: 0.06, type: 'triangle', vol: 0.05 }); setTimeout(() => beep({ freq: 760, dur: 0.08, type: 'triangle', vol: 0.05 }), 70); },
    error:   () => beep({ freq: 180, dur: 0.18, type: 'sawtooth', vol: 0.05, slide: -60 }),
    hit:     () => beep({ freq: 320, dur: 0.10, type: 'square', vol: 0.06, slide: -80 }),
    achieve: () => { beep({ freq: 660, dur: 0.08, type: 'triangle', vol: 0.05 }); setTimeout(() => beep({ freq: 990, dur: 0.10, type: 'triangle', vol: 0.05 }), 80); setTimeout(() => beep({ freq: 1320, dur: 0.14, type: 'triangle', vol: 0.05 }), 180); },
    reveal:  () => { for (let i = 0; i < 6; i++) setTimeout(() => beep({ freq: 440 + i * 80, dur: 0.06, type: 'triangle', vol: 0.04 }), i * 60); },
    win:     () => { for (let i = 0; i < 8; i++) setTimeout(() => beep({ freq: 660 + i * 60, dur: 0.10, type: 'triangle', vol: 0.05 }), i * 90); },
  };

  // ---------- Toasts ----------
  function toast({ title, body, kind = '', timeout = 3600 }) {
    const layer = $('#toast-layer');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `
      <div class="icon" aria-hidden="true">${kind === 'gold' ? '★' : kind === 'red' ? '!' : '✓'}</div>
      <div class="body"><b>${escapeHtml(title)}</b><span>${escapeHtml(body || '')}</span></div>`;
    layer.appendChild(el);
    sfx.achieve();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, timeout);
  }
  function achievement(title, body) {
    if (state.achievements.has(title)) return;
    state.achievements.add(title);
    toast({ title: `Achievement · ${title}`, body, kind: 'gold' });
  }

  // ---------- Screen nav ----------
  function goToScreen(name) {
    if (!screens.includes(name)) return;
    state.screen = name;
    $$('.screen').forEach((s) => s.classList.remove('active'));
    const target = $(`[data-screen="${name}"]`);
    if (target) target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // First-entry effects per screen
    if (name === 'inventory') runScan();
    if (name === 'loot')      resetLoot();
    if (name === 'claim')     runClaim();
    if (name === 'complete')  populateBirthday();
  }

  function wireNavButtons() {
    $$('[data-go]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sfx.confirm();
        goToScreen(btn.dataset.go);
      });
    });
  }

  // ---------- Sound toggle ----------
  function wireSoundToggle() {
    const btn = $('#sound-toggle');
    btn.addEventListener('click', () => {
      state.soundOn = !state.soundOn;
      btn.setAttribute('aria-pressed', String(state.soundOn));
      $('.sound-label', btn).textContent = state.soundOn ? 'SOUND: ON' : 'SOUND: OFF';
      if (state.soundOn) { ensureAudio(); sfx.confirm(); }
    });
  }

  // ============================================================
  // SCREEN 1 — Boot terminal typewriter
  // ============================================================
  const bootLines = [
    { text: 'Initializing DMarket Birthday Upgrade System...', cls: '' },
    { text: 'Loading birthday protocol v1.4.k...', cls: '' },
    { text: 'Verifying SEO God credentials...', cls: 'ok' },
    { text: 'Checking CS2 Player permissions...', cls: 'ok' },
    { text: 'Calibrating premium feel module...', cls: 'ok' },
    { text: 'Pre-warming Steam Web API endpoint...', cls: '' },
    { text: 'Loading inventory inspector...', cls: '' },
    { text: 'Reading saved patch notes...', cls: 'muted' },
    { text: 'Initialization complete.', cls: 'ok' },
    { text: 'Awaiting operator identification...', cls: 'muted' },
  ];

  async function runBoot() {
    const out = $('#terminal-output');
    out.innerHTML = '';
    for (const ln of bootLines) {
      const span = document.createElement('span');
      span.className = `line ${ln.cls}`.trim();
      out.appendChild(span);
      for (let i = 0; i < ln.text.length; i++) {
        span.textContent += ln.text[i];
        if (ln.text[i] !== ' ') sfx.click();
        await sleep(rand(10, 28));
      }
      span.innerHTML += '\n';
      await sleep(rand(120, 280));
    }
    const caret = document.createElement('span');
    caret.className = 'cursor';
    out.appendChild(caret);
    out.scrollTop = out.scrollHeight;
    const btn = $('#btn-begin');
    btn.disabled = false;
    sfx.reveal();
  }

  function wireBoot() {
    $('#btn-begin').addEventListener('click', () => {
      sfx.confirm();
      goToScreen('ask-name');
      setTimeout(() => $('#input-name').focus(), 350);
    });
    runBoot();
  }

  // ============================================================
  // SCREEN 2 — Name input
  // ============================================================
  function propagateName(name) {
    $$('.dyn-name').forEach((el) => { el.textContent = name; });
  }

  function wireName() {
    const form = $('#form-name');
    const input = $('#input-name');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) {
        input.focus();
        sfx.error();
        $('#name-helper').textContent = 'Identity is mandatory. Try again.';
        $('#name-helper').style.color = 'var(--red)';
        return;
      }
      state.name = v;
      propagateName(v);
      sfx.confirm();
      goToScreen('ask-steam');
      setTimeout(() => $('#input-steam').focus(), 350);
    });
  }

  // ============================================================
  // SCREEN 3 — Steam nick input
  // ============================================================
  function wireSteam() {
    const form = $('#form-steam');
    const input = $('#input-steam');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) {
        input.focus();
        sfx.error();
        return;
      }
      state.steamNick = v;
      sfx.confirm();
      goToScreen('inventory');
    });
  }

  // ============================================================
  // SCREEN 4 — Inventory scan + results
  // ============================================================
  const inventoryItems = [
    { name: 'MP7 | Smoking Kills',          wear: 'Minimal Wear', img: 'assets/images/inv-mp7-smoking.png',       tooltip: 'Nice SMG. Hands remain default.' },
    { name: 'AWP | Ice Coaled',             wear: 'Minimal Wear', img: 'assets/images/inv-awp-icecoaled.png',     tooltip: 'Cold blue, even colder hand slot.' },
    { name: 'M4A1-S | Black Lotus',         wear: 'Minimal Wear', img: 'assets/images/inv-m4a1s-blacklotus.png',  tooltip: 'Premium rifle. Premium gloveless energy.' },
    { name: 'Glock-18 | Vogue',             wear: 'Factory New',  img: 'assets/images/inv-glock-vogue.png',       tooltip: 'Fashion-forward pistol. Hands stuck in 2014.' },
    { name: 'M4A4 | Spider Lily',           wear: 'Minimal Wear', img: 'assets/images/inv-m4a4-spiderlily.png',   tooltip: 'Beautiful skin. Bare hands ruin the look.' },
    { name: '★ Falchion Knife | Doppler',   wear: 'Factory New',  img: 'assets/images/inv-falchion-doppler.png',  tooltip: 'Has a star ★ in front. Hand slot has nothing.' },
    { name: 'AK-47 | Nightwish',            wear: 'Field-Tested', img: 'assets/images/inv-ak-nightwish.png',      tooltip: 'AK fire detected. Hand drip absent.' },
    { name: 'AWP | POP AWP',                wear: 'Field-Tested', img: 'assets/images/inv-awp-popawp.png',        tooltip: 'Pop art aesthetic. Hand slot still gray-scale.' },
    { name: 'Desert Eagle | Serpent Strike',wear: 'Field-Tested', img: 'assets/images/inv-deagle-serpent.png',    tooltip: 'Big iron, naked grip.' },
    { name: 'FAMAS | ZX Spectron',          wear: 'Well-Worn',    img: 'assets/images/inv-famas-zxspectron.png',  tooltip: 'Cyber French rifle. Hands offline.' },
    { name: 'M4A4 | Turbine',               wear: 'Field-Tested', img: 'assets/images/inv-m4a4-turbine.png',      tooltip: 'Industrial vibes. Hand slot: under construction.' },
    { name: 'USP-S | Check Engine',         wear: 'Field-Tested', img: 'assets/images/inv-usps-checkengine.png',  tooltip: 'Check engine on. Check gloves: missing.' },
    { name: 'GLOVES MISSING',               wear: 'critical',     img: null,                                       tooltip: 'Hand slot empty. This is exactly why we are here.', missing: true },
  ];

  function renderInventoryGrid() {
    const grid = $('#inventory-grid');
    if (grid.childElementCount) return;
    inventoryItems.forEach((it) => {
      const card = document.createElement('div');
      card.className = `inv-item${it.missing ? ' missing' : ''}`;
      card.setAttribute('role', 'listitem');
      card.tabIndex = 0;
      if (it.missing) {
        card.innerHTML = `
          <div class="inv-warn-badge">⚠</div>
          <div class="inv-missing-label">★ GLOVES SLOT</div>
          <div class="inv-name inv-name-missing">No gloves found</div>
          <div class="inv-tooltip">${escapeHtml(it.tooltip)}</div>
        `;
      } else {
        card.innerHTML = `
          <div class="inv-img"><img src="${it.img}" alt="${escapeHtml(it.name)}" loading="lazy" /></div>
          <div class="inv-name">${escapeHtml(it.name)}</div>
          <div class="inv-wear">${escapeHtml(it.wear)}</div>
          <div class="inv-tooltip">${escapeHtml(it.tooltip)}</div>
        `;
      }
      card.addEventListener('mouseenter', () => {
        $('#inventory-verdict-text').textContent = it.tooltip;
        sfx.click();
        if (it.missing) achievement('Found It', 'The very issue we came here to solve.');
      });
      card.addEventListener('focus', () => {
        $('#inventory-verdict-text').textContent = it.tooltip;
      });
      grid.appendChild(card);
    });
  }

  let scanStarted = false;
  async function runScan() {
    if (scanStarted) return;
    scanStarted = true;

    // Personalize scan nickname
    $('#scan-nick').textContent = state.steamNick || 'player';

    const progress = $('#scan-progress');
    const fill = $('#scan-fill');
    const pct = $('#scan-percent');
    const label = $('#scan-label');
    const log = $('#scan-log');
    const results = $('#inventory-results');
    const cta = $('#btn-after-inventory');

    progress.classList.remove('hidden');
    results.classList.add('hidden');
    cta.classList.add('hidden');
    fill.style.width = '0%';
    pct.textContent = '0%';
    log.innerHTML = '';

    const steps = [
      { label: 'Establishing handshake with Steam Web API…',           at: 12,  log: `> resolving handle: ${state.steamNick}`,            cls: '' },
      { label: 'Authenticating session token…',                         at: 24,  log: '> auth: OK',                                          cls: 'ok' },
      { label: 'Fetching inventory metadata…',                           at: 40,  log: '> page 1/2 fetched',                                  cls: '' },
      { label: 'Parsing item descriptors…',                              at: 58,  log: '> 47 items identified',                               cls: '' },
      { label: 'Fetching page 2 (just to be sure)…',                     at: 72,  log: '> page 2/2 fetched · still no gloves',                cls: 'warn' },
      { label: 'Indexing rarity distribution…',                          at: 84,  log: '> indexed: blue, purple, pink, gold present',         cls: 'ok' },
      { label: 'Diagnosing hand slot…',                                  at: 95,  log: '> hand slot: ',                                       cls: '' },
      { label: 'Diagnosis complete.',                                    at: 100, log: '!!! HAND SLOT: EMPTY · pre-legendary state',          cls: 'err' },
    ];

    let cur = 0;
    for (const s of steps) {
      label.textContent = s.label;
      // animate fill
      const start = cur, end = s.at;
      const t0 = performance.now();
      const dur = randInt(380, 700);
      await new Promise((resolve) => {
        function tick(now) {
          const k = clamp((now - t0) / dur, 0, 1);
          const e = 1 - Math.pow(1 - k, 3);
          const v = start + (end - start) * e;
          fill.style.width = `${v}%`;
          pct.textContent = `${Math.round(v)}%`;
          if (k < 1) requestAnimationFrame(tick);
          else { cur = end; resolve(); }
        }
        requestAnimationFrame(tick);
      });
      const li = document.createElement('li');
      if (s.cls) li.classList.add(s.cls);
      li.textContent = s.log;
      log.appendChild(li);
      log.scrollTop = log.scrollHeight;
      sfx.click();
      if (s.at === 100) sfx.error();
    }

    await sleep(360);
    renderInventoryGrid();
    results.classList.remove('hidden');
    cta.classList.remove('hidden');
    achievement('Inventory Scanned', `Page 1, page 2, still no gloves. Verdict: pre-legendary.`);
    sfx.reveal();
  }

  // ============================================================
  // SCREEN 5 — Club + Style
  // ============================================================
  const clubResults = {
    arsenal: {
      style: 'Trust the Process',
      text: 'Endures 90+10 minutes of psychological warfare. Hope is a strategy. Pain tolerance: catastrophically high. Style detected: long-suffering loyalist.',
    },
    barcelona: {
      style: 'Tiki-taka Maximalist',
      text: 'Possession over points. Aesthetics over W. Treats every match like a museum tour — beautiful, calm, occasionally on fire. Style detected: aesthetic-first culé.',
    },
  };
  function wireClub() {
    $$('.choice-card', $('#club-grid')).forEach((card) => {
      card.addEventListener('click', () => {
        const key = card.dataset.club;
        state.club = key;
        state.style = clubResults[key].style;
        $$('.choice-card', $('#club-grid')).forEach((c) => {
          c.classList.toggle('selected', c === card);
          c.classList.toggle('dimmed', c !== card);
        });
        card.setAttribute('aria-pressed', 'true');
        $('#club-style').textContent = state.style;
        $('#club-style-text').textContent = clubResults[key].text;
        $('#club-result').classList.remove('hidden');
        sfx.confirm();
        achievement('Allegiance Logged', `${key === 'arsenal' ? 'Arsenal' : 'Barcelona'}-grade emotional infrastructure detected.`);
      });
    });
  }

  // ============================================================
  // SCREEN 6 — SEO tool + Obsession
  // ============================================================
  const toolResults = {
    ahrefs: {
      obsession: 'Domain Rating Compulsion',
      text: 'Wakes up checking DR. Goes to sleep checking DR. Refuses backlinks below DR 60. Treats Site Explorer like a religion and the Content Gap report like scripture.',
    },
    semrush: {
      obsession: 'Position #1 Maniac',
      text: 'SERP position drop = personal insult. Tracks 800+ keywords. Sleeps with one eye on the rankings. The keyword cannibalization report is bedtime reading.',
    },
  };
  function wireTool() {
    $$('.choice-card', $('#tool-grid')).forEach((card) => {
      card.addEventListener('click', () => {
        const key = card.dataset.tool;
        state.tool = key;
        state.obsession = toolResults[key].obsession;
        $$('.choice-card', $('#tool-grid')).forEach((c) => {
          c.classList.toggle('selected', c === card);
          c.classList.toggle('dimmed', c !== card);
        });
        card.setAttribute('aria-pressed', 'true');
        $('#tool-obsession').textContent = state.obsession;
        $('#tool-obsession-text').textContent = toolResults[key].text;
        $('#tool-result').classList.remove('hidden');
        sfx.confirm();
        achievement('SEO Profile Locked', `${key === 'ahrefs' ? 'Ahrefs' : 'Semrush'} loyalist confirmed.`);
      });
    });
  }

  // ============================================================
  // SCREEN 7 — Loot / Case opening
  // ============================================================
  // Common skins (gray/blue, like CS2 mil-spec/industrial) — repeated randomly for carousel filler
  const commonSkins = [
    { img: 'assets/images/skin-1.webp' },
    { img: 'assets/images/skin-2.webp' },
    { img: 'assets/images/skin-3.webp' },
    { img: 'assets/images/skin-4.webp' },
    { img: 'assets/images/skin-5.webp' },
    { img: 'assets/images/skin-6.webp' },
    { img: 'assets/images/skin-7.webp' },
    { img: 'assets/images/skin-8.webp' },
  ];
  const commonRarities = ['blue', 'light']; // mil-spec blue + consumer/industrial gray
  // Three guaranteed special items (always appear in same fixed positions of the carousel)
  const specials = {
    early:  { img: 'assets/images/skin-knife-start.webp', rarity: 'gold' }, // golden knife near the start
    midA:   { img: 'assets/images/skin-knife-mid.webp',   rarity: 'gold' }, // another golden knife mid
    midB:   { img: 'assets/images/skin-ak-red.webp',      rarity: 'red'  }, // red covert AK
  };
  const gloves = {
    name: '★ Hydra Gloves | Case Hardened',
    rarity: 'gold',
    img: 'assets/images/hydra-gloves.webp',
    final: true,
  };

  function resetLoot() {
    $('#loot-roller').classList.add('hidden');
    $('#loot-final').classList.add('hidden');
    $('#btn-open-loot').disabled = false;
    $('#loot-track').style.transition = 'none';
    $('#loot-track').style.transform = 'translateX(0)';
  }

  function wireLoot() {
    $('#btn-open-loot').addEventListener('click', openLoot);
  }

  async function openLoot() {
    const btn = $('#btn-open-loot');
    btn.disabled = true;
    sfx.confirm();

    const roller = $('#loot-roller');
    const track  = $('#loot-track');
    roller.classList.remove('hidden');

    // Build sequence: 60 items total, all common except 3 fixed specials + gloves at end
    const TOTAL = 60;
    const FINAL_IDX = TOTAL - 1;
    const sequence = new Array(TOTAL);
    // Fill with common skins, randomized
    for (let i = 0; i < TOTAL - 1; i++) {
      const img = pick(commonSkins).img;
      const rarity = pick(commonRarities);
      sequence[i] = { img, rarity };
    }
    // Place specials at fixed-but-jittered positions
    sequence[randInt(3, 6)]   = { ...specials.early, special: true }; // golden knife near start
    sequence[randInt(26, 32)] = { ...specials.midA,  special: true }; // golden knife mid
    sequence[randInt(38, 46)] = { ...specials.midB,  special: true }; // red covert AK mid
    // Final = gloves
    sequence[FINAL_IDX] = gloves;
    const finalIndex = FINAL_IDX;

    track.innerHTML = '';
    sequence.forEach((it) => {
      const el = document.createElement('div');
      el.className = `loot-item r-${it.rarity}`;
      el.innerHTML = `<div class="loot-item-only-img"><img src="${it.img}" alt="" /></div>`;
      track.appendChild(el);
    });

    await sleep(50);
    const itemW = 152; // 140 + 12 gap
    const rollerW = roller.getBoundingClientRect().width;
    const markerX = rollerW / 2;
    const finalCenter = finalIndex * itemW + (140 / 2) + 12;
    const targetX = finalCenter - markerX + rand(-22, 22);

    const ROLL_MS = 8400;
    track.style.transition = `transform ${ROLL_MS}ms cubic-bezier(0.10, 0.55, 0.05, 1)`;
    track.style.transform = `translateX(${-targetX}px)`;

    // tick sounds during roll
    const t0 = performance.now();
    let last = 0;
    (function tick() {
      const dt = performance.now() - t0;
      const k = clamp(dt / ROLL_MS, 0, 1);
      const rate = (1 - k) * 22 + 2;
      if (dt - last > 1000 / rate) { sfx.click(); last = dt; }
      if (k < 1) requestAnimationFrame(tick);
    })();

    await sleep(ROLL_MS + 100);
    // Snap to perfectly centered
    const snapX = finalCenter - markerX;
    track.style.transition = 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)';
    track.style.transform = `translateX(${-snapX}px)`;

    sfx.reveal();
    await sleep(500);

    // Reveal final
    $('#loot-final').classList.remove('hidden');
    achievement('★ Hydra Gloves', 'Covert drop. Case Hardened. Birthday-tier.');
    fireConfetti();
  }

  // ---------- Confetti ----------
  let confettiRunning = false;
  function fireConfetti() {
    const canvas = $('#confetti');
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      canvas.width = window.innerWidth * DPR;
      canvas.height = window.innerHeight * DPR;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
    }
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#f5c451', '#35d5ff', '#4c7dff', '#8e5cff', '#ff5cc8', '#5cff9d'];
    const particles = [];
    const N = 200;
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = 0; i < N; i++) {
      particles.push({
        x: w / 2 + rand(-40, 40),
        y: h * 0.4 + rand(-20, 20),
        vx: rand(-7, 7),
        vy: rand(-12, -4),
        g: 0.32,
        s: rand(4, 8),
        c: pick(colors),
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.2, 0.2),
        life: 1,
      });
    }
    if (confettiRunning) return;
    confettiRunning = true;
    const start = performance.now();

    function frame(now) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(DPR, DPR);
      let alive = 0;
      for (const p of particles) {
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 0.005;
        if (p.y < h + 40 && p.life > 0) {
          alive++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.c;
          ctx.globalAlpha = clamp(p.life, 0, 1);
          ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.5);
          ctx.restore();
        }
      }
      ctx.restore();
      if (alive > 0 && now - start < 7500) requestAnimationFrame(frame);
      else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        confettiRunning = false;
      }
    }
    requestAnimationFrame(frame);
  }

  // ============================================================
  // SCREEN 8 — Claim / Transfer
  // ============================================================
  let claimStarted = false;
  async function runClaim() {
    if (claimStarted) return;
    claimStarted = true;

    const fill = $('#claim-bar-fill');
    const log = $('#claim-log');
    const progress = $('#claim-progress');
    const success = $('#claim-success');

    progress.classList.remove('hidden');
    success.classList.add('hidden');
    fill.style.width = '0%';
    log.innerHTML = '';

    const steps = [
      { at: 10,  text: '> initiating transfer protocol…',                cls: '' },
      { at: 24,  text: '> verifying asset integrity…',                   cls: '' },
      { at: 40,  text: '> binding ★ Hydra Gloves to recipient',          cls: 'ok' },
      { at: 58,  text: '> recipient: ' + (state.name || 'Artem'),         cls: 'ok' },
      { at: 72,  text: '> bypassing default hands…',                      cls: 'warn' },
      { at: 86,  text: '> writing to real-life inventory…',               cls: '' },
      { at: 100, text: '> handshake confirmed · transfer complete',      cls: 'ok' },
    ];

    let cur = 0;
    for (const s of steps) {
      const start = cur, end = s.at;
      const t0 = performance.now();
      const dur = randInt(360, 540);
      await new Promise((resolve) => {
        function tick(now) {
          const k = clamp((now - t0) / dur, 0, 1);
          const e = 1 - Math.pow(1 - k, 3);
          const v = start + (end - start) * e;
          fill.style.width = `${v}%`;
          if (k < 1) requestAnimationFrame(tick);
          else { cur = end; resolve(); }
        }
        requestAnimationFrame(tick);
      });
      const li = document.createElement('li');
      if (s.cls) li.classList.add(s.cls);
      li.textContent = s.text;
      log.appendChild(li);
      sfx.click();
    }
    await sleep(500);
    progress.classList.add('hidden');
    success.classList.remove('hidden');
    sfx.win();
    achievement('Transfer Complete', '★ Hydra Gloves delivered to real-life inventory.');
  }

  // ============================================================
  // SCREEN 9 — Birthday (marketing team)
  // ============================================================
  function populateBirthday() {
    const name = state.name || 'Artem';
    $('#bd-name').textContent = name;
    $('#bd-name-inline').textContent = name;
  }

  function buildShareText() {
    const name = state.name || 'Artem';
    return `I survived the DMarket Birthday Upgrade Arc, scanned my inventory, picked my club and SEO tool, and unlocked ★ Hydra Gloves | Case Hardened. Default hands are officially retired.

— ${name} · Artem Upgrade Arc · happy birthday from the DMarket marketing team`;
  }

  function wireComplete() {
    $('#btn-copy').addEventListener('click', async () => {
      const text = buildShareText();
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Copied to clipboard', body: 'Paste anywhere with hands.' });
        sfx.confirm();
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); toast({ title: 'Copied', body: 'Fallback copy succeeded.' }); }
        catch (_) { toast({ title: 'Copy failed', body: 'Select and copy manually.', kind: 'red' }); }
        ta.remove();
      }
    });

    $('#btn-download').addEventListener('click', () => downloadResultCard());

    $('#btn-restart').addEventListener('click', () => {
      // soft reset
      state.name = '';
      state.steamNick = '';
      propagateName('player');
      state.club = null; state.style = null;
      state.tool = null; state.obsession = null;
      scanStarted = false;
      claimStarted = false;
      $('#input-name').value = '';
      $('#input-steam').value = '';
      $('#name-helper').textContent = 'Press Enter or click Continue.';
      $('#name-helper').style.color = '';
      $$('.choice-card').forEach((c) => { c.classList.remove('selected', 'dimmed'); c.setAttribute('aria-pressed', 'false'); });
      $('#club-result').classList.add('hidden');
      $('#tool-result').classList.add('hidden');
      $('#inventory-grid').innerHTML = '';
      $('#claim-progress').classList.remove('hidden');
      $('#claim-success').classList.add('hidden');
      goToScreen('boot');
      $('#terminal-output').innerHTML = '';
      $('#btn-begin').disabled = true;
      runBoot();
    });
  }

  // Render result card to canvas → PNG
  function downloadResultCard() {
    const W = 1200, H = 1500;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0c1224');
    bg.addColorStop(1, '#06090f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Glows
    const g1 = ctx.createRadialGradient(W * 0.85, 120, 20, W * 0.85, 120, 600);
    g1.addColorStop(0, 'rgba(245,196,81,0.35)'); g1.addColorStop(1, 'rgba(245,196,81,0)');
    ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(W * 0.15, H - 200, 20, W * 0.15, H - 200, 600);
    g2.addColorStop(0, 'rgba(76,125,255,0.35)'); g2.addColorStop(1, 'rgba(76,125,255,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

    // Header chip
    ctx.font = '600 22px Inter, "Segoe UI", sans-serif';
    ctx.fillStyle = '#8f9bb3';
    ctx.fillText('DMARKET · MARKETING · BIRTHDAY EDITION', 80, 110);

    // Title
    ctx.fillStyle = '#eef3ff';
    ctx.font = '800 72px Inter, "Segoe UI", sans-serif';
    ctx.fillText('З Днем Народження,', 80, 210);
    const titleGrad = ctx.createLinearGradient(80, 220, 80 + 700, 220);
    titleGrad.addColorStop(0, '#f5c451'); titleGrad.addColorStop(1, '#ffd97a');
    ctx.fillStyle = titleGrad;
    ctx.font = '800 84px Inter, "Segoe UI", sans-serif';
    ctx.fillText((state.name || 'Artem') + '!', 80, 300);

    ctx.fillStyle = '#8f9bb3';
    ctx.font = '400 24px "SFMono-Regular", Consolas, monospace';
    ctx.fillText('// SEO God · CS2 Player · Inventory legend', 80, 340);

    // Stats panel
    const px = 80, py = 400, pw = W - 160, ph = 660;
    roundRect(ctx, px, py, pw, ph, 28);
    ctx.fillStyle = 'rgba(20,27,45,0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const items = [
      ['Player',         state.name || 'Artem'],
      ['Steam handle',   state.steamNick || '—'],
      ['Allegiance',     state.club ? (state.club === 'arsenal' ? 'Arsenal' : 'Barcelona') : '—'],
      ['Style',          state.style || '—'],
      ['SEO weapon',     state.tool ? (state.tool === 'ahrefs' ? 'Ahrefs' : 'Semrush') : '—'],
      ['Obsession',      state.obsession || '—'],
      ['Hand slot',      'UPGRADED · ★ Hydra Gloves'],
    ];
    items.forEach((row, i) => {
      const y = py + 60 + i * 80;
      ctx.fillStyle = '#cfd6ea';
      ctx.font = '500 24px Inter, "Segoe UI", sans-serif';
      ctx.fillText(row[0], px + 36, y);
      ctx.fillStyle = '#f5c451';
      ctx.font = '700 24px "SFMono-Regular", Consolas, monospace';
      // truncate long values
      let val = row[1];
      const maxW = pw - 240;
      while (ctx.measureText(val).width > maxW && val.length > 4) { val = val.slice(0, -2); }
      if (val !== row[1]) val += '…';
      const valW = ctx.measureText(val).width;
      ctx.fillText(val, px + pw - 36 - valW, y);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(px + 36, y + 20);
      ctx.lineTo(px + pw - 36, y + 20);
      ctx.stroke();
    });

    // Message
    ctx.fillStyle = '#eef3ff';
    ctx.font = '700 32px Inter, "Segoe UI", sans-serif';
    ctx.fillText('The hand slot is officially upgraded.', 80, 1170);
    ctx.fillStyle = '#cfd6ea';
    ctx.font = '400 26px Inter, "Segoe UI", sans-serif';
    ctx.fillText('From the entire DMarket marketing crew.', 80, 1220);
    ctx.fillText('Happy Birthday, ' + (state.name || 'Artem') + '.', 80, 1260);

    // Footer
    ctx.fillStyle = '#5a6480';
    ctx.font = '400 22px "SFMono-Regular", Consolas, monospace';
    ctx.fillText('built with default hands · for the man who finally gets gloves', 80, H - 60);

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `artem-upgrade-arc-${(state.name || 'artem').toLowerCase().replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast({ title: 'Result downloaded', body: 'Saved as PNG to your machine.' });
      sfx.confirm();
    }, 'image/png');
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ============================================================
  // Easter eggs — Konami code
  // ============================================================
  const konami = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'b', 'a',
  ];
  let konamiBuf = [];
  window.addEventListener('keydown', (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    konamiBuf.push(key);
    if (konamiBuf.length > konami.length) konamiBuf.shift();
    if (konamiBuf.length === konami.length && konamiBuf.every((k, i) => k === konami[i])) {
      konamiBuf = [];
      achievement('Certified Gloveless Legend', 'You knew the code. Hands respect that.');
      const flash = document.createElement('div');
      flash.style.cssText = 'position:fixed;inset:0;background:radial-gradient(circle,rgba(245,196,81,0.35),transparent 60%);z-index:55;pointer-events:none;animation:fadeOut 900ms ease forwards';
      const sheet = document.createElement('style');
      sheet.textContent = '@keyframes fadeOut{0%{opacity:0}30%{opacity:1}100%{opacity:0}}';
      document.head.appendChild(sheet);
      document.body.appendChild(flash);
      setTimeout(() => { flash.remove(); sheet.remove(); }, 1000);
      sfx.win();
    }
  });

  // ============================================================
  // Boot
  // ============================================================
  function init() {
    wireNavButtons();
    wireSoundToggle();
    wireBoot();
    wireName();
    wireSteam();
    wireClub();
    wireTool();
    wireLoot();
    wireComplete();

    // Preload gloves image (so case reveal is instant)
    const pre = new Image();
    pre.src = 'assets/images/hydra-gloves.webp';

    /* eslint-disable no-console */
    console.log('%c THE ARTEM UPGRADE ARC ', 'background:#f5c451;color:#1a1500;font-weight:800;padding:4px 8px;border-radius:4px');
    console.log('%c hint: ↑ ↑ ↓ ↓ ← → ← → B A ', 'color:#35d5ff;font-family:monospace');
    console.log('%c page 1 has skins. page 2 has skins. hand slot has sadness.', 'color:#8f9bb3;font-family:monospace');
    /* eslint-enable no-console */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
