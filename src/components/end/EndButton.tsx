/**
 * EndButton — A card button for the End Screen grid.
 *
 * Shows title by default. On hover (or keyboard highlight),
 * the title fades out and a description fades in.
 */

interface EndButtonProps {
  title: string;
  description: string;
  onClick: () => void;
  /** Optional accent color — defaults to memphis-cyan */
  accentColor?: string;
  /** Whether this button is currently highlighted by keyboard navigation */
  isHighlighted?: boolean;
  /** True for empty/placeholder slots */
  isEmpty?: boolean;
  /** True to grey out and disable interaction */
  disabled?: boolean;
  onMouseEnter?: () => void;
}

export function EndButton({
  title,
  description,
  onClick,
  accentColor: _accentColor,
  isHighlighted = false,
  isEmpty = false,
  disabled = false,
  onMouseEnter,
}: EndButtonProps) {
  if (isEmpty) {
    return (
      <div
        className="flex items-center justify-center border border-dashed border-white/15 bg-[var(--memphis-bg)] cursor-default aspect-square"
        style={{ borderRadius: 'var(--card-radius)' }}
      >
        <span className="text-white/20 text-2xl select-none">+</span>
      </div>
    );
  }

  const showDescription = isHighlighted;

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={disabled ? undefined : onMouseEnter}
      disabled={disabled}
      className={`group relative flex items-center justify-center aspect-square overflow-hidden transition-all duration-200 focus:outline-none ${
        disabled
          ? 'cursor-default opacity-40 border border-dashed border-white/15'
          : isHighlighted
            ? 'cursor-pointer border-2 border-[var(--memphis-yellow)] shadow-[0_0_8px_#ffeb3b4d]'
            : 'cursor-pointer border border-[var(--memphis-border)] hover:border-white/30'
      }`}
      style={{
        backgroundColor: 'var(--memphis-bg)',
        borderRadius: 'var(--card-radius)',
      }}
    >
      {/* Title — visible by default, fades out on hover/highlight */}
      <span
        className={`absolute inset-0 flex items-center justify-center px-3 text-center text-sm font-bold text-white transition-opacity duration-200 ${
          showDescription
            ? 'opacity-0'
            : 'opacity-100 group-hover:opacity-0'
        }`}
      >
        {title}
      </span>

      {/* Description — hidden by default, fades in on hover/highlight */}
      <span
        className={`absolute inset-0 flex items-center justify-center px-3 text-center text-xs transition-opacity duration-200 ${
          showDescription
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100'
        }`}
        style={{ color: 'var(--memphis-text-muted)' }}
      >
        {description}
      </span>
    </button>
  );
}
