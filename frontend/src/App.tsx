import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import './App.css';

interface SelectedPosition {
  box: number;
  row: number;
  col: number;
}

export default function App() {
  // Auth state
  const [user, setUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // App state
  const [totalBoxes, setTotalBoxes] = useState<number>(1);
  const [currentBoxView, setCurrentBoxView] = useState<number>(1);
  const [blockedPositions, setBlockedPositions] = useState<string[]>([]);
  const [result, setResult] = useState<SelectedPosition | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ROWS = 5;
  const COLS = 6;

  // Listen to Auth changes and load data accordingly
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadUserData(session.user.id);
      } else {
        // Auto-login con credenciales fijas para desarrollo sin confirmación de correo
        try {
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: 'admin@admin.com',
            password: 'Ad1234'
          });
          if (signInErr) {
            console.warn('Auto-login fallido. Asegúrate de crear el usuario admin@admin.com en tu dashboard de Supabase.');
            setAuthLoading(false);
          } else if (signInData?.session) {
            setUser(signInData.session.user);
            loadUserData(signInData.session.user.id);
          } else {
            setAuthLoading(false);
          }
        } catch (err) {
          console.warn('Error en auto-login:', err);
          setAuthLoading(false);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        // Clear state on logout
        setBlockedPositions([]);
        setResult(null);
        setTotalBoxes(1);
        setCurrentBoxView(1);
        setAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch settings (total_boxes) and blocked positions from Supabase
  const loadUserData = async (userId: string) => {
    setAuthLoading(true);
    setError(null);
    try {
      // 1. Fetch profiles configuration
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('total_boxes')
        .eq('id', userId)
        .single();

      if (profileErr) {
        console.warn('Profile not found in database. The postgres trigger should create it shortly.', profileErr.message);
      } else if (profile) {
        setTotalBoxes(profile.total_boxes);
      }

      // 2. Fetch blocked positions
      const { data: blocks, error: blocksErr } = await supabase
        .from('blocked_positions')
        .select('box, row, col')
        .eq('user_id', userId);

      if (blocksErr) throw blocksErr;

      if (blocks) {
        const formatted = blocks.map((b: any) => `${b.box}-${b.row}-${b.col}`);
        setBlockedPositions(formatted);
      }
    } catch (err: any) {
      setError('Error al iniciar sesión en la base de datos: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Toggle blocked positions, syncing with database if authenticated
  const toggleBlockPosition = async (row: number, col: number) => {
    if (!user) return;
    setError(null);
    const id = `${currentBoxView}-${row}-${col}`;
    const isBlocked = blockedPositions.includes(id);

    try {
      if (isBlocked) {
        const { error: deleteErr } = await supabase
          .from('blocked_positions')
          .delete()
          .eq('user_id', user.id)
          .eq('box', currentBoxView)
          .eq('row', row)
          .eq('col', col);

        if (deleteErr) throw deleteErr;
        setBlockedPositions(blockedPositions.filter((p) => p !== id));
      } else {
        const { error: insertErr } = await supabase
          .from('blocked_positions')
          .insert({
            user_id: user.id,
            box: currentBoxView,
            row: row,
            col: col
          });

        if (insertErr) throw insertErr;
        setBlockedPositions([...blockedPositions, id]);
      }
    } catch (err: any) {
      setError('Error al sincronizar bloqueo: ' + err.message);
    }
  };

  // Update total boxes in local state and profiles table in database
  const handleTotalBoxesChange = async (val: number) => {
    setTotalBoxes(val);
    if (currentBoxView > val) setCurrentBoxView(val);

    if (user) {
      setError(null);
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ total_boxes: val })
        .eq('id', user.id);

      if (updateErr) {
        setError('Error al guardar total de cajas: ' + updateErr.message);
      }
    }
  };

  // Perform secure roll on the database side (RPC call)
  const handleRoll = async () => {
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('roll_position', {
        total_boxes: totalBoxes
      });

      if (rpcErr) {
        throw new Error(rpcErr.message || 'Error al generar la tirada');
      }

      if (data && data.length > 0) {
        const rollResult = data[0]; // Returns { out_box, out_row, out_col, out_pos_id }
        setResult({
          box: rollResult.out_box,
          row: rollResult.out_row,
          col: rollResult.out_col
        });
        setCurrentBoxView(rollResult.out_box);
      } else {
        throw new Error('No se pudo generar la tirada desde el servidor');
      }
    } catch (err: any) {
      setError(err.message);
      setResult(null);
    }
  };

  // Authentication submission
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    try {
      if (isSignUp) {
        const { error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: email.split('@')[0]
            }
          }
        });
        if (signUpErr) throw signUpErr;
        setSuccessMsg('¡Registro exitoso! Ya puedes iniciar sesión (y verifica tu correo si es requerido).');
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) throw signInErr;
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Export blocked positions to local JSON file
  const handleExportJSON = () => {
    try {
      const exportData = blockedPositions.map(id => {
        const [box, row, col] = id.split('-').map(Number);
        return { box, row, col };
      });

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(exportData, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `boxrando_blocked_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      setError('Error al exportar JSON: ' + err.message);
    }
  };

  // Import blocked positions from local JSON file
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (!Array.isArray(parsed)) {
            throw new Error('El formato del archivo JSON debe ser un array');
          }

          const validatedBlocks: { box: number; row: number; col: number; user_id: string }[] = [];
          const validatedIds: string[] = [];

          for (const item of parsed) {
            if (
              typeof item.box !== 'number' ||
              typeof item.row !== 'number' ||
              typeof item.col !== 'number' ||
              item.box < 1 ||
              item.row < 0 || item.row > 4 ||
              item.col < 0 || item.col > 5
            ) {
              throw new Error('Celda inválida en JSON. Campos box(>=1), row(0-4), col(0-5) requeridos.');
            }
            validatedBlocks.push({
              box: item.box,
              row: item.row,
              col: item.col,
              user_id: user.id
            });
            validatedIds.push(`${item.box}-${item.row}-${item.col}`);
          }

          if (user) {
            const { error: upsertErr } = await supabase
              .from('blocked_positions')
              .upsert(validatedBlocks, { onConflict: 'user_id,box,row,col' });

            if (upsertErr) throw upsertErr;
          }

          // Merge loaded blocks with current local state
          const merged = Array.from(new Set([...blockedPositions, ...validatedIds]));
          setBlockedPositions(merged);
          setSuccessMsg('Bloqueos importados y sincronizados correctamente');
          setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err: any) {
          setError('Error al importar JSON: ' + err.message);
        }
      };
    }
  };

  // Auth loading spinner UI
  if (authLoading) {
    return (
      <div className="min-h-screen bg-black text-emerald-300 flex flex-col items-center justify-center font-mono relative crt-screen" style={{ background: '#000' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(rgba(0,0,0,0) 0 3px, rgba(0,0,0,0.08) 3px 4px), radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.6) 100%)', mixBlendMode: 'overlay' }} />
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p className="text-emerald-400 text-xl tracking-widest uppercase animate-pulse">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  // Not authenticated UI (CRT terminal login)
  if (!user) {
    return (
      <div className="min-h-screen bg-black text-emerald-300 flex flex-col items-center justify-center p-6 font-mono relative crt-screen" style={{ background: '#000' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(rgba(0,0,0,0) 0 3px, rgba(0,0,0,0.08) 3px 4px), radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.6) 100%)', mixBlendMode: 'overlay' }} />

        <header className="mb-8 text-center max-w-lg">
          <h1 className="text-4xl font-extrabold tracking-wide uppercase crt-title" style={{ color: '#bfffcf', textShadow: '0 0 8px rgba(0,255,140,0.12), 0 0 24px rgba(0,255,140,0.06)' }}>
            Pokémon Box Randomizer
          </h1>
          <p className="text-emerald-400 mt-2 text-sm uppercase tracking-wider">Acceso Requerido - Base de Datos en la Nube</p>
        </header>

        <div className="w-full max-w-md bg-zinc-950 p-8 rounded-2xl border-2 border-emerald-500/20 crt-box shadow-2xl relative">
          <h2 className="text-2xl font-bold mb-6 text-emerald-400 text-center uppercase tracking-wider">
            {isSignUp ? 'Registrar Usuario' : 'Iniciar Sesión'}
          </h2>

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-emerald-500 uppercase tracking-widest">Correo Electrónico:</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-zinc-900 border border-emerald-500/30 rounded-lg px-3 py-2.5 text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-sm placeholder-emerald-800"
                placeholder="entrenador@pallet.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-emerald-500 uppercase tracking-widest">Contraseña:</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-zinc-900 border border-emerald-500/30 rounded-lg px-3 py-2.5 text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-sm placeholder-emerald-800"
                placeholder="********"
              />
            </div>

            <button
              type="submit"
              className="mt-4 w-full cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-black font-black py-3 px-6 rounded-xl transition duration-200 uppercase tracking-widest text-sm shadow-lg shadow-emerald-500/20 active:scale-98"
            >
              {isSignUp ? 'Registrar' : 'Acceder'}
            </button>
          </form>

          <div className="mt-6 text-center border-t border-emerald-500/10 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-xs text-emerald-500 hover:underline hover:text-emerald-300 font-bold uppercase tracking-wider cursor-pointer"
            >
              {isSignUp ? '¿Ya tienes una cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-rose-950/40 border border-rose-500/30 rounded-lg text-center text-rose-400 font-medium text-xs font-mono">
              ⚠️ ERROR: {error}
            </div>
          )}

          {successMsg && (
            <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-center text-emerald-400 font-medium text-xs font-mono">
              ✔️ {successMsg}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Logged in main dashboard UI
  return (
    <div className="min-h-screen bg-black text-emerald-300 flex flex-col items-center p-6 font-mono relative crt-screen" style={{ background: '#000' }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(rgba(0,0,0,0) 0 3px, rgba(0,0,0,0.08) 3px 4px), radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.6) 100%)', mixBlendMode: 'overlay' }} />

      {/* Top navbar bar */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-6 text-xs text-emerald-400 font-mono border-b border-emerald-500/20 pb-2 z-10">
        <span>SESIÓN: <strong className="text-emerald-200">{user.email}</strong></span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="cursor-pointer bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-md uppercase font-bold tracking-wider transition-colors"
        >
          Cerrar Sesión
        </button>
      </div>

      <header className="mb-8 text-center z-10">
        <h1 className="text-5xl font-extrabold tracking-wide uppercase crt-title" style={{ color: '#bfffcf', textShadow: '0 0 8px rgba(0,255,140,0.12), 0 0 24px rgba(0,255,140,0.06)', letterSpacing: '1px' }}>
          Pokémon Box Randomizer
        </h1>
        <p className="text-emerald-400 mt-2">Selecciona tus cajas, bloquea espacios y genera tu tirada segura</p>
      </header>

      <main className="w-full max-w-4xl bg-transparent p-6 rounded-2xl shadow-xl border border-emerald-800/20 grid grid-cols-1 md:grid-cols-3 gap-8 crt-box z-10">

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
                handleTotalBoxesChange(val);
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
            🤡 SHOW
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
            <div className="mt-4 p-4 bg-rose-950/40 border border-rose-500/30 rounded-xl text-center text-rose-400 font-medium text-sm font-mono">
              ⚠️ {error}
            </div>
          )}

          {successMsg && (
            <div className="mt-4 p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-center text-emerald-400 font-medium text-sm font-mono">
              ✔️ {successMsg}
            </div>
          )}

          {/* Import/Export Backup Section */}
          <div className="mt-6 pt-6 border-t border-emerald-500/20 flex flex-col gap-3">
            <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Copia de Seguridad</h3>

            <button
              onClick={handleExportJSON}
              className="w-full cursor-pointer bg-zinc-900 hover:bg-zinc-850 text-emerald-300 border border-emerald-500/30 font-bold py-2 px-4 rounded-lg text-xs uppercase tracking-wider transition-colors"
            >
              💾 Exportar Bloqueos (JSON)
            </button>

            <label className="w-full cursor-pointer bg-zinc-900 hover:bg-zinc-850 text-emerald-300 border border-emerald-500/30 font-bold py-2 px-4 rounded-lg text-xs uppercase tracking-wider transition-colors text-center block">
              📂 Importar Bloqueos (JSON)
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col items-center justify-center">
          <div className="mb-4 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide">
            Caja {currentBoxView}
          </div>

          <div className="bg-transparent p-6 rounded-2xl border-4 border-emerald-800/20 shadow-inner w-full max-w-lg crt-grid">
            <div className="flex flex-col gap-3">
              {Array.from({ length: ROWS }).map((_, r) => (
                <div key={r} className="grid grid-cols-6 gap-3">
                  {Array.from({ length: COLS }).map((_, c) => {
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
                        aria-label={`Fila ${r + 1} Columna ${c + 1}`}
                        className={`border-2 rounded-xl transition-all duration-150 flex items-center justify-center text-2xl cursor-pointer select-none w-full aspect-square ${slotBg}`}
                        title={`Fila ${r + 1}, Columna ${c + 1}`}
                      >
                        {isResult ? '⭐' : isBlocked ? '❌' : '🥚'}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-emerald-400 mt-4 text-center">
            Haz click en cualquier celda para bloquearla/desbloquearla.
          </p>
        </div>

      </main>
    </div>
  );
}