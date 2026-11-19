'use strict';
/* ابزارهای دیوار: خواندن یک آگهی از لینک یا متن کپی‌شده، و ساختن متن آماده برای ثبت در دیوار.
   این فایل هیچ‌وقت خودکار و پشت‌سرهم از دیوار چیزی نمی‌خواند؛ فقط وقتی کاربر خودش لینکی بدهد. */
(function () {
  const W = {};
  const toEn = s => String(s ?? '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const norm = s => toEn(s).replace(/\u064a/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/\u200c/g, ' ').replace(/[\u064b-\u065f\u0670]/g, '').replace(/[\u066c\u060c,](?=\d{3}\b)/g, '').replace(/\u00a0/g, ' ');
  const WORDNUM = { یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10 };
  const ORD = { همکف: 0, اول: 1, دوم: 2, سوم: 3, چهارم: 4, پنجم: 5, ششم: 6, هفتم: 7, هشتم: 8, نهم: 9, دهم: 10, یازدهم: 11, دوازدهم: 12 };

  // «۱۱ میلیارد و ۳۵۰ میلیون»، «۱۱٫۳۵ میلیارد»، «۱۱٬۳۵۰٬۰۰۰٬۰۰۰ تومان»، «۹۰۰ میلیون»، «توافقی»
  W.parseMoney = function (str) {
    const s = norm(str).replace(/٫/g, '.');
    if (/توافقی/.test(s) && !/\d/.test(s)) return 0;
    let total = 0, hit = false;
    const b = s.match(/(\d+(?:\.\d+)?)\s*میلیارد/); if (b) { total += parseFloat(b[1]) * 1e9; hit = true; }
    const m = s.match(/(\d+(?:\.\d+)?)\s*میلیون/); if (m) { total += parseFloat(m[1]) * 1e6; hit = true; }
    const k = s.match(/(\d+(?:\.\d+)?)\s*هزار(?!\s*میلیارد)/); if (k && !b && !m) { total += parseFloat(k[1]) * 1e3; hit = true; }
    if (hit) return Math.round(total);
    const big = s.match(/\d[\d,]{5,}/); if (big) return Number(big[0].replace(/,/g, ''));
    return null;
  };
  const moneyAfter = (s, re) => { const m = s.match(re); return m ? W.parseMoney(m[1]) : null; };
  const MONEY = '([\\d.,]+\\s*(?:میلیارد|میلیون|هزار)?(?:\\s*و\\s*[\\d.,]+\\s*(?:میلیون|هزار))?(?:\\s*تومان)?|توافقی)';

  const FEAT = [['پارکینگ', /پارکینگ/], ['آسانسور', /آسانسور/], ['انباری', /انباری/], ['بالکن', /بالکن|تراس/], ['لابی', /لابی/], ['سرایدار', /سرایدار|نگهبان/],
    ['نوساز', /نوساز|کلید ?نخورده/], ['سند تک‌برگ', /تک ?برگ/], ['استخر', /استخر/], ['سونا و جکوزی', /سونا|جکوزی/], ['روف گاردن', /روف ?گاردن/],
    ['پکیج', /پکیج/], ['شوفاژ', /شوفاژ/], ['کولر گازی', /کولر ?گازی|اسپلیت/], ['مبله', /مبله|مبلمان/], ['قابل معاوضه', /معاوضه/], ['وام دار', /وام/], ['دسترسی به مترو', /مترو/]];
  const negated = (s, i, len) => /ندارد|نداره|ندارند/.test(s.slice(i + len, i + len + 10)) || /بدون\s*$/.test(s.slice(Math.max(0, i - 6), i));

  // متن آزاد آگهی (و جفت‌های «عنوان: مقدار» دیوار) را به فیلدهای فرم تبدیل می‌کند
  W.parseAdText = function (raw, pairs = []) {
    const s = norm(raw), out = { features: [] };
    const P = {}; for (const [k, v] of pairs) P[norm(k).trim()] = norm(v).trim();
    const pick = (...keys) => { for (const k of keys) for (const pk in P) if (pk.includes(k)) return P[pk]; return null; };
    const lines = String(raw || '').split('\n').map(x => x.trim()).filter(Boolean);
    // عنوان: اولین خط کوتاه
    const t = lines.find(x => x.length >= 6 && x.length <= 90 && !/^[-—_=*•]+$/.test(x));
    if (t) out.title = t.replace(/^[#*\s🏡🏠🏙️✨🌟]+|[*\s✨🌟]+$/g, '').replace(/\*\*/g, '').trim();
    // نوع معامله
    if (/پیش ?فروش/.test(s)) { out.deal = 'misc'; out.misc_kind = 'presale'; }
    else if (/مشارکت/.test(s)) { out.deal = 'misc'; out.misc_kind = 'partner'; }
    else if (/سرقفلی/.test(s)) { out.deal = 'misc'; out.misc_kind = 'goodwill'; }
    else if (/^[^\n]{0,60}معاوضه/.test(s)) { out.deal = 'misc'; out.misc_kind = 'swap'; }
    else if (/کلنگی/.test(s)) { out.deal = 'misc'; out.misc_kind = 'old'; }
    else if (/رهن|اجاره|ودیعه/.test(s) && !/فروش/.test(s.slice(0, 120))) out.deal = 'rent';
    else if (/فروش|قیمت کل|متری \d/.test(s)) out.deal = 'sale';
    // نوع ملک
    const head = (out.title || '') + ' ' + s.slice(0, 200);
    out.ptype = /زمین|کلنگی/.test(head) ? 'land' : /باغ/.test(head) ? 'garden' : /مغازه|تجاری|سرقفلی/.test(head) ? 'commercial' : /دفتر|اداری/.test(head) ? 'office'
      : /ویلا|ویلایی|خانه/.test(head) && !/آپارتمان/.test(head) ? 'villa' : /آپارتمان|واحد|برج/.test(head) ? 'apartment' : null;
    // اعداد
    const num = v => v == null ? null : (m => m ? Number(m[0]) : null)(norm(v).match(/\d+/));
    out.area = num(pick('متراژ')) ?? num((s.match(/متراژ(?:\s*بنا)?\s*[:：]?\s*(\d{2,5})/) || [])[1]) ?? num((s.match(/(\d{2,5})\s*(?:متر|متری|مترمربع)(?!\s*زمین)/) || [])[1]);
    out.land_area = num(pick('متراژ زمین', 'زمین')) ?? num((s.match(/(?:متراژ\s*)?زمین\s*[:：]?\s*(\d{2,6})/) || [])[1]) ?? num((s.match(/(\d{2,6})\s*متر(?:ی)?\s*زمین/) || [])[1]);
    if (out.ptype === 'land') { out.land_area = out.land_area || out.area; out.area = null; }
    let rooms = pick('اتاق'); if (rooms) out.rooms = /بدون/.test(rooms) ? 0 : num(rooms) ?? WORDNUM[rooms];
    if (out.rooms == null) { const r = s.match(/(\d|یک|دو|سه|چهار|پنج)\s*(?:خواب|خوابه)/) || s.match(/(?:تعداد\s*)?اتاق(?:\s*خواب)?\s*[:：]?\s*(\d)/); if (r) out.rooms = WORDNUM[r[1]] ?? Number(r[1]); }
    const yr = pick('ساخت') ?? (s.match(/(?:سال\s*)?ساخت\s*[:：]?\s*(\d{2,4})/) || [])[1];
    if (yr) { let y = num(yr); if (y && y < 100) y += 1300; if (y >= 1300 && y <= 1500) out.year_built = y; }
    const fl = pick('طبقه') ?? (s.match(/طبقه\s*[:：]?\s*([^\n،,.]{1,20})/) || [])[1];
    if (fl) { const f = norm(fl); const o = Object.keys(ORD).find(k => f.includes(k)); const m = f.match(/(-?\d+)(?:\s*از\s*(\d+))?/);
      if (m) { out.floor = Number(m[1]); if (m[2]) out.floors = Number(m[2]); } else if (o) out.floor = ORD[o]; }
    // قیمت‌ها
    if (out.deal === 'rent') {
      out.deposit = W.parseMoney(pick('ودیعه', 'رهن') || '') ?? moneyAfter(s, new RegExp('(?:ودیعه|رهن)(?:\\s*کامل)?\\s*[:：]?\\s*' + MONEY));
      out.rent = /رهن\s*کامل/.test(s) ? 0 : (W.parseMoney(pick('اجاره') || '') ?? moneyAfter(s, new RegExp('اجاره(?:\\s*ماهانه)?\\s*[:：]?\\s*' + MONEY)));
    } else {
      out.price = W.parseMoney(pick('قیمت کل') || '') ?? moneyAfter(s, new RegExp('قیمت(?:\\s*کل|\\s*نهایی)?\\s*[:：]?\\s*' + MONEY)) ?? moneyAfter(s, new RegExp(MONEY.replace('|توافقی', '')));
      const ppm = W.parseMoney(pick('قیمت هر متر') || '') ?? moneyAfter(s, new RegExp('(?:قیمت\\s*)?(?:هر\\s*)?متری\\s*' + MONEY));
      if (!out.price && ppm && out.area) out.price = ppm * out.area;
    }
    // امکانات
    const featText = s + '\n' + pairs.map(([k, v]) => norm(k) + ' ' + norm(v)).join('\n');
    for (const [name, re] of FEAT) {
      const g = new RegExp(re.source, 'g'); let m, ok = false;
      while ((m = g.exec(featText))) { if (!negated(featText, m.index, m[0].length)) { ok = true; break; } }
      if (ok && !(name === 'قابل معاوضه' && out.misc_kind === 'swap')) out.features.push(name);
    }
    // محله و شهر (زیرعنوان دیوار: «... در تهران، سعادت‌آباد»)
    const loc = s.match(/در\s+([؀-ۿ ]{2,20})،\s*([؀-ۿ ]{2,30})/);
    if (loc) { out.city = loc[1].trim(); out.district = loc[2].trim(); }
    else { const d = s.match(/(?:محله|منطقه)\s*[:：]?\s*([؀-ۿ ]{2,25})/); if (d) out.district = d[1].trim(); }
    out.description = String(raw || '').replace(/\*\*/g, '').trim().slice(0, 3800);
    for (const k of Object.keys(out)) if (out[k] == null || Number.isNaN(out[k])) delete out[k];
    return out;
  };

  // توکن آگهی از لینک دیوار: https://divar.ir/v/عنوان/gZ1aBcDe
  W.tokenOf = url => { const m = String(url || '').match(/divar\.ir\/v\/(?:[^/?#]*\/)?([A-Za-z0-9_-]{6,12})(?:[/?#]|$)/); return m ? m[1] : null; };

  // تلاش برای خواندن یک آگهی از دیوار (اگر دیوار اجازه بدهد). اگر نشد، کاربر متن را کپی می‌کند.
  W.fetchAd = async function (url) {
    const token = W.tokenOf(url);
    if (!token) throw new Error('لینک دیوار درست نیست؛ لینک کامل آگهی را از دکمه «اشتراک‌گذاری» دیوار کپی کنید');
    let j;
    try {
      const r = await fetch('https://api.divar.ir/v8/posts-v2/web/' + token, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(r.status === 404 ? 'این آگهی در دیوار پیدا نشد (شاید حذف شده)' : 'دیوار جواب نداد');
      j = await r.json();
    } catch (e) { const x = new Error(e.message && /پیدا نشد/.test(e.message) ? e.message : 'دیوار اجازه خواندن مستقیم نداد'); x.blocked = true; throw x; }
    // ساختار پاسخ دیوار گاهی عوض می‌شود؛ پس همه «عنوان/مقدار»ها و متن‌ها را عمومی جمع می‌کنیم
    const pairs = [], texts = [], images = [], labels = []; let title = '', subtitle = '';
    (function walk(o, depth) {
      if (!o || typeof o !== 'object' || depth > 14) return;
      if (Array.isArray(o)) return o.forEach(x => walk(x, depth + 1));
      if (o.widget_type === 'LEGEND_TITLE_ROW' && o.data) { title = title || o.data.title || ''; subtitle = subtitle || o.data.subtitle || ''; }
      if (typeof o.title === 'string' && (typeof o.value === 'string' || typeof o.value === 'number')) pairs.push([o.title, String(o.value)]);
      else if (typeof o.title === 'string' && o.title.length < 30) labels.push(o.title + (o.available === false || o.disabled === true ? ' ندارد' : ''));   // امکانات بدون مقدار
      if (typeof o.text === 'string' && o.text.length > 25) texts.push(o.text);
      if (typeof o.url === 'string' && /divarcdn\.com/.test(o.url) && /\.(jpe?g|webp|png)/.test(o.url)) images.push(o.url);
      for (const k in o) walk(o[k], depth + 1);
    })(j, 0);
    if (!title && j.seo?.title) title = j.seo.title;
    if (!title && !pairs.length && !texts.length) { const x = new Error('اطلاعاتی از دیوار دریافت نشد'); x.blocked = true; throw x; }
    const raw = [title, subtitle, ...pairs.map(([k, v]) => `${k}: ${v}`), ...labels.filter(x => x !== title), ...texts].join('\n');
    const out = W.parseAdText(raw, pairs);
    if (title) out.title = title;
    out.description = texts.join('\n\n').slice(0, 3800) || out.description;
    out._images = [...new Set(images)];
    out._labels = [subtitle, ...labels].filter(Boolean);
    out._token = token;
    return out;
  };

  // آیا آگهی‌دهنده بنگاه/مشاور املاک است؟ (برای جدا کردن آگهی‌های شخصی)
  // برچسب‌های دیوار (نام آگهی‌دهنده / نشان کسب‌وکار) معتبرترند؛ در متن، جمله‌هایی مثل «مشاورین املاک تماس نگیرند» نشانه آگهی شخصی است
  W.isAgency = d => {
    const labels = (d?._labels || []).join('\n');
    if (/مشاور(?:ین)? املاک|آژانس|املاک\s+\S+|کسب ?و ?کار|business/i.test(labels)) return true;
    const text = norm([d?.title, d?.description].join('\n')).replace(/(مشاور(?:ین|ان)?(?:\s*محترم)?\s*املاک|بنگاه(?:ها|داران)?|املاکی(?:ها)?)[^.\n!]{0,30}(تماس\s*نگیر|نگیرند|نپذیر|معذور|ممنوع|نزنند)/g, '');
    return /(?:^|\n)\s*(?:املاک|مشاور املاک|آژانس املاک)\s+[؀-ۿ]+|مشاور(?:ین)? املاک\s+[؀-ۿ]+\s*(?:$|\n)|کد\s*مشاور/.test(text);
  };

  // توکن‌های آگهی‌های یک صفحه جستجوی دیوار (مثلا https://divar.ir/s/tehran/buy-apartment?user_type=personal)
  function collectTokens(x) {
    const out = [];
    const add = t => { if (t && /^[A-Za-z0-9_-]{8}$/.test(t) && !out.includes(t)) out.push(t); };
    if (typeof x === 'string') {
      for (const m of x.matchAll(/\/v\/[^"'\s<>]*?\/([A-Za-z0-9_-]{8})(?=["'?#\s<>/]|$)/g)) add(m[1]);
      for (const m of x.matchAll(/"token"\s*:\s*"([A-Za-z0-9_-]{8})"/g)) add(m[1]);
      return out;
    }
    (function walk(o, d) {
      if (!o || typeof o !== 'object' || d > 16) return;
      if (Array.isArray(o)) return o.forEach(v => walk(v, d + 1));
      if (typeof o.token === 'string') add(o.token);
      for (const k in o) { const v = o[k]; if (typeof v === 'string' && v.includes('/v/')) collectTokens(v).forEach(add); else walk(v, d + 1); }
    })(x, 0);
    return out;
  }
  W.collectTokens = collectTokens;
  W.searchTokens = async function (searchUrl) {
    let u; try { u = new URL(searchUrl); } catch { throw new Error('لینک جستجوی دیوار درست نیست'); }
    const path = u.pathname.replace(/^\/s\//, '');
    const tries = [
      () => fetch('https://api.divar.ir/v8/web-search/' + path + u.search, { headers: { Accept: 'application/json' } }).then(r => r.ok ? r.json() : Promise.reject(r.status)),
      () => fetch(searchUrl, { headers: { Accept: 'text/html' } }).then(r => r.ok ? r.text() : Promise.reject(r.status))
    ];
    for (const t of tries) { try { const tok = collectTokens(await t()); if (tok.length) return tok; } catch { } }
    const e = new Error('دیوار اجازه جستجوی مستقیم نداد'); e.blocked = true; throw e;
  };

  /* ---------- متن آماده برای دیوار ---------- */
  const fa = n => Number(n).toLocaleString('fa-IR');
  const faS = s => String(s ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  function money(n) {
    if (n == null || n === '') return '';
    n = Number(n); if (!n) return 'توافقی';
    const b = Math.floor(n / 1e9), m = Math.floor(n % 1e9 / 1e6), k = Math.floor(n % 1e6 / 1e3), p = [];
    if (b) p.push(fa(b) + ' میلیارد'); if (m) p.push(fa(m) + ' میلیون'); if (!b && k) p.push(fa(k) + ' هزار');
    return (p.join(' و ') || fa(n)) + ' تومان';
  }
  // هشدار عدد غیرعادی (مثل «۱۱ هزار میلیارد» به‌جای «۱۱ میلیارد»)
  W.priceWarning = function (l) {
    if ((l.deal === 'sale' || l.deal === 'misc') && l.price) {
      if (l.price > 1e12) return `قیمت ${money(l.price)} است؛ احتمالاً چند صفر اضافه دارد.`;
      const a = l.area || l.land_area;
      if (a) { const pm = l.price / a;
        if (pm > 1.5e9) return `قیمت هر متر ${money(Math.round(pm))} می‌شود؛ احتمالاً عدد قیمت اشتباه است (صفر اضافه).`;
        if (pm < 3e6) return `قیمت هر متر ${money(Math.round(pm))} می‌شود؛ احتمالاً عدد قیمت کم است (صفر کم).`; }
    }
    if (l.deal === 'rent') {
      if (l.deposit > 5e10) return `رهن ${money(l.deposit)} است؛ احتمالاً صفر اضافه دارد.`;
      if (l.rent > 1e9) return `اجاره ماهانه ${money(l.rent)} است؛ احتمالاً صفر اضافه دارد.`;
    }
    return '';
  };

  W.adText = function (l, o = {}) {
    const P = o.ptypes || {}, K = o.kinds || {}, pt = P[l.ptype] || 'ملک';
    const where = l.district ? ` در ${l.district}` : '';
    const area = l.area ? `${fa(l.area)} متری` : l.land_area ? `${fa(l.land_area)} متری` : '';
    const feats = l.features || [];
    const star = feats.filter(f => ['نوساز', 'روف گاردن', 'استخر', 'سونا و جکوزی', 'لابی', 'مبله', 'سند تک‌برگ'].includes(f)).slice(0, 2);
    const verb = l.deal === 'rent' ? (l.rent ? 'رهن و اجاره' : 'رهن کامل') : l.deal === 'misc' ? (K[l.misc_kind] || '') : 'فروش';
    const specs = [
      l.area && `🔹 متراژ: ${fa(l.area)} متر مربع`, l.land_area && `🔹 متراژ زمین: ${fa(l.land_area)} متر`,
      l.rooms != null && l.rooms !== '' && `🔹 تعداد خواب: ${l.rooms ? fa(l.rooms) : 'بدون اتاق'}`,
      l.floor != null && l.floor !== '' && `🔹 طبقه: ${l.floor === 0 ? 'همکف' : fa(l.floor)}${l.floors ? ' از ' + fa(l.floors) : ''}`,
      l.year_built && `🔹 سال ساخت: ${faS(l.year_built)}`].filter(Boolean);
    const priceLines = l.deal === 'rent'
      ? [`🔸 رهن: ${money(l.deposit) || 'توافقی'}`, `🔸 اجاره ماهانه: ${l.rent ? money(l.rent) : 'رهن کامل'}`]
      : [`🔸 ${l.deal === 'misc' ? 'قیمت / ارزش' : 'قیمت کل'}: ${money(l.price) || 'توافقی'}`, ...(l.price && l.area && l.deal === 'sale' ? [`🔸 متری: ${money(Math.round(l.price / l.area / 1e5) * 1e5)}`] : [])];
    const agent = o.agent?.full_name ? `مشاور: ${o.agent.full_name}` : '';
    const brand = o.brand ? `${o.brand} 🏙️` : '';
    const code = l.id ? `کد آگهی: ${fa(l.id)}` : '';
    const clip = (t, n) => t.length <= n ? t : t.slice(0, n - 1).trim() + '…';
    const t1 = clip(`🏡 ${pt} ${area}${where}${star.length ? ' | ' + star.join(' | ') : ''}`.replace(/\s+/g, ' '), 50);
    const desc = (l.description || '').trim();
    const b1 = [
      `${verb} ${pt} ${area}${where} 🌟`.replace(/\s+/g, ' '), '',
      specs.length && '✅ مشخصات:', ...specs, specs.length && '',
      feats.length && '✅ امکانات:', feats.length && feats.map(f => '✔️ ' + f).join('  '), feats.length && '',
      '💰 شرایط مالی:', ...priceLines, '',
      desc && desc, desc && '',
      '📞 جهت بازدید و اطلاعات بیشتر با ما تماس بگیرید', agent, brand, code
    ].filter(x => x !== false && x !== null && x !== undefined && x !== 0).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const t2 = clip(`${verb} ${pt} ${area}${where}`.replace(/\s+/g, ' '), 50);
    const b2 = [
      `${verb} ${pt} ${area}${l.floor != null && l.floor !== '' ? ' - طبقه ' + (l.floor === 0 ? 'همکف' : fa(l.floor)) : ''}`.replace(/\s+/g, ' '), '',
      '📍 جزئیات:', ...specs.map(x => x.replace('🔹', '-')), ...feats.slice(0, 8).map(f => '- ' + f), '',
      '💰 قیمت:', ...priceLines.map(x => x.replace('🔸', '-')), '',
      'برای هماهنگی بازدید همین حالا تماس بگیرید.', agent, brand
    ].filter(x => typeof x === 'string').join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return [{ name: 'جذاب و کامل', title: t1, body: b1 }, { name: 'کوتاه و فهرستی', title: t2, body: b2 }];
  };

  window.Divar = W;
})();
