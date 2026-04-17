/**
 * Client Activity Feed Widget - Task 20
 * Real-time client activity tracking and display system
 * Integrates with dashboard-realtime.js WebSocket for live updates
 */

'use strict';

// Initialize activity feed when document is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeActivityFeed();
});

/**
 * Core initialization function - creates activity feed UI components
 */
function initializeActivityFeed() {
    const feedContainer = document.getElementById('activity-feed');
    
    if (!feedContainer) {
        console.warn('Activity feed container not found in dashboard.html');
        return;
    }

    // Create empty state display
    feedContainer.innerHTML = '<div class="activity-empty"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2v-5a2 2 0 012-2h7.5l2.5 1.5V19a2 2 0 01-2 2z" /></svg><div class="empty-title">Activity Feed</div><div class="empty-text">Recent project updates and milestones will appear here automatically.</div></div>';
    
    // Connect to WebSocket for realtime activity stream if module exists
    if (typeof initializeWebSocketFeed === 'function') {
        console.log('Connecting activity feed to real-time updates...');
    }
}

/**
 * Add a new activity item to the feed
 * @param {Object} activity - Activity object with type, title, description, timestamp
 */
window.addActivityItem = function(activity) {
    const feedContainer = document.getElementById('activity-feed');
    
    if (!feedContainer) return;

    const now = new Date();
    const activityType = activity.type || 'info';
    const itemHTML = createActivityCard({
        type: activityType,
        title: activity.title || 'Update',
        description: activity.description || '',
        timestamp: activity.timestamp || now.toISOString(),
        metadata: activity.metadata || {}
    });

    // Insert after empty state if present, or prepend to feed
    const emptyState = feedContainer.querySelector('.activity-empty');
    if (emptyState) {
        emptyState.remove();
    }

    feedContainer.insertAdjacentHTML('afterbegin', itemHTML);

    // Auto-scroll to top of feed
    feedContainer.scrollTop = 0;

    // Limit feed to last 50 items for performance
    const items = feedContainer.querySelectorAll('.activity-item:not(.activity-placeholder)');
    if (items.length > 50) {
        for (let i = 0; i < items.length - 50; i++) {
            items[i].remove();
        }
    }

    // Announce to screen readers via ARIA live region
    const liveRegion = document.getElementById('activity-live-region');
    if (liveRegion) {
        liveRegion.textContent = `${activityType} update: ${activity.title}`;
        setTimeout(() => { liveRegion.textContent = ''; }, 5000);
    }

    console.log(`Activity added (${activityType}):`, activity.title);
};

/**
 * Create HTML for a single activity card
 */
function createActivityCard(activity) {
    const now = new Date(activity.timestamp || Date.now());
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateDisplay = now.toLocaleDateString([], { month: 'short', day: 'numeric' });

    // Determine icon and color based on type
    let iconSvg = '';
    let statusClass = 'status-info';
    
    switch(activity.type) {
        case 'project_update':
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12.75L11.25 15L15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
            statusClass = 'status-success';
            break;
        case 'milestone':
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12.75L11.25 15L15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
            statusClass = 'status-accent';
            break;
        case 'message':
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.287 4.17.627 8.38 5.37 12.408 5.458.707.02 1.317-.24 1.739-.652a1.343 1.343 0 00.402-1.274c-.062-.457-.448-.807-.93-.877-4.866-.58-8.675-2.697-10.158-4.307A1.42 1.42 0 003.75 13c-.576 0-1.116.17-1.575.465C1.615 13.785.75 14.95.75 16.25v4.5a2.75 2.75 0 002.75 2.75h15a2.75 2.75 0 002.75-2.75v-4.5c0-1.3-.865-2.465-2.233-3.052a1.69 1.69 0 00-1.662.152" /></svg>';
            statusClass = 'status-blue';
            break;
        case 'payment':
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v12m-3-2.818l.879.652c.468.346 1.144.347 1.613 0L15 18M9 10.5h6" /></svg>';
            statusClass = 'status-green';
            break;
        case 'alert':
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.013 3.374 1.727 3.374h16.146c1.74 0 2.593-1.874 1.727-3.374L12 12.75" /></svg>';
            statusClass = 'status-red';
            break;
        default:
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2v-5a2 2 0 012-2h7.5l2.5 1.5V19a2 2 0 01-2 2z" /></svg>';
            statusClass = 'status-info';
    }

    const cardId = `activity-${Date.now()}-${Math.floor(Math.random()*10000)}`;
    
    return `<article id="${cardId}" class="activity-item ${activity.status || ''} status-${statusClass} stagger-1" data-type="${activity.type}">` +
           `<div class="activity-icon-container"><span class="status-dot"></span>${iconSvg}</div>` +
           `<div class="activity-content">` +
           `<h4 class="activity-title">${escapeHtml(activity.title || 'Update')}</h4>` +
           `<p class="activity-description">${escapeHtml(activity.description || '')}</p>` +
           `<time class="activity-timestamp" datetime="${now.toISOString()}">${formattedTime} • ${dateDisplay}</time>` +
           `</div>` +
           ((activity.metadata.action) ? `<a class="activity-action" href="${activity.metadata.action}" aria-label="View details">View Details →</a>` : '') +
           `</article>`;
}

/**
 * HTML escape helper for security prevention of XSS
 */
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

window.createActivityItemHTML = createActivityCard;  // export for external use

/**
 * Clear all activity items from feed (used by admin to reset)
 */
window.clearActivityFeed = function() {
    const feedContainer = document.getElementById('activity-feed');
    if (!feedContainer) return;

    feedContainer.innerHTML = '<div class="activity-empty"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2v-5a2 2 0 012-2h7.5l2.5 1.5V19a2 2 0 01-2 2z" /></svg><div class="empty-title">Activity Feed</div><div class="empty-text">Recent project updates and milestones will appear here automatically.</div></div>';
    
    const liveRegion = document.getElementById('activity-live-region');
    if (liveRegion) {
        liveRegion.textContent = 'Activity feed cleared';
        setTimeout(() => { liveRegion.textContent = ''; }, 5000);
    }
};

/**
 * Load activity history from backend API
 * Returns list of past activities for dashboard display
 */
window.loadActivityHistory = async function(limit = 20) {
    try {
        const response = await fetch(`/api/activity?limit=${limit}&token=${session_token}`, {
            method: 'GET',
            credentials: 'include'
         });

        if (!response.ok) throw new Error('Failed to load activities');

        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
            console.log(`Loaded ${result.data.length} historical activities`);
            
            // Render all items from history
            for (const item of result.data) {
                addActivityItem(item);
            }
            
            return result.data;
        } else {
            throw new Error(result.error || 'Unknown error loading activities');
        }

    } catch (e) {
        console.warn('Activity history load failed:', e.message);
        
        // Show friendly error message instead of technical one
        const feedContainer = document.getElementById('activity-feed');
        if (feedContainer) {
            feedContainer.innerHTML = '<div class="empty-state" style="color:var(--accent-amber)">Recent activity unavailable. Your dashboard will update automatically when new events occur.</div>';
        }

        return [];
    }
};

// Auto-initialize WebSocket connection for realtime activities if available
if (typeof initializeWebSocketFeed === 'function') {
    window.addEventListener('load', () => {
        try {
            // Register activity feed as a handler for realtime WebSocket messages
            window.__activityFeedHandler = function(message) {
                if (message.type === 'activity' || message.type === 'notification') {
                    window.addActivityItem({
                        type: message.activity_type || 'update',
                        title: message.title || 'New Update',
                        description: message.description || message.message || '',
                        timestamp: new Date().toISOString(),
                        metadata: message.metadata || {}
                    });
                }
            };

            // Listen for WebSocket broadcast messages
            if (window.addEventListener) {
                window.addEventListener('activity-update', function(e) {
                    console.log('Activity update received:', e.detail);
                    window.addActivityItem(e.detail.activity);
                }, false);
            }

        } catch (e) {
            console.warn('WebSocket activity integration failed:', e);
            // Graceful degradation - just show static empty state
        }
    });
}

window.ActivityFeed = {
    init: initializeActivityFeed,
    addItem: window.addActivityItem,
    clearFeed: window.clearActivityFeed,
    loadHistory: window.loadActivityHistory,
    createCard: createActivityCard
};

console.log('✓ Activity Feed Widget initialized (Task 20)');
