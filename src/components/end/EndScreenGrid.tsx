/**
 * EndScreenGrid — 3x3 button grid for the End Screen.
 *
 * 6 active buttons + 3 empty placeholder slots.
 * Keyboard navigation via highlightedIndex prop.
 * Mouse hover syncs highlight via onHoverButton callback.
 */
import { EndButton } from './EndButton';

interface EndButtonConfig {
  id: string;
  title: string;
  description: string;
  accentColor?: string;
  isEmpty?: boolean;
}

const END_BUTTONS: EndButtonConfig[] = [
  { id: 'award',      title: 'JKLB Award Nomination', description: 'pick and share your favorite post', accentColor: 'var(--memphis-yellow)' },
  { id: 'stats',      title: 'Stats',                 description: 'see your session numbers' },
  { id: 'atmosphere', title: 'Atmosphere Report',      description: 'scan the network around you' },
  { id: 'clipboard',  title: "Copy '?' posts",         description: 'hotkey ? copies posts so you can ask an LLM about them' },
  { id: 'another',    title: 'Another Session',        description: 'start fresh from the beginning' },
  { id: 'logout',     title: 'Log Out',                description: 'end your session' },
  { id: 'empty1',     title: '', description: '', isEmpty: true },
  { id: 'empty2',     title: '', description: '', isEmpty: true },
  { id: 'empty3',     title: '', description: '', isEmpty: true },
];

export { END_BUTTONS };

interface EndScreenGridProps {
  onSelectButton: (id: string) => void;
  onHoverButton: (index: number | null) => void;
  highlightedIndex: number | null;
}

export function EndScreenGrid({ onSelectButton, onHoverButton, highlightedIndex }: EndScreenGridProps) {
  return (
    <div
      className="w-full h-full overflow-auto flex items-center justify-center p-6"
      onMouseLeave={() => onHoverButton(null)}
    >
      <div
        className="grid grid-cols-3 gap-3"
        style={{ minWidth: 480, minHeight: 480, maxWidth: 600 }}
      >
        {END_BUTTONS.map((btn, i) => (
          <EndButton
            key={btn.id}
            title={btn.title}
            description={btn.description}
            onClick={() => !btn.isEmpty && onSelectButton(btn.id)}
            accentColor={'accentColor' in btn ? btn.accentColor : undefined}
            isHighlighted={highlightedIndex === i}
            isEmpty={btn.isEmpty ?? false}
            onMouseEnter={() => !btn.isEmpty && onHoverButton(i)}
          />
        ))}
      </div>
    </div>
  );
}
