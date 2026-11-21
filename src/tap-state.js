// Game pace: 1 = original speed. 1.25 = objects stay 25% longer and appear 25% less often.
export const PACE=1.25;
export class TapGame {
  constructor(random=Math.random,roundSeconds=30){this.roundSeconds=roundSeconds;this.random=random;this.status='ready';this.reset();}
  reset(){this.score=0;this.remaining=this.roundSeconds;this.elapsed=0;this.targets=[];this.serial=0;this.spawnIn=.15;this.combo=0;this.bestCombo=0;this.hits=0;this.misses=0;this.mistakes=0;this.rush=0;this.charge=0;this.events=[];this.spawns=0;this.rushes=0;}
  start(){this.reset();this.status='playing';}
  drain(){return this.events.splice(0);}
  pause(){if(this.status==='playing')this.status='paused';else if(this.status==='paused')this.status='playing';}
  spawn(){const available=Array.from({length:9},(_,i)=>i).filter(i=>!this.targets.some(t=>t.index===i));if(!available.length)return;const index=available[Math.floor(this.random()*available.length)];this.spawns++;const gold=this.spawns%7===0;const hazard=!gold&&this.elapsed>2&&this.random()<.24&&this.targets.filter(t=>t.hazard&&!t.hit).length<(this.rush>0?2:1);this.targets.push({id:++this.serial,index,gold,hazard,age:0,life:PACE*(gold?1.25:Math.max(1.25,1.9-this.elapsed*.007)),hit:false});}
  tick(dt){if(this.status!=='playing'||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,this.remaining);this.elapsed+=dt;this.remaining=Math.max(0,this.remaining-dt);this.rush=Math.max(0,this.rush-dt);for(const t of this.targets)t.age+=dt;
    const missed=this.targets.filter(t=>!t.hit&&!t.hazard&&t.age>=t.life);if(missed.length){this.misses+=missed.length;this.combo=0;if(!this.rush)this.charge=Math.max(0,this.charge-1);this.events.push({type:'miss'});}
    this.targets=this.targets.filter(t=>t.age<t.life);if(!this.remaining){this.status='ended';this.targets=[];return;}
    this.spawnIn-=dt;if(this.spawnIn<=0){if(this.targets.filter(t=>!t.hit).length<(this.rush>0?5:3))this.spawn();this.spawnIn=PACE*(this.rush>0?.26:Math.max(.45,.65-this.elapsed*.003));}
  }
  hit(index){if(this.status!=='playing')return 0;const target=this.targets.find(t=>t.index===index&&!t.hit&&t.age<t.life);if(!target)return 0;target.hit=true;target.life=target.age+.16;if(target.hazard){const lost=Math.min(30,this.score);this.score-=lost;this.mistakes++;this.combo=0;this.charge=0;this.rush=0;this.events.push({type:'hazard',index,points:-lost});return -30;}const points=(target.gold?40:10)*(this.rush>0?2:1);this.score+=points;this.hits++;this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.events.push({type:'hit',index,points,gold:target.gold});if(!this.rush){this.charge++;if(this.charge>=5){this.charge=0;this.rush=6;this.rushes++;this.events.push({type:'rush'});}}return points;}
}
