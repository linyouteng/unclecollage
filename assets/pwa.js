(() => {
  const APP_NAME = '自然大叔';
  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  const isSafari = () => /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent);
  let deferredPrompt = null;

  function injectStyle() {
    if (document.getElementById('pwaInstallStyle')) return;
    const style = document.createElement('style');
    style.id = 'pwaInstallStyle';
    style.textContent = `
      .pwa-install-btn{
        position:fixed;
        left:calc(14px + env(safe-area-inset-left));
        bottom:calc(14px + env(safe-area-inset-bottom));
        z-index:9998;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        min-height:44px;
        padding:10px 14px;
        border-radius:999px;
        border:1px solid rgba(15,23,42,.14);
        background:#0f172a;
        color:#fff;
        font:700 14px/1 system-ui,-apple-system,"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;
        box-shadow:0 12px 28px rgba(15,23,42,.22);
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
      }
      .pwa-install-btn:active{ transform:translateY(1px); }
      .pwa-install-backdrop{
        position:fixed;
        inset:0;
        z-index:9999;
        display:flex;
        align-items:flex-end;
        justify-content:center;
        padding:16px;
        background:rgba(15,23,42,.48);
      }
      .pwa-install-panel{
        width:min(100%,420px);
        border-radius:22px;
        background:#fff;
        color:#0f172a;
        box-shadow:0 24px 60px rgba(15,23,42,.28);
        padding:18px;
        font-family:system-ui,-apple-system,"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;
      }
      .pwa-install-panel h2{ margin:0 0 8px; font-size:20px; line-height:1.3; }
      .pwa-install-panel p{ margin:0 0 12px; color:#475569; line-height:1.65; font-size:14px; }
      .pwa-install-panel ol{ margin:0 0 14px 1.25rem; padding:0; color:#334155; line-height:1.75; font-size:14px; }
      .pwa-install-panel .pwa-install-actions{ display:flex; gap:10px; justify-content:flex-end; }
      .pwa-install-panel button{
        min-height:42px;
        padding:9px 14px;
        border-radius:999px;
        border:1px solid #cbd5e1;
        background:#fff;
        color:#0f172a;
        font-weight:800;
        cursor:pointer;
      }
      .pwa-install-panel .primary{ background:#0f172a; border-color:#0f172a; color:#fff; }
      @media (min-width: 760px){
        .pwa-install-backdrop{ align-items:center; }
      }
      @media print{
        .pwa-install-btn,.pwa-install-backdrop{ display:none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function removeInstallButton() {
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) btn.remove();
  }

  function createInstallButton() {
    if (isStandalone()) return;
    if (document.getElementById('pwaInstallBtn')) return;
    injectStyle();
    const btn = document.createElement('button');
    btn.id = 'pwaInstallBtn';
    btn.className = 'pwa-install-btn';
    btn.type = 'button';
    btn.textContent = '安裝 APP';
    btn.setAttribute('aria-label', '將自然大叔加入主畫面');
    btn.addEventListener('click', onInstallClick);
    document.body.appendChild(btn);
  }

  async function onInstallClick() {
    if (deferredPrompt) {
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      promptEvent.prompt();
      try {
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') removeInstallButton();
      } catch (_) {}
      return;
    }
    showInstallHelp();
  }

  function showInstallHelp() {
    injectStyle();
    const old = document.getElementById('pwaInstallHelp');
    if (old) old.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'pwaInstallHelp';
    backdrop.className = 'pwa-install-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');

    const iosText = isIOS()
      ? `<ol><li>請用 Safari 開啟此網頁。</li><li>點下方「分享」按鈕。</li><li>選擇「加入主畫面」。</li><li>按「新增」後，就會像 APP 一樣出現在桌面。</li></ol>`
      : `<ol><li>請用 Chrome 或 Edge 開啟此網頁。</li><li>點選網址列旁的「安裝」圖示，或右上角選單。</li><li>選擇「安裝應用程式」或「加入主畫面」。</li></ol>`;

    backdrop.innerHTML = `
      <div class="pwa-install-panel">
        <h2>將 ${APP_NAME} 加入主畫面</h2>
        <p>安裝後可從手機桌面直接開啟，畫面會比較像獨立 APP。</p>
        ${iosText}
        <div class="pwa-install-actions">
          <button type="button" data-pwa-close>知道了</button>
          <button type="button" class="primary" data-pwa-close>完成</button>
        </div>
      </div>
    `;
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop || event.target.closest('[data-pwa-close]')) backdrop.remove();
    });
    document.body.appendChild(backdrop);
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
        .then((registration) => {
          registration.update().catch(() => undefined);
        })
        .catch(() => undefined);
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    createInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    removeInstallButton();
  });

  document.addEventListener('DOMContentLoaded', () => {
    if (isStandalone()) return;
    if (isIOS()) {
      // iOS Safari does not support beforeinstallprompt, so show a helper button.
      createInstallButton();
    }
  });
})();
