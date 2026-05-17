/* =====================================================
   🏓 TÊNIS DE MESA — CELULAR COMO RAQUETE
   PeerJS (WebRTC) + Giroscópio + Acelerômetro
   ===================================================== */

const APP = (() => {

    // ===================== DOM =====================
    const $ = id => document.getElementById(id);
    const SCREENS = ['menu', 'visor-setup', 'game-ui', 'racket-setup', 'racket-ctrl'];

    function showScreen(id) {
        SCREENS.forEach(s => {
            const el = $(s);
            el.style.display = 'none';
            el.classList.remove('active');
        });
        const target = $(id);
        target.style.display = 'flex';
        target.classList.add('active');
    }

    function showOverlay(id) {
        $(id).style.display = 'flex';
        $(id).classList.add('show');
    }

    function hideOverlay(id) {
        $(id).style.display = 'none';
        $(id).classList.remove('show');
    }

    // ===================== CONSTANTES =====================
    const WIN_SCORE = 11;
    const GRAVITY = 0.12;
    const BOUNCE_DAMP = 0.7;
    const FRICTION = 0.997;
    const NET_H = 6;

    // ===================== CANVAS =====================
    const canvas = $('gc');
    const ctx = canvas.getContext('2d');
    let CW = 500, CH = 800;

    function resizeCanvas() {
        const maxW = Math.min(600, window.innerWidth - 20);
        const maxH = window.innerHeight - 70;
        const ratio = 5 / 8;
        let w = maxW;
        let h = w / ratio;
        if (h > maxH) { h = maxH; w = h * ratio; }
        CW = canvas.width = Math.floor(w);
        CH = canvas.height = Math.floor(h);
    }

    function TM() {
        const mx = CW * 0.07;
        const my = CH * 0.06;
        const tw = CW - mx * 2;
        const th = CH - my * 2;
        return {
            mx, my, tw, th,
            netY: my + th / 2,
            cx: mx + tw / 2,
            cy: my + th / 2,
            p1MinY: my + th / 2 + 20,
            p1MaxY: my + th - 10,
            p2MinY: my + 10,
            p2MaxY: my + th / 2 - 20
        };
    }

    // ===================== ESTADO DO JOGO =====================
    let gameMode = 0;
    let hostPeer = null;
    let conns = [null, null];
    let p1x = 0.5, p1y = 0.5;
    let p2x = 0.5, p2y = 0.5;
    let p1con = false, p2con = false;
    let started = false, paused = false;
    let afId = null;
    let s1 = 0, s2 = 0;
    let serveN = 0;

    const ball = {
        x: 0, y: 0, z: 0,
        vx: 0, vy: 0, vz: 0,
        spin: 0,
        active: false,
        inPlay: false,
        bounced: [false, false],
        lastHit: 0,
        serving: 1
    };

    // Raquete (celular)
    let clientPeer = null;
    let clientConn = null;
    let sndTimer = null;
    let myX = 0.5, myY = 0.5;
    let calBeta = 0, calGamma = 0, calAlpha = 0;
    let useGyro = false;
    let myPN = 0;
    let swingCD = 0;

    // AI
    let aiTx = 0.5, aiTy = 0.5, aiC = 0;

    // ===================== HELPERS =====================
    function cl(v) { return Math.max(0, Math.min(1, v)); }

    function sendAll(d) {
        conns.forEach(c => { if (c && c.open) c.send(d); });
    }

    function showMsg(text, dur) {
        const el = $('msg');
        el.textContent = text;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, dur || 700);
    }

    // ===================== NAVEGAÇÃO =====================
    function goMenu() {
        if (hostPeer) { hostPeer.destroy(); hostPeer = null; }
        if (clientPeer) { clientPeer.destroy(); clientPeer = null; }
        if (clientConn) { clientConn.close(); clientConn = null; }
        if (sndTimer) clearInterval(sndTimer);
        if (afId) cancelAnimationFrame(afId);
        started = false;
        paused = false;
        p1con = false;
        p2con = false;
        conns = [null, null];
        showScreen('menu');
    }

    function openVisor() {
        showScreen('visor-setup');
    }

    function openRacket() {
        const g = new URLSearchParams(location.search).get('game');
        if (g) {
            $('inp').value = g;
            showScreen('racket-setup');
            setTimeout(connectRacket, 400);
        } else {
            showScreen('racket-setup');
        }
    }

    // ===================== VISOR: HOST =====================
    function pickMode(m) {
        gameMode = m;
        $('m1').classList.toggle('sel', m === 1);
        $('m2').classList.toggle('sel', m === 2);
        $('c2').classList.toggle('hidden', m === 1);
        $('n2').textContent = m === 1 ? 'CPU' : 'JOGADOR 2';
        $('cpanel').style.display = 'block';
        initHost();
    }

    function initHost() {
        if (hostPeer) hostPeer.destroy();
        const id = 'PONG-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        hostPeer = new Peer(id, { debug: 0 });

        hostPeer.on('open', gid => {
            $('gid').textContent = gid;
            const url = location.href.split('?')[0] + '?game=' + gid;
            $('lnk').href = url;
            $('lnk').textContent = url;
            try {
                new QRious({
                    element: $('qrc'),
                    value: url,
                    size: 170,
                    background: 'white',
                    foreground: '#111'
                });
            } catch (e) { console.log('QR ok'); }
        });

        hostPeer.on('connection', handleHostConn);
        hostPeer.on('error', e => console.log('Host error:', e));
    }

    function handleHostConn(c) {
        c.on('open', () => {
            if (!p1con) {
                p1con = true;
                conns[0] = c;
                c.pn = 1;
                $('c1').classList.add('on');
                c.send({ t: 'assign', p: 1 });
            } else if (!p2con && gameMode === 2) {
                p2con = true;
                conns[1] = c;
                c.pn = 2;
                $('c2').classList.add('on');
                c.send({ t: 'assign', p: 2 });
            } else {
                c.close();
                return;
            }
            checkReady();
        });

        c.on('data', d => {
            if (d.t === 'move') {
                if (c.pn === 1) { p1x = cl(d.x); p1y = cl(d.y); }
                else { p2x = cl(d.x); p2y = cl(d.y); }
            }
            if (d.t === 'swing') {
                tryHit(c.pn, d.pw || 1, d.sp || 0, d.dx || 0);
            }
        });

        c.on('close', () => {
            if (c.pn === 1) { p1con = false; $('c1').classList.remove('on'); }
            else { p2con = false; $('c2').classList.remove('on'); }
            if (started) { paused = true; showMsg('Desconectou!', 3000); }
        });
    }

    function checkReady() {
        const ok = (gameMode === 1 && p1con) || (gameMode === 2 && p1con && p2con);
        if (ok && !started) {
            $('wt').textContent = '✓ Conectado! Iniciando...';
            $('spn').style.display = 'none';
            setTimeout(startGame, 1000);
        }
        if (ok && paused) {
            paused = false;
            $('msg').style.display = 'none';
            gameLoop();
        }
    }

    // ===================== JOGO =====================
    function startGame() {
        started = true;
        paused = false;
        s1 = 0;
        s2 = 0;
        serveN = 0;
        ball.serving = 1;
        updateScore();
        resizeCanvas();
        showScreen('game-ui');

        // Countdown
        const seq = ['3', '2', '1', 'SAQUE!'];
        let i = 0;
        (function next() {
            if (i < seq.length) {
                showMsg(seq[i], i === 3 ? 500 : 550);
                i++;
                setTimeout(next, 650);
            } else {
                doServe(ball.serving);
                gameLoop();
            }
        })();
    }

    function doServe(player) {
        const T = TM();
        ball.active = true;
        ball.inPlay = false;
        ball.bounced = [false, false];
        ball.lastHit = player;
        ball.spin = 0;
        ball.vx = 0;
        ball.vy = 0;
        ball.x = T.cx;

        if (player === 1) {
            ball.y = T.p1MaxY - 25;
            ball.z = 14;
            ball.vz = 1.5;
        } else {
            ball.y = T.p2MinY + 25;
            ball.z = 14;
            ball.vz = 1.5;
        }

        $('serve-info').textContent = 'Saque: Jogador ' + player;
        $('serve-info').style.display = 'block';

        // Auto-saque após 2s se ninguém sacou
        setTimeout(() => {
            if (ball.active && !ball.inPlay) {
                autoServe(player);
            }
        }, 2200);
    }

    function autoServe(player) {
        ball.inPlay = true;
        ball.z = 10;
        ball.vz = -0.3;
        ball.bounced = [false, false];

        const speed = CH * 0.009;
        if (player === 1) {
            ball.vy = -(speed + Math.random() * CH * 0.003);
            ball.vx = (Math.random() - 0.5) * 3;
        } else {
            ball.vy = speed + Math.random() * CH * 0.003;
            ball.vx = (Math.random() - 0.5) * 3;
        }

        $('serve-info').style.display = 'none';
    }

    function tryHit(pn, power, spin, dirX) {
        if (!ball.active) return;

        // Se a bola não está em jogo e é o sacador, sacar
        if (!ball.inPlay && ball.lastHit === pn) {
            autoServe(pn);
            return;
        }
        if (!ball.inPlay) return;

        const T = TM();
        const px = pn === 1 ? T.mx + p1x * T.tw : T.mx + p2x * T.tw;
        const py = pn === 1 ? T.p1MinY + p1y * (T.p1MaxY - T.p1MinY) : T.p2MinY + p2y * (T.p2MaxY - T.p2MinY);
        const dist = Math.sqrt((ball.x - px) ** 2 + (ball.y - py) ** 2);

        // Alcance da raquete
        const reach = CH * 0.08;
        if (dist < reach && ball.z < 25) {
            power = Math.min(power, 2.5);
            const hitDirX = dirX * 1.5 + (ball.x - px) * 0.12;
            const speed = CH * 0.007 + power * CH * 0.005;

            if (pn === 1) {
                ball.vy = -speed;
                ball.vx = hitDirX;
            } else {
                ball.vy = speed;
                ball.vx = hitDirX;
            }

            ball.vz = 1 + power * 1.5;
            ball.spin = spin * 0.3;
            ball.lastHit = pn;
            ball.bounced = [false, false];

            // Feedback ao jogador
            const c = conns[pn - 1];
            if (c && c.open) c.send({ t: 'haptic' });
        }
    }

    function getPx(pn) {
        const T = TM();
        return pn === 1 ? T.mx + p1x * T.tw : T.mx + p2x * T.tw;
    }

    function getPy(pn) {
        const T = TM();
        if (pn === 1) return T.p1MinY + p1y * (T.p1MaxY - T.p1MinY);
        return T.p2MinY + p2y * (T.p2MaxY - T.p2MinY);
    }

    function updateScore() {
        $('sc1').textContent = s1;
        $('sc2').textContent = s2;
        sendAll({ t: 'score', a: s1, b: s2 });
    }

    // ===================== AI =====================
    function doAI() {
        const T = TM();
        aiC++;
        if (aiC > 6) {
            aiC = 0;
            if (ball.active && ball.inPlay && ball.vy < 0) {
                const t = Math.abs((T.p2MinY + 30 - ball.y) / (ball.vy || 0.1));
                let px = ball.x + ball.vx * t;
                px = Math.max(T.mx, Math.min(T.mx + T.tw, px));
                aiTx = (px - T.mx) / T.tw + (Math.random() - 0.5) * 0.08;
                aiTy = 0.2 + Math.random() * 0.35;
            } else {
                aiTx = 0.5 + (Math.random() - 0.5) * 0.15;
                aiTy = 0.5;
            }
        }

        p2x += (cl(aiTx) - p2x) * 0.07;
        p2y += (cl(aiTy) - p2y) * 0.07;

        // AI tenta rebater
        if (ball.active && ball.inPlay && ball.vy < 0) {
            const dist = Math.sqrt((ball.x - getPx(2)) ** 2 + (ball.y - getPy(2)) ** 2);
            if (dist < CH * 0.07 && ball.z < 20 && ball.z > 0) {
                tryHit(2, 0.6 + Math.random() * 1, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 2);
            }
        }
    }

    // ===================== GAME LOOP =====================
    function gameLoop() {
        if (paused) { afId = null; return; }
        update();
        render();
        afId = requestAnimationFrame(gameLoop);
    }

    function update() {
        if (gameMode === 1) doAI();
        if (!ball.active) return;

        const T = TM();

        // Bola subindo antes do saque
        if (!ball.inPlay) {
            ball.z += ball.vz;
            ball.vz -= GRAVITY * 0.3;
            if (ball.z < 8) { ball.z = 8; ball.vz = Math.abs(ball.vz) * 0.4; }
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
        ball.vx += ball.spin * 0.01;

        // Quique na mesa
        if (ball.z <= 0 && ball.vz < 0) {
            const onTable = ball.x >= T.mx && ball.x <= T.mx + T.tw &&
                ball.y >= T.my && ball.y <= T.my + T.th;

            if (onTable) {
                ball.z = 0;
                ball.vz = Math.abs(ball.vz) * BOUNCE_DAMP;
                if (ball.y < T.netY) ball.bounced[1] = true;
                else ball.bounced[0] = true;
            } else {
                pointDone();
                return;
            }
        }

        // Caiu do chão
        if (ball.z < -10) { pointDone(); return; }

        // Rede
        if (Math.abs(ball.y - T.netY) < 4 && ball.z < NET_H) {
            ball.vy *= -0.3;
            ball.vz = 1.5;
            ball.y += ball.vy > 0 ? 5 : -5;
        }

        // Fora dos limites
        if (ball.x < T.mx - 40 || ball.x > T.mx + T.tw + 40) { pointDone(); return; }
        if (ball.y < T.my - 80 || ball.y > T.my + T.th + 80) { pointDone(); return; }
    }

    function pointDone() {
        ball.active = false;
        let scorer;

        if (ball.lastHit === 1) {
            scorer = ball.bounced[1] ? 1 : 2;
        } else {
            scorer = ball.bounced[0] ? 2 : 1;
        }

        if (scorer === 1) s1++; else s2++;
        updateScore();

        serveN++;
        if (serveN >= 2) {
            serveN = 0;
            ball.serving = ball.serving === 1 ? 2 : 1;
        }

        if (checkWin()) return;
        setTimeout(() => { if (started) doServe(ball.serving); }, 1100);
    }

    function checkWin() {
        if (s1 >= WIN_SCORE || s2 >= WIN_SCORE) {
            if (Math.abs(s1 - s2) < 2 && s1 >= WIN_SCORE - 1 && s2 >= WIN_SCORE - 1) return false;

            paused = true;
            const winner = s1 > s2 ? 'Jogador 1' : (gameMode === 1 ? 'CPU' : 'Jogador 2');
            sendAll({ t: 'gameover', w: winner, a: s1, b: s2 });
            showMsg(winner + ' Venceu! 🏆', 3000);

            setTimeout(() => {
                s1 = 0; s2 = 0;
                updateScore();
                serveN = 0;
                ball.serving = 1;
                paused = false;
                doServe(1);
                gameLoop();
            }, 3500);
            return true;
        }
        return false;
    }

    // ===================== RENDER =====================
    function render() {
        const T = TM();

        // Fundo
        ctx.fillStyle = '#0d0d0d';
        ctx.fillRect(0, 0, CW, CH);

        // Sombra da mesa
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        fillRoundRect(T.mx + 5, T.my + 5, T.tw, T.th, 4);

        // Mesa
        const tg = ctx.createLinearGradient(T.mx, T.my, T.mx, T.my + T.th);
        tg.addColorStop(0, '#1b5e20');
        tg.addColorStop(0.5, '#2e7d32');
        tg.addColorStop(1, '#1b5e20');
        ctx.fillStyle = tg;
        fillRoundRect(T.mx, T.my, T.tw, T.th, 4);

        // Borda branca
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(T.mx, T.my, T.tw, T.th);

        // Linha do meio
        ctx.strokeStyle = 'rgba(255,255,255,.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(T.mx, T.netY);
        ctx.lineTo(T.mx + T.tw, T.netY);
        ctx.stroke();

        // Linha central (saque)
        ctx.strokeStyle = 'rgba(255,255,255,.18)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(T.cx, T.my);
        ctx.lineTo(T.cx, T.my + T.th);
        ctx.stroke();
        ctx.setLineDash([]);

        // Sombra da bola
        if (ball.active) {
            const bsz = Math.max(2, 5 - ball.z * 0.12);
            ctx.fillStyle = 'rgba(0,0,0,.3)';
            ctx.beginPath();
            ctx.ellipse(ball.x, ball.y + 1, bsz + 2, bsz * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Raquetes
        drawRacket(getPx(1), getPy(1), '#1565c0', '#0d47a1');
        drawRacket(getPx(2), getPy(2), '#c62828', '#b71c1c');

        // Rede
        drawNet(T);

        // Bola
        if (ball.active) {
            const vy = ball.y - ball.z * 0.7;
            const vs = 5 + ball.z * 0.08;

            ctx.shadowColor = 'rgba(255,150,0,.3)';
            ctx.shadowBlur = ball.z * 0.5;

            const g = ctx.createRadialGradient(ball.x - 1, vy - 1, 0, ball.x, vy, vs);
            g.addColorStop(0, '#fff');
            g.addColorStop(0.3, '#ffeb3b');
            g.addColorStop(0.7, '#ff9800');
            g.addColorStop(1, '#e65100');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(ball.x, vy, vs, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Listinha
            ctx.strokeStyle = 'rgba(255,255,255,.3)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(ball.x, vy, vs * 0.6, -0.4, 0.4);
            ctx.stroke();
        }
    }

    function drawRacket(x, y, c1, c2) {
        ctx.save();
        ctx.translate(x, y);

        // Sombra
        ctx.fillStyle = 'rgba(0,0,0,.2)';
        ctx.beginPath();
        ctx.ellipse(2, 2, 18, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Face
        const rg = ctx.createRadialGradient(-2, -2, 0, 0, 0, 16);
        rg.addColorStop(0, c1);
        rg.addColorStop(1, c2);
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Borda
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Textura
        ctx.strokeStyle = 'rgba(255,255,255,.05)';
        ctx.lineWidth = 0.4;
        for (let i = -12; i < 12; i += 3) {
            ctx.beginPath(); ctx.moveTo(i, -12); ctx.lineTo(i, 12); ctx.stroke();
        }
        for (let i = -10; i < 10; i += 3) {
            ctx.beginPath(); ctx.moveTo(-15, i); ctx.lineTo(15, i); ctx.stroke();
        }

        // Cabo
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(-3, 12, 6, 10);
        ctx.strokeStyle = '#4e342e';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(-3, 12, 6, 10);

        ctx.restore();
    }

    function drawNet(T) {
        // Postes
        ctx.fillStyle = '#90a4ae';
        ctx.fillRect(T.mx - 6, T.netY - 2, 5, 4);
        ctx.fillRect(T.mx + T.tw + 1, T.netY - 2, 5, 4);

        // Rede
        ctx.strokeStyle = 'rgba(255,255,255,.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(T.mx - 4, T.netY);
        ctx.lineTo(T.mx + T.tw + 4, T.netY);
        ctx.stroke();

        // Malha
        ctx.strokeStyle = 'rgba(255,255,255,.08)';
        ctx.lineWidth = 0.5;
        for (let x = T.mx; x < T.mx + T.tw; x += 8) {
            ctx.beginPath();
            ctx.moveTo(x, T.netY - 2);
            ctx.lineTo(x, T.netY + 2);
            ctx.stroke();
        }

        // Sombra
        ctx.fillStyle = 'rgba(0,0,0,.08)';
        ctx.fillRect(T.mx, T.netY + 2, T.tw, 3);
    }

    function fillRoundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
    }

    // ===================== RAQUETE (CELULAR) =====================
    function connectRacket() {
        const id = $('inp').value.trim().toUpperCase();
        if (!id) {
            $('err').textContent = 'Digite o código!';
            return;
        }
        $('err').textContent = '';
        showOverlay('connecting-overlay');

        if (clientPeer) clientPeer.destroy();
        clientPeer = new Peer(undefined, { debug: 0 });

        clientPeer.on('open', () => {
            clientConn = clientPeer.connect(id, { reliable: false });

            clientConn.on('open', () => {
                hideOverlay('connecting-overlay');
                $('rst').textContent = '🟢';
                $('rst').style.color = '#4f4';
            });

            clientConn.on('data', handleRacketData);

            clientConn.on('close', () => {
                $('rst').textContent = '🔴';
                $('rst').style.color = '#f44';
                if (sndTimer) clearInterval(sndTimer);
            });

            clientConn.on('error', () => {
                hideOverlay('connecting-overlay');
                $('err').textContent = 'Código não encontrado. Verifique!';
                showScreen('racket-setup');
            });
        });

        clientPeer.on('error', e => {
            hideOverlay('connecting-overlay');
            $('err').textContent = 'Erro de conexão.';
            console.log('Client err:', e);
        });
    }

    function handleRacketData(d) {
        switch (d.t) {
            case 'assign':
                myPN = d.p;
                $('rlbl').textContent = 'Jogador ' + myPN;
                $('rlbl').style.color = myPN === 1 ? '#2196f3' : '#f44336';

                const face = $('rface');
                face.classList.remove('red', 'blue');
                face.classList.add(myPN === 1 ? 'blue' : 'red');

                showScreen('racket-ctrl');
                initSensors();
                break;

            case 'score':
                $('rscr').textContent = d.a + ' × ' + d.b;
                break;

            case 'haptic':
                if (navigator.vibrate) navigator.vibrate(60);
                const rack = $('big-racket');
                rack.classList.remove('hit-flash');
                void rack.offsetWidth;
                rack.classList.add('hit-flash');
                break;

            case 'gameover':
                const win = (myPN === 1 && d.a > d.b) || (myPN === 2 && d.b > d.a);
                $('gotxt').textContent = win ? '🏆 Você Venceu!' : '😢 Você Perdeu';
                $('gotxt').style.color = win ? '#4f4' : '#f44';
                $('goscr').innerHTML =
                    `<span style="color:#2196f3">${d.a}</span> × <span style="color:#f44336">${d.b}</span>`;
                showOverlay('gov');
                if (win && navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 200]);
                setTimeout(() => hideOverlay('gov'), 3500);
                break;
        }
    }

    // ===================== SENSORES =====================
    async function initSensors() {
        let gyroOk = false;

        if (typeof DeviceOrientationEvent !== 'undefined') {
            // iOS 13+
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const perm = await DeviceOrientationEvent.requestPermission();
                    if (perm === 'granted') gyroOk = true;
                } catch (e) { console.log('Perm denied'); }
            } else {
                // Android / outros — testar se funciona
                gyroOk = await testGyro();
            }
        }

        if (gyroOk) {
            useGyro = true;
            setupOrientation();
            setupMotion();
            showOverlay('calib');
        } else {
            useGyro = false;
            setupTouchFallback();
            startSending();
        }
    }

    function testGyro() {
        return new Promise(resolve => {
            let found = false;
            const handler = e => {
                if (e.beta !== null) found = true;
            };
            window.addEventListener('deviceorientation', handler);
            setTimeout(() => {
                window.removeEventListener('deviceorientation', handler);
                resolve(found);
            }, 600);
        });
    }

    function setupOrientation() {
        window.addEventListener('deviceorientation', e => {
            if (!useGyro) return;
            const beta = e.beta || 0;
            const gamma = e.gamma || 0;

            // Posição X (lateral) e Y (frente/trás)
            myX = cl(0.5 + (gamma - calGamma) / 50 * 0.5);
            myY = cl(0.5 + (beta - calBeta) / 50 * 0.5);

            // Rotação visual da raquete
            const rx = (beta - calBeta) * 0.7;
            const ry = (gamma - calGamma) * 0.7;
            const rack = $('big-racket');
            if (rack) {
                rack.style.transform =
                    `perspective(400px) rotateX(${-rx}deg) rotateY(${ry}deg)`;
            }
        });
    }

    function setupMotion() {
        window.addEventListener('devicemotion', e => {
            const acc = e.acceleration || e.accelerationIncludingGravity;
            if (!acc) return;

            const ax = acc.x || 0;
            const ay = acc.y || 0;
            const az = acc.z || 0;
            const total = Math.sqrt(ax * ax + ay * ay + az * az);

            const now = Date.now();

            // Detecta swing
            if (total > 10 && now - swingCD > 350) {
                swingCD = now;
                const power = Math.min((total - 8) / 15, 2.5);
                const spinVal = ax * 0.12;
                const dirX = ax * 0.08;

                if (clientConn && clientConn.open) {
                    clientConn.send({ t: 'swing', pw: power, sp: spinVal, dx: dirX });
                }

                // Feedback
                if (navigator.vibrate) navigator.vibrate(20);
                const si = $('swing-indicator');
                if (si) {
                    if (power > 1.5) si.textContent = '💥 SMASH!';
                    else if (power > 0.8) si.textContent = '🏓 Rebatida!';
                    else si.textContent = '🏓 Toque';
                    si.classList.add('show');
                    setTimeout(() => si.classList.remove('show'), 400);
                }
            }

            // Debug
            const db = $('racket-debug');
            if (db) db.textContent = `Acc: ${total.toFixed(1)} | Pos: ${myX.toFixed(2)}, ${myY.toFixed(2)}`;
        });
    }

    function doCalib() {
        const handler = e => {
            calBeta = e.beta || 0;
            calGamma = e.gamma || 0;
            calAlpha = e.alpha || 0;
            window.removeEventListener('deviceorientation', handler);
        };
        window.addEventListener('deviceorientation', handler, { once: true });

        setTimeout(() => {
            hideOverlay('calib');
            startSending();
        }, 350);
    }

    function setupTouchFallback() {
        $('racket-debug').textContent = 'Modo toque: arraste + toque duplo';

        const rv = $('racket-view');
        if (!rv) return;

        const touchHandler = e => {
            e.preventDefault();
            const r = rv.getBoundingClientRect();
            myX = cl((e.touches[0].clientX - r.left) / r.width);
            myY = cl((e.touches[0].clientY - r.top) / r.height);

            // Rotação visual
            const rack = $('big-racket');
            if (rack) {
                const rx = (myY - 0.5) * 30;
                const ry = (myX - 0.5) * 30;
                rack.style.transform = `perspective(400px) rotateX(${-rx}deg) rotateY(${ry}deg)`;
            }
        };

        rv.addEventListener('touchstart', touchHandler, { passive: false });
        rv.addEventListener('touchmove', touchHandler, { passive: false });

        // Toque duplo = swing
        let lastTap = 0;
        rv.addEventListener('touchstart', () => {
            const now = Date.now();
            if (now - lastTap < 300) {
                if (clientConn && clientConn.open) {
                    clientConn.send({ t: 'swing', pw: 1, sp: 0, dx: 0 });
                }
                if (navigator.vibrate) navigator.vibrate(20);
                const si = $('swing-indicator');
                if (si) {
                    si.textContent = '🏓 Rebatida!';
                    si.classList.add('show');
                    setTimeout(() => si.classList.remove('show'), 400);
                }
            }
            lastTap = now;
        });

        // Mouse (debug desktop)
        let mouseDown = false;
        rv.addEventListener('mousedown', () => mouseDown = true);
        window.addEventListener('mouseup', () => mouseDown = false);
        rv.addEventListener('mousemove', e => {
            if (!mouseDown) return;
            const r = rv.getBoundingClientRect();
            myX = cl((e.clientX - r.left) / r.width);
            myY = cl((e.clientY - r.top) / r.height);
            const rack = $('big-racket');
            if (rack) {
                const rx = (myY - 0.5) * 30;
                const ry = (myX - 0.5) * 30;
                rack.style.transform = `perspective(400px) rotateX(${-rx}deg) rotateY(${ry}deg)`;
            }
        });
        rv.addEventListener('dblclick', () => {
            if (clientConn && clientConn.open) {
                clientConn.send({ t: 'swing', pw: 1, sp: 0, dx: 0 });
            }
        });
    }

    function startSending() {
        sndTimer = setInterval(() => {
            if (clientConn && clientConn.open) {
                clientConn.send({ t: 'move', x: myX, y: myY });
            }
        }, 16);
    }

    // Prevenir scroll no celular
    document.addEventListener('touchmove', e => {
        const ctrl = $('racket-ctrl');
        if (ctrl && ctrl.classList.contains('active')) {
            e.preventDefault();
        }
    }, { passive: false });

    // Resize
    window.addEventListener('resize', () => { if (started) resizeCanvas(); });

    // ===================== INIT =====================
    resizeCanvas();

    // Auto-connect via URL
    const urlGame = new URLSearchParams(location.search).get('game');
    if (urlGame) {
        $('inp').value = urlGame;
        showScreen('racket-setup');
        setTimeout(connectRacket, 400);
    }

    console.log('🏓 Tênis de Mesa — Pronto!');

    // ===================== API PÚBLICA =====================
    return {
        goMenu,
        openVisor,
        openRacket,
        pickMode,
        connectRacket,
        doCalib
    };

})();