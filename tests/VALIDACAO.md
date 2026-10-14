# Validação local — 9 de outubro de 2026

- Servidor HTTP e duas verificações automatizadas: aprovados (`node --test tests/*.test.mjs`).
- Chrome com perfil temporário: menu, escolha de armas/habilidade e primeira onda solo.
- Cooperativo: criação de sala, entrada por convite, escolha de armas/habilidade e primeira onda em dois clientes.
- Progresso: ouro mantido após recarregar; compra de melhoria descontou 15 e o saldo persistiu após nova recarga.
- Ranking: pontuação gravada e exibida na dificuldade correta.
- Nenhuma requisição HTTP externa ou resposta HTTP de erro nos fluxos testados.
- Nenhum erro JavaScript do jogo nos fluxos testados.
- Auditoria das dependências instaladas: zero vulnerabilidades reportadas na execução.

Não coberto: rede entre PCs distintos, internet, partidas completas, carga com seis jogadores e migração do anfitrião. Mídia original ausente não foi recuperada.

## Etapa 2 — Backup e extração dos módulos

- Sete testes automatizados aprovados, incluindo compatibilidade byte a byte com o codec do HTML original.
- Rejeição de JSON inválido, versão desconhecida, campos/valores incompatíveis e arquivos grandes.
- Falha de validação ou de armazenamento não substitui o progresso atual.
- Teste real no Chrome: download do backup, rejeição de arquivo inválido, cancelamento sem escrita, importação e recuperação da cópia anterior.
- Regressão após extração do HTML: primeira onda solo e cooperativa em duas janelas, compra de melhoria e persistência aprovadas.
- Nenhum erro JavaScript ou requisição externa nesses testes. Os testes usam um perfil temporário, sem alterar os saves do usuário.

## Etapa 3 — Núcleos de combate, renderização e multiplayer

- Doze testes automatizados aprovados.
- Colisões, ricochetes e desvios comparados com a implementação anterior em 300 cenários.
- Dano e críticos comparados em 160 cenários, incluindo bosses, tanques, execução, habilidades e vulnerabilidade.
- Verificados atualização dos obstáculos, troca da build e envio multiplayer com conexão obsoleta/excluída.
- Regressão no Chrome: primeira onda solo e cooperativa, loja, save, exportação/importação/recuperação e ranking aprovados; nenhum erro JavaScript ou requisição externa.
- Cena com bloom ligado/desligado, dimensões do canvas, aspecto da câmera, resize e descarte aprovados no Chrome.

## Etapa 4 — Ciclo das salas (10 de outubro de 2026)

- Vinte testes automatizados aprovados, incluindo oito testes do módulo de salas.
- Verificados limite e reserva de vagas simultâneas, reutilização após saída, eventos atrasados, cancelamento de configuração/retries, falha definitiva e timeout de reconexão.
- Duas páginas reais no Chrome: código inexistente, saída/reentrada repetida de convidado, reutilização de P2, saída do anfitrião e entrada numa nova sala aprovados.
- Canal WebRTC do convidado interrompido no teste; um novo `JOINED` confirmou a reconexão, com dois jogadores na sala e sem erros JavaScript.
- Regressão completa de primeira onda solo/cooperativa, loja, save, backup/importação/recuperação e ranking aprovada.
- Não validado nesta etapa: recuperação de uma partida em andamento após perda prolongada de rede, transferência do anfitrião ou conexão pela internet.

## Auditoria de mecânicas — em andamento (10 de outubro de 2026)

- 22 testes unitários aprovados. A pontuação passa a ser registrada também em saída voluntária, recarga, fechamento e desconexão, sem duplicar a mesma partida. Convidados salvam localmente a pontuação compartilhada do cooperativo.
- Chrome: `score-exits-smoke.cjs` e `score-multiplayer-smoke.cjs` aprovados novamente após as correções de combate.
- `catalog-smoke.cjs`: 103 habilidades e 20 relíquias aplicadas até o limite, com simulação e verificação de valores finitos. O relatório `test-results/catalog.json` não representa validação de todos os efeitos e combinações.
- `combat-smoke.cjs`: dano das 14 armas, consumo de munição, recarga automática e dano/cooldown dos cinco melees aprovados. A granada é testada por explosão ao lado do alvo, pois ricocheteia nos corpos.
- Corrigida chamada inexistente de `spawnSlashVfx` no Blade Sentinel. Regressão verifica dano, criação do efeito e descarte da geometria ao expirar.
- `enemies-smoke.cjs`: 82 cenários aprovados — 14 inimigos nas versões normal/elite/campeão e 8 bosses nas 5 dificuldades, com as três fases e atividade de ataque. Relatórios em `test-results/combat.json` e `test-results/enemies.json`.
- `player-smoke.cjs`: movimento nas quatro direções, dash, dano, invulnerabilidade, barreira, limite de cura, revive e reset de build aprovados. Corrigido temporizador de derrota que abria game over depois de sair; testadas saída, nova partida e derrota normal.
- `objectives-shop-smoke.cjs`: conclusão dos cinco miniobjetivos, recompensa única, falha do reator, compra com débito, limite de habilidade, aumento de preço, reroll, saldo insuficiente e bloqueio de totem destruído aprovados.

Os cenários avançados preparam estados controlados no navegador. Não substituem partidas naturais completas, avaliação de equilíbrio, controles móveis ou sincronização cooperativa de todas as habilidades. Pendências detalhadas em `MATRIZ-MECANICAS.md`.

Para executar os novos testes de navegador, mantenha o servidor local em execução e use `node tests/<nome-do-teste>.cjs`. Cada teste usa armazenamento temporário, separado do progresso do jogador.

### Controles e configurações

- `input-smoke.cjs`: 13 verificações aprovadas no Chrome. Teclado/mouse via Playwright e eventos Touch em contexto móvel emulado; não corresponde a validação num celular físico.
- Corrigidos comandos presos após perda de foco, ataques durante pausa e repetição de Escape. A pausa, o início de partida, a saída e a abertura da loja limpam as entradas pendentes.
- Corrigida a associação de cada dedo ao joystick: cruzar o centro mantém o controle original, e um segundo dedo não rouba um joystick ocupado. `touchcancel` solta o controle.
- Movimento por toque passa a funcionar na área da loja. Seu painel de compras bloqueia o joystick; botões de ação não iniciam um joystick nem deixam ataques enfileirados durante pausa.
- Verificados movimento e disparo simultâneos, recarga manual pela tecla R, pausa/retomada e liberação das teclas.
- `settings-smoke.cjs`: troca de teclas com permuta do vínculo anterior, cancelamento por Escape, restauração, ganho de áudio, mute e persistência após recarga aprovados.
- Regressão após as correções: 22 testes unitários e `browser-smoke.cjs` aprovados (solo, cooperativo, compra, save, backup, recuperação e ranking), sem erros JavaScript, requisições externas ou respostas HTTP de falha nos fluxos testados.

### Combinações de cura e recompensas entre partidas

- `healing-synergies-smoke.cjs`: 25 cenários aprovados, com relatório em `test-results/healing-synergies.json`.
- Plague Field passa a bloquear também a regeneração do Regen Heart e o roubo de vida do Vampire Pact. O roubo de vida continua funcional fora desse desafio nos três níveis.
- Regen Heart respeita a redução/bloqueio de cura do Last Stand Core, aplicando o multiplicador antes de acumular frações de HP para evitar que arredondamento anule a penalidade. A recuperação efetiva agora entra na contribuição de cura.
- Steady Pulse e a cura de Duel Guard respeitam o bloqueio de regeneração do Vampire Pact nos níveis 1 e 2, além do nível 3. Cenários sem o pacto confirmam que as habilidades continuam curando normalmente.
- Recalcular o limite de vida não restaura HP de jogadores mortos/caídos. Maldição temporária de vida e frações pendentes de regeneração são zeradas antes de calcular a vida da próxima partida, tanto no início solo/anfitrião como no inicializador do convidado.
- `player-smoke.cjs` e 22 testes unitários aprovados após as correções de cura.
- `keys-chest-smoke.cjs`: corrigido controle de chaves que persistia indevidamente entre partidas solo/anfitrião. Verificados marcos de ondas, ausência de duplicatas na mesma partida, nova premiação na partida seguinte, débito/desbloqueio do baú, clique duplo, persistência, ausência de chaves e todas as armas já desbloqueadas.

### Resgate e revanche cooperativa

- `revive-multiplayer-smoke.cjs` aprovado em dois contextos independentes do Chrome conectados pelo PeerServer local, com mensagens reais de estado.
- Dano letal derruba o anfitrião/convidado; ficar sem ajuda reduz o tempo de sobrevivência; aproximação do companheiro recupera o jogador e sincroniza seu estado vivo.
- Após bleed-out preparado com tempo reduzido no teste, o sobrevivente continua jogando. A conclusão da onda recupera o eliminado.
- A queda de toda a equipe abre game over nos dois clientes. A revanche espera ambos confirmarem e inicia nova seleção/primeira onda com jogadores vivos.
- Reproduzido e corrigido reinício indevido após o anfitrião sair durante os 350 ms de contagem da revanche. O callback agora verifica identidade da sala, geração da partida, conexão e tela de espera antes de executar.
- Dez testes unitários de salas e pontuação aprovados após a correção. Sem erros JavaScript no fluxo cooperativo testado.
- Posições, dano e estado avançado são preparados por instrumentação exclusiva do teste; ainda não cobre latência externa, três ou mais resgatadores nem todos os modificadores de resgate.

### Compras permanentes e probabilidades do baú

- `permanent-shop-smoke.cjs`: dez melhorias compradas até o limite, totalizando 79 níveis, com verificação de preço, débito, nível adquirido, ausência de efeitos `undefined`, saldo insuficiente e clique repetido. Todos os cenários aprovados.
- Quatro armas corpo a corpo desbloqueadas na ordem exigida; verificados pré-requisito, falta de saldo, persistência após recarga e ausência de nova compra para arma já possuída.
- Corrigida cobrança duplicada no desbloqueio de armas: o botão agora é bloqueado antes de aguardar o pagamento e a elegibilidade é verificada novamente. Rejeição de pagamento simulada preserva saldo/desbloqueio e permite tentar novamente.
- Corrigido texto de probabilidades do baú, que informava 48%/34%/18% em vez dos pesos efetivos 50%/34%/16%. A interface e o sorteio consultam o mesmo conjunto de raridades disponíveis; os pesos são renormalizados quando uma categoria já foi desbloqueada inteira.
- `keys-chest-smoke.cjs`: 2.000 posições determinísticas no intervalo do sorteio verificam a distribuição inicial e a distribuição sem armas comuns disponíveis (68% raras/32% épicas), sem sortear armas possuídas. Demais testes de chaves, débito, abertura e persistência aprovados novamente.

### Efeitos permanentes e autoria do dano

- `permanent-effects-smoke.cjs`: 85 cenários de níveis aprovados para HP, dano, dano contra boss, críticos, ouro, velocidade, cadência, revives e rerolls; mais quatro fluxos de escolha de habilidades iniciais (níveis 0–3).
- Corrigido arredondamento do dano permanente no nível 7: a imprecisão de `25 * 1.14` resultava em 28 em vez de 29. Solo/anfitrião e convidado calculam usando a porcentagem inteira antes do arredondamento final.
- Críticos verificados com 10.000 posições determinísticas por nível. Ouro usa um drop controlado de 100 para verificar a aplicação do bônus no caminho real de morte/recompensa. Movimento, disparo, dano letal e consumo de rerolls exercitam os respectivos caminhos de gameplay.
- `damage-owner-multiplayer-smoke.cjs`: oito cenários aprovados em dois navegadores conectados. Um único tiro/laser é recebido pelo servidor da partida e seu dano efetivo é comparado para builds diferentes de anfitrião e convidado.
- Corrigido Glass Reactor ignorado pelos projéteis locais: o snapshot do disparo agora inclui o multiplicador de relíquias. Os tiros enviados e locais usam a mesma montagem de modificadores.
- Corrigido Hollow Point do convidado ignorado, ou substituído pelo Hollow Point do anfitrião. O dano usa o nível enviado pelo autor do ataque; um snapshot sem essa habilidade não herda a habilidade local.
- Regressão: 23 testes unitários e `combat-smoke.cjs` aprovados após a correção. A comparação histórica de dano mantém builds iguais entre autor/anfitrião; um teste separado verifica explicitamente builds diferentes.

### Bônus pessoal de ouro cooperativo

- `gold-multiplayer-smoke.cjs`: seis cenários aprovados em dois navegadores, incluindo níveis diferentes de Treasure Contract e multiplicador coletivo do totem Iron Skin.
- Corrigido convidado receber o bônus de ouro do anfitrião. O anfitrião transmite o drop base e o multiplicador coletivo; cada participante aplica seu próprio Treasure Contract, com um arredondamento final. O campo antigo de valor final continua aceito quando não há valor base na mensagem.
- Usado drop controlado de 100 no caminho real de morte do inimigo, preservando envio pelo PeerServer e recebimento pelo convidado. Exemplo verificado: host nível 0 recebe 100 e convidado nível 10 recebe 160; com totem recebem 150 e 240.
- Saldos de ambos preservados após recarga. Regressão `permanent-effects-smoke.cjs` aprovada novamente (85 cenários de níveis + quatro fluxos iniciais).

### Relíquias coletivas e compartilhamento de dano

- `team-relics-multiplayer-smoke.cjs`: portador convidado e observador anfitrião, níveis 0–3 de Haste Aura, Heavy Boots, Envy, Brittle Bones e Bone Tribute. Verifica deslocamento, cooldown de dash, dano causado/recebido e configuração da quantidade de inimigos. Envy preserva o dano do portador; sair da sala remove o efeito de Heavy Boots.
- `linked-pain-multiplayer-smoke.cjs`: nove cenários aprovados em três contextos independentes do Chrome, alternando o portador entre anfitrião e ambos os convidados, nos três níveis. Um golpe de 100 compartilha 15, 25 ou 40 com cada companheiro via mensagens reais.
- Reproduzido antes da correção: com um convidado portador no nível 1, HP final era `[985, 900, 1000]`, em vez de `[985, 900, 985]`. O envio agora passa pelo anfitrião quando o autor é convidado, pois não existem conexões diretas entre convidados.
- O teste de Linked Pain interrompe a simulação de movimento/IA após iniciar a primeira onda para impedir interferência de inimigos. Dano, mensagens e aplicação nos destinatários usam o código de produção. Não cobre múltiplos portadores simultâneos nem latência externa.
- Os 23 testes unitários passaram após a correção.

### Greedy Crown e restrições de coleta

- `greedy-crown-multiplayer-smoke.cjs`: oito cenários aprovados em dois contextos Chrome, alternando o portador entre anfitrião e convidado, sem a relíquia e nos níveis 1–3.
- Verificada a coleta real de bolsa de cura e bônus de dano: nível 1 bloqueia somente a bolsa para o companheiro; níveis 2–3 bloqueiam ambos. Objetos bloqueados continuam disponíveis para o portador. Mensagens de coleta removem os objetos no outro cliente.
- Reproduzida falha no nível 3: ambos recebiam 100 de ouro, contrariando a descrição da relíquia. Agora o drop paga somente aos portadores; o anfitrião continua transmitindo a recompensa mesmo quando ele próprio não pode recebê-la.
- Teste usa morte real de inimigo com drop fixado em 100, simulação de IA suspensa e canal de mensagens real. Um estado posterior no mesmo canal ordenado confirma a entrega, inclusive quando o ouro está bloqueado.
- Regressão dos 23 testes unitários e dos seis cenários de bônus pessoais/totem em `gold-multiplayer-smoke.cjs` aprovada, incluindo persistência após recarga nos dois clientes. Combinações com vários portadores e conexão externa continuam pendentes.

### Cancelamento de transições de onda e boss

- `transition-timers-smoke.cjs`: sete cenários aprovados no Chrome. Introdução da onda e recompensa de boss canceladas ao sair para o menu ou iniciar outra partida; introdução normal cria a fila e os inimigos; resumo normal abre as cartas ao continuar; sair fecha um resumo já aberto.
- Reproduzida criação indevida de um inimigo na nova partida por temporizador da introdução anterior. A introdução agora confere geração da partida, número da onda, estado de jogo e transição ativa.
- Reproduzido resumo de boss aparecendo sobre o menu e a nova partida. O agendamento e a continuação da recompensa verificam a partida/onda de origem; a saída fecha o resumo aberto.
- A simulação fica suspensa no teste, com atualização explícita da conclusão da onda e da fila de inimigos. Os temporizadores usam tempo real. Isso não representa uma campanha completa nem todas as transições de mapas/cooperativo.
- Os 23 testes unitários passaram após as correções.
- `browser-smoke.cjs` aprovado novamente: primeira onda solo/cooperativa, compra e persistência, backup/importação/recuperação e ranking. Sem erros JavaScript, requisições externas ou falhas HTTP observadas.

### Estrutura dos mapas e descarte de obstáculos

- `maps-smoke.cjs`: 33 mapas montados no Chrome (oito legados, 16 normais, loja e oito bosses), verificando contagens de blocos/zonas e ausência de obstáculos nos pontos de entrada e saída. Busca em grade de 0,5 unidade, com margem de 0,3, encontra rota entre entrada e saída em todos; não substitui navegação real por teclado nem simula perigos no caminho.
- Teste de seleção das ondas 1–80 confirma arenas dos oito bosses e ausência de repetição consecutiva entre mapas normais após as duas primeiras ondas. É teste do seletor, não campanha jogada de 80 ondas.
- Corrigida geometria das marcas de obstáculos destrutíveis que não era descartada. Um descarte comum atende destruição e mudança de mapa; libera também materiais exclusivos dos blocos intactos, preservando materiais compartilhados.
- O teste destrói parte dos blocos e troca de mapa com outros intactos, contando eventos de descarte: geometrias e materiais exclusivos liberados uma vez, materiais compartilhados preservados, objetos antigos removidos da cena. Obstáculos sólidos não recebem dano.
- Corrigidas sobreposições de paredes: Bars na saída, Delta Crossing na entrada e L-Wing junto à saída. A parede de Delta Crossing também recebeu a flag necessária para ser destrutível, conforme seu comentário/configuração.
- Regressão: 23 testes unitários e `rendering-smoke.cjs` aprovados. Sincronização da destruição em multiplayer e travessia natural de todos os mapas continuam pendentes.

### Mapas e obstáculos no cooperativo

- `maps-multiplayer-smoke.cjs`: 33 mapas sincronizados entre dois contextos Chrome pelo canal real. Coordenadas/tipos dos blocos e zonas iguais após cada mudança; 33 obstáculos destruídos pelo anfitrião removidos no convidado. Reentrada em três mapas reconstrói os obstáculos em ambos.
- Reproduzido dano indevido de projétil visual no convidado: parede caiu de 260 para 215 HP. A colisão agora respeita `visualOnly`; teste confirma HP preservado no convidado e dano de 45 pelo projétil real no anfitrião.
- A preparação troca mapas e aplica dano diretamente nas funções do jogo, suspendendo a IA. Não cobre travessia natural, reconexão após destruição nem todas as armas contra paredes.
- Regressão `combat-smoke.cjs` aprovada: 14 armas de fogo, cinco melees e Blade Sentinel. Corrigida premissa frágil do teste do Sentinel: agora permite até 120 quadros de aproximação após separação de aliados, mantendo exigências de dano, criação de efeito e descarte.

### Zonas dos mapas

- `map-zones-smoke.cjs`: 40 zonas verificadas no Chrome, uma por vez, incluindo centro e pontos imediatamente dentro/fora da borda. Água aplica o multiplicador previsto e libera a velocidade ao sair. Grama oculta inimigos, revela na mesma zona e respeita a revelação temporária/saída.
- Áreas de dano verificadas quanto ao valor do golpe, intervalo de 0,55 s, ausência de dano fora da zona e proteção de jogadores caídos. Usa posições e passos de tempo controlados, sem travessia natural.
- `map-hazards-multiplayer-smoke.cjs`: dois clientes reais; reproduzido dano local de 8 no convidado antes de qualquer golpe do anfitrião. A atualização de zonas agora aplica dano apenas no anfitrião/solo; convidados recebem a mensagem autoritativa, evitando fontes independentes de dano para o mesmo perigo.
- Após correção, convidado permanece com 100 HP no passo local, recebe 92 e depois 84 do anfitrião conforme o intervalo. Anfitrião fora da zona mantém 100. Os 40 cenários solo e 23 testes unitários passaram novamente.
- Latência externa, sobreposição de zonas e combinações com todas as defesas ainda não estão cobertas.

### Bounties e contagem de tempo/dano

- `bounties-smoke.cjs`: 15 cenários aprovados para noDamage, noDeaths, fastClear e noBullet, com recompensas solicitadas duas vezes para verificar ausência de duplicação. Inclui queda, tiros no limite da tolerância inicial, dano na introdução e nos primeiros lotes de inimigos, barreira e escudo total/parcial.
- Corrigido noDamage ignorar golpes enquanto a fila de surgimento ainda estava ativa. Agora conta HP efetivamente perdido desde o fim da introdução; golpes absorvidos integralmente não falham a bounty e absorção parcial conta somente o dano restante.
- Corrigido cronômetro que esperava todos os inimigos surgirem. Um passo de 0,25 s durante a fila agora acrescenta 0,25 s ao combate. Isso também torna a tolerância inicial de noBullet relativa ao início efetivo do combate.
- fastClear agora exige menos de 60 s, conforme sua descrição: 59,999 aprova, 60 e 60,001 falham.
- Regressões `player-smoke.cjs` e 23 testes unitários aprovadas. Cenários preparados por instrumentação; sincronização das bounties entre jogadores e demais modificadores de desafios permanecem pendentes.

### Interface de recompensas de desafio

- `challenge-rewards-smoke.cjs`: cinco fluxos aprovados via cliques na interface: carta, relíquia, alternativa de carta com todas as relíquias no máximo, cancelamento durante a animação e reinício antes de terminar a animação. Cliques duplos concedem uma única escolha.
- Corrigida carta extra indevida: a escolha de carta e a alternativa por esgotamento de relíquias incrementavam a fila e abriam uma oferta sem consumir esse incremento. Agora passam por `afterBuffSelect`, que consome a recompensa antes de abrir a oferta; uma escolha avança para a próxima onda.
- Corrigida animação de escolha que reabria a seleção após sair. O callback verifica partida, estado e presença da carta original antes de aplicar a escolha; não altera uma partida reiniciada.
- O teste prepara o fim do desafio e desativa somente os sorteios adicionais de Fate Gambit para isolar o caso de catálogo de relíquias esgotado. Combinações com sorteios extras e recompensas cooperativas continuam pendentes.
- Os 23 testes unitários passaram após as alterações.

### Ofertas do santuário e catálogo esgotado

- `shrine-smoke.cjs`: 12 cenários aprovados no Chrome: quatro ofertas disponíveis na interface (Tribute, Sacrifice, Bargain, Pact), três durações de penalidade, quatro raridades esgotadas e catálogo inteiro esgotado.
- Cliques duplos concedem uma habilidade da raridade prometida e avançam uma onda. Custos de 25/50/75% reduzem vida atual e máxima; chamadas controladas de conclusão restauram o limite após três/cinco ondas.
- Reproduzida cobrança sem recompensa quando todas as habilidades incomuns estavam no máximo: HP máximo caía de 100 para 75. Ofertas esgotadas agora aparecem desabilitadas, com explicação; uma revalidação antes do custo cobre esgotamento após abrir a tela.
- Se todas as ofertas disponíveis estão esgotadas, o santuário é encerrado e a partida continua sem custo. Teste confirma também que forçar clique em oferta desabilitada não cobra vida.
- Os 23 testes unitários passaram após a correção. A duração foi validada chamando o contador diretamente; integração com ondas de boss, empilhamento de penalidades e fluxo cooperativo ainda precisam de cobertura.

### Penalidade do santuário nas ondas de boss

- `curse-wave-progression-smoke.cjs`: sequência preparada de conclusões das ondas 7–11 exercita atualização de fim de onda e saída pelo portal nas ondas normais, além da recompensa do boss na onda 10. Não chama diretamente o contador de penalidade.
- Antes da correção, a duração seguia 4, 3, 2, 2, 1; o boss não contava. Adicionado o desconto nos dois caminhos de recompensa de boss. Agora a duração segue 4, 3, 2, 1, 0 e a vida máxima volta de 50 para 100 na onda 11.
- Testadas a execução solo e a condição de convidado em que o estado do anfitrião já marcou a onda concluída. O segundo cenário prepara as flags localmente; não usa conexão de rede. Uma atualização adicional não desconta novamente.
- Regressões: sete cenários de transições/recompensa de boss e 23 testes unitários aprovados. Campanha natural, rede real para este caso e empilhamento de penalidades ainda pendentes.

### Modificadores de combate dos desafios

- `challenge-effects-smoke.cjs`: Speed Demon produz o dobro do deslocamento do chaser em um passo controlado; Ranged Hell acelera em 50% o contador de disparos de Shooter e Sniper.
- Reproduzida composição incoerente de Ranged Hell: incluía Bomber, cujo ataque normal ocorre por proximidade, apesar da descrição de inimigos de longo alcance. A lista agora usa Shooter e Sniper.
- Teste do gerador nas configurações 1–80 preserva o total de inimigos, com contagens positivas e somente os dois tipos à distância. Inclui chamadas forçadas em números de ondas de boss; o sorteio natural continua sem desafio nessas ondas.
- Elite Surge cria versão elite dos 14 tipos comuns. Fog of War aumenta a névoa/ativa a vinheta e restaura ambos ao concluir a onda.
- Todos os cenários aprovados sem erros JavaScript. Teste mede passos e funções reais com estados preparados; padrões completos de ataque, combinações com totens/relíquias e rede ainda parciais.

### Meteor Storm: aviso, impacto e ciclo de vida

- `meteor-storm-smoke.cjs`: oito cenários aprovados. Aviso permanece visível antes de 0,62 s, sem dano antecipado; no impacto da onda 4, centro e borda recebem 18, enquanto fora do raio não recebe dano.
- Invulnerabilidade e barreira bloqueiam o golpe; atualizar novamente não repete o impacto. Limpeza das magias e saída seguida de reinício removem meteoros pendentes antes que atinjam a nova partida.
- Introdução, onda concluída e menu não geram novos meteoros. Em combate, a geração controlada cria 3–5 avisos e respeita o intervalo antes do próximo lote.
- Estados e passos de tempo são preparados pelo teste; ainda não cobre partida natural prolongada, distribuição estatística da chuva ou interação com todos os modificadores defensivos. Nenhuma correção de produção foi necessária nestes cenários.

### Modificadores e recompensas dos totens de onda

- `wave-totems-smoke.cjs`: seis modificadores aprovados — Double Trouble, Haste, Iron Skin, Sharp Claws, Promotion e Mega Swarm. Ativação repetida mantém a mesma oferta; `nextWave` transfere o modificador para a onda ativa e impede sorteio simultâneo de evento aleatório.
- Verificados atributos de inimigos criados (HP, velocidade, multiplicador de dano), quantidade configurada da onda e cristais concedidos por drop controlado de base 10. Haste concede 20 cristais e Mega Swarm concede 30.
- Promotion: 20 posições determinísticas do sorteio produzem dez chasers elites. Isso verifica o limiar de 50%, não uma distribuição estatística em partida longa.
- Chamar a entrega duas vezes concede uma única carta para Double Trouble, Sharp Claws e Promotion, e limpa o modificador. Totens de recompensa durante a onda não concedem carta adicional. Bônus de ouro de Iron Skin já tem cobertura no teste cooperativo de ouro.
- O cenário prepara uma onda encerrada, ativa o totem pela função do objeto e chama diretamente a entrega final. Sincronização da aceitação entre jogadores, campanha natural e combinações ainda pendentes. Nenhuma mudança de produção necessária nesta rodada.

### Células e relays fora das paredes

- Posições de células e relays agora exigem margem de 1 unidade em relação às caixas de colisão e bordas da arena. Relays mantêm suas posições preferidas quando livres; posições bloqueadas são substituídas pelo ponto livre mais próximo em grade de 0,5 unidade.
- Células rejeitam candidatos bloqueados e usam a mesma busca após oito tentativas. Se não existir espaço, a célula permanece oculta e tenta novamente, sem aceitar uma parede como alternativa. Coordenadas são arredondadas à precisão de rede antes da validação.
- Cada objetivo guarda suas posições de relays, usadas para visualização e captura. O anfitrião transmite essas posições no snapshot para os convidados, sem recalculá-las a partir de paredes que possam ter sido destruídas.
- `objective-placement-smoke.cjs`: 1.023 posicionamentos de células e 99 relays aprovados nos 33 mapas, com margem verificada, captura dos três relays, coleta de célula, sorteio repetitivo e arena artificialmente toda bloqueada.
- Seis fluxos reais em dois clientes aprovados: células/relays em L-Wing, Hourglass e Delta Crossing com posições iguais. Regressões: cinco objetivos, falha do reator, loja da partida e 23 testes unitários aprovados.

### Progresso cooperativo de células e relays

- `objective-coop-progress-smoke.cjs`: dois clientes reais no mapa L-Wing, com posições e estado vital transmitidos por `PLAYER_STATE` e progresso transmitido pelo snapshot do anfitrião.
- Convidado vivo captura relay; convidado caído ou morto não participa. Um jogador avança 0,1 em 0,3 s; dois avançam 0,145 no mesmo intervalo. Sem jogadores, o progresso decai 0,1 em 0,25 s.
- Convidado captura os três relays, com contagem sincronizada. Dez células coletadas, com exclusão de mortos/caídos, coleta simultânea contada uma única vez, espera de três segundos entre células e conclusão sincronizada.
- Ambos os objetivos deixam de bloquear a conclusão da onda e ocultam seus objetos nos dois clientes. Nenhuma correção de produção necessária. O teste congela o loop de combate e avança o objetivo em passos controlados; não cobre travessia natural, latência externa ou desconexão durante captura.

### Armas contra ninhos e golpes do convidado

- `spawner-weapons-smoke.cjs`: 14 armas de fogo e cinco armas corpo a corpo causam dano a um ninho próximo ativado, usando o fluxo de ataque e atualização do jogo. Escudo bloqueia dano fora da área, permite dano dentro e volta a proteger após a saída.
- Reproduzido erro real em dois clientes: katana do convidado não danificava o ninho. O processamento autoritativo do golpe aceitava apenas o ID do próprio anfitrião nesse alvo.
- Corrigida a condição para permitir ataques de convidados processados pelo anfitrião. A saída antecipada de ataques somente visuais permanece em vigor. As cinco armas corpo a corpo do convidado passaram após a correção; confirmação usa uma mensagem de posição posterior ao ataque no mesmo canal ordenado.
- Regressões aprovadas: combate com 14 armas, cinco melees e Blade Sentinel; cinco objetivos, falha do reator e loja. Cenários preparados em arena livre, sem cobertura de alcance extremo, obstáculos entre atacante/alvo ou rede externa.

### Ninhos: dano autoritativo e projéteis visuais

- `spawner-authority-smoke.cjs`: reproduzida perda indevida de 75 HP no ninho do convidado por projétil marcado como somente visual. O teste usa dois clientes reais e um objetivo recebido pelo snapshot do anfitrião.
- `damageMiniObjectiveAt` agora rejeita alterações em objetivos somente visuais; `damageMiniObjectiveWithBullet` rejeita projéteis somente visuais, inclusive no anfitrião.
- Aprovados quatro cenários: projétil visual do convidado, efeito direto sobre a cópia do convidado, projétil visual do anfitrião e projétil autoritativo de dano 100 que retira 75 HP e sincroniza o resultado. O loop é avançado manualmente após preparar o projétil no alvo; não mede trajetória natural ou latência externa.

### Limite de ativação dos ninhos

- `spawner-boundary-smoke.cjs`: sete cenários controlados — centro, faixa externa (2,5), borda inclusiva (2,9), fora (2,901), saída, morte e queda antes da atualização seguinte do objetivo.
- Reproduzidas duas inconsistências: atualização/indicador usava raio 2,2 enquanto o dano usava 2,9; dano aceitava `armed` antigo mesmo sem jogador vivo próximo. Corrigidos com raio compartilhado e nova verificação de proximidade em cada impacto.
- Os sete cenários passaram após a correção. Verificados dano e estado de ativação, além do texto do indicador após atualização. São estados preparados em solo, sem simular travessia por teclado nem atraso de rede.
- Regressões aprovadas: 19 armas contra ninhos, cinco melees de convidados, autoridade/sincronização do dano, cinco objetivos, falha do reator, loja e 23 testes unitários. A execução concorrente do teste de armas excedeu o prazo na seleção inicial cooperativa; repetição isolada passou. A causa desse timeout não foi determinada.

### Reator: efeitos, limites e ajuda cooperativa

- `reactor-effects-smoke.cjs`: 18 verificações controladas em solo e dois fluxos em clientes conectados, todos aprovados. Nenhuma correção de produção necessária.
- Centro e borda inclusiva de raio 3 curam 3,6 HP/s e carregam 0,215/s com um jogador; fora, morto ou caído não ajuda. Cura respeita HP máximo; carga decai 0,035/s e não fica negativa.
- Pressão de chaser e tank causa respectivamente 2,2 e 4 HP/s; mortos ou fora da área não contribuem. Pulso da onda 3 causa 157 de dano no interior e na borda considerando raio do inimigo, preserva alvo externo, zera carga e não se repete imediatamente.
- Destruição e fim do tempo no mesmo passo resultam em falha sem recompensa. No cooperativo, dois jogadores curam 5 HP/s e carregam 0,3/s; convidado caído deixa de ajudar. Vida e carga são sincronizadas com a precisão do snapshot.
- Loop e estados são preparados pelo runner; não cobre pressão de bosses, partida natural prolongada, rede externa ou todas as combinações de habilidades.

### Storm Eyes: proteção e dano cooperativo

- `storm-eyes-smoke.cjs`: dez verificações solo e um fluxo real em dois clientes aprovados, sem mudança de produção. Centros das duas áreas e borda inclusiva protegem; imediatamente fora e longe causam 8 HP de dano na onda 3; jogador caído não recebe esse dano.
- Intervalo de 0,85 s impede aplicação antecipada; próximo impacto acontece após o intervalo. Áreas se movem, e a conclusão oculta os objetos e interrompe dano posterior.
- Cooperativo: anfitrião protegido permanece com 100 HP; convidado fora recebe 100 → 92 → 84 por mensagens do anfitrião. Atualização local do convidado não duplica dano. Timer, raio e posições das áreas coincidem após o snapshot.
- O primeiro comparador incluiu indevidamente o cooldown interno do anfitrião, que não é aplicado à cópia visual do convidado. Corrigido o teste para comparar estado visual compartilhado; a cadência é verificada pelas perdas reais de HP. Estados e tempo preparados; sem cobertura de caminhada natural ou latência externa.

### Veneno das reações elementais sem orbe

- `poison-reactions-smoke.cjs`: seis cenários — Combust (fogo), Brittle (gelo) e Corrode (raio), cada um com e sem orbe de veneno. Usa `tagElement` para disparar a reação e o loop real para avançar os efeitos.
- Reproduzido erro nos três cenários sem orbe: efeito registrado, mas sem dano e sem expiração. A atualização do veneno estava dentro da condição de existência do orbe. Movida para fora dessa condição, preservando a restrição anterior de jogador não morto.
- Após correção, danos periódicos de base 30/36/16, primeiro impacto, intervalo de 0,5 s, expiração, ausência de dano após expiração e limpeza ao reiniciar passaram com e sem orbe. Corrode verifica o veneno no alvo próximo atingido pela propagação.
- Regressões aprovadas: 14 armas, cinco melees, Blade Sentinel e 23 testes unitários. Cenários preparados em solo; autoria e propagação no cooperativo, todas as reações/níveis e alterações de build durante o efeito ainda não cobertas.

### Duração e limpeza de estados dos inimigos

- `status-lifecycle-smoke.cjs`: dez verificações aprovadas. Lentidão mais curta preserva a duração restante, mais longa renova, e duração zero remove o efeito. Marcas duram 3/4,5/6,6 s nos níveis efetivos 0/3/5 de Lingering Marks e ocultam seu indicador ao expirar.
- Reproduzida herança de estados ao reutilizar um slot de inimigo morto: lentidão, vulnerabilidade, veneno e marca elemental permaneciam. Um novo chaser recebia reação indevida ao ser atingido por gelo após herdar fogo. A liberação do slot agora remove esses estados e o indicador.
- Reinício e limpeza de magias do mapa também removem marcas e indicadores, anteriormente esquecidos. Regressões: seis cenários de veneno, 14 armas, cinco melees, Blade Sentinel e 23 testes unitários aprovados.
- Estados preparados em solo; não valida ainda todas as resistências de elites/bosses, ataques letais que aplicam estados depois do dano nem autoria das reações no cooperativo.

### Reações letais e seleção de alvos em corrente

- `lethal-reactions-smoke.cjs`: cinco reações letais preparadas em solo — Vapor, Combust, Shatter, Plasma e Corrode. Reproduzidos efeitos reaplicados após a morte em Vapor/Combust/Corrode e seleção incorreta de alvos após remoção de inimigos nas duas correntes.
- Plasma e Corrode guardavam índices da lista, alterados quando um alvo morria. No teste atingiam um inimigo distante e pulavam outros próximos. Agora guardam referências dos alvos e resolvem seu índice atual em cada impacto; respeitam os três vizinhos mais próximos.
- Lentidão não é aplicada a mortos; Combust e Corrode não reaplicam veneno após dano letal. Os cinco cenários passaram, sem estados residuais e com o quarto vizinho e alvo distante preservados.
- Regressões aprovadas: seis cenários de veneno, dez de ciclo de vida dos estados, 14 armas, cinco melees, Blade Sentinel e 23 testes unitários. Combinações com explosões encadeadas de outras habilidades e autoria no cooperativo ainda pendentes.

### Progressão contínua nas cinco dificuldades

- `node tests/progression-smoke.cjs <0..4>`: cinco partidas solo, uma por dificuldade, cada uma começando pela interface e avançando da onda 1 à entrada da 11 sem reiniciar nem atribuir números de onda. Total de 50 ondas concluídas, incluindo dez encontros com bosses (ondas 5 e 10).
- Mantidos os sorteios de mapas, eventos e recompensas do jogo. Cartas e resumo de boss são escolhidos/fechados pela interface; portais de onda e loja são acionados pela posição do jogador e atualização normal. Verificados avanço unitário de onda, tipo do mapa normal/boss, HP finito, pontuação/eliminações positivas, escolhas acumuladas e loja concluída até a onda 9.
- Invulnerabilidade, eliminações pela função normal de morte, posicionamento nos objetivos/portais e passos de simulação aceleram a execução. Não é uma partida natural nem teste de balanceamento, trajetórias, dificuldade de combate ou campanha completa; cobre a sequência integrada de progressão até dois bosses.
- Cinco execuções aprovadas, sem exceções de navegador e sem correção de produção nesta rodada. Relatórios: `test-results/progression-0.json` até `progression-4.json`. Sorteios permanecem aleatórios; uma execução não cobre todos os eventos ou todas as escolhas possíveis.

### Progressão contínua cooperativa

- `progression-coop-smoke.cjs`: dois contextos de navegador conectados, começando pela criação/entrada na sala e avançando da onda 1 à entrada da 11 sem reinicializar a partida. Aprovados dez avanços, dois bosses e passagens pelas lojas/recompensas nos dois clientes.
- Cada jogador escolhe suas cartas pela interface, fecha seu resumo de boss e atravessa o portal para enviar prontidão. O anfitrião executa a progressão e o convidado recebe as atualizações pela rede. Conferidos números consecutivos de onda, mesmo mapa em todas as entradas, HP finito/positivo, escolhas acumuladas, lojas encerradas até a onda 9 e pontuação compartilhada no final.
- Sem exceções de navegador ou correção de produção. Relatório: `test-results/progression-coop.json`. Os hooks de progressão solo foram exportados para reutilização no runner cooperativo; a versão publicada do jogo não recebe hooks.
- Combate/eliminações, invulnerabilidade e posicionamento são acelerados e controlados, como no teste solo. Ainda não cobre campanha inteira, desconexão durante a sequência, rede externa, todas as dificuldades no cooperativo ou mais de dois jogadores.

### Saída do convidado durante esperas cooperativas

- `departure-waits-smoke.cjs`: quatro cenários aprovados em dois navegadores conectados — saída pelo menu no portal de onda, saída da loja, espera de escolha de cartas e fechamento direto da aba durante a espera no portal.
- Anfitrião confirma prontidão sozinho enquanto há dois jogadores; saída remove o convidado da contagem e libera a transição. Portal abre a seleção de recompensa; loja da onda 4 inicia a onda 5 e marca a loja concluída; espera de cartas inicia a onda 2. Espera adicional verifica ausência de avanço duplicado.
- Estados de fim de onda/loja preparados para atingir as esperas; prontidão, escolha de cartas e saída usam os fluxos normais. A escolha de status pode exigir uma segunda carta antes de entrar em espera, ajuste incorporado ao runner.
- Nenhuma correção de produção necessária. Não cobre perda silenciosa de pacotes, desconexão simultânea, reentrada após a saída ou partida inteira com saída no meio do combate.

### Cancelamento da transição após escolha de recompensa

- `buff-transition-cancel-smoke.cjs`: quatro cenários preparados de anfitrião — próxima onda ou loja, seguidos de saída ao menu ou início de outra partida antes do callback de 350 ms.
- Reproduzidos três erros: próxima onda disparada na partida nova; loja aberta após retorno ao menu; loja aberta na partida nova. O callback agora exige a mesma geração de partida, onda, peer, papel de anfitrião, estado de espera e transição ainda pendente.
- Quatro cenários aprovados após a correção. O teste de cancelamento prepara o papel de anfitrião sem conexão real; regressão de progressão com dois clientes reais concluiu novamente dez ondas e dois bosses, com cartas e lojas. Os 23 testes unitários passaram.
- Outros callbacks de transição, perda silenciosa de conexão e trocas simultâneas de sala ainda exigem cobertura específica.

### Resgate com múltiplos aliados

- `multiple-revivers-smoke.cjs`: três navegadores conectados; anfitrião e cada um dos dois convidados alternam como jogador caído. Três sequências completas aprovadas, sem correção de produção.
- Sem ajudantes, sangramento avança e progresso fica em zero; um aliado na borda de 2,8 unidades progride 0,4 em 0,4 s e pausa o sangramento. Dois aliados progridem 0,6 no mesmo intervalo (1,5×). A saída de um volta à velocidade simples; saída dos dois retoma sangramento e reduz progresso em 0,7/s.
- Retorno dos dois completa o resgate, restaura 45% da vida máxima e sincroniza a recuperação nos outros clientes. Atualizar novamente não repete a cura.
- Posições são transmitidas pela rede e aguardadas no cliente da vítima; queda usa dano normal e resgate usa passos de tempo controlados com o loop congelado. Não cobre latência externa, quatro ou mais ajudantes, modificadores de alcance/tempo ou ping de resgate chegando fora de ordem.

### Alcance de resgate do Repair Drone

- `revive-range-smoke.cjs`: 24 cenários em dois clientes — anfitrião/convidado como vítima, quatro combinações de nível efetivo 0/3 entre vítima e aliado e distâncias 2,8/3,2/3,61.
- Reproduzida inconsistência: contagem local usava a habilidade da vítima para ampliar o alcance, embora o aliado enviasse ajuda conforme sua própria habilidade. Com apenas a vítima equipada, contava ajuda indevida a 3,2; com apenas o aliado equipado, deixava de contá-lo sem o fallback de ping.
- `effectiveReviveRange` aceita o conjunto de habilidades consultado; `updateDowned` usa as habilidades sincronizadas de cada aliado. Os 24 cenários passaram após a correção. Regressões: três sequências de resgate em três clientes e 23 testes unitários aprovados.
- Teste congela o loop e zera o último ping para verificar a contagem baseada em posições/habilidades recebidas, sem mascaramento pelo fallback. Latência, ping fora de ordem e modificadores de tempo ainda pendentes.

### Elemental Mastery e seis reações

- `elemental-mastery-smoke.cjs`: 78 cenários aprovados, sem correção de produção. Seis pares elementais × níveis efetivos 0–5 × duas ordens dos elementos (72), Shatter com/sem lentidão (2) e repetição de cada um dos quatro elementos (4).
- Verificados consumo da marca, mesmo resultado ao inverter a ordem, escala do dano imediato/veneno conforme +25/+45/+75/+110% anunciados pela habilidade (tolerância de arredondamento de 2), e preservação da duração de lentidão/veneno entre níveis.
- Plasma e Corrode selecionam somente os três vizinhos mais próximos apesar de ordem embaralhada na lista, preservando quarto vizinho e alvo distante. Shatter ganha dano contra alvo lento; repetir o mesmo elemento mantém uma marca sem disparar reação.
- Inimigos preparados com HP alto, críticos suprimidos somente durante a reação, sem loop de combate. Não cobre autoria no cooperativo, resistências de bosses, todas as combinações com relíquias ou efeitos encadeados de morte (estes têm teste separado).

### Resistência a controle e movimento

- `enemy-control-smoke.cjs`: 50 verificações de duração aprovadas — 14 tipos normais/elites/campeões e oito bosses. Aplicação de 2 s resulta em 2/1,24/0,8 s nas três categorias e 0,9 s nos bosses. Reaplicação curta não reduz a duração nos 42 casos não-boss.
- Movimento real de chaser, tank, shieldBearer, splitterling e berserker verificado em passos de atualização: lentidão reduz deslocamento a 35%, expiração restaura a velocidade, stagger interrompe o deslocamento e sua remoção permite movimento novamente.
- Nenhuma correção de produção necessária. Arena livre e estado preparado; variantes são atribuídas ao inimigo para verificar resistência. Não cobre todos os movimentos especiais (dash/teleporte), ataques durante controle, combinações com auras ou controle recebido pela rede.

### Ataques de contato dos inimigos

- `enemy-contact-smoke.cjs`: oito atacantes aprovados — chaser, speeder, tank, dasher sem dash ativo, shieldBearer, splitter, berserker e splitterling. Dano-base observado: 16/9/28/16/22/18/14/7, com multiplicador preparado em 1.
- Loop real verifica primeiro golpe, ausência de repetição imediata, espera até o cooldown e segundo golpe; alvo distante não perde HP. Invulnerabilidade protege e barreira absorve um golpe sendo consumida. Dois atacantes simultâneos não duplicam dano devido à invulnerabilidade após o primeiro impacto.
- Nenhuma correção de produção necessária. Arena sem obstáculos, inimigos imóveis e dano sem escalonamento; não cobre dash ativo, bomba telegrafada, projéteis, elites, ataque a summons ou transmissão do impacto a convidados.

### Cura e invocação de inimigos

- `enemy-support-smoke.cjs`: oito cenários de cura e 18 de invocação aprovados. Cura normal: alcance na borda de 5 unidades, exclusão em 5,001, limite de HP, ausência de autocura e exclusão de mortos, elites, campeões e alvo marcado como boss; atualização imediata não repete a cura.
- Invocadores normais, elites e campeões nas ondas 1/14: quantidade invocada, tipos chaser/speeder, cooldown de 5,5–7 s e ausência de repetição imediata. Contagens iniciais 44/45/46/47 verificam a borda e bloqueio quando a arena já está cheia.
- Reproduzido erro nas três versões: com 45 inimigos, o ataque criava dois e ultrapassava o limite de 46. Corrigidos os laços de invocação normal e especial para conferir o limite antes de cada criação. Inimigos já existentes acima do limite são preservados, mas nenhuma invocação adicional ocorre.
- Regressão após a correção: 82 cenários de inimigos/bosses e 23 testes unitários aprovados.
- Arena e estados preparados, loop executado em passos controlados. Não cobre intervalo completo até nova invocação, posicionamento dos invocados em obstáculos ou sincronização cooperativa.

### Cura especial de elites e campeões

- `enemy-support-smoke.cjs` ampliado com 40 cenários: healer/shieldBearer × elite/champion × dez condições. Todos aprovados, junto dos oito testes de cura normal e 18 de invocação existentes (66 ao todo).
- Healer especial restaura 7% do HP máximo em raio de 6; shieldBearer restaura 5% em raio de 5. Verificados borda, posição 0,001 além do raio, limite de HP, alvo cheio, autocura bloqueada, mortos/elites/campeões/bosses excluídos e três aliados curados na mesma ativação.
- Simulação em passos de 0,01 s confirma ausência de cura adicional antes do cooldown e segunda cura após expirar. Intervalos observados dentro de 3,8–4,8 s (healer) e 4–5 s (shieldBearer), multiplicados por 0,7 para campeões.
- Nenhuma mudança de produção. Corrigida uma expectativa inicial do teste que usava intervalo errado para shieldBearer. Arena livre, alvos imóveis e estados/variantes preparados; cura normal do healer desabilitada por cooldown para isolar a especial. Alvo boss é marcado por tipo, sem simular um boss completo. Sincronização cooperativa e interação com outras curas continuam pendentes.

### Suporte dos inimigos no cooperativo

- `enemy-support-coop-smoke.cjs`: 11 cenários aprovados em dois contextos de Chrome conectados pela sala real. Cinco cenários de cura (healer normal/elite/campeão e shieldBearer elite/campeão) e seis de invocação (três variantes, com 1 ou 45 inimigos iniciais).
- Três aliados recebem 8% de cura normal, 7% especial do healer ou 5% do shieldBearer; fonte permanece sem autocura. Invocação gera somente chaser/speeder, respeita quantidade por variante e limita o total a 46.
- Snapshot recebido pelo convidado corresponde ao anfitrião em identificadores, tipo, vida, vida máxima e variante. Com cooldowns locais preparados em zero, atualização do convidado antes/depois da transmissão não executa nem repete cura/invocação. Segunda atualização imediata do host respeita cooldown.
- Nenhuma correção de produção. Estados e arena preparados, loop congelado entre passos; canal de rede e aplicação de HOST_STATE reais. Não cobre latência externa, perda de pacotes, reconexão, posicionamento em paredes, efeitos visuais ou ciclo completo até nova invocação. Cura especial isolada da normal por cooldown.

### Posicionamento de inimigos invocados

- `summon-placement-smoke.cjs`: 33 mapas, 626 solicitações diretas de spawn de chaser/speeder nos centros dos obstáculos e quatro cantos externos; 792 ativações reais de summoner normal/elite/campeão, totalizando 2.640 filhos. Quatro valores fixos de RNG e duas posições por mapa exercitam direções e distâncias diferentes. Verificados círculo de colisão e limites imediatamente na criação e após update.
- Reproduzido nascimento dentro da área sólida de L-WING: a projeção local de até quatro unidades podia falhar e `spawnEnemy` usava a posição bloqueada mesmo assim. Agora, somente quando essa projeção falha, procura o ponto livre mais próximo em uma grade de 0,5 unidade pela arena; sem ponto disponível, não cria o inimigo.
- Todos os casos passaram após a correção. Arena artificial totalmente bloqueada também rejeita os três tipos chaser/speeder/summoner sem criar inimigos. Relatório de execução: `test-results/summon-placement-after.log`. Regressões aprovadas: 82 cenários de inimigos/bosses, 11 de suporte cooperativo e 23 testes unitários.
- Teste usa estados preparados, fontes imóveis e sorteio controlado; inclui pedidos de spawn deliberadamente dentro das paredes. Não prova todas as coordenadas contínuas, trajetórias de saída, posicionamento de todos os demais tipos ou rede instável. A checagem inicial do teste foi ajustada para círculo contra retângulo, conforme a colisão do jogo, evitando rejeitar cantos livres.

### Posicionamento de todos os arquétipos comuns

- `summon-placement-smoke.cjs` ampliado para os 14 tipos não-boss do catálogo: 4.382 pedidos diretos nos centros dos obstáculos e quatro cantos externos dos 33 mapas. Todos criam exatamente um inimigo com coordenadas finitas, círculo fora de obstáculos e dentro dos limites da arena.
- Os 14 tipos também recusam criação na arena artificial totalmente bloqueada. Mantidos e aprovados os 792 ataques de invocação e 2.640 filhos da cobertura anterior. Execução completa aprovada: `test-results/enemy-placement-all-types.log`.
- Nenhuma nova alteração de produção. Teste exercita os raios de colisão próprios de cada arquétipo; não cobre spawn de bosses (função separada), todos os pontos contínuos, variações visuais dos tiers ou trajetórias após nascimento.

### Nascimento dos bosses e multiplicação pelo totem

- `boss-placement-smoke.cjs`: 160 cenários aprovados — oito bosses × cinco dificuldades × 0/1/2/3 usos preparados do totem. A função real `spawnWave` cria respectivamente 1/2/4/8 bosses, totalizando 600 nascimentos verificados nos mapas próprios de cada boss.
- Conferidos círculo de colisão fora das paredes, limites da arena, coordenadas finitas, nome correto, IDs únicos, vida inicial positiva/finita igual ao máximo e `waveEnemyTotal` igual à quantidade criada.
- Nenhuma alteração de produção necessária. Teste prepara dificuldade, onda, mapa e usos do totem, sem executar compras; não cobre combate contra oito bosses simultâneos, separação entre os corpos, mapa artificial totalmente bloqueado, alterações futuras de geometria ou sincronização cooperativa desses nascimentos.

### Grupos de bosses no cooperativo

- `boss-groups-coop-smoke.cjs`: 32 cenários aprovados em dois navegadores conectados — oito bosses × grupos de 1/2/4/8 gerados por `spawnWave` com usos preparados do totem.
- Anfitrião e convidado concordam em mapa, onda, identidades únicas, tipo/nome, vida e vida máxima de todos os bosses. Dano pela função normal afeta somente o primeiro e chega ao convidado; nos 24 grupos múltiplos, morte de um boss no meio da lista remove exatamente sua identidade e preserva os demais, com snapshot correspondente no convidado.
- Nenhuma correção de produção necessária. Loop congelado, preparações de onda/mapa/totem e dano/morte disparados pelo runner; rede e handlers reais. O teste não executa combate natural, fases/ataques simultâneos, morte do último boss, recompensa final, várias dificuldades ou condições de rede externa.

### Combate simultâneo de grupos de bosses

- `boss-groups-combat-smoke.cjs`: 24 cenários aprovados na dificuldade hard — oito tipos de boss × grupos de 2/4/8, nos mapas próprios, usando spawn de onda com usos preparados do totem. Total de 72 etapas de fase e 336 verificações individuais de atividade de ataque (112 bosses × três fases).
- Vida preparada em 100%/60%/30% ativa as fases 1/2/3. Cada etapa executa quatro segundos de atualização em passos de 1/60 s; todos os bosses permanecem vivos/presentes e incrementam sua sequência de ataque. A cada passo, vida/posição dos inimigos e posição/tempo de vida dos projéteis ativos permanecem finitos, sem conclusão prematura da onda ou erro de navegador.
- Nenhuma alteração de produção. Relatório: `test-results/boss-groups-combat.json`. Jogador invulnerável e cooldowns iniciais preparados em zero; não cobre balanceamento, acerto/dano de cada ataque, separação entre corpos, derrota/recompensa final, outras dificuldades ou transmissão simultânea desses ataques no cooperativo.

### Recompensas após eliminar o grupo inteiro

- `boss-group-rewards-smoke.cjs`: quatro fluxos solo aprovados com WARDEN, grupos de 1/2/4/8 gerados por `spawnWave` e 0/1/2/3 usos preparados do totem. Eliminações usam `killEnemy`, seguidas de atualização normal controlada.
- Antes da última morte, nenhuma recompensa é agendada, a onda não está concluída e o portal permanece fechado. A última morte agenda exatamente uma recompensa e conclui a onda; resumo é fechado e cartas/relíquias são escolhidas pela interface.
- Recebidos respectivamente 1 carta; 1 carta + 1 relíquia; 2 cartas + 1 relíquia; 2 cartas + 2 relíquias. Ao terminar, bônus restantes zerados, estado playing e portal aberto; dez novas atualizações não repetem a recompensa.
- Nenhuma mudança de produção. Oferta de habilidade fixada em Rapid Fire para isolar bônus do totem de habilidades que concedem escolhas extras; relíquias continuam sorteadas. Não cobre todos os bosses, modificadores de recompensa, catálogo esgotado ou entrega cooperativa do grupo completo.

### Entrega cooperativa das recompensas do grupo completo

- `boss-group-rewards-coop-smoke.cjs`: quatro fluxos aprovados em salas reais de dois clientes, WARDEN com 1/2/4/8 bosses. Estado preparado antes da onda 5; usos do totem enviados por SHOP_TOTEM_STATE, entrada da onda anunciada por HOST_STATE e grupo criado por spawnWave.
- Mortes transmitidas uma a uma: nenhum cliente agenda recompensa antes da última; ambos agendam uma única vez após eliminar o grupo. Resumo fechado e escolhas realizadas pela interface de cada jogador.
- Cada cliente recebe respectivamente 1 carta; 1 carta + 1 relíquia; 2 cartas + 1 relíquia; 2 cartas + 2 relíquias. Ao concluir, estado playing, portal aberto e bônus zerados. Dez atualizações adicionais por cliente não duplicam o agendamento.
- Nenhuma alteração de produção. Oferta de Rapid Fire fixa isola extras aleatórios de habilidades; relíquias sorteadas. Loop congelado entre passos, totem/onda preparados e entrada da onda transmitida antes de spawn/reset do totem; não cobre perda/reordenação de mensagens, reconexão, passagem conjunta pelo portal, todos os bosses ou modificadores de recompensa.

### Heavy Crown e recompensas do totem

- Reproduzido erro: Heavy Crown nível 1 prometia uma escolha extra, mas só aumentava o número de opções da oferta; após um boss, entregava uma carta em vez de duas. `queueBossReward` agora acrescenta o bônus pessoal da coroa às escolhas pendentes quando a recompensa válida é aberta. O fluxo mantém o limite existente de três escolhas; texto de bônus passa a BOSS BONUS, pois agora pode vir da coroa ou do totem.
- `boss-group-rewards-smoke.cjs` ampliado para 16 fluxos solo: níveis de coroa 0/1/2/3 × usos de totem 0/1/2/3. Todos aprovados, com quantidade de cartas igual a min(3, base + bônus do totem + bônus da coroa), relíquias do totem preservadas e saída normal sem repetição.
- `node tests/boss-group-rewards-coop-smoke.cjs 1 3`: quatro fluxos adicionais aprovados em dois clientes, anfitrião com coroa nível 1 e convidado nível 3, verificando bônus pessoais para grupos de 1/2/4/8 e todas as relíquias previstas. O runner aceita níveis opcionais; sem argumentos mantém a regressão sem coroa.
- Oferta de Rapid Fire fixa, estados preparados, mortes por função normal e escolhas pela interface. Outras relíquias que alteram escolhas, perda de mensagens e catálogo esgotado ainda precisam de cobertura específica. Os 23 testes unitários passaram após a correção.

### Fate Gambit: sucesso, falha e quarta carta

- `fate-gambit-rewards-smoke.cjs`: 12 cenários solo — recompensa comum/boss × níveis 1/2/3 × sucesso/falha. Reproduzido erro em ambos os fluxos: nível 3 bem-sucedido concedia apenas três cartas em vez das quatro anunciadas.
- Os handlers de escolha barravam a continuação ao atingir três cartas, antes de consultar os extras de Fate Gambit. Agora deixam continuar enquanto a relíquia ainda deve cartas; o limite geral dos demais bônus permanece.
- Após a correção, todos os cenários passaram: sucesso entrega 2/3/4 cartas, falha entrega zero, somente um sorteio por sequência, interface fecha e estado da relíquia é limpo. Recompensa de boss termina com portal aberto. Regressões: 16 fluxos de Heavy Crown/totem e 23 testes unitários aprovados.
- Oferta de Rapid Fire fixa e RNG controlado somente na decisão de Fate Gambit (0 para sucesso, 0,999 para falha); escolhas pela interface real. Estado de recompensa preparado, sem combate ou rede. Não mede distribuição estatística, limiar exato das probabilidades ou combinações com outros modificadores.

### Fate Gambit: limiares e nova oferta

- `fate-gambit-rewards-smoke.cjs` ampliado para 18 sequências/36 ofertas: fases skill/boss × níveis 1/2/3 × RNG imediatamente abaixo, igual e acima dos limiares 0,8/0,7/0,6. Todos aprovados: abaixo concede 2/3/4 cartas; igual/acima não concede nenhuma.
- Cada sequência abre uma segunda oferta na mesma partida com resultado oposto (RNG 0 ou 0,999). Confirmados dois sorteios totais, um por oferta, nenhuma herança de sucesso/falha, nenhuma carta extra residual e interface fechada ao término. Não houve nova alteração de produção.
- A segunda oferta é aberta diretamente pelo runner para testar limpeza do estado da relíquia; isso não representa uma campanha natural nem valida a origem dessa nova recompensa. Oferta de habilidade fixa e RNG controlado somente na relíquia. Distribuição estatística, cooperativo e combinações de modificadores seguem pendentes.

### Fate Gambit no cooperativo

- `fate-gambit-coop-smoke.cjs`: seis fluxos aprovados em dois clientes conectados — níveis 1/2/3, alternando anfitrião e convidado como jogador com sucesso enquanto o outro falha. Boss WARDEN criado e eliminado pelo anfitrião; morte/estado transmitidos e recompensa acionada em ambos.
- Após fechar o resumo, quem falha recebe zero cartas e retorna a playing com portal aberto; o outro continua escolhendo e recebe 2/3/4 cartas. Cada cliente faz um único sorteio e agenda uma única recompensa. HOST_STATE também é transmitido enquanto as telas dos jogadores estão em etapas diferentes, sem interromper a escolha restante.
- Nenhuma mudança de produção. Estado de onda e relíquias preparados, oferta Rapid Fire fixa, RNG controlado somente no sorteio Fate Gambit e cliques reais na interface. Não cobre passagem pelo portal antes de o aliado concluir, recompensa comum cooperativa, todos os bosses, modificadores combinados ou rede instável.
- Hooks do runner de recompensas cooperativas foram exportados para reutilização, mantendo execução direta protegida por `require.main===module`.

### Portal enquanto o aliado escolhe a recompensa

- `fate-gambit-coop-smoke.cjs` ampliado: os seis cenários agora incluem entrada antecipada no portal por quem perdeu a recompensa, alternando anfitrião/convidado e os três níveis da relíquia. Todos passaram novamente.
- Posição do jogador colocada no portal e atualização normal acionam prontidão; anfitrião recebe exatamente uma confirmação. Após espera superior ao callback de transição, nenhuma transição está enfileirada, onda permanece 5 e o aliado continua escolhendo.
- Terminadas as cartas, a entrada do segundo jogador leva ambos à seleção de status pós-portal. Conferidos fase status, waveClear falso, prontidão zerada e onda ainda 5, inclusive após nova espera; nenhuma seleção foi interrompida ou transição duplicada.
- Nenhuma alteração de produção. Rede real, posições e passos preparados; não cobre saída/reconexão durante essa espera, seis jogadores ou conclusão da seleção de status até a próxima onda.

### Saída durante recompensa de boss e espera no portal

- `reward-departure-coop-smoke.cjs`: quatro cenários aprovados em dois clientes, alternando quem sai (anfitrião/convidado) e quem ainda escolhe quatro cartas da Fate Gambit nível 3. O outro jogador já está pronto no portal.
- Saída do anfitrião pelo fluxo de menu leva o convidado ao menu e oculta a recompensa, sem reabertura após 700 ms. Saída do convidado libera imediatamente o anfitrião que aguardava no portal; quando o anfitrião ainda escolhe cartas, preserva as quatro escolhas e permite saída ao terminar.
- Continuação do anfitrião chega à seleção de status pós-portal na onda 5, sem duplicação após nova espera. Nenhuma alteração de produção necessária. Hooks do teste Fate cooperativo exportados para reutilização, com execução direta preservada.
- Sala real, estado/posições preparados e saída via função normal de menu. Não cobre fechamento abrupto, perda silenciosa de conexão, reconexão ou saída durante a animação de uma carta já clicada.

### Fechamento da aba durante recompensa e portal

- `node tests/reward-departure-coop-smoke.cjs --close-tab`: quatro cenários adicionais aprovados, alternando aba fechada (anfitrião/convidado) e jogador ainda escolhendo quatro cartas. A variante padrão de saída pelo menu continua disponível.
- Fechar a aba do anfitrião devolve o convidado ao menu e esconde a recompensa; fechar a do convidado libera a espera do anfitrião pronto ou preserva suas cartas pendentes até concluir e entrar no portal. Estado posterior permanece estável após 700 ms, sem avanço duplicado.
- Nenhuma alteração de produção. Fechamento real da página com conexão local ativa; não equivale a perda silenciosa de internet, encerramento forçado do processo ou reconexão. Saída durante animação de carta ainda não coberta por este teste.

### Cancelamento durante animação de recompensa

- `reward-animation-cancel-smoke.cjs`: seis cenários solo aprovados — carta comum, carta de boss e relíquia, seguidas de saída ao menu ou início de nova partida enquanto a animação de 650 ms está pendente.
- Clique e cancelamento executados na mesma avaliação, com confirmação de que a animação iniciou. Após 900 ms, estado, onda, habilidades, relíquias, bônus pendentes, portal e visibilidade da seleção correspondem ao snapshot imediatamente posterior ao cancelamento.
- Nova partida é preparada na mesma fase de recompensa para exercitar isolamento entre gerações mesmo com gState igual. Uma escolha nova funciona e concede exatamente uma habilidade/relíquia, sem travar a interface. Nenhuma alteração de produção necessária.
- Ofertas fixas de Rapid Fire/Heavy Crown e fases preparadas; não é navegação natural de nova partida. Não cobre cancelamento por desconexão cooperativa, clique no exato instante de conclusão ou persistência de uma recompensa já aplicada.

### Desconexão durante animação de recompensa cooperativa

- `reward-animation-coop-smoke.cjs`: quatro cenários aprovados em dois clientes — carta de boss/relíquia × saída de anfitrião/convidado. Ambos clicam a recompensa, confirmando animação iniciada, antes da saída pelo fluxo normal de menu.
- Ao sair o anfitrião, ambos permanecem no menu e nenhuma recompensa pendente é aplicada. Ao sair somente o convidado, sua recompensa é cancelada e o anfitrião conclui exatamente uma escolha, voltando a playing com seleção oculta. Verificação após 900 ms, além do callback de 650 ms.
- Nenhuma alteração de produção. Rede real; recompensa preparada diretamente, ofertas Rapid Fire/Heavy Crown fixas e loop congelado. Não cobre perda silenciosa da conexão, reconexão ou disputa no instante exato em que o callback termina.

### Combinações Fate Gambit, Heavy Crown e totem

- `fate-combinations-smoke.cjs`: 24 fluxos solo aprovados — Fate Gambit níveis 1/2/3 × sucesso/falha forçados × Heavy Crown ausente/nível 3 × totem 0/3 usos. Grupo WARDEN eliminado pelas funções normais, resumo fechado e recompensas escolhidas pela interface.
- Confirmada política atual: novas ofertas bônus param quando o total já alcançou três cartas, mas uma sequência Fate iniciada termina por completo. Com sucesso fixo, nível 1 recebe duas cartas sem bônus ou quatro com bônus disponível; nível 2 recebe três; nível 3 recebe quatro. Falhas sucessivas consomem as ofertas disponíveis sem conceder cartas.
- Duas relíquias do totem são entregues mesmo quando todos os sorteios de cartas falham. Verificados número de sorteios por oferta, bônus zerados, portal aberto, retorno a playing e único agendamento de recompensa. Nenhuma alteração de produção necessária.
- Oferta de Rapid Fire fixa e RNG controlado somente na Fate; relíquias sorteadas. Não cobre sequência mista de sucesso/falha entre ofertas, níveis intermediários de Crown/totem nesta combinação, Lucky Streak/Draw, catálogo esgotado ou coop combinado. Hooks do runner solo de recompensas exportados para reutilização.

### Fate Gambit com sucessos e falhas intercalados

- `node tests/fate-combinations-smoke.cjs --mixed`: 12 sequências — quatro padrões de sorteio nos três níveis, com Heavy Crown 3 e três usos do totem. Reproduzido erro no nível 1: sucesso/falha/sucesso/sucesso entregava seis cartas e consumia quatro ofertas, quando o limite acumulado deveria encerrar após quatro cartas em três ofertas.
- A falha de Fate Gambit zerava `_rewardPickCount`, apagando o histórico de escolhas da mesma recompensa. No fluxo de boss, agora limpa apenas o sorteio de Fate; o encerramento final continua limpando o contador. O fluxo comum mantém sua limpeza existente.
- Doze sequências aprovadas após a correção, com cartas/sorteios esperados, duas relíquias do totem preservadas, bônus consumidos e retorno ao portal. Teste alterna Rapid Fire para Spread se necessário, para não mascarar excesso de cartas pelo limite de nível da habilidade.
- RNG controlado, escolhas pela interface e grupo WARDEN preparado. Não cobre todas as sequências possíveis, sorteios probabilísticos ou cooperativo misto. Regressões aprovadas após a correção: 24 combinações de resultados constantes e 23 testes unitários.

### Projéteis e ataques telegrafados de inimigos

- `enemy-ranged-smoke.cjs`: 12 cenários aprovados. Shooter e sniper: projétil gerado pela IA, impacto real no jogador e desvio depois do disparo. Danos-base observados 14/32; sniper não dispara antes de completar a preparação de 0,65 s.
- Bomber e disruptor: aviso visível sem dano antecipado, impacto de 20/13 após 0,38/0,82 s, desvio para fora da área, cancelamento pela limpeza e bloqueio por barreira. Atualização posterior não repete o impacto e remove os avisos.
- Nenhuma correção de produção necessária. Solo, arena livre, inimigos imóveis, multiplicador de dano 1 e sorteio fixado durante mira; projéteis avançam pelo loop real. Não cobre paredes, summons, elites, variações de dispersão ou transmissão de dano a convidados.
