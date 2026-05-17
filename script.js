/* =====================================================
   🥁 BATERIA VIRTUAL PRO — SONS E VISUAL PREMIUM
   4 Dispositivos | Hi-Hat Aberto/Fechado
   PeerJS + Web Audio API com Reverb e Compressor
   ===================================================== */
const APP = (() => {

const $ = id => document.getElementById(id);
const SCREENS = ['menu','kit-setup','drum-ui','stick-setup','stick-ctrl','pedal-setup','pedal-ctrl'];
function showScreen(id){SCREENS.forEach(s=>{$(s).style.display='none';$(s).classList.remove('active');});$(id).style.display='flex';$(id).classList.add('active');}
function showOv(id){$(id).style.display='flex';$(id).classList.add('show');}
function hideOv(id){$(id).style.display='none';$(id).classList.remove('show');}

// ===================== PEÇAS =====================
const DRUMS = {
    kick:   {name:'Bumbo',  emoji:'🥁',color:'#3a3a3a',x:.50,y:.80,rx:70,ry:42,type:'drum'},
    snare:  {name:'Caixa',  emoji:'🥁',color:'#cfd8dc',x:.35,y:.60,rx:40,ry:25,type:'drum'},
    hihat:  {name:'Hi-Hat', emoji:'🎩',color:'#ffd54f',x:.12,y:.38,rx:36,ry:11,type:'cymbal'},
    tom1:   {name:'Tom 1',  emoji:'🔴',color:'#e53935',x:.36,y:.38,rx:30,ry:18,type:'drum'},
    tom2:   {name:'Tom 2',  emoji:'🟠',color:'#ff9800',x:.60,y:.38,rx:30,ry:18,type:'drum'},
    floor:  {name:'Surdo',  emoji:'🟤',color:'#6d4c41',x:.80,y:.56,rx:42,ry:28,type:'drum'},
    crash:  {name:'Crash',  emoji:'💛',color:'#fdd835',x:.18,y:.18,rx:42,ry:12,type:'cymbal'},
    ride:   {name:'Ride',   emoji:'💿',color:'#90a4ae',x:.82,y:.20,rx:46,ry:14,type:'cymbal'},
    china:  {name:'China',  emoji:'🔔',color:'#ab47bc',x:.08,y:.22,rx:34,ry:10,type:'cymbal'},
    splash: {name:'Splash', emoji:'💦',color:'#26c6da',x:.50,y:.16,rx:26,ry:8, type:'cymbal'}
};

// ===================== AUDIO ENGINE =====================
let audioCtx=null, masterGain=null, compressor=null, convolver=null;
let hihatOpen=false;

function initAudio(){
    if(audioCtx)return;
    audioCtx=new(window.AudioContext||window.webkitAudioContext)();

    // Master chain: Compressor -> Gain -> Destination
    compressor=audioCtx.createDynamicsCompressor();
    compressor.threshold.value=-12;
    compressor.knee.value=6;
    compressor.ratio.value=4;
    compressor.attack.value=.003;
    compressor.release.value=.15;

    masterGain=audioCtx.createGain();
    masterGain.gain.value=0.85;

    // Reverb
    convolver=audioCtx.createConvolver();
    const reverbGain=audioCtx.createGain();
    reverbGain.gain.value=0.15;
    createReverb().then(buf=>{convolver.buffer=buf;});

    // Dry path
    compressor.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    // Wet path (reverb)
    compressor.connect(convolver);
    convolver.connect(reverbGain);
    reverbGain.connect(audioCtx.destination);
}

async function createReverb(){
    const sr=audioCtx.sampleRate;
    const len=sr*1.2;
    const buf=audioCtx.createBuffer(2,len,sr);
    for(let ch=0;ch<2;ch++){
        const d=buf.getChannelData(ch);
        for(let i=0;i<len;i++){
            d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.5);
        }
    }
    return buf;
}

function out(){return compressor;}

function playDrum(id,vel){
    if(!audioCtx)initAudio();
    vel=Math.min(vel||.8,1);
    const t=audioCtx.currentTime;
    switch(id){
        case 'kick':    synthKick(t,vel);break;
        case 'snare':   synthSnare(t,vel);break;
        case 'hihat':   hihatOpen?synthHHOpen(t,vel):synthHHClosed(t,vel);break;
        case 'tom1':    synthTom(t,vel,200,180);break;
        case 'tom2':    synthTom(t,vel,150,130);break;
        case 'floor':   synthTom(t,vel,90,75);break;
        case 'crash':   synthCymbal(t,vel,1.2,4500,.7);break;
        case 'ride':    synthCymbal(t,vel,.5,6500,.3);break;
        case 'china':   synthCymbal(t,vel,.9,3200,.8);break;
        case 'splash':  synthCymbal(t,vel,.3,7500,.5);break;
    }
}

function synthKick(t,v){
    // Sub
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(150,t);
    o.frequency.exponentialRampToValueAtTime(30,t+.15);
    g.gain.setValueAtTime(v*1.5,t);
    g.gain.setValueAtTime(v*1.4,t+.01);
    g.gain.exponentialRampToValueAtTime(.001,t+.5);
    o.connect(g);g.connect(out());
    o.start(t);o.stop(t+.5);

    // Body
    const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
    o2.type='triangle';
    o2.frequency.setValueAtTime(80,t);
    o2.frequency.exponentialRampToValueAtTime(25,t+.12);
    g2.gain.setValueAtTime(v*.6,t);
    g2.gain.exponentialRampToValueAtTime(.001,t+.3);
    o2.connect(g2);g2.connect(out());
    o2.start(t);o2.stop(t+.3);

    // Click/transient
    const n=noise(audioCtx,.02);
    const nf=audioCtx.createBiquadFilter();nf.type='bandpass';nf.frequency.value=3500;nf.Q.value=2;
    const ng=audioCtx.createGain();ng.gain.setValueAtTime(v*.7,t);ng.gain.exponentialRampToValueAtTime(.001,t+.02);
    n.connect(nf);nf.connect(ng);ng.connect(out());
    n.start(t);n.stop(t+.03);
}

function synthSnare(t,v){
    // Tone
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.type='triangle';o.frequency.setValueAtTime(240,t);
    o.frequency.exponentialRampToValueAtTime(130,t+.06);
    g.gain.setValueAtTime(v*.65,t);g.gain.exponentialRampToValueAtTime(.001,t+.1);
    o.connect(g);g.connect(out());o.start(t);o.stop(t+.12);

    // Body
    const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
    o2.type='sine';o2.frequency.setValueAtTime(180,t);
    o2.frequency.exponentialRampToValueAtTime(100,t+.05);
    g2.gain.setValueAtTime(v*.35,t);g2.gain.exponentialRampToValueAtTime(.001,t+.08);
    o2.connect(g2);g2.connect(out());o2.start(t);o2.stop(t+.1);

    // Snare wires (noise)
    const n=noise(audioCtx,.2);
    const hp=audioCtx.createBiquadFilter();hp.type='highpass';hp.frequency.value=2500;
    const pk=audioCtx.createBiquadFilter();pk.type='peaking';pk.frequency.value=5000;pk.gain.value=6;pk.Q.value=1;
    const ng=audioCtx.createGain();ng.gain.setValueAtTime(v*1,t);
    ng.gain.setValueAtTime(v*.7,t+.01);ng.gain.exponentialRampToValueAtTime(.001,t+.18);
    n.connect(hp);hp.connect(pk);pk.connect(ng);ng.connect(out());
    n.start(t);n.stop(t+.2);
}

function synthHHClosed(t,v){
    const n=noise(audioCtx,.06);
    const hp=audioCtx.createBiquadFilter();hp.type='highpass';hp.frequency.value=7500;
    const bp=audioCtx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=10000;bp.Q.value=1.8;
    const g=audioCtx.createGain();g.gain.setValueAtTime(v*.5,t);g.gain.exponentialRampToValueAtTime(.001,t+.045);
    n.connect(hp);hp.connect(bp);bp.connect(g);g.connect(out());
    n.start(t);n.stop(t+.06);

    // Metallic ping
    const o=audioCtx.createOscillator(),og=audioCtx.createGain();
    o.type='square';o.frequency.value=420;
    og.gain.setValueAtTime(v*.03,t);og.gain.exponentialRampToValueAtTime(.001,t+.02);
    o.connect(og);og.connect(out());o.start(t);o.stop(t+.03);
}

function synthHHOpen(t,v){
    const n=noise(audioCtx,.55);
    const hp=audioCtx.createBiquadFilter();hp.type='highpass';hp.frequency.value=5500;
    const bp=audioCtx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=7500;bp.Q.value=.6;
    const g=audioCtx.createGain();
    g.gain.setValueAtTime(v*.6,t);
    g.gain.setValueAtTime(v*.4,t+.03);
    g.gain.exponentialRampToValueAtTime(.001,t+.5);
    n.connect(hp);hp.connect(bp);bp.connect(g);g.connect(out());
    n.start(t);n.stop(t+.55);

    // Shimmer
    [6200,8100,11500].forEach(f=>{
        const o=audioCtx.createOscillator(),og=audioCtx.createGain();
        o.type='sine';o.frequency.value=f;
        og.gain.setValueAtTime(v*.015,t);og.gain.exponentialRampToValueAtTime(.001,t+.35);
        o.connect(og);og.connect(out());o.start(t);o.stop(t+.4);
    });
}

function synthHHChick(t,v){
    const n=noise(audioCtx,.025);
    const hp=audioCtx.createBiquadFilter();hp.type='highpass';hp.frequency.value=9000;
    const g=audioCtx.createGain();g.gain.setValueAtTime(v*.4,t);g.gain.exponentialRampToValueAtTime(.001,t+.02);
    n.connect(hp);hp.connect(g);g.connect(out());n.start(t);n.stop(t+.03);
}

function synthTom(t,v,f1,f2){
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.type='sine';o.frequency.setValueAtTime(f1*1.2,t);
    o.frequency.exponentialRampToValueAtTime(f2*.5,t+.3);
    g.gain.setValueAtTime(v*1,t);g.gain.exponentialRampToValueAtTime(.001,t+.45);
    o.connect(g);g.connect(out());o.start(t);o.stop(t+.45);

    // Overtone
    const o2=audioCtx.createOscillator(),g2=audioCtx.createGain();
    o2.type='sine';o2.frequency.setValueAtTime(f1*2.4,t);
    o2.frequency.exponentialRampToValueAtTime(f2*1.2,t+.15);
    g2.gain.setValueAtTime(v*.2,t);g2.gain.exponentialRampToValueAtTime(.001,t+.15);
    o2.connect(g2);g2.connect(out());o2.start(t);o2.stop(t+.18);

    // Attack
    const n=noise(audioCtx,.015);
    const bp=audioCtx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=f1*3;bp.Q.value=2;
    const ng=audioCtx.createGain();ng.gain.setValueAtTime(v*.25,t);ng.gain.exponentialRampToValueAtTime(.001,t+.015);
    n.connect(bp);bp.connect(ng);ng.connect(out());n.start(t);n.stop(t+.02);
}

function synthCymbal(t,v,sus,freq,bright){
    const dur=.4+sus*2;

    // Noise body
    const n=noise(audioCtx,dur);
    const hp=audioCtx.createBiquadFilter();hp.type='highpass';hp.frequency.value=3000+bright*2000;
    const bp=audioCtx.createBiquadFilter();bp.type='peaking';bp.frequency.value=freq;bp.gain.value=8;bp.Q.value=.5;
    const g=audioCtx.createGain();
    g.gain.setValueAtTime(v*.7,t);
    g.gain.setValueAtTime(v*.45,t+.02);
    g.gain.exponentialRampToValueAtTime(.001,t+dur);
    n.connect(hp);hp.connect(bp);bp.connect(g);g.connect(out());
    n.start(t);n.stop(t+dur);

    // Metallic partials
    const freqs=[freq*.8,freq*1.2,freq*1.6,freq*2.1];
    freqs.forEach((f,i)=>{
        const o=audioCtx.createOscillator(),og=audioCtx.createGain();
        o.type='sine';o.frequency.value=f+(Math.random()-.5)*50;
        og.gain.setValueAtTime(v*(.04-i*.008),t);
        og.gain.exponentialRampToValueAtTime(.001,t+dur*.7);
        o.connect(og);og.connect(out());o.start(t);o.stop(t+dur*.7);
    });
}

function noise(ctx,dur){
    const bs=ctx.sampleRate*dur;
    const buf=ctx.createBuffer(1,bs,ctx.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<bs;i++) d[i]=Math.random()*2-1;
    const src=ctx.createBufferSource();src.buffer=buf;
    return src;
}

// ===================== CANVAS =====================
const canvas=$('dc'),ctx=canvas.getContext('2d');
let CW=800,CH=600;
let hitAnims={},comboCount=0,lastHitTime=0;
let stickParticles=[];

function resizeCanvas(){
    const mw=Math.min(1000,window.innerWidth-10),mh=window.innerHeight-40;
    const r=4/3;let w=mw,h=w/r;if(h>mh){h=mh;w=h*r;}
    CW=canvas.width=Math.floor(w);CH=canvas.height=Math.floor(h);
}

function renderLoop(){renderKit();requestAnimationFrame(renderLoop);}

function renderKit(){
    // BG
    const bg=ctx.createRadialGradient(CW/2,CH*.35,0,CW/2,CH*.35,CW*.8);
    bg.addColorStop(0,'#16162a');bg.addColorStop(.5,'#0e0e1a');bg.addColorStop(1,'#08080c');
    ctx.fillStyle=bg;ctx.fillRect(0,0,CW,CH);

    // Stage light
    ctx.save();ctx.globalAlpha=.03;
    const lg=ctx.createRadialGradient(CW/2,0,0,CW/2,0,CW*.6);
    lg.addColorStop(0,'#ff9800');lg.addColorStop(1,'transparent');
    ctx.fillStyle=lg;ctx.fillRect(0,0,CW,CH*.6);
    ctx.restore();

    // Floor reflection
    const fg=ctx.createLinearGradient(0,CH*.7,0,CH);
    fg.addColorStop(0,'rgba(255,255,255,.01)');fg.addColorStop(1,'rgba(255,255,255,.002)');
    ctx.fillStyle=fg;ctx.fillRect(0,CH*.7,CW,CH*.3);

    // Hardware (stands)
    drawStands();

    // Pieces
    const order=['kick','floor','snare','tom1','tom2','china','crash','splash','ride','hihat'];
    order.forEach(id=>drawPiece(id));

    // Particles
    updateParticles();
}

function drawStands(){
    ctx.strokeStyle='rgba(150,150,150,.12)';ctx.lineWidth=2;
    // Hi-hat stand
    const hh=DRUMS.hihat;
    ctx.beginPath();ctx.moveTo(hh.x*CW,hh.y*CH+hh.ry*(CH/600));
    ctx.lineTo(hh.x*CW,CH*.85);ctx.stroke();
    // Cymbal stands
    ['crash','ride','china','splash'].forEach(id=>{
        const d=DRUMS[id];
        ctx.beginPath();ctx.moveTo(d.x*CW,d.y*CH+5);ctx.lineTo(d.x*CW,CH*.75);ctx.stroke();
    });
}

function drawPiece(id){
    const d=DRUMS[id],cx=d.x*CW,cy=d.y*CH;
    const rx=d.rx*(CW/800),ry=d.ry*(CH/600);
    const now=Date.now(),a=hitAnims[id];
    let scale=1,glow=0;
    if(a){const el=now-a.time;if(el<350){const t=el/350;scale=1+(1-t)*.15*a.vel;glow=(1-t)*a.vel;}else delete hitAnims[id];}

    ctx.save();ctx.translate(cx,cy);ctx.scale(scale,scale);

    if(id==='kick'){
        // Shell
        const sg=ctx.createLinearGradient(-rx,-ry*1.3,rx,ry*1.3);
        sg.addColorStop(0,'#1a1a1a');sg.addColorStop(.5,'#2a2a2a');sg.addColorStop(1,'#151515');
        ctx.fillStyle=sg;ctx.beginPath();ctx.ellipse(0,0,rx,ry*1.3,0,0,Math.PI*2);ctx.fill();
        // Reso head
        const rg=ctx.createRadialGradient(-rx*.15,-ry*.2,0,0,0,rx*.82);
        rg.addColorStop(0,'#fafafa');rg.addColorStop(.7,'#e8e8e8');rg.addColorStop(1,'#c0c0c0');
        ctx.fillStyle=rg;ctx.beginPath();ctx.ellipse(0,0,rx*.82,ry*1.05,0,0,Math.PI*2);ctx.fill();
        // Logo
        ctx.fillStyle='rgba(30,30,30,.15)';ctx.font=`bold ${rx*.25}px 'Bebas Neue',sans-serif`;
        ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('DRUMKIT',0,-ry*.15);
        ctx.font=`${rx*.12}px sans-serif`;ctx.fillText('CUSTOM',0,ry*.15);
        // Hoop
        ctx.strokeStyle='#444';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,rx,ry*1.3,0,0,Math.PI*2);ctx.stroke();
        // Lugs
        for(let i=0;i<8;i++){
            const ang=i/8*Math.PI*2;
            ctx.fillStyle='#555';ctx.beginPath();
            ctx.arc(Math.cos(ang)*rx*.92,Math.sin(ang)*ry*1.2,3,0,Math.PI*2);ctx.fill();
        }
    } else if(d.type==='cymbal'){
        // Shadow
        ctx.fillStyle='rgba(0,0,0,.15)';ctx.beginPath();ctx.ellipse(3,3,rx,ry,0,0,Math.PI*2);ctx.fill();
        // Cymbal body
        const cg=ctx.createRadialGradient(-rx*.25,-ry*.3,0,0,0,rx);
        const col=id==='hihat'?(hihatOpen?'#ffee58':'#ffd54f'):d.color;
        cg.addColorStop(0,lighten(col,.3));cg.addColorStop(.4,col);cg.addColorStop(.8,darken(col,.2));cg.addColorStop(1,darken(col,.4));
        ctx.fillStyle=cg;ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.fill();
        // Lathing grooves
        ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=.5;
        for(let r2=rx*.2;r2<rx;r2+=rx*.08){ctx.beginPath();ctx.ellipse(0,0,r2,r2*(ry/rx),0,0,Math.PI*2);ctx.stroke();}
        // Bell
        const bg2=ctx.createRadialGradient(0,0,0,0,0,rx*.1);
        bg2.addColorStop(0,lighten(col,.4));bg2.addColorStop(1,col);
        ctx.fillStyle=bg2;ctx.beginPath();ctx.ellipse(0,0,rx*.1,ry*.2,0,0,Math.PI*2);ctx.fill();
        // Edge highlight
        ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;
        ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.stroke();
        // Hi-hat label
        if(id==='hihat'){
            ctx.fillStyle=hihatOpen?'rgba(255,255,100,.5)':'rgba(255,200,50,.35)';
            ctx.font=`bold ${rx*.22}px sans-serif`;ctx.textAlign='center';
            ctx.fillText(hihatOpen?'OPEN':'CLOSED',0,ry+14);
        }
    } else {
        // Shell side
        const sc=darken(d.color,.3);
        ctx.fillStyle=sc;ctx.globalAlpha=.5;
        ctx.beginPath();ctx.ellipse(0,ry*.35,rx,ry*.55,0,0,Math.PI);ctx.fill();
        ctx.globalAlpha=1;
        // Shell wrap
        ctx.strokeStyle=d.color;ctx.lineWidth=6;
        ctx.beginPath();ctx.ellipse(0,ry*.18,rx+1,ry*.65,0,.15,Math.PI-.15);ctx.stroke();
        // Head
        const hg=ctx.createRadialGradient(-rx*.12,-ry*.15,0,0,0,rx*.88);
        hg.addColorStop(0,'#fefefe');hg.addColorStop(.6,'#eeeeee');hg.addColorStop(1,'#cccccc');
        ctx.fillStyle=hg;ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.fill();
        // Hoop
        ctx.strokeStyle=id==='snare'?'#bbb':'#888';ctx.lineWidth=2.5;
        ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.stroke();
        // Tension rods
        for(let i=0;i<6;i++){
            const ang=i/6*Math.PI*2;
            ctx.fillStyle='#999';ctx.beginPath();
            ctx.arc(Math.cos(ang)*rx*.88,Math.sin(ang)*ry*.88,2,0,Math.PI*2);ctx.fill();
        }
        // Snare wires indicator
        if(id==='snare'){
            ctx.strokeStyle='rgba(200,200,200,.12)';ctx.lineWidth=.5;
            for(let i=-rx*.6;i<rx*.6;i+=3){ctx.beginPath();ctx.moveTo(i,-ry*.7);ctx.lineTo(i,ry*.7);ctx.stroke();}
        }
    }

    // GLOW on hit
    if(glow>0){
        ctx.globalAlpha=glow*.5;
        ctx.shadowColor=d.color;ctx.shadowBlur=50*glow;
        ctx.fillStyle=d.color;ctx.beginPath();ctx.ellipse(0,0,rx*1.3,ry*1.4,0,0,Math.PI*2);ctx.fill();
        ctx.shadowBlur=0;ctx.globalAlpha=1;
    }
    ctx.restore();
}

function lighten(c,a){
    const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);
    return `rgb(${Math.min(255,r+a*255)},${Math.min(255,g+a*255)},${Math.min(255,b+a*255)})`;
}
function darken(c,a){
    const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);
    return `rgb(${Math.max(0,r-a*255)},${Math.max(0,g-a*255)},${Math.max(0,b-a*255)})`;
}

// Particles
function spawnParticles(drumId,vel){
    const d=DRUMS[drumId];if(!d)return;
    const cx=d.x*CW,cy=d.y*CH;
    const count=Math.floor(5+vel*15);
    for(let i=0;i<count;i++){
        stickParticles.push({
            x:cx,y:cy,
            vx:(Math.random()-.5)*4*vel,vy:(Math.random()-.5)*4*vel-vel*2,
            life:1,decay:.02+Math.random()*.02,
            size:1+Math.random()*3*vel,
            color:d.color
        });
    }
}

function updateParticles(){
    for(let i=stickParticles.length-1;i>=0;i--){
        const p=stickParticles[i];
        p.x+=p.vx;p.y+=p.vy;p.vy+=.08;p.life-=p.decay;
        if(p.life<=0){stickParticles.splice(i,1);continue;}
        ctx.globalAlpha=p.life*.6;ctx.fillStyle=p.color;
        ctx.beginPath();ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
}

function triggerHitVisual(id,vel){
    hitAnims[id]={time:Date.now(),vel:vel||1};
    spawnParticles(id,vel);
    const now=Date.now();
    if(now-lastHitTime<600)comboCount++;else comboCount=1;
    lastHitTime=now;
    const d=DRUMS[id];
    if(d){
        const lb=$('hit-label');lb.textContent=d.name.toUpperCase();
        lb.classList.remove('show');void lb.offsetWidth;lb.classList.add('show');
        setTimeout(()=>lb.classList.remove('show'),200);
    }
    const cb=$('combo-display');
    if(cb)cb.textContent=comboCount>2?`${comboCount}× COMBO`:'';

    // Screen flash
    const fl=$('hit-flash-overlay');
    if(fl&&vel>.5){
        fl.style.background=`radial-gradient(circle at 50% 50%,${d.color}15,transparent 60%)`;
        fl.classList.remove('flash');void fl.offsetWidth;fl.classList.add('flash');
        setTimeout(()=>fl.classList.remove('flash'),100);
    }
}

// ===================== NETWORK =====================
let hostPeer=null;
const devices={stick1:null,stick2:null,pedal1:null,pedal2:null};
const devCon={stick1:false,stick2:false,pedal1:false,pedal2:false};
let started=false;
let clientPeer=null,clientConn=null,sndT=null;

function goMenu(){
    if(hostPeer){hostPeer.destroy();hostPeer=null;}
    if(clientPeer){clientPeer.destroy();clientPeer=null;}
    if(clientConn){clientConn.close();clientConn=null;}
    if(sndT)clearInterval(sndT);
    started=false;
    Object.keys(devices).forEach(k=>{devices[k]=null;devCon[k]=false;});
    showScreen('menu');
}
function openKit(){showScreen('kit-setup');initHost();}
function openStick(){
    const g=new URLSearchParams(location.search).get('game');
    if(g){$('inp-stick').value=g;showScreen('stick-setup');setTimeout(connectStick,400);}
    else showScreen('stick-setup');
}
function openPedal(){
    const g=new URLSearchParams(location.search).get('game');
    if(g)$('inp-pedal').value=g;
    showScreen('pedal-setup');
}

function initHost(){
    if(hostPeer)hostPeer.destroy();
    const id='DRUM-'+Math.random().toString(36).substr(2,6).toUpperCase();
    hostPeer=new Peer(id,{debug:0});
    hostPeer.on('open',gid=>{
        $('gid').textContent=gid;
        const url=location.href.split('?')[0]+'?game='+gid;
        $('lnk').href=url;$('lnk').textContent=url;
        try{new QRious({element:$('qrc'),value:url,size:180,background:'white',foreground:'#08080c'});}catch(e){}
    });
    hostPeer.on('connection',handleHostConn);
    hostPeer.on('error',e=>console.log('Host err:',e));
}

function handleHostConn(c){
    c.on('open',()=>{c.devType=null;});
    c.on('data',d=>{
        if(d.t==='identify'){
            let slot=null;
            if(d.device==='stick'){
                if(!devCon.stick1){slot='stick1';c.hand='right';}
                else if(!devCon.stick2){slot='stick2';c.hand='left';}
            }else if(d.device==='pedal'){
                if(d.subtype==='kick'&&!devCon.pedal1)slot='pedal1';
                else if(d.subtype==='hihat'&&!devCon.pedal2)slot='pedal2';
                else if(!devCon.pedal1)slot='pedal1';
                else if(!devCon.pedal2)slot='pedal2';
            }
            if(!slot){c.close();return;}
            c.devType=slot;c.subtype=d.subtype;devCon[slot]=true;devices[slot]=c;
            $('c-'+slot).classList.add('on');
            c.send({t:'assigned',slot,hand:c.hand||null,subtype:d.subtype||null});
            updateStartBtn();
            if(!started&&hasAny())startDrumUI();
        }
        if(d.t==='hit'){initAudio();playDrum(d.drum,d.vel);triggerHitVisual(d.drum,d.vel);}
        if(d.t==='pedal-down'){
            initAudio();
            if(c.subtype==='kick'){playDrum('kick',d.vel||.9);triggerHitVisual('kick',d.vel||.9);}
            else if(c.subtype==='hihat'){hihatOpen=false;updateHHUI();synthHHChick(audioCtx.currentTime,d.vel||.6);triggerHitVisual('hihat',.3);}
        }
        if(d.t==='pedal-up'){if(c.subtype==='hihat'){hihatOpen=true;updateHHUI();}}
    });
    c.on('close',()=>{if(c.devType){devCon[c.devType]=false;devices[c.devType]=null;$('c-'+c.devType).classList.remove('on');}});
}

function hasAny(){return devCon.stick1||devCon.stick2||devCon.pedal1||devCon.pedal2;}
function updateStartBtn(){$('start-btn').style.display=hasAny()&&!started?'block':'none';}
function updateHHUI(){
    const lb=$('hh-label'),ic=$('hh-icon');
    if(lb)lb.textContent=hihatOpen?'Aberto':'Fechado';
    if(ic)ic.textContent=hihatOpen?'🔓':'🔒';
}
function forceStart(){startDrumUI();}

function startDrumUI(){
    started=true;initAudio();resizeCanvas();showScreen('drum-ui');updateHHUI();updateDevBar();renderLoop();
}
function updateDevBar(){
    const bar=$('devices-bar');if(!bar)return;bar.innerHTML='';
    const labels={stick1:'🥢R',stick2:'🥢L',pedal1:'🦶K',pedal2:'🎩H'};
    Object.keys(devCon).forEach(k=>{
        const el=document.createElement('div');
        el.className='dev-badge'+(devCon[k]?' on':'');
        el.textContent=labels[k];bar.appendChild(el);
    });
}

// ===================== BAQUETA =====================
let myX=.5,myY=.5,calB=0,calG=0,useGyro=false,curZone='snare',sensitivity=9,swingCD=0;

function connectStick(){
    const id=$('inp-stick').value.trim().toUpperCase();
    if(!id){$('err-stick').textContent='Digite o código!';return;}
    $('err-stick').textContent='';showOv('connecting-overlay');
    if(clientPeer)clientPeer.destroy();
    clientPeer=new Peer(undefined,{debug:0});
    clientPeer.on('open',()=>{
        clientConn=clientPeer.connect(id,{reliable:false});
        clientConn.on('open',()=>{hideOv('connecting-overlay');$('sst').textContent='🟢';$('sst').style.color='#4f4';clientConn.send({t:'identify',device:'stick'});});
        clientConn.on('data',handleStickData);
        clientConn.on('close',()=>{$('sst').textContent='🔴';$('sst').style.color='#f44';if(sndT)clearInterval(sndT);});
        clientConn.on('error',()=>{hideOv('connecting-overlay');$('err-stick').textContent='Não encontrado!';showScreen('stick-setup');});
    });
    clientPeer.on('error',()=>{hideOv('connecting-overlay');$('err-stick').textContent='Erro.';});
}

function handleStickData(d){
    if(d.t==='assigned'){
        $('slbl').textContent=`Baqueta ${d.hand==='right'?'Direita ▸':'◂ Esquerda'}`;
        $('slbl').style.color='#ff9800';showScreen('stick-ctrl');initStickSensors();
    }
}

function selectZone(zone){
    curZone=zone;
    document.querySelectorAll('.zb').forEach(el=>el.classList.remove('active'));
    const btn=document.querySelector(`.zb[data-zone="${zone}"]`);if(btn)btn.classList.add('active');
    const d=DRUMS[zone];$('s-zone-name').textContent=d?d.emoji+' '+d.name:'';
}

function setSens(v){sensitivity=parseInt(v);}

async function initStickSensors(){
    let gOk=false;
    if(typeof DeviceOrientationEvent!=='undefined'){
        if(typeof DeviceOrientationEvent.requestPermission==='function'){
            try{const p=await DeviceOrientationEvent.requestPermission();if(p==='granted')gOk=true;}catch(e){}
        }else{
            gOk=await new Promise(r=>{let f=false;const h=e=>{if(e.beta!==null)f=true;};
            window.addEventListener('deviceorientation',h);setTimeout(()=>{window.removeEventListener('deviceorientation',h);r(f);},600);});
        }
    }
    if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){try{await DeviceMotionEvent.requestPermission();}catch(e){}}
    if(gOk){useGyro=true;setupStickOri();setupStickMotion();showOv('calib');}
    else{useGyro=false;setupStickTouch();}
}

function setupStickOri(){
    window.addEventListener('deviceorientation',e=>{
        if(!useGyro)return;
        const b=e.beta||0,g=e.gamma||0;
        myX=clamp(.5+(g-calG)/60*.5);myY=clamp(.5+(b-calB)/60*.5);
        const s=$('big-stick');
        if(s)s.style.transform=`perspective(400px) rotateX(${-(b-calB)*.4}deg) rotateY(${(g-calG)*.5}deg)`;
    });
}

function setupStickMotion(){
    window.addEventListener('devicemotion',e=>{
        const acc=e.acceleration||e.accelerationIncludingGravity;if(!acc)return;
        const total=Math.sqrt((acc.x||0)**2+(acc.y||0)**2+(acc.z||0)**2);
        const now=Date.now();
        if(total>sensitivity&&now-swingCD>120){
            swingCD=now;const vel=clamp((total-sensitivity+2)/20);
            if(clientConn&&clientConn.open)clientConn.send({t:'hit',drum:curZone,vel});
            if(navigator.vibrate)navigator.vibrate(8+vel*25);
            const s=$('big-stick');if(s){s.classList.remove('hit-flash');void s.offsetWidth;s.classList.add('hit-flash');}
            const rp=$('stick-ripple');if(rp){rp.classList.remove('pop');void rp.offsetWidth;rp.classList.add('pop');}
            const zb=document.querySelector(`.zb[data-zone="${curZone}"]`);
            if(zb){zb.classList.remove('hit');void zb.offsetWidth;zb.classList.add('hit');}
            const hi=$('hit-indicator');if(hi){const d=DRUMS[curZone];
                hi.textContent=vel>.7?'💥 '+d.name:d.emoji+' '+d.name;
                hi.classList.add('show');setTimeout(()=>hi.classList.remove('show'),160);}
        }
        const db=$('stick-debug');if(db)db.textContent=`${total.toFixed(1)} | ${curZone}`;
    });
}

function doCalib(){
    window.addEventListener('deviceorientation',function h(e){calB=e.beta||0;calG=e.gamma||0;
    window.removeEventListener('deviceorientation',h);},{once:true});
    setTimeout(()=>hideOv('calib'),300);
}

function setupStickTouch(){
    $('stick-debug').textContent='Modo toque';
    document.querySelectorAll('.zb').forEach(el=>{
        el.addEventListener('touchstart',e=>{
            e.preventDefault();const zone=el.dataset.zone;selectZone(zone);
            if(clientConn&&clientConn.open)clientConn.send({t:'hit',drum:zone,vel:.8});
            if(navigator.vibrate)navigator.vibrate(15);
            const s=$('big-stick');if(s){s.classList.remove('hit-flash');void s.offsetWidth;s.classList.add('hit-flash');}
            el.classList.remove('hit');void el.offsetWidth;el.classList.add('hit');
        },{passive:false});
    });
    const sv=$('stick-view');if(sv)sv.addEventListener('touchstart',e=>{
        e.preventDefault();
        if(clientConn&&clientConn.open)clientConn.send({t:'hit',drum:curZone,vel:.8});
        if(navigator.vibrate)navigator.vibrate(15);
        const s=$('big-stick');if(s){s.classList.remove('hit-flash');void s.offsetWidth;s.classList.add('hit-flash');}
    },{passive:false});
}

// ===================== PEDAL =====================
let pedalType='kick',pedalConn=null,pedalPeer=null,pedalPressed=false;

function setPedalType(type){
    pedalType=type;
    $('pt-kick').classList.toggle('sel',type==='kick');
    $('pt-hihat').classList.toggle('sel',type==='hihat');
    $('pedal-connect-area').style.display='block';
}

function connectPedal(){
    const id=$('inp-pedal').value.trim().toUpperCase();
    if(!id){$('err-pedal').textContent='Digite o código!';return;}
    $('err-pedal').textContent='';showOv('connecting-overlay');
    if(pedalPeer)pedalPeer.destroy();
    pedalPeer=new Peer(undefined,{debug:0});
    pedalPeer.on('open',()=>{
        pedalConn=pedalPeer.connect(id,{reliable:false});
        pedalConn.on('open',()=>{hideOv('connecting-overlay');$('pst').textContent='🟢';$('pst').style.color='#4f4';
            pedalConn.send({t:'identify',device:'pedal',subtype:pedalType});});
        pedalConn.on('data',d=>{
            if(d.t==='assigned'){
                $('plbl').textContent=pedalType==='kick'?'🥁 Pedal Bumbo':'🎩 Pedal Hi-Hat';
                $('plbl').style.color=pedalType==='kick'?'#ff9800':'#ffd54f';
                const plate=$('pedal-plate');
                if(pedalType==='hihat')plate.classList.add('hihat-pedal');
                $('pedal-text').textContent=pedalType==='kick'?'BUMBO':'HI-HAT';
                $('pedal-inst-text').textContent=pedalType==='kick'?'Toque para pisar':'Segure = Fecha | Solta = Abre';
                showScreen('pedal-ctrl');setupPedalTouch();
            }
        });
        pedalConn.on('close',()=>{$('pst').textContent='🔴';$('pst').style.color='#f44';});
        pedalConn.on('error',()=>{hideOv('connecting-overlay');$('err-pedal').textContent='Não encontrado!';showScreen('pedal-setup');});
    });
    pedalPeer.on('error',()=>{hideOv('connecting-overlay');$('err-pedal').textContent='Erro.';});
}

function setupPedalTouch(){
    const plate=$('pedal-plate'),sd=$('pedal-state-display');
    const down=()=>{
        pedalPressed=true;plate.classList.add('pressed');
        if(navigator.vibrate)navigator.vibrate(25);
        if(pedalConn&&pedalConn.open)pedalConn.send({t:'pedal-down',vel:.9});
        if(pedalType==='kick'){sd.textContent='BOOM!';setTimeout(()=>sd.textContent='',250);}
        else sd.textContent='🔒 CLOSED';
    };
    const up=()=>{
        pedalPressed=false;plate.classList.remove('pressed');
        if(pedalConn&&pedalConn.open)pedalConn.send({t:'pedal-up'});
        if(pedalType==='hihat')sd.textContent='🔓 OPEN';
    };
    plate.addEventListener('touchstart',e=>{e.preventDefault();down();},{passive:false});
    plate.addEventListener('touchend',e=>{e.preventDefault();up();},{passive:false});
    plate.addEventListener('mousedown',down);plate.addEventListener('mouseup',up);
    plate.addEventListener('mouseleave',()=>{if(pedalPressed)up();});
}

// ===================== TECLADO PC =====================
const KEY_MAP={'q':'hihat','w':'crash','e':'ride','r':'china','t':'splash','a':'snare','s':'tom1','d':'tom2','z':'kick','x':'floor',' ':'kick'};
document.addEventListener('keydown',e=>{
    if(!started)return;const drum=KEY_MAP[e.key.toLowerCase()];
    if(drum&&!e.repeat){initAudio();playDrum(drum,.85);triggerHitVisual(drum,.85);}
});
canvas.addEventListener('click',e=>{
    if(!started)return;initAudio();
    const rect=canvas.getBoundingClientRect();
    const mx=(e.clientX-rect.left)/rect.width,my=(e.clientY-rect.top)/rect.height;
    let best=null,bestD=Infinity;
    for(const[id,d]of Object.entries(DRUMS)){const dist=Math.sqrt((mx-d.x)**2+(my-d.y)**2);if(dist<.1&&dist<bestD){best=id;bestD=dist;}}
    if(best){playDrum(best,.8);triggerHitVisual(best,.8);}
});

function clamp(v){return Math.max(0,Math.min(1,v));}
document.addEventListener('touchmove',e=>{
    const c=$('stick-ctrl'),p=$('pedal-ctrl');
    if((c&&c.classList.contains('active'))||(p&&p.classList.contains('active')))e.preventDefault();
},{passive:false});
window.addEventListener('resize',()=>{if(started)resizeCanvas();});
resizeCanvas();

const urlGame=new URLSearchParams(location.search).get('game');
if(urlGame){$('inp-stick').value=urlGame;$('inp-pedal').value=urlGame;}

return{goMenu,openKit,openStick,openPedal,connectStick,connectPedal,selectZone,setSens,doCalib,setPedalType,forceStart};
})();