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

  // ── CursorManager ──

  function CursorManager() {
    this._frames = [];  // [{ url, hotX, hotY }]
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
      this._frames = [];
      this._ensureStyleEl();
      url = this._normalizeUrl(url);
      var self = this;
      console.log("CursorManager: loading " + url);

      // .cur files: use native CSS cursor (avoids fetch / CORS issues on file://)
      if (url.toLowerCase().endsWith(".cur")) {
        this._setCSSUrl(url);
        console.log("CursorManager: applied .cur via CSS");
        return Promise.resolve();
      }

      // .ani files: fetch binary, parse RIFF, and animate frames
      return this._fetchBinary(url)
        .then(function (buf) {
          var ani = parseANI(buf);
          self._displayRate = ani.displayRate;
          self._rates = ani.rates;
          self._seq = ani.seq;
          for (var i = 0; i < ani.frames.length; i++)
            self._frames.push(curToFrame(ani.frames[i]));
          self._step = 0;
          self._apply(0);
          self._animate();
          console.log("CursorManager: .ani loaded, " + self._frames.length + " frames");
        })
        .catch(function (e) {
          console.warn("CursorManager: failed to load " + url, e);
          if (location.protocol === "file:")
            console.warn("CursorManager: .ani files need an HTTP server when using file:// protocol. Try: python -m http.server");
        });
    },

    /** Apply a .cur file directly via CSS (browser reads hotspot natively). */
    _setCSSUrl: function (url) {
      var escaped = url.replace(/\\/g, "/").replace(/'/g, "\\'");
      this._styleEl.textContent =
        "html, body, body * { cursor: url('" + escaped + "'), auto !important; }";
    },

    /** Apply a parsed frame (data-URL PNG with explicit hotspot). */
    _apply: function (step) {
      var idx = this._seq ? this._seq[step] : step;
      var f = this._frames[idx];
      if (f)
        this._styleEl.textContent =
          "html, body, body * { cursor: url(" + f.url + ") " + f.hotX + " " + f.hotY + ", auto !important; }";
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
      this._frames = [];
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
