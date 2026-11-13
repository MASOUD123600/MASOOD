/* مضیف الزهراء — نسخه ساده (آزمایشی)
   Same storage design as /heyat/ (private GitHub repo, sha-guarded writes, 15 s polling),
   but writes to a SEPARATE file so trying it never touches the real data. */
(function(){
'use strict';
const TEST_MODE=true;
const FILE=TEST_MODE?'data-test.json':'data.json';
const CACHE_KEY='mozif-easy-cache-'+FILE;

const $=s=>document.querySelector(s);
const pad=n=>String(n).padStart(2,'0');
const iso=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parseISO=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(s,n)=>{const d=parseISO(s);d.setDate(d.getDate()+n);return iso(d)};
const today=()=>iso(new Date());
const fDay=new Intl.DateTimeFormat('fa-IR',{weekday:'long',day:'numeric',month:'long'});
const fFull=new Intl.DateTimeFormat('fa-IR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const fClock=new Intl.DateTimeFormat('fa-IR',{hour:'2-digit',minute:'2-digit'});
const dayName=s=>s===today()?'امروز':s===addDays(today(),1)?'فردا':s===addDays(today(),-1)?'دیروز':fDay.format(parseISO(s));
const fa=n=>Number(n||0).toLocaleString('fa-IR');
const faDig=s=>String(s??'').replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
const en=s=>String(s??'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const ls={get(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const buzz=p=>{try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};

/* icons */
const I={
 check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
 x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
 warn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 18h.01"/></svg>',
 food:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13h18a9 9 0 0 1-18 0z"/><path d="M8 9c0-1.5 1-1.5 1-3M12 9c0-1.5 1-1.5 1-3M16 9c0-1.5 1-1.5 1-3"/></svg>',
 list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1.4"/><circle cx="4" cy="12" r="1.4"/><circle cx="4" cy="18" r="1.4"/></svg>',
 plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M12 12v6M9 15h6"/></svg>',
};

/* ================= storage (GitHub) ================= */
let CFG=ls.get('mozif-cfg');
let SHA=null,ETAG=null,online=true;
const EMPTY=()=>({app:'mozif-alzahra',v:1,days:{},allocs:[],log:[]});
let DATA=ls.get(CACHE_KEY)||EMPTY();
const b64enc=str=>{const b=new TextEncoder().encode(str);let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(s)};
const b64dec=b=>new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s/g,'')),c=>c.charCodeAt(0)));
const api=(path,opt={})=>fetch('https://api.github.com/repos/'+CFG.repo+path,{...opt,cache:'no-store',headers:{'Authorization':'Bearer '+CFG.token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(opt.headers||{})}});
async function errText(r){
  if(r.status===401)return 'رمز (توکن) درست نیست یا تمام شده.';
  if(r.status===403)return 'رمز (توکن) اجازه ندارد.';
  if(r.status===404)return 'مخزن پیدا نشد.';
  try{return (await r.json()).message||('خطا '+r.status)}catch(e){return 'خطا '+r.status}
}
async function pull(force){
  const r=await api('/contents/'+FILE,{headers:(!force&&ETAG)?{'If-None-Match':ETAG}:{}});
  if(r.status===304)return false;
  if(r.status===404){const rr=await api('');if(!rr.ok)throw new Error(await errText(rr));SHA=null;ETAG=null;DATA=EMPTY();return true}
  if(!r.ok)throw new Error(await errText(r));
  ETAG=r.headers.get('ETag');const j=await r.json();SHA=j.sha;
  let t;if(j.encoding==='base64'&&j.content)t=b64dec(j.content);else{const raw=await api('/contents/'+FILE,{headers:{Accept:'application/vnd.github.raw+json'}});if(!raw.ok)throw new Error(await errText(raw));t=await raw.text()}
  DATA={...EMPTY(),...JSON.parse(t)};ls.set(CACHE_KEY,DATA);return true;
}
let busy=Promise.resolve();
function commit(mut,msg){
  const run=async()=>{
    for(let i=0;i<5;i++){
      await pull(i>0);
      const d=JSON.parse(JSON.stringify(DATA));mut(d);d.log=(d.log||[]).slice(-800);d.updatedAt=new Date().toISOString();
      const body={message:msg+' — '+(CFG.name||'')+(TEST_MODE?' [test]':''),content:b64enc(JSON.stringify(d,null,1))};if(SHA)body.sha=SHA;
      const r=await api('/contents/'+FILE,{method:'PUT',body:JSON.stringify(body)});
      if(r.ok){SHA=(await r.json()).content.sha;ETAG=null;DATA=d;ls.set(CACHE_KEY,DATA);online=true;return}
      if(r.status===409||r.status===422){ETAG=null;await new Promise(f=>setTimeout(f,300+Math.random()*700));continue}
      throw new Error(await errText(r));
    }
    throw new Error('دوباره بزنید.');
  };
  const p=busy.then(run,run);busy=p.catch(()=>{});return p;
}
const logEntry=(d,type,text,id)=>(d.log=d.log||[]).push({at:new Date().toISOString(),type,text,allocId:id||'',by:CFG?.name||''});
const netMsg=e=>/fetch|network|Failed/i.test(e?.message||'')?'اینترنت وصل نیست. اینترنت یا فیلترشکن را روشن کنید و دوباره بزنید.':(e?.message||'ثبت نشد');

/* ================= data helpers ================= */
const allocs=()=>DATA.allocs||[];
const active=a=>a.status!=='cancelled';
const forDay=d=>allocs().filter(a=>a.date===d&&active(a));
function stats(d){
  const l=forDay(d),day=DATA.days?.[d];let deliv=0,pend=0,alloc=0,nd=0,np=0;
  l.forEach(a=>{alloc+=+a.qty;if(a.status==='delivered'){deliv+=+(a.deliveredQty??a.qty);nd++}else{pend+=+a.qty;np++}});
  return {prod:+(day?.production||0),hasProd:!!day,deliv,pend,alloc,nd,np};
}
const minsLate=a=>{const t=parseISO(a.date);const[h,m]=(a.time||'0:0').split(':').map(Number);t.setHours(h,m,0,0);return Math.round((Date.now()-t)/60000)};
const usedCodes=(ex,d)=>new Set((d||DATA).allocs.filter(a=>a.status==='pending'&&a.id!==ex).map(a=>a.code));
function newCode(){const u=usedCodes();for(let i=0;i<500;i++){const c=String(1000+Math.floor(Math.random()*9000));if(!u.has(c))return c}return String(Date.now()).slice(-5)}

/* ================= screens ================= */
const S={screen:'home',code:'',qtyAdj:null,day:today(),pick:null,W:null};
function go(screen,extra){Object.assign(S,{screen},extra||{});draw();window.scrollTo(0,0)}
function top(back){
  return `${TEST_MODE?'<div class="test">نسخه آزمایشی — روی اطلاعات اصلی اثری ندارد</div>':''}
  <div class="top"><div class="logo" aria-hidden="true"></div><h1>مضیف الزهراء<small>${esc(fFull.format(new Date()))}</small></h1>${back?`<button class="back" data-go="home">برگشت ←</button>`:''}</div>`;
}
function syncLine(){return CFG?`<div class="sync ${online?'ok':'bad'}">${online?'● وصل است':'● اینترنت قطع است'}</div>`:''}

function draw(){
  if(!CFG&&S.screen!=='settings')S.screen='settings';
  const v={home,deliver,status,book,settings}[S.screen]||home;
  $('#app').innerHTML='<div class="screen" style="display:flex;flex-direction:column;gap:18px">'+v()+'</div>';
  if(S.screen==='book'&&S.W?.step===1)setTimeout(()=>$('#wName')?.focus(),60);
}

function home(){
  const st=stats(today());
  return top(false)+`
  <div class="tiles">
    <button class="tile g" data-go="deliver">${I.food}<span>تحویل غذا<small>هیئت آمده؟ کدش را بزنید</small></span></button>
    <button class="tile b" data-go="status">${I.list}<span>امروز چه خبر؟<small>${st.hasProd||st.np?`${fa(st.pend)} پرس مانده · ${fa(st.np)} هیئت`:'دیدن هیئت‌ها و پخت امروز'}</small></span></button>
    <button class="tile o" data-go="book">${I.plus}<span>نوبت جدید<small>به یک هیئت سهم بدهید</small></span></button>
  </div>
  ${syncLine()}
  <div class="mini"><button data-go="settings">تنظیمات</button></div>`;
}

/* ---- deliver ---- */
function keypad(okLabel){return `<div class="keys">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-key="${n}">${faDig(n)}</button>`).join('')}<button class="del" data-key="del" aria-label="پاک کردن">⌫</button><button data-key="0">۰</button><button class="ok" data-key="ok" aria-label="${okLabel}">✓</button></div>`}
function findCode(code){
  const m=allocs().filter(a=>a.code===code&&active(a));
  m.sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1)||Math.abs(parseISO(a.date)-parseISO(today()))-Math.abs(parseISO(b.date)-parseISO(today())));
  return m[0];
}
function deliver(){
  const a=S.code.length>=4?findCode(S.code):null;
  if(a&&a.status==='pending'){
    const q=S.qtyAdj??+a.qty;
    let pill='<span class="pill ok">نوبتش همین الان است</span>';
    if(a.date!==today())pill=`<span class="pill bad">نوبتش ${esc(dayName(a.date))} است، نه امروز!</span>`;
    else{const m=minsLate(a);if(m<-60)pill='<span class="pill warn">زودتر آمده</span>';else if(m>90)pill='<span class="pill warn">دیر آمده</span>'}
    return top(true)+`
    <div class="found">
      ${pill}
      <div class="name">${esc(a.heyat)}</div>
      <div class="qty">${fa(q)}</div><div class="unit">پرس غذا</div>
      <div class="when">${esc(dayName(a.date))} · ساعت ${faDig(a.time)}</div>
      ${q!==+a.qty?`<div class="pill warn">سهمش ${fa(a.qty)} پرس بود</div>`:''}
    </div>
    <button class="big" data-do="give" data-id="${a.id}">${I.check.replace('<svg','<svg width="40" height="40"')} تحویل دادم</button>
    <div class="row2"><button class="big grey" data-do="clear">کد دیگر</button><button class="big grey" data-do="less">کمتر برد؟</button></div>
    ${S.qtyAdj!=null?`<div class="card adj"><button data-adj="-10">−</button><b style="font-size:30px">${fa(q)}</b><button data-adj="10">+</button></div>`:''}`;
  }
  return top(true)+`
    <h2>کد هیئت را بزنید</h2>
    <div class="display">${S.code?faDig(S.code):'<span class="ph">- - - -</span>'}</div>
    ${keypad('نمایش')}
    ${syncLine()}`;
}

/* ---- status ---- */
function status(){
  const d=S.day,st=stats(d);
  if(S.pick){
    const a=allocs().find(x=>x.id===S.pick);
    if(a){const done=a.status==='delivered';
      return top(true)+`<div class="found" style="border-color:${done?'var(--green)':'var(--orange)'}">
        <span class="pill ${done?'ok':'warn'}">${done?'غذایش را گرفته ✓':'هنوز نیامده'}</span>
        <div class="name">${esc(a.heyat)}</div><div class="qty">${fa(done?(a.deliveredQty??a.qty):a.qty)}</div><div class="unit">پرس</div>
        <div class="when">${esc(dayName(a.date))} · ساعت ${faDig(a.time)} · کد ${faDig(a.code)}</div>
        ${done?`<div class="when">تحویل ساعت ${esc(fClock.format(new Date(a.deliveredAt)))}${a.deliveredBy?' · '+esc(a.deliveredBy):''}</div>`:''}
      </div>
      ${done?`<button class="big red" data-do="undo" data-id="${a.id}">اشتباه بود، برگردان</button>`:`<button class="big" data-do="give" data-id="${a.id}">${I.check.replace('<svg','<svg width="40" height="40"')} تحویل دادم</button>`}
      <button class="big grey" data-do="unpick">برگشت به فهرست</button>`;}
  }
  const list=forDay(d).sort((a,b)=>(a.status==='delivered')-(b.status==='delivered')||(a.time||'').localeCompare(b.time||''));
  const base=Math.max(st.prod,st.alloc,1);
  return top(true)+`
  <div class="daynav"><button data-day="-1" aria-label="روز قبل">›</button><b>${esc(dayName(d))}</b><button data-day="1" aria-label="روز بعد">‹</button></div>
  ${st.pend===0&&st.nd>0?'<div class="bignum" style="background:#e7f5ec"><b style="color:var(--green)">✓</b><span>همه هیئت‌ها غذایشان را گرفتند</span></div>':`<div class="bignum"><b>${fa(st.pend)}</b><span>پرس هنوز باید تحویل بدهیم</span></div>`}
  <div class="bar"><i style="width:${st.deliv/base*100}%;background:var(--green)"></i><i style="width:${st.pend/base*100}%;background:var(--orange)"></i></div>
  <div class="trio"><div><b>${st.hasProd?fa(st.prod):'—'}</b><span>پختیم</span></div><div><b>${fa(st.deliv)}</b><span>دادیم</span></div><div><b>${st.hasProd?fa(st.prod-st.deliv):'—'}</b><span>داریم</span></div></div>
  ${st.hasProd&&st.alloc>st.prod?`<div class="pill bad" style="text-align:center">غذا کم می‌آید: ${fa(st.alloc-st.prod)} پرس</div>`:''}
  <button class="big ${st.hasProd?'grey':'blue'}" data-do="prod">${st.hasProd?'تغییر تعداد پخت':'چند پرس پختیم؟ اینجا بزنید'}</button>
  ${S.prodEdit?`<div class="card" style="display:flex;flex-direction:column;gap:12px"><div class="display qty">${S.prodNum?faDig(S.prodNum):'<span class="ph">۰</span>'}</div>${keypad('ثبت')}</div>`:''}
  <h2 style="margin-top:6px">هیئت‌ها (${fa(st.nd)} از ${fa(st.nd+st.np)})</h2>
  <div class="list">${list.length?list.map(a=>{const done=a.status==='delivered';const late=!done&&a.date===today()&&minsLate(a)>30;
    return `<button class="item ${done?'done':late?'late':'wait'}" data-pick="${a.id}"><span class="ic">${done?'✓':late?'!':'…'}</span><span><span class="nm">${esc(a.heyat)}</span><br><span class="sb">${done?'گرفته':late?'دیر کرده':'منتظر'} · ساعت ${faDig(a.time)}</span></span><span class="q">${fa(done?(a.deliveredQty??a.qty):a.qty)}</span></button>`}).join(''):'<p class="hint">برای این روز هیئتی نداریم.</p>'}</div>`;
}

/* ---- booking wizard ---- */
function book(){
  const W=S.W||(S.W={step:1,heyat:'',qty:'',date:today(),time:'19:00',code:newCode()});
  const dots=`<div class="steps">${[1,2,3,4].map(i=>`<i class="${i<=W.step?'on':''}"></i>`).join('')}</div>`;
  if(W.step===1){
    const names=[...new Set(allocs().map(a=>a.heyat))].slice(-8);
    return top(true)+dots+`<h2>اسم هیئت چیست؟</h2>
    <input class="text" id="wName" value="${esc(W.heyat)}" placeholder="مثلاً هیئت مظفری" autocomplete="off">
    ${names.length?`<p class="hint">یا یکی از این‌ها را بزنید:</p><div class="choices">${names.map(n=>`<button data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>`:''}
    <button class="big" data-do="next1">بعدی ←</button>`;
  }
  if(W.step===2){
    return top(true)+dots+`<h2>چند پرس غذا؟</h2><p class="hint">${esc(W.heyat)}</p>
    <div class="display qty">${W.qty?faDig(W.qty):'<span class="ph">۰</span>'}</div>
    <div class="choices three">${[100,150,200,250,300,500].map(n=>`<button data-qty="${n}" class="${+W.qty===n?'on':''}">${fa(n)}</button>`).join('')}</div>
    ${keypad('بعدی')}`;
  }
  if(W.step===3){
    const st=stats(W.date);const left=st.prod-st.alloc;
    const days=[0,1,2,3,4,5].map(i=>addDays(today(),i));
    const hours=['17:00','18:00','19:00','20:00','21:00','22:00'];
    return top(true)+dots+`<h2>چه روزی بیاید؟</h2>
    <div class="choices">${days.map(d=>`<button data-date="${d}" class="${W.date===d?'on':''}">${esc(dayName(d))}</button>`).join('')}</div>
    ${st.hasProd?`<p class="hint">${esc(dayName(W.date))} ${left-+W.qty<0?'<b style="color:var(--red)">غذا کم می‌آید!</b>':'جا هست ✓'} (${fa(Math.max(left,0))} پرس آزاد)</p>`:''}
    <h2>چه ساعتی؟</h2>
    <div class="choices three">${hours.map(h=>`<button data-time="${h}" class="${W.time===h?'on':''}">${faDig(h.slice(0,2))}</button>`).join('')}</div>
    <button class="big" data-do="next3">بعدی ←</button>`;
  }
  if(W.step===4){
    return top(true)+dots+`<h2>درست است؟</h2>
    <div class="card"><dl class="summary"><dt>هیئت</dt><dd>${esc(W.heyat)}</dd><dt>غذا</dt><dd>${fa(W.qty)} پرس</dd><dt>روز</dt><dd>${esc(dayName(W.date))}</dd><dt>ساعت</dt><dd>${faDig(W.time)}</dd></dl></div>
    <button class="big" data-do="save">${I.check.replace('<svg','<svg width="40" height="40"')} بله، ثبت کن</button>
    <button class="big grey" data-do="restart">نه، از اول</button>`;
  }
  if(W.step===5){
    return top(true)+`<div class="found"><span class="pill ok">ثبت شد ✓</span><div class="name">${esc(W.heyat)}</div><div class="codebig">کد تحویل<b>${faDig(W.code)}</b></div></div>
    <p class="hint">این پیام را برای هیئت بفرستید:</p><div class="msg" id="msg">${esc(shareText(W))}</div>
    <button class="big blue" data-do="copy">کپی پیام</button>
    <button class="big grey" data-do="another">یک نوبت دیگر</button>`;
  }
}
function shareText(W){return `بسم الله\nمحفل روضه مضیف الزهراء (س) — ${W.heyat}\nسهم غذای شما: ${fa(W.qty)} پرس\nروز: ${fFull.format(parseISO(W.date))}\nساعت: ${faDig(W.time)}\nکد تحویل: ${faDig(W.code)}\nلطفاً هنگام تحویل این کد را بگویید.`}

/* ---- settings ---- */
function settings(){
  return top(!!CFG)+`<h2>وصل کردن این گوشی</h2>
  <p class="hint">${CFG?'این گوشی وصل است. اگر لازم است عوضش کنید.':'فقط یک بار لازم است. اگر نسخه اصلی را روی همین گوشی وصل کرده‌اید، این هم خودکار وصل است.'}</p>
  <form id="cfg" style="display:flex;flex-direction:column;gap:14px" autocomplete="off">
    <label class="f">مخزن<input id="cRepo" dir="ltr" value="${esc(CFG?.repo||'MASOUD123600/mozif-data')}"></label>
    <label class="f">رمز (توکن)<input id="cToken" type="password" dir="ltr" value="${esc(CFG?.token||'')}"></label>
    <label class="f">اسم شما<input id="cName" value="${esc(CFG?.name||'')}"></label>
    <button class="big" type="submit">وصل کن</button>
  </form>`;
}

/* ================= flash answers ================= */
let flashT;
function flash(kind,title,sub){
  const f=$('#flash');f.className='flash '+kind;f.innerHTML=(kind==='ok'?I.check:kind==='bad'?I.x:I.warn)+`<b>${esc(title)}</b>${sub?`<span>${esc(sub)}</span>`:''}<span style="opacity:.8;font-size:17px">برای ادامه بزنید</span>`;
  f.hidden=false;buzz(kind==='ok'?80:[200,100,200]);clearTimeout(flashT);flashT=setTimeout(()=>f.hidden=true,kind==='ok'?2500:5000);
}
$('#flash').addEventListener('click',()=>{$('#flash').hidden=true});

/* ================= actions ================= */
async function give(id,qty){
  try{
    let res;
    await commit(d=>{
      const a=d.allocs.find(x=>x.id===id);
      if(!a){res=['bad','این نوبت دیگر نیست'];return}
      if(a.status==='delivered'){res=['bad','قبلاً گرفته!',`${a.heyat} ساعت ${fClock.format(new Date(a.deliveredAt))} غذایش را برده`];throw new Error('_dup')}
      const q=qty>0?qty:+a.qty;
      Object.assign(a,{status:'delivered',deliveredQty:q,deliveredAt:new Date().toISOString(),deliveredBy:CFG.name||''});
      logEntry(d,'deliver',`تحویل ${fa(q)} پرس به ${a.heyat} (کد ${faDig(a.code)})`,id);
      res=['ok','تحویل شد',`${fa(q)} پرس به ${a.heyat}`];
    },'deliver '+id);
    flash(...res);
  }catch(e){if(e.message==='_dup'){const a=findAny(id);flash('bad','قبلاً گرفته!',a?`${a.heyat} ساعت ${fClock.format(new Date(a.deliveredAt))} غذایش را برده`:'')}else flash('warn','ثبت نشد',netMsg(e))}
  S.code='';S.qtyAdj=null;S.pick=null;draw();
}
const findAny=id=>allocs().find(x=>x.id===id);

document.addEventListener('click',async e=>{
  const t=e.target.closest('button');if(!t)return;
  if(t.dataset.go){if(t.dataset.go==='book')S.W=null;if(t.dataset.go==='deliver'){S.code='';S.qtyAdj=null}S.pick=null;S.prodEdit=false;return go(t.dataset.go)}
  if(t.dataset.key){
    const k=t.dataset.key;buzz(15);
    if(S.screen==='deliver'){
      if(k==='del')S.code=S.code.slice(0,-1);else if(k==='ok'){}else if(S.code.length<6)S.code+=k;
      if(S.code.length>=4||k==='ok'){
        const a=findCode(S.code);
        if(a&&a.status==='delivered'){flash('bad','قبلاً گرفته!',`${a.heyat} ساعت ${fClock.format(new Date(a.deliveredAt))} غذایش را برده`);S.code='';}
        else if(!a&&(S.code.length>=4&&(k==='ok'||S.code.length===4&&!allocs().some(x=>x.code.startsWith(S.code)&&x.code.length>4)))){flash('warn','این کد را نداریم','دوباره از نماینده بپرسید');S.code='';}
      }
      return draw();
    }
    if(S.screen==='book'&&S.W.step===2){
      if(k==='del')S.W.qty=S.W.qty.slice(0,-1);else if(k==='ok'){if(+S.W.qty>0){S.W.step=3}else flash('warn','تعداد را بزنید')}else if(S.W.qty.length<5)S.W.qty+=k;
      return draw();
    }
    if(S.screen==='status'&&S.prodEdit){
      if(k==='del')S.prodNum=S.prodNum.slice(0,-1);
      else if(k==='ok'){const v=+S.prodNum;if(v>0){const day=S.day;try{await commit(d=>{d.days=d.days||{};d.days[day]={date:day,production:v,updatedAt:new Date().toISOString(),updatedBy:CFG.name||''};logEntry(d,'prod',`پخت ${dayName(day)} = ${fa(v)} پرس`)},'production '+day);flash('ok','ثبت شد',`${dayName(day)} ${fa(v)} پرس پختیم`);S.prodEdit=false}catch(err){flash('warn','ثبت نشد',netMsg(err))}}}
      else if(S.prodNum.length<6)S.prodNum+=k;
      return draw();
    }
  }
  const W=S.W;
  switch(t.dataset.do){
    case 'give':{const a=findAny(t.dataset.id);if(!a)return;const q=S.screen==='deliver'?(S.qtyAdj??+a.qty):+a.qty;t.disabled=true;return give(a.id,q)}
    case 'clear':S.code='';S.qtyAdj=null;return draw();
    case 'less':{const a=findCode(S.code);S.qtyAdj=S.qtyAdj??+a.qty;return draw()}
    case 'undo':{const id=t.dataset.id;if(!t.dataset.sure){t.dataset.sure=1;t.textContent='مطمئنید؟ دوباره بزنید';return}
      try{await commit(d=>{const a=d.allocs.find(x=>x.id===id);if(a&&a.status==='delivered'){Object.assign(a,{status:'pending',deliveredQty:null,deliveredAt:'',deliveredBy:''});logEntry(d,'edit',`برگشت تحویل ${a.heyat}`,id)}},'undo '+id);flash('ok','برگردانده شد')}catch(err){flash('warn','ثبت نشد',netMsg(err))}
      S.pick=null;return draw()}
    case 'unpick':S.pick=null;return draw();
    case 'prod':S.prodEdit=!S.prodEdit;S.prodNum=String(stats(S.day).prod||'');if(S.prodNum==='0')S.prodNum='';return draw();
    case 'next1':{const n=($('#wName')?.value||'').trim();if(!n)return flash('warn','اسم هیئت را بنویسید');W.heyat=n;const last=allocs().filter(a=>a.heyat===n).pop();if(last){W.qty=W.qty||String(last.qty);W.time=last.time||W.time}W.step=2;return draw()}
    case 'next3':W.step=4;return draw();
    case 'restart':S.W=null;return draw();
    case 'another':S.W=null;return draw();
    case 'save':{t.disabled=true;
      try{await commit(d=>{let c=W.code;if(usedCodes(null,d).has(c)){const u=usedCodes(null,d);do{c=String(1000+Math.floor(Math.random()*9000))}while(u.has(c));W.code=c}
        const id=uid();d.allocs.push({id,heyat:W.heyat,rep:'',phone:'',date:W.date,time:W.time,qty:+W.qty,code:W.code,note:'',status:'pending',deliveredQty:null,deliveredAt:'',deliveredBy:'',createdAt:new Date().toISOString(),createdBy:CFG.name||''});
        logEntry(d,'create',`نوبت جدید: ${W.heyat}، ${fa(W.qty)} پرس، ${dayName(W.date)} ساعت ${faDig(W.time)}، کد ${faDig(W.code)}`,id)},'new '+W.heyat);
        W.step=5;buzz(80);
      }catch(err){flash('warn','ثبت نشد',netMsg(err))}
      return draw()}
    case 'copy':{const txt=shareText(W);try{await navigator.clipboard.writeText(txt);flash('ok','کپی شد','حالا در پیامک یا پیام‌رسان بچسبانید')}catch(_){const r=document.createRange();r.selectNodeContents($('#msg'));const s=getSelection();s.removeAllRanges();s.addRange(r)}return}
  }
  if(t.dataset.adj){S.qtyAdj=Math.max(1,S.qtyAdj+ +t.dataset.adj);return draw()}
  if(t.dataset.day){S.day=addDays(S.day,+t.dataset.day);S.pick=null;S.prodEdit=false;return draw()}
  if(t.dataset.pick){S.pick=t.dataset.pick;return draw()}
  if(t.dataset.name){W.heyat=t.dataset.name;const last=allocs().filter(a=>a.heyat===W.heyat).pop();if(last){W.qty=String(last.qty);W.time=last.time||W.time}W.step=2;return draw()}
  if(t.dataset.qty){W.qty=t.dataset.qty;return draw()}
  if(t.dataset.date){W.date=t.dataset.date;return draw()}
  if(t.dataset.time){W.time=t.dataset.time;return draw()}
});
document.addEventListener('keydown',e=>{ // physical keyboard also works for codes
  if(S.screen==='deliver'&&!e.target.closest('input')){const k=en(e.key);if(/^\d$/.test(k)||k==='Backspace'||k==='Enter'){e.preventDefault();document.querySelector(`[data-key="${k==='Backspace'?'del':k==='Enter'?'ok':k}"]`)?.click()}}
  if(S.screen==='book'&&S.W?.step===1&&e.key==='Enter'&&e.target.id==='wName'){e.preventDefault();document.querySelector('[data-do="next1"]').click()}
});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='cfg')return;e.preventDefault();
  const cfg={repo:$('#cRepo').value.trim().replace(/^https?:\/\/github\.com\//,'').replace(/\/$/,''),token:$('#cToken').value.trim(),name:$('#cName').value.trim()};
  if(!cfg.token||!cfg.name)return flash('warn','همه خانه‌ها را پر کنید');
  const old=CFG;CFG=cfg;ETAG=null;
  try{await pull(true);ls.set('mozif-cfg',cfg);online=true;flash('ok','وصل شد');go('home')}
  catch(err){CFG=old;flash('bad','وصل نشد',netMsg(err))}
});

/* ================= sync loop ================= */
async function tick(){
  if(!CFG||document.hidden)return;
  try{const ch=await pull(false);const was=online;online=true;
    // don't redraw while someone is typing a code / heyat name
    const typing=(S.screen==='deliver'&&S.code&&S.code.length<4)||(S.screen==='book'&&S.W?.step===1)||S.prodEdit;
    if((ch||!was)&&!typing)draw();}
  catch(e){if(online){online=false;if(S.screen!=='book')draw()}}
}
setInterval(tick,15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});
window.addEventListener('online',tick);

draw();tick();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
