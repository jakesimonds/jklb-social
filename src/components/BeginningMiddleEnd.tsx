/**
 * BeginningMiddleEnd - Phase indicator component for the top bar.
 *
 * 4 perimeter cells wide, shows the current app phase:
 * - Beginning: "Beginning" / "(your notifications)"
 * - Middle: "Middle" / "(create notifications for others)"
 * - End: "End" / "(before you go)"
 */

interface BeginningMiddleEndProps {
  phase: 'beginning' | 'middle' | 'end';
}

const PHASE_DISPLAY: Record<string, { title: string; subtitle: string; accent: string }> = {
  beginning: {
    title: 'Beginning',
    subtitle: '(your notifications)',
    accent: 'var(--memphis-cyan)',  // blue like k
  },
  middle: {
    title: 'Middle',
    subtitle: '(create notifications for others)',
    accent: 'var(--memphis-pink)',  // pink like l
  },
  end: {
    title: 'End',
    subtitle: '(before you go)',
    accent: 'var(--memphis-yellow)',  // yellow like b
  },
};

export function BeginningMiddleEnd({ phase }: BeginningMiddleEndProps) {
  const display = PHASE_DISPLAY[phase];

  return (
    <div
      className="bme-indicator flex items-center justify-center flex-shrink-0 border-2 bg-[var(--memphis-bg)] px-3"
      style={{ width: `${4 * 72 + 3 * 4}px`, height: '72px', borderColor: display.accent, borderRadius: 'var(--card-radius)' }}
    >
      <div className="text-center">
        {display.title && (
          <div
            className="text-xl font-bold leading-tight"
            style={{ color: display.accent }}
          >
            {display.title}
          </div>
        )}
        <div
          className="text-xs leading-tight max-w-full"
          style={{ color: display.accent, opacity: 0.7 }}
        >
          {display.subtitle}
        </div>
      </div>
    </div>
  );
}
