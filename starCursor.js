// starCursor.js
class StarCursor {
  constructor(canvas, options = {}) {
    // Allow passing either canvas element or ID
    this.canvas = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
    this.ctx = this.canvas.getContext('2d');

    // Temp canvas for glow effect
    this.tempCanvas = document.createElement("canvas");
    this.tempCtx = this.tempCanvas.getContext("2d");
    this.setupCanvas();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    // Mouse position
    this.mouseX = this.canvas.width / 2;
    this.mouseY = this.canvas.height / 2;

    // Mouse stop detection
    this.mouseStopTimeout = null;
    this.mouseStopped = false;
    this.opacity = 0;
    this.stopDelay = options.stopDelay || 100; // ms before considering mouse "stopped"
    this.fadeInSpeed = options.fadeInSpeed || 0.08;
    this.fadeOutSpeed = options.fadeOutSpeed || 0.15;

    window.addEventListener("mousemove", e => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.mouseStopped = false;
      clearTimeout(this.mouseStopTimeout);
      this.mouseStopTimeout = setTimeout(() => {
        this.mouseStopped = true;
      }, this.stopDelay);
    });

    // Options
    this.glowColor = options.glowColor || "#e8c01eff";
    this.starColor = options.starColor || "#c8b869";

    // Array of stars
    this.stars = [];
  }

  resizeCanvas() {
    this.canvas.width = this.tempCanvas.width = window.innerWidth;
    this.canvas.height = this.tempCanvas.height = window.innerHeight;
  }
 
  setupCanvas(){
    // CSS only controls position/size visually:
    this.canvas.style.position = "fixed";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = "10";
  }

  addStar(star) {
    this.stars.push(star);
  }

  start() {
    const animate = () => {

      this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);

      // Fade in when stopped, fade out when moving
      if (this.mouseStopped) {
        this.opacity = Math.min(1, this.opacity + this.fadeInSpeed);
      } else {
        this.opacity = Math.max(0, this.opacity - this.fadeOutSpeed);
      }

      // Update & draw all stars (only if visible)
      if (this.opacity > 0) {
        this.stars.forEach(star => star.update(this.mouseX, this.mouseY));
        this.ctx.save();
        this.ctx.globalAlpha = this.opacity;
        this.stars.forEach(star => star.draw(this.ctx, this.tempCtx, this.tempCanvas, this.starColor, this.glowColor));
        this.ctx.restore();
      }

      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
}

// Star class
class Star {
  constructor(x, y, size = 1, maxSize = 3, minSize = 1, growFactor = 0.1, offsetX = 0, offsetY = 0, growInterval = 100) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.maxSize = maxSize;
    this.minSize = minSize;
    this.growFactor = growFactor;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.growing = true;
    this.growInterval = growInterval;
    this.lastGrowTime = Date.now();
  }

  update(targetX, targetY) {

    // Move toward cursor
    this.x = targetX + this.offsetX ;
    this.y = targetY + this.offsetY ;

    // Twinkle/grow logic
    const now = Date.now();
    if (now - this.lastGrowTime >= this.growInterval) {
      this.size += this.growing ? this.growFactor : -this.growFactor;
      if (this.size >= this.maxSize) this.growing = false;
      if (this.size <= this.minSize) this.growing = true;
      this.lastGrowTime = now;
    }
  }

  draw(ctx, tempCtx, tempCanvas, color = "#c8b869", glowColor = "#e8c01eff") {
        
    // Draw glowing circles to temp canvas
    const circles = [
      {x:-2, y:0}, {x:2,y:0}, {x:0,y:-2}, {x:0,y:2}
    ];
    tempCtx.clearRect(0,0,tempCanvas.width,tempCanvas.height);
    circles.forEach(c => {
      tempCtx.beginPath();
      tempCtx.arc(this.x + c.x*this.size, this.y + c.y*this.size, this.size * 3, 0, Math.PI*2);
      tempCtx.fillStyle = color;
      tempCtx.fill();
    });

    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.drawImage(tempCanvas,0,0);
    ctx.restore();
    ctx.save(); 
    // Draw filled star
    const points = [
      {x: 0, y: -4},
      {x: 1, y: -1},
      {x: 4, y: 0},
      {x: 1, y: 1},
      {x: 0, y: 4},
      {x: -1, y: 1},
      {x: -4, y: 0},
      {x: -1, y: -1},
    ];

    ctx.beginPath();
    ctx.moveTo(this.x + points[0].x * this.size, this.y + points[0].y * this.size);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(this.x + points[i].x * this.size, this.y + points[i].y * this.size);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
    
  }
}