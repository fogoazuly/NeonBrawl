# NeonBrawl local

Adaptação do HTML fornecido. A cópia original está em `backup/NeonBrawl.original.html`.

## Jogar no Windows

1. Dê dois cliques em **Iniciar-NeonBrawl.cmd**.
2. Mantenha a janela aberta e acesse **http://127.0.0.1:3000**.
3. Use **PLAY SOLO** ou **MULTIPLAYER → HOST GAME**.
4. Para testar cooperativo no mesmo PC, abra outra janela no mesmo endereço, escolha **MULTIPLAYER → JOIN GAME** e digite o código da sala. Inicie a partida pela janela do anfitrião.
5. Encerre o servidor com **Ctrl+C** na janela de comandos.

Não abra o HTML diretamente pelo Explorador. O servidor fornece bibliotecas e a configuração de conexão. Se a porta já estiver ocupada por este jogo, use a instância existente ou encerre-a primeiro.

Instalação em outra máquina: Node.js 22 ou superior, `npm ci` e `npm start`. A instalação precisa de internet; depois de instaladas as dependências, jogar como visitante no mesmo PC não exige serviços externos. O login exige conexão com o Supabase configurado.

## O que funciona localmente

| Função | Implementação |
| --- | --- |
| Partida solo e simulação | Código original no navegador |
| Salas e sinalização | PeerServer no mesmo processo HTTP, caminho `/peerjs` |
| Tráfego das partidas | WebRTC entre os navegadores; o anfitrião simula o mundo |
| Ouro, melhorias, armas e chaves | Salvamento original em `localStorage` |
| Ranking | Pontuações deste navegador, separadas por dificuldade |
| Instruções e convites | Interfaces locais substituindo os scripts ausentes |
| Bibliotecas Three.js e PeerJS | Dependências locais, versões fixadas no lockfile |

O botão **ENTRAR / CRIAR CONTA** oferece e-mail/senha e Google quando o Supabase estiver configurado. É possível continuar como visitante. Por enquanto, o login identifica a conta; progresso e ranking continuam no navegador e são compartilhados pelas contas que usam esse mesmo navegador/origem. Limpar os dados do site apaga o progresso. `localhost`, `127.0.0.1`, IP da rede e portas diferentes têm salvamentos separados. Evite jogar partidas simultâneas no mesmo perfil: o salvamento original não coordena escritas entre abas. Use perfis distintos para jogadores diferentes.

## Ativar login com Supabase

1. Crie um projeto no Supabase e copie a **Project URL** e a chave **publishable** (a chave legada **anon** também é aceita).
2. Copie `.env.example` para `.env` nesta pasta. Preencha `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` e reinicie o servidor. O `.env` não é servido pelo site. Essas duas configurações são públicas; nunca use `service_role`, `sb_secret_` ou o segredo do Google nelas.
3. Em **Authentication → URL Configuration**, configure o **Site URL** como `http://127.0.0.1:3000` durante o desenvolvimento. Em **Redirect URLs**, permita `http://127.0.0.1:3000/**` (o SDK acrescenta um identificador ao retorno PKCE). Se usar `localhost`, cadastre também `http://localhost:3000/**` e sempre abra links no mesmo navegador/origem em que iniciou o fluxo. Ao publicar, configure o domínio HTTPS real e seu caminho de retorno; não use permissões de domínio amplas.
4. Em **Authentication → Sign In / Providers**, habilite **Email**, com confirmação de e-mail. Configure o envio de e-mails/SMTP para usuários reais; o serviço padrão tem restrições. O jogo inclui cadastro, entrada e recuperação de senha. As senhas novas exigem pelo menos 8 caracteres na tela; configure também a política no Supabase.
5. Para **Google**, crie um cliente OAuth do tipo **Web application** no Google Cloud. Cadastre a origem local/do site e, em **Authorized redirect URIs**, copie a URL de callback indicada pelo painel do Supabase (normalmente `https://SEU-PROJETO.supabase.co/auth/v1/callback`). Coloque o Client ID e Client Secret somente na configuração do provedor Google no Supabase. Configure público/usuários de teste na tela de consentimento Google.
6. Teste uma conta real: cadastro → confirmação recebida → entrada → recarga → saída; recuperação de senha; e entrada/retorno com Google. Links PKCE devem ser abertos no navegador em que foram solicitados.

Referências oficiais: [e-mail e senha](https://supabase.com/docs/guides/auth/passwords), [Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [URLs de retorno](https://supabase.com/docs/guides/auth/redirect-urls) e [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Esta etapa não cria tabelas, carteira, ranking online ou sincronização de progresso. A autenticação usa o SDK oficial servido localmente, persistência de sessão e PKCE. A integração de economia do portal original permanece desativada. Supabase atende a autenticação; publicar o servidor Node/PeerServer do jogo continua sendo uma etapa separada.

Teste automatizado: `node tests/auth-smoke.cjs` inicia e encerra seu próprio servidor em uma porta livre, usa o SDK real com respostas simuladas de autenticação e verifica a interface no Chrome. Não envia e-mails nem valida as configurações de um projeto real.

Os MP3/WAV originais e `assets/card-icons.png` não estavam na pasta. Usamos os efeitos sintetizados e os ícones alternativos do próprio jogo; a música fica desativada. Scripts de anúncios, telemetria, busca de usuários e navegação do portal original foram removidos. Créditos de autoria do HTML foram preservados.

## Organização

- `NeonBrawl.html`: estrutura da interface e carregamento dos módulos.
- `local/game.js`: coordenação da partida e sistemas que ainda serão extraídos por etapas.
- `local/combat/collision.js`: colisões, limites da arena, ricochetes e desvios de obstáculos.
- `local/combat/damage.js`: cálculo de dano, críticos, blindagem e modificadores.
- `local/rendering/scene.js`: renderer, câmera, iluminação, bloom e redimensionamento.
- `local/multiplayer/state.js` e `transport.js`: criação do estado da sessão e envio de mensagens.
- `local/multiplayer/rooms.js`: criação, entrada, saída e reconexão das salas; UI e entidades são atualizadas por callbacks.
- `local/game.css` e `local/about.css`: estilos extraídos do HTML, preservando a ordem original.
- `local/save-codec.js`: leitura e escrita compatíveis com os saves existentes.
- `local/progress-backup.js`: formato do backup, validação e cópia de recuperação.
- `local/backup-ui.js`: exportação, prévia de importação e recuperação no menu.
- `local/invite-capture.js` e `local/how-to-play.js`: captura de convites e instruções extraídas do HTML.
- `local/services.js`: integrações locais de ranking, instruções, convites e conexão.
- `local/style.css`: apresentação das interfaces locais.
- `server.mjs`: servidor HTTP, configuração e sinalização multiplayer.
- `tests/`: verificações automatizadas.
- `PLANO.md`: próximos passos e critérios de conclusão.
- `ARQUITETURA.md`: dependências, responsabilidades e limites dos módulos.

## Pontuação local

O ranking local registra a pontuação ao morrer ou encerrar a partida: saída pelo menu, recarga, fechamento normal da aba e desconexão. Esses caminhos não duplicam o registro da mesma partida, e partidas sem pontos não criam entradas. No cooperativo, cada participante salva no próprio navegador a pontuação compartilhada da equipe. O progresso e o ranking continuam locais; o fechamento forçado do processo do navegador pode impedir a execução do salvamento.

## Backup do progresso

No menu principal, escolha **BACKUP DO PROGRESSO**. Saia de qualquer sala multiplayer antes de abrir essa opção.

- **Exportar progresso** baixa um JSON com ouro, chaves, níveis de melhorias e armas desbloqueadas.
- Para importar, selecione o JSON, confira a prévia e clique em **Substituir progresso e recarregar**. Escolher um arquivo ou fechar a janela não altera o progresso.
- **Recuperar progresso anterior** mostra a cópia guardada antes da última importação. Confira e confirme a substituição para recuperá-la. Há apenas uma cópia anterior por navegador/origem; exporte arquivos para guardar várias versões.
- Feche outras abas do jogo antes de importar. A cópia automática também é apagada quando você limpa os dados do site; o arquivo baixado é o backup portátil.

O backup não inclui configurações, ranking ou a partida em andamento. Pode ser levado para outro navegador ou uma futura hospedagem que use o mesmo formato de progresso. Arquivos inválidos, versões incompatíveis, valores fora dos limites e arquivos acima de 256 KB são rejeitados antes da escrita. Os saves existentes continuam usando o mesmo formato `_nbpd`.

## Configuração para outro servidor

### GitHub Pages

O repositório preparado é `fogoazuly/NeonBrawl`. A URL prevista é `https://fogoazuly.github.io/NeonBrawl/`; ela só estará disponível depois da publicação concluída.

- `npm run build:pages` gera apenas os arquivos públicos em `dist/`, com caminhos relativos compatíveis com o subdiretório do repositório. Nunca publique a pasta inteira do projeto como artefato.
- Em Settings → Pages do repositório, selecione GitHub Actions. O workflow `.github/workflows/pages.yml` testa, gera e publica `dist/` a cada push em `main`.
- Em Settings → Secrets and variables → Actions → Variables, configure `SUPABASE_URL=https://xhjcfcunsykgjonkzfqc.supabase.co` e `SUPABASE_PUBLISHABLE_KEY` com a chave pública do projeto. Não use uma chave secret/service_role.
- No Supabase, configure o Site URL como `https://fogoazuly.github.io/NeonBrawl/` e permita esse retorno e seus parâmetros PKCE na lista Redirect URLs (`https://fogoazuly.github.io/NeonBrawl/**`). Preserve os retornos locais se continuar testando no PC.
- A primeira versão Pages oferece solo e login quando configurado. O botão multiplayer informa que as salas online estão em preparação; o PeerServer local continua funcionando ao iniciar pelo Node.
- O progresso local do endereço `127.0.0.1` não aparece automaticamente no domínio do GitHub. Use o backup do jogo para transferi-lo.
- Verificação antes de publicar: `npm run build:pages` e `node tests/pages-smoke.cjs`. O teste inicia/encerra seu próprio servidor e verifica solo, recursos, isolamento dos arquivos privados e retorno OAuth em `/NeonBrawl/`.

### Servidor Node.js

`PORT` define a porta (padrão 3000); `HOST` define a interface (padrão `127.0.0.1`, somente este PC). Para rede local ou hospedagem, configure `HOST=0.0.0.0`. Não há IP fixo no cliente: ele usa o endereço e protocolo da página. Atrás de um proxy confiável, configure `TRUST_PROXY=1`. A hospedagem precisa executar Node.js e suportar WebSocket; hospedagem apenas de arquivos estáticos não executa o servidor de salas.

`ICE_SERVERS_JSON` aceita uma lista JSON de servidores STUN/TURN. O padrão `[]` evita dependências externas nesta fase. Internet entre redes diferentes ainda exige configurar e testar STUN/TURN e HTTPS. Credenciais TURN permanentes não devem ser colocadas nessa variável em produção: a configuração é enviada ao navegador; adote credenciais temporárias em uma próxima etapa.

As flags de mídia ficam em `server.mjs`. Ative-as somente depois de adicionar os respectivos arquivos.

Referência técnica da sinalização: [PeerServer oficial](https://github.com/peers/peerjs-server).

## Verificação

Execute `npm test` para verificar HTTP, configuração local, proteção dos arquivos privados, ranking, compatibilidade dos saves, validação do backup e recuperação após falhas de armazenamento. Os testes de navegador também verificam solo, conexão cooperativa, persistência e exportação/importação/recuperação reais; consulte `PLANO.md` para os limites do escopo.

Para repetir o teste de navegador: mantenha o servidor na porta 3000 e execute `node tests/browser-smoke.cjs`. Requer Chrome e Playwright (usa o runtime do Codex quando disponível). `CHROME_PATH` e `PLAYWRIGHT_MODULE` permitem informar caminhos alternativos. O teste usa um perfil temporário e salva uma captura em `test-results/solo.png`.

`node tests/rendering-smoke.cjs` verifica a cena 3D com bloom ligado/desligado, redimensionamento e remoção dos listeners ao descartar a cena. `npm test` também compara colisões e dano com a cópia anterior à extração.

`node tests/rooms-smoke.cjs` verifica código inválido, saída/reentrada de convidados, reutilização da vaga, saída do anfitrião, criação de nova sala e reconexão de um canal WebRTC interrompido. Usa o mesmo servidor local e perfil temporário dos demais testes de navegador.

A auditoria de mecânicas está registrada em `tests/MATRIZ-MECANICAS.md`, com resultados em `tests/VALIDACAO.md`. Os testes adicionais cobrem pontuação nas saídas, catálogo, combate, inimigos, jogador, objetivos e loja; a matriz distingue verificações concluídas de efeitos e fluxos ainda pendentes.
