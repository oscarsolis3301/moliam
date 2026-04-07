
/* ══════════════════════════════════════════════════════════
   Progressive Form — Moliam Contact Section
   Self-contained IIFE. No dependencies.
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── DOM refs ──
  var form = document.getElementById('contact-form');
  if (!form) return;

  var stepsContainer = document.getElementById('pf-steps');
  var progressFill = document.getElementById('pf-progress-fill');
  var stepCurrentEl = document.getElementById('pf-step-current');
  var btnBack = document.getElementById('pf-back');
  var btnNext = document.getElementById('pf-next');
  var btnSubmit = document.getElementById('pf-submit');
  var statusEl = document.getElementById('pf-form-status');

  var steps = stepsContainer.querySelectorAll('.pf-step');
  var totalSteps = steps.length;
  var currentStep = 1;

  // ── Service labels map ──
  var serviceLabels = {
    website: 'Website Build — $300 + $100/mo',
    gbp: 'GBP Optimization — $200/mo',
    lsa: 'Google LSA — $300 + $250/mo',
    retainer: 'Full Retainer — $800/mo',
    other: 'Not Sure Yet'
  };

  // ── Init ──
  function init() {
    updateUI();
    bindEvents();
    focusCurrentInput();
  }

  // ── Update UI for current step ──
  function updateUI() {
    // Progress bar
    var pct = (currentStep / totalSteps) * 100;
    progressFill.style.width = pct + '%';
    stepCurrentEl.textContent = currentStep;

    // Step visibility
    for (var i = 0; i < steps.length; i++) {
      var step = steps[i];
      var num = i + 1;
      step.classList.remove('pf-step--active', 'pf-step--prev', 'pf-step--future');

      if (num === currentStep) {
        step.classList.add('pf-step--active');
      } else if (num < currentStep) {
        step.classList.add('pf-step--prev');
      } else {
        step.classList.add('pf-step--future');
      }
    }

    // Animate container height
    var activeStep = steps[currentStep - 1];
    // Briefly make it relative for measurement
    requestAnimationFrame(function () {
      stepsContainer.style.height = activeStep.offsetHeight + 'px';
    });

    // Navigation buttons
    btnBack.hidden = currentStep === 1;
    btnNext.hidden = currentStep === totalSteps;
    btnSubmit.hidden = currentStep !== totalSteps;

    // Populate review on last step
    if (currentStep === totalSteps) {
      populateReview();
    }
  }

  // ── Populate review step ──
  function populateReview() {
    var nameVal = getValue('pf-name');
    var emailVal = getValue('pf-email');
    var phoneVal = getValue('pf-phone');
    var companyVal = getValue('pf-company');
    var websiteVal = getValue('pf-website');
    var socials = [
      getValue('pf-social-google'),
      getValue('pf-social-facebook'),
      getValue('pf-social-instagram'),
      getValue('pf-social-yelp')
    ].filter(function(s) { return s; });
    var serviceVal = getSelectedService();
    var messageVal = getValue('pf-message');

    setReview('pf-review-name', nameVal);
    setReview('pf-review-email', emailVal);
    setReview('pf-review-phone', phoneVal || '—');
    setReview('pf-review-company', companyVal || '—');
    setReview('pf-review-website', websiteVal || '—');
    setReview('pf-review-socials', socials.length ? socials.join(', ') : '—');
    setReview('pf-review-service', serviceLabels[serviceVal] || '—');
    setReview('pf-review-message', messageVal || '—');
  }

  function getValue(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function getSelectedService() {
    var checked = form.querySelector('input[name="pf-service"]:checked');
    return checked ? checked.value : '';
  }

  function setReview(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ── Focus first input on step ──
  function focusCurrentInput() {
    var activeStep = steps[currentStep - 1];
    var input = activeStep.querySelector('input, textarea, select');
    if (input) {
      setTimeout(function () {
        input.focus();
      }, 100);
    }
  }

  // ── Validation ──
  function validateStep(stepNum) {
    switch (stepNum) {
      case 1: // Name
        return validateRequired('pf-name', 'Please enter your name');
      case 2: // Email
        return validateEmail();
      case 3: // Phone (optional)
        return true;
      case 4: // Company (optional)
        return true;
      case 5: // Website & Socials (optional)
        return true;
      case 6: // Service (required)
        var checked = form.querySelector('input[name="pf-service"]:checked');
        if (!checked) {
          var pills = document.getElementById('pf-pills');
          if (pills) { pills.classList.add('pf-shake'); setTimeout(function(){ pills.classList.remove('pf-shake'); }, 500); }
          return false;
        }
        return true;
      case 7: // Message (optional)
        return true;
      default:
        return true;
    }
  }

  function validateRequired(id, msg) {
    var el = document.getElementById(id);
    if (!el || !el.value.trim()) {
      shakeInput(el);
      return false;
    }
    clearError(el);
    return true;
  }

  function validateEmail() {
    var el = document.getElementById('pf-email');
    if (!el) return false;
    var val = el.value.trim();
    // Basic email regex
    var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!val || !re.test(val)) {
      shakeInput(el);
      return false;
    }
    clearError(el);
    return true;
  }

  function shakeInput(el) {
    if (!el) return;
    el.classList.add('pf-input--error');
    el.classList.remove('pf-shake');
    // Force reflow
    void el.offsetWidth;
    el.classList.add('pf-shake');
    el.addEventListener('animationend', function handler() {
      el.classList.remove('pf-shake');
      el.removeEventListener('animationend', handler);
    });
    el.focus();
  }

  function clearError(el) {
    if (el) el.classList.remove('pf-input--error');
  }

  // ── Navigation ──
  function goNext() {
    if (currentStep >= totalSteps) return;
    if (!validateStep(currentStep)) return;

    currentStep++;
    updateUI();
    focusCurrentInput();
  }

  function goBack() {
    if (currentStep <= 1) return;
    currentStep--;
    updateUI();
    focusCurrentInput();
  }

  // ── Phone Formatting ──
  function formatPhone(value) {
    // Strip non-digits
    var digits = value.replace(/\D/g, '');
    // Limit to 10 digits
    digits = digits.substring(0, 10);

    if (digits.length === 0) return '';
    if (digits.length <= 3) return '(' + digits;
    if (digits.length <= 6) return '(' + digits.substring(0, 3) + ') ' + digits.substring(3);
    return '(' + digits.substring(0, 3) + ') ' + digits.substring(3, 6) + '-' + digits.substring(6);
  }

  // ── Submit ──
  function handleSubmit(e) {
    e.preventDefault();

    var btn = btnSubmit;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    statusEl.textContent = '';
    statusEl.className = 'pf-form-status';

    var payload = {
      name: getValue('pf-name'),
      email: getValue('pf-email'),
      phone: getValue('pf-phone'),
      company: getValue('pf-company'),
      website: getValue('pf-website'),
      socials: {
        google: getValue('pf-social-google'),
        facebook: getValue('pf-social-facebook'),
        instagram: getValue('pf-social-instagram'),
        yelp: getValue('pf-social-yelp')
      },
      service: getSelectedService(),
      message: getValue('pf-message'),
      screenResolution: window.screen.width + 'x' + window.screen.height
    };

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) {
          showSuccess(data.message || 'Message sent! We\'ll be in touch soon.');
        } else {
          showError(data.message || 'Something went wrong. Please try again.');
          btn.disabled = false;
          btn.textContent = 'Submit →';
        }
      })
      .catch(function () {
        showError('Connection error. Please try again.');
        btn.disabled = false;
        btn.textContent = 'Submit →';
      });
  }

  function showSuccess(msg) {
    var reviewEl = document.getElementById('pf-review');
    if (reviewEl) reviewEl.style.display = 'none';

    // Replace step content with success message
    statusEl.className = 'pf-form-status pf-form-status--success';
    statusEl.innerHTML =
      '<div class="pf-success-icon">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="20 6 9 17 4 12"></polyline>' +
        '</svg>' +
      '</div>' +
      '<div style="font-size:18px; font-weight:600; color:#F9FAFB; margin-bottom:6px;">Thank you!</div>' +
      '<div style="font-size:14px; color:#9CA3AF;">' + escapeHtml(msg) + '</div>';

    // Hide nav
    btnBack.hidden = true;
    btnSubmit.hidden = true;
    btnNext.hidden = true;

    // Update step title
    var activeStep = steps[currentStep - 1];
    var title = activeStep.querySelector('.pf-step-title');
    var desc = activeStep.querySelector('.pf-step-desc');
    if (title) title.textContent = 'All done!';
    if (desc) desc.textContent = '';

    // Re-measure height
    requestAnimationFrame(function () {
      stepsContainer.style.height = activeStep.offsetHeight + 'px';
    });

    // Reset after 3s
    setTimeout(function () {
      resetForm();
    }, 3000);
  }

  function showError(msg) {
    statusEl.className = 'pf-form-status pf-form-status--error';
    statusEl.textContent = '❌ ' + msg;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function resetForm() {
    form.reset();
    currentStep = 1;

    // Reset review
    var reviewEl = document.getElementById('pf-review');
    if (reviewEl) reviewEl.style.display = '';

    // Reset status
    statusEl.textContent = '';
    statusEl.className = 'pf-form-status';

    // Reset step titles
    var lastStep = steps[steps.length - 1];
    if (lastStep) {
      var title = lastStep.querySelector('.pf-step-title');
      var desc = lastStep.querySelector('.pf-step-desc');
      if (title) title.textContent = 'Almost there!';
      if (desc) desc.textContent = 'Review your info';
    }

    // Reset submit button
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Submit →';

    // Clear all error states
    var errorInputs = form.querySelectorAll('.pf-input--error');
    for (var i = 0; i < errorInputs.length; i++) {
      errorInputs[i].classList.remove('pf-input--error');
    }

    updateUI();
    focusCurrentInput();
  }

  // ── Event Bindings ──
  function bindEvents() {
    btnNext.addEventListener('click', goNext);
    btnBack.addEventListener('click', goBack);
    form.addEventListener('submit', handleSubmit);

    // Enter key advances (except in textarea)
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var tag = e.target.tagName.toLowerCase();
        if (tag === 'textarea') return; // Allow enter in textarea
        e.preventDefault();

        if (currentStep < totalSteps) {
          goNext();
        } else {
          // On review step, trigger submit
          handleSubmit(e);
        }
      }
    });

    // Phone formatting
    var phoneInput = document.getElementById('pf-phone');
    if (phoneInput) {
      phoneInput.addEventListener('input', function () {
        var cursorPos = phoneInput.selectionStart;
        var oldLen = phoneInput.value.length;
        phoneInput.value = formatPhone(phoneInput.value);
        var newLen = phoneInput.value.length;
        // Adjust cursor position
        var newCursor = cursorPos + (newLen - oldLen);
        phoneInput.setSelectionRange(newCursor, newCursor);
      });
    }

    // Clear error on input
    var allInputs = form.querySelectorAll('.pf-input');
    for (var i = 0; i < allInputs.length; i++) {
      allInputs[i].addEventListener('input', function () {
        this.classList.remove('pf-input--error');
      });
    }

    // Service pill click auto-advance (small delay for visual feedback)
    var pills = form.querySelectorAll('.pf-pill-radio');
    for (var j = 0; j < pills.length; j++) {
      pills[j].addEventListener('change', function () {
        setTimeout(function () {
          goNext();
        }, 300);
      });
    }

    // Resize observer for dynamic height
    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () {
        var active = steps[currentStep - 1];
        if (active && active.classList.contains('pf-step--active')) {
          stepsContainer.style.height = active.offsetHeight + 'px';
        }
      });
      for (var k = 0; k < steps.length; k++) {
        ro.observe(steps[k]);
      }
    }
  }

  // ── Start ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

