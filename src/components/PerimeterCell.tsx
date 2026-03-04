// PerimeterCell component for russAbbot
// A uniform 72x72 cell for the perimeter grid (top bar and right column)
// Can hold avatars, action buttons, or be empty
// Square tiles with slightly softened corners (matches notification grid)

import type { ReactNode, MouseEvent } from 'react';

interface PerimeterCellProps {
  children?: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  title?: string;
  'aria-label'?: string;
}

export function PerimeterCell({
  children,
  onClick,
  className = '',
  title,
  'aria-label': ariaLabel,
}: PerimeterCellProps) {
  const isClickable = !!onClick;

  const baseClasses = `
    w-[72px] h-[72px] flex-shrink-0
    flex items-center justify-center
    rounded
    transition-colors duration-150
  `;

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
        title={title}
        aria-label={ariaLabel || title}
      >
        {children}
      </button>
    );
  }

  return (
    <div className={combinedClasses} title={title}>
      {children}
    </div>
  );
}
