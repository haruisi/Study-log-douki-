// Insights v0.6.1 -----------------------------------------------------------
const INSIGHTS_STORAGE_KEY = 'reco.sessions.v1';
const INSIGHTS_SUBJECTS = ['数学', '英語', '物理', '化学', '国語', '地理', 'その他'];
const INSIGHTS_SUBJECT_COLORS = {
  '数学': '#4f6bed',
  '英語': '#7b61c9',
  '物理': '#2f8f9d',
  '化学': '#d28a2f',
  '国語': '#c65b65',
  '地理': '#5b8f58',
  'その他': '#8a92a3'
};
let insightsPeriod = '7d';
let insightsRendering = false;

const insightPad = (n) => String(n).padStart(2, '0');
const insightEsc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));
const insightDuration = (mins) => {
  const rounded = Math.max(0, Math.round(mins));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};
const insightDateKey = (date) => `${date.getFullYear()}-${insightPad(date.getMonth() + 1)}-${insightPad(date.getDate())}`;
const insightStartOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};
const insightAddDays = (date, days) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};
const insightSessionMinutes = (session) => {
  if (!session?.endedAt) return 0;
  return Math.max(0, Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 60000));
};

function loadInsightSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INSIGHTS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((session) => session?.endedAt && session?.startedAt) : [];
  } catch {
    return [];
  }
}

function insightPeriodData(sessions, period) {
  const now = new Date();
  const today = insightStartOfDay(now);
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
    start = insightStartOfDay(earliest);
  } else {
    start = today;
  }

  const current = sessions.filter((session) => new Date(session.startedAt) >= start && new Date(session.startedAt) <= now);
  const previous = previousStart
    ? sessions.filter((session) => {
        const date = new Date(session.startedAt);
        return date >= previousStart && date < previousEnd;
      })
    : [];

  return { now, today, start, previousStart, previousEnd, current, previous };
}

function insightTotal(sessions) {
  return sessions.reduce((sum, session) => sum + insightSessionMinutes(session), 0);
}

function insightComparison(current, previous, period) {
  if (period === 'all') return '<span class="insight-delta neutral">All recorded sessions</span>';
  if (!previous && current) return '<span class="insight-delta neutral">No previous-period data</span>';
  if (!previous && !current) return '<span class="insight-delta neutral">No study time yet</span>';
  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? '+' : '';
  const cls = change > 0.05 ? 'up' : change < -0.05 ? 'down' : 'neutral';
  return `<span class="insight-delta ${cls}">${sign}${change.toFixed(1)}% vs previous period</span>`;
}

function insightDailySeries(sessions, start, today) {
  const totals = new Map();
  sessions.forEach((session) => {
    const key = insightDateKey(new Date(session.startedAt));
    totals.set(key, (totals.get(key) || 0) + insightSessionMinutes(session));
  });

  const historyStart = insightAddDays(start, -6);
  const days = [];
  for (let cursor = new Date(historyStart); cursor <= today; cursor = insightAddDays(cursor, 1)) {
    const date = new Date(cursor);
    days.push({ date, minutes: totals.get(insightDateKey(date)) || 0 });
  }

  return days.map((day, index) => {
    const from = Math.max(0, index - 6);
    const slice = days.slice(from, index + 1);
    const average = slice.reduce((sum, item) => sum + item.minutes, 0) / slice.length;
    return { ...day, average };
  }).filter((day) => day.date >= start);
}

function insightTrendChart(series, period) {
  if (!series.length) return '<div class="empty insight-empty">No data yet.</div>';

  const step = period === '7d' ? 52 : period === '30d' ? 30 : 24;
  const width = Math.max(560, series.length * step);
  const plotHeight = 132;
  const labelY = 156;
  const height = 172;
  const maxValue = Math.max(60, ...series.flatMap((item) => [item.minutes, item.average]));
  const y = (value) => plotHeight - (value / maxValue) * (plotHeight - 12);
  const barWidth = Math.max(8, Math.min(20, step * 0.48));

  const bars = series.map((item, index) => {
    const x = index * step + (step - barWidth) / 2;
    const top = y(item.minutes);
    return `<rect class="insight-chart-bar" x="${x.toFixed(2)}" y="${top.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${Math.max(1, plotHeight - top).toFixed(2)}" rx="${Math.min(5, barWidth / 2).toFixed(2)}"><title>${item.date.getMonth() + 1}/${item.date.getDate()} · ${insightDuration(item.minutes)}</title></rect>`;
  }).join('');

  const points = series.map((item, index) => `${(index * step + step / 2).toFixed(2)},${y(item.average).toFixed(2)}`).join(' ');
  const dots = series.map((item, index) => `<circle class="insight-chart-dot" cx="${(index * step + step / 2).toFixed(2)}" cy="${y(item.average).toFixed(2)}" r="2.7"><title>7-day avg · ${insightDuration(item.average)}</title></circle>`).join('');

  const labelEvery = period === '7d' ? 1 : period === '30d' ? 5 : Math.max(7, Math.ceil(series.length / 10));
  const labels = series.map((item, index) => {
    const show = index === 0 || index === series.length - 1 || index % labelEvery === 0;
    if (!show) return '';
    const label = `${item.date.getMonth() + 1}/${item.date.getDate()}`;
    return `<text class="insight-chart-label" x="${(index * step + step / 2).toFixed(2)}" y="${labelY}" text-anchor="middle">${label}</text>`;
  }).join('');

  return `
    <div class="insight-chart-scroll" data-insight-chart-scroll>
      <svg class="insight-chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Daily study time with seven-day moving average">
        <line class="insight-chart-baseline" x1="0" y1="${plotHeight}" x2="${width}" y2="${plotHeight}"></line>
        ${bars}
        <polyline class="insight-chart-average" points="${points}"></polyline>
        ${dots}
        ${labels}
      </svg>
    </div>`;
}

function insightPiePoint(cx, cy, radius, angle) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

function insightPiePath(cx, cy, radius, startAngle, endAngle) {
  const start = insightPiePoint(cx, cy, radius, startAngle);
  const end = insightPiePoint(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)} Z`;
}

function insightSubjectBalance(current, previous, period) {
  const currentTotals = Object.fromEntries(INSIGHTS_SUBJECTS.map((subject) => [subject, 0]));
  const previousTotals = Object.fromEntries(INSIGHTS_SUBJECTS.map((subject) => [subject, 0]));

  current.forEach((session) => {
    const subject = INSIGHTS_SUBJECTS.includes(session.subject) ? session.subject : 'その他';
    currentTotals[subject] += insightSessionMinutes(session);
  });
  previous.forEach((session) => {
    const subject = INSIGHTS_SUBJECTS.includes(session.subject) ? session.subject : 'その他';
    previousTotals[subject] += insightSessionMinutes(session);
  });

  const currentTotal = Object.values(currentTotals).reduce((sum, value) => sum + value, 0);
  const previousTotal = Object.values(previousTotals).reduce((sum, value) => sum + value, 0);
  const subjects = INSIGHTS_SUBJECTS.filter((subject) => currentTotals[subject] > 0)
    .sort((a, b) => currentTotals[b] - currentTotals[a]);

  if (!subjects.length) return '<div class="empty insight-empty">No subject data yet.</div>';

  let angle = 0;
  const slices = subjects.length === 1
    ? `<circle cx="100" cy="100" r="88" fill="${INSIGHTS_SUBJECT_COLORS[subjects[0]]}"><title>${insightEsc(subjects[0])} · 100% · ${insightDuration(currentTotals[subjects[0]])}</title></circle>`
    : subjects.map((subject) => {
        const minutes = currentTotals[subject];
        const share = currentTotal ? (minutes / currentTotal) * 100 : 0;
        const startAngle = angle;
        angle += (share / 100) * 360;
        return `<path class="insight-pie-slice" d="${insightPiePath(100, 100, 88, startAngle, angle)}" fill="${INSIGHTS_SUBJECT_COLORS[subject]}"><title>${insightEsc(subject)} · ${share.toFixed(1)}% · ${insightDuration(minutes)}</title></path>`;
      }).join('');

  const legend = subjects.map((subject) => {
    const minutes = currentTotals[subject];
    const share = currentTotal ? (minutes / currentTotal) * 100 : 0;
    let delta = '';
    if (period !== 'all') {
      if (previousTotal > 0) {
        const previousShare = (previousTotals[subject] / previousTotal) * 100;
        const points = share - previousShare;
        const sign = points > 0.05 ? '+' : '';
        const cls = points > 0.05 ? 'up' : points < -0.05 ? 'down' : 'neutral';
        delta = `<span class="subject-delta ${cls}">${sign}${points.toFixed(1)}pt</span>`;
      } else {
        delta = '<span class="subject-delta neutral">—</span>';
      }
    }

    return `
      <div class="insight-pie-legend-row">
        <span class="insight-subject-dot" style="background:${INSIGHTS_SUBJECT_COLORS[subject]}"></span>
        <div class="insight-pie-legend-main">
          <b>${insightEsc(subject)}</b>
          <span>${insightDuration(minutes)}</span>
        </div>
        <div class="insight-pie-legend-value">
          <b>${share.toFixed(0)}%</b>
          ${delta}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="insight-pie-layout">
      <div class="insight-pie-visual">
        <svg class="insight-pie" viewBox="0 0 200 200" role="img" aria-label="Study time share by subject">
          ${slices}
        </svg>
        <div class="insight-pie-caption"><span>Total</span><b>${insightDuration(currentTotal)}</b></div>
      </div>
      <div class="insight-pie-legend">${legend}</div>
    </div>`;
}

function insightResourceRows(current) {
  const totals = new Map();
  current.forEach((session) => {
    const resource = String(session.resource || '').trim();
    if (!resource) return;
    const subject = INSIGHTS_SUBJECTS.includes(session.subject) ? session.subject : 'その他';
    const key = `${subject}\u0000${resource}`;
    totals.set(key, (totals.get(key) || 0) + insightSessionMinutes(session));
  });

  const rows = [...totals.entries()]
    .map(([key, minutes]) => {
      const [subject, resource] = key.split('\u0000');
      return { subject, resource, minutes };
    })
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 8);

  if (!rows.length) return '<div class="empty insight-empty">No material data yet.</div>';
  const max = rows[0].minutes || 1;

  return rows.map((row, index) => `
    <div class="insight-resource-row">
      <span class="insight-rank">${index + 1}</span>
      <div class="insight-resource-main">
        <div class="insight-resource-title">${insightEsc(row.resource)}</div>
        <div class="insight-resource-meta">${insightEsc(row.subject)}</div>
        <div class="insight-resource-track"><div class="insight-resource-bar" style="width:${Math.max(3, (row.minutes / max) * 100).toFixed(1)}%"></div></div>
      </div>
      <b>${insightDuration(row.minutes)}</b>
    </div>`).join('');
}

function renderEnhancedInsights(force = false) {
  const el = document.querySelector('#view-stats');
  if (!el || insightsRendering) return;
  if (!force && el.querySelector('.insights-v061')) return;

  insightsRendering = true;
  try {
    const sessions = loadInsightSessions();
    const { today, start, current, previous } = insightPeriodData(sessions, insightsPeriod);
    const currentTotal = insightTotal(current);
    const previousTotal = insightTotal(previous);
    const todayTotal = sessions
      .filter((session) => insightDateKey(new Date(session.startedAt)) === insightDateKey(today))
      .reduce((sum, session) => sum + insightSessionMinutes(session), 0);
    const series = insightDailySeries(sessions, start, today);
    const latestAverage = series.length ? series[series.length - 1].average : 0;
    const periodLabel = insightsPeriod === '7d' ? 'Last 7 days' : insightsPeriod === '30d' ? 'Last 30 days' : 'All time';

    el.innerHTML = `
      <div class="insights-v061">
        <div class="insight-title-row">
          <h1 class="page-title">Insights</h1>
          <div class="insight-range" role="group" aria-label="Insight period">
            <button class="insight-range-button ${insightsPeriod === '7d' ? 'active' : ''}" data-insight-period="7d">7D</button>
            <button class="insight-range-button ${insightsPeriod === '30d' ? 'active' : ''}" data-insight-period="30d">30D</button>
            <button class="insight-range-button ${insightsPeriod === 'all' ? 'active' : ''}" data-insight-period="all">ALL</button>
          </div>
        </div>

        <section class="insight-overview">
          <div class="insight-total-card">
            <span class="insight-kicker">${periodLabel}</span>
            <strong>${insightDuration(currentTotal)}</strong>
            ${insightComparison(currentTotal, previousTotal, insightsPeriod)}
          </div>
          <div class="insight-mini-card"><span>Today</span><b>${insightDuration(todayTotal)}</b></div>
          <div class="insight-mini-card"><span>7-day avg</span><b>${insightDuration(latestAverage)}</b></div>
        </section>

        <div class="section-head insight-section-head"><h2>Study Time Trend</h2><span>Daily · 7-day avg</span></div>
        <div class="card insight-panel insight-trend-panel">
          ${insightTrendChart(series, insightsPeriod)}
          <div class="insight-legend"><span><i class="legend-bar"></i>Daily</span><span><i class="legend-line"></i>7-day average</span></div>
        </div>

        <div class="section-head insight-section-head"><h2>Subject Balance</h2><span>${periodLabel}</span></div>
        <div class="card insight-panel insight-subject-panel">${insightSubjectBalance(current, previous, insightsPeriod)}</div>

        <div class="section-head insight-section-head"><h2>Materials</h2><span>Top 8 · ${periodLabel}</span></div>
        <div class="card insight-panel">${insightResourceRows(current)}</div>
      </div>`;

    requestAnimationFrame(() => {
      const scroll = el.querySelector('[data-insight-chart-scroll]');
      if (scroll) scroll.scrollLeft = scroll.scrollWidth;
    });
  } finally {
    insightsRendering = false;
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-insight-period]');
  if (!button) return;
  insightsPeriod = button.dataset.insightPeriod;
  renderEnhancedInsights(true);
});

function upgradeInsightsNav() {
  const navLabel = document.querySelector('.bottom-nav [data-nav="stats"] small');
  if (navLabel && navLabel.textContent !== 'Insights') navLabel.textContent = 'Insights';
  renderEnhancedInsights();
}

upgradeInsightsNav();
new MutationObserver(() => upgradeInsightsNav())
  .observe(document.body, { childList: true, subtree: true });
