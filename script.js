/* ============================================================
   The Artem Upgrade Arc — script
   Vanilla JS. State machine. Boss fight. Loot reveal. Easter eggs.
   ============================================================ */
(() => {
  'use strict';

  // ---------- State ----------
  const state = {
    screen: 'boot',
    fanChecks: { arsenal: false, barcelona: false, navi: false },
    bossHp: 100,
    dripScore: 60,
    achievements: new Set(),
    soundOn: false,
    rankBadgeClicks: 0,
    fandomClickCounts: { arsenal: 0, barcelona: 0, navi: 0 },
  };

  const screens = [
    'boot', 'profile', 'fandom', 'cs2', 'inventory',
    'drip', 'boss', 'loot', 'complete',
  ];

  // ---------- Helpers ----------
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

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
    crit:    () => { beep({ freq: 240, dur: 0.10, type: 'sawtooth', vol: 0.06 }); setTimeout(() => beep({ freq: 480, dur: 0.16, type: 'square', vol: 0.06 }), 80); },
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
      <div class="body"><b>${title}</b><span>${body || ''}</span></div>`;
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
    if (name === 'inventory') renderInventory();
    if (name === 'drip')      animateDrip();
    if (name === 'boss')      resetBoss();
    if (name === 'loot')      resetLoot();
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
    { text: 'Loading player profile...', cls: '' },
    { text: 'Name detected: Artem', cls: 'ok' },
    { text: 'Class detected: SEO Specialist', cls: 'ok' },
    { text: 'Checking Arsenal pain tolerance... high', cls: 'ok' },
    { text: 'Checking Barcelona aesthetics... confirmed', cls: 'ok' },
    { text: 'Checking NAVI faith... stable', cls: 'ok' },
    { text: 'Checking CS2 rating... 12–14k blue zone', cls: 'warn' },
    { text: 'Inspecting inventory...', cls: '' },
    { text: 'Scanning page 1... skins detected.', cls: 'muted' },
    { text: 'Scanning page 2... still skins. still no gloves.', cls: 'muted' },
    { text: 'CRITICAL ISSUE DETECTED: HAND SLOT EMPTY', cls: 'err' },
    { text: 'Diagnosis: pre-legendary state.', cls: 'warn' },
    { text: 'Awaiting operator confirmation...', cls: 'muted' },
  ];

  async function runBoot() {
    const out = $('#terminal-output');
    out.innerHTML = '';
    for (const ln of bootLines) {
      const span = document.createElement('span');
      span.className = `line ${ln.cls}`.trim();
      out.appendChild(span);
      // typewriter
      for (let i = 0; i < ln.text.length; i++) {
        span.textContent += ln.text[i];
        if (ln.text[i] !== ' ') sfx.click();
        await sleep(rand(10, 28));
      }
      span.innerHTML += '\n';
      await sleep(rand(120, 320));
    }
    const caret = document.createElement('span');
    caret.className = 'cursor';
    out.appendChild(caret);
    out.scrollTop = out.scrollHeight;
    const btn = $('#btn-begin');
    btn.disabled = false;
    btn.classList.add('ready');
    sfx.reveal();
  }

  function wireBoot() {
    $('#btn-begin').addEventListener('click', () => {
      sfx.confirm();
      goToScreen('profile');
    });
    runBoot();
  }

  // ============================================================
  // SCREEN 3 — Fandom cards
  // ============================================================
  function wireFandom() {
    const cards = $$('.fandom-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const key = card.dataset.fandom;
        state.fandomClickCounts[key] = (state.fandomClickCounts[key] || 0) + 1;

        // Easter eggs: repeated clicks
        if (state.fandomClickCounts[key] === 5) {
          if (key === 'arsenal')   toast({ title: 'Arsenal Fan Verified', body: 'Trust the process. Even here.' });
          if (key === 'barcelona') toast({ title: 'Culé Detected',         body: 'Beautiful football, complicated emotions.' });
          if (key === 'navi')      toast({ title: 'NAVI Faithful',         body: 'Next map surely ours.' });
        }

        if (!state.fanChecks[key]) {
          state.fanChecks[key] = true;
          card.classList.add('flipped');
          card.setAttribute('aria-pressed', 'true');
          sfx.confirm();
        }
        updateFandomProgress();
      });
    });
  }

  function updateFandomProgress() {
    const done = Object.values(state.fanChecks).filter(Boolean).length;
    $('#fandom-progress-label').textContent = `${done} / 3 identity signals confirmed`;
    $('#fandom-progress-fill').style.width = `${(done / 3) * 100}%`;
    if (done === 3) {
      $('#fandom-verdict').classList.remove('hidden');
      $('#btn-after-fandom').disabled = false;
      achievement('Multi-fandom Verified', 'Emotionally complex but culturally valid.');
    }
  }

  // ============================================================
  // SCREEN 4 — CS2 reality (rank badge easter egg)
  // ============================================================
  function wireCs2() {
    const badge = $('#rank-badge');
    badge.addEventListener('click', () => {
      state.rankBadgeClicks++;
      sfx.click();
      badge.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }],
        { duration: 280, easing: 'ease-out' }
      );
      if (state.rankBadgeClicks === 5) {
        toast({ title: 'Rank Acknowledged', body: 'Relax, 14k is enough to enter this website.' });
        achievement('Blue Tier Citizen', 'Honest, working-class Counter-Strike.');
      }
      if (state.rankBadgeClicks === 12) {
        toast({ title: 'Stop clicking', body: 'Premier rating is not a stress ball.' });
      }
    });
  }

  // ============================================================
  // SCREEN 5 — Inventory render
  // ============================================================
  const inventoryItems = [
    { name: 'Case of Hope',         rarity: 'gold',   icon: 'CASE',   tooltip: 'Still not gloves.' },
    { name: 'Blue Rank Rifle',      rarity: 'blue',   icon: 'AK',     tooltip: 'Respectable. Hands still default.' },
    { name: 'NAVI Faith Sticker',   rarity: 'purple', icon: 'STKR',   tooltip: 'Hope remains a lifestyle.' },
    { name: 'Budget Flex Pistol',   rarity: 'pink',   icon: 'GLOCK',  tooltip: 'Nice attempt at looking dangerous.' },
    { name: 'Service Medal 2024',   rarity: 'gold',   icon: 'MEDAL',  tooltip: 'Inventory value acceptable. Hand drip unacceptable.' },
    { name: 'AWP Side Quest',       rarity: 'purple', icon: 'AWP',    tooltip: 'This could have been gloves. Just saying.' },
    { name: 'Knife Hopes',          rarity: 'pink',   icon: 'KNIFE',  tooltip: 'Brother dreams big. Hands stay default.' },
    { name: 'Sticker: SEO Aura',    rarity: 'blue',   icon: 'STKR',   tooltip: 'Cosmetic SEO. Not enough.' },
    { name: 'Charm: Lucky Tag',     rarity: 'blue',   icon: 'CHARM',  tooltip: 'Charms exist. Glove slot does not care.' },
    { name: 'Souvenir AK',          rarity: 'gold',   icon: 'AK',     tooltip: 'Page 1 has skins. Page 2 has skins. Hand slot has sadness.' },
    { name: 'Pin: Pro League',      rarity: 'purple', icon: 'PIN',    tooltip: 'Pin attached. Hands not.' },
    { name: 'Cheap M4',             rarity: 'blue',   icon: 'M4',     tooltip: 'Solid pickup. Hands remain underdressed.' },
    { name: 'Empty Hand Slot',      rarity: 'red',    icon: 'NONE',   tooltip: 'This is the whole reason we are here.', missing: true },
  ];

  let inventoryRendered = false;
  function renderInventory() {
    if (inventoryRendered) return;
    inventoryRendered = true;
    const grid = $('#inventory-grid');
    grid.innerHTML = '';
    inventoryItems.forEach((it) => {
      const card = document.createElement('div');
      card.className = `inv-item r-${it.rarity}${it.missing ? ' missing' : ''}`;
      card.setAttribute('role', 'listitem');
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="inv-rarity">${it.rarity.toUpperCase()}</div>
        <div class="inv-icon">${it.icon}</div>
        <div class="inv-name">${it.name}</div>
        <div class="inv-tooltip">${it.tooltip}</div>
      `;
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

  // ============================================================
  // SCREEN 6 — Drip meter animation
  // ============================================================
  let dripAnimated = false;
  async function animateDrip() {
    if (dripAnimated) return;
    dripAnimated = true;
    const fill = $('#drip-fill');
    const pct = $('#drip-percent');
    const stateEl = $('#drip-state');

    // step 1: rise to 72
    let v = 0;
    const steps = [
      { to: 72, ms: 1100, label: 'Baseline scan complete' },
      { to: 80, ms: 600,  label: 'Fandom bonus applied' },
      { to: 87, ms: 500,  label: 'NAVI faith confirmed' },
      { to: 97, ms: 500,  label: 'SEO aura measured' },
      { to: 102, ms: 400, label: 'Blue rank honesty: full' },
      { to: 60, ms: 1400, label: 'No gloves penalty — recalibrating…' },
    ];
    for (const s of steps) {
      stateEl.textContent = s.label;
      const start = v, end = s.to, dur = s.ms;
      const t0 = performance.now();
      await new Promise((resolve) => {
        function tick(now) {
          const k = clamp((now - t0) / dur, 0, 1);
          const eased = 1 - Math.pow(1 - k, 3);
          const cur = start + (end - start) * eased;
          fill.style.width = `${clamp(cur, 0, 100)}%`;
          pct.textContent = `${Math.round(cur)}%`;
          if (k < 1) requestAnimationFrame(tick);
          else { v = end; resolve(); }
        }
        requestAnimationFrame(tick);
      });
      if (s.to < 100) sfx.hit(); else sfx.confirm();
    }
    stateEl.textContent = 'Pre-legendary state';
    sfx.error();
  }

  // ============================================================
  // SCREEN 7 — Boss fight
  // ============================================================
  const bossLines = [
    "“You don't need gloves.”",
    "“Default hands build character.”",
    "“Blue rank doesn't deserve gloves.”",
    "“Spend on utility, not cosmetics.”",
    "“You have skins. Isn't that enough?”",
    "“Imagine flexing in matchmaking.”",
    "“Your wallet thanks me.”",
    "“Defaults are a personality.”",
  ];
  const critLines = {
    'Inspect Inventory':  "It's empty. We checked. Twice.",
    'Apply Style':        'Style applied. Drip rises.',
    'Increase Drip':      "+12 drip. Boss visibly shaken.",
    'Support NAVI':       'Belief restored. HP shaken.',
    'Trust the Process':  'Process trusted. Boss confused.',
    'Equip Respect':      'Respect equipped. Boss vaporized.',
  };

  function resetBoss() {
    state.bossHp = 100;
    $('#hp-fill').style.width = '100%';
    $('#hp-percent').textContent = '100';
    $('#boss-line').textContent = pick(bossLines);
    $('#finisher').classList.add('hidden');
    $('#btn-after-boss').classList.add('hidden');
    $('#combat-log').innerHTML = '';
    $$('.attack', $('#attack-grid')).forEach((b) => b.classList.remove('used'));
  }

  function logCombat(text, crit = false) {
    const li = document.createElement('li');
    li.textContent = text;
    if (crit) li.classList.add('crit');
    $('#combat-log').prepend(li);
  }

  function wireBoss() {
    $$('.attack', $('#attack-grid')).forEach((btn) => {
      btn.addEventListener('click', () => attack(btn));
    });
    $('#finisher').addEventListener('click', () => finisher());
  }

  function attack(btn) {
    if (state.bossHp <= 0) return;
    const dmg = randInt(12, 22);
    state.bossHp = clamp(state.bossHp - dmg, 0, 100);
    const stage = $('#boss-stage');
    stage.classList.remove('shake');
    void stage.offsetWidth;
    stage.classList.add('shake');
    $('#hp-fill').style.width = `${state.bossHp}%`;
    $('#hp-percent').textContent = state.bossHp.toString();
    $('#boss-line').textContent = pick(bossLines);
    const label = btn.dataset.attack;
    logCombat(`${label} — ${dmg} dmg`);
    sfx.hit();
    btn.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-2px)' }, { transform: 'translateY(0)' }],
      { duration: 220, easing: 'ease-out' }
    );

    if (state.bossHp <= 20 && !state.achievements.has('Finisher Ready')) {
      $('#finisher').classList.remove('hidden');
      achievement('Finisher Ready', 'EQUIP RESPECT unlocked.');
    }
    if (state.bossHp === 0) defeatBoss();
  }

  function finisher() {
    state.bossHp = 0;
    $('#hp-fill').style.width = '0%';
    $('#hp-percent').textContent = '0';
    $('#boss-line').textContent = '“…ok fine. gloves it is.”';
    logCombat(`Equip Respect — fatal`, true);
    sfx.crit();
    const stage = $('#boss-stage');
    stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake');
    defeatBoss();
  }

  function defeatBoss() {
    $('#finisher').classList.add('hidden');
    $('#btn-after-boss').classList.remove('hidden');
    achievement('Default Hands Defeated', 'Hand slot is ready for upgrade.');
    sfx.win();
  }

  // ============================================================
  // SCREEN 8 — Loot reveal
  // ============================================================
  const lootPool = [
    { name: 'Confidence',         rarity: 'blue',   final: false },
    { name: 'Clean Sitemap',      rarity: 'blue',   final: false },
    { name: 'Matchmaking Spirit', rarity: 'purple', final: false },
    { name: 'Perfect Redirect',   rarity: 'purple', final: false },
    { name: 'Football Loyalty',   rarity: 'pink',   final: false },
    { name: 'NAVI Faith',         rarity: 'pink',   final: false },
    { name: 'SEO Aura',           rarity: 'gold',   final: false },
    { name: 'Gaming Gloves',      rarity: 'gold',   final: true  },
  ];

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

    // Build long sequence ending on gloves
    const sequence = [];
    const targetCount = 48;
    while (sequence.length < targetCount - 1) {
      const it = pick(lootPool.filter((x) => !x.final));
      sequence.push(it);
    }
    const gloves = lootPool.find((x) => x.final);
    sequence.push(gloves);
    const finalIndex = sequence.length - 1;

    track.innerHTML = '';
    sequence.forEach((it) => {
      const el = document.createElement('div');
      el.className = `loot-item r-${it.rarity}`;
      el.innerHTML = `<div class="lr">${it.rarity.toUpperCase()}</div><div class="ln">${it.name}</div>`;
      track.appendChild(el);
    });

    // Compute target offset so the final item lands under the marker
    await sleep(50);
    const itemW = 152; // 140 + 12 gap
    const rollerW = roller.getBoundingClientRect().width;
    const markerX = rollerW / 2;
    const finalCenter = finalIndex * itemW + (140 / 2) + 12;
    const targetX = finalCenter - markerX + rand(-30, 30); // small jitter so it's not perfectly centered first

    track.style.transition = 'transform 4500ms cubic-bezier(0.12, 0.6, 0.05, 1)';
    track.style.transform = `translateX(${-targetX}px)`;

    // tick sounds during roll
    const t0 = performance.now();
    let last = 0;
    function tick() {
      const dt = performance.now() - t0;
      const k = clamp(dt / 4500, 0, 1);
      const rate = (1 - k) * 16 + 4; // ticks ramp from fast to slow
      if (dt - last > 1000 / rate) { sfx.click(); last = dt; }
      if (k < 1) requestAnimationFrame(tick);
    }
    tick();

    await sleep(4600);
    // Snap to perfectly centered
    const snapX = finalCenter - markerX;
    track.style.transition = 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)';
    track.style.transform = `translateX(${-snapX}px)`;

    sfx.reveal();
    await sleep(500);

    // Reveal final
    $('#loot-final').classList.remove('hidden');
    achievement('Legendary Gloves', 'Hand slot enhancement unlocked.');
    fireConfetti();
  }

  // ---------- Confetti (vanilla canvas) ----------
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
    const N = 180;
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
      if (alive > 0 && now - start < 7000) requestAnimationFrame(frame);
      else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        confettiRunning = false;
      }
    }
    requestAnimationFrame(frame);
  }

  // ============================================================
  // SCREEN 9 — Mission complete (copy + download)
  // ============================================================
  const SHARE_TEXT =
`I survived the DMarket Birthday Upgrade Arc, defeated Default Hands, and unlocked Legendary Gloves. Blue-rank drip will never be the same.

— Artem Upgrade Arc · happy birthday from the inventory team`;

  function wireComplete() {
    $('#btn-copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(SHARE_TEXT);
        toast({ title: 'Copied to clipboard', body: 'Paste anywhere with hands.' });
        sfx.confirm();
      } catch (e) {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = SHARE_TEXT;
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
      state.fanChecks = { arsenal: false, barcelona: false, navi: false };
      state.bossHp = 100;
      state.rankBadgeClicks = 0;
      state.fandomClickCounts = { arsenal: 0, barcelona: 0, navi: 0 };
      $$('.fandom-card').forEach((c) => { c.classList.remove('flipped'); c.setAttribute('aria-pressed', 'false'); });
      $('#fandom-verdict').classList.add('hidden');
      $('#btn-after-fandom').disabled = true;
      updateFandomProgress();
      goToScreen('boot');
      const out = $('#terminal-output');
      out.innerHTML = '';
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

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0c1224');
    bg.addColorStop(1, '#06090f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
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
    ctx.fillText('DMARKET · BIRTHDAY UPGRADE SYSTEM', 80, 110);

    // Title
    ctx.font = '800 84px Inter, "Segoe UI", sans-serif';
    ctx.fillStyle = '#eef3ff';
    ctx.fillText('MISSION COMPLETE', 80, 220);

    const titleGrad = ctx.createLinearGradient(80, 240, 80 + 700, 240);
    titleGrad.addColorStop(0, '#f5c451'); titleGrad.addColorStop(1, '#ffd97a');
    ctx.fillStyle = titleGrad;
    ctx.font = '800 60px Inter, "Segoe UI", sans-serif';
    ctx.fillText('ARTEM UPGRADE ARC', 80, 300);

    ctx.fillStyle = '#8f9bb3';
    ctx.font = '400 26px "SFMono-Regular", Consolas, monospace';
    ctx.fillText('// hand slot — upgraded · status — legendary', 80, 340);

    // Stats panel
    const px = 80, py = 400, pw = W - 160, ph = 720;
    roundRect(ctx, px, py, pw, ph, 28);
    ctx.fillStyle = 'rgba(20,27,45,0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const items = [
      ['Football loyalty', 'CONFIRMED'],
      ['NAVI faith', 'INTACT'],
      ['CS2 grind', 'RESPECTABLE'],
      ['Inventory roast', 'SURVIVED'],
      ['Default Hands', 'ELIMINATED'],
      ['Legendary item', 'GLOVES'],
    ];
    items.forEach((row, i) => {
      const y = py + 60 + i * 80;
      ctx.fillStyle = '#cfd6ea';
      ctx.font = '500 26px Inter, "Segoe UI", sans-serif';
      ctx.fillText(row[0], px + 36, y);
      ctx.fillStyle = '#5cff9d';
      ctx.font = '700 26px "SFMono-Regular", Consolas, monospace';
      const valW = ctx.measureText(row[1]).width;
      ctx.fillText(row[1], px + pw - 36 - valW, y);
      // divider
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(px + 36, y + 20);
      ctx.lineTo(px + pw - 36, y + 20);
      ctx.stroke();
    });

    // Message block
    ctx.fillStyle = '#eef3ff';
    ctx.font = '700 36px Inter, "Segoe UI", sans-serif';
    ctx.fillText('З Днем Народження, Артем!', 80, 1230);

    ctx.fillStyle = '#cfd6ea';
    ctx.font = '400 26px Inter, "Segoe UI", sans-serif';
    ctx.fillText('You are officially ranked #1 in birthday search results.', 80, 1280);
    ctx.fillText('The inventory is finally complete.', 80, 1320);

    // Footer
    ctx.fillStyle = '#5a6480';
    ctx.font = '400 22px "SFMono-Regular", Consolas, monospace';
    ctx.fillText('built with default hands · for the man who finally gets gloves', 80, H - 60);

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'artem-upgrade-arc-result.png';
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
      // Brief golden screen flash
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
    wireFandom();
    wireCs2();
    wireBoss();
    wireLoot();
    wireComplete();
    // Greet via console
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
