/**
 * ComposeModal — Grid layout for composing new posts.
 *
 * Top section: bare-bones composer (ComposerPanel in 'new' mode)
 * Bottom row: 3 AT Proto ecosystem link buttons
 */

import { ComposerPanel } from '../ComposerPanel';

interface ComposeModalProps {
  onSubmit: (text: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

const COMPOSE_LINKS = [
  { title: 'Unthread', description: 'longer posts gracefully handled', url: 'https://unthread.at/' },
  { title: 'Bluesky', description: 'native composer', url: 'https://bsky.app/' },
  { title: 'Leaflet', description: 'start a blog', url: 'https://leaflet.pub/' },
] as const;

function ComposeLinkButton({ title, description, url }: { title: string; description: string; url: string }) {
  return (
    <button
      onClick={() => window.open(url, '_blank')}
      className="group relative flex items-center justify-center rounded border border-[var(--memphis-border)] hover:border-white/30 cursor-pointer aspect-square overflow-hidden transition-all duration-200 focus:outline-none"
      style={{ backgroundColor: 'var(--memphis-bg)' }}
    >
      {/* Title — visible by default, fades out on hover */}
      <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-sm font-bold text-white transition-opacity duration-200 opacity-100 group-hover:opacity-0">
        {title}
      </span>

      {/* Description — hidden by default, fades in on hover */}
      <span
        className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs transition-opacity duration-200 opacity-0 group-hover:opacity-100"
        style={{ color: 'var(--memphis-text-muted)' }}
      >
        {description}
      </span>
    </button>
  );
}

export function ComposeModal({ onSubmit, onCancel, isSubmitting }: ComposeModalProps) {
  return (
    <div className="w-full h-full overflow-auto flex items-center justify-center p-6">
      <div
        className="grid grid-cols-3 gap-3 w-full"
        style={{ minWidth: 480, maxWidth: 600 }}
      >
        {/* Composer area — spans all 3 columns, top 2/3 */}
        <div className="col-span-3 rounded border border-[var(--memphis-pink)]/40 bg-[var(--memphis-bg)] p-4">
          <h2 className="text-sm font-bold text-[var(--memphis-text)] mb-3 uppercase tracking-wider">
            compose
          </h2>
          <ComposerPanel
            mode="new"
            onSubmit={onSubmit}
            onCancel={onCancel}
            isSubmitting={isSubmitting}
          />
        </div>

        {/* Bottom row — AT Proto ecosystem links */}
        {COMPOSE_LINKS.map((link) => (
          <ComposeLinkButton key={link.title} {...link} />
        ))}
      </div>
    </div>
  );
}
