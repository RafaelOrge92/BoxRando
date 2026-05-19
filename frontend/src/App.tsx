import { useState } from 'react';

interface SelectedPosition {
  box: number;
  row: number;
  col: number;
}

export default function App() {
  const [totalBoxes, setTotalBoxes] = useState<number>(1);
  const [currentBoxView, setCurrentBoxView] = useState<number>(1);
  const [blockedPositions, setBlockedPositions] = useState<string[]>([]);
  const [result, setResult] = useState<SelectedPosition | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ROWS = 5;
  const COLS = 6;

  const toggleBlockPosition = (row: number, col: number) => {
    const id = `${currentBoxView}-${row}-${col}`;
    if (blockedPositions.includes(id)) {
      setBlockedPositions(blockedPositions.filter((p) => p !== id));
    } else {
      setBlockedPositions([...blockedPositions, id]);
    }
  };

  const handleRoll = async () => {
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/roll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalBoxes, blockedPositions }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al generar la tirada');
      }

      setResult(data);
      setCurrentBoxView(data.box);
    } catch (err: any) {
      setError(err.message);
      setResult(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center p-6 font-sans">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-black text-yellow-400 tracking-wider uppercase drop-shadow-md">
          Pokémon Box Randomizer
        </h1>
        <p className="text-slate-400 mt-2">Selecciona tus cajas, bloquea espacios y genera tu tirada</p>
      </header>

      <main className="w-full max-w-4xl bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        <div className="flex flex-col gap-5">
          <h2 className="text-xl font-bold border-b border-slate-700 pb-2 text-indigo-400">Configuración</h2>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-300">Número de Cajas Totales:</label>
            <input
              type="number"
              min={1}
              value={totalBoxes}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value) || 1);
                setTotalBoxes(val);
                if (currentBoxView > val) setCurrentBoxView(val);
              }}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-300">Viendo la Caja actualmente:</label>
            <select
              value={currentBoxView}
              onChange={(e) => setCurrentBoxView(parseInt(e.target.value))}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Array.from({ length: totalBoxes }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  Caja {i + 1}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleRoll}
            className="w-full cursor-pointer bg-amber-500 hover:bg-amber-600 text-slate-900 font-black py-4 px-6 rounded-xl transition duration-200 uppercase tracking-wide text-lg shadow-lg shadow-amber-500/20 active:scale-98"
          >
            🎲 ¡Hacer Tirada!
          </button>

          {result && (
            <div className="mt-4 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-center">
              <p className="text-xs text-emerald-400 uppercase font-bold tracking-widest">Resultado</p>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                Caja {result.box} ➔ Fila {result.row + 1}, Col {result.col + 1}
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-rose-950/40 border border-rose-500/30 rounded-xl text-center text-rose-400 font-medium text-sm">
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className="md:col-span-2 flex flex-col items-center justify-center">
          <div className="mb-4 bg-slate-700 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide">
            📍 Matriz de la Caja {currentBoxView}
          </div>

          <div className="bg-slate-950 p-6 rounded-2xl border-4 border-slate-700 shadow-inner w-full max-w-md">
            <div className="grid grid-cols-6 gap-3 aspect-[6/5]">
              {Array.from({ length: ROWS }).map((_, r) =>
                Array.from({ length: COLS }).map((_, c) => {
                  const id = `${currentBoxView}-${r}-${c}`;
                  const isBlocked = blockedPositions.includes(id);
                  const isResult = result && result.box === currentBoxView && result.row === r && result.col === c;

                  let slotBg = 'bg-slate-800 hover:bg-slate-700 border-slate-600';
                  if (isBlocked) slotBg = 'bg-rose-600 border-rose-400 hover:bg-rose-500';
                  if (isResult) slotBg = 'bg-emerald-500 border-emerald-300 animate-pulse ring-4 ring-emerald-400/50';

                  return (
                    <button
                      key={id}
                      onClick={() => toggleBlockPosition(r, c)}
                      disabled={!!isResult}
                      className={`border-2 rounded-xl transition-all duration-150 flex items-center justify-center text-xs font-bold cursor-pointer select-none h-12 w-12 ${slotBg}`}
                      title={`Fila ${r + 1}, Columna ${c + 1}`}
                    >
                      {isResult ? '⭐' : isBlocked ? '❌' : `${r + 1},${c + 1}`}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 text-center">
            * Haz click en cualquier celda para bloquearla/desbloquearla de la tómbola.
          </p>
        </div>

      </main>
    </div>
  );
}