// Independently replays the committed Stage 5 evidence through the exact app core.
// It verifies files only; it performs no camera, network, or model inference.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const [manifestPath,runPath,modelPath,outputPath] = process.argv.slice(2);
if(!manifestPath||!runPath||!modelPath) {
  throw new Error('Usage: node stage-05-offline-gate.mjs MANIFEST RUN MODEL [OUTPUT]');
}
const readJson=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const manifestText=fs.readFileSync(manifestPath,'utf8');
const runText=fs.readFileSync(runPath,'utf8');
const manifest=JSON.parse(manifestText),run=JSON.parse(runText);
const html=fs.readFileSync('index.html','utf8');
const scriptMatches=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
if(scriptMatches.length!==1) throw new Error('Expected exactly one inline application script');

const coreInput={provenance:run.provenance,model:run.model,fixtures:run.fixtures,results:run.results};
const context=vm.createContext({coreInput});
new vm.Script(scriptMatches[0][1],{filename:'index.html:inline'}).runInContext(context,{timeout:5000});
const coreEvidence=new vm.Script('Peripheral.Core.objectEvaluationEvidence(coreInput)')
  .runInContext(context,{timeout:1000});

const checks=[];
const check=(name,passed,actual,expected)=>checks.push({name,passed:passed===true,actual,expected});
check('run schema',run.schema==='peripheral.stage5.offline-run.v1',run.schema,'peripheral.stage5.offline-run.v1');
const modelHash=digest(fs.readFileSync(modelPath));
check('model artifact hash',modelHash===run.model.sha256,modelHash,run.model.sha256);
check('manifest schema',manifest.schema==='peripheral.stage5.fixtures.v1',manifest.schema,'peripheral.stage5.fixtures.v1');

const manifestById=new Map(manifest.fixtures.map(fixture=>[fixture.id,fixture]));
const runById=new Map(run.fixtures.map(fixture=>[fixture.id,fixture]));
const sameFixtureSet=manifest.fixtures.length===run.fixtures.length&&
  manifestById.size===manifest.fixtures.length&&runById.size===run.fixtures.length&&
  manifest.fixtures.every(fixture=>{
    const observed=runById.get(fixture.id);
    return observed&&['className','sourceUrl','license','author','sha256']
      .every(key=>observed[key]===fixture[key]);
  });
check('manifest and run fixtures match',sameFixtureSet,run.fixtures.length,manifest.fixtures.length);

const perFixtureById=new Map(run.perFixture.map(fixture=>[fixture.id,fixture]));
const linksComplete=run.fixtures.every(fixture=>{
  const result=perFixtureById.get(fixture.id);
  return result&&result.imageSha256===fixture.sha256&&result.expectedClass===fixture.className;
});
check('per-image hashes and labels link to fixtures',linksComplete,perFixtureById.size,run.fixtures.length);

const observations=run.perFixture.flatMap(fixture=>fixture.detections);
const untiered=observations.every(observation=>observation.source==='evaluation'&&observation.tier===null);
check('all observations are untiered evaluation data',untiered,
  observations.filter(observation=>observation.tier!==null||observation.source!=='evaluation').length,0);

const latency=run.perFixture.map(fixture=>fixture.inferenceMs).sort((a,b)=>a-b);
const median=latency.length%2?latency[(latency.length-1)/2]:
  (latency[latency.length/2-1]+latency[latency.length/2])/2;
const p95=latency[Math.max(0,Math.ceil(latency.length*0.95)-1)];
const recomputed={
  imagesProcessed:run.perFixture.length,
  imagesWithExpectedDetection:run.perFixture.filter(fixture=>fixture.expectedLabelDetected).length,
  expectedBoxes:run.fixtures.length,
  matchedAtIou50:run.perFixture.filter(fixture=>fixture.maxExpectedLabelIou>=0.5).length,
  invalidBoxes:run.perFixture.reduce((sum,fixture)=>sum+fixture.invalidDetectionCount,0),
  liveTier1Count:observations.filter(observation=>observation.tier===1).length
};
const aggregateKeys=Object.keys(recomputed);
check('aggregate counts recompute from per-image records',
  aggregateKeys.every(key=>run.results[key]===recomputed[key]),recomputed,
  Object.fromEntries(aggregateKeys.map(key=>[key,run.results[key]])));
check('latency statistics recompute from per-image records',
  Math.abs(run.results.medianInferenceMs-median)<=0.0001&&Math.abs(run.results.p95InferenceMs-p95)<=0.0001,
  {medianInferenceMs:median,p95InferenceMs:p95},
  {medianInferenceMs:run.results.medianInferenceMs,p95InferenceMs:run.results.p95InferenceMs});
check('exact app core accepts the offline gate',coreEvidence.gate.status==='passed',
  coreEvidence.gate.status,'passed');

const failed=checks.filter(item=>!item.passed).length;
const evidence={
  runtime:process.version,
  mode:'committed prerecorded-image evidence replay; no camera or inference',
  sourceSha256:digest(html),
  manifestSha256:digest(manifestText),
  runSha256:digest(runText),
  modelSha256:modelHash,
  passed:checks.length-failed,
  failed,
  checks,
  coreGate:coreEvidence.gate
};
const rendered=JSON.stringify(evidence,null,2)+'\n';
console.log(rendered);
if(outputPath) fs.writeFileSync(outputPath,rendered);
process.exitCode=failed?1:0;
