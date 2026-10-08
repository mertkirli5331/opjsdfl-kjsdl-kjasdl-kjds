import React, { useEffect, useRef, useState } from 'react';
import { sound } from '../../../utils/audio';
import { Play, RotateCcw, Users, Trophy, Shield, Zap, Info, Truck } from 'lucide-react';

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 580;

interface SoilParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export const ExcavatorGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Game state
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'JOB_COMPLETE'>('MENU');
  const [totalTonsMoved, setTotalTonsMoved] = useState<number>(0);
  const [targetTons, setTargetTons] = useState<number>(20);
  const [contractEarnings, setContractEarnings] = useState<number>(0);
  const [highTonsRecord, setHighTonsRecord] = useState<number>(() => {
    return parseInt(localStorage.getItem('excavator_tons_record') || '0', 10);
  });

  // Machine telemetry indicators
  const [bucketLoadPct, setBucketLoadPct] = useState<number>(0);
  const [truckBedPct, setTruckBedPct] = useState<number>(0);
  const [hydraulicPressureBar, setHydraulicPressureBar] = useState<number>(310);
  const [engineRpm, setEngineRpm] = useState<number>(1850);
  const [truckStatus, setTruckStatus] = useState<string>('Yükleme Alanında Bekliyor');
  const [workLightsOn, setWorkLightsOn] = useState<boolean>(true);

  // Simulation Refs
  // 1. HİDROMEK HMK 310 LC Kinematics & State (Exterior)
  const excavatorRef = useRef({
    x: 220,
    y: 382,
    baseAngle: 0,
    // Arm angles in radians
    boomAngle: -0.62, // main boom (tilted up)
    armAngle: 1.25,   // dipper stick
    bucketAngle: -0.45, // bucket curl
    // Bucket load 0 to 1
    bucketLoad: 0,
    // Hydraulic pump pressure bar
    pressure: 310,
  });

  // 2. Heavy Dump Truck (Co-op / Player 2)
  const truckRef = useRef({
    x: 530,
    y: 385,
    vx: 0,
    bedAngle: 0, // 0 is flat, 0.75 is fully dumped
    load: 0, // 0 to 100%
    maxLoad: 100,
    atDepot: false,
  });

  // 3. Terrain & Particles
  const terrainRef = useRef<number[]>([]);
  const particlesRef = useRef<SoilParticle[]>([]);
  const smokeRef = useRef<SmokeParticle[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Initialize terrain profile with excavation pit
  const initTerrain = () => {
    const pts: number[] = [];
    const baseGround = 412;
    for (let i = 0; i < 75; i++) {
      const x = (i / 75) * CANVAS_WIDTH;
      let h = baseGround;
      // Dig trench excavation area in front of excavator
      if (x > 110 && x < 360) {
        h = baseGround + 20 + Math.sin((x - 110) / 45) * 12;
      } else if (x >= 360) {
        h = baseGround; // level road for dump truck
      }
      pts.push(h);
    }
    terrainRef.current = pts;
  };

  const startGame = () => {
    sound.playTruckHorn();
    sound.playTurboSpool();
    initTerrain();
    excavatorRef.current = {
      x: 220,
      y: 382,
      baseAngle: 0,
      boomAngle: -0.62,
      armAngle: 1.25,
      bucketAngle: -0.45,
      bucketLoad: 0,
      pressure: 310,
    };
    truckRef.current = {
      x: 530,
      y: 385,
      vx: 0,
      bedAngle: 0,
      load: 0,
      maxLoad: 100,
      atDepot: false,
    };
    particlesRef.current = [];
    smokeRef.current = [];
    setBucketLoadPct(0);
    setTruckBedPct(0);
    setTotalTonsMoved(0);
    setContractEarnings(0);
    setHydraulicPressureBar(310);
    setTruckStatus('Yükleme Alanında Bekliyor');

    setGameState('PLAYING');
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (e.key === 'l' || e.key === 'L') {
        // Toggle LED worklights
        setWorkLightsOn(prev => !prev);
        sound.playClick();
      } else if (e.key === 'h' || e.key === 'H') {
        sound.playTruckHorn();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Compute forward kinematics of HMK 310 LC boom & dipper
  const getKinematics = (ex: typeof excavatorRef.current) => {
    // Boom mounting pivot on HMK 310 superstructure
    const p0 = { x: ex.x + 38, y: ex.y - 30 };

    // Heavy HMK 310 Boom length = 122
    const boomLen = 122;
    const p1 = {
      x: p0.x + Math.cos(ex.boomAngle) * boomLen,
      y: p0.y + Math.sin(ex.boomAngle) * boomLen,
    };

    // Dipper Arm length = 96
    const armLen = 96;
    const armAbsAngle = ex.boomAngle + ex.armAngle;
    const p2 = {
      x: p1.x + Math.cos(armAbsAngle) * armLen,
      y: p1.y + Math.sin(armAbsAngle) * armLen,
    };

    // Heavy Rock Bucket length = 48
    const bucketLen = 48;
    const bucketAbsAngle = armAbsAngle + ex.bucketAngle;
    const p3 = {
      x: p2.x + Math.cos(bucketAbsAngle) * bucketLen,
      y: p2.y + Math.sin(bucketAbsAngle) * bucketLen,
    };

    return { p0, p1, p2, p3, armAbsAngle, bucketAbsAngle };
  };

  // Main Simulation Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min(0.08, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      if (gameState === 'PLAYING') {
        const ex = excavatorRef.current;
        const tr = truckRef.current;
        const keys = keysRef.current;

        // Exhaust smoke puffs from HMK 310 diesel stack
        if (Math.random() < 0.3) {
          smokeRef.current.push({
            x: ex.x - 34,
            y: ex.y - 64,
            vx: -20 + (Math.random() - 0.5) * 12,
            vy: -48 - Math.random() * 22,
            radius: 4 + Math.random() * 5,
            alpha: 0.7,
            life: 0,
            maxLife: 0.8,
          });
        }

        let movedHydraulics = false;
        let loadResistance = false;

        // --- PLAYER 1 (HİDROMEK HMK 310 LC EXTERIOR CONTROLS) ---
        // 1. Boom Up / Down (W / S)
        if (keys['w'] || keys['W'] || keys['ArrowUp']) {
          ex.boomAngle = Math.max(-1.25, ex.boomAngle - 0.85 * dt);
          movedHydraulics = true;
        }
        if (keys['s'] || keys['S'] || keys['ArrowDown']) {
          ex.boomAngle = Math.min(-0.12, ex.boomAngle + 0.85 * dt);
          movedHydraulics = true;
        }

        // 2. Dipper Arm In / Out (A / D)
        if (keys['a'] || keys['A'] || keys['ArrowLeft']) {
          ex.armAngle = Math.max(0.35, ex.armAngle - 0.95 * dt);
          movedHydraulics = true;
        }
        if (keys['d'] || keys['D'] || keys['ArrowRight']) {
          ex.armAngle = Math.min(2.15, ex.armAngle + 0.95 * dt);
          movedHydraulics = true;
        }

        // 3. Bucket Curl (Dig) / Dump (Q / E)
        if (keys['q'] || keys['Q']) {
          ex.bucketAngle = Math.max(-1.45, ex.bucketAngle - 1.35 * dt); // curl in (dig)
          movedHydraulics = true;
        }
        if (keys['e'] || keys['E']) {
          ex.bucketAngle = Math.min(1.25, ex.bucketAngle + 1.35 * dt); // dump out
          movedHydraulics = true;
        }

        // 4. Track Travel Drive (Z / C)
        if (keys['z'] || keys['Z']) {
          ex.x = Math.max(130, ex.x - 48 * dt);
        }
        if (keys['c'] || keys['C']) {
          ex.x = Math.min(340, ex.x + 48 * dt);
        }

        // --- PLAYER 2 (CO-OP HEAVY DUMP TRUCK: J / K / U / O / H) ---
        // Drive Left / Right (J / K)
        if (keys['j'] || keys['J']) {
          tr.x = Math.max(380, tr.x - 75 * dt);
          if (tr.atDepot) {
            tr.atDepot = false;
            setTruckStatus('Yükleme Alanına Dönüyor');
          }
        }
        if (keys['k'] || keys['K']) {
          tr.x = Math.min(CANVAS_WIDTH - 85, tr.x + 75 * dt);
          // Check if at depot (far right hopper)
          if (tr.x >= CANVAS_WIDTH - 125 && tr.load > 0) {
            tr.atDepot = true;
            setTruckStatus('Şantiye Deposuna Ulaştı (Damperi Kaldır: U)');
          }
        }

        // Dump Bed Lift / Lower (U / O)
        if (keys['u'] || keys['U']) {
          tr.bedAngle = Math.min(0.75, tr.bedAngle + 1.25 * dt);
          if (tr.bedAngle > 0.38 && tr.load > 0) {
            // Dumping gravel into silo
            tr.load = Math.max(0, tr.load - 65 * dt);
            setTruckBedPct(Math.round(tr.load));
            sound.playDirtDump();

            // Falling rock particles
            for (let d = 0; d < 4; d++) {
              particlesRef.current.push({
                x: tr.x - 48,
                y: tr.y - 18,
                vx: -35 + (Math.random() - 0.5) * 40,
                vy: 55 + Math.random() * 60,
                radius: 2 + Math.random() * 3,
                color: '#78350F',
                life: 0,
                maxLife: 0.5,
              });
            }

            if (tr.load === 0) {
              const delivered = 5;
              setTotalTonsMoved(prev => {
                const updated = prev + delivered;
                if (updated > highTonsRecord) {
                  setHighTonsRecord(updated);
                  localStorage.setItem('excavator_tons_record', updated.toString());
                }
                if (updated >= targetTons) {
                  setGameState('JOB_COMPLETE');
                }
                return updated;
              });
              setContractEarnings(c => c + 1500);
              setTruckStatus('Yük Boşaltıldı! Yeni Yük İçin Yanaş (J)');
            }
          }
        }
        if (keys['o'] || keys['O']) {
          tr.bedAngle = Math.max(0, tr.bedAngle - 1.25 * dt);
        }

        // Kinematics calculations for digging
        const kin = getKinematics(ex);
        const tipX = kin.p3.x;
        const tipY = kin.p3.y;

        // Terrain Interaction & Real-Time Soil Displacement
        const terrain = terrainRef.current;
        const segIdx = Math.floor((tipX / CANVAS_WIDTH) * terrain.length);

        if (segIdx >= 0 && segIdx < terrain.length) {
          const groundY = terrain[segIdx];

          // Bucket teeth contacting ground
          if (tipY >= groundY - 4) {
            loadResistance = true;
            if (ex.bucketAngle < 0 && ex.bucketLoad < 1) {
              // Real-time soil displacement! Trench carves out
              terrain[segIdx] = Math.min(485, groundY + 14 * dt);
              if (segIdx > 0) terrain[segIdx - 1] = Math.min(485, terrain[segIdx - 1] + 7 * dt);
              if (segIdx < terrain.length - 1) terrain[segIdx + 1] = Math.min(485, terrain[segIdx + 1] + 7 * dt);

              ex.bucketLoad = Math.min(1, ex.bucketLoad + 0.38 * dt);
              setBucketLoadPct(Math.round(ex.bucketLoad * 100));

              if (Math.random() < 0.28) {
                sound.playDigCrunch();
              }

              // Debris & rock chunks
              for (let p = 0; p < 3; p++) {
                particlesRef.current.push({
                  x: tipX + (Math.random() - 0.5) * 14,
                  y: tipY,
                  vx: (Math.random() - 0.5) * 55,
                  vy: -45 - Math.random() * 45,
                  radius: 2 + Math.random() * 3,
                  color: ['#78350F', '#92400E', '#B45309'][Math.floor(Math.random() * 3)],
                  life: 0,
                  maxLife: 0.42,
                });
              }
            }
          }
        }

        // Hydraulic sound & pressure gauge response
        if (movedHydraulics) {
          if (Math.random() < 0.12) sound.playHydraulicHiss();
          const targetPressure = loadResistance ? 365 : 325;
          ex.pressure += (targetPressure - ex.pressure) * 0.1;
        } else {
          ex.pressure += (280 - ex.pressure) * 0.05;
        }
        setHydraulicPressureBar(Math.round(ex.pressure));

        // Dumping from bucket into truck bed
        if (ex.bucketLoad > 0 && ex.bucketAngle > 0.42) {
          ex.bucketLoad = Math.max(0, ex.bucketLoad - 0.48 * dt);
          setBucketLoadPct(Math.round(ex.bucketLoad * 100));

          // Drop soil particles from bucket
          for (let sp = 0; sp < 3; sp++) {
            particlesRef.current.push({
              x: tipX + (Math.random() - 0.5) * 12,
              y: tipY + 6,
              vx: (Math.random() - 0.5) * 22,
              vy: 75 + Math.random() * 65,
              radius: 2 + Math.random() * 3,
              color: '#92400E',
              life: 0,
              maxLife: 0.5,
            });
          }

          // Check if over truck bed
          const overTruckBed = tipX >= tr.x - 58 && tipX <= tr.x + 45 && tipY < tr.y;
          if (overTruckBed && tr.load < tr.maxLoad) {
            tr.load = Math.min(tr.maxLoad, tr.load + 38 * dt);
            setTruckBedPct(Math.round(tr.load));
            sound.playDirtDump();

            if (tr.load >= tr.maxLoad) {
              setTruckStatus('Kamyon Doldu (%100)! Depoya Taşı (K)');
            } else {
              setTruckStatus(`Yükleniyor: %${Math.round(tr.load)}`);
            }
          }
        }
      }

      // Update Particles
      for (let p = particlesRef.current.length - 1; p >= 0; p--) {
        const pt = particlesRef.current[p];
        pt.life += dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (pt.life >= pt.maxLife) {
          particlesRef.current.splice(p, 1);
        }
      }

      // Update Smoke
      for (let s = smokeRef.current.length - 1; s >= 0; s--) {
        const sm = smokeRef.current[s];
        sm.life += dt;
        sm.x += sm.vx * dt;
        sm.y += sm.vy * dt;
        sm.alpha = Math.max(0, 0.65 * (1 - sm.life / sm.maxLife));
        if (sm.life >= sm.maxLife) {
          smokeRef.current.splice(s, 1);
        }
      }

      // RENDER EXTERIOR HİDROMEK 310 LC SCENE
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderExteriorHidromek(ctx);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, highTonsRecord, targetTons, workLightsOn]);

  // ==============================================================
  // ULTRA-REALISTIC EXTERIOR HİDROMEK HMK 310 LC MACHINE RENDERER
  // ==============================================================
  const renderExteriorHidromek = (ctx: CanvasRenderingContext2D) => {
    const ex = excavatorRef.current;
    const tr = truckRef.current;
    const kin = getKinematics(ex);

    // 1. Sky & Sunlit Construction Environment
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 360);
    skyGrad.addColorStop(0, '#0284C7'); // sharp clear blue
    skyGrad.addColorStop(0.7, '#7DD3FC');
    skyGrad.addColorStop(1, '#FED7AA'); // dusty warm horizon
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Distant Quarry Silos & Mountain Ridge
    ctx.fillStyle = '#64748B';
    ctx.beginPath();
    ctx.moveTo(0, 320);
    ctx.lineTo(80, 290);
    ctx.lineTo(160, 305);
    ctx.lineTo(260, 275);
    ctx.lineTo(380, 300);
    ctx.lineTo(490, 280);
    ctx.lineTo(CANVAS_WIDTH, 295);
    ctx.lineTo(CANVAS_WIDTH, 420);
    ctx.lineTo(0, 420);
    ctx.fill();

    // Quarry Depot Hopper / Unloading Station on the Right
    ctx.fillStyle = '#475569';
    ctx.fillRect(CANVAS_WIDTH - 110, 260, 95, 140);
    // Industrial safety stripes
    ctx.fillStyle = '#EAB308';
    ctx.fillRect(CANVAS_WIDTH - 110, 260, 95, 12);
    ctx.fillStyle = '#0F172A';
    for (let hx = CANVAS_WIDTH - 110; hx < CANVAS_WIDTH - 15; hx += 16) {
      ctx.beginPath();
      ctx.moveTo(hx, 260);
      ctx.lineTo(hx + 8, 272);
      ctx.lineTo(hx + 14, 272);
      ctx.lineTo(hx + 6, 260);
      ctx.fill();
    }
    // Depot Header
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ŞANTİYE SİLOSU (DEPODUR)', CANVAS_WIDTH - 62, 300);
    ctx.fillText('↓ TONAJ DÖKÜM ALANI ↓', CANVAS_WIDTH - 62, 320);

    // 2. Deformable Ground & Trench Strata
    const terrain = terrainRef.current;
    if (terrain.length > 0) {
      const soilGrad = ctx.createLinearGradient(0, 380, 0, CANVAS_HEIGHT);
      soilGrad.addColorStop(0, '#B45309'); // topsoil
      soilGrad.addColorStop(0.3, '#78350F'); // clay
      soilGrad.addColorStop(1, '#451A03'); // bedrock
      ctx.fillStyle = soilGrad;

      ctx.beginPath();
      ctx.moveTo(0, CANVAS_HEIGHT);
      ctx.lineTo(0, terrain[0]);
      for (let i = 0; i < terrain.length; i++) {
        const x = (i / (terrain.length - 1)) * CANVAS_WIDTH;
        ctx.lineTo(x, terrain[i]);
      }
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.closePath();
      ctx.fill();

      // Topsoil gravel ridge line
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < terrain.length; i++) {
        const x = (i / (terrain.length - 1)) * CANVAS_WIDTH;
        if (i === 0) ctx.moveTo(x, terrain[i]);
        else ctx.lineTo(x, terrain[i]);
      }
      ctx.stroke();
    }

    // 3. LED Worklight Cone (if active)
    if (workLightsOn) {
      ctx.save();
      const lightGrad = ctx.createRadialGradient(
        kin.p0.x + 20, kin.p0.y, 10,
        kin.p3.x, kin.p3.y + 30, 160
      );
      lightGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
      lightGrad.addColorStop(0.7, 'rgba(254, 240, 138, 0.12)');
      lightGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = lightGrad;
      ctx.beginPath();
      ctx.moveTo(kin.p0.x + 10, kin.p0.y - 10);
      ctx.lineTo(kin.p3.x - 70, kin.p3.y + 60);
      ctx.lineTo(kin.p3.x + 90, kin.p3.y + 60);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 4. Exhaust Diesel Smoke
    smokeRef.current.forEach(sm => {
      ctx.save();
      ctx.fillStyle = `rgba(100, 116, 139, ${sm.alpha})`;
      ctx.beginPath();
      ctx.arc(sm.x, sm.y, sm.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 5. Co-op Heavy Dump Truck (Oyuncu 2)
    ctx.save();
    ctx.translate(tr.x, tr.y);
    // Wheels
    ctx.fillStyle = '#0F172A';
    [-42, -18, 25, 48].forEach(wx => {
      ctx.beginPath();
      ctx.arc(wx, 15, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#EAB308';
      ctx.beginPath();
      ctx.arc(wx, 15, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
    });

    // Truck chassis
    ctx.fillStyle = '#334155';
    ctx.fillRect(-52, 0, 108, 8);

    // Cabin
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(20, -38, 38, 38);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(35, -34, 18, 16);
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(56, -14, 4, 8);

    // Tilting Dump Bed
    ctx.save();
    ctx.translate(-44, -2);
    ctx.rotate(-tr.bedAngle);
    ctx.fillStyle = '#D97706';
    ctx.fillRect(0, -34, 66, 34);
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, -34, 66, 34);

    if (tr.load > 0) {
      const loadH = (tr.load / tr.maxLoad) * 26;
      ctx.fillStyle = '#78350F';
      ctx.fillRect(4, -8 - loadH, 58, loadH);
    }
    ctx.restore();
    ctx.restore();

    // 6. HİDROMEK HMK 310 LC - ULTRA-REALISTIC EXTERIOR MACHINERY
    ctx.save();
    // Heavy Steel Caterpillar Tracks with Tensioners
    const trackW = 104;
    const trackH = 26;
    ctx.fillStyle = '#0F172A'; // Carbon dark steel
    ctx.beginPath();
    ctx.roundRect(ex.x - trackW / 2, ex.y - 4, trackW, trackH, 12);
    ctx.fill();

    // Track rollers & drive sprockets
    ctx.fillStyle = '#334155';
    for (let r = ex.x - 38; r <= ex.x + 38; r += 20) {
      ctx.beginPath();
      ctx.arc(r, ex.y + 9, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    // Track shoe plates lines
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    for (let tp = ex.x - 48; tp <= ex.x + 48; tp += 8) {
      ctx.beginPath();
      ctx.moveTo(tp, ex.y - 4); ctx.lineTo(tp, ex.y - 1);
      ctx.moveTo(tp, ex.y + 19); ctx.lineTo(tp, ex.y + 22);
      ctx.stroke();
    }

    // Pure White Superstructure (Signature Hidromek HMK 310 LC)
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.roundRect(ex.x - 48, ex.y - 46, 96, 42, 6);
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Black Carbon Lower Sill / Accent
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(ex.x - 48, ex.y - 10, 96, 6);

    // Heavy Cast Anthracite Counterweight (Left Rear)
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(ex.x - 50, ex.y - 42, 26, 38);

    // Official Red HİDROMEK Logotype on Counterweight
    ctx.fillStyle = '#DC2626';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HİDROMEK', ex.x - 37, ex.y - 22);

    // Chrome "HMK 310 LC" emblem on side panel
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('HMK 310 LC', ex.x + 12, ex.y - 8);

    // Diesel Exhaust Stack
    ctx.fillStyle = '#334155';
    ctx.fillRect(ex.x - 34, ex.y - 60, 5, 18);

    // Tinted Operator Glass Cabin (Right Side)
    ctx.fillStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.fillRect(ex.x - 4, ex.y - 42, 30, 30);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.strokeRect(ex.x - 4, ex.y - 42, 30, 30);

    // Operator Silhouette inside cab
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(ex.x + 10, ex.y - 28, 6, 0, Math.PI * 2);
    ctx.fill();

    // Cabin ROPS Steel Roof Guard & LED Headlight
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(ex.x - 6, ex.y - 46, 34, 4);
    // Worklight
    ctx.fillStyle = workLightsOn ? '#FEF08A' : '#64748B';
    ctx.fillRect(ex.x + 22, ex.y - 44, 4, 6);

    // 7. ARTICULATED HİDROMEK HMK 310 LC HYDRAULIC BOOM & ARM

    // A) Heavy Duty Pure White Mono-Boom (P0 -> P1)
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(kin.p0.x, kin.p0.y);
    ctx.lineTo(kin.p1.x, kin.p1.y);
    ctx.stroke();

    // Black Carbon Stripe along the boom
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(kin.p0.x + 6, kin.p0.y + 2);
    ctx.lineTo(kin.p1.x - 6, kin.p1.y - 2);
    ctx.stroke();

    // Red "HİDROMEK" Branding on Boom
    ctx.fillStyle = '#DC2626';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    const midBoomX = (kin.p0.x + kin.p1.x) / 2;
    const midBoomY = (kin.p0.y + kin.p1.y) / 2;
    ctx.save();
    ctx.translate(midBoomX, midBoomY);
    ctx.rotate(ex.boomAngle);
    ctx.fillText('HİDROMEK', 0, -11);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('HMK 310 LC', 0, 13);
    ctx.restore();

    // Chrome Hydraulic Lift Cylinder (Dynamic piston extension)
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(kin.p0.x - 6, kin.p0.y - 10);
    ctx.lineTo(kin.p0.x + (kin.p1.x - kin.p0.x) * 0.65, kin.p0.y + (kin.p1.y - kin.p0.y) * 0.65);
    ctx.stroke();

    // Boom pivot joint pin
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(kin.p0.x, kin.p0.y, 7, 0, Math.PI * 2);
    ctx.fill();

    // B) Heavy Dipper Arm / Stick (P1 -> P2)
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(kin.p1.x, kin.p1.y);
    ctx.lineTo(kin.p2.x, kin.p2.y);
    ctx.stroke();

    // Carbon accent on dipper
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(kin.p1.x, kin.p1.y);
    ctx.lineTo(kin.p2.x, kin.p2.y);
    ctx.stroke();

    // Elbow joint pin
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(kin.p1.x, kin.p1.y, 7, 0, Math.PI * 2);
    ctx.fill();

    // C) Heavy Hardox Steel Rock Bucket (P2 -> P3)
    ctx.save();
    ctx.translate(kin.p2.x, kin.p2.y);
    ctx.rotate(kin.bucketAbsAngle);

    ctx.fillStyle = '#1E293B'; // Heavy Hardox steel
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(38, 6);
    ctx.lineTo(48, 28); // Teeth edge
    ctx.lineTo(16, 34);
    ctx.lineTo(-6, 16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 5 Carbide Forged Esco Digging Teeth
    ctx.fillStyle = '#94A3B8';
    for (let t = 8; t <= 26; t += 6) {
      ctx.beginPath();
      ctx.moveTo(44, t);
      ctx.lineTo(52, t + 3);
      ctx.lineTo(44, t + 6);
      ctx.fill();
    }

    // Dirt & rock chunks inside bucket
    if (ex.bucketLoad > 0) {
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.arc(20, 16, 14 * ex.bucketLoad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore(); // end bucket
    ctx.restore(); // end excavator save

    // 8. Falling Soil & Stone Particles
    particlesRef.current.forEach(pt => {
      ctx.save();
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 9. Floating HİDROMEK Opera Digital Instrumentation HUD
    ctx.save();
    const hudX = 14;
    const hudY = 14;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, 185, 78, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#DC2626';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HİDROMEK OPERA', hudX + 10, hudY + 16);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('HMK 310 LC GEN SERİSİ', hudX + 10, hudY + 28);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '8px sans-serif';
    ctx.fillText('BASINÇ:', hudX + 10, hudY + 44);
    ctx.fillStyle = hydraulicPressureBar > 350 ? '#EF4444' : '#F59E0B';
    ctx.font = 'bold 10px font-mono-num, monospace';
    ctx.fillText(`${hydraulicPressureBar} BAR`, hudX + 54, hudY + 44);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '8px sans-serif';
    ctx.fillText('DEVİR:', hudX + 10, hudY + 58);
    ctx.fillStyle = '#22C55E';
    ctx.font = 'bold 10px font-mono-num, monospace';
    ctx.fillText(`${engineRpm} RPM`, hudX + 54, hudY + 58);

    // Bucket fill bar
    ctx.fillStyle = '#94A3B8';
    ctx.font = '8px sans-serif';
    ctx.fillText('KOVA:', hudX + 10, hudY + 70);
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(hudX + 54, hudY + 64, 115, 6);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(hudX + 54, hudY + 64, 115 * (bucketLoadPct / 100), 6);
    ctx.restore();
  };

  return (
    <div className="flex flex-col xl:flex-row items-center justify-center gap-6 w-full max-w-6xl mx-auto py-2">
      {/* CANVAS CONTAINER */}
      <div className="flex flex-col items-center select-none">
        {/* Top Machine Status Bar */}
        <div className="w-[720px] max-w-full bg-slate-900/90 border border-slate-800 rounded-t-xl px-4 py-2.5 flex items-center justify-between text-xs font-semibold">
          {/* Hidromek Model badge */}
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-red-950/80 border border-red-600/50 text-red-400 font-extrabold text-[11px] tracking-wide">
              HİDROMEK HMK 310 LC
            </span>
            <span className="text-slate-300 font-mono-num hidden sm:inline">
              {hydraulicPressureBar} BAR / {engineRpm} RPM
            </span>
          </div>

          {/* LED Worklights Toggle */}
          <button
            onClick={() => {
              setWorkLightsOn(prev => !prev);
              sound.playClick();
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              workLightsOn
                ? 'bg-amber-950/70 border-amber-500/50 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Projektör: {workLightsOn ? 'Açık [L]' : 'Kapalı [L]'}</span>
          </button>

          {/* Haulage Target */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Taşınan:</span>
            <span className="font-mono-num text-emerald-400 font-bold text-sm">
              {totalTonsMoved}/{targetTons} Ton
            </span>
          </div>
        </div>

        {/* Canvas Arena */}
        <div className="relative border-x border-slate-800 shadow-2xl overflow-hidden">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-[360px] sm:w-[560px] md:w-[720px] h-auto aspect-[720/580] block touch-none"
          />

          {/* Start Menu Modal */}
          {gameState === 'MENU' && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 to-slate-900 border border-red-500/40 flex items-center justify-center shadow-lg shadow-red-500/20 mb-3">
                <span className="text-3xl">🚜</span>
              </div>
              <h2 className="text-2xl font-cinzel font-bold text-red-500 mb-1 tracking-wide">
                HİDROMEK HMK 310 LC
              </h2>
              <p className="text-xs text-slate-300 max-w-md mb-4">
                Ultra-gerçekçi <strong>HİDROMEK 310 LC</strong> paletli ekskavatör simülasyonu! Dış görünümden tüm makineyi izleyin, hidrolik bom ve kovayla zemini oyup kazın, 2. oyuncu ile damperli kaya kamyonuna yükleyin.
              </p>

              <div className="flex items-center gap-2 mb-5 text-xs text-slate-300">
                <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-red-400" /> Tam Dış Görünüm & Kinematik
                </span>
                <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-400" /> 2 Oyunculu Şantiye (Kepçe + Kamyon)
                </span>
              </div>

              <button
                onClick={startGame}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-extrabold text-sm shadow-lg shadow-red-500/30 transition-transform active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                HİDROMEK 310 LC ile Başla
              </button>
            </div>
          )}

          {/* Job Complete Modal */}
          {gameState === 'JOB_COMPLETE' && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
              <span className="text-4xl mb-2">🏆🏗️</span>
              <h2 className="text-2xl font-cinzel font-bold text-emerald-400 mb-1">
                ŞANTİYE SÖZLEŞMESİ TAMAMLANDI!
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                HİDROMEK HMK 310 LC ile {targetTons} Ton kaya ve toprak başarıyla taşındı!
              </p>

              <div className="bg-slate-900 border border-slate-800 rounded-xl px-6 py-3 mb-5 flex items-center gap-6">
                <div>
                  <span className="text-[11px] text-slate-400 block">Kazanılan Ücret</span>
                  <span className="text-xl font-bold text-amber-400">${contractEarnings}</span>
                </div>
                <div className="border-l border-slate-800 pl-6">
                  <span className="text-[11px] text-slate-400 block">Toplam Taşınan</span>
                  <span className="text-xl font-bold text-white">{totalTonsMoved} Ton</span>
                </div>
              </div>

              <button
                onClick={startGame}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm shadow-lg shadow-red-500/30 transition-transform active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Yeni Şantiye Sözleşmesi
              </button>
            </div>
          )}
        </div>

        {/* BOTTOM REAL-TIME OPERATOR HUD & DUAL CONTROLS */}
        <div className="w-[720px] max-w-full bg-slate-900/95 border-x border-b border-slate-800 rounded-b-xl p-3 flex flex-col gap-2.5 shadow-xl text-xs">
          {/* Status Message */}
          <div className="flex items-center justify-between bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
            <span className="text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Şantiye Durumu: <strong className="text-slate-100">{truckStatus}</strong>
            </span>
            <span className="text-emerald-400 font-bold">
              Kazanç: ${contractEarnings}
            </span>
          </div>

          {/* Dual Controls Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
            {/* Player 1: HİDROMEK 310 LC Operator */}
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-red-500/30">
              <div className="font-bold text-red-400 mb-1 flex items-center justify-between">
                <span>🚜 Oyuncu 1: HİDROMEK 310 LC (Ekskavatör)</span>
                <span className="text-[10px] text-slate-400 font-normal">Projektör: [L]</span>
              </div>
              <div className="space-y-0.5 text-slate-300">
                <div>• <strong>W / S:</strong> Ana Bomu Kaldır / İndir</div>
                <div>• <strong>A / D:</strong> Kırıcı Kolu Aç / Çek</div>
                <div>• <strong>Q / E:</strong> Kovayı Kıvır (Kaz) / Boşalt</div>
                <div>• <strong>Z / C:</strong> Paletlerle İleri / Geri Sür</div>
              </div>
            </div>

            {/* Player 2: Co-op Dump Truck */}
            <div className="p-2.5 rounded-lg bg-slate-950/60 border border-sky-500/30">
              <div className="font-bold text-sky-400 mb-1 flex items-center justify-between">
                <span>🚚 Oyuncu 2: Damperli Kaya Kamyonu</span>
                <span className="text-[10px] text-slate-400 font-normal">Korna: [H]</span>
              </div>
              <div className="space-y-0.5 text-slate-300">
                <div>• <strong>J / K:</strong> Kamyonu İleri / Geri Sür</div>
                <div>• <strong>U / O:</strong> Damper Kasasını Kaldır / İndir</div>
                <div>• <strong>H:</strong> Şantiye Havalı Korna Çal!</div>
                <div>• <strong>Görev:</strong> HİDROMEK&apos;ten yük alıp sağdaki depoya taşı.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STRATEGY & HİDROMEK OPERA GUIDE */}
      <div className="w-full xl:w-72 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 text-xs text-slate-300">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Info className="w-4 h-4 text-red-400 shrink-0" />
          <h3 className="font-bold text-slate-100 text-sm">HİDROMEK 310 LC Kılavuzu</h3>
        </div>

        <ul className="space-y-2.5 text-slate-300">
          <li className="flex items-start gap-2">
            <span className="text-red-400 font-bold shrink-0">1.</span>
            <span><strong>Dış Görünümden Kontrol:</strong> HİDROMEK HMK 310 LC&apos;nin tüm beyaz ve siyah gövdesini, hidrolik kollarını ve paletlerini dışarıdan görerek yönetin.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-400 font-bold shrink-0">2.</span>
            <span><strong>Gerçek Zamanlı Kazma:</strong> Dişler toprağa girdiğinde &apos;Q&apos; tuşuna basarak kovayı kıvırın. Toprak oyulup kepçe dolar.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-400 font-bold shrink-0">3.</span>
            <span><strong>Kamyona Yükleme:</strong> Kolu kaldırıp sağdaki kamyonun üzerine getirin ve &apos;E&apos; ile dökün.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-red-400 font-bold shrink-0">4.</span>
            <span><strong>Taşıma & Boşaltma:</strong> 2. Oyuncu kamyonu sağdaki siloya sürüp &apos;U&apos; ile damperi kaldırır ve sözleşme parasını kazanır.</span>
          </li>
        </ul>

        <div className="border-t border-slate-800 pt-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-red-400" /> Şantiye Rekoru:</span>
            <span className="font-mono-num font-bold text-amber-400">{highTonsRecord} Ton</span>
          </div>
        </div>

        {gameState === 'PLAYING' && (
          <button
            onClick={startGame}
            className="mt-2 w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Şantiyeyi Sıfırla
          </button>
        )}
      </div>
    </div>
  );
};
