export class InactivityTimer {
 constructor(timeoutMs=10000,now=()=>Date.now()){this.timeoutMs=timeoutMs;this.now=now;this.touch();}
 touch(){this.lastActivity=this.now();}
 remaining(){return Math.max(0,this.timeoutMs-(this.now()-this.lastActivity));}
 expired(){return this.remaining()===0;}
}
