// ===================================================
// CASA TEA GAMES - MAIN JAVASCRIPT
// ===================================================

// ===== BASIC INTERACTIONS =====

// Contact Modal
function openContactModal(e) {
  if (e) e.preventDefault();
  document.getElementById('contactModal').classList.add('active');
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeContactModal() {
  document.getElementById('contactModal').classList.remove('active');
  document.body.style.overflow = ''; // Re-enable scrolling
  // Reset form after closing
  setTimeout(() => {
    document.querySelector('.contact-form').reset();
    document.getElementById('contactSuccess').style.display = 'none';
    document.querySelector('.contact-form').style.display = 'block';
  }, 300);
}

function handleContactSubmit(e) {
  e.preventDefault();
  const form = e.target;
  
  // Submit via Netlify
  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(new FormData(form)).toString()
  })
  .then(() => {
    // Show success message
    form.style.display = 'none';
    document.getElementById('contactSuccess').style.display = 'block';
  })
  .catch((error) => {
    alert('Oops! Something went wrong. Please try emailing us directly at casateagames@gmail.com');
  });
}

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeContactModal();
  }
});

// Mobile menu toggle
function toggleMenu() {
  document.getElementById("navLinks").classList.toggle("open");
}

// FAQ toggle
function toggleFAQ(button) {
  const item = button.parentElement;
  item.classList.toggle("open");
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("navLinks").classList.remove("open");
    }
  });
});

// ===== MOBILE ENGAGEMENT FEATURES =====

// FEATURE 1: Hide scroll hint after user scrolls
let hasScrolled = false;
window.addEventListener('scroll', () => {
  if (!hasScrolled && window.scrollY > 100) {
    const scrollHint = document.getElementById('scrollHint');
    if (scrollHint) {
      scrollHint.classList.add('hidden');
      hasScrolled = true;
    }
  }
});

// FEATURE 2: Section reveal animations on scroll
const observerOptions = {
  threshold: 0.15,
  rootMargin: '0px 0px -50px 0px'
};

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, observerOptions);

document.querySelectorAll('.section-animate').forEach(section => {
  sectionObserver.observe(section);
});

// FEATURE 3: Progress dots navigation
const sections = ['hero', 'games', 'about', 'conventions', 'updates', 'faq', 'join'];
const dots = document.querySelectorAll('.progress-dot');

// Update active dot based on scroll position
window.addEventListener('scroll', () => {
  let currentSection = '';
  sections.forEach(sectionId => {
    const section = document.getElementById(sectionId);
    if (section) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2) {
        currentSection = sectionId;
      }
    }
  });

  dots.forEach(dot => {
    if (dot.dataset.section === currentSection) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });
});

// Click dots to navigate to sections
dots.forEach(dot => {
  dot.addEventListener('click', () => {
    const sectionId = dot.dataset.section;
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// FEATURE 4: Animated stats counter (when hero stats scroll into view)
function animateValue(element, start, end, duration) {
  let startTime = null;
  const step = (timestamp) => {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const value = Math.floor(progress * (end - start) + start);
    element.textContent = value + (end === 100 ? '%' : '');
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

// Animate stats in hero section
const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const numbers = document.querySelectorAll('.quick-stats .stat-number');
      numbers.forEach(num => {
        const target = parseInt(num.dataset.target);
        if (target) {
          animateValue(num, 0, target, 1500);
        }
      });
      statsObserver.disconnect();
    }
  });
}, { threshold: 0.5 });

const quickStats = document.querySelector('.quick-stats');
if (quickStats) {
  statsObserver.observe(quickStats);
}

// FEATURE 5: Scroll progress bar
window.addEventListener('scroll', () => {
  const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
  document.body.style.setProperty('--scroll', scrollPercent);
});

// FEATURE 6: Hide swipe indicator after user swipes testimonials
const testimonialGrid = document.getElementById('testimonialGrid');
if (testimonialGrid) {
  let hasSwipedTestimonials = false;
  testimonialGrid.addEventListener('scroll', () => {
    if (!hasSwipedTestimonials && testimonialGrid.scrollLeft > 50) {
      const indicator = document.querySelector('.swipe-indicator');
      if (indicator) {
        indicator.style.opacity = '0';
        hasSwipedTestimonials = true;
      }
    }
  });
}