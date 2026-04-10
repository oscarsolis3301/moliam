/**
 * Particle Background System - Moliam Dark UI
 * Performance-optimized canvas animation following Linear/Vercel design patterns
 */

class ParticleBackground {
  constructor(canvasId = 'particleCanvas') {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.mouse = { x: null, y: null };
    this.particleCount = 80; // Optimized for performance
    
    this.colors = ['#3B82F6', '#8B5CF6', '#10B981']; // Blue, Purple, Green from palette
    
    this.init();
  }
  
  init() {
    this.resize();
    this.createParticles();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    
    this.animate();
  }
  
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }
  
  createParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        radius: Math.random() * 2 + 1,
        dx: (Math.random() - 0.5) * 0.5,
        dy: (Math.random() - 0.5) * 0.5,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        opacity: Math.random() * 0.5 + 0.3
      });
    }
  }
  
  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
  }
  
  update() {
    this.particles.forEach((p, i) => {
      p.x += p.dx;
      p.y += p.dy;
      
      // Bounce off edges
      if (p.x < 0 || p.x > this.canvas.width) p.dx *= -1;
      if (p.y < 0 || p.y > this.canvas.height) p.dy *= -1;
      
      // Mouse interaction
      const dx = this.mouse.x - p.x;
      const dy = this.mouse.y - p.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 150) {
        const angle = Math.atan2(dy, dx);
        const force = 1.5;
        p.dx += Math.cos(angle) * force * 0.02;
        p.dy += Math.sin(angle) * force * 0.02;
      }
      
      // Reduce velocity
      p.dx *= 0.99;
      p.dy *= 0.99;
    });
  }
  
  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw particles
    this.particles.forEach(p => {
      const gradient = this.ctx.createRadialGradient(
        p.x, p.y, 0, p.x, p.y, p.radius * 3
      );
      gradient.addColorStop(0, `${p.color}${Math.floor(p.opacity * 255).toString(16).padStart(2, '0')}`);
      gradient.addColorStop(1, `${p.color}00`);
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    });
    
    // Draw connections
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const dx = this.particles[i].x - this.particles[j].x;
        const dy = this.particles[i].y - this.particles[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 120) {
          this.ctx.strokeStyle = `rgba(59, 130, 246, ${(1 - distance / 120) * 0.15})`;
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
          this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
          this.ctx.stroke();
        }
      }
    }
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    this.update();
    this.draw();
  }
  
  destroy() {
    if (this.canvas) {
      const ctx = this.canvas.getContext('2d');
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new ParticleBackground();
  
  // Accessibility: Respect prefers-reduced-motion
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mediaQuery.matches && _particleInstance) {
    _particleInstance.destroy();
  }
});

// Export for external control (optional)
window._particleInstance = null; // Set in constructor
