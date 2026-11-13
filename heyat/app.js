/* مضیف الزهراء — سامانه تحویل نذری
   Storage: one JSON file (data.json) in a PRIVATE GitHub repo, read/written with the GitHub Contents API.
   Every admin device polls it every 15 s (conditional requests, free) and writes with the file's sha,
   so two admins can never overwrite each other: on a conflict the change is re-applied to the newest data. */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseISO=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parseISO(s);d.setDate(d.getDate()+n);return iso(d)};
const todayISO=()=>iso(new Date());
const fLong=new Intl.DateTimeFormat('fa-IR',{weekday:'long',day:'numeric',month:'long'});
const fFull=new Intl.DateTimeFormat('fa-IR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const fShort=new Intl.DateTimeFormat('fa-IR',{day:'numeric',month:'long'});
const fClock=new Intl.DateTimeFormat('fa-IR',{hour:'2-digit',minute:'2-digit'});
const fStamp=new Intl.DateTimeFormat('fa-IR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const dLong=s=>fLong.format(parseISO(s)), dFull=s=>fFull.format(parseISO(s)), dShort=s=>fShort.format(parseISO(s));
const fa=n=>Number(n||0).toLocaleString('fa-IR');
const faDig=s=>String(s??'').replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
const en=s=>String(s??'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const toInt=s=>{const v=parseInt(en(s).replace(/[^\d-]/g,''),10);return isNaN(v)?0:v};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const ls={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};

/* ================= GitHub storage ================= */
const FILE='data.json';
let CFG=ls.get('mozif-cfg');            // {repo, token, name}
let SHA=null, ETAG=null, lastSync=0, online=true;
const EMPTY=()=>({app:'mozif-alzahra',v:1,days:{},allocs:[],log:[]});
let DATA=ls.get('mozif-cache')||EMPTY();

const b64enc=str=>{const b=new TextEncoder().encode(str);let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(s)};
const b64dec=b64=>new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g,'')),c=>c.charCodeAt(0)));
function api(path,opt={}){
  return fetch('https://api.github.com/repos/'+CFG.repo+path,{...opt,cache:'no-store',headers:{
    'Authorization':'Bearer '+CFG.token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(opt.headers||{})}});
}
async function errText(r){
  if(r.status===401)return 'توکن نامعتبر است یا منقضی شده.';
  if(r.status===403)return 'توکن اجازه نوشتن/خواندن این مخزن را ندارد (یا سقف درخواست پر شده).';
  if(r.status===404)return 'مخزن پیدا نشد. نام مخزن و دسترسی توکن را بررسی کنید.';
  try{const j=await r.json();return j.message||('خطای '+r.status)}catch(e){return 'خطای '+r.status}
}
async function pull(force){
  const r=await api('/contents/'+FILE,{headers:(!force&&ETAG)?{'If-None-Match':ETAG}:{}});
  if(r.status===304)return false;
  if(r.status===404){ // repo exists but file not created yet?
    const rr=await api('');if(!rr.ok)throw new Error(await errText(rr));
    SHA=null;ETAG=null;DATA=EMPTY();return true;
  }
  if(!r.ok)throw new Error(await errText(r));
  ETAG=r.headers.get('ETag');const j=await r.json();SHA=j.sha;
  let text;
  if(j.encoding==='base64'&&j.content)text=b64dec(j.content);
  else{const raw=await api('/contents/'+FILE,{headers:{Accept:'application/vnd.github.raw+json'}});if(!raw.ok)throw new Error(await errText(raw));text=await raw.text()}
  const d=JSON.parse(text);DATA={...EMPTY(),...d};ls.set('mozif-cache',DATA);return true;
}
/* Apply a change safely. mut(draft) edits the draft or throws Error('پیام') to abort. */
let busy=Promise.resolve();
function commit(mut,msg){
  const run=async()=>{
    for(let attempt=0;attempt<5;attempt++){
      await pull(attempt>0);
      const draft=JSON.parse(JSON.stringify(DATA));
      mut(draft);
      draft.log=(draft.log||[]).slice(-800);
      draft.updatedAt=new Date().toISOString();
      const body={message:msg+' — '+(CFG.name||''),content:b64enc(JSON.stringify(draft,null,1))};
      if(SHA)body.sha=SHA;
      const r=await api('/contents/'+FILE,{method:'PUT',body:JSON.stringify(body)});
      if(r.ok){const j=await r.json();SHA=j.content.sha;ETAG=null;DATA=draft;ls.set('mozif-cache',DATA);setSync(true);render();return true}
      if(r.status===409||r.status===422){ETAG=null;await new Promise(f=>setTimeout(f,300+Math.random()*700));continue}
      throw new Error(await errText(r));
    }
    throw new Error('سرور شلوغ است، دوباره بزنید.');
  };
  const p=busy.then(run,run);busy=p.catch(()=>{});return p;
}
function logEntry(d,type,text,allocId){(d.log=d.log||[]).push({at:new Date().toISOString(),type,text,allocId:allocId||'',by:CFG?.name||''})}

/* ================= state ================= */
const S={date:todayISO(),view:'deliver',filter:'all',lookup:'',editingId:null,lastShare:null};
const allocs=()=>DATA.allocs||[];
const active=a=>a.status!=='cancelled';
const forDay=d=>allocs().filter(a=>a.date===d).sort((a,b)=>(a.time||'').localeCompare(b.time||'')||a.heyat.localeCompare(b.heyat,'fa'));
const PACK=4; // portions per kitchen staff member
function dayStats(d){
  const list=forDay(d).filter(active);const day=DATA.days?.[d];const prod=Number(day?.production||0);
  const pack=Number(day?.staffPack||PACK),staff=Number(day?.staff||0),staffQty=staff*pack,packsGiven=Number(day?.packsGiven||0),staffGiven=packsGiven*pack;
  // commitment: a delivered heyat counts with what it actually took (may be less than its share)
  let alloc=0,deliv=0,pend=0,nDone=0,nPend=0;
  list.forEach(a=>{if(a.status==='delivered'){const q=Number(a.deliveredQty??a.qty??0);deliv+=q;alloc+=q;nDone++}else{pend+=Number(a.qty||0);alloc+=Number(a.qty||0);nPend++}});
  return {prod,alloc,deliv,pend,nDone,nPend,n:list.length,staff,staffQty,pack,packsGiven,staffGiven,stock:prod-deliv-staffGiven,free:prod-alloc-staffQty,hasProd:!!day&&day.production!=null};
}
function minutesFromNow(a){const t=parseISO(a.date);const[h,m]=(a.time||'00:00').split(':').map(Number);t.setHours(h,m,0,0);return Math.round((Date.now()-t)/60000)}
function dur(m){const h=Math.floor(m/60),r=m%60;return (h?fa(h)+' ساعت':'')+(h&&r?' و ':'')+(r?fa(r)+' دقیقه':'')}
function timing(a){
  if(a.date!==todayISO())return {cls:'bad',text:'این نوبت مال '+dLong(a.date)+' است، نه امروز'};
  const m=minutesFromNow(a);
  if(m<-60)return {cls:'warn',text:'زودتر از موعد: '+dur(-m)};
  if(m>90)return {cls:'warn',text:'با تأخیر: '+dur(m)};
  return {cls:'ok',text:'در بازه زمانی نوبت'};
}
function usedCodes(exceptId,data){return new Set((data||DATA).allocs.filter(a=>a.status==='pending'&&a.id!==exceptId).map(a=>a.code))}
function newCode(exceptId){const u=usedCodes(exceptId);for(let i=0;i<500;i++){const c=String(1000+Math.floor(Math.random()*9000));if(!u.has(c))return c}return String(Date.now()).slice(-6)}

/* ================= UI utils ================= */
let toastT;
function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,3000)}
function armed(btn,label,fn){
  if(btn.dataset.armed){delete btn.dataset.armed;btn.classList.remove('armed');fn();return}
  const old=btn.textContent;btn.dataset.armed='1';btn.classList.add('armed');btn.textContent=label;
  setTimeout(()=>{if(btn.dataset.armed){delete btn.dataset.armed;btn.classList.remove('armed');btn.textContent=old}},3500);
}
function setSync(ok,msg){
  online=ok;if(ok)lastSync=Date.now();
  const el=$('#sync');
  if(!CFG){el.className='chip warn';el.textContent='وصل نشده';return}
  if(!ok){el.className='chip bad';el.textContent=msg||'قطع ارتباط — اطلاعات ذخیره‌شده نمایش داده می‌شود';return}
  const s=Math.round((Date.now()-lastSync)/1000);
  el.className='chip ok';el.textContent='همگام'+(s>20?' · '+fa(s)+' ثانیه پیش':'');
}
function needCfg(){if(!CFG){toast('اول در تنظیمات، این دستگاه را وصل کنید');setView('settings');return false}return true}
async function act(fn,okMsg){
  if(!needCfg())return false;
  try{await fn();if(okMsg)toast(okMsg);return true}
  catch(e){toast(e.message||'ثبت نشد. اینترنت را بررسی کنید.');if(/fetch|network|Failed/i.test(e.message||''))setSync(false);return false}
}

/* ================= date selects ================= */
function fillDateSelect(sel,center,value){
  const t=todayISO();let h='';
  for(let i=-30;i<=75;i++){const d=addDays(t,i);h+=`<option value="${d}">${esc(dLong(d))}${d===t?' (امروز)':''}</option>`}
  if(value&&(value<addDays(t,-30)||value>addDays(t,75)))h=`<option value="${value}">${esc(dLong(value))}</option>`+h;
  sel.innerHTML=h;sel.value=value||center;
}
function fillDayInputs(){const day=DATA.days?.[S.date];if(document.activeElement!==$('#prodIn'))$('#prodIn').value=day?.production??'';if(document.activeElement!==$('#staffIn'))$('#staffIn').value=day?.staff||''}
function setDate(d){S.date=d;$('#dSel').value=d;fillDayInputs();render()}

/* ================= views ================= */
const VIEWS=['deliver','board','plan','report','settings'];
function setView(v){
  S.view=v;VIEWS.forEach(k=>$('#v-'+k).hidden=k!==v);
  document.querySelectorAll('nav.bottom button').forEach(b=>b.setAttribute('aria-current',b.dataset.v===v?'page':'false'));
  if(location.hash!=='#'+v)try{history.replaceState(null,'','#'+v)}catch(e){}
  if(v==='settings'){$('#cRepo').value=CFG?.repo||'';$('#cToken').value=CFG?.token||'';$('#cName').value=CFG?.name||'';$('#cForget').hidden=!CFG}
  render();if(v==='deliver')setTimeout(()=>$('#codeIn').focus(),50);
}
function render(){
  const st=dayStats(S.date);
  $('#hdrSub').textContent=dFull(S.date)+(S.date===todayISO()?' · امروز':'');
  if(S.view==='deliver')renderDeliver(st);
  if(S.view==='board')renderBoard(st);
  if(S.view==='plan')renderPlan();
  if(S.view==='report')renderReport();
}
function rowHTML(a,withActs){
  const done=a.status==='delivered',cancel=a.status==='cancelled';
  const late=!done&&!cancel&&a.date===todayISO()&&minutesFromNow(a)>30;
  const q=done?Number(a.deliveredQty??a.qty):Number(a.qty);
  const sub=[`<span>ساعت ${faDig(a.time||'—')}</span>`,`<span>کد ${faDig(a.code)}</span>`];
  if(a.rep)sub.push(`<span>${esc(a.rep)}</span>`);
  if(done)sub.push(`<span class="chip ok">تحویل ${esc(fClock.format(new Date(a.deliveredAt)))}${a.deliveredBy?' · '+esc(a.deliveredBy):''}</span>`);
  if(done&&Number(a.deliveredQty)!==Number(a.qty))sub.push(`<span class="chip warn">کمتر از سهم: ${fa(a.qty)}</span>`);
  if(late)sub.push(`<span class="chip bad">دیر کرده</span>`);
  if(cancel)sub.push(`<span class="chip mute">لغو شده</span>`);
  if(a.note)sub.push(`<span>${esc(a.note)}</span>`);
  let acts='';
  if(withActs){
    if(a.status==='pending')acts+=`<button class="btn sm primary" data-act="quick" data-id="${a.id}">تحویل ${fa(a.qty)} پرس</button><button class="btn sm" data-act="edit" data-id="${a.id}">ویرایش</button><button class="btn sm danger" data-act="cancel" data-id="${a.id}">لغو نوبت</button>`;
    if(done)acts+=`<button class="btn sm danger" data-act="undo" data-id="${a.id}">برگرداندن تحویل</button>`;
    if(cancel)acts+=`<button class="btn sm" data-act="restore" data-id="${a.id}">برگرداندن نوبت</button>`;
  }
  return `<div class="row ${done?'done':''} ${cancel?'cancel':''} ${late?'late':''}"><div class="tick" aria-label="${done?'تحویل شده':'تحویل نشده'}">✓</div><div style="min-width:0"><div class="name">${esc(a.heyat)}</div><div class="sub">${sub.join('')}</div></div><div class="q num">${fa(q)}<small>پرس</small></div>${acts?`<div class="acts">${acts}</div>`:''}</div>`;
}
function renderDeliver(st){
  $('#deliverStrip').innerHTML=`<div><b class="num">${fa(st.pend)}</b><span>پرس مانده برای تحویل</span></div><div><b class="num">${fa(st.nPend)}</b><span>هیئت مانده</span></div><div><b class="num">${st.hasProd?fa(st.stock):'—'}</b><span>موجودی آشپزخانه</span></div>`;
  const recent=forDay(S.date).filter(a=>a.status==='delivered').sort((a,b)=>(b.deliveredAt||'').localeCompare(a.deliveredAt||'')).slice(0,6);
  $('#recentList').innerHTML=recent.length?recent.map(a=>rowHTML(a,false)).join(''):'<div class="empty">هنوز تحویلی در این روز ثبت نشده.</div>';
  const box=$('#deliverResult');
  if(!S.lookup){box.innerHTML='';return}
  const code=S.lookup;const m=allocs().filter(a=>a.code===code&&active(a));
  if(!m.length){box.innerHTML=`<div class="card result"><div class="banner bad"><b>کد ${faDig(code)} پیدا نشد.</b><br>کد را دوباره از نماینده بپرسید یا در «برنامه‌ریزی» جستجو کنید.</div></div>`;return}
  const t=todayISO();
  m.sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1)||Math.abs(parseISO(a.date)-parseISO(t))-Math.abs(parseISO(b.date)-parseISO(t)));
  const a=m[0];
  if(a.status==='delivered'){
    box.innerHTML=`<div class="card result" style="border-color:var(--bad)"><div class="banner bad"><b>این سهم قبلاً تحویل داده شده است.</b></div><div class="who">${esc(a.heyat)}</div>
    <dl class="kv"><dt>تحویل شده</dt><dd class="num">${fa(a.deliveredQty??a.qty)} پرس</dd><dt>زمان تحویل</dt><dd>${esc(fStamp.format(new Date(a.deliveredAt)))}</dd>${a.deliveredBy?`<dt>ثبت توسط</dt><dd>${esc(a.deliveredBy)}</dd>`:''}<dt>نوبت</dt><dd>${esc(dLong(a.date))} · ساعت ${faDig(a.time)}</dd></dl>
    <button class="btn danger" data-act="undo" data-id="${a.id}">برگرداندن تحویل (اگر اشتباه ثبت شده)</button></div>`;return;
  }
  const tm=timing(a);
  const prev=box.querySelector('#dQty');const cur=prev&&prev.dataset.id===a.id?prev.value:String(a.qty);
  box.innerHTML=`<div class="card result">
    <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><span class="chip ${tm.cls}">${esc(tm.text)}</span><span class="muted num">کد ${faDig(a.code)}</span></div>
    <div class="who">${esc(a.heyat)}</div>
    <div class="bigqty"><b class="num">${fa(a.qty)}</b><span>پرس</span></div>
    <dl class="kv"><dt>نوبت</dt><dd>${esc(dLong(a.date))} · ساعت ${faDig(a.time)}</dd>${a.rep?`<dt>نماینده</dt><dd>${esc(a.rep)}</dd>`:''}${a.phone?`<dt>تلفن</dt><dd style="direction:ltr;text-align:right">${esc(faDig(a.phone))}</dd>`:''}${a.note?`<dt>توضیح</dt><dd>${esc(a.note)}</dd>`:''}</dl>
    <div class="stepper"><span class="muted" style="font-size:13px">تعداد تحویلی:</span><button class="iconbtn" data-step="-10">−</button><input id="dQty" data-id="${a.id}" inputmode="numeric" value="${esc(cur)}"><button class="iconbtn" data-step="10">+</button></div>
    <button class="btn primary big" data-act="deliver" data-id="${a.id}">${tm.cls==='bad'?'تحویل خارج از نوبت ✓':'تحویل داده شد ✓'}</button>
  </div>`;
}
function renderBoard(st){
  const alert=[];
  if(!st.hasProd)alert.push(`<div class="banner warn">تعداد پخت ${esc(dLong(S.date))} هنوز ثبت نشده. بالای همین صفحه واردش کنید.</div>`);
  else if(st.free<0)alert.push(`<div class="banner bad"><b>کسری ${fa(-st.free)} پرس:</b> نوبت‌های داده‌شده از پخت این روز بیشتر است. یا پخت را بالا ببرید یا سهم بعضی هیئت‌ها را کم کنید.</div>`);
  $('#boardAlert').innerHTML=alert.join('');
  $('#kpis').innerHTML=[
    ['hero','پرس مانده برای تحویل',fa(st.pend)],
    ['','پخت روز',st.hasProd?fa(st.prod):'—'],
    ['','تحویل‌شده',fa(st.deliv)],
    ['','موجودی آشپزخانه (پخت − داده‌شده‌ها)',st.hasProd?fa(st.stock):'—'],
    [st.free<0?'neg':'','ظرفیت آزاد (پخت − تعهد هیئت‌ها − سهم نیروها)',st.hasProd?fa(st.free):'—'],
    ['','هیئت‌ها: تحویل‌گرفته / کل',fa(st.nDone)+' / '+fa(st.n)],
    ['','تعهد هیئت‌ها',fa(st.alloc)],
    ['','سهم مانده نیروها',st.staff?fa(st.staffQty-st.staffGiven):'—'],
  ].map(([c,l,v])=>`<div class="kpi ${c}"><span>${l}</span><b>${v}</b></div>`).join('');
  const base=Math.max(st.prod,st.alloc+st.staffQty,1);
  const sp=Math.max(st.staffQty,st.staffGiven)||1;
  $('#staffStrip').innerHTML=`<div><b class="num">${fa(st.staffQty)}</b><span>ظرفیت نیروها (${fa(st.staff)} نفر × ${fa(st.pack)})</span></div><div><b class="num">${fa(st.staffGiven)}</b><span>داده‌شده (${fa(st.packsGiven)} بسته)</span></div><div><b class="num" style="color:${st.staffQty-st.staffGiven<0?'var(--bad)':'inherit'}">${fa(st.staffQty-st.staffGiven)}</b><span>مانده (${fa(Math.max(0,st.staff-st.packsGiven))} بسته)</span></div>`;
  $('#staffBar').innerHTML=`<i style="width:${st.staffGiven/sp*100}%;background:#6f8fd6"></i>`;
  const seg=[[st.deliv,'var(--ok)','تحویل‌شده به هیئت‌ها'],[st.pend,'var(--saffron)','در انتظار تحویل'],[st.staffGiven,'#6f8fd6','داده‌شده به نیروها'],[Math.max(st.staffQty-st.staffGiven,0),'color-mix(in srgb,#6f8fd6 40%,transparent)','سهم مانده نیروها'],[Math.max(st.free,0),'var(--line)','آزاد / بدون نوبت']];
  const day=DATA.days?.[S.date];const hist=[];if(day?.base!=null)hist.push('پخت اولیه '+fa(day.base));(day?.changes||[]).forEach(c=>hist.push((c.delta>0?'+':'−')+fa(Math.abs(c.delta))+' ساعت '+fClock.format(new Date(c.at))+(c.by?' ('+c.by+')':'')));
  $('#prodHist').textContent=hist.length?'سابقه پخت: '+hist.join(' · ')+' = '+fa(st.prod):'';
  $('#bar').innerHTML=seg.map(([v,c])=>`<i style="width:${v/base*100}%;background:${c}"></i>`).join('');
  $('#legend').innerHTML=seg.map(([v,c,l])=>`<span><i style="background:${c}"></i>${l}: <b class="num">${fa(v)}</b></span>`).join('');
  document.querySelectorAll('#filterTabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.f===S.filter));
  let list=forDay(S.date);
  if(S.filter==='pending')list=list.filter(a=>a.status==='pending');
  if(S.filter==='delivered')list=list.filter(a=>a.status==='delivered');
  $('#boardList').innerHTML=list.length?list.map(a=>rowHTML(a,true)).join(''):'<div class="empty">برای این روز نوبتی نیست. از «برنامه‌ریزی» برای هیئت‌ها نوبت بسازید.</div>';
  const by={};forDay(S.date).filter(active).forEach(a=>{const h=(a.time||'00:00').slice(0,2);(by[h]=by[h]||{done:0,pend:0,n:0});by[h].n++;if(a.status==='delivered')by[h].done+=Number(a.deliveredQty??a.qty);else by[h].pend+=Number(a.qty)});
  const hs=Object.keys(by).sort();let cum=0;const mx=Math.max(1,...hs.map(h=>by[h].done+by[h].pend));
  $('#hours').innerHTML=hs.length?hs.map(h=>{const r=by[h];cum+=r.done+r.pend;return `<div class="hour"><span class="num">${faDig(h)}:۰۰</span><div class="track" title="${fa(r.n)} هیئت"><i style="width:${r.done/mx*100}%;background:var(--ok)"></i><i style="width:${r.pend/mx*100}%;background:var(--saffron)"></i></div><span class="val">${fa(r.done+r.pend)} · <b>تا اینجا ${fa(cum)}</b></span></div>`}).join(''):'<div class="empty">نوبتی ثبت نشده.</div>';
}
function capHint(){
  const d=$('#fDate').value;if(!d)return;
  const st=dayStats(d);const ex=S.editingId?allocs().find(a=>a.id===S.editingId):null;
  const used=st.alloc-(ex&&ex.date===d&&active(ex)?Number(ex.qty):0);const q=toInt($('#fQty').value);
  const el=$('#capHint');
  if(!st.hasProd){el.className='cap';el.innerHTML=`پخت ${esc(dLong(d))} هنوز ثبت نشده · تا الان ${fa(used)} پرس به ${fa(st.n)} هیئت تعهد شده.`;return}
  const after=st.prod-st.staffQty-used-q;el.className='cap'+(after<0?' neg':'');
  el.innerHTML=`پخت ${esc(dShort(d))}: <b class="num">${fa(st.prod)}</b>${st.staffQty?' · نیروها: <b class="num">'+fa(st.staffQty)+'</b>':''} · تعهد شده: <b class="num">${fa(used)}</b> · ${after<0?'بعد از این نوبت <b>کسری '+fa(-after)+'</b> پرس':'بعد از این نوبت آزاد می‌ماند: <b class="num">'+fa(after)+'</b>'}`;
}
function renderPlan(){
  const names=[...new Set(allocs().map(a=>a.heyat))].sort((a,b)=>a.localeCompare(b,'fa'));
  $('#heyatList').innerHTML=names.map(n=>`<option value="${esc(n)}"></option>`).join('');
  if(!$('#fCode').value)$('#fCode').value=newCode(S.editingId);
  capHint();
  let h='';
  for(let i=0;i<21;i++){
    const d=addDays(S.date,i);const list=forDay(d);if(!list.length)continue;const st=dayStats(d);
    h+=`<div class="dayhead"><h3>${esc(dLong(d))}</h3><span class="muted num" style="font-size:13px">تعهد ${fa(st.alloc)}${st.hasProd?' از '+fa(st.prod):''} · ${fa(st.n)} هیئت ${st.hasProd&&st.free<0?'<span class="chip bad">کسری '+fa(-st.free)+'</span>':''}</span></div><div class="list">${list.map(a=>rowHTML(a,true)).join('')}</div>`;
  }
  $('#planList').innerHTML=h||`<div class="empty">از ${esc(dLong(S.date))} به بعد نوبتی ثبت نشده. اولین نوبت را با فرم بالا بسازید.</div>`;
  $('#shareBox').innerHTML=S.lastShare?`<div class="card" style="display:flex;flex-direction:column;gap:10px"><h3>پیام برای هیئت (کپی کنید و پیامک یا پیام‌رسان بفرستید)</h3><div class="share" id="shareText">${esc(S.lastShare)}</div><div style="display:flex;gap:8px"><button class="btn primary" id="copyShare">کپی متن</button><button class="btn" id="closeShare">بستن</button></div></div>`:'';
}
function shareText(a){return `بسم الله\nمحفل روضه مضیف الزهراء (س) — ${a.heyat}${a.rep?' (جناب '+a.rep+')':''}\nسهم غذای شما: ${fa(a.qty)} پرس\nروز تحویل: ${dFull(a.date)}\nساعت تحویل: ${faDig(a.time)}\nکد تحویل: ${faDig(a.code)}\nلطفاً نماینده هنگام تحویل این کد را اعلام کند. کد فقط یک بار قابل استفاده است.`}
function renderReport(){
  const from=addDays(todayISO(),-60);
  const agg={};allocs().filter(a=>active(a)&&a.date>=from).forEach(a=>{const r=agg[a.heyat]=agg[a.heyat]||{n:0,alloc:0,deliv:0,miss:0};r.n++;r.alloc+=Number(a.qty);if(a.status==='delivered')r.deliv+=Number(a.deliveredQty??a.qty);else if(a.date<todayISO())r.miss++});
  const rows=Object.entries(agg).sort((a,b)=>b[1].alloc-a[1].alloc);
  $('#heyatTable').innerHTML=rows.length?`<table><thead><tr><th>هیئت</th><th>نوبت</th><th>تعهد</th><th>تحویل‌شده</th><th>نیامده</th></tr></thead><tbody>${rows.map(([n,r])=>`<tr><td>${esc(n)}</td><td class="n">${fa(r.n)}</td><td class="n">${fa(r.alloc)}</td><td class="n">${fa(r.deliv)}</td><td class="n">${r.miss?'<span class="chip bad">'+fa(r.miss)+'</span>':'—'}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">هنوز داده‌ای نیست.</div>';
  const logs=(DATA.log||[]).slice().reverse().slice(0,100);
  $('#logList').innerHTML=logs.length?logs.map(l=>`<div><time>${esc(fStamp.format(new Date(l.at)))}</time><span>${esc(l.text)}${l.by?' <span class="muted">· '+esc(l.by)+'</span>':''}</span></div>`).join(''):'<div class="empty">رویدادی ثبت نشده.</div>';
}

/* ================= actions ================= */
const findIn=(d,id)=>d.allocs.find(x=>x.id===id);
async function deliver(id,qty){
  let msg='';
  const ok=await act(()=>commit(d=>{
    const a=findIn(d,id);
    if(!a)throw new Error('این نوبت دیگر وجود ندارد');
    if(a.status==='delivered')throw new Error('ادمین دیگری همین الان تحویلش داده ('+(a.deliveredBy||'')+')');
    if(a.status==='cancelled')throw new Error('این نوبت لغو شده است');
    const q=qty>0?qty:Number(a.qty);
    Object.assign(a,{status:'delivered',deliveredQty:q,deliveredAt:new Date().toISOString(),deliveredBy:CFG.name||''});
    logEntry(d,'deliver',`تحویل ${fa(q)} پرس به ${a.heyat} (کد ${faDig(a.code)})`,id);
    msg=`ثبت شد: ${fa(q)} پرس به ${a.heyat}`;
  },'deliver '+id));
  if(ok){toast(msg);if(S.view==='deliver'){S.lookup='';$('#codeIn').value='';render();$('#codeIn').focus()}}
}
function patchAlloc(id,patch,text,okMsg,check){
  return act(()=>commit(d=>{const a=findIn(d,id);if(!a)throw new Error('این نوبت دیگر وجود ندارد');if(check)check(a,d);Object.assign(a,patch);logEntry(d,'edit',text(a),id)},'update '+id),okMsg);
}
function startEdit(id){
  const a=allocs().find(x=>x.id===id);if(!a)return;
  S.editingId=id;setView('plan');
  fillDateSelect($('#fDate'),S.date,a.date);
  $('#fHeyat').value=a.heyat;$('#fRep').value=a.rep||'';$('#fPhone').value=a.phone||'';$('#fTime').value=a.time||'19:00';$('#fQty').value=a.qty;$('#fCode').value=a.code;$('#fNote').value=a.note||'';
  $('#formTitle').textContent='ویرایش نوبت '+a.heyat;$('#fSave').textContent='ذخیره تغییرات';$('#formReset').hidden=false;capHint();
  $('#planForm').scrollIntoView({behavior:'smooth',block:'start'});
}
function resetForm(){
  S.editingId=null;$('#planForm').reset();$('#fTime').value='19:00';fillDateSelect($('#fDate'),S.date,S.date);$('#fCode').value=newCode();
  $('#formTitle').textContent='نوبت جدید برای هیئت';$('#fSave').textContent='ثبت نوبت و ساخت کد';$('#formReset').hidden=true;capHint();
}
async function saveForm(e){
  e.preventDefault();
  const a={heyat:$('#fHeyat').value.trim(),rep:$('#fRep').value.trim(),phone:en($('#fPhone').value.trim()),date:$('#fDate').value,time:$('#fTime').value||'19:00',qty:toInt($('#fQty').value),code:en($('#fCode').value.trim()),note:$('#fNote').value.trim()};
  if(!a.heyat)return toast('نام هیئت را وارد کنید');
  if(a.qty<=0)return toast('تعداد پرس را وارد کنید');
  if(!/^\d{4,6}$/.test(a.code))return toast('کد باید ۴ تا ۶ رقم باشد');
  const editing=S.editingId;
  $('#fSave').disabled=true;
  const ok=await act(()=>commit(d=>{
    if(usedCodes(editing,d).has(a.code))throw new Error('این کد الان برای هیئت دیگری فعال است. «کد تازه» را بزنید');
    if(editing){const x=findIn(d,editing);if(!x)throw new Error('این نوبت دیگر وجود ندارد');Object.assign(x,a);logEntry(d,'edit',`ویرایش نوبت ${a.heyat}: ${fa(a.qty)} پرس، ${dShort(a.date)} ساعت ${faDig(a.time)}`,editing)}
    else{const id=uid();d.allocs.push({id,...a,status:'pending',deliveredQty:null,deliveredAt:'',deliveredBy:'',createdAt:new Date().toISOString(),createdBy:CFG.name||''});logEntry(d,'create',`نوبت جدید: ${a.heyat}، ${fa(a.qty)} پرس، ${dShort(a.date)} ساعت ${faDig(a.time)}، کد ${faDig(a.code)}`,id)}
  },(editing?'edit ':'new ')+a.heyat),editing?'ذخیره شد':'نوبت ثبت شد');
  $('#fSave').disabled=false;
  if(ok){S.lastShare=shareText(a);resetForm();render();$('#shareBox').scrollIntoView({behavior:'smooth',block:'center'})}
}
function csv(list){
  const st={pending:'در انتظار',delivered:'تحویل شده',cancelled:'لغو'};
  const head=['تاریخ','روز','ساعت','هیئت','نماینده','تلفن','سهم','تحویلی','وضعیت','کد','زمان تحویل','ثبت توسط','توضیح'];
  const rows=list.map(a=>[a.date,dShort(a.date),a.time,a.heyat,a.rep,a.phone,a.qty,a.status==='delivered'?(a.deliveredQty??a.qty):'',st[a.status]||a.status,a.code,a.deliveredAt?fStamp.format(new Date(a.deliveredAt)):'',a.deliveredBy,a.note]);
  return '﻿'+[head,...rows].map(r=>r.map(v=>{v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(',')).join('\r\n');
}
function exportCsv(list,name){
  const url=URL.createObjectURL(new Blob([csv(list)],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}

/* ================= events ================= */
document.querySelector('nav.bottom').addEventListener('click',e=>{const b=e.target.closest('button[data-v]');if(b)setView(b.dataset.v)});
$('#gear').addEventListener('click',()=>setView('settings'));
$('#dSel').addEventListener('change',e=>setDate(e.target.value));
$('#dPrev').addEventListener('click',()=>setDate(addDays(S.date,-1)));
$('#dNext').addEventListener('click',()=>setDate(addDays(S.date,1)));
const doLookup=()=>{S.lookup=en($('#codeIn').value).replace(/\D/g,'');render()};
$('#codeIn').addEventListener('input',e=>{const v=en(e.target.value).replace(/\D/g,'');e.target.value=v;if(v.length>=4)doLookup();else if(S.lookup){S.lookup='';render()}});
$('#codeIn').addEventListener('keydown',e=>{if(e.key==='Enter')doLookup()});
$('#codeGo').addEventListener('click',doLookup);
$('#codeClear').addEventListener('click',()=>{$('#codeIn').value='';S.lookup='';render();$('#codeIn').focus()});
$('#filterTabs').addEventListener('click',e=>{const b=e.target.closest('button[data-f]');if(b){S.filter=b.dataset.f;render()}});
$('#prodSave').addEventListener('click',()=>{
  const v=toInt($('#prodIn').value);if(v<=0)return toast('تعداد پخت را وارد کنید');const day=S.date;
  act(()=>commit(d=>{d.days=d.days||{};const old=d.days[day]||{};d.days[day]={...old,date:day,production:v,base:v,changes:[],updatedAt:new Date().toISOString(),updatedBy:CFG.name||''};logEntry(d,'prod',`پخت ${dShort(day)} = ${fa(v)} پرس`)},'production '+day),'پخت '+dShort(day)+': '+fa(v)+' پرس');
});
function changeProd(sign){
  const v=toInt($('#deltaIn').value);if(v<=0)return toast('مقدار را وارد کنید، مثلاً ۵۰۰');const day=S.date;
  act(()=>commit(d=>{d.days=d.days||{};const o=d.days[day]||{date:day,production:0,base:0};
    if(o.base==null)o.base=Number(o.production||0);
    const np=Number(o.production||0)+sign*v;if(np<0)throw new Error('پخت نمی‌تواند منفی شود');
    o.production=np;(o.changes=o.changes||[]).push({delta:sign*v,at:new Date().toISOString(),by:CFG.name||''});o.updatedAt=new Date().toISOString();d.days[day]=o;
    logEntry(d,'prod',`پخت ${dShort(day)} ${sign>0?'+':'−'}${fa(v)} پرس ← ${fa(np)}`)},'production change '+day),
    (sign>0?'اضافه شد: ':'کم شد: ')+fa(v)+' پرس').then(ok=>{if(ok){$('#deltaIn').value='';fillDayInputs()}});
}
$('#deltaAdd').addEventListener('click',()=>changeProd(1));
$('#deltaSub').addEventListener('click',()=>armed($('#deltaSub'),'کم شود؟ دوباره بزنید',()=>changeProd(-1)));
$('#staffSave').addEventListener('click',()=>{
  const n=toInt($('#staffIn').value);if(n<0)return;const day=S.date;
  act(()=>commit(d=>{d.days=d.days||{};const o=d.days[day]||{date:day};o.staff=n;o.staffPack=PACK;d.days[day]=o;logEntry(d,'staff',`ظرفیت نیروهای آشپزخانه ${dShort(day)}: ${fa(n)} نفر × ۴ = ${fa(n*PACK)} پرس`)},'staff '+day),'ظرفیت نیروها: '+fa(n)+' نفر = '+fa(n*PACK)+' پرس');
});
function givePacks(sign){
  const n=toInt($('#packIn').value);if(n<=0)return toast('تعداد بسته را وارد کنید');const day=S.date;
  act(()=>commit(d=>{d.days=d.days||{};const o=d.days[day]||{date:day};const np=Number(o.packsGiven||0)+sign*n;if(np<0)throw new Error('بیشتر از بسته‌های داده‌شده نمی‌شود کم کرد');
    o.packsGiven=np;o.staffPack=o.staffPack||PACK;d.days[day]=o;logEntry(d,'staffgive',`${sign>0?'تحویل':'اصلاح'} ${fa(n)} بسته به نیروها (${fa(n*o.staffPack)} پرس) ← جمع ${fa(np)} بسته`)},'staff packs '+day),
    sign>0?fa(n)+' بسته به نیروها داده شد':'اصلاح شد').then(ok=>{if(ok)$('#packIn').value='1'});
}
$('#packGive').addEventListener('click',()=>givePacks(1));
$('#packUndo').addEventListener('click',()=>armed($('#packUndo'),'کم شود؟ دوباره بزنید',()=>givePacks(-1)));
document.addEventListener('click',async e=>{
  const st=e.target.closest('[data-step]');
  if(st){const i=$('#dQty');i.value=Math.max(0,toInt(i.value)+Number(st.dataset.step));return}
  if(e.target.id==='closeShare'){S.lastShare=null;render();return}
  if(e.target.id==='copyShare'){try{await navigator.clipboard.writeText(S.lastShare);toast('کپی شد')}catch(_){const r=document.createRange();r.selectNodeContents($('#shareText'));const s=getSelection();s.removeAllRanges();s.addRange(r);toast('متن انتخاب شد؛ کپی کنید')}return}
  const b=e.target.closest('[data-act]');if(!b)return;
  const id=b.dataset.id,a=allocs().find(x=>x.id===id),actn=b.dataset.act;if(!a)return;
  if(actn==='deliver'){const q=toInt($('#dQty')?.value);if(q>Number(a.qty))return armed(b,`بیشتر از سهم (${fa(a.qty)})! برای تأیید دوباره بزنید`,()=>deliver(id,q));if(a.date!==todayISO())return armed(b,'نوبت امروز نیست. مطمئنید؟ دوباره بزنید',()=>deliver(id,q));b.disabled=true;await deliver(id,q);b.disabled=false;return}
  if(actn==='quick')return armed(b,`تحویل ${fa(a.qty)} پرس به ${a.heyat}؟ دوباره بزنید`,()=>deliver(id,Number(a.qty)));
  if(actn==='undo')return armed(b,'برگرداندن تحویل؟ دوباره بزنید',()=>patchAlloc(id,{status:'pending',deliveredQty:null,deliveredAt:'',deliveredBy:''},x=>`برگشت تحویل ${x.heyat}`,'تحویل برگردانده شد',x=>{if(x.status!=='delivered')throw new Error('این نوبت تحویل‌شده نیست')}));
  if(actn==='cancel')return armed(b,'لغو نوبت؟ دوباره بزنید',()=>patchAlloc(id,{status:'cancelled'},x=>`لغو نوبت ${x.heyat} (${fa(x.qty)} پرس)`,'نوبت لغو شد',x=>{if(x.status==='delivered')throw new Error('این نوبت تحویل شده؛ اول تحویل را برگردانید')}));
  if(actn==='restore')return patchAlloc(id,{status:'pending'},x=>`برگشت نوبت ${x.heyat}`,'نوبت برگشت',(x,d)=>{if(usedCodes(id,d).has(x.code))throw new Error('کد این نوبت الان دست هیئت دیگری است؛ اول ویرایشش کنید')});
  if(actn==='edit')return startEdit(id);
});
$('#planForm').addEventListener('submit',saveForm);
$('#formReset').addEventListener('click',resetForm);
$('#fRegen').addEventListener('click',()=>{$('#fCode').value=newCode(S.editingId)});
['fDate','fQty'].forEach(k=>$('#'+k).addEventListener('input',capHint));
$('#fDate').addEventListener('change',capHint);
$('#fHeyat').addEventListener('change',()=>{
  if(S.editingId)return;const n=$('#fHeyat').value.trim();
  const last=allocs().filter(a=>a.heyat===n).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time))[0];
  if(last){if(!$('#fRep').value)$('#fRep').value=last.rep||'';if(!$('#fPhone').value)$('#fPhone').value=last.phone||'';if(!$('#fQty').value)$('#fQty').value=last.qty;$('#fTime').value=last.time||'19:00';capHint()}
});
$('#expDay').addEventListener('click',()=>exportCsv(forDay(S.date),'mozif-'+S.date+'.csv'));
$('#expAll').addEventListener('click',()=>exportCsv(allocs().slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)),'mozif-all.csv'));

/* settings */
$('#cfgForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const repo=$('#cRepo').value.trim().replace(/^https?:\/\/github\.com\//,'').replace(/\.git$/,'').replace(/\/$/,'');
  const cfg={repo,token:$('#cToken').value.trim(),name:$('#cName').value.trim()};
  const msg=$('#cMsg');
  if(!/^[\w.-]+\/[\w.-]+$/.test(repo)){msg.innerHTML='<div class="banner bad">نام مخزن باید به شکل <b dir="ltr">user/repo</b> باشد.</div>';return}
  $('#cSave').disabled=true;msg.innerHTML='<div class="banner warn">در حال بررسی اتصال…</div>';
  const old=CFG;CFG=cfg;ETAG=null;
  try{
    const r=await api('');if(!r.ok)throw new Error(await errText(r));
    const info=await r.json();
    if(!info.private)msg.innerHTML='<div class="banner bad">هشدار: این مخزن عمومی است و همه می‌توانند کدها و شماره‌ها را ببینند. آن را Private کنید.</div>';
    if(info.permissions&&!info.permissions.push)throw new Error('توکن فقط اجازه خواندن دارد. دسترسی Contents را روی Read and write بگذارید.');
    await pull(true);ls.set('mozif-cfg',cfg);setSync(true);
    if(info.private)msg.innerHTML='<div class="banner" style="background:color-mix(in srgb,var(--ok) 14%,transparent)">وصل شد ✓</div>';
    toast('این دستگاه وصل شد');setTimeout(()=>setView('deliver'),700);
  }catch(err){CFG=old;msg.innerHTML='<div class="banner bad">'+esc(err.message||'اتصال برقرار نشد')+'</div>'}
  finally{$('#cSave').disabled=false}
});
$('#cForget').addEventListener('click',e=>armed(e.target,'توکن از این گوشی پاک شود؟ دوباره بزنید',()=>{ls.del('mozif-cfg');ls.del('mozif-cache');CFG=null;DATA=EMPTY();SHA=null;ETAG=null;setSync(false);setView('settings');toast('اتصال این دستگاه قطع شد')}));

/* ================= polling ================= */
async function tick(){
  if(!CFG||document.hidden)return;
  try{const changed=await pull(false);setSync(true);if(changed){fillDayInputs();render()}}
  catch(e){setSync(false,/fetch|network|Failed/i.test(e.message)?null:e.message)}
}
setInterval(tick,15000);
setInterval(()=>{if(CFG&&online)setSync(true);if(S.view!=='plan'&&S.view!=='settings')render()},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});
window.addEventListener('online',tick);

/* ================= boot ================= */
fillDateSelect($('#dSel'),S.date,S.date);fillDateSelect($('#fDate'),S.date,S.date);
fillDayInputs();
const hv=(location.hash||'').slice(1);
setView(!CFG?'settings':(VIEWS.includes(hv)?hv:'deliver'));
setSync(!!CFG);if(CFG){$('#sync').textContent='در حال همگام‌سازی…';tick()}
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
