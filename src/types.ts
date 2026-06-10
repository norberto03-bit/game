export type PowerUpType = 'normal' | 'fire' | 'ice' | 'turbo';

export interface LevelConfig {
  id: string;
  name: string;
  theme: 'green' | 'cave' | 'sierra' | 'desert' | 'neon' | 'castle';
  unlocked: boolean;
  completed: boolean;
  x: number; // grid or canvas coordinates from 0-100 on the Overworld Map
  y: number;
  connections: string[]; // next levels
  highScore: number;
  coinsCount: number;
  timeLimit: number;
}

export interface PlayerStats {
  score: number;
  coins: number;
  lives: number;
  activePowerUp: PowerUpType;
  unlockedLevels: string[];
  completedLevels: string[];
}

export type BlockType = 
  | 'ground' 
  | 'brick' 
  | 'question' 
  | 'empty-question' 
  | 'pipe' 
  | 'lava' 
  | 'spike' 
  | 'castle-block' 
  | 'liftable' 
  | 'trampa'
  | 'goal'
  | 'carrot'
  | 'stable'
  | 'coin';

export interface Block {
  id: string;
  x: number; // grid x
  y: number; // grid y
  type: BlockType;
  contains?: 'coin' | 'powerup-fire' | 'powerup-ice' | 'powerup-turbo';
  hitAnimationY?: number; // for question block bounce
}

export interface Enemy {
  id: string;
  x: number; // pixel x
  y: number; // pixel y
  width: number;
  height: number;
  vx: number;
  vy: number;
  type: 'champi' | 'tortu' | 'volador' | 'jefe';
  hp: number;
  state: 'walk' | 'squished' | 'frozen' | 'shell';
  animationFrame: number;
  facing: 'left' | 'right';
  frozenTime?: number;
  // Traffic and Sierra AI properties
  trafficLightState?: 'green' | 'yellow' | 'red';
  trafficTimer?: number;
  isAlerted?: boolean;
  alertCooldown?: number;
  soundPlayed?: boolean;
  patrolBaseVx?: number;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'fire' | 'ice';
  bounces?: number;
}

export interface GameParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number; // 0 to 1
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  life: number;
}
