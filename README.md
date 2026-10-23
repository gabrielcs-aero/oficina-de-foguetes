# 🚀 Oficina de Foguetes

Simulador de foguetes para crianças: elas montam o foguete (corpo, ponta, aletas, motor, carga,
paraquedas), lançam e veem o voo animado, com missões e dicas que explicam o que aconteceu.

## Como abrir

É um site estático, sem instalação e sem internet obrigatória:

- **Direto do computador / pendrive:** abra `index.html` no navegador (Chrome, Edge ou Firefox).
- **Na internet (grátis):** suba a pasta no GitHub e ative o *GitHub Pages*, ou arraste a pasta no
  [Netlify Drop](https://app.netlify.com/drop).

O progresso (missões e lançamentos) fica salvo só naquele navegador. O botão "Recomeçar do zero"
limpa tudo para a próxima turma.

## Modos

- **Explorador:** linguagem simples, ícones, sem fórmulas. Para os menores.
- **Engenheiro:** mostra CG/CP em cm, margem em calibres, classe do motor, Cd, Isp, gráfico de
  altura e velocidade e inclinação da vareta.

## A física (js/physics.js)

Baseada nos mesmos métodos do OpenRocket:

- **Estabilidade:** equações de Barrowman para o centro de pressão (ponta + aletas) e soma das massas
  das peças para o centro de massa. Margem estática em calibres = (CP − CG) / diâmetro.
- **Arrasto:** atrito de superfície (Reynolds), arrasto de pressão da ponta e das aletas, arrasto de
  base (menor com o motor ligado), correção de compressibilidade.
- **Motor:** impulso total I = mₚ · Isp · g₀, com curva de empuxo por tipo de combustível. O
  propelente queima e o CG se move para a frente durante o voo.
- **Voo:** simulação 2D com rotação (o foguete pode se endireitar, balançar ou rodopiar), vareta de
  lançamento de 1 m, vento com rajadas, atmosfera que fica mais fina com a altura.
- **Descida:** como no OpenRocket, depois do apogeu o foguete vira um ponto material: paraquedas
  (Cd 0,8), queda de nariz (estável) ou rodopiando (instável).

Referência de validação: um foguete parecido com o Estes Alpha III com motor C chega a ~360 m, na
faixa dos voos reais e das simulações do OpenRocket.

## Como mudar as coisas (js/data.js)

Tudo que aparece nas opções está em `js/data.js`: diâmetros, pontas, aletas, combustíveis
(Isp, curva de empuxo), tamanhos de motor, cargas, paraquedas, vento, cores, marcos de altura
mostrados no voo e as missões (cada missão é uma função `check`).

## Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | Estrutura da página |
| `css/style.css` | Visual |
| `js/data.js` | Peças, missões e marcos de altura |
| `js/physics.js` | Geometria, aerodinâmica e simulação |
| `js/draw.js` | Desenho do foguete |
| `js/flight.js` | Animação do lançamento |
| `js/app.js` | Painel, números, resultados, missões |
