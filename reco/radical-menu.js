(() => {
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
  function close(){q('#radicalMenu')?.remove()}
  function nav(view){qa('.nav-item').find(n=>n.dataset.nav===view)?.click();close()}
  function action(label,fn){const b=el('button','',label);b.type='button';b.onclick=fn;return b}
  function open(){
    if(q('#radicalMenu')){close();return}
    const overlay=el('div','radical-overlay');overlay.id='radicalMenu';
    const panel=el('div','radical-menu');
    const x=el('button','radical-close','×');x.type='button';x.onclick=close;
    const list=el('div','radical-menu-list');
    list.append(
      action('Home',()=>nav('home')),
      action('Search',()=>nav('search')),
      action('Insights',()=>nav('stats')),
      action('Record activity',()=>{close();q('#logFab')?.click()}),
      action('Sync',()=>{close();q('#syncBtn')?.click()}),
      action('Export',()=>{close();q('#exportBtn')?.click()})
    );
    panel.append(x,list);overlay.appendChild(panel);
    overlay.onclick=e=>{if(e.target===overlay)close()};
    document.body.appendChild(overlay);requestAnimationFrame(()=>overlay.classList.add('open'));
  }
  function install(){
    const bar=q('.topbar');if(!bar||q('#radicalMenuButton'))return;
    const b=el('button','radical-menu-button','•••');b.id='radicalMenuButton';b.type='button';b.setAttribute('aria-label','メニュー');b.onclick=open;bar.appendChild(b);
  }
  install();setTimeout(install,0);
})();
