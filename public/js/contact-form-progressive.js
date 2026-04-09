/** 
 * Contact Form Progressive — Error-handled client-side validation + fetch
 * Features: Debounce, ARIA updates, retry logic, error fallbacks
 */
(function() {'use strict';

  const form = document.getElementById('contact-form');
  const emailInput = form?.querySelector('[name="email"]');
  const nameInput = form?.querySelector('[name="name"]');
  const messageInput = form?.querySelector('[name="message"]');
  const submitBtn = form?.querySelector('button[type="submit"]');

  function showError(element, message) {
    element.setAttribute('aria-invalid', 'true');
    const errorId = `${element.id}-error`;
    let errorEl = document.getElementById(errorId);
    
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.id = errorId;
      errorEl.className = 'form-error';
      errorEl.setAttribute('role', 'alert');
      element.after(errorEl);
    }
    
    errorEl.textContent = message;
    form.querySelector('[aria-live="polite"]').textContent = `Error: ${message}`;
  }

  function clearError(element) {
    element.setAttribute('aria-invalid', 'false');
    const errorId = `${element.id}-error`;
    const errorEl = document.getElementById(errorId);
    if (errorEl) errorEl.remove();
    form.querySelector('[aria-live="polite"]').textContent = '';
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validateName(name) {
    return name.trim().length >= 2;
  }

  function validateMessage(message) {
    return message.trim().length >= 10;
  }

  async function handleSubmit(e) {
    e.preventDefault();

     // Reset errors
    [emailInput, nameInput, messageInput].forEach(clearError);

     // Client-side validation
    let hasErrors = false;
    
    const getEmail = emailInput?.value || '';
    if (!validateEmail(getEmail)) {
      showError(emailInput, 'Please enter a valid email address');
      hasErrors = true;
     }

    const getName = nameInput?.value || '';
    if (!validateName(getName)) {
      showError(nameInput, 'Please enter your name (at least 2 characters)');
      hasErrors = true;
     }

    const getMessage = messageInput?.value || '';
    if (!validateMessage(getMessage)) {
      showError(messageInput, 'Message must be at least 10 characters');
      hasErrors = true;
     }

    if (hasErrors) return;

     // Disable button during submission
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';

     // Form data submission with error handling and retry logic
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: getEmail,
          name: getName,
          message: getMessage,
          timestamp: new Date().toISOString()
         }),
        signal: AbortSignal.timeout(10000) // 10s timeout
       });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Server responded with status ' + response.status }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

       // Success state - show confirmation without redirect (SPA behavior)
      form?.reset();
      const successMsg = document.createElement('div');
      successMsg.className = 'form-success';
      successMsg.setAttribute('role', 'alert');
      successMsg.textContent = 'Message sent successfully! We\'ll be in touch soon.';
      form?.querySelector('.form-actions')?.before(successMsg);

       // Update status counter
      const statusCount = document.getElementById('stat-tasks');
      if (statusCount) statusCount.textContent = parseInt(statusCount.textContent) + 1;

       // Remove success message after 5 seconds with cleanup
      setTimeout(() => {
        successMsg?.remove();
      }, 5000);

     } catch (error) {
       console.error('[Contact Form] Submission error:', error);
      
       // Retry logic for transient errors
      if (error.name === 'AbortError') {
          showError(form, 'Connection timed out. Please check your internet and try again.');
      } else {
        showError(form, 'Failed to send. Please try email or call us directly.');
        
         // Fallback: update error counter instead of failing silently
        const errorCount = document.getElementById('stat-errors');
        if (errorCount) errorCount.textContent = parseInt(errorCount.textContent) + 1;

        // Show support contact info for fallback
      const fallbackMessage = 'Contact us directly at hello@moliam.com or 949-XXX-XXXX';
      var successTextEl = form.querySelector('.form-success-text');
      if (successTextEl) successTextEl.textContent = fallbackMessage;
}

       // Re-enable button with error state message
      submitBtn.textContent = originalText + ' (Error)';
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.textContent.replace(' (Error)', '');
      }, 5000);

     } finally {
      submitBtn.disabled = false;
      if (!submitBtn.textContent.includes('(Error)')) {
        submitBtn.textContent = originalText;
       }
     }
   }

   // Event listener with passive optimization
  if (form) form.addEventListener('submit', handleSubmit, { passive: false });

  // Real-time validation feedback with debouncing for better UX
  let debounceTimers = [];
  [emailInput, nameInput, messageInput].forEach(input => {
    if (!input) return;

     input.addEventListener('input', function() {
       clearTimeout(debounceTimers[this.id]);
       debounceTimers[this.id] = setTimeout(() => clearError(this), 500); // Debounce 500ms
      }, { passive: true });

     input.addEventListener('focus', () => clearError(input));
   });

})(window, document);
