import React from 'react';

interface VirtualPadProps {
  onPress: (key: string, isPressed: boolean) => void;
  activeKeys: { [key: string]: boolean };
}

export default function VirtualPad({ onPress, activeKeys }: VirtualPadProps) {
  // We can render a beautifully designed SNES controller block at the bottom
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
    
    onPress(key, true);
  };

  const handleTouchEnd = (key: string, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    onPress(key, false);
  };

  return (
    <div className="w-full max-w-xl mx-auto mt-6 px-4 pb-4 select-none touch-none scale-90 sm:scale-100">
      <div className="bg-[#F8D8A0] border-8 border-black p-4 retro-box-shadow flex flex-col items-center gap-4 relative">
        {/* Retro Sand/Wood Oval Background decoration */}
        <div className="absolute inset-x-8 top-4 bottom-4 bg-[#ffecb3] border-4 border-black/10 rounded-none pointer-events-none -z-10" />

        {/* Brand Text */}
        <div className="flex justify-between w-full px-6 items-center">
          <div className="text-[11px] font-black tracking-widest text-black font-sans uppercase">
            👉 CONTROL VIRTUAL
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-[#FF4444] border-2 border-black rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-black font-sans uppercase">ON</span>
          </div>
        </div>

        {/* Main Controls Section */}
        <div className="flex justify-between w-full items-center px-2">
          {/* Left Side: Retro D-PAD */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            {/* Horizontal Bar */}
            <div className="absolute w-24 h-8 bg-black rounded-none border-4 border-white shadow-md flex justify-between px-1 items-center">
              <div className="w-6 h-6 text-white font-black flex items-center justify-center text-xs">◀</div>
              <div className="w-6 h-6 text-white font-black flex items-center justify-center text-xs">▶</div>
            </div>
            {/* Vertical Bar */}
            <div className="absolute w-8 h-24 bg-black rounded-none border-4 border-white shadow-md flex flex-col justify-between py-1 items-center">
              <div className="w-6 h-6 text-white font-black flex items-center justify-center text-xs">▲</div>
              <div className="w-6 h-6 text-white font-black flex items-center justify-center text-xs">▼</div>
            </div>
            {/* Central Pivot */}
            <div className="absolute w-8 h-8 bg-zinc-900 rounded-none z-10 border-4 border-white" />

            {/* Hidden, wide Touch Targets over the D-PAD legs */}
            <button
              id="pad-up"
              onMouseDown={(e) => handleTouchStart('ArrowUp', e)}
              onMouseUp={(e) => handleTouchEnd('ArrowUp', e)}
              onMouseLeave={(e) => handleTouchEnd('ArrowUp', e)}
              onTouchStart={(e) => handleTouchStart('ArrowUp', e)}
              onTouchEnd={(e) => handleTouchEnd('ArrowUp', e)}
              className="absolute top-0 left-10 w-8 h-10 active:opacity-25 z-25 cursor-pointer rounded"
              title="Caminar Arriba"
            />
            <button
              id="pad-down"
              onMouseDown={(e) => handleTouchStart('ArrowDown', e)}
              onMouseUp={(e) => handleTouchEnd('ArrowDown', e)}
              onMouseLeave={(e) => handleTouchEnd('ArrowDown', e)}
              onTouchStart={(e) => handleTouchStart('ArrowDown', e)}
              onTouchEnd={(e) => handleTouchEnd('ArrowDown', e)}
              className="absolute bottom-0 left-10 w-8 h-10 active:opacity-25 z-25 cursor-pointer rounded"
              title="Agacharse"
            />
            <button
              id="pad-left"
              onMouseDown={(e) => handleTouchStart('ArrowLeft', e)}
              onMouseUp={(e) => handleTouchEnd('ArrowLeft', e)}
              onMouseLeave={(e) => handleTouchEnd('ArrowLeft', e)}
              onTouchStart={(e) => handleTouchStart('ArrowLeft', e)}
              onTouchEnd={(e) => handleTouchEnd('ArrowLeft', e)}
              className="absolute left-0 top-10 w-10 h-8 active:opacity-25 z-25 cursor-pointer rounded"
              title="Mover Izquierda"
            />
            <button
              id="pad-right"
              onMouseDown={(e) => handleTouchStart('ArrowRight', e)}
              onMouseUp={(e) => handleTouchEnd('ArrowRight', e)}
              onMouseLeave={(e) => handleTouchEnd('ArrowRight', e)}
              onTouchStart={(e) => handleTouchStart('ArrowRight', e)}
              onTouchEnd={(e) => handleTouchEnd('ArrowRight', e)}
              className="absolute right-0 top-10 w-10 h-8 active:opacity-25 z-25 cursor-pointer rounded"
              title="Mover Derecha"
            />
          </div>

          {/* Center: SELECT and START buttons */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-4">
              {/* SELECT Button */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-black mb-1">SELECT</span>
                <button
                  id="btn-select"
                  onMouseDown={(e) => handleTouchStart('select', e)}
                  onMouseUp={(e) => handleTouchEnd('select', e)}
                  onTouchStart={(e) => handleTouchStart('select', e)}
                  onTouchEnd={(e) => handleTouchEnd('select', e)}
                  className={`w-10 h-4 bg-black rounded-none border-2 border-white shadow-md active:translate-y-0.5 cursor-pointer ${
                    activeKeys['select'] ? 'bg-zinc-800' : ''
                  }`}
                  title="Colocar Trampa / Plataforma"
                />
                <span className="text-[7px] font-black text-black mt-1">[TRAMPA]</span>
              </div>

              {/* START Button */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black text-black mb-1">START</span>
                <button
                  id="btn-start"
                  onMouseDown={(e) => handleTouchStart('start', e)}
                  onMouseUp={(e) => handleTouchEnd('start', e)}
                  onTouchStart={(e) => handleTouchStart('start', e)}
                  onTouchEnd={(e) => handleTouchEnd('start', e)}
                  className={`w-10 h-4 bg-black rounded-none border-2 border-white shadow-md active:translate-y-0.5 cursor-pointer ${
                    activeKeys['start'] ? 'bg-zinc-800' : ''
                  }`}
                  title="Pausar Juego"
                />
                <span className="text-[7px] font-black text-black mt-1">[PAUSA]</span>
              </div>
            </div>
          </div>

          {/* Right Side: SNES Colorful Diamond Buttons */}
          <div className="relative w-32 h-32 flex items-center justify-center bg-black/5 rounded-none border-4 border-black">
            {/* Top Button: X (GREEN / ICE) */}
            <div className="absolute top-2 flex flex-col items-center">
              <span className="text-[9px] font-black text-black">X</span>
              <button
                id="btn-x"
                onMouseDown={(e) => handleTouchStart('d', e)}
                onMouseUp={(e) => handleTouchEnd('d', e)}
                onTouchStart={(e) => handleTouchStart('d', e)}
                onTouchEnd={(e) => handleTouchEnd('d', e)}
                className={`w-9 h-9 rounded-none bg-emerald-500 border-4 border-black active:bg-emerald-400 shadow-md flex items-center justify-center text-white font-black text-xs cursor-pointer ${
                  activeKeys['d'] ? 'scale-90 bg-emerald-400' : ''
                }`}
                title="Disparo de Hielo (D)"
              >
                H
              </button>
            </div>

            {/* Left Button: Y (GREEN/BLUE / FIRE) */}
            <div className="absolute left-1 flex items-center gap-1">
              <span className="text-[9px] font-black text-black">Y</span>
              <button
                id="btn-y"
                onMouseDown={(e) => handleTouchStart('c', e)}
                onMouseUp={(e) => handleTouchEnd('c', e)}
                onTouchStart={(e) => handleTouchStart('c', e)}
                onTouchEnd={(e) => handleTouchEnd('c', e)}
                className={`w-9 h-9 rounded-none bg-red-500 border-4 border-black active:bg-red-400 shadow-md flex items-center justify-center text-white font-black text-xs cursor-pointer ${
                  activeKeys['c'] ? 'scale-90 bg-red-400' : ''
                }`}
                title="Disparo de Fuego (C)"
              >
                F
              </button>
            </div>

            {/* Right Button: A (RED/BLUE-PURPLE / JUMP) */}
            <div className="absolute right-1 flex items-center gap-1">
              <button
                id="btn-a"
                onMouseDown={(e) => handleTouchStart('a', e)}
                onMouseUp={(e) => handleTouchEnd('a', e)}
                onTouchStart={(e) => handleTouchStart('a', e)}
                onTouchEnd={(e) => handleTouchEnd('a', e)}
                className={`w-9 h-9 rounded-none bg-purple-500 border-4 border-black active:bg-purple-400 shadow-md flex items-center justify-center text-white font-black text-xs cursor-pointer ${
                  activeKeys['a'] ? 'scale-90 bg-purple-400' : ''
                }`}
                title="Saltar (A / Barra Espaciadora)"
              >
                S
              </button>
              <span className="text-[9px] font-black text-black">A</span>
            </div>

            {/* Bottom Button: B (YELLOW / JET-RUN / LIFT) */}
            <div className="absolute bottom-2 flex flex-col flex-col-reverse items-center">
              <span className="text-[9px] font-black text-black">B</span>
              <button
                id="btn-b"
                onMouseDown={(e) => handleTouchStart('b', e)}
                onMouseUp={(e) => handleTouchEnd('b', e)}
                onTouchStart={(e) => handleTouchStart('b', e)}
                onTouchEnd={(e) => handleTouchEnd('b', e)}
                className={`w-9 h-9 rounded-none bg-amber-500 border-4 border-black active:bg-amber-400 shadow-md flex items-center justify-center text-white font-black text-xs cursor-pointer ${
                  activeKeys['b'] ? 'scale-90 bg-amber-400' : ''
                }`}
                title="Turbo / Turbo correr o levantar cosas (B / Shift)"
              >
                T
              </button>
            </div>
          </div>
        </div>

        {/* Keyboard hints */}
        <div className="text-[9px] font-sans font-black text-black text-center mt-1 border-t-2 border-black pt-2 w-full flex flex-wrap justify-around gap-1 uppercase">
          <span>◀ ▶ / WASD: MOVER</span>
          <span>S / ESPACIO: SALTAR</span>
          <span>SHIFT: TURBO</span>
          <span>C: FUEGO (Y)</span>
          <span>D: HIELO (X)</span>
          <span>ALT / SELECT: TRAMPA</span>
        </div>
      </div>
    </div>
  );
}
