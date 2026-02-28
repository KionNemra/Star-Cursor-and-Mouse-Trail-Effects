// Star Effects Configuration System
// Supports named profiles for future cursor theme integration (cur/ani files).
//
// Basic usage - set before loading scripts:
//   window.StarEffectsConfig = { colorMode: "rainbow", clickBurst: true };
//
// Profile usage (associate profiles with cursor files):
//   window.StarEffectsConfig = {
//     activeProfile: "neon",
//     profiles: {
//       neon:  { colorMode: "rainbow", clickBurst: true, cursor: "cursor/cyan.ani" },
//       ice:   { colorMode: "fixed", color: "#88ccff", cursor: "cursor/white.cur" },
//     }
//   };

(function () {
  var DEFAULTS = {
    // --- Color mode ---
    colorMode: "fixed",        // "fixed" | "rainbow"

    // --- Fixed color settings ---
    color: "#c8b869",          // star / trail fill color
    glowColor: "#e8c01eff",   // cursor-star glow color

    // --- Rainbow mode settings ---
    rainbowSpeed: 3,           // hue rotation speed (degrees per step)
    rainbowSaturation: 100,    // HSL saturation (%)
    rainbowLightness: 65,      // HSL lightness  (%)

    // --- Star counts ---
    trailMaxCount: 20,         // max simultaneous trail particles
    cursorStarCount: 3,        // stationary cursor stars around pointer

    // --- Click burst ---
    clickBurst: false,         // whether clicking spawns a burst of particles
    clickBurstCount: 12,       // particles per click burst

    // --- Shape styles ---
    trailStyle: "star",        // trail particle shape: "star" | "bubble" | "heart"
    cursorStyle: "star",       // cursor star shape:    "star" | "bubble" | "heart"

    // --- Custom cursor ---
    cursor: null,              // path to .cur or .ani file, null = browser default
  };

  var userConfig = window.StarEffectsConfig || {};

  // Build profiles map, starting with defaults
  var profiles = { default: assign({}, DEFAULTS) };

  // Merge user-defined profiles
  if (userConfig.profiles) {
    for (var name in userConfig.profiles) {
      if (userConfig.profiles.hasOwnProperty(name)) {
        profiles[name] = assign({}, DEFAULTS, userConfig.profiles[name]);
      }
    }
  }

  // Top-level user overrides go into the "default" profile
  for (var key in userConfig) {
    if (userConfig.hasOwnProperty(key) && key !== "profiles" && key !== "activeProfile" && key in DEFAULTS) {
      profiles["default"][key] = userConfig[key];
    }
  }

  window.StarEffects = {
    profiles: profiles,
    activeProfile: userConfig.activeProfile || "default",

    /** Return the currently active profile config. */
    getConfig: function () {
      return this.profiles[this.activeProfile] || this.profiles["default"];
    },

    /** Switch to a named profile. Returns true if found. */
    setProfile: function (name) {
      if (this.profiles[name]) {
        this.activeProfile = name;
        return true;
      }
      return false;
    },

    /** Register a new profile (merges with defaults). */
    addProfile: function (name, config) {
      this.profiles[name] = assign({}, DEFAULTS, config);
    },

    /** Reference to active CursorManager instance (set by main.js). */
    cursorManager: null,
  };

  // --- helpers ---
  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      if (src) {
        for (var k in src) {
          if (src.hasOwnProperty(k)) target[k] = src[k];
        }
      }
    }
    return target;
  }
})();
