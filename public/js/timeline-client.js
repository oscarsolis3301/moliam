// Unified Client Timeline UI Component - Task 11 Mobile v2
// Integrated Timeline Renderer for client history aggregation (submissions, appointments, messages, invoices)
// Status: COMPLETE - Full timeline view with filterable types, pagination support

(function() {
    'use strict';

    // Timeline event type icons and colors
    const TYPE_CONFIG = {
        submission: { icon: '📝', color: '--accent-blue', label: 'Submission' },
        appointment_scheduled: { icon: '📅', color: '--accent-green', label: 'Appointment' },
        message_sent: { icon: '💬', color: '--accent-amber', label: 'Message' },
        invoice_generated: { icon: '⚡', color: '--accent-purple', label: 'Invoice' }
    };

    // Load unified timeline from /api/contact-timeline endpoint
    async function loadUnifiedTimeline(params = {}) {
        const email = params.email;
        const clientId = params.clientId;
        const limit = params.limit || 50;
        const offset = params.offset || 0;
        const filterType = params.type; // options: 'all' | 'submissions' | 'appointments' | 'messages' | 'invoices'

        let url = '/api/contact-timeline?limit=' + limit + '&offset=' + offset;
        if (email) { url += '&email=' + encodeURIComponent(email); }
        else if (clientId) { url += '&clientId=' + encodeURIComponent(clientId); }
        if (filterType && filterType !== 'all') { url += '&type=' + filterType; }

        try {
            const r = await fetch(url, { credentials: 'include' });
            return await r.json();
        } catch (e) {
            console.error('[Timeline API Error]', e);
            return { success: false, message: 'Failed to load timeline data.' };
        }
    }

    // Render unified timeline events to DOM
    function renderTimelineContainer(events, totalEvents, options = {}) {
        const container = document.getElementById('timeline-v2') || createTimelineContainer();
        
        if (!events || !events.length) {
            container.innerHTML = '<div class="empty-state">No timeline events found for this client.</div>';
            return;
        }

        let html = '<div class="vscroll-container">';
        
        for (const evt of events) {
            const cfg = TYPE_CONFIG[evt.type] || { icon: '•', color: '--text-secondary', label: 'Event' };
            const summary = evt.summary || evt.description || 'No details provided';
            const timestamp = evt.timestamp ? new Date(evt.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown time';
            
            html += '<div class="v-event"><div class="v-icon">' + cfg.icon + '</div><div class="v-content"><h4>' + (evt.title || cfg.label) + '</h4><p style="color:var(--text-primary);font-weight:500;">' + summary + '</p><span class="v-meta">• ' + timestamp + '</span></div></div>';
        }

        html += '</div>';
        
        // Add pagination controls if more events exist
        const hasMore = options.hasMore || totalEvents > limit;
        if (hasMore) {
            html += '<div class="pagination-controls"><button id="load-more" class="btn secondary" style="width:100%">Load Previous Events</button></div>';
        }

        container.innerHTML = html;
        
        // Hook up load more button
        const loadMoreBtn = document.getElementById('load-more');
        if (options.onLoadMore && loadMoreBtn) {
            loadMoreBtn.addEventListener('click', options.onLoadMore);
        }
    }

    // Create timeline container element in DOM
    function createTimelineContainer() {
        let timelineV2 = document.getElementById('timeline-v2');
        if (timelineV2) return timelineV2;

        const section = document.createElement('div');
        section.className = 'section timeline-section';
        section.id = 'client-history-section';
        
        const html = '<div class="timeline-header"><h3>Complete Client History</h3><div class="timeline-controls"><select id="type-filter" aria-label="Filter by type"><option value="all">All Events</option><option value="submissions">Submissions Only</option><option value="appointment_scheduled">Appointments Only</option><option value="message_sent">Messages Only</option><option value="invoice_generated">Invoices Only</option></select><button id="refresh-timeline" class="btn primary" style="padding:8px 16px">🔄 Refresh</button></div></div><div id="timeline-v2"></div>';
        section.innerHTML = html;

        const timelineOld = document.getElementById('timeline');
        if (timelineOld && timelineOld.parentNode) {
            timelineOld.parentNode.replaceChild(section, timelineOld);
        } else {
            document.querySelector('.container').appendChild(section);
        }

        return section.querySelector('#timeline-v2');
    }

    // Initialize pagination state for the timeline module
    let paginationState = {
        currentOffset: 0,
        hasMore: true,
        clientEmail: null,
        clientId: null
    };

    // Handle load more events click
    async function handleLoadMore(eventsLoaded) {
        const newOffset = paginationState.currentOffset + 50;
        if (newOffset >= (eventsLoaded.totalEvents || 9999)) {
            paginationState.hasMore = false;
            console.log('[Timeline] No more events to load.');
            return;
        }

        paginationState.currentOffset = newOffset;
        
        const params = {};
        if (paginationState.clientEmail) params.email = paginationState.clientEmail;
        if (paginationState.clientId) params.clientId = paginationState.clientId;
        const typeFilter = document.getElementById('type-filter')?.value || 'all';
        if (typeFilter !== 'all') params.type = typeFilter;

        const result = await loadUnifiedTimeline({ ...params, limit: 50, offset: newOffset });
        
        if (!result || !result.success || !result.data) {
            Toast.error('Failed to load more timeline events.');
            return;
        }

        const container = document.getElementById('timeline-v2');
        if (!container) return;

        let existingHTML = '';
        for (const evt of result.data.timeline || []) {
            const cfg = TYPE_CONFIG[evt.type] || { icon: '•', color: '--text-secondary', label: 'Event' };
            const summary = evt.summary || evt.description || 'No details provided';
            const timestamp = evt.timestamp ? new Date(evt.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown time';
            
            existingHTML += '<div class="v-event"><div class="v-icon">' + cfg.icon + '</div><div class="v-content"><h4>' + (evt.title || cfg.label) + '</h4><p style="color:var(--text-primary);font-weight:500;">' + summary + '</p><span class="v-meta">• ' + timestamp + '</span></div></div>';
        }
        
        document.querySelector('.vscroll-container').innerHTML = existingHTML;

        // Add load more button again if more events exist
        paginationState.hasMore = newOffset + 50 < (result.data.totalEvents || 9999);
        if (paginationState.hasMore) {
            const btn = '<div class="pagination-controls"><button id="load-more" class="btn secondary" style="width:100%">Load Previous Events</button></div>';
            document.querySelector('.vscroll-container').innerHTML += btn;
            document.getElementById('load-more').addEventListener('click', handleLoadMore.bind(null, result.data));
        }
    }

    // Initialize timer when page loads (get user email from dashboard.js context)
    async function initTimelineUI() {
        try {
            const email = await getEmailFromDashboardContext();
            if (!email) {
                console.warn('[Timeline] No email found, skipping auto-load.');
                return;
            }
            
            // Default load: all events for logged-in user's email
            paginationState.clientEmail = email;
            const result = await loadUnifiedTimeline({ email: email, limit: 50, offset: 0 });
            
            if (result && result.success && result.data) {
                paginationState.hasMore = 50 < result.data.totalEvents;
                renderTimelineContainer(result.data.timeline, result.data.totalEvents, {
                    clientEmail: email,
                    hasMore: paginationState.hasMore,
                    onLoadMore: () => handleLoadMore(result.data)
                });

                // Hook up filter and refresh buttons
                const container = document.getElementById('client-history-section');
                if (!container) return;

                const typeFilter = document.getElementById('type-filter');
                if (typeFilter) {
                    typeFilter.addEventListener('change', async () => {
                        const type = typeFilter.value;
                        const newEmail = paginationState.clientEmail || '';
                        const r2 = await loadUnifiedTimeline({ email: newEmail, limit: 50, offset: 0, type: type });
                        renderTimelineContainer(r2.data?.timeline || [], r2.data?.totalEvents || 0);
                    });
                }

                const refreshBtn = document.getElementById('refresh-timeline');
                if (refreshBtn) {
                    refreshBtn.addEventListener('click', () => {
                        paginationState.currentOffset = 0;
                        paginationState.hasMore = true;
                        initTimelineUI().catch(w => {});
                    });
                }

            } else {
                console.log('[Timeline] No timeline data for email:', email);
                const container = createTimelineContainer();
                container.innerHTML = '<div class="empty-state">No client history found.</div>';
            }

        } catch (e) {
            console.error('[Timeline Initialization Error]', e);
        }
    }

    // Retrieve current user email from dashboard context (global window object from dashboard.js)
    async function getEmailFromDashboardContext() {
        if (typeof window === 'undefined') return null;
        
        // Try to get global reference that dashboard.js creates
        const authData = window.dashboardAuth || {};
        if (authData && authData.user && authData.user.email) {
            return authData.user.email;
        }

        // Fallback: try cookies pattern
        let email = null;
        if (document.cookie) {
            try {
                const match = document.cookie.match(/moliam_session=([^;]+)/);  


                if (!match || !window.MOLIAM_SESSION_STORE) return null;
                
                const sessionToken = match[1];
                const storedSession = window.MOLIAM_SESSION_STORE.sessionToken === sessionToken ? window.MOLIAM_SESSION_STORE : null;

                if (storedSession && storedSession.userEmail) {
                    email = storedSession.userEmail;
                }

            } catch (e) {}
        }

        // If no email found, try checking if there's a global variable from dashboard.js load
        if (!email && typeof window.dashboardData !== 'undefined') {
            return window.dashboardData?.user?.email || null;
        }

        return email || null;
    }

    // Make public functions accessible globally
    const TimelineAPI = {
        load: function(params) { return loadUnifiedTimeline(params); },
        render: function(events, options) { return renderTimelineContainer(events, events?.length || 0, options); },
        clear: function() { 
            document.getElementById('client-history-section')?.remove(); 
        }
    };
    
    // Export to window for admin panel access
    window.TimelineAPI = TimelineAPI;

    // Auto-initialize when DOM ready only if no conflicting section exists
    setTimeout(() => {
        if (!document.getElementById('timeline-v2')) {
            initTimelineUI().catch(err => console.warn('[Timeline auto-init skipped]', err));
        }
    }, 100);

})();
