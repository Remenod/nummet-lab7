# Laboratory Work No. 7

Static app for solving variant 9 of the Cauchy problem with the Adams-Bashforth-Moulton predictor-corrector method:

- `y' = 2t y²`;
- `y(0) = 1`;
- interval `[0, 0.9]`;
- exact solution `y(t) = 1 / (1 - t²)`.

The site is implemented with vanilla `HTML/CSS/JS`, with no build step and no external dependencies. Charts support wheel zoom, pan, box zoom, synced zoom, hover comparison, pinned comparison, and CSV/JSON export.

## File Structure

- `math.js` contains the variant 9 equation, exact solution, RK4 bootstrap, stability step calculation, and Adams-Bashforth-Moulton solver.
- `charts.js` contains canvas rendering, zoom, pan, box zoom, hover comparison, and pinned comparison logic.
- `ui.js` contains page rendering, tables, summary metrics, and CSV/JSON export.
- `app.js` starts the application.

## Local Run

Open `index.html` in a browser or run a static server:

```bash
python3 -m http.server 8080
```

## GitHub Pages

The `.github/workflows/pages.yml` workflow publishes the repository root as a static GitHub Pages site.
