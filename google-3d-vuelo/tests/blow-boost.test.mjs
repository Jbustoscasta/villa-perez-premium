import test from 'node:test';
import assert from 'node:assert/strict';
import {BASE_BLOW_SPEED,MAX_BLOW_SPEED,blowSpeedTarget,smoothBlowSpeed} from '../blow-boost.mjs';

test('silencio y ruido ambiente no aceleran el globo',()=>{
 assert.equal(blowSpeedTarget(0,0),1);
 assert.equal(blowSpeedTarget(.004,.008),1);
 assert.equal(blowSpeedTarget(.007,.004),1);
});
test('un soplido progresivamente fuerte aumenta el multiplicador sin superar el límite',()=>{
 const soft=blowSpeedTarget(.012,.006);
 const medium=blowSpeedTarget(.035,.006);
 const strong=blowSpeedTarget(.16,.006);
 assert.ok(soft>=3.5&&soft<MAX_BLOW_SPEED);
 assert.ok(medium>soft);
 assert.ok(strong>soft);
 assert.equal(blowSpeedTarget(1,.008),MAX_BLOW_SPEED);
 assert.equal(blowSpeedTarget(Number.NaN,.008),BASE_BLOW_SPEED);
});
test('aceleración suave y retorno gradual a x1',()=>{
 const pushed=smoothBlowSpeed(1,MAX_BLOW_SPEED,70);
 assert.ok(pushed>1&&pushed<MAX_BLOW_SPEED);
 const release=smoothBlowSpeed(pushed,1,70);
 assert.ok(release>=1&&release<pushed);
 assert.equal(smoothBlowSpeed(1,1,70),1);
});
test('el ritmo de muestra no produce multiplicadores no válidos',()=>{
 assert.ok(smoothBlowSpeed(1,MAX_BLOW_SPEED,0)<=MAX_BLOW_SPEED);
 assert.ok(smoothBlowSpeed(MAX_BLOW_SPEED,BASE_BLOW_SPEED,1000)>=1);
});

test('el turbo máximo es diez veces el avance normal',()=>{
 assert.equal(MAX_BLOW_SPEED,10);
 assert.ok(blowSpeedTarget(.020,.006)>=5);
 assert.equal(blowSpeedTarget(.25,.006),10);
});
