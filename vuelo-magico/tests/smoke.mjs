import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
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
      await page.waitForFunction(()=>window.VillaPerezFlight?.version==='1.2.0');
      assert.equal(await page.locator('#scenePlayer').isVisible(),false);
      const photoData=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=330;c.height=590;const x=c.getContext('2d');x.fillStyle='#213049';x.fillRect(0,0,330,590);x.fillStyle='#a88b74';x.fillRect(35,300,265,160);return c.toDataURL('image/png').split(',')[1];});
      await page.locator('#centerPhotoInput').setInputFiles({name:'habitacion.png',mimeType:'image/png',buffer:Buffer.from(photoData,'base64')});
      await page.waitForFunction(()=>window.VillaPerezFlight?.getState().photoLoaded);
      assert.equal(await page.locator('#scenePlayer').isVisible(),true,'play controls visible');
      assert.equal(await page.locator('#sceneSizePanel').isVisible(),true,'size controls visible');
      assert.equal(await page.locator('#balloonTransform').isVisible(),true,'resize frame visible');
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
      await page.mouse.move(stage.x+stage.width*.12,stage.y+stage.height*.55);
      await page.mouse.down();
      await page.mouse.move(stage.x+stage.width*.56,stage.y+stage.height*.47,{steps:12});
      await page.mouse.up();
      assert.equal((await page.evaluate(()=>window.VillaPerezFlight.getState().path)).length>=3,true,'draw touch path');
      await page.locator('#playBtn').click();
      await page.waitForTimeout(400);
      assert.equal(await page.locator('#scenePill').innerText(),'REPRODUCIENDO');
      assert.equal(await page.locator('#balloonTransform').isVisible(),false);
      await page.locator('#playBtn').click();
      assert.equal(await page.locator('#balloonTransform').isVisible(),true);
      assert.equal(await page.locator('#scenePill').innerText(),'EDITANDO');
      assert.deepEqual(errors,[],'uncaught JS errors');
      console.log(browserName,JSON.stringify(dims),'PASS play_bottom',Math.round(btn.y+btn.height),'viewport',dims.height,'size',old,'dragged',after);
      await context.close();
    }
    await browser.close();
  }
}catch(err){console.error(err);process.exitCode=1;}finally{server.kill('SIGTERM');}
