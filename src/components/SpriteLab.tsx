import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { audio } from '../audio';

// Palette Definitions
export interface Palette {
  id: string;
  name: string;
  colors: string[];
}

export const PALETTES: Palette[] = [
  {
    id: 'snes_famicom_16bit',
    name: '🏰 SNES Famicom 16-Bit',
    colors: [
      'transparent', // 0
      '#111111',     // 1: Black Outline
      '#ffffff',     // 2: Soft White
      '#e74c3c',     // 3: Mario Red
      '#ffd2a5',     // 4: Peach / Skin blush
      '#f39c12',     // 5: Yoshi Orange
      '#f1c40f',     // 6: Cap Yellow / Coins
      '#2ecc71',     // 7: Cape / Plant Green
      '#3498db',     // 8: Overall Blue
      '#9b59b6',     // 9: Magic Violet / Crystals
      '#795548',     // 10: Wood Bark Brown
      '#c1a179',     // 11: Sand Dune
      '#9e9e9e',     // 12: Steel Sword Guard
      '#00d2d3',     // 13: Magic Ice
      '#5f27cd',     // 14: Dark Space Orchid
      '#2c3e50',     // 15: Deep Iron
    ],
  },
  {
    id: 'santiago_forest',
    name: '🌲 Bosque Santiago',
    colors: [
      'transparent', // 0
      '#2d6a4f',     // 1: Forest Green
      '#40916c',     // 2: Moss Green
      '#b1f25d',     // 3: Bright Pine Needle
      '#5c3a21',     // 4: Pinecone Brown
      '#8b5a2b',     // 5: Light Bark
      '#cd853f',     // 6: Suede Leather
      '#e67e22',     // 7: Coyote Orange
      '#f1c40f',     // 8: Golden Sun
      '#ff7675',     // 9: Wild Berry Red
      '#ffffff',     // 10: White Cloud
      '#111111',     // 11: Deep Obsidian / Outlines
      '#74b9ff',     // 12: Rio Water
      '#00fbff',     // 13: Neon Quartz
      '#34495e',     // 14: Dark Slate
      '#d35400',     // 15: Ember Orange
    ],
  },
  {
    id: 'sierra_sunset',
    name: '🌅 Sierra Sunset',
    colors: [
      'transparent',
      '#c0392b', // Crimson
      '#e74c3c', // Scarlet
      '#e67e22', // Golden Orange
      '#f39c12', // Sunny yellow
      '#2c3e50', // Night slate
      '#1bbc9b', // Teal river
      '#9b59b6', // Sierra Violet
      '#ffffff', // Snow Peak
      '#34495e', // Rock Gray
      '#5c3a21', // Dark Bark
      '#111111', // Obsidian
      '#2ecc71', // Bright Green
      '#f1c40f', // Bright Gold
      '#00fbff', // Glowing Ice
      '#e15f41', // Coral Dust
    ],
  },
  {
    id: 'aseprite_classic',
    name: '🎨 Aseprite Retró',
    colors: [
      'transparent',
      '#000000', '#ffffff', '#808080', '#c0c0c0',
      '#800000', '#ff0000', '#808000', '#ffff00',
      '#008000', '#00ff00', '#008080', '#00ffff',
      '#000080', '#0000ff', '#800080', '#ff00ff',
    ],
  },
  {
    id: 'gbc_nostalgia',
    name: '⚡ GameBoy Color',
    colors: [
      'transparent',
      '#0f380f', // deepest green
      '#306230', // dark pine green
      '#8bac0f', // classic green tea
      '#9bbc0f', // bright lime
      '#ffffff', // high-contrast white
      '#000000', // flat black
      '#e0f8cf', // retro screen gray-green
      '#86c06c', // gameboy grass
      '#d35400', '#f1c40f', '#2980b9', '#9b59b6',
      '#c0392b', '#27ae60', '#f39c12', '#7f8c8d'
    ],
  }
];

export interface SpriteTemplate {
  id: string;
  name: string;
  category: 'player' | 'enemy_champi' | 'enemy_tortu' | 'enemy_volador' | 'block_pine';
  matrix: number[][]; // 16x16 pixel index lookup
}

// Generate an empty grid of specified size
const createEmptyMatrix = (size: number): number[][] => {
  const m: number[][] = [];
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) {
      row.push(0);
    }
    m.push(row);
  }
  return m;
};

// Box-upscale matrix to handle dynamic high resolution editors cleanly
const resizeMatrix = (matrix: number[][], newSize: number): number[][] => {
  const oldSize = matrix.length;
  const next: number[][] = [];
  for (let r = 0; r < newSize; r++) {
    const row: number[] = [];
    for (let c = 0; c < newSize; c++) {
      const sourceR = Math.min(oldSize - 1, Math.floor((r / newSize) * oldSize));
      const sourceC = Math.min(oldSize - 1, Math.floor((c / newSize) * oldSize));
      row.push(matrix[sourceR][sourceC]);
    }
    next.push(row);
  }
  return next;
};

// Helper to load or create matrices
export const DEFAULT_SPRITES: { [key: string]: number[][] } = {
  player: [
    [0,0,0,0,0,11,11,11,11,11,0,0,0,0,0,0],
    [0,0,0,0,11,6,6,6,6,6,11,0,0,0,0,0],
    [0,0,0,11,6,6,13,6,6,13,6,11,10,10,0,0],
    [0,0,0,11,6,6,11,6,6,11,6,11,11,10,0,0],
    [0,0,0,11,6,6,6,6,6,6,6,11,10,10,0,0],
    [0,0,11,11,11,11,11,11,11,11,11,11,11,0,0,0],
    [0,11,1,1,1,1,1,1,1,1,1,1,1,1,11,0],
    [11,1,9,2,2,11,11,1,1,11,11,2,2,9,1,11],
    [11,1,2,10,10,2,2,1,1,2,2,10,10,2,1,11],
    [11,1,2,2,2,2,2,1,1,2,2,2,2,2,1,11],
    [0,11,1,1,1,1,1,1,1,1,1,1,1,1,11,0],
    [0,0,11,1,1,1,1,1,1,1,1,1,1,11,0,0],
    [0,0,0,11,11,1,1,1,1,1,1,11,11,0,0,0],
    [0,0,0,0,11,11,11,11,11,11,11,11,0,0,0,0],
    [0,0,0,11,6,6,11,0,0,11,6,6,11,0,0,0],
    [0,0,0,11,11,11,0,0,0,11,11,11,0,0,0,0],
  ],
  enemy_champi: [ // Squirrel (Ardilla)
    [0,0,0,0,0,0,11,11,0,0,11,11,0,0,0,0],
    [0,0,0,0,0,11,7,7,11,11,7,7,11,0,0,0],
    [0,0,0,0,11,7,7,7,7,7,7,7,7,11,0,0],
    [0,0,0,0,11,7,11,7,7,7,7,11,7,11,0,0],
    [0,0,0,0,11,7,11,7,7,7,7,11,7,11,0,0],
    [0,0,0,0,11,7,7,9,7,7,9,7,7,11,11,0],
    [0,0,11,11,11,7,7,7,10,10,7,7,7,11,7,11],
    [0,11,7,7,11,10,10,10,10,10,10,10,11,7,7,11],
    [11,7,7,7,11,10,10,10,10,10,10,10,11,7,7,11],
    [11,7,7,7,11,10,10,10,10,10,10,10,11,7,11,0],
    [0,11,7,7,7,11,10,10,10,10,10,11,7,7,11,0],
    [0,0,11,11,7,7,11,11,11,11,11,7,7,11,0,0],
    [0,0,0,11,7,7,7,7,7,7,7,7,11,0,0,0],
    [0,0,11,7,7,11,11,11,11,11,11,7,7,11,0,0],
    [0,0,11,6,6,11,0,0,0,0,11,6,6,11,0,0],
    [0,0,0,11,11,0,0,0,0,0,0,11,11,0,0,0],
  ],
  enemy_tortu: [ // Pinecone Spiker (Piña Puercoespín)
    [0,0,0,0,0,0,0,11,11,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,11,3,3,11,0,0,0,0,0,0],
    [0,0,0,0,0,11,3,2,2,3,11,0,0,0,0,0],
    [0,0,0,0,11,3,2,1,1,2,3,11,0,0,0,0],
    [0,0,11,11,11,1,1,1,1,1,1,11,11,11,0,0],
    [0,11,4,4,11,1,5,1,1,5,1,11,4,4,11,0],
    [11,4,5,5,4,11,1,1,1,1,11,4,5,5,4,11],
    [11,4,5,5,4,11,11,11,11,11,11,4,5,5,4,11],
    [11,4,5,5,5,4,4,4,4,4,4,5,5,5,4,11],
    [11,4,5,5,5,5,5,5,5,5,5,5,5,5,4,11],
    [0,11,4,4,5,5,5,5,5,5,5,4,4,4,11,0],
    [0,0,11,4,4,4,4,4,4,4,4,4,11,11,0,0],
    [0,0,0,11,11,11,11,11,11,11,11,11,0,0,0,0],
    [0,0,0,11,8,8,11,0,0,11,8,8,11,0,0,0],
    [0,0,0,11,6,6,11,0,0,11,6,6,11,0,0,0],
    [0,0,0,0,11,11,0,0,0,0,11,11,0,0,0,0],
  ],
  enemy_volador: [ // Woodpecker (Pájaro Carpintero)
    [0,0,0,0,0,0,0,11,11,11,0,0,0,0,0,0],
    [0,0,0,0,0,0,11,9,9,9,11,0,0,0,0,0],
    [0,0,0,0,0,11,9,9,9,9,9,11,0,0,0,0],
    [0,0,0,0,11,9,9,11,10,9,9,11,0,0,0,0],
    [0,0,0,0,11,9,9,10,11,9,9,11,8,8,8,0],
    [0,0,0,11,11,11,9,9,9,9,11,11,8,8,11,0],
    [0,0,11,10,10,10,11,11,11,11,11,11,11,11,0,0],
    [0,11,10,10,10,10,10,11,14,14,14,14,11,0,0,0],
    [11,10,10,10,10,10,10,11,14,14,14,14,11,0,0,0],
    [11,10,10,10,10,10,11,14,14,14,14,14,11,0,0,0],
    [0,11,11,11,11,11,11,14,14,14,14,11,0,0,0,0],
    [0,0,0,0,11,14,14,14,14,14,11,0,0,0,0,0],
    [0,0,0,0,11,14,14,14,14,11,0,0,0,0,0,0],
    [0,0,0,0,0,11,11,11,11,11,0,0,0,0,0,0],
    [0,0,0,0,0,0,11,8,8,11,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,11,11,0,0,0,0,0,0,0],
  ],
  block_pine: [ // Crate/Pine Bark Block
    [11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11],
    [11,5,5,5,5,5,5,5,5,5,5,5,5,5,5,11],
    [11,5,4,4,4,4,4,4,4,4,4,4,4,4,5,11],
    [11,5,4,11,11,11,11,11,11,11,11,4,4,4,5,11],
    [11,5,4,11,5,5,5,5,5,5,11,4,4,4,5,11],
    [11,5,4,11,5,4,4,4,4,5,11,4,4,4,5,11],
    [11,5,4,11,5,4,11,11,4,5,11,4,4,4,5,11],
    [11,5,4,11,5,4,11,11,4,5,11,4,4,4,5,11],
    [11,5,4,11,5,4,4,4,4,5,11,4,4,4,5,11],
    [11,5,4,11,5,5,5,5,5,5,11,4,4,4,5,11],
    [11,5,4,11,11,11,11,11,11,11,11,4,4,4,5,11],
    [11,5,4,4,4,4,4,4,4,4,4,4,4,4,5,11],
    [11,5,4,4,4,4,4,4,4,4,4,4,4,4,5,11],
    [11,5,4,4,4,4,4,4,4,4,4,4,4,4,5,11],
    [11,5,5,5,5,5,5,5,5,5,5,5,5,5,5,11],
    [11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11],
  ]
};

// Expose defaults to global scope immediately on load so game has them
if (typeof window !== 'undefined') {
  const initCustom = () => {
    if (!(window as any)._customSprites) {
      let savedStr = null;
      try {
        savedStr = localStorage.getItem('nomada_quest_custom_sprites');
      } catch (e) {
        console.error("Local storage error on load:", e);
      }

      if (savedStr) {
        try {
          (window as any)._customSprites = JSON.parse(savedStr);
        } catch (e) {
          console.error("Failed parsing saved sprites:", e);
        }
      }

      const createEmptyGrid = (size: number): number[][] => {
        const m: number[][] = [];
        for (let r = 0; r < size; r++) {
          m.push(Array(size).fill(0));
        }
        return m;
      };

      if (!(window as any)._customSprites) {
        (window as any)._customSprites = {
          player: JSON.parse(JSON.stringify(DEFAULT_SPRITES.player)),
          enemy_champi: JSON.parse(JSON.stringify(DEFAULT_SPRITES.enemy_champi)),
          enemy_tortu: JSON.parse(JSON.stringify(DEFAULT_SPRITES.enemy_tortu)),
          enemy_volador: JSON.parse(JSON.stringify(DEFAULT_SPRITES.enemy_volador)),
          block_pine: JSON.parse(JSON.stringify(DEFAULT_SPRITES.block_pine)),
          palette: [...PALETTES[0].colors],
          activePaletteId: PALETTES[0].id,
          enabled: true,
          spriteScale: 2.5, // Default to meeting the user's favorite 2.5x scale precisely!
          skeletons: {},
        };
      }

      // Guarantee multiple sub-poses are fully instantiated in memory
      const activeKeys = [
        'player_idle', 'player_walk', 'player_jump', 'player_duck',
        'horse_idle', 'horse_walk', 'horse_jump'
      ];
      const basePlayer = JSON.parse(JSON.stringify(DEFAULT_SPRITES.player));

      activeKeys.forEach(k => {
        if (!(window as any)._customSprites[k]) {
          if (k.startsWith('horse')) {
            // Generate elegant default representation for horse
            const horseMatrix = createEmptyGrid(16);
            for (let r = 5; r <= 11; r++) {
              for (let c = 2; c <= 13; c++) {
                horseMatrix[r][c] = 9; // sienna color
              }
            }
            for (let r = 2; r <= 5; r++) {
              for (let c = 9; c <= 12; c++) {
                horseMatrix[r][c] = 9; // neck
              }
            }
            // white dappled highlight markings
            horseMatrix[6][4] = 5;
            horseMatrix[8][8] = 5;
            // tail & hooves
            for (let r = 8; r <= 13; r++) {
              horseMatrix[r][1] = 5; // tail
              horseMatrix[r][3] = 6;
              horseMatrix[r][6] = 6;
              horseMatrix[r][10] = 6;
              horseMatrix[r][12] = 6;
            }
            (window as any)._customSprites[k] = horseMatrix;
          } else {
            (window as any)._customSprites[k] = JSON.parse(JSON.stringify(basePlayer));
          }
        }
      });

      // Guarantee skeleton maps are ready with robust defaults
      if (!(window as any)._customSprites.skeletons) {
        (window as any)._customSprites.skeletons = {};
      }
      activeKeys.forEach(k => {
        if (!(window as any)._customSprites.skeletons[k]) {
          if (k.includes('duck')) {
            (window as any)._customSprites.skeletons[k] = { xOff: 0.1, yOff: 0.4, width: 0.8, height: 0.6, boneY1: 0.5, boneY2: 0.8 };
          } else if (k.startsWith('horse')) {
            (window as any)._customSprites.skeletons[k] = { xOff: 0.05, yOff: 0.1, width: 0.9, height: 0.9, boneY1: 0.3, boneY2: 0.7 };
          } else {
            (window as any)._customSprites.skeletons[k] = { xOff: 0.15, yOff: 0.05, width: 0.7, height: 0.95, boneY1: 0.4, boneY2: 0.7 };
          }
        }
      });
    }
  };
  initCustom();
}

interface SpriteLabProps {
  onNotifyApply?: () => void;
}

export default function SpriteLab({ onNotifyApply }: SpriteLabProps) {
  const [activeCategory, setActiveCategory] = useState<'player' | 'horse' | 'enemy_champi' | 'enemy_tortu' | 'enemy_volador' | 'block_pine'>('player');
  const [activeFrame, setActiveFrame] = useState<'idle' | 'walk' | 'jump' | 'duck'>('idle');

  // Skeleton & Hitbox alignment parameters state
  const [skWidth, setSkWidth] = useState<number>(0.7);
  const [skHeight, setSkHeight] = useState<number>(0.95);
  const [skXOff, setSkXOff] = useState<number>(0.15);
  const [skYOff, setSkYOff] = useState<number>(0.05);
  const [boneHead, setBoneHead] = useState<number>(0.4);
  const [boneTorso, setBoneTorso] = useState<number>(0.7);

  const [activePaletteIndex, setActivePaletteIndex] = useState<number>(0);
  const [selectedColorIndex, setSelectedColorIndex] = useState<number>(1); // default color index to paint (e.g. 1)
  const [gridMatrix, setGridMatrix] = useState<number[][]>(() => {
    // Read from window if it exists, otherwise default
    if (typeof window !== 'undefined' && (window as any)._customSprites) {
      return JSON.parse(JSON.stringify((window as any)._customSprites.player_idle || (window as any)._customSprites.player));
    }
    return JSON.parse(JSON.stringify(DEFAULT_SPRITES.player));
  });

  const [gridSize, setGridSize] = useState<number>(() => gridMatrix.length);
  const [spriteScale, setSpriteScale] = useState<number>(() => {
    if (typeof window !== 'undefined' && (window as any)._customSprites) {
      return (window as any)._customSprites.spriteScale || 2.5; // Custom 2.5x preset preference!
    }
    return 2.5;
  });

  const [mirrorX, setMirrorX] = useState<boolean>(true); // symetrical auto-mirroring active by default
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [applyFlash, setApplyFlash] = useState<boolean>(false);

  // AI Sprite Generator States
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [promptDescription, setPromptDescription] = useState<string>("");
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAIPanel, setShowAIPanel] = useState<boolean>(true); // Open AI panel by default to show text generator!

  // Helper to persist to localStorage to apply custom sprites across levels
  const saveToLocalStorage = () => {
    if (typeof window !== 'undefined' && (window as any)._customSprites) {
      try {
        localStorage.setItem('nomada_quest_custom_sprites', JSON.stringify((window as any)._customSprites));
      } catch (e) {
        console.error("Error writing to localStorage:", e);
      }
    }
  };

  const generateAISpriteFromPrompt = async () => {
    if (!promptDescription.trim()) {
      setAiError("Por favor describe las características de tu personaje.");
      return;
    }

    setIsGeneratingAI(true);
    setAiError(null);
    audio.playPowerUp();

    try {
      const response = await fetch("/api/gemini/prompt-to-sprite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promptDescription: promptDescription,
          paletteColors: activePalette.colors,
          size: gridSize,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Ocurrió un error con el servidor.");
      }

      let parsedMatrix: number[][] = [];
      if (data.rows && Array.isArray(data.rows)) {
        parsedMatrix = data.rows.map((rowStr: string) => {
          const rowNumbers: number[] = [];
          for (let i = 0; i < rowStr.length; i++) {
            const char = rowStr[i].toLowerCase();
            let num = parseInt(char, 16);
            if (isNaN(num) || num < 0 || num > 15) {
              num = 0;
            }
            rowNumbers.push(num);
          }
          while (rowNumbers.length < gridSize) {
            rowNumbers.push(0);
          }
          return rowNumbers.slice(0, gridSize);
        });

        while (parsedMatrix.length < gridSize) {
          parsedMatrix.push(Array(gridSize).fill(0));
        }
        parsedMatrix = parsedMatrix.slice(0, gridSize);

      } else if (data.matrix && Array.isArray(data.matrix)) {
        parsedMatrix = data.matrix.map((row: any) => {
          if (Array.isArray(row)) {
            const rowNums = row.map((val: any) => {
              const num = parseInt(val, 10);
              return isNaN(num) || num < 0 || num > 15 ? 0 : num;
            });
            while (rowNums.length < gridSize) {
              rowNums.push(0);
            }
            return rowNums.slice(0, gridSize);
          }
          return Array(gridSize).fill(0);
        });

        while (parsedMatrix.length < gridSize) {
          parsedMatrix.push(Array(gridSize).fill(0));
        }
        parsedMatrix = parsedMatrix.slice(0, gridSize);
      }

      if (parsedMatrix.length > 0) {
        setGridMatrix(parsedMatrix);

        // Save in memory and persist across levels matching frameKey
        if (typeof window !== 'undefined' && (window as any)._customSprites) {
          const k = getFrameKey(activeCategory, activeFrame);
          (window as any)._customSprites[k] = parsedMatrix;
          saveToLocalStorage();
        }

        audio.playPowerUp();
      } else {
        throw new Error(`El formato del sprite generado no es válido para la resolución ${gridSize}x${gridSize}. ¡Intenta de nuevo!`);
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "No se pudo conectar con el motor de IA.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const getFrameKey = (cat: string, frame: string) => {
    if (cat === 'player' || cat === 'horse') return `${cat}_${frame}`;
    return cat;
  };

  const frameKey = getFrameKey(activeCategory, activeFrame);

  const getSavedSkeleton = (k: string) => {
    if (typeof window !== 'undefined' && (window as any)._customSprites?.skeletons) {
      const saved = (window as any)._customSprites.skeletons[k];
      if (saved) return saved;
    }
    if (k.includes('duck')) {
      return { xOff: 0.1, yOff: 0.4, width: 0.8, height: 0.6, boneY1: 0.5, boneY2: 0.8 };
    }
    if (k.startsWith('horse')) {
      return { xOff: 0.05, yOff: 0.1, width: 0.9, height: 0.9, boneY1: 0.3, boneY2: 0.7 };
    }
    return { xOff: 0.15, yOff: 0.05, width: 0.7, height: 0.95, boneY1: 0.4, boneY2: 0.7 };
  };

  const updateSkeleton = (changes: Partial<{ xOff: number, yOff: number, width: number, height: number, boneY1: number, boneY2: number }>) => {
    if (typeof window === 'undefined') return;
    if (!(window as any)._customSprites) return;
    if (!(window as any)._customSprites.skeletons) {
      (window as any)._customSprites.skeletons = {};
    }
    
    const k = getFrameKey(activeCategory, activeFrame);
    const current = getSavedSkeleton(k);
    const updated = { ...current, ...changes };
    (window as any)._customSprites.skeletons[k] = updated;

    if (changes.width !== undefined) setSkWidth(changes.width);
    if (changes.height !== undefined) setSkHeight(changes.height);
    if (changes.xOff !== undefined) setSkXOff(changes.xOff);
    if (changes.yOff !== undefined) setSkYOff(changes.yOff);
    if (changes.boneY1 !== undefined) setBoneHead(changes.boneY1);
    if (changes.boneY2 !== undefined) setBoneTorso(changes.boneY2);

    saveToLocalStorage();
  };

  const handleScaleChange = (val: number) => {
    setSpriteScale(val);
    if (typeof window !== 'undefined' && (window as any)._customSprites) {
      (window as any)._customSprites.spriteScale = val;
      saveToLocalStorage();
    }
    audio.playCoin();
  };

  const changeResolution = (newSize: number) => {
    if (newSize === gridSize) return;
    const nextMatrix = resizeMatrix(gridMatrix, newSize);
    setGridMatrix(nextMatrix);
    setGridSize(newSize);
    
    // Save live configuration inside memory immediately
    if (typeof window !== 'undefined' && (window as any)._customSprites) {
      const k = getFrameKey(activeCategory, activeFrame);
      (window as any)._customSprites[k] = nextMatrix;
      saveToLocalStorage();
    }
    audio.playCoin();
  };

  const activePalette = PALETTES[activePaletteIndex] || PALETTES[0];

  // Update canvas state when editor category or active pose switches
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any)._customSprites) {
      const k = getFrameKey(activeCategory, activeFrame);
      const saved = (window as any)._customSprites[k];
      if (saved) {
        setGridMatrix(JSON.parse(JSON.stringify(saved)));
        setGridSize(saved.length);
      } else {
        const defSource = DEFAULT_SPRITES[k] || DEFAULT_SPRITES[activeCategory];
        const def = JSON.parse(JSON.stringify(defSource));
        setGridMatrix(def);
        setGridSize(def.length);
      }

      // Synchronize skeleton states
      const sk = getSavedSkeleton(k);
      setSkWidth(sk.width ?? 0.7);
      setSkHeight(sk.height ?? 0.95);
      setSkXOff(sk.xOff ?? 0.15);
      setSkYOff(sk.yOff ?? 0.05);
      setBoneHead(sk.boneY1 ?? 0.4);
      setBoneTorso(sk.boneY2 ?? 0.7);
    }
  }, [activeCategory, activeFrame]);

  const handleCellAction = (row: number, col: number) => {
    if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) return;
    const nextMatrix = [...gridMatrix.map(r => [...r])];
    nextMatrix[row][col] = selectedColorIndex;

    if (mirrorX) {
      const mirrorCol = gridSize - 1 - col;
      if (mirrorCol >= 0 && mirrorCol < gridSize) {
        nextMatrix[row][mirrorCol] = selectedColorIndex;
      }
    }

    setGridMatrix(nextMatrix);
    
    // Save live configuration inside memory immediately
    if (typeof window !== 'undefined' && (window as any)._customSprites) {
      const k = getFrameKey(activeCategory, activeFrame);
      (window as any)._customSprites[k] = nextMatrix;
      (window as any)._customSprites.palette = [...activePalette.colors];
      (window as any)._customSprites.activePaletteId = activePalette.id;
      saveToLocalStorage();
    }
  };

  const handleApplyToEngine = () => {
    if (typeof window !== 'undefined' && (window as any)._customSprites) {
      const k = getFrameKey(activeCategory, activeFrame);
      (window as any)._customSprites[k] = JSON.parse(JSON.stringify(gridMatrix));
      (window as any)._customSprites.palette = [...activePalette.colors];
      (window as any)._customSprites.activePaletteId = activePalette.id;
      (window as any)._customSprites.enabled = true;
      saveToLocalStorage();
    }
    
    // Explicitly blur any active input, textarea, or button to immediately return keyboard focus back to the Game Boy console!
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.focus();

    audio.playPowerUp();
    setApplyFlash(true);
    setTimeout(() => setApplyFlash(false), 800);
    if (onNotifyApply) onNotifyApply();
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiError(null);
    audio.playCoin();

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPhotoPreview(base64);
      setPhotoBase64(base64);
    };
    reader.onerror = () => {
      setAiError("Error cargando la foto. Por favor, intenta de nuevo.");
    };
    reader.readAsDataURL(file);
  };

  const generateAISprite = async () => {
    if (!photoBase64) {
      setAiError("Por favor toma una foto o selecciona una imagen primero.");
      return;
    }

    setIsGeneratingAI(true);
    setAiError(null);
    audio.playPowerUp();

    try {
      const response = await fetch("/api/gemini/photo-to-sprite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64Image: photoBase64,
          paletteColors: activePalette.colors,
          size: gridSize,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Ocurrió un error con el servidor.");
      }

      let parsedMatrix: number[][] = [];
      if (data.rows && Array.isArray(data.rows)) {
        parsedMatrix = data.rows.map((rowStr: string) => {
          const rowNumbers: number[] = [];
          for (let i = 0; i < rowStr.length; i++) {
            const char = rowStr[i].toLowerCase();
            let num = parseInt(char, 16);
            if (isNaN(num) || num < 0 || num > 15) {
              num = 0;
            }
            rowNumbers.push(num);
          }
          while (rowNumbers.length < gridSize) {
            rowNumbers.push(0);
          }
          return rowNumbers.slice(0, gridSize);
        });

        while (parsedMatrix.length < gridSize) {
          parsedMatrix.push(Array(gridSize).fill(0));
        }
        parsedMatrix = parsedMatrix.slice(0, gridSize);

      } else if (data.matrix && Array.isArray(data.matrix)) {
        parsedMatrix = data.matrix.map((row: any) => {
          if (Array.isArray(row)) {
            const rowNums = row.map((val: any) => {
              const num = parseInt(val, 10);
              return isNaN(num) || num < 0 || num > 15 ? 0 : num;
            });
            while (rowNums.length < gridSize) {
              rowNums.push(0);
            }
            return rowNums.slice(0, gridSize);
          }
          return Array(gridSize).fill(0);
        });

        while (parsedMatrix.length < gridSize) {
          parsedMatrix.push(Array(gridSize).fill(0));
        }
        parsedMatrix = parsedMatrix.slice(0, gridSize);
      }

      if (parsedMatrix.length > 0) {
        setGridMatrix(parsedMatrix);

        // Save in memory and persist across levels matching frameKey
        if (typeof window !== 'undefined' && (window as any)._customSprites) {
          const k = getFrameKey(activeCategory, activeFrame);
          (window as any)._customSprites[k] = parsedMatrix;
          saveToLocalStorage();
        }

        audio.playPowerUp();
      } else {
        throw new Error(`El formato del sprite generado no es válido para la resolución ${gridSize}x${gridSize}. ¡Intenta de nuevo!`);
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "No se pudo conectar con el motor de IA.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const clearGrid = () => {
    const nextMatrix = createEmptyMatrix(gridSize);
    setGridMatrix(nextMatrix);
    audio.playCoin();
  };

  const resetToDefault = () => {
    const k = getFrameKey(activeCategory, activeFrame);
    const original = JSON.parse(JSON.stringify(DEFAULT_SPRITES[k] || DEFAULT_SPRITES[activeCategory]));
    setGridMatrix(original);
    if (typeof window !== 'undefined' && (window as any)._customSprites) {
      (window as any)._customSprites[k] = original;
      saveToLocalStorage();
    }
    audio.playPowerUp();
  };

  // AUTOMATION ENGINE! Synthesizes random styled matrices using mathematical generators!
  const generateSpriteAutomated = () => {
    // We generate at 16x16 size first to preserve original generator math, and then upscale to gridSize
    const nextMatrix = [];
    for (let r = 0; r < 16; r++) {
      nextMatrix.push(Array(16).fill(0));
    }
    audio.playCoin();

    if (activeCategory === 'player') {
      // GENERATOR: Symmetric Mountain Explorer Bot
      // Draws an outline, a warm face, poncho shirt, boots, and a cute cap
      const faceColor = 6;  // tan skin
      const hairColor = 11; // black outlines
      const shirtColor = Math.random() < 0.5 ? 9 : 15; // berry or orange poncho
      const accentColor = 8; // gold

      // Outlines / bounding shapes
      for (let r = 2; r <= 14; r++) {
        const widthAtRow = r < 6 ? 3 : r < 12 ? 5 : 4;
        for (let c = 8 - widthAtRow; c <= 8 + widthAtRow - 1; c++) {
          if (r < 6) {
            // face/head area
            nextMatrix[r][c] = faceColor;
          } else if (r < 13) {
            // poncho area
            nextMatrix[r][c] = (r === 7 || r === 10) ? accentColor : shirtColor;
          } else {
            // boot areas
            nextMatrix[r][c] = c < 8 ? 4 : 5;
          }
        }
      }

      // Add symmetric eyes & backpack
      nextMatrix[4][5] = 11; // left eye
      nextMatrix[4][10] = 11; // right eye
      nextMatrix[3][4] = hairColor; // headband
      nextMatrix[3][5] = hairColor;
      nextMatrix[3][6] = 13; // Gemstone
      nextMatrix[3][9] = hairColor;
      nextMatrix[3][10] = hairColor;
      nextMatrix[3][11] = hairColor;

      // Add a feather on head
      nextMatrix[1][7] = 10;
      nextMatrix[2][7] = 10;
      nextMatrix[2][8] = 11;

      // Build proper thick outlines automatically
      for (let r = 1; r < 15; r++) {
        for (let c = 1; c < 15; c++) {
          if (nextMatrix[r][c] !== 0) {
            // Check neighbors. If neighbor is empty, convert back to outline 11 is border
            if (
              nextMatrix[r-1][c] === 0 || nextMatrix[r+1][c] === 0 ||
              nextMatrix[r][c-1] === 0 || nextMatrix[r][c+1] === 0
            ) {
              if (nextMatrix[r][c] !== faceColor && nextMatrix[r][c] !== 13) {
                nextMatrix[r][c] = 11;
              }
            }
          }
        }
      }

    } else if (activeCategory === 'enemy_champi') {
      // GENERATOR: Forest Squirrel Automator (Highly fluffy bushy tail + body)
      const coatColor = Math.random() < 0.5 ? 7 : 15; // orange brown or sienna
      const bellyColor = 10; // white
      const backgroundTreeOutline = 11;

      // Draw head and body (symmetric-ish base, but with a fluffy asymmetrical tail block on right!)
      for (let r = 1; r <= 14; r++) {
        const halfWidth = r < 5 ? 4 : r < 12 ? 5 : 3;
        for (let c = 8 - halfWidth; c < 8 + halfWidth; c++) {
          nextMatrix[r][c] = coatColor;
          if (r >= 7 && r <= 11 && Math.abs(8 - c) < 3) {
            // belly patch
            nextMatrix[r][c] = bellyColor;
          }
        }
      }

      // Giant fluffy tail curling on the side (Right columns)
      for (let r = 3; r <= 12; r++) {
        const tWidth = r < 7 ? 3 : r < 10 ? 4 : 2;
        for (let c = 11; c <= 11 + tWidth; c++) {
          if (c < 16) {
            nextMatrix[r][c] = coatColor;
            if (Math.random() < 0.3) nextMatrix[r][c] = 8; // golden tail stripes!
          }
        }
      }

      // Pointy ears
      nextMatrix[0][5] = coatColor;
      nextMatrix[0][10] = coatColor;

      // Angry eyes
      nextMatrix[3][5] = 11;
      nextMatrix[3][9] = 11;
      // rosy cheeks
      nextMatrix[4][4] = 9;
      nextMatrix[4][11] = 9;

      // Outlines
      applyOutlinesToMatrix(nextMatrix);

    } else if (activeCategory === 'enemy_tortu') {
      // GENERATOR: Pinecone hedgehog (Piña de Pino)
      // Generates overlapping brown shingles
      const darkBark = 4;
      const lightBark = 5;
      const leafNeedles = 1;

      // Green spike tips on top
      for (let c = 5; c <= 10; c++) {
        nextMatrix[2][c] = leafNeedles;
        nextMatrix[3][c] = leafNeedles;
      }
      nextMatrix[1][7] = leafNeedles;
      nextMatrix[1][8] = leafNeedles;

      // Layered elliptical scale mounds
      for (let r = 4; r <= 12; r++) {
        const widthRow = Math.min(6, r - 1);
        for (let c = 8 - widthRow; c <= 8 + widthRow; c++) {
          // Checkerboard shingle pattern
          if ((r + c) % 2 === 0) {
            nextMatrix[r][c] = darkBark;
          } else {
            nextMatrix[r][c] = lightBark;
          }
        }
      }

      // Little cute paws at bottom
      nextMatrix[13][5] = 8;
      nextMatrix[13][6] = 8;
      nextMatrix[13][9] = 8;
      nextMatrix[13][10] = 8;

      applyOutlinesToMatrix(nextMatrix);

    } else if (activeCategory === 'enemy_volador') {
      // GENERATOR: Santiago Woodpecker flight matrix
      const bodyColor = 14; // slate
      const crestColor = 9; // red
      const billColor = 8; // gold

      // Round head
      for (let r = 1; r <= 5; r++) {
        const hw = r < 3 ? 2 : 3;
        for (let c = 7 - hw; c <= 7 + hw; c++) {
          nextMatrix[r][c] = bodyColor;
          if (r < 3) nextMatrix[r][c] = crestColor; // Bright red crown crest
        }
      }

      // Drill Bill Beak extending dynamically to left!
      nextMatrix[3][1] = billColor;
      nextMatrix[3][2] = billColor;
      nextMatrix[4][2] = billColor;
      nextMatrix[3][3] = billColor;
      nextMatrix[4][3] = billColor;

      // Body and wing flap
      for (let r = 6; r <= 12; r++) {
        const bw = r < 10 ? 4 : 2;
        for (let c = 8 - bw; c <= 8 + bw; c++) {
          nextMatrix[r][c] = bodyColor;
          // Wing plumage striping
          if (r >= 8 && r <= 10 && c >= 7 && c <= 9) {
            nextMatrix[r][c] = 10; // white flight wings
          }
        }
      }

      applyOutlinesToMatrix(nextMatrix);

    } else if (activeCategory === 'block_pine') {
      // GENERATOR: Rough Pine Log Wood Grain (No mirroring!)
      // Cellular automata ring pattern
      const ringColor = 4; // darker sienna wood
      const baseColor = 5; // light tan wood
      const mossGrassEdge = 2; // dark moss top

      for (let r = 0; r < 16; r++) {
        for (let c = 0; c < 16; c++) {
          // concentric square rings for beautiful pixel logo
          const distToCenter = Math.max(Math.abs(8 - r), Math.abs(8 - c));
          if (distToCenter === 7 || distToCenter === 5 || distToCenter === 2) {
            nextMatrix[r][c] = ringColor;
          } else {
            nextMatrix[r][c] = baseColor;
          }

          // Top moss layers
          if (r === 0) {
            nextMatrix[r][c] = mossGrassEdge;
          } else if (r === 1 && Math.random() < 0.6) {
            nextMatrix[r][c] = mossGrassEdge;
          }
        }
      }

      // Add a cool outer pixel-art framing outline
      for (let i = 0; i < 16; i++) {
        nextMatrix[0][i] = 11;
        nextMatrix[15][i] = 11;
        nextMatrix[i][0] = 11;
        nextMatrix[i][15] = 11;
      }
    }

    const scaledMatrix = resizeMatrix(nextMatrix, gridSize);
    setGridMatrix(scaledMatrix);

    // Synchronize to memory instantly
    if (typeof window !== 'undefined' && (window as any)._customSprites) {
      const k = getFrameKey(activeCategory, activeFrame);
      (window as any)._customSprites[k] = scaledMatrix;
      saveToLocalStorage();
    }
  };

  const applyOutlinesToMatrix = (m: number[][]) => {
    // Generate borders/outlines where sprite transitions to transparent
    const temp = JSON.parse(JSON.stringify(m));
    for (let r = 1; r < 15; r++) {
      for (let c = 1; c < 15; c++) {
        if (temp[r][c] !== 0 && temp[r][c] !== 11) {
          // If any immediate cardinal neighbor is 0 (empty), make it a border
          if (
            temp[r-1][c] === 0 || temp[r+1][c] === 0 ||
            temp[r][c-1] === 0 || temp[r][c+1] === 0
          ) {
            m[r][c] = 11; // Outlines color
          }
        }
      }
    }
  };

  return (
    <div className="w-full max-w-sm lg:max-w-xs bg-zinc-900 border-4 border-black rounded-2xl p-4 flex flex-col gap-4 font-sans select-none text-white shadow-xl relative overflow-hidden">
      {/* Absolute Aseprite header aesthetic banner */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-orange-500" />
      
      {/* Title */}
      <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-2 mt-1">
        <div className="flex flex-col">
          <h2 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1">
            🎨 ASEPRITE LAB AUTOMÁTICO
          </h2>
          <span className="text-[7px] text-zinc-400 font-extrabold uppercase font-mono tracking-widest leading-none">
            Generador Procedural de Pixels
          </span>
        </div>
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[8px] font-mono text-zinc-500 font-bold">V1.3</span>
        </div>
      </div>

      {/* Selector de Sprite Objetivo */}
      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">
          🎯 Objetivo a Personalizar:
        </label>
        <div className="grid grid-cols-2 gap-1 text-[8px] font-extrabold">
          <button
            onClick={() => {
              setActiveCategory('player');
              setActiveFrame('idle');
            }}
            className={`py-1.5 px-1 rounded border uppercase transition ${
              activeCategory === 'player'
                ? 'bg-purple-600 border-purple-400 font-black'
                : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            🏃 Nómada Redondo
          </button>
          <button
            onClick={() => {
              setActiveCategory('horse');
              setActiveFrame('idle');
            }}
            className={`py-1.5 px-1 rounded border uppercase transition ${
              activeCategory === 'horse'
                ? 'bg-purple-600 border-purple-400 font-black'
                : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            🐴 Compañero Caballo
          </button>
          <button
            onClick={() => setActiveCategory('enemy_champi')}
            className={`py-1.5 px-1 rounded border uppercase transition ${
              activeCategory === 'enemy_champi'
                ? 'bg-purple-600 border-purple-400 font-black'
                : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
             Squirrel (Ardilla)
          </button>
          <button
            onClick={() => setActiveCategory('enemy_tortu')}
            className={`py-1.5 px-1 rounded border uppercase transition ${
              activeCategory === 'enemy_tortu'
                ? 'bg-purple-600 border-purple-400 font-black'
                : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            🌲 Piña Puercoespin
          </button>
          <button
            onClick={() => setActiveCategory('enemy_volador')}
            className={`py-1.5 px-1 rounded border uppercase transition ${
              activeCategory === 'enemy_volador'
                ? 'bg-purple-600 border-purple-400 font-black'
                : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            🐦 Carpintero Volador
          </button>
          <button
            onClick={() => setActiveCategory('block_pine')}
            className={`py-1.5 px-1 rounded border uppercase transition ${
              activeCategory === 'block_pine'
                ? 'bg-purple-600 border-purple-400 font-black'
                : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700'
            }`}
          >
            📦 Bloque Pino
          </button>
        </div>

        {/* Active Frame Pose selector for player and horse */}
        {(activeCategory === 'player' || activeCategory === 'horse') && (
          <div className="flex flex-col gap-1 border-t border-zinc-800/60 pt-2 mt-1">
            <span className="text-[7.5px] font-black uppercase text-zinc-400 tracking-wider">
              🎞️ Pose / Frame Activo de Animación:
            </span>
            <div className="grid grid-cols-4 gap-0.5 text-[7px] font-extrabold text-center">
              {[
                { id: 'idle', label: 'Reposo' },
                { id: 'walk', label: 'Caminar' },
                { id: 'jump', label: 'Salto' },
                ...(activeCategory === 'player' ? [{ id: 'duck', label: 'Agachado' }] : [])
              ].map(pose => (
                <button
                  key={pose.id}
                  onClick={() => {
                    setActiveFrame(pose.id as any);
                    audio.playCoin();
                  }}
                  className={`py-1 rounded border uppercase transition ${
                    activeFrame === pose.id
                      ? 'bg-emerald-600 border-emerald-400 font-black'
                      : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-750'
                  }`}
                >
                  {pose.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Photo to Sprite Transmutator Section */}
      <div id="ai-sprite-creator-panel" className="flex flex-col gap-1.5 border-t border-b border-zinc-800/80 py-2">
        <button
          onClick={() => {
            setShowAIPanel(!showAIPanel);
            audio.playCoin();
          }}
          className="w-full flex items-center justify-between py-1 px-2.5 bg-purple-950/40 hover:bg-purple-900/40 border border-purple-800/40 rounded text-[9px] font-black uppercase text-purple-300 transition cursor-pointer"
        >
          <span>✨ {showAIPanel ? 'Ocultar Creador IA' : 'Crear de cero con IA (Texto / Foto)'}</span>
          <span className="text-[7.5px] text-purple-450 font-mono italic animate-pulse">RECOMENDADO ⭐</span>
        </button>

        {showAIPanel && (
          <div className="flex flex-col gap-2 bg-zinc-950/60 p-2.5 rounded border border-zinc-800/80">
            {/* INSPIRACIÓN PRESETS SECTION */}
            <div className="flex flex-col gap-1">
              <label className="text-[7.5px] font-black uppercase text-zinc-400 tracking-wider">
                💡 Inspiración de Personaje (Ideas IA):
              </label>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                {[
                  { label: "🤠 Sombrero y Botas", text: "Un explorador que use sombrero negro de copa, camisa de resaque color gris, pantalon de mezclilla azul con botas de cuero negras" },
                  { label: "🧙 Mago Estelar", text: "Un mago legendario con túnica violeta mística, sombrero puntiagudo y barba plateada larga" },
                  { label: "🧑‍🚀 Astronauta", text: "Un adorable astronauta de traje espacial blanco brillante con gran visor de cristal azul" },
                  { label: "🤖 Cíborg Neón", text: "Un robot cibernético cromado con un ojo y circuitos brillantes color verde neón" },
                  { label: "🛡️ Caballero", text: "Un valiente caballero medieval con armadura plateada pulida, casco con pluma y capa roja" },
                  { label: "🥷 Samurái", text: "Un samurái legendario con armadura de combate roja, adorno de media luna dorada en la frente y kimono negro" }
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setPromptDescription(preset.text);
                      audio.playCoin();
                    }}
                    className="px-1.5 py-1 bg-zinc-900 hover:bg-zinc-805 border border-zinc-800 rounded text-[7px] font-extrabold text-zinc-300 transition shrink-0 active:scale-95 text-left"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TEXT DESCRIPTION INPUT */}
            <div className="flex flex-col gap-1">
              <label className="text-[7.5px] font-black uppercase text-zinc-400 tracking-wider">
                ✍️ Describe tu diseño (en español o inglés):
              </label>
              <textarea
                value={promptDescription}
                onChange={(e) => setPromptDescription(e.target.value)}
                placeholder="Ejemplo: quiero un personaje que use sombrero negro, camisa de resaque color gris y pantalon de mezclilla ..."
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-800 p-1.5 text-[8.5px] rounded text-white placeholder-zinc-650 focus:outline-none focus:border-purple-600 resize-none leading-normal"
              />
            </div>

            {/* OPTIONAL PHOTO ACCORDION */}
            <div className="border-t border-zinc-900/40 pt-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[7px] font-bold text-zinc-500 uppercase">
                  O usa una foto de referencia:
                </span>
                {photoPreview && (
                  <button
                    onClick={() => {
                      setPhotoPreview(null);
                      setPhotoBase64(null);
                      audio.playCoin();
                    }}
                    className="text-[6.5px] text-red-400 font-bold hover:underline"
                  >
                    Quitar foto
                  </button>
                )}
              </div>
              
              <div className="flex gap-2 items-center mt-1">
                <label className="flex-1 flex flex-col items-center justify-center h-10 border border-dashed border-zinc-800 hover:border-purple-500 bg-zinc-900/40 rounded transition cursor-pointer text-center">
                  <span className="text-[7.5px] font-bold text-zinc-400 uppercase">📷 Adjuntar Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                {photoPreview && (
                  <div className="w-10 h-10 rounded border border-purple-500/40 overflow-hidden shrink-0">
                    <img
                      src={photoPreview}
                      alt="Selfie"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* AI TRIGGER GENERATION ACTION */}
            <button
              disabled={isGeneratingAI}
              onClick={photoBase64 ? generateAISprite : generateAISpriteFromPrompt}
              className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-zinc-800 disabled:to-zinc-800 text-white font-black text-[9px] rounded border border-purple-400 uppercase active:translate-y-0.5 transition flex items-center justify-center gap-1 cursor-pointer shadow-md disabled:cursor-not-allowed"
            >
              {isGeneratingAI ? (
                <span className="flex items-center gap-1.5 animate-pulse">
                  <span className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  🤖 ESCULPIENDO SPRITE CON IA...
                </span>
              ) : (
                photoBase64 ? '✨ TRANSFORMAR FOTO EN SPRITE' : '✨ ESBOZAR SPRITE RETRO CON IA'
              )}
            </button>

            {aiError && (
              <div className="p-1.5 rounded bg-red-950/60 border border-red-800/40 text-red-200 text-[7px] font-bold uppercase leading-normal">
                ⚠️ Error: {aiError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sprite Resolution & Interactive Size Scale Controls */}
      <div className="flex flex-col gap-2.5 border-t border-b border-zinc-800/80 py-2 pt-1">
        <div className="flex items-center justify-between">
          <label className="text-[8px] font-black uppercase text-zinc-400 tracking-wider">
            Resonancia de Detalle:
          </label>
          <div className="flex gap-1">
            {[16, 32, 64, 128].map((sz) => (
              <button
                key={sz}
                onClick={() => changeResolution(sz)}
                className={`px-1.5 py-0.5 rounded text-[8px] font-black border transition ${
                  gridSize === sz
                    ? 'bg-purple-600 border-purple-400 text-white font-black'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700'
                }`}
              >
                {sz}²
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center bg-zinc-950/40 p-1 px-1.5 rounded border border-zinc-800/60">
            <label className="text-[8px] font-black uppercase text-zinc-400 tracking-wider">
              🎚️ Ajuste de Tamaño (Juego):
            </label>
            <span className="text-[8px] font-black font-mono text-purple-400">
              {spriteScale.toFixed(1)}x
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.2"
              value={spriteScale}
              onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex gap-1 text-[7px] font-black">
              {[1.0, 2.0, 3.0].map((sc) => (
                <button
                  key={sc}
                  onClick={() => handleScaleChange(sc)}
                  className={`px-1 py-0.5 rounded border transition ${
                    spriteScale === sc ? 'bg-purple-600 border-purple-450 text-white font-black' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  {sc}x
                </button>
              ))}
            </div>
          </div>
          <p className="text-[6.5px] text-zinc-500 italic font-semibold leading-normal">
            ¿Se ven muy pequeños en la pantalla? ¡Aumenta el tamaño para que luzcan grandes en el juego!
          </p>
        </div>
      </div>

      {/* Main Pixel Canvas Grid Area */}
      <div className="flex flex-col items-center gap-2">
        <div className="bg-zinc-950 p-2 rounded-xl border-2 border-black/80 shadow-inner max-w-full">
          {/* Active Checkerboard design representational pixel-drawing canvas */}
          <div
            id="sprite-draw-canvas"
            className="bg-[#e0e0e0] border-2 border-zinc-800 cursor-crosshair select-none overflow-hidden touch-none relative"
            style={{
              width: '192px',
              height: '192px',
              display: 'grid',
              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
              gridTemplateRows: `repeat(${gridSize}, 1fr)`,
              backgroundImage: 'radial-gradient(#d0d0d0 1px, transparent 1px), radial-gradient(#e8e8e8 1px, transparent 1px)',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 4px 4px'
            }}
            onMouseDown={() => setIsDrawing(true)}
            onMouseUp={() => setIsDrawing(false)}
            onMouseLeave={() => setIsDrawing(false)}
          >
            {gridMatrix.map((row, rIdx) =>
              row.map((val, cIdx) => {
                const isBg = val === 0;
                const cellColor = isBg ? 'transparent' : activePalette.colors[val];
                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleCellAction(rIdx, cIdx);
                    }}
                    onMouseEnter={() => {
                      if (isDrawing) handleCellAction(rIdx, cIdx);
                    }}
                    className="border-[0.5px] border-zinc-900/5 box-border"
                    style={{
                      backgroundColor: cellColor,
                      width: '100%',
                      height: '100%',
                    }}
                    title={`Pixel R${rIdx} C${cIdx}`}
                  />
                );
              })
            )}

            {/* Absolute Skeletal and Hitbox Overlay Indicator */}
            {(activeCategory === 'player' || activeCategory === 'horse') && (
              <svg 
                className="absolute inset-0 w-full h-full pointer-events-none select-none"
                style={{ zIndex: 10 }}
              >
                {/* 1. Draw glowing red physical collision box outline */}
                <rect 
                  x={`${skXOff * 100}%`}
                  y={`${skYOff * 100}%`}
                  width={`${skWidth * 100}%`}
                  height={`${skHeight * 100}%`}
                  fill="rgba(239, 68, 68, 0.15)"
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeDasharray="4,2"
                />
                <text 
                  x={`${(skXOff + 0.02) * 100}%`}
                  y={`${(skYOff + 0.08) * 100}%`}
                  fill="#fca5a5"
                  className="text-[6px] font-bold select-none font-mono tracking-tighter"
                >
                  HITBOX
                </text>

                {/* 2. Draw green skeletal bones structure */}
                {/* Spine */}
                <line 
                  x1={`${(skXOff + skWidth/2) * 100}%`}
                  y1={`${(skYOff + skHeight * boneHead) * 100}%`}
                  x2={`${(skXOff + skWidth/2) * 100}%`}
                  y2={`${(skYOff + skHeight * boneTorso) * 100}%`}
                  stroke="#22c55e"
                  strokeWidth="2.5"
                />
                
                {/* Arms shoulder joint */}
                <line 
                  x1={`${skXOff * 100}%`}
                  y1={`${(skYOff + skHeight * boneHead) * 100}%`}
                  x2={`${(skXOff + skWidth) * 100}%`}
                  y2={`${(skYOff + skHeight * boneHead) * 100}%`}
                  stroke="#22c55e"
                  strokeWidth="1.5"
                />

                {/* Hips joint */}
                <line 
                  x1={`${(skXOff + skWidth * 0.15) * 100}%`}
                  y1={`${(skYOff + skHeight * boneTorso) * 100}%`}
                  x2={`${(skXOff + skWidth * 0.85) * 100}%`}
                  y2={`${(skYOff + skHeight * boneTorso) * 100}%`}
                  stroke="#22c55e"
                  strokeWidth="1.5"
                />

                {/* Legs down to feet */}
                <line 
                  x1={`${(skXOff + skWidth * 0.25) * 100}%`}
                  y1={`${(skYOff + skHeight * boneTorso) * 100}%`}
                  x2={`${(skXOff + skWidth * 0.2) * 100}%`}
                  y2={`${(skYOff + skHeight) * 100}%`}
                  stroke="#22c55e"
                  strokeWidth="1.5"
                />
                <line 
                  x1={`${(skXOff + skWidth * 0.75) * 100}%`}
                  y1={`${(skYOff + skHeight * boneTorso) * 100}%`}
                  x2={`${(skXOff + skWidth * 0.8) * 100}%`}
                  y2={`${(skYOff + skHeight) * 100}%`}
                  stroke="#22c55e"
                  strokeWidth="1.5"
                />

                {/* Joints socket vertices */}
                <circle cx={`${(skXOff + skWidth/2) * 100}%`} cy={`${(skYOff + skHeight * boneHead) * 100}%`} r="2.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1" />
                <circle cx={`${(skXOff + skWidth/2) * 100}%`} cy={`${(skYOff + skHeight * boneTorso) * 100}%`} r="2.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1" />
              </svg>
            )}
          </div>
        </div>

        {/* Symmetry checkbox helper */}
        <div className="flex items-center gap-2 bg-zinc-800/80 px-2.5 py-1 rounded-full border border-zinc-700/50 w-full justify-between">
          <span className="text-[8px] font-black uppercase text-zinc-400 select-none">
            🦋 Simetría Espejo Horizontal:
          </span>
          <input
            id="symmetry-check"
            type="checkbox"
            checked={mirrorX}
            onChange={(e) => {
              setMirrorX(e.target.checked);
              audio.playCoin();
            }}
            className="w-3.5 h-3.5 rounded bg-zinc-700 border-zinc-600 accent-purple-500 cursor-pointer"
          />
        </div>

        {/* Skeleton & Bound configuration panel */}
        {(activeCategory === 'player' || activeCategory === 'horse') && (
          <div className="flex flex-col gap-2 bg-purple-950/25 p-2 rounded border border-purple-900/40 w-full">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-black uppercase text-purple-300 tracking-wider">
                🦴 ESQUELETO Dinámico:
              </span>
              <span className="text-[6.5px] font-mono font-bold bg-purple-900 px-1 py-0.5 rounded uppercase">
                {activeFrame}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[7px] font-bold text-zinc-300">
              <div className="flex flex-col gap-0.5">
                <span className="text-[5.8px] uppercase text-zinc-400">Ancho: {(skWidth * 100).toFixed(0)}%</span>
                <input 
                  type="range" min="0.2" max="1.0" step="0.05" value={skWidth} 
                  onChange={(e) => updateSkeleton({ width: parseFloat(e.target.value) })}
                  className="h-1 bg-zinc-800 rounded accent-emerald-500 cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[5.8px] uppercase text-zinc-400">Alto: {(skHeight * 100).toFixed(0)}%</span>
                <input 
                  type="range" min="0.2" max="1.0" step="0.05" value={skHeight} 
                  onChange={(e) => updateSkeleton({ height: parseFloat(e.target.value) })}
                  className="h-1 bg-zinc-800 rounded accent-emerald-500 cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[5.8px] uppercase text-zinc-400">Desvío X: {(skXOff * 100).toFixed(0)}%</span>
                <input 
                  type="range" min="0.0" max="0.5" step="0.05" value={skXOff} 
                  onChange={(e) => updateSkeleton({ xOff: parseFloat(e.target.value) })}
                  className="h-1 bg-zinc-800 rounded accent-emerald-500 cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[5.8px] uppercase text-zinc-400">Desvío Y: {(skYOff * 100).toFixed(0)}%</span>
                <input 
                  type="range" min="0.0" max="0.5" step="0.05" value={skYOff} 
                  onChange={(e) => updateSkeleton({ yOff: parseFloat(e.target.value) })}
                  className="h-1 bg-zinc-800 rounded accent-emerald-500 cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[5.8px] uppercase text-zinc-400">Joint Cuello: {(boneHead * 100).toFixed(0)}%</span>
                <input 
                  type="range" min="0.10" max="0.50" step="0.05" value={boneHead} 
                  onChange={(e) => updateSkeleton({ boneY1: parseFloat(e.target.value) })}
                  className="h-1 bg-zinc-800 rounded accent-blue-500 cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[5.8px] uppercase text-zinc-400">Joint Cadera: {(boneTorso * 100).toFixed(0)}%</span>
                <input 
                  type="range" min="0.40" max="0.90" step="0.05" value={boneTorso} 
                  onChange={(e) => updateSkeleton({ boneY2: parseFloat(e.target.value) })}
                  className="h-1 bg-zinc-800 rounded accent-blue-500 cursor-pointer"
                />
              </div>
            </div>
            <p className="text-[5.5px] text-zinc-500 italic leading-tight mt-0.5">
              Alégrate: el motor de físicas de la Game Canvas sincroniza este esqueleto para reaccionar con hitboxes 100% calibrados a tus poses artísticas.
            </p>
          </div>
        )}
      </div>

      {/* Dynamic Procedural Generators Controls */}
      <div className="flex flex-col gap-1.5 border-t border-zinc-800/85 pt-2">
        <div className="flex justify-between items-center">
          <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">
            ⚙️ Motores de Automatización:
          </label>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <button
            id="autogen-btn"
            onClick={generateSpriteAutomated}
            title="Genera un sprite procedural simétrico para la categoría seleccionada"
            className="col-span-2 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-[9px] rounded border border-emerald-400 uppercase active:translate-y-0.5 transition cursor-pointer flex items-center justify-center gap-1 shadow-md"
          >
            ⚡ AUTO-GENERAR SPRITE
          </button>
          <button
            onClick={resetToDefault}
            title="Restaurar a sprite inicial pixel-art"
            className="py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-[8px] rounded border border-zinc-600 uppercase active:translate-y-0.5 transition cursor-pointer"
          >
            Resetear
          </button>
        </div>
        
        {/* Clear buttons */}
        <button
          onClick={clearGrid}
          className="w-full py-1 bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-800/45 text-[7px] tracking-wider uppercase rounded cursor-pointer transition font-bold"
        >
          🧹 Vaciar Lienzo (Canvas Limpio)
        </button>
      </div>

      {/* Palette selector & Swatches */}
      <div className="flex flex-col gap-1 border-t border-zinc-800 pt-2 selection:bg-transparent">
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">
            🎨 Paleta de Color:
          </label>
          <select
            id="palette-select"
            value={activePaletteIndex}
            onChange={(e) => {
              const idx = parseInt(e.target.value);
              setActivePaletteIndex(idx);
              audio.playCoin();
              
              // Apply live update immediately to current custom session
              if (typeof window !== 'undefined' && (window as any)._customSprites) {
                (window as any)._customSprites.palette = [...PALETTES[idx].colors];
                (window as any)._customSprites.activePaletteId = PALETTES[idx].id;
              }
            }}
            className="bg-zinc-950 border border-zinc-800 text-[8px] font-extrabold uppercase py-0.5 px-1 rounded text-purple-300 focus:outline-none"
          >
            {PALETTES.map((pal, idx) => (
              <option key={pal.id} value={idx}>{pal.name}</option>
            ))}
          </select>
        </div>

        {/* Swatches Grid */}
        <div className="grid grid-cols-8 gap-1.5 p-1.5 bg-zinc-950/80 rounded border border-zinc-800">
          {activePalette.colors.map((hex, index) => {
            const isSelected = selectedColorIndex === index;
            const isTrans = index === 0;
            return (
              <button
                key={index}
                onClick={() => {
                  setSelectedColorIndex(index);
                  audio.playCoin();
                }}
                className={`w-4 h-4 rounded border-2 box-border relative ${
                  isSelected ? 'border-white scale-110 shadow-md ring-1 ring-purple-500' : 'border-black/50 hover:scale-105'
                }`}
                style={{
                  backgroundColor: isTrans ? 'transparent' : hex,
                  backgroundImage: isTrans ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : undefined,
                  backgroundSize: isTrans ? '4px 4px' : undefined,
                  backgroundPosition: isTrans ? '0 0, 0 2px, 2px -2px, -2px 0' : undefined,
                }}
                title={isTrans ? 'Color Transparente' : `Color ${index}: ${hex}`}
              >
                {isSelected && (
                  <span className="absolute inset-0 flex items-center justify-center text-[7px] text-white font-black bg-black/20 select-none">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* APPLY ACTION CTA WITH SUCCESS FEEDBBAK */}
      <div className="border-t border-zinc-800 pt-2 selection:bg-transparent">
        <button
          id="apply-to-game-btn"
          onClick={handleApplyToEngine}
          className={`w-full py-2.5 font-sans font-black tracking-widest text-xs rounded-xl uppercase flex items-center justify-center gap-1.5 shadow-lg active:translate-y-0.5 transition-all text-black cursor-pointer ${
            applyFlash 
              ? 'bg-emerald-500 text-white animate-pulse border-2 border-emerald-300 scale-[1.03]'
              : 'bg-[#F8B800] hover:bg-yellow-400 border-2 border-black'
          }`}
        >
          {applyFlash ? '🚀 ¡SPRITES APLICADOS CORRECTAMENTE!' : '🎯 APLICAR AL MOTOR DE JUEGO'}
        </button>
        
        <p className="text-[7.5px] leading-tight text-zinc-500 font-extrabold text-center mt-1.5 uppercase select-none">
          Inyecta los pixel-art procedurales directamente en el rendering cycle del canvas!
        </p>
      </div>
    </div>
  );
}
