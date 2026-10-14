// Compatibility boundary for the original game's optional site integrations.
// Progress and scores belong to this browser. No original account service is contacted.
(() => {
  const config = window.NEONBRAWL_CONFIG;
  if (!config) throw new Error('Abra o jogo pelo servidor local.');
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  // Bounded local diagnostics survive F5; never include account/session data.
  const diagnosticsKey='nbRuntimeDiagnostics';
  const previous=read(diagnosticsKey,[]);
  const records=Array.isArray(previous)?previous.slice(-10):[];
  window.NeonBrawlDiagnostics={
    record(kind,detail={}){
      records.push({time:new Date().toISOString(),kind,...detail});
      if(records.length>10)records.shift();
      try{write(diagnosticsKey,records);}catch{}
    },
    download(){
      const blob=new Blob([JSON.stringify({browser:navigator.userAgent,records},null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='neonbrawl-diagnostico.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  };
  window.addEventListener('error',event=>{
    if(!event.filename?.includes('/local/'))return;
    window.NeonBrawlDiagnostics.record('javascript',{file:new URL(event.filename).pathname,line:event.lineno,column:event.colno,error:event.error?.name||'Error'});
  });
  window.NeonBrawlServices = {
    async getPeerConfig() {
      if (config.multiplayer === false) throw new Error('Multiplayer ainda indisponível nesta versão online.');
      return { host: location.hostname, port: Number(location.port) || (location.protocol === 'https:' ? 443 : 80),
        secure: location.protocol === 'https:', path: config.peerPath, config: { iceServers: config.iceServers } };
    }
  };
  // Legacy wallet/cloud hooks stay disabled: authentication alone must not change local saves.
  // The new account session lives in NeonBrawlAuth, separately from the original portal economy.
  window.PixoSupabase = { getState: () => ({ ready: true, enabled: false, user: null }), onChange(fn) { fn(this.getState()); return () => {}; } };
  window.PixoPlayerCard = { localName: slot => window.NeonBrawlAuth?.getState().user?.user_metadata?.display_name || read('nbLocalName', '') || `Player ${slot + 1}`, localUserId: () => null,
    markSelf() {}, attachClickable() {} };
  window.PixoTurn = { getIceServers: async () => config.iceServers };

  function dialog(title) {
    document.getElementById('nbLocalDialog')?.remove();
    const el = document.createElement('dialog'); el.id = 'nbLocalDialog';
    const heading = document.createElement('h2'); heading.textContent = title; el.append(heading);
    const close = document.createElement('button'); close.textContent = 'Fechar'; close.onclick = () => el.close(); el.append(close);
    el.addEventListener('close', () => el.remove());
    document.body.append(el); el.showModal(); return el;
  }
  function paragraph(parent, text) { const el = document.createElement('p'); el.textContent = text; parent.append(el); }
  window.PixoHowto = { open({ title, sections }) {
    const el = dialog(title);
    for (const section of sections) { paragraph(el, section.heading); if (section.body) paragraph(el, section.body);
      for (const item of section.items || []) paragraph(el, `${item.keys.join(' / ')}: ${item.desc}`); }
  } };
  window.PixoInvite = {
    open({ roomCode }) {
      const el = dialog('Convidar para a sala local');
      const url = new URL(location.pathname, location.origin); url.searchParams.set('join', roomCode);
      paragraph(el, 'Abra este endereço em outra janela do navegador neste PC:');
      const input = document.createElement('input'); input.value = url.href; input.readOnly = true; el.append(input); input.select();
      paragraph(el, 'Para outro computador na rede, use o endereço IP do servidor.');
    },
    attachAutoJoin(callback) { const code = new URLSearchParams(location.search).get('join'); if (code) callback(code); }
  };
  window.PixoLeaderboard = {
    submit(game, mode, score, meta) {
      const rows = read('nbLocalScores', []);
      if (meta.runId && rows.some(row => row.meta?.runId === meta.runId)) return;
      rows.push({ game, mode, score, meta, date: new Date().toISOString() });
      write('nbLocalScores', rows.sort((a, b) => b.score - a.score).slice(0, 250));
    },
    open({ modes }) {
      const el = dialog('Ranking deste navegador');
      const select = document.createElement('select'); el.append(select);
      for (const mode of modes) { const option = document.createElement('option'); option.value = mode.value; option.textContent = mode.label; select.append(option); }
      const list = document.createElement('ol'); el.append(list);
      const render = () => {
        list.replaceChildren();
        for (const row of read('nbLocalScores', []).filter(row => row.mode === select.value).slice(0, 20)) {
          const li = document.createElement('li'); li.textContent = `${row.score} pontos · onda ${row.meta.wave} · ${row.meta.members.map(m => m.display_name).join(', ')}`; list.append(li);
        }
        if (!list.children.length) paragraph(list, 'Nenhuma partida registrada nesta dificuldade.');
      }; select.onchange = render; render();
    }
  };
  // Keep the host simulation alive when its tab is hidden.
  window.PixoTick = { makeLoop({ tickMs, onTick }) {
    let active = false, frame;
    const workerUrl = URL.createObjectURL(new Blob([`setInterval(() => postMessage(0), ${Number(tickMs)});`], { type: 'text/javascript' }));
    const worker = new Worker(workerUrl); URL.revokeObjectURL(workerUrl);
    worker.onmessage = () => { if (active && document.hidden) onTick(performance.now()); };
    const loop = now => { if (!active) return; frame = requestAnimationFrame(loop); if (!document.hidden) onTick(now); };
    return { start() { if (!active) { active = true; frame = requestAnimationFrame(loop); } }, stop() { active = false; cancelAnimationFrame(frame); worker.terminate(); } };
  } };
})();
