// starCursor.js

// Pre-allocated shape data (avoids per-frame allocations)
const GLOW_OFFSETS = [{x:-2, y:0}, {x:2, y:0}, {x:0, y:-2}, {x:0, y:2}];
const STAR_POINTS = [
  {x: 0, y: -4}, {x: 1, y: -1}, {x: 4, y: 0}, {x: 1, y: 1},
  {x: 0, y: 4}, {x: -1, y: 1}, {x: -4, y: 0}, {x: -1, y: -1},
];

class StarCursor {
  constructor(canvas, options = {}) {
    this.canvas = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
    this.ctx = this.canvas.getContext('2d');

    // Small fixed-size temp canvas for glow (NOT full-screen)
    this.tempCanvas = document.createElement("canvas");
    this.tempCanvas.width = 64;
    this.tempCanvas.height = 64;
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
    this.stopDelay = options.stopDelay || 100;
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

    this.glowColor = options.glowColor || "#e8c01eff";
    this.starColor = options.starColor || "#c8b869";

    // Rainbow mode
    this.colorMode = options.colorMode || "fixed";
    this.rainbowSpeed = options.rainbowSpeed || 3;
    this.rainbowSaturation = options.rainbowSaturation || 100;
    this.rainbowLightness = options.rainbowLightness || 65;

    this.style = options.style || "star";
    this.sizeScale = options.sizeScale || 1;

    this.stars = [];
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setupCanvas() {
    this.canvas.style.position = "fixed";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.pointerEvents = "none";
    this.canvas.style.zIndex = "10";
  }

  addStar(star) {
    this.stars.push(star);
  }

  /** Auto-generate N stars with varied positions and animation params. */
  generateStars(count) {
    this.stars = [];
    var cx = window.innerWidth / 2;
    var cy = window.innerHeight / 2;

    // For default count of 3, use the original hand-tuned layout
    if (count === 3) {
      this.addStar(new Star(cx, cy, 1, 2, 1, 0.3, -10, 0, 150));
      this.addStar(new Star(cx, cy, 0.5, 1, 0.5, 0.05, 10));
      this.addStar(new Star(cx, cy, 0.5, 1, 0.5, 0.1, -5, 20));
      return;
    }

    for (var i = 0; i < count; i++) {
      var angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      var dist = 10 + (i % 2) * 8;
      var offsetX = Math.round(Math.cos(angle) * dist);
      var offsetY = Math.round(Math.sin(angle) * dist);
      var isMain = (i === 0);
      var size = isMain ? 1 : 0.5;
      var maxSize = isMain ? 2 : 1;
      var growFactor = 0.05 + (i % 4) * 0.07;
      var growInterval = 100 + (i % 3) * 50;
      this.addStar(new Star(cx, cy, size, maxSize, size, growFactor, offsetX, offsetY, growInterval));
    }
  }

  // Called externally from a shared animation loop (no own rAF)
  update(timestamp) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.mouseStopped) {
      this.opacity = Math.min(1, this.opacity + this.fadeInSpeed);
    } else {
      this.opacity = Math.max(0, this.opacity - this.fadeOutSpeed);
    }

    if (this.opacity > 0) {
      for (var i = 0; i < this.stars.length; i++) {
        this.stars[i].update(this.mouseX, this.mouseY, timestamp);
      }

      this.ctx.save();
      this.ctx.globalAlpha = this.opacity;

      if (this.colorMode === "rainbow") {
        var baseHue = (timestamp * this.rainbowSpeed * 0.1) % 360;
        var starCount = this.stars.length;
        for (var i = 0; i < starCount; i++) {
          var hue = (baseHue + i * (360 / starCount)) % 360;
          var sc = "hsl(" + hue + "," + this.rainbowSaturation + "%," + this.rainbowLightness + "%)";
          var gc = "hsla(" + hue + "," + this.rainbowSaturation + "%," + Math.min(this.rainbowLightness + 10, 100) + "%,1)";
          this.stars[i].draw(this.ctx, this.tempCtx, this.tempCanvas, sc, gc, this.style, this.sizeScale);
        }
      } else {
        for (var i = 0; i < this.stars.length; i++) {
          this.stars[i].draw(this.ctx, this.tempCtx, this.tempCanvas, this.starColor, this.glowColor, this.style, this.sizeScale);
        }
      }

      this.ctx.restore();
    }
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
    this.lastGrowTime = 0;
  }

  update(targetX, targetY, timestamp) {
    this.x = targetX + this.offsetX;
    this.y = targetY + this.offsetY;

    if (timestamp - this.lastGrowTime >= this.growInterval) {
      this.size += this.growing ? this.growFactor : -this.growFactor;
      if (this.size >= this.maxSize) this.growing = false;
      if (this.size <= this.minSize) this.growing = true;
      this.lastGrowTime = timestamp;
    }
  }

  draw(ctx, tempCtx, tempCanvas, color, glowColor, style, sizeScale) {
    const s = this.size * (sizeScale || 1);
    const cx = tempCanvas.width / 2;
    const cy = tempCanvas.height / 2;

    // Draw glow on small local temp canvas (64x64 instead of full-screen)
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    for (let i = 0; i < GLOW_OFFSETS.length; i++) {
      const c = GLOW_OFFSETS[i];
      tempCtx.beginPath();
      tempCtx.arc(cx + c.x * s, cy + c.y * s, s * 3, 0, Math.PI * 2);
      tempCtx.fillStyle = color;
      tempCtx.fill();
    }

    // Blit small glow canvas to main canvas at star position
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.drawImage(tempCanvas, this.x - cx, this.y - cy);
    ctx.restore();

    // Draw shape based on style
    if (style === "bubble") {
      ctx.beginPath();
      ctx.arc(this.x, this.y, s * 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      // glossy highlight
      ctx.save();
      ctx.globalAlpha = ctx.globalAlpha * 0.4;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(this.x - s * 1.2, this.y - s * 1.2, s * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (style === "heart") {
      var hs = s * 3;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.beginPath();
      ctx.moveTo(0, hs * 0.3);
      ctx.bezierCurveTo(-hs, -hs * 0.6, -hs * 0.5, -hs * 1.2, 0, -hs * 0.5);
      ctx.bezierCurveTo(hs * 0.5, -hs * 1.2, hs, -hs * 0.6, 0, hs * 0.3);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    } else {
      // Default star shape
      ctx.beginPath();
      ctx.moveTo(this.x + STAR_POINTS[0].x * s, this.y + STAR_POINTS[0].y * s);
      for (let i = 1; i < STAR_POINTS.length; i++) {
        ctx.lineTo(this.x + STAR_POINTS[i].x * s, this.y + STAR_POINTS[i].y * s);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}
