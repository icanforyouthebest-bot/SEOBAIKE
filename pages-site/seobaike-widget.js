// ============================================================
// SEOBAIKE AI 客服聊天小工具 — "小百"
// 自包含嵌入式腳本，無外部依賴
// 連接 Supabase Edge Function: ai-gateway
// ============================================================

(function () {
  'use strict';

  // ── 設定 ──
  var CONFIG = {
    edgeUrl: 'https://vmyrivxxibqydccurxug.supabase.co/functions/v1/ai-gateway',
    apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZteXJpdnh4aWJxeWRjY3VyeHVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDAwMjksImV4cCI6MjA4NTYxNjAyOX0.iBV-23LGdm_uKffAExgqSV34-NWoAyv8_-M_cJQZ8Gg',
    platform: 'web-widget',
    fallbackMessage: '\u5c0f\u767e\u76ee\u524d\u5fd9\u7921\u4e2d\uff0c\u8acb\u900f\u904e /contact \u9801\u9762\u806f\u7e6b\u6211\u5011\uff0c\u6216\u7a0d\u5f8c\u518d\u8a66\u3002',
    welcomeMessage: '\u4f60\u597d\uff01\u6211\u662f\u5c0f\u767e\uff0cSEOBAIKE \u7684 AI \u52a9\u624b\u3002\u6709\u4ec0\u9ebc\u6211\u53ef\u4ee5\u5e6b\u4f60\u7684\u55ce\uff1f'
  };

  // 訪客 ID（每個 session 固定）
  var visitorId = 'visitor-' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

  var isOpen = false;
  var isSending = false;

  // ── SVG 圖示 ──
  var CHAT_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

  var CLOSE_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  var SEND_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';

  // ── 樣式注入 ──
  function injectStyles() {
    var style = document.createElement('style');
    style.id = 'seobaike-widget-styles';
    style.textContent = [
      /* ── 浮動按鈕 ── */
      '#seobaike-chat-btn {',
      '  position: fixed;',
      '  bottom: 24px;',
      '  right: 24px;',
      '  width: 60px;',
      '  height: 60px;',
      '  border-radius: 50%;',
      '  background: #e8850c;',
      '  border: none;',
      '  cursor: pointer;',
      '  box-shadow: 0 4px 16px rgba(232, 133, 12, 0.45);',
      '  z-index: 9999;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  transition: transform 0.25s ease, box-shadow 0.25s ease, opacity 0.3s ease;',
      '  padding: 0;',
      '  outline: none;',
      '}',
      '#seobaike-chat-btn:hover {',
      '  transform: scale(1.08);',
      '  box-shadow: 0 6px 24px rgba(232, 133, 12, 0.6);',
      '}',
      '#seobaike-chat-btn.sb-hidden {',
      '  transform: scale(0);',
      '  opacity: 0;',
      '  pointer-events: none;',
      '}',

      /* ── 聊天面板 ── */
      '#seobaike-chat-panel {',
      '  position: fixed;',
      '  bottom: 24px;',
      '  right: 24px;',
      '  width: 380px;',
      '  height: 520px;',
      '  background: #0a0a1a;',
      '  border-radius: 16px;',
      '  box-shadow: 0 8px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(232, 133, 12, 0.2);',
      '  z-index: 10000;',
      '  display: flex;',
      '  flex-direction: column;',
      '  overflow: hidden;',
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
      '  transform: scale(0) translateY(20px);',
      '  transform-origin: bottom right;',
      '  opacity: 0;',
      '  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;',
      '  pointer-events: none;',
      '}',
      '#seobaike-chat-panel.sb-open {',
      '  transform: scale(1) translateY(0);',
      '  opacity: 1;',
      '  pointer-events: auto;',
      '}',

      /* ── 標題列 ── */
      '.sb-header {',
      '  background: linear-gradient(135deg, #e8850c 0%, #d4700a 100%);',
      '  padding: 14px 16px;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  flex-shrink: 0;',
      '}',
      '.sb-header-info {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '}',
      '.sb-header-avatar {',
      '  width: 36px;',
      '  height: 36px;',
      '  border-radius: 50%;',
      '  background: rgba(255,255,255,0.2);',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  font-size: 18px;',
      '  color: white;',
      '  font-weight: 700;',
      '  flex-shrink: 0;',
      '}',
      '.sb-header-text h3 {',
      '  margin: 0;',
      '  font-size: 15px;',
      '  font-weight: 700;',
      '  color: white;',
      '  line-height: 1.2;',
      '}',
      '.sb-header-text span {',
      '  font-size: 11px;',
      '  color: rgba(255,255,255,0.8);',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 4px;',
      '}',
      '.sb-online-dot {',
      '  width: 6px;',
      '  height: 6px;',
      '  border-radius: 50%;',
      '  background: #4ade80;',
      '  display: inline-block;',
      '}',
      '.sb-close-btn {',
      '  background: rgba(255,255,255,0.15);',
      '  border: none;',
      '  width: 32px;',
      '  height: 32px;',
      '  border-radius: 8px;',
      '  cursor: pointer;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  transition: background 0.2s;',
      '  padding: 0;',
      '  outline: none;',
      '}',
      '.sb-close-btn:hover {',
      '  background: rgba(255,255,255,0.3);',
      '}',

      /* ── 訊息區 ── */
      '.sb-messages {',
      '  flex: 1;',
      '  overflow-y: auto;',
      '  padding: 16px;',
      '  background: #12122a;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 12px;',
      '}',
      '.sb-messages::-webkit-scrollbar {',
      '  width: 5px;',
      '}',
      '.sb-messages::-webkit-scrollbar-track {',
      '  background: transparent;',
      '}',
      '.sb-messages::-webkit-scrollbar-thumb {',
      '  background: rgba(255,255,255,0.15);',
      '  border-radius: 4px;',
      '}',
      '.sb-messages::-webkit-scrollbar-thumb:hover {',
      '  background: rgba(255,255,255,0.25);',
      '}',

      /* ── 訊息氣泡 ── */
      '.sb-msg {',
      '  display: flex;',
      '  flex-direction: column;',
      '  max-width: 82%;',
      '  animation: sb-fade-in 0.3s ease;',
      '}',
      '@keyframes sb-fade-in {',
      '  from { opacity: 0; transform: translateY(8px); }',
      '  to { opacity: 1; transform: translateY(0); }',
      '}',
      '.sb-msg-user {',
      '  align-self: flex-end;',
      '}',
      '.sb-msg-bot {',
      '  align-self: flex-start;',
      '}',
      '.sb-msg-bubble {',
      '  padding: 10px 14px;',
      '  border-radius: 14px;',
      '  font-size: 13.5px;',
      '  line-height: 1.55;',
      '  word-break: break-word;',
      '  white-space: pre-wrap;',
      '}',
      '.sb-msg-user .sb-msg-bubble {',
      '  background: #e8850c;',
      '  color: white;',
      '  border-bottom-right-radius: 4px;',
      '}',
      '.sb-msg-bot .sb-msg-bubble {',
      '  background: #1a1a3a;',
      '  color: #e0e0ef;',
      '  border-bottom-left-radius: 4px;',
      '}',
      '.sb-msg-time {',
      '  font-size: 10px;',
      '  color: rgba(255,255,255,0.3);',
      '  margin-top: 4px;',
      '  padding: 0 4px;',
      '}',
      '.sb-msg-user .sb-msg-time {',
      '  text-align: right;',
      '}',

      /* ── 打字動畫 ── */
      '.sb-typing-indicator {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 5px;',
      '  padding: 12px 16px;',
      '  background: #1a1a3a;',
      '  border-radius: 14px;',
      '  border-bottom-left-radius: 4px;',
      '  align-self: flex-start;',
      '  animation: sb-fade-in 0.3s ease;',
      '}',
      '.sb-typing-dot {',
      '  width: 7px;',
      '  height: 7px;',
      '  border-radius: 50%;',
      '  background: #e8850c;',
      '  animation: sb-typing-bounce 1.4s infinite ease-in-out;',
      '}',
      '.sb-typing-dot:nth-child(2) { animation-delay: 0.16s; }',
      '.sb-typing-dot:nth-child(3) { animation-delay: 0.32s; }',
      '@keyframes sb-typing-bounce {',
      '  0%, 80%, 100% { transform: scale(0.4); opacity: 0.4; }',
      '  40% { transform: scale(1); opacity: 1; }',
      '}',

      /* ── 輸入區 ── */
      '.sb-input-area {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '  padding: 12px 14px;',
      '  background: #0a0a1a;',
      '  border-top: 1px solid rgba(255,255,255,0.06);',
      '  flex-shrink: 0;',
      '}',
      '.sb-input-field {',
      '  flex: 1;',
      '  padding: 10px 14px;',
      '  border-radius: 12px;',
      '  border: 1px solid rgba(255,255,255,0.1);',
      '  background: #12122a;',
      '  color: #f0f0ff;',
      '  font-size: 13.5px;',
      '  outline: none;',
      '  transition: border-color 0.2s;',
      '  font-family: inherit;',
      '}',
      '.sb-input-field:focus {',
      '  border-color: #e8850c;',
      '}',
      '.sb-input-field::placeholder {',
      '  color: rgba(255,255,255,0.3);',
      '}',
      '.sb-send-btn {',
      '  width: 40px;',
      '  height: 40px;',
      '  border-radius: 12px;',
      '  border: none;',
      '  background: #e8850c;',
      '  cursor: pointer;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  transition: background 0.2s, transform 0.15s;',
      '  flex-shrink: 0;',
      '  padding: 0;',
      '  outline: none;',
      '}',
      '.sb-send-btn:hover {',
      '  background: #d4700a;',
      '  transform: scale(1.05);',
      '}',
      '.sb-send-btn:active {',
      '  transform: scale(0.95);',
      '}',
      '.sb-send-btn:disabled {',
      '  background: #5a3a10;',
      '  cursor: not-allowed;',
      '  transform: none;',
      '}',

      /* ── 底部標語 ── */
      '.sb-footer {',
      '  text-align: center;',
      '  padding: 6px;',
      '  font-size: 10px;',
      '  color: rgba(255,255,255,0.2);',
      '  background: #0a0a1a;',
      '  flex-shrink: 0;',
      '  letter-spacing: 0.3px;',
      '}',

      /* ── 手機響應式 ── */
      '@media (max-width: 480px) {',
      '  #seobaike-chat-panel {',
      '    width: 100%;',
      '    height: 100%;',
      '    bottom: 0;',
      '    right: 0;',
      '    border-radius: 0;',
      '    transform-origin: bottom center;',
      '  }',
      '  #seobaike-chat-btn {',
      '    bottom: 16px;',
      '    right: 16px;',
      '  }',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── 工具函式 ──
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getTimeString() {
    var now = new Date();
    var h = now.getHours().toString();
    var m = now.getMinutes().toString();
    if (h.length < 2) h = '0' + h;
    if (m.length < 2) m = '0' + m;
    return h + ':' + m;
  }

  // ── DOM 參照 ──
  var chatPanel, chatBtn, messagesContainer, inputField, sendBtn, typingEl;

  // ── 建立 Widget DOM ──
  function createWidget() {
    // --- 浮動按鈕 ---
    chatBtn = document.createElement('button');
    chatBtn.id = 'seobaike-chat-btn';
    chatBtn.setAttribute('aria-label', 'SEOBAIKE AI \u5ba2\u670d');
    chatBtn.innerHTML = CHAT_ICON_SVG;
    chatBtn.addEventListener('click', toggleChat);
    document.body.appendChild(chatBtn);

    // --- 聊天面板 ---
    chatPanel = document.createElement('div');
    chatPanel.id = 'seobaike-chat-panel';
    chatPanel.setAttribute('role', 'dialog');
    chatPanel.setAttribute('aria-label', 'SEOBAIKE AI \u5ba2\u670d\u5c0d\u8a71');

    // 標題列
    var header = document.createElement('div');
    header.className = 'sb-header';
    header.innerHTML = [
      '<div class="sb-header-info">',
      '  <div class="sb-header-avatar">\u5c0f</div>',
      '  <div class="sb-header-text">',
      '    <h3>SEOBAIKE \u5c0f\u767e</h3>',
      '    <span><span class="sb-online-dot"></span> AI \u5ba2\u670d\u52a9\u624b</span>',
      '  </div>',
      '</div>'
    ].join('');

    var closeBtn = document.createElement('button');
    closeBtn.className = 'sb-close-btn';
    closeBtn.setAttribute('aria-label', '\u95dc\u9589\u5c0d\u8a71');
    closeBtn.innerHTML = CLOSE_ICON_SVG;
    closeBtn.addEventListener('click', toggleChat);
    header.appendChild(closeBtn);

    // 訊息容器
    messagesContainer = document.createElement('div');
    messagesContainer.className = 'sb-messages';

    // 輸入區
    var inputArea = document.createElement('div');
    inputArea.className = 'sb-input-area';

    inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.className = 'sb-input-field';
    inputField.placeholder = '\u8f38\u5165\u8a0a\u606f...';
    inputField.setAttribute('aria-label', '\u8f38\u5165\u8a0a\u606f');
    inputField.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    sendBtn = document.createElement('button');
    sendBtn.className = 'sb-send-btn';
    sendBtn.setAttribute('aria-label', '\u50b3\u9001');
    sendBtn.innerHTML = SEND_ICON_SVG;
    sendBtn.addEventListener('click', handleSend);

    inputArea.appendChild(inputField);
    inputArea.appendChild(sendBtn);

    // 底部標語
    var footer = document.createElement('div');
    footer.className = 'sb-footer';
    footer.textContent = 'Powered by SEOBAIKE CaaS';

    // 組裝面板
    chatPanel.appendChild(header);
    chatPanel.appendChild(messagesContainer);
    chatPanel.appendChild(inputArea);
    chatPanel.appendChild(footer);
    document.body.appendChild(chatPanel);

    // 插入歡迎訊息
    appendBotMessage(CONFIG.welcomeMessage);
  }

  // ── 開關面板 ──
  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      chatPanel.classList.add('sb-open');
      chatBtn.classList.add('sb-hidden');
      // 延遲一點才 focus，讓動畫順暢
      setTimeout(function () {
        inputField.focus();
      }, 320);
    } else {
      chatPanel.classList.remove('sb-open');
      chatBtn.classList.remove('sb-hidden');
    }
  }

  // ── 新增使用者訊息 ──
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
    messagesContainer.appendChild(wrapper);
    scrollToBottom();
  }

  // ── 新增機器人訊息 ──
  function appendBotMessage(text) {
    var wrapper = document.createElement('div');
    wrapper.className = 'sb-msg sb-msg-bot';

    var bubble = document.createElement('div');
    bubble.className = 'sb-msg-bubble';
    // 保留換行但做 HTML escape
    bubble.innerHTML = escapeHtml(text);

    var time = document.createElement('div');
    time.className = 'sb-msg-time';
    time.textContent = '\u5c0f\u767e \u00b7 ' + getTimeString();

    wrapper.appendChild(bubble);
    wrapper.appendChild(time);
    messagesContainer.appendChild(wrapper);
    scrollToBottom();
  }

  // ── 打字指示器 ──
  function showTyping() {
    typingEl = document.createElement('div');
    typingEl.className = 'sb-typing-indicator';
    typingEl.innerHTML = '<span class="sb-typing-dot"></span><span class="sb-typing-dot"></span><span class="sb-typing-dot"></span>';
    messagesContainer.appendChild(typingEl);
    scrollToBottom();
  }

  function hideTyping() {
    if (typingEl && typingEl.parentNode) {
      typingEl.parentNode.removeChild(typingEl);
      typingEl = null;
    }
  }

  // ── 捲動到底部 ──
  function scrollToBottom() {
    requestAnimationFrame(function () {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
  }

  // ── 發送訊息 ──
  function handleSend() {
    if (isSending) return;

    var text = inputField.value.trim();
    if (!text) return;

    inputField.value = '';
    appendUserMessage(text);

    isSending = true;
    sendBtn.disabled = true;
    showTyping();

    callAIGateway(text)
      .then(function (reply) {
        hideTyping();
        appendBotMessage(reply);
      })
      .catch(function () {
        hideTyping();
        appendBotMessage(CONFIG.fallbackMessage);
      })
      .finally(function () {
        isSending = false;
        sendBtn.disabled = false;
        inputField.focus();
      });
  }

  // ── 呼叫 AI Gateway ──
  function callAIGateway(message) {
    return fetch(CONFIG.edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.apiKey,
        'Authorization': 'Bearer ' + CONFIG.apiKey
      },
      body: JSON.stringify({
        message: message,
        platform: CONFIG.platform,
        platform_user_id: visitorId
      })
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        // 嘗試多種回應格式
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

  // ── 初始化 ──
  function init() {
    // 防止重複初始化
    if (document.getElementById('seobaike-chat-btn')) return;
    injectStyles();
    createWidget();
  }

  // ── 公開 API ──
  window.seobaikeWidget = {
    open: function () {
      if (!isOpen) toggleChat();
    },
    close: function () {
      if (isOpen) toggleChat();
    },
    toggle: toggleChat
  };

  // ── 自動啟動 ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
