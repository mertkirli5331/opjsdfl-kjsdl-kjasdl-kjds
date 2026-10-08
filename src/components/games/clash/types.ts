export type CardId =
  | 'knight'
  | 'archers'
  | 'giant'
  | 'skeleton_army'
  | 'wizard'
  | 'fireball'
  | 'goblin_gang'
  | 'baby_dragon';

export interface CardDef {
  id: CardId;
  name: string;
  nameTr: string;
  elixir: number;
  type: 'troop' | 'spell';
  description: string;
  icon: string;
  color: string;
  count: number;
  hp: number;
  damage: number;
  speed: number;
  range: number;
  attackSpeed: number; // seconds between attacks
  targets: 'ground' | 'all' | 'buildings';
  isFlying?: boolean;
  isSplash?: boolean;
  splashRadius?: number;
}

export interface Unit {
  id: string;
  cardId: CardId;
  team: 'player' | 'enemy';
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  range: number;
  attackSpeed: number;
  lastAttackTime: number;
  targets: 'ground' | 'all' | 'buildings';
  isFlying: boolean;
  isSplash: boolean;
  splashRadius: number;
  radius: number;
  color: string;
  name: string;
  animFrame: number;
  targetEntityId?: string | null;
}

export interface Tower {
  id: string;
  type: 'king' | 'princess_left' | 'princess_right';
  team: 'player' | 'enemy';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  range: number;
  damage: number;
  attackSpeed: number;
  lastAttackTime: number;
  activated: boolean;
  radius: number;
  targetUnitId?: string | null;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  targetEntityId?: string | null;
  speed: number;
  damage: number;
  isSplash: boolean;
  splashRadius: number;
  team: 'player' | 'enemy';
  type: 'arrow' | 'cannonball' | 'fireball' | 'magic';
  color: string;
  progress: number; // 0 to 1
  startX: number;
  startY: number;
}

export interface DamageNumber {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  createdAt: number;
  duration: number;
}

export interface Particle {
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
