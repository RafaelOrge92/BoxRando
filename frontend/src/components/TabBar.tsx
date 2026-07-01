import { useRef, useEffect } from 'react';
import { BiSolidUser, BiLogOut, BiCog } from 'react-icons/bi';
import { supabase } from '../supabaseClient';
import { useGameState } from '../hooks/useGameState';

interface Props {
  state: ReturnType<typeof useGameState>;
}

export function TabBar({ state }: Props) {
  const { 
    activeTab, handleTabChange,
    username, handleUsernameChange,
    profileImageUrl, handleProfileImageChange,
    isUserSettingsOpen, setIsUserSettingsOpen
  } = state;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserSettingsOpen(false);
      }
    };
    if (isUserSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserSettingsOpen, setIsUserSettingsOpen]);

  return (
    <div className="w-full z-20 sv-tab-bar-wrapper">
      <div className="w-full max-w-[1126px] mx-auto flex justify-between items-end px-4 sm:px-8">
        
        <div className="sv-tab-bar !px-0 !mx-0 !max-w-none">
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

        {/* User Settings Dropdown */}
        <div ref={dropdownRef} className="relative pb-2 flex items-center gap-3 mb-0.5">
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-white drop-shadow-sm font-black uppercase text-xs">
              {username ? username : <><span className="lowercase text-[1.45em] font-normal" style={{ fontFamily: '"Times New Roman", Times, serif' }}>π</span>rola</>}
            </span>
            <span className="text-[10px] text-[var(--sv-accent-yellow)] font-bold tracking-widest uppercase">Entrenador Activo</span>
          </div>
          
          <button 
            onClick={() => setIsUserSettingsOpen(!isUserSettingsOpen)}
            className="w-10 h-10 rounded-full border-2 border-white/20 bg-[#2d2452] flex items-center justify-center overflow-hidden cursor-pointer hover:border-[var(--sv-accent-yellow)] transition-colors shadow-lg"
          >
            {profileImageUrl ? (
              <img src={profileImageUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <BiSolidUser size={20} className="text-white/50" />
            )}
          </button>

          {isUserSettingsOpen && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-[#4c3f75] border border-white/20 rounded-xl shadow-2xl p-4 flex flex-col gap-4 z-50 animate-in fade-in zoom-in duration-200">
              <h4 className="text-white font-black uppercase text-sm border-b border-white/10 pb-2 flex items-center gap-2">
                <BiCog size={16} className="text-violet-300" /> Ajustes de Entrenador
              </h4>
              
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">Nickname</span>
                <input
                  type="text"
                  maxLength={9}
                  defaultValue={username}
                  onBlur={(e) => handleUsernameChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                       handleUsernameChange(e.currentTarget.value);
                       setIsUserSettingsOpen(false);
                    }
                  }}
                  className="bg-zinc-950/60 border border-violet-500/50 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-400 w-full transition-shadow"
                  placeholder="Tu Nickname..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">URL de Avatar (Local)</span>
                <input
                  type="text"
                  defaultValue={profileImageUrl}
                  onChange={(e) => {
                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
                    timeoutRef.current = setTimeout(() => {
                      handleProfileImageChange(e.target.value);
                    }, 250);
                  }}
                  onBlur={(e) => handleProfileImageChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                       if (timeoutRef.current) clearTimeout(timeoutRef.current);
                       handleProfileImageChange(e.currentTarget.value);
                       setIsUserSettingsOpen(false);
                    }
                  }}
                  className="bg-zinc-950/60 border border-violet-500/50 rounded-lg px-3 py-2 text-sm font-normal text-white focus:outline-none focus:ring-2 focus:ring-violet-400 w-full transition-shadow"
                  placeholder="https://..."
                />
                <span className="text-[10px] text-zinc-400 leading-tight">Esta URL se guarda solo en tu navegador para evitar almacenar imágenes en la base de datos.</span>
              </div>

              <button
                onClick={() => {
                  supabase.auth.signOut();
                }}
                className="mt-2 text-center text-xs font-black uppercase text-red-300 border border-red-500/20 bg-red-950/40 px-2.5 py-2.5 rounded-lg hover:bg-red-900/60 transition-colors flex items-center justify-center gap-2 cursor-pointer w-full"
              >
                <BiLogOut size={16} /> Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
