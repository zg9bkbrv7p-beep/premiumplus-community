// Offline structural check for packaging, source disclosures, and secrets.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd();
const text = p => readFileSync(join(root,p),'utf8');
const errors=[];
const assert=(check,message)=>{if(!check)errors.push(message)};
const pkg=JSON.parse(text('package.json'));
assert(pkg.license==='AGPL-3.0-only','AGPL declaration absent');
assert(!pkg.dependencies.stripe,'Stripe dependency must not be bundled');
const server=text('server/app.ts');
assert(!/mountBilling|billingWebhook|requirePaidWrite/.test(server),'Paywall/billing hooks remain');
assert(!/Company & billing/.test(text('src/App.tsx')),'Billing navigation remains');
assert(text('src/App.tsx').includes('href="/source.html"'),'Source link missing from app footer');
assert(existsSync(join(root,'LICENSE')) && text('LICENSE').includes('GNU AFFERO GENERAL PUBLIC LICENSE'),'AGPL license file missing');
assert(existsSync(join(root,'public/source.html')),'Source-download page missing');
const skipped = new Set(['node_modules','.git','dist','data','artifacts','test-results','playwright-report']);
const suspicious=[];
function inspect(dir){for(const f of readdirSync(dir)){if(skipped.has(f))continue;const p=join(dir,f);const st=statSync(p);if(st.isDirectory())inspect(p);else if(f==='audit-community.mjs')continue;else if(st.isFile()&&!/\.(webp|jpe?g|png|pdf|zip|gz|woff2)$/.test(f)&&f!=='LICENSE'){let s;try{s=readFileSync(p,'utf8')}catch{continue}
  const checks=[/-----BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY-----/g,/\b(?:sk_live|rk_live|whsec|github_pat|ghp)_[-A-Za-z0-9]{16,}\b/g, /\b(?:alberto\s+pompa|niloy|3215\s+western|premium-photo\.hatchable\.site|commercial-staging-commercial-staging)\b/gi];
  for(const rx of checks)if(rx.test(s))suspicious.push(relative(root,p)+': '+rx.source);
}}}
inspect(root);
assert(!suspicious.length,'Sensitive references: '+suspicious.join('; '));
const archive=spawnSync('tar',['-tzf','public/source-code.tar.gz'],{encoding:'utf8'});
assert(archive.status===0,'Source tarball missing or invalid');
if(archive.status===0){
  const files=archive.stdout.split('\n');
  assert(files.includes('LICENSE'),'License not in source tarball');
  assert(files.includes('server/app.ts'),'Server source not in source tarball');
  assert(!files.some(f=>f==='public/source-code.tar.gz'||/(^|\/)(?:\.env|data|node_modules|\.git)(\/|$)/.test(f)),'Private/generated data in source archive');
}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('Community structural audit PASS: AGPL notice, billing removal, sanitized sources, build source bundle, no obvious credentials/PII.');
console.log('This is NOT a replacement for dependency, security, runtime or mobile tests.');
