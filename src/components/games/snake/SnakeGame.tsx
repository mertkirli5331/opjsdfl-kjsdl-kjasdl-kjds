import React, { useEffect, useRef, useState, useCallback } from 'react';
import { sound } from '../../../utils/audio';
import { Play, RotateCcw, Pause, Trophy, Sparkles, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Zap, Info } from 'lucide-react';

const GRID_SIZE = 20; // 20x20 cells
const CANVAS_SIZE = 480;
const CELL_SIZE = CANVAS_SIZE / GRID_SIZE; // 24px

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type FoodType = 'APPLE' | 'GOLDEN_STAR' | 'FREEZE' | 'LIGHTNING';
type GameMode = 'CLASSIC' | 'PORTAL' | 'OBSTACLES';

interface Point {
  x: number;
  y: number;
}

interface FoodItem {
  x: number;
  y: number;
  type: FoodType;
  timer?: number; // expiry countdown for special items
}

export const SnakeGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Game state
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'>('MENU');
  const [mode, setMode] = useState<GameMode>('CLASSIC');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    return parseInt(localStorage.getItem('neon_snake_high_score') || '0', 10);
  });
  const [multiplier, setMultiplier] = useState<number>(1);
  const [multiplierTimer, setMultiplierTimer] = useState<number>(0);
  const [snakeLength, setSnakeLength] = useState<number>(3);

  // Snake simulation state in refs
  const snakeRef = useRef<Point[]>([
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]);
  const directionRef = useRef<Direction>('RIGHT');
  const nextDirectionRef = useRef<Direction>('RIGHT');
  const foodRef = useRef<FoodItem>({ x: 15, y: 10, type: 'APPLE' });
  const bonusFoodRef = useRef<FoodItem | null>(null);
  const obstaclesRef = useRef<Point[]>([]);
  const speedRef = useRef<number>(120); // ms per step
  const stepTimerRef = useRef<number>(0);
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; color: string; life: number; maxLife: number }>>([]);

  // Initialize obstacles if mode is OBSTACLES
  const generateObstacles = () => {
    const obs: Point[] = [];
    // 4 neat energy barrier clusters away from spawn
    const clusters = [
      { startX: 4, startY: 4, len: 4, vert: false },
      { startX: 12, startY: 4, len: 4, vert: true },
      { startX: 4, startY: 15, len: 4, vert: true },
      { startX: 12, startY: 15, len: 4, vert: false },
    ];
    clusters.forEach(c => {
      for (let i = 0; i < c.len; i++) {
        obs.push({
          x: c.vert ? c.startX : c.startX + i,
          y: c.vert ? c.startY + i : c.startY,
        });
      }
    });
    obstaclesRef.current = obs;
  };

  const spawnFood = (isBonus = false): FoodItem => {
    let newX = 0;
    let newY = 0;
    let valid = false;

    while (!valid) {
      newX = Math.floor(Math.random() * GRID_SIZE);
      newY = Math.floor(Math.random() * GRID_SIZE);

      const inSnake = snakeRef.current.some(s => s.x === newX && s.y === newY);
      const inObs = obstaclesRef.current.some(o => o.x === newX && o.y === newY);
      const inMainFood = foodRef.current && foodRef.current.x === newX && foodRef.current.y === newY;

      if (!inSnake && !inObs && !inMainFood) {
        valid = true;
      }
    }

    if (isBonus) {
      const types: FoodType[] = ['GOLDEN_STAR', 'FREEZE', 'LIGHTNING'];
      const randType = types[Math.floor(Math.random() * types.length)];
      return { x: newX, y: newY, type: randType, timer: 12 }; // lasts 12 seconds
    }

    return { x: newX, y: newY, type: 'APPLE' };
  };

  const startGame = () => {
    sound.playClick();
    snakeRef.current = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    directionRef.current = 'RIGHT';
    nextDirectionRef.current = 'RIGHT';
    speedRef.current = 120;
    setScore(0);
    setMultiplier(1);
    setMultiplierTimer(0);
    setSnakeLength(3);
    particlesRef.current = [];

    if (mode === 'OBSTACLES') {
      generateObstacles();
    } else {
      obstaclesRef.current = [];
    }

    foodRef.current = spawnFood(false);
    bonusFoodRef.current = null;

    setGameState('PLAYING');
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'PLAYING') return;

      const current = directionRef.current;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (current !== 'DOWN') nextDirectionRef.current = 'UP';
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (current !== 'UP') nextDirectionRef.current = 'DOWN';
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (current !== 'RIGHT') nextDirectionRef.current = 'LEFT';
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (current !== 'LEFT') nextDirectionRef.current = 'RIGHT';
          e.preventDefault();
          break;
        case ' ':
          setGameState(prev => (prev === 'PLAYING' ? 'PAUSED' : 'PLAYING'));
          e.preventDefault();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // Touch / Button Navigation Handler
  const handleDirectionInput = (newDir: Direction) => {
    sound.playClick();
    const current = directionRef.current;
    if (newDir === 'UP' && current !== 'DOWN') nextDirectionRef.current = 'UP';
    if (newDir === 'DOWN' && current !== 'UP') nextDirectionRef.current = 'DOWN';
    if (newDir === 'LEFT' && current !== 'RIGHT') nextDirectionRef.current = 'LEFT';
    if (newDir === 'RIGHT' && current !== 'LEFT') nextDirectionRef.current = 'RIGHT';
  };

  // Main Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (gameState === 'PLAYING') {
        // Multiplier timer
        if (multiplierTimer > 0) {
          setMultiplierTimer(prev => {
            const next = prev - dt;
            if (next <= 0) {
              setMultiplier(1);
              return 0;
            }
            return next;
          });
        }

        // Bonus food countdown
        if (bonusFoodRef.current && bonusFoodRef.current.timer) {
          bonusFoodRef.current.timer -= dt;
          if (bonusFoodRef.current.timer <= 0) {
            bonusFoodRef.current = null;
          }
        } else if (!bonusFoodRef.current && Math.random() < 0.003) {
          // 0.3% chance per frame to spawn bonus powerup
          bonusFoodRef.current = spawnFood(true);
        }

        // Step snake
        stepTimerRef.current += dt * 1000;
        if (stepTimerRef.current >= speedRef.current) {
          stepTimerRef.current = 0;
          directionRef.current = nextDirectionRef.current;

          const head = { ...snakeRef.current[0] };
          switch (directionRef.current) {
            case 'UP':
              head.y -= 1;
              break;
            case 'DOWN':
              head.y += 1;
              break;
            case 'LEFT':
              head.x -= 1;
              break;
            case 'RIGHT':
              head.x += 1;
              break;
          }

          // Boundary checks
          if (mode === 'PORTAL') {
            if (head.x < 0) head.x = GRID_SIZE - 1;
            if (head.x >= GRID_SIZE) head.x = 0;
            if (head.y < 0) head.y = GRID_SIZE - 1;
            if (head.y >= GRID_SIZE) head.y = 0;
          } else {
            if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
              // Hit wall!
              triggerGameOver();
              return;
            }
          }

          // Obstacle check
          if (obstaclesRef.current.some(o => o.x === head.x && o.y === head.y)) {
            triggerGameOver();
            return;
          }

          // Self bite check
          if (snakeRef.current.some(segment => segment.x === head.x && segment.y === head.y)) {
            triggerGameOver();
            return;
          }

          // Move snake
          const newSnake = [head, ...snakeRef.current];

          // Check main food eat
          let ate = false;
          if (foodRef.current && head.x === foodRef.current.x && head.y === foodRef.current.y) {
            ate = true;
            sound.playSnakeEat();
            const pointsGained = 100 * multiplier;
            setScore(prev => {
              const updated = prev + pointsGained;
              if (updated > highScore) {
                setHighScore(updated);
                localStorage.setItem('neon_snake_high_score', updated.toString());
              }
              return updated;
            });
            setSnakeLength(newSnake.length);
            foodRef.current = spawnFood(false);

            // Speed up slightly as snake gets longer (min 60ms)
            speedRef.current = Math.max(65, 120 - Math.floor(newSnake.length * 1.5));

            // Particles
            spawnEatParticles(head.x * CELL_SIZE + CELL_SIZE / 2, head.y * CELL_SIZE + CELL_SIZE / 2, '#10B981');
          }

          // Check bonus food eat
          if (bonusFoodRef.current && head.x === bonusFoodRef.current.x && head.y === bonusFoodRef.current.y) {
            ate = true;
            sound.playSnakePowerup();
            const b = bonusFoodRef.current;
            if (b.type === 'GOLDEN_STAR') {
              setMultiplier(2);
              setMultiplierTimer(10);
              setScore(prev => prev + 300);
              spawnEatParticles(head.x * CELL_SIZE + CELL_SIZE / 2, head.y * CELL_SIZE + CELL_SIZE / 2, '#F59E0B');
            } else if (b.type === 'FREEZE') {
              speedRef.current = 150; // slowdown
              setScore(prev => prev + 150);
              spawnEatParticles(head.x * CELL_SIZE + CELL_SIZE / 2, head.y * CELL_SIZE + CELL_SIZE / 2, '#38BDF8');
            } else if (b.type === 'LIGHTNING') {
              setScore(prev => prev + 500);
              spawnEatParticles(head.x * CELL_SIZE + CELL_SIZE / 2, head.y * CELL_SIZE + CELL_SIZE / 2, '#EC4899');
            }
            bonusFoodRef.current = null;
          }

          if (!ate) {
            newSnake.pop();
          }

          snakeRef.current = newSnake;
        }
      }

      // Update particles
      for (let p = particlesRef.current.length - 1; p >= 0; p--) {
        const pt = particlesRef.current[p];
        pt.life += dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (pt.life >= pt.maxLife) {
          particlesRef.current.splice(p, 1);
        }
      }

      // Render
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderSnakeGame(ctx);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, mode, multiplier, multiplierTimer, highScore]);

  const triggerGameOver = () => {
    sound.playSnakeDie();
    setGameState('GAMEOVER');
  };

  const spawnEatParticles = (px: number, py: number, color: string) => {
    for (let i = 0; i < 14; i++) {
      particlesRef.current.push({
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * 120,
        vy: (Math.random() - 0.5) * 120,
        color,
        life: 0,
        maxLife: 0.4,
      });
    }
  };

  // Rendering
  const renderSnakeGame = (ctx: CanvasRenderingContext2D) => {
    // 1. Dark Grid Background
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Subtle Grid Lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    // 2. Obstacles (if any)
    obstaclesRef.current.forEach(obs => {
      ctx.fillStyle = '#EF4444';
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 8;
      ctx.fillRect(obs.x * CELL_SIZE + 2, obs.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      ctx.shadowBlur = 0;
    });

    // 3. Main Food (Neon Emerald Apple)
    if (foodRef.current) {
      const fx = foodRef.current.x * CELL_SIZE + CELL_SIZE / 2;
      const fy = foodRef.current.y * CELL_SIZE + CELL_SIZE / 2;

      ctx.save();
      ctx.shadowColor = '#10B981';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(fx, fy, CELL_SIZE * 0.38, 0, Math.PI * 2);
      ctx.fill();

      // Core glow
      ctx.fillStyle = '#A7F3D0';
      ctx.beginPath();
      ctx.arc(fx, fy, CELL_SIZE * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Bonus Powerup Food
    if (bonusFoodRef.current) {
      const bx = bonusFoodRef.current.x * CELL_SIZE + CELL_SIZE / 2;
      const by = bonusFoodRef.current.y * CELL_SIZE + CELL_SIZE / 2;
      const bType = bonusFoodRef.current.type;

      ctx.save();
      const color = bType === 'GOLDEN_STAR' ? '#F59E0B' : bType === 'FREEZE' ? '#38BDF8' : '#EC4899';
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(bx, by, CELL_SIZE * 0.42, 0, Math.PI * 2);
      ctx.fill();

      // Icon text
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bType === 'GOLDEN_STAR' ? '⭐' : bType === 'FREEZE' ? '❄️' : '⚡', bx, by);
      ctx.restore();
    }

    // 5. Snake Body & Head
    const snake = snakeRef.current;
    snake.forEach((segment, idx) => {
      const sx = segment.x * CELL_SIZE;
      const sy = segment.y * CELL_SIZE;

      ctx.save();
      if (idx === 0) {
        // HEAD
        ctx.fillStyle = '#06B6D4';
        ctx.shadowColor = '#06B6D4';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.roundRect(sx + 1, sy + 1, CELL_SIZE - 2, CELL_SIZE - 2, 6);
        ctx.fill();

        // Eyes based on direction
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowBlur = 0;
        let eye1X = sx + 6;
        let eye1Y = sy + 6;
        let eye2X = sx + CELL_SIZE - 6;
        let eye2Y = sy + 6;

        if (directionRef.current === 'DOWN') {
          eye1Y = sy + CELL_SIZE - 6;
          eye2Y = sy + CELL_SIZE - 6;
        } else if (directionRef.current === 'LEFT') {
          eye1X = sx + 6;
          eye1Y = sy + 6;
          eye2X = sx + 6;
          eye2Y = sy + CELL_SIZE - 6;
        } else if (directionRef.current === 'RIGHT') {
          eye1X = sx + CELL_SIZE - 6;
          eye1Y = sy + 6;
          eye2X = sx + CELL_SIZE - 6;
          eye2Y = sy + CELL_SIZE - 6;
        }

        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, 2.5, 0, Math.PI * 2);
        ctx.arc(eye2X, eye2Y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // BODY
        const colorRatio = idx / Math.max(1, snake.length);
        const r = Math.round(6 + (59 - 6) * colorRatio);
        const g = Math.round(182 - 60 * colorRatio);
        const b = Math.round(212 + 20 * colorRatio);

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.roundRect(sx + 2, sy + 2, CELL_SIZE - 4, CELL_SIZE - 4, 4);
        ctx.fill();
      }
      ctx.restore();
    });

    // 6. Particles
    particlesRef.current.forEach(pt => {
      ctx.save();
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  };

  return (
    <div className="flex flex-col xl:flex-row items-center justify-center gap-6 w-full max-w-5xl mx-auto py-2">
      {/* CANVAS & CONTROLS */}
      <div className="flex flex-col items-center">
        {/* Top HUD */}
        <div className="w-[480px] max-w-full bg-slate-900/90 border border-slate-800 rounded-t-xl px-4 py-2.5 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-3">
            <span className="text-slate-400">Skor:</span>
            <span className="font-mono-num text-base font-bold text-emerald-400">{score}</span>
            {multiplier > 1 && (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] flex items-center gap-0.5 border border-amber-500/30">
                <Zap className="w-3 h-3 text-amber-400" /> {multiplier}X ({Math.ceil(multiplierTimer)}s)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-slate-300">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Rekor:</span>
            <span className="font-mono-num text-sm font-bold text-amber-400">{highScore}</span>
          </div>
        </div>

        {/* Canvas */}
        <div className="relative border-x border-slate-800 shadow-2xl overflow-hidden">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="w-[360px] sm:w-[440px] md:w-[480px] h-auto aspect-square block touch-none"
          />

          {/* Menu Overlay */}
          {gameState === 'MENU' && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-3">
                <span className="text-3xl">🐍</span>
              </div>
              <h2 className="text-2xl font-bold text-emerald-400 mb-1 tracking-wide">
                NEON YILAN
              </h2>
              <p className="text-xs text-slate-300 max-w-xs mb-4">
                Neon elmaları topla, büyüdükçe hızlan ve özel bonus güçlendirmelerle rekor kır!
              </p>

              {/* Mode Selection */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg mb-5">
                {(['CLASSIC', 'PORTAL', 'OBSTACLES'] as GameMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => {
                      sound.playClick();
                      setMode(m);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      mode === m
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m === 'CLASSIC' ? 'Klasik' : m === 'PORTAL' ? 'Işınlanma' : 'Engelli'}
                  </button>
                ))}
              </div>

              <button
                onClick={startGame}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/30 transition-transform active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                Oyuna Başla
              </button>
            </div>
          )}

          {/* Game Over Modal */}
          {gameState === 'GAMEOVER' && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
              <span className="text-4xl mb-2">💥</span>
              <h2 className="text-2xl font-bold text-rose-400 mb-1">OYUN BİTTİ</h2>
              <p className="text-xs text-slate-400 mb-4">Kendine veya sınırlara çarptın!</p>

              <div className="bg-slate-900 border border-slate-800 rounded-xl px-6 py-3 mb-5 flex items-center gap-6">
                <div>
                  <span className="text-[11px] text-slate-400 block">Puan</span>
                  <span className="text-xl font-bold text-emerald-400">{score}</span>
                </div>
                <div className="border-l border-slate-800 pl-6">
                  <span className="text-[11px] text-slate-400 block">Uzunluk</span>
                  <span className="text-xl font-bold text-white">{snakeLength}</span>
                </div>
              </div>

              <button
                onClick={startGame}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/30 transition-transform active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Tekrar Dene
              </button>
            </div>
          )}
        </div>

        {/* Bottom Control Bar / D-Pad for Mobile & Touch */}
        <div className="w-[480px] max-w-full bg-slate-900/95 border-x border-b border-slate-800 rounded-b-xl p-3 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>Kontroller:</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 text-[10px]">W/A/S/D</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 text-[10px]">Ok Tuşları</span>
          </div>

          {/* D-Pad Buttons */}
          <div className="grid grid-cols-3 gap-1 w-32">
            <div />
            <button
              onClick={() => handleDirectionInput('UP')}
              className="h-8 bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 text-slate-200 rounded flex items-center justify-center cursor-pointer transition-colors"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <div />
            <button
              onClick={() => handleDirectionInput('LEFT')}
              className="h-8 bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 text-slate-200 rounded flex items-center justify-center cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDirectionInput('DOWN')}
              className="h-8 bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 text-slate-200 rounded flex items-center justify-center cursor-pointer transition-colors"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDirectionInput('RIGHT')}
              className="h-8 bg-slate-800 hover:bg-slate-700 active:bg-emerald-600 text-slate-200 rounded flex items-center justify-center cursor-pointer transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* SIDEBAR GUIDE & ITEM DETAILS */}
      <div className="w-full xl:w-72 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 text-xs text-slate-300">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Info className="w-4 h-4 text-emerald-400 shrink-0" />
          <h3 className="font-bold text-slate-100 text-sm">Özel Güçlendirmeler</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-2.5">
            <span className="text-xl">🍏</span>
            <div>
              <div className="font-semibold text-emerald-400">Neon Elma</div>
              <p className="text-slate-400 text-[11px]">+100 Puan kazandırır ve boyunu uzatır.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="text-xl">⭐</span>
            <div>
              <div className="font-semibold text-amber-400">Altın Yıldız (2X)</div>
              <p className="text-slate-400 text-[11px]">+300 Puan ve 10 saniye boyunca çifte skor çarpanı sağlar.</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="text-xl">❄️</span>
            <div>
              <div className="font-semibold text-sky-400">Buz Kristali</div>
              <p className="text-slate-400 text-[11px]">Yılanın hızını güvenli bir seviyeye düşürür (+150 Puan).</p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="text-xl">⚡</span>
            <div>
              <div className="font-semibold text-pink-400">Işık Şimşeği</div>
              <p className="text-slate-400 text-[11px]">+500 Bonus Puan ekler.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-3">
          <h4 className="font-semibold text-slate-200 mb-2">Oyun Modları</h4>
          <div className="space-y-1.5 text-[11px] text-slate-400">
            <div><strong className="text-slate-200">Klasik:</strong> Duvarlara ve kendine çarpmaktan kaçın.</div>
            <div><strong className="text-slate-200">Işınlanma:</strong> Kenarlardan geçerek karşı taraftan çıkabilirsin.</div>
            <div><strong className="text-slate-200">Engelli:</strong> Haritada beliren kırmızı lazer bariyerlerine dikkat et.</div>
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
