// ==UserScript==
// @name         کمک‌یار دیوار — اپ املاک
// @namespace    https://masoud123600.github.io/MASOOD/amlak/
// @version      1.0.0
// @description  به اپ املاک اجازه می‌دهد آگهی‌های دیوار را با اینترنت همین دستگاه بخواند. فقط صفحه‌های divar.ir را می‌خواند و به هیچ جای دیگری وصل نمی‌شود.
// @match        https://masoud123600.github.io/MASOOD/amlak/*
// @grant        GM_xmlhttpRequest
// @connect      divar.ir
// @connect      api.divar.ir
// @run-at       document-start
// @noframes
// @downloadURL  https://masoud123600.github.io/MASOOD/amlak/divar-helper.user.js
// @updateURL    https://masoud123600.github.io/MASOOD/amlak/divar-helper.user.js
// ==/UserScript==

/* این اسکریپت فقط روی صفحه اپ املاک اجرا می‌شود. اپ از آن می‌خواهد یک صفحه از divar.ir را بخواند؛
   اسکریپت همان صفحه را با اینترنت همین دستگاه می‌گیرد و متنش را به اپ برمی‌گرداند.
   هیچ رمز، توکن یا اطلاعاتی از اپ به دیوار یا جای دیگری فرستاده نمی‌شود. */
(function () {
  'use strict';
  const PAGE = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const ALLOWED = /^https:\/\/(?:api\.)?divar\.ir\/[^\s]*$/;
  const mark = () => { if (document.documentElement) document.documentElement.dataset.amlakBridge = '1'; };
  mark(); document.addEventListener('readystatechange', mark);

  window.addEventListener('message', e => {
    if ((e.source !== PAGE && e.source !== window) || e.origin !== location.origin) return;
    const d = e.data;
    if (!d || typeof d !== 'object' || !d.amlakReq) return;
    const reply = o => PAGE.postMessage(Object.assign({ amlakRes: d.amlakReq }, o), location.origin);
    if (typeof d.url !== 'string' || !ALLOWED.test(d.url)) return reply({ error: 'only divar.ir' });
    const accept = d.headers && typeof d.headers.Accept === 'string' ? d.headers.Accept : '*/*';
    GM_xmlhttpRequest({
      method: 'GET', url: d.url, headers: { Accept: accept }, timeout: 20000,
      onload: r => reply({ status: r.status, text: String(r.responseText || '').slice(0, 3000000) }),
      onerror: () => reply({ error: 'network' }),
      ontimeout: () => reply({ error: 'timeout' })
    });
  });
})();
