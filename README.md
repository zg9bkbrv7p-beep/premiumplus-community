# PREMIUM+ Community Edition

**Professional tools for the people who do the work.**

PREMIUM+ Community Edition is an open-source initiative to give independent contractors and small remodeling businesses useful web tools for their own jobs, without a required PREMIUM+ software subscription.

## Project status

**Release preparation — not ready for customer data or public hosting yet.**

The separate Community Edition source has been prepared as a review candidate, but the full production build, security checks, real-browser tests, and multi-company privacy tests have **not** all passed. The application source will be added here after those release checks and an independent licensing/privacy review. This empty/release-preparation repository does **not** yet contain a runnable app.

## Intended features

- Private project management and job tracking
- Estimates, scope of work, proposals, and PDF import
- Photos, local finish-color studies, and before/after comparison
- Documents, homeowner approvals, changes, and warranty follow-ups
- Optional design tools; AI remodeling renders are not included for free and are disabled by default

## Principles

- **Free to use, inspect, modify and share** under the AGPLv3 license when the covered source is released.
- Your business and customer records belong to you; never commit customer data, passwords, secrets, photos, or databases into a public repository.
- No required PREMIUM+ software subscription; independent hosting, storage, email, or optional third-party services may incur costs.
- Community contributions are welcome after the first verified release.

## Release gate

Before releasing or hosting code: verify ownership and third-party licenses; audit for credentials and customer data; run Node 24 dependency install, build, unit/API tests, browser tests, and a dependency security audit; validate tenant isolation, authentication, backups, and PDFs.

**This repository is separate from the private PREMIUM+ Commercial service and repositories. No live customer data is included.**

For responsible vulnerability reports, see [SECURITY.md](SECURITY.md).

---
*Built for the people who build.*
