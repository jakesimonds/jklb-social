import { useCurator } from '../lib/CuratorContext';

interface CuratorIndicatorProps {
  onClick: () => void;
}

export function CuratorIndicator({ onClick }: CuratorIndicatorProps) {
  const { status } = useCurator();

  if (status === 'idle') return null;

  if (status === 'working') {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-full border-2 border-[var(--memphis-pink)] flex items-center justify-center"
          style={{ animation: 'curator-pulse 1.5s ease-in-out infinite' }}
        >
          <div className="w-3 h-3 rounded-full bg-[var(--memphis-pink)]" />
        </div>
        <span className="text-xs text-[var(--memphis-pink)] opacity-70">curating...</span>
        <style>{`
          @keyframes curator-pulse {
            0%, 100% { opacity: 0.4; transform: scale(0.95); }
            50% { opacity: 1; transform: scale(1.05); }
          }
        `}</style>
      </div>
    );
  }

  // status === 'ready'
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 left-4 z-50 w-10 h-10 rounded-full bg-green-500 hover:bg-green-400 flex items-center justify-center transition-colors cursor-pointer shadow-lg shadow-green-500/30"
      title="Your curated feed is ready — click to start"
    >
      <span className="text-white text-xl font-bold leading-none">✓</span>
    </button>
  );
}
