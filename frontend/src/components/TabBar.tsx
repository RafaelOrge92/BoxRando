import { useGameState } from '../hooks/useGameState';

interface Props {
  state: ReturnType<typeof useGameState>;
}

export function TabBar({ state }: Props) {
  const { activeTab, handleTabChange } = state;

  return (
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
  );
}
