import React, { useEffect, useRef, useState } from 'react';
import { sound } from '../../../utils/audio';
import { Play, RotateCcw, Shield, Zap, Sparkles, Trophy, Info, Bomb } from 'lucide-react';

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 640;

interface PlayerShip {
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  hasShield: boolean;
  tripleShotTimer: number;
  rapidFireTimer: number;
  fireCooldown: number;
}

interface EnemyShip {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  type: 'scout' | 'raider' | 'asteroid' | 'boss';
  scoreValue: number;
  fireTimer: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: 'player' | 'enemy';
  color: string;
  radius: number;
  damage: number;
}

interface PowerUp {
  x: number;
  y: number;
  vy: number;
  type: 'shield' | 'triple' | 'bomb' | 'rapid';
  radius: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
}

interface SpaceParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

export const SpaceDefenderGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'GAMEOVER'>('MENU');
  const [score, setScore] = useState<number>(0);
  const [wave, setWave] = useState<number>(1);
  const [highScore, setHighScore] = useState<number>(() => {
    return parseInt(localStorage.getItem('space_defender_high_score') || '0', 10);
  });
  const [empBombs, setEmpBombs] = useState<number>(1);
  const [playerHp, setPlayerHp] = useState<number>(3);
  const [hasShield, setHasShield] = useState<boolean>(false);

  // Simulation Refs
  const playerRef = useRef<PlayerShip>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 80,
    radius: 18,
    hp: 3,
    maxHp: 3,
    hasShield: false,
    tripleShotTimer: 0,
    rapidFireTimer: 0,
    fireCooldown: 0,
  });

  const enemiesRef = useRef<EnemyShip[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const particlesRef = useRef<SpaceParticle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const waveTimerRef = useRef<number>(0);
  const isBossActiveRef = useRef<boolean>(false);
  const screenShakeRef = useRef<number>(0);

  // Initialize stars for background
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 75; i++) {
      stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 80 + 30,
        alpha: Math.random() * 0.8 + 0.2,
      });
    }
    starsRef.current = stars;
  }, []);

  const startGame = () => {
    sound.playClick();
    playerRef.current = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 80,
      radius: 18,
      hp: 3,
      maxHp: 3,
      hasShield: false,
      tripleShotTimer: 0,
      rapidFireTimer: 0,
      fireCooldown: 0,
    };
    enemiesRef.current = [];
    bulletsRef.current = [];
    powerUpsRef.current = [];
    particlesRef.current = [];
    setScore(0);
    setWave(1);
    setEmpBombs(1);
    setPlayerHp(3);
    setHasShield(false);
    waveTimerRef.current = 0;
    isBossActiveRef.current = false;
    screenShakeRef.current = 0;

    setGameState('PLAYING');
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (e.key === 'b' || e.key === 'B' || e.key === 'e' || e.key === 'E') {
        triggerEmpBomb();
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
  }, [empBombs, gameState]);

  // Mouse / Touch drag controls
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    mousePosRef.current = { x, y };

    playerRef.current.x = Math.max(20, Math.min(CANVAS_WIDTH - 20, x));
    playerRef.current.y = Math.max(60, Math.min(CANVAS_HEIGHT - 40, y));
  };

  // Trigger EMP screen clearing bomb
  const triggerEmpBomb = () => {
    if (gameState !== 'PLAYING' || empBombs <= 0) return;
    setEmpBombs(prev => prev - 1);
    sound.playSpaceExplode();
    screenShakeRef.current = 15;

    // Destroy all bullets and non-boss enemies
    bulletsRef.current = [];
    enemiesRef.current.forEach(e => {
      if (e.type === 'boss') {
        e.hp -= 250;
      } else {
        e.hp = 0;
        setScore(s => s + e.scoreValue);
      }
      spawnExplosion(e.x, e.y, '#38BDF8', 20);
    });
    enemiesRef.current = enemiesRef.current.filter(e => e.hp > 0);
  };

  // Spawn enemy helper
  const spawnEnemy = (currentWave: number) => {
    const spawnX = 40 + Math.random() * (CANVAS_WIDTH - 80);

    // Wave 5, 10, etc. spawns Boss if not already active
    if (currentWave % 5 === 0 && !isBossActiveRef.current && enemiesRef.current.length === 0) {
      isBossActiveRef.current = true;
      enemiesRef.current.push({
        id: `boss_${Date.now()}`,
        x: CANVAS_WIDTH / 2,
        y: -50,
        vx: 80,
        vy: 35,
        radius: 45,
        hp: 1200 + currentWave * 300,
        maxHp: 1200 + currentWave * 300,
        type: 'boss',
        scoreValue: 2000,
        fireTimer: 1.2,
      });
      return;
    }

    const rand = Math.random();
    if (rand < 0.35) {
      // Asteroid
      enemiesRef.current.push({
        id: `ast_${Date.now()}_${Math.random()}`,
        x: spawnX,
        y: -30,
        vx: (Math.random() - 0.5) * 40,
        vy: 60 + Math.random() * 40,
        radius: 20 + Math.random() * 8,
        hp: 60,
        maxHp: 60,
        type: 'asteroid',
        scoreValue: 80,
        fireTimer: 999,
      });
    } else if (rand < 0.75) {
      // Fast Scout
      enemiesRef.current.push({
        id: `scout_${Date.now()}_${Math.random()}`,
        x: spawnX,
        y: -25,
        vx: (Math.random() - 0.5) * 90,
        vy: 110 + Math.random() * 50,
        radius: 14,
        hp: 30,
        maxHp: 30,
        type: 'scout',
        scoreValue: 120,
        fireTimer: 999,
      });
    } else {
      // Armored Raider that shoots
      enemiesRef.current.push({
        id: `raider_${Date.now()}_${Math.random()}`,
        x: spawnX,
        y: -30,
        vx: (Math.random() - 0.5) * 60,
        vy: 70 + Math.random() * 30,
        radius: 20,
        hp: 90,
        maxHp: 90,
        type: 'raider',
        scoreValue: 250,
        fireTimer: 1.5,
      });
    }
  };

  const spawnExplosion = (x: number, y: number, color: string, count = 12) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 220,
        vy: (Math.random() - 0.5) * 220,
        radius: 2 + Math.random() * 3,
        color,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
      });
    }
  };

  // Main Game Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min(0.1, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      // Update Starfield
      starsRef.current.forEach(star => {
        star.y += star.speed * dt;
        if (star.y > CANVAS_HEIGHT) {
          star.y = 0;
          star.x = Math.random() * CANVAS_WIDTH;
        }
      });

      if (gameState === 'PLAYING') {
        const player = playerRef.current;

        // Keyboard Movement
        const speed = 320;
        if (keysRef.current['ArrowLeft'] || keysRef.current['a'] || keysRef.current['A']) {
          player.x = Math.max(20, player.x - speed * dt);
        }
        if (keysRef.current['ArrowRight'] || keysRef.current['d'] || keysRef.current['D']) {
          player.x = Math.min(CANVAS_WIDTH - 20, player.x + speed * dt);
        }
        if (keysRef.current['ArrowUp'] || keysRef.current['w'] || keysRef.current['W']) {
          player.y = Math.max(60, player.y - speed * dt);
        }
        if (keysRef.current['ArrowDown'] || keysRef.current['s'] || keysRef.current['S']) {
          player.y = Math.min(CANVAS_HEIGHT - 40, player.y + speed * dt);
        }

        // Power-up timers
        if (player.tripleShotTimer > 0) player.tripleShotTimer -= dt;
        if (player.rapidFireTimer > 0) player.rapidFireTimer -= dt;

        // Auto Player Laser Firing
        player.fireCooldown -= dt;
        const cooldownThreshold = player.rapidFireTimer > 0 ? 0.1 : 0.18;
        if (player.fireCooldown <= 0) {
          player.fireCooldown = cooldownThreshold;
          sound.playLaser();

          if (player.tripleShotTimer > 0) {
            // Triple spread
            bulletsRef.current.push(
              { x: player.x, y: player.y - 15, vx: 0, vy: -520, team: 'player', color: '#38BDF8', radius: 3, damage: 30 },
              { x: player.x - 10, y: player.y - 10, vx: -100, vy: -500, team: 'player', color: '#38BDF8', radius: 3, damage: 30 },
              { x: player.x + 10, y: player.y - 10, vx: 100, vy: -500, team: 'player', color: '#38BDF8', radius: 3, damage: 30 }
            );
          } else {
            // Dual laser
            bulletsRef.current.push(
              { x: player.x - 8, y: player.y - 15, vx: 0, vy: -520, team: 'player', color: '#06B6D4', radius: 3, damage: 35 },
              { x: player.x + 8, y: player.y - 15, vx: 0, vy: -520, team: 'player', color: '#06B6D4', radius: 3, damage: 35 }
            );
          }
        }

        // Wave Spawner
        waveTimerRef.current += dt;
        const spawnInterval = Math.max(0.6, 2.0 - wave * 0.12);
        if (waveTimerRef.current >= spawnInterval) {
          waveTimerRef.current = 0;
          spawnEnemy(wave);
        }

        // Update Enemies
        for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
          const e = enemiesRef.current[i];
          e.x += e.vx * dt;
          e.y += e.vy * dt;

          // Wall bounce for horizontal movement
          if (e.x < e.radius || e.x > CANVAS_WIDTH - e.radius) {
            e.vx = -e.vx;
          }

          // Boss specific AI
          if (e.type === 'boss') {
            if (e.y > 110) {
              e.vy = 0; // stop vertical descent
              e.y = 110;
            }
            e.fireTimer -= dt;
            if (e.fireTimer <= 0) {
              e.fireTimer = 1.0;
              // 3-way boss bullet fan
              bulletsRef.current.push(
                { x: e.x, y: e.y + 30, vx: 0, vy: 240, team: 'enemy', color: '#EF4444', radius: 4, damage: 1 },
                { x: e.x - 20, y: e.y + 25, vx: -70, vy: 220, team: 'enemy', color: '#EF4444', radius: 4, damage: 1 },
                { x: e.x + 20, y: e.y + 25, vx: 70, vy: 220, team: 'enemy', color: '#EF4444', radius: 4, damage: 1 }
              );
            }
          } else if (e.type === 'raider') {
            e.fireTimer -= dt;
            if (e.fireTimer <= 0) {
              e.fireTimer = 2.0;
              bulletsRef.current.push({
                x: e.x,
                y: e.y + 15,
                vx: 0,
                vy: 220,
                team: 'enemy',
                color: '#F87171',
                radius: 3.5,
                damage: 1,
              });
            }
          }

          // Offscreen check
          if (e.y > CANVAS_HEIGHT + 50) {
            enemiesRef.current.splice(i, 1);
            continue;
          }

          // Collision with Player ship
          const distToPlayer = Math.hypot(e.x - player.x, e.y - player.y);
          if (distToPlayer <= e.radius + player.radius) {
            handlePlayerHit();
            e.hp -= 50;
            if (e.hp <= 0 && e.type !== 'boss') {
              enemiesRef.current.splice(i, 1);
            }
          }
        }

        // Update Bullets
        for (let bIdx = bulletsRef.current.length - 1; bIdx >= 0; bIdx--) {
          const b = bulletsRef.current[bIdx];
          b.x += b.vx * dt;
          b.y += b.vy * dt;

          if (b.y < -10 || b.y > CANVAS_HEIGHT + 10 || b.x < -10 || b.x > CANVAS_WIDTH + 10) {
            bulletsRef.current.splice(bIdx, 1);
            continue;
          }

          if (b.team === 'player') {
            // Check hit against enemies
            for (let eIdx = enemiesRef.current.length - 1; eIdx >= 0; eIdx--) {
              const enemy = enemiesRef.current[eIdx];
              if (Math.hypot(b.x - enemy.x, b.y - enemy.y) <= enemy.radius + b.radius) {
                enemy.hp -= b.damage;
                bulletsRef.current.splice(bIdx, 1);

                // Hit particle
                particlesRef.current.push({
                  x: b.x,
                  y: b.y,
                  vx: (Math.random() - 0.5) * 60,
                  vy: (Math.random() - 0.5) * 60,
                  radius: 2,
                  color: '#38BDF8',
                  life: 0,
                  maxLife: 0.15,
                });

                if (enemy.hp <= 0) {
                  sound.playSpaceExplode();
                  spawnExplosion(enemy.x, enemy.y, enemy.type === 'boss' ? '#F59E0B' : '#EC4899', enemy.type === 'boss' ? 40 : 15);
                  setScore(prev => {
                    const next = prev + enemy.scoreValue;
                    if (next > highScore) {
                      setHighScore(next);
                      localStorage.setItem('space_defender_high_score', next.toString());
                    }
                    return next;
                  });

                  if (enemy.type === 'boss') {
                    isBossActiveRef.current = false;
                    setWave(w => w + 1);
                    setEmpBombs(bomb => Math.min(3, bomb + 1));
                  }

                  // Chance to drop power-up (22%)
                  if (Math.random() < 0.22) {
                    const pTypes: PowerUp['type'][] = ['shield', 'triple', 'bomb', 'rapid'];
                    powerUpsRef.current.push({
                      x: enemy.x,
                      y: enemy.y,
                      vy: 110,
                      type: pTypes[Math.floor(Math.random() * pTypes.length)],
                      radius: 12,
                    });
                  }

                  enemiesRef.current.splice(eIdx, 1);
                }
                break;
              }
            }
          } else {
            // Enemy bullet hit player
            if (Math.hypot(b.x - player.x, b.y - player.y) <= player.radius + b.radius) {
              bulletsRef.current.splice(bIdx, 1);
              handlePlayerHit();
            }
          }
        }

        // Update Power-ups
        for (let pIdx = powerUpsRef.current.length - 1; pIdx >= 0; pIdx--) {
          const pu = powerUpsRef.current[pIdx];
          pu.y += pu.vy * dt;

          if (pu.y > CANVAS_HEIGHT + 20) {
            powerUpsRef.current.splice(pIdx, 1);
            continue;
          }

          if (Math.hypot(pu.x - player.x, pu.y - player.y) <= pu.radius + player.radius) {
            sound.playPowerup();
            if (pu.type === 'shield') {
              player.hasShield = true;
              setHasShield(true);
            } else if (pu.type === 'triple') {
              player.tripleShotTimer = 10;
            } else if (pu.type === 'rapid') {
              player.rapidFireTimer = 10;
            } else if (pu.type === 'bomb') {
              setEmpBombs(b => Math.min(3, b + 1));
            }
            powerUpsRef.current.splice(pIdx, 1);
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

      if (screenShakeRef.current > 0) {
        screenShakeRef.current = Math.max(0, screenShakeRef.current - dt * 30);
      }

      // RENDER
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          if (screenShakeRef.current > 0) {
            ctx.translate((Math.random() - 0.5) * screenShakeRef.current, (Math.random() - 0.5) * screenShakeRef.current);
          }
          renderSpaceScene(ctx);
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, wave, highScore, empBombs]);

  const handlePlayerHit = () => {
    const player = playerRef.current;
    if (player.hasShield) {
      player.hasShield = false;
      setHasShield(false);
      sound.playHit();
      screenShakeRef.current = 8;
      spawnExplosion(player.x, player.y, '#38BDF8', 12);
      return;
    }

    player.hp -= 1;
    setPlayerHp(player.hp);
    sound.playSpaceExplode();
    screenShakeRef.current = 14;
    spawnExplosion(player.x, player.y, '#EF4444', 18);

    if (player.hp <= 0) {
      setGameState('GAMEOVER');
    }
  };

  // Canvas Renderer
  const renderSpaceScene = (ctx: CanvasRenderingContext2D) => {
    // 1. Deep Space
    ctx.fillStyle = '#050711';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Starfield
    starsRef.current.forEach(star => {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    });

    // 3. Bullets
    bulletsRef.current.forEach(b => {
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 4. Power-ups
    powerUpsRef.current.forEach(pu => {
      ctx.save();
      const color = pu.type === 'shield' ? '#38BDF8' : pu.type === 'triple' ? '#A855F7' : pu.type === 'bomb' ? '#EF4444' : '#F59E0B';
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pu.x, pu.y, pu.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pu.type === 'shield' ? '🛡️' : pu.type === 'triple' ? '🔫' : pu.type === 'bomb' ? '💣' : '⚡', pu.x, pu.y);
      ctx.restore();
    });

    // 5. Enemies
    enemiesRef.current.forEach(e => {
      ctx.save();
      if (e.type === 'boss') {
        // Boss mothership
        ctx.fillStyle = '#DC2626';
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();

        // Wings
        ctx.fillStyle = '#991B1B';
        ctx.beginPath();
        ctx.moveTo(e.x - e.radius - 20, e.y);
        ctx.lineTo(e.x, e.y - 20);
        ctx.lineTo(e.x + e.radius + 20, e.y);
        ctx.lineTo(e.x, e.y + e.radius);
        ctx.closePath();
        ctx.fill();

        // Boss HP Bar
        const barW = 120;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(e.x - barW / 2, e.y - e.radius - 16, barW, 6);
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(e.x - barW / 2, e.y - e.radius - 16, barW * (e.hp / e.maxHp), 6);
      } else if (e.type === 'asteroid') {
        ctx.fillStyle = '#78716C';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#44403C';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Raider / Scout ship
        ctx.fillStyle = e.type === 'raider' ? '#EA580C' : '#9333EA';
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + e.radius);
        ctx.lineTo(e.x - e.radius, e.y - e.radius);
        ctx.lineTo(e.x + e.radius, e.y - e.radius);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });

    // 6. Player Ship
    const player = playerRef.current;
    if (gameState === 'PLAYING') {
      ctx.save();
      // Thruster flame particles
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(player.x, player.y + 18, 4 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();

      // Spaceship Body
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - player.radius);
      ctx.lineTo(player.x - player.radius, player.y + player.radius);
      ctx.lineTo(player.x, player.y + player.radius * 0.6);
      ctx.lineTo(player.x + player.radius, player.y + player.radius);
      ctx.closePath();
      ctx.fill();

      // Cockpit
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(player.x, player.y - 2, 4, 0, Math.PI * 2);
      ctx.fill();

      // Shield Bubble
      if (player.hasShield) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 7. Particles
    particlesRef.current.forEach(pt => {
      ctx.save();
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  };

  return (
    <div className="flex flex-col xl:flex-row items-center justify-center gap-6 w-full max-w-5xl mx-auto py-2">
      {/* CANVAS ARENA */}
      <div className="flex flex-col items-center">
        {/* HUD Top Bar */}
        <div className="w-[480px] max-w-full bg-slate-900/90 border border-slate-800 rounded-t-xl px-4 py-2.5 flex items-center justify-between text-xs font-semibold">
          {/* Hearts & Shield */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-base">
              {[...Array(3)].map((_, i) => (
                <span key={i} className={i < playerHp ? 'opacity-100' : 'opacity-25 grayscale'}>
                  ❤️
                </span>
              ))}
            </span>
            {hasShield && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-sky-950 border border-sky-500/50 text-sky-400 text-[10px] font-bold">
                <Shield className="w-3 h-3" /> Kalkan
              </span>
            )}
          </div>

          {/* Wave & Score */}
          <div className="flex items-center gap-4">
            <span className="text-slate-300">
              Dalga <strong className="text-amber-400 font-mono-num">{wave}</strong>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Skor:</span>
              <span className="font-mono-num text-base font-bold text-sky-400">{score}</span>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="relative border-x border-slate-800 shadow-2xl overflow-hidden cursor-crosshair">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onPointerMove={handlePointerMove}
            className="w-[360px] sm:w-[440px] md:w-[480px] h-auto aspect-[480/640] block touch-none"
          />

          {/* Menu Overlay */}
          {gameState === 'MENU' && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-sky-500/20 mb-3">
                <span className="text-3xl">🚀</span>
              </div>
              <h2 className="text-2xl font-cinzel font-bold text-sky-400 mb-1 tracking-wide">
                UZAY AKINCISI
              </h2>
              <p className="text-xs text-slate-300 max-w-xs mb-5">
                Galaktik istilaya karşı lazerlerini ateşle, güçlendirmeleri topla ve devasa ana gemileri yok et!
              </p>

              <button
                onClick={startGame}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-sky-500/30 transition-transform active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                Görevi Başlat
              </button>
            </div>
          )}

          {/* Game Over Modal */}
          {gameState === 'GAMEOVER' && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
              <span className="text-4xl mb-2">🚀💥</span>
              <h2 className="text-2xl font-bold text-rose-400 mb-1">GEMİN İMHA EDİLDİ</h2>
              <p className="text-xs text-slate-400 mb-4">Galaksinin derinliklerinde kayboldun!</p>

              <div className="bg-slate-900 border border-slate-800 rounded-xl px-6 py-3 mb-5 flex items-center gap-6">
                <div>
                  <span className="text-[11px] text-slate-400 block">Puan</span>
                  <span className="text-xl font-bold text-sky-400">{score}</span>
                </div>
                <div className="border-l border-slate-800 pl-6">
                  <span className="text-[11px] text-slate-400 block">Ulaşılan Dalga</span>
                  <span className="text-xl font-bold text-amber-400">{wave}</span>
                </div>
              </div>

              <button
                onClick={startGame}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-sky-500/30 transition-transform active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Tekrar Dene
              </button>
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="w-[480px] max-w-full bg-slate-900/95 border-x border-b border-slate-800 rounded-b-xl p-3 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>Hareket: Fare / Dokunma veya WASD</span>
          </div>

          {/* EMP Bomb Button */}
          <button
            onClick={triggerEmpBomb}
            disabled={empBombs <= 0 || gameState !== 'PLAYING'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-all ${
              empBombs > 0 && gameState === 'PLAYING'
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 active:scale-95'
                : 'bg-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
            }`}
          >
            <Bomb className="w-3.5 h-3.5" />
            EMP Bomba ({empBombs}) [B]
          </button>
        </div>
      </div>

      {/* RIGHT SIDEBAR GUIDE */}
      <div className="w-full xl:w-72 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 text-xs text-slate-300">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Info className="w-4 h-4 text-sky-400 shrink-0" />
          <h3 className="font-bold text-slate-100 text-sm">Gemi & Güç Donanımları</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-2.5">
            <span className="text-xl">🔫</span>
            <div>
              <div className="font-semibold text-purple-400">Üçlü Plazma Lazer</div>
              <p className="text-slate-400 text-[11px]">Geniş açılı 3 yönlü eşzamanlı lazer yağmuru başlatır.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="text-xl">🛡️</span>
            <div>
              <div className="font-semibold text-sky-400">Plazma Kalkanı</div>
              <p className="text-slate-400 text-[11px]">Gövdeyi bir sonraki ölümcül düşman darbesine karşı korur.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="text-xl">💣</span>
            <div>
              <div className="font-semibold text-rose-400">EMP Süper Bomba</div>
              <p className="text-slate-400 text-[11px]">Tüm ekrandaki mermileri ve standart düşmanları anında yok eder.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="text-xl">⚡</span>
            <div>
              <div className="font-semibold text-amber-400">Aşırı Hızlı Ateş</div>
              <p className="text-slate-400 text-[11px]">Lazer atış hızını 2 katına çıkarır.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-amber-400" /> En Yüksek Skor:</span>
            <span className="font-mono-num font-bold text-amber-400">{highScore}</span>
          </div>
        </div>

        {gameState === 'PLAYING' && (
          <button
            onClick={startGame}
            className="mt-2 w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Yeniden Başlat
          </button>
        )}
      </div>
    </div>
  );
};
