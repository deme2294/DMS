import pool from '../config/db.js';
import { HTTP } from '../config/constants.js';

export const authorize = (...permissions) => async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(HTTP.UNAUTHORIZED).json({ success: false, message: 'Authentication required' });
    }

    if (!permissions.length) return next();

    const placeholders = permissions.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT p.code
        FROM users u
        JOIN role_permissions rp ON rp.role_id = u.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE u.id = ? AND p.code IN (${placeholders})`,
       [req.user.id, ...permissions]
    );

    if (!rows.length) {
      return res.status(HTTP.FORBIDDEN).json({ success: false, message: 'Insufficient permissions' });
    }

    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(HTTP.FORBIDDEN).json({ success: false, message: 'Role not allowed' });
  }
  next();
};
