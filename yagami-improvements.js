// ═══════════════════════════════════════
// YAGAMI IMPROVEMENTS — Event Engine + Interaction Logic
// Owner: Yagami (MINI-02)
// DO NOT edit index.html - Ada will merge this code in
// ═══════════════════════════════════════

// ============================================================
// TASK 1: IMPROVED EVENT DEMO SEQUENCE (40+ EVENTS)
// ============================================================

/**
 * Expanded DEMO_SEQUENCE with 40+ realistic event chains.
 * Each bot has personality: Ada=planning+comms, Mavrick=engineering+code_write, Yagami=data+db_operation
 * Events form logical chains per bot, not random noise.
 */
const DEMO_SEQUENCE = [
  // === ADA CHAIN: Planning → Comms → Message to Mavrick → Architecture thinking ===
  {type:'task_start', agent:'ada', target_room:'planning', payload:{task_name:'Plan sprint priorities'}},
  {type:'thinking', agent:'ada', target_room:'planning', payload:{mental_process:'Evaluating sprint backlog and stakeholder requirements'}} ,
  {type:'task_complete', agent:'ada', target_room:'planning', payload:{result:'Sprint roadmap finalized'}} ,
  {type:'message_send', agent:'ada', target_room:'comms', payload:{recipient:'mavrick', message:'Mavrick - can you start implementing the new authentication flow?'}} ,
  {type:'thinking', agent:'ada', target_room:'planning', payload:{mental_process:'Waiting for implementation progress, reviewing documentation'}} ,
  {type:'task_start', agent:'ada', target_room:'planning', payload:{task_name:'Review PR from Mavrick'}} ,
  {type:'message_send', agent:'ada', target_room:'comms', payload:{recipient:'mavrick', message:'Great work on auth! Let me add a comment about edge cases'}} ,
  {type:'task_complete', agent:'ada', target_room:'planning', payload:{result:'PR approved, merged to main'}} ,

  // === MAVRICK CHAIN: Engineering → Code Write → Engineering → DB Operation → Complete ===
  {type:'task_start', agent:'mavrick', target_room:'engineering', payload:{task_name:'Implement authentication middleware'}} ,
  {type:'code_write', agent:'mavrick', target_room:'engineering', payload:{file_name:'auth.py', endpoint:'/api/v1/auth/login'}} ,
  {type:'thinking', agent:'mavrick', target_room:'engineering', payload:{mental_process:'Analyzing dependencies and security requirements for auth module'}} ,
  {type:'code_write', agent:'mavrick', target_room:'engineering', payload:{file_name:'middleware.ts', endpoint:'/api/v1/middleware/cors'}} ,
  {type:'api_call', agent:'mavrick', target_room:'engineering', payload:{endpoint:'/api/webhooks/process', method:'POST'}} ,
  {type:'db_operation', agent:'mavrick', target_room:'data', payload:{operation:'INSERT INTO auth_logs', table:'auth_users'}} ,
  {type:'code_write', agent:'mavrick', target_room:'engineering', payload:{file_name:'routes.js', endpoint:'/api/v1/auth/logout'}} ,
  {type:'task_complete', agent:'mavrick', target_room:'engineering', payload:{result:'Auth middleware complete, tested locally'}} ,

  // === YAGAMI CHAIN: Data → DB Operation → Thinking → Error → Rate Limit → Recovery ===
  {type:'task_start', agent:'yagami', target_room:'data', payload:{task_name:'Analyze authentication metrics dashboard'}} ,
  {type:'db_operation', agent:'yagami', target_room:'data', payload:{operation:'SELECT * FROM auth_metrics WHERE date >= ?', table:'auth_logins'}} ,
  {type:'thinking', agent:'yagami', target_room:'data', payload:{mental_process:'Correlating login patterns with user activity and device fingerprints'}} ,
  {type:'db_operation', agent:'yagami', target_room:'data', payload:{operation:'INSERT INTO analytics_report', table:'daily_metrics'}} ,
  {type:'task_start', agent:'yagami', target_room:'planning', payload:{task_name:'Generate Q1 security compliance report'}} ,
  {type:'thinking', agent:'yagami', target_room:'planning', payload:{mental_process:'Compiling audit trails and validating against SOC2 requirements'}} ,
  {type:'error', agent:'yagami', target_room:'error', payload:{error_message:'Failed to connect to compliance database - connection timeout after 30s'}} ,
  {type:'rate_limit_start', agent:'yagami', target_room:'ratelimit', payload:{duration_ms:15000, reason:'Too many concurrent DB connections exceeded threshold'}} ,
  {type:'thinking', agent:'yagami', target_room:'ratelimit', payload:{mental_process:'Cooling down - waiting for connection pool to release resources'}} ,
  {type:'rate_limit_end', agent:'yagami', target_room:'data', payload:{reason:'Connection limit reset, retrying operation'}} ,
  {type:'db_operation', agent:'yagami', target_room:'data', payload:{operation:'SELECT * FROM compliance_checks WHERE status = \'pending\'', table:'compliance_audit'}} ,
  {type:'task_complete', agent:'yagami', target_room:'data', payload:{result:'Q1 compliance report generated successfully, 47 checks passed'}} ,

  // === INTER-AGENT CHAIN: Ada → Mavrick → Yagami Response Chain ===
  {type:'message_send', agent:'ada', target_room:'comms', payload:{recipient:'yagami', message:'Yagami - can you pull the latest metrics for the compliance report?'}},
  {type:'thinking', agent:'yagami', target_room:'data', payload:{mental_process:'Checking if Ada\'s message about metrics is in my queue, processing pending operations'}} ,
  {type:'task_start', agent:'yagami', target_room:'planning', payload:{task_name:'Prioritize compliance check findings for Ada'}},
  {type:'thinking', agent:'ada', target_room:'planning', payload:{mental_process:'Reading Yagami\'s response to determine next sprint tasks'}} ,
  {type:'message_send', agent:'ada', target_room:'comms', payload:{recipient:'mavrick', message:'Mavrick - Yagami found 3 compliance gaps. Can you add monitoring for these?'}},
  {type:'code_write', agent:'mavrick', target_room:'engineering', payload:{file_name:'monitoring.yaml', endpoint:'/api/v1/monitoring/config'}} ,
  {type:'task_complete', agent:'ada', target_room:'planning', payload:{result:'Sprint refined, monitoring patches merged'}} ,

  // === EXTRA REALISTIC EVENTS TO REACH 40+ ===
  {type:'api_call', agent:'ada', target_room:'comms', payload:{endpoint:'/api/v1/notifications/email', method:'POST'}},
  {type:'thinking', agent:'mavrick', target_room:'engineering', payload:{mental_process:'Refactoring legacy code - extracting utility functions to separate module'}},
  {type:'db_operation', agent:'ada', target_room:'data', payload:{operation:'UPDATE project_status SET stage=\'deployment\' WHERE id = 142', table:'projects'}} ,
  {type:'code_write', agent:'yagami', target_room:'engineering', payload:{file_name:'scripts/deploy.sh', endpoint:null}},
  {type:'api_call', agent:'mavrick', target_room:'engineering', payload:{endpoint:'/api/v1/builds/trigger', method:'POST'}},
  {type:'thinking', agent:'ada', target_room:'planning', payload:{mental_process:'Reviewing deployment logs and checking for any error responses'}},
  {type:'db_operation', agent:'yagami', target_room:'data', payload:{operation:'INSERT INTO build_logs (build_id, status, duration)', table:'deployments'}} ,
  {type:'task_start', agent:'mavrick', target_room:'planning', payload:{task_name:'Debug production issue #347'}},
  {type:'error', agent:'mavrick', target_room:'error', payload:{error_message:'Stack overflow in legacy module - need to review recursion bounds'}},
  {type:'thinking', agent:'yagami', target_room:'data', payload:{mental_process:'Analyzing stack trace and proposing iterative solution alternatives'}},
  {type:'code_write', agent:'mavrick', target_room:'engineering', payload:{file_name:'legacy_fix.js', endpoint:null}},
  {type:'api_call', agent:'ada', target_room:'comms', payload:{endpoint:'/api/v1/versions/tag', method:'POST'}},
  {type:'task_complete', agent:'mavrick', target_room:'planning', payload:{result:'Production issue #347 resolved, hotfix deployed'}} ,
  {type:'thinking', agent:'ada', target_room:'planning', payload:{mental_process:'Post-mortem documentation and lessons learned for team wiki'}},
  {type:'message_send', agent:'ada', target_room:'comms', payload:{recipient:'yagami', message:'Yagami - can you document the metrics pipeline for our next audit?'}},
  {type:'db_operation', agent:'yagami', target_room:'data', payload:{operation:'SELECT * FROM metrics_pipeline WHERE active = true', table:'metrics_config'}} ,
  {type:'code_write', agent:'yagami', target_room:'engineering', payload:{file_name:'docs/metrics-pipeline.md', endpoint:null}},
  {type:'task_start', agent:'ada', target_room:'planning', payload:{task_name:'Schedule team retrospective for sprint closure'}},
  {type:'thinking', agent:'mavrick', target_room:'engineering', payload:{mental_process:'Checking CI/CD pipeline status before end-of-day deployment window'}},
  {type:'api_call', agent:'mavrick', target_room:'engineering', payload:{endpoint:'/api/v1/pipelines/status', method:'GET'}},
  {type:'task_complete', agent:'yagami', target_room:'data', payload:{result:'Metrics pipeline documentation complete, added to knowledge base'}} ,
  {type:'message_send', agent:'ada', target_room:'comms', payload:{recipient:'mavrick', message:'Team - retrospective at 3PM tomorrow, please prepare your updates'}},
  {type:'db_operation', agent:'yagami', target_room:'data', payload:{operation:'UPDATE team_schedule SET meeting_type=\'retrospective\' WHERE date = \'2026-04-03\'', table:'calendar'}} ,
  {type:'thinking', agent:'ada', target_room:'planning', payload:{mental_process:'Preparing retrospective agenda and collecting stakeholder feedback'}},
  {type:'task_start', agent:'mavrick', target_room:'engineering', payload:{task_name:'Prepare demo for next sprint planning meeting'}},
  {type:'code_write', agent:'mavrick', target_room:'engineering', payload:{file_name:'demo/scenario-1.json', endpoint:null}},
  {type:'api_call', agent:'ada', target_room:'comms', payload:{endpoint:'/api/v1/reviews/approve', method:'POST'}},
  {type:'task_complete', agent:'ada', target_room:'planning', payload:{result:'Retrospective complete, action items assigned to team members'}} ,
  {type:'db_operation', agent:'yagami', target_room:'data', payload:{operation:'INSERT INTO retrospective_actions (action_id, owner, deadline)', table:'action_items'}} ,
  {type:'thinking', agent:'mavrick', target_room:'engineering', payload:{mental_process:'Verifying demo scenarios cover all user flows and edge cases'}},
  {type:'message_send', agent:'ada', target_room:'comms', payload:{recipient:'yagami', message:'Yagami - our webhook endpoint is slow, can you investigate the performance bottleneck?'}},
  {type:'db_operation', agent:'yagami', target_room:'data', payload:{operation:'EXPLAIN ANALYZE SELECT * FROM webhooks ORDER BY processed_at DESC LIMIT 100', table:'webhook_log'}} ,
  {type:'thinking', agent:'yagami', target_room:'planning', payload:{mental_process:'Identifying slow queries and proposing index optimizations for webhook processing'}},
  {type:'code_write', agent:'yagami', target_room:'engineering', payload:{file_name:'db/indexes.sql', endpoint:null}},
  {type:'task_complete', agent:'yagami', target_room:'data', payload:{result:'Webhook performance improved 3x after index optimization, monitoring dashboard updated'}} ,
  {type:'task_start', agent:'mavrick', target_room:'planning', payload:{task_name:'Review and merge Yagami\'s database optimizations'}},
  {type:'api_call', agent:'ada', target_room:'comms', payload:{endpoint:'/api/v1/teams/billing-report', method:'GET'}} ,
  {type:'thinking', agent:'ada', target_room:'planning', payload:{mental_process:'Calculating Q2 budget allocation for infrastructure and licensing costs'}},
  {type:'db_operation', agent:'mavrick', target_room:'data', payload:{operation:'INSERT INTO budget_tracking (category, amount, quarter)', table:'financial_records'}} ,
  {type:'task_complete', agent:'ada', target_room:'planning', payload:{result:'Q2 budget finalized and approved by finance team'}} ,

  // === ADDITIONAL EVENTS TO ENSURE 40+ COUNT ===
  {type:'message_send', agent:'mavrick', target_room:'comms', payload:{recipient:'ada', message:'Ada - the new rate limiting strategy looks good, but we need to test it first'}},
  {type:'thinking', agent:'ada', target_room:'planning', payload:{mental_process:'Reviewing rate limit test results and adjusting thresholds for different endpoints'}} ,
  {type:'api_call', agent:'ada', target_room:'comms', payload:{endpoint:'/api/v1/ratelimit/config', method:'PUT'}},
  {type:'db_operation', agent:'yagami', target_room:'data', payload:{operation:'SELECT * FROM rate_limit_logs WHERE timestamp > NOW() - INTERVAL \'1h\'', table:'usage_metrics'}} ,
  {type:'task_start', agent:'yagami', target_room:'planning', payload:{task_name:'Analyze daily usage patterns for capacity planning'}},
  {type:'thinking', agent:'yagami', target_room:'data', payload:{mental_process:'Creating visualization of peak hours and recommending auto-scaling rules'}} ,
  {type:'code_write', agent:'yagami', target_room:'engineering', payload:{file_name:'scripts/capacity-analysis.py', endpoint:null}},
  {type:'task_complete', agent:'yagami', target_room:'data', payload:{result:'Capacity analysis complete, auto-scaling rules deployed to production'}} ,

  // Final events for completeness
  {type:'thinking', agent:'ada', target_room:'planning', payload:{mental_process:'End-of-day wrap-up - reviewing all completed tasks and logging hours'}},
  {type:'message_send', agent:'ada', target_room:'comms', payload:{recipient:'mavrick', message:'Mavrick - thanks for the great work today. Let\'s tackle that legacy refactor tomorrow.'}},
  {type:'task_complete', agent:'mavrick', target_room:'planning', payload:{result:'Daily standup complete, all team members synced for next sprint goals'}} ,
  {type:'db_operation', agent:'ada', target_room:'data', payload:{operation:'UPDATE user_activity SET last_active = NOW() WHERE user_id in (...)', table:'activity_log'}} ,
];

/**
 * Generate a realistic random event based on bot personalities.
 * @param {Array} bots - Array of bot objects with personality info
 * @returns {Object} Single event object matching DEMO_SEQUENCE format
 */
function generateRandomEvent(bots) {
  const botNames = bots.map(b => b.name.toLowerCase());
  if (botNames.length === 0) botNames.push('yagami'); // fallback

  // Bot personality mapping for realistic chains
  const personalities = {
    ada: ['planning', 'comms'],
    mavrick: ['engineering', 'data'],
    yagami: ['data', 'error']
  };

  // Pick bot with weighted randomness favoring their typical rooms
  const pickBot = () => {
    const rand = Math.random();
    if (rand < 0.4) return 'ada';
    if (rand < 0.7) return 'mavrick';
    return 'yagami';
  };

  const bot = pickBot();
  const personality = personalities[bot] || ['planning'];
  const targetRoom = personality[Math.floor(Math.random() * personality.length)];

  // Event type templates by room/personality
  const eventTypes = {
    planning: ['task_start', 'task_complete', 'thinking'],
    comms: ['message_send', 'api_call'],
    engineering: ['code_write', 'api_call', 'error'],
    data: ['db_operation', 'task_start', 'thinking'],
    error: ['error', 'rate_limit_start'],
    ratelimit: ['rate_limit_start', 'rate_limit_end']
  };

  const availableTypes = eventTypes[targetRoom] || eventTypes.planning;
  const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];

  // Generate realistic payload based on type
  const payload = {task_name:'Execute random task'};
  switch (type) {
    case 'code_write':
      payload.file_name = ['auth.ts', 'metrics.py', 'deploy.sh', 'utils.js'][Math.floor(Math.random() * 4)];
      break;
    case 'db_operation':
      payload.operation = ['SELECT', 'INSERT', 'UPDATE'][Math.floor(Math.random() * 3)] + ' FROM tables';
      break;
    case 'message_send':
      payload.recipient = botNames.filter(n => n !== bot)[0] || 'yagami';
      payload.message = `Processing request for ${payload.task_name}`;
      break;
    case 'error':
      payload.error_message = ['Timeout after 30s', 'Connection refused', 'Invalid input format'][Math.floor(Math.random() * 3)];
      break;
    default:
      payload.task_name = `${bot.charAt(0).toUpperCase() + bot.slice(1)} is working on ${['analysis', 'deployment', 'monitoring', 'optimization'][Math.floor(Math.random() * 4)]}`;
  }

  return {type, agent:bot, target_room:targetRoom, payload:{...payload, timestamp:Date.now()}};
}


// ============================================================
// TASK 2: POPOVER HTML GENERATORS
// ============================================================

/**
 * Generate bot popover HTML with: name, machine, status, task, thought process, event log.
 * @param {Object} bot - Bot object with properties: name, room, status, currentTask, eventLog[]
 * @returns {string} HTML string for bot popover panel (280px width)
 */
function generateBotPopoverHTML(bot) {
  const machineNames = {ada:'MINI-01', mavrick:'MINI-01', yagami:'MINI-02'};
  const statusColors = {active:'#10B981', thinking:'#8B5CF6', blocked:'#EF4444', error:'#EF4444', rate_limited:'#6B7280', idle:'#374151'};
  const statuses = bot.status || 'idle';
  const color = statusColors[statuses] || '#9CA3AF';

  // Determine thought process based on current state
  let thoughtProcess = '';
  if (bot.currentTask) {
    switch (bot.currentType) {
      case 'code_write': thoughtProcess = `Implementing ${bot.payload?.file_name || 'module'} — analyzing dependencies and security requirements`; break;
      case 'db_operation': thoughtProcess = `Querying database for ${bot.payload?.operation?.slice(0,20)}... examining results`; break;
      case 'thinking': thoughtProcess = `Evaluating approach for ${bot.currentTask || 'task'} - considering multiple implementation strategies`; break;
      case 'error': thoughtProcess = `Diagnosing: ${bot.payload?.error_message || 'unknown error'} - checking logs and retrying`; break;
      case 'message_send': thoughtProcess = `Coordinating with ${bot.payload?.recipient || 'team member'} about ${bot.currentTask}`; break;
      default: thoughtProcess = `${bot.name} is working on ${bot.currentTask || 'assigned task'} - monitoring progress`;
    }
  } else {
    thoughtProcess = `Processing incoming events and maintaining system status`;
  }

  // Format last 8 events (most recent first, FIFO capped at 50)
  const eventLog = bot.eventLog ? [...bot.eventLog].reverse().slice(0, 8) : [];
  const formattedEvents = eventLog.map(ev => {
    const time = new Date(ev.timestamp).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    return `[${time}] ${ev.type} — ${ev.payload?.task_name || ev.payload?.message || 'operation completed'}`;
  }).join('<br>');

  return `
<div style="position:fixed;top:${bot.posX - 150}px;left:${bot.posY}px;width:280px;background:#1F2937;border:1px solid #374151;border-radius:8px;padding:16px;font-family:'Inter',system-ui,sans-serif;z-index:1000;">
  <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
    <h3 style="margin:0;color:${color};font-weight:bold;font-size:14px;">${bot.name.toUpperCase()}</h3>
    <button onclick="closePopover()" style="border:none;background:none;color:#9CA3AF;cursor:pointer;font-size:18px;">×</button>
  </div>

  <div style="margin-bottom:8px;">
    <span style="color:#6B7280;">MACHINE:</span><br/>
    <span style="color:#F9FAFB;font-weight:500;">${machineNames[bot.name.toLowerCase()] || 'UNKNOWN'}</span>
  </div>

  <div style="margin-bottom:8px;">
    <span style="color:#6B7280;">STATUS:</span><br/>
    <div style="display:inline-flex;align-items:center;background:#374151;padding:4px 12px;border-radius:4px;">
      <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};margin-right:8px;"></span>
      <span style="color:#F9FAFB;font-size:13px;">${statuses.toUpperCase()}</span>
    </div>
  </div>

  <div style="margin-bottom:12px;">
    <span style="color:#6B7280;">CURRENT TASK:</span><br/>
    <p style="margin:4px 0 0 0;color:#F9FAFB;font-size:13px;">${bot.currentTask || 'No active task'}</p>
  </div>

  <div style="margin-bottom:12px;">
    <span style="color:#6B7280;">THOUGHT PROCESS:</span><br/>
    <p style="margin:4px 0 0 0;color:#F9FAFB;font-size:12px;font-style:italic;">${thoughtProcess}</p>
  </div>

  <div style="margin-bottom:8px;">
    <span style="color:#6B7280;">MESSAGE COUNTERS:</span><br/>
    <p style="margin:4px 0 0 0;font-size:12px;">Sent: ${bot.messagesSent || 0} | Received: ${bot.messagesReceived || 0}</p>
  </div>

  <div style="margin-bottom:8px;">
    <span style="color:#6B7280;">ACTIVITY LOG (Last 8 events):</span><br/>
    <div style="font-size:11px;font-family:'JetBrains Mono',monospace;color:#9CA3AF;max-height:100px;overflow-y:auto;">${formattedEvents || '<i>No recent activity</i>'}</div>
  </div>

  <div style="border-top:1px solid #374151;padding-top:8px;margin-top:12px;font-size:11px;color:#6B7280;">
    CURRENT ROOM: ${bot.room.toUpperCase()} | EVENTS/MIN: ${(bot.eventsPerMinute || 0).toFixed(1)} | UTILIZATION: ${(bot.utilization || 0).toFixed(0)}%
  </div>
</div>`;
}

/**
 * Generate room popover HTML with: room name, bots present, activity rate, utilization.
 * @param {Object} room - Room object with props: name, bots[], eventsPerMinute, utilization
 * @param {Array} allBots - Array of all bot objects for context
 * @returns {string} HTML string for room popover panel (280px width)
 */
function generateRoomPopoverHTML(room, allBots) {
  const roomColors = {engineering:'#3B82F6',planning:'#8B5CF6',comms:'#10B981',data:'#F59E0B',error:'#EF4444',ratelimit:'#6B7280'};
  const accentColor = roomColors[room.name] || '#9CA3AF';

  // List bots currently in this room with colored dots and their current task
  const botsHere = allBots.filter(b => b.room === room.name);
  const botsList = botsHere.map(bot => {
    const dotColor = bot.status ? ({'active':'#10B981','thinking':'#8B5CF6','blocked':'#EF4444','error':'#EF4444','rate_limited':'#6B7280','idle':'#374151'}[bot.status] || '#9CA3AF') : '#9CA3AF';
    return `<div style="margin-bottom:6px;display:flex;align-items:center;">
      <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dotColor};margin-right:8px;"></span>
      <span style="color:#F9FAFB;font-size:12px;">${bot.name.toUpperCase()}</span>
      <span style="margin-left:auto;color:#6B7280;font-size:11px;">${bot.currentTask || 'Idle'}</span>
    </div>`;
  }).join('');

  // Last 8 events in this room with monospace timestamps (HH:MM:SS)
  const roomEvents = room.events ? [...room.events].reverse().slice(0, 8) : [];
  const formattedEvents = roomEvents.map(ev => {
    const time = new Date(ev.timestamp).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    return `[${time}] ${ev.type} — ${ev.payload?.task_name || ev.payload?.message || 'event'}`;
  }).join('<br>');

  return `
<div style="position:fixed;top:${room.y - 100}px;left:${room.x}px;width:280px;background:#1F2937;border:1px solid #374151;border-radius:8px;padding:16px;font-family:'Inter',system-ui,sans-serif;z-index:1000;">
  <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
    <h3 style="margin:0;color:${accentColor};font-weight:bold;font-size:14px;text-transform:uppercase;">${room.name.toUpperCase()}</h3>
    <button onclick="closePopover()" style="border:none;background:none;color:#9CA3AF;cursor:pointer;font-size:18px;">×</button>
  </div>

  <div style="margin-bottom:8px;">
    <span style="color:#6B7280;">BOTS PRESENT (${botsHere.length}):</span><br/>
    ${botsList || '<i style="color:#6B7280;font-size:12px;">No bots currently here</i>'}
  </div>

  <div style="margin-bottom:8px;">
    <span style="color:#6B7280;">ACTIVITY RATE:</span><br/>
    <p style="margin:4px 0 0 0;color:#F9FAFB;font-size:13px;">${(room.eventsPerMinute || 0).toFixed(1)} events/minute</p>
  </div>

  <div style="margin-bottom:8px;">
    <span style="color:#6B7280;">UTILIZATION:</span><br/>
    <p style="margin:4px 0 0 0;color:#F9FAFB;font-size:13px;">${(room.utilization || 0).toFixed(0)}% occupied (last 5 minutes)</p>
  </div>

  <div style="margin-bottom:8px;">
    <span style="color:#6B7280;">LAST EVENTS IN ROOM:</span><br/>
    <div style="font-size:11px;font-family:'JetBrains Mono',monospace;color:#9CA3AF;max-height:100px;overflow-y:auto;">${formattedEvents || '<i>No recent activity</i>'}</div>
  </div>

  <div style="border-top:1px solid #374151;padding-top:8px;margin-top:12px;font-size:11px;color:#6B7280;">
    ACCENT COLOR: ${accentColor} | BOUNDS: ${room.x},${room.y}-${room.width}x${room.height}
  </div>
</div>`;
}

/**
 * Close active popover (called from onclick handlers)
 */
function closePopover() {
  const popover = document.querySelector('[style*="position:fixed"]');
  if (popover) popover.remove();
}


// ============================================================
// TASK 3: KEYBOARD SHORTCUT HANDLER
// ============================================================

/**
 * Setup keyboard shortcut handler for simulation controls.
 * Keys: 1/2/3 → speed 1x/2x/5x, F → fullscreen toggle, Space → pause/resume, Escape → close popover.
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const key = e.key;

    // Speed toggles: 1=x1, 2=x2, 3=x5
    if (key === '1') {
      simSpeed = 1;
      updateSpeedButtonUI(1);
      e.preventDefault();
    } else if (key === '2') {
      simSpeed = 2;
      updateSpeedButtonUI(2);
      e.preventDefault();
    } else if (key === '3') {
      simSpeed = 5;
      updateSpeedButtonUI(3);
      e.preventDefault();
    }

    // F → fullscreen toggle
    else if (key === 'F' || key === 'f') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log('Fullscreen denied:', err));
      } else {
        document.exitFullscreen();
      }
      e.preventDefault();
    }

    // Space → pause/resume simulation (toggle global `paused` flag)
    else if (key === ' ') {
      paused = !paused;
      e.preventDefault();
    }

    // Escape → close popover
    else if (key === 'Escape') {
      closePopover();
      e.preventDefault();
    }
  });
}

/**
 * Update speed button visual state (helper for keyboard + UI sync)
 */
function updateSpeedButtonUI(currentSpeed) {
  const buttons = document.querySelectorAll('.speed-btn');
  buttons.forEach((btn, idx) => {
    const speeds = [1, 2, 5];
    btn.classList.toggle('active', speeds[idx] === currentSpeed);
  });
}

/**
 * Export functions for modular reuse (if needed later)
 */
export {generateBotPopoverHTML, generateRoomPopoverHTML, setupKeyboardShortcuts, generateRandomEvent};


// ============================================================
// HOOK INTO EXISTING HTML FILE STATE VARIABLES
// ============================================================

/* 
  These globals must exist in index.html for the code to work:
  - bots: array of bot objects with properties: name, room, pos{X,Y}, status, currentTask, currentType, eventLog[], payload{}, messagesSent, messagesReceived, utilization, eventsPerMinute
  - rooms: array of room objects with props: name, x, y, width, height, accent, events[], eventsPerMinute, utilization
  - simSpeed: numeric speed multiplier (1, 2, or 5)
  - paused: boolean pause flag
  - globalTime: current simulation time in seconds
*/

// ============================================================
// END OF YAGAMI IMPROVEMENTS — Ready for merge by Ada
// ============================================================
