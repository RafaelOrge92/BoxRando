import { BiSolidLeftArrow, BiSolidRightArrow } from 'react-icons/bi';
import { useGameState } from '../hooks/useGameState';

interface Props {
  state: ReturnType<typeof useGameState>;
}

export function GridPanel({ state }: Props) {
  const {
    activeTab, currentBoxView, handlePrevBox, handleNextBox,
    specialBoxNames, handleSpecialBoxNameChange, saveSpecialBoxNamesToDb,
    ROWS, COLS, blockedPositions, result, animatingPosition,
    toggleBlockPosition
  } = state;

  return (
    <div className={`sv-panel p-6 xl:p-10 flex flex-col gap-6 ${activeTab === 'special' ? 'sv-panel-special' : ''}`}>

      {/* SV Header navigation style for Boxes */}
      <div className={`flex justify-between items-center bg-zinc-950/20 p-2 rounded-xl border border-white/5 ${activeTab === 'special' ? 'sv-header-special' : ''}`}>
        <button
          onClick={handlePrevBox}
          className="w-14 h-9 sv-btn cursor-pointer rounded-2xl flex items-center justify-center pr-[2px]"
        >
          <BiSolidLeftArrow size={20} />
        </button>
        <div className="text-3xl font-black tracking-wide text-white drop-shadow flex justify-center items-center">
          {activeTab === 'special' ? (
            <input
              type="text"
              value={specialBoxNames[currentBoxView] ?? `Caja Especial ${currentBoxView}`}
              onChange={(e) => handleSpecialBoxNameChange(currentBoxView, e.target.value)}
              onBlur={saveSpecialBoxNamesToDb}
              className="sv-special-box-input"
              placeholder={`Caja Especial ${currentBoxView}`}
            />
          ) : (
            <span>Caja {currentBoxView}</span>
          )}
        </div>
        <button
          onClick={handleNextBox}
          className="w-14 h-9 sv-btn cursor-pointer rounded-2xl flex items-center justify-center"
        >
          <BiSolidRightArrow size={20} />
        </button>
      </div>

      {/* The Grid mapping box positions */}
      <div className={`bg-zinc-950/45 p-6 rounded-2xl border-2 border-indigo-950/30 shadow-inner w-full ${activeTab === 'special' ? 'sv-grid-special' : ''}`}>
        <div className="flex flex-col gap-3">
          {Array.from({ length: ROWS }).map((_, r) => (
            <div key={r} className="grid grid-cols-6 gap-3">
              {Array.from({ length: COLS }).map((_, c) => {
                const dbBox = activeTab === 'special' ? currentBoxView + 1000 : currentBoxView;
                const id = `${dbBox}-${r}-${c}`;
                const isBlocked = blockedPositions.includes(id);
                const isResult = result && result.tab === activeTab && result.box === currentBoxView && result.row === r && result.col === c;

                const isAnimating = animatingPosition &&
                  animatingPosition.tab === activeTab &&
                  animatingPosition.box === currentBoxView &&
                  animatingPosition.row === r &&
                  animatingPosition.col === c;

                let cellClass = 'sv-cell aspect-square flex items-center justify-center cursor-pointer select-none';
                if (isBlocked) cellClass += ' sv-cell-blocked';
                if (isResult) cellClass += ' sv-cell-result';
                if (isAnimating) cellClass += ' sv-cell-animating';

                return (
                  <button
                    key={id}
                    onClick={() => toggleBlockPosition(r, c)}
                    disabled={!!isResult}
                    aria-label={`Fila ${r + 1} Columna ${c + 1}`}
                    className={cellClass}
                    title={`Fila ${r + 1}, Columna ${c + 1}`}
                  >
                    {/* Display custom Egg Image instead of emoji */}
                    {isBlocked ? (
                      <div className="relative flex items-center justify-center">
                        <img
                          src="/egg.png"
                          alt="Blocked Slot"
                          className="sv-egg-img w-10 h-10 object-contain opacity-20 grayscale"
                        />
                        <span className="absolute text-red-500 font-bold text-xs select-none pointer-events-none drop-shadow">❌</span>
                      </div>
                    ) : (
                      <img
                        src="/egg.png"
                        alt="Egg Slot"
                        className={`sv-egg-img w-10 h-10 object-contain ${isResult ? 'w-12 h-12' : ''}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="text-center text-xs text-violet-200/70 font-medium">
        Haz click para bloquear o desbloquear una casilla.
      </div>
    </div>
  );
}
