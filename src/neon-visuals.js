import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createAuroraBackground} from './aurora-background.js';

const BACKGROUND='#09081d';
const vertexShader=`
  uniform float uTime;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main(){
    vLocal=position;
    float wave=sin(position.y*5.0+uTime*1.7)*sin(position.x*4.0-uTime)*0.008;
    vec3 p=position+normal*wave;
    vec4 world=modelMatrix*vec4(p,1.0);
    vWorld=world.xyz;
    vNormal=normalize(mat3(modelMatrix)*normal);
    gl_Position=projectionMatrix*viewMatrix*world;
  }
`;
const fragmentShader=`
  uniform float uTime;
  uniform float uRush;
  uniform vec3 uA;
  uniform vec3 uB;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main(){
    vec3 normal=normalize(vNormal);
    vec3 viewDir=normalize(cameraPosition-vWorld);
    float fresnel=pow(1.0-abs(dot(normal,viewDir)),2.0);
    float diffuse=max(dot(normal,normalize(vec3(-0.45,0.65,1.0))),0.0);
    float flow=0.5+0.5*sin(vLocal.y*3.0+vLocal.x*2.5-uTime*0.9);
    vec3 base=mix(uA,uB,flow*0.6);
    float scan=smoothstep(0.9,1.0,sin(vLocal.y*62.0+vLocal.z*14.0-uTime*3.1));
    float caustic=pow(0.5+0.5*sin(vLocal.x*9.0+sin(vLocal.y*7.0+uTime)*2.0-uTime*1.5),12.0);
    float shine=pow(max(dot(reflect(-normalize(vec3(-0.45,0.65,1.0)),normal),viewDir),0.0),38.0);
    vec3 color=base*(0.32+diffuse*0.72+fresnel*(1.4+uRush*0.35));
    color+=mix(base,vec3(1.0),0.36)*(scan*0.12+caustic*0.16+shine*0.7);
    gl_FragColor=vec4(color,1.0);
  }
`;
function material(a,b){return new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uRush:{value:0},uA:{value:new THREE.Color(a)},uB:{value:new THREE.Color(b)}},vertexShader,fragmentShader});}
function plusShape(){const s=new THREE.Shape();[[-.22,.8],[.22,.8],[.22,.22],[.8,.22],[.8,-.22],[.22,-.22],[.22,-.8],[-.22,-.8],[-.22,-.22],[-.8,-.22],[-.8,.22],[-.22,.22]].forEach((p,i)=>i?s.lineTo(...p):s.moveTo(...p));s.closePath();return s;}
function starShape(){const s=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?.41:.91;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?s.lineTo(x,y):s.moveTo(x,y);}s.closePath();return s;}
function extrude(shape){const geo=new THREE.ExtrudeGeometry(shape,{depth:.3,bevelEnabled:true,bevelThickness:.075,bevelSize:.075,bevelSegments:4,curveSegments:12});geo.translate(0,0,-.15);return geo;}

export function createNeonVisuals(canvas,demoCanvas,reduced){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  const scene=new THREE.Scene();scene.background=new THREE.Color(BACKGROUND);
  const background=createAuroraBackground(scene);
  const camera=new THREE.OrthographicCamera(-innerWidth/2,innerWidth/2,innerHeight/2,-innerHeight/2,.1,2000);camera.position.z=1000;
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.55,.34,.92);composer.addPass(bloom);composer.addPass(new OutputPass());
  const materials={good:material('#28f4ff','#176bff'),bad:material('#ff35c3','#a22aff'),gold:material('#fff568','#ff9829')};
  const plusGeo=extrude(plusShape()),starGeo=extrude(starShape()),sparkGeo=new THREE.OctahedronGeometry(.028,0);
  const sparks={good:new THREE.MeshBasicMaterial({color:new THREE.Color('#28eaff').multiplyScalar(1.7)}),bad:new THREE.MeshBasicMaterial({color:new THREE.Color('#ff35c3').multiplyScalar(1.5)}),gold:new THREE.MeshBasicMaterial({color:new THREE.Color('#ffe962').multiplyScalar(1.6)})};
  const items=[];
  function object(kind,phase=0){
    const group=new THREE.Group(),body=new THREE.Mesh(kind==='gold'?starGeo:plusGeo,materials[kind]);group.add(body);if(kind==='bad')body.rotation.z=Math.PI/4;
    const orbit=[];for(let i=0;i<5;i++){const p=new THREE.Mesh(sparkGeo,sparks[kind]);group.add(p);orbit.push(p);}
    items.push({group,body,orbit,kind,phase});return group;
  }
  const shockVertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
  const shockFragment=`uniform float uProgress;uniform vec3 uColor;varying vec2 vUv;void main(){vec2 uv=vUv-.5;float d=length(uv)*2.0;float r=mix(.14,.96,uProgress);float ring=1.0-smoothstep(.012,.07,abs(d-r));float streak=.78+.22*sin(atan(uv.y,uv.x)*8.0+uProgress*5.0);float alpha=ring*streak*(1.0-uProgress)*.52;gl_FragColor=vec4(uColor*1.65,alpha);}`;
  const shockGeo=new THREE.PlaneGeometry(2.7,2.7);
  function createTarget(root,index){
    const actor=new THREE.Group();root.add(actor);const good=object('good',index),bad=object('bad',index+.5),gold=object('gold',index+1);actor.add(good,bad,gold);
    const plus=new THREE.Group(),cross=new THREE.Group(),glint=new THREE.Group();actor.add(plus,cross,glint);
    const puff=new THREE.Mesh(shockGeo,new THREE.ShaderMaterial({uniforms:{uProgress:{value:1},uColor:{value:new THREE.Color('#28eaff')}},vertexShader:shockVertex,fragmentShader:shockFragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));puff.position.z=-10;root.add(puff);
    return{actor,good,bad,gold,plus,cross,glint,puff};
  }
  // The intro uses the same meshes and materials as the playable objects.
  const demoRenderer=new THREE.WebGLRenderer({canvas:demoCanvas,antialias:true,alpha:true});demoRenderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));demoRenderer.toneMapping=THREE.ACESFilmicToneMapping;demoRenderer.toneMappingExposure=1.05;
  demoRenderer.setClearColor(0x000000,0);
  const demoScene=new THREE.Scene();
  const demoCamera=new THREE.OrthographicCamera(-2,2,2,-2,.1,30);demoCamera.position.z=8;
  const demoComposer=new EffectComposer(demoRenderer);demoComposer.addPass(new RenderPass(demoScene,demoCamera));const demoBloom=new UnrealBloomPass(new THREE.Vector2(350,360),.5,.28,.98);demoComposer.addPass(demoBloom);demoComposer.addPass(new OutputPass());
  const previews=['good','bad','gold'].map((kind,i)=>{const group=object(kind,i+8);demoScene.add(group);return group;});
  const ambience=[object('good',21),object('gold',22)];ambience.forEach(g=>{scene.add(g);g.visible=false;});
  let demoWidth=0,demoHeight=0,previewMode='hero',previewTime=0,previewHit={kind:'',at:-10};
  function resizeDemo(){const w=demoCanvas.clientWidth,h=demoCanvas.clientHeight;if(w<2||h<2||w===demoWidth&&h===demoHeight)return;demoWidth=w;demoHeight=h;demoRenderer.setSize(w,h,false);demoComposer.setSize(w,h);const aspect=w/h;
    previews.forEach(g=>g.visible=true);
    if(['entry','leader'].includes(previewMode)){Object.assign(demoCamera,{left:-3*aspect,right:3*aspect,top:3,bottom:-3});previews[1].visible=false;previews[0].position.set(-3*aspect+.95,aspect<1?1.5:.25,0);previews[2].position.set(3*aspect-.95,aspect<1?-1.5:-.5,0);previews[0].scale.setScalar(aspect<1?.4:.64);previews[2].scale.setScalar(aspect<1?.33:.55);}
    else if(previewMode==='tutorial'){Object.assign(demoCamera,{left:-2.4,right:2.4,top:2.4/aspect,bottom:-2.4/aspect});previews[0].position.set(-1.6,0,0);previews[2].position.set(0,0,0);previews[1].position.set(1.6,0,0);previews.forEach(g=>g.scale.setScalar(.53));}
    else if(aspect>1.5){Object.assign(demoCamera,{left:-2.3,right:2.3,top:2.3/aspect,bottom:-2.3/aspect});previews[0].position.set(-1.35,.25,0);previews[1].position.set(1.35,.25,0);previews[2].position.set(0,-.3,0);previews.forEach(g=>g.scale.setScalar(.66));}
    else{Object.assign(demoCamera,{left:-2*aspect,right:2*aspect,top:2,bottom:-2});previews[0].position.set(-.65,.8,0);previews[1].position.set(.75,-.2,0);previews[2].position.set(-.6,-1,0);previews[0].scale.setScalar(.78);previews[1].scale.setScalar(.65);previews[2].scale.setScalar(.58);}
    previews.forEach(g=>g.userData.baseY=g.position.y);demoCamera.updateProjectionMatrix();
  }
  function resize(w,h){renderer.setSize(w,h);composer.setSize(w,h);Object.assign(camera,{left:-w/2,right:w/2,top:h/2,bottom:-h/2});camera.updateProjectionMatrix();background.resize(w,h);resizeDemo();}
  function update(time,dt,rush,beat=0){
    const screen=document.body.dataset.screen;const ambient=['entry','results'].includes(screen);ambience.forEach((g,i)=>{g.visible=ambient;const w=innerWidth,h=innerHeight;g.position.set((i?1:-1)*(screen==='entry'&&w>800?-1:1)*w*(w<600?.38:.38),h*(i?-.37:w<600?.34:.25)+(reduced?0:Math.sin(time*.7+i*2)*14),-5);g.scale.setScalar(w<600?28:i?65:76);});
    previewTime=time;background.update(time,{beat,rush,reduced});
    for(const mat of Object.values(materials)){mat.uniforms.uTime.value=reduced?0:time;mat.uniforms.uRush.value=rush?1:0;}
    for(const item of items){const p=item.phase;item.group.rotation.x=.22+(reduced?0:Math.sin(time*1.35+p)*.12);item.group.rotation.y=.28+(reduced?0:Math.sin(time*1.1+p)*.24);item.group.rotation.z=item.kind==='gold'?(reduced?.08:Math.sin(time*.65+p)*.12):0;
      item.orbit.forEach((spark,i)=>{const a=(reduced?0:time*(item.kind==='bad'?-.65:.75))+i*Math.PI*2/5+p;spark.position.set(Math.cos(a)*1.02,Math.sin(a)*.98,Math.sin(a*1.3)*.45);spark.scale.setScalar(rush?1.4:1);});}
    if(previewMode==='tutorial'){const kinds=['good','bad','gold'];previews.forEach((g,i)=>{const age=time-previewHit.at;g.scale.setScalar(.53*(kinds[i]===previewHit.kind&&age<.3&&!reduced?1+Math.sin(age/.3*Math.PI)*.2:1));});}
    if(['entry','leader'].includes(previewMode)&&!reduced){previews[0].position.y=(previews[0].userData.baseY||0)+Math.sin(time*.9)*.12;previews[2].position.y=(previews[2].userData.baseY||0)+Math.cos(time*.8)*.14;}
    bloom.strength=(rush?.72:.55)+(reduced?0:beat*.035);
  }
  function setPreviewMode(mode){previews.forEach(g=>g.userData.floatY=0);previewMode=mode;demoWidth=0;demoHeight=0;resizeDemo();}
  function pulsePreview(kind){previewHit={kind,at:previewTime};}
  function render(){composer.render();if(demoCanvas.offsetParent!==null&&!['entry','leader'].includes(previewMode)){resizeDemo();demoComposer.render();}}
  return{renderer,scene,camera,createTarget,resize,update,render,setPreviewMode,pulsePreview,impact:background.impact};
}
