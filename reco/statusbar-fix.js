// Keep Safari/iPadOS chrome on the light appearance while Reco itself can be dark.
// This is intentionally separate from the app theme: dark mode paints only the web content.
(() => {
  const LIGHT_THEME_COLOR = '#f6f7fb';

  const keepSystemChromeLight = () => {
    document.documentElement.style.colorScheme = 'light';

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor && themeColor.content !== LIGHT_THEME_COLOR) {
      themeColor.content = LIGHT_THEME_COLOR;
    }
  };

  keepSystemChromeLight();

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    new MutationObserver(() => keepSystemChromeLight())
      .observe(themeColor, { attributes: true, attributeFilter: ['content'] });
  }

  // fixes.js changes theme-color inside the dark-mode button handler.
  // Re-apply after pointer/click interaction so the web content remains dark
  // without advertising a dark browser/system chrome theme.
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#darkModeBtn')) {
      queueMicrotask(keepSystemChromeLight);
      requestAnimationFrame(keepSystemChromeLight);
    }
  }, true);
})();
