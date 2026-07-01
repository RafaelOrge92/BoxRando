import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { SelectedPosition } from '../types';

export function useGameState() {
  // Auth state
  const [user, setUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [isEditingUsername, setIsEditingUsername] = useState<boolean>(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string>('');
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState<boolean>(false);

  // App state
  const [totalBoxes, setTotalBoxes] = useState<number | ''>(1);
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
  const [totalSpecialBoxes, setTotalSpecialBoxes] = useState<number | ''>(1);
  const [specialBoxNames, setSpecialBoxNames] = useState<Record<number, string>>({});

  const ROWS = 5;
  const COLS = 6;

  // Listen to Auth changes and load data accordingly
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadUserData(session.user.id);
      } else {
        setAuthLoading(false);
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
        setUsername('');
        setActiveTab('normal');
      }
    });

    // Load local profile image
    const savedImg = localStorage.getItem('boxrando_profile_img');
    if (savedImg) setProfileImageUrl(savedImg);

    return () => subscription.unsubscribe();
  }, []);

  // Audio & Animation cleanup
  useEffect(() => {
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
        .select('total_boxes, total_special_boxes, special_box_names, username')
        .eq('id', userId)
        .single();

      if (profileErr) {
        console.warn('Profile not found in database. The postgres trigger should create it shortly.', profileErr.message);
      } else if (profile) {
        setTotalBoxes(profile.total_boxes || 1);
        setTotalSpecialBoxes(profile.total_special_boxes || 1);
        setSpecialBoxNames(profile.special_box_names || {});
        setUsername(profile.username || '');
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

  const handleUnblockAll = async () => {
    if (!user) return;
    setError(null);
    try {
      const { error: deleteErr } = await supabase
        .from('blocked_positions')
        .delete()
        .eq('user_id', user.id);

      if (deleteErr) throw deleteErr;

      setBlockedPositions([]);
      setSuccessMsg('Todas las casillas han sido desbloqueadas');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError('Error al desbloquear casillas: ' + err.message);
    }
  };

  // Update total boxes in local state and profiles table in database
  const handleTotalBoxesChange = async (val: number | '') => {
    setTotalBoxes(val);
    if (val === '') return;
    
    if (val > 200) {
      val = 200;
      setTotalBoxes(200);
    }
    
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

  const handleTotalSpecialBoxesChange = async (val: number | '') => {
    setTotalSpecialBoxes(val);
    if (val === '') return;
    
    if (val > 200) {
      val = 200;
      setTotalSpecialBoxes(200);
    }
    
    if (currentBoxView > val) setCurrentBoxView(val);

    if (user) {
      setError(null);
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ total_special_boxes: val })
        .eq('id', user.id);

      if (updateErr) {
        setError('Error al guardar total de cajas especiales: ' + updateErr.message);
      }
    }
  };

  const handleSpecialBoxNameChange = (boxNum: number, name: string) => {
    setSpecialBoxNames(prev => ({
      ...prev,
      [boxNum]: name
    }));
  };

  const saveSpecialBoxNamesToDb = async () => {
    if (user) {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ special_box_names: specialBoxNames })
        .eq('id', user.id);

      if (updateErr) {
        console.warn('Error al guardar nombres de cajas especiales:', updateErr.message);
      }
    }
  };

  const handleUsernameChange = async (newName: string) => {
    const limitedName = newName.slice(0, 9);
    setUsername(limitedName);
    if (user) {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ username: limitedName })
        .eq('id', user.id);

      if (updateErr) {
        setError('Error al guardar nickname: ' + updateErr.message);
      }
    }
  };

  const handleProfileImageChange = (url: string) => {
    setProfileImageUrl(url);
    if (url) {
      localStorage.setItem('boxrando_profile_img', url);
    } else {
      localStorage.removeItem('boxrando_profile_img');
    }
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
    setResult(null);

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.warn('Audio play failed:', e));
    }

    let finalResult: SelectedPosition | null = null;
    let finalError: string | null = null;

    if (activeTab === 'special') {
      try {
        const dbBox = currentBoxView + 1000;
        const availableCells: { row: number; col: number }[] = [];
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const id = `${dbBox}-${r}-${c}`;
            if (!blockedPositions.includes(id)) {
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
          const rollResult = data[0];
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

    const getAvailableVisualCells = (boxNum: number) => {
      const dbBox = activeTab === 'special' ? boxNum + 1000 : boxNum;
      const cells: { row: number; col: number }[] = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const id = `${dbBox}-${r}-${c}`;
          if (!blockedPositions.includes(id)) {
            cells.push({ row: r, col: c });
          }
        }
      }
      return cells.length > 0 ? cells : [{ row: 0, col: 0 }];
    };

    intervalRef.current = setInterval(() => {
      let boxToAnimate = currentBoxView;
      if (activeTab === 'normal' && (totalBoxes as number) > 1) {
        boxToAnimate = Math.floor(Math.random() * (totalBoxes as number)) + 1;
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

    const timeout4s = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setAnimatingPosition(null);
      setResult(finalResult);

      if (finalResult) {
        setCurrentBoxView(finalResult.box);

        const dbBox = finalResult.tab === 'special' ? finalResult.box + 1000 : finalResult.box;
        const newIdToBlock = `${dbBox}-${finalResult.row}-${finalResult.col}`;
        
        if (!blockedPositions.includes(newIdToBlock)) {
          setBlockedPositions(prev => [...prev, newIdToBlock]);
          
          if (user) {
            supabase
              .from('blocked_positions')
              .insert({
                user_id: user.id,
                box: dbBox,
                row: finalResult.row,
                col: finalResult.col
              })
              .then(({ error: insertErr }) => {
                if (insertErr && insertErr.code !== '23505') {
                  console.warn('Error auto-blocking result:', insertErr.message);
                }
              });
          }
        }
      }
    }, 4000);
    timeoutRefs.current.push(timeout4s);

    const timeout6s = setTimeout(() => {
      setIsRolling(false);
    }, 6000);
    timeoutRefs.current.push(timeout6s);
  };

  const handlePrevBox = () => {
    const total = activeTab === 'special' ? totalSpecialBoxes : totalBoxes;
    setCurrentBoxView(prev => (prev > 1 ? prev - 1 : (total as number)));
  };

  const handleNextBox = () => {
    const total = activeTab === 'special' ? totalSpecialBoxes : totalBoxes;
    setCurrentBoxView(prev => (prev < (total as number) ? prev + 1 : 1));
  };

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
              username: 'πrola'
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

  const handleGoogleAuth = async () => {
    setError(null);
    setSuccessMsg(null);
    try {
      const { error: signInErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (signInErr) throw signInErr;
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleExportJSON = () => {
    try {
      const exportData = {
        metadata: {
          total_boxes: totalBoxes,
          total_special_boxes: totalSpecialBoxes,
          special_box_names: specialBoxNames,
        },
        blocks: blockedPositions.map(id => {
          const [box, row, col] = id.split('-').map(Number);
          return { box, row, col };
        })
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(exportData, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `boxrando_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      setError('Error al exportar JSON: ' + err.message);
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const fileInput = e.target;
    const fileReader = new FileReader();

    if (fileInput.files && fileInput.files[0]) {
      fileReader.readAsText(fileInput.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          let blocksToLoad = [];

          if (Array.isArray(parsed)) {
            blocksToLoad = parsed;
          } else if (parsed.blocks && Array.isArray(parsed.blocks)) {
            blocksToLoad = parsed.blocks;
            if (parsed.metadata && user) {
              const meta = parsed.metadata;
              const newTotal = meta.total_boxes || totalBoxes;
              const newSpecial = meta.total_special_boxes || totalSpecialBoxes;
              const newNames = meta.special_box_names || specialBoxNames;

              setTotalBoxes(newTotal);
              setTotalSpecialBoxes(newSpecial);
              setSpecialBoxNames(newNames);

              const { error: profileErr } = await supabase
                .from('profiles')
                .update({
                  total_boxes: newTotal,
                  total_special_boxes: newSpecial,
                  special_box_names: newNames
                })
                .eq('id', user.id);

              if (profileErr) console.warn('Error saving imported metadata', profileErr);
            }
          } else {
            throw new Error('Formato de archivo JSON inválido');
          }

          const validatedBlocks: { box: number; row: number; col: number; user_id: string }[] = [];
          const validatedIds: string[] = [];

          for (const item of blocksToLoad) {
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
            const { error: deleteErr } = await supabase
              .from('blocked_positions')
              .delete()
              .eq('user_id', user.id);
              
            if (deleteErr) throw deleteErr;

            if (validatedBlocks.length > 0) {
              const { error: insertErr } = await supabase
                .from('blocked_positions')
                .insert(validatedBlocks);

              if (insertErr) throw insertErr;
            }
          }

          setBlockedPositions(validatedIds);
          setSuccessMsg('Datos de sesión y bloqueos importados correctamente');
          setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err: any) {
          setError('Error al importar JSON: ' + err.message);
        } finally {
          fileInput.value = '';
        }
      };

      fileReader.onerror = () => {
        setError('Error al leer el archivo');
        fileInput.value = '';
      };
    } else {
      fileInput.value = '';
    }
  };

  return {
    user,
    authLoading,
    email,
    setEmail,
    password,
    setPassword,
    isSignUp,
    setIsSignUp,
    successMsg,
    setSuccessMsg,
    username,
    setUsername,
    isEditingUsername,
    setIsEditingUsername,
    profileImageUrl,
    isUserSettingsOpen,
    setIsUserSettingsOpen,
    totalBoxes,
    setTotalBoxes,
    currentBoxView,
    setCurrentBoxView,
    blockedPositions,
    setBlockedPositions,
    result,
    setResult,
    error,
    setError,
    isRolling,
    setIsRolling,
    animatingPosition,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    activeTab,
    setActiveTab,
    totalSpecialBoxes,
    setTotalSpecialBoxes,
    specialBoxNames,
    setSpecialBoxNames,
    ROWS,
    COLS,
    toggleBlockPosition,
    handleUnblockAll,
    handleTotalBoxesChange,
    handleTotalSpecialBoxesChange,
    handleSpecialBoxNameChange,
    saveSpecialBoxNamesToDb,
    handleUsernameChange,
    handleProfileImageChange,
    handleTabChange,
    handleRoll,
    handlePrevBox,
    handleNextBox,
    handleAuth,
    handleGoogleAuth,
    handleExportJSON,
    handleImportJSON
  };
}
