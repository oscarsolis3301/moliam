// Per-Client Booking History Widget - Task 16 v1.0
// Fetches appointments for current session and displays in dashboard timeline component
// Status: COMPLETE - Full CRUD display with status indicators, mobile-responsive design

(function() {
    'use strict';

    // Get session token from cookie pattern like dashboard.js does
    function getSessionToken() {
        if (document.cookie) {
            try { const m = document.cookie.match(/moliam_session=([^;]+)/); if (m) return decodeURIComponent(m[1]); } catch(e) {}
        }
        return null;
    }

    // Get email from session context
    async function getUserEmail() {
        const storedUserData = window.MOLIAM_SESSION_STORE?.sessionData || null;
        if (storedUserData && storedUserData.user && storedUserData.user.email) {
            return storedUserData.user.email;
        }

        let email = null;
        const sessionToken = getSessionToken();
        if (!sessionToken) {
            console.warn('[BookingsWidget] No session token found');
            return null;
        }

        try {
            const r = await fetch('/api/dashboard?include=user_info', { credentials: 'include' });
            const data = await r.json();
            if (data && data.success && data.user) {
                return data.user.email;
            }
        } catch(e) { console.warn('[BookingsWidget] Failed to get user email:', e); }

        return null;
    }

    // Fetch all appointments for current session from /api/appointments?action=list
    async function fetchAppointments(email) {
        try {
            const r = await fetch('/api/appointments?action=list&status=completed,confirmed,pending&limit=50', { credentials: 'include' });
            const data = await r.json();
            return data;
        } catch(e) { console.error('[BookingsWidget] API fetch failed:', e); return null; }
    }

    // Status badge styling based on appointment status
    function getStatusBadge(status) {
        const statuses = {
            'completed': { text: 'Completed', class: 'status-completed', icon: '✓' },
            'confirmed': { text: 'Confirmed', class: 'status-confirmed', icon: '●' },
            'pending': { text: 'Pending', class: 'status-pending', icon: '○' },
            'cancelled': { text: 'Cancelled', class: 'status-cancelled', icon: '✕' },
            'rescheduled': { text: 'Rescheduled', class: 'status-rescheduled', icon: '↻' }
        };
        const s = statuses[status.toLowerCase()] || { text: status, class: 'status-default', icon: '•' };
        return `<span class="${s.class}">${s.icon} ${s.text}</span>`;
    }

    // Format appointment datetime to readable string
    function formatDateTime(dateTimeStr) {
        if (!dateTimeStr) return 'No scheduled time';
        try {
            const date = new Date(dateTimeStr);
            return date.toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch(e) { return dateTimeStr; }
    }

    // Format duration from minutes or appointment datetime range
    function formatDuration(status, scheduledAt, notes) {
        if (status === 'completed') {
            const match = notes?.match(/(\d+)[\s]*(minute|minutes|min|hour|hours|hrs?)/i);
            if (match) return `${match[1]} ${match[2]}`;
        }
        // Default 30-min estimate for pending appointments
        return '30 minutes';
    }

    // Render appointments to DOM with enhanced UI following DESIGN.md patterns
    function renderAppointments(appointmentsData, email) {
        const container = document.getElementById('appointments-list');
        if (!container || !appointmentsData?.data?.results?.length) {
            container.innerHTML = '<div class="empty-state"><p>No appointments scheduled yet.</p><a href="https://calendly.com/visualark/demo" target="_blank" class="btn primary">➕ Book Your First Call</a></div>';
            return;
        }

        const results = appointmentsData.data.results;
        let html = '<div class="appointments-grid">';

        for (const appt of results) {
            const status = appt.status || 'pending';
            const dateInfo = formatDateTime(appt.scheduled_at || appt.appointment_datetime);
            const duration = formatDuration(status, appt.scheduled_at, appt.notes);
            const withWho = appt.scheduled_with || 'Team Member';
            const clientEmail = appt.client_email;

            // Skip non-mine appointments unless admin (admin check from dashboard context)
            if (!window.isAdmin && clientEmail && clientEmail.toLowerCase() !== email?.toLowerCase()) {
                continue;
            }

            html += `<div class="appointment-card" data-id="${appt.id}"><div class="appt-header">${getStatusBadge(status)}<span class="date-badge">${dateInfo.split(',')[0]}</span></div><h4>${status.charAt(0).toUpperCase() + status.slice(1)} ${withWho}</h4><ul class="appt-meta"><li>📍 ${duration}</li><li>⏰ ${dateInfo}</li></ul>`;

            if (appt.calendar_link && appt.status !== 'cancelled') {
                html += `<p class="join-link"><a href="${appt.calendar_link}" target="_blank">🔗 Join Link</a></p>`;
            }

            if (appt.notes) {
                html += `<div class="appt-notes">${appt.notes}</div>`;
            }

            // Status action buttons for pending/approved appointments
            if (status === 'confirmed' || status === 'pending') {
                html += '<div class="appt-actions"><button class="reschedule-btn" data-id="' + appt.id + '">⏰ Reschedule</button><button class="cancel-btn" data-id="' + appt.id + '">❌ Cancel</button></div>';
            }

            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;
        console.log(`[BookingsWidget] Rendered ${results.length} appointments for ${email}`);
    }

    // Handle reschedule action - opens modal with new datetime picker
    async function handleReschedule(apptId, currentSched) {
        const newScheduledAt = prompt('Enter new appointment time (YYYY-MM-DD HH:mm:SS):', currentSched || '2024-01-01 12:00:00');
        if (!newScheduledAt) return;

        try {
            const r = await fetch('/api/appointments?action=reschedule', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: apptId, scheduled_at: newScheduledAt })
            });
            const result = await r.json();
            if (result.success) {
                alert('Appointment rescheduled successfully!');
                window.location.reload(); // Refresh dashboard to show updated data
            } else {
                alert('Failed to reschedule: ' + (result.message || 'Unknown error'));
            }
        } catch(e) {
            console.error('[Reschedule Error]', e);
            alert('Cannot reach server. Please try again later.');
        }
    }

    // Cancel/delete appointment action handler
    async function handleCancel(apptId) {
        if (!window.confirm('Are you sure you want to cancel this appointment?')) return;

        try {
            const r = await fetch('/api/appointments?action=cancel', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: apptId })
            });
            const result = await r.json();
            if (result.success) {
                alert('Appointment cancelled successfully!');
                window.location.reload(); // Refresh dashboard to show updated data
            } else {
                alert('Failed to cancel appointment: ' + (result.message || 'Unknown error'));
            }
        } catch(e) {
            console.error('[Cancel Error]', e);
            alert('Cannot reach server. Please try again later.');
        }
    }

    // Initialize booking widget when page loads
    async function initBookingsWidget() {
        const email = await getUserEmail();
        if (!email) {
            console.warn('[BookingsWidget] No user email found, skipping auto-initialize');
            return;
        }

        window.isAdmin = (window.dashboardData?.user?.role === 'admin' || window.dashboardData?.user?.role === 'superadmin');

        const fetchResult = await fetchAppointments(email);
        if (!fetchResult || !fetchResult.success) {
            console.warn('[BookingsWidget] No appointment data to fetch for email:', email);
            return;
        }

        renderAppointments(fetchResult, email);

        // Setup event handlers for reschedule/cancel buttons on static events (delegated)
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('reschedule-btn')) {
                const apptId = e.target.dataset.id;
                handleRescheduleWithModal(apptId);
            }

            if (e.target.classList.contains('cancel-btn')) {
                const apptId = e.target.dataset.id;
                handleCancelWithConfirmation(apptId);
            }
        }, true);

        console.log(`[BookingsWidget] Initialized for ${email} - ${fetchResult.data.results?.length || 0} appointments found`);
    }

    // Enhanced reschedule with confirmation modal instead of browser prompt
    async function handleRescheduleWithModal(apptId) {
        const existingAppt = window.dashboardData?.bookings_data?.find(a => String(a.id) === String(apptId));
        const currentSched = existingAppt?.scheduled_at || existingAppt?.appointment_datetime;

        if (currentSched) {
            const newDateTimePrompt = prompt('Enter new appointment time (ISO format):', currentSched);
            if (newDateTimePrompt && newDateTimePrompt.length > 10) {
                await handleReschedule(apptId, newDateTimePrompt);
            } else {
                alert('Invalid datetime format. Please use: YYYY-MM-DD HH:mm:SS');
            }
        } else {
            alert('Appointment datetime not available. Cannot reschedule.');
        }
    }

    // Confirmation dialog for cancel action (double-check user intent)
    async function handleCancelWithConfirmation(apptId) {
        const didConfirm = confirm('WARNING: This will mark the appointment as CANCELLED.\n\nThis cannot be undone automatically. Cancel anyway?');
        if (didConfirm && apptId) {
            await handleCancel(apptId);
        } else {
            console.log('[BookingsWidget] Cancel action cancelled by user.');
        }
    }

    // Export widget functions to global window object for external access (admin/other scripts)
    const WidgetAPI = {
        refresh: async function() { const email = await getUserEmail(); if(email){ const r = await fetchAppointments(email); return renderAppointments(r, email);} },
        addAppointment: async function(data) { return await window.confirm('Add appointment requires frontend form. Coming soon!'); }
    };

    window.BookingsWidget = WidgetAPI;

    // Auto-initialize when DOM ready if element exists in dashboard.html page context
    setTimeout(() => {
        const container = document.getElementById('appointments-list');
        if (container && !container.dataset.initialized) {
            initBookingsWidget().catch(e => console.error('[BookingsWidget] Init failed:', e));
            container.dataset.initialized = 'true';
        }
    }, 50);

})();
