// Dependency-free regression checks for environments without npm packages.
const {readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const vm=require('node:vm');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');}
const root=path.resolve(__dirname,'..');
function text(f){return readFileSync(path.join(root,f),'utf8');}
const target=['src/App.tsx','src/workspace/Workspace.tsx','src/workspace/ProjectPage.tsx','src/client/ClientPortal.tsx','src/proposals/Editor.tsx','src/remodel/PhotoRemodel.tsx','src/planlab/PlanLab.tsx','src/planlab/measure.ts'];
for (const name of target){
  const compiled=ts.transpileModule(text(name),{fileName:name,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX, module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}});
  const errors=(compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
  assert.equal(errors.length,0,`${name} TS syntax errors`);
}
console.log('PASS: all eight changed TS/TSX files parse');
const js=ts.transpileModule(text('src/planlab/measure.ts'),{fileName:'measure.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
const out={exports:{}};vm.runInNewContext(js,{exports:out.exports,module:out});
const {calibrate,measure,asProjectExport}=out.exports;
const a=calibrate({x:200,y:172},{x:600,y:172},40);
assert.ok(Math.abs(a.feetPerPixel-0.1)<1e-10);
assert.ok(Math.abs(measure({x:200,y:172},{x:300,y:172},a)-10)<1e-10);
console.log('PASS: 400 pixel reference = 40 feet and 100 pixel distance = 10 feet');
assert.throws(()=>calibrate({x:0,y:0},{x:0,y:0},40));
assert.throws(()=>calibrate({x:0,y:0},{x:50,y:0},0));
assert.throws(()=>calibrate({x:0,y:0},{x:50,y:0},NaN));
assert.throws(()=>measure({x:0,y:0},{x:50,y:0},null));
console.log('PASS: invalid/missing calibration is rejected');
const data=asProjectExport({projectId:'fictional-id',projectName:'Fictional work',address:'Fictional site',planName:'sample.svg',calibration:a,measurements:[{first:{x:200,y:172},second:{x:300,y:172},feet:10}]});
assert.equal(data.origin.existingProjectId,'fictional-id');
assert.equal(data.plot.units,'feet');
assert.equal(data.plot.measurements[0].feet,10);
assert.match(data.warnings.join(' '),/were modified/);
console.log('PASS: export retains existing project id and safety note');
assert.ok(!/DemoStudio|setDemo|\?demo=3d|\["designs"/.test(text('src/App.tsx')));
assert.ok(!/SceneView|Explore in 3D/.test(text('src/client/ClientPortal.tsx')));
assert.ok(!/\["design",.*Design studio|<Studio\b/.test(text('src/workspace/ProjectPage.tsx')));
assert.match(text('src/workspace/ProjectPage.tsx'),/<PlanLab /);
assert.match(text('src/proposals/Editor.tsx'),/PdfImport/);
assert.match(text('src/workspace/Workspace.tsx'),/PDF & 2D Plan Tools/);
console.log('PASS: 3D paths absent from customer/contractor navigation; PDF import retained');
console.log('5 smoke test groups passed. Full application build/browser E2E require npm dependencies.');
