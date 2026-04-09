/** HQ Main Interactive — Particle visualizer for agent status */
(function() { 'use strict';

  /**
   * HQVisualizer creates particle animation showing active AI agents
   * Auto-initializes on page load with graceful degradation
   */
  var HQVisualizer = function() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.connections = [];
    this.particleCount = 80;
    this.animationFrameId = null;
  };

  HQVisualizer.prototype.init = function() {
    try {
      this.canvas = document.getElementById('particle-bg');
      if (!this.canvas) throw new Error('Canvas element not found');
      
      this.ctx = this.canvas.getContext('2d');
      if (!this.ctx) throw new Error('Canvas context unavailable');
      
      window.addEventListener('resize', this.onResize.bind(this), { passive: true });
      this.resize();
      this.animate();
    } catch (error) {
      document.body.classList.add('visualizer-error-loading');
}
  };

  HQVisualizer.prototype.onResize = function() {
    if (!this.canvas || !this.ctx) return;
    
    var width = window.innerWidth;
    var height = window.innerHeight;
    this.canvas.width = width;
    this.canvas.height = height;
    this.createParticles();
  };

  HQVisualizer.prototype.createParticles = function() {
    this.particles = [];
    for (var i = 0; i < this.particleCount; i++) {
      var particle = {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1,
        color: '#3B82F6',
        alpha: Math.random() * 0.5 + 0.5
      };
      this.particles.push(particle);
    }
  };

  HQVisualizer.prototype.drawParticles = function() {
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      
      if (p.x < 0 || p.x > window.innerWidth) p.vx *= -1;
      if (p.y < 0 || p.y > window.innerHeight) p.vy *= -1;
    }

    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(59, 130, 246,' + p.alpha + ')';
      this.ctx.fill();
    }
  };

  HQVisualizer.prototype.drawConnections = function() {
    for (var i = 0; i < this.particles.length; i++) {
      for (var j = i + 1; j < this.particles.length; j++) {
        var dx = this.particles[i].x - this.particles[j].x;
        var dy = this.particles[i].y - this.particles[j].y;
        var distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 150) {
          var opacity = 1 - distance / 150;
          this.ctx.beginPath();
          this.ctx.strokeStyle = 'rgba(59, 130, 246,' + (opacity * 0.5) + ')';
          this.ctx.lineWidth = 1;
          this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
          this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
          this.ctx.stroke();
        }
      }
    }
  };

  HQVisualizer.prototype.animate = function() {
    if (!this.canvas || !this.ctx) return;
    
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    this.drawParticles();
    this.drawConnections();
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
  };

  HQVisualizer.prototype.cleanup = function() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    const canvas = document.getElementById('particle-bg');
    if (canvas && this.ctx) {
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Auto-initialize when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      new HQVisualizer().init();
    });
  } else {
    new HQVisualizer().init();
  }

})();
