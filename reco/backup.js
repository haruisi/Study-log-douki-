(() => {
  const BACKUP_KEY = 'reco.backups.v1';
  const DATA_KEYS = ['reco.sessions.v1', 'reco.logs.v1', 'reco.resources.v1'];
  const MAX_BACKUPS = 10;

  function readBackups() {
    try {
      const value = JSON.parse(localStorage.getItem(BACKUP_KEY));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function snapshotData() {
    const data = {};
    for (const key of DATA_KEYS) data[key] = localStorage.getItem(key);
    return data;
  }

  function signature(data) {
    return DATA_KEYS.map(key => `${key}:${data[key] ?? ''}`).join('\n');
  }

  function hasAnyData(data) {
    return DATA_KEYS.some(key => data[key] != null && data[key] !== '' && data[key] !== '[]' && data[key] !== '{}');
  }

  function persist(backups) {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backups.slice(0, MAX_BACKUPS)));
      return true;
    } catch {
      try {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(backups.slice(0, 3)));
        return true;
      } catch {
        return false;
      }
    }
  }

  function capture(reason = 'auto') {
    const data = snapshotData();
    if (!hasAnyData(data)) return null;

    const backups = readBackups();
    const sig = signature(data);
    const latest = backups[0];
    if (latest && latest.signature === sig) return latest;

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      reason,
      signature: sig,
      data
    };

    persist([entry, ...backups]);
    return entry;
  }

  function restore(id) {
    const backup = readBackups().find(item => item.id === id);
    if (!backup) return false;

    for (const key of DATA_KEYS) {
      const value = backup.data?.[key];
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }

    window.dispatchEvent(new CustomEvent('reco:backup-restored', { detail: { id } }));
    return true;
  }

  function downloadLatest() {
    const latest = readBackups()[0];
    if (!latest) return false;
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      backup: latest
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reco-backup-${latest.createdAt.replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  }

  window.RecoBackup = {
    capture,
    list: readBackups,
    restore,
    downloadLatest
  };

  capture('startup');

  let lastPeriodicCapture = 0;
  function periodicCapture() {
    const now = Date.now();
    if (now - lastPeriodicCapture < 60000) return;
    lastPeriodicCapture = now;
    capture('periodic');
  }

  setInterval(periodicCapture, 60000);
  window.addEventListener('pagehide', () => capture('pagehide'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) capture('hidden');
  });
})();
