/**
 * Workforce Clock Widget - Dashboard component
 * Display current shift status, clock-in/out controls, GPS geofence visualization
 */

(async () => {
  console.log('🕐 Initializing Workforce Clock Widget...');

  const email = window.sessionEmail;
  
  if (!email) {
    console.warn('[ClockWidget] No session email found - not logged in');
    return;
  }

  let activeLog = null;
  let workerInfo = null;
  let shiftSecondsElapsed = 0;

    // Check for active shifts on load
  await checkActiveShifts();

    // Setup clock-in/out toggle handlers
  setupUIHandlers();

  async function checkActiveShifts() {
      try {
       const resp = await fetch('/api/workforce-clock?action=status', {
           headers: {
            'Content-Type': 'application/json',
             ...(await getSessionCookie())
              }
         });

        if (!resp.ok) throw new Error('Failed to fetch active shifts');

        const data = await resp.json();

       if (data.data && data.data.active_workers.length > 0) {
            // Find own active log
          const myActive = data.data.active_workers.find(w => w.email === email);

         if (myActive) {
             activeLog = myActive;
            renderActiveShift(myActive);
           } else {
               // No active shifts - show clock-in button
             renderClockInButton();
           }
       } else {
           renderClockInButton();
         }

       } catch (err) {
         console.error('[ClockWidget] Error checking shifts:', err.message);
         showError('Failed to load shift status');
       }
     }

  function setupUIHandlers() {
    const clockBtn = document.getElementById('workforce-clock-btn');
    const gpsToggle = document.getElementById('workforce-gps-enabled');
    const geoInfo = document.getElementById('workforce-geofence-info');

     if (clockBtn) {
      clockBtn.addEventListener('click', async () => {
         if (activeLog) {
           await handleClockOut();
           } else {
             await handleClockIn();
          }
        });
      }

    if (gpsToggle && geoInfo) {
       gpsToggle.addEventListener('change', () => {
         const isGpsEnabled = gpsToggle.checked;
         localStorage.setItem('workforce_gps_enabled', isGpsEnabled ? 'true' : 'false');
         
          if (isGpsEnabled) {
            geoInfo.textContent = 'GPS tracking active - your location will be recorded';
            updateButtonToIncludeLocation();
           } else {
            geoInfo.textContent = 'GPS disabled - clock-in will not record location data';
         }
        });

          // Check localStorage for preference
       const storedGps = localStorage.getItem('workforce_gps_enabled');
      if (storedGps === 'true') {
        gpsToggle.checked = true;
        geoInfo.textContent = 'GPS tracking active';
       } else if (storedGps === 'false') {
        gpsToggle.checked = false;
         geoInfo.textContent = 'GPS disabled - clock-in will not record location data';
       }
      }
    }

  async function handleClockIn() {
    const btn = document.getElementById('workforce-clock-btn');
    if (!btn) return;

    const textOrig = btn.textContent;
    btn.textContent = 'CLOCKING IN...';
    btn.disabled = true;

    try {
       const latGeo = window.navigator.geolocation;
      let useLocation = gpsToggle?.checked || false;
       
      let paramsData = { 
         action: 'clock_in', 
         device_info: navigator.userAgent 
       };
      
      if (useLocation && latGeo) {
        const coords = await new Promise((resolve, reject) => {
          latGeo.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            err => reject(err),
             { timeout: 10000, maximumAge: 60000 }
              );
        });

         paramsData.lat = coords.lat;
         paramsData.lng = coords.lng;
      }

       // Add optional battery status for mobile devices
      if (window.navigator.getBattery) {
        const battery = await window.navigator.getBattery();
        paramsData.battery_level = Math.round(battery.level * 100);
       }

        const resp = await fetch('/api/workforce-clock', {
           method: 'POST',
           headers: { 
             'Content-Type': 'application/json' 
            },
            body: JSON.stringify(paramsData),
              ...(await getSessionCookie())
          });

         if (!resp.ok) throw new Error('Clock-in failed');
         
        const data = await resp.json();

       if (data.success || data.data) {
           showToast(data.message || 'Clocked in successfully!', 'success');
          
            activeLog = data.data;
         renderActiveShift(data.data);
       } else {
           throw new Error('Response indicated failure');
         }

      } catch (err) {
        btn.textContent = textOrig;
         showError(err.message || err);
         console.error('[ClockWidget] Clock-in failed:', err);
       } finally {
         if (btn) btn.disabled = false;
       }
    }

  async function handleClockOut() {
    const btn = document.getElementById('workforce-clock-btn');
    if (!btn) return;

    const textOrig = btn.textContent;
    btn.textContent = 'CLOCKING OUT...';
    btn.disabled = true;

    try {
       const resp = await fetch('/api/workforce-clock?action=clock_out', {
           method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
                ...(await getSessionCookie())
             }
          });

         if (!resp.ok) throw new Error('Clock-out failed');

        const data = await resp.json();

       if (data.success) {
           showToast(data.message, 'success');
           
           document.getElementById('workforce-timer-display').textContent = null;
              renderClockInButton();
       } else {
           throw new Error(data.error || 'Unknown error');
         }

      } catch (err) {
        showError(err.message || err);
         console.error('[ClockWidget] Clock-out failed:', err);
       } finally {
        btn.textContent = textOrig;
        btn.disabled = false;
      }
    }

  function renderActiveShift(data) {
    const timerDisplay = document.getElementById('workforce-timer-display');
    const statusCard = document.getElementById('workforce-status-card');
    
    if (!timerDisplay || !statusCard) return;

    const clockInTime = new Date(data.clock_in_time);
    
       // Start countdown timer every second
      shiftSecondsElapsed = 0;
      let intervalId;

    intervalId = setInterval(() => {
        shiftSecondsElapsed++;

         const currentTime = new Date(Date.now() - (clockInTime.getTime()) + (shiftSecondsElapsed * 1000));
       let shiftHours = Math.floor(shiftSecondsElapsed / 3600);
       let minutesDiff = Math.floor((shiftSecondsElapsed % 3600) / 60);

      const durationText = `${shiftHours}h ${minutesDiff}m`;
      
         timerDisplay.textContent = `Shift: ${durationText}`;

         if (data.geofence_status === 'outside') {
         statusCard.querySelector('.geofence-badge').textContent = '⚠ Outside Zone';
           statusCard.classList.add('outside-zone');
         } else if (data.geofence_status !== 'no_geofence') {
          statusCard.querySelector('.geofence-badge').textContent = '✓ Inside Geofence';
            statusCard.classList.remove('outside-zone');
         }

       if (data.location_lat && data.location_lng) {
           document.getElementById('workforce-location-display').innerHTML = 
              `📍 ${data.location_lat.toFixed(4)}, ${data.location_lng.toFixed(4)}`;
        }

       }, 1000);

      // Store interval ID for cleanup if needed
      window.workforceTimerId = intervalId;

     document.querySelector('.geofence-status').textContent = data.geofence_status === 'no_geofence' 
        ? 'No geofence configured' 
        : `${data.geofence_status} zone`;

      if (data.location_lat && data.location_lng) {
         document.getElementById('workforce-location-display').innerHTML = 
            `📍 ${data.location_lat.toFixed(4)}, ${data.location_lng.toFixed(4)}`;
       }
   }

  function renderClockInButton() {
    const btn = document.getElementById('workforce-clock-btn');
    if (btn) {
      btn.textContent = 'CLOCK IN';
      btn.dataset.status = 'idle';
      document.querySelector('.geofence-status').textContent = null;
        clearInterval(window.workforceTimerId || 0);
      clearPreviousTimers();
     }
   }

  function clearPreviousTimers() {
    if (window.workforceTimerId) {
       clearInterval(window.workforceTimerId);
      window.workforceTimerId = null;
     }
    shiftSecondsElapsed = 0;
  }

  function updateButtonToIncludeLocation() {
    const gpsEnabled = gpsToggle?.checked || false;
    if (gpsEnabled) {
      console.log('[ClockWidget] GPS enabled - all clock-ins will include coordinates');
    } else {
      console.log('[ClockWidget] GPS disabled - clock-ins will not record location data');
    }
  }

  function showError(msg) {
    const errDiv = document.getElementById('workforce-error-display') || createErrorContainer();
    errDiv.textContent = msg;
    
    setTimeout(() => {
      if (errDiv.parentElement && errDiv.childElementCount > 0) {
         errDiv.remove();
        }
      }, 8000);

    showToast('✗ Error: ' + msg, 'error');
    }

  function createErrorContainer() {
    const container = document.createElement('div');
     container.id = 'workforce-error-display';
    container.className = 'alert alert-danger mt-3';
    container.style.cssText = 'color: #ef4444; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; padding: 12px; border-radius: 12px; margin-top: 16px;';

       const errorCard = document.getElementById('workforce-status-card');
    if (errorCard) {
      errorCard.insertAdjacentElement('afterend', container);
     } else {
         document.body.appendChild(container);
      }

    return container;
    }

  function showToast(message, type = 'info') {
    const toast = document.createElement('button');
    toast.textContent = message;
   if (type === 'error' ) {
      toast.style.cssText = 'background: #ef4444; color: white; padding: 16px 24px; border-radius: 12px; margin-bottom: 16px; text-align: center; font-weight: 500; display: block;';
    } else if (type === 'success') {
      toast.style.cssText = 'background: #10b981; color: white; padding: 16px 24px; border-radius: 12px; margin-bottom: 16px; text-align: center; font-weight: 500; display: block;';
    } else {
      toast.style.cssText = 'background: #3b82f6; color: white; padding: 16px 24px; border-radius: 12px; margin-bottom: 16px; text-align: center; font-weight: 500; display: block;';
    }

     document.body.appendChild(toast);

       // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 500);
       }, 3000);
   }

    async function getSessionCookie() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
         const [name, value] = cookie.trim().split('=');
         if (name === 'cf_session') {
           return { 'Cookie': `cf_session=${value}` };
          }
     }
      return {};
   }

  function clearPreviousTimers() {
    if (window.workforceTimerId) {
      clearInterval(window.workforceTimerId);
       window.workforceTimerId = null;
        shiftSecondsElapsed = 0;
     }
  }

   // Initialize on load check localStorage for GPS preference
  
   
})();

