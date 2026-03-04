// localStorage utilities for russAbbot
// Handles persistence of auth sessions, settings, and session tracking

import type {
  AuthSession,
  Settings,
  Session,
} from '../types';
import { STORAGE_KEYS } from '../types';

/**
 * Generic localStorage helpers with JSON serialization
 */
function getItem<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return null;
    return JSON.parse(item) as T;
  } catch {
    console.error(`Failed to parse localStorage key: ${key}`);
    return null;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save to localStorage key: ${key}`, error);
  }
}

function removeItem(key: string): void {
  localStorage.removeItem(key);
}

/**
 * Auth Session Storage
 * Stores the user's ATProtocol authentication session
 */
export function saveAuthSession(session: AuthSession): void {
  setItem(STORAGE_KEYS.SESSION, session);
}

export function loadAuthSession(): AuthSession | null {
  return getItem<AuthSession>(STORAGE_KEYS.SESSION);
}

export function clearAuthSession(): void {
  removeItem(STORAGE_KEYS.SESSION);
}

/**
 * Settings Storage
 * Stores user-configurable settings (feed, journal, LLM)
 */
export function saveSettings(settings: Settings): void {
  setItem(STORAGE_KEYS.SETTINGS, settings);
}

export function loadSettings(): Settings | null {
  return getItem<Settings>(STORAGE_KEYS.SETTINGS);
}

export function clearSettings(): void {
  removeItem(STORAGE_KEYS.SETTINGS);
}

/**
 * Current Session Tracking Storage
 * Stores the active browsing session metrics
 */
export function saveCurrentSession(session: Session): void {
  setItem(STORAGE_KEYS.CURRENT_SESSION, session);
}

export function loadCurrentSession(): Session | null {
  return getItem<Session>(STORAGE_KEYS.CURRENT_SESSION);
}

export function clearCurrentSession(): void {
  removeItem(STORAGE_KEYS.CURRENT_SESSION);
}

/**
 * Session History Storage
 * Stores array of completed sessions
 */
export function saveSessions(sessions: Session[]): void {
  setItem(STORAGE_KEYS.SESSIONS, sessions);
}

export function loadSessions(): Session[] {
  return getItem<Session[]>(STORAGE_KEYS.SESSIONS) ?? [];
}

export function clearSessions(): void {
  removeItem(STORAGE_KEYS.SESSIONS);
}

export function addSession(session: Session): void {
  const sessions = loadSessions();
  sessions.push(session);
  saveSessions(sessions);
}

/**
 * Clear all russAbbot data from localStorage
 */
export function clearAllStorage(): void {
  clearAuthSession();
  clearSettings();
  clearCurrentSession();
  clearSessions();
}
