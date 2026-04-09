// Login Form Interactions
(function() {'use strict';

  const form = document.getElementById('loginForm');
  const btn = document.getElementById('loginBtn');
  const alertEl = document.getElementById('alert');
  const passwordInput = document.getElementById('password') || null;
  const passwordToggle = document.getElementById('passwordToggle') || null;
  const focusHandlers = []; // Store handlers for cleanup

  // Password show/hide toggle with cleanup tracking
  if (passwordToggle && passwordInput) {
    const toggleHandler = () => {
      const isPasswordVisible = passwordInput.type === 'password';
      passwordInput.type = isPasswordVisible ? 'text' : 'password';
      passwordToggle.classList.toggle('active', isPasswordVisible);
      passwordToggle.setAttribute('aria-label', isPasswordVisible ? 'Hide password' : 'Show password');
      passwordToggle.setAttribute('aria-pressed', isPasswordVisible ? 'true' : 'false');
      passwordInput.focus();
    };
    passwordToggle.addEventListener('click', toggleHandler);
    focusHandlers.push({ element: passwordToggle, event: 'click', handler: toggleHandler });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertEl.className = 'alert';
    alertEl.style.display = 'none';
    alertEl.textContent = '';

    const email = document.getElementById('email').value.trim();
    const password = passwordInput ? passwordInput.value : '';

    if (!email || !password) {
      showAlert('Please fill in all fields.', 'error');
      if (!email) document.getElementById('email').focus();
      else passwordInput.focus();
      return;
     }

    btn.classList.add('loading');
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(10000) // 10s timeout for better UX
      });

      const data = await res.json();

      if (data.success) {
        showAlert('Signing in...', 'success');
         // Redirect based on role
        if (data.user.role === 'admin') {
          window.location.href = '/admin';
         } else {
          window.location.href = '/dashboard';
         }
       } else {
        showAlert(data.message || 'Login failed.', 'error');
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        passwordInput.focus();
       }
     } catch (err) {
      if (err.name === 'AbortError') {
        showAlert('Connection timed out. Please check your internet and try again.', 'error');
      } else {
        showAlert('Connection error. Please try again.', 'error');
      }
      btn.classList.remove('loading');
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      // Log to error tracking endpoint if available
      if (window.__MOLIUM_ERROR_TRACKER) {
        window.__MOLIUM_ERROR_TRACKER({ type: 'login-fetch-error', error: err.message, timestamp: Date.now() });
      }
     }
   });

  function showAlert(msg, type) {
    alertEl.textContent = msg;
    alertEl.className = `alert ${type}`;
    alertEl.style.display = 'block';
  }

  // Mobile: collapse branding when form is focused (keyboard pushes content up)
  const formInputs = document.querySelectorAll('#loginForm input');
  let focusTimeout;
  formInputs.forEach(input => {
    const focusHandler = () => {
      clearTimeout(focusTimeout);
      document.body.classList.add('form-focused');
       // Scroll form into view on mobile
      setTimeout(() => {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
       }, 300);
     };
    const blurHandler = () => {
      focusTimeout = setTimeout(() => {
         // Only remove if no other input is focused
        if (!document.activeElement || !document.activeElement.closest('#loginForm input')) {
          document.body.classList.remove('form-focused');
         }
       }, 200);
     };
    input.addEventListener('focus', focusHandler);
    input.addEventListener('blur', blurHandler);
    focusHandlers.push(
      { element: input, event: 'focus', handler: focusHandler },
      { element: input, event: 'blur', handler: blurHandler }
    );
   });

  // If already logged in, redirect with proper error handling
  (async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include', signal: AbortSignal.timeout(5000) });
      if (!res.ok) return; // Not logged in, allow login page
      const data = await res.json();
      if (data.success && data.user) {
        window.location.href = data.user.role === 'admin' ? '/admin' : '/dashboard';
       }
     } catch (err) {
      // Suppress errors for unauthenticated users - this is expected behavior
      if (err.name !== 'AbortError') {
        console.debug('Auth check failed:', err.message);
      }
     }
   })();

  // Exposed cleanup function for all listeners
  window.moliamLoginCleanup = function() {
    focusHandlers.forEach(h => {
      if (h.element && h.handler) {
        h.element.removeEventListener(h.event, h.handler);
      }
     });
    // Clear any pending timeouts
    if (focusTimeout) clearTimeout(focusTimeout);
   };

})();
