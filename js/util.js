// Pequenos utilitários de formatação e desenho.

const Formato = {
  num(v, casas = 0) {
    return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  },
  metros(h) {
    if (h >= 1000) return `${Formato.num(h / 1000, h >= 10000 ? 0 : 1)} km`;
    return `${Formato.num(h, h < 10 ? 1 : 0)} m`;
  },
  metrosCurto(h) {
    if (h >= 1000) return `${Formato.num(h / 1000, h % 1000 === 0 ? 0 : 1)} km`;
    return `${Formato.num(h, h < 10 && h % 1 !== 0 ? 1 : 0)} m`;
  },
  kmh(v) { return `${Formato.num(v * 3.6)} km/h`; },
  gramas(kg) { return kg >= 1 ? `${Formato.num(kg, 2)} kg` : `${Formato.num(kg * 1000)} g`; },
  cm(m) { return `${Formato.num(m * 100, 1)} cm`; },
};

const Util = {
  retArredondado(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
  ler(chave, padrao) {
    try {
      const v = localStorage.getItem(chave);
      return v ? JSON.parse(v) : padrao;
    } catch { return padrao; }
  },
  salvar(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* sem armazenamento: tudo bem */ }
  },
};
