import { BiError, BiCheckCircle } from 'react-icons/bi';
import { useGameState } from '../hooks/useGameState';

interface Props {
  state: ReturnType<typeof useGameState>;
}

export function AuthScreen({ state }: Props) {
  const {
    email, setEmail, password, setPassword,
    isSignUp, setIsSignUp, handleAuth, error, setError,
    successMsg, setSuccessMsg
  } = state;

  return (
    <div className="sv-screen flex flex-col items-center justify-center p-6 text-white">
      <div className="sv-aura" />

      <header className="mb-8 text-center max-w-lg z-10">
        <h1 className="text-4xl font-extrabold tracking-wide uppercase text-white drop-shadow-lg">
          EGGLOCKE PICKER
        </h1>
        <p className="text-violet-200 mt-2 text-xs font-bold uppercase tracking-widest">
          Herramienta para seleccionar huevos aleatorios
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
              className="bg-zinc-900/40 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-sm placeholder-violet-300/30"
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
              className="bg-zinc-900/40 border border-white/10 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-sm placeholder-violet-300/30"
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
          <div className="mt-4 p-3 bg-red-900/40 border border-red-500/30 rounded-lg text-center text-red-200 font-medium text-xs flex items-center justify-center gap-1.5">
            <BiError size={16} /> ERROR: {error}
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-center text-emerald-200 font-medium text-xs flex items-center justify-center gap-1.5">
            <BiCheckCircle size={16} /> {successMsg}
          </div>
        )}
      </div>
    </div>
  );
}
