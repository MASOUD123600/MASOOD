'use strict';
/* پنل «بنگاه‌ها»: فقط برای مدیر اصلی سامانه (حساب مالک بنگاه main).
   ساخت بنگاه جدید (دو مخزن جدا برای هر بنگاه)، اشتراک ۳۰ روزه، سطح‌ها (نقره‌ای/طلایی/پلاتینی)، توکن و لینک دعوت هر بنگاه. */

const TIER_KEYS = ['silver', 'gold', 'platinum'];
const siteOf = slug => location.origin + location.pathname + '?a=' + slug;

async function panelAgencies(pt) {
  const O = DB.owner;
  pt.innerHTML = '<div class="spin"></div>';
  try { if (!(await O.load())) return agenciesConnect(pt); }
  catch (e) { pt.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  const reg = await O.registry(); REG = reg;
  const tiers = Object.fromEntries(TIER_KEYS.map(k => [k, { ...DEF_TIERS[k], ...(reg.tiers?.[k] || {}) }]));
  const list = Object.entries(reg.tenants || {}).sort((a, b) => (b[1].created || '').localeCompare(a[1].created || ''));
  const now = Date.now(), daysLeft = x => x.expires ? Math.ceil((new Date(x.expires) - now) / 864e5) : 0;
  const state = x => x.active === false ? ['متوقف', 'bad'] : daysLeft(x) > 5 ? ['فعال', 'ok'] : daysLeft(x) > 0 ? ['رو به پایان', 'warn'] : ['تمام شده', 'bad'];
  const nActive = list.filter(([, x]) => x.active !== false && daysLeft(x) > 0).length;
  const sel = 'style="width:auto;min-height:32px;padding:3px 8px;font-size:13px"';
  pt.innerHTML = `
    <div class="stats" style="margin-bottom:12px">
      <div class="stat"><small>کل بنگاه‌ها</small><b>${fa(list.length)}</b></div>
      <div class="stat"><small>اشتراک فعال</small><b style="color:var(--ok)">${fa(nActive)}</b></div>
      <div class="stat"><small>نیاز به تمدید</small><b style="color:${list.length - nActive ? 'var(--bad)' : ''}">${fa(list.length - nActive)}</b></div>
    </div>
    <div id="ag-new-out"></div>
    <details class="card" style="margin-bottom:12px" ${list.length ? '' : 'open'}><summary style="cursor:pointer"><b>${I.plus.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} بنگاه جدید</b></summary>
      <form class="stack" id="ag-new" style="margin-top:10px">
        <div class="grid2"><label class="f"><span>نام بنگاه</span><input name="name" required placeholder="مثلا املاک وطن"></label>
          <label class="f"><span>نام انگلیسی (در آدرس سایت)</span><input name="slug" required dir="ltr" placeholder="vatan" pattern="[a-z][a-z0-9-]{2,24}"></label>
          <label class="f"><span>تلفن دفتر</span><input name="phone" inputmode="tel"></label>
          <label class="f"><span>سطح اشتراک</span><select name="tier">${opts(TIER_KEYS.map(k => [k, tiers[k].name]), 'silver')}</select></label></div>
        <b class="small">مدیر بنگاه</b>
        <div class="grid3"><input name="bname" required placeholder="نام و نام خانوادگی"><input name="bphone" inputmode="tel" placeholder="موبایل"><input name="bpw" required minlength="6" dir="ltr" placeholder="رمز برای او" autocomplete="off"></div>
        <label class="check"><input type="checkbox" name="activate" checked> پول را گرفته‌ام؛ اشتراک ۳۰ روزه همین حالا فعال شود</label>
        <button class="btn primary">ساخت بنگاه</button>
        <p class="small muted" style="margin:0">اپ دو مخزن جداگانه برای این بنگاه می‌سازد (اطلاعات محرمانه و آگهی‌ها). بنگاه‌ها به اطلاعات هم دسترسی ندارند.</p>
      </form></details>
    <div class="tbl" id="ag-list">${list.map(([slug, x]) => { const [st, cls] = state(x), d = daysLeft(x), t = tiers[x.tier] || tiers.silver; return `
      <div class="card stack" data-slug="${esc(slug)}">
        <div class="row"><b style="flex:1;font-size:16px">${esc(x.name)}</b><span class="tag ${cls}">${st}</span><span class="tag">${esc(t.name)}</span></div>
        <div class="small muted" dir="ltr" style="text-align:right">${esc(slug)} · ${esc(x.phone || '')}</div>
        <div class="small">${x.expires ? `پایان اشتراک: <b>${new Date(x.expires).toLocaleDateString('fa-IR')}</b> · ${d > 0 ? `${fa(d)} روز مانده` : `${fa(-d)} روز گذشته`}` : 'هنوز فعال نشده'}</div>
        <div class="small muted" data-stats>در حال خواندن آمار…</div>
        <div class="row">
          <button class="btn sm primary" data-renew>✅ پول را گرفتم — تمدید ۳۰ روز</button>
          ${x.active === false ? '<button class="btn sm" data-on>فعال کردن دوباره</button>' : '<button class="btn sm danger" data-off>قطع اشتراک</button>'}
          <select data-tier ${sel}>${opts(TIER_KEYS.map(k => [k, tiers[k].name]), x.tier)}</select></div>
        <div class="row">
          <a class="btn sm" href="${esc(siteOf(slug))}" target="_blank" rel="noopener">سایت بنگاه</a>
          <button class="btn sm" data-copysite>کپی لینک سایت برای مشتری‌ها</button>
          ${O.hasToken(slug) ? '<button class="btn sm" data-invite>لینک دعوت مدیر بنگاه</button>' : ''}</div>
        ${O.hasToken(slug) ? '' : agencyTokenBox(slug, x)}
        <div data-out></div>
        ${(x.history || []).length ? `<details class="small"><summary style="cursor:pointer" class="muted">سابقه تمدید (${fa(x.history.length)})</summary>${x.history.map(h => `<div class="muted">${new Date(h.at).toLocaleDateString('fa-IR')} — ${fa(h.days)} روز</div>`).join('')}</details>` : ''}
      </div>`; }).join('') || '<div class="empty">هنوز بنگاهی نساخته‌اید.</div>'}</div>
    <details class="card" style="margin-top:12px"><summary style="cursor:pointer"><b>⚙️ سطح‌های اشتراک</b></summary>
      <form class="stack" id="ag-tiers" style="margin-top:10px">
        ${TIER_KEYS.map(k => `<div class="grid3"><label class="f"><span>نام</span><input name="${k}-name" value="${esc(tiers[k].name)}"></label>
          <label class="f"><span>آگهی دیوار در روز</span><input name="${k}-daily" inputmode="numeric" value="${fa(tiers[k].daily)}"></label>
          <label class="f"><span>سرعت دیده‌بان (ثانیه)</span><select name="${k}-every">${opts([5, 10, 20, 30, 60].map(x => [x, fa(x) + ' ثانیه']), tiers[k].every)}</select></label></div>`).join('')}
        <button class="btn">ذخیره سطح‌ها</button></form></details>
    <details class="card" style="margin-top:12px"><summary style="cursor:pointer"><b>☎️ پشتیبانی</b> <span class="small muted">· به بنگاه‌هایی که اشتراکشان تمام شده نمایش داده می‌شود</span></summary>
      <form class="grid3" id="ag-sup" style="margin-top:10px"><input name="name" placeholder="نام (مثلا پشتیبانی سامانه)" value="${esc(reg.support?.name || '')}"><input name="phone" inputmode="tel" placeholder="شماره تماس" value="${esc(reg.support?.phone || '')}"><button class="btn">ذخیره</button></form></details>`;

  const reload = () => { S.panel = null; panelAgencies(pt); };
  const act = async (btn, fn, ok) => { btn.disabled = true; try { await fn(); toast(ok); reload(); } catch (e) { toast(e.message, 5000); btn.disabled = false; } };
  // آمار هر بنگاه (از مخزن خودش، با توکن مدیر کل)
  for (const [slug] of list) {
    const box = $(`[data-slug="${slug}"] [data-stats]`, pt);
    O.stats(slug).then(s => { box.innerHTML = `${fa(s.admins)} مدیر · ${fa(s.agents)} مشاور · ${fa(s.listings)} آگهی (${fa(s.active)} فعال) · دیوار امروز: ${fa(s.divarToday)} از ${fa((tiers[REG.tenants[slug].tier] || tiers.silver).daily)}${s.lastLogin ? ` · آخرین ورود: ${esc(s.lastWho || '')} ${ago(s.lastLogin)}` : ''}`; })
      .catch(e => { box.textContent = 'آمار خوانده نشد: ' + e.message; });
  }
  $$('[data-slug]', pt).forEach(card => {
    const slug = card.dataset.slug, out = $('[data-out]', card);
    $('[data-renew]', card)?.addEventListener('click', e => { if (confirm(`اشتراک «${REG.tenants[slug].name}» ۳۰ روز تمدید شود؟`)) act(e.target, () => O.renew(slug, 30), 'تمدید شد ✓'); });
    $('[data-off]', card)?.addEventListener('click', e => { if (confirm('اشتراک این بنگاه همین حالا قطع شود؟ اطلاعاتشان پاک نمی‌شود.')) act(e.target, () => O.setActive(slug, false), 'قطع شد'); });
    $('[data-on]', card)?.addEventListener('click', e => act(e.target, () => O.setActive(slug, true), 'فعال شد'));
    $('[data-tier]', card).addEventListener('change', e => act(e.target, () => O.setTier(slug, e.target.value), 'سطح اشتراک عوض شد'));
    $('[data-copysite]', card).addEventListener('click', () => copyText(siteOf(slug)));
    $('[data-invite]', card)?.addEventListener('click', async e => {
      const pw = prompt('یک رمز برای مدیر این بنگاه بنویسید (حداقل ۶ حرف). رمز قبلی او عوض می‌شود:'); if (pw == null) return;
      if (pw.length < 6) return toast('رمز باید حداقل ۶ حرف باشد');
      e.target.disabled = true;
      try { showInviteBox(out, REG.tenants[slug], await O.bossInvite(slug, pw)); } catch (err) { toast(err.message, 5000); } finally { e.target.disabled = false; }
    });
    bindTokenBox(card, slug, null, reload);
  });
  $('#ag-new').addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, b = $('button', f);
    b.disabled = true; b.textContent = 'در حال ساخت مخزن‌ها و فایل‌ها…';
    try {
      const r = await O.createTenant({ name: f.name.value.trim(), slug: f.slug.value.trim(), phone: f.phone.value.trim(), tier: f.tier.value, activate: f.activate.checked, boss: { name: f.bname.value.trim(), phone: f.bphone.value.trim(), pw: f.bpw.value } });
      REG = await O.registry();
      const box = $('#ag-new-out');
      box.innerHTML = `<div class="card stack" style="margin-bottom:12px;border-color:var(--accent)"><h3>✅ «${esc(f.name.value)}» ساخته شد — یک قدم مانده</h3>${agencyTokenBox(r.slug, REG.tenants[r.slug], true)}<div data-out></div></div>`;
      bindTokenBox(box, r.slug, f.bpw.value, null);
      f.reset(); box.scrollIntoView({ behavior: 'smooth' });
      b.disabled = false; b.textContent = 'ساخت بنگاه';
    } catch (err) { toast(err.message, 6000); b.disabled = false; b.textContent = 'ساخت بنگاه'; }
  });
  $('#ag-tiers').addEventListener('submit', e => {
    e.preventDefault(); const f = e.target;
    const t = Object.fromEntries(TIER_KEYS.map(k => [k, { name: f[k + '-name'].value.trim() || DEF_TIERS[k].name, daily: Math.max(1, toNum(f[k + '-daily'].value) || 1), every: +f[k + '-every'].value }]));
    act($('button', f), () => O.saveTiers(t), 'سطح‌ها ذخیره شد');
  });
  $('#ag-sup').addEventListener('submit', e => { e.preventDefault(); act($('button', e.target), () => O.saveSupport({ name: e.target.name.value.trim(), phone: e.target.phone.value.trim() }), 'ذخیره شد'); });
}

// ثبت توکن مخصوص یک بنگاه (فقط به دو مخزن همان بنگاه دسترسی دارد)
function agencyTokenBox(slug, x, fresh) {
  const n1 = x.privateRepo.split('/')[1], n2 = x.publicRepo.split('/')[1];
  return `<div class="stack" data-tokbox style="padding:10px;border-radius:12px;background:var(--sunk)">
    <b class="small">${fresh ? 'قدم آخر: ' : '⚠️ '}رمز مخزن (توکن) این بنگاه</b>
    <ol class="small" style="padding-inline-start:18px;margin:0;line-height:1.9">
      <li><a href="https://github.com/settings/personal-access-tokens/new?name=amlak-${encodeURIComponent(slug)}&expires_in=366&contents=write" target="_blank" rel="noopener">این لینک</a> را باز کنید.</li>
      <li>Repository access: <b>Only select repositories</b> ← فقط این دو: <b dir="ltr">${esc(n1)}</b> و <b dir="ltr">${esc(n2)}</b></li>
      <li>Contents: <b>Read and write</b> ← Generate token ← کپی</li></ol>
    <div class="row"><input data-tok dir="ltr" placeholder="github_pat_…" style="flex:1;min-width:180px" autocomplete="off"><button class="btn sm primary" data-toksave>ثبت توکن</button></div></div>`;
}
function bindTokenBox(root, slug, bossPw, after) {
  const btn = $('[data-toksave]', root); if (!btn) return;
  btn.addEventListener('click', async () => {
    const tok = $('[data-tok]', root).value.trim(); if (!tok) return toast('توکن را بچسبانید');
    btn.disabled = true; btn.textContent = 'در حال بررسی…';
    try {
      await DB.owner.setTenantToken(slug, tok);
      toast('توکن ثبت شد ✓');
      if (bossPw) { $('[data-tokbox]', root).remove(); showInviteBox($('[data-out]', root), REG.tenants[slug], await DB.owner.bossInvite(slug, bossPw)); }
      else if (after) after();
    } catch (e) { toast(e.message, 6000); btn.disabled = false; btn.textContent = 'ثبت توکن'; }
  });
}
function showInviteBox(box, x, link) {
  const boss = 'مدیر ' + x.name;
  const msg = `سلام،\nپنل ${x.name} در سامانه املاک آماده است.\nاین لینک را روی گوشی خود باز کنید و رمز را بزنید:\n${link}\nرمز را جداگانه به شما می‌گویم.\n\nسایت آگهی‌های شما برای مشتری‌ها:\n${siteOf(Object.keys(REG.tenants).find(k => REG.tenants[k] === x))}`;
  box.innerHTML = `<div class="stack" style="padding:10px;border-radius:12px;border:1px solid var(--accent)"><b class="small">لینک دعوت ${esc(boss)}</b>
    <p class="small muted" style="margin:0">لینک را بفرستید و <b>رمز را جداگانه</b> بگویید.</p>
    <input readonly dir="ltr" value="${esc(link)}" onclick="this.select()">
    <div class="row"><button class="btn sm" data-cp>کپی لینک</button>${x.phone ? `<a class="btn sm primary" target="_blank" rel="noopener" href="https://wa.me/${esc(waPhone(x.phone))}?text=${encodeURIComponent(msg)}">${I.chat} واتس‌اپ به دفتر</a>` : ''}</div></div>`;
  $('[data-cp]', box).addEventListener('click', () => copyText(link));
}

// یک بار: اتصال «مدیریت کل» (توکنی که به همه مخزن‌های شما دسترسی دارد و می‌تواند مخزن بسازد)
function agenciesConnect(pt) {
  pt.innerHTML = `<div class="card stack" style="max-width:640px">
    <h3>🔐 اتصال مدیریت کل — یک بار</h3>
    <p class="small muted" style="margin:0">برای ساختن بنگاه‌ها، اپ به یک توکن کلی نیاز دارد که فقط روی دستگاه شما و رمزگذاری‌شده با رمز ورود خودتان نگه داشته می‌شود. مشاوران و بنگاه‌ها هرگز آن را نمی‌بینند.</p>
    <ol class="small" style="padding-inline-start:18px;margin:0;line-height:2">
      <li><a href="https://github.com/settings/personal-access-tokens/new?name=amlak-master&expires_in=366&contents=write&administration=write" target="_blank" rel="noopener">این لینک</a> را باز کنید.</li>
      <li>Repository access: <b>All repositories</b></li>
      <li>Permissions: <b>Administration</b> و <b>Contents</b> هر دو روی <b>Read and write</b> ← Generate token ← کپی</li></ol>
    <form class="stack" id="ag-m"><input name="tok" required dir="ltr" placeholder="github_pat_…" autocomplete="off">
      <input name="pw" type="password" required dir="ltr" placeholder="رمز ورود خودتان (برای قفل کردن خزانه)" autocomplete="current-password">
      <button class="btn primary">اتصال</button></form></div>`;
  $('#ag-m').addEventListener('submit', async e => {
    e.preventDefault(); const b = $('button', e.target); b.disabled = true; b.textContent = 'در حال بررسی…';
    try { await DB.owner.setMaster(e.target.tok.value, e.target.pw.value); toast('وصل شد ✓'); panelAgencies(pt); }
    catch (err) { toast(err.message, 6000); b.disabled = false; b.textContent = 'اتصال'; }
  });
}
