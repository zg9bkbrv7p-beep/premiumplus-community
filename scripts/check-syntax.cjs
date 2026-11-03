// Syntax smoke check only, not a TypeScript typecheck or production build.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let ts;
try { ts = require('typescript'); }
catch (_) {
  try { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); }
  catch { throw Error('TypeScript is unavailable. Run npm ci before using this check.'); }
}
let files = 0;
const errors=[];
for (const dir of ['src', 'server', 'shared', 'scripts', 'tests']) {
  const walk = d => {
    for (const entry of fs.readdirSync(d,{withFileTypes:true})) {
      const full=path.join(d,entry.name);
      if(entry.isDirectory())walk(full);
      else if (/\.(?:ts|tsx|mts|cts)$/.test(entry.name)) {
        files++;
        const result=ts.transpileModule(fs.readFileSync(full,'utf8'), {
          fileName:full,
          reportDiagnostics:true,
          compilerOptions:{jsx:ts.JsxEmit.ReactJSX, module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
        });
        for (const diag of result.diagnostics || []) {
          if(diag.category === ts.DiagnosticCategory.Error)
            errors.push(`${path.relative(root,full)} [TS${diag.code}]: ${ts.flattenDiagnosticMessageText(diag.messageText,' ')}`);
        }
      }
    }
  };
  walk(path.join(root,dir));
}
console.log(`${files} TypeScript/TSX source files scanned; ${errors.length} syntax errors.`);
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}
