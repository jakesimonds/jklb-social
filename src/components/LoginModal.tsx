import { useState, useRef, useEffect, useCallback } from 'react';
import { useHandleTypeahead } from '../hooks/useHandleTypeahead';

interface LoginModalProps {
  onLogin: (handle: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * LoginModal - Handle-based login for ATProtocol
 *
 * Memphis aesthetic: navy background, pink/cyan/yellow accents
 * Includes debounced typeahead search for handle autocomplete
 */
export function LoginModal({ onLogin, isLoading = false, error = null }: LoginModalProps) {
  const [handle, setHandle] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    suggestions,
    showSuggestions,
    selectedIndex,
    setSelectedIndex,
    handleKeyDown: typeaheadKeyDown,
    selectSuggestion,
    clearSuggestions,
    onFocus,
  } = useHandleTypeahead(handle);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedHandle = handle.trim();
    if (trimmedHandle) {
      clearSuggestions();
      onLogin(trimmedHandle);
    }
  };

  const handleSelect = useCallback((suggestion: { handle: string }) => {
    setHandle(suggestion.handle);
    selectSuggestion(suggestion as Parameters<typeof selectSuggestion>[0]);
  }, [selectSuggestion]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const selected = typeaheadKeyDown(e);
    if (selected) {
      setHandle(selected.handle);
    }
  };

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        clearSuggestions();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clearSuggestions]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--memphis-navy)]">
      <div className="w-full max-w-md p-8">
        {/* Logo / Title */}
        <h1 className="text-4xl font-bold text-center mb-8 text-white">
          <span className="text-[#FF69B4]">j</span>
          <span className="text-[#00CED1]">k</span>
          <span className="text-[#FF69B4]">l</span>
          <span className="text-[#FFD700]">b</span>
        </h1>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div ref={containerRef} className="relative">
            <label
              htmlFor="handle"
              className="block text-sm font-medium text-[var(--memphis-yellow)] mb-2"
            >
              Enter your ATProto handle
            </label>
            <input
              type="text"
              id="handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={onFocus}
              placeholder="alice.bsky.social"
              disabled={isLoading}
              autoFocus
              autoComplete="off"
              data-testid="login-handle-input"
              className="w-full px-4 py-3 rounded-lg
                bg-white/10
                border-2 border-[var(--memphis-cyan)]
                text-white placeholder-white/50
                focus:outline-none focus:border-[var(--memphis-pink)] focus:ring-2 focus:ring-[var(--memphis-pink)]/50
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors"
            />

            {/* Typeahead Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-50 w-full mt-1 rounded-lg border-2 border-[var(--memphis-cyan)] bg-[var(--memphis-navy)] overflow-hidden shadow-lg shadow-black/50">
                {suggestions.map((actor, index) => (
                  <li key={actor.did}>
                    <button
                      type="button"
                      onClick={() => handleSelect(actor)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors
                        ${index === selectedIndex
                          ? 'bg-[var(--memphis-cyan)]/20 text-white'
                          : 'text-white/80 hover:bg-white/5'
                        }`}
                    >
                      {actor.avatar ? (
                        <img
                          src={actor.avatar}
                          alt=""
                          className="w-8 h-8 rounded-full flex-shrink-0 border border-white/20"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex-shrink-0 bg-white/10 border border-white/20" />
                      )}
                      <div className="min-w-0 flex-1">
                        {actor.displayName && (
                          <div className="text-sm font-medium truncate">{actor.displayName}</div>
                        )}
                        <div className="text-xs text-[var(--memphis-cyan)] truncate">@{actor.handle}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !handle.trim()}
            data-testid="login-submit-button"
            className="w-full py-3 px-4 rounded-lg font-semibold
              bg-[var(--memphis-pink)] text-white
              hover:bg-[var(--memphis-pink)]/80
              focus:outline-none focus:ring-2 focus:ring-[var(--memphis-yellow)] focus:ring-offset-2 focus:ring-offset-[var(--memphis-navy)]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
                Connecting...
              </span>
            ) : (
              'Log In'
            )}
          </button>
        </form>

        {/* Info Text */}
        <p className="mt-6 text-center text-white/50 text-xs">
          Alpha | ping @jakesimonds.com with any bugs/feedback thanks for trying it :)
        </p>
      </div>
    </div>
  );
}
