// Interface da Oficina de Foguetes: painel de peças, desenho, números, lançamento e missões.

(() => {
  const PADRAO = {
    nome: 'Foguete 1', cor: '#e63946', diametro: 'fino', comprimento: 0.3, ponta: 'conica',
    aletas: 'media', numAletas: 3, posAletas: 'tras', combustivel: 'polvora', motor: 'medio',
    carga: 'nada', paraquedas: 'pequeno', vento: 'calmo', angulo: 0,
  };

  let cfg = { ...PADRAO, ...Util.ler('of_projeto', {}) };
  let modo = Util.ler('of_modo', 'explorador');
  let missoesFeitas = new Set(Util.ler('of_missoes', []));
  let historico = Util.ler('of_hist', []);
  let cena = null;
  let ultimoSim = null;

  const $ = (sel) => document.querySelector(sel);
  const porId = Fisica.porId;

  // ---------- Ícones SVG das opções ----------
  const svg = (w, h, dentro) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${dentro}</svg>`;
  const C = { corpo: '#7d9bf0', borda: '#1d2b53', aleta: '#4a6fd8' };

  const icones = {
    diametro: (o) => {
      const h = o.d * 280;
      return svg(56, 30, `<rect x="4" y="${15 - h / 2}" width="48" height="${h}" rx="2" fill="${C.corpo}" stroke="${C.borda}" stroke-width="1.5"/>`);
    },
    ponta: (o) => {
      const corpo = `<rect x="30" y="7" width="24" height="16" fill="${C.corpo}" stroke="${C.borda}" stroke-width="1.5"/>`;
      const formas = {
        conica: '<path d="M2 15 L30 7 L30 23 Z"/>',
        ogiva: '<path d="M2 15 Q14 5 30 7 L30 23 Q14 25 2 15 Z"/>',
        redonda: '<path d="M30 7 A10 8 0 0 0 30 23 Z" transform="translate(-2 0)"/><rect x="27" y="7" width="4" height="16"/>',
        reta: '',
      };
      return svg(56, 30, `<g fill="${C.corpo}" stroke="${C.borda}" stroke-width="1.5">${formas[o.id]}</g>${corpo}`);
    },
    aletas: (o) => {
      if (!o.cr) return svg(56, 36, `<rect x="4" y="22" width="48" height="10" fill="${C.corpo}" stroke="${C.borda}" stroke-width="1.5"/><text x="28" y="16" font-size="14" text-anchor="middle">🚫</text>`);
      const k = 10;
      const x0 = 52 - o.cr * k, y0 = 22;
      const p = `${x0},${y0} ${x0 + o.sweep * k},${y0 - o.s * k} ${x0 + o.sweep * k + o.ct * k},${y0 - o.s * k} ${52},${y0}`;
      return svg(56, 36, `<polygon points="${p}" fill="${C.aleta}" stroke="${C.borda}" stroke-width="1.5"/><rect x="4" y="22" width="48" height="10" fill="${C.corpo}" stroke="${C.borda}" stroke-width="1.5"/>`);
    },
    numAletas: (o) => {
      let f = '';
      for (let i = 0; i < o.id; i++) {
        const a = (i / o.id) * 360 - 90;
        f += `<rect x="16" y="-2.5" width="12" height="5" rx="1" fill="${C.aleta}" stroke="${C.borda}" stroke-width="1.2" transform="rotate(${a})"/>`;
      }
      return svg(36, 36, `<g transform="translate(18 18)">${f}<circle r="8" fill="${C.corpo}" stroke="${C.borda}" stroke-width="1.5"/></g>`);
    },
    posAletas: (o) => {
      const x = { tras: 40, meio: 24, frente: 12 }[o.id];
      return svg(56, 30, `<path d="M2 18 L12 13 L12 23 Z" fill="${C.corpo}" stroke="${C.borda}" stroke-width="1.2"/>
        <polygon points="${x},13 ${x + 4},4 ${x + 10},4 ${x + 12},13" fill="${C.aleta}" stroke="${C.borda}" stroke-width="1.2"/>
        <rect x="12" y="13" width="40" height="10" fill="${C.corpo}" stroke="${C.borda}" stroke-width="1.2"/>`);
    },
    motor: (o) => {
      const w = o.comp * 380, h = o.d * 900;
      return svg(56, 30, `<rect x="${28 - w / 2}" y="${15 - h / 2}" width="${w}" height="${h}" rx="3" fill="#c9a77c" stroke="${C.borda}" stroke-width="1.5"/>
        <rect x="${28 + w / 2 - 3}" y="${15 - h / 4}" width="5" height="${h / 2}" fill="#3a3d46"/>`);
    },
    paraquedas: (o) => {
      if (!o.diametro) return '<span>🚫</span>';
      const r = o.diametro * 28;
      return svg(56, 36, `<path d="M${28 - r} 18 A${r} ${r * 0.8} 0 0 1 ${28 + r} 18 Z" fill="#ff5a5f" stroke="#9b2c2c" stroke-width="1.2"/>
        <path d="M${28 - r} 18 L28 32 L${28 + r} 18 M28 18 L28 32" stroke="#555" stroke-width="1" fill="none"/>
        <rect x="25" y="30" width="6" height="5" fill="${C.corpo}"/>`);
    },
  };

  // ---------- Definição das seções do painel ----------
  const SECOES = [
    {
      id: 'corpo', titulo: 'Corpo',
      exp: 'Foguete grosso leva mais coisas, mas fica mais pesado e o ar segura mais.',
      eng: 'Massa do tubo ∝ área (papelão). Corpo longo afasta as aletas do CG → mais margem estática.',
      grupos: [
        { chave: 'diametro', rotulo: 'Grossura', lista: DADOS.diametros, cols: 3, icone: icones.diametro, sub: (o) => o.rotulo },
        { tipo: 'deslizador', chave: 'comprimento', rotulo: 'Comprimento', ...DADOS.comprimento, fmt: (v) => `${Math.round(v * 100)} cm` },
      ],
    },
    {
      id: 'ponta', titulo: 'Ponta',
      exp: 'A ponta abre caminho no ar. Quanto mais suave, menos o ar freia o foguete.',
      eng: 'Arrasto de pressão + posição do CP da ponta (cone 0,666·L · ogiva 0,466·L · elipse 0,333·L).',
      grupos: [{ chave: 'ponta', lista: DADOS.pontas, cols: 4, icone: icones.ponta, titulo: (o) => o.dica }],
    },
    {
      id: 'aletas', titulo: 'Aletas',
      exp: 'As aletas são como as penas de uma flecha: fazem o foguete voar reto. Elas funcionam melhor lá atrás!',
      eng: 'Força normal das aletas puxa o CP para trás (Barrowman). Mais área = mais estabilidade e mais arrasto.',
      grupos: [
        { chave: 'aletas', rotulo: 'Tamanho', lista: DADOS.aletas, cols: 4, icone: icones.aletas },
        { chave: 'numAletas', rotulo: 'Quantidade', lista: DADOS.numAletas.map((n) => ({ id: n, nome: `${n} aletas` })), cols: 2, compacta: true, icone: icones.numAletas },
        { chave: 'posAletas', rotulo: 'Posição', lista: DADOS.posicoesAletas, cols: 3, icone: icones.posAletas },
      ],
    },
    {
      id: 'motor', titulo: 'Motor',
      exp: 'O motor joga gás quente para baixo, e o foguete é empurrado para cima (3ª lei de Newton!).',
      eng: 'Impulso total I = mₚ·Isp·g₀. Cada letra (A, B, C…) tem o dobro do impulso da anterior.',
      seguranca: '⚠️ Combustível de foguete é perigoso. Nunca tente fazer em casa!',
      grupos: [
        { chave: 'combustivel', rotulo: 'Combustível', lista: DADOS.combustiveis, cols: 3, icone: (o) => o.emoji,
          estrelas: (o) => '★'.repeat(o.forca) + '☆'.repeat(3 - o.forca), titulo: (o) => o.dica },
        { chave: 'motor', rotulo: 'Tamanho', lista: DADOS.motores, cols: 4, icone: icones.motor,
          sub: (o) => `Motor ${Fisica.classeMotor(o.prop * porId(DADOS.combustiveis, cfg.combustivel).isp * Fisica.G0)}`,
          desativado: (o) => !Fisica.cabeMotor(porId(DADOS.diametros, cfg.diametro).d, o.id),
          titulo: (o) => Fisica.cabeMotor(porId(DADOS.diametros, cfg.diametro).d, o.id) ? '' : 'Não cabe neste corpo. Escolha um corpo mais grosso.' },
      ],
    },
    {
      id: 'carga', titulo: 'Carga',
      exp: 'O que seu foguete vai levar? Peso na ponta deixa o foguete mais estável, mas ele sobe menos.',
      eng: 'Massa na frente desloca o CG para a frente → maior margem estática, menor apogeu.',
      grupos: [
        { chave: 'carga', lista: DADOS.cargas, cols: 4, icone: (o) => o.emoji, sub: (o) => (o.massa ? Formato.gramas(o.massa) : '0 g'),
          desativado: (o) => !Fisica.cabeCarga(porId(DADOS.diametros, cfg.diametro).d, o.id),
          titulo: (o) => Fisica.cabeCarga(porId(DADOS.diametros, cfg.diametro).d, o.id) ? '' : 'Não cabe no corpo fino.' },
      ],
    },
    {
      id: 'paraquedas', titulo: 'Paraquedas',
      exp: 'Abre lá no alto para o foguete descer devagar. Paraquedas grande desce mais devagar, mas o vento leva para longe.',
      eng: 'Velocidade de descida v = √(2mg / ρ·Cd·A), Cd ≈ 0,8. Abre no apogeu.',
      grupos: [{ chave: 'paraquedas', lista: DADOS.paraquedas, cols: 4, icone: icones.paraquedas, sub: (o) => (o.diametro ? `${Math.round(o.diametro * 100)} cm` : '') }],
    },
    {
      id: 'clima', titulo: 'Clima',
      exp: 'Com vento, foguetes muito estáveis viram contra o vento, como um cata-vento.',
      eng: 'Vento lateral cria ângulo de ataque na saída da vareta → efeito cata-vento (weathercocking).',
      grupos: [
        { chave: 'vento', lista: DADOS.ventos, cols: 3, icone: (o) => o.emoji, sub: (o) => (o.v ? `${Formato.num(o.v * 3.6)} km/h` : 'sem vento') },
        { tipo: 'deslizador', chave: 'angulo', rotulo: 'Inclinação da vareta', soEng: true, min: 0, max: 20, passo: 1, fmt: (v) => `${v}°` },
      ],
    },
  ];

  // ---------- Montagem do painel ----------
  function montarPainel() {
    const raiz = $('#pecas');
    raiz.innerHTML = '';
    SECOES.forEach((sec, i) => {
      const el = document.createElement('section');
      el.className = 'secao';
      el.innerHTML = `<h2><span class="passo">${i + 1}</span>${sec.titulo}</h2>
        <p class="dica exp">💡 ${sec.exp}</p><p class="dica eng">${sec.eng}</p>`;
      for (const g of sec.grupos) {
        if (g.rotulo) {
          const st = document.createElement('div');
          st.className = 'subtitulo' + (g.soEng ? ' eng' : '');
          st.textContent = g.rotulo;
          el.appendChild(st);
        }
        if (g.tipo === 'deslizador') {
          const d = document.createElement('div');
          d.className = 'deslizador' + (g.soEng ? ' eng' : '');
          d.innerHTML = `<input type="range" min="${g.min}" max="${g.max}" step="${g.passo}" value="${cfg[g.chave]}" aria-label="${g.rotulo}"><output></output>`;
          const inp = d.querySelector('input'), out = d.querySelector('output');
          out.textContent = g.fmt(cfg[g.chave]);
          inp.addEventListener('input', () => {
            mudar(g.chave, parseFloat(inp.value));
            out.textContent = g.fmt(cfg[g.chave]);
          });
          d.dataset.chave = g.chave;
          el.appendChild(d);
          continue;
        }
        const grade = document.createElement('div');
        grade.className = `opcoes c${g.cols}${g.compacta ? ' compacta' : ''}`;
        grade.setAttribute('role', 'group');
        grade.setAttribute('aria-label', g.rotulo || sec.titulo);
        for (const o of g.lista) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'opcao';
          b.dataset.chave = g.chave;
          b.dataset.valor = o.id;
          const icone = g.icone ? g.icone(o) : '';
          b.innerHTML = `<span class="icone">${icone}</span><span class="nm">${o.nome}</span>` +
            (g.estrelas ? `<span class="estrelas" aria-label="força">${g.estrelas(o)}</span>` : '') +
            (g.sub ? '<span class="sub"></span>' : '');
          b.addEventListener('click', () => mudar(g.chave, typeof o.id === 'number' ? o.id : o.id));
          b._grupo = g;
          b._opcao = o;
          grade.appendChild(b);
        }
        el.appendChild(grade);
      }
      if (sec.seguranca) {
        const a = document.createElement('p');
        a.className = 'aviso-seg';
        a.textContent = sec.seguranca;
        el.appendChild(a);
      }
      raiz.appendChild(el);
    });
    atualizarPainel();
  }

  function atualizarPainel() {
    document.querySelectorAll('.opcao').forEach((b) => {
      const g = b._grupo, o = b._opcao;
      b.setAttribute('aria-pressed', String(cfg[g.chave]) === String(o.id) ? 'true' : 'false');
      b.disabled = g.desativado ? g.desativado(o) : false;
      const sub = b.querySelector('.sub');
      if (sub) sub.textContent = g.sub(o);
      const t = g.titulo ? g.titulo(o) : '';
      if (t) b.title = t; else b.removeAttribute('title');
    });
    document.querySelectorAll('.deslizador').forEach((d) => {
      const inp = d.querySelector('input');
      if (parseFloat(inp.value) !== cfg[d.dataset.chave]) inp.value = cfg[d.dataset.chave];
      const sec = SECOES.flatMap((s) => s.grupos).find((g) => g.chave === d.dataset.chave);
      d.querySelector('output').textContent = sec.fmt(cfg[d.dataset.chave]);
    });
  }

  function mudar(chave, valor) {
    cfg[chave] = valor;
    // Corrige combinações impossíveis
    const D = porId(DADOS.diametros, cfg.diametro).d;
    if (!Fisica.cabeMotor(D, cfg.motor)) {
      const antes = porId(DADOS.motores, cfg.motor).nome;
      const cabe = DADOS.motores.filter((m) => Fisica.cabeMotor(D, m.id));
      cfg.motor = cabe[cabe.length - 1].id;
      aviso(`O motor ${antes} não cabe nesse corpo. Troquei para o ${porId(DADOS.motores, cfg.motor).nome}.`);
    }
    if (!Fisica.cabeCarga(D, cfg.carga)) {
      aviso(`${porId(DADOS.cargas, cfg.carga).emoji} ${porId(DADOS.cargas, cfg.carga).nome} não cabe no corpo fino!`);
      cfg.carga = 'nada';
    }
    Util.salvar('of_projeto', cfg);
    atualizarPainel();
    atualizarBancada();
  }

  // ---------- Bancada: desenho e números ----------
  function montarCores() {
    const raiz = $('#cores');
    raiz.innerHTML = '';
    for (const c of DADOS.cores) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cor';
      b.style.background = c;
      b.setAttribute('aria-label', `Cor ${c}`);
      b.addEventListener('click', () => { cfg.cor = c; Util.salvar('of_projeto', cfg); atualizarBancada(); atualizarCores(); });
      b.dataset.cor = c;
      raiz.appendChild(b);
    }
    atualizarCores();
  }
  function atualizarCores() {
    document.querySelectorAll('.cor').forEach((b) => b.setAttribute('aria-pressed', b.dataset.cor === cfg.cor ? 'true' : 'false'));
  }

  function classeEstab(m) {
    if (m < 0) return 'ruim';
    if (m < 1) return 'meio';
    if (m <= 3) return 'bom';
    return 'demais';
  }

  function atualizarBancada() {
    const geo = Fisica.analisar(cfg);
    desenharBancada(geo);
    const m = geo.estabilidade;
    const ce = classeEstab(m);

    const textos = {
      ruim: ['❌', '<b>Instável!</b> O ⚖️ ponto de equilíbrio está atrás do 🎯 ponto do vento. O foguete vai rodopiar. Tente aletas maiores, aletas mais atrás ou um peso na ponta.'],
      meio: ['⚠️', '<b>Quase lá!</b> O foguete pode balançar. Afaste mais o ⚖️ do 🎯: aletas maiores, foguete mais comprido ou peso na ponta.'],
      bom: ['✅', '<b>Estável!</b> O ⚖️ está na frente do 🎯, então o ar endireita o foguete, como as penas de uma flecha.'],
      demais: ['🔵', '<b>Estável até demais!</b> Com vento, ele vai virar contra o vento, como um cata-vento, e subir menos.'],
    };
    const ex = $('#estabExplica');
    ex.className = 'estab-explica ' + ce;
    ex.innerHTML = `<span class="grande">${textos[ce][0]}</span><span>${textos[ce][1]}</span>`;

    const tw = geo.empuxoPeso;
    let forcaTxt, forcaCor;
    if (tw < 1) { forcaTxt = 'Fraco demais: não vai decolar!'; forcaCor = 'var(--vermelho)'; }
    else if (tw < 5) { forcaTxt = 'Fraquinho: vai sair devagar'; forcaCor = 'var(--amarelo)'; }
    else { forcaTxt = 'Força de sobra!'; forcaCor = 'var(--verde)'; }
    const pos = (Math.max(-1, Math.min(4, m)) + 1) / 5 * 100;
    const rotEstab = { ruim: 'Vai rodopiar', meio: 'Pode balançar', bom: 'Vai voar reto', demais: 'Estável demais' }[ce];

    $('#stats').innerHTML = `
      <div class="stat">
        <span class="rot">⚖️ Peso total</span>
        <span class="val">${Formato.gramas(geo.massaTotal)}</span>
        <span class="det exp">${geo.massaTotal < 0.08 ? 'Levinho!' : geo.massaTotal < 0.2 ? 'Peso médio' : 'Pesadão!'}</span>
        <span class="det eng">vazio ${Formato.gramas(geo.mSeca)} + propelente ${Formato.gramas(geo.mProp)}</span>
      </div>
      <div class="stat">
        <span class="rot">🧭 Estabilidade</span>
        <span class="val">${rotEstab}</span>
        <div class="medidor" aria-hidden="true"><span class="ponteiro" style="left:${pos}%"></span></div>
        <span class="det eng">${Formato.num(m, 2)} cal · CG ${Formato.cm(geo.cg0)} · CP ${Formato.cm(geo.xcp)}</span>
      </div>
      <div class="stat">
        <span class="rot">💪 Força do motor</span>
        <span class="val" style="color:${forcaCor}">${tw < 1 ? Formato.num(tw, 1) : Formato.num(tw)}× o peso</span>
        <span class="det exp">${forcaTxt}</span>
        <span class="det eng">Classe ${geo.classe} · ${Formato.num(geo.impulso, 1)} N·s · máx ${Formato.num(geo.empuxoMax, 1)} N · ${Formato.num(geo.tQueima, 1)} s</span>
      </div>
      <div class="stat eng">
        <span class="rot">🌬️ Aerodinâmica</span>
        <span class="val">Cd ${Formato.num(geo.cd0, 2)}</span>
        <span class="det eng">L ${Formato.cm(geo.L)} · CNα ${Formato.num(geo.cnTotal, 1)} · Isp ${geo.comb.isp} s</span>
      </div>`;
  }

  function desenharBancada(geo) {
    const cv = $('#desenho');
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Escala com limite: foguetes curtos aparecem maiores, mas até um teto, para que
    // aumentar o comprimento ainda faça o desenho crescer
    const px = Math.min((W - 90) / (geo.L + 0.02), (H - 150) / (geo.D + 2 * geo.s + 0.01), 1000);
    const x0 = (W - geo.L * px) / 2;
    const yEixo = 124;

    ctx.font = '700 12px Nunito, system-ui, sans-serif';
    ctx.fillStyle = '#8a97b8';
    ctx.textBaseline = 'top';
    ctx.fillText('◀ a ponta vai para cima', 12, 10);

    ctx.save();
    ctx.translate(x0, yEixo);
    ctx.scale(px, px);
    const carga = porId(DADOS.cargas, cfg.carga);
    Desenho.foguete(ctx, geo, { cor: cfg.cor, escalaPx: px, contorno: 1.6, mostrarJanela: carga.massa > 0, emojiCarga: carga.emoji });
    ctx.restore();

    // Régua
    const yR = H - 34;
    ctx.strokeStyle = '#9fb0d6';
    ctx.fillStyle = '#6b7aa0';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, yR); ctx.lineTo(x0 + geo.L * px, yR); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = '700 11px Nunito, system-ui, sans-serif';
    for (let c = 0; c <= geo.L * 100 + 0.01; c += 5) {
      const x = x0 + c / 100 * px;
      const grande = c % 10 === 0;
      ctx.beginPath(); ctx.moveTo(x, yR); ctx.lineTo(x, yR + (grande ? 8 : 4)); ctx.stroke();
      if (grande) ctx.fillText(`${c}${c === 0 ? '' : ''}`, x, yR + 10);
    }
    const xFim = x0 + geo.L * px;
    ctx.beginPath(); ctx.moveTo(xFim, yR - 4); ctx.lineTo(xFim, yR + 8); ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillText(`${Formato.num(geo.L * 100)} cm`, xFim + 6, yR - 6);

    // CG e CP
    const xcg = x0 + geo.cg0 * px, xcp = x0 + geo.xcp * px;
    const est = geo.estabilidade;
    const corSeta = est < 0 ? '#e5383b' : est < 1 ? '#d99a00' : '#23a55a';
    const topoFoguete = yEixo - geo.R * px - (geo.temAletas && geo.N === 4 ? geo.s * px : geo.temAletas ? geo.s * px : 0);
    const baseFoguete = yEixo + geo.R * px + (geo.temAletas ? geo.s * px * (geo.N === 4 ? 1 : 0.5) : 0);
    const yCG = Math.min(yEixo - geo.R * px - 34, topoFoguete - 14);
    const yCP = Math.max(yEixo + geo.R * px + 34, baseFoguete + 14);

    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#1d2b53';
    ctx.beginPath(); ctx.moveTo(xcg, yEixo); ctx.lineTo(xcg, yCG + 10); ctx.stroke();
    ctx.strokeStyle = '#e01e37';
    ctx.beginPath(); ctx.moveTo(xcp, yEixo); ctx.lineTo(xcp, yCP - 10); ctx.stroke();
    ctx.setLineDash([]);
    Desenho.simboloCG(ctx, xcg, yEixo, 8);
    Desenho.simboloCP(ctx, xcp, yEixo, 8);

    ctx.font = '800 13px Nunito, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const engenheiro = modo === 'engenheiro';
    rotulo(ctx, xcg, yCG, `⚖️ equilíbrio${engenheiro ? ' · CG ' + Formato.cm(geo.cg0) : ''}`, '#1d2b53');
    rotulo(ctx, xcp, yCP, `🎯 vento${engenheiro ? ' · CP ' + Formato.cm(geo.xcp) : ''}`, '#e01e37');

    // Linha da margem entre os dois pontos, sobre o eixo
    if (Math.abs(xcp - xcg) > 10) {
      ctx.strokeStyle = corSeta;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(xcg + Math.sign(xcp - xcg) * 9, yEixo); ctx.lineTo(xcp - Math.sign(xcp - xcg) * 9, yEixo); ctx.stroke();
      ctx.lineCap = 'butt';
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function rotulo(ctx, x, y, txt, cor) {
    const w = ctx.measureText(txt).width + 18;
    const W = ctx.canvas.clientWidth;
    const xx = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, x));
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = cor;
    ctx.lineWidth = 2;
    Util.retArredondado(ctx, xx - w / 2, y - 12, w, 24, 12);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = cor;
    ctx.fillText(txt, xx, y + 1);
  }

  // ---------- Missões e histórico ----------
  function atualizarMissoes() {
    const ul = $('#missoes');
    ul.innerHTML = DADOS.missoes.map((m) => {
      const feita = missoesFeitas.has(m.id);
      return `<li class="${feita ? 'feita' : ''}"><span class="check">${feita ? '✅' : '⬜'}</span>
        <div><strong>${m.titulo}</strong><span class="d">${m.desc}</span></div></li>`;
    }).join('');
    $('#contMissoes').textContent = `${missoesFeitas.size}/${DADOS.missoes.length}`;
  }

  function atualizarHistorico() {
    const ul = $('#historico');
    if (!historico.length) {
      ul.innerHTML = '<li class="vazio">Nenhum lançamento ainda. Monte seu foguete e aperte LANÇAR!</li>';
      return;
    }
    const recorde = Math.max(...historico.map((h) => h.apogeu));
    ul.innerHTML = '';
    historico.forEach((h, i) => {
      const li = document.createElement('li');
      if (h.apogeu === recorde && recorde > 0) li.className = 'recorde';
      li.innerHTML = `<button type="button" title="Carregar este foguete na oficina">
        <span class="bolinha" style="background:${h.cor}"></span>
        <span class="nm">${h.apogeu === recorde && recorde > 0 ? '🏆 ' : ''}${escapar(h.nome)}</span>
        <span>${h.emoji}</span><span class="alt">${Formato.metros(h.apogeu)}</span></button>`;
      li.querySelector('button').addEventListener('click', () => {
        cfg = { ...PADRAO, ...h.cfg };
        Util.salvar('of_projeto', cfg);
        $('#nome').value = cfg.nome;
        atualizarPainel(); atualizarCores(); atualizarBancada();
        aviso(`Foguete "${h.nome}" carregado na oficina 🔧`);
      });
      ul.appendChild(li);
    });
  }

  const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Lançamento ----------
  function lancar() {
    const sim = Fisica.simular(cfg);
    ultimoSim = sim;
    const voo = $('#voo');
    voo.hidden = false;
    $('#resultado').hidden = true;
    $('#faseTexto').classList.remove('ver');
    $('#btnVel').textContent = '⏩ 1×';
    if (cena) cena.parar();
    let timerFase = null;
    cena = new CenaVoo($('#ceu'), sim, { ...cfg }, {
      hud: (h) => {
        $('#hudAlt').textContent = Formato.metros(Math.max(0, h.alt));
        $('#hudVel').textContent = Formato.kmh(h.vel);
        $('#hudT').textContent = `${Formato.num(h.t, 1)} s`;
        $('#acelerado').hidden = !h.acelerado;
      },
      fase: (txt) => {
        const el = $('#faseTexto');
        el.textContent = txt;
        el.classList.add('ver');
        clearTimeout(timerFase);
        timerFase = setTimeout(() => el.classList.remove('ver'), 2600);
      },
      contagem: (txt) => {
        const el = $('#contagem');
        if (el.textContent !== (txt || '')) {
          el.textContent = txt || '';
          el.classList.remove('pulso'); void el.offsetWidth; el.classList.add('pulso');
        }
      },
      fim: () => terminarVoo(sim),
    });
    cena.iniciar();
  }

  function sairVoo() {
    if (cena) { cena.parar(); cena = null; }
    $('#voo').hidden = true;
    $('#contagem').textContent = '';
    atualizarBancada();
  }

  function terminarVoo(sim) {
    const r = sim.resumo;
    const novas = DADOS.missoes.filter((m) => !missoesFeitas.has(m.id) && m.check(r, cfg));
    novas.forEach((m) => missoesFeitas.add(m.id));
    Util.salvar('of_missoes', [...missoesFeitas]);

    const emoji = !r.decolou ? '😮' : r.vPouso > 10 ? '💥' : r.ovoQuebrou ? '🍳' : r.vPouso > 5 ? '🤕' : '✅';
    historico.unshift({ nome: cfg.nome || 'Foguete', cor: cfg.cor, cfg: { ...cfg }, apogeu: r.apogeu, emoji });
    historico = historico.slice(0, 12);
    Util.salvar('of_hist', historico);
    atualizarMissoes();
    atualizarHistorico();
    mostrarResultado(sim, novas);
    if (novas.length) confete();
  }

  function comparacao(h) {
    if (h < 2) return '';
    const marcos = DADOS.marcos;
    let abaixo = null, acima = null;
    for (const m of marcos) {
      if (m.h <= h) abaixo = m;
      else { acima = m; break; }
    }
    let txt = abaixo ? `${abaixo.emoji} Mais alto que: <b>${abaixo.nome}</b> (${Formato.metros(abaixo.h)})!` : '';
    if (acima) txt += ` ${abaixo ? 'Faltaram' : 'Faltam'} <b>${Formato.metros(acima.h - h)}</b> para passar: ${acima.emoji} ${acima.nome}.`;
    return txt;
  }

  function gerarDicas(r, g) {
    const d = [];
    if (!r.decolou) {
      d.push('💪 O motor empurra menos do que o foguete pesa. Use um motor maior, um combustível mais forte, ou deixe o foguete mais leve (mais curto, mais fino, sem carga).');
      return d;
    }
    if (r.rodopiou) d.push('🌀 O foguete rodopiou porque o ⚖️ ponto de equilíbrio ficou atrás do 🎯 ponto do vento. Aletas maiores e bem lá atrás resolvem!');
    else if (r.balancou && g.estabilidade < 1) d.push('〰️ O foguete balançou no começo. Depois que o combustível queimou, o ⚖️ foi para a frente e ele ficou mais firme.');
    if (!r.temParaquedas && r.vPouso > 10) d.push('🪂 Sem paraquedas, o foguete cai rápido demais. Coloque um paraquedas para ele voltar inteiro!');
    else if (r.ovoQuebrou) d.push('🥚 O ovo quebra se chegar no chão a mais de 16 km/h. Um paraquedas maior desce mais devagar.');
    else if (r.temParaquedas && r.vPouso > 5) d.push('🪂 Desceu rápido demais. Um paraquedas maior deixa o pouso mais suave.');
    if (r.vento > 0 && r.distancia > 150) d.push('💨 O vento levou o foguete para longe! Paraquedas grande no vento faz o foguete viajar. Às vezes um menor é melhor.');
    if (g.estabilidade > 3 && r.vento > 0) d.push('🧭 Foguete estável demais vira contra o vento (efeito cata-vento) e sobe torto.');
    if (cfg.ponta === 'reta') d.push('🔺 A ponta reta freia muito no ar. Experimente uma ogiva!');
    if (g.empuxoPeso < 5) d.push('🐢 Saiu bem devagar da vareta. O ideal é o motor empurrar pelo menos 5× o peso do foguete.');
    if (!d.length && r.apogeu > 0) d.push('🔬 Ótimo voo! Agora mude só UMA coisa e lance de novo para ver o que acontece. É assim que os engenheiros testam.');
    return d.slice(0, 3);
  }

  function mostrarResultado(sim, novas) {
    const r = sim.resumo, g = sim.geo;
    let titulo, sub;
    if (!r.decolou) { titulo = 'Não decolou! 😮'; sub = 'O motor não teve força para levantar o foguete.'; }
    else if (r.vPouso > 10) { titulo = 'Voou, mas se espatifou! 💥'; sub = `Chegou ao chão a ${Formato.kmh(r.vPouso)}.`; }
    else if (r.ovoQuebrou) { titulo = 'Voou... mas o ovo quebrou! 🍳'; sub = 'Quase! Falta um pouso mais suave.'; }
    else if (r.rodopiou) { titulo = 'Que voo maluco! 🌀'; sub = 'O foguete rodopiou no ar.'; }
    else if (r.apogeu >= 300) { titulo = 'Voo incrível! 🎉'; sub = `O ${escapar(cfg.nome || 'foguete')} foi lá no alto!`; }
    else { titulo = 'Belo voo! 🚀'; sub = `O ${escapar(cfg.nome || 'foguete')} voltou para a base.`; }

    const pouso = !r.decolou ? '—' : r.vPouso > 10 ? 'Espatifou 💥' : r.vPouso > 5 ? 'Duro 🤕' : 'Suave ✅';
    const item = (rot, val, cls = '') => `<div class="res-item ${cls}"><div class="rot">${rot}</div><div class="val">${val}</div></div>`;
    const dicas = gerarDicas(r, g);

    const el = $('#resultado');
    el.innerHTML = `
      <h2>${titulo}</h2>
      <p class="sub">${sub}</p>
      <div class="res-grade">
        ${item('Altura máxima', Formato.metros(r.apogeu), 'destaque')}
        ${item('Velocidade máxima', Formato.kmh(r.vMax))}
        ${item('Tempo no ar', `${Formato.num(r.decolou ? r.tempoVoo : 0, 1)} s`)}
        ${item('Pouso', pouso)}
        <div class="eng" style="display:contents">
          ${item('Aceleração máx.', `${Formato.num(r.aMax, 1)} g`)}
          ${item('Saída da vareta', `${Formato.num(r.vSaidaRampa, 1)} m/s`)}
          ${item('Vel. de pouso', `${Formato.num(r.vPouso, 1)} m/s`)}
          ${item('Distância', Formato.metros(r.distancia))}
        </div>
      </div>
      ${r.decolou && r.apogeu >= 2 ? `<p class="comparacao">${comparacao(r.apogeu)}</p>` : ''}
      ${novas.length ? `<div class="res-missoes">🏆 Missão cumprida: ${novas.map((m) => m.titulo).join(' · ')}</div>` : ''}
      ${dicas.length ? `<ul class="res-dicas">${dicas.map((d) => `<li>${d}</li>`).join('')}</ul>` : ''}
      <div class="res-grafico eng"><canvas id="grafico"></canvas></div>
      <div class="res-botoes">
        <button type="button" class="btn-sec" id="resMelhorar">🔧 Melhorar o foguete</button>
        <button type="button" class="btn-pri" id="resDeNovo">🚀 Lançar de novo</button>
      </div>`;
    el.hidden = false;
    $('#faseTexto').classList.remove('ver');
    $('#resMelhorar').addEventListener('click', sairVoo);
    $('#resDeNovo').addEventListener('click', lancar);
    $('#resDeNovo').focus();
    if (modo === 'engenheiro' && r.decolou) desenharGrafico($('#grafico'), sim);
  }

  function desenharGrafico(cv, sim) {
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const a = sim.amostras;
    // Mostra a subida e o começo da descida (a descida de paraquedas é longa)
    const tFim = Math.min(a[a.length - 1].t, Math.max(sim.resumo.tApogeu * 2.2, 4));
    const pts = a.filter((p) => p.t <= tFim);
    const hMax = Math.max(1, ...pts.map((p) => p.y));
    const vMax = Math.max(1, ...pts.map((p) => Math.hypot(p.vx, p.vy)));
    const m = { e: 52, d: 56, t: 16, b: 28 };
    const X = (t) => m.e + t / tFim * (W - m.e - m.d);
    const Yh = (h) => H - m.b - h / hMax * (H - m.t - m.b);
    const Yv = (v) => H - m.b - v / vMax * (H - m.t - m.b);

    ctx.font = '700 11px Nunito, system-ui, sans-serif';
    ctx.strokeStyle = '#e3e9f5';
    ctx.fillStyle = '#6b7aa0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = m.t + i / 4 * (H - m.t - m.b);
      ctx.beginPath(); ctx.moveTo(m.e, y); ctx.lineTo(W - m.d, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillStyle = '#3a6ff7';
      ctx.fillText(Formato.metrosCurto(Math.round(hMax * (1 - i / 4))), m.e - 6, y + 4);
      ctx.textAlign = 'left'; ctx.fillStyle = '#e05f00';
      ctx.fillText(`${Formato.num(vMax * (1 - i / 4))} m/s`, W - m.d + 6, y + 4);
    }
    ctx.fillStyle = '#6b7aa0';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) ctx.fillText(`${Formato.num(tFim * i / 5, 1)} s`, X(tFim * i / 5), H - 8);

    const linha = (f, cor) => {
      ctx.strokeStyle = cor; ctx.lineWidth = 2.5;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(X(p.t), f(p)) : ctx.moveTo(X(p.t), f(p))));
      ctx.stroke();
    };
    linha((p) => Yv(Math.hypot(p.vx, p.vy)), '#ff7a1a');
    linha((p) => Yh(p.y), '#3a6ff7');
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3a6ff7'; ctx.fillText('— altura', m.e + 8, m.t + 12);
    ctx.fillStyle = '#e05f00'; ctx.fillText('— velocidade', m.e + 72, m.t + 12);
  }

  // ---------- Avisos e confete ----------
  function aviso(txt, tipo = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + tipo;
    t.textContent = txt;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  function confete() {
    const cores = ['#ff5a5f', '#ffd166', '#06d6a0', '#3a6ff7', '#ff7a1a', '#c77dff'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('div');
      c.className = 'confete';
      c.style.left = `${Math.random() * 100}vw`;
      c.style.background = cores[i % cores.length];
      c.style.animationDuration = `${2 + Math.random() * 2}s`;
      c.style.animationDelay = `${Math.random() * 0.6}s`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5000);
    }
  }

  // ---------- Modo ----------
  function aplicarModo() {
    document.body.classList.toggle('modo-explorador', modo === 'explorador');
    document.body.classList.toggle('modo-engenheiro', modo === 'engenheiro');
    document.querySelectorAll('.modo button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.modo === modo ? 'true' : 'false'));
    atualizarBancada();
  }

  // ---------- Início ----------
  function iniciar() {
    montarPainel();
    montarCores();
    const nome = $('#nome');
    nome.value = cfg.nome;
    nome.addEventListener('input', () => { cfg.nome = nome.value; Util.salvar('of_projeto', cfg); });

    document.querySelectorAll('.modo button').forEach((b) => b.addEventListener('click', () => {
      modo = b.dataset.modo;
      Util.salvar('of_modo', modo);
      aplicarModo();
    }));

    $('#lancar').addEventListener('click', lancar);
    $('#btnSair').addEventListener('click', sairVoo);
    $('#btnPular').addEventListener('click', () => cena && cena.pular());
    $('#btnVel').addEventListener('click', () => {
      if (!cena) return;
      $('#btnVel').textContent = `⏩ ${cena.alternarVelocidade()}×`;
    });
    $('#recomecar').addEventListener('click', () => {
      if (!confirm('Apagar todas as missões e lançamentos deste computador?')) return;
      missoesFeitas = new Set();
      historico = [];
      Util.salvar('of_missoes', []);
      Util.salvar('of_hist', []);
      atualizarMissoes();
      atualizarHistorico();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('#voo').hidden) sairVoo();
    });
    window.addEventListener('resize', () => atualizarBancada());

    aplicarModo();
    atualizarMissoes();
    atualizarHistorico();
    // Redesenha quando a fonte terminar de carregar
    if (document.fonts) document.fonts.ready.then(() => atualizarBancada());
  }

  iniciar();
})();
