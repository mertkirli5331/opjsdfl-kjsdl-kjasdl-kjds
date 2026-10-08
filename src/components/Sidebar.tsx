import React from 'react';
import { Crown, Sparkles, Rocket, Volume2, VolumeX, Trophy, HelpCircle, Gamepad2, X } from 'lucide-react';
import { sound } from '../utils/audio';

export type ActiveGame = 'clash' | 'snake' | 'fs27' | 'excavator' | 'space';

interface SidebarProps {
  activeGame: ActiveGame;
  onSelectGame: (game: ActiveGame) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenHelp: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeGame,
  onSelectGame,
  isOpenMobile,
  onCloseMobile,
  onOpenHelp,
  soundEnabled,
  onToggleSound,
}) => {
  const games = [
    {
      id: 'clash' as ActiveGame,
      title: 'Krallık Arenası',
      subtitle: 'Clash Royale Tarzı',
      genre: 'Kule Savaşı & Strateji',
      icon: '👑',
      accentColor: 'from-amber-500/20 to-blue-500/20 border-amber-500/40 text-amber-400',
      activeBorder: 'border-amber-400/80 bg-slate-800/90',
    },
    {
      id: 'snake' as ActiveGame,
      title: 'Neon Yılan',
      subtitle: 'Modern Snake Tarzı',
      genre: 'Hızlı Refleks & Arcade',
      icon: '🐍',
      accentColor: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-400',
      activeBorder: 'border-emerald-400/80 bg-slate-800/90',
    },
    {
      id: 'fs27' as ActiveGame,
      title: 'FS 27',
      subtitle: 'Hay Day Çiftlik & Traktör',
      genre: 'Ultra-Grafikli Tarım Simülatörü',
      icon: '🌾',
      accentColor: 'from-amber-500/20 to-lime-500/20 border-lime-500/40 text-lime-400',
      activeBorder: 'border-lime-400/80 bg-slate-800/90',
    },
    {
      id: 'excavator' as ActiveGame,
      title: 'HİDROMEK 310 LC',
      subtitle: 'Ağır Paletli Ekskavatör',
      genre: 'Ultra-Gerçekçi Hidrolik & Kamyon',
      icon: '🚜',
      accentColor: 'from-red-600/20 to-slate-800/40 border-red-500/40 text-red-400',
      activeBorder: 'border-red-500/80 bg-slate-800/90',
    },
    {
      id: 'space' as ActiveGame,
      title: 'Uzay Akıncısı',
      subtitle: 'Galaksi İstilası',
      genre: 'Uzay Nişancı & Aksiyon',
      icon: '🚀',
      accentColor: 'from-sky-500/20 to-purple-500/20 border-sky-500/40 text-sky-400',
      activeBorder: 'border-sky-400/80 bg-slate-800/90',
    },
  ];

  // Retrieve records
  const snakeHighScore = localStorage.getItem('neon_snake_high_score') || '0';
  const fs27HarvestRecord = localStorage.getItem('fs27_harvest_record') || '0';
  const excavatorTonsRecord = localStorage.getItem('excavator_tons_record') || '0';
  const spaceHighScore = localStorage.getItem('space_defender_high_score') || '0';

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Left Sidebar Drawer */}
      <aside
        className={`fixed lg:static top-0 left-0 h-full w-72 sm:w-80 bg-slate-900/95 lg:bg-slate-900/60 backdrop-blur-xl border-r border-slate-800/80 z-50 flex flex-col justify-between p-5 transition-transform duration-300 ease-in-out shrink-0 ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Branding & Close Button on Mobile */}
        <div>
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-md shadow-amber-500/20">
                <Gamepad2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-slate-100 text-lg leading-tight tracking-tight">
                  Arena Arcade
                </h1>
                <p className="text-[11px] text-slate-400 font-medium">Popüler Web Oyunları</p>
              </div>
            </div>

            {/* Mobile close */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Game Selection Section */}
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
              Oyun Sekmeleri
            </div>

            <div className="space-y-2.5">
              {games.map(game => {
                const isActive = activeGame === game.id;
                return (
                  <button
                    key={game.id}
                    onClick={() => {
                      sound.playClick();
                      onSelectGame(game.id);
                      onCloseMobile();
                    }}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all duration-150 flex items-center gap-3.5 cursor-pointer group ${
                      isActive
                        ? `${game.activeBorder} shadow-lg ring-1 ring-white/10`
                        : 'border-slate-800/80 bg-slate-950/40 hover:bg-slate-850 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-2xl p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 group-hover:scale-110 transition-transform">
                      {game.icon}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-sm text-slate-100 truncate">
                          {game.title}
                        </span>
                        {isActive && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        )}
                      </div>

                      <div className="text-[11px] text-amber-400/90 font-medium truncate">
                        {game.subtitle}
                      </div>

                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {game.genre}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* High Scores summary */}
          <div className="mt-6 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 mb-2.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Kayıtlı Rekorların</span>
            </div>
            <div className="space-y-1.5 text-[11px] text-slate-400">
              <div className="flex items-center justify-between">
                <span>🐍 Yılan En Yüksek:</span>
                <span className="font-mono-num font-bold text-emerald-400">{snakeHighScore}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>🌾 FS 27 Rekor Hasat:</span>
                <span className="font-mono-num font-bold text-lime-400">{fs27HarvestRecord} kg</span>
              </div>
              <div className="flex items-center justify-between">
                <span>🚜 Şantiye Rekoru:</span>
                <span className="font-mono-num font-bold text-yellow-400">{excavatorTonsRecord} Ton</span>
              </div>
              <div className="flex items-center justify-between">
                <span>🚀 Uzay En Yüksek:</span>
                <span className="font-mono-num font-bold text-sky-400">{spaceHighScore}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions & Controls */}
        <div className="pt-4 border-t border-slate-800 space-y-2">
          {/* Sound Toggle */}
          <button
            onClick={() => {
              onToggleSound();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors"
          >
            <span className="flex items-center gap-2">
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
              Oyun Sesleri
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${soundEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
              {soundEnabled ? 'Açık' : 'Kapalı'}
            </span>
          </button>

          {/* Help Button */}
          <button
            onClick={onOpenHelp}
            className="w-full py-2 px-3 rounded-xl hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Oyun Rehberi & Kurallar
          </button>
        </div>
      </aside>
    </>
  );
};
