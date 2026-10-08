import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CardDef, CardId, DamageNumber, Particle, Projectile, Tower, Unit } from './types';
import { CARD_DEFINITIONS, ALL_CARD_IDS } from './cards';
import { sound } from '../../../utils/audio';
import { Crown, Play, RotateCcw, Zap, Sparkles, Volume2, VolumeX, Shield, Swords, Info } from 'lucide-react';

const ARENA_WIDTH = 480;
const ARENA_HEIGHT = 680;
const RIVER_Y = 340;
const LEFT_BRIDGE_X = 110;
const RIGHT_BRIDGE_X = 370;
const BRIDGE_HALF_WIDTH = 34;

export const ClashRoyaleGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Match State
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'GAMEOVER'>('MENU');
  const [matchTime, setMatchTime] = useState<number>(180); // 3 minutes
  const [isDoubleElixir, setIsDoubleElixir] = useState<boolean>(false);
  const [playerCrowns, setPlayerCrowns] = useState<number>(0);
  const [enemyCrowns, setEnemyCrowns] = useState<number>(0);
  const [winner, setWinner] = useState<'player' | 'enemy' | 'draw' | null>(null);

  // Deck & Hand
  const [playerHand, setPlayerHand] = useState<CardId[]>(['knight', 'archers', 'giant', 'fireball']);
  const [nextCard, setNextCard] = useState<CardId>('skeleton_army');
  const [deckPool, setDeckPool] = useState<CardId[]>([...ALL_CARD_IDS]);
  const [selectedCardId, setSelectedCardId] = useState<CardId | null>(null);

  // Elixir
  const [playerElixir, setPlayerElixir] = useState<number>(6);
  const enemyElixirRef = useRef<number>(6);

  // Sound state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(sound.enabled);

  // Simulation Refs
  const unitsRef = useRef<Unit[]>([]);
  const towersRef = useRef<Tower[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const damageNumbersRef = useRef<DamageNumber[]>([]);
  const aiCooldownRef = useRef<number>(2.0); // AI action cooldown in seconds
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const lastTimeRef = useRef<number>(0);
  const screenShakeRef = useRef<number>(0);

  // Helper to initialize towers
  const initTowers = (): Tower[] => [
    // Enemy (top)
    {
      id: 'enemy_king',
      type: 'king',
      team: 'enemy',
      x: ARENA_WIDTH / 2,
      y: 75,
      hp: 4200,
      maxHp: 4200,
      range: 175,
      damage: 120,
      attackSpeed: 1.0,
      lastAttackTime: 0,
      activated: false,
      radius: 32,
    },
    {
      id: 'enemy_left',
      type: 'princess_left',
      team: 'enemy',
      x: LEFT_BRIDGE_X,
      y: 155,
      hp: 2500,
      maxHp: 2500,
      range: 160,
      damage: 90,
      attackSpeed: 0.8,
      lastAttackTime: 0,
      activated: true,
      radius: 26,
    },
    {
      id: 'enemy_right',
      type: 'princess_right',
      team: 'enemy',
      x: RIGHT_BRIDGE_X,
      y: 155,
      hp: 2500,
      maxHp: 2500,
      range: 160,
      damage: 90,
      attackSpeed: 0.8,
      lastAttackTime: 0,
      activated: true,
      radius: 26,
    },
    // Player (bottom)
    {
      id: 'player_king',
      type: 'king',
      team: 'player',
      x: ARENA_WIDTH / 2,
      y: 605,
      hp: 4200,
      maxHp: 4200,
      range: 175,
      damage: 120,
      attackSpeed: 1.0,
      lastAttackTime: 0,
      activated: false,
      radius: 32,
    },
    {
      id: 'player_left',
      type: 'princess_left',
      team: 'player',
      x: LEFT_BRIDGE_X,
      y: 525,
      hp: 2500,
      maxHp: 2500,
      range: 160,
      damage: 90,
      attackSpeed: 0.8,
      lastAttackTime: 0,
      activated: true,
      radius: 26,
    },
    {
      id: 'player_right',
      type: 'princess_right',
      team: 'player',
      x: RIGHT_BRIDGE_X,
      y: 525,
      hp: 2500,
      maxHp: 2500,
      range: 160,
      damage: 90,
      attackSpeed: 0.8,
      lastAttackTime: 0,
      activated: true,
      radius: 26,
    },
  ];

  const startMatch = () => {
    sound.playClick();
    unitsRef.current = [];
    towersRef.current = initTowers();
    projectilesRef.current = [];
    particlesRef.current = [];
    damageNumbersRef.current = [];
    setPlayerElixir(6);
    enemyElixirRef.current = 6;
    setPlayerCrowns(0);
    setEnemyCrowns(0);
    setMatchTime(180);
    setIsDoubleElixir(false);
    setWinner(null);
    setSelectedCardId(null);

    // Shuffle and pick 4 cards + next card
    const shuffled = [...ALL_CARD_IDS].sort(() => Math.random() - 0.5);
    setPlayerHand(shuffled.slice(0, 4));
    setNextCard(shuffled[4]);
    setDeckPool(shuffled.slice(5));

    setGameState('PLAYING');
  };

  // Check valid deploy area
  const isValidDeployArea = useCallback((cardDef: CardDef, x: number, y: number): boolean => {
    if (cardDef.type === 'spell') return true; // Spells deploy anywhere

    // Check bounds
    if (x < 20 || x > ARENA_WIDTH - 20) return false;

    // Normal player territory is below the river
    if (y >= RIVER_Y + 15 && y <= ARENA_HEIGHT - 35) return true;

    // Can deploy across river if enemy princess towers are down!
    const enemyLeftDead = !towersRef.current.some(t => t.id === 'enemy_left' && t.hp > 0);
    const enemyRightDead = !towersRef.current.some(t => t.id === 'enemy_right' && t.hp > 0);

    if (enemyLeftDead && x < ARENA_WIDTH / 2 && y >= 200 && y <= RIVER_Y) return true;
    if (enemyRightDead && x >= ARENA_WIDTH / 2 && y >= 200 && y <= RIVER_Y) return true;

    return false;
  }, []);

  // Deploy troop units
  const deployCard = useCallback((cardId: CardId, x: number, y: number, team: 'player' | 'enemy') => {
    const cardDef = CARD_DEFINITIONS[cardId];
    if (!cardDef) return;

    if (cardDef.type === 'spell') {
      sound.playFireball();
      // Add fireball projectile arcing to target
      const startX = team === 'player' ? ARENA_WIDTH / 2 : ARENA_WIDTH / 2;
      const startY = team === 'player' ? 620 : 60;
      projectilesRef.current.push({
        id: Math.random().toString(),
        x: startX,
        y: startY,
        startX,
        startY,
        targetX: x,
        targetY: y,
        speed: 380,
        damage: cardDef.damage,
        isSplash: true,
        splashRadius: cardDef.splashRadius || 70,
        team,
        type: 'fireball',
        color: '#F97316',
        progress: 0,
      });
      return;
    }

    sound.playCardDeploy();

    // Spawn unit or unit group
    const count = cardDef.count;
    for (let i = 0; i < count; i++) {
      let offsetX = 0;
      let offsetY = 0;
      if (count > 1) {
        const angle = (i / count) * Math.PI * 2;
        const dist = 18 + Math.random() * 8;
        offsetX = Math.cos(angle) * dist;
        offsetY = Math.sin(angle) * dist;
      }

      const spawnX = Math.max(25, Math.min(ARENA_WIDTH - 25, x + offsetX));
      const spawnY = Math.max(25, Math.min(ARENA_HEIGHT - 25, y + offsetY));

      const newUnit: Unit = {
        id: `${cardId}_${team}_${Date.now()}_${i}_${Math.random()}`,
        cardId,
        team,
        x: spawnX,
        y: spawnY,
        hp: cardDef.hp,
        maxHp: cardDef.hp,
        damage: cardDef.damage,
        speed: cardDef.speed * 48, // pixels per second
        range: cardDef.range,
        attackSpeed: cardDef.attackSpeed,
        lastAttackTime: 0,
        targets: cardDef.targets,
        isFlying: !!cardDef.isFlying,
        isSplash: !!cardDef.isSplash,
        splashRadius: cardDef.splashRadius || 0,
        radius: cardDef.count > 2 ? 10 : cardDef.isFlying ? 16 : 14,
        color: cardDef.color,
        name: cardDef.nameTr,
        animFrame: 0,
      };

      unitsRef.current.push(newUnit);

      // Spawn puff particles
      for (let p = 0; p < 6; p++) {
        particlesRef.current.push({
          x: spawnX,
          y: spawnY,
          vx: (Math.random() - 0.5) * 60,
          vy: (Math.random() - 0.5) * 60,
          radius: 2 + Math.random() * 3,
          color: team === 'player' ? '#60A5FA' : '#F87171',
          alpha: 1,
          life: 0,
          maxLife: 0.35,
        });
      }
    }
  }, []);

  // Handle Player Card Selection and Deployment
  const handleArenaClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'PLAYING' || !selectedCardId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = ARENA_WIDTH / rect.width;
    const scaleY = ARENA_HEIGHT / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const cardDef = CARD_DEFINITIONS[selectedCardId];
    if (!cardDef) return;

    if (playerElixir < cardDef.elixir) {
      sound.playHit();
      return;
    }

    if (!isValidDeployArea(cardDef, clickX, clickY)) {
      sound.playHit();
      return;
    }

    // Spend elixir & deploy
    setPlayerElixir(prev => Math.max(0, prev - cardDef.elixir));
    deployCard(selectedCardId, clickX, clickY, 'player');

    // Cycle cards
    const currentIdx = playerHand.indexOf(selectedCardId);
    if (currentIdx !== -1) {
      const nextHand = [...playerHand];
      nextHand[currentIdx] = nextCard;
      const [newNext, ...restPool] = deckPool.length > 0 ? deckPool : [...ALL_CARD_IDS].sort(() => Math.random() - 0.5);
      setPlayerHand(nextHand);
      setNextCard(newNext);
      setDeckPool(restPool);
    }

    setSelectedCardId(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = ARENA_WIDTH / rect.width;
    const scaleY = ARENA_HEIGHT / rect.height;
    mousePosRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseLeave = () => {
    mousePosRef.current = null;
  };

  // AI Opponent Logic
  const runAiDecision = (dt: number) => {
    aiCooldownRef.current -= dt;
    if (aiCooldownRef.current > 0) return;

    aiCooldownRef.current = 1.2 + Math.random() * 1.5;

    const enemyElixir = enemyElixirRef.current;
    if (enemyElixir < 3) return;

    const activeTowers = towersRef.current.filter(t => t.team === 'enemy' && t.hp > 0);
    if (activeTowers.length === 0) return;

    const playerUnits = unitsRef.current.filter(u => u.team === 'player');
    const dangerousUnitsOnAiSide = playerUnits.filter(u => u.y < RIVER_Y + 80);

    // AI cards available
    const aiDeckOptions: CardId[] = ['giant', 'knight', 'archers', 'skeleton_army', 'wizard', 'fireball', 'baby_dragon', 'goblin_gang'];
    const affordable = aiDeckOptions.filter(c => CARD_DEFINITIONS[c].elixir <= enemyElixir);
    if (affordable.length === 0) return;

    let chosenCard: CardId = affordable[Math.floor(Math.random() * affordable.length)];
    let targetX = LEFT_BRIDGE_X;
    let targetY = 160;

    if (dangerousUnitsOnAiSide.length > 0) {
      // Counter incoming danger!
      const closest = dangerousUnitsOnAiSide.sort((a, b) => a.y - b.y)[0];
      targetX = closest.x;
      targetY = Math.max(90, closest.y - 45);

      if (dangerousUnitsOnAiSide.some(u => u.cardId === 'giant')) {
        if (affordable.includes('skeleton_army')) chosenCard = 'skeleton_army';
        else if (affordable.includes('knight')) chosenCard = 'knight';
      } else if (dangerousUnitsOnAiSide.length >= 3) {
        if (affordable.includes('fireball')) chosenCard = 'fireball';
        else if (affordable.includes('wizard')) chosenCard = 'wizard';
      }
    } else {
      // Aggressive push
      const targetBridge = Math.random() > 0.5 ? LEFT_BRIDGE_X : RIGHT_BRIDGE_X;
      targetX = targetBridge + (Math.random() - 0.5) * 30;
      targetY = 120 + Math.random() * 40;

      if (enemyElixir >= 7 && affordable.includes('giant')) {
        chosenCard = 'giant';
      } else if (affordable.includes('baby_dragon') && Math.random() > 0.5) {
        chosenCard = 'baby_dragon';
      }
    }

    const cardCost = CARD_DEFINITIONS[chosenCard].elixir;
    enemyElixirRef.current -= cardCost;
    deployCard(chosenCard, targetX, targetY, 'enemy');
  };

  // Main Game Loop (Simulation & Rendering)
  useEffect(() => {
    let animId: number;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    lastTimeRef.current = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min(0.1, (currentTime - lastTimeRef.current) / 1000);
      lastTimeRef.current = currentTime;

      if (gameState === 'PLAYING') {
        // 1. Elixir Generation (+1 elixir per ~2.8s normally, 1.4s in double elixir)
        const elixirRate = isDoubleElixir ? 0.72 : 0.36;
        setPlayerElixir(prev => Math.min(10, prev + elixirRate * dt));
        enemyElixirRef.current = Math.min(10, enemyElixirRef.current + elixirRate * dt);

        // 2. Match Timer
        setMatchTime(prev => {
          const next = prev - dt;
          if (next <= 60 && !isDoubleElixir) {
            setIsDoubleElixir(true);
          }
          if (next <= 0) {
            // Check end game crowns
            const pC = 3 - towersRef.current.filter(t => t.team === 'enemy' && t.hp > 0).length;
            const eC = 3 - towersRef.current.filter(t => t.team === 'player' && t.hp > 0).length;
            if (pC > eC) {
              setWinner('player');
              sound.playCrownDestroyed();
            } else if (eC > pC) {
              setWinner('enemy');
              sound.playCrownDestroyed();
            } else {
              setWinner('draw');
            }
            setGameState('GAMEOVER');
            return 0;
          }
          return next;
        });

        // 3. AI Opponent turn
        runAiDecision(dt);

        // 4. Update Towers
        towersRef.current.forEach(tower => {
          if (tower.hp <= 0) return;

          // Tower attack cooldown
          tower.lastAttackTime += dt;
          if (tower.lastAttackTime >= tower.attackSpeed) {
            // King tower activates only if damaged or princess tower fallen
            if (tower.type === 'king' && !tower.activated) {
              const enemyPrincessDead = towersRef.current.some(
                t => t.team === tower.team && t.type !== 'king' && t.hp <= 0
              );
              if (tower.hp < tower.maxHp || enemyPrincessDead) {
                tower.activated = true;
              } else {
                return;
              }
            }

            // Find closest enemy unit in range
            const targetTeam = tower.team === 'player' ? 'enemy' : 'player';
            const candidateUnits = unitsRef.current.filter(
              u => u.team === targetTeam && Math.hypot(u.x - tower.x, u.y - tower.y) <= tower.range
            );

            if (candidateUnits.length > 0) {
              // Target closest
              candidateUnits.sort((a, b) => Math.hypot(a.x - tower.x, a.y - tower.y) - Math.hypot(b.x - tower.x, b.y - tower.y));
              const target = candidateUnits[0];

              tower.lastAttackTime = 0;
              sound.playTowerShoot();

              projectilesRef.current.push({
                id: Math.random().toString(),
                startX: tower.x,
                startY: tower.y,
                x: tower.x,
                y: tower.y,
                targetX: target.x,
                targetY: target.y,
                targetEntityId: target.id,
                speed: 340,
                damage: tower.damage,
                isSplash: false,
                splashRadius: 0,
                team: tower.team,
                type: tower.type === 'king' ? 'cannonball' : 'arrow',
                color: tower.type === 'king' ? '#334155' : '#E2E8F0',
                progress: 0,
              });
            }
          }
        });

        // 5. Update Units Movement & Combat
        unitsRef.current.forEach(unit => {
          if (unit.hp <= 0) return;

          unit.lastAttackTime += dt;
          unit.animFrame += dt * 6;

          const enemyTeam = unit.team === 'player' ? 'enemy' : 'player';

          // Target selection
          interface CombatTarget {
            x: number;
            y: number;
            hp: number;
            isBuilding: boolean;
            id: string;
            radius: number;
          }

          let foundTarget: CombatTarget | null = null;
          let minDistance = Infinity;

          // If unit targets ground/all, scan for enemy units first
          if (unit.targets !== 'buildings') {
            for (let i = 0; i < unitsRef.current.length; i++) {
              const other = unitsRef.current[i];
              if (other.team === enemyTeam && other.hp > 0) {
                // If other unit is flying, check if attacker can target air
                if (other.isFlying && unit.targets === 'ground') continue;

                const dist = Math.hypot(other.x - unit.x, other.y - unit.y);
                if (dist < minDistance && dist <= 240) {
                  minDistance = dist;
                  foundTarget = {
                    x: other.x,
                    y: other.y,
                    hp: other.hp,
                    isBuilding: false,
                    id: other.id,
                    radius: other.radius,
                  };
                }
              }
            }
          }

          // If no enemy units in aggro range, target towers!
          if (!foundTarget) {
            const activeEnemyTowers = towersRef.current.filter(t => t.team === enemyTeam && t.hp > 0);
            // Check princess towers first, king tower last unless princesses are down
            const princessTowers = activeEnemyTowers.filter(t => t.type !== 'king');
            const towersToConsider = princessTowers.length > 0 ? princessTowers : activeEnemyTowers;

            for (let i = 0; i < towersToConsider.length; i++) {
              const t = towersToConsider[i];
              const dist = Math.hypot(t.x - unit.x, t.y - unit.y);
              if (dist < minDistance) {
                minDistance = dist;
                foundTarget = {
                  x: t.x,
                  y: t.y,
                  hp: t.hp,
                  isBuilding: true,
                  id: t.id,
                  radius: t.radius,
                };
              }
            }
          }

          if (foundTarget) {
            const currentTarget: CombatTarget = foundTarget;
            const dist = Math.hypot(currentTarget.x - unit.x, currentTarget.y - unit.y);
            const reach = unit.range + currentTarget.radius;

            if (dist <= reach) {
              // IN RANGE -> ATTACK!
              if (unit.lastAttackTime >= unit.attackSpeed) {
                unit.lastAttackTime = 0;

                if (unit.range > 60) {
                  // Ranged attack -> fire projectile
                  projectilesRef.current.push({
                    id: Math.random().toString(),
                    startX: unit.x,
                    startY: unit.y,
                    x: unit.x,
                    y: unit.y,
                    targetX: currentTarget.x,
                    targetY: currentTarget.y,
                    targetEntityId: currentTarget.id,
                    speed: 320,
                    damage: unit.damage,
                    isSplash: unit.isSplash,
                    splashRadius: unit.splashRadius,
                    team: unit.team,
                    type: unit.isSplash ? 'magic' : 'arrow',
                    color: unit.color,
                    progress: 0,
                  });
                  sound.playTowerShoot();
                } else {
                  // Melee attack -> instant damage with slash
                  sound.playHit();
                  applyDamage(currentTarget.id, currentTarget.isBuilding, unit.damage, unit.isSplash, unit.splashRadius, currentTarget.x, currentTarget.y, unit.team);

                  // Slash particle
                  for (let s = 0; s < 4; s++) {
                    particlesRef.current.push({
                      x: currentTarget.x + (Math.random() - 0.5) * 16,
                      y: currentTarget.y + (Math.random() - 0.5) * 16,
                      vx: (Math.random() - 0.5) * 80,
                      vy: (Math.random() - 0.5) * 80,
                      radius: 2,
                      color: '#FCD34D',
                      alpha: 1,
                      life: 0,
                      maxLife: 0.2,
                    });
                  }
                }
              }
            } else {
              // MOVE TOWARDS TARGET (or towards bridge if crossing river)
              let moveTargetX = currentTarget.x;
              let moveTargetY = currentTarget.y;

              // Check if ground unit needs to cross bridge
              if (!unit.isFlying) {
                const isUnitPlayerSide = unit.y > RIVER_Y;
                const isTargetPlayerSide = currentTarget.y > RIVER_Y;

                if (isUnitPlayerSide !== isTargetPlayerSide) {
                  // Need bridge! Pick closest bridge (left or right)
                  const leftBridgeDist = Math.hypot(LEFT_BRIDGE_X - unit.x, RIVER_Y - unit.y);
                  const rightBridgeDist = Math.hypot(RIGHT_BRIDGE_X - unit.x, RIVER_Y - unit.y);
                  const bridgeX = leftBridgeDist < rightBridgeDist ? LEFT_BRIDGE_X : RIGHT_BRIDGE_X;

                  // If still approaching river, head to bridge entry
                  const nearBridgeY = Math.abs(unit.y - RIVER_Y) < 30;
                  const alignedBridgeX = Math.abs(unit.x - bridgeX) < BRIDGE_HALF_WIDTH;

                  if (!nearBridgeY || !alignedBridgeX) {
                    moveTargetX = bridgeX;
                    moveTargetY = isUnitPlayerSide ? RIVER_Y + 15 : RIVER_Y - 15;
                  }
                }
              }

              const angle = Math.atan2(moveTargetY - unit.y, moveTargetX - unit.x);
              unit.x += Math.cos(angle) * unit.speed * dt;
              unit.y += Math.sin(angle) * unit.speed * dt;
            }
          }
        });

        // 6. Update Projectiles
        for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
          const p = projectilesRef.current[i];
          const totalDist = Math.hypot(p.targetX - p.startX, p.targetY - p.startY);
          const step = (p.speed * dt) / Math.max(1, totalDist);
          p.progress += step;

          p.x = p.startX + (p.targetX - p.startX) * p.progress;
          p.y = p.startY + (p.targetY - p.startY) * p.progress;

          // Parabolic arc for fireballs/arrows
          const arc = Math.sin(p.progress * Math.PI) * (p.type === 'fireball' ? 60 : 25);
          p.y -= arc * 0.15;

          if (p.progress >= 1) {
            // Hit!
            if (p.type === 'fireball') {
              screenShakeRef.current = 8;
              sound.playFireball();
              // Spawn huge fire explosion particles
              for (let f = 0; f < 25; f++) {
                particlesRef.current.push({
                  x: p.targetX,
                  y: p.targetY,
                  vx: (Math.random() - 0.5) * 180,
                  vy: (Math.random() - 0.5) * 180,
                  radius: 3 + Math.random() * 4,
                  color: ['#EF4444', '#F97316', '#FCD34D'][Math.floor(Math.random() * 3)],
                  alpha: 1,
                  life: 0,
                  maxLife: 0.5,
                });
              }
            } else {
              sound.playHit();
            }

            applyDamage(p.targetEntityId, true, p.damage, p.isSplash, p.splashRadius, p.targetX, p.targetY, p.team);
            projectilesRef.current.splice(i, 1);
          }
        }

        // 7. Cleanup dead units
        unitsRef.current = unitsRef.current.filter(u => u.hp > 0);

        // 8. Check Towers HP and Crown score
        towersRef.current.forEach(t => {
          if (t.hp <= 0 && t.maxHp > 0) {
            // Tower destroyed!
            t.maxHp = 0; // mark processed
            sound.playCrownDestroyed();
            screenShakeRef.current = 12;

            // Spawn explosion particles
            for (let e = 0; e < 35; e++) {
              particlesRef.current.push({
                x: t.x,
                y: t.y,
                vx: (Math.random() - 0.5) * 220,
                vy: (Math.random() - 0.5) * 220,
                radius: 4 + Math.random() * 4,
                color: t.team === 'player' ? '#F87171' : '#60A5FA',
                alpha: 1,
                life: 0,
                maxLife: 0.6,
              });
            }

            // Update crown score
            if (t.team === 'enemy') {
              if (t.type === 'king') {
                setPlayerCrowns(3);
                setWinner('player');
                setGameState('GAMEOVER');
              } else {
                setPlayerCrowns(prev => {
                  const updated = prev + 1;
                  if (updated >= 3) {
                    setWinner('player');
                    setGameState('GAMEOVER');
                  }
                  return updated;
                });
              }
            } else {
              if (t.type === 'king') {
                setEnemyCrowns(3);
                setWinner('enemy');
                setGameState('GAMEOVER');
              } else {
                setEnemyCrowns(prev => {
                  const updated = prev + 1;
                  if (updated >= 3) {
                    setWinner('enemy');
                    setGameState('GAMEOVER');
                  }
                  return updated;
                });
              }
            }
          }
        });
      }

      // Update Particles
      for (let pIdx = particlesRef.current.length - 1; pIdx >= 0; pIdx--) {
        const pt = particlesRef.current[pIdx];
        pt.life += dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.alpha = 1 - pt.life / pt.maxLife;
        if (pt.life >= pt.maxLife) {
          particlesRef.current.splice(pIdx, 1);
        }
      }

      // Update Floating Damage Numbers
      for (let dIdx = damageNumbersRef.current.length - 1; dIdx >= 0; dIdx--) {
        const dmg = damageNumbersRef.current[dIdx];
        dmg.y -= 30 * dt;
        dmg.duration -= dt;
        if (dmg.duration <= 0) {
          damageNumbersRef.current.splice(dIdx, 1);
        }
      }

      // Screen shake decay
      if (screenShakeRef.current > 0) {
        screenShakeRef.current = Math.max(0, screenShakeRef.current - dt * 25);
      }

      // RENDER FRAME
      ctx.save();
      if (screenShakeRef.current > 0) {
        const shakeX = (Math.random() - 0.5) * screenShakeRef.current;
        const shakeY = (Math.random() - 0.5) * screenShakeRef.current;
        ctx.translate(shakeX, shakeY);
      }

      renderArena(ctx);
      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, isDoubleElixir]);

  // Apply damage helper
  const applyDamage = (
    targetEntityId: string | null | undefined,
    allowTowers: boolean,
    damage: number,
    isSplash: boolean,
    splashRadius: number,
    x: number,
    y: number,
    attackerTeam: 'player' | 'enemy'
  ) => {
    const enemyTeam = attackerTeam === 'player' ? 'enemy' : 'player';

    if (isSplash && splashRadius > 0) {
      // Area splash to all enemy units and towers in radius
      unitsRef.current.forEach(u => {
        if (u.team === enemyTeam && Math.hypot(u.x - x, u.y - y) <= splashRadius) {
          u.hp -= damage;
          spawnDamageText(`-${damage}`, u.x, u.y, '#F87171');
        }
      });
      if (allowTowers) {
        towersRef.current.forEach(t => {
          if (t.team === enemyTeam && t.hp > 0 && Math.hypot(t.x - x, t.y - y) <= splashRadius + t.radius) {
            const towerDmg = Math.round(damage * 0.4); // reduced damage on towers
            t.hp -= towerDmg;
            spawnDamageText(`-${towerDmg}`, t.x, t.y, '#FBBF24');
          }
        });
      }
    } else {
      // Single target damage
      if (targetEntityId) {
        const targetUnit = unitsRef.current.find(u => u.id === targetEntityId);
        if (targetUnit) {
          targetUnit.hp -= damage;
          spawnDamageText(`-${damage}`, targetUnit.x, targetUnit.y, '#F87171');
          return;
        }
        const targetTower = towersRef.current.find(t => t.id === targetEntityId);
        if (targetTower && targetTower.hp > 0) {
          targetTower.hp -= damage;
          spawnDamageText(`-${damage}`, targetTower.x, targetTower.y, '#FBBF24');
          return;
        }
      }
      // Fallback nearest
      const nearestUnit = unitsRef.current.find(u => u.team === enemyTeam && Math.hypot(u.x - x, u.y - y) <= 40);
      if (nearestUnit) {
        nearestUnit.hp -= damage;
        spawnDamageText(`-${damage}`, nearestUnit.x, nearestUnit.y, '#F87171');
      }
    }
  };

  const spawnDamageText = (text: string, x: number, y: number, color: string) => {
    damageNumbersRef.current.push({
      id: Math.random().toString(),
      text,
      x: x + (Math.random() - 0.5) * 12,
      y: y - 10,
      color,
      createdAt: Date.now(),
      duration: 0.6,
    });
  };

  // Canvas Arena Renderer
  const renderArena = (ctx: CanvasRenderingContext2D) => {
    // 1. Lush Arena Grass (Two-tone striped lawn)
    ctx.fillStyle = '#22552C';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Subtle lawn stripes
    ctx.fillStyle = '#2A6635';
    for (let stripeY = 0; stripeY < ARENA_HEIGHT; stripeY += 40) {
      if ((stripeY / 40) % 2 === 0) {
        ctx.fillRect(0, stripeY, ARENA_WIDTH, 40);
      }
    }

    // Cobblestone Pathways connecting towers and bridges
    ctx.strokeStyle = '#D97706';
    ctx.fillStyle = '#78350F';
    ctx.lineWidth = 16;
    ctx.beginPath();
    // Left lane path
    ctx.moveTo(LEFT_BRIDGE_X, 75);
    ctx.lineTo(LEFT_BRIDGE_X, 605);
    // Right lane path
    ctx.moveTo(RIGHT_BRIDGE_X, 75);
    ctx.lineTo(RIGHT_BRIDGE_X, 605);
    // King center cross path
    ctx.moveTo(ARENA_WIDTH / 2, 75);
    ctx.lineTo(LEFT_BRIDGE_X, 155);
    ctx.moveTo(ARENA_WIDTH / 2, 75);
    ctx.lineTo(RIGHT_BRIDGE_X, 155);
    ctx.moveTo(ARENA_WIDTH / 2, 605);
    ctx.lineTo(LEFT_BRIDGE_X, 525);
    ctx.moveTo(ARENA_WIDTH / 2, 605);
    ctx.lineTo(RIGHT_BRIDGE_X, 525);
    ctx.strokeStyle = 'rgba(180, 140, 90, 0.35)';
    ctx.stroke();

    // 2. The River
    const riverGradient = ctx.createLinearGradient(0, RIVER_Y - 20, 0, RIVER_Y + 20);
    riverGradient.addColorStop(0, '#0284C7');
    riverGradient.addColorStop(0.5, '#0369A1');
    riverGradient.addColorStop(1, '#0284C7');
    ctx.fillStyle = riverGradient;
    ctx.fillRect(0, RIVER_Y - 20, ARENA_WIDTH, 40);

    // River wave ripples
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    for (let waveX = 15; waveX < ARENA_WIDTH; waveX += 60) {
      ctx.beginPath();
      ctx.arc(waveX, RIVER_Y - 5, 12, 0, Math.PI);
      ctx.stroke();
    }

    // 3. Wooden Bridges
    [LEFT_BRIDGE_X, RIGHT_BRIDGE_X].forEach(bx => {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(bx - BRIDGE_HALF_WIDTH + 2, RIVER_Y - 25 + 2, BRIDGE_HALF_WIDTH * 2, 50);
      // Wood plank base
      ctx.fillStyle = '#92400E';
      ctx.fillRect(bx - BRIDGE_HALF_WIDTH, RIVER_Y - 25, BRIDGE_HALF_WIDTH * 2, 50);
      // Bridge planks lines
      ctx.strokeStyle = '#451A03';
      ctx.lineWidth = 2;
      for (let py = RIVER_Y - 25; py <= RIVER_Y + 25; py += 8) {
        ctx.beginPath();
        ctx.moveTo(bx - BRIDGE_HALF_WIDTH, py);
        ctx.lineTo(bx + BRIDGE_HALF_WIDTH, py);
        ctx.stroke();
      }
      // Wooden railings
      ctx.fillStyle = '#78350F';
      ctx.fillRect(bx - BRIDGE_HALF_WIDTH - 2, RIVER_Y - 25, 4, 50);
      ctx.fillRect(bx + BRIDGE_HALF_WIDTH - 2, RIVER_Y - 25, 4, 50);
    });

    // 4. Territory Guide Lines & Highlights (When card selected)
    if (selectedCardId && gameState === 'PLAYING') {
      const cardDef = CARD_DEFINITIONS[selectedCardId];
      if (cardDef.type === 'spell') {
        // Can drop anywhere - glowing gold border
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
        ctx.lineWidth = 4;
        ctx.strokeRect(10, 10, ARENA_WIDTH - 20, ARENA_HEIGHT - 20);
      } else {
        // Blue friendly territory zone
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.fillRect(10, RIVER_Y + 20, ARENA_WIDTH - 20, ARENA_HEIGHT - RIVER_Y - 30);
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(10, RIVER_Y + 20, ARENA_WIDTH - 20, ARENA_HEIGHT - RIVER_Y - 30);
        ctx.setLineDash([]);
      }

      // Draw cursor targeting reticle if hovering
      if (mousePosRef.current) {
        const { x, y } = mousePosRef.current;
        const valid = isValidDeployArea(cardDef, x, y);

        ctx.beginPath();
        ctx.arc(x, y, cardDef.type === 'spell' ? (cardDef.splashRadius || 70) : 24, 0, Math.PI * 2);
        ctx.fillStyle = valid ? 'rgba(59, 130, 246, 0.25)' : 'rgba(239, 68, 68, 0.25)';
        ctx.fill();
        ctx.strokeStyle = valid ? '#60A5FA' : '#EF4444';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // 5. Draw Towers
    towersRef.current.forEach(tower => {
      if (tower.hp <= 0) {
        // Destroyed tower ruins
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, tower.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1E293B';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💥', tower.x, tower.y + 6);
        return;
      }

      const isPlayer = tower.team === 'player';
      const isKing = tower.type === 'king';

      // Base shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(tower.x, tower.y + tower.radius * 0.6, tower.radius * 1.1, tower.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Stone Tower Structure
      const stoneGrad = ctx.createLinearGradient(tower.x - tower.radius, tower.y, tower.x + tower.radius, tower.y);
      stoneGrad.addColorStop(0, '#64748B');
      stoneGrad.addColorStop(0.5, '#94A3B8');
      stoneGrad.addColorStop(1, '#475569');
      ctx.fillStyle = stoneGrad;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, tower.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Team Roof / Battlement
      ctx.fillStyle = isPlayer ? '#2563EB' : '#DC2626';
      ctx.beginPath();
      ctx.arc(tower.x, tower.y - 6, tower.radius * 0.75, 0, Math.PI * 2);
      ctx.fill();

      // King Crown or Princess Crest
      ctx.fillStyle = '#FBBF24';
      ctx.font = isKing ? '22px sans-serif' : '15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isKing ? '👑' : '🏰', tower.x, tower.y - 6);

      // Cannon nozzle
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      const cannonDir = isPlayer ? -1 : 1;
      ctx.arc(tower.x, tower.y + cannonDir * (tower.radius * 0.7), 6, 0, Math.PI * 2);
      ctx.fill();

      // Tower HP Bar
      const hpWidth = tower.radius * 2.2;
      const hpHeight = 6;
      const hpY = tower.y - tower.radius - 14;
      const hpPct = Math.max(0, tower.hp / tower.maxHp);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(tower.x - hpWidth / 2 - 1, hpY - 1, hpWidth + 2, hpHeight + 2);
      ctx.fillStyle = isPlayer ? '#3B82F6' : '#EF4444';
      ctx.fillRect(tower.x - hpWidth / 2, hpY, hpWidth * hpPct, hpHeight);

      // HP Text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${tower.hp}`, tower.x, hpY - 3);
    });

    // 6. Draw Units
    unitsRef.current.forEach(unit => {
      const isPlayer = unit.team === 'player';

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      const shadowY = unit.isFlying ? unit.y + 22 : unit.y + unit.radius * 0.6;
      ctx.ellipse(unit.x, shadowY, unit.radius * 0.9, unit.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Walking bounce
      const bob = Math.sin(unit.animFrame) * 2;
      const drawY = unit.y + bob;

      // Unit Body
      ctx.fillStyle = unit.color;
      ctx.beginPath();
      ctx.arc(unit.x, drawY, unit.radius, 0, Math.PI * 2);
      ctx.fill();

      // Team border ring
      ctx.strokeStyle = isPlayer ? '#3B82F6' : '#EF4444';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Unit Icon/Emoji
      const cardDef = CARD_DEFINITIONS[unit.cardId];
      if (cardDef) {
        ctx.font = `${Math.round(unit.radius * 1.2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cardDef.icon, unit.x, drawY);
      }

      // Flying wings indicator
      if (unit.isFlying) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.ellipse(unit.x - unit.radius - 2, drawY, 5, 2, Math.PI / 4, 0, Math.PI * 2);
        ctx.ellipse(unit.x + unit.radius + 2, drawY, 5, 2, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Unit HP Bar
      const hpWidth = unit.radius * 2.2;
      const hpHeight = 4;
      const hpY = drawY - unit.radius - 8;
      const hpPct = Math.max(0, unit.hp / unit.maxHp);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(unit.x - hpWidth / 2 - 1, hpY - 1, hpWidth + 2, hpHeight + 2);
      ctx.fillStyle = isPlayer ? '#22C55E' : '#EF4444';
      ctx.fillRect(unit.x - hpWidth / 2, hpY, hpWidth * hpPct, hpHeight);
    });

    // 7. Draw Projectiles
    projectilesRef.current.forEach(p => {
      ctx.save();
      if (p.type === 'arrow') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        const angle = Math.atan2(p.targetY - p.startY, p.targetX - p.startX);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - Math.cos(angle) * 12, p.y - Math.sin(angle) * 12);
        ctx.stroke();
      } else if (p.type === 'cannonball') {
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'fireball') {
        const fireGrad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 14);
        fireGrad.addColorStop(0, '#FEF08A');
        fireGrad.addColorStop(0.5, '#F97316');
        fireGrad.addColorStop(1, '#EF4444');
        ctx.fillStyle = fireGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'magic') {
        ctx.fillStyle = '#C084FC';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 8. Draw Particles
    particlesRef.current.forEach(pt => {
      ctx.save();
      ctx.globalAlpha = pt.alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 9. Floating Damage Text
    damageNumbersRef.current.forEach(d => {
      ctx.save();
      ctx.fillStyle = d.color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 3;
      ctx.strokeText(d.text, d.x, d.y);
      ctx.fillText(d.text, d.x, d.y);
      ctx.restore();
    });
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex flex-col xl:flex-row items-center justify-center gap-6 w-full max-w-6xl mx-auto py-2">
      {/* ARENA CONTAINER */}
      <div className="relative flex flex-col items-center select-none">
        {/* HUD Top Header */}
        <div className="w-[480px] max-w-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-t-xl px-4 py-2.5 flex items-center justify-between text-xs font-semibold">
          {/* Enemy crowns */}
          <div className="flex items-center gap-2">
            <span className="text-red-400 font-bold flex items-center gap-1">
              <Crown className="w-4 h-4 fill-red-500 text-red-500" />
              {enemyCrowns}
            </span>
            <span className="text-slate-400">Kırmızı Krallık</span>
          </div>

          {/* Match timer & 2X badge */}
          <div className="flex items-center gap-2">
            <span className={`font-mono-num text-sm font-bold ${matchTime <= 30 ? 'text-amber-400 animate-pulse' : 'text-slate-200'}`}>
              {formatTimer(matchTime)}
            </span>
            {isDoubleElixir && (
              <span className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-purple-900/70 border border-purple-500/50 text-purple-300 font-bold text-[10px]">
                <Zap className="w-3 h-3 text-purple-400" /> 2X İKSİR
              </span>
            )}
          </div>

          {/* Player crowns */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Mavi Krallık</span>
            <span className="text-blue-400 font-bold flex items-center gap-1">
              {playerCrowns}
              <Crown className="w-4 h-4 fill-blue-500 text-blue-500" />
            </span>
          </div>
        </div>

        {/* Canvas Arena */}
        <div className="relative border-x border-slate-800 shadow-2xl overflow-hidden cursor-crosshair">
          <canvas
            ref={canvasRef}
            width={ARENA_WIDTH}
            height={ARENA_HEIGHT}
            onClick={handleArenaClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="w-[360px] sm:w-[440px] md:w-[480px] h-auto aspect-[480/680] block touch-none"
          />

          {/* Start / Menu Overlay */}
          {gameState === 'MENU' && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20 mb-4">
                <Crown className="w-10 h-10 text-white fill-white" />
              </div>
              <h2 className="text-2xl font-cinzel font-bold text-amber-400 mb-1 tracking-wide">
                KRALLIK ARENASI
              </h2>
              <p className="text-sm text-slate-300 max-w-xs mb-6">
                Clash Royale tarzı gerçek zamanlı kule savaşı! Kartlarını seç, nehir köprülerini geç ve düşman taç kulelerini yık!
              </p>

              <button
                onClick={startMatch}
                className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-base shadow-lg shadow-blue-500/30 transition-transform active:scale-95 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-white" />
                Savaşa Başla!
              </button>
            </div>
          )}

          {/* Game Over Modal */}
          {gameState === 'GAMEOVER' && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30">
              <div className="text-5xl mb-3">
                {winner === 'player' ? '🏆' : winner === 'enemy' ? '💀' : '⚔️'}
              </div>
              <h2 className={`text-2xl font-cinzel font-extrabold mb-1 ${
                winner === 'player' ? 'text-emerald-400' : winner === 'enemy' ? 'text-rose-400' : 'text-amber-400'
              }`}>
                {winner === 'player' ? 'ZAFER!' : winner === 'enemy' ? 'BOZGUN!' : 'BERABERLİK!'}
              </h2>
              <p className="text-sm text-slate-300 mb-4">
                {winner === 'player' ? 'Düşman krallığını dize getirdin!' : winner === 'enemy' ? 'Kulelerin düştü, tekrar dene!' : 'Çetin bir mücadeleydi!'}
              </p>

              {/* Crown recap */}
              <div className="flex items-center gap-6 bg-slate-900/90 border border-slate-800 rounded-xl px-6 py-3 mb-6">
                <div className="text-center">
                  <span className="text-xs text-blue-400 block font-semibold">Sen</span>
                  <span className="text-2xl font-bold text-white">{playerCrowns} 👑</span>
                </div>
                <span className="text-slate-600 font-bold">-</span>
                <div className="text-center">
                  <span className="text-xs text-red-400 block font-semibold">Yapay Zeka</span>
                  <span className="text-2xl font-bold text-white">{enemyCrowns} 👑</span>
                </div>
              </div>

              <button
                onClick={startMatch}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/30 transition-transform active:scale-95 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Tekrar Oyna
              </button>
            </div>
          )}
        </div>

        {/* BOTTOM DECK & ELIXIR BAR */}
        <div className="w-[480px] max-w-full bg-slate-900/95 border-x border-b border-slate-800 rounded-b-xl p-3 flex flex-col gap-2.5 shadow-xl">
          {/* Elixir Meter */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-purple-400 font-bold text-xs whitespace-nowrap">
              <Zap className="w-4 h-4 fill-purple-400 text-purple-400" />
              <span className="font-mono-num text-sm">{Math.floor(playerElixir)}</span>
              <span className="text-slate-500 text-[10px]">/10</span>
            </div>

            {/* Glowing Segmented Bar */}
            <div className="relative flex-1 h-3.5 bg-slate-950 rounded-full overflow-hidden border border-purple-950/80 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 shadow-[0_0_12px_rgba(217,70,239,0.6)] transition-all duration-100 ease-out"
                style={{ width: `${(playerElixir / 10) * 100}%` }}
              />
              {/* 10 pip lines */}
              <div className="absolute inset-0 grid grid-cols-10 pointer-events-none">
                {[...Array(9)].map((_, idx) => (
                  <div key={idx} className="border-r border-slate-950/40 h-full" />
                ))}
              </div>
            </div>
          </div>

          {/* Cards Tray (4 playable cards + 1 next card) */}
          <div className="flex items-center justify-between gap-1.5">
            {/* Next Card Preview */}
            <div className="flex flex-col items-center pr-2 border-r border-slate-800">
              <span className="text-[10px] text-slate-400 mb-1">Sıradaki</span>
              {CARD_DEFINITIONS[nextCard] && (
                <div className="w-12 h-16 rounded-lg bg-slate-950 border border-slate-800 flex flex-col items-center justify-center opacity-70">
                  <span className="text-base">{CARD_DEFINITIONS[nextCard].icon}</span>
                  <span className="text-[9px] font-bold text-purple-400 mt-1 flex items-center">
                    <Zap className="w-2.5 h-2.5 fill-purple-400" />{CARD_DEFINITIONS[nextCard].elixir}
                  </span>
                </div>
              )}
            </div>

            {/* 4 Hand Cards */}
            <div className="grid grid-cols-4 gap-1.5 flex-1">
              {playerHand.map((cardId, index) => {
                const card = CARD_DEFINITIONS[cardId];
                if (!card) return null;
                const canAfford = playerElixir >= card.elixir;
                const isSelected = selectedCardId === cardId;

                return (
                  <button
                    key={`${cardId}_${index}`}
                    onClick={() => {
                      if (gameState !== 'PLAYING') return;
                      sound.playClick();
                      setSelectedCardId(isSelected ? null : cardId);
                    }}
                    className={`relative h-20 rounded-xl p-1.5 flex flex-col items-center justify-between transition-all cursor-pointer border text-left ${
                      isSelected
                        ? 'bg-amber-950/60 border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.6)] -translate-y-1 scale-105'
                        : canAfford
                        ? 'bg-slate-800/90 border-slate-700 hover:border-blue-400 hover:bg-slate-800'
                        : 'bg-slate-950/70 border-slate-850 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {/* Elixir badge */}
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-purple-900/90 border border-purple-500/60 text-purple-200 text-[10px] font-extrabold flex items-center gap-0.5">
                      <Zap className="w-2.5 h-2.5 fill-purple-400 text-purple-400" />
                      {card.elixir}
                    </div>

                    {/* Icon */}
                    <span className="text-2xl mt-3">{card.icon}</span>

                    {/* Card Name */}
                    <span className="text-[10px] font-bold text-slate-200 truncate w-full text-center">
                      {card.nameTr}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* STRATEGY & GUIDE CARD ON RIGHT */}
      <div className="w-full xl:w-72 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 text-xs text-slate-300">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <h3 className="font-bold text-slate-100 text-sm">Nasıl Oynanır?</h3>
        </div>

        <ul className="space-y-2.5 text-slate-300">
          <li className="flex items-start gap-2">
            <span className="text-amber-400 font-bold shrink-0">1.</span>
            <span>İksirin dolunca alt kısımdaki kartlardan birine tıkla.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400 font-bold shrink-0">2.</span>
            <span>Mavi bölgeye tıklayarak birliğini sahaya sür. <strong>Ateş Topu</strong> büyüsünü ise tüm sahada istediğin noktaya fırlatabilirsin!</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400 font-bold shrink-0">3.</span>
            <span>Birlikler köprülerden geçerek düşman kulelerine saldırır. <strong>Dev</strong> yalnızca kulelere koşar!</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400 font-bold shrink-0">4.</span>
            <span>Son 60 saniyede <strong>2X Çift İksir</strong> başlar! Kral kulesini yıkan anında 3 taç ile kazanır!</span>
          </li>
        </ul>

        <div className="border-t border-slate-800 pt-3">
          <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
            <Swords className="w-3.5 h-3.5 text-blue-400" /> Birlik Taktikleri
          </h4>
          <div className="space-y-1.5 text-[11px] text-slate-400">
            <div><strong className="text-slate-200">Dev + Okçular:</strong> Dev hasarı çekerken arkasındaki okçular yıkar.</div>
            <div><strong className="text-slate-200">İskelet Ordusu:</strong> Düşman Dev veya Şövalye&apos;yi anında eritir.</div>
            <div><strong className="text-slate-200">Büyücü & Ejderha:</strong> Kalabalık düşman sürülerine alan hasarı vurur.</div>
          </div>
        </div>

        {gameState === 'PLAYING' && (
          <button
            onClick={startMatch}
            className="mt-2 w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Mücadeleyi Sıfırla
          </button>
        )}
      </div>
    </div>
  );
};
