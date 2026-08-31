import * as auditRepo from '../repository/auditRepository.js';

/**
 * Log an auditable action.
 * @param {string} userId
 * @param {string} action
 * @param {string} entityType
 * @param {string} entityId
 * @param {string|null} ipAddress
 * @param {object} details
 * @param {object} [extra]  { role, oldValue, newValue, browser, ip }
 */
export const logAction = async (
  userId,
  action,
  entityType,
  entityId,
  ipAddress,
  details,
  extra = {}
) => {
  await auditRepo.logAudit(
    userId,
    action,
    entityType,
    entityId,
    ipAddress,
    details,
    {
      role: extra.role,
      oldValue: extra.oldValue,
      newValue: extra.newValue,
      browser: extra.browser,
      ip: extra.ip || ipAddress,
    }
  );
};
