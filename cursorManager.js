// cursorManager.js — .ani/.cur parser + animated cursor manager
// Parses RIFF/ACON structure, converts BMP frames to PNG data URLs,
// and animates cursor via CSS. ~4 KB, zero dependencies.

(function () {

  // ── RIFF helpers ──

  function readCC(v, o) {
    return String.fromCharCode(v.getUint8(o), v.getUint8(o+1), v.getUint8(o+2), v.getUint8(o+3));
  }

  // ── ANI parser ──

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
        // anih struct offset 28 = iDispRate (jiffies, 1/60 s)
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
        pos += 12; // enter non-fram LIST
        continue;
      }

      pos += 8 + sz + (sz % 2);
    }
    return r;
  }

  // ── CUR frame → PNG data URL (via canvas) ──

  function curToFrame(buf) {
    var v = new DataView(buf);
    var hotX = v.getUint16(10, true);
    var hotY = v.getUint16(12, true);
    var dataOff = v.getUint32(18, true);

    // Check for embedded PNG (rare, but handle it)
    if (v.getUint8(dataOff) === 0x89 && v.getUint8(dataOff + 1) === 0x50) {
      var raw = new Uint8Array(buf, dataOff, v.getUint32(14, true));
      var bin = "";
      for (var i = 0; i < raw.length; i++) bin += String.fromCharCode(raw[i]);
      return { url: "data:image/png;base64," + btoa(bin), hotX: hotX, hotY: hotY };
    }

    // BMP: parse BITMAPINFOHEADER
    var w = v.getInt32(dataOff + 4, true);
    var h = Math.abs(v.getInt32(dataOff + 8, true)) / 2; // ICO height = 2×actual
    var bpp = v.getUint16(dataOff + 14, true);
    var hdrSz = v.getUint32(dataOff, true);

    // Color table (for indexed color: 1/4/8 bpp)
    var tblOff = dataOff + hdrSz;
    var colors = [];
    if (bpp <= 8) {
      var n = 1 << bpp;
      for (var i = 0; i < n; i++) {
        var o = tblOff + i * 4;
        colors.push(v.getUint8(o + 2), v.getUint8(o + 1), v.getUint8(o)); // BGR → RGB
      }
      tblOff += n * 4;
    }

    // XOR bitmap (pixel data, bottom-up)
    var xorRow = Math.ceil(w * bpp / 32) * 4;
    var xorOff = tblOff;
    // AND bitmap (transparency mask)
    var andRow = Math.ceil(w / 32) * 4;
    var andOff = xorOff + xorRow * h;

    // Build ImageData
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    var img = ctx.createImageData(w, h);
    var px = img.data;

    for (var y = 0; y < h; y++) {
      var srcY = h - 1 - y; // flip vertically
      for (var x = 0; x < w; x++) {
        var di = (y * w + x) * 4;

        if (bpp === 8) {
          var ci = v.getUint8(xorOff + srcY * xorRow + x) * 3;
          px[di] = colors[ci]; px[di+1] = colors[ci+1]; px[di+2] = colors[ci+2]; px[di+3] = 255;
        } else if (bpp === 32) {
          var si = xorOff + srcY * xorRow + x * 4;
          px[di] = v.getUint8(si+2); px[di+1] = v.getUint8(si+1);
          px[di+2] = v.getUint8(si); px[di+3] = v.getUint8(si+3);
        } else if (bpp === 24) {
          var si = xorOff + srcY * xorRow + x * 3;
          px[di] = v.getUint8(si+2); px[di+1] = v.getUint8(si+1);
          px[di+2] = v.getUint8(si); px[di+3] = 255;
        }

        // AND mask — if set, pixel is transparent (skip for 32-bit ARGB)
        if (bpp !== 32) {
          var ab = andOff + srcY * andRow + (x >> 3);
          if ((v.getUint8(ab) >> (7 - (x & 7))) & 1) px[di+3] = 0;
        }
      }
    }

    ctx.putImageData(img, 0, 0);
    return { url: canvas.toDataURL("image/png"), hotX: hotX, hotY: hotY };
  }

  // ── data URL → Blob (for Firefox PNG cursor compatibility) ──

  function dataUrlToBlob(dataUrl) {
    var parts = dataUrl.split(",");
    var mime = parts[0].match(/:(.*?);/)[1];
    var bin = atob(parts[1]);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  var canBlob = typeof URL !== "undefined" && URL.createObjectURL && typeof Blob !== "undefined";

  // ── CursorManager ──

  function CursorManager() {
    this._frames = [];  // [{ url, hotX, hotY }]
    this._rates = null;
    this._seq = null;
    this._displayRate = 12;
    this._step = 0;
    this._timer = null;
    this._styleEl = null;
    this._blobCursorUrl = null;
    this._lastCursorValue = "";
    this._enforceCursorHandler = null;
    this._overlayEl = null;
    this._overlayMoveHandler = null;
    this._overlayHotX = 0;
    this._overlayHotY = 0;
  }

  CursorManager.prototype = {
    /** Normalise Windows absolute paths (C:\...) to file:// URLs. */
    _normalizeUrl: function (url) {
      if (/^[A-Za-z]:[\\/]/.test(url))
        return "file:///" + url.replace(/\\/g, "/");
      return url;
    },

    _ensureStyleEl: function () {
      if (!this._styleEl) {
        this._styleEl = document.createElement("style");
        this._styleEl.id = "star-effects-cursor";
        document.head.appendChild(this._styleEl);
      }
    },

    _escapeCssUrl: function (url) {
      return String(url).replace(/'/g, "\\'");
    },
    _useOverlayCursor: function () {
      return typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent || "");
    },

    _ensureOverlayEl: function () {
      if (this._overlayEl) return;
      var el = document.createElement("div");
      el.id = "star-effects-cursor-overlay";
      el.style.position = "fixed";
      el.style.left = "0";
      el.style.top = "0";
      el.style.width = "32px";
      el.style.height = "32px";
      el.style.pointerEvents = "none";
      el.style.zIndex = "2147483647";
      el.style.backgroundRepeat = "no-repeat";
      el.style.backgroundSize = "contain";
      el.style.transform = "translate(-9999px,-9999px)";
      el.style.display = "none";
      document.body.appendChild(el);
      this._overlayEl = el;
    },

    _showOverlayCursor: function (dataUrl, hotX, hotY) {
      this._ensureOverlayEl();
      this._overlayHotX = hotX || 0;
      this._overlayHotY = hotY || 0;
      this._overlayEl.style.backgroundImage = "url('" + this._escapeCssUrl(dataUrl) + "')";
      this._overlayEl.style.display = "block";
      var self = this;
      var img = new Image();
      img.onload = function () {
        self._overlayEl.style.width = img.naturalWidth + "px";
        self._overlayEl.style.height = img.naturalHeight + "px";
      };
      img.src = dataUrl;

      if (!this._overlayMoveHandler) {
        this._overlayMoveHandler = function (ev) {
          if (!self._overlayEl) return;
          var x = ev.clientX - self._overlayHotX;
          var y = ev.clientY - self._overlayHotY;
          self._overlayEl.style.transform = "translate(" + x + "px," + y + "px)";
        };
        document.addEventListener("mousemove", this._overlayMoveHandler, true);
      }
    },

    _hideOverlayCursor: function () {
      if (this._overlayMoveHandler) {
        document.removeEventListener("mousemove", this._overlayMoveHandler, true);
        this._overlayMoveHandler = null;
      }
      if (this._overlayEl) {
        if (this._overlayEl.parentNode) this._overlayEl.parentNode.removeChild(this._overlayEl);
        this._overlayEl = null;
      }
    },


    _revokeBlobUrls: function () {
      var canRevoke = typeof URL !== "undefined" && URL.revokeObjectURL;
      // Revoke PNG blob URLs from frames (before clearing _frames)
      if (canRevoke) {
        for (var i = 0; i < this._frames.length; i++) {
          if (this._frames[i].blobUrl) URL.revokeObjectURL(this._frames[i].blobUrl);
        }
      }
      // Revoke .cur source blob URL
      if (this._blobCursorUrl && canRevoke) {
        URL.revokeObjectURL(this._blobCursorUrl);
      }
      this._blobCursorUrl = null;
    },

    /** Fetch binary data with XHR fallback (XHR works on file:// in Firefox). */
    _fetchBinary: function (url) {
      if (typeof fetch === "function" && location.protocol !== "file:") {
        return fetch(url).then(function (r) { return r.arrayBuffer(); });
      }
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

    /** Load a .cur or .ani file by URL. Returns a Promise. */
    load: function (url) {
      this.stop();
      this._revokeBlobUrls();
      this._frames = [];
      this._ensureStyleEl();
      url = this._normalizeUrl(url);
      var self = this;
      var isCur = url.toLowerCase().endsWith(".cur");
      console.log("CursorManager: loading " + url);

      return this._fetchBinary(url)
        .then(function (buf) {
          console.log("CursorManager: fetched " + buf.byteLength + " bytes");
          if (isCur) {
            var frame = curToFrame(buf);
            if (canBlob) frame.blobUrl = URL.createObjectURL(dataUrlToBlob(frame.url));
            self._frames = [frame];
            if (canBlob) {
              self._blobCursorUrl = URL.createObjectURL(new Blob([buf], { type: "image/x-icon" }));
            }
            self._setCursorFromFileAndData(self._blobCursorUrl || url, frame.url, frame.hotX, frame.hotY, frame.blobUrl);
            console.log("CursorManager: .cur parsed, dataURL length=" + frame.url.length +
              ", hotspot=(" + frame.hotX + "," + frame.hotY + ")" +
              ", source=" + (self._blobCursorUrl ? "blob" : "url") +
              ", pngBlob=" + !!frame.blobUrl);
          } else {
            var ani = parseANI(buf);
            self._displayRate = ani.displayRate;
            self._rates = ani.rates;
            self._seq = ani.seq;
            for (var i = 0; i < ani.frames.length; i++) {
              var f = curToFrame(ani.frames[i]);
              if (canBlob) f.blobUrl = URL.createObjectURL(dataUrlToBlob(f.url));
              self._frames.push(f);
            }
            self._step = 0;
            self._apply(0);
            self._animate();
            console.log("CursorManager: .ani loaded, " + self._frames.length + " frames");
          }
        })
        .catch(function (e) {
          console.warn("CursorManager: failed to load " + url, e);
          if (location.protocol === "file:")
            console.warn("CursorManager: on file:// protocol, try: python -m http.server");
        });
    },

    /** Set cursor on the page using multiple methods for maximum compatibility. */
    _setCursorValue: function (val) {
      this._lastCursorValue = val;
      // Method 1: inline style on html + body (highest priority)
      document.documentElement.style.setProperty("cursor", val, "important");
      if (document.body) document.body.style.setProperty("cursor", val, "important");
      // Method 2: <style> element for all descendants + pseudo elements
      // (Firefox can keep default cursor if a child sets its own cursor value)
      this._styleEl.textContent = "html, body, *, *::before, *::after { cursor: " + val + " !important; }";
      // Method 3: force cursor on our own canvases (common hover targets)
      var ownCanvases = document.querySelectorAll("#curs_canv, #curs_canv2");
      for (var i = 0; i < ownCanvases.length; i++) {
        ownCanvases[i].style.setProperty("cursor", val, "important");
      }
      this._ensureCursorEnforcement();
      console.log("CursorManager: CSS cursor set, value length=" + val.length);
    },

    _ensureCursorEnforcement: function () {
      if (this._enforceCursorHandler || !document.addEventListener) return;
      var self = this;
      this._enforceCursorHandler = function (ev) {
        if (!self._lastCursorValue) return;
        var t = ev && ev.target;
        if (t && t.style && t.style.setProperty) {
          t.style.setProperty("cursor", self._lastCursorValue, "important");
        }
      };
      document.addEventListener("mousemove", this._enforceCursorHandler, true);
    },

    _setCursor: function (dataUrl, hotX, hotY) {
      if (this._useOverlayCursor()) {
        this._setCursorValue("none");
        this._showOverlayCursor(dataUrl, hotX, hotY);
        return;
      }
      this._hideOverlayCursor();
      this._setCursorValue("url('" + this._escapeCssUrl(dataUrl) + "') " + hotX + " " + hotY + ", auto");
    },

    _setCursorFromFileAndData: function (sourceUrl, dataUrl, hotX, hotY) {
      if (this._useOverlayCursor()) {
        this._setCursorValue("none");
        this._showOverlayCursor(dataUrl, hotX, hotY);
        return;
      }
      this._hideOverlayCursor();
      var dataVal = "url('" + this._escapeCssUrl(dataUrl) + "') " + hotX + " " + hotY;
      var sourceVal = "url('" + this._escapeCssUrl(sourceUrl) + "') " + hotX + " " + hotY;
      this._setCursorValue(dataVal + ", " + sourceVal + ", auto");
    },

    /** Apply a parsed frame (data-URL PNG with explicit hotspot) — for .ani animation. */
    _apply: function (step) {
      var idx = this._seq ? this._seq[step] : step;
      var f = this._frames[idx];
      if (f) this._setCursor(f.url, f.hotX, f.hotY, f.blobUrl);
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
      this._revokeBlobCursorUrl();
      this._hideOverlayCursor();
      this._lastCursorValue = "";
      if (this._enforceCursorHandler) {
        document.removeEventListener("mousemove", this._enforceCursorHandler, true);
        this._enforceCursorHandler = null;
      }
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

  window.CursorManager = CursorManager;
})();
