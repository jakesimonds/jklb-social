// AsyncStorage utilities for russAbbot mobile
// Adapted from src/lib/storage.ts — localStorage → AsyncStorage
// All functions are async since AsyncStorage is async

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Settings,
  Session,
} from './types';
import { STORAGE_KEYS } from './types';

/**
 * Generic AsyncStorage helpers with JSON serialization
 */
async function getItem<T>(key: string): Promise<T | null> {
  try {
    const item = await AsyncStorage.getItem(key);
    if (item === null) return null;
    return JSON.parse(item) as T;
  } catch {
    console.error(`Failed to parse AsyncStorage key: ${key}`);
    return null;
  }
}

async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save to AsyncStorage key: ${key}`, error);
  }
}

async function removeItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

/**
 * Settings Storage
 */
export async function saveSettings(settings: Settings): Promise<void> {
  await setItem(STORAGE_KEYS.SETTINGS, settings);
}

export async function loadSettings(): Promise<Settings | null> {
  return getItem<Settings>(STORAGE_KEYS.SETTINGS);
}

export async function clearSettings(): Promise<void> {
  await removeItem(STORAGE_KEYS.SETTINGS);
}

/**
 * Current Session Tracking Storage
 */
export async function saveCurrentSession(session: Session): Promise<void> {
  await setItem(STORAGE_KEYS.CURRENT_SESSION, session);
}

export async function loadCurrentSession(): Promise<Session | null> {
  return getItem<Session>(STORAGE_KEYS.CURRENT_SESSION);
}

export async function clearCurrentSession(): Promise<void> {
  await removeItem(STORAGE_KEYS.CURRENT_SESSION);
}

/**
 * Session History Storage
 */
export async function saveSessions(sessions: Session[]): Promise<void> {
  await setItem(STORAGE_KEYS.SESSIONS, sessions);
}

export async function loadSessions(): Promise<Session[]> {
  return (await getItem<Session[]>(STORAGE_KEYS.SESSIONS)) ?? [];
}

export async function clearSessions(): Promise<void> {
  await removeItem(STORAGE_KEYS.SESSIONS);
}

export async function addSession(session: Session): Promise<void> {
  const sessions = await loadSessions();
  sessions.push(session);
  await saveSessions(sessions);
}

/**
 * Clear all russAbbot data from AsyncStorage
 */
export async function clearAllStorage(): Promise<void> {
  await clearSettings();
  await clearCurrentSession();
  await clearSessions();
}
