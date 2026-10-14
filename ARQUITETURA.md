# Estrutura do cliente

O navegador carrega `local/game.js` como módulo. Ele cria os sistemas, fornece as dependências e coordena a partida. Os módulos extraídos não importam `game.js`, evitando dependências circulares.

| Módulo | Responsabilidade | Dependências recebidas |
| --- | --- | --- |
| `combat/collision.js` | Consultas geométricas, resolução de obstáculos, ricochetes e desvios | Dimensões da arena e referência ao array de obstáculos |
| `combat/damage.js` | Dano, críticos, blindagem, execução e vulnerabilidade | Tabelas de balanceamento, leitores do estado atual e callback do efeito de execução |
| `rendering/scene.js` | Cena Three.js, câmera, luzes, bloom, resize e render de cada frame | Canvas, dimensões da arena e opções gráficas |
| `multiplayer/state.js` | Estado inicial independente de cada sessão e constantes de sincronização | Nenhuma |
| `multiplayer/transport.js` | Serialização e envio ao anfitrião ou aos convidados | Estado da sessão e função que obtém a configuração PeerJS |
| `multiplayer/rooms.js` | Criação, entrada, saída, tentativas e reconexão das salas | Estado, criação de peers, transporte, identidade e callbacks de UI/entidades |
| `save-codec.js` | Codificação compatível com o save original | Objeto de progresso ou save codificado |
| `progress-backup.js` | Validação, exportação e cópia anterior | Esquema do progresso e armazenamento |
| `backup-ui.js` | Seleção de arquivos, prévia e confirmação | Leitor do progresso e condição para permitir importação |

## Regras para continuar a extração

- Sistemas de colisão recebem o array vivo de obstáculos. Mudanças de mapa esvaziam/preenchem esse array; não trocar sua referência sem atualizar o sistema.
- O cálculo de dano consulta jogador, habilidades e vulnerabilidades por funções. Assim, reiniciar uma build não deixa referências antigas no módulo.
- O efeito visual de execução fica no coordenador e mantém o limite de frequência original. O módulo de dano não acessa DOM ou Three.js.
- O transporte consulta `mp.conns` em cada envio, porque sair/reentrar em uma sala pode substituir o mapa de conexões. Uma falha ao enviar a um convidado não interrompe os demais envios.
- O ciclo das salas invalida callbacks e cancela timers antes de fechar a sessão. Respostas de configuração atrasadas e eventos de peers anteriores não podem recriar uma sala abandonada.
- Vagas são reservadas antes de abrir o canal de dados. A reserva pertence à conexão; eventos atrasados de um convidado que saiu não liberam a vaga do substituto.
- Reconexão aguarda `JOINED` por até cinco segundos; abrir o canal sozinho não confirma a entrada. UI e entidades permanecem no coordenador, chamadas por callbacks explícitos.
- A cena registra seu próprio listener de resize. `dispose()` libera o renderer, o pós-processamento e esse listener; modelos e materiais do mundo continuam sendo responsabilidade dos sistemas que os criaram.
- Criar sistemas por funções, sem estado compartilhado no nível do módulo. Manter os efeitos de inicialização no coordenador ou na criação explícita do sistema.

## O que continua no coordenador

Interpretação das mensagens de gameplay, entidades remotas, retorno visual ao menu, projéteis, ataques, IA, modelos, efeitos visuais e parte das telas ainda estão em `game.js`. O módulo de salas trata `JOINED` e repassa as demais mensagens ao coordenador. Esta etapa não conclui toda a modularização.

O próximo recorte é o tratamento das mensagens multiplayer, separando sincronização de jogadores, estado do anfitrião e comandos de partida. O formato atual das mensagens deve ser mantido enquanto essa extração avança.

## Verificação

`tests/systems.test.mjs` compara 300 cenários geométricos e 160 cenários de dano com `backup/game.before-systems.js`, além de verificar obstáculos alterados, build reiniciada e transporte com conexões fechadas. Esse snapshot é referência de regressão e não é servido pelo servidor HTTP.

Os testes de navegador cobrem primeira onda solo/cooperativa, loja e backups. O teste específico de renderização exercita bloom e resize usando Three.js real no Chrome. Sessões longas e redes externas continuam fora dessa validação.

`tests/rooms.test.mjs` exercita entrada simultânea, limite e reutilização de vagas, limpeza, tentativas canceladas, falhas e reconexão com peers e relógio controlados. `tests/rooms-smoke.cjs` exercita o ciclo de salas com duas páginas reais e interrupção de um canal WebRTC em um perfil temporário.
