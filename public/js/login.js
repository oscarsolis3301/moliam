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

  // Password visibility toggle with proper ARIA state
  if (passwordToggle) {
    passwordToggle.addEventListener('click', () => {
      const isPasswordVisible = passwordInput.type === 'password';
      passwordInput.type = isPasswordVisible ? 'text' : 'password';
      passwordToggle.classList.toggle('active');
      passwordToggle.setAttribute('aria-pressed', !isPasswordVisible);
      passwordToggle.setAttribute('aria-label', isPasswordVisible ? 'Hide password' : 'Show password');

      // Move focus back to password field after toggle and select all for easy replacement
      passwordInput.focus();
      if (isPasswordVisible) {
        passwordInput.select();
      }
    });
  }

  // Real-time email validation feedback (don't submit, just warn)
  emailInput.addEventListener('input', () => {
    const email = emailInput.value.trim();
    if (email && !/\S+@\S+\.\S+/.test(email)) {
      emailInput.setCustomValidity('Please enter a valid email address');
    } else {
      emailInput.setCustomValidity('');
    }
  });

  // Password strength hint - show visual feedback without compromising security
  passwordInput.addEventListener('input', () => {
    const password = passwordInput.value;
    if (password.length > 0 && password.length < 8) {
      // Don't prevent submit, but add a note to aria-live region
      document.getElementById('aria-live-region').textContent = 'Password should be at least 8 characters';
      setTimeout(() => {
        document.getElementById('aria-live-region').textContent = '';
      }, 3000);
    }
  });

  // Focus handling for mobile UX - prevent auto-zoom on iOS
  [emailInput, passwordInput].forEach(input => {
    input.addEventListener('focus', () => setFormFocused(true));
    input.addEventListener('blur', () => setFormFocused(false));
  });

  // Form submission handler with enhanced user experience
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showAlert('Please fill in all fields.', 'error');
      return;
    }

    // Show loading state with micro-interaction feedback
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
        loginBtn.classList.remove('loading');
        // Success - redirect to dashboard with visual feedback
        // Brief success message before redirect for better UX
        showAlert('Signing you in...', 'success');
        setTimeout(() => {
          window.location.href = data.user?.role === 'admin' ? '/admin.html' : '/dashboard.html';
        }, 500);
      } else {
        showAlert(data.message || 'Invalid email or password.', 'error');
        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');
        passwordInput.focus();
        passwordInput.select();
        // Shake animation for visual feedback on error
        loginForm.style.animation = 'shake 0.3s ease';
        setTimeout(() => {
          loginForm.style.animation = '';
        }, 300);
      }
    } catch (err) {
      showAlert('Connection error. Please check your internet and try again.', 'error');
      loginBtn.disabled = false;
      loginBtn.classList.remove('loading');
    }
  });

  // Enhance accessibility - handle Enter key on password field for toggle visibility
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !loginForm.checkValidity()) {
      e.preventDefault();
      emailInput.focus();
    }
  });

  // Helper functions with better UX patterns
  function showAlert(msg, type) {
    alertDiv.textContent = msg;
    alertDiv.className = `alert ${type}`;
    alertDiv.style.display = 'block';

    // Auto-hide success messages after 5 seconds
    if (type === 'success' && !msg.includes('Signing you in')) {
      setTimeout(hideAlert, 5000);
    }
  }

  function hideAlert() {
    alertDiv.textContent = '';
    alertDiv.className = 'alert';
    alertDiv.style.display = 'none';
  }

  // Check if already logged in - redirect automatically but gracefully
  (async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        window.location.href = data.user?.role === 'admin' ? '/admin.html' : '/dashboard.html';
      }
    } catch {}
  })();

  // Add shake animation for error feedback
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
  `;
  document.head.appendChild(style);

  // Accessibility improvement: announce errors to screen readers
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class' && mutation.target.className.includes('error')) {
        const errorText = alertDiv.textContent;
        if (errorText) {
          document.getElementById('aria-live-region').textContent = errorText;
        }
      }
    });
  });

  if (alertDiv) {
    observer.observe(alertDiv, { attributes: true });
  }

});