(() => {
  const SESSION_KEY = 'reco.sessions.v1';
  const LOG_KEY = 'reco.logs.v1';
  const RESOURCE_KEY = 'reco.resources.v1';
  const DAY_START = 4;
  const subjects = ['数学','英語','物理','化学','国語','地理','その他'];
  const labels = {数学:'Mathematics',英語:'English',物理:'Physics',化学:'Chemistry',国語:'Japanese',地理:'Geography',その他:'Other'};
  const q = (s, root=document) => root.querySelector(s);
  const qa = (s, root=document) => Array.from(root.querySelectorAll(s));
  const pad = n => String(n).padStart(2,'0');
  let signature = '';

  function read(key, fallback){
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  function all(){ return read(SESSION_KEY, []); }
  function active(){ return all().find(item => !item.endedAt) || null; }
  function dayKey(value){
    const d = new Date(value);
    d.setHours(d.getHours()-DAY_START);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function dayLabel(key){
    const d = new Date(`${key}T12:00:00`);
    return `${d.getMonth()+1}月${d.getDate()}日（${'日月火水木金土'[d.getDay()]}）`;
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

  function openDetail(id){
    document.dispatchEvent(new CustomEvent('reco:open-session',{detail:{id}}));
  }
  function finish(id){
    const button=originalByData('#view-home [data-finish]','finish',id);
    if(button)button.click();
    else{openDetail(id);q('#view-detail [data-finish]')?.click();}
  }

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
      // Keep the start form open so the material can be reviewed or changed first.
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

  function closeCreate(){ q('#radicalCreate')?.remove(); }
  function openCreate(){
    closeCreate();
    const overlay=el('div','radical-overlay');
    overlay.id='radicalCreate';
    const panel=el('div','radical-picker radical-create-picker');
    const close=el('button','radical-close','×');close.type='button';close.onclick=closeCreate;
    const list=el('div','radical-picker-list radical-create-list');
    const start=el('button','', 'Start session');start.type='button';
    start.onclick=()=>{closeCreate();openPicker();};
    const log=el('button','', 'Record activity');log.type='button';
    log.onclick=()=>{closeCreate();q('#logFab')?.click();};
    list.append(start,log);panel.append(close,list);overlay.appendChild(panel);
    overlay.addEventListener('click',event=>{if(event.target===overlay)closeCreate();});
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('open'));
  }

  function renderIdle(surface, items, logs, current){
    surface.replaceChildren();
    surface.className='radical-surface reco-timeline';
    const heading=el('div','reco-timeline-heading');
    heading.append(el('span','reco-timeline-kicker','STUDY TIMELINE'),el('h1','', '学習の記録'));
    surface.appendChild(heading);
    if(current) renderActive(surface,current);
    window.RecoPlan?.renderHomeTeaser(surface);

    const groups=new Map();
    items.forEach(item=>{
      if(!item?.startedAt || Number.isNaN(new Date(item.startedAt).getTime()))return;
      const key=dayKey(item.startedAt);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push({type:'session',at:item.startedAt,item});
    });
    logs.forEach(item=>{
      if(!item?.recordedAt || Number.isNaN(new Date(item.recordedAt).getTime()))return;
      const key=dayKey(item.recordedAt);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push({type:'log',at:item.recordedAt,item});
    });
    const todayKey=dayKey(new Date());
    if(!groups.has(todayKey))groups.set(todayKey,[]);
    const keys=[...groups.keys()].filter(key=>key<=todayKey).sort().reverse().slice(0,7);
    keys.forEach(key=>{
      const entries=groups.get(key).sort((a,b)=>new Date(a.at)-new Date(b.at));
      const total=entries.reduce((sum,entry)=>sum+(entry.type==='session'&&entry.item.endedAt?minutes(entry.item):0),0);
      const section=el('section','reco-timeline-day');
      const header=el('div','reco-timeline-day-head');
      const name=el('h2','',key===todayKey?'今日':dayLabel(key));
      const sub=el('span','',key===todayKey?dayLabel(key):'');
      const title=el('div','reco-timeline-date');title.append(name,sub);
      header.append(title,el('span','reco-timeline-total',`${Math.floor(total/60)}時間${pad(total%60)}分`));
      section.appendChild(header);
      if(!entries.length)section.appendChild(el('p','reco-timeline-empty','今日の記録はまだありません。＋ から始められます。'));
      entries.forEach(({type,item})=>{
        const row=el('div',`reco-timeline-row ${type==='log'?'is-log':''}`);
        const at=el('time','reco-timeline-time',hhmm(type==='log'?item.recordedAt:item.startedAt));
        const marker=el('span','reco-timeline-marker');marker.setAttribute('aria-hidden','true');
        const body=el('div','reco-timeline-body');
        const button=el('button','reco-timeline-entry');button.type='button';
        const top=el('span','reco-timeline-entry-head');
        top.append(el('strong','',item.subject||'その他'),el('span','reco-timeline-length',type==='log'?'内容の記録':item.endedAt?clock(minutes(item)):'計測中'));
        button.appendChild(top);
        if(item.resource)button.appendChild(el('span','reco-timeline-resource',item.resource));
        if(type==='session'){
          button.appendChild(el('span','reco-timeline-range',`${hhmm(item.startedAt)}〜${item.endedAt?hhmm(item.endedAt):'計測中'}`));
          button.onclick=()=>openDetail(item.id);
          const note=item.note?.trim();
          const replies=Array.isArray(item.replies)?item.replies:[];
          if(note||replies.length){
            const details=el('details','reco-timeline-details');
            details.appendChild(el('summary','',`メモ・途中経過 ${replies.length?`（${replies.length}件）`:''}`));
            if(note)details.appendChild(el('p','',note));
            replies.forEach(reply=>{if(reply.content)details.appendChild(el('p','',reply.content));});
            body.append(button,details);
          }else body.appendChild(button);
        }else{
          button.dataset.logOpen=item.id;
          button.appendChild(el('span','reco-timeline-content',item.content||''));
          body.appendChild(button);
          if(item.note){const details=el('details','reco-timeline-details');details.append(el('summary','','メモを見る'),el('p','',item.note));body.appendChild(details);}
        }
        row.append(at,marker,body);section.appendChild(row);
      });
      surface.appendChild(section);
    });
    if(groups.size>keys.length){
      const more=el('button','reco-timeline-more','さらに過去の記録を検索 →');
      more.type='button';more.onclick=()=>q('.nav-item[data-nav="search"]')?.click();surface.appendChild(more);
    }
    const add=el('button','radical-new','＋');add.type='button';add.setAttribute('aria-label','学習を記録');add.onclick=openCreate;
    surface.appendChild(add);
  }

  function renderActive(surface, item){
    const panel=el('section','reco-timeline-active');
    const center=el('button','reco-timeline-active-main');center.type='button';center.onclick=()=>openDetail(item.id);
    center.appendChild(el('span','reco-timeline-live','● 勉強中'));
    center.appendChild(el('strong','',item.subject||'その他'));
    if(item.resource)center.appendChild(el('span','',item.resource));
    const elapsed=el('span','radical-active-time',clock(minutes(item)));
    center.appendChild(elapsed);
    panel.appendChild(center);
    const update=el('form','radical-update-panel');
    update.setAttribute('aria-label','勉強の進捗を記録');
    const labelEl=el('label','radical-update-label','途中経過・終わった内容');
    labelEl.htmlFor='radicalUpdateInput';
    const input=el('textarea','input radical-update-input');
    input.id='radicalUpdateInput'; input.rows=2;
    input.placeholder='例：名問の森 〇番まで完了。残りは〜';
    input.setAttribute('aria-label','途中経過・終わった内容');
    const submit=el('button','btn btn-primary radical-update-submit','記録に追加');
    submit.type='submit';
    const status=el('div','radical-update-status');
    status.id='radicalUpdateStatus'; status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    update.append(labelEl,input,submit,status);
    update.onclick=event=>event.stopPropagation();
    update.onsubmit=event=>{
      event.preventDefault(); event.stopPropagation();
      const content=input.value.trim();
      if(!content){input.focus();return;}
      const sessions=all();
      const session=sessions.find(entry=>entry.id===item.id&&!entry.endedAt);
      if(!session){status.textContent='進行中の記録が見つかりません。';return;}
      session.replies=Array.isArray(session.replies)?session.replies:[];
      session.replies.push({id:globalThis.crypto?.randomUUID?.()||String(Date.now()),content,createdAt:new Date().toISOString()});
      localStorage.setItem(SESSION_KEY,JSON.stringify(sessions));
      window.dispatchEvent(new CustomEvent('reco:sessions-updated'));
      input.value='';
      status.textContent=`追加しました（返信 ${session.replies.length} 件）`;
      input.focus();
    };
    panel.appendChild(update);
    const done=el('button','reco-timeline-finish','勉強を終了');done.type='button';done.onclick=()=>finish(item.id);
    panel.appendChild(done);
    surface.appendChild(panel);
  }

  function render(){
    const surface=getSurface(); if(!surface) return;
    const items=all(),current=items.find(item=>!item.endedAt)||null,logs=read(LOG_KEY,[]);
    const next=JSON.stringify([dayKey(new Date()),items.map(x=>[x.id,x.startedAt,x.endedAt,x.subject,x.resource,x.note,x.replies]),logs]);
    if(next===signature && surface.childElementCount){
      const elapsed=q('#radicalSurface .radical-active-time');
      if(current&&elapsed)elapsed.textContent=clock(minutes(current));
      return;
    }
    signature=next;
    renderIdle(surface,items,logs,current);
  }

  document.addEventListener('reco:view-changed',()=>{signature='';render();});
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-finish],#fab')) setTimeout(()=>{signature='';render();},0);
  },true);
  window.addEventListener('storage',()=>{signature='';render();});
  window.addEventListener('reco:logs-updated',()=>{signature='';render();});
  window.addEventListener('reco:sessions-updated',()=>{signature='';render();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){signature='';render();}});
  setInterval(render,1000);
  setTimeout(render,0);
})();
