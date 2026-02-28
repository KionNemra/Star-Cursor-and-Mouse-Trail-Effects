class MouseTrail {
  constructor(canvasId,
    options = {},
  shape = [{x:0,y:-4},{x:1,y:-1},{x:4,y:0},{x:1,y:1},{x:0,y:4},{x:-1,y:1},{x:-4,y:0},{x:-1,y:-1}]) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.shape = shape;
    this.style = options.style || "star";
    this.burstStyle = options.burstStyle || this.style;
    this.sizeScale = options.sizeScale || 1;
    this._ALL_SHAPES = ["star", "bubble", "heart"];
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

    // Rainbow mode
    this.colorMode = options.colorMode || "fixed";
    this.rainbowSpeed = options.rainbowSpeed || 3;
    this.rainbowSaturation = options.rainbowSaturation || 100;
    this.rainbowLightness = options.rainbowLightness || 65;
    this._rainbowHue = 0;

    this.setupCanvas();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  _resolveStyle(style) {
    return style === "random" ? this._ALL_SHAPES[Math.floor(Math.random() * 3)] : style;
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
          vx: 0,
          vy: this.initialVy,
          hue: this._rainbowHue,
          shapeStyle: this._resolveStyle(this.style)
        });
      }
      this._rainbowHue = (this._rainbowHue + this.rainbowSpeed) % 360;
      this.lastX = x;
      this.lastY = y;

      if (this.trail.length > this.maxSquares)
        this.trail.splice(0, this.trail.length - this.maxSquares);
    }
  }

  addBurst(x, y, count) {
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 1.5 + Math.random() * 3;
      this.trail.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        birthTime: now,
        size: 0.8 + Math.random() * 0.7,
        growing: Math.random() < 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        hue: this.colorMode === "rainbow"
          ? (this._rainbowHue + (i / count) * 360) % 360
          : 0,
        shapeStyle: this._resolveStyle(this.burstStyle)
      });
    }
    if (this.colorMode === "rainbow") {
      this._rainbowHue = (this._rainbowHue + 60) % 360;
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

    const isRainbow = this.colorMode === "rainbow";
    if (!isRainbow) this.ctx.fillStyle = this.color;

    for (let i = 0; i < this.trail.length; i++) {
      const el = this.trail[i];
      el.x += el.vx;
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

      if (isRainbow) {
        this.ctx.fillStyle = "hsl(" + el.hue + "," + this.rainbowSaturation + "%," + this.rainbowLightness + "%)";
      }

      const pStyle = el.shapeStyle || this.style;
      const sz = el.size * this.sizeScale;

      if (pStyle === "bubble") {
        this.ctx.beginPath();
        this.ctx.arc(el.x, el.y, sz * 4, 0, Math.PI * 2);
        this.ctx.fill();
        // highlight for glossy bubble look
        this.ctx.save();
        this.ctx.globalAlpha = alpha * 0.4;
        this.ctx.fillStyle = "#ffffff";
        this.ctx.beginPath();
        this.ctx.arc(el.x - sz * 1.2, el.y - sz * 1.2, sz * 1.2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        if (isRainbow) this.ctx.fillStyle = "hsl(" + el.hue + "," + this.rainbowSaturation + "%," + this.rainbowLightness + "%)";
        else this.ctx.fillStyle = this.color;
      } else if (pStyle === "heart") {
        var s = sz * 3;
        this.ctx.save();
        this.ctx.translate(el.x, el.y);
        this.ctx.beginPath();
        this.ctx.moveTo(0, s * 0.3);
        this.ctx.bezierCurveTo(-s, -s * 0.6, -s * 0.5, -s * 1.2, 0, -s * 0.5);
        this.ctx.bezierCurveTo(s * 0.5, -s * 1.2, s, -s * 0.6, 0, s * 0.3);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
      } else {
        this.ctx.beginPath();
        this.ctx.moveTo(el.x + this.shape[0].x * sz, el.y + this.shape[0].y * sz);
        for (let j = 1; j < this.shape.length; j++) {
          this.ctx.lineTo(el.x + this.shape[j].x * sz, el.y + this.shape[j].y * sz);
        }
        this.ctx.closePath();
        this.ctx.fill();
      }
    }
    this.ctx.globalAlpha = 1;
  }
}
