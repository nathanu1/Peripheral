// Exercises the actual inline camera shell with injected pixels, media tracks,
// and a detector-shaped adapter. This is not real-browser or model-quality QA.
import { readFileSync } from 'node:fs';
import { Script, createContext } from 'node:vm';
import { createHash } from 'node:crypto';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
let code=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)][0][1];
code=code.replace('createHarness, createSourceController });','createHarness, createSourceController, mountFramePipeline });')
  .replace('function createObjectAdapter(view) {','function createObjectAdapter(view) { return view.testObjectAdapter();');
const context=createContext({});
new Script(code,{filename:'index.html:camera-shell'}).runInContext(context);
const {mountFramePipeline}=context.Peripheral;
let now=0,serial=0,allowCamera=true,objectsPresent=true,modelAvailable=true;
// Raster-pixel box of the injected cup; the centred variant covers the view centre.
const offCentre={originX:32,originY:36,width:64,height:72},centred={originX:130,originY:60,width:60,height:60};
let detectionBox=offCentre,detectorDelayMs=0,workerFails=false,workersCreated=0,hand=null;
const workerTasks=[];
const raf=new Map(),timers=new Map(),streams=[],requests=[],checks=[],canvasCalls=[];
function check(name,condition){checks.push({name,passed:!!condition});}
class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.events=new Map();this.dataset={};this.style={};this.attributes={};this.value='';this.textContent='';this.hidden=false;this.disabled=false;this.checked=false;this.clientWidth=960;this.clientHeight=540;this.width=320;this.height=180;}
  addEventListener(name,fn){const listeners=this.events.get(name)||[];listeners.push(fn);this.events.set(name,listeners);}
  dispatch(name,event={}){for(const fn of this.events.get(name)||[])fn(event);}
  click(){if(!this.disabled)this.dispatch('click');}
  setAttribute(name,value){this.attributes[name]=String(value);}
  getAttribute(name){return this.attributes[name]??null;}
  append(...items){for(const item of items){this.children.push(item);item.parent=this;}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(item=>item!==this);}
  replaceChildren(...items){this.children=[];this.append(...items);}
  checkValidity(){return true;}
  reportValidity(){}
  get valueAsNumber(){return Number(this.value);}
  getContext(){return {clearRect(){},fillRect(){},strokeRect(){},fillText(){},putImageData(){},
    drawImage:(...args)=>canvasCalls.push({canvas:this,args}),
    getImageData:(x,y,w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)})};}
}
const elements=new Map(),modeButtons=[],labelButtons=[],calibration=[],videos=[];
function mockVideo(e){
  e.readyState=0;e.videoWidth=1280;e.videoHeight=720;e.currentTime=0;e.srcObject=null;
  e.play=()=>{e.readyState=2;return Promise.resolve();};e.pause=()=>{};videos.push(e);return e;
}
for(const match of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)) {
  const element=new Element(match[1]);elements.set(match[3],element);if(match[1]==='video')mockVideo(element);
  const value=match[2].match(/\bvalue="([^"]*)"/);if(value)element.value=value[1];
  for(const dimension of ['width','height']){const value=match[2].match(new RegExp(`\\b${dimension}="(\\d+)"`));if(value)element[dimension]=Number(value[1]);}
  if(match[1]==='select'){const value=html.slice(match.index,html.indexOf('</select>',match.index)).match(/<option value="([^"]+)"/);if(value)element.value=value[1];}
}
for(const mode of ['mirror','world','glasses']){const b=new Element('button');b.dataset.sceneMode=mode;modeButtons.push(b);}
for(const mode of ['off','focus','all']){const b=new Element('button');b.dataset.labelMode=mode;labelButtons.push(b);}
for(let i=0;i<5;i++){const b=new Element('button');b.dataset.point=String(i);calibration.push(b);}
const doc={hidden:false,events:new Map(),
  getElementById(id){if(!elements.has(id))throw new Error('Missing actual HTML element: '+id);return elements.get(id);},
  querySelectorAll(selector){if(selector==='[data-scene-mode]')return modeButtons;if(selector==='[data-point]')return calibration;if(selector==='[data-label-mode]')return labelButtons;throw new Error('Unexpected selector '+selector);},
  createElement(tag){const e=new Element(tag);return tag==='video'?mockVideo(e):e;},
  addEventListener(name,fn){this.events.set(name,fn);}}
const get=id=>doc.getElementById(id);
const view={document:doc,isSecureContext:true,performance:{now:()=>now},
  navigator:{mediaDevices:{async getUserMedia(constraints){
    requests.push(constraints);if(!allowCamera)throw {name:'NotAllowedError'};
    const track={stopped:false,events:new Map(),stop(){this.stopped=true;},addEventListener(name,fn){this.events.set(name,fn);}};
    const stream={track,getTracks:()=>[track],getVideoTracks:()=>[track]};streams.push(stream);return stream;
  }}},
  matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){},removeEventListener(){},
  requestAnimationFrame(fn){const id=++serial;raf.set(id,fn);return id;},cancelAnimationFrame:id=>raf.delete(id),
  setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,time:now+delay});return id;},clearTimeout:id=>timers.delete(id),
  ImageData:class {constructor(data,width,height){Object.assign(this,{data,width,height});}},
  createImageBitmap:async image=>({...image,close(){}}),
  // Detector worker double: same protocol as the page-thread adapter; can fail like a worker without WebGL.
  Worker:function(){workersCreated++;return view.testObjectAdapter(workerFails?'WebGL is unavailable in this worker':null);},
  OffscreenCanvas:class {},Blob:class {},URL:{createObjectURL:()=>'blob:detector',revokeObjectURL(){}},
  testObjectAdapter(loadError=null){let onmessage=()=>{},dead=false,task=null;return {
    set onmessage(fn){onmessage=fn;},set onerror(fn){},terminate(){dead=true;},
    postMessage(message){Promise.resolve().then(()=>{if(dead){message.frame?.close();return;}
      if(message.type==='load')workerTasks.push(message.assets?.task??'page');
      if(message.type==='frame'&&task==='hand'){message.frame.close();
        onmessage({data:{type:'result',timeMs:message.timeMs,cpuMs:3,handCount:hand?1:0,landmarks:hand}});return;}
      if(message.type==='load')task=message.assets?.task;
      if(message.type==='load')onmessage({data:loadError?{type:'error',message:loadError}:modelAvailable?{type:'ready'}:{type:'error',message:'Injected graphics failure'}});
      if(message.type==='frame'){
        const respond=()=>{if(dead){message.frame.close();return;}
          message.frame.close();onmessage({data:{type:'result',timeMs:message.timeMs,cpuMs:4,
            detections:objectsPresent?[{boundingBox:{...detectionBox},categories:[{categoryName:'cup',score:.85}]}]:[]}});};
        if(detectorDelayMs)view.setTimeout(respond,detectorDelayMs);else respond();
      }
    });}
  };}}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function advance(duration){const target=now+duration;while(now<target){now=Math.min(target,now+34);for(const video of videos)video.currentTime=now/1000;
  const pending=[...raf.values()];raf.clear();for(const fn of pending)fn(now);
  for(const [id,timer] of [...timers])if(timer.time<=now){timers.delete(id);timer.fn();}
  await settle();}}
try {
  mountFramePipeline(doc,view);
  check('Startup requests neither camera nor models',requests.length===0&&get('object-status').textContent.includes('unloaded'));
  check('Startup displays the camera welcome',get('camera-welcome').hidden===false);
  get('welcome-start').click();await settle();await advance(240);
  check('Mirror start requests front-camera video without audio',requests[0].video.facingMode.ideal==='user'&&requests[0].audio===false);
  check('Mirror start automatically loads requested object recognition',get('object-status').textContent.includes('Detector ready'));
  check('Detection runs in a worker, off the page thread',workersCreated===1&&get('object-status').textContent.includes('worker'));
  check('Live pixels are presented by the native video element, not repainted per frame',
    get('camera-video').srcObject===streams[0]&&get('wearer-view').dataset.liveVideo==='true'&&
    !canvasCalls.some(c=>c.canvas===get('world-layer')&&c.args[0]===get('camera-video')));
  check('Display fit is explicit for the live stage',get('wearer-view').dataset.fit==='cover');
  await advance(500);
  const marker=()=>get('scene-labels').children[0];
  check('Recognized objects stay quiet: a marker, no revealed details',marker()?.className==='scene-marker'&&
    get('reveal-card').hidden===true&&get('inspection-details').hidden===true);
  check('Mirror video and marker projection share the reflection',get('wearer-view').dataset.mirrored==='true'&&marker()?.style.left==='80%');
  check('Scene reports the actual injected observed class',get('scene-summary').textContent==='1 cup');
  marker().children[0].click();
  check('Tapping a marker reveals evidence-bound details for that object',get('reveal-card').hidden===false&&
    get('reveal-title').textContent==='Cup'&&get('inspection-title').textContent==='Cup'&&get('inspection-details').hidden===false);
  check('The reveal explains its warrant',get('inspection-reason').textContent==='You asked to see it');
  check('The revealed object is framed so the card has a referent',get('reveal-frame').hidden===false&&get('reveal-frame').style.left==='70%');
  check('Displayed model score is not tracking decay',get('inspection-score').textContent.startsWith('0.85'));
  await advance(6100);check('Revealed details expire without dismissal',get('reveal-card').hidden===true&&get('inspection-details').hidden===true);
  marker().children[0].click();doc.events.get('keydown')({key:'Escape'});
  check('Escape dismisses a reveal',get('reveal-card').hidden===true);
  detectionBox=centred;await advance(1200);
  check('A centred object is not revealed before the dwell threshold',get('reveal-card').hidden===true);
  await advance(1400);
  check('Keeping an object centred reveals it with the dwell warrant',get('reveal-card').hidden===false&&
    get('reveal-card').dataset.warrant==='dwell'&&get('inspection-reason').textContent==='You kept it near the centre of the view');
  detectionBox={originX:32,originY:2,width:64,height:176};await advance(1300);
  marker()?.children[0].click();
  const cardTop=get('reveal-card').style.top;
  check('A full-height object keeps its card inside the stage (pixel placement, no off-stage transform)',
    get('reveal-card').hidden===false&&cardTop.endsWith('px')&&parseFloat(cardTop)>=0&&parseFloat(cardTop)<=540-56);
  doc.events.get('keydown')({key:'Escape'});
  detectionBox=offCentre;await advance(1000);
  labelButtons[2].click();await advance(34);labelButtons[1].click();await advance(34);
  check('Switching between Focus and All keeps entity confirmation (no marker flicker)',marker()?.className==='scene-marker');
  labelButtons[2].click();await advance(240);
  check('All mode labels every recognized object with a box',marker()?.className==='scene-object'&&marker()?.style.left==='70%'&&
    get('object-status').textContent.includes('Detector ready'));
  modeButtons[1].click();await settle();await advance(700);
  check('World switch requests a rear camera and releases the old stream',requests.at(-1).video.facingMode.ideal==='environment'&&streams[0].track.stopped);
  check('World image and labels are not mirrored',get('wearer-view').dataset.mirrored==='false'&&Math.abs(parseFloat(marker()?.style.left)-10)<1e-6);
  labelButtons[0].click();await advance(34);
  check('Labels off removes annotations and unloads recognition',get('scene-labels').children.length===0&&get('object-status').textContent.includes('unloaded'));
  labelButtons[1].click();await settle();await advance(700);
  check('Focus reloads recognition',get('object-status').textContent.includes('Detector ready')&&marker()?.className==='scene-marker');
  objectsPresent=false;await advance(1000);
  check('Lost detections remove markers and scene context',get('scene-labels').children.length===0&&get('scene-count').textContent==='0 objects');
  objectsPresent=true;await advance(240);
  modeButtons[2].click();await settle();await advance(240);
  check('Glasses preview exposes no companion annotation elements',get('wearer-view').dataset.mode==='glasses'&&
    get('scene-labels').children.length===0&&get('reveal-card').hidden===true&&labelButtons.every(b=>b.disabled));
  get('scene-stop').click();
  check('Stop releases media tracks and clears the scene',streams.every(s=>s.track.stopped)&&get('scene-labels').children.length===0);
  // Portrait phone: portrait stage, portrait camera frames, portrait analysis raster.
  const stage=get('wearer-view');stage.clientWidth=540;stage.clientHeight=960;
  for(const video of videos){video.videoWidth=720;video.videoHeight=1280;}
  detectionBox={originX:60,originY:100,width:60,height:120};
  modeButtons[0].click();get('welcome-start').click();await settle();await advance(700);
  check('A portrait stage requests portrait camera frames',requests.at(-1).video.width.ideal===720&&requests.at(-1).video.height.ideal===1280);
  check('Portrait frames are analysed in a portrait raster and markers stay aligned',
    marker()?.style.left==='50%'&&marker()?.style.top==='50%');
  get('scene-stop').click();stage.clientWidth=960;stage.clientHeight=540;
  for(const video of videos){video.videoWidth=1280;video.videoHeight=720;}
  detectionBox=offCentre;
  // A slow device: each detector result takes ~1 s, longer than the 800 ms default window.
  detectorDelayMs=950;get('welcome-start').click();await settle();await advance(6000);
  check('A ~1 Hz detector keeps object identity, so objects still confirm and get a marker',marker()?.className==='scene-marker');
  get('scene-stop').click();detectorDelayMs=0;await advance(1000);
  workerFails=true;get('welcome-start').click();await settle();await advance(700);
  check('A worker that cannot run detection falls back to the page thread',get('object-status').textContent.includes('Detector ready')&&
    get('object-status').textContent.includes('page thread')&&marker()?.className==='scene-marker');
  get('scene-stop').click();workerFails=false;await advance(200);
  // Hand pointing: the injected hand worker returns one hand whose index fingertip
  // sits on the cup (camera-normal 0.2, 0.4); the thumb opens, then closes to pinch.
  const handAt=(thumb)=>Array.from({length:21},(_,i)=>i===0?{x:0.2,y:0.8,z:0}:i===9?{x:0.2,y:0.6,z:0}:
    i===8?{x:0.2,y:0.4,z:0}:i===4?thumb:{x:0.25,y:0.6,z:0});
  get('welcome-start').click();await settle();await advance(700);
  get('hand-toggle').click();await settle();await advance(300);
  check('Hand selection loads a hand model in a worker on request',get('hand-toggle').getAttribute('aria-pressed')==='true'&&
    workerTasks.includes('hand'));
  hand=handAt({x:0.3,y:0.4,z:0});await advance(400);
  check('Pointing at an object highlights its marker without revealing anything',marker()?.dataset.aimed==='true'&&get('reveal-card').hidden===true);
  hand=handAt({x:0.2,y:0.41,z:0});await advance(400);
  check('A pinch on the pointed object reveals it with an explicit warrant',get('reveal-card').hidden===false&&
    get('reveal-title').textContent==='Cup'&&get('inspection-reason').textContent==='You pinched it');
  hand=null;await advance(400);
  check('Losing the hand clears the aim',marker()?.dataset.aimed!=='true');
  get('hand-toggle').click();get('scene-stop').click();await advance(200);

  modeButtons[0].click();allowCamera=false;get('start-camera').click();await settle();await advance(34);
  check('Denied permission falls back with explicit synthetic provenance',get('source-label').textContent.includes('Synthetic')&&get('scene-message').textContent.includes('denied')&&get('scene-labels').children.length===0);
  allowCamera=true;modelAvailable=false;get('start-camera').click();await settle();await advance(240);
  check('Recognition failure preserves the camera and reports the error',get('start-camera-label').textContent==='Camera live'&&get('scene-message').textContent.includes('Injected graphics failure'));
  doc.hidden=true;doc.events.get('visibilitychange')();
  check('Hiding the page releases the camera',streams.every(s=>s.track.stopped)&&get('scene-stop').disabled);
} catch(error){checks.push({name:'Actual camera shell executes with injected dependencies',passed:false,error:error.stack});}
const result={sourceSha256:createHash('sha256').update(html).digest('hex'),
  scope:'Injected DOM/media/detector integration; not browser rendering or real model inference',
  passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,checks};
console.log(JSON.stringify(result,null,2));process.exitCode=result.failed?1:0;
