// star-effects.js — All-in-one mouse effect bundle
// Add ONE <script> tag to any page to enable star cursor / trail effects.
// Reads visitor preferences from localStorage; exposes StarEffectsRuntime API
// for the optional settings panel (star-effects-panel.js).
//
// Usage:  <script src="/seffects/star-effects.js"></script>

(function () {
  "use strict";

  // ═══════════════════════════════════════════
  //  Auto-detect base path (for cursor files)
  // ═══════════════════════════════════════════
  var _cs = document.currentScript || (function () {
    var ss = document.getElementsByTagName("script");
    return ss[ss.length - 1];
  })();
  var BASE_PATH = _cs.src.replace(/[^\/]*$/, "");

  // ═══════════════════════════════════════════
  //  Default settings
  // ═══════════════════════════════════════════
  var STORAGE_KEY = "starEffectsSettings";

  var DEFAULTS = {
    _disabled: false,
    colorMode: "fixed",        // "fixed" | "rainbow"
    color: "#c8b869",
    glowColor: "#e8c01e",
    rainbowSpeed: 3,
    rainbowSaturation: 100,
    rainbowLightness: 65,
    trailMaxCount: 20,
    cursorStarCount: 3,
    clickBurst: false,
    clickBurstCount: 12,
    trailStyle: "star",        // "star" | "bubble" | "heart" | "flower" | "flame"
    cursorStyle: "star",
    burstStyle: "star",        // "star" | "bubble" | "heart" | "flower" | "flame"
    trailLifetime: 1000,       // trail particle linger duration (300-5000 ms)
    burstLifetime: 1000,       // burst particle linger duration (300-5000 ms)
    trailSize: 100,            // trail particle size scale (50-200 %)
    cursorSize: 100,           // cursor star size scale   (50-200 %)
    cursorSpread: 20,          // cursor star spread range (10-100 px)
    cursorWander: false,       // particles drift to random positions within spread
    cursor: ""                 // filename like "cyan.ani", "" = browser default
  };

  function loadSettings() {
    try {
      var s = localStorage.getItem(STORAGE_KEY);
      return s ? JSON.parse(s) : {};
    } catch (e) { return {}; }
  }

  function saveSettings(obj) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); }
    catch (e) { /* quota exceeded or private mode */ }
  }

  function merge(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (src) for (var k in src) if (src.hasOwnProperty(k)) target[k] = src[k];
    }
    return target;
  }

  // ═══════════════════════════════════════════
  //  Shape helpers
  // ═══════════════════════════════════════════

  var TWO_PI = Math.PI * 2;
  var FADE_OUT_MS = 200; // soft-expire fade duration for over-limit particles
  var ALL_SHAPES = ["star", "bubble", "heart", "flower", "flame"];

  function resolveStyle(style) {
    return style === "random" ? ALL_SHAPES[Math.floor(Math.random() * ALL_SHAPES.length)] : style;
  }

  function starVertices(radius) {
    var inner = radius * 0.38, pts = [];
    for (var i = 0; i < 10; i++) {
      var a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      var r = (i % 2 === 0) ? radius : inner;
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return pts;
  }

  function pointInPolygon(px, py, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi))
        inside = !inside;
    }
    return inside;
  }

  function randomPointInShape(style, spread) {
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
    var verts = starVertices(spread);
    var edgeIndex = Math.floor(Math.random() * verts.length);
    var nextIndex = (edgeIndex + 1) % verts.length;
    t = Math.random();
    px = verts[edgeIndex].x + t * (verts[nextIndex].x - verts[edgeIndex].x);
    py = verts[edgeIndex].y + t * (verts[nextIndex].y - verts[edgeIndex].y);
    return { x: px * (1 - jitter), y: py * (1 - jitter) };
  }

  // ═══════════════════════════════════════════
  //  MouseTrail (embedded)
  // ═══════════════════════════════════════════

  function MouseTrail(canvas, options) {
    var shape = [
      { x: 0, y: -4 }, { x: 1, y: -1 }, { x: 4, y: 0 }, { x: 1, y: 1 },
      { x: 0, y: 4 }, { x: -1, y: 1 }, { x: -4, y: 0 }, { x: -1, y: -1 }
    ];
    options = options || {};
    this.canvas = typeof canvas === "string" ? document.getElementById(canvas) : canvas;
    this.ctx = this.canvas.getContext("2d", { desynchronized: true });
    this.shape = shape;
    this.style = options.style || "star";
    this.burstStyle = options.burstStyle || this.style;
    this.sizeScale = options.sizeScale || 1;
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
    this.colorMode = options.colorMode || "fixed";
    this.rainbowSpeed = options.rainbowSpeed || 3;
    this.rainbowSaturation = options.rainbowSaturation || 100;
    this.rainbowLightness = options.rainbowLightness || 65;
    this._rainbowHue = 0;

    var self = this;
    this._resizeHandler = function () { self.resizeCanvas(); };
    this._setupCanvas();
    this.resizeCanvas();
    window.addEventListener("resize", this._resizeHandler);
  }

  MouseTrail.prototype._setupCanvas = function () {
    var s = this.canvas.style;
    s.position = "fixed";
    s.top = "0";
    s.left = "0";
    s.width = "100%";
    s.height = "100%";
    s.pointerEvents = "none";
    s.zIndex = "10";
    // GPU layer promotion: isolate canvas compositing from heavy page effects
    // (backdrop-filter, large backgrounds, etc.)
    s.willChange = "transform";
    s.transform = "translateZ(0)";
    s.contain = "strict";
  };

  MouseTrail.prototype.resizeCanvas = function () {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  };

  /** Hot-update settings without destroying the instance. */
  MouseTrail.prototype.applyOptions = function (options) {
    if (!options) return;
    if (options.maxSquares != null) this.maxSquares = options.maxSquares;
    if (options.color != null) this.color = options.color;
    if (options.colorMode != null) this.colorMode = options.colorMode;
    if (options.rainbowSpeed != null) this.rainbowSpeed = options.rainbowSpeed;
    if (options.rainbowSaturation != null) this.rainbowSaturation = options.rainbowSaturation;
    if (options.rainbowLightness != null) this.rainbowLightness = options.rainbowLightness;
    if (options.style != null) this.style = options.style;
    if (options.burstStyle != null) this.burstStyle = options.burstStyle;
    if (options.sizeScale != null) this.sizeScale = options.sizeScale;
    if (options.lifetime != null) this.lifetime = options.lifetime;
    if (options.burstLifetime != null) this.burstLifetime = options.burstLifetime;
  };

  MouseTrail.prototype.addPoint = function (x, y) {
    var dx = x - this.lastX, dy = y - this.lastY;
    if (dx * dx + dy * dy > this.minDistance * this.minDistance) {
      var count = Math.floor(Math.random() * 3) + 1;
      var now = performance.now();
      for (var j = 0; j < count; j++) {
        var resolved = resolveStyle(this.style);
        var pVx = 0, pVy = this.initialVy;
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
      // Soft-expire excess: fade out oldest particles instead of abrupt removal
      if (this.trail.length > this.maxSquares) {
        var excess = this.trail.length - this.maxSquares;
        for (var k = 0; k < excess; k++) {
          var p = this.trail[k];
          if (!p.dying) {
            var age = now - p.birthTime;
            var pLt = p.lifetime || this.lifetime;
            p.dyingAlpha = Math.max(0, 1 - age / pLt);
            p.dying = now;
          }
        }
        // Hard safety cap to prevent unbounded array growth
        if (this.trail.length > this.maxSquares * 3)
          this.trail.splice(0, this.trail.length - this.maxSquares * 3);
      }
    }
  };

  MouseTrail.prototype.addBurst = function (x, y, count) {
    var now = performance.now();
    for (var i = 0; i < count; i++) {
      var angle = (i / count) * TWO_PI + (Math.random() - 0.5) * 0.5;
      var speed = 1.5 + Math.random() * 3;
      var resolved = resolveStyle(this.burstStyle);
      var bVx = Math.cos(angle) * speed;
      var bVy = Math.sin(angle) * speed;
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
          ? (this._rainbowHue + (i / count) * 360) % 360 : 0,
        shapeStyle: resolved,
        lifetime: this.burstLifetime
      });
    }
    if (this.colorMode === "rainbow")
      this._rainbowHue = (this._rainbowHue + 60) % 360;
  };

  MouseTrail.prototype.update = function (timestamp) {
    // In-place removal of expired and fully-faded elements
    var writeIdx = 0;
    for (var i = 0; i < this.trail.length; i++) {
      var el = this.trail[i];
      var expired = timestamp - el.birthTime >= (el.lifetime || this.lifetime);
      var fadedOut = el.dying && timestamp - el.dying >= FADE_OUT_MS;
      if (!expired && !fadedOut) {
        this.trail[writeIdx++] = el;
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
    var isRainbow = this.colorMode === "rainbow";
    var ctx = this.ctx;
    if (!isRainbow) ctx.fillStyle = this.color;

    for (var i = 0; i < this.trail.length; i++) {
      var el = this.trail[i];
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

      var pLifetime = el.lifetime || this.lifetime;
      var alpha;
      if (el.dying) {
        var fadeProgress = Math.min(1, (timestamp - el.dying) / FADE_OUT_MS);
        alpha = el.dyingAlpha * (1 - fadeProgress);
      } else {
        alpha = Math.max(0, 1 - (timestamp - el.birthTime) / pLifetime);
      }
      ctx.globalAlpha = alpha;

      if (isRainbow)
        ctx.fillStyle = "hsl(" + el.hue + "," + this.rainbowSaturation + "%," + this.rainbowLightness + "%)";

      var pStyle = el.shapeStyle || this.style;
      var sz = el.size * this.sizeScale;

      if (pStyle === "bubble") {
        ctx.beginPath();
        ctx.arc(el.x, el.y, sz * 4, 0, TWO_PI);
        ctx.fill();
        ctx.save();
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(el.x - sz * 1.2, el.y - sz * 1.2, sz * 1.2, 0, TWO_PI);
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
          ctx.rotate(TWO_PI / 5);
          ctx.beginPath();
          ctx.ellipse(0, -pl * 0.5, pw, pl * 0.5, 0, 0, TWO_PI);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, 0, sz, 0, TWO_PI);
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
        var shape = this.shape;
        ctx.beginPath();
        ctx.moveTo(el.x + shape[0].x * sz, el.y + shape[0].y * sz);
        for (var j = 1; j < shape.length; j++)
          ctx.lineTo(el.x + shape[j].x * sz, el.y + shape[j].y * sz);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  MouseTrail.prototype.destroy = function () {
    window.removeEventListener("resize", this._resizeHandler);
    this.trail = [];
  };

  // ═══════════════════════════════════════════
  //  StarCursor + Star (embedded)
  // ═══════════════════════════════════════════

  var GLOW_OFFSETS = [{ x: -2, y: 0 }, { x: 2, y: 0 }, { x: 0, y: -2 }, { x: 0, y: 2 }];
  var STAR_POINTS = [
    { x: 0, y: -4 }, { x: 1, y: -1 }, { x: 4, y: 0 }, { x: 1, y: 1 },
    { x: 0, y: 4 }, { x: -1, y: 1 }, { x: -4, y: 0 }, { x: -1, y: -1 }
  ];

  function Star(x, y, size, maxSize, minSize, growFactor, offsetX, offsetY, growInterval) {
    this.x = x;
    this.y = y;
    this.size = size || 1;
    this.maxSize = maxSize || 3;
    this.minSize = minSize || 1;
    this.growFactor = growFactor || 0.1;
    this.offsetX = offsetX != null ? offsetX : 0;
    this.offsetY = offsetY != null ? offsetY : 0;
    this.growing = true;
    this.growInterval = growInterval || 100;
    this.lastGrowTime = 0;
  }

  Star.prototype.update = function (targetX, targetY, timestamp) {
    this.x = targetX + this.offsetX;
    this.y = targetY + this.offsetY;
    if (timestamp - this.lastGrowTime >= this.growInterval) {
      this.size += this.growing ? this.growFactor : -this.growFactor;
      if (this.size >= this.maxSize) this.growing = false;
      if (this.size <= this.minSize) this.growing = true;
      this.lastGrowTime = timestamp;
    }
  };

  Star.prototype.draw = function (ctx, tempCtx, tempCanvas, color, glowColor, style, sizeScale, timestamp) {
    var s = this.size * (sizeScale || 1);
    var cx = tempCanvas.width / 2;
    var cy = tempCanvas.height / 2;

    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.fillStyle = color;
    for (var i = 0; i < GLOW_OFFSETS.length; i++) {
      var c = GLOW_OFFSETS[i];
      tempCtx.beginPath();
      tempCtx.arc(cx + c.x * s, cy + c.y * s, s * 3, 0, TWO_PI);
      tempCtx.fill();
    }

    var prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = prevAlpha * 0.1;
    ctx.drawImage(tempCanvas, this.x - cx, this.y - cy);
    ctx.globalAlpha = prevAlpha;

    if (style === "bubble") {
      ctx.beginPath();
      ctx.arc(this.x, this.y, s * 4, 0, TWO_PI);
      ctx.fillStyle = color;
      ctx.fill();
      var bubbleAlpha = ctx.globalAlpha;
      ctx.globalAlpha = bubbleAlpha * 0.4;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(this.x - s * 1.2, this.y - s * 1.2, s * 1.2, 0, TWO_PI);
      ctx.fill();
      ctx.globalAlpha = bubbleAlpha;
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
      ctx.fillStyle = color;
      for (var p = 0; p < 5; p++) {
        ctx.rotate(TWO_PI / 5);
        ctx.beginPath();
        ctx.ellipse(0, -pl * 0.5, pw, pl * 0.5, 0, 0, TWO_PI);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, TWO_PI);
      var flowerAlpha = ctx.globalAlpha;
      ctx.globalAlpha = flowerAlpha * 0.7;
      ctx.fillStyle = "#fff8dc";
      ctx.fill();
      ctx.globalAlpha = flowerAlpha;
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
      ctx.beginPath();
      ctx.moveTo(this.x + STAR_POINTS[0].x * s, this.y + STAR_POINTS[0].y * s);
      for (var i = 1; i < STAR_POINTS.length; i++)
        ctx.lineTo(this.x + STAR_POINTS[i].x * s, this.y + STAR_POINTS[i].y * s);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
  };

  function StarCursor(canvas, options) {
    options = options || {};
    this.canvas = typeof canvas === "string" ? document.getElementById(canvas) : canvas;
    this.ctx = this.canvas.getContext("2d", { desynchronized: true });

    this.tempCanvas = document.createElement("canvas");
    this.tempCanvas.width = 64;
    this.tempCanvas.height = 64;
    this.tempCtx = this.tempCanvas.getContext("2d");

    var self = this;
    this._resizeHandler = function () { self.resizeCanvas(); };
    this._setupCanvas();
    this.resizeCanvas();
    window.addEventListener("resize", this._resizeHandler);

    this.mouseX = this.canvas.width / 2;
    this.mouseY = this.canvas.height / 2;
    this.mouseStopTimeout = null;
    this.mouseStopped = false;
    this.opacity = 0;
    this.stopDelay = options.stopDelay || 100;
    this.fadeInSpeed = options.fadeInSpeed || 0.08;
    this.fadeOutSpeed = options.fadeOutSpeed || 0.15;

    this._mousemoveHandler = function (e) {
      self.mouseX = e.clientX;
      self.mouseY = e.clientY;
      self.mouseStopped = false;
      clearTimeout(self.mouseStopTimeout);
      self.mouseStopTimeout = setTimeout(function () {
        self.mouseStopped = true;
      }, self.stopDelay);
    };
    window.addEventListener("mousemove", this._mousemoveHandler);

    this.glowColor = options.glowColor || "#e8c01e";
    this.starColor = options.starColor || "#c8b869";
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

  StarCursor.prototype._setupCanvas = function () {
    var s = this.canvas.style;
    s.position = "fixed";
    s.top = "0";
    s.left = "0";
    s.width = "100%";
    s.height = "100%";
    s.pointerEvents = "none";
    s.zIndex = "10";
    // GPU layer promotion: isolate canvas compositing from heavy page effects
    s.willChange = "transform";
    s.transform = "translateZ(0)";
    s.contain = "strict";
  };

  StarCursor.prototype.resizeCanvas = function () {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  };

  StarCursor.prototype.addStar = function (star) { this.stars.push(star); };

  /** Hot-update settings without destroying the instance. */
  StarCursor.prototype.applyOptions = function (options, count) {
    if (!options) return;
    var styleChanged = false;
    if (options.glowColor != null) this.glowColor = options.glowColor;
    if (options.starColor != null) this.starColor = options.starColor;
    if (options.colorMode != null) this.colorMode = options.colorMode;
    if (options.rainbowSpeed != null) this.rainbowSpeed = options.rainbowSpeed;
    if (options.rainbowSaturation != null) this.rainbowSaturation = options.rainbowSaturation;
    if (options.rainbowLightness != null) this.rainbowLightness = options.rainbowLightness;
    if (options.style != null && options.style !== this.style) { this.style = options.style; styleChanged = true; }
    if (options.sizeScale != null) this.sizeScale = options.sizeScale;
    if (options.spread != null) this.spread = options.spread;
    if (options.wander != null) this.wander = options.wander;
    // Regenerate stars only if count or style changed
    if (count != null && (count !== this.stars.length || styleChanged)) {
      this.generateStars(count);
    } else if (styleChanged) {
      this._reshuffleOffsets();
    }
  };

  StarCursor.prototype._reshuffleOffsets = function () {
    var spreadStyle = this.style === "random" ? "bubble" : this.style;
    for (var i = 0; i < this.stars.length; i++) {
      var pt = randomPointInShape(spreadStyle, this.spread);
      this.stars[i].offsetX = pt.x;
      this.stars[i].offsetY = pt.y;
      if (this.style === "random") {
        this.stars[i].resolvedStyle = resolveStyle(this.style);
      }
    }
  };

  StarCursor.prototype.generateStars = function (count) {
    this.stars = [];
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    var spreadStyle = this.style === "random" ? "bubble" : this.style;
    for (var i = 0; i < count; i++) {
      var pt = randomPointInShape(spreadStyle, this.spread);
      var isMain = (i === 0);
      var size = isMain ? 1 : 0.4 + Math.random() * 0.6;
      var maxSize = isMain ? 2 : 0.8 + Math.random() * 0.7;
      var growFactor = 0.05 + Math.random() * 0.25;
      var growInterval = 80 + Math.floor(Math.random() * 120);
      var star = new Star(cx, cy, size, maxSize, Math.min(size, 0.5), growFactor,
        pt.x, pt.y, growInterval);
      star.resolvedStyle = resolveStyle(this.style);
      this.addStar(star);
    }
  };

  StarCursor.prototype.update = function (timestamp) {
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

    // Idle skip: nothing visible → clear once then skip future frames
    if (this.opacity <= 0) {
      if (this._hadContent) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this._hadContent = false;
      }
      return;
    }
    this._hadContent = true;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.opacity > 0) {
      // Wander: particles smoothly drift to new random positions
      if (this.wander && this.mouseStopped) {
        var spreadStyle = this.style === "random" ? "bubble" : this.style;
        for (var i = 0; i < this.stars.length; i++) {
          var star = this.stars[i];
          if (!star._wanderTarget || timestamp - (star._lastWanderTime || 0) > (star._wanderInterval || 0)) {
            var pt = randomPointInShape(spreadStyle, this.spread);
            star._wanderTarget = { x: pt.x, y: pt.y };
            star._lastWanderTime = timestamp;
            star._wanderInterval = 800 + Math.random() * 2000;
          }
          star.offsetX += (star._wanderTarget.x - star.offsetX) * 0.03;
          star.offsetY += (star._wanderTarget.y - star.offsetY) * 0.03;
        }
      }
      for (var i = 0; i < this.stars.length; i++)
        this.stars[i].update(this.mouseX, this.mouseY, timestamp);

      this.ctx.save();
      this.ctx.globalAlpha = this.opacity;

      if (this.colorMode === "rainbow") {
        var baseHue = (timestamp * this.rainbowSpeed * 0.1) % 360;
        var n = this.stars.length;
        for (var i = 0; i < n; i++) {
          var hue = (baseHue + i * (360 / n)) % 360;
          var sc = "hsl(" + hue + "," + this.rainbowSaturation + "%," + this.rainbowLightness + "%)";
          var gc = "hsla(" + hue + "," + this.rainbowSaturation + "%," + Math.min(this.rainbowLightness + 10, 100) + "%,1)";
          this.stars[i].draw(this.ctx, this.tempCtx, this.tempCanvas, sc, gc,
            this.stars[i].resolvedStyle || this.style, this.sizeScale, timestamp);
        }
      } else {
        for (var i = 0; i < this.stars.length; i++)
          this.stars[i].draw(this.ctx, this.tempCtx, this.tempCanvas, this.starColor, this.glowColor,
            this.stars[i].resolvedStyle || this.style, this.sizeScale, timestamp);
      }
      this.ctx.restore();
    }
  };

  StarCursor.prototype.destroy = function () {
    window.removeEventListener("mousemove", this._mousemoveHandler);
    window.removeEventListener("resize", this._resizeHandler);
    clearTimeout(this.mouseStopTimeout);
  };

  // ═══════════════════════════════════════════
  //  CursorManager (embedded)
  // ═══════════════════════════════════════════

  function readCC(v, o) {
    return String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  }

  function parseANI(buf) {
    var v = new DataView(buf);
    if (readCC(v, 0) !== "RIFF" || readCC(v, 8) !== "ACON")
      throw new Error("Not a valid ANI file");
    var r = { frames: [], rates: null, seq: null, displayRate: 12 };
    var pos = 12;
    while (pos < buf.byteLength - 8) {
      var id = readCC(v, pos);
      var sz = v.getUint32(pos + 4, true);
      if (id === "anih") {
        r.displayRate = v.getUint32(pos + 8 + 28, true);
      } else if (id === "rate") {
        r.rates = [];
        for (var i = 0; i < sz / 4; i++)
          r.rates.push(v.getUint32(pos + 8 + i * 4, true));
      } else if (id === "seq ") {
        r.seq = [];
        for (var i = 0; i < sz / 4; i++)
          r.seq.push(v.getUint32(pos + 8 + i * 4, true));
      } else if (id === "LIST" && readCC(v, pos + 8) === "fram") {
        var fp = pos + 12, end = pos + 8 + sz;
        while (fp < end - 8) {
          var fid = readCC(v, fp);
          var fsz = v.getUint32(fp + 4, true);
          if (fid === "icon")
            r.frames.push(buf.slice(fp + 8, fp + 8 + fsz));
          fp += 8 + fsz + (fsz % 2);
        }
        pos = end + (sz % 2);
        continue;
      } else if (id === "LIST") {
        pos += 12;
        continue;
      }
      pos += 8 + sz + (sz % 2);
    }
    return r;
  }

  function curToFrame(buf) {
    var v = new DataView(buf);
    var hotX = v.getUint16(10, true);
    var hotY = v.getUint16(12, true);
    var dataOff = v.getUint32(18, true);

    if (v.getUint8(dataOff) === 0x89 && v.getUint8(dataOff + 1) === 0x50) {
      var raw = new Uint8Array(buf, dataOff, v.getUint32(14, true));
      var bin = "";
      for (var i = 0; i < raw.length; i++) bin += String.fromCharCode(raw[i]);
      return { url: "data:image/png;base64," + btoa(bin), hotX: hotX, hotY: hotY };
    }

    var w = v.getInt32(dataOff + 4, true);
    var h = Math.abs(v.getInt32(dataOff + 8, true)) / 2;
    var bpp = v.getUint16(dataOff + 14, true);
    var hdrSz = v.getUint32(dataOff, true);
    var tblOff = dataOff + hdrSz;
    var colors = [];
    if (bpp <= 8) {
      var n = 1 << bpp;
      for (var i = 0; i < n; i++) {
        var o = tblOff + i * 4;
        colors.push(v.getUint8(o + 2), v.getUint8(o + 1), v.getUint8(o));
      }
      tblOff += n * 4;
    }
    var xorRow = Math.ceil(w * bpp / 32) * 4;
    var xorOff = tblOff;
    var andRow = Math.ceil(w / 32) * 4;
    var andOff = xorOff + xorRow * h;
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    var img = ctx.createImageData(w, h);
    var px = img.data;

    for (var y = 0; y < h; y++) {
      var srcY = h - 1 - y;
      for (var x = 0; x < w; x++) {
        var di = (y * w + x) * 4;
        if (bpp === 8) {
          var ci = v.getUint8(xorOff + srcY * xorRow + x) * 3;
          px[di] = colors[ci]; px[di + 1] = colors[ci + 1]; px[di + 2] = colors[ci + 2]; px[di + 3] = 255;
        } else if (bpp === 32) {
          var si = xorOff + srcY * xorRow + x * 4;
          px[di] = v.getUint8(si + 2); px[di + 1] = v.getUint8(si + 1);
          px[di + 2] = v.getUint8(si); px[di + 3] = v.getUint8(si + 3);
        } else if (bpp === 24) {
          var si = xorOff + srcY * xorRow + x * 3;
          px[di] = v.getUint8(si + 2); px[di + 1] = v.getUint8(si + 1);
          px[di + 2] = v.getUint8(si); px[di + 3] = 255;
        }
        if (bpp !== 32) {
          var ab = andOff + srcY * andRow + (x >> 3);
          if ((v.getUint8(ab) >> (7 - (x & 7))) & 1) px[di + 3] = 0;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return { url: canvas.toDataURL("image/png"), hotX: hotX, hotY: hotY };
  }

  function dataUrlToBlob(dataUrl) {
    var parts = dataUrl.split(",");
    var mime = parts[0].match(/:(.*?);/)[1];
    var bin = atob(parts[1]);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  var canBlob = typeof URL !== "undefined" && URL.createObjectURL && typeof Blob !== "undefined";

  function ensureCurFormat(buf) {
    var v = new DataView(buf);
    if (v.getUint16(2, true) === 2) return buf;
    var copy = buf.slice(0);
    var cv = new DataView(copy);
    cv.setUint16(2, 2, true);
    var w = cv.getUint8(6) || 256;
    var h = cv.getUint8(7) || 256;
    cv.setUint16(10, Math.floor(w / 2), true);
    cv.setUint16(12, Math.floor(h / 2), true);
    return copy;
  }

  function CursorManager() {
    this._frames = [];
    this._rates = null;
    this._seq = null;
    this._displayRate = 12;
    this._step = 0;
    this._timer = null;
    this._styleEl = null;
    this._fallbackCurUrl = null;
    this._isFirefox = typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent || "");
  }

  CursorManager.prototype = {
    _normalizeUrl: function (url) {
      if (/^[A-Za-z]:[\\/]/.test(url)) return "file:///" + url.replace(/\\/g, "/");
      return url;
    },
    _ensureStyleEl: function () {
      if (!this._styleEl) {
        this._styleEl = document.createElement("style");
        this._styleEl.id = "star-effects-cursor";
        document.head.appendChild(this._styleEl);
      }
    },
    _escapeCssUrl: function (url) { return String(url).replace(/'/g, "\\'"); },
    _setDirectCurUrl: function (url) {
      this._setCursorValue("url('" + this._escapeCssUrl(url) + "'), auto");
    },
    _revokeBlobUrls: function () {
      var canRevoke = typeof URL !== "undefined" && URL.revokeObjectURL;
      if (canRevoke) {
        for (var i = 0; i < this._frames.length; i++) {
          if (this._frames[i].blobUrl) URL.revokeObjectURL(this._frames[i].blobUrl);
          if (this._frames[i].curBlobUrl) URL.revokeObjectURL(this._frames[i].curBlobUrl);
        }
      }
    },
    _fetchBinary: function (url) {
      if (typeof fetch === "function" && location.protocol !== "file:")
        return fetch(url).then(function (r) { return r.arrayBuffer(); });
      return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.responseType = "arraybuffer";
        xhr.onload = function () {
          if (xhr.status === 0 || xhr.status === 200) resolve(xhr.response);
          else reject(new Error("HTTP " + xhr.status));
        };
        xhr.onerror = function () { reject(new Error("XHR failed for " + url)); };
        xhr.send();
      });
    },
    load: function (url) {
      this.stop();
      this._revokeBlobUrls();
      this._frames = [];
      this._ensureStyleEl();
      url = this._normalizeUrl(url);
      var self = this;
      var isCur = url.toLowerCase().endsWith(".cur");
      var isAni = url.toLowerCase().endsWith(".ani");
      this._fallbackCurUrl = isAni ? url.replace(/\.ani$/i, ".cur") : null;

      if (isCur) this._setDirectCurUrl(url);

      return this._fetchBinary(url)
        .then(function (buf) {
          if (isCur) {
            var frame = curToFrame(buf);
            if (canBlob) frame.blobUrl = URL.createObjectURL(dataUrlToBlob(frame.url));
            self._frames = [frame];
            self._setCursor(frame, url);
          } else {
            var ani = parseANI(buf);
            self._displayRate = ani.displayRate;
            self._rates = ani.rates;
            self._seq = ani.seq;
            for (var i = 0; i < ani.frames.length; i++) {
              var f = curToFrame(ani.frames[i]);
              var frameView = new DataView(ani.frames[i]);
              if (frameView.getUint16(2, true) !== 2) {
                var fw = frameView.getUint8(6) || 256;
                var fh = frameView.getUint8(7) || 256;
                f.hotX = Math.floor(fw / 2);
                f.hotY = Math.floor(fh / 2);
              }
              if (canBlob) {
                f.blobUrl = URL.createObjectURL(dataUrlToBlob(f.url));
                var curBuf = ensureCurFormat(ani.frames[i]);
                f.curBlobUrl = URL.createObjectURL(new Blob([curBuf], { type: "image/x-icon" }));
              }
              self._frames.push(f);
            }
            self._step = 0;
            self._apply(0);
            self._animate();
          }
        })
        .catch(function (e) {
          console.warn("CursorManager: failed to load " + url, e);
          if (isAni && self._fallbackCurUrl)
            self._setDirectCurUrl(self._fallbackCurUrl);
        });
    },
    _setCursorValue: function (val) {
      document.documentElement.style.setProperty("cursor", val, "important");
      if (document.body) document.body.style.setProperty("cursor", val, "important");
      this._styleEl.textContent =
        "html, body { height: 100%; } * { cursor: " + val + " !important; }";
    },
    _setCursor: function (frame, curFileUrl) {
      var parts = [];
      if (curFileUrl) parts.push("url('" + this._escapeCssUrl(curFileUrl) + "')");
      if (frame.curBlobUrl) parts.push("url('" + this._escapeCssUrl(frame.curBlobUrl) + "')");
      if (!(this._isFirefox && curFileUrl)) {
        if (frame.blobUrl) parts.push("url('" + this._escapeCssUrl(frame.blobUrl) + "') " + frame.hotX + " " + frame.hotY);
        parts.push("url('" + this._escapeCssUrl(frame.url) + "') " + frame.hotX + " " + frame.hotY);
      }
      if (this._fallbackCurUrl && !curFileUrl)
        parts.push("url('" + this._escapeCssUrl(this._fallbackCurUrl) + "')");
      this._setCursorValue(parts.join(", ") + ", auto");
    },
    _apply: function (step) {
      var idx = this._seq ? this._seq[step] : step;
      var f = this._frames[idx];
      if (f) this._setCursor(f);
    },
    _animate: function () {
      var self = this;
      var total = this._seq ? this._seq.length : this._frames.length;
      function next() {
        self._step = (self._step + 1) % total;
        self._apply(self._step);
        var rate = self._rates ? self._rates[self._step] : self._displayRate;
        self._timer = setTimeout(next, Math.round(rate * (1000 / 60)));
      }
      var r0 = this._rates ? this._rates[0] : this._displayRate;
      this._timer = setTimeout(next, Math.round(r0 * (1000 / 60)));
    },
    stop: function () {
      if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    },
    destroy: function () {
      this.stop();
      this._revokeBlobUrls();
      this._frames = [];
      document.documentElement.style.removeProperty("cursor");
      if (document.body) document.body.style.removeProperty("cursor");
      if (this._styleEl) {
        this._styleEl.textContent = "";
        if (this._styleEl.parentNode)
          this._styleEl.parentNode.removeChild(this._styleEl);
        this._styleEl = null;
      }
    }
  };

  // ═══════════════════════════════════════════
  //  State & initialization
  // ═══════════════════════════════════════════

  var state = {
    trail: null,
    cursorStars: null,
    cursorMgr: null,
    canvas1: null,
    canvas2: null,
    animId: null,
    moveHandler: null,
    clickHandler: null,
    active: false
  };

  var currentSettings = merge({}, DEFAULTS, loadSettings());

  function init(cfg) {
    if (state.active) teardown();
    if (cfg._disabled) return;

    // Create canvases
    state.canvas1 = document.createElement("canvas");
    state.canvas1.id = "_se_trail_" + Date.now();
    document.body.appendChild(state.canvas1);

    state.canvas2 = document.createElement("canvas");
    state.canvas2.id = "_se_cursor_" + Date.now();
    document.body.appendChild(state.canvas2);

    // Trail
    state.trail = new MouseTrail(state.canvas1, {
      maxSquares: cfg.trailMaxCount,
      color: cfg.color,
      colorMode: cfg.colorMode,
      rainbowSpeed: cfg.rainbowSpeed,
      rainbowSaturation: cfg.rainbowSaturation,
      rainbowLightness: cfg.rainbowLightness,
      style: cfg.trailStyle,
      burstStyle: cfg.burstStyle || cfg.trailStyle,
      sizeScale: (cfg.trailSize || 100) / 100,
      lifetime: cfg.trailLifetime || 1000,
      burstLifetime: cfg.burstLifetime || 1000
    });

    // Cursor stars
    state.cursorStars = new StarCursor(state.canvas2, {
      glowColor: cfg.glowColor,
      starColor: cfg.color,
      colorMode: cfg.colorMode,
      rainbowSpeed: cfg.rainbowSpeed,
      rainbowSaturation: cfg.rainbowSaturation,
      rainbowLightness: cfg.rainbowLightness,
      style: cfg.cursorStyle,
      sizeScale: (cfg.cursorSize || 100) / 100,
      spread: cfg.cursorSpread || 20,
      wander: cfg.cursorWander || false
    });
    state.cursorStars.generateStars(cfg.cursorStarCount);

    // Mouse move → trail
    state.moveHandler = function (e) {
      state.trail.addPoint(e.clientX, e.clientY);
    };
    window.addEventListener("mousemove", state.moveHandler);

    // Click burst
    if (cfg.clickBurst) {
      state._burstCount = cfg.clickBurstCount;
      state.clickHandler = function (e) {
        state.trail.addBurst(e.clientX, e.clientY, state._burstCount);
      };
      window.addEventListener("click", state.clickHandler);
    }

    // Custom cursor
    if (cfg.cursor) {
      state.cursorMgr = new CursorManager();
      state.cursorMgr.load(BASE_PATH + "cursor/" + cfg.cursor);
    }

    // Animation loop
    function animate(ts) {
      state.trail.update(ts);
      state.cursorStars.update(ts);
      state.animId = requestAnimationFrame(animate);
    }
    state.animId = requestAnimationFrame(animate);
    state.active = true;
  }

  function teardown() {
    if (state.animId) cancelAnimationFrame(state.animId);
    if (state.moveHandler) window.removeEventListener("mousemove", state.moveHandler);
    if (state.clickHandler) window.removeEventListener("click", state.clickHandler);
    if (state.trail) state.trail.destroy();
    if (state.cursorStars) state.cursorStars.destroy();
    if (state.cursorMgr) state.cursorMgr.destroy();
    if (state.canvas1 && state.canvas1.parentNode) state.canvas1.parentNode.removeChild(state.canvas1);
    if (state.canvas2 && state.canvas2.parentNode) state.canvas2.parentNode.removeChild(state.canvas2);
    state.trail = null;
    state.cursorStars = null;
    state.cursorMgr = null;
    state.canvas1 = null;
    state.canvas2 = null;
    state.animId = null;
    state.moveHandler = null;
    state.clickHandler = null;
    state.active = false;
  }

  // ═══════════════════════════════════════════
  //  Hot-update path (avoids full teardown for non-structural changes)
  // ═══════════════════════════════════════════

  /** Check whether a settings change requires full teardown + reinit. */
  function needsReinit(prev, next) {
    // Structural changes: disabled state, clickBurst toggle, cursor file
    if (!!prev._disabled !== !!next._disabled) return true;
    if (!!prev.clickBurst !== !!next.clickBurst) return true;
    if ((prev.cursor || "") !== (next.cursor || "")) return true;
    return false;
  }

  /** Apply settings in-place to live instances (no DOM churn). */
  function hotUpdate(cfg) {
    if (!state.active) return false;

    state.trail.applyOptions({
      maxSquares: cfg.trailMaxCount,
      color: cfg.color,
      colorMode: cfg.colorMode,
      rainbowSpeed: cfg.rainbowSpeed,
      rainbowSaturation: cfg.rainbowSaturation,
      rainbowLightness: cfg.rainbowLightness,
      style: cfg.trailStyle,
      burstStyle: cfg.burstStyle || cfg.trailStyle,
      sizeScale: (cfg.trailSize || 100) / 100,
      lifetime: cfg.trailLifetime || 1000,
      burstLifetime: cfg.burstLifetime || 1000
    });

    state.cursorStars.applyOptions({
      glowColor: cfg.glowColor,
      starColor: cfg.color,
      colorMode: cfg.colorMode,
      rainbowSpeed: cfg.rainbowSpeed,
      rainbowSaturation: cfg.rainbowSaturation,
      rainbowLightness: cfg.rainbowLightness,
      style: cfg.cursorStyle,
      sizeScale: (cfg.cursorSize || 100) / 100,
      spread: cfg.cursorSpread || 20,
      wander: cfg.cursorWander || false
    }, cfg.cursorStarCount);

    // Update burst count for click handler
    if (cfg.clickBurst) state._burstCount = cfg.clickBurstCount;

    return true;
  }

  // ═══════════════════════════════════════════
  //  Public Runtime API
  // ═══════════════════════════════════════════

  window.StarEffectsRuntime = {
    /** Current merged settings (copy). */
    getSettings: function () { return merge({}, currentSettings); },

    /** Default values (copy). */
    getDefaults: function () { return merge({}, DEFAULTS); },

    /** Apply new settings: hot-update when possible, full reinit only when needed. */
    applySettings: function (settings) {
      var prev = currentSettings;
      currentSettings = merge({}, DEFAULTS, settings);
      saveSettings(settings);

      if (needsReinit(prev, currentSettings)) {
        // Structural change — full teardown required
        teardown();
        if (!currentSettings._disabled) init(currentSettings);
      } else if (state.active) {
        // Non-structural change — hot-update in place (no DOM churn)
        hotUpdate(currentSettings);
      } else if (!currentSettings._disabled) {
        init(currentSettings);
      }
    },

    /** Destroy all effects (does not change saved settings). */
    destroy: teardown,

    /** Whether effects are currently running. */
    isActive: function () { return state.active; },

    /** Base URL for cursor files. */
    basePath: BASE_PATH,

    /** Available cursor filenames (for panel). */
    cursors: [
      "apple.ani", "blue.ani", "cyan.ani", "green.ani",
      "pink.ani", "viole.ani", "yellow.ani",
      "cyan.cur", "green.cur", "red.cur", "white.cur", "yellow.cur"
    ]
  };

  // ═══════════════════════════════════════════
  //  Auto-start
  // ═══════════════════════════════════════════

  function boot() {
    if (!currentSettings._disabled) init(currentSettings);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
