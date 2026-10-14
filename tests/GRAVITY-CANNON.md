# Canhão de Gravidade — 13/10/2026

Arma épica disponível nos baús de armas e, após desbloqueada, na seleção inicial.
Três disparos, intervalo de 1,6 s e recarga de 2,8 s. Esfera com velocidade 4,
alcance base 7, duração mínima de 2,4 s e explosão de raio 3,6.
Campo de atração de raio 4,5; chefes recebem 18% da força normal.
O cursor define a distância de parada no desktop; no celular usa o alcance máximo.
Paredes param a esfera e bloqueiam a atração. A explosão usa as mesmas regras
de dano em área das armas explosivas existentes, inclusive contra spawners.

Integração com munição, recarga, dano, cadência, tiros adicionais, alcance e
modificadores de explosão existentes. Ricochete e perfuração não alteram a esfera.
No cooperativo, o anfitrião aplica atração e dano; convidados exibem o efeito.

Validação realizada:
- `node tests/gravity-cannon-smoke.cjs`: atração, resistência do chefe, parede,
  explosão, limpeza e reutilização de projéteis, seleção pela interface,
  disparo com mouse, imagem e transmissão FIRE entre dois clientes reais,
  incluindo distância de mira. Nenhum erro de JavaScript.
- `node tests/combat-smoke.cjs`: dano, consumo e recarga das 15 armas,
  cinco armas de combate próximo e sentinela.
- `node tests/spawner-weapons-smoke.cjs`: todas as armas causam dano nos
  spawners ativos, preservando o escudo fora da área de ativação.
- `node --test tests/*.test.mjs`: 24 testes aprovados.

Imagem: `test-results/gravity-cannon.png`.
Balanceamento inicial; não foi realizada uma run completa com a nova arma nem
teste com seis jogadores. Novas cartas específicas ficam para a próxima etapa.
