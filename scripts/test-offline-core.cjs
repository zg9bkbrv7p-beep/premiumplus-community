// Independent offline smoke tests for source-level contractor workflows.
// Uses TypeScript (installed by npm ci, or an optional global installation)
// and Sharp (likewise) without starting a server or connecting to customer data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
function loadPackage(name) {
  for (const attempt of [() => require(name), () => require(require.resolve(name, {paths:[process.env.NODE_PATH || '', '/opt/nvm/versions/node/v22.16.0/lib/node_modules']}))]) {
    try { return attempt(); } catch (_) { /* next resolution path */ }
  }
  throw Error(`Required package ${name} not found. Install dependencies before running tests.`);
}
const ts = loadPackage('typescript');
const sharp = loadPackage('sharp');
// NOTE: This stub only allows testing pure geometry/colour functions in the
// presence of an unavailable zod dependency; it DOES NOT test Zod validators.
const noValidation = new Proxy(function() {}, {
  get: (_, key) => key === 'parse' ? x => x : noValidation,
  apply: () => noValidation,
});
const mockZod = { z: noValidation };
function loadTS(relative) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, 'utf8');
  const js = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop:true },
    reportDiagnostics: true,
  });
  const errs = (js.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errs.length, 0, `${relative} TypeScript parse errors`);
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  const baseRequire = mod.require.bind(mod);
  mod.require = id => {
    if (id === 'zod') return mockZod;
    if (id === 'sharp') return sharp;
    if (id.startsWith('.')) {
      // Only first-party modules needed by these tests; no network calls.
      const next = path.resolve(path.dirname(file), id);
      if (fs.existsSync(next + '.ts')) return loadTS(path.relative(root, next + '.ts'));
    }
    return baseRequire(id);
  };
  mod._compile(js.outputText, file);
  return mod.exports;
}
const units = loadTS('shared/units.ts');
const category = loadTS('shared/documentCategory.ts');
const editing = loadTS('shared/editing.ts');
const wall = loadTS('shared/fusionWall.ts');
const remodel = loadTS('shared/remodel.ts');
const color = loadTS('server/remodel/color-study.ts');
const readiness = loadTS('shared/proposalReadiness.ts');
const approx = (actual, expected, delta=1e-6) => assert.ok(Math.abs(actual - expected) < delta, `${actual} != ${expected}`);
const rectangle = {walls:[{id:'a',a:{x:0,y:0},b:{x:2,y:0},height:2.6,thickness:.15,color:'#ffffff'},
  {id:'b',a:{x:2,y:0},b:{x:2,y:2},height:2.6,thickness:.15,color:'#ffffff'}],
  openings:[],furniture:[],floorColor:'#eeeeee',version:1};

test('imperial parse, format, and grid snap', () => {
  approx(units.parseImperial('6 ft 4 in'), 76 * 0.0254);
  approx(units.parseImperial('6\' 4"'), 76 * 0.0254);
  approx(units.parseImperial('-6"'), -6 * .0254);
  assert.equal(units.parseImperial('abc'), null);
  assert.equal(units.formatImperial(.3048), '1′ 0″');
  approx(units.snapToGrid(.028, 'inch'), .0254);
});
test('private document category resolution', () => {
  assert.equal(category.documentCategory('image/jpeg'), 'photo');
  assert.equal(category.documentCategory('application/pdf', 'photo'), 'document');
  assert.equal(category.documentCategory('application/pdf', 'warranty'), 'warranty');
});
test('dimensioned wall is immutable, correctly scaled and rejects bad inputs', () => {
  const draft={lengthFeet:10,heightFeet:8,thicknessInches:4,color:'#aabbcc'};
  const original=structuredClone(rectangle);
  const next=wall.appendDimensionedWall(rectangle,draft,'new-wall');
  assert.deepEqual(rectangle, original);
  assert.equal(next.walls.length,3);
  approx(next.walls[2].b.x-next.walls[2].a.x,3.048);
  approx(next.walls[2].height,2.4384);
  approx(next.walls[2].thickness,.1016);
  assert.throws(()=>wall.appendDimensionedWall(rectangle,draft,'a'),/unique identifier/);
  assert.throws(()=>wall.appendDimensionedWall(rectangle,{...draft,thicknessInches:-1},'new'),/limits/);
});
test('endpoint editing adjusts connected walls but leaves original intact', () => {
  const orig=structuredClone(rectangle);
  const changed=editing.moveEndpoint(rectangle,'a','b',{x:3,y:1});
  assert.deepEqual(rectangle,orig);
  assert.deepEqual(changed.walls[0].b,{x:3,y:1});
  assert.deepEqual(changed.walls[1].a,{x:3,y:1});
  assert.deepEqual(changed.walls[1].b,{x:2,y:2});
});
test('marked area calculations keep untouched pixels outside selection', async () => {
  const source=await sharp({create:{width:10,height:10,channels:3,background:{r:80,g:80,b:80}}}).png().toBuffer();
  const region=[{x:.2,y:.2},{x:.8,y:.2},{x:.8,y:.8},{x:.2,y:.8}];
  assert.equal(remodel.validRegion(region),true);
  assert.equal(remodel.insideRegion(.5,.5,region),true);
  assert.equal(remodel.insideRegion(.05,.05,region),false);
  const result=await color.applyFinishColor(source,region,'cedar');
  const s=await sharp(source).raw().toBuffer();
  const {data:out,info}=await sharp(result).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,10);assert.equal(info.height,10);
  for(const [x,y] of [[0,0],[9,9],[1,7]]){
    const p=(y*10+x)*3;assert.deepEqual([...out.subarray(p,p+3)],[...s.subarray(p,p+3)]);
  }
  const insideIndex=(5*10+5)*3;
  assert.notDeepEqual([...out.subarray(insideIndex,insideIndex+3)],[...s.subarray(insideIndex,insideIndex+3)]);
  assert.equal(out[insideIndex]>out[insideIndex+2],true,'cedar tint should have stronger red channel');
  // This local finish study does not send data to any external provider.
});


test('incomplete proposal produces actionable missing-field issues', () => {
  const issues=readiness.proposalReadiness({items:[],options:[],customerName:'',customerContact:'',scope:'',pricingReviewed:false},'');
  const keys=issues.map(x=>x.key);
  assert.deepEqual(keys,['customerName','customerContact','address','scope','pricing']);
  assert.ok(issues.every(x=>typeof x.message==='string' && x.message.length>10));
  const valid={customerName:'Example Owner',customerContact:'owner@example.test',scope:'Install cedar fencing with concrete set posts and final cleanup.',items:[{id:'f',label:'Fence work',quantity:1,price:10000}],options:[],pricingReviewed:true};
  assert.deepEqual(readiness.proposalReadiness(valid,'123 Sample St, Example City, TX'),[]);
});
test('invalid cross-connected marked polygon is rejected',()=> {
  const crossing=[{x:.1,y:.1},{x:.9,y:.9},{x:.1,y:.9},{x:.9,y:.1}];
  assert.equal(remodel.validRegion(crossing),false);
  const tooSmall=[{x:.1,y:.1},{x:.11,y:.1},{x:.11,y:.11},{x:.1,y:.11}];
  assert.equal(remodel.validRegion(tooSmall),false);
});
