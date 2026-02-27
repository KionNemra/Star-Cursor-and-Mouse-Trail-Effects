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
    this._frames = [];  // [{ url, hotX, hotY, blobUrl?, curBlobUrl? }]
    this._rates = null;
    this._seq = null;
    this._displayRate = 12;
    this._step = 0;
    this._timer = null;
    this._styleEl = null;
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

    _revokeBlobUrls: function () {
      var canRevoke = typeof URL !== "undefined" && URL.revokeObjectURL;
      if (canRevoke) {
        for (var i = 0; i < this._frames.length; i++) {
          if (this._frames[i].blobUrl) URL.revokeObjectURL(this._frames[i].blobUrl);
          if (this._frames[i].curBlobUrl) URL.revokeObjectURL(this._frames[i].curBlobUrl);
        }
      }
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
            // Use original .cur URL directly — Firefox (and all browsers)
            // support .cur natively in CSS cursor, no conversion needed.
            self._setCursor(frame, url);
            console.log("CursorManager: .cur loaded, using direct URL as primary cursor" +
              ", hotspot=(" + frame.hotX + "," + frame.hotY + ")" +
              ", pngBlob=" + !!frame.blobUrl);
          } else {
            var ani = parseANI(buf);
            self._displayRate = ani.displayRate;
            self._rates = ani.rates;
            self._seq = ani.seq;
            for (var i = 0; i < ani.frames.length; i++) {
              var f = curToFrame(ani.frames[i]);
              if (canBlob) {
                f.blobUrl = URL.createObjectURL(dataUrlToBlob(f.url));
                // Create .cur blob URL from raw frame data — each .ani frame
                // is a complete ICO/CUR binary. Firefox handles these natively.
                f.curBlobUrl = URL.createObjectURL(new Blob([ani.frames[i]], { type: "image/x-icon" }));
              }
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
      // Method 1: inline style on html + body (highest priority)
      document.documentElement.style.setProperty("cursor", val, "important");
      if (document.body) document.body.style.setProperty("cursor", val, "important");
      // Method 2: <style> element for all descendants
      this._styleEl.textContent = "* { cursor: " + val + " !important; }";
      console.log("CursorManager: CSS cursor set, value length=" + val.length);
    },

    /**
     * Set CSS cursor with .cur-first fallback chain.
     * Firefox can LOAD PNG data/blob URLs but refuses to DISPLAY them as
     * cursors, then jumps straight to "auto" instead of trying the next
     * fallback.  Putting the native .cur URL first fixes this:
     *   .cur URL/blob (native, no hotspot needed) → PNG blob → PNG data → auto
     */
    _setCursor: function (frame, curFileUrl) {
      var parts = [];
      // 1) Native .cur URL — works in all browsers, Firefox included
      if (curFileUrl) parts.push("url('" + this._escapeCssUrl(curFileUrl) + "')");
      // 2) .cur blob URL for .ani frames (native cursor data, Firefox friendly)
      if (frame.curBlobUrl) parts.push("url('" + this._escapeCssUrl(frame.curBlobUrl) + "')");
      // 3) PNG blob URL (Chrome/Safari fast path)
      if (frame.blobUrl) parts.push("url('" + this._escapeCssUrl(frame.blobUrl) + "') " + frame.hotX + " " + frame.hotY);
      // 4) PNG data URL (universal last resort)
      parts.push("url('" + this._escapeCssUrl(frame.url) + "') " + frame.hotX + " " + frame.hotY);
      this._setCursorValue(parts.join(", ") + ", auto");
    },

    /** Apply a parsed frame — for .ani animation. */
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

  window.CursorManager = CursorManager;
})();
