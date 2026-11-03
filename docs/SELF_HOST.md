# Self-hosting guide

## Local

Install Node.js 24 or newer, npm, and `poppler-utils`. Run `npm ci` then `npm run dev`. Browse to `http://localhost:3000`. Data defaults to `data/community.sqlite`.

## Online

1. Set up your own server/container host and HTTPS domain.
2. Set `NODE_ENV=production`, `PUBLIC_URL=https://your-domain.example`, `PORT=3000`, `DATABASE_PATH=/private-volume/community.sqlite`.
3. Use a writable, persistent private volume for the SQLite database and backups; avoid ephemeral disk.
4. Build with `npm run build` then run `npm start`, or use the included Dockerfile.
5. Verify `/api/health`, registrations, passwords, role isolation, private photo storage, proposals, PDF import, backups and source download at `/source.html`.
6. If you modify the application, rebuild: `npm run build` refreshes the public source archive. Keep it accessible as required by AGPLv3.

Do not expose port 3000 publicly without HTTPS and hardening. Do not use the personal PREMIUM+ Commercial Railway service or database for community deployments.

Optional photorealistic rendering requires user consent and external provider configuration. It is disabled by default; local color studies work without it.
