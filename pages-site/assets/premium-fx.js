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

})();
