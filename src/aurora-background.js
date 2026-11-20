import * as THREE from 'three';
export function createAuroraBackground(scene){
  const material=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uAspect:{value:1},uBeat:{value:0},uRush:{value:0},uImpact:{value:8},uImpactPos:{value:new THREE.Vector2(.5,.5)},uImpactColor:{value:new THREE.Color('#28f4ff')}},
    depthWrite:false,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`
      uniform float uTime,uAspect,uBeat,uRush,uImpact;
      uniform vec2 uImpactPos;
      uniform vec3 uImpactColor;
      varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 uv=vUv-.5;uv.x*=uAspect;
        float t=uTime*.16;
        vec3 color=vec3(.0035,.0025,.012);
        float edge=smoothstep(.1,.75,length(uv*vec2(.7,1.1)));
        float path1=.29*sin(uv.x*1.4+t)+.12*sin(uv.x*3.1-t*.8)-.14;
        float path2=.22*cos(uv.x*1.8-t*.8)+.14*sin(uv.x*2.2+t*.6)+.16;
        float a=abs(uv.y-path1),b=abs(uv.y-path2);
        float curtain=exp(-a*9.0)*(.07+edge*.14)+exp(-a*70.0)*.025;
        float violet=exp(-b*8.0)*(.06+edge*.12)+exp(-b*65.0)*.018;
        float movement=.72+.28*sin(uv.x*3.0+t*1.5);
        color+=vec3(.018,.28,.48)*curtain*movement;
        color+=mix(vec3(.18,.025,.4),vec3(.44,.018,.22),.5+.5*sin(uv.x+t))*violet;
        float ribbon=exp(-abs(uv.y+.32+sin(uv.x*2.0-t)*.1)*21.0);
        color+=vec3(.025,.14,.26)*ribbon*.12;
        vec2 drift=vUv+vec2(sin(uTime*.04)*.02,uTime*.006);
        vec2 cell=floor(drift*vec2(24.,16.)),local=fract(drift*vec2(24.,16.));
        vec2 center=vec2(hash(cell),hash(cell+19.));
        float seed=hash(cell+51.);
        float dotGlow=exp(-length((local-center)*vec2(uAspect*.7,1.))*48.0)*step(.88,seed);
        color+=vec3(.15,.3,.55)*dotGlow*(.3+.2*sin(uTime*.8+seed*20.));
        color*=1.0+uBeat*.14+uRush*.25;
        vec2 hit=vUv-uImpactPos;hit.x*=uAspect;
        float ring=exp(-pow((length(hit)-uImpact*.23)*80.0,2.0))*max(0.,1.-uImpact/1.4);
        color+=uImpactColor*ring*.055;
        float vignette=1.0-smoothstep(.35,1.1,length((vUv-.5)*1.3))*.45;
        gl_FragColor=vec4(color*vignette,1.0);
      }
    `
  });
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);plane.position.z=-500;plane.renderOrder=-100;plane.frustumCulled=false;scene.add(plane);
  let time=0,impactAt=-10;
  function resize(w,h){plane.scale.set(w/2,h/2,1);material.uniforms.uAspect.value=w/h;}
  function update(t,{beat=0,rush=false,reduced=false}={}){time=t;material.uniforms.uTime.value=reduced?0:t;material.uniforms.uBeat.value=reduced?0:beat;material.uniforms.uRush.value=rush?1:0;material.uniforms.uImpact.value=t-impactAt;}
  function impact(x,y,color){impactAt=time;material.uniforms.uImpactPos.value.set(x,y);material.uniforms.uImpactColor.value.set(color);}
  return{resize,update,impact};
}
