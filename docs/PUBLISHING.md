# Publishing the Community Edition

The source package is intended for a **new public repository with fresh Git history**. Never switch the existing private PREMIUM+ repositories to public or push their `.git` history.

## Before a public announcement

1. Verify that the software author(s)/copyright holder(s) authorize AGPL-3.0-only. Ensure that all third-party code/assets are licensed compatibly.
2. Using Node.js 24+, run `npm ci`, `npm run audit:community`, `npm test`, `npm run build`, and relevant WebKit mobile tests. Resolve any failures. Run a dependency vulnerability audit (`npm audit`).
3. Test authenticated contractor and homeowner flows, private photos, contract snapshots, PDF import, database backup, restoration and tenant isolation using **fictional** projects only.
4. Manually review every file and commit for personal information, tokens, customer uploads and unlicensed assets.
5. Choose a new public GitHub repository name such as `premiumplus-community`. Do not initialize it from the old private repository.
6. Unzip this archive **outside any private repository**. Create a clean Git repository, add files, and push to the new public repository.
7. Publish a release tagged `v0.1.0-rc1` until the complete deployment and regression checks pass.
8. If deploying it for people to use online, provide HTTPS, secure persistent storage and a privacy notice. The `/source.html` footer/source download must remain accessible; builds regenerate its source tarball.

## Example Git commands after creating an empty new GitHub repo

```bash
git init
git add .
git commit -m "Initial AGPLv3 Community Edition candidate"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/premiumplus-community.git
git push -u origin main
```

Do not commit `.env`, `data/`, actual customer records, build logs, private backups or private authentication history. The `.gitignore` excludes common local artifacts. GitHub website access settings are managed separately from the code and ZIP files.
