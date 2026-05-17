// ======================== NAVEGAÇÃO ========================
const $ = id => document.getElementById(id);
const screens = ['menu','visor-setup','game-ui','racket-setup','racket-ctrl'];
function show(id) { screens.forEach(s => $(s).style.display = 'none'); $(id).style.display = 'flex'; }

function goMenu() {
    if (hostPeer) { hostPeer.destroy(); hostPeer = null; }
    if (clientPeer) { clientPeer.destroy(); clientPeer = null; }
    if (clientConn) { clientConn.close(); clientConn = null; }
    if (sendTmr) clearInterval(sendTmr);
    if (afId) cancelAnimationFrame(afId);
    started = paused = false; p1con = p2con = false; conns = [null,null];
    show('menu');
}
function openVisor() { show('visor-setup'); }
function openRacket() {
    const g = new URLSearchParams(location.search).get('game');
    if (g) { $('inp').value = g; show('racket-setup'); setTimeout(connectRacket, 400); }
    else show('racket-setup');
}

// ======================== CONSTANTES MESA REAL ========================
const TW = 500, TH = 800;                    // Canvas
const TABLE_X = 30, TABLE_Y = 60;            // Margem mesa
const TABLE_W = TW - 60, TABLE_H = TH - 120; // Mesa
const NET_Y = TH / 2;                         // Rede
const PADDLE_W = 50, PADDLE_H = 10;
const BALL_R = 6;
const WIN = 11;

// Posições limites das raquetes
const P1_MIN_Y = NET_Y + 20;  // Jogador 1 (baixo)
const P1_MAX_Y = TABLE_Y + TABLE_H - 10;
const P2_MIN_Y = TABLE_Y + 10;  // Jogador 2 (cima)
const P2_MAX_Y = NET_Y - 20;

const canvas = $('gc');
const ctx = canvas.getContext('2d');

// ======================== ESTADO ========================
let gameMode = 0, hostPeer = null, conns = [null, null];
let p1x = .5, p1y = .5, p2x = .5, p2y = .5;
let p1con = false, p2con = false;
let started = false, paused = false, afId = null;
let s1 = 0, s2 = 0;

// Bola com física 3D simplificada
let ball = {
    x: TW/2, y: TH/2, z: 0,           // posição (z = altura)
    vx: 0, vy: 0, vz: 0,               // velocidade
    spin: 0,                             // spin (efeito)
    shadow: { x: 0, y: 0 },
    active: false,
    bounced: [false, false],             // quicou em cada lado?
    lastHit: 0,                          // 1 ou 2
    serving: 1,                          // quem saca
    inPlay: false
};

const GRAVITY = 0.15;
const BOUNCE_DAMP = 0.7;
const TABLE_Z = 0;     // altura da mesa
const NET_HEIGHT = 8;
const FRICTION = 0.995;

// ======================== VISOR HOST ========================
function pickMode(m) {
    gameMode = m;
    $('m1').classList.toggle('sel', m===1);
    $('m2').classList.toggle('sel', m===2);
    $('c2').classList.toggle('hidden', m===1);
    $('n2').textContent = m===1 ? 'CPU' : 'JOGADOR 2';
    $('cpanel').style.display = 'block';
    initHost();
}

function initHost() {
    if (hostPeer) hostPeer.destroy();
    const id = 'PONG-' + Math.random().toString(36).substr(2,6).toUpperCase();
    hostPeer = new Peer(id, { debug:0 });
    hostPeer.on('open', gid => {
        $('gid').textContent = gid;
        const url = location.href.split('?')[0] + '?game=' + gid;
        $('lnk').href = url; $('lnk').textContent = url;
        try { new QRious({ element:$('qrc'), value:url, size:170, background:'white', foreground:'#1a1a2e' }); } catch(e){}
    });
    hostPeer.on('connection', c => {
        c.on('open', () => {
            if (!p1con) { p1con=true; conns[0]=c; c.pn=1; $('c1').classList.add('on'); c.send({t:'assign',p:1}); }
            else if (!p2con && gameMode===2) { p2con=true; conns[1]=c; c.pn=2; $('c2').classList.add('on'); c.send({t:'assign',p:2}); }
            else { c.close(); return; }
            checkReady();
        });
        c.on('data', d => {
            if (d.t==='move') {
                if (c.pn===1) { p1x=cl(d.x); p1y=cl(d.y); }
                else { p2x=cl(d.x); p2y=cl(d.y); }
            }
            if (d.t==='swing') {
                if (c.pn===1) tryHit(1, d.power, d.spin);
                else tryHit(2, d.power, d.spin);
            }
        });
        c.on('close', () => {
            if (c.pn===1) { p1con=false; $('c1').classList.remove('on'); }
            else { p2con=false; $('c2').classList.remove('on'); }
            if (started) { paused=true; showMsg('Desconectou!'); }
        });
    });
    hostPeer.on('error', e => console.log('Host err:', e));
}

function checkReady() {
    const ok = (gameMode===1&&p1con) || (gameMode===2&&p1con&&p2con);
    if (ok && !started) { $('wt').textContent='✓ Conectado!'; $('spn').style.display='none'; setTimeout(startGame,1000); }
    if (ok && paused) { paused=false; gameLoop(); }
}

function sendAll(d) { conns.forEach(c => { if(c&&c.open) c.send(d); }); }

// ======================== JOGO ========================
function startGame() {
    started=true; paused=false; s1=0; s2=0; updSc();
    ball.serving = 1; serveCount = 0;
    show('game-ui');
    let i=0; const seq=['3','2','1','SAQUE!'];
    (function next(){ if(i<seq.length){showMsg(seq[i],i===3?500:600);i++;setTimeout(next,i===3?600:700);}
    else{ serve(ball.serving); gameLoop(); }})();
}

function showMsg(t,d) { $('msg').textContent=t; $('msg').style.display='block'; setTimeout(()=>$('msg').style.display='none', d||700); }

let serveCount = 0;

function serve(player) {
    ball.active = true;
    ball.inPlay = false;
    ball.bounced = [false, false];
    ball.lastHit = player;
    ball.spin = 0;

    if (player === 1) {
        ball.x = TABLE_X + TABLE_W/2;
        ball.y = P1_MAX_Y - 30;
        ball.z = 15;
        ball.vx = 0; ball.vy = 0; ball.vz = 2;
    } else {
        ball.x = TABLE_X + TABLE_W/2;
        ball.y = P2_MIN_Y + 30;
        ball.z = 15;
        ball.vx = 0; ball.vy = 0; ball.vz = 2;
    }

    $('serve-info').textContent = `Saque: Jogador ${player}`;
    $('serve-info').style.display = 'block';

    // Auto-serve após 2s
    setTimeout(() => {
        if (!ball.inPlay && ball.active) {
            autoServe(player);
        }
    }, 2000);
}

function autoServe(player) {
    ball.inPlay = true;
    ball.z = 12;
    ball.vz = -0.5;
    if (player === 1) {
        ball.vy = -6 - Math.random()*2;
        ball.vx = (Math.random()-0.5)*3;
    } else {
        ball.vy = 6 + Math.random()*2;
        ball.vx = (Math.random()-0.5)*3;
    }
    ball.bounced = [false, false];
    $('serve-info').style.display = 'none';
}

function tryHit(player, power, spin) {
    if (!ball.active || !ball.inPlay) {
        if (!ball.inPlay && ball.lastHit === player) {
            autoServe(player);
            return;
        }
        return;
    }

    const px = player===1 ? getP1X() : getP2X();
    const py = player===1 ? getP1Y() : getP2Y();
    const dist = Math.sqrt((ball.x-px)**2 + (ball.y-py)**2);

    if (dist < 50 && ball.z < 25) {
        const pw = Math.min(power || 1, 2);

        // Direção baseada na posição da raquete relativa à bola
        const dx = (ball.x - px) * 0.3;

        if (player === 1) {
            ball.vy = (-5 - pw * 4) + (spin || 0) * 0.5;
            ball.vx = dx + (Math.random()-0.5)*2;
        } else {
            ball.vy = (5 + pw * 4) - (spin || 0) * 0.5;
            ball.vx = dx + (Math.random()-0.5)*2;
        }

        ball.vz = 1.5 + pw * 1.5;
        ball.spin = (spin || 0) * 0.5;
        ball.lastHit = player;
        ball.bounced = [false, false];

        const c = conns[player-1];
        if (c && c.open) c.send({t:'haptic'});
    }
}

function getP1X() { return TABLE_X + p1x * TABLE_W; }
function getP1Y() { return P1_MIN_Y + p1y * (P1_MAX_Y - P1_MIN_Y); }
function getP2X() { return TABLE_X + p2x * TABLE_W; }
function getP2Y() { return P2_MIN_Y + p2y * (P2_MAX_Y - P2_MIN_Y); }

function updSc() {
    $('sc1').textContent = s1; $('sc2').textContent = s2;
    sendAll({ t:'score', a:s1, b:s2 });
}

// ======================== AI ========================
let aiTx = .5, aiTy = .5, aiTmr = 0;

function doAI() {
    aiTmr++;
    if (aiTmr > 5) {
        aiTmr = 0;
        if (ball.active && ball.inPlay && ball.vy < 0) {
            // Bola vindo pro lado do AI
            const timeToReach = Math.abs((P2_MIN_Y + 40 - ball.y) / ball.vy);
            let predX = ball.x + ball.vx * timeToReach;
            predX = Math.max(TABLE_X, Math.min(TABLE_X + TABLE_W, predX));
            aiTx = (predX - TABLE_X) / TABLE_W + (Math.random()-0.5)*0.1;
            aiTy = 0.3 + Math.random()*0.3;
        } else {
            aiTx = 0.5 + (Math.random()-0.5)*0.2;
            aiTy = 0.5;
        }
    }

    p2x += (cl(aiTx) - p2x) * 0.08;
    p2y += (cl(aiTy) - p2y) * 0.08;

    // AI rebate
    if (ball.active && ball.inPlay && ball.vy < 0) {
        const px = getP2X(), py = getP2Y();
        const dist = Math.sqrt((ball.x-px)**2 + (ball.y-py)**2);
        if (dist < 45 && ball.z < 20 && ball.z > 0) {
            tryHit(2, 0.8 + Math.random()*0.8, (Math.random()-0.5)*2);
        }
    }
}

// ======================== GAME LOOP ========================
function gameLoop() {
    if (paused) { afId=null; return; }
    update(); render();
    afId = requestAnimationFrame(gameLoop);
}

function update() {
    if (gameMode === 1) doAI();

    if (!ball.active) return;
    if (!ball.inPlay) {
        // Bola subindo antes do saque
        ball.z += ball.vz;
        ball.vz -= GRAVITY * 0.3;
        if (ball.z < 10) { ball.z = 10; ball.vz = Math.abs(ball.vz) * 0.5; }
        if (ball.z > 30) ball.vz = -Math.abs(ball.vz) * 0.3;
        return;
    }

    // Física
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.z += ball.vz;
    ball.vz -= GRAVITY;
    ball.vx *= FRICTION;
    ball.vy *= FRICTION;
    ball.vx += ball.spin * 0.02;

    // Quique na mesa
    if (ball.z <= TABLE_Z && ball.vz < 0) {
        const onTable = ball.x >= TABLE_X && ball.x <= TABLE_X + TABLE_W &&
                        ball.y >= TABLE_Y && ball.y <= TABLE_Y + TABLE_H;

        if (onTable) {
            ball.z = TABLE_Z;
            ball.vz = Math.abs(ball.vz) * BOUNCE_DAMP;

            // Registrar quique
            if (ball.y < NET_Y) ball.bounced[1] = true; // lado P2
            else ball.bounced[0] = true; // lado P1

            // Verificar se é saque válido (precisa quicar no lado de quem sacou primeiro)
        } else {
            // Fora da mesa
            pointScored();
            return;
        }
    }

    // Bola caiu no chão fora da mesa
    if (ball.z < -10) { pointScored(); return; }

    // Colisão com rede
    if (Math.abs(ball.y - NET_Y) < 3 && ball.z < NET_HEIGHT) {
        ball.vy *= -0.3;
        ball.vz = 2;
        ball.y += ball.vy > 0 ? 5 : -5;
    }

    // Bola saiu lateralmente
    if (ball.x < TABLE_X - 40 || ball.x > TABLE_X + TABLE_W + 40) { pointScored(); return; }

    // Bola passou muito do fundo
    if (ball.y < TABLE_Y - 80 || ball.y > TABLE_Y + TABLE_H + 80) { pointScored(); return; }
}

function pointScored() {
    ball.active = false;
    let scorer;

    // Quem fez o ponto (simplificado)
    if (ball.lastHit === 1) {
        // P1 bateu por último
        const validBounce = ball.bounced[1]; // precisa ter quicado no lado do P2
        if (ball.y < TABLE_Y || (ball.y < NET_Y && validBounce)) {
            // P2 não devolveu ou saiu pelo fundo do P2
            scorer = 1;
        } else {
            scorer = 2; // P1 errou (rede, fora, etc)
        }
    } else {
        const validBounce = ball.bounced[0];
        if (ball.y > TABLE_Y + TABLE_H || (ball.y > NET_Y && validBounce)) {
            scorer = 2;
        } else {
            scorer = 1;
        }
    }

    if (scorer === 1) s1++; else s2++;
    updSc();

    serveCount++;
    if (serveCount >= 2) { serveCount = 0; ball.serving = ball.serving === 1 ? 2 : 1; }

    if (checkWin()) return;

    setTimeout(() => {
        if (started) serve(ball.serving);
    }, 1200);
}

function checkWin() {
    if (s1 >= WIN || s2 >= WIN) {
        // Deuce check
        if (Math.abs(s1 - s2) < 2 && s1 >= WIN - 1 && s2 >= WIN - 1) return false;

        paused = true;
        const w = s1 > s2 ? 'Jogador 1' : (gameMode===1?'CPU':'Jogador 2');
        sendAll({ t:'gameover', w, a:s1, b:s2 });
        showMsg(w + ' Venceu! 🏆', 2500);
        setTimeout(() => { s1=0; s2=0; updSc(); serveCount=0; ball.serving=1; paused=false; serve(1); gameLoop(); }, 3500);
        return true;
    }
    return false;
}

function cl(v) { return Math.max(0, Math.min(1, v)); }

// ======================== RENDERIZAÇÃO ========================
function render() {
    // Fundo
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, TW, TH);

    // Chão
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, TW, TH);

    // Mesa
    drawTable();

    // Sombra da bola
    if (ball.active) {
        const sz = Math.max(3, BALL_R - ball.z * 0.15);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(ball.x, ball.y + 2, sz + 2, sz * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Raquetes
    drawRacket(getP1X(), getP1Y(), '#1565c0', '#0d47a1');
    if (gameMode === 1) {
        drawRacket(getP2X(), getP2Y(), '#c62828', '#b71c1c');
    } else {
        drawRacket(getP2X(), getP2Y(), '#c62828', '#b71c1c');
    }

    // Rede
    drawNet();

    // Bola
    if (ball.active) {
        const visualY = ball.y - ball.z * 0.8;
        const visualSize = BALL_R + ball.z * 0.1;

        // Bola
        ctx.shadowColor = 'rgba(255,200,0,0.3)';
        ctx.shadowBlur = ball.z * 0.5;
        const g = ctx.createRadialGradient(ball.x - 1, visualY - 1, 0, ball.x, visualY, visualSize);
        g.addColorStop(0, '#fff');
        g.addColorStop(0.3, '#ffeb3b');
        g.addColorStop(0.7, '#ff9800');
        g.addColorStop(1, '#e65100');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ball.x, visualY, visualSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Listrinha da bola
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ball.x, visualY, visualSize * 0.7, -0.5, 0.5);
        ctx.stroke();
    }
}

function drawTable() {
    // Sombra da mesa
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(TABLE_X + 5, TABLE_Y + 5, TABLE_W, TABLE_H);

    // Mesa verde
    const tg = ctx.createLinearGradient(TABLE_X, TABLE_Y, TABLE_X, TABLE_Y + TABLE_H);
    tg.addColorStop(0, '#1b5e20');
    tg.addColorStop(0.5, '#2e7d32');
    tg.addColorStop(1, '#1b5e20');
    ctx.fillStyle = tg;
    ctx.fillRect(TABLE_X, TABLE_Y, TABLE_W, TABLE_H);

    // Borda branca
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(TABLE_X, TABLE_Y, TABLE_W, TABLE_H);

    // Linha central (horizontal)
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(TABLE_X, NET_Y);
    ctx.lineTo(TABLE_X + TABLE_W, NET_Y);
    ctx.stroke();

    // Linha central (vertical para saque)
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(TABLE_X + TABLE_W / 2, TABLE_Y);
    ctx.lineTo(TABLE_X + TABLE_W / 2, TABLE_Y + TABLE_H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Linhas de serviço
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    // Lado P2
    ctx.strokeRect(TABLE_X + TABLE_W * 0.15, TABLE_Y + 5, TABLE_W * 0.7, (TABLE_H / 2) - 10);
    // Lado P1
    ctx.strokeRect(TABLE_X + TABLE_W * 0.15, NET_Y + 5, TABLE_W * 0.7, (TABLE_H / 2) - 10);
}

function drawNet() {
    // Postes
    ctx.fillStyle = '#90a4ae';
    ctx.fillRect(TABLE_X - 8, NET_Y - 2, 8, 4);
    ctx.fillRect(TABLE_X + TABLE_W, NET_Y - 2, 8, 4);

    // Rede
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(TABLE_X - 5, NET_Y);
    ctx.lineTo(TABLE_X + TABLE_W + 5, NET_Y);
    ctx.stroke();

    // Malha da rede
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.5;
    for (let x = TABLE_X; x < TABLE_X + TABLE_W; x += 12) {
        ctx.beginPath();
        ctx.moveTo(x, NET_Y - 3);
        ctx.lineTo(x, NET_Y + 3);
        ctx.stroke();
    }

    // Sombra da rede
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(TABLE_X, NET_Y + 2, TABLE_W, 4);
}

function drawRacket(x, y, color1, color2) {
    ctx.save();
    ctx.translate(x, y);

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 3, 22, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Borracha (face)
    const rg = ctx.createRadialGradient(-3, -3, 0, 0, 0, 20);
    rg.addColorStop(0, color1);
    rg.addColorStop(1, color2);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Borda da raquete
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 18, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Grip texture
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    for (let i = -15; i < 15; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i, -15);
        ctx.lineTo(i, 15);
        ctx.stroke();
    }
    for (let i = -12; i < 12; i += 4) {
        ctx.beginPath();
        ctx.moveTo(-18, i);
        ctx.lineTo(18, i);
        ctx.stroke();
    }

    // Cabo
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(-4, 16, 8, 14);
    ctx.strokeStyle = '#4e342e';
    ctx.lineWidth = 1;
    ctx.strokeRect(-4, 16, 8, 14);

    // Grip do cabo
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    for (let i = 18; i < 28; i += 3) {
        ctx.beginPath();
        ctx.moveTo(-3, i);
        ctx.lineTo(3, i);
        ctx.stroke();
    }

    ctx.restore();
}

// ======================== RAQUETE (CELULAR) ========================
let clientPeer = null, clientConn = null, sendTmr = null;
let myX = .5, myY = .5, calibBeta = 0, calibGamma = 0, useGyro = false, myPN = 0;
let lastSwing = 0;

function connectRacket() {
    const id = $('inp').value.trim().toUpperCase();
    if (!id) { $('err').textContent = 'Digite o código!'; return; }
    $('err').textContent = '';

    if (clientPeer) clientPeer.destroy();
    clientPeer = new Peer(undefined, { debug: 0 });

    clientPeer.on('open', () => {
        clientConn = clientPeer.connect(id, { reliable: false });
        clientConn.on('open', () => { $('rst').textContent='🟢'; $('rst').style.color='#4f4'; });
        clientConn.on('data', handleRData);
        clientConn.on('close', () => { $('rst').textContent='🔴'; $('rst').style.color='#f44'; if(sendTmr)clearInterval(sendTmr); });
        clientConn.on('error', () => { $('err').textContent='Código não encontrado.'; show('racket-setup'); });
    });
    clientPeer.on('error', e => { $('err').textContent='Erro de conexão.'; });
}

function handleRData(d) {
    switch(d.t) {
        case 'assign':
            myPN = d.p;
            $('rlbl').textContent = 'Jogador ' + myPN;
            $('rlbl').style.color = myPN===1?'#2196f3':'#f44336';
            if (myPN===2) $('rface').classList.add('blue');
            if (myPN===1) { $('rface').classList.add('blue'); $('rface').classList.remove('blue'); }
            show('racket-ctrl');
            tryGyro();
            break;
        case 'score':
            $('rscr').textContent = d.a + ' × ' + d.b;
            break;
        case 'haptic':
            navigator.vibrate && navigator.vibrate(50);
            $('rp').classList.remove('fl'); void $('rp').offsetWidth; $('rp').classList.add('fl');
            break;
        case 'gameover':
            const win = (myPN===1&&d.a>d.b)||(myPN===2&&d.b>d.a);
            $('gotxt').textContent = win?'🏆 Você Venceu!':'😢 Você Perdeu';
            $('gotxt').style.color = win?'#4f4':'#f44';
            $('goscr').innerHTML = `<span style="color:#2196f3">${d.a}</span> × <span style="color:#f44336">${d.b}</span>`;
            $('gov').style.display = 'flex';
            if(win) navigator.vibrate && navigator.vibrate([80,40,80,40,200]);
            setTimeout(()=>$('gov').style.display='none', 3500);
            break;
    }
}

async function tryGyro() {
    if (typeof DeviceOrientationEvent !== 'undefined') {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try { const p = await DeviceOrientationEvent.requestPermission();
                if(p==='granted'){useGyro=true;setupGyro();$('calib').style.display='flex';return;}} catch(e){}
        } else {
            let ok=false;
            const test=e=>{if(e.beta!==null)ok=true;};
            window.addEventListener('deviceorientation',test);
            await new Promise(r=>setTimeout(r,500));
            window.removeEventListener('deviceorientation',test);
            if(ok){useGyro=true;setupGyro();$('calib').style.display='flex';return;}
        }
    }
    useGyro=false; setupTouch(); startSendR();
}

function setupGyro() {
    let lastAcc = 0;
    window.addEventListener('deviceorientation', e => {
        if(!useGyro) return;
        const beta = e.beta||0, gamma = e.gamma||0;
        // X = inclinação lateral (gamma), Y = inclinação frente/trás (beta)
        myX = cl(.5 + (gamma - calibGamma)/40*.5);
        myY = cl(.5 + (beta - calibBeta)/40*.5);
        updRP();
    });

    // Detectar swing (sacudida) via acelerômetro
    if (window.DeviceMotionEvent) {
        window.addEventListener('devicemotion', e => {
            const acc = e.accelerationIncludingGravity;
            if (!acc) return;
            const total = Math.sqrt((acc.x||0)**2 + (acc.y||0)**2 + (acc.z||0)**2);
            const now = Date.now();

            if (total > 20 && now - lastSwing > 400) {
                lastSwing = now;
                const power = Math.min((total - 15) / 20, 2);
                if (clientConn && clientConn.open) {
                    clientConn.send({ t:'swing', power, spin: (acc.x||0)*0.1 });
                }
                navigator.vibrate && navigator.vibrate(30);
            }
            lastAcc = total;
        });
    }
}

window.doCalib = function() {
    window.addEventListener('deviceorientation', function h(e) {
        calibBeta = e.beta||0; calibGamma = e.gamma||0;
        window.removeEventListener('deviceorientation',h);
    }, {once:true});
    setTimeout(()=>{ $('calib').style.display='none'; startSendR(); }, 300);
};

function setupTouch() {
    $('rf').textContent = '👆 Arraste = mover | Toque duplo = rebater';
    const h = e => {
        e.preventDefault();
        const r = $('ra').getBoundingClientRect();
        myX = cl((e.touches[0].clientX - r.left)/r.width);
        myY = cl((e.touches[0].clientY - r.top)/r.height);
        updRP();
    };
    $('ra').addEventListener('touchstart', h, {passive:false});
    $('ra').addEventListener('touchmove', h, {passive:false});

    // Double-tap = swing
    let lastTap = 0;
    $('ra').addEventListener('touchstart', e => {
        const now = Date.now();
        if (now - lastTap < 300) {
            if (clientConn && clientConn.open) {
                clientConn.send({ t:'swing', power: 1, spin: 0 });
            }
            navigator.vibrate && navigator.vibrate(30);
        }
        lastTap = now;
    });

    // Mouse
    let down=false;
    $('ra').addEventListener('mousedown',()=>down=true);
    window.addEventListener('mouseup',()=>down=false);
    $('ra').addEventListener('mousemove', e => {
        if(!down)return;
        const r=$('ra').getBoundingClientRect();
        myX=cl((e.clientX-r.left)/r.width);
        myY=cl((e.clientY-r.top)/r.height);
        updRP();
    });
    $('ra').addEventListener('dblclick', () => {
        if(clientConn&&clientConn.open) clientConn.send({t:'swing',power:1,spin:0});
    });
}

function updRP() {
    const area=$('ra'), pad=$('rp');
    if(!area||!pad) return;
    pad.style.left = (myX * 100) + '%';
    pad.style.top = (myY * (area.clientHeight - 90) + 45) + 'px';
    pad.style.transform = `translateX(-50%) rotate(${(myX-0.5)*15}deg)`;
}

function startSendR() {
    $('rf').textContent = useGyro ? '🔄 Giroscópio | Sacuda para rebater!' : '👆 Arraste + Duplo toque';
    updRP();
    sendTmr = setInterval(() => {
        if(clientConn&&clientConn.open) clientConn.send({t:'move', x:myX, y:myY});
    }, 16);
}

document.addEventListener('touchmove', e => {
    if($('racket-ctrl').style.display==='flex') e.preventDefault();
}, {passive:false});

// ======================== INIT ========================
const urlGame = new URLSearchParams(location.search).get('game');
if (urlGame) { $('inp').value = urlGame; show('racket-setup'); setTimeout(connectRacket, 400); }
else show('menu');