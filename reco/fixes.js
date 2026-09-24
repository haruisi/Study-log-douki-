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

upgradeReplyInput();
applyClockVisibility();
new MutationObserver(() => {
  upgradeReplyInput();
  markClockTimes();
})
  .observe(document.body, { childList: true, subtree: true });
