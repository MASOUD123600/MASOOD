'use strict';
/* سامانه املاک — اپ تک‌صفحه‌ای.
   سه نوع کاربر: مشتری (بدون ورود، فقط مشاهده)، مشاور (آگهی‌های خودش)، ادمین (همه‌چیز).
   داده‌ها در گیت‌هاب (مثل سامانه مضیف)؛ با ?demo در آدرس «حالت نمایشی» با localStorage. */

const CFG = window.AMLAK_CONFIG || {};
const DEMO = !CFG.publicRepo || /[?&]demo\b/.test(location.search);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------------- ثابت‌ها ---------------- */
const MISC_KINDS = { presale: 'پیش‌فروش', swap: 'معاوضه', partner: 'مشارکت در ساخت', old: 'کلنگی', goodwill: 'سرقفلی', other: 'سایر' };
const DEAL_NAME = { sale: 'فروش', rent: 'رهن و اجاره', misc: 'متفرقه' };
const dealLabel = l => l.deal === 'misc' ? (MISC_KINDS[l.misc_kind] || 'متفرقه') : DEAL_NAME[l.deal] || '';
const fullDate = d => d ? new Date(d).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) + ' ساعت ' + new Date(d).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '—';
const DIVAR_ST = { new: ['جدید', 'warn'], called: ['تماس گرفته شد', ''], listed: ['ثبت شد', 'ok'], rejected: ['رد شد', 'bad'] };
const PTYPES = { apartment: 'آپارتمان', villa: 'خانه ویلایی', land: 'زمین', commercial: 'مغازه / تجاری', office: 'اداری', garden: 'باغ / ویلا' };
const STATUS = {
  active: ['فعال', 'ok'], reserved: ['در حال معامله', 'warn'], sold: ['فروخته شد', 'bad'],
  rented: ['اجاره رفت', 'bad'], hidden: ['مخفی', '']
};
const FEATURES = ['پارکینگ', 'آسانسور', 'انباری', 'بالکن', 'لابی', 'سرایدار', 'نوساز', 'سند تک‌برگ', 'استخر', 'سونا و جکوزی',
  'روف گاردن', 'پکیج', 'شوفاژ', 'کولر گازی', 'مبله', 'قابل معاوضه', 'وام دار', 'دسترسی به مترو'];
const SPACES = ['پذیرایی', 'آشپزخانه', 'اتاق خواب', 'سرویس و حمام', 'کل واحد', 'نما', 'تجاری / اداری'];
const STYLES = ['مدرن', 'کلاسیک', 'نئوکلاسیک', 'مینیمال', 'روستیک', 'اسکاندیناوی', 'لاکچری'];
const LEAD_ST = { new: ['جدید', 'warn'], contacted: ['تماس گرفته شد', 'ok'], closed: ['بسته شد', ''] };
const ROLES = { admin: 'ادمین', agent: 'مشاور', pending: 'در انتظار تأیید' };

/* ---------------- ابزارها ---------------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fa = n => n == null || n === '' ? '' : Number(n).toLocaleString('fa-IR');
const faStr = s => String(s ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const toNum = s => { const t = String(s ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d]/g, ''); return t ? Number(t) : null; };
function money(n, unit = true) {
  if (n == null || n === '') return '—';
  n = Number(n); if (!n) return 'توافقی';
  const b = Math.floor(n / 1e9), m = Math.floor(n % 1e9 / 1e6), k = Math.floor(n % 1e6 / 1e3), p = [];
  if (b) p.push(fa(b) + ' میلیارد');
  if (m) p.push(fa(m) + ' میلیون');
  if (!b && k) p.push(fa(k) + ' هزار');
  if (!p.length) p.push(fa(n));
  return p.join(' و ') + (unit ? ' تومان' : '');
}
function ago(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 3600) return 'دقایقی پیش';
  if (s < 86400) return fa(Math.floor(s / 3600)) + ' ساعت پیش';
  if (s < 86400 * 30) return fa(Math.floor(s / 86400)) + ' روز پیش';
  return new Date(d).toLocaleDateString('fa-IR');
}
const toInt = s => { const n = toNum(s); return n != null && /^[^\d۰-۹٠-٩]*[-−]/.test(String(s)) ? -n : n; };
const waPhone = p => { const d = String(toNum(p) ?? ''); return d.startsWith('0') ? '98' + d.slice(1) : d; };
function toast(msg, ms = 2600) {
  $('.toast')?.remove();
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.append(t);
  setTimeout(() => t.remove(), ms);
}
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
};

const I = {
  sale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>',
  rent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.7-8.7M17 6l2 2M15 8l2 2"/></svg>',
  design: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16M6 20v-7a6 6 0 0 1 12 0v7"/><path d="M12 7V3M9 13h6"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 3 4.5 6.9 4.5c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.9 0 6 4.1 4.5 7.4C19.5 16.4 12 21 12 21z"/></svg>',
  heartO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 3 4.5 6.9 4.5c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.9 0 6 4.1 4.5 7.4C19.5 16.4 12 21 12 21z"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  panel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  misc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="m9.5 13 5 5M14.5 13l-5 5"/></svg>'
};

/* تصویر جایگزین برای حالت نمایشی و آگهی بدون عکس */
function placeholder(seed, label = '') {
  const hues = [158, 32, 205, 12, 268, 95];
  const h = hues[Math.abs(seed) % hues.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 35% 78%)"/><stop offset="1" stop-color="hsl(${h + 20} 30% 58%)"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><rect y="230" width="400" height="70" fill="hsl(${h} 25% 45%)" opacity=".35"/><g fill="hsl(${h} 30% 96%)" opacity=".92"><path d="M110 230V140l90-60 90 60v90z"/></g><g fill="hsl(${h} 30% 50%)" opacity=".75"><rect x="135" y="160" width="40" height="34" rx="3"/><rect x="225" y="160" width="40" height="34" rx="3"/><rect x="185" y="185" width="30" height="45" rx="3"/></g><path d="M95 145 200 72l105 73" fill="none" stroke="hsl(${h} 35% 35%)" stroke-width="10" stroke-linejoin="round"/>${label ? `<text x="200" y="272" text-anchor="middle" font-family="Tahoma" font-size="20" fill="#fff">${esc(label)}</text>` : ''}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const imgSrc = (u, seed = 0) => { if (!u) return placeholder(seed); if (!u.startsWith('ph:')) return u; const [, n, label] = u.split(':'); return placeholder(+n || 0, label || ''); };
const cover = l => imgSrc(l.images?.[0], l.id);

/* فشرده‌سازی عکس قبل از آپلود */
async function compress(file, max, q) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bmp) throw new Error('فایل تصویر قابل خواندن نیست');
  const r = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(res => c.toBlob(res, 'image/jpeg', q));
}

/* =====================================================================
   لایه داده — گیت‌هاب (مثل سامانه مضیف؛ بدون سرور)
   - اطلاعات عمومی (آگهی‌های فعال، مشاوران، طراحی‌ها، عکس‌ها) در شاخه amlak-data همین مخزن عمومی؛
     مشتری‌ها بدون هیچ ورود و توکنی از raw.githubusercontent.com می‌خوانند.
   - اطلاعات کامل و محرمانه (مالک، آدرس دقیق، آگهی‌های مخفی، رمز کارمندان) در private.json یک مخزن خصوصی.
   - توکن فقط روی دستگاه کارمندان است؛ مشاوران آن را داخل «لینک دعوت» رمزگذاری‌شده با رمز خودشان می‌گیرند.
   ===================================================================== */
const NEW_PUB = { repo: CFG.publicRepo, branch: CFG.publicBranch || 'main' };
const OLD_PUB = CFG.oldPublic || null;   // محل قبلی داده‌های عمومی (برای انتقال خودکار)
const te = new TextEncoder(), td = new TextDecoder();
const b64u = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const ub64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const toB64 = str => { const u = te.encode(str); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = s => td.decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));
async function pbkdf(pw, salt, len = 256) {
  const k = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 150000 }, k, len));
}
async function hashPw(pw, saltStr) { const salt = saltStr ? ub64u(saltStr) : crypto.getRandomValues(new Uint8Array(16)); return { salt: b64u(salt), hash: b64u(await pbkdf(pw, salt)) }; }
async function checkPw(u, pw) { return !!u?.salt && (await hashPw(pw, u.salt)).hash === u.hash; }
async function aesKey(pw, salt) { return crypto.subtle.importKey('raw', await pbkdf(pw, salt), 'AES-GCM', false, ['encrypt', 'decrypt']); }
async function sealInvite(pw, obj) {
  const s = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(pw, s), te.encode(JSON.stringify(obj))));
  return b64u(s) + '.' + b64u(iv) + '.' + b64u(c);
}
async function openInvite(pw, code) {
  const [s, iv, c] = code.split('.').map(ub64u);
  try { return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await aesKey(pw, s), c))); }
  catch { throw new Error('رمز اشتباه است یا لینک ناقص کپی شده'); }
}
const normName = s => String(s || '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\s]+/g, ' ').trim();
const uid8 = () => b64u(crypto.getRandomValues(new Uint8Array(9)));

function GitHubDB() {
  let dev = store.get('amlak-device', null);        // {repo, token, uid}
  let P = null, PSHA = null, pubSha = null;          // private.json و sha آن
  const rawBase = t => `https://raw.githubusercontent.com/${t.repo}/${t.branch}/`;
  // محل نوشتن: اگر داده‌ها هنوز به مخزن جدید منتقل نشده‌اند، همان محل قبلی
  const tgt = () => P?.pub || (P && OLD_PUB ? OLD_PUB : NEW_PUB);
  const rawUrl = (path, t = tgt()) => rawBase(t) + path;
  async function gh(path, opt = {}, tok = dev?.token) {
    const r = await fetch('https://api.github.com' + path, { ...opt, cache: 'no-store', headers: {
      Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opt.headers || {}) } })
      .catch(() => { throw new Error('اتصال به اینترنت برقرار نیست'); });
    if (!r.ok) {
      const e = new Error(r.status === 401 ? 'توکن نامعتبر یا منقضی شده است' : r.status === 403 ? 'توکن اجازه این کار را ندارد (دسترسی Contents: Read and write)' : r.status === 404 ? 'پیدا نشد' : 'خطای گیت‌هاب ' + r.status);
      e.status = r.status; throw e;
    }
    return r.status === 204 ? null : r.json();
  }
  async function getJSON(repo, path, ref) {
    try {
      const f = await gh(`/repos/${repo}/contents/${path}${ref ? '?ref=' + ref : ''}`);
      const txt = f.content ? fromB64(f.content) : fromB64((await gh(`/repos/${repo}/git/blobs/${f.sha}`)).content);
      return { data: JSON.parse(txt), sha: f.sha };
    } catch (e) { if (e.status === 404) return null; throw e; }
  }
  const putFile = (repo, path, b64content, sha, msg, branch) => gh(`/repos/${repo}/contents/${path}`, { method: 'PUT',
    body: JSON.stringify({ message: msg, content: b64content, ...(sha ? { sha } : {}), ...(branch ? { branch } : {}) }) });
  async function loadPriv() {
    const f = await getJSON(dev.repo, 'private.json');
    if (!f) throw new Error('فایل اطلاعات در مخزن خصوصی پیدا نشد');
    P = f.data; PSHA = f.sha; return P;
  }
  const me = () => P?.staff.find(s => s.id === dev?.uid) || null;
  const pubMe = u => u && (({ salt, hash, ...rest }) => rest)(u);
  const device = () => { const a = navigator.userAgent; return /iPhone|iPad/.test(a) ? 'آیفون' : /Android/.test(a) ? 'اندروید' : /Windows/.test(a) ? 'ویندوز' : /Mac/.test(a) ? 'مک' : 'دیگر'; };
  // ثبت ورود (فقط مدیر اصلی می‌بیند)؛ اگر نشد، ورود را خراب نکن
  const noteLogin = (id, action) => mutate(d => {
    const u = d.staff.find(x => x.id === id); if (!u) return;
    const at = new Date().toISOString(); u.last_login = at; u.logins = (u.logins || 0) + 1;
    d.log = [{ uid: id, at, action, device: device() }, ...(d.log || [])].slice(0, 300);
  }, 'ورود', false).catch(() => { });
  const admin = () => me()?.active && me()?.role === 'admin';
  const staff = () => me()?.active && ['admin', 'agent'].includes(me()?.role);
  const owns = l => l && (admin() || (staff() && l.agent_id === dev.uid));
  const ownerId = () => (P?.staff.find(s => s.owner) || P?.staff.filter(s => s.role === 'admin').sort((a, b) => a.created_at.localeCompare(b.created_at))[0])?.id;
  const deny = () => { throw new Error('شما اجازه این کار را ندارید'); };
  function publicView(d) {
    return { updated: new Date().toISOString(),
      listings: d.listings.filter(l => ['active', 'reserved'].includes(l.status)),
      agents: d.staff.filter(s => s.active).map(({ id, full_name, phone, bio }) => ({ id, full_name, phone, bio })),
      designs: d.designs };
  }
  async function publish() {
    const body = toB64(JSON.stringify(publicView(P)));
    for (let i = 0; i < 4; i++) {
      try {
        const t = tgt();
        if (pubSha == null) pubSha = (await gh(`/repos/${t.repo}/contents/public.json?ref=${t.branch}`).catch(e => { if (e.status === 404) return { sha: '' }; throw e; })).sha;
        pubSha = (await putFile(t.repo, 'public.json', body, pubSha || null, 'به‌روزرسانی آگهی‌ها', t.branch)).content.sha; return;
      } catch (e) { if (![409, 422].includes(e.status)) throw e; pubSha = null; }
    }
  }
  // تغییر امن: آخرین نسخه را بگیر، تغییر را اعمال کن، ذخیره کن؛ اگر کس دیگری هم‌زمان ذخیره کرد دوباره
  async function mutate(fn, msg, pub = true) {
    let res;
    for (let i = 0; ; i++) {
      await loadPriv();
      res = await fn(P);
      try { PSHA = (await putFile(dev.repo, 'private.json', toB64(JSON.stringify(P)), PSHA, msg + ' — ' + (me()?.full_name || ''))).content.sha; break; }
      catch (e) { if (![409, 422].includes(e.status) || i > 3) throw e; }
    }
    if (pub) await publish();
    return res;
  }
  async function ensureBranch(t) {
    try { await gh(`/repos/${t.repo}/git/ref/heads/${t.branch}`); return; } catch (e) { if (![404, 409].includes(e.status)) throw e; }
    const info = await gh(`/repos/${t.repo}`);
    if (info.default_branch === t.branch) {   // مخزن تازه و خالی: اولین فایل، شاخه اصلی را می‌سازد
      await putFile(t.repo, 'README.md', toB64('داده‌های عمومی اپ املاک. دستی ویرایش نکنید.\n'), null, 'شروع داده‌های املاک');
      return;
    }
    // شاخه جدا و خالی در مخزنی که از قبل فایل دارد
    const tree = await gh(`/repos/${t.repo}/git/trees`, { method: 'POST', body: JSON.stringify({ tree: [{ path: 'README.md', mode: '100644', type: 'blob', content: 'داده‌های عمومی اپ املاک.\n' }] }) });
    const commit = await gh(`/repos/${t.repo}/git/commits`, { method: 'POST', body: JSON.stringify({ message: 'شروع داده‌های املاک', tree: tree.sha, parents: [] }) });
    await gh(`/repos/${t.repo}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: 'refs/heads/' + t.branch, sha: commit.sha }) });
  }
  async function checkPubAccess(t, tok) {
    const pu = await gh(`/repos/${t.repo}`, {}, tok).catch(e => { const x = new Error('توکن به مخزن ' + t.repo.split('/')[1] + ' دسترسی ندارد'); x.status = e.status; throw x; });
    if (pu.private) throw new Error('مخزن ' + t.repo.split('/')[1] + ' باید Public باشد تا مشتری‌ها آگهی‌ها را ببینند');
    if (!pu.permissions?.push) throw new Error('توکن روی مخزن ' + t.repo.split('/')[1] + ' اجازه Contents: Read and write ندارد');
  }
  let PUB = null;
  async function loadPublic() {
    if (PUB) return PUB;
    const get = t => fetch(rawUrl('public.json', t) + '?t=' + Math.floor(Date.now() / 60000), { cache: 'no-store' }).catch(() => null);
    let r = await get(NEW_PUB);
    if (r && !r.ok && OLD_PUB) r = await get(OLD_PUB);   // هنوز منتقل نشده
    if (!r) throw new Error('اتصال به اینترنت برقرار نیست');
    PUB = r.ok ? await r.json() : { listings: [], agents: [], designs: [] };
    return PUB;
  }
  const clone = x => JSON.parse(JSON.stringify(x));
  return {
    caps: { leads: false, views: false, signup: false, github: true },
    deviceLinked: () => !!dev?.token,
    async init() { if (dev?.token) { try { await loadPriv(); } catch (e) { if (e.status === 401) { dev = null; store.set('amlak-device', null); } else throw e; } } },
    async me() { const m = me(); return dev?.uid && m ? { ...clone(pubMe(m)), owner: m.id === ownerId() } : null; },
    isOwner: () => !!dev?.uid && dev.uid === ownerId(),
    async activity() { if (dev?.uid !== ownerId()) deny(); await loadPriv(); return { staff: P.staff.map(s => clone(pubMe(s))), log: clone(P.log || []) }; },
    // دستگاهی که با «رمز مخزن» وصل شده (مدیر) می‌تواند حساب مدیر تازه بسازد؛ دستگاهی که با لینک دعوت وصل شده نه
    deviceKind: () => dev?.kind || (P?.staff.find(s => s.id === dev?.uid)?.role === 'admin' ? 'admin' : 'agent'),
    // ورود با نوشتن نام (بدون نمایش فهرست کارمندان)
    async loginByName(name, pw, allowCreate) {
      await loadPriv();
      const u = P.staff.find(s => normName(s.full_name) === normName(name));
      if (u) {
        if (!await checkPw(u, pw)) throw new Error('نام یا رمز اشتباه است');
        if (!u.active) throw new Error('حساب شما غیرفعال شده است');
        if (!dev.kind) dev.kind = u.role === 'admin' ? 'admin' : 'agent';
        dev.uid = u.id; store.set('amlak-device', dev); await noteLogin(u.id, 'login'); return 'in';
      }
      if (!allowCreate || this.deviceKind() !== 'admin') throw new Error('نام یا رمز اشتباه است');
      if (pw.length < 6) throw new Error('رمز باید حداقل ۶ حرف باشد');
      const h = await hashPw(pw), id = uid8();
      await mutate(d => {
        if (d.staff.some(s => normName(s.full_name) === normName(name))) throw new Error('این نام همین الان ثبت شد؛ دوباره وارد شوید');
        d.staff.push({ id, full_name: name.trim(), phone: '', bio: '', role: 'admin', active: true, ...h, created_at: new Date().toISOString() });
      }, 'مدیر جدید');
      dev.uid = id; store.set('amlak-device', dev); await noteLogin(id, 'created'); return 'created';
    },
    nameExists: name => !!P?.staff.some(s => normName(s.full_name) === normName(name)),
    async signIn(id, pw) {
      await loadPriv(); const u = P.staff.find(s => s.id === id);
      if (!u || !await checkPw(u, pw)) throw new Error('رمز عبور اشتباه است');
      if (!u.active) throw new Error('حساب شما غیرفعال شده است');
      dev.uid = id; store.set('amlak-device', dev);
    },
    async signOut() { if (dev) { dev.uid = null; store.set('amlak-device', dev); } },
    forgetDevice() { dev = null; P = null; store.set('amlak-device', null); },
    // راه‌اندازی اولیه توسط ادمین روی دستگاه خودش
    async setup(repo, token, admin) {
      repo = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/+$/, ''); token = token.trim();
      if (repo && !repo.includes('/')) repo += '/amlak-private';
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('نام مخزن را به شکل نام‌کاربری/نام‌مخزن بنویسید');
      const pr = await gh(`/repos/${repo}`, {}, token);
      if (!pr.private) throw new Error('مخزن اطلاعات باید Private (خصوصی) باشد');
      if (!pr.permissions?.push) throw new Error('توکن روی مخزن خصوصی اجازه Contents: Read and write ندارد');
      dev = { repo, token, uid: null, kind: 'admin' };
      const f = await getJSON(repo, 'private.json');
      if (f) { P = f.data; PSHA = f.sha; store.set('amlak-device', dev); return 'exists'; }
      await checkPubAccess(NEW_PUB, token);
      if (!admin) return 'new';
      const h = await hashPw(admin.pw);
      const u = { id: uid8(), full_name: admin.full_name, phone: admin.phone, bio: 'مدیر بنگاه', role: 'admin', owner: true, active: true, ...h, created_at: new Date().toISOString() };
      P = { v: 1, seq: 100, staff: [u], listings: [], priv: {}, designs: [], pub: NEW_PUB };
      await ensureBranch(NEW_PUB);
      PSHA = (await putFile(repo, 'private.json', toB64(JSON.stringify(P)), null, 'راه‌اندازی سامانه املاک')).content.sha;
      await publish();
      dev.uid = u.id; store.set('amlak-device', dev); return 'created';
    },
    async joinWithInvite(code, pw) {
      const inv = await openInvite(pw, code);
      dev = { repo: inv.repo, token: inv.token, uid: null, kind: 'agent' };
      try { await loadPriv(); } catch (e) { dev = null; throw e.status === 401 ? new Error('این لینک دعوت باطل شده است؛ از مدیر لینک تازه بگیرید') : e; }
      store.set('amlak-device', dev);
      await this.signIn(inv.uid, pw); await noteLogin(inv.uid, 'join');
    },
    async makeInvite(id, pw) { if (!admin()) deny(); return sealInvite(pw, { repo: dev.repo, token: dev.token, uid: id }); },
    async setPassword(pw, id = dev.uid) {
      if (id !== dev.uid && !admin()) deny();
      const h = await hashPw(pw);
      await mutate(d => Object.assign(d.staff.find(s => s.id === id), h), 'تغییر رمز', false);
    },
    async addStaff(p) {
      if (!admin()) deny();
      if (P.staff.some(s => normName(s.full_name) === normName(p.full_name))) throw new Error('این نام قبلا ثبت شده است؛ نام را کمی متفاوت بنویسید (مثلا با نام خانوادگی)');
      const h = await hashPw(p.pw), u = { id: uid8(), full_name: p.full_name, phone: p.phone, bio: '', role: dev.uid === ownerId() && p.role === 'admin' ? 'admin' : 'agent', active: true, ...h, created_at: new Date().toISOString() };
      await mutate(d => { d.staff.push(u); }, 'افزودن مشاور ' + p.full_name); return u.id;
    },
    async listings() {
      if (!P || !dev?.uid) return clone((await loadPublic()).listings);
      await loadPriv();
      return clone(P.listings.filter(l => ['active', 'reserved'].includes(l.status) || owns(l)).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    },
    async saveListing(l) {
      if (!staff()) deny();
      return clone(await mutate(d => {
        const t = new Date().toISOString(), isA = d.staff.find(s => s.id === dev.uid)?.role === 'admin';
        if (l.id) {
          const i = d.listings.findIndex(x => x.id === l.id), old = d.listings[i];
          if (!old || !(isA || old.agent_id === dev.uid)) deny();
          return d.listings[i] = { ...old, ...l, updated_at: t, ...(isA ? {} : { agent_id: old.agent_id, featured: old.featured, verified: old.verified }) };
        }
        const n = { ...l, id: ++d.seq, views: 0, created_at: t, updated_at: t, ...(isA ? { agent_id: l.agent_id || dev.uid } : { agent_id: dev.uid, featured: false, verified: false }) };
        d.listings.push(n); return n;
      }, l.id ? 'ویرایش آگهی ' + l.id : 'آگهی جدید'));
    },
    async deleteListing(id) {
      await mutate(d => { if (!owns(d.listings.find(x => x.id === id))) deny(); d.listings = d.listings.filter(x => x.id !== id); delete d.priv[id]; }, 'حذف آگهی ' + id);
    },
    async getPrivate(id) { if (!owns(P.listings.find(x => x.id === id))) deny(); return clone(P.priv[id] || null); },
    async savePrivate(id, p) {
      const empty = !Object.values(p).some(Boolean);
      if (empty && !P.priv[id]) return;
      await mutate(d => { if (!owns(d.listings.find(x => x.id === id))) deny(); d.priv[id] = p; }, 'اطلاعات محرمانه آگهی ' + id, false);
    },
    async incViews() { },
    async agents() { return P && dev?.uid ? clone(publicView(P).agents) : clone((await loadPublic()).agents); },
    // مدیر اصلی از دید بقیه ادمین‌ها پنهان است
    async profiles() { if (!admin()) return [clone(pubMe(me()))]; const o = ownerId(); return P.staff.filter(s => dev.uid === o || s.id === dev.uid || s.role !== 'admin').map(s => clone(pubMe(s))); },
    async updateProfile(id, patch) {
      if (id !== dev.uid && !admin()) deny();
      if (id === ownerId() && dev.uid !== id) deny();
      if (dev.uid !== ownerId()) {   // فقط مدیر اصلی روی ادمین‌ها و نقش ادمین اختیار دارد
        const t = P.staff.find(s => s.id === id);
        if (id !== dev.uid && t?.role === 'admin') deny();
        if (patch.role === 'admin') deny();
      }
      if (patch.full_name && P.staff.some(s => s.id !== id && normName(s.full_name) === normName(patch.full_name))) throw new Error('این نام قبلا برای کس دیگری ثبت شده است');
      if (!admin()) { delete patch.role; delete patch.active; }
      if (id === dev.uid) { delete patch.role; delete patch.active; }
      await mutate(d => Object.assign(d.staff.find(s => s.id === id), patch), 'ویرایش پروفایل');
    },
    async designs() { return P && dev?.uid ? clone(P.designs) : clone((await loadPublic()).designs || []); },
    async saveDesign(x) {
      if (!admin()) deny();
      return clone(await mutate(d => {
        if (x.id) { const i = d.designs.findIndex(y => y.id === x.id); return d.designs[i] = { ...d.designs[i], ...x }; }
        const n = { ...x, id: ++d.seq, created_at: new Date().toISOString() }; d.designs.unshift(n); return n;
      }, 'نمونه‌کار طراحی'));
    },
    async deleteDesign(id) { if (!admin()) deny(); await mutate(d => { d.designs = d.designs.filter(y => y.id !== id); }, 'حذف نمونه‌کار'); },
    async addLead() { }, async leads() { return []; }, async updateLead() { },
    // «فایل‌های دیوار»: لینک‌هایی که کارمندان پیدا می‌کنند، برای همه کارمندان
    nameOf(id) { const u = P?.staff.find(x => x.id === id); if (!u) return '—'; return u.role === 'admin' && id !== dev.uid && dev.uid !== ownerId() ? 'مدیر' : u.full_name; },
    async divarList() { if (!staff()) deny(); await loadPriv(); return clone({ items: P.divar || [], searches: P.divarSearches || [] }); },
    async divarAdd(x) {
      if (!staff()) deny();
      return clone(await mutate(d => {
        d.divar = d.divar || []; const tok = Divar.tokenOf(x.url);
        if (tok && d.divar.some(y => Divar.tokenOf(y.url) === tok)) throw new Error('این آگهی قبلا در فهرست هست');
        const n = { ...x, id: uid8(), by: dev.uid, at: new Date().toISOString(), status: 'new' };
        d.divar = [n, ...d.divar].slice(0, 500); return n;
      }, 'فایل دیوار', false));
    },
    async divarUpdate(id, patch) { if (!staff()) deny(); await mutate(d => { const x = (d.divar || []).find(y => y.id === id); if (x) Object.assign(x, patch, { by_status: dev.uid, at_status: new Date().toISOString() }); }, 'فایل دیوار', false); },
    async divarDelete(id) { await mutate(d => { const x = (d.divar || []).find(y => y.id === id); if (!x) return; if (!admin() && x.by !== dev.uid) deny(); d.divar = d.divar.filter(y => y.id !== id); }, 'حذف فایل دیوار', false); },
    async divarSaveSearches(list) { if (!admin()) deny(); await mutate(d => { d.divarSearches = list; }, 'جستجوهای دیوار', false); },
    // حجم مخازن (گیت‌هاب با کمی تأخیر به‌روز می‌کند)
    async storage() {
      if (!admin()) return [];
      const t = tgt(), list = [[t.repo, 'آگهی‌ها و عکس‌ها'], [dev.repo, 'اطلاعات محرمانه']];
      const r = await Promise.all(list.map(([repo, label]) => gh(`/repos/${repo}`).then(x => ({ label, kb: x.size || 0 }), () => null)));
      const photos = new Set(); P.listings.forEach(l => (l.images || []).forEach(u => photos.add(u))); P.designs.forEach(d => (d.images || []).forEach(u => photos.add(u)));
      return { repos: r.filter(Boolean), photos: photos.size };
    },
    needsMigration: () => !!(P && dev?.uid && admin() && !P.pub && OLD_PUB),
    // انتقال یک‌باره عکس‌ها و آگهی‌های عمومی از مخزن سایت به مخزن جدا
    async migrate(progress = () => { }) {
      if (!admin()) deny();
      const t = NEW_PUB, oldBase = rawBase(OLD_PUB), newBase = rawBase(t);
      await checkPubAccess(t);
      await ensureBranch(t);
      await loadPriv();
      const urls = new Set();
      const add = u => { if (typeof u === 'string' && u.startsWith(oldBase)) urls.add(u); };
      P.listings.forEach(l => (l.images || []).forEach(add));
      P.designs.forEach(d => { (d.images || []).forEach(add); add(d.before_image); });
      let i = 0;
      for (const u of urls) {
        progress(++i, urls.size);
        const path = u.slice(oldBase.length);
        const there = await gh(`/repos/${t.repo}/contents/${path}?ref=${t.branch}`).then(() => true, e => { if (e.status === 404) return false; throw e; });
        if (there) continue;
        const f = await gh(`/repos/${OLD_PUB.repo}/contents/${path}?ref=${OLD_PUB.branch}`).catch(e => { if (e.status === 404) return null; throw e; });
        if (!f) continue;
        const content = (f.content || (await gh(`/repos/${OLD_PUB.repo}/git/blobs/${f.sha}`)).content).replace(/\s/g, '');
        await putFile(t.repo, path, content, null, 'انتقال عکس', t.branch);
      }
      const fix = u => typeof u === 'string' && u.startsWith(oldBase) ? newBase + u.slice(oldBase.length) : u;
      pubSha = null;
      await mutate(d => {
        d.listings.forEach(l => { l.images = (l.images || []).map(fix); });
        d.designs.forEach(x => { x.images = (x.images || []).map(fix); x.before_image = fix(x.before_image); });
        d.pub = t;
      }, 'انتقال عکس‌ها به مخزن جدا');
      // پاک کردن شاخه قدیمی از مخزن سایت
      await gh(`/repos/${OLD_PUB.repo}/git/refs/heads/${OLD_PUB.branch}`, { method: 'DELETE' }).catch(() => { });
      return urls.size;
    },
    async upload(file) {
      if (!staff()) deny();
      const blob = await compress(file, 1280, .74);
      const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
      const path = `img/${new Date().toISOString().slice(0, 7)}/${uid8()}.jpg`;
      const t = tgt();
      await putFile(t.repo, path, data, null, 'عکس', t.branch);
      return rawUrl(path, t);
    }
  };
}

/* =====================================================================
   لایه داده — حالت نمایشی (همان قوانین دسترسی، در مرورگر)
   ===================================================================== */
function DemoDB() {
  const KEY = 'amlak-demo-v1';
  let D = store.get(KEY, null), uid = store.get('amlak-demo-user', null);
  const save = () => { if (!store.set(KEY, D)) throw new Error('حافظه حالت نمایشی پر شد؛ عکس کمتری بگذارید'); };
  const me = () => D.profiles.find(p => p.id === uid && p.active) || null;
  const isAdmin = () => me()?.role === 'admin';
  const isStaff = () => ['admin', 'agent'].includes(me()?.role);
  const owns = lid => { const l = D.listings.find(x => x.id === lid); return l && (isAdmin() || (isStaff() && l.agent_id === uid)); };
  const deny = () => { throw new Error('شما اجازه این کار را ندارید'); };
  const clone = x => JSON.parse(JSON.stringify(x));
  const now = d => new Date(Date.now() - d * 86400000).toISOString();
  function seed() {
    const P = (id, full_name, phone, role, email, bio = '') => ({ id, full_name, phone, role, email, bio, active: true, created_at: now(60) });
    const L = (id, agent_id, deal, ptype, title, district, o) => ({
      id, agent_id, deal, ptype, title, city: 'تهران', district, price: null, deposit: null, rent: null, area: null, land_area: null,
      rooms: null, floor: null, floors: null, year_built: null, features: [], description: '', images: [`ph:${id}`, `ph:${id + 3}`, `ph:${id + 7}`],
      status: 'active', featured: false, verified: false, views: Math.floor(Math.random() * 300), created_at: now(id), updated_at: now(id), ...o
    });
    return {
      seq: 100,
      profiles: [P('u-admin', 'مدیر بنگاه', '09120000000', 'admin', 'admin@demo', 'مدیر و مشاور ارشد'),
        P('u-a1', 'سارا محمدی', '09121111111', 'agent', 'sara@demo', 'متخصص آپارتمان‌های شمال تهران'),
        P('u-a2', 'رضا کریمی', '09122222222', 'agent', 'reza@demo', 'اجاره و رهن، مناطق غرب'),
        P('u-p1', 'علی نوری', '09123333333', 'pending', 'ali@demo')],
      listings: [
        L(1, 'u-a1', 'sale', 'apartment', 'آپارتمان ۱۲۰ متری نوساز با ویو ابدی', 'سعادت‌آباد', { price: 14500000000, area: 120, rooms: 2, floor: 6, floors: 8, year_built: 1402, features: ['پارکینگ', 'آسانسور', 'انباری', 'بالکن', 'لابی', 'نوساز'], featured: true, verified: true, description: 'واحد شرقی، نورگیر عالی\nکابینت های‌گلاس، کف سرامیک\nمشاعات لوکس با لابی و سرایدار' }),
        L(2, 'u-a1', 'sale', 'villa', 'خانه ویلایی ۲ طبقه با حیاط', 'نیاوران', { price: 68000000000, area: 340, land_area: 400, rooms: 4, floors: 2, year_built: 1395, features: ['پارکینگ', 'استخر', 'انباری', 'سند تک‌برگ'], verified: true, description: 'حیاط ۲۰۰ متری با درختان قدیمی\nاستخر و سونا در زیرزمین' }),
        L(3, 'u-a2', 'rent', 'apartment', 'آپارتمان ۸۵ متری نزدیک مترو', 'صادقیه', { deposit: 600000000, rent: 18000000, area: 85, rooms: 2, floor: 3, floors: 5, year_built: 1398, features: ['پارکینگ', 'آسانسور', 'دسترسی به مترو'], description: 'مناسب زوج جوان، تخلیه اول ماه' }),
        L(4, 'u-a2', 'rent', 'office', 'دفتر اداری ۶۰ متری موقعیت اداری', 'ستارخان', { deposit: 400000000, rent: 25000000, area: 60, floor: 2, floors: 4, features: ['آسانسور', 'پارکینگ'], status: 'reserved' }),
        L(5, 'u-admin', 'sale', 'commercial', 'مغازه ۳۵ متری بر خیابان اصلی', 'پونک', { price: 9200000000, area: 35, year_built: 1390, features: ['سند تک‌برگ'] }),
        L(6, 'u-a1', 'rent', 'apartment', 'آپارتمان ۱۵۰ متری مبله لوکس', 'زعفرانیه', { deposit: 3000000000, rent: 60000000, area: 150, rooms: 3, floor: 4, floors: 6, year_built: 1400, features: ['پارکینگ', 'آسانسور', 'مبله', 'لابی', 'سونا و جکوزی'], featured: true, verified: true }),
        L(7, 'u-a2', 'sale', 'land', 'زمین ۵۰۰ متری با پروانه ساخت', 'لواسان', { price: 32000000000, land_area: 500, features: ['سند تک‌برگ'] }),
        L(8, 'u-a2', 'rent', 'apartment', 'آپارتمان ۷۰ متری رهن کامل', 'شهرک غرب', { deposit: 1500000000, rent: 0, area: 70, rooms: 1, floor: 1, floors: 4, year_built: 1385, features: ['پارکینگ', 'انباری'] }),
        L(9, 'u-a1', 'sale', 'apartment', 'آپارتمان ۹۵ متری (فروخته شده)', 'ونک', { price: 11000000000, area: 95, rooms: 2, status: 'sold' })
      ],
      priv: [{ listing_id: 1, owner_name: 'آقای احمدی', owner_phone: '09125555555', exact_address: 'سعادت‌آباد، خیابان سرو غربی، پلاک ۱۲، واحد ۶', notes: 'مالک برای قیمت کمی انعطاف دارد' },
        { listing_id: 3, owner_name: 'خانم رضایی', owner_phone: '09126666666', exact_address: 'صادقیه، فلکه دوم، کوچه نهم، پلاک ۴', notes: '' }],
      leads: [{ id: 1, listing_id: 1, name: 'مریم', phone: '09351234567', message: 'برای بازدید پنجشنبه عصر وقت دارید؟', status: 'new', created_at: now(0.2) },
        { id: 2, listing_id: 3, name: 'حسین', phone: '09191234567', message: 'آیا رهن بیشتر و اجاره کمتر ممکن است؟', status: 'contacted', created_at: now(2) }],
      designs: [
        { id: 1, title: 'بازطراحی پذیرایی آپارتمان ۱۴۰ متری', style: 'مدرن', space: 'پذیرایی', city: 'تهران، الهیه', area: 45, description: 'تغییر نورپردازی، دیوارپوش چوبی و مبلمان سفارشی.\nمدت اجرا: ۶ هفته', images: ['ph:21:بعد', 'ph:22', 'ph:23'], before_image: 'ph:24:قبل', created_at: now(3) },
        { id: 2, title: 'آشپزخانه جزیره‌ای', style: 'مینیمال', space: 'آشپزخانه', city: 'تهران، پاسداران', area: 18, description: 'کابینت های‌گلاس مات، صفحه کوارتز و جزیره با صندلی بار.', images: ['ph:31', 'ph:32'], before_image: null, created_at: now(10) },
        { id: 3, title: 'اتاق خواب مستر', style: 'کلاسیک', space: 'اتاق خواب', city: 'کرج', area: 22, description: 'کاغذدیواری، قاب‌بندی گچی و نورپردازی مخفی.', images: ['ph:41', 'ph:42', 'ph:43'], created_at: now(20) }
      ]
    };
  }
  if (!D) { D = seed(); save(); }
  return {
    caps: { leads: true, views: true, signup: false, github: false },
    deviceLinked: () => true,
    async init() { },
    async me() { return me() ? clone(me()) : (uid && D.profiles.find(p => p.id === uid) ? clone(D.profiles.find(p => p.id === uid)) : null); },
    async signIn(email) {
      const p = D.profiles.find(x => x.email === email.trim().toLowerCase());
      if (!p) throw new Error('ایمیل یا رمز عبور اشتباه است');
      uid = p.id; store.set('amlak-demo-user', uid);
    },
    async signUp(email, pw, full_name, phone) {
      email = email.trim().toLowerCase();
      if (D.profiles.some(p => p.email === email)) throw new Error('این ایمیل قبلا ثبت‌نام کرده است');
      if (pw.length < 6) throw new Error('رمز عبور باید حداقل ۶ کاراکتر باشد');
      const p = { id: 'u-' + (++D.seq), email, full_name, phone, bio: '', role: D.profiles.some(x => x.role === 'admin') ? 'pending' : 'admin', active: true, created_at: new Date().toISOString() };
      D.profiles.push(p); save(); uid = p.id; store.set('amlak-demo-user', uid); return true;
    },
    async signOut() { uid = null; store.set('amlak-demo-user', null); },
    async setPassword() { },
    async listings() {
      return clone(D.listings.filter(l => ['active', 'reserved'].includes(l.status) || isAdmin() || (isStaff() && l.agent_id === uid))
        .sort((a, b) => b.created_at.localeCompare(a.created_at)));
    },
    async saveListing(l) {
      if (!isStaff()) deny();
      const t = new Date().toISOString();
      if (l.id) {
        const i = D.listings.findIndex(x => x.id === l.id); if (i < 0 || !owns(l.id)) deny();
        const old = D.listings[i];
        D.listings[i] = { ...old, ...l, updated_at: t, views: old.views, ...(isAdmin() ? {} : { agent_id: old.agent_id, featured: old.featured, verified: old.verified }) };
        save(); return clone(D.listings[i]);
      }
      const n = { ...l, id: ++D.seq, views: 0, created_at: t, updated_at: t, ...(isAdmin() ? { agent_id: l.agent_id || uid } : { agent_id: uid, featured: false, verified: false }) };
      D.listings.push(n); save(); return clone(n);
    },
    async deleteListing(id) { if (!owns(id)) deny(); D.listings = D.listings.filter(l => l.id !== id); D.priv = D.priv.filter(p => p.listing_id !== id); D.leads = D.leads.filter(x => x.listing_id !== id); save(); },
    async getPrivate(id) { if (!owns(id)) deny(); return clone(D.priv.find(p => p.listing_id === id) || null); },
    async savePrivate(id, p) { if (!owns(id)) deny(); D.priv = D.priv.filter(x => x.listing_id !== id); D.priv.push({ ...p, listing_id: id }); save(); },
    async incViews(id) { const l = D.listings.find(x => x.id === id); if (l) { l.views++; save(); } },
    async agents() { return clone(D.profiles.filter(p => ['admin', 'agent'].includes(p.role) && p.active).map(({ id, full_name, phone, bio }) => ({ id, full_name, phone, bio }))); },
    async profiles() { if (!isAdmin()) return clone(D.profiles.filter(p => p.id === uid)); return clone(D.profiles); },
    async updateProfile(id, patch) {
      if (id !== uid && !isAdmin()) deny();
      const p = D.profiles.find(x => x.id === id);
      if (!isAdmin()) { delete patch.role; delete patch.active; }
      Object.assign(p, patch); save();
    },
    async designs() { return clone(D.designs.sort((a, b) => b.created_at.localeCompare(a.created_at))); },
    async saveDesign(d) {
      if (!isAdmin()) deny();
      if (d.id) { const i = D.designs.findIndex(x => x.id === d.id); D.designs[i] = { ...D.designs[i], ...d }; save(); return clone(D.designs[i]); }
      const n = { ...d, id: ++D.seq, created_at: new Date().toISOString() }; D.designs.push(n); save(); return clone(n);
    },
    async deleteDesign(id) { if (!isAdmin()) deny(); D.designs = D.designs.filter(d => d.id !== id); save(); },
    async addLead(l) { D.leads.push({ ...l, id: ++D.seq, status: 'new', created_at: new Date().toISOString() }); save(); },
    async leads() { return clone(D.leads.filter(x => owns(x.listing_id)).sort((a, b) => b.created_at.localeCompare(a.created_at))); },
    async updateLead(id, patch) { const x = D.leads.find(l => l.id === id); if (!x || !owns(x.listing_id)) deny(); Object.assign(x, patch); save(); },
    async upload(file) {
      if (!isStaff()) deny();
      const blob = await compress(file, 900, .7);
      return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    },
    nameOf(id) { return D.profiles.find(p => p.id === id)?.full_name || '—'; },
    async divarList() { if (!isStaff()) deny(); return clone({ items: D.divar || [], searches: D.divarSearches || [{ name: 'آپارتمان فروشی تهران — فقط شخصی', url: 'https://divar.ir/s/tehran/buy-apartment?user_type=personal' }] }); },
    async divarAdd(x) {
      if (!isStaff()) deny(); D.divar = D.divar || []; const tok = Divar.tokenOf(x.url);
      if (tok && D.divar.some(y => Divar.tokenOf(y.url) === tok)) throw new Error('این آگهی قبلا در فهرست هست');
      const n = { ...x, id: 'dv' + (++D.seq), by: uid, at: new Date().toISOString(), status: 'new' }; D.divar.unshift(n); save(); return clone(n);
    },
    async divarUpdate(id, patch) { const x = (D.divar || []).find(y => y.id === id); if (x) { Object.assign(x, patch); save(); } },
    async divarDelete(id) { const x = (D.divar || []).find(y => y.id === id); if (x && !isAdmin() && x.by !== uid) deny(); D.divar = (D.divar || []).filter(y => y.id !== id); save(); },
    async divarSaveSearches(list) { if (!isAdmin()) deny(); D.divarSearches = list; save(); },
    reset() { localStorage.removeItem(KEY); localStorage.removeItem('amlak-demo-user'); }
  };
}

/* =====================================================================
   وضعیت و مسیریابی
   ===================================================================== */
const DB = DEMO ? DemoDB() : GitHubDB();
const S = { me: null, listings: null, agents: null, designs: null, filters: store.get('amlak-filters', {}) };
const isStaff = () => !!S.me && S.me.active && ['admin', 'agent'].includes(S.me.role);
const isAdmin = () => !!S.me && S.me.active && S.me.role === 'admin';
const canEdit = l => isAdmin() || (isStaff() && l.agent_id === S.me.id);
const favs = () => store.get('amlak-favs', []);
const agentOf = id => (S.agents || []).find(a => a.id === id);

async function loadListings(force) { if (force || !S.listings) S.listings = await DB.listings(); return S.listings; }
async function loadAgents(force) { if (force || !S.agents) S.agents = await DB.agents(); return S.agents; }
async function loadDesigns(force) { if (force || !S.designs) S.designs = await DB.designs(); return S.designs; }
const invalidate = () => { S.listings = null; S.agents = null; };

function go(h) { if (location.hash === '#' + h) route(); else location.hash = h; }
const view = () => $('#view');

function renderChrome(name) {
  document.title = (CFG.name || 'املاک');
  $('#appName').textContent = CFG.name || 'املاک';
  $('#appTag').textContent = CFG.tagline || '';
  $('#who').innerHTML = S.me ? `<b>${esc(S.me.full_name || S.me.email)}</b><br>${ROLES[S.me.role] || ''}` : '';
  const fb = $('#favBtn'); if (fb) { fb.innerHTML = name === 'fav' ? I.heart : I.heartO; fb.style.color = name === 'fav' ? '#e8475a' : ''; }
  const tabs = [['sale', 'فروش', I.sale], ['rent', 'اجاره', I.rent], ['misc', 'متفرقه', I.misc], ['designs', 'طراحی‌ها', I.design],
    S.me ? ['panel', 'پنل', I.panel] : ['login', 'مشاوران', I.user]];
  $('#tabs').innerHTML = tabs.map(([h, t, ic]) => `<a href="#${h}" class="${name === h ? 'on' : ''}">${ic}<span>${t}</span></a>`).join('');
  const db = $('#demoBar');
  db.hidden = !DEMO;
  if (DEMO) db.innerHTML = 'حالت نمایشی: اطلاعات فقط در همین مرورگر است. نسخه واقعی را بدون <code>?demo</code> در آدرس باز کنید. <button class="btn sm ghost" id="demoReset">بازنشانی داده‌های نمونه</button>';
  $('#demoReset')?.addEventListener('click', () => { if (confirm('همه داده‌های نمایشی پاک و از نو ساخته شود؟')) { DB.reset(); location.reload(); } });
}

async function route() {
  const [name, arg] = (location.hash.slice(1) || 'sale').split('/');
  renderChrome(['l', 'agent'].includes(name) ? (S.lastList || 'sale') : name === 'd' ? 'designs' : ['edit', 'dedit'].includes(name) ? 'panel' : name);
  window.scrollTo(0, 0);
  const v = view();
  v.innerHTML = '<div class="spin"></div>';
  try {
    switch (name) {
      case 'sale': case 'rent': case 'misc': S.lastList = name; await viewList(name); break;
      case 'l': await viewListing(+arg); break;
      case 'agent': await viewAgent(arg); break;
      case 'designs': await viewDesigns(); break;
      case 'd': await viewDesign(+arg); break;
      case 'fav': S.lastList = 'fav'; await viewFav(); break;
      case 'login': S.me ? go('panel') : viewLogin(); break;
      case 'join': S.me ? go('panel') : viewJoin(arg || ''); break;
      case 'panel': isStaff() ? await viewPanel(arg) : S.me ? viewPending() : go('login'); break;
      case 'edit': isStaff() ? await viewEdit(arg) : go('login'); break;
      case 'dedit': isAdmin() ? await viewDesignEdit(arg) : go('designs'); break;
      default: go('sale');
    }
  } catch (e) {
    console.error(e);
    v.innerHTML = `<div class="empty">${I.empty}<p>${esc(e.message || e)}</p><button class="btn" onclick="location.reload()">تلاش دوباره</button></div>`;
  }
}

/* =====================================================================
   مشتری: فهرست آگهی‌ها
   ===================================================================== */
const DEF_F = { q: '', kind: '', ptype: '', max: '', maxRent: '', minArea: '', rooms: '', feats: [], hideRes: false, sort: 'new' };
function priceLine(l) {
  if (l.deal !== 'rent') return `<div class="price num">${money(l.price)}</div>`;
  return `<div class="price num">رهن ${money(l.deposit, false)} <small>|</small> اجاره ${l.rent ? money(l.rent, false) : '<small>رهن کامل</small>'}</div>`;
}
function metaLine(l) {
  return [l.area && `${fa(l.area)} متر`, l.land_area && !l.area && `زمین ${fa(l.land_area)} متر`, l.rooms != null && l.rooms !== '' && (l.rooms ? `${fa(l.rooms)} خواب` : 'بدون اتاق'),
    l.floor != null && l.floor !== '' && `طبقه ${fa(l.floor)}`, l.year_built && `ساخت ${faStr(l.year_built)}`].filter(Boolean).map(x => `<span>${x}</span>`).join('');
}
function card(l) {
  const f = favs().includes(l.id), dim = !['active', 'reserved'].includes(l.status);
  return `<a class="lc${dim ? ' dim' : ''}" href="#l/${l.id}">
    <div class="ph"><img loading="lazy" src="${esc(cover(l))}" alt="">
      <div class="badges">${l.deal === 'misc' ? `<span class="tag">${esc(dealLabel(l))}</span>` : ''}${l.featured ? '<span class="tag gold">ویژه</span>' : ''}${l.verified ? '<span class="tag">✓ تأیید شده</span>' : ''}${l.status !== 'active' ? `<span class="tag">${STATUS[l.status][0]}</span>` : ''}</div>
      <button class="fav${f ? ' on' : ''}" data-fav="${l.id}" aria-label="نشان کردن">${f ? I.heart : I.heartO}</button></div>
    <div class="bd">${priceLine(l)}<div class="t">${esc(l.title)}</div>
      <div class="meta">${metaLine(l)}</div>
      <div class="loc">${esc([l.district, l.city].filter(Boolean).join('، '))} · ${PTYPES[l.ptype] || ''}</div></div></a>`;
}
function toggleFav(id) {
  const f = favs(), i = f.indexOf(id);
  i < 0 ? f.unshift(id) : f.splice(i, 1); store.set('amlak-favs', f);
  toast(i < 0 ? 'به نشان‌شده‌ها اضافه شد' : 'از نشان‌شده‌ها حذف شد', 1500);
  return i < 0;
}
function bindFav(root) {
  $$('[data-fav]', root).forEach(b => b.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const on = toggleFav(+b.dataset.fav); b.classList.toggle('on', on); b.innerHTML = on ? I.heart : I.heartO;
  }));
}
function opts(list, val, empty) {
  return (empty != null ? `<option value="">${empty}</option>` : '') +
    list.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(t)}</option>`).join('');
}

async function viewList(deal) {
  const all = await loadListings(); await loadAgents();
  const F = S.filters[deal] = { ...DEF_F, ...(S.filters[deal] || {}) };
  const sale = deal !== 'rent';
  const maxOpts = sale ? [2, 3, 5, 8, 12, 20, 40, 80].map(b => [b * 1e9, `تا ${fa(b)} میلیارد`])
    : [100, 300, 500, 1000, 2000, 5000].map(m => [m * 1e6, m >= 1000 ? `رهن تا ${fa(m / 1000)} میلیارد` : `رهن تا ${fa(m)} میلیون`]);
  const nActive = ['ptype', 'max', 'maxRent', 'minArea', 'rooms'].filter(k => F[k]).length + F.feats.length + (F.hideRes ? 1 : 0);
  view().innerHTML = `
    <h2>${deal === 'sale' ? 'خرید ملک' : deal === 'rent' ? 'رهن و اجاره' : 'متفرقه'}</h2>${deal === 'misc' ? '<p class="muted small" style="margin:0 0 6px">پیش‌فروش، معاوضه، مشارکت در ساخت، کلنگی و سرقفلی</p>' : ''}
    <div class="search"><input id="q" type="search" placeholder="جستجوی محله، عنوان یا کد آگهی…" value="${esc(F.q)}">
      <button class="iconbtn" id="tgl" aria-label="فیلترها" style="${nActive ? 'border-color:var(--accent);color:var(--accent)' : ''}">${I.filter}</button></div>
    ${deal === 'misc' ? `<div class="chips" style="margin-bottom:10px" id="kinds">${[['', 'همه'], ...Object.entries(MISC_KINDS)].map(([k, t]) => `<button class="chip${F.kind === k ? ' on' : ''}" data-k="${k}">${t}</button>`).join('')}</div>` : ''}
    <div class="chips" style="margin-bottom:10px" id="ptypes">${[['', 'همه'], ...Object.entries(PTYPES)].map(([k, t]) => `<button class="chip${F.ptype === k ? ' on' : ''}" data-p="${k}">${t}</button>`).join('')}</div>
    <div class="card filters" id="flt" ${S.showF ? '' : 'hidden'}>
      <div class="grid2">
        <label class="f"><span>${sale ? 'حداکثر قیمت' : 'حداکثر رهن'}</span><select id="max">${opts(maxOpts, F.max, 'فرقی نمی‌کند')}</select></label>
        ${sale ? '' : `<label class="f"><span>حداکثر اجاره ماهانه</span><select id="maxRent">${opts([0, 5, 10, 20, 40, 80].map(m => [m ? m * 1e6 : -1, m ? `تا ${fa(m)} میلیون` : 'فقط رهن کامل']), F.maxRent, 'فرقی نمی‌کند')}</select></label>`}
        <label class="f"><span>حداقل متراژ</span><select id="minArea">${opts([50, 75, 100, 150, 200, 300].map(a => [a, `از ${fa(a)} متر`]), F.minArea, 'فرقی نمی‌کند')}</select></label>
        <label class="f"><span>تعداد خواب</span><select id="rooms">${opts([[1, '۱ به بالا'], [2, '۲ به بالا'], [3, '۳ به بالا'], [4, '۴ به بالا']], F.rooms, 'فرقی نمی‌کند')}</select></label>
        <label class="f"><span>مرتب‌سازی</span><select id="sort">${opts([['new', 'جدیدترین'], ['cheap', 'ارزان‌ترین'], ['exp', 'گران‌ترین'], ['area', 'بزرگ‌ترین'], ...(DB.caps.views ? [['views', 'پربازدیدترین']] : [])], F.sort)}</select></label>
      </div>
      <div class="stack"><div class="chips" id="feats">${['پارکینگ', 'آسانسور', 'انباری', 'بالکن', 'نوساز', 'مبله', 'سند تک‌برگ'].map(x => `<button class="chip${F.feats.includes(x) ? ' on' : ''}" data-f="${x}">${x}</button>`).join('')}</div>
      <div class="row"><label class="check"><input type="checkbox" id="hideRes"${F.hideRes ? ' checked' : ''}> نمایش ندادن آگهی‌های «در حال معامله»</label><span class="spacer"></span><button class="btn sm ghost" id="clr">پاک کردن فیلترها</button></div></div>
    </div>
    <div class="count" id="cnt"></div>
    <div class="cards" id="list"></div>`;
  const draw = () => {
    store.set('amlak-filters', S.filters);
    const q = F.q.trim(), qn = toNum(q);
    const pv = l => sale ? (l.price || 0) : (l.deposit || 0) + (l.rent || 0) * 33;   // تبدیل اجاره به رهن (هر ۱ میلیون اجاره ≈ ۳۳ میلیون رهن) برای مرتب‌سازی
    let r = all.filter(l => l.deal === deal && ['active', 'reserved'].includes(l.status)
      && (!q || l.id === qn || [l.title, l.district, l.city, l.description].join(' ').includes(q))
      && (!F.ptype || l.ptype === F.ptype) && (!F.kind || l.misc_kind === F.kind)
      && (!F.max || (sale ? (l.price || 0) : (l.deposit || 0)) <= +F.max)
      && (!F.maxRent || (+F.maxRent < 0 ? !l.rent : (l.rent || 0) <= +F.maxRent))
      && (!F.minArea || (l.area || l.land_area || 0) >= +F.minArea)
      && (!F.rooms || (l.rooms || 0) >= +F.rooms)
      && F.feats.every(x => (l.features || []).includes(x))
      && !(F.hideRes && l.status === 'reserved'));
    const so = { new: (a, b) => (b.featured - a.featured) || b.created_at.localeCompare(a.created_at), cheap: (a, b) => pv(a) - pv(b), exp: (a, b) => pv(b) - pv(a), area: (a, b) => (b.area || b.land_area || 0) - (a.area || a.land_area || 0), views: (a, b) => b.views - a.views };
    r.sort(so[F.sort] || so.new);
    $('#cnt').textContent = `${fa(r.length)} آگهی`;
    $('#list').innerHTML = r.length ? r.map(card).join('') : `<div class="empty" style="grid-column:1/-1">${I.empty}<p>آگهی‌ای با این مشخصات پیدا نشد.</p></div>`;
    bindFav($('#list'));
  };
  let tq; $('#q').addEventListener('input', e => { clearTimeout(tq); tq = setTimeout(() => { F.q = e.target.value; draw(); }, 200); });
  $('#tgl').addEventListener('click', () => { S.showF = !S.showF; $('#flt').hidden = !S.showF; });
  $$('#kinds .chip').forEach(b => b.addEventListener('click', () => { F.kind = b.dataset.k; $$('#kinds .chip').forEach(x => x.classList.toggle('on', x === b)); draw(); }));
  $$('#ptypes .chip').forEach(b => b.addEventListener('click', () => { F.ptype = b.dataset.p; $$('#ptypes .chip').forEach(x => x.classList.toggle('on', x === b)); draw(); }));
  $$('#feats .chip').forEach(b => b.addEventListener('click', () => { const i = F.feats.indexOf(b.dataset.f); i < 0 ? F.feats.push(b.dataset.f) : F.feats.splice(i, 1); b.classList.toggle('on'); draw(); }));
  ['max', 'maxRent', 'minArea', 'rooms', 'sort'].forEach(k => $('#' + k)?.addEventListener('change', e => { F[k] = e.target.value; draw(); }));
  $('#hideRes').addEventListener('change', e => { F.hideRes = e.target.checked; draw(); });
  $('#clr').addEventListener('click', () => { S.filters[deal] = { ...DEF_F }; viewList(deal); });
  draw();
}

async function viewFav() {
  const all = await loadListings();
  const ids = favs(), r = ids.map(id => all.find(l => l.id === id)).filter(Boolean);
  view().innerHTML = `<h2>نشان‌شده‌ها</h2><p class="muted small">آگهی‌هایی که با ♥ نشان کرده‌اید (روی همین گوشی ذخیره می‌شود).</p>
    <div class="cards" id="list">${r.length ? r.map(card).join('') : `<div class="empty" style="grid-column:1/-1">${I.heartO}<p>هنوز آگهی‌ای نشان نکرده‌اید.</p></div>`}</div>`;
  bindFav(view());
  $$('[data-fav]').forEach(b => b.addEventListener('click', () => setTimeout(viewFav, 300)));
}

/* =====================================================================
   مشتری: جزئیات آگهی
   ===================================================================== */
function gallery(imgs, seed) {
  const list = (imgs?.length ? imgs : [null]).map((u, i) => imgSrc(u, seed + i));
  return `<div class="gal"><div class="track" id="track">${list.map(u => `<img src="${esc(u)}" alt="">`).join('')}</div>
    ${list.length > 1 ? `<span class="n" id="gn">${fa(1)} از ${fa(list.length)}</span>` : ''}</div>
    ${list.length > 1 ? `<div class="thumbs">${list.map((u, i) => `<img src="${esc(u)}" data-i="${i}" alt="">`).join('')}</div>` : ''}`;
}
function bindGallery() {
  const tr = $('#track'); if (!tr) return;
  const n = tr.children.length;
  tr.addEventListener('scroll', () => { const i = Math.round(Math.abs(tr.scrollLeft) / tr.clientWidth); $('#gn') && ($('#gn').textContent = `${fa(i + 1)} از ${fa(n)}`); }, { passive: true });
  $$('.thumbs img').forEach(t => t.addEventListener('click', () => tr.children[+t.dataset.i].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })));
  $$('#track img').forEach(im => im.addEventListener('click', () => lightbox(im.src)));
}
function lightbox(src) {
  const d = document.createElement('div'); d.className = 'lightbox'; d.innerHTML = `<img src="${esc(src)}" alt="">`;
  d.addEventListener('click', () => d.remove()); document.body.append(d);
}
function agentCard(a, withLink = true, msg = '') {
  if (!a) return '';
  const ph = a.phone || CFG.phone;
  return `<div class="agentcard"><div class="avatar">${esc((a.full_name || '؟').trim()[0])}</div>
    <div style="flex:1;min-width:0"><b>${esc(a.full_name)}</b><div class="muted small">${esc(a.bio || 'مشاور املاک')}</div>
    ${withLink ? `<a class="small" href="#agent/${esc(a.id)}">همه آگهی‌های این مشاور</a>` : ''}</div></div>
    ${ph ? `<div class="row" style="margin-top:10px"><a class="btn primary" style="flex:1" href="tel:${esc(ph)}">${I.phone} تماس</a>
    <a class="btn" style="flex:1" href="https://wa.me/${esc(waPhone(ph))}${msg ? '?text=' + encodeURIComponent(msg) : ''}" target="_blank" rel="noopener">${I.chat} واتس‌اپ</a></div>` : ''}`;
}

async function viewListing(id) {
  const all = await loadListings(); await loadAgents();
  const l = all.find(x => x.id === id);
  if (!l) { view().innerHTML = `<div class="empty">${I.empty}<p>این آگهی پیدا نشد یا دیگر فعال نیست.</p><a class="btn" href="#sale">بازگشت</a></div>`; return; }
  if (!sessionStorage.getItem('v' + id)) { sessionStorage.setItem('v' + id, 1); DB.incViews(id).catch(() => { }); }
  const a = agentOf(l.agent_id), edit = canEdit(l), sale = l.deal !== 'rent';
  if (S.lastList !== 'fav') renderChrome(S.lastList = l.deal);
  const sp = [...(l.deal === 'misc' ? [['نوع واگذاری', MISC_KINDS[l.misc_kind] || 'متفرقه']] : []), ['نوع ملک', PTYPES[l.ptype]], ['متراژ بنا', l.area && fa(l.area) + ' متر'], ['متراژ زمین', l.land_area && fa(l.land_area) + ' متر'],
    ['اتاق خواب', l.rooms != null && l.rooms !== '' && fa(l.rooms)], ['طبقه', l.floor != null && l.floor !== '' && (fa(l.floor) + (l.floors ? ' از ' + fa(l.floors) : ''))],
    ['سال ساخت', l.year_built && faStr(l.year_built)], ['کد آگهی', fa(l.id)], ['بازدید', DB.caps.views && fa(l.views)]].filter(x => x[1]);
  const fav = favs().includes(l.id);
  view().innerHTML = `<button class="back" onclick="history.length>1?history.back():location.hash='${l.deal}'">${I.back} بازگشت</button>
  <div class="detail"><div class="stack">
    ${gallery(l.images, l.id)}
    <div class="row"><span class="tag ${l.deal}">${esc(dealLabel(l))}</span>${l.verified ? '<span class="tag ok">✓ تأیید شده توسط بنگاه</span>' : ''}${l.status !== 'active' ? `<span class="tag ${STATUS[l.status][1]}">${STATUS[l.status][0]}</span>` : ''}
      <span class="spacer"></span><button class="iconbtn" id="shr" aria-label="اشتراک">${I.share}</button><button class="iconbtn" id="fv" aria-label="نشان" style="color:${fav ? '#e8475a' : ''}">${fav ? I.heart : I.heartO}</button></div>
    <h2>${esc(l.title)}</h2>
    <div class="muted">${esc([l.district, l.city].filter(Boolean).join('، '))}</div>
    <div class="card">${sale ? `<div class="muted small">${l.deal === 'misc' ? 'قیمت / ارزش' : 'قیمت کل'}</div><div style="font-size:22px;font-weight:800" class="num">${money(l.price)}</div>${l.price && l.area ? `<div class="muted small">قیمت هر متر: ${money(Math.round(l.price / l.area))}</div>` : ''}`
      : `<div class="grid2"><div><div class="muted small">رهن / ودیعه</div><div style="font-size:19px;font-weight:800">${money(l.deposit)}</div></div><div><div class="muted small">اجاره ماهانه</div><div style="font-size:19px;font-weight:800">${l.rent ? money(l.rent) : 'رهن کامل'}</div></div></div>`}</div>
    <div class="specs">${sp.map(([k, v]) => `<div class="spec"><small>${k}</small><b>${v}</b></div>`).join('')}</div>
    ${l.features?.length ? `<div><h3 style="margin-bottom:6px">امکانات</h3><div class="feat">${l.features.map(f => `<span>${esc(f)}</span>`).join('')}</div></div>` : ''}
    ${l.description ? `<div><h3 style="margin-bottom:6px">توضیحات</h3><div class="desc">${esc(l.description)}</div></div>` : ''}
    <div id="priv"></div>
    <div id="adtxt"></div>
  </div>
  <aside class="stack">
    ${edit ? `<div class="card row"><b style="flex:1">مدیریت آگهی</b><a class="btn sm primary" href="#edit/${l.id}">ویرایش</a></div>` : ''}
    <div class="card">${!DB.caps.leads ? '<h3 style="margin-bottom:8px">درخواست بازدید یا مشاوره</h3>' : ''}${agentCard(a, true, `سلام، درباره آگهی کد ${fa(l.id)} («${l.title}») سوال دارم و برای بازدید وقت می‌خواهم.\n${location.href}`)}</div>
    ${DB.caps.leads && ['active', 'reserved'].includes(l.status) ? `<form class="card stack" id="lead"><h3>درخواست بازدید یا مشاوره</h3>
      <p class="muted small" style="margin:0">مشاور این ملک با شما تماس می‌گیرد.</p>
      <input name="name" required minlength="2" maxlength="80" placeholder="نام شما" autocomplete="name">
      <input name="phone" required inputmode="tel" placeholder="شماره موبایل" autocomplete="tel">
      <textarea name="message" maxlength="1000" placeholder="پیام (اختیاری)">سلام، برای بازدید از این ملک (کد ${fa(l.id)}) وقت می‌خواهم.</textarea>
      <button class="btn primary">ارسال درخواست</button></form>` : ''}
  </aside></div>`;
  bindGallery();
  $('#fv').addEventListener('click', e => { const on = toggleFav(id), b = e.currentTarget; b.innerHTML = on ? I.heart : I.heartO; b.style.color = on ? '#e8475a' : ''; });
  $('#shr').addEventListener('click', async () => {
    const url = location.href;
    if (navigator.share) navigator.share({ title: l.title, text: `${l.title} — ${sale ? money(l.price) : 'رهن ' + money(l.deposit)}`, url }).catch(() => { });
    else { await navigator.clipboard?.writeText(url); toast('لینک آگهی کپی شد'); }
  });
  $('#lead')?.addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target), phone = String(toNum(f.get('phone')) ?? '');
    if (phone.length < 10) return toast('شماره موبایل را درست وارد کنید');
    const b = $('button', e.target); b.disabled = true;
    try { await DB.addLead({ listing_id: id, name: f.get('name').trim(), phone: '0' + phone.replace(/^0+/, '').replace(/^98/, ''), message: f.get('message').trim() }); e.target.innerHTML = '<h3>✓ درخواست شما ثبت شد</h3><p class="muted">مشاور به‌زودی با شما تماس می‌گیرد.</p>'; }
    catch (err) { toast(err.message); b.disabled = false; }
  });
  if (edit) {
    const p = await DB.getPrivate(id).catch(() => null);
    $('#priv').innerHTML = `<div class="card private stack"><h3>🔒 اطلاعات محرمانه (فقط مشاور این ملک و ادمین)</h3>
      ${p && (p.owner_name || p.owner_phone || p.exact_address || p.notes) ? `<div class="specs">
        ${p.owner_name ? `<div class="spec"><small>مالک</small><b>${esc(p.owner_name)}</b></div>` : ''}
        ${p.owner_phone ? `<div class="spec"><small>تلفن مالک</small><b><a href="tel:${esc(p.owner_phone)}">${esc(faStr(p.owner_phone))}</a></b></div>` : ''}</div>
        ${p.exact_address ? `<div><small class="muted">آدرس دقیق</small><div>${esc(p.exact_address)}</div></div>` : ''}
        ${p.notes ? `<div><small class="muted">یادداشت</small><div class="desc">${esc(p.notes)}</div></div>` : ''}` : '<p class="muted small">هنوز ثبت نشده. از «ویرایش» اضافه کنید.</p>'}
      <div class="specs"><div class="spec"><small>تاریخ ثبت آگهی</small><b style="font-weight:500">${fullDate(l.created_at)}</b></div>
        <div class="spec"><small>آخرین ویرایش</small><b style="font-weight:500">${fullDate(l.updated_at || l.created_at)}</b></div></div>
      ${p?.source_url ? `<div><small class="muted">آگهی منبع (دیوار)</small><div><a href="${esc(p.source_url)}" target="_blank" rel="noopener" dir="ltr">${esc(p.source_url.slice(0, 60))}</a></div></div>` : ''}
      ${isAdmin() ? `<div class="muted small">مشاور ثبت‌کننده: ${esc(agentOf(l.agent_id)?.full_name || '—')}</div>` : ''}</div>`;
    adTextCard($('#adtxt'), l, a);
  }
}

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('کپی شد'); }
  catch { const x = document.createElement('textarea'); x.value = t; document.body.append(x); x.select(); document.execCommand('copy'); x.remove(); toast('کپی شد'); }
}
async function savePhotos(l) {
  const urls = (l.images || []).filter(u => u && !u.startsWith('ph:'));
  if (!urls.length) return toast('این آگهی عکس ندارد');
  toast('در حال آماده کردن عکس‌ها…', 2000);
  const files = [];
  for (const [i, u] of urls.entries()) { try { const b = await (await fetch(u)).blob(); files.push(new File([b], `amlak-${l.id}-${i + 1}.jpg`, { type: b.type || 'image/jpeg' })); } catch { } }
  if (!files.length) return toast('دریافت عکس‌ها ممکن نشد');
  if (navigator.canShare?.({ files })) { try { await navigator.share({ files, title: l.title }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  for (const f of files) { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.append(a); a.click(); a.remove(); await new Promise(r => setTimeout(r, 350)); }
  toast(`${fa(files.length)} عکس ذخیره شد`);
}
// متن آماده برای ثبت همین آگهی در دیوار (فقط برای مشاور همان آگهی و مدیر)
function adTextCard(box, l, a) {
  if (!box || !window.Divar) return;
  const ads = Divar.adText(l, { ptypes: PTYPES, kinds: MISC_KINDS, agent: a, brand: CFG.name });
  const warn = Divar.priceWarning(l), open = S.showAd === l.id; S.showAd = null;
  box.innerHTML = `<details class="card" id="adbox"${open ? ' open' : ''}><summary style="cursor:pointer"><b>📝 متن آماده برای دیوار</b> <span class="small muted">· کپی کنید و در دیوار بگذارید</span></summary>
    <div class="stack" style="margin-top:10px">
      ${warn ? `<div class="card" style="border-color:var(--bad);color:var(--bad);padding:10px">⚠️ ${esc(warn)} قبل از انتشار، قیمت را در «ویرایش» درست کنید.</div>` : ''}
      <div class="seg" id="adv">${ads.map((x, i) => `<button type="button" data-i="${i}" class="${i ? '' : 'on'}">${x.name}</button>`).join('')}</div>
      <label class="f"><span>عنوان (دیوار حداکثر ۵۰ حرف می‌پذیرد)</span><div class="row" style="flex-wrap:nowrap"><input readonly id="adT"><button type="button" class="btn sm" id="cpT">${I.copy} کپی</button></div></label>
      <label class="f"><span>متن آگهی</span><textarea readonly id="adB" rows="12" style="min-height:220px"></textarea></label>
      <div class="row"><button type="button" class="btn primary" id="cpB" style="flex:1">${I.copy} کپی متن</button><button type="button" class="btn" id="dlI">ذخیره عکس‌ها</button></div>
      <button type="button" class="btn primary" id="cpGo">${I.copy} کپی متن و باز کردن دیوار</button>
      <a class="btn" href="https://divar.ir/new" target="_blank" rel="noopener">فقط باز کردن «ثبت آگهی» در دیوار</a>
      <p class="small muted" style="margin:0">در دیوار: دسته‌بندی را انتخاب کنید، عکس‌ها را از گالری بگذارید و عنوان و متن را paste کنید. لینک و شماره تلفن را داخل متن ننویسید؛ دیوار قبول نمی‌کند.</p>
    </div></details>`;
  let cur = 0;
  const show = i => { cur = i; $('#adT').value = ads[i].title; $('#adB').value = ads[i].body; $$('#adv button').forEach(b => b.classList.toggle('on', +b.dataset.i === i)); };
  $$('#adv button').forEach(b => b.addEventListener('click', () => show(+b.dataset.i)));
  $('#cpT').addEventListener('click', () => copyText(ads[cur].title));
  $('#cpB').addEventListener('click', () => copyText(ads[cur].body));
  $('#dlI').addEventListener('click', () => savePhotos(l));
  $('#cpGo').addEventListener('click', () => {   // هر دو کار در همان لمس انجام شود تا مرورگر جلویش را نگیرد
    navigator.clipboard?.writeText(ads[cur].body).then(() => toast('متن کپی شد؛ در دیوار paste کنید', 3500), () => copyText(ads[cur].body));
    window.open('https://divar.ir/new', '_blank', 'noopener');
  });
  show(0);
  if (open) setTimeout(() => $('#adbox')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
}

async function viewAgent(id) {
  const all = await loadListings(); await loadAgents();
  const a = agentOf(id);
  if (!a) { view().innerHTML = `<div class="empty">${I.empty}<p>مشاور پیدا نشد.</p></div>`; return; }
  const r = all.filter(l => l.agent_id === id && ['active', 'reserved'].includes(l.status));
  view().innerHTML = `<button class="back" onclick="history.back()">${I.back} بازگشت</button>
    <div class="card" style="margin-bottom:14px">${agentCard(a, false)}</div>
    <h3 style="margin-bottom:10px">آگهی‌های فعال (${fa(r.length)})</h3><div class="cards">${r.map(card).join('') || '<p class="muted">آگهی فعالی ندارد.</p>'}</div>`;
  bindFav(view());
}

/* =====================================================================
   طراحی‌ها (همه می‌بینند، فقط ادمین مدیریت می‌کند)
   ===================================================================== */
async function viewDesigns() {
  const ds = await loadDesigns();
  const F = S.dF || (S.dF = { space: '', style: '' });
  const spaces = [...new Set(ds.map(d => d.space).filter(Boolean))], styles = [...new Set(ds.map(d => d.style).filter(Boolean))];
  view().innerHTML = `<div class="row" style="margin-bottom:6px"><h2 style="flex:1">نمونه‌کارهای طراحی داخلی</h2>${isAdmin() ? `<a class="btn sm primary" href="#dedit/new">${I.plus} افزودن</a>` : ''}</div>
    <p class="muted small" style="margin-top:0">طراحی و بازسازی‌هایی که تیم ما روی منازل انجام داده است.</p>
    ${spaces.length > 1 ? `<div class="chips" id="sp" style="margin-bottom:6px">${['', ...spaces].map(s => `<button class="chip${F.space === s ? ' on' : ''}" data-v="${esc(s)}">${esc(s || 'همه فضاها')}</button>`).join('')}</div>` : ''}
    ${styles.length > 1 ? `<div class="chips" id="st" style="margin-bottom:12px">${['', ...styles].map(s => `<button class="chip${F.style === s ? ' on' : ''}" data-v="${esc(s)}">${esc(s || 'همه سبک‌ها')}</button>`).join('')}</div>` : ''}
    <div class="dcards" id="dl"></div>`;
  const draw = () => {
    const r = ds.filter(d => (!F.space || d.space === F.space) && (!F.style || d.style === F.style));
    $('#dl').innerHTML = r.length ? r.map(d => `<a class="dc" href="#d/${d.id}"><img loading="lazy" src="${esc(imgSrc(d.images?.[0], d.id * 10))}" alt="">
      <div class="cap"><b>${esc(d.title)}</b><small>${esc([d.style, d.space, d.area && fa(d.area) + ' متر'].filter(Boolean).join(' · '))}</small></div></a>`).join('')
      : `<div class="empty" style="grid-column:1/-1">${I.design}<p>هنوز نمونه‌کاری ثبت نشده است.</p></div>`;
  };
  [['#sp', 'space'], ['#st', 'style']].forEach(([s, k]) => $$(s + ' .chip').forEach(b => b.addEventListener('click', () => { F[k] = b.dataset.v; $$(s + ' .chip').forEach(x => x.classList.toggle('on', x === b)); draw(); })));
  draw();
}

async function viewDesign(id) {
  const d = (await loadDesigns()).find(x => x.id === id);
  if (!d) { view().innerHTML = `<div class="empty">${I.empty}<p>پیدا نشد.</p></div>`; return; }
  const imgs = (d.images || []).map((u, i) => imgSrc(u, d.id * 10 + i));
  view().innerHTML = `<button class="back" onclick="history.length>1?history.back():location.hash='designs'">${I.back} بازگشت</button>
    <div class="stack">
      <div class="row"><h2 style="flex:1">${esc(d.title)}</h2>${isAdmin() ? `<a class="btn sm" href="#dedit/${d.id}">ویرایش</a>` : ''}</div>
      <div class="row">${[d.style, d.space, d.city, d.area && fa(d.area) + ' متر'].filter(Boolean).map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>
      ${d.before_image && imgs[0] ? `<div class="ba"><figure><img src="${esc(imgSrc(d.before_image, d.id))}" alt=""><figcaption>قبل</figcaption></figure><figure><img src="${esc(imgs[0])}" alt=""><figcaption>بعد</figcaption></figure></div>` : ''}
      ${d.description ? `<div class="desc">${esc(d.description)}</div>` : ''}
      <div class="masonry">${imgs.map(u => `<img src="${esc(u)}" loading="lazy" alt="">`).join('')}</div>
      <div class="card"><b>برای طراحی خانه خود مشاوره می‌خواهید؟</b><div class="muted small">با دفتر تماس بگیرید.</div>
      ${CFG.phone ? `<a class="btn primary" style="margin-top:8px" href="tel:${esc(CFG.phone)}">${I.phone} تماس با دفتر</a>` : ''}</div>
    </div>`;
  $$('.masonry img, .ba img').forEach(im => im.addEventListener('click', () => lightbox(im.src)));
}

/* =====================================================================
   ورود مشاوران و مدیر
   ===================================================================== */
const afterLogin = async () => { S.me = await DB.me(); invalidate(); S.panel = null; go('panel'); if (isAdmin() && wcfg().on) watchStart(); };

function viewLogin() {
  if (DEMO) return viewDemoLogin();
  if (!DB.deviceLinked()) return viewSetup();
  const adminDev = DB.deviceKind() === 'admin';
  view().innerHTML = `<div style="max-width:420px;margin:0 auto" class="stack">
    <h2>${adminDev ? 'ورود مدیر' : 'ورود مشاور'}</h2>
    <form class="card stack" id="f">
      <label class="f"><span>نام شما</span><input name="name" required autocomplete="username" value="${esc(store.get('amlak-last-name', ''))}"></label>
      <label class="f"><span>رمز عبور</span><input name="pw" type="password" required dir="ltr" autocomplete="current-password"></label>
      <button class="btn primary" id="sb">ورود</button>
    </form>
    <button class="btn ghost" id="forget">جدا کردن این گوشی از سامانه</button></div>`;
  $('#f').addEventListener('submit', async e => {
    e.preventDefault(); const b = $('#sb'), name = e.target.name.value.trim(), pw = e.target.pw.value;
    let create = false;
    if (adminDev && !DB.nameExists(name)) {
      if (pw.length < 6) return toast('رمز باید حداقل ۶ حرف باشد');
      if (!confirm(`حساب مدیر جدید با نام «${name}» ساخته شود؟\n(اگر قبلا حساب دارید، «لغو» را بزنید و نامتان را دقیقا مثل قبل بنویسید)`)) return;
      create = true;
    }
    b.disabled = true;
    try {
      const r = await DB.loginByName(name, pw, create); store.set('amlak-last-name', name);
      if (r === 'created') toast('حساب مدیر شما ساخته شد'); await afterLogin();
    } catch (err) { toast(err.message); b.disabled = false; }
  });
  $('#forget').addEventListener('click', () => { if (confirm('اتصال این گوشی به سامانه قطع شود؟')) { DB.forgetDevice(); viewLogin(); } });
}

function viewSetup() {
  view().innerHTML = `<div style="max-width:520px;margin:0 auto" class="stack">
    <h2>ورود مشاوران و مدیر</h2>
    <div class="card"><b>مشاور هستید؟</b><p class="muted small" style="margin:4px 0 0">لینک دعوتی را که مدیر بنگاه در واتس‌اپ برایتان فرستاده روی همین گوشی باز کنید و رمزتان را بزنید. کار دیگری لازم نیست.</p></div>
    <details class="card" id="adm"><summary style="cursor:pointer"><b>ورود مدیر</b></summary>
      <form class="stack" id="sf">
        <label class="f"><span>نام کاربر</span><input name="repo" required dir="ltr" autocomplete="off"></label>
        <label class="f"><span>رمز مخزن</span><input name="token" required dir="ltr" autocomplete="off" type="password"></label>
        <div id="newAdm" class="stack" hidden><p class="small" style="margin:0;color:var(--accent)">اطلاعات مدیر:</p>
          <input name="full_name" placeholder="نام و نام خانوادگی"><input name="phone" inputmode="tel" placeholder="موبایل (به مشتری نمایش داده می‌شود)">
          <input name="pw" type="password" placeholder="یک رمز عبور برای خودتان (حداقل ۶ حرف)" dir="ltr" autocomplete="new-password"></div>
        <button class="btn primary" id="sb">اتصال</button>
      </form></details></div>`;
  $('#sf').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, b = $('#sb'), creating = !$('#newAdm').hidden;
    if (creating && (!f.full_name.value.trim() || f.pw.value.length < 6)) return toast('نام و رمز (حداقل ۶ حرف) را وارد کنید');
    b.disabled = true; b.textContent = 'در حال بررسی…';
    try {
      const r = await DB.setup(f.repo.value, f.token.value, creating ? { full_name: f.full_name.value.trim(), phone: f.phone.value.trim(), pw: f.pw.value } : null);
      if (r === 'new') { $('#newAdm').hidden = false; b.textContent = 'ساخت سامانه'; b.disabled = false; return; }
      if (r === 'created') { toast('سامانه راه‌اندازی شد'); return afterLogin(); }
      viewLogin();
    } catch (err) { toast(err.message, 5000); b.disabled = false; b.textContent = creating ? 'ساخت سامانه' : 'اتصال'; }
  });
}

function viewJoin(code) {
  if (DEMO) return go('login');
  view().innerHTML = `<div style="max-width:420px;margin:0 auto" class="stack"><h2>پیوستن به ${esc(CFG.name || 'سامانه')}</h2>
    <p class="muted small" style="margin:0">رمزی را که مدیر بنگاه به شما گفته وارد کنید. بعد از این، این گوشی وصل می‌ماند.</p>
    <form class="card stack" id="jf"><input name="pw" type="password" required placeholder="رمز عبور" dir="ltr" autocomplete="current-password"><button class="btn primary" id="sb">ورود</button></form></div>`;
  $('#jf').addEventListener('submit', async e => {
    e.preventDefault(); const b = $('#sb'); b.disabled = true; b.textContent = 'در حال ورود…';
    try { await DB.joinWithInvite(code, e.target.pw.value); history.replaceState(null, '', '#panel'); toast('خوش آمدید'); await afterLogin(); }
    catch (err) { toast(err.message, 4000); b.disabled = false; b.textContent = 'ورود'; }
  });
}

function viewDemoLogin() {
  view().innerHTML = `<div style="max-width:420px;margin:0 auto" class="stack">
    <h2>ورود (حالت نمایشی)</h2>
    <div class="card stack"><b>به‌عنوان چه کسی وارد شوید؟</b><div class="row">
      <button class="btn sm" data-q="admin@demo">ادمین اصلی</button><button class="btn sm" data-q="sara@demo">مشاور: سارا</button><button class="btn sm" data-q="reza@demo">مشاور: رضا</button></div></div></div>`;
  $$('[data-q]').forEach(b => b.addEventListener('click', async () => { await DB.signIn(b.dataset.q, ''); await afterLogin(); }));
}

function viewPending() {
  view().innerHTML = `<div class="empty">${I.user}<h3>${S.me.active ? 'حساب شما در انتظار تأیید ادمین است' : 'حساب شما غیرفعال شده است'}</h3>
    <p>${S.me.active ? 'بعد از تأیید مدیر بنگاه می‌توانید آگهی ثبت کنید.' : 'برای پیگیری با مدیر بنگاه تماس بگیرید.'}</p>
    <div class="row" style="justify-content:center"><button class="btn" onclick="location.reload()">بررسی دوباره</button><button class="btn danger" id="out">خروج</button></div></div>`;
  $('#out').addEventListener('click', logout);
}
async function logout() { if (WATCH.on) { const keep = wcfg().on; watchStop(); wsave({ on: keep }); } await DB.signOut(); S.me = null; invalidate(); go('sale'); }

/* =====================================================================
   پنل مشاور / ادمین
   ===================================================================== */
async function viewPanel(tab, reuse) {
  tab = tab || 'listings';
  if (!reuse || !S.panel) { S.panel = await Promise.all([loadListings(true), loadAgents(true), DB.leads()]); S.storage = null; }
  const [all, agents, leads] = S.panel;
  const admin = isAdmin();
  const mine = admin ? all : all.filter(l => l.agent_id === S.me.id);
  // فقط مشاوران قابل‌دیدن شمرده می‌شوند (مدیرهای پنهان در شمارش لو نروند)
  const nAgents = admin ? (await DB.profiles()).filter(p => p.active && p.role === 'agent').length : 0;
  const newLeads = leads.filter(x => x.status === 'new').length;
  const tabs = [['listings', admin ? 'همه آگهی‌ها' : 'آگهی‌های من'], ...(DB.divarList ? [['divar', 'فایل‌های دیوار']] : []), ...(DB.caps.leads ? [['leads', `درخواست‌ها${newLeads ? ` (${fa(newLeads)})` : ''}`]] : []),
    ...(admin ? [['agents', 'مشاوران'], ['designs', 'طراحی‌ها']] : []), ...(DB.isOwner?.() ? [['admins', 'مدیران']] : []), ['me', 'حساب من']];
  view().innerHTML = `
    <div class="row" style="margin-bottom:12px"><h2 style="flex:1">${admin ? 'پنل مدیریت' : 'پنل مشاور'}</h2>
      <a class="btn primary" href="#edit/new">${I.plus} ثبت آگهی</a></div>
    <div id="mig"></div>
    ${admin && DB.storage ? '<div id="stor"></div>' : ''}
    <div class="stats" style="margin-bottom:14px">
      <div class="stat"><small>آگهی فعال</small><b>${fa(mine.filter(l => l.status === 'active').length)}</b></div>
      <div class="stat"><small>فروش / اجاره</small><b>${fa(mine.filter(l => l.deal === 'sale').length)} / ${fa(mine.filter(l => l.deal === 'rent').length)}</b></div>
      <div class="stat"><small>معامله شده</small><b>${fa(mine.filter(l => ['sold', 'rented'].includes(l.status)).length)}</b></div>
      ${DB.caps.views ? `<div class="stat"><small>کل بازدید</small><b>${fa(mine.reduce((s, l) => s + (l.views || 0), 0))}</b></div>` : ''}
      ${DB.caps.leads ? `<div class="stat"><small>درخواست جدید</small><b style="color:${newLeads ? 'var(--warn)' : ''}">${fa(newLeads)}</b></div>` : `<div class="stat"><small>مخفی</small><b>${fa(mine.filter(l => l.status === 'hidden').length)}</b></div>`}
      ${admin ? `<div class="stat"><small>مشاور فعال</small><b>${fa(nAgents)}</b></div>` : ''}
    </div>
    <div class="seg" style="margin-bottom:12px">${tabs.map(([k, t]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div id="pt"></div>`;
  $$('.seg [data-t]').forEach(b => b.addEventListener('click', () => history.replaceState(null, '', '#panel/' + b.dataset.t) || viewPanel(b.dataset.t, true)));
  const pt = $('#pt');
  if (DB.needsMigration?.()) runMigration();
  if ($('#stor')) showStorage();
  if (tab === 'listings') panelListings(pt, mine, agents);
  else if (tab === 'divar' && DB.divarList) await panelDivar(pt);
  else if (tab === 'leads' && DB.caps.leads) panelLeads(pt, leads, all);
  else if (tab === 'agents' && admin) await panelAgents(pt, all, leads);
  else if (tab === 'admins' && DB.isOwner?.()) await panelAdmins(pt, all);
  else if (tab === 'designs' && admin) await panelDesigns(pt);
  else panelMe(pt);
}

async function showStorage() {
  const st = S.storage || (S.storage = await DB.storage().catch(() => null));
  const box = $('#stor'); if (!box || !st?.repos?.length) return;
  const LIMIT = 1024 * 1024;   // ۱ گیگابایت = حد توصیه‌شده گیت‌هاب برای هر مخزن (کیلوبایت)
  const size = kb => kb < 1024 ? fa(kb) + ' کیلوبایت' : kb < LIMIT ? fa(Math.round(kb / 1024)) + ' مگابایت' : (kb / LIMIT).toLocaleString('fa-IR', { maximumFractionDigits: 1 }) + ' گیگابایت';
  const worst = Math.max(...st.repos.map(r => r.kb / LIMIT));
  box.innerHTML = `<details class="card" style="margin-bottom:14px${worst >= .7 ? ';border-color:var(--' + (worst >= .9 ? 'bad' : 'warn') + ')' : ''}"${worst >= .7 ? ' open' : ''}>
    <summary style="cursor:pointer"><b>فضای ذخیره</b> <span class="small muted">· ${fa(Math.round(worst * 100))}٪ پر · ${fa(st.photos)} عکس</span></summary>
    <div class="stack" style="margin-top:10px">${st.repos.map(r => {
      const pc = Math.min(1, r.kb / LIMIT), col = pc >= .9 ? 'var(--bad)' : pc >= .7 ? 'var(--warn)' : 'var(--accent)';
      return `<div><div class="row small"><span style="flex:1">${r.label}</span><span class="muted">${size(r.kb)} از ۱ گیگابایت</span></div>
        <div style="height:8px;border-radius:99px;background:var(--sunk);overflow:hidden;margin-top:4px"><div style="height:100%;width:${Math.max(1, pc * 100)}%;background:${col};border-radius:99px"></div></div></div>`;
    }).join('')}
    <div class="small muted">${worst >= .9 ? '⚠️ نزدیک حد توصیه‌شده است؛ برای انتقال عکس‌ها به فضای دیگر اقدام کنید.' : worst >= .7 ? 'بیش از ۷۰٪ پر شده؛ کم‌کم برای فضای بیشتر برنامه‌ریزی کنید.' : 'هر عکس حدود ۱۵۰ کیلوبایت است. گیت‌هاب این عدد را با چند ساعت تأخیر به‌روز می‌کند.'}</div></div></details>`;
}

let migrating = false;
async function runMigration() {
  const box = $('#mig'); if (!box || migrating) return;
  migrating = true;
  const show = (html, warn) => { const b = $('#mig'); if (b) b.innerHTML = `<div class="card" style="margin-bottom:12px;border-color:var(--${warn ? 'warn' : 'accent'})">${html}</div>`; };
  show('<b>در حال انتقال عکس‌ها به مخزن جدا…</b><div class="small muted" id="migp">لطفا صفحه را نبندید.</div>');
  try {
    const n = await DB.migrate((i, t) => { const e = $('#migp'); if (e) e.textContent = `عکس ${fa(i)} از ${fa(t)} — لطفا صفحه را نبندید.`; });
    show(`<b>✓ انتقال انجام شد</b><div class="small muted">${fa(n)} عکس به مخزن جدا منتقل شد.</div>`);
    invalidate(); S.panel = null;
  } catch (e) {
    show(`<b>انتقال عکس‌ها به مخزن جدا هنوز انجام نشده</b><div class="small">${esc(e.message)}</div>
      <div class="small muted">مخزن عمومی <b dir="ltr">amlak-data</b> را بسازید و به توکن فعلی اضافه کنید، بعد این صفحه را دوباره باز کنید. تا آن موقع همه‌چیز مثل قبل کار می‌کند.</div>`, true);
  } finally { migrating = false; }
}

function panelListings(pt, rows, agents) {
  const admin = isAdmin(), F = S.pF || (S.pF = { agent: '', status: '', deal: '', q: '' });
  pt.innerHTML = `<div class="grid3" style="margin-bottom:10px">
      ${admin ? `<select id="fa">${opts(agents.map(a => [a.id, a.full_name]), F.agent, 'همه مشاوران')}</select>` : ''}
      <select id="fs">${opts(Object.entries(STATUS).map(([k, v]) => [k, v[0]]), F.status, 'همه وضعیت‌ها')}</select>
      <select id="fd">${opts(Object.entries(DEAL_NAME), F.deal, 'همه')}</select>
      <input id="fq" type="search" placeholder="جستجو یا کد" value="${esc(F.q)}"></div><div class="tbl" id="rows"></div>`;
  const draw = () => {
    const qn = toNum(F.q);
    const r = rows.filter(l => (!F.agent || l.agent_id === F.agent) && (!F.status || l.status === F.status) && (!F.deal || l.deal === F.deal)
      && (!F.q || l.id === qn || (l.title + l.district).includes(F.q)));
    $('#rows').innerHTML = r.length ? r.map(l => `<div class="tr"><a href="#l/${l.id}"><img src="${esc(cover(l))}" alt="" loading="lazy"></a>
      <div class="mid"><b>${esc(l.title)}</b><div class="small muted">کد ${fa(l.id)} · ${l.deal === 'misc' ? esc(dealLabel(l)) + ' · ' : ''}${l.deal !== 'rent' ? money(l.price) : 'رهن ' + money(l.deposit, false)} · ثبت ${new Date(l.created_at).toLocaleDateString('fa-IR')} ${DB.caps.views ? ` · ${fa(l.views)} بازدید` : ''}
      ${admin ? ` · ${esc(agentOf(l.agent_id)?.full_name || 'مشاور غیرفعال')}` : ''}</div>
      <div class="row" style="margin-top:4px"><select data-st="${l.id}" style="width:auto;min-height:32px;padding:3px 8px;font-size:13px">${opts(Object.entries(STATUS).filter(([k]) => l.deal === 'rent' ? k !== 'sold' : k !== 'rented').map(([k, v]) => [k, v[0]]), l.status)}</select>
      ${l.featured ? '<span class="tag warn">ویژه</span>' : ''}${l.verified ? '<span class="tag ok">تأیید شده</span>' : ''}</div></div>
      <a class="btn sm" href="#edit/${l.id}">ویرایش</a></div>`).join('') : '<div class="empty">هیچ آگهی‌ای نیست. با دکمه «ثبت آگهی» شروع کنید.</div>';
    $$('[data-st]').forEach(s => s.addEventListener('change', async () => {
      const l = rows.find(x => x.id === +s.dataset.st);
      try { await DB.saveListing({ id: l.id, status: s.value }, admin); l.status = s.value; S.listings = null; toast('وضعیت ذخیره شد', 1400); } catch (e) { toast(e.message); s.value = l.status; }
    }));
  };
  [['fa', 'agent'], ['fs', 'status'], ['fd', 'deal']].forEach(([i, k]) => $('#' + i)?.addEventListener('change', e => { F[k] = e.target.value; draw(); }));
  $('#fq').addEventListener('input', e => { F.q = e.target.value.trim(); draw(); });
  draw();
}

function panelLeads(pt, leads, all) {
  pt.innerHTML = leads.length ? `<div class="tbl">${leads.map(x => {
    const l = all.find(y => y.id === x.listing_id);
    return `<div class="tr" style="align-items:flex-start"><div class="mid">
      <div class="row"><b style="flex:1">${esc(x.name)}</b><span class="small muted">${ago(x.created_at)}</span></div>
      <div class="small">برای: ${l ? `<a href="#l/${l.id}">${esc(l.title)} (کد ${fa(l.id)})</a>` : '—'}${isAdmin() && l ? ` · مشاور: ${esc(agentOf(l.agent_id)?.full_name || '—')}` : ''}</div>
      ${x.message ? `<div class="desc small muted" style="margin:4px 0">${esc(x.message)}</div>` : ''}
      <div class="row"><a class="btn sm primary" href="tel:${esc(x.phone)}">${I.phone} ${esc(faStr(x.phone))}</a>
      <a class="btn sm" href="https://wa.me/${esc(waPhone(x.phone))}" target="_blank" rel="noopener">واتس‌اپ</a><span class="spacer"></span>
      <select data-ld="${x.id}" style="width:auto;min-height:32px;padding:3px 8px;font-size:13px">${opts(Object.entries(LEAD_ST).map(([k, v]) => [k, v[0]]), x.status)}</select></div></div></div>`;
  }).join('')}</div>` : '<div class="empty">هنوز درخواستی از مشتریان نرسیده است.<br><span class="small">درخواست‌هایی که مشتریان زیر آگهی‌های شما می‌فرستند اینجا نمایش داده می‌شود.</span></div>';
  $$('[data-ld]').forEach(s => s.addEventListener('change', async () => {
    try { await DB.updateLead(+s.dataset.ld, { status: s.value }); toast('ذخیره شد', 1200); } catch (e) { toast(e.message); }
  }));
}

async function panelAgents(pt, all, leads) {
  const ps = await DB.profiles(), gh = DB.caps.github;
  const sel = 'style="width:auto;min-height:32px;padding:3px 8px;font-size:13px"';
  pt.innerHTML = `${gh ? `<details class="card" style="margin-bottom:12px" ${ps.length <= 1 ? 'open' : ''}><summary style="cursor:pointer"><b>${I.plus.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} افزودن مشاور</b></summary>
      <form class="stack" id="af" style="margin-top:10px"><div class="grid2"><input name="full_name" required placeholder="نام و نام خانوادگی"><input name="phone" inputmode="tel" placeholder="موبایل"></div>
      <input name="pw" required minlength="6" placeholder="یک رمز برای او (حداقل ۶ حرف)" dir="ltr" autocomplete="off">
      <button class="btn primary">افزودن و ساخت لینک دعوت</button></form></details><div id="inv"></div>`
    : '<p class="muted small" style="margin-top:0">مشاوران جدید ثبت‌نام می‌کنند و اینجا تأیید می‌شوند.</p>'}
    <p class="muted small">برای قطع دسترسی یک مشاور، تیک «فعال» را بردارید؛ آگهی‌هایش برای مدیریت باقی می‌ماند.</p>
    <div class="tbl">${ps.map(p => {
    const n = all.filter(l => l.agent_id === p.id), lc = leads.filter(x => n.some(l => l.id === x.listing_id)).length, self = p.id === S.me.id;
    return `<div class="tr"><div class="avatar" style="width:44px;height:44px;font-size:17px">${esc((p.full_name || p.email || '؟')[0])}</div>
      <div class="mid"><b>${esc(p.full_name || '(بدون نام)')} ${p.role === 'pending' ? '<span class="tag warn">منتظر تأیید</span>' : ''}${!p.active ? '<span class="tag bad">غیرفعال</span>' : ''}</b>
      <div class="small muted">${esc([p.email, faStr(p.phone)].filter(Boolean).join(' · '))}</div>
      <div class="small muted">${fa(n.length)} آگهی · ${fa(n.filter(l => l.status === 'active').length)} فعال${DB.caps.views ? ` · ${fa(n.reduce((s, l) => s + (l.views || 0), 0))} بازدید` : ''}${DB.caps.leads ? ` · ${fa(lc)} درخواست` : ''}</div>
      ${self ? '<div class="small">(شما)</div>' : `<div class="row" style="margin-top:4px">
        ${!gh || DB.isOwner() ? `<select data-role="${p.id}" ${sel}>${opts(Object.entries(ROLES).filter(([k]) => !gh || k !== 'pending'), p.role)}</select>` : ''}
        <label class="check small"><input type="checkbox" data-act="${p.id}"${p.active ? ' checked' : ''}> فعال</label>
        ${p.role === 'pending' ? `<button class="btn sm primary" data-ok="${p.id}">تأیید به‌عنوان مشاور</button>` : ''}
        ${gh && p.active ? `<button class="btn sm" data-inv="${p.id}">رمز جدید و لینک دعوت</button>` : ''}</div>`}</div></div>`;
  }).join('')}</div>`;
  const upd = async (id, patch) => { try { await DB.updateProfile(id, patch); S.agents = null; S.panel = null; toast('ذخیره شد', 1200); viewPanel('agents'); } catch (e) { toast(e.message); } };
  $$('[data-role]').forEach(s => s.addEventListener('change', () => {
    if (s.value === 'admin' && !confirm('این کاربر دسترسی کامل ادمین می‌گیرد. مطمئنید؟')) return viewPanel('agents', true);
    upd(s.dataset.role, { role: s.value });
  }));
  $$('[data-act]').forEach(c => c.addEventListener('change', () => upd(c.dataset.act, { active: c.checked })));
  $$('[data-ok]').forEach(b => b.addEventListener('click', () => upd(b.dataset.ok, { role: 'agent' })));
  if (!gh) return;
  const showInvite = async (id, pw) => {
    const p = (await DB.profiles()).find(x => x.id === id), code = await DB.makeInvite(id, pw);
    const link = location.origin + location.pathname + '#join/' + code;
    const msg = `سلام ${p.full_name}،\nبرای ورود به پنل مشاوران ${CFG.name || ''} این لینک را روی گوشی خود باز کنید:\n${link}\nرمز ورود را جداگانه به شما می‌گویم.`;
    $('#inv').innerHTML = `<div class="card stack" style="margin-bottom:12px;border-color:var(--accent)"><b>لینک دعوت ${esc(p.full_name)}</b>
      <p class="small muted" style="margin:0">این لینک را برای او بفرستید و <b>رمز را جداگانه</b> (تلفنی یا حضوری) بگویید. بدون رمز، لینک به کاری نمی‌آید.</p>
      <input readonly dir="ltr" value="${esc(link)}" onclick="this.select()">
      <div class="row"><button class="btn sm" id="cp">کپی لینک</button>
      ${p.phone ? `<a class="btn sm primary" target="_blank" rel="noopener" href="https://wa.me/${esc(waPhone(p.phone))}?text=${encodeURIComponent(msg)}">${I.chat} فرستادن در واتس‌اپ</a>` : ''}</div></div>`;
    $('#cp').addEventListener('click', async () => { try { await navigator.clipboard.writeText(link); toast('کپی شد'); } catch { $('#inv input').select(); } });
    $('#inv').scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  $('#af').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, b = $('button', f); b.disabled = true;
    try {
      const id = await DB.addStaff({ full_name: f.full_name.value.trim(), phone: f.phone.value.trim(), pw: f.pw.value });
      const pw = f.pw.value; S.agents = null; S.panel = null;
      await viewPanel('agents'); await showInvite(id, pw); toast('مشاور اضافه شد');
    } catch (err) { toast(err.message); b.disabled = false; }
  });
  $$('[data-inv]').forEach(b => b.addEventListener('click', async () => {
    const pw = prompt('یک رمز جدید برای این مشاور بنویسید (حداقل ۶ حرف). رمز قبلی او باطل می‌شود:');
    if (pw == null) return; if (pw.length < 6) return toast('رمز باید حداقل ۶ حرف باشد');
    b.disabled = true;
    try { await DB.setPassword(pw, b.dataset.inv); await showInvite(b.dataset.inv, pw); } catch (err) { toast(err.message); } finally { b.disabled = false; }
  }));
}

/* ---------- دیده‌بان دیوار: تا وقتی اپ روی این دستگاه باز است، جستجوهای آماده را مرتب بررسی می‌کند ---------- */
const WATCH = { on: false, timer: null, busy: false, last: null, msg: '', added: 0, skipped: 0 };
const wcfg = () => ({ every: 20, drafts: true, ...store.get('amlak-watch', {}) });
const wsave = p => store.set('amlak-watch', { ...wcfg(), ...p });
function watchStart() { if (!isAdmin() || !DB.divarList || WATCH.on) return; WATCH.on = true; WATCH.msg = 'در حال شروع…'; wsave({ on: true }); watchUI(); watchTick(); }
function watchStop() { WATCH.on = false; clearTimeout(WATCH.timer); wsave({ on: false }); WATCH.msg = 'خاموش'; watchUI(); }
async function watchTick() {
  if (!WATCH.on) return;
  if (!WATCH.busy) {
    WATCH.busy = true;
    try { await watchOnce(); } catch (e) { WATCH.msg = '⚠️ ' + e.message; }
    finally { WATCH.busy = false; WATCH.last = new Date(); watchUI(); }
  }
  WATCH.timer = setTimeout(watchTick, Math.max(5, +wcfg().every || 20) * 1000);
}
function beep() { try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; g.gain.value = .08; o.connect(g); g.connect(c.destination); o.start(); setTimeout(() => { o.stop(); c.close(); }, 220); } catch { } }
function notify(title, body) {
  beep(); toast('🔔 ' + title, 4000);
  try { if (window.Notification?.permission === 'granted') new Notification(title, { body, icon: 'icons/icon-192.png' }); } catch { }
}
async function watchOnce() {
  const { items, searches } = await DB.divarList();
  if (!searches.length) throw new Error('اول یک «جستجوی آماده» دیوار ذخیره کنید (پایین همین صفحه)');
  const seenAll = store.get('amlak-watch-seen', {}), known = new Set(items.map(x => Divar.tokenOf(x.url)));
  let fresh = 0, blocked = 0, baseline = false;
  for (const sr of searches) {
    let tokens;
    try { tokens = await Divar.searchTokens(sr.url); } catch (e) { blocked++; continue; }
    const seen = seenAll[sr.url];
    if (!seen) { seenAll[sr.url] = tokens.slice(0, 600); baseline = true; WATCH.msg =`شروع شد؛ ${fa(tokens.length)} آگهی فعلی نادیده گرفته شد و از این به بعد آگهی‌های تازه اضافه می‌شود`; continue; }
    const news = tokens.filter(t => !seen.includes(t) && !known.has(t)).slice(0, 6);
    for (const t of news) {
      seen.unshift(t); known.add(t);
      const url = 'https://divar.ir/v/' + t;
      let d = {}; try { d = await Divar.fetchAd(url); } catch { }
      if (d.title && Divar.isAgency(d)) { WATCH.skipped++; continue; }
      const { _images = [], _labels, _token, ...parsed } = d;
      if (parsed.description) parsed.description = parsed.description.slice(0, 1500);
      let item;
      try { item = await DB.divarAdd({ url, title: parsed.title || 'آگهی تازه دیوار', note: '🤖 خودکار — ' + sr.name, parsed, auto: true }); }
      catch { continue; }   // تکراری (دستگاه دیگری زودتر اضافه کرده)
      WATCH.added++; fresh++;
      if (wcfg().drafts && parsed.title) {
        try {
          const l = await DB.saveListing({ deal: parsed.deal || 'sale', ptype: parsed.ptype || 'apartment', misc_kind: parsed.misc_kind || null, status: 'hidden', title: parsed.title.slice(0, 120),
            city: parsed.city || '', district: parsed.district || '', price: parsed.deal === 'rent' ? null : parsed.price ?? null, deposit: parsed.deal === 'rent' ? parsed.deposit ?? null : null,
            rent: parsed.deal === 'rent' ? parsed.rent ?? null : null, area: parsed.area ?? null, land_area: parsed.land_area ?? null, rooms: parsed.rooms ?? null, floor: parsed.floor ?? null,
            floors: parsed.floors ?? null, year_built: parsed.year_built ?? null, features: parsed.features || [], description: parsed.description || '', images: _images.slice(0, 12), agent_id: S.me.id }, true);
          await DB.savePrivate(l.id, { owner_name: '', owner_phone: '', exact_address: '', notes: 'ثبت خودکار از دیوار — قبل از انتشار با مالک تماس بگیرید', source_url: url });
          await DB.divarUpdate(item.id, { listing_id: l.id });
        } catch (e) { WATCH.msg = '⚠️ ساخت پیش‌نویس: ' + e.message; }
      }
      notify('آگهی تازه دیوار', parsed.title || url);
    }
    seenAll[sr.url] = seen.slice(0, 600);
  }
  store.set('amlak-watch-seen', seenAll);
  if (blocked === searches.length) throw new Error('دیوار اجازه جستجوی مستقیم از داخل اپ را نداد');
  if (!baseline) WATCH.msg = fresh ? `${fa(fresh)} آگهی تازه اضافه شد` : 'آگهی تازه‌ای نبود';
  if (fresh) { S.panel = null; if (location.hash.startsWith('#panel/divar')) viewPanel('divar'); }
}
function watchUI() {
  document.title = (WATCH.on ? '🤖 ' : '') + (CFG.name || 'املاک');
  const st = $('#wst'); if (!st) return;
  st.innerHTML = WATCH.on ? `<span class="tag ok">روشن</span> ${WATCH.busy ? 'در حال بررسی…' : esc(WATCH.msg)}${WATCH.last ? ` · آخرین بررسی ${WATCH.last.toLocaleTimeString('fa-IR')}` : ''}<br>
    این دستگاه تا حالا: ${fa(WATCH.added)} آگهی اضافه کرد · ${fa(WATCH.skipped)} آگهی املاکی رد شد` : '<span class="tag">خاموش</span>';
  const on = $('#won'); if (on) on.checked = WATCH.on;
}

// «فایل‌های دیوار»: لینک آگهی‌هایی که کارمندان در دیوار پیدا می‌کنند؛ همه مشاوران و مدیرها می‌بینند
async function panelDivar(pt) {
  const { items, searches } = await DB.divarList();
  const lists = isAdmin() ? await loadListings(true) : [], agentsAll = isAdmin() ? await loadAgents() : [];
  const lOf = id => lists.find(l => l.id === id);
  const F = S.dvF || (S.dvF = { st: 'open' });
  const sel = 'style="width:auto;min-height:32px;padding:3px 8px;font-size:13px"';
  const summary = p => [p?.deal && (p.deal === 'misc' ? MISC_KINDS[p.misc_kind] : DEAL_NAME[p.deal]), p?.area && fa(p.area) + ' متر', p?.land_area && !p?.area && 'زمین ' + fa(p.land_area) + ' متر', p?.rooms != null && fa(p.rooms) + ' خواب',
    p?.price && money(p.price), p?.deposit && 'رهن ' + money(p.deposit, false), p?.rent && 'اجاره ' + money(p.rent, false), p?.district].filter(Boolean).join(' · ');
  const c = wcfg();
  pt.innerHTML = `
    ${isAdmin() ? `<div class="card stack" style="margin-bottom:12px;border-color:var(--accent)">
      <div class="row"><h3 style="flex:1">🤖 دیده‌بان دیوار</h3><label class="check"><input type="checkbox" id="won"> روشن</label></div>
      <div class="grid2"><label class="f"><span>هر چند ثانیه یک بار</span><select id="wev">${opts([5, 10, 20, 30, 60].map(x => [x, fa(x) + ' ثانیه']), c.every)}</select></label>
        <label class="check" style="align-self:end;min-height:42px"><input type="checkbox" id="wdr"${c.drafts ? ' checked' : ''}> ثبت خودکار پیش‌نویس به نام من</label></div>
      <div class="row"><button type="button" class="btn sm" id="wnt">🔔 فعال کردن اعلان روی این دستگاه</button></div>
      <div class="small" id="wst"></div>
      <p class="small muted" style="margin:0">تا وقتی اپ روی همین دستگاه باز است (مثلا کامپیوتر دفتر)، «جستجوهای آماده» پایین صفحه مرتب بررسی می‌شوند. هر آگهی تازه این‌جا اضافه می‌شود و اعلان می‌آید. آگهی‌های املاکی رد می‌شوند. پیش‌نویس‌ها <b>مخفی</b> می‌مانند تا شما مشاور را انتخاب کنید و «انتشار» را بزنید.</p>
    </div>` : ''}
    <form class="card stack" id="dvf"><h3>افزودن آگهی از دیوار</h3>
      <p class="small muted" style="margin:0">آگهی شخصی خوبی در دیوار دیدید؟ لینکش را اینجا بگذارید تا بقیه هم ببینند و کسی با مالک تماس بگیرد.</p>
      <input name="url" required placeholder="لینک آگهی در دیوار" dir="ltr" inputmode="url">
      <textarea name="text" rows="2" placeholder="(اختیاری) متن آگهی را هم کپی کنید و اینجا بچسبانید تا مشخصات خودکار خوانده شود"></textarea>
      <input name="note" placeholder="یادداشت (اختیاری) مثلا: مالک شخصی است">
      <button class="btn primary">افزودن به فهرست</button></form>
    ${searches.length || isAdmin() ? `<div class="card stack" style="margin-top:12px"><b>جستجوهای آماده در دیوار</b>
      <div class="chips">${searches.map((x, i) => `<a class="chip" target="_blank" rel="noopener" href="${esc(x.url)}">${esc(x.name)}</a>${isAdmin() ? `<button class="chip" data-rs="${i}" aria-label="حذف" style="color:var(--bad)">×</button>` : ''}`).join('') || '<span class="small muted">هنوز جستجویی ذخیره نشده</span>'}</div>
      ${isAdmin() ? `<form class="row" id="dss"><input name="name" placeholder="نام (مثلا: آپارتمان فروشی سعادت‌آباد)" style="flex:2;min-width:160px"><input name="url" placeholder="لینک جستجو در دیوار" dir="ltr" style="flex:3;min-width:160px"><button class="btn sm">ذخیره</button></form>
      <p class="small muted" style="margin:0">در دیوار فیلترها را بزنید (مثلا «آگهی‌دهنده: شخصی»)، لینک صفحه را کپی کنید و اینجا ذخیره کنید تا همه مشاوران با یک لمس باز کنند.</p>` : ''}</div>` : ''}
    <div class="row" style="margin:14px 0 8px"><h3 style="flex:1">فهرست (${fa(items.length)})</h3>
      <select id="dvs" ${sel}>${opts([['open', 'باز (جدید و تماس گرفته)'], ['all', 'همه'], ...Object.entries(DIVAR_ST).map(([k, v]) => [k, v[0]])], F.st)}</select></div>
    <div class="tbl" id="dvl"></div>`;
  const draw = () => {
    const r = items.filter(x => F.st === 'all' || (F.st === 'open' ? ['new', 'called'].includes(x.status) : x.status === F.st));
    $('#dvl').innerHTML = r.length ? r.map(x => `<div class="tr" style="align-items:flex-start"><div class="mid">
      <div class="row"><b style="flex:1;white-space:normal">${esc(x.title || 'آگهی دیوار')}</b><span class="tag ${DIVAR_ST[x.status]?.[1] || ''}">${DIVAR_ST[x.status]?.[0] || ''}</span></div>
      ${summary(x.parsed) ? `<div class="small">${esc(summary(x.parsed))}</div>` : ''}
      ${x.note ? `<div class="small muted">📝 ${esc(x.note)}</div>` : ''}
      <div class="small muted">${esc(DB.nameOf(x.by))} · ${ago(x.at)}${x.listing_id ? ` · <a href="#l/${x.listing_id}">آگهی کد ${fa(x.listing_id)}</a>` : ''}</div>
      ${isAdmin() && x.listing_id && lOf(x.listing_id) ? (L => `<div class="row" style="margin-top:6px;padding:8px;border-radius:12px;background:var(--sunk)">
        <span class="small" style="flex:1">${L.status === 'hidden' ? '📝 پیش‌نویس (مخفی)' : '✅ منتشر شده'} · مشاور:</span>
        <select data-asg="${L.id}" ${sel}>${opts([...agentsAll.map(a => [a.id, a.full_name]), ...(agentsAll.some(a => a.id === L.agent_id) ? [] : [[L.agent_id, '—']])], L.agent_id)}</select>
        ${L.status === 'hidden' ? `<button class="btn sm primary" data-pub="${L.id}" data-dv="${x.id}">انتشار</button>` : ''}<a class="btn sm" href="#edit/${L.id}">ویرایش</a></div>`)(lOf(x.listing_id)) : ''}
      <div class="row" style="margin-top:6px"><a class="btn sm" href="${esc(x.url)}" target="_blank" rel="noopener">باز کردن در دیوار</a>
        ${x.status !== 'listed' && !x.listing_id ? `<button class="btn sm primary" data-mk="${x.id}">ثبت به‌عنوان آگهی</button>` : ''}
        <select data-dst="${x.id}" ${sel}>${opts(Object.entries(DIVAR_ST).map(([k, v]) => [k, v[0]]), x.status)}</select>
        ${isAdmin() || x.by === S.me.id ? `<button class="btn sm ghost" data-dd="${x.id}" style="color:var(--bad)">حذف</button>` : ''}</div></div></div>`).join('')
      : '<div class="empty">موردی نیست.</div>';
    $$('[data-mk]').forEach(b => b.addEventListener('click', () => { const x = items.find(y => y.id === b.dataset.mk); S.prefill = { ...(x.parsed || {}), title: x.parsed?.title || x.title, source_url: x.url, _divarId: x.id }; go('edit/new'); }));
    $$('[data-dst]').forEach(s => s.addEventListener('change', async () => { try { await DB.divarUpdate(s.dataset.dst, { status: s.value }); items.find(y => y.id === s.dataset.dst).status = s.value; toast('ذخیره شد', 1200); draw(); } catch (e) { toast(e.message); } }));
    $$('[data-asg]').forEach(s => s.addEventListener('change', async () => {
      try { await DB.saveListing({ id: +s.dataset.asg, agent_id: s.value }, true); S.listings = null; toast('به مشاور ارجاع شد', 1500); } catch (e) { toast(e.message); }
    }));
    $$('[data-pub]').forEach(b => b.addEventListener('click', async () => {
      const L = lOf(+b.dataset.pub); if (!L.district && !confirm('محله این آگهی خالی است. همین‌طور منتشر شود؟')) return;
      b.disabled = true;
      try { await DB.saveListing({ id: L.id, status: 'active' }, true); await DB.divarUpdate(b.dataset.dv, { status: 'listed' }); S.listings = null; toast('منتشر شد ✓'); viewPanel('divar', true); }
      catch (e) { toast(e.message); b.disabled = false; }
    }));
    $$('[data-dd]').forEach(b => b.addEventListener('click', async () => { if (!confirm('از فهرست حذف شود؟')) return; try { await DB.divarDelete(b.dataset.dd); viewPanel('divar', true); } catch (e) { toast(e.message); } }));
  };
  $('#dvs').addEventListener('change', e => { F.st = e.target.value; draw(); });
  if (isAdmin()) {
    watchUI();
    $('#won').addEventListener('change', e => e.target.checked ? watchStart() : watchStop());
    $('#wev').addEventListener('change', e => wsave({ every: +e.target.value }));
    $('#wdr').addEventListener('change', e => wsave({ drafts: e.target.checked }));
    $('#wnt').addEventListener('click', async () => {
      if (!window.Notification) return toast('این مرورگر اعلان ندارد؛ صدا و پیام داخل اپ کار می‌کند');
      const r = await Notification.requestPermission(); toast(r === 'granted' ? 'اعلان فعال شد' : 'اجازه اعلان داده نشد');
    });
  }
  $('#dvf').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, b = $('button', f), url = f.url.value.trim(), text = f.text.value.trim();
    if (!Divar.tokenOf(url)) return toast('لینک آگهی دیوار درست نیست');
    b.disabled = true; b.textContent = 'در حال افزودن…';
    let parsed = {};
    try { parsed = await Divar.fetchAd(url); } catch { }
    if (text) parsed = { ...Divar.parseAdText(text), ...Object.fromEntries(Object.entries(parsed).filter(([, v]) => v != null && v !== '')) };
    delete parsed._images; if (parsed.description) parsed.description = parsed.description.slice(0, 1500);
    try { await DB.divarAdd({ url, note: f.note.value.trim(), title: parsed.title || 'آگهی دیوار', parsed }); toast('اضافه شد'); viewPanel('divar', true); }
    catch (err) { toast(err.message); b.disabled = false; b.textContent = 'افزودن به فهرست'; }
  });
  $('#dss')?.addEventListener('submit', async e => {
    e.preventDefault(); const name = e.target.name.value.trim(), url = e.target.url.value.trim();
    if (!name || !/^https:\/\/divar\.ir\//.test(url)) return toast('نام و لینک جستجوی دیوار (شروع با https://divar.ir/) را وارد کنید');
    try { await DB.divarSaveSearches([...searches, { name, url }]); viewPanel('divar', true); } catch (err) { toast(err.message); }
  });
  $$('[data-rs]').forEach(b => b.addEventListener('click', async () => { if (!confirm('این جستجو حذف شود؟')) return; try { await DB.divarSaveSearches(searches.filter((_, i) => i !== +b.dataset.rs)); viewPanel('divar', true); } catch (e) { toast(e.message); } }));
  draw();
}

async function panelAdmins(pt, all) {
  const { staff, log } = await DB.activity();
  const by = Object.fromEntries(staff.map(s => [s.id, s]));
  const admins = staff.filter(s => s.role === 'admin' && s.id !== S.me.id);
  const ACT = { login: 'ورود', created: 'ساخت حساب مدیر', join: 'عضویت با لینک دعوت' };
  pt.innerHTML = `<p class="muted small" style="margin-top:0">این بخش فقط برای شما (مدیر اصلی) نمایش داده می‌شود. بقیه مدیرها نه این صفحه را می‌بینند و نه بقیه مدیرها را.</p>
    <h3 style="margin-bottom:8px">مدیرها (${fa(admins.length)})</h3>
    <div class="tbl">${admins.map(a => `<div class="tr"><div class="avatar" style="width:44px;height:44px;font-size:17px">${esc(a.full_name[0])}</div>
      <div class="mid"><b>${esc(a.full_name)} ${a.active ? '' : '<span class="tag bad">غیرفعال</span>'}</b>
      <div class="small muted">عضو از ${new Date(a.created_at).toLocaleDateString('fa-IR')} · ${fa(a.logins || 0)} بار ورود</div>
      <div class="small muted">آخرین ورود: ${a.last_login ? ago(a.last_login) : '—'} · ${fa(all.filter(l => l.agent_id === a.id).length)} آگهی</div>
      <label class="check small" style="margin-top:4px"><input type="checkbox" data-adm="${a.id}"${a.active ? ' checked' : ''}> دسترسی فعال</label></div></div>`).join('') || '<div class="empty">هنوز مدیر دیگری عضو نشده است.</div>'}</div>
    <h3 style="margin:16px 0 8px">آخرین ورودها</h3>
    <div class="tbl">${log.slice(0, 40).map(e => { const u = by[e.uid]; return `<div class="tr" style="padding:8px 10px"><div class="mid">
      <b style="font-weight:500">${esc(u?.full_name || 'حذف‌شده')} <span class="tag${u?.role === 'admin' ? ' sale' : ''}">${u?.role === 'admin' ? 'مدیر' : 'مشاور'}</span></b>
      <div class="small muted">${ACT[e.action] || e.action} · ${ago(e.at)} · ${new Date(e.at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })} · ${esc(e.device || '')}</div></div></div>`; }).join('') || '<div class="empty">هنوز ورودی ثبت نشده است.</div>'}</div>`;
  $$('[data-adm]').forEach(c => c.addEventListener('change', async () => {
    if (!c.checked && !confirm('دسترسی این مدیر قطع شود؟')) { c.checked = true; return; }
    try { await DB.updateProfile(c.dataset.adm, { active: c.checked }); S.agents = null; S.panel = null; toast('ذخیره شد', 1200); viewPanel('admins'); } catch (e) { toast(e.message); }
  }));
}

async function panelDesigns(pt) {
  const ds = await loadDesigns(true);
  pt.innerHTML = `<div class="row" style="margin-bottom:10px"><span class="muted small" style="flex:1">این بخش را فقط ادمین مدیریت می‌کند و مشتری‌ها در تب «طراحی‌ها» می‌بینند.</span>
    <a class="btn sm primary" href="#dedit/new">${I.plus} نمونه‌کار جدید</a></div>
    <div class="tbl">${ds.map(d => `<div class="tr"><img src="${esc(imgSrc(d.images?.[0], d.id * 10))}" alt=""><div class="mid"><b>${esc(d.title)}</b>
    <div class="small muted">${esc([d.style, d.space].filter(Boolean).join(' · '))} · ${fa(d.images?.length || 0)} عکس</div></div>
    <a class="btn sm" href="#dedit/${d.id}">ویرایش</a></div>`).join('') || '<div class="empty">هنوز نمونه‌کاری نیست.</div>'}</div>`;
}

function panelMe(pt) {
  const m = S.me;
  pt.innerHTML = `<form class="card stack" id="pf" style="max-width:520px">
    <label class="f"><span>نام و نام خانوادگی</span><input name="full_name" value="${esc(m.full_name)}" required></label>
    <label class="f"><span>موبایل (روی آگهی‌ها به مشتری نمایش داده می‌شود)</span><input name="phone" inputmode="tel" value="${esc(m.phone)}"></label>
    <label class="f"><span>معرفی کوتاه</span><input name="bio" value="${esc(m.bio || '')}" placeholder="مثلا: متخصص آپارتمان‌های منطقه ۲" maxlength="120"></label>
    <button class="btn primary">ذخیره</button></form>
    ${DEMO ? '' : `<form class="card stack" id="pw" style="max-width:520px;margin-top:12px"><b>تغییر رمز عبور</b>${isAdmin() ? '' : '<span class="small muted">بعد از تغییر رمز، برای گوشی جدید از مدیر لینک دعوت تازه بگیرید.</span>'}
      <input name="pw" type="password" minlength="6" required placeholder="رمز جدید" dir="ltr" autocomplete="new-password"><button class="btn">تغییر رمز</button></form>`}
    <div class="row" style="margin-top:12px"><button class="btn danger" id="out">خروج از حساب</button>
    ${DB.caps.github ? '<button class="btn ghost" id="unlink">جدا کردن این گوشی از سامانه</button>' : ''}</div>`;
  $('#pf').addEventListener('submit', async e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    try { await DB.updateProfile(m.id, f); Object.assign(S.me, f); S.agents = null; renderChrome('panel'); toast('ذخیره شد'); } catch (err) { toast(err.message); }
  });
  $('#pw')?.addEventListener('submit', async e => { e.preventDefault(); try { await DB.setPassword(e.target.pw.value); e.target.reset(); toast('رمز تغییر کرد'); } catch (err) { toast(err.message); } });
  $('#out').addEventListener('click', logout);
  $('#unlink')?.addEventListener('click', async () => { if (confirm('اتصال این گوشی قطع شود؟ برای اتصال دوباره لینک دعوت (یا توکن، برای مدیر) لازم است.')) { DB.forgetDevice(); S.me = null; invalidate(); go('sale'); } });
}

/* ---------- آپلودر عکس (مشترک بین آگهی و طراحی) ---------- */
function uploader(el, list, max = 20) {
  const draw = () => {
    el.innerHTML = list.map((u, i) => `<div class="im"><img src="${esc(imgSrc(u, i))}" alt="">${i === 0 ? '<span class="first">کاور</span>' : `<span class="first" style="background:rgb(0 0 0/.55);cursor:pointer" data-cv="${i}">کاور کن</span>`}<button type="button" data-rm="${i}" aria-label="حذف">×</button></div>`).join('')
      + (list.length < max ? `<label class="add">${I.plus}<span>افزودن عکس</span><input type="file" accept="image/*" multiple hidden></label>` : '')
      + (max > 1 ? `<div class="small muted" style="grid-column:1/-1">${fa(list.length)} از ${fa(max)} عکس${list.length >= max ? ' — به حداکثر رسیده' : ''}</div>` : '');
    $$('[data-rm]', el).forEach(b => b.addEventListener('click', () => { list.splice(+b.dataset.rm, 1); draw(); }));
    $$('[data-cv]', el).forEach(b => b.addEventListener('click', () => { const [x] = list.splice(+b.dataset.cv, 1); list.unshift(x); draw(); }));
    $('input', el)?.addEventListener('change', async e => {
      const files = [...e.target.files].slice(0, max - list.length);
      if (e.target.files.length > files.length) toast(`حداکثر ${fa(max)} عکس مجاز است؛ ${fa(files.length)} عکس اول اضافه می‌شود`, 3500);
      const add = $('.add', el); add.innerHTML = '<div class="spin" style="margin:0"></div>'; el.dataset.busy = 1;
      for (const f of files) { try { list.push(await DB.upload(f)); } catch (err) { toast(err.message); } }
      delete el.dataset.busy; draw();
    });
  };
  draw();
}

/* ---------- فرم ثبت / ویرایش آگهی ---------- */
async function viewEdit(arg) {
  const all = await loadListings(true), agents = await loadAgents(), admin = isAdmin();
  const isNew = arg === 'new';
  const l = isNew ? { deal: ['rent', 'misc'].includes(S.lastList) ? S.lastList : 'sale', ptype: 'apartment', features: [], images: [], status: 'active', city: '' } : all.find(x => x.id === +arg);
  if (!l || (!isNew && !canEdit(l))) { view().innerHTML = `<div class="empty">${I.empty}<p>این آگهی پیدا نشد یا اجازه ویرایش آن را ندارید.</p></div>`; return; }
  const priv = isNew ? {} : (await DB.getPrivate(l.id).catch(() => null)) || {};
  const imgs = [...(l.images || [])], feats = new Set(l.features || []);
  const num = (n, label, v, ph = '', hint = false) => `<label class="f"><span>${label}</span><input name="${n}" inputmode="${n === 'floor' ? 'text' : 'numeric'}" value="${v != null && v !== '' ? (hint ? fa(v) : faStr(v)) : ''}" placeholder="${ph}" ${hint ? 'data-money' : ''}>${hint ? '<small class="hint" style="display:block;color:var(--accent);min-height:1.4em"></small>' : ''}</label>`;
  view().innerHTML = `<button class="back" onclick="history.back()">${I.back} بازگشت</button>
  <h2 style="margin-bottom:12px">${isNew ? 'ثبت آگهی جدید' : `ویرایش آگهی کد ${fa(l.id)}`}</h2>
  <form id="ef" class="stack" novalidate>
    <details class="card" id="imp"${isNew ? ' open' : ''}><summary style="cursor:pointer"><b>📥 پر کردن خودکار از دیوار</b></summary>
      <div class="stack" style="margin-top:10px">
        <input id="impUrl" placeholder="لینک آگهی در دیوار" dir="ltr" inputmode="url">
        <textarea id="impText" rows="3" placeholder="اگر لینک کار نکرد: متن آگهی را در دیوار کپی کنید و اینجا بچسبانید"></textarea>
        <button type="button" class="btn" id="impGo">پر کردن فیلدها</button>
        <p class="small muted" style="margin:0">فقط آگهی مالکانی را وارد کنید که با آن‌ها هماهنگ کرده‌اید. بعد از پر شدن، همه فیلدها را یک بار بررسی کنید.</p>
      </div></details>
    <div class="card stack">
      <div class="seg" id="deal">${Object.entries(DEAL_NAME).map(([k, t]) => `<button type="button" data-d="${k}" class="${l.deal === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <label class="f" id="pmisc" ${l.deal === 'misc' ? '' : 'hidden'}><span>نوع واگذاری</span><select name="misc_kind">${opts(Object.entries(MISC_KINDS), l.misc_kind || 'presale')}</select></label>
      <div class="grid2"><label class="f"><span>نوع ملک</span><select name="ptype">${opts(Object.entries(PTYPES), l.ptype)}</select></label>
        <label class="f"><span>وضعیت</span><select name="status">${opts(Object.entries(STATUS).map(([k, v]) => [k, v[0]]), l.status)}</select></label></div>
      <label class="f"><span>عنوان آگهی *</span><input name="title" required maxlength="120" value="${esc(l.title || '')}" placeholder="مثلا: آپارتمان ۱۲۰ متری نوساز با ویو ابدی"></label>
      <div class="grid2"><label class="f"><span>شهر</span><input name="city" value="${esc(l.city || '')}" placeholder="تهران"></label>
        <label class="f"><span>محله *</span><input name="district" required value="${esc(l.district || '')}" placeholder="سعادت‌آباد"></label></div>
    </div>
    <div class="card stack"><h3>قیمت (تومان)</h3>
      <div id="psale" ${l.deal !== 'rent' ? '' : 'hidden'}>${num('price', 'قیمت کل / ارزش', l.price, 'مثلا ۱۴۵۰۰۰۰۰۰۰۰ — صفر یعنی توافقی', true)}</div>
      <div id="prent" class="grid2" ${l.deal === 'rent' ? '' : 'hidden'}>${num('deposit', 'رهن / ودیعه', l.deposit, '', true)}${num('rent', 'اجاره ماهانه (۰ = رهن کامل)', l.rent, '', true)}</div>
      <div id="pwarn" class="small" style="color:var(--bad)" hidden></div>
    </div>
    <div class="card stack"><h3>مشخصات</h3>
      <div class="grid3">${num('area', 'متراژ بنا (متر)', l.area)}${num('land_area', 'متراژ زمین', l.land_area)}${num('rooms', 'اتاق خواب', l.rooms)}
        ${num('floor', 'طبقه (زیرزمین: ‎-۱)', l.floor)}${num('floors', 'تعداد طبقات', l.floors)}${num('year_built', 'سال ساخت', l.year_built, '۱۴۰۰')}</div>
      <div><span class="muted small">امکانات</span><div class="chips" id="fe" style="margin-top:4px">${FEATURES.map(f => `<button type="button" class="chip${feats.has(f) ? ' on' : ''}" data-f="${f}">${f}</button>`).join('')}</div></div>
      <label class="f"><span>توضیحات</span><textarea name="description" maxlength="4000" rows="5">${esc(l.description || '')}</textarea></label>
    </div>
    <div class="card stack"><h3>عکس‌ها</h3><p class="muted small" style="margin:0">عکس اول، کاور آگهی است. عکس‌ها قبل از ارسال کم‌حجم می‌شوند.</p><div class="upl" id="up"></div></div>
    <div class="card stack private"><h3>🔒 اطلاعات محرمانه</h3><p class="muted small" style="margin:0">فقط شما و ادمین می‌بینید؛ هرگز به مشتری نمایش داده نمی‌شود.</p>
      <div class="grid2"><label class="f"><span>نام مالک</span><input name="owner_name" value="${esc(priv.owner_name || '')}"></label>
        <label class="f"><span>تلفن مالک</span><input name="owner_phone" inputmode="tel" value="${esc(priv.owner_phone || '')}"></label></div>
      <label class="f"><span>آدرس دقیق</span><input name="exact_address" value="${esc(priv.exact_address || '')}"></label>
      <label class="f"><span>یادداشت داخلی</span><textarea name="notes" rows="2">${esc(priv.notes || '')}</textarea></label>
      <label class="f"><span>لینک آگهی منبع در دیوار (اختیاری)</span><input name="source_url" dir="ltr" value="${esc(priv.source_url || '')}"></label>
      ${isNew ? '' : `<div class="small muted">تاریخ ثبت: ${fullDate(l.created_at)} · آخرین ویرایش: ${fullDate(l.updated_at || l.created_at)}</div>`}
    </div>
    ${admin ? `<div class="card stack"><h3>تنظیمات ادمین</h3>
      <label class="f"><span>مشاور مسئول این آگهی</span><select name="agent_id">${opts([...agents.map(a => [a.id, a.full_name]), ...(l.agent_id && !agents.some(a => a.id === l.agent_id) ? [[l.agent_id, 'مشاور فعلی (غیرفعال)']] : [])], l.agent_id || S.me.id)}</select></label>
      <div class="row"><label class="check"><input type="checkbox" name="featured"${l.featured ? ' checked' : ''}> آگهی ویژه (بالای فهرست)</label>
      <label class="check"><input type="checkbox" name="verified"${l.verified ? ' checked' : ''}> نشان «تأیید شده»</label></div></div>` : ''}
    <div class="row"><button class="btn primary" style="flex:1" id="sv">${isNew ? 'ثبت آگهی' : 'ذخیره تغییرات'}</button>${isNew ? '' : '<button type="button" class="btn danger" id="del">حذف</button>'}</div>
  </form>`;
  let deal = l.deal;
  const setDeal = d => { deal = d; $$('#deal button').forEach(x => x.classList.toggle('on', x.dataset.d === d)); $('#psale').hidden = d === 'rent'; $('#prent').hidden = d !== 'rent'; $('#pmisc').hidden = d !== 'misc'; checkPrice(); };
  const f0 = $('#ef'), val = k => toNum(f0[k]?.value);
  const checkPrice = () => { const w = window.Divar ? Divar.priceWarning({ deal, price: val('price'), area: val('area'), land_area: val('land_area'), deposit: val('deposit'), rent: val('rent') }) : ''; $('#pwarn').hidden = !w; $('#pwarn').textContent = w ? '⚠️ ' + w : ''; };
  $$('#deal button').forEach(b => b.addEventListener('click', () => setDeal(b.dataset.d)));
  ['price', 'area', 'land_area', 'deposit', 'rent'].forEach(k => f0[k]?.addEventListener('input', checkPrice));
  // پر کردن فرم از اطلاعات دیوار
  const fill = d => {
    let n = 0; const setv = (k, v, money) => { if (v == null || v === '' || !f0[k]) return; f0[k].value = money ? fa(v) : typeof v === 'number' ? faStr(v) : v; f0[k].dispatchEvent(new Event('input')); n++; };
    if (d.deal) setDeal(d.deal);
    if (d.misc_kind) f0.misc_kind.value = d.misc_kind;
    if (d.ptype) { f0.ptype.value = d.ptype; n++; }
    setv('title', d.title && d.title.slice(0, 120)); setv('city', d.city); setv('district', d.district);
    setv('price', d.price, true); setv('deposit', d.deposit, true); setv('rent', d.rent, true);
    for (const k of ['area', 'land_area', 'rooms', 'floor', 'floors', 'year_built']) setv(k, d[k]);
    if (d.description && !f0.description.value.trim()) setv('description', d.description);
    for (const ft of d.features || []) { if (!feats.has(ft)) { feats.add(ft); $(`#fe [data-f="${ft}"]`)?.classList.add('on'); n++; } }
    if (d.source_url) f0.source_url.value = d.source_url;
    checkPrice();
    return n;
  };
  $('#impGo').addEventListener('click', async () => {
    const url = $('#impUrl').value.trim(), text = $('#impText').value.trim(), b = $('#impGo');
    if (!url && !text) return toast('لینک یا متن آگهی را وارد کنید');
    b.disabled = true; b.textContent = 'در حال خواندن…';
    let d = {}, fromLink = false;
    try {
      if (url) { try { d = await Divar.fetchAd(url); fromLink = true; } catch (e) { if (!text) { toast(e.blocked ? 'دیوار اجازه خواندن مستقیم نداد؛ متن آگهی را کپی کنید و در کادر پایین بچسبانید' : e.message, 6000); $('#impText').focus(); return; } } }
      if (text) d = { ...Divar.parseAdText(text), ...Object.fromEntries(Object.entries(d).filter(([, v]) => v != null && v !== '')) };
      if (url) d.source_url = url;
      const n = fill(d);
      toast(n ? `${fa(n)} فیلد ${fromLink ? 'از دیوار' : 'از متن'} پر شد؛ لطفا بررسی کنید` : 'اطلاعاتی پیدا نشد؛ فیلدها را دستی پر کنید', 4500);
      if (n) $('#imp').open = false;
    } finally { b.disabled = false; b.textContent = 'پر کردن فیلدها'; }
  });
  const fromBoard = isNew && S.prefill ? S.prefill : null; S.prefill = null;
  if (fromBoard) { const n = fill(fromBoard); $('#imp').open = false; toast(`${fa(n)} فیلد از «فایل‌های دیوار» پر شد؛ بررسی کنید`, 4000); }
  $$('#fe .chip').forEach(b => b.addEventListener('click', () => { feats.has(b.dataset.f) ? feats.delete(b.dataset.f) : feats.add(b.dataset.f); b.classList.toggle('on'); }));
  $$('[data-money]').forEach(i => { const h = () => { const n = toNum(i.value); i.nextElementSibling.textContent = n != null ? money(n) : ''; }; i.addEventListener('input', h); h(); });
  uploader($('#up'), imgs, 12);
  $('#ef').addEventListener('submit', async e => {
    e.preventDefault();
    if ($('#up').dataset.busy) return toast('صبر کنید تا آپلود عکس‌ها تمام شود');
    const f = e.target, v = n => f[n]?.value?.trim() ?? '', n = k => toNum(v(k));
    if (!v('title')) return toast('عنوان آگهی را وارد کنید'), f.title.focus();
    if (!v('district')) return toast('محله را وارد کنید'), f.district.focus();
    if (deal === 'rent' && n('deposit') == null && n('rent') == null) return toast('مبلغ رهن یا اجاره را وارد کنید');
    const pw = Divar?.priceWarning({ deal, price: n('price'), area: n('area'), land_area: n('land_area'), deposit: n('deposit'), rent: n('rent') });
    if (pw && !confirm(pw + '\n\nبا همین عدد ذخیره شود؟')) return;
    const rec = {
      ...(isNew ? {} : { id: l.id }), deal, ptype: v('ptype'), status: v('status'), title: v('title'), city: v('city'), district: v('district'),
      misc_kind: deal === 'misc' ? v('misc_kind') : null, price: deal !== 'rent' ? n('price') : null, deposit: deal === 'rent' ? n('deposit') : null, rent: deal === 'rent' ? n('rent') : null,
      area: n('area'), land_area: n('land_area'), rooms: n('rooms'), floor: toInt(v('floor')), floors: n('floors'), year_built: n('year_built'),
      features: [...feats], description: v('description'), images: imgs,
      ...(admin ? { agent_id: v('agent_id'), featured: f.featured.checked, verified: f.verified.checked } : {})
    };
    const b = $('#sv'); b.disabled = true;
    try {
      const saved = await DB.saveListing(rec, admin);
      await DB.savePrivate(saved.id, { owner_name: v('owner_name'), owner_phone: v('owner_phone'), exact_address: v('exact_address'), notes: v('notes'), source_url: v('source_url') });
      if (fromBoard?._divarId) await DB.divarUpdate(fromBoard._divarId, { status: 'listed', listing_id: saved.id }).catch(() => { });
      S.listings = null; S.panel = null; if (isNew) S.showAd = saved.id;
      toast(isNew ? 'آگهی ثبت شد ✓ متن آماده دیوار پایین صفحه است' : 'ذخیره شد', 3500); go('l/' + saved.id);
    } catch (err) { toast(err.message); b.disabled = false; }
  });
  $('#del')?.addEventListener('click', async () => {
    if (!confirm('این آگهی برای همیشه حذف شود؟ (برای پنهان کردن موقت، وضعیت را «مخفی» کنید)')) return;
    try { await DB.deleteListing(l.id); S.listings = null; toast('حذف شد'); go('panel'); } catch (err) { toast(err.message); }
  });
}

/* ---------- فرم نمونه‌کار طراحی (فقط ادمین) ---------- */
async function viewDesignEdit(arg) {
  const isNew = arg === 'new', d = isNew ? { images: [] } : (await loadDesigns(true)).find(x => x.id === +arg);
  if (!d) return go('designs');
  const imgs = [...(d.images || [])], before = d.before_image ? [d.before_image] : [];
  view().innerHTML = `<button class="back" onclick="history.back()">${I.back} بازگشت</button>
  <h2 style="margin-bottom:12px">${isNew ? 'نمونه‌کار طراحی جدید' : 'ویرایش نمونه‌کار'}</h2>
  <form id="df" class="stack"><div class="card stack">
    <label class="f"><span>عنوان *</span><input name="title" required value="${esc(d.title || '')}" placeholder="مثلا: بازطراحی پذیرایی آپارتمان ۱۴۰ متری"></label>
    <div class="grid2"><label class="f"><span>فضا</span><input name="space" list="spl" value="${esc(d.space || '')}"><datalist id="spl">${SPACES.map(s => `<option value="${s}">`).join('')}</datalist></label>
      <label class="f"><span>سبک</span><input name="style" list="stl" value="${esc(d.style || '')}"><datalist id="stl">${STYLES.map(s => `<option value="${s}">`).join('')}</datalist></label>
      <label class="f"><span>محل</span><input name="city" value="${esc(d.city || '')}"></label>
      <label class="f"><span>متراژ</span><input name="area" inputmode="numeric" value="${d.area ? fa(d.area) : ''}"></label></div>
    <label class="f"><span>توضیحات</span><textarea name="description" rows="4">${esc(d.description || '')}</textarea></label></div>
    <div class="card stack"><h3>عکس‌های «بعد» از اجرا</h3><div class="upl" id="up"></div></div>
    <div class="card stack"><h3>عکس «قبل» (اختیاری)</h3><p class="muted small" style="margin:0">اگر بگذارید، کنار عکس کاور به‌صورت قبل/بعد نمایش داده می‌شود.</p><div class="upl" id="ub"></div></div>
    <div class="row"><button class="btn primary" style="flex:1" id="sv">ذخیره</button>${isNew ? '' : '<button type="button" class="btn danger" id="del">حذف</button>'}</div>
  </form>`;
  uploader($('#up'), imgs, 20); uploader($('#ub'), before, 1);
  $('#df').addEventListener('submit', async e => {
    e.preventDefault();
    if ($('#up').dataset.busy || $('#ub').dataset.busy) return toast('صبر کنید تا آپلود تمام شود');
    if (!imgs.length) return toast('حداقل یک عکس اضافه کنید');
    const f = e.target;
    try {
      const s = await DB.saveDesign({ ...(isNew ? {} : { id: d.id }), title: f.title.value.trim(), space: f.space.value.trim(), style: f.style.value.trim(), city: f.city.value.trim(),
        area: toNum(f.area.value), description: f.description.value.trim(), images: imgs, before_image: before[0] || null });
      S.designs = null; toast('ذخیره شد'); go('d/' + s.id);
    } catch (err) { toast(err.message); }
  });
  $('#del')?.addEventListener('click', async () => { if (!confirm('حذف شود؟')) return; try { await DB.deleteDesign(d.id); S.designs = null; go('designs'); } catch (err) { toast(err.message); } });
}

/* ---------------- شروع ---------------- */
(async () => {
  renderChrome('sale');
  try { await DB.init(); S.me = await DB.me(); }
  catch (e) { view().innerHTML = `<div class="empty">${I.empty}<p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">تلاش دوباره</button></div>`; return; }
  addEventListener('hashchange', route);
  route();
  if (isAdmin() && wcfg().on) watchStart();   // دیده‌بان روی این دستگاه روشن مانده بود
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
})();
