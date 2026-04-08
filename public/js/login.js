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
        passwordInput.focus();
      }
    } catch (err) {
      showAlert('Connection error. Please try again.', 'error');
      loginBtn.disabled = false;
      loginBtn.classList.remove('loading');
    }
  });

     // Helper functions
  function showAlert(msg, type) {
    alertDiv.textContent = msg;
    alertDiv.className = `alert ${type}`;
    alertDiv.style.display = 'block';
  }

  function hideAlert() {
    alertDiv.textContent = '';
    alertDiv.className = 'alert';
    alertDiv.style.display = 'none';
  }

     // If already logged in, redirect
  (async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        window.location.href = data.user.role === 'admin' ? '/admin.html' : '/dashboard.html';
      }
    } catch {}
  })();

});