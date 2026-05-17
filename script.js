/* =====================================================
   🥁 BATERIA VIRTUAL — CELULAR COMO BAQUETA
   PeerJS (WebRTC) + Giroscópio + Acelerômetro
   Web Audio API para sons
   ===================================================== */

const APP = (() => {

    // ===================== DOM =====================
    const $ = id => document.getElementById(id);
    const SCREENS = ['menu', 'kit-setup', 'drum-ui', 'stick-setup', 'stick-ctrl'];

    function showScreen(id) {
        SCREENS.forEach(s => {
            $(s).style.display = 'none';
            $(s).classList.remove('active');
        });
        $(id).style.display = 'flex';
        $(id).classList.add('active');

        // Mostrar pedal apenas na tela da baqueta
        $('pedal-bar').style.display = id === 'stick-ctrl' ? 'block' : 'none';
    }

    function showOverlay(id) { $(id).style.display = 'flex'; $(id).classList.add('show'); }
    function hideOverlay(id) { $(id).style.display = 'none'; $(id).classList.remove('show'); }

    // ===================== AUDIO ENGINE =====================
    let audioCtx = null;
    const buffers = {};

    // Partes da bateria
    const DRUMS = {
        kick:    { name: 'Bumbo',    emoji: '🦶', color: '#4a4a4a', x: 0.5,  y: 0.78, rx: 65, ry: 40 },
        snare:   { name: 'Caixa',    emoji: '🥁', color: '#e0e0e0', x: 0.38, y: 0.58, rx: 40, ry: 25 },
        hihat:   { name: 'Hi-Hat',   emoji: '🎩', color: '#ffd54f', x: 0.18, y: 0.42, rx: 35, ry: 12 },
        tom1:    { name: 'Tom 1',    emoji: '🔴', color: '#e53935', x: 0.38, y: 0.38, rx: 32, ry: 20 },
        tom2:    { name: 'Tom 2',    emoji: '🟠', color: '#ff9800', x: 0.62, y: 0.38, rx: 32, ry: 20 },
        floor:   { name: 'Surdo',    emoji: '🟤', color: '#795548', x: 0.78, y: 0.55, rx: 42, ry: 28 },
        crash:   { name: 'Crash',    emoji: '💛', color: '#ffeb3b', x: 0.22, y: 0.22, rx: 42, ry: 14 },
        ride:    { name: 'Ride',     emoji: '💿', color: '#b0bec5', x: 0.78, y: 0.25, rx: 45, ry: 15 }
    };

    // IDs de zona por ordem (para seleção por inclinação)
    const ZONE_ORDER = ['hihat', 'snare', 'tom1', 'tom2', 'floor', 'crash', 'ride'];
    const ZONE_IDS = {
        hihat: 'z-hihat', snare: 'z-snare', tom1: 'z-tom1',
        tom2: 'z-tom2', floor: 'z-floor', crash: 'z-crash', ride: 'z-ride'
    };

    function initAudio() {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        generateAllSounds();
    }

    // Síntese procedural de sons de bateria
    function generateAllSounds() {
        // Vamos criar sons sintéticos realistas
    }

    function playDrum(drumId, velocity) {
        if (!audioCtx) initAudio();
        const v = Math.min(velocity || 0.8, 1.0);
        const now = audioCtx.currentTime;

        switch (drumId) {
            case 'kick': playKick(now, v); break;
            case 'snare': playSnare(now, v); break;
            case 'hihat': playHihat(now, v); break;
            case 'tom1': playTom(now, v, 200); break;
            case 'tom2': playTom(now, v, 150); break;
            case 'floor': playTom(now, v, 90); break;
            case 'crash': playCymbal(now, v, 0.8); break;
            case 'ride': playCymbal(now, v, 0.3); break;
        }
    }

    function playKick(t, v) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160 * v, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        gain.gain.setValueAtTime(v * 1.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.4);

        // Click
        const click = audioCtx.createOscillator();
        const cg = audioCtx.createGain();
        click.type = 'square';
        click.frequency.setValueAtTime(800, t);
        click.frequency.exponentialRampToValueAtTime(100, t + 0.02);
        cg.gain.setValueAtTime(v * 0.4, t);
        cg.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
        click.connect(cg);
        cg.connect(audioCtx.destination);
        click.start(t);
        click.stop(t + 0.05);
    }

    function playSnare(t, v) {
        // Tonal
        const osc = audioCtx.createOscillator();
        const g1 = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.07);
        g1.gain.setValueAtTime(v * 0.6, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(g1);
        g1.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.15);

        // Noise (esteira)
        const bufSize = audioCtx.sampleRate * 0.15;
        const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
        const noise = audioCtx.createBufferSource();
        noise.buffer = buf;

        const nf = audioCtx.createBiquadFilter();
        nf.type = 'highpass';
        nf.frequency.setValueAtTime(3000, t);

        const g2 = audioCtx.createGain();
        g2.gain.setValueAtTime(v * 0.8, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        noise.connect(nf);
        nf.connect(g2);
        g2.connect(audioCtx.destination);
        noise.start(t);
        noise.stop(t + 0.15);
    }

    function playHihat(t, v) {
        const bufSize = audioCtx.sampleRate * 0.08;
        const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);

        const noise = audioCtx.createBufferSource();
        noise.buffer = buf;

        const hp = audioCtx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(7000, t);

        const bp = audioCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(10000, t);
        bp.Q.setValueAtTime(1.5, t);

        const g = audioCtx.createGain();
        g.gain.setValueAtTime(v * 0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

        noise.connect(hp);
        hp.connect(bp);
        bp.connect(g);
        g.connect(audioCtx.destination);
        noise.start(t);
        noise.stop(t + 0.08);
    }

    function playTom(t, v, freq) {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 1.3, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.2);
        g.gain.setValueAtTime(v * 0.9, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(g);
        g.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.35);

        // Attack click
        const cl = audioCtx.createOscillator();
        const cg = audioCtx.createGain();
        cl.type = 'square';
        cl.frequency.setValueAtTime(freq * 4, t);
        cg.gain.setValueAtTime(v * 0.2, t);
        cg.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
        cl.connect(cg);
        cg.connect(audioCtx.destination);
        cl.start(t);
        cl.stop(t + 0.02);
    }

    function playCymbal(t, v, sustain) {
        const dur = 0.3 + sustain * 1.5;
        const bufSize = audioCtx.sampleRate * dur;
        const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);

        const noise = audioCtx.createBufferSource();
        noise.buffer = buf;

        const bp = audioCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(5000 + sustain * 3000, t);
        bp.Q.setValueAtTime(0.8, t);

        const hp = audioCtx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(4000, t);

        const g = audioCtx.createGain();
        g.gain.setValueAtTime(v * 0.6, t);
        g.gain.exponentialRampToValueAtTime(v * 0.2, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);

        noise.connect(bp);
        bp.connect(hp);
        hp.connect(g);
        g.connect(audioCtx.destination);
        noise.start(t);
        noise.stop(t + dur);

        // Ping tonal
        const osc = audioCtx.createOscillator();
        const og = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800 + sustain * 2000, t);
        og.gain.setValueAtTime(v * 0.08, t);
        og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(og);
        og.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
    }

    // ===================== CANVAS DA BATERIA =====================
    const canvas = $('dc');
    const ctx = canvas.getContext('2d');
    let CW = 800, CH = 600;
    let hitAnimations = {};  // { drumId: { time, velocity } }
    let comboCount = 0;
    let lastHitTime = 0;

    function resizeCanvas() {
        const maxW = Math.min(900, window.innerWidth - 20);
        const maxH = window.innerHeight - 30;
        const ratio = 4 / 3;
        let w = maxW, h = w / ratio;
        if (h > maxH) { h = maxH; w = h * ratio; }
        CW = canvas.width = Math.floor(w);
        CH = canvas.height = Math.floor(h);
    }

    function renderDrumKit() {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, CW, CH);

        // Fundo do palco
        const sg = ctx.createRadialGradient(CW / 2, CH * 0.4, 50, CW / 2, CH * 0.4, CW * 0.7);
        sg.addColorStop(0, '#1a1a2e');
        sg.addColorStop(1, '#0a0a0a');
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, CW, CH);

        // Chão
        ctx.fillStyle = 'rgba(255,255,255,.02)';
        ctx.fillRect(0, CH * 0.7, CW, CH * 0.3);

        // Desenhar cada peça
        const order = ['kick', 'floor', 'snare', 'tom1', 'tom2', 'crash', 'ride', 'hihat'];
        order.forEach(id => drawDrumPiece(id));

        // Combo
        const now = Date.now();
        if (now - lastHitTime > 2000) comboCount = 0;
        const combo = $('combo-display');
        if (combo) {
            combo.textContent = comboCount > 2 ? `🔥 ${comboCount}x COMBO` : '';
        }

        requestAnimationFrame(renderDrumKit);
    }

    function drawDrumPiece(id) {
        const d = DRUMS[id];
        const cx = d.x * CW;
        const cy = d.y * CH;
        const rx = d.rx * (CW / 800);
        const ry = d.ry * (CH / 600);

        const now = Date.now();
        const anim = hitAnimations[id];
        let scale = 1;
        let glow = 0;

        if (anim) {
            const elapsed = now - anim.time;
            if (elapsed < 300) {
                const t = elapsed / 300;
                scale = 1 + (1 - t) * 0.12 * anim.velocity;
                glow = (1 - t) * anim.velocity;
            } else {
                delete hitAnimations[id];
            }
        }

        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);

        if (id === 'kick') {
            // Bumbo — cilindro de frente
            // Corpo
            ctx.fillStyle = '#2a2a2a';
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry * 1.2, 0, 0, Math.PI * 2);
            ctx.fill();

            // Pele
            const kg = ctx.createRadialGradient(-rx * 0.2, -ry * 0.2, 0, 0, 0, rx * 0.8);
            kg.addColorStop(0, '#f5f5f5');
            kg.addColorStop(1, '#bdbdbd');
            ctx.fillStyle = kg;
            ctx.beginPath();
            ctx.ellipse(0, 0, rx * 0.85, ry * 1, 0, 0, Math.PI * 2);
            ctx.fill();

            // Logo
            ctx.fillStyle = 'rgba(0,0,0,.15)';
            ctx.font = `bold ${rx * 0.4}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('DRUM', 0, 0);

            // Aro
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry * 1.2, 0, 0, Math.PI * 2);
            ctx.stroke();

        } else if (id === 'hihat' || id === 'crash' || id === 'ride') {
            // Pratos
            const cg = ctx.createRadialGradient(-rx * 0.2, -ry * 0.5, 0, 0, 0, rx);
            cg.addColorStop(0, d.color);
            cg.addColorStop(0.7, d.color);
            cg.addColorStop(1, 'rgba(0,0,0,.3)');
            ctx.fillStyle = cg;
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();

            // Brilho
            ctx.strokeStyle = 'rgba(255,255,255,.15)';
            ctx.lineWidth = 1;
            for (let r = rx * 0.3; r < rx; r += rx * 0.15) {
                ctx.beginPath();
                ctx.ellipse(0, 0, r, r * (ry / rx), 0, 0, Math.PI * 2);
                ctx.stroke();
            }

            // Centro (bell)
            ctx.fillStyle = 'rgba(255,255,255,.2)';
            ctx.beginPath();
            ctx.ellipse(0, 0, rx * 0.15, ry * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();

            // Haste
            if (id === 'hihat') {
                ctx.fillStyle = '#666';
                ctx.fillRect(-2, ry, 4, CH * 0.3);
            }

        } else {
            // Toms / Snare / Floor
            // Corpo (lateral)
            ctx.fillStyle = id === 'snare' ? '#888' : d.color;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.ellipse(0, ry * 0.4, rx, ry * 0.5, 0, 0, Math.PI);
            ctx.fill();
            ctx.globalAlpha = 1;

            // Pele
            const tg = ctx.createRadialGradient(-rx * 0.15, -ry * 0.2, 0, 0, 0, rx * 0.9);
            tg.addColorStop(0, '#fafafa');
            tg.addColorStop(0.8, '#e0e0e0');
            tg.addColorStop(1, '#bbb');
            ctx.fillStyle = tg;
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();

            // Aro
            ctx.strokeStyle = id === 'snare' ? '#aaa' : d.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();

            // Cor do casco
            ctx.strokeStyle = d.color;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.ellipse(0, ry * 0.15, rx + 1, ry * 0.6, 0, 0.1, Math.PI - 0.1);
            ctx.stroke();
        }

        // Glow no hit
        if (glow > 0) {
            ctx.globalAlpha = glow * 0.6;
            ctx.shadowColor = d.color;
            ctx.shadowBlur = 40 * glow;
            ctx.fillStyle = d.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, rx * 1.2, ry * 1.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    function triggerHitVisual(drumId, velocity) {
        hitAnimations[drumId] = { time: Date.now(), velocity: velocity || 1 };

        const now = Date.now();
        if (now - lastHitTime < 600) comboCount++;
        else comboCount = 1;
        lastHitTime = now;

        // Label
        const d = DRUMS[drumId];
        if (d) {
            const label = $('hit-label');
            label.textContent = d.emoji + ' ' + d.name;
            label.classList.add('show');
            setTimeout(() => label.classList.remove('show'), 250);
        }
    }

    // ===================== REDE =====================
    let hostPeer = null;
    let conns = [null, null];
    let b1con = false, b2con = false;
    let started = false;

    let clientPeer = null;
    let clientConn = null;
    let sndTimer = null;

    function goMenu() {
        if (hostPeer) { hostPeer.destroy(); hostPeer = null; }
        if (clientPeer) { clientPeer.destroy(); clientPeer = null; }
        if (clientConn) { clientConn.close(); clientConn = null; }
        if (sndTimer) clearInterval(sndTimer);
        started = false;
        b1con = b2con = false;
        conns = [null, null];
        showScreen('menu');
    }

    function openKit() {
        showScreen('kit-setup');
        initHost();
    }

    function openStick() {
        const g = new URLSearchParams(location.search).get('game');
        if (g) {
            $('inp').value = g;
            showScreen('stick-setup');
            setTimeout(connectStick, 400);
        } else {
            showScreen('stick-setup');
        }
    }

    // ===================== HOST (BATERIA) =====================
    function initHost() {
        if (hostPeer) hostPeer.destroy();
        const id = 'DRUM-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        hostPeer = new Peer(id, { debug: 0 });

        hostPeer.on('open', gid => {
            $('gid').textContent = gid;
            const url = location.href.split('?')[0] + '?game=' + gid;
            $('lnk').href = url;
            $('lnk').textContent = url;
            try {
                new QRious({ element: $('qrc'), value: url, size: 170, background: 'white', foreground: '#0a0a0a' });
            } catch (e) {}
        });

        hostPeer.on('connection', handleHostConn);
        hostPeer.on('error', e => console.log('Host err:', e));
    }

    function handleHostConn(c) {
        c.on('open', () => {
            if (!b1con) {
                b1con = true; conns[0] = c; c.pn = 1;
                $('c1').classList.add('on');
                c.send({ t: 'assign', p: 1, hand: 'right' });
            } else if (!b2con) {
                b2con = true; conns[1] = c; c.pn = 2;
                $('c2').classList.add('on');
                c.send({ t: 'assign', p: 2, hand: 'left' });
            } else { c.close(); return; }

            if (!started) {
                started = true;
                initAudio();
                $('wt').textContent = '✓ Conectado!';
                $('spn').style.display = 'none';
                setTimeout(() => {
                    showScreen('drum-ui');
                    resizeCanvas();
                    renderDrumKit();
                }, 800);
            }
        });

        c.on('data', d => {
            if (d.t === 'hit') {
                const drumId = d.drum || 'snare';
                const vel = d.vel || 0.8;
                playDrum(drumId, vel);
                triggerHitVisual(drumId, vel);
            }
            if (d.t === 'pedal') {
                playDrum('kick', d.vel || 0.9);
                triggerHitVisual('kick', d.vel || 0.9);
            }
        });

        c.on('close', () => {
            if (c.pn === 1) { b1con = false; $('c1').classList.remove('on'); }
            else { b2con = false; $('c2').classList.remove('on'); }
        });
    }

    // ===================== BAQUETA (CELULAR) =====================
    let myX = 0.5, myY = 0.5;
    let calBeta = 0, calGamma = 0;
    let useGyro = false;
    let myPN = 0;
    let swingCD = 0;
    let currentZone = 'snare';

    function connectStick() {
        const id = $('inp').value.trim().toUpperCase();
        if (!id) { $('err').textContent = 'Digite o código!'; return; }
        $('err').textContent = '';
        showOverlay('connecting-overlay');

        if (clientPeer) clientPeer.destroy();
        clientPeer = new Peer(undefined, { debug: 0 });

        clientPeer.on('open', () => {
            clientConn = clientPeer.connect(id, { reliable: false });

            clientConn.on('open', () => {
                hideOverlay('connecting-overlay');
                $('sst').textContent = '🟢';
                $('sst').style.color = '#4f4';
            });

            clientConn.on('data', handleStickData);

            clientConn.on('close', () => {
                $('sst').textContent = '🔴';
                $('sst').style.color = '#f44';
                if (sndTimer) clearInterval(sndTimer);
            });

            clientConn.on('error', () => {
                hideOverlay('connecting-overlay');
                $('err').textContent = 'Código não encontrado!';
                showScreen('stick-setup');
            });
        });

        clientPeer.on('error', () => {
            hideOverlay('connecting-overlay');
            $('err').textContent = 'Erro de conexão.';
        });
    }

    function handleStickData(d) {
        if (d.t === 'assign') {
            myPN = d.p;
            const hand = d.hand || 'right';
            $('slbl').textContent = `Baqueta ${myPN} (${hand === 'right' ? 'Direita' : 'Esquerda'})`;
            $('slbl').style.color = '#ff9800';
            showScreen('stick-ctrl');
            initSensors();
        }
    }

    // ===================== SENSORES =====================
    async function initSensors() {
        let gyroOk = false;

        if (typeof DeviceOrientationEvent !== 'undefined') {
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                try {
                    const perm = await DeviceOrientationEvent.requestPermission();
                    if (perm === 'granted') gyroOk = true;
                } catch (e) {}
            } else {
                gyroOk = await testGyro();
            }
        }

        if (typeof DeviceMotionEvent !== 'undefined') {
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                try { await DeviceMotionEvent.requestPermission(); } catch (e) {}
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
        }
    }

    function testGyro() {
        return new Promise(resolve => {
            let found = false;
            const h = e => { if (e.beta !== null) found = true; };
            window.addEventListener('deviceorientation', h);
            setTimeout(() => {
                window.removeEventListener('deviceorientation', h);
                resolve(found);
            }, 600);
        });
    }

    function setupOrientation() {
        window.addEventListener('deviceorientation', e => {
            if (!useGyro) return;
            const beta = e.beta || 0;
            const gamma = e.gamma || 0;

            myX = clamp(0.5 + (gamma - calGamma) / 60 * 0.5);
            myY = clamp(0.5 + (beta - calBeta) / 60 * 0.5);

            // Inclinação determina a zona
            updateZoneFromTilt(gamma - calGamma);

            // Rotação visual da baqueta
            const stick = $('big-stick');
            if (stick) {
                const rx = (beta - calBeta) * 0.6;
                const ry = (gamma - calGamma) * 0.6;
                stick.style.transform =
                    `perspective(400px) rotateX(${-rx * 0.5}deg) rotateY(${ry}deg) rotateZ(${-ry * 0.3}deg)`;
            }
        });
    }

    function updateZoneFromTilt(gamma) {
        // Mapear inclinação lateral (-60 a +60) para zonas
        const normalized = (gamma + 60) / 120; // 0 a 1
        const idx = Math.floor(clamp(normalized) * ZONE_ORDER.length);
        const newZone = ZONE_ORDER[Math.min(idx, ZONE_ORDER.length - 1)];

        if (newZone !== currentZone) {
            currentZone = newZone;
            // Atualizar UI
            document.querySelectorAll('.zone-item').forEach(el => el.classList.remove('active'));
            const zEl = $(ZONE_IDS[currentZone]);
            if (zEl) zEl.classList.add('active');
            $('szone').textContent = DRUMS[currentZone].emoji + ' ' + DRUMS[currentZone].name;
        }
    }

    function setupMotion() {
        window.addEventListener('devicemotion', e => {
            const acc = e.acceleration || e.accelerationIncludingGravity;
            if (!acc) return;

            const ay = acc.y || 0;
            const az = acc.z || 0;
            const total = Math.sqrt((acc.x || 0) ** 2 + ay ** 2 + az ** 2);

            const now = Date.now();

            // Detecta batida — movimento para baixo
            // ay negativo = movimento pra baixo quando segurado na vertical
            if (total > 9 && now - swingCD > 150) {
                swingCD = now;
                const velocity = clamp((total - 7) / 25);

                if (clientConn && clientConn.open) {
                    clientConn.send({ t: 'hit', drum: currentZone, vel: velocity });
                }

                // Feedback
                if (navigator.vibrate) navigator.vibrate(15 + velocity * 25);

                const stick = $('big-stick');
                if (stick) {
                    stick.classList.remove('hit-flash');
                    void stick.offsetWidth;
                    stick.classList.add('hit-flash');
                }

                const hi = $('hit-indicator');
                if (hi) {
                    const d = DRUMS[currentZone];
                    if (velocity > 0.7) hi.textContent = '💥 ' + d.name + '!';
                    else if (velocity > 0.4) hi.textContent = d.emoji + ' ' + d.name;
                    else hi.textContent = '🤫 ' + d.name;
                    hi.classList.add('show');
                    setTimeout(() => hi.classList.remove('show'), 200);
                }
            }

            // Debug
            const db = $('stick-debug');
            if (db) db.textContent = `Acc:${total.toFixed(1)} Zone:${currentZone}`;
        });
    }

    function doCalib() {
        window.addEventListener('deviceorientation', function h(e) {
            calBeta = e.beta || 0;
            calGamma = e.gamma || 0;
            window.removeEventListener('deviceorientation', h);
        }, { once: true });
        setTimeout(() => hideOverlay('calib'), 350);
    }

    function setupTouchFallback() {
        $('stick-debug').textContent = 'Modo toque';

        // Tocar na zona diretamente
        document.querySelectorAll('.zone-item').forEach(el => {
            el.addEventListener('touchstart', e => {
                e.preventDefault();
                const zone = el.id.replace('z-', '');
                currentZone = zone;
                document.querySelectorAll('.zone-item').forEach(z => z.classList.remove('active'));
                el.classList.add('active');

                if (clientConn && clientConn.open) {
                    clientConn.send({ t: 'hit', drum: zone, vel: 0.8 });
                }
                if (navigator.vibrate) navigator.vibrate(20);

                const stick = $('big-stick');
                if (stick) {
                    stick.classList.remove('hit-flash');
                    void stick.offsetWidth;
                    stick.classList.add('hit-flash');
                }
            }, { passive: false });
        });

        // Toque na tela = bater
        const sv = $('stick-view');
        sv.addEventListener('touchstart', e => {
            e.preventDefault();
            if (clientConn && clientConn.open) {
                clientConn.send({ t: 'hit', drum: currentZone, vel: 0.8 });
            }
            if (navigator.vibrate) navigator.vibrate(20);

            const stick = $('big-stick');
            if (stick) {
                stick.classList.remove('hit-flash');
                void stick.offsetWidth;
                stick.classList.add('hit-flash');
            }
        }, { passive: false });
    }

    // Pedal
    function pedalDown() {
        $('pedal-btn').classList.add('pressed');
        if (clientConn && clientConn.open) {
            clientConn.send({ t: 'pedal', vel: 0.9 });
        }
        if (navigator.vibrate) navigator.vibrate(40);
    }

    function pedalUp() {
        $('pedal-btn').classList.remove('pressed');
    }

    function clamp(v) { return Math.max(0, Math.min(1, v)); }

    // Prevenir scroll
    document.addEventListener('touchmove', e => {
        const ctrl = $('stick-ctrl');
        if (ctrl && ctrl.classList.contains('active')) e.preventDefault();
    }, { passive: false });

    // Resize
    window.addEventListener('resize', () => { if (started) resizeCanvas(); });

    // Clique na bateria direto no PC (teste)
    canvas.addEventListener('click', e => {
        if (!started) return;
        initAudio();
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width;
        const my = (e.clientY - rect.top) / rect.height;

        // Encontrar peça clicada
        let closest = null, closestDist = Infinity;
        for (const [id, d] of Object.entries(DRUMS)) {
            const dist = Math.sqrt((mx - d.x) ** 2 + (my - d.y) ** 2);
            if (dist < 0.12 && dist < closestDist) {
                closest = id;
                closestDist = dist;
            }
        }
        if (closest) {
            playDrum(closest, 0.8);
            triggerHitVisual(closest, 0.8);
        }
    });

    // Teclado no PC
    const KEY_MAP = {
        'q': 'hihat', 'w': 'crash', 'e': 'ride',
        'a': 'snare', 's': 'tom1', 'd': 'tom2',
        'z': 'kick', 'x': 'floor', ' ': 'kick'
    };

    document.addEventListener('keydown', e => {
        if (!started) return;
        const drum = KEY_MAP[e.key.toLowerCase()];
        if (drum && !e.repeat) {
            initAudio();
            playDrum(drum, 0.85);
            triggerHitVisual(drum, 0.85);
        }
    });

    // ===================== INIT =====================
    resizeCanvas();

    const urlGame = new URLSearchParams(location.search).get('game');
    if (urlGame) {
        $('inp').value = urlGame;
        showScreen('stick-setup');
        setTimeout(connectStick, 400);
    }

    console.log('🥁 Bateria Virtual — Pronto!');

    // ===================== API PÚBLICA =====================
    return {
        goMenu,
        openKit,
        openStick,
        connectStick,
        doCalib,
        pedalDown,
        pedalUp
    };

})(); 