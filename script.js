
// =====================================================
//                    NAVEGAÇÃO
// =====================================================
const $ = id => document.getElementById(id);
const screens = ['menu','visor-setup','game-ui','racket-setup','racket-ctrl'];

function show(id) {
    screens.forEach(s => $(s).style.display = 'none');
    $(id).style.display = 'flex';
}

function goMenu() {
    if (hostPeer) { hostPeer.destroy(); hostPeer = null; }
    if (clientPeer) { clientPeer.destroy(); clientPeer = null; }
    if (clientConn) { clientConn.close(); clientConn = null; }
    if (sendTimer) clearInterval(sendTimer);
    if (afId) cancelAnimationFrame(afId);
    started = false; paused = false;
    p1con = false; p2con = false;
    conns = [null, null];
    show('menu');
}

function openVisor() { show('visor-setup'); }
function openRacket() {
    // Checar se veio com ?game= na URL
    const params = new URLSearchParams(location.search);
    const gid = params.get('game');
    if (gid) {
        $('inp').value = gid;
        show('racket-setup');
        connectRacket();
    } else {
        show('racket-setup');
    }
}

// =====================================================
//                  CONSTANTES DO JOGO
// =====================================================
const WIN = 11, CW = 900, CH = 550, PW = 14, PH = 100, BR = 7, MG = 25;
const canvas = $('gc');
const ctx = canvas.getContext('2d');

// =====================================================
//                  ESTADO DO JOGO
// =====================================================
let gameMode = 0;
let hostPeer = null;
let conns = [null, null];
let p1y = .5, p2y = .5;
let p1con = false, p2con = false;
let started = false, paused = false, afId = null;
let sc1 = 0, sc2 = 0, rally = 0;
let ball = { x: CW/2, y: CH/2, vx: 5, vy: 3, sp: 5 };
let parts = [], trail = [];

// =====================================================
//             VISOR: ESCOLHER MODO
// =====================================================
function pickMode(m) {
    gameMode = m;
    $('m1').classList.toggle('sel', m === 1);
    $('m2').classList.toggle('sel', m === 2);
    $('c2').classList.toggle('hidden', m === 1);
    $('n2').textContent = m === 1 ? 'CPU' : 'JOGADOR 2';
    $('cpanel').style.display = 'block';
    initHost();
}

// =====================================================
//             VISOR: PEERJS HOST
// =====================================================
function initHost() {
    if (hostPeer) hostPeer.destroy();
    const id = 'PONG-' + Math.random().toString(36).substr(2,6).toUpperCase();
    hostPeer = new Peer(id, { debug: 0 });

    hostPeer.on('open', gid => {
        $('gid').textContent = gid;
        const url = location.href.split('?')[0] + '?game=' + gid;
        $('lnk').href = url; $('lnk').textContent = url;
        try { new QRious({ element: $('qrc'), value: url, size: 180,
            background:'white', foreground:'#0a0a1a' }); } catch(e){}
    });

    hostPeer.on('connection', c => {
        c.on('open', () => {
            if (!p1con) {
                p1con = true; conns[0] = c; c.pn = 1;
                $('c1').classList.add('on');
                c.send({ t:'assign', p:1 });
            } else if (!p2con && gameMode === 2) {
                p2con = true; conns[1] = c; c.pn = 2;
                $('c2').classList.add('on');
                c.send({ t:'assign', p:2 });
            } else { c.close(); return; }
            checkReady();
        });
        c.on('data', d => {
            if (d.t === 'move') {
                if (c.pn === 1) p1y = cl(d.v);
                else p2y = cl(d.v);
            }
        });
        c.on('close', () => {
            if (c.pn === 1) { p1con = false; $('c1').classList.remove('on'); }
            else { p2con = false; $('c2').classList.remove('on'); }
            if (started) { paused = true; showMsg('Desconectou!'); }
        });
    });

    hostPeer.on('error', e => console.log('Host err:', e));
}

function checkReady() {
    const ok = (gameMode === 1 && p1con) || (gameMode === 2 && p1con && p2con);
    if (ok && !started) {
        $('wt').textContent = '✓ Todos conectados!';
        $('spn').style.display = 'none';
        setTimeout(startGame, 1000);
    }
    if (ok && paused) { paused = false; gameLoop(); }
}

function sendAll(d) { conns.forEach(c => { if (c && c.open) c.send(d); }); }

// =====================================================
//                  JOGO
// =====================================================
function startGame() {
    started = true; paused = false;
    sc1 = 0; sc2 = 0; updSc(); resetBall();
    show('game-ui');
    let i = 0;
    const seq = ['3','2','1','GO!'];
    (function next() {
        if (i < seq.length) { showMsg(seq[i], i===3?400:650); i++; setTimeout(next, i===3?500:750); }
        else gameLoop();
    })();
}

function showMsg(t, d) {
    $('msg').textContent = t; $('msg').style.display = 'block';
    setTimeout(() => $('msg').style.display = 'none', d || 700);
}

function resetBall() {
    ball.x = CW/2; ball.y = CH/2; ball.sp = 5 + Math.random()*2;
    const a = (Math.random()-.5)*Math.PI/3;
    ball.vx = Math.cos(a)*ball.sp*(Math.random()>.5?1:-1);
    ball.vy = Math.sin(a)*ball.sp;
    rally = 0; trail = [];
}

function updSc() {
    $('s1').textContent = sc1; $('s2').textContent = sc2;
    sendAll({ t:'score', a:sc1, b:sc2 });
}

function gameLoop() {
    if (paused) { afId = null; return; }
    update(); render();
    afId = requestAnimationFrame(gameLoop);
}

function update() {
    const pp1 = p1y * (CH - PH);
    let pp2 = gameMode === 1 ? doAI() : p2y * (CH - PH);

    trail.push({ x:ball.x, y:ball.y });
    if (trail.length > 12) trail.shift();

    ball.x += ball.vx; ball.y += ball.vy;

    if (ball.y - BR <= 0) { ball.y = BR; ball.vy = Math.abs(ball.vy); sp(ball.x,0,'#00f5ff',3); }
    if (ball.y + BR >= CH) { ball.y = CH-BR; ball.vy = -Math.abs(ball.vy); sp(ball.x,CH,'#00f5ff',3); }

    if (ball.x-BR <= MG+PW && ball.x > MG && ball.y > pp1 && ball.y < pp1+PH && ball.vx < 0) doHit(pp1,1);
    if (ball.x+BR >= CW-MG-PW && ball.x < CW-MG && ball.y > pp2 && ball.y < pp2+PH && ball.vx > 0) doHit(pp2,2);

    if (ball.x < -20) { sc2++; updSc(); sp(0,ball.y,'#ff00e4',18); checkWin()||resetBall(); }
    if (ball.x > CW+20) { sc1++; updSc(); sp(CW,ball.y,'#00f5ff',18); checkWin()||resetBall(); }

    for (let i = parts.length-1; i >= 0; i--) {
        const p = parts[i]; p.x += p.vx; p.y += p.vy;
        p.vx *= .96; p.vy *= .96; p.l -= .025;
        if (p.l <= 0) parts.splice(i,1);
    }
}

function doHit(py, pn) {
    rally++;
    const hp = (ball.y - py) / PH, a = (hp-.5)*Math.PI/2.5;
    ball.sp = Math.min(5 + rally*.3, 14);
    ball.vx = Math.cos(a)*ball.sp*(pn===1?1:-1);
    ball.vy = Math.sin(a)*ball.sp;
    ball.x = pn===1 ? MG+PW+BR+1 : CW-MG-PW-BR-1;
    sp(ball.x, ball.y, pn===1?'#00f5ff':'#ff00e4', 10);
    const c = conns[pn-1];
    if (c && c.open) c.send({ t:'haptic' });
}

let aiT = CH/2, aiTm = 0;
function doAI() {
    aiTm++;
    if (aiTm > 8) { aiTm = 0;
        if (ball.vx > 0) {
            const t = (CW-MG-PW-ball.x)/ball.vx;
            let py = ball.y + ball.vy*t;
            while (py<0||py>CH) py = py<0?-py:2*CH-py;
            aiT = py + (Math.random()-.5)*60;
        } else aiT = CH/2 + (Math.random()-.5)*120;
    }
    let cy = p2y*(CH-PH)+PH/2;
    cy += Math.sign(aiT-cy)*Math.min(Math.abs(aiT-cy),4.5);
    p2y = cl((cy-PH/2)/(CH-PH));
    return p2y*(CH-PH);
}

function checkWin() {
    if (sc1>=WIN||sc2>=WIN) {
        paused = true;
        const w = sc1>=WIN?'Jogador 1':(gameMode===1?'CPU':'Jogador 2');
        sendAll({ t:'gameover', w, a:sc1, b:sc2 });
        showMsg(w+' Venceu! 🏆', 2500);
        setTimeout(()=>{ sc1=0;sc2=0;updSc();resetBall();paused=false;gameLoop(); }, 3000);
        return true;
    }
    return false;
}

function sp(x,y,c,n) {
    for (let i=0;i<n;i++) parts.push({x,y,vx:(Math.random()-.5)*7,vy:(Math.random()-.5)*7,l:1,c,s:2+Math.random()*4});
}

function cl(v) { return Math.max(0,Math.min(1,v)); }

// =====================================================
//                  RENDERIZAÇÃO
// =====================================================
function render() {
    ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0,0,CW,CH);

    ctx.setLineDash([10,10]); ctx.strokeStyle = 'rgba(255,255,255,.06)';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(CW/2,0); ctx.lineTo(CW/2,CH); ctx.stroke(); ctx.setLineDash([]);

    ctx.beginPath(); ctx.arc(CW/2,CH/2,50,0,Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,.03)'; ctx.stroke();

    const pp1 = p1y*(CH-PH), pp2 = p2y*(CH-PH);

    ctx.shadowColor = '#00f5ff'; ctx.shadowBlur = 16; ctx.fillStyle = '#00f5ff'; rr(MG,pp1,PW,PH,6);
    ctx.shadowColor = '#ff00e4'; ctx.fillStyle = '#ff00e4'; rr(CW-MG-PW,pp2,PW,PH,6);
    ctx.shadowBlur = 0;

    trail.forEach((t,i)=>{
        ctx.fillStyle = `rgba(255,255,255,${i/trail.length*.2})`;
        ctx.beginPath(); ctx.arc(t.x,t.y,BR*(i/trail.length),0,Math.PI*2); ctx.fill();
    });

    ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
    const g = ctx.createRadialGradient(ball.x,ball.y,0,ball.x,ball.y,BR);
    g.addColorStop(0,'#fff'); g.addColorStop(1,'rgba(255,255,255,.3)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ball.x,ball.y,BR,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    parts.forEach(p=>{
        ctx.globalAlpha = p.l; ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.s*p.l,0,Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (rally > 3) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(rally*.04,.25)})`;
        ctx.font = `bold ${45+rally*3}px monospace`;
        ctx.textAlign = 'center'; ctx.fillText(rally,CW/2,CH/2-8);
    }
}

function rr(x,y,w,h,r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
    ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath(); ctx.fill();
}

// =====================================================
//             RAQUETE: CONEXÃO
// =====================================================
let clientPeer = null, clientConn = null, sendTimer = null;
let myPos = .5, calibBeta = 0, useGyro = false, myPN = 0;

function connectRacket() {
    const id = $('inp').value.trim().toUpperCase();
    if (!id) { $('err').textContent = 'Digite o código!'; return; }
    $('err').textContent = '';

    if (clientPeer) clientPeer.destroy();
    clientPeer = new Peer(undefined, { debug: 0 });

    clientPeer.on('open', () => {
        clientConn = clientPeer.connect(id, { reliable: false });
        clientConn.on('open', () => {
            $('rst').textContent = '🟢'; $('rst').style.color = '#4f4';
        });
        clientConn.on('data', handleRacketData);
        clientConn.on('close', () => {
            $('rst').textContent = '🔴'; $('rst').style.color = '#f44';
            if (sendTimer) clearInterval(sendTimer);
        });
        clientConn.on('error', () => {
            $('err').textContent = 'Código não encontrado. Verifique e tente novamente.';
            show('racket-setup');
        });
    });

    clientPeer.on('error', e => {
        console.log('Client err:', e);
        $('err').textContent = 'Erro de conexão. Tente novamente.';
    });
}

function handleRacketData(d) {
    switch(d.t) {
        case 'assign':
            myPN = d.p;
            $('rlbl').textContent = 'Jogador ' + myPN;
            $('rlbl').style.color = myPN===1?'#00f5ff':'#ff00e4';
            if (myPN===2) $('rp').classList.add('p2');
            show('racket-ctrl');
            tryGyro();
            break;
        case 'score':
            $('rscr').textContent = d.a + ' × ' + d.b;
            break;
        case 'haptic':
            navigator.vibrate && navigator.vibrate(30);
            $('rp').classList.remove('fl'); void $('rp').offsetWidth; $('rp').classList.add('fl');
            break;
        case 'gameover':
            const win = (myPN===1&&d.a>=WIN)||(myPN===2&&d.b>=WIN);
            $('gotxt').textContent = win?'🏆 Você Venceu!':'😢 Você Perdeu';
            $('gotxt').style.color = win?'#4f4':'#f44';
            $('goscr').innerHTML = `<span style="color:#00f5ff">${d.a}</span> × <span style="color:#ff00e4">${d.b}</span>`;
            $('gov').style.display = 'flex';
            if (win) navigator.vibrate && navigator.vibrate([80,40,80,40,200]);
            setTimeout(()=> $('gov').style.display='none', 3500);
            break;
    }
}

// =====================================================
//             RAQUETE: GIROSCÓPIO / TOQUE
// =====================================================
async function tryGyro() {
    if (typeof DeviceOrientationEvent !== 'undefined') {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const p = await DeviceOrientationEvent.requestPermission();
                if (p === 'granted') { useGyro = true; setupGyro(); $('calib').style.display = 'flex'; return; }
            } catch(e) {}
        } else {
            // Testar se realmente funciona
            let ok = false;
            const test = e => { if (e.beta !== null) ok = true; };
            window.addEventListener('deviceorientation', test);
            await new Promise(r => setTimeout(r, 500));
            window.removeEventListener('deviceorientation', test);
            if (ok) { useGyro = true; setupGyro(); $('calib').style.display = 'flex'; return; }
        }
    }
    // Fallback: toque
    useGyro = false;
    setupTouch();
    startSend();
}

function setupGyro() {
    window.addEventListener('deviceorientation', e => {
        if (!useGyro) return;
        myPos = cl(.5 + ((e.beta||0) - calibBeta) / 50 * .5);
        updPaddle();
    });
}

window.doCalib = function() {
    window.addEventListener('deviceorientation', function h(e) {
        calibBeta = e.beta || 0;
        window.removeEventListener('deviceorientation', h);
    }, { once: true });
    setTimeout(() => { $('calib').style.display = 'none'; startSend(); }, 300);
};

function setupTouch() {
    $('rf').textContent = '👆 Arraste para mover';
    const h = e => {
        e.preventDefault();
        const r = $('ra').getBoundingClientRect();
        myPos = cl((e.touches[0].clientY - r.top) / r.height);
        updPaddle();
    };
    $('ra').addEventListener('touchstart', h, { passive: false });
    $('ra').addEventListener('touchmove', h, { passive: false });

    // Mouse (teste desktop)
    let down = false;
    $('ra').addEventListener('mousedown', () => down = true);
    window.addEventListener('mouseup', () => down = false);
    $('ra').addEventListener('mousemove', e => {
        if (!down) return;
        const r = $('ra').getBoundingClientRect();
        myPos = cl((e.clientY - r.top) / r.height);
        updPaddle();
    });
}

function updPaddle() {
    const area = $('ra'), pad = $('rp');
    if (!area || !pad) return;
    const aH = area.clientHeight, pH = pad.clientHeight, hH = 45;
    pad.style.top = Math.max(0, hH + myPos * (aH - pH - hH)) + 'px';
}

function startSend() {
    $('rf').textContent = useGyro ? '🔄 Giroscópio ativo' : '👆 Arraste para mover';
    updPaddle();
    sendTimer = setInterval(() => {
        if (clientConn && clientConn.open) clientConn.send({ t:'move', v:myPos });
    }, 16);
}

// Prevenir scroll no mobile
document.addEventListener('touchmove', e => {
    if ($('racket-ctrl').style.display === 'flex') e.preventDefault();
}, { passive: false });

// =====================================================
//                  AUTO-CONNECT VIA URL
// =====================================================
const urlGame = new URLSearchParams(location.search).get('game');
if (urlGame) {
    $('inp').value = urlGame;
    show('racket-setup');
    setTimeout(connectRacket, 500);
} else {
    show('menu');
}

console.log('🏓 Ping Pong pronto!');