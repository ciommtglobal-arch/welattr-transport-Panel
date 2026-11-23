# Panel to API routing

The Render panel service runs the root `server.js`. The website API client uses relative `/api` paths. The panel server currently proxies Clerk's `/api/__clerk` path separately; other `/api` paths must be sent to the API service before static-file fallback.

## Configuration

Set `MMT_API_UPSTREAM_URL` on the panel service to the exact HTTPS origin of the intended API service, for example:

```text
https://welattr-api-test.onrender.com
```

The value must be an origin only, with no credentials, path, query, or fragment. An empty value keeps the API proxy disabled and returns a JSON 503 for API paths rather than serving the website HTML. The proxy cannot be used to choose an arbitrary target from a request.

The proxy handles `/api` and `/kasa/api`, preserves the browser session and authorization headers, forwards the original host for Clerk, and keeps provider webhook signatures intact by streaming the raw request body. Route-level authentication and webhook signature checks remain the API's responsibility.

## Release sequence

1. Verify which API service is the intended isolated test target.
2. Configure this origin only on the isolated panel test service.
3. Verify one allowed health request, one signed-out staff request, one authorized staff request, and an invalid webhook signature.
4. Check that all responses pass through the API and that no route returns the SPA document as API data.
5. Keep the worker and external-operation gates disabled; merge/deploy only after test evidence and CIO review.

No Render environment variable or service was changed as part of the code preparation.
