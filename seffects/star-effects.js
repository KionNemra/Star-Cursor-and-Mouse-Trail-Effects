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
    trailStyle: "star",        // "star" | "bubble" | "heart"
    cursorStyle: "star",
    burstStyle: "star",        // "star" | "bubble" | "heart"
    trailSize: 100,            // trail particle size scale (50-200 %)
    cursorSize: 100,           // cursor star size scale   (50-200 %)
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
  //  MouseTrail (embedded)
  // ═══════════════════════════════════════════

  function MouseTrail(canvas, options) {
    var shape = [
      { x: 0, y: -4 }, { x: 1, y: -1 }, { x: 4, y: 0 }, { x: 1, y: 1 },
      { x: 0, y: 4 }, { x: -1, y: 1 }, { x: -4, y: 0 }, { x: -1, y: -1 }
    ];
    options = options || {};
    this.canvas = typeof canvas === "string" ? document.getElementById(canvas) : canvas;
    this.ctx = this.canvas.getContext("2d");
    this.shape = shape;
    this.style = options.style || "star";
    this.burstStyle = options.burstStyle || this.style;
    this.sizeScale = options.sizeScale || 1;
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
  };

  MouseTrail.prototype.resizeCanvas = function () {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  };

  MouseTrail.prototype.addPoint = function (x, y) {
    var dx = x - this.lastX, dy = y - this.lastY;
    if (dx * dx + dy * dy > this.minDistance * this.minDistance) {
      var count = Math.floor(Math.random() * 3) + 1;
      var now = performance.now();
      for (var j = 0; j < count; j++) {
        this.trail.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + Math.random() * 20,
          birthTime: now,
          size: 1,
          growing: Math.random() < 0.5,
          vx: 0,
          vy: this.initialVy,
          hue: this._rainbowHue,
          shapeStyle: this.style
        });
      }
      this._rainbowHue = (this._rainbowHue + this.rainbowSpeed) % 360;
      this.lastX = x;
      this.lastY = y;
      if (this.trail.length > this.maxSquares)
        this.trail.splice(0, this.trail.length - this.maxSquares);
    }
  };

  MouseTrail.prototype.addBurst = function (x, y, count) {
    var now = performance.now();
    for (var i = 0; i < count; i++) {
      var angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      var speed = 1.5 + Math.random() * 3;
      this.trail.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        birthTime: now,
        size: 0.8 + Math.random() * 0.7,
        growing: Math.random() < 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        hue: this.colorMode === "rainbow"
          ? (this._rainbowHue + (i / count) * 360) % 360 : 0,
        shapeStyle: this.burstStyle
      });
    }
    if (this.colorMode === "rainbow")
      this._rainbowHue = (this._rainbowHue + 60) % 360;
  };

  MouseTrail.prototype.update = function (timestamp) {
    var writeIdx = 0;
    for (var i = 0; i < this.trail.length; i++) {
      if (timestamp - this.trail[i].birthTime < this.lifetime)
        this.trail[writeIdx++] = this.trail[i];
    }
    this.trail.length = writeIdx;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    var isRainbow = this.colorMode === "rainbow";
    if (!isRainbow) this.ctx.fillStyle = this.color;

    for (var i = 0; i < this.trail.length; i++) {
      var el = this.trail[i];
      el.x += el.vx;
      el.y += el.vy;

      if (el.growing) {
        el.size += this.sizeChange;
        if (el.size >= this.maxSize) el.growing = false;
      } else {
        el.size -= this.sizeChange;
        if (el.size <= this.minSize) el.growing = true;
      }

      var alpha = Math.max(0, 1 - (timestamp - el.birthTime) / this.lifetime);
      this.ctx.globalAlpha = alpha;

      if (isRainbow)
        this.ctx.fillStyle = "hsl(" + el.hue + "," + this.rainbowSaturation + "%," + this.rainbowLightness + "%)";

      var pStyle = el.shapeStyle || this.style;
      var sz = el.size * this.sizeScale;

      if (pStyle === "bubble") {
        this.ctx.beginPath();
        this.ctx.arc(el.x, el.y, sz * 4, 0, Math.PI * 2);
        this.ctx.fill();
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
        var shape = this.shape;
        this.ctx.beginPath();
        this.ctx.moveTo(el.x + shape[0].x * sz, el.y + shape[0].y * sz);
        for (var j = 1; j < shape.length; j++)
          this.ctx.lineTo(el.x + shape[j].x * sz, el.y + shape[j].y * sz);
        this.ctx.closePath();
        this.ctx.fill();
      }
    }
    this.ctx.globalAlpha = 1;
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
    this.offsetX = offsetX || 0;
    this.offsetY = offsetY || 0;
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

  Star.prototype.draw = function (ctx, tempCtx, tempCanvas, color, glowColor, style, sizeScale) {
    var s = this.size * (sizeScale || 1);
    var cx = tempCanvas.width / 2;
    var cy = tempCanvas.height / 2;

    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    for (var i = 0; i < GLOW_OFFSETS.length; i++) {
      var c = GLOW_OFFSETS[i];
      tempCtx.beginPath();
      tempCtx.arc(cx + c.x * s, cy + c.y * s, s * 3, 0, Math.PI * 2);
      tempCtx.fillStyle = color;
      tempCtx.fill();
    }

    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.drawImage(tempCanvas, this.x - cx, this.y - cy);
    ctx.restore();

    if (style === "bubble") {
      ctx.beginPath();
      ctx.arc(this.x, this.y, s * 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
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
    this.ctx = this.canvas.getContext("2d");

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
    this.stars = [];
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
  };

  StarCursor.prototype.resizeCanvas = function () {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  };

  StarCursor.prototype.addStar = function (star) { this.stars.push(star); };

  StarCursor.prototype.generateStars = function (count) {
    this.stars = [];
    var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
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
  };

  StarCursor.prototype.update = function (timestamp) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.mouseStopped) {
      this.opacity = Math.min(1, this.opacity + this.fadeInSpeed);
    } else {
      this.opacity = Math.max(0, this.opacity - this.fadeOutSpeed);
    }
    if (this.opacity > 0) {
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
          this.stars[i].draw(this.ctx, this.tempCtx, this.tempCanvas, sc, gc, this.style, this.sizeScale);
        }
      } else {
        for (var i = 0; i < this.stars.length; i++)
          this.stars[i].draw(this.ctx, this.tempCtx, this.tempCanvas, this.starColor, this.glowColor, this.style, this.sizeScale);
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
      sizeScale: (cfg.trailSize || 100) / 100
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
      sizeScale: (cfg.cursorSize || 100) / 100
    });
    state.cursorStars.generateStars(cfg.cursorStarCount);

    // Mouse move → trail
    state.moveHandler = function (e) {
      state.trail.addPoint(e.clientX, e.clientY);
    };
    window.addEventListener("mousemove", state.moveHandler);

    // Click burst
    if (cfg.clickBurst) {
      state.clickHandler = function (e) {
        state.trail.addBurst(e.clientX, e.clientY, cfg.clickBurstCount);
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
  //  Public Runtime API
  // ═══════════════════════════════════════════

  window.StarEffectsRuntime = {
    /** Current merged settings (copy). */
    getSettings: function () { return merge({}, currentSettings); },

    /** Default values (copy). */
    getDefaults: function () { return merge({}, DEFAULTS); },

    /** Apply new settings: save to localStorage, restart effects. */
    applySettings: function (settings) {
      currentSettings = merge({}, DEFAULTS, settings);
      saveSettings(settings);
      teardown();
      if (!currentSettings._disabled) init(currentSettings);
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
