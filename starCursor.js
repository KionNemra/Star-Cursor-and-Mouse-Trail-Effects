// starCursor.js

// Pre-allocated shape data (avoids per-frame allocations)
const GLOW_OFFSETS = [{x:-2, y:0}, {x:2, y:0}, {x:0, y:-2}, {x:0, y:2}];
const STAR_POINTS = [
  {x: 0, y: -4}, {x: 1, y: -1}, {x: 4, y: 0}, {x: 1, y: 1},
  {x: 0, y: 4}, {x: -1, y: 1}, {x: -4, y: 0}, {x: -1, y: -1},
];

const ALL_SHAPES = ["star", "bubble", "heart", "flower", "flame"];

function _resolveStyle(style) {
  return style === "random" ? ALL_SHAPES[Math.floor(Math.random() * ALL_SHAPES.length)] : style;
}

function _starVertices(radius) {
  var inner = radius * 0.38, pts = [];
  for (var i = 0; i < 10; i++) {
    var a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    var r = (i % 2 === 0) ? radius : inner;
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
}

function _pointInPolygon(px, py, poly) {
  var inside = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi))
      inside = !inside;
  }
  return inside;
}

function _randomPointInShape(style, spread) {
  var px, py, t, jitter, r;
  jitter = Math.random() * 0.15;

  if (style === "random") {
    // Uniform circular area (no specific shape to recognize)
    var a = Math.random() * Math.PI * 2;
    r = spread * Math.sqrt(Math.random());
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }

  if (style === "bubble") {
    // Circle perimeter
    t = Math.random() * Math.PI * 2;
    r = spread * (1 - jitter);
    return { x: Math.cos(t) * r, y: Math.sin(t) * r };
  }

  if (style === "heart") {
    // Parametric heart curve perimeter
    t = Math.random() * Math.PI * 2;
    var st = Math.sin(t);
    px = 16 * st * st * st;
    py = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    var scale = spread / 17;
    return { x: px * scale * (1 - jitter), y: py * scale * (1 - jitter) };
  }

  if (style === "flower") {
    // 5-petal rose curve perimeter
    t = Math.random() * Math.PI * 2;
    r = spread * Math.abs(Math.cos(2.5 * t));
    if (r < spread * 0.08) r = spread * 0.08;
    r *= (1 - jitter);
    return { x: Math.cos(t) * r, y: Math.sin(t) * r };
  }

  if (style === "flame") {
    // Teardrop pointing up: narrow tip at top, wider base at bottom
    t = Math.random() * Math.PI * 2;
    py = -Math.cos(t) * spread * 0.6;
    var widthScale = 0.15 + 0.35 * (1 - Math.cos(t)) * 0.5;
    px = Math.sin(t) * spread * widthScale;
    return { x: px * (1 - jitter), y: py * (1 - jitter) };
  }

  // star – distribute along perimeter so shape is recognizable at any spread
  var verts = _starVertices(spread);
  var edgeIndex = Math.floor(Math.random() * verts.length);
  var nextIndex = (edgeIndex + 1) % verts.length;
  t = Math.random();
  px = verts[edgeIndex].x + t * (verts[nextIndex].x - verts[edgeIndex].x);
  py = verts[edgeIndex].y + t * (verts[nextIndex].y - verts[edgeIndex].y);
  return { x: px * (1 - jitter), y: py * (1 - jitter) };
}

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
    this.spread = options.spread || 20;
    this.wander = options.wander || false;

    this.stars = [];
    this._wasStopped = false;
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

  _reshuffleOffsets() {
    var spreadStyle = this.style === "random" ? "bubble" : this.style;
    for (var i = 0; i < this.stars.length; i++) {
      var pt = _randomPointInShape(spreadStyle, this.spread);
      this.stars[i].offsetX = pt.x;
      this.stars[i].offsetY = pt.y;
      if (this.style === "random") {
        this.stars[i].resolvedStyle = _resolveStyle(this.style);
      }
    }
  }

  /** Auto-generate N stars with random positions within shape-defined area. */
  generateStars(count) {
    this.stars = [];
    var cx = window.innerWidth / 2;
    var cy = window.innerHeight / 2;
    var spreadStyle = this.style === "random" ? "bubble" : this.style;

    for (var i = 0; i < count; i++) {
      var pt = _randomPointInShape(spreadStyle, this.spread);
      var isMain = (i === 0);
      var size = isMain ? 1 : 0.4 + Math.random() * 0.6;
      var maxSize = isMain ? 2 : 0.8 + Math.random() * 0.7;
      var growFactor = 0.05 + Math.random() * 0.25;
      var growInterval = 80 + Math.floor(Math.random() * 120);
      var star = new Star(cx, cy, size, maxSize, Math.min(size, 0.5), growFactor,
        pt.x, pt.y, growInterval);
      star.resolvedStyle = _resolveStyle(this.style);
      this.addStar(star);
    }
  }

  // Called externally from a shared animation loop (no own rAF)
  update(timestamp) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.mouseStopped) {
      // Re-randomize offsets each time mouse stops (new pattern every hover)
      if (!this._wasStopped) {
        this._reshuffleOffsets();
        this._wasStopped = true;
      }
      this.opacity = Math.min(1, this.opacity + this.fadeInSpeed);
    } else {
      this._wasStopped = false;
      this.opacity = Math.max(0, this.opacity - this.fadeOutSpeed);
    }

    if (this.opacity > 0) {
      // Wander: particles smoothly drift to new random positions
      if (this.wander && this.mouseStopped) {
        var spreadStyle = this.style === "random" ? "bubble" : this.style;
        for (var i = 0; i < this.stars.length; i++) {
          var star = this.stars[i];
          if (!star._wanderTarget || timestamp - (star._lastWanderTime || 0) > (star._wanderInterval || 0)) {
            var pt = _randomPointInShape(spreadStyle, this.spread);
            star._wanderTarget = { x: pt.x, y: pt.y };
            star._lastWanderTime = timestamp;
            star._wanderInterval = 800 + Math.random() * 2000;
          }
          star.offsetX += (star._wanderTarget.x - star.offsetX) * 0.03;
          star.offsetY += (star._wanderTarget.y - star.offsetY) * 0.03;
        }
      }
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
          this.stars[i].draw(this.ctx, this.tempCtx, this.tempCanvas, sc, gc,
            this.stars[i].resolvedStyle || this.style, this.sizeScale, timestamp);
        }
      } else {
        for (var i = 0; i < this.stars.length; i++) {
          this.stars[i].draw(this.ctx, this.tempCtx, this.tempCanvas, this.starColor, this.glowColor,
            this.stars[i].resolvedStyle || this.style, this.sizeScale, timestamp);
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
    this.resolvedStyle = null;
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

  draw(ctx, tempCtx, tempCanvas, color, glowColor, style, sizeScale, timestamp) {
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
    } else if (style === "flower") {
      var rot = timestamp ? timestamp * 0.002 : 0;
      var pl = s * 3, pw = s * 1.2;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(rot);
      for (var p = 0; p < 5; p++) {
        ctx.save();
        ctx.rotate((p / 5) * Math.PI * 2);
        ctx.beginPath();
        ctx.ellipse(0, -pl * 0.5, pw, pl * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.fillStyle = "#fff8dc";
      ctx.globalAlpha = ctx.globalAlpha * 0.7;
      ctx.fill();
      ctx.restore();
    } else if (style === "flame") {
      var fh = s * 4, fw = s * 2;
      ctx.save();
      ctx.translate(this.x, this.y);
      var flicker = timestamp ? Math.sin(timestamp * 0.01 + this.x * 0.1) * 0.5 + 0.5 : 0.5;
      var fHue = 20 + flicker * 40;
      ctx.beginPath();
      ctx.moveTo(0, -fh * 0.5);
      ctx.bezierCurveTo(fw, -fh * 0.15, fw * 0.5, fh * 0.4, 0, fh * 0.5);
      ctx.bezierCurveTo(-fw * 0.5, fh * 0.4, -fw, -fh * 0.15, 0, -fh * 0.5);
      ctx.closePath();
      ctx.fillStyle = "hsl(" + fHue + ",100%,55%)";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -fh * 0.3);
      ctx.bezierCurveTo(fw * 0.4, -fh * 0.05, fw * 0.2, fh * 0.25, 0, fh * 0.3);
      ctx.bezierCurveTo(-fw * 0.2, fh * 0.25, -fw * 0.4, -fh * 0.05, 0, -fh * 0.3);
      ctx.closePath();
      ctx.fillStyle = "hsl(" + Math.min(fHue + 15, 60) + ",100%,70%)";
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
