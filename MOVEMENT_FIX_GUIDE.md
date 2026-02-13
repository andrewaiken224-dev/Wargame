# Fixing smooth movement after unit spawn (HTML/CSS/JS)

You’re right: this kind of issue usually needs HTML/CSS + JS to work together.

This repo currently does not contain your game files, so I can’t patch your exact code directly. But you can apply the pattern below in your project.

## 1) HTML: keep units in a positioned playfield

```html
<div id="map" class="map"></div>
```

## 2) CSS: make units absolutely positioned and animatable

```css
.map {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.unit {
  position: absolute;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #4cc2ff;

  /* Critical for smooth visual movement */
  transition: transform 120ms linear;
  will-change: transform;

  /* Optional: avoid accidental browser drag/select behavior */
  user-select: none;
  pointer-events: none;
}
```

## 3) JS: spawn once, then move via `transform` only

```js
const map = document.getElementById('map');
const units = new Map();

function spawnUnit(id, x, y) {
  const el = document.createElement('div');
  el.className = 'unit';
  el.dataset.id = id;

  // Start exactly where the server/game state says.
  el.style.transform = `translate(${x}px, ${y}px)`;

  map.appendChild(el);
  units.set(id, { el, x, y });
}

function moveUnit(id, nextX, nextY) {
  const unit = units.get(id);
  if (!unit) return;

  unit.x = nextX;
  unit.y = nextY;

  // Move only this property each tick.
  unit.el.style.transform = `translate(${nextX}px, ${nextY}px)`;
}
```

## 4) Common reason movement looks "not smooth" right after spawn

If you spawn and move in the same frame, the browser may not animate the first move. Force one paint between spawn and first move:

```js
function spawnThenMoveSmoothly(id, startX, startY, endX, endY) {
  spawnUnit(id, startX, startY);

  // Let browser paint spawn state first, then animate to destination.
  requestAnimationFrame(() => {
    moveUnit(id, endX, endY);
  });
}
```

## 5) Extra stability tips

- Keep updates on `requestAnimationFrame` cadence when possible.
- Avoid changing `left/top` repeatedly; prefer `transform`.
- Do not recreate DOM node on every update; update existing node.
- If server ticks are sparse, interpolate client-side between snapshots.

## 6) If you share your real files

Once you add your actual HTML/CSS/JS files to this repository, I can patch your code directly and verify with exact diffs/tests.
