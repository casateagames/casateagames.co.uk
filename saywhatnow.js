// ===================================================
// RULES PAGE + SHOP PAGE
// Load AFTER script.js (it reuses window.submitNetlifyForm).
// Each block only runs if its elements exist on the page.
// ===================================================
(function () {
  'use strict';

  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

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

  if (hasIO && sectionToLink.size) {
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

  // ---------- 3. House rules gallery ----------
  var list = document.getElementById('houseRulesList');

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function messageBox(text, linkText) {
    var box = el('div', 'rules-empty');
    box.appendChild(el('p', '', text));
    if (linkText) {
      var link = el('a', '', linkText);
      link.href = '#house-rule-form';
      box.appendChild(link);
    }
    return box;
  }

  function showInList(node) {
    list.textContent = '';
    list.appendChild(node);
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
    if (!Array.isArray(rules) || rules.length === 0) {
      showInList(messageBox('No house rules on the wall yet. Yours could be the first.', 'Share your house rule'));
      return;
    }
    list.textContent = '';
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
    // The "Loading" message is added here, not in the HTML, so visitors
    // without JS see the <noscript> message instead of a spinner that never ends.
    showInList(messageBox('Loading house rules...'));
    fetch('/house-rules.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('No rules file');
        return res.json();
      })
      .then(renderRules)
      .catch(function () {
        showInList(
          messageBox(
            "We couldn't load the house rules just now. Try refreshing the page, or send us yours.",
            'Share your house rule'
          )
        );
      });
  }

  // ---------- 4. House rule submission (Netlify Forms) ----------
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

      window
        .submitNetlifyForm(form)
        .then(function () {
          form.hidden = true;
          success.hidden = false;
          var heading = success.querySelector('h4');
          if (heading) heading.focus();
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

  // ---------- 5. Shop: product gallery ----------
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

  // ---------- 6. Shop: one Payment Link, three buttons ----------
  // Edit the link on the main Buy button (inside #buyBox); the other buttons
  // marked data-buy copy it on load. They also carry the same href in the HTML
  // so they still work without JS.
  var mainBuy = document.querySelector('#buyBox [data-buy]');
  if (mainBuy) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-buy]'), function (a) {
      a.href = mainBuy.href;
    });
  }

  // ---------- 7. Shop: sticky buy bar on phones ----------
  var stickyBuy = document.getElementById('stickyBuy');
  var buyBox = document.getElementById('buyBox');
  if (stickyBuy && buyBox && hasIO) {
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

  // ---------- 8. Picture guide: swap in the animated MP4s ----------
  // Each .guide-page has a data-video path. The still image stays in the HTML
  // (lazy-loaded, and the fallback if the video won't load). When a figure gets
  // near the screen it is swapped for a muted looping video, which only plays
  // while it is on screen. Nothing is requested until then.
  var guidePages = Array.prototype.slice.call(document.querySelectorAll('.guide-page[data-video]'));
  if (guidePages.length && hasIO && !reduceMotion) {
    var playObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var v = entry.target;
          if (entry.isIntersecting) {
            var p = v.play();
            if (p && p.catch) p.catch(function () {});
          } else {
            v.pause();
          }
        });
      },
      { threshold: 0.15 }
    );

    var upgrade = function (fig) {
      var img = fig.querySelector('img');
      if (!img) return;

      var video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('role', 'img');
      video.setAttribute('aria-label', fig.getAttribute('data-video-alt') || img.alt);
      video.poster = img.currentSrc || img.src;

      // Same width/height as the image, so the page doesn't jump when it swaps
      var w = img.getAttribute('width');
      var h = img.getAttribute('height');
      if (w && h) {
        video.width = parseInt(w, 10);
        video.height = parseInt(h, 10);
      }

      // If the file is missing or won't play, put the still image back
      video.addEventListener('error', function () {
        playObserver.unobserve(video);
        if (video.parentNode) video.parentNode.replaceChild(img, video);
      });

      video.src = fig.getAttribute('data-video');
      fig.replaceChild(video, img);
      playObserver.observe(video);
    };

    var swapObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          swapObserver.unobserve(entry.target);
          upgrade(entry.target);
        });
      },
      { rootMargin: '400px 0px' }
    );
    guidePages.forEach(function (fig) {
      swapObserver.observe(fig);
    });
  }
})();
