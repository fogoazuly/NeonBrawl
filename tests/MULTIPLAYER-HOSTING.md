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

Referências:
- https://render.com/docs/free
- https://render.com/docs/websocket
- https://developers.cloudflare.com/realtime/turn/generate-credentials/
