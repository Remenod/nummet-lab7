# Laboratory Work No. 7

Static app for solving the Cauchy problem with multistep predictor-corrector methods:

- Adams-Bashforth-Moulton;
- Milne-Simpson;
- Hamming.

The site is implemented with vanilla `HTML/CSS/JS`, with no build step and no external dependencies. Variant 9 opens by default, but the interface supports all 20 variants from the lab assignment.

## Local Run

Open `index.html` in a browser or run a static server:

```bash
python3 -m http.server 8080
```

## GitHub Pages

The `.github/workflows/pages.yml` workflow publishes the repository root as a static GitHub Pages site.
