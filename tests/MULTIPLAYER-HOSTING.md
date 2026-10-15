# Infraestrutura multiplayer — 15/10/2026

Servidor de sinalização publicado: https://neonbrawl-rooms.onrender.com
Render: serviço `neonbrawl-rooms`, plano Free, região Oregon, branch main.
Build `npm ci`; start `node server.mjs`; HOST=0.0.0.0; TRUST_PROXY=1.
Repositório público conectado por URL: atualizações do servidor exigem deploy manual no painel.

O servidor conecta as salas; a simulação continua no navegador do anfitrião.
GitHub Pages continua com multiplayer desativado até configurar a variável de Actions
PEER_SERVER_URL com a origem HTTPS acima. O build exporta somente endereço público e STUN.
O cliente aguarda até 90 segundos para acordar a instância antes de iniciar PeerJS.

Verificações: /health, /peerjs/peerjs/id com CORS para Pages, configuração TLS,
rejeição de URLs com credenciais e smoke do site com solo na onda 1.
Ainda pendentes: TURN com credenciais temporárias geradas no backend, teste de partida
entre duas redes reais e teste de reconexão em ambiente publicado.
STUN sozinho não garante conexão em redes restritas. Não inserir chaves permanentes TURN no build.

## Integração TURN preparada

`POST /api/ice` valida o token com Supabase Auth antes de fornecer credenciais
temporárias Cloudflare (24 horas, para suportar runs longas; sem renovação durante runs maiores).
Cache por usuário por 10 minutos, respostas no-store, timeout de 15 segundos,
limite global de 120 pedidos/minuto e 500 usuários no cache. Esses limites protegem
a emissão; não limitam os GB consumidos no provedor. Uma instância beta apenas.
Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, TURN_KEY_ID e TURN_KEY_API_TOKEN
no Render e faça deploy manual. A chave permanente nunca entra no runtime-config.
Depois de validar relay real, configure TURN_ENABLED=1 e PEER_SERVER_URL no Pages.

Teste com o site público e sinalização Render passou: código inválido, entrada/saída,
reutilização de vaga, anfitrião saindo, nova sala e reconexão real do canal WebRTC.
Executado em dois clientes na mesma máquina, com runtime-config substituído apenas
no teste. Não é comprovação entre duas redes nem teste de relay TURN.

A conta Cloudflare foi criada, mas não ativada: o proprietário escolheu uma alternativa
sem cartão/PayPal. O workspace Metered `neonbrawl-fogoazuly` foi criado e a opção
Free Trial Global de 500 MB foi selecionada. O resumo inicial exibiu dados diferentes
antes de carregar; usar o limite de 500 MB confirmado na tela de ativação.

## Alternativa Metered preparada (ainda não publicada)

No Render, configurar TURN_PROVIDER=metered, METERED_DOMAIN=neonbrawl-fogoazuly.metered.live
e METERED_API_KEY com a chave de uma credencial dedicada à beta; manter também as
duas variáveis públicas Supabase. Não é necessária a chave mestra do Metered.
O backend consulta GET /api/v1/turn/credentials e só devolve urls/username/credential
após validar a conta. A chave da API fica no servidor, mas a credencial TURN é
necessariamente recebida pelo jogador e pode ser copiada para consumir a franquia.
Esta opção usa uma credencial compartilhada revogável, sem expiração automática;
não confundir com as credenciais temporárias do adaptador Cloudflare.
Rotacionar pelo painel se necessário e acompanhar a franquia antes de ampliar a beta.

39 testes automatizados passaram, incluindo autenticação, cache, respostas inválidas,
remoção de campos extras e bloqueio de domínio inválido/redirecionamento no Metered.
Ainda falta criar a credencial, armazená-la no Render, publicar o backend e testar
relay real antes de habilitar o Pages. Formulário preparado como `NeonBrawl multiplayer beta`.
Criação da credencial e envio da chave ao Render aguardam confirmação específica
exigida pelas regras do controle de navegador.

Referências:
- https://render.com/docs/free
- https://render.com/docs/websocket
- https://developers.cloudflare.com/realtime/turn/generate-credentials/
- https://www.metered.ca/docs/turn-rest-api/get-credential/
