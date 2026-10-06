# Bedrock Server Manager frontend

React interface with the supplied server-stack branding, fleet dashboard, grouped navigation, and shared appearance system.

## Development

Validation used Node 24. From this directory, run `npm ci`, then `npm run dev`, and open the development URL at `/app/`. The development server proxies backend routes to `http://localhost:11325`. Set `VITE_API_URL` in `.env.local` for another backend. The Python backend must run separately; its source is not included here.

## Production integration

Replace the corresponding frontend sources and public assets in your existing project, then run `npm run build`. Vite writes to `../src/bsm_frontend/static` and clears that output directory. Preserve this location for Python package integration. Navigation reports the actual backend version; the footer reports the frontend build version.

## Appearance

Account settings offer nine built-in palettes and available server-provided CSS themes. Theme selection uses the existing account API. Light, dark, system, and theme-default modes, plus comfortable or compact density, are device preferences shared between tabs. Theme-load and save errors are visible.

Custom themes should use semantic `--bsm-*` variables from `src/styles/tokens.css`; legacy aliases remain available. Explicit light mode overrides shared light surfaces. Colors, typography, spacing, control sizes, focus rings, and status colors are centralized.

## Checks

Run `npm run test:run`, `npm run lint`, `npm run build`, and `npm audit`.

See `FRONTEND-AUDIT.md` for changes, evidence, and remaining integration checks.

## Appearance and custom themes

Appearance is a separate navigation page at `/appearance`; Account contains profile and password settings. Comfortable and compact density change control padding and heights, navigation rows, form gaps, table spacing, and panel padding.

Create personal palettes in Appearance with the five color pickers. Save and apply to keep the palette in this browser. Reusing its name updates it; Edit loads it into the editor and Remove deletes it. Selecting an account theme disables the personal override. Display mode and density remain independent. Contrast feedback checks normal and secondary text on panel and page backgrounds. Personal palettes explicitly override colors in every display mode.

Export palette JSON to share or back up and Import palette to load it in another browser. Export CSS theme generates semantic CSS for a backend administrator to install. Installed server CSS themes come from `GET /api/info/themes`; selecting one saves its name through `POST /api/account/theme`, and the browser loads `/themes/NAME.css`. Reload Appearance after installing a new server theme. Use a simple filename without the `.css` extension as the listed theme name.

The supplied frontend has no backend theme-upload endpoint. Install shared CSS files using your backend's theme directory and deployment process; its exact filesystem location depends on that installation. No unsupported file-upload API has been added. Personal palette import works entirely in the browser.

## Fleet layout and sorting

New browser preferences default to compact density; existing saved density choices are preserved. The overview uses a smaller banner and tighter summary cards. Sort the server fleet by name, status, version, or player count in either direction. Names and versions use natural numeric ordering; unknown values stay last. Sort preferences are retained in this browser. Sidebar splash text uses the theme’s yellow warning color.

Panorama background is an optional switch in Appearance, disabled by default. It is saved as a browser display preference, uses the existing `/api/panorama` endpoint on the configured backend, and adds a theme-colored overlay for legibility. Turning it off removes the image reference; resetting display preferences disables it.

## Notification history

The top-bar bell opens missed toast messages with severity and local timestamps. Messages remain in history after dismissal and survive reloads for signed-in accounts. History retains the latest 100 messages for seven days, stored separately for each account and configured backend in this browser. Opening history marks existing entries read; Clear history removes the saved messages. Guest messages remain in memory only. If browser storage is unavailable, history still works for the current page session.

Personal palettes use the same swatch-card layout as built-in themes. Create palette or a card’s Edit control opens a focused editor dialog; saving applies the palette and closes the editor. Selection, import, removal, and export remain available.

Panorama visibility in Appearance controls image prominence from 0% to 100% when enabled. It defaults to 18% to preserve the previous subtle background, is saved in this browser, and resets with other display preferences. Panel surfaces retain their theme colors.

Sidebar transparency is a separate 0–100% browser preference in Appearance, defaulting to fully opaque. It changes only the sidebar background; labels and controls retain their opacity. Reset display preferences restores 0%.

If deployment requests bundles from `/assets/` rather than `/app/assets/`, rebuild this frontend, deploy the complete output including its index.html and assets directory together, restart the backend if needed, and hard-refresh the browser. The HTML includes a static app base and adjusts it for ingress routes. Do not mix an older index.html with newer hashed bundles.

Built-in theme cards preview their actual default-mode page, panel, and accent colors. Non-default themes now have distinct surface palettes in both dark and light modes; the original Bedrock Emerald remains unchanged. Personal palette overrides continue to take priority.

Density now scales typography and card geometry throughout the interface. Comfortable uses 15px body text, 20px card padding, 24px grid gaps, and 340px minimum fleet-card width; Compact uses 13px, 12px, 12px, and 270px respectively. Headings, navigation, icons, previews, dialogs, and tables also scale. Mobile tap targets remain at least 44px, with 16px input text in both modes.
