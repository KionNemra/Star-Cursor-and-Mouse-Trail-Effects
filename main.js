// Read active configuration profile
var config = window.StarEffects.getConfig();

// --- Star trail ---
var cursorCanvas = document.createElement("canvas");
cursorCanvas.id = "curs_canv";
document.body.appendChild(cursorCanvas);

var trail = new MouseTrail('curs_canv', {
  maxSquares: config.trailMaxCount,
  color: config.color,
  colorMode: config.colorMode,
  rainbowSpeed: config.rainbowSpeed,
  rainbowSaturation: config.rainbowSaturation,
  rainbowLightness: config.rainbowLightness,
});

window.addEventListener('mousemove', function (e) {
  trail.addPoint(e.clientX, e.clientY);
});

// --- Click burst ---
if (config.clickBurst) {
  window.addEventListener('click', function (e) {
    trail.addBurst(e.clientX, e.clientY, config.clickBurstCount);
  });
}

// --- Cursor stars ---
var cursorCanvas2 = document.createElement("canvas");
cursorCanvas2.id = "curs_canv2";
document.body.appendChild(cursorCanvas2);

var cursor = new StarCursor('curs_canv2', {
  glowColor: config.glowColor,
  starColor: config.color,
  colorMode: config.colorMode,
  rainbowSpeed: config.rainbowSpeed,
  rainbowSaturation: config.rainbowSaturation,
  rainbowLightness: config.rainbowLightness,
});

cursor.generateStars(config.cursorStarCount);

// --- Single shared animation loop ---
function animate(timestamp) {
  trail.update(timestamp);
  cursor.update(timestamp);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
