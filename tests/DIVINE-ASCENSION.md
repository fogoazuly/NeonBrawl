# Divine Ascension e cartas do Canhão de Gravidade

## Cartas exclusivas

- Event Horizon (incomum, 4 níveis): +20/40/60/80% no raio de atração.
- Unstable Collapse (rara, 3 níveis): +8/12/16% de dano na explosão por inimigo
  dentro do campo, limitado a cinco inimigos (+40/60/80%).
- Persistent Singularity (rara, 3 níveis): +0,6/1,2/1,8 s de duração.
- Absolute Singularity (Divine Ascension, nível único): habilita carga do ataque.

As definições suportam `requiresGun` e `requiresMelee` para futuras cartas.
Os filtros são aplicados a ofertas comuns, fallback, recompensas de chefe e loja.
Divine Ascension está acima de lendária, tem peso base 0,001 (lendária: 0,005),
chance de 1–3% por opção de chefe quando há carta divina elegível, e preço base
de 400 cristais na loja. Não aparece na seleção inicial limitada a raras.

## Carga e penalidades

Sem a carta divina, a arma mantém os disparos normais. Com a carta:
- Segurar acumula até 12 segundos de simulação, sem gastar munição durante a carga.
- Soltar antes disso dispara uma única esfera; dano cresce até 4× e os raios
  de atração/explosão até 2,5×. Não aplica penalidade.
- Ao completar 12 s, dispara automaticamente um buraco negro global de 10× dano,
  com duração base de 5 s. Consome um disparo e exige soltar o botão antes de reutilizar.
- Após o disparo global: 10 s de movimento -35%, intervalo entre tiros +50% e
  tempo de recarga +50%. Nesse período só há tiros normais, sem carga divina.
- O campo global atrai inimigos pela arena, mas não os atravessa por paredes;
  sua explosão alcança toda a arena. Chefes mantêm resistência à atração.
- Pausa, perda de foco, morte, mudança de arma e recompensas cancelam a carga
  sem disparar. Uma nova run limpa a exaustão. A pausa congela sua contagem no solo.

HUD mostra carga, multiplicadores e tempo de exaustão. Prévia circular cresce
durante a carga. A carta divina tem borda branca/lilás; buraco negro tem núcleo escuro.
No multiplayer o autor transmite carga e níveis; o anfitrião aplica atração e dano.

## Verificação

`node tests/gravity-ascension-smoke.cjs`: exclusividade nas ofertas/fallback/chefes/loja,
raridade e nível único, carga parcial e completa, dano em alvo distante, limite
de bônus por grupo, tempo de recuperação, lentidão, consumo de munição, bloqueio
de disparos repetidos, seis casos de cancelamento, input pelo loop real e transmissão
anfitrião/convidado. Capturas em `test-results/divine-cards.png` e `divine-charge.png`.

Regressão: `node tests/combat-smoke.cjs` (15 armas, 5 melees, sentinela) e
`node --test tests/*.test.mjs` (24 testes). Balanceamento inicial; sem run longa
com a carta divina nem teste em aparelho móvel físico ou seis jogadores.
