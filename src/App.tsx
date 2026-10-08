/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sidebar, ActiveGame } from './components/Sidebar';
import { Header } from './components/Header';
import { ClashRoyaleGame } from './components/games/clash/ClashRoyaleGame';
import { SnakeGame } from './components/games/snake/SnakeGame';
import { FarmingGame } from './components/games/farming/FarmingGame';
import { ExcavatorGame } from './components/games/excavator/ExcavatorGame';
import { SpaceDefenderGame } from './components/games/space/SpaceDefenderGame';
import { HelpModal } from './components/HelpModal';
import { sound } from './utils/audio';

export default function App() {
  const [activeGame, setActiveGame] = useState<ActiveGame>('clash');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(sound.enabled);

  const handleToggleSound = () => {
    const updated = sound.toggle();
    setSoundEnabled(updated);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row antialiased overflow-x-hidden">
      {/* Left Sidebar */}
      <Sidebar
        activeGame={activeGame}
        onSelectGame={(game) => setActiveGame(game)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenHelp={() => setIsHelpOpen(true)}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
      />

      {/* Main Game Stage Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <Header
          activeGame={activeGame}
          onSelectGame={(game) => setActiveGame(game)}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenHelp={() => setIsHelpOpen(true)}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
        />

        {/* Game Stage Content */}
        <main className="flex-1 flex flex-col justify-center items-center p-3 sm:p-6 lg:p-8">
          {activeGame === 'clash' && <ClashRoyaleGame />}
          {activeGame === 'snake' && <SnakeGame />}
          {activeGame === 'fs27' && <FarmingGame />}
          {activeGame === 'excavator' && <ExcavatorGame />}
          {activeGame === 'space' && <SpaceDefenderGame />}
        </main>

        {/* Clean Footer */}
        <footer className="border-t border-slate-900 bg-slate-950/80 px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">Arena Arcade</span>
            <span aria-hidden="true">·</span>
            <span>Clash Royale, Neon Yılan, FS 27 Çiftlik & Traktör, Ekskavatör & Uzay Akıncısı</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Tüm hakları saklıdır © 2026</span>
          </div>
        </footer>
      </div>

      {/* Guide Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
