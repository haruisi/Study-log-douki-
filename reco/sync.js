(() => {
  const SUPABASE_URL = 'https://ghvqvlmkgajznxjerjsu.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_3csWlJKuPt0fWAVFkwVXzg_0tE4hfF_';

  const SESSIONS_KEY = 'reco.sessions.v1';
  const RESOURCES_KEY = 'reco.resources.v1';
  const SYNC_KEY_STORAGE = 'reco.sync.key.v1';
  const PENDING_KEY = 'reco.sync.pending.v1';
  const SNAPSHOT_KEY = 'reco.sync.snapshot.v1';

  let syncKey = localStorage.getItem(SYNC_KEY_STORAGE) || '';
  let baselineSessions = clone(readSessions());
  let suppressLocalWatchUntil = 0;
  let syncBusy = false;
  let flushTimer = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value == null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function readSessions() {
    const value = loadJson(SESSIONS_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
  }

  function rebuildResources(sessions) {
    const resources = {};
    [...sessions]
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
      .forEach(session => {
        const subject = session.subject || 'その他';
        const resource = (session.resource || '').trim();
        if (!resource) return;
        resources[subject] = resources[subject] || [];
        if (!resources[subject].includes(resource)) resources[subject].push(resource);
      });
    Object.keys(resources).forEach(subject => resources[subject] = resources[subject].slice(0, 20));
    localStorage.setItem(RESOURCES_KEY, JSON.stringify(resources));
  }

  function writeSessions(sessions) {
    suppressLocalWatchUntil = Date.now() + 1500;
    baselineSessions = clone(sessions);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    rebuildResources(sessions);
  }

  async function rpc(name, body) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(detail || `Sync request failed (${response.status})`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  function emptyPending() {
    return { upserts: {}, deletes: [] };
  }

  function getPending() {
    const pending = loadJson(PENDING_KEY, emptyPending());
    if (!pending || typeof pending !== 'object') return emptyPending();
    pending.upserts = pending.upserts || {};
    pending.deletes = Array.isArray(pending.deletes) ? pending.deletes : [];
    return pending;
  }

  function setPending(pending) {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  }

  function hasPending(pending = getPending()) {
    return pending.deletes.length > 0 || Object.keys(pending.upserts).length > 0;
  }

  function queueDiff(before, after) {
    const beforeMap = new Map(before.map(s => [s.id, s]));
    const afterMap = new Map(after.map(s => [s.id, s]));
    const pending = getPending();

    for (const [id, session] of afterMap) {
      const old = beforeMap.get(id);
      if (!old || stableStringify(old) !== stableStringify(session)) {
        pending.upserts[id] = clone(session);
        pending.deletes = pending.deletes.filter(x => x !== id);
      }
    }

    for (const id of beforeMap.keys()) {
      if (!afterMap.has(id)) {
        delete pending.upserts[id];
        if (!pending.deletes.includes(id)) pending.deletes.push(id);
      }
    }

    setPending(pending);
  }

  function captureLocalChanges() {
    if (Date.now() < suppressLocalWatchUntil) return false;
    const current = readSessions();
    if (stableStringify(current) === stableStringify(baselineSessions)) return false;
    queueDiff(baselineSessions, current);
    baselineSessions = clone(current);
    setSyncState('syncing');
    return true;
  }

  function scheduleFlush(delay = 450) {
    if (!syncKey) return;
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => flushPending(), delay);
  }

  async function flushPending() {
    if (!syncKey || syncBusy) return;
    captureLocalChanges();
    const pending = getPending();
    if (!hasPending(pending)) {
      setSyncState('synced');
      return;
    }

    syncBusy = true;
    setSyncState('syncing');
    try {
      for (const id of [...pending.deletes]) {
        await rpc('reco_delete_session', { p_key: syncKey, p_session_id: id });
        const latest = getPending();
        latest.deletes = latest.deletes.filter(x => x !== id);
        setPending(latest);
      }

      const latestUpserts = { ...getPending().upserts };
      for (const [id, session] of Object.entries(latestUpserts)) {
        await rpc('reco_upsert_session', { p_key: syncKey, p_session: session });
        const latest = getPending();
        delete latest.upserts[id];
        setPending(latest);
      }

      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(readSessions()));
      setSyncState('synced');
    } catch (error) {
      console.error('Reco sync failed', error);
      setSyncState('error');
    } finally {
      syncBusy = false;
    }
  }

  async function pullRemote({ reloadIfChanged = true } = {}) {
    if (!syncKey || syncBusy) return;
    captureLocalChanges();
    if (hasPending()) {
      await flushPending();
      if (hasPending()) return;
    }

    syncBusy = true;
    setSyncState('syncing');
    try {
      const payload = await rpc('reco_pull', { p_key: syncKey });
      if (!payload) {
        setSyncState('error');
        return;
      }

      const remote = Array.isArray(payload.sessions) ? payload.sessions : [];
      const local = readSessions();
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(remote));

      if (stableStringify(remote) !== stableStringify(local)) {
        writeSessions(remote);
        setSyncState('synced');
        if (reloadIfChanged) setTimeout(() => location.reload(), 80);
      } else {
        baselineSessions = clone(local);
        setSyncState('synced');
      }
    } catch (error) {
      console.error('Reco pull failed', error);
      setSyncState('error');
    } finally {
      syncBusy = false;
    }
  }

  function generateSyncKey() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function setSyncState(state) {
    const button = document.getElementById('syncBtn');
    if (!button) return;
    button.dataset.state = state;
    const labels = {
      off: '端末間同期は未設定',
      syncing: '同期中',
      synced: '同期済み',
      error: '同期エラー'
    };
    button.title = labels[state] || '端末間同期';
    button.setAttribute('aria-label', labels[state] || '端末間同期');
  }

  function closeSyncModal() {
    const root = document.getElementById('modalRoot');
    if (root) root.innerHTML = '';
  }

  function showModal(html) {
    const root = document.getElementById('modalRoot');
    if (!root) return;
    root.innerHTML = `<div class="modal-backdrop sync-modal-backdrop"><div class="modal">${html}</div></div>`;
    const backdrop = root.querySelector('.sync-modal-backdrop');
    backdrop?.addEventListener('click', event => {
      if (event.target === backdrop) closeSyncModal();
    });
  }

  function maskedKey(key) {
    if (!key) return '';
    return `${key.slice(0, 5)}••••••••••${key.slice(-5)}`;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function createWorkspace() {
    const button = document.getElementById('syncCreate');
    if (button) button.disabled = true;
    setSyncState('syncing');

    try {
      let key = generateSyncKey();
      let created = await rpc('reco_create_workspace', { p_key: key });
      if (!created) {
        key = generateSyncKey();
        created = await rpc('reco_create_workspace', { p_key: key });
      }
      if (!created) throw new Error('Could not create sync workspace');

      syncKey = key;
      localStorage.setItem(SYNC_KEY_STORAGE, key);
      const sessions = readSessions();
      for (const session of sessions) {
        await rpc('reco_upsert_session', { p_key: key, p_session: session });
      }
      const payload = await rpc('reco_pull', { p_key: key });
      const remote = payload?.sessions || [];
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(remote));
      setPending(emptyPending());
      baselineSessions = clone(sessions);
      setSyncState('synced');
      showKeyCreated(key);
    } catch (error) {
      console.error(error);
      setSyncState('error');
      openSyncSetup('同期を開始できませんでした。通信状態を確認してもう一度お試しください。');
    }
  }

  function showKeyCreated(key) {
    showModal(`
      <h3>端末間同期を開始しました</h3>
      <p>別の端末で下のSync Keyを入力すると、同じRecoを使えます。</p>
      <div class="sync-key-box" id="createdKey">${key}</div>
      <p class="sync-warning">このキーを知っている人はRecoの記録にアクセスできます。自分以外には共有しないでください。</p>
      <div class="modal-actions">
        <button id="copyCreatedKey" class="btn btn-primary">Sync Keyをコピー</button>
        <button id="finishSyncSetup" class="btn btn-secondary">完了</button>
      </div>
    `);
    document.getElementById('copyCreatedKey').onclick = async () => {
      const ok = await copyText(key);
      document.getElementById('copyCreatedKey').textContent = ok ? 'コピーしました' : 'コピーできませんでした';
    };
    document.getElementById('finishSyncSetup').onclick = () => {
      closeSyncModal();
      scheduleFlush(50);
    };
  }

  async function connectWorkspace(key) {
    key = (key || '').trim();
    if (key.length < 32) {
      openSyncSetup('Sync Keyが短すぎます。コピーしたキーをそのまま貼り付けてください。');
      return;
    }

    setSyncState('syncing');
    try {
      const payload = await rpc('reco_pull', { p_key: key });
      if (!payload) {
        openSyncSetup('そのSync Keyは見つかりませんでした。');
        setSyncState('off');
        return;
      }

      const remote = Array.isArray(payload.sessions) ? payload.sessions : [];
      const local = readSessions();
      const remoteIds = new Set(remote.map(s => s.id));
      const localOnly = local.filter(s => !remoteIds.has(s.id));

      syncKey = key;
      localStorage.setItem(SYNC_KEY_STORAGE, key);

      for (const session of localOnly) {
        await rpc('reco_upsert_session', { p_key: key, p_session: session });
      }

      const mergedPayload = await rpc('reco_pull', { p_key: key });
      const merged = mergedPayload?.sessions || [];
      setPending(emptyPending());
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(merged));
      writeSessions(merged);
      setSyncState('synced');
      closeSyncModal();
      setTimeout(() => location.reload(), 80);
    } catch (error) {
      console.error(error);
      setSyncState('error');
      openSyncSetup('接続できませんでした。通信状態またはSync Keyを確認してください。');
    }
  }

  function openSyncSetup(message = '') {
    showModal(`
      <h3>端末間同期</h3>
      ${message ? `<p class="sync-error-text">${message}</p>` : '<p>同じSync Keyを設定した端末どうしで、Recoの記録を同期します。</p>'}
      <div class="modal-actions">
        <button id="syncCreate" class="btn btn-primary">新しく同期を開始</button>
      </div>
      <div class="sync-divider"><span>または</span></div>
      <div class="field">
        <label>別端末のSync Key</label>
        <input id="syncKeyInput" class="input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Sync Keyを貼り付け">
      </div>
      <div class="modal-actions">
        <button id="syncConnect" class="btn btn-secondary">このキーで接続</button>
        <button id="syncCancel" class="btn btn-secondary">閉じる</button>
      </div>
      <p class="sync-warning">Sync Keyはログイン情報と同じように扱ってください。</p>
    `);
    document.getElementById('syncCreate').onclick = createWorkspace;
    document.getElementById('syncConnect').onclick = () => connectWorkspace(document.getElementById('syncKeyInput').value);
    document.getElementById('syncCancel').onclick = closeSyncModal;
  }

  function openConnectedSync() {
    let revealed = false;
    showModal(`
      <h3>端末間同期</h3>
      <div class="sync-status-row"><span class="sync-status-dot"></span><b>同期中</b></div>
      <div class="field" style="margin-top:14px">
        <label>Sync Key</label>
        <div class="sync-key-box" id="currentSyncKey">${maskedKey(syncKey)}</div>
      </div>
      <div class="modal-actions">
        <button id="toggleSyncKey" class="btn btn-secondary">キーを表示</button>
        <button id="copySyncKey" class="btn btn-secondary">キーをコピー</button>
        <button id="syncNow" class="btn btn-primary">今すぐ同期</button>
        <button id="disconnectSync" class="btn btn-danger">この端末の同期を解除</button>
        <button id="syncClose" class="btn btn-secondary">閉じる</button>
      </div>
      <p class="sync-warning">同期解除しても、この端末に保存済みの記録とクラウド側の記録は削除されません。</p>
    `);

    document.getElementById('toggleSyncKey').onclick = () => {
      revealed = !revealed;
      document.getElementById('currentSyncKey').textContent = revealed ? syncKey : maskedKey(syncKey);
      document.getElementById('toggleSyncKey').textContent = revealed ? 'キーを隠す' : 'キーを表示';
    };
    document.getElementById('copySyncKey').onclick = async () => {
      const ok = await copyText(syncKey);
      document.getElementById('copySyncKey').textContent = ok ? 'コピーしました' : 'コピーできませんでした';
    };
    document.getElementById('syncNow').onclick = async () => {
      document.getElementById('syncNow').textContent = '同期中…';
      captureLocalChanges();
      await flushPending();
      await pullRemote({ reloadIfChanged: true });
      if (document.getElementById('syncNow')) document.getElementById('syncNow').textContent = '同期しました';
    };
    document.getElementById('disconnectSync').onclick = () => {
      localStorage.removeItem(SYNC_KEY_STORAGE);
      localStorage.removeItem(PENDING_KEY);
      localStorage.removeItem(SNAPSHOT_KEY);
      syncKey = '';
      setSyncState('off');
      closeSyncModal();
    };
    document.getElementById('syncClose').onclick = closeSyncModal;
  }

  function openSyncModal() {
    if (syncKey) openConnectedSync();
    else openSyncSetup();
  }

  async function bootSync() {
    const syncButton = document.getElementById('syncBtn');
    if (syncButton) syncButton.onclick = openSyncModal;

    if (!syncKey) {
      setSyncState('off');
      return;
    }

    setSyncState('syncing');

    const snapshot = loadJson(SNAPSHOT_KEY, null);
    if (Array.isArray(snapshot)) {
      queueDiff(snapshot, readSessions());
    }

    baselineSessions = clone(readSessions());
    await flushPending();
    if (!hasPending()) await pullRemote({ reloadIfChanged: true });
  }

  setInterval(() => {
    if (!syncKey) return;
    if (captureLocalChanges()) scheduleFlush();
  }, 400);

  setInterval(() => {
    if (!syncKey || document.hidden || hasPending()) return;
    pullRemote({ reloadIfChanged: true });
  }, 15000);

  window.addEventListener('focus', () => {
    if (!syncKey) return;
    captureLocalChanges();
    flushPending().then(() => pullRemote({ reloadIfChanged: true }));
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && syncKey) {
      captureLocalChanges();
      flushPending().then(() => pullRemote({ reloadIfChanged: true }));
    }
  });

  bootSync();
})();
