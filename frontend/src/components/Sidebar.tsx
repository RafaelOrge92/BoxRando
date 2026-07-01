import { useState } from 'react';
import { BiSolidUser, BiError, BiCheckCircle, BiSolidSave, BiSolidFolderOpen, BiVolumeMute, BiVolumeFull, BiTrash } from 'react-icons/bi';
import { supabase } from '../supabaseClient';
import { useGameState } from '../hooks/useGameState';

interface Props {
  state: ReturnType<typeof useGameState>;
}

export function Sidebar({ state }: Props) {
  const [showUnblockModal, setShowUnblockModal] = useState(false);

  const {
    username, isEditingUsername, handleUsernameChange, setIsEditingUsername,
    activeTab, totalSpecialBoxes, totalBoxes, handleTotalSpecialBoxesChange, handleTotalBoxesChange,
    handleRoll, isRolling, result, specialBoxNames,
    handleExportJSON, handleImportJSON,
    volume, setVolume, isMuted, setIsMuted,
    error, successMsg, handleUnblockAll
  } = state;

  return (
    <div className="flex flex-col gap-3 relative">


      {/* Slot 2: Config - Number of boxes */}
      <div className="sv-party-slot p-4 flex flex-col gap-1">
        <span className="text-xs font-black text-violet-300 uppercase tracking-widest block">
          {activeTab === 'special' ? 'Total de Cajas Especiales' : 'Total de Cajas Normales'}
        </span>
        <div className="flex items-center gap-3 mt-1">
          <input
            type="number"
            min={1}
            max={200}
            value={activeTab === 'special' ? totalSpecialBoxes : totalBoxes}
            onChange={(e) => {
              const str = e.target.value;
              if (str === '') {
                if (activeTab === 'special') handleTotalSpecialBoxesChange('');
                else handleTotalBoxesChange('');
                return;
              }
              const val = parseInt(str);
              if (isNaN(val)) return;
              if (activeTab === 'special') {
                handleTotalSpecialBoxesChange(val);
              } else {
                handleTotalBoxesChange(val);
              }
            }}
            onBlur={(e) => {
              const val = parseInt(e.target.value);
              const finalVal = (isNaN(val) || val < 1) ? 1 : val;
              if (activeTab === 'special') {
                handleTotalSpecialBoxesChange(finalVal);
              } else {
                handleTotalBoxesChange(finalVal);
              }
            }}
            className="w-full bg-zinc-950/40 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-400 font-bold"
          />
        </div>
      </div>

      {/* Slot 3: Result of the Randomizer roll */}
      <div className="sv-party-slot p-4 flex flex-col gap-1">
        <button
          onClick={handleRoll}
          disabled={isRolling}
          className={`w-full cursor-pointer sv-btn sv-btn-action font-black py-3 px-4 rounded-xl uppercase tracking-widest text-sm text-xs active:scale-98 mt-1 ${isRolling ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isRolling ? 'SORTEANDO...' : 'GENERAR TIRADA'}
        </button>

        {result ? (
          <div className="mt-3 p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-lg text-center h-[74px] flex flex-col justify-center">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-widest block">Resultado Obtenido</span>
            <span className="text-base font-black text-emerald-300 mt-1 block">
              {result.tab === 'special'
                ? `${specialBoxNames[result.box] ?? `Caja Especial ${result.box}`} ➔ F. ${result.row + 1}, C. ${result.col + 1}`
                : `Caja ${result.box} ➔ F. ${result.row + 1}, C. ${result.col + 1}`}
            </span>
          </div>
        ) : (
          <div className="mt-3 p-3 bg-zinc-950/20 border border-dashed border-white/10 rounded-lg text-center text-xs text-violet-300 font-medium h-[74px] flex flex-col justify-center">
            Sin tirada activa
          </div>
        )}
      </div>

      {/* Slot 4: Audio Config */}
      <div className="sv-party-slot p-4 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-black text-violet-300 uppercase tracking-widest block">Volumen</span>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="text-[#d8b4fe] cursor-pointer"
            title={isMuted ? "Desmutear" : "Mutear"}
          >
            {isMuted ? <BiVolumeMute size={18} /> : <BiVolumeFull size={18} />}
          </button>
        </div>
        <input
          type="range"
          min="0" max="1" step="0.01"
          value={isMuted ? 0 : volume}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            setVolume(val);
            if (isMuted && val > 0) setIsMuted(false);
            if (!isMuted && val === 0) setIsMuted(true);
          }}
          style={{ background: `linear-gradient(to right, #d8b4fe ${(isMuted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.2) ${(isMuted ? 0 : volume) * 100}%)` }}
          className="w-full cursor-pointer sv-slider"
        />
      </div>

      {/* Slot 5: Backups & File Uploads (Import/Export) */}
      <div className="sv-party-slot p-4 flex flex-col gap-3">
        <span className="text-xs font-black text-violet-300 uppercase tracking-widest block">COPIA DE SEGURIDAD</span>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            onClick={handleExportJSON}
            className="w-full cursor-pointer bg-zinc-950/40 hover:bg-zinc-900/40 text-xs font-black uppercase text-violet-200 border border-white/10 py-2 rounded-lg transition-colors flex justify-center items-center gap-1.5"
          >
            <BiSolidSave size={16} /> Exportar
          </button>
          <label className="w-full cursor-pointer bg-zinc-950/40 hover:bg-zinc-900/40 text-xs font-black uppercase text-violet-200 border border-white/10 py-2 rounded-lg transition-colors flex justify-center items-center gap-1.5 cursor-pointer">
            <BiSolidFolderOpen size={16} /> Importar
            <input
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Slot 6: Global Management */}
      <div className="sv-party-slot p-4 flex flex-col gap-3">
        <span className="text-xs font-black text-violet-300 uppercase tracking-widest block">Gestión Global</span>
        <button
          onClick={() => setShowUnblockModal(true)}
          className="w-full cursor-pointer bg-red-950/40 hover:bg-red-900/60 text-xs font-black uppercase text-red-200 border border-red-500/30 py-2.5 rounded-lg transition-colors flex justify-center items-center gap-1.5"
        >
          <BiTrash size={16} /> Desmarcar Todo
        </button>
      </div>

      {/* Notifications and errors */}
      <div className="absolute top-full left-0 right-0 mt-3 flex flex-col gap-3 z-50">
        {error && (
          <div className="p-3 bg-red-950/30 border border-red-500/20 rounded-xl text-center text-red-200 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg animate-in fade-in slide-in-from-top-2">
            <BiError size={16} /> {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl text-center text-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg animate-in fade-in slide-in-from-top-2">
            <BiCheckCircle size={16} /> {successMsg}
          </div>
        )}
      </div>

      {/* Unblock All Confirmation Modal */}
      {showUnblockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1e1936] border-2 border-red-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-black text-white uppercase flex items-center gap-2">
              <BiError className="text-red-500" size={24} />
              ¡ATENCIÓN!
            </h3>
            <p className="text-sm text-violet-200 font-medium">
              Esta acción desmarcará todas las casillas bloqueadas de todas tus cajas, tanto normales como especiales.
            </p>
            <p className="text-sm text-red-300 font-bold">
              Esta acción no se puede deshacer de forma automática a menos que cargues una copia de seguridad anterior.
            </p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowUnblockModal(false)}
                className="flex-1 cursor-pointer bg-[#2e2652] hover:bg-[#3f3470] text-white font-black uppercase text-sm py-3 rounded-xl transition-colors border border-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowUnblockModal(false);
                  handleUnblockAll();
                }}
                className="flex-1 cursor-pointer bg-red-600 hover:bg-red-500 text-white font-black uppercase text-sm py-3 rounded-xl transition-colors shadow-lg shadow-red-900/50 border border-red-400"
              >
                Sí, Desmarcar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
