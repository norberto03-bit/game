import React from 'react';
import { PlayerStats, PowerUpType } from '../types';
import { Volume2, VolumeX, Map, HelpCircle } from 'lucide-react';

interface HUDProps {
  stats: PlayerStats;
  currentLevelName: string | null;
  timeRemaining?: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onExitToMap?: () => void;
  gameMode: 'map' | 'level';
}

export default function HUD({
  stats,
  currentLevelName,
  timeRemaining,
  isMuted,
  onToggleMute,
  onExitToMap,
  gameMode
}: HUDProps) {

  // Format indicators
  const formatScore = (score: number) => {
    return String(score).padStart(6, '0');
  };

  const formatCoins = (coins: number) => {
    return String(coins).padStart(2, '0');
  };

  const formatTime = (time?: number) => {
    if (time === undefined) return '---';
    return String(Math.max(0, Math.floor(time))).padStart(3, '0');
  };

  const renderActiveItemIcon = (type: PowerUpType) => {
    switch (type) {
      case 'fire':
        return (
          <div className="w-6 h-6 rounded-full bg-red-500 border border-white flex items-center justify-center animate-bounce">
            <span className="text-[10px] text-white font-bold font-mono">F</span>
          </div>
        );
      case 'ice':
        return (
          <div className="w-6 h-6 rounded-full bg-cyan-400 border border-white flex items-center justify-center animate-bounce">
            <span className="text-[10px] text-blue-900 font-bold font-mono">I</span>
          </div>
        );
      case 'turbo':
        return (
          <div className="w-6 h-6 rounded-full bg-amber-400 border border-white flex items-center justify-center animate-bounce">
            <span className="text-[10px] text-amber-950 font-bold font-mono">T</span>
          </div>
        );
      default:
        return (
          <div className="w-6 h-6 rounded-full bg-zinc-500 border border-zinc-700 flex items-center justify-center opacity-40">
            <span className="text-[10px] text-zinc-300 font-mono">-</span>
          </div>
        );
    }
  };

  return (
    <div className="w-full bg-[#5C94FC] text-white font-sans p-6 xs:px-12 border-b-8 border-black select-none z-25 relative">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        
        {/* Left Stats Section: Live, Score */}
        <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-10">
          <div className="flex flex-col items-center md:items-start">
            <span className="text-xl sm:text-2xl font-black tracking-widest uppercase text-white retro-shadow-lg">
              NOMADA
            </span>
            <span className="text-2xl sm:text-3xl font-black text-white leading-none retro-shadow-lg mt-1">
              {formatScore(stats.score)}
            </span>
          </div>
          
          <div className="flex flex-col items-center">
            <span className="text-xl sm:text-2xl font-black tracking-widest uppercase text-white retro-shadow-lg">
              MONEDAS
            </span>
            <div className="flex items-center gap-2 mt-1 leading-none">
              <div className="w-5 h-6 bg-[#F8B800] border-2 border-black rounded-sm shadow-[2px_2px_0px_#A07800] animate-pulse"></div>
              <span className="text-2xl sm:text-3xl font-black text-white retro-shadow-lg">
                x {formatCoins(stats.coins)}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-xl sm:text-2xl font-black tracking-widest uppercase text-white retro-shadow-lg">
              VIDAS
            </span>
            <div className="flex items-center gap-2 mt-1 leading-none">
              <span className="text-xl sm:text-2xl">❤️</span>
              <span className="text-2xl sm:text-3xl font-black text-white retro-shadow-lg">
                x {stats.lives}
              </span>
            </div>
          </div>
        </div>

        {/* Center Section: Super Mario World style Active Item Floating Box */}
        <div className="flex items-center gap-4 bg-snes-sand border-4 border-black p-3 shadow-lg rounded-sm text-black">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-black font-black leading-none mb-1 uppercase tracking-tight">
              ITEM
            </span>
            <div className="w-9 h-9 bg-black border-2 border-black rounded-sm flex items-center justify-center p-0.5">
              {renderActiveItemIcon(stats.activePowerUp)}
            </div>
          </div>
          
          <div className="h-10 w-[2px] bg-black" />

          <div className="flex flex-col justify-center">
            <span className="text-[10px] text-black font-black leading-none mb-1 tracking-tight">
              MISION ACTIVA
            </span>
            <span className="text-xs font-black text-red-600 uppercase tracking-tight truncate max-w-[140px]">
              {gameMode === 'map' ? 'Mapa de Viaje' : (currentLevelName || 'Nivel Activo')}
            </span>
          </div>
        </div>

        {/* Right Stats Section: Time, Exit button, Mute trigger */}
        <div className="flex items-center gap-4">
          {gameMode === 'level' && (
            <div className="flex flex-col items-center mr-2">
              <span className="text-xl sm:text-2xl font-black tracking-widest uppercase text-white retro-shadow-lg">
                TIME
              </span>
              <span className="text-2xl sm:text-3xl font-black text-[#FF4444] leading-none retro-shadow-lg mt-1">
                {formatTime(timeRemaining)}
              </span>
            </div>
          )}

          <div className="flex gap-2">
            {/* Audio Mute toggle */}
            <button
              id="hud-toggle-mute"
              onClick={onToggleMute}
              className={`p-3 rounded-sm bg-black border-2 border-white text-xs font-bold tracking-widest hover:bg-zinc-900 transition duration-200 cursor-pointer text-white shadow-md active:translate-y-0.5`}
              title={isMuted ? 'Activar Sonido' : 'Silenciar'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>

            {/* Exit to Map Trigger */}
            {gameMode === 'level' && onExitToMap && (
              <button
                id="hud-exit-map"
                onClick={onExitToMap}
                className="p-3 rounded-sm bg-black border-2 border-white text-xs font-bold tracking-widest hover:bg-zinc-900 transition duration-205 cursor-pointer text-white shadow-md active:translate-y-0.5 flex items-center gap-1.5"
                title="Volver al Mapa"
              >
                <Map className="w-4 h-4 text-white" />
                <span className="hidden sm:inline">SALIR</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
