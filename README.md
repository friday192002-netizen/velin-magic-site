# VELIN — Magic, made personal.

Static artist portfolio. No build step or client-side framework.

## Preview
```powershell
python -m http.server 4322 --bind 127.0.0.1
```
Open http://127.0.0.1:4322/.

## Edit
- Page/content: index.html
- Styling: assets/css/site.css
- Behaviour: assets/js/site.js
- Photos: assets/images/
- Contact links: index.html (search for lin.ee or tel:)
- Source attribution: docs/asset-sources.json
- Handoff and limitations: docs/HANDOFF.md

Previous implementation is preserved in archive/previous-site and excluded from Vercel deployments. Legacy scripts and the design canvas are preserved under archive/. Untitled Magic remains a separate untouched project.

## Deployment
Existing public repository: https://github.com/friday192002-netizen/velin-magic-site
Existing production: https://velin-magic-site.vercel.app/
Push main only when publication is requested; Vercel deploys automatically. This redesign is currently local and not published.
