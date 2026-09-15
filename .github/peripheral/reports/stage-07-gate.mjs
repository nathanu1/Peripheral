// Replays actual pretrained embeddings through the exact application tracker.
// No live input, browser performance or multi-view quality claim.
import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8'),ctx=vm.createContext({});
vm.runInContext(html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)[1],ctx);
const C=ctx.Peripheral.Core,run=JSON.parse(fs.readFileSync('.github/peripheral/reports/stage-07-model-run.json'));
const checks=[];const check=(name,passed)=>checks.push({name,passed:!!passed});
for(const record of run.records){
 const label=record.fixture.className.toLowerCase(),observation={label,confidence:.8,source:'evaluation',boxDeg:{leftDeg:0,topDeg:2,widthDeg:2,heightDeg:2}};
 let tracker=C.trackObjects(C.createTracker(),{timeMs:0,session:1,source:'evaluation',detections:[observation]});
 const id=tracker.tracks[0].id;
 let memory=C.reidentify([],{id,label,embedding:record.original,timeMs:0,session:1,source:'evaluation',revision:run.modelRevision},[id]).memory;
 for(const other of run.records.filter(r=>r!==record&&r.fixture.className===record.fixture.className))
   memory=C.reidentify(memory,{id:other.fixture.id,label,embedding:other.original,timeMs:0,session:1,source:'evaluation',revision:run.modelRevision},memory.map(m=>m.id)).memory;
 tracker=C.trackObjects(tracker,{timeMs:901,session:1,source:'evaluation',detections:[]});
 check(record.fixture.id+' leaves view',tracker.tracks.length===0);
 tracker=C.trackObjects(tracker,{timeMs:2000,session:1,source:'evaluation',detections:[observation]});
 check(record.fixture.id+' enters with new tracker ID',tracker.tracks[0].id!==id);
 const bound=C.bindEmbedding(memory,tracker,{embedding:record.revisit,metadata:{id:tracker.tracks[0].id,label,timeMs:2000,session:1,source:'evaluation',revision:run.modelRevision}},2100);
 check(record.fixture.id+' restores departed identity',bound.tracker.tracks[0].id===id&&bound.outcome.reason==='matched');
 check(record.fixture.id+' honest score and provenance',bound.outcome.tier===null&&bound.outcome.confidence>=.92&&bound.outcome.confidence<=1);
}
const result={mode:'actual native model vectors; deterministic departure/re-entry',passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,checks};
console.log(JSON.stringify(result,null,2));process.exitCode=result.failed?1:0;
