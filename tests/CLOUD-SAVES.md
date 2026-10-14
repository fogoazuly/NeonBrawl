# Progresso por conta

O Supabase guarda ouro, chaves, melhorias permanentes e armas desbloqueadas em
`public.player_progress`. Não guarda a run em andamento, ranking local ou opções
de áudio/gráficos. A tabela tem RLS, chave primária `user_id`, referência a
`auth.users` e políticas de leitura/inserção/alteração limitadas a `auth.uid()`.
Visitantes não têm acesso à tabela. O cliente usa somente a chave pública.

No primeiro uso de uma conta neste navegador, se a conta não possui save, copia-se
o progresso do visitante. A cópia do visitante permanece separada. Contas seguintes
não herdam automaticamente ouro de outras contas. Entrar numa conta já existente
carrega seu save, preservando a cópia do visitante.

Cada alteração fica primeiro no cache local da conta, marcado como pendente. O
envio é agrupado; falhas mantêm o cache, com repetição a cada 15 segundos e ao
reconectar. Uma conta sem cache exige conexão para a primeira leitura. O estado
aparece no menu e em Minha conta. Sincronizar agora repete envios; se não há
pendências, recarrega para buscar a versão do servidor.

Uma revisão crescente e atualização condicional impedem sobrescrita por um
dispositivo desatualizado. Em conflito, o jogador escolhe entre as duas versões;
ouro não é somado. Antes da escolha, ambas ficam em `nbConflictBackup:<user_id>`
no navegador; também é possível baixar a versão local pela interface. Alterações
de conta só são aplicadas no menu e fora de salas. Rendimentos de uma run em curso
continuam vinculados à conta que a iniciou. Web Locks impede duas abas da mesma
origem de alterarem simultaneamente a mesma conta. O navegador deve suportar
Web Locks (Chrome/Edge/Firefox/Safari atuais, em HTTPS ou localhost).

O formato é validado antes de aplicar ou enviar. Esses saves são sincronização
de um jogo executado no cliente, **não** uma economia autoritativa contra trapaça.

## Verificações

- `npm test`: estados offline, carregamento em outro dispositivo, conflito,
  gravação durante envio, separação de contas e validação do save.
- `node tests/cloud-progress-smoke.cjs`: SDK real com Auth/REST simulados em dois
  contextos do Chrome; migração local, conflito, desconexão/reload, exclusão entre
  abas, logout, segunda conta e alteração de sessão durante uma run.
- `node tests/auth-smoke.cjs`: regressão dos fluxos de autenticação e mobile.
- SQL executado no projeto real, em transação revertida: dois usuários de teste,
  isolamento de leitura/escrita, rejeição de inserção com outro proprietário,
  negação a `anon`, incremento da revisão e rejeição de revisão antiga. Nenhum
  usuário ou save de teste foi mantido.
- Migration aplicada no projeto `xhjcfcunsykgjonkzfqc`, com versão confirmada no
  histórico: `20261014223920_account_progress.sql`.
- Advisor de segurança: nenhuma advertência relativa à tabela ou RLS. Permanece
  a configuração anterior de [proteção contra senhas vazadas desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Não foram usadas credenciais reais de jogadores nos testes de navegador.
