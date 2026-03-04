/**
 * HotkeyTooltip - Styled tooltip for hotkey buttons
 *
 * Created as part of TASK-RALPH-31-01.
 * Displays on mouse hover over hotkey buttons (jklb, etc.).
 * Styled like ProfileHover (Memphis design: navy bg, cyan border).
 *
 * Shows:
 * - The hotkey key (e.g., "j")
 * - Description of what the hotkey does
 */

import { calculateHoverPosition } from './ProfileHover';

export interface HotkeyTooltipData {
  key: string;
  description: string;
}

/** Card dimensions for positioning calculations */
export const HOTKEY_TOOLTIP_WIDTH = 200;
export const HOTKEY_TOOLTIP_HEIGHT = 60;

export interface HotkeyTooltipProps {
  /** Hotkey data to display */
  hotkey: HotkeyTooltipData;
  /** Whether the tooltip is visible */
  isVisible: boolean;
  /** Position style (top, left) - applied to wrapper */
  style?: React.CSSProperties;
  /** Additional className for positioning */
  className?: string;
}

/**
 * Calculate optimal position for the hotkey tooltip.
 * Uses the shared calculateHoverPosition utility.
 */
export function calculateTooltipPosition(triggerRect: DOMRect): { top: number; left: number } {
  return calculateHoverPosition(triggerRect, {
    cardWidth: HOTKEY_TOOLTIP_WIDTH,
    cardHeight: HOTKEY_TOOLTIP_HEIGHT,
    offset: 8,
    padding: 10,
  });
}

/**
 * HotkeyTooltip component
 * A compact tooltip showing hotkey and description
 */
export function HotkeyTooltip({
  hotkey,
  isVisible,
  style,
  className = '',
}: HotkeyTooltipProps) {
  if (!isVisible) return null;

  return (
    <div
      className={`
        absolute z-50
        bg-[var(--memphis-navy)] border-2 border-[var(--memphis-cyan)]
        rounded-lg px-3 py-2 shadow-lg
        animate-fade-in
        ${className}
      `}
      style={style}
      role="tooltip"
      aria-label={`${hotkey.key}: ${hotkey.description}`}
    >
      <div className="flex items-center gap-2">
        {/* Hotkey key */}
        <kbd className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 bg-[var(--memphis-bg)] border border-[var(--memphis-border)] rounded-md text-sm font-mono text-[var(--memphis-cyan)] shadow-sm">
          {hotkey.key}
        </kbd>
        {/* Description */}
        <span className="text-sm text-[var(--memphis-text)] whitespace-nowrap">
          {hotkey.description}
        </span>
      </div>
    </div>
  );
}
