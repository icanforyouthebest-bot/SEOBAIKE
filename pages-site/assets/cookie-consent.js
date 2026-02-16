/**
 * SEOBAIKE Cookie Consent Banner
 * 小路光有限公司 (統編 60475510)
 *
 * 符合 GDPR 及台灣個人資料保護法
 * Self-contained script — auto-injects banner into the page
 *
 * Usage: <script src="/assets/cookie-consent.js"></script>
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'seobaike_cookie_consent';
  var CONSENT_VERSION = '1.0';

  // 若使用者已接受，直接結束
  try {
    var stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && stored.accepted && stored.version === CONSENT_VERSION) {
      return;
    }
  } catch (e) {
    // localStorage 不可用或資料損壞，繼續顯示 banner
  }

  // ── 建立 CSS ──
  var style = document.createElement('style');
  style.textContent = [
    '#seobaike-cookie-banner {',
    '  position: fixed;',
    '  bottom: 0;',
    '  left: 0;',
    '  right: 0;',
    '  z-index: 99999;',
    '  background: rgba(10, 10, 26, 0.97);',
    '  backdrop-filter: blur(20px);',
    '  -webkit-backdrop-filter: blur(20px);',
    '  border-top: 1px solid rgba(232, 133, 12, 0.2);',
    '  padding: 20px 24px;',
    '  transform: translateY(100%);',
    '  opacity: 0;',
    '  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1);',
    '  font-family: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif;',
    '  box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.4);',
    '}',
    '#seobaike-cookie-banner.visible {',
    '  transform: translateY(0);',
    '  opacity: 1;',
    '}',
    '#seobaike-cookie-banner.hiding {',
    '  transform: translateY(100%);',
    '  opacity: 0;',
    '}',
    '#seobaike-cookie-inner {',
    '  max-width: 1200px;',
    '  margin: 0 auto;',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: space-between;',
    '  gap: 20px;',
    '}',
    '#seobaike-cookie-icon {',
    '  flex-shrink: 0;',
    '  width: 40px;',
    '  height: 40px;',
    '  border-radius: 10px;',
    '  background: rgba(232, 133, 12, 0.1);',
    '  border: 1px solid rgba(232, 133, 12, 0.15);',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  font-size: 1.2rem;',
    '}',
    '#seobaike-cookie-text {',
    '  flex: 1;',
    '  font-size: 0.88rem;',
    '  line-height: 1.6;',
    '  color: #b0b0cc;',
    '}',
    '#seobaike-cookie-text strong {',
    '  color: #ffffff;',
    '  font-weight: 700;',
    '}',
    '#seobaike-cookie-actions {',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 12px;',
    '  flex-shrink: 0;',
    '}',
    '#seobaike-cookie-accept {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  padding: 10px 28px;',
    '  border-radius: 9999px;',
    '  background: linear-gradient(135deg, #e8850c 0%, #f5a623 50%, #ffd700 100%);',
    '  color: #000000;',
    '  font-weight: 700;',
    '  font-size: 0.88rem;',
    '  font-family: inherit;',
    '  border: none;',
    '  cursor: pointer;',
    '  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);',
    '  box-shadow: 0 2px 12px rgba(232, 133, 12, 0.25);',
    '  white-space: nowrap;',
    '}',
    '#seobaike-cookie-accept:hover {',
    '  transform: translateY(-1px);',
    '  box-shadow: 0 4px 24px rgba(232, 133, 12, 0.4);',
    '}',
    '#seobaike-cookie-accept:active {',
    '  transform: translateY(0);',
    '}',
    '#seobaike-cookie-learn {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  padding: 10px 20px;',
    '  border-radius: 9999px;',
    '  background: transparent;',
    '  color: #b0b0cc;',
    '  font-weight: 600;',
    '  font-size: 0.85rem;',
    '  font-family: inherit;',
    '  border: 1px solid rgba(255, 255, 255, 0.08);',
    '  cursor: pointer;',
    '  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);',
    '  text-decoration: none;',
    '  white-space: nowrap;',
    '}',
    '#seobaike-cookie-learn:hover {',
    '  border-color: rgba(232, 133, 12, 0.3);',
    '  color: #ffffff;',
    '  background: rgba(232, 133, 12, 0.05);',
    '}',
    '',
    '/* ── Mobile Responsive ── */',
    '@media (max-width: 768px) {',
    '  #seobaike-cookie-banner {',
    '    padding: 16px;',
    '  }',
    '  #seobaike-cookie-inner {',
    '    flex-direction: column;',
    '    text-align: center;',
    '    gap: 14px;',
    '  }',
    '  #seobaike-cookie-icon {',
    '    display: none;',
    '  }',
    '  #seobaike-cookie-text {',
    '    font-size: 0.82rem;',
    '  }',
    '  #seobaike-cookie-actions {',
    '    width: 100%;',
    '    justify-content: center;',
    '  }',
    '  #seobaike-cookie-accept {',
    '    flex: 1;',
    '    max-width: 160px;',
    '    min-height: 44px;',
    '  }',
    '  #seobaike-cookie-learn {',
    '    flex: 1;',
    '    max-width: 140px;',
    '    min-height: 44px;',
    '  }',
    '}',
    '@media (max-width: 380px) {',
    '  #seobaike-cookie-actions {',
    '    flex-direction: column;',
    '    gap: 8px;',
    '  }',
    '  #seobaike-cookie-accept,',
    '  #seobaike-cookie-learn {',
    '    max-width: 100%;',
    '    width: 100%;',
    '  }',
    '}'
  ].join('\n');
  document.head.appendChild(style);

  // ── 建立 Banner HTML ──
  var banner = document.createElement('div');
  banner.id = 'seobaike-cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie 使用同意');
  banner.setAttribute('aria-describedby', 'seobaike-cookie-text');

  banner.innerHTML = [
    '<div id="seobaike-cookie-inner">',
    '  <div id="seobaike-cookie-icon" aria-hidden="true">&#x1F36A;</div>',
    '  <div id="seobaike-cookie-text">',
    '    <strong>Cookie 使用通知</strong><br>',
    '    本網站使用 Cookie 以提升您的瀏覽體驗。繼續使用即表示您同意我們的 Cookie 政策。',
    '    我們不使用廣告追蹤 Cookie，僅使用服務必要及功能性 Cookie。',
    '    詳情請參閱<a href="/privacy" style="color:#f5a623;text-decoration:underline;margin-left:4px;">隱私權政策</a>。',
    '  </div>',
    '  <div id="seobaike-cookie-actions">',
    '    <button id="seobaike-cookie-accept" type="button">接受</button>',
    '    <a id="seobaike-cookie-learn" href="/privacy">了解更多</a>',
    '  </div>',
    '</div>'
  ].join('\n');

  // ── 插入 DOM ──
  function insertBanner() {
    document.body.appendChild(banner);

    // 延遲觸發動畫，確保 CSS transition 生效
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.classList.add('visible');
      });
    });

    // ── 接受按鈕事件 ──
    var acceptBtn = document.getElementById('seobaike-cookie-accept');
    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        // 儲存同意記錄
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            accepted: true,
            version: CONSENT_VERSION,
            timestamp: new Date().toISOString()
          }));
        } catch (e) {
          // localStorage 不可用 — 靜默處理
        }

        // 滑出動畫
        banner.classList.remove('visible');
        banner.classList.add('hiding');

        // 動畫結束後移除 DOM
        setTimeout(function () {
          if (banner.parentNode) {
            banner.parentNode.removeChild(banner);
          }
        }, 600);
      });
    }
  }

  // ── 等待 DOM 載入完成 ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertBanner);
  } else {
    // DOM 已載入，延遲 800ms 顯示，避免干擾頁面首次載入
    setTimeout(insertBanner, 800);
  }
})();
