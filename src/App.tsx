import React, { useState, useEffect, useRef } from 'react';
import { LevelConfig, PlayerStats } from './types';
import { audio } from './audio';
import HUD from './components/HUD';
import OverworldMap from './components/OverworldMap';
import GameCanvas from './components/GameCanvas';
import SpriteLab from './components/SpriteLab';
import VirtualPad from './components/VirtualPad';
import { Trophy, HelpCircle, ArrowRight, RefreshCw, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const INITIAL_LEVELS: LevelConfig[] = [
  {
    id: 'level1',
    name: '1-1. Rumbo a Santiago (Tráfico y Estrés)',
    theme: 'green',
    unlocked: true,
    completed: false,
    x: 15,
    y: 42,
    connections: ['level2'],
    highScore: 0,
    coinsCount: 20,
    timeLimit: 300,
  },
  {
    id: 'level2',
    name: '1-2. Cascada Cola de Caballo',
    theme: 'cave',
    unlocked: false,
    completed: false,
    x: 30,
    y: 28,
    connections: ['level3'],
    highScore: 0,
    coinsCount: 24,
    timeLimit: 320,
  },
  {
    id: 'level3',
    name: '2-1. Las Adjuntas (Río Salvador)',
    theme: 'sierra',
    unlocked: false,
    completed: false,
    x: 46,
    y: 48,
    connections: ['level4'],
    highScore: 0,
    coinsCount: 30,
    timeLimit: 340,
  },
  {
    id: 'level4',
    name: '2-2. Cañón Potrero Redondo',
    theme: 'desert',
    unlocked: false,
    completed: false,
    x: 60,
    y: 32,
    connections: ['level5'],
    highScore: 0,
    coinsCount: 35,
    timeLimit: 360,
  },
  {
    id: 'level5',
    name: '3-1. Cascada Chipitín (Poza Turquesa)',
    theme: 'neon',
    unlocked: false,
    completed: false,
    x: 74,
    y: 54,
    connections: ['level6'],
    highScore: 0,
    coinsCount: 40,
    timeLimit: 380,
  },
  {
    id: 'level6',
    name: '3-2. Campamento Nómadas (La Cima)',
    theme: 'castle',
    unlocked: false,
    completed: false,
    x: 88,
    y: 38,
    connections: [],
    highScore: 0,
    coinsCount: 50,
    timeLimit: 400,
  }
];

export default function App() {
  const [gameMode, setGameMode] = useState<'menu' | 'map' | 'level' | 'gameover' | 'victory'>('menu');
  const [levels, setLevels] = useState<LevelConfig[]>(INITIAL_LEVELS);
  const [menuCursor, setMenuCursor] = useState<number>(0); // 0 = 1 JUGADOR, 1 = 2 JUGADORES
  const [playPlayersMode, setPlayPlayersMode] = useState<number>(1); // 1 o 2 players
  const [activeLevelId, setActiveLevelId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeKeys, setActiveKeys] = useState<{ [key: string]: boolean }>({});
  const [showSpriteLab, setShowSpriteLab] = useState<boolean>(false);
  const [consoleMode, setConsoleMode] = useState<'retro' | 'touch'>('retro');
  const [consoleTheme, setConsoleTheme] = useState<'gameboy' | 'snes'>('snes');

  // Modern digital touchscreen controller states
  const [joystickKnob, setJoystickKnob] = useState({ x: 0, y: 0 });
  const [touchTarget, setTouchTarget] = useState<{ percentX: number; percentY: number } | null>(null);
  const joystickBaseRef = useRef<HTMLDivElement | null>(null);

  const [stats, setStats] = useState<PlayerStats>({
    score: 0,
    coins: 0,
    lives: 5,
    activePowerUp: 'normal',
    unlockedLevels: ['level1'],
    completedLevels: []
  });

  // Track physical keyboard listeners to bind keys state globally
  useEffect(() => {
    // Ensure the iframe window gains focus on any interaction
    const handleWindowFocus = () => {
      window.focus();
    };
    window.addEventListener('mousedown', handleWindowFocus);
    window.addEventListener('touchstart', handleWindowFocus);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Direct guard: if typing inside high resolution sprite creator textareas, ignore Gameboy bindings
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      // Auto-focus window on key down to keep input connected
      window.focus();

      // Prevent scrolling defaults for arrows and space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(e.key)) {
        e.preventDefault();
      }

      // Keep key naming standard for local physics canvas
      let k = e.key;
      if (e.key === ' ' || e.key === 'Spacebar') k = 'Space'; // Space / Spacebar is JUMP
      if (e.key.toLowerCase() === 'z') {
        k = 'select'; // Z is SELECT (Platform/Trap Placement)
        setShowSpriteLab(prev => !prev);
        audio.playCoin();
      }
      if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'y') k = 'c'; // Y / C is fire
      if (e.key.toLowerCase() === 'x' || e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 'k') k = 'x'; // X / V / K is ice, avoiding conflict with movement 'd'
      if (e.key.toLowerCase() === 'b') k = 'b';
      if (e.key === 'Shift') k = 'b'; // shift holds turbo/lift
      if (e.key === 'Enter') k = 'start';
      if (e.key === 'Escape') k = 'start';

      setActiveKeys((prev) => ({ ...prev, [k]: true, [e.key]: true }));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Guard: ignore if inside active input fields
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      let k = e.key;
      if (e.key === ' ' || e.key === 'Spacebar') k = 'Space'; // Space / Spacebar is JUMP
      if (e.key.toLowerCase() === 'z') k = 'select'; // Z is SELECT (Platform/Trap Placement)
      if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'y') k = 'c';
      if (e.key.toLowerCase() === 'x' || e.key.toLowerCase() === 'v' || e.key.toLowerCase() === 'k') k = 'x';
      if (e.key.toLowerCase() === 'b') k = 'b';
      if (e.key === 'Shift') k = 'b';
      if (e.key === 'Enter') k = 'start';
      if (e.key === 'Escape') k = 'start';

      setActiveKeys((prev) => ({ ...prev, [k]: false, [e.key]: false }));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('mousedown', handleWindowFocus);
      window.removeEventListener('touchstart', handleWindowFocus);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Track audio muting and start overworld track on click init
  const handleToggleMute = () => {
    const nextMute = audio.toggleMute();
    setIsMuted(nextMute);
  };

  const handleStartGame = () => {
    audio.playCoin();
    // Warm up/resume AudioContext through gesture
    setIsMuted(audio.getMuteState());
    setGameMode('map');
  };

  const handleSelectLevelId = (levelId: string) => {
    setActiveLevelId(levelId);
    setGameMode('level');
  };

  // Callback to update scores or live states during runtime
  const handleUpdateStatsByCanvas = (changes: Partial<PlayerStats>) => {
    setStats((prev) => ({ ...prev, ...changes }));
  };

  const handleClearActiveLevel = (scoreGained: number, coinsGained: number) => {
    if (!activeLevelId) return;

    // Proceed to unlock next level
    const updatedLevels = levels.map((l) => {
      if (l.id === activeLevelId) {
        // Mark completed and update highscore if current score exceeds previous record
        const nextScore = Math.max(l.highScore, scoreGained);
        return { ...l, completed: true, highScore: nextScore };
      }
      return l;
    });

    const activeLevelIndex = INITIAL_LEVELS.findIndex((l) => l.id === activeLevelId);
    const nextLevelConfig = INITIAL_LEVELS[activeLevelIndex + 1];

    let unlockedLvs = [...stats.unlockedLevels];
    let completedLvs = [...stats.completedLevels];

    if (!completedLvs.includes(activeLevelId)) {
      completedLvs.push(activeLevelId);
    }

    if (nextLevelConfig && !unlockedLvs.includes(nextLevelConfig.id)) {
      unlockedLvs.push(nextLevelConfig.id);
    }

    const finalLevels = updatedLevels.map((l) => {
      if (unlockedLvs.includes(l.id)) {
        return { ...l, unlocked: true };
      }
      return l;
    });

    setLevels(finalLevels);
    setStats((prev) => ({
      ...prev,
      unlockedLevels: unlockedLvs,
      completedLevels: completedLvs,
      score: prev.score + scoreGained,
      coins: prev.coins + coinsGained,
    }));

    // If Castle boss cleared, play end sequence credits!
    if (activeLevelId === 'level6') {
      setTimeout(() => {
        setActiveKeys({});
        setGameMode('victory');
      }, 500);
    } else {
      setTimeout(() => {
        setActiveKeys({});
        setGameMode('map');
        audio.playMusic('map'); // restore map ambient music
      }, 500);
    }
  };

  const handleGameOver = () => {
    setGameMode('gameover');
  };

  const handleResetGame = () => {
    window.location.reload();
  };

  // --- MODERN TOUCHPAD & JOYSTICK EVENT HANDLERS ---
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
    const moveLeft = dx < -10;
    const moveRight = dx > 10;
    const jumpUp = dy < -12;
    const crouchDown = dy > 18;

    setActiveKeys((prev) => ({
      ...prev,
      ArrowLeft: moveLeft,
      ArrowRight: moveRight,
      ArrowUp: jumpUp,
      ArrowDown: crouchDown,
    }));
  };

  const handleJoystickEnd = () => {
    setJoystickKnob({ x: 0, y: 0 });
    setActiveKeys((prev) => ({
      ...prev,
      ArrowLeft: false,
      ArrowRight: false,
      ArrowUp: false,
      ArrowDown: false,
    }));
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

  // Direct Trackpad drag-handler for touch screen panel
  const handleTrackpadDrag = (clientX: number, target: HTMLDivElement) => {
    const rect = target.getBoundingClientRect();
    const relativePercent = ((clientX - rect.left) / rect.width) * 100;
    setTouchTarget({ percentX: relativePercent, percentY: 50 });

    const centerPercent = 50;
    const diff = relativePercent - centerPercent;

    if (diff < -10) {
      setActiveKeys((prev) => ({ ...prev, ArrowLeft: true, ArrowRight: false }));
    } else if (diff > 10) {
      setActiveKeys((prev) => ({ ...prev, ArrowRight: true, ArrowLeft: false }));
    } else {
      setActiveKeys((prev) => ({ ...prev, ArrowLeft: false, ArrowRight: false }));
    }
  };

  const handleTrackpadTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches && e.touches.length > 0) {
      handleTrackpadDrag(e.touches[0].clientX, e.currentTarget);
    }
  };

  const handleTrackpadTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches && e.touches.length > 0) {
      handleTrackpadDrag(e.touches[0].clientX, e.currentTarget);
    }
  };

  const handleTrackpadTouchEnd = () => {
    setTouchTarget(null);
    setActiveKeys((prev) => ({ ...prev, ArrowLeft: false, ArrowRight: false }));
  };

  const handleTrackpadMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    handleTrackpadDrag(e.clientX, e.currentTarget);
  };

  const handleTrackpadMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons === 1) {
      handleTrackpadDrag(e.clientX, e.currentTarget);
    }
  };

  const handleTrackpadMouseUp = () => {
    setTouchTarget(null);
    setActiveKeys((prev) => ({ ...prev, ArrowLeft: false, ArrowRight: false }));
  };

  const handleTouchStart = (key: string, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    
    // Trigger subtle virtual tactile vibration feedback (12ms)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(12);
      } catch (err) {
        // Safe fallback if blocked in iframe sandbox
      }
    }
    
    setActiveKeys((prev) => ({ ...prev, [key]: true }));
  };

  const handleTouchEnd = (key: string, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setActiveKeys((prev) => ({ ...prev, [key]: false }));
  };

  // Keyboard START and Arrow navigation to select 1/2 players from introduction menu
  useEffect(() => {
    if (gameMode !== 'menu') return;

    const handleMenuNav = () => {
      if (activeKeys['ArrowUp'] || activeKeys['w'] || activeKeys['ArrowLeft']) {
        setMenuCursor(0);
        audio.playCoin();
      } else if (activeKeys['ArrowDown'] || activeKeys['s'] || activeKeys['ArrowRight']) {
        setMenuCursor(1);
        audio.playCoin();
      } else if (activeKeys['start'] || activeKeys['Enter'] || activeKeys['Space'] || activeKeys[' ']) {
        setPlayPlayersMode(menuCursor === 0 ? 1 : 2);
        handleStartGame();
      }
    };

    const timeNow = Date.now();
    const lastPressTime = (window as any)._lastMenuNavTime || 0;
    const hasNavKey = activeKeys['ArrowUp'] || activeKeys['w'] || activeKeys['ArrowLeft'] ||
                      activeKeys['ArrowDown'] || activeKeys['s'] || activeKeys['ArrowRight'] ||
                      activeKeys['start'] || activeKeys['Enter'] || activeKeys['Space'] || activeKeys[' '];

    if (hasNavKey && timeNow - lastPressTime > 250) {
      (window as any)._lastMenuNavTime = timeNow;
      handleMenuNav();
    }
  }, [activeKeys, gameMode, menuCursor]);

  const activeLevelData = levels.find((l) => l.id === activeLevelId);

  return (
    <div className="min-h-screen bg-[#2D1B69] text-white flex flex-col items-center justify-center p-2 sm:p-4 select-none relative overflow-x-hidden font-sans pb-12 selection:bg-[#F8B800] selection:text-black">
      
      {/* Immersive retro arcade wallpaper background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#090915)] bg-[#101020] -z-50 pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:24px_24px] -z-40 pointer-events-none opacity-40" />

      {/* Decorative vector stars in the background for retro game ambient */}
      <div className="absolute top-12 left-10 w-28 h-12 bg-white/5 rounded-full opacity-40 blur-[2px] -z-40 pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-24 right-10 w-40 h-16 bg-white/5 rounded-full opacity-30 blur-[2px] -z-40 pointer-events-none animate-pulse"></div>

      {/* Title logo hovering above the Gameboy/SNES */}
      <div className="text-center mb-1.5 select-none flex flex-col items-center">
        <h1 className="text-xl sm:text-2xl font-black tracking-widest text-[#F8B800] drop-shadow-[0_2px_0_rgba(0,0,0,0.8)] font-sans uppercase">
          ⚔️ {consoleTheme === 'snes' ? 'SÚPER NINTENDO RETRO' : 'SIERRA PORTABLE CONSOLE'}
        </h1>
        <p className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest leading-none mt-1">
          {consoleTheme === 'snes' ? 'NÓMADA QUEST · EDICIÓN ULTRA 16-BIT' : 'NÓMADA QUEST 32 · 16-BIT COLOR DISPLAY'}
        </p>
      </div>

      {/* Interactive Hardware Style Switcher */}
      <div className="flex bg-black/50 p-1 rounded-full border border-white/10 gap-2 mb-3 select-none self-center shadow-lg">
        <button
          onClick={() => {
            setConsoleTheme('gameboy');
            audio.playCoin();
          }}
          className={`px-3.5 py-1 rounded-full text-[8.5px] font-black uppercase transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
            consoleTheme === 'gameboy'
              ? 'bg-zinc-700 text-white font-black shadow-[0_0_8px_rgba(255,255,255,0.25)]'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>👾</span> MODO GAME BOY
        </button>
        <button
          onClick={() => {
            setConsoleTheme('snes');
            audio.playPowerUp();
          }}
          className={`px-3.5 py-1 rounded-full text-[8.5px] font-black uppercase transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
            consoleTheme === 'snes'
              ? 'bg-purple-600 text-white font-black shadow-[0_0_12px_rgba(168,85,247,0.45)] border border-purple-400/30'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <span>🏰</span> MODO SNES 16-BIT
        </button>
      </div>

      {/* Immersive Studio Workspace Frame */}
      <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 w-full max-w-6xl">
        {/* Physical Handheld Housing (Game Boy or SNES 16-Bit) */}
        <div className={`w-full ${
          consoleTheme === 'snes' 
            ? 'max-w-[500px] sm:max-w-[550px] md:max-w-[600px] snes-chassis rounded-[32px] rounded-br-[70px]' 
            : 'max-w-[440px] sm:max-w-[480px] md:max-w-[500px] gameboy-chassis rounded-[28px] rounded-br-[110px]'
        } border-4 border-black/50 p-4 sm:p-5 flex flex-col gap-4 relative select-none transition-all duration-300 shadow-[2px_15px_40px_rgba(0,0,0,0.8)]`}>
        
        {/* Top Console Details (Game Boy lines or SNES Switches) */}
        {consoleTheme === 'snes' ? (
          <div className="flex justify-between items-center w-full -mt-2.5 pb-2 px-4 border-b border-black/10 select-none">
            {/* Power Slider */}
            <div className="flex items-center gap-1">
              <span className="text-[6.5px] font-mono text-zinc-500 font-extrabold uppercase">POWER</span>
              <div className="w-9 h-4 bg-zinc-800 rounded-sm p-0.5 border border-black relative cursor-pointer" onClick={() => audio.playCoin()}>
                <div className="w-4 h-full bg-zinc-400 rounded-xs shadow border border-zinc-600 absolute left-0.5 hover:bg-zinc-300" />
              </div>
            </div>
            {/* Widescreen LED badge */}
            <div className="text-[7px] font-black text-purple-900 bg-purple-950/20 border border-purple-900/30 rounded px-2 tracking-widest uppercase py-0.5">
              Super 16-Bit Display
            </div>
            {/* Reset Button */}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => {
                  audio.playShoot();
                  window.location.reload();
                }}
                className="w-7 h-4 bg-blue-700/80 hover:bg-blue-600 active:scale-90 rounded border border-black text-[6px] font-sans font-black text-white flex items-center justify-center uppercase shadow"
              >
                RESET
              </button>
            </div>
          </div>
        ) : (
          /* DMG-01 Battery / Heat slot indents on top chassis */
          <div className="flex justify-center gap-10 w-full -mt-2 opacity-30 select-none pb-1.5">
            <div className="w-20 h-1 bg-zinc-800 rounded-full" />
            <div className="w-20 h-1 bg-zinc-800 rounded-full" />
          </div>
        )}

        {/* --- SECTION 1: Dark Glass Screen Bezel --- */}
        <div className={`${
          consoleTheme === 'snes' ? 'snes-bezel' : 'gameboy-bezel'
        } rounded-lg p-3 pt-2 pb-8 border-4 border-black/85 flex flex-col gap-3 relative select-none transition-all duration-300 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]`}>
          
          {/* Bezel Double Stripe details */}
          <div className="flex justify-between items-center w-full px-2 border-b-2 border-dashed border-zinc-500/20 pb-1.5 select-none font-mono">
            {consoleTheme === 'snes' ? (
              <>
                <span className="h-[3px] w-12 sm:w-16 bg-[#10ac84] rounded-full inline-block" />
                <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-zinc-350 select-none text-center uppercase">
                  ⭐ SUPER NINTENDO 16-BIT RETRO DISPLAY ⭐
                </span>
                <span className="h-[3px] w-12 sm:w-16 bg-[#c0392b] rounded-full inline-block" />
              </>
            ) : (
              <>
                <span className="h-[3px] w-12 sm:w-16 bg-[#ae2240] rounded-full inline-block" />
                <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-[#cfcfcf] select-none text-center">
                  DOT MATRIX WITH STEREO SOUND
                </span>
                <span className="h-[3px] w-12 sm:w-16 bg-[#1d4a8e] rounded-full inline-block" />
              </>
            )}
          </div>

          {/* Glowing Red / Green Led indicator */}
          <div className="absolute left-2.5 top-[50%] -translate-y-5 flex flex-col items-center gap-0.5 z-10 select-none">
            <span className={`w-3 h-3 rounded-full ${
              consoleTheme === 'snes' 
                ? `bg-emerald-500 border border-black/60 shadow-[0_0_8px_#10ac84] ${gameMode === 'level' ? 'animate-pulse bg-emerald-400' : ''}`
                : `bg-red-600 border border-black/60 shadow-[0_0_8px_#ef4444] ${gameMode === 'level' ? 'animate-pulse bg-red-500' : ''}`
            }`} />
            <span className="text-[5.5px] font-black text-zinc-400 tracking-tighter uppercase font-mono font-bold">
              {consoleTheme === 'snes' ? 'POWER' : 'BATTERY'}
            </span>
          </div>

          {/* Actual Screen Port Viewport inside Bezel */}
          <div className="w-full bg-[#5c94fc] rounded-md border-4 border-black shadow-[inset_0_4px_10px_rgba(0,0,0,0.92)] overflow-hidden relative flex flex-col items-center justify-center aspect-[4/3]">
            
            {/* Ambient scanlines overlay to simulate Game Boy screen grids */}
            <div className="gameboy-screen-scanline absolute inset-0 z-10 pointer-events-none opacity-25" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.5))] z-20 pointer-events-none" />

            {/* Screen Area Switchboard */}
            <div className="w-full h-full relative z-5 select-all overflow-y-auto flex flex-col bg-[#5c94fc]">
              <AnimatePresence mode="wait">
                
                {/* STATE 1: Retro start introduction screen */}
                {gameMode === 'menu' && (
                  <motion.div
                    key="intro-menu"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full h-full bg-[#f8d8a0] p-4 text-center text-black flex flex-col justify-between border-8 border-black font-sans relative"
                  >
                    {/* Retro background landscape decoration outlines */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none flex justify-between items-end p-2 select-none">
                      <span className="text-4xl text-black">🌲</span>
                      <span className="text-4xl text-black">🐿️</span>
                      <span className="text-4xl text-black">🌲</span>
                    </div>

                    <div className="mb-2 flex flex-col items-center mt-2">
                      <div className="text-[9px] font-black tracking-widest text-[#d85000] mb-0.5 uppercase">
                        🌲 SIERRA DE SANTIAGO, NL 🌲
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-black uppercase leading-none border-b-4 border-black pb-1 mb-1 shadow-sm">
                        NÓMADA QUEST
                      </h1>
                      <span className="text-[10px] font-black tracking-widest text-[#5c3c10] uppercase">
                        Saga de Potrero Redondo
                      </span>
                    </div>

                    {/* Classic Mario style 1 or 2 player option menu list */}
                    <div className="flex flex-col gap-2.5 my-4 px-2 select-none">
                      {/* Option 1 */}
                      <div
                        onClick={() => {
                          setMenuCursor(0);
                          setPlayPlayersMode(1);
                          audio.playPowerUp();
                          handleStartGame();
                        }}
                        className={`py-2 px-3 border-4 border-black text-xs font-black uppercase text-left cursor-pointer flex items-center justify-between transition-all ${
                          menuCursor === 0
                            ? 'bg-black text-white translate-x-1 scale-[1.02] shadow-md'
                            : 'bg-white text-black hover:bg-zinc-100 shadow'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {menuCursor === 0 ? '🍄' : '⬜'} 1 JUGADOR
                        </span>
                        <span className="text-[8px] font-mono opacity-80">NÓMADA SOLITARIO</span>
                      </div>

                      {/* Option 2 */}
                      <div
                        onClick={() => {
                          setMenuCursor(1);
                          setPlayPlayersMode(2);
                          audio.playPowerUp();
                          handleStartGame();
                        }}
                        className={`py-2 px-3 border-4 border-black text-xs font-black uppercase text-left cursor-pointer flex items-center justify-between transition-all ${
                          menuCursor === 1
                            ? 'bg-black text-white translate-x-1 scale-[1.02] shadow-md'
                            : 'bg-white text-black hover:bg-zinc-100 shadow'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {menuCursor === 1 ? '🍄' : '⬜'} 2 JUGADORES
                        </span>
                        <span className="text-[8px] font-mono opacity-80">COOPERATIVO SANTIAGO</span>
                      </div>

                      {/* Co-op mode detailed hint */}
                      {menuCursor === 1 && (
                        <motion.div
                          initial={{ opacity: 0, y: -2 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[8px] leading-tight text-center text-[#d85000] font-bold uppercase mt-1 animate-pulse"
                        >
                          📢 COMPARTIR PANTALLA: jugador 2 usa los controles táctiles del chasis
                        </motion.div>
                      )}
                    </div>

                    {/* Highly reduced controls summary as a helper footer bar */}
                    <div className="bg-black/5 p-1.5 border-2 border-black/30 rounded text-[8px] leading-tight text-zinc-800 font-extrabold flex justify-around uppercase gap-1 select-none">
                      <span>🕹️ Flechas / D-Pad</span>
                      <span>⭐ A / Espacio: Botón A</span>
                      <span>🔥 Fuego/Hielo: Y / X</span>
                    </div>

                    <div className="text-[8px] font-black text-zinc-500 text-center uppercase mt-1">
                      Presiona START o ESPACIO para avanzar
                    </div>
                  </motion.div>
                )}

                {/* STATE 2: Level Selection Overworld Map render */}
                {gameMode === 'map' && (
                  <motion.div
                    key="map-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full h-full"
                  >
                    <OverworldMap
                      levels={levels}
                      stats={stats}
                      onSelectLevel={handleSelectLevelId}
                      activeKeys={activeKeys}
                    />
                  </motion.div>
                )}

                {/* STATE 3: Active gameplay platformer */}
                {gameMode === 'level' && activeLevelId && (
                  <motion.div
                    key="gameplay-view"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="w-full h-full flex flex-col"
                  >
                    <GameCanvas
                      levelId={activeLevelId}
                      stats={stats}
                      onUpdateStats={handleUpdateStatsByCanvas}
                      onClearLevel={handleClearActiveLevel}
                      onGameOver={handleGameOver}
                      onExit={() => {
                        setGameMode('map');
                        audio.playMusic('map');
                      }}
                      isMuted={isMuted}
                      onToggleMute={handleToggleMute}
                      activeKeys={activeKeys}
                      onPressKey={(k, isPressed) => {
                        setActiveKeys((prev) => ({ ...prev, [k]: isPressed }));
                      }}
                      consoleMode={consoleMode}
                      onToggleConsoleMode={() => setConsoleMode(prev => prev === 'retro' ? 'touch' : 'retro')}
                      consoleTheme={consoleTheme}
                    />
                  </motion.div>
                )}

                {/* STATE 4: Game Over Screen display */}
                {gameMode === 'gameover' && (
                  <motion.div
                    key="gameover-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full h-full bg-[#f8d8a0] p-6 text-center text-black flex flex-col justify-center items-center"
                  >
                    <div className="text-red-600 mb-2 animate-bounce text-4xl">💀</div>
                    <h1 className="text-2xl font-black tracking-widest text-red-600 uppercase retro-shadow">
                      GAME OVER
                    </h1>
                    <p className="text-black text-[10px] font-sans font-bold mt-2 mb-4 leading-relaxed max-w-xs mx-auto uppercase">
                      Has caído ante la Sierra. ¡Pero un verdadero guerrero vuelve a levantarse!
                    </p>

                    <button
                      id="menu-reset-game"
                      onClick={handleResetGame}
                      className="w-full py-2 px-4 bg-black text-white border-2 border-white hover:border-[#FF4444] font-black text-xs uppercase tracking-wider active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-1.5 shadow"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> REINTENTAR NIVEL
                    </button>
                  </motion.div>
                )}

                {/* STATE 5: Victory Castle Credits screen */}
                {gameMode === 'victory' && (
                  <motion.div
                    key="victory-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full h-full bg-[#f8d8a0] p-4 text-black text-center flex flex-col justify-between"
                  >
                    <div className="mt-1 flex flex-col items-center">
                      <div className="text-yellow-600 text-3xl animate-bounce">🏆</div>
                      <h1 className="text-lg sm:text-xl font-black tracking-tighter text-black uppercase pb-1 border-b-2 border-black retro-shadow mt-1">
                        ¡GRAN CAMPEÓN!
                      </h1>
                      <p className="text-[9px] text-zinc-800 tracking-wider font-extrabold mt-1 uppercase">Salvador del Reino Nómadas</p>
                    </div>

                    {/* Game final summary stat box */}
                    <div className="bg-black text-[#f8b800] border-2 border-black p-2 gap-1.5 text-left flex flex-col font-mono text-[9px]">
                      <div className="flex justify-between items-center border-b border-zinc-800 pb-1">
                        <span className="text-zinc-400 font-bold uppercase">Puntos Totales:</span>
                        <span className="text-[#f8b800] font-black">{stats.score} PTS</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="text-zinc-400 font-bold uppercase">Monedas:</span>
                        <span className="text-[#f8b800] font-black">🪙 {stats.coins}</span>
                      </div>
                    </div>

                    <div className="bg-white border-2 border-black p-2 text-[9px] text-zinc-900 text-left leading-snug font-semibold uppercase">
                      💪 Lograste dominar el Castillo de la Sierra demostrando maestría táctica completa.
                    </div>

                    <div className="mb-1">
                      <button
                        id="victory-play-again"
                        onClick={handleResetGame}
                        className="w-full py-2.5 px-4 bg-black text-white border-2 border-white hover:border-[#f8b800] font-black text-xs uppercase tracking-wider active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-1.5 shadow"
                      >
                        Reiniciar Viaje
                      </button>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Brand Label Under Screen Bezel */}
        <div className="flex justify-between items-center px-4 -mt-3.5 select-none">
          <span className="text-[#3b3d36] font-bold text-xs sm:text-sm font-sans tracking-wide">
            ⭐ NOMADA <span className="text-zinc-600 font-normal">SYSTEM</span>
          </span>
          <div className="flex items-center gap-1 bg-black/5 p-0.5 rounded px-2 border border-black/10">
            <span className="w-2 h-2 bg-[#ae2240] rounded-full animate-ping" />
            <span className="text-[7px] font-black text-zinc-600 font-sans tracking-widest uppercase font-mono">COLOR</span>
          </div>
        </div>

        {/* --- SECTION 2: Controller Front surface containing D-PAD & XY Buttons or modern touch screen --- */}
        {consoleMode === 'touch' ? (
          /* --- MODERN GLOWING TOUCHSCREEN CONSOLE AREA --- */
          <div className="flex flex-col gap-4 mt-2 px-1 select-none animate-fadeIn bg-zinc-950/70 border border-zinc-800/80 p-4 rounded-3xl shadow-[inset_0_2px_12px_rgba(0,0,0,0.8)]">
            
            {/* Direct trackpad horizontal movement controller */}
            <div className="flex flex-col items-center">
              <div 
                className="w-full h-11 bg-zinc-950 rounded-xl relative border border-cyan-500/40 flex items-center justify-center cursor-ew-resize active:bg-cyan-500/5 transition duration-150 touch-none"
                style={{ touchAction: 'none' }}
                onTouchStart={handleTrackpadTouchStart}
                onTouchMove={handleTrackpadTouchMove}
                onTouchEnd={handleTrackpadTouchEnd}
                onTouchCancel={handleTrackpadTouchEnd}
                onMouseDown={handleTrackpadMouseDown}
                onMouseMove={handleTrackpadMouseMove}
                onMouseUp={handleTrackpadMouseUp}
                onMouseLeave={handleTrackpadMouseUp}
              >
                {/* Simulated center position indicator line */}
                <div className="absolute left-1/2 w-0.5 h-6 bg-zinc-800 -translate-x-1/2 opacity-40 pointer-events-none" />
                
                {/* Finger Laser Pointer / Glow effect */}
                {touchTarget && (
                  <div 
                    className="absolute w-8 h-8 rounded-full border border-dashed border-cyan-400 flex items-center justify-center -translate-x-1/2 pointer-events-none scale-100 animate-pulse"
                    style={{ left: `${touchTarget.percentX}%` }}
                  >
                    <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full shadow-[0_0_6px_cyan]" />
                  </div>
                )}
                
                <span className="text-[9px] font-black tracking-wider text-cyan-300 pointer-events-none uppercase">
                  👈 DESLIZA TU DEDO AQUÍ PARA VOLAR / ENRUTAR 👉
                </span>
              </div>
            </div>

            {/* Joystick and Buttons Row */}
            <div className="flex justify-between items-center gap-2">
              
              {/* Virtual Glowing D-pad Joystick */}
              <div className="flex flex-col items-center gap-1 bg-zinc-900/40 p-2 rounded-2xl border border-zinc-800/40">
                <div 
                  ref={joystickBaseRef}
                  className="w-24 h-24 rounded-full bg-zinc-950 border border-zinc-700/60 shadow-lg relative flex items-center justify-center cursor-pointer touch-none"
                  style={{ touchAction: 'none' }}
                  onTouchStart={handleJoystickDragStart}
                  onTouchMove={handleJoystickDragMove}
                  onTouchEnd={handleJoystickEnd}
                  onTouchCancel={handleJoystickEnd}
                  onMouseDown={handleJoystickDragStartMouse}
                  onMouseMove={handleJoystickDragMoveMouse}
                  onMouseUp={handleJoystickEnd}
                  onMouseLeave={handleJoystickEnd}
                >
                  {/* Cardinal Directions indicators */}
                  <span className={`absolute top-1 text-[8px] font-black ${activeKeys['ArrowUp'] ? 'text-cyan-400 animate-ping' : 'text-zinc-600'}`}>▲</span>
                  <span className={`absolute bottom-1 text-[8px] font-black ${activeKeys['ArrowDown'] ? 'text-cyan-400 animate-ping' : 'text-zinc-600'}`}>▼</span>
                  <span className={`absolute left-1 text-[8px] font-black ${activeKeys['ArrowLeft'] ? 'text-cyan-400 animate-ping' : 'text-zinc-600'}`}>◀</span>
                  <span className={`absolute right-1 text-[8px] font-black ${activeKeys['ArrowRight'] ? 'text-cyan-400 animate-ping' : 'text-zinc-600'}`}>▶</span>

                  {/* Outer center ring */}
                  <div className="w-12 h-12 rounded-full border border-zinc-850 bg-transparent flex items-center justify-center pointer-events-none">
                    <div className="w-4 h-4 rounded-full border border-dashed border-zinc-700 bg-black/15" />
                  </div>

                  {/* Floating Glowing Knob */}
                  <div 
                    className="absolute w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_2px_8px_rgba(6,182,212,0.4)] border border-cyan-300 flex items-center justify-center transition-transform active:scale-95 duration-75 pointer-events-none"
                    style={{
                      transform: `translate(${joystickKnob.x}px, ${joystickKnob.y}px)`
                    }}
                  >
                    <div className="w-3 h-3 rounded-full bg-white/45 border border-white" />
                  </div>
                </div>
                <span className="text-[7px] font-black tracking-widest text-zinc-500 uppercase mt-0.5">
                  🕹️ VOLANTE
                </span>
              </div>

              {/* Glowing Neon Action Buttons Grid */}
              <div className="flex-1 flex flex-col gap-2 items-end">
                {/* Secondary skill triggers */}
                <div className="flex gap-1.5 justify-end w-full pr-1">
                  
                  {/* Fire Skill Button */}
                  <button
                    onMouseDown={(e) => handleTouchStart('c', e)}
                    onMouseUp={(e) => handleTouchEnd('c', e)}
                    onTouchStart={(e) => handleTouchStart('c', e)}
                    onTouchEnd={(e) => handleTouchEnd('c', e)}
                    onTouchCancel={(e) => handleTouchEnd('c', e)}
                    className={`w-9 h-9 rounded-full bg-rose-500/20 active:bg-rose-500/60 hover:bg-rose-500/30 text-rose-300 font-extrabold border border-rose-500/40 shadow-inner flex flex-col items-center justify-center text-[7px] transition duration-150 ${
                      activeKeys['c'] ? 'bg-rose-500/70 border-rose-400 scale-90' : ''
                    }`}
                    title="Disparar Fuego (Y)"
                  >
                    <span className="text-sm">🔥</span>
                    <span>FUEGO</span>
                  </button>

                  {/* Ice Skill Button */}
                  <button
                    onMouseDown={(e) => handleTouchStart('x', e)}
                    onMouseUp={(e) => handleTouchEnd('x', e)}
                    onTouchStart={(e) => handleTouchStart('x', e)}
                    onTouchEnd={(e) => handleTouchEnd('x', e)}
                    onTouchCancel={(e) => handleTouchEnd('x', e)}
                    className={`w-9 h-9 rounded-full bg-cyan-500/20 active:bg-cyan-500/60 hover:bg-cyan-500/30 text-cyan-300 font-extrabold border border-cyan-500/40 shadow-inner flex flex-col items-center justify-center text-[7px] transition duration-150 ${
                      activeKeys['x'] ? 'bg-cyan-500/70 border-cyan-400 scale-90' : ''
                    }`}
                    title="Disparar Hielo (X)"
                  >
                    <span className="text-sm">❄️</span>
                    <span>HIELO</span>
                  </button>

                  {/* SELECT Platform block trap button */}
                  <button
                    onMouseDown={(e) => handleTouchStart('select', e)}
                    onMouseUp={(e) => handleTouchEnd('select', e)}
                    onTouchStart={(e) => handleTouchStart('select', e)}
                    onTouchEnd={(e) => handleTouchEnd('select', e)}
                    onTouchCancel={(e) => handleTouchEnd('select', e)}
                    className={`w-9 h-9 rounded-full bg-amber-500/20 active:bg-amber-500/60 hover:bg-amber-500/30 text-amber-300 font-extrabold border border-amber-500/40 shadow-inner flex flex-col items-center justify-center text-[7px] transition duration-150 ${
                      activeKeys['select'] ? 'bg-amber-500/70 border-amber-400 scale-90' : ''
                    }`}
                    title="Colocar Apoyo (Select)"
                  >
                    <span className="text-sm">🟨</span>
                    <span>APOYO</span>
                  </button>

                </div>

                {/* Main Movement / Physics triggers */}
                <div className="flex gap-2 justify-end items-center pr-1">
                  
                  {/* Turbo Run shift button */}
                  <button
                    onMouseDown={(e) => handleTouchStart('b', e)}
                    onMouseUp={(e) => handleTouchEnd('b', e)}
                    onTouchStart={(e) => handleTouchStart('b', e)}
                    onTouchEnd={(e) => handleTouchEnd('b', e)}
                    onTouchCancel={(e) => handleTouchEnd('b', e)}
                    className={`w-11 h-11 rounded-full bg-purple-500/20 active:bg-purple-500/60 hover:bg-purple-500/30 text-purple-300 font-black border border-purple-500/40 shadow-inner flex flex-col items-center justify-center text-[7px] transition duration-150 ${
                      activeKeys['b'] ? 'bg-purple-500/70 border-purple-400 scale-90' : ''
                    }`}
                    title="Turbo Correr"
                  >
                    <span className="text-base">⚡</span>
                    <span>TURBO</span>
                  </button>

                  {/* Big Jump green button */}
                  <button
                    onMouseDown={(e) => handleTouchStart('Space', e)}
                    onMouseUp={(e) => handleTouchEnd('Space', e)}
                    onTouchStart={(e) => handleTouchStart('Space', e)}
                    onTouchEnd={(e) => handleTouchEnd('Space', e)}
                    onTouchCancel={(e) => handleTouchEnd('Space', e)}
                    className={`w-14 h-14 rounded-full bg-emerald-500/30 active:bg-emerald-500/70 hover:bg-emerald-500/40 text-emerald-300 font-black border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)] flex flex-col items-center justify-center text-[8px] transition duration-150 ${
                      activeKeys['Space'] ? 'bg-emerald-500/80 border-emerald-300 scale-90 shadow-inner' : ''
                    }`}
                    title="Saltar (Space)"
                  >
                    <span className="text-xl leading-none">▲</span>
                    <span>SALTAR</span>
                  </button>

                </div>
              </div>

            </div>

            {/* Bottom menu button for physical Start sync */}
            <div className="flex justify-around items-center w-full mt-1 border-t border-zinc-800/40 pt-2 text-[8px] font-mono text-zinc-500">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    audio.playCoin();
                    setIsMuted(audio.toggleMute());
                  }}
                  className="p-1 px-2.5 rounded border border-zinc-800 bg-zinc-900 text-zinc-400 active:bg-black uppercase text-[7px] font-bold"
                >
                  🔊 SILENCIO
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-[7px] text-cyan-400 bg-cyan-950/20 px-2.5 py-0.5 rounded border border-cyan-800/30">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <span>LCD COLOR DIGITAL DISP</span>
              </div>
            </div>

          </div>
        ) : (
          /* --- ORIGINAL RETRO GAMEBOY CONTROLLER SECTIONS (Section 2 & 3) --- */
          <>
            <div className="grid grid-cols-12 gap-1 items-center mt-1 px-1 select-none touch-none">
              
              {/* A: Black dpad on left */}
              <div className="col-span-5 flex items-center justify-center select-none py-1">
                <div className="relative w-28 h-28 flex items-center justify-center select-none scale-95 sm:scale-100">
                  
                  {/* Embossed plastic circle base backplate */}
                  <div className="absolute w-24 h-24 rounded-full bg-zinc-300/40 border-2 border-zinc-400 -z-10 shadow-[inset_0_2px_5px_rgba(0,0,0,0.1),_0_2px_0_rgba(255,255,255,0.7)]" />

                  {/* Horizontal Bar */}
                  <div className={`absolute w-24 h-8 bg-[#25282a] rounded-[4px] border-y-2 border-black/60 shadow-[0_4px_0_#111213] flex justify-between px-1.5 items-center transition-all duration-75 ${
                    activeKeys['ArrowLeft'] ? 'translate-x-[-2px] translate-y-[2px] shadow-[0_2px_0_#111213]' : 
                    activeKeys['ArrowRight'] ? 'translate-x-[2px] translate-y-[2px] shadow-[0_2px_0_#111213]' : ''
                  }`}>
                    <span className={`w-4 h-4 font-bold flex items-center justify-center text-[10px] transition-all duration-75 ${activeKeys['ArrowLeft'] ? 'text-[#F8B800] scale-90 drop-shadow-[0_0_3px_rgba(248,184,0,0.4)]' : 'text-zinc-500'}`}>◀</span>
                    <span className={`w-4 h-4 font-bold flex items-center justify-center text-[10px] transition-all duration-75 ${activeKeys['ArrowRight'] ? 'text-[#F8B800] scale-90 drop-shadow-[0_0_3px_rgba(248,184,0,0.4)]' : 'text-zinc-500'}`}>▶</span>
                  </div>
                  {/* Vertical Bar */}
                  <div className={`absolute w-8 h-24 bg-[#25282a] rounded-[4px] border-x-2 border-black/60 shadow-[0_4px_0_#111213] flex flex-col justify-between py-1.5 items-center transition-all duration-75 ${
                    activeKeys['ArrowUp'] ? 'translate-y-[-2px] shadow-[0_3px_0_#111213]' : 
                    activeKeys['ArrowDown'] ? 'translate-y-[2px] shadow-[0_2px_0_#111213]' : ''
                  }`}>
                    <span className={`w-4 h-4 font-bold flex items-center justify-center text-[10px] transition-all duration-75 ${activeKeys['ArrowUp'] ? 'text-[#F8B800] scale-90 drop-shadow-[0_0_3px_rgba(248,184,0,0.4)]' : 'text-zinc-500'}`}>▲</span>
                    <span className={`w-4 h-4 font-bold flex items-center justify-center text-[10px] transition-all duration-75 ${activeKeys['ArrowDown'] ? 'text-[#F8B800] scale-90 drop-shadow-[0_0_3px_rgba(248,184,0,0.4)]' : 'text-zinc-500'}`}>▼</span>
                  </div>
                  {/* Central Pivot point round disc */}
                  <div className="absolute w-8 h-8 bg-[#202223] rounded-full z-15 border border-black/40 shadow-inner flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-[#1b1c1d]" />
                  </div>

                  {/* Invis, wide touch triggers overlay */}
                  <button
                    id="pad-up"
                    onMouseDown={(e) => handleTouchStart('ArrowUp', e)}
                    onMouseUp={(e) => handleTouchEnd('ArrowUp', e)}
                    onMouseLeave={(e) => handleTouchEnd('ArrowUp', e)}
                    onTouchStart={(e) => handleTouchStart('ArrowUp', e)}
                    onTouchEnd={(e) => handleTouchEnd('ArrowUp', e)}
                    onTouchCancel={(e) => handleTouchEnd('ArrowUp', e)}
                    className="absolute top-0 left-10 w-8 h-10 active:opacity-20 z-25 cursor-pointer rounded touch-none"
                    title="Caminar Arriba"
                  />
                  <button
                    id="pad-down"
                    onMouseDown={(e) => handleTouchStart('ArrowDown', e)}
                    onMouseUp={(e) => handleTouchEnd('ArrowDown', e)}
                    onMouseLeave={(e) => handleTouchEnd('ArrowDown', e)}
                    onTouchStart={(e) => handleTouchStart('ArrowDown', e)}
                    onTouchEnd={(e) => handleTouchEnd('ArrowDown', e)}
                    onTouchCancel={(e) => handleTouchEnd('ArrowDown', e)}
                    className="absolute bottom-0 left-10 w-8 h-10 active:opacity-20 z-25 cursor-pointer rounded touch-none"
                    title="Agacharse"
                  />
                  <button
                    id="pad-left"
                    onMouseDown={(e) => handleTouchStart('ArrowLeft', e)}
                    onMouseUp={(e) => handleTouchEnd('ArrowLeft', e)}
                    onMouseLeave={(e) => handleTouchEnd('ArrowLeft', e)}
                    onTouchStart={(e) => handleTouchStart('ArrowLeft', e)}
                    onTouchEnd={(e) => handleTouchEnd('ArrowLeft', e)}
                    onTouchCancel={(e) => handleTouchEnd('ArrowLeft', e)}
                    className="absolute left-0 top-10 w-10 h-8 active:opacity-20 z-25 cursor-pointer rounded touch-none"
                    title="Caminar Izquierda"
                  />
                  <button
                    id="pad-right"
                    onMouseDown={(e) => handleTouchStart('ArrowRight', e)}
                    onMouseUp={(e) => handleTouchEnd('ArrowRight', e)}
                    onMouseLeave={(e) => handleTouchEnd('ArrowRight', e)}
                    onTouchStart={(e) => handleTouchStart('ArrowRight', e)}
                    onTouchEnd={(e) => handleTouchEnd('ArrowRight', e)}
                    onTouchCancel={(e) => handleTouchEnd('ArrowRight', e)}
                    className="absolute right-0 top-10 w-10 h-8 active:opacity-20 z-25 cursor-pointer rounded touch-none"
                    title="Caminar Derecha"
                  />
                </div>
              </div>

              {/* B: Center space: Grooved grip lines */}
              <div className="col-span-2 flex flex-col justify-center items-center h-full gap-2">
                <div className="w-1.5 h-12 bg-zinc-700/20 rounded-full" />
                <div className="w-1.5 h-12 bg-zinc-700/20 rounded-full" />
              </div>

              {/* C: Tactical Buttons on right A/B/X/Y */}
              <div className="col-span-5 flex items-center justify-center py-1">
                <div className="relative w-32 h-32 flex items-center justify-center p-1 bg-zinc-500/10 rounded-full border border-black/15 shadow-inner scale-95 sm:scale-100">
                  
                  {/* Diagonal Oval plate frame */}
                  {consoleTheme === 'snes' ? (
                    <div className="absolute w-[114px] h-[114px] bg-[#d1d3d8] border-2 border-[#b0b2ba] rounded-full -z-10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]" />
                  ) : (
                    <div className="absolute w-28 h-20 -rotate-[30deg] bg-zinc-300/40 border-2 border-zinc-400 rounded-full -z-10 shadow-inner" />
                  )}

                  {/* Y Button: (Disparo Fuego - C) */}
                  <div className="absolute left-[3px] top-[40px] flex flex-col items-center">
                    <button
                      id="btn-y"
                      onMouseDown={(e) => handleTouchStart('c', e)}
                      onMouseUp={(e) => handleTouchEnd('c', e)}
                      onTouchStart={(e) => handleTouchStart('c', e)}
                      onTouchEnd={(e) => handleTouchEnd('c', e)}
                      onTouchCancel={(e) => handleTouchEnd('c', e)}
                      className={`w-9 h-9 rounded-full border-2 border-black select-none text-white font-black text-xs cursor-pointer flex items-center justify-center tracking-tighter touch-none transition-all duration-75 ${
                        consoleTheme === 'snes'
                          ? (activeKeys['c'] ? 'snes-btn-yellow-active text-amber-900 border-yellow-600' : 'snes-btn-yellow text-amber-950 border-yellow-700')
                          : (activeKeys['c'] ? 'gameboy-btn-tactile-active bg-[#f85000] hover:bg-orange-500' : 'gameboy-btn-tactile bg-[#f85000] hover:bg-orange-500')
                      }`}
                      title="Fuego [Y] / Disparo C"
                    >
                      Y
                    </button>
                    <span className="text-[7px] font-black text-zinc-700 mt-1 uppercase font-bold">FUEGO</span>
                  </div>

                  {/* X Button: (Disparo Hielo - X) */}
                  <div className="absolute left-[42px] top-[6px] flex flex-col items-center">
                    <button
                      id="btn-x"
                      onMouseDown={(e) => handleTouchStart('x', e)}
                      onMouseUp={(e) => handleTouchEnd('x', e)}
                      onTouchStart={(e) => handleTouchStart('x', e)}
                      onTouchEnd={(e) => handleTouchEnd('x', e)}
                      onTouchCancel={(e) => handleTouchEnd('x', e)}
                      className={`w-9 h-9 rounded-full border-2 border-black select-none text-white font-black text-xs cursor-pointer flex items-center justify-center tracking-tighter touch-none transition-all duration-75 ${
                        consoleTheme === 'snes'
                          ? (activeKeys['x'] ? 'snes-btn-blue-active text-blue-100 border-blue-900' : 'snes-btn-blue text-white border-blue-950')
                          : (activeKeys['x'] ? 'gameboy-btn-tactile-active bg-cyan-600 hover:bg-cyan-500' : 'gameboy-btn-tactile bg-cyan-600 hover:bg-cyan-500')
                      }`}
                      title="Hielo [X] / Disparo X"
                    >
                      X
                    </button>
                    <span className="text-[7px] font-black text-zinc-700 mt-1 uppercase font-bold">HIELO</span>
                  </div>

                  {/* B Button: (Turbo / Lift - Shift/b) */}
                  <div className="absolute left-[44px] top-[74px] flex flex-col items-center">
                    <button
                      id="btn-b"
                      onMouseDown={(e) => handleTouchStart('b', e)}
                      onMouseUp={(e) => handleTouchEnd('b', e)}
                      onTouchStart={(e) => handleTouchStart('b', e)}
                      onTouchEnd={(e) => handleTouchEnd('b', e)}
                      onTouchCancel={(e) => handleTouchEnd('b', e)}
                      className={`w-9 h-9 rounded-full border-2 border-black select-none text-white font-black text-xs cursor-pointer flex items-center justify-center tracking-tighter touch-none transition-all duration-75 ${
                        consoleTheme === 'snes'
                          ? (activeKeys['b'] ? 'snes-btn-red-active text-red-100 border-red-900' : 'snes-btn-red text-white border-red-950')
                          : (activeKeys['b'] ? 'gameboy-btn-tactile-active bg-[#ae2240] hover:bg-[#8e192c]' : 'gameboy-btn-tactile bg-[#ae2240] hover:bg-[#8e192c]')
                      }`}
                      title="Turbo [B]"
                    >
                      B
                    </button>
                    <span className="text-[7px] font-black text-zinc-700 mt-1 uppercase font-bold">TURBO</span>
                  </div>

                  {/* A Button: (Saltar - Space) */}
                  <div className="absolute right-[3px] top-[40px] flex flex-col items-center">
                    <button
                      id="btn-a"
                      onMouseDown={(e) => handleTouchStart('Space', e)}
                      onMouseUp={(e) => handleTouchEnd('Space', e)}
                      onTouchStart={(e) => handleTouchStart('Space', e)}
                      onTouchEnd={(e) => handleTouchEnd('Space', e)}
                      onTouchCancel={(e) => handleTouchEnd('Space', e)}
                      className={`w-9 h-9 rounded-full border-2 border-black select-none text-white font-black text-xs cursor-pointer flex items-center justify-center tracking-tighter touch-none transition-all duration-75 ${
                        consoleTheme === 'snes'
                          ? (activeKeys['Space'] ? 'snes-btn-green-active text-emerald-100 border-emerald-900' : 'snes-btn-green text-white border-emerald-950')
                          : (activeKeys['Space'] ? 'gameboy-btn-tactile-active bg-[#ae2240] hover:bg-[#8e192c]' : 'gameboy-btn-tactile bg-[#ae2240] hover:bg-[#8e192c]')
                      }`}
                      title="Salto [A]"
                    >
                      A
                    </button>
                    <span className="text-[7px] font-black text-zinc-700 mt-1 uppercase font-bold">SALTAR</span>
                  </div>

                </div>
              </div>
            </div>

            {/* --- SECTION 3: Select and Start slanted rubber pill buttons --- */}
            <div className="flex justify-around items-start w-full px-5 mt-2 gap-4">
              
              {/* Select button */}
              <div className="flex flex-col items-center">
                <button
                  id="btn-select"
                  onMouseDown={(e) => {
                    handleTouchStart('select', e);
                    setShowSpriteLab(prev => !prev);
                    audio.playCoin();
                  }}
                  onMouseUp={(e) => handleTouchEnd('select', e)}
                  onTouchStart={(e) => {
                    handleTouchStart('select', e);
                    setShowSpriteLab(prev => !prev);
                    audio.playCoin();
                  }}
                  onTouchEnd={(e) => handleTouchEnd('select', e)}
                  onTouchCancel={(e) => handleTouchEnd('select', e)}
                  className={`w-12 h-3.5 bg-[#7a7872] hover:bg-zinc-800 border-2 border-black rounded-full transform -rotate-[26deg] shadow-md cursor-pointer transition select-none touch-none ${
                    showSpriteLab || activeKeys['select'] ? 'bg-zinc-950 scale-95 shadow-inner border-purple-400' : ''
                  }`}
                  title="Aseprite / Sprite Lab AI"
                />
                <span className={`text-[7px] font-black mt-2 tracking-widest uppercase font-mono transition-colors font-bold ${showSpriteLab ? 'text-purple-400' : 'text-zinc-650'}`}>SELECT (LAB)</span>
              </div>

              {/* Start button */}
              <div className="flex flex-col items-center">
                <button
                  id="btn-start"
                  onMouseDown={(e) => handleTouchStart('start', e)}
                  onMouseUp={(e) => handleTouchEnd('start', e)}
                  onTouchStart={(e) => handleTouchStart('start', e)}
                  onTouchEnd={(e) => handleTouchEnd('start', e)}
                  onTouchCancel={(e) => handleTouchEnd('start', e)}
                  className={`w-12 h-3.5 bg-[#7a7872] hover:bg-zinc-800 border-2 border-black rounded-full transform -rotate-[26deg] shadow-md cursor-pointer transition select-none touch-none ${
                    activeKeys['start'] ? 'bg-zinc-950 scale-95 shadow-inner' : ''
                  }`}
                />
                <span className="text-[8px] font-black text-zinc-600 mt-2 tracking-widest uppercase font-mono font-bold">START</span>
              </div>

              {/* Speaker Slits cuts */}
              <div className="flex gap-2 h-10 items-center justify-end transform -rotate-[28deg] pr-4 select-none opacity-40">
                <div className="w-1.5 h-10 bg-zinc-800 rounded-full" />
                <div className="w-1.5 h-10 bg-zinc-800 rounded-full" />
                <div className="w-1.5 h-10 bg-zinc-800 rounded-full" />
                <div className="w-1.5 h-10 bg-zinc-800 rounded-full" />
              </div>

            </div>
          </>
        )}

        </div>

        {/* Sprite Automator Laboratory */}
        <AnimatePresence>
          {showSpriteLab && (
            <motion.div
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full max-w-sm lg:max-w-xs shrink-0 z-50"
            >
              <SpriteLab onNotifyApply={() => setShowSpriteLab(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Extra keyboard support stats info block */}
      <div className="w-full max-w-sm mt-4 bg-black/60 border border-zinc-800 rounded-2xl p-4 text-center select-none text-zinc-400 text-xs">
        <span className="block font-black text-[#F8B800] uppercase mb-1">🎮 Métodos de Entrada</span>
        <span className="block leading-relaxed">Haz clic o toca los botones de la consola virtual directamente, o juega con tu teclado físico (Flechas o WASD: Mover · Barra Espaciadora: Saltar · Shift/B: Turbo · C/Y: Fuego · X/D: Hielo · Z/Select: Trampa · Enter/Escape: Start/Pausa).</span>
      </div>
    </div>
  );
}

