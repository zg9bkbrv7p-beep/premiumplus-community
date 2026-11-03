# Codex agent instructions — PREMIUM+ Community Edition

## Scope and boundaries

- This repository is the **public, open-source PREMIUM+ Community Edition**, not the running PREMIUM+ Commercial Railway application.
- Work only on code and files in this repository. Never claim to audit, patch, deploy, or synchronize the separate private Commercial app from here.
- Do **not** deploy to Railway, Cloudflare, Netlify, or other hosting; enable billing or paid AI services; change remote databases; or publish customer records.
- Never add secrets, API keys, private repository contents, real homeowner information, real property addresses, photographs from a private job, or business payment information to code, logs, tests, screenshots, issue comments, or commits.
- Use fictional fixtures for all development and testing. The current release is a **pre-release** and is not independently security certified.

## Working practices

- Start by explaining the requested change and the specific files affected; preserve the existing forest-green/ivory design and existing major workflows.
- For an audit request, work **read-only** and report code locations, severity, reproduction steps, and proposed fixes. Do not edit until the user explicitly requests edits.
- For an authorized implementation task, work on a feature branch and propose a reviewable pull request; do not force-push or directly alter the release branch without a request.
- Prefer small, focused fixes and tests over redesigns and large dependency additions.
- Use the current React, Three.js, pdf-lib and existing application architecture. Do not replace the renderer, change the data model, or copy another product's proprietary code.
- Review licenses and attribution before incorporating third-party open-source code or assets. Free to view is not automatically free to copy.
- Explain clearly when a feature works only in a demo, requires a third-party service, or is not yet tested.

## Build and verification

- Read `README.md`, `docs/INSTALL.md`, `docs/RELEASE_CHECKLIST.md`, and `SECURITY.md`.
- Use Node.js 24+ and install Poppler utilities (`pdfinfo`, `pdftotext`) where supported.
- Installation: `npm ci --include=dev --strict-ssl=true`.
- Baseline: `npm run verify:offline`, `npm run build`, `npm test`.
- Browser verification: `npx playwright install --with-deps webkit`, then `npm run test:e2e:webkit`.
- Dependency audit: `npm audit --omit=dev --audit-level=high`.
- Report which checks actually ran, which passed, and anything skipped. Do not invent passing tests or claim physical-iPhone testing based on simulated WebKit.

## Areas to prioritize

1. Company/contractor/homeowner authorization and data isolation.
2. Proposal pricing, PDF import, customer approvals and document retention.
3. Jobsite photo security, storage, and consent.
4. Live Project status, decisions, revisions and change orders.
5. Mobile Safari usability, accessibility, and predictable touch interactions.
6. Existing 2D/3D editor consistency and safe import/export without renderer replacement.

For public contribution questions, direct users to the contractor feedback form in `README.md`. For vulnerabilities, follow `SECURITY.md`.
