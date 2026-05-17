// ======================= NAV =======================
const $ = id => document.getElementById(id);
const ALL = ['menu','visor-setup','game-ui','racket-setup','racket-ctrl'];
function show(id){ ALL.forEach(s=>$(s).style.display='none'); $(id).style.display='flex'; }

function goMenu(){
    if(hostPeer){hostPeer.destroy();hostPeer=null;}
    if(clientPeer){clientPeer.destroy();clientPeer=null;}
    if(clientConn){clientConn.close();clientConn=null;}
    if(sndT)clearInterval(sndT);
    if(afId)cancelAnimationFrame(afId);
    started=paused=false;p1con=p2con=false;conns=[null,null];
    show('menu');
}
function openVisor(){show('visor-setup');}
function openRacket(){
    const g=new URLSearchParams(location.search).get('game');
    if(g){$('inp').value=g;show('racket-setup');setTimeout(connectRacket,300);}
    else show('racket-setup');
}

// ======================= CONSTANTES =======================
const WIN=11;
let CW,CH; // canvas size — definido no resize
const canvas=$('gc'), ctx=canvas.getContext('2d');

// Proporções da mesa (relativas ao canvas)
function tableMetrics(){
    const mx=CW*.06, my=CH*.06;
    const tw=CW-mx*2, th=CH-my*2;
    return {mx,my,tw,th, netY:my+th/2, cx:mx+tw/2, cy:my+th/2,
        p1MinY:my+th/2+20, p1MaxY:my+th-10,
        p2MinY:my+10, p2MaxY:my+th/2-20};
}

function resizeCanvas(){
    const maxW=600, maxH=window.innerHeight-60;
    const ratio=5/8;
    let w=maxW, h=w/ratio;
    if(h>maxH){h=maxH;w=h*ratio;}
    CW=canvas.width=Math.floor(w);
    CH=canvas.height=Math.floor(h);
}

// ======================= ESTADO =======================
let gameMode=0,hostPeer=null,conns=[null,null];
let p1x=.5,p1y=.5,p2x=.5,p2y=.5;
let p1con=false,p2con=false;
let started=false,paused=false,afId=null;
let s1=0,s2=0,serveN=0;

let ball={x:0,y:0,z:0,vx:0,vy:0,vz:0,spin:0,active:false,inPlay:false,
    bounced:[false,false],lastHit:0,serving:1};

const GRAV=0.12, BDAMP=0.72, FRIC=0.997, NET_H=6;

// ======================= VISOR HOST =======================
function pickMode(m){
    gameMode=m;
    $('m1').classList.toggle('sel',m===1);
    $('m2').classList.toggle('sel',m===2);
    $('c2').classList.toggle('hidden',m===1);
    $('n2').textContent=m===1?'CPU':'JOGADOR 2';
    $('cpanel').style.display='block';
    initHost();
}

function initHost(){
    if(hostPeer)hostPeer.destroy();
    const id='PONG-'+Math.random().toString(36).substr(2,6).toUpperCase();
    hostPeer=new Peer(id,{debug:0});
    hostPeer.on('open',gid=>{
        $('gid').textContent=gid;
        const url=location.href.split('?')[0]+'?game='+gid;
        $('lnk').href=url;$('lnk').textContent=url;
        try{new QRious({element:$('qrc'),value:url,size:160,background:'white',foreground:'#111'});}catch(e){}
    });
    hostPeer.on('connection',c=>{
        c.on('open',()=>{
            if(!p1con){p1con=true;conns[0]=c;c.pn=1;$('c1').classList.add('on');c.send({t:'assign',p:1});}
            else if(!p2con&&gameMode===2){p2con=true;conns[1]=c;c.pn=2;$('c2').classList.add('on');c.send({t:'assign',p:2});}
            else{c.close();return;}
            checkReady();
        });
        c.on('data',d=>{
            if(d.t==='move'){if(c.pn===1){p1x=cl(d.x);p1y=cl(d.y);}else{p2x=cl(d.x);p2y=cl(d.y);}}
            if(d.t==='swing'){tryHit(c.pn,d.pw||1,d.sp||0,d.dx||0,d.dy||0);}
        });
        c.on('close',()=>{
            if(c.pn===1){p1con=false;$('c1').classList.remove('on');}
            else{p2con=false;$('c2').classList.remove('on');}
            if(started){paused=true;showMsg('Desconectou!');}
        });
    });
}

function checkReady(){
    const ok=(gameMode===1&&p1con)||(gameMode===2&&p1con&&p2con);
    if(ok&&!started){$('wt').textContent='✓ Pronto!';$('spn').style.display='none';setTimeout(startGame,800);}
    if(ok&&paused){paused=false;$('msg').style.display='none';gameLoop();}
}
function sendAll(d){conns.forEach(c=>{if(c&&c.open)c.send(d);});}

// ======================= JOGO =======================
function startGame(){
    started=true;paused=false;s1=0;s2=0;serveN=0;
    ball.serving=1;updSc();resizeCanvas();
    show('game-ui');
    let i=0;const seq=['3','2','1','SAQUE!'];
    (function next(){if(i<seq.length){showMsg(seq[i],i===3?500:550);i++;setTimeout(next,600);}
    else{doServe(ball.serving);gameLoop();}})();
}

function showMsg(t,d){$('msg').textContent=t;$('msg').style.display='block';setTimeout(()=>$('msg').style.display='none',d||600);}

function doServe(player){
    const T=tableMetrics();
    ball.active=true;ball.inPlay=false;ball.bounced=[false,false];
    ball.lastHit=player;ball.spin=0;
    ball.x=T.cx;ball.vx=0;ball.vy=0;
    if(player===1){ball.y=T.p1MaxY-20;ball.z=12;ball.vz=1.5;}
    else{ball.y=T.p2MinY+20;ball.z=12;ball.vz=1.5;}
    $('serve-info').textContent='Saque: Jogador '+player;
    $('serve-info').style.display='block';
    // Auto-serve
    setTimeout(()=>{if(!ball.inPlay&&ball.active)autoServe(player);},2200);
}

function autoServe(p){
    ball.inPlay=true;ball.z=10;ball.vz=-0.3;
    const T=tableMetrics();
    if(p===1){ball.vy=-(CH*0.008+Math.random()*CH*0.003);ball.vx=(Math.random()-.5)*3;}
    else{ball.vy=CH*0.008+Math.random()*CH*0.003;ball.vx=(Math.random()-.5)*3;}
    ball.bounced=[false,false];
    $('serve-info').style.display='none';
}

function tryHit(pn,pw,sp,dx,dy){
    if(!ball.active)return;
    if(!ball.inPlay&&ball.lastHit===pn){autoServe(pn);return;}
    if(!ball.inPlay)return;
    const T=tableMetrics();
    const px=pn===1?T.mx+p1x*T.tw:T.mx+p2x*T.tw;
    const py=pn===1?T.p1MinY+p1y*(T.p1MaxY-T.p1MinY):T.p2MinY+p2y*(T.p2MaxY-T.p2MinY);
    const dist=Math.sqrt((ball.x-px)**2+(ball.y-py)**2);
    if(dist<CH*0.08&&ball.z<22){
        pw=Math.min(pw,2.5);
        const dirX=dx*2+(ball.x-px)*0.15;
        if(pn===1){ball.vy=-(CH*0.006+pw*CH*0.005);ball.vx=dirX;}
        else{ball.vy=CH*0.006+pw*CH*0.005;ball.vx=dirX;}
        ball.vz=1+pw*1.5;ball.spin=sp*0.4;
        ball.lastHit=pn;ball.bounced=[false,false];
        const c=conns[pn-1];if(c&&c.open)c.send({t:'haptic'});
    }
}

function getPx(pn){const T=tableMetrics();return pn===1?T.mx+p1x*T.tw:T.mx+p2x*T.tw;}
function getPy(pn){const T=tableMetrics();return pn===1?T.p1MinY+p1y*(T.p1MaxY-T.p1MinY):T.p2MinY+p2y*(T.p2MaxY-T.p2MinY);}

function updSc(){$('sc1').textContent=s1;$('sc2').textContent=s2;sendAll({t:'score',a:s1,b:s2});}
function cl(v){return Math.max(0,Math.min(1,v));}

// AI
let aiTx=.5,aiTy=.5,aiC=0;
function doAI(){
    aiC++;if(aiC>6){aiC=0;
        if(ball.active&&ball.inPlay&&ball.vy<0){
            const T=tableMetrics();
            const t=Math.abs((T.p2MinY+30-ball.y)/(ball.vy||1));
            let px=ball.x+ball.vx*t;px=Math.max(T.mx,Math.min(T.mx+T.tw,px));
            aiTx=(px-T.mx)/T.tw+(Math.random()-.5)*.08;aiTy=.25+Math.random()*.3;
        }else{aiTx=.5+(Math.random()-.5)*.15;aiTy=.5;}
    }
    p2x+=(cl(aiTx)-p2x)*.07;p2y+=(cl(aiTy)-p2y)*.07;
    // AI rebate
    if(ball.active&&ball.inPlay&&ball.vy<0){
        const dist=Math.sqrt((ball.x-getPx(2))**2+(ball.y-getPy(2))**2);
        if(dist<CH*.07&&ball.z<18&&ball.z>0)tryHit(2,.7+Math.random()*.9,(Math.random()-.5)*1.5,0,0);
    }
}

// GAME LOOP
function gameLoop(){if(paused){afId=null;return;}update();render();afId=requestAnimationFrame(gameLoop);}

function update(){
    if(gameMode===1)doAI();
    if(!ball.active)return;
    const T=tableMetrics();
    if(!ball.inPlay){ball.z+=ball.vz;ball.vz-=GRAV*.3;if(ball.z<8){ball.z=8;ball.vz=Math.abs(ball.vz)*.4;}if(ball.z>28)ball.vz=-Math.abs(ball.vz)*.3;return;}

    ball.x+=ball.vx;ball.y+=ball.vy;ball.z+=ball.vz;
    ball.vz-=GRAV;ball.vx*=FRIC;ball.vy*=FRIC;ball.vx+=ball.spin*.01;

    if(ball.z<=0&&ball.vz<0){
        const onT=ball.x>=T.mx&&ball.x<=T.mx+T.tw&&ball.y>=T.my&&ball.y<=T.my+T.th;
        if(onT){ball.z=0;ball.vz=Math.abs(ball.vz)*BDAMP;
            if(ball.y<T.netY)ball.bounced[1]=true;else ball.bounced[0]=true;
        }else{pointDone();return;}
    }
    if(ball.z<-8){pointDone();return;}

    // Rede
    if(Math.abs(ball.y-T.netY)<3&&ball.z<NET_H){ball.vy*=-.3;ball.vz=1.5;ball.y+=ball.vy>0?4:-4;}

    if(ball.x<T.mx-35||ball.x>T.mx+T.tw+35||ball.y<T.my-70||ball.y>T.my+T.th+70){pointDone();}
}

function pointDone(){
    ball.active=false;
    const T=tableMetrics();
    let scorer;
    if(ball.lastHit===1){scorer=ball.bounced[1]?1:2;}
    else{scorer=ball.bounced[0]?2:1;}
    if(scorer===1)s1++;else s2++;updSc();
    serveN++;if(serveN>=2){serveN=0;ball.serving=ball.serving===1?2:1;}
    if(checkWin())return;
    setTimeout(()=>{if(started)doServe(ball.serving);},1000);
}

function checkWin(){
    if(s1>=WIN||s2>=WIN){
        if(Math.abs(s1-s2)<2&&s1>=WIN-1&&s2>=WIN-1)return false;
        paused=true;
        const w=s1>s2?'Jogador 1':(gameMode===1?'CPU':'Jogador 2');
        sendAll({t:'gameover',w,a:s1,b:s2});
        showMsg(w+' Venceu! 🏆',2800);
        setTimeout(()=>{s1=0;s2=0;updSc();serveN=0;ball.serving=1;paused=false;doServe(1);gameLoop();},3500);
        return true;
    }return false;
}

// ======================= RENDER =======================
function render(){
    const T=tableMetrics();
    ctx.fillStyle='#0d0d0d';ctx.fillRect(0,0,CW,CH);

    // Sombra mesa
    ctx.fillStyle='rgba(0,0,0,.5)';
    roundRect(T.mx+4,T.my+4,T.tw,T.th,6);

    // Mesa
    const tg=ctx.createLinearGradient(T.mx,T.my,T.mx,T.my+T.th);
    tg.addColorStop(0,'#1b5e20');tg.addColorStop(.5,'#2e7d32');tg.addColorStop(1,'#1b5e20');
    ctx.fillStyle=tg;roundRect(T.mx,T.my,T.tw,T.th,4);

    // Borda
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(T.mx,T.my,T.tw,T.th);

    // Linha central
    ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(T.mx,T.netY);ctx.lineTo(T.mx+T.tw,T.netY);ctx.stroke();

    // Linha saque
    ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1;ctx.setLineDash([3,3]);
    ctx.beginPath();ctx.moveTo(T.cx,T.my);ctx.lineTo(T.cx,T.my+T.th);ctx.stroke();ctx.setLineDash([]);

    // Sombra bola
    if(ball.active){
        const bsz=Math.max(2,5-ball.z*.12);
        ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();
        ctx.ellipse(ball.x,ball.y+1,bsz+2,bsz*.5,0,0,Math.PI*2);ctx.fill();
    }

    // Raquetes
    drawR(getPx(1),getPy(1),'#1565c0','#0d47a1');
    drawR(getPx(2),getPy(2),'#c62828','#b71c1c');

    // Rede detalhe
    ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(T.mx-4,T.netY);ctx.lineTo(T.mx+T.tw+4,T.netY);ctx.stroke();
    ctx.fillStyle='#90a4ae';
    ctx.fillRect(T.mx-6,T.netY-2,5,4);ctx.fillRect(T.mx+T.tw+1,T.netY-2,5,4);
    ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=.5;
    for(let x=T.mx;x<T.mx+T.tw;x+=8){ctx.beginPath();ctx.moveTo(x,T.netY-2);ctx.lineTo(x,T.netY+2);ctx.stroke();}
    // Rede sombra
    ctx.fillStyle='rgba(0,0,0,.08)';ctx.fillRect(T.mx,T.netY+2,T.tw,3);

    // Bola
    if(ball.active){
        const vy=ball.y-ball.z*.7, vs=5+ball.z*.08;
        ctx.shadowColor='rgba(255,150,0,.3)';ctx.shadowBlur=ball.z*.4;
        const g=ctx.createRadialGradient(ball.x-1,vy-1,0,ball.x,vy,vs);
        g.addColorStop(0,'#fff');g.addColorStop(.3,'#ffeb3b');g.addColorStop(.7,'#ff9800');g.addColorStop(1,'#e65100');
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(ball.x,vy,vs,0,Math.PI*2);ctx.fill();
        ctx.shadowBlur=0;
        // Listinha
        ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=.8;
        ctx.beginPath();ctx.arc(ball.x,vy,vs*.6,-.4,.4);ctx.stroke();
    }
}

function drawR(x,y,c1,c2){
    ctx.save();ctx.translate(x,y);
    ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(2,2,18,14,0,0,Math.PI*2);ctx.fill();
    const rg=ctx.createRadialGradient(-2,-2,0,0,0,16);rg.addColorStop(0,c1);rg.addColorStop(1,c2);
    ctx.fillStyle=rg;ctx.beginPath();ctx.ellipse(0,0,18,14,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#222';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,0,18,14,0,0,Math.PI*2);ctx.stroke();
    // Texture
    ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=.4;
    for(let i=-12;i<12;i+=3){ctx.beginPath();ctx.moveTo(i,-12);ctx.lineTo(i,12);ctx.stroke();}
    for(let i=-10;i<10;i+=3){ctx.beginPath();ctx.moveTo(-15,i);ctx.lineTo(15,i);ctx.stroke();}
    // Cabo
    ctx.fillStyle='#5d4037';ctx.fillRect(-3,12,6,10);
    ctx.strokeStyle='#4e342e';ctx.lineWidth=.8;ctx.strokeRect(-3,12,6,10);
    ctx.restore();
}

function roundRect(x,y,w,h,r){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
    ctx.closePath();ctx.fill();
}

// ======================= RAQUETE (CELULAR) =======================
let clientPeer=null,clientConn=null,sndT=null;
let myX=.5,myY=.5,cBeta=0,cGamma=0,cAlpha=0,useG=false,myPN=0;
let swingCooldown=0;
let accHistory=[];

function connectRacket(){
    const id=$('inp').value.trim().toUpperCase();
    if(!id){$('err').textContent='Digite o código!';return;}
    $('err').textContent='';
    $('connecting-overlay').style.display='flex';

    if(clientPeer)clientPeer.destroy();
    clientPeer=new Peer(undefined,{debug:0});

    clientPeer.on('open',()=>{
        clientConn=clientPeer.connect(id,{reliable:false});
        clientConn.on('open',()=>{
            $('connecting-overlay').style.display='none';
            $('rst').textContent='🟢';$('rst').style.color='#4f4';
        });
        clientConn.on('data',handleRD);
        clientConn.on('close',()=>{$('rst').textContent='🔴';$('rst').style.color='#f44';if(sndT)clearInterval(sndT);});
        clientConn.on('error',()=>{$('connecting-overlay').style.display='none';$('err').textContent='Código não encontrado.';show('racket-setup');});
    });
    clientPeer.on('error',()=>{$('connecting-overlay').style.display='none';$('err').textContent='Erro de conexão.';});
}

function handleRD(d){
    switch(d.t){
        case 'assign':
            myPN=d.p;
            $('rlbl').textContent='Jogador '+myPN;
            $('rlbl').style.color=myPN===1?'#2196f3':'#f44336';
            if(myPN===1){$('rface').classList.remove('red');$('rface').classList.add('blue');}
            else{$('rface').classList.remove('blue');$('rface').classList.add('red');}
            show('racket-ctrl');
            initRacketSensors();
            break;
        case 'score':
            $('rscr').textContent=d.a+' × '+d.b;break;
        case 'haptic':
            navigator.vibrate&&navigator.vibrate(60);
            $('big-racket').classList.remove('hit-flash');
            void $('big-racket').offsetWidth;
            $('big-racket').classList.add('hit-flash');
            break;
        case 'gameover':
            const win=(myPN===1&&d.a>d.b)||(myPN===2&&d.b>d.a);
            $('gotxt').textContent=win?'🏆 Você Venceu!':'😢 Você Perdeu';
            $('gotxt').style.color=win?'#4f4':'#f44';
            $('goscr').innerHTML=`<span style="color:#2196f3">${d.a}</span> × <span style="color:#f44336">${d.b}</span>`;
            $('gov').style.display='flex';
            if(win)navigator.vibrate&&navigator.vibrate([80,40,80,40,200]);
            setTimeout(()=>$('gov').style.display='none',3500);
            break;
    }
}

// ======================= SENSORES DO CELULAR =======================
async function initRacketSensors(){
    // Tentar giroscópio
    if(typeof DeviceOrientationEvent!=='undefined'){
        if(typeof DeviceOrientationEvent.requestPermission==='function'){
            try{const p=await DeviceOrientationEvent.requestPermission();
                if(p==='granted'){useG=true;}}catch(e){}
        }else{
            let ok=false;const t=e=>{if(e.beta!==null)ok=true;};
            window.addEventListener('deviceorientation',t);
            await new Promise(r=>setTimeout(r,600));
            window.removeEventListener('deviceorientation',t);
            if(ok)useG=true;
        }
    }

    if(useG){
        $('calib').style.display='flex';
        setupOrientationSensor();
        setupMotionSensor();
    }else{
        setupTouchFallback();
        startSendR();
    }
}

function setupOrientationSensor(){
    window.addEventListener('deviceorientation',e=>{
        if(!useG)return;
        const beta=e.beta||0, gamma=e.gamma||0, alpha=e.alpha||0;

        // Posição X: inclinação lateral (gamma)
        // Posição Y: inclinação frente/trás (beta)
        myX=cl(.5+(gamma-cGamma)/50*.5);
        myY=cl(.5+(beta-cBeta)/50*.5);

        // Rotação visual da raquete no celular
        const rx=(beta-cBeta)*0.8;  // tilt frente/trás
        const ry=(gamma-cGamma)*0.8; // tilt lateral
        const rz=(alpha-cAlpha)*0.3; // rotação

        const rack=$('big-racket');
        if(rack){
            rack.style.transform=`perspective(500px) rotateX(${-rx}deg) rotateY(${ry}deg) rotateZ(${-rz*.3}deg)`;
        }
    });
}

function setupMotionSensor(){
    window.addEventListener('devicemotion',e=>{
        const acc=e.acceleration||e.accelerationIncludingGravity;
        if(!acc)return;

        const ax=acc.x||0, ay=acc.y||0, az=acc.z||0;
        const total=Math.sqrt(ax*ax+ay*ay+az*az);

        // Histórico para detectar swing
        accHistory.push({t:Date.now(),v:total,ax,ay,az});
        if(accHistory.length>20)accHistory.shift();

        const now=Date.now();

        // Detectar swing: aceleração rápida
        if(total>12&&now-swingCooldown>350){
            swingCooldown=now;
            const power=Math.min((total-10)/15,2.5);
            const spinVal=ax*0.15;
            const dirX=(acc.x||0)*0.1;
            const dirY=(acc.y||0)*0.1;

            if(clientConn&&clientConn.open){
                clientConn.send({t:'swing',pw:power,sp:spinVal,dx:dirX,dy:dirY});
            }

            // Feedback visual
            navigator.vibrate&&navigator.vibrate(25);
            const si=$('swing-indicator');
            if(si){
                si.textContent=power>1.5?'💥 SMASH!':power>1?'🏓 Rebatida!':'🏓 Toque';
                si.classList.add('show');
                setTimeout(()=>si.classList.remove('show'),400);
            }
        }

        // Debug
        const db=$('racket-debug');
        if(db)db.textContent=`acc: ${total.toFixed(1)} | x:${myX.toFixed(2)} y:${myY.toFixed(2)}`;
    });
}

window.doCalib=function(){
    window.addEventListener('deviceorientation',function h(e){
        cBeta=e.beta||0;cGamma=e.gamma||0;cAlpha=e.alpha||0;
        window.removeEventListener('deviceorientation',h);
    },{once:true});
    setTimeout(()=>{$('calib').style.display='none';startSendR();},300);
};

function setupTouchFallback(){
    $('racket-debug').textContent='Modo toque';
    const rv=$('racket-view');
    if(!rv)return;
    const h=e=>{
        e.preventDefault();
        const r=rv.getBoundingClientRect();
        myX=cl((e.touches[0].clientX-r.left)/r.width);
        myY=cl((e.touches[0].clientY-r.top)/r.height);
    };
    rv.addEventListener('touchstart',h,{passive:false});
    rv.addEventListener('touchmove',h,{passive:false});
    // Toque duplo = swing
    let lt=0;
    rv.addEventListener('touchstart',e=>{
        const now=Date.now();
        if(now-lt<300&&clientConn&&clientConn.open){
            clientConn.send({t:'swing',pw:1,sp:0,dx:0,dy:0});
            navigator.vibrate&&navigator.vibrate(25);
        }
        lt=now;
    });
    // Mouse
    let down=false;
    rv.addEventListener('mousedown',()=>down=true);
    window.addEventListener('mouseup',()=>down=false);
    rv.addEventListener('mousemove',e=>{
        if(!down)return;
        const r=rv.getBoundingClientRect();
        myX=cl((e.clientX-r.left)/r.width);
        myY=cl((e.clientY-r.top)/r.height);
    });
    rv.addEventListener('dblclick',()=>{
        if(clientConn&&clientConn.open)clientConn.send({t:'swing',pw:1,sp:0,dx:0,dy:0});
    });
}

function startSendR(){
    sndT=setInterval(()=>{
        if(clientConn&&clientConn.open)clientConn.send({t:'move',x:myX,y:myY});
    },16);
}

// Prevenir scroll
document.addEventListener('touchmove',e=>{
    if($('racket-ctrl').style.display==='flex')e.preventDefault();
},{passive:false});

// Resize
window.addEventListener('resize',()=>{if(started)resizeCanvas();});

// ======================= INIT =======================
resizeCanvas();
const urlGame=new URLSearchParams(location.search).get('game');
if(urlGame){$('inp').value=urlGame;show('racket-setup');setTimeout(connectRacket,300);}
else show('menu');