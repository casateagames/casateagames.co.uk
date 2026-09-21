// ===================================================
// CASA TEA GAMES - SITE-WIDE JAVASCRIPT
// Loaded on every page. Everything here is safe to run on pages that
// don't have the element it touches (the legal pages have no contact
// modal, only the home page has progress dots, and so on).
// ===================================================
(function () {
  'use strict';

  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  // ---------- Footer year ----------
  Array.prototype.forEach.call(document.querySelectorAll('[data-year]'), function (el) {
    el.textContent = new Date().getFullYear();
  });

  // ---------- Mobile menu ----------
  var navLinks = document.getElementById('navLinks');
  var menuBtn = document.querySelector('.mobile-menu-btn');

  function setMenu(open) {
    if (!navLinks) return;
    navLinks.classList.toggle('open', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function toggleMenu() {
    setMenu(!(navLinks && navLinks.classList.contains('open')));
  }

  // ---------- Posting a Netlify form ----------
  // Rejects on a network error AND on a non-2xx response, so callers never
  // show "sent" when the server said no.
  function submitNetlifyForm(form) {
    return fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(new FormData(form)).toString(),
    }).then(function (res) {
      if (!res.ok) throw new Error('Status ' + res.status);
      return res;
    });
  }

  // ---------- Contact modal ----------
  var contactModal = document.getElementById('contactModal');
  var lastFocused = null;
  var FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function modalIsOpen() {
    return !!contactModal && contactModal.classList.contains('active');
  }

  function openContactModal(e) {
    if (!contactModal) return; // no modal on this page: let the mailto: link work
    if (e) e.preventDefault();
    lastFocused = document.activeElement;
    contactModal.classList.add('active');
    document.body.style.overflow = 'hidden'; // stop the page scrolling behind it
    // Browsers refuse to focus something inside a modal that only just became
    // visible, so wait a beat.
    var first = document.getElementById('contact-name');
    if (first) setTimeout(function () { if (modalIsOpen()) first.focus(); }, 50);
  }

  function closeContactModal() {
    if (!contactModal) return;
    var wasOpen = modalIsOpen();
    contactModal.classList.remove('active');
    document.body.style.overflow = '';
    if (!wasOpen) return;

    if (lastFocused && lastFocused.focus) lastFocused.focus();

    // Reset the form once the fade-out has finished
    setTimeout(function () {
      var form = contactModal.querySelector('.contact-form');
      var success = document.getElementById('contactSuccess');
      var error = form && form.querySelector('.form-error');
      if (form) {
        form.reset();
        form.style.display = 'block';
      }
      if (success) success.style.display = 'none';
      if (error) error.textContent = '';
    }, 300);
  }

  function handleContactSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var error = form.querySelector('.form-error');
    var button = form.querySelector('button[type="submit"]');
    var success = document.getElementById('contactSuccess');

    if (error) error.textContent = '';
    if (button) button.disabled = true;

    submitNetlifyForm(form)
      .then(function () {
        form.style.display = 'none';
        if (success) {
          success.style.display = 'block';
          var successHeading = success.querySelector('h3');
          var closeBtn = success.querySelector('button');
          if (successHeading) {
            successHeading.setAttribute('tabindex', '-1');
            successHeading.focus();
          } else if (closeBtn) {
            closeBtn.focus();
          }
        }
      })
      .catch(function () {
        if (error) {
          error.textContent =
            "That didn't send. Try again, or email us at casateagames@gmail.com.";
        }
      })
      .then(function () {
        if (button) button.disabled = false;
      });
  }

  // Keep Tab inside the open modal
  function trapTab(e) {
    var nodes = Array.prototype.filter.call(
      contactModal.querySelectorAll(FOCUSABLE),
      function (n) { return n.offsetParent !== null; }
    );
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (modalIsOpen()) {
        closeContactModal();
      } else if (navLinks && navLinks.classList.contains('open')) {
        setMenu(false);
        if (menuBtn) menuBtn.focus();
      }
    } else if (e.key === 'Tab' && modalIsOpen()) {
      trapTab(e);
    }
  });

  // ---------- FAQ ----------
  function toggleFAQ(button) {
    var open = button.parentElement.classList.toggle('open');
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  // Tie each FAQ button to the answer it opens
  Array.prototype.forEach.call(document.querySelectorAll('.faq-question'), function (btn, i) {
    var answer = btn.nextElementSibling;
    if (!answer) return;
    if (!answer.id) answer.id = 'faq-answer-' + (i + 1);
    btn.setAttribute('aria-controls', answer.id);
  });

  // ---------- Smooth scroll for in-page links ----------
  Array.prototype.forEach.call(document.querySelectorAll('a[href^="#"]'), function (anchor) {
    if (anchor.classList.contains('skip-link')) return; // native jump keeps keyboard focus right

    anchor.addEventListener('click', function (e) {
      var hash = this.getAttribute('href');
      if (!hash || hash.length < 2) return; // a bare "#" is left alone

      var target = null;
      try {
        target = document.querySelector(hash);
      } catch (err) {
        return;
      }
      if (!target) return; // e.g. #contact, which has its own handler

      e.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      if (window.history && history.replaceState) history.replaceState(null, '', hash);
      setMenu(false);
    });
  });

  // ---------- Section reveal on scroll ----------
  var animated = Array.prototype.slice.call(document.querySelectorAll('.section-animate'));
  if (animated.length) {
    if (hasIO) {
      var revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              revealObserver.unobserve(entry.target);
            }
          });
        },
        // threshold 0 on purpose: a section taller than ~6.7 screens can never be
        // 15% visible (high zoom, landscape phones), and would stay hidden.
        { threshold: 0, rootMargin: '0px 0px -50px 0px' }
      );
      animated.forEach(function (s) { revealObserver.observe(s); });
    } else {
      animated.forEach(function (s) { s.classList.add('visible'); });
    }
  }

  // ---------- Progress dots (home page) ----------
  var dots = Array.prototype.slice.call(document.querySelectorAll('.progress-dot'));
  if (dots.length) {
    var dotFor = {};
    dots.forEach(function (dot) {
      var id = dot.getAttribute('data-section');
      var section = document.getElementById(id);
      if (!section) return;
      dotFor[id] = dot;
      dot.addEventListener('click', function () {
        section.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });

    if (hasIO) {
      // A zero-height band across the middle of the screen: whichever section
      // is touching it is the current one.
      var dotObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            dots.forEach(function (d) { d.classList.remove('active'); });
            var dot = dotFor[entry.target.id];
            if (dot) dot.classList.add('active');
          });
        },
        { rootMargin: '-50% 0px -50% 0px' }
      );
      Object.keys(dotFor).forEach(function (id) {
        dotObserver.observe(document.getElementById(id));
      });
    }
  }

  // ---------- Animated stats counter (home page hero) ----------
  function animateValue(el, end, suffix, duration) {
    var startTime = null;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      el.textContent = Math.floor(progress * end) + suffix;
      if (progress < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  var quickStats = document.querySelector('.quick-stats');
  if (quickStats && hasIO && !reduceMotion) {
    var statsObserver = new IntersectionObserver(
      function (entries) {
        if (!entries.some(function (e) { return e.isIntersecting; })) return;
        Array.prototype.forEach.call(quickStats.querySelectorAll('.stat-number'), function (num) {
          var target = parseInt(num.getAttribute('data-target'), 10);
          if (target) animateValue(num, target, num.getAttribute('data-suffix') || '', 1500);
        });
        statsObserver.disconnect();
      },
      { threshold: 0.5 }
    );
    statsObserver.observe(quickStats);
  }

  // ---------- Scroll progress bar ----------
  var scrollTicking = false;
  function updateScrollProgress() {
    scrollTicking = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    document.body.style.setProperty('--scroll', progress);
  }
  window.addEventListener(
    'scroll',
    function () {
      if (!scrollTicking) {
        scrollTicking = true;
        window.requestAnimationFrame(updateScrollProgress);
      }
    },
    { passive: true }
  );

  // ---------- Testimonials: hide the swipe hint after the first swipe ----------
  var testimonialGrid = document.getElementById('testimonialGrid');
  if (testimonialGrid) {
    var hasSwiped = false;
    testimonialGrid.addEventListener(
      'scroll',
      function () {
        if (hasSwiped || testimonialGrid.scrollLeft <= 50) return;
        var indicator = document.querySelector('.swipe-indicator');
        if (indicator) {
          indicator.style.opacity = '0';
          hasSwiped = true;
        }
      },
      { passive: true }
    );
  }

  // ---------- Timeline: drag to scroll with a mouse, and say so ----------
  var timelineWrap = document.querySelector('.timeline-wrap');
  if (timelineWrap) {
    var mouseLike =
      window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var hint = document.getElementById('timelineHint');
    if (hint && mouseLike) hint.textContent = 'Drag or scroll sideways to see more';

    var dragging = false;
    var startX = 0;
    var startLeft = 0;

    timelineWrap.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startLeft = timelineWrap.scrollLeft;
      timelineWrap.classList.add('is-dragging');
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      timelineWrap.scrollLeft = startLeft - (e.clientX - startX);
    });
    function stopDragging() {
      dragging = false;
      timelineWrap.classList.remove('is-dragging');
    }
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
  }

  // ---------- Newsletter signup (home page) ----------
  var newsletter = document.getElementById('newsletterForm');
  if (newsletter) {
    newsletter.addEventListener('submit', function (e) {
      e.preventDefault();
      var error = newsletter.querySelector('.form-error');
      var button = newsletter.querySelector('button[type="submit"]');
      var success = document.getElementById('newsletterSuccess');

      if (error) error.textContent = '';
      if (button) button.disabled = true;

      submitNetlifyForm(newsletter)
        .then(function () {
          newsletter.hidden = true;
          if (success) success.hidden = false;
        })
        .catch(function () {
          if (error) {
            error.textContent =
              "That didn't send. Try again, or email us at casateagames@gmail.com.";
          }
        })
        .then(function () {
          if (button) button.disabled = false;
        });
    });
  }

  // ---------- Things the pages call from inline handlers, and saywhatnow.js reuses ----------
  window.toggleMenu = toggleMenu;
  window.toggleFAQ = toggleFAQ;
  window.openContactModal = openContactModal;
  window.closeContactModal = closeContactModal;
  window.handleContactSubmit = handleContactSubmit;
  window.submitNetlifyForm = submitNetlifyForm;
})();
