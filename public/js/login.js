const form = document.getElementById('loginForm');
const btn = document.getElementById('loginBtn');
const alertEl = document.getElementById('alert');
const passwordInput = document.getElementById('password');
const passwordToggle = document.getElementById('passwordToggle');

// Password show/hide toggle
passwordToggle.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  passwordToggle.classList.toggle('active', isPassword);
  passwordToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
  passwordToggle.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
  passwordInput.focus();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  alertEl.className = 'alert';
  alertEl.style.display = 'none';
  alertEl.textContent = '';

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
    showAlert('Connection error. Please try again.', 'error');
    btn.classList.remove('loading');
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
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
  input.addEventListener('focus', () => {
    clearTimeout(focusTimeout);
    document.body.classList.add('form-focused');
    // Scroll form into view on mobile
    setTimeout(() => {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  });
  input.addEventListener('blur', () => {
    focusTimeout = setTimeout(() => {
      // Only remove if no other input is focused
      if (!document.activeElement || !document.activeElement.closest('#loginForm input')) {
        document.body.classList.remove('form-focused');
      }
    }, 200);
  });
});

// If already logged in, redirect
(async () => {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (data.success) {
      window.location.href = data.user.role === 'admin' ? '/admin' : '/dashboard';
    }
  } catch (err) {
    console.warn('Auto-check login failed - user not logged in');
  }
})();