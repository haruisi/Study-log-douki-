(() => {
  const SUPABASE_URL = 'https://ghvqvlmkgajznxjerjsu.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_3csWlJKuPt0fWAVFkwVXzg_0tE4hfF_';

  const LOGS_KEY = 'reco.logs.v1';
  const SYNC_KEY_STORAGE = 'reco.sync.key.v1';
  const PENDING_KEY = 'reco.logs.sync.pending.v1';
  const SNAPSHOT_KEY = 'reco.logs.sync.snapshot.v1';

  let syncKey = localStorage.getItem(SYNC_KEY_STORAGE) || '';
  let baselineLogs = clone(readLogs());
  let suppressLocalWatchUntil = 0;
  let syncBusy = false;
  let flushTimer = null;
  let keyBootToken = 0;

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

  function readLogs() {
    const value = loadJson(LOGS_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
  }

  function writeLogs(logs) {
    suppressLocalWatchUntil = Date.now() + 1200;
    baselineLogs = clone(logs);
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    window.dispatchEvent(new CustomEvent('reco:logs-updated'));
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
      throw new Error(detail || `Log sync request failed (${response.status})`);
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
    const beforeMap = new Map(before.map(log => [log.id, log]));
    const afterMap = new Map(after.map(log => [log.id, log]));
    const pending = getPending();

    for (const [id, log] of afterMap) {
      const old = beforeMap.get(id);
      if (!old || stableStringify(old) !== stableStringify(log)) {
        pending.upserts[id] = clone(log);
        pending.deletes = pending.deletes.filter(item => item !== id);
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
    const current = readLogs();
    if (stableStringify(current) === stableStringify(baselineLogs)) return false;
    queueDiff(baselineLogs, current);
    baselineLogs = clone(current);
    return true;
  }

  function scheduleFlush(delay = 450) {
    if (!syncKey) return;
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => flushPending(), delay);
  }

  function markSyncError() {
    const button = document.getElementById('syncBtn');
    if (!button) return;
    button.dataset.state = 'error';
    button.title = '同期エラー（やったこと記録）';
    button.setAttribute('aria-label', '同期エラー（やったこと記録）');
  }

  async function flushPending() {
    if (!syncKey || syncBusy) return;
    captureLocalChanges();
    const pending = getPending();
    if (!hasPending(pending)) return;

    syncBusy = true;
    try {
      for (const id of [...pending.deletes]) {
        await rpc('reco_delete_log', { p_key: syncKey, p_log_id: id });
        const latest = getPending();
        latest.deletes = latest.deletes.filter(item => item !== id);
        setPending(latest);
      }

      const latestUpserts = { ...getPending().upserts };
      for (const [id, log] of Object.entries(latestUpserts)) {
        await rpc('reco_upsert_log', { p_key: syncKey, p_log: log });
        const latest = getPending();
        delete latest.upserts[id];
        setPending(latest);
      }

      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(readLogs()));
    } catch (error) {
      console.error('Reco activity log sync failed', error);
      markSyncError();
    } finally {
      syncBusy = false;
    }
  }

  async function pullRemote() {
    if (!syncKey || syncBusy) return;
    captureLocalChanges();
    if (hasPending()) {
      await flushPending();
      if (hasPending()) return;
    }

    syncBusy = true;
    try {
      const payload = await rpc('reco_pull', { p_key: syncKey });
      if (!payload) return;
      const remote = Array.isArray(payload.logs) ? payload.logs : [];
      const local = readLogs();
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(remote));
      if (stableStringify(remote) !== stableStringify(local)) writeLogs(remote);
      else baselineLogs = clone(local);
    } catch (error) {
      console.error('Reco activity log pull failed', error);
      markSyncError();
    } finally {
      syncBusy = false;
    }
  }

  async function firstConnect() {
    if (!syncKey || syncBusy) return;
    syncBusy = true;
    try {
      const payload = await rpc('reco_pull', { p_key: syncKey });
      if (!payload) return;
      const remote = Array.isArray(payload.logs) ? payload.logs : [];
      const local = readLogs();
      const remoteIds = new Set(remote.map(log => log.id));
      const localOnly = local.filter(log => !remoteIds.has(log.id));

      for (const log of localOnly) {
        await rpc('reco_upsert_log', { p_key: syncKey, p_log: log });
      }

      const mergedPayload = await rpc('reco_pull', { p_key: syncKey });
      const merged = Array.isArray(mergedPayload?.logs) ? mergedPayload.logs : [];
      setPending(emptyPending());
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(merged));
      writeLogs(merged);
    } catch (error) {
      console.error('Reco activity log initial sync failed', error);
      markSyncError();
    } finally {
      syncBusy = false;
    }
  }

  async function bootForCurrentKey() {
    const token = ++keyBootToken;
    const currentKey = localStorage.getItem(SYNC_KEY_STORAGE) || '';
    if (currentKey !== syncKey) {
      syncKey = currentKey;
      baselineLogs = clone(readLogs());
    }
    if (!syncKey) return;

    const snapshot = loadJson(SNAPSHOT_KEY, null);
    if (Array.isArray(snapshot)) {
      queueDiff(snapshot, readLogs());
      await flushPending();
      if (token === keyBootToken) await pullRemote();
    } else {
      await firstConnect();
    }
  }

  setInterval(() => {
    const currentKey = localStorage.getItem(SYNC_KEY_STORAGE) || '';
    if (currentKey !== syncKey) {
      syncKey = currentKey;
      localStorage.removeItem(PENDING_KEY);
      localStorage.removeItem(SNAPSHOT_KEY);
      baselineLogs = clone(readLogs());
      bootForCurrentKey();
      return;
    }
    if (!syncKey) return;
    if (captureLocalChanges()) scheduleFlush();
  }, 500);

  setInterval(() => {
    if (!syncKey || document.hidden || hasPending()) return;
    pullRemote();
  }, 15000);

  window.addEventListener('focus', () => {
    if (!syncKey) return;
    captureLocalChanges();
    flushPending().then(pullRemote);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && syncKey) {
      captureLocalChanges();
      flushPending().then(pullRemote);
    }
  });

  window.addEventListener('reco:logs-updated', () => {
    if (!syncKey) return;
    if (captureLocalChanges()) scheduleFlush(80);
  });

  bootForCurrentKey();
})();
