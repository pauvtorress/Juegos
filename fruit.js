/* Wii Game Center — Fruit Ninja */
window.FruitGame = (() => {
  'use strict';
  const W = 640, H = 480, G = 1500;
  const $ = (s) => document.querySelector(s);

  const FRUITS = [
    { name: 'sandía', outer: '#22c55e', inner: '#f87171' },
    { name: 'naranja', outer: '#fb923c', inner: '#fed7aa' },
    { name: 'manzana', outer: '#ef4444', inner: '#fecaca' },
    { name: 'limón', outer: '#facc15', inner: '#fef9c3' },
    { name: 'uva', outer: '#a855f7', inner: '#e9d5ff' },
    { name: 'coco', outer: '#92400e', inner: '#fef3c7' },
  ];

  let cv = null, ctx = null, raf = null;
  let state = 'idle'; // idle | playing | over
  let fruits = [], halves = [], parts = [], floaters = [];
  let trail = [];
  let score = 0, lives = 3, best = 0, elapsed = 0, spawnT = 0;
  let burst = { n: 0, exp: 0 };
  let flash = 0, mode = 'clasico', muted = false, ac = null;

  try { best = parseInt(localStorage.getItem('wgc-fruit-best') || '0', 10) || 0; } catch (e) {}

  function readName() {
    try {
      const input = document.querySelector('#mii-name');
      if (input && input.value.trim()) return input.value.trim();
      const p = JSON.parse(localStorage.getItem('wgc-mii') || 'null');
      if (p && p.name) return p.name;
    } catch (e) {}
    return 'Invitado';
  }

  /* ---------- sonido (WebAudio, opcional) ---------- */
  function ensureAudio() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
  }
  function tone(f0, f1, dur, type, vol) {
    if (muted || !ac) return;
    try {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'triangle';
      o.frequency.setValueAtTime(f0, ac.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), ac.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.15, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(); o.stop(ac.currentTime + dur);
    } catch (e) {}
  }
  const sfx = {
    slice(n) { tone(480 + n * 70, 900 + n * 60, 0.09, 'triangle', 0.16); },
    combo(n) { tone(600, 900, 0.1, 'square', 0.1); setTimeout(() => tone(800, 1200, 0.12, 'square', 0.1), 90); },
    bomb() { tone(220, 40, 0.5, 'sawtooth', 0.25); },
    miss() { tone(300, 150, 0.2, 'sine', 0.15); },
    over() { tone(500, 120, 0.7, 'triangle', 0.18); },
  };

  /* ---------- entidades ---------- */
  function spawnOne() {
    const bombP = Math.min(0.3, 0.14 + elapsed * 0.004);
    const isBomb = Math.random() < bombP;
    const x = 60 + Math.random() * (W - 120);
    fruits.push({
      bomb: isBomb,
      f: FRUITS[Math.floor(Math.random() * FRUITS.length)],
      x, y: H + 40,
      vx: (W / 2 - x) * (0.3 + Math.random() * 0.4),
      vy: -(640 + Math.random() * 260 + Math.min(260, elapsed * 6)),
      r: isBomb ? 26 : 26 + Math.random() * 9,
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 8,
      sliced: false,
    });
  }

  function doSlice(f) {
    f.sliced = true;
    fruits = fruits.filter((o) => o !== f);
    burst.n++;
    burst.exp = performance.now() + 600;
    // mitades
    for (const s of [-1, 1]) {
      halves.push({
        x: f.x, y: f.y, side: s,
        vx: f.vx * 0.35 + s * (90 + Math.random() * 90),
        vy: f.vy * 0.25 - 140,
        rot: f.rot, vr: s * (3 + Math.random() * 4),
        life: 1.3, max: 1.3, r: f.r,
        outer: f.bomb ? '#1f2937' : f.f.outer,
        inner: f.bomb ? '#4b5563' : f.f.inner,
      });
    }
    // jugo / partículas
    const pc = f.bomb ? '#f97316' : f.f.inner;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 320;
      parts.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 0.7, max: 0.7, r: 2 + Math.random() * 4, color: pc });
    }
    if (f.bomb) { bombHit(); return; }
    score += 10;
    sfx.slice(burst.n);
    paintHUD();
  }

  function bombHit() {
    flash = 1;
    sfx.bomb();
    if (mode === 'clasico') {
      gameOver('¡Bomba! Explotaste en pedazos');
    } else {
      lives--;
      addFloater(W / 2, H / 2, '¡Bomba! -1 vida', '#f87171');
      paintHUD();
      if (lives <= 0) gameOver('Las bombas acabaron contigo');
    }
  }

  function miss(f) {
    fruits = fruits.filter((o) => o !== f);
    lives--;
    sfx.miss();
    addFloater(f.x, H - 60, '¡Se escapó! -1 vida', '#f87171');
    paintHUD();
    if (lives <= 0) gameOver('Se te escaparon las frutas');
  }

  function addFloater(x, y, text, color) {
    floaters.push({ x: Math.max(90, Math.min(W - 90, x)), y, text, color: color || '#fff', life: 1.2, max: 1.2 });
  }

  function gameOver(reason) {
    if (state !== 'playing') return;
    state = 'over';
    sfx.over();
    if (score > best) {
      best = score;
      try { localStorage.setItem('wgc-fruit-best', String(best)); } catch (e) {}
    }
    paintHUD();
    $('#fruit-overlay-text').textContent = reason + ' · ' + readName() + ' · ' + score + ' pts. Pulsa Reiniciar.';
    $('#fruit-overlay').classList.remove('hidden');
  }

  /* ---------- update / draw ---------- */
  function update(dt) {
    elapsed += dt;
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnOne();
      if (Math.random() < Math.min(0.35, elapsed * 0.006)) spawnOne();
      spawnT = Math.max(0.42, 0.95 - elapsed * 0.009) * (0.7 + Math.random() * 0.6);
    }
    const now = performance.now();
    if (burst.n > 0 && now > burst.exp) {
      if (burst.n >= 3) {
        const bonus = burst.n * 15;
        score += bonus;
        addFloater(W / 2, H / 2 - 40, '¡Combo x' + burst.n + '! +' + bonus, '#fde047');
        sfx.combo(burst.n);
        paintHUD();
      }
      burst.n = 0;
    }
    for (const f of fruits.slice()) {
      f.vy += G * dt;
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.rot += f.vr * dt;
      if (f.y > H + 50) { if (!f.bomb) miss(f); else fruits = fruits.filter((o) => o !== f); }
    }
    for (const h of halves.slice()) {
      h.vy += G * dt;
      h.x += h.vx * dt; h.y += h.vy * dt;
      h.rot += h.vr * dt; h.life -= dt;
      if (h.life <= 0) halves = halves.filter((o) => o !== h);
    }
    for (const p of parts.slice()) {
      p.vy += 900 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) parts = parts.filter((o) => o !== p);
    }
    for (const fl of floaters.slice()) {
      fl.y -= 40 * dt; fl.life -= dt;
      if (fl.life <= 0) floaters = floaters.filter((o) => o !== fl);
    }
    trail = trail.filter((p) => now - p.t < 130);
    if (flash > 0) flash = Math.max(0, flash - dt * 2);
  }

  function drawFruitBody(f) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot * 0.15);
    if (f.bomb) {
      ctx.fillStyle = '#111827';
      ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.ellipse(-8, -9, 7, 5, -0.6, 0, 7); ctx.fill();
      ctx.strokeStyle = '#92400e'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(8, -f.r + 4); ctx.quadraticCurveTo(18, -f.r - 8, 24, -f.r - 4); ctx.stroke();
      ctx.fillStyle = Math.floor(performance.now() / 120) % 2 ? '#fde047' : '#f97316';
      ctx.beginPath(); ctx.arc(24, -f.r - 4, 4, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = f.f.outer;
      ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.ellipse(-f.r * 0.35, -f.r * 0.4, f.r * 0.28, f.r * 0.16, -0.6, 0, 7); ctx.fill();
      ctx.strokeStyle = '#65a30d'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, -f.r); ctx.lineTo(6, -f.r - 10); ctx.stroke();
      ctx.fillStyle = '#4ade80';
      ctx.beginPath(); ctx.ellipse(12, -f.r - 8, 8, 4, 0.5, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    // fondo dojo
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.beginPath(); ctx.ellipse(W / 2, H + 60, W * 0.7, 120, 0, 0, 7); ctx.fill();

    for (const f of fruits) drawFruitBody(f);
    // mitades cortadas
    for (const h of halves) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, h.life / h.max);
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.fillStyle = h.outer;
      ctx.beginPath(); ctx.arc(0, 0, h.r, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fill();
      if (h.side > 0) { ctx.rotate(Math.PI); ctx.fillStyle = h.outer; ctx.beginPath(); ctx.arc(0, 0, h.r, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fill(); ctx.rotate(-Math.PI); }
      ctx.fillStyle = h.inner;
      ctx.beginPath(); ctx.arc(0, 0, h.r * 0.7, -Math.PI / 2, Math.PI / 2); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // partículas
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // estela de la espada
    if (trail.length > 1) {
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
      for (let i = 1; i < trail.length; i++) {
        const a = i / trail.length;
        ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.9).toFixed(2) + ')';
        ctx.lineWidth = 1 + a * 9;
        ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
      }
      ctx.restore();
    }
    // textos flotantes
    for (const fl of floaters) {
      ctx.globalAlpha = Math.max(0, fl.life / fl.max);
      ctx.font = '900 26px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.strokeText(fl.text, fl.x, fl.y);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, fl.x, fl.y);
    }
    ctx.globalAlpha = 1;
    if (flash > 0) {
      ctx.fillStyle = 'rgba(239,68,68,' + (flash * 0.35).toFixed(2) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  let last = 0;
  function loop(ts) {
    if (state !== 'playing') return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    update(dt);
    draw();
    if (state === 'playing') raf = requestAnimationFrame(loop);
  }

  /* ---------- corte por deslizamiento ---------- */
  function distSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let k = ((px - x1) * dx + (py - y1) * dy) / l2;
    k = Math.max(0, Math.min(1, k));
    return Math.hypot(px - (x1 + k * dx), py - (y1 + k * dy));
  }
  function toGame(e) {
    const r = cv.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
  }
  function pointerMove(e) {
    if (state !== 'playing') return;
    const p = toGame(e);
    const prev = trail[trail.length - 1];
    trail.push({ x: p.x, y: p.y, t: performance.now() });
    if (prev) {
      if (Math.hypot(p.x - prev.x, p.y - prev.y) < 4) return;
      for (const f of fruits.slice()) {
        if (!f.sliced && distSeg(f.x, f.y, prev.x, prev.y, p.x, p.y) < f.r + 8) doSlice(f);
      }
    }
  }

  function paintHUD() {
    $('#fruit-score').textContent = score;
    $('#fruit-lives').textContent = '❤'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
    $('#fruit-best').textContent = best;
  }

  function bind() {
    if (cv) return;
    cv = $('#fruit-canvas');
    ctx = cv.getContext('2d');
    $('#fruit-start').addEventListener('click', (e) => { api.start(); e.currentTarget.blur(); });
    $('#fruit-mute').addEventListener('click', (e) => {
      muted = !muted;
      e.currentTarget.textContent = muted ? '🔇' : '🔊';
      e.currentTarget.blur();
    });
    cv.addEventListener('mousemove', pointerMove);
    cv.addEventListener('touchstart', (e) => { trail.length = 0; }, { passive: true });
    cv.addEventListener('touchmove', (e) => { e.preventDefault(); pointerMove(e); }, { passive: false });
  }

  const api = {
    start() {
      bind();
      ensureAudio();
      mode = $('#fruit-mode').value;
      fruits = []; halves = []; parts = []; floaters = []; trail = [];
      score = 0; lives = 3; elapsed = 0; spawnT = 0.4;
      burst = { n: 0, exp: 0 }; flash = 0;
      state = 'playing';
      paintHUD();
      $('#fruit-overlay').classList.add('hidden');
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stopAll() {
      state = 'idle';
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    },
    primary() { if (state !== 'playing') api.start(); },
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bind(); paintHUD(); draw(); });
  } else { bind(); paintHUD(); draw(); }
  return api;
})();

/* Previsualización animada para la tarjeta del menú (sin estado) */
window.drawPrevFruit = function (t) {
  const c = document.getElementById('prev-fruit');
  if (!c) return;
  const g = c.getContext('2d');
  const W = 220, H = 130;
  g.fillStyle = '#1e1b4b';
  g.fillRect(0, 0, W, H);
  const cols = ['#22c55e', '#fb923c', '#ef4444'];
  for (let k = 0; k < 3; k++) {
    const s = ((t / 1700) + k * 0.37) % 1;
    const x = 50 + k * 60 + Math.sin(s * 5 + k) * 22;
    const y = 128 - Math.sin(s * Math.PI) * 92;
    g.fillStyle = cols[k];
    g.beginPath(); g.arc(x, y, 13, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.beginPath(); g.ellipse(x - 4, y - 5, 4, 2.5, -0.6, 0, 7); g.fill();
    g.strokeStyle = '#4ade80'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, y - 13); g.lineTo(x + 4, y - 19); g.stroke();
  }
  // tajo de espada
  const sx = (t / 12) % (W + 80) - 40;
  g.save();
  g.strokeStyle = 'rgba(255,255,255,.9)';
  g.lineWidth = 3; g.lineCap = 'round';
  g.shadowColor = '#fff'; g.shadowBlur = 8;
  g.beginPath(); g.moveTo(sx - 40, 110); g.quadraticCurveTo(sx, 60, sx + 40, 30); g.stroke();
  g.restore();
  // gotas
  g.fillStyle = '#f87171';
  for (let i = 0; i < 5; i++) {
    const px = (t * 0.05 + i * 47) % W;
    const py = (t * 0.09 + i * 31) % H;
    g.beginPath(); g.arc(px, py, 2, 0, 7); g.fill();
  }
};
