/* Wii Game Center — SPA + 5 juegos */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* ---------- Reloj ---------- */
  function tickClock() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    $('#clock').textContent = hh + ':' + mm;
    $('#date-label').textContent = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  tickClock(); setInterval(tickClock, 10000);

  /* ---------- Navegación ---------- */
  const views = ['mii', 'home', 'snake', 'tetris', 'gato', 'pong', 'tiempo'];
  function currentRoute() {
    const h = location.hash.replace('#/', '').replace('#', '');
    return views.includes(h) && h !== '' ? h : 'home';
  }
  function showView() {
    let r = currentRoute();
    if (r !== 'mii' && !Mii.hasProfile()) r = 'mii'; // puerta de entrada: elegir Mii primero
    stopAllGames();
    $$('.view').forEach((v) => v.classList.remove('active'));
    const el = $('#view-' + r);
    if (el) el.classList.add('active');
    else $('#view-home').classList.add('active');
    previewsRunning = (r === 'home');
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-goto]');
    if (t) location.hash = t.getAttribute('data-goto');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.activeElement && document.activeElement.hasAttribute('data-goto')) {
      location.hash = document.activeElement.getAttribute('data-goto');
    }
  });
  $('#logo-home').addEventListener('click', () => { location.hash = '#/'; });
  window.addEventListener('hashchange', showView);

  function stopAllGames() {
    Snake.stop(); Tetris.stop(); Pong.stop(); Tiempo.stopAll();
  }

  /* ================= MII (selección de personaje) ================= */
  const Mii = (() => {
    const COUNT = 18, COLS = 6;
    const grid = $('#mii-grid');
    let index = null, name = '';
    try {
      const raw = localStorage.getItem('wgc-mii');
      if (raw) {
        const p = JSON.parse(raw);
        if (Number.isInteger(p.index) && p.index >= 0 && p.index < COUNT) index = p.index;
        if (typeof p.name === 'string') name = p.name;
      }
    } catch (e) {}

    function pos(i) {
      const col = i % COLS, row = Math.floor(i / COLS);
      return (col / (COLS - 1)) * 100 + '% ' + (row / 2) * 100 + '%';
    }
    function paint(el, i) { el.style.backgroundPosition = pos(i); }

    // construir parrilla 18 monitos desde Monitos.jpg (sprite 6x3)
    for (let i = 0; i < COUNT; i++) {
      const d = document.createElement('div');
      d.className = 'mii-cell';
      d.tabIndex = 0;
      d.setAttribute('role', 'button');
      d.setAttribute('aria-label', 'Elegir personaje ' + (i + 1));
      paint(d, i);
      d.dataset.i = i;
      d.addEventListener('click', () => select(i));
      d.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); } });
      grid.appendChild(d);
    }
    const cells = Array.from(grid.children);

    function select(i) {
      index = i;
      cells.forEach((c, k) => c.classList.toggle('selected', k === i));
      paint($('#mii-preview-avatar'), i);
      updateLabel();
      persist();
      refreshChrome();
    }
    function updateLabel() {
      const n = ($('#mii-name').value || '').trim();
      $('#mii-preview-label').textContent = n ? n : 'Sin nombre todavía';
    }
    function persist() {
      try { localStorage.setItem('wgc-mii', JSON.stringify({ index, name: ($('#mii-name').value || '').trim() })); } catch (e) {}
    }
    function refreshChrome() {
      const n = ($('#mii-name').value || '').trim() || name || 'Invitado';
      if (index !== null) paint($('#mii-chip-avatar'), index);
      $('#mii-chip-name').textContent = n;
      $$('.playing-as-name').forEach((el) => (el.textContent = n));
      $$('.playing-as-avatar').forEach((el) => { if (index !== null) paint(el, index); });
      $('#home-greeting').textContent = '¡Hola, ' + n + '! 👋 Cinco retos listos para jugar. Toca una tarjeta para abrir el juego.';
    }
    // estado inicial
    if (name) $('#mii-name').value = name;
    if (index !== null) {
      cells[index].classList.add('selected');
      paint($('#mii-preview-avatar'), index);
    }
    $('#mii-name').addEventListener('input', () => { updateLabel(); persist(); refreshChrome(); });
    updateLabel(); refreshChrome();

    $('#mii-confirm').addEventListener('click', () => {
      if (index === null) {
        $('#mii-preview-label').textContent = '☝️ Elige primero un personaje';
        grid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      persist(); refreshChrome();
      location.hash = '#/';
    });

    return {
      hasProfile: () => index !== null,
      getName: () => (($('#mii-name').value || '').trim() || name || 'Invitado'),
      getIndex: () => index,
      refreshChrome,
    };
  })();

  /* ================= PREVIEWS ================= */
  let previewsRunning = true;

  // Snake preview: serpiente dando vueltas
  const ps = $('#prev-snake').getContext('2d');
  let psT = 0;
  function drawPrevSnake(t) {
    const W = 220, H = 130, c = 13;
    ps.fillStyle = '#0f172a'; ps.fillRect(0, 0, W, H);
    ps.strokeStyle = '#1e293b';
    for (let x = 0; x < W; x += c) { ps.beginPath(); ps.moveTo(x, 0); ps.lineTo(x, H); ps.stroke(); }
    for (let y = 0; y < H; y += c) { ps.beginPath(); ps.moveTo(0, y); ps.lineTo(W, y); ps.stroke(); }
    const step = Math.floor(t / 220);
    const len = 7;
    ps.fillStyle = '#22c55e';
    for (let i = 0; i < len; i++) {
      const px = ((step - i) % 14 + 14) % 14;
      const py = 4 + Math.round(Math.sin((step - i) * 0.7) * 2);
      ps.beginPath(); ps.roundRect(px * c + 1, py * c + 1, c - 2, c - 2, 4); ps.fill();
    }
    if (Math.floor(t / 400) % 2 === 0) {
      ps.fillStyle = '#ef4444';
      ps.beginPath(); ps.arc(17.5 * c, 4.5 * c, 5, 0, 7); ps.fill();
    }
  }

  // Tetris preview: bloques cayendo en loop
  const pt = $('#prev-tetris').getContext('2d');
  const previewBlocks = [
    { c: '#22c55e', x: 2, y: 0, s: [[1, 1], [1, 1]] },
    { c: '#f59e0b', x: 6, y: 0, s: [[1, 1, 1], [0, 1, 0]] },
    { c: '#3b82f6', x: 10, y: 0, s: [[1, 1, 1, 1]] },
    { c: '#ec4899', x: 4, y: 0, s: [[1, 0], [1, 0], [1, 1]] },
  ];
  function drawPrevTetris(t) {
    const W = 220, H = 130, c = 11;
    pt.fillStyle = '#0f172a'; pt.fillRect(0, 0, W, H);
    // base acumulada
    pt.fillStyle = '#8b5cf6';
    for (let i = 0; i < 8; i++) pt.fillRect(i * c + 22, H - c, c - 1, c - 1);
    pt.fillStyle = '#22c55e';
    for (let i = 0; i < 5; i++) pt.fillRect(i * c + 22, H - 2 * c, c - 1, c - 1);
    const b = previewBlocks[Math.floor(t / 1400) % previewBlocks.length];
    const fall = (t % 1400) / 1400;
    const oy = Math.floor(fall * 7);
    b.s.forEach((row, j) => row.forEach((v, k) => {
      if (v) { pt.fillStyle = b.c; pt.fillRect((b.x + k) * c, (oy + j) * c, c - 1, c - 1); }
    }));
  }

  // Pong preview: demo automática
  const pp = $('#prev-pong').getContext('2d');
  function drawPrevPong(t) {
    const W = 220, H = 130;
    pp.fillStyle = '#0f172a'; pp.fillRect(0, 0, W, H);
    pp.strokeStyle = '#334155'; pp.setLineDash([5, 5]);
    pp.beginPath(); pp.moveTo(W / 2, 0); pp.lineTo(W / 2, H); pp.stroke(); pp.setLineDash([]);
    const ly = 20 + Math.sin(t / 500) * 25;
    const ry = 20 + Math.cos(t / 500) * 25;
    pp.fillStyle = '#3b82f6'; pp.fillRect(8, ly, 7, 34);
    pp.fillStyle = '#ef4444'; pp.fillRect(W - 15, ry, 7, 34);
    const bx = W / 2 + Math.sin(t / 350) * 80;
    const by = H / 2 + Math.cos(t / 470) * 40;
    pp.fillStyle = '#fff'; pp.beginPath(); pp.arc(bx, by, 5, 0, 7); pp.fill();
  }

  // Tiempo preview: mini cronómetro animado
  const ptime = $('#prev-tiempo').getContext('2d');
  function drawPrevTiempo(t) {
    const W = 220, H = 130, cx = W / 2, cy = H / 2, R = 42;
    ptime.fillStyle = '#0f172a'; ptime.fillRect(0, 0, W, H);
    ptime.strokeStyle = '#ec4899'; ptime.lineWidth = 6;
    ptime.beginPath(); ptime.arc(cx, cy, R, 0, 7); ptime.stroke();
    ptime.fillStyle = '#334155';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ptime.beginPath(); ptime.arc(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8), 2, 0, 7); ptime.fill();
    }
    const a = (t / 900) % (Math.PI * 2);
    ptime.strokeStyle = '#fff'; ptime.lineWidth = 4; ptime.lineCap = 'round';
    ptime.beginPath(); ptime.moveTo(cx, cy); ptime.lineTo(cx + Math.cos(a - Math.PI / 2) * (R - 14), cy + Math.sin(a - Math.PI / 2) * (R - 14)); ptime.stroke();
    ptime.fillStyle = '#ec4899'; ptime.beginPath(); ptime.arc(cx, cy, 5, 0, 7); ptime.fill();
  }

  // Gato preview: ciclo X/O  const gatoPrevCells = $$('#prev-gato span');
  const gatoSeq = ['X', 'O', 'X', 'O', 'X', 'O', '', '', ''];
  let gatoPrevStep = 0;
  setInterval(() => {
    if (!previewsRunning) return;
    gatoPrevStep = (gatoPrevStep + 1) % 10;
    gatoPrevCells.forEach((s, i) => {
      const v = i < gatoPrevStep && gatoSeq[i] ? gatoSeq[i] : '';
      s.textContent = v;
      s.style.color = v === 'X' ? '#f59e0b' : '#3b82f6';
    });
    if (gatoPrevStep === 9) setTimeout(() => { gatoPrevStep = 0; gatoPrevCells.forEach((s) => (s.textContent = '')); }, 700);
  }, 450);

  function previewLoop(t) {
    if (previewsRunning) {
      try { drawPrevSnake(t || 0); drawPrevTetris(t || 0); drawPrevPong(t || 0); drawPrevTiempo(t || 0); } catch (e) {}
    }
    requestAnimationFrame(previewLoop);
  }
  requestAnimationFrame(previewLoop);

  /* ================= SNAKE ================= */
  const Snake = (() => {
    const cv = $('#snake-canvas'), ctx = cv.getContext('2d');
    const N = 20, CELL = 20;
    let snake, dir, nextDir, food, timer = null, score = 0, best = 0, alive = false;
    try { best = parseInt(localStorage.getItem('wgc-snake-best') || '0', 10) || 0; } catch (e) {}
    $('#snake-best').textContent = best;

    function reset() {
      snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
      dir = { x: 1, y: 0 }; nextDir = dir;
      score = 0; alive = true;
      $('#snake-score').textContent = '0';
      placeFood(); draw();
    }
    function placeFood() {
      while (true) {
        const f = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) };
        if (!snake.some((s) => s.x === f.x && s.y === f.y)) { food = f; return; }
      }
    }
    function draw() {
      ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 400, 400);
      ctx.strokeStyle = '#1e293b';
      for (let i = 0; i <= N; i++) {
        ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, 400); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(400, i * CELL); ctx.stroke();
      }
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(food.x * CELL + 10, food.y * CELL + 10, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#166534';
      ctx.fillRect(food.x * CELL + 8, food.y * CELL - 2, 3, 6);
      snake.forEach((s, i) => {
        ctx.fillStyle = i === 0 ? '#4ade80' : '#22c55e';
        ctx.beginPath(); ctx.roundRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2, 5); ctx.fill();
        if (i === 0) {
          ctx.fillStyle = '#052e16';
          ctx.fillRect(s.x * CELL + 5, s.y * CELL + 6, 3, 3);
          ctx.fillRect(s.x * CELL + 12, s.y * CELL + 6, 3, 3);
        }
      });
    }
    function step() {
      dir = nextDir;
      const h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || snake.some((s) => s.x === h.x && s.y === h.y)) {
        gameOver(); return;
      }
      snake.unshift(h);
      if (h.x === food.x && h.y === food.y) {
        score += 10;
        $('#snake-score').textContent = score;
        if (score > best) {
          best = score; $('#snake-best').textContent = best;
          try { localStorage.setItem('wgc-snake-best', String(best)); } catch (e) {}
        }
        placeFood();
      } else snake.pop();
      draw();
    }
    function gameOver() {
      alive = false; clearInterval(timer); timer = null;
      $('#snake-overlay-text').textContent = '💀 Game Over · ' + Mii.getName() + ' · ' + score + ' pts. Pulsa Reiniciar.';
      $('#snake-overlay').classList.remove('hidden');
    }
    return {
      start() {
        clearInterval(timer);
        reset();
        $('#snake-overlay').classList.add('hidden');
        timer = setInterval(step, 120);
      },
      stop() { clearInterval(timer); timer = null; },
      setDir(x, y) {
        if (dir.x === -x && dir.y === -y) return; // no reversa
        if (dir.x === x && dir.y === y) return;
        nextDir = { x, y };
      },
    };
  })();
  $('#snake-start').addEventListener('click', () => Snake.start());
  $('#snake-dpad').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset.dir;
    if (d === 'up') Snake.setDir(0, -1);
    if (d === 'down') Snake.setDir(0, 1);
    if (d === 'left') Snake.setDir(-1, 0);
    if (d === 'right') Snake.setDir(1, 0);
  });
  // swipe en canvas snake
  (() => {
    let sx = 0, sy = 0;
    const cv = $('#snake-canvas');
    cv.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) Snake.setDir(Math.sign(dx), 0);
      else Snake.setDir(0, Math.sign(dy));
      sx = t.clientX; sy = t.clientY;
    }, { passive: false });
  })();

  /* ================= TETRIS ================= */
  const Tetris = (() => {
    const cv = $('#tetris-canvas'), ctx = cv.getContext('2d');
    const nx = $('#tetris-next').getContext('2d');
    const COLS = 10, ROWS = 20, S = 30;
    const COLORS = { I: '#22d3ee', O: '#facc15', T: '#c084fc', S: '#4ade80', Z: '#f87171', J: '#60a5fa', L: '#fb923c' };
    const SHAPES = {
      I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
      O: [[1, 1], [1, 1]],
      T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
      S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
      Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
      J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
      L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    };
    let board, cur, nxt, score, lines, level, dropTimer = null, paused = false, over = true;
    function emptyBoard() { return Array.from({ length: ROWS }, () => Array(COLS).fill(null)); }
    function newPiece() {
      const keys = Object.keys(SHAPES);
      const k = keys[Math.floor(Math.random() * keys.length)];
      return { k, m: SHAPES[k].map((r) => r.slice()), x: 3, y: 0 };
    }
    function collide(m, px, py) {
      for (let y = 0; y < m.length; y++) for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const bx = px + x, by = py + y;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by][bx]) return true;
      }
      return false;
    }
    function merge() {
      cur.m.forEach((row, y) => row.forEach((v, x) => {
        if (v && cur.y + y >= 0) board[cur.y + y][cur.x + x] = cur.k;
      }));
    }
    function clearLines() {
      let n = 0;
      board = board.filter((row) => {
        if (row.every(Boolean)) { n++; return false; }
        return true;
      });
      while (board.length < ROWS) board.unshift(Array(COLS).fill(null));
      if (n) {
        lines += n;
        score += [0, 100, 300, 500, 800][n] * level;
        level = 1 + Math.floor(lines / 10);
        $('#tetris-score').textContent = score;
        $('#tetris-lines').textContent = lines;
        $('#tetris-level').textContent = level;
        restartDrop();
      }
    }
    function spawn() {
      cur = nxt || newPiece(); nxt = newPiece();
      cur.x = 3; cur.y = 0;
      if (collide(cur.m, cur.x, cur.y)) {
        over = true; clearInterval(dropTimer); dropTimer = null;
        $('#tetris-overlay-text').textContent = '💀 Game Over · ' + Mii.getName() + ' · ' + score + ' pts';
        $('#tetris-overlay').classList.remove('hidden');
      }
      drawNext();
    }
    function rotate(m) { return m[0].map((_, i) => m.map((r) => r[i]).reverse()); }
    function tick() { if (paused || over) return; move(0, 1) || (merge(), clearLines(), spawn(), draw()); }
    function move(dx, dy) {
      if (over || paused || !cur) return false;
      if (!collide(cur.m, cur.x + dx, cur.y + dy)) { cur.x += dx; cur.y += dy; draw(); return true; }
      return false;
    }
    function drawCell(g, x, y, s, color) {
      g.fillStyle = color; g.fillRect(x * s, y * s, s - 1, s - 1);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x * s, y * s, s - 1, 4);
    }
    function draw() {
      ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, COLS * S, ROWS * S);
      board.forEach((row, y) => row.forEach((v, x) => { if (v) drawCell(ctx, x, y, S, COLORS[v]); }));
      if (cur) cur.m.forEach((row, y) => row.forEach((v, x) => {
        if (v && cur.y + y >= 0) drawCell(ctx, cur.x + x, cur.y + y, S, COLORS[cur.k]);
      }));
    }
    function drawNext() {
      nx.fillStyle = '#0f172a'; nx.fillRect(0, 0, 120, 120);
      if (!nxt) return;
      nxt.m.forEach((row, y) => row.forEach((v, x) => {
        if (v) drawCell(nx, x + 1, y + 1, 22, COLORS[nxt.k]);
      }));
    }
    function speed() { return Math.max(120, 700 - (level - 1) * 60); }
    function restartDrop() { clearInterval(dropTimer); dropTimer = setInterval(tick, speed()); }
    return {
      start() {
        board = emptyBoard(); score = 0; lines = 0; level = 1; over = false; paused = false;
        cur = null; nxt = newPiece();
        $('#tetris-score').textContent = '0'; $('#tetris-lines').textContent = '0'; $('#tetris-level').textContent = '1';
        $('#tetris-pause').textContent = 'Pausa';
        $('#tetris-overlay').classList.add('hidden');
        spawn(); draw(); restartDrop();
      },
      stop() { clearInterval(dropTimer); dropTimer = null; over = true; },
      left() { move(-1, 0); }, right() { move(1, 0); }, down() { move(0, 1); },
      rot() { if (!cur || over || paused) return; const r = rotate(cur.m); if (!collide(r, cur.x, cur.y)) { cur.m = r; draw(); } },
      drop() { if (!cur || over || paused) return; while (move(0, 1)) {} merge(); clearLines(); spawn(); draw(); },
      togglePause() {
        if (over) return;
        paused = !paused;
        $('#tetris-pause').textContent = paused ? 'Continuar' : 'Pausa';
      },
    };
  })();
  $('#tetris-start').addEventListener('click', () => Tetris.start());
  $('#tetris-pause').addEventListener('click', () => Tetris.togglePause());
  $('#t-left').addEventListener('click', () => Tetris.left());
  $('#t-right').addEventListener('click', () => Tetris.right());
  $('#t-down').addEventListener('click', () => Tetris.down());
  $('#t-rotate').addEventListener('click', () => Tetris.rot());
  $('#t-drop').addEventListener('click', () => Tetris.drop());

  /* ================= GATO ================= */
  const Gato = (() => {
    const cells = $$('#gato-board button');
    let board = Array(9).fill(''), turn = 'X', lock = false;
    let sx = 0, so = 0, st = 0;
    const WINS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    function render() {
      cells.forEach((b, i) => {
        b.textContent = board[i];
        b.style.color = board[i] === 'X' ? '#d97706' : board[i] === 'O' ? '#1d4ed8' : '#2b3342';
      });
      $('#gato-turn').textContent = 'Turno: ' + turn;
    }
    function check() {
      for (const w of WINS) {
        const [a, b, c] = w;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return w;
      }
      return board.every(Boolean) ? 'tie' : null;
    }
    function updateScore() {
      $('#gato-x').textContent = sx; $('#gato-o').textContent = so; $('#gato-t').textContent = st;
    }
    cells.forEach((b, i) => b.addEventListener('click', () => {
      if (lock || board[i]) return;
      board[i] = turn; render();
      const r = check();
      if (r === 'tie') { st++; updateScore(); $('#gato-msg').textContent = '🤝 ¡Empate!'; lock = true; return; }
      if (r) {
        r.forEach((k) => cells[k].classList.add('win'));
        if (turn === 'X') sx++; else so++;
        updateScore(); $('#gato-msg').textContent = '🏆 ¡Gana ' + turn + '!';
        lock = true; return;
      }
      turn = turn === 'X' ? 'O' : 'X'; render();
    }));
    return {
      restart() {
        board = Array(9).fill(''); turn = 'X'; lock = false;
        cells.forEach((b) => b.classList.remove('win'));
        $('#gato-msg').textContent = ''; render();
      },
      resetScore() { sx = 0; so = 0; st = 0; updateScore(); this.restart(); },
    };
  })();
  $('#gato-restart').addEventListener('click', () => Gato.restart());
  $('#gato-reset-score').addEventListener('click', () => Gato.resetScore());

  /* ================= PONG ================= */
  const Pong = (() => {
    const cv = $('#pong-canvas'), ctx = cv.getContext('2d');
    const W = 640, H = 400, PH = 80, PW = 12;
    let p1y, p2y, bx, by, bvx, bvy, sl, sr, raf = null, running = false;
    const keys = {};
    function resetPositions() {
      p1y = H / 2 - PH / 2; p2y = H / 2 - PH / 2;
      bx = W / 2; by = H / 2;
      const a = (Math.random() * 0.6 - 0.3);
      const dir = Math.random() > 0.5 ? 1 : -1;
      bvx = dir * 4.5; bvy = a * 6;
    }
    function draw() {
      ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#334155'; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#3b82f6'; ctx.fillRect(14, p1y, PW, PH);
      ctx.fillStyle = '#ef4444'; ctx.fillRect(W - 14 - PW, p2y, PW, PH);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 8, 0, 7); ctx.fill();
    }
    function point(winner) {
      if (winner === 'L') { sl++; $('#pong-l').textContent = sl; }
      else { sr++; $('#pong-r').textContent = sr; }
      if (sl >= 5 || sr >= 5) {
        running = false; cancelAnimationFrame(raf); raf = null;
        $('#pong-overlay-text').textContent = (sl >= 5 ? '🏆 Gana ' + Mii.getName() : '🏆 Gana ' + ($('#pong-mode').value === 'cpu' ? 'CPU' : 'Jugador 2')) + ' · ' + sl + ' : ' + sr;
        $('#pong-overlay').classList.remove('hidden');
        return;
      }
      resetPositions();
    }
    function loop() {
      if (!running) return;
      const mode = $('#pong-mode').value;
      const SPD = 6;
      if (keys['w'] || keys['W']) p1y -= SPD;
      if (keys['s'] || keys['S']) p1y += SPD;
      if (mode === '2p') {
        if (keys['ArrowUp']) p2y -= SPD;
        if (keys['ArrowDown']) p2y += SPD;
      } else {
        // CPU simple
        const target = by - PH / 2;
        p2y += Math.max(-4.2, Math.min(4.2, (target - p2y) * 0.12));
      }
      p1y = Math.max(0, Math.min(H - PH, p1y));
      p2y = Math.max(0, Math.min(H - PH, p2y));
      bx += bvx; by += bvy;
      if (by < 8 || by > H - 8) bvy *= -1;
      if (bx < 14 + PW + 8 && by > p1y && by < p1y + PH && bvx < 0) {
        bvx *= -1.06; bvy += ((by - (p1y + PH / 2)) / (PH / 2)) * 1.6;
      }
      if (bx > W - 14 - PW - 8 && by > p2y && by < p2y + PH && bvx > 0) {
        bvx *= -1.06; bvy += ((by - (p2y + PH / 2)) / (PH / 2)) * 1.6;
      }
      if (bx < 0) point('R');
      if (bx > W) point('L');
      draw();
      raf = requestAnimationFrame(loop);
    }
    // mouse / touch para P1 en modo CPU
    function pointerTo(e) {
      const r = cv.getBoundingClientRect();
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      p1y = Math.max(0, Math.min(H - PH, (y / r.height) * H - PH / 2));
    }
    cv.addEventListener('mousemove', (e) => { if (running && $('#pong-mode').value === 'cpu') pointerTo(e); });
    cv.addEventListener('touchmove', (e) => { e.preventDefault(); if (running) pointerTo(e); }, { passive: false });
    window.addEventListener('keydown', (e) => { keys[e.key] = true; });
    window.addEventListener('keyup', (e) => { keys[e.key] = false; });
    // botones hold
    function hold(id, key) {
      const b = $(id);
      const on = (e) => { e.preventDefault(); keys[key] = true; };
      const off = () => { keys[key] = false; };
      b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off);
      b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off);
    }
    hold('#p1-up', 'w'); hold('#p1-down', 's'); hold('#p2-up', 'ArrowUp'); hold('#p2-down', 'ArrowDown');
    return {
      start() {
        sl = 0; sr = 0;
        $('#pong-l').textContent = '0'; $('#pong-r').textContent = '0';
        $('#pong-overlay').classList.add('hidden');
        resetPositions(); running = true;
        cancelAnimationFrame(raf);
        draw(); raf = requestAnimationFrame(loop);
      },
      stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; },
    };
  })();
  $('#pong-start').addEventListener('click', () => Pong.start());

  /* ================= TIEMPO (desafío de percepción) ================= */
  const Tiempo = (() => {
    const phaseEl = $('#tiempo-phase'), displayEl = $('#tiempo-display');
    const stopBtn = $('#tiempo-stop'), startBtn = $('#tiempo-start'), resultEl = $('#tiempo-result');
    let state = 'idle'; // idle | memo | running | done
    let target = 5, t0 = 0, memoTimer = null;
    let total = 0, tries = 0, best = Infinity;
    try {
      const b = parseFloat(localStorage.getItem('wgc-tiempo-best') || 'NaN');
      if (!isNaN(b)) best = b;
    } catch (e) {}
    paintBest();

    function fmt(s) { return s.toFixed(2) + ' s'; }
    function paintBest() {
      const txt = isFinite(best) ? '±' + fmt(best) : '—';
      $('#tiempo-best').textContent = txt;
      $('#tiempo-best-side').textContent = txt;
    }
    function paintScore() {
      $('#tiempo-total').textContent = total;
      $('#tiempo-tries').textContent = tries;
    }
    function tier(diff) {
      if (diff <= 0.1) return ['🏆 ¡Precisión de reloj, ' + Mii.getName() + '!', 'tier-god'];
      if (diff <= 0.25) return ['✨ ¡Excelente! Casi perfecto.', 'tier-great'];
      if (diff <= 0.5) return ['👏 ¡Muy bien! Muy cerca.', 'tier-good'];
      if (diff <= 1) return ['🙂 Cerca… sigue afinando.', 'tier-ok'];
      return ['💪 Lejos esta vez. ¡Reinténtalo!', 'tier-bad'];
    }

    function start() {
      clearTimeout(memoTimer);
      target = Math.round((3 + Math.random() * 7) * 2) / 2; // 3.0 – 10.0 s, pasos de 0.5
      state = 'memo';
      resultEl.classList.add('hidden');
      displayEl.classList.remove('running');
      stopBtn.disabled = true;
      startBtn.textContent = 'Reiniciar';
      let count = 3;
      phaseEl.textContent = '🎯 Memoriza tu objetivo… ¡empieza en ' + count + '!';
      displayEl.textContent = '🎯 ' + fmt(target);
      memoTimer = setInterval(() => {
        count--;
        if (count <= 0) { clearInterval(memoTimer); memoTimer = null; beginRun(); return; }
        phaseEl.textContent = '🎯 Memoriza tu objetivo… ¡empieza en ' + count + '!';
      }, 1000);
    }
    function beginRun() {
      if (state !== 'memo') return;
      state = 'running';
      t0 = performance.now();
      phaseEl.textContent = '⏳ ¡YA! Cuenta mentalmente y pulsa ¡DETENER!';
      displayEl.textContent = '⏳ …';
      displayEl.classList.add('running');
      stopBtn.disabled = false;
      stopBtn.focus();
    }
    function stop() {
      if (state !== 'running') return;
      const el = (performance.now() - t0) / 1000;
      const diff = Math.abs(el - target);
      state = 'done';
      displayEl.classList.remove('running');
      stopBtn.disabled = true;
      startBtn.textContent = 'Nuevo intento';
      startBtn.focus();
      const pts = Math.max(0, Math.round(1000 - diff * 250));
      tries++; total += pts;
      if (diff < best) {
        best = diff;
        try { localStorage.setItem('wgc-tiempo-best', String(best)); } catch (e) {}
      }
      paintScore(); paintBest();
      const [msg, cls] = tier(diff);
      phaseEl.textContent = 'Objetivo: ' + fmt(target) + ' · Tu tiempo: ' + fmt(el);
      displayEl.textContent = '⏱️ ' + fmt(el);
      resultEl.className = 'tiempo-result ' + cls;
      resultEl.innerHTML = '';
      const m = document.createElement('div'); m.textContent = msg; resultEl.appendChild(m);
      const d = document.createElement('small');
      d.textContent = 'Diferencia: ±' + fmt(diff) + ' · +' + pts + ' pts';
      resultEl.appendChild(d);
    }
    return {
      start,
      stop,
      primary() { if (state === 'running') stop(); else start(); },
      stopAll() {
        clearInterval(memoTimer); memoTimer = null;
        if (state === 'memo' || state === 'running') {
          state = 'idle';
          displayEl.classList.remove('running');
          displayEl.textContent = '⏱️';
          phaseEl.textContent = 'Pulsa Iniciar para recibir tu objetivo secreto.';
          stopBtn.disabled = true;
          startBtn.textContent = 'Iniciar desafío';
        }
      },
    };
  })();
  $('#tiempo-start').addEventListener('click', (e) => { Tiempo.start(); e.currentTarget.blur(); });
  $('#tiempo-stop').addEventListener('click', (e) => { Tiempo.stop(); e.currentTarget.blur(); });

  /* ---------- Teclado global juegos ---------- */
  window.addEventListener('keydown', (e) => {
    const r = currentRoute();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) && r !== 'home') e.preventDefault();
    if (r === 'snake') {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') Snake.setDir(0, -1);
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') Snake.setDir(0, 1);
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') Snake.setDir(-1, 0);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') Snake.setDir(1, 0);
    }
    if (r === 'tetris') {
      if (e.key === 'ArrowLeft') Tetris.left();
      if (e.key === 'ArrowRight') Tetris.right();
      if (e.key === 'ArrowDown') Tetris.down();
      if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'X') Tetris.rot();
      if (e.key === ' ') Tetris.drop();
    }
    if (r === 'tiempo') {
      if (e.key === ' ' && !e.repeat) Tiempo.primary();
    }
  });

  showView();
})();
