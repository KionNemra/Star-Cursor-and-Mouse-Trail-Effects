const _MT_TWO_PI = Math.PI * 2;

class MouseTrail {
  constructor(canvasId,
    options = {},
  shape = [{x:0,y:-4},{x:1,y:-1},{x:4,y:0},{x:1,y:1},{x:0,y:4},{x:-1,y:1},{x:-4,y:0},{x:-1,y:-1}]) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d', { desynchronized: true });
    this.shape = shape;
    this.style = options.style || "star";
    this.burstStyle = options.burstStyle || this.style;
    this.sizeScale = options.sizeScale || 1;
    this._ALL_SHAPES = ["star", "bubble", "heart", "flower", "flame"];
    this.trail = [];
    this.maxSquares = options.maxSquares || 20;
    this.minDistance = options.minDistance || 20;
    this.lifetime = options.lifetime || 1000;
    this.burstLifetime = options.burstLifetime || this.lifetime;
    this.sizeChange = options.sizeChange || 0.1;
    this.initialVy = options.initialVy || 1;
    this.lastX = 0;
    this.lastY = 0;
    this.minSize = options.minSize || 0.3;
    this.maxSize = options.maxSize || 1.5;
    this.color = options.color || "#c8b869";
    this._hadContent = false;

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
    return style === "random" ? this._ALL_SHAPES[Math.floor(Math.random() * this._ALL_SHAPES.length)] : style;
  }

  setupCanvas() {
    this.canvas.style.position = "fixed";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = "10";
    // GPU layer promotion: isolate canvas compositing from heavy page effects
    this.canvas.style.willChange = "transform";
    this.canvas.style.transform = "translateZ(0)";
    this.canvas.style.contain = "strict";
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
        const resolved = this._resolveStyle(this.style);
        let pVx = 0, pVy = this.initialVy;
        if (resolved === "flame") { pVy = -0.5 - Math.random() * 0.5; pVx = (Math.random() - 0.5) * 1.5; }
        this.trail.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + Math.random() * 20,
          birthTime: now,
          size: 1,
          growing: Math.random() < 0.5,
          vx: pVx,
          vy: pVy,
          hue: this._rainbowHue,
          shapeStyle: resolved,
          lifetime: this.lifetime
        });
      }
      this._rainbowHue = (this._rainbowHue + this.rainbowSpeed) % 360;
      this.lastX = x;
      this.lastY = y;
      // Trim excess — drop oldest particles (front) so newest ones near cursor survive
      if (this.trail.length > this.maxSquares)
        this.trail.splice(0, this.trail.length - this.maxSquares);
    }
  }

  addBurst(x, y, count) {
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * _MT_TWO_PI + (Math.random() - 0.5) * 0.5;
      const speed = 1.5 + Math.random() * 3;
      const resolved = this._resolveStyle(this.burstStyle);
      let bVx = Math.cos(angle) * speed;
      let bVy = Math.sin(angle) * speed;
      if (resolved === "flame") bVy -= 1;
      this.trail.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        birthTime: now,
        size: 0.8 + Math.random() * 0.7,
        growing: Math.random() < 0.5,
        vx: bVx,
        vy: bVy,
        hue: this.colorMode === "rainbow"
          ? (this._rainbowHue + (i / count) * 360) % 360
          : 0,
        shapeStyle: resolved,
        lifetime: this.burstLifetime
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
      if (timestamp - this.trail[i].birthTime < (this.trail[i].lifetime || this.lifetime)) {
        this.trail[writeIdx++] = this.trail[i];
      }
    }
    this.trail.length = writeIdx;

    // Idle skip: nothing to draw → clear once then skip future frames
    if (this.trail.length === 0) {
      if (this._hadContent) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this._hadContent = false;
      }
      return;
    }
    this._hadContent = true;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const isRainbow = this.colorMode === "rainbow";
    const ctx = this.ctx;
    if (!isRainbow) ctx.fillStyle = this.color;

    for (let i = 0; i < this.trail.length; i++) {
      const el = this.trail[i];
      el.x += el.vx;
      el.y += el.vy;
      if (el.shapeStyle === "flame") el.vx += (Math.random() - 0.5) * 0.2;

      if (el.growing) {
        el.size += this.sizeChange;
        if (el.size >= this.maxSize) el.growing = false;
      } else {
        el.size -= this.sizeChange;
        if (el.size <= this.minSize) el.growing = true;
      }

      const pLifetime = el.lifetime || this.lifetime;
      const alpha = Math.max(0, 1 - (timestamp - el.birthTime) / pLifetime);
      ctx.globalAlpha = alpha;

      if (isRainbow) {
        ctx.fillStyle = "hsl(" + el.hue + "," + this.rainbowSaturation + "%," + this.rainbowLightness + "%)";
      }

      const pStyle = el.shapeStyle || this.style;
      const sz = el.size * this.sizeScale;

      if (pStyle === "bubble") {
        ctx.beginPath();
        ctx.arc(el.x, el.y, sz * 4, 0, _MT_TWO_PI);
        ctx.fill();
        ctx.save();
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(el.x - sz * 1.2, el.y - sz * 1.2, sz * 1.2, 0, _MT_TWO_PI);
        ctx.fill();
        ctx.restore();
        if (isRainbow) ctx.fillStyle = "hsl(" + el.hue + "," + this.rainbowSaturation + "%," + this.rainbowLightness + "%)";
        else ctx.fillStyle = this.color;
      } else if (pStyle === "heart") {
        var s = sz * 3;
        ctx.save();
        ctx.translate(el.x, el.y);
        ctx.beginPath();
        ctx.moveTo(0, s * 0.3);
        ctx.bezierCurveTo(-s, -s * 0.6, -s * 0.5, -s * 1.2, 0, -s * 0.5);
        ctx.bezierCurveTo(s * 0.5, -s * 1.2, s, -s * 0.6, 0, s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (pStyle === "flower") {
        var rot = (timestamp - el.birthTime) * 0.003;
        var pl = sz * 3, pw = sz * 1.2;
        ctx.save();
        ctx.translate(el.x, el.y);
        ctx.rotate(rot);
        for (var p = 0; p < 5; p++) {
          ctx.rotate(_MT_TWO_PI / 5);
          ctx.beginPath();
          ctx.ellipse(0, -pl * 0.5, pw, pl * 0.5, 0, 0, _MT_TWO_PI);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, 0, sz, 0, _MT_TWO_PI);
        var prevAlpha = ctx.globalAlpha;
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = "#fff8dc";
        ctx.fill();
        ctx.globalAlpha = prevAlpha;
        ctx.restore();
      } else if (pStyle === "flame") {
        var age = (timestamp - el.birthTime) / pLifetime;
        var fHue = 60 - age * 60;
        var fLit = 65 - age * 30;
        ctx.fillStyle = "hsl(" + fHue + ",100%," + fLit + "%)";
        var fh = sz * 4, fw = sz * 2;
        ctx.save();
        ctx.translate(el.x, el.y);
        ctx.beginPath();
        ctx.moveTo(0, -fh * 0.5);
        ctx.bezierCurveTo(fw, -fh * 0.15, fw * 0.5, fh * 0.4, 0, fh * 0.5);
        ctx.bezierCurveTo(-fw * 0.5, fh * 0.4, -fw, -fh * 0.15, 0, -fh * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, -fh * 0.3);
        ctx.bezierCurveTo(fw * 0.4, -fh * 0.05, fw * 0.2, fh * 0.25, 0, fh * 0.3);
        ctx.bezierCurveTo(-fw * 0.2, fh * 0.25, -fw * 0.4, -fh * 0.05, 0, -fh * 0.3);
        ctx.closePath();
        ctx.fillStyle = "hsl(" + Math.min(fHue + 15, 60) + ",100%," + Math.min(fLit + 15, 85) + "%)";
        ctx.fill();
        ctx.restore();
        if (isRainbow) ctx.fillStyle = "hsl(" + el.hue + "," + this.rainbowSaturation + "%," + this.rainbowLightness + "%)";
        else ctx.fillStyle = this.color;
      } else {
        ctx.beginPath();
        ctx.moveTo(el.x + this.shape[0].x * sz, el.y + this.shape[0].y * sz);
        for (let j = 1; j < this.shape.length; j++) {
          ctx.lineTo(el.x + this.shape[j].x * sz, el.y + this.shape[j].y * sz);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
