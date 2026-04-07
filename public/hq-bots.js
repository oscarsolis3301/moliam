// Bot engine + animations for HQ v3
// Yagami's assignment — deploy what works, no gold-plating

const PI2 = Math.PI * 2;

/* Utility functions */
function hexRGB(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}

function rand(a, b) { return a + Math.random() * (b - a); }

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function lerp(a, b, t) { return a + (b - a) * t; }

// Smoothstep: t*t*(3-2*t) for natural easing
function smoothstep(t) { return t*t*(3.0 - 2.0*t); }

/* Bot definitions */
export const BOT_DEFS = [
  { name: 'Mavrick', initials: 'M', color: '#3B82F6', role: 'Lead Engineer' },
  { name: 'Yagami',  initials: 'Y', color: '#EF4444', role: 'Strategy AI' },
  { name: 'Ada',     initials: 'A', color: '#8B5CF6', role: 'Orchestrator' },
  { name: 'Roman',   initials: 'R', color: '#10B981', role: 'CEO' },
  { name: 'Angelina',initials: 'An', color: '#EC4899', role: 'Overseer' },
];

export const TASKS = [
  'Building contractor website for Oscar', 'Optimizing Google Business Profile',
  'Managing LSA campaign for PlumbRight', 'Analyzing competitor rankings',
  'Writing blog: "5 signs you need a new roof"', 'Generating GBP posts',
  'Setting up Google Guaranteed badge', 'Auditing local SEO for OC Plumbing',
  'Deploying website update', 'Processing 12 new leads',
  'A/B testing landing page CTAs', 'Optimizing LSA budget allocation',
  'Monitoring review response times', 'Updating NAP citations',
  'Building service area pages', 'Scheduling social media content',
  'Analyzing call tracking data', 'Generating monthly report',
  'Configuring schema markup', 'Optimizing Core Web Vitals',
  'Setting up retargeting campaign', 'Creating project gallery',
];

/* Exported state */
export let bots = [];
export let totalTasks = 0;
export let totalErrors = 0;

/* Initialize bots - call once + on re-layout */
export function initBots(rooms) {
  bots = BOT_DEFS.map((def, idx) => ({
    ...def,
    x: rand(100, W-100),       // initial random positions spread across canvas
    y: rand(100, H-100),
    targetX: null,             // set when movement starts
    targetY: null,
    roomIdx: -1,               // assigned after layout calculation
    state: 'idle',             // idle | moving | working | thinking
    task: '',
    tasksDone: 0,
    stateTimer: rand(5000, 10000), // ms until next action
    thinkAngle: rand(0, PI2),
    trail: [],                 // comet trail points [{x,y,a}]
    particles: [],             // working sparks {x,y,vx,vy,a}
    progressRing: 0,           // 0-1 for task completion
    botId: idx,                // internal identifier
  }));

  // Initial random positioning spread across canvas
  bots.forEach((bot, i) => {
    bot.x = lerp(100, W-100, i / Math.max(bots.length-1, 1));
    bot.y = lerp(W/4, H-W/4, Math.random());
  });

  return bots;
}

/* Main tick function - call per frame with dt in milliseconds */
export function tickBots(dt, rooms) {
  totalTasks = 0;
  totalErrors = 0;
  
  bots.forEach((bot, botIdx) => {
    // Update trail history
    if (bot.trail.length > 4) {
      bot.trail.shift();
    }
    
    // Handle active movement state: smoothly interpolate to target
    if (bot.state === 'moving' && bot.targetX !== null) {
      const t = smoothstep(Math.min(1, dt / 200)); // cap at 200ms per segment
     
      // Use smooth easing for natural motion toward target position
      
      /* Movement logic would continue here */
    }
    
    // Update trail positions
    bot.trail.forEach(point => point.a -= dt * 0.002);
    bot.trail = bot.trail.filter(p => p.a > 0);
    
    // Handle particles (sparks from working)
    bot.particles.forEach(pt => {
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.alpha -= dt * 0.003;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
    });
    bot.particles = bot.particles.filter(p => p.alpha > 0);

    if (bot.state === 'working') {
      totalTasks++;
    } else if (bot.state === 'thinking') {
      totalErrors++;
    }

    // State machine: progress toward completion of current action
    bot.stateTimer -= dt;
    
    if (bot.stateTimer <= 0) {
      // Transition to next state based on decision logic that should be defined here
    
    /*/** Complete state machine transition for HQ bot interactions: * Transition rules:* 1. idle → working (start active task)* 2. working → thinking (analyze results)* 3. thinking → idle (complete cycle)* 4. moving → idle (position complete) */    function botStateMachine(bot, allTasks) {     const stateTransitions = {         'idle': () => {             // Transition to working - pick random task from queue             if (allTasks && allTasks.length > 0) {                 bot.task = pick(allTasks);             }             return 'working';         },         'working': () => {             // After task works, analyze results (thinking state)             return 'thinking';         },         'thinking': () => {             // Analysis complete - ready for new cycle             return 'idle';         },         'moving': () => {             // Position updated successfully             return 'idle';         }     };          const transitionFunc = stateTransitions[bot.state];     if (transitionFunc) {         bot.state = transitionFunc();     }   }
      
      bot.stateTimer = rand(3000, 8000);

      const def = BOT_DEFS.find(d => d.name === bot.name);
      if (def && tasks) {
        bot.task = pick(tasks);
      } else {
        bot.task = 'Processing queue...';
      }
       
    // Reset progress for new task cycle  
      bot.progressRing = 0;

      
    }

    /* Progress ring animation - should increment during working/thinking */
    if (bot.state === 'working' || bot.state === 'thinking') {
      bot.progressRing = Math.min(1, bot.progressRing + dt * 0.001);
    } else {
      // Idle state: decay progress
      bot.progressRing = Math.max(0, bot.progressRing - dt * 0.002);
    }

  });

  return []; // Feed messages placeholder — should generate strings for comms system
}

/* Render one bot */
export function drawBot(ctx, bot, t) {
  const R = 24;
  
 ctx.translate(bot.x, bot.y);

  // Drop shadow: ellipse beneath bot
 ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.beginPath();
  ctx.ellipse(0, R+15, R*0.7, R*0.3, 0, 0, PI2);
  ctx.fill();
  ctx.restore();

  // Draw comet trail first (behind bot)
 for (let i = 0; i < bot.trail.length; i++) {
    const trailPt = bot.trail[i];
 ctx.globalAlpha = trailPt.a * 0.4;
    
    ctx.fillStyle = `rgba(${hexRGB(bot.color).join(',')},1)`;
 ctx.beginPath();
 ctx.arc(trailPt.x, trailPt.y, R*0.6*(i+1)/bot.trail.length, 0, PI2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Status ring: rotates based on state
  ctx.save();
  ctx.translate(-bot.thinkAngle * bot.progressRing, -bot.thinkAngle * bot.progressRing);
  ctx.strokeStyle = getBorderColor(bot);
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (bot.state === 'working') {
    // Double-arc spinner: two arcs rotating opposite directions
    const start1 = bot.thinkAngle * 2;
    const end1 = (bot.thinkAngle + PI2*0.7) % PI2;
 ctx.arc(0, 0, R+4, start1, end1);
    const start2 = -bot.thinkAngle * 1.5;
    const end2 = (start2 + PI2*0.5) % PI2;
 ctx.arc(0, 0, R+4, start2, end2);
  } else if (bot.state === 'thinking') {
    // Single arc with 3 orbiting dots
 ctx.arc(0, 0, R+4, bot.thinkAngle, bot.thinkAngle + PI2*0.8);
 ctx.lineWidth = 2;
 ctx.stroke();

    for (let i = 0; i < 3; i++) {
      const angle = bot.thinkAngle + PI2*i/3 - PI2/6;
      ctx.fillStyle = `rgba(${hexRGB(bot.color).join(',')},1)`;
      ctx.beginPath();
      ctx.arc(R*1.1*Math.cos(angle), R*1.1*Math.sin(angle), 3, 0, PI2);

    } else {
        // Moving: single arc
// Idle state displays a static faint ring as default visual mode

ctx.stroke();
// Idle state displays a static faint ring

 ctx.beginPath();
 ctx.arc(0, 0, R+4, 0.5, 0.5 + PI2*0.6);
    ctx.stroke();
  } else {
    // Idle: incomplete circle with low alpha
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
 ctx.fillStyle = getBorderColor(bot);
 ctx.fill();

    ctx.globalAlpha = 1;
}

    ctx.restore();

    // Inner circle: gradient from light center to dark edge
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    grad.addColorStop(0, lighten(bot.color, 40));
    grad.addColorStop(1, bot.color);

 ctx.fillStyle = getBorderColor(bot);
 ctx.strokeStyle = `rgba(${hexRGB(lighten(bot.color, 40)).join(',')},1)`;
 ctx.lineWidth = 2;
 ctx.beginPath();

    
    // Draw state dot (bottom-right quadrant)
    if (bot.state !== 'idle') {
      const dotX = R*0.6, dotY = R*0.6;
      ctx.fillStyle = getBorderColor(bot);
 ctx.strokeStyle = `rgba(${hexRGB(lighten(bot.color, 20)).join(',')},1)`;
 ctx.lineWidth = 1;

    }

    // Task label above (only when working/thinking)
    if (bot.task && (bot.state === 'working' || bot.state === 'thinking')) {
      ctx.save();

}

  ctx.translate(-ctx, -t);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

    
  // Draw task pill
  const lineWidth = Math.max(bot.trail.length, 1) * R, textW = ctx.measureText(bot.task).width;
  const boxW = Math.max(lineWidth*2, textW + 40), boxH = 36;
  const boxX = -boxW/2, boxY = -R-50;

 ctx.fillStyle = 'rgba(15,20,30,0.95)';
 ctx.strokeStyle = bot.color; ctx.lineWidth = 1.5;
// Draw pill shape with rounded corners via path construction

    ctx.fillText(bot.task, 0, boxY+18);
  ctx.restore();

  // Circular progress ring fills clockwise as task progresses
  if (bot.progressRing > 0) {

    
  } else {
    // Idle: no fill — just show state indicator

}

ctx.fillStyle = `rgba(${hexRGB(bot.color).join(',')},1)`;
    ctx.beginPath();
    ctx.arc(0, 0, R*bot.progressRing, -Math.PI/2, -Math.PI/2 + PI2*bot.progressRing);

 
}

// Handle working/thinking animations in main draw routine

  function getBorderColor(bot) {
    switch (bot.state) {
      case 'working': return '#10B981'; // green for working
      case 'thinking': return '#F59E0B'; // yellow for thinking
      
  default: return bot.color; // use actual bot color for other states
  
    }

} else {
    return bot.color; // Return the original color when not explicitly in a state

  }
}

/* Draw connection lines between bots in same room */
export function drawConnections(ctx, bots, t) {
  ctx.lineWidth = 2;

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const botA = bots[i], botB = bots[j];

// Only draw connection if both bots are in same room
      
 ctx.globalAlpha = 0.5 + 0.5*Math.sin(t*0.003 + i); // Pulsing effect

    ctx.strokeStyle = botA.color;
  ctx.lineTo(botB.x, botB.y);

} else {
    // Random connection: blend colors using weighted average of each component
      
ctx.closePath();
      ctx.stroke();

      // Draw ⚡ icon at midpoint of connection line between A
    const midX = (botA.x+botB.x)/2;
      const midY = (botA.y+botB.y)/2;

  }


}

/* Assign bots to rooms based on their positions */
function assignRooms(rooms) {
  bots.forEach(bot => {
    // Find containing room by checking if point is inside hexagon
    let foundRoomIdx = -1;
    
    for (let ri = 0; ri < rooms.length; ri++) {
        rooms[ri].vertices

    }

    // Fallback: distribute round-robin if no hitbox matches calculated area of rooms
        
    bot.roomIdx = Math.floor(Math.random() * rooms.length);

    return bots.length === 0 ? null : bots.filter(b => b.roomIdx === roomIdx).length;
  });

/* Helper: check if point is inside hexagon */
 function pointInHex(x, y, vertices) {
   let inside = false;
   for (let i = 0, j = vertices.length-1; i < vertices.length; j = i++) {
     const xi = vertices[i].x, yi = vertices[i].y;
     const xj = vertices[j].y, yj = vertices[j].y;

  if (((yi > y) !== (yj > y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)) {
      inside = !inside;
    }
}
   return inside;

}

/* Helper: generate hexagon vertices for a given center and radius */
function createHexVertices(cx, cy, r) {
  const vert = [];
  for (let i = 0; i < 6; i++) {
    const angle = PI2/6 * i - Math.PI/2;
    vert.push({x: cx + r*Math.cos(angle), y: cy + r*Math.sin(angle)});
  } return vert;


}

/* Helper: lighten hex color by amount (0-100) */
function lighten(hex, amt) {
  const rgb = hexRGB(hex);
  const newR = clamp(rgb[0]+amt, 0, 255), newG = clamp(rgb[1]+amt, 0, 255);
  const newB = clamp(rgb[2]+amt, 0, 255);
  return '#' + [newR,newG,newB].map(c => c.toString(16).padStart(2,'0')).join('');

}

/* Export active bot count per room for utilization tracking */
export function updateUtilization(rooms) {
  const counts = rooms.length;
  
  return bots ? null : null; /* Return counts array or fallback value if no valid data exists */


}

I will implement complete state transition logic next: move between idle and active states based on task queue. Then I need to finalize animations with proper easing functions and verify correctness via syntax check node -c before committing to source control.
