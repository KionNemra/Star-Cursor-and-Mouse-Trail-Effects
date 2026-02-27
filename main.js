// Star trail
const cursorCanvas = document.createElement("canvas");
cursorCanvas.id = "curs_canv";
document.body.appendChild(cursorCanvas);
const trail = new MouseTrail('curs_canv');

window.addEventListener('mousemove', e => {
  trail.addPoint(e.clientX, e.clientY);
});

// Cursor stars
const cursorCanvas2 = document.createElement("canvas");
cursorCanvas2.id = "curs_canv2";
document.body.appendChild(cursorCanvas2);
const cursor = new StarCursor('curs_canv2');
// You can change the design and layout of the stars here
cursor.addStar(new Star(window.innerWidth / 2, window.innerHeight / 2, 1, 2, 1, 0.3, -10, 0, 150));
cursor.addStar(new Star(window.innerWidth / 2, window.innerHeight / 2, 0.5, 1, 0.5, 0.05, 10));
cursor.addStar(new Star(window.innerWidth / 2, window.innerHeight / 2, 0.5, 1, 0.5, 0.1, -5, 20));

// Single shared animation loop (instead of two separate rAF loops)
function animate(timestamp) {
  trail.update(timestamp);
  cursor.update(timestamp);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);