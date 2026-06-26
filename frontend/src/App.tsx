import { useGameState } from './hooks/useGameState';
import { AuthScreen } from './components/AuthScreen';
import { TabBar } from './components/TabBar';
import { Sidebar } from './components/Sidebar';
import { GridPanel } from './components/GridPanel';
import './App.css';

export default function App() {
  const gameState = useGameState();

  // Auth loading spinner UI (Modern SV styling)
  if (gameState.authLoading) {
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
  if (!gameState.user) {
    return <AuthScreen state={gameState} />;
  }

  // Logged in main dashboard UI (Pokémon Scarlet/Violet boxes layout emulation)
  return (
    <div className="sv-screen flex flex-col justify-between min-h-screen">
      <div className="sv-aura" />

      {/* Top Console Tabs Header */}
      <TabBar state={gameState} />

      {/* Main Grid & Setup Panel */}
      <main className="w-full max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 lg:px-8 py-8 flex-grow grid grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr] gap-8 lg:gap-12 items-center z-10">
        <Sidebar state={gameState} />
        <GridPanel state={gameState} />
      </main>
    </div>
  );
}
