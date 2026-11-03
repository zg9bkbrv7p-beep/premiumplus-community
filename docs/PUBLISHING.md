# Publishing and maintaining PREMIUM+ Community Edition

The public repository is **[premiumplus-community](https://github.com/zg9bkbrv7p-beep/premiumplus-community)**. Source code is already committed to the `main` branch under the AGPLv3 license. It has **fresh history separate from the private PREMIUM+ Commercial repositories**.

## Current status — RC2 source available, not certified for customer data

The PR #2 GitHub verification passed on November 3, 2026: clean Node 24 install, offline source checks, TypeScript/Vite build, unit/API tests, 24 WebKit browser tests and an npm production dependency security audit reporting no high/critical findings.

Remaining release gates are listed in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md): independent security/license review, real iPhone verification, permission testing under hostile conditions, secure hosted configuration and backup/restore exercises with **fictional** data.

## For developers

1. Clone `https://github.com/zg9bkbrv7p-beep/premiumplus-community.git`.
2. Follow [INSTALL.md](INSTALL.md) to install Node 24+ dependencies and Poppler utilities.
3. Use fake projects and addresses for testing; do not connect real homeowner records until the production review is complete.
4. Run `npm run verify:offline`, `npm run build`, `npm test`, `npm run test:e2e:webkit`, and `npm audit --omit=dev --audit-level=high`.
5. Open a pull request for code changes. Do not merge a failed CI run or changes that weaken project/company authorization.

## For maintainers

- Never import the existing private PREMIUM+ repository history, customer databases, backups, keys, media or `.env` into this public project.
- Keep source-download disclosure at `/source.html` intact in hosted builds; the build process creates the source tarball.
- Verify licensing/rights of every added dependency, code sample and image.
- Only create a version tag or announce a customer-ready hosted deployment after the release checklist is complete.
- If sharing a hosted service, ensure HTTPS, private storage and backups, tenant isolation, authentication, a privacy policy and appropriate retention/deletion controls. Paid AI services are optional and must require consent before using customer photos.

This public source release **does not touch** the original PREMIUM+ Commercial Railway service.
