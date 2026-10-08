import React from 'react';
import { ActiveGame } from './Sidebar';
import { Menu, Volume2, VolumeX, HelpCircle, Gamepad2 } from 'lucide-react';

interface HeaderProps {
  activeGame: ActiveGame;
  onSelectGame: (game: ActiveGame) => void;
  onOpenMobileSidebar: () => void;
  onOpenHelp: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeGame,
  onSelectGame,
  onOpenMobileSidebar,
  onOpenHelp,
  soundEnabled,
  onToggleSound,
}) => {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Zone 1: Brand Title Wordmark */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
          aria-label="Menüyü Aç"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-base sm:text-lg font-bold text-slate-100 tracking-tight font-cinzel">
          Arena Arcade
        </span>
      </div>

      {/* Zone 2: Navigation Links (Oyun Sekmeleri) */}
      <nav className="hidden md:flex items-center gap-1.5 p-1 bg-slate-950/70 border border-slate-800 rounded-xl text-xs font-semibold">
        <button
          onClick={() => onSelectGame('clash')}
          className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeGame === 'clash'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          👑 Krallık Arenası
        </button>

        <button
          onClick={() => onSelectGame('snake')}
          className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeGame === 'snake'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🐍 Neon Yılan
        </button>

        <button
          onClick={() => onSelectGame('fs27')}
          className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeGame === 'fs27'
              ? 'bg-lime-500/20 text-lime-300 border border-lime-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🌾 FS 27 Traktör
        </button>

        <button
          onClick={() => onSelectGame('excavator')}
          className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeGame === 'excavator'
              ? 'bg-red-500/20 text-red-300 border border-red-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🚜 HİDROMEK 310
        </button>

        <button
          onClick={() => onSelectGame('space')}
          className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
            activeGame === 'space'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🚀 Uzay Akıncısı
        </button>
      </nav>

      {/* Zone 3: 1-2 Primary Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSound}
          className="p-2 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white cursor-pointer transition-colors"
          title={soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
          aria-label={soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <VolumeX className="w-4 h-4 text-slate-500" />
          )}
        </button>

        <button
          onClick={onOpenHelp}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/80 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
        >
          <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Nasıl Oynanır?</span>
        </button>
      </div>
    </header>
  );
};
