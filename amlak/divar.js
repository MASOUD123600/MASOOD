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

  // توضیحات تمیز: بدون «انتشار آگهی / آخرین نردبان / زنگ خطرها»، بدون متن مخصوص گوگل، بدون پاراگراف تکراری
  W.cleanDesc = function (t) {
    const lines = String(t || '').replace(/\*\*/g, '').split('\n').filter(x => !/^\s*(?:انتشار آگهی|آخرین نردبان|زنگ خطرهای|آگهی\s.{2,90}\sدر دیوار)/.test(x));
    const paras = lines.join('\n').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean), keep = [], seen = [];
    for (const p of paras) { const k = norm(p).replace(/\s+/g, ' '); if (seen.some(s => s.includes(k) || k.includes(s))) continue; seen.push(k); keep.push(p); }
    return keep.join('\n\n').trim();
  };
  // هر عکس دیوار در چند اندازه می‌آید؛ از هر عکس فقط یکی با کیفیت اصلی، بدون پیش‌نمایش کوچک و مات
  W.cleanImages = function (list) {
    const pick = filter => {
      const best = new Map();
      for (const u of list) {
        if (filter && /(logo|icon|avatar|placeholder|blur|thumbnail|thumb|small|_s\.|\/s\/)/i.test(u)) continue;
        const stem = (u.split('?')[0].split('/').pop() || '').replace(/\.(jpe?g|webp|png)$/i, '');
        const score = (/\.jpe?g/i.test(u) ? 2 : 0) + (/\/post\//.test(u) ? 1 : 0);
        if (!best.has(stem) || best.get(stem).score < score) best.set(stem, { u, score });
      }
      return [...best.values()].map(x => x.u);
    };
    const r = pick(true); return (r.length ? r : pick(false)).slice(0, 20);
  };
  // عمر آگهی به روز: از «انتشار آگهی: ۶ مهر ۱۴۰۵» (تاریخ اصلی، نه نردبان)، وگرنه از زیرعنوان («دقایقی پیش»، «دیروز»، «۳ روز پیش»، «ماه پیش»)
  const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  function jalaliAge(y, m, d) {
    try {
      const f = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric', day: 'numeric' }), now = Date.now();
      for (let i = 0; i < 800; i++) { const p = Object.fromEntries(f.formatToParts(new Date(now - i * 864e5)).map(x => [x.type, x.value])); if (parseInt(p.year) === y && +p.month === m && +p.day === d) return i; }
    } catch { }
    return null;
  }
  W.ageDays = function (subtitle, text) {
    const t = norm(text || ''), pub = t.match(/انتشار(?:\s*آگهی)?\s*[:：]?\s*(\d{1,2})\s+([\u0600-\u06FF]+)\s+(\d{4})/);
    if (pub) { const m = MONTHS.indexOf(pub[2]) + 1; if (m) { const a = jalaliAge(+pub[3], m, +pub[1]); if (a != null) return a; } }
    const s = norm(subtitle || ''); let m;
    if (/لحظاتی|دقایقی|دقیقه|ربع|نیم ساعت|ساعت/.test(s)) return 0;
    if (/دیروز/.test(s)) return 1;
    if ((m = s.match(/(\d+)\s*روز/))) return +m[1];
    if ((m = s.match(/(\d+)?\s*هفته/))) return 7 * (+m[1] || 1);
    if ((m = s.match(/(\d+)?\s*ماه/))) return 30 * (+m[1] || 1);
    if (/سال/.test(s)) return 365;
    return null;
  };

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
    // محل فقط از زیرعنوان دیوار («... پیش در سهند، خ ابن سینا»)؛ نه از وسط توضیحات
    const loc = s.match(/پیش\s+در\s+([^،\n]{2,25}?)(?:،\s*([^\n]{2,40}?))?\s*(?:\n|$)/);
    if (loc) { out.city = loc[1].trim(); if (loc[2]) out.district = loc[2].trim(); }
    out.description = W.cleanDesc(raw).slice(0, 3800);
    for (const k of Object.keys(out)) if (out[k] == null || Number.isNaN(out[k])) delete out[k];
    return out;
  };

  // توکن آگهی از لینک دیوار: https://divar.ir/v/عنوان/gZ1aBcDe
  W.tokenOf = url => { const m = String(url || '').match(/divar\.ir\/v\/(?:[^/?#]*\/)?([A-Za-z0-9_-]{6,12})(?:[/?#]|$)/); return m ? m[1] : null; };

  /* ---------- دسترسی به دیوار ----------
     مرورگر به سایت ما اجازه نمی‌دهد مستقیم از دیوار بخواند. اگر «کمک‌یار دیوار» (اسکریپت Tampermonkey) روی این مرورگر نصب باشد،
     درخواست‌ها از طریق آن و با اینترنت همین دستگاه انجام می‌شود؛ وگرنه مستقیم امتحان می‌کنیم. */
  const hasDoc = typeof document !== 'undefined';
  W.bridgeOn = () => hasDoc && document.documentElement.dataset.amlakBridge === '1';
  let rq = 0; const pend = {};
  if (hasDoc) window.addEventListener('message', e => {
    if (e.source !== window || !e.data || !e.data.amlakRes) return;
    const p = pend[e.data.amlakRes]; if (!p) return; delete pend[e.data.amlakRes];
    e.data.error ? p.rej(new Error(e.data.error)) : p.res({ ok: e.data.status >= 200 && e.data.status < 300, status: e.data.status, text: e.data.text || '' });
  });
  async function getText(url, headers = {}) {
    if (W.bridgeOn()) return new Promise((res, rej) => {
      const id = ++rq; pend[id] = { res, rej };
      window.postMessage({ amlakReq: id, url, headers }, location.origin);
      setTimeout(() => { if (pend[id]) { delete pend[id]; rej(new Error('timeout')); } }, 25000);
    });
    const r = await fetch(url, { headers }); return { ok: r.ok, status: r.status, text: await r.text() };
  }
  W.getText = getText;

  // همه «عنوان/مقدار»ها، متن‌ها، عکس‌ها و برچسب‌ها را از هر ساختار JSON دیوار جمع می‌کند (ساختار دیوار گاهی عوض می‌شود)
  function extract(j, acc) {
    (function walk(o, depth) {
      if (!o || typeof o !== 'object' || depth > 18) return;
      if (Array.isArray(o)) return o.forEach(x => walk(x, depth + 1));
      if (o.widget_type === 'LEGEND_TITLE_ROW' && o.data) { acc.title = acc.title || o.data.title || ''; acc.subtitle = acc.subtitle || o.data.subtitle || ''; }
      if (o.widget_type === 'DESCRIPTION_ROW' && o.data && typeof o.data.text === 'string') acc.desc.push(o.data.text);
      if (o.widget_type === 'IMAGE_CAROUSEL' && o.data) JSON.stringify(o.data).replace(/https:\/\/[a-z0-9.]*divarcdn\.com\/[^"\\]+?\.(?:jpe?g|webp|png)/gi, u => { acc.carousel.push(u); return u; });
      if (typeof o.title === 'string' && (typeof o.value === 'string' || typeof o.value === 'number')) acc.pairs.push([o.title, String(o.value)]);
      else if (typeof o.title === 'string' && o.title.length < 30) acc.labels.push(o.title + (o.available === false || o.disabled === true ? ' ندارد' : ''));
      if (typeof o.text === 'string' && o.text.length > 25) acc.texts.push(o.text);
      if (typeof o.description === 'string' && o.description.length > 25) acc.texts.push(o.description);
      for (const k in o) { const v = o[k]; if (typeof v === 'string' && /business|user_?type|seller|poster_?type/i.test(k)) acc.biz.push(v); if (typeof v === 'string' && /divarcdn\.com\/.+\.(jpe?g|webp|png)/i.test(v)) acc.images.push(v); else walk(v, depth + 1); }
    })(j, 0);
    if (!acc.title && j && j.seo && j.seo.title) acc.title = j.seo.title;
    return acc;
  }
  const newAcc = () => ({ title: '', subtitle: '', pairs: [], texts: [], images: [], labels: [], desc: [], carousel: [], biz: [] });
  const decodeHtml = t => t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
  // پشتیبان: خواندن از خود صفحه آگهی در دیوار (JSON داخل صفحه، و اگر نبود متن قابل دیدن صفحه)
  function fromHtml(html, acc) {
    for (const m of html.matchAll(/<script[^>]*(?:application\/ld\+json|__NEXT_DATA__|application\/json)[^>]*>([\s\S]*?)<\/script>/g)) { try { extract(JSON.parse(m[1]), acc); } catch { } }
    for (const m of html.matchAll(/window\.__[A-Z_]+__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/g)) { try { extract(JSON.parse(m[1]), acc); } catch { } }
    const og = (html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/) || html.match(/<title>([^<]+)<\/title>/) || [])[1];
    if (!acc.title && og) acc.title = decodeHtml(og).replace(/\s*[|\-–]\s*دیوار.*$/, '').trim();
    for (const m of html.matchAll(/https:\/\/[a-z0-9.]*divarcdn\.com\/[^"'\s)]+?\.(?:jpe?g|webp|png)/gi)) acc.images.push(m[0]);
    if (!acc.pairs.length && !acc.texts.length) {
      const visible = decodeHtml(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr|span)>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
      if (visible.length > 40) acc.texts.push(visible.slice(0, 5000));
    }
    return acc;
  }

  // خواندن یک آگهی از دیوار. اگر نشد، کاربر متن را کپی می‌کند.
  W.fetchAd = async function (url) {
    const token = W.tokenOf(url);
    if (!token) throw new Error('لینک دیوار درست نیست؛ لینک کامل آگهی را از دکمه «اشتراک‌گذاری» دیوار کپی کنید');
    const acc = newAcc(); let got = false, gone = false;
    try {
      const r = await getText('https://api.divar.ir/v8/posts-v2/web/' + token, { Accept: 'application/json' });
      if (r.status === 404) gone = true; else if (r.ok) { extract(JSON.parse(r.text), acc); got = !!(acc.title || acc.pairs.length || acc.texts.length); }
    } catch { }
    if (!got && !gone) {
      try { const r = await getText('https://divar.ir/v/' + token, { Accept: 'text/html' }); if (r.status === 404) gone = true; else if (r.ok) { fromHtml(r.text, acc); got = !!(acc.title || acc.pairs.length || acc.texts.length); } } catch { }
    }
    if (gone) throw new Error('این آگهی در دیوار پیدا نشد (شاید حذف شده)');
    if (!got) { const x = new Error(W.bridgeOn() ? 'دیوار جواب نداد (اگر VPN روشن است خاموشش کنید)' : 'دیوار اجازه خواندن مستقیم نداد'); x.blocked = true; throw x; }
    const { title, subtitle, pairs, texts, images, labels, desc, carousel, biz } = acc;
    // فقط متن اصلی آگهی (نه متن مخصوص گوگل یا تکرارها)
    const mainDesc = desc.length ? desc.join('\n\n') : (texts.filter(t => t.length < 4000 && !/^\s*آگهی\s.{2,90}\sدر دیوار/.test(t)).sort((a, b) => b.length - a.length)[0] || '');
    const raw = [title, subtitle, ...pairs.map(([k, v]) => `${k}: ${v}`), ...labels.filter(x => x !== title), mainDesc].join('\n');
    const out = W.parseAdText(raw, pairs);
    if (title) out.title = title;
    out.description = W.cleanDesc(mainDesc).slice(0, 3800);
    out._images = W.cleanImages(carousel.length ? carousel : images);
    out._biz = biz;
    out._age = W.ageDays(subtitle, [...pairs.map(p => p.join(' ')), ...texts].join('\n'));
    out._labels = [subtitle, ...labels].filter(Boolean);
    out._token = token;
    return out;
  };

  // آیا آگهی‌دهنده بنگاه/مشاور املاک است؟ (برای جدا کردن آگهی‌های شخصی)
  // برچسب‌های دیوار (نام آگهی‌دهنده / نشان کسب‌وکار) معتبرترند؛ در متن، جمله‌هایی مثل «مشاورین املاک تماس نگیرند» نشانه آگهی شخصی است
  W.isAgency = d => {
    // ۱) خود دیوار در اطلاعات آگهی نوع آگهی‌دهنده را می‌گوید (کسب‌وکار املاک / شخصی)
    if ((d?._biz || []).some(x => /real.?estate|business|agency|consultant|premium|کسب/i.test(x) && !/personal|شخصی/i.test(x))) return true;
    // ۲) متن خود آگهی؛ «مشاورین املاک تماس نگیرند» نشانه آگهی شخصی است و حذف می‌شود
    const text = norm([d?.title, d?.description].join('\n')).replace(/(مشاور(?:ین|ان)?(?:\s*محترم)?\s*املاک|بنگاه(?:ها|داران)?|املاکی(?:ها)?)[^.\n!]{0,30}(تماس\s*نگیر|نگیرند|نپذیر|معذور|ممنوع|نزنند)/g, '');
    return /(?:^|\n)\s*(?:املاک|مشاور املاک|آژانس املاک)\s+[\u0600-\u06FF]+|مشاور(?:ین)? املاک\s+[\u0600-\u06FF]+\s*(?:$|\n)|کد\s*مشاور|خرید\s*و\s*فروش|فروش\s*و\s*خرید|واریزی(?:\s*های)?\s*متنوع|فایل(?:\s*های)?\s*(?:متنوع|بیشتر|مشابه)|مشاوره\s*(?:رایگان|تخصصی)|کارشناس\s*(?:فروش|املاک)/.test(text);
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
      () => getText('https://api.divar.ir/v8/web-search/' + path + u.search, { Accept: 'application/json' }).then(r => r.ok ? JSON.parse(r.text) : Promise.reject(r.status)),
      () => getText(searchUrl, { Accept: 'text/html' }).then(r => r.ok ? r.text : Promise.reject(r.status))
    ];
    for (const t of tries) { try { const tok = collectTokens(await t()); if (tok.length) return tok; } catch { } }
    const e = new Error(W.bridgeOn() ? 'دیوار جواب نداد (اگر VPN روشن است خاموشش کنید)' : 'دیوار اجازه جستجوی مستقیم نداد؛ «کمک‌یار دیوار» را روی این مرورگر نصب کنید'); e.blocked = true; throw e;
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
