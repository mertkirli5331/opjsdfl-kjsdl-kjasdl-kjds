import React from 'react';
import { X, Crown, Zap, Shield, Swords, Gamepad2 } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Gamepad2 className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 font-cinzel">Oyun Kılavuzu & Kurallar</h2>
            <p className="text-xs text-slate-400">Arena Arcade platformundaki 3 oyunun detaylı rehberi</p>
          </div>
        </div>

        {/* Content sections */}
        <div className="space-y-6 text-sm text-slate-300">
          {/* Game 1: Krallık Arenası */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-2 mb-2 text-amber-400 font-bold">
              <Crown className="w-4 h-4 fill-amber-400" />
              <span>1. Krallık Arenası (Clash Royale Tarzı)</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              İksirini akıllıca kullanarak birliklerini sahaya sür, nehir köprülerini geç ve düşmanın 3 kulesini yok et!
            </p>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li>• <strong>İksir Yönetimi:</strong> İksirin 10&apos;a kadar dolar. Kart maliyetine göre strateji kur.</li>
              <li>• <strong>Bölge Kuralı:</strong> Birliklerini kendi yarı sahada veya yok ettiğin düşman kulesinin bölgesine bırakabilirsin. <strong>Ateş Topu</strong> büyüsünü ise tüm arenaya fırlatabilirsin!</li>
              <li>• <strong>Çift İksir:</strong> Mücadelenin son 60 saniyesinde iksir üretimi 2 katına çıkar.</li>
              <li>• <strong>3 Taç Zaferi:</strong> Düşmanın ana Kral Kulesini yıktığın an anında 3 taç ile kazanırsın.</li>
            </ul>
          </div>

          {/* Game 2: Neon Yılan */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-2 mb-2 text-emerald-400 font-bold">
              <span>🐍</span>
              <span>2. Neon Yılan</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Reflekslerini test et! Duvarlara ve kendi gövdene çarpmadan elmaları toplayarak büyü.
            </p>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li>• <strong>Kontroller:</strong> W/A/S/D veya Yön Tuşları, mobilde ekran altındaki D-Pad butonları.</li>
              <li>• <strong>Oyun Modları:</strong> Klasik (duvar çarpar), Işınlanma (kenarlardan geçer), Engelli (lazer bariyerleri).</li>
              <li>• <strong>Özel Güçler:</strong> Altın Yıldız (2X Skor), Buz Kristali (yavaşlatma), Şimşek (500 bonus puan).</li>
            </ul>
          </div>

          {/* Game 3: FS 27 Çiftlik & Traktör */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-2 mb-2 text-lime-400 font-bold">
              <span>🌾</span>
              <span>3. FS 27: Modern Çiftlik & Traktör (Hay Day Tarzı)</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Gelişmiş grafikler, gerçekçi traktör mekanikleri ve Hay Day çiftlik atmosferi! Tarlaları sürün, ekin, biçerdöverle altın buğdayları hasat edip balyalayın ve siloda satın.
            </p>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li>• <strong>Traktör Sürüşü:</strong> W / S (İleri / Geri gaz), A / D (Direksiyon açısı), &apos;H&apos; havalı korna, &apos;L&apos; farlar.</li>
              <li>• <strong>Ekipman Değiştirme:</strong> &apos;1&apos; Pulluk (Sürüm), &apos;2&apos; Mibzer (Ekim), &apos;3&apos; Biçerdöver Tablası (Hasat), &apos;4&apos; Balya Makinesi.</li>
              <li>• <strong>Silo & Satış:</strong> Tarladan biçtiğiniz tonlarca buğdayı Silo Boşaltma Noktasına götürüp satın, kazandığınız altınlarla traktörünüzü ve deponuzu yükseltin!</li>
            </ul>
          </div>

          {/* Game 4: HİDROMEK 310 LC Şantiyesi */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-2 mb-2 text-red-400 font-bold">
              <span>🚜</span>
              <span>4. HİDROMEK 310 LC & Çok Oyunculu Şantiye</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Ultra-gerçekçi HİDROMEK HMK 310 LC paletli ekskavatör simülasyonu! Dış görünümden tüm makineyi izleyip kontrol edin, zemini kazıp 2. oyuncu ile kaya kamyonuna yükleyin.
            </p>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li>• <strong>Oyuncu 1 (HİDROMEK Operatörü):</strong> W/S ile Ana Bomu, A/D ile Kırıcı Kolu, Q/E ile Kovayı kontrol edin, Z/C ile paletleri sürün. &apos;L&apos; tuşuyla projektörü açın!</li>
              <li>• <strong>Oyuncu 2 (Damperli Kamyon):</strong> J/K ile kamyonu sürün, U/O ile damperi kaldırıp dökün. &apos;H&apos; tuşuyla havalı korna çalın!</li>
              <li>• <strong>Hedef:</strong> Birlikte belirlenen tonajı (20 Ton) şantiye deposuna ulaştırıp sözleşmeyi tamamlayın.</li>
            </ul>
          </div>

          {/* Game 5: Uzay Akıncısı */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center gap-2 mb-2 text-sky-400 font-bold">
              <span>🚀</span>
              <span>5. Uzay Akıncısı (Galaksi Savaşı)</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Düşman filolarını ve asteroitleri yok et, düşen güçlendirmeleri kap ve devasa Boss gemilerini temizle!
            </p>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li>• <strong>Kontroller:</strong> Farenizi / parmağınızı gezdirin veya WASD ile hareket edin. Lazerler otomatik ateşlenir.</li>
              <li>• <strong>EMP Süper Bomba:</strong> &apos;B&apos; tuşuna basarak veya ekrandaki bombaya tıklayarak tüm düşmanları temizleyin!</li>
              <li>• <strong>Güçlendirmeler:</strong> Üçlü Plazma Lazer, Enerji Kalkanı, Süper Bomba ve Hızlı Ateş.</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs cursor-pointer transition-colors"
          >
            Anladım, Oyna!
          </button>
        </div>
      </div>
    </div>
  );
};
