(() => {
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const ORDER=['home','search','stats'];
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
  function close(){q('#radicalMenu')?.remove()}
  function currentView(){
    const active=q('.view.active');
    if(!active)return 'home';
    if(active.id==='view-search')return 'search';
    if(active.id==='view-stats')return 'stats';
    return 'home';
  }
  function syncBottomNav(){
    const current=currentView();
    qa('[data-radical-nav]').forEach(button=>button.classList.toggle('active',button.dataset.radicalNav===current));
  }
  function nav(view){
    qa('.nav-item').find(n=>n.dataset.nav===view)?.click();
    close();
    requestAnimationFrame(syncBottomNav);
  }
  function action(label,fn){const b=el('button','',label);b.type='button';b.onclick=fn;return b}
  function open(){
    if(q('#radicalMenu')){close();return}
    const overlay=el('div','radical-overlay');overlay.id='radicalMenu';
    const panel=el('div','radical-menu');
    const x=el('button','radical-close','×');x.type='button';x.onclick=close;
    const list=el('div','radical-menu-list');
    list.append(
      action('Sync',()=>{close();q('#syncBtn')?.click()}),
      action('Export',()=>{close();q('#exportBtn')?.click()})
    );
    panel.append(x,list);overlay.appendChild(panel);
    overlay.onclick=e=>{if(e.target===overlay)close()};
    document.body.appendChild(overlay);requestAnimationFrame(()=>overlay.classList.add('open'));
  }
  function installMenu(){
    const bar=q('.topbar');if(!bar||q('#radicalMenuButton'))return;
    const b=el('button','radical-menu-button','•••');b.id='radicalMenuButton';b.type='button';b.setAttribute('aria-label','メニュー');b.onclick=open;bar.appendChild(b);
  }
  function installBottomNav(){
    if(q('#radicalBottomNav'))return;
    const navEl=el('nav','radical-bottom-nav');navEl.id='radicalBottomNav';navEl.setAttribute('aria-label','メインナビゲーション');
    [['home','Home'],['search','Search'],['stats','Insights']].forEach(([view,label])=>{
      const b=el('button','radical-bottom-item',label);b.type='button';b.dataset.radicalNav=view;b.onclick=()=>nav(view);navEl.appendChild(b);
    });
    document.body.appendChild(navEl);syncBottomNav();
  }
  function installSwipe(){
    let startX=null,startY=null;
    document.addEventListener('touchstart',event=>{
      if(q('.radical-overlay'))return;
      if(event.target.closest('input,textarea,select,.insight-chart-scroll,.filters'))return;
      const t=event.touches[0];if(!t)return;startX=t.clientX;startY=t.clientY;
    },{passive:true});
    document.addEventListener('touchend',event=>{
      if(startX==null||startY==null)return;
      const t=event.changedTouches[0];
      const dx=t.clientX-startX,dy=t.clientY-startY;startX=startY=null;
      if(Math.abs(dx)<85||Math.abs(dx)<Math.abs(dy)*1.35)return;
      const current=currentView(),index=ORDER.indexOf(current);
      if(dx<0&&index<ORDER.length-1)nav(ORDER[index+1]);
      if(dx>0&&index>0)nav(ORDER[index-1]);
    },{passive:true});
  }
  installMenu();installBottomNav();installSwipe();
  const main=q('main');
  if(main)new MutationObserver(syncBottomNav).observe(main,{subtree:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncBottomNav()});
  setTimeout(()=>{installMenu();installBottomNav();syncBottomNav()},0);
})();
