import pool from '../config/db.js';
import { v4 as uuidv4 } from 'uuid';

export const logAudit = async (
  userId,
  action,
  entityType,
  entityId,
  ipAddress,
  details,
  extra = {}
) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs
         (id, user_id, action, entity_type, entity_id, ip_address, role, old_value, new_value, browser, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uuidv4(),
        userId || null,
        action,
        entityType,
        entityId || null,
        ipAddress || extra.ip || null,
        extra.role || null,
        extra.oldValue ? JSON.stringify(extra.oldValue) : null,
        extra.newValue ? JSON.stringify(extra.newValue) : null,
        extra.browser || null,
        JSON.stringify(details || {}),
      ]
    );
  } catch (err) {
    console.error('Audit log failed:', err);
  }
};
