import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const base='http://127.0.0.1:4173/';
const app=base+'la-noche-de-perez/';
const server=spawn('python3',['-m','http.server','4173','--bind','127.0.0.1'],{stdio:'ignore'});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function noPageOrScreenScroll(page,label){
  const metrics=await page.evaluate(()=>{
    const active=document.querySelector('.screen.active');
    return {
      body:document.body.scrollHeight-document.body.clientHeight,
      html:document.documentElement.scrollHeight-document.documentElement.clientHeight,
      screen:active?active.scrollHeight-active.clientHeight:0
    };
  });
  assert.ok(metrics.body<=2&&metrics.html<=2&&metrics.screen<=3,
    label+' should fit the viewport without page scroll: '+JSON.stringify(metrics));
}

async function imageBuffer(page){
  const data=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');
    canvas.width=420;canvas.height=620;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#263b52';ctx.fillRect(0,0,420,620);
    ctx.fillStyle='#c6a17a';ctx.fillRect(35,320,350,230);
    ctx.fillStyle='#f4d99b';ctx.beginPath();ctx.arc(320,90,38,0,Math.PI*2);ctx.fill();
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(data,'base64');
}

try{
  for(let i=0;i<40;i++){try{if((await fetch(app)).ok)break;}catch{}await wait(250);}
  for(const [browserName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
    const browser=await engine.launch({headless:true,args:browserName==='Chromium'?['--no-sandbox']:[]});
    try{
      for(const viewport of [{width:375,height:667},{width:390,height:844},{width:1280,height:900}]){
        const context=await browser.newContext({
          viewport,deviceScaleFactor:1,isMobile:viewport.width<500,hasTouch:viewport.width<500,
          acceptDownloads:true
        });
        const page=await context.newPage(),errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        const response=await page.goto(app,{waitUntil:'domcontentloaded'});
        assert.equal(response.status(),200);
        await page.waitForFunction(()=>window.LNPMemoryStore&&window.VPPhotoStore);
        assert.equal(await page.locator('#screen-home').isVisible(),true);
        await noPageOrScreenScroll(page,'home '+browserName+' '+viewport.width+'x'+viewport.height);
        if(browserName==='Chromium'&&viewport.width===390){
          const shot=await page.screenshot({type:'jpeg',quality:68});
          console.log('LNP_HOME_BEGIN'+shot.toString('base64')+'LNP_HOME_END');
        }

        await page.locator('#menuButton').click();
        assert.equal(await page.locator('#menuDialog').evaluate(e=>e.open),true);
        await page.locator('#menuDialog [data-screen="letter"]').click();
        assert.equal(await page.locator('#screen-letter').isVisible(),true);
        await noPageOrScreenScroll(page,'letter '+browserName+' '+viewport.width+'x'+viewport.height);
        await page.locator('#childName').fill('Leo');
        await page.locator('#toothName').fill('su primer incisivo');
        await page.locator('#letterMessage').fill('Gracias por cuidar tu sonrisa. He venido desde Villa Pérez.');
        await page.locator('#letterForm button[type="submit"]').click();
        await page.waitForSelector('#memoryList .memory-item');
        let items=await page.evaluate(()=>window.LNPMemoryStore.list());
        assert.equal(items.some(item=>item.type==='letter'&&item.childName==='Leo'&&item.message.includes('incisivo')),true);

        await page.locator('.brand-plaque').click();
        await page.locator('#screen-home [data-screen="proofs"]').click();
        assert.equal(await page.locator('#screen-proofs').isVisible(),true);
        await noPageOrScreenScroll(page,'proofs '+browserName+' '+viewport.width+'x'+viewport.height);
        await page.locator('[data-proof="selfie"]').click();
        await page.locator('#proofPhotoInput').setInputFiles({name:'dormitorio.png',mimeType:'image/png',buffer:await imageBuffer(page)});
        await page.waitForFunction(()=>!document.getElementById('proofCanvas').hidden);
        await page.waitForTimeout(250);
        await noPageOrScreenScroll(page,'photo editor '+browserName+' '+viewport.width+'x'+viewport.height);
        await page.locator('#proofScale').fill('22');
        await page.locator('#saveProofButton').click();
        await page.waitForFunction(async()=>{const a=await window.LNPMemoryStore.list();return a.some(x=>x.type==='perez-selfie');});
        const hasSavedImage=await page.evaluate(async()=>{const a=await window.LNPMemoryStore.list();return a.some(item=>item.type==='perez-selfie'&&item.blob instanceof Blob&&item.blob.type==='image/png');});
        assert.equal(hasSavedImage,true);

        await page.locator('.brand-plaque').click();
        await page.locator('#screen-home [data-screen="video"]').click();
        await noPageOrScreenScroll(page,'video '+browserName+' '+viewport.width+'x'+viewport.height);
        await page.locator('#videoPhotoInput').setInputFiles({name:'habitacion.png',mimeType:'image/png',buffer:await imageBuffer(page)});
        await page.waitForFunction(()=>!document.getElementById('videoPhotoPreview').hidden);
        const storedPhoto=await page.evaluate(async()=>{const file=await window.VPPhotoStore.access('get');return file?.name||null;});
        assert.equal(storedPhoto,'habitacion.png');
        await page.locator('#openVideoEditor').click();
        await page.waitForURL(/vuelo-magico/);
        await page.waitForFunction(()=>window.VillaPerezFlight?.getState().photoLoaded===true,{timeout:30000});
        assert.equal(await page.evaluate(()=>window.LNPMemoryStore!==undefined),true);
        assert.deepEqual(errors,[]);
        console.log('PASS',browserName,viewport,'home/menu, letter, photo composition, chest, photo handoff to flight editor');
        await context.close();
      }
    } finally { await browser.close(); }
  }
  console.log('ALL_LA_NOCHE_DE_PEREZ_TESTS_PASSED');
} catch(error) {
  console.error(error);
  process.exitCode=1;
} finally {
  server.kill('SIGTERM');
}