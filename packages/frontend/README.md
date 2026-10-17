# BSM frontend assets

Prebuilt HTML, JavaScript, styles, and images for the Bedrock Server Manager web
interface. This is a static application, not a React component library or an API
server. Serve the package's `dist/` directory with an HTTP server and configure
history fallback to `index.html`.

The default application path is `/app/`. For standalone hosting, edit the
`bsm-config` JSON element in `index.html` before serving the files:

```json
{ "mode": "standalone", "appBase": "/", "backendUrl": "https://bsm.example" }
```

Users can change the backend from the sign-in screen. HTTP requests and sockets
connect directly from their browser to that backend. Configure the backend's
allowed HTTP and WebSocket origins and use HTTPS for an HTTPS-hosted interface.
Credentials are scoped to the selected backend. Compatibility checks report
missing backend API operations without assuming version strings are comparable.

Frontend releases publish both this package and the Python asset distribution
from the same verified build. A GitHub release tagged `frontend-1.3.0b7` produces
npm version `1.3.0-beta.7` and Python version `1.3.0b7`. The API client has its own
release schedule. No manual version bump is required.
