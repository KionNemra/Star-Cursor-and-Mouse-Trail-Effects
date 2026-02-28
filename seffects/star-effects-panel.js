// star-effects-panel.js — Floating gear settings panel for star effects.
// Only add this script to the page where the settings UI should appear
// (e.g. your index.html). All other pages only need star-effects.js.
//
// Usage:
//   <script src="/seffects/star-effects.js"></script>
//   <script src="/seffects/star-effects-panel.js"></script>

(function () {
  "use strict";

  // Wait for runtime API AND document.body to be available
  function waitForReady(cb) {
    function check() { return window.StarEffectsRuntime && document.body; }
    if (check()) return cb();
    function poll() {
      if (check()) return cb();
      setTimeout(poll, 50);
    }
    // If DOM is still loading, wait for DOMContentLoaded then poll;
    // otherwise DOMContentLoaded already fired, so just poll directly.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", poll);
    } else {
      poll();
    }
  }

  waitForReady(function () {
    var R = window.StarEffectsRuntime;

    // ═══════════════════════════════════════
    //  Inject CSS
    // ═══════════════════════════════════════

    var styleEl = document.createElement("style");
    styleEl.textContent = [
      // Gear button
      "#se-gear-btn {",
      "  position: fixed; bottom: 24px; right: 24px; z-index: 999999;",
      "  width: 44px; height: 44px; border-radius: 50%;",
      "  background: rgba(30,30,40,0.85); border: 1px solid rgba(200,184,105,0.4);",
      "  color: #c8b869; font-size: 22px; cursor: pointer;",
      "  display: flex; align-items: center; justify-content: center;",
      "  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);",
      "  transition: transform 0.3s, border-color 0.3s, box-shadow 0.3s;",
      "  box-shadow: 0 2px 12px rgba(0,0,0,0.4);",
      "  user-select: none; -webkit-user-select: none;",
      "}",
      "#se-gear-btn:hover { transform: rotate(60deg); border-color: #c8b869; box-shadow: 0 2px 20px rgba(200,184,105,0.3); }",
      "#se-gear-btn.se-gear-off { opacity: 0.2; width: 32px; height: 32px; font-size: 16px; border-color: rgba(200,184,105,0.15); box-shadow: none; }",
      "#se-gear-btn.se-gear-off:hover { opacity: 0.6; }",

      // Backdrop
      "#se-panel-backdrop {",
      "  position: fixed; inset: 0; z-index: 999998;",
      "  background: rgba(0,0,0,0.45);",
      "  backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);",
      "  opacity: 0; transition: opacity 0.25s;",
      "  pointer-events: none;",
      "}",
      "#se-panel-backdrop.se-open { opacity: 1; pointer-events: auto; }",

      // Panel
      "#se-panel {",
      "  position: fixed; z-index: 999999;",
      "  top: 50%; right: 24px; transform: translateY(-50%) scale(0.95);",
      "  width: 340px; max-height: 85vh;",
      "  background: rgba(18,18,28,0.96); border: 1px solid rgba(200,184,105,0.3);",
      "  border-radius: 14px; color: #e0e0e0; font-family: -apple-system, 'Segoe UI', sans-serif;",
      "  font-size: 13px; overflow-y: auto; overflow-x: hidden;",
      "  box-shadow: 0 8px 40px rgba(0,0,0,0.6);",
      "  opacity: 0; transition: opacity 0.25s, transform 0.25s;",
      "  pointer-events: none; scrollbar-width: thin; scrollbar-color: #444 transparent;",
      "}",
      "#se-panel.se-open { opacity: 1; transform: translateY(-50%) scale(1); pointer-events: auto; }",
      "#se-panel::-webkit-scrollbar { width: 6px; }",
      "#se-panel::-webkit-scrollbar-track { background: transparent; }",
      "#se-panel::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }",

      // Header
      ".se-header {",
      "  display: flex; align-items: center; justify-content: space-between;",
      "  padding: 14px 16px 10px; border-bottom: 1px solid rgba(200,184,105,0.15);",
      "  position: sticky; top: 0; background: rgba(18,18,28,0.98); z-index: 1;",
      "}",
      ".se-header h3 { margin: 0; font-size: 15px; color: #c8b869; font-weight: 600; }",
      ".se-close-btn {",
      "  background: none; border: none; color: #888; font-size: 20px;",
      "  cursor: pointer; padding: 0 4px; line-height: 1;",
      "}",
      ".se-close-btn:hover { color: #ccc; }",

      // Sections
      ".se-section { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }",
      ".se-section:last-child { border-bottom: none; }",
      ".se-section-title {",
      "  font-size: 11px; text-transform: uppercase; letter-spacing: 1px;",
      "  color: #888; margin-bottom: 10px;",
      "}",

      // Rows
      ".se-row {",
      "  display: flex; align-items: center; justify-content: space-between;",
      "  margin-bottom: 10px; min-height: 28px;",
      "}",
      ".se-row:last-child { margin-bottom: 0; }",
      ".se-label { color: #bbb; flex-shrink: 0; margin-right: 12px; }",
      ".se-right { display: flex; align-items: center; gap: 8px; }",

      // Toggle switch
      ".se-toggle { position: relative; width: 42px; height: 22px; flex-shrink: 0; }",
      ".se-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }",
      ".se-toggle-track {",
      "  position: absolute; inset: 0; border-radius: 11px;",
      "  background: #333; cursor: pointer; transition: background 0.2s;",
      "}",
      ".se-toggle input:checked + .se-toggle-track { background: #c8b869; }",
      ".se-toggle-knob {",
      "  position: absolute; top: 2px; left: 2px; width: 18px; height: 18px;",
      "  border-radius: 50%; background: #fff; transition: left 0.2s;",
      "  pointer-events: none;",
      "}",
      ".se-toggle input:checked ~ .se-toggle-knob { left: 22px; }",

      // Slider
      ".se-slider-wrap { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }",
      ".se-slider {",
      "  -webkit-appearance: none; appearance: none; flex: 1; height: 4px;",
      "  background: #333; border-radius: 2px; outline: none;",
      "}",
      ".se-slider::-webkit-slider-thumb {",
      "  -webkit-appearance: none; width: 14px; height: 14px;",
      "  border-radius: 50%; background: #c8b869; cursor: pointer;",
      "}",
      ".se-slider::-moz-range-thumb {",
      "  width: 14px; height: 14px; border: none;",
      "  border-radius: 50%; background: #c8b869; cursor: pointer;",
      "}",
      ".se-slider-val { min-width: 32px; text-align: right; color: #999; font-size: 12px; font-variant-numeric: tabular-nums; }",

      // Color picker
      ".se-color-input {",
      "  -webkit-appearance: none; appearance: none; width: 32px; height: 24px;",
      "  border: 1px solid #555; border-radius: 4px; background: none;",
      "  cursor: pointer; padding: 0;",
      "}",
      ".se-color-input::-webkit-color-swatch-wrapper { padding: 0; }",
      ".se-color-input::-webkit-color-swatch { border: none; border-radius: 3px; }",
      ".se-color-input::-moz-color-swatch { border: none; border-radius: 3px; }",

      // Radio group (shape selector)
      ".se-shape-group { display: flex; gap: 4px; }",
      ".se-shape-btn {",
      "  padding: 4px 10px; border-radius: 6px; border: 1px solid #444;",
      "  background: transparent; color: #bbb; cursor: pointer;",
      "  font-size: 12px; transition: all 0.15s; white-space: nowrap;",
      "}",
      ".se-shape-btn:hover { border-color: #888; }",
      ".se-shape-btn.se-active { background: rgba(200,184,105,0.15); border-color: #c8b869; color: #c8b869; }",

      // Radio pair (color mode)
      ".se-radio-group { display: flex; gap: 4px; }",
      ".se-radio-btn {",
      "  padding: 4px 12px; border-radius: 6px; border: 1px solid #444;",
      "  background: transparent; color: #bbb; cursor: pointer;",
      "  font-size: 12px; transition: all 0.15s;",
      "}",
      ".se-radio-btn:hover { border-color: #888; }",
      ".se-radio-btn.se-active { background: rgba(200,184,105,0.15); border-color: #c8b869; color: #c8b869; }",

      // Select
      ".se-select {",
      "  background: #222; color: #ccc; border: 1px solid #444; border-radius: 6px;",
      "  padding: 4px 8px; font-size: 12px; outline: none; max-width: 180px;",
      "}",
      ".se-select:focus { border-color: #c8b869; }",

      // Footer buttons
      ".se-footer {",
      "  display: flex; justify-content: flex-end; gap: 8px;",
      "  padding: 12px 16px; border-top: 1px solid rgba(200,184,105,0.15);",
      "  position: sticky; bottom: 0; background: rgba(18,18,28,0.98);",
      "}",
      ".se-btn {",
      "  padding: 6px 16px; border-radius: 6px; font-size: 12px;",
      "  cursor: pointer; border: 1px solid; transition: all 0.15s;",
      "}",
      ".se-btn-reset { background: transparent; border-color: #555; color: #aaa; }",
      ".se-btn-reset:hover { border-color: #888; color: #ccc; }",
      ".se-btn-primary { background: rgba(200,184,105,0.2); border-color: #c8b869; color: #c8b869; }",
      ".se-btn-primary:hover { background: rgba(200,184,105,0.35); }",
      ".se-btn-off { background: transparent; border-color: #664; color: #997; }",
      ".se-btn-off:hover { border-color: #996; color: #cc9; }",

      // Disabled state for sections
      ".se-disabled { opacity: 0.4; pointer-events: none; }",

      // Conditional visibility for color-mode-dependent rows
      ".se-show-fixed, .se-show-rainbow { transition: opacity 0.2s, max-height 0.2s; overflow: hidden; }",
      ".se-hidden { opacity: 0; max-height: 0 !important; margin: 0 !important; padding: 0 !important; pointer-events: none; }",

      ""
    ].join("\n");
    document.head.appendChild(styleEl);

    // ═══════════════════════════════════════
    //  Build DOM
    // ═══════════════════════════════════════

    var cfg = R.getSettings();

    // Gear button
    var gearBtn = document.createElement("button");
    gearBtn.id = "se-gear-btn";
    gearBtn.innerHTML = "&#9881;"; // ⚙
    gearBtn.title = "\u9F20\u6807\u7279\u6548\u8BBE\u7F6E";
    if (cfg._disabled) gearBtn.className = "se-gear-off";
    document.body.appendChild(gearBtn);

    // Backdrop
    var backdrop = document.createElement("div");
    backdrop.id = "se-panel-backdrop";
    document.body.appendChild(backdrop);

    // Panel
    var panel = document.createElement("div");
    panel.id = "se-panel";
    document.body.appendChild(panel);

    // --- Build panel contents ---
    var html = [];

    // Header
    html.push('<div class="se-header">');
    html.push('  <h3>\u2728 \u9F20\u6807\u7279\u6548\u8BBE\u7F6E</h3>');
    html.push('  <button class="se-close-btn" id="se-close">&times;</button>');
    html.push('</div>');

    // Master toggle
    html.push('<div class="se-section">');
    html.push('  <div class="se-row">');
    html.push('    <span class="se-label">\u603B\u5F00\u5173</span>');
    html.push('    <label class="se-toggle">');
    html.push('      <input type="checkbox" id="se-enabled" ' + (!cfg._disabled ? 'checked' : '') + '>');
    html.push('      <span class="se-toggle-track"></span>');
    html.push('      <span class="se-toggle-knob"></span>');
    html.push('    </label>');
    html.push('  </div>');
    html.push('</div>');

    // Content wrapper (disables when toggled off)
    html.push('<div id="se-content">');

    // ── Color section ──
    html.push('<div class="se-section">');
    html.push('  <div class="se-section-title">\u989C\u8272\u8BBE\u7F6E</div>');

    // Color mode
    html.push('  <div class="se-row">');
    html.push('    <span class="se-label">\u989C\u8272\u6A21\u5F0F</span>');
    html.push('    <div class="se-radio-group">');
    html.push('      <button class="se-radio-btn' + (cfg.colorMode === "fixed" ? ' se-active' : '') + '" data-mode="fixed">\u56FA\u5B9A\u8272</button>');
    html.push('      <button class="se-radio-btn' + (cfg.colorMode === "rainbow" ? ' se-active' : '') + '" data-mode="rainbow">\u5F69\u8679</button>');
    html.push('    </div>');
    html.push('  </div>');

    // Fixed color
    html.push('  <div class="se-row se-show-fixed' + (cfg.colorMode !== "fixed" ? ' se-hidden' : '') + '" id="se-row-color">');
    html.push('    <span class="se-label">\u7C92\u5B50\u989C\u8272</span>');
    html.push('    <input type="color" class="se-color-input" id="se-color" value="' + cfg.color + '">');
    html.push('  </div>');
    html.push('  <div class="se-row se-show-fixed' + (cfg.colorMode !== "fixed" ? ' se-hidden' : '') + '" id="se-row-glow">');
    html.push('    <span class="se-label">\u8F89\u5149\u989C\u8272</span>');
    html.push('    <input type="color" class="se-color-input" id="se-glow" value="' + cfg.glowColor.substring(0, 7) + '">');
    html.push('  </div>');

    // Rainbow settings
    html.push('  <div class="se-row se-show-rainbow' + (cfg.colorMode !== "rainbow" ? ' se-hidden' : '') + '" id="se-row-rspeed">');
    html.push('    <span class="se-label">\u5F69\u8679\u901F\u5EA6</span>');
    html.push('    <div class="se-slider-wrap">');
    html.push('      <input type="range" class="se-slider" id="se-rspeed" min="1" max="20" value="' + cfg.rainbowSpeed + '">');
    html.push('      <span class="se-slider-val" id="se-rspeed-val">' + cfg.rainbowSpeed + '</span>');
    html.push('    </div>');
    html.push('  </div>');
    html.push('  <div class="se-row se-show-rainbow' + (cfg.colorMode !== "rainbow" ? ' se-hidden' : '') + '" id="se-row-rsat">');
    html.push('    <span class="se-label">\u5F69\u8679\u9971\u548C</span>');
    html.push('    <div class="se-slider-wrap">');
    html.push('      <input type="range" class="se-slider" id="se-rsat" min="0" max="100" value="' + cfg.rainbowSaturation + '">');
    html.push('      <span class="se-slider-val" id="se-rsat-val">' + cfg.rainbowSaturation + '%</span>');
    html.push('    </div>');
    html.push('  </div>');
    html.push('  <div class="se-row se-show-rainbow' + (cfg.colorMode !== "rainbow" ? ' se-hidden' : '') + '" id="se-row-rlight">');
    html.push('    <span class="se-label">\u5F69\u8679\u4EAE\u5EA6</span>');
    html.push('    <div class="se-slider-wrap">');
    html.push('      <input type="range" class="se-slider" id="se-rlight" min="10" max="90" value="' + cfg.rainbowLightness + '">');
    html.push('      <span class="se-slider-val" id="se-rlight-val">' + cfg.rainbowLightness + '%</span>');
    html.push('    </div>');
    html.push('  </div>');

    html.push('</div>'); // end color section

    // ── Particle section ──
    html.push('<div class="se-section">');
    html.push('  <div class="se-section-title">\u7C92\u5B50\u8BBE\u7F6E</div>');

    html.push('  <div class="se-row">');
    html.push('    <span class="se-label">\u62D6\u5C3E\u6570\u91CF</span>');
    html.push('    <div class="se-slider-wrap">');
    html.push('      <input type="range" class="se-slider" id="se-trail-count" min="5" max="60" value="' + cfg.trailMaxCount + '">');
    html.push('      <span class="se-slider-val" id="se-trail-count-val">' + cfg.trailMaxCount + '</span>');
    html.push('    </div>');
    html.push('  </div>');

    html.push('  <div class="se-row">');
    html.push('    <span class="se-label">\u5149\u6807\u661F\u6570</span>');
    html.push('    <div class="se-slider-wrap">');
    html.push('      <input type="range" class="se-slider" id="se-cursor-count" min="1" max="10" value="' + cfg.cursorStarCount + '">');
    html.push('      <span class="se-slider-val" id="se-cursor-count-val">' + cfg.cursorStarCount + '</span>');
    html.push('    </div>');
    html.push('  </div>');

    html.push('</div>');

    // ── Shape section ──
    html.push('<div class="se-section">');
    html.push('  <div class="se-section-title">\u5F62\u72B6\u6837\u5F0F</div>');

    html.push('  <div class="se-row">');
    html.push('    <span class="se-label">\u62D6\u5C3E\u5F62\u72B6</span>');
    html.push('    <div class="se-shape-group" id="se-trail-shape">');
    html.push('      <button class="se-shape-btn' + (cfg.trailStyle === "star" ? ' se-active' : '') + '" data-val="star">\u2605 \u661F\u661F</button>');
    html.push('      <button class="se-shape-btn' + (cfg.trailStyle === "bubble" ? ' se-active' : '') + '" data-val="bubble">\u25CB \u6CE1\u6CE1</button>');
    html.push('      <button class="se-shape-btn' + (cfg.trailStyle === "heart" ? ' se-active' : '') + '" data-val="heart">\u2665 \u7231\u5FC3</button>');
    html.push('    </div>');
    html.push('  </div>');

    html.push('  <div class="se-row">');
    html.push('    <span class="se-label">\u5149\u6807\u5F62\u72B6</span>');
    html.push('    <div class="se-shape-group" id="se-cursor-shape">');
    html.push('      <button class="se-shape-btn' + (cfg.cursorStyle === "star" ? ' se-active' : '') + '" data-val="star">\u2605 \u661F\u661F</button>');
    html.push('      <button class="se-shape-btn' + (cfg.cursorStyle === "bubble" ? ' se-active' : '') + '" data-val="bubble">\u25CB \u6CE1\u6CE1</button>');
    html.push('      <button class="se-shape-btn' + (cfg.cursorStyle === "heart" ? ' se-active' : '') + '" data-val="heart">\u2665 \u7231\u5FC3</button>');
    html.push('    </div>');
    html.push('  </div>');

    html.push('</div>');

    // ── Click burst section ──
    html.push('<div class="se-section">');
    html.push('  <div class="se-section-title">\u70B9\u51FB\u6548\u679C</div>');

    html.push('  <div class="se-row">');
    html.push('    <span class="se-label">\u70B9\u51FB\u7206\u53D1</span>');
    html.push('    <label class="se-toggle">');
    html.push('      <input type="checkbox" id="se-burst" ' + (cfg.clickBurst ? 'checked' : '') + '>');
    html.push('      <span class="se-toggle-track"></span>');
    html.push('      <span class="se-toggle-knob"></span>');
    html.push('    </label>');
    html.push('  </div>');

    html.push('  <div class="se-row" id="se-row-burst-count"' + (!cfg.clickBurst ? ' style="opacity:0.4;pointer-events:none"' : '') + '>');
    html.push('    <span class="se-label">\u7206\u53D1\u6570\u91CF</span>');
    html.push('    <div class="se-slider-wrap">');
    html.push('      <input type="range" class="se-slider" id="se-burst-count" min="4" max="30" value="' + cfg.clickBurstCount + '">');
    html.push('      <span class="se-slider-val" id="se-burst-count-val">' + cfg.clickBurstCount + '</span>');
    html.push('    </div>');
    html.push('  </div>');

    html.push('</div>');

    // ── Custom cursor section ──
    html.push('<div class="se-section">');
    html.push('  <div class="se-section-title">\u81EA\u5B9A\u4E49\u5149\u6807</div>');

    html.push('  <div class="se-row">');
    html.push('    <span class="se-label">\u5149\u6807\u6587\u4EF6</span>');
    html.push('    <select class="se-select" id="se-cursor-file">');
    html.push('      <option value=""' + (!cfg.cursor ? ' selected' : '') + '>\u9ED8\u8BA4</option>');
    var cursors = R.cursors || [];
    for (var i = 0; i < cursors.length; i++) {
      var c = cursors[i];
      var label = c.replace(/\.\w+$/, "") + (c.endsWith(".ani") ? " (\u52A8\u753B)" : "");
      html.push('      <option value="' + c + '"' + (cfg.cursor === c ? ' selected' : '') + '>' + label + '</option>');
    }
    html.push('    </select>');
    html.push('  </div>');
    html.push('</div>');

    html.push('</div>'); // end #se-content

    // Footer
    html.push('<div class="se-footer">');
    html.push('  <button class="se-btn se-btn-off" id="se-kill">\u5B8C\u5168\u5173\u95ED\u7279\u6548</button>');
    html.push('  <button class="se-btn se-btn-reset" id="se-reset">\u91CD\u7F6E\u9ED8\u8BA4</button>');
    html.push('</div>');

    panel.innerHTML = html.join("\n");

    // ═══════════════════════════════════════
    //  Grab DOM references
    // ═══════════════════════════════════════

    var $enabled = panel.querySelector("#se-enabled");
    var $content = panel.querySelector("#se-content");
    var $close = panel.querySelector("#se-close");

    // Color mode
    var $modeFixed = panel.querySelector('[data-mode="fixed"]');
    var $modeRainbow = panel.querySelector('[data-mode="rainbow"]');

    // Fixed color
    var $color = panel.querySelector("#se-color");
    var $glow = panel.querySelector("#se-glow");
    var $rowColor = panel.querySelector("#se-row-color");
    var $rowGlow = panel.querySelector("#se-row-glow");

    // Rainbow
    var $rspeed = panel.querySelector("#se-rspeed");
    var $rspeedVal = panel.querySelector("#se-rspeed-val");
    var $rsat = panel.querySelector("#se-rsat");
    var $rsatVal = panel.querySelector("#se-rsat-val");
    var $rlight = panel.querySelector("#se-rlight");
    var $rlightVal = panel.querySelector("#se-rlight-val");
    var $rowRSpeed = panel.querySelector("#se-row-rspeed");
    var $rowRSat = panel.querySelector("#se-row-rsat");
    var $rowRLight = panel.querySelector("#se-row-rlight");

    // Counts
    var $trailCount = panel.querySelector("#se-trail-count");
    var $trailCountVal = panel.querySelector("#se-trail-count-val");
    var $cursorCount = panel.querySelector("#se-cursor-count");
    var $cursorCountVal = panel.querySelector("#se-cursor-count-val");

    // Shapes
    var $trailShapeGroup = panel.querySelector("#se-trail-shape");
    var $cursorShapeGroup = panel.querySelector("#se-cursor-shape");

    // Burst
    var $burst = panel.querySelector("#se-burst");
    var $burstCountRow = panel.querySelector("#se-row-burst-count");
    var $burstCount = panel.querySelector("#se-burst-count");
    var $burstCountVal = panel.querySelector("#se-burst-count-val");

    // Cursor file
    var $cursorFile = panel.querySelector("#se-cursor-file");

    // Reset / Kill
    var $reset = panel.querySelector("#se-reset");
    var $kill = panel.querySelector("#se-kill");

    // ═══════════════════════════════════════
    //  State & helpers
    // ═══════════════════════════════════════

    // Working copy of settings (applied live, auto-saved)
    var live = R.getSettings();

    function apply() {
      R.applySettings(live);
    }

    // Debounce for slider changes (avoid restarting effects on every pixel)
    var _debounceTimer = null;
    function applyDebounced() {
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(apply, 150);
    }

    function setColorMode(mode) {
      live.colorMode = mode;
      var fixedRows = [].concat($rowColor ? [$rowColor] : [], $rowGlow ? [$rowGlow] : []);
      var rainbowRows = [].concat($rowRSpeed ? [$rowRSpeed] : [], $rowRSat ? [$rowRSat] : [], $rowRLight ? [$rowRLight] : []);

      if (mode === "fixed") {
        $modeFixed.classList.add("se-active");
        $modeRainbow.classList.remove("se-active");
        fixedRows.forEach(function (r) { r.classList.remove("se-hidden"); });
        rainbowRows.forEach(function (r) { r.classList.add("se-hidden"); });
      } else {
        $modeRainbow.classList.add("se-active");
        $modeFixed.classList.remove("se-active");
        rainbowRows.forEach(function (r) { r.classList.remove("se-hidden"); });
        fixedRows.forEach(function (r) { r.classList.add("se-hidden"); });
      }
      apply();
    }

    function setShapeActive(group, val) {
      var btns = group.querySelectorAll(".se-shape-btn");
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].getAttribute("data-val") === val)
          btns[i].classList.add("se-active");
        else
          btns[i].classList.remove("se-active");
      }
    }

    function updateContentState() {
      if ($enabled.checked) {
        $content.classList.remove("se-disabled");
      } else {
        $content.classList.add("se-disabled");
      }
    }

    function updateGearState(disabled) {
      if (disabled) gearBtn.classList.add("se-gear-off");
      else gearBtn.classList.remove("se-gear-off");
    }

    // Populate panel from settings object
    function syncUI(s) {
      $enabled.checked = !s._disabled;
      updateContentState();

      // Color mode
      setColorMode(s.colorMode);

      $color.value = s.color;
      $glow.value = (s.glowColor || "#e8c01e").substring(0, 7);

      $rspeed.value = s.rainbowSpeed;
      $rspeedVal.textContent = s.rainbowSpeed;
      $rsat.value = s.rainbowSaturation;
      $rsatVal.textContent = s.rainbowSaturation + "%";
      $rlight.value = s.rainbowLightness;
      $rlightVal.textContent = s.rainbowLightness + "%";

      $trailCount.value = s.trailMaxCount;
      $trailCountVal.textContent = s.trailMaxCount;
      $cursorCount.value = s.cursorStarCount;
      $cursorCountVal.textContent = s.cursorStarCount;

      setShapeActive($trailShapeGroup, s.trailStyle);
      setShapeActive($cursorShapeGroup, s.cursorStyle);

      $burst.checked = s.clickBurst;
      $burstCountRow.style.opacity = s.clickBurst ? "" : "0.4";
      $burstCountRow.style.pointerEvents = s.clickBurst ? "" : "none";
      $burstCount.value = s.clickBurstCount;
      $burstCountVal.textContent = s.clickBurstCount;

      $cursorFile.value = s.cursor || "";
    }

    // ═══════════════════════════════════════
    //  Event handlers
    // ═══════════════════════════════════════

    // Open / close panel
    function openPanel() {
      live = R.getSettings();
      syncUI(live);
      panel.classList.add("se-open");
      backdrop.classList.add("se-open");
    }

    function closePanel() {
      panel.classList.remove("se-open");
      backdrop.classList.remove("se-open");
    }

    gearBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (panel.classList.contains("se-open")) closePanel();
      else openPanel();
    });

    backdrop.addEventListener("click", closePanel);
    $close.addEventListener("click", closePanel);

    // Stop panel clicks from closing via backdrop
    panel.addEventListener("click", function (e) { e.stopPropagation(); });

    // Master toggle
    $enabled.addEventListener("change", function () {
      live._disabled = !this.checked;
      updateContentState();
      updateGearState(live._disabled);
      apply();
    });

    // Color mode buttons
    $modeFixed.addEventListener("click", function () { setColorMode("fixed"); });
    $modeRainbow.addEventListener("click", function () { setColorMode("rainbow"); });

    // Color pickers
    $color.addEventListener("input", function () {
      live.color = this.value;
      applyDebounced();
    });
    $glow.addEventListener("input", function () {
      live.glowColor = this.value;
      applyDebounced();
    });

    // Rainbow sliders
    $rspeed.addEventListener("input", function () {
      live.rainbowSpeed = parseInt(this.value, 10);
      $rspeedVal.textContent = this.value;
      applyDebounced();
    });
    $rsat.addEventListener("input", function () {
      live.rainbowSaturation = parseInt(this.value, 10);
      $rsatVal.textContent = this.value + "%";
      applyDebounced();
    });
    $rlight.addEventListener("input", function () {
      live.rainbowLightness = parseInt(this.value, 10);
      $rlightVal.textContent = this.value + "%";
      applyDebounced();
    });

    // Trail count
    $trailCount.addEventListener("input", function () {
      live.trailMaxCount = parseInt(this.value, 10);
      $trailCountVal.textContent = this.value;
      applyDebounced();
    });

    // Cursor star count
    $cursorCount.addEventListener("input", function () {
      live.cursorStarCount = parseInt(this.value, 10);
      $cursorCountVal.textContent = this.value;
      applyDebounced();
    });

    // Trail shape buttons
    $trailShapeGroup.addEventListener("click", function (e) {
      var btn = e.target.closest(".se-shape-btn");
      if (!btn) return;
      live.trailStyle = btn.getAttribute("data-val");
      setShapeActive($trailShapeGroup, live.trailStyle);
      apply();
    });

    // Cursor shape buttons
    $cursorShapeGroup.addEventListener("click", function (e) {
      var btn = e.target.closest(".se-shape-btn");
      if (!btn) return;
      live.cursorStyle = btn.getAttribute("data-val");
      setShapeActive($cursorShapeGroup, live.cursorStyle);
      apply();
    });

    // Click burst toggle
    $burst.addEventListener("change", function () {
      live.clickBurst = this.checked;
      $burstCountRow.style.opacity = this.checked ? "" : "0.4";
      $burstCountRow.style.pointerEvents = this.checked ? "" : "none";
      apply();
    });

    // Burst count
    $burstCount.addEventListener("input", function () {
      live.clickBurstCount = parseInt(this.value, 10);
      $burstCountVal.textContent = this.value;
      applyDebounced();
    });

    // Cursor file select
    $cursorFile.addEventListener("change", function () {
      live.cursor = this.value;
      apply();
    });

    // "完全关闭特效" button — disable, save, close panel, dim gear
    $kill.addEventListener("click", function () {
      live._disabled = true;
      apply();
      closePanel();
      updateGearState(true);
    });

    // Reset button
    $reset.addEventListener("click", function () {
      var defaults = R.getDefaults();
      live = defaults;
      syncUI(live);
      updateGearState(false);
      apply();
    });

    // ESC to close
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("se-open")) closePanel();
    });

  }); // end waitForRuntime

})();
