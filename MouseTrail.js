class MouseTrail {
  constructor(canvasId, 
    options = {},
  shape = [{x:0,y:-4},{x:1,y:-1},{x:4,y:0},{x:1,y:1},{x:0,y:4},{x:-1,y:1},{x:-4,y:0},{x:-1,y:-1}]) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.shape =shape;
    this.trail = [];
    this.maxSquares = options.maxSquares || 20;
    this.minDistance = options.minDistance || 20;
    this.lifetime = options.lifetime || 1000;
    this.sizeChange = options.sizeChange || 0.1;
    this.initialVy = options.initialVy || 1; // starting fall speed
    this.lastPosition = {x:0, y:0};
    this.shapeIndex = 0;
    this.minSize = options.minSize || 0.3;
    this.maxSize = options.maxSize || 1.5;
    this.color = options.color || "#c8b869";
    this.setupCanvas();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }
  setupCanvas(){
    // CSS only controls position/size visually:
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
   
    const dist = Math.hypot(x - this.lastPosition.x, y - this.lastPosition.y);
    if (dist > this.minDistance) {

        // Decide how many copies to spawn: 1, 2, or 3
        const count = Math.floor(Math.random() * 3) + 1; // random int 1,2,3

        // Generate offsets for each copy
        const offsets = Array.from({length: count}, () => ({
        x: (Math.random() - 0.5) * 20, // random X offset between -10 and +10
        y: (Math.random()) * 20  // random Y offset between -10 and +10
        }));

        // Spawn each trail element with its offset
        offsets.forEach(offset => {
            this.trail.push({
                x: x + offset.x,
                y: y + offset.y,
                birthTime: Date.now(),
                size: 1,
                growing: Math.random() < 0.5,
                vy: this.initialVy
            });
        });

        this.lastPosition = {x, y};

        if (this.trail.length > this.maxSquares)
        this.trail.splice(0, this.trail.length - this.maxSquares);
    }
  }

  update() {
    const now = Date.now();
    this.trail = this.trail.filter(el => now - el.birthTime < this.lifetime);

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.trail.forEach(el => {
      // Apply gravity
      el.y += el.vy;          // move

        if (el.growing) {
        el.size += this.sizeChange;
        if (el.size >= this.maxSize) el.growing = false;
      } else {
        el.size -= this.sizeChange;
        if (el.size <= this.minSize) el.growing = true;
      }

      // Fade out near end of lifetime (optional)
      const age = now - el.birthTime;
      const alpha = Math.max(0, 1 - age / this.lifetime);
      this.ctx.fillStyle = this.color;
    this.ctx.globalAlpha = alpha;
      // Draw shape
    this.ctx.beginPath();
    this.ctx.moveTo(el.x+ this.shape[0].x * el.size, el.y+ this.shape[0].y * el.size);
    for (let i = 1; i < this.shape.length; i++) {
        this.ctx.lineTo(el.x + this.shape[i].x * el.size, el.y + this.shape[i].y * el.size);
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.globalAlpha = 1; // reset for next draw
    });
  }
}
