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
const fWd=new Intl.DateTimeFormat('fa-IR',{weekday:'long'});
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
const EMPTY=()=>({app:'mozif-alzahra',v:1,days:{},allocs:[],heyats:[],settings:{},log:[]});
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
  const d=JSON.parse(text);DATA=ensureHeyats({...EMPTY(),...d});ls.set('mozif-cache',DATA);return true;
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
      const body={message:msg+' — '+(CFG.name||''),content:b64enc(JSON.stringify(draft))};
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
/* ---- heyat directory, codes, Jalali dates, messages ---- */
const norm=s=>en(String(s??'')).replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[أإآ]/g,'ا').replace(/[\s‌‏()\[\]\-_.،,\/]/g,'').toLowerCase();
const normPhone=p=>{let s=en(String(p??'')).replace(/\D/g,'');if(s.startsWith('0098'))s='0'+s.slice(4);else if(s.startsWith('98')&&s.length===12)s='0'+s.slice(2);else if(s.length===10&&s[0]==='9')s='0'+s;return s};
const hKey=(name,phone,rep)=>norm(name)+'|'+(normPhone(phone)||norm(rep));
function hid(k){let h=5381;for(let i=0;i<k.length;i++)h=((h*33)^k.charCodeAt(i))>>>0;return 'h'+h.toString(36)}
/* every booking belongs to a heyat record; older bookings get one automatically (same id on every device) */
function ensureHeyats(d){
  d.heyats=d.heyats||[];d.settings=d.settings||{};d.allocs=d.allocs||[];
  const byId=new Map(d.heyats.map(h=>[h.id,h])),byKey=new Map(d.heyats.map(h=>[hKey(h.name,h.phone,h.rep),h]));
  for(const a of d.allocs){
    if(a.heyatId&&byId.has(a.heyatId))continue;
    const k=hKey(a.heyat,a.phone,a.rep);let h=byKey.get(k);
    if(!h){h={id:hid(k),name:a.heyat,rep:a.rep||'',phone:a.phone||'',ref:a.ref||'',note:''};while(byId.has(h.id))h.id+='x';d.heyats.push(h);byKey.set(k,h);byId.set(h.id,h)}
    a.heyatId=h.id;
  }
  return d;
}
const heyats=()=>DATA.heyats||[];
const heyatById=id=>heyats().find(h=>h.id===id);
/* one heyat keeps the same code for all its days; a code can't be active for two different heyats */
const codeTaken=(code,heyatId,exceptId,d)=>(d||DATA).allocs.some(a=>a.status==='pending'&&a.id!==exceptId&&a.code===code&&a.heyatId!==heyatId);
function newCode(d){const u=new Set((d||DATA).allocs.filter(a=>a.status==='pending').map(a=>a.code));for(let i=0;i<500;i++){const c=String(1000+Math.floor(Math.random()*9000));if(!u.has(c))return c}return String(Date.now()).slice(-6)}
const heyatCode=(hId,d)=>{const t=todayISO();const l=(d||DATA).allocs.filter(a=>a.heyatId===hId&&a.status==='pending'&&a.date>=t).sort((a,b)=>a.date.localeCompare(b.date));return l[0]?.code||''};

const fJ=new Intl.DateTimeFormat('en-u-ca-persian-nu-latn',{year:'numeric',month:'numeric',day:'numeric'});
const jParts=s=>{const p={};fJ.formatToParts(parseISO(s)).forEach(x=>{if(x.type!=='literal')p[x.type]=parseInt(x.value,10)});return p};
const jNum=s=>{const p=jParts(s);return faDig(p.year+'/'+pad(p.month)+'/'+pad(p.day))};
/* Jalali -> ISO: estimate, then step until the browser's own Persian calendar agrees */
function j2g(jy,jm,jd){
  if(!(jy>1300&&jy<1500&&jm>=1&&jm<=12&&jd>=1&&jd<=31))return null;
  const off=(jm<=7?(jm-1)*31:186+(jm-7)*30)+jd-1;const d=new Date(jy+621,2,21+off);
  for(let i=0;i<8;i++){const p=jParts(iso(d));if(p.year===jy&&p.month===jm&&p.day===jd)return iso(d);
    const cur=p.year*372+p.month*31+p.day,want=jy*372+jm*31+jd;d.setDate(d.getDate()+(cur<want?1:-1))}
  return null;
}
const tShort=t=>{if(!t)return '';const[h,m]=t.split(':');return faDig(m==='00'||m==null?String(+h):(+h)+':'+m)};
const tWin=a=>tShort(a.time)+(a.timeEnd?' الی '+tShort(a.timeEnd):'');

const DEFAULT_TPL=`مضیف الزهرا (س)
{مخاطب}

{روزها}

ساعت تحویل {ساعت} می باشد.
کد تحویل غذای شما {کد} می باشد لذا خواهشمند است این پیامک را همراه خود داشته باشید و فقط با این کد تحویل داده میشود.
لطفا هنگام مراجعه جهت تحویل غذا علاوه بر رعایت زمان اعلام شده ،از پارک کردن پشت درب گاراژ امتناع کنید (پس از اطمینان از حاضر بودن غذا وارد شوید).
آدرس جهت تحویل غذا : میدان رازی خ کارگر جنوبی به سمت میدان راه آهن نرسیده به خ زربافیان پلاک ۱۷۶ درب گاراژ`;
function addressee(h){
  const r=(h.rep||'').trim();if(!r||r==='-')return 'خادمین محترم '+h.name;
  let t;if(/^(جناب|سرکار)/.test(r))t=r;else if(/^[آا]قای/.test(r))t='جناب '+r;else if(/^خان[وُ]?م/.test(r))t='سرکار '+r;else t='جناب آقای '+r;
  return t+' خادم '+h.name;
}
/* the days one message covers: this heyat's waiting days with this code (from today on) */
function msgGroup(hId,code){
  const t=todayISO();const all=allocs().filter(a=>a.heyatId===hId&&a.code===code&&a.status==='pending').sort((a,b)=>a.date.localeCompare(b.date));
  const fut=all.filter(a=>a.date>=t);return fut.length?fut:all;
}
function buildMsg(hId,code){
  const h=heyatById(hId),g=msgGroup(hId,code);if(!h||!g.length)return '';
  const same=g.every(a=>tWin(a)===tWin(g[0]));
  const days=g.map(a=>`${jNum(a.date)} - تعداد ${faDig(a.qty)} پرس${same?'':' - ساعت '+tWin(a)}`).join('\n');
  return (DATA.settings?.msgTpl||DEFAULT_TPL).replace(/\{مخاطب\}/g,addressee(h)).replace(/\{روزها\}/g,days).replace(/\{ساعت\}/g,tWin(g[0])).replace(/\{کد\}/g,faDig(code)).replace(/\{هیئت\}/g,h.name).replace(/\{نماینده\}/g,h.rep||'');
}
function msgButtons(hId,code){
  const h=heyatById(hId),txt=buildMsg(hId,code);if(!h||!txt)return '';
  const p=normPhone(h.phone),mob=/^09\d{9}$/.test(p),q=encodeURIComponent(txt),at=`data-hact="sent" data-id="${hId}" data-code="${esc(code)}"`;
  return (mob?`<a class="btn sm wa" target="_blank" rel="noopener" href="https://wa.me/98${p.slice(1)}?text=${q}" ${at}>واتساپ</a><a class="btn sm" href="sms:${p}?&body=${q}" ${at}>پیامک</a>`:`<span class="chip warn">شماره موبایل ندارد</span>`)
    +`<button type="button" class="btn sm" data-hact="copy" data-id="${hId}" data-code="${esc(code)}">کپی متن</button>`;
}
const unsent=h=>{const t=todayISO();return allocs().some(a=>a.heyatId===h.id&&a.status==='pending'&&a.date>=t&&!a.msgAt)};
ensureHeyats(DATA);

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
const VIEWS=['deliver','board','plan','dir','report','settings'];
function setView(v){
  S.view=v;VIEWS.forEach(k=>$('#v-'+k).hidden=k!==v);
  document.querySelectorAll('nav.bottom button').forEach(b=>b.setAttribute('aria-current',b.dataset.v===v?'page':'false'));
  if(location.hash!=='#'+v)try{history.replaceState(null,'','#'+v)}catch(e){}
  if(v==='settings'){$('#cRepo').value=CFG?.repo||'';$('#cToken').value=CFG?.token||'';$('#cName').value=CFG?.name||'';$('#cForget').hidden=!CFG;$('#tplIn').value=DATA.settings?.msgTpl||DEFAULT_TPL}
  render();if(v==='deliver')setTimeout(()=>$('#codeIn').focus(),50);
}
function render(){
  const st=dayStats(S.date);
  $('#hdrSub').textContent=dFull(S.date)+(S.date===todayISO()?' · امروز':'');
  if(S.view==='deliver')renderDeliver(st);
  if(S.view==='board')renderBoard(st);
  if(S.view==='plan')renderPlan();
  if(S.view==='dir')renderDir();
  if(S.view==='report')renderReport();
}
function rowHTML(a,withActs){
  const done=a.status==='delivered',cancel=a.status==='cancelled';
  const late=!done&&!cancel&&a.date===todayISO()&&minutesFromNow(a)>30;
  const q=done?Number(a.deliveredQty??a.qty):Number(a.qty);
  const sub=[`<span>ساعت ${tWin(a)||'—'}</span>`,`<span>کد ${faDig(a.code)}</span>`];
  if(a.rep)sub.push(`<span>${esc(a.rep)}</span>`);
  if(a.ref)sub.push(`<span>معرف: ${esc(a.ref)}</span>`);
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
  const t=todayISO(),near=(x,y)=>Math.abs(parseISO(x.date)-parseISO(t))-Math.abs(parseISO(y.date)-parseISO(t));
  const a=m.find(x=>x.date===t&&x.status==='pending')||m.find(x=>x.date===t)||m.filter(x=>x.status==='pending').sort(near)[0]||m.slice().sort(near)[0];
  const others=m.length>1?`<div class="futs"><b>همه روزهای این کد</b>${m.slice().sort((x,y)=>x.date.localeCompare(y.date)).map(x=>`<span>${x.status==='delivered'?'✓':'○'} ${esc(dLong(x.date))} · ${fa(x.status==='delivered'?(x.deliveredQty??x.qty):x.qty)} پرس${x.status==='delivered'?' · گرفته':x.date<t?' · نیامده':''}${x.id===a.id?' ←':''}</span>`).join('')}</div>`:'';
  if(a.status==='delivered'){
    box.innerHTML=`<div class="card result" style="border-color:var(--bad)"><div class="banner bad"><b>این سهم قبلاً تحویل داده شده است.</b></div><div class="who">${esc(a.heyat)}</div>
    <dl class="kv"><dt>تحویل شده</dt><dd class="num">${fa(a.deliveredQty??a.qty)} پرس</dd><dt>زمان تحویل</dt><dd>${esc(fStamp.format(new Date(a.deliveredAt)))}</dd>${a.deliveredBy?`<dt>ثبت توسط</dt><dd>${esc(a.deliveredBy)}</dd>`:''}<dt>نوبت</dt><dd>${esc(dLong(a.date))} · ساعت ${tWin(a)}</dd></dl>${others}
    <button class="btn danger" data-act="undo" data-id="${a.id}">برگرداندن تحویل (اگر اشتباه ثبت شده)</button></div>`;return;
  }
  const tm=timing(a);
  const prev=box.querySelector('#dQty');const cur=prev&&prev.dataset.id===a.id?prev.value:String(a.qty);
  box.innerHTML=`<div class="card result">
    <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><span class="chip ${tm.cls}">${esc(tm.text)}</span><span class="muted num">کد ${faDig(a.code)}</span></div>
    <div class="who">${esc(a.heyat)}</div>
    <div class="bigqty"><b class="num">${fa(a.qty)}</b><span>پرس</span></div>
    <dl class="kv"><dt>نوبت</dt><dd>${esc(dLong(a.date))} · ساعت ${tWin(a)}</dd>${a.rep?`<dt>نماینده</dt><dd>${esc(a.rep)}</dd>`:''}${a.phone?`<dt>تلفن</dt><dd style="direction:ltr;text-align:right">${esc(faDig(a.phone))}</dd>`:''}${a.ref?`<dt>معرف</dt><dd>${esc(a.ref)}</dd>`:''}${a.note?`<dt>توضیح</dt><dd>${esc(a.note)}</dd>`:''}</dl>${others}
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
  // food available for heyats = production minus the kitchen staff share
  const avail=st.prod-st.staffQty;
  $('#hours').innerHTML=hs.length?hs.map(h=>{const r=by[h];cum+=r.done+r.pend;const gap=cum-avail;
    const verdict=!st.hasProd?'<span class="chip mute">پخت ثبت نشده</span>':gap>0?`<span class="chip bad">کسری ${fa(gap)} پرس</span>`:`<span class="chip ok">کافی است · اضافه ${fa(-gap)}</span>`;
    return `<div class="hour ${st.hasProd&&gap>0?'short':''}"><span class="num"><b>${faDig(h)}:۰۰</b></span><div class="track" title="${fa(r.n)} هیئت"><i style="width:${r.done/mx*100}%;background:var(--ok)"></i><i style="width:${r.pend/mx*100}%;background:var(--saffron)"></i></div><span class="val">${fa(r.done+r.pend)} پرس · ${fa(r.n)} هیئت</span><div class="sum"><span>تا ساعت ${faDig(h)}: روی هم <b class="num">${fa(cum)}</b> پرس</span>${verdict}</div></div>`}).join(''):'<div class="empty">نوبتی ثبت نشده.</div>';
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
  $('#heyatList').innerHTML=[...new Set(heyats().map(h=>h.name))].sort((a,b)=>a.localeCompare(b,'fa')).map(n=>`<option value="${esc(n)}"></option>`).join('');
  $('#refList').innerHTML=[...new Set(heyats().map(h=>h.ref).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fa')).map(n=>`<option value="${esc(n)}"></option>`).join('');
  if(!$('#fCode').value)$('#fCode').value=newCode();
  capHint();
  const t=todayISO();
  /* cooking plan: every coming day that has bookings */
  const days=[...new Set(allocs().filter(a=>active(a)&&a.date>=t).map(a=>a.date))].sort();
  let tot=0;const anyStaff=days.some(d=>dayStats(d).staffQty>0);
  $('#cookTable').innerHTML=days.length?`<table class="cooktbl"><thead><tr><th>روز</th><th>هیئت</th>${anyStaff?'<th>هیئت‌ها</th><th>نیروها</th>':''}<th>باید پخته شود</th></tr></thead><tbody>${days.map(d=>{const st=dayStats(d);const need=st.alloc+st.staffQty;tot+=need;
    return `<tr><td><b>${esc(dLong(d))}</b><br><span class="muted">${jNum(d)}</span></td><td class="n">${fa(st.n)}</td>${anyStaff?`<td class="n">${fa(st.alloc)}</td><td class="n">${st.staffQty?fa(st.staffQty):'—'}</td>`:''}<td class="n"><b class="cooknum">${fa(need)}</b></td></tr>`}).join('')}
    <tr><td><b>جمع ${fa(days.length)} روز</b></td><td></td>${anyStaff?'<td></td><td></td>':''}<td class="n"><b class="cooknum">${fa(tot)}</b></td></tr></tbody></table>`:'<div class="empty">برای روزهای آینده هنوز نوبتی ثبت نشده.</div>';
  /* one framed, colour-coded box per day */
  const from=S.date<t?S.date:t;
  const list=[...new Set(allocs().filter(a=>a.date>=from).map(a=>a.date))].sort().slice(0,60);
  if(!S.openDays){S.openDays=new Set(list.slice(0,1))}
  $('#planList').innerHTML=list.length?list.map((d,i)=>{const st=dayStats(d),open=S.openDays.has(d),need=st.alloc+st.staffQty;
    return `<section class="daybox c${i%5}"><button type="button" class="dayband" data-daytog="${d}" aria-expanded="${open}">
      <span class="dn">${esc(dLong(d))}${d===t?' · امروز':''}</span><span class="dj num">${jNum(d)}</span>
      <span class="cook">باید پخته شود: <b class="num">${fa(need)}</b> پرس</span><span class="dj">${open?'بستن ▴':'دیدن هیئت‌ها ▾'}</span>
      <span class="dmeta num">${fa(st.n)} هیئت · سهم هیئت‌ها ${fa(st.alloc)}${st.staffQty?' · نیروها '+fa(st.staffQty):''}${st.hasProd?' · پخت ثبت‌شده '+fa(st.prod):''} ${st.hasProd&&st.free<0?'<span class="chip bad">کسری '+fa(-st.free)+'</span>':''}</span>
    </button>${open?`<div class="list">${forDay(d).map(a=>rowHTML(a,true)).join('')}</div>`:''}</section>`}).join(''):`<div class="empty">هنوز نوبتی ثبت نشده. اولین نوبت را با فرم بالا بسازید یا از «دفتر» فایل اکسل بارگذاری کنید.</div>`;
  const ls=S.lastShare,sb=$('#shareBox');
  if(ls&&buildMsg(ls.heyatId,ls.code))sb.innerHTML=`<div class="card" style="display:flex;flex-direction:column;gap:10px"><h3>پیام برای هیئت</h3><div class="share" id="shareText">${esc(buildMsg(ls.heyatId,ls.code))}</div><div class="acts2">${msgButtons(ls.heyatId,ls.code)}<button type="button" class="btn sm" id="closeShare">بستن</button></div></div>`;
  else sb.innerHTML='';
}

/* ================= directory (دفتر) ================= */
function hayOf(h){const cs=[...new Set(allocs().filter(a=>a.heyatId===h.id).map(a=>a.code))].join(' ');return norm(h.name)+' '+norm(h.rep)+' '+normPhone(h.phone)+' '+norm(h.ref)+' '+cs+' '+norm(h.note)}
function matchQ(hay,q){const ts=en(q).trim().split(/\s+/).filter(Boolean).map(x=>/^\+?\d+$/.test(x)?x.replace(/^(\+98|0098)/,'0').replace(/\D/g,''):norm(x)).filter(Boolean);return ts.every(x=>hay.includes(x)||(/^0\d+$/.test(x)&&hay.includes(x.slice(1))))}
function heyatCard(h){
  const t=todayISO(),mine=allocs().filter(a=>a.heyatId===h.id&&active(a)).sort((a,b)=>a.date.localeCompare(b.date));
  const fut=mine.filter(a=>a.date>=t&&a.status==='pending'),done=mine.filter(a=>a.status==='delivered'),miss=mine.filter(a=>a.status==='pending'&&a.date<t);
  const codes=[...new Set(fut.map(a=>a.code))],code=codes.join('، '),p=normPhone(h.phone);
  const sum=l=>l.reduce((s,a)=>s+Number(a.status==='delivered'?(a.deliveredQty??a.qty):a.qty),0);
  return `<div class="card hcard">
    <div class="hhead"><div class="who">${esc(h.name)}</div>${unsent(h)?'<span class="chip warn">پیام ارسال نشده</span>':fut.length?'<span class="chip ok">پیام ارسال شده</span>':''}</div>
    <dl class="kv"><dt>نماینده</dt><dd>${esc(h.rep||'—')}</dd><dt>شماره</dt><dd>${p?`<a class="tel" href="tel:${p}">${faDig(p)}</a>`:'—'}</dd>
      <dt>معرف</dt><dd>${h.ref?`<button type="button" class="linkbtn" data-hact="ref" data-ref="${esc(h.ref)}">${esc(h.ref)}</button>`:'—'}</dd>
      ${code?`<dt>کد تحویل</dt><dd class="num">${faDig(code)}</dd>`:''}${h.note?`<dt>توضیح</dt><dd>${esc(h.note)}</dd>`:''}
      <dt>تا حالا</dt><dd class="num">${fa(done.length)} بار گرفته (${fa(sum(done))} پرس)${miss.length?' · <span class="chip bad">'+fa(miss.length)+' بار نیامده</span>':''}</dd></dl>
    ${fut.length?`<div class="futs"><b>نوبت‌های پیش‌رو (${fa(sum(fut))} پرس)</b>${fut.map(a=>`<span>${jNum(a.date)} · ${esc(fWd.format(parseISO(a.date)))} · ${fa(a.qty)} پرس · ساعت ${tWin(a)}</span>`).join('')}</div>`:'<div class="muted" style="font-size:13px">نوبت پیش‌رو ندارد.</div>'}
    ${codes.map(c=>`<div class="acts2">${codes.length>1?`<span class="muted num" style="font-size:13px">پیام کد ${faDig(c)}:</span>`:''}${msgButtons(h.id,c)}</div>`).join('')}<div class="acts2"><button type="button" class="btn sm primary" data-hact="book" data-id="${h.id}">نوبت جدید</button><button type="button" class="btn sm" data-hact="edit" data-id="${h.id}">ویرایش</button>${mine.length?'':`<button type="button" class="btn sm danger" data-hact="del" data-id="${h.id}">حذف</button>`}</div>
  </div>`;
}
function renderDir(){
  const q=$('#dirQ').value,tab=S.dirTab||'heyat';
  document.querySelectorAll('#dirTabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===tab));
  const all=heyats().slice().sort((a,b)=>a.name.localeCompare(b.name,'fa'));
  let html='',count='';
  if(tab==='ref'){
    const g={};all.forEach(h=>{if(h.ref)(g[h.ref]=g[h.ref]||[]).push(h)});
    const refs=Object.entries(g).filter(([r,hs])=>!q.trim()||matchQ(norm(r)+' '+hs.map(hayOf).join(' '),q)).sort((a,b)=>b[1].length-a[1].length);
    count=`${fa(refs.length)} معرف`;
    html=refs.map(([r,hs])=>{const tot=allocs().filter(a=>active(a)&&hs.some(h=>h.id===a.heyatId)).reduce((s,a)=>s+Number(a.qty),0);
      return `<div class="card hcard"><div class="hhead"><div class="who">${esc(r)}</div><span class="chip ok">${fa(hs.length)} هیئت · ${fa(tot)} پرس</span></div>
      <div class="futs"><b>هیئت‌هایی که معرفی کرده</b>${hs.map(h=>`<button type="button" class="linkbtn" data-hact="find" data-q="${esc(h.name)}">${esc(h.name)}${h.rep?' — '+esc(h.rep):''}${h.phone?' — '+faDig(normPhone(h.phone)):''}</button>`).join('')}</div></div>`}).join('')
      ||'<div class="empty">معرفی پیدا نشد. معرف را هنگام ثبت نوبت یا در ویرایش هیئت وارد کنید.</div>';
  }else{
    let res=all.filter(h=>!q.trim()||matchQ(hayOf(h),q));
    const nq=norm(q);if(nq){const rank=h=>{const n=norm(h.name);return n===nq?0:n.startsWith(nq)?1:n.includes(nq)?2:3};res.sort((a,b)=>rank(a)-rank(b))}
    if(tab==='unsent')res=res.filter(unsent);
    count=`${fa(res.length)} هیئت${res.length!==all.length?' از '+fa(all.length):''}`;
    html=res.slice(0,40).map(heyatCard).join('')+(res.length>40?`<div class="empty">${fa(res.length-40)} هیئت دیگر هم هست؛ جستجو را دقیق‌تر کنید.</div>`:'')
      ||`<div class="empty">${all.length?'چیزی پیدا نشد.':'هنوز هیئتی ثبت نشده. از پایین همین صفحه هیئت اضافه کنید یا فایل اکسل بارگذاری کنید.'}</div>`;
  }
  $('#dirCount').textContent=count;$('#dirList').innerHTML=html;
}
function bookFor(h,keepDate){
  if(!keepDate){setView('plan');resetForm()}
  $('#fHeyat').value=h.name;$('#fRep').value=h.rep||'';$('#fPhone').value=h.phone||'';$('#fRef').value=h.ref||'';
  const last=allocs().filter(a=>a.heyatId===h.id).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time))[0];
  if(last){if(!$('#fQty').value)$('#fQty').value=last.qty;$('#fTime').value=last.time||'19:00';$('#fTimeEnd').value=last.timeEnd||''}
  const c=heyatCode(h.id);if(c)$('#fCode').value=c;
  S.formHeyatId=h.id;capHint();
  if(!keepDate)$('#planForm').scrollIntoView({behavior:'smooth',block:'start'});
}
function editHeyat(h){
  S.hEdit=h?.id||null;$('#hName').value=h?.name||'';$('#hRep').value=h?.rep||'';$('#hPhone').value=h?.phone||'';$('#hRef').value=h?.ref||'';$('#hNote').value=h?.note||'';
  $('#hTitle').textContent=h?'ویرایش '+h.name:'هیئت جدید';$('#hCancel').hidden=!h;
  if(h)$('#hForm').scrollIntoView({behavior:'smooth',block:'start'});
}
async function saveHeyat(e){
  e.preventDefault();
  const v={name:$('#hName').value.trim(),rep:$('#hRep').value.trim(),phone:normPhone($('#hPhone').value),ref:$('#hRef').value.trim(),note:$('#hNote').value.trim()};
  if(!v.name)return toast('نام هیئت را وارد کنید');
  const id=S.hEdit;
  const ok=await act(()=>commit(d=>{
    const k=hKey(v.name,v.phone,v.rep);
    if(d.heyats.some(h=>h.id!==id&&hKey(h.name,h.phone,h.rep)===k))throw new Error('هیئتی با همین نام و شماره قبلاً ثبت شده است');
    if(id){const h=d.heyats.find(x=>x.id===id);if(!h)throw new Error('این هیئت دیگر وجود ندارد');Object.assign(h,v);
      d.allocs.forEach(a=>{if(a.heyatId===id)Object.assign(a,{heyat:v.name,rep:v.rep,phone:v.phone,ref:v.ref})});logEntry(d,'heyat','ویرایش اطلاعات '+v.name)}
    else{let nid=hid(k);while(d.heyats.some(h=>h.id===nid))nid+='x';d.heyats.push({id:nid,...v});logEntry(d,'heyat','هیئت جدید: '+v.name)}
  },'heyat '+v.name),id?'ذخیره شد':'هیئت اضافه شد');
  if(ok){editHeyat(null);render()}
}

/* ================= Excel import ================= */
const IMP={sheets:null,file:''};
function loadXLSX(){return window.XLSX?Promise.resolve():new Promise((res,rej)=>{const s=document.createElement('script');s.src='vendor/xlsx.mini.min.js';s.onload=()=>res();s.onerror=()=>rej(new Error('ابزار خواندن اکسل بارگیری نشد. اینترنت را بررسی کنید.'));document.head.appendChild(s)})}
const cellStr=v=>v==null?'':String(v).trim();
const toHM=s=>{s=en(s).replace(/[^\d:]/g,'');if(!s)return '';let[h,m]=s.split(':');h=+h;m=+(m||0);if(!(h>=0&&h<24&&m>=0&&m<60))return '';return pad(h)+':'+pad(m)};
function parseTimeWin(v){const s=cellStr(v);if(!s)return ['',''];const p=en(s).split(/الی|تا|-|–/);return [toHM(p[0]||''),toHM(p[1]||'')]}
function parseSheet(rows,name){
  let hr=-1,cols=null;
  for(let r=0;r<Math.min(rows.length,12);r++){
    const row=rows[r]||[];const c={days:[]};
    row.forEach((v,i)=>{const s=cellStr(v);if(!s)return;
      const n=Number(en(s));
      if(/^\d{1,2}$/.test(en(s))&&n>=1&&n<=31){c.days.push({i,n});return}
      if(/معرف/.test(s))c.ref=i;else if(/مسئول|مسوول|نماینده/.test(s))c.rep=i;else if(/تماس|شماره|تلفن|موبایل|همراه/.test(s))c.phone=i;else if(/ساعت/.test(s))c.time=i;else if(/کد/.test(s))c.code=i;else if(/هیئت|هیأت|مسجد|نام/.test(s)&&c.name==null)c.name=i});
    if(c.name!=null&&c.days.length){hr=r;cols=c;break}
  }
  if(hr<0)return null;
  const wk=(rows[hr+1]||[]),items=[];
  for(let r=hr+1;r<rows.length;r++){
    const row=rows[r]||[];const nm=cellStr(row[cols.name]);if(!nm||nm==='-')continue;
    const q=cols.days.map(d=>{const n=Number(en(cellStr(row[d.i])).replace(/[^\d.]/g,''));return n>0?Math.round(n):0});
    const [t1,t2]=cols.time!=null?parseTimeWin(row[cols.time]):['',''];
    const g=k=>cols[k]!=null?cellStr(row[cols[k]]):'';
    const rep=g('rep'),ph=g('phone');
    items.push({name:nm.replace(/\s+/g,' '),rep:rep==='-'?'':rep,phone:normPhone(ph),ref:g('ref')==='-'?'':g('ref'),time:t1,timeEnd:t2,code:en(g('code')).replace(/\D/g,''),q});
  }
  return {name,dayNums:cols.days.map(d=>d.n),weekdays:cols.days.map(d=>cellStr(wk[d.i])),items,hasRef:cols.ref!=null};
}
function sheetDates(sh){const s=j2g(sh.jy,sh.jm,sh.jd);return s?sh.dayNums.map((_,i)=>addDays(s,i)):null}
async function readExcel(file){
  await loadXLSX();
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
  const all=wb.SheetNames.map(n=>XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,defval:null,raw:true}));
  const found=[];all.forEach((rows,si)=>rows.forEach(row=>(row||[]).forEach(v=>{const m=typeof v==='string'&&en(v).match(/(1[34]\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);if(m)found.push({si,y:+m[1],m:+m[2],d:+m[3]})})));
  const tp=jParts(todayISO());
  const sheets=[];
  all.forEach((rows,si)=>{const sh=parseSheet(rows,wb.SheetNames[si]);if(!sh||!sh.items.length)return;
    const d0=sh.dayNums[0],c=found.filter(f=>f.d===d0),pick=c.find(f=>f.si===si)||c.find(f=>f.si===si+1)||c[0];
    Object.assign(sh,{on:true,jy:pick?pick.y:tp.year,jm:pick?pick.m:tp.month,jd:d0,guessed:!pick});sheets.push(sh)});
  if(!sheets.length)throw new Error('در این فایل جدولی با ستون «هیئت» و ستون‌های روز (مثل ۱۷، ۱۸، ۱۹) پیدا نشد.');
  IMP.sheets=sheets;IMP.file=file.name;
}
function renderImp(){
  const box=$('#xlPreview');if(!IMP.sheets){box.innerHTML='';return}
  const t=todayISO(),skip=$('#xlSkipPast')?$('#xlSkipPast').checked:true;
  box.innerHTML=`<div class="banner warn">فایل «${esc(IMP.file)}» خوانده شد. اول نگاه کنید درست است، بعد دکمه پایین را بزنید. تا آن موقع چیزی ثبت نمی‌شود.</div>`+
  IMP.sheets.map((sh,si)=>{const dates=sheetDates(sh);const nAl=sh.items.reduce((s,it)=>s+it.q.filter(Boolean).length,0);
    const bad=dates&&dates.some((d,i)=>jParts(d).day!==sh.dayNums[i]);
    return `<div class="impsheet"><label class="chk"><input type="checkbox" data-imp="on" data-si="${si}" ${sh.on?'checked':''}> <b>برگه «${esc(sh.name)}»</b> — ${fa(sh.items.length)} هیئت، ${fa(nAl)} نوبت</label>
    <div class="impdate"><span>تاریخ اولین ستون:</span><input data-imp="jd" data-si="${si}" inputmode="numeric" value="${sh.jd}" aria-label="روز"><span>/</span><input data-imp="jm" data-si="${si}" inputmode="numeric" value="${sh.jm}" aria-label="ماه"><span>/</span><input class="y" data-imp="jy" data-si="${si}" inputmode="numeric" value="${sh.jy}" aria-label="سال"></div>
    ${sh.guessed?'<div class="chip warn">ماه و سال در فایل پیدا نشد؛ خودتان بررسی کنید</div>':''}
    ${!dates?'<div class="chip bad">این تاریخ درست نیست</div>':`${bad?'<div class="chip bad">شماره روزهای فایل با این تاریخ پشت‌سرهم جور نیست؛ تاریخ را بررسی کنید</div>':''}
    <div class="tablewrap"><table><thead><tr><th>روز</th><th>تاریخ</th><th>هیئت</th><th>جمع پرس</th></tr></thead><tbody>${dates.map((d,i)=>{const wd=fWd.format(parseISO(d)),fw=sh.weekdays[i].replace(/\s/g,''),okw=!fw||norm(fw)===norm(wd);
      const n=sh.items.filter(it=>it.q[i]).length,tot=sh.items.reduce((s,it)=>s+it.q[i],0);
      return `<tr class="${skip&&d<t?'past':''}"><td>${esc(wd)} ${okw?'':'<span class="chip bad">در فایل: '+esc(sh.weekdays[i])+'</span>'}</td><td class="n">${jNum(d)}${d<t?' <span class="chip mute">گذشته</span>':''}</td><td class="n">${fa(n)}</td><td class="n">${fa(tot)}</td></tr>`}).join('')}</tbody></table></div>`}
    </div>`}).join('')+
  `<label class="chk"><input type="checkbox" id="xlSkipPast" ${skip?'checked':''}> نوبت روزهای گذشته وارد نشود (فقط اسم و مشخصات هیئت ثبت شود)</label>
   <div class="acts2"><button type="button" class="btn primary" id="xlGo">وارد کردن به برنامه</button><button type="button" class="btn" id="xlCancel">انصراف</button></div>`;
}
async function doImport(){
  const t=todayISO(),skip=$('#xlSkipPast').checked;const use=IMP.sheets.filter(s=>s.on);
  if(!use.length)return toast('هیچ برگه‌ای انتخاب نشده');
  if(use.some(s=>!sheetDates(s)))return toast('تاریخ یکی از برگه‌ها درست نیست');
  let r;
  $('#xlGo').disabled=true;
  const ok=await act(()=>commit(d=>{
    r={h:0,add:0,upd:0,same:0,conf:[]};const now=new Date().toISOString();
    const byKey=new Map(d.heyats.map(h=>[hKey(h.name,h.phone,h.rep),h]));
    for(const sh of use){const dates=sheetDates(sh);
      for(const it of sh.items){
        const k=hKey(it.name,it.phone,it.rep);let h=byKey.get(k);
        if(!h){let id=hid(k);while(d.heyats.some(x=>x.id===id))id+='x';h={id,name:it.name,rep:it.rep,phone:it.phone,ref:it.ref,note:''};d.heyats.push(h);byKey.set(k,h);r.h++}
        else{if(!h.rep&&it.rep)h.rep=it.rep;if(!h.phone&&it.phone)h.phone=it.phone;if(it.ref)h.ref=it.ref}
        let code=it.code;
        it.q.forEach((q,i)=>{
          if(!q)return;const date=dates[i];if(skip&&date<t)return;
          if(!code)code=heyatCode(h.id,d)||newCode(d);
          const ex=d.allocs.find(a=>a.heyatId===h.id&&a.date===date&&a.status!=='cancelled'&&(a.code===code||!it.code));
          if(ex){if(ex.status==='pending'&&(Number(ex.qty)!==q||(it.time&&ex.time!==it.time))){ex.qty=q;if(it.time){ex.time=it.time;ex.timeEnd=it.timeEnd}r.upd++}else r.same++;return}
          if(codeTaken(code,h.id,null,d)){r.conf.push(it.name);return}
          d.allocs.push({id:uid(),heyatId:h.id,heyat:h.name,rep:h.rep,phone:h.phone,ref:h.ref,date,time:it.time||'19:00',timeEnd:it.timeEnd||'',qty:q,code,note:'',status:'pending',deliveredQty:null,deliveredAt:'',deliveredBy:'',createdAt:now,createdBy:CFG.name||''});r.add++;
        });
      }
    }
    logEntry(d,'import',`بارگذاری اکسل «${IMP.file}»: ${fa(r.h)} هیئت جدید، ${fa(r.add)} نوبت جدید${r.upd?'، '+fa(r.upd)+' نوبت به‌روز شد':''}`);
  },'excel import'));
  if(ok){IMP.sheets=null;$('#xlFile').value='';
    $('#xlPreview').innerHTML=`<div class="banner" style="background:color-mix(in srgb,var(--ok) 14%,transparent)"><b>وارد شد ✓</b> — ${fa(r.h)} هیئت جدید، ${fa(r.add)} نوبت جدید${r.upd?'، '+fa(r.upd)+' نوبت به‌روز شد':''}${r.same?'، '+fa(r.same)+' نوبت از قبل بود':''}.${r.conf.length?'<br><b>وارد نشد (کد تکراری با هیئت دیگر):</b> '+esc([...new Set(r.conf)].join('، ')):''}</div>`;
    S.openDays=null;render()}
  else if($('#xlGo'))$('#xlGo').disabled=false;
}
async function sampleExcel(){
  try{await loadXLSX()}catch(e){return toast(e.message)}
  const p=jParts(addDays(todayISO(),1));const days=[0,1,2].map(i=>jParts(addDays(todayISO(),1+i)).day);
  const aoa=[['تاریخ اولین ستون',p.year+'/'+pad(p.month)+'/'+pad(p.day)],['ردیف','هیئت','مسئول هیئت','شماره تماس','معرف',...days,'ساعت تحویل','کد تحویل'],
    [1,'مسجد صاحب الزمان (عج)','آقای عقبایی','09120000000','حاج احمد',200,200,'','16الی16:15',405135262],[2,'هیئت نمونه','آقای نمونه','09350000000','','',350,350,'19:30الی19:45','']];
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),'نوبت‌ها');XLSX.writeFile(wb,'mozif-sample.xlsx');
}
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
  $('#fHeyat').value=a.heyat;$('#fRep').value=a.rep||'';$('#fPhone').value=a.phone||'';$('#fRef').value=a.ref||'';$('#fTime').value=a.time||'19:00';$('#fTimeEnd').value=a.timeEnd||'';$('#fQty').value=a.qty;$('#fCode').value=a.code;$('#fNote').value=a.note||'';S.formHeyatId=a.heyatId||null;
  $('#formTitle').textContent='ویرایش نوبت '+a.heyat;$('#fSave').textContent='ذخیره تغییرات';$('#formReset').hidden=false;capHint();
  $('#planForm').scrollIntoView({behavior:'smooth',block:'start'});
}
function resetForm(){
  S.editingId=null;S.formHeyatId=null;$('#planForm').reset();$('#fTime').value='19:00';fillDateSelect($('#fDate'),S.date,S.date);$('#fCode').value=newCode();
  $('#formTitle').textContent='نوبت جدید برای هیئت';$('#fSave').textContent='ثبت نوبت و ساخت کد';$('#formReset').hidden=true;capHint();
}
async function saveForm(e){
  e.preventDefault();
  const a={heyat:$('#fHeyat').value.trim(),rep:$('#fRep').value.trim(),phone:normPhone($('#fPhone').value),ref:$('#fRef').value.trim(),date:$('#fDate').value,time:$('#fTime').value||'19:00',timeEnd:$('#fTimeEnd').value||'',qty:toInt($('#fQty').value),code:en($('#fCode').value.trim()),note:$('#fNote').value.trim()};
  if(!a.heyat)return toast('نام هیئت را وارد کنید');
  if(a.qty<=0)return toast('تعداد پرس را وارد کنید');
  if(!/^\d{4,12}$/.test(a.code))return toast('کد باید ۴ تا ۱۲ رقم باشد');
  if(a.timeEnd&&a.timeEnd<=a.time)return toast('پایان بازه تحویل باید بعد از شروع آن باشد');
  const editing=S.editingId,pickId=S.formHeyatId;let hId;
  $('#fSave').disabled=true;
  const ok=await act(()=>commit(d=>{
    const x=editing?findIn(d,editing):null;if(editing&&!x)throw new Error('این نوبت دیگر وجود ندارد');
    const k=hKey(a.heyat,a.phone,a.rep);
    let h=x?d.heyats.find(q=>q.id===x.heyatId):(d.heyats.find(q=>q.id===pickId&&norm(q.name)===norm(a.heyat))||d.heyats.find(q=>hKey(q.name,q.phone,q.rep)===k));
    if(!h){let id=hid(k);while(d.heyats.some(q=>q.id===id))id+='x';h={id,name:a.heyat,rep:a.rep,phone:a.phone,ref:a.ref,note:''};d.heyats.push(h)}
    else{Object.assign(h,editing?{name:a.heyat,rep:a.rep,phone:a.phone,ref:a.ref}:{name:a.heyat,rep:a.rep||h.rep,phone:a.phone||h.phone,ref:a.ref||h.ref});
      d.allocs.forEach(o=>{if(o.heyatId===h.id)Object.assign(o,{heyat:h.name,rep:h.rep,phone:h.phone,ref:h.ref})})}
    Object.assign(a,{heyatId:h.id,rep:h.rep,phone:h.phone,ref:h.ref});hId=h.id;
    if(codeTaken(a.code,h.id,editing,d))throw new Error('این کد الان برای هیئت دیگری فعال است. «کد تازه» را بزنید');
    if(editing){Object.assign(x,a);logEntry(d,'edit',`ویرایش نوبت ${a.heyat}: ${fa(a.qty)} پرس، ${dShort(a.date)} ساعت ${tWin(a)}`,editing)}
    else{const id=uid();d.allocs.push({id,...a,status:'pending',deliveredQty:null,deliveredAt:'',deliveredBy:'',createdAt:new Date().toISOString(),createdBy:CFG.name||''});logEntry(d,'create',`نوبت جدید: ${a.heyat}، ${fa(a.qty)} پرس، ${dShort(a.date)} ساعت ${tWin(a)}، کد ${faDig(a.code)}${a.ref?'، معرف '+a.ref:''}`,id)}
  },(editing?'edit ':'new ')+a.heyat),editing?'ذخیره شد':'نوبت ثبت شد');
  $('#fSave').disabled=false;
  if(ok){S.lastShare={heyatId:hId,code:a.code};(S.openDays=S.openDays||new Set()).add(a.date);resetForm();render();$('#shareBox').scrollIntoView({behavior:'smooth',block:'center'})}
}
function csv(list){
  const st={pending:'در انتظار',delivered:'تحویل شده',cancelled:'لغو'};
  const head=['تاریخ','روز','ساعت','هیئت','نماینده','تلفن','معرف','سهم','تحویلی','وضعیت','کد','زمان تحویل','ثبت توسط','توضیح'];
  const rows=list.map(a=>[jNum(a.date),dShort(a.date),en(tWin(a)),a.heyat,a.rep,a.phone,a.ref||'',a.qty,a.status==='delivered'?(a.deliveredQty??a.qty):'',st[a.status]||a.status,a.code,a.deliveredAt?fStamp.format(new Date(a.deliveredAt)):'',a.deliveredBy,a.note]);
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
$('#codeIn').addEventListener('input',e=>{const v=en(e.target.value).replace(/\D/g,'');e.target.value=v;if(v.length>=4&&allocs().some(a=>a.code===v&&active(a)))doLookup();else if(S.lookup){S.lookup='';render()}});
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
  const b=e.target.closest('[data-act]');if(!b)return;
  const id=b.dataset.id,a=allocs().find(x=>x.id===id),actn=b.dataset.act;if(!a)return;
  if(actn==='deliver'){const q=toInt($('#dQty')?.value);if(q>Number(a.qty))return armed(b,`بیشتر از سهم (${fa(a.qty)})! برای تأیید دوباره بزنید`,()=>deliver(id,q));if(a.date!==todayISO())return armed(b,'نوبت امروز نیست. مطمئنید؟ دوباره بزنید',()=>deliver(id,q));b.disabled=true;await deliver(id,q);b.disabled=false;return}
  if(actn==='quick')return armed(b,`تحویل ${fa(a.qty)} پرس به ${a.heyat}؟ دوباره بزنید`,()=>deliver(id,Number(a.qty)));
  if(actn==='undo')return armed(b,'برگرداندن تحویل؟ دوباره بزنید',()=>patchAlloc(id,{status:'pending',deliveredQty:null,deliveredAt:'',deliveredBy:''},x=>`برگشت تحویل ${x.heyat}`,'تحویل برگردانده شد',x=>{if(x.status!=='delivered')throw new Error('این نوبت تحویل‌شده نیست')}));
  if(actn==='cancel')return armed(b,'لغو نوبت؟ دوباره بزنید',()=>patchAlloc(id,{status:'cancelled'},x=>`لغو نوبت ${x.heyat} (${fa(x.qty)} پرس)`,'نوبت لغو شد',x=>{if(x.status==='delivered')throw new Error('این نوبت تحویل شده؛ اول تحویل را برگردانید')}));
  if(actn==='restore')return patchAlloc(id,{status:'pending'},x=>`برگشت نوبت ${x.heyat}`,'نوبت برگشت',(x,d)=>{if(codeTaken(x.code,x.heyatId,id,d))throw new Error('کد این نوبت الان دست هیئت دیگری است؛ اول ویرایشش کنید')});
  if(actn==='edit')return startEdit(id);
});
$('#planForm').addEventListener('submit',saveForm);
$('#formReset').addEventListener('click',resetForm);
$('#fRegen').addEventListener('click',()=>{$('#fCode').value=newCode()});
['fDate','fQty'].forEach(k=>$('#'+k).addEventListener('input',capHint));
$('#fDate').addEventListener('change',capHint);
$('#fHeyat').addEventListener('change',()=>{
  if(S.editingId)return;const n=norm($('#fHeyat').value);const m=heyats().filter(h=>norm(h.name)===n);S.formHeyatId=null;
  if(m.length===1)bookFor(m[0],true);else if(m.length>1)toast('چند هیئت با این نام هست؛ از «دفتر» انتخاب کنید یا شماره را وارد کنید');
});
$('#expDay').addEventListener('click',()=>exportCsv(forDay(S.date),'mozif-'+S.date+'.csv'));
$('#expAll').addEventListener('click',()=>exportCsv(allocs().slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)),'mozif-all.csv'));

/* directory, messages, Excel import, message template */
function markSent(hId,code){
  if(!CFG)return;const ids=msgGroup(hId,code).filter(a=>!a.msgAt).map(a=>a.id);if(!ids.length)return;
  commit(d=>{const now=new Date().toISOString();d.allocs.forEach(a=>{if(ids.includes(a.id))a.msgAt=now})},'message sent').catch(()=>{});
}
document.addEventListener('click',async e=>{
  const dt=e.target.closest('[data-daytog]');
  if(dt){const d=dt.dataset.daytog;S.openDays.has(d)?S.openDays.delete(d):S.openDays.add(d);renderPlan();return}
  const hb=e.target.closest('[data-hact]');if(!hb)return;
  const k=hb.dataset.hact;
  if(k==='ref'){S.dirTab='ref';$('#dirQ').value=hb.dataset.ref;renderDir();window.scrollTo(0,0);return}
  if(k==='find'){S.dirTab='heyat';$('#dirQ').value=hb.dataset.q;renderDir();window.scrollTo(0,0);return}
  const h=heyatById(hb.dataset.id);if(!h)return;
  if(k==='book')return bookFor(h);
  if(k==='edit')return editHeyat(h);
  if(k==='del')return armed(hb,'حذف شود؟ دوباره بزنید',()=>act(()=>commit(d=>{if(d.allocs.some(a=>a.heyatId===h.id))throw new Error('این هیئت نوبت دارد و حذف نمی‌شود');d.heyats=d.heyats.filter(x=>x.id!==h.id);logEntry(d,'heyat','حذف '+h.name)},'delete heyat'),'حذف شد'));
  if(k==='copy'){const txt=buildMsg(h.id,hb.dataset.code);try{await navigator.clipboard.writeText(txt);toast('متن پیام کپی شد')}catch(_){toast('کپی نشد؛ متن را دستی انتخاب کنید');return}markSent(h.id,hb.dataset.code);return}
  if(k==='sent')markSent(h.id,hb.dataset.code); // the link itself opens WhatsApp / SMS
});
$('#dirQ').addEventListener('input',renderDir);
$('#dirTabs').addEventListener('click',e=>{const b=e.target.closest('button[data-t]');if(b){S.dirTab=b.dataset.t;renderDir()}});
$('#hForm').addEventListener('submit',saveHeyat);
$('#hCancel').addEventListener('click',()=>editHeyat(null));
$('#xlFile').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;$('#xlPreview').innerHTML='<div class="banner warn">در حال خواندن فایل…</div>';
  try{await readExcel(f);renderImp()}catch(err){IMP.sheets=null;$('#xlPreview').innerHTML='<div class="banner bad">'+esc(err.message||'فایل خوانده نشد')+'</div>'}
});
$('#xlSample').addEventListener('click',sampleExcel);
$('#xlPreview').addEventListener('change',e=>{
  const k=e.target.dataset.imp;if(k&&IMP.sheets){const sh=IMP.sheets[+e.target.dataset.si];if(k==='on')sh.on=e.target.checked;else{sh[k]=toInt(e.target.value);sh.guessed=false}}
  if(IMP.sheets)renderImp();
});
$('#xlPreview').addEventListener('click',e=>{if(e.target.id==='xlGo')doImport();if(e.target.id==='xlCancel'){IMP.sheets=null;$('#xlFile').value='';renderImp()}});
$('#tplSave').addEventListener('click',()=>{const v=$('#tplIn').value.trim();if(!v)return toast('متن پیام خالی است');act(()=>commit(d=>{d.settings=d.settings||{};d.settings.msgTpl=v;logEntry(d,'tpl','متن پیام هیئت‌ها تغییر کرد')},'message template'),'متن پیام ذخیره شد')});
$('#tplReset').addEventListener('click',e=>armed(e.target,'به متن اولیه برگردد؟ دوباره بزنید',()=>act(()=>commit(d=>{d.settings=d.settings||{};delete d.settings.msgTpl},'message template reset'),'به متن اولیه برگشت').then(ok=>{if(ok)$('#tplIn').value=DEFAULT_TPL})));

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
$('#cForget').addEventListener('click',e=>armed(e.target,'توکن از این گوشی پاک شود؟ دوباره بزنید',()=>{ls.del('mozif-cfg');ls.del('mozif-cache');CFG=null;DATA=EMPTY();S.openDays=null;SHA=null;ETAG=null;setSync(false);setView('settings');toast('اتصال این دستگاه قطع شد')}));

/* ================= polling ================= */
async function tick(){
  if(!CFG||document.hidden)return;
  try{const changed=await pull(false);setSync(true);if(changed){fillDayInputs();render()}}
  catch(e){setSync(false,/fetch|network|Failed/i.test(e.message)?null:e.message)}
}
setInterval(tick,15000);
setInterval(()=>{if(CFG&&online)setSync(true);if(S.view!=='plan'&&S.view!=='settings'&&S.view!=='dir')render()},30000);
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
