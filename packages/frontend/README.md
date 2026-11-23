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

One GitHub release publishes this package, the API client, runtime, storage, and
Python frontend distribution together. A tag such as `1.4.0b1` gives all npm
packages version `1.4.0-beta.1` and Python version `1.4.0b1`. The npm and Python
frontend distributions share the same verified web build. No manual version bump
is required. See the [release guide](https://github.com/DMedina559/bsm-frontend#releases).
