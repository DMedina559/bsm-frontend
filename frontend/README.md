# Bedrock Server Manager 4.0 frontend

React interface with the supplied server-stack branding, fleet dashboard, grouped navigation, and shared appearance system.

## Development

Validation used Node 24. From this directory, run `npm ci`, then `npm run dev`, and open the development URL at `/app/`. The development server proxies backend routes to `http://localhost:11325`. Set `VITE_API_URL` in `.env.local` for another backend. The Python backend must run separately; its source is not included here.

## Production integration

Replace the corresponding frontend sources and public assets in your existing project, then run `npm run build`. Vite writes to `../src/bsm_frontend/static` and clears that output directory. Preserve this location for Python package integration. Frontend 4.0 branding does not change the backend version; navigation reports the actual backend version.

## Appearance

Account settings offer nine built-in palettes and available server-provided CSS themes. Theme selection uses the existing account API. Light, dark, system, and theme-default modes, plus comfortable or compact density, are device preferences shared between tabs. Theme-load and save errors are visible.

Custom themes should use semantic `--bsm-*` variables from `src/styles/tokens.css`; legacy aliases remain available. Explicit light mode overrides shared light surfaces. Colors, typography, spacing, control sizes, focus rings, and status colors are centralized.

## Checks

Run `npm run test:run`, `npm run lint`, `npm run build`, and `npm audit`.

See `FRONTEND-AUDIT.md` for changes, evidence, and remaining integration checks.
