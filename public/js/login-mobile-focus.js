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
