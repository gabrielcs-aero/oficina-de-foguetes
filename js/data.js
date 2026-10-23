// Dados do simulador: peças do foguete, motores, cargas, missões e marcos de altura.
// Unidades internas sempre em SI (metros, quilogramas, segundos).

const DADOS = {
  diametros: [
    { id: 'fino', nome: 'Fino', d: 0.025, rotulo: '2,5 cm' },
    { id: 'medio', nome: 'Médio', d: 0.05, rotulo: '5 cm' },
    { id: 'largo', nome: 'Largo', d: 0.075, rotulo: '7,5 cm' },
  ],

  comprimento: { min: 0.2, max: 1.0, passo: 0.05, padrao: 0.4 },

  // fatorComp: comprimento da ponta em diâmetros
  // cpFrac: posição do centro de pressão da ponta (fração do comprimento, Barrowman)
  // cgFrac: centro de massa da ponta (casca)
  // cdPressao: arrasto de pressão da ponta (subsônico)
  pontas: [
    { id: 'conica', nome: 'Pontuda', fatorComp: 3, cpFrac: 0.666, cgFrac: 0.66, cdPressao: 0.05, cn: 2,
      dica: 'Corta o ar como uma flecha.' },
    { id: 'ogiva', nome: 'Ogiva', fatorComp: 3, cpFrac: 0.466, cgFrac: 0.6, cdPressao: 0.01, cn: 2,
      dica: 'Curvinha suave: é a que menos freia no ar.' },
    { id: 'redonda', nome: 'Redonda', fatorComp: 1.2, cpFrac: 0.333, cgFrac: 0.55, cdPressao: 0.03, cn: 2,
      dica: 'Curta e arredondada, como uma bala.' },
    { id: 'reta', nome: 'Reta', fatorComp: 0, cpFrac: 0, cgFrac: 0, cdPressao: 0.75, cn: 0,
      dica: 'Sem ponta! O ar bate de frente e freia muito.' },
  ],

  // Medidas das aletas em diâmetros do corpo: raiz, ponta, envergadura e enflechamento
  aletas: [
    { id: 'nenhuma', nome: 'Sem aletas', cr: 0, ct: 0, s: 0, sweep: 0 },
    { id: 'pequena', nome: 'Pequenas', cr: 1.0, ct: 0.5, s: 0.7, sweep: 0.5 },
    { id: 'media', nome: 'Médias', cr: 1.5, ct: 0.75, s: 1.1, sweep: 0.8 },
    { id: 'grande', nome: 'Grandes', cr: 2.2, ct: 1.0, s: 1.6, sweep: 1.3 },
  ],

  numAletas: [3, 4],

  posicoesAletas: [
    { id: 'tras', nome: 'Atrás' },
    { id: 'meio', nome: 'No meio' },
    { id: 'frente', nome: 'Na frente' },
  ],

  // isp: impulso específico (s); fatorCasco multiplica a massa do motor vazio;
  // curva: formato do empuxo ao longo da queima (normalizado depois)
  combustiveis: [
    { id: 'polvora', nome: 'Pólvora negra', emoji: '🌑', isp: 84, fatorCasco: 1, tempoBase: 1.7, forca: 1,
      curva: [[0, 0], [0.04, 0.6], [0.1, 2.7], [0.17, 1.7], [0.26, 0.85], [0.85, 0.8], [1, 0]],
      dica: 'A mais simples. Usada nos motores de foguetemodelo de loja.' },
    { id: 'composito', nome: 'Compósito', emoji: '🔶', isp: 180, fatorCasco: 1.15, tempoBase: 1.4, forca: 2,
      curva: [[0, 0], [0.03, 1.15], [0.2, 1.1], [0.8, 1.0], [1, 0]],
      dica: 'Combustível sólido forte, do mesmo tipo usado no foguete brasileiro VLS.' },
    { id: 'liquido', nome: 'Líquido', emoji: '💧', isp: 260, fatorCasco: 2.3, tempoBase: 2.2, forca: 3,
      curva: [[0, 0], [0.06, 1.0], [0.94, 1.0], [1, 0]],
      dica: 'Querosene + oxigênio, como o Falcon 9. Rende mais, mas o motor (tanques e bombas) é pesado.' },
  ],

  // Tamanho do motor: massa de propelente, massa do motor vazio, diâmetro e comprimento
  motores: [
    { id: 'pequeno', nome: 'Pequeno', prop: 0.006, casco: 0.009, d: 0.018, comp: 0.07 },
    { id: 'medio', nome: 'Médio', prop: 0.012, casco: 0.012, d: 0.018, comp: 0.07 },
    { id: 'grande', nome: 'Grande', prop: 0.024, casco: 0.022, d: 0.024, comp: 0.095 },
    { id: 'gigante', nome: 'Gigante', prop: 0.048, casco: 0.045, d: 0.029, comp: 0.12 },
  ],

  cargas: [
    { id: 'nada', nome: 'Nada', emoji: '∅', massa: 0, dMin: 0 },
    { id: 'astronauta', nome: 'Astronauta', emoji: '🧑‍🚀', massa: 0.015, dMin: 0 },
    { id: 'ovo', nome: 'Ovo', emoji: '🥚', massa: 0.06, dMin: 0.045, fragil: true },
    { id: 'satelite', nome: 'Minissatélite', emoji: '🛰️', massa: 0.1, dMin: 0.045 },
  ],

  paraquedas: [
    { id: 'nenhum', nome: 'Nenhum', diametro: 0, massa: 0 },
    { id: 'pequeno', nome: 'Pequeno', diametro: 0.3, massa: 0.008 },
    { id: 'grande', nome: 'Grande', diametro: 0.6, massa: 0.018 },
    { id: 'gigante', nome: 'Gigante', diametro: 0.9, massa: 0.03 },
  ],

  ventos: [
    { id: 'calmo', nome: 'Calmo', emoji: '😌', v: 0 },
    { id: 'brisa', nome: 'Brisa', emoji: '🍃', v: 3 },
    { id: 'ventania', nome: 'Ventania', emoji: '💨', v: 8 },
  ],

  cores: ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#8e44ad', '#f1f1f1', '#2b2d42', '#ffd166'],

  // Marcos de altura mostrados durante o voo
  marcos: [
    { h: 2, nome: 'Uma pessoa adulta', emoji: '🧍' },
    { h: 8, nome: 'Casa de dois andares', emoji: '🏠' },
    { h: 20, nome: 'Árvore bem alta', emoji: '🌳' },
    { h: 38, nome: 'Cristo Redentor', emoji: '✝️' },
    { h: 100, nome: 'Campo de futebol (em pé!)', emoji: '⚽' },
    { h: 140, nome: 'Edifício Copan', emoji: '🏢' },
    { h: 330, nome: 'Torre Eiffel', emoji: '🗼' },
    { h: 396, nome: 'Pão de Açúcar', emoji: '⛰️' },
    { h: 828, nome: 'Burj Khalifa, o prédio mais alto do mundo', emoji: '🏙️' },
    { h: 1500, nome: 'Nuvens baixas', emoji: '☁️' },
    { h: 2995, nome: 'Pico da Neblina, o ponto mais alto do Brasil', emoji: '🏔️' },
    { h: 10000, nome: 'Avião de passageiros', emoji: '✈️' },
    { h: 100000, nome: 'Espaço (linha de Kármán)', emoji: '🌌' },
  ],

  // Missões: check(r, cfg) recebe o resumo do voo e a configuração
  missoes: [
    { id: 'decolar', titulo: 'Decolagem!', desc: 'Faça seu foguete sair do chão.',
      check: (r) => r.decolou },
    { id: 'cristo', titulo: 'Acima do Cristo', desc: 'Voe mais alto que o Cristo Redentor (38 m).',
      check: (r) => r.apogeu >= 38 },
    { id: 'cem', titulo: 'Cem metros', desc: 'Chegue a 100 metros de altura.',
      check: (r) => r.apogeu >= 100 },
    { id: 'pouso', titulo: 'Pouso perfeito', desc: 'Passe de 50 m e pouse devagar, sem estragar o foguete.',
      check: (r) => r.apogeu >= 50 && r.vPouso <= 5 },
    { id: 'rodopio', titulo: 'Cientista curioso', desc: 'Lance um foguete instável e veja o que acontece.',
      check: (r) => r.decolou && r.estabilidade < 0 },
    { id: 'ovo', titulo: 'Missão Ovo', desc: 'Leve o ovo acima de 50 m e traga ele de volta sem quebrar.',
      check: (r, c) => c.carga === 'ovo' && r.apogeu >= 50 && !r.ovoQuebrou },
    { id: 'economico', titulo: 'Engenheiro econômico', desc: 'Passe de 100 m usando o motor pequeno.',
      check: (r, c) => c.motor === 'pequeno' && r.apogeu >= 100 },
    { id: 'veloz', titulo: 'Mais rápido que a Fórmula 1', desc: 'Passe de 360 km/h.',
      check: (r) => r.vMax * 3.6 >= 360 },
    { id: 'paodeacucar', titulo: 'Acima do Pão de Açúcar', desc: 'Voe mais alto que 396 m.',
      check: (r) => r.apogeu >= 396 },
    { id: 'satelite', titulo: 'Missão Satélite', desc: 'Leve o minissatélite acima de 300 m e pouse com segurança.',
      check: (r, c) => c.carga === 'satelite' && r.apogeu >= 300 && r.vPouso <= 5 },
    { id: 'quilometro', titulo: 'Um quilômetro!', desc: 'Chegue a 1000 metros de altura.',
      check: (r) => r.apogeu >= 1000 },
  ],
};

if (typeof module !== 'undefined') module.exports = DADOS;
