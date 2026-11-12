(function(){
'use strict';

/* ---------- setup ---------- */
const W=400, TAU=Math.PI*2;
let H=720, K=1, dpr=1, SW=400, SH=720;
const app=document.getElementById('app'), stage=document.getElementById('stage');
const cv=document.getElementById('game'), ctx=cv.getContext('2d');
const $=id=>document.getElementById(id);
const reduceMotion=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
function mulberry(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const S=1.05, R=17, SPR=64;
let FEET_Y=640, GROUND_TOP=500;
let SUN={x:310,y:100};
const KINDS={
  mango_ripe:{pts:10,mango:true}, mango_kent:{pts:10,mango:true},
  mango_gold:{pts:25,mango:true,gold:true}, orange:{pts:8}, apple:{pts:8}
};
const ROT_SPRITE={mango_ripe:'r_mango',mango_kent:'r_mango',orange:'r_orange',apple:'r_apple'};

/* ---------- storage and audio ---------- */
let best=0, muted=false;
try{best=parseInt(localStorage.getItem('mangoCatchBest')||'0',10)||0;}catch(e){}
try{muted=localStorage.getItem('mangoCatchMuted')==='1';}catch(e){}
let ac=null;
function initAudio(){
  if(ac){try{ac.resume();}catch(e){} return;}
  try{ac=new (window.AudioContext||window.webkitAudioContext)();}catch(e){ac=null;}
}
function tone(freq,dur,type,vol,slide,delay){
  if(muted||!ac)return;
  try{
    const t0=ac.currentTime+(delay||0);
    const o=ac.createOscillator(), g=ac.createGain();
    o.type=type||'sine'; o.frequency.setValueAtTime(freq,t0);
    if(slide)o.frequency.exponentialRampToValueAtTime(slide,t0+dur);
    g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(vol||0.08,t0+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0+dur+0.03);
  }catch(e){}
}
const sfx={
  catch(combo){const f=520*(1+Math.min(combo,12)*0.035);tone(f,0.12,'triangle',0.09);tone(f*1.5,0.16,'triangle',0.06,0,0.05);},
  gold(){[660,830,990,1320].forEach((f,i)=>tone(f,0.2,'triangle',0.08,0,i*0.07));},
  rotten(){tone(190,0.3,'sawtooth',0.07,80);},
  over(){[392,330,262,196].forEach((f,i)=>tone(f,0.32,'sine',0.09,0,i*0.17));},
  splat(){tone(120,0.08,'sine',0.03,70);}
};

/* ---------- painting helpers ---------- */
function blob(x,cx,cy,r,fill,rnd,jit,pts){
  jit=jit==null?0.18:jit; pts=pts||14;
  const a=[];
  for(let i=0;i<pts;i++){const t=i/pts*TAU,rr=r*(1-jit/2+rnd()*jit);a.push([cx+Math.cos(t)*rr,cy+Math.sin(t)*rr*0.92]);}
  x.beginPath();
  x.moveTo((a[0][0]+a[pts-1][0])/2,(a[0][1]+a[pts-1][1])/2);
  for(let i=0;i<pts;i++){const p=a[i],n=a[(i+1)%pts];x.quadraticCurveTo(p[0],p[1],(p[0]+n[0])/2,(p[1]+n[1])/2);}
  x.closePath(); x.fillStyle=fill; x.fill();
}
function ell(x,cx,cy,rx,ry,fill,rot){
  if(fill)x.fillStyle=fill;
  x.beginPath(); x.ellipse(cx,cy,rx,ry,rot||0,0,TAU); x.fill();
}
function leafShape(x,cx,cy,rot,len,col,vein){
  x.save(); x.translate(cx,cy); x.rotate(rot);
  x.fillStyle=col; x.beginPath(); x.moveTo(0,0); x.quadraticCurveTo(len*0.5,-len*0.34,len,0); x.quadraticCurveTo(len*0.5,len*0.34,0,0); x.fill();
  x.strokeStyle=vein; x.lineWidth=0.05; x.beginPath(); x.moveTo(0,0); x.lineTo(len*0.9,0); x.stroke();
  x.restore();
}

/* ---------- fruit drawings (unit space, radius 1) ---------- */
function mangoPath(x){
  x.beginPath(); x.moveTo(-0.2,-0.95);
  x.bezierCurveTo(0.4,-1.1,0.95,-0.7,0.95,-0.05);
  x.bezierCurveTo(0.95,0.5,0.6,0.9,0.2,1.02);
  x.bezierCurveTo(-0.3,1.12,-0.95,0.7,-0.92,0);
  x.bezierCurveTo(-0.9,-0.55,-0.6,-0.85,-0.2,-0.95);
  x.closePath();
}
function fruitMango(x,v){
  x.save(); x.rotate(0.28); x.scale(0.9,1.06);
  mangoPath(x);
  const g=x.createLinearGradient(-0.6,-0.9,0.7,1);
  if(v==='ripe'){g.addColorStop(0,'#ffd95a');g.addColorStop(.6,'#f6a523');g.addColorStop(1,'#e8801a');}
  else if(v==='kent'){g.addColorStop(0,'#b5d04c');g.addColorStop(.6,'#d9b43c');g.addColorStop(1,'#e0952c');}
  else if(v==='gold'){g.addColorStop(0,'#fff6b0');g.addColorStop(.5,'#ffd23a');g.addColorStop(1,'#f3a617');}
  else{g.addColorStop(0,'#98a24a');g.addColorStop(.55,'#78712f');g.addColorStop(1,'#5a4a22');}
  x.fillStyle=g; x.fill();
  x.save(); mangoPath(x); x.clip();
  if(v==='ripe'){const b=x.createRadialGradient(0.5,0.5,0.05,0.5,0.5,1.1);b.addColorStop(0,'rgba(214,56,34,.7)');b.addColorStop(1,'rgba(214,56,34,0)');x.fillStyle=b;x.fillRect(-1.5,-1.5,3,3);}
  if(v==='kent'){const b=x.createRadialGradient(-0.35,-0.3,0.05,-0.35,-0.3,0.95);b.addColorStop(0,'rgba(200,48,40,.65)');b.addColorStop(1,'rgba(200,48,40,0)');x.fillStyle=b;x.fillRect(-1.5,-1.5,3,3);}
  if(v==='rot'){
    x.fillStyle='rgba(42,28,12,.74)';
    [[0.3,0.2,0.34,0.26],[-0.4,0.45,0.26,0.2],[0.1,-0.45,0.22,0.17],[-0.55,-0.1,0.16,0.2],[0.6,-0.4,0.14,0.12]].forEach(b=>{x.beginPath();x.ellipse(b[0],b[1],b[2],b[3],b[0],0,TAU);x.fill();});
    x.fillStyle='rgba(214,226,168,.55)';
    [[-0.1,0.0,0.06],[0.45,0.55,0.05],[-0.3,-0.55,0.05],[0.1,0.7,0.04]].forEach(b=>{x.beginPath();x.arc(b[0],b[1],b[2],0,TAU);x.fill();});
  }
  x.fillStyle=v==='rot'?'rgba(255,255,255,.1)':'rgba(255,255,255,.42)';
  x.beginPath(); x.ellipse(-0.42,-0.36,0.2,0.36,0.5,0,TAU); x.fill();
  x.restore();
  mangoPath(x); x.lineWidth=0.09; x.strokeStyle='rgba(255,247,222,.8)'; x.lineJoin='round'; x.stroke();
  x.strokeStyle=v==='rot'?'#4a3418':'#5a3b1d'; x.lineWidth=0.1; x.lineCap='round';
  x.beginPath(); x.moveTo(-0.2,-0.95); x.lineTo(-0.26,-1.16); x.stroke();
  leafShape(x,-0.24,-1.08,-0.35,0.78,v==='rot'?'#8a6b2c':'#4f9a46',v==='rot'?'#5a431a':'#9fd07a');
  x.restore();
}
function fruitOrange(x,rot){
  x.beginPath(); x.arc(0,0,0.96,0,TAU);
  const g=x.createRadialGradient(-0.3,-0.35,0.05,0,0,1);
  if(!rot){g.addColorStop(0,'#ffc65f');g.addColorStop(.55,'#f58a1f');g.addColorStop(1,'#d9650f');}
  else{g.addColorStop(0,'#aaa047');g.addColorStop(.6,'#7d7230');g.addColorStop(1,'#554a22');}
  x.fillStyle=g; x.fill();
  x.save(); x.beginPath(); x.arc(0,0,0.96,0,TAU); x.clip();
  x.fillStyle=rot?'rgba(30,25,10,.3)':'rgba(150,60,0,.22)';
  for(let i=0;i<16;i++){const a=i*2.4,r=0.25+((i*37)%70)/100;x.beginPath();x.arc(Math.cos(a)*r,Math.sin(a)*r,0.035,0,TAU);x.fill();}
  if(rot){
    x.fillStyle='rgba(42,28,12,.6)'; x.beginPath(); x.ellipse(0.35,0.3,0.4,0.3,0.5,0,TAU); x.fill();
    x.fillStyle='rgba(214,232,224,.92)';
    [[-0.3,0.25,0.22],[-0.12,0.42,0.14],[0.45,-0.2,0.15],[-0.5,-0.3,0.1]].forEach(b=>{x.beginPath();x.arc(b[0],b[1],b[2],0,TAU);x.fill();});
    x.strokeStyle='rgba(110,165,155,.85)'; x.lineWidth=0.05;
    [[-0.3,0.25,0.22],[0.45,-0.2,0.15]].forEach(b=>{x.beginPath();x.arc(b[0],b[1],b[2],0,TAU);x.stroke();});
  }
  x.fillStyle=rot?'rgba(255,255,255,.1)':'rgba(255,255,255,.4)';
  x.beginPath(); x.ellipse(-0.4,-0.4,0.22,0.34,0.7,0,TAU); x.fill();
  x.restore();
  x.beginPath(); x.arc(0,0,0.96,0,TAU); x.lineWidth=0.09; x.strokeStyle='rgba(255,247,222,.8)'; x.stroke();
  x.fillStyle=rot?'#6f5a28':'#5b8f3a'; x.beginPath(); x.ellipse(0,-0.9,0.17,0.08,0,0,TAU); x.fill();
  leafShape(x,0.04,-0.92,-0.6,0.74,rot?'#8a6b2c':'#4f9a46',rot?'#5a431a':'#9fd07a');
}
function applePath(x){
  x.beginPath(); x.moveTo(0,-0.68);
  x.bezierCurveTo(0.3,-1.02,1.0,-0.9,1.0,-0.12);
  x.bezierCurveTo(1.0,0.55,0.55,1.02,0.22,0.98);
  x.bezierCurveTo(0.1,0.95,-0.1,0.95,-0.22,0.98);
  x.bezierCurveTo(-0.55,1.02,-1.0,0.55,-1.0,-0.12);
  x.bezierCurveTo(-1.0,-0.9,-0.3,-1.02,0,-0.68);
  x.closePath();
}
function fruitApple(x,rot){
  applePath(x);
  const g=x.createLinearGradient(-0.7,-0.8,0.8,0.9);
  if(!rot){g.addColorStop(0,'#f2634f');g.addColorStop(.6,'#d23a2e');g.addColorStop(1,'#a02720');}
  else{g.addColorStop(0,'#8e6238');g.addColorStop(.6,'#6a4426');g.addColorStop(1,'#4a2d1a');}
  x.fillStyle=g; x.fill();
  x.save(); applePath(x); x.clip();
  if(!rot){x.fillStyle='rgba(240,190,60,.3)';x.beginPath();x.ellipse(0.55,0.6,0.5,0.35,-0.5,0,TAU);x.fill();}
  else{
    x.fillStyle='rgba(32,20,10,.7)'; x.beginPath(); x.ellipse(0.25,0.15,0.36,0.3,0.4,0,TAU); x.fill();
    x.beginPath(); x.ellipse(-0.5,0.4,0.2,0.18,0,0,TAU); x.fill();
    x.strokeStyle='rgba(30,18,8,.5)'; x.lineWidth=0.04;
    [[-0.6,-0.2,-0.2,0],[0.1,-0.5,0.5,-0.3],[-0.2,0.6,0.3,0.75]].forEach(l=>{x.beginPath();x.moveTo(l[0],l[1]);x.quadraticCurveTo((l[0]+l[2])/2,(l[1]+l[3])/2-0.12,l[2],l[3]);x.stroke();});
    x.fillStyle='rgba(215,226,168,.5)'; [[-0.1,0.45,0.05],[0.6,0.5,0.04],[-0.55,-0.45,0.05]].forEach(b=>{x.beginPath();x.arc(b[0],b[1],b[2],0,TAU);x.fill();});
  }
  x.fillStyle=rot?'rgba(255,255,255,.1)':'rgba(255,255,255,.42)';
  x.beginPath(); x.ellipse(-0.45,-0.35,0.17,0.3,0.5,0,TAU); x.fill();
  x.restore();
  applePath(x); x.lineWidth=0.09; x.strokeStyle='rgba(255,247,222,.8)'; x.lineJoin='round'; x.stroke();
  x.strokeStyle='#5a3b1d'; x.lineWidth=0.1; x.lineCap='round';
  x.beginPath(); x.moveTo(0,-0.66); x.quadraticCurveTo(0.04,-0.95,0.14,-1.12); x.stroke();
  leafShape(x,0.06,-0.9,-0.5,0.72,rot?'#8a6b2c':'#4f9a46',rot?'#5a431a':'#9fd07a');
}
const FRUIT_DRAW={
  mango_ripe:x=>fruitMango(x,'ripe'), mango_kent:x=>fruitMango(x,'kent'), mango_gold:x=>fruitMango(x,'gold'),
  orange:x=>fruitOrange(x,false), apple:x=>fruitApple(x,false),
  r_mango:x=>fruitMango(x,'rot'), r_orange:x=>fruitOrange(x,true), r_apple:x=>fruitApple(x,true)
};
function drawFruitAt(x,kind,cx,cy,r,rot){
  x.save(); x.translate(cx,cy); x.rotate(rot||0); x.scale(r,r); x.lineJoin='round'; FRUIT_DRAW[kind](x); x.restore();
}

/* ---------- layers ---------- */
let bgSky,bgScene,fgTop,clouds=[],sprites={},afro=null;
function layer(){const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const x=c.getContext('2d');x.scale(K,K);return{c:c,x:x};}
function makeSprite(kind){
  const c=document.createElement('canvas'); c.width=Math.ceil(SPR*K); c.height=Math.ceil(SPR*K);
  const x=c.getContext('2d'); x.scale(K,K); x.translate(SPR/2,SPR/2);
  const gold=kind==='mango_gold', rot=kind.charAt(0)==='r';
  const h=x.createRadialGradient(0,0,6,0,0,30);
  h.addColorStop(0,gold?'rgba(255,226,92,.7)':rot?'rgba(255,250,225,.34)':'rgba(255,250,225,.3)'); h.addColorStop(1,'rgba(255,250,225,0)');
  x.fillStyle=h; x.beginPath(); x.arc(0,0,31,0,TAU); x.fill();
  drawFruitAt(x,kind,0,0,R,0);
  return c;
}

function paintSky(x,rnd){
  const g=x.createLinearGradient(0,0,0,H*0.66);
  g.addColorStop(0,'#69aec8'); g.addColorStop(.5,'#a8d6cf'); g.addColorStop(1,'#f4e6b0');
  x.fillStyle=g; x.fillRect(0,0,W,H);
  x.lineCap='round';
  for(let i=0;i<46;i++){
    const y=rnd()*H*0.62, xx=rnd()*W*1.2-40, len=60+rnd()*160;
    x.strokeStyle=rnd()<.55?'rgba(255,255,255,'+(0.04+rnd()*0.07)+')':'rgba(60,120,160,'+(0.03+rnd()*0.05)+')';
    x.lineWidth=5+rnd()*16; x.beginPath(); x.moveTo(xx,y); x.quadraticCurveTo(xx+len/2,y+(rnd()-.5)*10,xx+len,y+(rnd()-.5)*6); x.stroke();
  }
  const rg=x.createRadialGradient(SUN.x,SUN.y,6,SUN.x,SUN.y,200);
  rg.addColorStop(0,'rgba(255,246,205,.95)'); rg.addColorStop(.3,'rgba(255,238,175,.5)'); rg.addColorStop(1,'rgba(255,238,175,0)');
  x.fillStyle=rg; x.fillRect(0,0,W,H);
  x.fillStyle='#fff7d6'; x.beginPath(); x.arc(SUN.x,SUN.y,22,0,TAU); x.fill();
  x.save(); x.translate(SUN.x,SUN.y);
  for(let i=0;i<9;i++){
    const a=Math.PI*0.45+i*0.2+rnd()*0.05, ca=Math.cos(a), sa=Math.sin(a);
    x.fillStyle='rgba(255,247,210,.07)'; x.beginPath(); x.moveTo(0,0);
    x.lineTo(ca*560-sa*24,sa*560+ca*24); x.lineTo(ca*560+sa*24,sa*560-ca*24); x.closePath(); x.fill();
  }
  x.restore();
}
function makeCloud(w,h,rnd){
  const c=document.createElement('canvas'); c.width=Math.ceil(w*K); c.height=Math.ceil(h*K);
  const x=c.getContext('2d'); x.scale(K,K);
  const cols=['#c9d7e2','#eef4f8','#ffffff'], n=7;
  for(let L=0;L<3;L++){
    for(let i=0;i<n;i++){
      const t=i/(n-1), cx=w*0.14+t*w*0.72, cy=h*0.6-Math.sin(t*Math.PI)*h*0.26-L*h*0.05;
      const r=h*(0.22+Math.sin(t*Math.PI)*0.2)*(1-L*0.14);
      blob(x,cx,cy+(2-L)*h*0.04,r,cols[L],rnd,0.2,12);
    }
  }
  return c;
}

function flower(x,fx,fy,s,type,rnd){
  const tilt=(rnd()-.5)*0.5, stemH=(16+rnd()*12)*s;
  x.save(); x.translate(fx,fy); x.rotate(tilt);
  x.strokeStyle='#3f7a3a'; x.lineWidth=1.6*s; x.lineCap='round';
  x.beginPath(); x.moveTo(0,0); x.quadraticCurveTo(2*s,-stemH*.5,0,-stemH); x.stroke();
  x.fillStyle='#4f9144'; x.beginPath(); x.ellipse(5*s,-stemH*.35,5*s,2*s,-0.6,0,TAU); x.fill();
  x.translate(0,-stemH);
  const P={
    daisy:{n:10,c:'#fbf7ee',ctr:'#f1b928',len:5.6,w:1.7,ci:'#f1b928'},
    poppy:{n:5,c:'#e8624a',ctr:'#3a2a1a',len:6,w:3.4,ci:'#7e241a'},
    violet:{n:5,c:'#8e7ad1',ctr:'#f5d65a',len:5,w:2.6,ci:'#f5d65a'},
    butter:{n:6,c:'#f6cf3a',ctr:'#c98a10',len:4.6,w:2.4,ci:'#c98a10'}
  }[type];
  for(let i=0;i<P.n;i++){
    x.save(); x.rotate(i/P.n*TAU+rnd()*.2);
    x.fillStyle=P.c; x.beginPath(); x.ellipse(0,-P.len*s*0.7,P.w*s,P.len*s*0.7,0,0,TAU); x.fill();
    x.restore();
  }
  x.fillStyle=P.ci; x.beginPath(); x.arc(0,0,P.w*s*0.9,0,TAU); x.fill();
  x.fillStyle='rgba(255,255,255,.35)'; x.beginPath(); x.arc(-0.5*s,-0.5*s,P.w*s*0.35,0,TAU); x.fill();
  x.restore();
}
function tuft(x,bx,by,n,hMax,rnd,cols){
  for(let i=0;i<n;i++){
    const a=(rnd()-.5)*1.1, h=hMax*(0.5+rnd()*0.6), w=2.2+rnd()*2;
    const tx=bx+Math.sin(a)*h, ty=by-Math.cos(a)*h, cx=bx+Math.sin(a)*h*0.3+(rnd()-.5)*6;
    x.fillStyle=cols[(rnd()*cols.length)|0];
    x.beginPath(); x.moveTo(bx-w,by); x.quadraticCurveTo(cx,by-h*0.55,tx,ty); x.quadraticCurveTo(cx+w*1.2,by-h*0.5,bx+w,by); x.closePath(); x.fill();
  }
}
function paintTree(x,rnd,o){
  // trunk
  const bw=o.trunkW;
  const g=x.createLinearGradient(o.tx-bw,0,o.tx+bw,0);
  g.addColorStop(0,'#4a3023'); g.addColorStop(.55,'#6c4730'); g.addColorStop(1,'#8d6342');
  x.fillStyle=g; x.beginPath();
  x.moveTo(o.tx-bw*1.5,o.base+5);
  x.quadraticCurveTo(o.tx-bw*0.6,o.base-18,o.tx-bw*0.45+o.lean*0.3,o.base-(o.base-o.topY)*0.55);
  x.quadraticCurveTo(o.topX-bw*0.3,o.topY+30,o.topX-bw*0.4,o.topY);
  x.lineTo(o.topX+bw*0.4,o.topY);
  x.quadraticCurveTo(o.topX+bw*0.3,o.topY+30,o.tx+bw*0.55+o.lean*0.3,o.base-(o.base-o.topY)*0.55);
  x.quadraticCurveTo(o.tx+bw*0.6,o.base-18,o.tx+bw*1.5,o.base+5);
  x.closePath(); x.fill();
  x.lineCap='round';
  for(let i=0;i<22;i++){
    const t=rnd(), yy=lerp(o.base,o.topY+20,t), xx=lerp(o.tx,o.topX,t)+(rnd()-.5)*bw*1.1;
    x.strokeStyle=rnd()<.6?'rgba(40,24,16,.4)':'rgba(190,150,108,.3)'; x.lineWidth=1+rnd()*1.2;
    x.beginPath(); x.moveTo(xx,yy); x.lineTo(xx+(rnd()-.5)*3,yy-8-rnd()*14); x.stroke();
  }
  x.strokeStyle='#5d3d2a'; x.lineWidth=bw*0.5;
  [[-0.5,0.2],[0.4,0.1],[0,-0.1]].forEach(b=>{x.beginPath();x.moveTo(o.topX,o.topY+6);x.lineTo(o.cx+b[0]*o.R*0.5,o.cy+b[1]*o.R*0.4);x.stroke();});
  // canopy
  const sunx=0.6, suny=-0.8;
  const layers=[
    {n:12,r:0.46,c:'#2d5d3a',o:0.0,j:0.9},{n:14,r:0.36,c:'#3e7c48',o:0.18,j:0.85},
    {n:11,r:0.25,c:'#64a458',o:0.3,j:0.8},{n:8,r:0.15,c:'#a2cb69',o:0.42,j:0.75}
  ];
  layers.forEach(L=>{
    for(let i=0;i<L.n;i++){
      const a=rnd()*TAU, d=Math.sqrt(rnd())*o.R*L.j;
      const px=o.cx+Math.cos(a)*d+sunx*o.R*L.o*0.35, py=o.cy+Math.sin(a)*d*0.9+suny*o.R*L.o*0.35;
      blob(x,px,py,o.R*L.r*(0.8+rnd()*0.4),L.c,rnd,0.3,12);
    }
  });
  const leafCols=['#2b5a37','#3f7d49','#6aa859','#a6cd6b'];
  for(let i=0;i<260;i++){
    const a=rnd()*TAU, d=Math.sqrt(rnd())*o.R*0.98, ox=Math.cos(a), oy=Math.sin(a);
    const light=clamp((ox*sunx+oy*suny)*0.5+0.5+(rnd()-.5)*0.5,0,0.999);
    x.fillStyle=leafCols[(light*4)|0]; x.globalAlpha=0.85;
    x.beginPath(); x.ellipse(o.cx+ox*d,o.cy+oy*d*0.9,4.8,2.3,rnd()*TAU,0,TAU); x.fill();
  }
  x.globalAlpha=1;
  // hanging mangoes
  for(let i=0;i<o.mangoes;i++){
    const px=o.cx+(rnd()-.5)*o.R*1.4, py=o.cy+o.R*(0.05+rnd()*0.55);
    x.strokeStyle='#4a6b30'; x.lineWidth=1; x.beginPath(); x.moveTo(px,py-12); x.lineTo(px,py-6); x.stroke();
    drawFruitAt(x,rnd()<.5?'mango_ripe':'mango_kent',px,py,8+rnd()*2.5,(rnd()-.5)*0.4);
  }
}

function paintScene(x){
  const rnd=mulberry(23);
  GROUND_TOP=H*0.69;
  const hills=[
    {b:.50,a:30,c1:'#b6d6c0',c2:'#9cc4a9',f:[.012,.029],p:[1.2,.4],t:0,tr:0},
    {b:.565,a:28,c1:'#92bd97',c2:'#78a880',f:[.016,.036],p:[3.1,2],t:9,tr:9},
    {b:.63,a:22,c1:'#70a273',c2:'#5a8f5f',f:[.021,.043],p:[.2,4.4],t:7,tr:14}
  ];
  hills.forEach(h=>{
    h.y=px=>H*h.b-h.a*(.55*Math.sin(px*h.f[0]+h.p[0])+.35*Math.sin(px*h.f[1]+h.p[1])+.1);
    x.beginPath(); x.moveTo(0,H);
    for(let px=0;px<=W;px+=4)x.lineTo(px,h.y(px));
    x.lineTo(W,H); x.closePath();
    const g=x.createLinearGradient(0,H*h.b-h.a,0,H*h.b+140); g.addColorStop(0,h.c1); g.addColorStop(1,h.c2);
    x.fillStyle=g; x.fill();
    x.lineCap='round';
    for(let i=0;i<90;i++){
      const px=rnd()*W, py=h.y(px)+rnd()*70, l=6+rnd()*8;
      x.strokeStyle=rnd()<.5?'rgba(255,255,230,.12)':'rgba(30,70,50,.08)'; x.lineWidth=1.4;
      x.beginPath(); x.moveTo(px,py); x.lineTo(px+l,py-l*0.4); x.stroke();
    }
    for(let i=0;i<h.t;i++){
      const px=20+rnd()*(W-40), py=h.y(px)+3, r=h.tr*0.6+rnd()*h.tr*0.4;
      blob(x,px,py-r*0.9,r,'#5a8f63',rnd,0.25,10);
      blob(x,px+r*0.25,py-r*1.2,r*0.7,'#7db07c',rnd,0.25,10);
    }
  });
  // meadow
  x.beginPath(); x.moveTo(0,H); x.lineTo(0,GROUND_TOP);
  for(let px=0;px<=W;px+=5)x.lineTo(px,GROUND_TOP+Math.sin(px*0.025+1)*5+Math.sin(px*0.07)*2);
  x.lineTo(W,H); x.closePath();
  const mg=x.createLinearGradient(0,GROUND_TOP,0,H);
  mg.addColorStop(0,'#88ba5e'); mg.addColorStop(.45,'#5f9d47'); mg.addColorStop(1,'#3e7a3a');
  x.fillStyle=mg; x.fill();
  x.save(); x.clip();
  x.lineCap='round';
  for(let i=0;i<70;i++){
    const y=GROUND_TOP+rnd()*(H-GROUND_TOP), xx=rnd()*W*1.1-20, len=40+rnd()*110;
    x.strokeStyle=rnd()<.5?'rgba(190,225,110,.12)':'rgba(25,80,40,.1)'; x.lineWidth=4+rnd()*9;
    x.beginPath(); x.moveTo(xx,y); x.quadraticCurveTo(xx+len/2,y+(rnd()-.5)*8,xx+len,y+(rnd()-.5)*5); x.stroke();
  }
  // worn path where she walks
  x.strokeStyle='rgba(214,190,126,.3)'; x.lineWidth=58;
  x.beginPath(); x.moveTo(-20,FEET_Y-4); x.quadraticCurveTo(W*0.5,FEET_Y-22,W+20,FEET_Y-8); x.stroke();
  x.strokeStyle='rgba(236,216,156,.2)'; x.lineWidth=30;
  x.beginPath(); x.moveTo(-20,FEET_Y-4); x.quadraticCurveTo(W*0.5,FEET_Y-22,W+20,FEET_Y-8); x.stroke();
  for(let i=0;i<40;i++){
    x.fillStyle=rnd()<.5?'rgba(120,96,60,.3)':'rgba(255,240,200,.3)';
    x.beginPath(); x.ellipse(rnd()*W,FEET_Y-20+rnd()*36,1+rnd()*1.6,0.8+rnd()*0.8,0,0,TAU); x.fill();
  }
  const bladeCols=['#5b9a46','#3f7e3a','#82b45a','#2f6a33'];
  for(let i=0;i<900;i++){
    const y=GROUND_TOP+rnd()*(H-GROUND_TOP), xx=rnd()*W, s=lerp(0.5,1.4,(y-GROUND_TOP)/(H-GROUND_TOP)), l=(4+rnd()*8)*s;
    x.strokeStyle=bladeCols[(rnd()*4)|0]; x.globalAlpha=0.7; x.lineWidth=1.1;
    x.beginPath(); x.moveTo(xx,y); x.quadraticCurveTo(xx+(rnd()-.5)*4,y-l*0.6,xx+(rnd()-.5)*6,y-l); x.stroke();
  }
  x.globalAlpha=1;
  x.restore();
  // flowers
  const fl=[];
  const types=['daisy','daisy','poppy','violet','butter','violet','poppy'];
  for(let i=0;i<88;i++){
    const y=GROUND_TOP+8+rnd()*(H-GROUND_TOP-30);
    fl.push({x:rnd()*W,y:y,t:types[(rnd()*types.length)|0]});
  }
  fl.sort((a,b)=>a.y-b.y);
  fl.forEach(f=>flower(x,f.x,f.y,lerp(0.5,1.35,(f.y-GROUND_TOP)/(H-GROUND_TOP)),f.t,rnd));
  // trees: left tall, right shorter
  const baseL=GROUND_TOP+H*0.04, baseR=GROUND_TOP+H*0.07;
  x.fillStyle='rgba(30,70,35,.28)';
  x.beginPath(); x.ellipse(50,baseL+6,78,14,0,0,TAU); x.fill();
  x.beginPath(); x.ellipse(W-40,baseR+6,70,13,0,0,TAU); x.fill();
  paintTree(x,rnd,{tx:42,base:baseL,topX:8,topY:H*0.22,trunkW:15,lean:-8,cx:-2,cy:H*0.15,R:Math.min(150,H*0.2),mangoes:8});
  paintTree(x,rnd,{tx:W-38,base:baseR,topX:W+4,topY:H*0.36,trunkW:13,lean:8,cx:W+14,cy:H*0.29,R:Math.min(122,H*0.17),mangoes:6});
}
function paintFg(x){
  const rnd=mulberry(61);
  const cols=['#1f4f2b','#2f6a33','#3f7e3a','#5b9a46','#86b45a'];
  for(let bx=-10;bx<W+30;bx+=26+rnd()*14)tuft(x,bx,H+6,8+((rnd()*5)|0),34+rnd()*30,rnd,cols);
  flower(x,26,H+6,2.3,'poppy',rnd); flower(x,W-34,H+6,2.1,'daisy',rnd); flower(x,W*0.55,H+8,1.6,'violet',rnd);
  tuft(x,18,H+8,10,52,rnd,cols); tuft(x,W-20,H+8,10,50,rnd,cols);
  // vignette
  x.save(); x.translate(W/2,H/2); x.scale(W/H,1);
  const vg=x.createRadialGradient(0,0,H*0.34,0,0,H*0.82);
  vg.addColorStop(0,'rgba(20,40,25,0)'); vg.addColorStop(1,'rgba(20,40,25,.34)');
  x.fillStyle=vg; x.fillRect(-H,-H,2*H,2*H); x.restore();
  // paper grain
  for(let i=0;i<2600;i++){
    x.fillStyle=rnd()<.5?'rgba(255,255,240,'+(0.04+rnd()*0.05)+')':'rgba(30,40,20,'+(0.04+rnd()*0.05)+')';
    const s=0.7+rnd()*1.0; x.fillRect(rnd()*W,rnd()*H,s,s);
  }
  x.lineCap='round'; x.lineWidth=0.7;
  for(let i=0;i<90;i++){
    const px=rnd()*W, py=rnd()*H, a=rnd()*TAU, l=3+rnd()*7;
    x.strokeStyle=rnd()<.5?'rgba(255,255,240,.06)':'rgba(30,40,20,.06)';
    x.beginPath(); x.moveTo(px,py); x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l); x.stroke();
  }
}
function makeAfro(){
  const rnd=mulberry(5), c=document.createElement('canvas');
  c.width=Math.ceil(88*K); c.height=Math.ceil(88*K);
  const x=c.getContext('2d'); x.scale(K,K); x.translate(44,44);
  x.fillStyle='#1a110c'; x.beginPath(); x.arc(0,0,24,0,TAU); x.fill();
  for(let i=0;i<18;i++){const a=i/18*TAU;ell(x,Math.cos(a)*17,Math.sin(a)*16.5,11.5,11.5,'#1c130d');}
  for(let i=0;i<12;i++){const a=(i+.5)/12*TAU;ell(x,Math.cos(a)*11,Math.sin(a)*10.5,9,9,'#251a12');}
  x.fillStyle='rgba(78,56,42,.55)';
  for(let i=0;i<9;i++){const a=-1.6+i*0.3;ell(x,Math.cos(a)*19,Math.sin(a)*18,5.5-(i%3),4.6-(i%3)*0.6);}
  x.strokeStyle='rgba(110,82,62,.55)'; x.lineWidth=0.9; x.lineCap='round';
  for(let i=0;i<60;i++){
    const a=rnd()*TAU, r=Math.sqrt(rnd())*27;
    x.beginPath(); x.arc(Math.cos(a)*r,Math.sin(a)*r,1.5+rnd()*1.4,a,a+4.2); x.stroke();
  }
  // hibiscus tucked on the left
  x.save(); x.translate(-17,-6);
  leafShape(x,0,0,2.6,9,'#3f7d49','#8fc27a'); leafShape(x,0,0,3.7,8,'#3f7d49','#8fc27a');
  for(let i=0;i<5;i++){
    x.save(); x.rotate(i/5*TAU);
    x.fillStyle='#ee6a52'; x.beginPath(); x.ellipse(0,-4.6,4,5,0,0,TAU); x.fill();
    x.fillStyle='rgba(255,200,170,.3)'; x.beginPath(); x.ellipse(-0.8,-6,1.6,2.4,0,0,TAU); x.fill();
    x.restore();
  }
  x.fillStyle='#b9332b'; x.beginPath(); x.arc(0,0,2.3,0,TAU); x.fill();
  x.strokeStyle='#f7d34a'; x.lineWidth=1; x.beginPath(); x.moveTo(0,0); x.lineTo(2.4,-5.5); x.stroke();
  x.fillStyle='#f7d34a'; x.beginPath(); x.arc(2.4,-5.5,1,0,TAU); x.fill();
  x.restore();
  return c;
}

function rebuild(){
  SUN={x:W*0.78,y:H*0.15};
  FEET_Y=H-76;
  bgSky=layer(); paintSky(bgSky.x,mulberry(11));
  const cr=mulberry(31);
  clouds=[
    {s:makeCloud(150,64,cr),x:30,y:H*0.07,v:7,w:150,h:64},
    {s:makeCloud(120,52,cr),x:230,y:H*0.2,v:11,w:120,h:52},
    {s:makeCloud(170,70,cr),x:120,y:H*0.33,v:5,w:170,h:70}
  ];
  bgScene=layer(); paintScene(bgScene.x);
  fgTop=layer(); paintFg(fgTop.x);
  ['mango_ripe','mango_kent','mango_gold','orange','apple','r_mango','r_orange','r_apple'].forEach(k=>{sprites[k]=makeSprite(k);});
  afro=makeAfro();
  document.querySelectorAll('canvas[data-sprite]').forEach(c=>{
    const px=Math.round(52*dpr); c.width=px; c.height=px;
    const x=c.getContext('2d'); x.clearRect(0,0,px,px); x.drawImage(sprites[c.dataset.sprite],0,0,px,px);
  });
}

/* ---------- state ---------- */
let mode='menu';
const st={t:0,score:0,hearts:5,caught:0,mangoes:0,combo:0,elapsed:0,spawnT:1,shake:0,dieT:0,newBest:false,lastSpawnX:W/2};
const ch={x:W/2,target:W/2,vx:0,vxs:0,walk:0,exp:'idle',expT:0,pulse:0,drops:[],gx:0,gy:0,worried:false};
const fruits=[],particles=[],popups=[],decals=[],petals=[];
const keys={left:false,right:false};

/* ---------- HUD ---------- */
const heartsEl=$('hearts'), scoreEl=$('score'), bestEl=$('best'), hud=$('hud'), menu=$('menu'), over=$('over'), pausedEl=$('paused');
const HEART='<svg class="heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
heartsEl.innerHTML=HEART.repeat(5);
function updateHud(pulseIdx){
  const hs=heartsEl.children;
  for(let i=0;i<hs.length;i++)hs[i].classList.toggle('lost',i>=st.hearts);
  if(pulseIdx!=null&&hs[pulseIdx]){const h=hs[pulseIdx];h.classList.remove('hit');void h.getBoundingClientRect();h.classList.add('hit');}
  heartsEl.setAttribute('aria-label',st.hearts+' of 5 hearts left');
  scoreEl.textContent=st.score; bestEl.textContent=Math.max(best,st.score);
}
function paintMenuBest(){const el=$('menu-best');if(best>0){el.hidden=false;el.querySelector('b').textContent=best;}else el.hidden=true;}
const soundBtn=$('sound');
function paintSoundBtn(){soundBtn.setAttribute('aria-pressed',muted?'false':'true');soundBtn.setAttribute('aria-label',muted?'Sound off':'Sound on');}
soundBtn.addEventListener('click',e=>{e.stopPropagation();muted=!muted;try{localStorage.setItem('mangoCatchMuted',muted?'1':'0');}catch(x){}paintSoundBtn();});
soundBtn.addEventListener('pointerdown',e=>e.stopPropagation());
const pauseBtn=$('pause');
pauseBtn.addEventListener('click',e=>{e.stopPropagation();pauseGame();});
pauseBtn.addEventListener('pointerdown',e=>e.stopPropagation());

/* ---------- game flow ---------- */
function clearField(){
  fruits.length=0; particles.length=0; popups.length=0; ch.drops.length=0; decals.length=0;
  ch.exp='idle'; ch.expT=0; ch.worried=false; st.shake=0;
  drag=null; keys.left=keys.right=false;
}
function startGame(){
  initAudio();
  st.score=0; st.hearts=5; st.caught=0; st.mangoes=0; st.combo=0; st.elapsed=0; st.spawnT=0.7; st.dieT=0; st.newBest=false;
  clearField();
  mode='play'; menu.hidden=true; over.hidden=true; pausedEl.hidden=true; hud.hidden=false;
  updateHud();
}
function pauseGame(){
  if(mode!=='play')return;
  mode='paused';
  drag=null; keys.left=keys.right=false;
  $('paused-score').textContent=st.score;
  pausedEl.hidden=false;
  try{$('resume').focus({preventScroll:true});}catch(e){}
}
function resumeGame(){
  if(mode!=='paused')return;
  initAudio();
  mode='play'; pausedEl.hidden=true;
  try{document.activeElement&&document.activeElement.blur();}catch(e){}
}
function quitToMenu(){
  // Keep the best score if the player quits mid-run with a new high.
  if(st.score>best){best=st.score;try{localStorage.setItem('mangoCatchBest',String(best));}catch(e){}}
  clearField();
  st.score=0; st.hearts=5; st.combo=0;
  mode='menu';
  hud.hidden=true; over.hidden=true; pausedEl.hidden=true; menu.hidden=false;
  paintMenuBest(); bestEl.textContent=best;
  try{$('play').focus({preventScroll:true});}catch(e){}
}
function finishGame(){
  mode='over';
  const prev=best;
  if(st.score>best){best=st.score;try{localStorage.setItem('mangoCatchBest',String(best));}catch(e){}}
  st.newBest=st.score>prev&&st.score>0;
  const m=st.mangoes, o=st.caught-st.mangoes;
  $('over-score').textContent=st.score;
  $('newbest').hidden=!st.newBest;
  $('over-stats').textContent=m+' mango'+(m===1?'':'es')+' and '+o+' other fruit in the basket';
  $('over-best').textContent=best;
  hud.hidden=true; over.hidden=false;
  try{$('again').focus({preventScroll:true});}catch(e){}
  sfx.over();
}
$('play').addEventListener('click',startGame);
$('again').addEventListener('click',startGame);
$('resume').addEventListener('click',resumeGame);
$('restart').addEventListener('click',startGame);
$('quit-pause').addEventListener('click',quitToMenu);
$('quit-over').addEventListener('click',quitToMenu);

function spawnFruit(){
  const d=clamp(st.elapsed/100,0,1), hs=H/720;
  const rotten=Math.random()<lerp(0.14,0.34,d);
  let kind;
  const r=Math.random();
  if(!rotten&&Math.random()<0.04)kind='mango_gold';
  else if(r<0.34)kind='mango_ripe';
  else if(r<0.6)kind='mango_kent';
  else if(r<0.8)kind='orange';
  else kind='apple';
  if(kind==='mango_gold'&&rotten)kind='mango_ripe';
  let x=0;
  for(let i=0;i<6;i++){x=30+Math.random()*(W-60);if(Math.abs(x-st.lastSpawnX)>70)break;}
  st.lastSpawnX=x;
  fruits.push({kind:kind,rotten:rotten,sprite:rotten?(ROT_SPRITE[kind]):kind,x:x,y:-30,
    vy:lerp(170,330,d)*hs*(0.9+Math.random()*0.25),rot:(Math.random()-.5)*0.6,vr:(Math.random()-.5)*(rotten?1.6:1.2),
    ph:Math.random()*TAU,landY:FEET_Y+6+Math.random()*16});
}
function burst(x,y,n,cols,speed,type){
  for(let i=0;i<n;i++){
    const a=Math.random()*TAU,s=speed*(0.4+Math.random()*0.7),life=0.6+Math.random()*0.5;
    particles.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-speed*0.4,life:life,max:life,
      r:2+Math.random()*2.4,c:cols[(Math.random()*cols.length)|0],type:type||'dot',rot:Math.random()*TAU});
  }
}
function popup(x,y,text,color,size){popups.push({x:x,y:y,text:text,color:color,size:size||30,life:0.95,max:0.95});}
function fruitColors(f){
  if(f.rotten)return['#6b5a2a','#4a3a1c','#8a8f3e'];
  if(f.kind==='orange')return['#f58a1f','#ffc65f'];
  if(f.kind==='apple')return['#d23a2e','#f2634f'];
  if(f.kind==='mango_gold')return['#ffd23a','#fff6b0'];
  return['#f6a523','#ffd95a','#4f9a46'];
}
function catchFruit(f){
  const idx=fruits.indexOf(f); if(idx>=0)fruits.splice(idx,1);
  const rimY=FEET_Y-79*S;
  if(f.rotten){
    st.hearts--; st.combo=0; st.shake=reduceMotion?0:0.3;
    ch.exp='hurt'; ch.expT=0.8; ch.pulse=1;
    burst(f.x,rimY,14,fruitColors(f),150,'dot');
    popup(ch.x,rimY-50,'Ew!','#a83a28',34);
    updateHud(Math.max(0,st.hearts));
    sfx.rotten();
    if(st.hearts<=0){mode='dying';st.dieT=1.0;ch.exp='hurt';ch.expT=2;}
    return;
  }
  const k=KINDS[f.kind];
  st.combo++;
  const bonus=Math.min(Math.floor(st.combo/5)*2,10), gain=k.pts+bonus;
  st.score+=gain; st.caught++; if(k.mango)st.mangoes++;
  ch.exp='happy'; ch.expT=0.55; ch.pulse=1;
  ch.drops.push({sprite:f.sprite,dx:clamp(f.x-ch.x,-24,24),t:0});
  burst(f.x,rimY-6,k.gold?16:8,fruitColors(f).concat(['#fff6b0']),k.gold?170:110,'spark');
  popup(f.x,rimY-34,'+'+gain,k.gold?'#b9730a':'#2f6a33',k.gold?38:30);
  if(k.gold){
    if(st.hearts<5){st.hearts++;updateHud(st.hearts-1);popup(ch.x,rimY-70,'Heart back','#a83a28',26);}
    sfx.gold();
  }else sfx.catch(st.combo);
  updateHud();
}
function splat(f){
  const col=f.rotten?'#5f5124':(f.kind==='orange'?'#e9801c':f.kind==='apple'?'#b82f27':'#e9a21f');
  decals.push({x:f.x,y:f.y+3,col:col,life:1.8,max:1.8});
  burst(f.x,f.y,f.rotten?5:7,fruitColors(f),90,'dot');
  if(!f.rotten){st.combo=0;sfx.splat();}
}

/* ---------- input ---------- */
let drag=null;
stage.addEventListener('contextmenu',e=>e.preventDefault());
stage.addEventListener('pointerdown',e=>{
  if(mode!=='play')return;
  if(e.target.closest&&e.target.closest('button'))return;
  drag={id:e.pointerId,sx:e.clientX,tx:ch.target};
  try{stage.setPointerCapture(e.pointerId);}catch(x){}
});
stage.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id)return;
  ch.target=clamp(drag.tx+(e.clientX-drag.sx)/(SW/W)*1.3,38,W-38);
});
const endDrag=e=>{if(drag&&e.pointerId===drag.id)drag=null;};
stage.addEventListener('pointerup',endDrag); stage.addEventListener('pointercancel',endDrag);
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'||e.key==='p'||e.key==='P'){
    if(e.repeat)return;
    if(mode==='play'){e.preventDefault();pauseGame();}
    else if(mode==='paused'){e.preventDefault();resumeGame();}
    return;
  }
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A'){keys.left=true;if(mode==='play')e.preventDefault();}
  else if(e.key==='ArrowRight'||e.key==='d'||e.key==='D'){keys.right=true;if(mode==='play')e.preventDefault();}
});
window.addEventListener('keyup',e=>{
  if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A')keys.left=false;
  else if(e.key==='ArrowRight'||e.key==='d'||e.key==='D')keys.right=false;
});
window.addEventListener('blur',()=>{keys.left=keys.right=false;drag=null;pauseGame();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();});

/* ---------- update ---------- */
function update(dt){
  st.t+=dt;
  if(mode==='play'){
    const dir=(keys.right?1:0)-(keys.left?1:0);
    if(dir)ch.target=clamp(ch.target+dir*560*dt,38,W-38);
  }
  const px=ch.x;
  ch.x+=(ch.target-ch.x)*Math.min(1,16*dt);
  ch.vx=(ch.x-px)/Math.max(dt,0.001);
  ch.vxs=lerp(ch.vxs,ch.vx,Math.min(1,12*dt));
  ch.walk+=Math.abs(ch.vxs)*dt*0.075;
  ch.pulse=Math.max(0,ch.pulse-dt*4.5);
  if(ch.expT>0){ch.expT-=dt;if(ch.expT<=0&&mode!=='dying')ch.exp='idle';}
  for(let i=ch.drops.length-1;i>=0;i--){ch.drops[i].t+=dt;if(ch.drops[i].t>0.24)ch.drops.splice(i,1);}
  st.shake=Math.max(0,st.shake-dt);

  if(mode==='play'){
    st.elapsed+=dt; st.spawnT-=dt;
    if(st.spawnT<=0){
      const d=clamp(st.elapsed/100,0,1);
      spawnFruit(); st.spawnT=lerp(1.05,0.42,d)*(0.75+Math.random()*0.5);
    }
  }
  if(mode==='dying'){st.dieT-=dt;if(st.dieT<=0)finishGame();}

  const rimY=FEET_Y-79*S, hw=33*S+4;
  let near=null;
  for(let i=fruits.length-1;i>=0;i--){
    const f=fruits[i];
    f.y+=f.vy*dt; f.x+=Math.sin(f.ph+st.t*2.2)*8*dt; f.rot+=f.vr*dt;
    if(mode==='play'&&f.vy>0&&f.y+R*0.55>=rimY&&f.y-R*0.3<=rimY+24&&Math.abs(f.x-ch.x)<=hw+R*0.35){catchFruit(f);continue;}
    if(f.y>=f.landY){fruits.splice(i,1);splat(f);continue;}
    if(f.y<rimY&&(!near||f.y>near.y))near=f;
  }
  if(near&&mode==='play'){
    ch.gx=clamp((near.x-ch.x)/50,-1,1); ch.gy=-1;
    ch.worried=near.rotten&&rimY-near.y<170&&Math.abs(near.x-ch.x)<70&&ch.exp==='idle';
  }else{ch.gx*=0.9;ch.gy*=0.9;ch.worried=false;}

  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i]; p.life-=dt; if(p.life<=0){particles.splice(i,1);continue;}
    p.vy+=380*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=dt*4;
  }
  for(let i=popups.length-1;i>=0;i--){const p=popups[i];p.life-=dt;p.y-=38*dt;if(p.life<=0)popups.splice(i,1);}
  for(let i=decals.length-1;i>=0;i--){decals[i].life-=dt;if(decals[i].life<=0)decals.splice(i,1);}
  clouds.forEach(c=>{if(!reduceMotion){c.x+=c.v*dt;if(c.x>W+20)c.x=-c.w-20;}});
  petals.forEach(p=>{
    if(reduceMotion)return;
    p.x+=(p.vx+Math.sin(st.t*1.3+p.ph)*22)*dt; p.y+=p.vy*dt; p.rot+=p.vr*dt;
    if(p.y>H+10){p.y=-10;p.x=Math.random()*W;}
    if(p.x>W+10)p.x=-10; if(p.x<-10)p.x=W+10;
  });
}

/* ---------- character ---------- */
const SK='#6c4029', SKD='#54301e', SKL='#8a5636';
function drawLeg(x,bx,lift,dir){
  x.save(); x.translate(bx,-lift);
  x.fillStyle=SKD; x.fillRect(-3.8,-48,7.6,23);
  x.fillStyle='rgba(138,86,54,.55)'; x.fillRect(0.6,-48,2.2,23);
  x.fillStyle='#2e1a0e'; x.beginPath(); x.ellipse(dir*1.8,-1.8,10.8,2.8,0,0,TAU); x.fill();
  x.fillStyle='#7d4a27'; x.beginPath(); x.ellipse(dir*1.8,-5.6,9.6,5.6,0,0,TAU); x.fill();
  x.fillStyle='rgba(240,185,125,.35)'; x.beginPath(); x.ellipse(dir*3.8,-7.8,4.4,2,0,0,TAU); x.fill();
  const g=x.createLinearGradient(-6.5,0,6.5,0); g.addColorStop(0,'#6a3f20'); g.addColorStop(.55,'#8b552e'); g.addColorStop(1,'#5a3219');
  x.fillStyle=g; x.beginPath(); x.moveTo(-5.4,-28); x.lineTo(5.4,-28); x.lineTo(6.7,-9); x.lineTo(-6.7,-9); x.closePath(); x.fill();
  x.fillStyle='#5a3219'; x.fillRect(-6,-29.5,12,3.4); x.fillStyle='#a76d3a'; x.fillRect(-6,-29.5,12,1);
  x.strokeStyle='#e6c38e'; x.lineWidth=0.9; x.lineCap='round';
  for(let i=0;i<3;i++){x.beginPath();x.moveTo(-2.4,-23+i*4.2);x.lineTo(2.4,-22.2+i*4.2);x.stroke();}
  x.restore();
}
function skirtPath(x,hs){
  x.beginPath(); x.moveTo(-13,-70); x.lineTo(13,-70);
  x.quadraticCurveTo(17,-56,26+hs,-43); x.quadraticCurveTo(hs,-36,-26+hs,-43); x.quadraticCurveTo(-17,-56,-13,-70); x.closePath();
}
function drawSkirt(x,hs){
  const g=x.createLinearGradient(-26,0,26,0); g.addColorStop(0,'#c98f16'); g.addColorStop(.5,'#e8ae2c'); g.addColorStop(1,'#f4c75a');
  skirtPath(x,hs); x.fillStyle=g; x.fill();
  x.save(); skirtPath(x,hs); x.clip();
  x.strokeStyle='rgba(120,70,0,.22)'; x.lineWidth=1.1;
  [-8,2,11].forEach(px=>{x.beginPath();x.moveTo(px*0.5,-69);x.quadraticCurveTo(px*0.9+hs*0.2,-55,px*1.9+hs,-40);x.stroke();});
  x.strokeStyle='#2d3a6e'; x.lineWidth=13;
  x.beginPath(); x.moveTo(26+hs,-43); x.quadraticCurveTo(hs,-36,-26+hs,-43); x.stroke();
  x.fillStyle='#f3e9c9';
  for(let i=-3;i<=3;i++){
    const px=i*7.4, py=-39-3*Math.pow(px/26,2)-4.2;
    x.save(); x.translate(px+hs,py); x.rotate(Math.PI/4); x.fillRect(-1.5,-1.5,3,3); x.restore();
  }
  x.restore();
}
function drawFace(x){
  const e=ch.worried&&ch.exp==='idle'?'worried':ch.exp;
  const gx=ch.gx*1.0, gy=ch.gy*0.5;
  x.lineCap='round'; x.lineJoin='round';
  x.fillStyle='rgba(255,205,160,.14)'; ell(x,3,-114,7,6);
  x.fillStyle='rgba(188,84,60,.27)'; ell(x,-8.3,-105.4,3.1,2.1); ell(x,8.3,-105.4,3.1,2.1);
  x.fillStyle='rgba(255,225,190,.2)'; ell(x,0.3,-108,0.9,2.6);
  x.fillStyle='rgba(58,28,16,.5)'; ell(x,-1.8,-105.9,1.1,0.8); ell(x,1.8,-105.9,1.1,0.8);
  x.fillStyle='rgba(255,225,190,.28)'; ell(x,0,-106.7,1.4,0.8);
  const brow=(s,y1,y2)=>{x.strokeStyle='#1a110c';x.lineWidth=1.35;x.beginPath();x.moveTo(s*2.7,y1);x.quadraticCurveTo(s*5.5,Math.min(y1,y2)-1.5,s*8.3,y2);x.stroke();};
  if(e==='happy'){
    x.strokeStyle='#1d120c'; x.lineWidth=1.35;
    [-1,1].forEach(s=>{x.beginPath();x.arc(s*5.3,-110,2.6,Math.PI*1.1,Math.PI*1.9);x.stroke();});
    brow(-1,-115.9,-116.2); brow(1,-115.9,-116.2);
    x.fillStyle='#5a1f22'; x.beginPath(); x.moveTo(-4.3,-102); x.quadraticCurveTo(0,-96.4,4.3,-102); x.closePath(); x.fill();
    x.fillStyle='#f6efe3'; x.beginPath(); x.moveTo(-3.7,-101.8); x.quadraticCurveTo(0,-100.2,3.7,-101.8); x.quadraticCurveTo(0,-102.5,-3.7,-101.8); x.fill();
    x.fillStyle='#b9535a'; ell(x,0,-98.8,1.7,0.9);
  }else if(e==='hurt'){
    x.strokeStyle='#1d120c'; x.lineWidth=1.3;
    [-1,1].forEach(s=>{x.beginPath();x.moveTo(s*7.6,-113);x.lineTo(s*3.9,-111);x.lineTo(s*7.6,-109);x.stroke();});
    brow(-1,-113.4,-115.8); brow(1,-113.4,-115.8);
    x.strokeStyle='#6e2a2b'; x.lineWidth=1.2;
    x.beginPath(); x.moveTo(-3.6,-100.3); x.lineTo(-2.1,-101.5); x.lineTo(-0.6,-100.3); x.lineTo(0.9,-101.5); x.lineTo(2.4,-100.3); x.lineTo(3.6,-101.3); x.stroke();
    x.fillStyle='rgba(140,200,225,.85)'; x.beginPath(); x.moveTo(11,-118); x.quadraticCurveTo(13,-114.5,11,-113); x.quadraticCurveTo(9,-114.5,11,-118); x.fill();
  }else{
    const wide=e==='worried'?2.8:2.3;
    [-1,1].forEach(s=>{
      x.fillStyle='#f4ece0'; ell(x,s*5.3,-111,2.6,wide);
      x.fillStyle='#2a1710'; ell(x,s*5.3+gx*0.9,-111+gy*0.7,1.7,1.8);
      x.fillStyle='rgba(255,255,255,.85)'; ell(x,s*5.3+gx*0.9-0.5,-111.6+gy*0.7,0.5,0.5);
      x.strokeStyle='#1d120c'; x.lineWidth=1.1;
      x.beginPath(); x.arc(s*5.3,-111,2.7,Math.PI*1.08,Math.PI*1.92); x.stroke();
      x.beginPath(); x.moveTo(s*7.7,-112); x.lineTo(s*8.9,-113.2); x.stroke();
    });
    if(e==='worried'){brow(-1,-116.8,-114.2);brow(1,-116.8,-114.2);x.fillStyle='#5a1f22';ell(x,0,-100.8,1.5,1.9);}
    else{
      brow(-1,-114.8,-114.9); brow(1,-114.8,-114.9);
      x.strokeStyle='#6e2a2b'; x.lineWidth=1.2; x.beginPath(); x.moveTo(-3.7,-101.9); x.quadraticCurveTo(0,-99,3.7,-101.9); x.stroke();
      x.fillStyle='rgba(168,84,76,.7)'; ell(x,0,-100.3,1.7,0.7);
    }
  }
}
function drawBasketBack(x){
  x.fillStyle='#3d2614'; x.beginPath(); x.ellipse(0,0,33,6.5,0,0,TAU); x.fill();
  x.strokeStyle='#8a5a2a'; x.lineWidth=3; x.beginPath(); x.ellipse(0,0,33,6.5,0,Math.PI,TAU); x.stroke();
}
function basketBodyPath(x){
  x.beginPath(); x.moveTo(-33,0); x.bezierCurveTo(-33,9,-18,13.5,0,13.5); x.bezierCurveTo(18,13.5,33,9,33,0);
  x.lineTo(25,24); x.quadraticCurveTo(22,28.5,16,28.5); x.lineTo(-16,28.5); x.quadraticCurveTo(-22,28.5,-25,24); x.closePath();
}
function drawBasketFront(x){
  const g=x.createLinearGradient(-33,0,33,0); g.addColorStop(0,'#a9702f'); g.addColorStop(.5,'#d39c52'); g.addColorStop(1,'#b17835');
  basketBodyPath(x); x.fillStyle=g; x.fill();
  x.save(); basketBodyPath(x); x.clip();
  x.lineWidth=1; x.strokeStyle='rgba(95,58,22,.55)';
  for(let i=0;i<6;i++){const yy=4+i*4.6;x.beginPath();x.moveTo(-34,yy);x.quadraticCurveTo(0,yy+11,34,yy);x.stroke();}
  x.strokeStyle='rgba(232,190,120,.5)';
  for(let r=0;r<6;r++){for(let c=-6;c<=6;c++){const xx=c*5.4+(r%2)*2.7,yy=5+r*4.6+Math.abs(xx)*0.012*Math.abs(xx);x.beginPath();x.moveTo(xx,yy-1.8);x.lineTo(xx,yy+1.8);x.stroke();}}
  x.restore();
  x.strokeStyle='#7a4d22'; x.lineWidth=3.6; x.lineCap='round';
  x.beginPath(); x.moveTo(-33,0); x.bezierCurveTo(-33,9,-18,13.5,0,13.5); x.bezierCurveTo(18,13.5,33,9,33,0); x.stroke();
  x.strokeStyle='rgba(235,190,125,.7)'; x.lineWidth=1;
  x.beginPath(); x.moveTo(-31,-0.6); x.bezierCurveTo(-31,7.6,-17,11.7,0,11.7); x.bezierCurveTo(17,11.7,31,7.6,31,-0.6); x.stroke();
}
function drawChar(x){
  const t=st.t;
  const lean=clamp(ch.vxs/1100,-0.09,0.09);
  const walkAmp=clamp(Math.abs(ch.vxs)/150,0,1);
  const sw=Math.sin(ch.walk)*walkAmp;
  const bob=Math.sin(t*2.2)*0.7*(1-walkAmp)-Math.abs(Math.sin(ch.walk))*1.6*walkAmp;
  x.save(); x.translate(ch.x,FEET_Y);
  x.fillStyle='rgba(22,44,24,.3)'; x.beginPath(); x.ellipse(0,1,32*S,6.5*S,0,0,TAU); x.fill();
  x.scale(S,S);
  drawLeg(x,-11,Math.max(0,sw)*4,-1);
  drawLeg(x,11,Math.max(0,-sw)*4,1);
  x.save(); x.translate(0,-52); x.rotate(lean); x.translate(0,52+bob);
  drawSkirt(x,-clamp(ch.vxs/70,-6,6));
  // afro behind head and shoulders
  x.save(); x.translate(0,-112); x.rotate(-lean*0.7+Math.sin(t*1.6)*0.012); x.drawImage(afro,-44,-53,88,88); x.restore();
  // neck and chest
  x.fillStyle=SKD; x.fillRect(-4.8,-102,9.6,11);
  x.fillStyle=SK; ell(x,0,-95,6.4,5);
  // bodice
  const bg=x.createLinearGradient(-15,0,15,0); bg.addColorStop(0,'#c98f16'); bg.addColorStop(.5,'#e8ae2c'); bg.addColorStop(1,'#f4c75a');
  x.fillStyle=bg; x.beginPath(); x.moveTo(-15,-94); x.quadraticCurveTo(-8,-97.4,-5,-94.5); x.quadraticCurveTo(0,-89,5,-94.5); x.quadraticCurveTo(8,-97.4,15,-94);
  x.lineTo(13,-69); x.lineTo(-13,-69); x.closePath(); x.fill();
  x.fillStyle='#2d3a6e'; x.fillRect(-13.4,-72.4,26.8,3.8);
  // head
  const hg=x.createLinearGradient(-13,0,13,0); hg.addColorStop(0,'#5d3520'); hg.addColorStop(.5,'#744529'); hg.addColorStop(1,'#86542f');
  x.fillStyle='#5a3320'; ell(x,-13.2,-109.5,2.6,3.8); ell(x,13.2,-109.5,2.6,3.8);
  x.fillStyle=hg; x.beginPath(); x.moveTo(-13.2,-112); x.bezierCurveTo(-13.2,-123,13.2,-123,13.2,-112);
  x.bezierCurveTo(13.2,-103,7,-96.4,0,-96.4); x.bezierCurveTo(-7,-96.4,-13.2,-103,-13.2,-112); x.closePath(); x.fill();
  drawFace(x);
  // hairline
  x.fillStyle='#1a110c'; x.beginPath(); x.moveTo(-13.6,-111); x.bezierCurveTo(-14.5,-128,14.5,-128,13.6,-111);
  x.bezierCurveTo(10,-119.7,-10,-119.7,-13.6,-111); x.fill();
  // earrings
  x.strokeStyle='#f0c24a'; x.lineWidth=1.1; [-1,1].forEach(s=>{x.beginPath();x.arc(s*13.4,-103.6,2.4,0,TAU);x.stroke();});
  // arms
  const hy=-78;
  x.lineCap='round'; x.lineJoin='round';
  [-1,1].forEach(s=>{
    x.strokeStyle=SK; x.lineWidth=6.4; x.beginPath(); x.moveTo(s*14,-91); x.lineTo(s*25.5,-85); x.lineTo(s*31.5,hy); x.stroke();
    x.strokeStyle='rgba(138,86,54,.6)'; x.lineWidth=2; x.beginPath(); x.moveTo(s*14.6+s*0.8,-91.5); x.lineTo(s*26.3,-85.6); x.lineTo(s*32.2,hy-0.5); x.stroke();
    x.fillStyle='#e8ae2c'; x.beginPath(); x.arc(s*14.5,-91.5,6,0,TAU); x.fill();
    x.fillStyle='rgba(120,70,0,.2)'; x.beginPath(); x.arc(s*14.5+s*1.2,-90.5,4.2,0,TAU); x.fill();
  });
  // basket
  x.save(); x.translate(0,-79); const p=ch.pulse*ch.pulse; x.scale(1+0.07*p,1-0.1*p);
  drawBasketBack(x);
  ch.drops.forEach(d=>{
    const u=clamp(d.t/0.24,0,1), sc=lerp(0.95,0.5,u), fx=d.dx*(1-u*0.6), fy=lerp(-16,6,u);
    x.drawImage(sprites[d.sprite],fx-32*sc,fy-32*sc,64*sc,64*sc);
  });
  drawBasketFront(x);
  x.restore();
  // hands
  [-1,1].forEach(s=>{x.fillStyle=SK;ell(x,s*32,hy,4.2,4.4);x.fillStyle='rgba(138,86,54,.6)';ell(x,s*32.6,hy-1,1.8,2);});
  x.restore();
  x.restore();
}

/* ---------- draw ---------- */
function drawStar(x,cx,cy,s,rot){
  x.save(); x.translate(cx,cy); x.rotate(rot);
  x.beginPath(); x.moveTo(0,-s); x.lineTo(s*0.28,-s*0.28); x.lineTo(s,0); x.lineTo(s*0.28,s*0.28);
  x.lineTo(0,s); x.lineTo(-s*0.28,s*0.28); x.lineTo(-s,0); x.lineTo(-s*0.28,-s*0.28); x.closePath(); x.fill(); x.restore();
}
function drawFruits(x){
  fruits.forEach(f=>{
    x.save(); x.translate(f.x,f.y); x.rotate(f.rot);
    x.drawImage(sprites[f.sprite],-SPR/2,-SPR/2,SPR,SPR);
    x.restore();
    if(f.rotten){
      for(let i=0;i<2;i++){
        const a=st.t*(5+i*1.7)+f.ph+i*3, ex=f.x+Math.cos(a)*22, ey=f.y-6+Math.sin(a*1.3)*12;
        x.fillStyle='#1c1a16'; ell(x,ex,ey,2.1,1.6);
        x.fillStyle='rgba(240,248,255,.8)'; ell(x,ex-1,ey-1.6,2.3,1.1,null,-0.4);
      }
      x.strokeStyle='rgba(222,230,110,.9)'; x.lineWidth=1.8; x.lineCap='round';
      [-8,8].forEach(k=>{
        x.beginPath();
        for(let j=0;j<9;j++){
          const yy=f.y-24-j*3.2, xx=f.x+k+Math.sin(st.t*5+j*0.9+k)*2.4;
          if(j)x.lineTo(xx,yy); else x.moveTo(xx,yy);
        }
        x.stroke();
      });
    }else if(f.kind==='mango_gold'){
      x.fillStyle='#fffbe0';
      drawStar(x,f.x-20,f.y-14+Math.sin(st.t*5)*2,4+Math.sin(st.t*7)*1.5,st.t*2);
      drawStar(x,f.x+21,f.y+10+Math.cos(st.t*5)*2,3.5+Math.cos(st.t*6)*1.4,-st.t*2);
    }
  });
}
function draw(){
  const x=ctx;
  x.setTransform(K,0,0,K,0,0);
  x.clearRect(0,0,W,H);
  x.save();
  if(st.shake>0){x.translate((Math.random()-.5)*7*st.shake*3,(Math.random()-.5)*5*st.shake*3);}
  x.drawImage(bgSky.c,0,0,W,H);
  clouds.forEach(c=>x.drawImage(c.s,c.x,c.y,c.w,c.h));
  x.drawImage(bgScene.c,0,0,W,H);
  // petals and drifting leaves
  petals.forEach(p=>{
    x.save(); x.translate(p.x,p.y); x.rotate(p.rot); x.fillStyle=p.c; x.globalAlpha=0.85;
    x.beginPath(); x.ellipse(0,0,p.s,p.s*0.5,0,0,TAU); x.fill(); x.restore();
  });
  x.globalAlpha=1;
  // splats
  decals.forEach(d=>{
    x.globalAlpha=clamp(d.life/d.max,0,1)*0.6; x.fillStyle=d.col;
    x.beginPath(); x.ellipse(d.x,d.y,15,4.4,0,0,TAU); x.fill();
  });
  x.globalAlpha=1;
  drawFruits(x);
  drawChar(x);
  x.drawImage(fgTop.c,0,0,W,H);
  // particles
  particles.forEach(p=>{
    x.globalAlpha=clamp(p.life/p.max,0,1); x.fillStyle=p.c;
    if(p.type==='spark')drawStar(x,p.x,p.y,p.r*1.6,p.rot);
    else{x.beginPath();x.arc(p.x,p.y,p.r,0,TAU);x.fill();}
  });
  x.globalAlpha=1;
  // popups
  x.textAlign='center'; x.textBaseline='middle'; x.lineJoin='round';
  popups.forEach(p=>{
    const a=clamp(p.life/p.max*1.6,0,1);
    x.globalAlpha=a; x.font=p.size+'px "Caveat Brush","Segoe Script",cursive';
    x.lineWidth=5; x.strokeStyle='rgba(247,251,236,.95)'; x.strokeText(p.text,p.x,p.y);
    x.fillStyle=p.color; x.fillText(p.text,p.x,p.y);
  });
  x.globalAlpha=1;
  x.restore();
}

/* ---------- layout ---------- */
let lastDims='';
function layout(force){
  const r=app.getBoundingClientRect();
  const aw=Math.max(240,r.width), ah=Math.max(320,r.height);
  const sw0=Math.min(aw,ah*0.62);
  const lh=Math.min(900,400*ah/sw0);
  const sw=sw0, sh=sw*lh/W;
  const key=Math.round(sw)+'x'+Math.round(sh)+'@'+(window.devicePixelRatio||1);
  if(!force&&key===lastDims)return;
  lastDims=key;
  dpr=Math.min(window.devicePixelRatio||1,2);
  SW=sw; SH=sh; H=lh;
  stage.style.width=SW+'px'; stage.style.height=SH+'px';
  cv.width=Math.round(SW*dpr); cv.height=Math.round(SH*dpr);
  K=cv.width/W;
  rebuild();
  fruits.forEach(f=>{f.landY=FEET_Y+6+Math.random()*16;});
  if(!petals.length){
    const pc=['#f4b9b4','#fbf3e2','#f6d56a','#9fcf72','#f0a08e'];
    for(let i=0;i<12;i++)petals.push({x:Math.random()*W,y:Math.random()*H,vx:6+Math.random()*10,vy:14+Math.random()*18,rot:Math.random()*TAU,vr:(Math.random()-.5)*3,s:2.6+Math.random()*2.4,c:pc[i%pc.length],ph:Math.random()*TAU});
  }
}
let rt=0;
window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>layout(false),140);});
window.addEventListener('orientationchange',()=>{clearTimeout(rt);rt=setTimeout(()=>layout(false),250);});

/* ---------- boot ---------- */
let last=0;
function frame(ts){
  const dt=Math.min(0.05,(ts-last)/1000||0.016);
  last=ts;
  if(mode!=='paused')update(dt);
  draw();
  requestAnimationFrame(frame);
}
function boot(){
  paintSoundBtn(); paintMenuBest(); bestEl.textContent=best;
  layout(true);
  if(document.fonts&&document.fonts.load){try{document.fonts.load('30px "Caveat Brush"');}catch(e){}}
  try{$('play').focus({preventScroll:true});}catch(e){}
  requestAnimationFrame(frame);
}
boot();
})();