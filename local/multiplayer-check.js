(() => {
  const button = document.getElementById('run');
  const result = document.getElementById('result');
  const report = text => { result.textContent += `${text}\n`; };
  button.onclick = async () => {
    button.disabled = true;
    result.textContent = '';
    let client, left, right, timer;
    try {
      const auth = window.NEONBRAWL_CONFIG?.auth;
      if (!auth) throw new Error('Login não configurado.');
      client = window.supabase.createClient(auth.url, auth.publishableKey, {
        auth: { storageKey: 'neonbrawl-auth', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }
      });
      const { data, error } = await client.auth.getSession();
      if (error || !data.session) throw new Error('Entre na sua conta no jogo e volte a esta página.');
      const endpoint = window.NEONBRAWL_CONFIG.turnEndpoint || 'https://neonbrawl-rooms.onrender.com/api/ice';
      report('Validando conta e preparando relay…');
      const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}` }, credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(90000) });
      if (!response.ok) throw new Error(`Servidor recusou o teste (HTTP ${response.status}).`);
      const { iceServers } = await response.json();
      report('Conta validada. Conectando dois clientes com relay obrigatório…');
      left = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'relay' });
      right = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'relay' });
      const received = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Relay não conectou em 40 segundos.')), 40000);
        right.ondatachannel = event => { event.channel.onmessage = message => { if (message.data === 'neonbrawl-relay-test') resolve(); }; };
      });
      // Candidates are queued until the remote description exists.
      const toLeft = [], toRight = [];
      left.onicecandidate = e => { if (e.candidate) { if (right.remoteDescription) right.addIceCandidate(e.candidate).catch(() => {}); else toRight.push(e.candidate); } };
      right.onicecandidate = e => { if (e.candidate) { if (left.remoteDescription) left.addIceCandidate(e.candidate).catch(() => {}); else toLeft.push(e.candidate); } };
      const channel = left.createDataChannel('connection-check');
      channel.onopen = () => channel.send('neonbrawl-relay-test');
      // Attach a rejection handler before signaling to avoid an unhandled timeout.
      received.catch(() => {});
      await left.setLocalDescription(await left.createOffer());
      await right.setRemoteDescription(left.localDescription);
      for (const candidate of toRight) await right.addIceCandidate(candidate);
      await right.setLocalDescription(await right.createAnswer());
      await left.setRemoteDescription(right.localDescription);
      for (const candidate of toLeft) await left.addIceCandidate(candidate);
      await received;
      const stats = await left.getStats();
      const transport = [...stats.values()].find(s => s.type === 'transport' && s.selectedCandidatePairId);
      const pair = transport && stats.get(transport.selectedCandidatePairId);
      const local = pair && stats.get(pair.localCandidateId);
      if (local?.candidateType !== 'relay') throw new Error('Não foi possível confirmar o caminho relay.');
      report(`SUCESSO: mensagem recebida pelo relay (${local.protocol}).`);
      report('Este teste confirma o relay neste navegador. Uma partida entre duas redes ainda é necessária para validar a experiência completa.');
    } catch (error) {
      report(error?.name === 'TimeoutError' ? 'O servidor demorou a responder. Tente novamente.' : error.message || 'Falha no teste.');
    } finally {
      clearTimeout(timer);
      left?.close(); right?.close();
      client?.auth.stopAutoRefresh();
      button.disabled = false;
    }
  };
})();
