// Deterministic lifecycle checks of the exact object adapter. No model/network.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const source=fs.readFileSync('index.html','utf8');
const code=source.slice(source.indexOf('function createObjectAdapter('),source.indexOf('// MediaPipe Tasks 0.10.21 requires'));
const checks=[];
async function scenario({graphics=true,hash='hash',pending=false}={}) {
  let closed=0,downloads=0,release,options,called=0,frameClosed=0;
  const waiting=new Promise(r=>release=r),messages=[];
  const task={close(){closed++;},detectForVideo(frame,time){called++;return {detections:[]};}};
  const vision={FilesetResolver:{forVisionTasks:async()=>({})},ObjectDetector:{createFromOptions:async(files,opts)=>{options=opts;if(pending)await waiting;return task;}}};
  const context=vm.createContext({injectedVision:vision,sha256Hex:()=>hash});
  vm.runInContext(code.replace('await import(m.assets.library)','await Promise.resolve(injectedVision)'),context);
  const adapter=context.createObjectAdapter({document:{createElement:()=>({getContext:()=>graphics?{}:null})},AbortController,
    fetch:async()=>{downloads++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(0)};},performance:{now:()=>10}});
  adapter.onmessage=event=>messages.push(event.data);
  adapter.postMessage({type:'load',assets:{sha256:'hash'}});
  await new Promise(r=>setImmediate(r));
  return {adapter,messages,release,stats:()=>({closed,downloads,options,called,frameClosed}),frame:()=>({close(){frameClosed++;}})};
}
const blocked=await scenario({graphics:false});
checks.push({name:'missing graphics fails before download',passed:blocked.stats().downloads===0&&blocked.messages[0]?.type==='error'});
const mismatch=await scenario({hash:'wrong'});
checks.push({name:'integrity mismatch refuses model creation',passed:!mismatch.stats().options&&mismatch.messages[0]?.message.includes('integrity')});
const cancelled=await scenario({pending:true});cancelled.adapter.terminate();cancelled.release();await new Promise(r=>setImmediate(r));
checks.push({name:'late-created task closes after cancellation and never becomes ready',passed:cancelled.stats().closed===1&&cancelled.messages.length===0});
const ready=await scenario();ready.adapter.postMessage({type:'frame',frame:ready.frame(),timeMs:100});await new Promise(r=>setImmediate(r));
checks.push({name:'video task uses CPU and exact frame timestamp',passed:ready.stats().options.runningMode==='VIDEO'&&ready.stats().options.baseOptions.delegate==='CPU'&&ready.messages[1]?.timeMs===100});
checks.push({name:'inference executes once and releases its frame',passed:ready.stats().called===1&&ready.stats().frameClosed===1});
ready.adapter.postMessage({type:'frame',frame:ready.frame(),timeMs:200});ready.adapter.terminate();await new Promise(r=>setImmediate(r));
checks.push({name:'cancelled queued frame closes without inference',passed:ready.stats().called===1&&ready.stats().frameClosed===2&&ready.stats().closed===1});
const evidence={runtime:process.version,mode:'synthetic injected runtime; no real model',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,checks};
console.log(JSON.stringify(evidence,null,2));process.exitCode=evidence.failed?1:0;
