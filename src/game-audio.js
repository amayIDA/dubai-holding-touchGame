const midi=n=>440*2**((n-69)/12);
const CHORDS=[[57,60,64,67],[53,57,60,64],[60,64,67,71],[55,59,62,65]];
const ROOTS=[45,41,48,43];

// An original four-bar house/synth loop. Each step is one sixteenth note.
export function musicStep(absoluteStep,rush=false,soft=false){
  const step=absoluteStep%16,bar=Math.floor(absoluteStep/16)%4,chord=CHORDS[bar],events=[];
  if(step===0)events.push({type:'pad',notes:chord.map(midi),duration:1.95,gain:.018});
  if(!soft&&step%4===0)events.push({type:'kick',gain:.42});
  if(!soft&&[4,12].includes(step))events.push({type:'clap',gain:.075});
  if(!soft&&(step%2===0||rush))events.push({type:'hat',gain:step%4===2?.045:.025});
  if([0,6,8,14].includes(step))events.push({type:'bass',freq:midi(ROOTS[bar]+(step===14?12:0)),duration:.21,gain:.14});
  if([2,6,10,14].includes(step)||rush&&step%2===1){const order=[0,2,1,3,2,1,3,2][Math.floor(step/2)];events.push({type:'pluck',freq:midi(chord[order]+12),duration:.17,gain:soft?.025:.048});}
  return events;
}

export function createGameAudio({contextFactory,onChange=()=>{}}={}){
  let context,musicBus,sfxBus,master,filter,delay,noise,interval;
  let state='menu',music=true,sfx=true,rush=false,nextTime=0,step=0,lastBeat=-100,scheduled=0;
  try{const saved=JSON.parse(localStorage.getItem('glow-audio-settings')||'null');if(saved){music=saved.music!==false;sfx=saved.sfx!==false;}}catch{}
  const tempo=116,stepSeconds=60/tempo/4;
  function persist(){try{localStorage.setItem('glow-audio-settings',JSON.stringify({music,sfx}));}catch{}onChange(status());}
  function status(){return{music,sfx,state,context:context?.state||'locked',scheduled};}
  function active(){return music&&!['paused','hidden'].includes(state);}
  function gainTo(param,value){if(!context)return;param.cancelScheduledValues(context.currentTime);param.setTargetAtTime(value,context.currentTime,.08);}
  function levels(){if(!context)return;gainTo(musicBus.gain,active()?(state==='playing'?(rush?.4:.31):.16):0);gainTo(sfxBus.gain,sfx?.65:0);filter.frequency.setTargetAtTime(state==='playing'?(rush?17000:12500):5500,context.currentTime,.3);}
  function init(){
    const Audio=contextFactory||(()=>new(window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'}));context=Audio();
    master=context.createGain();master.gain.value=.7;const limiter=context.createDynamicsCompressor();limiter.threshold.value=-12;limiter.knee.value=14;limiter.ratio.value=5;limiter.attack.value=.005;limiter.release.value=.14;master.connect(limiter);limiter.connect(context.destination);
    musicBus=context.createGain();musicBus.gain.value=0;filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=12500;musicBus.connect(filter);filter.connect(master);
    delay=context.createDelay(.6);delay.delayTime.value=60/tempo*.75;const feedback=context.createGain();feedback.gain.value=.23;const wet=context.createGain();wet.gain.value=.13;filter.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(wet);wet.connect(master);
    sfxBus=context.createGain();sfxBus.gain.value=sfx?.65:0;sfxBus.connect(master);
    noise=context.createBuffer(1,context.sampleRate*2,context.sampleRate);const samples=noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
    nextTime=context.currentTime+.06;levels();interval=setInterval(schedule,25);interval.unref?.();context.onstatechange=()=>onChange(status());
  }
  function unlock(){try{if(!context)init();context.resume().then(()=>onChange(status())).catch(()=>{});levels();}catch{onChange(status());}}
  function oscillator(freq,t,length,gain,type,bus,attack=.008,finishFreq){
    const osc=context.createOscillator(),env=context.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,t);if(finishFreq)osc.frequency.exponentialRampToValueAtTime(finishFreq,t+length);env.gain.setValueAtTime(.0001,t);env.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),t+attack);env.gain.exponentialRampToValueAtTime(.0001,t+length);osc.connect(env);env.connect(bus);osc.start(t);osc.stop(t+length+.02);
  }
  function hiss(t,length,gain,freq,kind='highpass',bus=musicBus){
    const source=context.createBufferSource(),eq=context.createBiquadFilter(),env=context.createGain();source.buffer=noise;eq.type=kind;eq.frequency.value=freq;eq.Q.value=.7;env.gain.setValueAtTime(gain,t);env.gain.exponentialRampToValueAtTime(.0001,t+length);source.connect(eq);eq.connect(env);env.connect(bus);source.start(t);source.stop(t+length+.02);
  }
  function voice(event,t){
    if(event.type==='pad')for(const freq of event.notes)oscillator(freq,t,event.duration,event.gain,'sine',musicBus,.08);
    if(event.type==='kick')oscillator(145,t,.2,event.gain,'sine',musicBus,.004,43);
    if(event.type==='clap'){hiss(t,.115,event.gain,1600,'bandpass');hiss(t+.018,.08,event.gain*.55,2200,'bandpass');}
    if(event.type==='hat')hiss(t,.055,event.gain,8200);
    if(event.type==='bass'){oscillator(event.freq,t,event.duration,event.gain,'triangle',musicBus);oscillator(event.freq/2,t,event.duration,event.gain*.25,'sine',musicBus);}
    if(event.type==='pluck'){oscillator(event.freq,t,event.duration,event.gain,'sine',musicBus);oscillator(event.freq*2,t,event.duration*.7,event.gain*.15,'sine',musicBus);}
  }
  function schedule(){
    if(!context||context.state!=='running'||!active())return;
    if(nextTime<context.currentTime-.15)nextTime=context.currentTime+.04;
    let count=0;while(nextTime<context.currentTime+.11&&count++<12){
      for(const event of musicStep(step,rush,state!=='playing')){voice(event,nextTime);scheduled++;}
      if(step%4===0)lastBeat=nextTime;nextTime+=stepSeconds;step++;
    }
  }
  function setState(value){const wasActive=active();state=value;if(context&&active()&&!wasActive)nextTime=context.currentTime+.045;levels();onChange(status());}
  function setRush(value){if(rush===value)return;rush=value;levels();}
  function toggleMusic(){unlock();const was=music;music=!music;if(context&&music&&!was)nextTime=context.currentTime+.045;levels();persist();return music;}
  function toggleSfx(){unlock();sfx=!sfx;levels();persist();return sfx;}
  function beat(){if(!context||!active()||context.state!=='running')return 0;const age=context.currentTime-lastBeat;return age>=0&&age<.5?Math.exp(-age*9):0;}
  function sound(name,combo=1){
    if(!sfx)return;unlock();if(!context)return;const t=context.currentTime+.005;
    if(name==='tap'){const freq=[659.25,783.99,880,1046.5,1318.5][Math.max(0,combo-1)%5];oscillator(freq,t,.13,.13,'sine',sfxBus);oscillator(freq*2,t,.08,.022,'sine',sfxBus);}
    if(name==='gold')for(const[freq,i]of [880,1318.5,1760].map((f,i)=>[f,i]))oscillator(freq,t+i*.045,.24,.1,'sine',sfxBus);
    if(name==='bad'){oscillator(196,t,.18,.12,'triangle',sfxBus,.004,82);oscillator(185,t,.15,.045,'sine',sfxBus,.005,78);}
    if(name==='rush'){[659.25,783.99,880,1046.5,1318.5].forEach((freq,i)=>oscillator(freq,t+i*.035,.23,.085,'sine',sfxBus));hiss(t,.35,.055,4500,'bandpass',sfxBus);}
    if(name==='tick')oscillator(440,t,.08,.065,'sine',sfxBus);
    if(name==='go'){[523.25,659.25,880].forEach((freq,i)=>oscillator(freq,t+i*.04,.2,.08,'sine',sfxBus));}
    if(name==='finish'){[523.25,659.25,783.99,1046.5].forEach((freq,i)=>oscillator(freq,t+i*.075,.32,.09,'sine',sfxBus));}
    if(name==='ui')oscillator(330,t,.08,.04,'sine',sfxBus,.006,440);
  }
  function destroy(){if(interval)clearInterval(interval);context?.close();}
  return{unlock,status,setState,setRush,toggleMusic,toggleSfx,beat,sound,destroy,schedule};
}
