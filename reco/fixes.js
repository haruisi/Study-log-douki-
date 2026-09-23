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
