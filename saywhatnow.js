// ===================================================
// SAY WHAT NOW?! RULES PAGE
// Load AFTER script.js. Nothing here edits script.js.
// ===================================================
(function () {
  'use strict';

  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 1. Keep the jump bar under the site nav ----------
  var siteNav = document.querySelector('nav');
  function setNavHeight() {
    if (siteNav) {
      document.documentElement.style.setProperty('--nav-h', siteNav.offsetHeight + 'px');
    }
  }
  setNavHeight();
  window.addEventListener('resize', setNavHeight);
  window.addEventListener('load', setNavHeight);

  // ---------- 2. Highlight the current section in the jump bar ----------
  var jumpLinks = Array.prototype.slice.call(document.querySelectorAll('.jump-bar a'));
  var sectionToLink = new Map();
  jumpLinks.forEach(function (link) {
    var target = document.querySelector(link.getAttribute('href'));
    if (target) sectionToLink.set(target, link);
  });

  if ('IntersectionObserver' in window && sectionToLink.size) {
    var jumpObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var active = sectionToLink.get(entry.target);
          jumpLinks.forEach(function (l) {
            l.classList.remove('is-active');
            l.removeAttribute('aria-current');
          });
          active.classList.add('is-active');
          active.setAttribute('aria-current', 'true');
          // keep the active pill visible in the horizontal scroller
          var bar = active.parentElement;
          if (bar && bar.scrollTo) {
            bar.scrollTo({
              left: active.offsetLeft - bar.clientWidth / 2 + active.offsetWidth / 2,
              behavior: reduceMotion ? 'auto' : 'smooth',
            });
          }
        });
      },
      { rootMargin: '-30% 0px -60% 0px' }
    );
    sectionToLink.forEach(function (_link, section) {
      jumpObserver.observe(section);
    });
  }

  // ---------- 3. Stripe guard ----------
  // Anything marked data-needs-stripe starts hidden and only appears once
  // the Payment Link no longer contains REPLACE_ME.
  var stripeLinks = Array.prototype.slice.call(document.querySelectorAll('[data-stripe-link]'));
  var stripeReady =
    stripeLinks.length > 0 &&
    stripeLinks.every(function (a) {
      var href = a.getAttribute('href') || '';
      // must be a real Stripe link, and not a sandbox/test one (those contain /test_)
      return (
        href.indexOf('REPLACE_ME') === -1 &&
        href.indexOf('https://buy.stripe.com/') === 0 &&
        href.indexOf('/test_') === -1
      );
    });
  if (!document.querySelector('[data-needs-stripe]')) {
    // nothing on this page depends on the Stripe link
  } else if (stripeReady) {
    document.querySelectorAll('[data-needs-stripe]').forEach(function (el) {
      el.classList.remove('is-hidden');
    });
  } else if (window.console) {
    console.info('Say What Now: Buy button hidden until a live Stripe Payment Link (not a test one) is added in say-what-now.html.');
  }

  // ---------- 4. FAQ: keep aria-expanded in step with the existing toggle ----------
  document.querySelectorAll('.faq-question').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.setAttribute('aria-expanded', btn.parentElement.classList.contains('open') ? 'true' : 'false');
    });
  });

  // ---------- 5. Optional step clips: play only when visible, respect reduced motion ----------
  var clips = Array.prototype.slice.call(document.querySelectorAll('.step-media video'));
  if (clips.length) {
    if (reduceMotion) {
      clips.forEach(function (v) {
        v.removeAttribute('autoplay');
        v.pause();
        v.controls = true;
      });
    } else if ('IntersectionObserver' in window) {
      var clipObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var p = entry.target.play();
              if (p && p.catch) p.catch(function () {});
            } else {
              entry.target.pause();
            }
          });
        },
        { threshold: 0.4 }
      );
      clips.forEach(function (v) {
        v.pause();
        clipObserver.observe(v);
      });
    }
  }

  // ---------- 6. Example round: step through it ----------
  var stepper = document.getElementById('exampleStepper');
  if (stepper) {
    var stages = Array.prototype.slice.call(stepper.querySelectorAll('.stage'));
    var controls = stepper.querySelector('.example-controls');
    var nextBtn = document.getElementById('exampleNext');
    var toggleBtn = document.getElementById('exampleToggle');
    var progress = document.getElementById('exampleProgress');
    var current = 0;
    var stepping = true;

    var renderStepper = function () {
      stepper.classList.toggle('is-stepping', stepping);
      stages.forEach(function (stage, i) {
        stage.classList.toggle('is-shown', i <= current);
        stage.classList.toggle('is-current', stepping && i === current);
      });
      var atEnd = current >= stages.length - 1;
      progress.textContent = stepping ? 'Step ' + (current + 1) + ' of ' + stages.length : '';
      nextBtn.hidden = !stepping;
      nextBtn.textContent = atEnd ? 'Start again' : 'Next step';
      toggleBtn.textContent = stepping ? 'Show all steps' : 'Step through it';
    };

    nextBtn.addEventListener('click', function () {
      if (current >= stages.length - 1) {
        current = 0;
        var top = stepper.getBoundingClientRect().top + window.scrollY - 140;
        window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
      } else {
        current += 1;
      }
      renderStepper();
      if (current > 0) {
        stages[current].scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    });

    toggleBtn.addEventListener('click', function () {
      stepping = !stepping;
      if (stepping) current = 0;
      renderStepper();
    });

    controls.hidden = false;
    renderStepper();
  }

  // ---------- 7. House rules gallery ----------
  var list = document.getElementById('houseRulesList');

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function emptyState() {
    var box = el('div', 'rules-empty');
    box.appendChild(el('p', '', 'No house rules on the wall yet. Yours could be the first.'));
    var link = el('a', '', 'Share your house rule');
    link.href = '#house-rule-form';
    box.appendChild(link);
    return box;
  }

  var styleLabels = { standard: 'Standard game', chaos: 'Chaos cards', either: 'Either way' };

  function ruleCard(rule) {
    var card = el('article', 'rule-card' + (rule.featured ? ' is-featured' : ''));
    card.appendChild(el('h4', '', String(rule.title || 'Untitled rule')));
    card.appendChild(el('p', '', String(rule.rule || '')));

    var meta = el('div', 'rule-meta');
    if (rule.featured) meta.appendChild(el('span', 'rule-tag is-star', 'Rule of the month'));
    if (rule.style && styleLabels[rule.style]) {
      meta.appendChild(el('span', 'rule-tag', styleLabels[rule.style]));
    }
    if (rule.author) meta.appendChild(el('span', '', 'House rule from ' + String(rule.author)));
    card.appendChild(meta);
    return card;
  }

  function renderRules(rules) {
    list.textContent = '';
    if (!Array.isArray(rules) || rules.length === 0) {
      list.appendChild(emptyState());
      return;
    }
    rules
      .slice()
      .sort(function (a, b) {
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      })
      .forEach(function (rule) {
        list.appendChild(ruleCard(rule));
      });
  }

  if (list) {
    fetch('/house-rules.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('No rules file');
        return res.json();
      })
      .then(renderRules)
      .catch(function () {
        renderRules([]);
      });
  }

  // ---------- 8. House rule submission (Netlify Forms) ----------
  var form = document.getElementById('ruleForm');
  if (form) {
    var status = document.getElementById('ruleStatus');
    var success = document.getElementById('ruleSuccess');
    var another = document.getElementById('ruleAnother');
    var submitBtn = document.getElementById('ruleSubmit');
    var textarea = document.getElementById('rule-text');
    var counter = document.getElementById('ruleCount');

    var updateCount = function () {
      counter.textContent = textarea.value.length + ' / ' + textarea.maxLength;
    };
    textarea.addEventListener('input', updateCount);
    updateCount();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.textContent = '';
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Status ' + res.status);
          form.hidden = true;
          success.hidden = false;
          success.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
        })
        .catch(function () {
          status.textContent =
            "That didn't send. Try again, or email your rule to casateagames@gmail.com.";
        })
        .then(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send my rule';
        });
    });

    another.addEventListener('click', function () {
      form.reset();
      updateCount();
      success.hidden = true;
      form.hidden = false;
      document.getElementById('rule-nickname').focus();
    });
  }

  // ---------- 9. Shop: product gallery ----------
  var gallery = document.getElementById('gallery');
  if (gallery) {
    var mainImg = document.getElementById('galleryMain');
    gallery.addEventListener('click', function (e) {
      var thumb = e.target.closest('.gallery-thumb');
      if (!thumb) return;
      mainImg.src = thumb.getAttribute('data-src');
      mainImg.alt = thumb.getAttribute('data-alt') || '';
      gallery.querySelectorAll('.gallery-thumb').forEach(function (t) {
        t.classList.remove('is-active');
        t.setAttribute('aria-pressed', 'false');
      });
      thumb.classList.add('is-active');
      thumb.setAttribute('aria-pressed', 'true');
    });
  }

  // ---------- 10. Shop: sticky buy bar on phones ----------
  var stickyBuy = document.getElementById('stickyBuy');
  var buyBox = document.getElementById('buyBox');
  if (stickyBuy && buyBox && 'IntersectionObserver' in window) {
    var boxGone = false;
    var bottomBuyDone = false;
    var updateSticky = function () {
      stickyBuy.classList.toggle('is-visible', boxGone && !bottomBuyDone);
    };

    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        boxGone = !en.isIntersecting && en.boundingClientRect.top < 0;
        updateSticky();
      });
    }).observe(buyBox);

    var bottomBuy = document.getElementById('buy');
    if (bottomBuy) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          // hide the bar while the bottom buy panel is on screen or already scrolled past
          bottomBuyDone = en.isIntersecting || en.boundingClientRect.top < 0;
          updateSticky();
        });
      }).observe(bottomBuy);
    }
  }
})();