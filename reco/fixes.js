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

upgradeReplyInput();
new MutationObserver(() => upgradeReplyInput())
  .observe(document.body, { childList: true, subtree: true });
