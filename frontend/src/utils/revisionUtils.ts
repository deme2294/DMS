import type { RevisionThreadItem } from '../types/article';

export function parseRevisionThread(raw?: string | null): RevisionThreadItem[] {
  if (!raw || typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fallback
    }
  }
  return [
    {
      id: 'legacy-entry',
      step: 'admin_revision',
      role: 'admin',
      roleLabel: 'Revision Directive',
      authorName: 'Reviewer',
      comment: trimmed,
      version: '1.0',
      createdAt: new Date().toISOString(),
    },
  ];
}

export function getLatestRevisionItem(raw?: string | null): RevisionThreadItem | null {
  const items = parseRevisionThread(raw);
  return items.length > 0 ? items[items.length - 1] : null;
}

export function getAdminRevisionDirective(raw?: string | null): RevisionThreadItem | null {
  const items = parseRevisionThread(raw);
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].step === 'admin_revision' || items[i].role === 'admin') {
      return items[i];
    }
  }
  return null;
}

export function getManagerRevisionDirective(raw?: string | null): RevisionThreadItem | null {
  const items = parseRevisionThread(raw);
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].step === 'manager_revision' || items[i].role === 'manager') {
      return items[i];
    }
  }
  return null;
}
