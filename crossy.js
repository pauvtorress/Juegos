/* Wii Game Center — Cruza la Carretera (estilo Crossy Road) */
window.CrossyGame = (() => {
  'use strict';
  const W = 440, H = 560, CELL = 40, COLS = 11;
  const $ = (s) => document.querySelector(s);

  let cv = null, ctx = null, raf = null, running = false;
  let rows = [], player = null, camY = 0;
  let maxRow = 0, score = 0, best = 0, dead = false, deathCause = '';
  let miiImg = null, miiIndex = 0;

  try { best = parseInt(localStorage.getItem('wgc-crossy-best') || '0', 10) || 0; } catch (e) {}

  function readMii() {
    let index = 0, name = 'Invitado';
    try {
      const p = JSON.parse(localStorage.getItem('wgc-mii') || 'null');
      if (p && Number.isInteger(p.index)) index = p.index;
      const input = document.querySelector('#mii-name');
      const n = (input && input.value.trim()) || (p && p.name) || '';
      if (n) name = n;
    } catch (e) {}
    return { index, name };
  }
  function loadMiiFace() {
    const m = readMii();
    miiIndex = m.index;
    if (!miiImg) {
      miiImg = new Image();
      miiImg.src = 'Monitos.jpg';
    }
  }

  const CAR_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#a855f7', '#ec4899', '#f8fafc'];

  function genRow(i) {
    if (i <= 1) return { type: 'grass' };
    const p1 = rows[i - 1], p2 = rows[i - 2];
    const r = Math.random();
    let type = r < 0.4 ? 'grass' : r < 0.64 ? 'road' : r < 0.86 ? 'river' : 'rail';
    if (p1 && p2 && p1.type === type && p2.type === type && type !== 'grass') type = 'grass';
    const dir = Math.random() < 0.5 ? -1 : 1;
    if (type === 'road') {
      const speed = 50 + Math.random() * 100;
      const n = 2 + Math.floor(Math.random() * 3);
      const cars = [];
      for (let k = 0; k < n; k++) {
        cars.push({
          x: Math.random() * W,
          w: 36 + Math.random() * 34,
          color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
        });
      }
      return { type, dir, speed, cars };
    }
    if (type === 'river') {
      const speed = 30 + Math.random() * 55;
      const n = 2 + Math.floor(Math.random() * 2);
      const logs = [];
      for (let k = 0; k < n; k++) {
        logs.push({ x: Math.random() * W, w: 80 + Math.random() * 70 });
      }
      return { type, dir, speed, logs };
    }
    if (type === 'rail') {
      const period = 2.2 + Math.random() * 2.6;
      return { type, dir, period, t: Math.random() * period, trainX: -300 };
    }
    return { type };
  }
  function ensure(i) {
    while (rows.length <= i) rows.push(genRow(rows.length));
  }

  function reset() {
    rows = [];
    ensure(20);
    player = { col: 5, row: 0, px: 5 * CELL + CELL / 2, py: CELL / 2, hopping: false, hopT: 0, fx: 0, fy: 0, tx: 0, ty: 0, ride: null };
    camY = -H + CELL * 4;
    maxRow = 0; score = 0; dead = false; deathCause = '';
    loadMiiFace();
    $('#crossy-score').textContent = '0';
    $('#crossy-best').textContent = best;
  }

  function move(dx, dy) {
    if (!running || dead || !player || player.hopping) return;
    const nc = Math.max(0, Math.min(COLS - 1, player.col + dx));
    const nr = Math.max(0, player.row + dy);
    ensure(nr + 16);
    player.col = nc; player.row = nr;
    player.fx = player.px; player.fy = player.py;
    player.tx = nc * CELL + CELL / 2; player.ty = nr * CELL + CELL / 2;
    player.hopping = true; player.hopT = 0; player.ride = null;
  }

  function die(cause) {
    if (dead) return;
    dead = true; running = false;
    deathCause = cause;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (score > best) {
      best = score;
      $('#crossy-best').textContent = best;
      try { localStorage.setItem('wgc-crossy-best', String(best)); } catch (e) {}
    }
    const m = readMii();
    $('#crossy-overlay-text').textContent = cause + ' · ' + m.name + ' · ' + score + ' pts. Pulsa Reiniciar.';
    $('#crossy-overlay').classList.remove('hidden');
  }

  function update(dt) {
    // obstáculos
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      if (row.type === 'road') {
        for (const c of row.cars) {
          c.x += row.dir * row.speed * dt;
          if (row.dir > 0 && c.x > W + 10) c.x = -c.w - 10;
          if (row.dir < 0 && c.x + c.w < -10) c.x = W + 10;
        }
      } else if (row.type === 'river') {
        for (const l of row.logs) {
          l.x += row.dir * row.speed * dt;
          if (row.dir > 0 && l.x > W + 10) l.x = -l.w - 10;
          if (row.dir < 0 && l.x + l.w < -10) l.x = W + 10;
        }
      } else if (row.type === 'rail') {
        row.t += dt;
        const cycle = row.period + 1.2 + 0.6;
        if (row.t > cycle) row.t -= cycle;
        if (row.t > row.period + 1.2) {
          const p = (row.t - row.period - 1.2) / 0.6;
          row.trainX = row.dir > 0 ? -180 + p * (W + 360) : W + 180 - p * (W + 360);
        }
      }
    }
    // salto
    if (player.hopping) {
      player.hopT += dt / 0.12;
      const k = Math.min(1, player.hopT);
      player.px = player.fx + (player.tx - player.fx) * k;
      player.py = player.fy + (player.ty - player.fy) * k;
      if (k >= 1) {
        player.hopping = false;
        if (player.row > maxRow) {
          maxRow = player.row;
          score = maxRow;
          $('#crossy-score').textContent = score;
        }
      }
    }
    // cámara (solo sube)
    const targetCam = player.py - H * 0.6;
    if (targetCam > camY) camY = targetCam;

    if (!player.hopping && !dead) {
      const row = rows[player.row];
      if (row.type === 'road') {
        for (const c of row.cars) {
          if (player.px + 12 > c.x && player.px - 12 < c.x + c.w) { die('¡Atropellado!'); return; }
        }
      } else if (row.type === 'river') {
        let onLog = null;
        for (const l of row.logs) {
          if (player.px > l.x - 8 && player.px < l.x + l.w + 8) { onLog = l; break; }
        }
        if (!onLog) { die('¡Al agua!'); return; }
        player.px += row.dir * row.speed * dt;
        if (player.px < -10 || player.px > W + 10) { die('¡Arrastrado por el río!'); return; }
        player.col = Math.max(0, Math.min(COLS - 1, Math.floor(player.px / CELL)));
      } else if (row.type === 'rail') {
        if (row.t > row.period + 1.2 && Math.abs(row.trainX - player.px) < 105) { die('¡El tren!'); return; }
      }
    }
  }

  function hash(n) { let x = (n * 2654435761) % 1000; return x / 1000; }

  function screenY(worldY) { return H - (worldY - camY); }

  function draw() {
    ctx.fillStyle = '#7cc74a';
    ctx.fillRect(0, 0, W, H);
    const first = Math.max(0, Math.floor(camY / CELL) - 1);
    const last = Math.ceil((camY + H) / CELL) + 1;
    for (let ri = first; ri <= last; ri++) {
      ensure(ri);
      const row = rows[ri];
      const sy = screenY((ri + 1) * CELL);
      if (row.type === 'grass') {
        ctx.fillStyle = ri % 2 ? '#8bd450' : '#83cc49';
        ctx.fillRect(0, sy, W, CELL + 1);
        if (hash(ri) > 0.6) {
          ctx.fillStyle = '#fff';
          const fx = hash(ri * 7 + 1) * W, fy = sy + 8 + hash(ri * 13) * 24;
          ctx.beginPath(); ctx.arc(fx, fy, 2.5, 0, 7); ctx.fill();
          ctx.fillStyle = '#fde047';
          ctx.beginPath(); ctx.arc(fx, fy, 1.2, 0, 7); ctx.fill();
        }
      } else if (row.type === 'road') {
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(0, sy, W, CELL + 1);
        ctx.fillStyle = '#fbbf24';
        for (let x = 0; x < W; x += 44) ctx.fillRect(x + 8, sy + 18, 22, 4);
        for (const c of row.cars) drawCar(c.x, sy, c.w, c.color);
      } else if (row.type === 'river') {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(0, sy, W, CELL + 1);
        ctx.strokeStyle = 'rgba(255,255,255,.5)';
        ctx.lineWidth = 2;
        for (let x = 0; x < W; x += 56) {
          const off = (ri * 37 + x) % 20;
          ctx.beginPath(); ctx.arc(x + off, sy + 12, 7, 0.2, Math.PI - 0.2); ctx.stroke();
          ctx.beginPath(); ctx.arc(x + 28 + off, sy + 28, 7, 0.2, Math.PI - 0.2); ctx.stroke();
        }
        for (const l of row.logs) {
          ctx.fillStyle = '#92400e';
          ctx.beginPath(); ctx.roundRect(l.x, sy + 5, l.w, CELL - 10, 9); ctx.fill();
          ctx.fillStyle = '#b45309';
          ctx.fillRect(l.x + 6, sy + 12, l.w - 12, 5);
        }
      } else if (row.type === 'rail') {
        ctx.fillStyle = ri % 2 ? '#8bd450' : '#83cc49';
        ctx.fillRect(0, sy, W, CELL + 1);
        ctx.fillStyle = '#78350f';
        for (let x = 4; x < W; x += 26) ctx.fillRect(x, sy + 4, 10, CELL - 8);
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(0, sy + 9, W, 5);
        ctx.fillRect(0, sy + CELL - 14, W, 5);
        const danger = row.t > row.period;
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(6, sy - 14, 8, 22);
        ctx.fillStyle = danger && Math.floor(performance.now() / 200) % 2 === 0 ? '#ef4444' : '#7f1d1d';
        ctx.beginPath(); ctx.arc(10, sy - 16, 6, 0, 7); ctx.fill();
        if (row.t > row.period + 1.2) drawTrain(row.trainX, sy);
      }
    }
    drawPlayer();
  }

  function drawCar(x, sy, w, color) {
    const y = sy + 3;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + 32, w / 2, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.beginPath(); ctx.arc(x + 10, y + 29, 6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w - 10, y + 29, 6, 0, 7); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x, y + 6, w, 24, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.beginPath(); ctx.roundRect(x + w * 0.18, y + 10, w * 0.28, 12, 3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x + w * 0.54, y + 10, w * 0.28, 12, 3); ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(x + w - 3, y + 12, 3, 6);
  }

  function drawTrain(x, sy) {
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.roundRect(x - 95, sy - 2, 190, CELL + 4, 6); ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x - 95, sy - 2, 190, 8);
    ctx.fillStyle = '#fde68a';
    for (let wx = x - 80; wx < x + 80; wx += 30) ctx.fillRect(wx, sy + 10, 20, 14);
  }

  function drawPlayer() {
    const cx = player.px;
    const cy = screenY(player.py);
    const lift = player.hopping ? Math.sin(Math.min(1, player.hopT) * Math.PI) * 12 : 0;
    const S = 30, top = cy - S / 2 - lift;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 15, 14, 5, 0, 0, 7); ctx.fill();
    // cara frontal = Mii
    if (miiImg && miiImg.complete && miiImg.naturalWidth) {
      const iw = miiImg.naturalWidth / 6, ih = miiImg.naturalHeight / 3;
      ctx.drawImage(miiImg, (miiIndex % 6) * iw, Math.floor(miiIndex / 6) * ih, iw, ih, cx - S / 2, top, S, S);
    } else {
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(cx - S / 2, top, S, S);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(cx - 8, top + 10, 5, 5);
      ctx.fillRect(cx + 3, top + 10, 5, 5);
    }
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - S / 2, top, S, S);
    // tapa superior (efecto cubo)
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath();
    ctx.moveTo(cx - S / 2, top); ctx.lineTo(cx - S / 2 + 8, top - 8);
    ctx.lineTo(cx + S / 2 + 8, top - 8); ctx.lineTo(cx + S / 2, top);
    ctx.closePath(); ctx.fill();
    // lateral
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath();
    ctx.moveTo(cx + S / 2, top); ctx.lineTo(cx + S / 2 + 8, top - 8);
    ctx.lineTo(cx + S / 2 + 8, top + S - 8); ctx.lineTo(cx + S / 2, top + S);
    ctx.closePath(); ctx.fill();
  }

  let last = 0;
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    update(dt);
    draw();
    if (running) raf = requestAnimationFrame(loop);
  }

  function bind() {
    if (cv) return;
    cv = $('#crossy-canvas');
    ctx = cv.getContext('2d');
    $('#crossy-start').addEventListener('click', (e) => { api.start(); e.currentTarget.blur(); });
    $('#crossy-dpad').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      // dy: +1 = adelante (arriba en pantalla)
      api.move(parseInt(b.dataset.dx, 10), parseInt(b.dataset.dy, 10));
      b.blur();
    });
    let sx = 0, sy = 0;
    cv.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) api.move(Math.sign(dx), 0);
      else api.move(0, Math.sign(-dy));
      sx = t.clientX; sy = t.clientY;
    }, { passive: false });
  }

  const api = {
    start() {
      bind();
      reset();
      $('#crossy-overlay').classList.add('hidden');
      running = true;
      cancelAnimationFrame(raf);
      last = performance.now();
      draw();
      raf = requestAnimationFrame(loop);
    },
    stopAll() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    },
    move(dx, dy) { bind(); move(dx, dy); },
  };
  // pintar tablero inicial aunque no se haya iniciado
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bind(); reset(); draw(); });
  } else { bind(); reset(); draw(); }
  return api;
})();

/* Previsualización animada para la tarjeta del menú (sin estado) */
window.drawPrevCrossy = function (t) {
  const c = document.getElementById('prev-crossy');
  if (!c) return;
  const g = c.getContext('2d');
  const W = 220, H = 130;
  g.fillStyle = '#83cc49';
  g.fillRect(0, 0, W, H);
  const lanes = [18, 56, 94];
  lanes.forEach((y, li) => {
    g.fillStyle = '#4b5563';
    g.fillRect(0, y, W, 26);
    g.fillStyle = '#fbbf24';
    for (let x = 0; x < W; x += 28) g.fillRect(x, y + 11, 14, 3);
    const sp = (0.03 + li * 0.02) * (li % 2 ? 1 : -1);
    for (let k = 0; k < 3; k++) {
      let x = ((t * sp + k * 90) % (W + 60) + W + 60) % (W + 60) - 30;
      g.fillStyle = ['#ef4444', '#3b82f6', '#f59e0b'][k];
      g.beginPath(); g.roundRect(x, y + 3, 34, 20, 5); g.fill();
    }
  });
  // cubo saltando entre carriles
  const hop = Math.abs(Math.sin(t / 450));
  const px = 150, py = 112 - hop * 46;
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.beginPath(); g.ellipse(px, 116, 12, 4, 0, 0, 7); g.fill();
  g.fillStyle = '#fb923c';
  g.fillRect(px - 11, py - 11, 22, 22);
  g.fillStyle = '#1f2937';
  g.fillRect(px - 6, py - 5, 4, 4);
  g.fillRect(px + 2, py - 5, 4, 4);
};
