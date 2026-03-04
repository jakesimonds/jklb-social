/**
 * SunsetPage - Post-logout landing page
 *
 * Simple full-screen component with centered "jklb" logo.
 * Memphis styling with subtle animation.
 * Shows after user shares their award nomination and logs out.
 */

interface SunsetPageProps {
  onLogBackIn: () => void;
}

export function SunsetPage({ onLogBackIn }: SunsetPageProps) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--memphis-bg)]">
      {/* Centered logo with Memphis styling and subtle pulse animation */}
      <div className="text-center animate-pulse">
        <h1 className="text-6xl md:text-8xl font-bold tracking-widest">
          <span className="text-[var(--memphis-pink)]">j</span>
          <span className="text-[var(--memphis-cyan)]">k</span>
          <span className="text-[var(--memphis-yellow)]">l</span>
          <span className="text-[var(--memphis-pink)]">b</span>
        </h1>
      </div>

      {/* Decorative Memphis shapes */}
      <div className="absolute top-1/4 left-1/4 w-8 h-8 border-4 border-[var(--memphis-cyan)] rotate-45 opacity-30" />
      <div className="absolute bottom-1/3 right-1/4 w-6 h-6 bg-[var(--memphis-pink)] rounded-full opacity-30" />
      <div className="absolute top-1/3 right-1/3 w-4 h-4 bg-[var(--memphis-yellow)] opacity-30" />

      {/* Log back in link at bottom */}
      <button
        onClick={onLogBackIn}
        className="absolute bottom-12 text-sm text-[var(--memphis-text-muted)] hover:text-[var(--memphis-cyan)] transition-colors"
      >
        log back in
      </button>
    </div>
  );
}
