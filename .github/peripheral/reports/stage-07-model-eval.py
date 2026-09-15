"""Native ONNX reference check; not live/browser validation. No camera required.
Install onnxruntime==1.22.0 and Pillow. Pass a scratch model/image directory.
Selection and gate fixed before inference: all six Chair/Bottle Stage 5 fixtures,
brightness 0.9 revisit, every revisit >= .92 and >= .04 ahead of same-class rivals.
This tests appearance persistence, not multi-view instance-recognition quality.
"""
import sys,json,hashlib,time,urllib.request
from pathlib import Path
import numpy as np
from PIL import Image,ImageEnhance
import onnxruntime as ort
root=Path(__file__).resolve().parents[3]
cache=Path(sys.argv[1]);cache.mkdir(parents=True,exist_ok=True)
revision='d15189d7028b43f1d3e65039190477f6af591c2a'
model=cache/'onnx/vision_model_quantized.onnx'
expected='583fd1110a514667812fee7d684952aaf82a99b959760c8d7dca7e0ab9839299'
assert hashlib.sha256(model.read_bytes()).hexdigest()==expected
fixtures=[f for f in json.loads((root/'.github/peripheral/fixtures/stage-05-open-images.json').read_text())['fixtures'] if f['className'] in ['Chair','Bottle']]
opts=ort.SessionOptions();opts.intra_op_num_threads=1;opts.inter_op_num_threads=1
start=time.perf_counter();sess=ort.InferenceSession(str(model),opts,providers=['CPUExecutionProvider']);initMs=(time.perf_counter()-start)*1000
mean=np.array([.48145466,.4578275,.40821073],dtype=np.float32);std=np.array([.26862954,.26130258,.27577711],dtype=np.float32)
def tensor(im):
 w,h=im.size;scale=224/min(w,h);im=im.resize((int(w*scale),int(h*scale)),Image.Resampling.BICUBIC)
 w,h=im.size;im=im.crop(((w-224)//2,(h-224)//2,(w-224)//2+224,(h-224)//2+224))
 return ((np.asarray(im,dtype=np.float32)/255-mean)/std).transpose(2,0,1)[None].copy()
sess.run(None,{'pixel_values':np.zeros((1,3,224,224),dtype=np.float32)})
records=[]
for f in fixtures:
 p=cache/(f['id']+'.jpg')
 if not p.exists():
  with urllib.request.urlopen(f['sourceUrl'],timeout=60) as response:p.write_bytes(response.read())
 assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
 im=Image.open(p).convert('RGB');w,h=im.size;b=f['expectedBox'];im=im.crop((int(b['xMin']*w),int(b['yMin']*h),int(b['xMax']*w),int(b['yMax']*h)))
 vectors=[];times=[]
 for crop in [im,ImageEnhance.Brightness(im).enhance(.9)]:
  x=tensor(crop);start=time.perf_counter();out=sess.run(['image_embeds'],{'pixel_values':x})[0].reshape(-1);times.append((time.perf_counter()-start)*1000)
  assert out.size==512 and np.isfinite(out).all();out=out/np.linalg.norm(out);vectors.append(out.tolist())
 records.append({'fixture':f,'original':vectors[0],'revisit':vectors[1],'inferenceMs':times,'tier':None,'source':'evaluation'})
 print(f['id'],times,flush=True)
checks=[]
for r in records:
 positive=float(np.dot(r['original'],r['revisit']));rivals=[float(np.dot(o['original'],r['revisit'])) for o in records if o is not r and o['fixture']['className']==r['fixture']['className']]
 checks.append({'id':r['fixture']['id'],'positive':positive,'closestOther':max(rivals),'passed':positive>=.92 and positive-max(rivals)>=.04 and max(rivals)<.92})
report={'runtime':'onnxruntime@'+ort.__version__,'modelRevision':revision,'modelSha256':expected,'modelBytes':model.stat().st_size,'initializationMs':initMs,'warmup':1,'input':'licensed prerecorded object crops; brightness-only revisit','passed':sum(c['passed'] for c in checks),'failed':sum(not c['passed'] for c in checks),'checks':checks,'records':records}
(root/'.github/peripheral/reports/stage-07-model-run.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='records'},indent=2));sys.exit(bool(report['failed']))
