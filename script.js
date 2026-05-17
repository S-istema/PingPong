/* =====================================================
   🥁 BATERIA VIRTUAL PRO
   4 dispositivos: 2 Baquetas + 2 Pedais
   Hi-Hat Aberto/Fechado
   PeerJS + Web Audio API
   ===================================================== */

const APP = (() => {
    const $ = id => document.getElementById(id);
    const SCREENS = ['menu','kit-setup','drum-ui','stick-setup','stick-ctrl','pedal-setup','pedal-ctrl'];

    function showScreen(id) {
        SCREENS.forEach(s => { $(s).style.display = 'none'; $(s).classList.remove('active'); });
        $(id).style.display = 'flex'; $(id).classList.add('active');
    }
    function showOv(id) { $(id).style.display = 'flex'; $(id).classList.add('show'); }
    function hideOv(id) { $(id).style.display = 'none'; $(id).classList.remove('show'); }

    // ===================== PEÇAS DA BATERIA =====================
    const DRUMS = {
        kick:   { name:'Bumbo',   emoji:'🥁', color:'#4a4a4a', x:.5,  y:.78, rx:65, ry:40 },
        snare:  { name:'Caixa',   emoji:'🥁', color:'#e0e0e0', x:.35, y:.58, rx:38, ry:24 },
        hihat:  { name:'Hi-Hat',  emoji:'🎩', color:'#ffd54f', x:.14, y:.40, rx:34, ry:11 },
        tom1:   { name:'Tom 1',   emoji:'🔴', color:'#e53935', x:.36, y:.36, rx:30, ry:18 },
        tom2:   { name:'Tom 2',   emoji:'🟠', color:'#ff9800', x:.58, y:.36, rx:30, ry:18 },
        floor:  { name:'Surdo',   emoji:'🟤', color:'#795548', x:.78, y:.55, rx:40, ry:26 },
        crash:  { name:'Crash',   emoji:'💛', color:'#ffeb3b', x:.20, y:.20, rx:40, ry:12 },
        ride:   { name:'Ride',    emoji:'💿', color:'#b0bec5', x:.80, y:.22, rx:43, ry:13 },
        china:  { name:'China',   emoji:'🔔', color:'#ab47bc', x:.10, y:.25, rx:35, ry:10 },
        splash: { name:'Splash',  emoji:'💦', color:'#26c6da', x:.50, y:.18, rx:25, ry: 8 }
    };

    // ===================== AUDIO =====================
    let audioCtx = null;
    let hihatOpen = false; // Estado do hi-hat

    function initAudio() {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    function playDrum(id, vel) {
        if (!audioCtx) initAudio();
        vel = Math.min(vel || .8, 1);
        const t = audioCtx.currentTime;
        switch(id) {
            case 'kick':   playKick(t,vel); break;
            case 'snare':  playSnare(t,vel); break;
            case 'hihat':  hihatOpen ? playHihatOpen(t,vel) : playHihatClosed(t,vel); break;
            case 'tom1':   playTom(t,vel,200); break;
            case 'tom2':   playTom(t,vel,150); break;
            case 'floor':  playTom(t,vel,90); break;
            case 'crash':  playCymbal(t,vel,.9,5000); break;
            case 'ride':   playCymbal(t,vel,.3,7000); break;
            case 'china':  playCymbal(t,vel,.7,3000); break;
            case 'splash': playCymbal(t,vel,.2,8000); break;
        }
    }

    function playKick(t,v) {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type='sine';
        o.frequency.setValueAtTime(160*v,t);
        o.frequency.exponentialRampToValueAtTime(35,t+.15);
        g.gain.setValueAtTime(v*1.3,t);
        g.gain.exponentialRampToValueAtTime(.001,t+.45);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t); o.stop(t+.45);
        // Click
        const c=audioCtx.createOscillator(), cg=audioCtx.createGain();
        c.type='square'; c.frequency.setValueAtTime(900,t);
        c.frequency.exponentialRampToValueAtTime(80,t+.015);
        cg.gain.setValueAtTime(v*.5,t);
        cg.gain.exponentialRampToValueAtTime(.001,t+.025);
        c.connect(cg); cg.connect(audioCtx.destination);
        c.start(t); c.stop(t+.04);
    }

    function playSnare(t,v) {
        const o=audioCtx.createOscillator(), g=audioCtx.createGain();
        o.type='triangle'; o.frequency.setValueAtTime(230,t);
        o.frequency.exponentialRampToValueAtTime(110,t+.08);
        g.gain.setValueAtTime(v*.6,t);
        g.gain.exponentialRampToValueAtTime(.001,t+.13);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t); o.stop(t+.15);
        // Noise
        const bs=audioCtx.sampleRate*.18, buf=audioCtx.createBuffer(1,bs,audioCtx.sampleRate);
        const d=buf.getChannelData(0); for(let i=0;i<bs;i++) d[i]=Math.random()*2-1;
        const n=audioCtx.createBufferSource(); n.buffer=buf;
        const f=audioCtx.createBiquadFilter(); f.type='highpass'; f.frequency.value=3500;
        const g2=audioCtx.createGain(); g2.gain.setValueAtTime(v*.9,t);
        g2.gain.exponentialRampToValueAtTime(.001,t+.18);
        n.connect(f); f.connect(g2); g2.connect(audioCtx.destination);
        n.start(t); n.stop(t+.18);
    }

    function playHihatClosed(t,v) {
        const bs=audioCtx.sampleRate*.05, buf=audioCtx.createBuffer(1,bs,audioCtx.sampleRate);
        const d=buf.getChannelData(0); for(let i=0;i<bs;i++) d[i]=Math.random()*2-1;
        const n=audioCtx.createBufferSource(); n.buffer=buf;
        const hp=audioCtx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=8000;
        const bp=audioCtx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=10000; bp.Q.value=2;
        const g=audioCtx.createGain(); g.gain.setValueAtTime(v*.45,t);
        g.gain.exponentialRampToValueAtTime(.001,t+.04);
        n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(audioCtx.destination);
        n.start(t); n.stop(t+.05);
    }

    function playHihatOpen(t,v) {
        const bs=audioCtx.sampleRate*.4, buf=audioCtx.createBuffer(1,bs,audioCtx.sampleRate);
        const d=buf.getChannelData(0); for(let i=0;i<bs;i++) d[i]=Math.random()*2-1;
        const n=audioCtx.createBufferSource(); n.buffer=buf;
        const hp=audioCtx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=6000;
        const bp=audioCtx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=8000; bp.Q.value=.8;
        const g=audioCtx.createGain(); g.gain.setValueAtTime(v*.55,t);
        g.gain.exponentialRampToValueAtTime(v*.15,t+.08);
        g.gain.exponentialRampToValueAtTime(.001,t+.35);
        n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(audioCtx.destination);
        n.start(t); n.stop(t+.4);
        // Ping
        const o=audioCtx.createOscillator(), og=audioCtx.createGain();
        o.type='sine'; o.frequency.value=6500;
        og.gain.setValueAtTime(v*.04,t);
        og.gain.exponentialRampToValueAtTime(.001,t+.2);
        o.connect(og); og.connect(audioCtx.destination);
        o.start(t); o.stop(t+.2);
    }

    function playHihatPedalChick(t,v) {
        // Som do "chick" quando fecha o hi-hat com o pedal
        const bs=audioCtx.sampleRate*.03, buf=audioCtx.createBuffer(1,bs,audioCtx.sampleRate);
        const d=buf.getChannelData(0); for(let i=0;i<bs;i++) d[i]=Math.random()*2-1;
        const n=audioCtx.createBufferSource(); n.buffer=buf;
        const hp=audioCtx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=9000;
        const g=audioCtx.createGain(); g.gain.setValueAtTime(v*.35,t);
        g.gain.exponentialRampToValueAtTime(.001,t+.025);
        n.connect(hp); hp.connect(g); g.connect(audioCtx.destination);
        n.start(t); n.stop(t+.03);
    }

    function playTom(t,v,freq) {
        const o=audioCtx.createOscillator(), g=audioCtx.createGain();
        o.type='sine'; o.frequency.setValueAtTime(freq*1.3,t);
        o.frequency.exponentialRampToValueAtTime(freq*.55,t+.25);
        g.gain.setValueAtTime(v*.95,t);
        g.gain.exponentialRampToValueAtTime(.001,t+.4);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t); o.stop(t+.4);
        const c=audioCtx.createOscillator(), cg=audioCtx.createGain();
        c.type='square'; c.frequency.value=freq*4;
        cg.gain.setValueAtTime(v*.15,t);
        cg.gain.exponentialRampToValueAtTime(.001,t+.012);
        c.connect(cg); cg.connect(audioCtx.destination);
        c.start(t); c.stop(t+.02);
    }

    function playCymbal(t,v,sus,freq) {
        const dur=.3+sus*1.8;
        const bs=audioCtx.sampleRate*dur, buf=audioCtx.createBuffer(1,bs,audioCtx.sampleRate);
        const d=buf.getChannelData(0); for(let i=0;i<bs;i++) d[i]=Math.random()*2-1;
        const n=audioCtx.createBufferSource(); n.buffer=buf;
        const bp=audioCtx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=freq; bp.Q.value=.7;
        const hp=audioCtx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=3500;
        const g=audioCtx.createGain(); g.gain.setValueAtTime(v*.65,t);
        g.gain.exponentialRampToValueAtTime(v*.15,t+.06);
        g.gain.exponentialRampToValueAtTime(.001,t+dur);
        n.connect(bp); bp.connect(hp); hp.connect(g); g.connect(audioCtx.destination);
        n.start(t); n.stop(t+dur);
        const o=audioCtx.createOscillator(), og=audioCtx.createGain();
        o.type='sine'; o.frequency.value=freq*.15;
        og.gain.setValueAtTime(v*.06,t);
        og.gain.exponentialRampToValueAtTime(.001,t+.3);
        o.connect(og); og.connect(audioCtx.destination);
        o.start(t); o.stop(t+.3);
    }

    // ===================== CANVAS =====================
    const canvas = $('dc');
    const ctx = canvas.getContext('2d');
    let CW=800, CH=600;
    let hitAnims = {};
    let comboCount=0, lastHitTime=0;

    function resizeCanvas() {
        const mw=Math.min(950,window.innerWidth-10), mh=window.innerHeight-40;
        const r=4/3; let w=mw, h=w/r;
        if(h>mh){h=mh;w=h*r;}
        CW=canvas.width=Math.floor(w);
        CH=canvas.height=Math.floor(h);
    }

    function renderLoop() {
        renderKit();
        requestAnimationFrame(renderLoop);
    }

    function renderKit() {
        ctx.fillStyle='#0a0a0a'; ctx.fillRect(0,0,CW,CH);
        // Stage
        const sg=ctx.createRadialGradient(CW/2,CH*.4,30,CW/2,CH*.4,CW*.7);
        sg.addColorStop(0,'#1a1a2e'); sg.addColorStop(1,'#0a0a0a');
        ctx.fillStyle=sg; ctx.fillRect(0,0,CW,CH);
        // Floor
        ctx.fillStyle='rgba(255,255,255,.015)'; ctx.fillRect(0,CH*.7,CW,CH*.3);

        const order=['kick','floor','snare','tom1','tom2','crash','ride','china','splash','hihat'];
        order.forEach(id => drawPiece(id));
    }

    function drawPiece(id) {
        const d=DRUMS[id];
        const cx=d.x*CW, cy=d.y*CH;
        const rx=d.rx*(CW/800), ry=d.ry*(CH/600);
        const now=Date.now();
        const a=hitAnims[id];
        let scale=1, glow=0;
        if(a){
            const el=now-a.time;
            if(el<300){const t=el/300; scale=1+(1-t)*.14*a.vel; glow=(1-t)*a.vel;}
            else delete hitAnims[id];
        }

        ctx.save(); ctx.translate(cx,cy); ctx.scale(scale,scale);

        if(id==='kick') {
            ctx.fillStyle='#2a2a2a'; ctx.beginPath(); ctx.ellipse(0,0,rx,ry*1.2,0,0,Math.PI*2); ctx.fill();
            const kg=ctx.createRadialGradient(-rx*.2,-ry*.2,0,0,0,rx*.8);
            kg.addColorStop(0,'#f5f5f5'); kg.addColorStop(1,'#bdbdbd');
            ctx.fillStyle=kg; ctx.beginPath(); ctx.ellipse(0,0,rx*.85,ry,0,0,Math.PI*2); ctx.fill();
            ctx.fillStyle='rgba(0,0,0,.12)'; ctx.font=`bold ${rx*.35}px sans-serif`;
            ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('DRUM',0,0);
            ctx.strokeStyle='#555'; ctx.lineWidth=3; ctx.beginPath(); ctx.ellipse(0,0,rx,ry*1.2,0,0,Math.PI*2); ctx.stroke();
        } else if(['hihat','crash','ride','china','splash'].includes(id)) {
            // Pratos
            let col = d.color;
            if(id==='hihat') {
                col = hihatOpen ? '#ffea00' : '#ffd54f';
            }
            const cg=ctx.createRadialGradient(-rx*.2,-ry*.5,0,0,0,rx);
            cg.addColorStop(0,col); cg.addColorStop(.7,col); cg.addColorStop(1,'rgba(0,0,0,.3)');
            ctx.fillStyle=cg; ctx.beginPath(); ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2); ctx.fill();
            // Brilho
            ctx.strokeStyle='rgba(255,255,255,.12)'; ctx.lineWidth=.8;
            for(let r2=rx*.3;r2<rx;r2+=rx*.18){ctx.beginPath();ctx.ellipse(0,0,r2,r2*(ry/rx),0,0,Math.PI*2);ctx.stroke();}
            // Bell
            ctx.fillStyle='rgba(255,255,255,.18)'; ctx.beginPath(); ctx.ellipse(0,0,rx*.12,ry*.25,0,0,Math.PI*2); ctx.fill();
            // Haste
            if(id==='hihat'){ctx.fillStyle='#666';ctx.fillRect(-2,ry,4,CH*.25);}
            // Label hi-hat aberto/fechado
            if(id==='hihat'){
                ctx.fillStyle='rgba(255,255,255,.5)';ctx.font=`${rx*.3}px sans-serif`;
                ctx.textAlign='center';ctx.fillText(hihatOpen?'OPEN':'CLOSED',0,ry+15);
            }
        } else {
            // Toms/Snare
            ctx.fillStyle=id==='snare'?'#888':d.color; ctx.globalAlpha=.35;
            ctx.beginPath(); ctx.ellipse(0,ry*.4,rx,ry*.5,0,0,Math.PI); ctx.fill();
            ctx.globalAlpha=1;
            const tg=ctx.createRadialGradient(-rx*.15,-ry*.2,0,0,0,rx*.9);
            tg.addColorStop(0,'#fafafa'); tg.addColorStop(.8,'#e0e0e0'); tg.addColorStop(1,'#bbb');
            ctx.fillStyle=tg; ctx.beginPath(); ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle=id==='snare'?'#aaa':d.color; ctx.lineWidth=3;
            ctx.beginPath(); ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2); ctx.stroke();
            ctx.strokeStyle=d.color; ctx.lineWidth=5;
            ctx.beginPath(); ctx.ellipse(0,ry*.15,rx+1,ry*.6,0,.1,Math.PI-.1); ctx.stroke();
        }

        // Glow
        if(glow>0){
            ctx.globalAlpha=glow*.6; ctx.shadowColor=d.color; ctx.shadowBlur=45*glow;
            ctx.fillStyle=d.color; ctx.beginPath(); ctx.ellipse(0,0,rx*1.2,ry*1.3,0,0,Math.PI*2); ctx.fill();
            ctx.shadowBlur=0; ctx.globalAlpha=1;
        }
        ctx.restore();
    }

    function triggerHitVisual(id,vel) {
        hitAnims[id]={time:Date.now(),vel:vel||1};
        const now=Date.now();
        if(now-lastHitTime<600) comboCount++; else comboCount=1;
        lastHitTime=now;
        const d=DRUMS[id];
        if(d){
            const lb=$('hit-label');
            lb.textContent=d.emoji+' '+d.name;
            lb.classList.add('show');
            setTimeout(()=>lb.classList.remove('show'),200);
        }
        const cb=$('combo-display');
        if(cb) cb.textContent=comboCount>2?`🔥 ${comboCount}x`:''
    }

    // ===================== REDE =====================
    let hostPeer=null;
    const devices={stick1:null,stick2:null,pedal1:null,pedal2:null};
    const devCon={stick1:false,stick2:false,pedal1:false,pedal2:false};
    let started=false;

    let clientPeer=null, clientConn=null, sndT=null;

    function goMenu() {
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
        if(g){$('inp-stick').value=g; showScreen('stick-setup'); setTimeout(connectStick,400);}
        else showScreen('stick-setup');
    }

    function openPedal(){
        const g=new URLSearchParams(location.search).get('game');
        if(g) $('inp-pedal').value=g;
        showScreen('pedal-setup');
    }

    // ===================== HOST =====================
    function initHost(){
        if(hostPeer) hostPeer.destroy();
        const id='DRUM-'+Math.random().toString(36).substr(2,6).toUpperCase();
        hostPeer=new Peer(id,{debug:0});
        hostPeer.on('open',gid=>{
            $('gid').textContent=gid;
            const url=location.href.split('?')[0]+'?game='+gid;
            $('lnk').href=url; $('lnk').textContent=url;
            try{new QRious({element:$('qrc'),value:url,size:170,background:'white',foreground:'#0a0a0a'});}catch(e){}
        });
        hostPeer.on('connection', handleHostConn);
        hostPeer.on('error',e=>console.log('Host err:',e));
    }

    function handleHostConn(c){
        c.on('open',()=>{
            // Aguarda o dispositivo se identificar
            c.devType = null;
        });

        c.on('data',d=>{
            // Identificação
            if(d.t==='identify'){
                const type = d.device; // 'stick' ou 'pedal'
                const subtype = d.subtype; // 'kick' ou 'hihat' (para pedal)
                let slot = null;

                if(type==='stick'){
                    if(!devCon.stick1){slot='stick1'; c.hand='right';}
                    else if(!devCon.stick2){slot='stick2'; c.hand='left';}
                }else if(type==='pedal'){
                    if(subtype==='kick'&&!devCon.pedal1) slot='pedal1';
                    else if(subtype==='hihat'&&!devCon.pedal2) slot='pedal2';
                    else if(!devCon.pedal1) slot='pedal1';
                    else if(!devCon.pedal2) slot='pedal2';
                }

                if(!slot){c.close();return;}

                c.devType=slot;
                c.subtype=subtype;
                devCon[slot]=true;
                devices[slot]=c;
                $('c-'+slot).classList.add('on');

                // Resposta
                const info = {t:'assigned', slot, hand:c.hand||null, subtype:subtype||null};
                c.send(info);

                updateStartBtn();

                if(!started && hasAnyDevice()){
                    startDrumUI();
                }
            }

            // Batida da baqueta
            if(d.t==='hit'){
                initAudio();
                playDrum(d.drum, d.vel);
                triggerHitVisual(d.drum, d.vel);
            }

            // Pedal
            if(d.t==='pedal-down'){
                initAudio();
                if(c.subtype==='kick'){
                    playDrum('kick', d.vel||.9);
                    triggerHitVisual('kick', d.vel||.9);
                } else if(c.subtype==='hihat'){
                    hihatOpen=false;
                    updateHihatUI();
                    playHihatPedalChick(audioCtx.currentTime, d.vel||.6);
                    triggerHitVisual('hihat',.4);
                }
            }
            if(d.t==='pedal-up'){
                if(c.subtype==='hihat'){
                    hihatOpen=true;
                    updateHihatUI();
                }
            }
        });

        c.on('close',()=>{
            if(c.devType){
                devCon[c.devType]=false;
                devices[c.devType]=null;
                $('c-'+c.devType).classList.remove('on');
            }
        });
    }

    function hasAnyDevice(){return devCon.stick1||devCon.stick2||devCon.pedal1||devCon.pedal2;}

    function updateStartBtn(){
        const btn=$('start-btn');
        if(hasAnyDevice()&&!started) btn.style.display='block';
        else btn.style.display='none';
    }

    function updateHihatUI(){
        const lb=$('hh-label');
        if(lb) lb.textContent=hihatOpen?'Aberto 🔓':'Fechado 🔒';
    }

    function forceStart(){startDrumUI();}

    function startDrumUI(){
        started=true;
        initAudio();
        resizeCanvas();
        showScreen('drum-ui');
        updateHihatUI();
        updateDevicesBar();
        renderLoop();
    }

    function updateDevicesBar(){
        const bar=$('devices-bar');
        if(!bar)return;
        bar.innerHTML='';
        const labels={stick1:'🥢R',stick2:'🥢L',pedal1:'🦶B',pedal2:'🦶H'};
        Object.keys(devCon).forEach(k=>{
            const el=document.createElement('div');
            el.className='dev'+(devCon[k]?' on':'');
            el.textContent=labels[k]+(devCon[k]?' ✓':' ✗');
            bar.appendChild(el);
        });
    }

    // ===================== BAQUETA (CELULAR) =====================
    let myX=.5, myY=.5, calB=0, calG=0, useGyro=false;
    let curZone='snare', sensitivity=9, swingCD=0;

    function connectStick(){
        const id=$('inp-stick').value.trim().toUpperCase();
        if(!id){$('err-stick').textContent='Digite o código!';return;}
        $('err-stick').textContent='';
        showOv('connecting-overlay');
        if(clientPeer)clientPeer.destroy();
        clientPeer=new Peer(undefined,{debug:0});
        clientPeer.on('open',()=>{
            clientConn=clientPeer.connect(id,{reliable:false});
            clientConn.on('open',()=>{
                hideOv('connecting-overlay');
                $('sst').textContent='🟢'; $('sst').style.color='#4f4';
                // Identificar como baqueta
                clientConn.send({t:'identify', device:'stick'});
            });
            clientConn.on('data', handleStickData);
            clientConn.on('close',()=>{$('sst').textContent='🔴';$('sst').style.color='#f44';if(sndT)clearInterval(sndT);});
            clientConn.on('error',()=>{hideOv('connecting-overlay');$('err-stick').textContent='Não encontrado!';showScreen('stick-setup');});
        });
        clientPeer.on('error',()=>{hideOv('connecting-overlay');$('err-stick').textContent='Erro de conexão.';});
    }

    function handleStickData(d){
        if(d.t==='assigned'){
            $('slbl').textContent=`Baqueta ${d.hand==='right'?'Direita ▶':'Esquerda ◀'}`;
            $('slbl').style.color='#ff9800';
            showScreen('stick-ctrl');
            initStickSensors();
        }
    }

    function selectZone(zone){
        curZone=zone;
        document.querySelectorAll('.zb').forEach(el=>el.classList.remove('active'));
        const btn=document.querySelector(`.zb[data-zone="${zone}"]`);
        if(btn)btn.classList.add('active');
        const d=DRUMS[zone];
        $('s-zone-name').textContent=d?d.emoji+' '+d.name:'';
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
        if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){
            try{await DeviceMotionEvent.requestPermission();}catch(e){}
        }
        if(gOk){useGyro=true;setupStickOrientation();setupStickMotion();showOv('calib');}
        else{useGyro=false;setupStickTouch();}
    }

    function setupStickOrientation(){
        window.addEventListener('deviceorientation',e=>{
            if(!useGyro)return;
            const beta=e.beta||0, gamma=e.gamma||0;
            myX=clamp(.5+(gamma-calG)/60*.5);
            myY=clamp(.5+(beta-calB)/60*.5);
            // Rotação visual
            const s=$('big-stick');
            if(s){
                const rx=(beta-calB)*.5, ry=(gamma-calG)*.6;
                s.style.transform=`perspective(400px) rotateX(${-rx*.4}deg) rotateY(${ry}deg) rotateZ(${-ry*.2}deg)`;
            }
        });
    }

    function setupStickMotion(){
        window.addEventListener('devicemotion',e=>{
            const acc=e.acceleration||e.accelerationIncludingGravity;
            if(!acc)return;
            const total=Math.sqrt((acc.x||0)**2+(acc.y||0)**2+(acc.z||0)**2);
            const now=Date.now();

            if(total>sensitivity && now-swingCD>120){
                swingCD=now;
                const vel=clamp((total-sensitivity+2)/20);
                if(clientConn&&clientConn.open){
                    clientConn.send({t:'hit', drum:curZone, vel});
                }
                if(navigator.vibrate)navigator.vibrate(10+vel*30);

                // Flash baqueta
                const s=$('big-stick');
                if(s){s.classList.remove('hit-flash');void s.offsetWidth;s.classList.add('hit-flash');}

                // Flash zona
                const zb=document.querySelector(`.zb[data-zone="${curZone}"]`);
                if(zb){zb.classList.remove('last-hit');void zb.offsetWidth;zb.classList.add('last-hit');}

                // Indicador
                const hi=$('hit-indicator');
                if(hi){
                    const d=DRUMS[curZone];
                    hi.textContent=vel>.7?'💥 '+d.name+'!':d.emoji+' '+d.name;
                    hi.classList.add('show');
                    setTimeout(()=>hi.classList.remove('show'),180);
                }
            }
            const db=$('stick-debug');
            if(db)db.textContent=`Acc:${total.toFixed(1)} Sens:${sensitivity} Zone:${curZone}`;
        });
    }

    function doCalib(){
        window.addEventListener('deviceorientation',function h(e){
            calB=e.beta||0; calG=e.gamma||0;
            window.removeEventListener('deviceorientation',h);
        },{once:true});
        setTimeout(()=>hideOv('calib'),300);
    }

    function setupStickTouch(){
        $('stick-debug').textContent='Modo toque';
        // Tocar na grade de zonas = bater
        document.querySelectorAll('.zb').forEach(el=>{
            el.addEventListener('touchstart',e=>{
                e.preventDefault();
                const zone=el.dataset.zone;
                selectZone(zone);
                if(clientConn&&clientConn.open){
                    clientConn.send({t:'hit', drum:zone, vel:.8});
                }
                if(navigator.vibrate)navigator.vibrate(20);
                const s=$('big-stick');
                if(s){s.classList.remove('hit-flash');void s.offsetWidth;s.classList.add('hit-flash');}
                el.classList.remove('last-hit');void el.offsetWidth;el.classList.add('last-hit');
            },{passive:false});
        });
        // Toque na baqueta visual = bater zona selecionada
        const sv=$('stick-view');
        if(sv){
            sv.addEventListener('touchstart',e=>{
                e.preventDefault();
                if(clientConn&&clientConn.open) clientConn.send({t:'hit',drum:curZone,vel:.8});
                if(navigator.vibrate)navigator.vibrate(20);
                const s=$('big-stick');
                if(s){s.classList.remove('hit-flash');void s.offsetWidth;s.classList.add('hit-flash');}
            },{passive:false});
        }
    }

    // ===================== PEDAL (CELULAR) =====================
    let pedalType='kick'; // 'kick' ou 'hihat'
    let pedalConn=null, pedalPeer=null;
    let pedalPressed=false;

    function setPedalType(type){
        pedalType=type;
        $('pt-kick').classList.toggle('sel',type==='kick');
        $('pt-hihat').classList.toggle('sel',type==='hihat');
        $('pedal-connect-area').style.display='block';
    }

    function connectPedal(){
        const id=$('inp-pedal').value.trim().toUpperCase();
        if(!id){$('err-pedal').textContent='Digite o código!';return;}
        $('err-pedal').textContent='';
        showOv('connecting-overlay');
        if(pedalPeer)pedalPeer.destroy();
        pedalPeer=new Peer(undefined,{debug:0});
        pedalPeer.on('open',()=>{
            pedalConn=pedalPeer.connect(id,{reliable:false});
            pedalConn.on('open',()=>{
                hideOv('connecting-overlay');
                $('pst').textContent='🟢'; $('pst').style.color='#4f4';
                pedalConn.send({t:'identify', device:'pedal', subtype:pedalType});
            });
            pedalConn.on('data',d=>{
                if(d.t==='assigned'){
                    $('plbl').textContent=pedalType==='kick'?'🥁 Pedal Bumbo':'🎩 Pedal Hi-Hat';
                    $('plbl').style.color=pedalType==='kick'?'#ff9800':'#ffd54f';
                    const plate=$('pedal-plate');
                    if(pedalType==='hihat')plate.classList.add('hihat-pedal');
                    $('pedal-text').textContent=pedalType==='kick'?'🥁 BUMBO':'🎩 HI-HAT';
                    $('pedal-inst-text').textContent=pedalType==='kick'?
                        'Toque para pisar o bumbo':'Segure = Hi-Hat fechado | Solte = aberto';
                    showScreen('pedal-ctrl');
                    setupPedalTouch();
                }
            });
            pedalConn.on('close',()=>{$('pst').textContent='🔴';$('pst').style.color='#f44';});
            pedalConn.on('error',()=>{hideOv('connecting-overlay');$('err-pedal').textContent='Não encontrado!';showScreen('pedal-setup');});
        });
        pedalPeer.on('error',()=>{hideOv('connecting-overlay');$('err-pedal').textContent='Erro.';});
    }

    function setupPedalTouch(){
        const plate=$('pedal-plate');
        const stateDisp=$('pedal-state-display');

        // Touch
        plate.addEventListener('touchstart',e=>{
            e.preventDefault();
            pedalPressed=true;
            plate.classList.add('pressed');
            if(navigator.vibrate)navigator.vibrate(30);

            if(pedalConn&&pedalConn.open){
                pedalConn.send({t:'pedal-down',vel:.9});
            }

            if(pedalType==='kick'){
                stateDisp.textContent='💥 BOOM!';
                setTimeout(()=>{stateDisp.textContent='';},300);
            }else{
                stateDisp.textContent='🔒 Fechado';
            }
        },{passive:false});

        plate.addEventListener('touchend',e=>{
            e.preventDefault();
            pedalPressed=false;
            plate.classList.remove('pressed');

            if(pedalConn&&pedalConn.open){
                pedalConn.send({t:'pedal-up'});
            }

            if(pedalType==='hihat'){
                stateDisp.textContent='🔓 Aberto';
            }
        },{passive:false});

        // Mouse (debug)
        plate.addEventListener('mousedown',()=>{
            pedalPressed=true; plate.classList.add('pressed');
            if(pedalConn&&pedalConn.open) pedalConn.send({t:'pedal-down',vel:.9});
            if(pedalType==='kick'){stateDisp.textContent='💥 BOOM!';setTimeout(()=>{stateDisp.textContent='';},300);}
            else stateDisp.textContent='🔒 Fechado';
        });
        plate.addEventListener('mouseup',()=>{
            pedalPressed=false; plate.classList.remove('pressed');
            if(pedalConn&&pedalConn.open) pedalConn.send({t:'pedal-up'});
            if(pedalType==='hihat') stateDisp.textContent='🔓 Aberto';
        });
        plate.addEventListener('mouseleave',()=>{
            if(pedalPressed){
                pedalPressed=false; plate.classList.remove('pressed');
                if(pedalConn&&pedalConn.open) pedalConn.send({t:'pedal-up'});
                if(pedalType==='hihat') stateDisp.textContent='🔓 Aberto';
            }
        });
    }

    // ===================== PC KEYBOARD =====================
    const KEY_MAP={
        'q':'hihat','w':'crash','e':'ride','r':'china','t':'splash',
        'a':'snare','s':'tom1','d':'tom2',
        'z':'kick','x':'floor',' ':'kick'
    };
    document.addEventListener('keydown',e=>{
        if(!started)return;
        const drum=KEY_MAP[e.key.toLowerCase()];
        if(drum&&!e.repeat){initAudio();playDrum(drum,.85);triggerHitVisual(drum,.85);}
    });

    // PC CLICK
    canvas.addEventListener('click',e=>{
        if(!started)return; initAudio();
        const rect=canvas.getBoundingClientRect();
        const mx=(e.clientX-rect.left)/rect.width, my=(e.clientY-rect.top)/rect.height;
        let best=null, bestD=Infinity;
        for(const[id,d]of Object.entries(DRUMS)){
            const dist=Math.sqrt((mx-d.x)**2+(my-d.y)**2);
            if(dist<.1&&dist<bestD){best=id;bestD=dist;}
        }
        if(best){playDrum(best,.8);triggerHitVisual(best,.8);}
    });

    // ===================== UTILS =====================
    function clamp(v){return Math.max(0,Math.min(1,v));}

    document.addEventListener('touchmove',e=>{
        const ctrl=$('stick-ctrl'), ped=$('pedal-ctrl');
        if((ctrl&&ctrl.classList.contains('active'))||(ped&&ped.classList.contains('active')))
            e.preventDefault();
    },{passive:false});

    window.addEventListener('resize',()=>{if(started)resizeCanvas();});
    resizeCanvas();

    // Auto-connect via URL
    const urlGame=new URLSearchParams(location.search).get('game');
    if(urlGame){
        $('inp-stick').value=urlGame;
        $('inp-pedal').value=urlGame;
    }

    console.log('🥁 Bateria Virtual PRO — Pronto!');

    // ===================== API =====================
    return {
        goMenu, openKit, openStick, openPedal,
        connectStick, connectPedal,
        selectZone, setSens, doCalib,
        setPedalType, forceStart,
        pedalDown:()=>{}, pedalUp:()=>{}
    };
})();