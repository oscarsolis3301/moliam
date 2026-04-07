/**
 * Lead Capture Widget - Integrated HTML form with real-time scoring visualization
 */

(function() {
  const widgetDiv = document.createElement('div');
  widgetDiv.id = 'moliam-lead-widget';
  
  widgetDiv.innerHTML = `
    <style>
      #moliam-lead-widget { position: fixed; bottom: 20px; right: 20px; z-index: 1000; }
      #lead-capture-btn {
        background: linear-gradient(135deg, #3B82F6, #8B5CF6);
        color: white; border: none; padding: 14px 28px; border-radius: 10px;
        font-weight: 700; letter-spacing: 0.05em; cursor: pointer; box-shadow: 0 6px 20px rgba(59,130,246,0.3);
      }
      #lead-capture-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(59,130,246,0.4); }
      #lead-form-modal { display: none; position: fixed; inset: 0; background: rgba(11,14,20,0.95); z-index: 1001; align-items: center; justify-content: center; }
      .modal-content { background: var(--bg-room); border: 1px solid var(--border-room); border-radius: 12px; padding: 32px; max-width: 540px; width: 90%; }
       .form-group { margin-bottom: 20px; }
       .form-label { font-size: 12px; text-transform: uppercase; color: var(--text-dim); letter-spacing: 0.05em; margin-bottom: 8px; display: block; }
       .form-input, .form-select, .form-textarea { width: 100%; background: #111827; border: 1px solid var(--border-room); color: var(--text-primary); padding: 12px 16px; border-radius: 8px; font-size: 14px; }
       .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--accent-blue); outline: none; }
       .form-textarea { min-height: 80px; resize: vertical; }
       .score-preview { background: #1f2937; border-left: 4px solid #10b981; padding: 16px; margin-top: 20px; border-radius: 8px; }
       .score-value { font-size: 32px; font-weight: 700; color: var(--accent-green); }
       .close-btn { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text-dim); font-size: 24px; cursor: pointer; }
       .submit-btn { width: 100%; margin-top: 24px; background: var(--accent-green); color: white; border: none; padding: 16px; font-weight: 700; border-radius: 8px; cursor: pointer; transition: all 0.3s; }
       .submit-btn:hover { background: #05966a; transform: translateY(-2px); }
       .hidden { display: none !important; }
       .error-msg { color: var(--accent-red); font-size: 12px; margin-top: 4px; }
     </style>

     <button id="lead-capture-btn" onclick="toggleLeadForm()">🎯 New Lead Inquiry</button>
    
    <div id="lead-form-modal">
      <div class="modal-content">
        <button class="close-btn" onclick="toggleLeadForm()">&times;</button>
        
        <h2 style="margin-bottom: 8px; color: var(--accent-blue);">New Lead Capture</h2>
        <p style="color: var(--text-dim); font-size: 13px;">Submit your project inquiry - auto-scored within 5 minutes of sending.</p>
        
         <form id="lead-capture-form" onsubmit="submitLead(event)">
           <div class="form-group">
             <label class="form-label">Your Name</label>
             <input type="text" id="lead-name" class="form-input" required />
           </div>

           <div class="form-group">
             <label class="form-label">Email Address</label>
             <input type="email" id="lead-email" class="form-input" required />
           </div>

           <div class="form-group">
             <label class="form-label">Company Name (optional)</label>
             <input type="text" id="lead-company" class="form-input" placeholder="Freelance if individual" />
           </div>

           <div class="form-group">
             <label class="form-label">Project Scope</label>
             <select id="lead-scope" class="form-select" required>
               <option value="">Select project type...</option>
               <option value="web-development">Web Development (React/Vue/Svelte)</option>
               <option value="ai-automation">AI-Powered Automation</option>
               <option value="analytics-platform">Analytics & Dashboard Build</option>
               <option value="api-integration">API Integration Services</option>
               <option value="other">Other - Describe below</option>
             </select>
           </div>

           <div class="form-group">
             <label class="form-label">Budget Range</label>
             <select id="lead-budget" class="form-select" required>
               <option value="$5k-$10k">$5,000 - $10,000</option>
               <option value="$10k-$25k">$10,000 - $25,000</option>
               <option value="$25k+">$25,000+</option>
               <option value="under-5k">Under $5,000</option>
             </select>
           </div>

           <div class="form-group">
             <label class="form-label">Industry/Vertical</label>
             <input type="text" id="lead-industry" class="form-input" placeholder="e.g., fintech, healthcare, saas" />
           </div>

           <div class="form-group">
             <label class="form-label">Urgency Level</label>
             <select id="lead-urgency" class="form-select" required>
               <option value="medium">Medium - Planning phase</option>
               <option value="high">High - 30-day deadline active</option>
               <option value="critical">Critical - Immediate deployment needed</option>
             </select>
           </div>

           <div class="form-group">
             <label class="form-label">Your Message & Pain Points</label>
             <textarea id="lead-message" class="form-textarea" placeholder="Describe your project needs, pain points, and what success looks like..." required></textarea>
           </div>

           <div id="score-preview-container" class="hidden">
             <h4 style="color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.1em; font-size: 12px;">Lead Score Preview (Calculated Instantly)</h4>
             <div class="score-value"><span id="lead-score-value">0</span>/100</div>
             <p style="color: var(--text-dim); font-size: 13px; margin-top: 8px;">
              Score updated in real-time as you type. HOT leads (75+) get instant human follow-up within 5 minutes.
             </p>
           </div>

           <button class="submit-btn" id="lead-submit-btn">Send Inquiry → Auto-Score It!</button>
         </form>
       </div>
     </div>
    
    <style>:root { --bg-room: #1F2937; --border-room: #374151; --text-primary: #F9FAFB; --text-dim: #9CA3AF; --accent-blue: #3B82F6; --accent-green: #10B981; }</style>
   `;

  document.body.appendChild(widgetDiv);

  let leadScore = 40; // default base score

  const scoreInputs = ['lead-budget', 'lead-urgency', 'lead-industry', 'lead-message'];
  scoreInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => updateLeadScore());
    }
  });

  function toggleLeadForm() {
    const modal = document.getElementById('lead-form-modal');
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
  }

  function updateLeadScore() {
    const budgetVal = document.getElementById('lead-budget').value;
    let score = 40;

    if (budgetVal === '$10k-$25k') score += 18;
    else if (budgetVal === '$25k+') score += 23;
    else if (budgetVal === '$5k-$10k') score += 12;
    else if (budgetVal === 'under-5k') score += 5;

    const urgencyVal = document.getElementById('lead-urgency').value;
    if (urgencyVal === 'critical') score += 28;
    else if (urgencyVal === 'high') score += 18;
    else score += 10;

    const industryValue = document.getElementById('lead-industry').value.toLowerCase();
    if (/tech|saas|ai|startup/i.test(industryValue)) score += 16;
    else if (/finance|fintech/i.test(industryValue)) score += 14;

    const messageVal = document.getElementById('lead-message').value.toLowerCase();
    if (/urgent|deadline|asap|immediate|\b30\s*days\b/i.test(messageVal)) {
      score += 8;
      }

    leadScore = Math.min(100, score);

    const scoreContainer = document.getElementById('score-preview-container');
    const scoreValue = document.getElementById('lead-score-value');
    if (leadScore >= 75) {
      scoreContainer.classList.remove('hidden');
      scoreValue.textContent = leadScore;
      scoreValue.style.color = '#ef4444';
    } else {
      scoreContainer.classList.add('hidden');
      scoreValue.style.color = '#10b981';
      scoreValue.textContent = leadScore;
    }

    return leadScore;
  }

  async function submitLead(e) {
    e.preventDefault();

    const form = {
      name: document.getElementById('lead-name').value,
      email: document.getElementById('lead-email').value,
      company: document.getElementById('lead-company').value || null,
      scope: document.getElementById('lead-scope').value,
      budget: document.getElementById('lead-budget').value,
      industry: document.getElementById('lead-industry').value,
      urgency_level: document.getElementById('lead-urgency').value,
      message: document.getElementById('lead-message').value,
    };

    const submitBtn = document.getElementById('lead-submit-btn');
    submitBtn.textContent = '🔄 Sending and scoring...';
    submitBtn.disabled = true;

    try {
      const response = await fetch('/api/lead-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const result = await response.json();

      if (result.success) {
        toggleLeadForm();
        alert(`Success! Lead submitted with score ${result.leadScore}/100. You'll receive a confirmation email within 5 minutes.`);
        submitBtn.textContent = 'Lead Sent ✓';
      } else {
        throw new Error(result.message || 'Submission failed');
      }

    } catch (err) {
      alert('Error submitting lead. Please try again or contact hello@moliam.com directly.');
      console.error('Lead submission error:', err);
      submitBtn.textContent = 'Retry Submission';
    } finally {
      submitBtn.disabled = false;
    }
  }

  window.toggleLeadForm = toggleLeadForm;
  window.updateLeadScore = updateLeadScore;
  window.submitLead = submitLead;
})();
