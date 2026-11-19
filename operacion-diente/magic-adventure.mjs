/**
 * Villa Pérez — Aventuras en calles reales (v0.6).
 * Three optional, short, accessible challenges. No family location is stored.
 * Uses only the clipped, child-facing geographic path passed by the parent app.
 * Narration: use approved audio files when supplied, otherwise browser demo voice.
 */
import {pointAt} from './route-utils.mjs';

export const MISSIONS = Object.freeze([
  {key:'lights',at:.17,name:'Enciende el camino',caption:'Toca tres estrellas sobre las calles para que el Ratón siga avanzando.',emoji:'✦'},
  {key:'chase',at:.43,name:'¡Una estrella traviesa!',caption:'¡Atrápala! La estrella cambia de sitio cuando la tocas.',emoji:'★'},
  {key:'portal',at:.71,name:'La llave de la noche',caption:'Desliza la llave hasta el final y abre el portal mágico.',emoji:'⚷'}
]);
export const NARRATION = Object.freeze({
  intro:'¡Atención, atención! Ha caído un diente. Mi mochila está preparada. ¿Me ayudas a llegar?',
  depart:'¡Ya he salido de Villa Pérez! ¡Qué emocionante! Estoy siguiendo las calles de verdad.',
  lights:'¡El camino está un poquito oscuro! ¿Me ayudas a encender las tres estrellas?',
  lightsDone:'¡Qué bonito! Ahora veo el camino. ¡Gracias por tu ayuda!',
  chase:'¡Oh, no! ¡Una estrella se ha escapado! ¿Puedes atraparla?',
  chaseDone:'¡Conseguido! ¡Qué rápido eres! Sigamos nuestro viaje.',
  portal:'¡Una puerta secreta! Desliza la llave mágica para abrirla.',
  portalDone:'¡Perfecto! El portal de las estrellas está abierto.',
  halfway:'¡Ya hemos recorrido más de la mitad! ¡Qué aventura!',
  near:'¡Shhh! Estoy muy cerca. Los últimos pasos tienen que ser secretos.',
  done:'¡Misión cumplida! Gracias por acompañarme. ¡Buenas noches!',
  scenic:'¡Mira qué lugar tan especial! La ciudad está preciosa.',
  skip:'No pasa nada, podemos seguir nuestro camino.'
});
export function missionAt(progress,done=new Set()) {
  return MISSIONS.find(m=>progress>=m.at && !done.has(m.key))||null;
}
export function starRouteFractions(base) {
  const offsets=[-.012,.003,.017];
  return offsets.map(o=>Math.max(.025,Math.min(.97,base+o)));
}
export function finalBadges(done=new Set(),earned=new Set()) {
  return MISSIONS.map(m=>({name:m.name,completed:earned.has(m.key),visited:done.has(m.key)}));
}
const $=id=>document.getElementById(id);
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));

export class MagicAdventure {
  constructor({getMap,getPath,onPause,onResume,onSound,getAudioUrls}){
    this.getMap=getMap;this.getPath=getPath;this.onPause=onPause;this.onResume=onResume;
    this.onSound=onSound;this.getAudioUrls=getAudioUrls;
    this.done=new Set();this.earned=new Set();this.active=null;this.sound=false;
    this.voiceIds=new Set();this.spoken=new Set();this.timeouts=[];this.markers=[];
    this.hops=0;this.gathered=new Set();this.voiceAudio=null;this.lastUpdate=0;
    this.onMove=()=>this.positionMarkers();
    $('quest-close').addEventListener('click',()=>this.finish(false));
    $('quest-skip').addEventListener('click',()=>this.finish(false));
    $('quest-collect').addEventListener('click',()=>this.portalDone());
    $('quest-swipe-track').addEventListener('pointerdown',e=>this.startSwipe(e));
    $('quest-swipe-track').addEventListener('pointermove',e=>this.moveSwipe(e));
    $('quest-swipe-track').addEventListener('pointerup',e=>this.endSwipe(e));
    $('quest-swipe-track').addEventListener('pointercancel',()=>this.resetSwipe());
    $('quest-swipe-track').addEventListener('keydown',e=>{
      if(e.key==='ArrowRight'||e.key==='End'||e.key==='Enter'||e.key===' '){
        e.preventDefault();this.portalDone();
      }
    });
    $('narrate-again').addEventListener('click',()=>this.say(this.lastCue||'intro',true));
    this.updateHud();
  }
  attachMap(map){
    if(this.map) {this.map.off('move',this.onMove);this.map.off('resize',this.onMove);}
    this.map=map;
    map?.on('move',this.onMove);map?.on('resize',this.onMove);
  }
  reset(){
    this.active=null;this.done.clear();this.earned.clear();this.spoken.clear();this.gathered.clear();
    this.hops=0;this.lastUpdate=0;this.cancelSpeech();
    this.removeMarkers();this.hideChallenge();this.updateHud();
    this.attachMap(null);
  }
  setAudio(enabled){
    this.sound=Boolean(enabled);this.onSound?.(this.sound);
    if(!this.sound)this.cancelSpeech();
    $('voice-status').textContent=this.sound?'Narración de demostración activa':'Activa la voz de demostración ♪';
  }
  cancelSpeech(){
    if(this.voiceAudio){this.voiceAudio.pause();this.voiceAudio.currentTime=0;this.voiceAudio=null;}
    try{window.speechSynthesis?.cancel()}catch{}
  }
  say(key,repeat=false){
    this.lastCue=key;
    if(!this.sound)return;
    if(!repeat && this.spoken.has(key))return;
    this.spoken.add(key);
    const spokenText=NARRATION[key]||key;
    if(!spokenText)return;
    this.cancelSpeech();
    // Only audio files approved by brand would be treated as the official character voice.
    const approvedUrl=this.getAudioUrls?.()?.[key];
    if(approvedUrl){
      const audio=new Audio(approvedUrl);
      this.voiceAudio=audio;audio.volume=.85;
      audio.play().catch(()=>this.speakDemo(spokenText));
      return;
    }
    this.speakDemo(spokenText);
  }
  speakDemo(text){
    const synth=window.speechSynthesis;
    if(!synth || typeof SpeechSynthesisUtterance==='undefined')return;
    try{
      const u=new SpeechSynthesisUtterance(text);
      u.lang='es-ES';u.rate=.94;u.pitch=1.08;u.volume=.9;
      const voices=synth.getVoices()||[];
      const spanish=voices.find(v=>v.lang?.toLowerCase().startsWith('es') && /premium|enhanced|natural/i.test(v.name))||
        voices.find(v=>v.lang?.toLowerCase().startsWith('es'));
      if(spanish)u.voice=spanish;
      synth.speak(u);
    }catch(e){console.warn('Narración de demo no disponible',e)}
  }
  playSound(type='star'){
    try{
      if(!this.sound)return;
      const context=window.__vpAudioContext;
      if(!context)return;
      const now=context.currentTime;
      const keys=type==='success'?[523,659,784,1046]:type==='portal'?[392,523,784]:[880,1108];
      for(let i=0;i<keys.length;i++){
        const oscillator=context.createOscillator(),gain=context.createGain();
        oscillator.type='sine';
        oscillator.frequency.setValueAtTime(keys[i],now+i*.084);
        gain.gain.setValueAtTime(.0001,now+i*.084);
        gain.gain.exponentialRampToValueAtTime(.042,now+i*.084+.016);
        gain.gain.exponentialRampToValueAtTime(.0001,now+i*.084+.25);
        oscillator.connect(gain);gain.connect(context.destination);
        oscillator.start(now+i*.084);oscillator.stop(now+i*.084+.27);
      }
    }catch(e){console.warn('Efecto de audio no disponible',e)}
  }
  tick(progress){
    if(this.active||!this.getMap()||!this.getPath())return false;
    const next=missionAt(progress,this.done);
    if(!next)return false;
    this.start(next);
    return true;
  }
  start(mission){
    this.onPause?.();
    this.active=mission;this.gathered.clear();this.hops=0;
    const map=this.getMap(),path=this.getPath();
    $('quest-brow').textContent='DESAFÍO MÁGICO · '+(this.done.size+1)+' DE 3';
    $('quest-title').textContent=mission.name;
    $('quest-copy').textContent=mission.caption;
    $('quest-result').textContent='';
    $('quest-targets').replaceChildren();
    $('magic-game').classList.remove('hidden');
    $('quest-swipe').classList.toggle('hidden',mission.key!=='portal');
    $('quest-collect').classList.toggle('hidden',mission.key!=='portal');
    $('quest-targets').classList.toggle('hidden',mission.key==='portal');
    $('quest-progress').textContent=mission.key==='lights'?'0 / 3 estrellas':mission.key==='chase'?'0 / 3 saltos':'Desliza para abrir';
    $('quest-skip').textContent='Continuar sin jugar';
    map?.easeTo({center:pointAt(path,mission.at).coordinate,zoom:16.1,pitch:35,bearing:0,duration:500,essential:false});
    if(mission.key==='lights'){
      this.markers=starRouteFractions(mission.at).map((f,i)=>this.createStar(f,i));
    }else if(mission.key==='chase'){
      this.markers=[this.createStar(mission.at+.014,0,true)];
    }else{
      this.resetSwipe();
    }
    this.positionMarkers();
    this.say(mission.key);
  }
  createStar(f,index,chase=false){
    const button=document.createElement('button');
    button.type='button';button.className='magic-star';
    button.textContent=chase?'★':'✦';
    button.setAttribute('aria-label',chase?'Atrapar estrella traviesa':'Encender estrella '+(index+1));
    button.dataset.i=String(index);
    button.addEventListener('click',()=>chase?this.catchStar():this.collectStar(index));
    $('quest-targets').appendChild(button);
    return {button,frac:clamp(f,.015,.985)};
  }
  positionMarkers(){
    if(!this.active||!this.getMap()||!this.getPath())return;
    const stage=$('map'),w=stage.clientWidth||360,h=stage.clientHeight||500;
    for(const marker of this.markers){
      const position=this.getMap().project(pointAt(this.getPath(),marker.frac).coordinate);
      // Keep touch targets reachable when the route goes behind header controls.
      const x=clamp(position.x,42,w-42),y=clamp(position.y,144,h-95);
      marker.button.style.left=x+'px';marker.button.style.top=y+'px';
    }
  }
  collectStar(i){
    if(this.active?.key!=='lights'||this.gathered.has(i))return;
    this.gathered.add(i);
    this.markers[i]?.button.classList.add('magic-star--lit');
    this.markers[i]?.button.setAttribute('aria-label','Estrella encendida');
    this.playSound('star');
    $('quest-progress').textContent=this.gathered.size+' / 3 estrellas';
    if(this.gathered.size===3)this.complete();
  }
  catchStar(){
    if(this.active?.key!=='chase')return;
    this.hops++;this.playSound('star');
    $('quest-progress').textContent=this.hops+' / 3 saltos';
    if(this.hops>=3){this.complete();return;}
    // Each hop is tied to a different point along the ACTUAL clipped route.
    const fractions=[.43,.51,.47];
    this.markers[0].frac=fractions[this.hops];
    const button=this.markers[0].button;
    button.classList.remove('magic-star--jump');
    void button.offsetWidth;
    button.classList.add('magic-star--jump');
    this.positionMarkers();
  }
  startSwipe(e){
    if(this.active?.key!=='portal')return;
    this.swiping=true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    this.moveSwipe(e);
  }
  moveSwipe(e){
    if(!this.swiping||this.active?.key!=='portal')return;
    const el=$('quest-swipe-track');
    const rect=el.getBoundingClientRect(),p=clamp((e.clientX-rect.left)/rect.width,0,1);
    this.slideFraction=p;
    $('quest-swipe-knob').style.left=(p*83)+'%';
    $('quest-swipe-fill').style.width=(p*100)+'%';
  }
  endSwipe(){
    if(!this.swiping)return;
    this.swiping=false;
    if(this.slideFraction>=.76)this.portalDone();else this.resetSwipe();
  }
  resetSwipe(){
    this.swiping=false;this.slideFraction=0;
    $('quest-swipe-knob').style.left='0%';$('quest-swipe-fill').style.width='0%';
  }
  portalDone(){if(this.active?.key==='portal'){this.playSound('portal');this.complete();}}
  complete(){
    if(!this.active)return;
    this.earned.add(this.active.key);
    $('quest-result').textContent='¡Lo has conseguido! ✦';
    this.playSound('success');
    this.say(this.active.key+'Done');
    this.done.add(this.active.key);
    this.updateHud();
    this.timeouts.push(setTimeout(()=>this.finish(true),1100));
  }
  finish(success=false){
    if(!this.active)return;
    const key=this.active.key;
    this.done.add(key);
    if(!success)this.say('skip');
    this.active=null;this.removeMarkers();this.hideChallenge();this.updateHud();
    this.onResume?.();
  }
  removeMarkers(){for(const m of this.markers)m.button.remove();this.markers=[];}
  hideChallenge(){
    $('magic-game').classList.add('hidden');
    $('quest-targets').replaceChildren();
  }
  updateHud(){
    $('mission-hud-count').textContent=this.earned.size+' / 3';
    $('mission-hud-stars').textContent='✦ '.repeat(this.earned.size)+'✧ '.repeat(3-this.earned.size);
    $('arrival-missions').textContent=this.earned.size+' de 3 desafíos mágicos conseguidos';
    $('arrival-badges').replaceChildren();
    for(const badge of finalBadges(this.done,this.earned)){
      const el=document.createElement('span');
      el.textContent=(badge.completed?'✦ ':'✧ ')+badge.name;
      el.className=badge.completed?'earned':'unearned';
      $('arrival-badges').appendChild(el);
    }
  }
  souvenir(){return {stars:this.earned.size,badges:finalBadges(this.done,this.earned)};}
  destroy(){
    this.reset();for(const id of this.timeouts)clearTimeout(id);
    this.timeouts=[];this.cancelSpeech();
  }
}
