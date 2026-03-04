// In-memory action log for undo functionality
// Tracks last 10 user actions (likes, boosts, replies, quotes)
// Resets on app close or logout — no persistence needed

import { useState, useCallback } from 'react';
import type { UndoableAction } from '../lib/types';

const MAX_ACTIONS = 10;

export function useActionLog() {
  const [actions, setActions] = useState<UndoableAction[]>([]);

  const logAction = useCallback((action: Omit<UndoableAction, 'id' | 'timestamp'>) => {
    const entry: UndoableAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    setActions(prev => [entry, ...prev].slice(0, MAX_ACTIONS));
  }, []);

  const removeAction = useCallback((id: string) => {
    setActions(prev => prev.filter(a => a.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setActions([]);
  }, []);

  return { actions, logAction, removeAction, clearAll };
}
