(() => {
  const home = document.querySelector('#view-home');
  if (!home) return;
  const surface = document.createElement('div');
  surface.id = 'radicalSurface';
  surface.className = 'radical-surface';
  surface.innerHTML = '<div class="radical-empty">Reco</div>';
  home.prepend(surface);
})();
