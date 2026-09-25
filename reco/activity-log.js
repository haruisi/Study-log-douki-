(() => {
  const LOGS_KEY = 'reco.logs.v1';
  const RESOURCE_KEY = 'reco.resources.v1';
  const SUBJECTS = ['数学','英語','物理','化学','国語','地理','その他'];

  let logs = load(LOGS_KEY, []);
  let renderQueued = false;

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const pad = n => String(n).padStart(2, '0');
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function load(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value == null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function saveLogs() {
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    window.dispatchEvent(new CustomEvent('reco:logs-updated'));
    scheduleRender();
  }

  function nowLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function todayYMD() {
    return nowLocal().slice(0, 10);
  }

  function parseLocal(value) {
    return new Date(value);
  }

  function fromInput(value) {
    return new Date(value).toISOString();
  }

  function toInputValue(iso) {
    const d = parseLocal(iso);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fmtTime(iso) {
    const d = parseLocal(iso);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function sameLocalDate(iso, ymd) {
    const d = parseLocal(iso);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` === ymd;
  }

  function readResources() {
    const value = load(RESOURCE_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function rememberResource(subject, resource) {
    if (!resource) return;
    const resources = readResources();
    resources[subject] = resources[subject] || [];
    resources[subject] = [resource, ...resources[subject].filter(item => item !== resource)].slice(0, 20);
    localStorage.setItem(RESOURCE_KEY, JSON.stringify(resources));
  }

  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 1600);
  }

  function closeModal() {
    const root = $('#modalRoot');
    if (root) root.innerHTML = '';
  }

  function showModal(html) {
    const root = $('#modalRoot');
    if (!root) return;
    root.innerHTML = `<div class="modal-backdrop activity-modal-backdrop"><div class="modal">${html}</div></div>`;
    const backdrop = $('.activity-modal-backdrop', root);
    if (backdrop) backdrop.onclick = event => {
      if (event.target === backdrop) closeModal();
    };
  }

  function subjectGrid(selected) {
    return SUBJECTS.map(subject => `<button type="button" class="subject-chip ${subject===selected?'selected':''}" data-log-subject="${subject}">${subject}</button>`).join('');
  }

  function bindSubjectAndResources(root, initialSubject, initialResource = '') {
    let selected = initialSubject;
    const resourceInput = $('#logResource', root);
    const resourceList = $('#logResourceList', root);
    const quick = $('#logResourceQuick', root);

    const update = () => {
      const resources = readResources();
      const list = resources[selected] || [];
      if (resourceList) resourceList.innerHTML = list.map(item => `<option value="${esc(item)}"></option>`).join('');
      if (quick) {
        quick.innerHTML = list.slice(0, 4).map(item => `<button type="button" class="quick" data-log-resource="${esc(item)}">${esc(item)}</button>`).join('');
        $$('[data-log-resource]', quick).forEach(button => button.onclick = () => {
          if (resourceInput) resourceInput.value = button.dataset.logResource || '';
        });
      }
    };

    $$('[data-log-subject]', root).forEach(button => button.onclick = () => {
      selected = button.dataset.logSubject;
      $$('[data-log-subject]', root).forEach(item => item.classList.toggle('selected', item === button));
      update();
    });

    if (resourceInput) resourceInput.value = initialResource;
    update();
    return () => selected;
  }

  function openNewLogModal() {
    logs = load(LOGS_KEY, []);
    const last = [...logs].sort((a,b) => parseLocal(b.recordedAt) - parseLocal(a.recordedAt))[0];
    const initialSubject = last?.subject || '数学';

    showModal(`
      <h3>やったことを記録</h3>
      <p>時間は計測せず、学習内容だけ残します。</p>
      <form id="logForm" class="activity-log-form">
        <div class="field"><label>日時</label><input id="logRecordedAt" class="input" type="datetime-local" value="${nowLocal()}" required></div>
        <div class="field"><label>科目</label><div class="subject-grid">${subjectGrid(initialSubject)}</div></div>
        <div class="field"><label>教材</label><input id="logResource" class="input" list="logResourceList" placeholder="例：名問の森"><datalist id="logResourceList"></datalist><div id="logResourceQuick" class="quick-row"></div></div>
        <div class="field"><label>やったこと</label><textarea id="logContent" class="input" placeholder="例：83〜87を解いた / 構造決定252を復習" required></textarea></div>
        <div class="field"><label>メモ（任意）</label><textarea id="logNote" class="input" placeholder="気づき・次にやること"></textarea></div>
        <div class="modal-actions"><button class="btn btn-primary" type="submit">記録する</button><button id="cancelLog" class="btn btn-secondary" type="button">キャンセル</button></div>
      </form>
    `);

    const root = $('#modalRoot');
    const getSubject = bindSubjectAndResources(root, initialSubject);
    $('#cancelLog', root).onclick = closeModal;
    $('#logForm', root).onsubmit = event => {
      event.preventDefault();
      const content = $('#logContent', root).value.trim();
      if (!content) {
        toast('やったことを入力してください');
        return;
      }
      const resource = $('#logResource', root).value.trim();
      const subject = getSubject();
      const log = {
        id: uid(),
        recordedAt: fromInput($('#logRecordedAt', root).value),
        subject,
        resource,
        content,
        note: $('#logNote', root).value.trim(),
        createdAt: new Date().toISOString()
      };
      logs.push(log);
      rememberResource(subject, resource);
      saveLogs();
      closeModal();
      toast('記録しました');
    };
  }

  function openEditLogModal(id) {
    logs = load(LOGS_KEY, []);
    const log = logs.find(item => item.id === id);
    if (!log) return;

    showModal(`
      <h3>やったことを編集</h3>
      <form id="editLogForm" class="activity-log-form">
        <div class="field"><label>日時</label><input id="logRecordedAt" class="input" type="datetime-local" value="${toInputValue(log.recordedAt)}" required></div>
        <div class="field"><label>科目</label><div class="subject-grid">${subjectGrid(log.subject)}</div></div>
        <div class="field"><label>教材</label><input id="logResource" class="input" list="logResourceList" value="${esc(log.resource || '')}"><datalist id="logResourceList"></datalist><div id="logResourceQuick" class="quick-row"></div></div>
        <div class="field"><label>やったこと</label><textarea id="logContent" class="input" required>${esc(log.content || '')}</textarea></div>
        <div class="field"><label>メモ（任意）</label><textarea id="logNote" class="input">${esc(log.note || '')}</textarea></div>
        <div class="modal-actions"><button class="btn btn-primary" type="submit">保存</button><button id="deleteLog" class="btn btn-danger" type="button">削除</button><button id="cancelLog" class="btn btn-secondary" type="button">キャンセル</button></div>
      </form>
    `);

    const root = $('#modalRoot');
    const getSubject = bindSubjectAndResources(root, log.subject, log.resource || '');
    $('#cancelLog', root).onclick = closeModal;
    $('#editLogForm', root).onsubmit = event => {
      event.preventDefault();
      const content = $('#logContent', root).value.trim();
      if (!content) {
        toast('やったことを入力してください');
        return;
      }
      log.recordedAt = fromInput($('#logRecordedAt', root).value);
      log.subject = getSubject();
      log.resource = $('#logResource', root).value.trim();
      log.content = content;
      log.note = $('#logNote', root).value.trim();
      rememberResource(log.subject, log.resource);
      saveLogs();
      closeModal();
      toast('更新しました');
    };
    $('#deleteLog', root).onclick = () => confirmDeleteLog(log);
  }

  function confirmDeleteLog(log) {
    showModal(`
      <h3>この記録を削除しますか？</h3>
      <p><b>${esc(log.subject)}</b>${log.resource ? ` / ${esc(log.resource)}` : ''}<br>${esc(log.content)}</p>
      <div class="modal-actions"><button id="confirmDeleteLog" class="btn btn-danger">削除</button><button id="cancelDeleteLog" class="btn btn-secondary">キャンセル</button></div>
    `);
    $('#confirmDeleteLog').onclick = () => {
      logs = load(LOGS_KEY, []).filter(item => item.id !== log.id);
      saveLogs();
      closeModal();
      toast('削除しました');
    };
    $('#cancelDeleteLog').onclick = () => openEditLogModal(log.id);
  }

  function logCard(log) {
    return `<article class="card activity-log-card" data-log-open="${log.id}">
      <div class="row" style="gap:8px;flex-wrap:wrap"><span class="subject-badge">${esc(log.subject)}</span><span class="time">${fmtTime(log.recordedAt)}</span><span class="activity-log-type">DONE</span></div>
      ${log.resource ? `<div class="resource">${esc(log.resource)}</div>` : ''}
      <div class="activity-log-content">${esc(log.content)}</div>
      ${log.note ? `<div class="activity-log-note">${esc(log.note)}</div>` : ''}
    </article>`;
  }

  function homeSignature(items) {
    return JSON.stringify(items.map(item => [item.id,item.recordedAt,item.subject,item.resource,item.content,item.note]));
  }

  function renderHomeLogs() {
    const home = $('#view-home');
    if (!home) return;
    logs = load(LOGS_KEY, []);
    const today = logs
      .filter(log => sameLocalDate(log.recordedAt, todayYMD()))
      .sort((a,b) => parseLocal(b.recordedAt) - parseLocal(a.recordedAt));
    const signature = homeSignature(today);
    let section = $('.activity-log-section', home);
    if (section && section.dataset.signature === signature) return;
    if (!section) {
      section = document.createElement('div');
      section.className = 'activity-log-section';
      home.appendChild(section);
    }
    section.dataset.signature = signature;
    section.innerHTML = `
      <div class="section-head"><h2>やったこと</h2><span>${today.length}件</span></div>
      <div class="activity-log-list">
        ${today.length ? today.map(logCard).join('') : '<div class="empty activity-log-empty">内容だけの記録はまだありません。</div>'}
      </div>
    `;
  }

  function renderSearchLogs() {
    const view = $('#view-search');
    if (!view) return;
    const input = $('#searchInput', view);
    const results = $('#searchResults', view);
    if (!input || !results) return;

    input.placeholder = '教材・メモ・返信・やったことを検索';
    logs = load(LOGS_KEY, []);
    const q = input.value.trim().toLowerCase();
    const activeFilter = $('.filter-chip.active', view)?.dataset.filter || 'All';
    const matches = logs.filter(log => {
      if (activeFilter !== 'All' && log.subject !== activeFilter) return false;
      const hay = [log.subject, log.resource, log.content, log.note].join('\n').toLowerCase();
      return !q || hay.includes(q);
    }).sort((a,b) => parseLocal(b.recordedAt) - parseLocal(a.recordedAt));

    let section = $('#activitySearchSection', view);
    if (!section) {
      section = document.createElement('div');
      section.id = 'activitySearchSection';
      results.insertAdjacentElement('afterend', section);
    }
    const signature = homeSignature(matches) + `|${q}|${activeFilter}`;
    if (section.dataset.signature === signature) return;
    section.dataset.signature = signature;
    section.innerHTML = matches.length ? `
      <div class="section-head"><h2>やったこと</h2><span>${matches.length}件</span></div>
      <div class="activity-log-list">${matches.map(logCard).join('')}</div>
    ` : '';
  }

  function ensureLogFab() {
    let button = $('#logFab');
    if (button) return button;
    button = document.createElement('button');
    button.id = 'logFab';
    button.className = 'log-fab';
    button.type = 'button';
    button.textContent = '記録';
    button.setAttribute('aria-label', 'やったことを記録');
    button.onclick = openNewLogModal;
    document.body.appendChild(button);
    return button;
  }

  function syncFabVisibility() {
    const button = ensureLogFab();
    const homeActive = $('#view-home')?.classList.contains('active');
    button.style.display = homeActive ? 'inline-flex' : 'none';
  }

  function overrideExport() {
    const button = $('#exportBtn');
    if (!button || button.dataset.logsExport === '1') return;
    button.dataset.logsExport = '1';
    button.onclick = () => {
      const payload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        sessions: load('reco.sessions.v1', []),
        logs: load(LOGS_KEY, [])
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `reco-${todayYMD()}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('JSONを書き出しました');
    };
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderHomeLogs();
      renderSearchLogs();
      syncFabVisibility();
      overrideExport();
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    .log-fab {
      position: fixed;
      right: max(20px, calc((100vw - 720px)/2 + 20px));
      bottom: 154px;
      height: 44px;
      min-width: 66px;
      padding: 0 16px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--surface);
      color: var(--text);
      font-weight: 800;
      box-shadow: 0 10px 24px rgba(20,24,36,.14);
      align-items: center;
      justify-content: center;
      z-index: 30;
    }
    body.reco-dark .log-fab { box-shadow: 0 10px 24px rgba(0,0,0,.5); }
    .activity-log-form { display: grid; gap: 18px; margin-top: 16px; }
    .activity-log-list { display: grid; gap: 10px; }
    .activity-log-card { cursor: pointer; box-shadow: none; }
    .activity-log-card:active { transform: scale(.995); }
    .activity-log-content { margin-top: 12px; line-height: 1.55; font-weight: 750; white-space: pre-wrap; }
    .activity-log-note { margin-top: 8px; color: var(--muted); font-size: 13px; line-height: 1.55; white-space: pre-wrap; }
    .activity-log-type { color: var(--muted); font-size: 10px; font-weight: 900; letter-spacing: .08em; }
    .activity-log-empty { padding-top: 24px; padding-bottom: 24px; }
  `;
  document.head.appendChild(style);

  document.addEventListener('click', event => {
    const card = event.target.closest('[data-log-open]');
    if (card) openEditLogModal(card.dataset.logOpen);
  });

  document.addEventListener('input', event => {
    if (event.target?.id === 'searchInput') scheduleRender();
  });

  window.addEventListener('reco:logs-updated', () => {
    logs = load(LOGS_KEY, []);
    scheduleRender();
  });

  window.addEventListener('storage', event => {
    if (event.key === LOGS_KEY || event.key === RESOURCE_KEY) {
      logs = load(LOGS_KEY, []);
      scheduleRender();
    }
  });

  new MutationObserver(scheduleRender).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  scheduleRender();
})();
