// ============================================================
// SEOBAIKE 主動式 AI 聊天 Widget — "小百 2.0"
// 自包含嵌入式腳本，純 vanilla JS，零依賴
// 主動出擊：AI 不等人來問，而是先開口
// 連接 Workers API: /api/ai/smart
// ============================================================

(function () {
  'use strict';

  // ── 設定 ──
  var CONFIG = {
    apiUrl: '/api/widget-chat',
    fallbackMessage: '系統忙碌中，請稍後再試或到 /contact 留言。',
    greetingDelay: 3000,
    greetingAutoHide: 8000,
    inactivityDelay: 30000,
    maxHistory: 10,
    storageKeys: {
      profile: 'seobaike_profile',
      chatHistory: 'seobaike_chat_history',
      widgetClosed: 'seobaike_widget_closed',
      lastPage: 'seobaike_last_page',
      visitCount: 'seobaike_visit_count',
      sessionMessages: 'seobaike_session_proactive'
    }
  };

  // ── 頁面上下文建議（可愛親切，不分人） ──
  var PAGE_SUGGESTIONS = {
    '/': {
      greeting: '想做什麼呀？隨便問～',
      pills: [
        { icon: '\uD83D\uDC4B', text: '逛逛看' },
        { icon: '\uD83C\uDF1F', text: '新手上路' }
      ]
    },
    '/pricing': {
      greeting: '找適合自己的就好，不急～',
      pills: [
        { icon: '\uD83E\uDD14', text: '怎麼選' },
        { icon: '\uD83D\uDCAC', text: '問問題' }
      ]
    },
    '/features': {
      greeting: '看到喜歡的功能可以問我～',
      pills: [
        { icon: '\u2B50', text: '推薦功能' },
        { icon: '\uD83D\uDCAC', text: '問問題' }
      ]
    },
    '/dashboard': {
      greeting: '今天狀況怎樣？有什麼要看的嗎',
      pills: [
        { icon: '\uD83D\uDCCA', text: '看數據' },
        { icon: '\uD83D\uDCAC', text: '問問題' }
      ]
    },
    '/marketplace': {
      greeting: '歡迎逛逛～有什麼想找的嗎',
      pills: [
        { icon: '\uD83D\uDD0D', text: '找東西' },
        { icon: '\uD83C\uDF1F', text: '熱門' }
      ]
    },
    '/ai': {
      greeting: '直接打字就行，問什麼都可以～',
      pills: [
        { icon: '\uD83D\uDCDD', text: '幫我寫' },
        { icon: '\uD83D\uDCA1', text: '給建議' }
      ]
    }
  };

  // ── 狀態 ──
  var state = {
    isOpen: false,
    isSending: false,
    greetingVisible: false,
    greetingTimeout: null,
    inactivityTimer: null,
    shownProactiveMessages: {},
    visitorId: 'visitor-' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
  };

  // ── SVG 圖示 ──
  var ICONS = {
    chat: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
    close: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    send: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>'
  };

  // ── DOM 參照 ──
  var els = {};

  // ══════════════════════════════════════════
  // CSS 樣式注入
  // ══════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('seobaike-widget-styles')) return;
    var style = document.createElement('style');
    style.id = 'seobaike-widget-styles';
    style.textContent = '\n' +

    /* ── 浮動按鈕 ── */
    '#seobaike-chat-btn {\n' +
    '  position: fixed;\n' +
    '  bottom: 24px;\n' +
    '  right: 24px;\n' +
    '  width: 60px;\n' +
    '  height: 60px;\n' +
    '  border-radius: 50%;\n' +
    '  background: #e8850c;\n' +
    '  border: none;\n' +
    '  cursor: pointer;\n' +
    '  box-shadow: 0 4px 20px rgba(232,133,12,0.5);\n' +
    '  z-index: 10000;\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  justify-content: center;\n' +
    '  transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease, opacity 0.3s ease;\n' +
    '  padding: 0;\n' +
    '  outline: none;\n' +
    '}\n' +
    '#seobaike-chat-btn:hover {\n' +
    '  transform: scale(1.1);\n' +
    '  box-shadow: 0 6px 28px rgba(232,133,12,0.65);\n' +
    '}\n' +
    '#seobaike-chat-btn.sb-hidden {\n' +
    '  transform: scale(0);\n' +
    '  opacity: 0;\n' +
    '  pointer-events: none;\n' +
    '}\n' +

    /* ── 主動招呼氣泡 ── */
    '#seobaike-greeting {\n' +
    '  position: fixed;\n' +
    '  bottom: 96px;\n' +
    '  right: 24px;\n' +
    '  max-width: 280px;\n' +
    '  background: #1a1a2e;\n' +
    '  color: #f0f0ff;\n' +
    '  padding: 14px 18px;\n' +
    '  border-radius: 16px 16px 4px 16px;\n' +
    '  font-size: 14px;\n' +
    '  line-height: 1.5;\n' +
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;\n' +
    '  box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(232,133,12,0.25);\n' +
    '  z-index: 10001;\n' +
    '  cursor: pointer;\n' +
    '  transform: translateY(10px) scale(0.9);\n' +
    '  opacity: 0;\n' +
    '  transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease;\n' +
    '  pointer-events: none;\n' +
    '}\n' +
    '#seobaike-greeting.sb-visible {\n' +
    '  transform: translateY(0) scale(1);\n' +
    '  opacity: 1;\n' +
    '  pointer-events: auto;\n' +
    '}\n' +
    '#seobaike-greeting::after {\n' +
    '  content: "";\n' +
    '  position: absolute;\n' +
    '  bottom: -8px;\n' +
    '  right: 20px;\n' +
    '  width: 0;\n' +
    '  height: 0;\n' +
    '  border-left: 8px solid transparent;\n' +
    '  border-right: 8px solid transparent;\n' +
    '  border-top: 8px solid #1a1a2e;\n' +
    '}\n' +
    '#seobaike-greeting:hover {\n' +
    '  background: #252540;\n' +
    '}\n' +

    /* ── 聊天面板 ── */
    '#seobaike-chat-panel {\n' +
    '  position: fixed;\n' +
    '  bottom: 24px;\n' +
    '  right: 24px;\n' +
    '  width: 380px;\n' +
    '  height: 500px;\n' +
    '  background: rgba(10,10,26,0.95);\n' +
    '  backdrop-filter: blur(20px);\n' +
    '  -webkit-backdrop-filter: blur(20px);\n' +
    '  border-radius: 16px;\n' +
    '  box-shadow: 0 8px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(232,133,12,0.2);\n' +
    '  z-index: 10000;\n' +
    '  display: flex;\n' +
    '  flex-direction: column;\n' +
    '  overflow: hidden;\n' +
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;\n' +
    '  transform: scale(0) translateY(20px);\n' +
    '  transform-origin: bottom right;\n' +
    '  opacity: 0;\n' +
    '  transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease;\n' +
    '  pointer-events: none;\n' +
    '}\n' +
    '#seobaike-chat-panel.sb-open {\n' +
    '  transform: scale(1) translateY(0);\n' +
    '  opacity: 1;\n' +
    '  pointer-events: auto;\n' +
    '}\n' +

    /* ── 標題列 ── */
    '.sb-header {\n' +
    '  background: linear-gradient(135deg, #e8850c 0%, #d4700a 100%);\n' +
    '  padding: 14px 16px;\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  justify-content: space-between;\n' +
    '  flex-shrink: 0;\n' +
    '}\n' +
    '.sb-header-info {\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  gap: 10px;\n' +
    '}\n' +
    '.sb-header-avatar {\n' +
    '  width: 36px;\n' +
    '  height: 36px;\n' +
    '  border-radius: 50%;\n' +
    '  background: rgba(255,255,255,0.2);\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  justify-content: center;\n' +
    '  font-size: 18px;\n' +
    '  color: white;\n' +
    '  font-weight: 700;\n' +
    '  flex-shrink: 0;\n' +
    '}\n' +
    '.sb-header-text h3 {\n' +
    '  margin: 0;\n' +
    '  font-size: 15px;\n' +
    '  font-weight: 700;\n' +
    '  color: white;\n' +
    '  line-height: 1.2;\n' +
    '}\n' +
    '.sb-header-text span {\n' +
    '  font-size: 11px;\n' +
    '  color: rgba(255,255,255,0.8);\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  gap: 4px;\n' +
    '}\n' +
    '.sb-online-dot {\n' +
    '  width: 6px;\n' +
    '  height: 6px;\n' +
    '  border-radius: 50%;\n' +
    '  background: #4ade80;\n' +
    '  display: inline-block;\n' +
    '}\n' +
    '.sb-close-btn {\n' +
    '  background: rgba(255,255,255,0.15);\n' +
    '  border: none;\n' +
    '  width: 32px;\n' +
    '  height: 32px;\n' +
    '  border-radius: 8px;\n' +
    '  cursor: pointer;\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  justify-content: center;\n' +
    '  transition: background 0.2s;\n' +
    '  padding: 0;\n' +
    '  outline: none;\n' +
    '}\n' +
    '.sb-close-btn:hover {\n' +
    '  background: rgba(255,255,255,0.3);\n' +
    '}\n' +

    /* ── 訊息區 ── */
    '.sb-messages {\n' +
    '  flex: 1;\n' +
    '  overflow-y: auto;\n' +
    '  padding: 16px;\n' +
    '  background: rgba(18,18,42,0.8);\n' +
    '  display: flex;\n' +
    '  flex-direction: column;\n' +
    '  gap: 12px;\n' +
    '}\n' +
    '.sb-messages::-webkit-scrollbar {\n' +
    '  width: 5px;\n' +
    '}\n' +
    '.sb-messages::-webkit-scrollbar-track {\n' +
    '  background: transparent;\n' +
    '}\n' +
    '.sb-messages::-webkit-scrollbar-thumb {\n' +
    '  background: rgba(255,255,255,0.15);\n' +
    '  border-radius: 4px;\n' +
    '}\n' +
    '.sb-messages::-webkit-scrollbar-thumb:hover {\n' +
    '  background: rgba(255,255,255,0.25);\n' +
    '}\n' +

    /* ── 訊息氣泡 ── */
    '.sb-msg {\n' +
    '  display: flex;\n' +
    '  flex-direction: column;\n' +
    '  max-width: 82%;\n' +
    '  animation: sb-fade-in 0.3s ease;\n' +
    '}\n' +
    '@keyframes sb-fade-in {\n' +
    '  from { opacity: 0; transform: translateY(8px); }\n' +
    '  to { opacity: 1; transform: translateY(0); }\n' +
    '}\n' +
    '.sb-msg-user {\n' +
    '  align-self: flex-end;\n' +
    '}\n' +
    '.sb-msg-bot {\n' +
    '  align-self: flex-start;\n' +
    '}\n' +
    '.sb-msg-bubble {\n' +
    '  padding: 10px 14px;\n' +
    '  border-radius: 14px;\n' +
    '  font-size: 13.5px;\n' +
    '  line-height: 1.55;\n' +
    '  word-break: break-word;\n' +
    '  white-space: pre-wrap;\n' +
    '}\n' +
    '.sb-msg-user .sb-msg-bubble {\n' +
    '  background: #e8850c;\n' +
    '  color: white;\n' +
    '  border-bottom-right-radius: 4px;\n' +
    '}\n' +
    '.sb-msg-bot .sb-msg-bubble {\n' +
    '  background: #1a1a3a;\n' +
    '  color: #e0e0ef;\n' +
    '  border-bottom-left-radius: 4px;\n' +
    '}\n' +
    '.sb-msg-time {\n' +
    '  font-size: 10px;\n' +
    '  color: rgba(255,255,255,0.3);\n' +
    '  margin-top: 4px;\n' +
    '  padding: 0 4px;\n' +
    '}\n' +
    '.sb-msg-user .sb-msg-time {\n' +
    '  text-align: right;\n' +
    '}\n' +

    /* ── 快速操作按鈕 ── */
    '.sb-quick-actions {\n' +
    '  display: flex;\n' +
    '  flex-wrap: wrap;\n' +
    '  gap: 8px;\n' +
    '  padding: 4px 0 8px 0;\n' +
    '  animation: sb-fade-in 0.4s ease;\n' +
    '}\n' +
    '.sb-quick-pill {\n' +
    '  display: inline-flex;\n' +
    '  align-items: center;\n' +
    '  gap: 6px;\n' +
    '  padding: 8px 14px;\n' +
    '  background: rgba(232,133,12,0.12);\n' +
    '  border: 1px solid rgba(232,133,12,0.3);\n' +
    '  border-radius: 20px;\n' +
    '  color: #e8a050;\n' +
    '  font-size: 13px;\n' +
    '  cursor: pointer;\n' +
    '  transition: all 0.2s ease;\n' +
    '  font-family: inherit;\n' +
    '  outline: none;\n' +
    '}\n' +
    '.sb-quick-pill:hover {\n' +
    '  background: rgba(232,133,12,0.25);\n' +
    '  border-color: rgba(232,133,12,0.5);\n' +
    '  color: #f0b060;\n' +
    '  transform: translateY(-1px);\n' +
    '}\n' +
    '.sb-quick-pill:active {\n' +
    '  transform: translateY(0);\n' +
    '}\n' +

    /* ── 打字動畫 ── */
    '.sb-typing-indicator {\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  gap: 5px;\n' +
    '  padding: 12px 16px;\n' +
    '  background: #1a1a3a;\n' +
    '  border-radius: 14px;\n' +
    '  border-bottom-left-radius: 4px;\n' +
    '  align-self: flex-start;\n' +
    '  animation: sb-fade-in 0.3s ease;\n' +
    '}\n' +
    '.sb-typing-dot {\n' +
    '  width: 7px;\n' +
    '  height: 7px;\n' +
    '  border-radius: 50%;\n' +
    '  background: #e8850c;\n' +
    '  animation: sb-typing-bounce 1.4s infinite ease-in-out;\n' +
    '}\n' +
    '.sb-typing-dot:nth-child(2) { animation-delay: 0.16s; }\n' +
    '.sb-typing-dot:nth-child(3) { animation-delay: 0.32s; }\n' +
    '@keyframes sb-typing-bounce {\n' +
    '  0%, 80%, 100% { transform: scale(0.4); opacity: 0.4; }\n' +
    '  40% { transform: scale(1); opacity: 1; }\n' +
    '}\n' +

    /* ── 輸入區 ── */
    '.sb-input-area {\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  gap: 8px;\n' +
    '  padding: 12px 14px;\n' +
    '  background: rgba(10,10,26,0.95);\n' +
    '  border-top: 1px solid rgba(255,255,255,0.06);\n' +
    '  flex-shrink: 0;\n' +
    '}\n' +
    '.sb-input-field {\n' +
    '  flex: 1;\n' +
    '  padding: 10px 14px;\n' +
    '  border-radius: 12px;\n' +
    '  border: 1px solid rgba(255,255,255,0.1);\n' +
    '  background: #12122a;\n' +
    '  color: #f0f0ff;\n' +
    '  font-size: 13.5px;\n' +
    '  outline: none;\n' +
    '  transition: border-color 0.2s;\n' +
    '  font-family: inherit;\n' +
    '}\n' +
    '.sb-input-field:focus {\n' +
    '  border-color: #e8850c;\n' +
    '}\n' +
    '.sb-input-field::placeholder {\n' +
    '  color: rgba(255,255,255,0.3);\n' +
    '}\n' +
    '.sb-send-btn {\n' +
    '  width: 40px;\n' +
    '  height: 40px;\n' +
    '  border-radius: 12px;\n' +
    '  border: none;\n' +
    '  background: #e8850c;\n' +
    '  cursor: pointer;\n' +
    '  display: flex;\n' +
    '  align-items: center;\n' +
    '  justify-content: center;\n' +
    '  transition: background 0.2s, transform 0.15s;\n' +
    '  flex-shrink: 0;\n' +
    '  padding: 0;\n' +
    '  outline: none;\n' +
    '}\n' +
    '.sb-send-btn:hover {\n' +
    '  background: #d4700a;\n' +
    '  transform: scale(1.05);\n' +
    '}\n' +
    '.sb-send-btn:active {\n' +
    '  transform: scale(0.95);\n' +
    '}\n' +
    '.sb-send-btn:disabled {\n' +
    '  background: #5a3a10;\n' +
    '  cursor: not-allowed;\n' +
    '  transform: none;\n' +
    '}\n' +

    /* ── 底部品牌 ── */
    '.sb-footer {\n' +
    '  text-align: center;\n' +
    '  padding: 6px;\n' +
    '  font-size: 10px;\n' +
    '  color: rgba(255,255,255,0.2);\n' +
    '  background: rgba(10,10,26,0.95);\n' +
    '  flex-shrink: 0;\n' +
    '  letter-spacing: 0.3px;\n' +
    '}\n' +

    /* ── 按鈕脈衝動畫（主動出擊時） ── */
    '@keyframes sb-pulse {\n' +
    '  0% { box-shadow: 0 4px 20px rgba(232,133,12,0.5); }\n' +
    '  50% { box-shadow: 0 4px 20px rgba(232,133,12,0.5), 0 0 0 12px rgba(232,133,12,0); }\n' +
    '  100% { box-shadow: 0 4px 20px rgba(232,133,12,0.5); }\n' +
    '}\n' +
    '#seobaike-chat-btn.sb-pulse {\n' +
    '  animation: sb-pulse 2s ease-in-out infinite;\n' +
    '}\n' +

    /* ── 手機響應式 ── */
    '@media (max-width: 480px) {\n' +
    '  #seobaike-chat-panel {\n' +
    '    width: 100%;\n' +
    '    height: 100%;\n' +
    '    bottom: 0;\n' +
    '    right: 0;\n' +
    '    border-radius: 0;\n' +
    '    transform-origin: bottom center;\n' +
    '  }\n' +
    '  #seobaike-chat-btn {\n' +
    '    bottom: 16px;\n' +
    '    right: 16px;\n' +
    '  }\n' +
    '  #seobaike-greeting {\n' +
    '    bottom: 88px;\n' +
    '    right: 16px;\n' +
    '    max-width: calc(100vw - 80px);\n' +
    '  }\n' +
    '}\n';

    document.head.appendChild(style);
  }

  // ══════════════════════════════════════════
  // 工具函式
  // ══════════════════════════════════════════

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getTimeString() {
    var now = new Date();
    var h = ('0' + now.getHours()).slice(-2);
    var m = ('0' + now.getMinutes()).slice(-2);
    return h + ':' + m;
  }

  function getCurrentPath() {
    var path = window.location.pathname.replace(/\.html$/, '');
    if (path === '' || path === '/index') path = '/';
    // 去掉尾端斜線（但保留根路徑 /）
    if (path.length > 1 && path.charAt(path.length - 1) === '/') {
      path = path.slice(0, -1);
    }
    return path;
  }

  function getPageContext() {
    var path = getCurrentPath();
    // 精確匹配
    if (PAGE_SUGGESTIONS[path]) return PAGE_SUGGESTIONS[path];
    // 前綴匹配（例如 /dashboard/xxx）
    var keys = Object.keys(PAGE_SUGGESTIONS);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] !== '/' && path.indexOf(keys[i]) === 0) {
        return PAGE_SUGGESTIONS[keys[i]];
      }
    }
    // 預設
    return {
      greeting: '想了解什麼？直接問就行',
      pills: [
        { icon: '\uD83D\uDE80', text: '平台怎麼用' },
        { icon: '\uD83D\uDCAC', text: '直接問問題' },
        { icon: '\uD83C\uDF1F', text: '熱門功能' }
      ]
    };
  }

  function getProfile() {
    try {
      var raw = localStorage.getItem(CONFIG.storageKeys.profile);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* 靜默 */ }
    return null;
  }

  function getChatHistory() {
    try {
      var raw = localStorage.getItem(CONFIG.storageKeys.chatHistory);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* 靜默 */ }
    return [];
  }

  function saveChatHistory(messages) {
    try {
      // 只保留最後 N 條
      var trimmed = messages.slice(-CONFIG.maxHistory);
      localStorage.setItem(CONFIG.storageKeys.chatHistory, JSON.stringify(trimmed));
    } catch (e) { /* 靜默 */ }
  }

  function addToHistory(role, text) {
    var history = getChatHistory();
    history.push({ role: role, text: text, time: Date.now() });
    saveChatHistory(history);
  }

  function getVisitCount() {
    try {
      var count = parseInt(localStorage.getItem(CONFIG.storageKeys.visitCount) || '0', 10);
      return count;
    } catch (e) { return 0; }
  }

  function incrementVisitCount() {
    try {
      var count = getVisitCount() + 1;
      localStorage.setItem(CONFIG.storageKeys.visitCount, String(count));
      return count;
    } catch (e) { return 1; }
  }

  function getLastPage() {
    try {
      return localStorage.getItem(CONFIG.storageKeys.lastPage) || '';
    } catch (e) { return ''; }
  }

  function saveLastPage() {
    try {
      localStorage.setItem(CONFIG.storageKeys.lastPage, getCurrentPath());
    } catch (e) { /* 靜默 */ }
  }

  function wasExplicitlyClosed() {
    try {
      return localStorage.getItem(CONFIG.storageKeys.widgetClosed) === 'true';
    } catch (e) { return false; }
  }

  function setExplicitlyClosed(val) {
    try {
      if (val) {
        localStorage.setItem(CONFIG.storageKeys.widgetClosed, 'true');
      } else {
        localStorage.removeItem(CONFIG.storageKeys.widgetClosed);
      }
    } catch (e) { /* 靜默 */ }
  }

  /** 判斷某條主動訊息在本 session 是否已顯示過 */
  function hasShownProactive(key) {
    return !!state.shownProactiveMessages[key];
  }

  function markProactiveShown(key) {
    state.shownProactiveMessages[key] = true;
  }

  // ══════════════════════════════════════════
  // DOM 建構
  // ══════════════════════════════════════════

  function createWidget() {
    // --- 浮動按鈕 ---
    els.chatBtn = document.createElement('button');
    els.chatBtn.id = 'seobaike-chat-btn';
    els.chatBtn.setAttribute('aria-label', 'SEOBAIKE AI 助手');
    els.chatBtn.innerHTML = ICONS.chat;
    els.chatBtn.addEventListener('click', function () {
      hideGreeting();
      openChat();
    });
    document.body.appendChild(els.chatBtn);

    // --- 主動招呼氣泡 ---
    els.greeting = document.createElement('div');
    els.greeting.id = 'seobaike-greeting';
    els.greeting.addEventListener('click', function () {
      hideGreeting();
      openChat();
    });
    document.body.appendChild(els.greeting);

    // --- 聊天面板 ---
    els.chatPanel = document.createElement('div');
    els.chatPanel.id = 'seobaike-chat-panel';
    els.chatPanel.setAttribute('role', 'dialog');
    els.chatPanel.setAttribute('aria-label', 'SEOBAIKE AI 助手對話');

    // 標題列
    var header = document.createElement('div');
    header.className = 'sb-header';
    header.innerHTML =
      '<div class="sb-header-info">' +
      '  <div class="sb-header-avatar">\u5C0F</div>' +
      '  <div class="sb-header-text">' +
      '    <h3>SEOBAIKE \u5C0F\u767E</h3>' +
      '    <span><span class="sb-online-dot"></span> AI \u52A9\u624B \u00b7 \u96A8\u6642\u70BA\u4F60\u670D\u52D9</span>' +
      '  </div>' +
      '</div>';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'sb-close-btn';
    closeBtn.setAttribute('aria-label', '\u95DC\u9589\u5C0D\u8A71');
    closeBtn.innerHTML = ICONS.close;
    closeBtn.addEventListener('click', function () {
      closeChat(true);
    });
    header.appendChild(closeBtn);

    // 訊息容器
    els.messagesContainer = document.createElement('div');
    els.messagesContainer.className = 'sb-messages';

    // 輸入區
    var inputArea = document.createElement('div');
    inputArea.className = 'sb-input-area';

    els.inputField = document.createElement('input');
    els.inputField.type = 'text';
    els.inputField.className = 'sb-input-field';
    els.inputField.placeholder = '\u8F38\u5165\u8A0A\u606F...';
    els.inputField.setAttribute('aria-label', '\u8F38\u5165\u8A0A\u606F');
    els.inputField.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // 輸入時重設閒置計時器
    els.inputField.addEventListener('input', resetInactivityTimer);

    els.sendBtn = document.createElement('button');
    els.sendBtn.className = 'sb-send-btn';
    els.sendBtn.setAttribute('aria-label', '\u50B3\u9001');
    els.sendBtn.innerHTML = ICONS.send;
    els.sendBtn.addEventListener('click', handleSend);

    inputArea.appendChild(els.inputField);
    inputArea.appendChild(els.sendBtn);

    // 底部品牌
    var footer = document.createElement('div');
    footer.className = 'sb-footer';
    footer.textContent = 'Powered by SEOBAIKE CaaS';

    // 組裝
    els.chatPanel.appendChild(header);
    els.chatPanel.appendChild(els.messagesContainer);
    els.chatPanel.appendChild(inputArea);
    els.chatPanel.appendChild(footer);
    document.body.appendChild(els.chatPanel);
  }

  // ══════════════════════════════════════════
  // 招呼氣泡（出現在按鈕上方）
  // ══════════════════════════════════════════

  function showGreeting(text) {
    if (state.isOpen) return;
    if (state.greetingVisible) return;

    els.greeting.textContent = text;
    state.greetingVisible = true;
    els.greeting.classList.add('sb-visible');
    els.chatBtn.classList.add('sb-pulse');

    // 自動隱藏
    clearTimeout(state.greetingTimeout);
    state.greetingTimeout = setTimeout(function () {
      hideGreeting();
    }, CONFIG.greetingAutoHide);
  }

  function hideGreeting() {
    if (!state.greetingVisible) return;
    state.greetingVisible = false;
    els.greeting.classList.remove('sb-visible');
    els.chatBtn.classList.remove('sb-pulse');
    clearTimeout(state.greetingTimeout);
  }

  // ══════════════════════════════════════════
  // 開關面板
  // ══════════════════════════════════════════

  function openChat() {
    if (state.isOpen) return;
    state.isOpen = true;
    hideGreeting();
    setExplicitlyClosed(false);
    els.chatPanel.classList.add('sb-open');
    els.chatBtn.classList.add('sb-hidden');
    setTimeout(function () {
      els.inputField.focus();
    }, 350);
    resetInactivityTimer();
  }

  function closeChat(explicit) {
    if (!state.isOpen) return;
    state.isOpen = false;
    els.chatPanel.classList.remove('sb-open');
    els.chatBtn.classList.remove('sb-hidden');
    if (explicit) {
      setExplicitlyClosed(true);
    }
    clearInactivityTimer();
  }

  // ══════════════════════════════════════════
  // 訊息渲染
  // ══════════════════════════════════════════

  function appendUserMessage(text) {
    var wrapper = document.createElement('div');
    wrapper.className = 'sb-msg sb-msg-user';

    var bubble = document.createElement('div');
    bubble.className = 'sb-msg-bubble';
    bubble.textContent = text;

    var time = document.createElement('div');
    time.className = 'sb-msg-time';
    time.textContent = getTimeString();

    wrapper.appendChild(bubble);
    wrapper.appendChild(time);
    els.messagesContainer.appendChild(wrapper);
    scrollToBottom();
  }

  function appendBotMessage(text) {
    var wrapper = document.createElement('div');
    wrapper.className = 'sb-msg sb-msg-bot';

    var bubble = document.createElement('div');
    bubble.className = 'sb-msg-bubble';
    bubble.innerHTML = escapeHtml(text);

    var time = document.createElement('div');
    time.className = 'sb-msg-time';
    time.textContent = '\u5C0F\u767E \u00b7 ' + getTimeString();

    wrapper.appendChild(bubble);
    wrapper.appendChild(time);
    els.messagesContainer.appendChild(wrapper);
    scrollToBottom();
  }

  function appendQuickActions(pills) {
    var wrapper = document.createElement('div');
    wrapper.className = 'sb-quick-actions';

    for (var i = 0; i < pills.length; i++) {
      (function (pill) {
        var btn = document.createElement('button');
        btn.className = 'sb-quick-pill';
        btn.textContent = pill.icon + ' ' + pill.text;
        btn.addEventListener('click', function () {
          // 移除快速操作區
          if (wrapper.parentNode) {
            wrapper.parentNode.removeChild(wrapper);
          }
          // 當作使用者輸入送出
          sendMessage(pill.text);
        });
        wrapper.appendChild(btn);
      })(pills[i]);
    }

    els.messagesContainer.appendChild(wrapper);
    scrollToBottom();
  }

  function showTyping() {
    var el = document.createElement('div');
    el.className = 'sb-typing-indicator';
    el.id = 'sb-typing';
    el.innerHTML = '<span class="sb-typing-dot"></span><span class="sb-typing-dot"></span><span class="sb-typing-dot"></span>';
    els.messagesContainer.appendChild(el);
    scrollToBottom();
  }

  function hideTyping() {
    var el = document.getElementById('sb-typing');
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  function scrollToBottom() {
    requestAnimationFrame(function () {
      els.messagesContainer.scrollTop = els.messagesContainer.scrollHeight;
    });
  }

  // ══════════════════════════════════════════
  // 發送與 AI 通訊
  // ══════════════════════════════════════════

  function sendMessage(text) {
    if (state.isSending) return;
    if (!text || !text.trim()) return;

    text = text.trim();
    appendUserMessage(text);
    addToHistory('user', text);

    state.isSending = true;
    els.sendBtn.disabled = true;
    showTyping();
    resetInactivityTimer();

    callAI(text)
      .then(function (reply) {
        hideTyping();
        appendBotMessage(reply);
        addToHistory('bot', reply);
      })
      .catch(function () {
        hideTyping();
        appendBotMessage(CONFIG.fallbackMessage);
      })
      .finally(function () {
        state.isSending = false;
        els.sendBtn.disabled = false;
        els.inputField.focus();
      });
  }

  function handleSend() {
    var text = els.inputField.value;
    els.inputField.value = '';
    sendMessage(text);
  }

  function callAI(message) {
    var body = {
      message: message,
      page: getCurrentPath(),
      visitor_id: state.visitorId,
      platform: 'web-widget'
    };

    var profile = getProfile();
    if (profile) {
      body.industry = profile.industry || '';
      body.user_name = profile.name || '';
    }

    return fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var reply = data.reply
          || data.message
          || data.response
          || (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
          || (data.data && data.data.reply)
          || null;

        if (!reply || typeof reply !== 'string') {
          throw new Error('Empty reply');
        }
        return reply;
      });
  }

  // ══════════════════════════════════════════
  // 主動行為引擎（核心差異化功能）
  // ══════════════════════════════════════════

  /** 建構個人化招呼語 */
  function buildPersonalGreeting() {
    return '\u55E8\uFF5E\u60F3\u505A\u4EC0\u9EBC\u5440';
  }

  /** 建構初次/回訪招呼語 */
  function buildVisitGreeting() {
    var history = getChatHistory();
    var lastPage = getLastPage();
    var visitCount = getVisitCount();

    // 完全新訪客
    if (visitCount <= 1 && history.length === 0) {
      return '\u55E8\uFF5E\u6B61\u8FCE\u4F86\u73A9';
    }

    // 回訪用戶
    if (visitCount > 1) {
      return '\u55E8\uFF5E\u53C8\u898B\u9762\u4E86';
    }

    return null;
  }

  /** 3 秒後自動彈出招呼 */
  function scheduleAutoGreeting() {
    if (wasExplicitlyClosed()) return;

    setTimeout(function () {
      if (state.isOpen) return;
      if (hasShownProactive('auto-greeting')) return;

      // 優先使用訪客狀態招呼語
      var visitGreeting = buildVisitGreeting();
      var text = visitGreeting || buildPersonalGreeting();

      markProactiveShown('auto-greeting');
      showGreeting(text);
    }, CONFIG.greetingDelay);
  }

  /** 閒置 30 秒後主動出擊 */
  function resetInactivityTimer() {
    clearInactivityTimer();
    state.inactivityTimer = setTimeout(function () {
      if (state.isOpen) {
        // 面板已打開 — 在聊天內提示
        if (!hasShownProactive('inactivity-chat')) {
          markProactiveShown('inactivity-chat');
          var ctx = getPageContext();
          appendBotMessage('\u6709\u4EC0\u9EBC\u60F3\u554F\u7684\u55CE\uFF5E');
        }
      } else {
        // 面板關閉 — 顯示氣泡
        if (!hasShownProactive('inactivity-bubble')) {
          markProactiveShown('inactivity-bubble');
          showGreeting('\u55E8\uFF5E\u9700\u8981\u5E6B\u624B\u55CE');
        }
      }
    }, CONFIG.inactivityDelay);
  }

  function clearInactivityTimer() {
    if (state.inactivityTimer) {
      clearTimeout(state.inactivityTimer);
      state.inactivityTimer = null;
    }
  }

  /** 監聽捲動 — 在 pricing 區塊附近主動出擊 */
  function setupScrollWatcher() {
    var lastScrollY = 0;
    var scrollHandler = function () {
      resetInactivityTimer();

      var currentScrollY = window.scrollY || window.pageYOffset;
      // 只在向下捲動時觸發
      if (currentScrollY <= lastScrollY) {
        lastScrollY = currentScrollY;
        return;
      }
      lastScrollY = currentScrollY;

      // 已經顯示過，不重複
      if (hasShownProactive('scroll-pricing')) return;
      if (state.isOpen) return;

      // 偵測 pricing 相關元素
      var pricingEl = document.querySelector('[id*="pricing"], [class*="pricing"], [data-section="pricing"]');
      if (pricingEl) {
        var rect = pricingEl.getBoundingClientRect();
        var windowH = window.innerHeight;
        // 元素進入視窗
        if (rect.top < windowH && rect.bottom > 0) {
          markProactiveShown('scroll-pricing');
          showGreeting('\u60F3\u4E86\u89E3\u66F4\u591A\u55CE\uFF1F\u554F\u6211\u5C31\u597D\uFF01');
        }
      }
    };

    window.addEventListener('scroll', scrollHandler, { passive: true });
  }

  /** 建立歡迎訊息 + 快速按鈕（在面板打開時） */
  function populateWelcome() {
    var profile = getProfile();
    var ctx = getPageContext();

    // 歡迎語（禁止自我介紹、禁止報價、像朋友聊天）
    var welcomeText;
    if (profile && profile.industry) {
      welcomeText = '\u55E8\uFF5E' + ctx.greeting;
    } else {
      welcomeText = '\u55E8\uFF5E' + ctx.greeting;
    }

    appendBotMessage(welcomeText);

    // 載入歷史訊息（最多最後 6 條，讓畫面不要太擠）
    var history = getChatHistory();
    var recentHistory = history.slice(-6);
    for (var i = 0; i < recentHistory.length; i++) {
      var msg = recentHistory[i];
      if (msg.role === 'user') {
        appendUserMessage(msg.text);
      } else {
        appendBotMessage(msg.text);
      }
    }

    // 快速操作按鈕（只在沒有歷史記錄時顯示，保持乾淨）
    if (history.length === 0) {
      appendQuickActions(ctx.pills);
    }
  }

  // ══════════════════════════════════════════
  // 全域事件監聽（活動追蹤）
  // ══════════════════════════════════════════

  function setupActivityListeners() {
    var events = ['mousemove', 'keydown', 'touchstart', 'click'];
    for (var i = 0; i < events.length; i++) {
      document.addEventListener(events[i], resetInactivityTimer, { passive: true });
    }
  }

  // ══════════════════════════════════════════
  // 公開 API
  // ══════════════════════════════════════════

  window.seobaikeWidget = {
    open: function () { openChat(); },
    close: function () { closeChat(false); },
    toggle: function () {
      if (state.isOpen) { closeChat(false); } else { openChat(); }
    },
    showGreeting: function (text) { showGreeting(text); },
    hideGreeting: function () { hideGreeting(); }
  };

  // ══════════════════════════════════════════
  // 初始化
  // ══════════════════════════════════════════

  function init() {
    // 防止重複初始化
    if (document.getElementById('seobaike-chat-btn')) return;

    // 追蹤造訪次數
    incrementVisitCount();

    // 注入樣式 + 建構 DOM
    injectStyles();
    createWidget();

    // 填充歡迎訊息 + 快速按鈕
    populateWelcome();

    // 啟動主動行為
    scheduleAutoGreeting();
    setupScrollWatcher();
    setupActivityListeners();
    resetInactivityTimer();

    // 記錄當前頁面（供下次回訪使用）
    saveLastPage();
  }

  // ── 自動啟動 ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
