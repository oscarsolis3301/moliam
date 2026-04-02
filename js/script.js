// ===== Moliam Contact Form Handler =====

document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;

     function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
     }

   // Form submission handler with client-side validation + Discord webhook
    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData.entries());
     
        let valid = true;

         if (!data.name || data.name.trim().length < 2) { showError('Full name required (min 2 chars)', 'name'); valid = false; }
         if (!data.email || !validateEmail(data.email)) { showError('Valid email required', 'email'); valid = false; }
        if (data.phone && /\D/.test(data.phone.replace(/\D/g, '').length <10)) { showError('Invalid phone number', 'phone'); valid=false;}
       
       if (!data.message || data.message.trim().length < 10) { showError('Message must be at least 10 chars', 'message'); valid = false; }

        if (valid) { handleSubmission(data); }
     });

    function showError(msg, id) {
        const inp = document.getElementById(id);
        if(inp){ inp.style.borderColor='#ef4444'; toast(msg,'error'); setTimeout(()=>inp.style.borderColor='',3000); }
     }

    function toast(text, type='error') {
        const t = document.createElement('div');
        t.textContent=text; 
        t.style.cssText=`position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:${type==='error'?'#ef4444':'#10b981'};color:white;padding:12px 24px;border-radius:8px;z-index:10000;`;
        document.body.append(t); setTimeout(()=>t.remove(),3000);
     }

    async function handleSubmission(data) {
         const btn = contactForm.querySelector('button[type="submit"]');
         if (btn){ btn.disabled=true; btn.textContent='Sending...'; }

        try {
             // PRIMARY SEND TO DISCORD WEBHOOK - Configure via environment variable or config file
               const webhook_url = window.DISCORD_WEBHOOK_URL || null;  // Set in env.local or runtime

                if (webhook_url) {
                    await fetchWebhook(webhook_url, data);
                  }

             // LOCAL FALLBACK: Store submissions as JSON array in localStorage
                 storeSubmissionsLocally(data);

           // Success feedback to user
            submitSuccess();

          contactForm.reset();

        } catch(err) { console.error('Form error:', err); alert('Error sending. Try again.'); if(btn){ btn.disabled=false; btn.textContent='Send Message';}}
       
       if (btn){ btn.disabled=false; btn.textContent='Send Message';}
     }

    async function fetchWebhook(url, data) {
         const embed={ title:'📬 New Lead - Moliam',color:16803794,fields:[{name:'Name',value:data.name||'N/A',inline:true},{name:'Email',value:data.email||'N/A',inline:true},null,{name:'Message',value:data.message||'',inline:false}],timestamp:new Date().toISOString()};
         const resp = await fetch(url, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:null,embeds:[embed],username:'Moliam'});

            if(!resp.ok)throw new Error('Discord API error');

            return true;

    function storeSubmissionsLocally(data) {
        const arr=JSON.parse(localStorage.getItem('moliam_submissions')||'[]');
         arr.push({...data,timestamp:new Date().toISOString()});
            localStorage.setItem('moliam_submissions', JSON.stringify(arr));
            console.log('Local storage updated:', arr);

   }

    function submitSuccess() { const msg = `✓ Message sent! We'll be in touch within 24 hours.`;toast(msg,'success');}

       // Field blur validation (basic)
        document.querySelectorAll('#contactForm input, #contactForm textarea').forEach(i=>{i.addEventListener('blur',()=>{if(i.validationMessage)i.style.borderColor='#ef4444';});});

     });

    // Export for external use
    window.MoliamContactHandler = { validateEmail, showError, handleSubmission };
