// UserWidget component for russAbbot
// A compact corner widget showing user avatar and logout
// Pinned to far-right of top bar

import { useAuth } from '../lib/AuthContext';

interface UserWidgetProps {
  className?: string;
  onLoginRequest?: () => void;
}

/**
 * UserWidget - Compact corner user widget
 *
 * Logged-in state: small avatar + logout icon (↩)
 * Not-logged-in state: "Try jklb" button that opens login
 *
 * Designed to be pinned to the far-right corner of the top bar
 */
export function UserWidget({ className = '', onLoginRequest }: UserWidgetProps) {
  const { isAuthenticated, profile, logout, isLoading } = useAuth();

  // Not logged in - show compact "Try" prompt
  if (!isAuthenticated) {
    return (
      <button
        onClick={onLoginRequest}
        disabled={isLoading}
        data-testid="login-try-button"
        className={`
          h-12 px-3 flex items-center justify-center gap-1
          border border-[var(--memphis-border)] rounded-md
          bg-[var(--memphis-bg)]
          hover:bg-[var(--memphis-pink)]/20 hover:border-[var(--memphis-pink)]/50
          transition-colors cursor-pointer
          disabled:opacity-50 disabled:cursor-not-allowed
          flex-shrink-0
          ${className}
        `}
        title="Log in to jklb"
      >
        {isLoading ? (
          <svg className="animate-spin h-4 w-4 text-[var(--memphis-cyan)]" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <span className="text-xs font-medium text-[var(--memphis-cyan)]">
            Log In
          </span>
        )}
      </button>
    );
  }

  // Logged in - compact: small avatar + logout icon
  return (
    <div
      className={`
        h-12 flex items-center gap-2 px-2
        border border-[var(--memphis-border)] rounded-md
        bg-[var(--memphis-bg)]
        flex-shrink-0
        ${className}
      `}
    >
      {/* Avatar (small) */}
      {profile?.avatar ? (
        <img
          src={profile.avatar}
          alt={profile.displayName || profile.handle}
          className="w-8 h-8 rounded-full border border-[var(--memphis-cyan)] flex-shrink-0"
          title={`@${profile?.handle || 'unknown'}`}
        />
      ) : (
        <div
          className="w-8 h-8 rounded-full border border-[var(--memphis-cyan)] bg-[var(--memphis-bg)] flex items-center justify-center flex-shrink-0"
          title={`@${profile?.handle || 'unknown'}`}
        >
          <span className="text-[var(--memphis-text-muted)] text-xs">
            {profile?.handle?.charAt(0)?.toUpperCase() || '?'}
          </span>
        </div>
      )}

      {/* Logout button */}
      <button
        onClick={logout}
        disabled={isLoading}
        className="
          w-6 h-6 flex items-center justify-center flex-shrink-0
          rounded text-sm
          hover:bg-[var(--memphis-pink)]/20
          transition-colors
          disabled:opacity-50
        "
        title="Logout"
        aria-label="Logout"
      >
        ↩
      </button>
    </div>
  );
}
