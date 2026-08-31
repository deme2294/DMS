export const normalizeAttachmentPath = (p?: string): string => {
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

export const buildAttachmentUrl = (path?: string): string => {
  const normalized = normalizeAttachmentPath(path);
  return normalized ? `/${normalized}` : '';
};
