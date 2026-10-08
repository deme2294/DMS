export const normalizeAttachmentPath = (p?: string | null): string => {
  if (!p) return '';
  let normalized = p.replace(/\\/g, '/');
  if (/^https?:\/\//.test(normalized)) return normalized;
  const uploadsIdx = normalized.indexOf('/uploads/');
  if (uploadsIdx !== -1) {
    normalized = normalized.substring(uploadsIdx + 1);
  } else if (normalized.startsWith('/uploads/')) {
    normalized = normalized.substring(1);
  }
  return normalized;
};

export const buildAttachmentUrl = (path?: string | null): string => {
  const normalized = normalizeAttachmentPath(path);
  return normalized ? `/${normalized}` : '';
};

export const formatFileSize = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

