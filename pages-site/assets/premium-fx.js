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
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.particles, .cursor-dot, .cursor-ring').forEach(function(el) {
      el.remove();
    });
    if (progressBar) progressBar.remove();
  }

})();
