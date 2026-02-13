# Tutorial: Restore your full `WARGAME.html` code safely

This is a step-by-step checklist so your full v7.4 code is visible and preserved in the file.

## Why this helps
If your editor/session truncates or overwrites content, this flow makes it easy to:
- paste your full source once,
- verify key sections exist,
- avoid losing work.

---

## 1) Replace file content directly
Open `WARGAME.html`, select all, and paste your full code block.

Important first line must be:

```html
<!doctype html>
```

(If it starts with `@doctype html`, browsers may treat it as invalid.)

---

## 2) Quick integrity checks
Run these from repo root:

```bash
wc -l WARGAME.html
rg -n "DEFAULT_TEMPLATES|generateOceanAndLakes|renderCoast|exportStagePng|loadAutosave|btnResetTypes|toolSelectPlan|btnGenCoast|recomputeAOTerritory|marchingSquaresSegments" WARGAME.html
```

Expected outcome:
- line count should be large (your full file is much bigger than 229 lines),
- each of those symbols should be found.

---

## 3) Browser-load check
Serve and open locally:

```bash
python -m http.server 4173
```

Then open:

- `http://127.0.0.1:4173/WARGAME.html`

If blank/broken, open DevTools console and check for first JS error line.

---

## 4) Common breakages to fix first
1. Broken doctype (`@doctype` instead of `<!doctype html>`).
2. Missing closing tags (`</script>`, `</body>`, `</html>`).
3. Duplicate function names that override each other unexpectedly.
4. Missing element IDs referenced by `$("...")` lookups.
5. Truncated pasted blocks mid-function.

---

## 5) Safer workflow for long files
1. Save your full code in a second backup file first, e.g. `WARGAME.full.backup.html`.
2. Then copy backup -> `WARGAME.html`.
3. Run the integrity checks above.
4. Commit only after checks pass.

Example:

```bash
cp WARGAME.html WARGAME.full.backup.html
# paste/edit WARGAME.html
wc -l WARGAME.html
rg -n "generateOceanAndLakes|exportStagePng|loadAutosave" WARGAME.html
```

---

## 6) Minimal "known-good" anchors to confirm your full build is present
Your pasted version should include these major blocks:
- Smooth terrain paint system
- Coastline generation (ocean + lakes) with marching squares
- Infra SVG rendering
- Overlays rendering
- Unit add/render/drag/resize/rotate
- AO capture recompute
- Snapshot / replay
- Export/import JSON + PNG export
- Autosave load/save

If any one is missing, the file likely got partially overwritten.
