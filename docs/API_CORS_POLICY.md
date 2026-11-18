# API credentialed CORS policy

The API uses cookie credentials for browser sessions. Cross-origin browser access must be restricted to exact trusted front-end origins.

## Configuration

Set `MMT_CORS_ALLOWED_ORIGINS` on the API service to a comma-separated list of exact HTTPS origins, with no paths or trailing slash. Example format:

```text
https://panel.mmtglobal.com.tr,https://welattr-transport-panel.onrender.com
```

These are the known panel hostnames from the application configuration and Render service metadata. Before configuring or deploying, confirm which hostnames actually call this API and add only those. Do not add an origin merely because it is a related MMT/Replit domain.

An absent or empty setting denies cross-origin browser access. Same-origin requests do not need CORS permission. Requests without an Origin header remain usable by server-to-server callers; they still require the route's normal authentication or provider-signature checks.

Invalid configuration fails during API startup. Wildcards, URL paths, HTTP origins outside localhost, and prefix/suffix matches are not accepted.

## Release steps

1. Verify the front-end API base URL and browser origin from the active deployment configuration.
2. Set only the verified exact origins on the isolated test API service.
3. Verify allowed-origin preflight and denied-origin behavior on that test service.
4. Merge/deploy only after those checks and the API route authorization inventory pass.

CORS is a browser response-sharing policy, not route authentication or CSRF protection. Keep Clerk/session checks, bearer checks, webhook signatures, and role authorization in place.
