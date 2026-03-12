// PerimeterCell component for russAbbot
// A uniform 72x72 cell for the perimeter grid (top bar and right column)
// Can hold avatars, action buttons, or be empty
// Square tiles with slightly softened corners (matches notification grid)

import type { ReactNode, MouseEvent, CSSProperties } from 'react';

interface PerimeterCellProps {
  children?: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  style?: CSSProperties;
  title?: string;
  'aria-label'?: string;
}

export function PerimeterCell({
  children,
  onClick,
  className = '',
  style,
  title,
  'aria-label': ariaLabel,
}: PerimeterCellProps) {
  const isClickable = !!onClick;

  const baseClasses = `
    w-[72px] h-[72px] flex-shrink-0
    flex items-center justify-center
    transition-colors duration-150
  `;

  const baseStyle: CSSProperties = { borderRadius: 'var(--card-radius)', ...style };

  const hoverClasses = isClickable
    ? 'hover:bg-[var(--memphis-pink)]/10 hover:border-[var(--memphis-pink)]/50 cursor-pointer'
    : '';

  const combinedClasses = `${baseClasses} ${hoverClasses} ${className}`.trim();

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={combinedClasses}
        style={baseStyle}
        title={title}
        aria-label={ariaLabel || title}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={combinedClasses} style={baseStyle} title={title}>
      {children}
    </div>
  );
}
