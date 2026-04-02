/**
 * moliam.com Contact Form Frontend - POSTs to /api/contact CloudFlare Pages Function!
 * Replaces all old form handling with real backend integration + no localStorage fallback anymore!
 */

(() => {  
    document.addEventListener('DOMContentLoaded', () => {  
        const contactSection = document.querySelector('#contact');       
         if (!contactSection || !contactSection.querySelector('form')) return;      // Exit if no contact form found in DOM!  
          
                  const form = contactSection.querySelector('form');     
       const submitBtn = form.querySelector('button[type="submit"]');    
           const statusEl = contactSection.querySelector('#formStatus');       
             function updateStatus(message, type = 'error') {    // Show inline validation messages dynamically below form  
                 if (!statusEl) return;        
                    statusEl.textContent = message || '';         
                    statusEl.className = 'form-status show' + (type === 'success' ? ' success':'');     
                   setTimeout(() => { statusEl.classList.remove('show'); statusEl.textContent = ''; }, 8000);    // Auto-hide after 8 sec
               }   

             function validateField(fieldEl, type) {     /* Inline validation by field type: email/name/message */    
                 let valid = true;       
                    if (type === 'email') valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fieldEl.value.trim());      
                      else if (fieldEl.id === 'name') valid = fieldEl.value.trim().length >= 2;        
                         else if (fieldEl.id === 'message' && fieldEl.value.trim().length < 10) valid = false;      
                          fieldEl.setAttribute('aria-invalid',!valid? 'true':'false');       
                             return valid;     
                           }   

             function validateForm() {    // Run all field validations simultaneously + show errors if any  
                  const nameEl = form.querySelector('#name');        
                      const emailEl = form.querySelector('#email');         
                         const messageEl = form.querySelector('#message');       
                              let errors = [];       if (!validateField(nameEl,'name')) errors.push('Name is required.');    
                                    else if (nameEl.value.trim().length < 2) errors.push('Must be at least 2 characters.');   

                                     if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) errors.push('Invalid email address.');

                                      if (messageEl.value.trim().length < 10) errors.push('Message must be at least 10 characters.');  

                                       if (errors.length > 0) {  
                                            updateStatus(errors.join(' '), 'error');    
                                             return false;       } 
                                             else { statusEl.classList.remove('show'); statusEl.textContent = ''; return true; }     // OK: no errors present → allow submission!
                                 } 

                                  async function submitToBackend(formDataObj ={}) {   /* POST to /api/contact CloudFlare Pages Function (POST JSON body) */        
                                       if (!formDataObj.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formDataObj.email) || formDataObj.message.length < 10) updateStatus('Name + valid email + message(10+ chars) required!');    
                                          else {    
                                              submitBtn.disabled = true;    submitBtn.textContent = 'Sending...';     /* Disable UI while POSTing */      
                                                  try {    
                                                      const response = await fetch('/api/contact', { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ name:formDataObj.name, email:formDataObj.email.toLowerCase().trim(),phone:formDataObj.phone || '', company:formDataObj.company || '', message:formDataObj.message.trim(), userAgent:navigator.userAgent, screenResolution:`${window.screen.width}x${window.screen.height}` }) });   
                                                           const result = await response.json();    /* Parse CloudFlare Pages Function response */    
                                                              if (!result.success) {   updateStatus(result.error || result.message || 'Submission failed - try again later.', 'error'); submitBtn.disabled = false; submitBtn.textContent = 'Send Message'; return false; } 
                                                               statusEl.classList.remove('show');   statusEl.textContent = '';  form.reset();      clearInputFields();       window.scrollTo({ top: document.body.scrollHeight, behavior:'smooth'});    // Scroll to bottom after success!       
                                                                  setTimeout(() => { location.href = '#contact'; },2000);     // Auto-scroll back up after success!    
                                                                   submitBtn.disabled = false;   submitBtn.textContent = 'Send Message'; return true;      /* Allow re-submission after 2 sec */
                                                                   } catch (error) { console.error('Contact form backend error:', error.message); statusEl.classList.add('show');statusEl.className='form-status error show'; statusEl.textContent='Unable to send your message. Try email directly:'+window.location.origin+'/contacts.html'; submitBtn.disabled = false; submitBtn.textContent = 'Send Message'; return false; }    
                                                                  
                                                                }   /* END: else block for empty validation check */
                                                              }    

                                                          function clearInputFields() {  contactSection.querySelectorAll('#name,#email,#message').forEach(el=>el.value='');    }

                                                           // Attach form submit listener + event delegation for inline field validations per input type (email/name) separately! 
                                                            form.addEventListener('submit', async function(e) { e.preventDefault(); if(validateForm()) await submitToBackend(Object.fromEntries(new FormData(form).entries()));     } ); 
                                                  
                                                        // Per-field blur validation listeners for name/email/message fields: show errors inline immediately on user input
                                                          [form.querySelector('#name'),form.querySelector('#email'),form.querySelector('#message')].forEach((el,idx) => { el.addEventListener('blur' , () => { if (!validateField(el,['name','email','message'][idx])) return;  statusEl.textContent=''; statusEl.classList.remove('show'); });    el.addEventListener('input', () => { if (el.value.trim().length===0) validateField(el,idx === 2?'message':['name','email'][idx]); statusEl.classList.remove('show');statusEl.textContent=''; } );});  // Both blur + input events trigger validation updates

                                                    /* Init: Attach initial form listener when DOM loaded! (no need for manual bind — use event delegation here instead) */
                                                      contactSection.querySelector('button[type="submit"]').addEventListener('click', () => { if(!validateForm()) return; submitToBackend(Object.fromEntries(new FormData(contactSection.querySelector('form')).entries())); });    // Click handler also works!

                                                   })();   /* END: closure to avoid leaking variables globally (no need for global scope pollution) */
                                                     alert('Contact form ready! Try submitting now.');      // Debug message for developers to know loaded successfully.
