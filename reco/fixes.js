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

// iOS Safari changes the visual viewport when its browser chrome expands/collapses.
// Keep Reco's floating bottom controls at the same physical screen position by
// applying the inverse of that viewport movement.
(() => {
  const vv = window.visualViewport;
  if (!vv) return;

  let baselineBottom = null;
  let baselineWidth = vv.width;
  let baselineHeight = vv.height;
  let settleTimer = null;

  const viewportBottom = () => vv.offsetTop + vv.height;

  const setBaseline = () => {
    baselineBottom = viewportBottom();
    baselineWidth = vv.width;
    baselineHeight = vv.height;
    document.documentElement.style.setProperty('--reco-vv-shift', '0px');
  };

  const update = () => {
    if (baselineBottom == null) {
      setBaseline();
      return;
    }

    // Orientation / major viewport changes get a fresh reference position.
    const widthChanged = Math.abs(vv.width - baselineWidth) > 80;
    const hugeHeightChange = Math.abs(vv.height - baselineHeight) > 260;
    if (widthChanged || hugeHeightChange) {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(setBaseline, 120);
      return;
    }

    const delta = baselineBottom - viewportBottom();
    // Safari chrome movement is normally well inside this range. Clamping also
    // prevents pull-to-refresh overscroll from throwing the controls far away.
    const clamped = Math.max(-160, Math.min(180, delta));
    document.documentElement.style.setProperty('--reco-vv-shift', `${clamped}px`);
  };

  // Establish the initial visible position after Safari has settled the page.
  requestAnimationFrame(() => requestAnimationFrame(setBaseline));
  setTimeout(setBaseline, 180);

  vv.addEventListener('resize', update, { passive: true });
  vv.addEventListener('scroll', update, { passive: true });
  window.addEventListener('orientationchange', () => {
    baselineBottom = null;
    setTimeout(setBaseline, 300);
  }, { passive: true });
})();
