(() => {
  const SESSION_KEY = 'reco.sessions.v1';
  const RESOURCE_KEY = 'reco.resources.v1';
  const DAY_START = 4;
  const subjects = ['数学','英語','物理','化学','国語','地理','その他'];
  const labels = {数学:'Mathematics',英語:'English',物理:'Physics',化学:'Chemistry',国語:'Japanese',地理:'Geography',その他:'Other'};
  const q = (s, root=document) => root.querySelector(s);
  const qa = (s, root=document) => Array.from(root.querySelectorAll(s));
  const pad = n => String(n).padStart(2,'0');
  let signature = '';
  let revealTimer;

  function read(key, fallback){
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  function all(){ return read(SESSION_KEY, []); }
  function active(){ return all().find(item => !item.endedAt) || null; }
  function anchor(){
    const d = new Date();
    if (d.getHours() < DAY_START) d.setDate(d.getDate()-1);
    d.setHours(DAY_START,0,0,0);
    return d;
  }
  function today(){
    const start = anchor();
    const end = new Date(start.getTime()+86400000);
    return all().filter(item => {
      const t = new Date(item.startedAt);
      return t >= start && t < end;
    }).sort((a,b) => new Date(a.startedAt)-new Date(b.startedAt));
  }
  function minutes(item){
    const end = item.endedAt ? new Date(item.endedAt) : new Date();
    return Math.max(0, Math.round((end-new Date(item.startedAt))/60000));
  }
  function clock(value){ return `${pad(Math.floor(value/60))}:${pad(value%60)}`; }
  function hhmm(value){ const d=new Date(value); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function label(value){ return labels[value] || value || 'Study'; }

  function el(tag, className, text){
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function getSurface(){
    const home = q('#view-home');
    if (!home) return null;
    let surface = q('#radicalSurface');
    if (!surface){
      surface = el('div','radical-surface');
      surface.id = 'radicalSurface';
      home.prepend(surface);
    }
    return surface;
  }

  function originalByData(selector, key, value){
    return qa(selector).find(node => node.dataset[key] === value);
  }

  function openDetail(id){ originalByData('#view-home [data-open]','open',id)?.click(); }
  function finish(id){ originalByData('#view-home [data-finish]','finish',id)?.click(); }

  function lastResource(subject){
    const recent = all().filter(item => item.subject === subject && item.resource)
      .sort((a,b) => new Date(b.startedAt)-new Date(a.startedAt))[0];
    if (recent) return recent.resource;
    return read(RESOURCE_KEY,{})?.[subject]?.[0] || '';
  }

  function startSubject(subject){
    closePicker();
    q('#fab')?.click();
    requestAnimationFrame(() => {
      const chip = qa('#view-start .subject-chip').find(node => node.dataset.subject === subject);
      chip?.click();
      const resource = q('#view-start #resource');
      if (resource) resource.value = lastResource(subject);
      q('#view-start #startForm')?.requestSubmit();
    });
  }

  function closePicker(){ q('#radicalPicker')?.remove(); }
  function openPicker(){
    closePicker();
    const overlay = el('div','radical-overlay');
    overlay.id = 'radicalPicker';
    const picker = el('div','radical-picker');
    const close = el('button','radical-close','×');
    close.type='button';
    close.onclick=closePicker;
    const list=el('div','radical-picker-list');
    subjects.forEach(subject => {
      const button=el('button','',label(subject));
      button.type='button';
      button.onclick=()=>startSubject(subject);
      list.appendChild(button);
    });
    picker.append(close,list);
    overlay.appendChild(picker);
    overlay.addEventListener('click',event=>{ if(event.target===overlay) closePicker(); });
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('open'));
  }

  function renderIdle(surface, items){
    surface.replaceChildren();
    surface.className='radical-surface is-idle';
    const d=anchor();
    const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const weekdays=['SUN','MON','TUE','WED','THU','FRI','SAT'];
    const date=el('button','radical-date'); date.type='button';
    date.append(el('span','radical-day',pad(d.getDate())));
    const meta=el('span','radical-month');
    meta.append(document.createTextNode(months[d.getMonth()]),document.createElement('br'),document.createTextNode(weekdays[d.getDay()]));
    const total=el('span','radical-total',clock(items.reduce((sum,item)=>sum+(item.endedAt?minutes(item):0),0)));
    total.id='radicalTotal';
    date.append(meta,total);
    date.onclick=()=>{ total.classList.add('show'); clearTimeout(revealTimer); revealTimer=setTimeout(()=>total.classList.remove('show'),1800); };
    surface.appendChild(date);

    const field=el('div','radical-field');
    if (!items.length) field.appendChild(el('div','radical-empty','Nothing yet.'));
    const base=anchor().getTime();
    let previous=13;
    items.forEach(item=>{
      const raw=13+((new Date(item.startedAt).getTime()-base)/86400000)*68;
      const top=Math.min(Math.max(raw,previous),82); previous=top+8.2;
      const button=el('button','radical-event'); button.type='button';
      button.style.setProperty('--event-y',`${top}%`);
      button.append(el('span','radical-event-time',hhmm(item.startedAt)));
      const main=el('span','radical-event-main');
      main.appendChild(el('strong','',label(item.subject)));
      if(item.resource) main.appendChild(el('small','',item.resource));
      button.appendChild(main);
      button.onclick=()=>openDetail(item.id);
      field.appendChild(button);
    });
    surface.appendChild(field);
    const add=el('button','radical-new','＋'); add.type='button'; add.onclick=openPicker;
    surface.appendChild(add);
  }

  function renderActive(surface, item){
    surface.replaceChildren();
    surface.className='radical-surface is-active-session';
    surface.appendChild(el('div','radical-live-dot'));
    const center=el('button','radical-active-center'); center.type='button';
    center.appendChild(el('span','radical-active-subject',label(item.subject)));
    if(item.resource) center.appendChild(el('span','radical-active-resource',item.resource));
    const elapsed=el('span','radical-active-time',clock(minutes(item)));
    center.appendChild(elapsed);
    center.onclick=()=>{ elapsed.textContent=clock(minutes(item)); elapsed.classList.add('show'); clearTimeout(revealTimer); revealTimer=setTimeout(()=>elapsed.classList.remove('show'),2200); };
    surface.appendChild(center);
    const done=el('button','radical-finish-hint','↑ finish'); done.type='button'; done.onclick=()=>finish(item.id);
    surface.appendChild(done);
  }

  function render(){
    const surface=getSurface(); if(!surface) return;
    const current=active(), items=today();
    const next=JSON.stringify([current&&[current.id,current.subject,current.resource,minutes(current)],items.map(x=>[x.id,x.startedAt,x.endedAt,x.subject,x.resource])]);
    if(next===signature)return;
    signature=next;
    current ? renderActive(surface,current) : renderIdle(surface,items);
  }

  document.addEventListener('click',event=>{
    if(event.target.closest('[data-nav],[data-finish],#fab')) setTimeout(()=>{signature='';render();},0);
  },true);
  window.addEventListener('storage',()=>{signature='';render();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){signature='';render();}});
  setInterval(render,1000);
  setTimeout(render,0);
})();
