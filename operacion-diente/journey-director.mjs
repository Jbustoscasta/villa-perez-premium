/**
 * Operación Diente Perdido v0.7 · director de una película infantil sin minijuegos.
 * Las estrellas se obtienen automáticamente a lo largo de las calles reales.
 * La voz oficial, si existe, debe venir de una grabación expresamente aprobada.
 */
export const STORY_STARS=Object.freeze([
  {key:'salida',at:.21,name:'La luz de Villa Pérez'},
  {key:'camino',at:.54,name:'El resplandor de la ciudad'},
  {key:'llegada',at:.91,name:'La estrella de los sueños'}
]);
export const NARRATION=Object.freeze({
  intro:'¡Atención! ¡Ha caído un diente! ¡Preparad la mochila!',
  depart:'¡Ya he salido de Villa Pérez! ¡Qué bonita se ve la ciudad!',
  halfway:'¡Las calles brillan a nuestro paso! ¡Cada vez falta menos!',
  near:'¡Ya casi estoy! Pero hay una regla muy importante: nadie puede verme entrar.',
  scenic:'¡Mira qué lugar tan especial! La ciudad está preciosa.',
  done:'¡Misión completada! Gracias por acompañarme. He guardado un recuerdo de nuestro viaje.',
  morning:'¡Buenos días! Gracias por ayudarme a llegar. Este es el recuerdo de nuestra aventura.'
});
export const MEMENTO_KEY='vp-morning-memento-v1';
export function earnedStoryStars(progress){
  const fraction=Math.max(0,Math.min(1,Number(progress)||0));
  return STORY_STARS.filter(s=>fraction>=s.at);
}
export function nextMorningTime(from=new Date()){
  const d=new Date(from);
  d.setDate(d.getDate()+1);
  d.setHours(6,0,0,0);
  return d.getTime();
}
export function makeMemento({clinic,distanceMeters,stars,now=new Date()}){
  return {
    version:1,createdAt:now.getTime(),readyAt:nextMorningTime(now),
    clinic:String(clinic||'Tu clínica dental').slice(0,65),
    distanceMeters:Math.max(0,Math.round((Number(distanceMeters)||0)/500)*500),
    stars:Math.max(0,Math.min(3,Math.round(Number(stars)||0)))
  };
}
export function safeMemento(value,now=new Date()){
  if(!value||value.version!==1||typeof value.clinic!=='string'||!Number.isFinite(value.readyAt)||!Number.isFinite(value.createdAt))return null;
  if(value.createdAt>now.getTime()+60000||now.getTime()-value.createdAt>1000*60*60*24*15)return null;
  if(value.readyAt<value.createdAt||value.readyAt>value.createdAt+1000*60*60*48)return null;
  if(!Number.isFinite(value.distanceMeters)||value.distanceMeters<0||value.distanceMeters>1000000)return null;
  if(!Number.isFinite(value.stars)||value.stars<0||value.stars>3)return null;
  return {version:1,createdAt:value.createdAt,readyAt:value.readyAt,clinic:value.clinic.slice(0,65),distanceMeters:value.distanceMeters,stars:value.stars};
}
const $=id=>document.getElementById(id);
export class JourneyDirector{
  constructor({onReward,getAudioUrls}={}){
    this.onReward=onReward;this.getAudioUrls=getAudioUrls;
    this.earned=new Set();this.spoken=new Set();this.active=null;
    this.sound=false;this.audioContext=null;this.voiceAudio=null;this.ambience=null;this.timeouts=[];this.lastCue='intro';
    $('narrate-again')?.addEventListener('click',()=>this.say(this.lastCue,true));
    this.updateHud();
  }
  attachMap(map){this.map=map;}
  reset(){
    this.earned.clear();this.spoken.clear();this.active=null;
    this.cancelSpeech();this.setAmbient(false);this.updateHud();
  }
  setAudio(enabled,context){
    this.sound=Boolean(enabled);if(context)this.audioContext=context;
    if(!this.sound){this.cancelSpeech();this.setAmbient(false);}
    if($('voice-status'))$('voice-status').textContent=this.sound?'Narración de prueba activada · sonido opcional':'Activa la voz y sonidos mágicos ♪';
  }
  setAmbient(playing){
    if(!playing||!this.sound||!this.audioContext){this.stopAmbient();return;}
    if(this.ambience)return;
    try {
      const ctx=this.audioContext,gain=ctx.createGain();
      gain.gain.value=.0001;gain.connect(ctx.destination);
      const notes=[164.81,246.94],oscillators=notes.map(freq=>{
        const o=ctx.createOscillator();o.type='sine';o.frequency.value=freq;o.connect(gain);o.start();return o;
      });
      gain.gain.setTargetAtTime(.006,ctx.currentTime,.4);
      this.ambience={oscillators,gain,ctx};
    }catch(e){console.warn('Ambiente no disponible',e)}
  }
  stopAmbient(){
    if(!this.ambience)return;
    const {oscillators,gain,ctx}=this.ambience;this.ambience=null;
    try {
      gain.gain.setTargetAtTime(.0001,ctx.currentTime,.08);
      const timeout=setTimeout(()=>{for(const o of oscillators)try{o.stop();o.disconnect()}catch{}try{gain.disconnect()}catch{}},500);
      this.timeouts.push(timeout);
    }catch{}
  }
  cancelSpeech(){
    if(this.voiceAudio){
      try{this.voiceAudio.pause();this.voiceAudio.currentTime=0;}catch{}
      this.voiceAudio=null;
    }
    try{window.speechSynthesis?.cancel()}catch{}
  }
  say(key,repeat=false){
    this.lastCue=key;
    if(!this.sound)return;
    if(!repeat&&this.spoken.has(key))return;
    this.spoken.add(key);
    const words=NARRATION[key];
    if(!words)return;
    this.cancelSpeech();
    const url=this.getAudioUrls?.()?.[key];
    if(url){
      const sound=new Audio(url);sound.volume=.85;this.voiceAudio=sound;
      sound.play().catch(()=>this.demoVoice(words));
    }else this.demoVoice(words);
  }
  demoVoice(words){
    // System voice is clearly a DEMO, never represented as the brand's official character voice.
    if(!window.speechSynthesis||typeof SpeechSynthesisUtterance==='undefined')return;
    try{
      const message=new SpeechSynthesisUtterance(words);
      message.lang='es-ES';message.rate=.93;message.pitch=1.02;message.volume=.88;
      const voices=window.speechSynthesis.getVoices();
      message.voice=voices.find(v=>v.lang?.toLowerCase().startsWith('es')&&/premium|enhanced/i.test(v.name))||
        voices.find(v=>v.lang?.toLowerCase().startsWith('es'))||null;
      window.speechSynthesis.speak(message);
    }catch(e){console.warn('Narración de prueba no disponible',e)}
  }
  playTone(){
    if(!this.sound||!this.audioContext)return;
    const ctx=this.audioContext,now=ctx.currentTime;
    [784,1046,1318].forEach((freq,i)=>{
      try{
        const osc=ctx.createOscillator(),gain=ctx.createGain();
        osc.type='sine';osc.frequency.setValueAtTime(freq,now+i*.09);
        gain.gain.setValueAtTime(.0001,now+i*.09);
        gain.gain.exponentialRampToValueAtTime(.027,now+i*.09+.015);
        gain.gain.exponentialRampToValueAtTime(.0001,now+i*.09+.24);
        osc.connect(gain);gain.connect(ctx.destination);
        osc.start(now+i*.09);osc.stop(now+i*.09+.27);
      }catch{}
    });
  }
  tick(progress){
    for(const star of earnedStoryStars(progress)){
      if(!this.earned.has(star.key)){
        this.earned.add(star.key);this.updateHud();this.onReward?.(star.key);this.playTone();
      }
    }
    return false; // Never pauses the film. No challenges or game input.
  }
  updateHud(){
    const n=this.earned.size;
    if($('mission-hud-count'))$('mission-hud-count').textContent=n+' / 3';
    if($('mission-hud-stars'))$('mission-hud-stars').textContent='✦ '.repeat(n)+'✧ '.repeat(3-n);
    if($('arrival-missions'))$('arrival-missions').textContent=n+' de 3 estrellas del viaje iluminadas';
    const b=$('arrival-badges');if(b){
      b.replaceChildren();
      for(const st of STORY_STARS){
        const el=document.createElement('span');el.className=this.earned.has(st.key)?'earned':'unearned';
        el.textContent=(this.earned.has(st.key)?'✦ ':'✧ ')+st.name;b.appendChild(el);
      }
    }
  }
  souvenir(){return {stars:this.earned.size};}
  destroy(){
    this.reset();for(const id of this.timeouts)clearTimeout(id);
    this.timeouts=[];
  }
}
