(() => {
  const KEY = 'reco.plan.progress.2026-autumn.v1';
  const subjects = ['数学','物理','化学','英語','国語'];
  const task = (id, subject, title, detail, kind='exercise', target=1) => ({id,subject,title,detail,kind,target});
  const weeks = [
    {id:'0928',start:'2026-09-28',end:'2026-10-04',label:'9/28 — 10/4',event:'10/4 全統記述模試',tasks:[
      task('m24-6','数学','2024年第6問を再答案','採点・修正し、できれば当日中に白紙から解き直す。既習なので初見得点には数えない。'),
      task('m-next-1','数学','次の未着手大問 1','東大過去問または同等の塾課題。年度・大問・所要時間・詰まった箇所を残す。'),
      task('m-next-2','数学','次の未着手大問 2','採点・修正・白紙からの解き直しまで。塾課題と二重には数えない。'),
      task('p15','物理','名問の森 電磁気15','未完了分を解き、小問別の○△×と修正答案を残す。'),
      task('p18','物理','名問の森 重要18','既習なら次の未着手重要問題へ。小問別に修正する。'),
      task('p-old','物理','2019年以前の力学・波動 1大問','未着手の東大過去問。時間・得点相当・詰まった誘導・修正答案を残す。'),
      task('c265','化学','新演習265の状態を確認','未完なら先に終える。', 'check'),
      task('c266','化学','新演習 脂肪族266','誤答した小問を解説なしで再現する。'),
      task('c267','化学','新演習 脂肪族267','誤答した小問を解説なしで再現する。'),
      task('c-inorg','化学','無機を短時間で反復','できれば毎日5〜10分。週の実施回数を記録する。','count',6),
      task('e1b','英語','東大英語1B 1題','時間を測り、選択根拠と誤答理由を確認する。'),
      task('e1a','英語','東大英語1A 1題','段落の主張と論考の流れを整理し、要約を修正する。'),
      task('elistening','英語','通学中のリスニング','手元の音源でよい。Mikanの開始は未確定。','count',3),
      task('j-honorific','国語','古文の敬語を復習','短い本文で主体・方向・主語を説明する。教材名は現物で確認。')
    ]},
    {id:'1005',start:'2026-10-05',end:'2026-10-11',label:'10/5 — 10/11',event:'10/4模試の復習',tasks:[
      task('math','数学','未着手大問 3題','東大過去問・同等の塾課題。10/4の弱かった処理を1題に反映。','count',3),
      task('forest','物理','森 重要19・20・23・25から最大4題','未着手を選び、小問の誤答を修正。','count',4),
      task('old','物理','2019年以前の力学・波動 1大問','時間・得点相当と修正答案を残す。'),
      task('chem','化学','新演習268〜270','脂肪族を進め、余力があれば271。','count',3),
      task('theory','化学','模試で失点した理論 1テーマ','10/4の答案から選び、再演習する。','check'),
      task('inorg','化学','無機を短時間で反復','できれば毎日5〜10分。','count',7),
      task('oneb','英語','1Bを1題','選択根拠と誤答理由を確認。'),
      task('onea','英語','1Aを1題','要約を修正。'),
      task('listen','英語','リスニング','通学中を中心に実施。','count',3),
      task('honorific','国語','敬語を本文に適用','主体・方向と主語を確認。','check')
    ]},
    {id:'1012',start:'2026-10-12',end:'2026-10-18',label:'10/12 — 10/18',event:'10/18 共通テスト模試',tasks:[
      task('math','数学','未着手大問 3題を目標','模試で時間が減ったら、新規より既習答案の解き直しを優先。','count',3),
      task('forest','物理','森 重要26〜28から最大3題','未着手を優先。','count',3),
      task('old','物理','2019年以前の力学・波動 1大問','答案を修正まで。'),
      task('chem','化学','新演習271〜273の残り','脂肪族を全問終えたら芳香族274へ。','count',3),
      task('aromatic','化学','芳香族274に着手','脂肪族の残りがある場合はそちらを先に。','check'),
      task('inorg','化学','無機を反復','できれば短時間ずつ。','count',7),
      task('oneb','英語','1Bを1題','選択根拠と誤答理由を確認。'),
      task('onea','英語','1Aを1題','要約を修正。'),
      task('listen','英語','リスニング','通学中を中心に実施。','count',3),
      task('kobun','国語','古文を1回','本文で敬語と主語を確認。','check')
    ]},
    {id:'1019',start:'2026-10-19',end:'2026-10-25',label:'10/19 — 10/25',event:'10/25 東大入試オープン',tasks:[
      task('math','数学','大問3題を目標','10/24は新しい難問を増やさず、既習答案の方針・部分点を確認。','count',3),
      task('old','物理','2019年以前の力学・波動 1大問','時間・失点原因・修正答案を残す。'),
      task('forest','物理','森29・30など最大2題','模試で電磁誘導が弱ければ36・37と入れ替え。','count',2),
      task('aromatic','化学','芳香族274以降を1〜2題','10/24は脂肪族と無機の誤答を確認。','count',2),
      task('oneb','英語','1Bを1題','選択根拠と誤答理由を確認。'),
      task('onea','英語','1Aを1題','要約を修正。'),
      task('listen','英語','リスニング','通学中を中心に実施。','count',3),
      task('kobun','国語','敬語を確認','本文の主体・方向と主語を確認。','check')
    ]}
  ];
  const goals = [{subject:'国語',score:'30 / 80'},{subject:'数学',score:'35〜40 / 120'},{subject:'英語',score:'45〜50 / 120'},{subject:'物理',score:'35〜40 / 60'},{subject:'化学',score:'25〜30 / 60'}];
  let tab='week', selectedWeek=null, filter='すべて';
  function read(){try{const data=JSON.parse(localStorage.getItem(KEY));return data && typeof data==='object' && !Array.isArray(data)?data:{}}catch{return {}}}
  function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  function currentWeek(){const d=today();return weeks.find(w=>w.start<=d && d<=w.end)|| (d<weeks[0].start?weeks[0]:weeks.at(-1));}
  function level(progress,week,item){return Math.max(0,Math.min(item.kind==='count'?item.target:item.kind==='check'?1:2,Number(progress[week.id+'/'+item.id])||0))}
  function done(progress,w,item){return level(progress,w,item)===(item.kind==='count'?item.target:item.kind==='check'?1:2)}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function openPlan(){document.querySelector('.nav-item[data-nav="plan"]')?.click()}
  function taskRow(w,t,p){
    const n=level(p,w,t),max=t.kind==='count'?t.target:t.kind==='check'?1:2;
    const label=t.kind==='count'?`${n} / ${max}`:t.kind==='check'?(n?'完了':'未完了'):['未着手','解答済み','解き直し済み'][n];
    return `<div class="plan-task ${n===max?'is-done':''}"><div class="plan-task-copy"><strong>${esc(t.title)}</strong><p>${esc(t.detail)}</p></div><button type="button" class="plan-task-action" data-progress="${w.id}/${t.id}" aria-label="${esc(t.title)}：${label}。押すと次の段階へ">${label}<span aria-hidden="true"> ↗</span></button></div>`;
  }
  function subjectCard(w,s,p){
    const items=w.tasks.filter(t=>t.subject===s),finished=items.filter(t=>done(p,w,t)).length;
    return `<details class="plan-subject" ${s==='数学'?'open':''}><summary><span class="plan-subject-name">${s}</span><span class="plan-subject-progress">${finished} / ${items.length}</span><span class="plan-chevron" aria-hidden="true">⌄</span></summary><div class="plan-task-list">${items.map(t=>taskRow(w,t,p)).join('')}</div></details>`;
  }
  function roadmapCard(w,p){
    const finished=w.tasks.filter(t=>done(p,w,t)).length;
    const current=currentWeek().id===w.id;
    const list=filter==='すべて'?subjects:[filter];
    return `<article class="plan-road-week ${current?'is-current':''}"><header><span>${esc(w.label)} ${current?'<i>今週</i>':''}</span><small>${finished} / ${w.tasks.length} 完了</small></header><div class="plan-road-body"><strong>${esc(w.event)}</strong>${list.map(s=>{const ts=w.tasks.filter(t=>t.subject===s);return `<div class="plan-road-subject"><b>${s}</b><span>${ts.map(t=>esc(t.title)).join(' ・ ')}</span></div>`}).join('')}</div><button class="plan-week-link" data-select-week="${w.id}">この週の課題を見る →</button></article>`;
  }
  function render(){
    const root=document.querySelector('#view-plan');if(!root)return;
    const w=weeks.find(x=>x.id===selectedWeek)||currentWeek(),p=read();
    const completed=w.tasks.filter(t=>done(p,w,t)).length;
    root.innerHTML=`<div class="plan-head"><span class="plan-kicker">TOKYO UNIVERSITY · SCIENCE I</span><h1>学習計画</h1><p>10月25日 東大入試オープンまで</p></div>
      <div class="plan-tabs" role="tablist" aria-label="計画の表示"><button role="tab" aria-selected="${tab==='week'}" data-plan-tab="week">週計画</button><button role="tab" aria-selected="${tab==='road'}" data-plan-tab="road">ロードマップ</button></div>
      ${tab==='week'?`<div class="plan-week-heading"><div><span>${w.id===currentWeek().id?'今週':'選択中の週'}</span><h2>${esc(w.label)}</h2></div><strong>${completed}<small> / ${w.tasks.length}</small></strong></div><div class="plan-progress-track"><span style="width:${Math.round(100*completed/w.tasks.length)}%"></span></div><p class="plan-week-event">${esc(w.event)}${w.id==='0928'?' · 10/4は模試を優先':''}</p><div class="plan-week-picker">${weeks.map(x=>`<button class="${x.id===w.id?'active':''}" data-select-week="${x.id}">${esc(x.label.replace(' — ','–'))}</button>`).join('')}</div><div class="plan-subject-list">${subjects.map(s=>subjectCard(w,s,p)).join('')}</div><p class="plan-note">解いた問題は、採点・修正・解き直しまで終えたら完了です。記録はこの端末内に保存されます。</p>`:
      `<section class="plan-goal"><span>10/25 東大入試オープン</span><strong>180〜190 <small>/ 440</small></strong><p>科目別目標の下限合計は170点。複数科目で目標帯の中ほど以上を目指します。</p></section><div class="plan-score-list">${goals.map(g=>`<span>${g.subject}<strong>${g.score}</strong></span>`).join('')}</div><div class="plan-filter">${['すべて',...subjects].map(s=>`<button class="${filter===s?'active':''}" data-plan-filter="${s}">${s}</button>`).join('')}</div><div class="plan-road-list">${weeks.map(x=>roadmapCard(x,p)).join('')}</div><p class="plan-note">模試の結果を見て、新規問題を復習課題と入れ替えます。10/25後に11月以降の計画を更新します。</p>`}`;
    root.querySelectorAll('[data-plan-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.planTab;render()});
    root.querySelectorAll('[data-select-week]').forEach(b=>b.onclick=()=>{selectedWeek=b.dataset.selectWeek;tab='week';render();root.scrollIntoView({block:'start'})});
    root.querySelectorAll('[data-plan-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.planFilter;render()});
    root.querySelectorAll('[data-progress]').forEach(b=>b.onclick=()=>{
      const [wid,id]=b.dataset.progress.split('/'),week=weeks.find(x=>x.id===wid),item=week?.tasks.find(x=>x.id===id);if(!item)return;
      const next=read(),max=item.kind==='count'?item.target:item.kind==='check'?1:2;
      next[wid+'/'+id]=(level(next,week,item)+1)%(max+1);
      try{localStorage.setItem(KEY,JSON.stringify(next))}catch{b.textContent='保存できませんでした';return}
      const open=[...root.querySelectorAll('details[open]')].map(x=>x.querySelector('.plan-subject-name')?.textContent);
      render();root.querySelectorAll('details').forEach(x=>x.open=open.includes(x.querySelector('.plan-subject-name')?.textContent));
    });
  }
  function renderHomeTeaser(surface){
    const w=currentWeek(),p=read(),remain=w.tasks.filter(t=>!done(p,w,t));
    const panel=document.createElement('button');panel.type='button';panel.className='plan-home-teaser';panel.onclick=openPlan;
    const top=document.createElement('span');top.className='plan-home-top';top.textContent='今週の計画　↗';
    const progress=document.createElement('strong');progress.textContent=`${w.tasks.length-remain.length} / ${w.tasks.length} 完了`;
    const next=document.createElement('small');next.textContent=remain.length?`次：${remain[0].subject} · ${remain[0].title}`:'今週の課題はすべて完了';
    panel.append(top,progress,next);
    surface.appendChild(panel);
  }
  window.RecoPlan={render,renderHomeTeaser};
  document.addEventListener('reco:view-changed',({detail})=>{if(detail?.view==='plan')render()});
  setTimeout(render,0);
})();
