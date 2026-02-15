// ============================================================
// SEOBAIKE AI Widget — 嵌入式 AI 助手 + 生態系統導航
// 注入到 Framer 主站，連結所有後端 AI 服務
// ============================================================

(function() {
  'use strict';

  const SUPABASE_EDGE = 'https://vmyrivxxibqydccurxug.supabase.co/functions/v1';
  const PARTNERS = [
    { id: 'openai', name: 'OpenAI', icon: '🤖' },
    { id: 'anthropic', name: 'Claude', icon: '🧠' },
    { id: 'deepseek', name: 'DeepSeek', icon: '🔍' },
    { id: 'grok', name: 'Grok', icon: '⚡' },
    { id: 'google', name: 'Gemma', icon: '🌐' },
    { id: 'perplexity', name: 'Perplexity', icon: '🔎' },
    { id: 'groq', name: 'Groq', icon: '💨' },
    { id: 'mistral', name: 'Mistral', icon: '🌊' },
    { id: 'cohere', name: 'Cohere', icon: '🔗' },
    { id: 'qwen', name: 'Qwen', icon: '🐉' },
  ];

  let currentPartner = PARTNERS[0];
  let chatHistory = [];
  let isOpen = false;
  let isMinimized = false;

  // ── 樣式注入 ──
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #seobaike-widget-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #f97316, #a855f7);
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(249,115,22,0.4);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        transition: transform 0.3s, box-shadow 0.3s;
        animation: seobaike-pulse 2s infinite;
      }
      #seobaike-widget-fab:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 28px rgba(249,115,22,0.6);
      }
      @keyframes seobaike-pulse {
        0%, 100% { box-shadow: 0 4px 20px rgba(249,115,22,0.4); }
        50% { box-shadow: 0 4px 30px rgba(168,85,247,0.6); }
      }

      #seobaike-widget-panel {
        position: fixed;
        bottom: 96px;
        right: 24px;
        width: 380px;
        max-height: 560px;
        background: #1a1a2e;
        border-radius: 16px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.5);
        z-index: 99998;
        display: none;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid rgba(249,115,22,0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      #seobaike-widget-panel.open { display: flex; }

      .sw-header {
        background: linear-gradient(135deg, #f97316, #a855f7);
        padding: 14px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: white;
      }
      .sw-header-title {
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .sw-header-sub {
        font-size: 11px;
        opacity: 0.85;
      }
      .sw-header-actions { display: flex; gap: 8px; }
      .sw-header-actions button {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .sw-header-actions button:hover { background: rgba(255,255,255,0.35); }

      .sw-nav {
        display: flex;
        gap: 4px;
        padding: 8px 12px;
        background: #16162a;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        flex-wrap: wrap;
      }
      .sw-nav a {
        padding: 5px 10px;
        border-radius: 8px;
        font-size: 12px;
        color: #aaa;
        text-decoration: none;
        background: rgba(255,255,255,0.05);
        transition: all 0.2s;
        white-space: nowrap;
      }
      .sw-nav a:hover, .sw-nav a.active {
        background: rgba(249,115,22,0.2);
        color: #f97316;
      }

      .sw-partner-select {
        display: flex;
        gap: 4px;
        padding: 8px 12px;
        background: #16162a;
        overflow-x: auto;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .sw-partner-select::-webkit-scrollbar { height: 3px; }
      .sw-partner-select::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
      .sw-partner-btn {
        padding: 4px 8px;
        border-radius: 6px;
        border: 1px solid transparent;
        background: rgba(255,255,255,0.05);
        color: #ccc;
        font-size: 11px;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.2s;
      }
      .sw-partner-btn:hover { border-color: #f97316; color: #f97316; }
      .sw-partner-btn.active {
        background: rgba(249,115,22,0.15);
        border-color: #f97316;
        color: #f97316;
      }

      .sw-messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        min-height: 200px;
        max-height: 320px;
      }
      .sw-messages::-webkit-scrollbar { width: 4px; }
      .sw-messages::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }

      .sw-msg {
        margin-bottom: 10px;
        display: flex;
        flex-direction: column;
      }
      .sw-msg.user { align-items: flex-end; }
      .sw-msg.ai { align-items: flex-start; }
      .sw-msg-bubble {
        max-width: 85%;
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 13px;
        line-height: 1.5;
        word-break: break-word;
      }
      .sw-msg.user .sw-msg-bubble {
        background: linear-gradient(135deg, #f97316, #ea580c);
        color: white;
        border-bottom-right-radius: 4px;
      }
      .sw-msg.ai .sw-msg-bubble {
        background: rgba(255,255,255,0.08);
        color: #e0e0e0;
        border-bottom-left-radius: 4px;
      }
      .sw-msg-meta {
        font-size: 10px;
        color: #666;
        margin-top: 3px;
        padding: 0 4px;
      }

      .sw-input-area {
        display: flex;
        gap: 8px;
        padding: 12px;
        background: #16162a;
        border-top: 1px solid rgba(255,255,255,0.06);
      }
      .sw-input-area input {
        flex: 1;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.05);
        color: white;
        font-size: 13px;
        outline: none;
        transition: border-color 0.2s;
      }
      .sw-input-area input:focus { border-color: #f97316; }
      .sw-input-area input::placeholder { color: #666; }
      .sw-input-area button {
        padding: 10px 16px;
        border-radius: 10px;
        border: none;
        background: linear-gradient(135deg, #f97316, #a855f7);
        color: white;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      .sw-input-area button:hover { opacity: 0.9; }
      .sw-input-area button:disabled { opacity: 0.5; cursor: not-allowed; }

      .sw-typing {
        display: flex;
        gap: 4px;
        padding: 8px 14px;
      }
      .sw-typing span {
        width: 6px; height: 6px;
        border-radius: 50%;
        background: #f97316;
        animation: sw-bounce 1.2s infinite;
      }
      .sw-typing span:nth-child(2) { animation-delay: 0.2s; }
      .sw-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes sw-bounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
      }

      .sw-welcome {
        text-align: center;
        padding: 30px 20px;
        color: #888;
      }
      .sw-welcome h3 {
        color: #f97316;
        font-size: 16px;
        margin-bottom: 8px;
      }
      .sw-welcome p { font-size: 13px; line-height: 1.6; }

      @media (max-width: 480px) {
        #seobaike-widget-panel {
          width: calc(100vw - 24px);
          right: 12px;
          bottom: 84px;
          max-height: calc(100vh - 120px);
        }
        #seobaike-widget-fab {
          bottom: 16px;
          right: 16px;
          width: 52px;
          height: 52px;
          font-size: 24px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ── 建立 DOM ──
  function createWidget() {
    // FAB 按鈕
    const fab = document.createElement('button');
    fab.id = 'seobaike-widget-fab';
    fab.innerHTML = '&#x5C0F;';  // 小
    fab.title = 'SEOBAIKE AI 助手';
    fab.onclick = togglePanel;
    document.body.appendChild(fab);

    // 面板
    const panel = document.createElement('div');
    panel.id = 'seobaike-widget-panel';
    panel.innerHTML = `
      <div class="sw-header">
        <div>
          <div class="sw-header-title">SEOBAIKE AI</div>
          <div class="sw-header-sub">AI 驅動的智能助手</div>
        </div>
        <div class="sw-header-actions">
          <button onclick="window.seobaike.openEcosystem()" title="生態系統">&#x2699;</button>
          <button onclick="window.seobaike.clearChat()" title="清除對話">&#x1F5D1;</button>
          <button onclick="window.seobaike.toggle()" title="關閉">&#x2715;</button>
        </div>
      </div>
      <div class="sw-nav">
        <a href="/" class="active">首頁</a>
        <a href="/ecosystem.html">生態系統</a>
        <a href="/dashboard.html">儀表板</a>
      </div>
      <div class="sw-partner-select" id="sw-partner-list"></div>
      <div class="sw-messages" id="sw-messages">
        <div class="sw-welcome">
          <h3>歡迎使用 SEOBAIKE AI</h3>
          <p>選擇 AI 夥伴，開始對話<br/>支援 10+ AI 引擎即時切換</p>
        </div>
      </div>
      <div class="sw-input-area">
        <input type="text" id="sw-input" placeholder="輸入訊息..." />
        <button id="sw-send" onclick="window.seobaike.send()">發送</button>
      </div>
    `;
    document.body.appendChild(panel);

    // 建立 Partner 按鈕
    const partnerList = document.getElementById('sw-partner-list');
    PARTNERS.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'sw-partner-btn' + (p.id === currentPartner.id ? ' active' : '');
      btn.textContent = `${p.icon} ${p.name}`;
      btn.dataset.id = p.id;
      btn.onclick = () => selectPartner(p, btn);
      partnerList.appendChild(btn);
    });

    // Enter 鍵發送
    document.getElementById('sw-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        window.seobaike.send();
      }
    });
  }

  function togglePanel() {
    isOpen = !isOpen;
    const panel = document.getElementById('seobaike-widget-panel');
    if (isOpen) {
      panel.classList.add('open');
      document.getElementById('sw-input').focus();
    } else {
      panel.classList.remove('open');
    }
  }

  function selectPartner(partner, btn) {
    currentPartner = partner;
    document.querySelectorAll('.sw-partner-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    addSystemMessage(`已切換至 ${partner.icon} ${partner.name}`);
  }

  function addMessage(text, role, partnerName) {
    const messagesEl = document.getElementById('sw-messages');
    // 移除歡迎畫面
    const welcome = messagesEl.querySelector('.sw-welcome');
    if (welcome) welcome.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = `sw-msg ${role}`;

    const now = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    msgDiv.innerHTML = `
      <div class="sw-msg-bubble">${escapeHtml(text)}</div>
      <div class="sw-msg-meta">${role === 'ai' ? partnerName + ' · ' : ''}${now}</div>
    `;
    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msgDiv;
  }

  function addSystemMessage(text) {
    const messagesEl = document.getElementById('sw-messages');
    const div = document.createElement('div');
    div.style.cssText = 'text-align:center;padding:6px;font-size:11px;color:#666;';
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const messagesEl = document.getElementById('sw-messages');
    const typing = document.createElement('div');
    typing.id = 'sw-typing';
    typing.className = 'sw-msg ai';
    typing.innerHTML = `<div class="sw-typing"><span></span><span></span><span></span></div>`;
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeTyping() {
    const el = document.getElementById('sw-typing');
    if (el) el.remove();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async function sendMessage() {
    const input = document.getElementById('sw-input');
    const sendBtn = document.getElementById('sw-send');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    sendBtn.disabled = true;
    addMessage(text, 'user');
    showTyping();

    try {
      const res = await fetch(`${SUPABASE_EDGE}/partner-${currentPartner.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      removeTyping();

      if (!res.ok) {
        const errText = await res.text();
        addMessage(`錯誤 (${res.status}): ${errText.substring(0, 100)}`, 'ai', currentPartner.name);
      } else {
        const data = await res.json();
        const reply = data.reply || data.message || data.choices?.[0]?.message?.content || JSON.stringify(data);
        addMessage(reply, 'ai', `${currentPartner.icon} ${currentPartner.name}`);
      }
    } catch (err) {
      removeTyping();
      addMessage(`連線失敗: ${err.message}`, 'ai', 'System');
    }

    sendBtn.disabled = false;
    input.focus();
  }

  // ── 公開 API ──
  window.seobaike = {
    toggle: togglePanel,
    send: sendMessage,
    clearChat: function() {
      const messagesEl = document.getElementById('sw-messages');
      messagesEl.innerHTML = `
        <div class="sw-welcome">
          <h3>歡迎使用 SEOBAIKE AI</h3>
          <p>選擇 AI 夥伴，開始對話<br/>支援 10+ AI 引擎即時切換</p>
        </div>
      `;
      chatHistory = [];
    },
    openEcosystem: function() {
      window.open('/ecosystem.html', '_blank');
    },
    selectPartner: function(id) {
      const p = PARTNERS.find(x => x.id === id);
      if (p) {
        const btn = document.querySelector(`.sw-partner-btn[data-id="${id}"]`);
        if (btn) selectPartner(p, btn);
      }
    }
  };

  // ── 初始化 ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    injectStyles();
    createWidget();
  }
})();
