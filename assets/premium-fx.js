/* ═══════════════════════════════════════════════════
   SEOBAIKE Premium Effects JS — Beyond Framer
   Custom cursor, particles, 3D tilt, scroll progress
   ═══════════════════════════════════════════════════ */
(function() {
  'use strict';

  /* ── Scroll Progress Bar ── */
  var progressBar = document.createElement('div');
  progressBar.className = 'scroll-progress';
  document.body.appendChild(progressBar);
  window.addEventListener('scroll', function() {
    var scrollTop = window.scrollY;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = pct + '%';
  }, { passive: true });

  /* ── Custom Cursor (desktop only) ── */
  var isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isMobile && window.matchMedia('(hover: hover)').matches) {
    var dot = document.createElement('div');
    dot.className = 'cursor-dot';
    var ring = document.createElement('div');
    ring.className = 'cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    var mouseX = 0, mouseY = 0;
    var ringX = 0, ringY = 0;

    document.addEventListener('mousemove', function(e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.left = mouseX + 'px';
      dot.style.top = mouseY + 'px';
    });

    /* Smooth ring follow */
    function animateRing() {
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;
      ring.style.left = ringX + 'px';
      ring.style.top = ringY + 'px';
      requestAnimationFrame(animateRing);
    }
    animateRing();

    /* Hover state on interactive elements */
    document.addEventListener('mouseover', function(e) {
      var el = e.target.closest('a, button, .card, .btn, input, select, textarea, [onclick]');
      if (el) ring.classList.add('hover');
    });
    document.addEventListener('mouseout', function(e) {
      var el = e.target.closest('a, button, .card, .btn, input, select, textarea, [onclick]');
      if (el) ring.classList.remove('hover');
    });

    /* Hide default cursor on body */
    document.body.style.cursor = 'none';
    var cursorStyle = document.createElement('style');
    cursorStyle.textContent = 'a,button,.card,.btn,input,select,textarea,[onclick]{cursor:none !important;}';
    document.head.appendChild(cursorStyle);
  }

  /* ── Floating Particles ── */
  if (!isMobile && window.innerWidth > 768) {
    var particles = document.createElement('div');
    particles.className = 'particles';
    document.body.appendChild(particles);

    for (var i = 0; i < 20; i++) {
      var p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.setProperty('--dur', (15 + Math.random() * 25) + 's');
      p.style.setProperty('--dx', (Math.random() * 100 - 50) + 'px');
      p.style.animationDelay = -(Math.random() * 20) + 's';
      p.style.width = (1 + Math.random() * 2) + 'px';
      p.style.height = p.style.width;
      particles.appendChild(p);
    }
  }

  /* ── 3D Card Tilt ── */
  var cards3d = document.querySelectorAll('.card-3d, .card');
  cards3d.forEach(function(card) {
    if (isMobile) return;
    card.addEventListener('mousemove', function(e) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var centerX = rect.width / 2;
      var centerY = rect.height / 2;
      var rotateX = ((y - centerY) / centerY) * -3;
      var rotateY = ((x - centerX) / centerX) * 3;
      card.style.transform = 'perspective(800px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) translateY(-2px)';
    });
    card.addEventListener('mouseleave', function() {
      card.style.transform = '';
    });
  });

  /* ── Nav Scroll Effect ── */
  var nav = document.querySelector('.nav');
  if (nav) {
    var lastScroll = 0;
    window.addEventListener('scroll', function() {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
  }

  /* ── Fade-Up Observer ── */
  var fadeEls = document.querySelectorAll('.fade-up');
  if (fadeEls.length > 0) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -40px 0px' });
    fadeEls.forEach(function(el) { observer.observe(el); });
  }

  /* ── Hamburger Menu Toggle ── */
  window.toggleMenu = function() {
    var hamburger = document.querySelector('.nav-hamburger');
    var overlay = document.querySelector('.mobile-overlay');
    if (hamburger) hamburger.classList.toggle('active');
    if (overlay) overlay.classList.toggle('open');
  };

  /* ── Smooth Counter Animation ── */
  var counters = document.querySelectorAll('.counter, [data-target]');
  if (counters.length > 0) {
    var counterObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && !entry.target.dataset.counted) {
          entry.target.dataset.counted = '1';
          var target = parseInt(entry.target.dataset.target || entry.target.textContent, 10);
          if (isNaN(target)) return;
          var duration = 1500;
          var start = performance.now();
          function step(ts) {
            var elapsed = ts - start;
            var progress = Math.min(elapsed / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            entry.target.textContent = Math.round(eased * target);
            if (progress < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        }
      });
    }, { threshold: 0.3 });
    counters.forEach(function(el) { counterObserver.observe(el); });
  }

  /* ── Reduced Motion Check ── */
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    document.querySelectorAll('.particles, .cursor-dot, .cursor-ring').forEach(function(el) {
      el.remove();
    });
    if (progressBar) progressBar.remove();
  }


  /* ═══════════════════════════════════════════════════════════
     VOLCANIC ERUPTION FX — 火山爆發級 JS 效果
     ═══════════════════════════════════════════════════════════ */

  /* ── Inject SVG Heat Distortion Filter ── */
  (function injectHeatFilter() {
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.style.pointerEvents = 'none';
    svg.innerHTML =
      '<defs>' +
        '<filter id="volcanic-heat">' +
          '<feTurbulence type="fractalNoise" baseFrequency="0.015 0.08" numOctaves="3" seed="2" result="noise">' +
            '<animate attributeName="seed" values="1;10;1" dur="4s" repeatCount="indefinite"/>' +
          '</feTurbulence>' +
          '<feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G"/>' +
        '</filter>' +
      '</defs>';
    document.body.appendChild(svg);
  })();

  /* ── 1. Ember Particles — 大型餘燼粒子 ── */
  if (!isMobile && window.innerWidth > 768 && !prefersReducedMotion) {
    (function createEmbers() {
      var emberContainer = document.createElement('div');
      emberContainer.className = 'ember-float';
      document.body.appendChild(emberContainer);

      var EMBER_COUNT = 15;
      var EMBER_COLORS = ['#e8850c', '#f5a623', '#ff4444', '#ffd700', '#ff6b35', '#cc4400'];

      for (var i = 0; i < EMBER_COUNT; i++) {
        var ember = document.createElement('div');
        ember.className = 'ember';
        var size = 3 + Math.random() * 5; // 3-8px
        var color = EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)];
        ember.style.width = size + 'px';
        ember.style.height = size + 'px';
        ember.style.left = (Math.random() * 100) + '%';
        ember.style.setProperty('--ember-color', color);
        ember.style.setProperty('--ember-dur', (6 + Math.random() * 10) + 's');
        ember.style.setProperty('--ember-delay', -(Math.random() * 10) + 's');
        ember.style.setProperty('--ember-rot', (180 + Math.random() * 540) + 'deg');
        ember.style.opacity = (0.6 + Math.random() * 0.4).toString();
        emberContainer.appendChild(ember);
      }
    })();
  }

  /* ── 2. Volcanic Hover Ripple — 點擊衝擊波 ── */
  if (!isMobile && window.innerWidth > 768 && !prefersReducedMotion) {
    document.addEventListener('click', function(e) {
      var ripple = document.createElement('div');
      ripple.className = 'volcanic-ripple';
      ripple.style.left = e.clientX + 'px';
      ripple.style.top = e.clientY + 'px';
      document.body.appendChild(ripple);

      // Create additional smaller spark particles on click
      for (var i = 0; i < 6; i++) {
        var spark = document.createElement('div');
        spark.className = 'counter-spark';
        spark.style.position = 'fixed';
        spark.style.left = e.clientX + 'px';
        spark.style.top = e.clientY + 'px';
        var angle = (Math.PI * 2 / 6) * i + (Math.random() * 0.5);
        var dist = 20 + Math.random() * 40;
        spark.style.setProperty('--spark-x', (Math.cos(angle) * dist) + 'px');
        spark.style.setProperty('--spark-y', (Math.sin(angle) * dist) + 'px');
        var sparkColors = ['#ffd700', '#e8850c', '#f5a623', '#ff4444'];
        spark.style.background = sparkColors[Math.floor(Math.random() * sparkColors.length)];
        document.body.appendChild(spark);
        (function(s) {
          setTimeout(function() { if (s.parentNode) s.parentNode.removeChild(s); }, 600);
        })(spark);
      }

      // Remove ripple after animation
      setTimeout(function() {
        if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
      }, 700);
    });
  }

  /* ── 3. Heat Shimmer on Hero — 首屏熱浪抖動 ── */
  if (!isMobile && window.innerWidth > 768 && !prefersReducedMotion) {
    (function heroHeatShimmer() {
      // Find hero section
      var hero = document.querySelector('.hero') || document.querySelector('.section:first-of-type') || document.querySelector('section:first-of-type');
      if (!hero) return;

      // Create a shimmer overlay using CSS animation
      var shimmer = document.createElement('div');
      shimmer.style.cssText = [
        'position: absolute',
        'bottom: 0',
        'left: 0',
        'right: 0',
        'height: 120px',
        'pointer-events: none',
        'z-index: 2',
        'background: linear-gradient(to top, rgba(232,133,12,0.06) 0%, transparent 100%)',
        'animation: heroShimmer 3s ease-in-out infinite'
      ].join(';');

      // Inject shimmer keyframes
      var shimmerStyle = document.createElement('style');
      shimmerStyle.textContent =
        '@keyframes heroShimmer {' +
          '0%, 100% { opacity: 0.3; transform: scaleY(1) translateY(0); }' +
          '25% { opacity: 0.6; transform: scaleY(1.05) translateY(-2px); }' +
          '50% { opacity: 0.4; transform: scaleY(0.98) translateY(1px); }' +
          '75% { opacity: 0.7; transform: scaleY(1.03) translateY(-1px); }' +
        '}';
      document.head.appendChild(shimmerStyle);

      // Ensure hero has relative positioning
      var heroPos = window.getComputedStyle(hero).position;
      if (heroPos === 'static') hero.style.position = 'relative';
      hero.style.overflow = 'hidden';
      hero.appendChild(shimmer);
    })();
  }

  /* ── 4. Eruption Counter — 數字變化時火花效果 ── */
  if (!isMobile && window.innerWidth > 768 && !prefersReducedMotion) {
    (function eruptionCounter() {
      // Override the counter animation with spark-enhanced version
      var eruptionCounters = document.querySelectorAll('.counter, [data-target]');
      if (eruptionCounters.length === 0) return;

      function spawnSparks(el, count) {
        var rect = el.getBoundingClientRect();
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;
        var sparkColors = ['#ffd700', '#e8850c', '#f5a623', '#ff4444', '#ff6b35'];

        for (var i = 0; i < count; i++) {
          var spark = document.createElement('div');
          spark.className = 'counter-spark';
          spark.style.position = 'fixed';
          spark.style.left = (centerX + (Math.random() - 0.5) * rect.width) + 'px';
          spark.style.top = (centerY + (Math.random() - 0.5) * rect.height) + 'px';
          var angle = Math.random() * Math.PI * 2;
          var dist = 15 + Math.random() * 35;
          spark.style.setProperty('--spark-x', (Math.cos(angle) * dist) + 'px');
          spark.style.setProperty('--spark-y', (Math.sin(angle) * dist - 20) + 'px');
          spark.style.background = sparkColors[Math.floor(Math.random() * sparkColors.length)];
          var sparkSize = 2 + Math.random() * 4;
          spark.style.width = sparkSize + 'px';
          spark.style.height = sparkSize + 'px';
          document.body.appendChild(spark);
          (function(s) {
            setTimeout(function() { if (s.parentNode) s.parentNode.removeChild(s); }, 600);
          })(spark);
        }
      }

      var eruptCounterObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting && !entry.target.dataset.eruptCounted) {
            entry.target.dataset.eruptCounted = '1';
            var target = parseInt(entry.target.dataset.target || entry.target.textContent, 10);
            if (isNaN(target)) return;

            var duration = 1800;
            var start = performance.now();
            var lastSparkTime = 0;
            var el = entry.target;

            // Add glow class during counting
            el.classList.add('counter-glow');

            function step(ts) {
              var elapsed = ts - start;
              var progress = Math.min(elapsed / duration, 1);
              var eased = 1 - Math.pow(1 - progress, 3);
              var currentVal = Math.round(eased * target);
              el.textContent = currentVal;

              // Spawn sparks periodically during counting
              if (ts - lastSparkTime > 120 && progress < 0.95) {
                spawnSparks(el, 2);
                lastSparkTime = ts;
              }

              // Final burst at completion
              if (progress >= 1) {
                spawnSparks(el, 8);
                return;
              }
              requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
          }
        });
      }, { threshold: 0.3 });

      eruptionCounters.forEach(function(el) {
        // Only observe if not already counted by original counter
        if (!el.dataset.counted) {
          eruptCounterObserver.observe(el);
        }
      });
    })();
  }


  /* ═══════════════════════════════════════════════════════════
     PAGE TRANSITION FX — 頁面過場效果 JS（超越 Framer）
     ═══════════════════════════════════════════════════════════ */

  /* ── 1. Page Loader — 頁面載入動畫 ── */
  if (!isMobile && window.innerWidth > 768 && !prefersReducedMotion) {
    (function pageLoader() {
      var loader = document.createElement('div');
      loader.className = 'page-loader';

      var logo = document.createElement('div');
      logo.className = 'page-loader__logo';
      logo.textContent = 'SEOBAIKE';

      var barTrack = document.createElement('div');
      barTrack.className = 'page-loader__bar-track';

      var barFill = document.createElement('div');
      barFill.className = 'page-loader__bar-fill';

      barTrack.appendChild(barFill);
      loader.appendChild(logo);
      loader.appendChild(barTrack);

      // 在 body 最前面插入，確保覆蓋一切
      document.body.insertBefore(loader, document.body.firstChild);

      function dismissLoader() {
        setTimeout(function() {
          loader.classList.add('fade-out');
          // 動畫結束後移除 DOM
          setTimeout(function() {
            if (loader.parentNode) loader.parentNode.removeChild(loader);
          }, 450);
        }, 300);
      }

      // 頁面完全載入後觸發
      if (document.readyState === 'complete') {
        dismissLoader();
      } else {
        window.addEventListener('load', dismissLoader);
      }
    })();
  }

  /* ── 2. Smooth Page Transitions — 頁面間平滑過渡 ── */
  if (!isMobile && window.innerWidth > 768 && !prefersReducedMotion) {
    (function smoothPageTransitions() {
      // 建立過場覆蓋層
      var transition = document.createElement('div');
      transition.className = 'page-transition';
      document.body.appendChild(transition);

      // 判斷是否為內部連結
      function isInternalLink(href) {
        if (!href) return false;
        // 排除 # 錨點、javascript:、mailto:、tel:
        if (href.startsWith('#') || href.startsWith('javascript:') ||
            href.startsWith('mailto:') || href.startsWith('tel:')) return false;
        // 排除新分頁目標
        try {
          var url = new URL(href, window.location.origin);
          return url.origin === window.location.origin;
        } catch (e) {
          // 相對路徑算內部連結
          return href.startsWith('/') || href.startsWith('./') || href.startsWith('../');
        }
      }

      document.addEventListener('click', function(e) {
        var link = e.target.closest('a');
        if (!link) return;

        var href = link.getAttribute('href');
        if (!isInternalLink(href)) return;

        // 排除帶有 target="_blank" 的連結
        if (link.getAttribute('target') === '_blank') return;

        // 排除帶有 download 屬性的連結
        if (link.hasAttribute('download')) return;

        e.preventDefault();

        // 播放滑入動畫
        transition.classList.remove('slide-out');
        transition.classList.add('slide-in');

        // 動畫完成後跳轉
        setTimeout(function() {
          window.location.href = href;
        }, 450);
      });

      // 頁面回來時（瀏覽器回上頁）播放滑出動畫
      window.addEventListener('pageshow', function(e) {
        if (e.persisted) {
          transition.classList.remove('slide-in');
          transition.classList.add('slide-out');
          setTimeout(function() {
            transition.classList.remove('slide-out');
          }, 450);
        }
      });
    })();
  }

  /* ── 3. Parallax Scroll — 視差滾動效果 ── */
  if (!isMobile && window.innerWidth > 768 && !prefersReducedMotion) {
    (function parallaxScroll() {
      var parallaxSections = document.querySelectorAll('.parallax-section');
      if (parallaxSections.length === 0) return;

      var ticking = false;

      function updateParallax() {
        var scrollY = window.scrollY;

        parallaxSections.forEach(function(section) {
          var rect = section.getBoundingClientRect();
          var speed = parseFloat(section.dataset.parallaxSpeed) || 0.3;

          // 只在視窗可見時計算
          if (rect.bottom < 0 || rect.top > window.innerHeight) return;

          var sectionTop = rect.top + scrollY;
          var offset = (scrollY - sectionTop) * speed;

          // 找到 inner 元素或直接套用到 section
          var inner = section.querySelector('.parallax-section__inner');
          if (inner) {
            inner.style.transform = 'translateY(' + offset + 'px)';
          } else {
            section.style.backgroundPositionY = (offset * 0.5) + 'px';
          }
        });

        ticking = false;
      }

      window.addEventListener('scroll', function() {
        if (!ticking) {
          requestAnimationFrame(updateParallax);
          ticking = true;
        }
      }, { passive: true });

      // 初始執行一次
      updateParallax();
    })();
  }

  /* ── 4. Text Reveal on Scroll — 文字滾動顯現 ── */
  if (!isMobile && window.innerWidth > 768 && !prefersReducedMotion) {
    (function textRevealOnScroll() {
      var textRevealEls = document.querySelectorAll('.text-reveal');
      if (textRevealEls.length === 0) return;

      var revealObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            // 加入 delay 讓多個元素錯開
            var delay = parseInt(entry.target.dataset.revealDelay, 10) || 0;
            setTimeout(function() {
              entry.target.classList.add('revealed');
            }, delay);
            // 顯現後停止觀察
            revealObserver.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.15,
        rootMargin: '0px 0px -60px 0px'
      });

      textRevealEls.forEach(function(el) {
        revealObserver.observe(el);
      });
    })();
  }

  /* ── 5. Morph Background — 流體背景 ── */
  if (!isMobile && window.innerWidth > 768 && !prefersReducedMotion) {
    (function morphBackground() {
      var morphContainers = document.querySelectorAll('.morph-bg');
      if (morphContainers.length === 0) return;

      morphContainers.forEach(function(container) {
        // 檢查是否已有 blob（避免重複建立）
        if (container.querySelector('.morph-bg__blob')) return;

        // 建立 3 個模糊圓球
        for (var i = 1; i <= 3; i++) {
          var blob = document.createElement('div');
          blob.className = 'morph-bg__blob morph-bg__blob--' + i;
          container.insertBefore(blob, container.firstChild);
        }
      });
    })();
  }

  /* ── 6. Deep 3D Card with Reflection — 加強版 3D 卡片 ── */
  if (!isMobile && window.innerWidth > 768 && !prefersReducedMotion) {
    (function deep3DCards() {
      var deepCards = document.querySelectorAll('.hover-3d-deep');
      if (deepCards.length === 0) return;

      deepCards.forEach(function(card) {
        // 建立反光層（跟隨滑鼠的高光）
        var reflection = document.createElement('div');
        reflection.style.cssText = [
          'position: absolute',
          'inset: 0',
          'border-radius: inherit',
          'pointer-events: none',
          'z-index: 3',
          'opacity: 0',
          'transition: opacity 0.3s ease',
          'background: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.12) 0%, transparent 60%)'
        ].join(';');
        card.appendChild(reflection);

        card.addEventListener('mousemove', function(e) {
          var rect = card.getBoundingClientRect();
          var x = e.clientX - rect.left;
          var y = e.clientY - rect.top;
          var centerX = rect.width / 2;
          var centerY = rect.height / 2;

          // 旋轉角度（比 card-3d 更大：±8deg）
          var rotateX = ((y - centerY) / centerY) * -8;
          var rotateY = ((x - centerX) / centerX) * 8;

          // 動態陰影方向
          var shadowX = ((x - centerX) / centerX) * -15;
          var shadowY = ((y - centerY) / centerY) * -15;

          card.style.transform = 'perspective(600px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) translateZ(10px)';
          card.style.boxShadow =
            shadowX + 'px ' + (shadowY + 25) + 'px 80px rgba(0,0,0,0.5), ' +
            '0 0 50px rgba(232,133,12,0.08), ' +
            shadowX * 0.3 + 'px ' + shadowY * 0.3 + 'px 30px rgba(232,133,12,0.05)';

          // 反光高光跟隨滑鼠
          var pctX = (x / rect.width) * 100;
          var pctY = (y / rect.height) * 100;
          reflection.style.background = 'radial-gradient(circle at ' + pctX + '% ' + pctY + '%, rgba(255,255,255,0.15) 0%, transparent 55%)';
          reflection.style.opacity = '1';
        });

        card.addEventListener('mouseleave', function() {
          card.style.transform = '';
          card.style.boxShadow = '';
          reflection.style.opacity = '0';
        });
      });
    })();
  }

})();
