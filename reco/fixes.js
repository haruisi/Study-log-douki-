// Robust navigation for dynamically-rendered back buttons.
document.addEventListener('click', (event) => {
  const back = event.target.closest('.back[data-nav]');
  if (!back) return;

  const destination = back.dataset.nav;
  const navButton = document.querySelector(`.bottom-nav [data-nav="${destination}"]`)
    || document.querySelector(`.brand[data-nav="${destination}"]`);

  if (navButton && typeof navButton.onclick === 'function') {
    event.preventDefault();
    event.stopImmediatePropagation();
    navButton.onclick();
  }
}, true);

// Make the reply field multiline. Enter inserts a newline; the Send button submits.
function upgradeReplyInput(root = document) {
  const input = root.querySelector?.('#replyInput');
  if (!input || input.tagName === 'TEXTAREA') return;

  const textarea = document.createElement('textarea');
  textarea.id = input.id;
  textarea.className = input.className;
  textarea.placeholder = input.placeholder;
  textarea.rows = 3;
  textarea.value = input.value;
  textarea.setAttribute('aria-label', input.getAttribute('aria-label') || '返信');

  input.replaceWith(textarea);
}

const replyStyle = document.createElement('style');
replyStyle.textContent = `
  .reply-form textarea.input {
    min-height: 78px;
    line-height: 1.5;
    resize: vertical;
  }
  .reply-form .btn {
    align-self: flex-end;
  }
`;
document.head.appendChild(replyStyle);

// Clock visibility preference. This hides wall-clock timestamps while keeping study duration visible.
const CLOCK_VISIBILITY_KEY = 'reco.showClock.v1';
let clockVisible = localStorage.getItem(CLOCK_VISIBILITY_KEY) !== 'false';

const clockStyle = document.createElement('style');
clockStyle.textContent = `
  body.clock-time-hidden [data-clock-time] {
    display: none !important;
  }
  #clockVisibilityBtn {
    position: relative;
  }
  #clockVisibilityBtn[data-state="off"]::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 18px;
    height: 2px;
    border-radius: 999px;
    background: currentColor;
    transform: translate(-50%, -50%) rotate(-45deg);
    pointer-events: none;
  }
`;
document.head.appendChild(clockStyle);

function ensureClockVisibilityButton() {
  const actions = document.querySelector('.top-actions');
  if (!actions) return null;

  let button = document.querySelector('#clockVisibilityBtn');
  if (button) return button;

  button = document.createElement('button');
  button.id = 'clockVisibilityBtn';
  button.className = 'icon-btn';
  button.type = 'button';
  button.textContent = '◷';
  button.onclick = () => {
    clockVisible = !clockVisible;
    localStorage.setItem(CLOCK_VISIBILITY_KEY, String(clockVisible));
    applyClockVisibility();
  };

  const syncButton = document.querySelector('#syncBtn');
  actions.insertBefore(button, syncButton || actions.firstChild);
  return button;
}

function markClockTimes(root = document) {
  root.querySelectorAll?.('.time').forEach((element) => {
    element.dataset.clockTime = '';
  });

  root.querySelectorAll?.('.detail-meta .subject-badge').forEach((element) => {
    if (/\b\d{1,2}:\d{2}\b/.test(element.textContent || '')) {
      element.dataset.clockTime = '';
    }
  });

  // Reply timestamps include both date and time. Keep the date visible and hide only HH:MM.
  root.querySelectorAll?.('.reply time').forEach((element) => {
    if (element.dataset.clockProcessed === '1') return;
    const text = element.textContent || '';
    const match = text.match(/^(.*?)(\d{1,2}:\d{2})(\s*)$/);
    if (!match) return;

    element.textContent = '';
    element.append(document.createTextNode(match[1]));
    const timePart = document.createElement('span');
    timePart.dataset.clockTime = '';
    timePart.textContent = match[2];
    element.append(timePart, document.createTextNode(match[3]));
    element.dataset.clockProcessed = '1';
  });

  // The conflict dialog prints the active session's start time as plain text after a <br>.
  root.querySelectorAll?.('#modalRoot p').forEach((element) => {
    if (element.dataset.clockProcessed === '1') return;
    const br = element.querySelector('br');
    if (!br) return;

    let node = br.nextSibling;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE && /\b\d{1,2}:\d{2}\b/.test(node.textContent || '')) {
        const wrapper = document.createElement('span');
        wrapper.dataset.clockTime = '';
        wrapper.textContent = node.textContent;
        node.replaceWith(wrapper);
        element.dataset.clockProcessed = '1';
        break;
      }
      node = node.nextSibling;
    }
  });
}

function applyClockVisibility() {
  const button = ensureClockVisibilityButton();
  markClockTimes();
  document.body.classList.toggle('clock-time-hidden', !clockVisible);

  if (button) {
    button.dataset.state = clockVisible ? 'on' : 'off';
    button.setAttribute('aria-pressed', String(clockVisible));
    button.setAttribute('aria-label', clockVisible ? '時刻表示を隠す' : '時刻表示を表示する');
    button.title = clockVisible ? '時刻表示: ON' : '時刻表示: OFF';
  }
}

// Pure-black dark mode. Intentionally avoid setting a global CSS color-scheme so iPadOS
// is not explicitly asked to switch native status-bar text to the light appearance.
const DARK_MODE_KEY = 'reco.darkMode.v1';
let darkModeEnabled = localStorage.getItem(DARK_MODE_KEY) === 'true';

const darkModeStyle = document.createElement('style');
darkModeStyle.textContent = `
  body.reco-dark {
    --bg: #000000;
    --surface: #0b0b0d;
    --surface-2: #17171a;
    --text: #f5f5f7;
    --muted: #9a9aa1;
    --line: #29292e;
    --accent: #f5f5f7;
    --accent-soft: #19191c;
    --danger: #ff6b6b;
    --shadow: none;
    background: #000000;
  }

  html.reco-dark-root,
  html.reco-dark-root body {
    background: #000000;
  }

  body.reco-dark .topbar,
  body.reco-dark .searchbar {
    background: rgba(0,0,0,.92);
  }

  body.reco-dark .bottom-nav {
    background: rgba(0,0,0,.96);
  }

  body.reco-dark .nav-item.active,
  body.reco-dark .subject-badge {
    color: var(--text);
  }

  body.reco-dark .card,
  body.reco-dark .stat-box,
  body.reco-dark .reply,
  body.reco-dark .modal,
  body.reco-dark .filter-chip,
  body.reco-dark .quick,
  body.reco-dark .insight-range {
    background: var(--surface);
    color: var(--text);
  }

  body.reco-dark .input,
  body.reco-dark .subject-chip {
    background: #101012;
    color: var(--text);
    border-color: var(--line);
  }

  body.reco-dark .input:focus {
    background: #141417;
    border-color: #5a5a62;
  }

  body.reco-dark input[type="datetime-local"] {
    color-scheme: dark;
  }

  body.reco-dark .btn-primary {
    background: #f5f5f7;
    color: #09090a;
  }

  body.reco-dark .now-card {
    background: #111114;
    color: #f5f5f7;
    border: 1px solid #25252a;
  }

  body.reco-dark .now-card .btn-primary {
    background: #f5f5f7;
    color: #09090a;
  }

  body.reco-dark .btn-secondary {
    background: var(--surface-2);
    color: var(--text);
  }

  body.reco-dark .btn-danger {
    background: #291315;
    color: #ff8585;
  }

  body.reco-dark .subject-chip.selected,
  body.reco-dark .filter-chip.active,
  body.reco-dark .insight-range-button.active {
    background: #f5f5f7;
    color: #09090a;
    border-color: #f5f5f7;
  }

  body.reco-dark .fab {
    background: #f5f5f7;
    color: #09090a;
    box-shadow: 0 12px 30px rgba(0,0,0,.5);
  }

  body.reco-dark .toast {
    background: #f5f5f7;
    color: #09090a;
  }

  body.reco-dark .modal-backdrop {
    background: rgba(0,0,0,.72);
  }

  body.reco-dark .insight-chart-bar,
  body.reco-dark .legend-bar {
    fill: #3a3a40;
    background: #3a3a40;
  }

  body.reco-dark .insight-chart-average {
    stroke: #f5f5f7;
  }

  body.reco-dark .insight-chart-dot {
    fill: #f5f5f7;
  }

  body.reco-dark .insight-chart-baseline {
    stroke: #29292e;
  }

  body.reco-dark .insight-chart-label {
    fill: #9a9aa1;
  }

  body.reco-dark .legend-line,
  body.reco-dark .insight-resource-bar,
  body.reco-dark .bar {
    background: #d9d9de;
  }

  body.reco-dark .insight-range {
    border-color: var(--line);
  }

  body.reco-dark #darkModeBtn[data-state="on"] {
    background: #f5f5f7;
    color: #09090a;
    border-color: #f5f5f7;
  }
`;
document.head.appendChild(darkModeStyle);

function ensureDarkModeButton() {
  const actions = document.querySelector('.top-actions');
  if (!actions) return null;

  let button = document.querySelector('#darkModeBtn');
  if (button) return button;

  button = document.createElement('button');
  button.id = 'darkModeBtn';
  button.className = 'icon-btn';
  button.type = 'button';
  button.textContent = '◐';
  button.onclick = () => {
    darkModeEnabled = !darkModeEnabled;
    localStorage.setItem(DARK_MODE_KEY, String(darkModeEnabled));
    applyDarkMode();
  };

  const syncButton = document.querySelector('#syncBtn');
  actions.insertBefore(button, syncButton || actions.firstChild);
  return button;
}

function applyDarkMode() {
  const button = ensureDarkModeButton();
  document.documentElement.classList.toggle('reco-dark-root', darkModeEnabled);
  document.body.classList.toggle('reco-dark', darkModeEnabled);

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = darkModeEnabled ? '#000000' : '#f6f7fb';

  if (button) {
    button.dataset.state = darkModeEnabled ? 'on' : 'off';
    button.setAttribute('aria-pressed', String(darkModeEnabled));
    button.setAttribute('aria-label', darkModeEnabled ? 'ライトモードに切り替える' : 'ダークモードに切り替える');
    button.title = darkModeEnabled ? 'ダークモード: ON' : 'ダークモード: OFF';
  }
}

upgradeReplyInput();
applyClockVisibility();
applyDarkMode();
new MutationObserver(() => {
  upgradeReplyInput();
  markClockTimes();
})
  .observe(document.body, { childList: true, subtree: true });
