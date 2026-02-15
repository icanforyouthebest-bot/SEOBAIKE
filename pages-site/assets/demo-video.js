/**
 * SEOBAIKE 產品展示動畫元件
 * 純 CSS/JS 模擬影片效果，60 秒看懂 SEOBAIKE
 * 小路光有限公司 — 台灣專利 TW-115100981
 *
 * 使用方式：
 *   <div id="demo-video"></div>
 *   <script src="assets/demo-video.js"></script>
 *   <script>window.SEOBAIKEDemo.init('demo-video');</script>
 */
(function () {
  'use strict';

  /* ========== 常數 ========== */
  var TOTAL_DURATION = 60000; // 60 秒
  var COLORS = {
    bg: '#1a1a2e',
    primary: '#e8850c',
    accent: '#f5a623',
    white: '#ffffff',
    darkOverlay: 'rgba(0,0,0,0.6)',
    gradientStart: '#e8850c',
    gradientEnd: '#f5a623',
  };

  /* ========== 場景定義 ========== */
  var SCENES = [
    { id: 'scene1', start: 0, end: 8000 },
    { id: 'scene2', start: 8000, end: 20000 },
    { id: 'scene3', start: 20000, end: 32000 },
    { id: 'scene4', start: 32000, end: 48000 },
    { id: 'scene5', start: 48000, end: 60000 },
  ];

  /* ========== CSS 注入 ========== */
  var CSS = /* css */ `
/* ===== 播放器容器 ===== */
.sbk-demo-player {
  position: relative;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  aspect-ratio: 16 / 9;
  background: ${COLORS.bg};
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans TC', sans-serif;
  user-select: none;
  -webkit-user-select: none;
}
.sbk-demo-player *, .sbk-demo-player *::before, .sbk-demo-player *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ===== 舞台（場景區） ===== */
.sbk-stage {
  position: absolute;
  inset: 0;
  bottom: 48px;
  overflow: hidden;
}

/* ===== 場景共用 ===== */
.sbk-scene {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.8s ease;
  padding: 5% 8%;
}
.sbk-scene.sbk-active {
  opacity: 1;
}

/* ===== 控制列 ===== */
.sbk-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 48px;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  z-index: 10;
}
.sbk-btn-play {
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
}
.sbk-btn-play svg {
  width: 20px;
  height: 20px;
  fill: ${COLORS.white};
}
.sbk-progress-wrap {
  flex: 1;
  height: 6px;
  background: rgba(255,255,255,0.15);
  border-radius: 3px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.sbk-progress-bar {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, ${COLORS.gradientStart}, ${COLORS.gradientEnd});
  border-radius: 3px;
  transition: width 0.1s linear;
}
.sbk-time {
  color: rgba(255,255,255,0.7);
  font-size: 13px;
  min-width: 80px;
  text-align: right;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* ===== Scene 1: 開場 ===== */
.sbk-s1-logo {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: ${COLORS.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: scale(0.5);
  transition: opacity 0.8s ease, transform 0.8s ease;
  box-shadow: 0 0 40px rgba(232,133,12,0.4);
}
.sbk-s1-logo.sbk-show {
  opacity: 1;
  transform: scale(1);
}
.sbk-s1-logo span {
  font-size: 52px;
  font-weight: 800;
  color: ${COLORS.white};
  line-height: 1;
}
.sbk-s1-title {
  font-size: clamp(20px, 4vw, 36px);
  color: ${COLORS.white};
  font-weight: 700;
  margin-top: 24px;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.8s ease 0.4s, transform 0.8s ease 0.4s;
}
.sbk-s1-title.sbk-show {
  opacity: 1;
  transform: translateY(0);
}
.sbk-s1-sub {
  font-size: clamp(13px, 2.5vw, 18px);
  color: ${COLORS.accent};
  margin-top: 12px;
  opacity: 0;
  transition: opacity 0.8s ease 0.8s;
}
.sbk-s1-sub.sbk-show {
  opacity: 1;
}

/* ===== Scene 2: 問題（聊天打字） ===== */
.sbk-s2-chatbox {
  width: 90%;
  max-width: 500px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 24px;
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.sbk-s2-chatbox.sbk-show {
  opacity: 1;
  transform: translateY(0);
}
.sbk-s2-label {
  font-size: clamp(11px, 1.8vw, 14px);
  color: rgba(255,255,255,0.4);
  margin-bottom: 12px;
}
.sbk-s2-input {
  font-size: clamp(15px, 2.8vw, 22px);
  color: ${COLORS.white};
  line-height: 1.5;
  min-height: 1.5em;
}
.sbk-cursor {
  display: inline-block;
  width: 2px;
  height: 1.1em;
  background: ${COLORS.accent};
  vertical-align: text-bottom;
  margin-left: 2px;
  animation: sbk-blink 0.8s step-end infinite;
}
@keyframes sbk-blink {
  50% { opacity: 0; }
}
.sbk-s2-hint {
  font-size: clamp(12px, 2vw, 16px);
  color: rgba(255,255,255,0.3);
  margin-top: 20px;
  text-align: center;
  opacity: 0;
  transition: opacity 0.6s ease;
}
.sbk-s2-hint.sbk-show {
  opacity: 1;
}

/* ===== Scene 3: 智慧路由 ===== */
.sbk-s3-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sbk-s3-center {
  width: clamp(80px, 16vw, 140px);
  height: clamp(80px, 16vw, 140px);
  border-radius: 50%;
  background: ${COLORS.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: clamp(10px, 1.8vw, 15px);
  color: ${COLORS.white};
  font-weight: 700;
  line-height: 1.3;
  z-index: 2;
  opacity: 0;
  transform: scale(0.3);
  transition: opacity 0.6s ease, transform 0.6s ease;
  box-shadow: 0 0 50px rgba(232,133,12,0.3);
  padding: 8px;
}
.sbk-s3-center.sbk-show {
  opacity: 1;
  transform: scale(1);
}
.sbk-s3-node {
  position: absolute;
  width: clamp(48px, 9vw, 80px);
  height: clamp(48px, 9vw, 80px);
  border-radius: 50%;
  background: rgba(255,255,255,0.07);
  border: 2px solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: clamp(9px, 1.5vw, 13px);
  color: rgba(255,255,255,0.5);
  font-weight: 600;
  opacity: 0;
  transform: scale(0.5);
  transition: opacity 0.4s ease, transform 0.4s ease, border-color 0.3s ease, background 0.3s ease, color 0.3s ease, box-shadow 0.3s ease;
}
.sbk-s3-node.sbk-show {
  opacity: 1;
  transform: scale(1);
}
.sbk-s3-node.sbk-highlight {
  border-color: ${COLORS.accent};
  background: rgba(232,133,12,0.15);
  color: ${COLORS.accent};
  box-shadow: 0 0 20px rgba(232,133,12,0.3);
}
.sbk-s3-line {
  position: absolute;
  height: 2px;
  background: ${COLORS.accent};
  transform-origin: left center;
  z-index: 1;
  opacity: 0;
  transition: opacity 0.4s ease;
}
.sbk-s3-line.sbk-show {
  opacity: 1;
}
.sbk-s3-scan {
  position: absolute;
  width: clamp(80px, 16vw, 140px);
  height: clamp(80px, 16vw, 140px);
  border-radius: 50%;
  border: 2px solid ${COLORS.accent};
  opacity: 0;
  z-index: 3;
  pointer-events: none;
}
.sbk-s3-scan.sbk-pulse {
  animation: sbk-scan-pulse 1.5s ease-out forwards;
}
@keyframes sbk-scan-pulse {
  0% { opacity: 0.8; transform: scale(1); }
  100% { opacity: 0; transform: scale(3.5); }
}
.sbk-s3-text {
  position: absolute;
  bottom: 8%;
  left: 0;
  right: 0;
  text-align: center;
  font-size: clamp(12px, 2.2vw, 18px);
  color: rgba(255,255,255,0.7);
  opacity: 0;
  transition: opacity 0.6s ease;
}
.sbk-s3-text.sbk-show {
  opacity: 1;
}

/* ===== Scene 4: 結果 ===== */
.sbk-s4-reply {
  width: 90%;
  max-width: 520px;
  background: rgba(232,133,12,0.08);
  border: 1px solid rgba(232,133,12,0.2);
  border-radius: 16px;
  padding: 24px;
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.sbk-s4-reply.sbk-show {
  opacity: 1;
  transform: translateY(0);
}
.sbk-s4-label {
  font-size: clamp(11px, 1.6vw, 13px);
  color: ${COLORS.accent};
  margin-bottom: 12px;
  font-weight: 600;
}
.sbk-s4-content {
  font-size: clamp(13px, 2.2vw, 17px);
  color: ${COLORS.white};
  line-height: 1.7;
  min-height: 3em;
}
.sbk-s4-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 24px;
  justify-content: center;
}
.sbk-s4-stat {
  font-size: clamp(12px, 2vw, 15px);
  color: rgba(255,255,255,0.7);
  background: rgba(255,255,255,0.05);
  padding: 6px 14px;
  border-radius: 20px;
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.sbk-s4-stat.sbk-show {
  opacity: 1;
  transform: translateY(0);
}

/* ===== Scene 5: CTA ===== */
.sbk-s5-big {
  font-size: clamp(26px, 5.5vw, 48px);
  color: ${COLORS.white};
  font-weight: 800;
  opacity: 0;
  transform: scale(0.8);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.sbk-s5-big.sbk-show {
  opacity: 1;
  transform: scale(1);
}
.sbk-s5-points {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 28px;
  align-items: center;
}
.sbk-s5-point {
  font-size: clamp(14px, 2.8vw, 22px);
  color: ${COLORS.accent};
  font-weight: 600;
  opacity: 0;
  transform: translateX(-20px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.sbk-s5-point.sbk-show {
  opacity: 1;
  transform: translateX(0);
}
.sbk-s5-cta {
  display: inline-block;
  margin-top: 28px;
  padding: 14px 40px;
  background: linear-gradient(135deg, ${COLORS.gradientStart}, ${COLORS.gradientEnd});
  color: ${COLORS.white};
  font-size: clamp(15px, 2.8vw, 20px);
  font-weight: 700;
  border-radius: 50px;
  text-decoration: none;
  cursor: pointer;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.5s ease, transform 0.5s ease, box-shadow 0.3s ease;
  box-shadow: 0 4px 20px rgba(232,133,12,0.3);
  border: none;
}
.sbk-s5-cta.sbk-show {
  opacity: 1;
  transform: translateY(0);
}
.sbk-s5-cta:hover {
  box-shadow: 0 6px 30px rgba(232,133,12,0.5);
}
.sbk-s5-footer {
  margin-top: 20px;
  font-size: clamp(10px, 1.5vw, 12px);
  color: rgba(255,255,255,0.3);
  opacity: 0;
  transition: opacity 0.5s ease;
}
.sbk-s5-footer.sbk-show {
  opacity: 1;
}

/* ===== 大播放覆蓋 ===== */
.sbk-overlay-play {
  position: absolute;
  inset: 0;
  bottom: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.4);
  z-index: 20;
  cursor: pointer;
  transition: opacity 0.3s ease;
}
.sbk-overlay-play.sbk-hidden {
  opacity: 0;
  pointer-events: none;
}
.sbk-overlay-play-btn {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(232,133,12,0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 30px rgba(232,133,12,0.4);
  transition: transform 0.2s ease;
}
.sbk-overlay-play:hover .sbk-overlay-play-btn {
  transform: scale(1.1);
}
.sbk-overlay-play-btn svg {
  width: 32px;
  height: 32px;
  fill: ${COLORS.white};
  margin-left: 4px;
}

/* ===== 響應式微調 ===== */
@media (max-width: 480px) {
  .sbk-controls { height: 40px; padding: 0 10px; gap: 8px; }
  .sbk-stage { bottom: 40px; }
  .sbk-overlay-play { bottom: 40px; }
  .sbk-btn-play svg { width: 16px; height: 16px; }
  .sbk-time { font-size: 11px; min-width: 64px; }
  .sbk-s4-stats { gap: 8px; }
  .sbk-s4-stat { font-size: 11px; padding: 4px 10px; }
}
`;

  var styleInjected = false;
  function injectStyles() {
    if (styleInjected) return;
    var style = document.createElement('style');
    style.setAttribute('data-sbk-demo', '');
    style.textContent = CSS;
    document.head.appendChild(style);
    styleInjected = true;
  }

  /* ========== SVG 圖示 ========== */
  var ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';
  var ICON_REPLAY = '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>';

  /* ========== 打字效果輔助 ========== */
  function typeText(el, text, speed, cb) {
    var i = 0;
    var cursor = el.querySelector('.sbk-cursor');
    function tick() {
      if (i < text.length) {
        if (cursor) {
          cursor.insertAdjacentText('beforebegin', text[i]);
        } else {
          el.textContent += text[i];
        }
        i++;
        setTimeout(tick, speed);
      } else {
        if (cb) cb();
      }
    }
    tick();
  }

  /* ========== 格式化時間 ========== */
  function formatTime(ms) {
    var totalSec = Math.floor(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ========== 實例建構 ========== */
  function DemoPlayer(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('[SEOBAIKEDemo] 找不到容器: #' + containerId);
      return;
    }
    this.elapsed = 0;
    this.playing = false;
    this.finished = false;
    this.lastTick = 0;
    this.rafId = null;
    this.currentScene = -1;
    this.sceneInited = {};
    this._build();
    this._bind();
    this._setupObserver();
  }

  /* ---- 建構 DOM ---- */
  DemoPlayer.prototype._build = function () {
    var p = this.container;
    p.innerHTML = '';
    p.classList.add('sbk-demo-player');

    // 舞台
    var stage = document.createElement('div');
    stage.className = 'sbk-stage';
    this.stage = stage;

    // Scene 1
    var s1 = document.createElement('div');
    s1.className = 'sbk-scene';
    s1.id = 'sbk-scene1';
    s1.innerHTML =
      '<div class="sbk-s1-logo"><span>S</span></div>' +
      '<div class="sbk-s1-title">' + escHtml('AI 就該這麼簡單') + '</div>' +
      '<div class="sbk-s1-sub">' + escHtml('60 秒看懂 SEOBAIKE') + '</div>';
    stage.appendChild(s1);

    // Scene 2
    var s2 = document.createElement('div');
    s2.className = 'sbk-scene';
    s2.id = 'sbk-scene2';
    s2.innerHTML =
      '<div class="sbk-s2-chatbox">' +
        '<div class="sbk-s2-label">' + escHtml('輸入您的需求...') + '</div>' +
        '<div class="sbk-s2-input"><span class="sbk-cursor"></span></div>' +
      '</div>' +
      '<div class="sbk-s2-hint">' + escHtml('任何人都能用自然語言指揮 AI') + '</div>';
    stage.appendChild(s2);

    // Scene 3
    var s3 = document.createElement('div');
    s3.className = 'sbk-scene';
    s3.id = 'sbk-scene3';
    var nodeLabels = ['對話', '程式碼', '搜尋', '推理', '視覺', '語音'];
    var nodesHtml = '';
    for (var ni = 0; ni < nodeLabels.length; ni++) {
      nodesHtml += '<div class="sbk-s3-node" data-idx="' + ni + '">' + escHtml(nodeLabels[ni]) + '</div>';
    }
    s3.innerHTML =
      '<div class="sbk-s3-wrap">' +
        '<div class="sbk-s3-center">' + escHtml('SEOBAIKE') + '<br>' + escHtml('智慧路由') + '</div>' +
        '<div class="sbk-s3-scan"></div>' +
        nodesHtml +
        '<svg class="sbk-s3-lines" style="position:absolute;inset:0;pointer-events:none;z-index:1;width:100%;height:100%;"></svg>' +
      '</div>' +
      '<div class="sbk-s3-text">' + escHtml('從 1,000+ 引擎中，0.3 秒選出最佳方案') + '</div>';
    stage.appendChild(s3);

    // Scene 4
    var s4 = document.createElement('div');
    s4.className = 'sbk-scene';
    s4.id = 'sbk-scene4';
    s4.innerHTML =
      '<div class="sbk-s4-reply">' +
        '<div class="sbk-s4-label">' + escHtml('SEOBAIKE 回覆') + '</div>' +
        '<div class="sbk-s4-content"><span class="sbk-cursor"></span></div>' +
      '</div>' +
      '<div class="sbk-s4-stats">' +
        '<span class="sbk-s4-stat">' + escHtml('\u26A1 0.8 秒完成') + '</span>' +
        '<span class="sbk-s4-stat">' + escHtml('\uD83D\uDD12 專利保護') + '</span>' +
        '<span class="sbk-s4-stat">' + escHtml('\uD83D\uDCB0 NT$0 起') + '</span>' +
      '</div>';
    stage.appendChild(s4);

    // Scene 5
    var s5 = document.createElement('div');
    s5.className = 'sbk-scene';
    s5.id = 'sbk-scene5';
    s5.innerHTML =
      '<div class="sbk-s5-big">' + escHtml('就這麼簡單。') + '</div>' +
      '<div class="sbk-s5-points">' +
        '<div class="sbk-s5-point">' + escHtml('不用選模型') + '</div>' +
        '<div class="sbk-s5-point">' + escHtml('不用懂技術') + '</div>' +
        '<div class="sbk-s5-point">' + escHtml('不用花大錢') + '</div>' +
      '</div>' +
      '<a class="sbk-s5-cta" href="/login.html">' + escHtml('免費體驗') + '</a>' +
      '<div class="sbk-s5-footer">' + escHtml('台灣專利 TW-115100981 \u2014 小路光有限公司') + '</div>';
    stage.appendChild(s5);

    // 大播放覆蓋
    var overlay = document.createElement('div');
    overlay.className = 'sbk-overlay-play';
    overlay.innerHTML = '<div class="sbk-overlay-play-btn">' + ICON_PLAY + '</div>';
    this.overlay = overlay;

    // 控制列
    var controls = document.createElement('div');
    controls.className = 'sbk-controls';
    controls.innerHTML =
      '<button class="sbk-btn-play" aria-label="播放">' + ICON_PLAY + '</button>' +
      '<div class="sbk-progress-wrap"><div class="sbk-progress-bar"></div></div>' +
      '<span class="sbk-time">0:00 / 1:00</span>';

    this.btnPlay = controls.querySelector('.sbk-btn-play');
    this.progressWrap = controls.querySelector('.sbk-progress-wrap');
    this.progressBar = controls.querySelector('.sbk-progress-bar');
    this.timeDisplay = controls.querySelector('.sbk-time');

    p.appendChild(stage);
    p.appendChild(overlay);
    p.appendChild(controls);

    this.scenes = {
      scene1: s1,
      scene2: s2,
      scene3: s3,
      scene4: s4,
      scene5: s5,
    };
  };

  /* ---- 事件綁定 ---- */
  DemoPlayer.prototype._bind = function () {
    var self = this;
    this.overlay.addEventListener('click', function () { self.play(); });
    this.btnPlay.addEventListener('click', function () { self.toggle(); });
    this.progressWrap.addEventListener('click', function (e) {
      var rect = self.progressWrap.getBoundingClientRect();
      var ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      self.seek(ratio * TOTAL_DURATION);
    });
  };

  /* ---- IntersectionObserver 自動播放 ---- */
  DemoPlayer.prototype._setupObserver = function () {
    if (!('IntersectionObserver' in window)) return;
    var self = this;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !self.playing && !self.finished && self.elapsed === 0) {
          self.play();
        }
      });
    }, { threshold: 0.5 });
    observer.observe(this.container);
  };

  /* ---- 播放控制 ---- */
  DemoPlayer.prototype.play = function () {
    if (this.finished) {
      this.seek(0);
      this.finished = false;
    }
    this.playing = true;
    this.lastTick = performance.now();
    this.overlay.classList.add('sbk-hidden');
    this.btnPlay.innerHTML = ICON_PAUSE;
    this.btnPlay.setAttribute('aria-label', '暫停');
    var self = this;
    function loop(now) {
      if (!self.playing) return;
      var dt = now - self.lastTick;
      self.lastTick = now;
      self.elapsed = Math.min(self.elapsed + dt, TOTAL_DURATION);
      self._update();
      if (self.elapsed >= TOTAL_DURATION) {
        self._onEnd();
        return;
      }
      self.rafId = requestAnimationFrame(loop);
    }
    this.rafId = requestAnimationFrame(loop);
  };

  DemoPlayer.prototype.pause = function () {
    this.playing = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.btnPlay.innerHTML = ICON_PLAY;
    this.btnPlay.setAttribute('aria-label', '播放');
  };

  DemoPlayer.prototype.toggle = function () {
    if (this.finished) {
      this.play();
      return;
    }
    if (this.playing) this.pause();
    else this.play();
  };

  DemoPlayer.prototype.seek = function (ms) {
    this.elapsed = Math.max(0, Math.min(TOTAL_DURATION, ms));
    this.currentScene = -1;
    this.sceneInited = {};
    // 清除打字狀態
    var s2input = this.scenes.scene2.querySelector('.sbk-s2-input');
    if (s2input) s2input.innerHTML = '<span class="sbk-cursor"></span>';
    var s4content = this.scenes.scene4.querySelector('.sbk-s4-content');
    if (s4content) s4content.innerHTML = '<span class="sbk-cursor"></span>';
    // 隱藏所有 show
    var showEls = this.stage.querySelectorAll('.sbk-show, .sbk-highlight, .sbk-pulse');
    for (var i = 0; i < showEls.length; i++) {
      showEls[i].classList.remove('sbk-show', 'sbk-highlight', 'sbk-pulse');
    }
    this._update();
  };

  DemoPlayer.prototype._onEnd = function () {
    this.playing = false;
    this.finished = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.btnPlay.innerHTML = ICON_REPLAY;
    this.btnPlay.setAttribute('aria-label', '重播');
  };

  /* ---- 主更新迴圈 ---- */
  DemoPlayer.prototype._update = function () {
    var t = this.elapsed;
    // 進度條
    this.progressBar.style.width = ((t / TOTAL_DURATION) * 100).toFixed(2) + '%';
    this.timeDisplay.textContent = formatTime(t) + ' / 1:00';

    // 判斷場景
    var sceneIdx = -1;
    for (var i = 0; i < SCENES.length; i++) {
      if (t >= SCENES[i].start && t < SCENES[i].end) {
        sceneIdx = i;
        break;
      }
    }
    if (t >= TOTAL_DURATION) sceneIdx = SCENES.length - 1;

    // 場景切換
    if (sceneIdx !== this.currentScene) {
      for (var k in this.scenes) {
        this.scenes[k].classList.remove('sbk-active');
      }
      if (sceneIdx >= 0) {
        var sceneKey = SCENES[sceneIdx].id;
        this.scenes[sceneKey].classList.add('sbk-active');
      }
      this.currentScene = sceneIdx;
    }

    // 場景內動畫
    if (sceneIdx >= 0) {
      var sn = SCENES[sceneIdx];
      var localT = t - sn.start;
      this['_scene' + (sceneIdx + 1)](localT);
    }
  };

  /* ---- Scene 1 動畫 ---- */
  DemoPlayer.prototype._scene1 = function (t) {
    var s = this.scenes.scene1;
    if (t > 200) s.querySelector('.sbk-s1-logo').classList.add('sbk-show');
    if (t > 800) s.querySelector('.sbk-s1-title').classList.add('sbk-show');
    if (t > 1600) s.querySelector('.sbk-s1-sub').classList.add('sbk-show');
  };

  /* ---- Scene 2 動畫（打字） ---- */
  DemoPlayer.prototype._scene2 = function (t) {
    var s = this.scenes.scene2;
    var chatbox = s.querySelector('.sbk-s2-chatbox');
    if (t > 300) chatbox.classList.add('sbk-show');

    if (t > 1200 && !this.sceneInited.s2type) {
      this.sceneInited.s2type = true;
      var inputEl = s.querySelector('.sbk-s2-input');
      typeText(inputEl, '幫我寫一封感謝客戶的 email', 90);
    }

    if (t > 8000) s.querySelector('.sbk-s2-hint').classList.add('sbk-show');
  };

  /* ---- Scene 3 動畫（智慧路由） ---- */
  DemoPlayer.prototype._scene3 = function (t) {
    var self = this;
    var s = this.scenes.scene3;
    var center = s.querySelector('.sbk-s3-center');
    var scan = s.querySelector('.sbk-s3-scan');
    var nodes = s.querySelectorAll('.sbk-s3-node');
    var textEl = s.querySelector('.sbk-s3-text');

    // 佈局節點（環形）
    if (!this.sceneInited.s3layout) {
      this.sceneInited.s3layout = true;
      this._layoutNodes();
    }

    if (t > 300) center.classList.add('sbk-show');

    // 節點依序出現
    for (var ni = 0; ni < nodes.length; ni++) {
      if (t > 1200 + ni * 300) nodes[ni].classList.add('sbk-show');
    }

    // 掃描脈衝
    if (t > 3500 && !this.sceneInited.s3scan) {
      this.sceneInited.s3scan = true;
      scan.classList.add('sbk-pulse');
    }

    // 「對話」節點高亮
    if (t > 5000) {
      nodes[0].classList.add('sbk-highlight');
    }

    // 連線動畫
    if (t > 5500 && !this.sceneInited.s3line) {
      this.sceneInited.s3line = true;
      this._drawLine();
    }

    if (t > 7000) textEl.classList.add('sbk-show');
  };

  /* 佈局 6 個節點（環形） */
  DemoPlayer.prototype._layoutNodes = function () {
    var wrap = this.scenes.scene3.querySelector('.sbk-s3-wrap');
    var nodes = wrap.querySelectorAll('.sbk-s3-node');
    var cx = 50; // %
    var cy = 45; // %
    var rx = 36; // % 水平半徑
    var ry = 34; // % 垂直半徑
    for (var i = 0; i < nodes.length; i++) {
      var angle = -Math.PI / 2 + (2 * Math.PI * i) / nodes.length;
      var px = cx + rx * Math.cos(angle);
      var py = cy + ry * Math.sin(angle);
      nodes[i].style.left = px + '%';
      nodes[i].style.top = py + '%';
      nodes[i].style.transform = 'translate(-50%, -50%) scale(0.5)';
    }
  };

  /* 從中心到第一個節點畫連線 */
  DemoPlayer.prototype._drawLine = function () {
    var wrap = this.scenes.scene3.querySelector('.sbk-s3-wrap');
    var svgEl = wrap.querySelector('.sbk-s3-lines');
    if (!svgEl) return;

    var center = wrap.querySelector('.sbk-s3-center');
    var node0 = wrap.querySelector('.sbk-s3-node[data-idx="0"]');
    if (!center || !node0) return;

    var wrapRect = wrap.getBoundingClientRect();
    var cRect = center.getBoundingClientRect();
    var nRect = node0.getBoundingClientRect();

    var x1 = (cRect.left + cRect.width / 2 - wrapRect.left) / wrapRect.width * 100;
    var y1 = (cRect.top + cRect.height / 2 - wrapRect.top) / wrapRect.height * 100;
    var x2 = (nRect.left + nRect.width / 2 - wrapRect.left) / wrapRect.width * 100;
    var y2 = (nRect.top + nRect.height / 2 - wrapRect.top) / wrapRect.height * 100;

    svgEl.setAttribute('viewBox', '0 0 100 100');
    svgEl.style.overflow = 'visible';

    var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x1);
    line.setAttribute('y2', y1);
    line.setAttribute('stroke', COLORS.accent);
    line.setAttribute('stroke-width', '0.5');
    line.setAttribute('stroke-linecap', 'round');
    svgEl.appendChild(line);

    // 動畫連線
    var startTime = performance.now();
    var duration = 600;
    function animate(now) {
      var progress = Math.min(1, (now - startTime) / duration);
      var eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      line.setAttribute('x2', x1 + (x2 - x1) * eased);
      line.setAttribute('y2', y1 + (y2 - y1) * eased);
      if (progress < 1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  };

  /* ---- Scene 4 動畫（打字回覆） ---- */
  DemoPlayer.prototype._scene4 = function (t) {
    var s = this.scenes.scene4;
    var reply = s.querySelector('.sbk-s4-reply');
    if (t > 300) reply.classList.add('sbk-show');

    if (t > 1200 && !this.sceneInited.s4type) {
      this.sceneInited.s4type = true;
      var content = s.querySelector('.sbk-s4-content');
      var emailText = '親愛的客戶您好，\n\n感謝您一直以來的支持與信任。有您的陪伴，是我們最大的動力。期待未來持續為您服務！\n\n祝 順心愉快';
      typeText(content, emailText, 50);
    }

    var stats = s.querySelectorAll('.sbk-s4-stat');
    if (t > 10000) stats[0].classList.add('sbk-show');
    if (t > 10600) stats[1].classList.add('sbk-show');
    if (t > 11200) stats[2].classList.add('sbk-show');
  };

  /* ---- Scene 5 動畫（CTA） ---- */
  DemoPlayer.prototype._scene5 = function (t) {
    var s = this.scenes.scene5;
    if (t > 300) s.querySelector('.sbk-s5-big').classList.add('sbk-show');

    var points = s.querySelectorAll('.sbk-s5-point');
    if (t > 1500) points[0].classList.add('sbk-show');
    if (t > 2200) points[1].classList.add('sbk-show');
    if (t > 2900) points[2].classList.add('sbk-show');

    if (t > 4500) s.querySelector('.sbk-s5-cta').classList.add('sbk-show');
    if (t > 5500) s.querySelector('.sbk-s5-footer').classList.add('sbk-show');
  };

  /* ========== 工具函數 ========== */
  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ========== 全域 API ========== */
  window.SEOBAIKEDemo = {
    init: function (containerId) {
      injectStyles();
      return new DemoPlayer(containerId);
    },
  };
})();
