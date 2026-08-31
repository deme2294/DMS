// Extract client metadata (IP + browser) for audit logging from an Express request.
export const clientMeta = (req) => ({
  ip: req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null,
  browser: req?.headers?.['user-agent'] || null,
});
