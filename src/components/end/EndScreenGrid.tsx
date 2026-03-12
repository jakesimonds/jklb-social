/**
 * EndScreenGrid — 3x3 button grid for the End Screen.
 *
 * 9 buttons: 7 original + Active Award + Trophy Case (dynamic based on trophy state).
 * Keyboard navigation via highlightedIndex prop.
 * Mouse hover syncs highlight via onHoverButton callback.
 */
import { EndButton } from './EndButton';

export interface EndButtonConfig {
  id: string;
  title: string;
  description: string;
  accentColor?: string;
  isEmpty?: boolean;
  disabled?: boolean;
}

interface TrophyState {
  hasParticipationTrophy: boolean;
  hasTrophies: boolean;
}

/** Build the 3x3 button array, with the last two slots dynamic based on trophy state */
export function getEndButtons(trophyState: TrophyState): EndButtonConfig[] {
  const activeAward: EndButtonConfig = trophyState.hasParticipationTrophy
    ? { id: 'active-award', title: 'Give an award: nominate the Best Thing I Saw', description: 'award your favorite post from this session' }
    : { id: 'active-award', title: 'Receive an award: claim your participation trophy', description: 'writes a record to your PDS — join the community' };

  const trophyCase: EndButtonConfig = trophyState.hasTrophies
    ? { id: 'trophy-case', title: 'Trophy Case', description: 'view your trophies and give awards' }
    : { id: 'trophy-case', title: 'Trophy Case', description: 'earn awards and they\'ll appear here', disabled: true };

  return [
    { id: 'stats',      title: 'Stats',                 description: 'see your session numbers' },
    { id: 'atmosphere', title: 'Atmosphere Report',      description: 'scan the network around you' },
    { id: 'clipboard',  title: "Copy '?' posts",         description: 'hotkey ? copies posts so you can ask an LLM about them' },
    { id: 'another',    title: 'Another Session',        description: 'start fresh from the beginning' },
    { id: 'logout',     title: 'Log Out',                description: 'end your session' },
    { id: 'glitch',     title: 'Glitch a JPEG',          description: 'edit HEX values, make art' },
    { id: 'plyr',       title: 'Check out plyr.fm',      description: 'listen to your plyr.fm likes while you scroll JKLB' },
    activeAward,
    trophyCase,
  ];
}

interface EndScreenGridProps {
  onSelectButton: (id: string) => void;
  onHoverButton: (index: number | null) => void;
  highlightedIndex: number | null;
  trophyState: TrophyState;
}

export function EndScreenGrid({ onSelectButton, onHoverButton, highlightedIndex, trophyState }: EndScreenGridProps) {
  const buttons = getEndButtons(trophyState);

  return (
    <div
      className="w-full h-full overflow-auto flex items-center justify-center p-6"
      onMouseLeave={() => onHoverButton(null)}
    >
      <div
        className="grid grid-cols-3 gap-3"
        style={{ minWidth: 480, minHeight: 480, maxWidth: 600 }}
      >
        {buttons.map((btn, i) => (
          <EndButton
            key={btn.id}
            title={btn.title}
            description={btn.description}
            onClick={() => !btn.isEmpty && !btn.disabled && onSelectButton(btn.id)}
            accentColor={'accentColor' in btn ? btn.accentColor : undefined}
            isHighlighted={highlightedIndex === i}
            isEmpty={btn.isEmpty ?? false}
            disabled={btn.disabled ?? false}
            onMouseEnter={() => !btn.isEmpty && !btn.disabled && onHoverButton(i)}
          />
        ))}
      </div>
    </div>
  );
}
