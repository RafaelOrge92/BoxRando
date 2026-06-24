import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { BiSolidLeftArrow, BiSolidRightArrow, BiVolumeFull, BiVolumeMute } from 'react-icons/bi';
import './App.css';

interface SelectedPosition {
  box: number;
  row: number;
  col: number;
  tab?: 'normal' | 'special';
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

  // Animation & Audio State
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [animatingPosition, setAnimatingPosition] = useState<SelectedPosition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const timeoutRefs = useRef<number[]>([]);

  // Audio Config
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Cajas Especiales state
  const [activeTab, setActiveTab] = useState<'normal' | 'special'>('normal');
  const [totalSpecialBoxes, setTotalSpecialBoxes] = useState<number>(1);
  const [specialBoxNames, setSpecialBoxNames] = useState<Record<number, string>>({});

  const ROWS = 5;
  const COLS = 6;

  // Save special boxes count and names to localStorage when they change
  useEffect(() => {
    if (user) {
      localStorage.setItem(`totalSpecialBoxes_${user.id}`, totalSpecialBoxes.toString());
    }
  }, [totalSpecialBoxes, user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(`specialBoxNames_${user.id}`, JSON.stringify(specialBoxNames));
    }
  }, [specialBoxNames, user]);

  // Load special boxes count and names when user logs in
  useEffect(() => {
    if (user) {
      try {
        const savedCount = localStorage.getItem(`totalSpecialBoxes_${user.id}`);
        setTotalSpecialBoxes(savedCount ? parseInt(savedCount) || 1 : 1);

        const savedNames = localStorage.getItem(`specialBoxNames_${user.id}`);
        setSpecialBoxNames(savedNames ? JSON.parse(savedNames) : {});
      } catch (err) {
        console.warn('Error al cargar datos locales:', err);
      }
    } else {
      setTotalSpecialBoxes(1);
      setSpecialBoxNames({});
      setActiveTab('normal');
    }
  }, [user]);

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
        setTotalSpecialBoxes(1);
        setSpecialBoxNames({});
        setActiveTab('normal');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Audio & Animation cleanup
  useEffect(() => {
    // We create the audio element here. The user can just drop 'ruleta.mp3' in the public folder.
    audioRef.current = new Audio('/ruleta.mp3');
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      timeoutRefs.current.forEach(t => clearTimeout(t));
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  // Sync volume with audioRef
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

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
    const dbBox = activeTab === 'special' ? currentBoxView + 1000 : currentBoxView;
    const id = `${dbBox}-${row}-${col}`;

    // Check current state
    const isBlocked = blockedPositions.includes(id);

    // Optimistic UI Update: update state before awaiting network
    if (isBlocked) {
      setBlockedPositions(prev => prev.filter(p => p !== id));
    } else {
      setBlockedPositions(prev => [...prev, id]);
    }

    try {
      if (isBlocked) {
        const { error: deleteErr } = await supabase
          .from('blocked_positions')
          .delete()
          .eq('user_id', user.id)
          .eq('box', dbBox)
          .eq('row', row)
          .eq('col', col);

        if (deleteErr) throw deleteErr;
      } else {
        const { error: insertErr } = await supabase
          .from('blocked_positions')
          .insert({
            user_id: user.id,
            box: dbBox,
            row: row,
            col: col
          });

        if (insertErr) {
          // If the error is a duplicate key violation, the database is already in the desired state.
          // Postgres error code 23505 = unique_violation
          if (insertErr.code !== '23505') {
            throw insertErr;
          }
        }
      }
    } catch (err: any) {
      // Revert optimistic update on failure
      if (isBlocked) {
        setBlockedPositions(prev => [...prev, id]);
      } else {
        setBlockedPositions(prev => prev.filter(p => p !== id));
      }
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

  const handleTotalSpecialBoxesChange = (val: number) => {
    setTotalSpecialBoxes(val);
    if (currentBoxView > val) setCurrentBoxView(val);
  };

  const handleSpecialBoxNameChange = (boxNum: number, name: string) => {
    setSpecialBoxNames(prev => ({
      ...prev,
      [boxNum]: name
    }));
  };

  const handleTabChange = (tab: 'normal' | 'special') => {
    setActiveTab(tab);
    setCurrentBoxView(1);
    setResult(null);
    setError(null);
  };

  const handleRoll = async () => {
    if (isRolling) return;
    setError(null);
    setIsRolling(true);

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.warn('Audio play failed:', e));
    }

    let finalResult: SelectedPosition | null = null;
    let finalError: string | null = null;
    let prevIdToBlock: string | null = null;

    // 1. PRE-CALCULATE RESULT AT 0s
    // Find previous result for auto-block to exclude from available cells right now
    if (result && result.tab === activeTab && user) {
      const prevDbBox = activeTab === 'special' ? result.box + 1000 : result.box;
      prevIdToBlock = `${prevDbBox}-${result.row}-${result.col}`;
      
      // Fire and forget insert at 0s so DB/RPC knows it's blocked!
      // But don't update local blockedPositions state yet to preserve visual timing.
      if (!blockedPositions.includes(prevIdToBlock)) {
        const insertPromise = supabase
          .from('blocked_positions')
          .insert({
            user_id: user.id,
            box: prevDbBox,
            row: result.row,
            col: result.col
          });
          
        if (activeTab === 'normal') {
          // Wait for DB insertion in normal mode so the RPC logic respects the new block
          try {
            await insertPromise;
          } catch (e) {
            console.warn('Error auto-blocking previous roll at 0s:', e);
          }
        } else {
          // In special mode, we handle exclusion locally so we don't strictly need to await
          insertPromise.then(({ error }) => {
            if (error && error.code !== '23505') console.warn('Error auto-blocking previous roll at 0s:', error.message);
          });
        }
      }
    }

    if (activeTab === 'special') {
      try {
        const dbBox = currentBoxView + 1000;
        
        const availableCells: { row: number; col: number }[] = [];
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const id = `${dbBox}-${r}-${c}`;
            if (!blockedPositions.includes(id) && id !== prevIdToBlock) {
              availableCells.push({ row: r, col: c });
            }
          }
        }

        if (availableCells.length === 0) {
          throw new Error('No quedan posiciones disponibles en esta caja especial. ¡Desbloquea alguna!');
        }

        const randomIndex = Math.floor(Math.random() * availableCells.length);
        const chosen = availableCells[randomIndex];

        finalResult = {
          box: currentBoxView,
          row: chosen.row,
          col: chosen.col,
          tab: 'special'
        };

        // Register the result in Supabase immediately so it's safe
        if (user) {
          supabase
            .from('roll_results')
            .insert({
              user_id: user.id,
              box: dbBox,
              row: chosen.row,
              col: chosen.col
            })
            .then(({ error: insertErr }) => {
              if (insertErr) console.warn('Error al guardar historial de tirada especial:', insertErr.message);
            });
        }
      } catch (err: any) {
        finalError = err.message;
      }
    } else {
      try {
        const { data, error: rpcErr } = await supabase.rpc('roll_position', {
          total_boxes: totalBoxes
        });

        if (rpcErr) {
          throw new Error(rpcErr.message || 'Error al generar la tirada');
        }

        if (data && data.length > 0) {
          const rollResult = data[0]; // Returns { out_box, out_row, out_col, out_pos_id }
          finalResult = {
            box: rollResult.out_box,
            row: rollResult.out_row,
            col: rollResult.out_col,
            tab: 'normal'
          };
        } else {
          throw new Error('No se pudo generar la tirada desde el servidor');
        }
      } catch (err: any) {
        finalError = err.message;
      }
    }

    if (finalError) {
      setError(finalError);
      setIsRolling(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      return;
    }

    // 2. START ANIMATION
    // Helper to get cells dynamically, avoiding the previous blocked cell
    const getAvailableVisualCells = (boxNum: number) => {
      const dbBox = activeTab === 'special' ? boxNum + 1000 : boxNum;
      const cells: { row: number; col: number }[] = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const id = `${dbBox}-${r}-${c}`;
          if (!blockedPositions.includes(id) && id !== prevIdToBlock) {
            cells.push({ row: r, col: c });
          }
        }
      }
      return cells.length > 0 ? cells : [{ row: 0, col: 0 }]; // fallback
    };

    intervalRef.current = setInterval(() => {
      let boxToAnimate = currentBoxView;
      
      // Multicaja effect for normal rolls
      if (activeTab === 'normal' && totalBoxes > 1) {
        // We use functional state update for currentBoxView or just pick a random box
        boxToAnimate = Math.floor(Math.random() * totalBoxes) + 1;
        setCurrentBoxView(boxToAnimate);
      }

      const cells = getAvailableVisualCells(boxToAnimate);
      const randCell = cells[Math.floor(Math.random() * cells.length)];
      setAnimatingPosition({
        box: boxToAnimate,
        row: randCell.row,
        col: randCell.col,
        tab: activeTab
      });
    }, 100);

    // 3. AT 4000ms: REVEAL RESULT & APPLY AUTO-BLOCK
    const timeout4s = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setAnimatingPosition(null);
      setResult(finalResult);
      
      // Jump to the winner box view
      if (finalResult) {
        setCurrentBoxView(finalResult.box);
      }

      // Apply the auto-block visually at this exact moment for BOTH modes
      if (prevIdToBlock && user) {
        if (!blockedPositions.includes(prevIdToBlock)) {
          // Optimistic update
          setBlockedPositions(prev => [...prev, prevIdToBlock!]);
        }
      }
    }, 4000);
    timeoutRefs.current.push(timeout4s);

    // 4. AT 6000ms: FINISH ROLL
    const timeout6s = setTimeout(() => {
      setIsRolling(false);
    }, 6000);
    timeoutRefs.current.push(timeout6s);
  };

  // Switch Box views with L and R wrap around functions
  const handlePrevBox = () => {
    const total = activeTab === 'special' ? totalSpecialBoxes : totalBoxes;
    setCurrentBoxView(prev => (prev > 1 ? prev - 1 : total));
  };

  const handleNextBox = () => {
    const total = activeTab === 'special' ? totalSpecialBoxes : totalBoxes;
    setCurrentBoxView(prev => (prev < total ? prev + 1 : 1));
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

          if (validatedBlocks.length > 0 && user) {
            const { error: upsertErr } = await supabase
              .from('blocked_positions')
              .upsert(validatedBlocks, { onConflict: 'user_id,box,row,col', ignoreDuplicates: true });

            if (upsertErr) throw upsertErr;
          }

          // Merge loaded blocks with current local state
          const merged = Array.from(new Set([...blockedPositions, ...validatedIds]));
          setBlockedPositions(merged);
          setSuccessMsg('Bloqueos importados y sincronizados correctamente');
          setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err: any) {
          setError('Error al importar JSON: ' + err.message);
        } finally {
          e.target.value = '';
        }
      };
    }
  };

  // Auth loading spinner UI (Modern SV styling)
  if (authLoading) {
    return (
      <div className="sv-screen flex flex-col items-center justify-center p-6 text-white">
        <div className="sv-aura" />
        <div className="text-center z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white font-semibold text-lg uppercase tracking-widest animate-pulse">Cargando Cajas de Pokémon...</p>
        </div>
      </div>
    );
  }

  // Not authenticated UI (Pokémon SV login screen design)
  if (!user) {
    return (
      <div className="sv-screen flex flex-col items-center justify-center p-6 text-white">
        <div className="sv-aura" />

        <header className="mb-8 text-center max-w-lg z-10">
          <h1 className="text-4xl font-extrabold tracking-wide uppercase text-white drop-shadow-lg">
            Pokémon Box Randomizer
          </h1>
          <p className="text-violet-200 mt-2 text-xs font-bold uppercase tracking-widest">
            Sistema de Cajas Cloud
          </p>
        </header>

        <div className="w-full max-w-md sv-panel p-8 z-10 border border-white/10 shadow-2xl relative">
          <h2 className="text-2xl font-bold mb-6 text-center uppercase tracking-wider text-white">
            {isSignUp ? 'Crear Entrenador ID' : 'Iniciar Sesión'}
          </h2>

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-violet-200 uppercase tracking-widest">Correo Electrónico:</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-zinc-900/40 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-400 font-sans text-sm placeholder-violet-300/30"
                placeholder="entrenador@pallet.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-violet-200 uppercase tracking-widest">Contraseña:</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-zinc-900/40 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-400 font-sans text-sm placeholder-violet-300/30"
                placeholder="********"
              />
            </div>

            <button
              type="submit"
              className="mt-4 w-full cursor-pointer sv-btn sv-btn-action font-black py-3 px-6 rounded-xl transition duration-200 uppercase tracking-widest text-sm active:scale-98"
            >
              {isSignUp ? 'Registrar' : 'Acceder'}
            </button>
          </form>

          <div className="mt-6 text-center border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-xs text-violet-200 hover:underline hover:text-white font-bold uppercase tracking-wider cursor-pointer"
            >
              {isSignUp ? '¿Ya tienes una cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-900/40 border border-red-500/30 rounded-lg text-center text-red-200 font-medium text-xs font-sans">
              ⚠️ ERROR: {error}
            </div>
          )}

          {successMsg && (
            <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-center text-emerald-200 font-medium text-xs font-sans">
              ✔️ {successMsg}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Logged in main dashboard UI (Pokémon Scarlet/Violet boxes layout emulation)
  return (
    <div className="sv-screen flex flex-col justify-between min-h-screen">
      <div className="sv-aura" />

      {/* Top Console Tabs Header */}
      <div className="w-full z-10">
        <div className="sv-tab-bar">
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleTabChange('normal')}
            onKeyDown={(e) => e.key === 'Enter' && handleTabChange('normal')}
            className={`sv-tab ${activeTab === 'normal' ? 'active' : ''} outline-none select-none`}
          >
            Cajas Normales
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleTabChange('special')}
            onKeyDown={(e) => e.key === 'Enter' && handleTabChange('special')}
            className={`sv-tab ${activeTab === 'special' ? 'active' : ''} outline-none select-none`}
          >
            Cajas Especiales
          </div>
        </div>
      </div>

      {/* Main Grid & Setup Panel */}
      <main className="w-full max-w-6xl mx-auto px-6 py-4 flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 items-start z-10">

        {/* Left Column: Styled as the SV "Current Party" sidebar slots */}
        <div className="flex flex-col gap-3">
          <div className="px-3 py-1 bg-zinc-950/40 border border-white/10 rounded-full text-xs font-bold tracking-widest text-violet-200 flex items-center justify-between">
            <span>🔴 ENTRENADOR ACTIVO</span>
            <span className="text-white drop-shadow-sm font-black uppercase text-[10px]">PC SYSTEM v3</span>
          </div>

          {/* Slot 1: Active user session */}
          <div className="sv-party-slot p-4 flex flex-col gap-2 relative overflow-hidden">
            <span className="text-[10px] font-black text-violet-300 uppercase tracking-widest block">Usuario Logueado</span>
            <div className="text-sm font-bold truncate pr-8">{user.email}</div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="mt-2 text-left self-start text-[10px] font-black uppercase text-red-300 border border-red-500/20 bg-red-950/20 px-2.5 py-1 rounded hover:bg-red-900/30 transition-colors cursor-pointer"
            >
              Cerrar Sesión
            </button>
          </div>

          {/* Slot 2: Config - Number of boxes */}
          <div className="sv-party-slot p-4 flex flex-col gap-1">
            <span className="text-[10px] font-black text-violet-300 uppercase tracking-widest block">
              {activeTab === 'special' ? 'Total Cajas Especiales' : 'Total de Cajas'}
            </span>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="number"
                min={1}
                value={activeTab === 'special' ? totalSpecialBoxes : totalBoxes}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  if (activeTab === 'special') {
                    handleTotalSpecialBoxesChange(val);
                  } else {
                    handleTotalBoxesChange(val);
                  }
                }}
                className="w-full bg-zinc-950/40 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-400 font-bold"
              />
            </div>
          </div>

          {/* Slot 3: Result of the Randomizer roll */}
          <div className="sv-party-slot p-4 flex flex-col gap-1">
            <span className="text-[10px] font-black text-violet-300 uppercase tracking-widest block font-sans">Selección Segura</span>
            <button
              onClick={handleRoll}
              disabled={isRolling}
              className={`w-full cursor-pointer sv-btn sv-btn-action font-black py-3 px-4 rounded-xl transition duration-200 uppercase tracking-widest text-sm text-[12px] active:scale-98 mt-1 ${isRolling ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isRolling ? 'SORTEANDO...' : 'GENERAR TIRADA'}
            </button>

            {result ? (
              <div className="mt-3 p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-lg text-center">
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block">Resultado Obtenido</span>
                <span className="text-base font-black text-emerald-300 mt-1 block">
                  {result.tab === 'special'
                    ? `${specialBoxNames[result.box] ?? `Caja Especial ${result.box}`} ➔ F. ${result.row + 1}, C. ${result.col + 1}`
                    : `Caja ${result.box} ➔ F. ${result.row + 1}, C. ${result.col + 1}`}
                </span>
              </div>
            ) : (
              <div className="mt-3 p-3 bg-zinc-950/20 border border-dashed border-white/10 rounded-lg text-center text-[10px] text-violet-300 font-medium">
                Sin tirada activa
              </div>
            )}
          </div>

          {/* Slot 4: Backups & File Uploads (Import/Export) */}
          <div className="sv-party-slot p-4 flex flex-col gap-3">
            <span className="text-[10px] font-black text-violet-300 uppercase tracking-widest block">Copias de Seguridad (JSON)</span>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={handleExportJSON}
                className="w-full cursor-pointer bg-zinc-950/40 hover:bg-zinc-900/40 text-[10px] font-black uppercase text-violet-200 border border-white/10 py-2 rounded-lg transition-colors"
              >
                💾 Exportar
              </button>
              <label className="w-full cursor-pointer bg-zinc-950/40 hover:bg-zinc-900/40 text-[10px] font-black uppercase text-violet-200 border border-white/10 py-2 rounded-lg transition-colors text-center block">
                📂 Importar
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
              <span className="text-[10px] font-black text-violet-300 uppercase tracking-widest block">Volumen</span>
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="text-violet-300 hover:text-white transition-colors cursor-pointer"
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
              className="w-full accent-violet-500 cursor-pointer"
            />
          </div>          {/* Notifications and errors */}
          {error && (
            <div className="p-3 bg-red-950/30 border border-red-500/20 rounded-xl text-center text-red-200 font-bold text-xs">
              ⚠️ {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl text-center text-emerald-200 font-bold text-xs">
              ✔️ {successMsg}
            </div>
          )}
        </div>

        {/* Center / Right Column: Emulates the SV PC Box grid layout */}
        <div className={`lg:col-span-2 sv-panel p-6 flex flex-col gap-4 ${activeTab === 'special' ? 'sv-panel-special' : ''}`}>

          {/* SV Header navigation style for Boxes */}
          <div className={`flex justify-between items-center bg-zinc-950/20 p-2 rounded-xl border border-white/5 ${activeTab === 'special' ? 'sv-header-special' : ''}`}>
            <button
              onClick={handlePrevBox}
              className="w-14 h-9 sv-btn cursor-pointer rounded-2xl flex items-center justify-center pr-[2px]"
            >
              <BiSolidLeftArrow size={20} />
            </button>
            <div className="text-lg font-black tracking-wide text-white drop-shadow flex justify-center items-center">
              {activeTab === 'special' ? (
                <input
                  type="text"
                  value={specialBoxNames[currentBoxView] ?? `Caja Especial ${currentBoxView}`}
                  onChange={(e) => handleSpecialBoxNameChange(currentBoxView, e.target.value)}
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
            💡 Haz clic en un huevo para bloquearlo o desbloquearlo de la tirada.
          </div>
        </div>
      </main>


    </div>
  );
}