// Context provider for the action log — shared between index.tsx and settings.tsx
// Lives at the layout level so both screens can access it

import React, { createContext, useContext } from 'react';
import { useActionLog } from '../hooks/useActionLog';

type ActionLogContextType = ReturnType<typeof useActionLog>;

const ActionLogContext = createContext<ActionLogContextType | null>(null);

export function ActionLogProvider({ children }: { children: React.ReactNode }) {
  const actionLog = useActionLog();
  return (
    <ActionLogContext.Provider value={actionLog}>
      {children}
    </ActionLogContext.Provider>
  );
}

export function useActionLogContext(): ActionLogContextType {
  const ctx = useContext(ActionLogContext);
  if (!ctx) throw new Error('useActionLogContext must be used within ActionLogProvider');
  return ctx;
}
