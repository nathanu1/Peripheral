// Exact worker body with injected model/runtime; never a real-model quality claim.
import fs from 'node:fs';import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8');
const source=html.slice(html.indexOf('function embeddingWorkerMain()'),html.indexOf('function createEmbeddingWorker('));
const checks=[];
async function scenario(hash='ok'){
 const messages=[],options=[],downloads=[],env={backends:{onnx:{wasm:{}}}};let modelCalls=0,raw;
 const lib={env,AutoProcessor:{from_pretrained:async(name,opts)=>{options.push(opts);return async image=>{raw=image;return {pixels:'test'};};}},
 CLIPVisionModelWithProjection:{from_pretrained:async(name,opts)=>{options.push(opts);return async input=>{modelCalls++;return {image_embeds:{data:new Float32Array(512).fill(.5)}};};}},
 RawImage:class{constructor(data,width,height,channels){Object.assign(this,{data,width,height,channels});}}};
 const self={postMessage:m=>messages.push(m)};
 const context=vm.createContext({self,injected:lib,sha256Hex:()=>hash,Response,Uint8Array,performance:{now:()=>10},fetch:async url=>{downloads.push(url);return new Response(new Uint8Array([1]));}});
 vm.runInContext(source.replace('await import(m.assets.library)','await Promise.resolve(injected)')+'\nembeddingWorkerMain();',context);
 await self.onmessage({data:{type:'load',assets:{model:'model',revision:'fixed',wasm:'pinned/',hashes:{'config.json':'ok'}}}});
 return {messages,options,downloads,env,self,stats:()=>({modelCalls,raw})};
}
const bad=await scenario('wrong');
checks.push({name:'integrity failure prevents model creation',passed:bad.messages[0]?.type==='error'&&bad.options.length===0});
const ready=await scenario();
checks.push({name:'all persistent caches disabled',passed:ready.env.useBrowserCache===false&&ready.env.useFSCache===false&&ready.env.allowLocalModels===false});
checks.push({name:'single-thread WASM runtime pinned',passed:ready.env.backends.onnx.wasm.numThreads===1&&ready.env.backends.onnx.wasm.wasmPaths==='pinned/'});
checks.push({name:'vision model uses exact revision and q8',passed:ready.options.length===2&&ready.options.every(o=>o.revision==='fixed'&&o.dtype==='q8'&&o.device==='wasm')});
checks.push({name:'unknown cache asset refuses network fallback',passed:(await ready.env.customCache.match('unexpected')).status===404});
await ready.self.onmessage({data:{type:'embed',crop:{data:new Uint8Array(16),width:2,height:2}}});
checks.push({name:'crop reaches processor and real adapter calls model',passed:ready.stats().modelCalls===1&&ready.stats().raw.channels===4&&ready.messages.at(-1).embedding.length===512});
await ready.self.onmessage({data:{type:'embed',crop:{data:new Uint8Array(4),width:225,height:1}}});
checks.push({name:'oversize or incomplete pixels rejected',passed:ready.messages.at(-1).type==='error'&&ready.stats().modelCalls===1});
console.log(JSON.stringify({mode:'injected worker dependencies; no actual model',passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,checks},null,2));
process.exitCode=checks.some(c=>!c.passed)?1:0;
