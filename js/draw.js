// Desenho do foguete em vista lateral. Coordenadas locais em metros:
// a ponta fica em x = 0, a cauda em x = L, o eixo do foguete em y = 0.

const Desenho = (() => {
  function clarear(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
    else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  // Raio da ponta a uma distância x da ponta
  function raioPonta(geo, x) {
    const { Ln, R } = geo;
    const f = x / Ln;
    if (geo.ponta.id === 'conica') return R * f;
    if (geo.ponta.id === 'ogiva') {
      const rho = (R * R + Ln * Ln) / (2 * R); // ogiva tangente
      return Math.max(0, Math.sqrt(rho * rho - (Ln - x) ** 2) + R - rho);
    }
    return R * Math.sqrt(Math.max(0, 1 - (1 - f) ** 2)); // elipsoide
  }

  function aleta(ctx, geo, sinal, fatorEnv) {
    const { xf, Cr, Ct, s, sweep, R } = geo;
    const e = s * fatorEnv;
    ctx.beginPath();
    ctx.moveTo(xf, sinal * R);
    ctx.lineTo(xf + sweep, sinal * (R + e));
    ctx.lineTo(xf + sweep + Ct, sinal * (R + e));
    ctx.lineTo(xf + Cr, sinal * R);
    ctx.closePath();
  }

  // opts: { cor, empuxo (0..1), mostrarJanela, emojiCarga, contorno (largura em px), escalaPx }
  function foguete(ctx, geo, opts = {}) {
    const cor = opts.cor || '#e63946';
    const { L, Ln, Lb, R, D } = geo;
    const px = opts.escalaPx || 400; // pixels por metro (para espessura de linhas)
    const lw = (opts.contorno || 1.5) / px;
    const corAleta = clarear(cor, -0.25);
    const borda = 'rgba(20,25,45,0.85)';

    // Chama
    if (opts.empuxo > 0) {
      const comp = D * (2.5 + 5 * opts.empuxo) * (0.85 + Math.random() * 0.3);
      const larg = geo.mot.d * 0.55;
      const x0 = L + 0.01;
      const grad = ctx.createLinearGradient(x0, 0, x0 + comp, 0);
      grad.addColorStop(0, 'rgba(255,255,220,1)');
      grad.addColorStop(0.25, 'rgba(255,210,60,0.95)');
      grad.addColorStop(0.6, 'rgba(255,110,20,0.75)');
      grad.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x0, -larg);
      ctx.quadraticCurveTo(x0 + comp * 0.35, -larg * 1.4, x0 + comp, 0);
      ctx.quadraticCurveTo(x0 + comp * 0.35, larg * 1.4, x0, larg);
      ctx.closePath();
      ctx.fill();
    }

    // Aletas (atrás do corpo)
    ctx.lineWidth = lw;
    ctx.strokeStyle = borda;
    ctx.lineJoin = 'round';
    if (geo.temAletas) {
      ctx.fillStyle = corAleta;
      aleta(ctx, geo, -1, 1); ctx.fill(); ctx.stroke();
      aleta(ctx, geo, 1, geo.N === 4 ? 1 : 0.5); ctx.fill(); ctx.stroke();
    }

    // Bocal do motor
    ctx.fillStyle = '#3a3d46';
    const rm = geo.mot.d / 2;
    ctx.fillRect(L - 0.002, -rm * 0.8, 0.012, rm * 1.6);
    ctx.strokeRect(L - 0.002, -rm * 0.8, 0.012, rm * 1.6);

    // Corpo com sombreado
    const grad = ctx.createLinearGradient(0, -R, 0, R);
    grad.addColorStop(0, clarear(cor, 0.45));
    grad.addColorStop(0.35, cor);
    grad.addColorStop(1, clarear(cor, -0.4));
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (Ln > 0) {
      const n = 24;
      ctx.moveTo(0, 0);
      for (let i = 1; i <= n; i++) ctx.lineTo(i / n * Ln, -raioPonta(geo, i / n * Ln));
      ctx.lineTo(L, -R);
      ctx.lineTo(L, R);
      for (let i = n; i >= 1; i--) ctx.lineTo(i / n * Ln, raioPonta(geo, i / n * Ln));
    } else {
      ctx.moveTo(0, -R); ctx.lineTo(L, -R); ctx.lineTo(L, R); ctx.lineTo(0, R);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Faixa decorativa
    const corFaixa = cor === '#f1f1f1' || cor === '#ffd166' ? '#2b2d42' : '#ffffff';
    ctx.fillStyle = corFaixa;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(Ln + Lb * 0.06, -R + lw, Math.max(D * 0.25, Lb * 0.03), D - 2 * lw);
    ctx.fillRect(L - Math.max(D * 0.35, Lb * 0.05), -R + lw, D * 0.12, D - 2 * lw);
    ctx.globalAlpha = 1;

    // Aleta de frente (vista de lado aparece como uma faixa fina)
    if (geo.temAletas && geo.N === 4) {
      ctx.fillStyle = corAleta;
      ctx.fillRect(geo.xf, -geo.tAleta / 2, geo.Cr, geo.tAleta);
    }

    // Janelinha com a carga
    if (opts.mostrarJanela && opts.emojiCarga) {
      const xj = Ln + Math.min(D, Lb * 0.25);
      const rj = R * 0.62;
      ctx.fillStyle = '#d9f1ff';
      ctx.beginPath(); ctx.arc(xj, 0, rj, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = lw * 2;
      ctx.strokeStyle = '#cfd6e4';
      ctx.stroke();
      ctx.save();
      ctx.translate(xj, 0);
      ctx.scale(1 / px, 1 / px);
      ctx.font = `${Math.max(6, rj * px * 1.35)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.emojiCarga, 0, rj * px * 0.08);
      ctx.restore();
    }
  }

  // Símbolo do centro de massa (círculo em quadrantes preto/branco)
  function simboloCG(ctx, x, y, r) {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d2b53';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, -Math.PI / 2, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, Math.PI / 2, Math.PI); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1d2b53';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function simboloCP(ctx, x, y, r) {
    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#e01e37';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e01e37';
    ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  return { foguete, simboloCG, simboloCP, clarear };
})();
