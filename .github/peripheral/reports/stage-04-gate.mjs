// Stage 4 gate: the dwell machine is pure and its progress is absent from the wearer view.
import { readFileSync, writeFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { createHash } from 'node:crypto';

const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
const checks = [];
function check(name, fn) {
  try { fn(); checks.push({ name, passed: true }); }
  catch (error) { checks.push({ name, passed: false, actual: String(error) }); }
}
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
let context;
check('Exact inline application initializes for synthetic dwell traces', () => {
  if (scripts.length !== 1) throw Error(`Expected one script, found ${scripts.length}`);
  context = createContext({});
  new Script(scripts[0][1], { filename: 'index.html:inline' }).runInContext(context, { timeout: 3000 });
});
check('Dwell constants are explicit model choices', () => {
  const value = new Script(`({threshold:Peripheral.CONSTANTS.dwellThresholdMs,
    tolerance:Peripheral.CONSTANTS.dwellToleranceDeg,
    refractory:Peripheral.CONSTANTS.dwellRefractoryMs})`).runInContext(context);
  if (value.threshold.value !== 1500 || value.threshold.kind !== 'model') throw Error('Threshold is not 1500 ms [model]');
  if (value.tolerance.kind !== 'model' || value.refractory.kind !== 'model') throw Error('Unlabeled dwell constant');
});
check('Pure synthetic 1.5 second trace emits exactly one dwell event', () => {
  const value = new Script(`(()=>{let state=Peripheral.Core.createDwellState(),events=[];
    for(const timeMs of [0,250,500,750,1000,1250,1500,1750]) {
      const step=Peripheral.Core.stepDwell(state,{timeMs,anchorId:'gate-anchor',available:true,
        directionDeg:{xDeg:0,yDeg:0},targetDirectionDeg:{xDeg:0,yDeg:0}});
      state=step.state;if(step.event)events.push(step.event);
    } return events;})()`).runInContext(context);
  if (value.length !== 1 || value[0].warrant !== 'dwell' || value[0].anchorId !== 'gate-anchor') throw Error(JSON.stringify(value));
});
check('Dwell implementation has no browser, clock, network, or storage dependency', () => {
  const start=html.indexOf('  createDwellState()');
  const end=html.indexOf('  gazeGauge(',start);
  if(start<0||end<=start) throw Error('Dwell source boundary missing');
  const source=html.slice(start,end).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g,' ');
  const found=source.match(/\b(document|window|globalThis|navigator|fetch|localStorage|sessionStorage|indexedDB|Date|performance|setTimeout|requestAnimationFrame)\b/g);
  if(found) throw Error(`Forbidden references: ${found.join(', ')}`);
});
check('Wearer view contains no dwell progress element', () => {
  const start=html.indexOf('<div id="wearer-view"');
  const end=html.indexOf('<details id="debug-drawer"');
  const wearer=html.slice(start,end);
  if(!wearer || /dwell|progress|meter/i.test(wearer)) throw Error('Wearer view exposes dwell progress');
});

const result={runtime:process.version,sourceSha256:createHash('sha256').update(html).digest('hex'),
  passed:checks.filter(item=>item.passed).length,failed:checks.filter(item=>!item.passed).length,checks};
console.log(JSON.stringify(result,null,2));
if(process.argv[2]) writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
process.exitCode=result.failed?1:0;
