(() => {
  const STORAGE_KEY = 'reco.sessions.v1';
  const root = document.getElementById('modalRoot');
  if (!root) return;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));

  function readSessions(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  function activeSession(){
    return readSessions().find(session => !session.endedAt) || null;
  }

  function reopenFinish(id){
    const trigger = Array.from(document.querySelectorAll('[data-finish]'))
      .find(node => node.dataset.finish === id);
    trigger?.click();
  }

  function closeModal(){
    root.innerHTML = '';
  }

  function showDeleteConfirm(session){
    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal">
          <h3>この記録を削除しますか？</h3>
          <p>${esc(session.subject)} / ${esc(session.resource || '教材なし')}<br>この操作は取り消せません。</p>
          <div class="modal-actions">
            <button id="confirmDeleteFromFinish" class="btn btn-danger">削除</button>
            <button id="cancelDeleteFromFinish" class="btn btn-secondary">キャンセル</button>
          </div>
        </div>
      </div>`;

    root.querySelector('#confirmDeleteFromFinish').onclick = () => {
      const sessions = readSessions().filter(item => item.id !== session.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      closeModal();
      location.reload();
    };

    root.querySelector('#cancelDeleteFromFinish').onclick = () => {
      closeModal();
      requestAnimationFrame(() => reopenFinish(session.id));
    };

    root.querySelector('.modal-backdrop').onclick = event => {
      if (event.target.classList.contains('modal-backdrop')) closeModal();
    };
  }

  function decorateFinishModal(){
    const finishNow = root.querySelector('#finishNow');
    const cancel = root.querySelector('#cancelModal');
    if (!finishNow || !cancel || root.querySelector('#deleteFromFinish')) return;

    const session = activeSession();
    if (!session) return;

    const button = document.createElement('button');
    button.id = 'deleteFromFinish';
    button.type = 'button';
    button.className = 'btn btn-danger';
    button.textContent = 'この記録を削除';
    button.onclick = () => showDeleteConfirm(session);
    cancel.before(button);
  }

  const observer = new MutationObserver(() => requestAnimationFrame(decorateFinishModal));
  observer.observe(root, {childList:true, subtree:true});
  decorateFinishModal();
})();
