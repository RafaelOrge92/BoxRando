import { BiSolidUser, BiError, BiCheckCircle, BiSolidSave, BiSolidFolderOpen, BiVolumeMute, BiVolumeFull } from 'react-icons/bi';
import { supabase } from '../supabaseClient';
import { useGameState } from '../hooks/useGameState';

interface Props {
  state: ReturnType<typeof useGameState>;
}

export function Sidebar({ state }: Props) {
  const {
    username, isEditingUsername, handleUsernameChange, setIsEditingUsername,
    activeTab, totalSpecialBoxes, totalBoxes, handleTotalSpecialBoxesChange, handleTotalBoxesChange,
    handleRoll, isRolling, result, specialBoxNames,
    handleExportJSON, handleImportJSON,
    volume, setVolume, isMuted, setIsMuted,
    error, successMsg
  } = state;

  return (
    <div className="flex flex-col gap-3">
      <div className="px-3 py-1 bg-zinc-950/40 border border-white/10 rounded-full text-xs font-bold tracking-widest text-violet-200 flex items-center justify-between">
        <span className="flex items-center gap-1.5"><BiSolidUser className="text-[var(--sv-accent-yellow)]" size={14} /> ENTRENADOR ACTIVO</span>
        <span className="text-white drop-shadow-sm font-black uppercase text-xs">{username || 'πrola'}</span>
      </div>

      {/* Slot 1: Active user session */}
      <div className="sv-party-slot p-4 flex flex-col gap-2 relative overflow-hidden">
        {isEditingUsername ? (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-black text-violet-300 uppercase tracking-widest block">Cambiar Nickname</span>
            <input
              type="text"
              maxLength={9}
              defaultValue={username}
              onBlur={(e) => handleUsernameChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUsernameChange(e.currentTarget.value)}
              autoFocus
              className="bg-zinc-950/60 border border-violet-500/50 rounded px-2 py-1 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-violet-400 w-full"
              placeholder="Tu Nickname..."
            />
            <button
              onClick={() => setIsEditingUsername(false)}
              className="text-left self-start text-xs font-black uppercase text-violet-300 border border-violet-500/20 bg-violet-950/20 px-2.5 py-1 rounded hover:bg-violet-900/30 transition-colors cursor-pointer mt-1"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setIsEditingUsername(true)}
              className="text-center text-xs font-black uppercase text-violet-300 border border-violet-500/20 bg-violet-950/20 px-2.5 py-2 rounded hover:bg-violet-900/30 transition-colors cursor-pointer w-full"
            >
              Ajustes de Usuario
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-center text-xs font-black uppercase text-red-300 border border-red-500/20 bg-red-950/20 px-2.5 py-2 rounded hover:bg-red-900/30 transition-colors cursor-pointer w-full"
            >
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>

      {/* Slot 2: Config - Number of boxes */}
      <div className="sv-party-slot p-4 flex flex-col gap-1">
        <span className="text-xs font-black text-violet-300 uppercase tracking-widest block">
          {activeTab === 'special' ? 'Total Cajas Especiales' : 'Total de Cajas'}
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
        <span className="text-xs font-black text-violet-300 uppercase tracking-widest block">Selección Segura</span>
        <button
          onClick={handleRoll}
          disabled={isRolling}
          className={`w-full cursor-pointer sv-btn sv-btn-action font-black py-3 px-4 rounded-xl transition duration-200 uppercase tracking-widest text-sm text-xs active:scale-98 mt-1 ${isRolling ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isRolling ? 'SORTEANDO...' : 'GENERAR TIRADA'}
        </button>

        {result ? (
          <div className="mt-3 p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-lg text-center">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-widest block">Resultado Obtenido</span>
            <span className="text-base font-black text-emerald-300 mt-1 block">
              {result.tab === 'special'
                ? `${specialBoxNames[result.box] ?? `Caja Especial ${result.box}`} ➔ F. ${result.row + 1}, C. ${result.col + 1}`
                : `Caja ${result.box} ➔ F. ${result.row + 1}, C. ${result.col + 1}`}
            </span>
          </div>
        ) : (
          <div className="mt-3 p-3 bg-zinc-950/20 border border-dashed border-white/10 rounded-lg text-center text-xs text-violet-300 font-medium">
            Sin tirada activa
          </div>
        )}
      </div>

      {/* Slot 4: Backups & File Uploads (Import/Export) */}
      <div className="sv-party-slot p-4 flex flex-col gap-3">
        <span className="text-xs font-black text-violet-300 uppercase tracking-widest block">Copias de Seguridad (JSON)</span>
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

      {/* Slot 5: Audio Config */}
      <div className="sv-party-slot p-4 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-black text-violet-300 uppercase tracking-widest block">Volumen</span>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="text-[var(--sv-accent-yellow)] cursor-pointer"
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

      {/* Notifications and errors */}
      {error && (
        <div className="p-3 bg-red-950/30 border border-red-500/20 rounded-xl text-center text-red-200 font-bold text-xs flex items-center justify-center gap-1.5">
          <BiError size={16} /> {error}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl text-center text-emerald-200 font-bold text-xs flex items-center justify-center gap-1.5">
          <BiCheckCircle size={16} /> {successMsg}
        </div>
      )}
    </div>
  );
}
