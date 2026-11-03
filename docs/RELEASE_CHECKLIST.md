# Community Edition release checklist

This page is a **required verification checklist**. A checked box requires recorded test evidence.

- [x] New public GitHub repository created separately from private Commercial repositories
- [x] Community project README and full AGPLv3 license prepared
- [x] Offline smoke suite: 7 of 7 core tests passed in preparation workspace (does not cover full app)
- [x] TypeScript/TSX syntax scan: 112 files passed in preparation workspace
- [ ] Confirm authorship rights and third-party license obligations for all source/assets
- [ ] Independent customer-data, access-token and historical-secret review
- [ ] Run `npm ci --include=dev --strict-ssl=true` using Node 24
- [ ] Run `npm run verify:offline`, `npm run build`, `npm test`
- [ ] Install and run Playwright WebKit browser tests
- [ ] Run `npm audit --omit=dev --audit-level=high`, fix all high/critical findings
- [ ] Test company/project data isolation and homeowner boundaries with fictional records
- [ ] Verify PDF importing, saved proposals, acceptance, documents, photo workflows, database backup and restore
- [ ] Verify setup on iPhone Safari and desktop
- [ ] Publish reviewed application source to this repository and get a green CI workflow
- [ ] Tag a tested release and publish real installation instructions

**Not yet certified for public hosting or real customer data.**
