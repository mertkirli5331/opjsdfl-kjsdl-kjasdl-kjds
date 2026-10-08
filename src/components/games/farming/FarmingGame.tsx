import React, { useEffect, useRef, useState, useCallback } from 'react';
import { sound } from '../../../utils/audio';
import {
  Play,
  RotateCcw,
  Volume2,
  Coins,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Tractor,
  Layers,
  Wrench,
  Sun,
  Moon,
  ChevronRight,
  CheckCircle2,
  Gauge,
  Lightbulb,
  Music,
} from 'lucide-react';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 580;

export type ImplementType = 'PLOW' | 'SEEDER' | 'HARVESTER' | 'BALER';
export type TractorSkin = 'GREEN_GOLD' | 'RED_POWER' | 'BLUE_BEAST';

interface CropTile {
  x: number;
  y: number;
  width: number;
  height: number;
  state: 'RAW' | 'TILLED' | 'SEEDED' | 'GROWING' | 'RIPE' | 'HARVESTED';
  growProgress: number; // 0 to 1
  cropType: 'WHEAT' | 'CORN';
  swayOffset: number;
}

interface HayBale {
  x: number;
  y: number;
  angle: number;
  value: number;
  type: 'ROUND' | 'SQUARE';
}

interface MudTrack {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
  isPlowed: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface FarmAnimal {
  type: 'COW' | 'CHICKEN' | 'SHEEP';
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  angle: number;
  stateTimer: number;
  isChewing: boolean;
  tailWag: number;
}

export const FarmingGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Game UI States
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'UPGRADES'>('MENU');
  const [activeImplement, setActiveImplement] = useState<ImplementType>('HARVESTER');
  const [tractorSkin, setTractorSkin] = useState<TractorSkin>('GREEN_GOLD');
  const [farmCoins, setFarmCoins] = useState<number>(250);
  const [grainTank, setGrainTank] = useState<number>(0);
  const [maxTankCapacity, setMaxTankCapacity] = useState<number>(100);
  const [engineLevel, setEngineLevel] = useState<number>(1);
  const [headerWidthLevel, setHeaderWidthLevel] = useState<number>(1);
  const [totalBalesProduced, setTotalBalesProduced] = useState<number>(0);
  const [totalHarvestedKg, setTotalHarvestedKg] = useState<number>(0);
  const [farmLevel, setFarmLevel] = useState<number>(1);
  const [highHarvestRecord, setHighHarvestRecord] = useState<number>(() => {
    return parseInt(localStorage.getItem('fs27_harvest_record') || '0', 10);
  });
  const [tractorSpeedKmh, setTractorSpeedKmh] = useState<number>(0);
  const [farmStatus, setFarmStatus] = useState<string>('FS 27: Altın Buğday Tarlası Hasada Hazır!');
  const [isDaylight, setIsDaylight] = useState<boolean>(true);
  const [nearSilo, setNearSilo] = useState<boolean>(false);
  const [contractGoalKg, setContractGoalKg] = useState<number>(150);
  const [contractReward, setContractReward] = useState<number>(300);
  const [contractCompleted, setContractCompleted] = useState<boolean>(false);

  // Simulation Refs
  const tractorRef = useRef({
    x: 320,
    y: 340,
    angle: 0,
    speed: 0,
    maxSpeed: 155,
    steerAngle: 0,
    turningRate: 2.3,
    headlightsOn: true,
    engineRunning: true,
    beaconAngle: 0,
    rpm: 800,
    isUnloading: false,
    wheelRotation: 0,
  });

  const tilesRef = useRef<CropTile[]>([]);
  const balesRef = useRef<HayBale[]>([]);
  const mudTracksRef = useRef<MudTrack[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const smokeRef = useRef<Particle[]>([]);
  const animalsRef = useRef<FarmAnimal[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const windmillAngleRef = useRef<number>(0);
  const lastTrackPosRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize Farmland Grid (6 rows x 10 cols)
  const initField = useCallback(() => {
    const tiles: CropTile[] = [];
    const startX = 60;
    const startY = 170;
    const tileW = 68;
    const tileH = 58;

    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 10; c++) {
        // High percentage of ripe golden wheat initially for instant rewarding Hay Day harvest!
        const isRipeInitially = Math.random() < 0.8;
        tiles.push({
          x: startX + c * tileW,
          y: startY + r * tileH,
          width: tileW,
          height: tileH,
          state: isRipeInitially ? 'RIPE' : 'GROWING',
          growProgress: isRipeInitially ? 1.0 : 0.4 + Math.random() * 0.4,
          cropType: (r + c) % 3 === 0 ? 'CORN' : 'WHEAT',
          swayOffset: Math.random() * Math.PI * 2,
        });
      }
    }
    tilesRef.current = tiles;

    // Initialize Cute Farm Animals (Cows in Pasture, Chickens, Sheep)
    animalsRef.current = [
      // Dairy Cows grazing
      { type: 'COW', x: 380, y: 70, baseX: 380, baseY: 70, angle: 0, stateTimer: 0, isChewing: true, tailWag: 0 },
      { type: 'COW', x: 440, y: 82, baseX: 440, baseY: 82, angle: 0.2, stateTimer: 1.5, isChewing: true, tailWag: 0.4 },
      { type: 'COW', x: 495, y: 65, baseX: 495, baseY: 65, angle: -0.1, stateTimer: 3, isChewing: true, tailWag: 0.8 },
      // Chickens pecking grain
      { type: 'CHICKEN', x: 195, y: 125, baseX: 195, baseY: 125, angle: 0, stateTimer: 0.5, isChewing: false, tailWag: 0 },
      { type: 'CHICKEN', x: 215, y: 135, baseX: 215, baseY: 135, angle: 1.2, stateTimer: 2.1, isChewing: false, tailWag: 0 },
      { type: 'CHICKEN', x: 180, y: 140, baseX: 180, baseY: 140, angle: -0.8, stateTimer: 4.0, isChewing: false, tailWag: 0 },
      // Fluffy Sheep
      { type: 'SHEEP', x: 535, y: 80, baseX: 535, baseY: 80, angle: 0.4, stateTimer: 1.2, isChewing: true, tailWag: 0 },
      { type: 'SHEEP', x: 555, y: 110, baseX: 555, baseY: 110, angle: -0.3, stateTimer: 2.8, isChewing: true, tailWag: 0 },
    ];
  }, []);

  const startGame = () => {
    sound.playTractorRev();
    initField();
    tractorRef.current = {
      x: 340,
      y: 340,
      angle: 0,
      speed: 0,
      maxSpeed: 155 + (engineLevel - 1) * 35,
      steerAngle: 0,
      turningRate: 2.3,
      headlightsOn: true,
      engineRunning: true,
      beaconAngle: 0,
      rpm: 850,
      isUnloading: false,
      wheelRotation: 0,
    };
    balesRef.current = [];
    mudTracksRef.current = [];
    particlesRef.current = [];
    smokeRef.current = [];
    setGrainTank(0);
    setTractorSpeedKmh(0);
    setTotalBalesProduced(0);
    setTotalHarvestedKg(0);
    setContractCompleted(false);
    setFarmStatus('Biçerdöver Başlığı Aktif: Tarlayı Biçin ve Siloda Satın!');
    setGameState('PLAYING');
  };

  // Unload grain at Silo
  const handleUnloadAtSilo = () => {
    if (grainTank <= 0) return;
    tractorRef.current.isUnloading = true;
    sound.playGrainPour();

    const earnings = Math.round(grainTank * 2.8);
    setFarmCoins(prev => prev + earnings);
    setTotalHarvestedKg(prev => {
      const updated = prev + grainTank;
      if (updated > highHarvestRecord) {
        setHighHarvestRecord(updated);
        localStorage.setItem('fs27_harvest_record', updated.toString());
      }
      if (updated >= contractGoalKg && !contractCompleted) {
        setContractCompleted(true);
        setFarmCoins(c => c + contractReward);
        sound.playVictory();
      }
      return updated;
    });

    // Spawn falling grain stream particles near silo chute
    for (let i = 0; i < 35; i++) {
      particlesRef.current.push({
        x: 690 + (Math.random() - 0.5) * 20,
        y: 115 + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 25,
        vy: 40 + Math.random() * 50,
        radius: 2 + Math.random() * 2,
        color: '#FACC15',
        alpha: 0.9,
        life: 0,
        maxLife: 0.6,
      });
    }

    setGrainTank(0);
    sound.playCoinsSale();
    setFarmStatus(`Silo Boşaltımı Tamamlandı! +$${earnings} Kazandınız.`);

    setTimeout(() => {
      tractorRef.current.isUnloading = false;
    }, 800);
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (e.key === '1') {
        setActiveImplement('PLOW');
        sound.playClick();
        setFarmStatus('Pulluk Takıldı: Ham veya hasat edilmiş toprağı sürün.');
      } else if (e.key === '2') {
        setActiveImplement('SEEDER');
        sound.playClick();
        setFarmStatus('Mibzer Takıldı: Sürülmüş toprağa altın tohumlar ekin.');
      } else if (e.key === '3') {
        setActiveImplement('HARVESTER');
        sound.playClick();
        setFarmStatus('Biçerdöver Başlığı Takıldı: Olgun buğdayları biçin!');
      } else if (e.key === '4') {
        setActiveImplement('BALER');
        sound.playClick();
        setFarmStatus('Balya Makinesi Takıldı: Tarlada altın saman balyaları üretin.');
      } else if (e.key === 'h' || e.key === 'H') {
        sound.playTractorHorn();
      } else if (e.key === 'l' || e.key === 'L') {
        tractorRef.current.headlightsOn = !tractorRef.current.headlightsOn;
        sound.playClick();
      } else if (e.key === 'e' || e.key === 'E') {
        if (nearSilo && grainTank > 0) {
          handleUnloadAtSilo();
        }
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
  }, [nearSilo, grainTank, highHarvestRecord, contractGoalKg, contractCompleted, contractReward]);

  // Main Farm Game Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min(0.08, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      // Spin windmill sails & beacon
      windmillAngleRef.current += dt * 0.95;
      tractorRef.current.beaconAngle += dt * 8.0;

      if (gameState === 'PLAYING') {
        const tr = tractorRef.current;
        const keys = keysRef.current;

        // --- TRACTOR DRIVING & ENGINE PHYSICS ---
        const accel = 200 + (engineLevel - 1) * 40;
        const drag = 85;
        const currentMaxSpeed = 155 + (engineLevel - 1) * 35;

        let isThrottling = false;
        if (keys['w'] || keys['W'] || keys['ArrowUp']) {
          tr.speed = Math.min(currentMaxSpeed, tr.speed + accel * dt);
          tr.rpm = Math.min(2200, tr.rpm + 1400 * dt);
          isThrottling = true;
        } else if (keys['s'] || keys['S'] || keys['ArrowDown']) {
          tr.speed = Math.max(-currentMaxSpeed * 0.55, tr.speed - accel * dt);
          tr.rpm = Math.min(1800, tr.rpm + 1100 * dt);
          isThrottling = true;
        } else {
          // Coasting
          tr.rpm = Math.max(850, tr.rpm - 1200 * dt);
          if (tr.speed > 0) tr.speed = Math.max(0, tr.speed - drag * dt);
          else if (tr.speed < 0) tr.speed = Math.min(0, tr.speed + drag * dt);
        }

        // Steering (A / D or Left / Right)
        const steerSpeed = 2.6;
        if (keys['a'] || keys['A'] || keys['ArrowLeft']) {
          tr.steerAngle = Math.max(-0.65, tr.steerAngle - steerSpeed * dt);
          if (Math.abs(tr.speed) > 4) {
            tr.angle += (tr.speed > 0 ? -1 : 1) * tr.turningRate * dt;
          }
        } else if (keys['d'] || keys['D'] || keys['ArrowRight']) {
          tr.steerAngle = Math.min(0.65, tr.steerAngle + steerSpeed * dt);
          if (Math.abs(tr.speed) > 4) {
            tr.angle += (tr.speed > 0 ? 1 : -1) * tr.turningRate * dt;
          }
        } else {
          tr.steerAngle *= 0.82;
        }

        // Wheel Rotation
        tr.wheelRotation += (tr.speed / 18) * dt;

        // Position update
        tr.x += Math.cos(tr.angle) * tr.speed * dt;
        tr.y += Math.sin(tr.angle) * tr.speed * dt;

        // Boundary constraint
        tr.x = Math.max(45, Math.min(CANVAS_WIDTH - 45, tr.x));
        tr.y = Math.max(140, Math.min(CANVAS_HEIGHT - 45, tr.y));

        setTractorSpeedKmh(Math.round(Math.abs(tr.speed) * 0.24));

        // Check proximity to Silo (Silo is around X: 670, Y: 105)
        const distToSilo = Math.hypot(tr.x - 670, tr.y - 170);
        const isCloseToSilo = distToSilo < 110;
        setNearSilo(isCloseToSilo);

        // Exhaust Smoke Puffs
        if (isThrottling && Math.random() < 0.35) {
          const exhaustX = tr.x + Math.cos(tr.angle) * 18 - Math.sin(tr.angle) * 11;
          const exhaustY = tr.y + Math.sin(tr.angle) * 18 + Math.cos(tr.angle) * 11;
          smokeRef.current.push({
            x: exhaustX,
            y: exhaustY,
            vx: -Math.cos(tr.angle) * 18 + (Math.random() - 0.5) * 8,
            vy: -35 - Math.random() * 25,
            radius: 3 + Math.random() * 3,
            color: '#94A3B8',
            alpha: 0.65,
            life: 0,
            maxLife: 0.55,
          });
        }

        // Dual Mud & Tire Tracks
        if (Math.abs(tr.speed) > 15) {
          if (!lastTrackPosRef.current || Math.hypot(tr.x - lastTrackPosRef.current.x, tr.y - lastTrackPosRef.current.y) > 14) {
            lastTrackPosRef.current = { x: tr.x, y: tr.y };
            // Left & Right tire marks
            const perpX = -Math.sin(tr.angle);
            const perpY = Math.cos(tr.angle);
            mudTracksRef.current.push({
              x1: tr.x + perpX * 14,
              y1: tr.y + perpY * 14,
              x2: tr.x - Math.cos(tr.angle) * 12 + perpX * 14,
              y2: tr.y - Math.sin(tr.angle) * 12 + perpY * 14,
              alpha: 0.35,
              isPlowed: activeImplement === 'PLOW',
            });
            mudTracksRef.current.push({
              x1: tr.x - perpX * 14,
              y1: tr.y - perpY * 14,
              x2: tr.x - Math.cos(tr.angle) * 12 - perpX * 14,
              y2: tr.y - Math.sin(tr.angle) * 12 - perpY * 14,
              alpha: 0.35,
              isPlowed: activeImplement === 'PLOW',
            });
            if (mudTracksRef.current.length > 120) {
              mudTracksRef.current.splice(0, 2);
            }
          }
        }

        // --- CROP GROWTH CYCLE ---
        tilesRef.current.forEach(tile => {
          if (tile.state === 'SEEDED' || tile.state === 'GROWING') {
            tile.growProgress += dt * 0.085;
            if (tile.growProgress >= 0.5) tile.state = 'GROWING';
            if (tile.growProgress >= 1.0) {
              tile.state = 'RIPE';
              tile.growProgress = 1.0;
            }
          }
        });

        // --- IMPLEMENT INTERACTION WITH SOIL & CROPS ---
        const toolReach = 28 + (headerWidthLevel - 1) * 8;
        const toolOffsetX = activeImplement === 'HARVESTER' ? 36 : -36;
        const toolX = tr.x + Math.cos(tr.angle) * toolOffsetX;
        const toolY = tr.y + Math.sin(tr.angle) * toolOffsetX;

        if (Math.abs(tr.speed) > 12) {
          tilesRef.current.forEach(tile => {
            const tileCenterX = tile.x + tile.width / 2;
            const tileCenterY = tile.y + tile.height / 2;
            const dist = Math.hypot(toolX - tileCenterX, toolY - tileCenterY);

            if (dist < toolReach + 18) {
              // 1. PLOWING (Sürüm)
              if (activeImplement === 'PLOW') {
                if (tile.state === 'RAW' || tile.state === 'HARVESTED') {
                  tile.state = 'TILLED';
                  tile.growProgress = 0;
                  // Soil debris particles
                  for (let p = 0; p < 2; p++) {
                    particlesRef.current.push({
                      x: toolX + (Math.random() - 0.5) * 12,
                      y: toolY + (Math.random() - 0.5) * 12,
                      vx: (Math.random() - 0.5) * 30,
                      vy: -20 - Math.random() * 20,
                      radius: 2 + Math.random() * 2,
                      color: '#451A03',
                      alpha: 0.8,
                      life: 0,
                      maxLife: 0.4,
                    });
                  }
                }
              }
              // 2. SEEDING (Ekim)
              else if (activeImplement === 'SEEDER') {
                if (tile.state === 'TILLED') {
                  tile.state = 'SEEDED';
                  tile.growProgress = 0.05;
                }
              }
              // 3. HARVESTING (Hasat)
              else if (activeImplement === 'HARVESTER') {
                if (tile.state === 'RIPE') {
                  tile.state = 'HARVESTED';
                  tile.growProgress = 0;
                  sound.playHarvestChime();

                  // Add to grain tank
                  const yieldKg = tile.cropType === 'CORN' ? 8 : 6;
                  setGrainTank(cur => {
                    const next = Math.min(maxTankCapacity, cur + yieldKg);
                    if (next >= maxTankCapacity) {
                      setFarmStatus('Depo Doldu (%100)! Tahıl Silosuna gidip boşaltın.');
                    }
                    return next;
                  });

                  // Flying golden chaff & wheat grain particles
                  for (let p = 0; p < 4; p++) {
                    particlesRef.current.push({
                      x: toolX + (Math.random() - 0.5) * 16,
                      y: toolY + (Math.random() - 0.5) * 16,
                      vx: Math.cos(tr.angle + Math.PI + (Math.random() - 0.5)) * 35,
                      vy: Math.sin(tr.angle + Math.PI + (Math.random() - 0.5)) * 35 - 15,
                      radius: 1.5 + Math.random() * 2,
                      color: tile.cropType === 'CORN' ? '#FACC15' : '#FEF08A',
                      alpha: 0.9,
                      life: 0,
                      maxLife: 0.5,
                    });
                  }
                }
              }
              // 4. BALING (Balya Yapımı)
              else if (activeImplement === 'BALER') {
                if (tile.state === 'HARVESTED') {
                  tile.state = 'RAW';
                  sound.playBaleDrop();
                  balesRef.current.push({
                    x: tr.x - Math.cos(tr.angle) * 42,
                    y: tr.y - Math.sin(tr.angle) * 42,
                    angle: tr.angle,
                    value: 45,
                    type: Math.random() < 0.6 ? 'ROUND' : 'SQUARE',
                  });
                  setTotalBalesProduced(b => b + 1);
                  setFarmCoins(c => c + 35);
                  setFarmStatus('Altın Saman Balyası Üretildi! +$35');
                }
              }
            }
          });
        }

        // Animal AI wandering & interactions
        animalsRef.current.forEach(animal => {
          animal.stateTimer += dt;
          animal.tailWag = Math.sin(animal.stateTimer * 4);
          if (animal.type === 'CHICKEN' && animal.stateTimer > 3.0) {
            animal.stateTimer = 0;
            animal.angle += (Math.random() - 0.5) * 1.5;
            animal.x = Math.max(160, Math.min(235, animal.x + Math.cos(animal.angle) * 12));
            animal.y = Math.max(110, Math.min(150, animal.y + Math.sin(animal.angle) * 12));
          }

          // Tractor honk / close proximity reaction
          const distToTr = Math.hypot(tr.x - animal.x, tr.y - animal.y);
          if (distToTr < 45 && Math.random() < 0.02) {
            if (animal.type === 'COW') sound.playCowMoo();
            else if (animal.type === 'CHICKEN') sound.playChickenCluck();
          }
        });
      }

      // Update Particles
      for (let p = particlesRef.current.length - 1; p >= 0; p--) {
        const pt = particlesRef.current[p];
        pt.life += dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.alpha = Math.max(0, 0.9 * (1 - pt.life / pt.maxLife));
        if (pt.life >= pt.maxLife) particlesRef.current.splice(p, 1);
      }

      // Update Smoke
      for (let s = smokeRef.current.length - 1; s >= 0; s--) {
        const sm = smokeRef.current[s];
        sm.life += dt;
        sm.x += sm.vx * dt;
        sm.y += sm.vy * dt;
        sm.alpha = Math.max(0, 0.65 * (1 - sm.life / sm.maxLife));
        if (sm.life >= sm.maxLife) smokeRef.current.splice(s, 1);
      }

      // RENDER CANVAS
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderUltraFarmScene(ctx);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    gameState,
    activeImplement,
    tractorSkin,
    grainTank,
    maxTankCapacity,
    engineLevel,
    headerWidthLevel,
    isDaylight,
    highHarvestRecord,
    nearSilo,
  ]);

  // Upgrade Handlers
  const buyEngineUpgrade = () => {
    if (farmCoins >= 180 && engineLevel < 5) {
      sound.playCoinsSale();
      setFarmCoins(c => c - 180);
      setEngineLevel(lvl => lvl + 1);
      setFarmStatus(`Turbo Motor Seviye ${engineLevel + 1}'e yükseltildi! Hız arttı.`);
    }
  };

  const buyTankUpgrade = () => {
    if (farmCoins >= 220 && maxTankCapacity < 400) {
      sound.playCoinsSale();
      setFarmCoins(c => c - 220);
      setMaxTankCapacity(cap => cap + 50);
      setFarmStatus(`Tahıl Deposu ${maxTankCapacity + 50} kg kapasiteye çıkartıldı!`);
    }
  };

  const buyHeaderUpgrade = () => {
    if (farmCoins >= 260 && headerWidthLevel < 4) {
      sound.playCoinsSale();
      setFarmCoins(c => c - 260);
      setHeaderWidthLevel(w => w + 1);
      setFarmStatus(`Geniş Hasat Tablası Seviye ${headerWidthLevel + 1}'e yükseltildi!`);
    }
  };

  // ==========================================
  // ULTRA-DETAILED FARM SCENE RENDERER
  // ==========================================
  const renderUltraFarmScene = (ctx: CanvasRenderingContext2D) => {
    const tr = tractorRef.current;
    const time = performance.now() * 0.001;

    // 1. Lush Hay Day Country Meadow Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    if (isDaylight) {
      bgGradient.addColorStop(0, '#4D7C0F'); // vibrant meadow green
      bgGradient.addColorStop(0.5, '#65A30D');
      bgGradient.addColorStop(1, '#3F6212');
    } else {
      bgGradient.addColorStop(0, '#1E293B'); // dusk / golden twilight
      bgGradient.addColorStop(1, '#0F172A');
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Mowed lawn grass stripe pattern
    ctx.fillStyle = isDaylight ? 'rgba(63, 98, 18, 0.28)' : 'rgba(15, 23, 42, 0.4)';
    for (let gy = 0; gy < CANVAS_HEIGHT; gy += 32) {
      if ((gy / 32) % 2 === 0) {
        ctx.fillRect(0, gy, CANVAS_WIDTH, 32);
      }
    }

    // Wildflowers in Meadow (Red poppies, yellow buttercups, white daisies)
    const flowerCoords = [
      { x: 30, y: 35, c: '#EF4444' }, { x: 90, y: 140, c: '#FACC15' }, { x: 320, y: 110, c: '#FFFFFF' },
      { x: 420, y: 130, c: '#FACC15' }, { x: 740, y: 220, c: '#EF4444' }, { x: 750, y: 440, c: '#FFFFFF' },
      { x: 25, y: 520, c: '#FACC15' }, { x: 720, y: 520, c: '#EF4444' },
    ];
    flowerCoords.forEach(fl => {
      ctx.fillStyle = fl.c;
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Farmland Boundary Fences & Dirt Perimeter
    ctx.save();
    // Dirt border around plowed field
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.roundRect(50, 160, 695, 365, 14);
    ctx.fill();
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Wooden Post-and-Rail Fence on Field North Boundary
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(50, 160); ctx.lineTo(745, 160);
    ctx.stroke();
    // Fence posts
    ctx.fillStyle = '#78350F';
    for (let fx = 50; fx <= 745; fx += 50) {
      ctx.fillRect(fx - 2.5, 150, 5, 16);
      // Post shadow
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(fx + 2.5, 154, 4, 12);
      ctx.fillStyle = '#78350F';
    }
    ctx.restore();

    // 3. Mud Tracks / Tire Tread Impressions
    mudTracksRef.current.forEach(trk => {
      ctx.save();
      ctx.strokeStyle = trk.isPlowed ? `rgba(69, 26, 3, ${trk.alpha * 1.3})` : `rgba(40, 20, 5, ${trk.alpha})`;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(trk.x1, trk.y1);
      ctx.lineTo(trk.x2, trk.y2);
      ctx.stroke();
      ctx.restore();
    });

    // 4. CROP TILES (Plowed Furrows, Seed Rows, Lush Wheat & Corn)
    tilesRef.current.forEach(tile => {
      ctx.save();
      const x = tile.x;
      const y = tile.y;
      const w = tile.width;
      const h = tile.height;

      if (tile.state === 'TILLED') {
        // Deep moist furrowed earth
        ctx.fillStyle = '#451A03';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

        // 3D Furrow Ridges
        ctx.strokeStyle = '#270E02';
        ctx.lineWidth = 2.5;
        for (let fy = y + 8; fy < y + h - 4; fy += 10) {
          ctx.beginPath();
          ctx.moveTo(x + 3, fy);
          ctx.lineTo(x + w - 3, fy);
          ctx.stroke();
        }
      } else if (tile.state === 'SEEDED') {
        // Furrowed soil with neat seed rows
        ctx.fillStyle = '#542306';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

        // Green seed drill sprout dots
        ctx.fillStyle = '#84CC16';
        for (let sx = x + 8; sx < x + w - 4; sx += 12) {
          for (let sy = y + 8; sy < y + h - 4; sy += 10) {
            ctx.beginPath();
            ctx.arc(sx, sy, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (tile.state === 'GROWING') {
        // Emerald green young stalks
        ctx.fillStyle = '#451A03';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

        ctx.fillStyle = '#65A30D';
        for (let gx = x + 6; gx < x + w - 4; gx += 9) {
          for (let gy = y + 6; gy < y + h - 4; gy += 10) {
            ctx.fillRect(gx, gy, 3, 7);
          }
        }
      } else if (tile.state === 'RIPE') {
        // Dense Ripe Golden Wheat or Corn
        const sway = Math.sin(time * 3 + tile.swayOffset) * 2;
        const cropBaseColor = tile.cropType === 'CORN' ? '#D97706' : '#EAB308';
        ctx.fillStyle = cropBaseColor;
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

        // Dense swaying golden stalks with ears
        ctx.fillStyle = tile.cropType === 'CORN' ? '#FACC15' : '#FEF08A';
        for (let cx = x + 5; cx < x + w - 4; cx += 7) {
          for (let cy = y + 5; cy < y + h - 4; cy += 8) {
            ctx.beginPath();
            ctx.arc(cx + sway, cy, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Corn cobs highlight if corn
        if (tile.cropType === 'CORN') {
          ctx.fillStyle = '#16A34A'; // green husk
          ctx.fillRect(x + 12 + sway, y + 12, 4, 8);
          ctx.fillRect(x + 36 + sway, y + 26, 4, 8);
        }
      } else if (tile.state === 'HARVESTED') {
        // Golden stubble residue
        ctx.fillStyle = '#92400E';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

        ctx.fillStyle = '#FDE047';
        for (let hx = x + 6; hx < x + w - 4; hx += 10) {
          ctx.fillRect(hx, y + 12, 2, 5);
          ctx.fillRect(hx + 4, y + 32, 2, 5);
        }
      } else {
        // RAW uncultivated patch
        ctx.fillStyle = '#78350F';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      }
      ctx.restore();
    });

    // 5. Dropped Hay Bales on Farmland
    balesRef.current.forEach(bale => {
      ctx.save();
      ctx.translate(bale.x, bale.y);
      ctx.rotate(bale.angle);

      // Bale drop shadow
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(3, 4, 11, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Golden straw bale
      ctx.fillStyle = '#FBBF24';
      if (bale.type === 'ROUND') {
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // Inner straw spiral
        ctx.strokeStyle = '#92400E';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 1.5);
        ctx.stroke();
      } else {
        ctx.fillRect(-10, -7, 20, 14);
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 2;
        ctx.strokeRect(-10, -7, 20, 14);
        // Twine binding bands
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-4, -7); ctx.lineTo(-4, 7);
        ctx.moveTo(4, -7); ctx.lineTo(4, 7);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 6. HAY DAY CLASSIC BUILDINGS & FARM INFRASTRUCTURE
    // ===================================================
    // A) RED WOODEN GAMBREL BARN (Top Left: X: 45, Y: 18)
    ctx.save();
    // Barn Ground Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(115, 140, 65, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Red Wooden Barn Walls
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(55, 42, 120, 95);

    // Weathered horizontal timber siding lines
    ctx.strokeStyle = '#991B1B';
    ctx.lineWidth = 1.5;
    for (let wy = 52; wy < 137; wy += 8) {
      ctx.beginPath();
      ctx.moveTo(55, wy); ctx.lineTo(175, wy);
      ctx.stroke();
    }

    // Gambrel White Trim Roof
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.moveTo(45, 52);
    ctx.lineTo(115, 16);
    ctx.lineTo(185, 52);
    ctx.closePath();
    ctx.fill();

    // Barn Sliding Double Doors with White Cross 'X'
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(92, 85, 46, 52);
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(92, 85); ctx.lineTo(138, 137);
    ctx.moveTo(138, 85); ctx.lineTo(92, 137);
    ctx.stroke();

    // Barn Loft Door & Hoist Beam with Rope & Pulley
    ctx.fillStyle = '#451A03';
    ctx.fillRect(104, 52, 22, 24);
    ctx.fillStyle = '#FDE047';
    ctx.fillRect(107, 56, 16, 12); // hay stored in loft
    // Pulley Beam
    ctx.fillStyle = '#78350F';
    ctx.fillRect(113, 36, 4, 18);
    ctx.strokeStyle = '#FEF08A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(115, 42); ctx.lineTo(115, 68);
    ctx.stroke();

    // Weather Vane Rooster
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(115, 16); ctx.lineTo(115, 5);
    ctx.moveTo(107, 5); ctx.lineTo(123, 5);
    ctx.stroke();

    // Barn Nameplate
    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HAY DAY ÇİFTLİĞİ', 115, 78);
    ctx.restore();

    // B) DUTCH ROTATING WINDMILL (Top Center: X: 265, Y: 18)
    ctx.save();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(265, 136, 32, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stone Masonry Base
    ctx.fillStyle = '#64748B';
    ctx.beginPath();
    ctx.moveTo(242, 135);
    ctx.lineTo(254, 45);
    ctx.lineTo(276, 45);
    ctx.lineTo(288, 135);
    ctx.closePath();
    ctx.fill();

    // Masonry stone lines
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    for (let my = 58; my < 135; my += 12) {
      ctx.beginPath();
      ctx.moveTo(244, my); ctx.lineTo(286, my);
      ctx.stroke();
    }

    // Wooden Cap
    ctx.fillStyle = '#92400E';
    ctx.beginPath();
    ctx.arc(265, 45, 15, Math.PI, 0);
    ctx.fill();

    // 4 Rotating Windmill Sails
    ctx.save();
    ctx.translate(265, 45);
    ctx.rotate(windmillAngleRef.current);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    for (let s = 0; s < 4; s++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, 44);
      ctx.stroke();
      // Cream canvas sail blades
      ctx.fillStyle = 'rgba(254, 240, 138, 0.75)';
      ctx.fillRect(-6, 12, 12, 28);
    }
    ctx.restore();
    ctx.restore();

    // C) STEEL INDUSTRIAL GRAIN SILO (Top Right: X: 645, Y: 18)
    ctx.save();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.24)';
    ctx.beginPath();
    ctx.ellipse(685, 152, 45, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Metallic corrugated silo cylinder
    const siloGrad = ctx.createLinearGradient(645, 0, 725, 0);
    siloGrad.addColorStop(0, '#64748B');
    siloGrad.addColorStop(0.35, '#E2E8F0'); // metallic sheen
    siloGrad.addColorStop(0.7, '#94A3B8');
    siloGrad.addColorStop(1, '#475569');
    ctx.fillStyle = siloGrad;
    ctx.fillRect(645, 46, 80, 100);

    // Corrugated horizontal rings
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    for (let sy = 56; sy <= 140; sy += 12) {
      ctx.beginPath();
      ctx.moveTo(645, sy); ctx.lineTo(725, sy);
      ctx.stroke();
    }

    // Dome Roof
    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.arc(685, 46, 40, Math.PI, 0);
    ctx.fill();

    // Grain Chute & Unloading Zone Platform
    ctx.fillStyle = nearSilo ? '#22C55E' : '#EAB308';
    ctx.beginPath();
    ctx.roundRect(635, 144, 100, 24, 6);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(nearSilo ? 'BOŞALTMAK İÇİN [E] BAS' : 'TAHIL SİLOSU SATIŞ', 685, 159);
    ctx.restore();

    // 7. ANIMATED FARM ANIMALS (Cows, Chickens, Sheep)
    animalsRef.current.forEach(animal => {
      ctx.save();
      if (animal.type === 'COW') {
        // Holstein Cow
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(animal.x + 12, animal.y + 22, 15, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // White Body with Black Spots
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(animal.x, animal.y, 26, 17);
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(animal.x + 4, animal.y + 2, 8, 7);
        ctx.fillRect(animal.x + 16, animal.y + 6, 7, 7);

        // Head
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(animal.x + 24, animal.y - 4, 12, 12);
        ctx.fillStyle = '#F472B6'; // pink snout
        ctx.fillRect(animal.x + 30, animal.y + 2, 6, 6);

        // Legs
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(animal.x + 2, animal.y + 17, 4, 8);
        ctx.fillRect(animal.x + 20, animal.y + 17, 4, 8);

        // Animated Tail
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(animal.x, animal.y + 4);
        ctx.lineTo(animal.x - 5, animal.y + 8 + animal.tailWag * 3);
        ctx.stroke();
      } else if (animal.type === 'CHICKEN') {
        // Chicken
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.arc(animal.x, animal.y, 5, 0, Math.PI * 2);
        ctx.fill();
        // Red comb
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(animal.x - 1, animal.y - 7, 3, 3);
        // Yellow beak
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(animal.x + 3, animal.y - 1, 3, 2);
      } else if (animal.type === 'SHEEP') {
        // Fluffy Sheep
        ctx.fillStyle = '#F1F5F9';
        ctx.beginPath();
        ctx.arc(animal.x, animal.y, 10, 0, Math.PI * 2);
        ctx.arc(animal.x + 6, animal.y - 3, 7, 0, Math.PI * 2);
        ctx.fill();
        // Black face
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(animal.x + 10, animal.y - 4, 6, 7);
      }
      ctx.restore();
    });

    // 8. EXHAUST SMOKE & GRAIN PARTICLES
    smokeRef.current.forEach(sm => {
      ctx.save();
      ctx.fillStyle = `rgba(148, 163, 184, ${sm.alpha})`;
      ctx.beginPath();
      ctx.arc(sm.x, sm.y, sm.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    particlesRef.current.forEach(pt => {
      ctx.save();
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 9. ULTRA-REALISTIC MODERN FS 27 TRACTOR (John Deere / Fendt Style)
    // ===================================================================
    ctx.save();
    ctx.translate(tr.x, tr.y);
    ctx.rotate(tr.angle);

    // Dynamic Tractor Ground Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 36, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // High-Intensity Volumetric LED Headlights Beam
    if (tr.headlightsOn) {
      const hlGrad = ctx.createRadialGradient(38, 0, 8, 125, 0, 95);
      hlGrad.addColorStop(0, 'rgba(254, 240, 138, 0.55)');
      hlGrad.addColorStop(0.5, 'rgba(254, 240, 138, 0.22)');
      hlGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = hlGrad;
      ctx.beginPath();
      ctx.moveTo(38, -14);
      ctx.lineTo(135, -45);
      ctx.lineTo(135, 45);
      ctx.lineTo(38, 14);
      ctx.closePath();
      ctx.fill();
    }

    // A) REAR / FRONT IMPLEMENTS
    const toolWidth = 32 + (headerWidthLevel - 1) * 8;
    if (activeImplement === 'PLOW') {
      // Steel 5-Bottom Heavy Moldboard Reversible Plow
      ctx.fillStyle = '#334155';
      ctx.fillRect(-52, -toolWidth / 2, 18, toolWidth);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 3.5;
      for (let py = -toolWidth / 2 + 4; py <= toolWidth / 2 - 4; py += 10) {
        ctx.beginPath();
        ctx.moveTo(-52, py);
        ctx.lineTo(-66, py + 8);
        ctx.stroke();
      }
    } else if (activeImplement === 'SEEDER') {
      // Red pneumatic seeder drill hopper with tubes
      ctx.fillStyle = '#DC2626';
      ctx.fillRect(-54, -toolWidth / 2, 20, toolWidth);
      ctx.fillStyle = '#FEF08A';
      for (let dy = -toolWidth / 2 + 6; dy <= toolWidth / 2 - 6; dy += 8) {
        ctx.beginPath();
        ctx.arc(-56, dy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (activeImplement === 'HARVESTER') {
      // Giant front combine harvester header reel with rotating bars
      ctx.fillStyle = '#CA8A04';
      ctx.fillRect(38, -toolWidth / 2, 18, toolWidth);
      // Revolving reel tines
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2.5;
      for (let hy = -toolWidth / 2 + 5; hy <= toolWidth / 2 - 5; hy += 11) {
        ctx.beginPath();
        ctx.moveTo(38, hy);
        ctx.lineTo(58, hy);
        ctx.stroke();
      }
      // Reel divider shields on sides
      ctx.fillStyle = '#EAB308';
      ctx.fillRect(48, -toolWidth / 2 - 3, 10, 5);
      ctx.fillRect(48, toolWidth / 2 - 2, 10, 5);
    } else if (activeImplement === 'BALER') {
      // Straw baler chamber on rear hitch
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(-54, -20, 22, 40);
      ctx.fillStyle = '#78350F';
      ctx.fillRect(-56, -14, 4, 28);
    }

    // B) HEAVY LUGGED AGRICULTURAL TIRES
    // Rear Flotation Tires (Massive chevron lug treads)
    const tireColor = '#0F172A';
    const rimColor = tractorSkin === 'GREEN_GOLD' ? '#FACC15' : tractorSkin === 'RED_POWER' ? '#E2E8F0' : '#F8FAFC';

    [-26, -26].forEach((tx, idx) => {
      const ty = idx === 0 ? -24 : 12;
      ctx.fillStyle = tireColor;
      ctx.beginPath();
      ctx.roundRect(tx, ty, 28, 12, 4);
      ctx.fill();

      // Steel Wheel Rim & Lug Nut Center
      ctx.fillStyle = rimColor;
      ctx.fillRect(tx + 6, ty + 2.5, 16, 7);
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(tx + 14, ty + 6, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Front Steerable Wheels (Dynamic Ackermann Angle)
    [18, 18].forEach((fx, idx) => {
      const fy = idx === 0 ? -22 : 12;
      ctx.save();
      ctx.translate(fx + 10, fy + 5);
      ctx.rotate(tr.steerAngle);
      ctx.fillStyle = tireColor;
      ctx.beginPath();
      ctx.roundRect(-10, -5, 20, 10, 3);
      ctx.fill();
      // Rim
      ctx.fillStyle = rimColor;
      ctx.fillRect(-6, -2.5, 12, 5);
      ctx.restore();
    });

    // C) TRACTOR HOOD & CHASSIS
    let primaryBodyColor = '#15803D'; // John Deere Green
    let accentDecalColor = '#FACC15'; // John Deere Yellow
    if (tractorSkin === 'RED_POWER') {
      primaryBodyColor = '#DC2626'; // Case IH Red
      accentDecalColor = '#FFFFFF';
    } else if (tractorSkin === 'BLUE_BEAST') {
      primaryBodyColor = '#0284C7'; // New Holland Blue
      accentDecalColor = '#FACC15';
    }

    ctx.fillStyle = primaryBodyColor;
    ctx.beginPath();
    ctx.roundRect(-22, -15, 56, 30, 6);
    ctx.fill();

    // Side Decal Racing Stripe
    ctx.fillStyle = accentDecalColor;
    ctx.fillRect(-20, -2.5, 52, 5);

    // Front Engine Radiator Chrome Grille & Projector Headlights
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(32, -12, 5, 24);
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(34, -8, 3, 0, Math.PI * 2);
    ctx.arc(34, 8, 3, 0, Math.PI * 2);
    ctx.fill();

    // Vertical Chrome Exhaust Stack on Engine Hood
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(16, -11, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // D) PANORAMIC OPERATOR CABIN WITH TINTED GLASS
    ctx.fillStyle = 'rgba(56, 189, 248, 0.82)';
    ctx.beginPath();
    ctx.roundRect(-14, -13, 28, 26, 4);
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Farmer Operator Figure inside
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    // Cap
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-3, -4, 6, 3);

    // Cab Roof with Dual Hazard Beacons
    ctx.fillStyle = primaryBodyColor;
    ctx.fillRect(-15, -14, 30, 4);

    // Rotating Orange Strobe Beacon Pulse
    const beaconPulse = Math.sin(tr.beaconAngle);
    ctx.fillStyle = beaconPulse > 0 ? '#F97316' : '#7C2D12';
    ctx.beginPath();
    ctx.arc(0, -15, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // End tractor

    // 10. MODERN HUD TELEMETRY & TRACTOR DASHBOARD
    // ============================================
    ctx.save();
    const hudX = 16;
    const hudY = 16;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(hudX, hudY, 230, 96, 10);
    ctx.fill();
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Header Title
    ctx.fillStyle = '#22C55E';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🚜 FS 27: MODERN ÇİFTLİK', hudX + 10, hudY + 20);

    // Implement text
    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 9px sans-serif';
    const implLabel =
      activeImplement === 'PLOW'
        ? '1. PULLUK (SÜRÜM)'
        : activeImplement === 'SEEDER'
        ? '2. MİBZER (EKİM)'
        : activeImplement === 'HARVESTER'
        ? '3. BİÇERDÖVER (HASAT)'
        : '4. BALYA MAKİNESİ';
    ctx.fillText(`EKİPMAN: ${implLabel}`, hudX + 10, hudY + 36);

    // Speedometer & Engine RPM
    ctx.fillStyle = '#94A3B8';
    ctx.font = '9px sans-serif';
    ctx.fillText('HIZ:', hudX + 10, hudY + 52);
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${tractorSpeedKmh} KM/H`, hudX + 38, hudY + 52);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '9px sans-serif';
    ctx.fillText('DEVİR:', hudX + 120, hudY + 52);
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`${Math.round(tr.rpm)} RPM`, hudX + 162, hudY + 52);

    // Grain Tank Meter
    ctx.fillStyle = '#94A3B8';
    ctx.font = '9px sans-serif';
    ctx.fillText('DEPO:', hudX + 10, hudY + 68);
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(hudX + 42, hudY + 61, 130, 9);
    ctx.fillStyle = grainTank >= maxTankCapacity ? '#EF4444' : '#EAB308';
    ctx.fillRect(hudX + 42, hudY + 61, 130 * (grainTank / maxTankCapacity), 9);
    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`%${Math.round((grainTank / maxTankCapacity) * 100)}`, hudX + 180, hudY + 69);

    // Farm Cash
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`KASA: $${farmCoins}`, hudX + 10, hudY + 87);

    // Bales Produced count
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '9px sans-serif';
    ctx.fillText(`📦 ${totalBalesProduced} Balya`, hudX + 140, hudY + 87);
    ctx.restore();

    // In-Game Notification Banner when near silo
    if (nearSilo && grainTank > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(22, 101, 52, 0.92)';
      ctx.beginPath();
      ctx.roundRect(CANVAS_WIDTH / 2 - 130, 20, 260, 36, 8);
      ctx.fill();
      ctx.strokeStyle = '#4ADE80';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🌾 [E] Basarak Buğdayları Sat!', CANVAS_WIDTH / 2, 43);
      ctx.restore();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-full max-w-6xl mx-auto py-2">
      {/* CANVAS CONTAINER */}
      <div className="flex flex-col items-center select-none w-full max-w-[800px]">
        {/* Top Farm Toolbar */}
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-t-xl px-4 py-2.5 flex flex-wrap items-center justify-between text-xs font-semibold gap-2">
          {/* Implement selector buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              onClick={() => {
                setActiveImplement('PLOW');
                sound.playClick();
              }}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                activeImplement === 'PLOW'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1. Pulluk (Sürüm)
            </button>
            <button
              onClick={() => {
                setActiveImplement('SEEDER');
                sound.playClick();
              }}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                activeImplement === 'SEEDER'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              2. Mibzer (Ekim)
            </button>
            <button
              onClick={() => {
                setActiveImplement('HARVESTER');
                sound.playClick();
              }}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                activeImplement === 'HARVESTER'
                  ? 'bg-yellow-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              3. Biçerdöver
            </button>
            <button
              onClick={() => {
                setActiveImplement('BALER');
                sound.playClick();
              }}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                activeImplement === 'BALER'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              4. Balya Yap
            </button>
          </div>

          {/* Quick Actions (Horn, Lights, Day/Night) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => sound.playTractorHorn()}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              title="Havalı Korna (H)"
            >
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              Korna [H]
            </button>

            <button
              onClick={() => {
                tractorRef.current.headlightsOn = !tractorRef.current.headlightsOn;
                sound.playClick();
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              title="Farları Aç/Kapat (L)"
            >
              <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
              Farlar [L]
            </button>

            <button
              onClick={() => setIsDaylight(d => !d)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-colors"
              title="Gündüz / Akşam Işığı"
            >
              {isDaylight ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-400" />}
            </button>
          </div>
        </div>

        {/* Canvas Screen */}
        <div className="relative border-x border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block max-w-full h-auto cursor-crosshair"
          />

          {/* MENU OVERLAY */}
          {gameState === 'MENU' && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-lime-600 to-amber-500 flex items-center justify-center shadow-lg shadow-lime-500/30 mb-4 animate-bounce">
                <Tractor className="w-9 h-9 text-white" />
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-lime-400 via-amber-300 to-yellow-500 tracking-tight mb-2">
                FS 27: ÇİFTLİK & TRAKTÖR
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mb-6 leading-relaxed">
                Ultra-gerçekçi traktör mekanikleri, Hay Day çiftlik atmosferi ve tarım simülasyonu! Tarlayı sürün, altın tohumları ekin, biçerdöverle tonlarca buğdayı biçip siloda satın.
              </p>

              {/* Tractor Color Picker */}
              <div className="flex items-center gap-3 mb-6 bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                <span className="text-xs font-semibold text-slate-400">Traktör Markası:</span>
                <button
                  onClick={() => setTractorSkin('GREEN_GOLD')}
                  className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                    tractorSkin === 'GREEN_GOLD' ? 'bg-green-600 text-white shadow' : 'text-slate-400'
                  }`}
                >
                  🟢 John Deere
                </button>
                <button
                  onClick={() => setTractorSkin('RED_POWER')}
                  className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                    tractorSkin === 'RED_POWER' ? 'bg-red-600 text-white shadow' : 'text-slate-400'
                  }`}
                >
                  🔴 Case IH
                </button>
                <button
                  onClick={() => setTractorSkin('BLUE_BEAST')}
                  className={`px-2.5 py-1 rounded text-xs font-bold cursor-pointer transition-colors ${
                    tractorSkin === 'BLUE_BEAST' ? 'bg-sky-600 text-white shadow' : 'text-slate-400'
                  }`}
                >
                  🔵 New Holland
                </button>
              </div>

              <button
                onClick={startGame}
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-lime-600 via-emerald-600 to-amber-600 hover:from-lime-500 hover:to-amber-500 text-white font-bold text-sm shadow-xl shadow-lime-600/30 flex items-center gap-2 cursor-pointer transition-all transform hover:scale-105"
              >
                <Play className="w-5 h-5 fill-current" />
                Motoru Çalıştır & Tarlaya Gir!
              </button>

              <div className="mt-6 flex items-center gap-4 text-xs text-slate-400">
                <span>⌨️ W/S: Gaz / Geri</span>
                <span>•</span>
                <span>A/D: Direksiyon</span>
                <span>•</span>
                <span>1-4: Ekipmanlar</span>
              </div>
            </div>
          )}

          {/* Near Silo Unload Floating Button */}
          {gameState === 'PLAYING' && nearSilo && grainTank > 0 && (
            <button
              onClick={handleUnloadAtSilo}
              className="absolute bottom-6 right-6 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-2xl flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 z-10 animate-pulse"
            >
              <Coins className="w-5 h-5" />
              Depoyu Boşalt & Sat (${Math.round(grainTank * 2.8)})
            </button>
          )}
        </div>

        {/* Farm Status Banner */}
        <div className="w-full bg-slate-900 border-x border-b border-slate-800 rounded-b-xl px-4 py-2 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-lime-400 animate-ping shrink-0" />
            <span className="text-slate-200 font-medium truncate">{farmStatus}</span>
          </div>

          <div className="flex items-center gap-4 shrink-0 font-mono-num text-[11px]">
            <span>🏆 Rekor Hasat: <strong className="text-lime-400">{highHarvestRecord} kg</strong></span>
            <span>💰 Kasa: <strong className="text-amber-400">${farmCoins}</strong></span>
          </div>
        </div>
      </div>

      {/* BOTTOM UPGRADE SHOP & CONTRACTS BAR */}
      <div className="w-full max-w-[800px] grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: Turbo Motor */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-sky-400" />
              Turbo Motor (Seviye {engineLevel})
            </span>
            <span className="text-[11px] font-bold text-amber-400">$180</span>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">Traktör maksimum hızını ve çekiş gücünü artırır.</p>
          <button
            onClick={buyEngineUpgrade}
            disabled={farmCoins < 180 || engineLevel >= 5}
            className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              farmCoins >= 180 && engineLevel < 5
                ? 'bg-sky-600 hover:bg-sky-500 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {engineLevel >= 5 ? 'Maksimum Seviye' : 'Yükselt ($180)'}
          </button>
        </div>

        {/* Card 2: Büyük Tahıl Deposu */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-400" />
              Tahıl Deposu ({maxTankCapacity} kg)
            </span>
            <span className="text-[11px] font-bold text-amber-400">$220</span>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">Silo ziyaret etmeden daha fazla buğday hasat edin (+50kg).</p>
          <button
            onClick={buyTankUpgrade}
            disabled={farmCoins < 220 || maxTankCapacity >= 400}
            className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              farmCoins >= 220 && maxTankCapacity < 400
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {maxTankCapacity >= 400 ? 'Maksimum Kapasite' : 'Genişlet ($220)'}
          </button>
        </div>

        {/* Card 3: Geniş Biçerdöver Tablası */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-lime-400" />
              Geniş Tabla (Seviye {headerWidthLevel})
            </span>
            <span className="text-[11px] font-bold text-amber-400">$260</span>
          </div>
          <p className="text-[11px] text-slate-400 mb-2">Biçerdöverin genişliğini artırıp aynı anda 2 sırayı biçer.</p>
          <button
            onClick={buyHeaderUpgrade}
            disabled={farmCoins < 260 || headerWidthLevel >= 4}
            className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              farmCoins >= 260 && headerWidthLevel < 4
                ? 'bg-lime-600 hover:bg-lime-500 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {headerWidthLevel >= 4 ? 'Maksimum Genişlik' : 'Genişlet ($260)'}
          </button>
        </div>
      </div>
    </div>
  );
};
