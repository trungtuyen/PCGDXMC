(function (global) {
  'use strict';

  const SHEETJS_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  const MODULES = [
    './core-v02.js',
    './reports-v02.js',
    './groups-v03.js',
    './viewer-v04.js',
    './xmc-lists-v09.js',
    './xmc-age-summary-v10.js',
    './xmc-menu-v11.js'
  ];

  let readyPromise = null;

  function absoluteUrl(src) {
    return new URL(src, document.baseURI).href;
  }

  function loadScript(src) {
    const url = absoluteUrl(src);
    const existing = Array.from(document.scripts).find((script) => script.src === url);

    if (existing) {
      if (existing.dataset.pcgdLoaded === '1') return Promise.resolve();
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error(`Không tải được ${src}`)), { once: true });
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.dataset.pcgdRuntime = '1';
      script.onload = () => {
        script.dataset.pcgdLoaded = '1';
        resolve();
      };
      script.onerror = () => {
        script.remove();
        reject(new Error(`Không tải được ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  async function start() {
    global.dispatchEvent(new CustomEvent('pcgd-excel-loading'));
    if (!global.XLSX) await loadScript(SHEETJS_URL);
    for (const modulePath of MODULES) await loadScript(modulePath);

    if (!global.XLSX || !global.PCGDEngine || !global.PCGDViewer) {
      throw new Error('Bộ xử lý Excel chưa khởi tạo đầy đủ.');
    }
    global.dispatchEvent(new CustomEvent('pcgd-excel-ready'));
  }

  function ensureReady() {
    if (global.XLSX && global.PCGDEngine && global.PCGDViewer) return Promise.resolve();
    if (!readyPromise) {
      readyPromise = start().catch((error) => {
        readyPromise = null;
        throw error;
      });
    }
    return readyPromise;
  }

  global.PCGDExcelRuntime = {
    ensureReady,
    isReady: () => Boolean(global.XLSX && global.PCGDEngine && global.PCGDViewer)
  };
})(window);

