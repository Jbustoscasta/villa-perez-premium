import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const origin='http://127.0.0.1:4173/vuelo-magico/';
const server=spawn('python3',['-m','http.server','4173','--bind','127.0.0.1'],{stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
  for(let i=0;i<35;i++){try{const r=await fetch(origin);if(r.ok)break;}catch{}await wait(250);}
  for(const [browserName, engine] of [['Chromium',chromium],['WebKit',webkit]]){
    const browser=await engine.launch({headless:true,args:browserName==='Chromium'?['--no-sandbox']:[]});
    for(const dims of [{width:375,height:667},{width:390,height:844},{width:1280,height:900}]){
      const context=await browser.newContext({viewport:dims,deviceScaleFactor:2,isMobile:dims.width<500,hasTouch:dims.width<500});
      const page=await context.newPage();const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      const response=await page.goto(origin,{waitUntil:'domcontentloaded'});
      assert.equal(response.status(),200);
      await page.waitForFunction(()=>window.VillaPerezFlight?.version==='1.5.4');
      const signal=await page.evaluate(()=>{
        const at=window.VillaPerezFlight.signalInterferenceAt;
        return [at(0,8),at(.8,8),at(1.7,8),at(4,8),at(5.8,8),at(6.5,8),at(8,8)];
      });
      assert.ok(signal[0]>.8&&signal[1]>0&&signal[1]<signal[0],'opening interference fades out');
      assert.deepEqual(signal.slice(2,5),[0,0,0],'middle of flight is clean');
      assert.ok(signal[5]>0&&signal[6]===1,'closing interference builds up');
      assert.equal(await page.locator('#scenePlayer').isVisible(),false);
      assert.equal(await page.locator('#storyStepPhoto').getAttribute('aria-current'),'step','first experience step');
      assert.equal(await page.locator('.magic-balloon-orb img').isVisible(),true,'official Pérez visual in magical welcome');
      const photoData=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=330;c.height=590;const x=c.getContext('2d');x.fillStyle='#213049';x.fillRect(0,0,330,590);x.fillStyle='#a88b74';x.fillRect(35,300,265,160);return c.toDataURL('image/png').split(',')[1];});
      await page.locator('#centerPhotoInput').setInputFiles({name:'habitacion.png',mimeType:'image/png',buffer:Buffer.from(photoData,'base64')});
      await page.waitForFunction(()=>window.VillaPerezFlight?.getState().photoLoaded);
      assert.equal(await page.locator('#scenePlayer').isVisible(),true,'play controls visible');
      assert.equal(await page.locator('#storyStepFlight').getAttribute('aria-current'),'step','photo advances to flight phase');
      assert.equal(await page.locator('#sceneSizePanel').isVisible(),true,'size controls visible');
      assert.equal(await page.locator('#balloonTransform').isVisible(),true,'resize frame visible');

      // iOS regression: a swipe started on the scene may NEVER scroll the site.
      // Safari touchmove must be cancelable and handled by a non-passive listener.
      const touchProtection=await page.evaluate(()=>{
        const stage=document.getElementById('stage');
        const overlay=document.getElementById('overlayCanvas');
        const wrap=document.querySelector('.stage-wrap');
        const touch={identifier:917};
        const send=(node,type)=>{
          const e=new Event(type,{bubbles:true,cancelable:true});
          Object.defineProperty(e,'changedTouches',{value:[touch]});
          node.dispatchEvent(e);
          return e.defaultPrevented;
        };
        send(overlay,'touchstart');
        const canvasBlocked=send(overlay,'touchmove');
        const boundaryBlocked=send(document.body,'touchmove');
        send(overlay,'touchend');
        const afterEndBlocked=send(document.body,'touchmove');
        const controlStyle=getComputedStyle(document.getElementById('sizeControl')).touchAction;
        return {canvasBlocked,boundaryBlocked,afterEndBlocked,stageCss:getComputedStyle(stage).touchAction,
          wrapCss:getComputedStyle(wrap).touchAction,overlayCss:getComputedStyle(overlay).touchAction,controlStyle};
      });
      assert.equal(touchProtection.stageCss,'none','stage must disable touch panning');
      assert.equal(touchProtection.wrapCss,'none','wrapper must disable touch panning');
      assert.equal(touchProtection.overlayCss,'none','drawing canvas must disable touch panning');
      assert.equal(touchProtection.controlStyle,'none','controls cannot scroll document');
      assert.equal(touchProtection.canvasBlocked,true,'touchmove in scene prevents scrolling');
      assert.equal(touchProtection.boundaryBlocked,true,'finger leaving scene keeps document locked');
      assert.equal(touchProtection.afterEndBlocked,false,'site can scroll once the touch ends');

      assert.equal(await page.locator('#sceneToolDock').isVisible(),true,'edit tools accessible within photo');
      assert.equal(await page.locator('#lightBadge').isVisible(),true,'night exposure control visible');
      if(dims.width<500)assert.equal(await page.locator('#mobileActionDock').isVisible(),true,'sticky export button visible');
      assert.equal(await page.evaluate(()=>window.VillaPerezFlight.getState().autoLight),true);
      const initialExposure=await page.evaluate(()=>window.VillaPerezFlight.getDebug().exposure);
      assert.ok(initialExposure<.90&&initialExposure>.17,'dark bedroom must reduce exposure: '+initialExposure);
      await page.locator('#lightBadge').click();
      assert.equal(await page.locator('#lightPopover').isVisible(),true);
      await page.locator('#lightAutoToggle').uncheck();
      await page.locator('#lightControl').fill('45');
      const manualExposure=await page.evaluate(()=>window.VillaPerezFlight.getDebug().exposure);
      assert.ok(manualExposure>.42&&manualExposure<.48,'manual exposure should be 45%, got '+manualExposure);
      await page.locator('#lightAutoToggle').check();
      await page.locator('#lightControl').fill('100');
      await page.locator('#lightCloseBtn').click();
      assert.equal(await page.locator('#lightPopover').isVisible(),false);
      const soundAsset=await page.evaluate(()=>document.getElementById('magicAudio').getAttribute('src'));
      assert.ok(soundAsset.includes('sonido-vuelo-real.mp3'),'real burner sound asset in use');
      await page.locator('#targetBtn').click();
      assert.equal(await page.locator('#targetBtn').getAttribute('aria-pressed'),'true');
      await page.locator('#drawBtn').click();

      const btn=await page.locator('#playBtn').boundingBox();
      assert.ok(btn, 'play button has visible bounds');
      if(dims.width<500)assert.ok(btn.y+btn.height<dims.height-8,'play must fit on small iPhone screen; bottom '+(btn.y+btn.height)+' vs viewport '+dims.height);
      const old=Number(await page.locator('#sizeControl').inputValue());
      await page.locator('#sizePlus').click();
      const updated=Number(await page.locator('#sizeControl').inputValue());
      assert.ok(updated>old,'in-scene plus increases size');
      await page.locator('#sizeMinus').click();
      assert.equal(Number(await page.locator('#sizeControl').inputValue()),old);
      const resizeBox=await page.locator('#resizeHandle').boundingBox();assert.ok(resizeBox,'resize handle');
      await page.mouse.move(resizeBox.x+resizeBox.width/2,resizeBox.y+resizeBox.height/2);
      await page.mouse.down();
      await page.mouse.move(resizeBox.x+resizeBox.width/2+10,resizeBox.y+resizeBox.height/2+35,{steps:8});
      await page.mouse.up();
      const after=Number(await page.locator('#sizeControl').inputValue());
      assert.ok(after>old,'dragging the resize handle increases size: '+old+' -> '+after);
      const stage=await page.locator('#overlayCanvas').boundingBox();
      if(browserName==='Chromium'&&dims.width===375){
        // Dispatch actual browser touch events rather than merely synthetic JS.
        // A vertical swipe inside the scene must stay at the same scrollY.
        const cdp=await context.newCDPSession(page);
        const pX=stage.x+stage.width*.15,pY=stage.y+stage.height*.58;
        const scrollBefore=await page.evaluate(()=>window.scrollY);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pX,y:pY}]});
        for(let i=1;i<=13;i++){
          await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',
            touchPoints:[{x:pX+stage.width*.10*i/13,y:pY-stage.height*.25*i/13}]});
          await page.waitForTimeout(16);
        }
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await page.waitForTimeout(150);
        const scrollAfter=await page.evaluate(()=>window.scrollY);
        assert.ok(Math.abs(scrollAfter-scrollBefore)<2,
          'real mobile swipe must not scroll the page: '+scrollBefore+' -> '+scrollAfter);
        await cdp.detach();
      }
      await page.mouse.move(stage.x+stage.width*.12,stage.y+stage.height*.55);
      await page.mouse.down();
      await page.mouse.move(stage.x+stage.width*.56,stage.y+stage.height*.47,{steps:12});
      await page.mouse.up();
      assert.equal((await page.evaluate(()=>window.VillaPerezFlight.getState().path)).length>=3,true,'draw touch path');
      await page.evaluate(()=>{
        const x=document.getElementById('sceneCanvas').getContext('2d'),original=x.fillText.bind(x);
        window.__previewHud=[];
        x.fillText=(label,...args)=>{window.__previewHud.push(String(label));return original(label,...args);};
      });
      await page.locator('#playBtn').click();
      await page.waitForTimeout(400);
      assert.ok(await page.evaluate(()=>window.__previewHud.includes('REC')&&window.__previewHud.some(x=>x.startsWith('06:34:'))),'playback previews the same recording HUD');
      assert.equal(await page.locator('#scenePill').innerText(),'REPRODUCIENDO');
      await page.locator('#soundBtn').click();
      assert.equal(await page.locator('#scenePill').innerText(),'REPRODUCIENDO','muting must never pause flight');
      await page.locator('#soundBtn').click();

      // Slow software WebKit rendering can finish the whole 15s flight while
      // the test is interacting. Only click Pause if flight is still playing.
      if((await page.locator('#scenePill').innerText())==='REPRODUCIENDO'){
        assert.equal(await page.locator('#balloonTransform').isVisible(),false);
        await page.locator('#playBtn').click();
      }
      await page.waitForFunction(()=>document.getElementById('scenePill').textContent==='EDITANDO');
      assert.equal(await page.locator('#balloonTransform').isVisible(),true);
      // End-to-end recording: one Chromium mobile run checks file generation,
      // recorder cleanup and return to enabled playback controls.
      if(browserName==='Chromium'&&dims.width===390){
        await page.evaluate(()=>{const e=document.getElementById('durationControl');e.value='8';e.dispatchEvent(new Event('input',{bubbles:true}));});
        // Track drawing on the very canvas captured by MediaRecorder.
        await page.evaluate(()=>{
          const c=document.getElementById('sceneCanvas'),x=c.getContext('2d');
          const originalText=x.fillText.bind(x),originalArc=x.arc.bind(x);
          window.__recordedHud={labels:[],pulse:[],captured:false,firstFrame:false,glitch:[],snow:[]};
          const originalImage=x.drawImage.bind(x);
          x.drawImage=(source,...args)=>{if(source.id==='signalGlitchBuffer'||source.id==='signalNoiseBuffer'){const last=window.__recordedHud.labels.filter(s=>s.startsWith('06:34:')).at(-1);window.__recordedHud[source.id==='signalNoiseBuffer'?'snow':'glitch'].push(last);}return originalImage(source,...args);};
          const originalCapture=c.captureStream.bind(c);
          c.captureStream=(...args)=>{
            window.__recordedHud.firstFrame=window.__recordedHud.labels.includes('06:34:00');
            window.__recordedHud.captured=true;
            return originalCapture(...args);
          };
          x.fillText=(label,...args)=>{window.__recordedHud.labels.push(String(label));return originalText(label,...args);};
          x.arc=(...args)=>{if(x.fillStyle==='#ff414f')window.__recordedHud.pulse.push(x.globalAlpha);return originalArc(...args);};
        });
        const downloadPromise=page.waitForEvent('download',{timeout:30000});
        await page.locator(dims.width<500?'#quickExportBtn':'#exportBtn').click();
        const download=await downloadPromise;
        assert.match(download.suggestedFilename(),/vuelo-raton-perez-.*\.(webm|mp4)$/);
        const recording=await readFile(await download.path());
        assert.ok(recording.length>18000,'exported video contains recorded frames');
        const hud=await page.evaluate(()=>window.__recordedHud);
        assert.ok(hud.captured&&hud.firstFrame,'recorded canvas contains the HUD before capture starts');
        for(const label of ['REC','06:34:00','CAM','☾ Visión nocturna'])assert.ok(hud.labels.includes(label),'HUD label: '+label);
        assert.ok(hud.labels.includes('06:34:03'),'capture timestamp advances from 06:34');
        assert.ok(hud.glitch.includes('06:34:00'),'opening signal interference is painted into exported frames');
        assert.ok(hud.glitch.some(t=>t==='06:34:07'||t==='06:34:08'),'closing signal interference is painted into exported frames');
        assert.ok(!hud.glitch.includes('06:34:03'),'no interference in the middle of the exported flight');
        assert.ok(hud.snow.includes('06:34:00')&&hud.snow.some(t=>t==='06:34:07'||t==='06:34:08'),'TV snow is part of both ends of the export');
        assert.ok(hud.labels.includes('SIN SEÑAL'),'final recording contains signal loss');
        assert.ok(hud.labels.includes('SEÑAL INESTABLE'),'initial recording contains signal lock');
        assert.ok(Math.min(...hud.pulse)<.45&&Math.max(...hud.pulse)>.85,'REC pulses during recording');
        const codecs=['A_OPUS','A_VORBIS','mp4a'].some(k=>recording.includes(Buffer.from(k)));
        assert.ok(codecs,'export must include an AUDIO track, not just silent video');

        await page.waitForFunction(()=>document.getElementById('exportModal').hidden,{timeout:10000});
        assert.equal(await page.locator('#playBtn').isEnabled(),true,'play button reenabled after export');
        assert.equal(await page.locator('#storyStepMemory').getAttribute('aria-current'),'step','final reminder step after export');
        assert.equal(await page.locator('#successModal').isVisible(),true,'magical completion screen shown');
        assert.equal(await page.locator('#successShare').isVisible(),true,'sharing accessible without scrolling');
        assert.equal(await page.locator('#successDownload').isVisible(),true,'explicit download action available');
        await page.locator('#successClose').click();
        assert.equal(await page.locator('#successModal').isVisible(),false,'completion screen can be closed');

        console.log(browserName,'export recorded',download.suggestedFilename());
      }
      assert.deepEqual(errors,[],'uncaught JS errors');
      console.log(browserName,JSON.stringify(dims),'PASS play_bottom',Math.round(btn.y+btn.height),'viewport',dims.height,'size',old,'dragged',after);
      await context.close();
    }
    await browser.close();
  }
}catch(err){console.error(err);server.kill('SIGTERM');process.exit(1);}finally{server.kill('SIGTERM');}
