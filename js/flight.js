// Cena do lançamento: anima o resultado da simulação com câmera que acompanha o foguete,
// fumaça, paraquedas, marcos de altura e régua.

class CenaVoo {
  constructor(canvas, sim, cfg, cb) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.sim = sim;
    this.geo = sim.geo;
    this.cfg = cfg;
    this.cb = cb; // { hud, fase, contagem, fim }
    this.a = sim.amostras;
    this.tMax = this.a[this.a.length - 1].t;
    this.t = 0;
    this.idx = 0;
    this.vel = 1;
    this.fumaca = [];
    this.poeira = [];
    this.viewH = 22;
    this.camX = 0;
    this.contagem = 3; // 3, 2, 1, Ignição!
    this.estado = 'contagem';
    this.tReal = 0;
    this.tPousou = -1;
    this.fimAvisado = false;
    this.eventosVistos = new Set();
    this.altMaxVista = 0;
    this.quadro = this.quadro.bind(this);
    this.ajustar = this.ajustar.bind(this);
    window.addEventListener('resize', this.ajustar);
    this.ajustar();

    this.nuvens = [
      { x: -140, y: 160, w: 70 }, { x: 110, y: 260, w: 95 }, { x: -60, y: 520, w: 150 },
      { x: 240, y: 800, w: 210 }, { x: -320, y: 1300, w: 320 }, { x: 160, y: 2000, w: 420 },
      { x: -500, y: 3200, w: 600 },
    ];
    this.arvores = [
      { x: 14, h: 7 }, { x: 21, h: 9 }, { x: 33, h: 6 }, { x: -44, h: 8 }, { x: -58, h: 10 },
      { x: 60, h: 8 }, { x: -90, h: 9 }, { x: 95, h: 11 }, { x: 140, h: 9 }, { x: -150, h: 12 },
    ];
  }

  ajustar() {
    const dpr = window.devicePixelRatio || 1;
    this.W = this.cv.clientWidth;
    this.H = this.cv.clientHeight;
    this.cv.width = this.W * dpr;
    this.cv.height = this.H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  iniciar() {
    this.ultimo = performance.now();
    this.raf = requestAnimationFrame(this.quadro);
  }

  parar() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.ajustar);
  }

  alternarVelocidade() {
    this.vel = this.vel === 1 ? 3 : this.vel === 3 ? 10 : 1;
    return this.vel;
  }

  pular() {
    if (this.estado === 'contagem') { this.estado = 'voo'; this.contagem = -1; this.cb.contagem(null); }
    this.t = this.tMax;
    this.fumaca = [];
  }

  // Estado do foguete no instante t (interpolado)
  estadoEm(t) {
    const a = this.a;
    while (this.idx < a.length - 2 && a[this.idx + 1].t <= t) this.idx++;
    while (this.idx > 0 && a[this.idx].t > t) this.idx--;
    const p = a[this.idx], q = a[Math.min(this.idx + 1, a.length - 1)];
    const f = q.t > p.t ? Math.min(1, Math.max(0, (t - p.t) / (q.t - p.t))) : 0;
    const lerp = (u, v) => u + (v - u) * f;
    const th = Math.abs(q.th - p.th) > Math.PI ? q.th : lerp(p.th, q.th);
    return { x: lerp(p.x, q.x), y: lerp(p.y, q.y), vx: lerp(p.vx, q.vx), vy: lerp(p.vy, q.vy), th, fase: p.fase, T: p.T, chute: lerp(p.chute, q.chute), cg: lerp(p.cg, q.cg) };
  }

  quadro(agora) {
    const dtReal = Math.min(0.05, (agora - this.ultimo) / 1000);
    this.ultimo = agora;
    this.tReal += dtReal;

    if (this.estado === 'contagem') {
      this.contagem -= dtReal;
      const n = Math.ceil(this.contagem);
      this.cb.contagem(n > 0 ? String(n) : 'Ignição!');
      if (this.contagem <= -0.5) { this.estado = 'voo'; this.cb.contagem(null); }
      if (this.contagem <= 0 && this.t === 0) this.t = 0.0001;
    }

    let e = this.estadoEm(this.t);
    if (this.estado === 'voo' || this.contagem <= 0) {
      const acelerado = e.fase === 3 ? 8 : 1; // a descida de paraquedas é longa: acelera
      this.t = Math.min(this.tMax, this.t + dtReal * this.vel * acelerado);
      e = this.estadoEm(this.t);
      this.verEventos();
    }
    this.altMaxVista = Math.max(this.altMaxVista, e.y);

    if (this.t >= this.tMax && this.tPousou < 0 && this.estado === 'voo') {
      this.tPousou = this.tReal;
      this.efeitoPouso(e);
    }
    if (this.tPousou >= 0 && !this.fimAvisado && this.tReal - this.tPousou > 1.4) {
      this.fimAvisado = true;
      this.cb.fim();
    }

    this.atualizarCamera(e, dtReal);
    this.atualizarParticulas(e, dtReal);
    this.desenhar(e);
    const v = Math.hypot(e.vx, e.vy);
    this.cb.hud({ alt: e.y, vel: this.t >= this.tMax ? 0 : v, t: this.t, vel_x: this.vel, acelerado: e.fase === 3 && this.t < this.tMax });
    this.raf = requestAnimationFrame(this.quadro);
  }

  verEventos() {
    const r = this.sim.resumo;
    if (!this.eventosVistos.has('inicio') && this.t > 0) {
      this.eventosVistos.add('inicio');
      if (!r.decolou) this.cb.fase('O foguete não saiu do lugar!');
      else this.cb.fase('Decolagem!');
    }
    for (const ev of this.sim.eventos) {
      const chave = ev.tipo + ev.t;
      // o aviso do paraquedas espera ele terminar de abrir (0,6 s de simulação)
      const tAviso = ev.tipo === 'paraquedas' ? ev.t + 0.6 : ev.t;
      if (tAviso > this.t || this.eventosVistos.has(chave)) continue;
      this.eventosVistos.add(chave);
      if (!r.decolou && ev.tipo !== 'pouso') continue;
      switch (ev.tipo) {
        case 'fimQueima': this.cb.fase('Motor apagou! Subindo no embalo...'); break;
        case 'apogeu': this.cb.fase(`Altura máxima: ${Formato.metros(ev.y)}`); break;
        case 'paraquedas':
          this.tRealParaquedas = this.tReal;
          if (ev.vy > 10) this.cb.fase('Paraquedas abriu cedo, ainda subindo!');
          else if (ev.v > 20) this.cb.fase('Paraquedas abriu tarde, caindo rápido!');
          else this.cb.fase('Paraquedas aberto!');
          break;
        case 'quedaNariz': this.cb.fase('Sem paraquedas: caindo de nariz!'); break;
        case 'quedaRodopiando': this.cb.fase('Caindo e rodopiando!'); break;
        case 'pouso':
          if (!r.decolou) break;
          if (r.vPouso > 10 && r.temParaquedas && !r.paraquedasAbriu) this.cb.fase('O paraquedas não teve tempo de abrir!');
          else if (r.vPouso > 10) this.cb.fase('O foguete se espatifou!');
          else if (r.ovoQuebrou) this.cb.fase('Pousou, mas o ovo quebrou!');
          else if (r.vPouso > 5) this.cb.fase('Pouso duro: amassou um pouco');
          else this.cb.fase('Pouso suave!');
          break;
      }
    }
    // Vento: o foguete vira contra o vento na subida e o paraquedas é levado a favor dele
    if (r.decolou && r.vento > 0) {
      const e = this.estadoEm(this.t);
      if (!this.eventosVistos.has('cataVento') && this.t < r.tApogeu && e.x < -3) {
        this.eventosVistos.add('cataVento');
        this.cb.fase('Virou contra o vento, como um cata-vento!');
      }
      if (!this.eventosVistos.has('ventoLeva') && this.tRealParaquedas !== undefined &&
          this.tReal - this.tRealParaquedas > 2.8 && this.t < this.tMax) {
        this.eventosVistos.add('ventoLeva');
        this.cb.fase('O vento está levando o paraquedas →');
      }
    }
    if (r.decolou && r.rodopiou && !this.eventosVistos.has('rodopio') && this.t > 0.3 && this.t < r.tApogeu) {
      const e = this.estadoEm(this.t);
      const vAng = Math.atan2(e.vy, e.vx);
      let dif = Math.abs(vAng - e.th) % (2 * Math.PI);
      if (dif > Math.PI) dif = 2 * Math.PI - dif;
      if (dif > 1) { this.eventosVistos.add('rodopio'); this.cb.fase('Está rodopiando!'); }
    }
  }

  efeitoPouso(e) {
    const r = this.sim.resumo;
    if (!r.decolou) return;
    const n = r.vPouso > 10 ? 40 : 12;
    for (let i = 0; i < n; i++) {
      this.poeira.push({
        x: e.x, y: 0.1, vx: (Math.random() - 0.5) * (r.vPouso > 10 ? 6 : 2),
        vy: Math.random() * (r.vPouso > 10 ? 5 : 1.5), r: 0.15 + Math.random() * 0.3, idade: 0,
      });
    }
  }

  atualizarCamera(e, dt) {
    const prop = this.H / this.W;
    const adiante = e.y + Math.max(0, e.vy) * 0.6; // olha um pouco à frente na subida rápida
    const folga = e.chute > 0 ? 1.7 : 1.35; // espaço em cima para o paraquedas aberto
    const alvoH = Math.max(22, adiante * folga + 10, (Math.abs(e.x) * 1.7 + 30) * prop);
    const taxa = alvoH > this.viewH ? 7 : 1.6;
    this.viewH += (alvoH - this.viewH) * Math.min(1, dt * taxa);
    this.camX += (e.x / 2 - this.camX) * Math.min(1, dt * 3);
    this.chao = this.H - 64;
    this.s = (this.chao - 40) / this.viewH;
  }

  X(x) { return this.W / 2 + (x - this.camX) * this.s; }
  Y(y) { return this.chao - y * this.s; }

  // A simulação dá a posição do centro de massa (CG), e o foguete gira em torno dele.
  // ex: exagero de tamanho (o foguete real seria um pontinho quando a câmera se afasta).
  exagero() { return Math.max(1, 70 / (this.geo.L * this.s)); }

  // Ajuste de desenho perto da base: no chão, o CG desenhado fica acima da rampa para a cauda
  // apoiar nela (o foguete desenhado é maior que o real). O ajuste some nos primeiros 15 m.
  // Foguete, rastro e fumaça usam o mesmo ajuste, então ficam sempre alinhados.
  ajuste(y) {
    const w = Math.max(0, 1 - y / 15);
    if (w === 0) return { dx: 0, dy: 0 };
    const ang = (90 - (this.cfg.angulo || 0)) * Math.PI / 180;
    const d = (this.geo.L - this.geo.cg0) * this.exagero();
    return { dx: Math.cos(ang) * d * w, dy: (0.33 + Math.sin(ang) * d) * w };
  }

  pose(e) {
    const ex = this.exagero();
    const cg = e.cg || this.geo.cg0;
    const { dx, dy } = this.ajuste(e.y);
    const cgX = e.x + dx, cgY = e.y + dy;
    const dCauda = (this.geo.L - cg) * ex;
    return {
      ex, cg, cgX, cgY,
      bocalX: cgX - Math.cos(e.th) * dCauda,
      bocalY: cgY - Math.sin(e.th) * dCauda,
    };
  }

  atualizarParticulas(e, dt) {
    const dtSim = this.estado === 'voo' ? dt * this.vel : 0;
    if (e.T > 0 && this.t < this.tMax) {
      const forca = Math.min(1, e.T / Math.max(1, this.geo.empuxoMax));
      const p = this.pose(e);
      for (let i = 0; i < 3; i++) {
        this.fumaca.push({
          x: p.bocalX - Math.cos(e.th) * 0.1 + (Math.random() - 0.5) * 0.2,
          y: Math.max(0.05, p.bocalY - 0.33 - Math.sin(e.th) * 0.1),
          vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.3) * 0.8,
          r0: 0.15 + forca * 0.25, idade: 0, vida: 2.5 + Math.random() * 2,
        });
      }
    }
    for (const p of this.fumaca) {
      p.idade += Math.max(dt, dtSim);
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y < 0.1) { p.y = 0.1; p.vx *= 1.02; }
    }
    this.fumaca = this.fumaca.filter((p) => p.idade < p.vida).slice(-700);
    for (const p of this.poeira) {
      p.idade += dt;
      p.x += p.vx * dt; p.y = Math.max(0, p.y + p.vy * dt); p.vy -= 6 * dt;
    }
    this.poeira = this.poeira.filter((p) => p.idade < 2.5);
  }

  corCeu(alt) {
    const paradas = [[0, [167, 216, 255]], [1500, [111, 178, 242]], [5000, [60, 127, 217]], [20000, [18, 58, 122]], [60000, [5, 11, 30]]];
    for (let i = 1; i < paradas.length; i++) {
      if (alt <= paradas[i][0]) {
        const [a0, c0] = paradas[i - 1], [a1, c1] = paradas[i];
        const f = (alt - a0) / (a1 - a0);
        return `rgb(${c0.map((c, k) => Math.round(c + (c1[k] - c) * f)).join(',')})`;
      }
    }
    return 'rgb(5,11,30)';
  }

  desenhar(e) {
    const { ctx, W, H } = this;
    const s = this.s;

    // Céu
    const altTopo = this.viewH * 1.1;
    const g = ctx.createLinearGradient(0, 0, 0, this.chao);
    g.addColorStop(0, this.corCeu(altTopo));
    g.addColorStop(1, this.corCeu(0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Sol
    ctx.fillStyle = 'rgba(255,240,170,0.9)';
    ctx.beginPath(); ctx.arc(W * 0.7, 110, 36, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,170,0.25)';
    ctx.beginPath(); ctx.arc(W * 0.7, 110, 58, 0, Math.PI * 2); ctx.fill();

    // Nuvens
    for (const n of this.nuvens) {
      const w = n.w * s;
      if (w < 6) continue;
      const cx = this.X(n.x + this.sim.resumo.vento * 1.2 * this.t), cy = this.Y(n.y);
      if (cx + w < 0 || cx - w > W || cy < -w || cy > this.chao) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.5, w * 0.16, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - w * 0.18, cy - w * 0.1, w * 0.22, w * 0.16, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + w * 0.12, cy - w * 0.14, w * 0.26, w * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    this.desenharMarcos();

    // Morros ao fundo (decorativos)
    ctx.fillStyle = '#8fcf8a';
    ctx.beginPath();
    ctx.moveTo(0, this.chao);
    for (let x = 0; x <= W; x += 20) {
      const xx = x + this.camX * s * 0.05;
      ctx.lineTo(x, this.chao - 18 - 14 * Math.sin(xx / 140) - 8 * Math.sin(xx / 53));
    }
    ctx.lineTo(W, this.chao);
    ctx.fill();

    // Chão
    const gc = ctx.createLinearGradient(0, this.chao, 0, H);
    gc.addColorStop(0, '#5cb85c');
    gc.addColorStop(1, '#3e8e41');
    ctx.fillStyle = gc;
    ctx.fillRect(0, this.chao, W, H - this.chao);

    this.desenharCenario();
    this.desenharRastro(e);

    // Fumaça
    for (const p of this.fumaca) {
      const f = p.idade / p.vida;
      const r = Math.max(2, (p.r0 + f * 2.2) * s);
      ctx.fillStyle = `rgba(235,235,240,${0.55 * (1 - f)})`;
      ctx.beginPath(); ctx.arc(this.X(p.x), this.Y(p.y), r, 0, Math.PI * 2); ctx.fill();
    }

    this.desenharFoguete(e);

    for (const p of this.poeira) {
      const f = p.idade / 2.5;
      ctx.fillStyle = `rgba(150,110,70,${0.6 * (1 - f)})`;
      ctx.beginPath(); ctx.arc(this.X(p.x), this.Y(p.y), Math.max(2, p.r * s * (1 + f)), 0, Math.PI * 2); ctx.fill();
    }

    this.desenharRegua();
    this.desenharPouso(e);
  }

  desenharMarcos() {
    const { ctx, W } = this;
    let ultimoY = -1e9;
    const apogeuAtual = this.sim.resumo.apogeu;
    const marcos = DADOS.marcos.filter((m) => m.h >= 5).slice().reverse();
    ctx.font = '600 13px Montserrat, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const m of marcos) {
      const y = this.Y(m.h);
      if (y < 24 || y > this.chao - 14) continue;
      if (y - ultimoY < 26) continue;
      ultimoY = y;
      const passou = this.altMaxVista >= m.h;
      ctx.strokeStyle = passou ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.setLineDash([]);
      const txt = `${m.nome} · ${Formato.metros(m.h)}`;
      const tw = ctx.measureText(txt).width;
      ctx.fillStyle = passou ? 'rgba(30,46,59,0.92)' : 'rgba(30,46,59,0.5)';
      Util.retArredondado(ctx, W - tw - 34, y - 13, tw + 20, 26, 13);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(txt, W - tw - 24, y + 1);
    }
    // Linha da altura máxima (depois do apogeu)
    if (this.t >= this.sim.resumo.tApogeu && this.sim.resumo.decolou && apogeuAtual > 3) {
      const y = this.Y(apogeuAtual);
      if (y > 10) {
        ctx.strokeStyle = 'rgba(255,80,35,0.95)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 6]);
        ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(W, y); ctx.stroke();
        ctx.setLineDash([]);
        const txt = `Altura máxima: ${Formato.metros(apogeuAtual)}`;
        ctx.font = '800 14px Montserrat, system-ui, sans-serif';
        const tw = ctx.measureText(txt).width;
        ctx.fillStyle = 'rgba(255,80,35,0.95)';
        Util.retArredondado(ctx, 70, y - 14, tw + 20, 28, 14);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(txt, 80, y + 1);
      }
    }
  }

  desenharCenario() {
    const { ctx } = this;
    const s = this.s;
    // Escola
    const ex = this.X(-34), ey = this.chao;
    const ew = 22 * s, eh = 7 * s;
    if (ew > 3) {
      ctx.fillStyle = '#f2d7a6';
      ctx.fillRect(ex, ey - eh, ew, eh);
      ctx.fillStyle = '#c0583e';
      ctx.beginPath(); ctx.moveTo(ex - 0.8 * s, ey - eh); ctx.lineTo(ex + ew / 2, ey - eh - 2.5 * s); ctx.lineTo(ex + ew + 0.8 * s, ey - eh); ctx.fill();
      if (s > 3) {
        ctx.fillStyle = '#7fb8e0';
        for (let i = 0; i < 6; i++) ctx.fillRect(ex + (1.5 + i * 3.4) * s, ey - eh + 1.2 * s, 2 * s, 1.6 * s);
        ctx.fillStyle = '#8a5a3c';
        ctx.fillRect(ex + ew / 2 - 1 * s, ey - 3 * s, 2 * s, 3 * s);
      }
      if (s > 6) {
        ctx.fillStyle = '#1e2e3b';
        ctx.font = `800 ${Math.round(0.9 * s)}px Montserrat, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('ESCOLA', ex + ew / 2, ey - eh + 4.3 * s);
        ctx.textAlign = 'left';
      }
    }
    // Árvores
    for (const a of this.arvores) {
      const x = this.X(a.x), h = a.h * s;
      if (h < 2 || x < -50 || x > this.W + 50) continue;
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(x - h * 0.05, this.chao - h * 0.45, h * 0.1, h * 0.45);
      ctx.fillStyle = '#2f8f46';
      ctx.beginPath(); ctx.arc(x, this.chao - h * 0.62, h * 0.33, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3aa655';
      ctx.beginPath(); ctx.arc(x - h * 0.1, this.chao - h * 0.7, h * 0.2, 0, Math.PI * 2); ctx.fill();
    }
    // Plateia
    if (s > 4) {
      const cores = ['#e76f51', '#2a9d8f', '#f4a261', '#264653', '#e9c46a'];
      [-9, -7.6, -6.4, -5, -11].forEach((px, i) => {
        const x = this.X(px), h = (i === 4 ? 1.75 : 1.3) * s;
        ctx.fillStyle = cores[i];
        Util.retArredondado(ctx, x - h * 0.14, this.chao - h * 0.72, h * 0.28, h * 0.5, h * 0.08);
        ctx.fill();
        ctx.fillStyle = '#f1c27d';
        ctx.beginPath(); ctx.arc(x, this.chao - h * 0.85, h * 0.13, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = Math.max(1, h * 0.06);
        ctx.beginPath(); ctx.moveTo(x - h * 0.06, this.chao - h * 0.24); ctx.lineTo(x - h * 0.08, this.chao);
        ctx.moveTo(x + h * 0.06, this.chao - h * 0.24); ctx.lineTo(x + h * 0.08, this.chao); ctx.stroke();
      });
    }
    this.desenharBiruta(5);

    // Base de lançamento
    const bx = this.X(0);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = Math.max(1.5, 0.04 * s);
    ctx.beginPath();
    ctx.moveTo(bx - 0.5 * s, this.chao); ctx.lineTo(bx, this.chao - 0.3 * s); ctx.lineTo(bx + 0.5 * s, this.chao);
    ctx.stroke();
    ctx.fillStyle = '#888';
    ctx.fillRect(bx - 0.25 * s, this.chao - 0.33 * s, 0.5 * s, Math.max(2, 0.05 * s));
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = Math.max(1, 0.012 * s);
    const ang = (90 - (this.cfg.angulo || 0)) * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(bx, this.chao - 0.3 * s);
    ctx.lineTo(bx + Math.cos(ang) * 1.0 * s, this.chao - (0.3 + Math.sin(ang) * 1.0) * s);
    ctx.stroke();
  }

  // Biruta: mostra de onde vem o vento (pendurada sem vento, esticada com ventania)
  desenharBiruta(xm) {
    const { ctx } = this;
    const s = Math.max(this.s, 6); // nunca some de vez
    const vento = this.sim.resumo.vento;
    const x = this.X(xm), topo = this.chao - 3.2 * s;
    ctx.strokeStyle = '#5d6b78';
    ctx.lineWidth = Math.max(1.5, 0.08 * s);
    ctx.beginPath(); ctx.moveTo(x, this.chao); ctx.lineTo(x, topo); ctx.stroke();
    const tremor = vento > 0 ? Math.sin(this.tReal * (2 + vento * 0.6)) * 0.06 : 0;
    const ang = -Math.PI / 2 * (1 - Math.min(1, vento / 7)) + tremor; // 0 = esticada para a direita
    const comp = 1.5 * s, r0 = 0.28 * s, r1 = 0.14 * s;
    ctx.save();
    ctx.translate(x, topo);
    ctx.rotate(-ang);
    for (let i = 0; i < 4; i++) {
      const a = i / 4, b = (i + 1) / 4;
      const ra = r0 + (r1 - r0) * a, rb = r0 + (r1 - r0) * b;
      ctx.fillStyle = i % 2 ? '#ffffff' : '#ff5023';
      ctx.beginPath();
      ctx.moveTo(a * comp, -ra); ctx.lineTo(b * comp, -rb); ctx.lineTo(b * comp, rb); ctx.lineTo(a * comp, ra);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  desenharRastro(e) {
    const { ctx } = this;
    if (this.idx < 2) return;
    const passo = Math.max(1, Math.floor(this.idx / 500));
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    for (let i = 0; i <= this.idx; i += passo) {
      const p = this.a[i];
      const { dx, dy } = this.ajuste(p.y);
      const X = this.X(p.x + dx), Y = this.Y(p.y + dy);
      if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
    }
    if (this.t < this.tMax) {
      const p = this.pose(e);
      ctx.lineTo(this.X(p.cgX), this.Y(p.cgY));
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  desenharFoguete(e) {
    const { ctx } = this;
    const geo = this.geo;
    const pose = this.pose(e);
    const k = this.s * pose.ex;
    const pousado = this.t >= this.tMax && this.sim.resumo.decolou;
    const cgTela = { x: this.X(pose.cgX), y: this.Y(pose.cgY) };

    ctx.save();
    let phi;
    if (pousado) {
      // deitado no chão
      ctx.translate(this.X(e.x) + geo.L * k / 2, this.chao - geo.R * k);
      phi = 0;
    } else {
      ctx.translate(cgTela.x, cgTela.y);
      // pendurado no paraquedas: balanço lento e pequeno (pêndulo de ~1 m), em tempo real
      // para não ficar frenético quando a descida passa acelerada
      const balanco = e.chute > 0 ? 0.05 * Math.sin(this.tReal * 3.1) * e.chute : 0;
      phi = Math.PI - e.th + balanco;
    }
    ctx.rotate(phi);
    ctx.scale(k, k);
    ctx.translate(pousado ? -geo.L : -pose.cg, 0);
    const empuxo = this.t > 0 && this.t < this.tMax && e.T > 0 ? Math.min(1, e.T / geo.empuxoMax + 0.3) : 0;
    Desenho.foguete(ctx, geo, { cor: this.cfg.cor, empuxo, escalaPx: k, contorno: 1.5, carga: this.cfg.carga });
    ctx.restore();

    // Paraquedas
    if (e.chute > 0 && !pousado) {
      const mx = cgTela.x, my = cgTela.y; // cordas presas perto do CG
      const rc = Math.max(14, geo.para.diametro / 2 * k) * (0.3 + 0.7 * e.chute);
      const cy = my - rc * 2.2;
      ctx.strokeStyle = 'rgba(60,60,60,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const f of [-1, -0.4, 0.4, 1]) { ctx.moveTo(mx, my); ctx.lineTo(mx + f * rc, cy); }
      ctx.stroke();
      const cores = ['#ff5023', '#ffffff'];
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = cores[i % 2];
        ctx.beginPath();
        ctx.moveTo(mx, cy);
        ctx.arc(mx, cy, rc, Math.PI + i * Math.PI / 6, Math.PI + (i + 1) * Math.PI / 6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(140,40,10,0.7)';
      ctx.beginPath(); ctx.arc(mx, cy, rc, Math.PI, 0); ctx.closePath(); ctx.stroke();
    }

    // Seta indicando o foguete quando ele está muito pequeno
    if (!pousado && this.t > 0 && this.viewH > 200) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '700 12px Montserrat, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`← ${this.cfg.nome || 'Foguete'}`, cgTela.x + 22, cgTela.y - 30);
    }
  }

  desenharRegua() {
    const { ctx } = this;
    const bruto = this.viewH / 6;
    const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
    const passo = [1, 2, 5, 10].map((m) => m * pot).find((p) => p >= bruto);
    ctx.fillStyle = 'rgba(30,46,59,0.4)';
    ctx.fillRect(0, 0, 58, this.chao);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.fillStyle = '#fff';
    ctx.font = '700 12px Montserrat, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 2;
    for (let h = 0; h <= this.viewH * 1.2; h += passo) {
      const y = this.Y(h);
      if (y < 8) break;
      ctx.beginPath(); ctx.moveTo(46, y); ctx.lineTo(58, y); ctx.stroke();
      ctx.fillText(Formato.metrosCurto(h), 42, y);
    }
    ctx.textAlign = 'left';
  }

  desenharPouso(e) {
    const r = this.sim.resumo;
    if (this.t < this.tMax || !r.decolou) return;
    const { ctx } = this;
    const x = this.X(e.x);
    // Etiqueta do pouso acima do foguete
    const [txt, cor] = r.vPouso > 10 ? ['Espatifou!', '#e5383b'] : r.ovoQuebrou ? ['O ovo quebrou', '#e5383b']
      : r.vPouso > 5 ? ['Pouso duro', '#d99a00'] : ['Pouso suave', '#23a55a'];
    ctx.font = '800 15px Montserrat, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(txt).width + 24;
    ctx.fillStyle = cor;
    Util.retArredondado(ctx, x - w / 2, this.chao - 86, w, 30, 15);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(txt, x, this.chao - 70);
    if (Math.abs(e.x) > 3) {
      ctx.font = '700 14px Montserrat, system-ui, sans-serif';
      ctx.fillText(`Pousou a ${Formato.metros(Math.abs(e.x))} da base`, x, this.chao + 30);
    }
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }
}
