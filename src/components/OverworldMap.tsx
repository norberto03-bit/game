import React, { useState, useEffect } from 'react';
import { LevelConfig, PlayerStats } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { audio } from '../audio';
import { Compass, Trophy, ShieldCheck, HelpCircle, Key } from 'lucide-react';

interface OverworldMapProps {
  levels: LevelConfig[];
  stats: PlayerStats;
  onSelectLevel: (levelId: string) => void;
  activeKeys?: { [key: string]: boolean };
}

export default function OverworldMap({ levels, stats, onSelectLevel, activeKeys }: OverworldMapProps) {
  // Automatically select the next unlocked but uncompleted level, or the latest unlocked level
  const [selectedLevelId, setSelectedLevelId] = useState<string>(() => {
    const uncompletedUnlocked = levels.find((l) => l.unlocked && !l.completed);
    if (uncompletedUnlocked) return uncompletedUnlocked.id;
    const lastUnlocked = [...levels].reverse().find((l) => l.unlocked);
    return lastUnlocked ? lastUnlocked.id : 'level1';
  });
  const [hoveredLevel, setHoveredLevel] = useState<LevelConfig | null>(null);

  // Auto-play map theme when loaded
  useEffect(() => {
    audio.playMusic('map');
    return () => {
      audio.stopMusic();
    };
  }, []);

  const activeLevel = levels.find((l) => l.id === selectedLevelId) || levels[0];

  // Map navigation using D-pad & standard virtual keyboard activeKeys
  useEffect(() => {
    if (!activeKeys) return;

    const handleKeyboardNav = () => {
      const currentIndex = levels.findIndex((l) => l.id === selectedLevelId);
      if (currentIndex === -1) return;

      if (activeKeys['ArrowRight'] || activeKeys['Right'] || activeKeys['d'] || activeKeys['ArrowDown'] || activeKeys['s']) {
        const nextIndex = (currentIndex + 1) % levels.length;
        setSelectedLevelId(levels[nextIndex].id);
        audio.playCoin();
      } else if (activeKeys['ArrowLeft'] || activeKeys['Left'] || activeKeys['a'] || activeKeys['ArrowUp'] || activeKeys['w']) {
        const prevIndex = (currentIndex - 1 + levels.length) % levels.length;
        setSelectedLevelId(levels[prevIndex].id);
        audio.playCoin();
      } else if (activeKeys['start'] || activeKeys['Enter'] || activeKeys[' '] || activeKeys['select'] || activeKeys['a']) {
        if (activeLevel.unlocked) {
          audio.playPowerUp();
          onSelectLevel(activeLevel.id);
        } else {
          audio.playPowerDown();
        }
      }
    };

    const timeNow = Date.now();
    const lastPressTime = (window as any)._lastMapNavTime || 0;
    const hasNavKey = activeKeys['ArrowRight'] || activeKeys['Right'] || activeKeys['d'] || 
                       activeKeys['ArrowLeft'] || activeKeys['Left'] || activeKeys['a'] || 
                       activeKeys['ArrowUp'] || activeKeys['w'] || activeKeys['ArrowDown'] || activeKeys['s'] || 
                       activeKeys['start'] || activeKeys['Enter'] || activeKeys[' '] || activeKeys['select'] || activeKeys['a'];

    if (hasNavKey && timeNow - lastPressTime > 250) {
      (window as any)._lastMapNavTime = timeNow;
      handleKeyboardNav();
    }
  }, [activeKeys, levels, selectedLevelId, onSelectLevel, activeLevel]);

  const handleNodeClick = (level: LevelConfig) => {
    if (!level.unlocked) {
      // Procedural warning beep
      audio.playPowerDown();
      return;
    }
    audio.playCoin();
    setSelectedLevelId(level.id);
  };

  const handleStartLevel = () => {
    if (activeLevel.unlocked) {
      audio.playPowerUp();
      onSelectLevel(activeLevel.id);
    }
  };

  // Background items decoration coordinates
  const trees = [
    { x: 15, y: 30, scale: 0.8 },
    { x: 18, y: 34, scale: 1.1 },
    { x: 22, y: 28, scale: 0.9 },
    { x: 45, y: 70, scale: 1.0 },
    { x: 50, y: 75, scale: 1.2 },
    { x: 55, y: 68, scale: 0.8 },
    { x: 80, y: 15, scale: 1.1 },
    { x: 85, y: 22, scale: 0.9 },
  ];

  const mountains = [
    { x: 75, y: 35, h: 40, w: 60 },
    { x: 30, y: 15, h: 25, w: 45 },
  ];

  const clouds = [
    { x: 12, y: 10, dur: 18 },
    { x: 50, y: 8, dur: 25 },
    { x: 78, y: 12, dur: 20 },
  ];

  return (
    <div className="w-full flex flex-col items-center select-none py-6 px-4">
      {/* Title Card */}
      <div className="bg-[#F8D8A0] border-8 border-black p-6 mb-8 retro-box-shadow max-w-2xl w-full text-center">
        <h1 className="text-black text-center text-3xl sm:text-4xl font-black tracking-tight uppercase border-b-4 border-black pb-3">
          🏕️ Sierra de Santiago, NL
        </h1>
        <p className="text-xs font-black text-black font-sans uppercase tracking-wider mt-3">
          Cruza carreteras con tráfico, cascadas sagradas, cañones de agua y montañas de barro.
        </p>
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Left column: SVG Overworld Map */}
        <div className="md:col-span-2 bg-[#5c94fc] border-8 border-black p-2 retro-box-shadow relative overflow-hidden aspect-[4/3] w-full">
          {/* SVG Map Canvas */}
          <svg
            id="overworld-map-svg"
            viewBox="0 0 100 75"
            className="w-full h-full rounded-2xl bg-[#5c94fc] relative"
          >
            {/* Ambient Water/Sea Details */}
            <path d="M 0,55 Q 30,45 60,65 T 100,60" fill="none" stroke="#4880e4" strokeWidth="1" strokeDasharray="3 3" />
            <path d="M 10,65 Q 40,55 70,70 T 100,68" fill="none" stroke="#4880e4" strokeWidth="1.5" />

            {/* Mountains rendering */}
            {mountains.map((m, i) => (
              <g key={`m-${i}`} className="opacity-80">
                {/* Mountain peak */}
                <polygon
                  points={`${m.x},${m.y} ${m.x - m.w/2},${m.y + m.h} ${m.x + m.w/2},${m.y + m.h}`}
                  fill="#c08240"
                  stroke="#805020"
                  strokeWidth="0.5"
                />
                {/* Snowy mountain top cap */}
                <polygon
                  points={`${m.x},${m.y} ${m.x - m.w/6},${m.y + m.h/3} ${m.x + m.w/6},${m.y + m.h/3}`}
                  fill="#ffffff"
                />
              </g>
            ))}

            {/* Island Landmass / Ground contour */}
            <path
              d="M 5,20 Q 20,5 50,15 T 95,25 Q 98,50 75,70 T 25,60 Q 3,45 5,20 Z"
              fill="#74c365"
              stroke="#5ca84d"
              strokeWidth="0.8"
            />
            {/* River layout */}
            <path
              d="M 50,15 Q 48,35 35,42 T 10,65"
              fill="none"
              stroke="#5c94fc"
              strokeWidth="3"
            />

            {/* Forest / Tree assets */}
            {trees.map((t, i) => (
              <g key={`t-${i}`} transform={`translate(${t.x}, ${t.y}) scale(${t.scale})`} className="opacity-90">
                {/* Trunk */}
                <rect x="-0.8" y="0" width="1.6" height="3" fill="#8b5a2b" />
                {/* Leaves */}
                <circle cx="0" cy="-2" r="3" fill="#2d6a4f" stroke="#1b4332" strokeWidth="0.3" />
                <circle cx="-1.5" cy="-1" r="2.2" fill="#40916c" />
                <circle cx="1.5" cy="-1.5" r="2" fill="#52b788" />
              </g>
            ))}

            {/* Decorative Clouds */}
            {clouds.map((c, i) => (
              <g key={`c-${i}`}>
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  from={`-20, ${c.y}`}
                  to={`120, ${c.y}`}
                  dur={`${c.dur}s`}
                  repeatCount="indefinite"
                />
                <circle cx="0" cy="0" r="3" fill="#ffffff" opacity="0.85" />
                <circle cx="3" cy="1" r="2" fill="#ffffff" opacity="0.85" />
                <circle cx="-3" cy="1" r="2.2" fill="#ffffff" opacity="0.85" />
              </g>
            ))}

            {/* Dynamic sequential roads connecting Sierra locations */}
            {levels.slice(0, levels.length - 1).map((lvl, index) => {
              const nextLvl = levels[index + 1];
              return (
                <line
                  key={`path-${lvl.id}`}
                  x1={lvl.x}
                  y1={lvl.y}
                  x2={nextLvl.x}
                  y2={nextLvl.y}
                  stroke="#333333"
                  strokeWidth="1.2"
                  strokeDasharray="2.5 2.5"
                />
              );
            })}

            {/* Level Nodes / Dots */}
            {levels.map((level) => {
              const isSelected = level.id === selectedLevelId;
              const isLocked = !level.unlocked;

              // Color based on level theme
              let nodeColor = '#ffcc00'; // regular level
              let strokeColor = '#996600';
              if (level.theme === 'cave') {
                nodeColor = '#ff3333';
                strokeColor = '#800000';
              } else if (level.theme === 'castle') {
                nodeColor = '#3a3a3a';
                strokeColor = '#000000';
              }

              return (
                <g
                  key={level.id}
                  onClick={() => handleNodeClick(level)}
                  onMouseEnter={() => setHoveredLevel(level)}
                  onMouseLeave={() => setHoveredLevel(null)}
                  className="cursor-pointer group select-none"
                >
                  {/* Outer Pulsing highlight if selected */}
                  {isSelected && (
                    <circle
                      cx={level.x}
                      cy={level.y}
                      r="4.5"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1"
                    >
                      <animate
                        attributeName="r"
                        values="3;5;3"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Node base body */}
                  {level.theme === 'castle' ? (
                    // Castle visual shape
                    <path
                      d={`M ${level.x - 3},${level.y + 2.5} L ${level.x - 3},${level.y - 1} L ${level.x - 2.2},${level.y - 2.5} L ${level.x - 1.2},${level.y - 1} L ${level.x},${level.y - 2.5} L ${level.x + 1.2},${level.y - 1} L ${level.x + 2.2},${level.y - 2.5} L ${level.x + 3},${level.y - 1} L ${level.x + 3},${level.y + 2.5} Z`}
                      fill={isLocked ? '#444444' : nodeColor}
                      stroke={strokeColor}
                      strokeWidth="0.8"
                    />
                  ) : (
                    // Standard circle level dot
                    <circle
                      cx={level.x}
                      cy={level.y}
                      r="2.8"
                      fill={isLocked ? '#666666' : (level.completed ? '#4ade80' : nodeColor)}
                      stroke={isLocked ? '#333333' : strokeColor}
                      strokeWidth="0.8"
                      className="transition duration-300 group-hover:scale-110"
                    />
                  )}

                  {/* Level status overlay (Complete lock icons, etc) */}
                  {isLocked && (
                    <text
                      x={level.x}
                      y={level.y + 0.8}
                      fill="#ffffff"
                      fontSize="2.5"
                      fontFamily="Arial"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      🔒
                    </text>
                  )}

                  {/* Level text bubble / labels on map */}
                  <rect
                    x={level.x - 10}
                    y={level.y - 7.5}
                    width="20"
                    height="3.8"
                    rx="1"
                    fill="rgba(0, 0, 0, 0.7)"
                    className="opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none"
                  />
                  <text
                    x={level.x}
                    y={level.y - 5}
                    fill="#ffffff"
                    fontSize="2.2"
                    fontWeight="bold"
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none"
                  >
                    {level.name}
                  </text>
                </g>
              );
            })}

            {/* Character / Nomad map marker at selected node position */}
            <g transform={`translate(${activeLevel.x}, ${activeLevel.y - 4})`}>
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`${activeLevel.x}, ${activeLevel.y - 3.5}; ${activeLevel.x}, ${activeLevel.y - 5}; ${activeLevel.x}, ${activeLevel.y - 3.5}`}
                dur="1s"
                repeatCount="indefinite"
              />
              {/* Little red/yellow Mario cap & face */}
              <circle cx="0" cy="0" r="2.2" fill="#fc341c" stroke="#330000" strokeWidth="0.4" />
              {/* Cap brim */}
              <rect x="-2.5" y="-1.5" width="4" height="0.8" fill="#fc341c" rx="0.3" />
              {/* White emblem */}
              <circle cx="-0.5" cy="-0.5" r="0.6" fill="#ffffff" />
              <text x="-0.5" y="0" fontSize="0.7" textAnchor="middle" fill="#000000" fontWeight="bold">N</text>
              {/* Shadow underneath */}
              <ellipse cx="0" cy="4.2" rx="1.5" ry="0.4" fill="#000000" opacity="0.3" />
            </g>
          </svg>

          {/* Quick HUD inside map */}
          <div className="absolute top-4 left-4 bg-black border-4 border-white px-4 py-2 shadow-md font-sans text-xs text-[#F8B800] flex gap-4 items-center">
            <div className="flex items-center gap-1">
              <span className="font-black">PUNTOS:</span>
              <span className="font-black text-white">{stats.score}</span>
            </div>
            <div className="h-4 w-[2px] bg-white/40" />
            <div className="flex items-center gap-1">
              <span className="font-black">MONEDAS:</span>
              <span className="font-black text-white">x {stats.coins}</span>
            </div>
          </div>
        </div>

        {/* Right column: Level detail and Play action card */}
        <div className="bg-[#F8D8A0] border-8 border-black p-6 retro-box-shadow text-black font-sans flex flex-col justify-between h-full min-h-[300px]">
          <div>
            <div className="flex items-center gap-3 mb-4 uppercase border-b-4 border-black pb-2">
              <Compass className="w-6 h-6 text-black" />
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-800 tracking-wider font-extrabold">NIVEL SELECCIONADO</span>
                <span className="text-xl font-black text-black uppercase tracking-tight truncate leading-none">
                  {activeLevel.name}
                </span>
              </div>
            </div>

            {/* Level statistics list */}
            <div className="bg-black text-[#F8B800] border-4 border-black p-4 gap-3 flex flex-col mb-4 font-mono">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400 font-bold">Lugar Sierra:</span>
                <span className="text-white font-black uppercase text-right">
                  {activeLevel.theme === 'green' ? '🚗 Tráfico de Santiago' : 
                   activeLevel.theme === 'cave' ? '🌊 Cascada Cola de Caballo' : 
                   activeLevel.theme === 'sierra' ? '⛰️ Cañón Las Adjuntas' :
                   activeLevel.theme === 'desert' ? '🧱 Barro de Potrero Redondo' :
                   activeLevel.theme === 'neon' ? '💠 Pozas de Chipitín' :
                   '⛺ Campamento Nómadas'}
                </span>
              </div>

              <div className="flex justify-between text-xs items-center">
                <span className="text-zinc-400 font-bold">Record Puntos:</span>
                <span className="text-[#F8B800] font-black flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-[#F8B800]" />
                  {activeLevel.highScore} pts
                </span>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-zinc-400 font-bold">Tiempo max:</span>
                <span className="text-red-400 font-black uppercase">{activeLevel.timeLimit} segundos</span>
              </div>

              <div className="flex justify-between text-xs items-center">
                <span className="text-zinc-400 font-bold">Estado:</span>
                {activeLevel.completed ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1 text-[10px] bg-emerald-950 px-2 py-0.5 border-2 border-emerald-400">
                    <ShieldCheck className="w-3 h-3" /> COMPLETADO
                  </span>
                ) : activeLevel.unlocked ? (
                  <span className="text-blue-400 font-bold text-[10px] bg-blue-950 px-2 py-0.5 border-2 border-blue-400">
                    🔓 DISPONIBLE
                  </span>
                ) : (
                  <span className="text-zinc-500 font-bold text-[10px] bg-zinc-900 px-2 py-0.5 border-2 border-zinc-700 flex items-center gap-1">
                    <Key className="w-3 h-3" /> BLOQUEADO
                  </span>
                )}
              </div>
            </div>

            {/* Level requirements / tutorial tips */}
            <div className="bg-white border-4 border-black p-3 text-[11px] text-black font-semibold flex gap-1">
              <HelpCircle className="w-5 h-5 text-black flex-shrink-0" />
              <span>
                {activeLevel.theme === 'green' && '¡Bienvenido a Santiago, NL! Domina el estrés del tráfico y salta sobre carritos estresados.'}
                {activeLevel.theme === 'cave' && '¡Cola de Caballo! No hay túneles, solo troncos mágicos y magueyes silvestres de espinas.'}
                {activeLevel.theme === 'sierra' && '¡Cañón Las Adjuntas! Sortea los abismos de la sierra y aplasta con tu poderosa pick-up 4x4.'}
                {activeLevel.theme === 'desert' && '¡Potrero Redondo! Rompe y sube las resbaladizas montañas de barro para continuar el viaje.'}
                {activeLevel.theme === 'neon' && '¡Pozas turquesas de Chipitín! Iluminación retro sublime de 32-bits para un salto épico.'}
                {activeLevel.theme === 'castle' && '¡La Cima del Campamento Nómadas! Derrota al feroz "Oso Grizzly de la Sierra" para consagrarte.'}
              </span>
            </div>
          </div>

          <div className="mt-8">
            <button
              id={`start-level-${activeLevel.id}`}
              onClick={handleStartLevel}
              disabled={!activeLevel.unlocked}
              className={`w-full py-4 px-6 font-black tracking-widest text-center text-sm uppercase transition duration-150 border-4 shadow-md active:translate-y-1 cursor-pointer ${
                activeLevel.unlocked
                  ? 'bg-black text-white border-white hover:border-[#F8B800]'
                  : 'bg-zinc-700 text-zinc-500 border-black cursor-not-allowed opacity-50'
              }`}
            >
              {activeLevel.completed ? 'JUGAR DE NUEVO [START]' : 'JUGAR NIVEL [START]'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
