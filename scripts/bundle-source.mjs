// Bundle exactly the published community source. No runtime data, env files or secrets.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
mkdirSync('public', {recursive:true});
const files = ['LICENSE','README.md','NOTICE.md','CONTRIBUTING.md','CODE_OF_CONDUCT.md','SECURITY.md','TRADEMARKS.md',
  'package.json','package-lock.json','Dockerfile','.env.example','.gitignore',
  '.github','tsconfig.json','vite.config.ts','vitest.config.ts','index.html',
  'playwright.config.ts','playwright.webkit.config.ts','playwright.remodel.config.ts',
  'playwright.corrections.config.ts','src','server','shared','scripts','tests','docs',
  'public/images','public/source.html','licenses'];
const result = spawnSync('tar', ['-czf','public/source-code.tar.gz',...files], {stdio:'inherit'});
if (result.status !== 0) throw new Error('Could not bundle public source');
