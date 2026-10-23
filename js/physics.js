// Física do foguete: geometria, massas, aerodinâmica (método de Barrowman, como no OpenRocket)
// e uma simulação de voo 2D com rotação (o foguete pode se estabilizar ou rodopiar).

const Fisica = (() => {
  const D_ = typeof DADOS !== 'undefined' ? DADOS : require('./data.js');
  const G0 = 9.80665;
  const COMPRIMENTO_RAMPA = 1.0; // vareta de lançamento (m)
  const CD_PARAQUEDAS = 0.8;
  const DENS_BALSA = 160; // kg/m³
  const ATRASOS = [3, 4, 5, 6, 7, 8]; // atrasos de ejeção de motores de loja (s)
  const DESALINHAMENTO = 0.2 * Math.PI / 180; // empuxo levemente torto (rad), típico de motor de loja

  const porId = (lista, id) => lista.find((o) => o.id === id) || lista[0];

  // Converte a curva de empuxo em uma função normalizada (integral = 1 em τ ∈ [0, 1])
  function curvaNormalizada(pontos) {
    let area = 0;
    for (let i = 1; i < pontos.length; i++) {
      area += (pontos[i][0] - pontos[i - 1][0]) * (pontos[i][1] + pontos[i - 1][1]) / 2;
    }
    return (tau) => {
      if (tau <= 0 || tau >= 1) return 0;
      for (let i = 1; i < pontos.length; i++) {
        if (tau <= pontos[i][0]) {
          const [t0, f0] = pontos[i - 1];
          const [t1, f1] = pontos[i];
          return (f0 + (f1 - f0) * (tau - t0) / (t1 - t0)) / area;
        }
      }
      return 0;
    };
  }

  function classeMotor(impulso) {
    const classes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    if (impulso <= 1.25) return '½A';
    let limite = 2.5;
    for (const c of classes) {
      if (impulso <= limite) return c;
      limite *= 2;
    }
    return 'J';
  }

  function cabeMotor(diamCorpo, idMotor) {
    return porId(D_.motores, idMotor).d <= diamCorpo - 0.0008;
  }

  function cabeCarga(diamCorpo, idCarga) {
    return diamCorpo >= porId(D_.cargas, idCarga).dMin;
  }

  // ---------- Geometria, massas e aerodinâmica do projeto ----------
  function analisar(cfg) {
    const D = porId(D_.diametros, cfg.diametro).d;
    const R = D / 2;
    const A = Math.PI * R * R;
    const ponta = porId(D_.pontas, cfg.ponta);
    const aleta = porId(D_.aletas, cfg.aletas);
    const comb = porId(D_.combustiveis, cfg.combustivel);
    const mot = porId(D_.motores, cfg.motor);
    const carga = porId(D_.cargas, cfg.carga);
    const para = porId(D_.paraquedas, cfg.paraquedas);
    const N = cfg.numAletas || 3;

    const Ln = ponta.fatorComp * D;
    const Lb = cfg.comprimento;
    const L = Ln + Lb;

    // Aletas (limitadas ao tamanho do corpo)
    let Cr = aleta.cr * D, Ct = aleta.ct * D, s = aleta.s * D, sweep = aleta.sweep * D;
    const temAletas = Cr > 0;
    if (temAletas && Cr > Lb * 0.9) {
      const k = (Lb * 0.9) / Cr;
      Cr *= k; Ct *= k; s *= k; sweep *= k;
    }
    let xf = 0;
    if (cfg.posAletas === 'meio') xf = Ln + Lb / 2 - Cr / 2;
    else if (cfg.posAletas === 'frente') xf = Ln + 0.01;
    else xf = L - Cr;
    const tAleta = 0.0025 + 0.02 * D;
    const areaAleta = temAletas ? s * (Cr + Ct) / 2 : 0;

    // --- Massas (cada peça: massa e posição a partir da ponta) ---
    const pecas = [];
    const sigmaTubo = 0.25 + 3 * D; // kg/m² do tubo de papelão
    const mTubo = sigmaTubo * Math.PI * D * Lb;
    if (Ln > 0) {
      pecas.push({ nome: 'Ponta', m: 9.6 * D * D * (0.4 + 0.6 * ponta.fatorComp / 3), x: ponta.cgFrac * Ln });
    } else {
      pecas.push({ nome: 'Tampa', m: 2.5 * D * D, x: 0.003 });
    }
    pecas.push({ nome: 'Corpo', m: mTubo, x: Ln + Lb / 2 });
    if (temAletas) {
      const xcAleta = (sweep * (Cr + 2 * Ct) + (Cr * Cr + Cr * Ct + Ct * Ct)) / (3 * (Cr + Ct));
      pecas.push({ nome: 'Aletas', m: N * areaAleta * tAleta * DENS_BALSA, x: xf + xcAleta });
    }
    const xMotor = L - mot.comp / 2 + 0.01; // motor sobra 1 cm para fora
    pecas.push({ nome: 'Suporte do motor', m: 0.003 + 0.1 * D, x: L - mot.comp / 2 });
    const mCasco = mot.casco * comb.fatorCasco;
    pecas.push({ nome: 'Motor (vazio)', m: mCasco, x: xMotor });
    if (para.massa > 0) pecas.push({ nome: 'Paraquedas', m: para.massa, x: Ln + Math.min(2 * D, Lb * 0.4) });
    if (carga.massa > 0) pecas.push({ nome: 'Carga', m: carga.massa, x: Ln + Math.min(D, Lb * 0.25) });
    // cola, tinta, anel de lançamento: +6% da estrutura
    const mEstrutura = pecas.reduce((a, p) => a + p.m, 0);
    pecas.push({ nome: 'Cola e tinta', m: mEstrutura * 0.06, x: L / 2 });

    const mSeca = pecas.reduce((a, p) => a + p.m, 0);
    const momSeca = pecas.reduce((a, p) => a + p.m * p.x, 0);
    const mProp = mot.prop;

    const massaEm = (mp) => mSeca + mp;
    const cgEm = (mp) => (momSeca + mp * xMotor) / (mSeca + mp);
    const inerciaEm = (mp) => {
      const cg = cgEm(mp);
      let I = mTubo * Lb * Lb / 12 + mp * (xMotor - cg) ** 2 + mp * mot.comp * mot.comp / 12;
      for (const p of pecas) I += p.m * (p.x - cg) ** 2;
      return I;
    };

    // --- Aerodinâmica (Barrowman) ---
    const componentesCN = [];
    if (ponta.cn > 0) componentesCN.push({ cn: ponta.cn, x: ponta.cpFrac * Ln });
    if (temAletas) {
      const Lf = Math.sqrt(s * s + (sweep + Ct / 2 - Cr / 2) ** 2);
      const cnF = (1 + R / (s + R)) * (4 * N * (s / D) ** 2) / (1 + Math.sqrt(1 + (2 * Lf / (Cr + Ct)) ** 2));
      const xcp = xf + sweep * (Cr + 2 * Ct) / (3 * (Cr + Ct)) + ((Cr + Ct) - Cr * Ct / (Cr + Ct)) / 6;
      componentesCN.push({ cn: cnF, x: xcp });
    }
    const cnTotal = componentesCN.reduce((a, c) => a + c.cn, 0);
    const xcp = cnTotal > 1e-6 ? componentesCN.reduce((a, c) => a + c.cn * c.x, 0) / cnTotal : L / 2;
    const cg0 = cgEm(mProp);
    const estabilidade = (xcp - cg0) / D; // em calibres

    // Arrasto axial (Cd referido à área frontal A)
    const areaMolhadaPonta = Ln > 0 ? Math.PI * R * Math.sqrt(R * R + Ln * Ln) * (ponta.id === 'conica' ? 1 : 1.1) : 0;
    const areaMolhadaCorpo = Math.PI * D * Lb + areaMolhadaPonta;
    const finura = L / D;
    // Área vista de lado e seu centro (usado quando o foguete voa muito de lado ou rodopia)
    const xcAletaPlanta = temAletas ? xf + (sweep * (Cr + 2 * Ct) + (Cr * Cr + Cr * Ct + Ct * Ct)) / (3 * (Cr + Ct)) : 0;
    const partesPlanta = [
      { a: D * Lb, x: Ln + Lb / 2 },
      { a: 0.6 * D * Ln, x: 0.62 * Ln },
      { a: temAletas ? 2 * areaAleta : 0, x: xcAletaPlanta },
    ];
    const areaPlanta = partesPlanta.reduce((a, p) => a + p.a, 0);
    const xPlanta = partesPlanta.reduce((a, p) => a + p.a * p.x, 0) / areaPlanta;

    function cdAxial(v, mach, queimando) {
      const Re = Math.max(2e5, v * L / 1.5e-5);
      const Cf = 0.074 / Math.pow(Re, 0.2) + 0.001; // turbulento + rugosidade da tinta
      const cdAtrito = Cf * ((1 + 1 / (2 * finura)) * areaMolhadaCorpo +
        (temAletas ? (1 + 2 * tAleta / ((Cr + Ct) / 2)) * 2 * N * areaAleta : 0)) / A;
      const cdAletas = temAletas ? 0.4 * N * tAleta * s / A : 0;
      const fatorBase = queimando ? Math.max(0, 1 - (mot.d / D) ** 2) : 1;
      const cdBase = (0.12 + 0.13 * mach * mach) * fatorBase;
      let cdPressao = ponta.cdPressao + cdAletas;
      const m = Math.min(mach, 0.8);
      cdPressao /= Math.sqrt(1 - m * m); // Prandtl-Glauert
      let cdOnda = 0;
      if (mach > 0.8) cdOnda = Math.min(0.6, (mach - 0.8) * 1.5) * (ponta.id === 'reta' ? 2 : 1);
      return (cdAtrito * 1.05 + cdPressao + cdBase + cdOnda);
    }

    // Motor
    const impulso = mProp * comb.isp * G0;
    const tQueima = comb.tempoBase * Math.cbrt(mProp / 0.012);
    const formato = curvaNormalizada(comb.curva);
    let fMax = 0;
    for (let i = 0; i <= 200; i++) fMax = Math.max(fMax, formato(i / 200));
    const empuxoMax = fMax * impulso / tQueima;
    const empuxo = (t) => (impulso / tQueima) * formato(t / tQueima);
    // Impulso já entregue até t (para consumir o propelente proporcionalmente)
    const impulsoAte = (() => {
      const n = 400, tab = [0];
      for (let i = 1; i <= n; i++) {
        const t0 = (i - 1) / n * tQueima, t1 = i / n * tQueima;
        tab.push(tab[i - 1] + (empuxo(t0) + empuxo(t1)) / 2 * (t1 - t0));
      }
      return (t) => {
        if (t <= 0) return 0;
        if (t >= tQueima) return impulso;
        const f = t / tQueima * n, i = Math.floor(f);
        return tab[i] + (tab[i + 1] - tab[i]) * (f - i);
      };
    })();

    const avisos = [];
    if (!cabeMotor(D, cfg.motor)) avisos.push('motor');
    if (!cabeCarga(D, cfg.carga)) avisos.push('carga');

    return {
      cfg, D, R, A, L, Ln, Lb, N, ponta, aleta, comb, mot, carga, para,
      Cr, Ct, s, sweep, xf, temAletas, tAleta,
      pecas, mSeca, mProp, massaEm, cgEm, inerciaEm, xMotor,
      componentesCN, cnTotal, xcp, cg0, estabilidade, areaPlanta, xPlanta,
      cdAxial, cd0: cdAxial(50, 0.15, false),
      impulso, tQueima, empuxo, empuxoMax, impulsoAte, classe: classeMotor(impulso),
      massaTotal: mSeca + mProp,
      empuxoPeso: empuxoMax / ((mSeca + mProp) * G0),
      avisos,
    };
  }

  // ---------- Atmosfera (ISA, troposfera) e vento ----------
  const altISA = (y) => Math.min(11000, Math.max(0, y));
  const densidade = (y) => 1.225 * Math.pow(1 - 2.2558e-5 * altISA(y), 4.2559);
  const somVel = (y) => Math.sqrt(1.4 * 287.05 * (288.15 - 0.0065 * altISA(y)));

  function ventoEm(v0, y, t) {
    if (v0 === 0) return 0;
    const alturaFator = Math.pow(Math.max(y, 1) / 10, 0.14);
    const rajada = 1 + 0.25 * Math.sin(t * 1.3) + 0.12 * Math.sin(t * 3.7 + 1);
    return v0 * alturaFator * rajada;
  }

  // ---------- Simulação ----------
  // Fases: 0 rampa, 1 voo motorizado, 2 voo livre, 3 paraquedas, 4 pousado, 5 queda livre sem paraquedas
  // cfg.atraso: atraso da carga de ejeção depois do fim da queima (s); 0 ou ausente = automático,
  // escolhe o atraso de loja mais perto do tempo de subida livre (como um foguetista faria pela tabela).
  function simular(cfg) {
    const g = analisar(cfg);
    let atraso = cfg.atraso, atrasoAuto = false;
    if (!(atraso > 0)) {
      const subida = simularCom(cfg, g, Infinity, true).resumo.tApogeu - g.tQueima;
      atraso = ATRASOS.reduce((a, b) => (Math.abs(b - subida) < Math.abs(a - subida) ? b : a));
      atrasoAuto = true;
    }
    const sim = simularCom(cfg, g, atraso, false);
    sim.resumo.atrasoAuto = atrasoAuto;
    return sim;
  }

  function simularCom(cfg, g, atraso, soAteApogeu) {
    const v0vento = porId(D_.ventos, cfg.vento).v;
    const anguloRampa = (90 - (cfg.angulo || 0)) * Math.PI / 180;
    const areaPara = g.para.diametro > 0 ? Math.PI * (g.para.diametro / 2) ** 2 : 0;
    const tEjecao = g.tQueima + atraso;
    const xBocal = g.L;

    let t = 0, x = 0, y = 0, vx = 0, vy = 0, th = anguloRampa, om = 0;
    let fase = 0, sRampa = 0;
    let tAbertura = -1, decolou = false, saiuRampa = false, passouApogeu = false;
    const amostras = [];
    const eventos = [];
    let apogeu = 0, tApogeu = 0, vMax = 0, aMax = 0, vSaidaRampa = 0, angMaxAtaque = 0, vEjecao = 0;
    let proximaAmostra = 0;
    const DT_AMOSTRA = 1 / 50;
    let vPouso = 0, xPouso = 0, tPouso = 0;
    let girosAcumulados = 0;
    let caiRodopiando = false;

    // Grandezas que só dependem da massa de propelente (constantes depois da queima)
    let mpCache = NaN, cg = 0, I = 0, amortAero = 0, amortGiro = 0;
    const atualizarMassa = (mp) => {
      if (mp === mpCache) return;
      mpCache = mp;
      cg = g.cgEm(mp);
      I = g.inerciaEm(mp);
      // amortecimento das aletas e da ponta (Barrowman): Σ CNα·(x − cg)²
      amortAero = 0;
      for (const c of g.componentesCN) amortAero += c.cn * (c.x - cg) ** 2;
      // corpo girando de lado (escoamento cruzado, Cd ≈ 1,1): ∫|r|³ dr dos dois lados do CG
      amortGiro = 1.1 * g.D * (cg ** 4 + (g.L - cg) ** 4) / 4;
    };

    const amostrar = (T) => {
      amostras.push({ t, x, y, vx, vy, th, fase, T, cg, chute: fase === 3 ? Math.min(1, (t - tAbertura) / 0.6) : 0 });
    };

    while (t < 900) {
      const T = g.empuxo(t);
      const mp = g.mProp * (1 - g.impulsoAte(t) / g.impulso);
      const m = g.massaEm(mp);
      atualizarMassa(mp);
      const rho = densidade(y);
      const w = ventoEm(v0vento, y, t);
      const queimando = t < g.tQueima;
      const dt = fase === 3 ? 0.01 : 0.0005;

      if (fase === 1 && !queimando) { fase = 2; eventos.push({ t, tipo: 'fimQueima', y }); }

      if (t >= proximaAmostra) { amostrar(T); proximaAmostra += DT_AMOSTRA; }

      if (fase === 0) {
        // Preso à vareta: só anda ao longo dela
        const v = Math.hypot(vx, vy);
        const cd = g.cdAxial(v, v / somVel(y), queimando);
        const arrasto = 0.5 * rho * v * v * g.A * cd;
        let a = (T - m * G0 * Math.sin(anguloRampa) - arrasto) / m;
        if (v <= 0 && a <= 0) a = 0;
        let vNovo = Math.max(0, v + a * dt);
        sRampa += vNovo * dt;
        vx = vNovo * Math.cos(anguloRampa);
        vy = vNovo * Math.sin(anguloRampa);
        x = sRampa * Math.cos(anguloRampa);
        y = sRampa * Math.sin(anguloRampa);
        // aceleração sentida (acelerômetro): sem a gravidade, igual ao voo livre
        if (vNovo > 0) aMax = Math.max(aMax, (T - arrasto) / m);
        if (vNovo > 0) decolou = true;
        if (sRampa >= COMPRIMENTO_RAMPA) {
          fase = queimando ? 1 : 2;
          saiuRampa = true;
          vSaidaRampa = vNovo;
          eventos.push({ t, tipo: 'saiuRampa', y });
        }
        if (!queimando && !decolou) break; // nunca decolou
        if (!queimando && sRampa < COMPRIMENTO_RAMPA && vNovo === 0 && decolou) {
          // subiu um pouco e escorregou de volta
          fase = 4; vPouso = 0; break;
        }
        t += dt;
        continue;
      }

      if (fase === 3 || fase === 5) {
        // Descida como ponto material (como o OpenRocket faz após a ejeção):
        // com paraquedas, de nariz para baixo (estável) ou rodopiando (instável)
        const vax = vx - w, vay = vy;
        const va = Math.hypot(vax, vay);
        let cdA;
        if (fase === 3) {
          const abre = Math.min(1, (t - tAbertura) / 0.6);
          cdA = CD_PARAQUEDAS * areaPara * abre + 0.6 * g.A + 0.3 * g.areaPlanta * 0.3;
        } else if (caiRodopiando) {
          cdA = 0.6 * g.areaPlanta;
        } else {
          cdA = g.cdAxial(va, va / somVel(y), false) * g.A;
        }
        // arrasto integrado de forma implícita: estável mesmo com paraquedas abrindo em alta velocidade
        const k = 0.5 * rho * va * cdA / m;
        vx = (vx + k * w * dt) / (1 + k * dt);
        vy = (vy - G0 * dt) / (1 + k * dt);
        x += vx * dt; y += vy * dt;
        // orientação apenas visual
        if (fase === 3) {
          // pendurado de lado: vai deitando aos poucos (o balanço fino é feito na animação, em tempo real)
          const alvo = Math.abs(th) > Math.PI / 2 ? Math.sign(th) * Math.PI : 0;
          th += (alvo - th) * Math.min(1, dt / 1.5);
        } else if (caiRodopiando) th += 5 * dt;
        else th = Math.atan2(vay, vax);
        t += dt;
        if (y <= 0) { y = 0; vPouso = Math.hypot(vx, vy); xPouso = x; tPouso = t; fase = 4; amostrar(0); break; }
        continue;
      }

      // Voo livre com rotação
      const vax = vx - w, vay = vy;
      const va = Math.hypot(vax, vay) || 1e-6;
      const ux = Math.cos(th), uy = Math.sin(th);
      const nx = -uy, ny = ux;
      const cosA = (ux * vax + uy * vay) / va;
      const sinA = (ux * vay - uy * vax) / va;
      const q = 0.5 * rho * va * va;
      const mach = va / somVel(y);
      const cd = g.cdAxial(va, mach, queimando);

      // acima de ~27° as aletas "estolam" e param de ganhar força
      const cnLin = g.cnTotal * Math.max(-0.45, Math.min(0.45, sinA));
      const cnCruz = 1.1 * (g.areaPlanta / g.A) * sinA * Math.abs(sinA);
      const fAxial = -q * g.A * cd * cosA;
      const fNormal = -q * g.A * (cnLin + cnCruz);
      // empuxo um pouquinho torto: é a perturbação real que tira um foguete instável do prumo
      const tx = Math.cos(th + DESALINHAMENTO), ty = Math.sin(th + DESALINHAMENTO);

      let fx = T * tx + fAxial * ux + fNormal * nx;
      let fy = T * ty + fAxial * uy + fNormal * ny - m * G0;

      let torque = q * g.A * (cnLin * (g.xcp - cg) + cnCruz * (g.xPlanta - cg));
      torque -= (xBocal - cg) * T * Math.sin(DESALINHAMENTO);
      torque -= 0.5 * rho * va * g.A * amortAero * om;
      torque -= 0.5 * rho * amortGiro * om * Math.abs(om);
      // amortecimento do jato: os gases saindo levam o giro embora (ṁ·(x_bocal − cg)²·ω)
      if (queimando) torque -= (g.mProp * T / g.impulso) * (xBocal - cg) ** 2 * om;

      const ax = fx / m, ay = fy / m;
      vx += ax * dt; vy += ay * dt;
      x += vx * dt; y += vy * dt;
      om += (torque / I) * dt;
      th += om * dt;
      if (vy > 0) girosAcumulados += Math.abs(om * dt);

      vMax = Math.max(vMax, Math.hypot(vx, vy));
      const subindo = vy > 0 && apogeu - y < 1;
      if (queimando) aMax = Math.max(aMax, (T + fAxial) / m);
      if (subindo && va > 5) angMaxAtaque = Math.max(angMaxAtaque, Math.abs(Math.atan2(sinA, cosA)));
      if (y > apogeu) { apogeu = y; tApogeu = t; }

      // Começou a descer com o motor já apagado
      if (!passouApogeu && vy < 0 && t > 0.3 && !queimando) {
        passouApogeu = true;
        if (soAteApogeu) break;
        if (areaPara === 0) {
          fase = 5;
          caiRodopiando = (g.xcp - cg) / g.D < 0.3 || angMaxAtaque > Math.PI / 2;
          eventos.push({ t, tipo: caiRodopiando ? 'quedaRodopiando' : 'quedaNariz', y });
        }
      }
      // Carga de ejeção: dispara no fim da queima + atraso, esteja o foguete onde estiver
      if (areaPara > 0 && fase !== 5 && t >= tEjecao) {
        fase = 3; tAbertura = t; vEjecao = Math.hypot(vx, vy);
        th = Math.atan2(Math.sin(th), Math.cos(th)); // desfaz as voltas acumuladas para não girar ao deitar
        eventos.push({ t, tipo: 'paraquedas', y, v: vEjecao, vy });
      }

      t += dt;
      if (y <= 0 && t > 0.2) {
        y = 0; vPouso = Math.hypot(vx, vy); xPouso = x; tPouso = t; fase = 4; amostrar(0); break;
      }
    }

    if (fase !== 4) { tPouso = t; fase = 4; amostrar(0); }
    if (saiuRampa) eventos.push({ t: tApogeu, tipo: 'apogeu', y: apogeu });
    eventos.push({ t: tPouso, tipo: 'pouso', y: 0 });
    eventos.sort((a, b) => a.t - b.t);

    const voouDeVerdade = decolou && saiuRampa;
    return {
      geo: g,
      amostras,
      eventos,
      resumo: {
        decolou: voouDeVerdade,
        apogeu: voouDeVerdade ? apogeu : 0,
        tApogeu, vMax, aMax: aMax / G0, vSaidaRampa,
        tempoVoo: tPouso, vPouso: voouDeVerdade ? vPouso : 0,
        distancia: Math.abs(xPouso),
        estabilidade: g.estabilidade,
        caiuRodopiando: caiRodopiando,
        balancou: angMaxAtaque > 0.25,
        rodopiou: angMaxAtaque > Math.PI / 2 || girosAcumulados > Math.PI * 3,
        angMaxAtaque,
        ovoQuebrou: g.carga.fragil ? (!voouDeVerdade ? false : vPouso > 4.5) : false,
        temParaquedas: areaPara > 0,
        paraquedasAbriu: tAbertura >= 0,
        atraso, tEjecao, vEjecao,
        vento: v0vento,
      },
    };
  }

  return { analisar, simular, porId, cabeMotor, cabeCarga, classeMotor, G0 };
})();

if (typeof module !== 'undefined') module.exports = Fisica;
