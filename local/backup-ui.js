import { decodeSave } from './save-codec.js';
import { createBackup, parseBackup, replaceProgress, validateProgress, MAX_BACKUP_BYTES, PREVIOUS_SAVE_KEY } from './progress-backup.js';

export function setupBackupUI({ schema, getProgress, canUse }) {
  document.getElementById('nbBackupBtn').addEventListener('click', () => {
    if (!canUse()) {
      alert('Volte ao menu e saia da sala multiplayer antes de gerenciar o progresso.');
      return;
    }
    document.getElementById('nbLocalDialog')?.remove();
    const dialog = document.createElement('dialog');
    dialog.id = 'nbLocalDialog';
    dialog.setAttribute('aria-labelledby', 'nbBackupTitle');
    dialog.innerHTML = `
      <h2 id="nbBackupTitle">Backup do progresso</h2>
      <p>Guarde seu ouro, melhorias, armas e chaves em um arquivo para usar neste ou em outro navegador.</p>
      <p>O arquivo não inclui a partida em andamento, configurações nem ranking.</p>
      <button id="nbExportProgress" type="button">Exportar progresso</button>
      <label for="nbImportFile">Importar arquivo de backup (.json)</label>
      <input id="nbImportFile" type="file" accept=".json,application/json">
      <p id="nbBackupPreview"></p>
      <p>Ao importar, o progresso atual será substituído e a página será recarregada. Uma cópia anterior ficará disponível para recuperação neste navegador. Feche outras abas do jogo antes de importar.</p>
      <button id="nbApplyImport" type="button" disabled>Substituir progresso e recarregar</button>
      <button id="nbRestoreProgress" type="button">Recuperar progresso anterior</button>
      <p id="nbBackupStatus" role="status" aria-live="polite"></p>
      <button id="nbCloseBackup" type="button">Fechar</button>`;
    document.body.append(dialog);
    dialog.addEventListener('close', () => dialog.remove());
    const find = id => dialog.querySelector(`#${id}`);
    let pending = null, selection = 0;
    const status = text => { find('nbBackupStatus').textContent = text; };
    const clear = () => { pending = null; find('nbApplyImport').disabled = true; find('nbBackupPreview').textContent = ''; };
    const preview = progress => {
      pending = progress;
      const upgrades = Object.values(progress.upgrades).reduce((sum, level) => sum + level, 0);
      find('nbBackupPreview').textContent = `${progress.gold} ouro · ${progress.gunKeys} chaves · ${upgrades} níveis de melhorias · ${Object.values(progress.guns).filter(Boolean).length} armas de fogo · ${Object.values(progress.weapons).filter(Boolean).length} armas corpo a corpo`;
      find('nbApplyImport').disabled = false;
      status('Backup validado. Confira os valores antes de substituir seu progresso.');
    };
    find('nbCloseBackup').onclick = () => dialog.close();
    find('nbExportProgress').onclick = () => {
      try {
        const backup = createBackup(getProgress(), schema);
        const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url;
        link.download = `neonbrawl-progresso-${backup.createdAt.replace(/[:.]/g, '-')}.json`;
        dialog.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        status('Arquivo preparado para download. Guarde-o em um lugar seguro.');
      } catch (error) { status(`Não foi possível exportar: ${error.message}`); }
    };
    find('nbImportFile').onchange = async event => {
      const request = ++selection;
      clear(); status('');
      const file = event.target.files[0]; if (!file) return;
      try {
        if (file.size > MAX_BACKUP_BYTES) throw new Error('Arquivo muito grande. O limite é 256 KB.');
        const text = await file.text();
        if (request !== selection || !dialog.isConnected) return;
        preview(parseBackup(text, schema));
      } catch (error) { if (request === selection) { clear(); status(error.message); } }
    };
    find('nbRestoreProgress').onclick = () => {
      ++selection; clear();
      try {
        const raw = localStorage.getItem(PREVIOUS_SAVE_KEY);
        if (!raw) { status('Ainda não há uma cópia anterior neste navegador.'); return; }
        preview(validateProgress(decodeSave(raw), schema));
      } catch { status('Não foi possível ler a cópia anterior. Seu progresso atual não foi alterado.'); }
    };
    find('nbApplyImport').onclick = () => {
      if (!pending) return;
      if (!canUse()) { status('Volte ao menu e saia da sala antes de importar.'); return; }
      try {
        replaceProgress(localStorage, pending, getProgress(), schema);
        find('nbApplyImport').disabled = true;
        location.reload();
      } catch { status('Não foi possível salvar. Verifique se há espaço e se o navegador permite armazenamento local. O progresso atual foi mantido.'); }
    };
    dialog.showModal();
  });
}
