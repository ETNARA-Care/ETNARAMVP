# ETNARA Care V23 frontend

This directory is the active source for the V23 interface published by GitHub
Pages. CI and deployment both install, validate, test, and build this exact
directory.

## Local validation

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

`VITE_API_URL` is required by the real API client. Missing or failed API calls
surface as errors; operational pages must never substitute demo data silently.

See `../docs/FRONTEND_DATA_AUDIT.md` for the current real, mixed, simulated,
and placeholder screen inventory.
