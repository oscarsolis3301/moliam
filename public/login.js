// Login form handler for Moliam Client Portal
document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const loginForm = document.getElementById('loginForm');
  const alertDiv = document.getElementById('alert');
  const loginBtn = document.getElementById('loginBtn');
  const passwordToggle = document.getElementById('passwordToggle');

    // Body class for focused form state (used by CSS)
  function setFormFocused(focused) {
    if (focused) {
      document.body.classList.add('form-focused');
     } else {
      document.body.classList.remove('form-focused');
     }
   }

    // Password visibility toggle
  if (passwordToggle) {
    passwordToggle.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      passwordToggle.classList.toggle('active');
      passwordToggle.setAttribute('aria-pressed', isPassword);
      passwordToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');

         // Move focus back to password field after toggle
      passwordInput.focus();
     });

        // Also allow Enter/Return on password field to toggle visibility when keyboard user presses it
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !loginForm.checkValidity()) {
        e.preventDefault();
       }
     });
   }

    // Focus handling for mobile UX
   [emailInput, passwordInput].forEach(input => {
    input.addEventListener('focus', () => setFormFocused(true));
    input.addEventListener('blur', () => setFormFocused(false));
   });

    // Form submission handler
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showAlert('Please fill in all fields.', 'error');
      return;
     }

        // Show loading state
    loginBtn.disabled = true;
    loginBtn.classList.add('loading');
    hideAlert();

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
          },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
         });

      const data = await response.json();

      if (data.success) {
        hideAlert();
           // Success - redirect to dashboard
        window.location.href = '/dashboard.html';
       } else {
        showAlert(data.message || 'Invalid email or password.', 'error');
        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');

         // Shake animation for failed login feedback
        loginForm.style.animation = 'shake 0.5s';
        setTimeout(() => loginForm.style.animation = '', 500);
       }
     } catch (error) {
      showAlert('Network error. Please try again.', 'error');
      loginBtn.disabled = false;
      loginBtn.classList.remove('loading');
      console.error('Login error:', error);
     }
   });

    // Helper: Show alert
  function showAlert(message, type = 'error') {
    if (alertDiv) {
      alertDiv.textContent = message;
      alertDiv.className = `alert ${type}`;
      alertDiv.style.display = 'block';

         // Announce to screen readers
      const ariaLive = document.getElementById('aria-live-region');
      if (ariaLive) {
        ariaLive.textContent = type === 'error' ? 'Error: ' + message : 'Success: ' + message;
       }

         // Auto-hide success messages after 5 seconds
      if (type === 'success') {
        setTimeout(() => hideAlert(), 5000);
       }
     }
   }

    // Helper: Hide alert
  function hideAlert() {
    if (alertDiv) {
      alertDiv.style.display = 'none';
      alertDiv.textContent = '';
     }
   }

    // Add shake animation for failed login
  const style = document.createElement('style');
  style.textContent = `
       @keyframes shake {
         0%, 100% { transform: translateX(0); }
         25% { transform: translateX(-8px); }
         75% { transform: translateX(8px); }
       }
     `;
  document.head.appendChild(style);

    // Prefill email if available in session storage (for better UX)
  const cachedEmail = sessionStorage.getItem('moliam_cached_email');
  if (cachedEmail && emailInput) {
    emailInput.value = cachedEmail;
    emailInput.classList.add('prefilled');
     }

  console.log('Moliam login handler loaded successfully [v1]');
});
