export const normalizeAttachmentPath = (p?: string | null): string => {
  if (!p) return '';
  let normalized = p.replace(/\\/g, '/');
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const uploadsIdx = normalized.indexOf('/uploads/');
  if (uploadsIdx !== -1) {
    normalized = normalized.substring(uploadsIdx);
  } else if (normalized.startsWith('uploads/')) {
    normalized = `/${normalized}`;
  } else if (!normalized.startsWith('/uploads/')) {
    normalized = `/uploads/${normalized.replace(/^\//, '')}`;
  }
  return normalized;
};

export const buildAttachmentUrl = (path?: string | null): string => {
  const normalized = normalizeAttachmentPath(path);
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;

  const apiUrl = (import.meta as any).env?.VITE_API_URL || '';
  if (/^https?:\/\//i.test(apiUrl)) {
    const origin = apiUrl.replace(/\/api\/?$/, '');
    return `${origin}${normalized}`;
  }

  return normalized;
};

export const formatFileSize = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
