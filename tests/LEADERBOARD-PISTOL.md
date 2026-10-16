# Ranking online e identidade da Pistola — 16/10/2026

## Ranking

- Tabela `public.leaderboard_scores` no projeto Supabase `xhjcfcunsykgjonkzfqc`.
- Top 50 resultados por dificuldade e Solo/Co-op. Cada participante envia seu próprio resultado.
- A conta e o nome são capturados no início da run. Partidas de visitante e resultados históricos sem conta não são enviados retroativamente.
- Fila local por conta, limitada aos 100 resultados pendentes mais recentes. Tentativa no login, ao voltar a conexão, a cada 30 segundos e ao atualizar o ranking.
- Chave `(user_id,run_id)` torna a repetição do envio idempotente. Sem permissão de alterar ou apagar pontuações pelo cliente.
- Leitura pública; escrita apenas na conta autenticada correspondente. Sem e-mail, tokens ou progresso na tabela.
- Ranking casual: a pontuação é calculada no navegador, portanto não há comprovação antitrapaça.

Validação no banco, dentro de uma transação revertida: inserção própria e leitura pública permitidas; reenvio preserva o primeiro valor; inserção em outra conta, envio de visitante, update, delete e dificuldade inválida bloqueados. REST público retornou HTTP 200. Nenhuma pontuação fictícia foi deixada no servidor.

Advisors: nenhuma nova ocorrência. Permanece o aviso anterior de proteção contra senhas vazadas desativada: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Pistola

- **Ricochet** (incomum, 4 níveis): +1/2/3/4 ricochetes. Após rebater, mira no inimigo visível mais próximo em até 14m, do lado livre da parede. Soma com a carta genérica de ricochete.
- **Precise Shot** (rara, 3 níveis): +4/6/8% por acerto primário consecutivo, até 5 acertos (+20/30/40%). Errar reinicia. Acertos são resolvidos na ordem dos disparos; perfurar vários inimigos conta uma vez e tiros extras não criam nem perdem stacks.
- **Last Word** (rara, 3 níveis): última munição consumida causa +60/90/120% e perfura +1/2/3 inimigos. Tiros extras herdam o bônus; Infinite Reserve não ativa a carta.
- Exclusivas da Pistola nos sorteios. Modificadores do autor via FIRE; o anfitrião calcula o bônus de precisão de cada jogador. Estado e objetos reutilizados são limpos entre runs.
- Divine Ascension da Pistola fica para a próxima etapa de balanceamento.

Testes: suite Node, leaderboard-smoke, score-exits-smoke, pistol-smoke e pages-smoke.
Capturas locais: `test-results/leaderboard.png` e `test-results/pistol-cards.png`.
