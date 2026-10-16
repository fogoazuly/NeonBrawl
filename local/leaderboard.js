const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function scoreEntry(score, meta) {
  if (!uuid.test(meta.accountId || '') || !uuid.test(meta.runId || '')) return null;
  if (!['easy','normal','hard','expert','hell'].includes(meta.difficulty)) return null;
  if (![score, meta.wave, meta.kills].every(Number.isSafeInteger) || score < 1 || score > 2147483647 || meta.wave < 1 || meta.wave > 100000 || meta.kills < 0 || meta.kills > 100000000) return null;
  const name = String(meta.displayName || 'Player').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 14) || 'Player';
  return { user_id: meta.accountId, run_id: meta.runId, display_name: name, score,
    difficulty: meta.difficulty, mode: meta.coop ? 'coop' : 'solo', wave: meta.wave, kills: meta.kills };
}

export class ScoreQueue {
  constructor({ storage, getUser, send }) { Object.assign(this, { storage, getUser, send }); this.inflight = null; }
  key(id) { return `nbPendingScores:${id}`; }
  read(id) { try { const rows = JSON.parse(this.storage.getItem(this.key(id)) || '[]'); return Array.isArray(rows) ? rows.filter(r => r.user_id === id).slice(-100) : []; } catch { return []; } }
  enqueue(row) {
    if (!row) return;
    const rows = this.read(row.user_id);
    if (!rows.some(r => r.run_id === row.run_id)) rows.push(row);
    this.storage.setItem(this.key(row.user_id), JSON.stringify(rows.slice(-100)));
  }
  async flush() {
    if (this.inflight) return this.inflight;
    const id = this.getUser()?.id;
    if (!id) return;
    this.inflight = (async () => {
      while (this.getUser()?.id === id) {
        const row = this.read(id)[0];
        if (!row) return;
        await this.send(row);
        this.storage.setItem(this.key(id), JSON.stringify(this.read(id).filter(r => r.run_id !== row.run_id)));
      }
    })();
    try { await this.inflight; } finally { this.inflight = null; }
  }
}

export function setupLeaderboard() {
  const localBoard = window.PixoLeaderboard;
  const auth = window.NeonBrawlAuth;
  const queue = new ScoreQueue({ storage: localStorage, getUser: () => auth?.getState().user,
    send: async row => {
      const client = auth?.getClient();
      if (!client) throw new Error('Offline');
      const { error } = await client.from('leaderboard_scores').upsert(row, { onConflict: 'user_id,run_id', ignoreDuplicates: true });
      if (error) throw error;
    }
  });
  const flush = () => queue.flush().catch(() => {});
  auth?.onChange(() => { setTimeout(flush, 0); });
  window.addEventListener('online', flush);
  setInterval(flush, 30000);
  window.PixoLeaderboard = {
    submit(game, mode, score, meta) {
      // Save the queue synchronously so closing the page cannot lose an upload.
      queue.enqueue(scoreEntry(score, meta));
      localBoard.submit(game, mode, score, meta);
      void flush();
    },
    open({ modes }) {
      document.getElementById('nbLeaderboard')?.remove();
      const dialog = document.createElement('dialog'); dialog.id = 'nbLeaderboard';
      dialog.innerHTML = `<h2>Ranking online</h2><p>Top 50 resultados por dificuldade e modalidade. Ranking casual: pontuações enviadas pelo jogo.</p>
        <div class="nb-board-filters"><label>Dificuldade <select id="nbBoardDifficulty"></select></label>
        <label>Modalidade <select id="nbBoardMode"><option value="solo">Solo</option><option value="coop">Co-op</option></select></label>
        <button id="nbBoardRefresh">Atualizar</button></div>
        <p id="nbBoardStatus" role="status"></p><ol id="nbBoardRows"></ol>
        <button id="nbBoardLocal">Histórico deste navegador</button> <button id="nbBoardClose">Fechar</button>`;
      document.body.append(dialog);
      const find = id => dialog.querySelector(`#nbBoard${id}`);
      for (const mode of modes) { const option = document.createElement('option'); option.value = mode.value.replace('score_', ''); option.textContent = mode.label; find('Difficulty').append(option); }
      let generation = 0;
      async function render() {
        const request = ++generation;
        find('Rows').replaceChildren(); find('Status').textContent = 'Carregando…';
        const client = auth?.getClient();
        if (!client) { find('Status').textContent = 'Ranking online indisponível. Seu histórico local continua disponível.'; return; }
        try {
          await queue.flush().catch(() => {});
          const { data, error } = await client.from('leaderboard_scores')
            .select('display_name,score,wave,kills,created_at')
            .eq('difficulty', find('Difficulty').value).eq('mode', find('Mode').value)
            .order('score', { ascending: false }).order('wave', { ascending: false }).order('created_at', { ascending: true }).limit(50);
          if (request !== generation || !dialog.isConnected) return;
          if (error) throw error;
          for (const row of data) {
            const item = document.createElement('li');
            item.textContent = `${row.display_name} — ${row.score.toLocaleString('pt-BR')} pontos · onda ${row.wave} · ${row.kills} eliminações`;
            find('Rows').append(item);
          }
          const user = auth.getState().user;
          const pending = user ? queue.read(user.id).length : 0;
          find('Status').textContent = (data.length ? `${data.length} resultado(s).` : 'Nenhuma partida nesta modalidade ainda.') +
            (pending ? ` ${pending} resultado(s) aguardando envio. Clique em Atualizar para tentar novamente.` : !user ? ' Entre na sua conta antes de jogar para participar.' : ' Novas partidas da sua conta entram automaticamente.');
        } catch {
          if (request === generation) find('Status').textContent = 'Não foi possível carregar o ranking. Tente atualizar; resultados pendentes estão preservados neste navegador.';
        }
      }
      find('Difficulty').onchange = find('Mode').onchange = find('Refresh').onclick = render;
      find('Close').onclick = () => dialog.close();
      find('Local').onclick = () => { dialog.close(); localBoard.open({ modes }); };
      dialog.onclose = () => { generation++; dialog.remove(); };
      dialog.showModal(); void render();
    }
  };
}
