class MouseTrail {
  constructor(canvasId,
    options = {},
  shape = [{x:0,y:-4},{x:1,y:-1},{x:4,y:0},{x:1,y:1},{x:0,y:4},{x:-1,y:1},{x:-4,y:0},{x:-1,y:-1}]) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.shape = shape;
    this.trail = [];
    this.maxSquares = options.maxSquares || 20;
    this.minDistance = options.minDistance || 20;
    this.lifetime = options.lifetime || 1000;
    this.sizeChange = options.sizeChange || 0.1;
    this.initialVy = options.initialVy || 1;
    this.lastX = 0;
    this.lastY = 0;
    this.minSize = options.minSize || 0.3;
    this.maxSize = options.maxSize || 1.5;
    this.color = options.color || "#c8b869";
    this.setupCanvas();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  setupCanvas() {
    this.canvas.style.position = "fixed";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = "10";
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  addPoint(x, y) {
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    if (dx * dx + dy * dy > this.minDistance * this.minDistance) {
      const count = Math.floor(Math.random() * 3) + 1;
      const now = performance.now();
      for (let j = 0; j < count; j++) {
        this.trail.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + Math.random() * 20,
          birthTime: now,
          size: 1,
          growing: Math.random() < 0.5,
          vy: this.initialVy
        });
      }
      this.lastX = x;
      this.lastY = y;

      if (this.trail.length > this.maxSquares)
        this.trail.splice(0, this.trail.length - this.maxSquares);
    }
  }

  // Called externally from a shared animation loop (no own rAF)
  update(timestamp) {
    // In-place removal of expired elements (avoids .filter() allocating new array)
    let writeIdx = 0;
    for (let i = 0; i < this.trail.length; i++) {
      if (timestamp - this.trail[i].birthTime < this.lifetime) {
        this.trail[writeIdx++] = this.trail[i];
      }
    }
    this.trail.length = writeIdx;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = this.color;

    for (let i = 0; i < this.trail.length; i++) {
      const el = this.trail[i];
      el.y += el.vy;

      if (el.growing) {
        el.size += this.sizeChange;
        if (el.size >= this.maxSize) el.growing = false;
      } else {
        el.size -= this.sizeChange;
        if (el.size <= this.minSize) el.growing = true;
      }

      const alpha = Math.max(0, 1 - (timestamp - el.birthTime) / this.lifetime);
      this.ctx.globalAlpha = alpha;

      this.ctx.beginPath();
      this.ctx.moveTo(el.x + this.shape[0].x * el.size, el.y + this.shape[0].y * el.size);
      for (let j = 1; j < this.shape.length; j++) {
        this.ctx.lineTo(el.x + this.shape[j].x * el.size, el.y + this.shape[j].y * el.size);
      }
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }
}
