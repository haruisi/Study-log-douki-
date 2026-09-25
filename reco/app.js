(() => {
  const STORAGE_KEY = 'reco.sessions.v1';
  const RESOURCE_KEY = 'reco.resources.v1';
  const SUBJECTS = ['数学','英語','物理','化学','国語','地理','その他'];
  const STUDY_DAY_START_HOUR = 4;

  let sessions = load(STORAGE_KEY, []);
  let resources = load(RESOURCE_KEY, {});
  let currentView = 'home';
  let detailId = null;
  let searchSubject = 'All';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const pad = n => String(n).padStart(2,'0');
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function load(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
  function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); localStorage.setItem(RESOURCE_KEY, JSON.stringify(resources)); }
  function nowLocal(){ const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function parseLocal(s){ return new Date(s); }
  function studyDayDate(value=new Date()){
    const d=value instanceof Date ? new Date(value) : parseLocal(value);
    d.setHours(d.getHours()-STUDY_DAY_START_HOUR);
    return d;
  }
  function studyDayYMD(value=new Date()){
    const d=studyDayDate(value);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }
  function currentStudyDayYMD(){ return studyDayYMD(new Date()); }
  function sameStudyDay(iso, ymd){ return studyDayYMD(iso)===ymd; }
  function fmtTime(s){ if(!s) return ''; const d=parseLocal(s); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function fmtDate(s){ const d=parseLocal(s); return `${d.getMonth()+1}/${d.getDate()}`; }
  function minsBetween(a,b){ return Math.max(0, Math.round((parseLocal(b)-parseLocal(a))/60000)); }
  function durationText(mins){ const h=Math.floor(mins/60), m=mins%60; return h ? `${h}h ${m}m` : `${m}m`; }
  function sessionMinutes(s){ return s.endedAt ? minsBetween(s.startedAt,s.endedAt) : minsBetween(s.startedAt,new Date().toISOString()); }
  function activeSession(){ return sessions.find(s => !s.endedAt); }
  function toInputValue(iso){ const d=parseLocal(iso); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function fromInput(v){ return new Date(v).toISOString(); }

  function toast(msg){ const el=$('#toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),1600); }
  function navigate(view){ currentView=view; $$('.view').forEach(v=>v.classList.remove('active')); $(`#view-${view}`).classList.add('active'); $$('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.nav===view)); $('#fab').style.display = view==='home' ? 'block' : 'none'; render(); window.scrollTo({top:0, behavior:'instant'}); }

  function render(){
    renderHome(); renderStart(); renderDetail(); renderSearch(); renderStats();
  }

  function renderHome(){
    const el=$('#view-home');
    const active=activeSession();
    const today=sessions.filter(s=>sameStudyDay(s.startedAt,currentStudyDayYMD())).sort((a,b)=>parseLocal(b.startedAt)-parseLocal(a.startedAt));
    const todayMins=today.reduce((sum,s)=>sum+(s.endedAt?sessionMinutes(s):0),0);
    el.innerHTML=`
      ${active ? `
      <div class="eyebrow">NOW</div>
      <div class="card now-card" data-open="${active.id}">
        <div class="row between">
          <div class="grow">
            <div class="time">${fmtTime(active.startedAt)}〜</div>
            <h2 class="title" style="margin-top:8px">${esc(active.subject)}</h2>
            <div class="resource">${esc(active.resource||'教材なし')}</div>
            <div class="duration" data-live-duration="${active.id}">現在 ${durationText(sessionMinutes(active))}</div>
          </div>
          <button class="btn btn-primary" data-finish="${active.id}">終了</button>
        </div>
      </div>` : `
      <div class="card empty">
        <strong>まだ勉強中のセッションはありません</strong><br><br>
        ＋ から開始できます。
      </div>`}
      <div class="section-head"><h2>TODAY</h2><span>${durationText(todayMins)}</span></div>
      <div class="session-list">
        ${today.length ? today.map(sessionCard).join('') : '<div class="empty">今日の記録はまだありません。</div>'}
      </div>`;
    bindSessionCards(el);
    $$('[data-finish]',el).forEach(b=>b.onclick=e=>{ e.stopPropagation(); finishModal(b.dataset.finish); });
  }

  function sessionCard(s){
    const mins=s.endedAt?sessionMinutes(s):sessionMinutes(s);
    return `<article class="card session-card" data-open="${s.id}">
      <div class="row between">
        <div class="grow">
          <div class="row" style="gap:8px"><span class="subject-badge">${esc(s.subject)}</span><span class="time">${fmtTime(s.startedAt)}〜${s.endedAt?fmtTime(s.endedAt):''}</span></div>
          <div class="resource">${esc(s.resource||'教材なし')}</div>
          <div class="duration">${s.endedAt?durationText(mins):'進行中'}</div>
        </div>
        <span class="reply-count">💬 ${(s.replies||[]).length}</span>
      </div>
    </article>`;
  }

  function renderStart(){
    const el=$('#view-start');
    const last=sessions.slice().sort((a,b)=>parseLocal(b.startedAt)-parseLocal(a.startedAt))[0];
    el.innerHTML=`
      <button class="back" data-nav="home">← Home</button>
      <h1 class="page-title">勉強を開始</h1>
      ${last?`<button id="repeatLast" class="card btn-block" style="text-align:left;margin-bottom:12px;border:1px solid var(--line)">
        <div class="eyebrow" style="margin:0 0 6px">前回</div>
        <b>${esc(last.subject)} / ${esc(last.resource||'教材なし')}</b><div class="resource">同じ内容で開始</div>
      </button>`:''}
      <form id="startForm" class="card form-card">
        <div class="field"><label>開始時刻</label><input id="startAt" class="input" type="datetime-local" value="${nowLocal()}" required></div>
        <div class="field"><label>科目</label><div class="subject-grid">${SUBJECTS.map((s,i)=>`<button type="button" class="subject-chip ${i===0?'selected':''}" data-subject="${s}">${s}</button>`).join('')}</div></div>
        <div class="field"><label>教材</label><input id="resource" class="input" list="resourceList" placeholder="例：東大過去問"><datalist id="resourceList"></datalist><div id="resourceQuick" class="quick-row"></div></div>
        <div class="field"><label>メモ（任意）</label><textarea id="note" class="input" placeholder="問題番号や今日やること"></textarea></div>
        <button class="btn btn-primary btn-block" type="submit">勉強開始</button>
      </form>`;
    let selected='数学';
    const updateResources=()=>{
      const list=resources[selected]||[];
      $('#resourceList',el).innerHTML=list.map(r=>`<option value="${esc(r)}"></option>`).join('');
      $('#resourceQuick',el).innerHTML=list.slice(0,4).map(r=>`<button type="button" class="quick" data-resource="${esc(r)}">${esc(r)}</button>`).join('');
      $$('[data-resource]',el).forEach(b=>b.onclick=()=>$('#resource',el).value=b.dataset.resource);
    };
    $$('.subject-chip',el).forEach(b=>b.onclick=()=>{ selected=b.dataset.subject; $$('.subject-chip',el).forEach(x=>x.classList.toggle('selected',x===b)); updateResources(); });
    updateResources();
    if(last) $('#repeatLast',el).onclick=()=>startSession({ subject:last.subject, resource:last.resource||'', note:'', startedAt:new Date().toISOString() });
    $('#startForm',el).onsubmit=e=>{ e.preventDefault(); startSession({subject:selected,resource:$('#resource',el).value.trim(),note:$('#note',el).value.trim(),startedAt:fromInput($('#startAt',el).value)}); };
  }

  function startSession(data){
    const active=activeSession();
    if(active){ conflictModal(active,data); return; }
    createSession(data);
  }
  function createSession(data){
    const s={id:uid(),startedAt:data.startedAt,endedAt:null,subject:data.subject,resource:data.resource,note:data.note,replies:[],createdAt:new Date().toISOString()};
    sessions.push(s);
    if(s.resource){ resources[s.subject]=resources[s.subject]||[]; resources[s.subject]=[s.resource,...resources[s.subject].filter(x=>x!==s.resource)].slice(0,20); }
    save(); detailId=s.id; toast('開始しました'); navigate('home');
  }

  function conflictModal(active,pending){
    modal(`<h3>進行中の勉強があります</h3><p><b>${esc(active.subject)} / ${esc(active.resource||'教材なし')}</b><br>${fmtTime(active.startedAt)}〜</p><div class="modal-actions"><button id="finishAndStart" class="btn btn-primary">現在時刻で終了して新しく開始</button><button id="cancelModal" class="btn btn-secondary">戻る</button></div>`);
    $('#finishAndStart').onclick=()=>{ active.endedAt=new Date().toISOString(); save(); closeModal(); createSession(pending); };
    $('#cancelModal').onclick=closeModal;
  }

  function renderDetail(){
    const el=$('#view-detail');
    const s=sessions.find(x=>x.id===detailId);
    if(!s){ el.innerHTML=''; return; }
    el.innerHTML=`
      <button class="back" data-nav="home">← Home</button>
      <div class="detail-head"><h1 class="page-title" style="margin-bottom:6px">${esc(s.subject)}</h1><div class="resource">${esc(s.resource||'教材なし')}</div><div class="detail-meta"><span class="subject-badge">${fmtDate(s.startedAt)}</span><span class="subject-badge">${fmtTime(s.startedAt)}〜${s.endedAt?fmtTime(s.endedAt):''}</span><span class="subject-badge">${s.endedAt?durationText(sessionMinutes(s)):'進行中'}</span></div><button id="editSession" class="btn btn-secondary" style="margin-top:12px">編集</button></div>
      ${!s.endedAt?`<div class="card now-card"><div class="row between"><div><div class="eyebrow" style="color:#b5bbc8;margin:0 0 5px">NOW</div><b data-live-duration="${s.id}">現在 ${durationText(sessionMinutes(s))}</b></div><button class="btn btn-primary" data-finish="${s.id}">終了</button></div></div>`:''}
      ${s.note?`<div class="section-head"><h2>メモ</h2></div><div class="card note-box">${esc(s.note)}</div>`:''}
      <div class="section-head"><h2>Replies</h2><span>${(s.replies||[]).length}</span></div>
      <div class="reply-list">${(s.replies||[]).length?(s.replies||[]).map(r=>`<div class="reply"><time>${fmtDate(r.createdAt)} ${fmtTime(r.createdAt)}</time><p>${esc(r.content)}</p></div>`).join(''):'<div class="empty">まだ返信はありません。</div>'}</div>
      <form id="replyForm" class="reply-form"><input id="replyInput" class="input" placeholder="途中経過・ミス・気づき…" autocomplete="off"><button class="btn btn-primary">送信</button></form>
      <div class="danger-zone"><button id="deleteSession" class="btn btn-danger btn-block">この記録を削除</button></div>`;
    bindNav(el);
    const fb=$('[data-finish]',el); if(fb) fb.onclick=()=>finishModal(s.id);
    $('#editSession',el).onclick=()=>editSessionModal(s);
    $('#replyForm',el).onsubmit=e=>{ e.preventDefault(); const input=$('#replyInput',el); const content=input.value.trim(); if(!content)return; s.replies=s.replies||[]; s.replies.push({id:uid(),content,createdAt:new Date().toISOString()}); save(); input.value=''; renderDetail(); toast('返信を追加しました'); };
    $('#deleteSession',el).onclick=()=>deleteModal(s);
  }

  function editSessionModal(s){
    modal(`<h3>記録を編集</h3>
      <div class="field"><label>開始時刻</label><input id="editStart" class="input" type="datetime-local" value="${toInputValue(s.startedAt)}"></div>
      <div class="field" style="margin-top:12px"><label>終了時刻（勉強中なら空欄）</label><input id="editEnd" class="input" type="datetime-local" value="${s.endedAt?toInputValue(s.endedAt):''}"></div>
      <div class="field" style="margin-top:12px"><label>科目</label><select id="editSubject" class="input">${SUBJECTS.map(x=>`<option ${x===s.subject?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field" style="margin-top:12px"><label>教材</label><input id="editResource" class="input" value="${esc(s.resource||'')}"></div>
      <div class="field" style="margin-top:12px"><label>メモ</label><textarea id="editNote" class="input">${esc(s.note||'')}</textarea></div>
      <div class="modal-actions"><button id="saveEdit" class="btn btn-primary">保存</button><button id="cancelModal" class="btn btn-secondary">キャンセル</button></div>`);
    $('#saveEdit').onclick=()=>{
      const startVal=$('#editStart').value, endVal=$('#editEnd').value;
      if(!startVal){ toast('開始時刻を入力してください'); return; }
      const startedAt=fromInput(startVal), endedAt=endVal?fromInput(endVal):null;
      if(endedAt && parseLocal(endedAt)<parseLocal(startedAt)){ toast('終了時刻が開始時刻より前です'); return; }
      if(!endedAt){
        const otherActive=sessions.find(x=>x.id!==s.id&&!x.endedAt);
        if(otherActive){ toast('別の進行中セッションがあります'); return; }
      }
      s.startedAt=startedAt; s.endedAt=endedAt; s.subject=$('#editSubject').value; s.resource=$('#editResource').value.trim(); s.note=$('#editNote').value.trim();
      if(s.resource){ resources[s.subject]=resources[s.subject]||[]; resources[s.subject]=[s.resource,...resources[s.subject].filter(x=>x!==s.resource)].slice(0,20); }
      save(); closeModal(); render(); toast('更新しました');
    };
    $('#cancelModal').onclick=closeModal;
  }

  function finishModal(id){
    const s=sessions.find(x=>x.id===id); if(!s||s.endedAt)return;
    modal(`<h3>勉強を終了</h3><p>${esc(s.subject)} / ${esc(s.resource||'教材なし')}</p><div class="field"><label>終了時刻</label><input id="finishAtInput" class="input" type="datetime-local" value="${nowLocal()}"></div><div class="modal-actions"><button id="finishNow" class="btn btn-primary">完了</button><button id="cancelModal" class="btn btn-secondary">キャンセル</button></div>`);
    $('#finishNow').onclick=()=>{ const v=$('#finishAtInput').value; if(!v)return; const end=fromInput(v); if(parseLocal(end)<parseLocal(s.startedAt)){ toast('終了時刻が開始時刻より前です'); return; } s.endedAt=end; save(); closeModal(); render(); toast(`終了しました・${durationText(sessionMinutes(s))}`); };
    $('#cancelModal').onclick=closeModal;
  }

  function deleteModal(s){
    modal(`<h3>この記録を削除しますか？</h3><p>${esc(s.subject)} / ${esc(s.resource||'教材なし')}<br>返信も一緒に削除されます。</p><div class="modal-actions"><button id="confirmDelete" class="btn btn-danger">削除</button><button id="cancelModal" class="btn btn-secondary">キャンセル</button></div>`);
    $('#confirmDelete').onclick=()=>{ sessions=sessions.filter(x=>x.id!==s.id); save(); closeModal(); detailId=null; navigate('home'); toast('削除しました'); };
    $('#cancelModal').onclick=closeModal;
  }

  function renderSearch(){
    const el=$('#view-search');
    el.innerHTML=`<h1 class="page-title">Search</h1><div class="searchbar"><input id="searchInput" class="input" placeholder="教材・メモ・返信を検索"><div class="filters"><button class="filter-chip ${searchSubject==='All'?'active':''}" data-filter="All">All</button>${SUBJECTS.map(s=>`<button class="filter-chip ${searchSubject===s?'active':''}" data-filter="${s}">${s}</button>`).join('')}</div></div><div id="searchResults" class="session-list"></div>`;
    const run=()=>{
      const q=$('#searchInput',el).value.trim().toLowerCase();
      const arr=sessions.filter(s=>{
        if(searchSubject!=='All'&&s.subject!==searchSubject)return false;
        const hay=[s.subject,s.resource,s.note,...(s.replies||[]).map(r=>r.content)].join('\n').toLowerCase();
        return !q||hay.includes(q);
      }).sort((a,b)=>parseLocal(b.startedAt)-parseLocal(a.startedAt));
      $('#searchResults',el).innerHTML=arr.length?arr.map(sessionCard).join(''):'<div class="empty">見つかりませんでした。</div>';
      bindSessionCards($('#searchResults',el));
    };
    $('#searchInput',el).oninput=run;
    $$('[data-filter]',el).forEach(b=>b.onclick=()=>{ searchSubject=b.dataset.filter; renderSearch(); });
    run();
  }

  function renderStats(){
    const el=$('#view-stats');
    const completed=sessions.filter(s=>s.endedAt);
    const currentDay=currentStudyDayYMD();
    const today=completed.filter(s=>sameStudyDay(s.startedAt,currentDay));
    const shiftedNow=studyDayDate(new Date());
    const startWeek=new Date(shiftedNow);
    const day=(shiftedNow.getDay()+6)%7;
    startWeek.setDate(shiftedNow.getDate()-day);
    startWeek.setHours(STUDY_DAY_START_HOUR,0,0,0);
    const week=completed.filter(s=>parseLocal(s.startedAt)>=startWeek);
    const total=a=>a.reduce((x,s)=>x+sessionMinutes(s),0);
    const bySubject={}; completed.forEach(s=>bySubject[s.subject]=(bySubject[s.subject]||0)+sessionMinutes(s));
    const max=Math.max(1,...Object.values(bySubject));
    const byResource={}; completed.forEach(s=>{ if(s.resource) byResource[s.resource]=(byResource[s.resource]||0)+sessionMinutes(s); });
    const topResources=Object.entries(byResource).sort((a,b)=>b[1]-a[1]).slice(0,8);
    el.innerHTML=`
      <h1 class="page-title">Stats</h1>
      <div class="stat-hero"><div class="stat-box"><span>Today</span><b>${durationText(total(today))}</b></div><div class="stat-box"><span>This week</span><b>${durationText(total(week))}</b></div></div>
      <div class="section-head"><h2>科目別</h2><span>All time</span></div>
      <div class="card">${Object.keys(bySubject).length?SUBJECTS.filter(s=>bySubject[s]).map(s=>`<div class="bar-row"><b>${s}</b><div class="bar-track"><div class="bar" style="width:${Math.max(2,bySubject[s]/max*100)}%"></div></div><span>${durationText(bySubject[s])}</span></div>`).join(''):'<div class="empty">終了した記録がまだありません。</div>'}</div>
      <div class="section-head"><h2>教材別</h2><span>Top ${topResources.length}</span></div>
      <div class="card">${topResources.length?topResources.map(([r,m])=>`<div class="row between" style="padding:9px 0"><span class="grow">${esc(r)}</span><b>${durationText(m)}</b></div>`).join(''):'<div class="empty">教材データがまだありません。</div>'}</div>`;
  }

  function bindSessionCards(root=document){ $$('[data-open]',root).forEach(c=>c.onclick=()=>{ detailId=c.dataset.open; navigate('detail'); }); }
  function bindNav(root=document){ $$('[data-nav]',root).forEach(b=>b.onclick=()=>navigate(b.dataset.nav)); }
  function modal(html){ $('#modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal">${html}</div></div>`; $('.modal-backdrop').onclick=e=>{ if(e.target.classList.contains('modal-backdrop'))closeModal(); }; }
  function closeModal(){ $('#modalRoot').innerHTML=''; }

  $('#fab').onclick=()=>navigate('start');
  bindNav();
  $('#exportBtn').onclick=()=>{
    const payload={version:1,exportedAt:new Date().toISOString(),sessions};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`reco-${currentStudyDayYMD()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); toast('JSONを書き出しました');
  };
  let renderedStudyDay=currentStudyDayYMD();
  setInterval(()=>{
    $$('[data-live-duration]').forEach(el=>{ const s=sessions.find(x=>x.id===el.dataset.liveDuration); if(s&&!s.endedAt)el.textContent=`現在 ${durationText(sessionMinutes(s))}`; });
    const currentDay=currentStudyDayYMD();
    if(currentDay!==renderedStudyDay){
      renderedStudyDay=currentDay;
      render();
    }
  },30000);
  render();
})();
