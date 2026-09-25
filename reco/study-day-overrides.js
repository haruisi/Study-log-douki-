(() => {
  const STUDY_DAY_START_HOUR = 4;
  const SESSION_KEY = 'reco.sessions.v1';
  const LOG_KEY = 'reco.logs.v1';

  const pad = (n) => String(n).padStart(2, '0');
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value == null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function studyDayDate(value = new Date()) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    date.setHours(date.getHours() - STUDY_DAY_START_HOUR);
    return date;
  }

  function studyDayKey(value = new Date()) {
    const date = studyDayDate(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function studyDayStart(value = new Date()) {
    const shifted = studyDayDate(value);
    const start = new Date(shifted);
    start.setHours(STUDY_DAY_START_HOUR, 0, 0, 0);
    return start;
  }

  function formatDuration(minutes) {
    const rounded = Math.max(0, Math.round(minutes));
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    return hours ? `${hours}h ${mins}m` : `${mins}m`;
  }

  function sessionMinutes(session) {
    if (!session?.endedAt || !session?.startedAt) return 0;
    return Math.max(0, Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 60000));
  }

  function patchInsightFunctions() {
    if (typeof insightPeriodData === 'function') {
      insightPeriodData = function(sessions, period) {
        const now = new Date();
        const today = studyDayStart(now);
        let start = null;
        let previousStart = null;
        let previousEnd = null;

        if (period === '7d') {
          start = insightAddDays(today, -6);
          previousEnd = start;
          previousStart = insightAddDays(start, -7);
        } else if (period === '30d') {
          start = insightAddDays(today, -29);
          previousEnd = start;
          previousStart = insightAddDays(start, -30);
        } else if (sessions.length) {
          const earliest = sessions.reduce((min, session) => {
            const date = new Date(session.startedAt);
            return !min || date < min ? date : min;
          }, null);
          start = studyDayStart(earliest);
        } else {
          start = today;
        }

        const current = sessions.filter((session) => {
          const date = new Date(session.startedAt);
          return date >= start && date <= now;
        });
        const previous = previousStart
          ? sessions.filter((session) => {
              const date = new Date(session.startedAt);
              return date >= previousStart && date < previousEnd;
            })
          : [];

        return { now, today, start, previousStart, previousEnd, current, previous };
      };
    }

    if (typeof insightDailySeries === 'function') {
      insightDailySeries = function(sessions, start, today) {
        const totals = new Map();
        sessions.forEach((session) => {
          const key = studyDayKey(session.startedAt);
          totals.set(key, (totals.get(key) || 0) + insightSessionMinutes(session));
        });

        const historyStart = insightAddDays(start, -6);
        const days = [];
        for (let cursor = new Date(historyStart); cursor <= today; cursor = insightAddDays(cursor, 1)) {
          const date = new Date(cursor);
          days.push({ date, minutes: totals.get(studyDayKey(date)) || 0 });
        }

        return days.map((day, index) => {
          const from = Math.max(0, index - 6);
          const slice = days.slice(from, index + 1);
          const average = slice.reduce((sum, item) => sum + item.minutes, 0) / slice.length;
          return { ...day, average };
        }).filter((day) => day.date >= start);
      };
    }
  }

  function patchInsightsToday() {
    const root = document.querySelector('#view-stats .insights-v061');
    if (!root) return;
    const sessions = readJson(SESSION_KEY, []).filter((session) => session?.startedAt && session?.endedAt);
    const todayKey = studyDayKey();
    const total = sessions
      .filter((session) => studyDayKey(session.startedAt) === todayKey)
      .reduce((sum, session) => sum + sessionMinutes(session), 0);
    const card = [...root.querySelectorAll('.insight-mini-card')]
      .find((item) => item.querySelector('span')?.textContent?.trim() === 'Today');
    const value = card?.querySelector('b');
    if (value && value.textContent !== formatDuration(total)) value.textContent = formatDuration(total);
  }

  function formatLogTime(iso) {
    const date = new Date(iso);
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function logCard(log) {
    return `<article class="card activity-log-card" data-log-open="${log.id}">
      <div class="row" style="gap:8px;flex-wrap:wrap"><span class="subject-badge">${esc(log.subject)}</span><span class="time">${formatLogTime(log.recordedAt)}</span><span class="activity-log-type">DONE</span></div>
      ${log.resource ? `<div class="resource">${esc(log.resource)}</div>` : ''}
      <div class="activity-log-content">${esc(log.content)}</div>
      ${log.note ? `<div class="activity-log-note">${esc(log.note)}</div>` : ''}
    </article>`;
  }

  function patchActivityLogs() {
    const home = document.querySelector('#view-home');
    const section = home?.querySelector('.activity-log-section');
    if (!section) return;

    const todayKey = studyDayKey();
    const logs = readJson(LOG_KEY, [])
      .filter((log) => log?.recordedAt && studyDayKey(log.recordedAt) === todayKey)
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));

    const expected = `
      <div class="section-head"><h2>やったこと</h2><span>${logs.length}件</span></div>
      <div class="activity-log-list">
        ${logs.length ? logs.map(logCard).join('') : '<div class="empty activity-log-empty">内容だけの記録はまだありません。</div>'}
      </div>
    `;

    if (section.innerHTML !== expected) section.innerHTML = expected;
  }

  function showToast(message) {
    const toast = document.querySelector('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 1600);
  }

  function patchExport() {
    const button = document.querySelector('#exportBtn');
    if (!button || button.dataset.studyDayExport === '1') return;
    button.dataset.studyDayExport = '1';
    button.onclick = () => {
      const payload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        sessions: readJson(SESSION_KEY, []),
        logs: readJson(LOG_KEY, [])
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `reco-${studyDayKey()}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('JSONを書き出しました');
    };
  }

  function patchViews() {
    patchInsightsToday();
    patchActivityLogs();
    patchExport();
  }

  patchInsightFunctions();
  let activeStudyDay = studyDayKey();

  const refreshInsights = () => {
    if (typeof renderEnhancedInsights === 'function') renderEnhancedInsights(true);
    requestAnimationFrame(patchViews);
  };

  setTimeout(refreshInsights, 0);

  new MutationObserver(() => patchViews())
    .observe(document.body, { childList: true, subtree: true });

  setInterval(() => {
    const nextStudyDay = studyDayKey();
    if (nextStudyDay !== activeStudyDay) {
      activeStudyDay = nextStudyDay;
      refreshInsights();
    } else {
      patchViews();
    }
  }, 30000);
})();
