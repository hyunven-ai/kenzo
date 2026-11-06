/**
 * Draft Preserver Manager
 * State 8: Session expired -> Save their work before you sign them out
 */

const DRAFT_PREFIX = 'kenzo_unsaved_draft_';

export interface SavedDraft<T = any> {
  key: string;
  data: T;
  savedAt: string;
  title?: string;
}

export function saveDraft<T>(key: string, data: T, title?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: SavedDraft<T> = {
      key,
      data,
      savedAt: new Date().toISOString(),
      title,
    };
    localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to save draft:', e);
  }
}

export function getDraft<T>(key: string): SavedDraft<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as SavedDraft<T>;
  } catch {
    return null;
  }
}

export function hasDraft(key: string): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem(DRAFT_PREFIX + key));
}

export function clearDraft(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    // no-op
  }
}

