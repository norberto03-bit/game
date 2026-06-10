import React, { useEffect, useRef, useState } from 'react';
import { Block, Enemy, Projectile, GameParticle, FloatingText, PowerUpType, PlayerStats } from '../types';
import { audio } from '../audio';
import { Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';

interface GameCanvasProps {
  levelId: string;
  stats: PlayerStats;
  onUpdateStats: (newStats: Partial<PlayerStats>) => void;
  onClearLevel: (scoreGained: number, coinsGained: number) => void;
  onGameOver: () => void;
  onExit: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  activeKeys: { [key: string]: boolean };
  onPressKey: (key: string, isPressed: boolean) => void;
  consoleMode: 'retro' | 'touch';
  onToggleConsoleMode: () => void;
}

export default function GameCanvas({
  levelId,
  stats,
  onUpdateStats,
  onClearLevel,
  onGameOver,
  onExit,
  isMuted,
  onToggleMute,
  activeKeys,
  onPressKey,
  consoleMode,
  onToggleConsoleMode
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Game states we need to track
  const [isPaused, setIsPaused] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [levelTheme, setLevelTheme] = useState<'green' | 'cave' | 'sierra' | 'desert' | 'neon' | 'castle'>('green');
  const [crtEnabled, setCrtEnabled] = useState(true);
  
  // Touch interface states
  const [showTouchOverlay, setShowTouchOverlay] = useState(false);
  const [touchTarget, setTouchTarget] = useState<{ percentX: number; percentY: number } | null>(null);
  const [joystickKnob, setJoystickKnob] = useState({ x: 0, y: 0 });
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);
  const touchKeysRef = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    // Auto-detect touch device & default touch features - kept false by default to prevent duplication with bottom gamepad
    setShowTouchOverlay(false);
  }, []);
  
  // Refs to hold mutable, high-frequency game loop data (avoids react state re-render lag)
  const stateRef = useRef({
    // Camera
    cameraX: 0,
    cameraY: 0,
    levelLength: 2400,
    levelHeight: 480,
    
    // Player Physics
    px: 100,
    py: 350,
    pvx: 0,
    pvy: 0,
    pWidth: 20,
    pHeight: 32,
    pFacing: 'right' as 'left' | 'right',
    pOnGround: false,
    pInvulnerableFrames: 0,
    pPowerUp: stats.activePowerUp,
    playerType: 'explorer' as 'explorer' | 'glasses' | 'truck' | 'bike' | 'catquad' | 'brocoliano',
    jumpCount: 0,
    wasJumpKeyDown: false,
    
    // Player Animations State Buffer and Input Queue
    pAnimState: 'idle' as 'idle' | 'walk' | 'jump' | 'duck',
    pAnimFrame: 0,
    pWalkTick: 0,
    pInputDirectionBuffer: [] as ('left' | 'right')[],
    
    // PowerUp animation state
    isChangingPowerup: 0, // frame counter
    
    // Controls snapshot
    keys: { ...activeKeys },
    fireCooldown: 0,
    iceCooldown: 0,
    screenShake: 0,
    
    // Level items
    blocks: [] as Block[],
    enemies: [] as Enemy[],
    projectiles: [] as Projectile[],
    particles: [] as GameParticle[],
    weatherParticles: [] as {
      id: string;
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      size: number;
      life: number;
      type: 'rain' | 'haze' | 'drop' | 'ember' | 'spore' | 'splash' | 'fog';
      swaySpeed?: number;
      opacity?: number;
      length?: number;
    }[],
    lastCameraX: 100,
    lightningTimer: 0,
    texts: [] as FloatingText[],
    landSquish: 0,
    
    // Trampas (traps) placed by SELECT
    trapsMax: 3,
    trapsPlaced: 0,
    
    // SMW Goal properties
    goalBarY: 100,
    goalBarDirection: 1, // 1 for down, -1 for up
    levelFinished: false,
    finishTimer: 0,
    
    // Scores and Coin buffers for the current session
    coinsCollected: 0,
    scoreAdded: 0,
    livesRemaining: stats.lives,
    
    // Boss properties (Only Level 6)
    bossMaxHp: 4,
    bossActive: false,
  });

  // Keep theme in sync
  useEffect(() => {
    let theme: 'green' | 'cave' | 'sierra' | 'desert' | 'neon' | 'castle' = 'green';
    let duration = 300;
    if (levelId === 'level2') {
      theme = 'cave';
      duration = 320;
    } else if (levelId === 'level3') {
      theme = 'sierra';
      duration = 340;
    } else if (levelId === 'level4') {
      theme = 'desert';
      duration = 360;
    } else if (levelId === 'level5') {
      theme = 'neon';
      duration = 380;
    } else if (levelId === 'level6') {
      theme = 'castle';
      duration = 400;
    }
    setLevelTheme(theme);
    setTimeRemaining(duration);
    
    // Start proper level music loop
    if (theme === 'green') {
      audio.playMusic('green');
    } else if (theme === 'cave' || theme === 'sierra') {
      audio.playMusic('cave');
    } else if (theme === 'desert') {
      audio.playMusic('green');
    } else {
      audio.playMusic('castle');
    }

    return () => {
      audio.stopMusic();
    };
  }, [levelId]);

  // Read inputs from activeKeys and synchronize on stateRef
  useEffect(() => {
    stateRef.current.keys = { ...activeKeys };
  }, [activeKeys]);

  // Setup/Create level geometry
  useEffect(() => {
    const s = stateRef.current;
    s.px = 100;
    s.py = 350;
    s.pvx = 0;
    s.pvy = 0;
    s.pAnimState = 'idle';
    s.pAnimFrame = 0;
    s.pWalkTick = 0;
    s.pInputDirectionBuffer = [];
    s.pPowerUp = stats.activePowerUp;
    s.levelFinished = false;
    s.finishTimer = 0;
    s.coinsCollected = 0;
    s.scoreAdded = 0;
    s.goalBarY = 120;
    s.bossActive = false;
    s.projectiles = [];
    s.particles = [];
    s.weatherParticles = [];
    s.lastCameraX = 0;
    s.lightningTimer = 0;
    s.texts = [];
    s.cameraX = 0;

    let theme: 'green' | 'cave' | 'sierra' | 'desert' | 'neon' | 'castle' = 'green';
    if (levelId === 'level2') theme = 'cave';
    else if (levelId === 'level3') theme = 'sierra';
    else if (levelId === 'level4') theme = 'desert';
    else if (levelId === 'level5') theme = 'neon';
    else if (levelId === 'level6') theme = 'castle';

    let pType: 'explorer' | 'glasses' | 'truck' | 'bike' | 'catquad' | 'brocoliano' = 'explorer';
    if (levelId === 'level2') pType = 'glasses';
    else if (levelId === 'level3') pType = 'truck';
    else if (levelId === 'level4') pType = 'bike';
    else if (levelId === 'level5') pType = 'catquad';
    else if (levelId === 'level6') pType = 'brocoliano';
    
    s.playerType = pType;

    // Adjust sizes for vehicles vs humans
    if (pType === 'truck') {
      s.pWidth = 28;
      s.pHeight = 22;
    } else if (pType === 'bike') {
      s.pWidth = 26;
      s.pHeight = 20;
    } else if (pType === 'catquad') {
      s.pWidth = 26;
      s.pHeight = 22;
    } else if (pType === 'brocoliano') {
      s.pWidth = 20;
      s.pHeight = 26;
    } else {
      s.pWidth = 18;
      s.pHeight = 30;
    }

    // 1. Build Tiles
    const blocks: Block[] = [];
    const tileSize = 32;

    // Base ground blocks
    const totalTiles = Math.ceil(s.levelLength / tileSize);
    for (let tx = 0; tx < totalTiles; tx++) {
      // Level specific pits
      if (theme === 'green' && (tx === 15 || tx === 16 || tx === 35 || tx === 36)) {
        continue; // open pit
      }
      if (theme === 'cave' && (tx === 20 || tx === 21 || tx === 22 || tx === 40 || tx === 41)) {
        // Lava at bottom level
        blocks.push({ id: `lava-${tx}`, x: tx, y: 14, type: 'lava' });
        blocks.push({ id: `lava2-${tx}`, x: tx, y: 13, type: 'lava' });
        continue;
      }
      if (theme === 'sierra' && (tx === 18 || tx === 19 || tx === 40 || tx === 41)) {
        continue; // deep mountain gorge pit
      }
      if (theme === 'desert' && (tx === 22 || tx === 23 || tx === 45 || tx === 46)) {
        // Quick sand (styled as sink spikes!)
        blocks.push({ id: `sand-spike-${tx}`, x: tx, y: 13, type: 'spike' });
        blocks.push({ id: `sand-${tx}`, x: tx, y: 14, type: 'ground' });
        continue;
      }
      if (theme === 'neon' && (tx === 14 || tx === 15 || tx === 36 || tx === 37)) {
        // Cyber hazard grid
        blocks.push({ id: `neon-grid-${tx}`, x: tx, y: 13, type: 'spike' });
        blocks.push({ id: `neon-base-${tx}`, x: tx, y: 14, type: 'castle-block' });
        continue;
      }
      if (theme === 'castle' && (tx === 12 || tx === 13 || tx === 14 || tx === 30 || tx === 31 || tx === 45 || tx === 46)) {
        // Lava filled castle pit
        blocks.push({ id: `clava-${tx}`, x: tx, y: 14, type: 'lava' });
        blocks.push({ id: `clava2-${tx}`, x: tx, y: 13, type: 'lava' });
        continue;
      }

      // Standard Ground line
      blocks.push({ id: `gnd-${tx}-14`, x: tx, y: 14, type: (theme === 'castle' || theme === 'neon') ? 'castle-block' : 'ground' });
      blocks.push({ id: `gnd-${tx}-13`, x: tx, y: 13, type: (theme === 'castle' || theme === 'neon') ? 'castle-block' : 'ground' });
    }

    // Pipes, ramps, and platforms
    if (theme === 'green') {
      // Pipes
      blocks.push({ id: 'pipe1-x240', x: 8, y: 11, type: 'pipe' });
      blocks.push({ id: 'pipe1-x240-top', x: 8, y: 12, type: 'pipe' });
      
      blocks.push({ id: 'pipe2-x360', x: 22, y: 10, type: 'pipe' });
      blocks.push({ id: 'pipe2-x360-1', x: 22, y: 11, type: 'pipe' });
      blocks.push({ id: 'pipe2-x360-2', x: 22, y: 12, type: 'pipe' });

      // Bricks & question blocks with powerups
      blocks.push({ id: 'brick-1', x: 10, y: 9, type: 'brick' });
      blocks.push({ id: 'q-fire', x: 11, y: 9, type: 'question', contains: 'powerup-fire' });
      blocks.push({ id: 'brick-2', x: 12, y: 9, type: 'brick' });
      blocks.push({ id: 'q-coin1', x: 13, y: 9, type: 'question', contains: 'coin' });
      blocks.push({ id: 'brick-3', x: 14, y: 9, type: 'brick' });

      blocks.push({ id: 'q-ice', x: 19, y: 6, type: 'question', contains: 'powerup-ice' });
      blocks.push({ id: 'q-turbo', x: 26, y: 8, type: 'question', contains: 'powerup-turbo' });

      // Floating liftable bags (support packages!)
      blocks.push({ id: 'lift-1', x: 30, y: 12, type: 'liftable' });
      blocks.push({ id: 'lift-2', x: 31, y: 12, type: 'liftable' });
      blocks.push({ id: 'lift-3', x: 32, y: 12, type: 'liftable' });

    } else if (theme === 'cave') {
      // Ceiling blocks
      for (let tx = 0; tx < totalTiles; tx++) {
        blocks.push({ id: `ceil-${tx}`, x: tx, y: 0, type: 'castle-block' });
      }

      blocks.push({ id: 'cave-step-1', x: 6, y: 12, type: 'castle-block' });
      blocks.push({ id: 'cave-step-2', x: 7, y: 11, type: 'castle-block' });
      blocks.push({ id: 'cave-step-3', x: 8, y: 10, type: 'castle-block' });

      blocks.push({ id: 'spike-1', x: 11, y: 12, type: 'spike' });
      blocks.push({ id: 'spike-2', x: 12, y: 12, type: 'spike' });

      blocks.push({ id: 'cave-q-1', x: 15, y: 9, type: 'question', contains: 'powerup-ice' });
      blocks.push({ id: 'cave-q-2', x: 16, y: 9, type: 'question', contains: 'coin' });
      blocks.push({ id: 'cave-q-3', x: 25, y: 7, type: 'question', contains: 'powerup-fire' });

      blocks.push({ id: 'cave-brick-l1', x: 19, y: 9, type: 'brick' });
      blocks.push({ id: 'cave-brick-l2', x: 21, y: 9, type: 'brick' });
      blocks.push({ id: 'cave-brick-l3', x: 23, y: 9, type: 'brick' });
      
      blocks.push({ id: 'lift-cave-1', x: 34, y: 12, type: 'liftable' });
      blocks.push({ id: 'lift-cave-2', x: 35, y: 12, type: 'liftable' });

    } else if (theme === 'sierra') {
      // Rugged Mountain Canyons - rocks to crush!
      blocks.push({ id: 'stone-crush-1', x: 12, y: 12, type: 'brick' }); // smashable by truck speed
      blocks.push({ id: 'stone-crush-2', x: 12, y: 11, type: 'brick' });
      blocks.push({ id: 'stone-crush-3', x: 13, y: 12, type: 'brick' });

      blocks.push({ id: 'mtn-q1', x: 16, y: 8, type: 'question', contains: 'powerup-turbo' });
      blocks.push({ id: 'mtn-q2', x: 24, y: 9, type: 'question', contains: 'coin' });

      // Mountain bridges
      blocks.push({ id: 'mtn-bridge-1', x: 17, y: 10, type: 'brick' });
      blocks.push({ id: 'mtn-bridge-2', x: 20, y: 10, type: 'brick' });

      blocks.push({ id: 'stone-crush-4', x: 35, y: 12, type: 'brick' });
      blocks.push({ id: 'stone-crush-5', x: 36, y: 12, type: 'brick' });
      
    } else if (theme === 'desert') {
      // Pyramids & Cacti
      blocks.push({ id: 'cactus-1', x: 10, y: 11, type: 'spike' });
      blocks.push({ id: 'cactus-2', x: 10, y: 12, type: 'spike' });
      
      blocks.push({ id: 'pyd-1', x: 15, y: 12, type: 'ground' });
      blocks.push({ id: 'pyd-2', x: 16, y: 11, type: 'ground' });
      blocks.push({ id: 'pyd-3', x: 17, y: 10, type: 'ground' });
      blocks.push({ id: 'pyd-4', x: 18, y: 11, type: 'ground' });
      blocks.push({ id: 'pyd-5', x: 19, y: 12, type: 'ground' });

      blocks.push({ id: 'des-q1', x: 17, y: 6, type: 'question', contains: 'powerup-fire' });
      blocks.push({ id: 'des-q2', x: 30, y: 8, type: 'question', contains: 'coin' });

      blocks.push({ id: 'cactus-3', x: 34, y: 12, type: 'spike' });

    } else if (theme === 'neon') {
      // Glow bars & grids
      blocks.push({ id: 'neon-plat-1', x: 10, y: 9, type: 'castle-block' });
      blocks.push({ id: 'neon-plat-2', x: 11, y: 9, type: 'castle-block' });
      blocks.push({ id: 'neon-plat-3', x: 12, y: 9, type: 'question', contains: 'powerup-ice' });
      blocks.push({ id: 'neon-plat-4', x: 13, y: 9, type: 'castle-block' });

      blocks.push({ id: 'neon-grid-spike-1', x: 18, y: 12, type: 'spike' });
      blocks.push({ id: 'neon-grid-spike-2', x: 26, y: 12, type: 'spike' });

      blocks.push({ id: 'neon-q-1', x: 22, y: 6, type: 'question', contains: 'powerup-turbo' });

      blocks.push({ id: 'lift-neon-1', x: 32, y: 12, type: 'liftable' });

    } else if (theme === 'castle') {
      // Dark castle design
      for (let tx = 0; tx < totalTiles; tx++) {
        blocks.push({ id: `c-ceil1-${tx}`, x: tx, y: 0, type: 'castle-block' });
      }

      blocks.push({ id: 'c-block-1', x: 5, y: 9, type: 'castle-block' });
      blocks.push({ id: 'c-block-2', x: 6, y: 9, type: 'castle-block' });
      blocks.push({ id: 'c-q-1', x: 7, y: 9, type: 'question', contains: 'powerup-turbo' });

      blocks.push({ id: 'c-spike-1', x: 15, y: 12, type: 'spike' });
      blocks.push({ id: 'c-spike-2', x: 16, y: 12, type: 'spike' });

      blocks.push({ id: 'c-brick-1', x: 20, y: 8, type: 'brick' });
      blocks.push({ id: 'c-brick-2', x: 22, y: 8, type: 'brick' });
      blocks.push({ id: 'c-q-2', x: 24, y: 8, type: 'question', contains: 'powerup-fire' });
      blocks.push({ id: 'c-brick-3', x: 26, y: 8, type: 'brick' });

      blocks.push({ id: 'lift-castle-1', x: 41, y: 12, type: 'liftable' });
      blocks.push({ id: 'lift-castle-2', x: 42, y: 12, type: 'liftable' });
    }

    // Place SMW Goal gate at the end
    const lastTileX = totalTiles - 5;
    blocks.push({ id: 'goal-pole-left', x: lastTileX, y: 12, type: 'goal' });

    s.blocks = blocks;

    // 2. Spawn Enemies
    const enemies: Enemy[] = [];
    if (theme === 'green') {
      enemies.push({ id: 'en-1', x: 400, y: 350, width: 24, height: 24, vx: -1.2, vy: 0, type: 'champi', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-2', x: 650, y: 350, width: 24, height: 32, vx: -1.0, vy: 0, type: 'tortu', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-3', x: 900, y: 200, width: 24, height: 24, vx: -1.5, vy: 0, type: 'champi', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-4', x: 1200, y: 350, width: 24, height: 32, vx: -0.8, vy: 0, type: 'volador', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-5', x: 1500, y: 350, width: 24, height: 24, vx: -1.3, vy: 0, type: 'champi', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
    } else if (theme === 'cave') {
      enemies.push({ id: 'en-c1', x: 400, y: 350, width: 24, height: 24, vx: -1.4, vy: 0, type: 'champi', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-c2', x: 750, y: 350, width: 24, height: 32, vx: -1.2, vy: 0, type: 'tortu', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-c3', x: 1050, y: 350, width: 24, height: 32, vx: -1.0, vy: -5, type: 'volador', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-c4', x: 1400, y: 350, width: 24, height: 24, vx: -1.6, vy: 0, type: 'champi', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
    } else if (theme === 'sierra') {
      enemies.push({ id: 'en-s1', x: 420, y: 350, width: 24, height: 24, vx: -1.5, vy: 0, type: 'champi', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-s2', x: 700, y: 350, width: 24, height: 32, vx: -1.3, vy: 0, type: 'tortu', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-s3', x: 1100, y: 220, width: 24, height: 24, vx: -1.6, vy: 0, type: 'volador', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-s4', x: 1450, y: 350, width: 24, height: 24, vx: -1.8, vy: 0, type: 'champi', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
    } else if (theme === 'desert') {
      enemies.push({ id: 'en-d1', x: 450, y: 350, width: 24, height: 24, vx: -1.2, vy: 0, type: 'champi', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-d2', x: 800, y: 350, width: 24, height: 32, vx: -1.4, vy: 0, type: 'tortu', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-d3', x: 1150, y: 350, width: 24, height: 24, vx: -1.6, vy: 2, type: 'volador', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
    } else if (theme === 'neon') {
      enemies.push({ id: 'en-n1', x: 400, y: 350, width: 24, height: 24, vx: -2.0, vy: 0, type: 'champi', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-n2', x: 750, y: 350, width: 24, height: 32, vx: -1.6, vy: 0, type: 'tortu', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-n3', x: 1000, y: 150, width: 24, height: 24, vx: -2.2, vy: 0, type: 'volador', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-n4', x: 1350, y: 350, width: 24, height: 24, vx: -1.8, vy: 0, type: 'champi', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
    } else if (theme === 'castle') {
      enemies.push({ id: 'en-k1', x: 450, y: 350, width: 24, height: 32, vx: -1.4, vy: 0, type: 'tortu', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-k2', x: 700, y: 200, width: 24, height: 24, vx: -2.0, vy: 0, type: 'champi', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      enemies.push({ id: 'en-k3', x: 1000, y: 300, width: 24, height: 32, vx: -1.2, vy: -6, type: 'volador', hp: 1, state: 'walk', animationFrame: 0, facing: 'left' });
      
      // BOSS: Boss of Sierra ("Jefe de la Sierra") at end of castle
      enemies.push({
        id: 'boss-sierra',
        x: 1800,
        y: 200,
        width: 60,
        height: 64,
        vx: -1.0,
        vy: 0,
        type: 'jefe',
        hp: s.bossMaxHp,
        state: 'walk',
        animationFrame: 0,
        facing: 'left'
      });
    }

    s.enemies = enemies;
  }, [levelId, stats.activePowerUp]);

  // Game Loop Ticker
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    
    // Timer interval decrementing
    const timerInterval = setInterval(() => {
      if (!isPaused && !stateRef.current.levelFinished) {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handlePlayerDeath(); // times out = dead
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    const updatePhysicsAndDraw = () => {
      if (isPaused) {
        animId = requestAnimationFrame(updatePhysicsAndDraw);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(updatePhysicsAndDraw);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(updatePhysicsAndDraw);
        return;
      }

      const s = stateRef.current;
      
      // Clean canvas clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update Physics Loops
      gameLoopUpdate(s);

      // Camera follower smoothly centering on player
      const idealCamX = s.px - canvas.width / 2 + s.pWidth / 2;
      s.cameraX += (idealCamX - s.cameraX) * 0.1;
      // Clamp camera within levels
      s.cameraX = Math.max(0, Math.min(s.cameraX, s.levelLength - canvas.width));

      // Draw everything
      ctx.save();
      if (s.screenShake > 0) {
        const dx = (Math.random() - 0.5) * s.screenShake;
        const dy = (Math.random() - 0.5) * s.screenShake;
        ctx.translate(dx, dy);
      }
      
      drawLevelBackground(ctx, canvas, levelTheme, s.cameraX);
      drawLevelBlocks(ctx, s.blocks, s.cameraX);
      drawGoalTape(ctx, s, s.cameraX);
      drawEnemies(ctx, s.enemies, s.cameraX);
      drawProjectiles(ctx, s.projectiles, s.cameraX);
      drawFloatingTexts(ctx, s.texts, s.cameraX);
      drawParticles(ctx, s.particles, s.cameraX);
      drawPlayer(ctx, s, s.cameraX);
      drawWeatherParticles(ctx, s, levelTheme);
      ctx.restore();

      // Draw the beautiful interactive 16-bit console HUD overlay
      drawCanvasHUD(ctx, s, canvas);

      // CRT retro TV visual filter overlay (Scanlines + Screen vignette + subtle phosphor glow)
      if (crtEnabled) {
        // Horizontal CRT Scanlines (130ms pixel beam timing)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.09)';
        for (let y = 0; y < canvas.height; y += 3) {
          ctx.fillRect(0, y, canvas.width, 1.5);
        }

        // Sub-pixel phosphor vertical color lines grid (gives authentic SNES arcade screen vibe)
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
        for (let x = 0; x < canvas.width; x += 4) {
          ctx.fillRect(x, 0, 1.2, canvas.height);
        }
        ctx.restore();

        // Cozy dark vignette shadowing the vintage curved screen edges
        const vignetteGrad = ctx.createRadialGradient(
          canvas.width / 2,
          canvas.height / 2,
          canvas.width * 0.40,
          canvas.width / 2,
          canvas.height / 2,
          canvas.width * 0.74
        );
        vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
        ctx.fillStyle = vignetteGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Handle win/lose overlay visual conditions
      if (s.levelFinished) {
        // Dark overlay fading
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Win text flashing
        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.textAlign = 'center';
        
        const winText = levelId === 'level3' ? '🏆 ¡VICTORIA TOTAL EN LA SIERRA!' : '🎉 ¡NIVEL COMPLETADO!';
        ctx.strokeText(winText, canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillText(winText, canvas.width / 2, canvas.height / 2 - 10);

        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#ffffff';
        const sub = 'Sincronizando puntos y mapa...';
        ctx.strokeText(sub, canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 20);
      }

      animId = requestAnimationFrame(updatePhysicsAndDraw);
    };

    animId = requestAnimationFrame(updatePhysicsAndDraw);

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(timerInterval);
    };
  }, [isPaused, levelTheme, levelId, crtEnabled]);

  // Game Loop Logic
  const gameLoopUpdate = (s: typeof stateRef.current) => {
    const stoodOnGround = s.pOnGround;
    if (s.landSquish > 0) {
      s.landSquish *= 0.75;
      if (s.landSquish < 0.01) s.landSquish = 0;
    }

    // 0. Decrement shooting cooldowns if active
    if (s.fireCooldown > 0) s.fireCooldown--;
    if (s.iceCooldown > 0) s.iceCooldown--;
    if (s.screenShake > 0) {
      s.screenShake *= 0.9;
      if (s.screenShake < 0.2) s.screenShake = 0;
    }

    // 1. Invulnerable frames ticking
    if (s.pInvulnerableFrames > 0) {
      s.pInvulnerableFrames--;
    }

    // 2. Goal Gate ticker
    if (!s.levelFinished) {
      // Goal tape bouncing up and down continuously
      s.goalBarY += s.goalBarDirection * 1.5;
      if (s.goalBarY > 380) {
        s.goalBarY = 380;
        s.goalBarDirection = -1;
      } else if (s.goalBarY < 120) {
        s.goalBarY = 120;
        s.goalBarDirection = 1;
      }
    } else {
      // Winning sequence timer tickers
      s.finishTimer++;
      if (s.finishTimer > 150) {
        // Trigger completion callback
        onClearLevel(s.scoreAdded, s.coinsCollected);
      }
      // Stop keyboard movement
      s.pvx = 0;
      s.pvy += 0.5; // fall normally
      s.py += s.pvy;
      // floor clamp simple
      if (s.py > 352) {
        s.py = 352;
        s.pvy = 0;
      }
      return; // Skip normal play processes
    }

    // 3. Horizontal movement input acceleration with state buffer input priority
    const isLeftPressed = s.keys['ArrowLeft'] || s.keys['a'] || s.keys['A'] || touchKeysRef.current['ArrowLeft'];
    const isRightPressed = s.keys['ArrowRight'] || s.keys['d'] || s.keys['D'] || s.keys['ArrowRight'] === true || touchKeysRef.current['ArrowRight'];
    // Read turbo button 'b' (Shift / button B)
    const isTurboPressed = s.keys['Shift'] || s.keys['b'] || s.keys['B'] || touchKeysRef.current['Shift'];

    // Maintain input buffer history to prevent getting stuck on simultaneous touch/key actions
    if (!s.pInputDirectionBuffer) s.pInputDirectionBuffer = [];
    
    if (isLeftPressed) {
      if (!s.pInputDirectionBuffer.includes('left')) {
        s.pInputDirectionBuffer.push('left');
      }
    } else {
      s.pInputDirectionBuffer = s.pInputDirectionBuffer.filter((d: string) => d !== 'left');
    }

    if (isRightPressed) {
      if (!s.pInputDirectionBuffer.includes('right')) {
        s.pInputDirectionBuffer.push('right');
      }
    } else {
      s.pInputDirectionBuffer = s.pInputDirectionBuffer.filter((d: string) => d !== 'right');
    }

    // Determine the prioritized active movement direction from the buffer (last elements represent newest inputs)
    let activeDirection: 'left' | 'right' | null = null;
    if (s.pInputDirectionBuffer.length > 0) {
      activeDirection = s.pInputDirectionBuffer[s.pInputDirectionBuffer.length - 1] as 'left' | 'right';
    }

    // Move speed limits depending on turbo active mode and player type
    let speedMultiplier = 1.0;
    if (s.playerType === 'truck') {
      speedMultiplier = 1.45; // very fast monster truck!
    } else if (s.playerType === 'bike') {
      speedMultiplier = 1.35; // aerodynamic motorcycle!
    } else if (s.playerType === 'catquad') {
      speedMultiplier = 1.15; // fast neon four-wheeler!
    } else if (s.playerType === 'brocoliano') {
      speedMultiplier = 0.95; // roosters are slightly slower but fly
    }
    
    const maxWalkSpeed = (isTurboPressed ? 5.8 : 3.6) * speedMultiplier;
    const acceleration = 0.58 * speedMultiplier;
    const friction = s.playerType === 'truck' ? 0.85 : 0.72; // Snappier braking so player doesn't slide like on ice

    if (activeDirection === 'left') {
      s.pvx -= acceleration;
      s.pFacing = 'left';
    } else if (activeDirection === 'right') {
      s.pvx += acceleration;
      s.pFacing = 'right';
    } else {
      s.pvx *= friction;
      if (Math.abs(s.pvx) < 0.1) s.pvx = 0;
    }

    // Clamp speed limits
    s.pvx = Math.max(-maxWalkSpeed, Math.min(s.pvx, maxWalkSpeed));

    // Determine priority-based animation state
    // Priority order: 1. Jump (Airborne), 2. Duck (Crouch), 3. Walk, 4. Idle
    const isCrouchPressed = s.keys['ArrowDown'] || s.keys['s'] || s.keys['S'] || touchKeysRef.current['ArrowDown'];
    
    if (!s.pOnGround) {
      s.pAnimState = 'jump';
    } else if (isCrouchPressed) {
      s.pAnimState = 'duck';
    } else if (activeDirection !== null || Math.abs(s.pvx) > 0.1) {
      s.pAnimState = 'walk';
    } else {
      s.pAnimState = 'idle';
    }

    // Tick appropriate frame counts
    s.pAnimFrame = (s.pAnimFrame || 0) + 1;
    if (s.pAnimState === 'walk') {
      s.pWalkTick = (s.pWalkTick || 0) + (isTurboPressed ? 1.6 : 1.0);
    } else {
      s.pWalkTick = 0;
    }

    // 4. Vertical Jump parameters (A button / ArrowUp / Space / W)
    // REMOVED 'a' / 'A' keys to resolve fatal conflict with walking left
    const isJumpPressed = s.keys['ArrowUp'] || s.keys['Space'] || s.keys[' '] || s.keys['w'] || s.keys['W'] || touchKeysRef.current['ArrowUp'] || touchKeysRef.current['Space'];
    const gravity = 0.62;

    s.pvy += gravity;
    // Advanced Physics Simulation: Terminal velocity/air resistance clamp (prevents high-fall tile tunneling and jerky drops)
    if (s.pvy > 12.5) s.pvy = 12.5;

    // Hover flight for brocoliano!
    if (s.playerType === 'brocoliano' && !s.pOnGround && isJumpPressed && s.pvy > 0) {
      s.pvy = Math.min(s.pvy, 0.75); // restrict gravity descend speed (glide hover!)
      // Broccoli feathers
      if (Math.random() < 0.2) {
        s.particles.push({
          id: Math.random().toString(),
          x: s.px + (s.pFacing === 'left' ? s.pWidth : 0),
          y: s.py + s.pHeight / 2,
          vx: (Math.random() - 0.5) * 2 - (s.pFacing === 'right' ? 1.5 : -1.5),
          vy: (Math.random() - 0.5) * 1 + 0.5,
          color: '#2ecc71',
          size: Math.random() * 3 + 2,
          life: 0.8
        });
      }
    }

    if (s.pOnGround) {
      s.jumpCount = 0; // reset double jump count
    }

    // Capture jump transition for double-jumping with glasses
    const wasJumpKeyDown = s.wasJumpKeyDown || false;
    if (isJumpPressed && !wasJumpKeyDown) {
      if (s.pOnGround) {
        // First jump - tuned for snappier rise/fall with upgraded gravity
        s.pvy = isTurboPressed ? -12.5 : -10.8;
        s.pOnGround = false;
        audio.playJump();
        
        // Spawn tiny white jump cloud particles
        for (let i = 0; i < 5; i++) {
          s.particles.push({
            id: Math.random().toString(),
            x: s.px + s.pWidth / 2,
            y: s.py + s.pHeight,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 1,
            color: 'rgba(255,255,255,0.7)',
            size: Math.random() * 4 + 2,
            life: 1.0
          });
        }
      } else if (s.playerType === 'glasses' && s.jumpCount === 0) {
        // Perform double-jump mid-air!
        s.pvy = -10.2;
        s.jumpCount = 1;
        audio.playJump();

        // Sparkly crystal double jump particles!
        for (let i = 0; i < 8; i++) {
          s.particles.push({
            id: Math.random().toString(),
            x: s.px + s.pWidth / 2,
            y: s.py + s.pHeight / 2,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            color: '#f39c12',
            size: Math.random() * 3 + 3,
            life: 1.0
          });
        }
      }
    }
    s.wasJumpKeyDown = isJumpPressed;

    // Truck smash brick walls
    if (s.playerType === 'truck' && Math.abs(s.pvx) > 3.0) {
      s.blocks.forEach((b) => {
        if (b.type === 'brick') {
          const bx = b.x * 32;
          const by = b.y * 32;
          const playerBox = { x: s.px, y: s.py, width: s.pWidth, height: s.pHeight };
          if (
            playerBox.x + playerBox.width + 4 >= bx &&
            playerBox.x - 4 <= bx + 32 &&
            playerBox.y + playerBox.height >= by &&
            playerBox.y <= by + 32
          ) {
            // Crush/smash!
            b.type = 'empty-question'; // Turns to an empty hit block
            audio.playStomp();
            s.scoreAdded += 100;
            // Spawn stone particles
            for (let i = 0; i < 5; i++) {
              s.particles.push({
                id: Math.random().toString(),
                x: bx + 16,
                y: by + 16,
                vx: (Math.random() - 0.5) * 5,
                vy: -Math.random() * 4 - 2,
                color: '#7f8c8d',
                size: Math.random() * 4 + 3,
                life: 1.0
              });
            }
          }
        }
      });
    }

    // Separated Horizontal movement and collision check
    s.px += s.pvx;

    // Check level boundaries
    if (s.px < 0) s.px = 0;
    if (s.px > s.levelLength - s.pWidth) s.px = s.levelLength - s.pWidth;

    const tileSize = 32;

    // Pre-resolve horizontal block collisions (stops side-clipping and being stuck)
    s.blocks.forEach((b) => {
      if (b.type === 'lava' || b.type === 'empty-question') return;
      const bx = b.x * tileSize;
      const by = b.y * tileSize;

      // Vertical clearance: skip horizontal collisions if player is entirely above or below the block
      if (s.py + s.pHeight <= by + 1.5 || s.py >= by + tileSize - 1.5) return;

      if (
        s.px < bx + tileSize &&
        s.px + s.pWidth > bx
      ) {
        const oL = s.px + s.pWidth - bx;
        const oR = bx + tileSize - s.px;

        if (oL < oR) {
          // Colliding on progress to right
          if (b.type === 'liftable' && isTurboPressed) {
            s.blocks = s.blocks.filter((item) => item.id !== b.id);
            s.pPowerUp = 'turbo';
            s.texts.push({ id: Math.random().toString(), text: '¡Bloque Levantado!', x: bx, y: by - 10, life: 1.0 });
            audio.playPowerUp();
          } else {
            s.px -= oL;
            s.pvx = 0;
          }
        } else {
          // Colliding on progress to left
          if (b.type === 'liftable' && isTurboPressed) {
            s.blocks = s.blocks.filter((item) => item.id !== b.id);
            s.pPowerUp = 'turbo';
            s.texts.push({ id: Math.random().toString(), text: '¡Bloque Levantado!', x: bx, y: by - 10, life: 1.0 });
            audio.playPowerUp();
          } else {
            s.px += oR;
            s.pvx = 0;
          }
        }
      }
    });

    // Separated Vertical movement
    s.py += s.pvy;

    // Death if player falls to bottom pits
    if (s.py > s.levelHeight + 50) {
      handlePlayerDeath();
      return;
    }

    // 5. Collision checks with static blocks
    s.pOnGround = false;
    const playerBox = { x: s.px, y: s.py, width: s.pWidth, height: s.pHeight };

    s.blocks.forEach((b) => {
      const bx = b.x * tileSize;
      const by = b.y * tileSize;

      // Collides with block?
      if (
        playerBox.x < bx + tileSize &&
        playerBox.x + playerBox.width > bx &&
        playerBox.y < by + tileSize &&
        playerBox.y + playerBox.height > by
      ) {
        // Determine type of blocks effects
        if (b.type === 'lava') {
          handlePlayerDeath();
          return;
        }

        // Horizontal clearance: skip physical vertical resolution if they are not actually above/below
        if (playerBox.x + playerBox.width <= bx + 1.5 || playerBox.x >= bx + tileSize - 1.5) {
          return;
        }

        const oT = playerBox.y + playerBox.height - by;
        const oB = by + tileSize - playerBox.y;

        if (oT < oB) {
          // Land on top
          if (s.pvy >= 0) {
            s.py -= oT;
            s.pvy = 0;
            s.pOnGround = true;
            
            if (b.type === 'spike') {
              triggerPlayerDamage();
            }
          }
        } else {
          // Hit head from below!
          s.py += oB;
          s.pvy = 0;
          audio.playBlockHit();

          // Interact/bump blocks
          if (b.type === 'question') {
            b.type = 'empty-question';
            b.hitAnimationY = -10; // bounce it up visual cue
            audio.playCoin();

            // Reward
            if (b.contains === 'coin') {
              s.coinsCollected++;
              s.scoreAdded += 200;
              s.texts.push({ id: Math.random().toString(), text: '🪙 +200', x: bx, y: by - 12, life: 1.0 });
              onUpdateStats({ coins: stats.coins + 1, score: stats.score + 200 });
              s.screenShake = 5.0; // Juicy impact shake!

              // Gorgeous coin particle burst
              for (let i = 0; i < 10; i++) {
                s.particles.push({
                  id: Math.random().toString(),
                  x: bx + tileSize / 2,
                  y: by + tileSize / 2,
                  vx: (Math.random() - 0.5) * 5,
                  vy: (Math.random() - 0.5) * 4 - 2.5,
                  color: i % 2 === 0 ? '#facc15' : '#ffffff',
                  size: Math.random() * 4 + 2,
                  life: 1.0
                });
              }
            } else if (b.contains === 'powerup-fire') {
              s.pPowerUp = 'fire';
              s.texts.push({ id: Math.random().toString(), text: '🔥 FUEGO', x: bx, y: by - 12, life: 1.0 });
              onUpdateStats({ activePowerUp: 'fire' });
              audio.playPowerUp();
              s.screenShake = 6.5;

              // Fire powerup burst
              for (let i = 0; i < 12; i++) {
                s.particles.push({
                  id: Math.random().toString(),
                  x: bx + tileSize / 2,
                  y: by + tileSize / 2,
                  vx: (Math.random() - 0.5) * 6,
                  vy: (Math.random() - 0.5) * 5 - 3,
                  color: i % 3 === 0 ? '#ff4757' : (i % 3 === 1 ? '#ffa502' : '#facc15'),
                  size: Math.random() * 5 + 2.5,
                  life: 1.0
                });
              }
            } else if (b.contains === 'powerup-ice') {
              s.pPowerUp = 'ice';
              s.texts.push({ id: Math.random().toString(), text: '❄️ HIELO', x: bx, y: by - 12, life: 1.0 });
              onUpdateStats({ activePowerUp: 'ice' });
              audio.playPowerUp();
              s.screenShake = 6.5;

              // Ice powerup burst
              for (let i = 0; i < 12; i++) {
                s.particles.push({
                  id: Math.random().toString(),
                  x: bx + tileSize / 2,
                  y: by + tileSize / 2,
                  vx: (Math.random() - 0.5) * 6,
                  vy: (Math.random() - 0.5) * 5 - 3,
                  color: i % 2 === 0 ? '#70a1ff' : '#00f7ff',
                  size: Math.random() * 4.5 + 2.5,
                  life: 1.0
                });
              }
            } else if (b.contains === 'powerup-turbo') {
              s.pPowerUp = 'turbo';
              s.texts.push({ id: Math.random().toString(), text: '⚡ TURBO', x: bx, y: by - 12, life: 1.0 });
              onUpdateStats({ activePowerUp: 'turbo' });
              audio.playPowerUp();
              s.screenShake = 6.5;

              // Turbo powerup burst
              for (let i = 0; i < 12; i++) {
                s.particles.push({
                  id: Math.random().toString(),
                  x: bx + tileSize / 2,
                  y: by + tileSize / 2,
                  vx: (Math.random() - 0.5) * 6,
                  vy: (Math.random() - 0.5) * 5 - 3,
                  color: i % 3 === 0 ? '#ff007f' : (i % 3 === 1 ? '#00f7ff' : '#facc15'),
                  size: Math.random() * 4 + 2,
                  life: 1.0
                });
              }
            }
          } else if (b.type === 'brick') {
            // Bricks break or push
            s.blocks = s.blocks.filter((item) => item.id !== b.id);
            s.screenShake = 4.5; // Solid block breaking shake!

            // Spawn brick particles
            for (let i = 0; i < 8; i++) {
              s.particles.push({
                id: Math.random().toString(),
                x: bx + 16,
                y: by + 16,
                vx: (Math.random() - 0.5) * 5,
                vy: -Math.random() * 5 - 1.5,
                color: '#b05a2b',
                size: Math.random() * 4.5 + 3.5,
                life: 1.0
              });
            }
          }
        }
      }
    });

    if (s.pOnGround && !stoodOnGround) {
      s.landSquish = 0.28;
    }

    // Continuous running & sliding dust/mud trails (Improvement #5 & #8)
    if (s.pOnGround && Math.abs(s.pvx) > 0.8 && Math.random() < 0.28) {
      let dustColor = '#95a5a6'; // default generic gravel
      if (levelTheme === 'green') {
        dustColor = '#2ecc71'; // green grass clippings
      } else if (levelTheme === 'cave') {
        dustColor = '#4b6584'; // misty water damp slate dust
      } else if (levelTheme === 'sierra') {
        dustColor = '#778ca3'; // mountain gravel dust
      } else if (levelTheme === 'desert') {
        dustColor = '#81512c'; // clay warm mud splats
      } else if (levelTheme === 'neon') {
        dustColor = '#00fbff'; // cyan glowing electric discharge spark
      } else if (levelTheme === 'castle') {
        dustColor = '#e74c3c'; // fiery volcanic spark embers
      }

      s.particles.push({
        id: Math.random().toString(),
        x: s.px + s.pWidth / 2 - (s.pvx > 0 ? 6 : -6),
        y: s.py + s.pHeight - 2,
        vx: -s.pvx * 0.4 + (Math.random() - 0.5) * 1.2,
        vy: -Math.random() * 1.5 - 0.5,
        color: dustColor,
        size: Math.random() * 3 + 1.5,
        life: 0.6 + Math.random() * 0.4
      });
    }

    // 6. SELECT Trampas / Devices mechanic trigger (create temporary block blocks!)
    // If SELECT pressed & let's check cooldown
    const isSelectPressed = s.keys['Select'] || s.keys['select'] || s.keys['Control'] || s.keys['c_select'] || s.keys['Alt'] || touchKeysRef.current['Select'];
    if (isSelectPressed && s.trapsPlaced < s.trapsMax) {
      // Find grid coordinate directly ahead
      const nextGridX = Math.round((s.px + (s.pFacing === 'right' ? 36 : -36)) / tileSize);
      const nextGridY = Math.round((s.py + 10) / tileSize);

      // Verify no block already exists there
      const collidesWithExisting = s.blocks.some((b) => b.x === nextGridX && b.y === nextGridY);
      if (!collidesWithExisting) {
        const id = `trap-${nextGridX}-${nextGridY}`;
        s.blocks.push({
          id,
          x: nextGridX,
          y: nextGridY,
          type: 'trampa'
        });
        s.trapsPlaced++;
        audio.playCoin(); // fun coin beep

        s.texts.push({
          id: Math.random().toString(),
          text: '🟨 TRAMPA',
          x: nextGridX * tileSize,
          y: nextGridY * tileSize - 10,
          life: 1.0
        });

        // Decay timer to delete block in 4 seconds
        setTimeout(() => {
          stateRef.current.blocks = stateRef.current.blocks.filter((bx) => bx.id !== id);
          stateRef.current.trapsPlaced = Math.max(0, stateRef.current.trapsPlaced - 1);
          // Spawn golden fading sparkles
          stateRef.current.particles.push({
            id: Math.random().toString(),
            x: nextGridX * tileSize + 16,
            y: nextGridY * tileSize + 16,
            vx: 0,
            vy: -1,
            color: '#facc15',
            size: 8,
            life: 1.0
          });
        }, 4000);
      }
      // Reset trigger to avoid high rate spawning
      onPressKey('select', false);
    }

    // 7. Fire Power-up / Ice Power-up Shooting (Buttons Y & X / 'C' & 'X')
    const isFirePressed = s.keys['c'] || s.keys['C'] || s.keys['y'] || s.keys['Y'] || touchKeysRef.current['c'];
    const isIcePressed = s.keys['x'] || s.keys['X'] || s.keys['d'] || s.keys['D'] || touchKeysRef.current['x'];

    if (isFirePressed && s.fireCooldown === 0) {
      s.fireCooldown = 15; // Rate of fire cooldown frames
      s.screenShake = 3.5; // Slight punchy kickback screen shake!

      const shootX = s.px + (s.pFacing === 'right' ? s.pWidth : -10);
      const shootY = s.py + 8;
      const isFirePower = s.pPowerUp === 'fire';
      const pvx = s.pFacing === 'right' ? (isFirePower ? 5 : 4.5) : (isFirePower ? -5 : -4.5);

      s.projectiles.push({
        id: Math.random().toString(),
        x: shootX,
        y: shootY,
        vx: pvx,
        vy: isFirePower ? 2 : 1.5,
        type: isFirePower ? 'fire' : 'rock',
        bounces: isFirePower ? 3 : 2
      });
      audio.playShoot();

      // Bullet spark muzzle flare particles
      const pColor = isFirePower ? '#ffa502' : '#834c14';
      for (let i = 0; i < 6; i++) {
        s.particles.push({
          id: Math.random().toString(),
          x: shootX,
          y: shootY,
          vx: (s.pFacing === 'right' ? 1.5 : -1.5) + (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          color: i % 2 === 0 ? pColor : '#ff4757',
          size: Math.random() * 3 + 1.5,
          life: 0.8
        });
      }
    }

    if (isIcePressed && s.iceCooldown === 0) {
      s.iceCooldown = 15;
      s.screenShake = 3.5;

      const shootX = s.px + (s.pFacing === 'right' ? s.pWidth : -10);
      const shootY = s.py + 8;
      const isIcePower = s.pPowerUp === 'ice';
      const pvx = s.pFacing === 'right' ? (isIcePower ? 4.5 : 4.2) : (isIcePower ? -4.5 : -4.2);

      s.projectiles.push({
        id: Math.random().toString(),
        x: shootX,
        y: shootY,
        vx: pvx,
        vy: isIcePower ? 2 : 1.5,
        type: isIcePower ? 'ice' : 'spark',
        bounces: isIcePower ? 3 : 2
      });
      audio.playShoot();

      // Ice/Spark muzzle flare particles
      const pColor = isIcePower ? '#70a1ff' : '#00f7ff';
      for (let i = 0; i < 6; i++) {
        s.particles.push({
          id: Math.random().toString(),
          x: shootX,
          y: shootY,
          vx: (s.pFacing === 'right' ? 1.5 : -1.5) + (Math.random() - 0.5) * 3,
          vy: (Math.random() - 0.5) * 3,
          color: i % 2 === 0 ? pColor : '#ffffff',
          size: Math.random() * 3 + 1.5,
          life: 0.8
        });
      }
    }

    // 8. Update Projectiles
    s.projectiles = s.projectiles.filter((p) => {
      p.vy += 0.3; // gravity for bouncy fireballs
      p.x += p.vx;
      p.y += p.vy;

      // Bounce on block check (only once per frame per projectile to allow multiple hops)
      let bounceCount = p.bounces || 0;
      let bouncedInThisFrame = false;
      s.blocks.forEach((b) => {
        if (bouncedInThisFrame) return;
        const bx = b.x * tileSize;
        const by = b.y * tileSize;

        if (
          p.x > bx && p.x < bx + tileSize &&
          p.y > by && p.y < by + tileSize
        ) {
          p.vy = -3.5; // bounce up
          bounceCount--;
          bouncedInThisFrame = true;
        }
      });

      p.bounces = bounceCount;

      // Keep if within world boundaries & bounces left
      return p.x > s.cameraX && p.x < s.cameraX + 700 && p.y < 480 && (bounceCount >= 0);
    });

    // 9. Update Enemies
    s.enemies.forEach((en) => {
      if (en.state === 'squished') return;

      const tileSize = 32;

      // Initialize defaults on enemy model if not present (Typescript safe)
      if (en.trafficLightState === undefined) {
        en.trafficLightState = Math.random() < 0.5 ? 'green' : 'yellow';
        en.trafficTimer = Math.floor(Math.random() * 120 + 60);
        en.isAlerted = false;
        en.alertCooldown = 0;
        en.soundPlayed = false;
        en.patrolBaseVx = en.vx || -1.2;
      }

      // Check distance to Player
      const dx = s.px - en.x;
      const dy = s.py - en.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isPlayerVulnerable = s.pInvulnerableFrames <= 0;

      // BOSS PATTERN
      if (en.type === 'jefe') {
        s.bossActive = true;
        // Boss moves back and forth in its volcano / sierra peaks
        if (en.x < 1550) {
          en.vx = 1.0;
          en.facing = 'right';
        } else if (en.x > 1850) {
          en.vx = -1.0;
          en.facing = 'left';
        }

        // If player is close, the boss gets super angry (flashing fireballs quickly)
        const isPlayerNearBoss = dist < 240;
        const fireChance = isPlayerNearBoss ? 0.035 : 0.015;

        // Procedural Fire Spit from Boss!
        if (Math.random() < fireChance && !s.levelFinished) {
          const bvx = dx > 0 ? 3.5 : -3.5;
          s.projectiles.push({
            id: Math.random().toString(),
            x: en.x + (en.facing === 'right' ? en.width : -10),
            y: en.y + 16,
            vx: bvx,
            vy: -1.5,
            type: 'fire',
            bounces: 1
          });
          audio.playShoot();
        }

        // Move Boss
        en.x += en.vx;
        en.y += en.vy;
        return; // Skip standard enemy routine
      }

      // STANDARD ENEMY AI ROUTINE (champi, tortu, volador)
      if (en.state !== 'frozen') {
        const ALERT_RANGE = 200;

        // PLAYER PROXIMITY REACTION (Sensing Range)
        if (dist < ALERT_RANGE && isPlayerVulnerable && !s.levelFinished) {
          // If newly alerted, spawn gorgeous dynamic effects!
          if (!en.isAlerted) {
            en.isAlerted = true;
            en.trafficLightState = 'green'; // Break gridlock cycle to chase!
            
            // Traditional urban/sierra alert bubbles
            let dialogue = '🚗 ¡HORA PICO!';
            if (en.type === 'tortu') dialogue = '🚛 ¡OBSTÁCULO CARRETERA!';
            if (en.type === 'volador') dialogue = '🦅 ¡HURACÁN SIERRA!';

            s.texts.push({
              id: Math.random().toString(),
              text: dialogue,
              x: en.x - 15,
              y: en.y - 18,
              life: 1.2
            });

            // Play nice, interactive wake alert sound
            audio.playPowerUp();

            // Emit wake dust smoke particles!
            for (let i = 0; i < 5; i++) {
              s.particles.push({
                id: Math.random().toString(),
                x: en.x + en.width / 2,
                y: en.y + en.height,
                vx: (Math.random() - 0.5) * 4,
                vy: -Math.random() * 3,
                color: 'rgba(255, 255, 255, 0.7)',
                size: Math.random() * 3 + 2,
                life: 0.8
              });
            }
          }

          // ALERT STATE PHYSICS (Reactive Chasing or Swooping)
          if (en.type === 'volador') {
            // Swooping air traffic: glides directly down pointing towards the user like an eagle or high-speed drone!
            const angle = Math.atan2(dy, dx);
            const flyerAlertSpeed = 2.4;
            en.vx = Math.cos(angle) * flyerAlertSpeed;
            en.vy = Math.sin(angle) * flyerAlertSpeed;
            en.facing = en.vx > 0 ? 'right' : 'left';
          } else {
            // Land Patrollers (champi/tortu): Rush-Hour acceleration!
            const rushMultiplier = en.type === 'champi' ? 1.8 : 1.4;
            const targetSpeed = Math.abs(en.patrolBaseVx || 1.2) * rushMultiplier;
            
            // To prevent direction-flip jittering when extremely close (overlapping), only update direction if not overlapping too close
            if (Math.abs(dx) > 6) {
              en.vx = dx > 0 ? targetSpeed : -targetSpeed;
              en.facing = en.vx > 0 ? 'right' : 'left';
            }

            // Apply light gravity so they fall on cliffs
            en.vy += 0.25;

            // Sierra Leap/Hop adaptation: If they face a blockage or wall while chasing player,
            // they execute a rugged vertical mountain leap of faith to scale obstacles/ledges!
            let isBlockedAhead = false;
            s.blocks.forEach((b) => {
              const bx = b.x * tileSize;
              const by = b.y * tileSize;
              const nextStepX = en.x + en.vx * 3;
              if (
                nextStepX < bx + tileSize &&
                nextStepX + en.width > bx &&
                en.y < by + tileSize &&
                en.y + en.height > by &&
                b.type !== 'lava' && b.type !== 'empty-question'
              ) {
                isBlockedAhead = true;
              }
            });

            // Also jump if player is on a higher ledge and we are directly underneath
            const isPlayerAbove = dy < -32 && Math.abs(dx) < 60;
            const canJump = en.vy === 0 || Math.abs(en.vy) < 0.2; // roughly grounded

            // If physically blocked ahead, jump immediately to scale obstacles; otherwise jump with chance if player is above
            const shouldScaleObstacle = isBlockedAhead && canJump;
            if ((shouldScaleObstacle || (isPlayerAbove && canJump && Math.random() < 0.04))) {
              en.vy = -5.8; // beautiful mountain hop
              s.texts.push({
                id: Math.random().toString(),
                text: '🧗 ¡SALTO SIERRA!',
                x: en.x,
                y: en.y - 12,
                life: 0.7
              });
            }
          }
        } else {
          // PATROLLING STATE (Peaceful mountain road / Traffic light simulator)
          if (en.isAlerted) {
            // Lost track of the player: resume calmness with a funny "traffic resolved" bubble!
            en.isAlerted = false;
            en.trafficLightState = 'yellow';
            en.trafficTimer = 80;
            s.texts.push({
              id: Math.random().toString(),
              text: '🟢 FLUJO LIBRE',
              x: en.x - 10,
              y: en.y - 12,
              life: 0.8
            });
          }

          // Cycle traffic signaling
          en.trafficTimer = (en.trafficTimer || 60) - 1;
          if (en.trafficTimer <= 0) {
            if (en.trafficLightState === 'green') {
              en.trafficLightState = 'yellow';
              en.trafficTimer = Math.floor(Math.random() * 80 + 50);
            } else if (en.trafficLightState === 'yellow') {
              en.trafficLightState = 'red';
              en.trafficTimer = Math.floor(Math.random() * 60 + 40); // red lights are brief pauses
            } else {
              en.trafficLightState = 'green';
              en.trafficTimer = Math.floor(Math.random() * 140 + 100);
            }
          }

          // Compute velocities based on Signal Phase
          if (en.type === 'volador') {
            // Flying beetle floats symmetrically with wind drafts:
            en.vy += 0.15;
            if (en.y > 330) {
              en.vy = -4.5; // Constant high altitude floating bounce
            }
            
            // Horizontal speed adapts to traffic signaling
            const currentDir = (en.patrolBaseVx || -1.2) > 0 ? 1 : -1;
            const origSpeed = Math.abs(en.patrolBaseVx || 1.2);
            if (en.trafficLightState === 'green') {
              en.vx = currentDir * origSpeed;
            } else if (en.trafficLightState === 'yellow') {
              en.vx = currentDir * origSpeed * 0.4;
            } else {
              en.vx = 0; // Hover in place safely
            }
            en.facing = (en.vx !== 0 ? en.vx : currentDir) > 0 ? 'right' : 'left';
          } else {
            // Land Patrollers (champi/tortu)
            en.vy += 0.25; // gravity

            const currentDir = (en.patrolBaseVx || -1.2) > 0 ? 1 : -1;
            const origSpeed = Math.abs(en.patrolBaseVx || 1.2);
            if (en.trafficLightState === 'green') {
              en.vx = currentDir * origSpeed;
            } else if (en.trafficLightState === 'yellow') {
              en.vx = currentDir * origSpeed * 0.35; // slow braking crawl
            } else {
              en.vx = 0; // Complete STOP in traffic
              
              // Spasmodically honk or play smoke puffs!
              if (Math.random() < 0.005) {
                const hornText = en.type === 'tortu' ? '📯 ¡BEEP BEEP!' : '🚦 EN ALTO';
                s.texts.push({
                  id: Math.random().toString(),
                  text: hornText,
                  x: en.x,
                  y: en.y - 12,
                  life: 0.9
                });
                audio.playCoin(); // soft mini coin click as honk tone
              }
            }
            
            if (en.vx !== 0) {
              en.facing = en.vx > 0 ? 'right' : 'left';
            }

            // Sierra Cliff Edge Caution: Prevent standard crawlers from suiciding off cliffs
            const checkDist = en.vx > 0 ? en.width + 12 : -12;
            const stepGridX = Math.floor((en.x + checkDist) / tileSize);
            const stepBelowGridY = Math.floor((en.y + en.height + 15) / tileSize);
            
            let hasValidGroundAhead = false;
            s.blocks.forEach((b) => {
              if (b.x === stepGridX && b.y === stepBelowGridY) {
                if (b.type === 'ground' || b.type === 'brick' || b.type === 'castle-block' || b.type === 'pipe') {
                  hasValidGroundAhead = true;
                }
              }
            });

            // If walking into a cliff abyss during normal patrol, they execute defensive safety braking!
            if (!hasValidGroundAhead && en.vx !== 0) {
              // turn around immediately
              en.patrolBaseVx = -(en.patrolBaseVx || -1.2);
              en.vx = -en.vx;
              en.facing = en.vx > 0 ? 'right' : 'left';
              
              s.texts.push({
                id: Math.random().toString(),
                text: '🛑 ¡BORDE ABISAL!',
                x: en.x - 10,
                y: en.y - 12,
                life: 0.7
              });
            }
          }
        }
      } else {
        // FROZEN STATE: No movement at all
        en.vx = 0;
        en.vy = 0;
      }

      // INTEGRATE VELOCITIES & APPLY COLLISION HOOKS
      en.x += en.vx;
      en.y += en.vy;

      // Handle vertical terrain floor collision for land enemies walking on blocks
      if (en.type !== 'volador') {
        s.blocks.forEach((b) => {
          if (b.type === 'lava' || b.type === 'empty-question') return;
          const bx = b.x * tileSize;
          const by = b.y * tileSize;

          // Perform Standard AABB box resolving overlap
          if (
            en.x < bx + tileSize &&
            en.x + en.width > bx &&
            en.y < by + tileSize &&
            en.y + en.height > by
          ) {
            const oL = en.x + en.width - bx;
            const oR = bx + tileSize - en.x;
            const oT = en.y + en.height - by;
            const oB = by + tileSize - en.y;

            const minOverlap = Math.min(oL, oR, oT, oB);

            if (minOverlap === oT && en.vy >= 0) {
              // Stand solid on the block top
              en.y -= oT;
              en.vy = 0;
            } else if (minOverlap === oB && en.vy <= 0) {
              // Colliding head bottom
              en.y += oB;
              en.vy = 0.1;
            } else if (minOverlap === oL) {
              // Turn on side collision to continue patrol elsewhere
              en.x -= oL;
              en.patrolBaseVx = -Math.abs(en.patrolBaseVx || 1.2);
              en.vx = -Math.abs(en.vx || 1.2);
              en.facing = 'left';
            } else if (minOverlap === oR) {
              en.x += oR;
              en.patrolBaseVx = Math.abs(en.patrolBaseVx || 1.2);
              en.vx = Math.abs(en.vx || 1.2);
              en.facing = 'right';
            }
          }
        });

        // Safe clamp back into the visual ground box (prevent falling past screen pits unless they explicitly die)
        if (en.y > 350) {
          en.y = 350;
          en.vy = 0;
        }
      }

      // Verify bounds checks on maps limits
      if (en.x < 0) {
        en.x = 0;
        en.patrolBaseVx = Math.abs(en.patrolBaseVx || 1.2);
        en.vx = Math.abs(en.vx);
        en.facing = 'right';
      }
      if (en.x > s.levelLength - en.width) {
        en.x = s.levelLength - en.width;
        en.patrolBaseVx = -Math.abs(en.patrolBaseVx || 1.2);
        en.vx = -Math.abs(en.vx);
        en.facing = 'left';
      }

      // Check bullet / projectile collisions on enemy
      s.projectiles.forEach((p) => {
        if (p.bounces !== undefined && p.bounces < 0) return; // already spent
        if (
          p.x > en.x && p.x < en.x + en.width &&
          p.y > en.y && p.y < en.y + en.height
        ) {
          // Trigger blast!
          if (p.type === 'fire' || p.type === 'rock') {
            en.hp -= 1;
            // spawn hit fire sparkles
            s.texts.push({ id: Math.random().toString(), text: p.type === 'fire' ? '💥 BOOM' : '💥 RETRO', x: en.x, y: en.y - 12, life: 1.0 });
            audio.playStomp();
            p.bounces = -1; // consume projectile!
          } else if (p.type === 'ice' || p.type === 'spark') {
            en.state = 'frozen';
            en.frozenTime = 120; // frozen for some frames
            s.texts.push({ id: Math.random().toString(), text: p.type === 'ice' ? '❄️ CONGELADO' : '⚡ PARÁLISIS', x: en.x, y: en.y - 12, life: 1.0 });
            audio.playCoin();
            p.bounces = -1; // consume projectile!
          }

          // If defeated
          if (en.hp <= 0 && en.type !== 'jefe') {
            en.state = 'squished';
            s.scoreAdded += 400;
            s.screenShake = 5.5; // Epic impact shake
            
            // Spawn splatter of sparks
            for (let i = 0; i < 10; i++) {
              s.particles.push({
                id: Math.random().toString(),
                x: en.x + en.width / 2,
                y: en.y + en.height / 2,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 5 - 1.5,
                color: i % 2 === 0 ? '#e74c3c' : '#f1c40f',
                size: Math.random() * 4 + 2,
                life: 1.0
              });
            }
          } else if (en.hp <= 0 && en.type === 'jefe') {
            // Defeated Boss!
            en.state = 'squished';
            s.scoreAdded += 5000;
            s.texts.push({ id: Math.random().toString(), text: '⭐ +5000 Jefe Eliminado', x: en.x, y: en.y - 20, life: 1.0 });
            s.screenShake = 16.0; // Massive terminal blow screen shake!

            // Massive fireworks star cluster
            for (let t = 0; t < 45; t++) {
              s.particles.push({
                id: Math.random().toString(),
                x: en.x + en.width / 2,
                y: en.y + en.height / 2,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 0.5) * 10 - 4,
                color: `hsl(${Math.random() * 360}, 100%, 65%)`, // Multicolor festive rainbow!
                size: Math.random() * 6 + 2.5,
                life: 1.2
              });
            }
            
            // Spawn sparkly Golden Star item to secure win!
            s.blocks.push({
              id: 'gold-star-win',
              x: Math.floor(en.x / tileSize),
              y: Math.floor(en.y / tileSize),
              type: 'goal'
            });
            audio.playClear();
          }
        }
      });

      // Handle Frozen state aging
      if (en.state === 'frozen' && en.frozenTime !== undefined) {
        en.frozenTime--;
        if (en.frozenTime <= 0) {
          en.state = 'walk'; // thaw out
        }
      }

      // Enemy Player collision check
      if (
        playerBox.x < en.x + en.width &&
        playerBox.x + playerBox.width > en.x &&
        playerBox.y < en.y + en.height &&
        playerBox.y + playerBox.height > en.y
      ) {
        if (en.state === 'frozen') {
          // Slide frozen block! (Awesome SMW mechanic)
          en.vx = s.pFacing === 'right' ? 6 : -6;
          audio.playStomp();
        } else if (s.pvy > 0 && s.py + s.pHeight - s.pvy <= en.y + 12) {
          // Bounce/Stomp on head!
          s.pvy = -6.5; // bounce
          audio.playStomp();

          if (en.type === 'jefe') {
            en.hp -= 1;
            s.screenShake = 9.0; // Heavy boss stomp rattle
            s.texts.push({ id: Math.random().toString(), text: `💥 HP: ${en.hp}`, x: en.x, y: en.y - 15, life: 1.0 });
            
            // Spawn spark flares on boss stomp
            for (let i = 0; i < 15; i++) {
              s.particles.push({
                id: Math.random().toString(),
                x: en.x + en.width / 2,
                y: en.y + en.height / 2,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 5 - 2,
                color: i % 2 === 0 ? '#ff4757' : '#facc15',
                size: Math.random() * 4.5 + 2,
                life: 1.0
              });
            }

            if (en.hp <= 0) {
              en.state = 'squished';
              s.scoreAdded += 5000;
              s.screenShake = 18.0; // Extreme climax shake!

              // Rainbow star explosion
              for (let t = 0; t < 40; t++) {
                s.particles.push({
                  id: Math.random().toString(),
                  x: en.x + en.width / 2,
                  y: en.y + en.height / 2,
                  vx: (Math.random() - 0.5) * 12,
                  vy: (Math.random() - 0.5) * 10 - 4,
                  color: `hsl(${Math.random() * 360}, 100%, 60%)`,
                  size: Math.random() * 5 + 3,
                  life: 1.2
                });
              }

              // Spawn victory reward star
              s.blocks.push({ id: 'boss-star', x: Math.floor(en.x / tileSize), y: Math.floor(en.y / tileSize), type: 'goal' });
              audio.playClear();
            }
          } else {
            en.state = 'squished';
            s.scoreAdded += 300;
            s.texts.push({ id: Math.random().toString(), text: '+300', x: en.x, y: en.y - 10, life: 1.0 });
            s.screenShake = 5.0; // Standard stomp screen shake

            // Green/Purple champi squish particles
            for (let i = 0; i < 10; i++) {
              s.particles.push({
                id: Math.random().toString(),
                x: en.x + en.width / 2,
                y: en.y + en.height / 2,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 5 - 2,
                color: i % 2 === 0 ? '#a55eea' : '#26de81',
                size: Math.random() * 4 + 2,
                life: 1.0
              });
            }
          }
        } else {
          // Player receives damage or gets powerdown
          triggerPlayerDamage();
        }
      }
    });

    // Remove squished enemies
    s.enemies = s.enemies.filter((en) => en.state !== 'squished');

    // 10. Check SMW level goal pole triggers
    s.blocks.forEach((b) => {
      if (b.type === 'goal') {
        const bx = b.x * tileSize;
        if (
          s.px + s.pWidth >= bx &&
          s.px <= bx + tileSize &&
          !s.levelFinished
        ) {
          // Cross Goal line! Play victory fanfare immediately
          s.levelFinished = true;
          s.finishTimer = 0;
          audio.playClear();
          s.pvy = -3; // leap forward
        }
      }
    });

    // 11. Particles Update
    s.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      
      // Decelerate from air resistance
      p.vx *= 0.96;
      
      // Apply buoyancy/gravity based on particle color/type archetype
      if (p.color === '#ffa502' || p.color === '#ff4757') {
        p.vy -= 0.08; // Fire/heat drifts upwards
      } else if (p.color === '#70a1ff' || p.color === '#00f7ff') {
        p.vy += 0.04; // Cold sparkles/cyan electricity drift softly
      } else if (p.color === '#834c14') {
        p.vy += 0.18; // Heavy rock shards collapse rapidly
      } else if (p.color === 'rgba(255,255,255,0.7)' || p.color === '#ffffff') {
        p.vy -= 0.02; // Smoke puff puff floats slightly
      } else {
        p.vy += 0.02; // Default micro debris
      }
      
      p.life -= 0.022; // Slightly slower, smoother fade out
    });
    s.particles = s.particles.filter((p) => p.life > 0);

    // 12. Floating texts update
    s.texts.forEach((tx) => {
      tx.y -= 0.8;
      tx.life -= 0.02;
    });
    s.texts = s.texts.filter((t) => t.life > 0);

    // 13. Weather particles update group
    const camDeltaX = s.cameraX - (s.lastCameraX || 0);
    s.lastCameraX = s.cameraX;

    // Lightning ticker (sierra theme)
    if (levelTheme === 'sierra') {
      if (s.lightningTimer > 0) {
        s.lightningTimer--;
      } else {
        // Very rare lightning strikes
        if (Math.random() < 0.0015) {
          s.lightningTimer = 10 + Math.floor(Math.random() * 15);
          s.screenShake = 6 + Math.random() * 8;
        }
      }
    }

    // Spawn theme-specific weather particles
    const maxParticlesLimit = 120;
    if (s.weatherParticles.length < maxParticlesLimit) {
      if (levelTheme === 'sierra') {
        const spawnCount = Math.random() < 0.5 ? 2 : 3;
        for (let idx = 0; idx < spawnCount; idx++) {
          s.weatherParticles.push({
            id: `rain-${Date.now()}-${Math.random()}`,
            x: Math.random() * 660 - 20,
            y: -15,
            vx: -2.0 - Math.random() * 1.5,
            vy: 9.0 + Math.random() * 4.0,
            color: 'rgba(165, 185, 230, 0.45)',
            size: 1 + Math.random() * 0.8,
            life: 1.0,
            type: 'rain',
            length: 12 + Math.random() * 10,
          });
        }
      } else if (levelTheme === 'desert' || levelTheme === 'green') {
        if (Math.random() < 0.35) {
          const isSunset = levelTheme === 'green';
          s.weatherParticles.push({
            id: `haze-${Date.now()}-${Math.random()}`,
            x: Math.random() * 640,
            y: 480 + 10,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -1.0 - Math.random() * 1.2,
            color: isSunset ? 'rgba(235, 94, 85, 0.16)' : 'rgba(253, 190, 68, 0.15)',
            size: 6 + Math.random() * 8,
            life: 1.0,
            type: 'haze',
            swaySpeed: 0.02 + Math.random() * 0.03,
          });
        }
      } else if (levelTheme === 'cave') {
        if (Math.random() < 0.08) {
          s.weatherParticles.push({
            id: `drop-${Date.now()}-${Math.random()}`,
            x: Math.random() * 640,
            y: Math.random() * 30 + 5,
            vx: 0,
            vy: 1.2 + Math.random() * 1.5,
            color: 'rgba(120, 224, 255, 0.75)',
            size: 1.5 + Math.random() * 1.2,
            life: 1.0,
            type: 'drop',
          });
        }
        if (Math.random() < 0.02 && s.weatherParticles.filter(p => p.type === 'fog').length < 6) {
          s.weatherParticles.push({
            id: `fog-${Date.now()}-${Math.random()}`,
            x: -120,
            y: 320 + Math.random() * 120,
            vx: 0.4 + Math.random() * 0.5,
            vy: (Math.random() - 0.5) * 0.15,
            color: 'rgba(180, 210, 240, 0.08)',
            size: 40 + Math.random() * 30,
            life: 1.0,
            type: 'fog',
          });
        }
      } else if (levelTheme === 'neon') {
        if (Math.random() < 0.2) {
          const colors = ['rgba(0, 247, 255, 0.55)', 'rgba(255, 0, 127, 0.55)', 'rgba(241, 196, 15, 0.55)'];
          s.weatherParticles.push({
            id: `spore-${Date.now()}-${Math.random()}`,
            x: Math.random() * 640,
            y: Math.random() * 400 + 40,
            vx: (Math.random() - 0.5) * 0.6,
            vy: -0.4 - Math.random() * 0.6,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: 2.0 + Math.random() * 2.5,
            life: 1.0,
            type: 'spore',
            swaySpeed: 0.03 + Math.random() * 0.04,
          });
        }
      } else if (levelTheme === 'castle') {
        if (Math.random() < 0.4) {
          s.weatherParticles.push({
            id: `ember-rise-${Date.now()}-${Math.random()}`,
            x: Math.random() * 640,
            y: 480 + 10,
            vx: -1.0 - Math.random() * 1.5,
            vy: -2.5 - Math.random() * 2.5,
            color: Math.random() < 0.6 ? '#ff4d4d' : '#ffa502',
            size: 1.8 + Math.random() * 2.2,
            life: 1.0,
            type: 'ember',
          });
        }
        if (Math.random() < 0.25) {
          s.weatherParticles.push({
            id: `ember-fall-${Date.now()}-${Math.random()}`,
            x: Math.random() * 700 - 30,
            y: -10,
            vx: -1.5 - Math.random() * 1.5,
            vy: 2.0 + Math.random() * 2.0,
            color: Math.random() < 0.5 ? 'rgba(74, 82, 90, 0.6)' : 'rgba(30, 30, 30, 0.7)',
            size: 2.5 + Math.random() * 2.5,
            life: 1.0,
            type: 'ember',
          });
        }
      }
    }

    // Advanced Physics Simulation: Player Kinetic Wind Draft Interaction
    // The player's movement exerts a force field that affects weather and ambient particles around them!
    const playerMidX = s.px + s.pWidth / 2 - s.cameraX;
    const playerMidY = s.py + s.pHeight / 2;
    const interactRadius = 65;
    const dragFactor = 0.09;

    s.weatherParticles.forEach((p) => {
      const dx = p.x - playerMidX;
      const dy = p.y - playerMidY;
      const distSq = dx * dx + dy * dy;
      if (distSq < interactRadius * interactRadius && distSq > 0.1) {
        const dist = Math.sqrt(distSq);
        const strength = (interactRadius - dist) / interactRadius; // closer = stronger influence
        // Push particles outwards from player's core combined with the player's kinetic drift trail
        p.vx += s.pvx * strength * dragFactor + (dx / dist) * strength * 0.45;
        p.vy += s.pvy * strength * dragFactor + (dy / dist) * strength * 0.25;

        // Velocity damping to keep physical motions organic and within stable bounds
        p.vx = Math.max(-8, Math.min(8, p.vx));
        p.vy = Math.max(-12, Math.min(15, p.vy));
      }
    });

    // Update existing weather particles positions
    s.weatherParticles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.x -= camDeltaX * 0.28;

      if (p.type === 'rain') {
        p.life -= 0.008;
        if (p.y >= 440 + Math.random() * 30 && Math.random() < 0.15) {
          p.life = 0;
          const splatterCount = 2 + Math.floor(Math.random() * 2);
          for (let sp = 0; sp < splatterCount; sp++) {
            s.weatherParticles.push({
              id: `splash-${Date.now()}-${Math.random()}`,
              x: p.x,
              y: p.y,
              vx: (Math.random() - 0.5) * 4.0,
              vy: -1.5 - Math.random() * 2.5,
              color: 'rgba(180, 215, 255, 0.8)',
              size: 1.2 + Math.random() * 1.2,
              life: 0.6 + Math.random() * 0.4,
              type: 'splash',
            });
          }
        }
      } else if (p.type === 'splash') {
        p.vy += 0.22;
        p.life -= 0.05;
      } else if (p.type === 'haze') {
        p.life -= 0.007;
        if (p.swaySpeed) {
          p.vx = Math.sin(Date.now() * p.swaySpeed + p.x * 0.015) * 0.6;
        }
      } else if (p.type === 'drop') {
        p.vy += 0.055;
        p.life -= 0.005;
        if (p.y >= 450 && Math.random() < 0.1) {
          p.life = 0;
          for (let sp = 0; sp < 2; sp++) {
            s.weatherParticles.push({
              id: `splash-${Date.now()}-${Math.random()}`,
              x: p.x,
              y: p.y,
              vx: (Math.random() - 0.5) * 2.0,
              vy: -0.6 - Math.random() * 1.5,
              color: 'rgba(150, 225, 255, 0.82)',
              size: 1.0,
              life: 0.5,
              type: 'splash',
            });
          }
        }
      } else if (p.type === 'fog') {
        p.life -= 0.0012;
      } else if (p.type === 'spore') {
        p.life -= 0.004;
        if (p.swaySpeed) {
          p.vx += Math.sin(Date.now() * p.swaySpeed + p.x * 0.01) * 0.2;
          p.vx = Math.max(-1.5, Math.min(1.5, p.vx));
          p.vy = -0.3 + Math.sin(Date.now() * 0.008 + p.y * 0.02) * 0.25;
        }
      } else if (p.type === 'ember') {
        p.life -= 0.01;
        p.vx += (Math.random() - 0.5) * 0.2;
      }

      if (p.y > 490 || p.y < -30 || p.x < -150 || p.x > 790) {
        p.life = 0;
      }
    });

    s.weatherParticles = s.weatherParticles.filter((p) => p.life > 0);
  };

  // Inflict damage/power-down trigger
  const triggerPlayerDamage = () => {
    const s = stateRef.current;
    if (s.pInvulnerableFrames > 0 || s.levelFinished) return;

    if (s.pPowerUp !== 'normal') {
      audio.playPowerDown();
      s.pPowerUp = 'normal';
      s.pInvulnerableFrames = 60; // 1 second of invulnerable flashing
      s.texts.push({ id: Math.random().toString(), text: '💔 NOMADA COMPRESO', x: s.px, y: s.py - 15, life: 1.0 });
      onUpdateStats({ activePowerUp: 'normal' });
    } else {
      handlePlayerDeath();
    }
  };

  // Perform player respawn or Game Over
  const handlePlayerDeath = () => {
    const s = stateRef.current;
    if (s.levelFinished) return;

    audio.playHurt();
    s.livesRemaining -= 1;
    onUpdateStats({ lives: s.livesRemaining });

    if (s.livesRemaining <= 0) {
      audio.playGameOver();
      onGameOver();
    } else {
      // Spawn tiny splash particles, restart state
      s.px = 100;
      s.py = 350;
      s.pvx = 0;
      s.pvy = 0;
      s.pInvulnerableFrames = 90;
      s.pPowerUp = 'normal';
      onUpdateStats({ activePowerUp: 'normal' });
    }
  };

  const drawLevelBackground = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    theme: string,
    camX: number
  ) => {
    // Shared drifting cloud generator for sky levels
    const drawClouds = (speedFactor: number) => {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.save();
      const timeMs = Date.now() * 0.003;
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 240 + timeMs * 1.8) - camX * speedFactor) % (canvas.width + 160) - 80;
        const cy = 35 + (i * 25) % 50;
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.arc(cx + 12, cy - 6, 11, 0, Math.PI * 2);
        ctx.arc(cx - 12, cy - 4, 9, 0, Math.PI * 2);
        ctx.arc(cx + 20, cy + 3, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    if (theme === 'green') {
      // Warm orange-smoggy highway sunset sky of urban stress
      const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      skyGrad.addColorStop(0, '#e74c3c'); // stress reddish orange sky
      skyGrad.addColorStop(0.5, '#f39c12'); // golden horizon
      skyGrad.addColorStop(1, '#ffeaa7'); // yellowish mist
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 16-bit drifting clouds (Improvement #3)
      drawClouds(0.015);

      // Deep Horizon mountains (Parallax Layer 0 - Slower - Improvement #2)
      ctx.fillStyle = '#485460';
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.lineTo(0, 310);
      ctx.lineTo(80 - camX * 0.025, 220); // distant silhouetted peak
      ctx.lineTo(180 - camX * 0.025, 270);
      ctx.lineTo(270 - camX * 0.025, 240); // second far peak
      ctx.lineTo(390 - camX * 0.025, 310);
      ctx.lineTo(canvas.width, 310);
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Cerro de la Silla mountain silhouette! (Parallax Layer 1)
      ctx.fillStyle = '#2c3e50';
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.lineTo(0, 310);
      ctx.lineTo(150 - camX * 0.08, 190); // Peak 1
      ctx.lineTo(210 - camX * 0.08, 240); // Saddle
      ctx.lineTo(310 - camX * 0.08, 200); // Peak 2
      ctx.lineTo(450 - camX * 0.08, 310); // Base
      ctx.lineTo(canvas.width, 310);
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fill();

      // Flat highway asphalt grid in background (stress vibe)
      ctx.fillStyle = '#78909c';
      ctx.fillRect(0, 310, canvas.width, 40);
      ctx.fillStyle = '#f1c40f'; // yellow lanes dashes
      for (let x = 0; x < canvas.width + 120; x += 60) {
        ctx.fillRect(x - (camX * 0.75) % 60, 328, 24, 3);
      }

      // Highway billboard sign: "BIENVENIDOS A SANTIAGO NL"
      const signX = 420 - camX * 0.5;
      if (signX > -150 && signX < canvas.width + 150) {
        ctx.fillStyle = '#37474f'; // metal supports
        ctx.fillRect(signX + 60, 160, 6, 80);
        
        ctx.fillStyle = '#1b5e20'; // board dark green
        ctx.fillRect(signX, 100, 126, 60);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(signX, 100, 126, 60);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BIENVENIDOS A', signX + 63, 118);
        ctx.fillStyle = '#f1c40f';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('SANTIAGO NL', signX + 63, 134);
        ctx.fillStyle = '#ffffff';
        ctx.font = '7px monospace';
        ctx.fillText('VILLA PRESTIGIADA', signX + 63, 149);
      }

      // Power towers / grid wires in background to show urban stress
      ctx.strokeStyle = 'rgba(44, 62, 80, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 150);
      ctx.lineTo(canvas.width, 170);
      ctx.moveTo(0, 165);
      ctx.lineTo(canvas.width, 185);
      ctx.stroke();

    } else if (theme === 'cave') {
      // Cascada Cola de Caballo theme (Waterfalls and pine sierra heights)
      const waterSky = ctx.createLinearGradient(0, 0, 0, canvas.height);
      waterSky.addColorStop(0, '#1a365d'); // deep cool blue
      waterSky.addColorStop(0.6, '#2a4365');
      waterSky.addColorStop(1, '#ebf8ff'); // misty bright horizon
      ctx.fillStyle = waterSky;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Ambient watery mist rising up (SNES spray particles - Improvement #4)
      ctx.fillStyle = 'rgba(224, 242, 254, 0.22)';
      for (let i = 0; i < 8; i++) {
        const mX = (i * 123 + camX * 0.15) % canvas.width;
        const mY = canvas.height - ((Date.now() * 0.05 + i * 65) % (canvas.height - 40));
        const mSize = 3 + (i % 3) * 2;
        ctx.beginPath();
        ctx.arc(mX + Math.sin(mY * 0.015 + i) * 6, mY, mSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Rocky gorge wall silhouettes in the background (Parallax Layer 1)
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.lineTo(0, 180);
      ctx.lineTo(150 - camX * 0.12, 100);
      ctx.lineTo(300 - camX * 0.12, 220);
      ctx.lineTo(500 - camX * 0.12, 120);
      ctx.lineTo(canvas.width, 240);
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fill();

      // Huge cascading Animated Waterfall (Cola de Caballo) in the background
      const waterfallInterval = 680;
      for (let w = 0; w < 4; w++) {
        const fallX = w * waterfallInterval + 180 - camX * 0.45;
        if (fallX > -150 && fallX < canvas.width + 150) {
          // Dark gorge rocks flanking the waterfall
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(fallX - 25, 0, 25, canvas.height);
          ctx.fillRect(fallX + 50, 0, 25, canvas.height);
          
          // Teal water cascade stream
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(fallX, 0, 50, canvas.height - 40);
          
          // Animated white water streaks falling
          ctx.fillStyle = '#ffffff';
          ctx.save();
          ctx.globalAlpha = 0.55 + Math.sin(Date.now() * 0.04) * 0.2;
          for (let i = 0; i < 6; i++) {
            const lineY = (Date.now() * 0.18 + i * 50) % (canvas.height - 40);
            ctx.fillRect(fallX + i * 8 + 3, lineY, 4, 30);
          }
          ctx.restore();

          // Mist puff balls at base
          ctx.fillStyle = 'rgba(235, 248, 255, 0.75)';
          for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            const puffX = fallX + i * 11 - 3 + Math.sin(Date.now() * 0.025 + i) * 3;
            const puffY = canvas.height - 55 + Math.cos(Date.now() * 0.025 + i) * 3;
            ctx.arc(puffX, puffY, 14 + (i % 2) * 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

    } else if (theme === 'castle') {
      // Midnight Cosmic Mountain Sky (Alta Sierra Peak)
      const midnightSky = ctx.createLinearGradient(0, 0, 0, canvas.height);
      midnightSky.addColorStop(0, '#04051a'); // dark cosmic void
      midnightSky.addColorStop(0.5, '#0b0f3a'); // deep mystical azul
      midnightSky.addColorStop(1, '#1b1233'); // soft twilight purple mist
      ctx.fillStyle = midnightSky;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Twinkling Peak Stars (Real high altitude atmospheric shine)
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 28; i++) {
        const starX = (i * 127 + camX * 0.02) % canvas.width;
        const starY = (i * 41) % (canvas.height - 80);
        const starAlpha = 0.35 + Math.abs(Math.sin(Date.now() * 0.0025 + i)) * 0.65;
        
        ctx.save();
        ctx.globalAlpha = starAlpha;
        ctx.fillRect(starX, starY, i % 3 === 0 ? 2.5 : 1.5, i % 3 === 0 ? 2.5 : 1.5);
        ctx.restore();
      }

      // Parallax Mountain Ridge Silhouettes (Huasteca Peak heights)
      ctx.fillStyle = '#060714'; // deep dark blue-black rock
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.lineTo(0, 200);
      ctx.lineTo(120 - camX * 0.05, 110);
      ctx.lineTo(260 - camX * 0.05, 180);
      ctx.lineTo(390 - camX * 0.05, 130);
      ctx.lineTo(canvas.width, 210);
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fill();

      // Golden inside-lit Nomadic Teepees & Shelters (Cozy mountain nomads resting)
      const teepeeXStart = 160;
      for (let t = 0; t < 3; t++) {
        const teepeeX = t * 240 + teepeeXStart - camX * 0.12;
        if (teepeeX > -50 && teepeeX < canvas.width + 50) {
          const teepeeY = canvas.height - 75; // above bottom floor
          
          // Inside bonfire glowing fire orange
          ctx.fillStyle = 'rgba(230, 126, 34, 0.55)';
          ctx.beginPath();
          ctx.moveTo(teepeeX, teepeeY);
          ctx.lineTo(teepeeX - 16, teepeeY + 35);
          ctx.lineTo(teepeeX + 16, teepeeY + 35);
          ctx.closePath();
          ctx.fill();

          // Wooden teepee cover canvas outline (nomad skin-tents)
          ctx.strokeStyle = '#d35400';
          ctx.shadowColor = '#f1c40f';
          ctx.shadowBlur = 8;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(teepeeX, teepeeY - 14); // wooden logs stick out
          ctx.lineTo(teepeeX - 22, teepeeY + 35);
          ctx.lineTo(teepeeX + 22, teepeeY + 35);
          ctx.closePath();
          ctx.stroke();
          ctx.shadowBlur = 0; // reset

          // Entry slits
          ctx.strokeStyle = '#291102';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(teepeeX, teepeeY + 12);
          ctx.lineTo(teepeeX, teepeeY + 35);
          ctx.stroke();

          // Wooden supportive stick poles sticking on top crossband
          ctx.strokeStyle = '#8e5431';
          ctx.beginPath();
          ctx.moveTo(teepeeX - 4, teepeeY - 8);
          ctx.lineTo(teepeeX + 4, teepeeY - 18);
          ctx.moveTo(teepeeX + 4, teepeeY - 8);
          ctx.lineTo(teepeeX - 4, teepeeY - 18);
          ctx.stroke();
        }
      }

      // Crackling cozy mountain campfires with rising hot sparks
      const campfireX = 220 - camX * 0.2;
      const campfireY = canvas.height - 48;
      if (campfireX > -50 && campfireX < canvas.width + 50) {
        // Wooden logs cross silhouette
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(campfireX - 14, campfireY + 6, 28, 6);
        ctx.fillRect(campfireX - 8, campfireY + 2, 16, 6);
        
        // Inner pulsing glowing embers
        const flamePulse = 1.0 + Math.sin(Date.now() * 0.02) * 0.15;
        const flameGrad = ctx.createRadialGradient(campfireX, campfireY, 2, campfireX, campfireY, 16);
        flameGrad.addColorStop(0, '#ffffff');
        flameGrad.addColorStop(0.3, '#f1c40f'); // bright gold
        flameGrad.addColorStop(0.7, '#e67e22'); // raw orange
        flameGrad.addColorStop(1, 'rgba(231, 76, 60, 0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.arc(campfireX, campfireY, 14 * flamePulse, 0, Math.PI * 2);
        ctx.fill();

        // Rising embers sparkles
        ctx.fillStyle = '#f39c12';
        for (let i = 0; i < 4; i++) {
          const sparkY = campfireY - ((Date.now() * 0.12 + i * 35) % 65);
          const sparkX = campfireX + Math.sin(sparkY * 0.07 + i) * 6;
          ctx.fillRect(sparkX, sparkY, 2, 2);
        }
      }
    } else if (theme === 'desert') {
      // Potrero Redondo clay mud sunset highlands
      const claySky = ctx.createLinearGradient(0, 0, 0, canvas.height);
      claySky.addColorStop(0, '#c0392b'); // blazing canyon red sunset
      claySky.addColorStop(0.5, '#d35400'); // warm clay orange
      claySky.addColorStop(1, '#f39c12'); // golden valley haze
      ctx.fillStyle = claySky;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 16-bit drifting clouds (Improvement #3)
      drawClouds(0.018);

      // Faraway Clay Cliffs (Parallax Layer 0)
      ctx.fillStyle = '#481e01';
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.lineTo(0, 240);
      ctx.quadraticCurveTo(240 - camX * 0.035, 170, 480 - camX * 0.035, 210);
      ctx.quadraticCurveTo(600 - camX * 0.035, 180, canvas.width, 240);
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Distant rolling mud hills and clay mountains (Parallax Layer 1)
      ctx.fillStyle = '#4d2d14'; // canyons brown
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.quadraticCurveTo(180 - camX * 0.08, 210, 360 - camX * 0.08, 250);
      ctx.quadraticCurveTo(580 - camX * 0.08, 190, canvas.width, 270);
      ctx.lineTo(canvas.width, canvas.height);
      ctx.lineTo(0, canvas.height);
      ctx.fill();

      // Foreground rolling mud cliffs (Parallax Layer 2)
      ctx.fillStyle = '#5c3818'; 
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.quadraticCurveTo(120 - camX * 0.2, 270, 300 - camX * 0.2, 310);
      ctx.quadraticCurveTo(520 - camX * 0.2, 260, canvas.width, 320);
      ctx.lineTo(canvas.width, canvas.height);
      ctx.lineTo(0, canvas.height);
      ctx.fill();

      // Draw majestic multi-arm mountain Cardón Cacti (cactus silhouettes)
      ctx.fillStyle = '#2d1a0b'; // dark silhouette blending into the mountain ridge
      for (let i = 0; i < 4; i++) {
        const cactusX = i * 210 + 90 - camX * 0.22;
        if (cactusX > -30 && cactusX < canvas.width + 30) {
          const cactusY = canvas.height - 110 + (i % 2) * 15;
          
          // Main thick trunk
          ctx.fillRect(cactusX, cactusY, 6, 40);
          // Left arm
          ctx.fillRect(cactusX - 8, cactusY + 12, 10, 4);
          ctx.fillRect(cactusX - 8, cactusY + 2, 4, 12);
          // Right arm
          ctx.fillRect(cactusX, cactusY + 18, 12, 4);
          ctx.fillRect(cactusX + 10, cactusY + 6, 4, 14);
        }
      }

    } else if (theme === 'neon') {
      // Cascada Chipitín electric turquoise neon-lit dusk
      const neonSky = ctx.createLinearGradient(0, 0, 0, canvas.height);
      neonSky.addColorStop(0, '#0a192f'); // cyber twilight navy
      neonSky.addColorStop(0.6, '#0f172a');
      neonSky.addColorStop(1, '#1e1b4b'); // deep indigo base
      ctx.fillStyle = neonSky;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Synthwave horizontal lines grid vector background (Improvement #9)
      ctx.strokeStyle = 'rgba(255, 0, 127, 0.12)';
      ctx.lineWidth = 1;
      for (let gridY = 60; gridY < 200; gridY += 15) {
        ctx.beginPath();
        ctx.moveTo(0, gridY);
        ctx.lineTo(canvas.width, gridY);
        ctx.stroke();
      }

      // Star constellations twinkling in Chipitín waters
      ctx.fillStyle = '#38bdf8';
      ctx.save();
      ctx.globalAlpha = 0.45 + Math.sin(Date.now() * 0.035) * 0.35;
      for (let i = 0; i < 15; i++) {
        const sx = (i * 97) % canvas.width;
        const sy = (i * 43) % 180;
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.restore();

      // Glowing, cyan-lit teal waterfall cascades
      const chipiInterval = 600;
      for (let w = 0; w < 4; w++) {
        const fallX = w * chipiInterval + 150 - camX * 0.4;
        if (fallX > -150 && fallX < canvas.width + 150) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
          ctx.fillRect(fallX - 15, 0, 80, canvas.height);

          // Glowing neon turquoise stream
          ctx.fillStyle = '#06b6d4'; // neon teal
          ctx.fillRect(fallX, 0, 50, canvas.height - 40);

          ctx.fillStyle = '#00f7ff'; // neon cyan highlight line
          ctx.fillRect(fallX + 4, 0, 2, canvas.height - 40);
          ctx.fillRect(fallX + 44, 0, 2, canvas.height - 40);

          // Falling glowing dots
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 5; i++) {
            const dotY = (Date.now() * 0.25 + i * 70) % (canvas.height - 40);
            ctx.fillRect(fallX + 10 + i * 8, dotY, 3, 3);
          }
        }
      }

    } else {
      // Las Adjuntas magnificent cañón cliffs morning sky (theme === 'sierra' o default)
      const sierraSky = ctx.createLinearGradient(0, 0, 0, canvas.height);
      sierraSky.addColorStop(0, '#535c68'); // cool slate gray-blue
      sierraSky.addColorStop(0.6, '#95afc0'); // morning mist
      sierraSky.addColorStop(1, '#dfe6e9'); // bright valley lowlands
      ctx.fillStyle = sierraSky;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Drifting clouds (Improvement #3)
      drawClouds(0.012);

      // Extremely Far cañón heights (Parallax Layer 0 - Improvement #2)
      ctx.fillStyle = 'rgba(83, 92, 104, 0.28)';
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.lineTo(0, 210);
      ctx.lineTo(200 - camX * 0.035, 100);
      ctx.lineTo(440 - camX * 0.035, 180);
      ctx.lineTo(canvas.width, 180);
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fill();

      // Layered pine forests and mountain ridges (Parallax Layer 1)
      ctx.fillStyle = '#2c3e50'; 
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.lineTo(0, 260);
      ctx.lineTo(140 - camX * 0.1, 140);
      ctx.lineTo(280 - camX * 0.1, 240);
      ctx.lineTo(450 - camX * 0.1, 150);
      ctx.lineTo(canvas.width, 270);
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fill();

      // Midground lush pine-tree peaks silhouette (Parallax Layer 2)
      ctx.fillStyle = '#1e3d2f'; 
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      ctx.lineTo(0, 290);
      ctx.lineTo(100 - camX * 0.22, 220);
      ctx.lineTo(130 - camX * 0.22, 260);
      ctx.lineTo(240 - camX * 0.22, 190);
      ctx.lineTo(380 - camX * 0.22, 280);
      ctx.lineTo( canvas.width, 240);
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fill();
    }
  };

  const drawLevelBlocks = (
    ctx: CanvasRenderingContext2D,
    blocks: Block[],
    camX: number
  ) => {
    const tileSize = 32;

    blocks.forEach((b) => {
      const bx = b.x * tileSize - camX;
      let by = b.y * tileSize;

      // Handle animated questions block bounces
      if (b.hitAnimationY !== undefined) {
        by += b.hitAnimationY;
        b.hitAnimationY += 2; // decay animation bounce
        if (b.hitAnimationY >= 0) {
          b.hitAnimationY = undefined;
        }
      }

      // Skip rendering if block is out of camera viewport
      if (bx < -tileSize || bx > 640) return;

      if (b.type === 'ground') {
        // Theme-specific color parameters
        let grassColor = '#6ab04c';
        let soilColor = '#834c14';
        let detailColor = '#5c3104';
        let isNeonGrid = false;

        if (levelTheme === 'green') {
          grassColor = '#2ecc71';
          soilColor = '#8d5524';
          detailColor = '#5c3104';
        } else if (levelTheme === 'cave') {
          grassColor = '#4b6584';
          soilColor = '#2f3542';
          detailColor = '#1e272e';
        } else if (levelTheme === 'castle') {
          grassColor = '#e74c3c';
          soilColor = '#1e1b1b';
          detailColor = '#0a0909';
        } else if (levelTheme === 'desert') {
          grassColor = '#5c3818'; // damp clay moss
          soilColor = '#81512c'; // slick clay brown mud
          detailColor = '#4a280f'; // deep mud spots
        } else if (levelTheme === 'neon') {
          grassColor = '#ff007f';
          soilColor = '#1a052e';
          detailColor = '#00fbff';
          isNeonGrid = true;
        } else if (levelTheme === 'sierra') {
          grassColor = '#26de81';
          soilColor = '#778ca3';
          detailColor = '#4b6584';
        }

        // Draw Layered Grass/Soil
        ctx.fillStyle = grassColor;
        ctx.fillRect(bx, by, tileSize, 10);
        ctx.fillStyle = soilColor;
        ctx.fillRect(bx, by + 10, tileSize, tileSize - 10);
        
        // Draw decorative details
        ctx.fillStyle = detailColor;
        if (isNeonGrid) {
          // Neon grid horizontal/vertical laser crossbars
          ctx.fillRect(bx + 4, by + 12, 2, tileSize - 12);
          ctx.fillRect(bx + 26, by + 12, 2, tileSize - 12);
          ctx.fillRect(bx, by + 20, tileSize, 2);
        } else {
          // Classic retro dirt spots
          ctx.fillRect(bx + 4, by + 15, 6, 6);
          ctx.fillRect(bx + 18, by + 22, 6, 6);
        }
      } else if (b.type === 'brick') {
        // Redesigned to be Terrón de Adobe Artesanal / Cantera de la Sierra
        // Color depends on level theme for natural, high-art coherence
        let blockColor = '#b08d57'; // sandy clay adobe
        let crackColor = '#735b34';
        let mossColor = '#27ae60';
        let highlightColor = '#d9c29e';

        if (levelTheme === 'cave') {
          blockColor = '#57606f'; // dark cavern slate
          crackColor = '#2f3542';
          mossColor = '#2ecc71';
          highlightColor = '#a4b0be';
        } else if (levelTheme === 'castle') {
          blockColor = '#3d3d3d'; // mountain obsidian
          crackColor = '#1e1e1e';
          mossColor = '#ff4757'; // blazing volcanic ash moss
          highlightColor = '#7f8c8d';
        } else if (levelTheme === 'neon') {
          blockColor = '#2d142c'; // vaporwave purple crystal
          crackColor = '#1a081a';
          mossColor = '#00fbff';
          highlightColor = '#ff007f';
        } else if (levelTheme === 'sierra' || levelTheme === 'desert') {
          blockColor = '#a0522d'; // sienna canyon clay
          crackColor = '#5c2d16';
          mossColor = '#81ca10';
          highlightColor = '#cd853f';
        }

        ctx.fillStyle = blockColor;
        ctx.fillRect(bx, by, tileSize, tileSize);

        // Adobe texture lines & irregular rocky grooves
        ctx.strokeStyle = crackColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // Adobe horizontal layers
        ctx.moveTo(bx, by + tileSize / 2);
        ctx.lineTo(bx + tileSize, by + tileSize / 2);
        ctx.moveTo(bx + 10, by);
        ctx.lineTo(bx + 10, by + tileSize / 2);
        ctx.moveTo(bx + 22, by + tileSize / 2);
        ctx.lineTo(bx + 22, by + tileSize);
        // Organic rocky cracks/grooves
        ctx.moveTo(bx + 4, by + 6);
        ctx.lineTo(bx + 8, by + 10);
        ctx.moveTo(bx + 26, by + 22);
        ctx.lineTo(bx + 28, by + 28);
        ctx.stroke();

        // 16-bit sunlit bevel highlight
        ctx.fillStyle = highlightColor;
        ctx.fillRect(bx + 1, by + 1, tileSize - 2, 2.5); // top bevel
        ctx.fillRect(bx + 1, by + 1, 2.5, tileSize - 2); // left bevel

        // Hand-crafted Sierra organic moss on block top!
        ctx.fillStyle = mossColor;
        ctx.fillRect(bx, by, 6, 3);
        ctx.fillRect(bx + 10, by, 8, 4);
        ctx.fillRect(bx + 13, by + 4, 3, 2);
        ctx.fillRect(bx + 24, by, 8, 3);

        ctx.strokeStyle = crackColor;
        ctx.lineWidth = 1.8;
         ctx.strokeRect(bx, by, tileSize, tileSize);

      } else if (b.type === 'question') {
        // Redesigned to be a gorgeous sparkling Cofre de Cuarzo Rúnico (Ancient Nomad Mystic Quartz Vault)
        // Pulsing shiny colors reminiscent of high-altitude mountain gems
        const pulse = Math.abs(Math.sin(Date.now() * 0.006));
        
        let crystalOuter = '#16a085';
        let crystalInner = '#1abc9c';
        let flareColor = '#ffffff';
        let runeSymbol = '✦'; // Star rune

        if (levelTheme === 'sierra' || levelTheme === 'desert' || levelTheme === 'castle') {
          // Warm amber quartz or gold ore vein
          crystalOuter = `rgb(${Math.floor(211 - pulse * 40)}, ${Math.floor(130 - pulse * 30)}, ${Math.floor(34 - pulse * 20)})`;
          crystalInner = `rgb(${Math.floor(243 + pulse * 12)}, ${Math.floor(190 - pulse * 32)}, ${Math.floor(92 - pulse * 60)})`;
          flareColor = '#fff';
          runeSymbol = '☼'; // Sacred Nomad Sun symbol!
        } else if (levelTheme === 'neon') {
          // Cyan sapphire
          crystalOuter = '#0062ff';
          crystalInner = '#00f7ff';
          flareColor = '#fff';
          runeSymbol = '◆';
        } else {
          // Emerald
          crystalOuter = '#27ae60';
          crystalInner = '#2ecc71';
          flareColor = '#fff';
          runeSymbol = '✦';
        }

        // Draw diamond-like faceted quartz block
        ctx.fillStyle = crystalOuter;
        ctx.fillRect(bx, by, tileSize, tileSize);

        // Inner core
        ctx.fillStyle = crystalInner;
        ctx.fillRect(bx + 4, by + 4, tileSize - 8, tileSize - 8);

        // Facets highlight diagonals
        ctx.strokeStyle = flareColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.35 + pulse * 0.4;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + 4, by + 4);
        ctx.moveTo(bx + tileSize, by);
        ctx.lineTo(bx + tileSize - 4, by + 4);
        ctx.moveTo(bx, by + tileSize);
        ctx.lineTo(bx + 4, by + tileSize - 4);
        ctx.moveTo(bx + tileSize, by + tileSize);
        ctx.lineTo(bx + tileSize - 4, by + tileSize - 4);
        ctx.stroke();

        // Glowing center runic glyph
        ctx.fillStyle = flareColor;
        ctx.globalAlpha = 0.85 + pulse * 0.15;
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        // Shadow offset
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillText(runeSymbol, bx + tileSize / 2 + 1, by + tileSize / 2 + 10);
        ctx.fillStyle = flareColor;
        ctx.fillText(runeSymbol, bx + tileSize / 2, by + tileSize / 2 + 9);
        ctx.globalAlpha = 1.0;

        // Shiny glare spot
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(bx + 4, by + 4, 3, 3);
        ctx.fillRect(bx + 7, by + 4, 4, 1);
        ctx.fillRect(bx + 4, by + 7, 1, 4);

        ctx.strokeStyle = crystalOuter;
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, tileSize, tileSize);

      } else if (b.type === 'empty-question') {
        // Redesigned to be Bloque de Basalto Desgastado (Durable volcanic weathered stone)
        ctx.fillStyle = '#4c4c4c'; // Charcoal stone
        ctx.fillRect(bx, by, tileSize, tileSize);

        // Weathered cracks and lines
        ctx.strokeStyle = '#292929';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx + 6, by + 6);
        ctx.lineTo(bx + tileSize - 6, by + 6);
        ctx.lineTo(bx + tileSize - 6, by + tileSize - 6);
        ctx.lineTo(bx + 6, by + tileSize - 6);
        ctx.closePath();
        // Inner cracks
        ctx.moveTo(bx + 6, by + 12);
        ctx.lineTo(bx + 14, by + 16);
        ctx.moveTo(bx + tileSize - 6, by + 18);
        ctx.lineTo(bx + tileSize - 16, by + 12);
        ctx.stroke();

        // Corner stone studs
        ctx.fillStyle = '#222222';
        ctx.fillRect(bx + 3, by + 3, 2, 2);
        ctx.fillRect(bx + tileSize - 5, by + 3, 2, 2);
        ctx.fillRect(bx + 3, by + tileSize - 5, 2, 2);
        ctx.fillRect(bx + tileSize - 5, by + tileSize - 5, 2, 2);

        ctx.strokeStyle = '#1e1e1e';
        ctx.lineWidth = 1.8;
        ctx.strokeRect(bx, by, tileSize, tileSize);
      } else if (b.type === 'pipe') {
        if (levelTheme === 'cave' || levelTheme === 'sierra' || levelTheme === 'desert' || levelTheme === 'castle') {
          // Tronco Mágico (Hollow wooden log with glowing ancient sapphire core)
          ctx.fillStyle = '#5c3d21'; // bark brown
          ctx.fillRect(bx, by, tileSize, tileSize);
          ctx.fillStyle = '#835c3b'; // lighter wood grain highlight
          ctx.fillRect(bx + 4, by, tileSize - 8, tileSize);
          
          // Outer log rings
          ctx.fillStyle = '#d4a373';
          ctx.fillRect(bx, by, tileSize, 4);
          
          // Bark ridges lines
          ctx.fillStyle = '#3d2511';
          ctx.fillRect(bx + 6, by + 4, 2, tileSize - 4);
          ctx.fillRect(bx + 24, by + 8, 2, tileSize - 8);
          
          // Glowing magical runes
          ctx.fillStyle = '#00fbff';
          ctx.save();
          ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.012) * 0.35;
          ctx.fillRect(bx + tileSize / 2 - 2, by + 8, 4, 14);
          ctx.fillRect(bx + tileSize / 2 - 6, by + 13, 12, 3);
          ctx.restore();
          
          ctx.strokeStyle = '#2d1a0c';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx, by, tileSize, tileSize);
        } else if (levelTheme === 'green') {
          // City Traffic Concrete Bumper
          ctx.fillStyle = '#e67e22'; // high-vis safety orange
          ctx.fillRect(bx, by, tileSize, tileSize);
          ctx.fillStyle = '#ffffff'; // white reflective stripe
          ctx.fillRect(bx, by + 10, tileSize, 12);
          
          ctx.strokeStyle = '#2c3e50';
          ctx.lineWidth = 2;
          ctx.strokeRect(bx, by, tileSize, tileSize);
          
          // Warning marks
          ctx.fillStyle = '#2c3e50';
          ctx.fillRect(bx + 4, by + 4, 4, 4);
          ctx.fillRect(bx + tileSize - 8, by + 4, 4, 4);
        } else {
          // Classic green pipeline style!
          ctx.fillStyle = '#218c74';
          ctx.fillRect(bx, by, tileSize, tileSize);
          ctx.fillStyle = '#33d9b2';
          ctx.fillRect(bx, by + 4, 4, tileSize - 8); // shine highlight
          ctx.strokeStyle = '#114a3e';
          ctx.lineWidth = 2;
          ctx.strokeRect(bx, by, tileSize, tileSize);
        }
      } else if (b.type === 'lava') {
        // Glowing orange liquid block
        ctx.fillStyle = '#ff5252';
        ctx.fillRect(bx, by, tileSize, tileSize);
        // Animated magma waves on top
        ctx.fillStyle = '#ff793f';
        ctx.fillRect(bx, by, tileSize, 10);
      } else if (b.type === 'spike') {
        if (levelTheme === 'cave' || levelTheme === 'sierra' || levelTheme === 'desert' || levelTheme === 'castle') {
          // Maguey / Agave thorny green plant obstacle!
          // Draw central pineapple root
          ctx.fillStyle = '#1e4d2b';
          ctx.beginPath();
          ctx.ellipse(bx + 16, by + 24, 11, 7, 0, 0, Math.PI * 2);
          ctx.fill();

          // Left spiked leaf
          ctx.fillStyle = '#2d6a4f';
          ctx.beginPath();
          ctx.moveTo(bx + 16, by + 18);
          ctx.quadraticCurveTo(bx + 2, by + 12, bx + 2, by + 6);
          ctx.quadraticCurveTo(bx + 10, by + 22, bx + 16, by + 24);
          ctx.fill();

          // Right spiked leaf
          ctx.beginPath();
          ctx.moveTo(bx + 16, by + 18);
          ctx.quadraticCurveTo(bx + 30, by + 12, bx + 30, by + 6);
          ctx.quadraticCurveTo(bx + 22, by + 22, bx + 16, by + 24);
          ctx.fill();

          // Center primary thorn
          ctx.fillStyle = '#40916c';
          ctx.beginPath();
          ctx.moveTo(bx + 13, by + 17);
          ctx.lineTo(bx + 16, by + 2);
          ctx.lineTo(bx + 19, by + 17);
          ctx.closePath();
          ctx.fill();

          // Tiny sharp yellow spines on tips
          ctx.fillStyle = '#eccc68';
          ctx.fillRect(bx + 1, by + 5, 2, 2);
          ctx.fillRect(bx + 29, by + 5, 2, 2);
          ctx.fillRect(bx + 15, by + 1, 2, 2);
        } else if (levelTheme === 'green') {
          // Highway Tire-Popper Spike Strip
          ctx.fillStyle = '#34495e'; // heavy iron plate
          ctx.fillRect(bx, by + 26, tileSize, 6);
          
          ctx.fillStyle = '#bdc3c7'; // shiny chrome teeth
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(bx + i * 8 + 2, by + 26);
            ctx.lineTo(bx + i * 8 + 5, by + 10);
            ctx.lineTo(bx + i * 8 + 8, by + 26);
            ctx.closePath();
            ctx.fill();
          }
        } else {
          // Metal hazards spikes triangle meshes
          ctx.fillStyle = '#95a5a6';
          ctx.beginPath();
          ctx.moveTo(bx, by + tileSize);
          ctx.lineTo(bx + tileSize / 2, by);
          ctx.lineTo(bx + tileSize, by + tileSize);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#2c3e50';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else if (b.type === 'castle-block') {
        // Dark metallic brick
        ctx.fillStyle = '#3c40c6';
        ctx.fillRect(bx, by, tileSize, tileSize);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, by, tileSize, tileSize);
      } else if (b.type === 'liftable') {
        // Blue glowing brick that can be picked up!
        ctx.fillStyle = '#0fbcf9';
        ctx.fillRect(bx, by, tileSize, tileSize);
        ctx.strokeStyle = '#05c46b'; // bright green safety border decoration
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, tileSize, tileSize);
        
        ctx.font = '8px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('LIFT', bx + 16, by + 18);
      }
    });
  };

  const drawGoalTape = (
    ctx: CanvasRenderingContext2D,
    s: typeof stateRef.current,
    camX: number
  ) => {
    const tileSize = 32;
    const goalPole = s.blocks.find((b) => b.type === 'goal');
    if (!goalPole) return;

    const bx = goalPole.x * tileSize - camX;
    const by = goalPole.y * tileSize;

    // Draw tall gorgeous Goal gate poles with 16-bit metallic gradients (Improvement #7)
    const poleGrad1 = ctx.createLinearGradient(bx, 0, bx + 8, 0);
    poleGrad1.addColorStop(0, '#7f8c8d');
    poleGrad1.addColorStop(0.35, '#ffffff');
    poleGrad1.addColorStop(0.7, '#b2bec3');
    poleGrad1.addColorStop(1, '#2d3436');

    const poleGrad2 = ctx.createLinearGradient(bx + 40, 0, bx + 48, 0);
    poleGrad2.addColorStop(0, '#7f8c8d');
    poleGrad2.addColorStop(0.35, '#ffffff');
    poleGrad2.addColorStop(0.7, '#b2bec3');
    poleGrad2.addColorStop(1, '#2d3436');

    ctx.fillStyle = poleGrad1;
    ctx.fillRect(bx, by - 200, 8, 232);
    ctx.fillStyle = poleGrad2;
    ctx.fillRect(bx + 40, by - 200, 8, 232);

    // Golden ball tops with detailed gold spherical shine
    const goldGrad1 = ctx.createRadialGradient(bx + 2, by - 202, 1, bx + 4, by - 200, 6);
    goldGrad1.addColorStop(0, '#ffffff');
    goldGrad1.addColorStop(0.3, '#f1c40f');
    goldGrad1.addColorStop(1, '#d35400');

    const goldGrad2 = ctx.createRadialGradient(bx + 42, by - 202, 1, bx + 44, by - 200, 6);
    goldGrad2.addColorStop(0, '#ffffff');
    goldGrad2.addColorStop(0.3, '#f1c40f');
    goldGrad2.addColorStop(1, '#d35400');

    ctx.beginPath();
    ctx.fillStyle = goldGrad1;
    ctx.arc(bx + 4, by - 200, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = goldGrad2;
    ctx.arc(bx + 44, by - 200, 6, 0, Math.PI * 2);
    ctx.fill();

    // Renders the moving Goal Tape line!
    if (!s.levelFinished) {
      // White and Red striped gate ribbon tape
      ctx.fillStyle = '#eb4d4b'; // red backing
      ctx.fillRect(bx + 8, s.goalBarY, 32, 6);
      
      ctx.fillStyle = '#ffffff'; // white diagonal stripe dashes
      ctx.fillRect(bx + 11, s.goalBarY, 4, 6);
      ctx.fillRect(bx + 19, s.goalBarY, 4, 6);
      ctx.fillRect(bx + 27, s.goalBarY, 4, 6);
      
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 8, s.goalBarY, 32, 6);
    }
  };

  const drawPlayer = (
    ctx: CanvasRenderingContext2D,
    s: typeof stateRef.current,
    camX: number
  ) => {
    // Invis flashing if invulnerable
    if (s.pInvulnerableFrames > 0 && Math.floor(s.pInvulnerableFrames / 4) % 2 === 0) {
      return;
    }

    const px = s.px - camX;
    const py = s.py;
    const pw = s.pWidth;
    const ph = s.pHeight;
    const facing = s.pFacing;

    // Procedural animation state calculations based on prioritized buffer states
    let headYOffset = 0;
    let bodyYOffset = 0;
    let bodyXOffset = 0;
    let bodyHeightDiff = 0;
    let leftFootOffset = 0;
    let rightFootOffset = 0;
    let rumbleY = 0;

    const animState = s.pAnimState || 'idle';
    const animFrame = s.pAnimFrame || 0;
    const walkTick = s.pWalkTick || 0;

    if (animState === 'idle') {
      headYOffset = Math.sin(animFrame * 0.05) * 0.5;
      bodyYOffset = Math.sin(animFrame * 0.05) * 0.25;
      rumbleY = Math.sin(Date.now() * 0.07) * 0.5;
    } else if (animState === 'walk') {
      // Bobbing walking speed cycle
      headYOffset = Math.abs(Math.sin(walkTick * 0.15)) * -1.5;
      bodyYOffset = Math.abs(Math.sin(walkTick * 0.15)) * -0.5;
      bodyXOffset = Math.sin(walkTick * 0.15) * 0.8;
      leftFootOffset = Math.sin(walkTick * 0.15) * 2;
      rightFootOffset = -Math.sin(walkTick * 0.15) * 2;
    } else if (animState === 'jump') {
      headYOffset = -1.5;
      bodyYOffset = -0.5;
    } else if (animState === 'duck') {
      headYOffset = 4.0;
      bodyYOffset = 2.5;
      bodyHeightDiff = -3.0;
    }

    // PowerUp style modifications if not transformed completely (or overlay neon glow)
    let powerGlow = 'transparent';
    if (s.pPowerUp === 'fire') powerGlow = 'rgba(231, 76, 60, 0.45)';
    else if (s.pPowerUp === 'ice') powerGlow = 'rgba(52, 152, 219, 0.45)';
    else if (s.pPowerUp === 'turbo') powerGlow = 'rgba(241, 196, 15, 0.45)';

    if (powerGlow !== 'transparent') {
      ctx.fillStyle = powerGlow;
      ctx.beginPath();
      ctx.arc(px + pw / 2, py + ph / 2, Math.max(pw, ph) * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();

    // Physics FX: Squash and Stretch calculation based on velocity and landing impact!
    let scaleX = 1.0;
    let scaleY = 1.0;
    if (!s.pOnGround) {
      // Stretch on jump/fall
      const jumpStretch = Math.min(0.18, Math.abs(s.pvy) * 0.012);
      scaleY += jumpStretch;
      scaleX -= jumpStretch * 0.85;
    } else if (s.landSquish && s.landSquish > 0) {
      // Squish on land cushion
      scaleY -= s.landSquish;
      scaleX += s.landSquish * 1.2;
    } else if (animState === 'duck') {
      scaleY = 0.7;
      scaleX = 1.3;
    } else if (animState === 'walk') {
      // Subtle organic bobbing while running
      const bob = Math.sin(walkTick * 0.22) * 0.03;
      scaleY += bob;
      scaleX -= bob;
    }

    // Translate to center bottom pivot (feet on the ground) and apply physical scaling, then translate back
    const centerX = px + pw / 2;
    const bottomY = py + ph;
    ctx.translate(centerX, bottomY);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-centerX, -bottomY);

    // Render by player type!
    if (s.playerType === 'explorer') {
      // 1. Nómada de la Sierra (Majestic mountain traveler with a colorful wool Poncho, woven Morral satchel, and leather headband with falcon feather!)
      // Woven Morral Satchel on back
      ctx.fillStyle = '#8d6e63'; // woven brown wool
      const bpX = facing === 'right' ? px - 4 : px + pw - 2;
      ctx.fillRect(bpX + bodyXOffset, py + 10 + bodyYOffset, 6, 12 + bodyHeightDiff);
      ctx.fillStyle = '#4e342e'; // dark binding strap
      ctx.fillRect(bpX + 1 + bodyXOffset, py + 14 + bodyYOffset, 4, 2);

      // Traditional Striped Poncho / Sarape de la Sierra
      ctx.fillStyle = '#c0392b'; // deep crimson wool base
      ctx.fillRect(px + 1 + bodyXOffset, py + 11 + bodyYOffset, pw - 2, ph - 14 + bodyHeightDiff);

      // Sarape beautiful tribal/ethnic stripes (yellow and white horizontal threads)
      ctx.fillStyle = '#f1c40f'; // bright gold threads
      ctx.fillRect(px + 1 + bodyXOffset, py + 13 + bodyYOffset, pw - 2, 2.5);
      ctx.fillRect(px + 1 + bodyXOffset, py + 21 + bodyYOffset, pw - 2, 2.5);

      ctx.fillStyle = '#ffffff'; // white accent thread lines
      ctx.fillRect(px + 1 + bodyXOffset, py + 15 + bodyYOffset, pw - 2, 1.5);
      ctx.fillRect(px + 1 + bodyXOffset, py + 19 + bodyYOffset, pw - 2, 1.5);

      // Poncho bottom fringes (small diagonal threads)
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(px + 2 + bodyXOffset, py + ph - 4 + bodyYOffset, 3, 2);
      ctx.fillRect(px + pw / 2 - 2 + bodyXOffset, py + ph - 4 + bodyYOffset, 3, 2);
      ctx.fillRect(px + pw - 5 + bodyXOffset, py + ph - 4 + bodyYOffset, 3, 2);

      // Head (suntanned mountain skin tone)
      ctx.fillStyle = '#e5a93b'; 
      ctx.beginPath();
      ctx.arc(px + pw / 2, py + 5.5 + headYOffset, 5.5, 0, Math.PI * 2);
      ctx.fill();

      // Cinta Nómada de Cuero (Leather forehead headband)
      ctx.fillStyle = '#5c3a21'; // thick leather band
      ctx.fillRect(px + pw / 2 - 5.5, py + 2 + headYOffset, 11, 2.5);

      // Sacred Turquoise stone bead on headband center
      ctx.fillStyle = '#00fbff';
      ctx.fillRect(px + pw / 2 + (facing === 'right' ? 2.5 : -4.5), py + 2 + headYOffset, 2.5, 2.5);

      // Pluma de Halcón de la Sierra (Sacred mountain falcon feather pointing up diagonally)
      ctx.fillStyle = '#ffffff'; // white quill and plume base
      ctx.save();
      ctx.translate(px + pw / 2 - (facing === 'right' ? 3.5 : -2.5), py + 1.5 + headYOffset);
      ctx.rotate(facing === 'right' ? -Math.PI / 4 : Math.PI / 4);
      // Main feather blade
      ctx.fillRect(-2, -7, 3, 7);
      ctx.fillStyle = '#1e272e'; // dark obsidian feather tip symbol
      ctx.fillRect(-2, -9, 3, 2.5);
      ctx.restore();

      // Eye
      ctx.fillStyle = '#000000';
      const eyeOffset = facing === 'right' ? 2 : -2;
      ctx.fillRect(px + pw / 2 + eyeOffset, py + 4.5 + headYOffset, 2, 2);

      // Suede travel boots with laces
      ctx.fillStyle = '#4e342e';
      ctx.fillRect(px, py + ph - 3 + (leftFootOffset > 0 ? -leftFootOffset : 0), 5, 3.5 + (leftFootOffset > 0 ? leftFootOffset : 0));
      ctx.fillRect(px + pw - 5, py + ph - 3 + (rightFootOffset > 0 ? -rightFootOffset : 0), 5, 3.5 + (rightFootOffset > 0 ? rightFootOffset : 0));

    } else if (s.playerType === 'glasses') {
      // 2. Lentes (Violet hipster hoodie, dark sunglasses, double-jump)
      // Hoodie
      ctx.fillStyle = '#8e44ad'; // Hipster violet
      ctx.fillRect(px + 1 + bodyXOffset, py + 11 + bodyYOffset, pw - 2, ph - 13 + bodyHeightDiff);
      // Hoodie cap hood fold
      ctx.fillStyle = '#6c0892';
      ctx.fillRect(px + (facing === 'right' ? 0 : pw - 4) + bodyXOffset, py + 11 + bodyYOffset, 4, 8 + bodyHeightDiff / 2);

      // Face
      ctx.fillStyle = '#ffeaa7';
      ctx.beginPath();
      ctx.arc(px + pw / 2, py + 6 + headYOffset, 6.5, 0, Math.PI * 2);
      ctx.fill();

      // Giant COOL pixelated black sunglasses! (Sr. Lentes)
      ctx.fillStyle = '#000000';
      const glFace = facing === 'right' ? 2.5 : -2.5;
      ctx.fillRect(px + pw / 2 + glFace - 4, py + 4.5 + headYOffset, 7, 3); // frame
      ctx.fillStyle = '#ffffff'; // white diagonal reflection glass glare
      ctx.fillRect(px + pw / 2 + glFace - 3, py + 4.5 + headYOffset, 1, 1.5);

      // Shoes
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(px, py + ph - 3 + (leftFootOffset > 0 ? -leftFootOffset : 0), 5, 4 + (leftFootOffset > 0 ? leftFootOffset : 0));
      ctx.fillRect(px + pw - 5, py + ph - 3 + (rightFootOffset > 0 ? -rightFootOffset : 0), 5, 4 + (rightFootOffset > 0 ? rightFootOffset : 0));

    } else if (s.playerType === 'truck') {
      // 3. Monster Truck! Red cabin, large rolling wheels
      // Cabin red frame
      ctx.fillStyle = '#e74c3c'; // Fire red
      ctx.fillRect(px, py + 1 + rumbleY, pw, ph - 9);
      // Windshield
      ctx.fillStyle = '#e0f7fa';
      const wsX = facing === 'right' ? px + pw - 10 : px + 2;
      ctx.fillRect(wsX, py + 3 + rumbleY, 8, 6);

      // Exhaust pipe soot puffs
      ctx.fillStyle = '#7f8c8d';
      const exhX = facing === 'right' ? px + 2 : px + pw - 5;
      ctx.fillRect(exhX, py - 4 + rumbleY, 3, 6);
      if (Math.random() < 0.15) {
        s.particles.push({
          id: Math.random().toString(),
          x: exhX + camX,
          y: py - 5,
          vx: (Math.random() - 0.5) * 1,
          vy: -Math.random() * 2,
          color: 'rgba(120,120,120,0.55)',
          size: Math.random() * 4 + 2,
          life: 0.6
        });
      }

      // Yellow neon headlights
      ctx.fillStyle = '#f1c40f';
      const litX = facing === 'right' ? px + pw - 2 : px;
      ctx.fillRect(litX, py + 9 + rumbleY, 2, 3);

      // Wheels suspensions
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(px + 2, py + ph - 9 + rumbleY / 2, 4, 4);
      ctx.fillRect(px + pw - 6, py + ph - 9 + rumbleY / 2, 4, 4);

      // Two BIG black rubber rolling wheels!
      const wAngle = (s.px * 0.08) % (Math.PI * 2); // spin proportional to walk!
      const wheelRadius = 7.5;
      
      const drawWheel = (wx: number, wy: number) => {
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(wAngle);
        
        ctx.fillStyle = '#111111'; // tyre
        ctx.beginPath();
        ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff'; // rim pattern
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-wheelRadius, 0);
        ctx.lineTo(wheelRadius, 0);
        ctx.moveTo(0, -wheelRadius);
        ctx.lineTo(0, wheelRadius);
        ctx.stroke();

        ctx.fillStyle = '#bdc3c7'; // metal center hub caps
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      };

      drawWheel(px + 5, py + ph - 5);
      drawWheel(px + pw - 5, py + ph - 5);

    } else if (s.playerType === 'bike') {
      // 4. Blue Motorcycle!
      ctx.fillStyle = '#2980b9'; // Speed blue
      ctx.fillRect(px, py + 3 + rumbleY, pw, ph - 9);
      
      // Handlebars and seat
      ctx.fillStyle = '#34495e';
      ctx.fillRect(px + 4, py + 1 + rumbleY, pw - 8, 2);

      // Rider helmet
      ctx.fillStyle = '#ecf0f1';
      ctx.beginPath();
      ctx.arc(px + pw / 2, py + 1 + rumbleY, 5, 0, Math.PI * 2);
      ctx.fill();
      // Black visor
      ctx.fillStyle = '#000000';
      const visX = facing === 'right' ? px + pw / 2 + 1 : px + pw / 2 - 4;
      ctx.fillRect(visX, py - 1 + rumbleY, 3, 2);

      // Light glow
      ctx.fillStyle = '#fef08a';
      const blitX = facing === 'right' ? px + pw - 1 : px;
      ctx.fillRect(blitX, py + 5 + rumbleY, 2, 3);

      // Front & Rear bike wheels
      const bAngle = (s.px * 0.1) % (Math.PI * 2);
      const drawBikeWheel = (wx: number, wy: number) => {
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(bAngle);
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#7f8c8d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      drawBikeWheel(px + 4, py + ph - 5);
      drawBikeWheel(px + pw - 4, py + ph - 5);

    } else if (s.playerType === 'catquad') {
      // 5. CatQuad (white cat ears atop yellow quad ATV!)
      ctx.fillStyle = '#f1c40f'; // Gold chassis
      ctx.fillRect(px, py + 7 + rumbleY, pw, ph - 13);

      // Kitty ears
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(px + 2, py + 7 + rumbleY);
      ctx.lineTo(px + 6, py + 1.5 + rumbleY);
      ctx.lineTo(px + 8, py + 7 + rumbleY);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(px + pw - 8, py + 7 + rumbleY);
      ctx.lineTo(px + pw - 6, py + 1.5 + rumbleY);
      ctx.lineTo(px + pw - 2, py + 7 + rumbleY);
      ctx.fill();

      // Whiskers
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1;
      const wDir = facing === 'right' ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(px + pw / 2, py + 8 + rumbleY);
      ctx.lineTo(px + pw / 2 + 9 * wDir, py + 6 + rumbleY);
      ctx.moveTo(px + pw / 2, py + 9 + rumbleY);
      ctx.lineTo(px + pw / 2 + 9 * wDir, py + 9 + rumbleY);
      ctx.stroke();

      // ATV rolling wheels
      const qAngle = (s.px * 0.09) % (Math.PI * 2);
      const drawQuadWheel = (wx: number, wy: number) => {
        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(qAngle);
        ctx.fillStyle = '#333333';
        ctx.beginPath();
        ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();
        // Neon green hub
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-2, -2, 4, 4);
        ctx.restore();
      };
      drawQuadWheel(px + 4, py + ph - 5);
      drawQuadWheel(px + pw - 4, py + ph - 5);

    } else if (s.playerType === 'brocoliano') {
      // 6. Gallo Brocoliano (Broccoli crown head/body + wings flight!)
      ctx.fillStyle = '#2ecc71'; // Broccoli rich green
      ctx.fillRect(px + 1 + bodyXOffset, py + 9 + bodyYOffset, pw - 2, ph - 12 + bodyHeightDiff);
      
      // Fluffy broccoli nodes structure
      ctx.fillStyle = '#27ae60';
      ctx.beginPath();
      ctx.arc(px + pw / 2 + bodyXOffset, py + 9 + bodyYOffset, 4, 0, Math.PI * 2);
      ctx.arc(px + pw / 2 - 4 + bodyXOffset, py + 13 + bodyYOffset, 3.5, 0, Math.PI * 2);
      ctx.arc(px + pw / 2 + 4 + bodyXOffset, py + 13 + bodyYOffset, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Rooster Cream Face
      ctx.fillStyle = '#fef08a'; // pale yellow
      ctx.beginPath();
      ctx.arc(px + pw / 2 + bodyXOffset, py + 5 + headYOffset, 6, 0, Math.PI * 2);
      ctx.fill();

      // Crest
      ctx.fillStyle = '#ef4444'; // Fire crest
      ctx.beginPath();
      ctx.arc(px + pw / 2 - 2 + bodyXOffset, py - 1 + headYOffset, 2.5, 0, Math.PI * 2);
      ctx.arc(px + pw / 2 + 2 + bodyXOffset, py - 1 + headYOffset, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Peak beak
      ctx.fillStyle = '#f39c12';
      const beakDir = facing === 'right' ? 1.5 : -1.5;
      ctx.beginPath();
      ctx.moveTo(px + pw / 2 + bodyXOffset, py + 4 + headYOffset);
      ctx.lineTo(px + pw / 2 + (6 + bodyXOffset) * beakDir, py + 6.5 + headYOffset);
      ctx.lineTo(px + pw / 2 + bodyXOffset, py + 8 + headYOffset);
      ctx.fill();

      // Flapping wing!
      ctx.fillStyle = '#2ecc71';
      ctx.save();
      const wingPivotX = facing === 'right' ? px + bodyXOffset : px + pw + bodyXOffset;
      ctx.translate(wingPivotX, py + 14 + bodyYOffset);
      
      const isHovering = s.keys['ArrowUp'] || s.keys['Space'] || s.keys[' '] || s.keys['w'] || s.keys['W'];
      const flapAngle = (!s.pOnGround && isHovering)
        ? Math.sin(Date.now() * 0.04) * 0.95 
        : Math.sin(Date.now() * 0.01) * 0.2;
      
      ctx.rotate(flapAngle);
      ctx.fillRect(facing === 'right' ? -6 : 0, -3, 6, 8);
      ctx.fillStyle = '#ef4444'; // red feathers highlight
      ctx.fillRect(facing === 'right' ? -8 : 6, -1, 2, 4);
      ctx.restore();

      // Feet
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(px + 3, py + ph - 3 + (leftFootOffset > 0 ? -leftFootOffset : 0), 3, 3 + (leftFootOffset > 0 ? leftFootOffset : 0));
      ctx.fillRect(px + pw - 6, py + ph - 3 + (rightFootOffset > 0 ? -rightFootOffset : 0), 3, 3 + (rightFootOffset > 0 ? rightFootOffset : 0));
    }

    ctx.restore();
  };

  const drawEnemies = (
    ctx: CanvasRenderingContext2D,
    enemies: Enemy[],
    camX: number
  ) => {
    enemies.forEach((en) => {
      const ex = en.x - camX;
      const ey = en.y;

      if (ex < -80 || ex > 720) return;

      if (en.state === 'frozen') {
        // Frozen blue iceblock casing rendering
        ctx.fillStyle = 'rgba(74, 185, 255, 0.7)';
        ctx.fillRect(ex - 4, ey - 4, en.width + 8, en.height + 8);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ex - 4, ey - 4, en.width + 8, en.height + 8);
        return; // skip standard rendering
      }

      if (en.type === 'champi') {
        if (levelTheme === 'green') {
          // --- Carrito Estresado (Stressed red sedan car) ---
          ctx.fillStyle = '#e74c3c'; // red car chassis
          ctx.fillRect(ex, ey + 4, en.width, en.height - 8); // car cabin base
          
          ctx.fillStyle = '#c0392b'; // darker car upper rooftop
          ctx.fillRect(ex + 4, ey, en.width - 8, 5);
          
          // Headlights glowing
          ctx.fillStyle = '#f1c40f';
          const headlightsX = en.facing === 'left' ? ex : ex + en.width - 4;
          ctx.fillRect(headlightsX, ey + 10, 4, 3);
          
          // Windshield
          ctx.fillStyle = '#ffffff';
          const windX = en.facing === 'left' ? ex + 3 : ex + en.width - 11;
          ctx.fillRect(windX, ey + 2, 8, 3);
          
          // Tiny rotating black tires
          ctx.fillStyle = '#2d3436';
          const tireOffset = Math.sin(Date.now() * 0.05 + Number(en.id.charCodeAt(0) || 0)) * 1.5;
          ctx.fillRect(ex + 2, ey + en.height - 4, 5, 4);
          ctx.fillRect(ex + en.width - 7, ey + en.height - 4, 5, 4);
          
          // Stress steam coming out
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillRect(ex + en.width / 2 - 2, ey - 6 + tireOffset, 4, 4);
        } else {
          // Flat mushroom walking (Mushroom monster Goomba-like)
          // Procedural feet walking animation
          const walkFactor = Math.sin(Date.now() * 0.015 + Number(en.id.charCodeAt(0) || 0));
          ctx.fillStyle = '#2c3e50'; // charcoal shoes
          ctx.fillRect(ex + 1, ey + en.height - 4 + (walkFactor > 0 ? -2 : 0), 6, 4);
          ctx.fillRect(ex + en.width - 7, ey + en.height - 4 + (walkFactor < 0 ? -2 : 0), 6, 4);

          ctx.fillStyle = '#d35400'; // dark brown dome
          ctx.beginPath();
          ctx.arc(ex + en.width / 2, ey + 10, en.width / 2, Math.PI, 0);
          ctx.fill();
          
          ctx.fillStyle = '#f39c12'; // pale stalk
          ctx.fillRect(ex + 4, ey + 10, en.width - 8, en.height - 10);

          // Mean tiny white eyes
          ctx.fillStyle = '#000000';
          ctx.fillRect(ex + 6, ey + 10, 2, 5);
          ctx.fillRect(ex + 16, ey + 10, 2, 5);
        }
      } else if (en.type === 'tortu') {
        if (levelTheme === 'green') {
          // --- Yellow Taxi / Stressed City Bus ("Eco-Taxi Estresado") ---
          ctx.fillStyle = '#f1c40f'; // Yellow taxi body
          ctx.fillRect(ex, ey + 6, en.width, en.height - 10);
          
          ctx.fillStyle = '#2d3436'; // black taxímetro panel
          ctx.fillRect(ex + 4, ey + 2, en.width - 8, 5);
          
          // Taxi checkered details
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(ex, ey + 10, en.width, 2);
          ctx.fillStyle = '#000000';
          ctx.fillRect(ex + 4, ey + 10, 4, 2);
          ctx.fillRect(ex + 12, ey + 10, 4, 2);
          ctx.fillRect(ex + 20, ey + 10, 4, 2);
          
          // Headlights
          ctx.fillStyle = '#ffffff';
          const bulbX = en.facing === 'left' ? ex : ex + en.width - 4;
          ctx.fillRect(bulbX, ey + 11, 4, 3);
          
          // Wheels
          ctx.fillStyle = '#111';
          const taxiWheelOffset = Math.sin(Date.now() * 0.05 + Number(en.id.charCodeAt(0) || 0)) * 1.5;
          ctx.fillRect(ex + 2, ey + en.height - 5, 5, 5);
          ctx.fillRect(ex + en.width - 7, ey + en.height - 5, 5, 5);
          // shiny hubs
          ctx.fillStyle = '#f1c40f';
          ctx.fillRect(ex + 3, ey + en.height - 4 + (taxiWheelOffset > 0 ? -1 : 1), 3, 3);
          ctx.fillRect(ex + en.width - 6, ey + en.height - 4 + (taxiWheelOffset < 0 ? -1 : 1), 3, 3);
        } else {
          // Green Turtle shell walking (Koopa standard)
          // Procedural boots walking animation
          const walkFactor = Math.sin(Date.now() * 0.015 + Number(en.id.charCodeAt(1) || 0));
          ctx.fillStyle = '#f1c40f'; // yellow boots leg
          ctx.fillRect(ex + 3, ey + en.height - 6 + (walkFactor > 0 ? -2 : 0), 4, 6);
          ctx.fillRect(ex + en.width - 7, ey + en.height - 6 + (walkFactor < 0 ? -2 : 0), 4, 6);

          ctx.fillStyle = '#27ae60'; // Green dome shell
          ctx.beginPath();
          ctx.ellipse(ex + en.width / 2, ey + 16, 12, 10, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f1c40f'; // Yellow turtle neck & boots
          ctx.beginPath();
          const faceX = en.facing === 'left' ? ex + 3 : ex + en.width - 3;
          ctx.arc(faceX, ey + 8, 4, 0, Math.PI*2);
          ctx.fill();
        }
      } else if (en.type === 'volador') {
        if (levelTheme === 'green') {
          // --- Moto Bocina (Flying Honking Motorcyclist) ---
          ctx.fillStyle = '#2980b9'; // Blue scooter chassis
          ctx.fillRect(ex + 2, ey + 6, en.width - 4, en.height - 10);
          
          ctx.fillStyle = '#e74c3c'; // red delivery box
          const boxX = en.facing === 'left' ? ex + en.width - 8 : ex + 2;
          ctx.fillRect(boxX, ey + 2, 7, 8);
          
          // Motorcyclist helmet
          ctx.fillStyle = '#2c3e50';
          ctx.beginPath();
          ctx.arc(ex + en.width / 2, ey + 3, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff'; // visor
          const visX = en.facing === 'left' ? ex + en.width / 2 - 4 : ex + en.width / 2 + 1;
          ctx.fillRect(visX, ey + 2, 3, 2);

          // Exhaust spark (fluttering white exhaust smoke!)
          ctx.fillStyle = '#bdc3c7';
          ctx.beginPath();
          const puffX = en.facing === 'left' ? ex + en.width - 2 : ex - 4;
          const puffY = ey + en.height - 6 + Math.sin(Date.now() * 0.05) * 3;
          ctx.arc(puffX, puffY, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Flying Red Koopa with cute flapping white wings!
          ctx.fillStyle = '#c0392b'; // red shell
          ctx.beginPath();
          ctx.ellipse(ex + en.width / 2, ey + 16, 12, 10, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f1c40f'; // yellow neck
          ctx.beginPath();
          const faceX = en.facing === 'left' ? ex + 3 : ex + en.width - 3;
          ctx.arc(faceX, ey + 8, 4, 0, Math.PI * 2);
          ctx.fill();

          // White fluttering wing on side
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          const wingOffset = Math.sin(Date.now() * 0.02) * 5;
          ctx.ellipse(ex + en.width / 2 - 4, ey + 6 + wingOffset, 6, 4, -0.4, 0, Math.PI*2);
          ctx.fill();
        }
      } else if (en.type === 'jefe') {
        // --- El Gran Oso de la Sierra de Santiago ---
        // Boss bobbing walking animation
        const bearWalk = Math.sin(Date.now() * 0.01) * 3;
        
        ctx.fillStyle = '#402410'; // darker brown legs
        ctx.fillRect(ex + 8, ey + en.height - 8 + (bearWalk > 0 ? -3 : 0), 14, 8);
        ctx.fillRect(ex + en.width - 22, ey + en.height - 8 + (bearWalk < 0 ? -3 : 0), 14, 8);

        ctx.fillStyle = '#5c3a21'; // deep brown fur
        ctx.fillRect(ex, ey, en.width, en.height - 4);
        
        // Cozy lighter grizzly belly
        ctx.fillStyle = '#8e5431';
        ctx.fillRect(ex + 8, ey + 14, en.width - 16, en.height - 18);
        
        // Grizzly roaring snout
        ctx.fillStyle = '#f5cd79';
        const snoutX = en.facing === 'left' ? ex : ex + en.width - 20;
        ctx.fillRect(snoutX, ey + 22, 20, 16);
        ctx.fillStyle = '#cf6a87'; // red roaring tongue
        ctx.fillRect(snoutX + (en.facing === 'left' ? 4 : 8), ey + 26, 8, 6);
        
        // Massive roaring yellow claws
        ctx.fillStyle = '#f1c40f';
        const clawsX = en.facing === 'left' ? ex - 4 : ex + en.width - 2;
        ctx.fillRect(clawsX, ey + en.height - 10, 6, 6);
        
        // Glowing red angry eyes
        ctx.fillStyle = '#e74c3c';
        const eyesX = en.facing === 'left' ? ex + 10 : ex + en.width - 16;
        ctx.fillRect(eyesX, ey + 10, 6, 4);

        // Flannel Red-and-Black Plaid Lumberjack Hat!
        ctx.fillStyle = '#e74c3c'; // red base
        ctx.fillRect(ex, ey - 10, en.width, 10);
        ctx.fillStyle = '#2c3e50'; // black checkers mesh
        ctx.fillRect(ex + 8, ey - 10, 8, 10);
        ctx.fillRect(ex + 24, ey - 10, 8, 10);
        ctx.fillRect(ex + 40, ey - 10, 8, 10);
      }

      // --- DRAW TRAFFIC LIGHT & ALERT INDICATORS ABOVE HEAD ---
      if (en.state !== 'squished' && en.type !== 'jefe') {
        const indicatorY = ey - 10;
        
        // 1. Draw traffic semaphore if patrolling
        if (!en.isAlerted && en.trafficLightState) {
          ctx.save();
          // Semaphore backing box
          ctx.fillStyle = '#2d3436';
          ctx.beginPath();
          ctx.rect(ex + en.width / 2 - 4, indicatorY - 14, 8, 14);
          ctx.fill();
          
          // Draw lights
          // Red light (top)
          ctx.fillStyle = en.trafficLightState === 'red' ? '#ff4757' : '#4b4b4b';
          ctx.beginPath();
          ctx.arc(ex + en.width / 2, indicatorY - 11, 2, 0, Math.PI * 2);
          ctx.fill();
          
          // Yellow light (mid)
          ctx.fillStyle = en.trafficLightState === 'yellow' ? '#ffa502' : '#4b4b4b';
          ctx.beginPath();
          ctx.arc(ex + en.width / 2, indicatorY - 7, 2, 0, Math.PI * 2);
          ctx.fill();
          
          // Green light (bottom)
          ctx.fillStyle = en.trafficLightState === 'green' ? '#2ed573' : '#4b4b4b';
          ctx.beginPath();
          ctx.arc(ex + en.width / 2, indicatorY - 3, 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }

        // 2. Draw warning/anger alert beacon if chased!
        if (en.isAlerted) {
          ctx.save();
          // Glowing hazard exclamation triangle
          const beat = Math.sin(Date.now() * 0.01) * 3;
          const bubbleY = indicatorY - 14 + beat;

          // Draw a small warning bubble
          ctx.fillStyle = '#ff4757';
          ctx.beginPath();
          ctx.arc(ex + en.width / 2, bubbleY, 7, 0, Math.PI * 2);
          ctx.fill();

          // White exclamation mark
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(ex + en.width / 2 - 1, bubbleY - 4, 1.8, 5);
          ctx.fillRect(ex + en.width / 2 - 1, bubbleY + 2, 1.8, 1.8);

          // Little neon status rings
          ctx.strokeStyle = '#ff9f1a';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(ex + en.width / 2, bubbleY, 9 + Math.abs(beat), 0, Math.PI * 2);
          ctx.stroke();

          ctx.restore();
        }
      }
    });
  };

  const drawProjectiles = (
    ctx: CanvasRenderingContext2D,
    projectiles: Projectile[],
    camX: number
  ) => {
    projectiles.forEach((p) => {
      const px = p.x - camX;
      if (p.type === 'fire') {
        // Red orange ball glowing with tail
        ctx.fillStyle = '#ff3f34';
        ctx.beginPath();
        ctx.arc(px, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffc048';
        ctx.beginPath();
        ctx.arc(px - p.vx, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'ice') {
        // Ice crystal blue ball glowing
        ctx.fillStyle = '#0fbcf9';
        ctx.beginPath();
        ctx.arc(px, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'rock') {
        // Bouncy mud boulder rock drawing
        ctx.fillStyle = '#834c14';
        ctx.beginPath();
        ctx.arc(px, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#3e1a00';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (p.type === 'spark') {
        // Spark electric small glowing lightning
        ctx.fillStyle = '#00f7ff';
        ctx.beginPath();
        ctx.arc(px, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, p.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  };

  const drawParticles = (
    ctx: CanvasRenderingContext2D,
    particles: GameParticle[],
    camX: number
  ) => {
    particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      // Render particle size proportionally to its current lifetime
      const dynamicSize = Math.max(0.6, p.size * p.life);
      ctx.arc(p.x - camX, p.y, dynamicSize, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0; // reset
  };

  const drawFloatingTexts = (
    ctx: CanvasRenderingContext2D,
    texts: FloatingText[],
    camX: number
  ) => {
    ctx.font = 'bold 10px monospace';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.textAlign = 'center';

    texts.forEach((tx) => {
      ctx.fillStyle = `rgba(255, 255, 255, ${tx.life})`;
      ctx.strokeText(tx.text, tx.x - camX, tx.y);
      ctx.fillText(tx.text, tx.x - camX, tx.y);
    });
  };

  const drawNomadHeart = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    filled: boolean
  ) => {
    ctx.save();
    // Black outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.8;
    ctx.fillStyle = filled ? '#ff3838' : '#3f3f3f'; // filled red OR empty dark gray
    
    // Pixel-art styled heart vectors
    ctx.beginPath();
    ctx.moveTo(x + 7, y + 12);
    ctx.lineTo(x + 1, y + 6);
    ctx.lineTo(x + 1, y + 3);
    ctx.lineTo(x + 3, y + 1);
    ctx.lineTo(x + 6, y + 1);
    ctx.lineTo(x + 7, y + 3);
    ctx.lineTo(x + 8, y + 1);
    ctx.lineTo(x + 11, y + 1);
    ctx.lineTo(x + 13, y + 3);
    ctx.lineTo(x + 13, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (filled) {
      // 16-bit specular shine highlight pixel
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 3, y + 3, 2, 2);
      // Dark shade on lower edge
      ctx.fillStyle = '#b31515';
      ctx.fillRect(x + 9, y + 7, 2, 2);
      ctx.fillRect(x + 7, y + 9, 2, 2);
    }
    ctx.restore();
  };

  const drawSpinningCoin = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number
  ) => {
    ctx.save();
    const timeMs = Date.now();
    const spinPhase = (timeMs / 140) % 4; // 140ms per frame rotation
    let widthFactorValue = 1.0;
    let colorOffset = 0;
    
    if (spinPhase < 1) {
      widthFactorValue = 1.0; // full coin facing reader
    } else if (spinPhase < 2) {
      widthFactorValue = 0.5; // mid turn
      colorOffset = 18;
    } else if (spinPhase < 3) {
      widthFactorValue = 0.15; // thin profile edge-on
      colorOffset = 42;
    } else {
      widthFactorValue = 0.5; // turning back
      colorOffset = 18;
    }

    // Polished gold gradient or shade
    ctx.fillStyle = `rgb(${Math.min(255, 230 + colorOffset)}, ${190 - colorOffset}, ${15})`;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    ctx.ellipse(x, y, 6 * widthFactorValue, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (widthFactorValue > 0.3) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 2 * widthFactorValue, y - 4, 1.8, 2.2);
    }
    ctx.restore();
  };

  const drawHUDActiveItem = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    powerUp: typeof stats.activePowerUp
  ) => {
    ctx.save();
    // Shiny metal rim border for the SMW-style reserve container
    ctx.fillStyle = '#1e252b';
    ctx.strokeStyle = '#8395a7';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, 22, 22);
    ctx.fillRect(x, y, 22, 22);

    // Inner dark container
    ctx.fillStyle = '#0a0d10';
    ctx.fillRect(x + 2, y + 2, 18, 18);

    if (powerUp === 'fire') {
      // Flame core
      ctx.fillStyle = '#ff4757';
      ctx.beginPath();
      ctx.arc(x + 11, y + 11, 6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#ffa502';
      ctx.beginPath();
      ctx.arc(x + 11, y + 12, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 9, y + 7, 2, 2);
    } else if (powerUp === 'ice') {
      // Ice crystal core
      ctx.fillStyle = '#0984e3';
      ctx.fillRect(x + 5, y + 10, 12, 2);
      ctx.fillRect(x + 10, y + 5, 2, 12);
      ctx.fillStyle = '#eccc68';
      ctx.fillStyle = '#74b9ff';
      ctx.fillRect(x + 8, y + 8, 6, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 10, y + 10, 2, 2);
    } else if (powerUp === 'turbo') {
      // Lightning gold core
      ctx.fillStyle = '#eccc68';
      ctx.beginPath();
      ctx.moveTo(x + 14, y + 4);
      ctx.lineTo(x + 7, y + 12);
      ctx.lineTo(x + 11, y + 12);
      ctx.lineTo(x + 8, y + 18);
      ctx.lineTo(x + 15, y + 10);
      ctx.lineTo(x + 11, y + 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  const drawWeatherParticles = (
    ctx: CanvasRenderingContext2D,
    s: typeof stateRef.current,
    theme: 'green' | 'cave' | 'sierra' | 'desert' | 'neon' | 'castle'
  ) => {
    ctx.save();

    // Check if we are flashing lightning
    if (theme === 'sierra' && s.lightningTimer > 0) {
      const strobe = s.lightningTimer % 4 < 2 ? 0.38 : 0.18;
      ctx.fillStyle = `rgba(255, 255, 255, ${strobe})`;
      ctx.fillRect(0, 0, 640, 480);
    }

    s.weatherParticles.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.life * (p.type === 'fog' ? 0.7 : 1.0);

      if (p.type === 'rain') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 1.5, p.y + (p.length || 15));
        ctx.stroke();
      } else if (p.type === 'haze') {
        const grad = ctx.createRadialGradient(p.x, p.y, p.size * 0.1, p.x, p.y, p.size);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'drop') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(p.x - p.size * 0.3, p.y - p.size * 0.3, 0.8, 0.8);
      } else if (p.type === 'splash') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'fog') {
        const grad = ctx.createRadialGradient(p.x, p.y, p.size * 0.1, p.x, p.y, p.size);
        grad.addColorStop(0, p.color);
        grad.addColorStop(0.5, 'rgba(180, 210, 240, 0.04)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'spore') {
        ctx.fillStyle = p.color;
        const pulsate = 1.0 + Math.sin(Date.now() * 0.008 + p.x) * 0.45;
        const glowRad = p.size * 2 * pulsate;
        
        ctx.shadowColor = p.color;
        ctx.shadowBlur = glowRad;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * pulsate, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
      } else if (p.type === 'ember') {
        ctx.fillStyle = p.color;
        if (p.size > 2) {
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    });

    ctx.restore();
  };

  const drawCanvasHUD = (
    ctx: CanvasRenderingContext2D,
    s: typeof stateRef.current,
    canvas: HTMLCanvasElement
  ) => {
    ctx.save();
    
    // Sleek translucent vintage top banner
    ctx.fillStyle = 'rgba(12, 12, 12, 0.82)';
    ctx.fillRect(0, 0, canvas.width, 36);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, 36, canvas.width, 2);
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 38);
    ctx.lineTo(canvas.width, 38);
    ctx.stroke();

    // Console style typography
    ctx.font = 'bold 11px "JetBrains Mono", "Fira Code", monospace';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.textAlign = 'left';

    // 1. Score
    const scoreStr = String(stats.score + s.scoreAdded).padStart(6, '0');
    ctx.fillStyle = '#ffffff';
    ctx.strokeText(`PTS:${scoreStr}`, 15, 22);
    ctx.fillText(`PTS:${scoreStr}`, 15, 22);

    // 2. Level Names mapping
    let lvlName = 'SANTIAGO';
    if (levelTheme === 'green') lvlName = 'SANTIAGO GP';
    else if (levelTheme === 'cave') lvlName = 'COLA CABALLO';
    else if (levelTheme === 'sierra') lvlName = 'ADJUNTAS CAN';
    else if (levelTheme === 'desert') lvlName = 'P. REDONDO';
    else if (levelTheme === 'neon') lvlName = 'POZA CHIPITÍN';
    else if (levelTheme === 'castle') lvlName = 'CIMA NOMADA';

    ctx.fillStyle = '#f8c291'; 
    ctx.strokeText(`NIVEL:${lvlName}`, 115, 22);
    ctx.fillText(`NIVEL:${lvlName}`, 115, 22);

    // 3. Reserve Active item slot
    ctx.fillStyle = '#a5b1c2';
    ctx.strokeText(`RESERVA`, 255, 22);
    ctx.fillText(`RESERVA`, 255, 22);
    drawHUDActiveItem(ctx, 312, 7, stats.activePowerUp);

    // 4. Coins animated
    const coinStartX = 358;
    drawSpinningCoin(ctx, coinStartX, 18);
    
    ctx.fillStyle = '#f1c40f';
    const coinStr = String(stats.coins + s.coinsCollected).padStart(2, '0');
    ctx.strokeText(`x${coinStr}`, coinStartX + 12, 22);
    ctx.fillText(`x${coinStr}`, coinStartX + 12, 22);

    // 5. Nomad Heart Container system (livesRemaining)
    const hStartX = 422;
    const maxLivesDisplay = Math.max(3, s.livesRemaining);
    for (let i = 0; i < maxLivesDisplay; i++) {
      const isFilled = i < s.livesRemaining;
      drawNomadHeart(ctx, hStartX + i * 16, 12, isFilled);
    }

    // 6. Retro Chrono Timer
    const timeStr = String(Math.max(0, timeRemaining)).padStart(3, '0');
    ctx.fillStyle = '#ff4757';
    ctx.textAlign = 'right';
    ctx.strokeText(`TIME:${timeStr}`, canvas.width - 15, 22);
    ctx.fillText(`TIME:${timeStr}`, canvas.width - 15, 22);

    ctx.restore();
  };

  // Keyboard and Reset Button trigger menus
  const handleRestart = () => {
    window.location.reload();
  };

  // --- TOUCH UX TRIGGER HANDLERS ---
  const updateDirectMovement = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const percentX = ((clientX - rect.left) / rect.width) * 100;
    const percentY = ((clientY - rect.top) / rect.height) * 100;

    setTouchTarget({ percentX, percentY });

    const scaleX = 640 / rect.width;
    const gameTouchX = (clientX - rect.left) * scaleX;

    const s = stateRef.current;
    const playerScreenX = s.px - s.cameraX;

    // Follow Horizontal Coordinates of finger
    if (gameTouchX > playerScreenX + 20) {
      touchKeysRef.current['ArrowRight'] = true;
      touchKeysRef.current['ArrowLeft'] = false;
    } else if (gameTouchX < playerScreenX - 20) {
      touchKeysRef.current['ArrowLeft'] = true;
      touchKeysRef.current['ArrowRight'] = false;
    } else {
      touchKeysRef.current['ArrowRight'] = false;
      touchKeysRef.current['ArrowLeft'] = false;
    }
  };

  const handleDirectTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches && e.touches.length > 0) {
      updateDirectMovement(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleDirectTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches && e.touches.length > 0) {
      updateDirectMovement(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleDirectTouchEnd = () => {
    setTouchTarget(null);
    touchKeysRef.current['ArrowLeft'] = false;
    touchKeysRef.current['ArrowRight'] = false;
  };

  const handleDirectMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    updateDirectMovement(e.clientX, e.clientY);
  };

  const handleDirectMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons === 1) {
      updateDirectMovement(e.clientX, e.clientY);
    }
  };

  const handleDirectMouseUp = () => {
    setTouchTarget(null);
    touchKeysRef.current['ArrowLeft'] = false;
    touchKeysRef.current['ArrowRight'] = false;
  };

  const handleJoystickDragStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.touches && e.touches.length > 0) {
      handleJoystickDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleJoystickDragMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.touches && e.touches.length > 0) {
      handleJoystickDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleJoystickDragStartMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    handleJoystickDrag(e.clientX, e.clientY);
  };

  const handleJoystickDragMoveMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.buttons === 1) {
      handleJoystickDrag(e.clientX, e.clientY);
    }
  };

  const handleJoystickDrag = (clientX: number, clientY: number) => {
    const base = joystickBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;

    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxRadius = 35; // optimal tactile range

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setJoystickKnob({ x: dx, y: dy });

    // Emulate directional keys
    if (dx < -10) {
      touchKeysRef.current['ArrowLeft'] = true;
      touchKeysRef.current['ArrowRight'] = false;
    } else if (dx > 10) {
      touchKeysRef.current['ArrowRight'] = true;
      touchKeysRef.current['ArrowLeft'] = false;
    } else {
      touchKeysRef.current['ArrowLeft'] = false;
      touchKeysRef.current['ArrowRight'] = false;
    }

    if (dy < -12) {
      touchKeysRef.current['ArrowUp'] = true;
    } else if (dy > 18) {
      touchKeysRef.current['ArrowDown'] = true;
    } else {
      touchKeysRef.current['ArrowUp'] = false;
      touchKeysRef.current['ArrowDown'] = false;
    }
  };

  const handleJoystickEnd = () => {
    setJoystickKnob({ x: 0, y: 0 });
    touchKeysRef.current['ArrowLeft'] = false;
    touchKeysRef.current['ArrowRight'] = false;
    touchKeysRef.current['ArrowUp'] = false;
    touchKeysRef.current['ArrowDown'] = false;
  };

  return (
    <div className="flex flex-col items-center">
      {/* Active Game Level canvas wrapper */}
      <div className="w-full bg-zinc-950 flex flex-col items-center border-4 border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative">
        <canvas
          id="retro-game-canvas"
          ref={canvasRef}
          width={640}
          height={480}
          className="w-full h-auto aspect-[4/3] bg-black max-h-[480px]"
        />

        {/* Floating Interactive Controller settings bar - moved to bottom and made smaller */}
        <div className="absolute bottom-2.5 right-2 sm:right-2.5 flex items-center gap-1.5 bg-black/85 backdrop-blur border border-zinc-800/80 rounded-xl p-1 select-none z-15 scale-80 sm:scale-90 origin-bottom-right shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
          <button
            id="play-pause-btn"
            onClick={() => setIsPaused(!isPaused)}
            className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700/60 hover:bg-zinc-850 text-zinc-300 hover:text-white transition duration-150 cursor-pointer text-[10px] flex items-center gap-1 font-bold"
            title={isPaused ? 'Continuar' : 'Pausar'}
          >
            {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3 text-amber-400" />}
            <span>{isPaused ? 'Reanudar' : 'Pausa'}</span>
          </button>

          <button
            id="crt-toggle-btn"
            onClick={() => setCrtEnabled(!crtEnabled)}
            className={`px-2 py-0.5 rounded border border-zinc-700/60 transition duration-150 cursor-pointer text-[10px] font-bold flex items-center gap-1 ${
              crtEnabled
                ? 'bg-amber-950/40 border-amber-500/80 text-amber-300 hover:bg-amber-950/60'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
            title="Filtro de pantalla tipo televisor retro CRT"
          >
            <span>📺 CRT: {crtEnabled ? 'SÍ' : 'NO'}</span>
          </button>

          <button
            id="touch-toggle-btn"
            onClick={onToggleConsoleMode}
            className={`px-2 py-0.5 rounded border border-zinc-700/60 transition duration-150 cursor-pointer text-[10px] font-bold flex items-center gap-1 ${
              consoleMode === 'touch'
                ? 'bg-cyan-950/40 border-cyan-500/80 text-cyan-300 hover:bg-cyan-950/60 animate-pulse'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
            title="Activar consola touch separada de la pantalla"
          >
            <span>📱 TACTIL: {consoleMode === 'touch' ? 'SI' : 'RETRO'}</span>
          </button>

          <button
            id="restart-level-btn"
            onClick={() => {
              if (window.confirm('¿Seguro quieres reiniciar este nivel?')) {
                window.location.reload();
              }
            }}
            className="p-1 rounded bg-zinc-900 border border-zinc-700/60 hover:bg-zinc-850 text-zinc-300 hover:text-white transition duration-150 cursor-pointer"
            title="Reiniciar Nivel"
          >
            <RotateCcw className="w-3 h-3 text-zinc-400" />
          </button>
        </div>

        {/* Pause Screen Overlay */}
        {isPaused && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center font-mono text-center pb-8 select-none">
            <h2 className="text-3xl font-extrabold text-yellow-400 drop-shadow-[0_4px_0_rgba(0,0,0,0.8)] mb-2 uppercase">
              ⏸️ JUEGO EN PAUSA
            </h2>
            <p className="text-sm text-zinc-300 mb-6 max-w-sm">
              Toma un respiro. Haz clic en continuar o presiona START para seguir tu viaje por la Sierra.
            </p>
            <button
              id="paused-continue-btn"
              onClick={() => setIsPaused(false)}
              className="py-3 px-8 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-extrabold rounded-2xl tracking-widest text-sm uppercase transition duration-150 shadow-md transform hover:scale-105 cursor-pointer border-b-4 border-emerald-700"
            >
              Continuar Partida
            </button>
          </div>
        )}

        {/* --- DYNAMIC GLASSMORPHIC TOUCH CONTROLLER OVERLAY --- */}
        {showTouchOverlay && (
          <div className="absolute inset-0 pointer-events-none z-10 select-none flex flex-col justify-between p-4 bg-transparent">
            
            {/* Top row empty, allowing click settings button */}
            <div className="h-10 w-full" />

            {/* Middle row: Interactive Direct Follow Touch Zone */}
            <div 
              className="flex-1 w-full relative pointer-events-auto cursor-crosshair flex items-center justify-center group active:bg-cyan-500/5 transition duration-150 rounded-2xl"
              style={{ touchAction: 'none' }}
              onTouchStart={handleDirectTouchStart}
              onTouchMove={handleDirectTouchMove}
              onTouchEnd={handleDirectTouchEnd}
              onMouseDown={handleDirectMouseDown}
              onMouseMove={handleDirectMouseMove}
              onMouseUp={handleDirectMouseUp}
              onMouseLeave={handleDirectMouseUp}
            >
              {/* Dynamic Touch Position Indicator / Laser Pointer effect */}
              {touchTarget && (
                <div 
                  className="absolute w-12 h-12 rounded-full border border-dashed border-cyan-400 flex items-center justify-center -translate-x-1/2 -translate-y-1/2 pointer-events-none scale-100 animate-pulse"
                  style={{ left: `${touchTarget.percentX}%`, top: `${touchTarget.percentY}%` }}
                >
                  <div className="w-4 h-4 bg-cyan-400/80 rounded-full animate-ping" />
                  <div className="w-2 h-2 bg-cyan-300 rounded-full shadow-[0_0_8px_cyan]" />
                </div>
              )}
              
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] sm:text-[10px] text-zinc-400 bg-zinc-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-zinc-700/60 opacity-60 pointer-events-none group-hover:opacity-100 transition">
                👉 <span className="font-bold text-cyan-300">Desliza el dedo aquí</span> para moverte libremente
              </div>
            </div>

            {/* Bottom row: Touch Joystick (bottom-left) & Action Buttons (bottom-right) */}
            <div className="w-full flex items-end justify-between pointer-events-none gap-2">
              
              {/* Virtual Glowing D-pad Joystick */}
              <div className="pointer-events-auto flex flex-col items-center gap-1">
                <div 
                  ref={joystickBaseRef}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-zinc-900/70 backdrop-blur-md border border-zinc-700/40 shadow-lg relative flex items-center justify-center cursor-pointer touch-none"
                  style={{ touchAction: 'none' }}
                  onTouchStart={handleJoystickDragStart}
                  onTouchMove={handleJoystickDragMove}
                  onTouchEnd={handleJoystickEnd}
                  onMouseDown={handleJoystickDragStartMouse}
                  onMouseMove={handleJoystickDragMoveMouse}
                  onMouseUp={handleJoystickEnd}
                  onMouseLeave={handleJoystickEnd}
                >
                  {/* Cardinal Directions indicators */}
                  <span className="absolute top-1 text-[8px] font-black text-zinc-500">▲</span>
                  <span className="absolute bottom-1 text-[8px] font-black text-zinc-500">▼</span>
                  <span className="absolute left-1 text-[8px] font-black text-zinc-500">◀</span>
                  <span className="absolute right-1 text-[8px] font-black text-zinc-500">▶</span>

                  {/* Outer center ring */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-zinc-700/30 bg-transparent flex items-center justify-center pointer-events-none">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-dashed border-zinc-600 bg-black/10" />
                  </div>

                  {/* Floating Glowing Knob */}
                  <div 
                    className="absolute w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_3px_10px_rgba(6,182,212,0.5)] border border-cyan-300 flex items-center justify-center transition-transform active:scale-95 duration-75 pointer-events-none"
                    style={{
                      transform: `translate(${joystickKnob.x}px, ${joystickKnob.y}px)`
                    }}
                  >
                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-white/40 border border-white" />
                  </div>
                </div>
                <span className="text-[7px] font-black tracking-widest text-[#95a5a6] uppercase bg-black/40 px-1.5 py-0.5 rounded">
                  🕹️ VOLANTE SIERRA
                </span>
              </div>

              {/* Action Buttons Hub (right aligned) */}
              <div className="pointer-events-auto flex flex-col items-end gap-1.5 pr-1 pb-1">
                <div className="flex gap-1.5">
                  {/* Select Trampa button */}
                  <button
                    onMouseDown={() => { touchKeysRef.current['Select'] = true; }}
                    onMouseUp={() => { touchKeysRef.current['Select'] = false; }}
                    onMouseLeave={() => { touchKeysRef.current['Select'] = false; }}
                    onTouchStart={(e) => { e.preventDefault(); touchKeysRef.current['Select'] = true; }}
                    onTouchEnd={() => { touchKeysRef.current['Select'] = false; }}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-500/20 active:bg-amber-500/50 hover:bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40 shadow-inner flex flex-col items-center justify-center text-[7px] sm:text-[8px]"
                  >
                    <span className="text-xs sm:text-sm">🟨</span>
                    <span>APOYO</span>
                  </button>

                  {/* Turbo Run button */}
                  <button
                    onMouseDown={() => { touchKeysRef.current['Shift'] = true; }}
                    onMouseUp={() => { touchKeysRef.current['Shift'] = false; }}
                    onMouseLeave={() => { touchKeysRef.current['Shift'] = false; }}
                    onTouchStart={(e) => { e.preventDefault(); touchKeysRef.current['Shift'] = true; }}
                    onTouchEnd={() => { touchKeysRef.current['Shift'] = false; }}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-500/20 active:bg-purple-500/50 hover:bg-purple-500/30 text-purple-300 font-bold border border-purple-500/40 shadow-inner flex flex-col items-center justify-center text-[7px] sm:text-[8px]"
                  >
                    <span className="text-xs sm:text-sm">⚡</span>
                    <span>TURBO</span>
                  </button>
                </div>

                <div className="flex gap-1.5 items-end">
                  {/* Ice Gun */}
                  <button
                    onMouseDown={() => { touchKeysRef.current['x'] = true; }}
                    onMouseUp={() => { touchKeysRef.current['x'] = false; }}
                    onMouseLeave={() => { touchKeysRef.current['x'] = false; }}
                    onTouchStart={(e) => { e.preventDefault(); touchKeysRef.current['x'] = true; }}
                    onTouchEnd={() => { touchKeysRef.current['x'] = false; }}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-cyan-500/20 active:bg-cyan-500/50 hover:bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-500/40 shadow-inner flex flex-col items-center justify-center text-[7px] sm:text-[8px]"
                  >
                    <span className="text-xs sm:text-sm">❄️</span>
                    <span>HIELO</span>
                  </button>

                  {/* Fire Gun */}
                  <button
                    onMouseDown={() => { touchKeysRef.current['c'] = true; }}
                    onMouseUp={() => { touchKeysRef.current['c'] = false; }}
                    onMouseLeave={() => { touchKeysRef.current['c'] = false; }}
                    onTouchStart={(e) => { e.preventDefault(); touchKeysRef.current['c'] = true; }}
                    onTouchEnd={() => { touchKeysRef.current['c'] = false; }}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-rose-500/20 active:bg-rose-500/50 hover:bg-rose-500/30 text-rose-300 font-bold border border-rose-500/40 shadow-inner flex flex-col items-center justify-center text-[7px] sm:text-[8px]"
                  >
                    <span className="text-xs sm:text-sm">🔥</span>
                    <span>FUEGO</span>
                  </button>

                  {/* Big Blue Jump button */}
                  <button
                    onMouseDown={() => { touchKeysRef.current['ArrowUp'] = true; }}
                    onMouseUp={() => { touchKeysRef.current['ArrowUp'] = false; }}
                    onMouseLeave={() => { touchKeysRef.current['ArrowUp'] = false; }}
                    onTouchStart={(e) => { e.preventDefault(); touchKeysRef.current['ArrowUp'] = true; }}
                    onTouchEnd={() => { touchKeysRef.current['ArrowUp'] = false; }}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-500/30 active:bg-emerald-500/60 hover:bg-emerald-500/40 text-emerald-300 font-extrabold border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)] flex flex-col items-center justify-center text-[8px] sm:text-[10px]"
                  >
                    <span className="text-lg sm:text-xl">▲</span>
                    <span>SALTAR</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Tutorial panel legend */}
      <div className="w-full max-w-2xl bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800/80 mt-4 text-zinc-400 font-mono text-[10px] grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-bold text-zinc-300">🔥 CONTROLES JALANDO:</span>
          <span>Movimiento: Flechas / WASD</span>
          <span>Saltar: Barra Espaciadora / A / W</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-bold text-zinc-300">⚔️ ACCIÓN RETRO:</span>
          <span>Turbo correr: Mantén botón B (Shift)</span>
          <span>Trampa SELECT: Coloca bloque de apoyo</span>
        </div>
        <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
          <span className="font-bold text-zinc-300">🌟 HABILIDADES (C y D):</span>
          <span>C (Y): Bola de fuego (Fuego activo)</span>
          <span>D (X): Congelar enemigo (Hielo activo)</span>
        </div>
      </div>
    </div>
  );
}
