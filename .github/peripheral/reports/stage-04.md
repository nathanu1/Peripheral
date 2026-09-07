# Stage 4 — Dwell state machine

## Tests — new assertions as code

These tests were added and executed before the constants or state-machine functions existed:

```js
function registerStage4Tests(T) {
  const observation=(timeMs,anchorId,xDeg=0,yDeg=0,targetXDeg=0,targetYDeg=0,available=true)=>({
    timeMs,anchorId,available,directionDeg:{xDeg,yDeg},targetDirectionDeg:{xDeg:targetXDeg,yDeg:targetYDeg}
  });
  const run=points=>{
    let state=Core.createDwellState(),events=[];
    for(const point of points) {
      const step=Core.stepDwell(state,point);
      state=step.state;
      if(step.event) events.push(step.event);
    }
    return {state,events};
  };
  T.suite("Dwell: model constants and initial state",()=>{
    T.eq(CONSTANTS.dwellThresholdMs.value,1500,"threshold is the specified 1.5 seconds");
    T.eq(CONSTANTS.dwellThresholdMs.kind,"model","threshold is labeled as a design choice");
    T.true(CONSTANTS.dwellToleranceDeg.value>0,"jitter tolerance is positive");
    T.true(CONSTANTS.dwellRefractoryMs.value>0,"refractory duration is positive");
    const first=Core.createDwellState(),second=Core.createDwellState();
    T.eq(first.phase,"idle","dwell begins idle");
    T.eq(first.progressMs,0,"dwell begins with no accumulated time");
    T.true(first.refractory!==second.refractory,"dwell states do not share refractory collections");
  });
  T.suite("Dwell: steady and jittery traces",()=>{
    const steady=run([0,250,500,750,1000,1250,1500,1750].map(t=>observation(t,"mug")));
    T.eq(steady.events.length,1,"steady 1.5 second trace fires once");
    T.eq(steady.events[0].warrant,"dwell","event carries the dwell warrant");
    T.eq(steady.events[0].anchorId,"mug","event remains bound to its anchor");
    T.eq(steady.events[0].timeMs,1500,"event fires at the threshold");
    const jitter=[[0,0],[250,.7],[500,-.8],[750,1.2],[1000,-1.1],[1250,.4],[1500,0]].map(([t,x])=>observation(t,"book",x,.3));
    const jittered=run(jitter);
    T.eq(jittered.events.length,1,"jitter inside the cone does not reset dwell");
    T.eq(jittered.events[0].anchorId,"book","jitter cannot change anchor identity");
  });
  T.suite("Dwell: excursion decay and interruption",()=>{
    let state=Core.createDwellState();
    for(const point of [observation(0,"mug"),observation(500,"mug"),observation(700,"mug",3)]) state=Core.stepDwell(state,point).state;
    T.true(state.progressMs>0,"brief excursion decays instead of zeroing progress");
    T.true(state.progressMs<500,"excursion removes accumulated progress");
    const resumed=Core.stepDwell(state,observation(800,"mug",.5));
    T.true(resumed.state.progressMs>state.progressMs,"returning inside the cone resumes progress");
    const lost=Core.stepDwell(resumed.state,observation(900,"mug",0,0,0,0,false));
    T.eq(lost.state.phase,"idle","lost gaze cancels dwell");
    T.eq(lost.state.progressMs,0,"lost gaze clears progress");
    const gap=run([observation(0,"mug"),observation(500,"mug"),observation(1100,"mug")]);
    T.eq(gap.state.progressMs,0,"an observation gap starts a fresh dwell");
    T.eq(gap.events.length,0,"a gap cannot complete dwell");
  });
  T.suite("Dwell: saccade and anchor changes",()=>{
    const saccade=run([observation(0,"mug"),observation(500,"mug"),observation(550,"mug",10)]);
    T.eq(saccade.state.phase,"idle","large fast departure cancels immediately");
    T.eq(saccade.state.progressMs,0,"saccade does not decay gradually");
    const changed=run([observation(0,"mug"),observation(500,"mug"),observation(600,"book"),observation(1100,"book")]);
    T.eq(changed.events.length,0,"progress cannot transfer between anchors");
    T.eq(changed.state.anchorId,"book","new target begins its own dwell");
    T.eq(changed.state.progressMs,500,"new target accumulates only its own time");
  });
  T.suite("Dwell: refractory and time integrity",()=>{
    let state=Core.createDwellState(),events=[];
    for(const t of [0,500,1000,1500,2000,2500]) {
      const step=Core.stepDwell(state,observation(t,"mug"));state=step.state;if(step.event) events.push(step.event);
    }
    T.eq(events.length,1,"same anchor cannot refire during refractory period");
    const other=Core.stepDwell(state,observation(2750,"book"));
    T.eq(other.state.phase,"tracking","another anchor may begin during the first anchor refractory period");
    T.throws(()=>Core.stepDwell(other.state,observation(2700,"book")),"backward time is rejected");
    const before=other.state;
    Core.stepDwell(before,observation(3000,"book"));
    T.eq(before.progressMs,0,"step does not mutate its input state");
    const after=run([0,500,1000,1500,4500,5000,5500,6000].map(t=>observation(t,"mug")));
    T.eq(after.events.length,2,"same anchor may fire after refractory expires and a new dwell completes");
  });
}
```

## Implementation — precise diff

[Stage 4 implementation diff](stage-04.patch) applies against main at `76648fec5bc043e81100d2acb8d3df7c6658a57b`. It adds seven explicitly modeled dwell constants plus pure `Core.createDwellState()` and `Core.stepDwell(state, observation)` functions. State is immutable and serializable. The machine binds progress to one anchor, admits jitter within a two-degree cone, decays brief excursions, cancels large fast departures, rejects backward time, cancels gaps/loss, and keeps a per-anchor refractory list.

No dwell ring, countdown, progress meter, or other wearer-facing element was added. A completed dwell emits only `{warrant:"dwell", anchorId, timeMs}`; rendering and warrant admission remain later stages.

The same checkpoint removes LocateAnything from the planned dependency set and records the OpenCV/context direction requested by Nathan. OpenCV is assigned classical vision work; semantic labels remain the detector's job, and optional text-only context retrieval remains subject to session consent and later policy gates.

## Test results — actual counts and complete failures

- Predecessor baseline: 217 passed / 0 failed; pure-core gate 5/0.
- Red phase: 217 passed / 5 failed. Complete failures:
  - `Dwell: model constants and initial state`: expected `no unexpected exception`; actual `TypeError: Cannot read properties of undefined (reading 'value')`.
  - `Dwell: steady and jittery traces`: expected `no unexpected exception`; actual `TypeError: Core.createDwellState is not a function`.
  - `Dwell: excursion decay and interruption`: expected `no unexpected exception`; actual `TypeError: Core.createDwellState is not a function`.
  - `Dwell: saccade and anchor changes`: expected `no unexpected exception`; actual `TypeError: Core.createDwellState is not a function`.
  - `Dwell: refractory and time integrity`: expected `no unexpected exception`; actual `TypeError: Core.createDwellState is not a function`.
- Final full inline suite: 247 passed / 0 failed in Node v24.19.0.
- Existing pure-core regression: 5/0. Stage-specific gate: 5/0.
- Final deterministic failures: none.

Evidence: [red](stage-04-red.json), [green](stage-04-green.json), [pure-core regression](stage-04-core-gate.json), [stage gate](stage-04-gate.json), and [gate runner](stage-04-gate.mjs).

Run from repository root:

```sh
node tests/run.mjs
node tests/geometry-gate.mjs
node .github/peripheral/reports/stage-04-gate.mjs
```

Final `index.html`: SHA-256 `43580075beeff1fac0ff68c130c6826ffed07d7363939705d013b33bd0be9874`.

## Perception tiers touched

None. Stage 4 consumes synthetic gaze/target directions and emits an interaction event. It adds no Tier 1, Tier 2, or Tier 3 perception and makes no camera, model, browser-performance, or hardware claim.

## Gate

Passed: the state machine is pure, all required synthetic traces pass, and a source audit confirms that dwell progress has no wearer-facing element.

## Commit

`feat(core): dwell detection state machine`. The commit containing this report is the checkpoint and must resolve to @nathanu1. AI assistance produced implementation, tests, source review, and documentation at Nathan's direction; existing and upstream attribution remains preserved.

## Next

Stage 5 — Tier 1 object detection, with real boxes on real frames and measured frame impact. OpenCV packaging is evaluated in Stage 6 for optical flow and stabilization.

