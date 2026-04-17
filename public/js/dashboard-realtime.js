// Dashboard Realtime Module - Moliam Project
// WebSocket connection for live dashboard updates, notifications, and auto-refresh
// Provides instant push notifications to connected clients

(function() {
    'use strict';

    let websocket = null;
    let reconnectAttempts = 0;
    let maxReconnectAttempts = 5;
    let reconnectDelay = 1000;
    let lastHeartbeat = Date.now();
    let notificationListeners = [];
    let statsUpdateListeners = [];

    // Initialize WebSocket connection on dashboard load
    function initRealtime() {
        console.log('[MOLIAM-RT] Initializing realtime connection...');
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = protocol + '//' + window.location.host + '/ws/dashboard';

        try {
            websocket = new WebSocket(wsUrl);
            
            websocket.onopen = function(e) {
                console.log('[MOLIAM-RT] WebSocket connection established');
                reconnectAttempts = 0;
                reconnectDelay = 1000;
                
                // Send authentication token for user identification
                const token = document.cookie.replace(/(?:(?:^|.*;\s*)authentication\s*=\s*([^;]*).*$)|^.*$/, '$1');
                if (token) {
                    websocket.send(JSON.stringify({ type: 'auth', token: token }));
                }
                
                // Send heartbeat every 30 seconds
                startHeartbeat();
            };

            websocket.onmessage = function(event) {
                try {
                    const message = JSON.parse(event.data);
                    handleWebSocketMessage(message);
                } catch (e) {
                    console.warn('[MOLIAM-RT] Failed to parse message:', e);
                }
            };

            websocket.onerror = function(error) {
                console.error('[MOLIAM-RT] WebSocket error:', error);
            };

            websocket.onclose = function(e) {
                const wasClean = e.wasClean;
                const code = e.code;
                const reason = e.reason;
                
                console.log('[MOLIAM-RT] Connection closed:', { wasClean, code, reason });
                
                // Attempt reconnection with exponential backoff
                if (!wasClean || code === 1006) {
                    scheduleReconnect();
                }
            };
        } catch (e) {
            console.error('[MOLIAM-RT] WebSocket initialization failed:', e);
            // Graceful fallback to polling if WebSocket not supported
            enableFallbackPolling();
        }
    }

    // Handle incoming WebSocket messages
    function handleWebSocketMessage(message) {
        lastHeartbeat = Date.now();

        switch (message.type) {
            case 'heartbeat':
                // Respond to heartbeat keepalive
                send({ type: 'heartbeat_ack' });
                console.log('[MOLIAM-RT] Heartbeat confirmed');
                break;

            case 'stats_update':
                // Real-time dashboard stats refresh
                notifyStatsUpdate(message.data);
                break;

            case 'project_update':
                // New project created or status changed
                notifyProjectUpdate(message.data);
                break;

            case 'notification':
                // Admin notification to client
                showNotification(message.data);
                break;

            case 'alert':
                // Critical alert (payment due, milestone completed)
                showAlert(message.data);
                break;

            case 'message':
                // Client message from support team
                notifyMessage(message.data);
                break;

            default:
                console.log('[MOLIAM-RT] Unknown message type:', message.type);
        }
    }

    // Send message to WebSocket server
    function send(data) {
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    // Schedule reconnection with exponential backoff
    function scheduleReconnect() {
        if (reconnectAttempts >= maxReconnectAttempts) {
            console.error('[MOLIAM-RT] Max reconnection attempts reached. Falling back to polling.');
            enableFallbackPolling();
            return;
        }

        reconnectAttempts++;
        const delay = Math.min(reconnectDelay * Math.pow(1.5, reconnectAttempts), 30000); // Cap at 30s
        
        console.log('[MOLIAM-RT] Scheduling reconnection attempt #' + reconnectAttempts + ' in ' + delay + 'ms');

        setTimeout(function() {
            initRealtime();
        }, delay);
    }

    // Notify registered listeners of stats updates
    function notifyStatsUpdate(data) {
        console.log('[MOLIAM-RT] Stats update received:', data);
        
        // Trigger UI refresh if listener registered
        for (let i = 0; i < statsUpdateListeners.length; i++) {
            try {
                const listener = statsUpdateListeners[i];
                if (listener.onStatsUpdate) {
                    listener.onStatsUpdate(data);
                } else if (typeof listener === 'function') {
                    listener(data);
                }
            } catch (e) {
                console.warn('[MOLIAM-RT] Stats update listener error:', e);
            }
        }

        // Reload page if manual refresh triggered
        if (data.autoRefresh && window.location.reload) {
            window.location.reload();
        }
    }

    // Notify registered listeners of project updates
    function notifyProjectUpdate(project) {
        console.log('[MOLIAM-RT] Project update received:', project);
        
        for (let i = 0; i < notificationListeners.length; i++) {
            try {
                if (notificationListeners[i].onProjectUpdate) {
                    notificationListeners[i].onProjectUpdate(project);
                }
            } catch (e) {
                console.warn('[MOLIAM-RT] Project update listener error:', e);
            }
        }
    }

    // Show browser notification for important alerts
    function showNotification(notifData) {
        const title = notifData.title || 'Moliam Update';
        const body = notifData.body || 'You have a new notification.';

        console.log('[MOLIAM-RT] Notification:', title, '-', body);

        // Request notification permission if not granted
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission().then(function(permission) {
                if (permission === 'granted') {
                    new Notification(title, { body: body });
                }
            });
        }

        // Also show toast notification in dashboard
        showToast(title, body);
    }

    // Show critical alert modal/popup
    function showAlert(alertData) {
        const title = alertData.title || 'Alert';
        const message = alertData.message || 'Important update.';
        const severity = alertData.severity || 'warning'; // success, warning, error

        console.log('[MOLIAM-RT] Alert:', title, '-', message);

        // Create toast notification with appropriate styling based on severity
        showToast(title, message, severity);

        // For critical alerts, create modal overlay
        if (severity === 'error' && alertData.critical !== false) {
            createAlertModal(title, message);
        }
    }

    // Notify client messages from support team
    function notifyMessage(msgData) {
        const title = 'New Message';
        const body = msgData.body || 'You have a new message.';
        
        console.log('[MOLIAM-RT] Message received:', title, '-', body);
        showNotification({ title: title, body: body });
    }

    // Show toast notification in dashboard UI
    function showToast(title, message, type) {
        const toastId = 'moliam-toast-' + Date.now();
        
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = 'moliam-toast ' + (type || 'info');
        toast.innerHTML = '<strong>' + title + '</strong><p>' + message + '</p>';

        // Append to dashboard body if exists, otherwise create temporary container in head
        const dashboardBody = document.body.querySelector('.container') || document.body;
        dashboardBody.appendChild(toast);

        // Auto-hide after 5 seconds
        setTimeout(function() {
            toast.className = 'moliam-toast fade-out';
            setTimeout(function() {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);

        // Auto-hide after 10 seconds for errors
        if (type === 'error') {
            setTimeout(function() {
                toast.className = 'moliam-toast fade-out';
                setTimeout(function() {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }, 10000);
        }

        console.log('[MOLIAM-RT] Toast shown:', title, '-', message);
    }

    // Create alert modal overlay for critical issues
    function createAlertModal(title, message) {
        const overlay = document.createElement('div');
        overlay.className = 'moliam-modal-overlay';
        overlay.id = 'moliam-alert-modal-' + Date.now();
        
        overlay.innerHTML = '<div class="moliam-modal alert-notice">' +
            '<h3>' + title + '</h3>' +
            '<p>' + message + '</p>' +
            '<button onclick="this.closest(\'#moliam-alert-modal-*\').remove()">Close</button></div>';

        document.body.appendChild(overlay);

        // Auto-close after 15 seconds (critical alerts stay longer)
        setTimeout(function() {
            if (overlay.parentNode) {
                overlay.remove();
            }
        }, 15000);
    }

    // Register listener for stats updates
    function onStatsUpdate(callback) {
        statsUpdateListeners.push({ onStatsUpdate: callback, type: 'stats' });
        console.log('[MOLIAM-RT] Stats update listener registered:', callback.name || 'anonymous');
    }

    // Register listener for project updates
    function onProjectUpdate(callback) {
        notificationListeners.push({ onProjectUpdate: callback, type: 'project' });
        console.log('[MOLIAM-RT] Project update listener registered:', callback.name || 'anonymous');
    }

    // Fallback to polling if WebSocket not available
    let pollTimer = null;
    
    function enableFallbackPolling() {
        console.log('[MOLIAM-RT] Falling back to polling mode. Polling every 30 seconds.');
        
        function pollDashboard() {
            fetch('/api/dashboard', { credentials: 'include' })
                .then(function(r) { return r.json(); })
                .then(function(data) {
                    if (data && data.stats) {
                        notifyStatsUpdate({ stats: data.stats, timestamp: Date.now() });
                    }
                })
                .catch(function(err) {
                    console.error('[MOLIAM-RT] Poll failed:', err);
                });
        }

        // Start polling immediately and then every 30 seconds
        pollTimer = setInterval(pollDashboard, 30000);
        
        // Initial poll
        pollDashboard();
    }

    // Stop polling if active
    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
            console.log('[MOLIAM-RT] Polling stopped');
        }
    }

    // Destroy WebSocket connection and all listeners
    function destroyConnection() {
        if (websocket) {
            websocket.close(1000, 'Client shutting down');
            websocket = null;
        }
        
        stopPolling();
        
        statsUpdateListeners = [];
        notificationListeners = [];
        
        console.log('[MOLIAM-RT] Connection destroyed. All listeners cleared.');
    }

    // Auto-initialize if on dashboard page
    if (window.location.pathname === '/dashboard' || window.location.pathname.endsWith('/dashboard')) {
        initRealtime();
        
        // Register global API for other scripts to use
        window.MoliamRealtime = {
            send: send,
            destroy: destroyConnection,
            stopPolling: stopPolling,
            
            // Listener registration
            onStatsUpdate: onStatsUpdate,
            onProjectUpdate: function(callback) {
                notificationListeners.push({ onProjectUpdate: callback, type: 'project' });
                console.log('[MOLIAM-RT] Project update listener registered:', callback.name || 'anonymous');
            },
            
            // Event emitters for other code to use
            notifyStatsUpdate: notifyStatsUpdate,
            notifyMessage: function(data) {
                websocket && send({ type: 'message', data: data });
            }
        };
        
        console.log('[MOLIAM-RT] MoliamRealtime API exposed. WebSocket initialized.');
    }

})();
