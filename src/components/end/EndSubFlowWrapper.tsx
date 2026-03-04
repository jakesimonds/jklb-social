/**
 * EndSubFlowWrapper — Shared wrapper for End screen sub-flows.
 *
 * Provides a consistent "back to end menu" button at the top,
 * giving users a clear escape hatch from any sub-flow.
 */

interface EndSubFlowWrapperProps {
  onBack: () => void;
  children: React.ReactNode;
}

export function EndSubFlowWrapper({ onBack, children }: EndSubFlowWrapperProps) {
  return (
    <div className="flex flex-col h-full">
      <button
        onClick={onBack}
        className="text-xs cursor-pointer transition-colors hover:text-white self-start mb-3 ml-3 mt-2"
        style={{ color: 'var(--memphis-text-muted)' }}
      >
        ← back to end menu
      </button>
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
}
