/**
 * SEOBAIKE Smart Content Alignment System
 * ========================================
 * 根據使用者 profile（localStorage: seobaike_profile）
 * 自動對齊：儀表板排序、視覺強調、首頁個性化、導航徽章、CTA 文字、產業色調
 *
 * 版權所有 (c) 小路光有限公司 (統編 60475510)
 * 專利 115100981 — 世界定義約束法用於AI推理
 */
(function SeobaikeSmartAlign() {
  'use strict';

  // ═══════════════════════════════════════════
  // 常數與設定
  // ═══════════════════════════════════════════

  var STORAGE_KEY = 'seobaike_profile';
  var APPLIED_ATTR = 'data-smart-align-applied';
  var GLOW_CLASS = 'smart-align-glow';
  var BADGE_CLASS = 'smart-align-badge';
  var NAV_DOT_CLASS = 'smart-align-nav-dot';
  var OVERLAY_ID = 'smart-align-header-overlay';
  var STYLE_ID = 'smart-align-styles';

  // 使用者需求 -> 儀表板區塊排序優先級
  // 每個 key 對應 need 值，value 是 CSS 選擇器陣列（依照優先順序）
  var SECTION_ORDER = {
    '行銷推廣': [
      '.share-panel',
      '.revenue-panel',
      '.commission-table',
      '.data-panels',
      '.engines',
      '.bot-status-row'
    ],
    '數據分析': [
      '.data-panels',
      '#mainGrid',
      '.engines',
      '.revenue-panel',
      '.activity-feed',
      '.log-section'
    ],
    '客服溝通': [
      '.bot-status-row',
      '.data-panels',
      '.share-panel',
      '.revenue-panel',
      '.engines'
    ],
    '營運管理': [
      '.commission-table',
      '.revenue-panel',
      '#mainGrid',
      '.data-panels',
      '.engines',
      '.activity-feed'
    ]
  };

  // 使用者需求 -> 應高亮的區塊選擇器
  var HIGHLIGHT_SECTIONS = {
    '行銷推廣': ['.share-panel', '.revenue-panel', '.commission-table'],
    '數據分析': ['.data-panels', '#mainGrid', '.engines'],
    '客服溝通': ['.bot-status-row'],
    '營運管理': ['.commission-table', '.revenue-panel'],
    '自動化': ['.engines', '.data-panels'],
    '內容生成': ['.featured-grid', '.engines']
  };

  // 需求 -> 推薦 badge 關鍵字（用於 featured-card 匹配）
  var FEATURED_KEYWORDS = {
    '行銷推廣': ['行銷', '推廣', 'SEO', '廣告', '社群', '分享'],
    '數據分析': ['數據', '分析', '報表', '統計', '監控', 'analytics'],
    '客服溝通': ['客服', '聊天', '機器人', 'bot', '對話', '溝通'],
    '營運管理': ['管理', '營運', '財務', '收入', '報表'],
    '自動化': ['自動', '排程', '流程', 'workflow', '觸發'],
    '內容生成': ['內容', '文案', '生成', '撰寫', 'AI 寫']
  };

  // 首頁 hero 個性化副標題（依 industry）
  var HERO_SUBTITLES = {
    '餐飲': '讓 AI 幫你管好餐廳，你去試菜',
    '零售': '讓 AI 幫你管好店面，你去喝咖啡',
    '醫療': '讓 AI 幫你管好診所，你專心看診',
    '教育': '讓 AI 幫你管好課程，你專心教學',
    '科技': '讓 AI 幫你管好系統，你專心開發',
    '金融': '讓 AI 幫你管好帳務，你專心決策',
    '旅遊': '讓 AI 幫你管好行程，你專心帶客人',
    '房地產': '讓 AI 幫你管好房源，你專心帶看',
    '美容': '讓 AI 幫你管好預約，你專心做美',
    '製造': '讓 AI 幫你管好產線，你專心品管',
    '物流': '讓 AI 幫你管好配送，你專心調度',
    '農業': '讓 AI 幫你管好農場，你專心種田'
  };

  // 需求 -> 導航頁面連結徽章
  var NAV_BADGE_MAP = {
    '行銷推廣': '市集',
    '數據分析': '儀表板',
    '自動化': 'AI',
    '內容生成': 'AI',
    '客服溝通': '機器人',
    '營運管理': '儀表板'
  };

  // 導航文字 -> href 部分匹配（備用）
  var NAV_TEXT_HREF = {
    '市集': '/marketplace',
    '儀表板': '/dashboard',
    '儀錶板': '/dashboard',
    'AI': '/ai',
    '機器人': '/bots',
    '首頁': '/'
  };

  // 產業 -> CTA 文字
  var CTA_TEXT = {
    '餐飲': '管好我的餐廳',
    '零售': '管好我的店',
    '醫療': '管好我的診所',
    '教育': '管好我的課程',
    '科技': '管好我的系統',
    '金融': '管好我的帳務',
    '旅遊': '管好我的行程',
    '房地產': '管好我的房源',
    '美容': '管好我的預約',
    '製造': '管好我的產線',
    '物流': '管好我的配送',
    '農業': '管好我的農場'
  };
  var CTA_DEFAULT = '開始使用';

  // 產業 -> 色調
  var INDUSTRY_COLORS = {
    '餐飲': { from: 'rgba(220, 60, 40, 0.08)', to: 'rgba(232, 133, 12, 0.04)' },
    '科技': { from: 'rgba(40, 100, 220, 0.08)', to: 'rgba(60, 140, 255, 0.04)' },
    '金融': { from: 'rgba(200, 170, 40, 0.08)', to: 'rgba(255, 215, 0, 0.04)' },
    '醫療': { from: 'rgba(40, 180, 120, 0.08)', to: 'rgba(60, 220, 160, 0.04)' },
    '教育': { from: 'rgba(120, 80, 200, 0.08)', to: 'rgba(160, 120, 240, 0.04)' }
  };
  var COLOR_DEFAULT = { from: 'rgba(232, 133, 12, 0.06)', to: 'rgba(232, 133, 12, 0.02)' };

  // ═══════════════════════════════════════════
  // 工具函式
  // ═══════════════════════════════════════════

  /**
   * 安全讀取 profile
   * @returns {{ industry?: string, need?: string } | null}
   */
  function getProfile() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 檢查目前頁面路徑
   */
  function currentPath() {
    return window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  }

  function isDashboard() {
    var p = currentPath();
    return p === '/dashboard' || p === '/dashboard.html';
  }

  function isHomepage() {
    var p = currentPath();
    return p === '/' || p === '/index' || p === '';
  }

  /**
   * 防止重複執行
   */
  function markApplied(el, key) {
    if (!el) return false;
    var val = el.getAttribute(APPLIED_ATTR) || '';
    if (val.indexOf(key) !== -1) return false;
    el.setAttribute(APPLIED_ATTR, val ? val + ',' + key : key);
    return true;
  }

  // ═══════════════════════════════════════════
  // 注入全域樣式（僅注入一次）
  // ═══════════════════════════════════════════

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var css = [
      // 橘色光暈邊框
      '.' + GLOW_CLASS + ' {',
      '  box-shadow: 0 0 12px rgba(232, 133, 12, 0.35), inset 0 0 6px rgba(232, 133, 12, 0.08) !important;',
      '  border-color: rgba(232, 133, 12, 0.5) !important;',
      '  transition: box-shadow 0.4s ease, border-color 0.4s ease !important;',
      '}',

      // 推薦 badge
      '.' + BADGE_CLASS + ' {',
      '  position: absolute;',
      '  top: 8px;',
      '  left: 8px;',
      '  background: linear-gradient(135deg, #e8850c, #cc785c);',
      '  color: #fff;',
      '  font-size: 10px;',
      '  font-weight: 700;',
      '  padding: 2px 8px;',
      '  border-radius: 8px;',
      '  z-index: 5;',
      '  pointer-events: none;',
      '  animation: smartAlignFadeIn 0.5s ease;',
      '}',

      // 導航小圓點
      '.' + NAV_DOT_CLASS + ' {',
      '  position: relative;',
      '}',
      '.' + NAV_DOT_CLASS + '::after {',
      '  content: "";',
      '  position: absolute;',
      '  top: 2px;',
      '  right: -6px;',
      '  width: 6px;',
      '  height: 6px;',
      '  background: #e8850c;',
      '  border-radius: 50%;',
      '  box-shadow: 0 0 4px rgba(232, 133, 12, 0.6);',
      '  animation: smartAlignPulse 2s infinite;',
      '}',

      // header 色調 overlay
      '#' + OVERLAY_ID + ' {',
      '  position: absolute;',
      '  top: 0;',
      '  left: 0;',
      '  right: 0;',
      '  bottom: 0;',
      '  pointer-events: none;',
      '  z-index: 0;',
      '  transition: opacity 0.6s ease;',
      '}',

      // 動畫
      '@keyframes smartAlignFadeIn {',
      '  from { opacity: 0; transform: translateY(-4px); }',
      '  to { opacity: 1; transform: translateY(0); }',
      '}',
      '@keyframes smartAlignPulse {',
      '  0%, 100% { opacity: 1; }',
      '  50% { opacity: 0.3; }',
      '}'
    ].join('\n');

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ═══════════════════════════════════════════
  // 1. 儀表板區塊重排
  // ═══════════════════════════════════════════

  function reorderDashboard(need) {
    if (!isDashboard() || !need) return;

    var order = SECTION_ORDER[need];
    if (!order) return;

    // 找到所有需要重排的容器（header 和 nav-bar 之後的內容區）
    // 收集所有可移動的頂層區塊
    var body = document.body;
    if (!markApplied(body, 'reorder')) return;

    // 找到 nav-bar 作為錨點，在它之後插入排序好的區塊
    var navBar = document.querySelector('.nav-bar');
    var byokBanner = document.querySelector('.byok-dash-banner');
    var anchor = byokBanner || navBar;
    if (!anchor) return;

    // 我們把 section-title 和它緊鄰的內容容器視為一組來移動
    // 同時也移動獨立的頂層區塊
    var sectionTitles = document.querySelectorAll('.section-title');
    var titleContentPairs = {};

    for (var t = 0; t < sectionTitles.length; t++) {
      var title = sectionTitles[t];
      var next = title.nextElementSibling;
      if (next) {
        // 用 next 的 class 或 id 建立映射
        var sel = getSelectorForElement(next);
        if (sel) {
          titleContentPairs[sel] = { title: title, content: next };
        }
      }
    }

    // 按照優先順序，將區塊移到 anchor 之後
    var insertRef = anchor;

    for (var i = 0; i < order.length; i++) {
      var selector = order[i];
      var el = document.querySelector(selector);
      if (!el) continue;

      // 檢查是否有前置的 section-title
      var pair = titleContentPairs[selector];

      if (pair && pair.title) {
        insertAfter(pair.title, insertRef);
        insertRef = pair.title;
        insertAfter(pair.content, insertRef);
        insertRef = pair.content;
      } else {
        // 檢查這個元素前面是否有 HTML comment 標題（<!-- ============ ... ============ -->）
        var prev = el.previousElementSibling;
        // 也搬動前面的 comment（如果是標題）
        if (prev && prev.nodeType === 8) {
          insertAfter(prev, insertRef);
          insertRef = prev;
        }
        insertAfter(el, insertRef);
        insertRef = el;
      }
    }
  }

  function getSelectorForElement(el) {
    if (el.id) return '#' + el.id;
    if (el.classList && el.classList.length > 0) {
      return '.' + el.classList[0];
    }
    return null;
  }

  function insertAfter(newNode, referenceNode) {
    if (!newNode || !referenceNode) return;
    if (referenceNode.nextSibling === newNode) return; // 已經在正確位置
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
  }

  // ═══════════════════════════════════════════
  // 2. 視覺強調（橘色光暈）
  // ═══════════════════════════════════════════

  function applyHighlights(need) {
    if (!isDashboard() || !need) return;

    var selectors = HIGHLIGHT_SECTIONS[need];
    if (!selectors) return;

    // 先移除舊的光暈（冪等）
    var old = document.querySelectorAll('.' + GLOW_CLASS);
    for (var r = 0; r < old.length; r++) {
      old[r].classList.remove(GLOW_CLASS);
    }

    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        el.classList.add(GLOW_CLASS);
      }
    }
  }

  // ═══════════════════════════════════════════
  // 3. Featured 工具推薦 badge
  // ═══════════════════════════════════════════

  function applyFeaturedBadges(need) {
    if (!need) return;

    var keywords = FEATURED_KEYWORDS[need];
    if (!keywords) return;

    // 先移除舊 badge（冪等）
    var oldBadges = document.querySelectorAll('.' + BADGE_CLASS);
    for (var r = 0; r < oldBadges.length; r++) {
      oldBadges[r].parentNode.removeChild(oldBadges[r]);
    }

    var cards = document.querySelectorAll('.featured-card, .card, .mp-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var text = (card.textContent || '').toLowerCase();

      for (var k = 0; k < keywords.length; k++) {
        if (text.indexOf(keywords[k].toLowerCase()) !== -1) {
          // 確保 card 有 position: relative
          var pos = window.getComputedStyle(card).position;
          if (pos === 'static') {
            card.style.position = 'relative';
          }

          var badge = document.createElement('span');
          badge.className = BADGE_CLASS;
          badge.textContent = '\u2728 \u63A8\u85A6'; // ✨ 推薦
          card.appendChild(badge);
          break; // 每張卡片最多一個 badge
        }
      }
    }
  }

  // ═══════════════════════════════════════════
  // 4. 首頁個性化
  // ═══════════════════════════════════════════

  function personalizeHomepage(industry) {
    if (!isHomepage() || !industry) return;

    var subtitle = HERO_SUBTITLES[industry];
    if (!subtitle) return;

    // 尋找 hero 副標題元素
    var heroSub = document.querySelector('.hero-sub');
    if (!heroSub) return;

    if (!markApplied(heroSub, 'hero')) return;

    heroSub.textContent = subtitle;
  }

  // ═══════════════════════════════════════════
  // 5. 導航智慧徽章
  // ═══════════════════════════════════════════

  function applyNavBadge(need) {
    if (!need) return;

    // 先移除舊的（冪等）
    var oldDots = document.querySelectorAll('.' + NAV_DOT_CLASS);
    for (var r = 0; r < oldDots.length; r++) {
      oldDots[r].classList.remove(NAV_DOT_CLASS);
    }

    var targetText = NAV_BADGE_MAP[need];
    if (!targetText) return;

    // 嘗試在多種 nav 結構中找到對應連結
    var allLinks = document.querySelectorAll(
      '.nav-bar a, .nav-links a, .nav a, nav a'
    );

    for (var i = 0; i < allLinks.length; i++) {
      var link = allLinks[i];
      var linkText = (link.textContent || '').trim();
      var linkHref = (link.getAttribute('href') || '');

      // 文字匹配
      if (linkText === targetText) {
        link.classList.add(NAV_DOT_CLASS);
        return;
      }

      // href 匹配（備用）
      var expectedHref = NAV_TEXT_HREF[targetText];
      if (expectedHref && linkHref.indexOf(expectedHref) !== -1) {
        link.classList.add(NAV_DOT_CLASS);
        return;
      }
    }
  }

  // ═══════════════════════════════════════════
  // 6. 個性化 CTA 文字
  // ═══════════════════════════════════════════

  function personalizeCTA(industry) {
    var ctaElements = document.querySelectorAll('.smart-cta');
    if (ctaElements.length === 0) return;

    var text = (industry && CTA_TEXT[industry]) ? CTA_TEXT[industry] : CTA_DEFAULT;

    for (var i = 0; i < ctaElements.length; i++) {
      ctaElements[i].textContent = text;
    }
  }

  // ═══════════════════════════════════════════
  // 7. 產業色調 overlay
  // ═══════════════════════════════════════════

  function applyIndustryColor(industry) {
    // 移除舊 overlay（冪等）
    var existing = document.getElementById(OVERLAY_ID);
    if (existing) {
      existing.parentNode.removeChild(existing);
    }

    if (!industry) return;

    var colors = INDUSTRY_COLORS[industry] || COLOR_DEFAULT;

    // 找 header 元素
    var header = document.querySelector('.header') ||
                 document.querySelector('nav') ||
                 document.querySelector('.hero');
    if (!header) return;

    // 確保 header 有 position relative
    var pos = window.getComputedStyle(header).position;
    if (pos === 'static') {
      header.style.position = 'relative';
    }

    var overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.background = 'linear-gradient(135deg, ' + colors.from + ' 0%, ' + colors.to + ' 100%)';
    header.appendChild(overlay);
  }

  // ═══════════════════════════════════════════
  // 主執行入口
  // ═══════════════════════════════════════════

  function run() {
    var profile = getProfile();

    // 無 profile -> 靜默退出，不影響任何東西
    if (!profile) return;

    var industry = profile.industry || null;
    var need = profile.need || null;

    // 注入樣式（一次）
    injectStyles();

    // 依序執行各功能模組
    // 使用 requestAnimationFrame 避免阻塞渲染

    requestAnimationFrame(function () {
      // 1. 儀表板區塊重排
      reorderDashboard(need);

      // 2. 視覺強調
      applyHighlights(need);

      // 3. Featured 推薦 badge
      applyFeaturedBadges(need);

      requestAnimationFrame(function () {
        // 4. 首頁個性化
        personalizeHomepage(industry);

        // 5. 導航徽章
        applyNavBadge(need);

        // 6. CTA 文字
        personalizeCTA(industry);

        // 7. 產業色調
        applyIndustryColor(industry);
      });
    });
  }

  // ═══════════════════════════════════════════
  // 啟動
  // ═══════════════════════════════════════════

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    // DOM 已載入完畢，直接執行
    requestAnimationFrame(run);
  }

  // 對外暴露介面，允許手動重新執行（例如 profile 變更後）
  window.SeobaikeSmartAlign = {
    run: run,
    getProfile: getProfile
  };

})();
