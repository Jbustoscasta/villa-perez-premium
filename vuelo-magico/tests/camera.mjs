import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const origin='http://127.0.0.1:4174/vuelo-magico/';
const server=spawn('python3',['-m','http.server','4174','--bind','127.0.0.1'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  for(let i=0;i<35;i++){
    try{const r=await fetch(origin);if(r.ok)break;}catch{}
    await sleep(250);
  }
  for(const [browserName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
    const browser=await engine.launch({headless:true,args:browserName==='Chromium'?['--no-sandbox']:[]});
    try{
      const context=await browser.newContext({viewport:{width:390,height:844},
        deviceScaleFactor:2,hasTouch:true,isMobile:true});
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(()=>{
        window.__cameraMocks=[];
        window.__cameraPermissionDenied=false;
        Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{
          getUserMedia:async () => {
            if(window.__cameraPermissionDenied){
              const e=new Error('Mock permission denied');e.name='NotAllowedError';throw e;
            }
            const canvas=document.createElement('canvas');
            canvas.width=360;canvas.height=640;
            const x=canvas.getContext('2d');
            let ticks=0;
            const render=()=>{
              x.fillStyle='#253044';x.fillRect(0,0,360,640);
              x.fillStyle='#917d81';x.fillRect(50,370,270,145);
              x.fillStyle='#d7b19c';x.fillRect(115,392,65,40);
              x.fillStyle='#e4c6a0';x.fillRect(155,120,4+(ticks%5),4);
              ticks++;
            };
            render();
            const stream=canvas.captureStream(15);
            const timer=setInterval(render,75);
            stream.getTracks()[0].addEventListener('ended',()=>clearInterval(timer));
            window.__cameraMocks.push(stream);
            return stream;
          }
        }});
      });
      const response=await page.goto(origin,{waitUntil:'domcontentloaded'});
      assert.equal(response.status(),200);
      await page.waitForFunction(()=>window.VillaPerezFlight?.version==='1.5.4');
      assert.equal(await page.locator('#openCameraMain').isVisible(),true,'camera is main CTA');
      assert.equal(await page.locator('#emptyUploadBtn').isVisible(),true,'gallery remains available');
      await page.locator('#openCameraMain').click();
      await page.waitForFunction(()=>!document.getElementById('cameraShutter').disabled,{timeout:18000});
      assert.equal(await page.locator('#magicCamera').isVisible(),true,'camera overlay visible');
      assert.match(await page.locator('#cameraStepIndicator').innerText(),/01 \/ 03/,'camera begins on framing');
      assert.equal(await page.locator('.camera-air-space').isVisible(),true,'balloon air guide visible');
      assert.equal(await page.locator('#cameraPreview').isVisible(),false,'photo preview hidden before shutter');
      assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('camera-active')),true);
      const cameraWidth=await page.locator('#cameraViewport').evaluate(el=>el.getBoundingClientRect().width);
      const cameraHeight=await page.locator('#cameraViewport').evaluate(el=>el.getBoundingClientRect().height);
      assert.ok(Math.abs(cameraWidth/cameraHeight-9/16)<.015,'viewfinder keeps 9:16');
      await page.locator('#cameraShutter').click();
      await page.waitForFunction(()=>!document.getElementById('cameraReviewActions').hidden,{timeout:18000});
      assert.equal(await page.locator('#cameraPreview').isVisible(),true,'captured photo preview visible');
      assert.equal(await page.locator('#cameraGuide').isVisible(),true,'ghost guide remains during photo review');
      assert.equal(await page.locator('.camera-ghost-balloon').isVisible(),true,'reference balloon remains over the captured photo');
      assert.equal(await page.locator('.camera-air-title').isVisible(),false,'framing instructions do not clutter the review');
      assert.ok(Number(await page.locator('.camera-ghost-balloon').evaluate(el=>getComputedStyle(el).opacity))<.6,'reference is translucent');
      assert.match(await page.locator('#cameraStepIndicator').innerText(),/02 \/ 03/,'review step visible');
      const capturedSize=await page.locator('#cameraPreview').evaluate(img=>new Promise(resolve=>{
        if(img.complete&&img.naturalWidth)return resolve({w:img.naturalWidth,h:img.naturalHeight});
        img.onload=()=>resolve({w:img.naturalWidth,h:img.naturalHeight});
      }));
      assert.equal(capturedSize.w,360);
      assert.equal(capturedSize.h,640);
      const stopped=await page.evaluate(()=>window.__cameraMocks[0].getTracks().every(t=>t.readyState==='ended'));
      assert.equal(stopped,true,'camera track released for photo review');
      await page.locator('#cameraRetakeBtn').click();
      await page.waitForFunction(()=>!document.getElementById('cameraShutter').disabled,{timeout:18000});
      assert.equal(await page.locator('#cameraReviewActions').isVisible(),false,'retake returns to camera');
      assert.equal(await page.locator('#cameraGuide').isVisible(),true,'guides return when retaking');
      await page.locator('#cameraShutter').click();
      await page.waitForFunction(()=>!document.getElementById('cameraReviewActions').hidden,{timeout:18000});
      await page.locator('#cameraAcceptBtn').click();
      await page.waitForFunction(()=>window.VillaPerezFlight?.getState().photoLoaded,{timeout:14000});
      assert.equal(await page.locator('#magicCamera').isVisible(),false);
      assert.equal(await page.locator('#scenePlayer').isVisible(),true,'flow continues to the editor');
      const {path,photoLoaded}=await page.evaluate(()=>window.VillaPerezFlight.getState());
      assert.equal(photoLoaded,true);
      assert.ok(path.length>5,'guided flight path is prefilled');
      assert.ok(path.filter(p=>p.x>=0&&p.x<=1).every(p=>p.y<.40),'guided flight stays above bed');
      const allStopped=await page.evaluate(()=>window.__cameraMocks.every(s=>s.getTracks().every(t=>t.readyState==='ended')));
      assert.equal(allStopped,true,'no camera tracks left after acceptance');
      await page.locator('#openCameraAgain').click();
      await page.waitForFunction(()=>!document.getElementById('cameraShutter').disabled,{timeout:18000});
      await page.locator('#cameraCloseBtn').click();
      assert.equal(await page.locator('#magicCamera').isVisible(),false);
      assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('camera-active')),false,'document scroll is restored');
      // Safari denial path: provide usable native gallery, not a dead camera screen.
      await page.evaluate(()=>window.__cameraPermissionDenied=true);
      await page.locator('#openCameraSidebar').click();
      await page.waitForFunction(()=>!document.getElementById('cameraError').hidden,{timeout:8000});
      assert.equal(await page.locator('#cameraShutter').isDisabled(),true);
      assert.equal(await page.locator('#cameraGalleryInput').isVisible(),true);
      const testPNG=await page.evaluate(()=>{
        const c=document.createElement('canvas');c.width=200;c.height=356;
        c.getContext('2d').fillRect(0,0,200,356);
        return c.toDataURL('image/png').split(',')[1];
      });
      await page.locator('#cameraGalleryInput').setInputFiles({
        name:'otra-foto.png',mimeType:'image/png',buffer:Buffer.from(testPNG,'base64')
      });
      await page.waitForFunction(()=>document.getElementById('photoTitle').textContent.includes('otra-foto'),{timeout:10000});
      assert.equal(await page.locator('#magicCamera').isVisible(),false);
      assert.deepEqual(errors,[],'no unhandled errors');
      console.log(browserName,'PASS camera guided capture -> retry -> accept; permission fallback -> gallery; portrait 9:16');
      await context.close();
    } finally {
      await browser.close();
    }
  }
}catch(err){
  console.error(err);server.kill('SIGTERM');process.exit(1);
}finally{server.kill('SIGTERM');}
