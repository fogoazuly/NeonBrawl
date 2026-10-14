# Plano de trabalho

## Etapa 1 — Independência local

- Preservar o material original e mapear as integrações ausentes.
- Servir o cliente e as bibliotecas pelo PC.
- Substituir sinalização externa por PeerServer local.
- Usar economia local existente e implementar ranking, instruções e convites locais.
- Validar solo, compra e recarga do progresso, entrada de um segundo jogador e início cooperativo.

## Etapa 2 — Organização do código

- [x] Extrair JavaScript e CSS do HTML, preservando a ordem de carregamento.
- [x] Separar codec de salvamento, validação de backups e interface de importação/exportação.
- [x] Adicionar exportação/importação com prévia e recuperação do progresso anterior.
- [x] Extrair colisões/desvios e cálculo de dano/críticos, comparando com o código anterior.
- [x] Extrair configuração da cena, câmera, iluminação, bloom e redimensionamento.
- [x] Extrair criação do estado multiplayer e transporte das mensagens.
- [x] Extrair criação/entrada/saída das salas, reconexão e cancelamento de tentativas antigas.
- [ ] Extrair tratamento das mensagens de gameplay e sincronização multiplayer.
- [ ] Extrair projéteis, ataques e atualização dos inimigos.
- [ ] Extrair modelos/efeitos visuais e telas restantes do módulo principal.
- [ ] Criar perfis locais e coordenar salvamento entre abas.
- [ ] Recuperar os recursos visuais/sonoros ausentes, ou criar substitutos.

## Etapa 3 — Hospedagem gratuita

- Comparar planos disponíveis na ocasião: Node.js, WebSocket, suspensão por inatividade e limites de tráfego.
- Configurar HTTPS, proxy e STUN/TURN com credenciais temporárias.
- Testar jogadores em redes diferentes, reconexão e saída do anfitrião.
- Decidir se o progresso continuará no dispositivo ou terá contas e banco de dados.
- Para ranking público e economia compartilhada, implementar validação no servidor. O ranking local e os comandos de desenvolvimento do cliente não servem como fonte confiável de pontuações públicas.

## Limites desta entrega

O servidor local conecta as salas; a simulação permanece no navegador anfitrião. A saída do anfitrião não transfere a simulação para o servidor. Não foram implementados login, nuvem, ranking global ou publicação. Testes neste PC não confirmam funcionamento em redes externas nem sessões longas com seis jogadores.
