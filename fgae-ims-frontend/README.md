# FGAE IMS frontend

Preparation stage for the Family Guidance Association of Ethiopia Integrated Management System.
React, strict TypeScript and Vite are planned; tooling is not installed yet and no run/build commands are available.

Only Sign in will be implemented after the preparation commit is pushed and verified. Each subsequent page requires explicit approval of the preceding page. No deployment is authorized.

The feature-based structure separates UI, services, HTTP/DTO adapters, permissions, synthetic data and English/Amharic dictionaries. Empty directories are preparation only, not implemented features.

The local `docs/` requirements, implementation plan and progress record are intentionally ignored. `.env.example` lists public proposed configuration. Live mode must never fall back to synthetic data. A lockfile will be tracked when tooling is installed.

The existing backend is an initialization scaffold with a health endpoint; authentication and operational APIs are not implemented or verified. Provisional contracts and human Amharic terminology review remain integration dependencies.
