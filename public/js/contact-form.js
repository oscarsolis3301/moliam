/**
 * MOLIAM Contact Form — Frontend Handler
 * Posts to /api/contact (CloudFlare Pages Function)
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#contact form');
  if (!form) return;

  const statusEl = document.getElementById('formStatus');
  const submitBtn = form.querySelector('button[type="submit"]');

  function showStatus(msg, type) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'form-status ' + type;
    if (type === 'success') {
      setTimeout(function () {
        statusEl.textContent = '';
        statusEl.className = 'form-status';
      }, 6000);
    }
  }

  function clearStatus() {
    if (!statusEl) return;
    statusEl.textContent = '';
    statusEl.className = 'form-status';
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearStatus();

    const name = (form.querySelector('#name')?.value || '').trim();
    const email = (form.querySelector('#email')?.value || '').trim();
    const phone = (form.querySelector('#phone')?.value || '').trim();
    const company = (form.querySelector('#company')?.value || '').trim();
    const message = (form.querySelector('#message')?.value || '').trim();

     // Client-side validation
    var errors = [];
    if (name.length < 2) errors.push('Name must be at least 2 characters.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Please enter a valid email.');
    if (message.length < 10) errors.push('Message must be at least 10 characters.');

    if (errors.length) {
      showStatus(errors.join(' '), 'error');
      return;
     }

     // Disable button while submitting
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      const resp = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          phone: phone || null,
          company: company || null,
          message: message,
          screenResolution: window.screen.width + 'x' + window.screen.height,
         }),
       });

       // Check if the fetch itself failed or returned an HTTP error
      if (!resp.ok) {
        throw new Error(`HTTP error ${resp.status}`);
       }

      const result = await resp.json();

      if (result.success) {
        showStatus(result.message || 'Message sent!', 'success');
        form.reset();
       } else {
        showStatus(result.message || 'Something went wrong. Please try again.', 'error');
       }
     } catch (err) {
      console.error('Form submission error:', err);
      showStatus(
        resp && !resp.ok ? `Server error (${resp.status}). Please try again.` :
           'Network error. Please check your connection and try again.',
         'error'
       );
     } finally {
       submitBtn.disabled = false;
       submitBtn.textContent = 'Send Message';
     }
   });
});
