import {InactivityTimer} from './inactivity.js';
import * as THREE from 'three';
import {createGameAudio} from './game-audio.js';
import {createKiosk} from './kiosk.js';
import {loadConfig} from './game-config.js';
import {TapGame} from './tap-state.js';
import {createNeonVisuals} from './neon-visuals.js';
const config=await loadConfig();
const $=id=>document.getElementById(id),game=new TapGame(Math.random,config.gameTimeSeconds),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let visuals;
try{visuals=createNeonVisuals($('game'),$('demo-canvas'),reduced);}catch{$('entry-error').textContent='Graphics unavailable. WebGL 2 is required.';$('play').disabled=true;throw Error('WebGL 2 required');}
const {renderer,scene,camera}=visuals;
const palette={good:'#28f4ff',bad:'#ff35c3',gold:'#fff568'};
function mesh(geo,mat,parent){const m=new THREE.Mesh(geo,mat);parent.add(m);return m;}
const nodes=[],effects=[],floats=[];const bitGeo=new THREE.OctahedronGeometry(1,0);
for(let i=0;i<9;i++){
  const slot=document.createElement('div');slot.className='slot';const button=document.createElement('button');button.className='target';button.disabled=true;button.setAttribute('aria-label',`Unlit target ${i+1}`);slot.append(button);$('board').append(slot);
  button.addEventListener('pointerdown',e=>{e.preventDefault();hit(i);});
  const root=new THREE.Group();scene.add(root);const {actor,good,bad,gold,plus,cross,glint,puff}=visuals.createTarget(root,i);
  nodes.push({slot,button,root,actor,good,bad,gold,plus,cross,glint,puff,r:1,x:0,y:0,seen:0,popAt:-10,badHit:false});
}
let clock=0,previous=performance.now(),countdown=0,best=0,ended=false,toastUntil=0,displayScore=0,lastCount=0;
try{best=Number(localStorage.getItem('5k-glow-tap-negative-best'))||0;}catch{}$('best').textContent=String(best);
const audio=createGameAudio({onChange:audioUI});
function audioUI(){const state=audio.status();for(const [id,key,label]of [['music','music','Music'],['sound','sfx','SFX']]){$(id).textContent=label+(state[key]?' on':' off');$(id).setAttribute('aria-pressed',String(state[key]));}}
audioUI();
function updateDuration(){document.querySelectorAll('[data-duration]').forEach(el=>el.textContent=game.roundSeconds);}
updateDuration();
const idle=new InactivityTimer();let flowId=0;
for(const type of ['pointerdown','pointermove','keydown','input','wheel'])addEventListener(type,()=>idle.touch(),{capture:true,passive:true});
setInterval(()=>{if(document.body.dataset.screen!=='results'&&idle.expired())resetEntry();},200);
const kiosk=createKiosk({getIdleRemaining:()=>idle.remaining(),onBegin:showInstructions,onReset:resetEntry,onResults:()=>preview('leader'),onGesture:()=>audio.unlock()});
function preview(mode){$(mode==='tutorial'?'learn-art':mode==='entry'?'entry-art':mode==='leader'?'leader-art':'demo').append($('demo-canvas'));visuals.setPreviewMode(mode);}
async function showInstructions(){const request=++flowId;const current=await loadConfig();if(request!==flowId)return;game.roundSeconds=current.gameTimeSeconds;updateDuration();audio.unlock();audio.setState('instructions');audio.sound('ui');game.reset();game.status='instructions';countdown=0;$('overlay').classList.add('hidden');$('instructions').classList.remove('hidden');$('learn-feedback').className='learn-feedback';$('learn-feedback').textContent='Catch the good energy. Skip the pink ×.';preview('tutorial');}
for(const kind of ['good','gold','bad'])$('learn-'+kind).onclick=()=>{audio.sound(kind==='good'?'tap':kind);visuals.pulsePreview(kind);$('learn-feedback').className='learn-feedback '+(kind==='bad'?'warning':kind==='gold'?'gold':'success');$('learn-feedback').textContent=kind==='bad'?'Pink × costs 30 points. Let it disappear.':kind==='gold'?'Golden stars add 40 points.':'Cyan + adds 10 points.';};
$('learn-start').onclick=()=>{$('instructions').classList.add('hidden');preview('hero');start();};
$('learn-back').onclick=()=>resetEntry(false);
function resetEntry(clear=true){flowId++;idle.touch();document.activeElement?.blur();for(const f of floats)f.el.remove();floats.length=0;for(const e of effects){scene.remove(e.obj);e.obj.material.dispose();}effects.length=0;for(const n of nodes){n.popAt=-10;n.badHit=false;n.button.classList.remove('wrong-feedback');}game.reset();game.status='ready';ended=false;countdown=0;displayScore=0;for(const id of ['instructions','pause-screen','leaderboard','countdown'])$(id).classList.add('hidden');$('overlay').classList.remove('hidden');$('pause').textContent='Pause';$('toast').classList.remove('show');preview('entry');audio.setState('menu');if(clear)kiosk.clear();document.body.dataset.screen='entry';}
function toast(text,kind=''){const el=$('toast');el.textContent=text;el.className='toast show '+kind;toastUntil=clock+1.2;}
function response(index,points,gold,bad=false){
  const n=nodes[index],color=bad?palette.bad:gold?palette.gold:palette.good;n.popAt=clock;n.badHit=bad;visuals.impact(n.x/innerWidth,1-n.y/innerHeight,color);n.puff.material.uniforms.uColor.value.set(color);
  const el=document.createElement('div');el.className='float'+(bad?' bad':gold?' gold':'');el.textContent=bad?'−30':'+'+points;el.style.left=n.x+'px';el.style.top=n.y-n.r*.65+'px';document.body.append(el);floats.push({el,until:clock+.7});
  if(!reduced)for(let j=0;j<(bad?7:14);j++){const obj=mesh(bitGeo,new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(1.8)}),scene);obj.position.set(n.x-innerWidth/2,innerHeight/2-n.y,5);obj.rotation.z=Math.random()*3;const angle=j/14*Math.PI*2;effects.push({obj,age:0,v:new THREE.Vector3(Math.cos(angle)*(65+Math.random()*80),Math.sin(angle)*(65+Math.random()*80),0),size:3+Math.random()*4});}
  if(bad){n.button.classList.remove('wrong-feedback');void n.button.offsetWidth;n.button.classList.add('wrong-feedback');}
}
function hit(index){const points=game.hit(index);if(!points)return;
  for(const e of game.drain()){
    if(e.type==='hit'){response(e.index,e.points,e.gold);audio.sound(e.gold?'gold':'tap',game.combo);if(e.gold){toast(`Little bonus. +${e.points}`,'gold');}}
    if(e.type==='hazard'){response(e.index,e.points,false,true);audio.sound('bad');toast('Oops. −30 · Streak reset','bad');}
    if(e.type==='rush'){toast('You’re in flow. Double points.','gold');audio.sound('rush');}
  }hud(0);
}
function hud(dt){$('pause').disabled=!['playing','paused'].includes(game.status);
  displayScore=reduced?game.score:displayScore+(game.score-displayScore)*(1-Math.exp(-22*dt));if(Math.abs(displayScore-game.score)<.3)displayScore=game.score;
  $('score').textContent=String(Math.round(displayScore));$('time').textContent=Math.ceil(game.remaining)+'s';$('time-group').classList.toggle('urgent',game.remaining<=10&&game.status==='playing');
  $('streak').textContent=game.combo>1?`${game.combo} in a row`:'';$('rush-label').textContent=game.rush>0?`×2 for ${Math.ceil(game.rush)}s`:'Glow Rush';$('rush-hint').textContent=game.rush>0?'Keep skipping ×':`${game.charge}/5`;$('rush-line').classList.toggle('active',game.rush>0);
  document.querySelectorAll('.charge i').forEach((dot,i)=>dot.classList.toggle('on',game.rush>0?i<Math.ceil(game.rush/6*5):i<game.charge));
}
function start(){document.body.dataset.screen='playing';game.reset();game.status='countdown';countdown=1.5;lastCount=3;displayScore=0;ended=false;for(const n of nodes){n.seen=0;n.popAt=-10;}$('overlay').classList.add('hidden');$('countdown').classList.remove('hidden');$('countdown').textContent='3';$('pause').textContent='Pause';$('toast').classList.remove('show');audio.setState('countdown');audio.sound('tick');}
function pause(){if(!['playing','paused'].includes(game.status))return;game.pause();audio.setState(game.status);$('pause-screen').classList.toggle('hidden',game.status!=='paused');$('pause').textContent=game.status==='paused'?'Resume':'Pause';}
function finish(){if(ended)return;ended=true;displayScore=game.score;best=Math.max(best,game.score);try{localStorage.setItem('5k-glow-tap-negative-best',best);}catch{}$('best').textContent=String(best);audio.setState('results');audio.sound('finish');kiosk.finish(game.score);}
$('resume').onclick=pause;$('pause').onclick=pause;$('music').onclick=()=>{audio.unlock();audio.toggleMusic();};$('sound').onclick=()=>{audio.unlock();audio.toggleSfx();audio.sound('ui');};$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}};
addEventListener('keydown',e=>{if(e.repeat||e.target instanceof HTMLInputElement)return;if(e.code==='KeyP')pause();if(/^[1-9]$/.test(e.key))hit(+e.key-1);});document.addEventListener('visibilitychange',()=>{if(document.hidden){if(game.status==='playing')pause();audio.setState('hidden');}else audio.setState(game.status==='ready'?'menu':game.status);});
function resize(){visuals.resize(innerWidth,innerHeight);for(const n of nodes){const r=n.slot.getBoundingClientRect();n.x=r.x+r.width/2;n.y=r.y+r.height/2;n.r=Math.min(r.width*.31,r.height*.35,72);const size=Math.min(r.width,r.height,n.r*1.8+20);n.button.style.width=size+'px';n.button.style.height=size+'px';n.root.position.set(n.x-innerWidth/2,innerHeight/2-n.y,0);n.root.scale.setScalar(n.r);}}
addEventListener('resize',resize);resize();preview('entry');
function spring(t){const c=1.65;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);}
function frame(now){
  const raw=document.hidden?0:Math.max(0,(now-previous)/1000),dt=Math.min(raw,.05);previous=now;if(game.status!=='paused')clock+=dt;
  if(countdown>0){countdown-=raw;const value=Math.max(1,Math.ceil(countdown/.5));$('countdown').textContent=String(value);if(value!==lastCount){lastCount=value;audio.sound('tick');}if(countdown<=0){$('countdown').classList.add('hidden');game.start();audio.setState('playing');audio.sound('go');}}
  game.tick(raw);game.drain();hud(dt);
  for(let i=0;i<9;i++){
    const n=nodes[i],target=game.targets.find(t=>t.index===i&&!t.hit),since=clock-n.popAt,badFeedback=!target&&n.badHit&&since>=0&&since<.22,bad=!!target?.hazard||badFeedback,gold=!!target?.gold;
    n.button.disabled=!target||game.status!=='playing';n.button.setAttribute('aria-label',target?`${bad?'Avoid pink X':gold?'Gold bonus':'Tap cyan plus'} target ${i+1}`:`Unlit target ${i+1}`);n.actor.visible=!!target||badFeedback;
    n.good.visible=!!target&&!bad&&!gold;n.bad.visible=bad;n.gold.visible=gold;n.plus.visible=!!target&&!bad&&!gold;n.cross.visible=bad;n.glint.visible=gold;
    if(target){const entry=Math.min(1,target.age/.18),exit=Math.min(1,Math.max(0,(target.life-target.age)/.18)),scale=reduced?exit:spring(entry)*exit;n.actor.scale.setScalar(scale);n.actor.rotation.z=reduced?0:(1-entry)*(bad?-.15:.15);}
    if(badFeedback){n.actor.scale.setScalar(1-since/.22*.8);n.actor.rotation.z=reduced?0:Math.sin(since*70)*.13;}
    n.puff.visible=since>=0&&since<.45;n.puff.material.uniforms.uProgress.value=Math.max(0,Math.min(1,since/.45));
  }
  for(let i=effects.length-1;i>=0;i--){const e=effects[i];if(game.status!=='paused'){e.age+=dt;e.obj.position.addScaledVector(e.v,dt);e.v.y-=dt*90;e.obj.rotation.z+=dt*2;e.obj.scale.setScalar(e.size*Math.max(0,1-e.age/.4));}if(e.age>.4){scene.remove(e.obj);e.obj.material.dispose();effects.splice(i,1);}}
  for(let i=floats.length-1;i>=0;i--)if(clock>floats[i].until){floats[i].el.remove();floats.splice(i,1);}if(clock>toastUntil)$('toast').classList.remove('show');if(game.status==='ended')finish();audio.setRush(game.rush>0);visuals.update(clock,dt,game.rush>0,audio.beat());visuals.render();requestAnimationFrame(frame);
}requestAnimationFrame(frame);
