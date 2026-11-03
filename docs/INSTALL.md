# PREMIUM+ Community Edition

**Free web tools for people who build, repair, and improve homes.**

A self-hostable contractor workspace for real projects. Open-source under the **GNU Affero General Public License v3.0 (AGPL-3.0-only)**. No PREMIUM+ software subscription is required to use or modify this community edition. Hosting, backups, email delivery and optional third-party AI rendering may have external costs.

## Features

- Your own company profile, team permissions and private projects.
- Photo uploads, marking areas, and saved color-finish studies / before-after previews.
- Editable scopes, itemized estimates, proposals, PDF import and signed-acceptance workflow.
- Documents, customer decisions, updates, change orders, job tasks and follow-ups.
- Basic 2D/3D design tools and standalone interactive example (not a measured architectural plan).
- Locally hosted source download at **`/source.html`** on every built deployment.
- No Stripe checkout, paywall, live billing or paid AI requirement in the community edition.

## Quick start (your own computer)

**Requirements:** Node.js **24+**, npm, and Poppler (`pdfinfo`, `pdftotext`) for PDF imports.

```bash
npm ci
cp .env.example .env
npm run dev
```

Open **http://localhost:3000**; register a contractor account and create your own company. The SQLite database is created locally at `data/community.sqlite`. The `data/` folder and `.env` are excluded from source control and source downloads.

## Build and run

```bash
npm run build
NODE_ENV=production PUBLIC_URL=https://your-domain.example npm start
```

Production requires HTTPS and your **own** domain. Docker deployment is also supported; mount a private persistent volume and set `DATABASE_PATH` to that volume. See [SELF_HOST.md](SELF_HOST.md).

## Testing

```bash
npm test
npm run build
npm run test:e2e:webkit
npm run audit:community
# Additional offline smoke checks (not a replacement for full tests):
npm run verify:offline
```

This is a **pre-release Community Edition candidate**, not a security-audited production service. The Node 24 GitHub Actions verification on [PR #2](https://github.com/zg9bkbrv7p-beep/premiumplus-community/pull/2) passed dependency installation, production build, unit/API tests, **24 WebKit browser tests**, and the high/critical production dependency audit on November 3, 2026. These automated checks do not replace independent security/licensing review, tests on a physical iPhone, or production backup/restore validation. **Do not expose real customer records or launch an unreviewed multi-tenant deployment.** See the [release checklist](RELEASE_CHECKLIST.md).

## Freedom and safety

Every user can download, run, change and share the code under the [AGPLv3](../LICENSE), including commercially, under the license conditions. Operators offering a modified version over a network must provide corresponding source. Your project's **customer records remain yours**; do not include databases, uploads, tokens or secrets in a public source release.

Photo-to-Remodel's photorealistic AI integration is **optional, disabled by default** and requires explicit approval and consent. A local color study is not a realistic remodel image, measurement, permit, or structural approval.

PREMIUM+ is not affiliated with any third-party platform; review [TRADEMARKS.md](../TRADEMARKS.md) before distributing a rebranded fork. See [CONTRIBUTING.md](../CONTRIBUTING.md) and [SECURITY.md](../SECURITY.md).
