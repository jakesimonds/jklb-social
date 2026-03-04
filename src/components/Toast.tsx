// Toast component for displaying notifications
// Supports different variants: error, success, info (default)

import { useEffect, type ReactNode } from 'react';

export type ToastVariant = 'info' | 'success' | 'error';

export interface ToastProps {
  /** The message to display */
  message: string;
  /** Visual variant of the toast */
  variant?: ToastVariant;
  /** Whether the toast is visible */
  isVisible: boolean;
  /** Callback when toast should be dismissed */
  onDismiss: () => void;
  /** Auto-dismiss duration in ms (default: 3000) */
  duration?: number;
}

/**
 * Get CSS classes for toast variant
 */
function getVariantClasses(variant: ToastVariant): string {
  switch (variant) {
    case 'error':
      return 'bg-[var(--memphis-pink)] text-white';
    case 'success':
      return 'bg-[var(--memphis-cyan)] text-[var(--memphis-bg)]';
    case 'info':
    default:
      return 'bg-[var(--memphis-yellow)] text-[var(--memphis-bg)]';
  }
}

/**
 * Get icon for toast variant
 */
function getVariantIcon(variant: ToastVariant): ReactNode {
  switch (variant) {
    case 'error':
      return (
        <svg
          className="w-5 h-5 mr-2 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case 'success':
      return (
        <svg
          className="w-5 h-5 mr-2 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg
          className="w-5 h-5 mr-2 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}

/**
 * Toast notification component
 * Displays a message with auto-dismiss functionality
 */
export function Toast({
  message,
  variant = 'info',
  isVisible,
  onDismiss,
  duration = 3000,
}: ToastProps) {
  // Auto-dismiss after duration
  useEffect(() => {
    if (!isVisible) return;

    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [isVisible, duration, onDismiss]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-up">
      <div
        className={`
          flex items-center
          px-4 py-3
          rounded-lg shadow-lg
          font-medium
          max-w-md
          ${getVariantClasses(variant)}
        `}
        role="alert"
      >
        {getVariantIcon(variant)}
        <span className="text-sm">{message}</span>
        <button
          onClick={onDismiss}
          className="ml-3 flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
