# Stage 7 — Re-identification (Tier 2)

## Tests

43 new deterministic assertions. The core, controller and binding tests were executed red before their corresponding implementations. A later integration regression was executed red before fixing freshness handling. Complete new test code:

```js
function registerStage7Tests(T) {
  const sample=(id,embedding=[1,0,0],extra={})=>({id,label:"bottle",embedding,
    timeMs:0,session:1,source:"synthetic",revision:"fixture-v1",...extra});
  T.suite("Re-ID: single-flight worker lifetime",()=>{
    const workers=[],results=[];let status="";
    const make=()=>{const w={messages:[],postMessage(m){this.messages.push(m);},terminate(){this.stopped=true;}};workers.push(w);return w;};
    const controller=createEmbeddingController({createWorker:make,onResult:r=>results.push(r),onStatus:s=>status=s});
    T.eq(controller.submit({},{}),false,"unloaded embeddings reject crops");
    controller.start();const worker=workers[0];
    T.eq(status,"loading","model loading is explicit");
    worker.onmessage({data:{type:"ready"}});
    T.eq(controller.submit({data:new Uint8Array(4),width:1,height:1},{id:"a"}),true,"ready worker accepts one crop");
    T.eq(controller.submit({},{}),false,"busy worker drops work instead of queueing");
    worker.onmessage({data:{type:"result",embedding:[1,0],cpuMs:10}});
    T.eq(results[0].metadata.id,"a","result stays bound to submitted anchor");
    T.eq(controller.submit({data:new Uint8Array(4),width:1,height:1},{id:"b"}),true,"next anchor may run after completion");
    controller.stop();worker.onmessage({data:{type:"result",embedding:[1,0],cpuMs:10}});
    T.eq(results.length,1,"late result cannot restore a stopped session");
    T.eq(worker.stopped,true,"stop terminates model worker");
    controller.start();worker.onmessage({data:{type:"error",message:"old failure"}});
    T.eq(status,"loading","old failure cannot poison new worker");
    workers[1].onerror({message:"load failed"});
    T.eq(status,"error: load failed","current failure is visible");
    T.eq(workers[1].stopped,true,"failed worker releases models");
  });
  T.suite("Re-ID: apply only to current anchors",()=>{
    const box={leftDeg:0,topDeg:2,widthDeg:2,heightDeg:2};
    const tracked=Core.trackObjects(Core.createTracker(),{timeMs:2000,session:1,source:"synthetic",
      detections:[{boxDeg:box,label:"bottle",confidence:.8,source:"synthetic"}]});
    const meta={id:tracked.tracks[0].id,label:"bottle",session:1,source:"synthetic",timeMs:2000,revision:"fixture-v1"};
    const memory=Core.reidentify([],sample("departed"),[]).memory;
    const result={metadata:meta,embedding:[1,0,0]};
    const bound=Core.bindEmbedding(memory,tracked,result,2100);
    T.eq(bound.tracker.tracks[0].id,"departed","real result rebinds the tracker identity");
    T.eq(bound.tracker.nextId,tracked.nextId,"rebind preserves monotonic allocation");
    const newerMemory=[...memory,{...memory[0],id:"other",label:"chair",timeMs:2050}];
    T.true(Core.bindEmbedding(newerMemory,tracked,result,2100).memory.some(m=>m.id==="other"),
      "in-flight embedding cannot erase more recent memory");
    T.eq(bound.tracker.tracks[0].reidentification.confidence,1,"anchor exposes re-ID confidence");
    for(const r of [{...result,metadata:{...meta,session:2}},{...result,metadata:{...meta,label:"chair"}},
      {...result,metadata:{...meta,source:"camera"}},{...result,metadata:{...meta,id:"gone"}}])
      T.eq(Core.bindEmbedding(memory,tracked,r,2100).tracker,tracked,"stale or rebound result is discarded");
    T.eq(Core.bindEmbedding(memory,tracked,result,4000).tracker,tracked,"late computation cannot revive a stale crop");
    T.eq(Core.bindEmbedding(memory,tracked,result,1900).tracker,tracked,"future crop cannot bind");
  });
  T.suite("Re-ID: cosine and invalid evidence",()=>{
    T.eq(Core.cosineSimilarity([1,0],[2,0]),1,"cosine is magnitude invariant");
    T.eq(Core.cosineSimilarity([1,0],[0,1]),0,"different appearance has zero similarity");
    T.throws(()=>Core.cosineSimilarity([0,0],[1,0]),"zero vector rejected");
    T.throws(()=>Core.cosineSimilarity([1],[1,2]),"dimension mismatch rejected");
    T.throws(()=>Core.cosineSimilarity([NaN,1],[1,0]),"nonfinite embedding rejected");
  });
  T.suite("Re-ID: departure and cautious return",()=>{
    const first=Core.reidentify([],sample("anchor-1"),["anchor-1"]);
    const before=JSON.stringify(first.memory);
    const back=Core.reidentify(first.memory,sample("anchor-2",[0.99,0.01,0],{timeMs:2000}),["anchor-2"]);
    T.eq(back.id,"anchor-1","departed anchor rebinds by appearance");
    T.true(back.confidence>=0&&back.confidence<=1,"every match carries bounded confidence");
    T.eq(back.confidenceKind,"cosine-model","confidence is not a detector probability");
    T.eq(back.tier,null,"synthetic appearance never gains live tier");
    T.eq(JSON.stringify(first.memory),before,"prior memory is immutable");
    T.true(Object.isFrozen(back.memory[0].embedding),"embedding is immutable");
    const other=Core.reidentify(first.memory,sample("anchor-2",[0,1,0],{timeMs:2000}),["anchor-2"]);
    T.eq(other.id,"anchor-2","different object cannot steal identity");
    T.eq(Core.reidentify(first.memory,sample("anchor-2",[1,0,0],{timeMs:2000}),["anchor-1","anchor-2"]).id,"anchor-2","visible identity cannot bind twice");
    T.eq(Core.reidentify(first.memory,sample("anchor-2",[1,0,0],{timeMs:30001}),[]).id,"anchor-2","memory expires after thirty seconds");
    for(const extra of [{session:2},{source:"evaluation"},{revision:"other"},{label:"chair"}])
      T.eq(Core.reidentify(first.memory,sample("anchor-2",[1,0,0],{timeMs:2000,...extra}),[]).id,"anchor-2","incompatible evidence cannot match: "+JSON.stringify(extra));
    const twins=[...first.memory,{...first.memory[0],id:"twin"}];
    T.eq(Core.reidentify(twins,sample("anchor-2",[1,0,0],{timeMs:2000}),[]).reason,"ambiguous","similar candidates abstain");
    T.eq(Core.reidentify([],sample("person-1",[1,0,0],{label:"person"}),[]).memory.length,0,"people excluded from appearance memory");
    T.throws(()=>Core.reidentify(first.memory,sample("anchor-2",[1,0,0],{timeMs:-1}),[]),"invalid time rejected");
    const live=Core.reidentify([],sample("a",[1,0,0],{source:"camera"}),["a"]);
    T.eq(Core.reidentify(live.memory,sample("b",[1,0,0],{source:"camera",timeMs:2000}),["b"]).tier,2,"camera re-ID remains inferred Tier 2");
  });
}

```

## Implementation

Exact app diff: [stage-07.patch](stage-07.patch), against `8b20893800ea851aec21db0c0157a2c887272f05`.

- Pure normalized cosine similarity, cautious class-scoped association, departed-anchor rebinding and immutable evidence.
- Model choices fixed before real inference: cosine floor .92, runner-up margin .04, memory 30 seconds / 64 objects, result freshness 1500 ms with a current detector observation no older than 800 ms. Ambiguous candidates abstain and are not enrolled. Already visible IDs cannot be stolen. Session/source/model/label boundaries are enforced.
- A module worker executes the real CLIP vision model via Transformers.js. Single-flight processing drops work while busy; only newly detected non-person object anchors request embeddings. Crops are capped at 224 pixels per axis. All memory and worker resources clear on feed reset, hidden-page reset, explicit clear or model unload; no embedding persistence or remote inference.
- Appearance ID and cosine-model confidence are developer-only. The wearer layers receive no new paint. Tracker geometry remains view-angular; this is not physical world-lock.
- Freshness repair evaluates memory age at result application time while preserving the original crop observation timestamp. A delayed result cannot erase newer records.
- Reconciled the obsolete Stage 5 blocker in state.json against its already-completed main checkpoint. The numbered stage sequence and product brief are unchanged.

### Exact model and runtime audit (2026-09-15)

| Component | Pin / evidence |
| --- | --- |
| Model conversion | `Xenova/clip-vit-base-patch32` at `d15189d7028b43f1d3e65039190477f6af591c2a` |
| Quantization | `onnx/vision_model_quantized.onnx`, q8, 89,117,001 bytes |
| Model SHA-256 | `583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299` |
| Config SHA-256 | `493ef57ff783e42d1530c91b53469b7fdf8db8a9c1408e86998fcb7899a4f495` |
| Processor SHA-256 | `6f638fb9401a6d6296feff533ee7efe657b787c49f954f82f5906b36ef2a1b1f` |
| Browser library | `@huggingface/transformers@3.7.2`, exact jsDelivr web module and dist WASM paths |
| Bundled ONNX web dependency | `1.22.0-dev.20250409-89f8206ba4`, as declared by the exact runtime package |
| Native reference | `onnxruntime@1.22.0`, CPU, one intra/inter-op thread |

Primary sources: [conversion card](https://huggingface.co/Xenova/clip-vit-base-patch32/blob/d15189d7028b43f1d3e65039190477f6af591c2a/README.md) identifies the export as OpenAI CLIP weights; [upstream MIT license](https://github.com/openai/CLIP/blob/main/LICENSE); [upstream model card](https://github.com/openai/CLIP/blob/main/model-card.md); [exact runtime package](https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/package.json) and [runtime license](https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/LICENSE); [exact model class implementation](https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/src/models.js); [cache implementation](https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/src/utils/hub.js).

License basis: upstream CLIP MIT and Transformers.js Apache-2.0. The conversion card identifies its upstream and does not list a separate license grant or restriction; no claim of an independent conversion-license certification is made. This is an experimental object-appearance feature, not a validated deployment or person recognition system. CLIP semantic similarity cannot establish ownership, smart-object state or unique instance identity.

Model and config bytes are hash-verified before creation and supplied through an in-memory custom cache. Browser and filesystem persistent caches are disabled; unknown model/config files return 404. No tokenization or text model is needed. Runtime module/auxiliary WASM are exact-version pinned; initial GET downloads require network and HTTP caching does not guarantee offline use. Workers are terminated to release their heaps; peak heap and browser throughput remain unmeasured.

## Test results

Entire application: **418 passed / 0 failed**. Existing independent regression: **22 / 0**. Injected embedding worker: **7 / 0**. Actual model discrimination checks: **6 / 0**. Exact tracker departure/re-entry replay using those model outputs: **24 / 0**. Final failures: none.

App SHA-256: `88c8e4eab7f6334d68b3dac3360a459ce9cf20ab3a929a4a10ae06abbd14d3c1`.


Red results, with complete failures:

```json
red: 375 passed / 2 failed
[
  {
    "suite": "Re-ID: cosine and invalid evidence",
    "passed": false,
    "message": "Suite threw unexpectedly",
    "expected": "no unexpected exception",
    "actual": "TypeError: Core.cosineSimilarity is not a function"
  },
  {
    "suite": "Re-ID: departure and cautious return",
    "passed": false,
    "message": "Suite threw unexpectedly",
    "expected": "no unexpected exception",
    "actual": "TypeError: Core.reidentify is not a function"
  }
]

worker-red: 397 passed / 1 failed
[
  {
    "suite": "Re-ID: single-flight worker lifetime",
    "passed": false,
    "message": "Suite threw unexpectedly",
    "expected": "no unexpected exception",
    "actual": "ReferenceError: createEmbeddingController is not defined"
  }
]

binding-red: 408 passed / 1 failed
[
  {
    "suite": "Re-ID: apply only to current anchors",
    "passed": false,
    "message": "Suite threw unexpectedly",
    "expected": "no unexpected exception",
    "actual": "TypeError: Core.bindEmbedding is not a function"
  }
]

freshness-red: 417 passed / 1 failed
[
  {
    "suite": "Re-ID: apply only to current anchors",
    "passed": false,
    "message": "in-flight embedding cannot erase more recent memory",
    "expected": true,
    "actual": false
  }
]
```

Commands from repository root:

```sh
node tests/run.mjs
node .github/peripheral/reports/stage-07-worker-test.mjs
node .github/peripheral/reports/stage-07-gate.mjs
```

The gate consumes recorded actual model vectors, not fabricated embeddings. To rerun inference, install `onnxruntime==1.22.0`, NumPy and Pillow in an isolated evaluation environment, download the exact model URL below into `<scratch>/onnx/vision_model_quantized.onnx`, then run:

```sh
python .github/peripheral/reports/stage-07-model-eval.py <scratch>
node .github/peripheral/reports/stage-07-gate.mjs
```

[Exact model artifact](https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/d15189d7028b43f1d3e65039190477f6af591c2a/onnx/vision_model_quantized.onnx). The script verifies its hash and downloads/verifies six licensed fixture photographs. These are evaluation-only files, never product frame uploads or a product backend. Fixture sources, CC BY 2.0 attribution, hashes, all 512-dimensional outputs and timing samples are in `stage-07-model-run.json`; the selection is all Chair and Bottle examples in the existing Stage 5 fixture set.

The native check fixed six brightness-only revisits (0.9 brightness), same-class distractors and thresholds before inference. All passed: revisit cosine .9874–.9944; nearest other .6894–.7819. Native initialization 516.09 ms; one warm-up; twelve measured inferences, median 36.24 ms, maximum/nearest-rank p95 149.19 ms. No throughput threshold or browser equivalence is inferred from these timings. This small transformed-image check does not validate novel viewpoints, large appearance changes, indistinguishable objects or a population-level false-match rate.

Browser attempted the local preview and returned `net::ERR_BLOCKED_BY_CLIENT`; no bypass or fabricated browser pass. Model loading in a browser, sustained FPS, memory, mobile/camera operation and wearable hardware remain unverified. The 7 worker checks use injected dependencies and validate adapter behavior only. No OpenCV runtime was introduced.

## Perception tiers touched

Camera-path re-ID is Tier 2 inference with explicitly modeled cosine confidence. Evaluation photographs and synthetic vectors remain untiered. No Tier 1 live result is claimed; no Tier 3 entity state added.

## Gate

Passed the software departure/re-entry gate using actual pretrained image embeddings and the exact application tracker; live/browser/hardware checks remain unverified.

## Commit

`feat(perception): embedding-based re-identification`

The commit containing this report is the Stage 7 checkpoint. Nathan remains project lead and primary contributor through verified Git metadata. AI assistance was used for implementation, tests and documentation; upstream and fixture attribution is preserved. Existing license and history are unchanged.

## Next

Stage 8 — Depth and surface estimation. Do not treat current angular anchors or appearance matches as measured world surfaces.
