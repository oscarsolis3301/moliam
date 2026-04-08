document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const btn = document.getElementById('loginBtn');
  const alertEl = document.getElementById('alert');
  const passwordInput = document.getElementById('passwordInput');
  const passwordToggle = document.getElementById('passwordToggle');

  if (!form || !btn || !alertEl || !passwordInput || !passwordToggle) {
    console.warn('Missing required login form elements');
    return;
  }

  // Password show/hide toggle
  function handlePasswordToggle() {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    passwordToggle.classList.toggle('active', isPassword);
    passwordToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    passwordToggle.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
    passwordInput.focus();
  }

  passwordToggle.addEventListener('click', handlePasswordToggle);

  // Alert helper function
  function showAlert(msg, type) {
    alertEl.textContent = msg;
    alertEl.className = `alert ${type}`;
    alertEl.style.display = 'block';
  }

  // Clear alert state
  function clearAlert() {
    alertEl.className = 'alert';
    alertEl.style.display = 'none';
    alertEl.textContent = '';
  }

  // Form submission handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const email = document.getElementById('email').value.trim();
    const password = passwordInput.value;

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
      });

      // Check for network/API errors (not just JSON parsing)
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();

      if (data.success) {
        showAlert('Signing in...', 'success');
        // Redirect based on role
        window.location.href = data.user.role === 'admin' ? '/admin' : '/dashboard';
      } else {
        showAlert(data.message || 'Login failed.', 'error');
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        passwordInput.focus();
      }
    } catch (err) {
      console.error('Login error:', err);
      showAlert(
        res && !res.ok ? `Server error (${res.status}). Please try again.` :
          'Connection error. Please check your network and try again.',
        'error'
      );
      btn.classList.remove('loading');
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    } finally {
      // Ensure cleanup happens even if error occurred
      if (btn.classList.contains('loading')) {
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    }
  });

  // Mobile: collapse branding when form is focused (keyboard pushes content up)
  const formInputs = document.querySelectorAll('#loginForm input');
  let focusTimeout;

  function handleInputFocus(event) {
    clearTimeout(focusTimeout);
    document.body.classList.add('form-focused');
    // Scroll form into view on mobile
    setTimeout(() => {
      event.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }

  function handleInputBlur(event) {
    focusTimeout = setTimeout(() => {
      // Only remove if no other input is focused
      if (!document.activeElement || !document.activeElement.closest('#loginForm input')) {
        document.body.classList.remove('form-focused');
      }
    }, 200);
  }

  formInputs.forEach(input => {
    input.addEventListener('focus', handleInputFocus);
    input.addEventListener('blur', handleInputBlur);
  });

  // If already logged in, redirect - with proper error handling for fetch
  (async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      
      // Check if response is OK before parsing
      if (!res.ok) {
        console.info('User not logged in - redirect check skipped');
        return;
      }

      const data = await res.json();
      if (data.success && data.user) {
        window.location.href = data.user.role === 'admin' ? '/admin' : '/dashboard';
      }
    } catch (err) {
      // Don't log as warning - it's expected when user is not logged in
      console.debug('Auto-check login: User not authenticated');
    }
  })();
});
