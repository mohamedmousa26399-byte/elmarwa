# Elmarwa

Static website for Elmarwa Trade & Supply & Renewable Energy. Plain HTML/CSS/JS — no build step.

## Live site (GitHub Pages)

Every push to `main` deploys automatically via `.github/workflows/pages.yml`.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The site is then served at `https://mohamedmousa26399-byte.github.io/elmarwa/`.

## Run locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Editing

- Pages: the `*.html` files in the repo root; shared styles in `styles.css`.
- Downloads: put PDFs in `docs/` and list them in `downloads-data.js`.
- Contact form: on GitHub Pages it opens the visitor's email app addressed to
  `info@solarvalleypv.com` with the form contents, then shows `thank-you.html`.
